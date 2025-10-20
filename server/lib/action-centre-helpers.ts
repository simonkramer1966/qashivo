/**
 * Action Centre Helper Functions
 * 
 * Utilities for exception tagging, reason translation, and action scoring
 * for the adaptive Action Centre UI.
 */

import type { CustomerBehaviorSignal } from "@shared/schema";

export interface ExceptionTagsInput {
  invoice: {
    id: string;
    amount: string;
    dueDate: Date | string;
    disputeStatus?: string | null;
    collectionOverride?: string | null;
  };
  signals: CustomerBehaviorSignal | null;
  contact: {
    id: string;
    name: string;
  };
  recentNonResponseCount?: number;
}

export interface ScoringResult {
  finalScore: number;
  ppay: number;
  friction: number;
  risk: number;
  urgencyBoost: number;
  urgencyFactor: number;
  bestChannel: string;
  daysOverdue: number;
  expectedDays: number;
}

export interface Reason {
  label: string;
}

/**
 * Derive exception tags from invoice and signal data
 * 
 * Exception tags help agents focus on items needing human attention:
 * - Dispute: Invoice has active dispute
 * - Broken Promise: Customer has broken promises to pay
 * - High Value: Invoice amount exceeds high-value threshold
 * - Low Signal: Insufficient behavior data (cold-start)
 * - Channel Blocked: Customer unresponsive across all channels
 * - Repeated Non-Response: Multiple recent non-responses
 */
export function deriveExceptionTags(input: ExceptionTagsInput): string[] {
  const { invoice, signals, recentNonResponseCount = 0 } = input;
  const tags: string[] = [];
  
  // Dispute exception
  if (invoice.disputeStatus === 'under_review' || invoice.disputeStatus === 'pending') {
    tags.push("Dispute");
  }
  
  // Compliance hold (manual override to not contact)
  if (invoice.collectionOverride === 'do_not_contact') {
    tags.push("Compliance Hold");
  }
  
  // Broken promise exception
  if (signals && (signals.promiseBreachCount ?? 0) > 0) {
    tags.push("Broken Promise");
  }
  
  // High value exception (configurable threshold)
  const amount = parseFloat(invoice.amount || '0');
  const HIGH_VALUE_THRESHOLD = 10000; // £10k+ is high value
  if (amount >= HIGH_VALUE_THRESHOLD) {
    tags.push("High Value");
  }
  
  // Low signal exception (cold-start customers)
  if (!signals || (signals.invoiceCount || 0) < 3) {
    tags.push("Low Signal");
  }
  
  // Channel blocked exception (low response rates across all channels)
  if (signals) {
    const emailRate = parseFloat(signals.emailReplyRate?.toString() || '0');
    const smsRate = parseFloat(signals.smsReplyRate?.toString() || '0');
    const whatsappRate = parseFloat(signals.whatsappReplyRate?.toString() || '0');
    const callRate = parseFloat(signals.callAnswerRate?.toString() || '0');
    
    const maxRate = Math.max(emailRate, smsRate, whatsappRate, callRate);
    if (maxRate < 0.1) { // Less than 10% response on best channel
      tags.push("Channel Blocked");
    }
  }
  
  // Repeated non-response exception
  if (recentNonResponseCount >= 3) {
    tags.push("Repeated Non-Response");
  }
  
  return tags;
}

/**
 * Translate adaptive scheduler scoring data into plain English reasons
 * 
 * Takes technical scoring components and converts them into 1-3 bullet points
 * that explain the recommendation in human-readable terms.
 */
export function translateReasons(
  invoice: {
    id: string;
    amount: string;
    dueDate: Date | string;
  },
  signals: CustomerBehaviorSignal | null,
  score: ScoringResult,
  urgencyFactor: number
): Reason[] {
  const reasons: Reason[] = [];
  
  const daysOverdue = score.daysOverdue;
  const expectedDays = score.expectedDays || (signals ? parseFloat(signals.medianDaysToPay || '30') : 30);
  
  // Always show days overdue with context
  if (daysOverdue > expectedDays) {
    const deviation = daysOverdue - expectedDays;
    reasons.push({
      label: `${daysOverdue} days overdue (usually pays in ~${Math.round(expectedDays)} days, ${Math.round(deviation)}d late)`
    });
  } else if (daysOverdue > 0) {
    reasons.push({
      label: `${daysOverdue} days overdue`
    });
  }
  
  // Channel preference (if we have signal data)
  if (signals && score.bestChannel) {
    const channelRates = {
      email: parseFloat(signals.emailReplyRate?.toString() || '0'),
      sms: parseFloat(signals.smsReplyRate?.toString() || '0'),
      whatsapp: parseFloat(signals.whatsappReplyRate?.toString() || '0'),
      voice: parseFloat(signals.callAnswerRate?.toString() || '0')
    };
    
    const bestRate = channelRates[score.bestChannel as keyof typeof channelRates] || 0;
    
    if (bestRate > 0.2) {
      const percentage = Math.round(bestRate * 100);
      reasons.push({
        label: `Usually responds to ${score.bestChannel} (${percentage}% reply rate)`
      });
    } else if (bestRate > 0) {
      reasons.push({
        label: `Best channel: ${score.bestChannel} (limited response history)`
      });
    }
  }
  
  // Portfolio urgency (when DSO control is pushing for more action)
  if (urgencyFactor >= 0.7) {
    reasons.push({
      label: `Portfolio urgency is high (DSO behind target)`
    });
  } else if (urgencyFactor <= 0.3) {
    reasons.push({
      label: `Portfolio urgency is low (DSO ahead of target)`
    });
  }
  
  // Amount sensitivity (if invoice is larger than usual)
  if (signals && signals.amountSensitivity) {
    const amount = parseFloat(invoice.amount || '0');
    const sensitivity = signals.amountSensitivity as any;
    
    // Check if this is a higher-than-usual amount
    const medianDays = parseFloat(signals.medianDaysToPay || '30');
    if (amount > 20000 && sensitivity['>20000'] && sensitivity['>20000'] > medianDays) {
      reasons.push({
        label: `Amount higher than their usual invoices (may take longer to pay)`
      });
    }
  }
  
  // Risk markers (disputes, broken promises)
  if (signals) {
    const disputes = signals.disputeCount || 0;
    const breaches = signals.promiseBreachCount || 0;
    
    if (breaches > 0) {
      reasons.push({
        label: `Has broken ${breaches} promise${breaches > 1 ? 's' : ''} to pay before`
      });
    } else if (disputes > 0) {
      reasons.push({
        label: `Has ${disputes} dispute${disputes > 1 ? 's' : ''} on record`
      });
    }
  }
  
  // Payment trend (improving vs declining)
  if (signals && signals.trend) {
    const trend = parseFloat(signals.trend);
    if (trend < -1) {
      reasons.push({
        label: `Payment behavior improving (trend: ${trend.toFixed(1)} days/invoice)`
      });
    } else if (trend > 1) {
      reasons.push({
        label: `Payment behavior declining (trend: +${trend.toFixed(1)} days/invoice)`
      });
    }
  }
  
  // Return max 3 reasons (most important first)
  return reasons.slice(0, 3);
}

/**
 * Calculate priority band from composite score
 * 
 * Maps the 0-100 score into High/Medium/Low priority bands
 * for visual display and sorting.
 */
export function getPriorityBand(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

/**
 * Calculate SLA age in minutes from firstSeenAt timestamp
 */
export function getSLAAge(firstSeenAt: Date | string | null): number {
  if (!firstSeenAt) return 0;
  
  const now = new Date();
  const seen = new Date(firstSeenAt);
  const diffMs = now.getTime() - seen.getTime();
  return Math.floor(diffMs / 60000); // minutes
}

/**
 * Format action timing as human-readable label
 * 
 * Examples:
 * - "Send email today after 10:00"
 * - "Call tomorrow 09:30"
 * - "Send SMS in 2 days"
 */
export function formatActionLabel(channel: string, sendAt: Date | string): string {
  const dt = new Date(sendAt);
  const verb = getChannelVerb(channel);
  const when = humanizeTime(dt);
  
  return `${verb} ${when}`;
}

function getChannelVerb(channel: string): string {
  const verbs: Record<string, string> = {
    email: 'Send email',
    sms: 'Send SMS',
    whatsapp: 'Send WhatsApp',
    voice: 'Call'
  };
  return verbs[channel] || `Contact via ${channel}`;
}

function humanizeTime(dt: Date): string {
  const now = new Date();
  const diffMs = dt.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  
  if (diffDays < 0) {
    return `overdue (was ${timeStr})`;
  } else if (diffDays === 0) {
    return `today after ${timeStr}`;
  } else if (diffDays === 1) {
    return `tomorrow ${timeStr}`;
  } else if (diffDays < 7) {
    return `in ${diffDays} days`;
  } else {
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  }
}

/**
 * Calculate next business morning for snooze functionality
 * 
 * Snoozes to next day at 9:00 AM, skipping weekends
 */
export function nextBusinessMorning(timezone = 'Europe/London'): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  
  // Skip weekend
  const day = tomorrow.getDay();
  if (day === 0) { // Sunday -> Monday
    tomorrow.setDate(tomorrow.getDate() + 1);
  } else if (day === 6) { // Saturday -> Monday
    tomorrow.setDate(tomorrow.getDate() + 2);
  }
  
  return tomorrow;
}
