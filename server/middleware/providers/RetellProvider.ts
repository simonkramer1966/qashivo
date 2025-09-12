import { 
  UniversalProvider, 
  ProviderConfig, 
  APIResponse, 
  RequestOptions,
  WebhookConfig,
  WebhookResult,
  TokenAccessor,
  StandardVoiceCall
} from '../types';
import { RetellService, CreateCallParams } from '../../retell-service';

/**
 * Retell Provider Implementation
 * Wraps the existing Retell service to conform to UniversalProvider interface
 */
export class RetellProvider implements UniversalProvider {
  readonly name = 'retell';
  readonly type = 'voice' as const;
  readonly config: ProviderConfig;
  private tokenAccessor?: TokenAccessor;
  private retellService: RetellService;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.retellService = new RetellService();
  }

  /**
   * Set token accessor (called by APIMiddleware during registration)
   */
  setTokenAccessor(accessor: TokenAccessor): void {
    this.tokenAccessor = accessor;
  }

  /**
   * Make request to Retell API
   */
  async makeRequest<T = any>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    try {
      let result;

      switch (endpoint.toLowerCase()) {
        case 'create-call':
          if (!options?.body?.fromNumber || !options?.body?.toNumber) {
            return { 
              success: false, 
              error: 'Missing required fields: fromNumber, toNumber' 
            };
          }

          const callParams: CreateCallParams = {
            fromNumber: options.body.fromNumber,
            toNumber: options.body.toNumber,
            agentId: options.body.agentId,
            dynamicVariables: options.body.dynamicVariables,
            metadata: options.body.metadata
          };

          result = await this.retellService.createCall(callParams);
          break;

        case 'get-call':
          if (!options?.params?.callId) {
            return { 
              success: false, 
              error: 'Missing required parameter: callId' 
            };
          }

          result = await this.retellService.getCall(options.params.callId);
          break;

        case 'list-phone-numbers':
          result = await this.retellService.listPhoneNumbers();
          break;

        case 'create-agent':
          result = await this.retellService.createAgent(options?.body || {});
          break;

        case 'update-agent':
          if (!options?.params?.agentId) {
            return { 
              success: false, 
              error: 'Missing required parameter: agentId' 
            };
          }

          result = await this.retellService.updateAgent(options.params.agentId, options?.body || {});
          break;

        case 'list-agents':
          result = await this.retellService.listAgents();
          break;

        case 'purchase-phone-number':
          if (!options?.body?.areaCode) {
            return { 
              success: false, 
              error: 'Missing required field: areaCode' 
            };
          }

          result = await this.retellService.purchasePhoneNumber(
            options.body.areaCode,
            options.body.numberType
          );
          break;

        default:
          return { 
            success: false, 
            error: `Endpoint '${endpoint}' not implemented for Retell provider` 
          };
      }

      return {
        success: true,
        data: result as T,
        statusCode: 200
      };

    } catch (error) {
      console.error(`Retell API request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  /**
   * Standardize raw Retell data
   */
  async standardizeData(rawData: any, dataType: string): Promise<any> {
    if (dataType === 'voice_call') {
      return this.standardizeVoiceCallData(rawData);
    }
    return rawData;
  }

  /**
   * Standardize voice call data to StandardVoiceCall format
   */
  private standardizeVoiceCallData(rawData: any): StandardVoiceCall {
    // Map Retell status to standard status
    const statusMap: Record<string, StandardVoiceCall['status']> = {
      'queued': 'queued',
      'ringing': 'ringing',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'failed': 'failed',
      'busy': 'busy',
      'no-answer': 'no-answer',
      'canceled': 'failed'
    };

    return {
      id: rawData.callId || `retell_${Date.now()}`,
      to: rawData.toNumber || rawData.to_number,
      from: rawData.fromNumber || rawData.from_number,
      status: statusMap[rawData.status || rawData.call_status] || 'queued',
      duration: rawData.duration || rawData.call_duration,
      startTime: rawData.startTime ? new Date(rawData.startTime) : 
                 (rawData.start_timestamp ? new Date(rawData.start_timestamp) : undefined),
      endTime: rawData.endTime ? new Date(rawData.endTime) : 
               (rawData.end_timestamp ? new Date(rawData.end_timestamp) : undefined),
      recordingUrl: rawData.recordingUrl || rawData.recording_url,
      transcription: rawData.transcription || rawData.transcript,
      provider: this.name,
      providerCallId: rawData.callId || rawData.call_id,
      metadata: {
        agentId: rawData.agentId || rawData.agent_id,
        retellAgentId: rawData.retellAgentId || rawData.agent_id,
        direction: rawData.direction,
        disconnectionReason: rawData.disconnection_reason,
        latencyP50: rawData.latency_p50,
        latencyP90: rawData.latency_p90,
        latencyP95: rawData.latency_p95,
        interruptions: rawData.interruptions,
        userSentiment: rawData.user_sentiment,
        dynamicVariables: rawData.dynamicVariables || rawData.retell_llm_dynamic_variables
      }
    };
  }

  /**
   * Setup webhook for Retell
   */
  async setupWebhook(config: WebhookConfig): Promise<WebhookResult> {
    // Retell webhooks would be configured here
    // For MVP, return not implemented
    return {
      success: false,
      error: 'Retell webhook setup not implemented yet'
    };
  }

  /**
   * Handle incoming webhook from Retell
   */
  async handleWebhook(payload: any): Promise<any> {
    // Handle Retell webhook payload (call status updates, transcripts, etc.)
    const processedData = this.retellService.processWebhookData(payload);
    return { processed: true, data: processedData };
  }

  /**
   * Health check for Retell
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple check - verify API key is configured
      const apiKey = process.env.RETELL_API_KEY;
      return !!apiKey;
    } catch (error) {
      console.error('Retell health check failed:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    // Clear any cached data or connections
    console.log('Retell provider disconnected');
  }

  /**
   * Create outbound call
   */
  async createCall(
    fromNumber: string, 
    toNumber: string, 
    options?: {
      agentId?: string;
      dynamicVariables?: Record<string, any>;
      metadata?: Record<string, any>;
    }
  ): Promise<StandardVoiceCall> {
    const response = await this.makeRequest('create-call', {
      body: {
        fromNumber,
        toNumber,
        agentId: options?.agentId,
        dynamicVariables: options?.dynamicVariables,
        metadata: options?.metadata
      }
    });

    if (response.success) {
      return this.standardizeVoiceCallData(response.data);
    } else {
      // Return failed call record
      return {
        id: `retell_failed_${Date.now()}`,
        to: toNumber,
        from: fromNumber,
        status: 'failed',
        provider: this.name,
        providerCallId: '',
        metadata: { error: response.error }
      };
    }
  }

  /**
   * Get call details
   */
  async getCallDetails(callId: string): Promise<StandardVoiceCall | null> {
    const response = await this.makeRequest('get-call', {
      params: { callId }
    });

    if (response.success) {
      return this.standardizeVoiceCallData(response.data);
    }
    return null;
  }

  /**
   * List available phone numbers
   */
  async getPhoneNumbers(): Promise<any[]> {
    const response = await this.makeRequest('list-phone-numbers');
    return response.success ? response.data : [];
  }

  /**
   * Create AI agent
   */
  async createAgent(config: {
    llmId?: string;
    voiceId?: string;
    instructions?: string;
    responseEngine?: any;
  }): Promise<any> {
    const response = await this.makeRequest('create-agent', { body: config });
    return response.success ? response.data : null;
  }

  /**
   * List all agents
   */
  async getAgents(): Promise<any[]> {
    const response = await this.makeRequest('list-agents');
    return response.success ? response.data : [];
  }
}