import { eq, and, lte, sql, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { actions, contacts, invoices, tenants } from "@shared/schema";
import { sendEmail } from "./sendgrid";
import { sendSMS } from "./vonage";
import { RetellService } from "../retell-service";
import { websocketService } from "./websocketService";

/**
 * Action Executor Service
 * Phase 2 of two-phase scheduling:
 * - Runs every 5-15 minutes
 * - Finds actions with scheduledFor <= NOW() AND approved
 * - Executes them (email/SMS/WhatsApp/voice)
 * - Updates status to completed/failed
 * 
 * Week 1 Enhancement: Only executes actions that have been approved
 * via the daily plan approval workflow (status='scheduled' AND approvedBy set)
 */
export class ActionExecutor {
  private isRunning: boolean = false;

  /**
   * Execute all pending scheduled actions
   */
  async executeScheduledActions(): Promise<void> {
    if (this.isRunning) {
      console.log("⏭️  Action Executor already running, skipping...");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const now = new Date();
      console.log(`⚡ Action Executor: Checking for scheduled actions at ${now.toISOString()}`);

      // Find all actions scheduled for now or earlier
      // Week 1: Only execute approved actions (status='scheduled' AND approvedBy is set)
      const scheduledActions = await db
        .select({
          action: actions,
          contact: contacts,
          invoice: invoices,
          tenant: tenants,
        })
        .from(actions)
        .innerJoin(contacts, eq(actions.contactId, contacts.id))
        .leftJoin(invoices, eq(actions.invoiceId, invoices.id))
        .innerJoin(tenants, eq(actions.tenantId, tenants.id))
        .where(
          and(
            eq(actions.status, 'scheduled'),
            lte(actions.scheduledFor, now),
            isNotNull(actions.approvedBy) // Only execute approved actions
          )
        )
        .limit(50); // Process max 50 actions per run

      if (scheduledActions.length === 0) {
        console.log("✅ Action Executor: No scheduled actions to execute");
        return;
      }

      console.log(`🚀 Action Executor: Found ${scheduledActions.length} actions to execute`);

      let successCount = 0;
      let errorCount = 0;

      for (const record of scheduledActions) {
        const { action, contact, invoice, tenant } = record;

        try {
          // Update status to executing
          await db
            .update(actions)
            .set({ status: 'executing' })
            .where(eq(actions.id, action.id));

          // Execute based on action type
          const result = await this.executeAction(action, contact, invoice, tenant);

          if (result.success) {
            await db
              .update(actions)
              .set({ 
                status: 'completed',
                completedAt: new Date(),
                metadata: {
                  ...(action.metadata || {}),
                  executionResult: result.data,
                }
              })
              .where(eq(actions.id, action.id));
            successCount++;
            console.log(`✅ Executed ${action.type} action for ${contact.name}`);
            
            // Broadcast real-time update to connected clients
            websocketService.broadcastActionCompleted(action.tenantId, action.id, action.type);
          } else {
            await db
              .update(actions)
              .set({ 
                status: 'failed',
                metadata: {
                  ...(action.metadata || {}),
                  executionError: result.error,
                }
              })
              .where(eq(actions.id, action.id));
            errorCount++;
            console.error(`❌ Failed ${action.type} action for ${contact.name}: ${result.error}`);
          }
        } catch (error: any) {
          await db
            .update(actions)
            .set({ 
              status: 'failed',
              metadata: {
                ...(action.metadata || {}),
                executionError: error.message,
              }
            })
            .where(eq(actions.id, action.id));
          errorCount++;
          console.error(`❌ Error executing action ${action.id}:`, error.message);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Action Executor: Completed in ${duration}ms - ${successCount} successful, ${errorCount} failed`);

    } catch (error: any) {
      console.error("❌ Action Executor error:", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute a single action based on its type
   */
  private async executeAction(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Check communication mode
    if (tenant.communicationMode === 'off') {
      return { 
        success: false, 
        error: 'Communication mode is OFF for this tenant' 
      };
    }

    // In testing mode, log but don't actually send
    if (tenant.communicationMode === 'testing') {
      console.log(`🧪 TEST MODE: Would have sent ${action.type} to ${contact.name}`);
      return { 
        success: true, 
        data: { mode: 'testing', message: 'Simulated send' } 
      };
    }

    // Execute based on action type
    switch (action.type) {
      case 'email':
        return await this.sendEmailAction(action, contact, invoice, tenant);
      
      case 'sms':
        return await this.sendSMSAction(action, contact, invoice, tenant);
      
      case 'whatsapp':
        return await this.sendWhatsAppAction(action, contact, invoice, tenant);
      
      case 'voice':
      case 'call':
        return await this.initiateVoiceCall(action, contact, invoice, tenant);
      
      default:
        return { 
          success: false, 
          error: `Unknown action type: ${action.type}` 
        };
    }
  }

  /**
   * Send email action
   */
  private async sendEmailAction(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!contact.email) {
        return { success: false, error: 'Contact has no email address' };
      }

      const emailData = this.replaceTemplateVariables(
        action.content || '',
        contact,
        invoice
      );

      const result = await sendEmail({
        to: contact.email,
        from: `${tenant.name} <noreply@qashivo.com>`,
        subject: action.subject || 'Payment Reminder',
        html: emailData,
        text: emailData.replace(/<[^>]*>/g, ''),
      });

      return { 
        success: result, 
        data: { emailSent: true, to: contact.email } 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS action
   */
  private async sendSMSAction(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!contact.phone) {
        return { success: false, error: 'Contact has no phone number' };
      }

      const message = this.replaceTemplateVariables(
        action.content || '',
        contact,
        invoice
      );

      const result = await sendSMS({
        to: contact.phone,
        message: message,
      });

      return { 
        success: result.success, 
        data: { messageId: result.messageId },
        error: result.error 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send WhatsApp action
   */
  private async sendWhatsAppAction(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!contact.phone) {
        return { success: false, error: 'Contact has no phone number' };
      }

      const message = this.replaceTemplateVariables(
        action.content || '',
        contact,
        invoice
      );

      // Use Vonage SMS service for WhatsApp
      // WhatsApp routing is determined by Vonage based on number format
      const result = await sendSMS({
        to: contact.phone,
        message: message,
        from: process.env.VONAGE_WHATSAPP_NUMBER || process.env.VONAGE_PHONE_NUMBER,
      });

      return { 
        success: result.success, 
        data: { messageId: result.messageId },
        error: result.error 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Initiate AI voice call
   */
  private async initiateVoiceCall(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!contact.phone) {
        return { success: false, error: 'Contact has no phone number' };
      }

      const agentId = action.metadata?.agentId || process.env.RETELL_AGENT_ID;
      if (!agentId) {
        return { success: false, error: 'No AI agent ID configured' };
      }

      const retellService = new RetellService();
      
      const result = await retellService.createCall({
        fromNumber: process.env.RETELL_PHONE_NUMBER || '+442045772088',
        toNumber: contact.phone,
        agentId: agentId,
        dynamicVariables: {
          customerName: contact.name,
          companyName: contact.companyName || contact.name,
          invoiceNumber: invoice?.invoiceNumber || 'N/A',
          amount: invoice?.amount || 'N/A',
          daysOverdue: action.metadata?.daysOverdue || 0,
        },
        metadata: {
          tenantId: tenant.id,
          contactId: contact.id,
          invoiceId: invoice?.id,
          actionId: action.id,
        }
      });

      return { 
        success: true, 
        data: result 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Replace template variables in content
   */
  private replaceTemplateVariables(
    content: string,
    contact: any,
    invoice: any
  ): string {
    const variables: Record<string, string> = {
      '{firstName}': contact.name?.split(' ')[0] || '',
      '{lastName}': contact.name?.split(' ').slice(1).join(' ') || '',
      '{companyName}': contact.companyName || contact.name || '',
      '{customerName}': contact.name || '',
      '{invoiceNumber}': invoice?.invoiceNumber || 'N/A',
      '{amount}': invoice?.amount ? `£${parseFloat(invoice.amount).toFixed(2)}` : 'N/A',
      '{dueDate}': invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : 'N/A',
      '{daysOverdue}': invoice?.dueDate 
        ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)).toString()
        : '0',
    };

    let result = content;
    for (const [variable, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(variable, 'g'), value);
    }

    return result;
  }
}

// Export singleton instance
export const actionExecutor = new ActionExecutor();
