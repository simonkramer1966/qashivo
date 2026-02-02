import { db } from "../db";
import { webhookEvents } from "@shared/schema";
import { eq, and, sql, lt } from "drizzle-orm";

type WebhookSource = "sendgrid" | "retell" | "stripe" | "vonage" | "xero";
type WebhookStatus = "processing" | "processed" | "failed" | "skipped";

export async function tryReserveWebhook(params: {
  idempotencyKey: string;
  source: WebhookSource;
  eventType: string;
  tenantId?: string;
}): Promise<{ reserved: boolean; existingStatus?: string }> {
  const { idempotencyKey, source, eventType, tenantId } = params;
  const fullKey = `${source}:${idempotencyKey}`;

  try {
    const result = await db
      .insert(webhookEvents)
      .values({
        idempotencyKey: fullKey,
        source,
        eventType,
        status: "processing",
        tenantId: tenantId || null,
        processedAt: null,
      })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });

    if (result.length > 0) {
      return { reserved: true };
    }

    const existing = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.idempotencyKey, fullKey),
    });

    return { reserved: false, existingStatus: existing?.status || "unknown" };
  } catch (err) {
    console.error(`❌ Error reserving webhook idempotency: ${err}`);
    return { reserved: false, existingStatus: "error" };
  }
}

export async function completeWebhook(params: {
  idempotencyKey: string;
  source: WebhookSource;
  status: Exclude<WebhookStatus, "processing">;
  errorMessage?: string;
}): Promise<boolean> {
  const { idempotencyKey, source, status, errorMessage } = params;
  const fullKey = `${source}:${idempotencyKey}`;

  try {
    await db.update(webhookEvents)
      .set({
        status,
        processedAt: new Date(),
        errorMessage: errorMessage || null,
      })
      .where(eq(webhookEvents.idempotencyKey, fullKey));

    return true;
  } catch (err) {
    console.error(`❌ Error completing webhook: ${err}`);
    return false;
  }
}

export async function cleanupOldWebhookEvents(daysToKeep: number = 7): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  
  try {
    const result = await db
      .delete(webhookEvents)
      .where(lt(webhookEvents.createdAt, cutoff))
      .returning({ id: webhookEvents.id });
    
    return result.length;
  } catch (err) {
    console.error(`❌ Error cleaning up webhook events: ${err}`);
    return 0;
  }
}
