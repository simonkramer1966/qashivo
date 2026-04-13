import { db } from "../server/db";
import { cachedXeroOverpayments, cachedXeroPrepayments, contacts, invoices } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const tenantId = "1daf0d80-9be4-4186-87ff-768bbc1950b0";

async function main() {
  const allContacts = await db.select({ id: contacts.id, name: contacts.name, xeroContactId: contacts.xeroContactId })
    .from(contacts).where(eq(contacts.tenantId, tenantId));

  const xeroIdToContactId = new Map<string, string>();
  for (const c of allContacts) {
    if (c.xeroContactId) xeroIdToContactId.set(c.xeroContactId, c.id);
  }

  // Sum credits (matched + unmatched)
  const ops = await db.select().from(cachedXeroOverpayments).where(
    and(eq(cachedXeroOverpayments.tenantId, tenantId), eq(cachedXeroOverpayments.status, "AUTHORISED"))
  );
  let matchedCredits = 0, unmatchedCredits = 0;
  const creditsByContactId = new Map<string, number>();
  for (const op of ops) {
    const rem = parseFloat(op.remainingCredit || "0");
    if (op.xeroContactId && xeroIdToContactId.has(op.xeroContactId)) {
      matchedCredits += rem;
      const cid = xeroIdToContactId.get(op.xeroContactId)!;
      creditsByContactId.set(cid, (creditsByContactId.get(cid) || 0) + rem);
    } else {
      unmatchedCredits += rem;
    }
  }

  // Per-contact outstanding (allowing negative for credit-only contacts)
  let perContactTotal = 0;
  let grandInvoiceBalance = 0;
  for (const c of allContacts) {
    const invs = await db.select({ amount: invoices.amount, amountPaid: invoices.amountPaid, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.contactId, c.id), eq(invoices.tenantId, tenantId)));
    const unpaid = invs.filter(i => i.status !== "paid" && i.status !== "cancelled");
    const bal = unpaid.reduce((s, i) => s + (parseFloat(i.amount) - parseFloat(i.amountPaid || "0")), 0);
    grandInvoiceBalance += bal;
    const credit = creditsByContactId.get(c.id) || 0;
    perContactTotal += bal - credit; // Allow negative
  }

  const totalWithUnmatched = Math.max(0, perContactTotal - unmatchedCredits);

  console.log("=== CALCULATION ===");
  console.log(`  Invoice balance (all contacts):  £${grandInvoiceBalance.toFixed(2)}`);
  console.log(`  Matched credits:                 £${matchedCredits.toFixed(2)}`);
  console.log(`  Unmatched credits:               £${unmatchedCredits.toFixed(2)}`);
  console.log(`  Per-contact total (with neg):    £${perContactTotal.toFixed(2)}`);
  console.log(`  Final total:                     £${totalWithUnmatched.toFixed(2)}`);
  console.log(`  Xero target:                     £121,735.76`);
  console.log(`  Difference:                      £${(totalWithUnmatched - 121735.76).toFixed(2)}`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
