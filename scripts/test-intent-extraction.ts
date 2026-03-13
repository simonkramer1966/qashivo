#!/usr/bin/env tsx
/**
 * Intent Extraction Test Suite
 *
 * Tests the Claude-powered intent extraction against realistic debtor reply scenarios.
 * Calls the live Claude API — requires ANTHROPIC_API_KEY in environment.
 * Does NOT require a database connection.
 *
 * Usage:
 *   tsx scripts/test-intent-extraction.ts
 */

import "dotenv/config";
import { generateJSON } from "../server/services/llm/claude";

// ── Intent types (mirrors intentAnalyst.ts) ────────────────────────────────

type IntentType =
  | "promise_to_pay"
  | "acknowledge"
  | "dispute"
  | "payment_notification"
  | "payment_query"
  | "payment_plan"
  | "general"
  | "unclear";

type Sentiment = "positive" | "neutral" | "negative" | "frustrated";

interface IntentResult {
  intentType: string;
  confidence: number;
  sentiment: Sentiment;
  extractedEntities: {
    amounts?: string[];
    dates?: string[];
    resolvedDates?: string[];
    promises?: string[];
    reasons?: string[];
    invoiceReferences?: string[];
    disputeReason?: string;
    affectedInvoices?: string[];
    suggestedApproach?: string;
  };
  reasoning: string;
  requiresHumanReview: boolean;
  suggestedNextAction?: string;
}

// ── Prompt builder (extracted from intentAnalyst.ts) ───────────────────────

function buildPrompt(
  message: string,
  context?: {
    contactName?: string;
    companyName?: string;
    invoiceAmount?: number;
    invoiceNumbers?: string[];
    daysPastDue?: number;
  },
): string {
  let prompt = "Analyse this debtor email reply and extract structured intent:\n\n";

  if (context?.contactName || context?.companyName) {
    prompt += `DEBTOR: ${context.contactName || "Unknown"}`;
    if (context.companyName) prompt += ` at ${context.companyName}`;
    prompt += "\n";
  }
  if (context?.invoiceNumbers?.length || context?.invoiceAmount) {
    prompt += "REGARDING: ";
    if (context?.invoiceNumbers?.length) prompt += `Invoice(s) ${context.invoiceNumbers.join(", ")}`;
    if (context?.invoiceAmount) prompt += ` totalling £${context.invoiceAmount.toFixed(2)}`;
    prompt += "\n";
  }
  if (context?.daysPastDue !== undefined) {
    if (context.daysPastDue > 0) {
      prompt += `STATUS: ${context.daysPastDue} days overdue\n`;
    } else if (context.daysPastDue === 0) {
      prompt += "STATUS: Due today\n";
    } else {
      prompt += `STATUS: ${Math.abs(context.daysPastDue)} days until due\n`;
    }
  }

  prompt += `THEIR REPLY:\n"${message}"\n\n`;

  prompt += `Today's date: ${new Date().toISOString().split("T")[0]}

Respond with JSON:
{
  "intentType": "promise_to_pay" | "acknowledge" | "dispute" | "payment_notification" | "payment_query" | "payment_plan" | "general" | "unclear",
  "confidence": 0.0 to 1.0,
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "extractedEntities": {
    "amounts": ["any monetary amounts mentioned"],
    "dates": ["any dates or timeframes as written"],
    "resolvedDates": ["resolved ISO dates, e.g., '2026-03-31' for 'end of month'"],
    "promises": ["any payment commitments"],
    "reasons": ["reasons for dispute, delay, or non-payment"],
    "invoiceReferences": ["invoice numbers, PO numbers"],
    "disputeReason": "specific reason if dispute",
    "affectedInvoices": ["which invoice numbers the dispute covers"],
    "suggestedApproach": "brief guidance for the Collections Agent's reply"
  },
  "reasoning": "brief explanation of your classification",
  "requiresHumanReview": true/false,
  "suggestedNextAction": "recommended next step"
}

DATE RESOLUTION RULES:
- "end of month" → last day of current month as ISO date
- "next Friday" → the coming Friday as ISO date
- "15th March" → 2026-03-15
- "within 7 days" → today + 7 days as ISO date
- Always populate both dates (as written) and resolvedDates (as ISO)`;

  return prompt;
}

const SYSTEM_PROMPT = `You are Charlie, an expert B2B credit control AI analysing inbound debtor communications.
Your role is to detect intent, extract actionable information, and recommend the Collections Agent's response approach.

Intent Types:
- promise_to_pay: Debtor commits to paying by a specific date. MUST extract and resolve the date.
- acknowledge: Debtor acknowledges receipt but makes NO firm payment commitment.
- dispute: Debtor disputes the invoice — extract disputeReason and affectedInvoices.
- payment_notification: Debtor confirms payment has already been made or is in process.
- payment_query: Questions about invoice amounts, payment details, bank details.
- payment_plan: Debtor wants to negotiate instalments.
- general: General non-payment communication.
- unclear: Intent genuinely unclear or too brief to classify.

Sentiment:
- positive: Cooperative, willing to pay
- neutral: Business-like, factual
- negative: Unhappy, pushing back
- frustrated: Angry, repeated chasing complaints, hostile

Respond with valid JSON only.`;

// ── Analyse function ────────────────────────────────────────────────────────

async function analyseIntent(
  message: string,
  context?: Parameters<typeof buildPrompt>[1],
): Promise<IntentResult> {
  const prompt = buildPrompt(message, context);
  const result = await generateJSON<any>({
    system: SYSTEM_PROMPT,
    prompt,
    model: "fast",
    temperature: 0.3,
  });

  // Normalise legacy types
  let intentType = result.intentType || "unclear";
  if (intentType === "payment_confirmation") intentType = "payment_notification";
  if (intentType === "general_query") intentType = "payment_query";

  return {
    intentType,
    confidence: Math.min(Math.max(result.confidence || 0, 0), 1),
    sentiment: result.sentiment || "neutral",
    extractedEntities: {
      ...(result.extractedEntities || {}),
      resolvedDates: result.extractedEntities?.resolvedDates || [],
      suggestedApproach: result.extractedEntities?.suggestedApproach || result.suggestedApproach || undefined,
    },
    reasoning: result.reasoning || "",
    requiresHumanReview: result.requiresHumanReview ?? false,
    suggestedNextAction: result.suggestedNextAction,
  };
}

// ── Test scenarios ──────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  message: string;
  context?: Parameters<typeof buildPrompt>[1];
  expectedIntent: string;
  expectedSentiment?: string;
  expectResolvedDate?: boolean;
  expectDisputeReason?: boolean;
  expectSuggestedApproach?: boolean;
}

const TEST_CASES: TestCase[] = [
  {
    name: "PTP: end of month",
    message:
      "Hi, apologies for the delay. We'll get this paid by end of month. Our accounts team is processing it now.",
    context: {
      contactName: "Sarah Jones",
      companyName: "Apex Recruitment Ltd",
      invoiceAmount: 4250.0,
      invoiceNumbers: ["INV-2024-0087"],
      daysPastDue: 12,
    },
    expectedIntent: "promise_to_pay",
    expectedSentiment: "positive",
    expectResolvedDate: true,
    expectSuggestedApproach: true,
  },
  {
    name: "PTP: next Friday",
    message:
      "Thanks for the reminder. I've just spoken with finance and they'll release payment next Friday.",
    context: {
      contactName: "Tom Barker",
      companyName: "TechHire Solutions",
      invoiceAmount: 7800.0,
      invoiceNumbers: ["INV-2024-0102"],
      daysPastDue: 5,
    },
    expectedIntent: "promise_to_pay",
    expectResolvedDate: true,
  },
  {
    name: "PTP: 15th March",
    message:
      "We can confirm payment of the full balance will be made on 15th March via BACS.",
    context: {
      contactName: "Angela Moss",
      companyName: "DataStream Consulting",
      invoiceAmount: 12500.0,
      invoiceNumbers: ["INV-2024-0115", "INV-2024-0116"],
      daysPastDue: 21,
    },
    expectedIntent: "promise_to_pay",
    expectResolvedDate: true,
  },
  {
    name: "Acknowledge: will check",
    message:
      "Thanks for your email. I've forwarded this to our accounts team and will get back to you.",
    context: {
      contactName: "Mike Chen",
      companyName: "Staffline Group",
      invoiceAmount: 3200.0,
      daysPastDue: 7,
    },
    expectedIntent: "acknowledge",
  },
  {
    name: "Dispute: quality issue",
    message:
      "I'm not paying INV-2024-0098 until we resolve the issue with the candidate you placed. They left after two weeks and the replacement hasn't been provided as agreed.",
    context: {
      contactName: "Rachel Green",
      companyName: "Premier Staffing",
      invoiceAmount: 6500.0,
      invoiceNumbers: ["INV-2024-0098"],
      daysPastDue: 18,
    },
    expectedIntent: "dispute",
    expectedSentiment: "negative",
    expectDisputeReason: true,
    expectSuggestedApproach: true,
  },
  {
    name: "Payment notification: BACS sent",
    message:
      "Just to let you know, BACS payment was submitted yesterday for £4,250. Should be with you in 2-3 working days.",
    context: {
      contactName: "David Park",
      companyName: "Resource Group",
      invoiceAmount: 4250.0,
      invoiceNumbers: ["INV-2024-0087"],
      daysPastDue: 14,
    },
    expectedIntent: "payment_notification",
    expectedSentiment: "positive",
  },
  {
    name: "Payment query: bank details",
    message:
      "Could you send over your bank details? We've changed our payments system and need to set you up again as a new supplier.",
    context: {
      contactName: "Lisa Wong",
      companyName: "Talent Bridge",
      invoiceAmount: 9800.0,
      daysPastDue: 3,
    },
    expectedIntent: "payment_query",
  },
  {
    name: "Frustrated: repeated chasing",
    message:
      "This is the fourth email I've received about this. I've already told your colleague we're waiting for a credit note for INV-2024-0066 before we can process the remaining invoices. Stop sending automated reminders.",
    context: {
      contactName: "James Wright",
      companyName: "CoreStaff Ltd",
      invoiceAmount: 15200.0,
      invoiceNumbers: ["INV-2024-0066", "INV-2024-0070", "INV-2024-0071"],
      daysPastDue: 28,
    },
    expectedIntent: "dispute",
    expectedSentiment: "frustrated",
    expectSuggestedApproach: true,
  },
  {
    name: "Acknowledge: minimal",
    message: "OK noted.",
    context: {
      contactName: "Amy Patel",
      companyName: "Pinnacle Recruit",
      invoiceAmount: 2100.0,
      daysPastDue: 10,
    },
    expectedIntent: "acknowledge",
  },
  {
    name: "General: unrelated",
    message:
      "Hi Charlie, quick question — do you have any candidates available for a senior developer role? We're looking to hire in Q2.",
    context: { contactName: "Ben Taylor", companyName: "FutureHire" },
    expectedIntent: "general",
  },
];

// ── Runner ──────────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  expectedIntent: string;
  actualIntent: string;
  confidence: number;
  sentiment: string;
  resolvedDates: string[];
  disputeReason: string | undefined;
  suggestedApproach: string | undefined;
  reasoning: string;
  failures: string[];
  durationMs: number;
}

async function runTests(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Intent Extraction Test Suite — Claude-powered");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("  ERROR: ANTHROPIC_API_KEY not set in environment.\n");
    process.exit(1);
  }

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    process.stdout.write(`  ▸ ${tc.name}... `);
    const start = Date.now();

    try {
      const analysis = await analyseIntent(tc.message, tc.context);
      const durationMs = Date.now() - start;
      const failures: string[] = [];

      if (analysis.intentType !== tc.expectedIntent) {
        failures.push(`intent: expected "${tc.expectedIntent}", got "${analysis.intentType}"`);
      }
      if (tc.expectedSentiment && analysis.sentiment !== tc.expectedSentiment) {
        failures.push(`sentiment: expected "${tc.expectedSentiment}", got "${analysis.sentiment}"`);
      }
      const resolvedDates = analysis.extractedEntities.resolvedDates || [];
      if (tc.expectResolvedDate && resolvedDates.length === 0) {
        failures.push("resolvedDates: expected at least one ISO date, got none");
      }
      if (tc.expectDisputeReason && !analysis.extractedEntities.disputeReason) {
        failures.push("disputeReason: expected but not present");
      }
      if (tc.expectSuggestedApproach && !analysis.extractedEntities.suggestedApproach) {
        failures.push("suggestedApproach: expected but not present");
      }

      const testPassed = failures.length === 0;
      if (testPassed) {
        passed++;
        console.log(`✅ (${durationMs}ms)`);
      } else {
        failed++;
        console.log(`❌ (${durationMs}ms)`);
        for (const f of failures) console.log(`      └─ ${f}`);
      }

      results.push({
        name: tc.name,
        passed: testPassed,
        expectedIntent: tc.expectedIntent,
        actualIntent: analysis.intentType,
        confidence: analysis.confidence,
        sentiment: analysis.sentiment,
        resolvedDates,
        disputeReason: analysis.extractedEntities.disputeReason,
        suggestedApproach: analysis.extractedEntities.suggestedApproach,
        reasoning: analysis.reasoning,
        failures,
        durationMs,
      });
    } catch (err: any) {
      failed++;
      const durationMs = Date.now() - start;
      console.log(`💥 ERROR (${durationMs}ms): ${err.message}`);
      results.push({
        name: tc.name,
        passed: false,
        expectedIntent: tc.expectedIntent,
        actualIntent: "ERROR",
        confidence: 0,
        sentiment: "unknown",
        resolvedDates: [],
        disputeReason: undefined,
        suggestedApproach: undefined,
        reasoning: err.message,
        failures: [`threw: ${err.message}`],
        durationMs,
      });
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed}/${TEST_CASES.length} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Detailed table
  console.log("┌──────────────────────────────────┬──────────────────────┬───────┬────────────┬──────────────────────────────────┐");
  console.log("│ Test                             │ Intent (exp → act)   │ Conf  │ Sentiment  │ Resolved Dates                   │");
  console.log("├──────────────────────────────────┼──────────────────────┼───────┼────────────┼──────────────────────────────────┤");

  for (const r of results) {
    const name = r.name.padEnd(32).slice(0, 32);
    const match = r.expectedIntent === r.actualIntent ? "✓" : "✗";
    const intent = `${match} ${r.actualIntent}`.padEnd(20).slice(0, 20);
    const conf = `${(r.confidence * 100).toFixed(0)}%`.padStart(5);
    const sent = r.sentiment.padEnd(10).slice(0, 10);
    const dates = (r.resolvedDates.join(", ") || "—").padEnd(32).slice(0, 32);
    console.log(`│ ${name} │ ${intent} │ ${conf} │ ${sent} │ ${dates} │`);
  }
  console.log("└──────────────────────────────────┴──────────────────────┴───────┴────────────┴──────────────────────────────────┘");

  // Print suggested approaches
  console.log("\n── Suggested Approaches ──\n");
  for (const r of results) {
    if (r.suggestedApproach) {
      console.log(`  ${r.name}: ${r.suggestedApproach}`);
    }
  }

  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
