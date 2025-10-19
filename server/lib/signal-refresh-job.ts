/**
 * Signal Refresh Background Job
 * 
 * Periodically refreshes behavioral signals for all contacts
 * based on their payment and communication history.
 */

import { db } from "../db";
import { contacts, invoices } from "../../shared/schema";
import { eq, and, sql, isNotNull } from "drizzle-orm";
import { signalCollector } from "./signal-collector";

export class SignalRefreshJob {
  private isRunning = false;

  /**
   * Refresh payment signals for all contacts in a tenant
   */
  async refreshPaymentSignalsForTenant(tenantId: string): Promise<void> {
    if (this.isRunning) {
      console.log('⏭️  Signal refresh already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log(`🔄 Starting payment signal refresh for tenant ${tenantId}...`);

      // Get all contacts with paid invoices
      const contactsWithPayments = await db
        .select({
          contactId: invoices.contactId,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            isNotNull(invoices.paidDate)
          )
        )
        .groupBy(invoices.contactId);

      console.log(`📊 Found ${contactsWithPayments.length} contacts with payment history`);

      // Process each contact
      for (const { contactId } of contactsWithPayments) {
        await this.refreshPaymentSignalsForContact(contactId, tenantId);
      }

      console.log(`✅ Completed payment signal refresh for tenant ${tenantId}`);

    } catch (error) {
      console.error('❌ Error refreshing payment signals:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Refresh payment signals for a specific contact
   */
  async refreshPaymentSignalsForContact(contactId: string, tenantId: string): Promise<void> {
    try {
      // Get the most recent paid invoice for this contact
      const [latestPaidInvoice] = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.contactId, contactId),
            eq(invoices.tenantId, tenantId),
            isNotNull(invoices.paidDate)
          )
        )
        .orderBy(sql`${invoices.paidDate} DESC`)
        .limit(1);

      if (!latestPaidInvoice || !latestPaidInvoice.paidDate || !latestPaidInvoice.dueDate) {
        return;
      }

      // Record this payment event (which will recalculate all stats)
      await signalCollector.recordPaymentEvent({
        contactId,
        tenantId,
        invoiceId: latestPaidInvoice.id,
        amountPaid: parseFloat(latestPaidInvoice.amountPaid || latestPaidInvoice.amount),
        invoiceAmount: parseFloat(latestPaidInvoice.amount),
        dueDate: new Date(latestPaidInvoice.dueDate),
        paidDate: new Date(latestPaidInvoice.paidDate),
        isPartial: parseFloat(latestPaidInvoice.amountPaid || '0') < parseFloat(latestPaidInvoice.amount),
      });

      console.log(`✅ Refreshed signals for contact ${contactId}`);

    } catch (error) {
      console.error(`❌ Error refreshing signals for contact ${contactId}:`, error);
    }
  }

  /**
   * Run periodic signal refresh for all tenants
   */
  async runPeriodicRefresh(): Promise<void> {
    try {
      console.log('🔄 Starting periodic signal refresh...');

      // This would be enhanced to refresh only contacts that need it
      // For now, we'll trigger on-demand via API or after sync

      console.log('✅ Periodic signal refresh completed');
    } catch (error) {
      console.error('❌ Error in periodic signal refresh:', error);
    }
  }
}

// Export singleton instance
export const signalRefreshJob = new SignalRefreshJob();
