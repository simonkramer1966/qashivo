/**
 * Working Capital Impact Snapshot Service
 *
 * Calculates and stores impact snapshots that measure the tangible value
 * Qashivo delivers to each tenant. Snapshots compare current AR metrics
 * against a baseline captured at first Xero connection.
 *
 * Key metric: Working Capital Released = DSO Improvement × Avg Daily Revenue
 */

import { db } from "../db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantImpactSnapshots, invoices, contacts, tenants, aiFacts } from "@shared/schema";
import { getARSummary } from "./arCalculations";
import { generateText } from "./llm/claude";

type SnapshotType = "baseline" | "30_day" | "90_day" | "manual";

interface SnapshotResult {
  id: string;
  snapshotType: string;
  dso: number;
  avgDaysToPay: number;
  workingCapitalReleased: number | null;
  dsoImprovement: number | null;
  rileySummary: string | null;
}

// ── Core calculation ──────────────────────────────────────────

export async function calculateAndStoreSnapshot(
  tenantId: string,
  snapshotType: SnapshotType,
): Promise<SnapshotResult> {
  const now = new Date();

  // 1. AR summary via canonical source
  const ar = await getARSummary(tenantId);

  // 2. Average days to pay (weighted by invoice amount, last 12 months)
  const avgDaysResult = await db.execute(sql`
    SELECT
      COALESCE(
        SUM(EXTRACT(DAY FROM AGE(paid_date, issue_date)) * CAST(amount AS numeric))
        / NULLIF(SUM(CAST(amount AS numeric)), 0),
        0
      ) AS avg_days
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND status = 'paid'
      AND paid_date IS NOT NULL
      AND issue_date IS NOT NULL
      AND paid_date >= NOW() - INTERVAL '12 months'
  `);
  const avgDaysToPay = Math.round(Number((avgDaysResult as any).rows?.[0]?.avg_days ?? 0) * 100) / 100;

  // 3. Average payment terms across contacts with outstanding invoices
  const termsResult = await db.execute(sql`
    SELECT COALESCE(AVG(CAST(c.payment_terms AS numeric)), 30) AS avg_terms
    FROM contacts c
    WHERE c.tenant_id = ${tenantId}
      AND c.is_active = true
      AND c.payment_terms IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.contact_id = c.id
          AND i.tenant_id = ${tenantId}
          AND LOWER(i.status) NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')
      )
  `);
  const avgPaymentTerms = Math.round(Number((termsResult as any).rows?.[0]?.avg_terms ?? 30) * 100) / 100;

  // 4. Revenue data (last 12 months)
  const revenueResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(amount AS numeric)), 0) AS total_12m,
      COUNT(*)::int AS invoice_count
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND issue_date >= NOW() - INTERVAL '12 months'
      AND LOWER(status) NOT IN ('void', 'voided', 'deleted', 'draft')
  `);
  const totalInvoiced12m = Math.round(Number((revenueResult as any).rows?.[0]?.total_12m ?? 0) * 100) / 100;
  const invoiceCount = Number((revenueResult as any).rows?.[0]?.invoice_count ?? 0);
  const avgDailyRevenue = Math.round((totalInvoiced12m / 365) * 100) / 100;

  // 5. Collection rate (% invoices paid on or before due date, last 12 months)
  const collectionResult = await db.execute(sql`
    SELECT
      COUNT(CASE WHEN paid_date <= due_date THEN 1 END)::numeric
      / NULLIF(COUNT(*)::numeric, 0) * 100 AS rate
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND status = 'paid'
      AND paid_date IS NOT NULL
      AND due_date IS NOT NULL
      AND paid_date >= NOW() - INTERVAL '12 months'
  `);
  const collectionRate = Math.round(Number((collectionResult as any).rows?.[0]?.rate ?? 0) * 100) / 100;

  const daysVsTerms = Math.round((avgDaysToPay - avgPaymentTerms) * 100) / 100;
  const overduePercentage = ar.totalOutstanding > 0
    ? Math.round((ar.totalOverdue / ar.totalOutstanding) * 10000) / 100
    : 0;

  // 6. Comparison to baseline (for non-baseline snapshots)
  let comparison: Record<string, any> = {};
  if (snapshotType !== "baseline") {
    const baseline = await getBaselineSnapshot(tenantId);
    if (baseline) {
      const baselineDso = Number(baseline.dso ?? 0);
      const baselineDaysVsTerms = Number(baseline.daysVsTerms ?? 0);
      const baselineCollectionRate = Number(baseline.collectionRate ?? 0);

      const dsoImprovement = Math.round((baselineDso - ar.currentDSO) * 100) / 100;
      const wcReleased = Math.round(dsoImprovement * avgDailyRevenue * 100) / 100;

      comparison = {
        baselineSnapshotId: baseline.id,
        dsoImprovement: dsoImprovement.toString(),
        workingCapitalReleased: wcReleased.toString(),
        workingCapitalReleasedPct: ar.totalOutstanding > 0
          ? (Math.round((wcReleased / ar.totalOutstanding) * 10000) / 100).toString()
          : "0",
        daysVsTermsImprovement: (Math.round((baselineDaysVsTerms - daysVsTerms) * 100) / 100).toString(),
        collectionRateImprovement: (Math.round((collectionRate - baselineCollectionRate) * 100) / 100).toString(),
      };
    }
  }

  // 7. Riley narrative (only for milestone snapshots)
  let rileySummary: string | null = null;
  let rileyGeneratedAt: Date | null = null;
  if (snapshotType === "baseline" || snapshotType === "30_day" || snapshotType === "90_day") {
    try {
      rileySummary = await generateImpactNarrative(snapshotType, {
        dso: ar.currentDSO,
        avgDaysToPay,
        avgPaymentTerms,
        totalOutstanding: ar.totalOutstanding,
        totalOverdue: ar.totalOverdue,
        dsoImprovement: comparison.dsoImprovement ? Number(comparison.dsoImprovement) : null,
        workingCapitalReleased: comparison.workingCapitalReleased ? Number(comparison.workingCapitalReleased) : null,
        collectionRate,
        days: snapshotType === "30_day" ? 30 : snapshotType === "90_day" ? 90 : 0,
      });
      rileyGeneratedAt = new Date();
    } catch (err) {
      console.warn("[Impact] Riley narrative generation failed:", err);
    }
  }

  // 8. Store snapshot
  const [snapshot] = await db.insert(tenantImpactSnapshots).values({
    tenantId,
    snapshotType,
    snapshotDate: now,
    dso: ar.currentDSO.toString(),
    avgDaysToPay: avgDaysToPay.toString(),
    avgPaymentTerms: avgPaymentTerms.toString(),
    daysVsTerms: daysVsTerms.toString(),
    totalOutstanding: ar.totalOutstanding.toString(),
    totalOverdue: ar.totalOverdue.toString(),
    overduePercentage: overduePercentage.toString(),
    totalInvoiced12m: totalInvoiced12m.toString(),
    avgDailyRevenue: avgDailyRevenue.toString(),
    debtorCount: ar.debtorCount,
    invoiceCount,
    collectionRate: collectionRate.toString(),
    rileySummary,
    rileyGeneratedAt,
    ...comparison,
  }).returning();

  console.log(`[Impact] ${snapshotType} snapshot created for tenant ${tenantId}: DSO=${ar.currentDSO}, WC released=${comparison.workingCapitalReleased ?? "n/a"}`);

  // 9. Store aiFact for Riley to surface proactively
  if (snapshotType !== "manual") {
    try {
      const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;
      const factValue = snapshotType === "baseline"
        ? `Baseline AR snapshot captured: DSO ${ar.currentDSO} days, ${gbp(ar.totalOutstanding)} outstanding, ${collectionRate}% on-time collection rate.`
        : `${snapshotType === "30_day" ? "30-day" : "90-day"} impact milestone: DSO improved by ${comparison.dsoImprovement ?? 0} days, ${comparison.workingCapitalReleased ? gbp(Number(comparison.workingCapitalReleased)) : "£0"} working capital released.`;

      await db.insert(aiFacts).values({
        tenantId,
        category: "impact_milestone",
        factKey: `impact_${snapshotType}`,
        factValue,
        confidence: 1.0,
        source: "impact_snapshot_service",
        isActive: true,
      });
    } catch (err) {
      console.warn("[Impact] Failed to store aiFact:", err);
    }
  }

  return {
    id: snapshot.id,
    snapshotType: snapshot.snapshotType,
    dso: ar.currentDSO,
    avgDaysToPay,
    workingCapitalReleased: comparison.workingCapitalReleased ? Number(comparison.workingCapitalReleased) : null,
    dsoImprovement: comparison.dsoImprovement ? Number(comparison.dsoImprovement) : null,
    rileySummary,
  };
}

// ── Queries ──────────────────────────────────────────────────

export async function getBaselineSnapshot(tenantId: string) {
  const [row] = await db
    .select()
    .from(tenantImpactSnapshots)
    .where(and(
      eq(tenantImpactSnapshots.tenantId, tenantId),
      eq(tenantImpactSnapshots.snapshotType, "baseline"),
    ))
    .orderBy(desc(tenantImpactSnapshots.snapshotDate))
    .limit(1);
  return row ?? null;
}

export async function getLatestSnapshot(tenantId: string) {
  const [row] = await db
    .select()
    .from(tenantImpactSnapshots)
    .where(eq(tenantImpactSnapshots.tenantId, tenantId))
    .orderBy(desc(tenantImpactSnapshots.snapshotDate))
    .limit(1);
  return row ?? null;
}

export async function listSnapshots(tenantId: string, limit = 50) {
  return db
    .select()
    .from(tenantImpactSnapshots)
    .where(eq(tenantImpactSnapshots.tenantId, tenantId))
    .orderBy(desc(tenantImpactSnapshots.snapshotDate))
    .limit(limit);
}

export async function getImpactSummary(tenantId: string) {
  const [baseline, latest, snapshots] = await Promise.all([
    getBaselineSnapshot(tenantId),
    getLatestSnapshot(tenantId),
    listSnapshots(tenantId, 10),
  ]);

  // Get firstXeroConnectedAt for days-since calculation
  const [tenant] = await db
    .select({ firstXeroConnectedAt: tenants.firstXeroConnectedAt })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return {
    baseline,
    latest,
    snapshots,
    firstXeroConnectedAt: tenant?.firstXeroConnectedAt ?? null,
    daysSinceConnect: tenant?.firstXeroConnectedAt
      ? Math.floor((Date.now() - tenant.firstXeroConnectedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null,
  };
}

// ── Riley narrative ──────────────────────────────────────────

async function generateImpactNarrative(
  snapshotType: SnapshotType,
  data: {
    dso: number;
    avgDaysToPay: number;
    avgPaymentTerms: number;
    totalOutstanding: number;
    totalOverdue: number;
    dsoImprovement: number | null;
    workingCapitalReleased: number | null;
    collectionRate: number;
    days: number;
  },
): Promise<string> {
  const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

  const prompt = snapshotType === "baseline"
    ? `You are Riley, Qashivo's AI assistant. A new client has just connected their accounting software. Here is their current AR position:
- DSO: ${data.dso} days
- Average days to pay: ${data.avgDaysToPay} days
- Payment terms: ${data.avgPaymentTerms} days
- Outstanding: ${gbp(data.totalOutstanding)}
- Overdue: ${gbp(data.totalOverdue)}
- Collection rate (on-time): ${data.collectionRate}%

Write a 2-3 sentence baseline summary acknowledging their current position and setting a positive expectation for improvement. Be encouraging and specific about the numbers. Do not use emojis.`
    : `You are Riley, Qashivo's AI assistant. A client has been using Qashivo for ${data.days} days.

BASELINE (before Qashivo):
DSO improvement since baseline: ${data.dsoImprovement ?? 0} days
Working capital released: ${data.workingCapitalReleased ? gbp(data.workingCapitalReleased) : "calculating"}

CURRENT:
DSO: ${data.dso} days
Average days to pay: ${data.avgDaysToPay} days
Outstanding: ${gbp(data.totalOutstanding)}
Overdue: ${gbp(data.totalOverdue)}
Collection rate: ${data.collectionRate}%

Write a 3-4 sentence impact summary. If DSO has improved, celebrate the working capital released figure prominently. If DSO has not improved, be honest but encouraging about what to focus on next. Be specific, warm, and results-focused. Do not use emojis.`;

  return generateText({
    system: "You are Riley, a warm and professional AI assistant for UK SMEs managing accounts receivable. Write in British English. Be concise and specific.",
    prompt,
    model: "fast",
    temperature: 0.4,
    maxTokens: 300,
  });
}
