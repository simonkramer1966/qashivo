import { db } from '../db';
import { storage } from '../storage';
import { 
  CommunicationChannel, 
  OutboundMessageRequest, 
  OutboundMessageResult,
  InboundMessage,
  PreSendCheckResult,
  OutboundMessageRequestSchema
} from '@shared/schema';
import { sendEmail } from './sendgrid';
import { sendSMS } from './vonage';
import { randomUUID } from 'crypto';
import { wrapInHtmlEmailTemplate } from './messagePostProcessor';
import { resolvePrimaryEmail, resolvePrimarySmsNumber } from './contactEmailResolver';

// Channel adapter interface - unified contract for all communication channels
interface ChannelAdapter {
  channel: CommunicationChannel;
  send(request: OutboundMessageRequest): Promise<OutboundMessageResult>;
  validateContact(contactId: string, tenantId: string): Promise<{ valid: boolean; reason?: string }>;
}

// Pre-send check configuration
interface PreSendCheckConfig {
  checkBusinessHours: boolean;
  checkDailyLimits: boolean;
  checkCooldown: boolean;
  checkVulnerability: boolean;
  checkDispute: boolean;
  checkLegalHold: boolean;
}

class CommunicationsOrchestrator {
  private adapters: Map<CommunicationChannel, ChannelAdapter> = new Map();
  
  constructor() {
    this.registerAdapters();
  }
  
  private registerAdapters() {
    // Email adapter
    this.adapters.set('email', {
      channel: 'email',
      send: this.sendEmail.bind(this),
      validateContact: this.validateEmailContact.bind(this),
    });
    
    // SMS adapter
    this.adapters.set('sms', {
      channel: 'sms',
      send: this.sendSMS.bind(this),
      validateContact: this.validateSMSContact.bind(this),
    });
    
    // Voice adapter
    this.adapters.set('voice', {
      channel: 'voice',
      send: this.sendVoice.bind(this),
      validateContact: this.validateVoiceContact.bind(this),
    });
  }
  
  // Main outbound send method
  async send(request: OutboundMessageRequest): Promise<OutboundMessageResult> {
    const traceId = randomUUID();
    console.log(`📤 [${traceId}] Outbound ${request.channel} request for contact ${request.contactId}`);
    
    try {
      // Validate request
      const validatedRequest = OutboundMessageRequestSchema.parse(request);
      
      // Run pre-send checks (unless bypassed)
      if (!validatedRequest.bypassChecks) {
        const checkResult = await this.runPreSendChecks(validatedRequest);
        if (!checkResult.canSend) {
          console.log(`🚫 [${traceId}] Blocked: ${checkResult.blockedReasons.join(', ')}`);
          return {
            success: false,
            channel: validatedRequest.channel,
            status: 'blocked',
            blockedReason: checkResult.blockedReasons.join('; '),
            traceId,
            retryable: false,
          };
        }
        
        // Log warnings
        if (checkResult.warnings.length > 0) {
          console.log(`⚠️ [${traceId}] Warnings: ${checkResult.warnings.join(', ')}`);
        }
      }
      
      // Get adapter and send
      const adapter = this.adapters.get(validatedRequest.channel);
      if (!adapter) {
        throw new Error(`No adapter registered for channel: ${validatedRequest.channel}`);
      }
      
      const result = await adapter.send(validatedRequest);
      result.traceId = traceId;
      
      // Log result
      await this.logOutboundMessage(validatedRequest, result);
      
      console.log(`✅ [${traceId}] ${result.status}: ${result.messageId || 'no-id'}`);
      return result;
      
    } catch (error: any) {
      console.error(`❌ [${traceId}] Send failed:`, error.message);
      return {
        success: false,
        channel: request.channel,
        status: 'failed',
        traceId,
        error: error.message,
        retryable: this.isRetryableError(error),
      };
    }
  }
  
  // Pre-send checks
  async runPreSendChecks(
    request: OutboundMessageRequest,
    config: PreSendCheckConfig = {
      checkBusinessHours: true,
      checkDailyLimits: true,
      checkCooldown: true,
      checkVulnerability: true,
      checkDispute: true,  // Default to true - block sends for disputed invoices
      checkLegalHold: true,
    }
  ): Promise<PreSendCheckResult> {
    const blockedReasons: string[] = [];
    const warnings: string[] = [];
    
    const checks = {
      withinBusinessHours: true,
      notOnDoNotContact: true,
      withinDailyLimits: true,
      withinCooldownPeriod: true,
      hasValidContactDetails: true,
      noActiveDispute: true,
      noLegalHold: true,
      notVulnerable: true,
      hasRequiredData: true,
    };
    
    try {
      // Get tenant settings
      const tenant = await storage.getTenant(request.tenantId);
      if (!tenant) {
        blockedReasons.push('Tenant not found');
        return { canSend: false, blockedReasons, warnings, checks };
      }
      
      // Get contact
      const contact = await storage.getContact(request.contactId, request.tenantId);
      if (!contact) {
        blockedReasons.push('Contact not found');
        checks.hasRequiredData = false;
        return { canSend: false, blockedReasons, warnings, checks };
      }
      
      // Check 1: Business hours (for voice calls primarily)
      if (config.checkBusinessHours && request.channel === 'voice') {
        const withinHours = this.isWithinBusinessHours(tenant);
        checks.withinBusinessHours = withinHours;
        if (!withinHours) {
          blockedReasons.push('Outside business hours for voice calls');
        }
      }
      
      // Check 2: Do Not Contact flag
      if ((contact as any).doNotContact) {
        checks.notOnDoNotContact = false;
        blockedReasons.push('Contact marked as Do Not Contact');
      }
      
      // Check 3: Valid contact details for channel
      const validation = await this.adapters.get(request.channel)?.validateContact(request.contactId, request.tenantId);
      if (validation && !validation.valid) {
        checks.hasValidContactDetails = false;
        blockedReasons.push(validation.reason || 'Invalid contact details for channel');
      }
      
      // Check 4: Daily limits
      if (config.checkDailyLimits) {
        const withinLimits = await this.checkDailyLimits(request.tenantId, request.channel, tenant);
        checks.withinDailyLimits = withinLimits;
        if (!withinLimits) {
          blockedReasons.push('Daily send limit reached for this channel');
        }
      }
      
      // Check 5: Cooldown period
      if (config.checkCooldown) {
        const withinCooldown = await this.checkCooldownPeriod(
          request.contactId, 
          request.channel, 
          request.tenantId,
          tenant
        );
        checks.withinCooldownPeriod = withinCooldown;
        if (!withinCooldown) {
          warnings.push('Contact was recently contacted on this channel');
        }
      }
      
      // Check 6: Vulnerability
      if (config.checkVulnerability && (contact as any).isPotentiallyVulnerable) {
        checks.notVulnerable = false;
        blockedReasons.push('Contact marked as vulnerable - requires human review');
      }
      
      // Check 7: Legal hold
      if (config.checkLegalHold && (contact as any).legalHold) {
        checks.noLegalHold = false;
        blockedReasons.push('Contact is on legal hold');
      }
      
      // Check 8: Active dispute - block automated collections if invoices are disputed
      if (config.checkDispute && request.invoiceIds && request.invoiceIds.length > 0) {
        const hasActiveDispute = await this.checkActiveDisputes(
          request.invoiceIds,
          request.tenantId
        );
        if (hasActiveDispute) {
          checks.noActiveDispute = false;
          blockedReasons.push('One or more invoices have an active dispute - requires manual handling');
        }
      }
      
    } catch (error: any) {
      console.error('Pre-send check error:', error.message);
      blockedReasons.push('Pre-send check failed: ' + error.message);
    }
    
    return {
      canSend: blockedReasons.length === 0,
      blockedReasons,
      warnings,
      checks,
    };
  }
  
  // Channel-specific send implementations
  private async sendEmail(request: OutboundMessageRequest): Promise<OutboundMessageResult> {
    try {
      const contact = await storage.getContact(request.contactId, request.tenantId);
      if (!contact) {
        throw new Error('Contact not found');
      }
      
      const recipientEmail = await resolvePrimaryEmail(contact.id, request.tenantId, contact.email);
      if (!recipientEmail) {
        throw new Error('Contact has no email address');
      }
      
      const tenant = await storage.getTenant(request.tenantId);
      
      const emailSenders = await storage.getEmailSenders(request.tenantId);
      const defaultSender = emailSenders.find(s => s.isDefault) || emailSenders[0];
      
      const fromEmail = defaultSender?.email || process.env.SENDGRID_FROM_EMAIL || 'noreply@qashivo.com';
      const fromName = defaultSender?.fromName || defaultSender?.name || tenant?.name || 'Qashivo';
      
      const companyName = tenant?.name || 'Qashivo';
      const htmlContent = wrapInHtmlEmailTemplate(request.content, {
        companyName,
        companyEmail: fromEmail,
        brandColor: '#17B6C3'
      });
      
      const result = await sendEmail({
        to: recipientEmail,
        subject: request.subject || 'Invoice Reminder',
        html: htmlContent,
        from: `${fromName} <${fromEmail}>`,
        invoiceId: request.invoiceIds?.[0],
        customerId: request.contactId,
      });
      
      if (!result.success) {
        return {
          success: false,
          channel: 'email',
          status: 'failed',
          traceId: '',
          error: result.error || 'Email send failed',
          retryable: true,
        };
      }
      
      return {
        success: true,
        messageId: result.messageId,
        channel: 'email',
        status: 'sent',
        traceId: '',
        sentAt: new Date().toISOString(),
        unitsConsumed: 1,
      };
    } catch (error: any) {
      return {
        success: false,
        channel: 'email',
        status: 'failed',
        traceId: '',
        error: error.message,
        retryable: true,
      };
    }
  }
  
  private async sendSMS(request: OutboundMessageRequest): Promise<OutboundMessageResult> {
    try {
      const contact = await storage.getContact(request.contactId, request.tenantId);
      if (!contact) {
        throw new Error('Contact not found');
      }
      const recipientPhone = await resolvePrimarySmsNumber(contact.id, request.tenantId, contact.phone);
      if (!recipientPhone) {
        throw new Error('Contact has no phone number');
      }
      
      const result = await sendSMS({
        to: recipientPhone,
        message: request.content,
        invoiceId: request.invoiceIds?.[0],
        customerId: request.contactId,
      });
      
      return {
        success: result.success,
        messageId: result.messageId,
        channel: 'sms',
        status: result.success ? 'sent' : 'failed',
        traceId: '',
        sentAt: new Date().toISOString(),
        unitsConsumed: Math.ceil(request.content.length / 160),
        error: result.error,
      };
    } catch (error: any) {
      return {
        success: false,
        channel: 'sms',
        status: 'failed',
        traceId: '',
        error: error.message,
        retryable: true,
      };
    }
  }
  
  private async sendVoice(request: OutboundMessageRequest): Promise<OutboundMessageResult> {
    try {
      const contact = await storage.getContact(request.contactId, request.tenantId);
      if (!contact) {
        throw new Error('Contact not found');
      }
      const recipientPhone = await resolvePrimarySmsNumber(contact.id, request.tenantId, contact.phone);
      if (!recipientPhone) {
        throw new Error('Contact has no phone number');
      }
      
      const tenant = await storage.getTenant(request.tenantId);
      
      const { RetellService } = await import('../retell-service');
      const retellService = new RetellService();
      
      const fromNumber = process.env.RETELL_FROM_NUMBER || process.env.VONAGE_PHONE_NUMBER || '';
      
      if (!fromNumber) {
        return {
          success: false,
          channel: 'voice',
          status: 'failed',
          traceId: '',
          error: 'No from number configured for voice calls',
          retryable: false,
        };
      }
      
      const callResult = await retellService.createCall({
        fromNumber,
        toNumber: recipientPhone,
        agentId: process.env.RETELL_AGENT_ID,
        dynamicVariables: {
          customer_name: contact.name || 'Customer',
          company_name: tenant?.name || 'Our Company',
          ...request.personalization,
        },
        metadata: {
          tenantId: request.tenantId,
          contactId: request.contactId,
          invoiceId: request.invoiceIds?.[0],
          actionId: request.actionId,
          priority: request.priority,
          tone: request.tone,
          escalationLevel: request.escalationLevel,
        },
      });
      
      console.log(`🎙️ Voice call initiated: ${callResult.callId}`);
      
      return {
        success: true,
        messageId: callResult.callId,
        channel: 'voice',
        status: 'queued',
        traceId: '',
        sentAt: new Date().toISOString(),
        unitsConsumed: 1, // Will be updated on call completion webhook
      };
    } catch (error: any) {
      console.error('Voice call failed:', error.message);
      return {
        success: false,
        channel: 'voice',
        status: 'failed',
        traceId: '',
        error: error.message,
        retryable: this.isRetryableError(error),
      };
    }
  }
  
  // Validation helpers
  private async validateEmailContact(contactId: string, tenantId: string): Promise<{ valid: boolean; reason?: string }> {
    const contact = await storage.getContact(contactId, tenantId);
    if (!contact) {
      return { valid: false, reason: 'Contact not found' };
    }
    const recipientEmail = await resolvePrimaryEmail(contactId, tenantId, contact.email);
    if (!recipientEmail) {
      return { valid: false, reason: 'No email address' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return { valid: false, reason: 'Invalid email format' };
    }
    return { valid: true };
  }
  
  private async validateSMSContact(contactId: string, tenantId: string): Promise<{ valid: boolean; reason?: string }> {
    const contact = await storage.getContact(contactId, tenantId);
    if (!contact) {
      return { valid: false, reason: 'Contact not found' };
    }
    const recipientPhone = await resolvePrimarySmsNumber(contactId, tenantId, contact.phone);
    if (!recipientPhone) {
      return { valid: false, reason: 'No phone number' };
    }
    // Basic phone validation (should have digits)
    const cleaned = recipientPhone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      return { valid: false, reason: 'Phone number too short' };
    }
    return { valid: true };
  }
  
  private async validateVoiceContact(contactId: string, tenantId: string): Promise<{ valid: boolean; reason?: string }> {
    // Same as SMS for now
    return this.validateSMSContact(contactId, tenantId);
  }
  
  // Check helpers
  private isWithinBusinessHours(tenant: any): boolean {
    const now = new Date();
    const hours = now.getHours();
    const startHour = parseInt(tenant.businessHoursStart?.split(':')[0] || '8');
    const endHour = parseInt(tenant.businessHoursEnd?.split(':')[0] || '18');
    return hours >= startHour && hours < endHour;
  }
  
  private async checkDailyLimits(tenantId: string, channel: CommunicationChannel, tenant: any): Promise<boolean> {
    const limits = tenant.dailyLimits || { email: 100, sms: 50, voice: 20 };
    const limit = limits[channel] || 100;
    
    // Count today's sends
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // This would query the actions table - simplified for now
    // In production, add proper count query
    return true; // Assume within limits for now
  }
  
  private async checkCooldownPeriod(
    contactId: string, 
    channel: CommunicationChannel, 
    tenantId: string,
    tenant: any
  ): Promise<boolean> {
    const cooldowns = tenant.channelCooldowns || { email: 3, sms: 5, voice: 7 };
    const cooldownDays = cooldowns[channel] || 3;
    
    // Check last contact on this channel
    // In production, query actions table for last contact
    return true; // Assume within cooldown for now
  }
  
  private async checkActiveDisputes(invoiceIds: string[], tenantId: string): Promise<boolean> {
    try {
      // Check if any of the invoices have an active dispute
      for (const invoiceId of invoiceIds) {
        const invoice = await storage.getInvoice(invoiceId, tenantId);
        if (invoice) {
          // Check invoice pause state for dispute
          if (invoice.pauseState === 'dispute') {
            return true;
          }
          // Check collection stage or status
          if (invoice.collectionStage === 'disputed' || invoice.stage === 'disputed') {
            return true;
          }
        }
      }
      return false;
    } catch (error: any) {
      console.error('Error checking disputes:', error.message);
      return false; // Fail open - allow send if check fails
    }
  }
  
  private isRetryableError(error: any): boolean {
    // Network errors, rate limits are retryable
    const retryablePatterns = ['ETIMEDOUT', 'ECONNRESET', 'rate limit', '429', '503'];
    const errorString = error.message?.toLowerCase() || '';
    return retryablePatterns.some(p => errorString.includes(p.toLowerCase()));
  }
  
  private async logOutboundMessage(request: OutboundMessageRequest, result: OutboundMessageResult): Promise<void> {
    // Log to actions table with full analytics metadata
    try {
      await storage.createAction({
        tenantId: request.tenantId,
        contactId: request.contactId,
        invoiceId: request.invoiceIds?.[0] || null,
        type: request.channel === 'voice' ? 'call' : request.channel,
        status: result.success ? 'completed' : 'failed',
        subject: request.subject || `${request.channel.toUpperCase()} sent`,
        content: request.content,
        metadata: {
          direction: 'outbound',
          traceId: result.traceId,
          messageId: result.messageId,
          channel: request.channel,
          result: result.status,
          error: result.error,
          priority: request.priority,
          tone: request.tone,
          escalationLevel: request.escalationLevel,
          // Template analytics
          templateId: request.templateId,
          personalizationKeys: request.personalization ? Object.keys(request.personalization) : [],
          // Billing analytics
          unitsConsumed: result.unitsConsumed,
          sentAt: result.sentAt,
          // Invoice context
          invoiceIds: request.invoiceIds,
          invoiceCount: request.invoiceIds?.length || 0,
        },
      });
    } catch (error: any) {
      console.error('Failed to log outbound message:', error.message);
    }
  }
  
  // Inbound message processing
  async processInboundMessage(message: Partial<InboundMessage>): Promise<InboundMessage> {
    const id = randomUUID();
    console.log(`📥 [${id}] Processing inbound ${message.channel} message`);
    
    const processedMessage: InboundMessage = {
      id,
      tenantId: message.tenantId || '',
      channel: message.channel || 'email',
      direction: 'inbound',
      senderName: message.senderName,
      senderEmail: message.senderEmail,
      senderPhone: message.senderPhone,
      contactId: message.contactId,
      subject: message.subject,
      content: message.content || '',
      rawPayload: message.rawPayload,
      processed: false,
      receivedAt: new Date().toISOString(),
    };
    
    // Match to contact if not already matched
    if (!processedMessage.contactId) {
      processedMessage.contactId = await this.matchContact(processedMessage);
    }
    
    // Intent analysis will be handled by Intent Analyst service
    // This is just the normalized inbound message
    
    return processedMessage;
  }
  
  private async matchContact(message: InboundMessage): Promise<string | undefined> {
    if (!message.tenantId) return undefined;
    
    // Try to match by email or phone
    const searchTerm = message.senderEmail || message.senderPhone;
    if (!searchTerm) return undefined;
    
    try {
      const contacts = await storage.getContacts(message.tenantId);
      const match = contacts.find(c => 
        c.email?.toLowerCase() === message.senderEmail?.toLowerCase() ||
        c.phone?.replace(/\D/g, '') === message.senderPhone?.replace(/\D/g, '')
      );
      return match?.id;
    } catch {
      return undefined;
    }
  }
}

// Export singleton instance
export const communicationsOrchestrator = new CommunicationsOrchestrator();
