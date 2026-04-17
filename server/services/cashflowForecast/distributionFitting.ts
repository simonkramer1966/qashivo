/**
 * Monte Carlo Cashflow Forecast — Recency-Weighted Distribution Fitting
 *
 * Extends the existing fitDistribution() with exponential decay weighting
 * so recent payments matter more than ancient ones.
 */

import { type DistributionParams, fitDistribution } from '../paymentDistribution.js';
import type { PaymentHistoryEntry } from './types.js';

/**
 * Fit a log-normal distribution with recency weighting.
 *
 * Each historical payment is weighted by exp(-0.693 * ageDays / halfLifeDays).
 * This means a payment from halfLifeDays ago has half the influence of today's payment.
 *
 * Falls back to the existing fitDistribution() when fewer than 3 entries.
 */
export function fitDistributionWithRecencyWeight(
  history: PaymentHistoryEntry[],
  halfLifeDays: number,
  fallback: {
    medianDaysToPay: number | null;
    p75DaysToPay: number | null;
    volatility: number | null;
    trend: number | null;
  },
  segment?: string,
): DistributionParams {
  // Need at least 3 entries for meaningful weighted fit
  if (history.length < 3) {
    return fitDistribution(
      fallback.medianDaysToPay,
      fallback.p75DaysToPay,
      fallback.volatility,
      fallback.trend,
      segment,
    );
  }

  const now = Date.now();
  const decayRate = 0.693 / halfLifeDays; // ln(2) / halfLife

  // Compute weighted log-days-to-pay
  let weightedSumLn = 0;
  let weightedSumLnSq = 0;
  let totalWeight = 0;

  for (const entry of history) {
    const daysToPay = Math.max(1, entry.daysToPay); // floor at 1 day
    const ageDays = Math.max(0, (now - entry.paidDate.getTime()) / (1000 * 60 * 60 * 24));
    const weight = Math.exp(-decayRate * ageDays);

    const lnDays = Math.log(daysToPay);
    weightedSumLn += weight * lnDays;
    weightedSumLnSq += weight * lnDays * lnDays;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return fitDistribution(
      fallback.medianDaysToPay,
      fallback.p75DaysToPay,
      fallback.volatility,
      fallback.trend,
      segment,
    );
  }

  // Weighted mean and variance of ln(daysToPay)
  const mu = weightedSumLn / totalWeight;
  const variance = (weightedSumLnSq / totalWeight) - (mu * mu);
  const sigma = Math.max(0.1, Math.min(1.5, Math.sqrt(Math.max(0, variance))));

  return { mu, sigma };
}
