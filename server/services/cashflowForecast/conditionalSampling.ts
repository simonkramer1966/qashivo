/**
 * Monte Carlo Cashflow Forecast — Conditional Sampling
 *
 * Samples from a truncated log-normal distribution:
 * given the debtor hasn't paid yet (they're currentDaysOverdue days past due),
 * when might they pay?
 *
 * Also handles non-payment probability (write-off discount).
 */

import { logNormalCDF, logNormalQuantile } from '../paymentDistribution.js';

// Cached values for Box-Muller transform
let cachedZ: number | null = null;

/**
 * Standard normal sample via Box-Muller transform.
 * Generates two values, caches one for the next call.
 */
export function sampleStandardNormal(): number {
  if (cachedZ !== null) {
    const z = cachedZ;
    cachedZ = null;
    return z;
  }

  let u1: number, u2: number;
  do {
    u1 = Math.random();
    u2 = Math.random();
  } while (u1 === 0); // u1 must be > 0 for log

  const r = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;

  cachedZ = r * Math.sin(theta);
  return r * Math.cos(theta);
}

/**
 * Sample a payment day from the conditional (truncated) log-normal distribution.
 *
 * Given the debtor hasn't paid by currentDaysOverdue, samples when they will pay.
 * Returns Infinity if the debtor is sampled as a non-payer.
 *
 * Method: inverse CDF sampling on the truncated distribution.
 * - Compute survival = 1 - CDF(currentDaysOverdue)
 * - Draw u ~ Uniform(0, 1)
 * - Target CDF = CDF(currentDaysOverdue) + u * survival
 * - Return quantile(targetCDF)
 */
export function sampleConditionalPaymentDay(
  mu: number,
  sigma: number,
  currentDaysOverdue: number,
  nonPaymentDiscount: number,
): number {
  // Non-payment check: debtor never pays
  if (nonPaymentDiscount > 0 && Math.random() < nonPaymentDiscount) {
    return Infinity;
  }

  // Current CDF — probability they would have paid by now
  const cdfNow = logNormalCDF(Math.max(0.1, currentDaysOverdue), mu, sigma);
  const survival = 1 - cdfNow;

  // If survival is tiny, almost all probability mass is behind us
  if (survival <= 0.001) {
    return Infinity; // Effectively a non-payer at this point
  }

  // Inverse CDF sampling on the truncated distribution
  const u = Math.random();
  const targetCDF = cdfNow + u * survival;

  // Clamp to avoid numerical issues at the edges
  const clampedCDF = Math.min(0.9999, Math.max(0.0001, targetCDF));
  const paymentDay = logNormalQuantile(clampedCDF, mu, sigma);

  // Safety: never return a day before today
  return Math.max(currentDaysOverdue + 0.1, paymentDay);
}

/**
 * Non-payment discount schedule based on days overdue.
 * Older invoices are more likely to never be paid.
 */
export function getNonPaymentDiscount(daysOverdue: number): number {
  if (daysOverdue <= 90) return 0;
  if (daysOverdue <= 120) return 0.05;
  if (daysOverdue <= 180) return 0.15;
  if (daysOverdue <= 270) return 0.30;
  return 0.50;
}
