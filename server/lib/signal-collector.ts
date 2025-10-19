/**
 * Behavioral Signal Collection Service
 * 
 * Collects and aggregates customer payment and communication behavior signals
 * to feed the adaptive scheduler's scoring engine.
 */

import { db } from "../db";
import { 
  customerBehaviorSignals, 
  invoices, 
  actions,
  contacts 
} from "../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

interface PaymentEvent {
  contactId: string;
  tenantId: string;
  invoiceId: string;
  amountPaid: number;
  invoiceAmount: number;
  dueDate: Date;
  paidDate: Date;
  isPartial: boolean;
}

interface ChannelEvent {
  contactId: string;
  tenantId: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'call' | 'voice';
  eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'answered' | 'failed';
  timestamp: Date;
}

export class SignalCollector {
  /**
   * Record a payment event and update behavior signals
   */
  async recordPaymentEvent(event: PaymentEvent): Promise<void> {
    try {
      console.log(`📊 Recording payment signal for contact ${event.contactId}`);

      // Calculate days to pay (can be negative if paid early)
      const daysToPay = Math.floor(
        (event.paidDate.getTime() - event.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get or create behavior signal record
      let signal = await this.getOrCreateSignal(event.contactId, event.tenantId);

      // Fetch all paid invoices for this contact to recalculate stats
      const paidInvoices = await db
        .select({
          amount: invoices.amount,
          dueDate: invoices.dueDate,
          paidDate: invoices.paidDate,
          amountPaid: invoices.amountPaid,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.contactId, event.contactId),
            eq(invoices.tenantId, event.tenantId),
            sql`${invoices.paidDate} IS NOT NULL`
          )
        )
        .orderBy(desc(invoices.paidDate))
        .limit(100); // Last 100 paid invoices for stats

      if (paidInvoices.length === 0) {
        console.log(`⚠️ No paid invoices found for contact ${event.contactId}`);
        return;
      }

      // Calculate payment lags
      const paymentLags = paidInvoices.map((inv: any) => {
        const due = new Date(inv.dueDate!);
        const paid = new Date(inv.paidDate!);
        return Math.floor((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      });

      // Calculate statistics
      const sortedLags = [...paymentLags].sort((a, b) => a - b);
      const medianDaysToPay = this.calculateMedian(sortedLags);
      const p75DaysToPay = this.calculatePercentile(sortedLags, 75);
      const volatility = this.calculateStdDev(paymentLags);
      const trend = this.calculateTrend(paymentLags);

      // Calculate amount sensitivity (group by amount buckets)
      const amountSensitivity = this.calculateAmountSensitivity(paidInvoices);

      // Count partial payments
      const partialPaymentCount = paidInvoices.filter(
        (inv: any) => parseFloat(inv.amountPaid || '0') < parseFloat(inv.amount || '0')
      ).length;

      // Update signal record
      await db
        .update(customerBehaviorSignals)
        .set({
          medianDaysToPay: medianDaysToPay.toString(),
          p75DaysToPay: p75DaysToPay.toString(),
          volatility: volatility.toString(),
          trend: trend.toString(),
          amountSensitivity,
          partialPaymentCount,
          invoiceCount: paidInvoices.length,
          lastPaymentDate: event.paidDate,
          updatedAt: new Date(),
        })
        .where(eq(customerBehaviorSignals.contactId, event.contactId));

      console.log(`✅ Updated payment signals for contact ${event.contactId}:`, {
        medianDaysToPay,
        p75DaysToPay,
        volatility,
        trend,
        invoiceCount: paidInvoices.length,
      });

    } catch (error) {
      console.error('❌ Error recording payment signal:', error);
      throw error;
    }
  }

  /**
   * Record a channel interaction event and update response rates
   */
  async recordChannelEvent(event: ChannelEvent): Promise<void> {
    try {
      console.log(`📊 Recording channel signal: ${event.channel} ${event.eventType} for contact ${event.contactId}`);

      // Get or create behavior signal record
      await this.getOrCreateSignal(event.contactId, event.tenantId);

      // Query actions for this contact to calculate response rates
      const channelActions = await db
        .select({
          type: actions.type,
          status: actions.status,
          metadata: actions.metadata,
        })
        .from(actions)
        .where(
          and(
            eq(actions.contactId, event.contactId),
            eq(actions.tenantId, event.tenantId)
          )
        )
        .limit(500); // Last 500 actions

      // Calculate response rates by channel
      const emailActions = channelActions.filter((a: any) => a.type === 'email');
      const smsActions = channelActions.filter((a: any) => a.type === 'sms');
      const whatsappActions = channelActions.filter((a: any) => a.type === 'whatsapp');
      const callActions = channelActions.filter((a: any) => ['call', 'voice', 'ai_voice'].includes(a.type || ''));

      const emailOpenRate = this.calculateRate(emailActions, 'opened');
      const emailClickRate = this.calculateRate(emailActions, 'clicked');
      const emailReplyRate = this.calculateRate(emailActions, 'replied');
      const smsReplyRate = this.calculateRate(smsActions, 'replied');
      const whatsappReplyRate = this.calculateRate(whatsappActions, 'replied');
      const callAnswerRate = this.calculateRate(callActions, 'answered');

      // Update signal record
      await db
        .update(customerBehaviorSignals)
        .set({
          emailOpenRate: emailOpenRate.toString(),
          emailClickRate: emailClickRate.toString(),
          emailReplyRate: emailReplyRate.toString(),
          smsReplyRate: smsReplyRate.toString(),
          callAnswerRate: callAnswerRate.toString(),
          whatsappReplyRate: whatsappReplyRate.toString(),
          updatedAt: new Date(),
        })
        .where(eq(customerBehaviorSignals.contactId, event.contactId));

      console.log(`✅ Updated channel signals for contact ${event.contactId}:`, {
        emailOpenRate,
        emailReplyRate,
        smsReplyRate,
        callAnswerRate,
      });

    } catch (error) {
      console.error('❌ Error recording channel signal:', error);
      throw error;
    }
  }

  /**
   * Update dispute count
   */
  async recordDispute(contactId: string, tenantId: string): Promise<void> {
    try {
      await this.getOrCreateSignal(contactId, tenantId);

      await db
        .update(customerBehaviorSignals)
        .set({
          disputeCount: sql`COALESCE(${customerBehaviorSignals.disputeCount}, 0) + 1`,
          updatedAt: new Date(),
        })
        .where(eq(customerBehaviorSignals.contactId, contactId));

      console.log(`✅ Incremented dispute count for contact ${contactId}`);
    } catch (error) {
      console.error('❌ Error recording dispute:', error);
    }
  }

  /**
   * Update promise breach count
   */
  async recordPromiseBreach(contactId: string, tenantId: string): Promise<void> {
    try {
      await this.getOrCreateSignal(contactId, tenantId);

      await db
        .update(customerBehaviorSignals)
        .set({
          promiseBreachCount: sql`COALESCE(${customerBehaviorSignals.promiseBreachCount}, 0) + 1`,
          updatedAt: new Date(),
        })
        .where(eq(customerBehaviorSignals.contactId, contactId));

      console.log(`✅ Incremented promise breach count for contact ${contactId}`);
    } catch (error) {
      console.error('❌ Error recording promise breach:', error);
    }
  }

  /**
   * Get or create a behavior signal record for a contact
   */
  private async getOrCreateSignal(contactId: string, tenantId: string) {
    const existing = await db
      .select()
      .from(customerBehaviorSignals)
      .where(eq(customerBehaviorSignals.contactId, contactId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Get contact to determine segment
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);

    // Determine segment based on available data
    const segment = this.determineSegment(contact);
    const segmentPriors = this.getSegmentPriors(segment);

    const [newSignal] = await db
      .insert(customerBehaviorSignals)
      .values({
        contactId,
        tenantId,
        segment,
        segmentPriors,
        invoiceCount: 0,
      })
      .returning();

    return newSignal;
  }

  /**
   * Determine customer segment from contact data
   */
  private determineSegment(contact: any): string {
    // Simple heuristic - can be enhanced with more data
    if (contact.companyName && contact.creditLimit) {
      const limit = parseFloat(contact.creditLimit || '0');
      if (limit > 100000) return 'enterprise';
      if (limit > 20000) return 'medium_business';
      return 'small_business';
    }
    return 'unknown';
  }

  /**
   * Get segment priors for cold-start customers
   */
  private getSegmentPriors(segment: string): any {
    const priors: Record<string, any> = {
      enterprise: { pPayBase: 0.015, expectedDaysToPay: 21 },
      medium_business: { pPayBase: 0.02, expectedDaysToPay: 14 },
      small_business: { pPayBase: 0.03, expectedDaysToPay: 10 },
      unknown: { pPayBase: 0.02, expectedDaysToPay: 14 },
    };
    return priors[segment] || priors.unknown;
  }

  /**
   * Calculate median of an array
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate payment trend (linear regression slope)
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (values[i] - yMean);
      denominator += Math.pow(xValues[i] - xMean, 2);
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate amount sensitivity (avg days to pay by amount bucket)
   */
  private calculateAmountSensitivity(invoices: any[]): any {
    const buckets: Record<string, number[]> = {
      '<1000': [],
      '1000-5000': [],
      '5000-20000': [],
      '>20000': [],
    };

    invoices.forEach(inv => {
      const amount = parseFloat(inv.amount || '0');
      const due = new Date(inv.dueDate!);
      const paid = new Date(inv.paidDate!);
      const daysToPay = Math.floor((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

      if (amount < 1000) buckets['<1000'].push(daysToPay);
      else if (amount < 5000) buckets['1000-5000'].push(daysToPay);
      else if (amount < 20000) buckets['5000-20000'].push(daysToPay);
      else buckets['>20000'].push(daysToPay);
    });

    const result: Record<string, number> = {};
    Object.entries(buckets).forEach(([bucket, days]) => {
      if (days.length > 0) {
        result[bucket] = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      }
    });

    return result;
  }

  /**
   * Calculate response rate from actions
   */
  private calculateRate(actions: any[], status: string): number {
    if (actions.length === 0) return 0;
    
    const hasStatus = actions.filter(a => {
      if (a.status === status) return true;
      if (a.metadata && typeof a.metadata === 'object') {
        return a.metadata[status] === true || a.metadata.status === status;
      }
      return false;
    }).length;

    return parseFloat((hasStatus / actions.length).toFixed(2));
  }
}

// Export singleton instance
export const signalCollector = new SignalCollector();
