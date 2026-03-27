/**
 * Verify multi-currency migration columns exist.
 * Run: npx tsx scripts/verify-multicurrency.ts
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  const fs = await import('fs');
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const checks = [
  { table: 'contacts', column: 'preferred_currency' },
  { table: 'contacts', column: 'preferred_language' },
  { table: 'tenants', column: 'default_language' },
  { table: 'agent_personas', column: 'default_language' },
  { table: 'contacts', column: 'lpi_enabled' },
  { table: 'contacts', column: 'lpi_grace_period_days' },
];

for (const { table, column } of checks) {
  const res = await client.query(
    `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  if (res.rows.length > 0) {
    const r = res.rows[0];
    console.log('✓', table + '.' + column, '(' + r.data_type + (r.column_default ? ', default: ' + r.column_default : '') + ')');
  } else {
    console.log('✗ MISSING:', table + '.' + column);
  }
}

client.release();
await pool.end();
