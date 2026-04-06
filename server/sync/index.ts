// ═══════════════════════════════════════════════════════════════════════════
// Sync Module — Entry point
// ═══════════════════════════════════════════════════════════════════════════
// Creates and exports the sync orchestrator, adapter, and webhook router.
// Import this from startup/orchestrator.ts to wire into the application.
// ═══════════════════════════════════════════════════════════════════════════

import { XeroAdapter } from './adapters/XeroAdapter';
import { SyncOrchestrator } from './SyncOrchestrator';
import { createWebhookRouter } from './webhookRouter';

// Singleton instances
const xeroAdapter = new XeroAdapter();
const syncOrchestrator = new SyncOrchestrator(xeroAdapter);
const syncWebhookRouter = createWebhookRouter(syncOrchestrator, xeroAdapter);

export { xeroAdapter, syncOrchestrator, syncWebhookRouter };
export { SyncOrchestrator } from './SyncOrchestrator';
export { XeroAdapter } from './adapters/XeroAdapter';
export type { AccountingAdapter } from './adapters/types';
