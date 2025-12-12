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
import { cleanEmailContent, cleanSmsContent } from "./messagePostProcessor";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface InvoiceDetail {
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  daysOverdue: number;
}

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
  invoiceDetails?: InvoiceDetail[];  // Individual invoice breakdown for tables
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
    const hasMultipleInvoices = (context.invoiceCount && context.invoiceCount > 1) || 
                                 (context.invoiceDetails && context.invoiceDetails.length > 1);
    const systemPrompt = this.buildEmailSystemPrompt(toneSettings, hasMultipleInvoices);
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
      
      // Post-process to ensure proper HTML paragraph formatting
      const rawBody = result.body || this.getDefaultEmailBody(context, toneSettings);
      
      return {
        subject: result.subject || this.getDefaultSubject(context, toneSettings),
        body: cleanEmailContent(rawBody),
        callToAction: result.callToAction
      };
    } catch (error) {
      console.error('AI email generation failed, using fallback:', error);
      const fallback = this.getFallbackEmail(context, toneSettings);
      return {
        ...fallback,
        body: cleanEmailContent(fallback.body)
      };
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
      
      // Post-process to ensure proper line break formatting
      const rawBody = result.body || this.getDefaultSMSBody(context, toneSettings);
      
      return {
        body: cleanSmsContent(rawBody)
      };
    } catch (error) {
      console.error('AI SMS generation failed, using fallback:', error);
      const fallback = this.getFallbackSMS(context, toneSettings);
      return {
        body: cleanSmsContent(fallback.body)
      };
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

  private buildEmailSystemPrompt(toneSettings: ToneSettings, hasMultipleInvoices: boolean = false): string {
    const toneDescriptions: Record<ToneProfile, string> = {
      CREDIT_CONTROL_FRIENDLY: "warm, helpful, and understanding. Use a conversational tone that maintains a positive relationship while gently reminding about payment.",
      CREDIT_CONTROL_FIRM: "professional and direct, while remaining respectful. Clearly communicate the urgency without being aggressive.",
      RECOVERY_FORMAL_FIRM: "formal and serious. This is for overdue accounts requiring escalated attention. Be clear about consequences while remaining professional.",
      LEGAL_ESCALATION_INFO: "highly formal and legally precise. Reference statutory rights and potential legal implications clearly."
    };

    const tone = toneDescriptions[toneSettings.toneProfile] || toneDescriptions.CREDIT_CONTROL_FRIENDLY;

    const invoiceTableInstruction = hasMultipleInvoices ? `
- IMPORTANT: When there are multiple invoices, you MUST include an HTML table listing each invoice with columns: Invoice Number, Amount, Due Date, Days Overdue. Use clean styling with borders and proper formatting. Place the table after the opening context paragraph.` : '';

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
- For Recovery stage, mention the seriousness but offer a path to resolution${invoiceTableInstruction}
${toneSettings.useLatePaymentLegislation ? "- You may reference the Late Payment of Commercial Debts (Interest) Act 1998 if appropriate" : ""}

HTML FORMATTING REQUIREMENTS (CRITICAL):
- Wrap EVERY paragraph in <p></p> tags - this is essential for proper email rendering
- Structure your email with separate paragraphs for: greeting, context, main message, call to action, sign-off
- Example structure:
  <p>Dear [Name],</p>
  <p>[Opening context about invoice(s)]</p>
  [Invoice table if multiple invoices]
  <p>[Main message with details]</p>
  <p>[Call to action]</p>
  <p>Kind regards,<br>[Sender]</p>

Respond with valid JSON containing:
{
  "subject": "Email subject line",
  "body": "Full HTML email body with each paragraph wrapped in <p> tags",
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

    // Build invoice details section if multiple invoices
    let invoiceDetailsSection = '';
    if (context.invoiceDetails && context.invoiceDetails.length > 1) {
      invoiceDetailsSection = `\nInvoice Breakdown (INCLUDE AS HTML TABLE IN EMAIL):\n`;
      context.invoiceDetails.forEach(inv => {
        invoiceDetailsSection += `- ${inv.invoiceNumber}: ${currency}${inv.amount.toFixed(2)}, Due: ${inv.dueDate.toLocaleDateString('en-GB')}, ${inv.daysOverdue} days overdue\n`;
      });
      invoiceDetailsSection += `\nIMPORTANT: You MUST include an HTML table with the above invoices in the email body.`;
    }

    return `Generate a collection email for the following situation:

Customer: ${context.customerName}
Company: ${context.companyName || context.customerName}
Invoice: ${context.invoiceNumber}
Amount: ${currency}${context.invoiceAmount.toFixed(2)}
Due Date: ${context.dueDate.toLocaleDateString('en-GB')}
Days Overdue: ${context.daysOverdue}
${context.totalOutstanding ? `Total Outstanding: ${currency}${context.totalOutstanding.toFixed(2)}` : ''}
${context.invoiceCount && context.invoiceCount > 1 ? `Number of Overdue Invoices: ${context.invoiceCount}` : ''}${invoiceDetailsSection}

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

CRITICAL GUIDELINES:
- Maximum 160 characters - this is essential for SMS delivery
- Use ONLY the total amount and number of invoices - NEVER list individual invoice numbers
- Be ultra-concise: every word must earn its place
- Include a clear call to action (call/pay)
- Never be threatening
- Use British English

FORMATTING:
- Use a newline character (\\n) after the greeting to separate it from the main message for better readability
- Structure: Greeting\\nMain message with amount\\nCall to action. Sender

Example: "Hi [Name],\\nYou have [X] invoices totalling £[amount] overdue.\\nPay or call [number]. [Company]"

Respond with valid JSON containing:
{
  "body": "SMS message text with \\n for line breaks"
}`;
  }

  private buildSMSUserPrompt(context: MessageContext, toneSettings: ToneSettings): string {
    const currency = context.currency || '£';
    const invoiceCount = context.invoiceCount || 1;
    const totalAmount = context.totalOutstanding || context.invoiceAmount;
    
    let situationHint = "";
    if (context.promiseToPayMissed) {
      situationHint = "Customer missed promised payment.";
    } else if (context.daysOverdue > 60) {
      situationHint = "Significantly overdue - urgent.";
    }

    return `Generate a SHORT SMS (max 160 chars) for:

Customer: ${context.customerName}
Total Outstanding: ${currency}${totalAmount.toFixed(2)}
Number of Invoices: ${invoiceCount}
Oldest Overdue: ${context.daysOverdue} days
Sender: ${context.tenantName}
${context.tenantPhone ? `Phone: ${context.tenantPhone}` : ''}
${situationHint}

Stage: ${toneSettings.stage}

IMPORTANT: Do NOT include individual invoice numbers. Only use total amount and count.`;
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
    
    // Build invoice table HTML if multiple invoices
    let invoiceTableHtml = '';
    if (context.invoiceDetails && context.invoiceDetails.length > 1) {
      invoiceTableHtml = `
<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
  <thead>
    <tr style="background-color: #f3f4f6;">
      <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Invoice</th>
      <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">Amount</th>
      <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">Due Date</th>
      <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">Days Overdue</th>
    </tr>
  </thead>
  <tbody>
    ${context.invoiceDetails.map(inv => `
    <tr>
      <td style="padding: 10px; border: 1px solid #e5e7eb;">${inv.invoiceNumber}</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">${currency}${inv.amount.toFixed(2)}</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${inv.dueDate.toLocaleDateString('en-GB')}</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${inv.daysOverdue}</td>
    </tr>`).join('')}
    <tr style="background-color: #f9fafb; font-weight: bold;">
      <td style="padding: 10px; border: 1px solid #e5e7eb;">Total</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">${currency}${(context.totalOutstanding || context.invoiceAmount).toFixed(2)}</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb;" colspan="2"></td>
    </tr>
  </tbody>
</table>`;
    }
    
    if (toneSettings.stage === 'RECOVERY') {
      const invoiceRef = context.invoiceDetails && context.invoiceDetails.length > 1 
        ? `${context.invoiceCount} overdue invoices totalling ${currency}${(context.totalOutstanding || context.invoiceAmount).toFixed(2)}`
        : `invoice ${context.invoiceNumber} for ${currency}${context.invoiceAmount.toFixed(2)}`;
      
      return `<p>Dear ${context.customerName},</p>
<p>We are writing regarding ${invoiceRef}, which ${context.invoiceDetails && context.invoiceDetails.length > 1 ? 'are' : 'is'} now ${context.daysOverdue} days overdue.</p>
${invoiceTableHtml}
<p>Despite previous reminders, ${context.invoiceDetails && context.invoiceDetails.length > 1 ? 'these invoices remain' : 'this invoice remains'} unpaid. We urge you to make payment immediately to avoid any further action being taken on this account.</p>
<p>If you are experiencing difficulties, please contact us immediately to discuss payment options.</p>
<p>Kind regards,<br>${context.tenantName}</p>`;
    }

    const invoiceRef = context.invoiceDetails && context.invoiceDetails.length > 1 
      ? `${context.invoiceCount} invoices totalling ${currency}${(context.totalOutstanding || context.invoiceAmount).toFixed(2)}`
      : `invoice ${context.invoiceNumber} for ${currency}${context.invoiceAmount.toFixed(2)}`;

    return `<p>Dear ${context.customerName},</p>
<p>This is a friendly reminder that ${invoiceRef} ${context.invoiceDetails && context.invoiceDetails.length > 1 ? 'were' : 'was'} due on ${context.dueDate.toLocaleDateString('en-GB')} and ${context.invoiceDetails && context.invoiceDetails.length > 1 ? 'are' : 'is'} now ${context.daysOverdue} days overdue.</p>
${invoiceTableHtml}
<p>If you've already made payment, please disregard this message. Otherwise, we'd appreciate prompt payment to keep your account in good standing.</p>
<p>If you have any questions or need to discuss payment arrangements, please don't hesitate to get in touch.</p>
<p>Kind regards,<br>${context.tenantName}</p>`;
  }

  private getDefaultSMSBody(context: MessageContext, toneSettings: ToneSettings): string {
    const currency = context.currency || '£';
    const invoiceCount = context.invoiceCount || 1;
    const totalAmount = context.totalOutstanding || context.invoiceAmount;
    const invoiceText = invoiceCount === 1 ? 'invoice' : 'invoices';
    
    if (toneSettings.stage === 'RECOVERY') {
      return `URGENT: ${invoiceCount} ${invoiceText} totalling ${currency}${totalAmount.toFixed(2)} overdue.\nPlease pay now or call ${context.tenantName}.`;
    }

    return `Hi ${context.customerName},\n${invoiceCount} ${invoiceText} (${currency}${totalAmount.toFixed(2)}) overdue.\nPlease pay or call us. - ${context.tenantName}`;
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
