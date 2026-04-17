/**
 * Monte Carlo Cashflow Forecast — Orchestrator
 *
 * Single entry point for running a simulation forecast.
 * Loads inputs from the database, fits distributions, runs the simulation,
 * and caches the result.
 */

import { fitDistributionWithRecencyWeight } from './distributionFitting.js';
import { getNonPaymentDiscount } from './conditionalSampling.js';
import { runMonteCarloSimulation } from './monteCarloEngine.js';
import { computeInputHash, getCachedSimulation, cacheSimulation } from './simulationCache.js';
import { fitDistribution } from '../paymentDistribution.js';
import type { InvoiceSimulationInput, PaymentHistoryEntry, SimulationConfig, SimulationResult } from './types.js';

const EXCLUDED_STATUSES = "('paid', 'void', 'voided', 'deleted', 'draft')";
const DEFAULT_WEEKS = 13;
const PAYMENT_HISTORY_MONTHS = 24;

/**
 * Run the Monte Carlo simulation forecast for a tenant.
 *
 * 1. Load outstanding invoices, payment history, promises, tenant settings, outflows
 * 2. Fit distributions per debtor (recency-weighted if enough history)
 * 3. Build simulation inputs
 * 4. Check cache — if hit and not force, return cached result
 * 5. Run simulation, cache, return
 */
export async function runSimulationForecast(
  tenantId: string,
  triggerType: string = 'manual',
  forceRecalculate: boolean = false,
): Promise<SimulationResult> {
  const { db } = await import('../../db.js');
  const {
    invoices,
    contacts,
    customerBehaviorSignals,
    paymentPromises,
    customerLearningProfiles,
    tenants,
    forecastOutflows,
  } = await import('@shared/schema');
  const { eq, and, sql, isNotNull } = await import('drizzle-orm');

  // ── Load all data in parallel ──

  const [invoiceRows, signalsRows, promisesRows, profilesRows, tenantRow, outflowRows, paymentHistoryRows] =
    await Promise.all([
      // Outstanding invoices with contact names
      db
        .select({
          id: invoices.id,
          contactId: invoices.contactId,
          contactName: contacts.name,
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          amountPaid: invoices.amountPaid,
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

      // Behavior signals for distribution fitting
      db
        .select({
          contactId: customerBehaviorSignals.contactId,
          medianDaysToPay: customerBehaviorSignals.medianDaysToPay,
          p75DaysToPay: customerBehaviorSignals.p75DaysToPay,
          volatility: customerBehaviorSignals.volatility,
          trend: customerBehaviorSignals.trend,
          segment: customerBehaviorSignals.segment,
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
            eq(paymentPromises.status, 'open'),
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
          forecastSimulationRuns: tenants.forecastSimulationRuns,
          forecastPaymentDecayHalfLifeDays: tenants.forecastPaymentDecayHalfLifeDays,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .then(rows => rows[0]),

      // Outflows (have weekStarting timestamp, not weekNumber)
      db
        .select({
          weekStarting: forecastOutflows.weekStarting,
          amount: forecastOutflows.amount,
        })
        .from(forecastOutflows)
        .where(eq(forecastOutflows.tenantId, tenantId)),

      // Payment history for recency-weighted distribution fitting (last 24 months)
      db
        .select({
          contactId: invoices.contactId,
          paidDate: invoices.paidDate,
          dueDate: invoices.dueDate,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            sql`LOWER(${invoices.status}) = 'paid'`,
            isNotNull(invoices.paidDate),
            isNotNull(invoices.dueDate),
            sql`${invoices.paidDate} > now() - interval '${sql.raw(String(PAYMENT_HISTORY_MONTHS))} months'`,
          ),
        ),
    ]);

  // ── Build lookup maps ──

  const signalsMap = new Map<string, typeof signalsRows[0]>();
  for (const s of signalsRows) signalsMap.set(s.contactId, s);

  const promisesByContact = new Map<string, { promisedDate: Date; promisedAmount: number | null }>();
  for (const p of promisesRows) {
    if (p.promisedDate) {
      promisesByContact.set(p.contactId, {
        promisedDate: new Date(p.promisedDate),
        promisedAmount: p.promisedAmount ? Number(p.promisedAmount) : null,
      });
    }
  }

  const prsMap = new Map<string, number>();
  for (const p of profilesRows) {
    if (p.prs) prsMap.set(p.contactId, Number(p.prs));
  }

  // Group payment history by contact
  const historyByContact = new Map<string, PaymentHistoryEntry[]>();
  for (const p of paymentHistoryRows) {
    if (!p.paidDate || !p.dueDate) continue;
    const paidDate = new Date(p.paidDate);
    const dueDate = new Date(p.dueDate);
    const daysToPay = Math.max(0, (paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const list = historyByContact.get(p.contactId) || [];
    list.push({ paidDate, dueDate, daysToPay });
    historyByContact.set(p.contactId, list);
  }

  // ── Extract settings ──

  const simulationRuns = tenantRow?.forecastSimulationRuns ?? 5000;
  const halfLifeDays = tenantRow?.forecastPaymentDecayHalfLifeDays ?? 365;
  const openingBalance = tenantRow?.forecastOpeningBalance ? Number(tenantRow.forecastOpeningBalance) : 0;
  const safetyThreshold = tenantRow?.forecastSafetyThreshold ? Number(tenantRow.forecastSafetyThreshold) : 20000;

  // Build weekly outflows array from weekStarting timestamps
  const weeklyOutflows = new Array(DEFAULT_WEEKS).fill(0);
  const mondayOfCurrentWeek = new Date(now);
  mondayOfCurrentWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  mondayOfCurrentWeek.setHours(0, 0, 0, 0);

  for (const o of outflowRows) {
    if (!o.weekStarting) continue;
    const outflowDate = new Date(o.weekStarting);
    const diffDays = (outflowDate.getTime() - mondayOfCurrentWeek.getTime()) / (1000 * 60 * 60 * 24);
    const weekIndex = Math.floor(diffDays / 7);
    if (weekIndex >= 0 && weekIndex < DEFAULT_WEEKS) {
      weeklyOutflows[weekIndex] += Number(o.amount || 0);
    }
  }

  // ── Build simulation inputs ──

  const now = new Date();
  const simulationInputs: InvoiceSimulationInput[] = [];

  for (const inv of invoiceRows) {
    const amountDue = Number(inv.amount) - Number(inv.amountPaid || 0);
    if (amountDue <= 0) continue;

    const dueDate = inv.dueDate ? new Date(inv.dueDate) : now;
    const daysOverdue = Math.max(0, (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // Fit distribution for this debtor
    const signals = signalsMap.get(inv.contactId);
    const history = historyByContact.get(inv.contactId) || [];

    let params;
    if (history.length >= 3) {
      params = fitDistributionWithRecencyWeight(history, halfLifeDays, {
        medianDaysToPay: signals?.medianDaysToPay ? Number(signals.medianDaysToPay) : null,
        p75DaysToPay: signals?.p75DaysToPay ? Number(signals.p75DaysToPay) : null,
        volatility: signals?.volatility ? Number(signals.volatility) : null,
        trend: signals?.trend ? Number(signals.trend) : null,
      }, signals?.segment ?? undefined);
    } else {
      params = fitDistribution(
        signals?.medianDaysToPay ? Number(signals.medianDaysToPay) : null,
        signals?.p75DaysToPay ? Number(signals.p75DaysToPay) : null,
        signals?.volatility ? Number(signals.volatility) : null,
        signals?.trend ? Number(signals.trend) : null,
        signals?.segment ?? undefined,
      );
    }

    // Promise override
    let promiseOverride: InvoiceSimulationInput['promiseOverride'];
    const promise = promisesByContact.get(inv.contactId);
    if (promise?.promisedDate) {
      const promiseDaysFromNow = (promise.promisedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      const promiseWeek = Math.max(1, Math.ceil(promiseDaysFromNow / 7));
      if (promiseWeek <= DEFAULT_WEEKS) {
        promiseOverride = {
          promiseWeek,
          prs: prsMap.get(inv.contactId) ?? 50,
        };
      }
    }

    simulationInputs.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber ?? '',
      contactId: inv.contactId,
      contactName: inv.contactName ?? 'Unknown',
      amountDue,
      daysOverdue,
      mu: params.mu,
      sigma: params.sigma,
      promiseOverride,
      nonPaymentDiscount: getNonPaymentDiscount(daysOverdue),
    });
  }

  // ── Check cache ──

  const inputHash = computeInputHash({
    invoices: simulationInputs.map(i => ({
      id: i.invoiceId,
      amount: i.amountDue,
      daysOverdue: Math.round(i.daysOverdue),
      mu: Math.round(i.mu * 1000) / 1000,
      sigma: Math.round(i.sigma * 1000) / 1000,
      np: Math.round(i.nonPaymentDiscount * 100) / 100,
      pw: i.promiseOverride?.promiseWeek,
      prs: i.promiseOverride?.prs,
    })),
    openingBalance,
    outflows: weeklyOutflows,
    runs: simulationRuns,
  });

  if (!forceRecalculate) {
    const cached = await getCachedSimulation(tenantId, inputHash);
    if (cached) return cached;
  }

  // ── Run simulation ──

  const config: SimulationConfig = {
    runs: simulationRuns,
    weeks: DEFAULT_WEEKS,
    halfLifeDays,
    openingBalance,
    weeklyOutflows,
    safetyThreshold,
  };

  const result = runMonteCarloSimulation(simulationInputs, config);
  result.inputHash = inputHash;

  // Cache result
  await cacheSimulation(tenantId, result, triggerType).catch(err => {
    console.error('[MonteCarloForecast] Failed to cache simulation:', err);
  });

  return result;
}
