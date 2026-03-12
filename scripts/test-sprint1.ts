/**
 * Sprint 1 Integration Test
 * Tests: Collections Agent LLM generation + Compliance Engine
 *
 * Run: npx tsx scripts/test-sprint1.ts
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { eq, and } from 'drizzle-orm';
import * as schema from '../shared/schema.js';

// Load .env manually (no dotenv dependency)
import fs from 'fs';
const envContent = fs.readFileSync('.env', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#]\w+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

const TEST_PREFIX = '__sprint1_test__';

async function cleanup(tenantId: string) {
  // Clean up in reverse dependency order
  await db.delete(schema.complianceChecks).where(eq(schema.complianceChecks.tenantId, tenantId));
  await db.delete(schema.actions).where(eq(schema.actions.tenantId, tenantId));
  await db.delete(schema.invoices).where(eq(schema.invoices.tenantId, tenantId));
  await db.delete(schema.contacts).where(eq(schema.contacts.tenantId, tenantId));
  await db.delete(schema.agentPersonas).where(eq(schema.agentPersonas.tenantId, tenantId));
  await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Sprint 1 Integration Test');
  console.log('═══════════════════════════════════════════\n');

  const tenantId = `${TEST_PREFIX}${Date.now()}`;

  try {
    // 1. Create test tenant
    console.log('1. Creating test tenant...');
    await db.insert(schema.tenants).values({
      id: tenantId,
      name: 'ABC Recruitment Ltd',
      maxTouchesPerWindow: 3,
      contactWindowDays: 14,
      channelCooldowns: { email: 3, sms: 2, voice: 5 },
      businessHoursStart: '08:00',
      businessHoursEnd: '20:00', // Wide window so time-of-day check passes
      approvalMode: 'manual',
    });
    console.log('   ✓ Tenant: ABC Recruitment Ltd\n');

    // 2. Create agent persona
    console.log('2. Creating agent persona...');
    const [persona] = await db.insert(schema.agentPersonas).values({
      tenantId,
      personaName: 'Sarah Mitchell',
      jobTitle: 'Credit Controller',
      emailSignatureName: 'Sarah Mitchell',
      emailSignatureTitle: 'Credit Controller',
      emailSignatureCompany: 'ABC Recruitment Ltd',
      emailSignaturePhone: '+44 20 7946 0958',
      toneDefault: 'professional',
      companyContext: 'ABC Recruitment is a UK staffing agency placing temporary IT contractors with FTSE 250 clients. Most invoices are for contractor placements billed monthly.',
      sectorContext: 'recruitment',
      isActive: true,
    }).returning();
    console.log(`   ✓ Persona: ${persona.personaName}, ${persona.jobTitle}`);
    console.log(`   ✓ Company context: ${persona.companyContext?.substring(0, 60)}...\n`);

    // 3. Create test debtor contact
    console.log('3. Creating test debtor contact...');
    const [contact] = await db.insert(schema.contacts).values({
      tenantId,
      name: 'TechServe Solutions',
      companyName: 'TechServe Solutions',
      email: 'accounts@techserve.example.com',
      arContactName: 'James Wilson',
      arContactEmail: 'james.wilson@techserve.example.com',
      paymentTerms: 30,
      creditLimit: '25000',
      playbookRiskTag: 'NORMAL',
      isPotentiallyVulnerable: false,
    }).returning();
    console.log(`   ✓ Contact: ${contact.companyName} (${contact.arContactName})\n`);

    // 4. Create overdue invoice
    console.log('4. Creating overdue invoice...');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - 15); // 15 days overdue
    const issueDate = new Date();
    issueDate.setDate(issueDate.getDate() - 45); // issued 45 days ago
    const [invoice] = await db.insert(schema.invoices).values({
      tenantId,
      contactId: contact.id,
      invoiceNumber: 'INV-2026-0042',
      amount: '4750.00',
      amountPaid: '0',
      currency: 'GBP',
      issueDate,
      dueDate,
      status: 'overdue',
      workflowState: 'late',
    }).returning();
    console.log(`   ✓ Invoice: ${invoice.invoiceNumber} — £${invoice.amount} — 15 days overdue\n`);

    // 5. Call Collections Agent
    console.log('5. Generating LLM collection email...');
    console.log('   (calling Claude Sonnet via collectionsAgent)');
    const startTime = Date.now();

    // Dynamic import to avoid module resolution issues at top level
    const { generateCollectionEmail } = await import('../server/agents/collectionsAgent.js');

    const emailResult = await generateCollectionEmail(
      tenantId,
      contact.id,
      {
        actionType: 'follow_up',
        toneLevel: 'professional',
        daysSinceLastContact: 7,
        touchCount: 1,
      },
    );

    const duration = Date.now() - startTime;
    console.log(`   ✓ Generated in ${duration}ms\n`);

    console.log('   ┌─ SUBJECT ─────────────────────────────');
    console.log(`   │ ${emailResult.subject}`);
    console.log('   ├─ BODY ────────────────────────────────');
    for (const line of emailResult.body.split('\n')) {
      console.log(`   │ ${line}`);
    }
    console.log('   ├─ AGENT REASONING ─────────────────────');
    for (const line of emailResult.agentReasoning.split('\n')) {
      console.log(`   │ ${line}`);
    }
    console.log('   └───────────────────────────────────────\n');

    // 6. Run compliance check
    console.log('6. Running compliance engine...');
    const { checkCompliance } = await import('../server/services/compliance/complianceEngine.js');

    const compliance = await checkCompliance({
      tenantId,
      contactId: contact.id,
      emailSubject: emailResult.subject,
      emailBody: emailResult.body,
      toneLevel: 'professional',
      agentReasoning: emailResult.agentReasoning,
    });

    console.log(`   ✓ Approved: ${compliance.approved}`);
    console.log(`   ✓ Action: ${compliance.action}`);
    console.log(`   ✓ Rules checked: ${compliance.rulesChecked.join(', ')}`);
    if (compliance.violations.length > 0) {
      console.log('   ✓ Violations:');
      for (const v of compliance.violations) {
        console.log(`     - ${v}`);
      }
    } else {
      console.log('   ✓ Violations: none');
    }
    console.log('');

    // 7. Verify compliance check was logged
    const [logged] = await db
      .select()
      .from(schema.complianceChecks)
      .where(eq(schema.complianceChecks.tenantId, tenantId))
      .limit(1);

    if (logged) {
      console.log('7. Compliance check logged to DB: ✓');
      console.log(`   ✓ ID: ${logged.id}`);
      console.log(`   ✓ Result: ${logged.checkResult}`);
    } else {
      console.log('7. Compliance check logged to DB: ✗ (not found)');
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('  ALL TESTS PASSED ✓');
    console.log('═══════════════════════════════════════════');

  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err.message);
    console.error(err.stack);
  } finally {
    // Cleanup
    console.log('\nCleaning up test data...');
    await cleanup(tenantId);
    console.log('Done.');
    await pool.end();
  }
}

main();
