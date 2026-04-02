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
      })
      .from(tenants)
      .where(eq(tenants.collectionsAutomationEnabled, true));

    console.log(`📋 Action Planner: Found ${enabledTenants.length} tenants with automation enabled`);

    for (const tenant of enabledTenants) {
      try {
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

        // Calculate days overdue
        const dueDate = new Date(invoice.dueDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Skip if not actually overdue
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

      // Gap 11: Fetch debtor channel preference overrides
      const debtorPrefs = await db.query.customerPreferences.findFirst({
        where: and(
          eq(customerPreferences.contactId, contact.id),
          eq(customerPreferences.tenantId, tenantId),
        ),
        columns: { emailEnabled: true, smsEnabled: true, voiceEnabled: true },
      });
      const emailAllowed = (debtorPrefs?.emailEnabled !== false) && !!contact.email;
      const smsAllowed = (debtorPrefs?.smsEnabled !== false) && !!contact.phone;
      const voiceAllowed = (debtorPrefs?.voiceEnabled !== false) && !!contact.phone;

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
        skipped: { disputed: 0, override: 0, lowPriority: 0, recentAction: 0 },
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

    // Gap 4: Fetch tenant for minimum chase threshold
    const [tenantRecord] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const minChaseThreshold = parseFloat(tenantRecord?.minimumChaseThreshold || '50');

    // Get overdue invoices with behavior signals
    const today = new Date();
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
          lte(invoices.dueDate, today),
          sql`${invoices.status} NOT IN ('paid', 'cancelled')`
        )
      );

    console.log(`[PLAN] Found ${overdueInvoices.length} overdue invoices`);

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
    };

    // Process each contact (may have multiple invoices)
    for (const [contactId, contactInvoices] of Array.from(invoicesByContact.entries())) {
      const { contact, behavior } = contactInvoices[0]; // Same contact for all
      
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

      // Sprint 1: Create ONE bundled action for all invoices from this contact
      if (scoredInvoices.length > 0) {
        try {
          // Use the highest priority recommendation
          const highestPriority = scoredInvoices.reduce((max, curr) =>
            curr.recommendation.priority > max.recommendation.priority ? curr : max
          );

          const invoiceIds = scoredInvoices.map(si => si.invoice.id);
          const invoiceNumbers = scoredInvoices.map(si => si.invoice.invoiceNumber).join(', ');
          const totalAmount = scoredInvoices.reduce((sum, si) => sum + Number(si.invoice.amount || 0), 0);

          // Gap 4: Skip if consolidated total below minimum chase threshold
          if (totalAmount < minChaseThreshold) {
            console.log(`[PLAN] Skipping ${scoredInvoices[0]?.invoice?.contactId}: £${totalAmount.toFixed(2)} below £${minChaseThreshold} threshold`);
            continue;
          }

          // Create bundled action with all invoice IDs — route through batch/approval queue
          const { proposeAction } = await import('./batchProcessor');
          const actionSubject = invoiceIds.length > 1
            ? `Payment reminder for ${invoiceIds.length} overdue invoices`
            : `Payment reminder for invoice ${highestPriority.invoice.invoiceNumber}`;
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
      `${skipped.recentAction} recent action` +
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
