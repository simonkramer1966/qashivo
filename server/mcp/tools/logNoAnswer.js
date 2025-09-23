#!/usr/bin/env node

/**
 * MCP Tool: Log No Answer
 * Updates voice call record when call goes to voicemail or no answer
 */

import fetch from 'node-fetch';

export const registerNoAnswerTool = (server) => {
  server.tool(
    "log_no_answer",
    "Log that the call received no answer or went to voicemail",
    {
      retell_call_id: { 
        type: "string", 
        description: "The Retell call ID for the voice call" 
      },
      call_result: { 
        type: "string", 
        description: "What happened (e.g., 'voicemail', 'no_answer', 'busy_signal', 'disconnected')" 
      },
      voicemail_left: { 
        type: "boolean", 
        description: "Whether a voicemail was left (default: false)" 
      },
      voicemail_message: { 
        type: "string", 
        description: "Content of voicemail message if one was left" 
      },
      retry_scheduled: { 
        type: "boolean", 
        description: "Whether a retry call is scheduled (default: true)" 
      },
      notes: { 
        type: "string", 
        description: "Additional notes about the call attempt" 
      }
    },
    async (data) => {
      try {
        const { retell_call_id, call_result, voicemail_left = false, voicemail_message, retry_scheduled = true, notes } = data;
        
        if (!retell_call_id) {
          return {
            success: false,
            error: "retell_call_id is required"
          };
        }

        if (!call_result) {
          return {
            success: false,
            error: "call_result is required"
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

        // Update the voice call with no answer outcome
        const updateResponse = await fetch(`${apiBaseUrl}/api/voice-calls/${voiceCallId}/outcome`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
          },
          body: JSON.stringify({
            customerResponse: 'no_response',
            callSuccessful: false,
            followUpRequired: retry_scheduled,
            userSentiment: 'neutral',
            disconnectionReason: call_result,
            callAnalysis: {
              outcome: 'no_answer',
              call_result: call_result,
              voicemail_left: voicemail_left,
              voicemail_message: voicemail_message,
              retry_scheduled: retry_scheduled,
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
          outcome: 'no_answer',
          call_result: call_result,
          voicemail_left: voicemail_left,
          retry_scheduled: retry_scheduled,
          message: `No answer logged successfully: ${call_result}${voicemail_left ? ' (voicemail left)' : ''}${retry_scheduled ? ' (retry scheduled)' : ''}`
        };

      } catch (error) {
        console.error('Error logging no answer:', error);
        return {
          success: false,
          error: `Failed to log no answer: ${error.message}`
        };
      }
    }
  );
};