/**
 * Batch cleanup: remove duplicate contacts using SQL-level batch updates.
 * Invoice duplicates already cleaned. This handles contacts only.
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const tid = "1daf0d80-9be4-4186-87ff-768bbc1950b0";

async function main() {
  // Step 1: Create a temp mapping table of dupe_id → keeper_id
  console.log("Building dupe→keeper mapping...");
  await db.execute(sql`
    CREATE TEMP TABLE contact_dupe_map AS
    SELECT dupes.id as dupe_id, keepers.id as keeper_id
    FROM (
      SELECT id, xero_contact_id, ROW_NUMBER() OVER (PARTITION BY xero_contact_id, tenant_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) as rn
      FROM contacts WHERE tenant_id = ${tid} AND xero_contact_id IS NOT NULL
    ) dupes
    JOIN (
      SELECT id, xero_contact_id, ROW_NUMBER() OVER (PARTITION BY xero_contact_id, tenant_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) as rn
      FROM contacts WHERE tenant_id = ${tid} AND xero_contact_id IS NOT NULL
    ) keepers ON dupes.xero_contact_id = keepers.xero_contact_id AND keepers.rn = 1
    WHERE dupes.rn > 1
  `);

  const mapCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM contact_dupe_map`);
  console.log("Dupe→keeper pairs:", ((mapCount as any).rows || mapCount)[0]?.cnt);

  // Step 2: Batch reassign all FK tables
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

  for (const [table, col] of fkTables) {
    try {
      const result = await db.execute(
        sql.raw(`UPDATE "${table}" t SET "${col}" = m.keeper_id FROM contact_dupe_map m WHERE t."${col}" = m.dupe_id`)
      );
      const count = (result as any).rowCount || 0;
      if (count > 0) console.log(`  ${table}.${col}: ${count} rows reassigned`);
    } catch (e: any) {
      // Unique constraint violations — delete the dupe rows instead of reassigning
      if (e.code === '23505') {
        try {
          await db.execute(
            sql.raw(`DELETE FROM "${table}" t USING contact_dupe_map m WHERE t."${col}" = m.dupe_id`)
          );
          console.log(`  ${table}.${col}: deleted dupe-owned rows (unique constraint)`);
        } catch {
          console.warn(`  ${table}.${col}: cleanup failed`);
        }
      }
    }
  }
  console.log("FK reassignment complete");

  // Step 3: Delete duplicate contacts
  const delResult = await db.execute(sql`
    DELETE FROM contacts WHERE id IN (SELECT dupe_id FROM contact_dupe_map)
  `);
  console.log("Deleted duplicate contacts:", (delResult as any).rowCount);

  // Step 4: Verify
  const contactDupes = await db.execute(sql`SELECT COUNT(*) as cnt FROM (SELECT xero_contact_id FROM contacts WHERE tenant_id = ${tid} AND xero_contact_id IS NOT NULL GROUP BY xero_contact_id HAVING COUNT(*) > 1) x`);
  const invDupes = await db.execute(sql`SELECT COUNT(*) as cnt FROM (SELECT xero_invoice_id FROM invoices WHERE tenant_id = ${tid} AND xero_invoice_id IS NOT NULL GROUP BY xero_invoice_id HAVING COUNT(*) > 1) x`);
  const contactTotal = await db.execute(sql`SELECT COUNT(*) as cnt FROM contacts WHERE tenant_id = ${tid}`);
  const invTotal = await db.execute(sql`SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = ${tid}`);

  console.log("\nAfter cleanup:");
  console.log("  Contact duplicates remaining:", ((contactDupes as any).rows || contactDupes)[0]?.cnt);
  console.log("  Invoice duplicates remaining:", ((invDupes as any).rows || invDupes)[0]?.cnt);
  console.log("  Total contacts:", ((contactTotal as any).rows || contactTotal)[0]?.cnt);
  console.log("  Total invoices:", ((invTotal as any).rows || invTotal)[0]?.cnt);

  await db.execute(sql`DROP TABLE IF EXISTS contact_dupe_map`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
