/**
 * Timer Service
 * 
 * Manages workflow timers for exception-based surfacing.
 * Creates timer-based alerts that notify credit controllers of time-sensitive events.
 * 
 * Timer Types:
 * - dispute_window_closing: T0+25 days (UK 30-day dispute window)
 * - broken_promise: PTP due date passed without payment
 * - high_risk_late: High-value + high-risk invoice late
 * - aging_threshold: Invoice aged beyond configured threshold
 */

import { db } from "../db";
import { workflowTimers, invoices, contacts, actions } from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { addDays } from "date-fns";

export type TimerType = 
  | 'dispute_window_closing' 
  | 'broken_promise' 
  | 'high_risk_late'
  | 'aging_threshold';

interface CreateTimerParams {
  tenantId: string;
  invoiceId: string;
  contactId: string;
  timerType: TimerType;
  triggerAt: Date;
  metadata?: Record<string, any>;
}

class TimerServiceClass {
  /**
   * Create a workflow timer
   */
  async createTimer({
    tenantId,
    invoiceId,
    contactId,
    timerType,
    triggerAt,
    metadata = {}
  }: CreateTimerParams): Promise<string> {
    try {
      const [timer] = await db
        .insert(workflowTimers)
        .values({
          tenantId,
          invoiceId,
          contactId,
          timerType,
          triggerAt,
          status: 'pending',
          metadata,
        })
        .returning({ id: workflowTimers.id });

      console.log(`⏰ Created ${timerType} timer for invoice ${invoiceId}, triggers at ${triggerAt.toISOString()}`);
      return timer.id;
    } catch (error) {
      console.error(`❌ Failed to create timer for invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel all timers for an invoice
   */
  async cancelTimersForInvoice(invoiceId: string): Promise<void> {
    await db
      .update(workflowTimers)
      .set({ 
        status: 'cancelled',
        processedAt: new Date(),
      })
      .where(
        and(
          eq(workflowTimers.invoiceId, invoiceId),
          eq(workflowTimers.status, 'pending')
        )
      );

    console.log(`🚫 Cancelled all pending timers for invoice ${invoiceId}`);
  }

  /**
   * Create dispute window closing timer for new invoices
   * Triggers at T0+25 days (5 days before 30-day UK dispute window closes)
   */
  async createDisputeWindowTimer(
    tenantId: string,
    invoiceId: string,
    contactId: string,
    issueDate: Date
  ): Promise<void> {
    // Timer fires at T0+25 (5 days before 30-day window closes)
    const triggerAt = addDays(issueDate, 25);

    await this.createTimer({
      tenantId,
      invoiceId,
      contactId,
      timerType: 'dispute_window_closing',
      triggerAt,
      metadata: {
        issueDate: issueDate.toISOString(),
        windowClosesAt: addDays(issueDate, 30).toISOString(),
      },
    });
  }

  /**
   * Create broken promise timer for PTP
   */
  async createBrokenPromiseTimer(
    tenantId: string,
    invoiceId: string,
    contactId: string,
    promiseDate: Date,
    promisedAmount: string
  ): Promise<void> {
    // Timer fires on the promise date
    const triggerAt = promiseDate;

    await this.createTimer({
      tenantId,
      invoiceId,
      contactId,
      timerType: 'broken_promise',
      triggerAt,
      metadata: {
        promiseDate: promiseDate.toISOString(),
        promisedAmount,
      },
    });
  }

  /**
   * Create high-risk late timer
   * For high-value invoices with high risk scores
   */
  async createHighRiskLateTimer(
    tenantId: string,
    invoiceId: string,
    contactId: string,
    dueDate: Date,
    invoiceAmount: string,
    riskScore: number
  ): Promise<void> {
    // Timer fires 1 day after due date for high-risk high-value
    const triggerAt = addDays(dueDate, 1);

    await this.createTimer({
      tenantId,
      invoiceId,
      contactId,
      timerType: 'high_risk_late',
      triggerAt,
      metadata: {
        dueDate: dueDate.toISOString(),
        invoiceAmount,
        riskScore,
      },
    });
  }

  /**
   * Get triggered timers (past due and not yet processed)
   */
  async getTriggeredTimers(tenantId: string): Promise<Array<{
    id: string;
    invoiceId: string;
    contactId: string;
    timerType: string;
    triggerAt: Date;
    metadata: any;
  }>> {
    const now = new Date();

    const triggered = await db
      .select({
        id: workflowTimers.id,
        invoiceId: workflowTimers.invoiceId,
        contactId: workflowTimers.contactId,
        timerType: workflowTimers.timerType,
        triggerAt: workflowTimers.triggerAt,
        metadata: workflowTimers.metadata,
      })
      .from(workflowTimers)
      .where(
        and(
          eq(workflowTimers.tenantId, tenantId),
          eq(workflowTimers.status, 'pending'),
          lte(workflowTimers.triggerAt, now)
        )
      );

    return triggered.map(t => ({
      id: t.id,
      invoiceId: t.invoiceId,
      contactId: t.contactId,
      timerType: t.timerType || '',
      triggerAt: t.triggerAt,
      metadata: t.metadata || {},
    }));
  }

  /**
   * Mark timer as processed
   */
  async markTimerProcessed(timerId: string): Promise<void> {
    await db
      .update(workflowTimers)
      .set({
        status: 'processed',
        processedAt: new Date(),
      })
      .where(eq(workflowTimers.id, timerId));
  }

  /**
   * Process triggered timers - create exception actions
   */
  async processTriggeredTimers(tenantId: string): Promise<number> {
    const triggered = await this.getTriggeredTimers(tenantId);

    console.log(`⏰ Processing ${triggered.length} triggered timers for tenant ${tenantId}`);

    let created = 0;

    for (const timer of triggered) {
      try {
        // Get invoice details
        const [invoice] = await db
          .select({
            invoiceNumber: invoices.invoiceNumber,
            amount: invoices.amount,
            pauseState: invoices.pauseState,
          })
          .from(invoices)
          .where(eq(invoices.id, timer.invoiceId))
          .limit(1);

        if (!invoice) {
          console.log(`⚠️  Invoice ${timer.invoiceId} not found, marking timer as processed`);
          await this.markTimerProcessed(timer.id);
          continue;
        }

        // Skip if invoice is paused (except for broken_promise which overrides pause)
        if (invoice.pauseState && timer.timerType !== 'broken_promise') {
          console.log(`⏸️  Skipping timer for paused invoice ${invoice.invoiceNumber}`);
          await this.markTimerProcessed(timer.id);
          continue;
        }

        // Create exception action in action centre
        const exceptionType = this.getExceptionType(timer.timerType);
        const priority = this.getExceptionPriority(timer.timerType);

        await db.insert(actions).values({
          tenantId,
          invoiceId: timer.invoiceId,
          contactId: timer.contactId,
          type: 'note', // Exception notification
          status: 'pending',
          subject: exceptionType,
          content: `${exceptionType} - Requires review`,
          source: 'automated',
          metadata: {
            exceptionType,
            timerType: timer.timerType,
            timerMetadata: timer.metadata,
            priority,
            autoGenerated: true,
            requiresReview: true,
          },
        });

        console.log(`📌 Created ${exceptionType} exception for invoice ${invoice.invoiceNumber}`);
        created++;

        // Mark timer as processed
        await this.markTimerProcessed(timer.id);
      } catch (error) {
        console.error(`❌ Error processing timer ${timer.id}:`, error);
      }
    }

    console.log(`✅ Processed ${triggered.length} timers, created ${created} exceptions`);
    return created;
  }

  /**
   * Map timer type to human-readable exception type
   */
  private getExceptionType(timerType: string): string {
    const map: Record<string, string> = {
      dispute_window_closing: 'Dispute Window Closing',
      broken_promise: 'Broken Promise',
      high_risk_late: 'High Risk Late',
      aging_threshold: 'Aging Threshold',
    };
    return map[timerType] || timerType;
  }

  /**
   * Map timer type to priority level
   */
  private getExceptionPriority(timerType: string): string {
    const map: Record<string, string> = {
      dispute_window_closing: 'normal',
      broken_promise: 'high',
      high_risk_late: 'urgent',
      aging_threshold: 'normal',
    };
    return map[timerType] || 'normal';
  }

  /**
   * Scan invoices and create missing timers (for backfill or new invoices)
   */
  async scanAndCreateTimers(tenantId: string): Promise<number> {
    console.log(`🔍 Scanning invoices for missing timers (tenant ${tenantId})`);

    let created = 0;

    // Find invoices without dispute window timers
    const invoicesNeedingTimers = await db
      .select({
        id: invoices.id,
        contactId: invoices.contactId,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        amount: invoices.amount,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.status} NOT IN ('paid', 'cancelled', 'void')`,
          // Only create timers for invoices less than 30 days old
          sql`${invoices.issueDate} >= NOW() - INTERVAL '30 days'`
        )
      );

    for (const invoice of invoicesNeedingTimers) {
      try {
        // Check if dispute window timer already exists
        const existingTimer = await db
          .select()
          .from(workflowTimers)
          .where(
            and(
              eq(workflowTimers.invoiceId, invoice.id),
              eq(workflowTimers.timerType, 'dispute_window_closing')
            )
          )
          .limit(1);

        if (existingTimer.length === 0) {
          await this.createDisputeWindowTimer(
            tenantId,
            invoice.id,
            invoice.contactId,
            new Date(invoice.issueDate)
          );
          created++;
        }
      } catch (error) {
        console.error(`❌ Error creating timer for invoice ${invoice.id}:`, error);
      }
    }

    console.log(`✅ Created ${created} missing timers`);
    return created;
  }
}

// Singleton instance
export const timerService = new TimerServiceClass();
export default timerService;
