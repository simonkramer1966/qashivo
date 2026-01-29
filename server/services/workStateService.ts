import { db } from "../db";
import { 
  actions, 
  auditEvents, 
  attentionItems,
  outcomes,
  collectionPolicies,
  forecastPoints,
  invoices,
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
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

interface DerivedExpectation {
  expectedPaymentDate: Date | null;
  confidenceBand: 'HIGH' | 'MEDIUM' | 'LOW';
  paymentAmount: number | null;
  reason: string;
}

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

    // Update outcome with routing results
    await db.update(outcomes)
      .set({
        requiresHumanReview: routing.requiresHumanReview,
        effect: routing.effect,
      })
      .where(eq(outcomes.id, outcome.id));

    // Emit OUTCOME_EXTRACTED audit event
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

    // Find and update related action's workState
    const relatedActions = await db.select()
      .from(actions)
      .where(and(
        eq(actions.tenantId, outcome.tenantId),
        eq(actions.contactId, outcome.debtorId),
        outcome.invoiceId ? eq(actions.invoiceId, outcome.invoiceId) : sql`1=1`
      ))
      .orderBy(desc(actions.createdAt))
      .limit(1);

    if (relatedActions.length > 0) {
      const action = relatedActions[0];
      const policy = await this.getPolicy(outcome.tenantId);
      
      // Update action workState based on routing
      const updates: any = {
        workState: routing.workState,
        inFlightState: routing.inFlightState || null,
        updatedAt: new Date(),
      };

      // Set expected payment fields for PROMISE_TO_PAY/PAYMENT_IN_PROCESS
      if (routing.effect === 'FORECAST_UPDATED' && routing.workState === WORK_STATE.IN_FLIGHT) {
        const waitDays = policy?.waitDaysForReply || 3;
        updates.awaitingReplyUntil = new Date(Date.now() + waitDays * 24 * 60 * 60 * 1000);
      }

      await db.update(actions)
        .set(updates)
        .where(eq(actions.id, action.id));

      // Emit STATE_CHANGED audit event
      await this.emitAuditEvent({
        tenantId: outcome.tenantId,
        debtorId: outcome.debtorId,
        invoiceId: outcome.invoiceId || undefined,
        actionId: action.id,
        outcomeId: outcome.id,
        type: EVENT_TYPE.STATE_CHANGED,
        summary: `Action state changed: ${action.workState || 'none'} → ${routing.workState}`,
        payload: {
          previousWorkState: action.workState,
          newWorkState: routing.workState,
          inFlightState: routing.inFlightState,
          triggeredByOutcome: outcome.type,
        },
        actor: outcome.createdByUserId ? 'USER' : 'SYSTEM',
        actorUserId: outcome.createdByUserId || undefined,
      });

      console.log(`🔄 Action ${action.id} state updated: ${action.workState || 'none'} → ${routing.workState}`);
    }

    // Create attention item if needed
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

      // Emit ROUTED_TO_ATTENTION audit event
      await this.emitAuditEvent({
        tenantId: outcome.tenantId,
        debtorId: outcome.debtorId,
        invoiceId: outcome.invoiceId || undefined,
        outcomeId: outcome.id,
        type: EVENT_TYPE.ROUTED_TO_ATTENTION,
        summary: `Outcome routed to attention: ${routing.attentionItemType}`,
        payload: {
          attentionItemType: routing.attentionItemType,
          severity: this.getAttentionSeverity(routing.attentionItemType),
        },
        actor: 'SYSTEM',
      });
    }

    // Update forecast confidence buckets if effect is FORECAST_UPDATED
    if (routing.effect === 'FORECAST_UPDATED' && outcome.invoiceId) {
      await this.updateForecastFromOutcome(outcome);

      // Emit FORECAST_UPDATED audit event
      await this.emitAuditEvent({
        tenantId: outcome.tenantId,
        debtorId: outcome.debtorId,
        invoiceId: outcome.invoiceId,
        outcomeId: outcome.id,
        type: EVENT_TYPE.FORECAST_UPDATED,
        summary: `Forecast updated from outcome: ${outcome.type}`,
        payload: {
          outcomeType: outcome.type,
          confidence: outcome.confidence,
        },
        actor: 'SYSTEM',
      });
    }

    console.log(`📋 Outcome processed: ${outcome.type} → ${routing.workState}${routing.inFlightState ? `/${routing.inFlightState}` : ''} (${routing.effect})`);
  }

  async deriveExpectation(invoiceId: string, tenantId: string): Promise<DerivedExpectation> {
    // Get latest outcomes for this invoice
    const latestOutcomes = await db.select()
      .from(outcomes)
      .where(and(
        eq(outcomes.invoiceId, invoiceId),
        eq(outcomes.tenantId, tenantId)
      ))
      .orderBy(desc(outcomes.createdAt))
      .limit(5);

    if (latestOutcomes.length === 0) {
      // No outcomes, use invoice due date as low confidence expectation
      const [invoice] = await db.select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);

      return {
        expectedPaymentDate: invoice?.dueDate || null,
        confidenceBand: 'LOW',
        paymentAmount: invoice ? parseFloat(invoice.amount || '0') : null,
        reason: 'No debtor response, using due date',
      };
    }

    const latestOutcome = latestOutcomes[0];
    const outcomeType = latestOutcome.type as OutcomeType;
    const extracted = latestOutcome.extracted as any;

    // PROMISE_TO_PAY with date = HIGH confidence
    if (outcomeType === OUTCOME_TYPE.PROMISE_TO_PAY && extracted?.promisedPaymentDate) {
      return {
        expectedPaymentDate: new Date(extracted.promisedPaymentDate),
        confidenceBand: 'HIGH',
        paymentAmount: extracted?.promisedAmount || null,
        reason: 'Promise to pay with specific date',
      };
    }

    // PAYMENT_IN_PROCESS = HIGH confidence (soon)
    if (outcomeType === OUTCOME_TYPE.PAYMENT_IN_PROCESS) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 3); // Expect within 3 days
      return {
        expectedPaymentDate: expectedDate,
        confidenceBand: 'HIGH',
        paymentAmount: extracted?.amount || null,
        reason: 'Payment in process',
      };
    }

    // PROMISE_TO_PAY without date = MEDIUM confidence
    if (outcomeType === OUTCOME_TYPE.PROMISE_TO_PAY) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 7); // Expect within 7 days
      return {
        expectedPaymentDate: expectedDate,
        confidenceBand: 'MEDIUM',
        paymentAmount: extracted?.promisedAmount || null,
        reason: 'Promise to pay without specific date',
      };
    }

    // DISPUTE/CANNOT_PAY = exclude from forecast
    if (outcomeType === OUTCOME_TYPE.DISPUTE || outcomeType === OUTCOME_TYPE.CANNOT_PAY) {
      return {
        expectedPaymentDate: null,
        confidenceBand: 'LOW',
        paymentAmount: null,
        reason: `Excluded: ${outcomeType}`,
      };
    }

    // Default: LOW confidence based on historical patterns
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 14);
    return {
      expectedPaymentDate: expectedDate,
      confidenceBand: 'LOW',
      paymentAmount: null,
      reason: 'No strong payment signal',
    };
  }

  private async updateForecastFromOutcome(outcome: Outcome): Promise<void> {
    if (!outcome.invoiceId) return;

    const expectation = await this.deriveExpectation(outcome.invoiceId, outcome.tenantId);
    
    if (!expectation.expectedPaymentDate) {
      console.log(`📊 No forecast update: outcome excluded (${expectation.reason})`);
      return;
    }

    // Get invoice amount
    const [invoice] = await db.select()
      .from(invoices)
      .where(eq(invoices.id, outcome.invoiceId))
      .limit(1);

    if (!invoice) return;

    const amount = parseFloat(invoice.amount || '0');
    if (amount <= 0) return;

    // Get or create forecast point for the expected date bucket
    const dateBucket = new Date(expectation.expectedPaymentDate);
    dateBucket.setHours(0, 0, 0, 0);

    const existingPoints = await db.select()
      .from(forecastPoints)
      .where(and(
        eq(forecastPoints.tenantId, outcome.tenantId),
        eq(forecastPoints.dateBucket, dateBucket),
        eq(forecastPoints.bucketType, 'DAY')
      ))
      .limit(1);

    if (existingPoints.length > 0) {
      // Update existing forecast point
      const point = existingPoints[0];
      const updates: any = { computedAt: new Date(), triggerEvent: 'OUTCOME_RECEIVED' };

      if (expectation.confidenceBand === 'HIGH') {
        updates.highAmount = sql`${forecastPoints.highAmount} + ${amount}`;
        updates.highInvoiceCount = sql`${forecastPoints.highInvoiceCount} + 1`;
      } else if (expectation.confidenceBand === 'MEDIUM') {
        updates.mediumAmount = sql`${forecastPoints.mediumAmount} + ${amount}`;
        updates.mediumInvoiceCount = sql`${forecastPoints.mediumInvoiceCount} + 1`;
      } else {
        updates.lowAmount = sql`${forecastPoints.lowAmount} + ${amount}`;
        updates.lowInvoiceCount = sql`${forecastPoints.lowInvoiceCount} + 1`;
      }

      await db.update(forecastPoints)
        .set(updates)
        .where(eq(forecastPoints.id, point.id));
    } else {
      // Create new forecast point
      const newPoint: any = {
        tenantId: outcome.tenantId,
        dateBucket,
        bucketType: 'DAY',
        highAmount: '0',
        mediumAmount: '0',
        lowAmount: '0',
        highInvoiceCount: 0,
        mediumInvoiceCount: 0,
        lowInvoiceCount: 0,
        excludedAmount: '0',
        excludedInvoiceCount: 0,
        computedAt: new Date(),
        triggerEvent: 'OUTCOME_RECEIVED',
      };

      if (expectation.confidenceBand === 'HIGH') {
        newPoint.highAmount = amount.toString();
        newPoint.highInvoiceCount = 1;
      } else if (expectation.confidenceBand === 'MEDIUM') {
        newPoint.mediumAmount = amount.toString();
        newPoint.mediumInvoiceCount = 1;
      } else {
        newPoint.lowAmount = amount.toString();
        newPoint.lowInvoiceCount = 1;
      }

      await db.insert(forecastPoints).values(newPoint);
    }

    console.log(`📊 Forecast updated: ${expectation.confidenceBand} band, £${amount} expected on ${dateBucket.toISOString().split('T')[0]}`);
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
