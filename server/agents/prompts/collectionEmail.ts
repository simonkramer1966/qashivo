/**
 * Prompt assembly for collection email generation.
 * Follows the structure defined in MVP_V1_BUILD_SPEC.md Section 1.2.
 */

import type { AgentPersona } from "@shared/schema";
import { getLanguageName, getCurrencySymbol, formatCurrencyForPrompt } from "@shared/currencies";

// ── Input types ──────────────────────────────────────────────

export interface DebtorProfile {
  companyName: string;
  contactName: string;
  contactEmail: string;
  paymentTerms: number; // days
  creditLimit?: number;
  riskTag: "NORMAL" | "HIGH_VALUE";
  isPotentiallyVulnerable?: boolean;
  currency: string;    // resolved: contact.preferredCurrency ?? tenant.currency ?? 'GBP'
  language: string;    // resolved: contact.preferredLanguage ?? tenant.defaultLanguage ?? 'en-GB'
  arNotes?: string;
  behaviour?: {
    medianDaysToPay?: number;
    trend?: number; // positive = getting slower
    promiseBreachCount?: number;
    emailReplyRate?: number;
  };
  lpiContext?: {
    enabled: boolean;
    totalLPI: number;
    rateDisplay: string;   // "12.50% (BoE 4.50% + 8.00% statutory)"
    annualRate: number;
  };
  creditBalance?: number; // unapplied credits (credit notes/overpayments/prepayments)
}

export interface OutstandingInvoice {
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  dueDate: Date;
  daysOverdue: number;
  currency: string;
  workflowState: "pre_due" | "due" | "late" | "resolved";
  pauseState?: "dispute" | "ptp" | "payment_plan" | null;
  lpiAmount?: number;
  lpiDays?: number;
}

export interface ConversationEntry {
  date: Date;
  channel: string;
  direction: "outbound" | "inbound" | "internal";
  summary: string;
  outcomeType?: string;
  sentiment?: string;
}

export interface ActionContext {
  actionType: "pre_due_reminder" | "follow_up" | "escalation" | "final_notice";
  toneLevel: "friendly" | "professional" | "firm" | "formal";
  daysSinceLastContact: number;
  touchCount: number;
  phase?: "inform" | "elicit_date";
}

export interface PolicyConstraints {
  maxTouchesBeforeEscalation?: number;
  cooldownDaysBetweenTouches?: number;
}

// ── System prompt ────────────────────────────────────────────

export function buildSystemPrompt(
  persona: AgentPersona,
  policyConstraints?: PolicyConstraints,
  language: string = 'en-GB',
  currency: string = 'GBP',
): string {
  const lines: string[] = [];

  // Agent identity
  lines.push(`You are ${persona.personaName}, ${persona.jobTitle} at ${persona.emailSignatureCompany}.`);
  lines.push("");

  // Company & sector context
  if (persona.companyContext) {
    lines.push(`COMPANY CONTEXT:`);
    lines.push(persona.companyContext);
    lines.push("");
  }
  if (persona.sectorContext && persona.sectorContext !== "general") {
    lines.push(`SECTOR: ${persona.sectorContext}`);
    lines.push("");
  }

  // Communication objective
  lines.push(`COMMUNICATION OBJECTIVE:`);
  lines.push(`Your single objective is to obtain a specific payment date from the debtor.`);
  lines.push(`Most debtors intend to pay — they're just busy or disorganised. Your job is to nudge them forward, not threaten them.`);
  lines.push(`- Phase 1 (Inform): The invoice is new or recently overdue. Send one polite nudge. Do NOT ask for a payment date. Do NOT follow up on silence.`);
  lines.push(`- Phase 2 (Elicit Date): The invoice is significantly overdue. Actively seek a specific payment date. End with a clear, simple question the debtor can answer in one sentence.`);
  lines.push(`The current phase is provided in the ACTION CONTEXT below.`);
  lines.push(``);

  // Communication rules
  lines.push(`COMMUNICATION RULES:`);
  lines.push(`- Your default tone is: ${persona.toneDefault}. Adjust only when the action context specifies a different tone level.`);
  const langName = getLanguageName(language);
  const currSymbol = getCurrencySymbol(currency);
  if (language.startsWith('en')) {
    lines.push(`- Write in ${langName}. Format monetary amounts in ${currency} (${currSymbol}).`);
  } else {
    lines.push(`- Write the ENTIRE email body in ${langName}. The debtor speaks ${langName}.`);
    lines.push(`- Format monetary amounts in ${currency} (${currSymbol}).`);
    lines.push(`- Keep the email signature in English (do not translate names, titles, or company name).`);
  }
  lines.push(`- Be conversational and natural — never use template language like "[Customer Name]" or "[Invoice Number]".`);
  lines.push(`- Reference specific invoice details and any prior conversation history provided.`);
  lines.push(`- Never threaten legal action unless the action context is "final_notice" and tone is "formal".`);
  lines.push(`- Never disclose other debtors' names, amounts, or any confidential information.`);
  lines.push(`- Never use aggressive, harassing, or profane language.`);
  lines.push(`- LANGUAGE RULE: Never use the term "promise to pay" or "PTP" in any communication to the debtor. Use natural business language instead: "payment arrangement", "confirmed payment date", "agreed payment", "scheduled payment". The debtor should never feel they are being managed through a collections system.`);
  if (policyConstraints?.maxTouchesBeforeEscalation) {
    lines.push(`- Maximum ${policyConstraints.maxTouchesBeforeEscalation} contact attempts before escalation.`);
  }
  lines.push("");

  // Email signature
  lines.push(`EMAIL SIGNATURE (always end emails with this):`);
  lines.push(`${persona.emailSignatureName}`);
  lines.push(`${persona.emailSignatureTitle}`);
  lines.push(`${persona.emailSignatureCompany}`);
  if (persona.emailSignaturePhone) {
    lines.push(`Tel: ${persona.emailSignaturePhone}`);
  }
  lines.push("");

  // Output format
  lines.push(`OUTPUT FORMAT:`);
  lines.push(`Respond with valid JSON only, no markdown formatting:`);
  lines.push(`{`);
  lines.push(`  "subject": "Email subject line",`);
  lines.push(`  "body": "Full email body including signature",`);
  lines.push(`  "agentReasoning": "Brief explanation of why you chose this approach, tone, and key points (for internal audit only — never sent to the debtor)"`);
  lines.push(`}`);

  return lines.join("\n");
}

// ── User prompt (per debtor, per action) ─────────────────────

export function buildUserPrompt(
  debtor: DebtorProfile,
  invoices: OutstandingInvoice[],
  history: ConversationEntry[],
  action: ActionContext,
  conversationBrief?: string,
): string {
  const sections: string[] = [];

  // Conversation brief — full debtor context (injected before all other sections)
  if (conversationBrief) {
    sections.push(conversationBrief);
    sections.push('');
    sections.push('You are continuing an ongoing conversation with this debtor. Your message must:');
    sections.push('- Reference relevant previous interactions naturally');
    sections.push('- Acknowledge any active commitments or arrangements');
    sections.push('- Not contradict anything previously communicated');
    sections.push('- Not repeat information already sent if the debtor acknowledged it');
    sections.push('- Match the appropriate escalation level given the history');
    sections.push('- Never write as if this is the first contact unless it genuinely is');
    sections.push('');
  }

  // Debtor profile
  sections.push(`DEBTOR PROFILE:`);
  sections.push(`- Company: ${debtor.companyName}`);
  sections.push(`- Contact: ${debtor.contactName} (${debtor.contactEmail})`);
  sections.push(`- Payment terms: ${debtor.paymentTerms} days`);
  if (debtor.creditLimit) {
    sections.push(`- Credit limit: ${formatCurrencyForPrompt(debtor.creditLimit, debtor.currency)}`);
  }
  sections.push(`- Risk tag: ${debtor.riskTag}`);
  if (debtor.isPotentiallyVulnerable) {
    sections.push(`- VULNERABLE CUSTOMER: Use a softer, more empathetic approach. Maximum tone: Professional.`);
  }
  if (debtor.behaviour) {
    const b = debtor.behaviour;
    const parts: string[] = [];
    if (b.medianDaysToPay !== undefined) parts.push(`median ${Math.round(b.medianDaysToPay)} days to pay`);
    if (b.trend !== undefined) {
      parts.push(b.trend > 0 ? "payment speed declining" : b.trend < 0 ? "payment speed improving" : "stable payment pattern");
    }
    if (b.promiseBreachCount && b.promiseBreachCount > 0) parts.push(`${b.promiseBreachCount} missed payment commitment(s)`);
    if (b.emailReplyRate !== undefined) parts.push(`${Math.round(b.emailReplyRate * 100)}% email reply rate`);
    if (parts.length > 0) {
      sections.push(`- Payment behaviour: ${parts.join(", ")}`);
    }
  }
  if (debtor.arNotes) {
    sections.push(`- AR notes: ${debtor.arNotes}`);
  }
  sections.push("");

  // Outstanding invoices
  sections.push(`OUTSTANDING INVOICES:`);
  if (invoices.length === 0) {
    sections.push("- No outstanding invoices on record.");
  } else {
    const totalOwed = invoices.reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0);
    for (const inv of invoices) {
      const balance = inv.amount - inv.amountPaid;
      const stateInfo = inv.pauseState
        ? `${inv.workflowState} (paused: ${inv.pauseState})`
        : inv.workflowState;
      const overdueLabel = inv.daysOverdue > 0
        ? `${inv.daysOverdue} days overdue`
        : inv.daysOverdue === 0
          ? "due today"
          : `due in ${Math.abs(inv.daysOverdue)} days`;
      sections.push(`- ${inv.invoiceNumber}: ${formatCurrencyForPrompt(balance, debtor.currency)} — ${overdueLabel} — state: ${stateInfo}`);
    }
    sections.push(`- Total owed: ${formatCurrencyForPrompt(totalOwed, debtor.currency)}`);

    // Credit balance netting
    if (debtor.creditBalance && debtor.creditBalance > 0) {
      const netAmount = Math.max(0, totalOwed - debtor.creditBalance);
      sections.push(`- Unapplied credits: ${formatCurrencyForPrompt(debtor.creditBalance, debtor.currency)} (credit notes/overpayments)`);
      sections.push(`- NET amount owed after credits: ${formatCurrencyForPrompt(netAmount, debtor.currency)}`);
      sections.push(`- IMPORTANT: Reference the NET amount (${formatCurrencyForPrompt(netAmount, debtor.currency)}) in your email, NOT the gross total.`);
    }

    // LPI section
    if (debtor.lpiContext?.enabled && debtor.lpiContext.totalLPI > 0) {
      sections.push("");
      sections.push("LATE PAYMENT INTEREST (Late Payment of Commercial Debts (Interest) Act 1998):");
      sections.push(`- Annual rate: ${debtor.lpiContext.rateDisplay}`);
      sections.push(`- Total interest accrued: ${formatCurrencyForPrompt(debtor.lpiContext.totalLPI, debtor.currency)}`);
      for (const inv of invoices) {
        if (inv.lpiAmount && inv.lpiAmount > 0) {
          sections.push(`  - ${inv.invoiceNumber}: ${formatCurrencyForPrompt(inv.lpiAmount, debtor.currency)} interest (${inv.lpiDays} days)`);
        }
      }
    }
  }
  sections.push("");

  // Conversation history (last 10)
  const recentHistory = history.slice(0, 10);
  if (recentHistory.length > 0) {
    sections.push(`CONVERSATION HISTORY (most recent first):`);
    for (const entry of recentHistory) {
      const dateStr = entry.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      let line = `- [${dateStr}] ${entry.direction.toUpperCase()} via ${entry.channel}: ${entry.summary}`;
      if (entry.outcomeType) line += ` (outcome: ${entry.outcomeType})`;
      if (entry.sentiment) line += ` [sentiment: ${entry.sentiment}]`;
      sections.push(line);
    }
  } else {
    sections.push(`CONVERSATION HISTORY: No prior communication on record. This is the first contact.`);
  }
  sections.push("");

  // Action context with tone guidance
  const toneGuidance: Record<string, string> = {
    friendly: "Warm, approachable, relationship-focused. Use phrases like 'just a friendly reminder', 'we hope all is well'. No urgency.",
    professional: "Balanced, business-like, respectful. Clear payment request without pressure. Ask if there are any issues.",
    firm: "Direct and assertive. Emphasise overdue balance and request immediate attention. Mention prior correspondence. Offer to discuss payment arrangements.",
    formal: "Formal business language. Reference accumulated correspondence. Warn of potential escalation. Set clear deadlines. Mention consequences.",
  };

  sections.push(`CURRENT ACTION:`);
  sections.push(`- Action type: ${action.actionType.replace(/_/g, " ")}`);
  sections.push(`- Tone level: ${action.toneLevel}`);
  sections.push(`- Tone guidance: ${toneGuidance[action.toneLevel] || toneGuidance.professional}`);
  sections.push(`- Days since last contact: ${action.daysSinceLastContact}`);
  sections.push(`- Touch count for this debtor: ${action.touchCount}`);
  if (action.phase) {
    sections.push(`- Collection phase: ${action.phase === 'inform'
      ? 'Phase 1 (Inform) — one nudge only, do not chase silence, do not ask for a payment date'
      : 'Phase 2 (Elicit Date) — actively seek a specific payment date, end with a clear question'}`);
  }
  sections.push("");

  // Instruction
  sections.push(`INSTRUCTION:`);
  sections.push(`Generate a collection email with a subject line and body.`);
  sections.push(`Address the email to ${debtor.contactName}.`);
  sections.push(`Sign off as your persona (use the email signature provided in your identity).`);
  sections.push(`Reference specific invoice details and any prior conversation.`);
  if (action.phase === "inform") {
    sections.push(`This is a Phase 1 informational nudge. Keep it brief and helpful. Do NOT ask when they will pay — just remind them the invoice exists. If this is pre-due, frame it as a courtesy heads-up.`);
  } else if (action.phase === "elicit_date") {
    sections.push(`This is a Phase 2 communication. Your primary goal is to obtain a specific payment date. End the email with a clear, simple question like "Could you let me know when we might expect payment?" Make it easy for the debtor to reply in one sentence.`);
  }
  if (action.actionType === "pre_due_reminder") {
    sections.push(`This is a pre-due reminder — keep the tone light and helpful. The invoice is not yet overdue.`);
  } else if (action.actionType === "escalation") {
    sections.push(`This is an escalation — express concern about the overdue balance and emphasise the importance of payment.`);
  } else if (action.actionType === "final_notice") {
    sections.push(`This is a final notice — clearly state the consequences of non-payment and set a clear deadline.`);
  }
  if (debtor.lpiContext?.enabled && debtor.lpiContext.totalLPI > 0) {
    sections.push(`Include a paragraph stating the company's right to charge interest under the Late Payment of Commercial Debts (Interest) Act 1998. State the rate (${debtor.lpiContext.rateDisplay}) and accrued amount (${formatCurrencyForPrompt(debtor.lpiContext.totalLPI, debtor.currency)}). Keep factual and professional — not threatening.`);
  }

  return sections.join("\n");
}
