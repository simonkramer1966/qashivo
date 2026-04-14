import { db } from "../../db";
import { adminCommunicationEvents } from "@shared/schema";

interface CommEventParams {
  tenantId?: string;
  communicationId: string;
  eventType: string;
  eventData?: Record<string, unknown>;
}

/**
 * Log a communication lifecycle event. Fire-and-forget — never throws.
 */
export async function logCommEvent(params: CommEventParams): Promise<void> {
  try {
    await db.insert(adminCommunicationEvents).values({
      tenantId: params.tenantId ?? null,
      communicationId: params.communicationId,
      eventType: params.eventType,
      eventData: params.eventData ?? null,
    });
  } catch (err) {
    console.error("[CommEventLogger] Failed to log communication event:", err);
  }
}
