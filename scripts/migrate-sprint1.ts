/**
 * Apply Sprint 1 schema changes (agent_personas + compliance_checks tables).
 * Run: npx tsx scripts/migrate-sprint1.ts
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // Load from .env manually
  const fs = await import('fs');
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const client = await pool.connect();

  console.log('Creating agent_personas table...');
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
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);
  console.log('✓ agent_personas');

  console.log('Creating compliance_checks table...');
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
      created_at TIMESTAMP DEFAULT now()
    )
  `);
  console.log('✓ compliance_checks');

  client.release();
  console.log('\nSprint 1 schema applied successfully.');
} catch (err: any) {
  console.error('Migration error:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
