import { storage } from "../storage";
import { generateText } from "./llm/claude";
import type { Invoice, Contact, WeeklyReview, ForecastUserAdjustment } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────

interface DebtorScenario {
  contactId: string;
  contactName: string;
  totalOwed: number;
  invoiceCount: number;
  oldestDueDate: string;
  avgDaysToPay: number | null;
  optimisticDate: string; // pay on due date
  expectedDate: string; // pay at historical average
  pessimisticDate: string; // 50% later than average
}

interface ScenarioTotals {
  expectedIn: number;
  expectedOut: number;
  netPosition: number;
  pressurePoints: string[];
}

interface KeyNumbers {
  optimistic: ScenarioTotals;
  expected: ScenarioTotals;
  pessimistic: ScenarioTotals;
}

interface DebtorFocusItem {
  contactId: string;
  contactName: string;
  totalOwed: number;
  invoiceCount: number;
  risk: "low" | "medium" | "high";
  note: string;
}

// ── Helpers ──────────────────────────────────────────────────

function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
  };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

/**
 * Group overdue invoices by contact and calculate per-debtor scenarios.
 */
function buildDebtorScenarios(
  overdueInvoices: (Invoice & { contact: Contact })[],
  globalAvgDaysToPay: number,
): DebtorScenario[] {
  const byContact: Record<string, { contact: Contact; invoices: Invoice[] }> = {};

  for (const inv of overdueInvoices) {
    const cid = inv.contactId || "unknown";
    if (!byContact[cid]) {
      byContact[cid] = { contact: inv.contact, invoices: [] };
    }
    byContact[cid].invoices.push(inv);
  }

  const scenarios: DebtorScenario[] = [];

  for (const contactId of Object.keys(byContact)) {
    const { contact, invoices } = byContact[contactId];
    const totalOwed = invoices.reduce(
      (sum: number, i: Invoice) => sum + Number(i.amount ?? 0) - Number(i.amountPaid ?? 0),
      0,
    );
    const dueDates = invoices
      .map((i: Invoice) => (i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : null))
      .filter(Boolean) as string[];
    const oldestDueDate = dueDates.sort()[0] || new Date().toISOString().slice(0, 10);

    // Use contact-level avgDaysToPay if available, else global
    const avg = (contact as any).avgDaysToPay ?? globalAvgDaysToPay;

    scenarios.push({
      contactId,
      contactName: contact.name || "Unknown",
      totalOwed,
      invoiceCount: invoices.length,
      oldestDueDate,
      avgDaysToPay: avg || null,
      optimisticDate: oldestDueDate, // pays on original due date
      expectedDate: addDays(oldestDueDate, avg || globalAvgDaysToPay),
      pessimisticDate: addDays(
        oldestDueDate,
        (avg || globalAvgDaysToPay) * 1.5,
      ),
    });
  }

  // Sort by totalOwed descending
  return scenarios.sort((a, b) => b.totalOwed - a.totalOwed);
}

/**
 * Determine if a forecast adjustment represents an outflow.
 */
function isOutflow(adj: ForecastUserAdjustment): boolean {
  return adj.affects === "outflows";
}

/**
 * Build three-scenario cashflow estimates for the next 3 weeks.
 */
function buildScenarioTotals(
  scenarios: DebtorScenario[],
  metrics: { totalOutstanding: number },
  forecastAdjustments: ForecastUserAdjustment[],
): KeyNumbers {
  const totalAR = Number(metrics.totalOutstanding);

  // Sum known outflows from forecast adjustments
  const knownOutflows = forecastAdjustments
    .filter(isOutflow)
    .reduce((sum: number, a) => sum + Math.abs(Number(a.amount ?? 0)), 0);

  const optimisticIn = totalAR; // everyone pays on time
  const expectedIn = totalAR * 0.7; // ~70% at historical pace
  const pessimisticIn = totalAR * 0.45; // slow payers

  const pressurePoints: string[] = [];
  const topDebtors = scenarios.slice(0, 3);
  for (const d of topDebtors) {
    if (d.totalOwed > totalAR * 0.2) {
      pressurePoints.push(
        `${d.contactName} owes £${d.totalOwed.toLocaleString("en-GB", { minimumFractionDigits: 2 })} (${d.invoiceCount} invoice${d.invoiceCount > 1 ? "s" : ""})`,
      );
    }
  }

  return {
    optimistic: {
      expectedIn: optimisticIn,
      expectedOut: knownOutflows,
      netPosition: optimisticIn - knownOutflows,
      pressurePoints: [],
    },
    expected: {
      expectedIn,
      expectedOut: knownOutflows,
      netPosition: expectedIn - knownOutflows,
      pressurePoints,
    },
    pessimistic: {
      expectedIn: pessimisticIn,
      expectedOut: knownOutflows,
      netPosition: pessimisticIn - knownOutflows,
      pressurePoints,
    },
  };
}

// ── Claude CFO Prompt ────────────────────────────────────────

function buildCFOPrompt(params: {
  weekStart: string;
  weekEnd: string;
  metrics: Record<string, unknown>;
  keyNumbers: KeyNumbers;
  topDebtors: DebtorScenario[];
  dsoTrend: Array<{ date: unknown; dso: unknown }>;
  forecastAdjustments: Array<Record<string, unknown>>;
  previousSummary: string | null;
}): string {
  return `You are the CFO advisor for a UK SME. Write a weekly cash collection review.

DATA CONTEXT:
- Week: ${params.weekStart} to ${params.weekEnd}
- AR Metrics: ${JSON.stringify(params.metrics)}
- Three-Scenario Forecast: ${JSON.stringify(params.keyNumbers)}
- Top Debtors (by amount owed): ${JSON.stringify(params.topDebtors.slice(0, 8))}
- DSO Trend (last 4 weeks): ${JSON.stringify(params.dsoTrend.slice(-4))}
- Known Outflows/Adjustments: ${JSON.stringify(params.forecastAdjustments)}
${params.previousSummary ? `- Previous Review Summary: ${params.previousSummary.slice(0, 500)}` : "- No previous review available."}

INSTRUCTIONS:
Write a plain-English weekly review in 3-4 paragraphs covering:
1. This week's cash position and collections performance
2. What to expect over the next 2-3 weeks (reference the three scenarios)
3. Key risks and which debtors need attention
4. One or two specific recommendations

After the prose, output a JSON block with debtor focus items. Use this exact format:

---DEBTOR_FOCUS_JSON---
[
  {
    "contactId": "...",
    "contactName": "...",
    "totalOwed": 0,
    "invoiceCount": 0,
    "risk": "low|medium|high",
    "note": "Brief actionable note"
  }
]
---END_JSON---

Write in plain prose paragraphs only. Do not use markdown headers (##), horizontal rules (---), bold markers (**), or a title line. The UI provides all formatting — just write the content as flowing paragraphs.

Keep the tone professional but accessible — this is for a business owner, not an accountant.
Use GBP (£) for all amounts. Be specific with numbers, not vague.`;
}

// ── Main Generation Function ─────────────────────────────────

export async function generateWeeklyReview(
  tenantId: string,
): Promise<WeeklyReview> {
  const { weekStart, weekEnd } = getWeekBounds();

  // Assemble data context in parallel
  const [metrics, overdueInvoices, dsoSnapshots, forecastAdjustments, previousReview, _recentActions] =
    await Promise.all([
      storage.getInvoiceMetrics(tenantId),
      storage.getOverdueInvoices(tenantId),
      storage.getDsoSnapshots(tenantId, 30),
      storage.listForecastAdjustments(tenantId),
      storage.getLatestWeeklyReview(tenantId),
      storage.getActions(tenantId, 50),
    ]);

  // Build debtor scenarios
  const debtorScenarios = buildDebtorScenarios(
    overdueInvoices,
    metrics.avgDaysToPay || 30,
  );

  // Build three-scenario cashflow estimates
  const keyNumbers = buildScenarioTotals(
    debtorScenarios,
    metrics,
    forecastAdjustments,
  );

  // DSO trend for prompt
  const dsoTrend = dsoSnapshots.map((s) => ({
    date: s.snapshotDate,
    dso: Number(s.dsoValue),
  }));

  // Call Claude with CFO review prompt
  const prompt = buildCFOPrompt({
    weekStart,
    weekEnd,
    metrics: {
      totalOutstanding: metrics.totalOutstanding,
      overdueCount: metrics.overdueCount,
      collectionRate: metrics.collectionRate,
      avgDaysToPay: metrics.avgDaysToPay,
      dso: metrics.dso,
      collectedThisWeek: metrics.collectedThisWeek,
      collectedThisMonth: metrics.collectedThisMonth,
      onTimePaymentRate: metrics.onTimePaymentRate,
    },
    keyNumbers,
    topDebtors: debtorScenarios,
    dsoTrend,
    forecastAdjustments: forecastAdjustments.map((a) => ({
      description: a.description,
      amount: a.amount,
      category: a.category,
      affects: a.affects,
      timingType: a.timingType,
    })),
    previousSummary: previousReview?.summaryText || null,
  });

  const response = await generateText({
    system:
      "You are Riley, the AI CFO assistant for Qashivo. You provide weekly cash collection reviews for UK SMEs.",
    prompt,
    model: "standard",
    temperature: 0.4,
    maxTokens: 2048,
  });

  // Parse response: prose before the JSON marker, debtor focus after
  let summaryText = response;
  let debtorFocus: DebtorFocusItem[] = [];

  const jsonMarker = "---DEBTOR_FOCUS_JSON---";
  const endMarker = "---END_JSON---";
  const jsonStart = response.indexOf(jsonMarker);

  if (jsonStart !== -1) {
    summaryText = response.slice(0, jsonStart).trim();
    const jsonEnd = response.indexOf(endMarker, jsonStart);
    const jsonStr = response.slice(
      jsonStart + jsonMarker.length,
      jsonEnd !== -1 ? jsonEnd : undefined,
    ).trim();

    try {
      debtorFocus = JSON.parse(jsonStr);
    } catch (err) {
      console.error("[WeeklyReview] Failed to parse debtor focus JSON:", err);
      // Fall back to generated scenarios
      debtorFocus = debtorScenarios.slice(0, 5).map((d) => ({
        contactId: d.contactId,
        contactName: d.contactName,
        totalOwed: d.totalOwed,
        invoiceCount: d.invoiceCount,
        risk: d.totalOwed > 5000 ? ("high" as const) : d.totalOwed > 1000 ? ("medium" as const) : ("low" as const),
        note: `${d.invoiceCount} overdue invoice${d.invoiceCount > 1 ? "s" : ""}, oldest due ${d.oldestDueDate}`,
      }));
    }
  }

  // Save to database
  const review = await storage.createWeeklyReview({
    tenantId,
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    summaryText,
    keyNumbers,
    debtorFocus,
    forecastAdjustmentsUsed: forecastAdjustments.map((a) => ({
      id: a.id,
      description: a.description,
      amount: a.amount,
      category: a.category,
      affects: a.affects,
    })),
    previousReviewId: previousReview?.id || null,
  });

  console.log(
    `[WeeklyReview] Generated review for tenant ${tenantId}: week ${weekStart} to ${weekEnd}`,
  );

  return review;
}
