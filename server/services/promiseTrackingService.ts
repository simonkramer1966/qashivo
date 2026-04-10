/**
 * Promise Tracking Service
 *
 * Thin orchestration layer over paymentPromises + unallocatedPayments.
 * Does NOT duplicate intentAnalyst's PTP detection — that stays where it is.
 *
 * Responsibilities:
 *  - Manual promise creation (user clicks "Promise" button)
 *  - Confirming a payment was received (creates unallocated_payments row,
 *    marks promise kept, branches on remaining-balance action)
 *  - Post-sync reconciliation of unallocated payments against Xero allocations
 *  - Expiring stale unallocated payments
 */

import { db } from "../db";
import { and, eq, inArray, sql, gte, lte, lt } from "drizzle-orm";
import {
  paymentPromises,
  unallocatedPayments,
  invoices,
  contacts,
  timelineEvents,
} from "@shared/schema";
import { getPromiseReliabilityService } from "./promiseReliabilityService";
import { transitionState } from "./conversationStateService";

const DEFAULT_UNALLOCATED_TIMEOUT_DAYS = 30;

interface CreateManualPromiseArgs {
  tenantId: string;
  contactId: string;
  invoiceIds: string[];
  promisedDate: Date;
  promisedAmount?: number;
  userId: string;
  notes?: string;
}

export async function createManualPromise(args: CreateManualPromiseArgs) {
  const { tenantId, contactId, invoiceIds, promisedDate, promisedAmount, userId, notes } = args;

  if (!invoiceIds || invoiceIds.length === 0) {
    throw new Error("createManualPromise requires at least one invoiceId");
  }

  const primaryInvoiceId = invoiceIds[0];

  const service = getPromiseReliabilityService();
  const created = await service.createPromise({
    tenantId,
    contactId,
    invoiceId: primaryInvoiceId,
    promiseType: "payment_date",
    promisedDate,
    promisedAmount,
    sourceType: "manual",
    createdByUserId: userId,
    notes,
    metadata: { invoiceIds, createdVia: "manual_ui" },
  });

  // Backfill bundle field — promiseReliabilityService doesn't know about it.
  await db
    .update(paymentPromises)
    .set({ promisedInvoiceIds: invoiceIds, originalPromisedDate: promisedDate })
    .where(eq(paymentPromises.id, created.id));

  return created;
}

interface ConfirmPaymentArgs {
  tenantId: string;
  contactId: string;
  promiseId?: string;
  amount: number;
  dateReceived: Date;
  userId: string;
  /** chase | wait | manual */
  remainingAction: "chase" | "wait" | "manual";
  remainingPromiseDate?: Date;
  note?: string;
}

/**
 * Confirm a payment was received (via the "Payment received" UI action).
 * Creates an unallocated_payments row, marks the source promise kept,
 * and branches on what to do with any remaining balance.
 */
export async function confirmPaymentReceived(args: ConfirmPaymentArgs) {
  const {
    tenantId,
    contactId,
    promiseId,
    amount,
    dateReceived,
    userId,
    remainingAction,
    remainingPromiseDate,
    note,
  } = args;

  if (amount <= 0) throw new Error("amount must be positive");

  const expiresAt = new Date(Date.now() + DEFAULT_UNALLOCATED_TIMEOUT_DAYS * 86400000);

  // 1. Insert the unallocated payment row.
  const [row] = await db
    .insert(unallocatedPayments)
    .values({
      tenantId,
      contactId,
      amount: amount.toFixed(2),
      remainingAmount: amount.toFixed(2),
      dateReceived,
      sourcePromiseId: promiseId ?? null,
      confirmedBy: userId,
      status: "unallocated",
      remainingBalanceAction: remainingAction,
      remainingBalancePromiseDate: remainingPromiseDate ?? null,
      expiresAt,
      note: note ?? null,
    })
    .returning();

  // 2. Mark the source promise (if any) as kept via manual confirmation.
  if (promiseId) {
    await db
      .update(paymentPromises)
      .set({
        status: "kept",
        actualPaymentDate: dateReceived,
        actualPaymentAmount: amount.toFixed(2),
        outcomeDetectedAt: new Date(),
        outcomeDetectionMethod: "manual_confirmation",
        evaluatedAt: new Date(),
        evaluatedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(paymentPromises.id, promiseId));

    // Conversation state → RESOLVED (promise kept)
    await transitionState(tenantId, contactId, 'promise_kept', {
      eventId: promiseId, eventType: 'payment_promise',
    }).catch(err => console.warn('[State] promise_kept transition failed:', err));
  }

  // 3. Branch on remaining-balance action.
  if (remainingAction === "wait" && remainingPromiseDate) {
    // Create a follow-up manual promise for the balance. We don't know the
    // exact invoice bundle here — pass any invoice id from the contact's
    // currently overdue set so the FK holds.
    const [anyInvoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.contactId, contactId)))
      .limit(1);

    if (anyInvoice) {
      const service = getPromiseReliabilityService();
      await service.createPromise({
        tenantId,
        contactId,
        invoiceId: anyInvoice.id,
        promiseType: "payment_date",
        promisedDate: remainingPromiseDate,
        sourceType: "manual",
        createdByUserId: userId,
        notes: `Follow-up promise for remaining balance after £${amount.toFixed(2)} confirmed on ${dateReceived.toLocaleDateString("en-GB")}`,
        metadata: { sourceUnallocatedPaymentId: row.id, createdVia: "payment_received_wait" },
      });
    }
  } else if (remainingAction === "manual") {
    // Hold the contact via the existing probable-payment mechanism so
    // Charlie's execution-time gate picks it up and skips chasing.
    await db
      .update(contacts)
      .set({
        probablePaymentDetected: true,
        probablePaymentConfidence: "high",
        probablePaymentDetectedAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(contacts.id, contactId));
  }
  // remainingAction === 'chase' is a no-op — next planner cycle will pick
  // up the net effective overdue automatically.

  // Log a timeline event for visibility.
  try {
    await db.insert(timelineEvents).values({
      tenantId,
      customerId: contactId,
      occurredAt: new Date(),
      direction: "system",
      channel: "system",
      summary: `Payment confirmed: £${amount.toFixed(2)} received ${dateReceived.toLocaleDateString("en-GB")} (${remainingAction})`,
      preview: note ?? null,
      status: "processed",
      createdByType: "user",
      createdByName: "Manual confirmation",
    } as any);
  } catch (err) {
    console.warn("[promiseTracking] timeline event failed (non-fatal)", err);
  }

  return row;
}

/**
 * Reconcile unallocated payments against Xero's invoice.amountPaid activity.
 * Called after every successful sync.
 */
export async function reconcileUnallocatedPayments(tenantId: string): Promise<void> {
  const live = await db
    .select()
    .from(unallocatedPayments)
    .where(
      and(
        eq(unallocatedPayments.tenantId, tenantId),
        inArray(unallocatedPayments.status, ["unallocated", "partially_allocated"]),
      ),
    );

  if (live.length === 0) return;

  const now = new Date();

  for (const row of live) {
    try {
      // Sum amountPaid for invoices paid after this unallocated row was created.
      const [payRow] = await db
        .select({
          paid: sql<number>`COALESCE(SUM(${invoices.amountPaid}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.contactId, row.contactId),
            gte(invoices.paidDate, row.createdAt ?? new Date(0)),
          ),
        );

      const allocated = Number(payRow?.paid || 0);
      const amount = Number(row.amount);
      const remaining = Math.max(0, Math.round((amount - allocated) * 100) / 100);

      let newStatus: string;
      if (allocated <= 0) {
        newStatus = row.status; // no change
      } else if (allocated >= amount - 0.01) {
        newStatus = "reconciled";
      } else {
        newStatus = "partially_allocated";
      }

      await db
        .update(unallocatedPayments)
        .set({
          xeroAllocatedAmount: allocated.toFixed(2),
          remainingAmount: remaining.toFixed(2),
          status: newStatus,
          lastReconcileCheckAt: now,
          updatedAt: now,
        })
        .where(eq(unallocatedPayments.id, row.id));

      // Mismatch exception (logged only — never shown to the debtor).
      if (allocated > amount + 1) {
        console.warn(
          `[promiseTracking] unallocated_mismatch tenant=${tenantId} contact=${row.contactId} confirmed=£${amount} xeroAllocated=£${allocated}`,
        );
        try {
          await db.insert(timelineEvents).values({
            tenantId,
            customerId: row.contactId,
            occurredAt: now,
            direction: "system",
            channel: "system",
            summary: `Unallocated payment mismatch: confirmed £${amount.toFixed(2)}, Xero allocated £${allocated.toFixed(2)}`,
            status: "processed",
            createdByType: "system",
            createdByName: "Qashivo AI",
            outcomeType: "unallocated_mismatch",
          } as any);
        } catch {
          /* non-fatal */
        }
      }
    } catch (err) {
      console.warn(`[promiseTracking] reconcile failed for ${row.id}:`, err);
    }
  }
}

/**
 * Expire unallocated payments that have passed their 30-day timeout.
 */
export async function flagExpiredUnallocatedPayments(tenantId: string): Promise<number> {
  const now = new Date();
  const live = await db
    .select()
    .from(unallocatedPayments)
    .where(
      and(
        eq(unallocatedPayments.tenantId, tenantId),
        inArray(unallocatedPayments.status, ["unallocated", "partially_allocated"]),
        lt(unallocatedPayments.expiresAt, now),
      ),
    );

  for (const row of live) {
    await db
      .update(unallocatedPayments)
      .set({ status: "expired", updatedAt: now })
      .where(eq(unallocatedPayments.id, row.id));

    try {
      await db.insert(timelineEvents).values({
        tenantId,
        customerId: row.contactId,
        occurredAt: now,
        direction: "system",
        channel: "system",
        summary: `Unallocated payment expired after 30 days: £${Number(row.amount).toFixed(2)}`,
        status: "processed",
        createdByType: "system",
        createdByName: "Qashivo AI",
        outcomeType: "unallocated_timeout",
      } as any);
    } catch {
      /* non-fatal */
    }
  }

  return live.length;
}
