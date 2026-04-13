import { db } from "../server/db";
import { cachedXeroOverpayments, cachedXeroPrepayments, contacts, invoices } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";

const tenantId = "1daf0d80-9be4-4186-87ff-768bbc1950b0";

async function main() {
  // Get AUTHORISED overpayments with remaining credit
  const ops = await db.select().from(cachedXeroOverpayments).where(
    eq(cachedXeroOverpayments.status, "AUTHORISED")
  );

  console.log("=== AUTHORISED overpayments ===");
  let totalCredits = 0;
  for (const op of ops) {
    const xid = op.xeroContactId || "null";
    const contactRows = await db.select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(and(eq(contacts.xeroContactId, xid), eq(contacts.tenantId, tenantId)))
      .limit(1);
    const c = contactRows[0];
    const rem = parseFloat(op.remainingCredit || "0");
    totalCredits += rem;
    console.log(`  ${c?.name || "NO MATCH"}: £${rem.toFixed(2)} (xero contact: ${xid})`);
  }
  console.log(`  TOTAL AUTHORISED CREDITS: £${totalCredits.toFixed(2)}\n`);

  // Check outstanding for key debtors
  const names = ["Mentzendorff", "Ramble", "St Christopher", "Surrey"];
  for (const name of names) {
    const cs = await db.select({ id: contacts.id, name: contacts.name, xeroContactId: contacts.xeroContactId })
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), sql`${contacts.name} ILIKE ${"%" + name + "%"}`));

    for (const c of cs) {
      const invs = await db.select({ amount: invoices.amount, amountPaid: invoices.amountPaid, status: invoices.status, invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(and(eq(invoices.contactId, c.id), eq(invoices.tenantId, tenantId)));

      const unpaid = invs.filter(i => i.status !== "paid" && i.status !== "cancelled");
      const invoiceBalance = unpaid.reduce((sum, i) => sum + (parseFloat(i.amount) - parseFloat(i.amountPaid || "0")), 0);

      // Get credits for this contact
      const creditOps = await db.select().from(cachedXeroOverpayments).where(
        and(eq(cachedXeroOverpayments.xeroContactId, c.xeroContactId || ""), eq(cachedXeroOverpayments.status, "AUTHORISED"))
      );
      const creditPps = await db.select().from(cachedXeroPrepayments).where(
        and(eq(cachedXeroPrepayments.xeroContactId, c.xeroContactId || ""), eq(cachedXeroPrepayments.status, "AUTHORISED"))
      );
      const totalCredit = creditOps.reduce((s, o) => s + parseFloat(o.remainingCredit || "0"), 0)
        + creditPps.reduce((s, p) => s + parseFloat(p.remainingCredit || "0"), 0);

      const netOutstanding = Math.max(0, invoiceBalance - totalCredit);
      console.log(`${c.name}:`);
      console.log(`  Invoice balance: £${invoiceBalance.toFixed(2)} (${unpaid.length} unpaid of ${invs.length})`);
      console.log(`  Credits: £${totalCredit.toFixed(2)}`);
      console.log(`  Net outstanding: £${netOutstanding.toFixed(2)}`);
      console.log();
    }
  }

  // Grand total
  const allContacts = await db.select({ id: contacts.id, name: contacts.name, xeroContactId: contacts.xeroContactId })
    .from(contacts)
    .where(eq(contacts.tenantId, tenantId));

  let grandInvoiceBalance = 0;
  let grandCredits = 0;
  for (const c of allContacts) {
    const invs = await db.select({ amount: invoices.amount, amountPaid: invoices.amountPaid, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.contactId, c.id), eq(invoices.tenantId, tenantId)));
    const unpaid = invs.filter(i => i.status !== "paid" && i.status !== "cancelled");
    grandInvoiceBalance += unpaid.reduce((sum, i) => sum + (parseFloat(i.amount) - parseFloat(i.amountPaid || "0")), 0);

    if (c.xeroContactId) {
      const creditOps = await db.select().from(cachedXeroOverpayments).where(
        and(eq(cachedXeroOverpayments.xeroContactId, c.xeroContactId), eq(cachedXeroOverpayments.status, "AUTHORISED"))
      );
      grandCredits += creditOps.reduce((s, o) => s + parseFloat(o.remainingCredit || "0"), 0);
    }
  }

  const grandNet = grandInvoiceBalance - grandCredits;
  console.log("=== GRAND TOTALS ===");
  console.log(`  Invoice balance (all debtors): £${grandInvoiceBalance.toFixed(2)}`);
  console.log(`  Total AUTHORISED credits:      £${grandCredits.toFixed(2)}`);
  console.log(`  Net outstanding:               £${grandNet.toFixed(2)}`);
  console.log(`  Xero target:                   £121,735.76`);
  console.log(`  Difference:                    £${(grandNet - 121735.76).toFixed(2)}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
