#!/usr/bin/env node

/**
 * MCP Tool: Log Callback Request
 * Updates voice call record when customer requests a callback
 */

import fetch from 'node-fetch';

export const registerCallbackRequestTool = (server) => {
  server.tool(
    "log_callback_request",
    "Log that customer requested a callback at a later time",
    {
      retell_call_id: { 
        type: "string", 
        description: "The Retell call ID for the voice call" 
      },
      preferred_time: { 
        type: "string", 
        description: "Customer's preferred callback time (e.g., 'tomorrow morning', 'next week', 'after 6pm')" 
      },
      preferred_number: { 
        type: "string", 
        description: "Preferred phone number for callback (optional)" 
      },
      reason: { 
        type: "string", 
        description: "Reason for callback request (e.g., 'busy now', 'need to check finances', 'speak with spouse')" 
      },
      notes: { 
        type: "string", 
        description: "Additional notes about the callback request" 
      }
    },
    async (data) => {
      try {
        const { retell_call_id, preferred_time, preferred_number, reason, notes } = data;
        
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

        // Update the voice call with callback request outcome
        const updateResponse = await fetch(`${apiBaseUrl}/api/voice-calls/${voiceCallId}/outcome`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
          },
          body: JSON.stringify({
            customerResponse: 'callback_requested',
            callSuccessful: true, // Callback request is cooperative
            followUpRequired: true,
            userSentiment: 'neutral',
            disconnectionReason: 'callback_requested',
            callAnalysis: {
              outcome: 'callback_requested',
              preferred_time: preferred_time,
              preferred_number: preferred_number,
              reason: reason,
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
          outcome: 'callback_requested',
          preferred_time: preferred_time,
          preferred_number: preferred_number,
          reason: reason,
          message: `Callback request logged successfully${preferred_time ? ` for ${preferred_time}` : ''}${reason ? ` - ${reason}` : ''}`
        };

      } catch (error) {
        console.error('Error logging callback request:', error);
        return {
          success: false,
          error: `Failed to log callback request: ${error.message}`
        };
      }
    }
  );
};