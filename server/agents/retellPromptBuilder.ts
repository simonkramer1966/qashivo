/**
 * Retell Prompt Builder — Voice Call Briefing Service (Phase 2: Enforcement)
 *
 * Assembles full debtor context from multiple sources and calls Claude
 * to compose a single prose call_briefing for Retell AI. Each briefing
 * reads like a senior credit controller briefing a junior colleague on
 * the way into a call. No templates — every briefing LLM-composed.
 *
 * Pipeline stages:
 *   1. assembleContext    — load all data sources, build context object
 *   2. preGenerationChecks — vulnerability, daily limit, tone floor, phone
 *   3. generateBriefing   — Claude API call
 *   4. postGenerationChecks — identity integrity, content safety
 *   5. applyTestMode      — communication mode enforcement
 */

import { createHash } from "crypto";
import { db } from "../db";
import { eq, and, or, desc, inArray, isNull, gte, sql } from "drizzle-orm";
import {
  contacts,
  invoices,
  tenants,
  agentPersonas,
  paymentPromises,
  disputes,
  aiFacts,
  customerLearningProfiles,
  actions,
} from "@shared/schema";
import { storage } from "../storage";
import { generateText } from "../services/llm/claude";
import {
  buildConversationBrief,
  type ConversationBriefData,
} from "../services/conversationBriefService";
import {
  buildBarrierContext,
  diagnoseBarrier,
} from "../services/influence/barrierDiagnostic";
import {
  deriveEscalationStage,
  selectStrategy,
} from "../services/influence/strategySelector";
import { generateVoiceCallBrief } from "../services/influence/voiceCallBriefGenerator";
import {
  resolvePersonaFraming,
  hasContactReceivedAgencyCommunication,
} from "../services/influence/personaFraming";
import { getSocialProofData } from "../services/influence/cieConsumer";
import {
  fitDistribution,
  describeDistribution,
} from "../services/paymentDistribution";

// ── Types ────────────────────────────────────────────────────

export type VoiceCallReason =
  | "first_contact"
  | "follow_up_no_response"
  | "broken_promise"
  | "escalation"
  | "payment_plan_check"
  | "dispute_resolution"
  | "relationship_check"
  | "balance_review";

export type VoiceCallGoal =
  | "secure_payment_date"
  | "agree_payment_plan"
  | "confirm_receipt"
  | "resolve_dispute"
  | "capture_contact"
  | "establish_relationship"
  | "follow_up_promise";

export interface VoiceCallTrigger {
  tenantId: string;
  contactId: string;
  invoiceIds: string[];
  reasonForCall: VoiceCallReason;
  callGoal: VoiceCallGoal;
  voiceToneOverride?: string;
  triggerSource:
    | "charlie_autonomous"
    | "charlie_approved"
    | "manual_user"
    | "manual_riley";
}

export interface VoiceBriefing {
  briefing: string;
  resolvedPhoneNumber: string;
  isTestMode: boolean;
  metadata: {
    influenceBarrier: string;
    influenceStrategy: string;
    toneLevel: string;
    personaFraming: string;
    contextHash: string;
    claudeLatencyMs: number;
    claudeTokensUsed: number;
    generatedAt: string;
  };
}

export class VoiceCallBlockedError extends Error {
  constructor(
    public reason: string,
    public code: string,
  ) {
    super(`Voice call blocked: ${reason}`);
    this.name = "VoiceCallBlockedError";
  }
}

// ── Internal context type ────────────────────────────────────

interface BriefingContext {
  contact: any;
  tenant: any;
  persona: any;
  resolvedPhoneNumber: string;
  entityType: string;
  invoiceState: {
    invoices: Array<{
      invoiceNumber: string;
      amount: number;
      amountDue: number;
      dueDate: string;
      daysOverdue: number;
      partialPayments: number;
      status: string;
    }>;
    totalOutstanding: number;
    totalOverdue: number;
  };
  briefData: ConversationBriefData | null;
  promiseHistory: {
    activePromises: Array<{ promiseDate: string; amount: number; status: string }>;
    recentHistory: Array<{ promiseDate: string; amount: number; outcome: string; daysLate: number | null }>;
  };
  disputeState: {
    openDisputes: Array<{ description: string | null; raisedDate: string; invoiceRef: string | null }>;
    recentlyResolved: Array<{ description: string | null; resolvedDate: string; outcome: string }>;
  };
  rileyIntel: Array<{ category: string; key: string; value: string; confidence: number }>;
  paymentBehaviour: {
    medianDaysToPay: number | null;
    paymentTrend: string;
    reliabilityDescription: string;
    lastPaymentDate: string | null;
    lastPaymentAmount: number | null;
  };
  toneState: {
    currentToneLevel: string;
    manualToneOverride: string | null;
  };
  diagnosis: { barrier: string; confidence: number; signals: string[]; reasoning: string };
  strategy: { name: string; toneAlignment: string; pcpGuidance: any; techniques: any; avoid: any };
  framing: { mode: string; isTransition: boolean; voiceIntro: string };
  voiceInfluenceBrief: string;
  assembledContext: Record<string, any>;
  contextHash: string;
}

// ── System prompt ────────────────────────────────────────────

const BRIEFING_SYSTEM_PROMPT = `You are composing a call briefing for Charlie, an AI voice agent \
calling on behalf of a UK SME's credit control function. The \
briefing will be passed to Charlie as a single block of prose \
and is the authoritative source of context for that call.

A good briefing contains:
- Who is being called and the relationship (one sentence)
- Why the call is being made (one sentence)
- The specific goal that defines success for this call
- The tone to use and why that tone is correct for this debtor
- A compact factual state of the account
- The specific opening approach (first 15 seconds)
- What to do if the debtor is vague, disputes, can only part-pay, \
or asks to be called back
- Anything the voice agent must not do or say on this particular call

The briefing should sound like a senior credit controller briefing \
a junior colleague on the way into a call. Concrete, warm, \
practical. Not corporate, not scripted, not robotic.

RULES:
- Never invent facts. If context is missing, leave it out.
- Never include raw model outputs (probability scores, reliability \
percentages, mu/sigma parameters). Translate into plain language.
- Never instruct the voice agent to be aggressive, threatening, \
or to imply legal action is imminent unless the trigger \
explicitly requests pre-legal framing.
- The briefing is prose. Paragraphs and short sentences. No \
markdown, no bullet points, no headers, no formatting marks.
- 200-400 words depending on context richness. Don't pad.
- The voice agent will read this once before the call. Make \
every sentence count.

INFLUENCE STRUCTURE:
Every briefing follows the PCP flow:
1. PERCEPTION — how to open the call (shape the debtor's \
perception of the interaction)
2. CONTEXT — the facts and influence levers to deploy \
during the conversation
3. PERMISSION — the specific ask that defines success, \
and how to secure a commitment

The influence data in the context tells you which barrier \
the debtor has (trigger, ability, or motivation), which \
strategy to use, and which techniques to deploy. Weave these \
into the briefing naturally — don't label them as techniques.

PERSONA:
The context includes a persona framing mode. If IN_HOUSE, \
the voice agent is {agentName} from {tenantCompany}. If \
AGENCY, the voice agent is {agentName} calling on behalf of \
{tenantCompany}. Write the briefing accordingly.

SOLE TRADERS:
If the entity type is sole_trader, the debtor is a natural \
person, not a company. Tone never exceeds Professional. \
Frame everything collaboratively. No consequence language.

---

Here are three example briefings that define the house style. \
Match the tone, density, and structure of these examples.

EXAMPLE 1 — Trigger barrier, first contact, in-house:

You're calling Sarah Mitchell at Cre8tive Input Ltd. She's a \
long-standing client — been with us about two years, generally \
reliable, pays around day 35 on 30-day terms. Nothing unusual \
in the relationship.

The call is about invoice INV-5208354 for £2,500, issued on \
12 March, now 36 days old. No previous contact on this one — \
it may simply have been missed. Her email is a generic \
accounts@ address, so the earlier email might not have reached \
the right person.

Goal: confirm she has the invoice and get a payment date.

Open warmly — you're checking in, not chasing. Something like: \
"Hi Sarah, it's Charlie from Datum Creative. I'm just calling \
to check in on an invoice that might have slipped through — \
INV-5208354 for two thousand five hundred pounds, due on the \
twelfth of March."

If she says she hasn't seen it, offer to resend by email \
right after the call. Ask for her direct email if the \
accounts@ address isn't reaching her.

If she confirms she has it, ask when it's likely to be \
processed. Get a specific date: "When does your next payment \
run happen?" If she gives a date, confirm it back.

Don't push hard on this one. It's almost certainly just an \
oversight. Keep it light, keep it warm, leave a good \
impression.

EXAMPLE 2 — Ability barrier, broken promise, agency mode:

You're calling David Park at Swatch Interiors, on behalf of \
Datum Creative Media. David's under pressure — he made a \
partial payment of £500 on the 28th of March against a total \
of £2,500, which tells you he wants to pay but he's stretched. \
He promised the rest by the 10th of April but that date came \
and went. His Companies House filing is a month late, which \
isn't a great sign.

This is your third contact. Two emails went out — one on the \
1st of April (Friendly), one on the 8th (Professional). He \
opened both but didn't reply.

Goal: agree a structured payment plan for the remaining £2,000.

Open with empathy — he's trying, he's just overwhelmed. "Hi \
David, it's Charlie calling on behalf of Datum Creative. I \
appreciate things are tight right now — I noticed you made a \
payment last month and I wanted to see if we can work out the \
rest in a way that's manageable."

Don't mention the broken promise immediately. Let him explain. \
If he brings it up, acknowledge it without judgement: "These \
things happen — the important thing is finding a way forward."

Suggest three payments of £667 over the next three months. If \
he counters with a longer plan, you can go to four months but \
not beyond that. Get the first payment date locked in — \
ideally within the next seven days.

If he says he genuinely cannot pay anything right now, ask \
what his situation looks like over the next month. Don't push \
someone who's drowning.

EXAMPLE 3 — Motivation barrier, escalation, in-house:

You're calling James Whitfield at Northern Logistics Ltd. \
James is ducking you. Three emails sent over five weeks — \
Professional, then Firm, then Firm again. All delivered, the \
first two opened, no reply to any. No dispute raised. Their \
Companies House record is clean and they've paid other invoices \
in the same period, so this isn't a cashflow issue — they're \
just deprioritising this one.

Total outstanding is £8,750 across two invoices: INV-5208412 \
for £5,250 (52 days overdue) and INV-5208430 for £3,500 (38 \
days overdue). Both on 30-day terms.

Goal: get a payment date for the full amount, or a clear \
reason why not.

Open directly — no small talk. "Hi James, it's Charlie from \
Datum Creative. I'm calling because I've sent three emails \
about your outstanding balance and haven't been able to get a \
response. I wanted to speak to you directly."

If he gives a vague answer ("I'll look into it"), pin it \
down: "I appreciate that. What's the most realistic date I \
can note for payment?" If he says he needs to check with \
someone, ask who and when you'll hear back.

If he claims he never received the emails, don't argue — \
just note it and resend. But get a payment commitment on \
this call.

You can mention that statutory interest is accruing under the \
Late Payment Act if he stalls. Don't threaten — just state it \
as fact: "Interest does accrue on these automatically, so \
settling sooner avoids that building up."

Keep it professional. Don't get drawn into an argument. If he \
gets hostile, de-escalate — the global prompt handles that.`;

// ── Context assembly helpers ─────────────────────────────────

async function loadContactAndTenant(tenantId: string, contactId: string) {
  const [contact, tenant] = await Promise.all([
    storage.getContact(contactId, tenantId),
    storage.getTenant(tenantId),
  ]);
  if (!contact) throw new Error(`Contact ${contactId} not found`);
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
  if (contact.tenantId !== tenantId) {
    throw new Error(`Contact ${contactId} does not belong to tenant ${tenantId}`);
  }
  return { contact, tenant };
}

async function loadPersona(tenantId: string) {
  const [persona] = await db
    .select()
    .from(agentPersonas)
    .where(and(eq(agentPersonas.tenantId, tenantId), eq(agentPersonas.isActive, true)))
    .limit(1);
  return persona ?? null;
}

async function loadInvoiceState(
  tenantId: string,
  contactId: string,
  invoiceIds: string[],
) {
  const rows =
    invoiceIds.length > 0
      ? await db
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              eq(invoices.contactId, contactId),
              inArray(invoices.id, invoiceIds),
            ),
          )
      : await db
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              eq(invoices.contactId, contactId),
              sql`${invoices.dueDate} < NOW()`,
              sql`${invoices.status} NOT IN ('paid', 'voided', 'deleted', 'draft')`,
            ),
          );

  const now = Date.now();
  const mapped = rows.map((inv) => {
    const amount = Number(inv.amount) || 0;
    const amountPaid = Number(inv.amountPaid) || 0;
    const amountDue = amount - amountPaid;
    const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date();
    const daysOverdue = Math.max(0, Math.floor((now - dueDate.getTime()) / 86_400_000));
    return {
      invoiceNumber: inv.invoiceNumber || inv.reference || "N/A",
      amount,
      amountDue,
      dueDate: dueDate.toISOString().slice(0, 10),
      daysOverdue,
      partialPayments: amountPaid,
      status: inv.status || "unknown",
    };
  });

  return {
    invoices: mapped,
    totalOutstanding: mapped.reduce((s, i) => s + i.amountDue, 0),
    totalOverdue: mapped
      .filter((i) => i.daysOverdue > 0)
      .reduce((s, i) => s + i.amountDue, 0),
  };
}

async function loadPromiseHistory(tenantId: string, contactId: string) {
  const rows = await db
    .select()
    .from(paymentPromises)
    .where(
      and(
        eq(paymentPromises.tenantId, tenantId),
        eq(paymentPromises.contactId, contactId),
      ),
    )
    .orderBy(desc(paymentPromises.promisedDate));

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);

  const activePromises = rows
    .filter((p) => p.status === "open" || p.status === "pending")
    .map((p) => ({
      promiseDate: p.promisedDate?.toISOString().slice(0, 10) ?? "unknown",
      amount: Number(p.promisedAmount) || 0,
      status: p.promisedDate && p.promisedDate < new Date() ? "overdue" : "pending",
    }));

  const recentHistory = rows
    .filter(
      (p) =>
        p.promisedDate &&
        p.promisedDate >= ninetyDaysAgo &&
        (p.status === "kept" || p.status === "broken" || p.status === "partially_kept" || p.status === "rescheduled"),
    )
    .map((p) => ({
      promiseDate: p.promisedDate!.toISOString().slice(0, 10),
      amount: Number(p.promisedAmount) || 0,
      outcome: p.status === "partially_kept" ? "modified" : (p.status as string),
      daysLate: p.daysLate ?? null,
    }));

  return { activePromises, recentHistory };
}

async function loadDisputeState(tenantId: string, contactId: string) {
  const rows = await db
    .select()
    .from(disputes)
    .where(
      and(eq(disputes.tenantId, tenantId), eq(disputes.contactId, contactId)),
    )
    .orderBy(desc(disputes.createdAt));

  const openDisputes = rows
    .filter((d) => d.status === "pending" || d.status === "open" || d.status === "under_review")
    .map((d) => ({
      description: d.summary,
      raisedDate: d.createdAt?.toISOString().slice(0, 10) ?? "unknown",
      invoiceRef: d.invoiceId,
    }));

  const sixMonthsAgo = new Date(Date.now() - 180 * 86_400_000);
  const recentlyResolved = rows
    .filter(
      (d) =>
        (d.status === "resolved" || d.status === "closed") &&
        d.respondedAt &&
        d.respondedAt >= sixMonthsAgo,
    )
    .map((d) => ({
      description: d.summary,
      resolvedDate: d.respondedAt!.toISOString().slice(0, 10),
      outcome: d.resolutionType || "resolved",
    }));

  return { openDisputes, recentlyResolved };
}

async function loadRileyIntelligence(tenantId: string, contactId: string) {
  const rows = await db
    .select()
    .from(aiFacts)
    .where(
      and(
        eq(aiFacts.tenantId, tenantId),
        eq(aiFacts.isActive, true),
        or(
          and(eq(aiFacts.entityType, "debtor"), eq(aiFacts.entityId, contactId)),
          isNull(aiFacts.entityId),
        ),
      ),
    );

  return rows
    .filter((f) => f.factKey && f.factValue)
    .map((f) => ({
      category: f.category || "unknown",
      key: f.factKey!,
      value: f.factValue!,
      confidence: Number(f.confidence) || 0.5,
    }));
}

async function loadPaymentBehaviour(tenantId: string, contactId: string) {
  const [profile] = await db
    .select()
    .from(customerLearningProfiles)
    .where(
      and(
        eq(customerLearningProfiles.tenantId, tenantId),
        eq(customerLearningProfiles.contactId, contactId),
      ),
    )
    .limit(1);

  if (!profile) {
    return {
      medianDaysToPay: null,
      paymentTrend: "No payment history on record.",
      reliabilityDescription: "New debtor — no reliability data yet.",
      lastPaymentDate: null,
      lastPaymentAmount: null,
    };
  }

  const median = profile.medianDaysToPay ? Number(profile.medianDaysToPay) : null;
  const p75 = profile.p75DaysToPay ? Number(profile.p75DaysToPay) : null;
  const volatility = profile.volatility ? Number(profile.volatility) : null;
  const trend = profile.trend ? Number(profile.trend) : null;

  // Use the distribution describer for plain language
  let paymentTrendDesc = "No payment history on record.";
  if (median) {
    try {
      const params = fitDistribution(median, p75, volatility, trend);
      paymentTrendDesc = `Typically ${describeDistribution(params)}.`;
    } catch {
      paymentTrendDesc = `Typically pays around day ${Math.round(median)}.`;
    }
    if (trend != null) {
      if (trend > 0.5) paymentTrendDesc += " Payment times have been drifting later recently.";
      else if (trend < -0.5) paymentTrendDesc += " Payment times have been improving recently.";
    }
  }

  // PRS-based reliability description
  const prs = profile.promiseReliabilityScore ? Number(profile.promiseReliabilityScore) : null;
  let reliabilityDescription = "No reliability data yet.";
  if (prs != null) {
    if (prs >= 90) reliabilityDescription = "Very reliable — keeps commitments consistently.";
    else if (prs >= 70) reliabilityDescription = "Generally reliable, with occasional slips.";
    else if (prs >= 50) reliabilityDescription = "Mixed track record — keeps about half of commitments.";
    else reliabilityDescription = "Poor reliability — frequently breaks payment promises.";
  }

  return {
    medianDaysToPay: median,
    paymentTrend: paymentTrendDesc,
    reliabilityDescription,
    lastPaymentDate: profile.lastPaymentDate
      ? new Date(profile.lastPaymentDate).toISOString().slice(0, 10)
      : null,
    lastPaymentAmount: null as number | null,
  };
}

function resolvePhoneNumber(contact: any): string {
  const phone = contact.arContactPhone || contact.phone;
  if (!phone) {
    throw new Error(
      `Cannot make voice call: no phone number for contact ${contact.id} (${contact.name})`,
    );
  }
  return phone;
}

// ── Stage 1: Context assembly ────────────────────────────────

async function assembleContext(trigger: VoiceCallTrigger): Promise<BriefingContext> {
  const { tenantId, contactId, invoiceIds } = trigger;

  // Contact + Tenant (required — fail fast if missing)
  const { contact, tenant } = await loadContactAndTenant(tenantId, contactId);

  // Phone number (required — fail fast if missing)
  const resolvedPhoneNumber = resolvePhoneNumber(contact);

  // Agent persona
  const persona = await loadPersona(tenantId);

  // Parallel context assembly — each section independent, safe defaults on error
  const [
    invoiceState,
    conversationBrief,
    promiseHistory,
    disputeState,
    rileyIntel,
    paymentBehaviour,
    hasAgencyComm,
    socialProof,
  ] = await Promise.all([
    loadInvoiceState(tenantId, contactId, invoiceIds).catch(() => ({
      invoices: [],
      totalOutstanding: 0,
      totalOverdue: 0,
    })),
    buildConversationBrief(tenantId, contactId).catch(() => null),
    loadPromiseHistory(tenantId, contactId).catch(() => ({
      activePromises: [],
      recentHistory: [],
    })),
    loadDisputeState(tenantId, contactId).catch(() => ({
      openDisputes: [],
      recentlyResolved: [],
    })),
    loadRileyIntelligence(tenantId, contactId).catch(() => []),
    loadPaymentBehaviour(tenantId, contactId).catch(() => ({
      medianDaysToPay: null,
      paymentTrend: "No payment history on record.",
      reliabilityDescription: "New debtor — no reliability data yet.",
      lastPaymentDate: null,
      lastPaymentAmount: null,
    })),
    hasContactReceivedAgencyCommunication(tenantId, contactId).catch(() => false),
    getSocialProofData(null, null, null).catch(() => ({ available: false as const })),
  ]);

  // Influence Engine — barrier diagnosis + strategy selection
  const briefData = conversationBrief?.data ?? null;
  const barrierContext = buildBarrierContext(
    briefData,
    contact.email || "",
    {
      creditRiskScore: contact.riskScore ?? null,
      insolvencyRisk: false,
      vulnerabilityDetected: contact.vulnerabilityDetected ?? false,
      vulnerabilityPausedChasing: contact.vulnerabilityPausedChasing ?? false,
    },
  );
  const diagnosis = diagnoseBarrier(barrierContext);
  const commCount = barrierContext.communicationCount;
  const escalationStage = deriveEscalationStage(commCount);
  const strategy = selectStrategy(diagnosis.barrier, escalationStage);

  // Voice-specific influence brief
  const primaryInvoice = invoiceState.invoices[0];
  const voiceInfluenceBrief = generateVoiceCallBrief(
    diagnosis.barrier,
    strategy.name,
    trigger.voiceToneOverride || strategy.toneAlignment,
    {
      contactFirstName: contact.name?.split(" ")[0] || contact.name || "there",
      companyName: contact.companyName || "your company",
      invoiceRef: primaryInvoice?.invoiceNumber || "your account",
      amount: invoiceState.totalOverdue || invoiceState.totalOutstanding,
      daysOverdue: primaryInvoice?.daysOverdue || 0,
      currency: tenant.currency || "GBP",
    },
    {
      agentName: persona?.personaName || "Charlie",
      tenantCompanyName: (tenant as any).name || "our client",
    },
  );

  // Persona framing
  const framing = resolvePersonaFraming(
    (tenant as any).collectionIdentityMode ?? "escalation",
    (tenant as any).name || "",
    (contact as any).collectionIdentityOverride ?? null,
    {
      personaName: persona?.personaName || "Charlie",
      jobTitle: persona?.jobTitle || "Credit Controller",
      emailSignatureName: persona?.emailSignatureName || persona?.personaName || "Charlie",
      emailSignatureTitle: persona?.emailSignatureTitle || persona?.jobTitle || "Credit Controller",
      emailSignatureCompany: persona?.emailSignatureCompany || (tenant as any).name || "",
    },
    hasAgencyComm,
  );

  // Derive entity type from Riley intelligence or default
  const entityTypeFact = rileyIntel.find(
    (f) => f.key === "entity_type" || f.key === "company_type",
  );
  const entityType = entityTypeFact?.value || "company";

  // Tone state from conversation brief
  const toneState = {
    currentToneLevel:
      trigger.voiceToneOverride ||
      briefData?.conversationState?.currentTone ||
      strategy.toneAlignment,
    manualToneOverride: trigger.voiceToneOverride || null,
  };

  // Tenant voice config
  const dailyLimits = (tenant as any).dailyLimits as
    | { email: number; sms: number; voice: number }
    | null;

  // Assemble the full context object
  const assembledContext = {
    debtorIdentity: {
      contactName: contact.name,
      contactFirstName: contact.name?.split(" ")[0] || contact.name,
      companyName: contact.companyName,
      jobTitle: (contact as any).role !== "customer" ? (contact as any).role : null,
      entityType,
      isPotentiallyVulnerable: contact.isPotentiallyVulnerable ?? false,
    },
    invoiceState,
    communicationTrajectory: {
      recentCommunications: (briefData?.recentHistory || []).slice(0, 10),
      totalEmailsSent: briefData?.channelHistory?.emailsSent ?? 0,
      totalSMSSent: briefData?.channelHistory?.smsSent ?? 0,
      totalCallsMade: briefData?.channelHistory?.callsMade ?? 0,
      lastContactDate: briefData?.channelHistory?.lastEmailDate ?? null,
      daysSinceLastContact: null as number | null,
    },
    promiseHistory: {
      ...promiseHistory,
      promiseReliabilityScore:
        briefData?.activeCommitments?.promiseReliabilityScore ?? null,
    },
    disputeState,
    toneState,
    rileyIntelligence: rileyIntel,
    paymentBehaviour,
    influenceEngine: {
      barrier: diagnosis.barrier,
      barrierConfidence: diagnosis.confidence,
      barrierSignals: diagnosis.signals,
      barrierReasoning: diagnosis.reasoning,
      strategyName: strategy.name,
      pcpGuidance: strategy.pcpGuidance,
      techniques: strategy.techniques,
      avoid: strategy.avoid,
      voiceInfluenceBrief,
    },
    personaFraming: {
      mode: framing.mode,
      isTransition: framing.isTransition,
      voiceIntro: framing.voiceIntro,
      disclosurePolicy: (tenant as any).collectionIdentityDisclosure || "on_direct_question",
    },
    cieSegmentData: (socialProof as any).available ? socialProof : undefined,
    tenantVoiceConfig: {
      agentName: persona?.personaName || "Charlie",
      agentTitle: persona?.jobTitle || "Credit Controller",
      tenantCompanyName: (tenant as any).name || "",
      voiceToneDefault: persona?.toneDefault || null,
      voiceDailyLimit: dailyLimits?.voice ?? 20,
    },
  };

  // Calculate days since last contact
  const lastDate =
    briefData?.channelHistory?.lastEmailDate ||
    briefData?.channelHistory?.lastSmsDate ||
    briefData?.channelHistory?.lastCallDate;
  if (lastDate) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastDate).getTime()) / 86_400_000,
    );
    assembledContext.communicationTrajectory.daysSinceLastContact = daysSince;
  }

  // Context hash for staleness detection
  const contextHash = createHash("sha256")
    .update(JSON.stringify(assembledContext))
    .digest("hex")
    .slice(0, 16);

  return {
    contact,
    tenant,
    persona,
    resolvedPhoneNumber,
    entityType,
    invoiceState,
    briefData,
    promiseHistory,
    disputeState,
    rileyIntel,
    paymentBehaviour,
    toneState,
    diagnosis,
    strategy,
    framing,
    voiceInfluenceBrief,
    assembledContext,
    contextHash,
  };
}

// ── Stage 2: Pre-generation checks ──────────────────────────

const ESCALATED_TONES = new Set(["Firm", "firm", "Formal", "formal", "Legal", "legal"]);

async function preGenerationChecks(
  trigger: VoiceCallTrigger,
  ctx: BriefingContext,
): Promise<void> {
  // 1. Vulnerability pause — chasing must stop if vulnerability detected
  if (ctx.contact.vulnerabilityPausedChasing === true) {
    throw new VoiceCallBlockedError(
      "Vulnerability detected — chasing paused for this contact",
      "VULNERABILITY_PAUSED",
    );
  }

  // 2. Daily voice limit — count today's voice actions for this tenant
  const tz = (ctx.tenant as any).executionTimezone || "Europe/London";
  const todayMidnight = getTodayMidnightInTimezone(tz);
  const dailyLimits = (ctx.tenant as any).dailyLimits as
    | { email?: number; sms?: number; voice?: number }
    | null;
  const voiceLimit = dailyLimits?.voice ?? 20;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(actions)
    .where(
      and(
        eq(actions.tenantId, trigger.tenantId),
        eq(actions.type, "voice"),
        gte(actions.createdAt, todayMidnight),
        inArray(actions.status, ["completed", "sent", "executing"]),
      ),
    );
  const todayCount = countResult?.count ?? 0;

  if (todayCount >= voiceLimit) {
    throw new VoiceCallBlockedError(
      `Daily voice limit reached (${todayCount}/${voiceLimit})`,
      "DAILY_LIMIT",
    );
  }

  // 3. Entity-type tone floor — sole traders capped at Professional
  if (ctx.entityType === "sole_trader" && ESCALATED_TONES.has(ctx.toneState.currentToneLevel)) {
    console.warn(
      `[VoiceBriefing] Sole trader tone cap: downgrading ${ctx.toneState.currentToneLevel} → Professional for contact ${trigger.contactId}`,
    );
    ctx.toneState.currentToneLevel = "Professional";
  }
}

function getTodayMidnightInTimezone(tz: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return new Date(`${year}-${month}-${day}T00:00:00`);
}

// ── Stage 3: Generate briefing ──────────────────────────────

async function generateBriefingText(
  trigger: VoiceCallTrigger,
  ctx: BriefingContext,
): Promise<{ text: string; latencyMs: number }> {
  const startMs = Date.now();
  const text = await generateText({
    system: BRIEFING_SYSTEM_PROMPT,
    prompt: JSON.stringify({ trigger, context: ctx.assembledContext }),
    model: "standard",
    maxTokens: 1000,
    temperature: 0.4,
    logContext: {
      tenantId: trigger.tenantId,
      caller: "retellPromptBuilder",
      relatedEntityType: "contact",
      relatedEntityId: trigger.contactId,
    },
  });
  return { text: text.trim(), latencyMs: Date.now() - startMs };
}

// ── Stage 4: Post-generation checks ─────────────────────────

const THREATENING_PATTERN = /threaten|legal action is imminent|we will sue|court proceedings will begin/i;
const RAW_MODEL_PATTERN = /\bp\s*\(\s*pay\s*\)|sigma|mu\s*=|confidence\s*[:=]\s*\d/i;
const MARKDOWN_PATTERN = /^#{1,3}\s|^\s*[-*]\s|\*\*|__|```/m;

function postGenerationChecks(rawBriefing: string, ctx: BriefingContext): string {
  const personaName = ctx.persona?.personaName || "Charlie";
  const tenantCompanyName = (ctx.tenant as any).name || "";

  // 1. Identity integrity — warn if persona name missing or company used as agent name
  if (!rawBriefing.includes(personaName)) {
    console.warn(
      `[VoiceBriefing] Identity check: persona name "${personaName}" not found in briefing for contact ${ctx.contact.id}`,
    );
  }

  if (
    tenantCompanyName &&
    rawBriefing.includes(`I'm ${tenantCompanyName}`) ||
    tenantCompanyName && rawBriefing.includes(`it's ${tenantCompanyName}.`)
  ) {
    console.warn(
      `[VoiceBriefing] Identity check: company name "${tenantCompanyName}" used as agent name in briefing for contact ${ctx.contact.id}`,
    );
  }

  // 2. Content safety — scan for prohibited patterns (warn only, don't block)
  if (THREATENING_PATTERN.test(rawBriefing)) {
    console.warn(
      `[VoiceBriefing] Content safety: threatening language detected in briefing for contact ${ctx.contact.id}`,
    );
  }
  if (RAW_MODEL_PATTERN.test(rawBriefing)) {
    console.warn(
      `[VoiceBriefing] Content safety: raw model output detected in briefing for contact ${ctx.contact.id}`,
    );
  }
  if (MARKDOWN_PATTERN.test(rawBriefing)) {
    console.warn(
      `[VoiceBriefing] Content safety: markdown formatting detected in briefing for contact ${ctx.contact.id}`,
    );
  }

  return rawBriefing;
}

// ── Stage 5: Test mode application ──────────────────────────

function applyTestMode(
  briefing: string,
  ctx: BriefingContext,
): { briefing: string; phone: string; isTestMode: boolean } {
  const mode = (ctx.tenant as any).communicationMode as string | undefined;

  if (mode === "off") {
    throw new VoiceCallBlockedError("Communication mode is OFF", "MODE_OFF");
  }

  if (mode === "testing" || mode === "soft_live") {
    const testPhones = (ctx.tenant as any).testPhones as string[] | null;
    if (!testPhones?.length) {
      throw new VoiceCallBlockedError(
        "No test phone configured for testing mode",
        "NO_TEST_PHONE",
      );
    }

    const originalPhone = ctx.resolvedPhoneNumber;
    const contactName = ctx.contact.name || "Unknown";
    const prefix = mode === "testing" ? "TEST" : "SOFT LIVE";

    console.log(
      `🧪 [VoiceBriefing] ${prefix} redirect: briefing phone ${originalPhone} → ${testPhones[0]}`,
    );

    return {
      briefing: `[${prefix} MODE — original recipient: ${contactName} at ${originalPhone}] ${briefing}`,
      phone: testPhones[0],
      isTestMode: true,
    };
  }

  // Live mode — no modifications
  return {
    briefing,
    phone: ctx.resolvedPhoneNumber,
    isTestMode: false,
  };
}

// ── Main builder (orchestrator) ─────────────────────────────

export async function buildBriefing(
  trigger: VoiceCallTrigger,
): Promise<VoiceBriefing> {
  // Stage 1: Assemble context
  const ctx = await assembleContext(trigger);

  // Stage 2: Pre-generation checks (throws VoiceCallBlockedError)
  await preGenerationChecks(trigger, ctx);

  // Stage 3: Generate briefing via Claude
  const { text: rawBriefing, latencyMs } = await generateBriefingText(trigger, ctx);

  // Stage 4: Post-generation checks (warn only)
  const validatedBriefing = postGenerationChecks(rawBriefing, ctx);

  // Stage 5: Apply test mode (throws VoiceCallBlockedError if OFF)
  const { briefing, phone, isTestMode } = applyTestMode(validatedBriefing, ctx);

  return {
    briefing,
    resolvedPhoneNumber: phone,
    isTestMode,
    metadata: {
      influenceBarrier: ctx.diagnosis.barrier,
      influenceStrategy: ctx.strategy.name,
      toneLevel: trigger.voiceToneOverride || ctx.strategy.toneAlignment,
      personaFraming: ctx.framing.mode,
      contextHash: ctx.contextHash,
      claudeLatencyMs: latencyMs,
      claudeTokensUsed: 0, // generateText() doesn't expose token count
      generatedAt: new Date().toISOString(),
    },
  };
}
