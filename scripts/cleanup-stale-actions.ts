/**
 * One-time script: Cancel all stale pending/scheduled actions
 * whose invoices have been paid, voided, or deleted.
 *
 * Usage: npx tsx scripts/cleanup-stale-actions.ts
 */
import '../server/db';
import { cancelStaleActions } from '../server/services/staleActionCleanup';

async function main() {
  console.log('=== Stale Action Cleanup ===\n');
  const result = await cancelStaleActions();

  if (result.cancelled === 0) {
    console.log('No stale actions found.');
  } else {
    console.log(`Cancelled ${result.cancelled} stale actions:\n`);
    for (const d of result.details) {
      console.log(`  Action ${d.actionId} — ${d.reason} (${d.settledCount}/${d.invoiceCount} invoices settled, contact: ${d.contactId})`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
