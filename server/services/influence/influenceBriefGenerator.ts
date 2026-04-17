/**
 * Influence Brief Generator — assembles a plain-text block for LLM
 * prompt injection.
 *
 * The brief tells the LLM exactly how to structure the email using
 * the PCP (Perception-Context-Permission) framework, which techniques
 * to use, and which anti-patterns to avoid.
 */

import type { BarrierDiagnosis } from "./barrierDiagnostic";
import type { InfluenceStrategy } from "./strategySelector";

export interface DebtorBriefContext {
  contactName: string;
  companyName: string;
  totalChaseAmount: number;
  daysOverdue: number;
  currency: string;
}

export function generateInfluenceBrief(
  diagnosis: BarrierDiagnosis,
  strategy: InfluenceStrategy,
  debtorContext: DebtorBriefContext,
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
  lines.push(`Subject line style: ${strategy.subjectLineStyle}`);
  lines.push("");

  lines.push("PCP structure for this communication:");
  lines.push(`  PERCEPTION (opening 1-2 sentences): ${strategy.pcpGuidance.perception}`);
  lines.push(`  CONTEXT (middle section): ${strategy.pcpGuidance.context}`);
  lines.push(`  PERMISSION (closing 1-2 sentences): ${strategy.pcpGuidance.permission}`);
  lines.push("");

  lines.push("Techniques to use:");
  for (const t of strategy.techniques) {
    lines.push(`  - ${t}`);
  }
  lines.push("");

  lines.push("Techniques to AVOID:");
  for (const a of strategy.avoid) {
    lines.push(`  - ${a}`);
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
  lines.push(`Tone: ${strategy.toneAlignment}. ${strategy.techniques[0] || ""}`);
  if (strategy.avoid.length > 0) {
    lines.push(`Avoid: ${strategy.avoid[0]}`);
  }

  return lines.join("\n");
}
