/**
 * Verify that processCachedInvoices correctly writes to the invoices table.
 * Inserts a test cached invoice, runs processCachedInvoices, checks result.
 * Cleans up test data after.
 *
 * Usage: npx tsx scripts/verify-sync-fix.ts
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function verify() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const tid = '1daf0d80-9be4-4186-87ff-768bbc1950b0';
  const testXeroId = '__TEST_VERIFY_SYNC_FIX__';

  try {
    console.log('═══════════════════════════════════════════════════');
    console.log('  VERIFY SYNC FIX: processCachedInvoices');
    console.log('═══════════════════════════════════════════════════\n');

    // Get a real contact to use
    const contactRes = await pool.query(
      "SELECT id, xero_contact_id, name FROM contacts WHERE tenant_id = $1 AND xero_contact_id IS NOT NULL LIMIT 1",
      [tid]
    );
    if (contactRes.rows.length === 0) {
      console.log('ERROR: No contacts with xero_contact_id found');
      return;
    }
    const contact = contactRes.rows[0];
    console.log(`Using contact: ${contact.name} (${contact.id})`);
    console.log(`  xero_contact_id: ${contact.xero_contact_id}\n`);

    // Count invoices before
    const beforeCount = await pool.query("SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = $1", [tid]);
    console.log(`Invoices BEFORE: ${beforeCount.rows[0].cnt}`);

    // Insert a test cached invoice
    console.log('\nInserting test cached invoice...');
    await pool.query(`
      INSERT INTO cached_xero_invoices (tenant_id, xero_invoice_id, invoice_number, amount, amount_paid, tax_amount, status, issue_date, due_date, description, currency, contact, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      tid, testXeroId, 'TEST-VERIFY-001', '1500.00', '500.00', '300.00',
      'unpaid', new Date('2025-06-01'), new Date('2025-07-01'),
      'Test verification invoice', 'GBP',
      JSON.stringify({ ContactID: contact.xero_contact_id, Name: contact.name }),
      JSON.stringify({ xeroStatus: 'AUTHORISED' }),
    ]);
    console.log('  ✅ Cached invoice inserted');

    const cachedCount = await pool.query("SELECT COUNT(*) as cnt FROM cached_xero_invoices WHERE tenant_id = $1", [tid]);
    console.log(`  cached_xero_invoices count: ${cachedCount.rows[0].cnt}`);

    // Now run processCachedInvoices via the actual XeroSyncService
    console.log('\nRunning processCachedInvoices (initial mode)...');

    // We need to import the actual service — but it imports db.ts which uses DATABASE_URL
    const { XeroSyncService } = await import('../server/services/xeroSync.js');
    const service = new XeroSyncService();
    const processedCount = await service.processCachedInvoices(tid, 'initial');

    console.log(`  processCachedInvoices returned: ${processedCount}`);

    // Check invoices after
    const afterCount = await pool.query("SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = $1", [tid]);
    console.log(`\nInvoices AFTER: ${afterCount.rows[0].cnt}`);

    // Check the specific test invoice
    const testInvoice = await pool.query(
      "SELECT id, invoice_number, amount, amount_paid, status, invoice_status, contact_id FROM invoices WHERE xero_invoice_id = $1 AND tenant_id = $2",
      [testXeroId, tid]
    );

    if (testInvoice.rows.length > 0) {
      const inv = testInvoice.rows[0];
      console.log(`\n✅ TEST PASSED: Invoice written to main table`);
      console.log(`  id: ${inv.id}`);
      console.log(`  invoice_number: ${inv.invoice_number}`);
      console.log(`  amount: ${inv.amount}, amount_paid: ${inv.amount_paid}`);
      console.log(`  status: ${inv.status}, invoice_status: ${inv.invoice_status}`);
      console.log(`  contact_id: ${inv.contact_id}`);
    } else {
      console.log('\n❌ TEST FAILED: Invoice NOT in main table');
      console.log('   processCachedInvoices silently failed to insert');
    }

    // Clean up test data
    console.log('\nCleaning up test data...');
    await pool.query("DELETE FROM invoices WHERE xero_invoice_id = $1 AND tenant_id = $2", [testXeroId, tid]);
    await pool.query("DELETE FROM cached_xero_invoices WHERE xero_invoice_id = $1 AND tenant_id = $2", [testXeroId, tid]);
    console.log('  ✅ Cleaned up');

  } finally {
    await pool.end();
  }
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
