// DESIGN: State is per-debtor, not per-invoice.
// A promise on any invoices freezes chasing on ALL invoices for that debtor.
// This is a commercial decision — the debtor has one relationship with the company.
// When the promise resolves, remaining unpromised invoices resume chasing.

import { db } from "../db";
import { eq, and, sql, inArray, isNull, lt } from "drizzle-orm";
import {
  conversationStates,
  conversationStateTransitions,
  contacts,
  type ConversationState,
} from "@shared/schema";

// ─── Valid States ──────────────────────────────────────────────
export type ConvState =
  | 'idle'
  | 'chase_sent'
  | 'debtor_responded'
  | 'conversing'
  | 'promise_monitor'
  | 'dispute_hold'
  | 'escalated'
  | 'resolved'
  | 'hold';

// ─── Triggers ──────────────────────────────────────────────────
export type ConvTrigger =
  | 'chase_sent'
  | 'reply_sent'
  | 'inbound_received'
  | 'intent_classified'
  | 'silence_timeout'
  | 'cooldown_expired'
  | 'processing_timeout'
  | 'promise_kept'
  | 'promise_broken'
  | 'payment_detected'
  | 'manual_hold'
  | 'manual_release'
  | 'escalate'
  | 'resolve'
  | 'reopen';

export interface TransitionContext {
  eventId?: string;
  eventType?: string;
  intent?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  initiatedBy?: 'system' | 'user';
}

// ─── Transition Table ──────────────────────────────────────────
// Map of [currentState][trigger] → newState
// null = invalid transition (rejected)
const TRANSITIONS: Record<string, Record<string, ConvState | null>> = {
  idle: {
    chase_sent: 'chase_sent',
    inbound_received: 'debtor_responded',
    manual_hold: 'hold',
    escalate: 'escalated',
    payment_detected: 'resolved',
  },
  chase_sent: {
    inbound_received: 'debtor_responded',
    cooldown_expired: 'idle',
    manual_hold: 'hold',
    payment_detected: 'resolved',
    chase_sent: 'chase_sent', // re-send updates timestamps
  },
  debtor_responded: {
    intent_classified: null, // resolved dynamically based on intent
    processing_timeout: 'conversing',
    manual_hold: 'hold',
    payment_detected: 'resolved',
  },
  conversing: {
    chase_sent: 'chase_sent',
    reply_sent: 'chase_sent',
    inbound_received: 'debtor_responded',
    silence_timeout: 'idle',
    manual_hold: 'hold',
    payment_detected: 'resolved',
    escalate: 'escalated',
  },
  promise_monitor: {
    promise_kept: 'resolved',
    promise_broken: 'idle',
    inbound_received: 'debtor_responded',
    manual_hold: 'hold',
    payment_detected: 'resolved',
  },
  dispute_hold: {
    inbound_received: 'debtor_responded',
    resolve: 'resolved',
    manual_hold: 'hold',
    payment_detected: 'resolved',
  },
  escalated: {
    chase_sent: 'chase_sent',
    reply_sent: 'chase_sent',
    inbound_received: 'debtor_responded',
    resolve: 'resolved',
    manual_hold: 'hold',
    payment_detected: 'resolved',
  },
  resolved: {
    reopen: 'idle',
    chase_sent: 'chase_sent',
    inbound_received: 'debtor_responded',
  },
  hold: {
    manual_release: null, // resolved dynamically — restores previousState
    payment_detected: 'resolved',
  },
};

/**
 * Resolve the target state for a transition. Handles dynamic transitions
 * (intent_classified, manual_release) that depend on context.
 */
function resolveTransition(
  currentState: ConvState,
  trigger: ConvTrigger,
  context?: TransitionContext,
  stateRow?: ConversationState,
): ConvState | null {
  // Dynamic: intent_classified from debtor_responded
  if (trigger === 'intent_classified' && currentState === 'debtor_responded') {
    const intent = context?.intent;
    if (intent === 'promise') return 'promise_monitor';
    if (intent === 'dispute') return 'dispute_hold';
    // acknowledge, query, payment_info, etc → conversing
    return 'conversing';
  }

  // Dynamic: manual_release from hold → restore previousState or idle
  if (trigger === 'manual_release' && currentState === 'hold') {
    const prev = stateRow?.previousState as ConvState | undefined;
    if (prev && prev !== 'hold') return prev;
    return 'idle';
  }

  const stateTransitions = TRANSITIONS[currentState];
  if (!stateTransitions) return null;

  const target = stateTransitions[trigger];
  return target === undefined ? null : target;
}

// ─── Core API ──────────────────────────────────────────────────

const MAX_RETRIES = 3;

/**
 * Transition a debtor's conversation state. Optimistic locking with retries.
 * Creates the state row (idle) on first access if none exists.
 * Returns the updated state row.
 */
export async function transitionState(
  tenantId: string,
  contactId: string,
  trigger: ConvTrigger,
  context?: TransitionContext,
): Promise<ConversationState | null> {
  const startMs = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // 1. Read or create current state
    const current = await getOrCreateState(tenantId, contactId);

    // 2. Check lock — if locked and not expired, wait briefly
    if (current.lockedUntil && current.lockedUntil > new Date()) {
      const waitMs = Math.min(
        current.lockedUntil.getTime() - Date.now(),
        30_000,
      );
      if (waitMs > 0 && waitMs < 30_000) {
        await new Promise(r => setTimeout(r, Math.min(waitMs + 100, 5000)));
        continue; // retry after lock wait
      }
      // Lock expired (>30s) — proceed anyway
    }

    // 3. Resolve target state
    const currentState = current.state as ConvState;
    const targetState = resolveTransition(currentState, trigger, context, current);
    if (targetState === null) {
      console.warn(
        `[ConvState] Invalid transition: ${currentState} + ${trigger} for contact ${contactId}`,
      );
      return current;
    }

    // 4. Atomic update with optimistic lock
    const now = new Date();
    const newVersion = current.version + 1;

    const updateFields: Record<string, unknown> = {
      state: targetState,
      version: newVersion,
      enteredAt: now,
      previousState: currentState,
      previousStateExitedAt: now,
      updatedAt: now,
      lockedUntil: null, // clear lock on transition
    };

    // Update timestamps based on trigger
    if (['chase_sent', 'reply_sent'].includes(trigger)) {
      updateFields.lastOutboundAt = now;
    }
    if (trigger === 'inbound_received') {
      updateFields.lastInboundAt = now;
    }
    if (targetState === 'resolved') {
      updateFields.resolvedAt = now;
      updateFields.resolvedReason = trigger;
    }
    if (targetState === 'chase_sent') {
      updateFields.chaseRound = sql`${conversationStates.chaseRound} + 1`;
    }
    if (context?.eventId && ['chase_sent', 'reply_sent'].includes(trigger)) {
      updateFields.currentActionId = context.eventId;
    }

    const [updated] = await db
      .update(conversationStates)
      .set(updateFields as any)
      .where(
        and(
          eq(conversationStates.id, current.id),
          eq(conversationStates.version, current.version),
        ),
      )
      .returning();

    if (!updated) {
      // Optimistic lock failed — retry
      console.log(
        `[ConvState] Version conflict for contact ${contactId} (attempt ${attempt + 1})`,
      );
      continue;
    }

    // 5. Audit trail
    const durationMs = Date.now() - startMs;
    await db
      .insert(conversationStateTransitions)
      .values({
        tenantId,
        contactId,
        stateId: current.id,
        fromState: currentState,
        toState: targetState,
        trigger,
        triggerEventId: context?.eventId ?? null,
        triggerEventType: context?.eventType ?? null,
        metadata: context?.metadata ?? null,
        initiatedBy: context?.initiatedBy ?? 'system',
        userId: context?.userId ?? null,
        processingDurationMs: durationMs,
        stateVersion: newVersion,
      })
      .catch(err =>
        console.warn('[ConvState] Audit trail insert failed (non-fatal):', err),
      );

    return updated;
  }

  console.error(
    `[ConvState] Failed after ${MAX_RETRIES} retries for contact ${contactId}, trigger ${trigger}`,
  );
  return null;
}

/**
 * Set a temporary lock on a debtor's conversation state.
 * Used during multi-step operations (e.g. intent classification).
 */
export async function setStateLock(
  tenantId: string,
  contactId: string,
  lockSeconds: number,
): Promise<void> {
  const state = await getOrCreateState(tenantId, contactId);
  const lockedUntil = new Date(Date.now() + lockSeconds * 1000);

  await db
    .update(conversationStates)
    .set({ lockedUntil, updatedAt: new Date() })
    .where(eq(conversationStates.id, state.id));
}

/**
 * Get the current conversation state for a debtor.
 * Creates an idle row if none exists (lazy init).
 */
export async function getState(
  tenantId: string,
  contactId: string,
): Promise<ConversationState> {
  return getOrCreateState(tenantId, contactId);
}

/**
 * Batch read conversation states for multiple contacts.
 * Returns Map<contactId, ConversationState>. Missing contacts are not included.
 */
export async function bulkGetStates(
  tenantId: string,
  contactIds: string[],
): Promise<Map<string, ConversationState>> {
  const map = new Map<string, ConversationState>();
  if (contactIds.length === 0) return map;

  const rows = await db
    .select()
    .from(conversationStates)
    .where(
      and(
        eq(conversationStates.tenantId, tenantId),
        inArray(conversationStates.contactId, contactIds),
      ),
    );

  for (const row of rows) {
    map.set(row.contactId, row);
  }
  return map;
}

/**
 * Count business hours (08:00-18:00 Mon-Fri) elapsed between two dates
 * in the given timezone. Uses Intl.DateTimeFormat for DST safety.
 */
export function businessHoursElapsed(
  since: Date,
  now: Date,
  timezone: string,
): number {
  const BUSINESS_START = 8;
  const BUSINESS_END = 18;
  const HOURS_PER_DAY = BUSINESS_END - BUSINESS_START; // 10

  let hours = 0;
  const cursor = new Date(since);

  // Iterate hour by hour (efficient enough for <1 week spans)
  while (cursor < now) {
    const parts = getDateParts(cursor, timezone);
    const dow = parts.weekday; // 1=Mon ... 7=Sun
    const hour = parts.hour;

    if (dow >= 1 && dow <= 5 && hour >= BUSINESS_START && hour < BUSINESS_END) {
      hours++;
    }

    cursor.setTime(cursor.getTime() + 3600_000);
  }

  return hours;
}

// ─── Internal Helpers ──────────────────────────────────────────

async function getOrCreateState(
  tenantId: string,
  contactId: string,
): Promise<ConversationState> {
  const [existing] = await db
    .select()
    .from(conversationStates)
    .where(
      and(
        eq(conversationStates.tenantId, tenantId),
        eq(conversationStates.contactId, contactId),
      ),
    );

  if (existing) return existing;

  // Create idle state on first access
  try {
    const [created] = await db
      .insert(conversationStates)
      .values({ tenantId, contactId, state: 'idle' })
      .returning();
    return created;
  } catch (err: any) {
    // Unique constraint violation — another process created it first
    if (err.code === '23505') {
      const [row] = await db
        .select()
        .from(conversationStates)
        .where(
          and(
            eq(conversationStates.tenantId, tenantId),
            eq(conversationStates.contactId, contactId),
          ),
        );
      if (row) return row;
    }
    throw err;
  }
}

function getDateParts(
  date: Date,
  timezone: string,
): { weekday: number; hour: number } {
  // Use Intl.DateTimeFormat for DST-safe date part extraction
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);

  const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0';

  const weekdayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };

  return {
    weekday: weekdayMap[weekdayStr] ?? 1,
    hour: parseInt(hourStr, 10),
  };
}

// ─── Hold State Migration ──────────────────────────────────────

/**
 * One-time migration: create conversation_states rows for existing
 * VIP or manually blocked contacts. Runs on first boot after deployment.
 * Safe to call multiple times (checks if any rows exist first).
 */
export async function migrateHeldDebtors(): Promise<void> {
  // Check if any conversation state rows exist — if so, migration already ran
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversationStates);

  if ((countResult?.count ?? 0) > 0) return;

  // Find contacts with isVip=true or manualBlocked=true
  const heldContacts = await db
    .select({ id: contacts.id, tenantId: contacts.tenantId })
    .from(contacts)
    .where(
      sql`${contacts.isVip} = true OR ${contacts.manualBlocked} = true`,
    );

  if (heldContacts.length === 0) return;

  const values = heldContacts.map(c => ({
    tenantId: c.tenantId,
    contactId: c.id,
    state: 'hold' as const,
  }));

  await db.insert(conversationStates).values(values).onConflictDoNothing();

  console.log(
    `[ConvState] Migrated ${values.length} VIP/blocked contacts to hold state`,
  );
}
