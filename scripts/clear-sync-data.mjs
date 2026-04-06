import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_MLQo0mRi4bCe@ep-square-heart-aebh1vs6.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

// Phase 1: Find all FK dependencies from the live database, then delete in safe order
async function findFKDependents(tableName) {
  const rows = await sql(`
    SELECT DISTINCT tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = $1
      AND tc.table_schema = 'public'
  `, [tableName]);
  return rows.map(r => r.table_name);
}

// Build the full deletion order dynamically
async function buildDeletionOrder() {
  // Start with the root tables we want to clear
  const roots = ["contacts", "invoices", "actions"];
  const toClear = new Set();
  const visited = new Set();

  // BFS: find all tables that depend on our roots (recursively)
  const queue = [...roots];
  while (queue.length > 0) {
    const table = queue.shift();
    if (visited.has(table)) continue;
    visited.add(table);
    toClear.add(table);

    const dependents = await findFKDependents(table);
    for (const dep of dependents) {
      if (!visited.has(dep)) {
        queue.push(dep);
      }
    }
  }

  // Also add these isolated tables we want cleared
  const extras = [
    "forecast_user_adjustments", "riley_conversations", "ai_facts",
    "weekly_reviews", "cached_xero_invoices", "cached_xero_contacts",
    "cached_xero_overpayments", "cached_xero_prepayments",
    "cached_xero_credit_notes", "sync_state",
  ];
  for (const t of extras) toClear.add(t);

  // Never delete these
  const preserve = new Set([
    "tenants", "users", "collection_schedules", "workflows",
    "workflow_nodes", "workflow_connections", "workflow_templates",
    "debtor_groups", "agent_personas", "permissions", "role_permissions",
    "email_senders", "email_domain_mappings", "email_sender_mappings",
    "provider_connections", "scheduler_state", "channel_analytics",
    "communication_templates", "global_templates", "tenant_templates",
    "escalation_rules", "onboarding_progress", "collection_ab_tests",
    "subscription_plans", "partner_client_relationships", "tenant_invitations",
    "tenant_metadata", "partners", "sme_clients", "import_jobs",
    "sme_contacts", "sme_invite_tokens", "partner_prospects",
    "partner_scorecard_submissions", "partner_scorecard_answers",
    "magic_link_tokens", "quiz_leads", "quiz_conversations", "demo_calls",
    "investor_leads", "investment_call_requests", "partner_waitlist",
    "scheduled_reports", "collection_policies", "dso_snapshots",
    "webhook_events", "budget_line_items",
  ]);

  // Remove preserved tables
  for (const p of preserve) toClear.delete(p);

  // Topological sort: delete leaves first
  // Simple approach: try to delete each table, retry failures
  return Array.from(toClear);
}

async function main() {
  console.log("Building deletion order from live FK graph...\n");
  let tables = await buildDeletionOrder();
  console.log(`Found ${tables.length} tables to clear.\n`);

  // Retry loop: keep trying to delete tables until all are empty
  // This handles FK ordering automatically
  let maxPasses = 10;
  let pass = 0;
  const cleared = new Set();

  while (tables.length > 0 && pass < maxPasses) {
    pass++;
    const failed = [];

    for (const table of tables) {
      if (cleared.has(table)) continue;
      try {
        await sql(`DELETE FROM "${table}"`);
        console.log(`OK  ${table}`);
        cleared.add(table);
      } catch (err) {
        if (err.message.includes("foreign key constraint") || err.message.includes("violates")) {
          failed.push(table);
        } else if (err.message.includes("does not exist")) {
          console.log(`SKIP  ${table} (does not exist)`);
          cleared.add(table);
        } else {
          console.error(`FAIL  ${table}: ${err.message}`);
          failed.push(table);
        }
      }
    }

    tables = failed;
    if (failed.length > 0 && pass < maxPasses) {
      console.log(`\n--- Pass ${pass} done, ${failed.length} tables need retry: ${failed.join(", ")} ---\n`);
    }
  }

  if (tables.length > 0) {
    console.error(`\nFAILED to clear ${tables.length} tables after ${maxPasses} passes: ${tables.join(", ")}`);
    process.exit(1);
  }

  // Reset sync cursor
  console.log("\nResetting sync timestamps...");
  await sql("UPDATE tenants SET xero_last_sync_at = NULL");
  console.log("OK  tenants.xero_last_sync_at = NULL");

  console.log(`\nAll ${cleared.size} tables cleared. Database ready for fresh sync.`);
}

main();
