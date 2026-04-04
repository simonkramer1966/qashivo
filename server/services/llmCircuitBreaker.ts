/**
 * LLM Circuit Breaker — Gap 9
 *
 * Per-tenant state machine: CLOSED → OPEN → HALF_OPEN → CLOSED.
 * Protects action pipeline from extended LLM outages.
 * Admin notifications sent on state transitions via system email/SMS.
 */

import { storage } from '../storage';
import { emailService } from './sendgrid';

// ── Constants ──────────────────────────────────────────────────

const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MS = 30 * 60 * 1000;        // 30 minutes
const PROBE_INTERVAL_MS = 5 * 60 * 1000;         // 5 minutes between recovery probes
const TEMPLATE_ACTIVATION_MS = 4 * 60 * 60 * 1000; // 4 hours before templates activate

// ── State ──────────────────────────────────────────────────────

interface CircuitState {
  status: 'closed' | 'open' | 'half_open';
  consecutiveFailures: number;
  failureTimestamps: number[];
  lastFailureAt: number | null;
  openedAt: number | null;
  lastProbeAt: number | null;
}

const circuits = new Map<string, CircuitState>();

function getCircuit(tenantId: string): CircuitState {
  let state = circuits.get(tenantId);
  if (!state) {
    state = {
      status: 'closed',
      consecutiveFailures: 0,
      failureTimestamps: [],
      lastFailureAt: null,
      openedAt: null,
      lastProbeAt: null,
    };
    circuits.set(tenantId, state);
  }
  return state;
}

// ── Custom error for callers ───────────────────────────────────

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// ── Public API ─────────────────────────────────────────────────

export function recordSuccess(tenantId: string): void {
  const state = getCircuit(tenantId);
  const wasOpen = state.status === 'half_open' || state.status === 'open';

  state.consecutiveFailures = 0;
  state.failureTimestamps = [];
  state.lastFailureAt = null;

  if (state.status === 'half_open') {
    state.status = 'closed';
    state.openedAt = null;
    state.lastProbeAt = null;
    console.log(`[CircuitBreaker] Circuit CLOSED for tenant ${tenantId} — LLM recovered`);
    notifyAdmins(tenantId, 'closed').catch(err =>
      console.error('[CircuitBreaker] Failed to send recovery notification:', err)
    );
  } else if (state.status === 'closed') {
    // Normal success in closed state — nothing to do
  }
}

export function recordFailure(tenantId: string): void {
  const state = getCircuit(tenantId);
  const now = Date.now();

  // Prune failures outside the window
  state.failureTimestamps = state.failureTimestamps.filter(
    ts => now - ts < FAILURE_WINDOW_MS
  );
  state.failureTimestamps.push(now);
  state.consecutiveFailures = state.failureTimestamps.length;
  state.lastFailureAt = now;

  // If probing in half_open and it failed, go back to open
  if (state.status === 'half_open') {
    state.status = 'open';
    state.lastProbeAt = now;
    console.log(`[CircuitBreaker] Probe FAILED for tenant ${tenantId} — circuit remains OPEN`);
    return;
  }

  if (state.status === 'closed' && state.consecutiveFailures >= FAILURE_THRESHOLD) {
    state.status = 'open';
    state.openedAt = now;
    state.lastProbeAt = null;
    console.log(`[CircuitBreaker] Circuit OPENED for tenant ${tenantId} after ${state.consecutiveFailures} failures in ${FAILURE_WINDOW_MS / 60000}min`);
    notifyAdmins(tenantId, 'open').catch(err =>
      console.error('[CircuitBreaker] Failed to send outage notification:', err)
    );
  }
}

export interface GenerationDecision {
  allowed: boolean;
  useTemplate?: boolean;
  reason?: string;
}

export function canAttemptGeneration(tenantId: string): GenerationDecision {
  const state = getCircuit(tenantId);
  const now = Date.now();

  if (state.status === 'closed') {
    return { allowed: true };
  }

  if (state.status === 'half_open') {
    // One probe at a time — deny additional requests during probe
    return { allowed: false, reason: 'circuit_half_open_probe_in_progress' };
  }

  // status === 'open'
  const timeSinceOpen = state.openedAt ? now - state.openedAt : 0;
  const timeSinceProbe = state.lastProbeAt ? now - state.lastProbeAt : Infinity;

  // Allow a probe every PROBE_INTERVAL_MS
  if (timeSinceProbe >= PROBE_INTERVAL_MS) {
    state.status = 'half_open';
    state.lastProbeAt = now;
    console.log(`[CircuitBreaker] Attempting probe for tenant ${tenantId}`);
    return { allowed: true, reason: 'probe_attempt' };
  }

  // After TEMPLATE_ACTIVATION_MS, enable template fallback
  if (timeSinceOpen >= TEMPLATE_ACTIVATION_MS) {
    return { allowed: false, useTemplate: true, reason: 'circuit_open_templates_active' };
  }

  // Circuit open but not yet at template threshold — queue actions
  return { allowed: false, reason: 'circuit_open_queuing' };
}

export function isCircuitOpen(tenantId: string): boolean {
  const state = getCircuit(tenantId);
  return state.status === 'open' || state.status === 'half_open';
}

// ── Admin Notifications ────────────────────────────────────────

async function notifyAdmins(tenantId: string, transition: 'open' | 'closed'): Promise<void> {
  try {
    const users = await storage.getUsersInTenant(tenantId);
    const admins = users.filter(u =>
      u.tenantRole === 'owner' || u.tenantRole === 'admin'
    );

    if (admins.length === 0) {
      console.warn(`[CircuitBreaker] No admin users found for tenant ${tenantId}`);
      return;
    }

    const subject = transition === 'open'
      ? 'Qashivo Alert: Message generation paused'
      : 'Qashivo Alert: Message generation recovered';

    const body = transition === 'open'
      ? 'Qashivo alert: Message generation is experiencing issues. Outbound communications have been paused. We are monitoring and will notify you when service resumes.'
      : 'Qashivo alert: Message generation has recovered. Outbound communications have resumed.';

    for (const admin of admins) {
      const adminName = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || undefined;

      // Send email via raw emailService (bypasses communication mode — system-to-admin alert)
      if (admin.email) {
        try {
          await emailService.sendEmail({
            to: [{ email: admin.email, name: adminName }],
            from: { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@qashivo.com', name: 'Qashivo System' },
            subject,
            text: body,
            html: `<p>${body}</p>`,
          });
        } catch (emailErr) {
          console.error(`[CircuitBreaker] Failed to email admin ${admin.email}:`, emailErr);
        }
      }
      // SMS notifications removed — no phone column on users table. Reinstate when user phone numbers are collected.
    }
  } catch (err) {
    console.error(`[CircuitBreaker] Error notifying admins for tenant ${tenantId}:`, err);
  }
}
