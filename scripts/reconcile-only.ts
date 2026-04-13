/**
 * Reconcile Qashivo DB against Xero aged receivables report (no sync trigger).
 */
import { db } from "../server/db";
import { contacts, invoices, cachedXeroOverpayments, cachedXeroPrepayments } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import * as fs from "fs";

const tenantId = "1daf0d80-9be4-4186-87ff-768bbc1950b0";
const reportPath = "/Users/simonkramer/Downloads/xero_aged_receivables_18mar.json";

async function main() {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const xeroDebtors = report.debtors as Record<string, { total: number; invoices: number; note?: string }>;
  const xeroTotal = report.grandTotal as number;

  const allContacts = await db.select({
    id: contacts.id, name: contacts.name, companyName: contacts.companyName, xeroContactId: contacts.xeroContactId,
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
      // Normalize Unicode quotes to ASCII for consistent matching
      const normalizedName = name.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
      qashivoDebtors.set(normalizedName, { outstanding: Math.round(net * 100) / 100, invoiceCount: unpaid.length, contactId: c.id });
      qashivoGrandTotal += net;
    }
  }
  qashivoGrandTotal = Math.round(qashivoGrandTotal * 100) / 100;

  // ── CHECK 1: New invoices ──
  console.log("── CHECK 1: New invoices picked up ──");
  for (const num of ["5208327", "5208325", "5208323", "5208324", "5208326", "5208322"]) {
    const inv = await db.select({ invoiceNumber: invoices.invoiceNumber, amount: invoices.amount, amountPaid: invoices.amountPaid, status: invoices.status, contactId: invoices.contactId })
      .from(invoices).where(and(eq(invoices.invoiceNumber, num), eq(invoices.tenantId, tenantId)));
    if (inv.length > 0) {
      const contact = allContacts.find(c => c.id === inv[0].contactId);
      console.log(`  ✅ ${num}: £${inv[0].amount} (${inv[0].status}) → ${contact?.companyName || contact?.name}`);
    } else {
      console.log(`  ❌ ${num}: NOT FOUND`);
    }
  }

  // ── CHECK 2: Avon House ──
  console.log("\n── CHECK 2: Avon House partial payment ──");
  const avonQ = qashivoDebtors.get("Avon House Preparatory School");
  const avonX = xeroDebtors["Avon House Preparatory School"];
  console.log(`  Qashivo: £${avonQ?.outstanding?.toFixed(2) || "N/A"}  |  Xero: £${avonX?.total?.toFixed(2)}`);
  console.log(`  ${avonQ && Math.abs(avonQ.outstanding - avonX.total) < 0.01 ? "✅ Match" : "❌ Mismatch"}`);

  // ── CHECK 3: RBC contacts ──
  console.log("\n── CHECK 3: RBC contacts ──");
  for (const name of ["Royal Bank of Canada", "Royal Bank of Canada BlueBay Asset Management",
    "Royal Bank of Canada t/a RBC Capital Markets", "Royal Bank of Canada t/a RBC Wealth Management"]) {
    const q = qashivoDebtors.get(name);
    const x = xeroDebtors[name];
    const match = q && x && Math.abs(q.outstanding - x.total) < 0.01;
    console.log(`  ${match ? "✅" : "❌"} ${name}: Q £${q?.outstanding?.toFixed(2) || "N/A"} | X £${x?.total?.toFixed(2) || "N/A"}`);
  }

  // ── CHECK 4: Invoice 5208273 upsert ──
  console.log("\n── CHECK 4: Invoice 5208273 (£7,194 → £8,310) ──");
  const inv273 = await db.select({ amount: invoices.amount, status: invoices.status })
    .from(invoices).where(and(eq(invoices.invoiceNumber, "5208273"), eq(invoices.tenantId, tenantId)));
  if (inv273.length > 0) {
    const amt = parseFloat(inv273[0].amount);
    console.log(`  £${amt.toFixed(2)} (${inv273[0].status}) ${Math.abs(amt - 8310) < 0.01 ? "✅" : "❌"}`);
  } else { console.log("  ❌ NOT FOUND"); }

  // ── CHECK 5: Mentzendorff ──
  console.log("\n── CHECK 5: Mentzendorff overpayment netting ──");
  const mentz = qashivoDebtors.get("Mentzendorff & Co Ltd");
  const mentzX = xeroDebtors["Mentzendorff & Co Ltd"];
  console.log(`  Qashivo: £${mentz?.outstanding?.toFixed(2) || "N/A"} | Xero: £${mentzX?.total?.toFixed(2)}`);
  console.log(`  ${mentz && Math.abs(mentz.outstanding - mentzX.total) < 0.01 ? "✅ Match" : "❌ Mismatch"}`);

  // ── CHECK 6: Grand total ──
  console.log("\n── CHECK 6: Grand total ──");
  console.log(`  Qashivo: £${qashivoGrandTotal.toFixed(2)}`);
  console.log(`  Xero:    £${xeroTotal.toFixed(2)}`);
  console.log(`  Diff:    £${(qashivoGrandTotal - xeroTotal).toFixed(2)}`);
  console.log(`  ${Math.abs(qashivoGrandTotal - xeroTotal) < 0.05 ? "✅ MATCH" : "❌ MISMATCH"}`);

  // ── Full comparison ──
  console.log("\n── FULL DEBTOR COMPARISON ──");
  const allNames = new Set([...Object.keys(xeroDebtors), ...qashivoDebtors.keys()]);
  const mismatches: string[] = [];
  for (const name of Array.from(allNames).sort()) {
    const x = xeroDebtors[name];
    const q = qashivoDebtors.get(name);
    if (!x && q) mismatches.push(`  ⚠️  QASHIVO ONLY: ${name} £${q.outstanding.toFixed(2)}`);
    else if (x && !q) mismatches.push(`  ⚠️  XERO ONLY: ${name} £${x.total.toFixed(2)}`);
    else if (x && q && Math.abs(x.total - q.outstanding) > 0.01)
      mismatches.push(`  ❌ ${name}: Q £${q.outstanding.toFixed(2)} vs X £${x.total.toFixed(2)} (${(q.outstanding - x.total) >= 0 ? "+" : ""}${(q.outstanding - x.total).toFixed(2)})`);
  }
  if (mismatches.length === 0) console.log("  ✅ All debtors match!");
  else { console.log(`  ${mismatches.length} discrepancies:`); mismatches.forEach(m => console.log(m)); }

  console.log(`\nQashivo: ${qashivoDebtors.size} debtors | Xero: ${Object.keys(xeroDebtors).length} debtors`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
