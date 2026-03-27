/**
 * Apply multi-currency, multi-language, and LPI schema changes.
 * Run: npx tsx scripts/migrate-multicurrency.ts
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
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

  console.log('Adding multi-currency/multi-language columns...');

  await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_currency varchar`);
  console.log('✓ contacts.preferred_currency');

  await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_language varchar`);
  console.log('✓ contacts.preferred_language');

  await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_language varchar DEFAULT 'en-GB'`);
  console.log('✓ tenants.default_language');

  await client.query(`ALTER TABLE agent_personas ADD COLUMN IF NOT EXISTS default_language varchar DEFAULT 'en-GB'`);
  console.log('✓ agent_personas.default_language');

  console.log('\nAdding LPI columns...');

  await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lpi_enabled boolean DEFAULT true`);
  console.log('✓ contacts.lpi_enabled');

  await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lpi_grace_period_days integer DEFAULT 7`);
  console.log('✓ contacts.lpi_grace_period_days');

  client.release();
  console.log('\nMulti-currency/multi-language + LPI schema applied successfully.');
} catch (err: any) {
  console.error('Migration error:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
