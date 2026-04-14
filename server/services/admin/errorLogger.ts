import { db } from "../../db";
import { adminSystemErrors } from "@shared/schema";

interface SystemErrorParams {
  tenantId?: string;
  source: string;
  severity?: "error" | "warning" | "critical";
  message: string;
  stackTrace?: string;
  context?: Record<string, unknown>;
}

/**
 * Log a structured system error. Fire-and-forget — never throws.
 */
export async function logSystemError(params: SystemErrorParams): Promise<void> {
  try {
    await db.insert(adminSystemErrors).values({
      tenantId: params.tenantId ?? null,
      source: params.source,
      severity: params.severity ?? "error",
      message: params.message,
      stackTrace: params.stackTrace ?? null,
      context: params.context ?? null,
    });
  } catch (err) {
    console.error("[ErrorLogger] Failed to log system error:", err);
  }
}
