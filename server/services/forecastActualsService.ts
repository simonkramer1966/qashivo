/**
 * Forecast Actuals Service — Phase 5 (Rolling Window + Accuracy Tracking)
 *
 * Captures actual collections and invoices raised for a given week,
 * stored as draft snapshots that are finalised when the user closes the week.
 * Runs non-blocking after each sync to keep actuals ready for review.
 */

import { db } from "../db";
import {
  invoices,
  contacts,
  forecastSnapshots,
  forecastOutflows,
  tenants,
} from "@shared/schema";
import { eq, and, sql, between } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────

export interface DebtorCollection {
  contactId: string;
  contactName: string;
  amount: number;
  invoiceCount: number;
}

export interface WeekActuals {
  weekStarting: Date;
  weekEnding: Date;
  actualCollections: number;
  actualInvoicesRaised: number;
  actualOutflows: number;
  collectionsByDebtor: DebtorCollection[];
}

// ── Helpers ─────────────────────────────────────────────────

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSundayOfWeek(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ── Main function ──────────────────────────────────────────

export async function captureWeekActuals(
  tenantId: string,
  weekStarting: Date,
): Promise<WeekActuals> {
  const weekStart = getMondayOfWeek(weekStarting);
  const weekEnd = getSundayOfWeek(weekStart);

  // Parallel queries for collections, new invoices, and outflows
  const [collectionsResult, invoicesRaisedResult, outflowResult] = await Promise.all([
    // AR collections: invoices paid during this week, grouped by debtor
    db
      .select({
        contactId: invoices.contactId,
        contactName: contacts.name,
        totalPaid: sql<string>`COALESCE(SUM(CAST(${invoices.amountPaid} AS numeric)), 0)`,
        invoiceCount: sql<number>`COUNT(*)`,
      })
      .from(invoices)
      .innerJoin(contacts, eq(contacts.id, invoices.contactId))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.paidDate} >= ${weekStart}`,
          sql`${invoices.paidDate} <= ${weekEnd}`,
        ),
      )
      .groupBy(invoices.contactId, contacts.name),

    // New invoices raised during this week
    db
      .select({
        totalAmount: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS numeric)), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.issueDate} >= ${weekStart}`,
          sql`${invoices.issueDate} <= ${weekEnd}`,
        ),
      ),

    // Outflows for this week (from forecastOutflows)
    db
      .select({
        totalOutflows: sql<string>`COALESCE(SUM(CAST(${forecastOutflows.amount} AS numeric)), 0)`,
      })
      .from(forecastOutflows)
      .where(
        and(
          eq(forecastOutflows.tenantId, tenantId),
          sql`${forecastOutflows.weekStarting} >= ${weekStart}`,
          sql`${forecastOutflows.weekStarting} <= ${weekEnd}`,
        ),
      ),
  ]);

  const collectionsByDebtor: DebtorCollection[] = collectionsResult.map((r) => ({
    contactId: r.contactId,
    contactName: r.contactName || "Unknown",
    amount: Number(r.totalPaid) || 0,
    invoiceCount: Number(r.invoiceCount) || 0,
  }));

  const actualCollections = collectionsByDebtor.reduce((sum, d) => sum + d.amount, 0);
  const actualInvoicesRaised = Number(invoicesRaisedResult[0]?.totalAmount) || 0;
  const actualOutflows = Number(outflowResult[0]?.totalOutflows) || 0;

  const actuals: WeekActuals = {
    weekStarting: weekStart,
    weekEnding: weekEnd,
    actualCollections: Math.round(actualCollections * 100) / 100,
    actualInvoicesRaised: Math.round(actualInvoicesRaised * 100) / 100,
    actualOutflows: Math.round(actualOutflows * 100) / 100,
    collectionsByDebtor,
  };

  // Upsert draft snapshot (isCompleted = false)
  // Check for existing draft
  const [existing] = await db
    .select({ id: forecastSnapshots.id, isCompleted: forecastSnapshots.isCompleted })
    .from(forecastSnapshots)
    .where(
      and(
        eq(forecastSnapshots.tenantId, tenantId),
        sql`DATE(${forecastSnapshots.weekStarting}) = DATE(${weekStart})`,
      ),
    )
    .limit(1);

  if (existing?.isCompleted) {
    // Week already closed — don't overwrite
    return actuals;
  }

  // Get opening balance from tenant
  const [tenant] = await db
    .select({ forecastOpeningBalance: tenants.forecastOpeningBalance })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  const openingBalance = tenant?.forecastOpeningBalance ? Number(tenant.forecastOpeningBalance) : 0;

  if (existing) {
    // Update draft
    await db
      .update(forecastSnapshots)
      .set({
        actualCollections: String(actuals.actualCollections),
        actualInvoicesRaised: String(actuals.actualInvoicesRaised),
        actualOutflows: String(actuals.actualOutflows),
        openingBalance: String(openingBalance),
        updatedAt: new Date(),
      })
      .where(eq(forecastSnapshots.id, existing.id));
  } else {
    // Insert new draft
    await db.insert(forecastSnapshots).values({
      tenantId,
      weekStarting: weekStart,
      snapshotDate: weekStart,
      actualCollections: String(actuals.actualCollections),
      actualInvoicesRaised: String(actuals.actualInvoicesRaised),
      actualOutflows: String(actuals.actualOutflows),
      openingBalance: String(openingBalance),
      isCompleted: false,
    });
  }

  console.log(
    `[ForecastActuals] Captured actuals for tenant ${tenantId}, w/c ${weekStart.toISOString().slice(0, 10)}: ` +
    `collections £${actuals.actualCollections}, invoices raised £${actuals.actualInvoicesRaised}`,
  );

  return actuals;
}

// ── Variance Drivers ───────────────────────────────────────

export interface VarianceDriver {
  debtor: string;
  contactId: string;
  expected: number;
  actual: number;
  delta: number;
  reason: string;
}

export function generateVarianceDrivers(
  forecastByDebtor: Map<string, { name: string; amount: number }>,
  actualCollections: DebtorCollection[],
): VarianceDriver[] {
  const drivers: VarianceDriver[] = [];
  const actualMap = new Map<string, DebtorCollection>();
  for (const a of actualCollections) {
    actualMap.set(a.contactId, a);
  }

  // Check forecast debtors against actuals
  for (const [contactId, forecast] of forecastByDebtor) {
    const actual = actualMap.get(contactId);
    const actualAmt = actual?.amount ?? 0;
    const delta = actualAmt - forecast.amount;

    if (Math.abs(delta) > 100) {
      let reason: string;
      if (actualAmt > forecast.amount) {
        reason = "Paid early or more than expected";
      } else if (actualAmt > 0) {
        reason = "Partial payment — delayed";
      } else {
        reason = "No payment received";
      }

      drivers.push({
        debtor: forecast.name,
        contactId,
        expected: Math.round(forecast.amount * 100) / 100,
        actual: Math.round(actualAmt * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        reason,
      });
    }
  }

  // Check for unexpected payments (actual but not in forecast)
  for (const actual of actualCollections) {
    if (!forecastByDebtor.has(actual.contactId) && actual.amount > 100) {
      drivers.push({
        debtor: actual.contactName,
        contactId: actual.contactId,
        expected: 0,
        actual: Math.round(actual.amount * 100) / 100,
        delta: Math.round(actual.amount * 100) / 100,
        reason: "Unexpected payment",
      });
    }
  }

  // Sort by absolute delta descending
  drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return drivers;
}
