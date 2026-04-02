/**
 * Payment Distribution Service — Gap 7
 *
 * Fits a log-normal distribution per debtor using:
 * - medianDaysToPay (mu location)
 * - trend (mu shift — deteriorating moves distribution right)
 * - p75DaysToPay (sigma — spread of the distribution)
 * - volatility (sigma fallback when p75 unavailable)
 *
 * Produces:
 * - P(Pay) for any given day (CDF-based)
 * - Three-scenario forecasting dates (quantile-based)
 * - Distribution parameters visible to Riley
 */

export interface DistributionParams {
  mu: number;     // log-normal location (ln of adjusted median)
  sigma: number;  // log-normal spread
}

export interface PaymentForecast {
  optimisticDate: number;   // quantile(0.25) — days from invoice date
  expectedDate: number;     // quantile(0.50) — median expected
  pessimisticDate: number;  // quantile(0.75) — right tail
  confidence: number;       // 0-1 based on data quality
}

// ── Cold-start segment priors ──────────────────────────────────
// These priors reflect UK SME payment reality as of 2026.
// They should be reviewed and updated as the "Time to Pay Up"
// legislation takes effect (implementation expected 2027+).
// When sufficient tenant-level data exists, these can be
// overridden by learned portfolio-level distributions.
const SEGMENT_PRIORS: Record<string, DistributionParams> = {
  small_business: { mu: Math.log(40), sigma: 0.5 },   // 40 days typical
  enterprise:     { mu: Math.log(50), sigma: 0.4 },   // 50 days, more consistent
  freelancer:     { mu: Math.log(30), sigma: 0.6 },   // 30 days, more variable
  default:        { mu: Math.log(45), sigma: 0.5 },   // 45 days
};

const TREND_WEIGHT = 3; // One unit of trend shifts curve by ~3 days

// ── Math primitives ────────────────────────────────────────────

/**
 * Error function approximation (Abramowitz & Stegun)
 * Accurate to ~10⁻⁷ — more than sufficient for payment probability.
 */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = 1 - poly * Math.exp(-x * x);
  return x >= 0 ? result : -result;
}

/**
 * Inverse error function approximation
 */
function erfInv(x: number): number {
  const a = 0.147;
  const ln = Math.log(1 - x * x);
  const s = Math.sign(x);
  const t1 = 2 / (Math.PI * a) + ln / 2;
  const t2 = ln / a;
  return s * Math.sqrt(Math.sqrt(t1 * t1 - t2) - t1);
}

/**
 * Log-normal CDF — probability that payment occurs by day x
 */
function logNormalCDF(x: number, mu: number, sigma: number): number {
  if (x <= 0) return 0;
  const z = (Math.log(x) - mu) / (sigma * Math.SQRT2);
  return 0.5 * (1 + erf(z));
}

/**
 * Log-normal quantile (inverse CDF) — day by which there's a p probability of payment
 */
function logNormalQuantile(p: number, mu: number, sigma: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;
  const z = erfInv(2 * p - 1) * Math.SQRT2;
  return Math.exp(mu + sigma * z);
}

// ── Distribution fitting ───────────────────────────────────────

/**
 * Fit log-normal distribution parameters from debtor payment history.
 *
 * Uses medianDaysToPay as the central tendency, trend to shift the curve,
 * and p75DaysToPay (or volatility) to determine spread.
 */
export function fitDistribution(
  medianDaysToPay: number | null,
  p75DaysToPay: number | null,
  volatility: number | null,
  trend: number | null,
  segment?: string,
): DistributionParams {
  // Cold start: use segment priors
  if (!medianDaysToPay || medianDaysToPay <= 0) {
    const prior = SEGMENT_PRIORS[segment || 'default'] || SEGMENT_PRIORS.default;
    return prior;
  }

  // Mu: trend-adjusted median
  const trendAdjustment = (trend || 0) * TREND_WEIGHT;
  const adjustedMedian = Math.max(1, medianDaysToPay + trendAdjustment);
  const mu = Math.log(adjustedMedian);

  // Sigma: derived from p75 if available, otherwise from volatility
  let sigma: number;
  if (p75DaysToPay && p75DaysToPay > medianDaysToPay) {
    // Mathematical relationship between median and p75 of log-normal
    sigma = Math.log(p75DaysToPay / medianDaysToPay) / 0.6745;
  } else if (volatility && volatility > 0) {
    // Fallback: scale volatility to sigma
    sigma = volatility * 0.3; // scaling factor — tune with real data
  } else {
    // Default sigma: moderate uncertainty
    sigma = 0.5;
  }

  // Clamp sigma to reasonable range
  sigma = Math.max(0.1, Math.min(1.5, sigma));

  return { mu, sigma };
}

// ── Main API functions ─────────────────────────────────────────

/**
 * P(Pay) for the adaptive scheduler — probability of payment within a time horizon.
 *
 * Uses conditional probability: given they haven't paid yet,
 * what's the probability they pay within the next horizonHours?
 */
export function estimatePaymentProbability(
  ageDays: number,
  horizonHours: number,
  params: DistributionParams,
): number {
  const currentDay = ageDays;
  const horizonDay = ageDays + (horizonHours / 24);

  // Probability of payment between now and the horizon
  const pNow = logNormalCDF(currentDay, params.mu, params.sigma);
  const pHorizon = logNormalCDF(horizonDay, params.mu, params.sigma);

  // Conditional probability: given they haven't paid yet, probability they pay in this window
  const survivalNow = 1 - pNow;
  if (survivalNow <= 0.001) return 0.01; // Already past expected payment, very low probability

  return (pHorizon - pNow) / survivalNow;
}

/**
 * Three-scenario forecasting for Weekly CFO Review.
 *
 * Returns optimistic (25th percentile), expected (50th/median),
 * and pessimistic (75th percentile) payment dates in days from invoice date.
 */
export function getPaymentForecast(
  params: DistributionParams,
  dataConfidence: number, // 0-1 based on how much data the debtor has
): PaymentForecast {
  return {
    optimisticDate: Math.round(logNormalQuantile(0.25, params.mu, params.sigma)),
    expectedDate: Math.round(logNormalQuantile(0.50, params.mu, params.sigma)),
    pessimisticDate: Math.round(logNormalQuantile(0.75, params.mu, params.sigma)),
    confidence: dataConfidence,
  };
}

/**
 * Human-readable description for Riley context.
 */
export function describeDistribution(params: DistributionParams): string {
  const median = Math.round(Math.exp(params.mu));
  const p75 = Math.round(logNormalQuantile(0.75, params.mu, params.sigma));
  return `typically pays around day ${median} but could stretch to ${p75}`;
}

/**
 * Forecast a single invoice's payment date under three scenarios.
 * Used by the Weekly CFO Review to produce data-driven inflow forecasts.
 */
export function forecastInvoicePayment(
  invoice: { amount: number; dueDate: string | Date },
  medianDaysToPay: number | null,
  p75DaysToPay: number | null,
  volatility: number | null,
  trend: number | null,
  segment?: string,
): {
  invoiceAmount: number;
  optimisticDate: string;
  expectedDate: string;
  pessimisticDate: string;
  confidence: number;
} {
  const params = fitDistribution(medianDaysToPay, p75DaysToPay, volatility, trend, segment);
  const dataConfidence = medianDaysToPay ? 0.8 : 0.3;
  const forecast = getPaymentForecast(params, dataConfidence);

  const dueDate = typeof invoice.dueDate === 'string' ? invoice.dueDate : invoice.dueDate.toISOString().slice(0, 10);

  const addDaysToDate = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + Math.round(days));
    return d.toISOString().slice(0, 10);
  };

  return {
    invoiceAmount: invoice.amount,
    optimisticDate: addDaysToDate(dueDate, forecast.optimisticDate),
    expectedDate: addDaysToDate(dueDate, forecast.expectedDate),
    pessimisticDate: addDaysToDate(dueDate, forecast.pessimisticDate),
    confidence: forecast.confidence,
  };
}
