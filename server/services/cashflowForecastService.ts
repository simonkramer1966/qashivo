/**
 * Cashflow Forecast Service — Phase 1: Core Engine + AR Layer + Signal Intelligence
 *
 * Bottom-up 13-week cashflow forecast built from per-debtor log-normal
 * payment distributions. Every number traces back to a specific invoice
 * and debtor payment history. The model improves automatically with
 * every payment observed.
 *
 * Layers (Phase 1 = Layer 1 only):
 *   Layer 1: Existing AR Collections (Bayesian, per-debtor)
 *   Layer 2: Recurring Revenue (Phase 2)
 *   Layer 3: User Pipeline (Phase 4)
 *   Layer 4: Time-Series Envelope (Phase 6)
 */

import { db } from "../db";
import {
  invoices,
  contacts,
  customerBehaviorSignals,
  customerLearningProfiles,
  paymentPromises,
  tenants,
} from "@shared/schema";
import { eq, and, sql, isNotNull, inArray } from "drizzle-orm";
import {
  fitDistribution,
  weeklyProbabilitiesThreeScenarios,
  weeklyPaymentProbabilities,
  type DistributionParams,
} from "./paymentDistribution";
import { EXCLUDED_STATUSES } from "./arCalculations";

// ── Interfaces ─────────────────────────────────────────────────

export interface InvoiceContribution {
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  amountDue: number;
  probability: number;
  confidence: "high" | "medium" | "low";
  basedOn: string;
  promiseOverride: boolean;
}

export interface WeeklyForecast {
  weekNumber: number;
  weekStarting: string;
  weekEnding: string;
  optimistic: number;
  expected: number;
  pessimistic: number;
  confidence: "high" | "medium" | "low";
  invoiceBreakdown: InvoiceContribution[];
  sourceBreakdown: {
    arCollections: number;
    recurringRevenue: number;
    pipeline: number;
  };
}

export interface InflowForecast {
  generatedAt: string;
  totalOutstanding: number;
  invoiceCount: number;
  debtorCount: number;

  // Core forecast
  forecastRecovery: {
    optimistic: number;
    expected: number;
    pessimistic: number;
    percentOfOutstanding: number;
  };
  weeklyForecasts: WeeklyForecast[];

  // Signal: Unforecast remainder
  unforecast: {
    total: number;
    percentOfOutstanding: number;
    noHistory: number;
    atRisk: number;
    longTail: number;
    breakdown: {
      category: "no_history" | "at_risk" | "long_tail";
      amount: number;
      invoiceCount: number;
      description: string;
    }[];
  };

  // Signal: Concentration risk
  concentrationRisk: {
    top3Debtors: { name: string; amount: number; percent: number }[];
    top3Percent: number;
    weeklyConcentration: {
      weekNumber: number;
      topDebtor: string;
      topDebtorAmount: number;
      topDebtorPercent: number;
      isFragile: boolean;
    }[];
  };

  // Signal: Data quality
  dataQuality: { high: number; medium: number; low: number };

  // Signal: Debtor trajectory
  debtorTrajectories: {
    contactId: string;
    contactName: string;
    trend: "improving" | "stable" | "deteriorating";
    previousAvg: number;
    currentAvg: number;
    delta: number;
    forecastImpact: number;
  }[];

  // Signal: Promise impact
  promiseImpacts: {
    contactId: string;
    contactName: string;
    promisedAmount: number;
    promisedWeek: number;
    ifKeptAmount: number;
    ifBrokenAmount: number;
    swingAmount: number;
    reliabilityPercent: number;
  }[];

  // Signal: Cash gap alert
  cashGapAlerts: {
    weekNumber: number;
    gapAmount: number;
    scenario: "pessimistic" | "expected";
    resolutionOptions: {
      type: "pull_forward" | "finance" | "defer" | "pipeline";
      description: string;
      amount: number;
      feasibility: "high" | "medium" | "low";
    }[];
  }[];

  // Signal: Outflow pressure points (Phase 1: empty — no outflows yet)
  pressureWeeks: {
    weekNumber: number;
    totalOutflows: number;
    expectedInflows: number;
    netPosition: number;
    description: string;
  }[];

  // Signal: Confidence by horizon
  confidenceByHorizon: {
    weeks1to2: "high" | "medium" | "low";
    weeks3to5: "high" | "medium" | "low";
    weeks6to9: "high" | "medium" | "low";
    weeks10to13: "high" | "medium" | "low";
  };
}

export interface DebtorPaymentProfile {
  contactId: string;
  contactName: string;
  paymentCount: number;
  averageDaysToPay: number;
  fastestPayment: number;
  slowestPayment: number;
  medianPayment: number;
  trend: "improving" | "stable" | "deteriorating";
  trendDelta: number;
  paymentDayPreference: { day: string; percent: number } | null;
  confidence: "high" | "medium" | "low";
  mu: number;
  sigma: number;
  weeklyCurve: { week: number; probability: number }[];
}

export interface ForecastChanges {
  changes: {
    weekNumber: number;
    direction: "up" | "down" | "new";
    amount: number;
    reason: string;
  }[];
}

// ── Internal types ─────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  contactId: string;
  contactName: string;
  invoiceNumber: string;
  amount: string;
  amountPaid: string | null;
  issueDate: Date;
  dueDate: Date;
}

interface BehaviorSignals {
  medianDaysToPay: number | null;
  p75DaysToPay: number | null;
  volatility: number | null;
  trend: number | null;
  segment: string | null;
  invoiceCount: number;
}

interface PromiseData {
  contactId: string;
  promisedDate: Date;
  promisedAmount: number | null;
}

// ── Helpers ────────────────────────────────────────────────────

function getWeekBounds(weekOffset: number): { start: Date; end: Date } {
  const now = new Date();
  // Find Monday of current week
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const start = new Date(monday);
  start.setDate(monday.getDate() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatWeekDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function determineConfidence(invoiceCount: number): "high" | "medium" | "low" {
  if (invoiceCount >= 10) return "high";
  if (invoiceCount >= 3) return "medium";
  return "low";
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function weekNumberForDate(targetDate: Date): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const diffDays = daysBetween(monday, targetDate);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
}

// ── Forecast cache ─────────────────────────────────────────────

const forecastCache = new Map<string, { data: InflowForecast; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function invalidateForecastCache(tenantId: string) {
  forecastCache.delete(tenantId);
}

// ── Main forecast engine ───────────────────────────────────────

export async function generateInflowForecast(
  tenantId: string,
  skipCache = false,
): Promise<InflowForecast> {
  // Check cache
  if (!skipCache) {
    const cached = forecastCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  // ── a. Fetch all data in parallel ──

  const [invoiceRows, signalsRows, promisesRows, profilesRows, tenantRow] =
    await Promise.all([
      // All outstanding invoices (OPEN, not excluded statuses) with contact names
      db
        .select({
          id: invoices.id,
          contactId: invoices.contactId,
          contactName: contacts.name,
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          amountPaid: invoices.amountPaid,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
        })
        .from(invoices)
        .innerJoin(contacts, eq(contacts.id, invoices.contactId))
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            sql`LOWER(${invoices.status}) NOT IN ${sql.raw(EXCLUDED_STATUSES)}`,
            sql`(${invoices.amount} - COALESCE(${invoices.amountPaid}, 0)) > 0`,
          ),
        ),

      // All behavior signals for tenant (bulk)
      db
        .select({
          contactId: customerBehaviorSignals.contactId,
          medianDaysToPay: customerBehaviorSignals.medianDaysToPay,
          p75DaysToPay: customerBehaviorSignals.p75DaysToPay,
          volatility: customerBehaviorSignals.volatility,
          trend: customerBehaviorSignals.trend,
          segment: customerBehaviorSignals.segment,
          invoiceCount: customerBehaviorSignals.invoiceCount,
        })
        .from(customerBehaviorSignals)
        .where(eq(customerBehaviorSignals.tenantId, tenantId)),

      // Active promises
      db
        .select({
          contactId: paymentPromises.contactId,
          promisedDate: paymentPromises.promisedDate,
          promisedAmount: paymentPromises.promisedAmount,
        })
        .from(paymentPromises)
        .where(
          and(
            eq(paymentPromises.tenantId, tenantId),
            eq(paymentPromises.status, "open"),
            isNotNull(paymentPromises.promisedDate),
          ),
        ),

      // Learning profiles for PRS
      db
        .select({
          contactId: customerLearningProfiles.contactId,
          prs: customerLearningProfiles.promiseReliabilityScore,
        })
        .from(customerLearningProfiles)
        .where(eq(customerLearningProfiles.tenantId, tenantId)),

      // Tenant settings
      db
        .select({
          forecastOpeningBalance: tenants.forecastOpeningBalance,
          forecastSafetyThreshold: tenants.forecastSafetyThreshold,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .then((rows) => rows[0]),
    ]);

  // Build lookup maps
  const signalsMap = new Map<string, BehaviorSignals>();
  for (const s of signalsRows) {
    signalsMap.set(s.contactId, {
      medianDaysToPay: s.medianDaysToPay ? Number(s.medianDaysToPay) : null,
      p75DaysToPay: s.p75DaysToPay ? Number(s.p75DaysToPay) : null,
      volatility: s.volatility ? Number(s.volatility) : null,
      trend: s.trend ? Number(s.trend) : null,
      segment: s.segment,
      invoiceCount: s.invoiceCount ?? 0,
    });
  }

  const promisesByContact = new Map<string, PromiseData>();
  for (const p of promisesRows) {
    if (p.promisedDate) {
      promisesByContact.set(p.contactId, {
        contactId: p.contactId,
        promisedDate: new Date(p.promisedDate),
        promisedAmount: p.promisedAmount ? Number(p.promisedAmount) : null,
      });
    }
  }

  const prsMap = new Map<string, number>();
  for (const p of profilesRows) {
    if (p.prs) prsMap.set(p.contactId, Number(p.prs));
  }

  const safetyThreshold = tenantRow?.forecastSafetyThreshold
    ? Number(tenantRow.forecastSafetyThreshold)
    : 20000;
  const openingBalance = tenantRow?.forecastOpeningBalance
    ? Number(tenantRow.forecastOpeningBalance)
    : 0;

  // ── b. Per-invoice processing ──

  const now = new Date();
  const WEEKS = 13;

  // Pre-compute week bounds
  const weekBounds: { start: Date; end: Date }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    weekBounds.push(getWeekBounds(w));
  }

  // Per-debtor aggregation for concentration risk
  const debtorExpected = new Map<string, { name: string; total: number }>();
  // Per-week per-debtor for weekly concentration
  const weekDebtorAmounts: Map<string, number>[] = Array.from(
    { length: WEEKS },
    () => new Map(),
  );

  // Accumulate weekly totals
  const weeklyOptimistic = new Array(WEEKS).fill(0);
  const weeklyExpected = new Array(WEEKS).fill(0);
  const weeklyPessimistic = new Array(WEEKS).fill(0);
  const weeklyInvoiceBreakdowns: InvoiceContribution[][] = Array.from(
    { length: WEEKS },
    () => [],
  );

  // Data quality counters
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  // Unforecast tracking
  let unforecastNoHistory = 0;
  let unforecastAtRisk = 0;
  let unforecastLongTail = 0;
  let unforecastNoHistoryCount = 0;
  let unforecastAtRiskCount = 0;
  let unforecastLongTailCount = 0;

  // Promise impact tracking
  const promiseImpacts: InflowForecast["promiseImpacts"] = [];

  // Unique debtors
  const debtorIds = new Set<string>();

  let totalOutstanding = 0;

  for (const inv of invoiceRows) {
    const amountDue = Number(inv.amount) - Number(inv.amountPaid || 0);
    if (amountDue <= 0) continue;

    totalOutstanding += amountDue;
    debtorIds.add(inv.contactId);

    const signals = signalsMap.get(inv.contactId);
    const confidence = determineConfidence(signals?.invoiceCount ?? 0);

    // Track data quality
    if (confidence === "high") highCount++;
    else if (confidence === "medium") mediumCount++;
    else lowCount++;

    // Fit distribution
    const params = fitDistribution(
      signals?.medianDaysToPay ?? null,
      signals?.p75DaysToPay ?? null,
      signals?.volatility ?? null,
      signals?.trend ?? null,
      signals?.segment ?? undefined,
    );

    const daysOverdue = Math.max(0, daysBetween(new Date(inv.dueDate), now));

    // Check for promise override
    const promise = promisesByContact.get(inv.contactId);
    let usedPromiseOverride = false;
    let promiseWeekNum = 0;

    if (promise) {
      promiseWeekNum = weekNumberForDate(promise.promisedDate);
      if (promiseWeekNum >= 1 && promiseWeekNum <= WEEKS) {
        usedPromiseOverride = true;
      }
    }

    if (usedPromiseOverride && promise) {
      // Promise override: redistribute probabilities based on PRS
      const prs = prsMap.get(inv.contactId) ?? 50;
      let promiseProb: number;
      let nextWeekProb: number;
      let remainderProb: number;

      if (prs > 70) {
        promiseProb = 0.70;
        nextWeekProb = 0.20;
        remainderProb = 0.10;
      } else if (prs >= 50) {
        promiseProb = 0.55;
        nextWeekProb = 0.22;
        remainderProb = 0.23;
      } else {
        promiseProb = 0.40;
        nextWeekProb = 0.25;
        remainderProb = 0.35;
      }

      // Compute non-override probabilities for promise impact signal
      const normalScenarios = weeklyProbabilitiesThreeScenarios(
        params.mu,
        params.sigma,
        daysOverdue,
      );
      const normalExpectedInPromiseWeek =
        normalScenarios.expected[promiseWeekNum - 1]?.probability ?? 0;

      // Apply override to all three scenarios (promise override replaces distribution)
      for (let w = 0; w < WEEKS; w++) {
        let prob: number;
        if (w + 1 === promiseWeekNum) {
          prob = promiseProb;
        } else if (w + 1 === promiseWeekNum + 1 && promiseWeekNum < WEEKS) {
          prob = nextWeekProb;
        } else {
          // Spread remainder across other weeks proportionally
          prob = remainderProb / Math.max(1, WEEKS - 2);
        }

        const contribution = amountDue * prob;
        weeklyOptimistic[w] += contribution;
        weeklyExpected[w] += contribution;
        weeklyPessimistic[w] += contribution;

        if (prob > 0.01) {
          weeklyInvoiceBreakdowns[w].push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            contactId: inv.contactId,
            contactName: inv.contactName || "Unknown",
            amountDue,
            probability: prob,
            confidence,
            basedOn: `Promise (PRS ${Math.round(prs)}%)`,
            promiseOverride: true,
          });
        }

        // Track per-debtor amounts for concentration
        const current = weekDebtorAmounts[w].get(inv.contactId) ?? 0;
        weekDebtorAmounts[w].set(inv.contactId, current + contribution);
      }

      // Record promise impact
      const ifKept = amountDue * promiseProb;
      const ifBroken = amountDue * normalExpectedInPromiseWeek;
      promiseImpacts.push({
        contactId: inv.contactId,
        contactName: inv.contactName || "Unknown",
        promisedAmount: promise.promisedAmount ?? amountDue,
        promisedWeek: promiseWeekNum,
        ifKeptAmount: ifKept,
        ifBrokenAmount: ifBroken,
        swingAmount: ifKept - ifBroken,
        reliabilityPercent: prs,
      });
    } else {
      // Standard distribution-based forecast
      const scenarios = weeklyProbabilitiesThreeScenarios(
        params.mu,
        params.sigma,
        daysOverdue,
      );

      let totalExpectedProb = 0;
      for (let w = 0; w < WEEKS; w++) {
        const optProb = scenarios.optimistic[w]?.probability ?? 0;
        const expProb = scenarios.expected[w]?.probability ?? 0;
        const pesProb = scenarios.pessimistic[w]?.probability ?? 0;

        weeklyOptimistic[w] += amountDue * optProb;
        weeklyExpected[w] += amountDue * expProb;
        weeklyPessimistic[w] += amountDue * pesProb;

        totalExpectedProb += expProb;

        if (expProb > 0.01) {
          weeklyInvoiceBreakdowns[w].push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            contactId: inv.contactId,
            contactName: inv.contactName || "Unknown",
            amountDue,
            probability: expProb,
            confidence,
            basedOn:
              confidence === "low"
                ? "System defaults (no payment history)"
                : `${signals?.invoiceCount ?? 0} historical payments`,
            promiseOverride: false,
          });
        }

        // Track per-debtor amounts for concentration
        const contribution = amountDue * expProb;
        const current = weekDebtorAmounts[w].get(inv.contactId) ?? 0;
        weekDebtorAmounts[w].set(inv.contactId, current + contribution);
      }

      // Enforce constraint: total across 13 weeks ≤ amountDue
      // (The CDF naturally sums to ≤ 1.0 so this is always satisfied,
      //  but we track the unforecast remainder)
      const unforecastAmount = amountDue * (1 - totalExpectedProb);
      if (unforecastAmount > 0.01) {
        if ((signals?.invoiceCount ?? 0) === 0) {
          unforecastNoHistory += unforecastAmount;
          unforecastNoHistoryCount++;
        } else if (daysOverdue > 90) {
          unforecastAtRisk += unforecastAmount;
          unforecastAtRiskCount++;
        } else {
          unforecastLongTail += unforecastAmount;
          unforecastLongTailCount++;
        }
      }
    }

    // Track per-debtor total expected for concentration risk
    const existingDebtor = debtorExpected.get(inv.contactId);
    const expectedTotal = weeklyExpected.reduce((sum, _, w) => {
      // This isn't right — we need per-debtor expected not cumulative
      return sum;
    }, 0);
    // Simpler: just sum what we added
    if (!existingDebtor) {
      debtorExpected.set(inv.contactId, {
        name: inv.contactName || "Unknown",
        total: 0,
      });
    }
  }

  // Recompute per-debtor totals from weekDebtorAmounts
  debtorExpected.clear();
  for (let w = 0; w < WEEKS; w++) {
    for (const [contactId, amount] of Array.from(weekDebtorAmounts[w])) {
      const existing = debtorExpected.get(contactId);
      if (existing) {
        existing.total += amount;
      } else {
        // Find name from invoice rows
        const inv = invoiceRows.find((i: InvoiceRow) => i.contactId === contactId);
        debtorExpected.set(contactId, {
          name: inv?.contactName || "Unknown",
          total: amount,
        });
      }
    }
  }

  // ── c. Build weekly forecasts ──

  const totalExpected13 = weeklyExpected.reduce((a, b) => a + b, 0);
  const totalOptimistic13 = weeklyOptimistic.reduce((a, b) => a + b, 0);
  const totalPessimistic13 = weeklyPessimistic.reduce((a, b) => a + b, 0);

  const weeklyForecasts: WeeklyForecast[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const bounds = weekBounds[w];

    // Determine week-level confidence (weighted by amount)
    let highAmt = 0;
    let medAmt = 0;
    let lowAmt = 0;
    for (const contrib of weeklyInvoiceBreakdowns[w]) {
      const amt = contrib.amountDue * contrib.probability;
      if (contrib.confidence === "high") highAmt += amt;
      else if (contrib.confidence === "medium") medAmt += amt;
      else lowAmt += amt;
    }
    const totalAmt = highAmt + medAmt + lowAmt;
    const weekConfidence: "high" | "medium" | "low" =
      totalAmt === 0
        ? "low"
        : highAmt / totalAmt > 0.5
          ? "high"
          : medAmt / totalAmt > 0.3
            ? "medium"
            : "low";

    weeklyForecasts.push({
      weekNumber: w + 1,
      weekStarting: formatWeekDate(bounds.start),
      weekEnding: formatWeekDate(bounds.end),
      optimistic: Math.round(weeklyOptimistic[w] * 100) / 100,
      expected: Math.round(weeklyExpected[w] * 100) / 100,
      pessimistic: Math.round(weeklyPessimistic[w] * 100) / 100,
      confidence: weekConfidence,
      invoiceBreakdown: weeklyInvoiceBreakdowns[w].sort(
        (a, b) => b.amountDue * b.probability - a.amountDue * a.probability,
      ),
      sourceBreakdown: {
        arCollections: Math.round(weeklyExpected[w] * 100) / 100,
        recurringRevenue: 0, // Phase 2
        pipeline: 0, // Phase 4
      },
    });
  }

  // ── d. Compute signals ──

  // Concentration risk
  const sortedDebtors = Array.from(debtorExpected.entries())
    .sort((a, b) => b[1].total - a[1].total);

  const top3Debtors = sortedDebtors.slice(0, 3).map(([, data]) => ({
    name: data.name,
    amount: Math.round(data.total * 100) / 100,
    percent:
      totalExpected13 > 0
        ? Math.round((data.total / totalExpected13) * 1000) / 10
        : 0,
  }));

  const top3Total = top3Debtors.reduce((sum, d) => sum + d.amount, 0);
  const top3Percent =
    totalExpected13 > 0
      ? Math.round((top3Total / totalExpected13) * 1000) / 10
      : 0;

  // Per-week concentration
  const weeklyConcentration = weeklyForecasts.map((wf, w) => {
    const debtorAmounts = weekDebtorAmounts[w];
    let topDebtor = "";
    let topAmount = 0;
    for (const [contactId, amount] of Array.from(debtorAmounts)) {
      if (amount > topAmount) {
        topAmount = amount;
        const inv = invoiceRows.find((i: InvoiceRow) => i.contactId === contactId);
        topDebtor = inv?.contactName || "Unknown";
      }
    }
    const weekTotal = wf.expected;
    const topPercent =
      weekTotal > 0
        ? Math.round((topAmount / weekTotal) * 1000) / 10
        : 0;

    return {
      weekNumber: w + 1,
      topDebtor,
      topDebtorAmount: Math.round(topAmount * 100) / 100,
      topDebtorPercent: topPercent,
      isFragile: topPercent > 50,
    };
  });

  // Debtor trajectories (6+ payments spanning 6+ months)
  const debtorTrajectories = await computeDebtorTrajectories(
    tenantId,
    invoiceRows,
    signalsMap,
    debtorExpected,
  );

  // Cash gap alerts
  const cashGapAlerts = computeCashGapAlerts(
    weeklyForecasts,
    openingBalance,
    safetyThreshold,
    invoiceRows,
    debtorExpected,
  );

  // Unforecast remainder
  const unforecastTotal =
    unforecastNoHistory + unforecastAtRisk + unforecastLongTail;

  // Confidence by horizon
  const confidenceByHorizon = computeConfidenceByHorizon(weeklyForecasts);

  // Total data quality
  const totalInvoices = highCount + mediumCount + lowCount;

  // ── Build result ──

  const forecast: InflowForecast = {
    generatedAt: new Date().toISOString(),
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    invoiceCount: invoiceRows.length,
    debtorCount: debtorIds.size,

    forecastRecovery: {
      optimistic: Math.round(totalOptimistic13 * 100) / 100,
      expected: Math.round(totalExpected13 * 100) / 100,
      pessimistic: Math.round(totalPessimistic13 * 100) / 100,
      percentOfOutstanding:
        totalOutstanding > 0
          ? Math.round((totalExpected13 / totalOutstanding) * 1000) / 10
          : 0,
    },

    weeklyForecasts,

    unforecast: {
      total: Math.round(unforecastTotal * 100) / 100,
      percentOfOutstanding:
        totalOutstanding > 0
          ? Math.round((unforecastTotal / totalOutstanding) * 1000) / 10
          : 0,
      noHistory: Math.round(unforecastNoHistory * 100) / 100,
      atRisk: Math.round(unforecastAtRisk * 100) / 100,
      longTail: Math.round(unforecastLongTail * 100) / 100,
      breakdown: [
        ...(unforecastNoHistoryCount > 0
          ? [
              {
                category: "no_history" as const,
                amount: Math.round(unforecastNoHistory * 100) / 100,
                invoiceCount: unforecastNoHistoryCount,
                description:
                  "New debtors with no payment history — using conservative defaults",
              },
            ]
          : []),
        ...(unforecastAtRiskCount > 0
          ? [
              {
                category: "at_risk" as const,
                amount: Math.round(unforecastAtRisk * 100) / 100,
                invoiceCount: unforecastAtRiskCount,
                description:
                  "Invoices over 90 days overdue — high probability of non-payment",
              },
            ]
          : []),
        ...(unforecastLongTailCount > 0
          ? [
              {
                category: "long_tail" as const,
                amount: Math.round(unforecastLongTail * 100) / 100,
                invoiceCount: unforecastLongTailCount,
                description:
                  "Will likely be paid, but after the 13-week forecast window",
              },
            ]
          : []),
      ],
    },

    concentrationRisk: {
      top3Debtors,
      top3Percent,
      weeklyConcentration,
    },

    dataQuality: {
      high: totalInvoices > 0 ? Math.round((highCount / totalInvoices) * 100) : 0,
      medium: totalInvoices > 0 ? Math.round((mediumCount / totalInvoices) * 100) : 0,
      low: totalInvoices > 0 ? Math.round((lowCount / totalInvoices) * 100) : 0,
    },

    debtorTrajectories,
    promiseImpacts,
    cashGapAlerts,
    pressureWeeks: [], // Phase 1: no outflows yet
    confidenceByHorizon,
  };

  // Cache the result
  forecastCache.set(tenantId, {
    data: forecast,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return forecast;
}

// ── Debtor trajectories ────────────────────────────────────────

async function computeDebtorTrajectories(
  tenantId: string,
  outstandingInvoices: InvoiceRow[],
  signalsMap: Map<string, BehaviorSignals>,
  debtorExpected: Map<string, { name: string; total: number }>,
): Promise<InflowForecast["debtorTrajectories"]> {
  try {
    // Get debtors with material outstanding (> £1,000)
    const materialDebtors = Array.from(debtorExpected.entries())
      .filter(([, d]) => d.total > 1000)
      .map(([id]) => id);

    if (materialDebtors.length === 0) return [];

    // Fetch payment history for material debtors
    const paymentHistory = await db
      .select({
        contactId: invoices.contactId,
        paidDate: invoices.paidDate,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          inArray(invoices.contactId, materialDebtors),
          isNotNull(invoices.paidDate),
          isNotNull(invoices.dueDate),
        ),
      );

    // Group by contact
    const byContact = new Map<string, { paidDate: Date; dueDate: Date }[]>();
    for (const p of paymentHistory) {
      if (!p.paidDate || !p.dueDate) continue;
      const list = byContact.get(p.contactId) || [];
      list.push({
        paidDate: new Date(p.paidDate),
        dueDate: new Date(p.dueDate),
      });
      byContact.set(p.contactId, list);
    }

    const trajectories: InflowForecast["debtorTrajectories"] = [];

    for (const [contactId, payments] of Array.from(byContact)) {
      if (payments.length < 6) continue;

      // Check span >= 6 months
      const sorted = payments.sort(
        (a: { paidDate: Date; dueDate: Date }, b: { paidDate: Date; dueDate: Date }) => a.paidDate.getTime() - b.paidDate.getTime(),
      );
      const spanMonths =
        (sorted[sorted.length - 1].paidDate.getTime() -
          sorted[0].paidDate.getTime()) /
        (1000 * 60 * 60 * 24 * 30);
      if (spanMonths < 6) continue;

      // Split into two halves
      const mid = Math.floor(sorted.length / 2);
      const olderHalf = sorted.slice(0, mid);
      const recentHalf = sorted.slice(mid);

      const avgDays = (items: { paidDate: Date; dueDate: Date }[]) => {
        const days = items.map((p: { paidDate: Date; dueDate: Date }) =>
          Math.max(0, daysBetween(p.dueDate, p.paidDate)),
        );
        return days.reduce((a: number, b: number) => a + b, 0) / days.length;
      };

      const previousAvg = Math.round(avgDays(olderHalf));
      const currentAvg = Math.round(avgDays(recentHalf));
      const delta = currentAvg - previousAvg;

      let trend: "improving" | "stable" | "deteriorating";
      if (delta <= -3) trend = "improving";
      else if (delta >= 3) trend = "deteriorating";
      else trend = "stable";

      if (trend === "stable") continue; // Only include non-stable

      // Calculate forecast impact: how much £ shifts between early/late weeks
      const debtor = debtorExpected.get(contactId);
      const forecastImpact = debtor
        ? Math.round(debtor.total * Math.abs(delta) * 0.02 * 100) / 100
        : 0;

      trajectories.push({
        contactId,
        contactName: debtor?.name || "Unknown",
        trend,
        previousAvg,
        currentAvg,
        delta,
        forecastImpact,
      });
    }

    return trajectories.sort(
      (a, b) => Math.abs(b.forecastImpact) - Math.abs(a.forecastImpact),
    );
  } catch (error) {
    console.error("[CashflowForecast] Failed to compute trajectories:", error);
    return [];
  }
}

// ── Cash gap alerts ────────────────────────────────────────────

function computeCashGapAlerts(
  weeklyForecasts: WeeklyForecast[],
  openingBalance: number,
  safetyThreshold: number,
  invoiceRows: InvoiceRow[],
  debtorExpected: Map<string, { name: string; total: number }>,
): InflowForecast["cashGapAlerts"] {
  const alerts: InflowForecast["cashGapAlerts"] = [];

  // Running balance under pessimistic scenario (no outflows in Phase 1)
  let pessimisticBalance = openingBalance;
  let expectedBalance = openingBalance;

  for (const wf of weeklyForecasts) {
    pessimisticBalance += wf.pessimistic;
    expectedBalance += wf.expected;

    const checkScenarios: Array<{
      balance: number;
      scenario: "pessimistic" | "expected";
    }> = [
      { balance: pessimisticBalance, scenario: "pessimistic" },
      { balance: expectedBalance, scenario: "expected" },
    ];

    for (const { balance, scenario } of checkScenarios) {
      if (balance < safetyThreshold) {
        const gapAmount = Math.round((safetyThreshold - balance) * 100) / 100;

        // Generate resolution options
        const options: InflowForecast["cashGapAlerts"][0]["resolutionOptions"] = [];

        // Pull forward: find debtors with amounts in later weeks
        const laterDebtors = Array.from(debtorExpected.entries())
          .filter(([, d]) => d.total > 1000)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 3);

        if (laterDebtors.length > 0) {
          const [, topDebtor] = laterDebtors[0];
          options.push({
            type: "pull_forward",
            description: `Chase ${topDebtor.name} for earlier payment`,
            amount: Math.round(topDebtor.total * 100) / 100,
            feasibility: "high",
          });
        }

        // Finance: identify eligible invoices
        const eligibleInvoices = invoiceRows.filter(
          (inv) => Number(inv.amount) - Number(inv.amountPaid || 0) > 500,
        );
        if (eligibleInvoices.length > 0) {
          const financeTotal = eligibleInvoices
            .slice(0, 3)
            .reduce(
              (sum, inv) =>
                sum + (Number(inv.amount) - Number(inv.amountPaid || 0)),
              0,
            );
          options.push({
            type: "finance",
            description: `Finance ${Math.min(3, eligibleInvoices.length)} invoices via Qapital`,
            amount: Math.round(financeTotal * 100) / 100,
            feasibility: "high",
          });
        }

        // Defer outflow (placeholder for Phase 3)
        options.push({
          type: "defer",
          description: "Defer a supplier payment to the following week",
          amount: 0,
          feasibility: "medium",
        });

        alerts.push({
          weekNumber: wf.weekNumber,
          gapAmount,
          scenario,
          resolutionOptions: options,
        });

        break; // One alert per scenario per week
      }
    }
  }

  return alerts;
}

// ── Confidence by horizon ──────────────────────────────────────

function computeConfidenceByHorizon(
  weeklyForecasts: WeeklyForecast[],
): InflowForecast["confidenceByHorizon"] {
  const bucketConfidence = (weeks: WeeklyForecast[]): "high" | "medium" | "low" => {
    let highAmt = 0;
    let medAmt = 0;
    let lowAmt = 0;

    for (const wf of weeks) {
      const amt = wf.expected;
      if (wf.confidence === "high") highAmt += amt;
      else if (wf.confidence === "medium") medAmt += amt;
      else lowAmt += amt;
    }

    const total = highAmt + medAmt + lowAmt;
    if (total === 0) return "low";
    if (highAmt / total > 0.5) return "high";
    if ((highAmt + medAmt) / total > 0.5) return "medium";
    return "low";
  };

  return {
    weeks1to2: bucketConfidence(weeklyForecasts.slice(0, 2)),
    weeks3to5: bucketConfidence(weeklyForecasts.slice(2, 5)),
    weeks6to9: bucketConfidence(weeklyForecasts.slice(5, 9)),
    weeks10to13: bucketConfidence(weeklyForecasts.slice(9, 13)),
  };
}

// ── Debtor payment profile ─────────────────────────────────────

export async function getDebtorPaymentProfile(
  tenantId: string,
  contactId: string,
): Promise<DebtorPaymentProfile | null> {
  try {
    // Get contact name
    const [contact] = await db
      .select({ name: contacts.name })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));

    if (!contact) return null;

    // Get payment history
    const payments = await db
      .select({
        paidDate: invoices.paidDate,
        dueDate: invoices.dueDate,
        issueDate: invoices.issueDate,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.contactId, contactId),
          isNotNull(invoices.paidDate),
          isNotNull(invoices.dueDate),
        ),
      );

    // Get behavior signals
    const [signals] = await db
      .select({
        medianDaysToPay: customerBehaviorSignals.medianDaysToPay,
        p75DaysToPay: customerBehaviorSignals.p75DaysToPay,
        volatility: customerBehaviorSignals.volatility,
        trend: customerBehaviorSignals.trend,
        segment: customerBehaviorSignals.segment,
        invoiceCount: customerBehaviorSignals.invoiceCount,
      })
      .from(customerBehaviorSignals)
      .where(eq(customerBehaviorSignals.contactId, contactId));

    // Calculate payment stats
    const daysToPay: number[] = [];
    const paymentDays: Record<string, number> = {};
    const DAYS = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    for (const p of payments) {
      if (!p.paidDate || !p.dueDate) continue;
      const days = Math.max(
        0,
        daysBetween(new Date(p.dueDate), new Date(p.paidDate)),
      );
      daysToPay.push(days);
      const dayName = DAYS[new Date(p.paidDate).getDay()];
      paymentDays[dayName] = (paymentDays[dayName] || 0) + 1;
    }

    const paymentCount = daysToPay.length;
    const sorted = [...daysToPay].sort((a, b) => a - b);
    const averageDaysToPay =
      paymentCount > 0
        ? Math.round(daysToPay.reduce((a, b) => a + b, 0) / paymentCount)
        : 0;
    const medianPayment =
      paymentCount > 0 ? sorted[Math.floor(paymentCount / 2)] : 0;
    const fastestPayment = paymentCount > 0 ? sorted[0] : 0;
    const slowestPayment = paymentCount > 0 ? sorted[sorted.length - 1] : 0;

    // Payment day preference
    let paymentDayPreference: DebtorPaymentProfile["paymentDayPreference"] =
      null;
    if (paymentCount >= 5) {
      const topDay = Object.entries(paymentDays).sort(
        (a, b) => b[1] - a[1],
      )[0];
      if (topDay) {
        const percent = Math.round((topDay[1] / paymentCount) * 100);
        if (percent > 30) {
          paymentDayPreference = { day: topDay[0], percent };
        }
      }
    }

    // Trend (split-half)
    let trend: "improving" | "stable" | "deteriorating" = "stable";
    let trendDelta = 0;
    if (paymentCount >= 6) {
      const mid = Math.floor(paymentCount / 2);
      const olderAvg =
        sorted.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const recentAvg =
        sorted.slice(mid).reduce((a, b) => a + b, 0) / (paymentCount - mid);
      trendDelta = Math.round(recentAvg - olderAvg);
      if (trendDelta <= -3) trend = "improving";
      else if (trendDelta >= 3) trend = "deteriorating";
    }

    // Fit distribution
    const params = fitDistribution(
      signals?.medianDaysToPay ? Number(signals.medianDaysToPay) : null,
      signals?.p75DaysToPay ? Number(signals.p75DaysToPay) : null,
      signals?.volatility ? Number(signals.volatility) : null,
      signals?.trend ? Number(signals.trend) : null,
      signals?.segment ?? undefined,
    );

    // Get outstanding invoices for this debtor to determine current overdue
    const [outstandingRow] = await db
      .select({
        maxOverdue: sql<number>`MAX(EXTRACT(EPOCH FROM (now() - ${invoices.dueDate})) / 86400)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.contactId, contactId),
          sql`LOWER(${invoices.status}) NOT IN ${sql.raw(EXCLUDED_STATUSES)}`,
          sql`(${invoices.amount} - COALESCE(${invoices.amountPaid}, 0)) > 0`,
        ),
      );

    const daysOverdue = Math.max(0, Math.round(outstandingRow?.maxOverdue ?? 0));
    const weeklyCurve = weeklyPaymentProbabilities(
      params.mu,
      params.sigma,
      daysOverdue,
    );

    return {
      contactId,
      contactName: contact.name || "Unknown",
      paymentCount,
      averageDaysToPay,
      fastestPayment,
      slowestPayment,
      medianPayment,
      trend,
      trendDelta,
      paymentDayPreference,
      confidence: determineConfidence(signals?.invoiceCount ?? paymentCount),
      mu: params.mu,
      sigma: params.sigma,
      weeklyCurve,
    };
  } catch (error) {
    console.error("[CashflowForecast] Failed to get debtor profile:", error);
    return null;
  }
}

// ── Forecast comparison ────────────────────────────────────────

export function compareForecasts(
  current: InflowForecast,
  previous: InflowForecast | null,
): ForecastChanges {
  if (!previous) {
    return { changes: [] };
  }

  const changes: ForecastChanges["changes"] = [];

  for (const wf of current.weeklyForecasts) {
    const prevWeek = previous.weeklyForecasts.find(
      (pw) => pw.weekNumber === wf.weekNumber,
    );

    if (!prevWeek) {
      if (wf.expected > 100) {
        changes.push({
          weekNumber: wf.weekNumber,
          direction: "new",
          amount: Math.round(wf.expected * 100) / 100,
          reason: `Week ${wf.weekNumber} new — £${Math.round(wf.expected).toLocaleString()} expected`,
        });
      }
      continue;
    }

    const diff = wf.expected - prevWeek.expected;
    const absDiff = Math.abs(diff);
    const pctDiff =
      prevWeek.expected > 0 ? absDiff / prevWeek.expected : 0;

    if (absDiff > 500 || pctDiff > 0.1) {
      // Try to identify the driver
      const topContrib = wf.invoiceBreakdown[0];
      const reason = topContrib
        ? `Week ${wf.weekNumber} ${diff > 0 ? "up" : "down"} £${Math.round(absDiff).toLocaleString()} — ${topContrib.contactName} ${diff > 0 ? "entering peak payment window" : "payment probability shifted"}`
        : `Week ${wf.weekNumber} ${diff > 0 ? "up" : "down"} £${Math.round(absDiff).toLocaleString()}`;

      changes.push({
        weekNumber: wf.weekNumber,
        direction: diff > 0 ? "up" : "down",
        amount: Math.round(absDiff * 100) / 100,
        reason,
      });
    }
  }

  return { changes };
}
