/**
 * One-time script to import contacts from overpayments that have no invoices.
 * This is the same logic as Step 4c in xeroSync.ts, but runs standalone.
 */
import { db } from "../server/db";
import { cachedXeroOverpayments, cachedXeroPrepayments, cachedXeroContacts, contacts } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { xeroService } from "../server/services/xero";
import { tenants } from "../shared/schema";
import { assignContactToDefaultSchedule } from "../server/services/strategySeeder";

const tenantId = "1daf0d80-9be4-4186-87ff-768bbc1950b0";

async function main() {
  // Get tenant tokens
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant?.xeroAccessToken) {
    console.error("No Xero access token for tenant");
    process.exit(1);
  }

  const tokens = {
    accessToken: tenant.xeroAccessToken,
    refreshToken: tenant.xeroRefreshToken!,
    expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000),
    tenantId: tenant.xeroTenantId!,
  };

  // Find AUTHORISED credit contact IDs
  const creditContactIds = new Set<string>();
  const allOps = await db.select({ xeroContactId: cachedXeroOverpayments.xeroContactId })
    .from(cachedXeroOverpayments)
    .where(and(eq(cachedXeroOverpayments.tenantId, tenantId), eq(cachedXeroOverpayments.status, "AUTHORISED")));
  const allPps = await db.select({ xeroContactId: cachedXeroPrepayments.xeroContactId })
    .from(cachedXeroPrepayments)
    .where(and(eq(cachedXeroPrepayments.tenantId, tenantId), eq(cachedXeroPrepayments.status, "AUTHORISED")));

  for (const r of [...allOps, ...allPps]) {
    if (r.xeroContactId) creditContactIds.add(r.xeroContactId);
  }

  // Find missing
  const existingContacts = await db.select({ xeroContactId: contacts.xeroContactId })
    .from(contacts).where(eq(contacts.tenantId, tenantId));
  const existingXeroIds = new Set<string>(existingContacts.map(c => c.xeroContactId).filter((x): x is string => !!x));
  const missingIds = Array.from(creditContactIds).filter(id => !existingXeroIds.has(id));

  console.log(`Found ${missingIds.length} credit contacts missing from Qashivo:`);
  for (const id of missingIds) console.log(`  ${id}`);

  if (missingIds.length === 0) {
    console.log("Nothing to import.");
    process.exit(0);
  }

  // Fetch from Xero
  const idsParam = missingIds.join(",");
  console.log(`\nFetching from Xero Contacts API...`);
  const response = await xeroService.makeAuthenticatedRequestPublic(
    tokens, `Contacts?IDs=${idsParam}`, "GET", undefined, tenantId
  );

  for (const c of (response.Contacts || [])) {
    const xeroContactId = c.ContactID;
    const name = c.Name || "Unknown";
    const email = c.EmailAddress || null;
    const phone = c.Phones?.find((p: any) => p.PhoneType === "DEFAULT")?.PhoneNumber || null;

    // Cache
    await db.insert(cachedXeroContacts).values({
      tenantId,
      xeroContactId,
      name,
      firstName: c.FirstName || null,
      lastName: c.LastName || null,
      emailAddress: email,
      phone,
      contactStatus: c.ContactStatus || "ACTIVE",
      isCustomer: c.IsCustomer ?? false,
      isSupplier: c.IsSupplier ?? false,
    });

    // Upsert into contacts
    const [newContact] = await db.insert(contacts).values({
      tenantId,
      xeroContactId,
      name,
      email,
      phone,
      companyName: name,
      role: "customer",
      isActive: true,
    }).returning();

    try {
      await assignContactToDefaultSchedule(tenantId, newContact.id);
    } catch (e) {
      console.warn(`  Schedule assign failed for ${newContact.id}`);
    }

    console.log(`  ✅ Imported: ${name} (${xeroContactId})`);
  }

  console.log(`\nDone. Imported ${(response.Contacts || []).length} contacts.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
