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
  forecastOutflows,
  forecastSnapshots,
} from "@shared/schema";
import { eq, and, sql, isNotNull } from "drizzle-orm";
import {
  fitDistribution,
  weeklyProbabilitiesThreeScenarios,
  weeklyPaymentProbabilities,
  type DistributionParams,
} from "./paymentDistribution";
import { EXCLUDED_STATUSES } from "./arCalculations";
import {
  getConfirmedPatterns,
  getAllPatterns,
  type RecurringPattern,
} from "./recurringRevenueService";

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
  dueDate: string;
  daysOverdue: number;
  promiseWeek?: number;
  isDisputed?: boolean;
  isOnHold?: boolean;
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
  isCompleted?: boolean;
  actualAmount?: number;
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

  // Layer 2: Recurring revenue
  recurringRevenue?: {
    confirmedCount: number;
    detectedCount: number;
    totalProjected: number;
    patterns: {
      contactId: string;
      contactName: string;
      frequency: string;
      averageAmount: number;
      status: string;
      weeklyProjections: number[];
    }[];
  };

  // Layer 3: User pipeline (stored as forecast_outflows with pipeline_ categories)
  pipeline?: {
    committed: number;
    uncommitted: number;
    stretch: number;
    weeklyByTier: {
      committed: number[];
      uncommitted: number[];
      stretch: number[];
    };
    portfolioAvgDays: number;
  };

  // Phase 3: Outflows + net cashflow
  outflows?: {
    weeklyTotals: number[];
    categories: {
      category: string;
      label: string;
      weeklyAmounts: number[];
      total: number;
      children?: {
        category: string;
        label: string;
        weeklyAmounts: number[];
        total: number;
      }[];
    }[];
  };
  netCashflow?: {
    optimistic: number[];
    expected: number[];
    pessimistic: number[];
  };
  runningBalance?: {
    optimistic: number[];
    expected: number[];
    pessimistic: number[];
  };
  openingBalance?: number;
  safetyThreshold?: number;
  safetyBreachWeek?: number | null;
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

// ── Layer 2 deduplication ──────────────────────────────────────

function isInvoiceAlreadyRaised(
  existingInvoices: InvoiceRow[],
  contactId: string,
  expectedAmount: number,
  expectedDate: Date,
  frequencyDays: number,
): boolean {
  const dateWindow = Math.max(frequencyDays / 3, 7); // At least 7 days window
  return existingInvoices.some((inv) => {
    if (inv.contactId !== contactId) return false;
    const invAmount = Number(inv.amount);
    const amountMatch =
      expectedAmount > 0
        ? Math.abs(invAmount - expectedAmount) / expectedAmount < 0.2
        : false;
    const invDate = new Date(inv.issueDate);
    const dateDiff = Math.abs(daysBetween(invDate, expectedDate));
    return amountMatch && dateDiff < dateWindow;
  });
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

  const [invoiceRows, signalsRows, promisesRows, profilesRows, tenantRow, outflowRows, completedSnapshots] =
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
          isOnHold: invoices.isOnHold,
          pauseState: invoices.pauseState,
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

      // All outflow entries for tenant (includes pipeline_committed/uncommitted/stretch)
      db
        .select()
        .from(forecastOutflows)
        .where(eq(forecastOutflows.tenantId, tenantId)),

      // Completed forecast snapshots for Phase 5 overlay
      db
        .select({
          weekStarting: forecastSnapshots.weekStarting,
          actualCollections: forecastSnapshots.actualCollections,
        })
        .from(forecastSnapshots)
        .where(
          and(
            eq(forecastSnapshots.tenantId, tenantId),
            eq(forecastSnapshots.isCompleted, true),
          ),
        ),
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
            dueDate: new Date(inv.dueDate).toISOString(),
            daysOverdue,
            promiseWeek: promiseWeekNum,
            isDisputed: inv.pauseState === "dispute",
            isOnHold: inv.isOnHold ?? false,
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
            dueDate: new Date(inv.dueDate).toISOString(),
            daysOverdue,
            promiseWeek: promiseWeekNum > 0 ? promiseWeekNum : undefined,
            isDisputed: inv.pauseState === "dispute",
            isOnHold: inv.isOnHold ?? false,
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

  // ── Layer 2: Recurring Revenue Projection (DISABLED — will be re-enabled later) ──
  // Code preserved in recurringRevenueService.ts. Zeroed out for now.

  const weeklyRecurringExpected = new Array(WEEKS).fill(0);
  const weeklyRecurringOptimistic = new Array(WEEKS).fill(0);
  const weeklyRecurringPessimistic = new Array(WEEKS).fill(0);
  const recurringPatternProjections: {
    contactId: string;
    contactName: string;
    frequency: string;
    averageAmount: number;
    status: string;
    weeklyProjections: number[];
  }[] = [];
  const allPatterns: RecurringPattern[] = [];
  const confirmedPatterns: RecurringPattern[] = [];

  // ── Layer 3: User Pipeline (stored as forecast_outflows with pipeline_ categories) ──

  const weeklyPipelineOptimistic = new Array(WEEKS).fill(0);
  const weeklyPipelineExpected = new Array(WEEKS).fill(0);
  const weeklyPipelinePessimistic = new Array(WEEKS).fill(0);

  // Per-tier raw input amounts (before timing shift) for the response
  const pipelineInputByTier: Record<string, number[]> = {
    committed: new Array(WEEKS).fill(0),
    uncommitted: new Array(WEEKS).fill(0),
    stretch: new Array(WEEKS).fill(0),
  };

  // Portfolio average days-to-pay: weighted mean of per-debtor median days
  let portfolioAvgDays = 40; // fallback
  try {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const [contactId, signals] of signalsMap) {
      if (signals.medianDaysToPay && signals.medianDaysToPay > 0) {
        const debtorAmt = debtorExpected.get(contactId)?.total ?? 1;
        weightedSum += signals.medianDaysToPay * debtorAmt;
        totalWeight += debtorAmt;
      }
    }
    if (totalWeight > 0) {
      portfolioAvgDays = Math.round(weightedSum / totalWeight);
    }
  } catch (err) {
    console.warn("[CashflowForecast] Portfolio avg calculation failed:", err);
  }

  // Confidence tier → days-to-pay multiplier
  const TIER_MULTIPLIERS: Record<string, number> = {
    pipeline_committed: 1.0,
    pipeline_uncommitted: 1.25,
    pipeline_stretch: 1.5,
  };
  const TIER_CONFIDENCE: Record<string, string> = {
    pipeline_committed: "committed",
    pipeline_uncommitted: "uncommitted",
    pipeline_stretch: "stretch",
  };

  try {
    const pipelineCategories = ["pipeline_committed", "pipeline_uncommitted", "pipeline_stretch"];
    const pipelineEntries = outflowRows.filter((r) =>
      pipelineCategories.includes(r.category),
    );

    for (const row of pipelineEntries) {
      const amt = Number(row.amount);
      if (!amt || amt <= 0) continue;
      const rowDate = new Date(row.weekStarting);

      // Find which issue week this entry belongs to
      let issueWeek = -1;
      for (let w = 0; w < WEEKS; w++) {
        if (rowDate >= weekBounds[w].start && rowDate <= weekBounds[w].end) {
          issueWeek = w;
          break;
        }
      }
      if (issueWeek < 0) continue;

      const tier = TIER_CONFIDENCE[row.category] ?? "uncommitted";
      pipelineInputByTier[tier][issueWeek] += amt;

      // Payment timing: portfolio avg × tier multiplier
      const adjustedDays = portfolioAvgDays * (TIER_MULTIPLIERS[row.category] ?? 1.0);
      const dist = fitDistribution(adjustedDays, null, null, null);
      const scenarios = weeklyProbabilitiesThreeScenarios(dist.mu, dist.sigma, 0);

      for (let pw = 0; pw < WEEKS; pw++) {
        const payWeek = issueWeek + pw;
        if (payWeek >= WEEKS) break;

        const optProb = pw < scenarios.optimistic.length ? scenarios.optimistic[pw].probability : 0;
        const expProb = pw < scenarios.expected.length ? scenarios.expected[pw].probability : 0;
        const pesProb = pw < scenarios.pessimistic.length ? scenarios.pessimistic[pw].probability : 0;

        // Scenario treatment by confidence tier
        if (row.category === "pipeline_committed") {
          weeklyPipelineOptimistic[payWeek] += amt * optProb;
          weeklyPipelineExpected[payWeek] += amt * expProb;
          weeklyPipelinePessimistic[payWeek] += amt * pesProb;
        } else if (row.category === "pipeline_uncommitted") {
          weeklyPipelineOptimistic[payWeek] += amt * optProb;
          weeklyPipelineExpected[payWeek] += amt * expProb;
          // NOT pessimistic
        } else {
          // stretch — optimistic only
          weeklyPipelineOptimistic[payWeek] += amt * optProb;
        }
      }
    }

    // Add pipeline to weekly totals
    for (let w = 0; w < WEEKS; w++) {
      weeklyOptimistic[w] += weeklyPipelineOptimistic[w];
      weeklyExpected[w] += weeklyPipelineExpected[w];
      weeklyPessimistic[w] += weeklyPipelinePessimistic[w];
    }
  } catch (err) {
    // Layer 3 is non-fatal
    console.warn("[CashflowForecast] Layer 3 pipeline failed:", err);
  }

  // ── Phase 3: Aggregate outflows by week ──

  const weeklyOutflowTotals = new Array(WEEKS).fill(0);
  const outflowsByCategory = new Map<
    string,
    { label: string; weeklyAmounts: number[]; parentCategory: string | null }
  >();

  // Import category labels
  const categoryLabels: Record<string, string> = {
    payroll: "Payroll",
    payroll_net: "Net pay",
    payroll_paye: "PAYE/NI to HMRC",
    payroll_pension: "Pension contributions",
    overheads: "Overheads",
    vat: "VAT",
    corporation_tax: "Corporation tax",
    suppliers: "Supplier payments",
    debt_payments: "Debt payments",
    capex: "Fixed assets / capex",
    directors_drawings: "Directors' drawings",
    cis: "CIS deductions",
    professional_fees: "Professional fees",
    other: "Other / exceptional",
  };

  for (const row of outflowRows) {
    // Skip pipeline entries — they're handled in Layer 3 above
    if (row.category.startsWith("pipeline_")) continue;

    const rowDate = new Date(row.weekStarting);
    const amt = Number(row.amount);
    if (!amt || amt === 0) continue;

    // Find which week this outflow belongs to
    for (let w = 0; w < WEEKS; w++) {
      const { start, end } = weekBounds[w];
      if (rowDate >= start && rowDate <= end) {
        weeklyOutflowTotals[w] += amt;

        // Track per-category
        const cat = row.category;
        if (!outflowsByCategory.has(cat)) {
          outflowsByCategory.set(cat, {
            label: categoryLabels[cat] || cat,
            weeklyAmounts: new Array(WEEKS).fill(0),
            parentCategory: row.parentCategory,
          });
        }
        outflowsByCategory.get(cat)!.weeklyAmounts[w] += amt;
        break;
      }
    }
  }

  // Build category hierarchy for response
  interface OutflowCategoryResult {
    category: string;
    label: string;
    weeklyAmounts: number[];
    total: number;
    children?: { category: string; label: string; weeklyAmounts: number[]; total: number }[];
  }
  const outflowCategories: OutflowCategoryResult[] = [];

  const outflowEntries = Array.from(outflowsByCategory.entries());

  // Parent categories (no parentCategory set, or referenced as parent by a child)
  const parentCatSet: Record<string, boolean> = {};
  for (const [cat, data] of outflowEntries) {
    if (!data.parentCategory) parentCatSet[cat] = true;
  }
  for (const [, data] of outflowEntries) {
    if (data.parentCategory) parentCatSet[data.parentCategory] = true;
  }
  const parentCatKeys = Object.keys(parentCatSet);

  for (const parentCat of parentCatKeys) {
    const parentData = outflowsByCategory.get(parentCat);
    const children: { category: string; label: string; weeklyAmounts: number[]; total: number }[] = [];

    // Collect children
    for (const [cat, data] of outflowEntries) {
      if (data.parentCategory === parentCat) {
        children.push({
          category: cat,
          label: data.label,
          weeklyAmounts: data.weeklyAmounts.map((v: number) => Math.round(v * 100) / 100),
          total: Math.round(data.weeklyAmounts.reduce((a: number, b: number) => a + b, 0) * 100) / 100,
        });
      }
    }

    // Parent weekly amounts: either its own data, or sum of children if no direct data
    const parentWeekly: number[] = parentData
      ? parentData.weeklyAmounts.slice()
      : new Array(WEEKS).fill(0);

    // If parent has children but no direct data, sum children into parent totals
    if (children.length > 0 && !parentData) {
      for (const child of children) {
        for (let w = 0; w < WEEKS; w++) {
          parentWeekly[w] += child.weeklyAmounts[w];
        }
      }
    }

    const result: OutflowCategoryResult = {
      category: parentCat,
      label: categoryLabels[parentCat] || parentCat,
      weeklyAmounts: parentWeekly.map((v: number) => Math.round(v * 100) / 100),
      total: Math.round(parentWeekly.reduce((a: number, b: number) => a + b, 0) * 100) / 100,
    };
    if (children.length > 0) result.children = children;
    outflowCategories.push(result);
  }

  // Also include standalone categories (no parent, not a parent of anything)
  for (const [cat, data] of outflowEntries) {
    const isParentOfSomething = outflowEntries.some(([, d]) => d.parentCategory === cat);
    if (!data.parentCategory && !isParentOfSomething) {
      if (!outflowCategories.some((c) => c.category === cat)) {
        outflowCategories.push({
          category: cat,
          label: data.label,
          weeklyAmounts: data.weeklyAmounts.map((v: number) => Math.round(v * 100) / 100),
          total: Math.round(data.weeklyAmounts.reduce((a: number, b: number) => a + b, 0) * 100) / 100,
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

    const arAmount = Math.round(
      (weeklyExpected[w] - weeklyRecurringExpected[w] - weeklyPipelineExpected[w]) * 100,
    ) / 100;

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
        arCollections: arAmount,
        recurringRevenue:
          Math.round(weeklyRecurringExpected[w] * 100) / 100,
        pipeline: Math.round(weeklyPipelineExpected[w] * 100) / 100,
      },
    });

    // Phase 5: Overlay completed snapshot data
    const completedSnapshot = completedSnapshots.find(
      (s) => formatWeekDate(new Date(s.weekStarting)) === formatWeekDate(bounds.start),
    );
    if (completedSnapshot) {
      const wf = weeklyForecasts[weeklyForecasts.length - 1];
      wf.isCompleted = true;
      wf.actualAmount = Number(completedSnapshot.actualCollections) || 0;
    }
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

  // ── Phase 3: Net cashflow, running balance, pressure weeks ──

  const netCashflowExpected = new Array(WEEKS).fill(0);
  const netCashflowOptimistic = new Array(WEEKS).fill(0);
  const netCashflowPessimistic = new Array(WEEKS).fill(0);
  const runningBalanceExpected = new Array(WEEKS).fill(0);
  const runningBalanceOptimistic = new Array(WEEKS).fill(0);
  const runningBalancePessimistic = new Array(WEEKS).fill(0);

  for (let w = 0; w < WEEKS; w++) {
    netCashflowExpected[w] = Math.round((weeklyExpected[w] - weeklyOutflowTotals[w]) * 100) / 100;
    netCashflowOptimistic[w] = Math.round((weeklyOptimistic[w] - weeklyOutflowTotals[w]) * 100) / 100;
    netCashflowPessimistic[w] = Math.round((weeklyPessimistic[w] - weeklyOutflowTotals[w]) * 100) / 100;

    const prevExpected = w === 0 ? openingBalance : runningBalanceExpected[w - 1];
    const prevOptimistic = w === 0 ? openingBalance : runningBalanceOptimistic[w - 1];
    const prevPessimistic = w === 0 ? openingBalance : runningBalancePessimistic[w - 1];

    runningBalanceExpected[w] = Math.round((prevExpected + netCashflowExpected[w]) * 100) / 100;
    runningBalanceOptimistic[w] = Math.round((prevOptimistic + netCashflowOptimistic[w]) * 100) / 100;
    runningBalancePessimistic[w] = Math.round((prevPessimistic + netCashflowPessimistic[w]) * 100) / 100;
  }

  // Safety breach: first week where pessimistic balance < threshold
  let safetyBreachWeek: number | null = null;
  for (let w = 0; w < WEEKS; w++) {
    if (runningBalancePessimistic[w] < safetyThreshold) {
      safetyBreachWeek = w + 1;
      break;
    }
  }

  // Pressure weeks: where outflows > expected inflows
  const pressureWeeks: InflowForecast["pressureWeeks"] = [];
  for (let w = 0; w < WEEKS; w++) {
    if (weeklyOutflowTotals[w] > 0 && weeklyOutflowTotals[w] > weeklyExpected[w]) {
      // Build description from top outflow categories this week
      const categoryBreakdown: string[] = [];
      for (const [, data] of outflowEntries) {
        if (data.weeklyAmounts[w] > 0 && !data.parentCategory) {
          categoryBreakdown.push(
            `${data.label}: £${Math.round(data.weeklyAmounts[w]).toLocaleString()}`,
          );
        }
      }

      pressureWeeks.push({
        weekNumber: w + 1,
        totalOutflows: Math.round(weeklyOutflowTotals[w] * 100) / 100,
        expectedInflows: Math.round(weeklyExpected[w] * 100) / 100,
        netPosition: Math.round((weeklyExpected[w] - weeklyOutflowTotals[w]) * 100) / 100,
        description: categoryBreakdown.length > 0
          ? `Outflows exceed inflows. ${categoryBreakdown.join(", ")}`
          : "Outflows exceed expected inflows this week",
      });
    }
  }

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
    pressureWeeks,
    confidenceByHorizon,

    // Phase 3: Outflows + net cashflow
    outflows: outflowCategories.length > 0
      ? {
          weeklyTotals: weeklyOutflowTotals.map((v: number) => Math.round(v * 100) / 100),
          categories: outflowCategories,
        }
      : undefined,
    netCashflow: {
      optimistic: netCashflowOptimistic,
      expected: netCashflowExpected,
      pessimistic: netCashflowPessimistic,
    },
    runningBalance: {
      optimistic: runningBalanceOptimistic,
      expected: runningBalanceExpected,
      pessimistic: runningBalancePessimistic,
    },
    openingBalance,
    safetyThreshold,
    safetyBreachWeek,

    // Layer 2: Recurring revenue
    recurringRevenue:
      allPatterns.length > 0
        ? {
            confirmedCount: confirmedPatterns.length,
            detectedCount: allPatterns.filter(
              (p) => p.status === "detected",
            ).length,
            totalProjected:
              Math.round(
                weeklyRecurringExpected.reduce(
                  (a: number, b: number) => a + b,
                  0,
                ) * 100,
              ) / 100,
            patterns: recurringPatternProjections,
          }
        : undefined,

    // Layer 3: User pipeline
    pipeline: (() => {
      const cTotal = pipelineInputByTier.committed.reduce((a, b) => a + b, 0);
      const uTotal = pipelineInputByTier.uncommitted.reduce((a, b) => a + b, 0);
      const sTotal = pipelineInputByTier.stretch.reduce((a, b) => a + b, 0);
      if (cTotal + uTotal + sTotal === 0) return undefined;
      return {
        committed: Math.round(cTotal * 100) / 100,
        uncommitted: Math.round(uTotal * 100) / 100,
        stretch: Math.round(sTotal * 100) / 100,
        weeklyByTier: {
          committed: pipelineInputByTier.committed.map((v) => Math.round(v * 100) / 100),
          uncommitted: pipelineInputByTier.uncommitted.map((v) => Math.round(v * 100) / 100),
          stretch: pipelineInputByTier.stretch.map((v) => Math.round(v * 100) / 100),
        },
        portfolioAvgDays,
      };
    })(),
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
