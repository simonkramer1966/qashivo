async function main() {
  const { db } = await import("../server/db");
  const { sql } = await import("drizzle-orm");

  const tenantId = "1daf0d80-9be4-4186-87ff-768bbc1950b0";

  console.log("=== RECENT ACTIONS ===");
  const actionRows = await db.execute(sql`
    SELECT id, type, status, delivery_status, subject, created_at, updated_at
    FROM actions
    WHERE tenant_id = ${tenantId}
    ORDER BY updated_at DESC
    LIMIT 10
  `);
  for (const r of actionRows.rows) {
    console.log(JSON.stringify(r));
  }

  console.log("\n=== RECENT COMPLIANCE CHECKS ===");
  const checkRows = await db.execute(sql`
    SELECT id, tenant_id, action_id, contact_id, check_result, violations, rules_checked, created_at
    FROM compliance_checks
    ORDER BY created_at DESC
    LIMIT 5
  `);
  for (const r of checkRows.rows) {
    console.log(JSON.stringify(r));
  }

  process.exit(0);
}
main();
