import { db } from '../../db';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { invoices, contacts, debtorProfiles } from '@shared/schema';

const PENALTY_WEIGHTS = {
  avgDaysLate: 35,
  p90DaysLate: 25,
  late30Plus: 25,
  volatility: 10,
  recency: 5,
} as const;

const PENALTY_CAPS = {
  avgDaysLate: 60,
  p90DaysLate: 90,
  volatility: 30,
  recency: 120,
} as const;

const BAND_THRESHOLDS = {
  EXCELLENT: 85,
  GOOD: 70,
  OK: 50,
} as const;

const INSUFFICIENT_DATA_MIN_INVOICES = 3;
const INSUFFICIENT_DATA_MIN_COVERAGE_DAYS = 90;

const STRATEGY_MAP: Record<string, { strategy: string; reason: string }> = {
  EXCELLENT: { strategy: 'GENTLE', reason: 'Excellent payment history — minimal chasing needed' },
  GOOD: { strategy: 'STANDARD', reason: 'Good payer — standard collections cadence' },
  OK: { strategy: 'STANDARD+', reason: 'Moderate risk — slightly more frequent follow-ups' },
  RISKY: { strategy: 'FIRM', reason: 'Poor payment history — firm escalation cadence' },
  UNKNOWN: { strategy: 'STANDARD', reason: 'Insufficient payment history — default cadence' },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export interface InvoiceRow {
  id: string;
  contactId: string;
  dueDate: Date;
  paidDate: Date | null;
  amount: string;
  amountPaid: string;
  status: string;
  invoiceStatus: string | null;
}

export interface ScoreFactors {
  onTimeRate: number;
  avgDaysLate: number;
  p90DaysLate: number;
  late30PlusRate: number;
  volatility: number;
  paymentRecency: number;
  paidInvoiceCount: number;
  dataCoverageDays: number;
  paidInvoiceMonthsCovered: number;
  penalties: {
    avg: number;
    p90: number;
    late30: number;
    vol: number;
    recency: number;
    total: number;
  };
}

export interface DebtorScoreResult {
  contactId: string;
  score0To100: number;
  scoreBand: string;
  dataCoverageDays: number;
  paidInvoiceMonthsCovered: number;
  paidInvoiceCount: number;
  avgDaysLate: number;
  onTimeRate: number;
  late30PlusRate: number;
  volatility: number;
  scoreFactors: ScoreFactors;
  strategy: string;
  strategyReason: string;
}

export function computeScoreForContact(
  contactId: string,
  contactInvoices: InvoiceRow[],
  now: Date = new Date()
): DebtorScoreResult {
  const paidInvoices = contactInvoices.filter(
    (inv) => inv.paidDate && (inv.invoiceStatus === 'PAID' || inv.status === 'paid')
  );

  const daysLateValues: number[] = [];
  let onTimeCount = 0;
  let late30PlusCount = 0;
  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;

  for (const inv of paidInvoices) {
    const due = new Date(inv.dueDate);
    const paid = new Date(inv.paidDate!);
    const daysLate = Math.max(0, Math.floor((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    daysLateValues.push(daysLate);

    if (daysLate <= 0) onTimeCount++;
    if (daysLate >= 30) late30PlusCount++;

    if (!earliestDate || due < earliestDate) earliestDate = due;
    if (!latestDate || paid > latestDate) latestDate = paid;
  }

  const paidInvoiceCount = paidInvoices.length;
  const dataCoverageDays = earliestDate && latestDate
    ? Math.max(1, Math.floor((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const paidInvoiceMonthsCovered = Math.ceil(dataCoverageDays / 30);

  if (paidInvoiceCount < INSUFFICIENT_DATA_MIN_INVOICES || dataCoverageDays < INSUFFICIENT_DATA_MIN_COVERAGE_DAYS) {
    const factors: ScoreFactors = {
      onTimeRate: 0,
      avgDaysLate: 0,
      p90DaysLate: 0,
      late30PlusRate: 0,
      volatility: 0,
      paymentRecency: 0,
      paidInvoiceCount,
      dataCoverageDays,
      paidInvoiceMonthsCovered,
      penalties: { avg: 0, p90: 0, late30: 0, vol: 0, recency: 0, total: 0 },
    };
    const { strategy, reason } = STRATEGY_MAP.UNKNOWN;
    return {
      contactId,
      score0To100: 50,
      scoreBand: 'UNKNOWN',
      dataCoverageDays,
      paidInvoiceMonthsCovered,
      paidInvoiceCount,
      avgDaysLate: 0,
      onTimeRate: 0,
      late30PlusRate: 0,
      volatility: 0,
      scoreFactors: factors,
      strategy,
      strategyReason: reason,
    };
  }

  const avgDaysLate = daysLateValues.reduce((a, b) => a + b, 0) / daysLateValues.length;
  const sortedDaysLate = [...daysLateValues].sort((a, b) => a - b);
  const p90DaysLate = percentile(sortedDaysLate, 90);
  const onTimeRate = onTimeCount / paidInvoiceCount;
  const late30PlusRate = late30PlusCount / paidInvoiceCount;
  const volatility = stddev(daysLateValues);

  const lastPaymentDate = latestDate!;
  const paymentRecency = Math.max(0, Math.floor((now.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)));

  const penaltyAvg = clamp(avgDaysLate / PENALTY_CAPS.avgDaysLate, 0, 1) * PENALTY_WEIGHTS.avgDaysLate;
  const penaltyP90 = clamp(p90DaysLate / PENALTY_CAPS.p90DaysLate, 0, 1) * PENALTY_WEIGHTS.p90DaysLate;
  const penaltyLate30 = late30PlusRate * PENALTY_WEIGHTS.late30Plus;
  const penaltyVol = clamp(volatility / PENALTY_CAPS.volatility, 0, 1) * PENALTY_WEIGHTS.volatility;
  const penaltyRecency = clamp(paymentRecency / PENALTY_CAPS.recency, 0, 1) * PENALTY_WEIGHTS.recency;
  const totalPenalty = penaltyAvg + penaltyP90 + penaltyLate30 + penaltyVol + penaltyRecency;

  const score0To100 = Math.round(clamp(100 - totalPenalty, 0, 100));

  let scoreBand: string;
  if (score0To100 >= BAND_THRESHOLDS.EXCELLENT) scoreBand = 'EXCELLENT';
  else if (score0To100 >= BAND_THRESHOLDS.GOOD) scoreBand = 'GOOD';
  else if (score0To100 >= BAND_THRESHOLDS.OK) scoreBand = 'OK';
  else scoreBand = 'RISKY';

  const { strategy, reason } = STRATEGY_MAP[scoreBand];

  const factors: ScoreFactors = {
    onTimeRate: Math.round(onTimeRate * 10000) / 10000,
    avgDaysLate: Math.round(avgDaysLate * 100) / 100,
    p90DaysLate: Math.round(p90DaysLate * 100) / 100,
    late30PlusRate: Math.round(late30PlusRate * 10000) / 10000,
    volatility: Math.round(volatility * 10000) / 10000,
    paymentRecency,
    paidInvoiceCount,
    dataCoverageDays,
    paidInvoiceMonthsCovered,
    penalties: {
      avg: Math.round(penaltyAvg * 100) / 100,
      p90: Math.round(penaltyP90 * 100) / 100,
      late30: Math.round(penaltyLate30 * 100) / 100,
      vol: Math.round(penaltyVol * 100) / 100,
      recency: Math.round(penaltyRecency * 100) / 100,
      total: Math.round(totalPenalty * 100) / 100,
    },
  };

  return {
    contactId,
    score0To100,
    scoreBand,
    dataCoverageDays,
    paidInvoiceMonthsCovered,
    paidInvoiceCount,
    avgDaysLate: factors.avgDaysLate,
    onTimeRate: factors.onTimeRate,
    late30PlusRate: factors.late30PlusRate,
    volatility: factors.volatility,
    scoreFactors: factors,
    strategy,
    strategyReason: reason,
  };
}

export async function fetchInvoicesForTenant(tenantId: string): Promise<InvoiceRow[]> {
  const rows = await db
    .select({
      id: invoices.id,
      contactId: invoices.contactId,
      dueDate: invoices.dueDate,
      paidDate: invoices.paidDate,
      amount: invoices.amount,
      amountPaid: invoices.amountPaid,
      status: invoices.status,
      invoiceStatus: invoices.invoiceStatus,
    })
    .from(invoices)
    .where(eq(invoices.tenantId, tenantId));

  return rows.map((r) => ({
    id: r.id,
    contactId: r.contactId,
    dueDate: new Date(r.dueDate),
    paidDate: r.paidDate ? new Date(r.paidDate) : null,
    amount: r.amount,
    amountPaid: r.amountPaid ?? '0',
    status: r.status,
    invoiceStatus: r.invoiceStatus,
  }));
}

export async function getEligibleContactIds(tenantId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ contactId: invoices.contactId })
    .from(invoices)
    .where(eq(invoices.tenantId, tenantId));
  return rows.map((r) => r.contactId);
}

export async function scoreAllContactsForTenant(
  tenantId: string,
  onProgress?: (current: number, total: number) => void
): Promise<DebtorScoreResult[]> {
  const allInvoices = await fetchInvoicesForTenant(tenantId);
  const eligibleContactIds = [...new Set(allInvoices.map((inv) => inv.contactId))];
  const total = eligibleContactIds.length;
  const now = new Date();

  const invoicesByContact = new Map<string, InvoiceRow[]>();
  for (const inv of allInvoices) {
    const list = invoicesByContact.get(inv.contactId) || [];
    list.push(inv);
    invoicesByContact.set(inv.contactId, list);
  }

  const results: DebtorScoreResult[] = [];

  for (let i = 0; i < eligibleContactIds.length; i++) {
    const contactId = eligibleContactIds[i];
    const contactInvoices = invoicesByContact.get(contactId) || [];
    const result = computeScoreForContact(contactId, contactInvoices, now);
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return results;
}

export async function upsertDebtorProfiles(
  tenantId: string,
  results: DebtorScoreResult[]
): Promise<void> {
  const now = new Date();

  for (const result of results) {
    await db
      .insert(debtorProfiles)
      .values({
        tenantId,
        contactId: result.contactId,
        score0To100: result.score0To100,
        scoreBand: result.scoreBand,
        dataCoverageDays: result.dataCoverageDays,
        paidInvoiceMonthsCovered: result.paidInvoiceMonthsCovered,
        paidInvoiceCount: result.paidInvoiceCount,
        avgDaysLate: String(result.avgDaysLate),
        onTimeRate: String(result.onTimeRate),
        late30PlusRate: String(result.late30PlusRate),
        volatility: String(result.volatility),
        lastComputedAt: now,
        scoreFactorsJson: result.scoreFactors,
        strategyJson: { strategy: result.strategy },
        strategyReason: result.strategyReason,
      })
      .onConflictDoUpdate({
        target: [debtorProfiles.tenantId, debtorProfiles.contactId],
        set: {
          score0To100: result.score0To100,
          scoreBand: result.scoreBand,
          dataCoverageDays: result.dataCoverageDays,
          paidInvoiceMonthsCovered: result.paidInvoiceMonthsCovered,
          paidInvoiceCount: result.paidInvoiceCount,
          avgDaysLate: String(result.avgDaysLate),
          onTimeRate: String(result.onTimeRate),
          late30PlusRate: String(result.late30PlusRate),
          volatility: String(result.volatility),
          lastComputedAt: now,
          scoreFactorsJson: result.scoreFactors,
          strategyJson: { strategy: result.strategy },
          strategyReason: result.strategyReason,
          updatedAt: now,
        },
      });
  }
}

export async function runDebtorScoringForTenant(
  tenantId: string,
  onProgress?: (current: number, total: number) => void
): Promise<DebtorScoreResult[]> {
  const results = await scoreAllContactsForTenant(tenantId, onProgress);
  await upsertDebtorProfiles(tenantId, results);
  return results;
}
