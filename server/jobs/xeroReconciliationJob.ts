import cron from "node-cron";
import { db } from "../db";
import { tenants } from "../../shared/schema";
import { and, isNotNull, eq } from "drizzle-orm";
import { XeroSyncService } from "../services/xeroSync";

export function startXeroReconciliationJob(): void {
  // 02:00 UTC daily
  cron.schedule("0 2 * * *", () => {
    runNightlyReconciliation().catch((err) =>
      console.error("[XeroReconciliation] Unhandled error:", err),
    );
  }, { timezone: "UTC" });

  console.log("[XeroReconciliation] Nightly job scheduled for 02:00 UTC");
}

export async function runNightlyReconciliation(): Promise<void> {
  const start = Date.now();
  console.log("[XeroReconciliation] Starting nightly full reconciliation...");

  // Fetch all tenants with active Xero connections
  const eligibleTenants = await db
    .select({
      id: tenants.id,
      name: tenants.name,
    })
    .from(tenants)
    .where(and(
      eq(tenants.xeroAutoSync, true),
      isNotNull(tenants.xeroAccessToken),
      isNotNull(tenants.xeroTenantId),
    ));

  if (eligibleTenants.length === 0) {
    console.log("[XeroReconciliation] No eligible tenants — done");
    return;
  }

  console.log(`[XeroReconciliation] Found ${eligibleTenants.length} eligible tenant(s)`);

  const xeroSyncService = new XeroSyncService();
  let succeeded = 0;
  let failed = 0;
  let totalInvoices = 0;

  for (const tenant of eligibleTenants) {
    try {
      console.log(`[XeroReconciliation] Syncing tenant ${tenant.id} (${tenant.name})...`);
      const result = await xeroSyncService.syncAllDataForTenant(
        tenant.id,
        "ongoing",
        undefined,
        { force: true },
      );

      if (result.success) {
        succeeded++;
        totalInvoices += result.invoicesCount;
        console.log(`[XeroReconciliation] Tenant ${tenant.id} OK — ${result.invoicesCount} invoices`);
      } else {
        failed++;
        console.error(`[XeroReconciliation] Tenant ${tenant.id} failed: ${result.error}`);
      }
    } catch (error) {
      failed++;
      console.error(`[XeroReconciliation] Tenant ${tenant.id} threw:`, error);
    }

    // 5-second pause between tenants to respect Xero API rate limits
    if (eligibleTenants.indexOf(tenant) < eligibleTenants.length - 1) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  const durationSec = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `[XeroReconciliation] Nightly job complete:\n` +
    `  ${eligibleTenants.length} tenants processed, ${succeeded} succeeded, ${failed} failed\n` +
    `  Total invoices synced: ${totalInvoices}\n` +
    `  Duration: ${durationSec}s`,
  );
}
