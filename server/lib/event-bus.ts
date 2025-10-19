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
import { contactOutcomes, policyDecisions } from "@shared/schema";
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
    } catch (error) {
      console.error(`❌ Failed to publish contact outcome event:`, error);
      throw error;
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
