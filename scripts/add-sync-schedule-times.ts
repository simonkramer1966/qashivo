async function main() {
  const { db } = await import("../server/db");
  const { sql } = await import("drizzle-orm");

  console.log("Adding sync_schedule_times column...");
  await db.execute(sql`
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS sync_schedule_times text[]
    DEFAULT ARRAY['07:00','13:00']::text[]
  `);

  const check = await db.execute(sql`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'sync_schedule_times'
  `);
  console.log("Column state:", JSON.stringify(check.rows, null, 2));

  // Verify Datum tenant is readable
  const datum = await db.execute(sql`
    SELECT id, name, onboarding_completed, sync_schedule_times
    FROM tenants WHERE name ILIKE '%datum%'
  `);
  console.log("Datum tenant:", JSON.stringify(datum.rows, null, 2));

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
