/**
 * Tone Escalation Engine — Sprint 4.2 + Gap 5
 *
 * Determines the correct tone level for a debtor based on multiple signals:
 * - Days overdue
 * - Last intent signal (and recency)
 * - Touch count (outbound contacts)
 * - Promise reliability (from customerBehaviorSignals / PRS)
 * - Whether debtor was previously a good payer
 * - Tenant style (GENTLE / STANDARD / FIRM)
 * - Vulnerable debtor ceiling
 * - Tone history + velocity cap (Gap 5)
 * - No-response escalation pressure (Gap 5)
 * - Significant payment override (Gap 5)
 *
 * The 5 tone levels (in escalation order):
 *   Friendly → Professional → Firm → Formal → Legal
 */

import { db } from "../db";
import {
  contacts,
  customerBehaviorSignals,
  tenants,
  actions,
  inboundMessages,
  emailMessages,
  invoices,
} from "@shared/schema";
import { eq, and, desc, gte, isNotNull, sql } from "drizzle-orm";
import { getPromiseReliabilityService } from "./promiseReliabilityService";

// ── Types ───────────────────────────────────────────────────────────────────

export type ToneLevel = "friendly" | "professional" | "firm" | "formal" | "legal";

export type TenantStyleSetting = "GENTLE" | "STANDARD" | "FIRM";

export interface ToneEscalationInput {
  tenantId: string;
  contactId: string;
  /** Days the oldest unpaid invoice is overdue (negative = pre-due) */
  daysOverdue: number;
  /** Number of outbound contacts already sent for this debtor */
  touchCount: number;
}

export interface ToneEscalationResult {
  toneLevel: ToneLevel;
  reasoning: string;
  /** Whether the tone was capped (e.g. vulnerable debtor, tenant ceiling) */
  wasCapped: boolean;
  /** Original tone before any caps were applied */
  uncappedTone: ToneLevel;
  signals: {
    daysOverdue: number;
    touchCount: number;
    tenantStyle: TenantStyleSetting;
    isPotentiallyVulnerable: boolean;
    promiseReliabilityScore: number | null;
    isSerialPromiser: boolean;
    lastInboundDaysAgo: number | null;
    wasGoodPayer: boolean;
    lastToneLevel: string | null;
    consecutiveNoResponseCount: number;
    velocityCapped: boolean;
  };
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Ordered tone levels from softest to hardest */
const TONE_ORDER: ToneLevel[] = ["friendly", "professional", "firm", "formal", "legal"];

/**
 * Default escalation thresholds (days overdue) per tenant style.
 * Each entry is [maxDaysForThisTone] — once exceeded, escalate to next.
 */
const ESCALATION_THRESHOLDS: Record<TenantStyleSetting, Record<ToneLevel, number>> = {
  // GENTLE: shift all thresholds +7 days
  GENTLE: {
    friendly: 14,      // pre-due to +14 days → Friendly
    professional: 21,  // +14 to +21 → Professional
    firm: 37,          // +21 to +37 → Firm
    formal: 67,        // +37 to +67 → Formal
    legal: Infinity,   // 67+ → Legal
  },
  // STANDARD: baseline
  STANDARD: {
    friendly: 7,       // pre-due to +7 days → Friendly
    professional: 14,  // +7 to +14 → Professional
    firm: 30,          // +14 to +30 → Firm
    formal: 60,        // +30 to +60 → Formal
    legal: Infinity,   // 60+ → Legal
  },
  // FIRM: shift all thresholds -3 days
  FIRM: {
    friendly: 4,       // pre-due to +4 days → Friendly
    professional: 11,  // +4 to +11 → Professional
    firm: 27,          // +11 to +27 → Firm
    formal: 57,        // +27 to +57 → Formal
    legal: Infinity,   // 57+ → Legal
  },
};

/** Vulnerable debtors are capped at this tone */
const VULNERABLE_CEILING: ToneLevel = "professional";

/** Days since last inbound to consider "recently engaged" */
const RECENT_ENGAGEMENT_DAYS = 7;

/** PRS threshold below which debtor is considered unreliable */
const UNRELIABLE_PRS_THRESHOLD = 40;

/** PRS threshold above which debtor is considered a previously good payer */
const GOOD_PAYER_PRS_THRESHOLD = 70;

/** Gap 5: Default consecutive unanswered contacts before escalation pressure */
const DEFAULT_NO_RESPONSE_THRESHOLD = 4;

/** Gap 5: Default payment fraction that triggers tone baseline reset */
const DEFAULT_SIGNIFICANT_PAYMENT_THRESHOLD = 0.50;

// ── Helpers ─────────────────────────────────────────────────────────────────

function toneIndex(tone: ToneLevel): number {
  return TONE_ORDER.indexOf(tone);
}

function clampTone(tone: ToneLevel, ceiling: ToneLevel): ToneLevel {
  return toneIndex(tone) > toneIndex(ceiling) ? ceiling : tone;
}

function stepUp(tone: ToneLevel, steps: number = 1): ToneLevel {
  const idx = Math.min(toneIndex(tone) + steps, TONE_ORDER.length - 1);
  return TONE_ORDER[idx];
}

function stepDown(tone: ToneLevel, steps: number = 1): ToneLevel {
  const idx = Math.max(toneIndex(tone) - steps, 0);
  return TONE_ORDER[idx];
}

// ── Gap 5: History & Payment Helpers ────────────────────────────────────────

/**
 * Get the most recent completed action with a tone level for this debtor.
 * Excludes failed deliveries (Gap 8 compatibility).
 */
async function getLastSentAction(tenantId: string, contactId: string) {
  const result = await db.select({
    agentToneLevel: actions.agentToneLevel,
    completedAt: actions.completedAt,
  })
  .from(actions)
  .where(and(
    eq(actions.tenantId, tenantId),
    eq(actions.contactId, contactId),
    eq(actions.status, 'completed'),
    isNotNull(actions.agentToneLevel),
    isNotNull(actions.completedAt),
    // Include NULL deliveryStatus (pre-Gap 8 actions) + exclude failed deliveries
    sql`(${actions.deliveryStatus} IS NULL OR ${actions.deliveryStatus} NOT IN ('failed', 'failed_permanent', 'bounced'))`,
  ))
  .orderBy(desc(actions.completedAt))
  .limit(1);

  return result[0] || null;
}

/**
 * Count consecutive outbound actions with no inbound email response.
 * Checks last 10 completed actions (newest first), stops at first response found.
 * V1 limitation: only tracks email responses, not phone/SMS.
 */
async function getConsecutiveNoResponseCount(tenantId: string, contactId: string): Promise<number> {
  const recentActions = await db.select({
    id: actions.id,
    completedAt: actions.completedAt,
  })
  .from(actions)
  .where(and(
    eq(actions.tenantId, tenantId),
    eq(actions.contactId, contactId),
    eq(actions.status, 'completed'),
    isNotNull(actions.completedAt),
    sql`(${actions.deliveryStatus} IS NULL OR ${actions.deliveryStatus} NOT IN ('failed', 'failed_permanent', 'bounced'))`,
  ))
  .orderBy(desc(actions.completedAt))
  .limit(10);

  let count = 0;
  for (const action of recentActions) {
    if (!action.completedAt) continue;

    const reply = await db.select({ id: emailMessages.id })
      .from(emailMessages)
      .where(and(
        eq(emailMessages.contactId, contactId),
        eq(emailMessages.direction, 'INBOUND'),
        gte(emailMessages.createdAt, action.completedAt),
      ))
      .limit(1);

    if (reply.length > 0) break;
    count++;
  }
  return count;
}

/**
 * Check if invoices paid since sinceDate represent ≥ threshold fraction
 * of the pre-payment outstanding amount.
 */
async function checkSignificantPayment(
  tenantId: string, contactId: string, sinceDate: Date, threshold: number,
): Promise<boolean> {
  // Invoices paid since last action
  const recentlyPaid = await db.select({ amountPaid: invoices.amountPaid })
    .from(invoices)
    .where(and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.contactId, contactId),
      eq(invoices.status, 'paid'),
      gte(invoices.paidDate, sinceDate),
    ));

  if (recentlyPaid.length === 0) return false;

  const paidAmount = recentlyPaid.reduce((sum, inv) => sum + parseFloat(inv.amountPaid || '0'), 0);

  // Current outstanding (unpaid invoices)
  const unpaid = await db.select({ amount: invoices.amount, amountPaid: invoices.amountPaid })
    .from(invoices)
    .where(and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.contactId, contactId),
      sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`,
    ));

  const currentOutstanding = unpaid.reduce(
    (sum, inv) => sum + (parseFloat(inv.amount || '0') - parseFloat(inv.amountPaid || '0')), 0
  );

  // Reconstruct pre-payment outstanding
  const prePaymentOutstanding = currentOutstanding + paidAmount;
  if (prePaymentOutstanding <= 0) return false;

  return (paidAmount / prePaymentOutstanding) >= threshold;
}

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Determine the correct tone level for a debtor.
 *
 * Algorithm:
 * 1. Start with baseline tone from days-overdue thresholds (per tenant style)
 * 2. Apply adjustments:
 *    - Debtor engaged recently (replied/acknowledged) → step back one level
 *    - Broken promise (serial promiser) → skip forward one level
 *    - Previously reliable payer, first time late → hold at Friendly longer
 *    - Relationship deteriorating → step forward one level
 *    - No-response escalation (Gap 5) → step forward if ≥ threshold consecutive
 * 2.5. Velocity cap (Gap 5): max ±1 step from last sent tone
 * 3. Apply hard caps:
 *    - isPotentiallyVulnerable → cap at Professional
 *    - Legal tone only if tenant has NOT set style to GENTLE
 */
export async function determineTone(input: ToneEscalationInput): Promise<ToneEscalationResult> {
  const { tenantId, contactId, daysOverdue, touchCount } = input;
  const reasons: string[] = [];

  // ── Load signals in parallel ──────────────────────────────────────────
  const [contact, tenant, signals, lastInbound, prsResult, lastAction, noResponseCount] = await Promise.all([
    db.select({
      isPotentiallyVulnerable: contacts.isPotentiallyVulnerable,
    }).from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId))).limit(1).then(r => r[0]),

    db.select({
      tenantStyle: tenants.tenantStyle,
      noResponseEscalationThreshold: tenants.noResponseEscalationThreshold,
      significantPaymentThreshold: tenants.significantPaymentThreshold,
    }).from(tenants).where(eq(tenants.id, tenantId)).limit(1).then(r => r[0]),

    db.select({
      promiseBreachCount: customerBehaviorSignals.promiseBreachCount,
      medianDaysToPay: customerBehaviorSignals.medianDaysToPay,
      trend: customerBehaviorSignals.trend,
      emailReplyRate: customerBehaviorSignals.emailReplyRate,
    }).from(customerBehaviorSignals).where(
      and(eq(customerBehaviorSignals.contactId, contactId), eq(customerBehaviorSignals.tenantId, tenantId)),
    ).limit(1).then(r => r[0] || null),

    // Last inbound message from this debtor
    db.select({ createdAt: inboundMessages.createdAt })
      .from(inboundMessages)
      .where(and(eq(inboundMessages.contactId, contactId), eq(inboundMessages.tenantId, tenantId)))
      .orderBy(desc(inboundMessages.createdAt))
      .limit(1)
      .then(r => r[0] || null),

    // Promise reliability
    getPromiseReliabilityService().getCustomerPRSSummary(tenantId, contactId).catch(() => null),

    // Gap 5: Last sent action with tone level
    getLastSentAction(tenantId, contactId),

    // Gap 5: Consecutive unanswered outbound contacts
    getConsecutiveNoResponseCount(tenantId, contactId),
  ]);

  const isPotentiallyVulnerable = contact?.isPotentiallyVulnerable ?? false;
  const tenantStyle = ((tenant?.tenantStyle || "STANDARD") as TenantStyleSetting);
  const thresholds = ESCALATION_THRESHOLDS[tenantStyle] || ESCALATION_THRESHOLDS.STANDARD;

  // Gap 5: Extract tenant settings
  const noResponseThreshold = tenant?.noResponseEscalationThreshold ?? DEFAULT_NO_RESPONSE_THRESHOLD;
  const sigPaymentThreshold = parseFloat(String(tenant?.significantPaymentThreshold ?? DEFAULT_SIGNIFICANT_PAYMENT_THRESHOLD));

  // Calculate days since last inbound
  let lastInboundDaysAgo: number | null = null;
  if (lastInbound?.createdAt) {
    lastInboundDaysAgo = Math.floor((Date.now() - new Date(lastInbound.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  }

  // PRS signals
  const prs = prsResult?.promiseReliabilityScore ?? null;
  const isSerialPromiser = prsResult?.behavioralFlags?.isSerialPromiser ?? false;
  const isReliableLatePayer = prsResult?.behavioralFlags?.isReliableLatePayer ?? false;
  const isNewCustomer = prsResult?.behavioralFlags?.isNewCustomer ?? true;
  const isRelationshipDeteriorating = prsResult?.behavioralFlags?.isRelationshipDeteriorating ?? false;
  const wasGoodPayer = prs !== null && prs >= GOOD_PAYER_PRS_THRESHOLD;

  // ── Step 1: Baseline tone from days-overdue thresholds ────────────────

  let tone: ToneLevel = "friendly";
  if (daysOverdue <= 0) {
    tone = "friendly";
    reasons.push(`Pre-due or just due (${daysOverdue}d) → Friendly`);
  } else if (daysOverdue <= thresholds.friendly) {
    tone = "friendly";
    reasons.push(`${daysOverdue}d overdue ≤ ${thresholds.friendly}d threshold → Friendly`);
  } else if (daysOverdue <= thresholds.professional) {
    tone = "professional";
    reasons.push(`${daysOverdue}d overdue ≤ ${thresholds.professional}d → Professional`);
  } else if (daysOverdue <= thresholds.firm) {
    tone = "firm";
    reasons.push(`${daysOverdue}d overdue ≤ ${thresholds.firm}d → Firm`);
  } else if (daysOverdue <= thresholds.formal) {
    tone = "formal";
    reasons.push(`${daysOverdue}d overdue ≤ ${thresholds.formal}d → Formal`);
  } else {
    tone = "legal";
    reasons.push(`${daysOverdue}d overdue > ${thresholds.formal}d → Legal`);
  }

  // ── Step 2: Adjustments ───────────────────────────────────────────────

  // 2a. Debtor engaged recently → step back one level
  if (lastInboundDaysAgo !== null && lastInboundDaysAgo <= RECENT_ENGAGEMENT_DAYS) {
    const before = tone;
    tone = stepDown(tone);
    if (before !== tone) {
      reasons.push(`Debtor engaged ${lastInboundDaysAgo}d ago → stepped back from ${before} to ${tone}`);
    } else {
      reasons.push(`Debtor engaged ${lastInboundDaysAgo}d ago (already at friendliest)`);
    }
  }

  // 2b. Broken promise / serial promiser → skip forward one level
  if (isSerialPromiser) {
    const before = tone;
    tone = stepUp(tone);
    reasons.push(`Serial promiser (PRS=${prs}) → escalated from ${before} to ${tone}`);
  }

  // 2c. Previously reliable payer, first time late → hold at Friendly
  if (wasGoodPayer && !isSerialPromiser && touchCount <= 2) {
    const before = tone;
    if (toneIndex(tone) > toneIndex("friendly")) {
      tone = "friendly";
      reasons.push(`Good payer (PRS=${prs}) with low touch count → held at friendly (was ${before})`);
    }
  }

  // 2d. New customer with no history → stay friendly for first few touches
  if (isNewCustomer && touchCount <= 1 && toneIndex(tone) > toneIndex("professional")) {
    const before = tone;
    tone = "professional";
    reasons.push(`New customer, limited history → capped at professional (was ${before})`);
  }

  // 2e. Relationship deteriorating → step forward one level
  if (isRelationshipDeteriorating && !isSerialPromiser) {
    const before = tone;
    tone = stepUp(tone);
    reasons.push(`Relationship deteriorating → escalated from ${before} to ${tone}`);
  }

  // 2f. No-response escalation pressure (Gap 5) — consecutive unanswered outbound contacts
  if (noResponseCount >= noResponseThreshold) {
    const before = tone;
    tone = stepUp(tone);
    reasons.push(`${noResponseCount} consecutive contacts with no response (threshold: ${noResponseThreshold}) → escalated from ${before} to ${tone}`);
  }

  const uncappedTone = tone;

  // ── Step 2.5: Velocity Cap (Gap 5) ──────────────────────────────────
  // Max ±1 step from last sent tone. Skipped on first contact.

  if (lastAction?.agentToneLevel) {
    let effectiveLastTone = lastAction.agentToneLevel as ToneLevel;

    // Significant payment override: reset baseline to Professional (downward bypass only)
    if (lastAction.completedAt) {
      const hasSigPayment = await checkSignificantPayment(
        tenantId, contactId, lastAction.completedAt, sigPaymentThreshold,
      );
      if (hasSigPayment) {
        effectiveLastTone = 'professional';
        reasons.push(`Significant payment (≥${sigPaymentThreshold * 100}% of outstanding) → baseline reset to professional`);
      }
    }

    const lastIdx = toneIndex(effectiveLastTone);
    const calcIdx = toneIndex(tone);

    if (calcIdx > lastIdx + 1) {
      tone = TONE_ORDER[lastIdx + 1];
      reasons.push(`Velocity cap: ${uncappedTone} exceeds ${effectiveLastTone}+1 → capped to ${tone}`);
    } else if (calcIdx < lastIdx - 1) {
      tone = TONE_ORDER[Math.max(0, lastIdx - 1)];
      reasons.push(`Velocity cap: ${uncappedTone} below ${effectiveLastTone}-1 → capped to ${tone}`);
    }
  } else {
    reasons.push("First contact — no velocity cap applied");
  }

  // ── Step 3: Hard caps ─────────────────────────────────────────────────

  let wasCapped = false;

  // 3a. Vulnerable debtor → cap at Professional
  if (isPotentiallyVulnerable) {
    const before = tone;
    tone = clampTone(tone, VULNERABLE_CEILING);
    if (before !== tone) {
      wasCapped = true;
      reasons.push(`Vulnerable debtor → capped at ${VULNERABLE_CEILING} (was ${before})`);
    }
  }

  // 3b. GENTLE tenants cannot use Legal tone
  if (tenantStyle === "GENTLE" && tone === "legal") {
    tone = "formal";
    wasCapped = true;
    reasons.push("GENTLE tenant style → capped at formal (no legal tone)");
  }

  return {
    toneLevel: tone,
    reasoning: reasons.join("; "),
    wasCapped,
    uncappedTone,
    signals: {
      daysOverdue,
      touchCount,
      tenantStyle,
      isPotentiallyVulnerable,
      promiseReliabilityScore: prs,
      isSerialPromiser,
      lastInboundDaysAgo,
      wasGoodPayer,
      lastToneLevel: lastAction?.agentToneLevel || null,
      consecutiveNoResponseCount: noResponseCount,
      velocityCapped: tone !== uncappedTone && lastAction?.agentToneLevel != null,
    },
  };
}

/**
 * Map a ToneLevel to the ActionContext toneLevel format.
 * The ActionContext currently supports 4 levels; "legal" maps to "formal"
 * with an escalation flag handled upstream.
 */
export function mapToneToActionContext(
  tone: ToneLevel,
): "friendly" | "professional" | "firm" | "formal" {
  if (tone === "legal") return "formal";
  return tone;
}
