/**
 * Retell Custom LLM WebSocket Route
 * 
 * Handles WebSocket connections from Retell for Custom LLM conversations.
 * Charlie controls all conversation logic through this endpoint.
 */

import { WebSocket, WebSocketServer } from 'ws';
import { handleRetellRequest, RetellRequest, RetellResponse } from '../services/charlieVoiceHandler.js';

export function setupRetellWebSocket(wss: WebSocketServer): void {
  console.log('[Retell WebSocket] Setting up Custom LLM WebSocket handler');
  
  wss.on('connection', (ws: WebSocket, request: any) => {
    const path = request?.url || '';
    console.log('[Retell WebSocket] Connection event received, path:', path);
    
    // Extract call_id from path: /retell-llm/{call_id}
    const pathParts = path.split('/');
    let callId: string | null = pathParts[pathParts.length - 1] || null;
    if (callId && callId.startsWith('call_')) {
      console.log('[Retell WebSocket] Extracted call_id from path:', callId);
    }
    
    console.log('[Retell WebSocket] New Retell Custom LLM connection');
    
    // Send config event (optional but recommended)
    const configEvent = {
      response_type: "config",
      config: {
        auto_reconnect: true,
        call_details: true
      }
    };
    ws.send(JSON.stringify(configEvent));
    console.log('[Retell WebSocket] Sent config event');
    
    // Send initial begin message - Retell requires this!
    const beginMessage = {
      response_type: "response",
      response_id: 0,
      content: "Hello! This is Charlie from Qashivo. How can I help you today?",
      content_complete: true,
      end_call: false
    };
    ws.send(JSON.stringify(beginMessage));
    console.log('[Retell WebSocket] Sent begin message');
    
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('[Retell WebSocket] Received:', JSON.stringify(message).substring(0, 200));
        
        if (message.call_id) {
          callId = message.call_id;
        }
        
        const request: RetellRequest = {
          interaction_type: message.interaction_type || 'response_required',
          transcript: message.transcript || [],
          call_id: message.call_id || callId || 'unknown',
          metadata: message.metadata || message.retell_llm_dynamic_variables || {},
        };
        
        const response = await handleRetellRequest(request);
        
        const retellResponse = {
          response_id: response.response_id,
          content: response.content,
          content_complete: response.content_complete,
          end_call: response.end_call,
        };
        
        console.log('[Retell WebSocket] Sending:', JSON.stringify(retellResponse).substring(0, 200));
        ws.send(JSON.stringify(retellResponse));
        
      } catch (error) {
        console.error('[Retell WebSocket] Error processing message:', error);
        
        const errorResponse = {
          response_id: 0,
          content: "I apologize, I'm having a technical issue. Let me connect you with someone who can help.",
          content_complete: true,
          end_call: true,
        };
        
        ws.send(JSON.stringify(errorResponse));
      }
    });
    
    ws.on('close', () => {
      console.log(`[Retell WebSocket] Connection closed for call: ${callId || 'unknown'}`);
    });
    
    ws.on('error', (error) => {
      console.error(`[Retell WebSocket] Error for call ${callId || 'unknown'}:`, error);
    });
  });
}

export function createRetellWebSocketPath(): string {
  return '/retell-llm';
}
