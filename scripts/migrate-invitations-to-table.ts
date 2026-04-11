/**
 * One-time migration: copies pending invitations from tenant.settings.invitations (JSONB)
 * into the dedicated userInvitations table.
 *
 * Safe to re-run — skips invitations whose token already exists in the table.
 *
 * Usage: npx tsx scripts/migrate-invitations-to-table.ts
 */

import { db } from "../server/db";
import { tenants, userInvitations } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🔄 Migrating invitations from tenant.settings JSONB → userInvitations table...");

  const allTenants = await db.select().from(tenants);
  let migrated = 0;
  let skipped = 0;

  for (const tenant of allTenants) {
    const settings = tenant.settings as any;
    if (!settings?.invitations?.length) continue;

    for (const inv of settings.invitations) {
      if (!inv.inviteToken || !inv.email) continue;

      // Check if this token already exists
      const existing = await db
        .select({ id: userInvitations.id })
        .from(userInvitations)
        .where(eq(userInvitations.token, inv.inviteToken))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const status = inv.status === "accepted" ? "accepted" : inv.status === "revoked" ? "revoked" : "pending";

      await db.insert(userInvitations).values({
        tenantId: tenant.id,
        email: inv.email,
        role: inv.role || "credit_controller",
        invitedBy: inv.invitedBy || "unknown",
        token: inv.inviteToken,
        invitedAt: inv.createdAt ? new Date(inv.createdAt) : new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: inv.acceptedAt ? new Date(inv.acceptedAt) : null,
        status,
      });

      migrated++;
      console.log(`  ✅ ${inv.email} (${status}) → tenant ${tenant.name || tenant.id}`);
    }
  }

  console.log(`\n✅ Done. Migrated: ${migrated}, Skipped (already exists): ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
