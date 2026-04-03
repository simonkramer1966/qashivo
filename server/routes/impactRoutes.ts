/**
 * Working Capital Impact Routes
 *
 * GET  /api/impact/summary    — headline impact data for dashboard
 * GET  /api/impact/snapshots  — snapshot history
 * POST /api/impact/calculate  — manually trigger a snapshot (manager+)
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { withRBACContext, withMinimumRole } from "../middleware/rbac";
import {
  getImpactSummary,
  listSnapshots,
  calculateAndStoreSnapshot,
  getBaselineSnapshot,
} from "../services/impactSnapshotService";

export function registerImpactRoutes(app: Express): void {
  // GET /api/impact/summary — headline numbers + baseline + latest
  app.get(
    "/api/impact/summary",
    isAuthenticated,
    withRBACContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).rbac.tenantId;
        const summary = await getImpactSummary(tenantId);
        res.json(summary);
      } catch (error) {
        console.error("[Impact API] summary error:", error);
        res.status(500).json({ error: "Failed to fetch impact summary" });
      }
    },
  );

  // GET /api/impact/snapshots — paginated snapshot history
  app.get(
    "/api/impact/snapshots",
    isAuthenticated,
    withRBACContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).rbac.tenantId;
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const snapshots = await listSnapshots(tenantId, limit);
        res.json({ snapshots });
      } catch (error) {
        console.error("[Impact API] snapshots error:", error);
        res.status(500).json({ error: "Failed to fetch snapshots" });
      }
    },
  );

  // POST /api/impact/calculate — manually trigger a snapshot
  app.post(
    "/api/impact/calculate",
    isAuthenticated,
    withRBACContext,
    withMinimumRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).rbac.tenantId;
        const snapshotType = req.body.snapshotType || "manual";

        if (!["baseline", "30_day", "90_day", "manual"].includes(snapshotType)) {
          return res.status(400).json({ error: "Invalid snapshot type" });
        }

        const result = await calculateAndStoreSnapshot(tenantId, snapshotType);
        res.json(result);
      } catch (error) {
        console.error("[Impact API] calculate error:", error);
        res.status(500).json({ error: "Failed to calculate snapshot" });
      }
    },
  );
}
