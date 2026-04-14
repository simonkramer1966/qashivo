/**
 * Server-Sent Events (SSE) service for real-time UI updates.
 *
 * Tenant-scoped event broadcasting — each client connection is associated
 * with a tenantId so events only reach the correct tenant's UI.
 */

import type { Response } from "express";
import { EventEmitter } from "events";

// Increase listener limit since we'll have one per connected client
const emitter = new EventEmitter();
emitter.setMaxListeners(200);

interface SSEClient {
  id: string;
  tenantId: string;
  res: Response;
  connectedAt: Date;
}

const clients = new Map<string, SSEClient>();
let clientIdCounter = 0;

/** Event types that the client can listen for */
export type RealtimeEventType =
  | "inbound_sms"
  | "inbound_email"
  | "action_completed"
  | "action_approved"
  | "action_sent"
  | "send_failed"
  | "payment_received"
  | "ptp_created"
  | "dispute_detected"
  | "exception_created"
  | "promise_broken"
  | "delivery_bounce"
  | "approval_needed"
  | "sync_started"
  | "sync_progress"
  | "sync_complete"
  | "sync_failed"
  | "cash_gap_alert"
  | "priorities_generated"
  | "note_created";

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Register an SSE client connection.
 * Called from the SSE endpoint after auth.
 */
export function addClient(tenantId: string, res: Response): string {
  const id = `sse_${++clientIdCounter}_${Date.now()}`;

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // Disable Nginx buffering
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: "connected", clientId: id })}\n\n`);

  clients.set(id, { id, tenantId, res, connectedAt: new Date() });

  // Keep-alive every 30 seconds
  const keepAlive = setInterval(() => {
    if (clients.has(id)) {
      try {
        res.write(": keep-alive\n\n");
      } catch {
        clearInterval(keepAlive);
        removeClient(id);
      }
    } else {
      clearInterval(keepAlive);
    }
  }, 30_000);

  // Clean up on disconnect
  res.on("close", () => {
    clearInterval(keepAlive);
    removeClient(id);
  });

  return id;
}

function removeClient(id: string) {
  clients.delete(id);
}

/**
 * Emit an event to all connected clients for a specific tenant.
 * This is the function called from webhooks, pipelines, and services.
 */
export function emitTenantEvent(tenantId: string, type: RealtimeEventType, data: Record<string, unknown> = {}) {
  const event: RealtimeEvent = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  const payload = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of Array.from(clients.values())) {
    if (client.tenantId !== tenantId) continue;
    try {
      client.res.write(payload);
    } catch {
      removeClient(client.id);
    }
  }
}

/** Get count of connected clients (for diagnostics) */
export function getClientCount(): number {
  return clients.size;
}

export function getClientCountForTenant(tenantId: string): number {
  let count = 0;
  for (const client of Array.from(clients.values())) {
    if (client.tenantId === tenantId) count++;
  }
  return count;
}
