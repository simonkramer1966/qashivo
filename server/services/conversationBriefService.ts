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
  unallocatedPayments,
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
    preview: string | null;
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
    hasCredits: boolean;
  };
  unallocatedPayments: Array<{
    amount: number;
    dateReceived: string;
    remainingAmount: number;
    status: string;
  }>;
  debtorIntel: string[];
  constraints: string[];
  collectionPhase: {
    phase: 'inform' | 'elicit_date';
    chaseDelayDays: number;
    oldestOverdueDays: number | null;
    hasActiveArrangement: boolean;
  };
}

/**
 * Chase context: which invoices the current action is actually chasing.
 * When provided, the brief will tell the LLM to demand payment of THIS amount
 * (the bundle), not the relationship-wide total. The relationship total is
 * still shown for context but explicitly demoted to "context only — do not
 * cite in the email".
 */
export interface ChaseContext {
  /** Sum of (amount - amountPaid) for the invoices being chased */
  chaseAmount: number;
  /** Number of invoices in the chase bundle */
  chaseInvoiceCount: number;
  /** Currency symbol/code (defaults to GBP) */
  currency?: string;
}

// ── Per-run cache ────────────────────────────────────────────

const briefCache = new Map<string, { brief: ConversationBrief; cachedAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — covers a full planning run + retries

/** Clear cache for a contact (call on new inbound events) */
export function invalidateBriefCache(contactId: string): void {
  // Clear all cache entries for this contact (any chase context variant)
  const keys = Array.from(briefCache.keys());
  for (const key of keys) {
    if (key.startsWith(`${contactId}:`)) briefCache.delete(key);
  }
}

/** Clear entire cache (call at start of planning run) */
export function clearBriefCache(): void {
  briefCache.clear();
}

// ── Main builder ─────────────────────────────────────────────

/**
 * Build a conversation brief for a debtor.
 * Cached per contact for the duration of a planning run.
 *
 * @param chaseContext - Optional. When provided, the brief frames the email
 *   around chasing the bundled amount, not the relationship-wide total. Pass
 *   this from any caller that has already determined which invoices the
 *   current action will chase (e.g. collectionsAgent with action.invoiceIds).
 */
export async function buildConversationBrief(
  tenantId: string,
  contactId: string,
  chaseContext?: ChaseContext,
): Promise<ConversationBrief> {
  // Cache key includes chase context so different bundles don't collide
  const cacheKey = chaseContext
    ? `${contactId}:${chaseContext.chaseAmount.toFixed(2)}:${chaseContext.chaseInvoiceCount}`
    : `${contactId}:none`;
  const cached = briefCache.get(cacheKey);
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

  // Load live unallocated payments (manual confirmations not yet reconciled in Xero)
  const unallocatedRows = await db
    .select()
    .from(unallocatedPayments)
    .where(and(
      eq(unallocatedPayments.tenantId, tenantId),
      eq(unallocatedPayments.contactId, contactId),
      inArray(unallocatedPayments.status, ['unallocated', 'partially_allocated']),
    ))
    .orderBy(desc(unallocatedPayments.dateReceived));

  const chaseDelayDays = tenantRecord?.chaseDelayDays ?? 5;

  // Load credit balance (needs contact's xeroContactId — sequential after contact load)
  const creditBalance = await loadCreditBalance(tenantId, contact?.xeroContactId ?? null);

  const data = assembleData(
    contact, timeline, promises, outstandingInvs, signals,
    facts, prefs, intel, recentEmails, recentActions, forecasts, chaseDelayDays, creditBalance,
    chaseContext, unallocatedRows,
  );
  let text = formatBriefText(data, contact, prefs, intel, chaseContext);

  // Token guard rail — collapse history to 8 entries if over budget.
  // Rough char/token ratio (~4 chars/token) is good enough for a guard;
  // a single rebuild is sufficient — no iterative shrinking needed.
  const estTokens = Math.ceil(text.length / 4);
  if (estTokens > 900) {
    const truncatedData: ConversationBriefData = {
      ...data,
      recentHistory: data.recentHistory.slice(0, 8),
    };
    text = formatBriefText(truncatedData, contact, prefs, intel, chaseContext);
  }

  const brief: ConversationBrief = { text, data };

  // Cache
  briefCache.set(cacheKey, { brief, cachedAt: Date.now() });

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
  chaseContext?: ChaseContext,
  unallocatedRows: any[] = [],
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

  // Unallocated payments — strict language rules when present.
  const unallocatedSummary = unallocatedRows
    .filter((r: any) => r.status === 'unallocated' || r.status === 'partially_allocated')
    .map((r: any) => ({
      amount: Number(r.amount || 0),
      dateReceived: new Date(r.dateReceived).toLocaleDateString('en-GB'),
      remainingAmount: Number(r.remainingAmount || 0),
      status: r.status,
    }));
  const totalUnallocated = unallocatedSummary.reduce((sum, r) => sum + r.remainingAmount, 0);
  if (unallocatedSummary.length > 0) {
    constraints.push(
      `UNALLOCATED PAYMENTS — £${totalUnallocated.toFixed(2)} has been confirmed received from this debtor but is not yet reconciled in Xero. Do NOT reference specific invoice numbers or amounts in this email. Acknowledge the payment(s) with thanks and chase only the NET remaining balance. Do NOT send an invoice table. Use an appreciative, relationship-first tone.`
    );
  }
  // Note: We deliberately do NOT compute or reference a "net outstanding"
  // figure that subtracts unallocated credits from the relationship total.
  // That number is misleading: each invoice's amount already reflects any
  // credits that have been allocated to it, and unallocated credits are just
  // sitting on the account until the debtor (or we) decide what to do with
  // them. The chase amount comes from the bundle, full stop.
  if (chaseContext) {
    // When a specific bundle is being chased, the chase amount overrides
    // every other amount in the brief. The LLM must demand THIS amount.
    constraints.push(
      `THIS EMAIL CHASES £${chaseContext.chaseAmount.toFixed(2)} across ${chaseContext.chaseInvoiceCount} invoice(s) — NOT the relationship total. Demand payment of £${chaseContext.chaseAmount.toFixed(2)} only. Do NOT cite the relationship total of £${totalOutstanding.toFixed(2)} as the amount owed. The relationship total may be mentioned briefly as context ("we also note your overall account balance stands at £${totalOutstanding.toFixed(2)}") but the payment demand and subject line must be for the chase amount only.`
    );
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
    recentHistory: timeline.slice(0, 15).map((t: any) => {
      const rawPreview: string | null = t.preview || (t.body ? String(t.body).split('\n').find((l: string) => l.trim()) : null) || null;
      const trimmed = rawPreview ? rawPreview.trim().replace(/\s+/g, ' ') : null;
      const preview = trimmed && trimmed.length > 0
        ? (trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed)
        : null;
      return {
        date: new Date(t.occurredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        direction: t.direction || 'system',
        channel: t.channel || 'system',
        summary: t.summary || '',
        preview,
        outcomeType: t.outcomeType || null,
      };
    }),
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
      hasCredits: creditBalance > 0,
    },
    unallocatedPayments: unallocatedSummary,
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

function formatBriefText(
  data: ConversationBriefData,
  contact: any,
  prefs?: any,
  intel?: any,
  chaseContext?: ChaseContext,
): string {
  const lines: string[] = [];
  const name = contact?.companyName || contact?.name || 'Unknown';

  lines.push(`CONVERSATION BRIEF FOR ${name.toUpperCase()}`);
  lines.push('');

  // Helper — every section always renders, falling back to "None recorded".
  const section = (heading: string, body: string[]) => {
    lines.push(`=== ${heading} ===`);
    if (body.length === 0) {
      lines.push('None recorded.');
    } else {
      lines.push(...body);
    }
    lines.push('');
  };

  // 1. CHASE CONTEXT — always rendered
  const chaseLines: string[] = [];
  if (chaseContext) {
    chaseLines.push(`Amount to demand: £${chaseContext.chaseAmount.toFixed(2)}`);
    chaseLines.push(`Invoices in this chase: ${chaseContext.chaseInvoiceCount}`);
    chaseLines.push('This is the ONLY amount you should ask the debtor to pay. The OUTSTANDING INVOICES section of the user prompt lists the specific invoices — reference them individually by invoice number, amount, and days overdue.');
    chaseLines.push(`The subject line must reflect the chase amount (£${chaseContext.chaseAmount.toFixed(2)}), not the relationship total.`);
  } else {
    chaseLines.push('No specific chase bundle for this message — treat the relationship balance as context only and respond to the debtor based on the conversation history below.');
  }
  section('CHASE CONTEXT', chaseLines);

  // 2. RELATIONSHIP SUMMARY — always rendered, includes collection phase
  const relLines: string[] = [];
  relLines.push(`Total relationship balance: £${data.relationshipSummary.totalOutstanding.toFixed(2)} across ${data.relationshipSummary.invoiceCount} invoice(s)${chaseContext ? ' (account-wide context — do NOT cite as the amount owed)' : ''}`);
  relLines.push(`Oldest overdue: ${data.relationshipSummary.oldestOverdueDays != null ? `${data.relationshipSummary.oldestOverdueDays} days` : 'no overdue invoices'}`);
  relLines.push(`Relationship tier: ${data.relationshipSummary.relationshipTier || 'None recorded'}`);
  relLines.push(`Special instructions: ${data.relationshipSummary.specialInstructions || 'None recorded'}`);
  if (data.collectionPhase.hasActiveArrangement) {
    relLines.push('Collection phase: ARRANGEMENT IN PLACE — debtor has committed to a payment date or plan. Monitor, do not chase.');
  } else if (data.collectionPhase.phase === 'inform') {
    relLines.push(`Collection phase: 1 (Inform) — invoice is new or within ${data.collectionPhase.chaseDelayDays}-day grace period. One polite nudge only. Do NOT chase silence.`);
  } else {
    relLines.push(`Collection phase: 2 (Elicit Date) — invoice is ${data.collectionPhase.oldestOverdueDays} days overdue (past ${data.collectionPhase.chaseDelayDays}-day grace period). Actively seek a specific payment date.`);
  }
  section('RELATIONSHIP SUMMARY', relLines);

  // 3. ACTIVE COMMITMENTS — always rendered
  const commitLines: string[] = [];
  if (data.activeCommitments.hasActivePromise) {
    let promiseLine = `Payment promise: £${data.activeCommitments.promiseAmount?.toFixed(2) || '?'} by ${data.activeCommitments.promiseDate || 'unknown date'}`;
    if (data.activeCommitments.promiseModified && data.activeCommitments.previousPromiseDate) {
      promiseLine += ` (modified from ${data.activeCommitments.previousPromiseDate})`;
    }
    commitLines.push(promiseLine);
    if (data.activeCommitments.promiseReliabilityScore != null) {
      commitLines.push(`Promise reliability: PRS ${data.activeCommitments.promiseReliabilityScore}`);
    }
  }
  if (data.activeCommitments.hasPaymentPlan) {
    commitLines.push('Payment plan in place — some invoices paused');
  }
  section('ACTIVE COMMITMENTS', commitLines);

  // 3b. UNALLOCATED PAYMENTS — only rendered when present
  if (data.unallocatedPayments.length > 0) {
    const upLines: string[] = [];
    const total = data.unallocatedPayments.reduce((sum, r) => sum + r.remainingAmount, 0);
    upLines.push(`Unallocated payments total: £${total.toFixed(2)} (confirmed received, not yet reconciled in Xero)`);
    for (const r of data.unallocatedPayments) {
      upLines.push(`  • £${r.amount.toFixed(2)} received ${r.dateReceived} — £${r.remainingAmount.toFixed(2)} remaining (${r.status})`);
    }
    upLines.push('STRICT RULES when drafting this email:');
    upLines.push('  - Do NOT reference specific invoice numbers or invoice amounts.');
    upLines.push('  - Do NOT send an HTML invoice table.');
    upLines.push('  - Acknowledge the payment(s) with thanks.');
    upLines.push('  - Chase ONLY the net remaining balance (gross overdue minus unallocated).');
    upLines.push('  - Use an appreciative, relationship-first tone — the debtor has paid.');
    section('UNALLOCATED PAYMENTS', upLines);
  }

  // 4. RECENT COMMUNICATION HISTORY — always rendered (richer per-entry)
  const histLines: string[] = [];
  for (const entry of data.recentHistory) {
    let head = `[${entry.date}] ${entry.direction.toUpperCase()} ${entry.channel}: ${entry.summary || '(no summary)'}`;
    if (entry.outcomeType) head += ` (${entry.outcomeType})`;
    histLines.push(head);
    if (entry.preview) {
      histLines.push(`    "${entry.preview}"`);
    }
  }
  section('RECENT COMMUNICATION HISTORY (most recent first)', histLines);

  // 5. OPEN DISPUTES — always rendered
  section('OPEN DISPUTES', data.openDisputes);

  // 6. CHANNEL HISTORY — always rendered
  const chanLines: string[] = [];
  chanLines.push(`Emails sent: ${data.channelHistory.emailsSent}${data.channelHistory.lastEmailDate ? ` (last: ${data.channelHistory.lastEmailDate})` : ''}`);
  chanLines.push(`SMS sent: ${data.channelHistory.smsSent}${data.channelHistory.lastSmsDate ? ` (last: ${data.channelHistory.lastSmsDate})` : ''}`);
  chanLines.push(`Calls made: ${data.channelHistory.callsMade}${data.channelHistory.lastCallDate ? ` (last: ${data.channelHistory.lastCallDate})` : ''}`);
  chanLines.push(`Preferred channel: ${data.channelHistory.preferredChannel || 'None recorded'}`);
  section('CHANNEL HISTORY', chanLines);

  // 7. DEBTOR INTELLIGENCE — always rendered
  const intelLines: string[] = [...data.debtorIntel];
  if (intel?.industrySector && !intelLines.some(l => l.includes('Industry'))) {
    intelLines.push(`Industry: ${intel.industrySector}`);
  }
  if (intel?.sizeClassification && !intelLines.some(l => l.includes('Size'))) {
    intelLines.push(`Size: ${intel.sizeClassification}`);
  }
  if (intel?.companyAge != null && !intelLines.some(l => l.includes('Company age'))) {
    intelLines.push(`Company age: ${intel.companyAge} years`);
  }
  if (intel?.insolvencyRisk) {
    intelLines.push('INSOLVENCY RISK FLAG — proceed with caution.');
  }
  section('DEBTOR INTELLIGENCE', intelLines);

  // 8. CONTACT PREFERENCES — always rendered
  const prefLines: string[] = [];
  if (prefs) {
    if (prefs.bestContactWindowStart || prefs.bestContactWindowEnd) {
      prefLines.push(`Hours: ${prefs.bestContactWindowStart || '?'}–${prefs.bestContactWindowEnd || '?'}${prefs.contactTimezone ? ` ${prefs.contactTimezone}` : ''} (debtor specific)`);
    }
    if (prefs.bestContactDays) {
      const days = prefs.bestContactDays as string[];
      if (days && days.length > 0 && days.length < 7) {
        prefLines.push(`Days: ${days.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ')} only`);
      }
    }
    if (prefs.doNotContactUntil) {
      const until = new Date(prefs.doNotContactUntil);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      until.setHours(0, 0, 0, 0);
      if (today <= until) {
        prefLines.push(`BLACKOUT: Do not contact until ${until.toISOString().slice(0, 10)}${prefs.doNotContactReason ? ` (${prefs.doNotContactReason})` : ''}`);
      } else {
        const fourteenDaysAfter = new Date(until);
        fourteenDaysAfter.setDate(fourteenDaysAfter.getDate() + 14);
        if (today <= fourteenDaysAfter) {
          prefLines.push(`NOTE: Debtor was in a do-not-contact period until ${until.toISOString().slice(0, 10)}${prefs.doNotContactReason ? `. Reason: ${prefs.doNotContactReason}` : ''}. This is the first contact since the period ended.`);
        }
      }
    }
    const channelBlocked = [
      prefs.emailEnabled === false ? 'Email' : null,
      prefs.smsEnabled === false ? 'SMS' : null,
      prefs.voiceEnabled === false ? 'Voice' : null,
    ].filter(Boolean) as string[];
    if (channelBlocked.length > 0) {
      prefLines.push(`Disabled channels: ${channelBlocked.join(', ')}`);
    }
    if (prefs.preferredChannelOverride) {
      prefLines.push(`Override: Always ${prefs.preferredChannelOverride} (${prefs.preferredChannelOverrideSource || 'manual'})`);
    }
  }
  if (prefLines.length === 0) {
    section('CONTACT PREFERENCES', ['No overrides — use tenant defaults.']);
  } else {
    section('CONTACT PREFERENCES', prefLines);
  }

  // 9. CREDIT NOTES — always rendered
  if (data.creditBalance.hasCredits) {
    section('CREDIT NOTES', [
      `Unallocated credits of £${data.creditBalance.totalUnappliedCredits.toFixed(2)} exist on this account. Do NOT subtract them from the chase amount or any invoice total — each invoice already reflects any credits allocated to it. Mention these only if the debtor raises them.`,
    ]);
  } else {
    section('CREDIT NOTES', []);
  }

  // 10. WHAT NOT TO DO — always rendered
  if (data.constraints.length === 0) {
    section('WHAT NOT TO DO', ['No hard blocks — proceed with the standard playbook.']);
  } else {
    section('WHAT NOT TO DO', data.constraints);
  }

  return lines.join('\n');
}
