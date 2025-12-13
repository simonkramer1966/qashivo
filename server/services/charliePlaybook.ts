import { ToneProfile, VoiceTone, TemplateId } from "./playbookEngine";
import { CharlieInvoiceState } from "./invoiceStateMachine";
import { CharlieChannel, CustomerSegment, CharlieDecision } from "./charlieDecisionEngine";

/**
 * Charlie Playbook System
 * 
 * Contains:
 * - Message templates for email, SMS, and voice
 * - Cadence rules (timing between contacts)
 * - Template selection based on state/segment/tone
 * 
 * All templates follow Charlie requirements:
 * - Clear subject lines
 * - One ask per message
 * - Remove emotion, keep facts
 * - Tone progression from friendly → firm → formal
 */

// ============================================================================
// CADENCE CONFIGURATION
// ============================================================================

export interface CadenceRule {
  channel: CharlieChannel;
  minDaysBetweenContacts: number;
  maxContactsPerWeek: number;
  businessHoursOnly: boolean;
  preferredDays: number[];  // 0=Sunday, 1=Monday, etc.
  preferredHoursStart: number;  // 9 = 9am
  preferredHoursEnd: number;    // 17 = 5pm
}

export const DEFAULT_CADENCE: Record<CharlieChannel, CadenceRule> = {
  email: {
    channel: 'email',
    minDaysBetweenContacts: 3,
    maxContactsPerWeek: 3,
    businessHoursOnly: true,
    preferredDays: [1, 2, 3, 4, 5],  // Monday-Friday
    preferredHoursStart: 9,
    preferredHoursEnd: 17,
  },
  sms: {
    channel: 'sms',
    minDaysBetweenContacts: 2,
    maxContactsPerWeek: 2,
    businessHoursOnly: true,
    preferredDays: [1, 2, 3, 4, 5],
    preferredHoursStart: 10,
    preferredHoursEnd: 16,
  },
  voice: {
    channel: 'voice',
    minDaysBetweenContacts: 5,
    maxContactsPerWeek: 1,
    businessHoursOnly: true,
    preferredDays: [2, 3, 4],  // Tue-Thu for calls
    preferredHoursStart: 10,
    preferredHoursEnd: 15,
  },
  none: {
    channel: 'none',
    minDaysBetweenContacts: 0,
    maxContactsPerWeek: 0,
    businessHoursOnly: false,
    preferredDays: [],
    preferredHoursStart: 0,
    preferredHoursEnd: 0,
  },
};

export interface SegmentCadenceOverrides {
  segment: CustomerSegment;
  channelOverrides: Partial<Record<CharlieChannel, Partial<CadenceRule>>>;
}

export const SEGMENT_CADENCE_OVERRIDES: SegmentCadenceOverrides[] = [
  {
    segment: 'new_customer',
    channelOverrides: {
      email: { minDaysBetweenContacts: 2 },  // Tighter follow-up for new customers
      voice: { 
        minDaysBetweenContacts: 3,
        preferredDays: [1, 2, 3, 4, 5],  // Mon-Fri only for new customers
        preferredHoursStart: 10,
        preferredHoursEnd: 16,
      },
    },
  },
  {
    segment: 'chronic_late_payer',
    channelOverrides: {
      email: { minDaysBetweenContacts: 2, maxContactsPerWeek: 4 },
      sms: { minDaysBetweenContacts: 2, maxContactsPerWeek: 3 },
      voice: { 
        minDaysBetweenContacts: 3,
        maxContactsPerWeek: 2,
        preferredHoursStart: 9,  // Earlier calls for chronic payers
        preferredHoursEnd: 17,
      },
    },
  },
  {
    segment: 'good_payer',
    channelOverrides: {
      email: { minDaysBetweenContacts: 5, maxContactsPerWeek: 2 },  // More relaxed for good payers
      sms: { minDaysBetweenContacts: 4, maxContactsPerWeek: 1 },
      voice: { 
        minDaysBetweenContacts: 7, 
        maxContactsPerWeek: 1,
        preferredDays: [2, 3, 4],  // Mid-week only
      },
    },
  },
  {
    segment: 'enterprise',
    channelOverrides: {
      email: { 
        maxContactsPerWeek: 2,
        preferredHoursStart: 9,  // Standard business hours
        preferredHoursEnd: 17,
      },
      voice: { 
        minDaysBetweenContacts: 7, 
        maxContactsPerWeek: 1,
        preferredDays: [2, 3, 4],  // Tue-Thu for enterprise
        preferredHoursStart: 10,
        preferredHoursEnd: 15,
      },
    },
  },
  {
    segment: 'small_business',
    channelOverrides: {
      voice: { 
        preferredHoursStart: 9,  // Earlier start for small business owners
        preferredHoursEnd: 17,
        preferredDays: [1, 2, 3, 4, 5],  // All weekdays
      },
      sms: { maxContactsPerWeek: 3 },  // SMS more effective for small business
    },
  },
];

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

export interface EmailTemplate {
  templateId: TemplateId;
  toneProfile: ToneProfile;
  subject: string;
  body: string;
  variables: string[];  // Required variables like {{contactName}}, {{invoiceTotal}}, etc.
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // FRIENDLY REMINDER (Pre-due / Just overdue)
  {
    templateId: TemplateId.EMAIL_FRIENDLY_REMINDER,
    toneProfile: ToneProfile.CREDIT_CONTROL_FRIENDLY,
    subject: "Friendly reminder: Invoice {{invoiceNumber}} - {{companyName}}",
    body: `Dear {{contactName}},

I hope this message finds you well.

I wanted to check in regarding invoice {{invoiceNumber}} for {{invoiceTotal}}, which {{dueDateContext}}.

Could you kindly confirm this is scheduled for payment? If there's anything you need from our side to process this, please let me know.

Here's a summary of the outstanding amount:
{{invoiceSummary}}

Payment can be made to:
{{paymentDetails}}

Thank you for your continued business.

Best regards,
{{senderName}}
{{senderCompany}}`,
    variables: ['contactName', 'invoiceNumber', 'invoiceTotal', 'dueDateContext', 'invoiceSummary', 'paymentDetails', 'senderName', 'senderCompany'],
  },

  // FIRM REMINDER (14-30 days)
  {
    templateId: TemplateId.EMAIL_FIRM_REMINDER,
    toneProfile: ToneProfile.CREDIT_CONTROL_FIRM,
    subject: "Payment required: Invoice {{invoiceNumber}} now {{daysOverdue}} days overdue",
    body: `Dear {{contactName}},

I'm following up on invoice {{invoiceNumber}} for {{invoiceTotal}}, which is now {{daysOverdue}} days past due.

We've previously contacted you regarding this invoice but haven't yet received payment or confirmation of when we can expect it.

Please reply with a confirmed payment date by end of business today.

If there's an issue preventing payment, please let me know so we can work to resolve it.

Outstanding balance:
{{invoiceSummary}}

Payment details:
{{paymentDetails}}

Regards,
{{senderName}}
{{senderCompany}}`,
    variables: ['contactName', 'invoiceNumber', 'invoiceTotal', 'daysOverdue', 'invoiceSummary', 'paymentDetails', 'senderName', 'senderCompany'],
  },

  // RECOVERY FORMAL REMINDER (90+ days)
  {
    templateId: TemplateId.RECOVERY_EMAIL_FORMAL_REMINDER,
    toneProfile: ToneProfile.RECOVERY_FORMAL_FIRM,
    subject: "URGENT: Overdue account requires immediate attention - {{companyName}}",
    body: `Dear {{contactName}},

Your account with {{senderCompany}} is now significantly overdue and requires immediate attention.

Despite our previous correspondence, invoice {{invoiceNumber}} for {{invoiceTotal}} remains unpaid. This invoice is now {{daysOverdue}} days past the due date.

We must receive payment or a confirmed payment arrangement by {{deadlineDate}}.

If we do not hear from you by this date, we may need to consider further action to recover this debt, which neither party would prefer.

Total overdue: {{invoiceTotal}}
Invoice reference: {{invoiceNumber}}
Original due date: {{dueDate}}

Please contact us immediately to discuss this matter.

Regards,
{{senderName}}
{{senderCompany}}`,
    variables: ['contactName', 'senderCompany', 'invoiceNumber', 'invoiceTotal', 'daysOverdue', 'deadlineDate', 'dueDate', 'senderName'],
  },

  // STATUTORY INTEREST INFO (Late payment legislation)
  {
    templateId: TemplateId.RECOVERY_EMAIL_INTEREST_AND_COSTS_INFO,
    toneProfile: ToneProfile.RECOVERY_FORMAL_FIRM,
    subject: "Statutory interest accruing on overdue invoice {{invoiceNumber}}",
    body: `Dear {{contactName}},

We write to inform you that under the Late Payment of Commercial Debts (Interest) Act 1998, statutory interest is now accruing on your overdue balance.

Invoice details:
- Invoice number: {{invoiceNumber}}
- Original amount: {{originalAmount}}
- Days overdue: {{daysOverdue}}
- Statutory interest accrued: {{interestAmount}}
- Fixed compensation: {{compensationAmount}}
- Total now due: {{totalDue}}

This interest continues to accrue at 8% above the Bank of England base rate until payment is received.

To stop further interest accumulating and avoid additional recovery costs, please arrange immediate payment.

Regards,
{{senderName}}
{{senderCompany}}`,
    variables: ['contactName', 'invoiceNumber', 'originalAmount', 'daysOverdue', 'interestAmount', 'compensationAmount', 'totalDue', 'senderName', 'senderCompany'],
  },
];

// ============================================================================
// SMS TEMPLATES
// ============================================================================

export interface SmsTemplate {
  templateId: TemplateId;
  toneProfile: ToneProfile;
  message: string;
  maxLength: number;  // SMS character limits
  variables: string[];
}

export const SMS_TEMPLATES: SmsTemplate[] = [
  // OVERDUE REMINDER
  {
    templateId: TemplateId.SMS_OVERDUE_REMINDER,
    toneProfile: ToneProfile.CREDIT_CONTROL_FRIENDLY,
    message: "Hi {{contactName}}, quick reminder that invoice {{invoiceNumber}} ({{invoiceTotal}}) is now overdue. Can you confirm when we can expect payment? Reply or call {{contactNumber}}. Thanks, {{senderCompany}}",
    maxLength: 160,
    variables: ['contactName', 'invoiceNumber', 'invoiceTotal', 'contactNumber', 'senderCompany'],
  },

  // PTP CHASE
  {
    templateId: TemplateId.SMS_PTP_CHASE,
    toneProfile: ToneProfile.CREDIT_CONTROL_FIRM,
    message: "Hi {{contactName}}, we haven't received the payment promised for {{promisedDate}}. Invoice {{invoiceNumber}} ({{invoiceTotal}}) remains unpaid. Please confirm new payment date today. {{senderCompany}}",
    maxLength: 160,
    variables: ['contactName', 'promisedDate', 'invoiceNumber', 'invoiceTotal', 'senderCompany'],
  },

  // ESCALATED REMINDER
  {
    templateId: TemplateId.SMS_ESCALATED_REMINDER,
    toneProfile: ToneProfile.CREDIT_CONTROL_FIRM,
    message: "URGENT: Invoice {{invoiceNumber}} ({{invoiceTotal}}) is now {{daysOverdue}} days overdue. Please call {{contactNumber}} today to discuss payment or face further action. {{senderCompany}}",
    maxLength: 160,
    variables: ['invoiceNumber', 'invoiceTotal', 'daysOverdue', 'contactNumber', 'senderCompany'],
  },
];

// ============================================================================
// VOICE CALL SCRIPTS
// ============================================================================

export interface VoiceScript {
  templateId: TemplateId;
  voiceTone: VoiceTone;
  openingScript: string;
  keyPoints: string[];
  objectionHandlers: Record<string, string>;
  closingScript: string;
  variables: string[];
}

export const VOICE_SCRIPTS: VoiceScript[] = [
  // PTP CHASE CALL
  {
    templateId: TemplateId.VOICE_PTP_CHASE,
    voiceTone: VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE,
    openingScript: "Hello, this is Charlie calling from {{senderCompany}} regarding your account. Am I speaking with {{contactName}}?",
    keyPoints: [
      "I'm calling about a payment that was promised for {{promisedDate}} but hasn't arrived yet",
      "The invoice {{invoiceNumber}} for {{invoiceTotal}} is now {{daysOverdue}} days overdue",
      "We need to understand what happened and get a new commitment today",
      "Can you confirm when you'll be able to make this payment?",
    ],
    objectionHandlers: {
      "payment_in_progress": "That's great to hear. Can you provide a reference number or the date the payment was sent so we can track it?",
      "cash_flow_issue": "I understand cash flow can be challenging. Can we discuss a payment plan? What amount could you commit to this week?",
      "dispute": "I understand there's a concern. Let me note the details so we can investigate. What specifically is the issue?",
      "wrong_person": "I apologize for any confusion. Could you direct me to the right person for accounts payable?",
      "not_received_invoice": "I can resend that right away. What email address should I use, and who should it be addressed to?",
    },
    closingScript: "Thank you for your time. To confirm, you've committed to paying {{committedAmount}} by {{committedDate}}. I'll send a follow-up email confirming this. Is there anything else you need from us?",
    variables: ['senderCompany', 'contactName', 'promisedDate', 'invoiceNumber', 'invoiceTotal', 'daysOverdue', 'committedAmount', 'committedDate'],
  },

  // PTP REQUEST CALL (First PTP request)
  {
    templateId: TemplateId.VOICE_PTP_REQUEST,
    voiceTone: VoiceTone.VOICE_TONE_CALM_COLLABORATIVE,
    openingScript: "Hello, this is Charlie calling from {{senderCompany}}. Am I speaking with {{contactName}}? I'm calling about invoice {{invoiceNumber}} which is now overdue.",
    keyPoints: [
      "The invoice for {{invoiceTotal}} was due on {{dueDate}} and is now {{daysOverdue}} days overdue",
      "I wanted to check if there's anything preventing payment",
      "Can you confirm when this will be paid?",
      "If there are any issues, I'd like to help resolve them",
    ],
    objectionHandlers: {
      "payment_in_progress": "That's good news. Do you have an expected date for when the payment will clear?",
      "cash_flow_issue": "I understand. What's a realistic date you could commit to? Even a partial payment would help.",
      "dispute": "Let me understand the concern so we can address it. What's the specific issue?",
      "needs_approval": "I understand there's an approval process. Who needs to approve this, and by when can we expect that?",
      "missing_po": "I can help with that. What PO number should be on the invoice? I'll update it immediately.",
    },
    closingScript: "Thank you for clarifying. So you're confirming payment of {{committedAmount}} by {{committedDate}}. I'll email you a confirmation. Is there anything else needed to process this?",
    variables: ['senderCompany', 'contactName', 'invoiceNumber', 'invoiceTotal', 'dueDate', 'daysOverdue', 'committedAmount', 'committedDate'],
  },

  // ESCALATED REMINDER CALL
  {
    templateId: TemplateId.VOICE_ESCALATED_REMINDER,
    voiceTone: VoiceTone.VOICE_TONE_FORMAL_RECOVERY,
    openingScript: "Hello, this is Charlie calling from {{senderCompany}}. I need to speak with {{contactName}} regarding an urgent matter with your account.",
    keyPoints: [
      "Invoice {{invoiceNumber}} for {{invoiceTotal}} is now seriously overdue at {{daysOverdue}} days",
      "We've contacted you several times without a resolution",
      "This matter needs to be resolved today to avoid further action",
      "What is preventing payment from being made?",
    ],
    objectionHandlers: {
      "payment_in_progress": "Given the history, I need specifics. What's the payment reference and exact date it was processed?",
      "cash_flow_issue": "We've reached a point where we need a concrete plan. What's the maximum you can pay this week?",
      "dispute": "If there's a genuine dispute, we need to address it separately. The undisputed portion still needs to be paid.",
      "avoiding": "I understand this may be difficult, but ignoring it will only make things worse. Let's work out a solution now.",
    },
    closingScript: "To be clear, without payment or a firm commitment by {{deadlineDate}}, we'll need to consider further recovery action. You've committed to {{committedAmount}} by {{committedDate}}. I'll confirm this in writing.",
    variables: ['senderCompany', 'contactName', 'invoiceNumber', 'invoiceTotal', 'daysOverdue', 'deadlineDate', 'committedAmount', 'committedDate'],
  },

  // RECOVERY FORMAL CALL
  {
    templateId: TemplateId.RECOVERY_VOICE_FORMAL_CALL,
    voiceTone: VoiceTone.VOICE_TONE_FORMAL_RECOVERY,
    openingScript: "Hello, this is Charlie calling from {{senderCompany}}. I need to speak with {{contactName}} or the person responsible for accounts payable regarding a seriously overdue account.",
    keyPoints: [
      "Your account is now over 90 days past due with a balance of {{invoiceTotal}}",
      "This has reached a stage where we must discuss immediate resolution",
      "We'd prefer to resolve this directly rather than involving third parties",
      "What can be done to settle this account today?",
    ],
    objectionHandlers: {
      "payment_in_progress": "I'll need evidence of that payment to halt any further action. Can you email proof of payment to us today?",
      "cash_flow_issue": "At this stage, we need a formal payment arrangement. Can you commit to at least {{minimumPayment}} weekly?",
      "dispute": "Any dispute should have been raised earlier. Please put your concerns in writing and we'll review. Meanwhile, undisputed amounts remain payable.",
      "not_paying": "I need to make you aware that continued non-payment will result in the matter being referred for formal recovery, which may affect your business credit rating.",
    },
    closingScript: "I've noted your commitment to {{committedAmount}} by {{committedDate}}. If this isn't met, the account will be escalated. You'll receive written confirmation of today's discussion.",
    variables: ['senderCompany', 'contactName', 'invoiceTotal', 'minimumPayment', 'committedAmount', 'committedDate'],
  },
];

// ============================================================================
// TEMPLATE SELECTION
// ============================================================================

export interface TemplateContext {
  contactName: string;
  companyName: string;
  invoiceNumber: string;
  invoiceTotal: string;
  dueDate: string;
  daysOverdue: number;
  dueDateContext: string;  // "was due on X" or "is due on X"
  invoiceSummary: string;
  paymentDetails: string;
  senderName: string;
  senderCompany: string;
  contactNumber: string;
  promisedDate?: string;
  deadlineDate?: string;
  originalAmount?: string;
  interestAmount?: string;
  compensationAmount?: string;
  totalDue?: string;
  committedAmount?: string;
  committedDate?: string;
  minimumPayment?: string;
}

export function selectEmailTemplate(
  templateId: TemplateId,
  toneProfile: ToneProfile
): EmailTemplate | null {
  return EMAIL_TEMPLATES.find(t => t.templateId === templateId) || 
         EMAIL_TEMPLATES.find(t => t.toneProfile === toneProfile) ||
         null;
}

export function selectSmsTemplate(
  templateId: TemplateId,
  toneProfile: ToneProfile
): SmsTemplate | null {
  return SMS_TEMPLATES.find(t => t.templateId === templateId) ||
         SMS_TEMPLATES.find(t => t.toneProfile === toneProfile) ||
         null;
}

export function selectVoiceScript(
  templateId: TemplateId,
  voiceTone: VoiceTone
): VoiceScript | null {
  return VOICE_SCRIPTS.find(t => t.templateId === templateId) ||
         VOICE_SCRIPTS.find(t => t.voiceTone === voiceTone) ||
         null;
}

/**
 * Render a template string with variable substitution
 * 
 * @param template - Template string with {{variable}} placeholders
 * @param context - Context object with variable values
 * @returns Rendered string, or null if template is empty or has unresolved required placeholders
 */
export function renderTemplate(template: string, context: Partial<TemplateContext>): string | null {
  if (!template || template.trim() === '') {
    return null;  // Empty template
  }
  
  let rendered = template;
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }
  }
  
  // Check for critical unresolved placeholders that would break the message
  const criticalPlaceholders = ['contactName', 'invoiceNumber', 'invoiceTotal'];
  for (const placeholder of criticalPlaceholders) {
    if (rendered.includes(`{{${placeholder}}}`)) {
      console.warn(`Template has unresolved critical placeholder: {{${placeholder}}}`);
      return null;  // Critical data missing
    }
  }
  
  return rendered;
}

// ============================================================================
// DECISION TO MESSAGE MAPPER
// ============================================================================

export interface PreparedMessage {
  channel: CharlieChannel;
  templateId: TemplateId;
  toneProfile: ToneProfile;
  subject?: string;  // Email only
  body: string;
  voiceScript?: VoiceScript;  // Voice only
  context: Partial<TemplateContext>;
}

export function prepareMessageFromDecision(
  decision: CharlieDecision,
  tenantConfig: {
    companyName: string;
    senderName: string;
    contactNumber: string;
    paymentDetails: string;
  }
): PreparedMessage | null {
  const channel = decision.recommendedChannel;
  if (channel === 'none') return null;

  const context: Partial<TemplateContext> = {
    contactName: decision.contact.name,
    companyName: tenantConfig.companyName,
    invoiceNumber: decision.invoice.invoiceNumber,
    invoiceTotal: formatCurrency(decision.invoice.amount),
    dueDate: formatDate(decision.invoice.dueDate),
    daysOverdue: decision.invoice.daysOverdue,
    dueDateContext: decision.invoice.daysOverdue > 0 
      ? `was due on ${formatDate(decision.invoice.dueDate)}` 
      : `is due on ${formatDate(decision.invoice.dueDate)}`,
    senderName: tenantConfig.senderName,
    senderCompany: tenantConfig.companyName,
    contactNumber: tenantConfig.contactNumber,
    paymentDetails: tenantConfig.paymentDetails,
    invoiceSummary: `Invoice ${decision.invoice.invoiceNumber}: ${formatCurrency(decision.invoice.amount)}`,
    deadlineDate: formatDate(addDays(new Date(), 7)),
  };

  // Derive tone from state and escalation status
  const toneProfile = deriveToneFromState(decision.charlieState, decision.shouldEscalate);
  const templateId = mapStateToTemplateId(decision.charlieState, toneProfile, channel);

  if (channel === 'email') {
    const template = selectEmailTemplate(templateId, toneProfile);
    if (!template) return null;
    
    const subject = renderTemplate(template.subject, context);
    const body = renderTemplate(template.body, context);
    
    // Return null if critical template rendering failed
    if (!body) {
      console.warn(`Failed to render email body for invoice ${decision.invoice.invoiceNumber}`);
      return null;
    }
    
    return {
      channel,
      templateId: template.templateId,
      toneProfile: template.toneProfile,
      subject: subject || `Payment reminder: Invoice ${decision.invoice.invoiceNumber}`,  // Fallback subject
      body,
      context,
    };
  }

  if (channel === 'sms') {
    const template = selectSmsTemplate(templateId, toneProfile);
    if (!template) return null;

    const body = renderTemplate(template.message, context);
    
    // Return null if template rendering failed
    if (!body) {
      console.warn(`Failed to render SMS for invoice ${decision.invoice.invoiceNumber}`);
      return null;
    }

    return {
      channel,
      templateId: template.templateId,
      toneProfile: template.toneProfile,
      body,
      context,
    };
  }

  if (channel === 'voice') {
    const voiceTone = deriveVoiceToneFromState(decision.charlieState, decision.shouldEscalate);
    const script = selectVoiceScript(templateId, voiceTone);
    if (!script) return null;

    const body = renderTemplate(script.openingScript, context);
    
    // Return null if template rendering failed
    if (!body) {
      console.warn(`Failed to render voice script for invoice ${decision.invoice.invoiceNumber}`);
      return null;
    }

    return {
      channel,
      templateId: script.templateId,
      toneProfile,
      body,
      voiceScript: script,
      context,
    };
  }

  return null;
}

function deriveToneFromState(state: CharlieInvoiceState, shouldEscalate: boolean): ToneProfile {
  if (state === 'debt_recovery' || state === 'final_demand') {
    return ToneProfile.RECOVERY_FORMAL_FIRM;
  }
  if (state === 'ptp_missed' || shouldEscalate) {
    return ToneProfile.CREDIT_CONTROL_FIRM;
  }
  if (state === 'overdue') {
    return ToneProfile.CREDIT_CONTROL_FRIENDLY;
  }
  return ToneProfile.CREDIT_CONTROL_FRIENDLY;
}

function deriveVoiceToneFromState(state: CharlieInvoiceState, shouldEscalate: boolean): VoiceTone {
  if (state === 'debt_recovery' || state === 'final_demand') {
    return VoiceTone.VOICE_TONE_FORMAL_RECOVERY;
  }
  if (state === 'ptp_missed' || shouldEscalate) {
    return VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE;
  }
  return VoiceTone.VOICE_TONE_CALM_COLLABORATIVE;
}

function mapStateToTemplateId(
  state: CharlieInvoiceState,
  toneProfile: ToneProfile,
  channel: CharlieChannel
): TemplateId {
  // Missed PTP states
  if (state === 'ptp_missed') {
    if (channel === 'voice') return TemplateId.VOICE_PTP_CHASE;
    if (channel === 'sms') return TemplateId.SMS_PTP_CHASE;
    return TemplateId.EMAIL_FIRM_REMINDER;
  }

  // Recovery stage
  if (state === 'final_demand' || state === 'debt_recovery') {
    if (channel === 'voice') return TemplateId.RECOVERY_VOICE_FORMAL_CALL;
    return TemplateId.RECOVERY_EMAIL_FORMAL_REMINDER;
  }

  // Based on tone profile
  if (toneProfile === ToneProfile.RECOVERY_FORMAL_FIRM) {
    if (channel === 'voice') return TemplateId.RECOVERY_VOICE_FORMAL_CALL;
    return TemplateId.RECOVERY_EMAIL_FORMAL_REMINDER;
  }

  if (toneProfile === ToneProfile.CREDIT_CONTROL_FIRM) {
    if (channel === 'voice') return TemplateId.VOICE_PTP_REQUEST;
    if (channel === 'sms') return TemplateId.SMS_ESCALATED_REMINDER;
    return TemplateId.EMAIL_FIRM_REMINDER;
  }

  // Default friendly
  if (channel === 'voice') return TemplateId.VOICE_PTP_REQUEST;
  if (channel === 'sms') return TemplateId.SMS_OVERDUE_REMINDER;
  return TemplateId.EMAIL_FRIENDLY_REMINDER;
}

// ============================================================================
// CADENCE HELPERS
// ============================================================================

export function getCadenceForSegment(
  segment: CustomerSegment,
  channel: CharlieChannel
): CadenceRule {
  const baseCadence = DEFAULT_CADENCE[channel];
  
  const override = SEGMENT_CADENCE_OVERRIDES.find(o => o.segment === segment);
  if (!override || !override.channelOverrides[channel]) {
    return baseCadence;
  }

  return {
    ...baseCadence,
    ...override.channelOverrides[channel],
  };
}

/**
 * Check if contact is within cadence rules
 * 
 * @param lastContactDate - Date of last contact (null if never contacted)
 * @param channel - Communication channel
 * @param segment - Customer segment
 * @param weeklyContactCount - Number of contacts made this week (0-7 days ago)
 * @returns true if contact is allowed within cadence rules
 */
export function isWithinCadence(
  lastContactDate: Date | null,
  channel: CharlieChannel,
  segment: CustomerSegment,
  weeklyContactCount: number = 0
): boolean {
  const cadence = getCadenceForSegment(segment, channel);
  
  // Rule 1: Check maxContactsPerWeek limit
  if (weeklyContactCount >= cadence.maxContactsPerWeek) {
    return false;  // Weekly limit exceeded
  }
  
  // Rule 2: Check minimum days between contacts
  if (!lastContactDate) {
    return true;  // No prior contact, within cadence
  }

  const daysSinceContact = Math.floor(
    (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceContact >= cadence.minDaysBetweenContacts;
}

export function getNextContactDate(
  lastContactDate: Date | null,
  channel: CharlieChannel,
  segment: CustomerSegment
): Date {
  const cadence = getCadenceForSegment(segment, channel);
  
  if (!lastContactDate) {
    return getNextBusinessHour(new Date(), cadence);
  }

  const minNextDate = addDays(lastContactDate, cadence.minDaysBetweenContacts);
  return getNextBusinessHour(minNextDate, cadence);
}

function getNextBusinessHour(date: Date, cadence: CadenceRule): Date {
  const result = new Date(date);
  
  if (!cadence.businessHoursOnly) return result;

  // Move to preferred hours
  if (result.getHours() < cadence.preferredHoursStart) {
    result.setHours(cadence.preferredHoursStart, 0, 0, 0);
  } else if (result.getHours() >= cadence.preferredHoursEnd) {
    result.setDate(result.getDate() + 1);
    result.setHours(cadence.preferredHoursStart, 0, 0, 0);
  }

  // Move to preferred day
  while (!cadence.preferredDays.includes(result.getDay())) {
    result.setDate(result.getDate() + 1);
    result.setHours(cadence.preferredHoursStart, 0, 0, 0);
  }

  return result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// EXPORT CHARLIE PLAYBOOK
// ============================================================================

export const charliePlaybook = {
  selectEmailTemplate,
  selectSmsTemplate,
  selectVoiceScript,
  renderTemplate,
  prepareMessageFromDecision,
  getCadenceForSegment,
  isWithinCadence,
  getNextContactDate,
  DEFAULT_CADENCE,
  SEGMENT_CADENCE_OVERRIDES,
  EMAIL_TEMPLATES,
  SMS_TEMPLATES,
  VOICE_SCRIPTS,
};
