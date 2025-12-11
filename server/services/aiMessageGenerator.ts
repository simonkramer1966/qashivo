/**
 * AI Message Generator Service
 * 
 * Uses OpenAI to generate personalized collection messages for email, SMS, and voice scripts.
 * Messages are tailored based on:
 * - Playbook stage (Credit Control, Recovery, Legal)
 * - Tone profile (Friendly, Firm, Formal)
 * - Customer context (payment history, previous communications)
 * - Invoice details (amount, days overdue)
 */

import OpenAI from "openai";
import { ToneProfile, PlaybookStage, ReasonCode, TemplateId } from "./playbookEngine";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageContext {
  customerName: string;
  companyName?: string;
  invoiceNumber: string;
  invoiceAmount: number;
  currency?: string;
  dueDate: Date;
  daysOverdue: number;
  totalOutstanding?: number;
  invoiceCount?: number;
  previousContactCount?: number;
  lastContactDate?: Date;
  lastContactChannel?: string;
  hasPromiseToPay?: boolean;
  promiseToPayDate?: Date;
  promiseToPayMissed?: boolean;
  isHighValue?: boolean;
  isVip?: boolean;
  hasDispute?: boolean;
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  paymentLink?: string;
}

export interface ToneSettings {
  stage: PlaybookStage;
  toneProfile: ToneProfile;
  reasonCode?: ReasonCode;
  templateId?: TemplateId;
  tenantStyle?: 'GENTLE' | 'STANDARD' | 'FIRM';
  useLatePaymentLegislation?: boolean;
}

export interface GeneratedMessage {
  subject?: string;
  body: string;
  callToAction?: string;
  voiceScript?: string;
}

class AIMessageGenerator {
  private readonly MODEL = "gpt-4o-mini";

  /**
   * Generate a personalized email message
   */
  async generateEmail(
    context: MessageContext,
    toneSettings: ToneSettings
  ): Promise<GeneratedMessage> {
    const systemPrompt = this.buildEmailSystemPrompt(toneSettings);
    const userPrompt = this.buildEmailUserPrompt(context, toneSettings);

    try {
      const response = await openai.chat.completions.create({
        model: this.MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        subject: result.subject || this.getDefaultSubject(context, toneSettings),
        body: result.body || this.getDefaultEmailBody(context, toneSettings),
        callToAction: result.callToAction
      };
    } catch (error) {
      console.error('AI email generation failed, using fallback:', error);
      return this.getFallbackEmail(context, toneSettings);
    }
  }

  /**
   * Generate a personalized SMS message
   */
  async generateSMS(
    context: MessageContext,
    toneSettings: ToneSettings
  ): Promise<GeneratedMessage> {
    const systemPrompt = this.buildSMSSystemPrompt(toneSettings);
    const userPrompt = this.buildSMSUserPrompt(context, toneSettings);

    try {
      const response = await openai.chat.completions.create({
        model: this.MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        body: result.body || this.getDefaultSMSBody(context, toneSettings)
      };
    } catch (error) {
      console.error('AI SMS generation failed, using fallback:', error);
      return this.getFallbackSMS(context, toneSettings);
    }
  }

  /**
   * Generate a personalized voice call script for Retell AI
   */
  async generateVoiceScript(
    context: MessageContext,
    toneSettings: ToneSettings
  ): Promise<GeneratedMessage> {
    const systemPrompt = this.buildVoiceSystemPrompt(toneSettings);
    const userPrompt = this.buildVoiceUserPrompt(context, toneSettings);

    try {
      const response = await openai.chat.completions.create({
        model: this.MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        voiceScript: result.voiceScript || this.getDefaultVoiceScript(context, toneSettings),
        body: result.voiceScript || ''
      };
    } catch (error) {
      console.error('AI voice script generation failed, using fallback:', error);
      return this.getFallbackVoiceScript(context, toneSettings);
    }
  }

  private buildEmailSystemPrompt(toneSettings: ToneSettings): string {
    const toneDescriptions: Record<ToneProfile, string> = {
      CREDIT_CONTROL_FRIENDLY: "warm, helpful, and understanding. Use a conversational tone that maintains a positive relationship while gently reminding about payment.",
      CREDIT_CONTROL_FIRM: "professional and direct, while remaining respectful. Clearly communicate the urgency without being aggressive.",
      RECOVERY_FORMAL_FIRM: "formal and serious. This is for overdue accounts requiring escalated attention. Be clear about consequences while remaining professional.",
      LEGAL_ESCALATION_INFO: "highly formal and legally precise. Reference statutory rights and potential legal implications clearly."
    };

    const tone = toneDescriptions[toneSettings.toneProfile] || toneDescriptions.CREDIT_CONTROL_FRIENDLY;

    return `You are a professional credit control specialist writing collection emails for UK businesses.

Your tone should be ${tone}

Guidelines:
- Write in British English
- Be concise but complete
- Include a clear call to action
- Never be threatening or aggressive
- Maintain professionalism at all times
- Reference invoice details naturally
- If there's a payment link, include it
- For Recovery stage, mention the seriousness but offer a path to resolution
${toneSettings.useLatePaymentLegislation ? "- You may reference the Late Payment of Commercial Debts (Interest) Act 1998 if appropriate" : ""}

Respond with valid JSON containing:
{
  "subject": "Email subject line",
  "body": "Full email body in HTML format with paragraphs",
  "callToAction": "Brief call to action text"
}`;
  }

  private buildEmailUserPrompt(context: MessageContext, toneSettings: ToneSettings): string {
    const currency = context.currency || '£';
    
    let situationContext = "";
    
    if (context.promiseToPayMissed) {
      situationContext = `IMPORTANT: The customer previously promised to pay by ${context.promiseToPayDate?.toLocaleDateString('en-GB')} but missed this commitment. Reference this broken promise professionally.`;
    } else if (context.hasPromiseToPay) {
      situationContext = `The customer has an active promise to pay by ${context.promiseToPayDate?.toLocaleDateString('en-GB')}. This is a follow-up reminder.`;
    } else if (context.hasDispute) {
      situationContext = `There is an active dispute on this invoice. Acknowledge this and offer to discuss.`;
    } else if (context.previousContactCount && context.previousContactCount > 2) {
      situationContext = `We have contacted this customer ${context.previousContactCount} times already. This requires a more direct approach.`;
    }

    return `Generate a collection email for the following situation:

Customer: ${context.customerName}
Company: ${context.companyName || context.customerName}
Invoice: ${context.invoiceNumber}
Amount: ${currency}${context.invoiceAmount.toFixed(2)}
Due Date: ${context.dueDate.toLocaleDateString('en-GB')}
Days Overdue: ${context.daysOverdue}
${context.totalOutstanding ? `Total Outstanding: ${currency}${context.totalOutstanding.toFixed(2)}` : ''}
${context.invoiceCount && context.invoiceCount > 1 ? `Number of Overdue Invoices: ${context.invoiceCount}` : ''}

Stage: ${toneSettings.stage}
Reason: ${toneSettings.reasonCode || 'GENERIC_OVERDUE_FOLLOWUP'}
${situationContext}

Sender: ${context.tenantName}
${context.tenantPhone ? `Contact Phone: ${context.tenantPhone}` : ''}
${context.paymentLink ? `Payment Link: ${context.paymentLink}` : ''}

Generate a personalised, professional email.`;
  }

  private buildSMSSystemPrompt(toneSettings: ToneSettings): string {
    const toneDescriptions: Record<ToneProfile, string> = {
      CREDIT_CONTROL_FRIENDLY: "friendly and helpful",
      CREDIT_CONTROL_FIRM: "direct but professional",
      RECOVERY_FORMAL_FIRM: "formal and urgent",
      LEGAL_ESCALATION_INFO: "formal with clear urgency"
    };

    const tone = toneDescriptions[toneSettings.toneProfile] || toneDescriptions.CREDIT_CONTROL_FRIENDLY;

    return `You are a credit control specialist writing collection SMS messages for UK businesses.

Your tone should be ${tone}.

Guidelines:
- Keep messages under 160 characters when possible
- Be direct but professional
- Include the key info: amount and invoice reference
- Include a clear call to action
- Never be threatening
- Use British English

Respond with valid JSON containing:
{
  "body": "SMS message text"
}`;
  }

  private buildSMSUserPrompt(context: MessageContext, toneSettings: ToneSettings): string {
    const currency = context.currency || '£';
    
    let situationHint = "";
    if (context.promiseToPayMissed) {
      situationHint = "Note: Customer missed their promised payment date.";
    } else if (context.daysOverdue > 60) {
      situationHint = "Note: This is significantly overdue and requires urgent attention.";
    }

    return `Generate an SMS for:

Customer: ${context.customerName}
Invoice: ${context.invoiceNumber}
Amount: ${currency}${context.invoiceAmount.toFixed(2)}
Days Overdue: ${context.daysOverdue}
Sender: ${context.tenantName}
${situationHint}

Stage: ${toneSettings.stage}`;
  }

  private buildVoiceSystemPrompt(toneSettings: ToneSettings): string {
    const toneDescriptions: Record<ToneProfile, string> = {
      CREDIT_CONTROL_FRIENDLY: "warm, friendly, and collaborative. Build rapport and understand any issues.",
      CREDIT_CONTROL_FIRM: "professional and focused, while remaining helpful. Get to the point efficiently.",
      RECOVERY_FORMAL_FIRM: "formal and serious, emphasising the importance of resolving the account. Offer solutions.",
      LEGAL_ESCALATION_INFO: "highly formal, explaining potential legal implications while offering a final opportunity to resolve."
    };

    const tone = toneDescriptions[toneSettings.toneProfile] || toneDescriptions.CREDIT_CONTROL_FRIENDLY;

    return `You are generating a voice call script for an AI agent making collection calls for UK businesses.

The tone should be ${tone}

Script Guidelines:
- Write in natural, conversational British English
- Include a brief introduction identifying the caller and company
- State the purpose clearly but politely
- Reference the invoice amount and how overdue it is
- Ask if there are any issues preventing payment
- Offer to help arrange payment or discuss options
- Include closing with next steps
- Keep it concise - aim for 30-60 seconds when spoken

The script should work as an opening monologue that the AI will adapt based on customer responses.

Respond with valid JSON containing:
{
  "voiceScript": "The complete voice script"
}`;
  }

  private buildVoiceUserPrompt(context: MessageContext, toneSettings: ToneSettings): string {
    const currency = context.currency || '£';
    
    return `Generate a voice call script for:

Customer: ${context.customerName}
Company: ${context.companyName || context.customerName}
Invoice: ${context.invoiceNumber}
Amount: ${currency}${context.invoiceAmount.toFixed(2)}
Days Overdue: ${context.daysOverdue}
${context.promiseToPayMissed ? 'Note: Customer missed a promised payment date.' : ''}
${context.previousContactCount && context.previousContactCount > 0 ? `Previous contacts: ${context.previousContactCount}` : ''}

Caller Company: ${context.tenantName}
Stage: ${toneSettings.stage}
Tone: ${toneSettings.toneProfile}`;
  }

  private getDefaultSubject(context: MessageContext, toneSettings: ToneSettings): string {
    const subjects: Record<PlaybookStage, string> = {
      CREDIT_CONTROL: `Payment Reminder - Invoice ${context.invoiceNumber}`,
      RECOVERY: `URGENT: Overdue Invoice ${context.invoiceNumber} Requires Immediate Attention`,
      LEGAL: `Final Notice - Invoice ${context.invoiceNumber}`
    };
    return subjects[toneSettings.stage] || subjects.CREDIT_CONTROL;
  }

  private getDefaultEmailBody(context: MessageContext, toneSettings: ToneSettings): string {
    const currency = context.currency || '£';
    
    if (toneSettings.stage === 'RECOVERY') {
      return `<p>Dear ${context.customerName},</p>
<p>We are writing regarding invoice ${context.invoiceNumber} for ${currency}${context.invoiceAmount.toFixed(2)}, which is now ${context.daysOverdue} days overdue.</p>
<p>Despite previous reminders, this invoice remains unpaid. We urge you to make payment immediately to avoid any further action being taken on this account.</p>
<p>If you are experiencing difficulties, please contact us immediately to discuss payment options.</p>
<p>Kind regards,<br>${context.tenantName}</p>`;
    }

    return `<p>Dear ${context.customerName},</p>
<p>This is a friendly reminder that invoice ${context.invoiceNumber} for ${currency}${context.invoiceAmount.toFixed(2)} was due on ${context.dueDate.toLocaleDateString('en-GB')} and is now ${context.daysOverdue} days overdue.</p>
<p>If you've already made payment, please disregard this message. Otherwise, we'd appreciate prompt payment to keep your account in good standing.</p>
<p>If you have any questions or need to discuss payment arrangements, please don't hesitate to get in touch.</p>
<p>Kind regards,<br>${context.tenantName}</p>`;
  }

  private getDefaultSMSBody(context: MessageContext, toneSettings: ToneSettings): string {
    const currency = context.currency || '£';
    
    if (toneSettings.stage === 'RECOVERY') {
      return `URGENT: Invoice ${context.invoiceNumber} (${currency}${context.invoiceAmount.toFixed(2)}) is ${context.daysOverdue} days overdue. Please pay immediately or call ${context.tenantName}.`;
    }

    return `Reminder: Invoice ${context.invoiceNumber} (${currency}${context.invoiceAmount.toFixed(2)}) is ${context.daysOverdue} days past due. Please arrange payment. - ${context.tenantName}`;
  }

  private getDefaultVoiceScript(context: MessageContext, toneSettings: ToneSettings): string {
    const currency = context.currency || '£';
    
    return `Hello, this is calling on behalf of ${context.tenantName}. I'm calling about invoice ${context.invoiceNumber} for ${currency}${context.invoiceAmount.toFixed(2)}, which is currently ${context.daysOverdue} days past the due date. 

I wanted to check if there are any issues with this invoice and see if we can help arrange payment. Are you able to discuss this now, or is there a better time to call back?`;
  }

  private getFallbackEmail(context: MessageContext, toneSettings: ToneSettings): GeneratedMessage {
    return {
      subject: this.getDefaultSubject(context, toneSettings),
      body: this.getDefaultEmailBody(context, toneSettings),
      callToAction: "Please arrange payment at your earliest convenience"
    };
  }

  private getFallbackSMS(context: MessageContext, toneSettings: ToneSettings): GeneratedMessage {
    return {
      body: this.getDefaultSMSBody(context, toneSettings)
    };
  }

  private getFallbackVoiceScript(context: MessageContext, toneSettings: ToneSettings): GeneratedMessage {
    return {
      voiceScript: this.getDefaultVoiceScript(context, toneSettings),
      body: this.getDefaultVoiceScript(context, toneSettings)
    };
  }
}

export const aiMessageGenerator = new AIMessageGenerator();
