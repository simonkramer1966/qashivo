/**
 * Communication Outcome Processor
 * 
 * Unified service that processes outcomes from all communication channels
 * (voice, email, SMS) and creates appropriate follow-up actions.
 * 
 * This is the "feedback loop" in the supervised autonomy model:
 * 1. AI sends communication (via actionExecutor)
 * 2. Webhook receives outcome (PTP, dispute, callback, etc.)
 * 3. This service processes outcome and creates next action
 * 4. Next action appears in daily plan for user approval
 */

import { db } from "../db";
import { actions } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";
import { storage } from "../storage";

export type OutcomeType = 
  | 'ptp_captured'           // Promise to pay received
  | 'dispute_raised'         // Customer disputes invoice
  | 'callback_requested'     // Customer wants a callback
  | 'payment_confirmed'      // Customer claims payment made
  | 'wrong_contact'          // Wrong person/number
  | 'no_answer'              // No answer / voicemail
  | 'delivered'              // Message delivered successfully
  | 'opened'                 // Email opened
  | 'clicked'                // Email link clicked
  | 'replied'                // Customer replied
  | 'refused'                // Customer refused to pay
  | 'connected'              // Call connected but no specific outcome
  | 'bounced'                // Email bounced
  | 'failed';                // Delivery failed

export interface OutcomeData {
  tenantId: string;
  contactId: string;
  invoiceId?: string;
  actionId?: string;
  channel: 'email' | 'sms' | 'voice' | 'whatsapp';
  outcomeType: OutcomeType;
  idempotencyKey?: string;
  
  promisedAmount?: string;
  promisedDate?: Date;
  disputeReason?: string;
  callbackTime?: string;
  notes?: string;
  confidence?: number;
  
  rawPayload?: Record<string, any>;
}

export interface ProcessingResult {
  processed: boolean;
  actionsCreated: string[];
  stateUpdates: string[];
  error?: string;
}

class CommunicationOutcomeProcessor {
  
  /**
   * Check if an action with this source already exists (idempotency guard)
   */
  private async actionExists(tenantId: string, source: string): Promise<boolean> {
    try {
      const existing = await db
        .select({ id: actions.id })
        .from(actions)
        .where(and(
          eq(actions.tenantId, tenantId),
          eq(actions.source, source)
        ))
        .limit(1);
      return existing.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Create action only if not already exists (idempotent)
   */
  private async createActionIfNotExists(
    source: string,
    actionData: Parameters<typeof storage.createAction>[0]
  ): Promise<{ id: string } | null> {
    if (await this.actionExists(actionData.tenantId, source)) {
      console.log(`⚠️ Action already exists for source: ${source}`);
      return null;
    }
    return storage.createAction({ ...actionData, source });
  }

  /**
   * Process an outcome from any communication channel
   */
  async processOutcome(outcome: OutcomeData): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      processed: false,
      actionsCreated: [],
      stateUpdates: [],
    };

    try {
      console.log(`📬 Processing ${outcome.channel} outcome: ${outcome.outcomeType}`);

      switch (outcome.outcomeType) {
        case 'ptp_captured':
          await this.handlePtpCaptured(outcome, result);
          break;
          
        case 'dispute_raised':
          await this.handleDisputeRaised(outcome, result);
          break;
          
        case 'callback_requested':
          await this.handleCallbackRequested(outcome, result);
          break;
          
        case 'payment_confirmed':
          await this.handlePaymentConfirmed(outcome, result);
          break;
          
        case 'wrong_contact':
          await this.handleWrongContact(outcome, result);
          break;
          
        case 'no_answer':
          await this.handleNoAnswer(outcome, result);
          break;
          
        case 'refused':
          await this.handleRefused(outcome, result);
          break;
          
        case 'replied':
          await this.handleReplied(outcome, result);
          break;
          
        case 'delivered':
        case 'opened':
        case 'clicked':
        case 'connected':
          result.processed = true;
          result.stateUpdates.push(`${outcome.outcomeType} logged`);
          break;
          
        case 'bounced':
        case 'failed':
          await this.handleDeliveryFailure(outcome, result);
          break;
          
        default:
          console.log(`⚠️  Unknown outcome type: ${outcome.outcomeType}`);
          result.processed = true;
      }

      result.processed = true;
      console.log(`✅ Outcome processed: ${result.actionsCreated.length} actions created`);
      
    } catch (error: any) {
      console.error(`❌ Error processing outcome:`, error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Handle Promise to Pay captured
   */
  private async handlePtpCaptured(outcome: OutcomeData, result: ProcessingResult): Promise<void> {
    const contact = await storage.getContact(outcome.contactId, outcome.tenantId);
    if (!contact) return;

    if (outcome.invoiceId && outcome.promisedDate) {
      try {
        await storage.createPromiseToPay({
          tenantId: outcome.tenantId,
          invoiceId: outcome.invoiceId,
          contactId: outcome.contactId,
          amount: outcome.promisedAmount || '0',
          promisedDate: outcome.promisedDate,
          paymentMethod: 'bank_transfer',
          contactName: contact.name || contact.companyName || 'Unknown',
          contactEmail: contact.email || undefined,
          contactPhone: contact.phone || undefined,
          notes: `Captured via ${outcome.channel}. ${outcome.notes || ''}`,
        });
        result.stateUpdates.push('PTP recorded');
      } catch (err) {
        console.log('PTP may already exist:', err);
      }
    }

    const followUpDate = outcome.promisedDate 
      ? new Date(outcome.promisedDate.getTime() + 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Generate unique source for idempotency
    const actionSource = outcome.idempotencyKey 
      ? `outcome_processor_${outcome.idempotencyKey}` 
      : `outcome_processor_ptp_${outcome.contactId}_${outcome.invoiceId || 'no_invoice'}`;

    const action = await this.createActionIfNotExists(actionSource, {
      tenantId: outcome.tenantId,
      contactId: outcome.contactId,
      invoiceId: outcome.invoiceId,
      type: 'email',
      status: 'pending_approval',
      subject: `PTP Follow-up: ${contact.companyName || contact.name}`,
      content: `Payment promised for ${outcome.promisedDate?.toLocaleDateString('en-GB') || 'TBD'}. Amount: ${outcome.promisedAmount || 'Full balance'}. Schedule follow-up to confirm receipt.`,
      scheduledFor: followUpDate,
      metadata: {
        trigger: 'ptp_captured',
        channel: outcome.channel,
        promisedAmount: outcome.promisedAmount,
        promisedDate: outcome.promisedDate?.toISOString(),
        autoGenerated: true,
      },
    });

    if (action) {
      result.actionsCreated.push(action.id);
      result.stateUpdates.push('Follow-up action scheduled');
    } else {
      result.stateUpdates.push('Follow-up action already exists');
    }
  }

  /**
   * Handle dispute raised
   */
  private async handleDisputeRaised(outcome: OutcomeData, result: ProcessingResult): Promise<void> {
    const contact = await storage.getContact(outcome.contactId, outcome.tenantId);
    if (!contact) return;

    if (outcome.invoiceId) {
      try {
        const responseDue = new Date();
        responseDue.setDate(responseDue.getDate() + 14);
        
        await storage.createDispute({
          tenantId: outcome.tenantId,
          invoiceId: outcome.invoiceId,
          contactId: outcome.contactId,
          type: 'other',
          summary: outcome.disputeReason || `Dispute raised via ${outcome.channel}`,
          buyerContactName: contact.name || contact.companyName || 'Unknown',
          buyerContactEmail: contact.email || undefined,
          buyerContactPhone: contact.phone || undefined,
          responseDueAt: responseDue,
        });
        result.stateUpdates.push('Dispute recorded');
      } catch (err) {
        console.log('Dispute may already exist:', err);
      }
    }

    const actionSource = outcome.idempotencyKey 
      ? `outcome_processor_${outcome.idempotencyKey}` 
      : `outcome_processor_dispute_${outcome.contactId}_${outcome.invoiceId || 'no_invoice'}`;

    const action = await this.createActionIfNotExists(actionSource, {
      tenantId: outcome.tenantId,
      contactId: outcome.contactId,
      invoiceId: outcome.invoiceId,
      type: 'email',
      status: 'exception',
      exceptionReason: 'dispute_detected',
      subject: `⚠️ Dispute: ${contact.companyName || contact.name}`,
      content: `Customer has raised a dispute. Reason: ${outcome.disputeReason || 'Not specified'}. Review required before further contact.`,
      metadata: {
        trigger: 'dispute_raised',
        channel: outcome.channel,
        disputeReason: outcome.disputeReason,
        requiresHumanReview: true,
        autoGenerated: true,
      },
    });

    if (action) {
      result.actionsCreated.push(action.id);
      result.stateUpdates.push('Dispute escalated for review');
    } else {
      result.stateUpdates.push('Dispute action already exists');
    }
  }

  /**
   * Handle callback requested
   */
  private async handleCallbackRequested(outcome: OutcomeData, result: ProcessingResult): Promise<void> {
    const contact = await storage.getContact(outcome.contactId, outcome.tenantId);
    if (!contact) return;

    let scheduledFor = new Date();
    if (outcome.callbackTime) {
      const parsed = this.parseCallbackTime(outcome.callbackTime);
      if (parsed) scheduledFor = parsed;
    } else {
      scheduledFor.setHours(scheduledFor.getHours() + 2);
    }

    const actionSource = outcome.idempotencyKey 
      ? `outcome_processor_${outcome.idempotencyKey}` 
      : `outcome_processor_callback_${outcome.contactId}_${outcome.invoiceId || 'no_invoice'}`;

    const action = await this.createActionIfNotExists(actionSource, {
      tenantId: outcome.tenantId,
      contactId: outcome.contactId,
      invoiceId: outcome.invoiceId,
      type: 'voice',
      status: 'pending_approval',
      subject: `📞 Callback: ${contact.companyName || contact.name}`,
      content: `Customer requested callback${outcome.callbackTime ? ` at ${outcome.callbackTime}` : ''}. Original contact via ${outcome.channel}.`,
      scheduledFor,
      metadata: {
        trigger: 'callback_requested',
        channel: outcome.channel,
        requestedTime: outcome.callbackTime,
        autoGenerated: true,
      },
    });

    if (action) {
      result.actionsCreated.push(action.id);
      result.stateUpdates.push('Callback scheduled');
    } else {
      result.stateUpdates.push('Callback action already exists');
    }
  }

  /**
   * Handle payment confirmation claim
   */
  private async handlePaymentConfirmed(outcome: OutcomeData, result: ProcessingResult): Promise<void> {
    const contact = await storage.getContact(outcome.contactId, outcome.tenantId);
    if (!contact) return;

    const actionSource = outcome.idempotencyKey 
      ? `outcome_processor_${outcome.idempotencyKey}` 
      : `outcome_processor_payment_${outcome.contactId}_${outcome.invoiceId || 'no_invoice'}`;

    const action = await this.createActionIfNotExists(actionSource, {
      tenantId: outcome.tenantId,
      contactId: outcome.contactId,
      invoiceId: outcome.invoiceId,
      type: 'email',
      status: 'pending_approval',
      subject: `💳 Payment Claimed: ${contact.companyName || contact.name}`,
      content: `Customer claims payment has been made. Please verify in Xero and request remittance if not matched. ${outcome.notes || ''}`,
      scheduledFor: new Date(Date.now() + 48 * 60 * 60 * 1000),
      metadata: {
        trigger: 'payment_confirmed',
        channel: outcome.channel,
        claimedAt: new Date().toISOString(),
        autoGenerated: true,
      },
    });

    if (action) {
      result.actionsCreated.push(action.id);
      result.stateUpdates.push('Payment verification scheduled');
    }
  }

  /**
   * Handle wrong contact/number
   */
  private async handleWrongContact(outcome: OutcomeData, result: ProcessingResult): Promise<void> {
    const contact = await storage.getContact(outcome.contactId, outcome.tenantId);
    if (!contact) return;

    const actionSource = outcome.idempotencyKey 
      ? `outcome_processor_${outcome.idempotencyKey}` 
      : `outcome_processor_wrong_${outcome.contactId}_${outcome.invoiceId || 'no_invoice'}`;

    const action = await this.createActionIfNotExists(actionSource, {
      tenantId: outcome.tenantId,
      contactId: outcome.contactId,
      invoiceId: outcome.invoiceId,
      type: 'email',
      status: 'exception',
      exceptionReason: 'wrong_contact',
      subject: `❌ Wrong Contact: ${contact.companyName || contact.name}`,
      content: `Contact details appear to be incorrect. ${outcome.channel === 'voice' ? 'Phone' : 'Contact'} may need updating. Please verify correct contact information.`,
      metadata: {
        trigger: 'wrong_contact',
        channel: outcome.channel,
        requiresHumanReview: true,
        autoGenerated: true,
      },
    });

    if (action) {
      result.actionsCreated.push(action.id);
      result.stateUpdates.push('Contact flagged for review');
    }
  }

  /**
   * Handle no answer - these can repeat, so use different idempotency
   */
  private async handleNoAnswer(outcome: OutcomeData, result: ProcessingResult): Promise<void> {
    // For no answer, we DO want to create retry actions on subsequent calls
    // So we don't use strict idempotency here - just log the outcome
    result.stateUpdates.push('No answer logged - scheduler will handle retries');
  }

  /**
   * Handle payment refused
   */
  private async handleRefused(outcome: OutcomeData, result: ProcessingResult): Promise<void> {
    const contact = await storage.getContact(outcome.contactId, outcome.tenantId);
    if (!contact) return;

    const actionSource = outcome.idempotencyKey 
      ? `outcome_processor_${outcome.idempotencyKey}` 
      : `outcome_processor_refused_${outcome.contactId}_${outcome.invoiceId || 'no_invoice'}`;

    const action = await this.createActionIfNotExists(actionSource, {
      tenantId: outcome.tenantId,
      contactId: outcome.contactId,
      invoiceId: outcome.invoiceId,
      type: 'email',
      status: 'exception',
      exceptionReason: 'payment_refused',
      subject: `⚠️ Payment Refused: ${contact.companyName || contact.name}`,
      content: `Customer has refused to pay. Escalation to senior contact or legal review may be required. ${outcome.notes || ''}`,
      metadata: {
        trigger: 'refused',
        channel: outcome.channel,
        requiresHumanReview: true,
        autoGenerated: true,
      },
    });

    if (action) {
      result.actionsCreated.push(action.id);
      result.stateUpdates.push('Escalated for review');
    }
  }

  /**
   * Handle customer reply (email/SMS)
   */
  private async handleReplied(outcome: OutcomeData, result: ProcessingResult): Promise<void> {
    result.stateUpdates.push('Reply logged - intent analysis will process');
  }

  /**
   * Handle delivery failure
   */
  private async handleDeliveryFailure(outcome: OutcomeData, result: ProcessingResult): Promise<void> {
    const contact = await storage.getContact(outcome.contactId, outcome.tenantId);
    if (!contact) return;

    const alternativeChannel = outcome.channel === 'email' ? 'sms' : 'email';
    
    const actionSource = outcome.idempotencyKey 
      ? `outcome_processor_${outcome.idempotencyKey}` 
      : `outcome_processor_fail_${outcome.contactId}_${outcome.invoiceId || 'no_invoice'}`;

    const action = await this.createActionIfNotExists(actionSource, {
      tenantId: outcome.tenantId,
      contactId: outcome.contactId,
      invoiceId: outcome.invoiceId,
      type: alternativeChannel,
      status: 'pending_approval',
      subject: `${outcome.channel} delivery failed - try ${alternativeChannel}`,
      content: `Original ${outcome.channel} failed to deliver (${outcome.outcomeType}). Attempting via ${alternativeChannel}.`,
      scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000),
      metadata: {
        trigger: outcome.outcomeType,
        originalChannel: outcome.channel,
        fallbackChannel: alternativeChannel,
        autoGenerated: true,
      },
    });

    if (action) {
      result.actionsCreated.push(action.id);
      result.stateUpdates.push(`Fallback to ${alternativeChannel}`);
    }
  }

  /**
   * Count recent contact attempts for a contact
   */
  private async countRecentAttempts(
    contactId: string, 
    tenantId: string, 
    channel: string,
    days: number
  ): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const attempts = await db
      .select()
      .from(actions)
      .where(and(
        eq(actions.contactId, contactId),
        eq(actions.tenantId, tenantId),
        eq(actions.type, channel),
        gte(actions.createdAt, since)
      ));

    return attempts.length;
  }

  /**
   * Parse callback time string into Date
   */
  private parseCallbackTime(timeStr: string): Date | null {
    const now = new Date();
    const lower = timeStr.toLowerCase();
    
    if (lower.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      return tomorrow;
    }
    
    if (lower.includes('afternoon')) {
      const result = new Date(now);
      result.setHours(14, 0, 0, 0);
      if (result <= now) result.setDate(result.getDate() + 1);
      return result;
    }
    
    if (lower.includes('morning')) {
      const result = new Date(now);
      result.setHours(10, 0, 0, 0);
      if (result <= now) result.setDate(result.getDate() + 1);
      return result;
    }

    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const meridiem = timeMatch[3];
      
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      
      const result = new Date(now);
      result.setHours(hours, minutes, 0, 0);
      if (result <= now) result.setDate(result.getDate() + 1);
      return result;
    }

    return null;
  }

  /**
   * Process a raw outcome event from the event bus
   * Called directly from webhook handlers after storing the event
   */
  async processFromEvent(event: {
    tenantId: string;
    contactId?: string;
    invoiceId?: string;
    actionId?: string;
    channel?: 'email' | 'sms' | 'voice' | 'whatsapp';
    outcome?: string;
    payload?: Record<string, any>;
    idempotencyKey?: string;
  }): Promise<ProcessingResult> {
    if (!event.contactId) {
      return { processed: false, actionsCreated: [], stateUpdates: [], error: 'No contactId' };
    }

    // Idempotency check - skip if we've already processed this outcome
    if (event.idempotencyKey) {
      const alreadyProcessed = await this.checkIdempotency(event.tenantId, event.idempotencyKey);
      if (alreadyProcessed) {
        console.log(`⚠️ Outcome already processed: ${event.idempotencyKey}`);
        return { processed: true, actionsCreated: [], stateUpdates: ['duplicate_skipped'] };
      }
    }

    // Map the outcome string to our typed OutcomeType
    const outcomeType = this.mapOutcomeType(event.outcome || 'unknown');
    
    // Extract PTP and dispute info from payload
    const ptpData = event.payload?.ptp_captured;
    let promisedDate: Date | undefined;
    if (ptpData?.date) {
      try {
        promisedDate = new Date(ptpData.date);
      } catch (e) {
        console.log('Could not parse PTP date:', ptpData.date);
      }
    }

    const outcomeData: OutcomeData = {
      tenantId: event.tenantId,
      contactId: event.contactId,
      invoiceId: event.invoiceId,
      actionId: event.actionId,
      channel: event.channel || 'email',
      outcomeType,
      idempotencyKey: event.idempotencyKey,
      rawPayload: event.payload,
      promisedAmount: ptpData?.amount,
      promisedDate,
      disputeReason: typeof event.payload?.dispute_raised === 'string' 
        ? event.payload.dispute_raised 
        : event.payload?.dispute_raised ? 'Dispute raised' : undefined,
      callbackTime: event.payload?.callback_time,
    };

    console.log(`📬 Processing outcome: ${event.outcome} → mapped to: ${outcomeType}`);
    
    const result = await this.processOutcome(outcomeData);
    
    // Mark as processed for idempotency
    if (event.idempotencyKey && result.processed) {
      await this.markProcessed(event.tenantId, event.idempotencyKey);
    }
    
    return result;
  }

  /**
   * Check if outcome has already been processed (idempotency)
   */
  private async checkIdempotency(tenantId: string, key: string): Promise<boolean> {
    try {
      const existing = await db
        .select()
        .from(actions)
        .where(and(
          eq(actions.tenantId, tenantId),
          eq(actions.source, `outcome_processor_${key}`)
        ))
        .limit(1);
      return existing.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Mark outcome as processed (for future idempotency checks)
   * We use the action's source field to track processed outcomes
   */
  private async markProcessed(tenantId: string, key: string): Promise<void> {
    // No-op - we track via action source field
  }

  /**
   * Map raw outcome string to OutcomeType
   */
  private mapOutcomeType(outcome: string): OutcomeType {
    const mapping: Record<string, OutcomeType> = {
      'ptp_captured': 'ptp_captured',
      'connected_ptp': 'ptp_captured',
      'dispute_raised': 'dispute_raised',
      'connected_dispute': 'dispute_raised',
      'callback_requested': 'callback_requested',
      'payment_confirmed': 'payment_confirmed',
      'paid_claimed': 'payment_confirmed',
      'wrong_contact': 'wrong_contact',
      'wrong_number': 'wrong_contact',
      'no_answer': 'no_answer',
      'voicemail': 'no_answer',
      'delivered': 'delivered',
      'open': 'opened',
      'opened': 'opened',
      'click': 'clicked',
      'clicked': 'clicked',
      'replied': 'replied',
      'refused': 'refused',
      'connected_refused': 'refused',
      'connected': 'connected',
      'connected_partial': 'ptp_captured',
      'bounce': 'bounced',
      'bounced': 'bounced',
      'failed': 'failed',
      'dropped': 'failed',
    };

    return mapping[outcome.toLowerCase()] || 'delivered';
  }
}

export const communicationOutcomeProcessor = new CommunicationOutcomeProcessor();
