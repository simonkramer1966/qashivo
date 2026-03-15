/**
 * Clean Slate: Wipe all synced data for a tenant so a fresh first-connect sync can run.
 * Usage: npx @railway/cli run npx tsx scripts/clean-slate.ts
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const TENANT_ID = '1daf0d80-9be4-4186-87ff-768bbc1950b0';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Show current state
    const before = await Promise.all([
      client.query('SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = $1', [TENANT_ID]),
      client.query('SELECT COUNT(*) as cnt FROM contacts WHERE tenant_id = $1', [TENANT_ID]),
      client.query('SELECT COUNT(*) as cnt FROM cached_xero_invoices WHERE tenant_id = $1', [TENANT_ID]),
      client.query("SELECT COUNT(*) as cnt FROM cached_xero_contacts WHERE tenant_id = $1", [TENANT_ID]).catch(() => ({ rows: [{ cnt: 'table missing' }] })),
      client.query("SELECT COUNT(*) as cnt FROM sync_state WHERE tenant_id = $1 AND provider = 'xero'", [TENANT_ID]),
    ]);

    console.log('═══ BEFORE CLEAN SLATE ═══');
    console.log(`  invoices:              ${before[0].rows[0].cnt}`);
    console.log(`  contacts:              ${before[1].rows[0].cnt}`);
    console.log(`  cached_xero_invoices:  ${before[2].rows[0].cnt}`);
    console.log(`  cached_xero_contacts:  ${before[3].rows[0].cnt}`);
    console.log(`  sync_state (xero):     ${before[4].rows[0].cnt}`);

    console.log('\n🧹 Clearing tenant data in FK-safe order...');
    await client.query('BEGIN');

    // FK-safe deletion order: children first, then parents
    const tables = [
      'message_drafts', 'compliance_checks', 'action_logs', 'action_items',
      'attention_items', 'activity_logs', 'outcomes', 'payment_promises',
      'invoice_health_scores', 'wallet_transactions', 'finance_advances',
      'risk_scores', 'action_effectiveness', 'customer_learning_profiles',
      'customer_schedule_assignments', 'email_domain_mappings', 'email_sender_mappings',
      'magic_link_tokens', 'customer_preferences', 'debtor_profiles',
      'customer_behavior_signals', 'user_contact_assignments', 'customer_contact_persons',
      'contact_notes',
      'workflow_timers', 'timeline_events', 'email_messages', 'email_clarifications',
      'inbound_messages', 'contact_outcomes', 'policy_decisions', 'voice_calls',
      'sms_messages', 'interest_ledger', 'disputes', 'promises_to_pay',
      'debtor_payments', 'conversations',
      'actions',
      'payment_plan_invoices',
      'payment_plans',
      'bank_transactions', 'bank_accounts', 'bills',
      'cached_xero_invoices', 'cached_xero_contacts', 'invoices', 'contacts',
    ];

    for (const table of tables) {
      try {
        if (table === 'payment_plan_invoices') {
          const r = await client.query(
            `DELETE FROM payment_plan_invoices WHERE payment_plan_id IN (SELECT id FROM payment_plans WHERE tenant_id = $1)`,
            [TENANT_ID]
          );
          console.log(`  ${table}: ${r.rowCount} deleted`);
        } else {
          const r = await client.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [TENANT_ID]);
          if (r.rowCount && r.rowCount > 0) {
            console.log(`  ${table}: ${r.rowCount} deleted`);
          }
        }
      } catch (err: any) {
        if (err.code === '42P01') {
          // Table doesn't exist — skip silently
        } else {
          console.warn(`  ⚠️  ${table}: ${err.message}`);
          // Abort and rollback on real errors
          await client.query('ROLLBACK');
          console.error('\n❌ Transaction rolled back due to error above.');
          await pool.end();
          process.exit(1);
        }
      }
    }

    // Clear sync state
    await client.query(`DELETE FROM sync_state WHERE tenant_id = $1 AND provider = 'xero'`, [TENANT_ID]);
    console.log('  sync_state (xero): cleared');

    // Clear xeroLastSyncAt on tenant
    await client.query(`UPDATE tenants SET xero_last_sync_at = NULL WHERE id = $1`, [TENANT_ID]);
    console.log('  tenants.xero_last_sync_at: cleared');

    await client.query('COMMIT');

    console.log('\n✅ CLEAN SLATE COMPLETE');
    console.log('   Next step: Hit "Sync Now" in the UI to run a fresh initial sync.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
