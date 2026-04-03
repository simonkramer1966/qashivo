/**
 * Working Capital Impact Scheduler
 *
 * Runs daily — checks all tenants with a baseline snapshot to see if
 * they've hit the 30-day or 90-day milestone since first Xero connection.
 * Creates milestone snapshots automatically.
 */

import { db } from "../db";
import { tenants, tenantImpactSnapshots } from "@shared/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function runImpactCheck(): Promise<void> {
  console.log("[impact-scheduler] Running milestone check");

  // Find tenants with firstXeroConnectedAt set (i.e. have a baseline)
  const eligibleTenants = await db
    .select({
      id: tenants.id,
      firstXeroConnectedAt: tenants.firstXeroConnectedAt,
    })
    .from(tenants)
    .where(isNotNull(tenants.firstXeroConnectedAt));

  if (eligibleTenants.length === 0) {
    console.log("[impact-scheduler] No eligible tenants");
    return;
  }

  const { calculateAndStoreSnapshot } = await import(
    "../services/impactSnapshotService"
  );

  const now = Date.now();

  for (const tenant of eligibleTenants) {
    if (!tenant.firstXeroConnectedAt) continue;

    const daysSinceConnect = Math.floor(
      (now - tenant.firstXeroConnectedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Check which milestones are due
    const milestones: Array<{ type: "30_day" | "90_day"; minDays: number }> = [
      { type: "30_day", minDays: 30 },
      { type: "90_day", minDays: 90 },
    ];

    for (const milestone of milestones) {
      if (daysSinceConnect < milestone.minDays) continue;

      // Check if this milestone snapshot already exists
      const [existing] = await db
        .select({ id: tenantImpactSnapshots.id })
        .from(tenantImpactSnapshots)
        .where(
          and(
            eq(tenantImpactSnapshots.tenantId, tenant.id),
            eq(tenantImpactSnapshots.snapshotType, milestone.type),
          ),
        )
        .limit(1);

      if (existing) continue;

      try {
        await calculateAndStoreSnapshot(tenant.id, milestone.type);
        console.log(
          `[impact-scheduler] Created ${milestone.type} snapshot for tenant ${tenant.id}`,
        );
      } catch (err) {
        console.warn(
          `[impact-scheduler] Failed ${milestone.type} for tenant ${tenant.id}:`,
          err,
        );
      }
    }
  }

  console.log("[impact-scheduler] Milestone check complete");
}

export function startImpactScheduler(): void {
  console.log("[impact-scheduler] Starting daily impact scheduler");

  // Delay initial run by 3 minutes to let app boot
  setTimeout(() => {
    runImpactCheck().catch((err) =>
      console.error("[impact-scheduler] Initial run error:", err),
    );
  }, 180_000);

  intervalHandle = setInterval(() => {
    runImpactCheck().catch((err) =>
      console.error("[impact-scheduler] Run error:", err),
    );
  }, INTERVAL_MS);
}

export function stopImpactScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[impact-scheduler] Stopped");
  }
}
