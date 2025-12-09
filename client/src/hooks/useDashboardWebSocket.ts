import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type DashboardEventType = 
  | 'action_completed'
  | 'action_created'
  | 'invoice_updated'
  | 'payment_received'
  | 'ptp_created'
  | 'data_refresh'
  | 'sync_completed'
  | 'connected';

export interface DashboardEvent {
  type: DashboardEventType;
  tenantId: string;
  data?: any;
  timestamp: string;
}

interface UseDashboardWebSocketOptions {
  tenantId: string | undefined;
  onEvent?: (event: DashboardEvent) => void;
  autoInvalidate?: boolean;
}

// Global connection state - persists across HMR
const globalState = {
  ws: null as WebSocket | null,
  tenantId: null as string | null,
  listenerCount: 0,
  reconnectTimeout: null as NodeJS.Timeout | null,
  reconnectAttempts: 0,
  isConnecting: false
};

const MAX_RECONNECT_ATTEMPTS = 5;

export function useDashboardWebSocket({ 
  tenantId, 
  onEvent,
  autoInvalidate = true 
}: UseDashboardWebSocketOptions) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<DashboardEvent | null>(null);
  const mountedRef = useRef(true);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: DashboardEvent = JSON.parse(event.data);
      if (mountedRef.current) {
        setLastEvent(data);
      }
      
      if (onEvent) {
        onEvent(data);
      }

      if (autoInvalidate && data.type !== 'connected') {
        switch (data.type) {
          case 'action_completed':
          case 'action_created':
            queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['/api/metrics'] });
            break;
          case 'invoice_updated':
          case 'payment_received':
            queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['/api/metrics'] });
            break;
          case 'ptp_created':
            queryClient.invalidateQueries({ queryKey: ['/api/payment-promises'] });
            queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
            break;
          case 'sync_completed':
            queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
            queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
            queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
            break;
          case 'data_refresh':
            queryClient.invalidateQueries();
            break;
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [onEvent, autoInvalidate, queryClient]);

  // Store handler in ref for cleanup
  messageHandlerRef.current = handleMessage;

  useEffect(() => {
    mountedRef.current = true;
    
    if (!tenantId) {
      return;
    }

    globalState.listenerCount++;

    const setupConnection = () => {
      // If already connected to same tenant, just add message listener
      if (globalState.ws && 
          globalState.ws.readyState === WebSocket.OPEN && 
          globalState.tenantId === tenantId) {
        setIsConnected(true);
        return;
      }

      // If connecting, wait
      if (globalState.isConnecting) {
        return;
      }

      // If tenant changed, close existing
      if (globalState.ws && globalState.tenantId !== tenantId) {
        globalState.ws.close(1000, 'Tenant changed');
        globalState.ws = null;
        globalState.tenantId = null;
      }

      globalState.isConnecting = true;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/dashboard`;

      try {
        const ws = new WebSocket(wsUrl);
        globalState.ws = ws;
        globalState.tenantId = tenantId;

        ws.onopen = () => {
          console.log('Dashboard WebSocket connected');
          globalState.isConnecting = false;
          globalState.reconnectAttempts = 0;
          if (mountedRef.current) {
            setIsConnected(true);
          }
        };

        ws.onmessage = (event) => {
          // Forward to all current handlers
          if (messageHandlerRef.current) {
            messageHandlerRef.current(event);
          }
        };

        ws.onclose = (event) => {
          console.log('Dashboard WebSocket disconnected', event.code);
          globalState.ws = null;
          globalState.isConnecting = false;
          if (mountedRef.current) {
            setIsConnected(false);
          }

          // Only attempt reconnect if:
          // 1. Not a clean close
          // 2. Still have listeners
          // 3. Haven't exceeded max attempts
          if (event.code !== 1000 && 
              event.code !== 1001 && 
              globalState.listenerCount > 0 && 
              globalState.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(2000 * Math.pow(2, globalState.reconnectAttempts), 30000);
            globalState.reconnectTimeout = setTimeout(() => {
              globalState.reconnectAttempts++;
              setupConnection();
            }, delay);
          }
        };

        ws.onerror = (error) => {
          console.error('Dashboard WebSocket error:', error);
          globalState.isConnecting = false;
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        globalState.isConnecting = false;
      }
    };

    // Delay initial connection to batch multiple mounts
    const connectionTimer = setTimeout(setupConnection, 300);

    return () => {
      mountedRef.current = false;
      globalState.listenerCount--;
      clearTimeout(connectionTimer);

      // Only close if no more listeners
      if (globalState.listenerCount <= 0) {
        globalState.listenerCount = 0;
        if (globalState.reconnectTimeout) {
          clearTimeout(globalState.reconnectTimeout);
          globalState.reconnectTimeout = null;
        }
        if (globalState.ws && globalState.ws.readyState === WebSocket.OPEN) {
          globalState.ws.close(1000, 'No more listeners');
        }
        globalState.ws = null;
        globalState.tenantId = null;
      }
    };
  }, [tenantId]);

  return {
    isConnected,
    lastEvent
  };
}
