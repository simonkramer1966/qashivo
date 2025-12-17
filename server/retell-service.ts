import Retell from 'retell-sdk';
import { InsertVoiceCall, VoiceCall } from '@shared/schema';

let retell: Retell | null = null;

function getRetellClient(): Retell {
  if (!retell) {
    if (!process.env.RETELL_API_KEY) {
      throw new Error('RETELL_API_KEY environment variable must be set');
    }
    retell = new Retell({
      apiKey: process.env.RETELL_API_KEY,
    });
  }
  return retell;
}

export interface CreateCallParams {
  fromNumber: string;
  toNumber: string;
  agentId?: string;
  dynamicVariables?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CallResult {
  callId: string;
  agentId: string;
  status: string;
  fromNumber: string;
  toNumber: string;
  direction: string;
}

export class RetellService {
  
  /**
   * Create an outbound phone call using Retell AI
   * Now uses unified helper for consistency across all Retell endpoints
   */
  async createCall(params: CreateCallParams): Promise<CallResult> {
    try {
      // Check if demo mode is enabled - SHORT-CIRCUIT and return mock success
      const { demoModeService } = await import('./services/demoModeService.js');
      if (demoModeService.isEnabled()) {
        console.log('🎭 Demo mode: Skipping real voice call, returning mock success');
        
        const mockCallId = 'demo-mock-call-' + Date.now();
        
        // Schedule mock inbound response if context available
        if (params.metadata?.invoiceId && params.metadata?.contactId) {
          const { mockResponderService } = await import('./services/mockResponderService.js');
          mockResponderService.simulateVoiceResponse({
            callId: mockCallId,
            invoiceId: params.metadata.invoiceId,
            customerId: params.metadata.contactId,
            customerPhone: params.toNumber,
          });
        }
        
        // Return mock success immediately - DO NOT place real call
        return {
          callId: mockCallId,
          agentId: params.agentId || 'demo-agent',
          status: 'registered',
          fromNumber: params.fromNumber,
          toNumber: params.toNumber,
          direction: 'outbound',
        };
      }

      // Import and use the unified Retell call helper
      const { createUnifiedRetellCall } = await import('./utils/retellCallHelper');
      
      // Use unified call creation (handles all normalization, phone formatting, logging)
      const callResult = await createUnifiedRetellCall({
        fromNumber: params.fromNumber,
        toNumber: params.toNumber,
        agentId: params.agentId,
        dynamicVariables: params.dynamicVariables,
        metadata: {
          ...params.metadata,
          source: 'retell_service'
        },
        context: 'RETELL_SERVICE'
      });

      // Return in the expected CallResult format
      return {
        callId: callResult.callId,
        agentId: callResult.agentId,
        status: callResult.status,
        fromNumber: callResult.fromNumber,
        toNumber: callResult.toNumber,
        direction: callResult.direction,
      };
    } catch (error: any) {
      console.error('RetellService call creation failed:', error);
      throw new Error(`Failed to create call via RetellService: ${error.message}`);
    }
  }

  /**
   * Get call details from Retell AI
   */
  async getCall(callId: string): Promise<any> {
    try {
      const retellClient = getRetellClient();
      return await retellClient.call.retrieve(callId);
    } catch (error: any) {
      console.error('Failed to retrieve call:', error);
      throw new Error(`Failed to retrieve call: ${error.message}`);
    }
  }

  /**
   * List available phone numbers from Retell AI
   */
  async listPhoneNumbers(): Promise<any[]> {
    try {
      const retellClient = getRetellClient();
      const response = await retellClient.phoneNumber.list();
      return Array.isArray(response) ? response : (response as any)?.data || [];
    } catch (error: any) {
      console.error('Failed to list phone numbers:', error);
      throw new Error(`Failed to list phone numbers: ${error.message}`);
    }
  }

  /**
   * Create a new agent for collections
   */
  async createAgent(config: {
    llmId?: string;
    voiceId?: string;
    instructions?: string;
    responseEngine?: any;
    webhookUrl?: string;
    agentName?: string;
  }): Promise<any> {
    try {
      // Create agent with proper Retell configuration
      const agentConfig: any = {
        agent_name: config.agentName || "Nexus AR Collections Agent",
        voice_id: config.voiceId || "11labs-Adrian",
        response_engine: config.responseEngine || {
          type: "retell-llm" as const,
          llm_id: "gpt-4"
        },
        language: "en-US" as const,
        voice_temperature: 1,
        voice_speed: 1,
        responsiveness: 1,
        interruption_sensitivity: 1,
        enable_backchannel: true,
        backchannel_frequency: 0.9,
        backchannel_words: ["yeah", "uh-huh"],
        reminder_trigger_ms: 10000,
        reminder_max_count: 1,
        ambient_sound: "call-center" as const,
        ambient_sound_volume: 0.1,
        language_model_latency_optimizations: ["accuracy"],
        pronunciation_dictionary: [],
        normalize_for_speech: true,
        end_call_after_silence_ms: 600000,
        enable_transcription_formatting: false,
        post_call_analysis_schema: {},
        llm_dynamic_variables: [
          {
            name: "customer_name",
            value: "John Smith"
          },
          {
            name: "company_name", 
            value: "ABC Corp"
          },
          {
            name: "invoice_number",
            value: "INV-001"
          },
          {
            name: "invoice_amount",
            value: "1500.00"
          },
          {
            name: "total_outstanding",
            value: "1500.00"
          },
          {
            name: "days_overdue",
            value: "15"
          },
          {
            name: "due_date",
            value: "30 days ago"
          },
          {
            name: "custom_message",
            value: "This is a demonstration call"
          }
        ],
        general_prompt: config.instructions || "You are a professional debt collection agent working for Nexus AR. When you call someone:\n\n" +
          "1. Greet them professionally: \"Hello {{customer_name}}, this is calling from {{company_name}} regarding your account.\"\n\n" +
          "2. If this is a demo call (indicated by custom_message), say: \"{{custom_message}}\"\n\n" +
          "3. For real collections, reference specific details:\n" +
          "   - Invoice number: {{invoice_number}}\n" +
          "   - Amount: ${{invoice_amount}} or ${{total_outstanding}} if multiple invoices\n" +
          "   - Days overdue: {{days_overdue}} days\n" +
          "   - Due date: {{due_date}}\n\n" +
          "4. Be polite but professional. Offer payment options and ask when they can make payment.\n\n" +
          "5. Always maintain compliance with debt collection regulations.\n\n" +
          "6. End with next steps and contact information.\n\n" +
          "Keep the call brief and professional.",
        general_tools: [],
        states: [],
        starting_state: "default"
      };

      // Add webhook URL if provided
      if (config.webhookUrl) {
        agentConfig.webhook_url = config.webhookUrl;
      }

      const retellClient = getRetellClient();
      return await retellClient.agent.create(agentConfig);
    } catch (error: any) {
      console.error('Failed to create agent:', error);
      throw new Error(`Failed to create agent: ${error.message}`);
    }
  }

  /**
   * Update an existing agent
   */
  async updateAgent(agentId: string, config: any): Promise<any> {
    try {
      const retellClient = getRetellClient();
      return await retellClient.agent.update(agentId, config);
    } catch (error: any) {
      console.error('Failed to update agent:', error);
      throw new Error(`Failed to update agent: ${error.message}`);
    }
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<any[]> {
    try {
      const retellClient = getRetellClient();
      const response = await retellClient.agent.list();
      return Array.isArray(response) ? response : (response as any)?.data || [];
    } catch (error: any) {
      console.error('Failed to list agents:', error);
      throw new Error(`Failed to list agents: ${error.message}`);
    }
  }

  /**
   * Purchase a phone number
   */
  async purchasePhoneNumber(areaCode: string, numberType: string = 'local'): Promise<any> {
    try {
      // Note: This is a placeholder implementation
      // The actual Retell API might have different parameters and endpoints
      const retellClient = getRetellClient();
      const response = await retellClient.phoneNumber.create({
        area_code: areaCode,
        number_type: numberType,
      } as any);
      return response;
    } catch (error: any) {
      console.error('Failed to purchase phone number:', error);
      throw new Error(`Failed to purchase phone number: ${error.message}`);
    }
  }

  /**
   * Process webhook data from Retell AI
   */
  processWebhookData(webhookData: any): Partial<InsertVoiceCall> {
    const callAnalysis = webhookData.call_analysis || {};
    
    // Extract enhanced intelligence from Post-Call Data Extraction
    // These fields should be configured in Retell dashboard under "Post-Call Data Extraction"
    const customData = callAnalysis.custom_analysis_data || {};
    
    // Parse promised payment date if provided
    let promisedDate: Date | undefined;
    if (customData.promised_payment_date) {
      try {
        promisedDate = new Date(customData.promised_payment_date);
      } catch (e) {
        console.log('Could not parse promised_payment_date:', customData.promised_payment_date);
      }
    }
    
    // Determine call disposition based on available data
    let callDisposition: string | undefined;
    if (customData.wrong_number === true || customData.wrong_number === 'true') {
      callDisposition = 'wrong_number';
    } else if (customData.callback_requested === true || customData.callback_requested === 'true') {
      callDisposition = 'callback_requested';
    } else if (webhookData.call_status === 'voicemail') {
      callDisposition = 'voicemail';
    } else if (webhookData.call_status === 'no-answer' || webhookData.disconnection_reason === 'no_answer') {
      callDisposition = 'no_answer';
    } else if (customData.dispute_raised === true || customData.dispute_raised === 'true') {
      callDisposition = 'connected_dispute';
    } else if (customData.partial_payment_offered) {
      callDisposition = 'connected_partial';
    } else if (customData.payment_promised === true || customData.payment_promised === 'true' || customData.promised_amount) {
      callDisposition = 'connected_ptp';
    } else if (customData.payment_refused === true || customData.payment_refused === 'true') {
      callDisposition = 'connected_refused';
    } else if (webhookData.call_status === 'ended' && webhookData.duration_ms > 10000) {
      callDisposition = 'connected'; // Call connected but no specific outcome extracted
    }
    
    return {
      retellCallId: webhookData.call_id,
      retellAgentId: webhookData.agent_id,
      fromNumber: webhookData.from_number,
      toNumber: webhookData.to_number,
      direction: webhookData.direction,
      status: webhookData.call_status,
      duration: webhookData.duration_ms ? Math.floor(webhookData.duration_ms / 1000) : undefined,
      transcript: webhookData.transcript,
      recordingUrl: webhookData.recording_url,
      callAnalysis: webhookData.call_analysis,
      userSentiment: callAnalysis.user_sentiment,
      callSuccessful: callAnalysis.call_successful,
      disconnectionReason: webhookData.disconnection_reason,
      startedAt: webhookData.start_timestamp ? new Date(webhookData.start_timestamp) : undefined,
      endedAt: webhookData.end_timestamp ? new Date(webhookData.end_timestamp) : undefined,
      
      // Enhanced intelligence fields
      callDisposition,
      promisedAmount: customData.promised_amount ? String(customData.promised_amount) : undefined,
      promisedDate,
      disputeReason: customData.dispute_reason,
      callbackRequested: customData.callback_requested === true || customData.callback_requested === 'true',
      callbackTime: customData.callback_time || customData.preferred_callback_time,
      financialHardship: customData.financial_hardship === true || customData.financial_hardship === 'true',
      wrongNumber: customData.wrong_number === true || customData.wrong_number === 'true',
      partialPaymentOffered: customData.partial_payment_offered ? String(customData.partial_payment_offered) : undefined,
      customExtractedData: Object.keys(customData).length > 0 ? customData : undefined,
    };
  }

  /**
   * Generate collection call script based on customer and invoice data
   */
  generateCallScript(customerName: string, invoiceNumber: string, amount: number, daysOverdue: number): string {
    return `Hello ${customerName}, this is regarding your outstanding invoice ${invoiceNumber} for $${amount.toFixed(2)}. This payment is now ${daysOverdue} days overdue. I'd like to discuss payment options that work for your business. Are you available to discuss this now?`;
  }

  /**
   * Determine if a call should be made based on collection rules
   */
  shouldMakeCall(invoice: any, contact: any, previousCalls: VoiceCall[]): boolean {
    // Business rules for when to make a call
    const daysOverdue = Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    const invoiceAmount = parseFloat(invoice.amount);
    
    // Only call for high-value invoices (>$10K) that are 21+ days overdue
    if (invoiceAmount < 10000 || daysOverdue < 21) {
      return false;
    }

    // Don't call if we've already called in the last 7 days
    const recentCalls = previousCalls.filter(call => {
      if (!call.createdAt) return false;
      const callDate = new Date(call.createdAt);
      const daysSinceCall = Math.floor((Date.now() - callDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceCall < 7;
    });

    if (recentCalls.length > 0) {
      return false;
    }

    // Don't call if we've already made 3+ attempts
    if (previousCalls.length >= 3) {
      return false;
    }

    // Check if contact has a phone number
    return contact.phone && contact.phone.length > 0;
  }
}

export const retellService = new RetellService();