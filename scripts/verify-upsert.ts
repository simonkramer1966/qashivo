/**
 * Verify that processCachedInvoices correctly upserts (updates existing invoices).
 * Simulates: invoice synced as OPEN → Xero marks it PAID → re-sync updates it.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });
  const tid = '1daf0d80-9be4-4186-87ff-768bbc1950b0';
  const testXeroId = '__TEST_UPSERT_VERIFY__';

  // Get a real contact
  const [contact] = await db.select().from(schema.contacts)
    .where(and(eq(schema.contacts.tenantId, tid), eq(schema.contacts.isActive, true)))
    .limit(1);

  console.log('═══ UPSERT VERIFICATION ═══\n');

  // Step 1: Insert an OPEN invoice (simulating first sync)
  console.log('Step 1: Insert OPEN invoice...');
  await db.insert(schema.invoices).values({
    tenantId: tid,
    contactId: contact.id,
    xeroInvoiceId: testXeroId,
    invoiceNumber: 'TEST-UPSERT-001',
    amount: '5000.00',
    amountPaid: '0.00',
    taxAmount: '0.00',
    status: 'overdue',
    invoiceStatus: 'OPEN',
    issueDate: new Date('2025-01-01'),
    dueDate: new Date('2025-02-01'),
    currency: 'GBP',
  });

  const [before] = await db.select({ status: schema.invoices.status, invoiceStatus: schema.invoices.invoiceStatus, amountPaid: schema.invoices.amountPaid })
    .from(schema.invoices).where(eq(schema.invoices.xeroInvoiceId, testXeroId));
  console.log(`  Before: status=${before.status}, invoiceStatus=${before.invoiceStatus}, amountPaid=${before.amountPaid}`);

  // Step 2: Insert a cached invoice with PAID status (simulating Xero returning updated data)
  console.log('\nStep 2: Cache invoice as PAID...');
  await db.insert(schema.cachedXeroInvoices).values({
    tenantId: tid,
    xeroInvoiceId: testXeroId,
    invoiceNumber: 'TEST-UPSERT-001',
    amount: '5000.00',
    amountPaid: '5000.00',
    taxAmount: '0.00',
    status: 'paid',
    issueDate: new Date('2025-01-01'),
    dueDate: new Date('2025-02-01'),
    paidDate: new Date('2025-12-24'),
    currency: 'GBP',
    contact: { ContactID: contact.xeroContactId, Name: contact.name },
    metadata: { xeroStatus: 'PAID' },
  });

  // Step 3: Run processCachedInvoices (initial mode — should still upsert now)
  console.log('\nStep 3: Run processCachedInvoices (initial mode)...');
  const { XeroSyncService } = await import('../server/services/xeroSync.js');
  const service = new XeroSyncService();
  const count = await service.processCachedInvoices(tid, 'initial');
  console.log(`  Processed: ${count}`);

  // Step 4: Check the invoice was UPDATED (not duplicated)
  const after = await db.select({
    status: schema.invoices.status,
    invoiceStatus: schema.invoices.invoiceStatus,
    amountPaid: schema.invoices.amountPaid,
    paidDate: schema.invoices.paidDate,
  }).from(schema.invoices).where(eq(schema.invoices.xeroInvoiceId, testXeroId));

  console.log(`\nStep 4: Check result (${after.length} rows with this xeroInvoiceId):`);
  for (const row of after) {
    console.log(`  status=${row.status}, invoiceStatus=${row.invoiceStatus}, amountPaid=${row.amountPaid}, paidDate=${row.paidDate}`);
  }

  if (after.length === 1 && after[0].status === 'paid' && after[0].invoiceStatus === 'PAID' && after[0].amountPaid === '5000.00') {
    console.log('\n✅ UPSERT WORKS: Invoice updated from OPEN → PAID, no duplicates');
  } else if (after.length > 1) {
    console.log('\n❌ DUPLICATE: Multiple rows created instead of upsert');
  } else {
    console.log('\n❌ STATUS NOT UPDATED');
  }

  // Clean up
  console.log('\nCleaning up...');
  await db.delete(schema.invoices).where(eq(schema.invoices.xeroInvoiceId, testXeroId));
  await db.delete(schema.cachedXeroInvoices).where(eq(schema.cachedXeroInvoices.xeroInvoiceId, testXeroId));
  console.log('Done');

  await pool.end();
}

main().catch(console.error);
