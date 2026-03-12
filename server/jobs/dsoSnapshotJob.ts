import { db } from "../db";
import { tenants, invoices, dsoSnapshots } from "../../shared/schema";
import { eq, and, sql, gte, lte, isNotNull } from "drizzle-orm";
import { storage } from "../storage";

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startDsoSnapshotJob(): void {
  console.log("[dso-snapshot] Starting daily DSO snapshot job");

  // Run once on startup (delayed 30s to let app boot)
  setTimeout(() => {
    runDsoSnapshots().catch((err) =>
      console.error("[dso-snapshot] Initial run error:", err),
    );
  }, 30_000);

  intervalHandle = setInterval(() => {
    runDsoSnapshots().catch((err) =>
      console.error("[dso-snapshot] Run error:", err),
    );
  }, INTERVAL_MS);
}

export function stopDsoSnapshotJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[dso-snapshot] Stopped");
  }
}

async function runDsoSnapshots(): Promise<void> {
  const allTenants = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.onboardingCompleted, true));

  console.log(`[dso-snapshot] Processing ${allTenants.length} tenants`);

  for (const tenant of allTenants) {
    try {
      await captureDsoSnapshot(tenant.id);
    } catch (err) {
      console.error(`[dso-snapshot] Failed for tenant ${tenant.id}:`, err);
    }
  }

  console.log("[dso-snapshot] Completed");
}

async function captureDsoSnapshot(tenantId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if snapshot already exists for today
  const existing = await db
    .select({ id: dsoSnapshots.id })
    .from(dsoSnapshots)
    .where(
      and(
        eq(dsoSnapshots.tenantId, tenantId),
        gte(dsoSnapshots.snapshotDate, today),
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  const now = new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Total outstanding receivables (unpaid invoices)
  const [arResult] = await db
    .select({
      totalReceivables: sql<string>`COALESCE(SUM(${invoices.amount} - ${invoices.amountPaid}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        sql`LOWER(${invoices.status}) NOT IN ('paid', 'void', 'voided', 'deleted')`,
      ),
    );

  // Overdue amount
  const [overdueResult] = await db
    .select({
      overdueAmount: sql<string>`COALESCE(SUM(${invoices.amount} - ${invoices.amountPaid}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        sql`LOWER(${invoices.status}) NOT IN ('paid', 'void', 'voided', 'deleted')`,
        lte(invoices.dueDate, now),
      ),
    );

  // Revenue in last 90 days (sum of all invoices issued)
  const [revenueResult] = await db
    .select({
      totalRevenue90d: sql<string>`COALESCE(SUM(${invoices.amount}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        gte(invoices.issueDate, ninetyDaysAgo),
      ),
    );

  // DSO = (Total Receivables / Total Revenue 90d) * 90
  const totalReceivables = parseFloat(arResult?.totalReceivables || "0");
  const totalRevenue90d = parseFloat(revenueResult?.totalRevenue90d || "0");
  const overdueAmount = parseFloat(overdueResult?.overdueAmount || "0");

  const dsoValue = totalRevenue90d > 0 ? (totalReceivables / totalRevenue90d) * 90 : 0;
  const overduePercentage =
    totalReceivables > 0 ? (overdueAmount / totalReceivables) * 100 : 0;

  await storage.createDsoSnapshot({
    tenantId,
    snapshotDate: today,
    dsoValue: String(Math.round(dsoValue * 10) / 10),
    totalReceivables: String(Math.round(totalReceivables * 100) / 100),
    totalRevenue90d: String(Math.round(totalRevenue90d * 100) / 100),
    overdueAmount: String(Math.round(overdueAmount * 100) / 100),
    overduePercentage: String(Math.round(overduePercentage * 10) / 10),
  });
}
