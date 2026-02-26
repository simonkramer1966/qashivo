import { db } from "../db";
import { analysisJobs, onboardingProgress } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { runDebtorScoringForTenant } from "../services/scoring/debtorScoring";
import { onboardingService } from "../services/onboardingService";

const POLL_INTERVAL_MS = 5000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function processQueuedJobs(): Promise<void> {
  try {
    const [job] = await db
      .select()
      .from(analysisJobs)
      .where(and(eq(analysisJobs.type, "DEBTOR_SCORING"), eq(analysisJobs.status, "QUEUED")))
      .limit(1);

    if (!job) return;

    console.log(`[DebtorScoring] Starting job ${job.id} for tenant ${job.tenantId}`);

    await db
      .update(analysisJobs)
      .set({ status: "RUNNING", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(analysisJobs.id, job.id));

    try {
      const result = await runDebtorScoringForTenant(job.tenantId, (current, total) => {
        db.update(analysisJobs)
          .set({ progressCurrent: current, progressTotal: total, updatedAt: new Date() })
          .where(eq(analysisJobs.id, job.id))
          .then(() => {})
          .catch(err => console.error("[DebtorScoring] Progress update error:", err));
      });

      await db
        .update(analysisJobs)
        .set({
          status: "SUCCEEDED",
          progressCurrent: result.totalScored,
          progressTotal: result.totalScored,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(analysisJobs.id, job.id));

      await onboardingService.updateStepStatus(job.tenantId, 5, "COMPLETED");

      console.log(`[DebtorScoring] Job ${job.id} succeeded: ${result.totalScored} contacts scored`);
    } catch (error: any) {
      console.error(`[DebtorScoring] Job ${job.id} failed:`, error);
      await db
        .update(analysisJobs)
        .set({
          status: "FAILED",
          errorMessage: error.message || "Unknown error",
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(analysisJobs.id, job.id));
    }
  } catch (err) {
    console.error("[DebtorScoring] Queue processing error:", err);
  }
}

export function startDebtorScoringWorker(): void {
  if (pollTimer) return;
  console.log("[DebtorScoring] Worker started, polling every 5s");
  pollTimer = setInterval(processQueuedJobs, POLL_INTERVAL_MS);
}

export function stopDebtorScoringWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export async function enqueueDebtorScoringAfterSync(tenantId: string): Promise<void> {
  try {
    await onboardingService.enqueueDebtorScoring(tenantId, "SYNC");
    console.log(`[DebtorScoring] Queued scoring job for tenant ${tenantId} after Xero sync`);
  } catch (error) {
    console.error("[DebtorScoring] Failed to enqueue after sync:", error);
  }
}
