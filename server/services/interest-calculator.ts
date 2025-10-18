import { storage } from "../storage";
import type { Invoice, Dispute, InsertInterestLedger, InterestLedger } from "@shared/schema";

/**
 * Interest Calculator Service
 * Handles statutory interest calculations on overdue invoices per UK Late Payment Act
 * Base rate (Bank of England) + 8% statutory uplift
 */

export interface InterestCalculationResult {
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  daysOverdue: number;
  effectiveRate: number;
}

export class InterestCalculator {
  /**
   * Calculate daily interest amount
   * Formula: (Principal × Annual Rate) / 365
   */
  static calculateDailyInterest(principal: number, annualRatePercent: number): number {
    return (principal * (annualRatePercent / 100)) / 365;
  }

  /**
   * Calculate total interest accrued for an invoice
   * Respects dispute periods (interest pauses during active disputes)
   * Uses ledger period start dates to properly handle partial payments
   */
  static async calculateInvoiceInterest(
    invoice: Invoice,
    disputes: Dispute[] = [],
    ledgerEntry?: InterestLedger
  ): Promise<InterestCalculationResult> {
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    
    // Determine the start date for interest calculation
    // If there's a ledger entry, use its start date (accounts for partial payments)
    // Otherwise, use the invoice due date
    const startDate = ledgerEntry ? new Date(ledgerEntry.startDate) : dueDate;
    
    // No interest if not overdue from start date
    if (now <= startDate) {
      return {
        principalAmount: parseFloat(invoice.amount),
        interestAmount: 0,
        totalAmount: parseFloat(invoice.amount),
        daysOverdue: 0,
        effectiveRate: 0,
      };
    }

    // Calculate days overdue (excluding dispute periods) from the correct start date
    const daysOverdue = this.calculateChargeableDays(startDate, now, disputes);
    
    // Get interest rate (base rate + statutory uplift)
    const baseRate = parseFloat(invoice.baseRateAnnual || "0.5"); // Default to 0.5% if not set
    const statutoryUplift = parseFloat(invoice.statutoryUpliftPct || "8"); // Default to 8%
    const effectiveRate = baseRate + statutoryUplift;

    // Use principal from ledger entry if available, otherwise calculate from invoice
    const principal = ledgerEntry 
      ? parseFloat(ledgerEntry.principal) 
      : parseFloat(invoice.amount) - parseFloat(invoice.amountPaid || "0");

    // Calculate total interest
    const dailyInterest = this.calculateDailyInterest(principal, effectiveRate);
    const interestAmount = dailyInterest * daysOverdue;

    return {
      principalAmount: principal,
      interestAmount: parseFloat(interestAmount.toFixed(2)),
      totalAmount: parseFloat((principal + interestAmount).toFixed(2)),
      daysOverdue,
      effectiveRate,
    };
  }

  /**
   * Calculate chargeable days (excluding dispute periods)
   * Interest pauses when a dispute is submitted and resumes after resolution
   * Properly handles overlapping dispute periods to avoid double-counting
   */
  private static calculateChargeableDays(
    dueDate: Date,
    currentDate: Date,
    disputes: Dispute[]
  ): number {
    const totalDays = Math.floor((currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // If no disputes, all days are chargeable
    if (!disputes || disputes.length === 0) {
      return totalDays;
    }

    // Normalize dispute periods to avoid overlaps
    interface DisputePeriod {
      start: Date;
      end: Date;
    }

    const periods: DisputePeriod[] = disputes
      .map(dispute => {
        const disputeStart = new Date(dispute.createdAt || new Date());
        const disputeEnd = dispute.respondedAt ? new Date(dispute.respondedAt) : currentDate;
        
        // Only include if it overlaps with overdue period
        const overlapStart = disputeStart > dueDate ? disputeStart : dueDate;
        const overlapEnd = disputeEnd < currentDate ? disputeEnd : currentDate;
        
        if (overlapStart < overlapEnd) {
          return { start: overlapStart, end: overlapEnd };
        }
        return null;
      })
      .filter((p): p is DisputePeriod => p !== null)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // Merge overlapping periods
    const merged: DisputePeriod[] = [];
    for (const period of periods) {
      if (merged.length === 0) {
        merged.push(period);
      } else {
        const last = merged[merged.length - 1];
        if (period.start <= last.end) {
          // Overlapping, extend the end
          last.end = new Date(Math.max(last.end.getTime(), period.end.getTime()));
        } else {
          // Non-overlapping, add new period
          merged.push(period);
        }
      }
    }

    // Calculate total dispute days from merged periods
    const disputeDays = merged.reduce((sum, period) => {
      const days = Math.floor((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);

    return Math.max(0, totalDays - disputeDays);
  }

  /**
   * Create or update interest ledger entry for an invoice
   * Tracks interest periods and handles dispute pausing
   */
  static async updateLedgerEntry(
    invoice: Invoice,
    disputes: Dispute[] = []
  ): Promise<InterestLedger> {
    const dueDate = new Date(invoice.dueDate);
    const principal = parseFloat(invoice.amount) - parseFloat(invoice.amountPaid || "0");
    const baseRate = parseFloat(invoice.baseRateAnnual || "0.5");
    const statutoryUplift = parseFloat(invoice.statutoryUpliftPct || "8");
    const effectiveRate = baseRate + statutoryUplift;

    // Check if we're currently in a dispute period
    const activeDispute = disputes.find(d => !d.respondedAt);
    const isPaused = !!activeDispute;
    
    // Get or create ledger entry
    const existingEntry = await storage.getLatestInterestLedgerForInvoice(invoice.id, invoice.tenantId);
    
    // Calculate accrued interest using the existing ledger entry (if available)
    const calculation = await this.calculateInvoiceInterest(invoice, disputes, existingEntry);

    if (existingEntry) {
      // Update existing entry
      return await storage.updateInterestLedgerEntry(existingEntry.id, invoice.tenantId, {
        endDate: new Date(),
        principal: principal.toString(),
        rateAnnual: effectiveRate.toString(),
        accruedAmount: calculation.interestAmount.toString(),
        isPaused,
        pausedReason: isPaused ? `Dispute ${activeDispute?.id}` : null,
        pausedAt: isPaused && !existingEntry.isPaused ? new Date() : existingEntry.pausedAt,
      });
    } else {
      // Create new entry
      const entry: InsertInterestLedger = {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        startDate: dueDate,
        endDate: new Date(),
        principal: principal.toString(),
        rateAnnual: effectiveRate.toString(),
        accruedAmount: calculation.interestAmount.toString(),
        isPaused,
        pausedReason: isPaused ? `Dispute ${activeDispute?.id}` : null,
        pausedAt: isPaused ? new Date() : null,
      };

      return await storage.createInterestLedgerEntry(entry);
    }
  }

  /**
   * Handle payment application - recalculate interest with new principal
   */
  static async handlePayment(
    invoice: Invoice,
    paymentAmount: number,
    paymentDate: Date
  ): Promise<void> {
    const newPrincipal = parseFloat(invoice.amount) - (parseFloat(invoice.amountPaid || "0") + paymentAmount);

    if (newPrincipal <= 0) {
      // Invoice fully paid - close the ledger entry
      const entry = await storage.getLatestInterestLedgerForInvoice(invoice.id, invoice.tenantId);
      if (entry) {
        await storage.updateInterestLedgerEntry(entry.id, invoice.tenantId, {
          endDate: paymentDate,
          principal: "0",
          pausedReason: "Invoice fully paid",
        });
      }
      return;
    }

    // Partial payment - create new ledger period with reduced principal
    const entry = await storage.getLatestInterestLedgerForInvoice(invoice.id, invoice.tenantId);
    if (entry) {
      // Close current period
      await storage.updateInterestLedgerEntry(entry.id, invoice.tenantId, {
        endDate: paymentDate,
      });

      // Start new period with reduced principal
      const baseRate = parseFloat(invoice.baseRateAnnual || "0.5");
      const statutoryUplift = parseFloat(invoice.statutoryUpliftPct || "8");
      const effectiveRate = baseRate + statutoryUplift;

      await storage.createInterestLedgerEntry({
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        startDate: paymentDate,
        principal: newPrincipal.toString(),
        rateAnnual: effectiveRate.toString(),
        accruedAmount: "0",
        isPaused: entry.isPaused,
        pausedReason: entry.pausedReason,
        pausedAt: entry.pausedAt,
      });
    }
  }

  /**
   * Get total accrued interest for an invoice
   */
  static async getTotalAccruedInterest(invoiceId: string, tenantId: string): Promise<number> {
    const entries = await storage.getInterestLedgerForInvoice(invoiceId, tenantId);
    const total = entries.reduce((sum, entry) => {
      return sum + parseFloat(entry.accruedAmount || "0");
    }, 0);
    return parseFloat(total.toFixed(2));
  }
}

export const interestCalculator = InterestCalculator;
