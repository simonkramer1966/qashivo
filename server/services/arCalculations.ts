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
import { eq, and, sql } from "drizzle-orm";
import {
  invoices,
  contacts,
  cachedXeroOverpayments,
  cachedXeroPrepayments,
  cachedXeroCreditNotes,
} from "@shared/schema";

export interface ARSummary {
  totalOutstanding: number;
  totalOverdue: number;
  debtorCount: number;
  currentDSO: number;
}

const EXCLUDED_STATUSES = "('paid', 'void', 'voided', 'deleted', 'draft')";

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
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.isActive, true)))
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
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let debtorCount = 0;

  for (const d of debtorRows) {
    const credit = creditsByContactId.get(d.contactId) || 0;
    const netOutstanding = Math.round((Number(d.totalOutstanding || 0) - credit) * 100) / 100;
    const netOverdue = Math.round(Math.max(0, Number(d.overdueAmount || 0) - credit) * 100) / 100;

    if (netOutstanding > 0) {
      totalOutstanding += netOutstanding;
      totalOverdue += netOverdue;
      debtorCount++;
    }
  }

  // Subtract unmatched credits from total
  totalOutstanding = Math.round((totalOutstanding - unmatchedCredits) * 100) / 100;

  // 6. DSO — average days to pay for invoices paid in last 90 days
  const dsoResult = await db.execute(sql`
    SELECT COALESCE(AVG(EXTRACT(DAY FROM AGE(paid_date, issue_date))), 0) as dso
    FROM invoices
    WHERE tenant_id = ${tenantId}
      AND status = 'paid'
      AND paid_date >= NOW() - INTERVAL '90 days'
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
