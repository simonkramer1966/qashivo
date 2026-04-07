import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

type RealtimeEventType =
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
  | "delivery_bounce"
  | "approval_needed"
  | "sync_complete";

interface RealtimeEvent {
  type: RealtimeEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Query key invalidation map — which TanStack Query keys to invalidate per event type.
 * Uses prefix matching: ["/api/action-centre"] matches all action-centre queries.
 */
const INVALIDATION_MAP: Record<RealtimeEventType, string[][]> = {
  inbound_sms: [
    ["/api/action-centre"],
    ["/api/contacts"],
  ],
  inbound_email: [
    ["/api/action-centre"],
    ["/api/contacts"],
  ],
  action_completed: [
    ["/api/action-centre"],
    ["/api/approval-queue"],
  ],
  action_approved: [
    ["/api/action-centre"],
    ["/api/approval-queue"],
  ],
  action_sent: [
    ["/api/action-centre"],
  ],
  send_failed: [
    ["/api/action-centre"],
  ],
  payment_received: [
    ["/api/action-centre"],
    ["/api/qollections"],
    ["/api/contacts"],
  ],
  ptp_created: [
    ["/api/action-centre"],
    ["/api/contacts"],
  ],
  dispute_detected: [
    ["/api/action-centre"],
  ],
  exception_created: [
    ["/api/action-centre"],
  ],
  delivery_bounce: [
    ["/api/action-centre"],
    ["/api/settings/data-health"],
  ],
  approval_needed: [
    ["/api/action-centre"],
    ["/api/approval-queue"],
  ],
  sync_complete: [
    ["/api/action-centre"],
    ["/api/qollections"],
    ["/api/contacts"],
    ["/api/settings/data-health"],
  ],
};

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 10000]; // Escalating retry delays

/**
 * Get Clerk session token for SSE connection.
 * EventSource doesn't support custom headers, so we pass the token as a query param.
 */
async function getClerkToken(): Promise<string | undefined> {
  try {
    const clerk = (window as any).Clerk;
    if (clerk?.session) {
      return await clerk.session.getToken();
    }
  } catch {
    // Clerk not initialised yet
  }
  return undefined;
}

/**
 * Hook that connects to the SSE endpoint and invalidates TanStack Query
 * caches when real-time events arrive from the server.
 *
 * Falls back to polling (which TanStack Query already does via refetchInterval)
 * after MAX_RETRIES failed reconnects.
 */
export function useRealtimeEvents() {
  const queryClient = useQueryClient();
  const retriesRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout>;

    async function connect() {
      if (cancelled) return;

      // EventSource doesn't support Authorization headers — pass token as query param
      const token = await getClerkToken();
      const url = token
        ? `/api/events/stream?token=${encodeURIComponent(token)}`
        : "/api/events/stream";

      const es = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        retriesRef.current = 0; // Reset retries on successful connect
      };

      es.onmessage = (e) => {
        try {
          const event: RealtimeEvent | { type: "connected" } = JSON.parse(e.data);
          if (event.type === "connected") return;

          const keys = INVALIDATION_MAP[event.type as RealtimeEventType];
          if (!keys) return;

          for (const queryKey of keys) {
            queryClient.invalidateQueries({ queryKey });
          }

          // Re-dispatch as a window event so individual components
          // (e.g. ApprovalsTab toasts) can react to specific event types
          // without coupling the hook to a toast system.
          if ("data" in event) {
            window.dispatchEvent(new CustomEvent(`realtime:${event.type}`, { detail: event.data }));
          }

          // Smart debtor detail invalidation — if event has a contactId,
          // also invalidate that specific contact's queries
          if ("data" in event && event.data?.contactId) {
            const contactId = event.data.contactId as string;
            queryClient.invalidateQueries({
              queryKey: ["/api/contacts", contactId],
            });
          }
        } catch {
          // Ignore parse errors from keep-alive comments
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        if (cancelled) return;

        if (retriesRef.current < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retriesRef.current] ?? 10000;
          retriesRef.current++;
          retryTimeout = setTimeout(connect, delay);
        }
        // After MAX_RETRIES, silently fall back to polling
        // (TanStack Query refetchInterval handles this)
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [queryClient]);
}
