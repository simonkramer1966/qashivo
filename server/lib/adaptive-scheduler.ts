/**
 * Adaptive Scheduler Engine
 * 
 * Intelligently determines when and how to contact customers based on:
 * - Customer payment behavior history
 * - Channel response rates
 * - Invoice characteristics
 * - Portfolio-level DSO targets
 * 
 * Implements hybrid rules-first scoring with learning from behavioral signals.
 */

import { addHours, isBefore, differenceInDays } from "date-fns";
import type { CustomerBehaviorSignal } from "@shared/schema";
import { eventBus } from "./event-bus";

export type Channel = "email" | "sms" | "whatsapp" | "call";

export interface AdaptiveSettings {
  targetDSO: number; // Target days sales outstanding
  urgencyFactor: number; // 0-1+, increases when above target DSO
  quietHours: [number, number]; // [start, end] in 24h format
  maxDailyTouches: number; // Max touches per day for this workflow
}

export interface CustomerContext {
  segment: string; // "small_business", "enterprise", "freelancer"
  channelPrefs: Partial<Record<Channel, boolean>>; // Channel opt-outs
  behavior?: CustomerBehaviorSignal; // Historical behavioral signals (null for new customers)
}

export interface InvoiceContext {
  amount: number;
  dueAt: Date;
  issuedAt: Date;
  lastTouchAt?: Date;
  lastChannel?: Channel;
  ageDays: number;
  dispute: boolean;
  promiseToPayAt?: Date;
}

export interface SchedulerConstraints {
  now: Date;
  minGapHours: number; // Min hours between touches
  allowedChannels: Channel[];
  timezone: string; // Tenant timezone
}

export interface TouchCandidate {
  time: Date;
  channel: Channel;
  score: number;
  reasoning: string; // Human-readable explanation
  breakdown: {
    pPay: number;
    friction: number;
    risk: number;
    urgency: number;
  };
  explainability?: {
    factor1: string;
    factor2: string;
    factor3: string;
    policyVersion: string;
  };
}

/**
 * Main scheduling function - determines optimal next touch
 * Returns null if no valid candidates (e.g., all channels blocked, max touches reached)
 */
export function scheduleNextTouch(
  settings: AdaptiveSettings,
  customer: CustomerContext,
  invoice: InvoiceContext,
  constraints: SchedulerConstraints,
  todaysTouchCount = 0 // Number of touches already sent today for this workflow
): TouchCandidate | null {
  const candidates: TouchCandidate[] = [];
  
  // Enforce maxDailyTouches limit
  if (todaysTouchCount >= settings.maxDailyTouches) {
    return null; // Hit daily limit for this workflow
  }
  
  // Time horizons to consider (hours from now)
  const horizons = [12, 24, 36, 48, 72, 96];
  
  // Filter channels by customer preferences
  const availableChannels = constraints.allowedChannels.filter(
    ch => customer.channelPrefs[ch] !== false
  );
  
  if (availableChannels.length === 0) {
    return null; // No available channels
  }
  
  // Generate and score candidates
  for (const hours of horizons) {
    for (const channel of availableChannels) {
      const time = addHours(constraints.now, hours);
      
      // Check constraints
      if (!passesQuietHours(time, settings.quietHours, constraints.timezone)) continue;
      if (!respectsGap(invoice.lastTouchAt, time, constraints.minGapHours)) continue;
      
      // Calculate score components
      const pPay = estimateProbabilityOfPayment(customer, invoice, time, channel);
      const friction = calculateFrictionCost(customer, invoice, channel);
      const risk = calculateComplianceRisk(invoice, time, channel);
      const urgency = calculateUrgencyBoost(settings, time, constraints.now);
      
      // Weighted score: α·P(pay) − β·F(friction) − γ·R(risk) + δ·U(urgency)
      const α = 1.0;  // Payment probability weight
      const β = 0.35; // Friction cost weight
      const γ = 0.6;  // Compliance risk weight
      const δ = 0.4 + settings.urgencyFactor; // Urgency weight (base + portfolio urgency)
      
      const score = α * pPay - β * friction - γ * risk + δ * urgency;
      
      const reasoning = buildReasoning(channel, hours, { pPay, friction, risk, urgency });
      const explainability = explainTopFactors(
        { pPay, friction, risk, urgency },
        { α, β, γ, δ },
        invoice,
        customer,
        channel
      );
      
      candidates.push({
        time,
        channel,
        score,
        reasoning,
        breakdown: { pPay, friction, risk, urgency },
        explainability
      });
    }
  }
  
  if (candidates.length === 0) {
    return null;
  }
  
  // Return highest-scoring candidate
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * Estimate probability of payment if contacted at time t via channel k
 * Uses customer behavior history, invoice characteristics, and timing factors
 */
function estimateProbabilityOfPayment(
  customer: CustomerContext,
  invoice: InvoiceContext,
  time: Date,
  channel: Channel
): number {
  const behavior = customer.behavior;
  
  // Base probability from payment lag history
  let base = 0.3; // Default for new customers
  
  if (behavior && behavior.medianDaysToPay) {
    const medianLag = Number(behavior.medianDaysToPay);
    const ageDays = invoice.ageDays;
    
    // Sigmoid curve: probability increases as invoice ages toward median payment time
    const relativeAge = ageDays / medianLag;
    base = sigmoid(2.0 * relativeAge - 1.5); // Peaks around median lag
  } else {
    // Cold start: use segment priors from SEGMENT_PRIORS constant
    const segment = customer.segment || "default";
    const priors = SEGMENT_PRIORS[segment] || SEGMENT_PRIORS.default;
    base = priors.pPayBase;
  }
  
  // Channel effectiveness boost
  let channelBoost = 0.05; // Default
  if (behavior) {
    const rates = {
      email: Number(behavior.emailReplyRate || 0),
      sms: Number(behavior.smsReplyRate || 0),
      whatsapp: Number(behavior.whatsappReplyRate || 0),
      call: Number(behavior.callAnswerRate || 0)
    };
    channelBoost = (rates[channel] || 0.05) * 0.6; // Scale channel response rate
  }
  
  // Amount sensitivity penalty (larger invoices paid slower)
  const amountPenalty = Math.min(0.25, Math.log10(Math.max(1, invoice.amount)) / 20);
  
  // Weekday effect
  const weekday = time.getDay();
  let weekdayAdj = 0;
  if (behavior?.weekdayEffect) {
    const effects = behavior.weekdayEffect as number[];
    weekdayAdj = (effects[weekday] || 1.0) - 1.0; // Convert multiplier to adjustment
  }
  
  // Promise to pay boost
  const ptpBoost = invoice.promiseToPayAt && isBefore(time, invoice.promiseToPayAt) ? 0.15 : 0;
  
  return clamp(base + channelBoost - amountPenalty + weekdayAdj + ptpBoost, 0, 1);
}

/**
 * Calculate friction cost of using this channel for this customer
 * Higher friction = less responsive, wrong channel for this customer
 */
function calculateFrictionCost(
  customer: CustomerContext,
  invoice: InvoiceContext,
  channel: Channel
): number {
  const behavior = customer.behavior;
  
  // Low response rate = high friction
  let lowResponse = 0.7; // Default friction for new customers
  if (behavior) {
    const rates = {
      email: Number(behavior.emailReplyRate || 0),
      sms: Number(behavior.smsReplyRate || 0),
      whatsapp: Number(behavior.whatsappReplyRate || 0),
      call: Number(behavior.callAnswerRate || 0)
    };
    lowResponse = 0.7 - (rates[channel] || 0.05);
  }
  
  // Penalize repeating same channel
  const repeatPenalty = invoice.lastChannel === channel ? 0.1 : 0;
  
  return clamp(lowResponse + repeatPenalty, 0, 1);
}

/**
 * Calculate compliance and reputational risk of this touch
 * Higher risk = more likely to damage relationship or violate rules
 */
function calculateComplianceRisk(
  invoice: InvoiceContext,
  time: Date,
  channel: Channel
): number {
  // Disputed invoices require gentle approach
  if (invoice.dispute) return 0.8;
  
  // Calling before due date is risky
  if (isBefore(time, invoice.dueAt) && channel === "call") return 0.15;
  
  // Active promise to pay - lower risk if we wait
  if (invoice.promiseToPayAt && isBefore(time, invoice.promiseToPayAt)) {
    return 0.3; // Some risk in contacting before PTP date
  }
  
  return 0.05; // Low baseline risk
}

/**
 * Calculate urgency boost based on portfolio DSO vs target
 * Earlier touches get higher boost when portfolio is behind target
 */
function calculateUrgencyBoost(
  settings: AdaptiveSettings,
  touchTime: Date,
  now: Date
): number {
  const hoursUntilTouch = Math.max(1, (touchTime.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  // Earlier touches get bigger boost: 1/sqrt(hours)
  // urgencyFactor is set by portfolio controller based on DSO vs target
  return clamp(settings.urgencyFactor * (1 / Math.sqrt(hoursUntilTouch)), 0, 1);
}

/**
 * Check if time falls within quiet hours
 */
function passesQuietHours(
  time: Date,
  [qStart, qEnd]: [number, number],
  timezone: string
): boolean {
  // Simplified: use UTC hour (production should use timezone library)
  const hour = time.getUTCHours();
  
  if (qStart < qEnd) {
    // Normal range (e.g., 22:00 to 08:00)
    return !(hour >= qStart && hour < qEnd);
  } else {
    // Wrap around midnight (e.g., 08:00 to 22:00)
    return !(hour >= qStart || hour < qEnd);
  }
}

/**
 * Check minimum gap since last touch
 */
function respectsGap(
  lastTouch: Date | undefined,
  nextTouch: Date,
  minGapHours: number
): boolean {
  if (!lastTouch) return true;
  
  const hoursSince = (nextTouch.getTime() - lastTouch.getTime()) / (1000 * 60 * 60);
  return hoursSince >= minGapHours;
}

/**
 * Explain top 3 factors driving this decision
 * Returns structured explainability data for logging
 */
function explainTopFactors(
  breakdown: { pPay: number; friction: number; risk: number; urgency: number },
  weights: { α: number; β: number; γ: number; δ: number },
  invoice: InvoiceContext,
  customer: CustomerContext,
  channel: Channel
): { factor1: string; factor2: string; factor3: string; policyVersion: string } {
  const { pPay, friction, risk, urgency } = breakdown;
  const { α, β, γ, δ } = weights;
  
  // Calculate weighted contributions
  const contributions = [
    { 
      name: `Days overdue: ${invoice.ageDays}`,
      value: δ * urgency,
      category: 'urgency'
    },
    { 
      name: `Payment probability: ${(pPay * 100).toFixed(0)}%`,
      value: α * pPay,
      category: 'behavior'
    },
    { 
      name: `${channel.toUpperCase()} effectiveness: ${((1 - friction) * 100).toFixed(0)}%`,
      value: -β * friction,
      category: 'channel'
    },
    { 
      name: `Amount: £${invoice.amount.toFixed(0)}`,
      value: α * pPay * 0.3, // Approximate contribution from amount
      category: 'amount'
    },
    { 
      name: `Compliance risk: ${(risk * 100).toFixed(0)}%`,
      value: -γ * risk,
      category: 'risk'
    }
  ];
  
  // Sort by absolute value of contribution
  contributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  
  return {
    factor1: contributions[0]?.name || '',
    factor2: contributions[1]?.name || '',
    factor3: contributions[2]?.name || '',
    policyVersion: 'v1.0' // Track policy version for A/B testing and rollback
  };
}

/**
 * Build human-readable reasoning for this touch recommendation
 */
function buildReasoning(
  channel: Channel,
  hoursFromNow: number,
  breakdown: { pPay: number; friction: number; risk: number; urgency: number }
): string {
  const { pPay, friction, risk, urgency } = breakdown;
  
  const parts: string[] = [];
  
  // Channel choice
  parts.push(`${channel.toUpperCase()}`);
  
  // Timing
  if (hoursFromNow < 24) {
    parts.push(`in ${hoursFromNow}h`);
  } else {
    parts.push(`in ${Math.round(hoursFromNow / 24)}d`);
  }
  
  // Key factors
  if (pPay > 0.6) {
    parts.push("high payment likelihood");
  } else if (pPay < 0.3) {
    parts.push("low payment likelihood");
  }
  
  if (friction > 0.5) {
    parts.push("channel less responsive");
  }
  
  if (risk > 0.3) {
    parts.push("compliance risk");
  }
  
  if (urgency > 0.5) {
    parts.push("urgent (portfolio behind target)");
  }
  
  return parts.join(" • ");
}

/**
 * Sigmoid activation function: smooth S-curve from 0 to 1
 */
function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Segment priors for cold start (new customers with no history)
 */
export const SEGMENT_PRIORS: Record<string, { pPayBase: number; expectedDaysToPay: number }> = {
  small_business: {
    pPayBase: 0.25,
    expectedDaysToPay: 21
  },
  enterprise: {
    pPayBase: 0.15,
    expectedDaysToPay: 45
  },
  freelancer: {
    pPayBase: 0.35,
    expectedDaysToPay: 14
  },
  default: {
    pPayBase: 0.2,
    expectedDaysToPay: 30
  }
};

/**
 * Log policy decision to event bus for explainability and audit
 */
export async function logPolicyDecision(params: {
  tenantId: string;
  contactId?: string;
  invoiceId?: string;
  actionId?: string;
  candidate: TouchCandidate | null;
  guardBlocked?: boolean;
  guardReason?: string;
  experimentVariant?: string;
}): Promise<void> {
  const { tenantId, contactId, invoiceId, actionId, candidate, guardBlocked, guardReason, experimentVariant } = params;
  
  if (candidate) {
    // Decision: contact recommended
    await eventBus.publish({
      type: 'policy.decision',
      tenantId,
      contactId,
      invoiceId,
      actionId,
      policyVersion: candidate.explainability?.policyVersion || 'v1.0',
      experimentVariant,
      decisionType: 'contact_now',
      channel: candidate.channel,
      score: candidate.score,
      factors: {
        factor1: candidate.explainability?.factor1,
        factor2: candidate.explainability?.factor2,
        factor3: candidate.explainability?.factor3,
      },
      scoreBreakdown: {
        pPay: candidate.breakdown.pPay,
        friction: candidate.breakdown.friction,
        risk: candidate.breakdown.risk,
        urgency: candidate.breakdown.urgency,
      },
      guardStatus: guardBlocked ? 'blocked' : 'allowed',
      guardReason,
      decisionContext: {
        scheduledTime: candidate.time.toISOString(),
        reasoning: candidate.reasoning,
      },
    });
  } else {
    // Decision: no action (all channels blocked or max touches reached)
    await eventBus.publish({
      type: 'policy.decision',
      tenantId,
      contactId,
      invoiceId,
      actionId,
      policyVersion: 'v1.0',
      experimentVariant,
      decisionType: 'wait',
      guardStatus: 'blocked',
      guardReason: guardReason || 'no_valid_candidates',
      factors: {},
      decisionContext: {},
    });
  }
}

/**
 * Check frequency cap: max N contacts per debtor per M days
 * Returns true if contact is allowed, false if cap exceeded
 */
export async function checkFrequencyCap(params: {
  tenantId: string;
  contactId: string;
  maxTouches: number; // e.g., 3
  windowDays: number; // e.g., 7
}): Promise<{ allowed: boolean; reason?: string; currentCount?: number }> {
  const { tenantId, contactId, maxTouches, windowDays } = params;
  
  try {
    // Import here to avoid circular dependencies
    const { db } = await import("../db");
    const { contactOutcomes } = await import("@shared/schema");
    const { and, eq, gte, sql } = await import("drizzle-orm");
    
    // Calculate window start date
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);
    
    // Count contact attempts in window
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(contactOutcomes)
      .where(
        and(
          eq(contactOutcomes.tenantId, tenantId),
          eq(contactOutcomes.contactId, contactId),
          eq(contactOutcomes.eventType, 'contact.attempted'),
          gte(contactOutcomes.eventTimestamp, windowStart)
        )
      );
    
    const currentCount = Number(result[0]?.count || 0);
    
    if (currentCount >= maxTouches) {
      return {
        allowed: false,
        reason: `frequency_cap_exceeded (${currentCount}/${maxTouches} in ${windowDays} days)`,
        currentCount,
      };
    }
    
    return { allowed: true, currentCount };
  } catch (error) {
    console.error('Error checking frequency cap:', error);
    // Fail open - allow contact if cap check fails
    return { allowed: true };
  }
}
