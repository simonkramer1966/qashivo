/**
 * Charlie Deterministic Decision Tree Engine (Brain 1)
 *
 * Pure-function module — zero DB queries, zero side effects, zero LLM calls.
 * Same input always produces same output.
 *
 * Brain 1 decides WHAT to do. Brain 2 (LLM, unchanged) decides HOW to say it.
 *
 * Feature-flagged via tenants.useDecisionTree (default false).
 */

// ─── Input Types ─────────────────────────────────────────────

export interface InvoiceInput {
  id: string;
  amount: number;
  amountPaid: number;
  dueDate: Date;
  issueDate: Date;
  status: string;
  pauseState: string | null;
  escalationFlag: boolean;
  legalFlag: boolean;
  promiseToPayDate: Date | null;
  balance: number;
  collectionStage: string | null;
}

export interface ContactInput {
  id: string;
  email: string | null;
  phone: string | null;
  paymentTerms: number;
  riskScore: number | null;
  manualBlocked: boolean;
  probablePaymentDetected: boolean;
  probablePaymentConfidence: string | null;
  legalResponseWindowEnd: Date | null;
  isVip: boolean;
  isException: boolean;
  isPotentiallyVulnerable: boolean;
  wrongPartyRisk: string;
  lastOutboundAt: Date | null;
  lastOutboundChannel: string | null;
  lastInboundAt: Date | null;
  contactCountLast30d: number;
  nextTouchNotBefore: Date | null;
  companiesHouseStatus: string | null;
}

export interface BehaviorSignalsInput {
  medianDaysToPay: number | null;
  p75DaysToPay: number | null;
  volatility: number | null;
  trend: number | null;
  emailReplyRate: number | null;
  smsReplyRate: number | null;
  voiceReplyRate: number | null;
  segment: string | null;
  invoiceCount: number;
  disputeCount: number;
  promiseBreachCount: number;
}

export interface LearningProfileInput {
  emailEffectiveness: number;
  smsEffectiveness: number;
  voiceEffectiveness: number;
  debtorUrgency: number | null;
  prsRaw: number | null;
  prsConfidence: number | null;
  isSerialPromiser: boolean;
  isReliableLatePayer: boolean;
  responsiveness: string | null;   // high | medium | low | null
  sentimentTrend: string | null;   // improving | stable | deteriorating | null
  paymentReliability: number | null;
  learningConfidence: number | null;
}

export interface ChannelPrefsInput {
  emailEnabled: boolean;
  smsEnabled: boolean;
  voiceEnabled: boolean;
}

export interface TenantSettingsInput {
  chaseDelayDays: number;
  preDueDateDays: number;
  preDueDateMinAmount: number;
  minimumChaseThreshold: number;
  noResponseEscalationThreshold: number;
  significantPaymentThreshold: number;
  channelCooldowns: { email: number; sms: number; voice: number };
  dsoImpactThreshold: number;
  tenantStyle: 'GENTLE' | 'STANDARD' | 'FIRM';
  businessHoursStart: string;  // "HH:MM"
  businessHoursEnd: string;    // "HH:MM"
}

export interface LastActionInput {
  completedAt: Date;
  type: string;
  agentToneLevel: ToneLevel | null;
}

export interface DSOContextInput {
  currentDSO: number;         // 30-day rolling
  totalOutstanding: number;
  debtorOutstanding: number;
  debtorPaymentTerms: number;
}

export interface DebtorDecisionInput {
  now: Date;
  communicationModeOff: boolean;
  recentInboundUnprocessed: boolean;
  consecutiveNoResponseCount: number;
  paymentPlanFailureCount: number;
  totalOutstandingForDebtor: number;
  hasActiveDispute: boolean;
  hasActivePaymentPlan: boolean;

  invoice: InvoiceInput;
  contact: ContactInput;
  behavior: BehaviorSignalsInput;
  learningProfile: LearningProfileInput;
  channelPrefs: ChannelPrefsInput;
  tenantSettings: TenantSettingsInput;
  lastAction: LastActionInput | null;
  dsoContext: DSOContextInput;
}

// ─── Output Types ────────────────────────────────────────────

export type ToneLevel = 'friendly' | 'professional' | 'firm' | 'formal' | 'legal';

export interface DSOAcceptanceResult {
  acceptance: 'ACCEPT' | 'NEGOTIATE';
  dsoImpact: number;
  partialPaymentNeeded: number | null;   // null if ACCEPT
  naturalFraction: '1/2' | '1/3' | '1/4' | null;  // for LLM phrasing
  reasoning: string;
}

export interface DecisionOutput {
  action: 'HOLD' | 'CONTACT';
  holdReason?: string;
  gateNode?: string;
  gatesEvaluated: number;
  behaviouralCategory?: 'RELIABLE' | 'COMMUNICATIVE' | 'SILENT' | 'UNKNOWN';
  phase?: 'pre_due' | 'inform' | 'elicit_date';
  tone?: ToneLevel;
  channel?: 'email' | 'sms' | 'voice';
  scheduledFor?: Date;
  dsoAcceptance?: DSOAcceptanceResult;
  createException?: { type: string; explanation: string; priority: string };
  reasoning: string;
  inputSnapshot: DebtorDecisionInput;
}

// ─── Constants (replicated from toneEscalationEngine.ts — no imports) ────

const TONE_ORDER: ToneLevel[] = ['friendly', 'professional', 'firm', 'formal', 'legal'];

type TenantStyle = 'GENTLE' | 'STANDARD' | 'FIRM';

const ESCALATION_THRESHOLDS: Record<TenantStyle, Record<ToneLevel, number>> = {
  GENTLE: {
    friendly: 14,
    professional: 21,
    firm: 37,
    formal: 67,
    legal: Infinity,
  },
  STANDARD: {
    friendly: 7,
    professional: 14,
    firm: 30,
    formal: 60,
    legal: Infinity,
  },
  FIRM: {
    friendly: 4,
    professional: 11,
    firm: 27,
    formal: 57,
    legal: Infinity,
  },
};

const VULNERABLE_CEILING: ToneLevel = 'professional';

// Companies House statuses that mean "cease all contact"
const CEASE_CONTACT_STATUSES = ['in-administration', 'in-liquidation', 'dissolved'];

// ─── Gate Checks ─────────────────────────────────────────────

interface GateResult {
  pass: boolean;
  holdReason?: string;
  gateNode: string;
  createException?: { type: string; explanation: string; priority: string };
}

function gateSystem(input: DebtorDecisionInput): GateResult {
  if (input.contact.manualBlocked) {
    return { pass: false, holdReason: 'manual_blocked', gateNode: 'SYSTEM' };
  }
  if (input.communicationModeOff) {
    return { pass: false, holdReason: 'communication_mode_off', gateNode: 'SYSTEM' };
  }
  return { pass: true, gateNode: 'SYSTEM' };
}

function gateInvoice(input: DebtorDecisionInput): GateResult {
  const { invoice, totalOutstandingForDebtor, tenantSettings } = input;
  const status = invoice.status.toLowerCase();

  if (['paid', 'void', 'voided', 'deleted', 'draft'].includes(status)) {
    return { pass: false, holdReason: `invoice_status_${status}`, gateNode: 'INVOICE' };
  }
  if (invoice.pauseState) {
    return { pass: false, holdReason: 'invoice_paused', gateNode: 'INVOICE' };
  }
  if (totalOutstandingForDebtor < tenantSettings.minimumChaseThreshold) {
    return { pass: false, holdReason: 'below_minimum_chase_threshold', gateNode: 'INVOICE' };
  }
  return { pass: true, gateNode: 'INVOICE' };
}

function gateCommitment(input: DebtorDecisionInput): GateResult {
  const { invoice, paymentPlanFailureCount, hasActivePaymentPlan } = input;

  // Check active payment plan failures first
  if (paymentPlanFailureCount >= 2) {
    return {
      pass: false,
      holdReason: 'payment_plan_twice_failed',
      gateNode: 'COMMITMENT',
      createException: {
        type: 'payment_plan_twice_failed',
        explanation: 'Two payment plans have failed for this debtor. Manual commercial decision required.',
        priority: 'high',
      },
    };
  }

  // Active PTP date in the future
  if (invoice.promiseToPayDate && invoice.promiseToPayDate > input.now) {
    return { pass: false, holdReason: 'promise_to_pay_active', gateNode: 'COMMITMENT' };
  }

  // Active payment plan
  if (hasActivePaymentPlan) {
    return { pass: false, holdReason: 'active_payment_plan', gateNode: 'COMMITMENT' };
  }

  return { pass: true, gateNode: 'COMMITMENT' };
}

function gateDispute(input: DebtorDecisionInput): GateResult {
  if (input.hasActiveDispute) {
    return { pass: false, holdReason: 'active_dispute', gateNode: 'DISPUTE' };
  }
  if (input.invoice.escalationFlag) {
    return { pass: false, holdReason: 'escalation_flag', gateNode: 'DISPUTE' };
  }
  if (input.invoice.legalFlag) {
    return { pass: false, holdReason: 'legal_flag', gateNode: 'DISPUTE' };
  }
  return { pass: true, gateNode: 'DISPUTE' };
}

function gateLegal(input: DebtorDecisionInput): GateResult {
  const { contact } = input;

  // Companies House status check
  if (contact.companiesHouseStatus &&
      CEASE_CONTACT_STATUSES.includes(contact.companiesHouseStatus.toLowerCase())) {
    return {
      pass: false,
      holdReason: 'administration_detected',
      gateNode: 'LEGAL',
      createException: {
        type: 'cease_all_contact',
        explanation: `Companies House status: ${contact.companiesHouseStatus}. All contact must cease.`,
        priority: 'high',
      },
    };
  }

  // Active legal response window
  if (contact.legalResponseWindowEnd) {
    const windowEnd = new Date(contact.legalResponseWindowEnd);
    // Both active AND expired-unresolved windows block
    if (windowEnd > input.now || windowEnd <= input.now) {
      return { pass: false, holdReason: 'legal_response_window', gateNode: 'LEGAL' };
    }
  }

  return { pass: true, gateNode: 'LEGAL' };
}

function gateProbablePayment(input: DebtorDecisionInput): GateResult {
  const { contact } = input;
  if (contact.probablePaymentDetected &&
      (contact.probablePaymentConfidence === 'high' || contact.probablePaymentConfidence === 'medium')) {
    return { pass: false, holdReason: 'probable_payment_detected', gateNode: 'PROBABLE_PAYMENT' };
  }
  return { pass: true, gateNode: 'PROBABLE_PAYMENT' };
}

function gateContactValidation(input: DebtorDecisionInput): GateResult {
  const { contact } = input;

  if (!contact.email && !contact.phone) {
    return { pass: false, holdReason: 'no_contact_details', gateNode: 'CONTACT_VALIDATION' };
  }
  if (contact.wrongPartyRisk === 'CONFIRMED') {
    return { pass: false, holdReason: 'wrong_party_confirmed', gateNode: 'CONTACT_VALIDATION' };
  }
  return { pass: true, gateNode: 'CONTACT_VALIDATION' };
}

function gateCooldown(input: DebtorDecisionInput): GateResult {
  const { contact, tenantSettings, now } = input;

  // nextTouchNotBefore check
  if (contact.nextTouchNotBefore && new Date(contact.nextTouchNotBefore) > now) {
    return { pass: false, holdReason: 'next_touch_not_before', gateNode: 'COOLDOWN' };
  }

  // Channel cooldown check (last outbound + cooldown days)
  if (contact.lastOutboundAt && contact.lastOutboundChannel) {
    const lastOutbound = new Date(contact.lastOutboundAt);
    const channelKey = contact.lastOutboundChannel.toLowerCase() as 'email' | 'sms' | 'voice';
    const cooldownDays = tenantSettings.channelCooldowns[channelKey] ?? 3;
    const cooldownEnd = new Date(lastOutbound);
    cooldownEnd.setDate(cooldownEnd.getDate() + cooldownDays);

    if (cooldownEnd > now) {
      return { pass: false, holdReason: `channel_cooldown_${channelKey}`, gateNode: 'COOLDOWN' };
    }
  }

  return { pass: true, gateNode: 'COOLDOWN' };
}

function gateUnresolvedInbound(input: DebtorDecisionInput): GateResult {
  // Pre-classify SILENT before this gate — SILENT debtors skip this check
  const isSilent = isSilentDebtor(input);
  if (isSilent) {
    return { pass: true, gateNode: 'UNRESOLVED_INBOUND' };
  }

  if (input.recentInboundUnprocessed) {
    return { pass: false, holdReason: 'unresolved_inbound_message', gateNode: 'UNRESOLVED_INBOUND' };
  }
  return { pass: true, gateNode: 'UNRESOLVED_INBOUND' };
}

/** Helper: pre-classify whether debtor meets SILENT criteria */
function isSilentDebtor(input: DebtorDecisionInput): boolean {
  const { contact, consecutiveNoResponseCount } = input;
  const tenDaysAgo = new Date(input.now);
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  return (
    consecutiveNoResponseCount >= 2 &&
    (!contact.lastInboundAt || new Date(contact.lastInboundAt) < tenDaysAgo) &&
    contact.contactCountLast30d >= 2
  );
}

const GATES = [
  gateSystem,
  gateInvoice,
  gateCommitment,
  gateDispute,
  gateLegal,
  gateProbablePayment,
  gateContactValidation,
  gateCooldown,
  gateUnresolvedInbound,
];

function runGateChecks(input: DebtorDecisionInput): {
  passed: boolean;
  gatesEvaluated: number;
  failedGate?: GateResult;
} {
  for (let i = 0; i < GATES.length; i++) {
    const result = GATES[i](input);
    if (!result.pass) {
      return {
        passed: false,
        gatesEvaluated: i + 1,
        failedGate: result,
      };
    }
  }
  return { passed: true, gatesEvaluated: GATES.length };
}

// ─── Behavioural Category Classification ─────────────────────

type BehaviouralCategory = 'RELIABLE' | 'COMMUNICATIVE' | 'SILENT' | 'UNKNOWN';

function classifyBehaviouralCategory(input: DebtorDecisionInput): { category: BehaviouralCategory; reasoning: string } {
  const { behavior, learningProfile, contact, consecutiveNoResponseCount } = input;

  // 1. UNKNOWN — cold start
  if (behavior.invoiceCount < 3) {
    return {
      category: 'UNKNOWN',
      reasoning: 'New relationship — insufficient payment history for behavioural classification. Using standard treatment.',
    };
  }

  // 2. RELIABLE
  if (
    behavior.invoiceCount >= 3 &&
    (learningProfile.paymentReliability ?? 0) >= 0.7 &&
    behavior.medianDaysToPay != null &&
    behavior.medianDaysToPay <= contact.paymentTerms + 10
  ) {
    return {
      category: 'RELIABLE',
      reasoning: `Reliable payer — ${behavior.invoiceCount} invoices, ${(learningProfile.paymentReliability! * 100).toFixed(0)}% reliability, median ${behavior.medianDaysToPay}d (terms ${contact.paymentTerms}d).`,
    };
  }

  // 3. SILENT
  if (isSilentDebtor(input)) {
    return {
      category: 'SILENT',
      reasoning: `Silent debtor — ${consecutiveNoResponseCount} consecutive unanswered contacts, no inbound in 10+ days, ${contact.contactCountLast30d} outbound in last 30d.`,
    };
  }

  // 4. COMMUNICATIVE
  const fourteenDaysAgo = new Date(input.now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  if (
    (contact.lastInboundAt && new Date(contact.lastInboundAt) > fourteenDaysAgo) ||
    (learningProfile.responsiveness === 'high' || learningProfile.responsiveness === 'medium')
  ) {
    return {
      category: 'COMMUNICATIVE',
      reasoning: 'Communicative debtor — recent inbound or medium/high responsiveness.',
    };
  }

  // 5. Fallback
  return {
    category: 'UNKNOWN',
    reasoning: 'Insufficient behavioural signals for classification. Using standard treatment.',
  };
}

// ─── Phase Selection ─────────────────────────────────────────

function selectPhase(input: DebtorDecisionInput): 'pre_due' | 'inform' | 'elicit_date' {
  const dueDate = new Date(input.invoice.dueDate);
  const daysOverdue = daysBetween(dueDate, input.now);

  if (daysOverdue < 0) {
    // Pre-due: only if amount >= threshold and within window
    const daysUntilDue = -daysOverdue;
    if (
      input.invoice.balance >= input.tenantSettings.preDueDateMinAmount &&
      daysUntilDue <= input.tenantSettings.preDueDateDays
    ) {
      return 'pre_due';
    }
    // Outside pre-due window or below amount — should have been caught by gate, but default to inform
    return 'inform';
  }

  if (daysOverdue <= input.tenantSettings.chaseDelayDays) {
    return 'inform';
  }

  return 'elicit_date';
}

// ─── Tone Selection ──────────────────────────────────────────

function selectTone(
  input: DebtorDecisionInput,
  category: BehaviouralCategory,
  phase: 'pre_due' | 'inform' | 'elicit_date',
): { tone: ToneLevel; reasoning: string } {
  const dueDate = new Date(input.invoice.dueDate);
  const daysOverdue = Math.max(0, daysBetween(dueDate, input.now));
  const { tenantSettings, contact, lastAction, consecutiveNoResponseCount } = input;

  // 1. Base tone from days overdue
  const style = tenantSettings.tenantStyle;
  const thresholds = ESCALATION_THRESHOLDS[style] || ESCALATION_THRESHOLDS.STANDARD;
  let baseTone: ToneLevel = 'friendly';
  for (const tone of TONE_ORDER) {
    if (daysOverdue < thresholds[tone]) {
      baseTone = tone;
      break;
    }
  }

  let tone = baseTone;
  const reasons: string[] = [`Base: ${baseTone} (${daysOverdue}d overdue, ${style} style)`];

  // 2. Category adjustments
  if (category === 'RELIABLE') {
    const maxIdx = TONE_ORDER.indexOf('professional');
    const currentIdx = TONE_ORDER.indexOf(tone);
    if (currentIdx > maxIdx) {
      tone = 'professional';
      reasons.push('RELIABLE cap: capped at professional');
    }
  } else if (category === 'SILENT') {
    const currentIdx = TONE_ORDER.indexOf(tone);
    if (currentIdx < TONE_ORDER.length - 1) {
      tone = TONE_ORDER[currentIdx + 1];
      reasons.push(`SILENT +1: escalated to ${tone}`);
    }
  } else if (category === 'UNKNOWN') {
    // Default warm for unknowns — bias friendly
    if (TONE_ORDER.indexOf(tone) > TONE_ORDER.indexOf('professional')) {
      // Only soften if we're above professional for cold starts
      if (daysOverdue < 30) {
        tone = 'professional';
        reasons.push('UNKNOWN warm default: capped at professional for <30d');
      }
    }
  }

  // 3. Velocity cap: ±1 step from last action tone
  if (lastAction?.agentToneLevel) {
    const lastIdx = TONE_ORDER.indexOf(lastAction.agentToneLevel);
    const currentIdx = TONE_ORDER.indexOf(tone);
    if (lastIdx >= 0) {
      if (currentIdx > lastIdx + 1) {
        tone = TONE_ORDER[lastIdx + 1];
        reasons.push(`Velocity cap: max +1 from ${lastAction.agentToneLevel}`);
      } else if (currentIdx < lastIdx - 1) {
        tone = TONE_ORDER[lastIdx - 1];
        reasons.push(`Velocity cap: max -1 from ${lastAction.agentToneLevel}`);
      }
    }
  }

  // 4. Vulnerability cap
  if (contact.isPotentiallyVulnerable) {
    const maxIdx = TONE_ORDER.indexOf(VULNERABLE_CEILING);
    if (TONE_ORDER.indexOf(tone) > maxIdx) {
      tone = VULNERABLE_CEILING;
      reasons.push(`Vulnerable cap: capped at ${VULNERABLE_CEILING}`);
    }
  }

  // 5. No-response pressure
  if (consecutiveNoResponseCount >= tenantSettings.noResponseEscalationThreshold) {
    const currentIdx = TONE_ORDER.indexOf(tone);
    // Apply +1 within velocity cap (already applied)
    if (lastAction?.agentToneLevel) {
      const lastIdx = TONE_ORDER.indexOf(lastAction.agentToneLevel);
      if (lastIdx >= 0 && currentIdx <= lastIdx && currentIdx < TONE_ORDER.length - 1) {
        tone = TONE_ORDER[currentIdx + 1];
        reasons.push(`No-response pressure: +1 (${consecutiveNoResponseCount} unanswered)`);
      }
    }
  }

  // Pre-due and inform phases shouldn't go above professional
  if (phase === 'pre_due' || phase === 'inform') {
    const maxIdx = TONE_ORDER.indexOf('professional');
    if (TONE_ORDER.indexOf(tone) > maxIdx) {
      tone = 'professional';
      reasons.push(`Phase cap: ${phase} capped at professional`);
    }
  }

  return { tone, reasoning: reasons.join('. ') };
}

// ─── Channel Selection ───────────────────────────────────────

function selectChannel(
  input: DebtorDecisionInput,
  category: BehaviouralCategory,
  tone: ToneLevel,
): { channel: 'email' | 'sms' | 'voice'; reasoning: string } {
  const { contact, channelPrefs, consecutiveNoResponseCount, learningProfile } = input;

  // Build available channels
  const available: Array<'email' | 'sms' | 'voice'> = [];
  if (channelPrefs.emailEnabled && contact.email) available.push('email');
  if (channelPrefs.smsEnabled && contact.phone) available.push('sms');
  if (channelPrefs.voiceEnabled && contact.phone) available.push('voice');

  if (available.length === 0) {
    // Fallback — shouldn't reach here due to gate 7, but defensive
    return { channel: 'email', reasoning: 'No available channels (fallback)' };
  }

  let channel: 'email' | 'sms' | 'voice' = available.includes('email') ? 'email' : available[0];
  const reasons: string[] = [`Default: ${channel}`];

  // Category overrides
  if (category === 'RELIABLE') {
    // RELIABLE always email
    if (available.includes('email')) {
      channel = 'email';
      reasons.push('RELIABLE: always email');
    }
  } else if (category === 'SILENT') {
    const toneIdx = TONE_ORDER.indexOf(tone);
    const firmIdx = TONE_ORDER.indexOf('firm');
    if (toneIdx >= firmIdx && available.includes('voice')) {
      channel = 'voice';
      reasons.push('SILENT + firm+ tone: prefer voice');
    }
  }

  // Escalation by no-response count
  if (consecutiveNoResponseCount >= 2 && contact.lastOutboundChannel?.toLowerCase() === 'email') {
    if (available.includes('sms')) {
      channel = 'sms';
      reasons.push(`Escalation: ${consecutiveNoResponseCount} no-responses after email → SMS`);
    }
  }
  if (consecutiveNoResponseCount >= 4) {
    if (available.includes('voice')) {
      channel = 'voice';
      reasons.push(`Escalation: ${consecutiveNoResponseCount} no-responses → voice`);
    }
  }

  // Effectiveness override: if highest effectiveness channel differs AND confidence high
  const confidence = learningProfile.learningConfidence ?? 0;
  if (confidence > 0.7) {
    const effectivenessMap: Record<string, number> = {
      email: learningProfile.emailEffectiveness,
      sms: learningProfile.smsEffectiveness,
      voice: learningProfile.voiceEffectiveness,
    };
    const currentEffectiveness = effectivenessMap[channel] ?? 0.5;
    if (currentEffectiveness < 0.3) {
      const bestChannel = available
        .map(ch => ({ ch, eff: effectivenessMap[ch] ?? 0.5 }))
        .sort((a, b) => b.eff - a.eff)[0]?.ch;
      if (bestChannel && bestChannel !== channel) {
        reasons.push(`Effectiveness override: ${channel} at ${(currentEffectiveness * 100).toFixed(0)}%, switching to ${bestChannel}`);
        channel = bestChannel;
      }
    }
  }

  return { channel, reasoning: reasons.join('. ') };
}

// ─── Timing Selection ────────────────────────────────────────

function selectTiming(input: DebtorDecisionInput): Date {
  const { now, tenantSettings } = input;
  const [startH, startM] = tenantSettings.businessHoursStart.split(':').map(Number);
  const [endH, endM] = tenantSettings.businessHoursEnd.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    // Within business hours → schedule 1 hour from now
    const scheduled = new Date(now);
    scheduled.setTime(scheduled.getTime() + 60 * 60 * 1000);
    return scheduled;
  }

  if (currentMinutes < startMinutes) {
    // Before business hours today
    const scheduled = new Date(now);
    scheduled.setHours(startH, startM, 0, 0);
    return scheduled;
  }

  // After business hours → next business day start
  const scheduled = new Date(now);
  scheduled.setDate(scheduled.getDate() + 1);
  // Skip weekends
  while (scheduled.getDay() === 0 || scheduled.getDay() === 6) {
    scheduled.setDate(scheduled.getDate() + 1);
  }
  scheduled.setHours(startH, startM, 0, 0);
  return scheduled;
}

// ─── DSO Acceptance Engine ───────────────────────────────────

export function evaluateDSOAcceptance(
  promiseToPayDate: Date,
  invoiceIssueDate: Date,
  dsoContext: DSOContextInput,
  dsoImpactThreshold: number,
): DSOAcceptanceResult {
  const benchmark = Math.max(dsoContext.currentDSO, dsoContext.debtorPaymentTerms);
  const proposedDays = daysBetween(invoiceIssueDate, promiseToPayDate);
  const weight = dsoContext.totalOutstanding > 0
    ? dsoContext.debtorOutstanding / dsoContext.totalOutstanding
    : 0;
  const dsoImpact = weight * (proposedDays - benchmark);

  if (dsoImpact < dsoImpactThreshold) {
    return {
      acceptance: 'ACCEPT',
      dsoImpact,
      partialPaymentNeeded: null,
      naturalFraction: null,
      reasoning: `PTP impact ${dsoImpact.toFixed(2)}d < threshold ${dsoImpactThreshold}d. Acceptable.`,
    };
  }

  // NEGOTIATE
  const rawPartial = dsoContext.debtorOutstanding * (1 - benchmark / proposedDays);
  const rounded = roundPartialPayment(rawPartial);
  const fraction = detectNaturalFraction(rounded, dsoContext.debtorOutstanding);

  return {
    acceptance: 'NEGOTIATE',
    dsoImpact,
    partialPaymentNeeded: rounded,
    naturalFraction: fraction,
    reasoning: `PTP impact ${dsoImpact.toFixed(2)}d >= threshold ${dsoImpactThreshold}d. Suggest partial payment of ${formatGBP(rounded)}${fraction ? ` (~${fraction})` : ''} to bring DSO impact within bounds.`,
  };
}

function roundPartialPayment(amount: number): number {
  if (amount > 5000) {
    return Math.round(amount / 500) * 500;
  }
  return Math.round(amount / 100) * 100;
}

function detectNaturalFraction(
  partial: number,
  total: number,
): '1/2' | '1/3' | '1/4' | null {
  if (total <= 0) return null;
  const ratio = partial / total;
  if (Math.abs(ratio - 0.50) <= 0.05) return '1/2';
  if (Math.abs(ratio - 0.33) <= 0.05) return '1/3';
  if (Math.abs(ratio - 0.25) <= 0.05) return '1/4';
  return null;
}

// ─── Utility ─────────────────────────────────────────────────

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

// ─── Main Entry Point ────────────────────────────────────────

export function evaluateDecisionTree(input: DebtorDecisionInput): DecisionOutput {
  // 1. Run gate checks
  const gateResult = runGateChecks(input);

  if (!gateResult.passed) {
    return {
      action: 'HOLD',
      holdReason: gateResult.failedGate!.holdReason,
      gateNode: gateResult.failedGate!.gateNode,
      gatesEvaluated: gateResult.gatesEvaluated,
      createException: gateResult.failedGate!.createException,
      reasoning: `HOLD at gate ${gateResult.failedGate!.gateNode}: ${gateResult.failedGate!.holdReason}`,
      inputSnapshot: input,
    };
  }

  // 2. Classify behaviour
  const { category, reasoning: categoryReasoning } = classifyBehaviouralCategory(input);

  // 3. Select phase
  const phase = selectPhase(input);

  // 4. Select tone
  const { tone, reasoning: toneReasoning } = selectTone(input, category, phase);

  // 5. DSO acceptance (only when PTP exists and phase is elicit_date)
  let dsoAcceptance: DSOAcceptanceResult | undefined;
  let finalTone = tone;
  let dsoToneOverride = '';
  if (input.invoice.promiseToPayDate && phase === 'elicit_date') {
    dsoAcceptance = evaluateDSOAcceptance(
      new Date(input.invoice.promiseToPayDate),
      new Date(input.invoice.issueDate),
      input.dsoContext,
      input.tenantSettings.dsoImpactThreshold,
    );
    if (dsoAcceptance.acceptance === 'NEGOTIATE') {
      finalTone = 'professional';
      dsoToneOverride = 'DSO negotiation — collaborative tone override to professional.';
    }
  }

  // 6. Select channel
  const { channel, reasoning: channelReasoning } = selectChannel(input, category, finalTone);

  // 7. Select timing
  const scheduledFor = selectTiming(input);

  // 8. Build reasoning
  const reasoningParts = [
    `Category: ${category} — ${categoryReasoning}`,
    `Phase: ${phase}`,
    `Tone: ${toneReasoning}`,
    dsoToneOverride,
    dsoAcceptance ? `DSO: ${dsoAcceptance.reasoning}` : '',
    `Channel: ${channelReasoning}`,
    `Scheduled: ${scheduledFor.toISOString()}`,
  ].filter(Boolean);

  return {
    action: 'CONTACT',
    gatesEvaluated: gateResult.gatesEvaluated,
    behaviouralCategory: category,
    phase,
    tone: finalTone,
    channel,
    scheduledFor,
    dsoAcceptance,
    reasoning: reasoningParts.join(' | '),
    inputSnapshot: input,
  };
}
