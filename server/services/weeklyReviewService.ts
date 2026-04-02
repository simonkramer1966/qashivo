import { storage } from "../storage";
import { generateText } from "./llm/claude";
import type { Invoice, Contact, WeeklyReview } from "@shared/schema";
import { fitDistribution, getPaymentForecast, getSeasonalAdjustments, type SeasonalAdjustment } from "./paymentDistribution";

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
 *
 * Gap 7: Uses log-normal distribution to produce data-driven three-scenario
 * forecasts instead of hardcoded multipliers (optimistic=due date,
 * expected=avg, pessimistic=1.5×avg). The distribution incorporates
 * medianDaysToPay, p75DaysToPay, volatility, and trend from behavior signals.
 */
function buildDebtorScenarios(
  overdueInvoices: (Invoice & { contact: Contact })[],
  globalAvgDaysToPay: number,
  behaviorSignalsByContact?: Map<string, { medianDaysToPay: number | null; p75DaysToPay: number | null; volatility: number | null; trend: number | null }>,
  seasonalByContact?: Map<string, SeasonalAdjustment[]>,
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

    // Gap 7: Use log-normal distribution for scenario dates
    const signals = behaviorSignalsByContact?.get(contactId);
    const median = signals?.medianDaysToPay ?? avg ?? null;
    const contactSeasonal = seasonalByContact?.get(contactId);
    const params = fitDistribution(
      median ? Number(median) : null,
      signals?.p75DaysToPay ? Number(signals.p75DaysToPay) : null,
      signals?.volatility ? Number(signals.volatility) : null,
      signals?.trend ? Number(signals.trend) : null,
      undefined,
      contactSeasonal, // Gap 13
    );
    const dataConfidence = median ? 0.8 : 0.3;
    const forecast = getPaymentForecast(params, dataConfidence);

    scenarios.push({
      contactId,
      contactName: contact.name || "Unknown",
      totalOwed,
      invoiceCount: invoices.length,
      oldestDueDate,
      avgDaysToPay: avg || null,
      optimisticDate: addDays(oldestDueDate, forecast.optimisticDate),
      expectedDate: addDays(oldestDueDate, forecast.expectedDate),
      pessimisticDate: addDays(oldestDueDate, forecast.pessimisticDate),
    });
  }

  // Sort by totalOwed descending
  return scenarios.sort((a, b) => b.totalOwed - a.totalOwed);
}

/**
 * Build three-scenario collection estimates for the next 3 weeks.
 * Inflows only — outflow forecasting suppressed for MVP v1.1 demo.
 */
function buildScenarioTotals(
  scenarios: DebtorScenario[],
  metrics: { totalOutstanding: number },
): KeyNumbers {
  const totalAR = Number(metrics.totalOutstanding);

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
    optimistic: { expectedIn: optimisticIn, pressurePoints: [] },
    expected: { expectedIn, pressurePoints },
    pessimistic: { expectedIn: pessimisticIn, pressurePoints },
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
  previousSummary: string | null;
}): string {
  return `You are the CFO advisor for a UK SME. Write a weekly cash collection review.

DATA CONTEXT:
- Week: ${params.weekStart} to ${params.weekEnd}
- AR Metrics: ${JSON.stringify(params.metrics)}
- Three-Scenario Collection Forecast: ${JSON.stringify(params.keyNumbers)}
- Top Debtors (by amount owed): ${JSON.stringify(params.topDebtors.slice(0, 8))}
- DSO Trend (last 4 weeks): ${JSON.stringify(params.dsoTrend.slice(-4))}
${params.previousSummary ? `- Previous Review Summary: ${params.previousSummary.slice(0, 500)}` : "- No previous review available."}

INSTRUCTIONS:
Write a plain-English weekly review in 3-4 paragraphs covering:
1. This week's collections performance and AR health
2. Expected cash inflows over the next 2-3 weeks (reference the three collection scenarios)
3. Which debtors need attention and why
4. One or two specific collection recommendations

Focus entirely on expected cash inflows from debtors. Do not mention outflows, expenses, or net position.

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

// ── Gap 7: Behavior Signal Fetch for Distribution Forecasting ──

/**
 * Bulk-fetch customerBehaviorSignals for all contacts in the overdue invoice set.
 * Returns a Map keyed by contactId with the distribution-relevant fields.
 */
async function fetchBehaviorSignalsForContacts(
  tenantId: string,
  overdueInvoices: (Invoice & { contact: Contact })[],
): Promise<Map<string, { medianDaysToPay: number | null; p75DaysToPay: number | null; volatility: number | null; trend: number | null }>> {
  const result = new Map<string, { medianDaysToPay: number | null; p75DaysToPay: number | null; volatility: number | null; trend: number | null }>();

  const contactIds = Array.from(new Set(overdueInvoices.map(inv => inv.contactId).filter(Boolean) as string[]));
  if (contactIds.length === 0) return result;

  try {
    const { db } = await import("../db");
    const { customerBehaviorSignals } = await import("@shared/schema");
    const { eq, and, inArray } = await import("drizzle-orm");

    const signals = await db
      .select({
        contactId: customerBehaviorSignals.contactId,
        medianDaysToPay: customerBehaviorSignals.medianDaysToPay,
        p75DaysToPay: customerBehaviorSignals.p75DaysToPay,
        volatility: customerBehaviorSignals.volatility,
        trend: customerBehaviorSignals.trend,
      })
      .from(customerBehaviorSignals)
      .where(
        and(
          eq(customerBehaviorSignals.tenantId, tenantId),
          inArray(customerBehaviorSignals.contactId, contactIds),
        ),
      );

    for (const s of signals) {
      if (s.contactId) {
        result.set(s.contactId, {
          medianDaysToPay: s.medianDaysToPay ? Number(s.medianDaysToPay) : null,
          p75DaysToPay: s.p75DaysToPay ? Number(s.p75DaysToPay) : null,
          volatility: s.volatility ? Number(s.volatility) : null,
          trend: s.trend ? Number(s.trend) : null,
        });
      }
    }
  } catch (err) {
    console.error("[WeeklyReview] Failed to fetch behavior signals for distribution forecasting:", err);
    // Fall back to cold-start priors — buildDebtorScenarios handles missing signals
  }

  return result;
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

  // Gap 7: Fetch behavior signals for distribution-based forecasting
  const behaviorSignals = await fetchBehaviorSignalsForContacts(tenantId, overdueInvoices);

  // Gap 13: Fetch seasonal adjustments for overdue contacts
  const seasonalByContact = new Map<string, SeasonalAdjustment[]>();
  try {
    // Fetch tenant-wide seasonal patterns once
    const tenantSeasonal = await getSeasonalAdjustments(tenantId);
    const contactIds = Array.from(new Set(overdueInvoices.map(inv => inv.contactId).filter(Boolean) as string[]));
    for (const cid of contactIds) {
      // Debtor-specific patterns merged with tenant-wide
      const debtorSeasonal = await getSeasonalAdjustments(tenantId, cid);
      // Combine: debtor-specific patterns + tenant-wide patterns not overridden
      const debtorMonths = new Set(debtorSeasonal.filter(s => s.month).map(s => s.month));
      const tenantOnly = tenantSeasonal.filter(s => !debtorMonths.has(s.month));
      const merged = [...debtorSeasonal, ...tenantOnly];
      if (merged.length > 0) seasonalByContact.set(cid, merged);
    }
  } catch { /* non-fatal */ }

  // Build debtor scenarios (Gap 7 + Gap 13: with distribution + seasonal data)
  const debtorScenarios = buildDebtorScenarios(
    overdueInvoices,
    metrics.avgDaysToPay || 30,
    behaviorSignals,
    seasonalByContact,
  );

  // Build three-scenario cashflow estimates
  const keyNumbers = buildScenarioTotals(
    debtorScenarios,
    metrics,
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
