/**
 * Playbook Engine - AI-Driven Collections Decision Engine
 * 
 * This service implements the Qashivo Collections Playbook specification.
 * It determines WHO to contact, WHEN to contact them, and HOW to contact them
 * based on credit control best practices.
 */

import { db } from "../db";
import { contacts, invoices, disputes, promisesToPay, tenants, actions } from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const PlaybookStage = {
  CREDIT_CONTROL: 'CREDIT_CONTROL',
  RECOVERY: 'RECOVERY',
  LEGAL: 'LEGAL',
} as const;
export type PlaybookStage = typeof PlaybookStage[keyof typeof PlaybookStage];

export const RiskTag = {
  NORMAL: 'NORMAL',
  HIGH_VALUE: 'HIGH_VALUE',
} as const;
export type RiskTag = typeof RiskTag[keyof typeof RiskTag];

export const OverdueBand = {
  CURRENT: 'CURRENT',
  DAYS_0_7: '0_7',
  DAYS_8_30: '8_30',
  DAYS_31_60: '31_60',
  DAYS_61_90: '61_90',
  DAYS_90_PLUS: '90_PLUS',
} as const;
export type OverdueBand = typeof OverdueBand[keyof typeof OverdueBand];

export const TenantStyle = {
  GENTLE: 'GENTLE',
  STANDARD: 'STANDARD',
  FIRM: 'FIRM',
} as const;
export type TenantStyle = typeof TenantStyle[keyof typeof TenantStyle];

export const WrongPartyRisk = {
  NONE: 'NONE',
  SUSPECTED: 'SUSPECTED',
  CONFIRMED: 'CONFIRMED',
} as const;
export type WrongPartyRisk = typeof WrongPartyRisk[keyof typeof WrongPartyRisk];

export const PtpStatus = {
  NONE: 'NONE',
  ACTIVE: 'ACTIVE',
  MET: 'MET',
  MISSED: 'MISSED',
} as const;
export type PtpStatus = typeof PtpStatus[keyof typeof PtpStatus];

export const SuggestedAction = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  VOICE_CALL: 'VOICE_CALL',
  SNOOZE: 'SNOOZE',
  INTERNAL_REVIEW: 'INTERNAL_REVIEW',
} as const;
export type SuggestedAction = typeof SuggestedAction[keyof typeof SuggestedAction];

export const ToneProfile = {
  CREDIT_CONTROL_FRIENDLY: 'CREDIT_CONTROL_FRIENDLY',
  CREDIT_CONTROL_FIRM: 'CREDIT_CONTROL_FIRM',
  RECOVERY_FORMAL_FIRM: 'RECOVERY_FORMAL_FIRM',
  LEGAL_ESCALATION_INFO: 'LEGAL_ESCALATION_INFO',
} as const;
export type ToneProfile = typeof ToneProfile[keyof typeof ToneProfile];

export const VoiceTone = {
  VOICE_TONE_CALM_COLLABORATIVE: 'VOICE_TONE_CALM_COLLABORATIVE',
  VOICE_TONE_FIRM_COLLABORATIVE: 'VOICE_TONE_FIRM_COLLABORATIVE',
  VOICE_TONE_FORMAL_RECOVERY: 'VOICE_TONE_FORMAL_RECOVERY',
  VOICE_TONE_LEGAL_INFO: 'VOICE_TONE_LEGAL_INFO',
} as const;
export type VoiceTone = typeof VoiceTone[keyof typeof VoiceTone];

export const ReasonCode = {
  DISPUTE_OR_WRONG_PARTY_REVIEW: 'DISPUTE_OR_WRONG_PARTY_REVIEW',
  PTP_MISSED: 'PTP_MISSED',
  NEWLY_OVERDUE_7D: 'NEWLY_OVERDUE_7D',
  EARLY_OVERDUE_FIRST_TOUCH: 'EARLY_OVERDUE_FIRST_TOUCH',
  EARLY_OVERDUE_NO_RESPONSE: 'EARLY_OVERDUE_NO_RESPONSE',
  MID_OVERDUE_ESCALATION: 'MID_OVERDUE_ESCALATION',
  LATE_OVERDUE_61_90: 'LATE_OVERDUE_61_90',
  RECOVERY_90_PLUS_FORMAL_REMINDER: 'RECOVERY_90_PLUS_FORMAL_REMINDER',
  RECOVERY_FOLLOW_UP_CALL: 'RECOVERY_FOLLOW_UP_CALL',
  RECOVERY_STATUTORY_INTEREST_INFO: 'RECOVERY_STATUTORY_INTEREST_INFO',
  CONTACT_LIMIT_REACHED: 'CONTACT_LIMIT_REACHED',
  GENERIC_OVERDUE_FOLLOWUP: 'GENERIC_OVERDUE_FOLLOWUP',
} as const;
export type ReasonCode = typeof ReasonCode[keyof typeof ReasonCode];

export const TemplateId = {
  EMAIL_FRIENDLY_REMINDER: 'EMAIL_FRIENDLY_REMINDER',
  EMAIL_FIRM_REMINDER: 'EMAIL_FIRM_REMINDER',
  SMS_OVERDUE_REMINDER: 'SMS_OVERDUE_REMINDER',
  SMS_PTP_CHASE: 'SMS_PTP_CHASE',
  SMS_ESCALATED_REMINDER: 'SMS_ESCALATED_REMINDER',
  VOICE_PTP_CHASE: 'VOICE_PTP_CHASE',
  VOICE_PTP_REQUEST: 'VOICE_PTP_REQUEST',
  VOICE_ESCALATED_REMINDER: 'VOICE_ESCALATED_REMINDER',
  RECOVERY_EMAIL_FORMAL_REMINDER: 'RECOVERY_EMAIL_FORMAL_REMINDER',
  RECOVERY_VOICE_FORMAL_CALL: 'RECOVERY_VOICE_FORMAL_CALL',
  RECOVERY_EMAIL_INTEREST_AND_COSTS_INFO: 'RECOVERY_EMAIL_INTEREST_AND_COSTS_INFO',
  INTERNAL_DISPUTE_REVIEW_TASK: 'INTERNAL_DISPUTE_REVIEW_TASK',
} as const;
export type TemplateId = typeof TemplateId[keyof typeof TemplateId];

export const PriorityBand = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type PriorityBand = typeof PriorityBand[keyof typeof PriorityBand];

// ============================================================================
// TYPES
// ============================================================================

export interface CustomerCollectionState {
  contactId: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  totalAr: number;
  totalOverdue: number;
  maxDaysOverdue: number;
  avgDaysOverdue: number;
  overdueBand: OverdueBand;
  stage: PlaybookStage;
  lastOutboundAt: Date | null;
  lastOutboundChannel: string | null;
  lastInboundAt: Date | null;
  contactCountLast30d: number;
  inDispute: boolean;
  ptpStatus: PtpStatus;
  ptpPromisedDate: Date | null;
  manualBlocked: boolean;
  riskTag: RiskTag;
  isPotentiallyVulnerable: boolean;
  wrongPartyRisk: WrongPartyRisk;
  nextTouchNotBefore: Date | null;
  interestNotified: boolean;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    amountPaid: number;
    dueDate: Date;
    daysOverdue: number;
    isDisputed: boolean;
  }>;
}

export interface PlaybookDecision {
  contactId: string;
  contactName: string;
  priorityScore: number;
  priorityBand: PriorityBand;
  reasonCode: ReasonCode;
  suggestedAction: SuggestedAction;
  suggestedTemplateId: TemplateId;
  nextTouchNotBefore: Date;
  stage: PlaybookStage;
  toneProfile: ToneProfile;
  voiceTone: VoiceTone;
  customerState: CustomerCollectionState;
}

export interface TenantPlaybookConfig {
  tenantStyle: TenantStyle;
  highValueThreshold: number;
  singleInvoiceHighValueThreshold: number;
  useLatePamentLegislation: boolean;
  channelCooldowns: { email: number; sms: number; voice: number };
  maxTouchesPerWindow: number;
  contactWindowDays: number;
  businessHoursStart: string;
  businessHoursEnd: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getOverdueBand(maxDaysOverdue: number): OverdueBand {
  if (maxDaysOverdue <= 0) return OverdueBand.CURRENT;
  if (maxDaysOverdue <= 7) return OverdueBand.DAYS_0_7;
  if (maxDaysOverdue <= 30) return OverdueBand.DAYS_8_30;
  if (maxDaysOverdue <= 60) return OverdueBand.DAYS_31_60;
  if (maxDaysOverdue <= 90) return OverdueBand.DAYS_61_90;
  return OverdueBand.DAYS_90_PLUS;
}

function deriveStage(maxDaysOverdue: number, existingStage?: string): PlaybookStage {
  if (existingStage === PlaybookStage.LEGAL) return PlaybookStage.LEGAL;
  if (existingStage === PlaybookStage.RECOVERY) return PlaybookStage.RECOVERY;
  if (maxDaysOverdue >= 90) return PlaybookStage.RECOVERY;
  return PlaybookStage.CREDIT_CONTROL;
}

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getToneAndVoice(stage: PlaybookStage, isFirm: boolean): { toneProfile: ToneProfile; voiceTone: VoiceTone } {
  if (stage === PlaybookStage.RECOVERY) {
    return {
      toneProfile: ToneProfile.RECOVERY_FORMAL_FIRM,
      voiceTone: VoiceTone.VOICE_TONE_FORMAL_RECOVERY,
    };
  }
  if (stage === PlaybookStage.LEGAL) {
    return {
      toneProfile: ToneProfile.LEGAL_ESCALATION_INFO,
      voiceTone: VoiceTone.VOICE_TONE_LEGAL_INFO,
    };
  }
  if (isFirm) {
    return {
      toneProfile: ToneProfile.CREDIT_CONTROL_FIRM,
      voiceTone: VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE,
    };
  }
  return {
    toneProfile: ToneProfile.CREDIT_CONTROL_FRIENDLY,
    voiceTone: VoiceTone.VOICE_TONE_CALM_COLLABORATIVE,
  };
}

// ============================================================================
// PRIORITY SCORING (Section 3 of Playbook)
// ============================================================================

function calculatePriorityScore(state: CustomerCollectionState): number {
  let score = 0;

  // 3.1 Overdue severity
  if (state.maxDaysOverdue > 90) score += 80;
  else if (state.maxDaysOverdue > 60) score += 60;
  else if (state.maxDaysOverdue > 30) score += 40;
  else if (state.maxDaysOverdue > 7) score += 20;
  else if (state.maxDaysOverdue > 0) score += 10;

  // 3.2 Amount overdue
  if (state.totalOverdue >= 20000) score += 20;
  else if (state.totalOverdue >= 10000) score += 15;
  else if (state.totalOverdue >= 5000) score += 10;
  else if (state.totalOverdue >= 1000) score += 5;

  // 3.3 Promises to pay
  if (state.ptpStatus === PtpStatus.MISSED) score += 30;
  if (state.ptpStatus === PtpStatus.ACTIVE) score -= 10;

  // 3.4 Contact recency
  const daysSinceLastOutbound = state.lastOutboundAt
    ? daysBetween(new Date(), state.lastOutboundAt)
    : null;

  if (daysSinceLastOutbound === null) score += 10;
  else if (daysSinceLastOutbound >= 30) score += 15;
  else if (daysSinceLastOutbound >= 14) score += 10;
  else if (daysSinceLastOutbound <= 3) score -= 10;

  // 3.5 Risk tag
  if (state.riskTag === RiskTag.HIGH_VALUE && state.maxDaysOverdue >= 60) score += 10;

  // 3.6 Disputes
  if (state.inDispute) score -= 20;

  // 3.7 Stage weighting
  if (state.stage === PlaybookStage.RECOVERY) score += 10;

  // 3.8 Compliance adjustments
  if (state.wrongPartyRisk === WrongPartyRisk.SUSPECTED) score -= 50;
  if (state.isPotentiallyVulnerable) score -= 15;

  return Math.max(0, Math.min(100, score));
}

function getPriorityBand(score: number): PriorityBand {
  if (score >= 70) return PriorityBand.HIGH;
  if (score >= 40) return PriorityBand.MEDIUM;
  return PriorityBand.LOW;
}

// ============================================================================
// PLAYBOOK RULES (Section 4 of Playbook)
// ============================================================================

function evaluatePlaybookRules(
  state: CustomerCollectionState,
  config: TenantPlaybookConfig
): Omit<PlaybookDecision, 'priorityScore' | 'priorityBand' | 'customerState'> {
  const now = new Date();
  const daysSinceLastOutbound = state.lastOutboundAt
    ? daysBetween(now, state.lastOutboundAt)
    : null;
  const hasAnyPriorContact = state.lastOutboundAt !== null;
  const noReply = !state.lastInboundAt || 
    (state.lastOutboundAt && state.lastInboundAt < state.lastOutboundAt);

  // 4.1 Dispute or potential wrong party (FIRST CHECK)
  if (state.inDispute || state.wrongPartyRisk === WrongPartyRisk.SUSPECTED) {
    return {
      contactId: state.contactId,
      contactName: state.contactName,
      reasonCode: ReasonCode.DISPUTE_OR_WRONG_PARTY_REVIEW,
      suggestedAction: SuggestedAction.INTERNAL_REVIEW,
      suggestedTemplateId: TemplateId.INTERNAL_DISPUTE_REVIEW_TASK,
      nextTouchNotBefore: addDays(now, 3),
      stage: state.stage,
      ...getToneAndVoice(state.stage, false),
    };
  }

  // 4.2 Missed promise to pay (TOP BEHAVIOURAL SIGNAL)
  if (state.ptpStatus === PtpStatus.MISSED) {
    const isHighValueOrLateStage = state.riskTag === RiskTag.HIGH_VALUE || state.maxDaysOverdue >= 60;
    const canContact = daysSinceLastOutbound === null || daysSinceLastOutbound > 3;
    
    if (canContact) {
      if (isHighValueOrLateStage) {
        return {
          contactId: state.contactId,
          contactName: state.contactName,
          reasonCode: ReasonCode.PTP_MISSED,
          suggestedAction: SuggestedAction.VOICE_CALL,
          suggestedTemplateId: TemplateId.VOICE_PTP_CHASE,
          nextTouchNotBefore: addDays(now, 3),
          stage: state.stage,
          ...getToneAndVoice(state.stage, true),
        };
      } else {
        return {
          contactId: state.contactId,
          contactName: state.contactName,
          reasonCode: ReasonCode.PTP_MISSED,
          suggestedAction: SuggestedAction.SMS,
          suggestedTemplateId: TemplateId.SMS_PTP_CHASE,
          nextTouchNotBefore: addDays(now, 3),
          stage: state.stage,
          ...getToneAndVoice(state.stage, true),
        };
      }
    }
  }

  // 4.3 Newly overdue (0-7 days, credit control only)
  if (state.overdueBand === OverdueBand.DAYS_0_7 && !hasAnyPriorContact && state.stage === PlaybookStage.CREDIT_CONTROL) {
    return {
      contactId: state.contactId,
      contactName: state.contactName,
      reasonCode: ReasonCode.NEWLY_OVERDUE_7D,
      suggestedAction: SuggestedAction.EMAIL,
      suggestedTemplateId: TemplateId.EMAIL_FRIENDLY_REMINDER,
      nextTouchNotBefore: addDays(now, 5),
      stage: state.stage,
      ...getToneAndVoice(state.stage, false),
    };
  }

  // 4.4 Early overdue (8-30 days, credit control)
  if (state.overdueBand === OverdueBand.DAYS_8_30 && state.stage === PlaybookStage.CREDIT_CONTROL) {
    // Condition A: first touch
    if (!hasAnyPriorContact) {
      const isFirm = config.tenantStyle === TenantStyle.FIRM;
      return {
        contactId: state.contactId,
        contactName: state.contactName,
        reasonCode: ReasonCode.EARLY_OVERDUE_FIRST_TOUCH,
        suggestedAction: SuggestedAction.EMAIL,
        suggestedTemplateId: TemplateId.EMAIL_FRIENDLY_REMINDER,
        nextTouchNotBefore: addDays(now, 7),
        stage: state.stage,
        ...getToneAndVoice(state.stage, isFirm),
      };
    }

    // Condition B: no response to first contact
    if (hasAnyPriorContact && (daysSinceLastOutbound === null || daysSinceLastOutbound >= 7) && noReply) {
      if (state.totalOverdue >= 5000) {
        return {
          contactId: state.contactId,
          contactName: state.contactName,
          reasonCode: ReasonCode.EARLY_OVERDUE_NO_RESPONSE,
          suggestedAction: SuggestedAction.SMS,
          suggestedTemplateId: TemplateId.SMS_OVERDUE_REMINDER,
          nextTouchNotBefore: addDays(now, 7),
          stage: state.stage,
          ...getToneAndVoice(state.stage, true),
        };
      } else {
        return {
          contactId: state.contactId,
          contactName: state.contactName,
          reasonCode: ReasonCode.EARLY_OVERDUE_NO_RESPONSE,
          suggestedAction: SuggestedAction.EMAIL,
          suggestedTemplateId: TemplateId.EMAIL_FIRM_REMINDER,
          nextTouchNotBefore: addDays(now, 7),
          stage: state.stage,
          ...getToneAndVoice(state.stage, true),
        };
      }
    }
  }

  // 4.5 Mid overdue (31-60 days, credit control)
  if (state.overdueBand === OverdueBand.DAYS_31_60 && 
      state.ptpStatus !== PtpStatus.ACTIVE && 
      state.stage === PlaybookStage.CREDIT_CONTROL &&
      (daysSinceLastOutbound === null || daysSinceLastOutbound >= 7)) {
    const isHighValueOrLarge = state.riskTag === RiskTag.HIGH_VALUE || state.totalOverdue >= 10000;
    
    if (isHighValueOrLarge) {
      return {
        contactId: state.contactId,
        contactName: state.contactName,
        reasonCode: ReasonCode.MID_OVERDUE_ESCALATION,
        suggestedAction: SuggestedAction.VOICE_CALL,
        suggestedTemplateId: TemplateId.VOICE_PTP_REQUEST,
        nextTouchNotBefore: addDays(now, 7),
        stage: state.stage,
        ...getToneAndVoice(state.stage, true),
      };
    } else {
      return {
        contactId: state.contactId,
        contactName: state.contactName,
        reasonCode: ReasonCode.MID_OVERDUE_ESCALATION,
        suggestedAction: SuggestedAction.EMAIL,
        suggestedTemplateId: TemplateId.EMAIL_FIRM_REMINDER,
        nextTouchNotBefore: addDays(now, 7),
        stage: state.stage,
        ...getToneAndVoice(state.stage, true),
      };
    }
  }

  // 4.6 Late overdue (61-90 days, end of credit control)
  if (state.overdueBand === OverdueBand.DAYS_61_90 && 
      state.ptpStatus !== PtpStatus.ACTIVE && 
      state.stage === PlaybookStage.CREDIT_CONTROL &&
      (daysSinceLastOutbound === null || daysSinceLastOutbound >= 10)) {
    
    if (state.riskTag === RiskTag.HIGH_VALUE) {
      return {
        contactId: state.contactId,
        contactName: state.contactName,
        reasonCode: ReasonCode.LATE_OVERDUE_61_90,
        suggestedAction: SuggestedAction.VOICE_CALL,
        suggestedTemplateId: TemplateId.VOICE_ESCALATED_REMINDER,
        nextTouchNotBefore: addDays(now, 10),
        stage: state.stage,
        ...getToneAndVoice(state.stage, true),
      };
    } else {
      return {
        contactId: state.contactId,
        contactName: state.contactName,
        reasonCode: ReasonCode.LATE_OVERDUE_61_90,
        suggestedAction: SuggestedAction.SMS,
        suggestedTemplateId: TemplateId.SMS_ESCALATED_REMINDER,
        nextTouchNotBefore: addDays(now, 10),
        stage: state.stage,
        ...getToneAndVoice(state.stage, true),
      };
    }
  }

  // 4.7 Recovery stage (90+ days or manually escalated)
  if (state.stage === PlaybookStage.RECOVERY && 
      state.overdueBand === OverdueBand.DAYS_90_PLUS &&
      state.ptpStatus !== PtpStatus.ACTIVE &&
      (daysSinceLastOutbound === null || daysSinceLastOutbound >= 14)) {
    return {
      contactId: state.contactId,
      contactName: state.contactName,
      reasonCode: ReasonCode.RECOVERY_90_PLUS_FORMAL_REMINDER,
      suggestedAction: SuggestedAction.EMAIL,
      suggestedTemplateId: TemplateId.RECOVERY_EMAIL_FORMAL_REMINDER,
      nextTouchNotBefore: addDays(now, 14),
      stage: state.stage,
      ...getToneAndVoice(state.stage, true),
    };
  }

  // 4.8 Fallback rule
  const { toneProfile, voiceTone } = getToneAndVoice(state.stage, true);
  return {
    contactId: state.contactId,
    contactName: state.contactName,
    reasonCode: ReasonCode.GENERIC_OVERDUE_FOLLOWUP,
    suggestedAction: SuggestedAction.EMAIL,
    suggestedTemplateId: state.stage === PlaybookStage.RECOVERY 
      ? TemplateId.RECOVERY_EMAIL_FORMAL_REMINDER 
      : TemplateId.EMAIL_FIRM_REMINDER,
    nextTouchNotBefore: addDays(now, 7),
    stage: state.stage,
    toneProfile,
    voiceTone,
  };
}

// ============================================================================
// MAIN PLAYBOOK ENGINE
// ============================================================================

export async function getCustomerCollectionState(
  tenantId: string,
  contactId: string
): Promise<CustomerCollectionState | null> {
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)),
  });

  if (!contact) return null;

  const customerInvoices = await db.query.invoices.findMany({
    where: and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.contactId, contactId),
      eq(invoices.status, 'overdue')
    ),
  });

  const now = new Date();
  const invoiceData = customerInvoices.map(inv => {
    const dueDate = new Date(inv.dueDate);
    const daysOverdue = Math.max(0, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: parseFloat(inv.amount as string),
      amountPaid: parseFloat((inv.amountPaid || '0') as string),
      dueDate,
      daysOverdue,
      isDisputed: inv.pauseState === 'dispute',
    };
  });

  const totalAr = invoiceData.reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0);
  const overdueInvoices = invoiceData.filter(inv => inv.daysOverdue > 0);
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0);
  const maxDaysOverdue = overdueInvoices.length > 0 
    ? Math.max(...overdueInvoices.map(inv => inv.daysOverdue)) 
    : 0;
  const avgDaysOverdue = overdueInvoices.length > 0
    ? overdueInvoices.reduce((sum, inv) => sum + inv.daysOverdue, 0) / overdueInvoices.length
    : 0;

  const inDispute = invoiceData.some(inv => inv.isDisputed);

  const activePtp = await db.query.promisesToPay.findFirst({
    where: and(
      eq(promisesToPay.contactId, contactId),
      eq(promisesToPay.status, 'pending')
    ),
    orderBy: [desc(promisesToPay.createdAt)],
  });

  const missedPtp = await db.query.promisesToPay.findFirst({
    where: and(
      eq(promisesToPay.contactId, contactId),
      eq(promisesToPay.status, 'breached')
    ),
    orderBy: [desc(promisesToPay.createdAt)],
  });

  let ptpStatus: PtpStatus = PtpStatus.NONE;
  let ptpPromisedDate: Date | null = null;

  if (missedPtp) {
    ptpStatus = PtpStatus.MISSED;
    ptpPromisedDate = missedPtp.promisedDate ? new Date(missedPtp.promisedDate) : null;
  } else if (activePtp) {
    ptpStatus = PtpStatus.ACTIVE;
    ptpPromisedDate = activePtp.promisedDate ? new Date(activePtp.promisedDate) : null;
  }

  const overdueBand = getOverdueBand(maxDaysOverdue);
  const stage = deriveStage(maxDaysOverdue, contact.playbookStage || undefined);

  const riskTag: RiskTag = totalOverdue > 10000 || invoiceData.some(inv => inv.amount > 5000)
    ? RiskTag.HIGH_VALUE
    : RiskTag.NORMAL;

  return {
    contactId: contact.id,
    contactName: contact.name,
    email: contact.arContactEmail || contact.email,
    phone: contact.arContactPhone || contact.phone,
    totalAr,
    totalOverdue,
    maxDaysOverdue,
    avgDaysOverdue,
    overdueBand,
    stage,
    lastOutboundAt: contact.lastOutboundAt ? new Date(contact.lastOutboundAt) : null,
    lastOutboundChannel: contact.lastOutboundChannel,
    lastInboundAt: contact.lastInboundAt ? new Date(contact.lastInboundAt) : null,
    contactCountLast30d: contact.contactCountLast30d || 0,
    inDispute,
    ptpStatus,
    ptpPromisedDate,
    manualBlocked: contact.manualBlocked || false,
    riskTag,
    isPotentiallyVulnerable: contact.isPotentiallyVulnerable || false,
    wrongPartyRisk: (contact.wrongPartyRisk as WrongPartyRisk) || WrongPartyRisk.NONE,
    nextTouchNotBefore: contact.nextTouchNotBefore ? new Date(contact.nextTouchNotBefore) : null,
    interestNotified: contact.interestNotified || false,
    invoices: invoiceData,
  };
}

export async function getTenantPlaybookConfig(tenantId: string): Promise<TenantPlaybookConfig> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  const defaultConfig: TenantPlaybookConfig = {
    tenantStyle: TenantStyle.STANDARD,
    highValueThreshold: 10000,
    singleInvoiceHighValueThreshold: 5000,
    useLatePamentLegislation: false,
    channelCooldowns: { email: 3, sms: 5, voice: 7 },
    maxTouchesPerWindow: 3,
    contactWindowDays: 14,
    businessHoursStart: '08:00',
    businessHoursEnd: '18:00',
  };

  if (!tenant) return defaultConfig;

  return {
    tenantStyle: (tenant.tenantStyle as TenantStyle) || defaultConfig.tenantStyle,
    highValueThreshold: parseFloat((tenant.highValueThreshold || '10000') as string),
    singleInvoiceHighValueThreshold: parseFloat((tenant.singleInvoiceHighValueThreshold || '5000') as string),
    useLatePamentLegislation: tenant.useLatePamentLegislation ?? defaultConfig.useLatePamentLegislation,
    channelCooldowns: (tenant.channelCooldowns as { email: number; sms: number; voice: number }) || defaultConfig.channelCooldowns,
    maxTouchesPerWindow: tenant.maxTouchesPerWindow ?? defaultConfig.maxTouchesPerWindow,
    contactWindowDays: tenant.contactWindowDays ?? defaultConfig.contactWindowDays,
    businessHoursStart: tenant.businessHoursStart || defaultConfig.businessHoursStart,
    businessHoursEnd: tenant.businessHoursEnd || defaultConfig.businessHoursEnd,
  };
}

export async function generatePlaybookDecision(
  tenantId: string,
  contactId: string
): Promise<PlaybookDecision | null> {
  const state = await getCustomerCollectionState(tenantId, contactId);
  if (!state) return null;

  const config = await getTenantPlaybookConfig(tenantId);
  const now = new Date();

  // Inclusion rule checks (Section 2 of Playbook)
  if (state.totalOverdue <= 0) return null;
  if (state.manualBlocked) return null;
  if (state.wrongPartyRisk === WrongPartyRisk.CONFIRMED) return null;
  if (state.nextTouchNotBefore && now < state.nextTouchNotBefore) return null;
  if (state.stage === PlaybookStage.LEGAL) return null;

  const priorityScore = calculatePriorityScore(state);
  const priorityBand = getPriorityBand(priorityScore);
  const ruleResult = evaluatePlaybookRules(state, config);

  return {
    ...ruleResult,
    priorityScore,
    priorityBand,
    customerState: state,
  };
}

export async function generateDailyPlaybookActions(tenantId: string): Promise<PlaybookDecision[]> {
  const allContacts = await db.query.contacts.findMany({
    where: and(
      eq(contacts.tenantId, tenantId),
      eq(contacts.role, 'customer'),
      eq(contacts.isActive, true)
    ),
  });

  const decisions: PlaybookDecision[] = [];

  for (const contact of allContacts) {
    try {
      const decision = await generatePlaybookDecision(tenantId, contact.id);
      if (decision) {
        decisions.push(decision);
      }
    } catch (error) {
      console.error(`Error generating playbook decision for contact ${contact.id}:`, error);
    }
  }

  // Sort by priority band then priority score
  decisions.sort((a, b) => {
    const bandOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const bandDiff = bandOrder[a.priorityBand] - bandOrder[b.priorityBand];
    if (bandDiff !== 0) return bandDiff;
    return b.priorityScore - a.priorityScore;
  });

  return decisions;
}

export async function updateContactAfterOutbound(
  tenantId: string,
  contactId: string,
  channel: 'EMAIL' | 'SMS' | 'VOICE',
  nextTouchDays: number
): Promise<void> {
  const now = new Date();
  const nextTouchNotBefore = addDays(now, nextTouchDays);

  await db.update(contacts)
    .set({
      lastOutboundAt: now,
      lastOutboundChannel: channel,
      nextTouchNotBefore,
      contactCountLast30d: sql`COALESCE(${contacts.contactCountLast30d}, 0) + 1`,
      updatedAt: now,
    })
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
}

export async function markContactInbound(
  tenantId: string,
  contactId: string
): Promise<void> {
  const now = new Date();
  await db.update(contacts)
    .set({
      lastInboundAt: now,
      updatedAt: now,
    })
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
}
