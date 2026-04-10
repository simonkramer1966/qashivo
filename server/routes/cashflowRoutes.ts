/**
 * Cashflow Forecast Routes — Phases 1–5
 *
 * Endpoints for the 13-week cashflow forecast engine.
 * All endpoints are tenant-scoped via isAuthenticated middleware.
 */

import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { withMinimumRole } from "../middleware/rbac";
import {
  generateInflowForecast,
  getDebtorPaymentProfile,
  compareForecasts,
  invalidateForecastCache,
} from "../services/cashflowForecastService";
import {
  getAllPatterns,
  validatePattern,
} from "../services/recurringRevenueService";
import {
  captureWeekActuals,
  generateVarianceDrivers,
  getMondayOfWeek,
} from "../services/forecastActualsService";
import { db } from "../db";
import { tenants, forecastOutflows, pipelineItems, contacts, forecastSnapshots } from "@shared/schema";
import { eq, and, inArray, sql, desc, asc } from "drizzle-orm";

export function registerCashflowRoutes(app: Express): void {
  // ── GET /api/cashflow/inflow-forecast ──
  // Returns the full 13-week forecast with all signal intelligence
  app.get(
    "/api/cashflow/inflow-forecast",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const forecast = await generateInflowForecast(tenantId);

        // Store snapshot for future comparison (best-effort, non-blocking)
        db.update(tenants)
          .set({
            lastForecastSnapshot: forecast as any,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenantId))
          .catch((err: Error) =>
            console.error(
              "[CashflowRoutes] Failed to store forecast snapshot:",
              err,
            ),
          );

        res.json(forecast);
      } catch (error) {
        console.error("[CashflowRoutes] inflow-forecast error:", error);
        res.status(500).json({ error: "Failed to generate forecast" });
      }
    },
  );

  // ── GET /api/cashflow/forecast-changes ──
  // Compare current forecast with the last stored snapshot
  app.get(
    "/api/cashflow/forecast-changes",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        // Load previous snapshot
        const [tenant] = await db
          .select({ lastForecastSnapshot: tenants.lastForecastSnapshot })
          .from(tenants)
          .where(eq(tenants.id, tenantId));

        const previous = tenant?.lastForecastSnapshot as any;

        // Generate current forecast
        const current = await generateInflowForecast(tenantId);

        const changes = compareForecasts(current, previous);
        res.json(changes);
      } catch (error) {
        console.error("[CashflowRoutes] forecast-changes error:", error);
        res.status(500).json({ error: "Failed to compare forecasts" });
      }
    },
  );

  // ── GET /api/cashflow/debtor-profile/:contactId ──
  // Per-debtor payment profile with distribution curve
  app.get(
    "/api/cashflow/debtor-profile/:contactId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const { contactId } = req.params;
        if (!contactId) {
          return res.status(400).json({ error: "contactId required" });
        }

        const profile = await getDebtorPaymentProfile(tenantId, contactId);
        if (!profile) {
          return res.status(404).json({ error: "Debtor not found" });
        }

        res.json(profile);
      } catch (error) {
        console.error("[CashflowRoutes] debtor-profile error:", error);
        res.status(500).json({ error: "Failed to get debtor profile" });
      }
    },
  );

  // ── GET /api/cashflow/opening-balance ──
  // Current opening balance, source, and date
  app.get(
    "/api/cashflow/opening-balance",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const [tenant] = await db
          .select({
            amount: tenants.forecastOpeningBalance,
            date: tenants.forecastOpeningBalanceDate,
            source: tenants.forecastOpeningBalanceSource,
          })
          .from(tenants)
          .where(eq(tenants.id, tenantId));

        res.json({
          amount: tenant?.amount ? Number(tenant.amount) : 0,
          date: tenant?.date ? new Date(tenant.date).toISOString().slice(0, 10) : null,
          source: tenant?.source || "manual",
        });
      } catch (error) {
        console.error("[CashflowRoutes] opening-balance error:", error);
        res.status(500).json({ error: "Failed to get opening balance" });
      }
    },
  );

  // ── PATCH /api/cashflow/opening-balance ──
  // Set opening balance (manager+ only)
  app.patch(
    "/api/cashflow/opening-balance",
    isAuthenticated,
    withMinimumRole("manager"),
    async (req: any, res: any) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const { amount } = req.body;
        if (typeof amount !== "number" || isNaN(amount)) {
          return res.status(400).json({ error: "amount must be a number" });
        }

        await db
          .update(tenants)
          .set({
            forecastOpeningBalance: String(amount),
            forecastOpeningBalanceDate: new Date(),
            forecastOpeningBalanceSource: "manual",
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenantId));

        // Invalidate forecast cache since opening balance affects running balance
        invalidateForecastCache(tenantId);

        res.json({
          amount,
          date: new Date().toISOString().slice(0, 10),
          source: "manual",
        });
      } catch (error) {
        console.error("[CashflowRoutes] set opening-balance error:", error);
        res.status(500).json({ error: "Failed to set opening balance" });
      }
    },
  );

  // ── PATCH /api/cashflow/safety-threshold ──
  // Set safety threshold (manager+ only)
  app.patch(
    "/api/cashflow/safety-threshold",
    isAuthenticated,
    withMinimumRole("manager"),
    async (req: any, res: any) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const { amount } = req.body;
        if (typeof amount !== "number" || isNaN(amount) || amount < 0) {
          return res
            .status(400)
            .json({ error: "amount must be a non-negative number" });
        }

        await db
          .update(tenants)
          .set({
            forecastSafetyThreshold: String(amount),
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenantId));

        // Invalidate forecast cache since threshold affects cash gap alerts
        invalidateForecastCache(tenantId);

        res.json({ amount });
      } catch (error) {
        console.error("[CashflowRoutes] set safety-threshold error:", error);
        res.status(500).json({ error: "Failed to set safety threshold" });
      }
    },
  );

  // ── GET /api/cashflow/recurring-patterns ──
  // All detected/confirmed/lapsed recurring revenue patterns
  app.get(
    "/api/cashflow/recurring-patterns",
    isAuthenticated,
    async (req: any, res: any) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const patterns = await getAllPatterns(tenantId);
        res.json(patterns);
      } catch (error) {
        console.error("[CashflowRoutes] recurring-patterns error:", error);
        res.status(500).json({ error: "Failed to get recurring patterns" });
      }
    },
  );

  // ── POST /api/cashflow/recurring-patterns/:id/validate ──
  // Confirm or reject a detected pattern (manager+ only)
  app.post(
    "/api/cashflow/recurring-patterns/:id/validate",
    isAuthenticated,
    withMinimumRole("manager"),
    async (req: any, res: any) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const { id } = req.params;
        const { action, reason } = req.body;

        if (!action || !["confirm", "reject"].includes(action)) {
          return res
            .status(400)
            .json({ error: "action must be 'confirm' or 'reject'" });
        }

        const userId = req.user?.id || req.rbac?.userId || "unknown";
        await validatePattern(tenantId, id, action, userId, reason);

        res.json({ success: true, action });
      } catch (error) {
        console.error("[CashflowRoutes] validate pattern error:", error);
        res.status(500).json({ error: "Failed to validate pattern" });
      }
    },
  );

  // ── GET /api/cashflow/outflows ──
  app.get(
    "/api/cashflow/outflows",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const rows = await db
          .select()
          .from(forecastOutflows)
          .where(eq(forecastOutflows.tenantId, tenantId));

        res.json(rows);
      } catch (error) {
        console.error("[CashflowRoutes] outflows GET error:", error);
        res.status(500).json({ error: "Failed to get outflows" });
      }
    },
  );

  // ── PUT /api/cashflow/outflows ──
  // Upsert by (tenantId, category, weekStarting). Amount=0 deletes.
  app.put(
    "/api/cashflow/outflows",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const { category, weekStarting, amount, description, parentCategory } = req.body;
        if (!category || !weekStarting) {
          return res.status(400).json({ error: "category and weekStarting are required" });
        }

        const weekDate = new Date(weekStarting);
        if (isNaN(weekDate.getTime())) {
          return res.status(400).json({ error: "Invalid weekStarting date" });
        }

        const numAmount = Number(amount);

        // Find existing row
        const [existing] = await db
          .select()
          .from(forecastOutflows)
          .where(
            and(
              eq(forecastOutflows.tenantId, tenantId),
              eq(forecastOutflows.category, category),
              eq(forecastOutflows.weekStarting, weekDate),
            ),
          );

        if (!numAmount || numAmount === 0) {
          // Delete if exists
          if (existing) {
            await db
              .delete(forecastOutflows)
              .where(eq(forecastOutflows.id, existing.id));
          }
          invalidateForecastCache(tenantId);
          return res.json({ deleted: true });
        }

        if (existing) {
          // Update
          await db
            .update(forecastOutflows)
            .set({
              amount: String(numAmount),
              description: description || existing.description,
              parentCategory: parentCategory || existing.parentCategory,
              updatedAt: new Date(),
            })
            .where(eq(forecastOutflows.id, existing.id));
        } else {
          // Insert
          await db.insert(forecastOutflows).values({
            tenantId,
            category,
            weekStarting: weekDate,
            amount: String(numAmount),
            description: description || null,
            parentCategory: parentCategory || null,
          });
        }

        invalidateForecastCache(tenantId);
        res.json({ success: true });
      } catch (error) {
        console.error("[CashflowRoutes] outflows PUT error:", error);
        res.status(500).json({ error: "Failed to upsert outflow" });
      }
    },
  );

  // ── DELETE /api/cashflow/outflows/:id ──
  app.delete(
    "/api/cashflow/outflows/:id",
    isAuthenticated,
    withMinimumRole("manager"),
    async (req: any, res: any) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const { id } = req.params;

        // Verify ownership
        const [row] = await db
          .select()
          .from(forecastOutflows)
          .where(
            and(
              eq(forecastOutflows.id, id),
              eq(forecastOutflows.tenantId, tenantId),
            ),
          );

        if (!row) {
          return res.status(404).json({ error: "Outflow not found" });
        }

        await db.delete(forecastOutflows).where(eq(forecastOutflows.id, id));
        invalidateForecastCache(tenantId);

        res.json({ deleted: true });
      } catch (error) {
        console.error("[CashflowRoutes] outflows DELETE error:", error);
        res.status(500).json({ error: "Failed to delete outflow" });
      }
    },
  );

  // ── Pipeline Items (Cashflow Layer 3) ──

  const VALID_CONFIDENCE = ["committed", "uncommitted", "stretch"];
  const VALID_TIMING_TYPE = ["one_off", "spread", "recurring_monthly", "recurring_weekly"];

  // GET /api/cashflow/pipeline — all active + converted items for tenant
  app.get(
    "/api/cashflow/pipeline",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const rows = await db
          .select({
            id: pipelineItems.id,
            tenantId: pipelineItems.tenantId,
            description: pipelineItems.description,
            contactId: pipelineItems.contactId,
            contactName: pipelineItems.contactName,
            amount: pipelineItems.amount,
            timingType: pipelineItems.timingType,
            startWeek: pipelineItems.startWeek,
            endWeek: pipelineItems.endWeek,
            confidence: pipelineItems.confidence,
            useDebtorHistory: pipelineItems.useDebtorHistory,
            customPaymentDays: pipelineItems.customPaymentDays,
            status: pipelineItems.status,
            convertedInvoiceId: pipelineItems.convertedInvoiceId,
            convertedAt: pipelineItems.convertedAt,
            expiresAt: pipelineItems.expiresAt,
            createdAt: pipelineItems.createdAt,
            updatedAt: pipelineItems.updatedAt,
            resolvedContactName: contacts.name,
          })
          .from(pipelineItems)
          .leftJoin(contacts, eq(contacts.id, pipelineItems.contactId))
          .where(
            and(
              eq(pipelineItems.tenantId, tenantId),
              inArray(pipelineItems.status, ["active", "converted"]),
            ),
          );

        // Use resolved contact name if available
        const items = rows.map((r) => ({
          ...r,
          contactName: r.resolvedContactName || r.contactName,
          resolvedContactName: undefined,
        }));

        res.json(items);
      } catch (error) {
        console.error("[CashflowRoutes] pipeline GET error:", error);
        res.status(500).json({ error: "Failed to get pipeline items" });
      }
    },
  );

  // POST /api/cashflow/pipeline — create new pipeline item
  app.post(
    "/api/cashflow/pipeline",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const { description, contactId, contactName, amount, timingType, startWeek, endWeek, confidence, useDebtorHistory, customPaymentDays } = req.body;

        if (!description || !description.trim()) {
          return res.status(400).json({ error: "description is required" });
        }
        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
          return res.status(400).json({ error: "amount must be > 0" });
        }
        if (!VALID_TIMING_TYPE.includes(timingType)) {
          return res.status(400).json({ error: `timingType must be one of: ${VALID_TIMING_TYPE.join(", ")}` });
        }
        if (!startWeek) {
          return res.status(400).json({ error: "startWeek is required" });
        }
        const conf = confidence || "uncommitted";
        if (!VALID_CONFIDENCE.includes(conf)) {
          return res.status(400).json({ error: `confidence must be one of: ${VALID_CONFIDENCE.join(", ")}` });
        }
        if (timingType === "spread" && !endWeek) {
          return res.status(400).json({ error: "endWeek is required for spread items" });
        }

        const startDate = new Date(startWeek);
        const endDate = endWeek ? new Date(endWeek) : null;

        // Set expiry: spread = endWeek + 4 weeks, others = startWeek + 17 weeks
        let expiresAt: Date;
        if (timingType === "spread" && endDate) {
          expiresAt = new Date(endDate);
          expiresAt.setDate(expiresAt.getDate() + 28);
        } else {
          expiresAt = new Date(startDate);
          expiresAt.setDate(expiresAt.getDate() + 119); // 17 weeks
        }

        const [inserted] = await db.insert(pipelineItems).values({
          tenantId,
          description: description.trim(),
          contactId: contactId || null,
          contactName: contactName || null,
          amount: String(numAmount),
          timingType,
          startWeek: startDate,
          endWeek: endDate,
          confidence: conf,
          useDebtorHistory: useDebtorHistory !== false,
          customPaymentDays: customPaymentDays ? Number(customPaymentDays) : null,
          status: "active",
          expiresAt,
        }).returning();

        invalidateForecastCache(tenantId);
        res.json(inserted);
      } catch (error) {
        console.error("[CashflowRoutes] pipeline POST error:", error);
        res.status(500).json({ error: "Failed to create pipeline item" });
      }
    },
  );

  // PATCH /api/cashflow/pipeline/:id — partial update
  app.patch(
    "/api/cashflow/pipeline/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const { id } = req.params;

        // Verify ownership and not converted
        const [existing] = await db
          .select()
          .from(pipelineItems)
          .where(
            and(
              eq(pipelineItems.id, id),
              eq(pipelineItems.tenantId, tenantId),
            ),
          );

        if (!existing) {
          return res.status(404).json({ error: "Pipeline item not found" });
        }
        if (existing.status === "converted") {
          return res.status(400).json({ error: "Cannot edit a converted pipeline item" });
        }

        const updates: Record<string, unknown> = { updatedAt: new Date() };
        const { description, contactId, contactName, amount, timingType, startWeek, endWeek, confidence, useDebtorHistory, customPaymentDays } = req.body;

        if (description !== undefined) updates.description = description.trim();
        if (contactId !== undefined) updates.contactId = contactId || null;
        if (contactName !== undefined) updates.contactName = contactName || null;
        if (amount !== undefined) {
          const n = Number(amount);
          if (!n || n <= 0) return res.status(400).json({ error: "amount must be > 0" });
          updates.amount = String(n);
        }
        if (timingType !== undefined) {
          if (!VALID_TIMING_TYPE.includes(timingType)) return res.status(400).json({ error: "Invalid timingType" });
          updates.timingType = timingType;
        }
        if (startWeek !== undefined) updates.startWeek = new Date(startWeek);
        if (endWeek !== undefined) updates.endWeek = endWeek ? new Date(endWeek) : null;
        if (confidence !== undefined) {
          if (!VALID_CONFIDENCE.includes(confidence)) return res.status(400).json({ error: "Invalid confidence" });
          updates.confidence = confidence;
        }
        if (useDebtorHistory !== undefined) updates.useDebtorHistory = useDebtorHistory;
        if (customPaymentDays !== undefined) updates.customPaymentDays = customPaymentDays ? Number(customPaymentDays) : null;

        const [updated] = await db
          .update(pipelineItems)
          .set(updates)
          .where(eq(pipelineItems.id, id))
          .returning();

        invalidateForecastCache(tenantId);
        res.json(updated);
      } catch (error) {
        console.error("[CashflowRoutes] pipeline PATCH error:", error);
        res.status(500).json({ error: "Failed to update pipeline item" });
      }
    },
  );

  // DELETE /api/cashflow/pipeline/:id — soft delete (cancel)
  app.delete(
    "/api/cashflow/pipeline/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const { id } = req.params;

        const [existing] = await db
          .select()
          .from(pipelineItems)
          .where(
            and(
              eq(pipelineItems.id, id),
              eq(pipelineItems.tenantId, tenantId),
            ),
          );

        if (!existing) {
          return res.status(404).json({ error: "Pipeline item not found" });
        }

        await db
          .update(pipelineItems)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(pipelineItems.id, id));

        invalidateForecastCache(tenantId);
        res.json({ deleted: true });
      } catch (error) {
        console.error("[CashflowRoutes] pipeline DELETE error:", error);
        res.status(500).json({ error: "Failed to delete pipeline item" });
      }
    },
  );

  // ── Phase 5: Close Week + Accuracy Tracking ──

  // GET /api/cashflow/close-week-preview — forecast vs actual for oldest eligible week
  app.get(
    "/api/cashflow/close-week-preview",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const now = new Date();

        // Find all completed week dates
        const completedWeeks = await db
          .select({ weekStarting: forecastSnapshots.weekStarting })
          .from(forecastSnapshots)
          .where(
            and(
              eq(forecastSnapshots.tenantId, tenantId),
              eq(forecastSnapshots.isCompleted, true),
            ),
          );
        const closedWeekDates = new Set(
          completedWeeks.map((w) => new Date(w.weekStarting).toISOString().slice(0, 10)),
        );

        // Walk backwards from current week to find the oldest eligible unclosed week
        // Eligible = week has passed (weekStart + 7 days < now) AND not closed
        const currentMonday = getMondayOfWeek(now);
        let eligibleWeek: Date | null = null;

        // Check up to 13 weeks back
        for (let offset = 1; offset <= 13; offset++) {
          const candidate = new Date(currentMonday);
          candidate.setDate(candidate.getDate() - offset * 7);
          const candidateStr = candidate.toISOString().slice(0, 10);

          if (!closedWeekDates.has(candidateStr)) {
            eligibleWeek = candidate;
            // Keep going to find the OLDEST unclosed week
          }
        }

        if (!eligibleWeek) {
          return res.json({ isEligible: false });
        }

        const weekEnd = new Date(eligibleWeek);
        weekEnd.setDate(weekEnd.getDate() + 6);

        // Get actuals
        const actuals = await captureWeekActuals(tenantId, eligibleWeek);

        // Get forecast for this week from the stored snapshot or current forecast
        const forecast = await generateInflowForecast(tenantId);
        const weekStr = eligibleWeek.toISOString().slice(0, 10);
        const weekForecast = forecast.weeklyForecasts.find(
          (wf) => wf.weekStarting === weekStr,
        );

        // Also check stored snapshot for the forecast numbers (more accurate if week was in the past)
        const [draftSnapshot] = await db
          .select()
          .from(forecastSnapshots)
          .where(
            and(
              eq(forecastSnapshots.tenantId, tenantId),
              sql`DATE(${forecastSnapshots.weekStarting}) = ${weekStr}`,
              eq(forecastSnapshots.isCompleted, false),
            ),
          )
          .limit(1);

        // Use forecast data — either from current forecast or stored snapshot
        const forecastTotal = weekForecast?.expected ?? 0;
        const forecastAr = weekForecast?.sourceBreakdown?.arCollections ?? 0;
        const forecastRecurring = weekForecast?.sourceBreakdown?.recurringRevenue ?? 0;
        const forecastPipeline = weekForecast?.sourceBreakdown?.pipeline ?? 0;

        // Get outflows for this week
        const weekOutflows = forecast.outflows?.weeklyTotals?.[
          forecast.weeklyForecasts.findIndex((wf) => wf.weekStarting === weekStr)
        ] ?? 0;

        const actualNetCashflow = actuals.actualCollections - actuals.actualOutflows;
        const forecastNetCashflow = forecastTotal - weekOutflows;

        const varianceAmount = Math.round((actuals.actualCollections - forecastTotal) * 100) / 100;
        const variancePercent = forecastTotal > 0
          ? Math.round((varianceAmount / forecastTotal) * 1000) / 10
          : 0;

        // Build forecast-by-debtor from invoice breakdown
        const forecastByDebtor = new Map<string, { name: string; amount: number }>();
        if (weekForecast?.invoiceBreakdown) {
          for (const inv of weekForecast.invoiceBreakdown) {
            const existing = forecastByDebtor.get(inv.contactId);
            const amt = inv.amountDue * inv.probability;
            if (existing) {
              existing.amount += amt;
            } else {
              forecastByDebtor.set(inv.contactId, { name: inv.contactName, amount: amt });
            }
          }
        }

        const varianceDrivers = generateVarianceDrivers(forecastByDebtor, actuals.collectionsByDebtor);

        const openingBalance = forecast.openingBalance ?? 0;
        const closingBalance = Math.round((openingBalance + actualNetCashflow) * 100) / 100;

        res.json({
          isEligible: true,
          weekStarting: weekStr,
          weekEnding: weekEnd.toISOString().slice(0, 10),
          weekNumber: forecast.weeklyForecasts.findIndex((wf) => wf.weekStarting === weekStr) + 1,
          forecast: {
            arCollections: Math.round(forecastAr * 100) / 100,
            recurringRevenue: Math.round(forecastRecurring * 100) / 100,
            pipeline: Math.round(forecastPipeline * 100) / 100,
            totalInflows: Math.round(forecastTotal * 100) / 100,
            totalOutflows: Math.round(weekOutflows * 100) / 100,
            netCashflow: Math.round(forecastNetCashflow * 100) / 100,
          },
          actual: {
            collections: actuals.actualCollections,
            invoicesRaised: actuals.actualInvoicesRaised,
            outflows: actuals.actualOutflows,
            netCashflow: Math.round(actualNetCashflow * 100) / 100,
          },
          variance: {
            amount: varianceAmount,
            percent: variancePercent,
          },
          varianceDrivers,
          openingBalance,
          closingBalance,
          newOpeningBalance: closingBalance,
        });
      } catch (error) {
        console.error("[CashflowRoutes] close-week-preview error:", error);
        res.status(500).json({ error: "Failed to generate close-week preview" });
      }
    },
  );

  // POST /api/cashflow/close-week — close and lock a week
  app.post(
    "/api/cashflow/close-week",
    isAuthenticated,
    withMinimumRole("manager"),
    async (req: any, res: any) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const { weekStarting } = req.body;
        if (!weekStarting) {
          return res.status(400).json({ error: "weekStarting is required" });
        }

        const weekStart = getMondayOfWeek(new Date(weekStarting));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const now = new Date();

        // Verify the week has passed
        if (weekEnd >= now) {
          return res.status(400).json({ error: "Cannot close a week that hasn't passed yet" });
        }

        // Verify no earlier unclosed week exists
        const earlierUnclosed = await db
          .select({ weekStarting: forecastSnapshots.weekStarting })
          .from(forecastSnapshots)
          .where(
            and(
              eq(forecastSnapshots.tenantId, tenantId),
              eq(forecastSnapshots.isCompleted, true),
            ),
          );
        const closedDates = new Set(
          earlierUnclosed.map((w) => new Date(w.weekStarting).toISOString().slice(0, 10)),
        );

        // Check if there's an earlier week that should be closed first
        const currentMonday = getMondayOfWeek(now);
        for (let offset = 1; offset <= 13; offset++) {
          const candidate = new Date(currentMonday);
          candidate.setDate(candidate.getDate() - offset * 7);
          const candidateStr = candidate.toISOString().slice(0, 10);
          const weekStr = weekStart.toISOString().slice(0, 10);

          if (candidateStr === weekStr) break; // Reached our target week
          if (!closedDates.has(candidateStr)) {
            return res.status(400).json({
              error: `Must close week starting ${candidateStr} first (must close in order)`,
            });
          }
        }

        // Check if already closed
        const weekStr = weekStart.toISOString().slice(0, 10);
        const [alreadyClosed] = await db
          .select({ id: forecastSnapshots.id })
          .from(forecastSnapshots)
          .where(
            and(
              eq(forecastSnapshots.tenantId, tenantId),
              sql`DATE(${forecastSnapshots.weekStarting}) = ${weekStr}`,
              eq(forecastSnapshots.isCompleted, true),
            ),
          )
          .limit(1);

        if (alreadyClosed) {
          return res.status(400).json({ error: "This week has already been closed" });
        }

        // Capture final actuals
        const actuals = await captureWeekActuals(tenantId, weekStart);

        // Get forecast for variance calculation
        const forecast = await generateInflowForecast(tenantId);
        const weekForecast = forecast.weeklyForecasts.find(
          (wf) => wf.weekStarting === weekStr,
        );

        const forecastTotal = weekForecast?.expected ?? 0;
        const forecastAr = weekForecast?.sourceBreakdown?.arCollections ?? 0;
        const forecastRecurring = weekForecast?.sourceBreakdown?.recurringRevenue ?? 0;
        const forecastPipeline = weekForecast?.sourceBreakdown?.pipeline ?? 0;
        const weekOutflows = forecast.outflows?.weeklyTotals?.[
          forecast.weeklyForecasts.findIndex((wf) => wf.weekStarting === weekStr)
        ] ?? 0;

        const varianceAmount = Math.round((actuals.actualCollections - forecastTotal) * 100) / 100;
        const variancePercent = forecastTotal > 0
          ? Math.round((varianceAmount / forecastTotal) * 1000) / 10
          : 0;

        // Variance drivers
        const forecastByDebtor = new Map<string, { name: string; amount: number }>();
        if (weekForecast?.invoiceBreakdown) {
          for (const inv of weekForecast.invoiceBreakdown) {
            const existing = forecastByDebtor.get(inv.contactId);
            const amt = inv.amountDue * inv.probability;
            if (existing) {
              existing.amount += amt;
            } else {
              forecastByDebtor.set(inv.contactId, { name: inv.contactName, amount: amt });
            }
          }
        }
        const varianceDrivers = generateVarianceDrivers(forecastByDebtor, actuals.collectionsByDebtor);

        const openingBalance = forecast.openingBalance ?? 0;
        const actualNetCashflow = actuals.actualCollections - actuals.actualOutflows;
        const closingBalance = Math.round((openingBalance + actualNetCashflow) * 100) / 100;

        const userId = req.user?.id || req.rbac?.userId || null;

        // Upsert completed snapshot
        const [existingDraft] = await db
          .select({ id: forecastSnapshots.id })
          .from(forecastSnapshots)
          .where(
            and(
              eq(forecastSnapshots.tenantId, tenantId),
              sql`DATE(${forecastSnapshots.weekStarting}) = ${weekStr}`,
              eq(forecastSnapshots.isCompleted, false),
            ),
          )
          .limit(1);

        const snapshotData = {
          tenantId,
          weekStarting: weekStart,
          snapshotDate: weekStart,
          layer1ArCollections: { expected: forecastAr } as any,
          layer2RecurringRevenue: { expected: forecastRecurring } as any,
          layer3Pipeline: { expected: forecastPipeline } as any,
          totalForecast: {
            optimistic: weekForecast?.optimistic ?? 0,
            expected: forecastTotal,
            pessimistic: weekForecast?.pessimistic ?? 0,
          } as any,
          invoiceBreakdown: (weekForecast?.invoiceBreakdown ?? []) as any,
          actualCollections: String(actuals.actualCollections),
          actualInvoicesRaised: String(actuals.actualInvoicesRaised),
          actualOutflows: String(actuals.actualOutflows),
          openingBalance: String(openingBalance),
          closingBalance: String(closingBalance),
          varianceAmount: String(varianceAmount),
          variancePercent: String(variancePercent),
          varianceDrivers: varianceDrivers as any,
          isCompleted: true,
          completedAt: new Date(),
          completedBy: userId,
          updatedAt: new Date(),
        };

        if (existingDraft) {
          await db
            .update(forecastSnapshots)
            .set(snapshotData)
            .where(eq(forecastSnapshots.id, existingDraft.id));
        } else {
          await db.insert(forecastSnapshots).values(snapshotData);
        }

        // Update tenant opening balance to closing balance
        await db
          .update(tenants)
          .set({
            forecastOpeningBalance: String(closingBalance),
            forecastOpeningBalanceDate: weekEnd,
            forecastOpeningBalanceSource: "last_closed_week",
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenantId));

        invalidateForecastCache(tenantId);

        const accuracy = 100 - Math.abs(variancePercent);

        console.log(
          `[CashflowRoutes] Week closed: ${weekStr} for tenant ${tenantId}. ` +
          `Forecast: £${forecastTotal}, Actual: £${actuals.actualCollections}, ` +
          `Accuracy: ${accuracy.toFixed(1)}%`,
        );

        res.json({
          success: true,
          weekStarting: weekStr,
          forecast: forecastTotal,
          actual: actuals.actualCollections,
          varianceAmount,
          variancePercent,
          accuracy: Math.round(accuracy * 10) / 10,
          closingBalance,
          varianceDrivers,
        });
      } catch (error) {
        console.error("[CashflowRoutes] close-week error:", error);
        res.status(500).json({ error: "Failed to close week" });
      }
    },
  );

  // GET /api/cashflow/accuracy-history — completed weeks + rolling metrics
  app.get(
    "/api/cashflow/accuracy-history",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || req.rbac?.tenantId;
        if (!tenantId) {
          return res.status(401).json({ error: "No tenant context" });
        }

        const completedSnapshots = await db
          .select()
          .from(forecastSnapshots)
          .where(
            and(
              eq(forecastSnapshots.tenantId, tenantId),
              eq(forecastSnapshots.isCompleted, true),
            ),
          )
          .orderBy(desc(forecastSnapshots.weekStarting));

        const weeks = completedSnapshots.map((s) => {
          const forecast = (s.totalForecast as any)?.expected ?? 0;
          const actual = Number(s.actualCollections) || 0;
          const vAmount = Number(s.varianceAmount) || 0;
          const vPercent = Number(s.variancePercent) || 0;
          const accuracy = Math.round((100 - Math.abs(vPercent)) * 10) / 10;

          const drivers = (s.varianceDrivers as any[]) ?? [];
          const topDriver = drivers.length > 0
            ? `${drivers[0].debtor}: ${drivers[0].reason}`
            : "";

          return {
            weekStarting: new Date(s.weekStarting).toISOString().slice(0, 10),
            forecast: Math.round(forecast * 100) / 100,
            actual: Math.round(actual * 100) / 100,
            varianceAmount: Math.round(vAmount * 100) / 100,
            variancePercent: Math.round(vPercent * 10) / 10,
            accuracy,
            topDriver,
            completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
          };
        });

        // Rolling 4-week accuracy
        const rolling4WeekAccuracy = weeks.length >= 2
          ? Math.round(
              weeks.slice(0, Math.min(4, weeks.length)).reduce((s, w) => s + w.accuracy, 0) /
              Math.min(4, weeks.length) * 10,
            ) / 10
          : null;

        // Rolling 13-week accuracy
        const rolling13WeekAccuracy = weeks.length >= 2
          ? Math.round(
              weeks.slice(0, Math.min(13, weeks.length)).reduce((s, w) => s + w.accuracy, 0) /
              Math.min(13, weeks.length) * 10,
            ) / 10
          : null;

        // Trend: compare last 4 vs previous 4
        let trend: "improving" | "stable" | "declining" | null = null;
        if (weeks.length >= 8) {
          const recent4 = weeks.slice(0, 4).reduce((s, w) => s + w.accuracy, 0) / 4;
          const previous4 = weeks.slice(4, 8).reduce((s, w) => s + w.accuracy, 0) / 4;
          const diff = recent4 - previous4;
          if (diff > 2) trend = "improving";
          else if (diff < -2) trend = "declining";
          else trend = "stable";
        }

        res.json({
          weeks,
          rolling4WeekAccuracy,
          rolling13WeekAccuracy,
          trend,
        });
      } catch (error) {
        console.error("[CashflowRoutes] accuracy-history error:", error);
        res.status(500).json({ error: "Failed to get accuracy history" });
      }
    },
  );
}
