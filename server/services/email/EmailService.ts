// Abstract EmailService interface for enterprise email functionality

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
  DeliveryStatus 
} from "../../../shared/types/email";

/**
 * Abstract base class for email service providers
 * Defines the contract that all email service implementations must follow
 */
export abstract class EmailService {
  protected config: EmailServiceConfig;
  
  constructor(config: EmailServiceConfig) {
    this.config = config;
  }

  // Core email sending methods
  abstract sendEmail(message: EmailMessage): Promise<EmailSendResult>;
  abstract sendBulkEmails(bulkMessage: BulkEmailMessage): Promise<BulkEmailResult>;
  
  // Template management
  abstract sendTemplateEmail(templateId: string, recipient: string, templateData: Record<string, any>): Promise<EmailSendResult>;
  
  // Inbound email processing
  abstract parseInboundEmail(rawEmailData: any): Promise<ParsedEmail>;
  abstract setupWebhook(webhookUrl: string, events: string[]): Promise<{ success: boolean; webhookId?: string; error?: string }>;
  abstract processWebhookEvent(rawWebhookData: any): Promise<EmailWebhookEvent>;
  
  // Health and monitoring
  abstract getProviderStatus(): Promise<EmailProviderStatus>;
  abstract getMetrics(startDate: Date, endDate: Date): Promise<EmailMetrics>;
  
  // Provider-specific features
  abstract validateEmailAddress(email: string): Promise<{ isValid: boolean; suggestion?: string; risk?: string }>;
  abstract getDeliveryStatus(messageId: string): Promise<{ status: DeliveryStatus; events: EmailWebhookEvent[] }>;
  
  // Configuration and utility methods
  getProvider(): EmailProvider {
    return this.config.provider;
  }
  
  getConfig(): EmailServiceConfig {
    return { ...this.config };
  }
  
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.config.provider.toUpperCase()}] ${message}`;
    
    if (this.config.debug) {
      console[level](logMessage, data ? JSON.stringify(data, null, 2) : '');
    } else if (level === 'error') {
      console.error(logMessage, data ? JSON.stringify(data, null, 2) : '');
    }
  }
  
  protected validateMessage(message: EmailMessage): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate recipients
    if (!message.to || message.to.length === 0) {
      errors.push('At least one recipient is required');
    }
    
    message.to?.forEach((recipient, index) => {
      if (!this.isValidEmail(recipient.email)) {
        errors.push(`Invalid email address at recipient ${index}: ${recipient.email}`);
      }
    });
    
    // Validate sender
    if (!message.from || !this.isValidEmail(message.from.email)) {
      errors.push('Valid sender email is required');
    }
    
    // Validate content
    if (!message.subject || message.subject.trim().length === 0) {
      errors.push('Subject is required');
    }
    
    if (!message.htmlContent && !message.textContent && !message.templateId) {
      errors.push('Either HTML content, text content, or template ID is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  protected isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  protected generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}@${this.config.provider}`;
  }
  
  protected normalizeEmailAddress(address: string | { email: string; name?: string }): { email: string; name?: string } {
    if (typeof address === 'string') {
      return { email: address };
    }
    return address;
  }
  
  protected createSuccessResult(messageId: string, providerMessageId?: string, providerResponse?: any): EmailSendResult {
    return {
      success: true,
      messageId,
      providerMessageId,
      status: DeliveryStatus.SENT,
      message: 'Email sent successfully',
      timestamp: new Date(),
      provider: this.config.provider,
      providerResponse
    };
  }
  
  protected createErrorResult(error: string, messageId?: string): EmailSendResult {
    return {
      success: false,
      messageId,
      status: DeliveryStatus.FAILED,
      error,
      timestamp: new Date(),
      provider: this.config.provider
    };
  }
  
  // Rate limiting helper (to be implemented by concrete classes)
  protected async checkRateLimit(identifier: string): Promise<boolean> {
    if (!this.config.rateLimit) {
      return true;
    }
    
    // Basic rate limiting logic - override in concrete implementations
    return true;
  }
  
  // Retry logic helper
  protected async retryOperation<T>(operation: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
    const retryConfig = this.config.retryConfig || {
      maxAttempts: 3,
      backoffMultiplier: 2,
      maxBackoffSeconds: 30
    };
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= Math.min(maxAttempts, retryConfig.maxAttempts); attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retryConfig.maxAttempts) {
          break;
        }
        
        // Calculate backoff delay
        const baseDelay = Math.min(
          1000 * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxBackoffSeconds * 1000
        );
        
        const jitter = Math.random() * 0.1 * baseDelay;
        const delay = baseDelay + jitter;
        
        this.log('warn', `Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`, {
          error: lastError?.message,
          attempt,
          maxAttempts: retryConfig.maxAttempts
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Operation failed after maximum retry attempts');
  }
}

// Utility types for service implementations
export interface EmailServiceRegistry {
  [EmailProvider.SENDGRID]: new (config: EmailServiceConfig) => EmailService;
  [EmailProvider.SES]: new (config: EmailServiceConfig) => EmailService;
  [EmailProvider.POSTMARK]: new (config: EmailServiceConfig) => EmailService;
  [EmailProvider.MAILGUN]: new (config: EmailServiceConfig) => EmailService;
}

export interface FallbackConfig {
  primaryProvider: EmailProvider;
  fallbackProvider: EmailProvider;
  fallbackConditions: {
    onProviderDown: boolean;
    onRateLimitExceeded: boolean;
    onSpecificErrors: string[];
    maxFailureRate: number; // 0.1 = 10%
  };
}