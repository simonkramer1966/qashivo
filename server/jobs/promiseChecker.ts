/**
 * Promise Checker — daily job
 *
 * Three checks, in order, per tenant:
 *   A. Expired promises → kept/broken/rescheduled evaluation
 *   B. Pre-promise reminders (promise due tomorrow, no reminder sent yet)
 *   C. Unallocated payment timeouts
 *
 * Runs once a day on a server-UTC-09:00 cadence approximation: initial delay
 * 45s after boot + 24h interval, matching the legalWindowJob pattern.
 */

import { db } from "../db";
import { and, eq, inArray, lt, sql, gte, lte, isNull } from "drizzle-orm";
import {
  tenants,
  paymentPromises,
  invoices,
  contacts,
} from "../../shared/schema";
import { flagExpiredUnallocatedPayments } from "../services/promiseTrackingService";
import { emitTenantEvent } from "../services/realtimeEvents";
import { proposeAction } from "../services/batchProcessor";

const INTERVAL_MS = 24 * 60 * 60 * 1000;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startPromiseChecker(): void {
  console.log("[promise-checker] Starting daily promise checker");

  setTimeout(() => {
    runChecks().catch((err) => console.error("[promise-checker] Initial run error:", err));
  }, 45_000);

  intervalHandle = setInterval(() => {
    runChecks().catch((err) => console.error("[promise-checker] Run error:", err));
  }, INTERVAL_MS);
}

export function stopPromiseChecker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

async function runChecks(): Promise<void> {
  const allTenants = await db.select({ id: tenants.id }).from(tenants);
  for (const t of allTenants) {
    try {
      await checkExpiredPromises(t.id);
      await checkPrePromiseReminders(t.id);
      await flagExpiredUnallocatedPayments(t.id);
    } catch (err) {
      console.error(`[promise-checker] tenant ${t.id} error:`, err);
    }
  }
}

/**
 * Check A — expired promises.
 *
 * A promise is considered expired when now > promisedDate + gracePeriodDays.
 * For each expired open promise, look at the invoices in the bundle — if all
 * are paid (or the promised amount is paid), mark kept; otherwise broken.
 */
async function checkExpiredPromises(tenantId: string): Promise<void> {
  const now = new Date();

  const expired = await db
    .select()
    .from(paymentPromises)
    .where(
      and(
        eq(paymentPromises.tenantId, tenantId),
        eq(paymentPromises.status, "open"),
        sql`(${paymentPromises.promisedDate} + (COALESCE(${paymentPromises.gracePeriodDays}, 3) || ' days')::interval) < now()`,
      ),
    );

  for (const promise of expired) {
    try {
      const invoiceIds =
        (promise.promisedInvoiceIds as string[] | null) ||
        (promise.invoiceId ? [promise.invoiceId] : []);
      if (invoiceIds.length === 0) continue;

      const invRows = await db
        .select({
          id: invoices.id,
          amount: invoices.amount,
          amountPaid: invoices.amountPaid,
          status: invoices.status,
          paidDate: invoices.paidDate,
        })
        .from(invoices)
        .where(inArray(invoices.id, invoiceIds));

      const createdAt = promise.createdAt ?? new Date(0);
      let totalPaidSinceCreated = 0;
      let totalOutstanding = 0;

      for (const inv of invRows) {
        const amt = Number(inv.amount || 0);
        const paid = Number(inv.amountPaid || 0);
        totalOutstanding += Math.max(0, amt - paid);
        if (inv.paidDate && new Date(inv.paidDate) >= createdAt) {
          totalPaidSinceCreated += paid;
        }
      }

      const promisedAmt = promise.promisedAmount ? Number(promise.promisedAmount) : null;
      const kept =
        totalOutstanding <= 0.01 ||
        (promisedAmt != null && totalPaidSinceCreated >= promisedAmt - 0.01);

      if (kept) {
        await db
          .update(paymentPromises)
          .set({
            status: "kept",
            outcomeDetectedAt: now,
            outcomeDetectionMethod: "xero_sync",
            evaluatedAt: now,
            updatedAt: now,
          })
          .where(eq(paymentPromises.id, promise.id));
      } else {
        await db
          .update(paymentPromises)
          .set({
            status: "broken",
            outcomeDetectedAt: now,
            outcomeDetectionMethod: "xero_sync",
            brokenPromiseCount: sql`COALESCE(${paymentPromises.brokenPromiseCount}, 0) + 1`,
            evaluatedAt: now,
            updatedAt: now,
          })
          .where(eq(paymentPromises.id, promise.id));

        try {
          emitTenantEvent(tenantId, "promise_broken", {
            promiseId: promise.id,
            contactId: promise.contactId,
            promisedAmount: promisedAmt,
            promisedDate: promise.promisedDate,
          });
        } catch {
          /* non-fatal */
        }
      }
    } catch (err) {
      console.warn(`[promise-checker] expired-check failed for ${promise.id}:`, err);
    }
  }
}

/**
 * Check B — pre-promise reminders.
 *
 * Promises where promisedDate falls tomorrow, that haven't had a reminder
 * sent, and were created at least 3 days ago. Create a friendly reminder
 * action via proposeAction.
 */
async function checkPrePromiseReminders(tenantId: string): Promise<void> {
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const dueTomorrow = await db
    .select()
    .from(paymentPromises)
    .where(
      and(
        eq(paymentPromises.tenantId, tenantId),
        eq(paymentPromises.status, "open"),
        gte(paymentPromises.promisedDate, tomorrowStart),
        lte(paymentPromises.promisedDate, tomorrowEnd),
        lt(paymentPromises.createdAt, threeDaysAgo),
      ),
    );

  for (const promise of dueTomorrow) {
    if (promise.reminderSent) continue;
    try {
      const invoiceIds =
        (promise.promisedInvoiceIds as string[] | null) ||
        (promise.invoiceId ? [promise.invoiceId] : []);

      const { id: actionId } = await proposeAction({
        tenantId,
        contactId: promise.contactId,
        invoiceId: promise.invoiceId,
        invoiceIds,
        type: "email",
        scheduledFor: now,
        agentType: "collections",
        actionSummary: "Friendly promise reminder",
        priority: 40,
        metadata: {
          conversationType: "promise_reminder",
          toneOverride: "friendly",
          promiseId: promise.id,
          promisedAmount: promise.promisedAmount,
          promisedDate: promise.promisedDate,
        },
      });

      await db
        .update(paymentPromises)
        .set({
          reminderSent: true,
          reminderSentAt: now,
          reminderActionId: actionId,
          updatedAt: now,
        })
        .where(eq(paymentPromises.id, promise.id));
    } catch (err) {
      console.warn(`[promise-checker] reminder failed for ${promise.id}:`, err);
    }
  }
}
