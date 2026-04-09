/**
 * Promise + Unallocated Payment routes
 *
 * Powers the Promises sub-tab in Action Centre and the Payment Received flow
 * on broken promises / debtor detail.
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { withRBACContext, withMinimumRole } from "../middleware/rbac";
import { db } from "../db";
import {
  paymentPromises,
  unallocatedPayments,
  contacts,
  actions,
} from "@shared/schema";
import { and, eq, desc, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  confirmPaymentReceived,
} from "../services/promiseTrackingService";

const paymentReceivedSchema = z.object({
  amount: z.number().positive(),
  dateReceived: z.string(),
  remainingAction: z.enum(["chase", "wait", "manual"]),
  remainingPromiseDate: z.string().optional(),
  note: z.string().optional(),
});

const extendPromiseSchema = z.object({
  newPromisedDate: z.string(),
  reason: z.string().optional(),
});

function parseDate(input: string): Date {
  // Accept DD/MM/YYYY or ISO
  if (input.includes("/")) {
    const parts = input.split("/");
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(input);
}

export function registerPromiseRoutes(app: Express): void {
  // POST /api/promises/:promiseId/payment-received
  app.post(
    "/api/promises/:promiseId/payment-received",
    isAuthenticated,
    withRBACContext,
    withMinimumRole("credit_controller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.rbac!.tenantId;
        const userId = req.rbac!.userId;
        const { promiseId } = req.params;
        const body = paymentReceivedSchema.parse(req.body);

        const [promise] = await db
          .select()
          .from(paymentPromises)
          .where(and(eq(paymentPromises.id, promiseId), eq(paymentPromises.tenantId, tenantId)))
          .limit(1);
        if (!promise) return res.status(404).json({ message: "Promise not found" });

        const row = await confirmPaymentReceived({
          tenantId,
          contactId: promise.contactId,
          promiseId,
          amount: body.amount,
          dateReceived: parseDate(body.dateReceived),
          userId,
          remainingAction: body.remainingAction,
          remainingPromiseDate: body.remainingPromiseDate
            ? parseDate(body.remainingPromiseDate)
            : undefined,
          note: body.note,
        });

        res.status(201).json({ success: true, unallocatedPaymentId: row.id });
      } catch (err) {
        console.error("payment-received error:", err);
        res.status(500).json({ message: "Failed to confirm payment" });
      }
    },
  );

  // POST /api/contacts/:contactId/payment-received  (no linked promise)
  app.post(
    "/api/contacts/:contactId/payment-received",
    isAuthenticated,
    withRBACContext,
    withMinimumRole("credit_controller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.rbac!.tenantId;
        const userId = req.rbac!.userId;
        const { contactId } = req.params;
        const body = paymentReceivedSchema.parse(req.body);

        const row = await confirmPaymentReceived({
          tenantId,
          contactId,
          amount: body.amount,
          dateReceived: parseDate(body.dateReceived),
          userId,
          remainingAction: body.remainingAction,
          remainingPromiseDate: body.remainingPromiseDate
            ? parseDate(body.remainingPromiseDate)
            : undefined,
          note: body.note,
        });

        res.status(201).json({ success: true, unallocatedPaymentId: row.id });
      } catch (err) {
        console.error("contact payment-received error:", err);
        res.status(500).json({ message: "Failed to confirm payment" });
      }
    },
  );

  // POST /api/promises/:promiseId/extend
  app.post(
    "/api/promises/:promiseId/extend",
    isAuthenticated,
    withRBACContext,
    withMinimumRole("credit_controller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.rbac!.tenantId;
        const { promiseId } = req.params;
        const body = extendPromiseSchema.parse(req.body);

        const [existing] = await db
          .select()
          .from(paymentPromises)
          .where(and(eq(paymentPromises.id, promiseId), eq(paymentPromises.tenantId, tenantId)))
          .limit(1);
        if (!existing) return res.status(404).json({ message: "Promise not found" });

        const newDate = parseDate(body.newPromisedDate);
        const now = new Date();

        await db
          .update(paymentPromises)
          .set({
            promisedDate: newDate,
            status: "open",
            originalPromisedDate: existing.originalPromisedDate ?? existing.promisedDate,
            modificationCount: (existing.modificationCount ?? 0) + 1,
            lastModifiedAt: now,
            lastModifiedReason: body.reason ?? "Manually extended",
            updatedAt: now,
          })
          .where(eq(paymentPromises.id, promiseId));

        res.json({ success: true });
      } catch (err) {
        console.error("extend promise error:", err);
        res.status(500).json({ message: "Failed to extend promise" });
      }
    },
  );

  // GET /api/action-centre/broken-promises
  app.get(
    "/api/action-centre/broken-promises",
    isAuthenticated,
    withRBACContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.rbac!.tenantId;
        const since = new Date(Date.now() - 30 * 86400000);

        const broken = await db
          .select({
            id: paymentPromises.id,
            contactId: paymentPromises.contactId,
            contactName: contacts.name,
            promisedDate: paymentPromises.promisedDate,
            promisedAmount: paymentPromises.promisedAmount,
            sourceType: paymentPromises.sourceType,
            channel: paymentPromises.channel,
            brokenPromiseCount: paymentPromises.brokenPromiseCount,
            outcomeDetectedAt: paymentPromises.outcomeDetectedAt,
            promisedInvoiceIds: paymentPromises.promisedInvoiceIds,
            invoiceId: paymentPromises.invoiceId,
          })
          .from(paymentPromises)
          .innerJoin(contacts, eq(contacts.id, paymentPromises.contactId))
          .where(
            and(
              eq(paymentPromises.tenantId, tenantId),
              eq(paymentPromises.status, "broken"),
              gte(paymentPromises.outcomeDetectedAt, since),
            ),
          )
          .orderBy(desc(paymentPromises.outcomeDetectedAt));

        const expiredUnallocated = await db
          .select({
            id: unallocatedPayments.id,
            contactId: unallocatedPayments.contactId,
            contactName: contacts.name,
            amount: unallocatedPayments.amount,
            remainingAmount: unallocatedPayments.remainingAmount,
            dateReceived: unallocatedPayments.dateReceived,
            expiresAt: unallocatedPayments.expiresAt,
            status: unallocatedPayments.status,
          })
          .from(unallocatedPayments)
          .innerJoin(contacts, eq(contacts.id, unallocatedPayments.contactId))
          .where(
            and(
              eq(unallocatedPayments.tenantId, tenantId),
              eq(unallocatedPayments.status, "expired"),
            ),
          )
          .orderBy(desc(unallocatedPayments.expiresAt));

        res.json({
          brokenPromises: broken,
          unallocatedTimeouts: expiredUnallocated,
        });
      } catch (err) {
        console.error("broken-promises error:", err);
        res.status(500).json({ message: "Failed to load broken promises" });
      }
    },
  );

  // POST /api/unallocated-payments/:id/hold
  app.post(
    "/api/unallocated-payments/:id/hold",
    isAuthenticated,
    withRBACContext,
    withMinimumRole("credit_controller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.rbac!.tenantId;
        const { id } = req.params;
        const now = new Date();

        const [row] = await db
          .select()
          .from(unallocatedPayments)
          .where(and(eq(unallocatedPayments.id, id), eq(unallocatedPayments.tenantId, tenantId)))
          .limit(1);
        if (!row) return res.status(404).json({ message: "Not found" });

        // Extend expiry by another 30 days, restore to unallocated
        await db
          .update(unallocatedPayments)
          .set({
            status: "unallocated",
            expiresAt: new Date(Date.now() + 30 * 86400000),
            updatedAt: now,
          })
          .where(eq(unallocatedPayments.id, id));

        res.json({ success: true });
      } catch (err) {
        console.error("hold unallocated error:", err);
        res.status(500).json({ message: "Failed" });
      }
    },
  );

  // POST /api/unallocated-payments/:id/resume-chasing
  app.post(
    "/api/unallocated-payments/:id/resume-chasing",
    isAuthenticated,
    withRBACContext,
    withMinimumRole("credit_controller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.rbac!.tenantId;
        const { id } = req.params;

        const [row] = await db
          .select()
          .from(unallocatedPayments)
          .where(and(eq(unallocatedPayments.id, id), eq(unallocatedPayments.tenantId, tenantId)))
          .limit(1);
        if (!row) return res.status(404).json({ message: "Not found" });

        // Mark as disputed so planner no longer subtracts it from effective overdue
        await db
          .update(unallocatedPayments)
          .set({ status: "disputed", remainingAmount: "0", updatedAt: new Date() })
          .where(eq(unallocatedPayments.id, id));

        // Clear probable-payment hold on the contact
        await db
          .update(contacts)
          .set({
            probablePaymentDetected: false,
            probablePaymentConfidence: null,
            probablePaymentDetectedAt: null,
            updatedAt: new Date(),
          } as any)
          .where(eq(contacts.id, row.contactId));

        res.json({ success: true });
      } catch (err) {
        console.error("resume-chasing error:", err);
        res.status(500).json({ message: "Failed" });
      }
    },
  );

  // POST /api/unallocated-payments/:id/contact-debtor
  // Logs intent — caller (UI) should open the compose drawer afterwards.
  app.post(
    "/api/unallocated-payments/:id/contact-debtor",
    isAuthenticated,
    withRBACContext,
    withMinimumRole("credit_controller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.rbac!.tenantId;
        const { id } = req.params;

        const [row] = await db
          .select()
          .from(unallocatedPayments)
          .where(and(eq(unallocatedPayments.id, id), eq(unallocatedPayments.tenantId, tenantId)))
          .limit(1);
        if (!row) return res.status(404).json({ message: "Not found" });

        res.json({ success: true, contactId: row.contactId });
      } catch (err) {
        console.error("contact-debtor error:", err);
        res.status(500).json({ message: "Failed" });
      }
    },
  );
}
