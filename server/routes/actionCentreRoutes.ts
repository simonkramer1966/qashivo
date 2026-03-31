import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import { actions, actionBatches, rejectionPatterns, tenants, messageDrafts } from "@shared/schema";
import { eq, and, inArray, desc, sql, or } from "drizzle-orm";
import { batchProcessor } from "../services/batchProcessor";
import { z } from "zod";

export function registerActionCentreRoutes(app: Express): void {

  // ── GET /api/action-centre/approvals ──────────────────────────
  // Pending actions for the Approvals Queue tab
  app.get("/api/action-centre/approvals", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const rows = await db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["pending_approval", "pending"]),
          )
        )
        .orderBy(desc(actions.priority), actions.createdAt)
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["pending_approval", "pending"]),
          )
        );

      // Include current batch info for countdown
      const batch = await batchProcessor.getCurrentBatch(user.tenantId);

      res.json({
        actions: rows,
        total: countResult?.count ?? 0,
        page,
        limit,
        batch,
      });
    } catch (error: any) {
      console.error("Error fetching approvals:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── GET /api/action-centre/actioned ───────────────────────────
  // Completed/sent/cancelled actions for the Actioned Items tab
  app.get("/api/action-centre/actioned", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const rows = await db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["completed", "sent", "cancelled"]),
          )
        )
        .orderBy(desc(actions.updatedAt))
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["completed", "sent", "cancelled"]),
          )
        );

      res.json({
        actions: rows,
        total: countResult?.count ?? 0,
        page,
        limit,
      });
    } catch (error: any) {
      console.error("Error fetching actioned items:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── GET /api/action-centre/exceptions ─────────────────────────
  // Exception actions + open rejection patterns
  app.get("/api/action-centre/exceptions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const [exceptionActions, patterns] = await Promise.all([
        db
          .select()
          .from(actions)
          .where(
            and(
              eq(actions.tenantId, user.tenantId),
              eq(actions.status, "exception"),
            )
          )
          .orderBy(desc(actions.createdAt))
          .limit(100),
        db
          .select()
          .from(rejectionPatterns)
          .where(
            and(
              eq(rejectionPatterns.tenantId, user.tenantId),
              eq(rejectionPatterns.status, "open"),
            )
          )
          .orderBy(desc(rejectionPatterns.lastOccurredAt)),
      ]);

      res.json({
        exceptionActions,
        rejectionPatterns: patterns,
        totalExceptions: exceptionActions.length,
        totalPatterns: patterns.length,
      });
    } catch (error: any) {
      console.error("Error fetching exceptions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/actions/:actionId/defer ─────────────────────────
  // Defer an action to the next batch
  app.post("/api/actions/:actionId/defer", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { actionId } = req.params;
      const now = new Date();

      // Get the action first
      const [action] = await db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.id, actionId),
            eq(actions.tenantId, user.tenantId),
            eq(actions.status, "pending_approval"),
          )
        )
        .limit(1);

      if (!action) {
        return res.status(404).json({ message: "Action not found or not pending approval" });
      }

      // Get or create next batch for deferral
      const nextBatch = await batchProcessor.getOrCreateCurrentBatch(user.tenantId);
      // If the action is in the same batch, we need a new one after this one
      const deferredToBatchId = action.batchId !== nextBatch.id ? nextBatch.id : nextBatch.id;

      await db
        .update(actions)
        .set({
          status: "deferred",
          deferredBy: user.id,
          deferredAt: now,
          deferredToBatchId,
          updatedAt: now,
        })
        .where(eq(actions.id, actionId));

      // Update current batch stats
      if (action.batchId) {
        await batchProcessor.updateBatchStats(action.batchId, "deferredCount").catch(
          (err) => console.error("[defer] batch stats update failed:", err)
        );
      }

      res.json({ message: "Action deferred", actionId, deferredToBatchId });
    } catch (error: any) {
      console.error("Error deferring action:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/action-centre/batch/process-now ─────────────────
  // Force-process the current pending batch immediately
  app.post("/api/action-centre/batch/process-now", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const result = await batchProcessor.processNow(user.tenantId);
      if (!result) {
        return res.status(404).json({ message: "No pending batch found" });
      }

      res.json({ message: "Batch processed", ...result });
    } catch (error: any) {
      console.error("Error processing batch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── GET /api/action-centre/batch/current ──────────────────────
  // Get current batch info + countdown for timer
  app.get("/api/action-centre/batch/current", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const batch = await batchProcessor.getCurrentBatch(user.tenantId);
      res.json({ batch });
    } catch (error: any) {
      console.error("Error fetching current batch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── PATCH /api/action-centre/settings ─────────────────────────
  // Update Action Centre settings on tenant
  const settingsSchema = z.object({
    approvalMode: z.enum(["manual", "auto_after_timeout", "full_auto"]).optional(),
    batchFrequencyMinutes: z.number().min(5).max(1440).optional(),
    countdownResetOnInteraction: z.boolean().optional(),
    approvalTimeoutHours: z.number().min(1).max(168).optional(),
  });

  app.patch("/api/action-centre/settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const parsed = settingsSchema.parse(req.body);
      const updates: Record<string, any> = {};
      if (parsed.approvalMode !== undefined) updates.approvalMode = parsed.approvalMode;
      if (parsed.batchFrequencyMinutes !== undefined) updates.batchFrequencyMinutes = parsed.batchFrequencyMinutes;
      if (parsed.countdownResetOnInteraction !== undefined) updates.countdownResetOnInteraction = parsed.countdownResetOnInteraction;
      if (parsed.approvalTimeoutHours !== undefined) updates.approvalTimeoutHours = parsed.approvalTimeoutHours;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      await db
        .update(tenants)
        .set(updates)
        .where(eq(tenants.id, user.tenantId));

      res.json({ message: "Settings updated", updates });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/actions/:actionId/reject-chat ────────────────────
  // Riley inline rejection chat
  app.post("/api/actions/:actionId/reject-chat", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { actionId } = req.params;
      const { message } = req.body;
      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "message is required" });
      }

      // Verify action belongs to tenant
      const [action] = await db
        .select({ id: actions.id, tenantId: actions.tenantId })
        .from(actions)
        .where(and(eq(actions.id, actionId), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!action) return res.status(404).json({ message: "Action not found" });

      const { processRejectionChat } = await import("../services/rileyRejectionChat");
      const result = await processRejectionChat(actionId, message);
      res.json(result);
    } catch (error: any) {
      console.error("Error in rejection chat:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/rejection-patterns/:id/acknowledge ──────────────
  // Acknowledge a rejection pattern
  app.post("/api/rejection-patterns/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { id } = req.params;
      const result = await db
        .update(rejectionPatterns)
        .set({
          status: "acknowledged",
          acknowledgedBy: user.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(rejectionPatterns.id, id),
            eq(rejectionPatterns.tenantId, user.tenantId),
          )
        )
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ message: "Pattern not found" });
      }

      res.json({ message: "Pattern acknowledged" });
    } catch (error: any) {
      console.error("Error acknowledging pattern:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── Message Draft Routes ──────────────────────────────────────────

  // GET /api/drafts — List message drafts for tenant
  app.get("/api/drafts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const status = req.query.status as string | undefined;
      const drafts = await storage.getMessageDrafts(user.tenantId, status);
      res.json({ drafts });
    } catch (error: any) {
      console.error("Error fetching message drafts:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/drafts/:id — Get single draft
  app.get("/api/drafts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const draft = await storage.getMessageDraft(req.params.id, user.tenantId);
      if (!draft) return res.status(404).json({ message: "Draft not found" });

      res.json({ draft });
    } catch (error: any) {
      console.error("Error fetching message draft:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/drafts/:id/approve — Approve a draft and mark for sending
  app.post("/api/drafts/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const draft = await storage.getMessageDraft(req.params.id, user.tenantId);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      if (draft.status !== "pending_approval") {
        return res.status(400).json({ message: `Draft is not pending approval (current status: ${draft.status})` });
      }

      const updated = await storage.updateMessageDraft(req.params.id, user.tenantId, {
        status: "approved",
        reviewedAt: new Date(),
        reviewedByUserId: user.id,
        reviewNote: req.body.reviewNote || null,
      });

      res.json({ message: "Draft approved", draft: updated });
    } catch (error: any) {
      console.error("Error approving draft:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/drafts/:id/reject — Reject a draft with a note
  app.post("/api/drafts/:id/reject", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { reviewNote } = req.body;
      if (!reviewNote || typeof reviewNote !== "string") {
        return res.status(400).json({ message: "reviewNote is required when rejecting a draft" });
      }

      const draft = await storage.getMessageDraft(req.params.id, user.tenantId);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      if (draft.status !== "pending_approval") {
        return res.status(400).json({ message: `Draft is not pending approval (current status: ${draft.status})` });
      }

      const updated = await storage.updateMessageDraft(req.params.id, user.tenantId, {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedByUserId: user.id,
        reviewNote,
      });

      res.json({ message: "Draft rejected", draft: updated });
    } catch (error: any) {
      console.error("Error rejecting draft:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/approval-queue/clear ─────────────────────────
  // Soft-cancel all pending items in the approval queue
  app.post("/api/approval-queue/clear", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const result = await db
        .update(actions)
        .set({
          status: "cancelled",
          metadata: sql`jsonb_set(COALESCE(metadata, '{}'), '{cancellationReason}', '"manually_cleared"')`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["pending", "pending_approval", "queued"]),
          )
        )
        .returning({ id: actions.id });

      console.log(`[ACTION-CENTRE] Queue cleared — ${result.length} items cancelled for tenant ${user.tenantId}`);

      res.json({ cancelled: result.length });
    } catch (error: any) {
      console.error("Error clearing approval queue:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/agent/run-now ────────────────────────────────
  // Trigger the collections agent on-demand for all eligible debtors
  app.post("/api/agent/run-now", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      // Check communication mode
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      const mode = (tenant as any).communicationMode ?? "off";
      if (mode === "off") {
        return res.status(400).json({
          message: "Communications are disabled. Enable a communication mode in Settings > Autonomy & Rules first.",
          code: "COMMS_OFF",
        });
      }

      // Return communication mode info so frontend can show appropriate toast
      const { checkCollectionActions } = await import("../services/collectionsAutomation");
      const generatedActions = await checkCollectionActions(user.tenantId);

      console.log(`[ACTION-CENTRE] Agent run-now — ${generatedActions.length} actions generated for tenant ${user.tenantId} (mode: ${mode})`);

      res.json({
        success: true,
        generated: generatedActions.length,
        communicationMode: mode,
        message: `${generatedActions.length} new emails generated and queued for approval`,
      });
    } catch (error: any) {
      console.error("Error running agent:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── GET /api/agent/communication-mode ──────────────────────
  // Return the current tenant communication mode (for frontend safety checks)
  app.get("/api/agent/communication-mode", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const tenant = await storage.getTenant(user.tenantId);
      res.json({ mode: (tenant as any)?.communicationMode ?? "off" });
    } catch (error: any) {
      console.error("Error fetching communication mode:", error);
      res.status(500).json({ message: error.message });
    }
  });
}
