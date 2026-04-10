/**
 * Recurring Revenue Service — Phase 2 (Layer 2)
 *
 * Detects recurring invoicing patterns per debtor, manages user validation,
 * and provides confirmed patterns for the forecast engine.
 *
 * Pattern detection algorithm (per spec Section 2.2):
 * 1. Sort invoices by date, calculate gaps
 * 2. Detect frequency from mean gap
 * 3. Check amount consistency (CV)
 * 4. Check recency (is pattern still active?)
 * 5. Upsert to recurringRevenuePatterns table
 */

import { db } from "../db";
import {
  invoices,
  contacts,
  recurringRevenuePatterns,
} from "@shared/schema";
import { eq, and, sql, isNotNull } from "drizzle-orm";
import { invalidateForecastCache } from "./cashflowForecastService";

// ── Types ─────────────────────────────────────────────────────

export interface RecurringPattern {
  id: string;
  contactId: string;
  contactName: string;
  frequency: string;
  averageAmount: number;
  amountVariance: number;
  invoiceCount: number;
  firstInvoiceDate: Date | null;
  lastInvoiceDate: Date | null;
  nextExpectedDate: Date | null;
  status: string;
  confidence: string;
  validatedByUser: boolean;
  validatedAt: Date | null;
  validatedBy: string | null;
  rejectedReason: string | null;
  breakCount: number;
}

// ── Constants ─────────────────────────────────────────────────

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 90,
};

const FREQUENCY_RANGES: { name: string; min: number; max: number }[] = [
  { name: "weekly", min: 5, max: 9 },
  { name: "fortnightly", min: 12, max: 16 },
  { name: "monthly", min: 26, max: 35 },
  { name: "quarterly", min: 80, max: 100 },
];

// ── Pattern Detection ─────────────────────────────────────────

export async function detectRecurringPatterns(
  tenantId: string,
): Promise<RecurringPattern[]> {
  console.log(`[Recurring] Starting pattern detection for tenant ${tenantId}`);

  // Fetch all invoices grouped by contact (both paid and outstanding)
  const allInvoices = await db
    .select({
      contactId: invoices.contactId,
      contactName: contacts.name,
      amount: invoices.amount,
      issueDate: invoices.issueDate,
    })
    .from(invoices)
    .innerJoin(contacts, eq(contacts.id, invoices.contactId))
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        isNotNull(invoices.issueDate),
        sql`LOWER(${invoices.status}) NOT IN ('void', 'voided', 'deleted', 'draft')`,
      ),
    )
    .orderBy(invoices.contactId, invoices.issueDate);

  // Group by contact
  const byContact = new Map<
    string,
    { contactName: string; invoices: { amount: number; issueDate: Date }[] }
  >();

  for (const inv of allInvoices) {
    if (!inv.issueDate) continue;
    const existing = byContact.get(inv.contactId);
    const entry = {
      amount: Number(inv.amount),
      issueDate: new Date(inv.issueDate),
    };
    if (existing) {
      existing.invoices.push(entry);
    } else {
      byContact.set(inv.contactId, {
        contactName: inv.contactName,
        invoices: [entry],
      });
    }
  }

  // Load existing patterns to preserve confirmed/rejected status
  const existingPatterns = await db
    .select()
    .from(recurringRevenuePatterns)
    .where(eq(recurringRevenuePatterns.tenantId, tenantId));

  const existingByContact = new Map<string, typeof existingPatterns[0]>();
  for (const p of existingPatterns) {
    existingByContact.set(p.contactId, p);
  }

  const detected: RecurringPattern[] = [];
  const now = new Date();

  for (const [contactId, data] of Array.from(byContact)) {
    const invs = data.invoices;

    // Need 3+ invoices to detect a pattern
    if (invs.length < 3) continue;

    // Sort by issue date
    invs.sort(
      (a: { issueDate: Date }, b: { issueDate: Date }) =>
        a.issueDate.getTime() - b.issueDate.getTime(),
    );

    // Calculate gaps between consecutive invoices (in days)
    const gaps: number[] = [];
    for (let i = 1; i < invs.length; i++) {
      const gap = Math.round(
        (invs[i].issueDate.getTime() - invs[i - 1].issueDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (gap > 0) gaps.push(gap);
    }

    if (gaps.length < 2) continue;

    // Mean gap
    const meanGap =
      gaps.reduce((a: number, b: number) => a + b, 0) / gaps.length;

    // Detect frequency
    const freq = FREQUENCY_RANGES.find(
      (f) => meanGap >= f.min && meanGap <= f.max,
    );
    if (!freq) continue; // Not a recognised frequency

    // Amount consistency (coefficient of variation)
    const amounts = invs.map((i: { amount: number }) => i.amount);
    const meanAmount =
      amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
    if (meanAmount <= 0) continue;

    const variance =
      amounts.reduce(
        (sum: number, a: number) => sum + (a - meanAmount) ** 2,
        0,
      ) / amounts.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / meanAmount;

    if (cv > 0.4) continue; // Too variable to be recurring

    const confidence: "high" | "medium" | "low" =
      cv < 0.15 ? "high" : "medium";

    // Recency check
    const lastInvoice = invs[invs.length - 1];
    const daysSinceLast = Math.round(
      (now.getTime() - lastInvoice.issueDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const frequencyDays = FREQUENCY_DAYS[freq.name];
    const isLapsed = daysSinceLast > frequencyDays * 2;
    const isActive = daysSinceLast <= frequencyDays * 1.5;

    // Calculate next expected date
    const nextExpectedDate = new Date(lastInvoice.issueDate);
    nextExpectedDate.setDate(
      nextExpectedDate.getDate() + frequencyDays,
    );
    // If next expected is in the past, advance to the next future occurrence
    while (nextExpectedDate < now) {
      nextExpectedDate.setDate(nextExpectedDate.getDate() + frequencyDays);
    }

    const existing = existingByContact.get(contactId);

    // Don't recreate rejected patterns
    if (existing?.status === "rejected") continue;

    // Determine status
    let status: string;
    if (existing?.status === "confirmed") {
      status = isLapsed ? "lapsed" : "confirmed";
    } else {
      status = isLapsed ? "lapsed" : "detected";
    }

    const patternData = {
      tenantId,
      contactId,
      frequency: freq.name,
      averageAmount: String(Math.round(meanAmount * 100) / 100),
      amountVariance: String(Math.round(cv * 10000) / 10000),
      invoiceCount: invs.length,
      firstInvoiceDate: invs[0].issueDate,
      lastInvoiceDate: lastInvoice.issueDate,
      nextExpectedDate,
      status,
      confidence,
      lastCheckedAt: now,
      updatedAt: now,
      // Preserve validation fields for confirmed patterns
      ...(existing?.status === "confirmed"
        ? {
            validatedByUser: existing.validatedByUser,
            validatedAt: existing.validatedAt,
            validatedBy: existing.validatedBy,
          }
        : {}),
    };

    if (existing) {
      // Update existing pattern
      await db
        .update(recurringRevenuePatterns)
        .set(patternData)
        .where(eq(recurringRevenuePatterns.id, existing.id));
    } else {
      // Insert new pattern
      await db.insert(recurringRevenuePatterns).values({
        ...patternData,
        createdAt: now,
      });
    }

    detected.push({
      id: existing?.id || "",
      contactId,
      contactName: data.contactName,
      frequency: freq.name,
      averageAmount: Math.round(meanAmount * 100) / 100,
      amountVariance: Math.round(cv * 10000) / 10000,
      invoiceCount: invs.length,
      firstInvoiceDate: invs[0].issueDate,
      lastInvoiceDate: lastInvoice.issueDate,
      nextExpectedDate,
      status,
      confidence,
      validatedByUser: existing?.validatedByUser ?? false,
      validatedAt: existing?.validatedAt ?? null,
      validatedBy: existing?.validatedBy ?? null,
      rejectedReason: null,
      breakCount: existing?.breakCount ?? 0,
    });
  }

  console.log(
    `[Recurring] Detected ${detected.length} patterns for tenant ${tenantId}`,
  );
  return detected;
}

// ── Get Confirmed Patterns ────────────────────────────────────

export async function getConfirmedPatterns(
  tenantId: string,
): Promise<RecurringPattern[]> {
  const rows = await db
    .select({
      id: recurringRevenuePatterns.id,
      contactId: recurringRevenuePatterns.contactId,
      contactName: contacts.name,
      frequency: recurringRevenuePatterns.frequency,
      averageAmount: recurringRevenuePatterns.averageAmount,
      amountVariance: recurringRevenuePatterns.amountVariance,
      invoiceCount: recurringRevenuePatterns.invoiceCount,
      firstInvoiceDate: recurringRevenuePatterns.firstInvoiceDate,
      lastInvoiceDate: recurringRevenuePatterns.lastInvoiceDate,
      nextExpectedDate: recurringRevenuePatterns.nextExpectedDate,
      status: recurringRevenuePatterns.status,
      confidence: recurringRevenuePatterns.confidence,
      validatedByUser: recurringRevenuePatterns.validatedByUser,
      validatedAt: recurringRevenuePatterns.validatedAt,
      validatedBy: recurringRevenuePatterns.validatedBy,
      rejectedReason: recurringRevenuePatterns.rejectedReason,
      breakCount: recurringRevenuePatterns.breakCount,
    })
    .from(recurringRevenuePatterns)
    .innerJoin(contacts, eq(contacts.id, recurringRevenuePatterns.contactId))
    .where(
      and(
        eq(recurringRevenuePatterns.tenantId, tenantId),
        eq(recurringRevenuePatterns.status, "confirmed"),
        eq(recurringRevenuePatterns.validatedByUser, true),
      ),
    );

  return rows.map((r) => ({
    ...r,
    averageAmount: Number(r.averageAmount),
    amountVariance: Number(r.amountVariance || 0),
    validatedByUser: r.validatedByUser ?? false,
    breakCount: r.breakCount ?? 0,
  }));
}

// ── Get All Patterns (for API) ────────────────────────────────

export async function getAllPatterns(
  tenantId: string,
): Promise<RecurringPattern[]> {
  const rows = await db
    .select({
      id: recurringRevenuePatterns.id,
      contactId: recurringRevenuePatterns.contactId,
      contactName: contacts.name,
      frequency: recurringRevenuePatterns.frequency,
      averageAmount: recurringRevenuePatterns.averageAmount,
      amountVariance: recurringRevenuePatterns.amountVariance,
      invoiceCount: recurringRevenuePatterns.invoiceCount,
      firstInvoiceDate: recurringRevenuePatterns.firstInvoiceDate,
      lastInvoiceDate: recurringRevenuePatterns.lastInvoiceDate,
      nextExpectedDate: recurringRevenuePatterns.nextExpectedDate,
      status: recurringRevenuePatterns.status,
      confidence: recurringRevenuePatterns.confidence,
      validatedByUser: recurringRevenuePatterns.validatedByUser,
      validatedAt: recurringRevenuePatterns.validatedAt,
      validatedBy: recurringRevenuePatterns.validatedBy,
      rejectedReason: recurringRevenuePatterns.rejectedReason,
      breakCount: recurringRevenuePatterns.breakCount,
    })
    .from(recurringRevenuePatterns)
    .innerJoin(contacts, eq(contacts.id, recurringRevenuePatterns.contactId))
    .where(
      and(
        eq(recurringRevenuePatterns.tenantId, tenantId),
        sql`${recurringRevenuePatterns.status} != 'rejected'`,
      ),
    );

  return rows.map((r) => ({
    ...r,
    averageAmount: Number(r.averageAmount),
    amountVariance: Number(r.amountVariance || 0),
    validatedByUser: r.validatedByUser ?? false,
    breakCount: r.breakCount ?? 0,
  }));
}

// ── Validate Pattern ──────────────────────────────────────────

export async function validatePattern(
  tenantId: string,
  patternId: string,
  action: "confirm" | "reject",
  userId: string,
  reason?: string,
): Promise<void> {
  const now = new Date();

  if (action === "confirm") {
    await db
      .update(recurringRevenuePatterns)
      .set({
        status: "confirmed",
        validatedByUser: true,
        validatedAt: now,
        validatedBy: userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(recurringRevenuePatterns.id, patternId),
          eq(recurringRevenuePatterns.tenantId, tenantId),
        ),
      );
  } else {
    await db
      .update(recurringRevenuePatterns)
      .set({
        status: "rejected",
        validatedByUser: true,
        validatedAt: now,
        validatedBy: userId,
        rejectedReason: reason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(recurringRevenuePatterns.id, patternId),
          eq(recurringRevenuePatterns.tenantId, tenantId),
        ),
      );
  }

  // Invalidate forecast cache since recurring revenue affects projections
  invalidateForecastCache(tenantId);
}
