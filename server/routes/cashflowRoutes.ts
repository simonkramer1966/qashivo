/**
 * Cashflow Forecast Routes — Phase 1
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
import { db } from "../db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

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
}
