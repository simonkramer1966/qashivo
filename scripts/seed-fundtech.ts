/**
 * Seed script: creates FundTech Capital partner org, demo users (with Clerk accounts), and links to all existing tenants.
 * Idempotent — safe to run multiple times.
 *
 * Requires: CLERK_SECRET_KEY env var (Clerk Admin API)
 *
 * Usage: npx tsx scripts/seed-fundtech.ts
 */
import { db } from "../server/db";
import { partners, partnerTenantLinks, partnerClientRelationships, users, tenants } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { createClerkClient } from "@clerk/clerk-sdk-node";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const clerk = CLERK_SECRET_KEY ? createClerkClient({ secretKey: CLERK_SECRET_KEY }) : null;

const FUNDTECH_SLUG = "fundtech";
const FUNDTECH_PARTNER = {
  name: "FundTech Capital Limited",
  slug: FUNDTECH_SLUG,
  email: "admin@fundtechcapital.co.uk",
  phone: "+44 20 7123 4567",
  website: "https://fundtechcapital.co.uk",
  brandColor: "#1a365d",
  accentColor: "#2563eb",
  brandName: "FundTech Capital",
  partnerType: "funder" as const,
  partnerTier: "gold" as const,
  status: "ACTIVE",
  isActive: true,
};

const DEMO_PASSWORD = "FundTech2026!";

const DEMO_USERS = [
  {
    email: "alex.morgan@fundtechcapital.co.uk",
    firstName: "Alex",
    lastName: "Morgan",
    role: "partner",
    tenantRole: "admin",
  },
  {
    email: "rachel.dunn@fundtechcapital.co.uk",
    firstName: "Rachel",
    lastName: "Dunn",
    role: "partner",
    tenantRole: "credit_controller",
  },
];

async function ensureClerkUser(userData: typeof DEMO_USERS[number]): Promise<string | null> {
  if (!clerk) {
    console.log("  [Clerk] CLERK_SECRET_KEY not set — skipping Clerk user creation");
    return null;
  }

  try {
    // Try to create the user in Clerk
    const clerkUser = await clerk.users.createUser({
      emailAddress: [userData.email],
      password: DEMO_PASSWORD,
      firstName: userData.firstName,
      lastName: userData.lastName,
    });
    console.log(`  [Clerk] Created user: ${userData.email} (${clerkUser.id})`);
    return clerkUser.id;
  } catch (err: any) {
    // 422 = user already exists (Clerk returns 422 for duplicate email)
    if (err?.status === 422 || err?.errors?.[0]?.code === "form_identifier_exists") {
      // Fetch existing user by email
      const existingUsers = await clerk.users.getUserList({
        emailAddress: [userData.email],
      });
      if (existingUsers.data.length > 0) {
        const clerkId = existingUsers.data[0].id;
        console.log(`  [Clerk] User already exists: ${userData.email} (${clerkId})`);
        return clerkId;
      }
    }
    console.warn(`  [Clerk] Warning: could not create/fetch user ${userData.email}:`, err?.message || err);
    return null;
  }
}

async function main() {
  console.log("=== FundTech Capital Seed Script ===\n");

  if (!clerk) {
    console.log("WARNING: CLERK_SECRET_KEY not set. Clerk users will NOT be created.\n");
  }

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
        email: FUNDTECH_PARTNER.email,
        website: FUNDTECH_PARTNER.website,
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

  // 2. Upsert demo users (DB + Clerk)
  const createdUsers: { id: string; email: string }[] = [];
  for (const userData of DEMO_USERS) {
    // Create/fetch Clerk user first
    const clerkId = await ensureClerkUser(userData);

    let [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, userData.email))
      .limit(1);

    if (existingUser) {
      console.log(`User already exists: ${userData.email} (${existingUser.id})`);
      // Ensure partnerId and clerkId are set
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (existingUser.partnerId !== partner.id) {
        updates.partnerId = partner.id;
        updates.role = "partner";
      }
      if (clerkId && existingUser.clerkId !== clerkId) {
        updates.clerkId = clerkId;
      }
      if (Object.keys(updates).length > 1) {
        await db.update(users).set(updates).where(eq(users.id, existingUser.id));
      }
      createdUsers.push({ id: existingUser.id, email: userData.email });
    } else {
      // Also check for old .com email and update it
      const oldEmail = userData.email.replace(".co.uk", ".com");
      let [oldUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, oldEmail))
        .limit(1);

      if (oldUser) {
        console.log(`Migrating user email: ${oldEmail} → ${userData.email}`);
        await db
          .update(users)
          .set({
            email: userData.email,
            partnerId: partner.id,
            role: "partner",
            ...(clerkId ? { clerkId } : {}),
            updatedAt: new Date(),
          })
          .where(eq(users.id, oldUser.id));
        createdUsers.push({ id: oldUser.id, email: userData.email });
      } else {
        // Create new DB user
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
            ...(clerkId ? { clerkId } : {}),
            status: "active",
          })
          .returning();
        console.log(`Created user: ${userData.email} (${newUser.id})`);
        createdUsers.push({ id: newUser.id, email: userData.email });
      }
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

  if (clerk) {
    console.log(`\n=== Demo Credentials ===`);
    for (const u of DEMO_USERS) {
      console.log(`  ${u.email} / ${DEMO_PASSWORD}`);
    }
  }

  console.log(`\nDone.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
