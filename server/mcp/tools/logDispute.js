#!/usr/bin/env node

/**
 * MCP Tool: Log Dispute
 * Updates voice call record when customer disputes the debt/invoice
 */

import fetch from 'node-fetch';

export const registerDisputeTool = (server) => {
  server.tool(
    "log_dispute",
    "Log that customer disputes the debt or invoice during the call",
    {
      retell_call_id: { 
        type: "string", 
        description: "The Retell call ID for the voice call" 
      },
      dispute_reason: { 
        type: "string", 
        description: "Reason for the dispute (e.g., 'services not received', 'incorrect amount', 'billing error')" 
      },
      disputed_amount: { 
        type: "string", 
        description: "The amount being disputed (optional)" 
      },
      notes: { 
        type: "string", 
        description: "Additional notes about the dispute" 
      },
      requires_investigation: { 
        type: "boolean", 
        description: "Whether this dispute requires investigation (default: true)" 
      }
    },
    async (data) => {
      try {
        const { retell_call_id, dispute_reason, disputed_amount, notes, requires_investigation = true } = data;
        
        if (!retell_call_id) {
          return {
            success: false,
            error: "retell_call_id is required"
          };
        }

        if (!dispute_reason) {
          return {
            success: false,
            error: "dispute_reason is required"
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

        // Update the voice call with dispute outcome
        const updateResponse = await fetch(`${apiBaseUrl}/api/voice-calls/${voiceCallId}/outcome`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
          },
          body: JSON.stringify({
            customerResponse: 'dispute',
            callSuccessful: false,
            followUpRequired: requires_investigation,
            userSentiment: 'negative',
            disconnectionReason: 'customer_dispute',
            callAnalysis: {
              outcome: 'dispute',
              dispute_reason: dispute_reason,
              disputed_amount: disputed_amount,
              requires_investigation: requires_investigation,
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
          outcome: 'dispute',
          dispute_reason: dispute_reason,
          disputed_amount: disputed_amount,
          requires_investigation: requires_investigation,
          message: `Dispute logged successfully: ${dispute_reason}${disputed_amount ? ` for $${disputed_amount}` : ''}`
        };

      } catch (error) {
        console.error('Error logging dispute:', error);
        return {
          success: false,
          error: `Failed to log dispute: ${error.message}`
        };
      }
    }
  );
};