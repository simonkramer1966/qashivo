/**
 * Conversation Brief Service
 *
 * Assembles a structured conversation brief for a debtor before any
 * outbound LLM generation. This is the "memory" that makes Charlie
 * a credit controller, not a bot.
 *
 * The brief is injected into every LLM prompt that generates
 * debtor-facing content (email, SMS, voice script).
 */

import { db } from "../db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  contacts,
  timelineEvents,
  forecastUserAdjustments,
  customerBehaviorSignals,
  aiFacts,
  customerPreferences,
  debtorIntelligence,
  paymentPromises,
  invoices,
  emailMessages,
  actions,
  tenants,
  cachedXeroCreditNotes,
  cachedXeroOverpayments,
  cachedXeroPrepayments,
} from "@shared/schema";

// ── Types ────────────────────────────────────────────────────

export interface ConversationBrief {
  /** Pre-formatted text block for LLM prompt injection */
  text: string;
  /** Structured data for programmatic use */
  data: ConversationBriefData;
}

export interface ConversationBriefData {
  relationshipSummary: {
    totalOutstanding: number;
    invoiceCount: number;
    oldestOverdueDays: number | null;
    specialInstructions: string | null;
    relationshipTier: string | null;
  };
  activeCommitments: {
    hasActivePromise: boolean;
    promiseDate: string | null;
    promiseAmount: number | null;
    promiseModified: boolean;
    previousPromiseDate: string | null;
    promiseReliabilityScore: number | null;
    hasPaymentPlan: boolean;
  };
  recentHistory: Array<{
    date: string;
    direction: string;
    channel: string;
    summary: string;
    outcomeType: string | null;
  }>;
  openDisputes: string[];
  channelHistory: {
    emailsSent: number;
    lastEmailDate: string | null;
    smsSent: number;
    lastSmsDate: string | null;
    callsMade: number;
    lastCallDate: string | null;
    preferredChannel: string | null;
  };
  creditBalance: {
    totalUnappliedCredits: number;
    netOutstanding: number;
    hasCredits: boolean;
  };
  debtorIntel: string[];
  constraints: string[];
  collectionPhase: {
    phase: 'inform' | 'elicit_date';
    chaseDelayDays: number;
    oldestOverdueDays: number | null;
    hasActiveArrangement: boolean;
  };
}

// ── Per-run cache ────────────────────────────────────────────

const briefCache = new Map<string, { brief: ConversationBrief; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — covers a full planning run

/** Clear cache for a contact (call on new inbound events) */
export function invalidateBriefCache(contactId: string): void {
  briefCache.delete(contactId);
}

/** Clear entire cache (call at start of planning run) */
export function clearBriefCache(): void {
  briefCache.clear();
}

// ── Main builder ─────────────────────────────────────────────

/**
 * Build a conversation brief for a debtor.
 * Cached per contact for the duration of a planning run.
 */
export async function buildConversationBrief(
  tenantId: string,
  contactId: string,
): Promise<ConversationBrief> {
  // Check cache
  const cached = briefCache.get(contactId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.brief;
  }

  // Load all data in parallel
  const [
    contact,
    timeline,
    promises,
    outstandingInvs,
    signals,
    facts,
    prefs,
    intel,
    recentEmails,
    recentActions,
    forecasts,
    tenantRecord,
  ] = await Promise.all([
    loadContact(tenantId, contactId),
    loadTimeline(tenantId, contactId),
    loadActivePromises(tenantId, contactId),
    loadOutstandingInvoices(tenantId, contactId),
    loadBehaviorSignals(tenantId, contactId),
    loadAiFacts(tenantId, contactId),
    loadPreferences(tenantId, contactId),
    loadIntelligence(tenantId, contactId),
    loadRecentEmails(tenantId, contactId),
    loadRecentActions(tenantId, contactId),
    loadActiveForecasts(tenantId, contactId),
    db.select({ chaseDelayDays: tenants.chaseDelayDays }).from(tenants).where(eq(tenants.id, tenantId)).limit(1).then(r => r[0]),
  ]);

  const chaseDelayDays = tenantRecord?.chaseDelayDays ?? 5;

  // Load credit balance (needs contact's xeroContactId — sequential after contact load)
  const creditBalance = await loadCreditBalance(tenantId, contact?.xeroContactId ?? null);

  const data = assembleData(
    contact, timeline, promises, outstandingInvs, signals,
    facts, prefs, intel, recentEmails, recentActions, forecasts, chaseDelayDays, creditBalance,
  );
  const text = formatBriefText(data, contact, prefs);

  const brief: ConversationBrief = { text, data };

  // Cache
  briefCache.set(contactId, { brief, cachedAt: Date.now() });

  return brief;
}

// ── Data loaders ─────────────────────────────────────────────

async function loadContact(tenantId: string, contactId: string) {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
    .limit(1);
  return row || null;
}

async function loadTimeline(tenantId: string, contactId: string) {
  return db
    .select()
    .from(timelineEvents)
    .where(and(
      eq(timelineEvents.tenantId, tenantId),
      eq(timelineEvents.customerId, contactId),
    ))
    .orderBy(desc(timelineEvents.occurredAt))
    .limit(15);
}

async function loadActivePromises(tenantId: string, contactId: string) {
  return db
    .select()
    .from(paymentPromises)
    .where(and(
      eq(paymentPromises.tenantId, tenantId),
      eq(paymentPromises.contactId, contactId),
      inArray(paymentPromises.status, ['open', 'rescheduled']),
    ))
    .orderBy(desc(paymentPromises.createdAt))
    .limit(5);
}

async function loadOutstandingInvoices(tenantId: string, contactId: string) {
  return db
    .select()
    .from(invoices)
    .where(and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.contactId, contactId),
    ))
    .orderBy(desc(invoices.dueDate));
}

async function loadBehaviorSignals(tenantId: string, contactId: string) {
  const [row] = await db
    .select()
    .from(customerBehaviorSignals)
    .where(and(
      eq(customerBehaviorSignals.contactId, contactId),
      eq(customerBehaviorSignals.tenantId, tenantId),
    ))
    .limit(1);
  return row || null;
}

async function loadAiFacts(tenantId: string, contactId: string) {
  return db
    .select()
    .from(aiFacts)
    .where(and(
      eq(aiFacts.tenantId, tenantId),
      eq(aiFacts.entityId, contactId),
      eq(aiFacts.isActive, true),
    ))
    .orderBy(desc(aiFacts.confidence))
    .limit(20);
}

async function loadPreferences(tenantId: string, contactId: string) {
  const [row] = await db
    .select()
    .from(customerPreferences)
    .where(and(
      eq(customerPreferences.contactId, contactId),
      eq(customerPreferences.tenantId, tenantId),
    ))
    .limit(1);
  return row || null;
}

async function loadIntelligence(tenantId: string, contactId: string) {
  const [row] = await db
    .select()
    .from(debtorIntelligence)
    .where(and(
      eq(debtorIntelligence.contactId, contactId),
      eq(debtorIntelligence.tenantId, tenantId),
    ))
    .limit(1);
  return row || null;
}

async function loadRecentEmails(tenantId: string, contactId: string) {
  return db
    .select({
      id: emailMessages.id,
      direction: emailMessages.direction,
      subject: emailMessages.subject,
      textBody: emailMessages.textBody,
      sentAt: emailMessages.sentAt,
      receivedAt: emailMessages.receivedAt,
    })
    .from(emailMessages)
    .where(and(
      eq(emailMessages.tenantId, tenantId),
      eq(emailMessages.contactId, contactId),
    ))
    .orderBy(desc(emailMessages.sentAt))
    .limit(5);
}

async function loadRecentActions(tenantId: string, contactId: string) {
  return db
    .select({
      id: actions.id,
      type: actions.type,
      status: actions.status,
      agentToneLevel: actions.agentToneLevel,
      completedAt: actions.completedAt,
      createdAt: actions.createdAt,
    })
    .from(actions)
    .where(and(
      eq(actions.tenantId, tenantId),
      eq(actions.contactId, contactId),
      inArray(actions.status, ['completed', 'sent']),
    ))
    .orderBy(desc(actions.completedAt))
    .limit(10);
}

async function loadActiveForecasts(tenantId: string, contactId: string) {
  // Forecasts don't have a contactId FK — match via description containing contact name
  // For PTP forecasts, we look for source='inbound_reply' adjustments
  return db
    .select()
    .from(forecastUserAdjustments)
    .where(and(
      eq(forecastUserAdjustments.tenantId, tenantId),
      eq(forecastUserAdjustments.source, 'inbound_reply'),
      eq(forecastUserAdjustments.affects, 'inflows'),
    ))
    .orderBy(desc(forecastUserAdjustments.createdAt))
    .limit(5);
}

async function loadCreditBalance(tenantId: string, xeroContactId: string | null): Promise<number> {
  if (!xeroContactId) return 0;

  // Sum remainingCredit from all three cached tables where status is AUTHORISED
  const [cnResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(${cachedXeroCreditNotes.remainingCredit}), 0)` })
    .from(cachedXeroCreditNotes)
    .where(and(
      eq(cachedXeroCreditNotes.tenantId, tenantId),
      eq(cachedXeroCreditNotes.xeroContactId, xeroContactId),
      eq(cachedXeroCreditNotes.status, 'AUTHORISED'),
    ));

  const [opResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(${cachedXeroOverpayments.remainingCredit}), 0)` })
    .from(cachedXeroOverpayments)
    .where(and(
      eq(cachedXeroOverpayments.tenantId, tenantId),
      eq(cachedXeroOverpayments.xeroContactId, xeroContactId),
      eq(cachedXeroOverpayments.status, 'AUTHORISED'),
    ));

  const [ppResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(${cachedXeroPrepayments.remainingCredit}), 0)` })
    .from(cachedXeroPrepayments)
    .where(and(
      eq(cachedXeroPrepayments.tenantId, tenantId),
      eq(cachedXeroPrepayments.xeroContactId, xeroContactId),
      eq(cachedXeroPrepayments.status, 'AUTHORISED'),
    ));

  return parseFloat(cnResult?.total || '0') + parseFloat(opResult?.total || '0') + parseFloat(ppResult?.total || '0');
}

// ── Data assembly ────────────────────────────────────────────

function assembleData(
  contact: any,
  timeline: any[],
  promises: any[],
  outstandingInvs: any[],
  signals: any,
  facts: any[],
  prefs: any,
  intel: any,
  recentEmails: any[],
  recentActions: any[],
  forecasts: any[],
  chaseDelayDays: number,
  creditBalance: number = 0,
): ConversationBriefData {
  const now = new Date();

  // Filter outstanding invoices
  const unpaid = outstandingInvs.filter((inv: any) => {
    const isPaid = inv.status === 'paid' || inv.status === 'cancelled';
    const isVoided = inv.invoiceStatus === 'VOID' || inv.invoiceStatus === 'PAID';
    return !isPaid && !isVoided;
  });

  const totalOutstanding = unpaid.reduce((sum: number, inv: any) => {
    return sum + (Number(inv.amount || 0) - Number(inv.amountPaid || 0));
  }, 0);

  let oldestOverdueDays: number | null = null;
  for (const inv of unpaid) {
    if (inv.dueDate) {
      const days = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      if (days > 0 && (oldestOverdueDays === null || days > oldestOverdueDays)) {
        oldestOverdueDays = days;
      }
    }
  }

  // Extract special instructions from aiFacts
  const specialFacts = facts.filter((f: any) =>
    f.category === 'relationship' || f.category === 'special_instruction' || f.category === 'contact_preference'
  );
  const specialInstructions = specialFacts.length > 0
    ? specialFacts.map((f: any) => f.value || f.content).join('; ')
    : null;

  // Relationship tier from facts
  const tierFact = facts.find((f: any) => f.factKey === 'relationship_tier' || f.category === 'relationship_tier');
  const relationshipTier = tierFact?.value || tierFact?.content || null;

  // Active commitments
  const activePromise = promises.find((p: any) => p.status === 'open');
  const rescheduledPromise = promises.find((p: any) => p.status === 'rescheduled');
  const promiseModified = !!rescheduledPromise && !!activePromise;

  // Channel history from timeline
  const emailEvents = timeline.filter((t: any) => t.channel === 'email' && t.direction === 'outbound');
  const smsEvents = timeline.filter((t: any) => t.channel === 'sms' && t.direction === 'outbound');
  const callEvents = timeline.filter((t: any) => t.channel === 'voice' && t.direction === 'outbound');

  // Open disputes
  const disputeEvents = timeline.filter((t: any) =>
    t.outcomeType === 'dispute' || t.outcomeType === 'dispute_raised'
  );
  const openDisputes = disputeEvents.map((d: any) => d.summary);

  // Debtor intelligence
  const debtorIntel: string[] = [];
  const seasonalFacts = facts.filter((f: any) => f.category === 'seasonal_pattern');
  for (const sf of seasonalFacts) {
    debtorIntel.push(`Seasonal: ${sf.value || sf.content}`);
  }
  const channelPrefFacts = facts.filter((f: any) => f.category === 'channel_preference');
  for (const cf of channelPrefFacts) {
    debtorIntel.push(`Channel preference: ${cf.value || cf.content}`);
  }
  if (intel?.creditRiskScore != null) {
    debtorIntel.push(`Credit risk score: ${intel.creditRiskScore}/100`);
  }
  if (intel?.aiRiskSummary) {
    debtorIntel.push(`Risk summary: ${intel.aiRiskSummary}`);
  }
  if (intel?.companyStatus) {
    debtorIntel.push(`Companies House status: ${intel.companyStatus}`);
  }

  // Constraints (what NOT to do)
  const constraints: string[] = [];
  if (timeline.length > 0) {
    constraints.push('Do NOT send a first reminder — we have already been in contact with this debtor.');
  }
  if (activePromise) {
    constraints.push('Do NOT ignore the active payment promise — reference it.');
    constraints.push('Do NOT chase invoices covered by the payment arrangement.');
  }
  if (openDisputes.length > 0) {
    constraints.push('Do NOT ignore the active dispute — acknowledge it.');
  }
  if (contact?.legalResponseWindowEnd) {
    const windowEnd = new Date(contact.legalResponseWindowEnd);
    if (windowEnd > now) {
      constraints.push(`Legal response window active until ${windowEnd.toLocaleDateString('en-GB')} — do NOT escalate tone.`);
    }
  }
  if (contact?.probablePaymentDetected) {
    constraints.push('Probable payment detected — do NOT chase aggressively, payment may have been made.');
  }
  if (creditBalance > 0) {
    const netAmount = Math.max(0, totalOutstanding - creditBalance);
    constraints.push(`Debtor has £${creditBalance.toFixed(2)} in unapplied credits. Reference net outstanding (£${netAmount.toFixed(2)}), NOT gross invoice totals.`);
  }

  return {
    relationshipSummary: {
      totalOutstanding,
      invoiceCount: unpaid.length,
      oldestOverdueDays,
      specialInstructions,
      relationshipTier,
    },
    activeCommitments: {
      hasActivePromise: !!activePromise,
      promiseDate: activePromise?.promisedDate
        ? new Date(activePromise.promisedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null,
      promiseAmount: activePromise?.promisedAmount ? Number(activePromise.promisedAmount) : null,
      promiseModified,
      previousPromiseDate: rescheduledPromise?.promisedDate
        ? new Date(rescheduledPromise.promisedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null,
      promiseReliabilityScore: signals?.promiseBreachCount != null
        ? Math.max(0, 100 - (signals.promiseBreachCount * 20))
        : null,
      hasPaymentPlan: unpaid.some((inv: any) => inv.pauseState === 'payment_plan'),
    },
    recentHistory: timeline.slice(0, 10).map((t: any) => ({
      date: new Date(t.occurredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      direction: t.direction || 'system',
      channel: t.channel || 'system',
      summary: t.summary || '',
      outcomeType: t.outcomeType || null,
    })),
    openDisputes,
    channelHistory: {
      emailsSent: emailEvents.length,
      lastEmailDate: emailEvents[0]?.occurredAt
        ? new Date(emailEvents[0].occurredAt).toLocaleDateString('en-GB')
        : null,
      smsSent: smsEvents.length,
      lastSmsDate: smsEvents[0]?.occurredAt
        ? new Date(smsEvents[0].occurredAt).toLocaleDateString('en-GB')
        : null,
      callsMade: callEvents.length,
      lastCallDate: callEvents[0]?.occurredAt
        ? new Date(callEvents[0].occurredAt).toLocaleDateString('en-GB')
        : null,
      preferredChannel: prefs?.preferredChannel || null,
    },
    creditBalance: {
      totalUnappliedCredits: creditBalance,
      netOutstanding: Math.max(0, totalOutstanding - creditBalance),
      hasCredits: creditBalance > 0,
    },
    debtorIntel,
    constraints,
    collectionPhase: {
      phase: (oldestOverdueDays != null && oldestOverdueDays > chaseDelayDays) ? 'elicit_date' : 'inform',
      chaseDelayDays,
      oldestOverdueDays,
      hasActiveArrangement: !!activePromise || unpaid.some((inv: any) => inv.pauseState === 'payment_plan'),
    },
  };
}

// ── Text formatter ───────────────────────────────────────────

function formatBriefText(data: ConversationBriefData, contact: any, prefs?: any): string {
  const lines: string[] = [];
  const name = contact?.companyName || contact?.name || 'Unknown';

  lines.push(`CONVERSATION BRIEF FOR ${name.toUpperCase()}`);
  lines.push('');

  // Relationship summary
  lines.push('RELATIONSHIP SUMMARY:');
  lines.push(`- Total outstanding: £${data.relationshipSummary.totalOutstanding.toFixed(2)} across ${data.relationshipSummary.invoiceCount} invoice(s)`);
  if (data.relationshipSummary.oldestOverdueDays != null) {
    lines.push(`- Oldest overdue: ${data.relationshipSummary.oldestOverdueDays} days`);
  }
  if (data.relationshipSummary.relationshipTier) {
    lines.push(`- Relationship tier: ${data.relationshipSummary.relationshipTier}`);
  }
  if (data.relationshipSummary.specialInstructions) {
    lines.push(`- Special instructions: ${data.relationshipSummary.specialInstructions}`);
  }
  lines.push('');

  // Credit balance
  if (data.creditBalance.hasCredits) {
    lines.push('CREDIT BALANCE:');
    lines.push(`This debtor has £${data.creditBalance.totalUnappliedCredits.toFixed(2)} in unapplied credits (credit notes/overpayments). Their net outstanding after credits is £${data.creditBalance.netOutstanding.toFixed(2)}. You MUST reference the net amount (£${data.creditBalance.netOutstanding.toFixed(2)}), NOT the gross invoice total. Do not chase for the credited portion.`);
    lines.push('');
  }

  // Collection phase
  lines.push('COLLECTION PHASE:');
  if (data.collectionPhase.hasActiveArrangement) {
    lines.push('- Phase: ARRANGEMENT IN PLACE — debtor has committed to a payment date or plan. Monitor, do not chase.');
  } else if (data.collectionPhase.phase === 'inform') {
    lines.push(`- Phase: 1 (Inform) — invoice is new or within ${data.collectionPhase.chaseDelayDays}-day grace period. One polite nudge only. Do NOT chase silence.`);
  } else {
    lines.push(`- Phase: 2 (Elicit Date) — invoice is ${data.collectionPhase.oldestOverdueDays} days overdue (past ${data.collectionPhase.chaseDelayDays}-day grace period). Actively seek a specific payment date.`);
  }
  lines.push('');

  // Active commitments
  lines.push('ACTIVE COMMITMENTS:');
  if (data.activeCommitments.hasActivePromise) {
    let promiseLine = `- Payment promise: £${data.activeCommitments.promiseAmount?.toFixed(2) || '?'} by ${data.activeCommitments.promiseDate || 'unknown date'}`;
    if (data.activeCommitments.promiseModified && data.activeCommitments.previousPromiseDate) {
      promiseLine += ` (modified from ${data.activeCommitments.previousPromiseDate})`;
    }
    lines.push(promiseLine);
    if (data.activeCommitments.promiseReliabilityScore != null) {
      lines.push(`- Promise reliability: PRS ${data.activeCommitments.promiseReliabilityScore}`);
    }
  } else {
    lines.push('- No active payment promises');
  }
  if (data.activeCommitments.hasPaymentPlan) {
    lines.push('- Payment plan in place — some invoices paused');
  }
  lines.push('');

  // Recent communication history
  lines.push('RECENT COMMUNICATION HISTORY (most recent first):');
  if (data.recentHistory.length > 0) {
    for (const entry of data.recentHistory) {
      let line = `- [${entry.date}] ${entry.direction.toUpperCase()} via ${entry.channel}: ${entry.summary}`;
      if (entry.outcomeType) line += ` (${entry.outcomeType})`;
      lines.push(line);
    }
  } else {
    lines.push('- No prior communication on record. This is the first contact.');
  }
  lines.push('');

  // Open disputes
  if (data.openDisputes.length > 0) {
    lines.push('OPEN DISPUTES:');
    for (const d of data.openDisputes) {
      lines.push(`- ${d}`);
    }
    lines.push('');
  }

  // Channel history
  lines.push('CHANNEL HISTORY:');
  lines.push(`- Emails sent: ${data.channelHistory.emailsSent}${data.channelHistory.lastEmailDate ? ` (last: ${data.channelHistory.lastEmailDate})` : ''}`);
  lines.push(`- SMS sent: ${data.channelHistory.smsSent}${data.channelHistory.lastSmsDate ? ` (last: ${data.channelHistory.lastSmsDate})` : ''}`);
  lines.push(`- Calls made: ${data.channelHistory.callsMade}${data.channelHistory.lastCallDate ? ` (last: ${data.channelHistory.lastCallDate})` : ''}`);
  if (data.channelHistory.preferredChannel) {
    lines.push(`- Preferred channel: ${data.channelHistory.preferredChannel}`);
  }
  lines.push('');

  // Debtor intelligence
  if (data.debtorIntel.length > 0) {
    lines.push('DEBTOR INTELLIGENCE:');
    for (const d of data.debtorIntel) {
      lines.push(`- ${d}`);
    }
    lines.push('');
  }

  // Contact preferences (only show debtor-level overrides)
  if (prefs) {
    const prefLines: string[] = [];
    if (prefs.bestContactWindowStart || prefs.bestContactWindowEnd) {
      prefLines.push(`- Hours: ${prefs.bestContactWindowStart || '?'}–${prefs.bestContactWindowEnd || '?'}${prefs.contactTimezone ? ` ${prefs.contactTimezone}` : ''} (debtor specific)`);
    }
    if (prefs.bestContactDays) {
      const days = prefs.bestContactDays as string[];
      if (days.length > 0 && days.length < 7) {
        prefLines.push(`- Days: ${days.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')} only`);
      }
    }
    if (prefs.doNotContactUntil) {
      const until = new Date(prefs.doNotContactUntil);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      until.setHours(0, 0, 0, 0);
      if (today <= until) {
        prefLines.push(`- BLACKOUT: Do not contact until ${until.toISOString().slice(0, 10)}${prefs.doNotContactReason ? ` (${prefs.doNotContactReason})` : ''}`);
      } else {
        // Post-blackout — check if within 14 days of expiry
        const fourteenDaysAfter = new Date(until);
        fourteenDaysAfter.setDate(fourteenDaysAfter.getDate() + 14);
        if (today <= fourteenDaysAfter) {
          prefLines.push(`- NOTE: Debtor was in a do-not-contact period until ${until.toISOString().slice(0, 10)}${prefs.doNotContactReason ? `. Reason: ${prefs.doNotContactReason}` : ''}. This is the first contact since the period ended.`);
        }
      }
    }
    const channelStatus = [
      prefs.emailEnabled !== false ? 'Email' : null,
      prefs.smsEnabled !== false ? 'SMS' : null,
      prefs.voiceEnabled !== false ? 'Voice' : null,
    ].filter(Boolean).join(', ');
    const channelBlocked = [
      prefs.emailEnabled === false ? 'Email' : null,
      prefs.smsEnabled === false ? 'SMS' : null,
      prefs.voiceEnabled === false ? 'Voice' : null,
    ].filter(Boolean);
    if (channelBlocked.length > 0) {
      prefLines.push(`- Channels: ${channelStatus} (${channelBlocked.join(', ')} disabled)`);
    }
    if (prefs.preferredChannelOverride) {
      prefLines.push(`- Override: Always ${prefs.preferredChannelOverride} (${prefs.preferredChannelOverrideSource || 'manual'})`);
    }
    if (prefLines.length > 0) {
      lines.push('CONTACT PREFERENCES:');
      lines.push(...prefLines);
      lines.push('');
    }
  }

  // Constraints
  if (data.constraints.length > 0) {
    lines.push('WHAT NOT TO DO:');
    for (const c of data.constraints) {
      lines.push(`- ${c}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
