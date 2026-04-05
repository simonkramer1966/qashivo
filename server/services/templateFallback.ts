/**
 * Template Fallback Service — Gap 9
 *
 * 10 tone×channel templates (5 email + 5 SMS) from CHARLIE_ENGINEERING_SPEC Appendix A.
 * Used ONLY during extended LLM outages (circuit open 4+ hours).
 * Voice is NOT templated — returns null.
 */

import { storage } from '../storage';
import type { GeneratedMessage } from './aiMessageGenerator';

// ── Template Context ───────────────────────────────────────────

export interface TemplateContext {
  companyName: string;
  contactName: string;
  totalOutstanding: string;
  oldestInvoiceRef: string;
  oldestInvoiceDays: number;
  invoiceCount: number;
  creditorName: string;
  agentName: string;
  agentTitle: string;
  agentEmail: string;
  agentPhone: string;
}

// ── Email Templates (5 tones) ──────────────────────────────────

const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  friendly: {
    subject: 'Friendly reminder — {{totalOutstanding}} outstanding',
    body: `<p>Dear {{contactName}},</p>
<p>I hope you're well. I'm just writing to let you know that we have {{totalOutstanding}} outstanding on your account, including invoice {{oldestInvoiceRef}} which is now {{oldestInvoiceDays}} days past due.</p>
<p>If you've already arranged payment, please disregard this message. Otherwise, could you let me know when we might expect payment? Happy to discuss if there are any issues.</p>
<p>Kind regards,<br>{{agentName}}<br>{{agentTitle}}<br>{{creditorName}}<br>{{agentEmail}} | {{agentPhone}}</p>`,
  },
  professional: {
    subject: 'Payment reminder — {{totalOutstanding}} overdue',
    body: `<p>Dear {{contactName}},</p>
<p>I am writing regarding {{totalOutstanding}} currently outstanding on your account across {{invoiceCount}} invoice(s). The oldest, {{oldestInvoiceRef}}, is now {{oldestInvoiceDays}} days overdue.</p>
<p>Please arrange payment at your earliest convenience. If there are any queries or you wish to discuss a payment arrangement, do not hesitate to contact me.</p>
<p>Kind regards,<br>{{agentName}}<br>{{agentTitle}}<br>{{creditorName}}<br>{{agentEmail}} | {{agentPhone}}</p>`,
  },
  firm: {
    subject: 'Overdue account — immediate payment required ({{totalOutstanding}})',
    body: `<p>Dear {{contactName}},</p>
<p>Despite previous correspondence, your account remains overdue. The total outstanding is {{totalOutstanding}} across {{invoiceCount}} invoice(s), with {{oldestInvoiceRef}} now {{oldestInvoiceDays}} days past due.</p>
<p>We must receive payment promptly to avoid further action on this account. Please arrange payment today or contact me immediately to discuss.</p>
<p>Regards,<br>{{agentName}}<br>{{agentTitle}}<br>{{creditorName}}<br>{{agentEmail}} | {{agentPhone}}</p>`,
  },
  formal: {
    subject: 'Formal notice — {{totalOutstanding}} overdue',
    body: `<p>Dear {{contactName}},</p>
<p>This is a formal notice regarding the outstanding balance of {{totalOutstanding}} on your account. Invoice {{oldestInvoiceRef}} is now {{oldestInvoiceDays}} days overdue.</p>
<p>We reserve the right to take further action to recover this debt if payment is not received within 7 days. We strongly encourage you to make payment or contact us to discuss resolution options.</p>
<p>Yours faithfully,<br>{{agentName}}<br>{{agentTitle}}<br>{{creditorName}}<br>{{agentEmail}} | {{agentPhone}}</p>`,
  },
  legal: {
    subject: 'Pre-action notice — {{totalOutstanding}} overdue',
    body: `<p>Dear {{contactName}},</p>
<p>LETTER BEFORE ACTION</p>
<p>We write regarding the sum of {{totalOutstanding}} owed by {{companyName}} to {{creditorName}}, including invoice {{oldestInvoiceRef}} which is {{oldestInvoiceDays}} days overdue.</p>
<p>In accordance with the Pre-Action Protocol for Debt Claims and the Civil Procedure Rules, we are providing you with 30 days from the date of this letter to either pay the outstanding amount in full or propose a repayment plan.</p>
<p>Failure to respond may result in the commencement of proceedings without further notice. Statutory interest may also be claimed under the Late Payment of Commercial Debts (Interest) Act 1998.</p>
<p>Yours faithfully,<br>{{agentName}}<br>{{agentTitle}}<br>{{creditorName}}<br>{{agentEmail}} | {{agentPhone}}</p>`,
  },
};

// ── SMS Templates (5 tones) ────────────────────────────────────

// SMS is a one-way nudge channel for MVP — points debtors to check their email.
// No amounts, no invoice numbers, no links, no phone numbers.
// Formal/legal tones should not use SMS (decision tree excludes them), but templates
// fall back to professional tone if somehow reached.
const SMS_TEMPLATES: Record<string, string> = {
  friendly: `Hi {{contactName}}, just a quick note — we sent you an email about your account. Could you take a look? Thanks, {{agentName}}`,
  professional: `Hi {{contactName}}, we've sent an email regarding outstanding invoices on your account. We'd appreciate your response. Thanks, {{agentName}}`,
  firm: `Hi {{contactName}}, we've been trying to reach you by email about overdue invoices. Please check your inbox at your earliest convenience. {{agentName}}`,
  formal: `Hi {{contactName}}, we've sent an email regarding outstanding invoices on your account. We'd appreciate your response. Thanks, {{agentName}}`,
  legal: `Hi {{contactName}}, we've sent an email regarding outstanding invoices on your account. We'd appreciate your response. Thanks, {{agentName}}`,
};

// ── Template Substitution ──────────────────────────────────────

function substitute(template: string, ctx: TemplateContext): string {
  return template
    .replace(/\{\{companyName\}\}/g, ctx.companyName)
    .replace(/\{\{contactName\}\}/g, ctx.contactName)
    .replace(/\{\{totalOutstanding\}\}/g, ctx.totalOutstanding)
    .replace(/\{\{oldestInvoiceRef\}\}/g, ctx.oldestInvoiceRef)
    .replace(/\{\{oldestInvoiceDays\}\}/g, String(ctx.oldestInvoiceDays))
    .replace(/\{\{invoiceCount\}\}/g, String(ctx.invoiceCount))
    .replace(/\{\{creditorName\}\}/g, ctx.creditorName)
    .replace(/\{\{agentName\}\}/g, ctx.agentName)
    .replace(/\{\{agentTitle\}\}/g, ctx.agentTitle)
    .replace(/\{\{agentEmail\}\}/g, ctx.agentEmail)
    .replace(/\{\{agentPhone\}\}/g, ctx.agentPhone);
}

function abbreviateTenantName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;
  let abbreviated = name
    .replace(/\s+(Limited|Ltd\.?|LLP|PLC|Inc\.?)$/i, '')
    .replace(/\s+(Company|Corp\.?|Corporation)$/i, '');
  if (abbreviated.length <= maxLength) return abbreviated;
  return abbreviated.substring(0, maxLength - 3) + '...';
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Get a template-generated message for the given channel and tone.
 * Returns null for voice (voice is not templated).
 */
export function getTemplateFallback(
  channel: 'email' | 'sms' | 'voice',
  toneLevel: string,
  context: TemplateContext,
): (GeneratedMessage & { generationMethod: 'template_fallback' }) | null {
  const tone = toneLevel.toLowerCase();

  if (channel === 'voice') {
    return null; // Voice is not templated
  }

  if (channel === 'email') {
    const template = EMAIL_TEMPLATES[tone] || EMAIL_TEMPLATES.professional;
    return {
      subject: substitute(template.subject, context),
      body: substitute(template.body, context),
      generationMethod: 'template_fallback',
    };
  }

  if (channel === 'sms') {
    const template = SMS_TEMPLATES[tone] || SMS_TEMPLATES.professional;
    // Use abbreviated creditor name for SMS length safety
    const smsContext = {
      ...context,
      creditorName: abbreviateTenantName(context.creditorName, 20),
      contactName: context.contactName.split(' ')[0], // first name only for SMS
    };
    const body = substitute(template, smsContext);

    // If still over 160, truncate
    const finalBody = body.length > 160 ? body.substring(0, 157) + '...' : body;

    return {
      body: finalBody,
      generationMethod: 'template_fallback',
    };
  }

  return null;
}

/**
 * Build TemplateContext from a MessageContext and tenant data.
 */
export async function buildTemplateContext(
  messageContext: {
    customerName: string;
    companyName?: string;
    invoiceNumber: string;
    invoiceAmount: number;
    daysOverdue: number;
    totalOutstanding?: number;
    invoiceCount?: number;
    tenantName: string;
    tenantEmail?: string;
    tenantPhone?: string;
    currency?: string;
  },
  tenantId: string,
): Promise<TemplateContext> {
  const currency = messageContext.currency || '£';
  const total = messageContext.totalOutstanding || messageContext.invoiceAmount;

  // Try to get agent persona for name/title/contact
  let agentName = 'Accounts Team';
  let agentTitle = 'Credit Control';
  let agentEmail = messageContext.tenantEmail || '';
  let agentPhone = messageContext.tenantPhone || '';

  try {
    const persona = await storage.getActiveAgentPersona(tenantId);
    if (persona) {
      agentName = persona.emailSignatureName || persona.personaName || agentName;
      agentTitle = persona.emailSignatureTitle || persona.jobTitle || agentTitle;
      agentEmail = agentEmail; // Persona has no email field — use tenant email
      agentPhone = persona.emailSignaturePhone || agentPhone;
    }
  } catch {
    // Fall back to tenant-level info
  }

  return {
    companyName: messageContext.companyName || messageContext.customerName,
    contactName: messageContext.customerName || 'Accounts Department',
    totalOutstanding: `${currency}${total.toFixed(2)}`,
    oldestInvoiceRef: messageContext.invoiceNumber,
    oldestInvoiceDays: messageContext.daysOverdue,
    invoiceCount: messageContext.invoiceCount || 1,
    creditorName: messageContext.tenantName,
    agentName,
    agentTitle,
    agentEmail,
    agentPhone,
  };
}
