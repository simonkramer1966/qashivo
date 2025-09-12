import { 
  UniversalProvider, 
  ProviderConfig, 
  APIResponse, 
  RequestOptions,
  WebhookConfig,
  WebhookResult,
  TokenAccessor,
  StandardSMS
} from '../types';

/**
 * Twilio Provider Implementation
 * Implements UniversalProvider interface for SMS functionality
 */
export class TwilioProvider implements UniversalProvider {
  readonly name = 'twilio';
  readonly type = 'sms' as const;
  readonly config: ProviderConfig;
  private tokenAccessor?: TokenAccessor;
  private twilioClient: any;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.initializeTwilioClient();
  }

  /**
   * Initialize Twilio client
   */
  private initializeTwilioClient(): void {
    try {
      const twilio = require('twilio');
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (accountSid && authToken) {
        this.twilioClient = twilio(accountSid, authToken);
      }
    } catch (error) {
      console.error('Failed to initialize Twilio client:', error);
    }
  }

  /**
   * Set token accessor (called by APIMiddleware during registration)
   */
  setTokenAccessor(accessor: TokenAccessor): void {
    this.tokenAccessor = accessor;
  }

  /**
   * Make request to Twilio API
   */
  async makeRequest<T = any>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    try {
      if (!this.twilioClient) {
        return { 
          success: false, 
          error: 'Twilio client not configured' 
        };
      }

      let result;

      switch (endpoint.toLowerCase()) {
        case 'send-sms':
          if (!options?.body?.to || !options?.body?.body) {
            return { 
              success: false, 
              error: 'Missing required fields: to, body' 
            };
          }

          result = await this.twilioClient.messages.create({
            body: options.body.body,
            from: options.body.from || process.env.TWILIO_PHONE_NUMBER,
            to: options.body.to
          });
          break;

        case 'get-message':
          if (!options?.params?.messageSid) {
            return { 
              success: false, 
              error: 'Missing required parameter: messageSid' 
            };
          }

          result = await this.twilioClient.messages(options.params.messageSid).fetch();
          break;

        case 'list-messages':
          const filters = options?.params || {};
          result = await this.twilioClient.messages.list({
            from: filters.from,
            to: filters.to,
            dateSent: filters.dateSent,
            limit: filters.limit || 50
          });
          break;

        default:
          return { 
            success: false, 
            error: `Endpoint '${endpoint}' not implemented for Twilio provider` 
          };
      }

      return {
        success: true,
        data: result as T,
        statusCode: 200
      };

    } catch (error) {
      console.error(`Twilio API request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  /**
   * Standardize raw Twilio data
   */
  async standardizeData(rawData: any, dataType: string): Promise<any> {
    if (dataType === 'sms') {
      return this.standardizeSMSData(rawData);
    }
    return rawData;
  }

  /**
   * Standardize SMS data to StandardSMS format
   */
  private standardizeSMSData(rawData: any): StandardSMS {
    // Map Twilio status to standard status
    const statusMap: Record<string, StandardSMS['status']> = {
      'queued': 'pending',
      'sending': 'pending',
      'sent': 'sent',
      'delivered': 'delivered',
      'failed': 'failed',
      'undelivered': 'undelivered'
    };

    return {
      id: rawData.sid || `twilio_${Date.now()}`,
      to: rawData.to,
      from: rawData.from,
      body: rawData.body,
      status: statusMap[rawData.status] || 'pending',
      sentAt: rawData.dateSent ? new Date(rawData.dateSent) : undefined,
      deliveredAt: rawData.status === 'delivered' ? new Date() : undefined,
      provider: this.name,
      providerMessageId: rawData.sid,
      metadata: {
        twilioStatus: rawData.status,
        errorCode: rawData.errorCode,
        errorMessage: rawData.errorMessage,
        price: rawData.price,
        priceUnit: rawData.priceUnit,
        direction: rawData.direction,
        numSegments: rawData.numSegments
      }
    };
  }

  /**
   * Setup webhook for Twilio
   */
  async setupWebhook(config: WebhookConfig): Promise<WebhookResult> {
    // Twilio webhooks would be configured here
    // For MVP, return not implemented
    return {
      success: false,
      error: 'Twilio webhook setup not implemented yet'
    };
  }

  /**
   * Handle incoming webhook from Twilio
   */
  async handleWebhook(payload: any): Promise<any> {
    // Handle Twilio webhook payload (delivery status, incoming messages, etc.)
    return { processed: false, message: 'Webhook handling not implemented yet' };
  }

  /**
   * Health check for Twilio
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.twilioClient) return false;

      // Try to fetch account info to verify connection
      await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      return true;
    } catch (error) {
      console.error('Twilio health check failed:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    // Clear any cached data or connections
    this.twilioClient = null;
    console.log('Twilio provider disconnected');
  }

  /**
   * Send SMS message
   */
  async sendSMS(to: string, body: string, from?: string): Promise<StandardSMS> {
    const response = await this.makeRequest('send-sms', {
      body: {
        to,
        body,
        from: from || process.env.TWILIO_PHONE_NUMBER
      }
    });

    if (response.success) {
      return this.standardizeSMSData(response.data);
    } else {
      // Return failed SMS record
      return {
        id: `twilio_failed_${Date.now()}`,
        to,
        from: from || process.env.TWILIO_PHONE_NUMBER || '',
        body,
        status: 'failed',
        provider: this.name,
        providerMessageId: '',
        metadata: { error: response.error }
      };
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageSid: string): Promise<StandardSMS | null> {
    const response = await this.makeRequest('get-message', {
      params: { messageSid }
    });

    if (response.success) {
      return this.standardizeSMSData(response.data);
    }
    return null;
  }

  /**
   * List messages with filters
   */
  async listMessages(filters?: {
    from?: string;
    to?: string;
    dateSent?: Date;
    limit?: number;
  }): Promise<StandardSMS[]> {
    const response = await this.makeRequest('list-messages', {
      params: filters
    });

    if (response.success && Array.isArray(response.data)) {
      return response.data.map(msg => this.standardizeSMSData(msg));
    }
    return [];
  }
}