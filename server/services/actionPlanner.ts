import { eq, and, lte, gte, sql, inArray, isNotNull } from "drizzle-orm";
import { db } from "../db";
import {
  invoices,
  contacts,
  collectionSchedules,
  customerScheduleAssignments,
  tenants,
  actions,
  customerBehaviorSignals,
  customerPreferences,
  customerLearningProfiles,
  debtorGroups,
  decisionAuditLog,
} from "@shared/schema";
import { CollectionLearningService } from "./collectionLearningService";
import {
  scheduleNextTouch,
  type AdaptiveSettings,
  type CustomerContext,
  type InvoiceContext,
  type SchedulerConstraints,
  type Channel
} from "../lib/adaptive-scheduler";
import { differenceInDays } from "date-fns";
import { getEffectiveSeasonalAdjustments, type SeasonalAdjustment } from "./paymentDistribution";
import { evaluateDecisionTree, type DebtorDecisionInput } from "./decisionTree";
import { getRolling30DayDSO, getARSummary } from "./arCalculations";
import crypto from "crypto";

// Utility: Format currency for display
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

interface ScheduleStep {
  daysTrigger: number;
  actionType: 'email' | 'sms' | 'whatsapp' | 'voice' | 'manual_call';
  timeOfDay: string; // "HH:MM" format e.g., "14:30"
  template?: string;
  subject?: string;
  message?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  escalationLevel?: string;
  agentId?: string; // For voice calls
}

interface PlannedAction {
  invoiceId: string;
  contactId: string;
  tenantId: string;
  actionType: 'email' | 'sms' | 'whatsapp' | 'voice' | 'manual_call';
  scheduledFor: Date;
  subject?: string;
  content?: string;
  metadata: any;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Action Planner Service
 * Phase 1 of two-phase scheduling:
 * - Scans overdue invoices
 * - Calculates when actions should be sent (daysTrigger + timeOfDay)
 * - Creates scheduled actions in the queue
 * - Does NOT execute actions
 */
export class ActionPlanner {
  private learningService: CollectionLearningService;

  constructor() {
    this.learningService = new CollectionLearningService();
  }

  /**
   * Plan actions for all tenants with automation enabled
   */
  async planActionsForAllTenants(): Promise<void> {
    const enabledTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        xeroLastSyncAt: tenants.xeroLastSyncAt,
      })
      .from(tenants)
      .where(eq(tenants.collectionsAutomationEnabled, true));

    console.log(`📋 Action Planner: Found ${enabledTenants.length} tenants with automation enabled`);

    const STALE_SYNC_THRESHOLD_HOURS = 6;

    for (const tenant of enabledTenants) {
      try {
        // Sync freshness guard: skip planning if data is stale
        if (tenant.xeroLastSyncAt) {
          const hoursSinceSync = (Date.now() - tenant.xeroLastSyncAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceSync > STALE_SYNC_THRESHOLD_HOURS) {
            console.warn(`⚠️ Action Planner: Skipping tenant ${tenant.name} — sync data stale (last sync: ${tenant.xeroLastSyncAt.toISOString()}, ${Math.round(hoursSinceSync)}h ago)`);
            continue;
          }
        }
        await this.planActionsForTenant(tenant.id);
      } catch (error: any) {
        console.error(`❌ Action Planner: Error planning actions for tenant ${tenant.name}:`, error.message);
      }
    }
  }

  /**
   * Plan actions for a specific tenant
   */
  async planActionsForTenant(tenantId: string): Promise<PlannedAction[]> {
    const today = new Date();
    const plannedActions: PlannedAction[] = [];

    try {
      // Get all unpaid/overdue invoices with their contacts and assignments
      const overdueInvoices = await db
        .select({
          invoice: invoices,
          contact: contacts,
          assignment: customerScheduleAssignments,
          schedule: collectionSchedules,
        })
        .from(invoices)
        .innerJoin(contacts, eq(invoices.contactId, contacts.id))
        .leftJoin(
          customerScheduleAssignments,
          and(
            eq(customerScheduleAssignments.contactId, contacts.id),
            eq(customerScheduleAssignments.isActive, true)
          )
        )
        .leftJoin(
          collectionSchedules,
          and(
            eq(collectionSchedules.id, customerScheduleAssignments.scheduleId),
            eq(collectionSchedules.isActive, true)
          )
        )
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            lte(invoices.dueDate, today),
            gte(invoices.amount, invoices.amountPaid || 0),
            sql`${invoices.status} NOT IN ('paid', 'cancelled', 'void')`,
            sql`${invoices.pauseState} IS NULL` // Skip paused invoices (disputes, PTPs, payment plans)
          )
        );

      console.log(`📊 Action Planner: Found ${overdueInvoices.length} overdue invoices for tenant ${tenantId}`);

      for (const record of overdueInvoices) {
        const { invoice, contact, assignment, schedule } = record;

        // Skip if no schedule assigned
        if (!assignment || !schedule) {
          continue;
        }

        // Skip if invoice has active demo session
        const demoCheck = await db
          .select()
          .from(actions)
          .where(
            and(
              eq(actions.invoiceId, invoice.id),
              sql`${actions.metadata}->>'demoMode' = 'true'`
            )
          )
          .limit(1);

        if (demoCheck.length > 0) {
          console.log(`🎬 Skipping invoice ${invoice.invoiceNumber} - active demo session`);
          continue;
        }

        // Calculate days overdue (negative = pre-due)
        const dueDate = new Date(invoice.dueDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Skip pre-due invoices in static planner (pre-due handled by adaptive path only)
        if (daysOverdue < 0) {
          continue;
        }

        // Route to adaptive or static scheduler based on schedulerType
        if (schedule.schedulerType === 'adaptive') {
          // Use adaptive scheduler
          const adaptivePlannedAction = await this.planAdaptiveAction(
            invoice,
            contact,
            schedule,
            tenantId
          );
          
          if (adaptivePlannedAction) {
            plannedActions.push(adaptivePlannedAction);
          }
        } else {
          // Use static scheduler (existing logic)
          // Parse schedule steps
          let scheduleSteps: ScheduleStep[] = [];
          try {
            scheduleSteps = Array.isArray(schedule.scheduleSteps) 
              ? schedule.scheduleSteps as ScheduleStep[]
              : [];
          } catch (error) {
            console.error(`Error parsing schedule steps for schedule ${schedule.id}:`, error);
            continue;
          }

          // Find matching step for current days overdue
          const matchingStep = scheduleSteps.find(step => step.daysTrigger === daysOverdue);
          
          if (!matchingStep) {
            continue;
          }

          // Check if action already exists for this invoice/contact/day
          const existingAction = await this.findExistingScheduledAction(
            invoice.id, 
            contact.id, 
            daysOverdue,
            matchingStep.actionType
          );

          if (existingAction) {
            console.log(`⏭️  Action already scheduled for invoice ${invoice.invoiceNumber}, skipping`);
            continue;
          }

          // Calculate scheduled time
          const scheduledFor = this.calculateScheduledTime(dueDate, daysOverdue, matchingStep.timeOfDay);

          // Create planned action
          const plannedAction: PlannedAction = {
            invoiceId: invoice.id,
            contactId: contact.id,
            tenantId,
            actionType: matchingStep.actionType,
            scheduledFor,
            subject: matchingStep.subject,
            content: matchingStep.message,
            metadata: {
              scheduleId: schedule.id,
              scheduleName: schedule.name,
              daysOverdue,
              templateId: matchingStep.template,
              agentId: matchingStep.agentId,
              timeOfDay: matchingStep.timeOfDay,
            },
            priority: matchingStep.priority || 'normal',
          };

          plannedActions.push(plannedAction);
        }
      }

      // Apply AI optimization to planned actions
      if (plannedActions.length > 0) {
        console.log(`🧠 Action Planner: Optimizing ${plannedActions.length} planned actions with AI`);
        const optimizedActions = await this.optimizePlannedActions(plannedActions);
        
        // Create scheduled actions in database
        await this.createScheduledActions(optimizedActions);
        
        console.log(`✅ Action Planner: Created ${optimizedActions.length} scheduled actions`);
      }

      return plannedActions;
    } catch (error: any) {
      console.error('Action Planner error:', error);
      throw new Error(`Failed to plan actions: ${error.message}`);
    }
  }

  /**
   * Plan an adaptive action using the adaptive scheduler
   */
  private async planAdaptiveAction(
    invoice: any,
    contact: any,
    schedule: any,
    tenantId: string
  ): Promise<PlannedAction | null> {
    try {
      // Get adaptive settings from schedule
      const adaptiveSettings = schedule.adaptiveSettings as any;
      if (!adaptiveSettings) {
        console.warn(`Adaptive schedule ${schedule.id} has no adaptiveSettings configured`);
        return null;
      }

      // Get customer behavior signals
      const behaviorSignals = await db
        .select()
        .from(customerBehaviorSignals)
        .where(
          and(
            eq(customerBehaviorSignals.contactId, contact.id),
            eq(customerBehaviorSignals.tenantId, tenantId)
          )
        )
        .limit(1);

      const behavior = behaviorSignals[0] || null;

      // Gap 11: Fetch debtor channel preference overrides + contact timing + blackout
      const debtorPrefs = await db.query.customerPreferences.findFirst({
        where: and(
          eq(customerPreferences.contactId, contact.id),
          eq(customerPreferences.tenantId, tenantId),
        ),
      });
      const emailAllowed = (debtorPrefs?.emailEnabled !== false) && !!contact.email;
      const smsAllowed = (debtorPrefs?.smsEnabled !== false) && !!contact.phone;
      const voiceAllowed = (debtorPrefs?.voiceEnabled !== false) && !!contact.phone;

      // Gap 13: Fetch seasonal adjustments for this contact
      let seasonalAdj: SeasonalAdjustment[] = [];
      try {
        seasonalAdj = await getEffectiveSeasonalAdjustments(tenantId, contact.id);
      } catch { /* non-fatal */ }

      // Build customer context
      const customerContext: CustomerContext = {
        segment: behavior?.segment || contact.segment || "default",
        behavior: behavior || undefined,
        channelPrefs: {
          email: emailAllowed,
          sms: smsAllowed,
          call: voiceAllowed,
          whatsapp: smsAllowed, // WhatsApp follows SMS preference
        },
        seasonalAdjustments: seasonalAdj,
      };

      // Build invoice context
      const dueDate = new Date(invoice.dueDate);
      const issuedDate = new Date(invoice.issueDate || invoice.dueDate);
      const today = new Date();
      const ageDays = differenceInDays(today, dueDate);
      const outstanding = invoice.amount - (invoice.amountPaid || 0);

      // Get last touch time from actions
      const lastAction = await db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.contactId, contact.id),
            eq(actions.invoiceId, invoice.id),
            sql`${actions.status} IN ('completed', 'sent')`,
            sql`(${actions.deliveryStatus} IS NULL OR ${actions.deliveryStatus} NOT IN ('failed', 'failed_permanent', 'bounced'))`
          )
        )
        .orderBy(sql`${actions.completedAt} DESC NULLS LAST`)
        .limit(1);

      const lastTouchAt = lastAction[0]?.completedAt ? new Date(lastAction[0].completedAt) : undefined;
      
      // Comprehensive action type to Channel mapping
      const mapActionTypeToChannel = (type: string | undefined): Channel | undefined => {
        if (!type) return undefined;
        const normalized = type.toLowerCase();
        
        // Voice-based channels
        if (normalized.includes('voice') || normalized.includes('call') || normalized.includes('ivr')) {
          return 'call';
        }
        
        // Email channels
        if (normalized.includes('email')) {
          return 'email';
        }
        
        // SMS channels
        if (normalized.includes('sms')) {
          return 'sms';
        }
        
        // WhatsApp channels
        if (normalized.includes('whatsapp')) {
          return 'whatsapp';
        }
        
        // Default fallback: treat as email for unrecognized types
        return 'email';
      };
      
      const lastChannel = mapActionTypeToChannel(lastAction[0]?.type);

      const invoiceContext: InvoiceContext = {
        amount: outstanding,
        dueAt: dueDate,
        issuedAt: issuedDate,
        ageDays: Math.max(0, ageDays),
        lastTouchAt,
        lastChannel,
        dispute: invoice.status === 'disputed',
        promiseToPayAt: invoice.promiseToPayDate ? new Date(invoice.promiseToPayDate) : undefined,
      };

      // Gap 3: Use per-debtor urgency if available, else fall back to flat tenant urgency
      const debtorProfile = await db.query.customerLearningProfiles.findFirst({
        where: and(
          eq(customerLearningProfiles.contactId, contact.id),
          eq(customerLearningProfiles.tenantId, tenantId),
        ),
        columns: { debtorUrgency: true },
      });
      const urgencyFactor = debtorProfile?.debtorUrgency
        ? Number(debtorProfile.debtorUrgency)
        : Number(adaptiveSettings.urgencyFactor || 0.5);

      // ── Decision Tree Feature Flag ──────────────────────────────
      const [tenantRecordForTree] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      if (tenantRecordForTree?.useDecisionTree) {
        // Load full learning profile for decision tree
        const fullProfile = await db.query.customerLearningProfiles.findFirst({
          where: and(
            eq(customerLearningProfiles.contactId, contact.id),
            eq(customerLearningProfiles.tenantId, tenantId),
          ),
        });

        // Load DSO context (one pair of queries per tenant — could be cached in caller)
        const [rollingDSO, arSummary] = await Promise.all([
          getRolling30DayDSO(tenantId),
          getARSummary(tenantId),
        ]);

        // Consecutive no-response count
        const noResponseResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(actions)
          .where(and(
            eq(actions.contactId, contact.id),
            eq(actions.tenantId, tenantId),
            sql`${actions.status} IN ('completed', 'sent')`,
            sql`${actions.completedAt} > COALESCE(${sql.raw(`(SELECT MAX(last_inbound_at) FROM contacts WHERE id = '${contact.id}')`)}, '1970-01-01')`,
          ));
        const consecutiveNoResponseCount = Number(noResponseResult[0]?.count ?? 0);

        // Total outstanding for this debtor across all invoices
        const debtorTotalResult = await db
          .select({ total: sql<number>`COALESCE(SUM(${invoices.amount} - COALESCE(${invoices.amountPaid}, 0)), 0)` })
          .from(invoices)
          .where(and(
            eq(invoices.contactId, contact.id),
            eq(invoices.tenantId, tenantId),
            sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`,
          ));
        const totalOutstandingForDebtor = Number(debtorTotalResult[0]?.total ?? 0);

        // Get last completed action for velocity cap
        const lastActionRows = await db
          .select({
            completedAt: actions.completedAt,
            type: actions.type,
            agentToneLevel: actions.agentToneLevel,
          })
          .from(actions)
          .where(and(
            eq(actions.contactId, contact.id),
            eq(actions.tenantId, tenantId),
            sql`${actions.status} IN ('completed', 'sent')`,
          ))
          .orderBy(sql`${actions.completedAt} DESC NULLS LAST`)
          .limit(1);

        const lastActionData = lastActionRows[0] ?? null;
        const cooldowns = (tenantRecordForTree.channelCooldowns as { email?: number; sms?: number; voice?: number } | null) ?? { email: 3, sms: 5, voice: 7 };

        const decisionInput: DebtorDecisionInput = {
          now: new Date(),
          communicationModeOff: tenantRecordForTree.communicationMode === 'off',
          recentInboundUnprocessed: false, // TODO: wire when inbound processing queue is built
          consecutiveNoResponseCount,
          paymentPlanFailureCount: Number(fullProfile?.promisesBroken ?? 0),
          totalOutstandingForDebtor,
          hasActiveDispute: invoice.status === 'disputed',
          hasActivePaymentPlan: invoice.pauseState === 'payment_plan',

          invoice: {
            id: invoice.id,
            amount: Number(invoice.amount || 0),
            amountPaid: Number(invoice.amountPaid || 0),
            dueDate: new Date(invoice.dueDate),
            issueDate: new Date(invoice.issueDate || invoice.dueDate),
            status: invoice.status || 'unknown',
            pauseState: invoice.pauseState || null,
            escalationFlag: !!invoice.escalationFlag,
            legalFlag: !!invoice.legalFlag,
            promiseToPayDate: invoice.promiseToPayDate ? new Date(invoice.promiseToPayDate) : null,
            balance: Number(invoice.amount || 0) - Number(invoice.amountPaid || 0),
            collectionStage: invoice.collectionStage || null,
          },
          contact: {
            id: contact.id,
            email: contact.email || contact.arContactEmail || null,
            phone: contact.phone || contact.arContactPhone || null,
            paymentTerms: contact.paymentTerms ?? 30,
            riskScore: contact.riskScore ?? null,
            manualBlocked: !!contact.manualBlocked,
            probablePaymentDetected: !!contact.probablePaymentDetected,
            probablePaymentConfidence: contact.probablePaymentConfidence || null,
            legalResponseWindowEnd: contact.legalResponseWindowEnd ? new Date(contact.legalResponseWindowEnd) : null,
            isVip: !!contact.isVip,
            isException: !!contact.isException,
            isPotentiallyVulnerable: !!contact.isPotentiallyVulnerable,
            wrongPartyRisk: contact.wrongPartyRisk || 'NONE',
            lastOutboundAt: contact.lastOutboundAt ? new Date(contact.lastOutboundAt) : null,
            lastOutboundChannel: contact.lastOutboundChannel || null,
            lastInboundAt: contact.lastInboundAt ? new Date(contact.lastInboundAt) : null,
            contactCountLast30d: contact.contactCountLast30d ?? 0,
            nextTouchNotBefore: contact.nextTouchNotBefore ? new Date(contact.nextTouchNotBefore) : null,
            companiesHouseStatus: null, // TODO: wire from debtorIntelligence table
            // Per-debtor contact timing overrides
            businessHoursStart: debtorPrefs?.bestContactWindowStart || null,
            businessHoursEnd: debtorPrefs?.bestContactWindowEnd || null,
            contactTimezone: debtorPrefs?.contactTimezone || null,
            contactDays: (debtorPrefs?.bestContactDays as string[] | null) || null,
            // Blackout
            doNotContactFrom: debtorPrefs?.doNotContactFrom ? new Date(debtorPrefs.doNotContactFrom) : null,
            doNotContactUntil: debtorPrefs?.doNotContactUntil ? new Date(debtorPrefs.doNotContactUntil) : null,
            doNotContactReason: debtorPrefs?.doNotContactReason || null,
          },
          behavior: {
            medianDaysToPay: behavior ? Number(behavior.medianDaysToPay ?? null) : null,
            p75DaysToPay: behavior ? Number(behavior.p75DaysToPay ?? null) : null,
            volatility: behavior ? Number(behavior.volatility ?? null) : null,
            trend: behavior ? Number(behavior.trend ?? null) : null,
            emailReplyRate: behavior ? Number(behavior.emailReplyRate ?? null) : null,
            smsReplyRate: behavior ? Number(behavior.smsReplyRate ?? null) : null,
            voiceReplyRate: null, // Not tracked in behavior signals schema yet
            segment: behavior?.segment || null,
            invoiceCount: behavior ? Number(behavior.invoiceCount ?? 0) : 0,
            disputeCount: behavior ? Number(behavior.disputeCount ?? 0) : 0,
            promiseBreachCount: Number(fullProfile?.promisesBroken ?? 0),
          },
          learningProfile: {
            emailEffectiveness: parseFloat(fullProfile?.emailEffectiveness || '0.5'),
            smsEffectiveness: parseFloat(fullProfile?.smsEffectiveness || '0.5'),
            voiceEffectiveness: parseFloat(fullProfile?.voiceEffectiveness || '0.5'),
            debtorUrgency: fullProfile?.debtorUrgency ? Number(fullProfile.debtorUrgency) : null,
            prsRaw: fullProfile?.prsRaw ? Number(fullProfile.prsRaw) : null,
            prsConfidence: fullProfile?.prsConfidence ? Number(fullProfile.prsConfidence) : null,
            isSerialPromiser: !!(fullProfile as any)?.isSerialPromiser,
            isReliableLatePayer: !!(fullProfile as any)?.isReliableLatePayer,
            responsiveness: (fullProfile as any)?.responsiveness || null,
            sentimentTrend: (fullProfile as any)?.sentimentTrend || null,
            paymentReliability: (fullProfile as any)?.paymentReliability ? Number((fullProfile as any).paymentReliability) : null,
            learningConfidence: fullProfile?.learningConfidence ? Number(fullProfile.learningConfidence) : null,
          },
          channelPrefs: {
            emailEnabled: (debtorPrefs?.emailEnabled !== false) && !!contact.email,
            smsEnabled: (debtorPrefs?.smsEnabled !== false) && !!contact.phone,
            voiceEnabled: (debtorPrefs?.voiceEnabled !== false) && !!contact.phone,
            preferredChannelOverride: debtorPrefs?.preferredChannelOverride || null,
          },
          tenantSettings: {
            chaseDelayDays: tenantRecordForTree.chaseDelayDays ?? 5,
            preDueDateDays: tenantRecordForTree.preDueDateDays ?? 7,
            preDueDateMinAmount: parseFloat(tenantRecordForTree.preDueDateMinAmount || '1000'),
            minimumChaseThreshold: parseFloat(tenantRecordForTree.minimumChaseThreshold || '50'),
            noResponseEscalationThreshold: tenantRecordForTree.noResponseEscalationThreshold ?? 4,
            significantPaymentThreshold: parseFloat(tenantRecordForTree.significantPaymentThreshold || '0.50'),
            channelCooldowns: {
              email: cooldowns.email ?? 3,
              sms: cooldowns.sms ?? 5,
              voice: cooldowns.voice ?? 7,
            },
            dsoImpactThreshold: parseFloat(tenantRecordForTree.dsoImpactThreshold || '1.00'),
            tenantStyle: (tenantRecordForTree.tenantStyle as 'GENTLE' | 'STANDARD' | 'FIRM') || 'STANDARD',
            businessHoursStart: tenantRecordForTree.businessHoursStart || '08:00',
            businessHoursEnd: tenantRecordForTree.businessHoursEnd || '18:00',
          },
          lastAction: lastActionData?.completedAt ? {
            completedAt: new Date(lastActionData.completedAt),
            type: lastActionData.type || 'email',
            agentToneLevel: (lastActionData.agentToneLevel as any) || null,
          } : null,
          dsoContext: {
            currentDSO: rollingDSO,
            totalOutstanding: arSummary.totalOutstanding,
            debtorOutstanding: totalOutstandingForDebtor,
            debtorPaymentTerms: contact.paymentTerms ?? 30,
          },
        };

        const decision = evaluateDecisionTree(decisionInput);

        // Generate audit ID for outcome linkage
        const auditId = crypto.randomUUID();

        // Audit log (async, non-blocking, non-fatal)
        db.insert(decisionAuditLog).values({
          id: auditId,
          tenantId,
          contactId: contact.id,
          invoiceId: invoice.id,
          gatesEvaluated: decision.gatesEvaluated,
          stoppedAtGate: decision.gateNode || null,
          holdReason: decision.holdReason || null,
          behaviouralCategory: decision.behaviouralCategory || null,
          decision: decision.action,
          phaseSelected: decision.phase || null,
          toneSelected: decision.tone || null,
          channelSelected: decision.channel || null,
          dsoAcceptance: decision.dsoAcceptance?.acceptance || null,
          dsoImpact: decision.dsoAcceptance?.dsoImpact?.toString() || null,
          partialPaymentTarget: decision.dsoAcceptance?.partialPaymentNeeded?.toString() || null,
          inputSnapshot: decisionInput,
          reasoning: decision.reasoning,
        }).catch(err => console.error('[DecisionTree] Audit log write failed:', err));

        if (decision.action === 'HOLD') {
          console.log(`🌳 [DecisionTree] HOLD for ${contact.name} invoice ${invoice.invoiceNumber}: ${decision.holdReason}`);
          return null;
        }

        // Map to PlannedAction
        const actionType = decision.channel === 'voice' ? 'voice' : decision.channel!;
        console.log(`🌳 [DecisionTree] CONTACT ${contact.name}: ${decision.channel} ${decision.tone} (${decision.behaviouralCategory})`);

        return {
          invoiceId: invoice.id,
          contactId: contact.id,
          tenantId,
          actionType: actionType as 'email' | 'sms' | 'whatsapp' | 'voice' | 'manual_call',
          scheduledFor: decision.scheduledFor!,
          metadata: {
            scheduleId: schedule.id,
            schedulerType: 'decision_tree',
            behaviouralCategory: decision.behaviouralCategory,
            collectionPhase: decision.phase,
            agentToneLevel: decision.tone,
            dsoAcceptance: decision.dsoAcceptance,
            reasoning: decision.reasoning,
            decisionEvaluationId: auditId,
          },
          priority: 'normal',
        };
      }
      // ── End Decision Tree Feature Flag ──────────────────────────

      // Build adaptive settings
      const settings: AdaptiveSettings = {
        targetDSO: adaptiveSettings.targetDSO || 45,
        urgencyFactor,
        quietHours: adaptiveSettings.quietHours || [22, 8],
        maxDailyTouches: adaptiveSettings.maxDailyTouches || 3,
      };

      // Build constraints
      const allowedChannels: Channel[] = [];
      if (contact.email) allowedChannels.push('email');
      if (contact.phone) {
        allowedChannels.push('sms');
        allowedChannels.push('call');
        allowedChannels.push('whatsapp');
      }

      // Count today's touches for this schedule
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const todayTouches = await db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, tenantId),
            sql`${actions.metadata}->>'scheduleId' = ${schedule.id}`,
            sql`${actions.createdAt} >= ${todayStart.toISOString()}`
          )
        );

      const constraints: SchedulerConstraints = {
        now: today,
        minGapHours: adaptiveSettings.minGapHours || 24,
        allowedChannels,
        timezone: 'UTC', // TODO: get from tenant settings
      };

      // Call adaptive scheduler
      const touchCandidate = scheduleNextTouch(
        settings,
        customerContext,
        invoiceContext,
        constraints,
        todayTouches.length
      );

      if (!touchCandidate) {
        console.log(`🤖 Adaptive scheduler: No valid touch candidate for invoice ${invoice.invoiceNumber}`);
        return null;
      }

      console.log(`🤖 Adaptive scheduler: ${touchCandidate.reasoning}`);

      // Map channel type (adaptive uses "call", actions table uses "voice")
      const actionType = touchCandidate.channel === 'call' ? 'voice' : touchCandidate.channel;

      // Check for existing action for this invoice/contact/schedule/channel
      // Prevents duplicates across planner runs by checking all non-terminal statuses
      // NOTE: This is a SELECT-before-INSERT pattern vulnerable to race conditions under
      // concurrent planner runs. For production, add unique constraint on 
      // (tenantId, invoiceId, contactId, scheduleId, type, status) or use transactional upsert.
      const existingAdaptiveAction = await db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.invoiceId, invoice.id),
            eq(actions.contactId, contact.id),
            eq(actions.type, actionType),
            sql`${actions.metadata}->>'scheduleId' = ${schedule.id}`,
            // Check all active statuses (exclude only terminal states)
            // This includes actions past their scheduled time but still pending/queued
            sql`${actions.status} NOT IN ('completed', 'failed', 'cancelled', 'sent')`
          )
        )
        .limit(1);

      if (existingAdaptiveAction.length > 0) {
        console.log(`⏭️  Adaptive action already exists for invoice ${invoice.invoiceNumber}, channel ${actionType}, skipping`);
        return null;
      }

      // Create planned action from touch candidate
      const plannedAction: PlannedAction = {
        invoiceId: invoice.id,
        contactId: contact.id,
        tenantId,
        actionType: actionType as 'email' | 'sms' | 'whatsapp' | 'voice' | 'manual_call',
        scheduledFor: touchCandidate.time,
        metadata: {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          schedulerType: 'adaptive',
          adaptiveScore: touchCandidate.score,
          reasoning: touchCandidate.reasoning,
          scoreBreakdown: touchCandidate.breakdown,
        },
        priority: 'normal',
      };

      return plannedAction;
    } catch (error: any) {
      console.error(`Error planning adaptive action:`, error.message);
      return null;
    }
  }

  /**
   * Calculate the exact scheduled time based on days overdue and time of day
   */
  private calculateScheduledTime(dueDate: Date, daysOverdue: number, timeOfDay: string): Date {
    const scheduledDate = new Date(dueDate);
    scheduledDate.setDate(scheduledDate.getDate() + daysOverdue);

    // Parse time of day (HH:MM format)
    const [hours, minutes] = timeOfDay.split(':').map(Number);
    scheduledDate.setHours(hours, minutes, 0, 0);

    return scheduledDate;
  }

  /**
   * Check if action already scheduled for this invoice
   */
  private async findExistingScheduledAction(
    invoiceId: string, 
    contactId: string, 
    daysOverdue: number,
    actionType: string
  ): Promise<any> {
    const result = await db
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.invoiceId, invoiceId),
          eq(actions.contactId, contactId),
          eq(actions.type, actionType),
          sql`${actions.status} IN ('pending', 'scheduled')`,
          sql`${actions.metadata}->>'daysOverdue' = ${daysOverdue.toString()}`
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Apply AI optimization to planned actions
   */
  private async optimizePlannedActions(plannedActions: PlannedAction[]): Promise<PlannedAction[]> {
    // Group actions by contact for AI analysis
    const actionsByContact = plannedActions.reduce((acc, action) => {
      if (!acc[action.contactId]) {
        acc[action.contactId] = [];
      }
      acc[action.contactId].push(action);
      return acc;
    }, {} as Record<string, PlannedAction[]>);

    const optimizedActions: PlannedAction[] = [];

    for (const [contactId, contactActions] of Object.entries(actionsByContact)) {
      const firstAction = contactActions[0];
      
      try {
        // Get customer learning profile
        const profile = await this.learningService.getOrCreateCustomerProfile(
          contactId, 
          firstAction.tenantId
        );

        // Gap 11: Fetch debtor channel preference overrides for AI optimization
        const debtorPrefs = await db.query.customerPreferences.findFirst({
          where: and(
            eq(customerPreferences.contactId, contactId),
            eq(customerPreferences.tenantId, firstAction.tenantId),
          ),
          columns: { emailEnabled: true, smsEnabled: true, voiceEnabled: true },
        });
        const channelAllowed = {
          email: debtorPrefs?.emailEnabled !== false,
          sms: debtorPrefs?.smsEnabled !== false,
          voice: debtorPrefs?.voiceEnabled !== false,
        };

        // Determine best channel based on effectiveness scores
        const channelEffectiveness = {
          email: parseFloat(profile.emailEffectiveness || '0.5'),
          sms: parseFloat(profile.smsEffectiveness || '0.5'),
          voice: parseFloat(profile.voiceEffectiveness || '0.5'),
        };

        for (const action of contactActions) {
          // If AI confidence is high enough, potentially override channel
          const confidence = parseFloat(profile.learningConfidence || '0.1');
          if (confidence > 0.7) {
            const currentEffectiveness = channelEffectiveness[action.actionType as keyof typeof channelEffectiveness] || 0.5;

            // If current channel is less than 30% effective, switch to best channel
            if (currentEffectiveness < 0.3) {
              // Gap 11: Only consider channels that are allowed by debtor preference
              const bestChannel = Object.entries(channelEffectiveness)
                .filter(([ch]) => channelAllowed[ch as keyof typeof channelAllowed])
                .sort((a, b) => b[1] - a[1])[0]?.[0] as 'email' | 'sms' | 'voice' | undefined;

              if (bestChannel) {
                console.log(`🔄 AI Override: Switching ${action.actionType} to ${bestChannel} for contact ${contactId}`);
                action.actionType = bestChannel;
                action.metadata.aiOverride = true;
                action.metadata.originalChannel = contactActions[0].actionType;
              }
            }
          }

          // Gap 11: Final safety check — if action channel is disabled, fall to allowed channel
          const actionChannel = action.actionType as 'email' | 'sms' | 'voice';
          if (channelAllowed[actionChannel] === false) {
            const fallbackOrder: Array<'email' | 'sms' | 'voice'> = ['email', 'sms', 'voice'];
            const fallback = fallbackOrder.find(ch => channelAllowed[ch]);
            if (fallback) {
              console.log(`📢 [ChannelPreference] ${actionChannel} disabled for contact ${contactId}, falling back to ${fallback}`);
              action.metadata.originalChannel = action.actionType;
              action.metadata.channelPreferenceOverride = true;
              action.actionType = fallback;
            } else {
              console.log(`🚫 [ChannelPreference] All channels disabled for contact ${contactId} — action will be skipped`);
              action.metadata.allChannelsDisabled = true;
            }
          }

          optimizedActions.push(action);
        }
      } catch (error: any) {
        console.error(`Error optimizing actions for contact ${contactId}:`, error.message);
        // Fallback to original actions
        optimizedActions.push(...contactActions);
      }
    }

    return optimizedActions;
  }

  /**
   * Create scheduled actions in the database
   */
  private async createScheduledActions(plannedActions: PlannedAction[]): Promise<void> {
    for (const action of plannedActions) {
      try {
        const { proposeAction } = await import('./batchProcessor');
        await proposeAction({
          tenantId: action.tenantId,
          invoiceId: action.invoiceId,
          contactId: action.contactId,
          type: action.actionType,
          subject: action.subject,
          content: action.content,
          scheduledFor: action.scheduledFor,
          metadata: action.metadata,
          agentType: 'collections',
          actionSummary: action.subject,
        });
      } catch (error: any) {
        console.error(`Error creating scheduled action:`, error.message);
      }
    }
  }
}

// Export singleton instance
export const actionPlanner = new ActionPlanner();

/**
 * NEW: Plan adaptive actions using the composite scoring scheduler
 * This is the spec-aligned implementation for DSO-driven portfolio control
 */
import { scheduleNextAction, type ScheduleActionContext } from "../lib/adaptive-scheduler";
import { workflows } from "@shared/schema";
import { addHours } from "date-fns";

export async function planAdaptiveActions(
  tenantId: string,
  scheduleId: string
): Promise<{
  invoicesProcessed: number;
  actionsCreated: number;
  skipped: {
    disputed: number;
    override: number;
    lowPriority: number;
    recentAction: number;
    cooldown: number;
  };
}> {
  console.log(`[PLAN] Planning adaptive actions for tenant ${tenantId}, schedule ${scheduleId}`);

  try {
    // Get workflow settings
    const workflow = await db
      .select({
        id: workflows.id,
        adaptiveSettings: workflows.adaptiveSettings,
      })
      .from(workflows)
      .where(
        and(
          eq(workflows.id, scheduleId),
          eq(workflows.tenantId, tenantId),
          eq(workflows.schedulerType, "adaptive"),
          eq(workflows.isActive, true)
        )
      )
      .limit(1);

    if (workflow.length === 0) {
      console.log(`[PLAN] No active adaptive workflow found: ${scheduleId}`);
      return {
        invoicesProcessed: 0,
        actionsCreated: 0,
        skipped: { disputed: 0, override: 0, lowPriority: 0, recentAction: 0, cooldown: 0 },
      };
    }

    const settings = (workflow[0].adaptiveSettings as any) || {};
    const adaptiveSettings: AdaptiveSettings = {
      targetDSO: Number(settings.targetDSO || 45),
      urgencyFactor: Number(settings.urgencyFactor || 0.5),
      quietHours: settings.quietHours || [22, 8],
      maxDailyTouches: Number(settings.maxDailyTouches || 3),
    };

    const minScoreThreshold = Number(settings.minScoreThreshold || 40);

    // Gap 4: Fetch tenant for minimum chase threshold + collection timing settings
    const [tenantRecord] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const minChaseThreshold = parseFloat(tenantRecord?.minimumChaseThreshold || '50');
    const chaseDelayDays = tenantRecord?.chaseDelayDays ?? 5;
    const preDueDateDays = tenantRecord?.preDueDateDays ?? 7;
    const preDueDateMinAmount = parseFloat(tenantRecord?.preDueDateMinAmount || '1000');

    // Decision tree: pre-load DSO context once per tenant (not per invoice)
    let dsoContextForTree: { currentDSO: number; totalOutstanding: number } | null = null;
    if (tenantRecord?.useDecisionTree) {
      const [rollingDSO, arSummary] = await Promise.all([
        getRolling30DayDSO(tenantId),
        getARSummary(tenantId),
      ]);
      dsoContextForTree = { currentDSO: rollingDSO, totalOutstanding: arSummary.totalOutstanding };
      console.log(`[PLAN] Decision tree enabled — DSO: ${rollingDSO}, outstanding: £${arSummary.totalOutstanding.toFixed(2)}`);
    }

    // Get overdue + pre-due invoices with behavior signals
    // Include invoices due within preDueDateDays for Phase 1 pre-due nudges
    const today = new Date();
    const preDueCutoff = new Date(today);
    preDueCutoff.setDate(preDueCutoff.getDate() + preDueDateDays);
    const overdueInvoices = await db
      .select({
        invoice: invoices,
        contact: contacts,
        behavior: customerBehaviorSignals,
      })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.contactId, contacts.id))
      .leftJoin(
        customerBehaviorSignals,
        eq(customerBehaviorSignals.contactId, contacts.id)
      )
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          lte(invoices.dueDate, preDueCutoff),
          sql`${invoices.status} NOT IN ('paid', 'cancelled')`
        )
      );

    console.log(`[PLAN] Found ${overdueInvoices.length} overdue/pre-due invoices`);

    // Sprint 1: Group invoices by contact for safe bundling
    const invoicesByContact = new Map<string, typeof overdueInvoices>();
    for (const item of overdueInvoices) {
      const contactId = item.contact.id;
      if (!invoicesByContact.has(contactId)) {
        invoicesByContact.set(contactId, []);
      }
      invoicesByContact.get(contactId)!.push(item);
    }

    console.log(`[PLAN] Grouped into ${invoicesByContact.size} unique contacts`);

    let invoicesProcessed = 0;
    let actionsCreated = 0;
    const skipped = {
      disputed: 0,
      override: 0,
      lowPriority: 0,
      recentAction: 0,
      cooldown: 0,
    };

    // Pre-compute channel cooldown from tenant settings (same source as compliance engine)
    const cooldowns = (tenantRecord?.channelCooldowns as { email?: number; sms?: number; voice?: number } | null) ?? { email: 3 };
    const emailCooldownDays = cooldowns.email ?? 3;

    // Process each contact (may have multiple invoices)
    for (const [contactId, contactInvoices] of Array.from(invoicesByContact.entries())) {
      const { contact, behavior } = contactInvoices[0]; // Same contact for all

      // Pre-filter: skip contact if within channel cooldown window
      const cooldownStart = new Date();
      cooldownStart.setDate(cooldownStart.getDate() - emailCooldownDays);
      const SENT_STATUSES = ["completed", "sent", "delivered"];
      const recentSent = await db
        .select({ createdAt: actions.createdAt })
        .from(actions)
        .where(and(
          eq(actions.tenantId, tenantId),
          eq(actions.contactId, contactId),
          eq(actions.type, "email"),
          gte(actions.createdAt, cooldownStart),
          inArray(actions.status, SENT_STATUSES),
        ))
        .limit(1);

      if (recentSent.length > 0) {
        const lastDate = recentSent[0].createdAt;
        const daysSince = lastDate
          ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        console.log(`[PLAN] Skipping ${contact.name} — last contact ${daysSince} day(s) ago, cooldown is ${emailCooldownDays} days`);
        skipped.cooldown++;
        continue;
      }

      // Gap 13: Fetch seasonal adjustments once per contact (used in both scheduling paths)
      let seasonalAdj: SeasonalAdjustment[] = [];
      try {
        seasonalAdj = await getEffectiveSeasonalAdjustments(tenantId, contactId);
      } catch { /* non-fatal */ }

      // Score all invoices for this contact
      const scoredInvoices = [];
      
      for (const { invoice } of contactInvoices) {
        try {
          invoicesProcessed++;

          // Skip disputed or flagged invoices
          if (invoice.escalationFlag || invoice.legalFlag) {
            skipped.disputed++;
            continue;
          }

          // Check for existing actions in next 6 hours
          const sixHoursFromNow = addHours(today, 6);
          const existingActions = await db
            .select()
            .from(actions)
            .where(
              and(
                eq(actions.tenantId, tenantId),
                eq(actions.invoiceId, invoice.id),
                gte(actions.scheduledFor, today),
                lte(actions.scheduledFor, sixHoursFromNow)
              )
            )
            .limit(1);

          if (existingActions.length > 0) {
            skipped.recentAction++;
            continue;
          }

          // Build context for scheduler
          const dueDate = new Date(invoice.dueDate);
          const issueDate = new Date(invoice.issueDate);
          const ageDays = Math.ceil(
            (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Two-phase collection logic
          const isPreDue = ageDays < 0;
          const phase: 'inform' | 'elicit_date' = ageDays <= chaseDelayDays ? 'inform' : 'elicit_date';

          // Phase 1: Skip pre-due invoices below minimum amount threshold
          if (isPreDue && Number(invoice.amount || 0) < preDueDateMinAmount) {
            continue;
          }

          // Gap 11: Fetch debtor channel preference overrides
          const debtorPrefs2 = await db.query.customerPreferences.findFirst({
            where: and(
              eq(customerPreferences.contactId, contactId),
              eq(customerPreferences.tenantId, tenantId),
            ),
            columns: { emailEnabled: true, smsEnabled: true, voiceEnabled: true },
          });
          const emailOk = (debtorPrefs2?.emailEnabled !== false) && !!contact.email;
          const smsOk = (debtorPrefs2?.smsEnabled !== false) && !!contact.phone;
          const voiceOk = (debtorPrefs2?.voiceEnabled !== false) && !!contact.phone;

          // Gap 3: Use per-debtor urgency if available
          const debtorProfile2 = await db.query.customerLearningProfiles.findFirst({
            where: and(
              eq(customerLearningProfiles.contactId, contactId),
              eq(customerLearningProfiles.tenantId, tenantId),
            ),
            columns: { debtorUrgency: true },
          });
          const perDebtorSettings = debtorProfile2?.debtorUrgency
            ? { ...adaptiveSettings, urgencyFactor: Number(debtorProfile2.debtorUrgency) }
            : adaptiveSettings;

          const ctx: ScheduleActionContext = {
            tenantId,
            settings: perDebtorSettings,
            customer: {
              segment: "default",
              channelPrefs: {
                email: emailOk,
                sms: smsOk,
                whatsapp: smsOk,
                call: voiceOk,
              },
              behavior: behavior || undefined,
              seasonalAdjustments: seasonalAdj, // Gap 13
            },
            invoice: {
              amount: Number(invoice.amount || 0),
              dueAt: dueDate,
              issuedAt: issueDate,
              ageDays,
              dispute: false,
              lastTouchAt: invoice.lastReminderSent
                ? new Date(invoice.lastReminderSent)
                : undefined,
              lastChannel: undefined,
            },
            constraints: {
              now: today,
              minGapHours: 24,
              allowedChannels: ["email", "sms", "call"] as Channel[],
              timezone: "Europe/London",
              hasOverride: false,
              maxDailyTouchesPerCustomer: 2,
            },
          };

          // Get recommendation from adaptive scheduler
          const recommendation = scheduleNextAction(ctx);

          if (!recommendation) {
            skipped.lowPriority++;
            continue;
          }

          if (recommendation.priority < minScoreThreshold) {
            skipped.lowPriority++;
            console.log(
              `[PLAN] tenant=${tenantId} invoice=${invoice.invoiceNumber} ch=${recommendation.channel} ` +
              `score=${recommendation.priority.toFixed(1)} < ${minScoreThreshold} (skipped)`
            );
            continue;
          }

          // Store scored invoice for bundling
          scoredInvoices.push({
            invoice,
            recommendation,
          });
        } catch (error) {
          console.error(`[PLAN] Error processing invoice ${invoice.id}:`, error);
        }
      }

      // Two-phase enforcement: determine highest phase across all scored invoices
      // Phase 2 wins if any invoice is Phase 2 (allows chasing when some are overdue)
      const allPhases = scoredInvoices.map(si => {
        const age = Math.ceil((today.getTime() - new Date(si.invoice.dueDate).getTime()) / 86400000);
        return age > chaseDelayDays ? 'elicit_date' : 'inform';
      });
      const bundlePhase: 'inform' | 'elicit_date' = allPhases.includes('elicit_date') ? 'elicit_date' : 'inform';

      // Phase 1 single-touch enforcement: if all invoices are Phase 1,
      // skip if there's been ANY prior completed action for this contact
      if (bundlePhase === 'inform' && scoredInvoices.length > 0) {
        const SENT_STATUSES_PHASE = ["completed", "sent", "delivered"];
        const priorAction = await db
          .select({ id: actions.id })
          .from(actions)
          .where(and(
            eq(actions.tenantId, tenantId),
            eq(actions.contactId, contactId),
            inArray(actions.status, SENT_STATUSES_PHASE),
          ))
          .limit(1);

        if (priorAction.length > 0) {
          console.log(`[PLAN] Phase 1 — skipping ${contact.name}: already nudged (one touch max)`);
          continue;
        }
      }

      // Sprint 1: Create ONE bundled action for all invoices from this contact
      if (scoredInvoices.length > 0) {
        try {
          // Use the highest priority recommendation
          const highestPriority = scoredInvoices.reduce((max, curr) =>
            curr.recommendation.priority > max.recommendation.priority ? curr : max
          );

          const invoiceIds = scoredInvoices.map(si => si.invoice.id);
          const invoiceNumbers = scoredInvoices.map(si => si.invoice.invoiceNumber).join(', ');
          // Net of any payments already received against these invoices
          const totalAmount = scoredInvoices.reduce(
            (sum, si) => sum + (Number(si.invoice.amount || 0) - Number(si.invoice.amountPaid || 0)),
            0
          );

          // Gap 4: Skip if consolidated total below minimum chase threshold
          if (totalAmount < minChaseThreshold) {
            console.log(`[PLAN] Skipping ${scoredInvoices[0]?.invoice?.contactId}: £${totalAmount.toFixed(2)} below £${minChaseThreshold} threshold`);
            continue;
          }

          // Create bundled action with all invoice IDs — route through batch/approval queue
          const { proposeAction } = await import('./batchProcessor');
          const actionSubject = bundlePhase === 'inform'
            ? (invoiceIds.length > 1
              ? `Courtesy reminder for ${invoiceIds.length} upcoming invoices`
              : `Courtesy reminder for invoice ${highestPriority.invoice.invoiceNumber}`)
            : (invoiceIds.length > 1
              ? `Payment reminder for ${invoiceIds.length} overdue invoices`
              : `Payment reminder for invoice ${highestPriority.invoice.invoiceNumber}`);
          await proposeAction({
            tenantId,
            contactId,
            invoiceId: highestPriority.invoice.id,
            invoiceIds,
            type: highestPriority.recommendation.channel || "email",
            scheduledFor: highestPriority.recommendation.suggestedDate || addHours(today, 24),
            subject: actionSubject,
            content: invoiceIds.length > 1
              ? `You have ${invoiceIds.length} overdue invoices (${invoiceNumbers}) totalling ${formatCurrency(totalAmount)}.`
              : `Your invoice ${highestPriority.invoice.invoiceNumber} is overdue.`,
            agentType: 'collections',
            actionSummary: actionSubject,
            priority: Math.min(Math.round(highestPriority.recommendation.priority), 100),
            metadata: {
              adaptiveScheduler: true,
              priority: highestPriority.recommendation.priority,
              reasoning: highestPriority.recommendation.reasoning,
              scheduleId,
              bundled: invoiceIds.length > 1,
              invoiceCount: invoiceIds.length,
              collectionPhase: bundlePhase,
            },
            recommendedAt: today,
            recommendedBy: "adaptive",
            recommended: {
              channel: highestPriority.recommendation.channel,
              sendAt: highestPriority.recommendation.suggestedDate || addHours(today, 24),
              priority: highestPriority.recommendation.priority,
              reasons: [],
            },
          });

          actionsCreated++;

          console.log(
            `[PLAN] tenant=${tenantId} contact=${contact.name} ` +
            `bundled=${invoiceIds.length} invoices ` +
            `ch=${highestPriority.recommendation.channel} ` +
            `score=${highestPriority.recommendation.priority.toFixed(1)}`
          );
        } catch (error) {
          console.error(`[PLAN] Error creating bundled action for contact ${contactId}:`, error);
        }
      }
    }

    // Gap 12: Enforce debtor group tone consistency + same-day conflict detection
    const groupCancelled = await enforceDebtorGroupConsistency(tenantId);

    console.log(
      `[PLAN] Complete: ${invoicesProcessed} processed, ${actionsCreated} created, ` +
      `${skipped.disputed} disputed, ${skipped.lowPriority} low priority, ` +
      `${skipped.recentAction} recent action, ${skipped.cooldown} cooldown` +
      (groupCancelled > 0 ? `, ${groupCancelled} cancelled (debtor group conflicts)` : '')
    );

    return {
      invoicesProcessed,
      actionsCreated,
      skipped,
    };
  } catch (error) {
    console.error(`[PLAN] Error planning actions for tenant ${tenantId}:`, error);
    throw error;
  }
}

// ── Gap 12: Debtor Group Consistency Enforcement ──────────────

const TONE_ORDER = ['friendly', 'professional', 'firm', 'formal', 'legal'];

/**
 * Post-planning sweep: find scheduled actions that belong to grouped contacts,
 * enforce tone consistency (highest tone wins), and cancel same-day duplicates
 * (keep highest priority, cancel the rest).
 *
 * Returns the number of cancelled actions.
 */
async function enforceDebtorGroupConsistency(tenantId: string): Promise<number> {
  try {
    // Find today's scheduled actions for grouped contacts
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const groupedActions = await db
      .select({
        actionId: actions.id,
        contactId: actions.contactId,
        debtorGroupId: contacts.debtorGroupId,
        groupName: debtorGroups.groupName,
        agentToneLevel: actions.agentToneLevel,
        priority: actions.priority,
        scheduledFor: actions.scheduledFor,
      })
      .from(actions)
      .innerJoin(contacts, eq(actions.contactId, contacts.id))
      .innerJoin(debtorGroups, eq(contacts.debtorGroupId, debtorGroups.id))
      .where(and(
        eq(actions.tenantId, tenantId),
        eq(actions.status, 'scheduled'),
        gte(actions.scheduledFor, todayStart),
        lte(actions.scheduledFor, todayEnd),
        isNotNull(contacts.debtorGroupId),
      ));

    if (groupedActions.length === 0) return 0;

    // Group by debtorGroupId
    const byGroup = new Map<string, typeof groupedActions>();
    for (const a of groupedActions) {
      const gid = a.debtorGroupId!;
      if (!byGroup.has(gid)) byGroup.set(gid, []);
      byGroup.get(gid)!.push(a);
    }

    let totalCancelled = 0;

    for (const [groupId, groupActions] of Array.from(byGroup.entries())) {
      if (groupActions.length <= 1) {
        // Single action in group — no conflict, but still enforce tone consistency
        // (tone should match highest tone from any recent group action)
        continue;
      }

      // Find the highest tone in this group's actions
      let highestToneIndex = 0;
      for (const a of groupActions) {
        const idx = TONE_ORDER.indexOf((a.agentToneLevel || 'friendly').toLowerCase());
        if (idx > highestToneIndex) highestToneIndex = idx;
      }
      const groupTone = TONE_ORDER[highestToneIndex];

      // Sort by priority descending — keep the highest priority action
      const sorted = [...groupActions].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      const [kept, ...duplicates] = sorted;

      // Update kept action's tone to the group-consistent tone
      await db
        .update(actions)
        .set({ agentToneLevel: groupTone })
        .where(eq(actions.id, kept.actionId));

      // Cancel duplicate actions
      if (duplicates.length > 0) {
        const dupIds = duplicates.map(d => d.actionId);
        await db
          .update(actions)
          .set({
            status: 'cancelled',
            cancellationReason: 'debtor_group_same_day_conflict',
          })
          .where(inArray(actions.id, dupIds));

        totalCancelled += duplicates.length;
        console.log(
          `[DebtorGroup] Group "${groupActions[0].groupName}" (${groupId}): ` +
          `aligned ${groupActions.length} actions to tone "${groupTone}", ` +
          `kept action for ${kept.contactId}, cancelled ${duplicates.length}`
        );
      }
    }

    return totalCancelled;
  } catch (error) {
    console.error('[DebtorGroup] Error enforcing group consistency:', error);
    return 0; // Non-fatal — don't break planning if group enforcement fails
  }
}
