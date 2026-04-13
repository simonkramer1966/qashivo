/**
 * Trigger Xero sync for the tenant, then reconcile against the aged receivables report.
 */
import { db } from "../server/db";
import { XeroSyncService } from "../server/services/xeroSync";
import { contacts, invoices, cachedXeroOverpayments, cachedXeroPrepayments } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import * as fs from "fs";

const tenantId = "1daf0d80-9be4-4186-87ff-768bbc1950b0";
const reportPath = "/Users/simonkramer/Downloads/xero_aged_receivables_18mar.json";

async function main() {
  // ── Step 1: Trigger Xero Sync ──
  console.log("═══ STEP 1: TRIGGERING XERO SYNC ═══");
  const syncService = new XeroSyncService();
  const result = await syncService.syncAllDataForTenant(tenantId, "ongoing", (counts) => {
    process.stdout.write(`\r  Syncing... contacts: ${counts.contactCount || 0}, invoices: ${counts.invoiceCount || 0}`);
  });

  if (!result.success) {
    console.error("\n❌ Sync failed:", result.error);
    process.exit(1);
  }
  console.log(`\n✅ Sync complete: ${result.contactsCount} contacts, ${result.invoicesCount} invoices`);

  // ── Step 2: Load Xero report ──
  console.log("\n═══ STEP 2: RECONCILING AGAINST XERO REPORT ═══");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const xeroDebtors = report.debtors as Record<string, { total: number; invoices: number; note?: string }>;
  const xeroTotal = report.grandTotal as number;

  // ── Step 3: Build Qashivo totals ──
  const allContacts = await db.select({
    id: contacts.id,
    name: contacts.name,
    companyName: contacts.companyName,
    xeroContactId: contacts.xeroContactId,
  }).from(contacts).where(eq(contacts.tenantId, tenantId));

  const xeroIdToContact = new Map<string, { id: string; name: string }>();
  for (const c of allContacts) {
    if (c.xeroContactId) xeroIdToContact.set(c.xeroContactId, { id: c.id, name: c.companyName || c.name || "Unknown" });
  }

  // Credits per contact
  const [allOps, allPps] = await Promise.all([
    db.select({ xeroContactId: cachedXeroOverpayments.xeroContactId, remainingCredit: cachedXeroOverpayments.remainingCredit })
      .from(cachedXeroOverpayments)
      .where(and(eq(cachedXeroOverpayments.tenantId, tenantId), eq(cachedXeroOverpayments.status, "AUTHORISED"))),
    db.select({ xeroContactId: cachedXeroPrepayments.xeroContactId, remainingCredit: cachedXeroPrepayments.remainingCredit })
      .from(cachedXeroPrepayments)
      .where(and(eq(cachedXeroPrepayments.tenantId, tenantId), eq(cachedXeroPrepayments.status, "AUTHORISED"))),
  ]);

  const creditsByContactId = new Map<string, number>();
  let unmatchedCredits = 0;
  for (const r of [...allOps, ...allPps]) {
    const rem = parseFloat(r.remainingCredit || "0");
    if (rem <= 0) continue;
    const contact = r.xeroContactId ? xeroIdToContact.get(r.xeroContactId) : undefined;
    if (contact) {
      creditsByContactId.set(contact.id, (creditsByContactId.get(contact.id) || 0) + rem);
    } else {
      unmatchedCredits += rem;
    }
  }

  // Per-contact outstanding
  const qashivoDebtors = new Map<string, { outstanding: number; invoiceCount: number; contactId: string }>();
  let qashivoGrandTotal = 0;

  for (const c of allContacts) {
    const invs = await db.select({ amount: invoices.amount, amountPaid: invoices.amountPaid, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.contactId, c.id), eq(invoices.tenantId, tenantId)));

    const unpaid = invs.filter(i => !["paid", "void", "voided", "deleted", "draft"].includes((i.status || "").toLowerCase()));
    const bal = unpaid.reduce((s, i) => s + (parseFloat(i.amount) - parseFloat(i.amountPaid || "0")), 0);
    const credit = creditsByContactId.get(c.id) || 0;
    const net = bal - credit;
    const name = c.companyName || c.name || "Unknown";

    if (Math.abs(net) > 0.01) {
      qashivoDebtors.set(name, { outstanding: Math.round(net * 100) / 100, invoiceCount: unpaid.length, contactId: c.id });
      qashivoGrandTotal += net;
    }
  }
  qashivoGrandTotal = Math.round(qashivoGrandTotal * 100) / 100;

  // ── Step 4: Check specific invoices ──
  console.log("\n── CHECK 1: New invoices picked up ──");
  const checkInvoices = ["5208327", "5208325", "5208323", "5208324", "5208326", "5208322"];
  for (const num of checkInvoices) {
    const inv = await db.select({
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount,
      amountPaid: invoices.amountPaid,
      status: invoices.status,
      contactId: invoices.contactId,
    }).from(invoices).where(and(eq(invoices.invoiceNumber, num), eq(invoices.tenantId, tenantId)));

    if (inv.length > 0) {
      const contact = allContacts.find(c => c.id === inv[0].contactId);
      console.log(`  ✅ ${num}: £${inv[0].amount} (status: ${inv[0].status}) → ${contact?.companyName || contact?.name || "Unknown"}`);
    } else {
      console.log(`  ❌ ${num}: NOT FOUND`);
    }
  }

  // ── Step 5: Avon House check ──
  console.log("\n── CHECK 2: Avon House partial payment ──");
  const avonQ = qashivoDebtors.get("Avon House Preparatory School");
  const avonX = xeroDebtors["Avon House Preparatory School"];
  console.log(`  Qashivo: £${avonQ?.outstanding?.toFixed(2) || "N/A"}  |  Xero: £${avonX?.total?.toFixed(2) || "N/A"}`);
  if (avonQ && avonX && Math.abs(avonQ.outstanding - avonX.total) < 0.01) {
    console.log("  ✅ Match");
  } else {
    console.log("  ❌ Mismatch");
  }

  // ── Step 6: RBC contacts ──
  console.log("\n── CHECK 3: RBC contacts ──");
  const rbcNames = ["Royal Bank of Canada", "Royal Bank of Canada BlueBay Asset Management",
    "Royal Bank of Canada t/a RBC Capital Markets", "Royal Bank of Canada t/a RBC Wealth Management"];
  for (const name of rbcNames) {
    const q = qashivoDebtors.get(name);
    const x = xeroDebtors[name];
    const match = q && x && Math.abs(q.outstanding - x.total) < 0.01;
    console.log(`  ${match ? "✅" : "❌"} ${name}: Qashivo £${q?.outstanding?.toFixed(2) || "N/A"} | Xero £${x?.total?.toFixed(2) || "N/A"}`);
  }

  // ── Step 7: Invoice 5208273 amount change ──
  console.log("\n── CHECK 4: Invoice 5208273 upsert (amount change £7,194 → £8,310) ──");
  const inv273 = await db.select({ amount: invoices.amount, amountPaid: invoices.amountPaid, status: invoices.status })
    .from(invoices).where(and(eq(invoices.invoiceNumber, "5208273"), eq(invoices.tenantId, tenantId)));
  if (inv273.length > 0) {
    const amt = parseFloat(inv273[0].amount);
    console.log(`  Invoice 5208273: £${amt.toFixed(2)} (status: ${inv273[0].status})`);
    if (Math.abs(amt - 8310) < 0.01) {
      console.log("  ✅ Amount correctly updated to £8,310.00");
    } else {
      console.log(`  ❌ Expected £8,310.00, got £${amt.toFixed(2)}`);
    }
  } else {
    console.log("  ❌ Invoice 5208273 NOT FOUND");
  }

  // ── Step 8: Mentzendorff overpayment netting ──
  console.log("\n── CHECK 5: Mentzendorff overpayment netting ──");
  const mentz = qashivoDebtors.get("Mentzendorff & Co Ltd");
  const mentzX = xeroDebtors["Mentzendorff & Co Ltd"];
  console.log(`  Qashivo: £${mentz?.outstanding?.toFixed(2) || "N/A"} | Xero: £${mentzX?.total?.toFixed(2) || "N/A"}`);
  if (mentz && mentzX && Math.abs(mentz.outstanding - mentzX.total) < 0.01) {
    console.log("  ✅ Match (overpayments correctly netted)");
  } else {
    console.log("  ❌ Mismatch");
  }

  // ── Step 9: Grand total comparison ──
  console.log("\n── CHECK 6: Grand total ──");
  console.log(`  Qashivo total:  £${qashivoGrandTotal.toFixed(2)}`);
  console.log(`  Xero total:     £${xeroTotal.toFixed(2)}`);
  console.log(`  Difference:     £${(qashivoGrandTotal - xeroTotal).toFixed(2)}`);
  if (Math.abs(qashivoGrandTotal - xeroTotal) < 0.05) {
    console.log("  ✅ TOTALS MATCH");
  } else {
    console.log("  ❌ TOTALS DO NOT MATCH");
  }

  // ── Step 10: Per-debtor comparison ──
  console.log("\n── FULL DEBTOR COMPARISON ──");
  const allNames = new Set([...Object.keys(xeroDebtors), ...qashivoDebtors.keys()]);
  const mismatches: string[] = [];

  for (const name of Array.from(allNames).sort()) {
    const x = xeroDebtors[name];
    const q = qashivoDebtors.get(name);
    if (!x && q) {
      mismatches.push(`  ⚠️  IN QASHIVO ONLY: ${name} £${q.outstanding.toFixed(2)}`);
    } else if (x && !q) {
      mismatches.push(`  ⚠️  IN XERO ONLY: ${name} £${x.total.toFixed(2)}`);
    } else if (x && q && Math.abs(x.total - q.outstanding) > 0.01) {
      mismatches.push(`  ❌ ${name}: Qashivo £${q.outstanding.toFixed(2)} vs Xero £${x.total.toFixed(2)} (diff: £${(q.outstanding - x.total).toFixed(2)})`);
    }
  }

  if (mismatches.length === 0) {
    console.log("  ✅ All debtors match!");
  } else {
    console.log(`  ${mismatches.length} discrepancies:`);
    for (const m of mismatches) console.log(m);
  }

  console.log(`\n═══ RECONCILIATION COMPLETE ═══`);
  console.log(`Qashivo debtors: ${qashivoDebtors.size} | Xero debtors: ${Object.keys(xeroDebtors).length}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
