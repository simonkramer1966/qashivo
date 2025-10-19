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

      // Fetch all invoices with ANY payment (full or partial) for this contact
      const paidInvoices = await db
        .select({
          amount: invoices.amount,
          dueDate: invoices.dueDate,
          paidDate: invoices.paidDate,
          amountPaid: invoices.amountPaid,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.contactId, event.contactId),
            eq(invoices.tenantId, event.tenantId),
            sql`CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL) > 0` // Any payment made
          )
        )
        .orderBy(desc(sql`COALESCE(${invoices.paidDate}, ${invoices.createdAt})`))
        .limit(100); // Last 100 invoices with payments

      if (paidInvoices.length === 0) {
        console.log(`⚠️ No paid invoices found for contact ${event.contactId}`);
        return;
      }

      // Calculate payment lags (use paidDate if full payment, otherwise use current date for partial)
      const paymentLags = paidInvoices.map((inv: any) => {
        const due = new Date(inv.dueDate!);
        const paid = inv.paidDate ? new Date(inv.paidDate) : new Date(); // Use current date for partials
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

      // Find the most recent payment date (could be from event or latest invoice)
      const latestPaymentDate = event.paidDate || new Date();

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
          lastPaymentDate: latestPaymentDate,
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

      // Import inboundMessages and actions tables
      const { inboundMessages } = await import("../../shared/schema");

      // Query both outbound actions AND inbound messages for complete picture
      const outboundActions = await db
        .select({
          type: actions.type,
          status: actions.status,
          metadata: actions.metadata,
          createdAt: actions.createdAt,
        })
        .from(actions)
        .where(
          and(
            eq(actions.contactId, event.contactId),
            eq(actions.tenantId, event.tenantId)
          )
        )
        .limit(500); // Last 500 outbound actions

      const inboundReplies = await db
        .select({
          channel: inboundMessages.channel,
          createdAt: inboundMessages.createdAt,
        })
        .from(inboundMessages)
        .where(
          and(
            eq(inboundMessages.contactId, event.contactId),
            eq(inboundMessages.tenantId, event.tenantId)
          )
        )
        .limit(500); // Last 500 inbound messages

      // Calculate response rates combining actions and inbound messages
      const emailSent = outboundActions.filter((a: any) => a.type === 'email').length;
      const smsSent = outboundActions.filter((a: any) => a.type === 'sms').length;
      const whatsappSent = outboundActions.filter((a: any) => a.type === 'whatsapp').length;
      const callsMade = outboundActions.filter((a: any) => ['call', 'voice', 'ai_voice'].includes(a.type || '')).length;

      const emailReplies = inboundReplies.filter((m: any) => m.channel === 'email').length;
      const smsReplies = inboundReplies.filter((m: any) => m.channel === 'sms').length;
      const whatsappReplies = inboundReplies.filter((m: any) => m.channel === 'whatsapp').length;
      const voiceReplies = inboundReplies.filter((m: any) => m.channel === 'voice').length;

      // Calculate email specific metrics from action metadata
      const emailOpened = outboundActions.filter((a: any) => 
        a.type === 'email' && a.metadata?.opened === true
      ).length;
      const emailClicked = outboundActions.filter((a: any) => 
        a.type === 'email' && a.metadata?.clicked === true
      ).length;

      // Calculate rates (replies are from inbound messages)
      const emailOpenRate = emailSent > 0 ? parseFloat((emailOpened / emailSent).toFixed(2)) : 0;
      const emailClickRate = emailSent > 0 ? parseFloat((emailClicked / emailSent).toFixed(2)) : 0;
      const emailReplyRate = emailSent > 0 ? parseFloat((emailReplies / emailSent).toFixed(2)) : 0;
      const smsReplyRate = smsSent > 0 ? parseFloat((smsReplies / smsSent).toFixed(2)) : 0;
      const whatsappReplyRate = whatsappSent > 0 ? parseFloat((whatsappReplies / whatsappSent).toFixed(2)) : 0;
      const callAnswerRate = callsMade > 0 ? parseFloat((voiceReplies / callsMade).toFixed(2)) : 0;

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

    invoices.forEach((inv: any) => {
      const amount = parseFloat(inv.amount || '0');
      const due = new Date(inv.dueDate!);
      // Use paidDate if available (full payment), otherwise use current date (partial payment)
      const paid = inv.paidDate ? new Date(inv.paidDate) : new Date();
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
