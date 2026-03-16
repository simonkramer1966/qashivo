import { eq, and, lte, sql, desc } from "drizzle-orm";
import { db } from "../db";
import { actions, actionBatches, tenants } from "@shared/schema";
import { storage } from "../storage";
import { approveAndSend } from "./collectionsPipeline";
import { approveAndSendReply } from "./inboundReplyPipeline";

// ── Batch Processor Service ─────────────────────────────────────
// Groups AI-proposed actions into time-windowed batches for countdown-based approval.
// In semi-auto mode, batches auto-process on expiry. In manual mode, no timer.

class BatchProcessor {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs = 60_000; // Check every 60 seconds

  start(): void {
    if (this.intervalId) return;
    console.log("[BatchProcessor] Starting (poll every 60s)");
    this.intervalId = setInterval(() => {
      this.checkExpiredBatches().catch((err) =>
        console.error("[BatchProcessor] Error in poll:", err)
      );
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[BatchProcessor] Stopped");
    }
  }

  /**
   * Find or create the current pending batch for a tenant.
   * Uses the tenant's batchFrequencyMinutes to set scheduledFor.
   */
  async getOrCreateCurrentBatch(tenantId: string): Promise<{ id: string; scheduledFor: Date }> {
    // Look for existing pending batch
    const [existing] = await db
      .select()
      .from(actionBatches)
      .where(and(eq(actionBatches.tenantId, tenantId), eq(actionBatches.status, "pending")))
      .orderBy(desc(actionBatches.createdAt))
      .limit(1);

    if (existing) {
      return { id: existing.id, scheduledFor: existing.scheduledFor };
    }

    // Create a new batch
    const tenant = await storage.getTenant(tenantId);
    const frequencyMinutes = (tenant as any).batchFrequencyMinutes ?? 60;
    const scheduledFor = new Date(Date.now() + frequencyMinutes * 60_000);

    const [batch] = await db
      .insert(actionBatches)
      .values({ tenantId, scheduledFor, status: "pending" })
      .returning();

    console.log(`[BatchProcessor] Created batch ${batch.id} for tenant ${tenantId}, scheduled for ${scheduledFor.toISOString()}`);
    return { id: batch.id, scheduledFor: batch.scheduledFor };
  }

  /**
   * Process a single batch: auto-approve all remaining pending_approval actions.
   */
  async processBatch(batchId: string): Promise<{ approved: number; failed: number }> {
    // Mark batch as processing
    await db
      .update(actionBatches)
      .set({ status: "processing" })
      .where(eq(actionBatches.id, batchId));

    const pendingActions = await db
      .select({ id: actions.id, metadata: actions.metadata })
      .from(actions)
      .where(and(eq(actions.batchId, batchId), eq(actions.status, "pending_approval")));

    let approved = 0;
    let failed = 0;

    for (const action of pendingActions) {
      try {
        const meta = action.metadata as any;
        if (meta?.direction === "outbound_reply" && meta?.inboundEmailMessageId) {
          await approveAndSendReply(action.id, null);
        } else {
          await approveAndSend(action.id, null);
        }
        approved++;
      } catch (err) {
        console.error(`[BatchProcessor] Failed to auto-approve action ${action.id}:`, err);
        failed++;
      }
    }

    // Update batch stats
    await db
      .update(actionBatches)
      .set({
        status: "completed",
        processedAt: new Date(),
        autoApprovedCount: sql`COALESCE(${actionBatches.autoApprovedCount}, 0) + ${approved}`,
      })
      .where(eq(actionBatches.id, batchId));

    console.log(`[BatchProcessor] Batch ${batchId} complete: ${approved} approved, ${failed} failed`);
    return { approved, failed };
  }

  /**
   * Main poll: find all expired batches and process them.
   */
  async checkExpiredBatches(): Promise<void> {
    const now = new Date();
    const expired = await db
      .select()
      .from(actionBatches)
      .where(and(eq(actionBatches.status, "pending"), lte(actionBatches.scheduledFor, now)));

    for (const batch of expired) {
      // Only auto-process if tenant is in auto_after_timeout mode
      const tenant = await storage.getTenant(batch.tenantId);
      if ((tenant as any).approvalMode !== "auto_after_timeout") continue;

      await this.processBatch(batch.id).catch((err) =>
        console.error(`[BatchProcessor] Error processing batch ${batch.id}:`, err)
      );
    }
  }

  /**
   * Force-process a tenant's current pending batch immediately.
   */
  async processNow(tenantId: string): Promise<{ approved: number; failed: number } | null> {
    const [batch] = await db
      .select()
      .from(actionBatches)
      .where(and(eq(actionBatches.tenantId, tenantId), eq(actionBatches.status, "pending")))
      .orderBy(desc(actionBatches.createdAt))
      .limit(1);

    if (!batch) return null;
    return this.processBatch(batch.id);
  }

  /**
   * Get current batch info for a tenant (for countdown timer).
   */
  async getCurrentBatch(tenantId: string) {
    const [batch] = await db
      .select()
      .from(actionBatches)
      .where(and(eq(actionBatches.tenantId, tenantId), eq(actionBatches.status, "pending")))
      .orderBy(desc(actionBatches.createdAt))
      .limit(1);

    if (!batch) return null;

    // Count actions in this batch
    const [stats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(actions)
      .where(and(eq(actions.batchId, batch.id), eq(actions.status, "pending_approval")));

    return {
      ...batch,
      pendingCount: stats?.count ?? 0,
    };
  }

  /**
   * Update batch stats after an action is individually approved/rejected/deferred.
   */
  async updateBatchStats(batchId: string, field: "approvedCount" | "rejectedCount" | "deferredCount"): Promise<void> {
    const col = actionBatches[field];
    await db
      .update(actionBatches)
      .set({ [field]: sql`COALESCE(${col}, 0) + 1` })
      .where(eq(actionBatches.id, batchId));
  }
}

export const batchProcessor = new BatchProcessor();

// ── proposeAction ───────────────────────────────────────────────
// Central entry point for AI-generated actions. Routes through batch queue
// or executes immediately based on tenant's approvalMode.

export async function proposeAction(params: {
  tenantId: string;
  agentType?: string;
  type: string;
  actionSummary?: string;
  priority?: number;
  confidenceScore?: string;
  [key: string]: any;
}): Promise<{ id: string }> {
  const tenant = await storage.getTenant(params.tenantId);
  const approvalMode = (tenant as any).approvalMode ?? "manual";

  if (approvalMode === "full_auto") {
    // Skip queue — create as approved and execute immediately
    const action = await storage.createAction({
      ...params,
      status: "completed",
      approvedAt: new Date(),
      aiGenerated: true,
      source: "automated",
    });
    try {
      await approveAndSend(action.id, null);
    } catch (err) {
      console.error(`[proposeAction] full_auto delivery failed for ${action.id}:`, err);
    }
    return { id: action.id };
  }

  // manual or auto_after_timeout — queue for review
  let batchId: string | undefined;
  if (approvalMode === "auto_after_timeout") {
    const batch = await batchProcessor.getOrCreateCurrentBatch(params.tenantId);
    batchId = batch.id;
    // Also update batch total count
    await db
      .update(actionBatches)
      .set({ totalActions: sql`COALESCE(${actionBatches.totalActions}, 0) + 1` })
      .where(eq(actionBatches.id, batch.id));
  }

  const action = await storage.createAction({
    ...params,
    status: "pending_approval",
    batchId,
    aiGenerated: true,
    source: "automated",
  });

  return { id: action.id };
}
