/**
 * DSO (Days Sales Outstanding) Calculation Module
 * 
 * Calculates projected DSO for a tenant based on open invoices and payment behavior signals.
 * Used by the portfolio controller to adjust urgency factors.
 */

import { db } from "../db";
import { invoices, promisesToPay, actions, contacts } from "@shared/schema";
import { and, eq, isNotNull, isNull, or, gte, sql } from "drizzle-orm";

/**
 * Segment-based priors for expected payment days when signals are missing
 */
export const SEGMENT_PRIORS = {
  excellent: {
    baselineDays: 5, // Typically pays within a week of due date
    replyRate: 0.65,
    description: "Fast payers with strong engagement",
  },
  good: {
    baselineDays: 15, // Pays within 2 weeks of due date
    replyRate: 0.45,
    description: "Reliable payers with moderate engagement",
  },
  moderate: {
    baselineDays: 30, // Pays around 30 days after due date
    replyRate: 0.25,
    description: "Average payers requiring standard follow-up",
  },
  slow: {
    baselineDays: 60, // Takes 60+ days
    replyRate: 0.15,
    description: "Slow payers requiring intensive follow-up",
  },
  problem: {
    baselineDays: 90, // Very delayed
    replyRate: 0.08,
    description: "Problem accounts with poor payment history",
  },
};

export type SegmentPrior = keyof typeof SEGMENT_PRIORS;

/**
 * Calculate projected DSO for a tenant
 * 
 * Formula: Weighted average of expected payment days
 * DSO = SUM(invoice_amount * expected_days) / SUM(invoice_amount)
 * 
 * Expected days per invoice:
 * - If promise to pay exists: days from today to promised date
 * - If customer has payment history: use historical average
 * - Otherwise: use segment prior baseline
 */
export async function projectedDSO(tenantId: string): Promise<number> {
  try {
    // Get all open invoices (unpaid or partially paid)
    const openInvoices = await db
      .select({
        id: invoices.id,
        dueDate: invoices.dueDate,
        amount: invoices.amount,
        amountPaid: invoices.amountPaid,
        contactId: invoices.contactId,
        status: invoices.status,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          or(
            eq(invoices.status, "unpaid"),
            eq(invoices.status, "partially_paid")
          )
        )
      );

    if (openInvoices.length === 0) {
      return 0; // No open invoices, DSO is zero
    }

    // Get all promises to pay for these invoices
    const invoiceIds = openInvoices.map(inv => inv.id);
    const ptps = await db
      .select({
        invoiceId: promisesToPay.invoiceId,
        promisedDate: promisesToPay.promisedDate,
        status: promisesToPay.status,
      })
      .from(promisesToPay)
      .where(
        and(
          eq(promisesToPay.tenantId, tenantId),
          eq(promisesToPay.status, "active"),
          isNotNull(promisesToPay.promisedDate)
        )
      );

    // Map promises to invoices
    const ptpByInvoice = new Map<string, any>(
      ptps.map((ptp: any) => [ptp.invoiceId, ptp.promisedDate])
    );

    // Calculate expected days for each invoice
    let totalWeightedDays = 0;
    let totalAmount = 0;
    const today = new Date();

    for (const invoice of openInvoices) {
      // Calculate amount due: total amount - amount paid
      const amountDue = Number(invoice.amount || 0) - Number(invoice.amountPaid || 0);
      if (amountDue <= 0) continue;
      const amount = amountDue;

      let expectedDays: number;

      // Option 1: Active promise to pay exists
      if (ptpByInvoice.has(invoice.id)) {
        const promisedDate = ptpByInvoice.get(invoice.id) as Date | undefined;
        if (promisedDate) {
          const daysUntilPromise = Math.ceil(
            (new Date(promisedDate as any).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          expectedDays = Math.max(0, daysUntilPromise); // Can't be negative
        } else {
          expectedDays = SEGMENT_PRIORS.moderate.baselineDays;
        }
      }
      // Option 2: Use segment prior (simplified - in production would check contact's payment history)
      else {
        // For MVP, use moderate segment as default
        // In production, would join with contacts table and check riskBand or payment history
        expectedDays = SEGMENT_PRIORS.moderate.baselineDays;
      }

      totalWeightedDays += amount * expectedDays;
      totalAmount += amount;
    }

    if (totalAmount === 0) {
      return 0;
    }

    const dso = totalWeightedDays / totalAmount;
    return Math.round(dso * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error("[DSO] Error calculating projected DSO:", error);
    return 0; // Fail gracefully
  }
}

/**
 * Get DSO calculation metadata for debugging and observability
 */
export async function getDSOMetadata(tenantId: string) {
  try {
    const openInvoices = await db
      .select({
        id: invoices.id,
        amount: invoices.amount,
        amountPaid: invoices.amountPaid,
        dueDate: invoices.dueDate,
        status: invoices.status,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          or(
            eq(invoices.status, "unpaid"),
            eq(invoices.status, "partially_paid")
          )
        )
      );

    const totalValue = openInvoices.reduce(
      (sum: number, inv: any) => {
        const amountDue = Number(inv.amount || 0) - Number(inv.amountPaid || 0);
        return sum + amountDue;
      },
      0
    );

    const today = new Date();
    const totalDaysOverdue = openInvoices.reduce((sum: number, inv: any) => {
      if (!inv.dueDate) return sum;
      const daysOverdue = Math.ceil(
        (today.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + Math.max(0, daysOverdue);
    }, 0);

    const avgDaysOverdue = openInvoices.length > 0
      ? Math.round(totalDaysOverdue / openInvoices.length)
      : 0;

    return {
      openInvoices: openInvoices.length,
      totalValue: Math.round(totalValue * 100) / 100,
      avgDaysOverdue,
    };
  } catch (error) {
    console.error("[DSO] Error getting DSO metadata:", error);
    return {
      openInvoices: 0,
      totalValue: 0,
      avgDaysOverdue: 0,
    };
  }
}
