/**
 * State Timeout Checker — hourly cron for stuck/expired conversation states.
 *
 * Four checks:
 * A. DEBTOR_RESPONDED stuck > 5 min → processing_timeout → CONVERSING + exception
 * B. CONVERSING silence timeout (weekend-aware business hours)
 * C. CHASE_SENT cooldown expired → cooldown_expired → IDLE
 * D. Expired locks → clear lock + log warning
 */

import { db } from "../db";
import { conversationStates, tenants, timelineEvents } from "@shared/schema";
import { eq, and, sql, lt, isNotNull, inArray } from "drizzle-orm";
import {
  transitionState,
  businessHoursElapsed,
} from "../services/conversationStateService";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startStateTimeoutChecker(): void {
  console.log("[state-timeout] Starting hourly conversation state timeout checker");

  // Run once on startup (delayed 60s to let app boot)
  setTimeout(() => {
    runTimeoutChecks().catch(err =>
      console.error("[state-timeout] Initial run error:", err),
    );
  }, 60_000);

  intervalHandle = setInterval(() => {
    runTimeoutChecks().catch(err =>
      console.error("[state-timeout] Run error:", err),
    );
  }, INTERVAL_MS);
}

export function stopStateTimeoutChecker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[state-timeout] Stopped");
  }
}

async function runTimeoutChecks(): Promise<void> {
  const now = new Date();
  console.log("[state-timeout] Running conversation state timeout checks");

  let totalTransitions = 0;

  // ── A. DEBTOR_RESPONDED stuck > 5 minutes → processing_timeout ──
  try {
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const stuckResponded = await db
      .select()
      .from(conversationStates)
      .where(
        and(
          eq(conversationStates.state, 'debtor_responded'),
          lt(conversationStates.enteredAt, fiveMinAgo),
        ),
      );

    for (const row of stuckResponded) {
      try {
        await transitionState(row.tenantId, row.contactId, 'processing_timeout', {
          metadata: { reason: 'stuck_debtor_responded', stuckSince: row.enteredAt?.toISOString() },
        });
        totalTransitions++;

        // Create exception timeline event
        await db.insert(timelineEvents).values({
          tenantId: row.tenantId,
          customerId: row.contactId,
          occurredAt: now,
          direction: 'system',
          channel: 'system',
          summary: 'Conversation state stuck in DEBTOR_RESPONDED > 5min — auto-transitioned to CONVERSING',
          status: 'processed',
          createdByType: 'system',
          createdByName: 'State Timeout Checker',
        } as any).catch(() => {});
      } catch (err) {
        console.warn(`[state-timeout] processing_timeout failed for ${row.contactId}:`, err);
      }
    }

    if (stuckResponded.length > 0) {
      console.log(`[state-timeout] Unstuck ${stuckResponded.length} DEBTOR_RESPONDED states`);
    }
  } catch (err) {
    console.error("[state-timeout] Check A (debtor_responded) failed:", err);
  }

  // ── B. CONVERSING silence timeout (weekend-aware) ──
  try {
    const conversingRows = await db
      .select({
        id: conversationStates.id,
        tenantId: conversationStates.tenantId,
        contactId: conversationStates.contactId,
        lastOutboundAt: conversationStates.lastOutboundAt,
        lastInboundAt: conversationStates.lastInboundAt,
        enteredAt: conversationStates.enteredAt,
        silenceTimeoutHours: conversationStates.silenceTimeoutHours,
      })
      .from(conversationStates)
      .where(eq(conversationStates.state, 'conversing'));

    // Batch-load tenant timezones
    const tenantIds = Array.from(new Set(conversingRows.map(r => r.tenantId)));
    const tenantMap = new Map<string, string>();
    if (tenantIds.length > 0) {
      const tenantRows = await db
        .select({ id: tenants.id, tz: tenants.executionTimezone })
        .from(tenants)
        .where(inArray(tenants.id, tenantIds));
      for (const t of tenantRows) {
        tenantMap.set(t.id, (t.tz as string) || 'Europe/London');
      }
    }

    for (const row of conversingRows) {
      try {
        const lastActivity = laterDate(row.lastOutboundAt, row.lastInboundAt) || row.enteredAt;
        if (!lastActivity) continue;

        const tz = tenantMap.get(row.tenantId) || 'Europe/London';
        const elapsed = businessHoursElapsed(lastActivity, now, tz);
        const timeout = row.silenceTimeoutHours ?? 48;

        if (elapsed >= timeout) {
          await transitionState(row.tenantId, row.contactId, 'silence_timeout', {
            metadata: { businessHoursElapsed: elapsed, timeoutHours: timeout },
          });
          totalTransitions++;
        }
      } catch (err) {
        console.warn(`[state-timeout] silence_timeout failed for ${row.contactId}:`, err);
      }
    }
  } catch (err) {
    console.error("[state-timeout] Check B (conversing silence) failed:", err);
  }

  // ── C. CHASE_SENT cooldown expired ──
  try {
    const chaseSentRows = await db
      .select({
        id: conversationStates.id,
        tenantId: conversationStates.tenantId,
        contactId: conversationStates.contactId,
        enteredAt: conversationStates.enteredAt,
      })
      .from(conversationStates)
      .where(eq(conversationStates.state, 'chase_sent'));

    // Load chaseDelayDays per tenant
    const chaseTenantIds = Array.from(new Set(chaseSentRows.map(r => r.tenantId)));
    const chaseDelayMap = new Map<string, number>();
    if (chaseTenantIds.length > 0) {
      const tRows = await db
        .select({ id: tenants.id, chaseDelayDays: tenants.chaseDelayDays })
        .from(tenants)
        .where(inArray(tenants.id, chaseTenantIds));
      for (const t of tRows) {
        chaseDelayMap.set(t.id, (t.chaseDelayDays as number) ?? 5);
      }
    }

    for (const row of chaseSentRows) {
      try {
        if (!row.enteredAt) continue;
        const delayDays = chaseDelayMap.get(row.tenantId) ?? 5;
        const cooldownMs = delayDays * 24 * 60 * 60 * 1000;
        const expiresAt = new Date(row.enteredAt.getTime() + cooldownMs);

        if (now >= expiresAt) {
          await transitionState(row.tenantId, row.contactId, 'cooldown_expired', {
            metadata: { chaseDelayDays: delayDays },
          });
          totalTransitions++;
        }
      } catch (err) {
        console.warn(`[state-timeout] cooldown_expired failed for ${row.contactId}:`, err);
      }
    }
  } catch (err) {
    console.error("[state-timeout] Check C (chase_sent cooldown) failed:", err);
  }

  // ── D. Expired locks ──
  try {
    const expiredLocks = await db
      .update(conversationStates)
      .set({ lockedUntil: null, updatedAt: now })
      .where(
        and(
          isNotNull(conversationStates.lockedUntil),
          lt(conversationStates.lockedUntil, now),
        ),
      )
      .returning({ id: conversationStates.id, contactId: conversationStates.contactId });

    if (expiredLocks.length > 0) {
      console.warn(`[state-timeout] Cleared ${expiredLocks.length} expired lock(s)`);
    }
  } catch (err) {
    console.error("[state-timeout] Check D (expired locks) failed:", err);
  }

  if (totalTransitions > 0) {
    console.log(`[state-timeout] Completed: ${totalTransitions} transition(s)`);
  }
}

function laterDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
