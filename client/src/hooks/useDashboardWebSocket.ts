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

export function useDashboardWebSocket({ 
  tenantId, 
  onEvent,
  autoInvalidate = true 
}: UseDashboardWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<DashboardEvent | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!tenantId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Note: tenantId is derived server-side from session cookie for security
    const wsUrl = `${protocol}//${window.location.host}/ws/dashboard`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Dashboard WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data: DashboardEvent = JSON.parse(event.data);
          setLastEvent(data);
          
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
      };

      ws.onclose = () => {
        console.log('Dashboard WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('Dashboard WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [tenantId, onEvent, autoInvalidate, queryClient]);

  useEffect(() => {
    if (tenantId) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [tenantId, connect]);

  return {
    isConnected,
    lastEvent
  };
}
