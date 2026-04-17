/**
 * Barrier Diagnostic — Fogg Behavior Model classification.
 *
 * Classifies each debtor's primary non-payment barrier as one of:
 * - trigger: they haven't noticed or registered the invoice
 * - ability: they want to pay but can't (cashflow, disputes, complexity)
 * - motivation: they know about it, can pay, but choose not to
 *
 * Deterministic — no LLM, no randomness. Every field has a safe default.
 */

import type { ConversationBriefData } from "../conversationBriefService";

// ── Types ────────────────────────────────────────────────────

export type InfluenceBarrier = "trigger" | "ability" | "motivation";

export interface BarrierDiagnosis {
  barrier: InfluenceBarrier;
  confidence: "low" | "medium" | "high";
  signals: string[];
  reasoning: string;
}

export interface BarrierContext {
  communicationCount: number;
  hasResponded: boolean;
  hasPartialPayment: boolean;
  hasBrokenPromise: boolean;
  hasPaymentPlan: boolean;
  hasDispute: boolean;
  isGenericEmail: boolean;
  creditRiskScore: number | null;
  insolvencyRisk: boolean;
  mentionsCashflow: boolean;
  companyAppearsHealthy: boolean;
  /** Vulnerability detection (Phase 6) */
  vulnerabilityDetected?: boolean;
  vulnerabilityPausedChasing?: boolean;
}

// ── Generic email patterns (matches data health service) ─────

const GENERIC_EMAIL_PATTERNS = [
  /^info@/i, /^accounts@/i, /^admin@/i, /^office@/i,
  /^finance@/i, /^hello@/i, /^enquiries@/i, /^contact@/i,
  /^billing@/i, /^sales@/i, /^support@/i, /^reception@/i,
];

// ── Context builder ──────────────────────────────────────────

/**
 * Build a BarrierContext from the conversation brief data, contact email,
 * and an optional debtorIntelligence row. Every field defaults safely
 * so missing data never crashes the diagnostic.
 */
export function buildBarrierContext(
  briefData: ConversationBriefData | null | undefined,
  contactEmail: string,
  intel: {
    creditRiskScore: number | null;
    insolvencyRisk: boolean | null;
    vulnerabilityDetected?: boolean;
    vulnerabilityPausedChasing?: boolean;
  } | null | undefined,
): BarrierContext {
  const ch = briefData?.channelHistory;
  const communicationCount =
    (ch?.emailsSent ?? 0) + (ch?.smsSent ?? 0) + (ch?.callsMade ?? 0);

  const hasResponded =
    briefData?.recentHistory?.some((e) => e.direction === "inbound") ?? false;

  const hasPartialPayment =
    (briefData?.unallocatedPayments?.length ?? 0) > 0;

  const prs = briefData?.activeCommitments?.promiseReliabilityScore;
  const hasBrokenPromise = prs != null && prs < 80;

  const hasPaymentPlan =
    briefData?.activeCommitments?.hasPaymentPlan ?? false;

  const hasDispute = (briefData?.openDisputes?.length ?? 0) > 0;

  const isGenericEmail = GENERIC_EMAIL_PATTERNS.some((p) => p.test(contactEmail));

  const creditRiskScore = intel?.creditRiskScore ?? null;
  const insolvencyRisk = intel?.insolvencyRisk ?? false;

  // Check debtorIntel strings for cashflow-related mentions
  const cashflowPattern = /cashflow|payment plan|struggling|instalment|cash\s*flow|can'?t pay|unable to pay/i;
  const mentionsCashflow =
    briefData?.debtorIntel?.some((s) => cashflowPattern.test(s)) ?? false;

  const companyAppearsHealthy =
    creditRiskScore != null && creditRiskScore < 40 && !insolvencyRisk;

  return {
    communicationCount,
    hasResponded,
    hasPartialPayment,
    hasBrokenPromise,
    hasPaymentPlan,
    hasDispute,
    isGenericEmail,
    creditRiskScore,
    insolvencyRisk,
    mentionsCashflow,
    companyAppearsHealthy,
    vulnerabilityDetected: intel?.vulnerabilityDetected ?? false,
    vulnerabilityPausedChasing: intel?.vulnerabilityPausedChasing ?? false,
  };
}

// ── Diagnostic logic ─────────────────────────────────────────

export function diagnoseBarrier(context: BarrierContext): BarrierDiagnosis {
  // Vulnerability override — influence engine disengaged
  if (context.vulnerabilityDetected && context.vulnerabilityPausedChasing) {
    return {
      barrier: "ability" as InfluenceBarrier,
      confidence: "high" as const,
      signals: ["Vulnerability detected — influence engine disengaged"],
      reasoning: "Debtor flagged as vulnerable. Supportive mode active.",
    };
  }

  const signals: string[] = [];

  // Collect all signals regardless of which barrier wins

  // Trigger signals
  if (context.communicationCount <= 2) {
    signals.push("early-stage: 2 or fewer communications sent");
  }
  if (!context.hasResponded) {
    signals.push("no inbound response on record");
  }
  if (context.isGenericEmail) {
    signals.push("email is a generic mailbox (may not reach decision-maker)");
  }

  // Ability signals
  if (context.hasPartialPayment) {
    signals.push("unallocated/partial payment detected");
  }
  if (context.hasBrokenPromise) {
    signals.push("previous payment promise breached");
  }
  if (context.mentionsCashflow) {
    signals.push("cashflow difficulty mentioned in communications");
  }
  if (context.hasPaymentPlan) {
    signals.push("active payment plan in place");
  }
  if (context.insolvencyRisk) {
    signals.push("insolvency risk flagged (Companies House)");
  }
  if (context.creditRiskScore != null && context.creditRiskScore >= 60) {
    signals.push(`elevated credit risk score (${context.creditRiskScore}/100)`);
  }
  if (context.hasDispute) {
    signals.push("open dispute on record");
  }

  // Motivation signals
  if (context.communicationCount >= 3 && !context.hasResponded) {
    signals.push("3+ communications with no response");
  }
  if (context.companyAppearsHealthy && !context.hasResponded && context.communicationCount >= 3) {
    signals.push("company appears financially healthy but unresponsive");
  }

  // ── Decision logic (deterministic, ordered) ──────────────

  // 1. Early-stage with no response → trigger
  if (context.communicationCount <= 2 && !context.hasResponded) {
    return {
      barrier: "trigger",
      confidence: context.communicationCount === 0 ? "high" : "medium",
      signals,
      reasoning:
        "Few or no communications sent and no response yet. The debtor may not have noticed the invoice.",
    };
  }

  // 2. Ability signals present → ability
  const abilitySignals = [
    context.hasPartialPayment,
    context.hasBrokenPromise,
    context.mentionsCashflow,
    context.hasPaymentPlan,
    context.insolvencyRisk,
    context.hasDispute,
    context.creditRiskScore != null && context.creditRiskScore >= 60,
  ].filter(Boolean).length;

  if (abilitySignals > 0) {
    return {
      barrier: "ability",
      confidence: abilitySignals >= 3 ? "high" : abilitySignals >= 2 ? "medium" : "medium",
      signals,
      reasoning:
        abilitySignals >= 2
          ? "Multiple signals suggest the debtor wants to pay but faces financial or procedural barriers."
          : "At least one signal suggests the debtor may be struggling to pay rather than ignoring the debt.",
    };
  }

  // 3. Repeated contact with no response and no dispute → motivation
  if (context.communicationCount >= 3 && !context.hasResponded && !context.hasDispute) {
    return {
      barrier: "motivation",
      confidence: context.communicationCount >= 5 ? "high" : "medium",
      signals,
      reasoning:
        "Multiple communications sent with no response and no dispute raised. The debtor is likely aware but not prioritising payment.",
    };
  }

  // 4. Fallback → trigger (safe default, assumes good intent)
  return {
    barrier: "trigger",
    confidence: "low",
    signals,
    reasoning:
      "Insufficient data to classify barrier with confidence. Defaulting to trigger (assumes the debtor may not have registered the invoice).",
  };
}
