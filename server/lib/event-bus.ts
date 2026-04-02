/**
 * Event Bus Service
 *
 * Unified event publishing system for outcome tracking and decision explainability.
 * Handles idempotency to prevent duplicate events from webhook retries.
 *
 * Event Types:
 * - contact.attempted: Outbound contact initiated
 * - contact.outcome: Webhook result (delivered, opened, replied, etc.)
 * - payment.recorded: Payment received
 * - promise.created: Promise to pay recorded
 * - promise.breached: PTP deadline missed
 * - policy.decision: Adaptive scheduler decision with explainability
 */

import { db } from "../db";
import { contactOutcomes, policyDecisions, actions, timelineEvents } from "@shared/schema";
import { eq } from "drizzle-orm";

// Event Types
export type EventType =
  | 'contact.attempted'
  | 'contact.outcome'
  | 'payment.recorded'
  | 'promise.created'
  | 'promise.breached'
  | 'policy.decision';

// Contact Outcome Event
export interface ContactOutcomeEvent {
  type: Exclude<EventType, 'policy.decision'>;
  tenantId: string;
  contactId?: string;
  invoiceId?: string;
  actionId?: string;
  idempotencyKey: string;
  channel?: 'email' | 'sms' | 'whatsapp' | 'voice';
  outcome?: string; // sent, delivered, opened, clicked, replied, answered, bounced, failed, paid
  providerMessageId?: string;
  providerStatus?: string;
  payload: Record<string, any>;
  eventTimestamp?: Date;
}

// Policy Decision Event
export interface PolicyDecisionEvent {
  type: 'policy.decision';
  tenantId: string;
  contactId?: string;
  invoiceId?: string;
  actionId?: string;
  policyVersion: string;
  experimentVariant?: string;
  decisionType: 'contact_now' | 'wait' | 'escalate' | 'pause';
  channel?: string;
  score?: number;
  factors: {
    factor1?: string;
    factor2?: string;
    factor3?: string;
  };
  scoreBreakdown?: Record<string, number>;
  guardStatus: 'allowed' | 'blocked';
  guardReason?: string;
  decisionContext?: Record<string, any>;
}

// Delivery event types that should trigger action status updates
const DELIVERY_EVENT_TYPES = new Set([
  'delivered', 'open', 'opened', 'click', 'clicked',
  'bounce', 'bounced', 'dropped', 'deferred', 'failed',
]);

class EventBusService {
  /**
   * Publish a contact outcome event
   */
  async publishContactOutcome(event: ContactOutcomeEvent): Promise<void> {
    try {
      // Check for duplicate using idempotency key
      const existing = await db
        .select()
        .from(contactOutcomes)
        .where(eq(contactOutcomes.idempotencyKey, event.idempotencyKey))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⚠️  Duplicate event ignored: ${event.idempotencyKey}`);
        return; // Idempotent - already processed
      }

      // Insert event
      await db.insert(contactOutcomes).values({
        tenantId: event.tenantId,
        contactId: event.contactId,
        invoiceId: event.invoiceId,
        actionId: event.actionId,
        idempotencyKey: event.idempotencyKey,
        eventType: event.type,
        channel: event.channel,
        outcome: event.outcome,
        payload: event.payload,
        providerMessageId: event.providerMessageId,
        providerStatus: event.providerStatus,
        eventTimestamp: event.eventTimestamp || new Date(),
      });

      console.log(`📊 Event published: ${event.type} [${event.idempotencyKey}]`);

      // Gap 8: Process delivery outcomes to update action status
      if (event.actionId && event.outcome && DELIVERY_EVENT_TYPES.has(event.outcome.toLowerCase())) {
        await this.processDeliveryOutcome(event).catch(err => {
          console.error('[EventBus] Failed to process delivery outcome (non-fatal):', err);
        });
      }
    } catch (error) {
      console.error(`❌ Failed to publish contact outcome event:`, error);
      throw error;
    }
  }

  /**
   * Gap 8: Process delivery webhook events and update action delivery status
   */
  private async processDeliveryOutcome(event: ContactOutcomeEvent): Promise<void> {
    if (!event.actionId) return;

    const outcome = (event.outcome || '').toLowerCase();

    let deliveryStatus: string | undefined;
    if (outcome === 'delivered') {
      deliveryStatus = 'delivered';
    } else if (outcome === 'bounce' || outcome === 'bounced') {
      const bounceType = event.payload?.type;
      deliveryStatus = bounceType === 'hard' ? 'failed_permanent' : 'bounced';
    } else if (outcome === 'dropped') {
      deliveryStatus = 'failed_permanent';
    } else if (outcome === 'deferred') {
      console.log(`[DeliveryStatus] Deferred event for action ${event.actionId} — keeping current status`);
      return;
    } else {
      // open, click etc. — don't change delivery status
      return;
    }

    await db.update(actions).set({
      deliveryStatus,
      deliveryConfirmedAt: new Date(),
      deliveryRawPayload: event.payload,
      providerMessageId: event.providerMessageId,
      updatedAt: new Date(),
    }).where(eq(actions.id, event.actionId));

    console.log(`[DeliveryStatus] Action ${event.actionId} → ${deliveryStatus}`);

    // Hard bounce → record in timeline for Data Health visibility
    if (deliveryStatus === 'failed_permanent' && event.contactId) {
      await this.handleHardBounce(event.tenantId, event.contactId);
    }
  }

  /**
   * Gap 8: Record hard bounce as timeline event for Data Health surfacing
   */
  private async handleHardBounce(tenantId: string, contactId: string): Promise<void> {
    try {
      await db.insert(timelineEvents).values({
        tenantId,
        customerId: contactId,
        occurredAt: new Date(),
        direction: 'internal',
        channel: 'system',
        summary: 'Email hard bounced — address may be invalid. Check Data Health.',
        outcomeType: 'no_response',
        provider: 'sendgrid',
        status: 'failed',
        outcomeExtracted: { autoDetected: true, source: 'sendgrid_webhook', eventType: 'email_hard_bounce' },
      });

      console.log(`[DataHealth] Hard bounce recorded for contact ${contactId} — will surface in Data Health`);
    } catch (err) {
      console.error('[DataHealth] Hard bounce recording failed (non-fatal):', err);
    }
  }

  /**
   * Publish a policy decision event
   */
  async publishPolicyDecision(event: PolicyDecisionEvent): Promise<void> {
    try {
      await db.insert(policyDecisions).values({
        tenantId: event.tenantId,
        contactId: event.contactId,
        invoiceId: event.invoiceId,
        actionId: event.actionId,
        policyVersion: event.policyVersion,
        experimentVariant: event.experimentVariant,
        decisionType: event.decisionType,
        channel: event.channel,
        score: event.score ? event.score.toString() : undefined,
        factor1: event.factors.factor1,
        factor2: event.factors.factor2,
        factor3: event.factors.factor3,
        scoreBreakdown: event.scoreBreakdown,
        guardStatus: event.guardStatus,
        guardReason: event.guardReason,
        decisionContext: event.decisionContext,
      });

      console.log(`🎯 Policy decision logged: ${event.decisionType} for invoice ${event.invoiceId}, score: ${event.score}, variant: ${event.experimentVariant}`);
    } catch (error) {
      console.error(`❌ Failed to publish policy decision:`, error);
      throw error;
    }
  }

  /**
   * Unified publish method - routes to appropriate handler
   */
  async publish(event: ContactOutcomeEvent | PolicyDecisionEvent): Promise<void> {
    if (event.type === 'policy.decision') {
      await this.publishPolicyDecision(event as PolicyDecisionEvent);
    } else {
      await this.publishContactOutcome(event as ContactOutcomeEvent);
    }
  }

  /**
   * Generate idempotency key from event components
   */
  generateIdempotencyKey(
    tenantId: string,
    eventType: string,
    uniqueId: string // Provider message ID, action ID, or timestamp
  ): string {
    return `${tenantId}:${eventType}:${uniqueId}`;
  }
}

// Singleton instance
export const eventBus = new EventBusService();
export default eventBus;
