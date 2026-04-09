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
  hasUnallocatedPayments: boolean = false,
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

  // Invoice formatting (mandatory HTML table)
  lines.push(`INVOICE FORMATTING (MANDATORY):`);
  if (hasUnallocatedPayments) {
    lines.push(`- UNALLOCATED PAYMENT MODE: This debtor has confirmed payments that are not yet reconciled in Xero. DO NOT render an HTML invoice table. DO NOT reference specific invoice numbers or amounts. Chase only the net remaining balance provided in the user prompt.`);
  } else {
    lines.push(`- When invoice data is provided in the user prompt below AND there are no unallocated payments, present it in an HTML table with these exact columns: Invoice #, Amount, Due Date, Days Overdue. When no invoice data is provided, omit the table entirely.`);
  }
  lines.push(`- Never list invoices as inline text, bullet points, or comma-separated lists. Always use the HTML table.`);
  lines.push(`- Because the body must contain an HTML table, emit the ENTIRE email body as well-formed HTML: wrap each paragraph in <p>, use <br> for soft line breaks, and place the <table> between the relevant paragraphs. Do not mix plain text with HTML.`);
  lines.push(`- Use minimal inline styles for table compatibility: <table style="border-collapse:collapse;width:100%;margin:16px 0;">, <th style="border:1px solid #ddd;padding:8px;text-align:left;background:#f5f5f5;">, <td style="border:1px solid #ddd;padding:8px;">.`);
  lines.push(`- Everything else — greeting, paragraph count, tone, structure, call to action — adapts to tone level and debtor context. Do not follow a rigid template.`);
  lines.push("");

  // Email signature
  const signatureLines: string[] = [persona.emailSignatureName, persona.emailSignatureTitle];
  if (persona.emailSignatureCompany && persona.emailSignatureCompany !== persona.emailSignatureName) {
    signatureLines.push(persona.emailSignatureCompany);
  }
  lines.push(`EMAIL SIGNATURE (sign off with EXACTLY these lines, in this order, never substituting or duplicating):`);
  lines.push(`Line 1 — Name: ${signatureLines[0]}`);
  lines.push(`Line 2 — Title: ${signatureLines[1]}`);
  if (signatureLines[2]) {
    lines.push(`Line 3 — Company: ${signatureLines[2]}`);
  }
  if (persona.emailSignaturePhone) {
    lines.push(`Line 4 — Phone (optional): Tel: ${persona.emailSignaturePhone}`);
  }
  lines.push(`Never repeat the company name on multiple lines. Never replace the name line with the company name. Render the signature inside <p> tags with <br> between lines.`);
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
  isSmallBalance: boolean = false,
  unallocatedContext?: { hasUnallocatedPayments: boolean; netRemaining: number; unallocatedTotal: number },
): string {
  const sections: string[] = [];

  // Small-balance framing — overrides tone guidance and keeps the email short.
  // Set by the caller when the chase bundle is below the tenant's
  // smallAmountThreshold. The LLM must acknowledge the amount is minor and
  // stay warm regardless of the nominal tone parameter.
  if (isSmallBalance) {
    sections.push('SMALL BALANCE NOTE:');
    sections.push(
      'The chase amount is below the small-balance threshold. Frame the request warmly — ' +
      'acknowledge the amount is minor but explain it helps to keep the ledger clear. ' +
      'Keep the email short (3-4 sentences max). Use a friendly tone regardless of what the tone ' +
      'parameter says below.'
    );
    sections.push('');
  }

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

  // Outstanding invoices — these are the SPECIFIC invoices Charlie chose
  // to chase in this email (the action's bundle). The LLM must demand
  // payment of THIS amount only, not any relationship-wide total mentioned
  // in the conversation brief.
  if (unallocatedContext?.hasUnallocatedPayments) {
    sections.push(`NET AMOUNT TO CHASE (UNALLOCATED PAYMENT MODE):`);
    sections.push(`- The debtor has confirmed payments totalling ${formatCurrencyForPrompt(unallocatedContext.unallocatedTotal, debtor.currency)} that Xero has not yet reconciled.`);
    sections.push(`- Net remaining balance to chase: ${formatCurrencyForPrompt(unallocatedContext.netRemaining, debtor.currency)}`);
    sections.push(`- DO NOT reference any specific invoice number or amount in this email.`);
    sections.push(`- DO NOT render an HTML invoice table.`);
    sections.push(`- Acknowledge the payment with genuine thanks.`);
    sections.push(`- Ask only about the net remaining balance (${formatCurrencyForPrompt(unallocatedContext.netRemaining, debtor.currency)}). Use a warm, appreciative, relationship-first tone.`);
    sections.push(`- Keep the email short — this is a thank-you and a gentle chase, not a dunning letter.`);
    sections.push("");
  } else {
  sections.push(`INVOICES TO CHASE IN THIS EMAIL:`);
  if (invoices.length === 0) {
    sections.push("- No invoices to chase. Do not generate a payment demand.");
  } else {
    const chaseAmount = invoices.reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0);
    sections.push(`- AMOUNT TO DEMAND: ${formatCurrencyForPrompt(chaseAmount, debtor.currency)} (sum of the invoices below)`);
    sections.push(`- This is the ONLY amount you should ask the debtor to pay. Do NOT cite any larger or different total. The subject line must reference ${formatCurrencyForPrompt(chaseAmount, debtor.currency)}, not any other figure.`);
    sections.push('');
    sections.push(`Render the following invoices as the mandatory HTML table (columns: Invoice #, Amount, Due Date, Days Overdue):`);
    for (const inv of invoices) {
      const balance = inv.amount - inv.amountPaid;
      const overdueLabel = inv.daysOverdue > 0
        ? `${inv.daysOverdue} days overdue`
        : inv.daysOverdue === 0
          ? "due today"
          : `due in ${Math.abs(inv.daysOverdue)} days`;
      const dueStr = inv.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      sections.push(`  | ${inv.invoiceNumber} | ${formatCurrencyForPrompt(balance, debtor.currency)} | ${dueStr} | ${overdueLabel} |`);
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
  } // end unallocated/normal invoice branch
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
