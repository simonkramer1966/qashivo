/**
 * Priority routes — daily briefing items for credit controllers.
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { withRBACContext } from "../middleware/rbac";
import { db } from "../db";
import { priorities, contacts } from "@shared/schema";
import { and, eq, desc, sql, count } from "drizzle-orm";

export function registerPriorityRoutes(app: Express): void {
  // GET /api/priorities — list by date, filterable by level/isRead
  app.get(
    "/api/priorities",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ message: "No tenant" });

        const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
        const level = req.query.level as string | undefined;
        const isRead = req.query.isRead as string | undefined;

        const conditions = [
          eq(priorities.tenantId, tenantId),
          eq(priorities.priorityDate, date),
        ];

        if (level) conditions.push(eq(priorities.level, level));
        if (isRead === "true") conditions.push(eq(priorities.isRead, true));
        if (isRead === "false") conditions.push(eq(priorities.isRead, false));

        const rows = await db
          .select({
            priority: priorities,
            contactName: contacts.name,
          })
          .from(priorities)
          .leftJoin(contacts, eq(priorities.contactId, contacts.id))
          .where(and(...conditions))
          .orderBy(
            sql`CASE ${priorities.level} WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END`,
            desc(priorities.createdAt)
          );

        const items = rows.map((r) => ({
          ...r.priority,
          contactName: r.contactName,
        }));

        res.json({ priorities: items, date });
      } catch (err: any) {
        console.error("GET /api/priorities error:", err);
        res.status(500).json({ message: "Failed to load priorities" });
      }
    }
  );

  // GET /api/priorities/unread-count
  app.get(
    "/api/priorities/unread-count",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ count: 0 });

        const today = new Date().toISOString().slice(0, 10);
        const [result] = await db
          .select({ value: count() })
          .from(priorities)
          .where(
            and(
              eq(priorities.tenantId, tenantId),
              eq(priorities.priorityDate, today),
              eq(priorities.isRead, false),
              eq(priorities.isDismissed, false)
            )
          );

        res.json({ count: Number(result?.value ?? 0) });
      } catch (err: any) {
        console.error("GET /api/priorities/unread-count error:", err);
        res.status(500).json({ count: 0 });
      }
    }
  );

  // PATCH /api/priorities/:id/read
  app.patch(
    "/api/priorities/:id/read",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ message: "No tenant" });

        await db
          .update(priorities)
          .set({
            isRead: true,
            readAt: new Date(),
            readByUserId: req.rbac.userId,
          })
          .where(
            and(eq(priorities.id, req.params.id), eq(priorities.tenantId, tenantId))
          );

        res.json({ ok: true });
      } catch (err: any) {
        console.error("PATCH /api/priorities/:id/read error:", err);
        res.status(500).json({ message: "Failed to mark as read" });
      }
    }
  );

  // POST /api/priorities/mark-all-read
  app.post(
    "/api/priorities/mark-all-read",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ message: "No tenant" });

        const today = new Date().toISOString().slice(0, 10);
        await db
          .update(priorities)
          .set({
            isRead: true,
            readAt: new Date(),
            readByUserId: req.rbac.userId,
          })
          .where(
            and(
              eq(priorities.tenantId, tenantId),
              eq(priorities.priorityDate, today),
              eq(priorities.isRead, false)
            )
          );

        res.json({ ok: true });
      } catch (err: any) {
        console.error("POST /api/priorities/mark-all-read error:", err);
        res.status(500).json({ message: "Failed to mark all as read" });
      }
    }
  );

  // PATCH /api/priorities/:id/dismiss
  app.patch(
    "/api/priorities/:id/dismiss",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ message: "No tenant" });

        await db
          .update(priorities)
          .set({
            isDismissed: true,
            dismissedAt: new Date(),
          })
          .where(
            and(eq(priorities.id, req.params.id), eq(priorities.tenantId, tenantId))
          );

        res.json({ ok: true });
      } catch (err: any) {
        console.error("PATCH /api/priorities/:id/dismiss error:", err);
        res.status(500).json({ message: "Failed to dismiss" });
      }
    }
  );
}
