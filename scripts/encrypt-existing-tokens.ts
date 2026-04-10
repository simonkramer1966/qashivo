/**
 * One-time migration: encrypt existing Xero tokens at rest.
 *
 * Safe to run multiple times — skips already-encrypted values via isEncrypted() check.
 *
 * Prerequisites:
 *   - PROVIDER_TOKEN_ENCRYPTION_KEY env var must be set (64-char hex)
 *   - DATABASE_URL env var must be set
 *
 * Usage:
 *   npx tsx scripts/encrypt-existing-tokens.ts
 */

import { db } from '../server/db';
import { tenants } from '@shared/schema';
import { isNotNull, eq } from 'drizzle-orm';
import { encryptToken, isEncrypted } from '../server/utils/tokenEncryption';

async function main() {
  if (!process.env.PROVIDER_TOKEN_ENCRYPTION_KEY) {
    console.error('❌ PROVIDER_TOKEN_ENCRYPTION_KEY env var not set. Aborting.');
    process.exit(1);
  }

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      xeroAccessToken: tenants.xeroAccessToken,
      xeroRefreshToken: tenants.xeroRefreshToken,
    })
    .from(tenants)
    .where(isNotNull(tenants.xeroAccessToken));

  console.log(`Found ${rows.length} tenants with Xero tokens`);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const accessAlreadyEncrypted = row.xeroAccessToken && isEncrypted(row.xeroAccessToken);
    const refreshAlreadyEncrypted = row.xeroRefreshToken && isEncrypted(row.xeroRefreshToken);

    if (accessAlreadyEncrypted && (refreshAlreadyEncrypted || !row.xeroRefreshToken)) {
      skipped++;
      continue;
    }

    const updates: Record<string, string | null> = {};
    if (row.xeroAccessToken && !accessAlreadyEncrypted) {
      updates.xeroAccessToken = encryptToken(row.xeroAccessToken);
    }
    if (row.xeroRefreshToken && !refreshAlreadyEncrypted) {
      updates.xeroRefreshToken = encryptToken(row.xeroRefreshToken);
    }

    if (Object.keys(updates).length > 0) {
      await db.update(tenants).set(updates).where(eq(tenants.id, row.id));
      migrated++;
      console.log(`  ✅ Encrypted tokens for tenant: ${row.name} (${row.id})`);
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped (already encrypted): ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
