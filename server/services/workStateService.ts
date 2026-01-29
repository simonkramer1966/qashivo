import { db } from "../db";
import { 
  actions, 
  auditEvents, 
  attentionItems,
  outcomes,
  collectionPolicies,
  WORK_STATE,
  IN_FLIGHT_STATE,
  OUTCOME_TYPE,
  EVENT_TYPE,
  CONFIDENCE_BAND,
  getConfidenceBand,
  HUMAN_REVIEW_THRESHOLD,
  type WorkState,
  type InFlightState,
  type OutcomeType,
  type EventType,
  type Outcome,
  type CollectionPolicy,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface SetWorkStateParams {
  actionId: string;
  tenantId: string;
  debtorId: string;
  invoiceId?: string;
  workState: WorkState;
  inFlightState?: InFlightState;
  reason: string;
  actorUserId?: string;
}

interface RouteOutcomeResult {
  workState: WorkState;
  inFlightState?: InFlightState;
  effect: 'FORECAST_UPDATED' | 'ROUTED_TO_ATTENTION' | 'MANUAL_REVIEW';
  requiresHumanReview: boolean;
  attentionItemType?: string;
}

export class WorkStateService {
  async setWorkState(params: SetWorkStateParams): Promise<void> {
    const { actionId, tenantId, debtorId, invoiceId, workState, inFlightState, reason, actorUserId } = params;

    await db.update(actions)
      .set({
        workState,
        inFlightState: inFlightState || null,
        updatedAt: new Date(),
      })
      .where(eq(actions.id, actionId));

    await this.emitAuditEvent({
      tenantId,
      debtorId,
      invoiceId,
      actionId,
      type: EVENT_TYPE.STATE_CHANGED,
      summary: `State changed to ${workState}${inFlightState ? ` (${inFlightState})` : ''}: ${reason}`,
      payload: { workState, inFlightState, reason },
      actor: actorUserId ? 'USER' : 'SYSTEM',
      actorUserId,
    });

    console.log(`🔄 WorkState: Action ${actionId} → ${workState}${inFlightState ? `/${inFlightState}` : ''} (${reason})`);
  }

  async transitionToInFlight(
    actionId: string,
    tenantId: string,
    debtorId: string,
    invoiceId: string | undefined,
    sendNow: boolean,
    actorUserId?: string
  ): Promise<void> {
    const policy = await this.getPolicy(tenantId);
    const inFlightState = sendNow ? IN_FLIGHT_STATE.SENT : IN_FLIGHT_STATE.SCHEDULED;
    
    const updates: any = {
      workState: WORK_STATE.IN_FLIGHT,
      inFlightState,
      updatedAt: new Date(),
    };

    if (sendNow) {
      const waitDays = policy?.waitDaysForReply || 3;
      updates.awaitingReplyUntil = new Date(Date.now() + waitDays * 24 * 60 * 60 * 1000);
    }

    await db.update(actions).set(updates).where(eq(actions.id, actionId));

    await this.emitAuditEvent({
      tenantId,
      debtorId,
      invoiceId,
      actionId,
      type: EVENT_TYPE.ACTION_APPROVED,
      summary: sendNow ? 'Action approved and sent' : 'Action approved and scheduled',
      payload: { sendNow, inFlightState },
      actor: actorUserId ? 'USER' : 'SYSTEM',
      actorUserId,
    });
  }

  async transitionToAwaitingReply(
    actionId: string,
    tenantId: string,
    debtorId: string,
    invoiceId?: string
  ): Promise<void> {
    const policy = await this.getPolicy(tenantId);
    const waitDays = policy?.waitDaysForReply || 3;

    await db.update(actions)
      .set({
        workState: WORK_STATE.IN_FLIGHT,
        inFlightState: IN_FLIGHT_STATE.AWAITING_REPLY,
        awaitingReplyUntil: new Date(Date.now() + waitDays * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(actions.id, actionId));

    await this.emitAuditEvent({
      tenantId,
      debtorId,
      invoiceId,
      actionId,
      type: EVENT_TYPE.MESSAGE_SENT,
      summary: `Message sent, awaiting reply for ${waitDays} days`,
      payload: { waitDays },
      actor: 'SYSTEM',
    });
  }

  async transitionToCooldown(
    actionId: string,
    tenantId: string,
    debtorId: string,
    invoiceId?: string
  ): Promise<void> {
    const policy = await this.getPolicy(tenantId);
    const cooldownDays = policy?.cooldownDaysBetweenTouches || 5;

    await db.update(actions)
      .set({
        workState: WORK_STATE.IN_FLIGHT,
        inFlightState: IN_FLIGHT_STATE.COOLDOWN,
        cooldownUntil: new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(actions.id, actionId));

    await this.emitAuditEvent({
      tenantId,
      debtorId,
      invoiceId,
      actionId,
      type: EVENT_TYPE.STATE_CHANGED,
      summary: `No reply received, entering ${cooldownDays}-day cooldown`,
      payload: { cooldownDays },
      actor: 'SYSTEM',
    });
  }

  routeFromOutcome(outcome: {
    type: OutcomeType;
    confidence: number;
  }): RouteOutcomeResult {
    const { type, confidence } = outcome;
    const confidenceBand = getConfidenceBand(confidence);
    const isLowConfidence = confidence < HUMAN_REVIEW_THRESHOLD;

    if (isLowConfidence) {
      return {
        workState: WORK_STATE.ATTENTION,
        effect: 'MANUAL_REVIEW',
        requiresHumanReview: true,
        attentionItemType: 'LOW_CONFIDENCE_OUTCOME',
      };
    }

    if (type === OUTCOME_TYPE.BANK_DETAILS_CHANGE_REQUEST) {
      return {
        workState: WORK_STATE.ATTENTION,
        effect: 'ROUTED_TO_ATTENTION',
        requiresHumanReview: true,
        attentionItemType: 'BANK_DETAILS_CHANGE_REQUEST',
      };
    }

    const attentionTypes: OutcomeType[] = [
      OUTCOME_TYPE.DISPUTE,
      OUTCOME_TYPE.DOCS_REQUESTED,
      OUTCOME_TYPE.CONTACT_ISSUE,
      OUTCOME_TYPE.CANNOT_PAY,
      OUTCOME_TYPE.PAID_ALREADY_CLAIM,
      OUTCOME_TYPE.REQUEST_CALL_BACK,
      OUTCOME_TYPE.OUT_OF_OFFICE,
      OUTCOME_TYPE.DELIVERY_FAILED,
      OUTCOME_TYPE.PAYMENT_PLAN_PROPOSED,
    ];

    if (attentionTypes.includes(type)) {
      return {
        workState: WORK_STATE.ATTENTION,
        effect: 'ROUTED_TO_ATTENTION',
        requiresHumanReview: true,
        attentionItemType: type,
      };
    }

    const inFlightTypes: OutcomeType[] = [
      OUTCOME_TYPE.PROMISE_TO_PAY,
      OUTCOME_TYPE.PAYMENT_IN_PROCESS,
    ];

    if (inFlightTypes.includes(type)) {
      return {
        workState: WORK_STATE.IN_FLIGHT,
        inFlightState: IN_FLIGHT_STATE.AWAITING_REPLY,
        effect: 'FORECAST_UPDATED',
        requiresHumanReview: false,
      };
    }

    const resolvedTypes: OutcomeType[] = [
      OUTCOME_TYPE.PAID,
      OUTCOME_TYPE.CREDIT_NOTE,
      OUTCOME_TYPE.WRITTEN_OFF,
      OUTCOME_TYPE.CANCELLED,
    ];

    if (resolvedTypes.includes(type)) {
      return {
        workState: WORK_STATE.RESOLVED,
        effect: 'FORECAST_UPDATED',
        requiresHumanReview: false,
      };
    }

    if (type === OUTCOME_TYPE.PART_PAID) {
      return {
        workState: WORK_STATE.PLAN,
        effect: 'FORECAST_UPDATED',
        requiresHumanReview: false,
      };
    }

    return {
      workState: WORK_STATE.IN_FLIGHT,
      inFlightState: IN_FLIGHT_STATE.COOLDOWN,
      effect: 'FORECAST_UPDATED',
      requiresHumanReview: false,
    };
  }

  async processOutcome(outcome: Outcome): Promise<void> {
    const routing = this.routeFromOutcome({
      type: outcome.type as OutcomeType,
      confidence: parseFloat(outcome.confidence),
    });

    await db.update(outcomes)
      .set({
        requiresHumanReview: routing.requiresHumanReview,
        effect: routing.effect,
      })
      .where(eq(outcomes.id, outcome.id));

    await this.emitAuditEvent({
      tenantId: outcome.tenantId,
      debtorId: outcome.debtorId,
      invoiceId: outcome.invoiceId || undefined,
      outcomeId: outcome.id,
      type: EVENT_TYPE.OUTCOME_EXTRACTED,
      summary: `Outcome extracted: ${outcome.type} (${getConfidenceBand(parseFloat(outcome.confidence))})`,
      payload: {
        outcomeType: outcome.type,
        confidence: outcome.confidence,
        confidenceBand: getConfidenceBand(parseFloat(outcome.confidence)),
        effect: routing.effect,
        requiresHumanReview: routing.requiresHumanReview,
      },
      actor: outcome.createdByUserId ? 'USER' : 'SYSTEM',
      actorUserId: outcome.createdByUserId || undefined,
    });

    if (routing.requiresHumanReview && routing.attentionItemType) {
      await this.createAttentionItem({
        tenantId: outcome.tenantId,
        debtorId: outcome.debtorId,
        invoiceId: outcome.invoiceId || undefined,
        type: routing.attentionItemType,
        title: this.getAttentionItemTitle(routing.attentionItemType, outcome),
        description: outcome.extracted?.freeTextNotes || undefined,
        severity: this.getAttentionSeverity(routing.attentionItemType),
      });
    }

    console.log(`📋 Outcome processed: ${outcome.type} → ${routing.workState}${routing.inFlightState ? `/${routing.inFlightState}` : ''} (${routing.effect})`);
  }

  private getAttentionItemTitle(type: string, outcome: Outcome): string {
    const titles: Record<string, string> = {
      'LOW_CONFIDENCE_OUTCOME': 'Low confidence outcome needs review',
      'BANK_DETAILS_CHANGE_REQUEST': 'Bank details change request (high-risk)',
      'DISPUTE': 'Invoice disputed',
      'DOCS_REQUESTED': 'Documents requested',
      'CONTACT_ISSUE': 'Contact issue reported',
      'CANNOT_PAY': 'Cannot pay',
      'PAID_ALREADY_CLAIM': 'Claims already paid (check allocation)',
      'REQUEST_CALL_BACK': 'Call back requested',
      'OUT_OF_OFFICE': 'Out of office',
      'DELIVERY_FAILED': 'Message delivery failed',
      'PAYMENT_PLAN_PROPOSED': 'Payment plan proposed',
    };
    return titles[type] || `Outcome requires attention: ${type}`;
  }

  private getAttentionSeverity(type: string): string {
    const highSeverity = ['BANK_DETAILS_CHANGE_REQUEST', 'CANNOT_PAY'];
    const criticalSeverity = ['DISPUTE'];
    
    if (criticalSeverity.includes(type)) return 'CRITICAL';
    if (highSeverity.includes(type)) return 'HIGH';
    return 'MEDIUM';
  }

  private async createAttentionItem(params: {
    tenantId: string;
    debtorId: string;
    invoiceId?: string;
    type: string;
    title: string;
    description?: string;
    severity: string;
  }): Promise<void> {
    await db.insert(attentionItems).values({
      tenantId: params.tenantId,
      contactId: params.debtorId,
      invoiceId: params.invoiceId,
      type: params.type,
      title: params.title,
      description: params.description,
      severity: params.severity,
      status: 'OPEN',
    });

    console.log(`⚠️ Attention item created: ${params.type} - ${params.title}`);
  }

  async emitAuditEvent(params: {
    tenantId: string;
    debtorId?: string;
    invoiceId?: string;
    actionId?: string;
    outcomeId?: string;
    type: EventType;
    summary: string;
    payload?: Record<string, any>;
    actor: 'SYSTEM' | 'USER';
    actorUserId?: string;
  }): Promise<void> {
    await db.insert(auditEvents).values({
      tenantId: params.tenantId,
      debtorId: params.debtorId,
      invoiceId: params.invoiceId,
      actionId: params.actionId,
      outcomeId: params.outcomeId,
      type: params.type,
      summary: params.summary,
      payload: params.payload,
      actor: params.actor,
      actorUserId: params.actorUserId,
    });
  }

  private async getPolicy(tenantId: string): Promise<CollectionPolicy | null> {
    const [policy] = await db.select()
      .from(collectionPolicies)
      .where(and(
        eq(collectionPolicies.tenantId, tenantId),
        eq(collectionPolicies.isDefault, true)
      ))
      .limit(1);

    return policy || null;
  }
}

export const workStateService = new WorkStateService();
