import Retell from 'retell-sdk';
import { InsertVoiceCall, VoiceCall } from '@shared/schema';

if (!process.env.RETELL_API_KEY) {
  throw new Error('RETELL_API_KEY environment variable must be set');
}

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});

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
    try {
      const response = await retell.call.createPhoneCall({
        from_number: params.fromNumber,
        to_number: params.toNumber,
        override_agent_id: params.agentId,
        retell_llm_dynamic_variables: params.dynamicVariables,
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
      throw new Error(`Failed to create call: ${error.message}`);
    }
  }

  /**
   * Get call details from Retell AI
   */
  async getCall(callId: string): Promise<any> {
    try {
      return await retell.call.retrieve(callId);
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
      const response = await retell.phoneNumber.list();
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
      // Use web socket URL for retell-llm
      const responseEngine = config.responseEngine || {
        type: "retell-llm",
        llm_id: config.llmId || "retell-llm-web-socket",
        llm_websocket_url: "wss://api.retellai.com/audio-websocket/llm-general-use"
      };

      return await retell.agent.create({
        response_engine: responseEngine,
        voice_id: config.voiceId || "11labs-Adrian",
        agent_name: "Collections Agent",
        instructions: config.instructions || "You are a professional debt collection agent. Be polite but firm when discussing overdue payments. Always maintain a professional tone and comply with all debt collection regulations.",
        ...config
      });
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
      return await retell.agent.update(agentId, config);
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
      const response = await retell.agent.list();
      return Array.isArray(response) ? response : (response as any)?.data || [];
    } catch (error: any) {
      console.error('Failed to list agents:', error);
      throw new Error(`Failed to list agents: ${error.message}`);
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