import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { partnerReportSubscriptions, partnerGeneratedReports } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { subDays } from "date-fns";
import { generatePartnerReport, type PartnerReportType, PARTNER_REPORT_TYPE_LABELS } from "../services/partnerReportGenerator";
import { computePartnerReportNextRunAt } from "../services/partnerReportScheduler";

const VALID_REPORT_TYPES = ['portfolio_health', 'collections_performance', 'controller_productivity'] as const;
const VALID_FREQUENCIES = ['weekly', 'fortnightly', 'monthly'] as const;

const createSubscriptionSchema = z.object({
  reportType: z.enum(VALID_REPORT_TYPES),
  frequency: z.enum(VALID_FREQUENCIES),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(28).optional(),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('08:00'),
  timezone: z.string().default('Europe/London'),
  recipientEmails: z.array(z.string().email()).min(1, 'At least one recipient email required'),
  filters: z.record(z.unknown()).optional(),
});

const updateSubscriptionSchema = z.object({
  frequency: z.enum(VALID_FREQUENCIES).optional(),
  dayOfWeek: z.number().min(0).max(6).optional().nullable(),
  dayOfMonth: z.number().min(1).max(28).optional().nullable(),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timezone: z.string().optional(),
  recipientEmails: z.array(z.string().email()).optional(),
  isActive: z.boolean().optional(),
  filters: z.record(z.unknown()).optional(),
});

const generateSchema = z.object({
  reportType: z.enum(VALID_REPORT_TYPES),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

export function registerPartnerReportRoutes(app: Express) {

  // ─── Subscriptions CRUD ─────────────────────────────────────────────────────

  // GET /api/partner/reports/subscriptions
  app.get("/api/partner/reports/subscriptions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) return res.status(403).json({ message: "Not a partner user" });

      const subs = await db
        .select()
        .from(partnerReportSubscriptions)
        .where(eq(partnerReportSubscriptions.partnerId, user.partnerId))
        .orderBy(desc(partnerReportSubscriptions.createdAt));

      res.json({ subscriptions: subs });
    } catch (error) {
      console.error("GET /api/partner/reports/subscriptions error:", error);
      res.status(500).json({ message: "Failed to load subscriptions" });
    }
  });

  // POST /api/partner/reports/subscriptions
  app.post("/api/partner/reports/subscriptions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) return res.status(403).json({ message: "Not a partner user" });

      const parsed = createSubscriptionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

      const data = parsed.data;
      const nextRunAt = computePartnerReportNextRunAt({
        frequency: data.frequency,
        timeOfDay: data.timeOfDay,
        dayOfWeek: data.dayOfWeek ?? null,
        dayOfMonth: data.dayOfMonth ?? null,
        timezone: data.timezone,
      });

      const [sub] = await db.insert(partnerReportSubscriptions).values({
        partnerId: user.partnerId,
        reportType: data.reportType,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek ?? null,
        dayOfMonth: data.dayOfMonth ?? null,
        timeOfDay: data.timeOfDay,
        timezone: data.timezone,
        recipientEmails: data.recipientEmails,
        filters: data.filters || {},
        isActive: true,
        nextRunAt,
        createdBy: user.id,
      }).returning();

      res.status(201).json(sub);
    } catch (error) {
      console.error("POST /api/partner/reports/subscriptions error:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  // PATCH /api/partner/reports/subscriptions/:id
  app.patch("/api/partner/reports/subscriptions/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) return res.status(403).json({ message: "Not a partner user" });

      const parsed = updateSubscriptionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

      // Verify ownership
      const [existing] = await db.select().from(partnerReportSubscriptions)
        .where(and(eq(partnerReportSubscriptions.id, req.params.id), eq(partnerReportSubscriptions.partnerId, user.partnerId)));
      if (!existing) return res.status(404).json({ message: "Subscription not found" });

      const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

      // Recompute nextRunAt if schedule changed
      if (parsed.data.frequency || parsed.data.dayOfWeek !== undefined || parsed.data.dayOfMonth !== undefined || parsed.data.timeOfDay) {
        updates.nextRunAt = computePartnerReportNextRunAt({
          frequency: (parsed.data.frequency || existing.frequency) as any,
          timeOfDay: parsed.data.timeOfDay || existing.timeOfDay,
          dayOfWeek: parsed.data.dayOfWeek !== undefined ? parsed.data.dayOfWeek : existing.dayOfWeek,
          dayOfMonth: parsed.data.dayOfMonth !== undefined ? parsed.data.dayOfMonth : existing.dayOfMonth,
          timezone: parsed.data.timezone || existing.timezone,
        });
      }

      const [updated] = await db.update(partnerReportSubscriptions)
        .set(updates)
        .where(eq(partnerReportSubscriptions.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("PATCH /api/partner/reports/subscriptions/:id error:", error);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // DELETE /api/partner/reports/subscriptions/:id
  app.delete("/api/partner/reports/subscriptions/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) return res.status(403).json({ message: "Not a partner user" });

      const [existing] = await db.select().from(partnerReportSubscriptions)
        .where(and(eq(partnerReportSubscriptions.id, req.params.id), eq(partnerReportSubscriptions.partnerId, user.partnerId)));
      if (!existing) return res.status(404).json({ message: "Subscription not found" });

      await db.delete(partnerReportSubscriptions).where(eq(partnerReportSubscriptions.id, req.params.id));
      res.json({ message: "Subscription deleted" });
    } catch (error) {
      console.error("DELETE /api/partner/reports/subscriptions/:id error:", error);
      res.status(500).json({ message: "Failed to delete subscription" });
    }
  });

  // ─── Report Generation & History ────────────────────────────────────────────

  // POST /api/partner/reports/generate — manual one-off
  app.post("/api/partner/reports/generate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) return res.status(403).json({ message: "Not a partner user" });

      const parsed = generateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });

      const reportType = parsed.data.reportType as PartnerReportType;
      const periodEnd = parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : new Date();
      const periodStart = parsed.data.periodStart ? new Date(parsed.data.periodStart) : subDays(periodEnd, 30);

      // Create report record in generating state
      const [report] = await db.insert(partnerGeneratedReports).values({
        partnerId: user.partnerId,
        reportType,
        title: PARTNER_REPORT_TYPE_LABELS[reportType],
        periodStart,
        periodEnd,
        status: 'generating',
        generatedBy: user.id,
      }).returning();

      // Generate PDF (may take a few seconds for Puppeteer)
      try {
        const result = await generatePartnerReport(user.partnerId, reportType, { periodStart, periodEnd });

        const [updated] = await db.update(partnerGeneratedReports)
          .set({
            pdfData: result.pdfBuffer.toString('base64'),
            metadata: result.metadata,
            status: 'completed',
            title: result.title,
          })
          .where(eq(partnerGeneratedReports.id, report.id))
          .returning();

        res.json({ id: updated.id, title: updated.title, status: updated.status });
      } catch (genErr) {
        console.error(`[PartnerReport] Generation failed for ${report.id}:`, genErr);
        await db.update(partnerGeneratedReports)
          .set({ status: 'failed', metadata: { error: String(genErr) } })
          .where(eq(partnerGeneratedReports.id, report.id));
        res.status(500).json({ message: "Report generation failed" });
      }
    } catch (error) {
      console.error("POST /api/partner/reports/generate error:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // GET /api/partner/reports/history — paginated list (no PDF data)
  app.get("/api/partner/reports/history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) return res.status(403).json({ message: "Not a partner user" });

      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;

      const reports = await db
        .select({
          id: partnerGeneratedReports.id,
          reportType: partnerGeneratedReports.reportType,
          title: partnerGeneratedReports.title,
          periodStart: partnerGeneratedReports.periodStart,
          periodEnd: partnerGeneratedReports.periodEnd,
          status: partnerGeneratedReports.status,
          metadata: partnerGeneratedReports.metadata,
          distributedAt: partnerGeneratedReports.distributedAt,
          distributionRecipients: partnerGeneratedReports.distributionRecipients,
          createdAt: partnerGeneratedReports.createdAt,
        })
        .from(partnerGeneratedReports)
        .where(eq(partnerGeneratedReports.partnerId, user.partnerId))
        .orderBy(desc(partnerGeneratedReports.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({ reports });
    } catch (error) {
      console.error("GET /api/partner/reports/history error:", error);
      res.status(500).json({ message: "Failed to load report history" });
    }
  });

  // GET /api/partner/reports/:id/download — stream PDF
  app.get("/api/partner/reports/:id/download", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) return res.status(403).json({ message: "Not a partner user" });

      const [report] = await db
        .select()
        .from(partnerGeneratedReports)
        .where(and(
          eq(partnerGeneratedReports.id, req.params.id),
          eq(partnerGeneratedReports.partnerId, user.partnerId),
        ));

      if (!report) return res.status(404).json({ message: "Report not found" });
      if (report.status !== 'completed' || !report.pdfData) {
        return res.status(400).json({ message: "Report not yet available" });
      }

      const pdfBuffer = Buffer.from(report.pdfData, 'base64');
      const filename = `${report.reportType}-${report.periodEnd.toISOString().slice(0, 10)}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) {
      console.error("GET /api/partner/reports/:id/download error:", error);
      res.status(500).json({ message: "Failed to download report" });
    }
  });
}
