import { db } from "../db";
import { activityLogs } from "../../shared/schema";

export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'signup'
  | 'password_reset_request'
  | 'password_reset_confirm'
  | 'session_expired_idle'
  | 'session_expired_absolute'
  | 'role_change'
  | 'tenant_switch'
  | 'invite_accepted'
  | 'account_locked';

interface SecurityAuditParams {
  eventType: SecurityEventType;
  userId?: string | null;
  tenantId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  result?: 'success' | 'failure';
}

export async function logSecurityEvent(params: SecurityAuditParams): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      tenantId: params.tenantId || null,
      activityType: params.eventType,
      category: 'security',
      action: params.eventType,
      description: describeEvent(params),
      result: params.result || 'success',
      userId: params.userId || null,
      actor: 'USER',
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error(`[SecurityAudit] Failed to log event ${params.eventType}:`, error);
  }
}

function describeEvent(params: SecurityAuditParams): string {
  switch (params.eventType) {
    case 'login_success': return `User logged in successfully`;
    case 'login_failed': return `Failed login attempt for ${params.metadata?.email || 'unknown'}`;
    case 'logout': return `User logged out`;
    case 'signup': return `New account created`;
    case 'password_reset_request': return `Password reset requested`;
    case 'password_reset_confirm': return `Password reset completed`;
    case 'session_expired_idle': return `Session expired due to inactivity`;
    case 'session_expired_absolute': return `Session expired (max lifetime reached)`;
    case 'role_change': return `Role changed from ${params.metadata?.oldRole} to ${params.metadata?.newRole}`;
    case 'tenant_switch': return `Switched to tenant ${params.metadata?.tenantName || params.metadata?.tenantId}`;
    case 'invite_accepted': return `User accepted invitation`;
    case 'account_locked': return `Account locked after too many failed attempts`;
    default: return `Security event: ${params.eventType}`;
  }
}

export function extractClientInfo(req: any): { ipAddress: string; userAgent: string } {
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';
  return { ipAddress, userAgent };
}
