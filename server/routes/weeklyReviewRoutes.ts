import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { generateWeeklyReview } from "../services/weeklyReviewService";
import { db } from "../db";
import { weeklyReviews } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Track last generation time per tenant to enforce rate limit
const lastGeneratedAt = new Map<string, number>();
const RATE_LIMIT_MS = 6 * 60 * 60 * 1000; // 6 hours

export function registerWeeklyReviewRoutes(app: Express): void {
  // ── POST /api/weekly-review/generate ────────────────────────
  // Manually trigger a review generation (6hr rate limit)
  app.post("/api/weekly-review/generate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Rate limit: one generation per 6 hours per tenant
      const lastTime = lastGeneratedAt.get(user.tenantId);
      if (lastTime && Date.now() - lastTime < RATE_LIMIT_MS) {
        const remainingMs = RATE_LIMIT_MS - (Date.now() - lastTime);
        const remainingMin = Math.ceil(remainingMs / 60000);
        return res.status(429).json({
          message: `Review was generated recently. Try again in ${remainingMin} minutes.`,
        });
      }

      lastGeneratedAt.set(user.tenantId, Date.now());

      const review = await generateWeeklyReview(user.tenantId);

      res.json(review);
    } catch (error) {
      console.error("[WeeklyReview] Error generating review:", error);
      res.status(500).json({ message: "Failed to generate weekly review" });
    }
  });

  // ── GET /api/weekly-review/latest ───────────────────────────
  app.get("/api/weekly-review/latest", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const review = await storage.getLatestWeeklyReview(user.tenantId);

      if (!review) {
        return res.status(404).json({ message: "No weekly review found" });
      }

      res.json(review);
    } catch (error) {
      console.error("[WeeklyReview] Error fetching latest review:", error);
      res.status(500).json({ message: "Failed to fetch latest review" });
    }
  });

  // ── GET /api/weekly-review/history ──────────────────────────
  app.get("/api/weekly-review/history", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const limit = Math.min(Number(req.query.limit) || 10, 52);
      const reviews = await storage.listWeeklyReviews(user.tenantId, limit);

      res.json(reviews);
    } catch (error) {
      console.error("[WeeklyReview] Error fetching review history:", error);
      res.status(500).json({ message: "Failed to fetch review history" });
    }
  });

  // ── PATCH /api/weekly-review/:id/archive ─────────────────────
  app.patch("/api/weekly-review/:id/archive", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const [updated] = await db.update(weeklyReviews)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(and(
          eq(weeklyReviews.id, req.params.id),
          eq(weeklyReviews.tenantId, user.tenantId),
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Review not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[WeeklyReview] Error archiving review:", error);
      res.status(500).json({ message: "Failed to archive review" });
    }
  });
}
