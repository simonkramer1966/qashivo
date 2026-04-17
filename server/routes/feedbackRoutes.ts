import { Express } from "express";
import { db } from "../db";
import { feedbackSubmissions, users, tenants } from "@shared/schema";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { withRBACContext } from "../middleware/rbac";

const feedbackBodySchema = z.object({
  type: z.enum(["bug", "feature", "workflow"]),
  description: z.string().min(10, "Description must be at least 10 characters"),
  page: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]).nullable().optional(),
  screenshotData: z.string().nullable().optional(),
});

const updateFeedbackSchema = z.object({
  status: z.enum(["new", "in_progress", "resolved", "wont_fix", "duplicate"]).optional(),
  adminNotes: z.string().nullable().optional(),
});

const requireAdminAuth = (req: any, res: any, next: any) => {
  const user = req.user;
  if (!user?.platformAdmin) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  next();
};

export function registerFeedbackRoutes(app: Express): void {
  // POST /api/feedback — any authenticated user
  app.post("/api/feedback", isAuthenticated, withRBACContext, async (req: any, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: "RBAC context not initialized" });
      }

      const parsed = feedbackBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const { type, description, page, priority, screenshotData } = parsed.data;

      const [created] = await db
        .insert(feedbackSubmissions)
        .values({
          tenantId: req.rbac.tenantId,
          userId: req.rbac.userId,
          userEmail: req.user?.email || "",
          type,
          description,
          page,
          priority: priority || null,
          screenshotData: screenshotData || null,
          status: "new",
        })
        .returning();

      // Non-blocking notification email
      sendNotificationEmail(created, req.user).catch((err: any) => {
        console.warn("[Feedback] Failed to send notification email:", err?.message);
      });

      res.status(201).json(created);
    } catch (error: any) {
      console.error("[Feedback] Failed to create:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // GET /api/admin/feedback — platform admin only
  app.get("/api/admin/feedback", isAuthenticated, requireAdminAuth, async (req: any, res) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      const typeFilter = req.query.type as string | undefined;
      const tenantFilter = req.query.tenantId as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;

      const conditions = [];
      if (statusFilter) conditions.push(eq(feedbackSubmissions.status, statusFilter));
      if (typeFilter) conditions.push(eq(feedbackSubmissions.type, typeFilter));
      if (tenantFilter) conditions.push(eq(feedbackSubmissions.tenantId, tenantFilter));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, totalResult] = await Promise.all([
        db
          .select({
            id: feedbackSubmissions.id,
            tenantId: feedbackSubmissions.tenantId,
            userId: feedbackSubmissions.userId,
            userEmail: feedbackSubmissions.userEmail,
            type: feedbackSubmissions.type,
            description: feedbackSubmissions.description,
            page: feedbackSubmissions.page,
            priority: feedbackSubmissions.priority,
            screenshotData: feedbackSubmissions.screenshotData,
            status: feedbackSubmissions.status,
            adminNotes: feedbackSubmissions.adminNotes,
            resolvedAt: feedbackSubmissions.resolvedAt,
            resolvedBy: feedbackSubmissions.resolvedBy,
            createdAt: feedbackSubmissions.createdAt,
            updatedAt: feedbackSubmissions.updatedAt,
            userName: users.displayName,
            tenantName: tenants.name,
          })
          .from(feedbackSubmissions)
          .leftJoin(users, eq(feedbackSubmissions.userId, users.id))
          .leftJoin(tenants, eq(feedbackSubmissions.tenantId, tenants.id))
          .where(where)
          .orderBy(desc(feedbackSubmissions.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(feedbackSubmissions)
          .where(where),
      ]);

      res.json({
        items,
        total: totalResult[0]?.total || 0,
        page,
        limit,
      });
    } catch (error: any) {
      console.error("[Feedback] Failed to fetch:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // GET /api/admin/feedback/stats — platform admin only
  app.get("/api/admin/feedback/stats", isAuthenticated, requireAdminAuth, async (_req: any, res) => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [allRows, recentRows] = await Promise.all([
        db
          .select({
            type: feedbackSubmissions.type,
            status: feedbackSubmissions.status,
          })
          .from(feedbackSubmissions),
        db
          .select({ id: feedbackSubmissions.id })
          .from(feedbackSubmissions)
          .where(gte(feedbackSubmissions.createdAt, sevenDaysAgo)),
      ]);

      const byType = { bug: 0, feature: 0, workflow: 0 };
      const byStatus = { new: 0, in_progress: 0, resolved: 0, wont_fix: 0, duplicate: 0 };

      for (const row of allRows) {
        if (row.type in byType) byType[row.type as keyof typeof byType]++;
        if (row.status in byStatus) byStatus[row.status as keyof typeof byStatus]++;
      }

      res.json({
        total: allRows.length,
        byType,
        byStatus,
        last7Days: recentRows.length,
      });
    } catch (error: any) {
      console.error("[Feedback] Failed to fetch stats:", error);
      res.status(500).json({ message: "Failed to fetch feedback stats" });
    }
  });

  // PATCH /api/admin/feedback/:id — platform admin only
  app.patch("/api/admin/feedback/:id", isAuthenticated, requireAdminAuth, async (req: any, res) => {
    try {
      const parsed = updateFeedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const { status, adminNotes } = parsed.data;
      const updateData: Record<string, any> = { updatedAt: new Date() };

      if (status !== undefined) updateData.status = status;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

      // Set resolved fields when moving to terminal states
      if (status === "resolved" || status === "wont_fix") {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = req.user?.id || null;
      } else if (status === "new" || status === "in_progress") {
        updateData.resolvedAt = null;
        updateData.resolvedBy = null;
      }

      const [updated] = await db
        .update(feedbackSubmissions)
        .set(updateData)
        .where(eq(feedbackSubmissions.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Feedback not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("[Feedback] Failed to update:", error);
      res.status(500).json({ message: "Failed to update feedback" });
    }
  });
}

async function sendNotificationEmail(feedback: any, user: any): Promise<void> {
  try {
    const sgMail = (await import("@sendgrid/mail")).default;
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) return;

    sgMail.setApiKey(apiKey);

    const typeLabels: Record<string, string> = {
      bug: "Bug report",
      feature: "Feature request",
      workflow: "Workflow improvement",
    };

    const userName = user?.displayName || user?.email || "Unknown user";
    const typeLabel = typeLabels[feedback.type] || feedback.type;
    const truncatedDesc = feedback.description.length > 200
      ? feedback.description.slice(0, 200) + "..."
      : feedback.description;

    const appUrl = process.env.APP_URL || "https://qashivo-production.up.railway.app";

    await sgMail.send({
      to: "hello@qashivo.com",
      from: { email: process.env.SENDGRID_FROM_EMAIL || "cc@qashivo.com", name: "Qashivo Feedback" },
      subject: `[Qashivo Feedback] ${typeLabel} from ${userName}`,
      html: `
        <p><strong>Type:</strong> ${typeLabel}</p>
        <p><strong>From:</strong> ${userName} (${feedback.userEmail})</p>
        <p><strong>Page:</strong> ${feedback.page}</p>
        ${feedback.priority ? `<p><strong>Priority:</strong> ${feedback.priority}</p>` : ""}
        <p><strong>Description:</strong></p>
        <p>${truncatedDesc}</p>
        <br>
        <p><a href="${appUrl}/admin/ops/feedback">View in Admin Portal</a></p>
      `,
    });
  } catch {
    // Silently fail — notification is non-critical
  }
}
