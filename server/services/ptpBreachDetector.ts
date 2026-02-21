import { eq, and, lt, ne, isNotNull, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { tenants, promisesToPay, invoices, actions, paymentPlans, paymentPlanInvoices, activityLogs } from "@shared/schema";
import { pauseManager } from "../lib/pause-manager";
import { createLogger } from "../lib/logger";

const log = createLogger('ptp-breach');

interface BreachDetectorConfig {
  checkIntervalMinutes: number; // How often to check for breaches (e.g., 60 min)
  enabled: boolean;
  runOnStartup: boolean;
}

/**
 * PTP Breach Detector
 * 
 * Monitors promises to pay and detects breaches when:
 * - Promise date has passed
 * - Invoice is still unpaid
 * - Promise status is still 'active'
 * 
 * When a breach is detected:
 * 1. Updates promise status to 'breached'
 * 2. Sets breachedAt timestamp
 * 3. Creates a follow-up action for the credit controller
 */
class PTPBreachDetector {
  private intervalId: NodeJS.Timeout | null = null;
  private config: BreachDetectorConfig;

  constructor(config: BreachDetectorConfig = { 
    checkIntervalMinutes: 60, // Check every hour
    enabled: true, 
    runOnStartup: true 
  }) {
    this.config = config;
  }

  /**
   * Start the PTP breach detector
   */
  start(): void {
    if (this.intervalId) {
      log.debug("PTP breach detector already running");
      return;
    }

    if (!this.config.enabled) {
      log.info("PTP breach detector disabled by configuration");
      return;
    }

    log.info(`Starting PTP breach detector (checking every ${this.config.checkIntervalMinutes} minutes)`);

    // Run immediately on startup if configured
    if (this.config.runOnStartup) {
      setTimeout(() => {
        this.checkForBreaches();
      }, 10000); // Wait 10 seconds for app startup
    }

    // Set up recurring check
    this.intervalId = setInterval(
      () => this.checkForBreaches(),
      this.config.checkIntervalMinutes * 60 * 1000
    );

    log.info("PTP breach detector started successfully");
  }

  /**
   * Stop the PTP breach detector
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    log.info("PTP breach detector stopped");
  }

  /**
   * Check for breached promises and payment plans across all tenants
   */
  private async checkForBreaches(): Promise<void> {
    try {
      log.debug("Checking for breached promises to pay and payment plans...");
      
      const now = new Date();
      const allTenants = await db.select().from(tenants);
      
      let totalPTPBreaches = 0;
      let totalPlanBreaches = 0;

      for (const tenant of allTenants) {
        try {
          const ptpBreachCount = await this.checkTenantBreaches(tenant.id, now);
          const planBreachCount = await this.checkPaymentPlanBreaches(tenant.id, now);
          totalPTPBreaches += ptpBreachCount;
          totalPlanBreaches += planBreachCount;
        } catch (error: any) {
          log.error(`Error checking breaches for tenant ${tenant.id}: ${error.message}`);
        }
      }

      if (totalPTPBreaches > 0) {
        log.warn(`Found ${totalPTPBreaches} breached promise(s) to pay`);
      }
      if (totalPlanBreaches > 0) {
        log.warn(`Found ${totalPlanBreaches} payment plan(s) with no payment activity`);
      }
      if (totalPTPBreaches === 0 && totalPlanBreaches === 0) {
        log.debug("No breaches found");
      }
    } catch (error: any) {
      log.error(`PTP breach detector error: ${error.message}`);
    }
  }

  /**
   * Check for payment plan breaches in a specific tenant
   * A breach is detected when nextCheckDate has passed and outstanding hasn't decreased
   */
  private async checkPaymentPlanBreaches(tenantId: string, now: Date): Promise<number> {
    // Find active payment plans where nextCheckDate has passed
    const duePlans = await db
      .select()
      .from(paymentPlans)
      .where(and(
        eq(paymentPlans.tenantId, tenantId),
        eq(paymentPlans.status, 'active'),
        isNotNull(paymentPlans.nextCheckDate),
        lt(paymentPlans.nextCheckDate, now)
      ));

    let breachCount = 0;

    for (const plan of duePlans) {
      try {
        // Get all invoices linked to this plan
        const planInvoiceLinks = await db
          .select({ invoiceId: paymentPlanInvoices.invoiceId })
          .from(paymentPlanInvoices)
          .where(eq(paymentPlanInvoices.paymentPlanId, plan.id));

        // Handle plans with no linked invoices - mark as cancelled
        if (planInvoiceLinks.length === 0) {
          await db
            .update(paymentPlans)
            .set({
              status: 'cancelled',
              nextCheckDate: null,
              updatedAt: now
            })
            .where(eq(paymentPlans.id, plan.id));
          log.warn(`Payment plan ${plan.id} cancelled - no linked invoices`);
          continue;
        }

        const invoiceIds = planInvoiceLinks.map(l => l.invoiceId);

        // Calculate current total outstanding
        const planInvoices = await db
          .select()
          .from(invoices)
          .where(inArray(invoices.id, invoiceIds));

        const currentOutstanding = planInvoices.reduce((sum, inv) => {
          const balance = inv.balance ? parseFloat(inv.balance) : (parseFloat(inv.amount) - parseFloat(inv.amountPaid || "0"));
          return sum + balance;
        }, 0);

        const lastChecked = plan.lastCheckedOutstanding ? parseFloat(plan.lastCheckedOutstanding) : null;

        if (currentOutstanding === 0) {
          // All invoices paid - complete the plan
          await db
            .update(paymentPlans)
            .set({
              status: 'completed',
              nextCheckDate: null,
              lastCheckedOutstanding: "0",
              lastCheckedAt: now,
              updatedAt: now
            })
            .where(eq(paymentPlans.id, plan.id));
          log.info(`Payment plan ${plan.id} completed - all invoices paid`);
          
        } else if (lastChecked !== null && currentOutstanding >= lastChecked) {
          // No payment received - breach detected
          log.warn(`Payment plan ${plan.id} breached - no payment activity (outstanding: ${currentOutstanding}, last checked: ${lastChecked})`);
          
          // Mark plan as defaulted and stop checking
          await db
            .update(paymentPlans)
            .set({
              status: 'defaulted',
              nextCheckDate: null, // Stop further checks
              lastCheckedOutstanding: currentOutstanding.toFixed(2),
              lastCheckedAt: now,
              updatedAt: now
            })
            .where(eq(paymentPlans.id, plan.id));
          
          // Create a follow-up action
          await db.insert(actions).values({
            tenantId: tenantId,
            invoiceId: planInvoices[0]?.id || null,
            contactId: plan.contactId,
            userId: null,
            type: 'note',
            status: 'open',
            subject: 'Payment Plan Defaulted - No Payment Received',
            content: `Payment plan defaulted: no payment received by ${plan.nextCheckDate?.toISOString().split('T')[0]}. Total outstanding: ${currentOutstanding.toFixed(2)}. Follow-up required.`,
            metadata: {
              paymentPlanId: plan.id,
              expectedOutstanding: lastChecked,
              actualOutstanding: currentOutstanding,
              breachType: 'payment_plan_defaulted',
              autoGenerated: true,
              exceptionType: 'Broken Promise',
              priority: 'high'
            },
            aiGenerated: false,
            source: 'automated'
          });

          // Log activity for payment plan breach
          try {
            await db.insert(activityLogs).values({
              tenantId: tenantId,
              activityType: 'ptp_breach',
              category: 'outcome',
              entityType: 'contact',
              entityId: plan.contactId,
              action: 'breached',
              description: `Payment plan defaulted - no payment received. Outstanding: ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(currentOutstanding)}`,
              result: 'failure',
              metadata: {
                paymentPlanId: plan.id,
                expectedOutstanding: lastChecked,
                actualOutstanding: currentOutstanding,
                contactId: plan.contactId
              }
            });
          } catch (e) {
            log.error('Failed to log payment plan breach activity:', e);
          }

          // Clear outcomeOverride on linked invoices so they return to collections
          await db
            .update(invoices)
            .set({ outcomeOverride: null })
            .where(inArray(invoices.id, invoiceIds));

          breachCount++;
          
        } else {
          // Payment received - outstanding decreased, schedule next check
          log.info(`Payment received on plan ${plan.id} (outstanding decreased from ${lastChecked} to ${currentOutstanding})`);
          
          // Calculate next check date based on frequency
          const nextCheckDate = new Date(now);
          switch (plan.paymentFrequency) {
            case 'weekly':
              nextCheckDate.setDate(nextCheckDate.getDate() + 7);
              break;
            case 'monthly':
              nextCheckDate.setMonth(nextCheckDate.getMonth() + 1);
              break;
            case 'quarterly':
              nextCheckDate.setMonth(nextCheckDate.getMonth() + 3);
              break;
          }
          
          await db
            .update(paymentPlans)
            .set({
              lastCheckedOutstanding: currentOutstanding.toFixed(2),
              lastCheckedAt: now,
              nextCheckDate: nextCheckDate,
              updatedAt: now
            })
            .where(eq(paymentPlans.id, plan.id));
        }

      } catch (error: any) {
        log.error(`Error checking payment plan ${plan.id}: ${error.message}`);
      }
    }

    return breachCount;
  }

  /**
   * Check for breaches in a specific tenant
   */
  private async checkTenantBreaches(tenantId: string, now: Date): Promise<number> {
    // Find all active promises where the promised date has passed
    const activePromises = await db
      .select({
        promise: promisesToPay,
        invoice: invoices
      })
      .from(promisesToPay)
      .leftJoin(invoices, eq(promisesToPay.invoiceId, invoices.id))
      .where(and(
        eq(promisesToPay.tenantId, tenantId),
        eq(promisesToPay.status, 'active'),
        lt(promisesToPay.promisedDate, now)
      ));

    let breachCount = 0;

    for (const { promise, invoice } of activePromises) {
      // Check if the invoice is still unpaid
      if (invoice && invoice.status !== 'paid') {
        // Mark the promise as breached
        await db
          .update(promisesToPay)
          .set({
            status: 'breached',
            breachedAt: now,
            updatedAt: now
          })
          .where(eq(promisesToPay.id, promise.id));

        // Resume invoice from PTP pause (if it was paused)
        try {
          await pauseManager.resumeFromPTPBreach(invoice.id, tenantId);
          log.info(`Resumed invoice ${invoice.invoiceNumber} from PTP pause after breach`);
        } catch (error: any) {
          log.error(`Failed to resume invoice from PTP pause: ${error.message}`);
        }

        // Create a follow-up action for the credit controller
        await db.insert(actions).values({
          tenantId: tenantId,
          invoiceId: promise.invoiceId,
          contactId: promise.contactId,
          userId: null, // System-generated action
          type: 'note',
          status: 'open',
          subject: 'Broken Promise to Pay',
          content: `Customer ${promise.contactName} failed to pay ${promise.amount} by ${promise.promisedDate.toISOString().split('T')[0]}. Follow-up required.`,
          metadata: {
            ptpId: promise.id,
            promisedAmount: promise.amount,
            promisedDate: promise.promisedDate,
            breachType: 'payment_not_received',
            autoGenerated: true,
            exceptionType: 'Broken Promise', // For action centre exception filtering
            priority: 'high'
          },
          aiGenerated: false,
          source: 'automated'
        });

        // Log activity for PTP breach
        try {
          await db.insert(activityLogs).values({
            tenantId: tenantId,
            activityType: 'ptp_breach',
            category: 'outcome',
            entityType: 'invoice',
            entityId: promise.invoiceId,
            action: 'breached',
            description: `Promise to pay breached - ${promise.contactName} failed to pay ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(promise.amount))} by ${promise.promisedDate.toISOString().split('T')[0]}`,
            result: 'failure',
            metadata: {
              promiseId: promise.id,
              contactName: promise.contactName,
              promisedAmount: promise.amount,
              promisedDate: promise.promisedDate,
              invoiceNumber: invoice.invoiceNumber
            }
          });
        } catch (e) {
          log.error('Failed to log PTP breach activity:', e);
        }

        log.warn(`Promise breached: ${promise.id} (Invoice ${invoice.invoiceNumber}, ${promise.amount} due ${promise.promisedDate.toISOString().split('T')[0]})`);
        breachCount++;
      }
    }

    return breachCount;
  }
}

// Create and export singleton instance
const ptpBreachDetector = new PTPBreachDetector();

// Export the detector instance
export { ptpBreachDetector };
