/**
 * Monte Carlo Cashflow Forecast — Core Simulation Engine
 *
 * Pure function: no DB queries, no side effects.
 * Runs N simulations of debtor payment behaviour, extracts percentiles.
 *
 * Performance target: 5000 runs × 100 invoices < 500ms.
 */

import { sampleConditionalPaymentDay } from './conditionalSampling.js';
import type {
  InvoiceSimulationInput,
  PercentileSet,
  SimulationConfig,
  SimulationResult,
  WeeklySimulationResult,
} from './types.js';
import { detectMaterialInvoices } from './materialInvoiceDetection.js';

/**
 * Run the Monte Carlo simulation.
 *
 * For each run:
 * 1. Sample a payment day for each invoice from the conditional log-normal
 * 2. Map payment days to weeks 1-13
 * 3. Accumulate per-week collections and running balance
 *
 * After all runs: extract percentiles from the sorted per-week totals.
 */
export function runMonteCarloSimulation(
  invoices: InvoiceSimulationInput[],
  config: SimulationConfig,
): SimulationResult {
  const { runs, weeks, openingBalance, weeklyOutflows, safetyThreshold } = config;
  const numInvoices = invoices.length;

  // Pre-allocate arrays for performance
  // weeklyCollections[run][week] = total collected that week
  const weeklyCollections: Float64Array[] = new Array(runs);
  const weeklyBalances: Float64Array[] = new Array(runs);
  const totalRecoveryPerRun = new Float64Array(runs);

  // Track per-invoice-per-week hit counts (across all runs)
  const invoiceWeekHits: Map<string, Int32Array> = new Map();
  for (const inv of invoices) {
    invoiceWeekHits.set(inv.invoiceId, new Int32Array(weeks));
  }

  // Run simulations
  for (let r = 0; r < runs; r++) {
    const collections = new Float64Array(weeks);

    for (let i = 0; i < numInvoices; i++) {
      const inv = invoices[i];
      const paymentDay = samplePaymentDayForInvoice(inv);

      // Map payment day to week (1-indexed, relative to today)
      const daysFromNow = paymentDay - inv.daysOverdue;
      if (daysFromNow < 0 || daysFromNow === Infinity) continue;

      const weekIndex = Math.floor(daysFromNow / 7); // 0-indexed
      if (weekIndex >= weeks) continue;

      collections[weekIndex] += inv.amountDue;

      // Track hit count for this invoice in this week
      const hits = invoiceWeekHits.get(inv.invoiceId)!;
      hits[weekIndex]++;
    }

    // Compute running balance
    const balances = new Float64Array(weeks);
    let prevBalance = openingBalance;
    let runTotal = 0;

    for (let w = 0; w < weeks; w++) {
      const outflow = w < weeklyOutflows.length ? weeklyOutflows[w] : 0;
      const balance = prevBalance + collections[w] - outflow;
      balances[w] = balance;
      prevBalance = balance;
      runTotal += collections[w];
    }

    weeklyCollections[r] = collections;
    weeklyBalances[r] = balances;
    totalRecoveryPerRun[r] = runTotal;
  }

  // Extract percentiles
  const weeklyResults = extractWeeklyPercentiles(weeklyCollections, weeklyBalances, weeks, runs);

  // Total recovery percentiles
  const totalRecovery = extractPercentileSet(totalRecoveryPerRun, runs);

  // Detect safety breach
  let safetyBreachWeek: number | null = null;
  for (let w = 0; w < weeks; w++) {
    if (weeklyResults[w].balance.p50 < safetyThreshold) {
      safetyBreachWeek = w + 1;
      break;
    }
  }

  // Build frequency map for API response
  const perInvoiceWeekFrequency: Record<string, Record<number, number>> = {};
  for (const [invoiceId, hits] of invoiceWeekHits) {
    const weekMap: Record<number, number> = {};
    for (let w = 0; w < weeks; w++) {
      if (hits[w] > 0) {
        weekMap[w + 1] = hits[w]; // 1-indexed weeks
      }
    }
    if (Object.keys(weekMap).length > 0) {
      perInvoiceWeekFrequency[invoiceId] = weekMap;
    }
  }

  // Build invoice map for material detection
  const invoiceMap = new Map(invoices.map(inv => [inv.invoiceId, inv]));
  const weeklyP50 = weeklyResults.map(r => r.collections.p50);

  const materialInvoices = detectMaterialInvoices(
    perInvoiceWeekFrequency,
    weeklyP50,
    invoiceMap,
    runs,
  );

  return {
    weeklyResults,
    materialInvoices,
    perInvoiceWeekFrequency,
    totalRecovery,
    simulationRuns: runs,
    generatedAt: new Date().toISOString(),
    inputHash: '', // Set by caller
    safetyBreachWeek,
  };
}

/**
 * Sample a payment day for a single invoice, handling promise overrides.
 */
function samplePaymentDayForInvoice(inv: InvoiceSimulationInput): number {
  if (inv.promiseOverride) {
    return sampleWithPromiseOverride(inv);
  }

  return sampleConditionalPaymentDay(
    inv.mu,
    inv.sigma,
    Math.max(0, inv.daysOverdue),
    inv.nonPaymentDiscount,
  );
}

/**
 * Promise override sampling using PRS tiers.
 *
 * PRS > 70%:  70% pay in promise week, 20% in +1 week, 10% from distribution
 * PRS 50-70%: 55% pay in promise week, 22% in +1 week, 23% from distribution
 * PRS < 50%:  40% pay in promise week, 25% in +1 week, 35% from distribution
 */
function sampleWithPromiseOverride(inv: InvoiceSimulationInput): number {
  const { promiseWeek, prs } = inv.promiseOverride!;
  const u = Math.random();

  let promiseProb: number, nearProb: number;

  if (prs > 70) {
    promiseProb = 0.70;
    nearProb = 0.90; // 70% + 20%
  } else if (prs >= 50) {
    promiseProb = 0.55;
    nearProb = 0.77; // 55% + 22%
  } else {
    promiseProb = 0.40;
    nearProb = 0.65; // 40% + 25%
  }

  if (u < promiseProb) {
    // Pay in the promised week — random day within that week
    const weekStartDay = inv.daysOverdue + (promiseWeek - 1) * 7;
    return weekStartDay + Math.random() * 7;
  } else if (u < nearProb) {
    // Pay in promise week + 1
    const weekStartDay = inv.daysOverdue + promiseWeek * 7;
    return weekStartDay + Math.random() * 7;
  } else {
    // Fall back to distribution sampling
    return sampleConditionalPaymentDay(
      inv.mu,
      inv.sigma,
      Math.max(0, inv.daysOverdue),
      inv.nonPaymentDiscount,
    );
  }
}

/**
 * Extract P10/P25/P50/P75/P90 from per-week simulation data.
 */
function extractWeeklyPercentiles(
  weeklyCollections: Float64Array[],
  weeklyBalances: Float64Array[],
  weeks: number,
  runs: number,
): WeeklySimulationResult[] {
  const results: WeeklySimulationResult[] = [];
  const collectionValues = new Float64Array(runs);
  const balanceValues = new Float64Array(runs);

  const today = new Date();
  // Find the Monday of the current week
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  for (let w = 0; w < weeks; w++) {
    // Collect all runs' values for this week
    for (let r = 0; r < runs; r++) {
      collectionValues[r] = weeklyCollections[r][w];
      balanceValues[r] = weeklyBalances[r][w];
    }

    const weekStart = new Date(monday);
    weekStart.setDate(monday.getDate() + w * 7);

    results.push({
      weekNumber: w + 1,
      weekStarting: weekStart.toISOString().slice(0, 10),
      collections: extractPercentileSet(collectionValues, runs),
      balance: extractPercentileSet(balanceValues, runs),
    });
  }

  return results;
}

/**
 * Extract percentiles from a Float64Array by sorting.
 */
function extractPercentileSet(values: Float64Array, count: number): PercentileSet {
  // Sort a copy (avoid mutating the original for balance/collection reuse)
  const sorted = new Float64Array(values.buffer.slice(0, count * 8));
  sorted.sort();

  return {
    p10: sorted[Math.floor(count * 0.10)] ?? 0,
    p25: sorted[Math.floor(count * 0.25)] ?? 0,
    p50: sorted[Math.floor(count * 0.50)] ?? 0,
    p75: sorted[Math.floor(count * 0.75)] ?? 0,
    p90: sorted[Math.floor(count * 0.90)] ?? 0,
  };
}
