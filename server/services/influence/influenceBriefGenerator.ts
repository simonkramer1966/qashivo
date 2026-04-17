/**
 * Influence Brief Generator — assembles a plain-text block for LLM
 * prompt injection.
 *
 * The brief tells the LLM exactly how to structure the email using
 * the PCP (Perception-Context-Permission) framework, which techniques
 * to use, and which anti-patterns to avoid.
 *
 * Phase 2: technique keys from the strategy's `techniques[]` and `avoid[]`
 * arrays are translated into specific natural-language instructions via
 * TECHNIQUE_INSTRUCTIONS. Each instruction is detailed enough to produce
 * meaningfully different LLM output.
 */

import type { BarrierDiagnosis } from "./barrierDiagnostic";
import type { InfluenceStrategy } from "./strategySelector";
import type { SocialProofData } from "./cieConsumer";

// ── Technique translation layer ──────────────────────────────

const TECHNIQUE_INSTRUCTIONS: Record<string, string> = {
  label:
    "Use a Voss label to name the debtor's likely emotional state. Start with 'It seems like...' or 'It sounds like...' followed by an empathetic observation about their situation.",
  accusation_audit:
    "Open with an accusation audit — preemptively name the negative thought the debtor is having about receiving this email. 'I know another email about money is probably the last thing you need right now.' This disarms their defensive response.",
  calibrated_question:
    "Include a calibrated question starting with 'How' or 'What' that hands the problem to the debtor to solve. E.g. 'How would you suggest we resolve this?' or 'What would make it possible to get this resolved this week?'",
  no_oriented_question:
    "Use a 'no'-oriented question where a 'no' answer means agreement: 'Is there any reason this can't be settled this week?' A 'no' means it can be.",
  thats_right_setup:
    "Summarise the debtor's situation back to them with precision and empathy, so accurately that they would say 'that's right'. Only then move to your ask.",
  commitment:
    "Reference the debtor's own prior commitment — their agreed payment terms, their purchase order, or any previous promise.",
  social_proof:
    "Reference real aggregate data about how similar businesses behave: 'Most businesses in your sector settle within X days.' Only use this if CIE data is available in the influence brief. Never fabricate statistics.",
  authority:
    "Reference statutory rights, legislation (Late Payment of Commercial Debts Act 1998), or industry standards to add weight.",
  scarcity:
    "Create urgency through a genuine deadline: 'I can hold escalation until {date}' or 'Interest accrues from {date}'. The deadline must be real.",
  reciprocity:
    "Give something before asking: extended payment window, instalment plan, waived interest, resent documentation. Frame it as a courtesy.",
  unity:
    "Frame the situation as a shared problem: 'We both want to keep this commercial relationship working well.' Position yourself and the debtor on the same side.",
  mi_empathy:
    "Validate the debtor's situation without excusing the debt. 'I appreciate that managing cashflow across multiple commitments is never straightforward.'",
  mi_discrepancy:
    "Gently highlight the gap between the debtor's self-image (reliable, professional) and their current behaviour (late payment). 'You've always been a reliable partner, and I want to keep that record intact.'",
  mi_self_efficacy:
    "Assume the debtor is competent and willing. 'I know you'll want to get this squared away.' Never imply they are irresponsible.",
  mi_rolling_resistance:
    "If the debtor has pushed back previously, do not argue. Acknowledge and redirect: 'I understand this is difficult, and that's exactly why I'm presenting this option now.'",
  structured_options:
    "Present 2-3 specific options with concrete numbers and dates. Let the debtor choose rather than comply.",
  consequence:
    "Describe real consequences of inaction — statutory interest amount, next steps in the collections process, potential credit impact. Never fabricate or exaggerate.",
  helpful_framing:
    "Frame the communication as helpful rather than chasing. 'I wanted to make sure this hasn't been missed' rather than 'You haven't paid.'",
  friction_removal:
    "Include everything the debtor needs to pay right now — bank details, payment link, invoice reference. Remove every possible barrier to action.",
  professional_distance:
    "Maintain emotional distance. No warmth, no friendliness, no relationship language. Pure professionalism. The tone itself signals seriousness.",
  final_offer:
    "Frame this as the last opportunity for a managed resolution before formal proceedings. 'This is the last point where I can offer this arrangement.'",
  open_question:
    "Ask an open question that invites the debtor to share information: 'Is there anything I should know about from your end?' This opens dialogue rather than demanding compliance.",
};

/**
 * Look up a technique key. Returns the full instruction if found,
 * or the raw string as-is (for backward compat with any prose entries).
 */
function translateTechnique(key: string): string {
  return TECHNIQUE_INSTRUCTIONS[key] ?? key;
}

// ── Types ────────────────────────────────────────────────────

export interface DebtorBriefContext {
  contactName: string;
  companyName: string;
  totalChaseAmount: number;
  daysOverdue: number;
  currency: string;
}

// ── Main brief generator ─────────────────────────────────────

export function generateInfluenceBrief(
  diagnosis: BarrierDiagnosis,
  strategy: InfluenceStrategy,
  debtorContext: DebtorBriefContext,
  socialProof?: SocialProofData,
): string {
  const { contactName, companyName, totalChaseAmount, daysOverdue, currency } = debtorContext;

  const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" });
  const amount = fmt.format(totalChaseAmount);

  const lines: string[] = [];

  lines.push("=== INFLUENCE GUIDANCE ===");
  lines.push(`Barrier diagnosis: ${diagnosis.barrier.toUpperCase()}`);
  if (diagnosis.signals.length > 0) {
    lines.push(`  Signals: ${diagnosis.signals.join("; ")}`);
  }
  lines.push(`Strategy: ${strategy.name}`);
  lines.push(`Tone alignment: ${strategy.toneAlignment}`);
  lines.push(`Email length: ${strategy.emailLength}`);
  lines.push("");

  // PCP structure
  lines.push("PCP structure for this communication:");
  lines.push(`  PERCEPTION (opening 1-2 sentences): ${strategy.pcpGuidance.perception}`);
  lines.push(`  CONTEXT (middle section): ${strategy.pcpGuidance.context}`);
  lines.push(`  PERMISSION (closing 1-2 sentences): ${strategy.pcpGuidance.permission}`);
  lines.push("");

  // Subject line guidance
  lines.push("Subject line guidance:");
  lines.push(`  Style: ${strategy.subjectLineStyle}`);
  lines.push(`  Generate a subject line matching this style. Include the invoice reference where appropriate.`);
  lines.push("");

  // Techniques to use — translated from keys to full instructions
  lines.push("Techniques to use:");
  for (const t of strategy.techniques) {
    lines.push(`  - ${translateTechnique(t)}`);
  }
  lines.push("");

  // Techniques to AVOID — translated with DO NOT prefix
  lines.push("Techniques to AVOID:");
  for (const a of strategy.avoid) {
    const instruction = TECHNIQUE_INSTRUCTIONS[a];
    if (instruction) {
      lines.push(`  - DO NOT: ${instruction}`);
    } else {
      lines.push(`  - DO NOT: ${a}`);
    }
  }
  lines.push("");

  // CIE social proof — only actionable for motivation barrier
  if (socialProof?.available && diagnosis.barrier === "motivation") {
    lines.push("CIE social proof: AVAILABLE");
    lines.push(`  "${socialProof.percentSettledWithin45Days}% of ${socialProof.segmentLabel} settle within 45 days."`);
    lines.push("  Use this naturally in the Context phase. Never announce it as a statistic.");
  } else {
    lines.push("CIE social proof: NOT AVAILABLE");
    lines.push("  DO NOT fabricate social proof statistics. Skip this lever entirely.");
  }
  lines.push("");

  // Debtor-specific context
  lines.push(`Debtor: ${contactName} at ${companyName}`);
  lines.push(`Chase amount: ${amount}`);
  if (daysOverdue > 0) {
    lines.push(`Days overdue: ${daysOverdue}`);
  }
  lines.push("");

  // Universal anti-patterns — always included regardless of strategy
  lines.push("Anti-patterns (never do these):");
  lines.push('- Never open with "This is a reminder that..." or "We note that..."');
  lines.push("- Never use passive-aggressive language");
  lines.push("- Never pile on multiple demands. One ask per communication.");
  lines.push("- Never be sarcastic, condescending, or dismissive");
  lines.push("- Never send a communication without a clear, specific next step");
  lines.push('- Never use "promise to pay" or "PTP". Use "payment arrangement" or "confirmed payment date".');

  return lines.join("\n");
}

/**
 * Compressed brief for SMS — the PCP structure is still present but
 * compressed into a single-paragraph instruction.
 */
export function generateSmsInfluenceBrief(
  diagnosis: BarrierDiagnosis,
  strategy: InfluenceStrategy,
): string {
  const lines: string[] = [];

  lines.push("=== SMS INFLUENCE GUIDANCE ===");
  lines.push(`Barrier: ${diagnosis.barrier.toUpperCase()} | Strategy: ${strategy.name}`);
  lines.push(`Compress the PCP structure into 1-2 sentences maximum.`);
  lines.push(`The sequence (Perception > Context > Permission) is still present but compressed.`);
  // Translate first technique for the SMS hint
  const primaryTechnique = strategy.techniques[0]
    ? translateTechnique(strategy.techniques[0])
    : "";
  lines.push(`Tone: ${strategy.toneAlignment}. ${primaryTechnique}`);
  if (strategy.avoid.length > 0) {
    const avoidInstruction = TECHNIQUE_INSTRUCTIONS[strategy.avoid[0]];
    lines.push(`Avoid: ${avoidInstruction ?? strategy.avoid[0]}`);
  }

  return lines.join("\n");
}
