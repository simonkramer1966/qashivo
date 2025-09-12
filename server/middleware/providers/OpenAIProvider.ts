import { 
  UniversalProvider, 
  ProviderConfig, 
  APIResponse, 
  RequestOptions,
  WebhookConfig,
  WebhookResult,
  TokenAccessor,
  StandardAIResponse
} from '../types';
import { 
  generateCollectionSuggestions, 
  generateEmailDraft, 
  analyzePaymentPatterns 
} from '../../services/openai';

/**
 * OpenAI Provider Implementation
 * Wraps the existing OpenAI service to conform to UniversalProvider interface
 */
export class OpenAIProvider implements UniversalProvider {
  readonly name = 'openai';
  readonly type = 'ai' as const;
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
   * Make request to OpenAI API
   */
  async makeRequest<T = any>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    try {
      let result;
      const requestTime = new Date();

      switch (endpoint.toLowerCase()) {
        case 'collection-suggestions':
          if (!options?.body?.invoiceData) {
            return { 
              success: false, 
              error: 'Missing required field: invoiceData' 
            };
          }

          result = await generateCollectionSuggestions(options.body.invoiceData);
          break;

        case 'email-draft':
          if (!options?.body?.context) {
            return { 
              success: false, 
              error: 'Missing required field: context' 
            };
          }

          result = await generateEmailDraft(options.body.context);
          break;

        case 'payment-analysis':
          if (!options?.body?.invoiceHistory) {
            return { 
              success: false, 
              error: 'Missing required field: invoiceHistory' 
            };
          }

          result = await analyzePaymentPatterns(options.body.invoiceHistory);
          break;

        case 'chat-completion':
          if (!options?.body?.messages) {
            return { 
              success: false, 
              error: 'Missing required field: messages' 
            };
          }

          // Direct OpenAI API call for custom prompts
          const OpenAI = require('openai');
          const openai = new OpenAI({ 
            apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR 
          });

          const completion = await openai.chat.completions.create({
            model: options.body.model || "gpt-5",
            messages: options.body.messages,
            temperature: options.body.temperature || 0.7,
            max_tokens: options.body.maxTokens || 1000,
            response_format: options.body.responseFormat
          });

          result = {
            response: completion.choices[0].message.content,
            model: completion.model,
            tokensUsed: completion.usage?.total_tokens,
            requestTime,
            responseTime: new Date()
          };
          break;

        default:
          return { 
            success: false, 
            error: `Endpoint '${endpoint}' not implemented for OpenAI provider` 
          };
      }

      return {
        success: true,
        data: result as T,
        statusCode: 200
      };

    } catch (error) {
      console.error(`OpenAI API request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  /**
   * Standardize raw OpenAI data
   */
  async standardizeData(rawData: any, dataType: string): Promise<any> {
    if (dataType === 'ai_response') {
      return this.standardizeAIResponseData(rawData);
    }
    return rawData;
  }

  /**
   * Standardize AI response data to StandardAIResponse format
   */
  private standardizeAIResponseData(rawData: any): StandardAIResponse {
    return {
      id: rawData.id || `openai_${Date.now()}`,
      prompt: rawData.prompt || rawData.messages?.[0]?.content || '',
      response: rawData.response || rawData.content || JSON.stringify(rawData),
      model: rawData.model || 'gpt-5',
      tokensUsed: rawData.tokensUsed || rawData.usage?.total_tokens,
      requestTime: rawData.requestTime || new Date(),
      responseTime: rawData.responseTime || new Date(),
      status: rawData.response ? 'completed' : 'failed',
      provider: this.name,
      providerRequestId: rawData.id || `openai_${Date.now()}`,
      metadata: {
        endpoint: rawData.endpoint,
        temperature: rawData.temperature,
        maxTokens: rawData.maxTokens,
        responseFormat: rawData.responseFormat,
        promptTokens: rawData.usage?.prompt_tokens,
        completionTokens: rawData.usage?.completion_tokens
      }
    };
  }

  /**
   * Setup webhook for OpenAI (not typically used)
   */
  async setupWebhook(config: WebhookConfig): Promise<WebhookResult> {
    return {
      success: false,
      error: 'OpenAI does not support webhooks'
    };
  }

  /**
   * Handle incoming webhook (not applicable for OpenAI)
   */
  async handleWebhook(payload: any): Promise<any> {
    return { processed: false, message: 'OpenAI does not support webhooks' };
  }

  /**
   * Health check for OpenAI
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple check - verify API key is configured
      const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR;
      return apiKey !== "default_key" && !!apiKey;
    } catch (error) {
      console.error('OpenAI health check failed:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    // Clear any cached data or connections
    console.log('OpenAI provider disconnected');
  }

  /**
   * Generate collection suggestions
   */
  async getCollectionSuggestions(invoiceData: {
    amount: number;
    daysPastDue: number;
    contactHistory: Array<{ type: string; date: string; response?: string }>;
    contactProfile: { name: string; paymentHistory: string; relationship: string };
  }): Promise<StandardAIResponse> {
    const response = await this.makeRequest('collection-suggestions', {
      body: { invoiceData }
    });

    return this.standardizeAIResponseData({
      prompt: `Generate collection suggestions for invoice: ${JSON.stringify(invoiceData)}`,
      response: response.success ? JSON.stringify(response.data) : '',
      endpoint: 'collection-suggestions',
      id: `collection_${Date.now()}`
    });
  }

  /**
   * Generate email draft
   */
  async generateEmail(context: {
    contactName: string;
    invoiceNumber: string;
    amount: number;
    daysPastDue: number;
    previousEmails: number;
    tone: 'friendly' | 'professional' | 'urgent';
  }): Promise<StandardAIResponse> {
    const response = await this.makeRequest('email-draft', {
      body: { context }
    });

    return this.standardizeAIResponseData({
      prompt: `Generate email draft for: ${JSON.stringify(context)}`,
      response: response.success ? JSON.stringify(response.data) : '',
      endpoint: 'email-draft',
      id: `email_draft_${Date.now()}`
    });
  }

  /**
   * Analyze payment patterns
   */
  async analyzePayments(invoiceHistory: Array<{
    amount: number;
    issueDate: string;
    paidDate?: string;
    daysToPay?: number;
  }>): Promise<StandardAIResponse> {
    const response = await this.makeRequest('payment-analysis', {
      body: { invoiceHistory }
    });

    return this.standardizeAIResponseData({
      prompt: `Analyze payment patterns for: ${invoiceHistory.length} invoices`,
      response: response.success ? JSON.stringify(response.data) : '',
      endpoint: 'payment-analysis',
      id: `payment_analysis_${Date.now()}`
    });
  }

  /**
   * Generic chat completion
   */
  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      responseFormat?: any;
    }
  ): Promise<StandardAIResponse> {
    const response = await this.makeRequest('chat-completion', {
      body: {
        messages,
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        responseFormat: options?.responseFormat
      }
    });

    return this.standardizeAIResponseData({
      prompt: messages.map(m => m.content).join('\n'),
      response: response.success ? response.data.response : '',
      model: response.data?.model,
      tokensUsed: response.data?.tokensUsed,
      requestTime: response.data?.requestTime,
      responseTime: response.data?.responseTime,
      endpoint: 'chat-completion',
      id: `chat_${Date.now()}`
    });
  }
}