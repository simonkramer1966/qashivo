// SendGrid implementation of the EmailService interface

import { MailService } from '@sendgrid/mail';
import { 
  EmailMessage, 
  BulkEmailMessage, 
  EmailSendResult, 
  BulkEmailResult,
  ParsedEmail,
  EmailWebhookEvent,
  EmailProviderStatus,
  EmailMetrics,
  EmailServiceConfig,
  EmailProvider,
  DeliveryStatus,
  EmailAddress,
  EmailAttachment 
} from "../../../shared/types/email";
import { EmailService } from './EmailService';

export class SendGridEmailService extends EmailService {
  private mailService: MailService;
  private isConfigured: boolean = false;

  constructor(config: EmailServiceConfig) {
    super(config);
    this.mailService = new MailService();
    this.initialize();
  }

  private initialize(): void {
    const apiKey = this.config.apiKey || process.env.SENDGRID_API_KEY;
    
    if (apiKey && apiKey !== "default_key") {
      this.mailService.setApiKey(apiKey);
      this.isConfigured = true;
      this.log('info', `SendGrid configured successfully with sender: ${this.config.defaultFrom.name} <${this.config.defaultFrom.email}>`);
    } else {
      this.log('warn', 'SendGrid API key not configured, emails will be skipped in development mode');
      this.isConfigured = this.config.environment === 'development'; // Allow development mode
    }
  }

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const validation = this.validateMessage(message);
    if (!validation.isValid) {
      return this.createErrorResult(`Validation failed: ${validation.errors.join(', ')}`, message.messageId);
    }

    if (!this.isConfigured) {
      this.log('info', 'SendGrid not configured, skipping email send in development', {
        to: message.to.map(t => t.email),
        subject: message.subject
      });
      return this.createSuccessResult(
        message.messageId || this.generateMessageId(),
        `dev-${Date.now()}`,
        { development: true }
      );
    }

    try {
      const sendGridMessage = this.convertToSendGridFormat(message);
      
      return await this.retryOperation(async () => {
        const [response] = await this.mailService.send(sendGridMessage);
        
        this.log('info', `Email sent successfully to ${message.to.map(t => t.email).join(', ')}`);
        
        return this.createSuccessResult(
          message.messageId || this.generateMessageId(),
          response.headers['x-message-id'] as string,
          response
        );
      });
    } catch (error: any) {
      this.log('error', 'SendGrid email error', {
        error: error.message,
        code: error.code,
        response: error.response?.body
      });
      
      return this.createErrorResult(
        `SendGrid error: ${error.message}`,
        message.messageId
      );
    }
  }

  async sendBulkEmails(bulkMessage: BulkEmailMessage): Promise<BulkEmailResult> {
    const startTime = new Date();
    const batchId = bulkMessage.batchId || `bulk-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const results: EmailSendResult[] = [];
    const errors: Array<{ recipient: string; error: string; retryable: boolean }> = [];
    
    let successfulSends = 0;
    let failedSends = 0;
    
    // Process recipients in batches to avoid overwhelming the API
    const batchSize = bulkMessage.batchSize || 100;
    const recipients = bulkMessage.recipients;
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchResults = await this.processBatch(bulkMessage, batch, batchId);
      
      results.push(...batchResults);
      
      for (const result of batchResults) {
        if (result.success) {
          successfulSends++;
        } else {
          failedSends++;
          errors.push({
            recipient: result.error || 'unknown',
            error: result.error || 'Unknown error',
            retryable: this.isRetryableError(result.error)
          });
        }
      }
      
      // Apply throttle rate if specified
      if (bulkMessage.throttleRate && i + batchSize < recipients.length) {
        const delay = (batchSize / bulkMessage.throttleRate) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      totalSent: recipients.length,
      successfulSends,
      failedSends,
      results,
      batchId,
      startTime,
      endTime: new Date(),
      errors
    };
  }

  private async processBatch(
    bulkMessage: BulkEmailMessage, 
    recipients: BulkEmailMessage['recipients'], 
    batchId: string
  ): Promise<EmailSendResult[]> {
    const promises = recipients.map(async (recipient) => {
      const message: EmailMessage = {
        to: [recipient.to],
        from: bulkMessage.from,
        subject: this.applyTemplateSubstitutions(bulkMessage.subject, recipient.templateData || {}),
        htmlContent: bulkMessage.htmlContent ? 
          this.applyTemplateSubstitutions(bulkMessage.htmlContent, recipient.templateData || {}) : undefined,
        textContent: bulkMessage.textContent ? 
          this.applyTemplateSubstitutions(bulkMessage.textContent, recipient.templateData || {}) : undefined,
        templateId: bulkMessage.templateId,
        templateData: recipient.templateData,
        category: bulkMessage.category,
        priority: bulkMessage.priority,
        tags: bulkMessage.tags,
        customHeaders: recipient.customHeaders,
        batchId,
        tenantId: bulkMessage.tenantId,
        userId: bulkMessage.userId
      };
      
      return await this.sendEmail(message);
    });
    
    return await Promise.all(promises);
  }

  private applyTemplateSubstitutions(content: string, templateData: Record<string, any>): string {
    let result = content;
    Object.entries(templateData).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(placeholder, String(value));
    });
    return result;
  }

  async sendTemplateEmail(
    templateId: string, 
    recipient: string, 
    templateData: Record<string, any>
  ): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      this.log('info', 'SendGrid not configured, skipping template email send in development', {
        templateId,
        recipient,
        templateData
      });
      return this.createSuccessResult(this.generateMessageId(), `dev-template-${Date.now()}`);
    }

    try {
      const message = {
        to: recipient,
        from: `${this.config.defaultFrom.name} <${this.config.defaultFrom.email}>`,
        templateId: templateId,
        dynamic_template_data: templateData,
      };

      return await this.retryOperation(async () => {
        const [response] = await this.mailService.send(message as any);
        
        this.log('info', `Template email sent successfully to ${recipient}`);
        
        return this.createSuccessResult(
          this.generateMessageId(),
          response.headers['x-message-id'] as string,
          response
        );
      });
    } catch (error: any) {
      this.log('error', 'SendGrid template email error', {
        error: error.message,
        templateId,
        recipient
      });
      
      return this.createErrorResult(`SendGrid template error: ${error.message}`);
    }
  }

  async parseInboundEmail(rawEmailData: any): Promise<ParsedEmail> {
    // SendGrid inbound parse webhook format
    try {
      const parsed: ParsedEmail = {
        messageId: rawEmailData.headers?.['Message-ID'] || this.generateMessageId(),
        from: {
          email: rawEmailData.from,
          name: rawEmailData.from_name
        },
        to: this.parseEmailList(rawEmailData.to),
        cc: rawEmailData.cc ? this.parseEmailList(rawEmailData.cc) : undefined,
        subject: rawEmailData.subject,
        htmlContent: rawEmailData.html,
        textContent: rawEmailData.text,
        headers: rawEmailData.headers || {},
        timestamp: new Date(),
        
        // Additional SendGrid fields
        originalMessageId: rawEmailData.headers?.['Message-ID'],
        inReplyTo: rawEmailData.headers?.['In-Reply-To'],
        references: rawEmailData.headers?.References ? rawEmailData.headers.References.split(' ') : undefined
      };

      // Parse attachments if present
      if (rawEmailData.attachments) {
        parsed.attachments = Object.keys(rawEmailData.attachments).map(filename => ({
          filename,
          content: Buffer.from(rawEmailData.attachments[filename], 'base64'),
          type: 'application/octet-stream', // SendGrid doesn't provide MIME type
        }));
      }

      this.log('info', 'Inbound email parsed successfully', {
        messageId: parsed.messageId,
        from: parsed.from.email,
        subject: parsed.subject
      });

      return parsed;
    } catch (error: any) {
      this.log('error', 'Error parsing inbound email', { error: error.message, rawEmailData });
      throw new Error(`Failed to parse inbound email: ${error.message}`);
    }
  }

  async setupWebhook(webhookUrl: string, events: string[]): Promise<{ success: boolean; webhookId?: string; error?: string }> {
    // SendGrid webhook setup would require admin API calls
    // For now, return a stub implementation
    this.log('info', 'SendGrid webhook setup requested', { webhookUrl, events });
    
    return {
      success: true,
      webhookId: `sendgrid-webhook-${Date.now()}`,
    };
  }

  async processWebhookEvent(rawWebhookData: any): Promise<EmailWebhookEvent> {
    // Process SendGrid webhook events
    const event: EmailWebhookEvent = {
      eventType: this.mapSendGridEventType(rawWebhookData.event),
      messageId: rawWebhookData.sg_message_id,
      providerMessageId: rawWebhookData.sg_message_id,
      recipient: rawWebhookData.email,
      timestamp: new Date(rawWebhookData.timestamp * 1000),
      provider: EmailProvider.SENDGRID,
      rawWebhookData
    };

    // Add event-specific data
    if (rawWebhookData.event === 'click' && rawWebhookData.url) {
      event.eventData = {
        url: rawWebhookData.url,
        userAgent: rawWebhookData.useragent,
        ip: rawWebhookData.ip
      };
    }

    if (rawWebhookData.event === 'bounce') {
      event.eventData = {
        bounceReason: rawWebhookData.reason
      };
    }

    return event;
  }

  async getProviderStatus(): Promise<EmailProviderStatus> {
    const now = new Date();
    
    try {
      // SendGrid doesn't have a health check endpoint, so we'll simulate
      const isHealthy = this.isConfigured;
      
      return {
        provider: EmailProvider.SENDGRID,
        isHealthy,
        lastChecked: now,
        errorCount: 0, // Would track this in a real implementation
        successRate: isHealthy ? 0.99 : 0,
        averageResponseTime: 500, // ms
        dailyQuotaUsed: 0, // Would need to track this
        dailyQuotaLimit: 40000, // SendGrid's free tier limit
      };
    } catch (error: any) {
      return {
        provider: EmailProvider.SENDGRID,
        isHealthy: false,
        lastChecked: now,
        errorCount: 1,
        successRate: 0,
        averageResponseTime: 0,
        lastError: {
          message: error.message,
          timestamp: now,
          code: error.code
        }
      };
    }
  }

  async getMetrics(startDate: Date, endDate: Date): Promise<EmailMetrics> {
    // In a real implementation, this would query SendGrid's stats API
    // For now, return mock metrics
    return {
      totalSent: 0,
      totalDelivered: 0,
      totalBounced: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalUnsubscribed: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
      unsubscribeRate: 0,
      period: { start: startDate, end: endDate },
      providerMetrics: {
        [EmailProvider.SENDGRID]: {
          sent: 0,
          delivered: 0,
          failed: 0,
          averageResponseTime: 500
        }
      }
    };
  }

  async validateEmailAddress(email: string): Promise<{ isValid: boolean; suggestion?: string; risk?: string }> {
    const isValid = this.isValidEmail(email);
    return { isValid };
  }

  async getDeliveryStatus(messageId: string): Promise<{ status: string; events: EmailWebhookEvent[] }> {
    // Would query SendGrid's activity API in a real implementation
    return {
      status: 'delivered',
      events: []
    };
  }

  // Private helper methods
  private convertToSendGridFormat(message: EmailMessage): any {
    const sendGridMessage: any = {
      to: message.to.map(addr => this.formatEmailAddress(addr)),
      from: this.formatEmailAddress(message.from),
      subject: message.subject,
    };

    // Add CC/BCC if present
    if (message.cc && message.cc.length > 0) {
      sendGridMessage.cc = message.cc.map(addr => this.formatEmailAddress(addr));
    }
    if (message.bcc && message.bcc.length > 0) {
      sendGridMessage.bcc = message.bcc.map(addr => this.formatEmailAddress(addr));
    }

    // Add reply-to if present
    if (message.replyTo) {
      sendGridMessage.replyTo = this.formatEmailAddress(message.replyTo);
    }

    // Handle content - SendGrid requires at least one content type
    if (message.htmlContent) {
      sendGridMessage.html = message.htmlContent;
      if (!message.textContent) {
        // Auto-generate text content from HTML
        sendGridMessage.text = message.htmlContent.replace(/<[^>]*>/g, '');
      } else {
        sendGridMessage.text = message.textContent;
      }
    } else if (message.textContent) {
      sendGridMessage.text = message.textContent;
    }

    // Handle attachments
    if (message.attachments && message.attachments.length > 0) {
      sendGridMessage.attachments = message.attachments.map(att => ({
        content: att.content.toString('base64'),
        filename: att.filename,
        type: att.type,
        disposition: att.disposition || 'attachment',
        contentId: att.contentId
      }));
    }

    // Add custom headers
    if (message.customHeaders) {
      sendGridMessage.headers = message.customHeaders;
    }

    // Add categories and tags
    if (message.category) {
      sendGridMessage.categories = [message.category];
    }
    if (message.tags && message.tags.length > 0) {
      sendGridMessage.categories = [...(sendGridMessage.categories || []), ...message.tags];
    }

    // Add tracking settings
    if (message.trackOpens !== undefined || message.trackClicks !== undefined) {
      sendGridMessage.tracking_settings = {};
      
      if (message.trackOpens !== undefined) {
        sendGridMessage.tracking_settings.open_tracking = { enable: message.trackOpens };
      }
      if (message.trackClicks !== undefined) {
        sendGridMessage.tracking_settings.click_tracking = { enable: message.trackClicks };
      }
    }

    return sendGridMessage;
  }

  private formatEmailAddress(address: EmailAddress): string | { email: string; name: string } {
    if (address.name) {
      return { email: address.email, name: address.name };
    }
    return address.email;
  }

  private parseEmailList(emailString: string): EmailAddress[] {
    return emailString.split(',').map(email => ({
      email: email.trim()
    }));
  }

  private mapSendGridEventType(sendGridEvent: string): EmailWebhookEvent['eventType'] {
    const eventMap: Record<string, EmailWebhookEvent['eventType']> = {
      'delivered': 'delivered',
      'open': 'opened',
      'click': 'clicked',
      'bounce': 'bounced',
      'dropped': 'bounced',
      'unsubscribe': 'unsubscribed',
      'group_unsubscribe': 'unsubscribed'
    };
    
    return eventMap[sendGridEvent] || 'delivered';
  }

  private isRetryableError(error?: string): boolean {
    if (!error) return false;
    
    const retryableErrors = [
      'timeout',
      'rate limit',
      'server error',
      '5xx',
      'network'
    ];
    
    return retryableErrors.some(retryable => 
      error.toLowerCase().includes(retryable)
    );
  }
}