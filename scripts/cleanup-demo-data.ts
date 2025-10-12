import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema.js';

neonConfig.webSocketConstructor = ws;

const DEMO_TENANT_ID = '6feb7f4d-ba6f-4a67-936e-9cff78f49c59';

async function cleanupDemoData() {
  console.log('🧹 Starting demo data cleanup...\n');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });

  try {
    // Verify we're operating on the demo tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, DEMO_TENANT_ID),
    });

    if (!tenant) {
      throw new Error('Demo tenant not found!');
    }

    console.log(`✅ Confirmed demo tenant: ${tenant.name}\n`);

    // Delete in order of dependencies (child → parent)
    
    // 1. Voice Calls (references invoices)
    const deletedVoiceCalls = await db.delete(schema.voiceCalls)
      .where(eq(schema.voiceCalls.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedVoiceCalls.length} voice calls`);

    // 2. SMS Messages (references invoices)
    const deletedSMS = await db.delete(schema.smsMessages)
      .where(eq(schema.smsMessages.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedSMS.length} SMS messages`);

    // 3. Payment Promises
    const deletedPromises = await db.delete(schema.paymentPromises)
      .where(eq(schema.paymentPromises.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedPromises.length} payment promises`);

    // 5. Inbound Messages
    const deletedInbound = await db.delete(schema.inboundMessages)
      .where(eq(schema.inboundMessages.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedInbound.length} inbound messages`);

    // 3. Action Logs
    const deletedActionLogs = await db.delete(schema.actionLogs)
      .where(eq(schema.actionLogs.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedActionLogs.length} action logs`);

    // 4. Action Items
    const deletedActionItems = await db.delete(schema.actionItems)
      .where(eq(schema.actionItems.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedActionItems.length} action items`);

    // 5. Actions
    const deletedActions = await db.delete(schema.actions)
      .where(eq(schema.actions.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedActions.length} actions`);

    // 6. Workflows (cascade deletes connections and nodes)
    const deletedWorkflows = await db.delete(schema.workflows)
      .where(eq(schema.workflows.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedWorkflows.length} workflows (+ cascade connections/nodes)`);

    // 7. Payment Plans (has cascade)
    const deletedPlans = await db.delete(schema.paymentPlans)
      .where(eq(schema.paymentPlans.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedPlans.length} payment plans (+ cascade schedules/invoices)`);

    // 8. Invoices (cascade deletes related child tables)
    const deletedInvoices = await db.delete(schema.invoices)
      .where(eq(schema.invoices.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedInvoices.length} invoices`);

    // 9. Customer Segment Assignments
    const deletedAssignments = await db.delete(schema.customerSegmentAssignments)
      .where(eq(schema.customerSegmentAssignments.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedAssignments.length} segment assignments`);

    // 10. Customer Segments
    const deletedSegments = await db.delete(schema.customerSegments)
      .where(eq(schema.customerSegments.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedSegments.length} customer segments`);

    // 11. Contact Notes
    const deletedNotes = await db.delete(schema.contactNotes)
      .where(eq(schema.contactNotes.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedNotes.length} contact notes`);

    // 12. Contacts
    const deletedContacts = await db.delete(schema.contacts)
      .where(eq(schema.contacts.tenantId, DEMO_TENANT_ID))
      .returning();
    console.log(`🗑️  Deleted ${deletedContacts.length} contacts`);

    console.log('\n✅ Demo data cleanup completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - ${deletedContacts.length} contacts removed`);
    console.log(`   - ${deletedInvoices.length} invoices removed`);
    console.log(`   - ${deletedActions.length} actions removed`);
    console.log(`   - ${deletedInbound.length} inbound messages removed`);
    console.log(`   - ${deletedPromises.length} promises removed`);
    console.log(`   - ${deletedSMS.length} SMS messages removed`);
    console.log(`   - ${deletedVoiceCalls.length} voice calls removed`);
    console.log(`   - All related data cleared`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await pool.end();
    throw error;
  }
}

// Run cleanup
cleanupDemoData()
  .then(() => {
    console.log('\n🎉 Ready for fresh demo data!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  });
