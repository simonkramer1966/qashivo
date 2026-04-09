/**
 * AR Summary Calculations — Single Source of Truth
 *
 * All AR summary figures (outstanding, overdue, DSO, debtor count)
 * must use getARSummary(). Never write inline SUM queries for these
 * figures in route handlers.
 *
 * The calculation mirrors the Debtors page logic exactly:
 * - Status filter: excludes paid, void, voided, deleted, draft
 * - Credit netting: per-contact (OP + PP + CN), plus unmatched credits
 * - Debtor count: contacts with net outstanding > 0
 */

import { db } from "../db";
import { eq, and, sql, gte, isNotNull, inArray, lt } from "drizzle-orm";
import {
  invoices,
  contacts,
  cachedXeroOverpayments,
  cachedXeroPrepayments,
  cachedXeroCreditNotes,
  dsoSnapshots,
  unallocatedPayments,
} from "@shared/schema";

export interface ARSummary {
  totalOutstanding: number;
  totalOverdue: number;
  debtorCount: number;
  currentDSO: number;
}

export const EXCLUDED_STATUSES = "('paid', 'void', 'voided', 'deleted', 'draft')";

export async function getARSummary(tenantId: string): Promise<ARSummary> {
  // 1. Query invoices grouped by contact
  const debtorRows = await db
    .select({
      contactId: contacts.id,
      totalOutstanding: sql<number>`COALESCE(SUM(CASE WHEN LOWER(${invoices.status}) NOT IN ${sql.raw(EXCLUDED_STATUSES)} THEN ${invoices.amount} - ${invoices.amountPaid} ELSE 0 END), 0)`,
      overdueAmount: sql<number>`COALESCE(SUM(CASE WHEN LOWER(${invoices.status}) NOT IN ${sql.raw(EXCLUDED_STATUSES)} AND ${invoices.dueDate} < CURRENT_DATE THEN ${invoices.amount} - ${invoices.amountPaid} ELSE 0 END), 0)`,
    })
    .from(contacts)
    .leftJoin(
      invoices,
      and(eq(invoices.contactId, contacts.id), eq(invoices.tenantId, tenantId)),
    )
    .where(and(
      eq(contacts.tenantId, tenantId),
      eq(contacts.isActive, true),
      isNotNull(contacts.xeroContactId),
    ))
    .groupBy(contacts.id)
    .having(
      sql`SUM(CASE WHEN LOWER(${invoices.status}) NOT IN ${sql.raw(EXCLUDED_STATUSES)} THEN ${invoices.amount} - ${invoices.amountPaid} ELSE 0 END) > 0`,
    );

  // 2. Fetch all AUTHORISED credits
  const [allOps, allPps, allCns] = await Promise.all([
    db.select({ xeroContactId: cachedXeroOverpayments.xeroContactId, remainingCredit: cachedXeroOverpayments.remainingCredit })
      .from(cachedXeroOverpayments)
      .where(and(eq(cachedXeroOverpayments.tenantId, tenantId), eq(cachedXeroOverpayments.status, "AUTHORISED"))),
    db.select({ xeroContactId: cachedXeroPrepayments.xeroContactId, remainingCredit: cachedXeroPrepayments.remainingCredit })
      .from(cachedXeroPrepayments)
      .where(and(eq(cachedXeroPrepayments.tenantId, tenantId), eq(cachedXeroPrepayments.status, "AUTHORISED"))),
    db.select({ xeroContactId: cachedXeroCreditNotes.xeroContactId, remainingCredit: cachedXeroCreditNotes.remainingCredit })
      .from(cachedXeroCreditNotes)
      .where(and(eq(cachedXeroCreditNotes.tenantId, tenantId), eq(cachedXeroCreditNotes.status, "AUTHORISED"))),
  ]);

  // 3. Map xeroContactId → internal contactId
  const contactXeroIds = await db
    .select({ id: contacts.id, xeroContactId: contacts.xeroContactId })
    .from(contacts)
    .where(eq(contacts.tenantId, tenantId));

  const xeroToContactId = new Map<string, string>();
  for (const c of contactXeroIds) {
    if (c.xeroContactId) xeroToContactId.set(c.xeroContactId, c.id);
  }

  // 4. Build credits by internal contactId
  const creditsByContactId = new Map<string, number>();
  let unmatchedCredits = 0;
  for (const r of [...allOps, ...allPps, ...allCns]) {
    const rem = parseFloat(r.remainingCredit || "0");
    if (rem <= 0) continue;
    const contactId = r.xeroContactId ? xeroToContactId.get(r.xeroContactId) : undefined;
    if (contactId) {
      creditsByContactId.set(contactId, (creditsByContactId.get(contactId) || 0) + rem);
    } else {
      unmatchedCredits += rem;
    }
  }

  // 5. Net per-contact and sum
  // Include ALL net values (positive AND negative) in totalOutstanding
  // so that credit-heavy contacts reduce the total. Only count debtorCount
  // for contacts with net > 0.
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let debtorCount = 0;
  const consumedContactIds = new Set<string>();

  for (const d of debtorRows) {
    const credit = creditsByContactId.get(d.contactId) || 0;
    consumedContactIds.add(d.contactId);
    const netOutstanding = Math.round((Number(d.totalOutstanding || 0) - credit) * 100) / 100;
    const netOverdue = Math.round(Math.max(0, Number(d.overdueAmount || 0) - credit) * 100) / 100;

    // Always include in total (negative values reduce it)
    totalOutstanding += netOutstanding;
    if (netOutstanding > 0) {
      totalOverdue += netOverdue;
      debtorCount++;
    }
  }

  // Subtract credits for contacts not in debtorRows (credit-only contacts)
  for (const [contactId, credit] of creditsByContactId) {
    if (!consumedContactIds.has(contactId)) {
      totalOutstanding -= credit;
    }
  }

  // Subtract unmatched credits from total
  totalOutstanding = Math.round((totalOutstanding - unmatchedCredits) * 100) / 100;

  // 6. DSO — average days to pay for invoices paid in last 90 days
  // Exclude contacts without xero_contact_id (test/seed data)
  const dsoResult = await db.execute(sql`
    SELECT COALESCE(AVG(EXTRACT(DAY FROM AGE(i.paid_date, i.issue_date))), 0) as dso
    FROM invoices i
    JOIN contacts c ON c.id = i.contact_id
    WHERE i.tenant_id = ${tenantId}
      AND c.xero_contact_id IS NOT NULL
      AND i.status = 'paid'
      AND i.paid_date >= NOW() - INTERVAL '90 days'
  `);
  const dsoRow = (dsoResult as any).rows?.[0] || (dsoResult as any)[0] || {};
  const currentDSO = Math.round(Number(dsoRow.dso || 0));

  return {
    totalOutstanding: Math.round(Math.max(0, totalOutstanding) * 100) / 100,
    totalOverdue: Math.round(Math.max(0, totalOverdue) * 100) / 100,
    debtorCount,
    currentDSO,
  };
}

/**
 * Per-contact AR summary — mirrors getARSummary() logic for a single contact.
 *
 * Uses the same EXCLUDED_STATUSES filter and per-contact credit netting
 * (overpayments + prepayments + credit notes) as the aggregate summary, so
 * debtor detail totals match the debtors list and Xero AR exactly.
 */
export async function getContactARSummary(
  tenantId: string,
  contactId: string,
): Promise<{ totalOutstanding: number; totalOverdue: number }> {
  // 1. Sum invoices for this contact using the canonical status filter.
  const [invRow] = await db
    .select({
      outstanding: sql<number>`COALESCE(SUM(CASE WHEN LOWER(${invoices.status}) NOT IN ${sql.raw(EXCLUDED_STATUSES)} THEN ${invoices.amount} - ${invoices.amountPaid} ELSE 0 END), 0)`,
      overdue: sql<number>`COALESCE(SUM(CASE WHEN LOWER(${invoices.status}) NOT IN ${sql.raw(EXCLUDED_STATUSES)} AND ${invoices.dueDate} < CURRENT_DATE THEN ${invoices.amount} - ${invoices.amountPaid} ELSE 0 END), 0)`,
    })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.contactId, contactId)));

  const grossOutstanding = Number(invRow?.outstanding || 0);
  const grossOverdue = Number(invRow?.overdue || 0);

  // 2. Look up the contact's xeroContactId to fetch matching credits.
  const [contactRow] = await db
    .select({ xeroContactId: contacts.xeroContactId })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
    .limit(1);

  let credit = 0;
  if (contactRow?.xeroContactId) {
    const [opRow, ppRow, cnRow] = await Promise.all([
      db.select({ total: sql<number>`COALESCE(SUM(${cachedXeroOverpayments.remainingCredit}::numeric), 0)` })
        .from(cachedXeroOverpayments)
        .where(and(
          eq(cachedXeroOverpayments.tenantId, tenantId),
          eq(cachedXeroOverpayments.xeroContactId, contactRow.xeroContactId),
          eq(cachedXeroOverpayments.status, "AUTHORISED"),
        )),
      db.select({ total: sql<number>`COALESCE(SUM(${cachedXeroPrepayments.remainingCredit}::numeric), 0)` })
        .from(cachedXeroPrepayments)
        .where(and(
          eq(cachedXeroPrepayments.tenantId, tenantId),
          eq(cachedXeroPrepayments.xeroContactId, contactRow.xeroContactId),
          eq(cachedXeroPrepayments.status, "AUTHORISED"),
        )),
      db.select({ total: sql<number>`COALESCE(SUM(${cachedXeroCreditNotes.remainingCredit}::numeric), 0)` })
        .from(cachedXeroCreditNotes)
        .where(and(
          eq(cachedXeroCreditNotes.tenantId, tenantId),
          eq(cachedXeroCreditNotes.xeroContactId, contactRow.xeroContactId),
          eq(cachedXeroCreditNotes.status, "AUTHORISED"),
        )),
    ]);
    credit = Number(opRow[0]?.total || 0) + Number(ppRow[0]?.total || 0) + Number(cnRow[0]?.total || 0);
  }

  const totalOutstanding = Math.max(0, Math.round((grossOutstanding - credit) * 100) / 100);
  const totalOverdue = Math.max(0, Math.round((grossOverdue - credit) * 100) / 100);

  return { totalOutstanding, totalOverdue };
}

/**
 * Rolling 30-day DSO — average of daily snapshots over the last 30 days.
 * Falls back to getARSummary().currentDSO if no snapshots exist.
 */
export async function getRolling30DayDSO(tenantId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db
    .select({
      avgDSO: sql<number>`COALESCE(AVG(${dsoSnapshots.dsoValue}::numeric), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(dsoSnapshots)
    .where(
      and(
        eq(dsoSnapshots.tenantId, tenantId),
        gte(dsoSnapshots.snapshotDate, thirtyDaysAgo),
      ),
    );

  const row = result[0];
  if (row && Number(row.count) > 0) {
    return Math.round(Number(row.avgDSO));
  }

  // Fallback to current DSO from AR summary
  const summary = await getARSummary(tenantId);
  return summary.currentDSO;
}

/**
 * Per-contact effective overdue: gross overdue from invoices minus any
 * unallocated payments that haven't been reconciled by Xero yet.
 *
 * Used by the planner (Gate 2 — "zero or negative net = full stop") and
 * by the email pipeline (R1 — chase the NET amount, not the gross).
 */
export async function getEffectiveOverdue(
  tenantId: string,
  contactId: string,
): Promise<{
  xeroOverdue: number;
  unallocatedTotal: number;
  effectiveOverdue: number;
  hasUnallocatedPayments: boolean;
}> {
  // 1. Sum of (amount - amountPaid) across overdue invoices for this contact.
  //    Mirrors the excluded-status set from getARSummary.
  const [invRow] = await db
    .select({
      overdue: sql<number>`COALESCE(SUM(CASE WHEN LOWER(${invoices.status}) NOT IN ${sql.raw(EXCLUDED_STATUSES)} AND ${invoices.dueDate} < CURRENT_DATE THEN ${invoices.amount} - ${invoices.amountPaid} ELSE 0 END), 0)`,
    })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.contactId, contactId)));

  const xeroOverdue = Math.round(Number(invRow?.overdue || 0) * 100) / 100;

  // 2. Sum remainingAmount across live unallocated rows.
  const [unRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${unallocatedPayments.remainingAmount}::numeric), 0)`,
    })
    .from(unallocatedPayments)
    .where(
      and(
        eq(unallocatedPayments.tenantId, tenantId),
        eq(unallocatedPayments.contactId, contactId),
        inArray(unallocatedPayments.status, ["unallocated", "partially_allocated"]),
      ),
    );

  const unallocatedTotal = Math.round(Number(unRow?.total || 0) * 100) / 100;

  const effectiveOverdue = Math.max(0, Math.round((xeroOverdue - unallocatedTotal) * 100) / 100);

  return {
    xeroOverdue,
    unallocatedTotal,
    effectiveOverdue,
    hasUnallocatedPayments: unallocatedTotal > 0,
  };
}
