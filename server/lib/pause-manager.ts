/**
 * Pause Manager Service
 * 
 * Manages invoice pause states (disputes, promises to pay, payment plans)
 * that suspend collection activities while preserving workflow state.
 * 
 * Pause overlays are parallel to workflow states:
 * - workflowState: pre_due → due → late → resolved (never changes during pause)
 * - pauseState: null | dispute | ptp | payment_plan (overlay on top)
 * 
 * When paused:
 * - Adaptive scheduler skips invoice
 * - Communication automation suspended
 * - Timer-based exceptions still tracked
 * - Can be resumed manually or automatically on breach/resolution
 */

import { db } from "../db";
import { invoices } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface PauseInvoiceParams {
  invoiceId: string;
  tenantId: string;
  pauseType: 'dispute' | 'ptp' | 'payment_plan';
  reason: string;
  pausedUntil?: Date; // Expected end date for PTP/payment plans
  metadata?: Record<string, any>; // Additional pause data (dispute ID, promise details, etc.)
}

export interface ResumeInvoiceParams {
  invoiceId: string;
  tenantId: string;
  reason: string;
}

class PauseManagerClass {
  /**
   * Pause an invoice, suspending collection activities
   */
  async pauseInvoice({
    invoiceId,
    tenantId,
    pauseType,
    reason,
    pausedUntil,
    metadata = {}
  }: PauseInvoiceParams): Promise<void> {
    try {
      // Update invoice with pause state
      await db
        .update(invoices)
        .set({
          pauseState: pauseType,
          pausedAt: new Date(),
          pausedUntil: pausedUntil || null,
          pauseReason: reason,
          pauseMetadata: metadata,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoices.id, invoiceId),
            eq(invoices.tenantId, tenantId)
          )
        );

      console.log(`⏸️  Paused invoice ${invoiceId} (${pauseType}): ${reason}`);
    } catch (error) {
      console.error(`❌ Failed to pause invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  /**
   * Resume an invoice, allowing collection activities to continue
   */
  async resumeInvoice({
    invoiceId,
    tenantId,
    reason
  }: ResumeInvoiceParams): Promise<void> {
    try {
      // Clear pause state
      await db
        .update(invoices)
        .set({
          pauseState: null,
          pausedAt: null,
          pausedUntil: null,
          pauseReason: null,
          pauseMetadata: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoices.id, invoiceId),
            eq(invoices.tenantId, tenantId)
          )
        );

      console.log(`▶️  Resumed invoice ${invoiceId}: ${reason}`);
    } catch (error) {
      console.error(`❌ Failed to resume invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  /**
   * Check if an invoice is currently paused
   */
  async isPaused(invoiceId: string, tenantId: string): Promise<boolean> {
    const invoice = await db
      .select({ pauseState: invoices.pauseState })
      .from(invoices)
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.tenantId, tenantId)
        )
      )
      .limit(1);

    return invoice.length > 0 && invoice[0].pauseState !== null;
  }

  /**
   * Get pause details for an invoice
   */
  async getPauseDetails(invoiceId: string, tenantId: string) {
    const result = await db
      .select({
        pauseState: invoices.pauseState,
        pausedAt: invoices.pausedAt,
        pausedUntil: invoices.pausedUntil,
        pauseReason: invoices.pauseReason,
        pauseMetadata: invoices.pauseMetadata,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.tenantId, tenantId)
        )
      )
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Pause invoice due to dispute
   */
  async pauseForDispute(
    invoiceId: string,
    tenantId: string,
    disputeId: string,
    reason: string
  ): Promise<void> {
    await this.pauseInvoice({
      invoiceId,
      tenantId,
      pauseType: 'dispute',
      reason,
      metadata: { disputeId },
    });
  }

  /**
   * Pause invoice due to Promise to Pay
   */
  async pauseForPTP(
    invoiceId: string,
    tenantId: string,
    promiseDate: Date,
    promisedAmount: string,
    notes?: string
  ): Promise<void> {
    await this.pauseInvoice({
      invoiceId,
      tenantId,
      pauseType: 'ptp',
      reason: `Promise to Pay: ${promisedAmount} by ${promiseDate.toISOString().split('T')[0]}`,
      pausedUntil: promiseDate,
      metadata: {
        promiseDate: promiseDate.toISOString(),
        promisedAmount,
        notes,
      },
    });
  }

  /**
   * Pause invoice due to Payment Plan
   */
  async pauseForPaymentPlan(
    invoiceId: string,
    tenantId: string,
    paymentPlanId: string,
    planEndDate: Date
  ): Promise<void> {
    await this.pauseInvoice({
      invoiceId,
      tenantId,
      pauseType: 'payment_plan',
      reason: `On payment plan ${paymentPlanId}`,
      pausedUntil: planEndDate,
      metadata: { paymentPlanId },
    });
  }

  /**
   * Resume invoice after dispute resolution
   */
  async resumeFromDispute(
    invoiceId: string,
    tenantId: string,
    resolution: 'accepted' | 'rejected' | 'withdrawn'
  ): Promise<void> {
    await this.resumeInvoice({
      invoiceId,
      tenantId,
      reason: `Dispute ${resolution}`,
    });
  }

  /**
   * Resume invoice after PTP breach
   */
  async resumeFromPTPBreach(
    invoiceId: string,
    tenantId: string
  ): Promise<void> {
    await this.resumeInvoice({
      invoiceId,
      tenantId,
      reason: 'Promise to Pay breached',
    });
  }

  /**
   * Resume invoice after payment plan completion or default
   */
  async resumeFromPaymentPlan(
    invoiceId: string,
    tenantId: string,
    status: 'completed' | 'defaulted' | 'cancelled'
  ): Promise<void> {
    await this.resumeInvoice({
      invoiceId,
      tenantId,
      reason: `Payment plan ${status}`,
    });
  }

  /**
   * Check for expired pauses (PTP/payment plans past due date)
   * Returns array of invoice IDs that should be auto-resumed
   */
  async getExpiredPauses(tenantId: string): Promise<Array<{
    invoiceId: string;
    pauseType: string;
    pausedUntil: Date;
  }>> {
    const now = new Date();
    
    const expired = await db
      .select({
        invoiceId: invoices.id,
        pauseType: invoices.pauseState,
        pausedUntil: invoices.pausedUntil,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          // pauseState is not null
          sql`${invoices.pauseState} IS NOT NULL`,
          // pausedUntil is set and in the past
          sql`${invoices.pausedUntil} IS NOT NULL AND ${invoices.pausedUntil} < ${now}`
        )
      );

    return expired.map(e => ({
      invoiceId: e.invoiceId,
      pauseType: e.pauseType || '',
      pausedUntil: e.pausedUntil!,
    }));
  }
}

// Singleton instance
export const pauseManager = new PauseManagerClass();
export default pauseManager;
