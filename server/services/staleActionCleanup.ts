// ── Stale Action Cleanup ─────────────────────────────────────────────────
// Cancels pending/scheduled actions whose invoices have been paid, voided, or deleted.
// Reusable: called from sync pipeline, one-time scripts, or manual cleanup.

import { db } from '../db';
import { actions, invoices } from '@shared/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

const ACTIVE_STATUSES = ['pending_approval', 'pending', 'scheduled'];
const SETTLED_STATUSES = ['paid', 'void', 'voided', 'deleted'];

interface CleanupDetail {
  actionId: string;
  contactId: string | null;
  reason: string;
  invoiceCount: number;
  settledCount: number;
}

interface CleanupResult {
  cancelled: number;
  details: CleanupDetail[];
}

/**
 * Cancel actions whose invoices are all settled (paid/void/voided/deleted),
 * or whose bundle has been partially modified (some settled, some remain).
 */
export async function cancelStaleActions(tenantId?: string): Promise<CleanupResult> {
  // 1. Fetch all active actions
  const whereClause = tenantId
    ? and(
        sql`${actions.status} IN ('pending_approval', 'pending', 'scheduled')`,
        eq(actions.tenantId, tenantId),
      )
    : sql`${actions.status} IN ('pending_approval', 'pending', 'scheduled')`;

  const activeActions = await db
    .select({
      id: actions.id,
      tenantId: actions.tenantId,
      contactId: actions.contactId,
      invoiceId: actions.invoiceId,
      invoiceIds: actions.invoiceIds,
      type: actions.type,
    })
    .from(actions)
    .where(whereClause);

  if (activeActions.length === 0) {
    return { cancelled: 0, details: [] };
  }

  // 2. Collect all referenced invoice IDs
  const allInvoiceIds = new Set<string>();
  for (const action of activeActions) {
    if (action.invoiceIds?.length) {
      for (const id of action.invoiceIds) allInvoiceIds.add(id);
    } else if (action.invoiceId) {
      allInvoiceIds.add(action.invoiceId);
    }
  }

  if (allInvoiceIds.size === 0) {
    return { cancelled: 0, details: [] };
  }

  // 3. Batch-fetch invoice statuses
  const invoiceRows = await db
    .select({ id: invoices.id, status: invoices.status })
    .from(invoices)
    .where(inArray(invoices.id, Array.from(allInvoiceIds)));

  const invoiceStatusMap = new Map<string, string>();
  for (const inv of invoiceRows) {
    invoiceStatusMap.set(inv.id, (inv.status || '').toLowerCase());
  }

  // 4. Evaluate each action
  const details: CleanupDetail[] = [];
  const cancelIds: { id: string; reason: string }[] = [];

  for (const action of activeActions) {
    const actionInvIds: string[] = action.invoiceIds?.length
      ? action.invoiceIds
      : action.invoiceId
        ? [action.invoiceId]
        : [];

    if (actionInvIds.length === 0) continue;

    const settledCount = actionInvIds.filter(id => {
      const status = invoiceStatusMap.get(id);
      return status && SETTLED_STATUSES.includes(status);
    }).length;

    if (settledCount === 0) continue;

    let reason: string;
    if (settledCount === actionInvIds.length) {
      reason = 'all_invoices_settled';
    } else {
      reason = 'bundle_modified_requires_replan';
    }

    cancelIds.push({ id: action.id, reason });
    details.push({
      actionId: action.id,
      contactId: action.contactId,
      reason,
      invoiceCount: actionInvIds.length,
      settledCount,
    });
  }

  // 5. Batch cancel
  for (const { id, reason } of cancelIds) {
    await db
      .update(actions)
      .set({
        status: 'cancelled',
        cancellationReason: reason,
        completedAt: new Date(),
      })
      .where(eq(actions.id, id));
  }

  if (cancelIds.length > 0) {
    console.log(`[staleActionCleanup] Cancelled ${cancelIds.length} stale actions${tenantId ? ` for tenant ${tenantId}` : ''}`);
  }

  return { cancelled: cancelIds.length, details };
}

/**
 * Cancel active actions that reference a specific paid invoice.
 * Called from SyncOrchestrator.handlePaymentDetected() for immediate cleanup.
 * Returns count of cancelled actions.
 */
export async function cancelActionsForPaidInvoice(tenantId: string, paidInvoiceId: string): Promise<number> {
  // Find actions referencing this invoice: single invoiceId match OR in invoiceIds array
  const matchingActions = await db
    .select({
      id: actions.id,
      invoiceId: actions.invoiceId,
      invoiceIds: actions.invoiceIds,
    })
    .from(actions)
    .where(and(
      eq(actions.tenantId, tenantId),
      sql`${actions.status} IN ('pending_approval', 'pending', 'scheduled')`,
      sql`(${actions.invoiceId} = ${paidInvoiceId} OR ${paidInvoiceId} = ANY(${actions.invoiceIds}))`,
    ));

  if (matchingActions.length === 0) return 0;

  let cancelled = 0;
  for (const action of matchingActions) {
    const actionInvIds: string[] = action.invoiceIds?.length
      ? action.invoiceIds
      : action.invoiceId
        ? [action.invoiceId]
        : [];

    // For bundles, check if ALL invoices are now settled
    if (actionInvIds.length > 1) {
      const otherIds = actionInvIds.filter(id => id !== paidInvoiceId);
      const otherInvoices = await db
        .select({ id: invoices.id, status: invoices.status })
        .from(invoices)
        .where(inArray(invoices.id, otherIds));

      const allSettled = otherInvoices.every(inv =>
        SETTLED_STATUSES.includes((inv.status || '').toLowerCase()),
      );

      const reason = allSettled ? 'all_invoices_settled' : 'bundle_modified_requires_replan';
      await db.update(actions).set({
        status: 'cancelled',
        cancellationReason: reason,
        completedAt: new Date(),
      }).where(eq(actions.id, action.id));
    } else {
      // Single-invoice action — cancel directly
      await db.update(actions).set({
        status: 'cancelled',
        cancellationReason: 'invoice_paid_during_sync',
        completedAt: new Date(),
      }).where(eq(actions.id, action.id));
    }
    cancelled++;
  }

  if (cancelled > 0) {
    console.log(`[staleActionCleanup] Cancelled ${cancelled} actions for paid invoice ${paidInvoiceId}`);
  }
  return cancelled;
}
