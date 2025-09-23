#!/usr/bin/env node

/**
 * MCP Tool: Log Refusal
 * Updates voice call record when customer refuses to pay
 */

import fetch from 'node-fetch';

export const registerRefusalTool = (server) => {
  server.tool(
    "log_refusal",
    "Log that customer refuses to pay during the call",
    {
      retell_call_id: { 
        type: "string", 
        description: "The Retell call ID for the voice call" 
      },
      refusal_reason: { 
        type: "string", 
        description: "Reason for refusal (e.g., 'financial hardship', 'cannot afford', 'dispute amount', 'no funds')" 
      },
      notes: { 
        type: "string", 
        description: "Additional notes about the refusal" 
      },
      escalation_required: { 
        type: "boolean", 
        description: "Whether this case needs escalation (default: true)" 
      },
      customer_attitude: { 
        type: "string", 
        description: "Customer's attitude during refusal (hostile, polite, apologetic, etc.)" 
      }
    },
    async (data) => {
      try {
        const { retell_call_id, refusal_reason, notes, escalation_required = true, customer_attitude } = data;
        
        if (!retell_call_id) {
          return {
            success: false,
            error: "retell_call_id is required"
          };
        }

        if (!refusal_reason) {
          return {
            success: false,
            error: "refusal_reason is required"
          };
        }

        // First, get the voice call record to find the internal ID
        const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
        const getCallResponse = await fetch(`${apiBaseUrl}/api/voice-calls/${retell_call_id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
          }
        });

        if (!getCallResponse.ok) {
          return {
            success: false,
            error: `Failed to find voice call: ${getCallResponse.status} ${getCallResponse.statusText}`
          };
        }

        const callData = await getCallResponse.json();
        const voiceCallId = callData.voiceCall.id;

        // Determine user sentiment based on customer attitude
        let userSentiment = 'negative';
        if (customer_attitude) {
          const positiveAttitudes = ['polite', 'apologetic', 'understanding'];
          const neutralAttitudes = ['neutral', 'matter-of-fact'];
          if (positiveAttitudes.some(att => customer_attitude.toLowerCase().includes(att))) {
            userSentiment = 'neutral';
          } else if (neutralAttitudes.some(att => customer_attitude.toLowerCase().includes(att))) {
            userSentiment = 'neutral';
          }
        }

        // Update the voice call with refusal outcome
        const updateResponse = await fetch(`${apiBaseUrl}/api/voice-calls/${voiceCallId}/outcome`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
          },
          body: JSON.stringify({
            customerResponse: 'refusal',
            callSuccessful: false,
            followUpRequired: escalation_required,
            userSentiment: userSentiment,
            disconnectionReason: 'customer_refusal',
            callAnalysis: {
              outcome: 'refusal',
              refusal_reason: refusal_reason,
              customer_attitude: customer_attitude,
              escalation_required: escalation_required,
              notes: notes,
              logged_at: new Date().toISOString()
            }
          })
        });

        if (!updateResponse.ok) {
          return {
            success: false,
            error: `Failed to update call outcome: ${updateResponse.status} ${updateResponse.statusText}`
          };
        }

        const result = await updateResponse.json();

        return {
          success: true,
          call_id: retell_call_id,
          voice_call_id: voiceCallId,
          outcome: 'refusal',
          refusal_reason: refusal_reason,
          customer_attitude: customer_attitude,
          escalation_required: escalation_required,
          message: `Refusal logged successfully: ${refusal_reason}${customer_attitude ? ` (${customer_attitude})` : ''}`
        };

      } catch (error) {
        console.error('Error logging refusal:', error);
        return {
          success: false,
          error: `Failed to log refusal: ${error.message}`
        };
      }
    }
  );
};