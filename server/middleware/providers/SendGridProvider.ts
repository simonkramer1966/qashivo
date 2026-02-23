import { 
  UniversalProvider, 
  ProviderConfig, 
  APIResponse, 
  RequestOptions,
  WebhookConfig,
  WebhookResult,
  TokenAccessor,
  StandardEmail
} from '../types';
import { sendEmail, sendBulkEmails, sendEmailWithAttachment, DEFAULT_FROM } from '../../services/sendgrid';

/**
 * SendGrid Provider Implementation
 * Wraps the existing SendGrid service to conform to UniversalProvider interface
 */
export class SendGridProvider implements UniversalProvider {
  readonly name = 'sendgrid';
  readonly type = 'email' as const;
  readonly config: ProviderConfig;
  private tokenAccessor?: TokenAccessor;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Set token accessor (called by APIMiddleware during registration)
   */
  setTokenAccessor(accessor: TokenAccessor): void {
    this.tokenAccessor = accessor;
  }

  /**
   * Make request to SendGrid (mapped to service methods)
   */
  async makeRequest<T = any>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    try {
      let result;

      switch (endpoint.toLowerCase()) {
        case 'send':
          if (!options?.body?.to || !options?.body?.subject) {
            return { 
              success: false, 
              error: 'Missing required fields: to, subject' 
            };
          }

          result = await sendEmail({
            to: options.body.to,
            from: options.body.from || DEFAULT_FROM,
            subject: options.body.subject,
            text: options.body.text,
            html: options.body.html,
            tenantId: options.body.tenantId,
          });
          break;

        case 'send-bulk':
          if (!options?.body?.recipients || !options?.body?.subject) {
            return { 
              success: false, 
              error: 'Missing required fields: recipients, subject' 
            };
          }

          result = await sendBulkEmails({
            from: options.body.from || DEFAULT_FROM,
            subject: options.body.subject,
            text: options.body.text,
            html: options.body.html,
            recipients: options.body.recipients
          });
          break;

        case 'send-with-attachment':
          if (!options?.body?.to || !options?.body?.subject || !options?.body?.attachments) {
            return { 
              success: false, 
              error: 'Missing required fields: to, subject, attachments' 
            };
          }

          result = await sendEmailWithAttachment({
            to: options.body.to,
            from: options.body.from || DEFAULT_FROM,
            subject: options.body.subject,
            text: options.body.text,
            html: options.body.html,
            attachments: options.body.attachments
          });
          break;

        default:
          return { 
            success: false, 
            error: `Endpoint '${endpoint}' not implemented for SendGrid provider` 
          };
      }

      return {
        success: true,
        data: result as T,
        statusCode: 200
      };

    } catch (error) {
      console.error(`SendGrid API request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  /**
   * Standardize raw SendGrid data
   */
  async standardizeData(rawData: any, dataType: string): Promise<any> {
    if (dataType === 'email') {
      return this.standardizeEmailData(rawData);
    }
    return rawData;
  }

  /**
   * Standardize email data to StandardEmail format
   */
  private standardizeEmailData(rawData: any): StandardEmail {
    return {
      id: rawData.messageId || `sendgrid_${Date.now()}`,
      to: rawData.to,
      from: rawData.from,
      subject: rawData.subject,
      body: rawData.text,
      htmlBody: rawData.html,
      status: rawData.success ? 'sent' : 'failed',
      sentAt: rawData.success ? new Date() : undefined,
      templateId: rawData.templateId,
      templateData: rawData.templateData,
      provider: this.name,
      providerMessageId: rawData.messageId || `sg_${Date.now()}`,
      metadata: {
        recipients: rawData.recipients,
        attachmentCount: rawData.attachments?.length || 0
      }
    };
  }

  /**
   * Setup webhook for SendGrid
   */
  async setupWebhook(config: WebhookConfig): Promise<WebhookResult> {
    // SendGrid webhooks would be configured here
    // For MVP, return not implemented
    return {
      success: false,
      error: 'SendGrid webhook setup not implemented yet'
    };
  }

  /**
   * Handle incoming webhook from SendGrid
   */
  async handleWebhook(payload: any): Promise<any> {
    // Handle SendGrid webhook payload (delivery status, bounces, etc.)
    return { processed: false, message: 'Webhook handling not implemented yet' };
  }

  /**
   * Health check for SendGrid
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple check - try to access the API key
      const apiKey = process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY_ENV_VAR;
      return apiKey !== "default_key" && !!apiKey;
    } catch (error) {
      console.error('SendGrid health check failed:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    // Clear any cached data or connections
    console.log('SendGrid provider disconnected');
  }

  /**
   * Send individual email
   */
  async sendEmail(to: string, subject: string, body: string, options?: {
    from?: string;
    html?: string;
    templateId?: string;
    templateData?: Record<string, any>;
  }): Promise<StandardEmail> {
    const response = await this.makeRequest('send', {
      body: {
        to,
        subject,
        text: body,
        from: options?.from,
        html: options?.html,
        templateId: options?.templateId,
        templateData: options?.templateData
      }
    });

    return this.standardizeEmailData({
      to,
      from: options?.from || DEFAULT_FROM,
      subject,
      text: body,
      html: options?.html,
      success: response.success,
      messageId: response.data?.messageId,
      templateId: options?.templateId,
      templateData: options?.templateData
    });
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(
    subject: string, 
    body: string, 
    recipients: Array<{ to: string; substitutions?: Record<string, string> }>,
    options?: { from?: string; html?: string }
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const response = await this.makeRequest('send-bulk', {
      body: {
        subject,
        text: body,
        recipients,
        from: options?.from,
        html: options?.html
      }
    });

    return response.data || { success: 0, failed: recipients.length, errors: [response.error || 'Failed to send bulk emails'] };
  }
}