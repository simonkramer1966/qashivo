/**
 * Voice Call Influence Brief Generator — assembles a plain-text block
 * for injection into the Retell AI voice call prompt.
 *
 * The brief gives the LLM barrier-specific openings, calibrated questions,
 * de-escalation protocols, a voicemail script, and hard boundaries.
 *
 * Phase 3 of the Influence Engine.
 */

import type { InfluenceBarrier } from "./barrierDiagnostic";

// ── Barrier-specific content maps ───────────────────────────

const BARRIER_OPENINGS: Record<InfluenceBarrier, string> = {
  trigger:
    "I'm just calling to check in on invoice {ref} — I wanted to make sure it hasn't got stuck in your system anywhere.",
  ability:
    "I'm calling about the balance on your account — I appreciate things can get stretched, and I wanted to see if there's anything we can work out.",
  motivation:
    "I'm calling because invoice {ref} is now {days} days past your agreed terms, and I haven't been able to reach you by email.",
};

const BARRIER_QUESTIONS: Record<InfluenceBarrier, [string, string]> = {
  trigger: [
    "What's the best way to make sure this gets processed?",
    "What does your payment run look like?",
  ],
  ability: [
    "How would you like to structure the payments so it works for your cashflow?",
    "What would make it possible to get part of this cleared this week?",
  ],
  motivation: [
    "How would you suggest we resolve this?",
    "Is there any reason this can't be settled this week?",
  ],
};

// ── Types ────────────────────────────────────────────────────

export interface VoiceDebtorContext {
  contactFirstName: string;
  companyName: string;
  invoiceRef: string;
  amount: number;
  daysOverdue: number;
  currency: string;
}

export interface VoiceAgentContext {
  agentName: string;
  tenantCompanyName: string;
}

// ── Main brief generator ─────────────────────────────────────

export function generateVoiceCallBrief(
  barrier: InfluenceBarrier,
  strategyName: string,
  toneAlignment: string,
  debtorContext: VoiceDebtorContext,
  agentContext: VoiceAgentContext,
): string {
  const { contactFirstName, companyName, invoiceRef, amount, daysOverdue, currency } = debtorContext;
  const { agentName, tenantCompanyName } = agentContext;

  const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" });
  const formattedAmount = fmt.format(amount);

  // Interpolate barrier-specific opening
  const opening = BARRIER_OPENINGS[barrier]
    .replace("{ref}", invoiceRef)
    .replace("{days}", String(daysOverdue));

  const [q1, q2] = BARRIER_QUESTIONS[barrier];

  const lines: string[] = [];

  lines.push("=== INFLUENCE BRIEF FOR VOICE CALL ===");
  lines.push("");
  lines.push(`Debtor: ${contactFirstName} at ${companyName}`);
  lines.push(`Barrier: ${barrier.toUpperCase()}`);
  lines.push(`Strategy: ${strategyName}`);
  lines.push(`Tone: ${toneAlignment}`);
  lines.push("");

  // Opening
  lines.push("OPENING (first 15 seconds):");
  lines.push(`- Introduce: "Hi, this is ${agentName} from ${tenantCompanyName}."`);
  lines.push(`- Confirm: "Am I speaking with ${contactFirstName}?"`);
  lines.push(`- Frame: "${opening}"`);
  lines.push("");

  // Core
  lines.push("CORE (middle of call):");
  lines.push(`- Key facts: Invoice ${invoiceRef}, ${formattedAmount}, ${daysOverdue} days overdue`);
  lines.push(`- Calibrated question 1: "${q1}"`);
  lines.push(`- Calibrated question 2: "${q2}"`);
  lines.push("- Mirror technique: repeat their last 2-3 words to encourage elaboration");
  lines.push('- Label technique: "It sounds like {empathetic observation about their situation}"');
  lines.push("");

  // Close
  lines.push("CLOSE (securing commitment):");
  lines.push("- Get something specific: a date, an amount, a next step");
  lines.push(`- Summarise back: "So just to confirm, you'll {action} by {date}."`);
  lines.push("- Close warmly regardless of outcome");
  lines.push("");

  // Voicemail
  lines.push("IF VOICEMAIL (20 seconds max):");
  lines.push(`- "Hi ${contactFirstName}, this is ${agentName} from ${tenantCompanyName}."`);
  lines.push(`- "I'm calling about invoice ${invoiceRef} for ${formattedAmount}."`);
  lines.push('- "Could you give me a ring back when you get a chance?"');
  lines.push(`- "Thanks ${contactFirstName}, speak soon."`);
  lines.push("");

  // De-escalation
  lines.push("DE-ESCALATION (always apply these):");
  lines.push('- If raised voice: lower yours, pause, "I hear you, I completely understand"');
  lines.push("- If \"this is harassment\": \"I absolutely don't want you to feel that way. Let's resolve this now.\"");
  lines.push("- If \"I'll speak to my solicitor\": \"That's absolutely your right. The invoice remains outstanding. If you'd like to resolve it directly, I'm happy to discuss.\"");
  lines.push("- If abusive: one warning, then end call politely");
  lines.push("- If distress/vulnerability signals: de-escalate immediately, do not pursue payment");
  lines.push("");

  // Hard boundaries
  lines.push("HARD BOUNDARIES:");
  lines.push("- Never threaten legal action on a voice call");
  lines.push("- Never discuss the debt with anyone other than the confirmed contact");
  lines.push('- Never use "promise to pay" or "PTP" — use "payment arrangement" or "confirmed payment date"');

  return lines.join("\n");
}
