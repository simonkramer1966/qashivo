/**
 * Xero Sync Diagnostic Script
 *
 * Connects to production DATABASE_URL and traces why invoices
 * are not appearing in the main invoices table after Xero sync.
 *
 * Usage: npx tsx scripts/diagnose-xero-sync.ts
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function diagnose() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    console.log('═══════════════════════════════════════════════════');
    console.log('  XERO SYNC DIAGNOSTIC');
    console.log('═══════════════════════════════════════════════════\n');

    // ── 1. Row counts ─────────────────────────────────────────────
    console.log('── Step 1: Table row counts ──────────────────────\n');

    const tenants = await pool.query('SELECT id, name, xero_tenant_id, xero_last_sync_at FROM tenants');
    console.log(`  tenants:              ${tenants.rows.length}`);
    for (const t of tenants.rows) {
      console.log(`    - ${t.id} | ${t.name} | xero_tenant=${t.xero_tenant_id ? 'YES' : 'NO'} | last_sync=${t.xero_last_sync_at || 'never'}`);
    }

    // Find the active tenant (one with xero connected)
    const activeTenant = tenants.rows.find(t => t.xero_tenant_id) || tenants.rows[0];
    if (!activeTenant) {
      console.error('\nFATAL: No tenants found in database');
      return;
    }
    const tid = activeTenant.id;
    console.log(`\n  Active tenant: ${tid} (${activeTenant.name})\n`);

    const contactCount = await pool.query('SELECT COUNT(*) as cnt FROM contacts WHERE tenant_id = $1', [tid]);
    const invoiceCount = await pool.query('SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = $1', [tid]);
    const cachedCount = await pool.query('SELECT COUNT(*) as cnt FROM cached_xero_invoices WHERE tenant_id = $1', [tid]);

    const nContacts = parseInt(contactCount.rows[0].cnt);
    const nInvoices = parseInt(invoiceCount.rows[0].cnt);
    const nCached = parseInt(cachedCount.rows[0].cnt);

    console.log(`  contacts:             ${nContacts}`);
    console.log(`  invoices:             ${nInvoices}`);
    console.log(`  cached_xero_invoices: ${nCached}`);

    // ── 2. Check actual DB columns vs what code expects ───────────
    console.log('\n── Step 2: Schema column check ────────────────────\n');

    const invoiceCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'invoices'
      ORDER BY ordinal_position
    `);
    const colNames = invoiceCols.rows.map(r => r.column_name);
    console.log(`  invoices table has ${colNames.length} columns:`);
    console.log(`    ${colNames.join(', ')}\n`);

    // Fields the sync code tries to insert
    const syncFields = [
      'tenant_id', 'contact_id', 'xero_invoice_id', 'invoice_number',
      'amount', 'amount_paid', 'tax_amount', 'status', 'invoice_status',
      'issue_date', 'due_date', 'paid_date', 'description', 'currency',
    ];

    const missingCols: string[] = [];
    for (const field of syncFields) {
      const exists = colNames.includes(field);
      if (!exists) {
        missingCols.push(field);
        console.log(`  ❌ MISSING COLUMN: "${field}" — sync code tries to insert this but it doesn't exist in DB`);
      }
    }
    if (missingCols.length === 0) {
      console.log('  ✅ All sync fields exist in the invoices table');
    }

    // ── 3. Check cached invoice data quality ──────────────────────
    console.log('\n── Step 3: Cached invoice data sample ─────────────\n');

    if (nCached > 0) {
      const sample = await pool.query(`
        SELECT xero_invoice_id, invoice_number, amount, amount_paid, status,
               contact::text as contact_raw, metadata::text as metadata_raw
        FROM cached_xero_invoices
        WHERE tenant_id = $1
        LIMIT 3
      `, [tid]);

      for (const inv of sample.rows) {
        console.log(`  Invoice: ${inv.invoice_number}`);
        console.log(`    xero_invoice_id: ${inv.xero_invoice_id}`);
        console.log(`    amount: ${inv.amount}, amount_paid: ${inv.amount_paid}, status: ${inv.status}`);

        // Check if contact has ContactID
        try {
          const contactData = JSON.parse(inv.contact_raw || '{}');
          console.log(`    contact.ContactID: ${contactData.ContactID || 'MISSING'}`);
          console.log(`    contact.Name: ${contactData.Name || 'MISSING'}`);
        } catch {
          console.log(`    contact: UNPARSEABLE — ${inv.contact_raw?.substring(0, 80)}`);
        }

        // Check metadata for xeroStatus
        try {
          const meta = JSON.parse(inv.metadata_raw || '{}');
          console.log(`    metadata.xeroStatus: ${meta.xeroStatus || 'MISSING'}`);
        } catch {
          console.log(`    metadata: UNPARSEABLE`);
        }
        console.log('');
      }
    } else {
      console.log('  (no cached invoices — Xero API fetch may have failed)');
    }

    // ── 4. Check contact → xeroContactId mapping ─────────────────
    console.log('── Step 4: Contact xeroContactId coverage ────────\n');

    if (nContacts > 0) {
      const contactStats = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(xero_contact_id) as with_xero_id,
          COUNT(*) - COUNT(xero_contact_id) as without_xero_id
        FROM contacts WHERE tenant_id = $1
      `, [tid]);
      const s = contactStats.rows[0];
      console.log(`  Total contacts: ${s.total}`);
      console.log(`  With xero_contact_id: ${s.with_xero_id}`);
      console.log(`  Without xero_contact_id: ${s.without_xero_id}`);

      if (nCached > 0) {
        // Check how many cached invoices can match to a contact
        const matchCheck = await pool.query(`
          SELECT COUNT(*) as matchable
          FROM cached_xero_invoices ci
          WHERE ci.tenant_id = $1
            AND EXISTS (
              SELECT 1 FROM contacts c
              WHERE c.tenant_id = $1
                AND c.xero_contact_id = ci.contact->>'ContactID'
            )
        `, [tid]);
        console.log(`  Cached invoices matchable to a contact: ${matchCheck.rows[0].matchable} / ${nCached}`);
      }
    }

    // ── 5. Try a test insert and see what happens ─────────────────
    console.log('\n── Step 5: Test insert simulation ─────────────────\n');

    if (nCached > 0 && nContacts > 0) {
      // Pick one cached invoice and try to build the insert data
      const testInv = await pool.query(`
        SELECT ci.*, c.id as matched_contact_id
        FROM cached_xero_invoices ci
        JOIN contacts c ON c.tenant_id = ci.tenant_id AND c.xero_contact_id = ci.contact->>'ContactID'
        WHERE ci.tenant_id = $1
        LIMIT 1
      `, [tid]);

      if (testInv.rows.length === 0) {
        console.log('  ❌ Cannot match any cached invoice to a contact via xero_contact_id');
        console.log('     This means processCachedInvoices skips ALL invoices');
      } else {
        const row = testInv.rows[0];
        console.log(`  Test invoice: ${row.invoice_number} → contact ${row.matched_contact_id}`);

        // Actually try the insert in a transaction we roll back
        try {
          await pool.query('BEGIN');
          await pool.query(`
            INSERT INTO invoices (tenant_id, contact_id, xero_invoice_id, invoice_number,
              amount, amount_paid, tax_amount, status, invoice_status,
              issue_date, due_date, paid_date, description, currency)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `, [
            tid, row.matched_contact_id, row.xero_invoice_id, row.invoice_number,
            row.amount, row.amount_paid, row.tax_amount, 'pending', 'OPEN',
            row.issue_date, row.due_date, row.paid_date, row.description, row.currency,
          ]);
          console.log('  ✅ Test INSERT succeeded (rolled back)');
          await pool.query('ROLLBACK');
        } catch (insertErr: any) {
          await pool.query('ROLLBACK');
          console.log(`  ❌ Test INSERT FAILED: ${insertErr.message}`);
          console.log(`     This is what happens inside processCachedInvoices`);
          console.log(`     Error code: ${insertErr.code}`);
          if (insertErr.column) console.log(`     Problem column: ${insertErr.column}`);
        }
      }
    }

    // ── 6. Static code analysis of xeroSync.ts ────────────────────
    console.log('\n── Step 6: Code path analysis ──────────────────────\n');

    const fs = await import('fs');
    const syncCode = fs.readFileSync('server/services/xeroSync.ts', 'utf8');

    // Check: does syncInvoicesAndContacts call processCachedInvoices?
    const callsProcess = syncCode.includes('this.processCachedInvoices');
    console.log(`  syncInvoicesAndContacts calls processCachedInvoices: ${callsProcess ? 'YES' : 'NO ❌'}`);

    // Check: does processCachedInvoices do db.insert(invoices)
    const insertPattern = /db\.insert\(invoices\)/g;
    const insertMatches = syncCode.match(insertPattern);
    console.log(`  processCachedInvoices has db.insert(invoices): ${insertMatches ? `YES (${insertMatches.length}x)` : 'NO ❌'}`);

    // Check: does processCachedInvoices have a filter that skips invoices?
    const filterPattern = /cachedInvoices\.filter/g;
    const filterMatches = syncCode.match(filterPattern);
    console.log(`  Has cachedInvoices.filter() (pre-filter): ${filterMatches ? `YES (${filterMatches.length}x) ❌` : 'NO (iterates all)'}`);

    // Check for amountDue (the field that doesn't exist in schema)
    const amountDueInInsert = /amountDue.*toFixed|amountDue:/g;
    const adMatches = syncCode.match(amountDueInInsert);
    console.log(`  References nonexistent 'amountDue' field: ${adMatches ? `YES (${adMatches.length}x) ❌` : 'NO'}`);

    // Check: is the catch block swallowing errors silently?
    const catchBlocks = syncCode.match(/catch \(error.*?\{[\s\S]*?console\.(error|warn).*?\n\s*\}/g);
    console.log(`  Catch blocks in processCachedInvoices: ${catchBlocks ? catchBlocks.length : 0}`);

    // Check: what mode is used when called from syncAllDataForTenant?
    const modeCall = syncCode.match(/this\.processCachedInvoices\(tenantId,\s*(\w+)\)/);
    console.log(`  processCachedInvoices called with mode: ${modeCall ? modeCall[1] : 'UNKNOWN'}`);

    // ── DIAGNOSIS ─────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  DIAGNOSIS');
    console.log('═══════════════════════════════════════════════════\n');

    if (nCached === 0 && nInvoices === 0) {
      console.log('PROBLEM: Xero API fetch failed OR initial sync cleared cached_xero_invoices');
      console.log('         and they were never repopulated. Check Xero OAuth tokens.');
      console.log('FIX NEEDED: Re-run sync and check server logs for Xero API errors.');
    } else if (nCached > 0 && nInvoices === 0) {
      console.log('PROBLEM: Cached invoices exist but main invoices table is empty.');
      console.log('         processCachedInvoices is called but every insert fails silently.');
      if (missingCols.length > 0) {
        console.log(`         ROOT CAUSE: Missing DB columns: ${missingCols.join(', ')}`);
        console.log(`FIX NEEDED: Run "npm run db:push" to add missing columns, then re-sync.`);
      } else {
        console.log('         ROOT CAUSE: Insert data contains fields not in the Drizzle schema,');
        console.log('         or a type mismatch causes Drizzle to throw on every insert.');
        console.log('FIX NEEDED: Check processCachedInvoices invoiceData object matches schema exactly.');
      }
    } else if (nCached === 0 && nInvoices > 0) {
      console.log('STATUS: Invoices exist in main table. Cached invoices cleared after processing.');
      console.log('        Sync appears to be working correctly.');
    } else {
      console.log(`STATUS: ${nCached} cached, ${nInvoices} in main table.`);
      console.log('        Sync may be partially working. Check for per-invoice errors in logs.');
    }

    console.log('');

  } finally {
    await pool.end();
  }
}

diagnose().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
