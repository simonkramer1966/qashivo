import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import { actions, actionBatches, rejectionPatterns, tenants, messageDrafts, contacts, invoices, disputes, complianceChecks, emailMessages, promisesToPay, paymentPlans, customerLearningProfiles, inboundMessages, paymentPromises, aiFacts, customerPreferences, timelineEvents } from "@shared/schema";
import { eq, and, inArray, desc, asc, sql, or, gte, lte, count, sum, not, isNull, isNotNull, between } from "drizzle-orm";
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

      // Join contacts for company name; filter out aged debt (>365 days overdue)
      const rows = await db
        .select({
          action: actions,
          contactName: contacts.name,
          companyName: contacts.companyName,
        })
        .from(actions)
        .leftJoin(contacts, eq(actions.contactId, contacts.id))
        .leftJoin(invoices, eq(actions.invoiceId, invoices.id))
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["pending_approval", "pending"]),
            or(
              isNull(actions.invoiceId),
              isNull(invoices.dueDate),
              sql`${invoices.dueDate} > now() - interval '365 days'`,
            ),
          )
        )
        .orderBy(desc(actions.priority), actions.createdAt)
        .limit(limit)
        .offset(offset);

      // Enrich each action with debtor context for the queue display
      const contactIds = Array.from(new Set(rows.filter(r => r.action.contactId).map(r => r.action.contactId!)));

      // Batch-fetch learning profiles for PRS scores
      const profiles = contactIds.length > 0
        ? await db.select({
            contactId: customerLearningProfiles.contactId,
            prs: customerLearningProfiles.promiseReliabilityScore,
            prsRaw: customerLearningProfiles.prsRaw,
          }).from(customerLearningProfiles).where(
            and(
              eq(customerLearningProfiles.tenantId, user.tenantId),
              inArray(customerLearningProfiles.contactId, contactIds),
            )
          )
        : [];
      const profileMap = new Map(profiles.map(p => [p.contactId, p]));

      // Batch-fetch prior contact counts (completed actions per contact)
      const priorCounts = contactIds.length > 0
        ? await db.select({
            contactId: actions.contactId,
            count: sql<number>`count(*)::int`,
          }).from(actions).where(
            and(
              eq(actions.tenantId, user.tenantId),
              inArray(actions.contactId, contactIds),
              inArray(actions.status, ["sent", "completed"]),
            )
          ).groupBy(actions.contactId)
        : [];
      const priorCountMap = new Map(priorCounts.map(p => [p.contactId, p.count]));

      // Batch-fetch overdue invoice totals per contact
      const now = new Date();
      const contactInvoiceStats = contactIds.length > 0
        ? await db.select({
            contactId: invoices.contactId,
            totalAmount: sql<string>`coalesce(sum(cast(${invoices.amount} as numeric) - cast(coalesce(${invoices.amountPaid}, '0') as numeric)), 0)::text`,
            invoiceCount: sql<number>`count(*)::int`,
            oldestDueDate: sql<string>`min(${invoices.dueDate})::text`,
          }).from(invoices).where(
            and(
              eq(invoices.tenantId, user.tenantId),
              inArray(invoices.contactId, contactIds),
              not(inArray(invoices.status, ["paid", "void", "voided", "deleted", "draft"])),
            )
          ).groupBy(invoices.contactId)
        : [];
      const invoiceStatsMap = new Map(contactInvoiceStats.map(s => [s.contactId, s]));

      // Flatten: spread action fields + add enriched context
      const flatRows = rows.map(r => {
        const cid = r.action.contactId;
        const profile = cid ? profileMap.get(cid) : null;
        const priorCount = cid ? (priorCountMap.get(cid) ?? 0) : 0;
        const invStats = cid ? invoiceStatsMap.get(cid) : null;
        const oldestDue = invStats?.oldestDueDate ? new Date(invStats.oldestDueDate) : null;
        const daysOverdue = oldestDue ? Math.max(0, Math.floor((now.getTime() - oldestDue.getTime()) / (1000 * 60 * 60 * 24))) : 0;

        return {
          ...r.action,
          contactName: r.contactName || null,
          companyName: r.companyName || null,
          // Enriched fields for queue display
          daysOverdue,
          priorContactCount: priorCount,
          prsScore: profile?.prs ? Number(profile.prs) : null,
          totalAmount: invStats ? parseFloat(invStats.totalAmount) : 0,
          invoiceCount: invStats?.invoiceCount ?? 0,
        };
      });

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(actions)
        .leftJoin(invoices, eq(actions.invoiceId, invoices.id))
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["pending_approval", "pending"]),
            or(
              isNull(actions.invoiceId),
              isNull(invoices.dueDate),
              sql`${invoices.dueDate} > now() - interval '365 days'`,
            ),
          )
        );

      // Include current batch info for countdown
      const batch = await batchProcessor.getCurrentBatch(user.tenantId);

      res.json({
        actions: flatRows,
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

  // ── GET /api/action-centre/scheduled ─────────────────────────
  // Approved-but-not-yet-sent actions for the Scheduled tab
  app.get("/api/action-centre/scheduled", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const rows = await db
        .select({
          action: actions,
          contactName: contacts.name,
          companyName: contacts.companyName,
        })
        .from(actions)
        .leftJoin(contacts, eq(actions.contactId, contacts.id))
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            eq(actions.status, "scheduled"),
            or(
              isNull(actions.deliveryStatus),
              eq(actions.deliveryStatus, "pending"),
            ),
          )
        )
        .orderBy(asc(actions.scheduledFor))
        .limit(100);

      const items = rows.map(r => ({
        ...r.action,
        contactName: r.contactName,
        companyName: r.companyName,
      }));

      res.json({
        actions: items,
        total: items.length,
      });
    } catch (error: any) {
      console.error("Error fetching scheduled actions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/actions/:actionId/cancel ──────────────────────
  // Cancel a scheduled action before it's sent
  app.post("/api/actions/:actionId/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { actionId } = req.params;
      const { reason } = req.body;

      const [action] = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, actionId), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!action) {
        return res.status(404).json({ message: "Action not found" });
      }
      if (action.status !== "scheduled") {
        return res.status(400).json({ message: `Cannot cancel action with status '${action.status}'` });
      }

      await db
        .update(actions)
        .set({
          status: "cancelled",
          cancellationReason: reason || "Cancelled by user from Scheduled tab",
          updatedAt: new Date(),
        })
        .where(eq(actions.id, actionId));

      res.json({ message: "Action cancelled", actionId });
    } catch (error: any) {
      console.error("Error cancelling action:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/actions/:actionId/send-now ────────────────────
  // Move a scheduled action's send time to now
  app.post("/api/actions/:actionId/send-now", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { actionId } = req.params;

      const [action] = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, actionId), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!action) {
        return res.status(404).json({ message: "Action not found" });
      }
      if (action.status !== "scheduled") {
        return res.status(400).json({ message: `Cannot send-now action with status '${action.status}'` });
      }

      await db
        .update(actions)
        .set({
          scheduledFor: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, actionId));

      res.json({ message: "Action moved to immediate send", actionId });
    } catch (error: any) {
      console.error("Error sending action now:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── GET /api/action-centre/activity-feed ─────────────────────
  // Unified, debtor-threaded activity feed for the Activity Feed tab
  app.get("/api/action-centre/activity-feed", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const direction = req.query.direction as string | undefined; // inbound | outbound
      const channel = req.query.channel as string | undefined; // email | sms | voice | system
      const timeRange = (req.query.time as string) || "today"; // today | yesterday | week | month

      // Build time filter
      const now = new Date();
      let timeStart: Date;
      switch (timeRange) {
        case "yesterday": {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          y.setHours(0, 0, 0, 0);
          timeStart = y;
          break;
        }
        case "week": {
          const w = new Date(now);
          w.setDate(w.getDate() - 7);
          w.setHours(0, 0, 0, 0);
          timeStart = w;
          break;
        }
        case "month": {
          const m = new Date(now);
          m.setMonth(m.getMonth() - 1);
          m.setHours(0, 0, 0, 0);
          timeStart = m;
          break;
        }
        default: { // today
          const t = new Date(now);
          t.setHours(0, 0, 0, 0);
          timeStart = t;
        }
      }

      // Build WHERE conditions for timelineEvents
      const conditions: any[] = [
        eq(timelineEvents.tenantId, user.tenantId),
        gte(timelineEvents.occurredAt, timeStart),
      ];
      if (direction) {
        conditions.push(eq(timelineEvents.direction, direction));
      }
      if (channel) {
        if (channel === "system") {
          conditions.push(inArray(timelineEvents.channel, ["system", "note"]));
        } else {
          conditions.push(eq(timelineEvents.channel, channel));
        }
      }

      // Fetch events with contact info
      const events = await db
        .select({
          id: timelineEvents.id,
          customerId: timelineEvents.customerId,
          contactName: contacts.name,
          companyName: contacts.companyName,
          direction: timelineEvents.direction,
          channel: timelineEvents.channel,
          summary: timelineEvents.summary,
          preview: timelineEvents.preview,
          subject: timelineEvents.subject,
          body: timelineEvents.body,
          status: timelineEvents.status,
          occurredAt: timelineEvents.occurredAt,
          outcomeType: timelineEvents.outcomeType,
          createdByType: timelineEvents.createdByType,
          createdByName: timelineEvents.createdByName,
          actionId: timelineEvents.actionId,
        })
        .from(timelineEvents)
        .leftJoin(contacts, eq(timelineEvents.customerId, contacts.id))
        .where(and(...conditions))
        .orderBy(desc(timelineEvents.occurredAt))
        .limit(500);

      // Group by debtor
      const debtorMap = new Map<string, {
        contactId: string;
        contactName: string;
        companyName: string | null;
        events: typeof events;
        hasInbound: boolean;
        latestAt: Date;
        statusColor: string;
      }>();

      for (const evt of events) {
        const cid = evt.customerId || "unknown";
        let group = debtorMap.get(cid);
        if (!group) {
          group = {
            contactId: cid,
            contactName: evt.contactName || "Unknown",
            companyName: evt.companyName || null,
            events: [],
            hasInbound: false,
            latestAt: evt.occurredAt!,
            statusColor: "blue",
          };
          debtorMap.set(cid, group);
        }
        group.events.push(evt);
        if (evt.direction === "inbound") group.hasInbound = true;
        if (evt.occurredAt && evt.occurredAt > group.latestAt) {
          group.latestAt = evt.occurredAt;
        }

        // Determine status color based on events
        if (evt.outcomeType === "dispute" || evt.channel === "system" && evt.summary?.toLowerCase().includes("dispute")) {
          group.statusColor = "red";
        } else if (evt.outcomeType === "paid_confirmed" || evt.outcomeType === "promise_to_pay" || evt.outcomeType === "payment_plan") {
          if (group.statusColor !== "red") group.statusColor = "green";
        } else if (evt.direction === "inbound" && !evt.outcomeType) {
          if (group.statusColor !== "red" && group.statusColor !== "green") group.statusColor = "amber";
        }
      }

      // Sort groups: inbound first, then by latest activity
      const groups = Array.from(debtorMap.values())
        .sort((a, b) => {
          if (a.hasInbound && !b.hasInbound) return -1;
          if (!a.hasInbound && b.hasInbound) return 1;
          return b.latestAt.getTime() - a.latestAt.getTime();
        })
        .map(g => ({
          ...g,
          events: g.events.reverse(), // chronological within group (oldest first)
        }));

      // Summary counts
      const summary = {
        emailsSent: 0,
        repliesReceived: 0,
        arrangementsConfirmed: 0,
        disputesRaised: 0,
      };
      for (const evt of events) {
        if (evt.direction === "outbound" && (evt.channel === "email" || evt.channel === "sms")) {
          summary.emailsSent++;
        }
        if (evt.direction === "inbound") {
          summary.repliesReceived++;
        }
        if (evt.outcomeType === "promise_to_pay" || evt.outcomeType === "payment_plan") {
          summary.arrangementsConfirmed++;
        }
        if (evt.outcomeType === "dispute") {
          summary.disputesRaised++;
        }
      }

      // Inbound count for badge
      const inboundCount = events.filter(e => e.direction === "inbound").length;

      res.json({
        groups,
        summary,
        inboundCount,
        total: events.length,
        timeRange,
      });
    } catch (error: any) {
      console.error("Error fetching activity feed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── GET /api/action-centre/exceptions ─────────────────────────
  // Exception actions + open rejection patterns
  app.get("/api/action-centre/exceptions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const [exceptionRows, patterns] = await Promise.all([
        db
          .select({
            id: actions.id,
            type: actions.type,
            status: actions.status,
            subject: actions.subject,
            content: actions.content,
            exceptionReason: actions.exceptionReason,
            exceptionType: actions.exceptionType,
            agentReasoning: actions.agentReasoning,
            actionSummary: actions.actionSummary,
            createdAt: actions.createdAt,
            contactId: actions.contactId,
            contactName: contacts.name,
            companyName: contacts.companyName,
          })
          .from(actions)
          .leftJoin(contacts, eq(actions.contactId, contacts.id))
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
        exceptionActions: exceptionRows,
        rejectionPatterns: patterns,
        totalExceptions: exceptionRows.length,
        totalPatterns: patterns.length,
      });
    } catch (error: any) {
      console.error("Error fetching exceptions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/actions/:actionId/resolve ──────────────────────
  // Resolve an exception — marks it as completed
  app.post("/api/actions/:actionId/resolve", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { actionId } = req.params;
      const [action] = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, actionId), eq(actions.tenantId, user.tenantId), eq(actions.status, "exception")))
        .limit(1);

      if (!action) return res.status(404).json({ message: "Exception not found" });

      await db.update(actions).set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(actions.id, actionId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error resolving exception:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/actions/:actionId/dismiss ─────────────────────
  // Dismiss an exception — marks it as cancelled
  app.post("/api/actions/:actionId/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { actionId } = req.params;
      const [action] = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, actionId), eq(actions.tenantId, user.tenantId), eq(actions.status, "exception")))
        .limit(1);

      if (!action) return res.status(404).json({ message: "Exception not found" });

      await db.update(actions).set({
        status: "cancelled",
        cancellationReason: "dismissed_by_user",
        updatedAt: new Date(),
      }).where(eq(actions.id, actionId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error dismissing exception:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/actions/:actionId/defer ─────────────────────────
  // Defer an action — optionally with reason, duration, and note
  app.post("/api/actions/:actionId/defer", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { actionId } = req.params;
      const { reason, deferredUntil, note } = req.body || {};
      const now = new Date();

      // Get the action first
      const [action] = await db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.id, actionId),
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["pending_approval", "pending"]),
          )
        )
        .limit(1);

      if (!action) {
        return res.status(404).json({ message: "Action not found or not pending approval" });
      }

      // Get or create next batch for deferral
      const nextBatch = await batchProcessor.getOrCreateCurrentBatch(user.tenantId);
      const deferredToBatchId = action.batchId !== nextBatch.id ? nextBatch.id : nextBatch.id;

      await db
        .update(actions)
        .set({
          status: "deferred",
          deferredBy: user.id,
          deferredAt: now,
          deferredToBatchId,
          deferReason: reason || null,
          deferredUntil: deferredUntil ? new Date(deferredUntil) : null,
          deferNote: note || null,
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

  // ── GET /api/action-centre/yesterday-summary ────────────────────
  // Quick summary strip: what happened in the last 24 hours
  app.get("/api/action-centre/yesterday-summary", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Sent actions yesterday
      const [sentResult] = await db
        .select({ count: count() })
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["sent", "completed"]),
            gte(actions.updatedAt, yesterday),
            lte(actions.updatedAt, today),
          )
        );

      // Inbound responses yesterday
      const [responsesResult] = await db
        .select({ count: count() })
        .from(inboundMessages)
        .where(
          and(
            eq(inboundMessages.tenantId, user.tenantId),
            gte(inboundMessages.createdAt, yesterday),
            lte(inboundMessages.createdAt, today),
          )
        );

      // Payment promises created yesterday
      const [promisesResult] = await db
        .select({ count: count() })
        .from(paymentPromises)
        .where(
          and(
            eq(paymentPromises.tenantId, user.tenantId),
            gte(paymentPromises.createdAt, yesterday),
            lte(paymentPromises.createdAt, today),
          )
        );

      // Invoices paid yesterday (amount sum)
      const [paidResult] = await db
        .select({
          count: count(),
          total: sum(invoices.amount),
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, user.tenantId),
            eq(invoices.status, "paid"),
            gte(invoices.updatedAt, yesterday),
            lte(invoices.updatedAt, today),
          )
        );

      res.json({
        sent: sentResult?.count ?? 0,
        responses: responsesResult?.count ?? 0,
        promises: promisesResult?.count ?? 0,
        paid: {
          count: paidResult?.count ?? 0,
          total: parseFloat(String(paidResult?.total ?? "0")),
        },
      });
    } catch (error: any) {
      console.error("Error fetching yesterday summary:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/actions/:actionId/tone-override ───────────────────
  // Override the agent tone and regenerate email content
  app.post("/api/actions/:actionId/tone-override", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { actionId } = req.params;
      const { tone } = req.body;
      const validTones = ["friendly", "professional", "firm", "formal", "legal"];
      if (!tone || !validTones.includes(tone)) {
        return res.status(400).json({ message: `Invalid tone. Must be one of: ${validTones.join(", ")}` });
      }

      const [action] = await db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.id, actionId),
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["pending_approval", "pending"]),
          )
        )
        .limit(1);

      if (!action) {
        return res.status(404).json({ message: "Action not found or not pending approval" });
      }

      // If tone is already the same, no regeneration needed
      if (action.agentToneLevel === tone) {
        return res.json({ message: "Tone unchanged", actionId, tone });
      }

      // Regenerate email at new tone using collections agent
      try {
        const { regenerateAtTone } = await import("../services/collectionsPipeline");
        const result = await regenerateAtTone(actionId, tone, user.id);
        res.json({ message: "Tone overridden and email regenerated", actionId, tone, ...result });
      } catch (regenErr: any) {
        // If regeneration fails, still update the tone level as a fallback
        console.warn("[tone-override] regeneration failed, updating tone only:", regenErr.message);
        await db
          .update(actions)
          .set({
            agentToneLevel: tone,
            editedByUser: true,
            editedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(actions.id, actionId));
        res.json({ message: "Tone updated (regeneration unavailable)", actionId, tone, regenerated: false });
      }
    } catch (error: any) {
      console.error("Error overriding tone:", error);
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

      // Generate actions via the full daily plan pipeline (scores, LLM content, compliance)
      const { generateDailyPlan } = await import("../services/dailyPlanGenerator");
      const plan = await generateDailyPlan(user.tenantId, req.user.id, true);

      // Trigger message pre-generation in background
      if (plan.actions.length > 0) {
        const { messagePreGenerator } = await import("../services/messagePreGenerator");
        const actionIds = plan.actions.map((a: any) => a.id);
        messagePreGenerator.preGenerateForActions(actionIds)
          .then(result => {
            console.log(`[ACTION-CENTRE] Pre-generated messages: ${result.generated} generated, ${result.failed} failed, ${result.skipped} skipped`);
          })
          .catch(err => console.error("[ACTION-CENTRE] Message pre-generation failed:", err));
      }

      console.log(`[ACTION-CENTRE] Agent run-now — ${plan.actions.length} actions generated for tenant ${user.tenantId} (mode: ${mode})`);

      res.json({
        success: true,
        generated: plan.actions.length,
        communicationMode: mode,
        message: `${plan.actions.length} new emails generated and queued for approval`,
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

  // ── GET /api/action-centre/summary ──────────────────────────
  // Control panel summary stats: queued, actioned, exceptions
  app.get("/api/action-centre/summary", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const tenantId = user.tenantId;
      const now = new Date();
      const period = (req.query.period as string) || "week";

      // Compute date range
      let periodFrom: Date;
      let periodTo: Date = now;

      if (period === "today") {
        periodFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      } else if (period === "month") {
        periodFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      } else if (period === "custom") {
        periodFrom = new Date(req.query.dateFrom as string);
        periodTo = new Date(req.query.dateTo as string);
        if (isNaN(periodFrom.getTime()) || isNaN(periodTo.getTime())) {
          return res.status(400).json({ message: "Invalid dateFrom or dateTo for custom period" });
        }
      } else {
        // week (default): Monday of this week
        const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon...
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        periodFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset));
      }

      // Previous period (same length, immediately before)
      const periodLengthMs = periodTo.getTime() - periodFrom.getTime();
      const prevFrom = new Date(periodFrom.getTime() - periodLengthMs);
      const prevTo = new Date(periodFrom.getTime());

      const pendingStatuses = ["pending", "pending_approval", "queued"];
      const completedStatuses = ["completed", "sent", "delivered"];

      // ── QUEUED stats ──
      let queued = { total: 0, emails: 0, sms: 0, calls: 0, waitingOver24h: 0, debtorsOver60DaysOverdue: 0, totalValueQueued: 0 };
      try {
        const queuedBase = and(eq(actions.tenantId, tenantId), inArray(actions.status, pendingStatuses));

        const [totalResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(queuedBase);
        queued.total = totalResult?.count ?? 0;

        const [emailResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(and(queuedBase, eq(actions.type, "email")));
        queued.emails = emailResult?.count ?? 0;

        const [smsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(and(queuedBase, eq(actions.type, "sms")));
        queued.sms = smsResult?.count ?? 0;

        const [callsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(and(queuedBase, inArray(actions.type, ["call", "voice"])));
        queued.calls = callsResult?.count ?? 0;

        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const [waitingResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(and(queuedBase, lte(actions.createdAt, twentyFourHoursAgo)));
        queued.waitingOver24h = waitingResult?.count ?? 0;

        // Debtors over 60 days overdue: join actions to invoices
        try {
          const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
          const [over60Result] = await db
            .select({ count: sql<number>`count(distinct ${actions.contactId})::int` })
            .from(actions)
            .innerJoin(invoices, eq(actions.invoiceId, invoices.id))
            .where(and(queuedBase, lte(invoices.dueDate, sixtyDaysAgo)));
          queued.debtorsOver60DaysOverdue = over60Result?.count ?? 0;
        } catch { queued.debtorsOver60DaysOverdue = 0; }

        // Total value queued: join to invoices and sum amount
        try {
          const [valueResult] = await db
            .select({ total: sql<number>`coalesce(sum(${invoices.amount}::numeric), 0)::float` })
            .from(actions)
            .innerJoin(invoices, eq(actions.invoiceId, invoices.id))
            .where(queuedBase);
          queued.totalValueQueued = valueResult?.total ?? 0;
        } catch { queued.totalValueQueued = 0; }
      } catch (err) {
        console.error("[summary] queued query error:", err);
      }

      // ── ACTIONED stats ──
      let actioned = { total: 0, emailsSent: 0, emailsSentVsPrevious: 0, smsSent: 0, callsMade: 0, promisesToPay: 0, paymentPlansAgreed: 0, responseRate: 0 };
      try {
        const actionedBase = and(
          eq(actions.tenantId, tenantId),
          inArray(actions.status, completedStatuses),
          gte(actions.createdAt, periodFrom),
          lte(actions.createdAt, periodTo),
        );

        const [totalResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(actionedBase);
        actioned.total = totalResult?.count ?? 0;

        const [emailResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(and(actionedBase, eq(actions.type, "email")));
        actioned.emailsSent = emailResult?.count ?? 0;

        const [smsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(and(actionedBase, eq(actions.type, "sms")));
        actioned.smsSent = smsResult?.count ?? 0;

        const [callsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(and(actionedBase, inArray(actions.type, ["call", "voice"])));
        actioned.callsMade = callsResult?.count ?? 0;

        // Emails sent vs previous period
        try {
          const prevActionedBase = and(
            eq(actions.tenantId, tenantId),
            inArray(actions.status, completedStatuses),
            eq(actions.type, "email"),
            gte(actions.createdAt, prevFrom),
            lte(actions.createdAt, prevTo),
          );
          const [prevEmailResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(prevActionedBase);
          const prevEmails = prevEmailResult?.count ?? 0;
          actioned.emailsSentVsPrevious = prevEmails > 0
            ? Math.round(((actioned.emailsSent - prevEmails) / prevEmails) * 100)
            : actioned.emailsSent > 0 ? 100 : 0;
        } catch { actioned.emailsSentVsPrevious = 0; }

        // Promises to pay
        try {
          const [ptpResult] = await db.select({ count: sql<number>`count(*)::int` }).from(promisesToPay).where(and(
            eq(promisesToPay.tenantId, tenantId),
            gte(promisesToPay.createdAt, periodFrom),
            lte(promisesToPay.createdAt, periodTo),
          ));
          actioned.promisesToPay = ptpResult?.count ?? 0;
        } catch { actioned.promisesToPay = 0; }

        // Payment plans agreed
        try {
          const [ppResult] = await db.select({ count: sql<number>`count(*)::int` }).from(paymentPlans).where(and(
            eq(paymentPlans.tenantId, tenantId),
            gte(paymentPlans.createdAt, periodFrom),
            lte(paymentPlans.createdAt, periodTo),
          ));
          actioned.paymentPlansAgreed = ppResult?.count ?? 0;
        } catch { actioned.paymentPlansAgreed = 0; }

        // Response rate: inbound emails / outbound emails * 100
        try {
          const emailPeriodBase = and(
            eq(emailMessages.tenantId, tenantId),
            gte(emailMessages.createdAt, periodFrom),
            lte(emailMessages.createdAt, periodTo),
          );
          const [inboundResult] = await db.select({ count: sql<number>`count(*)::int` }).from(emailMessages).where(and(emailPeriodBase, eq(emailMessages.direction, "INBOUND")));
          const [outboundResult] = await db.select({ count: sql<number>`count(*)::int` }).from(emailMessages).where(and(emailPeriodBase, eq(emailMessages.direction, "OUTBOUND")));
          const inbound = inboundResult?.count ?? 0;
          const outbound = outboundResult?.count ?? 0;
          actioned.responseRate = outbound > 0 ? Math.round((inbound / outbound) * 100) : 0;
        } catch { actioned.responseRate = 0; }
      } catch (err) {
        console.error("[summary] actioned query error:", err);
      }

      // ── EXCEPTIONS stats ──
      let exceptions = {
        total: 0, disputedInvoices: 0, unresponsiveEndOfFlow: 0, wantsHumanContact: 0,
        complianceFailures: 0, distress: 0, serviceIssue: 0, missingPO: 0, insolvencyRisk: 0, other: 0,
      };
      try {
        // Disputed invoices (open)
        try {
          const [disputeResult] = await db.select({ count: sql<number>`count(*)::int` }).from(disputes).where(and(
            eq(disputes.tenantId, tenantId),
            eq(disputes.status, "open"),
          ));
          exceptions.disputedInvoices = disputeResult?.count ?? 0;
        } catch { exceptions.disputedInvoices = 0; }

        // Compliance failures in period
        try {
          const [compResult] = await db.select({ count: sql<number>`count(*)::int` }).from(complianceChecks).where(and(
            eq(complianceChecks.tenantId, tenantId),
            eq(complianceChecks.checkResult, "blocked"),
            gte(complianceChecks.createdAt, periodFrom),
            lte(complianceChecks.createdAt, periodTo),
          ));
          exceptions.complianceFailures = compResult?.count ?? 0;
        } catch { exceptions.complianceFailures = 0; }

        // Unresponsive end of flow (actions with exceptionType)
        try {
          const [unrespResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(and(
            eq(actions.tenantId, tenantId),
            eq(actions.exceptionType, "unresponsive"),
          ));
          exceptions.unresponsiveEndOfFlow = unrespResult?.count ?? 0;
        } catch { exceptions.unresponsiveEndOfFlow = 0; }

        // Contact-level exception types
        const exceptionTypes = [
          { key: "wantsHumanContact" as const, value: "wants_human" },
          { key: "distress" as const, value: "distress" },
          { key: "serviceIssue" as const, value: "service_issue" },
          { key: "missingPO" as const, value: "missing_po" },
          { key: "insolvencyRisk" as const, value: "insolvency_risk" },
          { key: "other" as const, value: "other" },
        ];
        for (const { key, value } of exceptionTypes) {
          try {
            const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(contacts).where(and(
              eq(contacts.tenantId, tenantId),
              eq(contacts.isException, true),
              eq(contacts.exceptionType, value),
            ));
            exceptions[key] = result?.count ?? 0;
          } catch { exceptions[key] = 0; }
        }

        exceptions.total = exceptions.disputedInvoices + exceptions.unresponsiveEndOfFlow +
          exceptions.wantsHumanContact + exceptions.complianceFailures + exceptions.distress +
          exceptions.serviceIssue + exceptions.missingPO + exceptions.insolvencyRisk + exceptions.other;
      } catch (err) {
        console.error("[summary] exceptions query error:", err);
      }

      res.json({
        generatedAt: now.toISOString(),
        period: { from: periodFrom.toISOString(), to: periodTo.toISOString() },
        queued,
        actioned,
        exceptions,
      });
    } catch (error: any) {
      console.error("Error fetching action centre summary:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── GET /api/action-centre/drilldown ────────────────────────
  // Paginated drilldown for a specific metric
  app.get("/api/action-centre/drilldown", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const tenantId = user.tenantId;
      const metric = req.query.metric as string;
      if (!metric) return res.status(400).json({ message: "metric query param is required" });

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const now = new Date();
      const period = (req.query.period as string) || "week";

      // Compute period date range (same logic as summary)
      let periodFrom: Date;
      let periodTo: Date = now;
      if (period === "today") {
        periodFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      } else if (period === "month") {
        periodFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      } else if (period === "custom") {
        periodFrom = new Date(req.query.dateFrom as string);
        periodTo = new Date(req.query.dateTo as string);
        if (isNaN(periodFrom.getTime()) || isNaN(periodTo.getTime())) {
          return res.status(400).json({ message: "Invalid dateFrom or dateTo for custom period" });
        }
      } else {
        const dayOfWeek = now.getUTCDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        periodFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset));
      }

      const pendingStatuses = ["pending", "pending_approval", "queued"];
      const completedStatuses = ["completed", "sent", "delivered"];

      // Helper: query actions with contact name join
      const queryActions = async (whereClause: any) => {
        const rows = await db
          .select({
            id: actions.id,
            type: actions.type,
            status: actions.status,
            subject: actions.subject,
            contactId: actions.contactId,
            contactName: contacts.name,
            invoiceId: actions.invoiceId,
            createdAt: actions.createdAt,
            actionSummary: actions.actionSummary,
            priority: actions.priority,
          })
          .from(actions)
          .leftJoin(contacts, eq(actions.contactId, contacts.id))
          .where(whereClause)
          .orderBy(desc(actions.createdAt))
          .limit(limit)
          .offset(offset);

        const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(actions).where(whereClause);
        return { items: rows, total: countResult?.count ?? 0 };
      };

      // Helper: query contacts with exception info
      const queryContacts = async (whereClause: any) => {
        const rows = await db
          .select({
            id: contacts.id,
            name: contacts.name,
            companyName: contacts.companyName,
            exceptionType: contacts.exceptionType,
            exceptionNote: contacts.exceptionNote,
            exceptionFlaggedAt: contacts.exceptionFlaggedAt,
          })
          .from(contacts)
          .where(whereClause)
          .orderBy(desc(contacts.exceptionFlaggedAt))
          .limit(limit)
          .offset(offset);

        const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(contacts).where(whereClause);
        return { items: rows, total: countResult?.count ?? 0 };
      };

      let result: { items: any[]; total: number };

      switch (metric) {
        case "queued_emails":
          result = await queryActions(and(eq(actions.tenantId, tenantId), inArray(actions.status, pendingStatuses), eq(actions.type, "email")));
          break;
        case "queued_sms":
          result = await queryActions(and(eq(actions.tenantId, tenantId), inArray(actions.status, pendingStatuses), eq(actions.type, "sms")));
          break;
        case "queued_calls":
          result = await queryActions(and(eq(actions.tenantId, tenantId), inArray(actions.status, pendingStatuses), inArray(actions.type, ["call", "voice"])));
          break;
        case "queued_over24h": {
          const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          result = await queryActions(and(eq(actions.tenantId, tenantId), inArray(actions.status, pendingStatuses), lte(actions.createdAt, twentyFourHoursAgo)));
          break;
        }
        case "actioned_emails":
          result = await queryActions(and(eq(actions.tenantId, tenantId), inArray(actions.status, completedStatuses), eq(actions.type, "email"), gte(actions.createdAt, periodFrom), lte(actions.createdAt, periodTo)));
          break;
        case "actioned_sms":
          result = await queryActions(and(eq(actions.tenantId, tenantId), inArray(actions.status, completedStatuses), eq(actions.type, "sms"), gte(actions.createdAt, periodFrom), lte(actions.createdAt, periodTo)));
          break;
        case "actioned_calls":
          result = await queryActions(and(eq(actions.tenantId, tenantId), inArray(actions.status, completedStatuses), inArray(actions.type, ["call", "voice"]), gte(actions.createdAt, periodFrom), lte(actions.createdAt, periodTo)));
          break;
        case "exc_disputes": {
          const rows = await db
            .select({
              id: disputes.id,
              invoiceId: disputes.invoiceId,
              contactId: disputes.contactId,
              type: disputes.type,
              status: disputes.status,
              summary: disputes.summary,
              buyerContactName: disputes.buyerContactName,
              responseDueAt: disputes.responseDueAt,
              createdAt: disputes.createdAt,
            })
            .from(disputes)
            .where(and(eq(disputes.tenantId, tenantId), eq(disputes.status, "open")))
            .orderBy(desc(disputes.createdAt))
            .limit(limit)
            .offset(offset);

          const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(disputes).where(and(eq(disputes.tenantId, tenantId), eq(disputes.status, "open")));
          result = { items: rows, total: countResult?.count ?? 0 };
          break;
        }
        case "exc_unresponsive":
          result = await queryActions(and(eq(actions.tenantId, tenantId), eq(actions.exceptionType, "unresponsive")));
          break;
        case "exc_compliance": {
          const rows = await db
            .select({
              id: complianceChecks.id,
              actionId: complianceChecks.actionId,
              contactId: complianceChecks.contactId,
              checkResult: complianceChecks.checkResult,
              violations: complianceChecks.violations,
              createdAt: complianceChecks.createdAt,
            })
            .from(complianceChecks)
            .where(and(
              eq(complianceChecks.tenantId, tenantId),
              eq(complianceChecks.checkResult, "blocked"),
              gte(complianceChecks.createdAt, periodFrom),
              lte(complianceChecks.createdAt, periodTo),
            ))
            .orderBy(desc(complianceChecks.createdAt))
            .limit(limit)
            .offset(offset);

          const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(complianceChecks).where(and(
            eq(complianceChecks.tenantId, tenantId),
            eq(complianceChecks.checkResult, "blocked"),
            gte(complianceChecks.createdAt, periodFrom),
            lte(complianceChecks.createdAt, periodTo),
          ));
          result = { items: rows, total: countResult?.count ?? 0 };
          break;
        }
        case "exc_wants_human":
          result = await queryContacts(and(eq(contacts.tenantId, tenantId), eq(contacts.isException, true), eq(contacts.exceptionType, "wants_human")));
          break;
        case "exc_distress":
          result = await queryContacts(and(eq(contacts.tenantId, tenantId), eq(contacts.isException, true), eq(contacts.exceptionType, "distress")));
          break;
        case "exc_service_issue":
          result = await queryContacts(and(eq(contacts.tenantId, tenantId), eq(contacts.isException, true), eq(contacts.exceptionType, "service_issue")));
          break;
        case "exc_missing_po":
          result = await queryContacts(and(eq(contacts.tenantId, tenantId), eq(contacts.isException, true), eq(contacts.exceptionType, "missing_po")));
          break;
        case "exc_insolvency_risk":
          result = await queryContacts(and(eq(contacts.tenantId, tenantId), eq(contacts.isException, true), eq(contacts.exceptionType, "insolvency_risk")));
          break;
        case "exc_other":
          result = await queryContacts(and(eq(contacts.tenantId, tenantId), eq(contacts.isException, true), eq(contacts.exceptionType, "other")));
          break;
        default:
          return res.status(400).json({ message: `Unknown metric: ${metric}` });
      }

      res.json({
        metric,
        items: result.items,
        total: result.total,
        page,
        limit,
      });
    } catch (error: any) {
      console.error("Error fetching action centre drilldown:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── POST /api/approval-queue/approve-all ────────────────────
  // Approve all pending actions and send immediately via pipeline
  app.post("/api/approval-queue/approve-all", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      // Find all pending actions for this tenant
      const pendingActions = await db
        .select({ id: actions.id })
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ["pending", "pending_approval"]),
          )
        );

      if (pendingActions.length === 0) {
        return res.json({ approved: 0 });
      }

      // Send each action immediately via approveAndSend()
      const { approveAndSend } = await import("../services/collectionsPipeline");
      let successCount = 0;
      let errorCount = 0;

      for (const { id } of pendingActions) {
        try {
          const result = await approveAndSend(id, user.id);
          if (result.status === "sent" || result.status === "completed") {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err: any) {
          console.error(`[ACTION-CENTRE] Approve-all failed for action ${id}:`, err.message);
          errorCount++;
        }
      }

      console.log(`[ACTION-CENTRE] Approve all — ${successCount} sent, ${errorCount} failed for tenant ${user.tenantId}`);

      res.json({ approved: successCount, failed: errorCount });
    } catch (error: any) {
      console.error("Error approving all actions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── PATCH /api/contacts/:id/exception ───────────────────────
  // Flag or unflag a contact as an exception
  app.patch("/api/contacts/:id/exception", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { id } = req.params;
      const { isException: flagException, exceptionType, exceptionNote } = req.body;

      if (typeof flagException !== "boolean") {
        return res.status(400).json({ message: "isException (boolean) is required" });
      }

      // Verify contact belongs to tenant
      const [existing] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.tenantId, user.tenantId)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const now = new Date();
      let updates: Record<string, any>;

      if (flagException) {
        updates = {
          isException: true,
          exceptionType: exceptionType || null,
          exceptionNote: exceptionNote || null,
          exceptionFlaggedAt: now,
          updatedAt: now,
        };
      } else {
        updates = {
          isException: false,
          exceptionResolvedAt: now,
          updatedAt: now,
        };
      }

      const [updated] = await db
        .update(contacts)
        .set(updates)
        .where(eq(contacts.id, id))
        .returning();

      res.json({ contact: updated });
    } catch (error: any) {
      console.error("Error updating contact exception:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── GET /api/communications/mode ─────────────────────────────
  // Read current communication mode + test addresses for the tenant
  app.get("/api/communications/mode", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const [tenant] = await db
        .select({
          communicationMode: tenants.communicationMode,
          testEmails: tenants.testEmails,
          testPhones: tenants.testPhones,
          testContactName: tenants.testContactName,
        })
        .from(tenants)
        .where(eq(tenants.id, user.tenantId));

      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      res.json({
        communicationMode: tenant.communicationMode || 'testing',
        testEmails: tenant.testEmails || [],
        testPhones: tenant.testPhones || [],
        testContactName: tenant.testContactName || '',
      });
    } catch (error: any) {
      console.error("Error fetching communication mode:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── PUT /api/communications/mode ─────────────────────────────
  // Update communication mode + test addresses for the tenant
  app.put("/api/communications/mode", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const schema = z.object({
        communicationMode: z.enum(['off', 'testing', 'soft_live', 'live']),
        testEmails: z.array(z.string().email()).optional(),
        testPhones: z.array(z.string().min(1)).optional(),
        testContactName: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }

      const { communicationMode, testEmails, testPhones, testContactName } = parsed.data;

      // When setting testing or soft_live, require at least one test email AND one test phone
      if (communicationMode === 'testing' || communicationMode === 'soft_live') {
        if (!testEmails?.length && !testPhones?.length) {
          // Check existing values on the tenant
          const [existing] = await db
            .select({ testEmails: tenants.testEmails, testPhones: tenants.testPhones })
            .from(tenants)
            .where(eq(tenants.id, user.tenantId));

          const existingEmails = (existing?.testEmails as string[] | null) || [];
          const existingPhones = (existing?.testPhones as string[] | null) || [];
          const finalEmails = testEmails?.length ? testEmails : existingEmails;
          const finalPhones = testPhones?.length ? testPhones : existingPhones;

          if (!finalEmails.length || !finalPhones.length) {
            return res.status(400).json({
              message: `${communicationMode} mode requires at least one test email and one test phone number configured`,
            });
          }
        }
      }

      const updates: Record<string, any> = { communicationMode };
      if (testEmails !== undefined) updates.testEmails = testEmails;
      if (testPhones !== undefined) updates.testPhones = testPhones;
      if (testContactName !== undefined) updates.testContactName = testContactName;

      await db
        .update(tenants)
        .set(updates)
        .where(eq(tenants.id, user.tenantId));

      console.log(`🔧 [CommMode] Tenant ${user.tenantId} updated: mode=${communicationMode} testEmails=${(testEmails || []).length} testPhones=${(testPhones || []).length}`);

      res.json({
        communicationMode,
        testEmails: updates.testEmails,
        testPhones: updates.testPhones,
        testContactName: updates.testContactName,
      });
    } catch (error: any) {
      console.error("Error updating communication mode:", error);
      res.status(500).json({ message: error.message });
    }
  });
}
