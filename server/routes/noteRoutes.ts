/**
 * Note routes — structured notes from users, Charlie, Riley, and system events.
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { withRBACContext } from "../middleware/rbac";
import { db } from "../db";
import { notes, contacts, users } from "@shared/schema";
import { and, eq, desc, lt, ilike, count, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createNote } from "../services/noteService";

const createNoteSchema = z.object({
  contactId: z.string().optional(),
  content: z.string().min(1).max(5000),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

const PAGE_SIZE = 25;

export function registerNoteRoutes(app: Express): void {
  // GET /api/notes — cursor-paginated list
  app.get(
    "/api/notes",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ message: "No tenant" });

        const source = req.query.source as string | undefined;
        const contactId = req.query.contactId as string | undefined;
        const priority = req.query.priority as string | undefined;
        const search = req.query.search as string | undefined;
        const cursor = req.query.cursor as string | undefined;

        const conditions: any[] = [eq(notes.tenantId, tenantId)];

        if (source && source !== "all") conditions.push(eq(notes.source, source));
        if (contactId) conditions.push(eq(notes.contactId, contactId));
        if (priority) conditions.push(eq(notes.priority, priority));
        if (search) conditions.push(ilike(notes.content, `%${search}%`));
        if (cursor) conditions.push(lt(notes.createdAt, new Date(cursor)));

        const rows = await db
          .select({
            note: notes,
            contactName: contacts.name,
            createdByName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
          })
          .from(notes)
          .leftJoin(contacts, eq(notes.contactId, contacts.id))
          .leftJoin(users, eq(notes.createdByUserId, users.id))
          .where(and(...conditions))
          .orderBy(desc(notes.createdAt))
          .limit(PAGE_SIZE + 1);

        const hasMore = rows.length > PAGE_SIZE;
        const items = rows.slice(0, PAGE_SIZE).map((r) => ({
          ...r.note,
          contactName: r.contactName,
          createdByName: r.createdByName,
        }));

        const nextCursor = hasMore && items.length > 0
          ? items[items.length - 1].createdAt?.toISOString()
          : null;

        res.json({ notes: items, nextCursor });
      } catch (err: any) {
        console.error("GET /api/notes error:", err);
        res.status(500).json({ message: "Failed to load notes" });
      }
    }
  );

  // GET /api/notes/unread-count
  app.get(
    "/api/notes/unread-count",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ count: 0 });

        const [result] = await db
          .select({ value: count() })
          .from(notes)
          .where(
            and(
              eq(notes.tenantId, tenantId),
              eq(notes.isRead, false)
            )
          );

        res.json({ count: Number(result?.value ?? 0) });
      } catch (err: any) {
        console.error("GET /api/notes/unread-count error:", err);
        res.status(500).json({ count: 0 });
      }
    }
  );

  // POST /api/notes — create manual note
  app.post(
    "/api/notes",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ message: "No tenant" });

        const parsed = createNoteSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid note data", errors: parsed.error.flatten() });
        }

        const note = await createNote({
          tenantId,
          contactId: parsed.data.contactId ?? null,
          content: parsed.data.content,
          source: "user",
          trigger: "manual",
          priority: parsed.data.priority ?? "normal",
          createdByUserId: req.rbac.userId,
        });

        res.status(201).json(note);
      } catch (err: any) {
        console.error("POST /api/notes error:", err);
        res.status(500).json({ message: "Failed to create note" });
      }
    }
  );

  // PATCH /api/notes/:id/read
  app.patch(
    "/api/notes/:id/read",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ message: "No tenant" });

        await db
          .update(notes)
          .set({
            isRead: true,
            readAt: new Date(),
            readByUserId: req.rbac.userId,
          })
          .where(
            and(eq(notes.id, req.params.id), eq(notes.tenantId, tenantId))
          );

        res.json({ ok: true });
      } catch (err: any) {
        console.error("PATCH /api/notes/:id/read error:", err);
        res.status(500).json({ message: "Failed to mark as read" });
      }
    }
  );

  // POST /api/notes/mark-all-read
  app.post(
    "/api/notes/mark-all-read",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ message: "No tenant" });

        await db
          .update(notes)
          .set({
            isRead: true,
            readAt: new Date(),
            readByUserId: req.rbac.userId,
          })
          .where(
            and(
              eq(notes.tenantId, tenantId),
              eq(notes.isRead, false)
            )
          );

        res.json({ ok: true });
      } catch (err: any) {
        console.error("POST /api/notes/mark-all-read error:", err);
        res.status(500).json({ message: "Failed to mark all as read" });
      }
    }
  );

  // GET /api/contacts/:contactId/notes — notes for a specific debtor
  app.get(
    "/api/contacts/:contactId/notes",
    isAuthenticated,
    withRBACContext,
    async (req: any, res: Response) => {
      try {
        const tenantId = req.rbac.tenantId;
        if (!tenantId) return res.status(400).json({ message: "No tenant" });

        const limit = Math.min(Number(req.query.limit) || 5, 50);

        const rows = await db
          .select({
            note: notes,
            createdByName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
          })
          .from(notes)
          .leftJoin(users, eq(notes.createdByUserId, users.id))
          .where(
            and(
              eq(notes.tenantId, tenantId),
              eq(notes.contactId, req.params.contactId)
            )
          )
          .orderBy(desc(notes.createdAt))
          .limit(limit);

        const items = rows.map((r) => ({
          ...r.note,
          createdByName: r.createdByName,
        }));

        res.json({ notes: items });
      } catch (err: any) {
        console.error("GET /api/contacts/:contactId/notes error:", err);
        res.status(500).json({ message: "Failed to load contact notes" });
      }
    }
  );
}
