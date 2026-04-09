async function main() {
  const { db } = await import("../server/db");
  const { sql } = await import("drizzle-orm");

  console.log("=== DATUM TENANT ONBOARDING STATE ===");
  const tenantRows = await db.execute(sql`
    SELECT id, name, onboarding_completed, onboarding_completed_at, created_at
    FROM tenants
    WHERE name ILIKE '%datum%'
  `);
  for (const r of tenantRows.rows) console.log(JSON.stringify(r, null, 2));

  console.log("\n=== ONBOARDING_PROGRESS ROWS ===");
  for (const r of tenantRows.rows) {
    const tid = (r as any).id;
    const progress = await db.execute(sql`
      SELECT * FROM onboarding_progress WHERE tenant_id = ${tid}
    `);
    console.log(`tenant ${tid}:`, progress.rows.length, "row(s)");
    for (const p of progress.rows) console.log(JSON.stringify(p, null, 2));
  }

  console.log("\n=== SYNC_SCHEDULE_TIMES COLUMN CHECK ===");
  const col = await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'sync_schedule_times'
  `);
  console.log("sync_schedule_times present:", col.rows.length > 0);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
