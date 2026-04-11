import { db } from "../db";
import { auditLog } from "@shared/schema";
import { and, eq, lt } from "drizzle-orm";

let lastRunDate: string | null = null;

/**
 * Nightly purge of operational audit log entries older than 2 years.
 * Financial entries (7-year retention) are never touched.
 * Runs at 3am UTC, checked hourly.
 */
export function startAuditLogRetentionJob(): void {
  setInterval(async () => {
    const now = new Date();
    if (now.getUTCHours() !== 3) return;

    const today = now.toISOString().slice(0, 10);
    if (lastRunDate === today) return;
    lastRunDate = today;

    try {
      const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
      const result = await db.delete(auditLog).where(
        and(
          eq(auditLog.category, "operational"),
          lt(auditLog.createdAt, twoYearsAgo),
        ),
      );

      console.log(`[AuditRetention] Purged ${(result as any).rowCount ?? 0} operational entries older than 2 years`);
    } catch (error) {
      console.error("[AuditRetention] Failed to purge:", error);
    }
  }, 60 * 60 * 1000);

  console.log("[AuditRetention] Retention cleanup job scheduled (3am UTC daily)");
}
