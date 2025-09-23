#!/usr/bin/env node

/**
 * MCP Tool: Log Payment Confirmed
 * Updates voice call record when customer confirms payment was made
 */

import fetch from 'node-fetch';

export const registerPaymentConfirmedTool = (server) => {
  server.tool(
    "log_payment_confirmed",
    "Log that customer confirmed payment has been made or sent",
    {
      retell_call_id: { 
        type: "string", 
        description: "The Retell call ID for the voice call" 
      },
      payment_amount: { 
        type: "string", 
        description: "Amount of payment confirmed (optional)" 
      },
      payment_method: { 
        type: "string", 
        description: "Method of payment (e.g., 'bank transfer', 'check', 'credit card', 'online payment')" 
      },
      payment_date: { 
        type: "string", 
        description: "Date payment was made (YYYY-MM-DD format)" 
      },
      reference_number: { 
        type: "string", 
        description: "Payment reference or transaction number (optional)" 
      },
      notes: { 
        type: "string", 
        description: "Additional notes about the payment confirmation" 
      }
    },
    async (data) => {
      try {
        const { retell_call_id, payment_amount, payment_method, payment_date, reference_number, notes } = data;
        
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

        // Update the voice call with payment confirmation outcome
        const updateResponse = await fetch(`${apiBaseUrl}/api/voice-calls/${voiceCallId}/outcome`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_TOKEN || 'demo-token'}`
          },
          body: JSON.stringify({
            customerResponse: 'payment_confirmed',
            callSuccessful: true,
            followUpRequired: false, // Payment confirmed, usually no follow-up needed
            userSentiment: 'positive',
            disconnectionReason: 'payment_resolved',
            callAnalysis: {
              outcome: 'payment_confirmed',
              payment_amount: payment_amount,
              payment_method: payment_method,
              payment_date: payment_date,
              reference_number: reference_number,
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
          outcome: 'payment_confirmed',
          payment_amount: payment_amount,
          payment_method: payment_method,
          payment_date: payment_date,
          reference_number: reference_number,
          message: `Payment confirmation logged successfully${payment_amount ? ` for $${payment_amount}` : ''}${payment_method ? ` via ${payment_method}` : ''}${reference_number ? ` (Ref: ${reference_number})` : ''}`
        };

      } catch (error) {
        console.error('Error logging payment confirmation:', error);
        return {
          success: false,
          error: `Failed to log payment confirmation: ${error.message}`
        };
      }
    }
  );
};