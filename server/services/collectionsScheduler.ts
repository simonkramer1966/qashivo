import { eq, and, inArray, gte, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { tenants, actions, emailSenders, communicationTemplates, contacts, invoices } from "@shared/schema";
import { checkCollectionActions, CollectionAction } from "./collectionsAutomation";
import { sendEmail } from "./sendgrid";

interface SchedulerConfig {
  intervalMinutes: number;
  enabled: boolean;
  runOnStartup: boolean;
}

interface ActionExecutionResult {
  invoiceId: string;
  contactId: string;
  actionType: string;
  success: boolean;
  error?: string;
}

class CollectionsScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private config: SchedulerConfig;
  private isRunning: boolean = false;

  constructor(config: SchedulerConfig = { 
    intervalMinutes: 60, // Run every hour
    enabled: true, 
    runOnStartup: true 
  }) {
    this.config = config;
  }

  /**
   * Start the automated collections scheduler
   */
  start(): void {
    if (this.intervalId) {
      console.log("Collections scheduler already running");
      return;
    }

    if (!this.config.enabled) {
      console.log("Collections scheduler disabled by configuration");
      return;
    }

    console.log(`🚀 Starting collections automation scheduler (interval: ${this.config.intervalMinutes} minutes)`);

    // Run immediately on startup if configured
    if (this.config.runOnStartup) {
      setTimeout(() => this.executeCollectionRun(), 5000); // Wait 5 seconds for app startup
    }

    // Set up recurring execution
    this.intervalId = setInterval(
      () => this.executeCollectionRun(),
      this.config.intervalMinutes * 60 * 1000
    );

    console.log("✅ Collections scheduler started successfully");
  }

  /**
   * Stop the automated collections scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("🛑 Collections scheduler stopped");
    }
  }

  /**
   * Execute a complete collection run for all tenants
   */
  private async executeCollectionRun(): Promise<void> {
    if (this.isRunning) {
      console.log("⏭️  Skipping collection run - previous run still in progress");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log("🔄 Starting automated collections run...");

      // Get all tenants with collections automation enabled
      const enabledTenants = await db
        .select({ 
          id: tenants.id, 
          name: tenants.name,
          collectionsAutomationEnabled: tenants.collectionsAutomationEnabled
        })
        .from(tenants)
        .where(eq(tenants.collectionsAutomationEnabled, true));

      console.log(`📊 Found ${enabledTenants.length} tenants with collections automation enabled`);

      let totalActionsGenerated = 0;
      let totalActionsExecuted = 0;
      let totalErrors = 0;

      // Process each tenant
      for (const tenant of enabledTenants) {
        try {
          console.log(`🏢 Processing tenant: ${tenant.name} (${tenant.id})`);

          // Update invoice statuses first
          const statusUpdates = await this.updateInvoiceStatuses(tenant.id);
          if (statusUpdates > 0) {
            console.log(`  📊 Updated ${statusUpdates} invoice statuses to 'overdue'`);
          }

          // Check for pending collection actions
          const pendingActions = await checkCollectionActions(tenant.id);
          totalActionsGenerated += pendingActions.length;

          if (pendingActions.length === 0) {
            console.log(`  ✅ No pending actions for ${tenant.name}`);
            continue;
          }

          console.log(`  📝 Found ${pendingActions.length} pending actions for ${tenant.name}`);

          // Filter out actions that were already executed today
          const actionsToExecute = await this.filterAlreadyExecutedActions(tenant.id, pendingActions);
          
          if (actionsToExecute.length === 0) {
            console.log(`  ⏭️  All actions already executed today for ${tenant.name}`);
            continue;
          }

          console.log(`  🎯 Executing ${actionsToExecute.length} new actions for ${tenant.name}`);

          // Execute the actions
          const results = await this.executeActions(tenant.id, actionsToExecute);
          totalActionsExecuted += results.filter(r => r.success).length;
          totalErrors += results.filter(r => !r.success).length;

          // Log results
          const successCount = results.filter(r => r.success).length;
          const errorCount = results.filter(r => !r.success).length;
          console.log(`  ✅ ${successCount} actions executed successfully, ${errorCount} errors`);

        } catch (error: any) {
          console.error(`❌ Error processing tenant ${tenant.name}:`, error);
          totalErrors++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`🏁 Collections run completed in ${duration}ms`);
      console.log(`📈 Summary: ${totalActionsGenerated} actions found, ${totalActionsExecuted} executed, ${totalErrors} errors`);

    } catch (error: any) {
      console.error("❌ Critical error in collections run:", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Filter out actions that were already executed today to prevent duplicates
   */
  private async filterAlreadyExecutedActions(
    tenantId: string, 
    pendingActions: CollectionAction[]
  ): Promise<CollectionAction[]> {
    if (pendingActions.length === 0) return [];

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get actions already executed today for these invoices
      const invoiceIds = pendingActions.map(action => action.invoiceId);
      
      const executedToday = await db
        .select({ 
          invoiceId: actions.invoiceId,
          type: actions.type 
        })
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, tenantId),
            inArray(actions.invoiceId, invoiceIds),
            gte(actions.createdAt, today),
            lt(actions.createdAt, tomorrow)
          )
        );

      // Create a set of executed action keys for quick lookup
      const executedKeys = new Set(
        executedToday.map(action => `${action.invoiceId}-${action.type}`)
      );

      // Filter out already executed actions
      return pendingActions.filter(action => 
        !executedKeys.has(`${action.invoiceId}-${action.actionType}`)
      );

    } catch (error: any) {
      console.error("Error filtering executed actions:", error);
      // Return all actions if filtering fails to be safe
      return pendingActions;
    }
  }

  /**
   * Execute collection actions (send emails, record actions, etc.)
   */
  private async executeActions(
    tenantId: string, 
    actionsToExecute: CollectionAction[]
  ): Promise<ActionExecutionResult[]> {
    const results: ActionExecutionResult[] = [];

    for (const action of actionsToExecute) {
      try {
        console.log(`  📧 Executing ${action.actionType} action for invoice ${action.invoiceNumber}`);

        let success = false;
        let error: string | undefined;

        // Execute based on action type
        switch (action.actionType) {
          case 'email':
            success = await this.executeEmailAction(tenantId, action);
            break;
            
          case 'sms':
            // SMS implementation would go here
            console.log(`    📱 SMS action not yet implemented for ${action.invoiceNumber}`);
            success = false;
            error = "SMS action not implemented";
            break;
            
          case 'voice':
            // Voice call implementation would go here
            console.log(`    📞 Voice action not yet implemented for ${action.invoiceNumber}`);
            success = false;
            error = "Voice action not implemented";
            break;
            
          case 'manual':
            // Manual actions just get recorded
            success = true;
            console.log(`    👤 Manual action recorded for ${action.invoiceNumber}`);
            break;
            
          default:
            success = false;
            error = `Unknown action type: ${action.actionType}`;
        }

        // Record the action in the database
        if (success) {
          await this.recordAction(tenantId, action);
        }

        results.push({
          invoiceId: action.invoiceId,
          contactId: action.contactId,
          actionType: action.actionType,
          success,
          error
        });

      } catch (err: any) {
        console.error(`    ❌ Error executing action for ${action.invoiceNumber}:`, err);
        results.push({
          invoiceId: action.invoiceId,
          contactId: action.contactId,
          actionType: action.actionType,
          success: false,
          error: err.message
        });
      }
    }

    return results;
  }

  /**
   * Execute an email collection action
   */
  private async executeEmailAction(tenantId: string, action: CollectionAction): Promise<boolean> {
    try {
      // Get default email sender for tenant
      const defaultSender = await db.query.emailSenders.findFirst({
        where: and(
          eq(emailSenders.tenantId, tenantId),
          eq(emailSenders.isDefault, true)
        )
      });

      if (!defaultSender) {
        console.error(`    ❌ No default email sender configured for tenant ${tenantId}`);
        return false;
      }

      // Get template if specified
      let subject = action.actionDetails.subject || `Payment Reminder - Invoice ${action.invoiceNumber}`;
      let content = action.actionDetails.message || `Dear ${action.contactName},\n\nThis is a reminder that invoice ${action.invoiceNumber} is overdue by ${action.daysOverdue} days.\n\nPlease arrange payment at your earliest convenience.`;

      if (action.templateId) {
        const template = await db.query.communicationTemplates.findFirst({
          where: and(
            eq(communicationTemplates.id, action.templateId),
            eq(communicationTemplates.tenantId, tenantId)
          )
        });

        if (template) {
          subject = template.subject || subject;
          content = template.content || content;

          // Process template variables
          content = this.processTemplateVariables(content, action);
          subject = this.processTemplateVariables(subject, action);
        }
      }

      // Get contact email (this would need to be fetched from the contact record)
      const contact = await db.query.contacts.findFirst({
        where: eq(contacts.id, action.contactId)
      });

      if (!contact?.email) {
        console.error(`    ❌ No email address for contact ${action.contactName}`);
        return false;
      }

      // Send email
      const emailSent = await sendEmail({
        to: contact.email,
        from: `${defaultSender.fromName} <${defaultSender.email}>`,
        subject,
        html: content.replace(/\n/g, '<br>'),
        text: content
      });

      if (emailSent) {
        console.log(`    ✅ Email sent successfully to ${contact.email}`);
        return true;
      } else {
        console.error(`    ❌ Failed to send email to ${contact.email}`);
        return false;
      }

    } catch (error: any) {
      console.error(`    ❌ Error sending email:`, error);
      return false;
    }
  }

  /**
   * Process template variables in content
   */
  private processTemplateVariables(content: string, action: CollectionAction): string {
    return content
      .replace(/{{contact_name}}/g, action.contactName)
      .replace(/{{invoice_number}}/g, action.invoiceNumber)
      .replace(/{{days_overdue}}/g, action.daysOverdue.toString())
      .replace(/{{amount}}/g, action.amount)
      .replace(/{{your_name}}/g, 'Collections Team') // This could be dynamic
      .replace(/{{total_balance}}/g, action.amount)
      .replace(/{{total_amount_overdue}}/g, action.amount);
  }

  /**
   * Record action in the actions table
   */
  private async recordAction(tenantId: string, action: CollectionAction): Promise<void> {
    try {
      await db.insert(actions).values({
        tenantId,
        invoiceId: action.invoiceId,
        contactId: action.contactId,
        type: action.actionType,
        subject: `${action.action} - Invoice ${action.invoiceNumber}`,
        content: `Automated ${action.actionType} action from schedule: ${action.scheduleName}`,
        status: 'completed',
        completedAt: new Date(),
        metadata: {
          scheduleName: action.scheduleName,
          daysOverdue: action.daysOverdue,
          priority: action.priority
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`    📝 Action recorded for invoice ${action.invoiceNumber}`);
    } catch (error: any) {
      console.error(`    ❌ Error recording action:`, error);
      throw error;
    }
  }

  /**
   * Update invoice statuses based on due dates
   * Automatically transition pending → overdue when past due
   */
  private async updateInvoiceStatuses(tenantId: string): Promise<number> {
    try {
      const result = await db
        .update(invoices)
        .set({ 
          status: 'overdue',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.status, 'pending'),
            sql`${invoices.dueDate} < NOW()`
          )
        );
      
      // For PostgreSQL with Drizzle, the result is an array with rowCount
      const updatedCount = Array.isArray(result) ? result.length : 0;
      
      return updatedCount;
    } catch (error: any) {
      console.error(`❌ Error updating invoice statuses for tenant ${tenantId}:`, error);
      return 0;
    }
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.intervalId && newConfig.intervalMinutes) {
      // Restart with new interval
      this.stop();
      this.start();
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus(): { running: boolean; config: SchedulerConfig; nextRun?: Date } {
    const nextRun = this.intervalId 
      ? new Date(Date.now() + this.config.intervalMinutes * 60 * 1000)
      : undefined;

    return {
      running: !!this.intervalId,
      config: this.config,
      nextRun
    };
  }
}

// Export singleton instance
export const collectionsScheduler = new CollectionsScheduler();

// Auto-start scheduler when module loads
if (process.env.NODE_ENV !== 'test') {
  collectionsScheduler.start();
}