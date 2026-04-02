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

// ── Gap 13: Seasonal Payment Patterns ──────────────────────────

export interface SeasonalAdjustment {
  month: number;         // 1-12
  adjustmentType: 'slow' | 'fast' | 'year_end';
  source: 'riley' | 'learned';
  confidence: number;
}

// Mu adjustments per type — shifts expected payment date
const SEASONAL_MU_ADJUSTMENTS: Record<string, number> = {
  slow: 0.15,       // shifts expected payment ~15% later
  fast: -0.15,      // shifts expected payment ~15% earlier
  year_end: -0.20,  // stronger pull-forward effect (year-end payment runs)
};

const MONTH_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

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
 * p75DaysToPay (or volatility) to determine spread, and seasonal adjustments
 * to shift the curve based on the current month (Gap 13).
 */
export function fitDistribution(
  medianDaysToPay: number | null,
  p75DaysToPay: number | null,
  volatility: number | null,
  trend: number | null,
  segment?: string,
  seasonalAdjustments?: SeasonalAdjustment[],
): DistributionParams {
  // Cold start: use segment priors (seasonal still applies)
  if (!medianDaysToPay || medianDaysToPay <= 0) {
    const prior = SEGMENT_PRIORS[segment || 'default'] || SEGMENT_PRIORS.default;
    // Apply seasonal adjustment even to cold-start priors
    const seasonalMu = applySeasonalShift(prior.mu, seasonalAdjustments);
    return { mu: seasonalMu, sigma: prior.sigma };
  }

  // Mu: trend-adjusted median
  const trendAdjustment = (trend || 0) * TREND_WEIGHT;
  const adjustedMedian = Math.max(1, medianDaysToPay + trendAdjustment);
  let mu = Math.log(adjustedMedian);

  // Gap 13: Apply seasonal adjustment for current month
  mu = applySeasonalShift(mu, seasonalAdjustments);

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

/**
 * Apply seasonal mu shift for the current month.
 */
function applySeasonalShift(mu: number, adjustments?: SeasonalAdjustment[]): number {
  if (!adjustments || adjustments.length === 0) return mu;

  const currentMonth = new Date().getMonth() + 1; // 1-12
  const currentAdjustments = adjustments.filter(a => a.month === currentMonth);

  for (const adj of currentAdjustments) {
    const muShift = SEASONAL_MU_ADJUSTMENTS[adj.adjustmentType] || 0;
    mu += muShift;
  }

  return mu;
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
  seasonalAdjustments?: SeasonalAdjustment[],
): {
  invoiceAmount: number;
  optimisticDate: string;
  expectedDate: string;
  pessimisticDate: string;
  confidence: number;
} {
  const params = fitDistribution(medianDaysToPay, p75DaysToPay, volatility, trend, segment, seasonalAdjustments);
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

// ── Gap 13: Seasonal Adjustment Lookup ─────────────────────────

/**
 * Fetch seasonal patterns from aiFacts for a debtor and/or tenant-wide.
 * Returns merged adjustments: debtor-specific facts + tenant-wide facts.
 */
export async function getSeasonalAdjustments(
  tenantId: string,
  contactId?: string,
): Promise<SeasonalAdjustment[]> {
  try {
    const { db } = await import("../db");
    const { aiFacts } = await import("@shared/schema");
    const { eq, and, or, isNull } = await import("drizzle-orm");

    const facts = await db
      .select({
        entityType: aiFacts.entityType,
        entityId: aiFacts.entityId,
        factKey: aiFacts.factKey,
        factValue: aiFacts.factValue,
        confidence: aiFacts.confidence,
        source: aiFacts.source,
      })
      .from(aiFacts)
      .where(and(
        eq(aiFacts.tenantId, tenantId),
        eq(aiFacts.category, 'seasonal_pattern'),
        eq(aiFacts.isActive, true),
        or(
          // Debtor-specific patterns
          contactId ? eq(aiFacts.entityId, contactId) : undefined,
          // Tenant-wide patterns (no entityId)
          isNull(aiFacts.entityId),
        ),
      ));

    return facts
      .filter(f => f.factValue && MONTH_MAP[f.factValue.toLowerCase()])
      .map(f => ({
        month: MONTH_MAP[f.factValue!.toLowerCase()],
        adjustmentType: f.factKey === 'slow_month' ? 'slow' as const
          : f.factKey === 'year_end_month' ? 'year_end' as const
          : 'fast' as const,
        source: (f.source?.includes('riley') ? 'riley' : 'learned') as 'riley' | 'learned',
        confidence: parseFloat(String(f.confidence || '1')),
      }));
  } catch (error) {
    console.error('[SeasonalPatterns] Failed to fetch seasonal adjustments:', error);
    return []; // Non-fatal — planning continues without seasonal data
  }
}

/**
 * Calculate learned seasonal patterns from payment history.
 * Requires 12+ months of data and 2+ data points per month.
 * Returns months that deviate >20% from the overall average.
 */
export async function calculateLearnedSeasonalPatterns(
  tenantId: string,
  contactId: string,
): Promise<SeasonalAdjustment[]> {
  try {
    const { db } = await import("../db");
    const { invoices } = await import("@shared/schema");
    const { eq, and, isNotNull, sql } = await import("drizzle-orm");

    const payments = await db
      .select({
        paidDate: invoices.paidDate,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.contactId, contactId),
        eq(invoices.status, 'paid'),
        isNotNull(invoices.paidDate),
        isNotNull(invoices.dueDate),
        sql`${invoices.paidDate} > now() - interval '18 months'`,
      ));

    if (payments.length < 12) return []; // Not enough data

    // Calculate days-to-pay per invoice, grouped by month of payment
    const monthlyDays: Record<number, number[]> = {};
    for (const p of payments) {
      if (!p.paidDate || !p.dueDate) continue;
      const daysToPay = Math.max(0,
        (new Date(p.paidDate).getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24),
      );
      const month = new Date(p.paidDate).getMonth() + 1;
      if (!monthlyDays[month]) monthlyDays[month] = [];
      monthlyDays[month].push(daysToPay);
    }

    // Calculate overall average
    const allDays = Object.values(monthlyDays).flat();
    const overallAvg = allDays.reduce((a, b) => a + b, 0) / allDays.length;
    if (overallAvg <= 0) return [];

    // Identify months that deviate significantly from average
    const adjustments: SeasonalAdjustment[] = [];
    for (const [monthStr, days] of Object.entries(monthlyDays)) {
      const month = parseInt(monthStr);
      if (days.length < 2) continue; // Need at least 2 data points per month

      const monthAvg = days.reduce((a, b) => a + b, 0) / days.length;
      const factor = monthAvg / overallAvg;

      if (factor > 1.2) {
        adjustments.push({
          month,
          adjustmentType: 'slow',
          source: 'learned',
          confidence: Math.min(0.9, days.length / 10),
        });
      } else if (factor < 0.8) {
        adjustments.push({
          month,
          adjustmentType: 'fast',
          source: 'learned',
          confidence: Math.min(0.9, days.length / 10),
        });
      }
    }

    return adjustments;
  } catch (error) {
    console.error('[SeasonalPatterns] Failed to calculate learned patterns:', error);
    return [];
  }
}

/**
 * Merge Riley-captured and learned seasonal patterns.
 * Learned patterns override Riley facts for the same month when learningConfidence > 0.7.
 */
export async function getEffectiveSeasonalAdjustments(
  tenantId: string,
  contactId?: string,
  learningConfidence?: number,
): Promise<SeasonalAdjustment[]> {
  const rileyPatterns = await getSeasonalAdjustments(tenantId, contactId);

  // Only calculate learned patterns if contact specified and sufficient confidence
  let learnedPatterns: SeasonalAdjustment[] = [];
  if (contactId && (learningConfidence ?? 0) > 0.7) {
    learnedPatterns = await calculateLearnedSeasonalPatterns(tenantId, contactId);
  }

  if (learnedPatterns.length === 0) return rileyPatterns;

  // Merge: learned overrides riley for the same month
  const learnedMonths = new Set(learnedPatterns.map(l => l.month));
  const rileyOnly = rileyPatterns.filter(r => !learnedMonths.has(r.month));

  return [...learnedPatterns, ...rileyOnly];
}
