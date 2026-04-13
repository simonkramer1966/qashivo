/**
 * One-time cleanup: remove duplicate invoices and contacts created by repeated syncs.
 * Keeps the most recently updated row per xero_invoice_id / xero_contact_id.
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const tid = "1daf0d80-9be4-4186-87ff-768bbc1950b0";

async function main() {
  // ── 1. Check current state ──
  const invDupesBefore = await db.execute(sql`SELECT COUNT(*) as cnt FROM (SELECT xero_invoice_id FROM invoices WHERE tenant_id = ${tid} AND xero_invoice_id IS NOT NULL GROUP BY xero_invoice_id HAVING COUNT(*) > 1) x`);
  const contactDupesBefore = await db.execute(sql`SELECT COUNT(*) as cnt FROM (SELECT xero_contact_id FROM contacts WHERE tenant_id = ${tid} AND xero_contact_id IS NOT NULL GROUP BY xero_contact_id HAVING COUNT(*) > 1) x`);
  console.log("Before cleanup:");
  console.log("  Invoice duplicate groups:", ((invDupesBefore as any).rows || invDupesBefore)[0]?.cnt);
  console.log("  Contact duplicate groups:", ((contactDupesBefore as any).rows || contactDupesBefore)[0]?.cnt);

  // ── 2. Delete duplicate invoices (keep latest updated_at) ──
  const invResult = await db.execute(sql`
    DELETE FROM invoices WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY xero_invoice_id, tenant_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) as rn
        FROM invoices WHERE tenant_id = ${tid} AND xero_invoice_id IS NOT NULL
      ) ranked WHERE rn > 1
    )`);
  console.log("\nDeleted duplicate invoices:", (invResult as any).rowCount);

  // ── 3. Build keeper map for contacts ──
  const keepers = await db.execute(sql`
    SELECT id, xero_contact_id FROM (
      SELECT id, xero_contact_id, ROW_NUMBER() OVER (PARTITION BY xero_contact_id, tenant_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) as rn
      FROM contacts WHERE tenant_id = ${tid} AND xero_contact_id IS NOT NULL
    ) ranked WHERE rn = 1`);
  const keeperMap = new Map<string, string>();
  for (const k of ((keepers as any).rows || keepers) as any[]) {
    keeperMap.set(k.xero_contact_id, k.id);
  }

  const dupes = await db.execute(sql`
    SELECT id, xero_contact_id FROM (
      SELECT id, xero_contact_id, ROW_NUMBER() OVER (PARTITION BY xero_contact_id, tenant_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) as rn
      FROM contacts WHERE tenant_id = ${tid} AND xero_contact_id IS NOT NULL
    ) ranked WHERE rn > 1`);
  const dupeRows = ((dupes as any).rows || dupes) as any[];
  console.log("Contact duplicates to merge:", dupeRows.length);

  // ── 4. Reassign FK references ──
  const fkTables: [string, string][] = [
    ["invoices", "contact_id"],
    ["actions", "contact_id"],
    ["contact_notes", "contact_id"],
    ["timeline_events", "customer_id"],
    ["activity_logs", "debtor_id"],
    ["outcomes", "debtor_id"],
    ["bills", "vendor_id"],
    ["attention_items", "contact_id"],
    ["customer_schedule_assignments", "contact_id"],
    ["customer_learning_profiles", "contact_id"],
    ["customer_behavior_signals", "contact_id"],
    ["contact_outcomes", "contact_id"],
    ["disputes", "contact_id"],
    ["email_messages", "contact_id"],
    ["inbound_messages", "contact_id"],
    ["sms_messages", "contact_id"],
    ["voice_calls", "contact_id"],
    ["payment_promises", "contact_id"],
    ["promises_to_pay", "contact_id"],
    ["payment_plans", "contact_id"],
    ["user_contact_assignments", "contact_id"],
    ["customer_contact_persons", "contact_id"],
    ["compliance_checks", "contact_id"],
    ["action_items", "contact_id"],
    ["action_effectiveness", "contact_id"],
    ["bank_transactions", "contact_id"],
    ["conversations", "contact_id"],
    ["customer_preferences", "contact_id"],
    ["debtor_payments", "contact_id"],
    ["debtor_profiles", "contact_id"],
    ["email_clarifications", "contact_id"],
    ["email_domain_mappings", "contact_id"],
    ["email_sender_mappings", "contact_id"],
    ["finance_advances", "contact_id"],
    ["invoice_health_scores", "contact_id"],
    ["magic_link_tokens", "contact_id"],
    ["policy_decisions", "contact_id"],
    ["rejection_patterns", "contact_id"],
    ["risk_scores", "contact_id"],
    ["wallet_transactions", "contact_id"],
    ["workflow_timers", "contact_id"],
  ];

  for (const dupeRow of dupeRows) {
    const keeperId = keeperMap.get(dupeRow.xero_contact_id);
    if (!keeperId) continue;

    for (const [table, col] of fkTables) {
      try {
        await db.execute(
          sql.raw(`UPDATE "${table}" SET "${col}" = '${keeperId}' WHERE "${col}" = '${dupeRow.id}'`)
        );
      } catch {
        // Ignore — table might not have rows for this contact, or unique constraint
      }
    }
  }
  console.log("FK reassignment complete");

  // ── 5. Delete duplicate contacts ──
  const contactResult = await db.execute(sql`
    DELETE FROM contacts WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY xero_contact_id, tenant_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) as rn
        FROM contacts WHERE tenant_id = ${tid} AND xero_contact_id IS NOT NULL
      ) ranked WHERE rn > 1
    )`);
  console.log("Deleted duplicate contacts:", (contactResult as any).rowCount);

  // ── 6. Verify ──
  const invDupesAfter = await db.execute(sql`SELECT COUNT(*) as cnt FROM (SELECT xero_invoice_id FROM invoices WHERE tenant_id = ${tid} AND xero_invoice_id IS NOT NULL GROUP BY xero_invoice_id HAVING COUNT(*) > 1) x`);
  const contactDupesAfter = await db.execute(sql`SELECT COUNT(*) as cnt FROM (SELECT xero_contact_id FROM contacts WHERE tenant_id = ${tid} AND xero_contact_id IS NOT NULL GROUP BY xero_contact_id HAVING COUNT(*) > 1) x`);
  const invCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = ${tid}`);
  const contactCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM contacts WHERE tenant_id = ${tid}`);

  console.log("\nAfter cleanup:");
  console.log("  Invoice duplicate groups:", ((invDupesAfter as any).rows || invDupesAfter)[0]?.cnt);
  console.log("  Contact duplicate groups:", ((contactDupesAfter as any).rows || contactDupesAfter)[0]?.cnt);
  console.log("  Total invoices:", ((invCount as any).rows || invCount)[0]?.cnt);
  console.log("  Total contacts:", ((contactCount as any).rows || contactCount)[0]?.cnt);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
