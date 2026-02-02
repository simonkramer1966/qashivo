import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { storage } from '../storage';
import cookie from 'cookie';

export type DashboardEventType = 
  | 'action_completed'
  | 'action_created'
  | 'invoice_updated'
  | 'payment_received'
  | 'ptp_created'
  | 'data_refresh'
  | 'sync_completed'
  | 'inbound_message_received';

export interface DashboardEvent {
  type: DashboardEventType;
  tenantId: string;
  data?: any;
  timestamp: string;
}

interface AuthenticatedWebSocket extends WebSocket {
  tenantId?: string;
  userId?: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, Set<AuthenticatedWebSocket>>();
  private sessionStore: any = null;

  async initialize(server: Server) {
    const pgStore = connectPg(session);
    this.sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      tableName: "sessions",
    });

    this.wss = new WebSocketServer({ server, path: '/ws/dashboard' });

    this.wss.on('connection', async (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
      try {
        const userInfo = await this.authenticateConnection(req);
        
        if (!userInfo || !userInfo.tenantId) {
          console.log('🔌 WebSocket connection rejected: not authenticated');
          ws.close(1008, 'Authentication required');
          return;
        }

        ws.tenantId = userInfo.tenantId;
        ws.userId = userInfo.userId;

        console.log(`🔌 Dashboard WebSocket connected for tenant: ${userInfo.tenantId} (user: ${userInfo.userId})`);

        if (!this.connections.has(userInfo.tenantId)) {
          this.connections.set(userInfo.tenantId, new Set());
        }
        this.connections.get(userInfo.tenantId)!.add(ws);

        ws.on('close', () => {
          console.log(`🔌 Dashboard WebSocket disconnected for tenant: ${ws.tenantId}`);
          if (ws.tenantId) {
            const tenantConnections = this.connections.get(ws.tenantId);
            if (tenantConnections) {
              tenantConnections.delete(ws);
              if (tenantConnections.size === 0) {
                this.connections.delete(ws.tenantId);
              }
            }
          }
        });

        ws.on('error', (error) => {
          console.error(`Dashboard WebSocket error for tenant ${ws.tenantId}:`, error);
        });

        ws.send(JSON.stringify({
          type: 'connected',
          tenantId: userInfo.tenantId,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        ws.close(1008, 'Authentication failed');
      }
    });

    console.log('✅ Dashboard WebSocket service initialized');
  }

  private async authenticateConnection(req: IncomingMessage): Promise<{ userId: string; tenantId: string } | null> {
    return new Promise((resolve) => {
      try {
        const cookies = cookie.parse(req.headers.cookie || '');
        const sessionId = cookies['connect.sid'];

        if (!sessionId) {
          resolve(null);
          return;
        }

        const sid = sessionId.startsWith('s:') 
          ? sessionId.slice(2).split('.')[0]
          : sessionId.split('.')[0];

        this.sessionStore.get(sid, async (err: any, sessionData: any) => {
          if (err || !sessionData) {
            resolve(null);
            return;
          }

          const userId = sessionData?.passport?.user;
          if (!userId) {
            resolve(null);
            return;
          }

          try {
            const user = await storage.getUser(userId);
            if (!user || !user.tenantId) {
              resolve(null);
              return;
            }

            resolve({ userId: user.id, tenantId: user.tenantId });
          } catch (error) {
            console.error('Error fetching user for WebSocket auth:', error);
            resolve(null);
          }
        });
      } catch (error) {
        console.error('Session parsing error:', error);
        resolve(null);
      }
    });
  }

  broadcast(tenantId: string, event: Omit<DashboardEvent, 'tenantId' | 'timestamp'>) {
    const tenantConnections = this.connections.get(tenantId);
    if (!tenantConnections || tenantConnections.size === 0) {
      console.log(`📡 No WebSocket connections for tenant: ${tenantId}, skipping broadcast of ${event.type}`);
      return;
    }

    const message = JSON.stringify({
      ...event,
      tenantId,
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;
    tenantConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      }
    });

    if (sentCount > 0) {
      console.log(`📡 Broadcast ${event.type} to ${sentCount} client(s) for tenant: ${tenantId}`);
    }
  }

  broadcastActionCompleted(tenantId: string, actionId: string, actionType: string) {
    this.broadcast(tenantId, {
      type: 'action_completed',
      data: { actionId, actionType }
    });
  }

  broadcastActionCreated(tenantId: string, actionId: string) {
    this.broadcast(tenantId, {
      type: 'action_created',
      data: { actionId }
    });
  }

  broadcastPaymentReceived(tenantId: string, invoiceId: string, amount: string) {
    this.broadcast(tenantId, {
      type: 'payment_received',
      data: { invoiceId, amount }
    });
  }

  broadcastInvoiceUpdated(tenantId: string, invoiceId: string) {
    this.broadcast(tenantId, {
      type: 'invoice_updated',
      data: { invoiceId }
    });
  }

  broadcastPTPCreated(tenantId: string, ptpId: string, contactId: string) {
    this.broadcast(tenantId, {
      type: 'ptp_created',
      data: { ptpId, contactId }
    });
  }

  broadcastSyncCompleted(tenantId: string) {
    this.broadcast(tenantId, {
      type: 'sync_completed',
      data: {}
    });
  }

  broadcastDataRefresh(tenantId: string) {
    this.broadcast(tenantId, {
      type: 'data_refresh',
      data: {}
    });
  }

  broadcastInboundMessageReceived(
    tenantId: string, 
    channel: 'email' | 'sms' | 'voice',
    senderName: string,
    senderEmail: string | null,
    customerId: string,
    customerName: string
  ) {
    this.broadcast(tenantId, {
      type: 'inbound_message_received',
      data: { channel, senderName, senderEmail, customerId, customerName }
    });
  }

  getConnectionCount(tenantId: string): number {
    return this.connections.get(tenantId)?.size || 0;
  }

  getTotalConnections(): number {
    let total = 0;
    this.connections.forEach((set) => {
      total += set.size;
    });
    return total;
  }
}

export const websocketService = new WebSocketService();
