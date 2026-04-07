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

import { generateJSON } from "./llm/claude";
import { ToneProfile, PlaybookStage, ReasonCode, TemplateId } from "./playbookEngine";
import { cleanEmailContent, cleanSmsContent } from "./messagePostProcessor";
import { canAttemptGeneration, recordSuccess, recordFailure, CircuitOpenError } from "./llmCircuitBreaker";
import { validateGeneratedMessage } from "./llmOutputValidator";
import { getTemplateFallback, buildTemplateContext } from "./templateFallback";

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
  /** Structured conversation brief — full debtor context for LLM */
  conversationBrief?: string;
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
  generationMethod?: 'llm' | 'template_fallback';
}

export interface GenerationOptions {
  tenantId?: string;
  toneLevel?: string;
}

class AIMessageGenerator {
  /**
   * Generate a personalized email message.
   * Gap 9: Circuit breaker + output validation + template fallback.
   */
  async generateEmail(
    context: MessageContext,
    toneSettings: ToneSettings,
    options?: GenerationOptions,
  ): Promise<GeneratedMessage> {
    const { tenantId, toneLevel } = options || {};

    // Circuit breaker check
    if (tenantId) {
      const decision = canAttemptGeneration(tenantId);
      if (!decision.allowed) {
        if (decision.useTemplate) {
          try {
            const ctx = await buildTemplateContext(context, tenantId);
            const template = getTemplateFallback('email', toneLevel || 'professional', ctx);
            if (template) {
              console.log(`[CircuitBreaker] Using email template fallback for tenant ${tenantId}`);
              return { ...template, body: cleanEmailContent(template.body) };
            }
          } catch (templateErr) {
            console.error('[CircuitBreaker] Template fallback failed, using hardcoded fallback:', templateErr);
          }
          // If template building fails, fall through to hardcoded fallback
          const fallback = this.getFallbackEmail(context, toneSettings);
          return { ...fallback, body: cleanEmailContent(fallback.body), generationMethod: 'template_fallback' };
        }
        throw new CircuitOpenError(`Circuit open for tenant ${tenantId}: ${decision.reason}`);
      }
    }

    const hasMultipleInvoices = (context.invoiceCount && context.invoiceCount > 1) ||
                                 (context.invoiceDetails && context.invoiceDetails.length > 1);
    const systemPrompt = this.buildEmailSystemPrompt(toneSettings, hasMultipleInvoices);
    const userPrompt = this.buildEmailUserPrompt(context, toneSettings);

    const invoiceRefs = this.collectInvoiceRefs(context);

    try {
      const result = await this.callLLMWithRetry(systemPrompt, userPrompt, tenantId);
      const rawBody = result.body || this.getDefaultEmailBody(context, toneSettings);
      const subject = result.subject || this.getDefaultSubject(context, toneSettings);
      const body = cleanEmailContent(rawBody);

      // Validate output
      const validation = validateGeneratedMessage(
        body, 'email', context.customerName, toneLevel || 'professional', invoiceRefs
      );
      if (!validation.valid) {
        console.warn(`[OutputValidator] Email validation failed (attempt 1): ${validation.failures.join('; ')}`);
        // Regenerate once
        const retry = await this.callLLMWithRetry(systemPrompt, userPrompt, tenantId);
        const retryBody = cleanEmailContent(retry.body || this.getDefaultEmailBody(context, toneSettings));
        const retryValidation = validateGeneratedMessage(
          retryBody, 'email', context.customerName, toneLevel || 'professional', invoiceRefs
        );
        if (!retryValidation.valid) {
          console.error(`[OutputValidator] Email validation failed (attempt 2): ${retryValidation.failures.join('; ')}`);
          if (tenantId) recordFailure(tenantId);
          throw new Error(`Output validation failed: ${retryValidation.failures.join('; ')}`);
        }
        if (tenantId) recordSuccess(tenantId);
        return { subject: retry.subject || subject, body: retryBody, callToAction: retry.callToAction, generationMethod: 'llm' };
      }

      if (tenantId) recordSuccess(tenantId);
      return { subject, body, callToAction: result.callToAction, generationMethod: 'llm' };
    } catch (error: any) {
      if (error instanceof CircuitOpenError) throw error;
      console.error('AI email generation failed, using fallback:', error);
      const fallback = this.getFallbackEmail(context, toneSettings);
      return { ...fallback, body: cleanEmailContent(fallback.body) };
    }
  }

  /**
   * Generate a personalized SMS message.
   * Gap 9: Circuit breaker + output validation + template fallback.
   */
  async generateSMS(
    context: MessageContext,
    toneSettings: ToneSettings,
    options?: GenerationOptions,
  ): Promise<GeneratedMessage> {
    const { tenantId, toneLevel } = options || {};

    // Circuit breaker check
    if (tenantId) {
      const decision = canAttemptGeneration(tenantId);
      if (!decision.allowed) {
        if (decision.useTemplate) {
          try {
            const ctx = await buildTemplateContext(context, tenantId);
            const template = getTemplateFallback('sms', toneLevel || 'professional', ctx);
            if (template) {
              console.log(`[CircuitBreaker] Using SMS template fallback for tenant ${tenantId}`);
              return { ...template, body: cleanSmsContent(template.body) };
            }
          } catch (templateErr) {
            console.error('[CircuitBreaker] SMS template fallback failed:', templateErr);
          }
          const fallback = this.getFallbackSMS(context, toneSettings);
          return { ...fallback, body: cleanSmsContent(fallback.body), generationMethod: 'template_fallback' };
        }
        throw new CircuitOpenError(`Circuit open for tenant ${tenantId}: ${decision.reason}`);
      }
    }

    const systemPrompt = this.buildSMSSystemPrompt(toneSettings);
    const userPrompt = this.buildSMSUserPrompt(context, toneSettings);
    const invoiceRefs = this.collectInvoiceRefs(context);

    try {
      const result = await this.callLLMWithRetry(systemPrompt, userPrompt, tenantId);
      const rawBody = result.body || this.getDefaultSMSBody(context, toneSettings);
      const body = cleanSmsContent(rawBody);

      // Validate output
      const validation = validateGeneratedMessage(
        body, 'sms', context.customerName, toneLevel || 'professional', invoiceRefs
      );
      if (!validation.valid) {
        console.warn(`[OutputValidator] SMS validation failed (attempt 1): ${validation.failures.join('; ')}`);
        const retry = await this.callLLMWithRetry(systemPrompt, userPrompt, tenantId);
        const retryBody = cleanSmsContent(retry.body || this.getDefaultSMSBody(context, toneSettings));
        const retryValidation = validateGeneratedMessage(
          retryBody, 'sms', context.customerName, toneLevel || 'professional', invoiceRefs
        );
        if (!retryValidation.valid) {
          console.error(`[OutputValidator] SMS validation failed (attempt 2): ${retryValidation.failures.join('; ')}`);
          if (tenantId) recordFailure(tenantId);
          throw new Error(`SMS output validation failed: ${retryValidation.failures.join('; ')}`);
        }
        if (tenantId) recordSuccess(tenantId);
        return { body: retryBody, generationMethod: 'llm' };
      }

      if (tenantId) recordSuccess(tenantId);
      return { body, generationMethod: 'llm' };
    } catch (error: any) {
      if (error instanceof CircuitOpenError) throw error;
      console.error('AI SMS generation failed, using fallback:', error);
      const fallback = this.getFallbackSMS(context, toneSettings);
      return { body: cleanSmsContent(fallback.body) };
    }
  }

  /**
   * Generate a personalized voice call script for Retell AI.
   * Gap 9: Circuit breaker (no template fallback for voice).
   */
  async generateVoiceScript(
    context: MessageContext,
    toneSettings: ToneSettings,
    options?: GenerationOptions,
  ): Promise<GeneratedMessage> {
    const { tenantId } = options || {};

    // Circuit breaker check — voice is NOT templated
    if (tenantId) {
      const decision = canAttemptGeneration(tenantId);
      if (!decision.allowed) {
        throw new CircuitOpenError(`Circuit open for tenant ${tenantId}: ${decision.reason} (voice not templated)`);
      }
    }

    const systemPrompt = this.buildVoiceSystemPrompt(toneSettings);
    const userPrompt = this.buildVoiceUserPrompt(context, toneSettings);

    try {
      const result = await this.callLLMWithRetry(systemPrompt, userPrompt, tenantId);
      if (tenantId) recordSuccess(tenantId);
      return {
        voiceScript: result.voiceScript || this.getDefaultVoiceScript(context, toneSettings),
        body: result.voiceScript || '',
        generationMethod: 'llm',
      };
    } catch (error: any) {
      if (error instanceof CircuitOpenError) throw error;
      console.error('AI voice script generation failed, using fallback:', error);
      return this.getFallbackVoiceScript(context, toneSettings);
    }
  }

  /**
   * Call LLM with a single retry on failure (10s delay).
   * Records failure on the circuit breaker if both attempts fail.
   */
  private async callLLMWithRetry(
    systemPrompt: string,
    userPrompt: string,
    tenantId?: string,
  ): Promise<any> {
    try {
      return await generateJSON<any>({
        system: systemPrompt,
        prompt: userPrompt,
        model: "fast",
        temperature: 0.7,
      });
    } catch (firstError) {
      console.warn('[LLM] First attempt failed, retrying in 10s...', (firstError as Error).message);
      await new Promise(resolve => setTimeout(resolve, 10_000));
      try {
        return await generateJSON<any>({
          system: systemPrompt,
          prompt: userPrompt,
          model: "fast",
          temperature: 0.7,
        });
      } catch (secondError) {
        if (tenantId) recordFailure(tenantId);
        throw secondError;
      }
    }
  }

  /**
   * Collect invoice references for output validation.
   */
  private collectInvoiceRefs(context: MessageContext): string[] {
    const refs: string[] = [];
    if (context.invoiceNumber && context.invoiceNumber !== 'N/A') {
      refs.push(context.invoiceNumber);
    }
    if (context.invoiceDetails) {
      for (const inv of context.invoiceDetails) {
        if (inv.invoiceNumber) refs.push(inv.invoiceNumber);
      }
    }
    return refs;
  }

  private buildEmailSystemPrompt(toneSettings: ToneSettings, hasMultipleInvoices: boolean = false): string {
    const toneDescriptions: Record<ToneProfile, string> = {
      CREDIT_CONTROL_FRIENDLY: "warm, helpful, and understanding. Use a conversational tone that maintains a positive relationship while gently reminding about payment.",
      CREDIT_CONTROL_FIRM: "professional and direct, while remaining respectful. Clearly communicate the urgency without being aggressive.",
      RECOVERY_FORMAL_FIRM: "formal and serious. This is for overdue accounts requiring escalated attention. Be clear about consequences while remaining professional.",
      LEGAL_ESCALATION_INFO: "highly formal and legally precise. Reference statutory rights and potential legal implications clearly."
    };

    const tone = toneDescriptions[toneSettings.toneProfile] || toneDescriptions.CREDIT_CONTROL_FRIENDLY;

    const invoiceTableInstruction = `
- INVOICE FORMATTING (MANDATORY): When the email references one or more invoices, you MUST include an HTML table with these exact columns in this order: Invoice #, Amount, Due Date, Days Overdue. One row per invoice. Never list invoices as inline text, bullet points, or comma-separated lists. Use minimal inline styles: <table style="border-collapse:collapse;width:100%;margin:16px 0;">, <th style="border:1px solid #ddd;padding:8px;text-align:left;background:#f5f5f5;">, <td style="border:1px solid #ddd;padding:8px;">. The rule applies even when there is only a single invoice.`;

    return `You are a professional credit control specialist writing collection emails for UK businesses.

Your tone should be ${tone}

YOUR OBJECTIVE: Get a payment date. Every email you write should make it easy for the debtor to respond with when they'll pay. Most debtors intend to pay — they're just busy or disorganised. Nudge them forward, don't threaten them. Make it EASY to reply — one question, one action needed.

Guidelines:
- Write in British English
- Be concise but complete
- Include a clear call to action
- Never be threatening or aggressive
- Maintain professionalism at all times
- Reference invoice details naturally
- If there's a payment link, include it
- For Recovery stage, mention the seriousness but offer a path to resolution
- LANGUAGE RULE: Never use the term "promise to pay" or "PTP" in any communication. Use natural business language instead: "payment arrangement", "confirmed payment date", "agreed payment", "scheduled payment". The debtor should never feel they are being managed through a collections system.${invoiceTableInstruction}
${toneSettings.useLatePaymentLegislation ? "- You may reference the Late Payment of Commercial Debts (Interest) Act 1998 if appropriate" : ""}

HTML FORMATTING REQUIREMENTS (CRITICAL):
- Emit the ENTIRE email body as well-formed HTML. Wrap EVERY paragraph in <p></p> tags. Use <br> for soft line breaks.
- Place the mandatory invoice table between the relevant paragraphs. Do not mix plain text with HTML.
- Sign-off must contain THREE labelled lines, in this order, never substituted or duplicated:
  Line 1 — Sender Name
  Line 2 — Sender Title
  Line 3 — Company Name
  Render inside a single <p> with <br> between lines. Never repeat the company name on multiple lines. Never replace the name line with the company name.
- Example structure:
  <p>Dear [Name],</p>
  <p>[Opening context about invoice(s)]</p>
  [Invoice table — mandatory for any invoice reference]
  <p>[Main message and call to action]</p>
  <p>Kind regards,<br>[Sender Name]<br>[Title]<br>[Company]</p>

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
      situationContext = `IMPORTANT: The customer previously confirmed they would pay by ${context.promiseToPayDate?.toLocaleDateString('en-GB')} but this commitment was not met. Reference this professionally.`;
    } else if (context.hasPromiseToPay) {
      situationContext = `The customer has confirmed a payment date of ${context.promiseToPayDate?.toLocaleDateString('en-GB')}. This is a follow-up reminder.`;
    } else if (context.hasDispute) {
      situationContext = `There is an active dispute on this invoice. Acknowledge this and offer to discuss.`;
    } else if (context.previousContactCount && context.previousContactCount > 2) {
      situationContext = `We have contacted this customer ${context.previousContactCount} times already. This requires a more direct approach.`;
    }

    // Build invoice details section — render as mandatory HTML table for any invoice count
    let invoiceDetailsSection = '';
    if (context.invoiceDetails && context.invoiceDetails.length >= 1) {
      invoiceDetailsSection = `\nInvoice Breakdown (RENDER AS THE MANDATORY HTML TABLE — columns: Invoice #, Amount, Due Date, Days Overdue):\n`;
      context.invoiceDetails.forEach(inv => {
        invoiceDetailsSection += `  | ${inv.invoiceNumber} | ${currency}${inv.amount.toFixed(2)} | ${inv.dueDate.toLocaleDateString('en-GB')} | ${inv.daysOverdue} days overdue |\n`;
      });
      invoiceDetailsSection += `\nIMPORTANT: You MUST include an HTML table with the above invoices in the email body, even if there is only one row.`;
    }

    // Conversation brief — full debtor context
    const briefSection = context.conversationBrief
      ? `\n${context.conversationBrief}\n\nYou are continuing an ongoing conversation with this debtor. Your message must:\n- Reference relevant previous interactions naturally\n- Acknowledge any active commitments or arrangements\n- Not contradict anything previously communicated\n- Not repeat information already sent if the debtor acknowledged it\n- Match the appropriate escalation level given the history\n- Never write as if this is the first contact unless it genuinely is\n`
      : '';

    return `Generate a collection email for the following situation:
${briefSection}
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

Generate a personalised, professional email.`;
  }

  private buildSMSSystemPrompt(toneSettings: ToneSettings): string {
    // SMS is a one-way nudge channel for MVP — points debtors to check their email.
    // No amounts, no invoice numbers, no links, no phone numbers.
    const toneGuidance: Record<string, string> = {
      friendly: `TONE: Friendly
- Example: "Hi Sarah, just a quick note — we sent you an email about your account. Could you take a look? Thanks, James"`,
      professional: `TONE: Professional
- Example: "Hi Sarah, we've sent an email regarding outstanding invoices on your account. We'd appreciate your response. Thanks, James"`,
      firm: `TONE: Firm
- Example: "Hi Sarah, we've been trying to reach you by email about overdue invoices. Please check your inbox at your earliest convenience. James"`,
    };

    const stage = toneSettings.stage;
    let tone = 'professional';
    if (stage === 'CREDIT_CONTROL') tone = 'friendly';
    else if (stage === 'RECOVERY') tone = 'firm';

    const guidance = toneGuidance[tone] || toneGuidance.professional;

    return `You are a UK credit control specialist writing a brief SMS nudge.

SMS is a ONE-WAY nudge channel. The purpose is ONLY to direct the debtor to check their email.

${guidance}

CRITICAL RULES:
- HARD LIMIT: 160 characters maximum - count carefully before responding
- ALWAYS reference that an email has been sent
- NEVER include specific amounts or invoice numbers
- NEVER include email addresses, phone numbers, or links
- ALWAYS sign off with the agent persona name
- Never be threatening - professional UK tone
- Never use "promise to pay" or "PTP"
- Keep it brief and non-sensitive

STRUCTURE: Greeting + email reference + brief ask + agent name

Respond with valid JSON:
{
  "body": "SMS text here"
}`;
  }

  private buildSMSUserPrompt(context: MessageContext, toneSettings: ToneSettings): string {
    const firstName = context.customerName.split(' ')[0];
    // Use agent persona name if available, otherwise tenant name
    const agentName = context.tenantName;

    let toneHint = 'friendly';
    if (toneSettings.stage === 'RECOVERY') toneHint = 'firm';
    else if (context.daysOverdue > 30) toneHint = 'professional';

    return `Generate a brief SMS nudge (MUST be under 160 characters):

Customer first name: ${firstName}
Agent name: ${agentName}
Tone: ${toneHint}

The SMS should ONLY tell them to check their email. Do NOT include amounts, invoice numbers, links, or phone numbers.

REMEMBER: Max 160 chars. Sign off with "${agentName}".`;
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

YOUR OBJECTIVE: Get a payment date. Guide the conversation toward the debtor confirming when they'll pay. Be helpful, not confrontational. Make it easy for them to give a date.

Script Guidelines:
- Write in natural, conversational British English
- Include a brief introduction identifying the caller and company
- State the purpose clearly but politely
- Reference the invoice amount and how overdue it is
- Ask if there are any issues preventing payment
- Offer to help arrange payment or discuss options
- Include closing with next steps
- Keep it concise - aim for 30-60 seconds when spoken
- Never use "promise to pay" or "PTP" — use "payment arrangement" or "confirmed payment" instead

The script should work as an opening monologue that the AI will adapt based on customer responses.

Respond with valid JSON containing:
{
  "voiceScript": "The complete voice script"
}`;
  }

  private buildVoiceUserPrompt(context: MessageContext, toneSettings: ToneSettings): string {
    const currency = context.currency || '£';

    // Voice gets full brief for pre-call briefing
    const voiceBrief = context.conversationBrief
      ? `\nPRE-CALL BRIEFING:\n${context.conversationBrief}\nUse this briefing to inform your conversation. Reference relevant history naturally.\n`
      : '';

    return `Generate a voice call script for:
${voiceBrief}
Customer: ${context.customerName}
Company: ${context.companyName || context.customerName}
Invoice: ${context.invoiceNumber}
Amount: ${currency}${context.invoiceAmount.toFixed(2)}
Days Overdue: ${context.daysOverdue}
${context.promiseToPayMissed ? 'Note: Customer missed a confirmed payment date.' : ''}
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
    // SMS is a one-way nudge — points debtors to check their email.
    // No amounts, no invoice numbers, no links, no phone numbers.
    const firstName = context.customerName.split(' ')[0];
    const agentName = this.abbreviateTenantName(context.tenantName, 20);

    if (toneSettings.stage === 'RECOVERY') {
      // Firm nudge
      return `Hi ${firstName}, we've been trying to reach you by email about overdue invoices. Please check your inbox at your earliest convenience. ${agentName}`;
    } else if (context.daysOverdue > 30) {
      // Professional nudge
      return `Hi ${firstName}, we've sent an email regarding outstanding invoices on your account. We'd appreciate your response. Thanks, ${agentName}`;
    } else {
      // Friendly nudge
      return `Hi ${firstName}, just a quick note — we sent you an email about your account. Could you take a look? Thanks, ${agentName}`;
    }
  }
  
  private abbreviateTenantName(name: string, maxLength: number): string {
    if (name.length <= maxLength) return name;
    
    // Try abbreviating common suffixes
    let abbreviated = name
      .replace(/\s+(Limited|Ltd\.?|LLP|PLC|Inc\.?)$/i, '')
      .replace(/\s+(Company|Corp\.?|Corporation)$/i, '');
    
    if (abbreviated.length <= maxLength) return abbreviated;
    
    // Truncate with ellipsis
    return abbreviated.substring(0, maxLength - 3) + '...';
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
