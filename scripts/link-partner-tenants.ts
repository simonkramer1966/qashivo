import { db } from '../server/db';
import { partners, partnerTenantLinks, tenants, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const p = await db.select({id: partners.id, name: partners.name}).from(partners);
  console.log('Partners:', JSON.stringify(p));

  const links = await db.select().from(partnerTenantLinks);
  console.log('Existing links:', links.length);

  const t = await db.select({id: tenants.id, name: tenants.name}).from(tenants);
  console.log('Tenants:', JSON.stringify(t));

  if (p.length === 0) {
    console.log('No partners found');
    process.exit(1);
  }

  const partnerId = p[0].id;
  console.log('Using partner:', partnerId, p[0].name);

  const [partnerUser] = await db.select({id: users.id}).from(users).where(eq(users.partnerId, partnerId)).limit(1);
  const linkedBy = partnerUser?.id || null;
  console.log('Linked by user:', linkedBy);

  const existingTenantIds = new Set(links.filter(l => l.partnerId === partnerId).map(l => l.tenantId));
  const missing = t.filter(tenant => !existingTenantIds.has(tenant.id));
  
  console.log('Missing links:', missing.length);
  
  if (missing.length > 0) {
    for (const tenant of missing) {
      await db.insert(partnerTenantLinks).values({
        partnerId,
        tenantId: tenant.id,
        linkedBy,
        status: 'active',
      });
      console.log('Linked:', tenant.name, tenant.id);
    }
  }
  
  console.log('Done');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
