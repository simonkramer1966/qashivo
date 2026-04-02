import { db } from "../db";
import { contacts, timelineEvents } from "../../shared/schema";
import { eq, and, sql, isNotNull, gte, lte } from "drizzle-orm";

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startLegalWindowJob(): void {
  console.log("[legal-window] Starting daily legal window check job");

  // Run once on startup (delayed 45s to let app boot)
  setTimeout(() => {
    runLegalWindowChecks().catch((err) =>
      console.error("[legal-window] Initial run error:", err),
    );
  }, 45_000);

  intervalHandle = setInterval(() => {
    runLegalWindowChecks().catch((err) =>
      console.error("[legal-window] Run error:", err),
    );
  }, INTERVAL_MS);
}

export function stopLegalWindowJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[legal-window] Stopped");
  }
}

async function runLegalWindowChecks(): Promise<void> {
  const now = new Date();
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

  console.log("[legal-window] Running daily legal window checks");

  // ── Day 25 notifications: window expires within 5 days ──
  const expiring = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      tenantId: contacts.tenantId,
      windowEnd: contacts.legalResponseWindowEnd,
    })
    .from(contacts)
    .where(
      and(
        isNotNull(contacts.legalResponseWindowEnd),
        gte(contacts.legalResponseWindowEnd, now),
        lte(contacts.legalResponseWindowEnd, fiveDaysFromNow),
      ),
    );

  for (const contact of expiring) {
    const daysRemaining = Math.ceil(
      (new Date(contact.windowEnd!).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // Dedup: check for existing notification in last 7 days
    const existing = await db
      .select({ id: timelineEvents.id })
      .from(timelineEvents)
      .where(
        and(
          eq(timelineEvents.customerId, contact.id),
          eq(timelineEvents.channel, "system"),
          sql`${timelineEvents.summary} LIKE '%response window expires%'`,
          gte(
            timelineEvents.occurredAt,
            new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          ),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(timelineEvents).values({
      tenantId: contact.tenantId,
      customerId: contact.id,
      occurredAt: now,
      direction: "internal",
      channel: "system",
      summary: `Pre-action response window expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}. Review for debt recovery referral.`,
      preview: `Legal response window expiring ${new Date(contact.windowEnd!).toISOString().split("T")[0]}. No payment or response received.`,
      createdByType: "system",
      outcomeRequiresReview: true,
    });

    console.log(
      `⚖️ [Legal] Window for ${contact.name} expires in ${daysRemaining}d`,
    );
  }

  // ── Day 30+ expiry: window has passed, debtor not resolved ──
  const expired = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      tenantId: contacts.tenantId,
      windowEnd: contacts.legalResponseWindowEnd,
    })
    .from(contacts)
    .where(
      and(
        isNotNull(contacts.legalResponseWindowEnd),
        sql`${contacts.legalResponseWindowEnd} < ${now}`,
      ),
    );

  for (const contact of expired) {
    // Dedup: check for existing expiry event
    const existing = await db
      .select({ id: timelineEvents.id })
      .from(timelineEvents)
      .where(
        and(
          eq(timelineEvents.customerId, contact.id),
          eq(timelineEvents.channel, "system"),
          sql`${timelineEvents.summary} LIKE '%response window expired%'`,
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(timelineEvents).values({
      tenantId: contact.tenantId,
      customerId: contact.id,
      occurredAt: now,
      direction: "internal",
      channel: "system",
      summary: `Pre-action 30-day response window expired. Debtor eligible for court referral / debt recovery handoff. Awaiting user decision.`,
      preview: `Legal window expired ${new Date(contact.windowEnd!).toISOString().split("T")[0]}. Action required.`,
      createdByType: "system",
      outcomeRequiresReview: true,
    });

    console.log(
      `⚖️ [Legal] Window EXPIRED for ${contact.name} — awaiting user decision`,
    );
  }

  console.log(
    `[legal-window] Completed — ${expiring.length} expiring, ${expired.length} expired`,
  );
}
