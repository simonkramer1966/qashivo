import { eq, and, lte, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { 
  invoices, 
  contacts, 
  collectionSchedules, 
  customerScheduleAssignments, 
  tenants,
  actions,
  customerBehaviorSignals 
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
            sql`${invoices.status} NOT IN ('paid', 'cancelled', 'void')`
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

      // Build customer context
      const customerContext: CustomerContext = {
        segment: behavior?.segment || contact.segment || "default",
        behavior: behavior || undefined,
        channelPrefs: {
          email: contact.email ? true : false,
          sms: contact.phone ? true : false,
          call: contact.phone ? true : false,
          whatsapp: contact.phone ? true : false,
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
            sql`${actions.status} IN ('completed', 'sent')`
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

      // Get tenant urgency factor (from tenants table if exists, otherwise use settings)
      const urgencyFactor = adaptiveSettings.urgencyFactor || 0.5;

      // Build adaptive settings
      const settings: AdaptiveSettings = {
        targetDSO: adaptiveSettings.targetDSO || 45,
        urgencyFactor: Number(urgencyFactor),
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
              const bestChannel = Object.entries(channelEffectiveness)
                .sort((a, b) => b[1] - a[1])[0][0] as 'email' | 'sms' | 'voice';
              
              console.log(`🔄 AI Override: Switching ${action.actionType} to ${bestChannel} for contact ${contactId}`);
              action.actionType = bestChannel;
              action.metadata.aiOverride = true;
              action.metadata.originalChannel = contactActions[0].actionType;
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
        await db.insert(actions).values({
          tenantId: action.tenantId,
          invoiceId: action.invoiceId,
          contactId: action.contactId,
          type: action.actionType,
          status: 'scheduled',
          subject: action.subject,
          content: action.content,
          scheduledFor: action.scheduledFor,
          metadata: action.metadata,
          source: 'automated',
        });
      } catch (error: any) {
        console.error(`Error creating scheduled action:`, error.message);
      }
    }
  }
}

// Export singleton instance
export const actionPlanner = new ActionPlanner();
