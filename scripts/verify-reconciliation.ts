/**
 * Verify invoice amounts against Xero Aged Receivables reference data.
 * Usage: npx tsx scripts/verify-reconciliation.ts
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { readFileSync } from 'fs';

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const tid = '1daf0d80-9be4-4186-87ff-768bbc1950b0';

  const ref = JSON.parse(readFileSync('xero_aged_receivables.json', 'utf8'));

  console.log('═══════════════════════════════════════════════════');
  console.log('  RECONCILIATION CHECK');
  console.log('═══════════════════════════════════════════════════\n');

  // Check invoice count
  const invCount = await pool.query('SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = $1', [tid]);
  const contactCount = await pool.query('SELECT COUNT(*) as cnt FROM contacts WHERE tenant_id = $1 AND is_active = true', [tid]);
  console.log(`DB invoices: ${invCount.rows[0].cnt} (Xero reference: ${ref.totalInvoices})`);
  console.log(`DB contacts: ${contactCount.rows[0].cnt} (Xero reference: ${ref.totalDebtors})`);

  // Check total outstanding (server-side query logic)
  const totalQ = await pool.query(`
    SELECT COALESCE(SUM(
      CASE WHEN LOWER(status) NOT IN ('paid', 'void', 'voided', 'deleted')
      THEN CAST(amount AS numeric) - CAST(amount_paid AS numeric)
      ELSE 0 END
    ), 0) as total
    FROM invoices WHERE tenant_id = $1
  `, [tid]);
  const dbTotal = parseFloat(totalQ.rows[0].total);
  console.log(`\nDB total outstanding: £${dbTotal.toFixed(2)} (Xero reference: £${ref.grandTotal.toFixed(2)})`);
  if (Math.abs(dbTotal - ref.grandTotal) < 1) {
    console.log('✅ MATCH');
  } else {
    console.log(`❌ MISMATCH — diff: £${(dbTotal - ref.grandTotal).toFixed(2)}`);
  }

  // Spot-check specific debtors
  console.log('\n── Spot Checks ──\n');
  const spotChecks = [
    { name: 'Cre8tive Input', expected: 8818.10 },
    { name: 'RBC Capital Markets', expected: 12252.60 },
    { name: 'Mentzendorff', expected: 10804.48 },
  ];

  for (const check of spotChecks) {
    const r = await pool.query(`
      SELECT c.name, c.company_name,
        COALESCE(SUM(CASE WHEN LOWER(i.status) NOT IN ('paid', 'void', 'voided', 'deleted')
          THEN CAST(i.amount AS numeric) - CAST(i.amount_paid AS numeric) ELSE 0 END), 0) as outstanding,
        COUNT(CASE WHEN LOWER(i.status) NOT IN ('paid', 'void', 'voided', 'deleted')
          AND (CAST(i.amount AS numeric) - CAST(i.amount_paid AS numeric)) > 0 THEN 1 END) as inv_count
      FROM contacts c
      LEFT JOIN invoices i ON i.contact_id = c.id AND i.tenant_id = $1
      WHERE c.tenant_id = $1 AND (c.name ILIKE $2 OR c.company_name ILIKE $2)
      GROUP BY c.id, c.name, c.company_name
    `, [tid, `%${check.name}%`]);

    if (r.rows.length === 0) {
      console.log(`  ${check.name}: NOT FOUND in DB`);
    } else {
      for (const row of r.rows) {
        const actual = parseFloat(row.outstanding);
        const match = Math.abs(actual - check.expected) < 1;
        console.log(`  ${row.company_name || row.name}: £${actual.toFixed(2)} (expected £${check.expected.toFixed(2)}) ${match ? '✅' : '❌'} | ${row.inv_count} invoices`);
      }
    }
  }

  // Check a few specific invoices by number
  console.log('\n── Invoice Spot Checks ──\n');
  const sampleInvNums = ['5208285', '5208277', '5208279'];
  const invQ = await pool.query(`
    SELECT invoice_number, amount, amount_paid, status, invoice_status
    FROM invoices WHERE tenant_id = $1 AND invoice_number = ANY($2)
    ORDER BY invoice_number
  `, [tid, sampleInvNums]);

  if (invQ.rows.length === 0) {
    console.log('  No matching invoices found — invoices may not be synced yet');
  } else {
    for (const inv of invQ.rows) {
      console.log(`  ${inv.invoice_number}: amount=£${inv.amount} paid=£${inv.amount_paid} status=${inv.status} xeroStatus=${inv.invoice_status}`);
    }
  }

  await pool.end();
}

main().catch(console.error);
