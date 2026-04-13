import { db } from "../server/db";
import { invoices, contacts } from "../shared/schema";
import { eq, asc } from "drizzle-orm";
import * as fs from "fs";

async function main() {
  // Get the tenant
  const allContacts = await db.select({ tenantId: contacts.tenantId }).from(contacts).limit(1);
  const tenantId = allContacts[0]?.tenantId;
  if (!tenantId) { console.error("No tenant found"); process.exit(1); }
  console.log(`Tenant: ${tenantId}`);

  // Fetch all invoices with contact names
  const rows = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      contactName: contacts.name,
      amount: invoices.amount,
      amountPaid: invoices.amountPaid,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      xeroInvoiceId: invoices.xeroInvoiceId,
    })
    .from(invoices)
    .leftJoin(contacts, eq(invoices.contactId, contacts.id))
    .where(eq(invoices.tenantId, tenantId))
    .orderBy(asc(contacts.name), asc(invoices.invoiceNumber));

  console.log(`Found ${rows.length} invoices`);

  // Build CSV (Excel-compatible) since no xlsx lib installed
  const header = ["Invoice Number", "Debtor/Contact", "Amount", "Amount Paid", "Amount Due", "Status", "Invoice Date", "Due Date", "Xero Invoice ID"];
  const csvRows = [header.join(",")];

  for (const r of rows) {
    const amount = parseFloat(r.amount) || 0;
    const paid = parseFloat(r.amountPaid || "0") || 0;
    const due = Math.max(0, amount - paid);
    const issueDate = r.issueDate ? new Date(r.issueDate).toISOString().split("T")[0] : "";
    const dueDate = r.dueDate ? new Date(r.dueDate).toISOString().split("T")[0] : "";
    const contactName = (r.contactName || "Unknown").replace(/,/g, " ");

    csvRows.push([
      r.invoiceNumber,
      `"${contactName}"`,
      amount.toFixed(2),
      paid.toFixed(2),
      due.toFixed(2),
      r.status || "",
      issueDate,
      dueDate,
      r.xeroInvoiceId || "",
    ].join(","));
  }

  // Also compute totals
  let totalAmount = 0, totalPaid = 0, totalDue = 0;
  for (const r of rows) {
    const amount = parseFloat(r.amount) || 0;
    const paid = parseFloat(r.amountPaid || "0") || 0;
    totalAmount += amount;
    totalPaid += paid;
    totalDue += Math.max(0, amount - paid);
  }
  csvRows.push("");
  csvRows.push([`TOTALS (${rows.length} invoices)`, "", totalAmount.toFixed(2), totalPaid.toFixed(2), totalDue.toFixed(2), "", "", "", ""].join(","));

  const outPath = "/Users/simonkramer/Documents/qashivo/reconciliation_export.csv";
  fs.writeFileSync(outPath, csvRows.join("\n"), "utf-8");
  console.log(`✅ Exported to ${outPath}`);
  console.log(`   Total Amount: £${totalAmount.toFixed(2)}`);
  console.log(`   Total Paid:   £${totalPaid.toFixed(2)}`);
  console.log(`   Total Due:    £${totalDue.toFixed(2)}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
