/**
 * One-time seed: insert the 3 credit-only contacts that the Xero API
 * can't be reached for locally. Names from the aged receivables report.
 * In production, the sync's Step 4c will handle this automatically.
 */
import { db } from "../server/db";
import { cachedXeroContacts, contacts } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const tenantId = "1daf0d80-9be4-4186-87ff-768bbc1950b0";

const creditContacts = [
  { xeroContactId: "feddb5ca-4046-4735-ba55-d0dc9d60a0ff", name: "Surrey And Borders Partnership NHS Foundation Trust" },
  { xeroContactId: "32ad6c8b-55d0-44c0-9c3d-e9b247e2094f", name: "Ramble Worldwide" },
  { xeroContactId: "87dae7bb-c75b-485b-9e74-9421e7093e8f", name: "St Christopher School" },
];

async function main() {
  for (const cc of creditContacts) {
    // Check if already exists
    const existing = await db.select({ id: contacts.id }).from(contacts)
      .where(and(eq(contacts.xeroContactId, cc.xeroContactId), eq(contacts.tenantId, tenantId)))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Already exists: ${cc.name}`);
      continue;
    }

    // Insert into cached_xero_contacts
    await db.insert(cachedXeroContacts).values({
      tenantId,
      xeroContactId: cc.xeroContactId,
      name: cc.name,
      contactStatus: "ACTIVE",
      isCustomer: true,
      isSupplier: false,
    });

    // Insert into contacts
    await db.insert(contacts).values({
      tenantId,
      xeroContactId: cc.xeroContactId,
      name: cc.name,
      companyName: cc.name,
      role: "customer",
      isActive: true,
    });

    console.log(`  ✅ Imported: ${cc.name}`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
