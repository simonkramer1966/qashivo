import { db } from "../db";
import { auditLog } from "@shared/schema";
import type { Request } from "express";

export interface AuditLogParams {
  tenantId: string;
  userId: string;
  userName?: string;
  userRole?: string;
  action: string;
  category: "financial" | "operational";
  entityType?: string;
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Write an audit log entry. Non-blocking — fire-and-forget with error logging.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLog).values({
      tenantId: params.tenantId,
      userId: params.userId,
      userName: params.userName ?? null,
      userRole: params.userRole ?? null,
      action: params.action,
      category: params.category,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      entityName: params.entityName ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (error) {
    console.error("[AuditLog] Failed to write audit entry:", error);
  }
}

/**
 * Extract audit context from an Express request with RBAC context loaded.
 * Convenience wrapper for route handlers.
 */
export function logAuditFromReq(
  req: Request,
  action: string,
  category: "financial" | "operational",
  entity?: { type?: string; id?: string; name?: string },
  details?: Record<string, unknown>,
): void {
  if (!req.rbac) return;

  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;

  // Fire-and-forget
  logAudit({
    tenantId: req.rbac.tenantId,
    userId: req.rbac.userId,
    userName: undefined, // Could be enriched later
    userRole: req.rbac.tenantRole ?? req.rbac.userRole,
    action,
    category,
    entityType: entity?.type,
    entityId: entity?.id,
    entityName: entity?.name,
    details,
    ipAddress,
  }).catch(() => {});
}
