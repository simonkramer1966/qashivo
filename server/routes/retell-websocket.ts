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
    
    console.log('[Retell WebSocket] New Retell Custom LLM connection, readyState:', ws.readyState);
    
    let responseIdCounter = 0;
    
    // Send begin message IMMEDIATELY - simplest approach
    if (ws.readyState === 1) {
      const beginMessage = {
        response_type: "response",
        response_id: responseIdCounter++,
        content: "Hello! This is Charlie from Qashivo. How can I help you today?",
        content_complete: true,
        end_call: false
      };
      ws.send(JSON.stringify(beginMessage));
      console.log('[Retell WebSocket] Sent begin message immediately');
    }
    
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('[Retell WebSocket] Received:', JSON.stringify(message).substring(0, 300));
        
        if (message.call_id) {
          callId = message.call_id;
        }
        
        // Handle call_details - just log it
        if (message.interaction_type === 'call_details') {
          console.log('[Retell WebSocket] Received call_details');
          return;
        }
        
        if (message.interaction_type === 'ping_pong') {
          // Respond to ping with pong
          const pongResponse = {
            response_type: "ping_pong",
            timestamp: message.timestamp
          };
          ws.send(JSON.stringify(pongResponse));
          return;
        }
        
        if (message.interaction_type === 'update_only') {
          // Just a transcript update, no response needed
          console.log('[Retell WebSocket] Update only, no response needed');
          return;
        }
        
        // Handle response_required and reminder_required
        if (message.interaction_type === 'response_required' || message.interaction_type === 'reminder_required') {
          const request: RetellRequest = {
            interaction_type: message.interaction_type,
            transcript: message.transcript || [],
            call_id: message.call_id || callId || 'unknown',
            metadata: message.metadata || message.retell_llm_dynamic_variables || {},
          };
          
          const response = await handleRetellRequest(request);
          
          const retellResponse = {
            response_type: "response",
            response_id: responseIdCounter++,
            content: response.content,
            content_complete: response.content_complete,
            end_call: response.end_call,
          };
          
          console.log('[Retell WebSocket] Sending:', JSON.stringify(retellResponse).substring(0, 200));
          ws.send(JSON.stringify(retellResponse));
        }
        
      } catch (error) {
        console.error('[Retell WebSocket] Error processing message:', error);
        
        const errorResponse = {
          response_type: "response",
          response_id: responseIdCounter++,
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
