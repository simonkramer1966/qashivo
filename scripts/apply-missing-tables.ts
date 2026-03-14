/**
 * Apply missing MVP v1 tables and columns to the production database.
 *
 * Creates (if not exists):
 *   - agent_personas
 *   - compliance_checks
 *   - dso_snapshots
 *   - open_banking_connections
 *
 * Adds columns (if not exists) to users:
 *   - clerk_id (varchar, unique)
 *
 * Adds columns (if not exists) to actions:
 *   - agent_reasoning, agent_tone_level, agent_channel, compliance_result
 *
 * Run: npx tsx scripts/apply-missing-tables.ts
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Load .env if DATABASE_URL not already set
if (!process.env.DATABASE_URL) {
  const fs = await import("fs");
  try {
    const envContent = fs.readFileSync(".env", "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^([^#\s][^=]*)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  } catch {
    console.error("No .env file found and DATABASE_URL not set");
    process.exit(1);
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const client = await pool.connect();

  // ── 1. agent_personas ─────────────────────────────────────
  console.log("1/7  Creating agent_personas table...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS agent_personas (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
      persona_name VARCHAR NOT NULL,
      job_title VARCHAR NOT NULL,
      email_signature_name VARCHAR NOT NULL,
      email_signature_title VARCHAR NOT NULL,
      email_signature_company VARCHAR NOT NULL,
      email_signature_phone VARCHAR,
      tone_default VARCHAR NOT NULL DEFAULT 'professional',
      voice_characteristics JSONB,
      company_context TEXT,
      sector_context VARCHAR DEFAULT 'general',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_agent_personas_tenant_id
      ON agent_personas (tenant_id);
  `);
  console.log("     ✓ agent_personas ready");

  // ── 2. compliance_checks ──────────────────────────────────
  console.log("2/7  Creating compliance_checks table...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS compliance_checks (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
      action_id VARCHAR REFERENCES actions(id),
      contact_id VARCHAR REFERENCES contacts(id),
      check_result VARCHAR NOT NULL,
      rules_checked JSONB NOT NULL,
      violations JSONB,
      agent_reasoning TEXT,
      reviewed_by VARCHAR REFERENCES users(id),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_compliance_checks_tenant_id
      ON compliance_checks (tenant_id);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_compliance_checks_action_id
      ON compliance_checks (action_id);
  `);
  console.log("     ✓ compliance_checks ready");

  // ── 3. dso_snapshots ──────────────────────────────────────
  console.log("3/7  Creating dso_snapshots table...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS dso_snapshots (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
      snapshot_date TIMESTAMP NOT NULL,
      dso_value DECIMAL NOT NULL,
      total_receivables DECIMAL NOT NULL,
      total_revenue_90d DECIMAL NOT NULL,
      overdue_amount DECIMAL NOT NULL,
      overdue_percentage DECIMAL NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_dso_snapshots_tenant_date
      ON dso_snapshots (tenant_id, snapshot_date);
  `);
  console.log("     ✓ dso_snapshots ready");

  // ── 4. open_banking_connections ────────────────────────────
  console.log("4/7  Creating open_banking_connections table...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS open_banking_connections (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
      provider VARCHAR NOT NULL,
      consent_id VARCHAR NOT NULL,
      consent_status VARCHAR NOT NULL DEFAULT 'active',
      account_ids JSONB,
      last_sync_at TIMESTAMP,
      consent_expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_open_banking_connections_tenant_id
      ON open_banking_connections (tenant_id);
  `);
  console.log("     ✓ open_banking_connections ready");

  // ── 5. users table — add clerk_id column ─────────────────
  console.log("5/7  Adding clerk_id column to users...");
  await client.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS clerk_id VARCHAR UNIQUE;
  `);
  console.log("     ✓ users.clerk_id");

  // ── 6. actions table — add missing columns ────────────────
  console.log("6/7  Adding missing columns to actions...");
  const cols = [
    { name: "agent_reasoning", type: "TEXT" },
    { name: "agent_tone_level", type: "VARCHAR" },
    { name: "agent_channel", type: "VARCHAR" },
    { name: "compliance_result", type: "VARCHAR" },
  ];
  for (const col of cols) {
    await client.query(`
      ALTER TABLE actions
        ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};
    `);
    console.log(`     ✓ actions.${col.name}`);
  }

  // ── 7. Verify ──────────────────────────────────────────────
  console.log("\n7/7  Verifying...");
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'agent_personas',
        'compliance_checks',
        'dso_snapshots',
        'open_banking_connections'
      )
    ORDER BY table_name;
  `);
  console.log(
    `Found ${rows.length}/4 tables:`,
    rows.map((r: any) => r.table_name).join(", ")
  );

  const { rows: userCols } = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'clerk_id'
  `);
  console.log(
    `users.clerk_id: ${userCols.length > 0 ? '✓ exists' : '✗ MISSING'}`
  );

  const { rows: actionCols } = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'actions'
      AND column_name IN ('agent_reasoning', 'agent_tone_level', 'agent_channel', 'compliance_result')
    ORDER BY column_name;
  `);
  console.log(
    `Found ${actionCols.length}/4 action columns:`,
    actionCols.map((r: any) => r.column_name).join(", ")
  );

  client.release();
  console.log("\nDone. All tables and columns applied.");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await pool.end();
}
