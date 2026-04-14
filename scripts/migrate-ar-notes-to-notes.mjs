/**
 * One-time migration: copies non-empty arNotes from contacts into the new
 * notes table. Idempotent — skips contacts that already have a system note
 * with trigger='status_change'.
 *
 * Usage: node scripts/migrate-ar-notes-to-notes.mjs
 * Requires DATABASE_URL env var.
 */

import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Find contacts with arNotes that don't already have a migrated note
    const { rows } = await client.query(`
      SELECT c.id, c.tenant_id, c.ar_notes
      FROM contacts c
      WHERE c.ar_notes IS NOT NULL
        AND c.ar_notes != ''
        AND NOT EXISTS (
          SELECT 1 FROM notes n
          WHERE n.contact_id = c.id
            AND n.tenant_id = c.tenant_id
            AND n.source = 'system'
            AND n.trigger = 'status_change'
            AND n.metadata->>'migratedFrom' = 'arNotes'
        )
    `);

    console.log(`Found ${rows.length} contacts with arNotes to migrate`);

    let migrated = 0;
    for (const row of rows) {
      await client.query(
        `INSERT INTO notes (id, tenant_id, contact_id, content, source, trigger, priority, is_read, metadata, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'system', 'status_change', 'normal', true,
                 '{"migratedFrom":"arNotes"}'::jsonb, NOW())`,
        [row.tenant_id, row.id, row.ar_notes]
      );
      migrated++;
    }

    console.log(`Migrated ${migrated} arNotes to notes table`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
