#!/usr/bin/env node

/**
 * MCP Tool: Log Promise to Pay
 * Updates voice call record when customer promises to pay
 */

import fetch from 'node-fetch';

export const registerPromiseToPayTool = (server) => {
  server.tool(
    "log_promise_to_pay",
    "Log that customer promised to pay during the call",
    {
      retell_call_id: { 
        type: "string", 
        description: "The Retell call ID for the voice call" 
      },
      promised_amount: { 
        type: "string", 
        description: "The amount customer promised to pay (optional)" 
      },
      promised_date: { 
        type: "string", 
        description: "When customer promised to pay (YYYY-MM-DD format, optional)" 
      },
      notes: { 
        type: "string", 
        description: "Additional notes about the promise (optional)" 
      },
      follow_up_required: { 
        type: "boolean", 
        description: "Whether follow-up is needed (default: true)" 
      }
    },
    async (data) => {
      try {
        const { retell_call_id, promised_amount, promised_date, notes, follow_up_required = true } = data;
        
        if (!retell_call_id) {
          return {
            success: false,
            error: "retell_call_id is required"
          };
        }

        // First, get the voice call record to find the internal ID
        const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
        const getCallResponse = await fetch(`${apiBaseUrl}/api/voice-calls/${retell_call_id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // Note: In production, you'd need proper authentication headers
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

        // Update the voice call with promise to pay outcome
        const updateResponse = await fetch(`${apiBaseUrl}/api/voice-calls/${voiceCallId}/outcome`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
          },
          body: JSON.stringify({
            customerResponse: 'payment_promised',
            callSuccessful: true,
            followUpRequired: follow_up_required,
            userSentiment: 'positive',
            callAnalysis: {
              outcome: 'promise_to_pay',
              promised_amount: promised_amount,
              promised_date: promised_date,
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
          outcome: 'payment_promised',
          promised_amount: promised_amount,
          promised_date: promised_date,
          follow_up_required: follow_up_required,
          message: `Promise to pay logged successfully${promised_amount ? ` for $${promised_amount}` : ''}${promised_date ? ` by ${promised_date}` : ''}`
        };

      } catch (error) {
        console.error('Error logging promise to pay:', error);
        return {
          success: false,
          error: `Failed to log promise to pay: ${error.message}`
        };
      }
    }
  );
};