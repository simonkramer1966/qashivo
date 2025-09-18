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
   */
  async createCall(params: CreateCallParams): Promise<CallResult> {
    // Debug: Log the environment variables being used
    console.log("🔧 Debug - Environment variables:", {
      RETELL_AGENT_ID: process.env.RETELL_AGENT_ID,
      RETELL_PHONE_NUMBER: process.env.RETELL_PHONE_NUMBER,
      passed_agentId: params.agentId,
      passed_fromNumber: params.fromNumber
    });
    
    try {
      const retellClient = getRetellClient();
      const response = await retellClient.call.createPhoneCall({
        from_number: params.fromNumber,
        to_number: params.toNumber,
        agent_id: params.agentId || process.env.RETELL_AGENT_ID,
        dynamic_variables: params.dynamicVariables,
        metadata: params.metadata,
      });

      return {
        callId: response.call_id,
        agentId: response.agent_id,
        status: response.call_status,
        fromNumber: response.from_number,
        toNumber: response.to_number,
        direction: response.direction,
      };
    } catch (error: any) {
      console.error('Retell AI call creation failed:', error);
      if (error.status === 404) {
        throw new Error(`Failed to create call: Retell resource not found. Check that agent_id (${params.agentId || process.env.RETELL_AGENT_ID}) and from_number (${params.fromNumber}) exist in your Retell account.`);
      }
      throw new Error(`Failed to create call: ${error.message}`);
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
  }): Promise<any> {
    try {
      // Create agent with proper Retell configuration
      const agentConfig = {
        agent_name: "Nexus AR Collections Agent",
        voice_id: config.voiceId || "11labs-Adrian",
        response_engine: {
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
        general_prompt: config.instructions || `You are a professional debt collection agent working for Nexus AR. When you call someone:

1. Greet them professionally: "Hello {{customer_name}}, this is calling from {{company_name}} regarding your account."

2. If this is a demo call (indicated by custom_message), say: "{{custom_message}}"

3. For real collections, reference specific details:
   - Invoice number: {{invoice_number}} 
   - Amount: ${{invoice_amount}} or ${{total_outstanding}} if multiple invoices
   - Days overdue: {{days_overdue}} days  
   - Due date: {{due_date}}

4. Be polite but professional. Offer payment options and ask when they can make payment.

5. Always maintain compliance with debt collection regulations.

6. End with next steps and contact information.

Keep the call brief and professional.`,
        general_tools: [],
        states: [],
        starting_state: "default"
      };

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
      userSentiment: webhookData.call_analysis?.user_sentiment,
      callSuccessful: webhookData.call_analysis?.call_successful,
      disconnectionReason: webhookData.disconnection_reason,
      startedAt: webhookData.start_timestamp ? new Date(webhookData.start_timestamp) : undefined,
      endedAt: webhookData.end_timestamp ? new Date(webhookData.end_timestamp) : undefined,
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