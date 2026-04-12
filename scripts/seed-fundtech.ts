/**
 * Seed script: creates FundTech Capital partner org, demo users, and links to all existing tenants.
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx tsx scripts/seed-fundtech.ts
 */
import { db } from "../server/db";
import { partners, partnerTenantLinks, partnerClientRelationships, users, tenants } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

const FUNDTECH_SLUG = "fundtech";
const FUNDTECH_PARTNER = {
  name: "FundTech Capital Limited",
  slug: FUNDTECH_SLUG,
  email: "admin@fundtechcapital.com",
  phone: "+44 20 7123 4567",
  website: "https://fundtechcapital.com",
  brandColor: "#1a365d",
  accentColor: "#2563eb",
  brandName: "FundTech Capital",
  partnerType: "funder" as const,
  partnerTier: "gold" as const,
  status: "ACTIVE",
  isActive: true,
};

const DEMO_USERS = [
  {
    email: "alex.morgan@fundtechcapital.com",
    firstName: "Alex",
    lastName: "Morgan",
    role: "partner",
    tenantRole: "admin",
  },
  {
    email: "rachel.dunn@fundtechcapital.com",
    firstName: "Rachel",
    lastName: "Dunn",
    role: "partner",
    tenantRole: "credit_controller",
  },
];

async function main() {
  console.log("=== FundTech Capital Seed Script ===\n");

  // 1. Upsert partner
  let [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.slug, FUNDTECH_SLUG))
    .limit(1);

  if (partner) {
    console.log(`Partner already exists: ${partner.name} (${partner.id})`);
    // Update with any new fields
    [partner] = await db
      .update(partners)
      .set({
        partnerType: FUNDTECH_PARTNER.partnerType,
        partnerTier: FUNDTECH_PARTNER.partnerTier,
        brandColor: FUNDTECH_PARTNER.brandColor,
        accentColor: FUNDTECH_PARTNER.accentColor,
        brandName: FUNDTECH_PARTNER.brandName,
        status: FUNDTECH_PARTNER.status,
        updatedAt: new Date(),
      })
      .where(eq(partners.id, partner.id))
      .returning();
  } else {
    [partner] = await db.insert(partners).values(FUNDTECH_PARTNER).returning();
    console.log(`Created partner: ${partner.name} (${partner.id})`);
  }

  // 2. Upsert demo users
  const createdUsers: { id: string; email: string }[] = [];
  for (const userData of DEMO_USERS) {
    let [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, userData.email))
      .limit(1);

    if (existingUser) {
      console.log(`User already exists: ${userData.email} (${existingUser.id})`);
      // Ensure partnerId is set
      if (existingUser.partnerId !== partner.id) {
        await db
          .update(users)
          .set({ partnerId: partner.id, role: "partner", updatedAt: new Date() })
          .where(eq(users.id, existingUser.id));
      }
      createdUsers.push({ id: existingUser.id, email: userData.email });
    } else {
      // Create with a placeholder password (Clerk handles auth)
      const hashedPassword = crypto.createHash("sha256").update("fundtech-demo-" + Date.now()).digest("hex");
      const [newUser] = await db
        .insert(users)
        .values({
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          tenantRole: userData.tenantRole,
          partnerId: partner.id,
          status: "active",
        })
        .returning();
      console.log(`Created user: ${userData.email} (${newUser.id})`);
      createdUsers.push({ id: newUser.id, email: userData.email });
    }
  }

  // 3. Get all existing tenants
  const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
  console.log(`\nFound ${allTenants.length} tenants to link\n`);

  // 4. Create partnerTenantLinks (org-level)
  let linksCreated = 0;
  for (const tenant of allTenants) {
    const [existing] = await db
      .select({ id: partnerTenantLinks.id })
      .from(partnerTenantLinks)
      .where(and(
        eq(partnerTenantLinks.partnerId, partner.id),
        eq(partnerTenantLinks.tenantId, tenant.id)
      ))
      .limit(1);

    if (!existing) {
      await db.insert(partnerTenantLinks).values({
        partnerId: partner.id,
        tenantId: tenant.id,
        status: "active",
        accessLevel: "full",
        clientDisplayName: tenant.name,
      });
      linksCreated++;
      console.log(`  Linked tenant: ${tenant.name}`);
    } else {
      console.log(`  Already linked: ${tenant.name}`);
    }
  }

  // 5. Create partnerClientRelationships (user-level) for both users
  let relationshipsCreated = 0;
  for (const user of createdUsers) {
    for (const tenant of allTenants) {
      const [existing] = await db
        .select({ id: partnerClientRelationships.id })
        .from(partnerClientRelationships)
        .where(and(
          eq(partnerClientRelationships.partnerUserId, user.id),
          eq(partnerClientRelationships.clientTenantId, tenant.id)
        ))
        .limit(1);

      if (!existing) {
        await db.insert(partnerClientRelationships).values({
          partnerUserId: user.id,
          partnerTenantId: partner.id,
          clientTenantId: tenant.id,
          status: "active",
          accessLevel: "full",
          establishedBy: "seed_script",
        });
        relationshipsCreated++;
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Partner: ${partner.name} (${partner.id})`);
  console.log(`Users: ${createdUsers.length}`);
  console.log(`Org-level tenant links created: ${linksCreated}`);
  console.log(`User-level relationships created: ${relationshipsCreated}`);
  console.log(`Total tenants linked: ${allTenants.length}`);
  console.log(`\nDone.`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
