import { eq, and, lte, sql, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { actions, contacts, invoices, tenants } from "@shared/schema";
import { sendEmail } from "./sendgrid";
import { sendSMS } from "./vonage";
import { RetellService } from "../retell-service";
import { websocketService } from "./websocketService";
import { aiMessageGenerator, type MessageContext, type ToneSettings } from "./aiMessageGenerator";
import { ToneProfile, PlaybookStage } from "./playbookEngine";

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
   * Build message context from action data
   */
  private buildMessageContext(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): MessageContext {
    const daysOverdue = invoice?.dueDate 
      ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      : action.metadata?.daysOverdue || 0;

    return {
      customerName: contact.name || 'Customer',
      companyName: contact.companyName || contact.name,
      invoiceNumber: invoice?.invoiceNumber || action.metadata?.invoiceNumber || 'N/A',
      invoiceAmount: this.parseAmount(invoice?.amount ?? action.metadata?.amount ?? 0),
      currency: '£',
      dueDate: invoice?.dueDate ? new Date(invoice.dueDate) : new Date(),
      daysOverdue,
      totalOutstanding: action.metadata?.totalOutstanding,
      invoiceCount: action.metadata?.invoiceCount,
      previousContactCount: action.metadata?.previousContactCount,
      lastContactDate: action.metadata?.lastContactDate ? new Date(action.metadata.lastContactDate) : undefined,
      lastContactChannel: action.metadata?.lastContactChannel,
      hasPromiseToPay: action.metadata?.hasPromiseToPay,
      promiseToPayDate: action.metadata?.promiseToPayDate ? new Date(action.metadata.promiseToPayDate) : undefined,
      promiseToPayMissed: action.metadata?.promiseToPayMissed,
      isHighValue: action.metadata?.isHighValue,
      isVip: action.metadata?.isVip,
      hasDispute: action.metadata?.hasDispute,
      tenantName: tenant.name || 'Accounts Team',
      tenantPhone: tenant.phone,
      tenantEmail: tenant.email,
      paymentLink: action.metadata?.paymentLink,
    };
  }

  /**
   * Build tone settings from action metadata
   */
  private buildToneSettings(action: any): ToneSettings {
    return {
      stage: (action.metadata?.stage || 'CREDIT_CONTROL') as PlaybookStage,
      toneProfile: (action.metadata?.toneProfile || 'CREDIT_CONTROL_FRIENDLY') as ToneProfile,
      reasonCode: action.metadata?.reasonCode,
      templateId: action.metadata?.templateId,
      tenantStyle: action.metadata?.tenantStyle,
      useLatePaymentLegislation: action.metadata?.useLatePaymentLegislation,
    };
  }

  /**
   * Send email action with AI-generated content
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

      const messageContext = this.buildMessageContext(action, contact, invoice, tenant);
      const toneSettings = this.buildToneSettings(action);

      let emailContent: { subject: string; body: string };

      if (action.content && action.content.trim() !== '') {
        emailContent = {
          subject: action.subject || 'Payment Reminder',
          body: this.replaceTemplateVariables(action.content, contact, invoice)
        };
      } else {
        console.log(`🤖 Generating AI email for ${contact.name}...`);
        const generated = await aiMessageGenerator.generateEmail(messageContext, toneSettings);
        emailContent = {
          subject: generated.subject || 'Payment Reminder',
          body: generated.body
        };
        console.log(`✅ AI email generated with subject: ${emailContent.subject}`);
      }

      const result = await sendEmail({
        to: contact.email,
        from: `${tenant.name} <noreply@qashivo.com>`,
        subject: emailContent.subject,
        html: emailContent.body,
        text: emailContent.body.replace(/<[^>]*>/g, ''),
      });

      return { 
        success: result, 
        data: { 
          emailSent: true, 
          to: contact.email,
          subject: emailContent.subject,
          aiGenerated: !action.content || action.content.trim() === ''
        } 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS action with AI-generated content
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

      let message: string;

      if (action.content && action.content.trim() !== '') {
        message = this.replaceTemplateVariables(action.content, contact, invoice);
      } else {
        console.log(`🤖 Generating AI SMS for ${contact.name}...`);
        const messageContext = this.buildMessageContext(action, contact, invoice, tenant);
        const toneSettings = this.buildToneSettings(action);
        const generated = await aiMessageGenerator.generateSMS(messageContext, toneSettings);
        message = generated.body;
        console.log(`✅ AI SMS generated: ${message.substring(0, 50)}...`);
      }

      const result = await sendSMS({
        to: contact.phone,
        message: message,
      });

      return { 
        success: result.success, 
        data: { 
          messageId: result.messageId,
          aiGenerated: !action.content || action.content.trim() === ''
        },
        error: result.error 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send WhatsApp action with AI-generated content
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

      let message: string;

      if (action.content && action.content.trim() !== '') {
        message = this.replaceTemplateVariables(action.content, contact, invoice);
      } else {
        console.log(`🤖 Generating AI WhatsApp message for ${contact.name}...`);
        const messageContext = this.buildMessageContext(action, contact, invoice, tenant);
        const toneSettings = this.buildToneSettings(action);
        const generated = await aiMessageGenerator.generateSMS(messageContext, toneSettings);
        message = generated.body;
        console.log(`✅ AI WhatsApp message generated`);
      }

      const result = await sendSMS({
        to: contact.phone,
        message: message,
        from: process.env.VONAGE_WHATSAPP_NUMBER || process.env.VONAGE_PHONE_NUMBER,
      });

      return { 
        success: result.success, 
        data: { 
          messageId: result.messageId,
          aiGenerated: !action.content || action.content.trim() === ''
        },
        error: result.error 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Initiate AI voice call with AI-generated opening script
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

      let openingScript: string | undefined;
      
      if (!action.content || action.content.trim() === '') {
        console.log(`🤖 Generating AI voice script for ${contact.name}...`);
        const messageContext = this.buildMessageContext(action, contact, invoice, tenant);
        const toneSettings = this.buildToneSettings(action);
        const generated = await aiMessageGenerator.generateVoiceScript(messageContext, toneSettings);
        openingScript = generated.voiceScript;
        console.log(`✅ AI voice script generated`);
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
          voiceTone: action.metadata?.voiceTone || 'VOICE_TONE_CALM_COLLABORATIVE',
          toneProfile: action.metadata?.toneProfile || 'CREDIT_CONTROL_FRIENDLY',
          stage: action.metadata?.stage || 'CREDIT_CONTROL',
          reasonCode: action.metadata?.reasonCode || 'GENERIC_OVERDUE_FOLLOWUP',
          openingScript: openingScript || '',
        },
        metadata: {
          tenantId: tenant.id,
          contactId: contact.id,
          invoiceId: invoice?.id,
          actionId: action.id,
          voiceTone: action.metadata?.voiceTone,
          stage: action.metadata?.stage,
          aiGenerated: !action.content || action.content.trim() === '',
        }
      });

      return { 
        success: true, 
        data: { ...result, aiGenerated: !action.content || action.content.trim() === '' }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Safely parse amount value (handles both string and number)
   */
  private parseAmount(value: any): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
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
      '{amount}': invoice?.amount ? `£${this.parseAmount(invoice.amount).toFixed(2)}` : 'N/A',
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
