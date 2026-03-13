/**
 * Tone Escalation Engine — Sprint 4.2
 *
 * Determines the correct tone level for a debtor based on multiple signals:
 * - Days overdue
 * - Last intent signal (and recency)
 * - Touch count (outbound contacts)
 * - Promise reliability (from customerBehaviorSignals / PRS)
 * - Whether debtor was previously a good payer
 * - Tenant style (GENTLE / STANDARD / FIRM)
 * - Vulnerable debtor ceiling
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
} from "@shared/schema";
import { eq, and, desc, gte } from "drizzle-orm";
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
 * 3. Apply hard caps:
 *    - isPotentiallyVulnerable → cap at Professional
 *    - Legal tone only if tenant has NOT set style to GENTLE
 */
export async function determineTone(input: ToneEscalationInput): Promise<ToneEscalationResult> {
  const { tenantId, contactId, daysOverdue, touchCount } = input;
  const reasons: string[] = [];

  // ── Load signals in parallel ──────────────────────────────────────────
  const [contact, tenant, signals, lastInbound, prsResult] = await Promise.all([
    db.select({
      isPotentiallyVulnerable: contacts.isPotentiallyVulnerable,
    }).from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId))).limit(1).then(r => r[0]),

    db.select({
      tenantStyle: tenants.tenantStyle,
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
  ]);

  const isPotentiallyVulnerable = contact?.isPotentiallyVulnerable ?? false;
  const tenantStyle = ((tenant?.tenantStyle || "STANDARD") as TenantStyleSetting);
  const thresholds = ESCALATION_THRESHOLDS[tenantStyle] || ESCALATION_THRESHOLDS.STANDARD;

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

  const uncappedTone = tone;

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
