import { eq, and, lte, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { 
  invoices, 
  contacts, 
  collectionSchedules, 
  customerScheduleAssignments, 
  tenants,
  actions 
} from "@shared/schema";
import { CollectionLearningService } from "./collectionLearningService";

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

        // Calculate days overdue
        const dueDate = new Date(invoice.dueDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Skip if not actually overdue
        if (daysOverdue < 0) {
          continue;
        }

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
