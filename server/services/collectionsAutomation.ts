import { eq, and, lte, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { invoices, contacts, collectionSchedules, customerScheduleAssignments, tenants } from "@shared/schema";
import { CollectionLearningService, type OptimizedAction } from "./collectionLearningService";

export interface InvoiceSummary {
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  daysOverdue: number;
}

export interface CollectionAction {
  invoiceId: string;
  contactId: string;
  tenantId: string;
  invoiceNumber: string;
  contactName: string;
  companyName?: string;
  contactFirstName: string;
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
  // Aggregated invoice data for consolidated reminders
  allInvoices?: InvoiceSummary[];
  invoiceCount?: number;
  totalOverdue?: string;
  oldestInvoiceDays?: number;
  invoiceTable?: string;
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
 * Generates an HTML table for displaying multiple invoices in email templates
 */
export function generateInvoiceTableHtml(invoices: InvoiceSummary[]): string {
  if (invoices.length === 0) return '';
  
  const rows = invoices.map(inv => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inv.invoiceNumber}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">£${parseFloat(inv.amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inv.dueDate}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inv.daysOverdue} days</td>
    </tr>
  `).join('');

  return `
<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-family: Arial, sans-serif;">
  <thead>
    <tr style="background-color: #f3f4f6;">
      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db;">Invoice #</th>
      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db;">Amount</th>
      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db;">Due Date</th>
      <th style="padding: 10px; text-align: left; border-bottom: 2px solid #d1d5db;">Days Overdue</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
  `.trim();
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
          sql`COALESCE(${invoices.amountPaid}, 0) < ${invoices.amount}`, // Has outstanding balance (amountPaid < amount)
          sql`${invoices.status} NOT IN ('paid', 'cancelled', 'void')` // Exclude paid/cancelled/void invoices
        )
      );

    console.log(`Found ${overdueInvoices.length} potentially overdue invoices for tenant ${tenantId}`);

    // Group invoices by contact for consolidated reminders
    const contactInvoiceMap = new Map<string, {
      contact: typeof overdueInvoices[0]['contact'];
      invoices: Array<{
        invoice: typeof overdueInvoices[0]['invoice'];
        daysOverdue: number;
      }>;
      assignment: typeof overdueInvoices[0]['assignment'];
      schedule: typeof overdueInvoices[0]['schedule'];
    }>();

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

      // Group by contact
      if (!contactInvoiceMap.has(contact.id)) {
        contactInvoiceMap.set(contact.id, {
          contact,
          invoices: [],
          assignment,
          schedule,
        });
      }
      contactInvoiceMap.get(contact.id)!.invoices.push({ invoice, daysOverdue });
    }

    // Generate one action per contact with aggregated invoice data
    const contactEntries = Array.from(contactInvoiceMap.entries());
    for (const [contactId, data] of contactEntries) {
      const { contact, invoices: contactInvoices, assignment, schedule } = data;

      type InvoiceWithOverdue = { invoice: typeof contactInvoices[0]['invoice']; daysOverdue: number };
      
      // Find the oldest invoice to determine the schedule step
      const oldestInvoice = contactInvoices.reduce(
        (max: InvoiceWithOverdue, curr: InvoiceWithOverdue) => 
          curr.daysOverdue > max.daysOverdue ? curr : max,
        contactInvoices[0]
      );

      // Parse schedule steps
      type ScheduleStep = { daysTrigger?: number; delay?: number; trigger: number; [key: string]: any };
      const scheduleStepsRaw = Array.isArray(schedule!.scheduleSteps) ? schedule!.scheduleSteps : [];
      const steps: ScheduleStep[] = scheduleStepsRaw
        .map((s: any) => ({ ...s, trigger: Number(s.daysTrigger ?? s.delay) }))
        .filter((s: ScheduleStep) => Number.isFinite(s.trigger))
        .sort((a: ScheduleStep, b: ScheduleStep) => a.trigger - b.trigger);
      
      const matchingStep = steps.filter((s: ScheduleStep) => s.trigger <= oldestInvoice.daysOverdue).at(-1);

      if (matchingStep) {
        // Calculate aggregated values
        const totalAmount = contactInvoices.reduce(
          (sum: number, item: InvoiceWithOverdue) => sum + parseFloat(item.invoice.amount), 
          0
        );
        const oldestDays = Math.max(...contactInvoices.map((i: InvoiceWithOverdue) => i.daysOverdue));
        
        // Build invoice summary list
        const allInvoices: InvoiceSummary[] = contactInvoices
          .map((item: InvoiceWithOverdue) => ({
            invoiceId: item.invoice.id,
            invoiceNumber: item.invoice.invoiceNumber,
            amount: item.invoice.amount,
            dueDate: new Date(item.invoice.dueDate).toLocaleDateString('en-GB'),
            daysOverdue: item.daysOverdue,
          }))
          .sort((a: InvoiceSummary, b: InvoiceSummary) => b.daysOverdue - a.daysOverdue); // Oldest first

        // Generate HTML invoice table for email templates
        const invoiceTable = generateInvoiceTableHtml(allInvoices);

        // Use the oldest invoice as the primary reference
        const primaryInvoice = oldestInvoice.invoice;

        const action: CollectionAction = {
          invoiceId: primaryInvoice.id,
          contactId: contact.id,
          tenantId: tenantId,
          invoiceNumber: primaryInvoice.invoiceNumber,
          contactName: contact.name || 'Unknown',
          companyName: contact.companyName || undefined,
          contactFirstName: ((contact.name || '').trim().split(/\s+/)[0]) || contact.name || 'Unknown',
          daysOverdue: oldestInvoice.daysOverdue,
          amount: primaryInvoice.amount,
          action: matchingStep.action || `${matchingStep.type || 'email'} reminder`,
          actionType: (matchingStep.actionType || matchingStep.type || 'email') as 'email' | 'sms' | 'voice' | 'manual',
          scheduleName: schedule!.name,
          templateId: matchingStep.template || matchingStep.templateId,
          priority: matchingStep.priority || 'normal',
          actionDetails: {
            template: matchingStep.template || matchingStep.templateId,
            subject: matchingStep.subject,
            message: matchingStep.message,
            escalationLevel: matchingStep.escalationLevel,
          },
          // Aggregated data for consolidated reminders
          allInvoices,
          invoiceCount: contactInvoices.length,
          totalOverdue: `£${totalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          oldestInvoiceDays: oldestDays,
          invoiceTable,
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
      tenantId: invoice.tenantId,  // Include tenantId for customer profile lookup
      invoiceNumber: invoice.invoiceNumber,
      contactName: contact.name || 'Unknown',
      companyName: contact.companyName || undefined,
      contactFirstName: ((contact.name || '').trim().split(/\s+/)[0]) || contact.name || 'Unknown',
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