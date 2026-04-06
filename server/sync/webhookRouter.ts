// ═══════════════════════════════════════════════════════════════════════════
// Webhook Router — Platform-agnostic webhook dispatch
// ═══════════════════════════════════════════════════════════════════════════
// Receives webhook events from accounting platforms, verifies signatures,
// responds 200 immediately, then triggers async sync via the orchestrator.
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { SyncOrchestrator } from './SyncOrchestrator';
import type { AccountingAdapter } from './adapters/types';

export function createWebhookRouter(
  orchestrator: SyncOrchestrator,
  adapter: AccountingAdapter,
): Router {
  const router = Router();

  // ── Xero webhook endpoint ──────────────────────────────────────────────
  router.post('/xero', async (req, res) => {
    const secret = process.env.XERO_WEBHOOK_KEY;
    if (!secret) {
      console.warn('[WebhookRouter] XERO_WEBHOOK_KEY not configured');
      res.status(200).send(); // Don't reveal webhook misconfiguration
      return;
    }

    // Handle Xero's intent-to-receive validation
    if (adapter.handleWebhookValidation) {
      const handled = adapter.handleWebhookValidation(req, res, secret);
      if (handled) return; // Validation-only request — no events to process
    }

    // Respond 200 immediately (Xero requires response within 5 seconds)
    res.status(200).send();

    // Parse and process events asynchronously
    try {
      const events = adapter.parseWebhookEvents(req.body);
      if (events.length === 0) return;

      // Group events by tenant platform ID
      const byTenantPlatformId = new Map<string, typeof events>();
      for (const event of events) {
        const existing = byTenantPlatformId.get(event.tenantPlatformId) || [];
        existing.push(event);
        byTenantPlatformId.set(event.tenantPlatformId, existing);
      }

      // Resolve platform tenant IDs to Qashivo tenant IDs and trigger syncs
      for (const [platformTenantId, tenantEvents] of Array.from(byTenantPlatformId.entries())) {
        try {
          const [tenant] = await db.select({ id: tenants.id })
            .from(tenants)
            .where(eq(tenants.xeroTenantId, platformTenantId));

          if (!tenant) {
            console.warn(`[WebhookRouter] No tenant found for Xero org ${platformTenantId}`);
            continue;
          }

          // Trigger async sync for this tenant
          orchestrator.enqueueSync(tenant.id, 'webhook', 'webhook');
          console.log(`[WebhookRouter] Queued webhook sync for tenant ${tenant.id} (${tenantEvents.length} events)`);
        } catch (err) {
          console.error(`[WebhookRouter] Error processing webhook for org ${platformTenantId}:`, err);
        }
      }
    } catch (err) {
      console.error('[WebhookRouter] Error processing webhook events:', err);
    }
  });

  return router;
}
