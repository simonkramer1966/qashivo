import { eq, and, lte, gte } from "drizzle-orm";
import { db } from "../db";
import { invoices, contacts, collectionSchedules, customerScheduleAssignments, tenants } from "@shared/schema";
import { CollectionLearningService, type OptimizedAction } from "./collectionLearningService";

export interface CollectionAction {
  invoiceId: string;
  contactId: string;
  invoiceNumber: string;
  contactName: string;
  daysOverdue: number;
  amount: string;
  action: string;
  actionType: 'email' | 'sms' | 'voice' | 'manual';
  scheduleName: string;
  templateId?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  actionDetails: {
    template?: string;
    subject?: string;
    message?: string;
    escalationLevel?: string;
  };
}

export interface CollectionScheduleStep {
  daysTrigger: number;
  action: string;
  actionType: 'email' | 'sms' | 'voice' | 'manual';
  template?: string;
  subject?: string;
  message?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  escalationLevel?: string;
}

/**
 * Checks all unpaid invoices against their assigned collection schedules
 * and returns a list of actions that should be triggered today
 */
export async function checkCollectionActions(tenantId: string): Promise<CollectionAction[]> {
  const today = new Date();
  const actions: CollectionAction[] = [];

  try {
    // Check if collections automation is enabled for this tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId)
    });

    if (!tenant?.collectionsAutomationEnabled) {
      console.log(`Collections automation disabled for tenant ${tenantId}`);
      return [];
    }

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
          lte(invoices.dueDate, today), // Invoice is past due
          gte(invoices.amount, invoices.amountPaid || 0) // Still has outstanding balance
        )
      );

    console.log(`Found ${overdueInvoices.length} potentially overdue invoices for tenant ${tenantId}`);

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
      let scheduleSteps: CollectionScheduleStep[] = [];
      try {
        scheduleSteps = Array.isArray(schedule.scheduleSteps) 
          ? schedule.scheduleSteps as CollectionScheduleStep[]
          : [];
      } catch (error) {
        console.error(`Error parsing schedule steps for schedule ${schedule.id}:`, error);
        continue;
      }

      // Find matching trigger point
      const matchingStep = scheduleSteps.find(step => step.daysTrigger === daysOverdue);

      if (matchingStep) {
        const action: CollectionAction = {
          invoiceId: invoice.id,
          contactId: contact.id,
          invoiceNumber: invoice.invoiceNumber,
          contactName: contact.name || 'Unknown',
          daysOverdue,
          amount: invoice.amount,
          action: matchingStep.action,
          actionType: matchingStep.actionType,
          scheduleName: schedule.name,
          templateId: matchingStep.template,
          priority: matchingStep.priority || 'normal',
          actionDetails: {
            template: matchingStep.template,
            subject: matchingStep.subject,
            message: matchingStep.message,
            escalationLevel: matchingStep.escalationLevel,
          },
        };

        actions.push(action);
      }
    }

    console.log(`Generated ${actions.length} collection actions for tenant ${tenantId}`);
    
    // Optimize actions using AI learning
    if (actions.length > 0) {
      try {
        const learningService = new CollectionLearningService();
        const optimizedActions = await learningService.optimizeActions(actions);
        
        console.log(`🤖 AI Learning: Optimized ${optimizedActions.length} actions for tenant ${tenantId}`);
        
        // Log optimization summary
        const optimizedCount = optimizedActions.filter(a => 
          (a as OptimizedAction).aiRecommendation || (a as OptimizedAction).confidence
        ).length;
        
        if (optimizedCount > 0) {
          console.log(`📈 AI Applied: ${optimizedCount}/${optimizedActions.length} actions optimized based on learning`);
        }
        
        return optimizedActions as CollectionAction[];
        
      } catch (error: any) {
        console.error('Error applying AI learning to actions:', error);
        console.log(`⚠️  Falling back to standard actions due to AI learning error`);
        return actions; // Fallback to original actions if learning fails
      }
    }
    
    return actions;

  } catch (error: any) {
    console.error('Error checking collection actions:', error);
    throw new Error(`Failed to check collection actions: ${error.message}`);
  }
}

/**
 * Enables or disables collections automation for a tenant
 */
export async function setCollectionsAutomation(tenantId: string, enabled: boolean): Promise<void> {
  try {
    await db
      .update(tenants)
      .set({ 
        collectionsAutomationEnabled: enabled,
        updatedAt: new Date()
      })
      .where(eq(tenants.id, tenantId));

    console.log(`Collections automation ${enabled ? 'enabled' : 'disabled'} for tenant ${tenantId}`);
  } catch (error: any) {
    console.error('Error updating collections automation setting:', error);
    throw new Error(`Failed to update automation setting: ${error.message}`);
  }
}

/**
 * Gets the current collections automation status for a tenant
 */
export async function getCollectionsAutomationStatus(tenantId: string): Promise<boolean> {
  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: {
        collectionsAutomationEnabled: true
      }
    });

    return tenant?.collectionsAutomationEnabled ?? false;
  } catch (error) {
    console.error('Error getting collections automation status:', error);
    return false;
  }
}

/**
 * Manually nudges a specific invoice to advance to its next collection action
 */
export async function nudgeInvoiceToNextAction(invoiceId: string, tenantId: string): Promise<CollectionAction | null> {
  try {
    // Check if collections automation is enabled for this tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId)
    });

    if (!tenant?.collectionsAutomationEnabled) {
      throw new Error(`Collections automation disabled for tenant ${tenantId}`);
    }

    // Get the specific invoice with its contact and assignment
    const invoiceRecord = await db
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
          eq(invoices.id, invoiceId),
          eq(invoices.tenantId, tenantId),
          gte(invoices.amount, invoices.amountPaid || 0) // Still has outstanding balance
        )
      );

    if (invoiceRecord.length === 0) {
      throw new Error(`Invoice ${invoiceId} not found or fully paid`);
    }

    const { invoice, contact, assignment, schedule } = invoiceRecord[0];

    // Skip if no schedule assigned
    if (!assignment || !schedule) {
      throw new Error(`No collection schedule assigned to contact ${contact.name}`);
    }

    // Calculate days overdue
    const today = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // Parse schedule steps
    let scheduleSteps: CollectionScheduleStep[] = [];
    try {
      scheduleSteps = Array.isArray(schedule.scheduleSteps) 
        ? schedule.scheduleSteps as CollectionScheduleStep[]
        : [];
    } catch (error) {
      console.error(`Error parsing schedule steps for schedule ${schedule.id}:`, error);
      throw new Error(`Invalid schedule configuration for ${schedule.name}`);
    }

    if (scheduleSteps.length === 0) {
      throw new Error(`No collection steps configured for schedule ${schedule.name}`);
    }

    // Find the next appropriate action step for nudging
    // Sort steps by daysTrigger to find the right progression
    const sortedSteps = scheduleSteps.sort((a, b) => a.daysTrigger - b.daysTrigger);
    
    // Find the next step that should be triggered based on days overdue
    let nextStep: CollectionScheduleStep | null = null;
    
    // If invoice is not yet overdue, use the first step
    if (daysOverdue < 0) {
      nextStep = sortedSteps[0];
    } else {
      // Find the next step after the current days overdue
      nextStep = sortedSteps.find(step => step.daysTrigger > daysOverdue) || sortedSteps[sortedSteps.length - 1];
    }

    if (!nextStep) {
      throw new Error(`No appropriate next action found for invoice ${invoice.invoiceNumber}`);
    }

    // Create the nudge action
    const nudgeAction: CollectionAction = {
      invoiceId: invoice.id,
      contactId: contact.id,
      invoiceNumber: invoice.invoiceNumber,
      contactName: contact.name || 'Unknown',
      daysOverdue: Math.max(0, daysOverdue),
      amount: invoice.amount,
      action: nextStep.action,
      actionType: nextStep.actionType,
      scheduleName: schedule.name,
      templateId: nextStep.template,
      priority: nextStep.priority || 'normal',
      actionDetails: {
        template: nextStep.template,
        subject: nextStep.subject,
        message: nextStep.message,
        escalationLevel: nextStep.escalationLevel,
      },
    };

    console.log(`Generated nudge action for invoice ${invoice.invoiceNumber}: ${nextStep.action} (${nextStep.actionType})`);
    
    // Optimize nudge action using AI learning
    try {
      const learningService = new CollectionLearningService();
      const optimizedActions = await learningService.optimizeActions([nudgeAction]);
      
      if (optimizedActions.length > 0) {
        const optimizedAction = optimizedActions[0] as OptimizedAction;
        
        if (optimizedAction.aiRecommendation || optimizedAction.confidence) {
          console.log(`🤖 AI Learning: Optimized nudge action - ${optimizedAction.aiRecommendation || 'Applied learned preferences'}`);
        }
        
        return optimizedAction as CollectionAction;
      }
      
      return nudgeAction;
      
    } catch (error: any) {
      console.error('Error applying AI learning to nudge action:', error);
      console.log(`⚠️  Using standard nudge action due to AI learning error`);
      return nudgeAction; // Fallback to original action
    }

  } catch (error: any) {
    console.error('Error nudging invoice to next action:', error);
    throw new Error(`Failed to nudge invoice: ${error.message}`);
  }
}