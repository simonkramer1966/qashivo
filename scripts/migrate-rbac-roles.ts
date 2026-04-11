/**
 * RBAC Phase 1 — One-time migration to assign Owner role to existing users.
 *
 * Run after `npm run db:push` creates the new columns:
 *   npx tsx scripts/migrate-rbac-roles.ts
 *
 * Safe to re-run — only updates rows that need it.
 */

import { db } from "../server/db";
import { users } from "../shared/schema";
import { sql, isNull, isNotNull } from "drizzle-orm";

async function migrate() {
  // Set tenantRole = 'owner' for every existing user who has a tenantId but no tenantRole
  const ownerResult = await db
    .update(users)
    .set({ tenantRole: "owner", status: "active" })
    .where(sql`${users.tenantId} IS NOT NULL AND ${users.tenantRole} IS NULL`);

  console.log(`Set tenantRole='owner' for users with tenantId but no tenantRole`);

  // Set status = 'active' for users where status is NULL
  const statusResult = await db
    .update(users)
    .set({ status: "active" })
    .where(isNull(users.status));

  console.log(`Set status='active' for users with NULL status`);

  console.log("RBAC role migration complete.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
