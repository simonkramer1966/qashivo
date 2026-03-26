/**
 * End-to-end collections email pipeline test (v2).
 *
 * Usage: npx tsx scripts/test-pipeline.ts
 *
 * Tests the full pipeline: action creation → LLM generation → compliance →
 * approval queue → approve → SendGrid delivery (in testing mode → simon@qashivo.com)
 */

import "dotenv/config";
import { db } from "../server/db";
import { eq, and } from "drizzle-orm";
import { actions, complianceChecks, emailMessages, tenants } from "../shared/schema";
import { processCollectionEmail, approveAndSend } from "../server/services/collectionsPipeline";
import { sql } from "drizzle-orm";
import type { CharlieDecision } from "../server/services/playbookEngine";

const TENANT_ID = "1daf0d80-9be4-4186-87ff-768bbc1950b0"; // Datum Creative Media
const CONTACT_ID = "e46fbeba-3360-40f2-b693-43fe7b58f122"; // Swatch UK Group
const INVOICE_ID = "6bbc33c8-4e7a-44aa-93fe-643cd6921499"; // INV 5208165, £6,723.30, ~9 days overdue
const APPROVER_USER_ID = "0ab40782-3dea-4f7b-b41f-9afaf6b6d448";

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  END-TO-END COLLECTION EMAIL PIPELINE TEST v2");
  console.log("═══════════════════════════════════════════════════\n");

  // ── Step 0: Ensure testing mode ────────────────────────────
  console.log("STEP 0 — Ensure communication mode = testing");
  await db.update(tenants).set({ communicationMode: "testing" }).where(eq(tenants.id, TENANT_ID));
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, TENANT_ID));
  console.log(`  communicationMode: ${tenant.communicationMode}`);
  console.log(`  testEmails: ${JSON.stringify(tenant.testEmails)}`);
  console.log(`  approvalMode: ${tenant.approvalMode}`);

  if (tenant.communicationMode !== "testing") {
    console.error("  ✗ Communication mode is NOT 'testing'. Aborting.");
    process.exit(1);
  }
  if (!tenant.testEmails?.includes("simon@qashivo.com")) {
    console.error("  ✗ simon@qashivo.com not in testEmails. Aborting.");
    process.exit(1);
  }
  console.log("  ✓ Settings verified\n");

  // ── Step 1: Create action record ───────────────────────────
  console.log("STEP 1 — Create action record");
  const [newAction] = await db.insert(actions).values({
    tenantId: TENANT_ID,
    contactId: CONTACT_ID,
    invoiceId: INVOICE_ID,
    type: "email",
    status: "pending",
    source: "manual",
    priority: 50,
    scheduledFor: new Date(),
    metadata: { test: true, triggeredBy: "test-pipeline-v2.ts" },
  }).returning();

  console.log(`  Action ID: ${newAction.id}`);
  console.log("  ✓ Action created\n");

  // ── Step 2: Run pipeline (LLM generation + compliance) ─────
  console.log("STEP 2 — Run collections pipeline (LLM + compliance)");

  const decision: CharlieDecision = {
    invoiceId: INVOICE_ID,
    contactId: CONTACT_ID,
    tenantId: TENANT_ID,
    charlieState: "overdue_1_14",
    stateMetadata: { label: "Overdue 1-14 days", urgency: "medium", description: "Recently overdue" } as any,
    priorityTier: "medium" as any,
    priorityScore: 60,
    priorityReasons: ["9 days overdue", "£6,723.30 outstanding"],
    recommendedChannel: "email" as any,
    channelReason: "First contact for this invoice",
    customerSegment: "regular" as any,
    shouldEscalate: false,
    escalationTrigger: "none" as any,
    nextActionDate: new Date(),
    cooldownUntil: null,
    confidence: 0.85,
    requiresHumanReview: false,
    invoice: {
      invoiceNumber: "5208165",
      amount: 6723.30,
      daysOverdue: 9,
      dueDate: new Date("2026-03-13"),
    },
    contact: {
      name: "Swatch / Swatch UK Group",
      email: "Luke.martin@uk.swatchgroup.com",
      phone: null,
      lastContactDate: null,
      daysSinceLastContact: null,
    },
    templateId: null,
    toneProfile: "PROFESSIONAL" as any,
    voiceTone: "professional" as any,
    cadence: {
      channel: "email" as any,
      minDaysBetweenContacts: 3,
      maxContactsPerWeek: 2,
      businessHoursOnly: true,
      preferredDays: [1, 2, 3, 4, 5],
      preferredHoursStart: 9,
      preferredHoursEnd: 17,
    },
    isWithinCadence: true,
  };

  const pipelineResult = await processCollectionEmail(
    TENANT_ID,
    CONTACT_ID,
    decision,
    newAction.id,
  );

  console.log(`  Pipeline status: ${pipelineResult.status}`);
  console.log(`  Subject: ${pipelineResult.subject || "(none)"}`);
  if (pipelineResult.body) {
    const preview = pipelineResult.body.replace(/<[^>]*>/g, "").substring(0, 200);
    console.log(`  Body preview: ${preview}...`);
  }
  if (pipelineResult.agentReasoning) {
    console.log(`  Agent reasoning: ${pipelineResult.agentReasoning.substring(0, 150)}...`);
  }
  if (pipelineResult.complianceResult) {
    console.log(`  Compliance: approved=${pipelineResult.complianceResult.approved}, action=${pipelineResult.complianceResult.action}`);
    if (pipelineResult.complianceResult.violations?.length) {
      console.log(`  Violations: ${pipelineResult.complianceResult.violations.join("; ")}`);
    }
  }
  if (pipelineResult.error) {
    console.error(`  ✗ Pipeline error: ${pipelineResult.error}`);
    process.exit(1);
  }
  console.log("  ✓ LLM generation + compliance complete\n");

  // ── Step 3: Verify database records ────────────────────────
  console.log("STEP 3 — Verify database records");
  const [updatedAction] = await db.select().from(actions).where(eq(actions.id, newAction.id));
  console.log(`  Action status: ${updatedAction.status}`);
  console.log(`  AI generated: ${updatedAction.aiGenerated}`);
  console.log(`  Compliance result: ${updatedAction.complianceResult}`);
  console.log(`  Agent tone level: ${updatedAction.agentToneLevel}`);

  const complianceLogs = await db.select().from(complianceChecks)
    .where(eq(complianceChecks.actionId, newAction.id));
  console.log(`  Compliance check records: ${complianceLogs.length}`);
  for (const cl of complianceLogs) {
    console.log(`    - ${cl.id}: result=${cl.checkResult}, rules=${cl.rulesChecked}`);
  }
  console.log("  ✓ Records verified\n");

  if (pipelineResult.status === "blocked") {
    console.log("  Pipeline was blocked by compliance. Cannot proceed to send.");
    process.exit(0);
  }

  if (pipelineResult.status !== "pending_approval") {
    console.log(`  Status is '${pipelineResult.status}', expected 'pending_approval'. Stopping.`);
    process.exit(0);
  }

  // ── Step 4: Approve and send ───────────────────────────────
  console.log("STEP 4 — Approve and send");
  console.log("  Calling approveAndSend()...");

  const sendResult = await approveAndSend(newAction.id, APPROVER_USER_ID);

  console.log(`  Send status: ${sendResult.status}`);
  console.log(`  Subject: ${sendResult.subject || "(none)"}`);
  if (sendResult.error) {
    console.error(`  ✗ Send error: ${sendResult.error}`);
  }
  console.log("  ✓ Approve & send complete\n");

  // ── Step 5: Verify email delivery record ───────────────────
  console.log("STEP 5 — Verify email delivery + messageId format");

  const emailLogs = await db.select().from(emailMessages)
    .where(eq(emailMessages.actionId, newAction.id));

  for (const em of emailLogs) {
    console.log(`  Email record: ${em.id}`);
    console.log(`    toEmail: ${em.toEmail}`);
    console.log(`    subject: ${em.subject}`);
    console.log(`    status: ${em.status}`);
    console.log(`    sendgridMessageId: ${em.sendgridMessageId || "(none)"}`);
    console.log(`    sentAt: ${em.sentAt}`);

    // Check messageId format
    const msgId = em.sendgridMessageId || "";
    if (msgId.includes("@isv.sendgrid.net") || msgId.includes("@sendgrid.net")) {
      console.log("    ✓ messageId looks like a real SendGrid x-message-id");
    } else if (msgId.startsWith("dev-")) {
      console.log("    ⚠ messageId is dev-mode (no SENDGRID_API_KEY configured locally)");
    } else if (msgId.includes("@sendgrid")) {
      console.log("    ✗ messageId is locally generated (old format), not real SendGrid ID");
    } else {
      console.log("    ? messageId format unknown: " + msgId);
    }

    // Verify test mode enforcement in emailMessages audit trail
    if (em.toEmail === "simon@qashivo.com") {
      console.log("    ✓ toEmail correctly records actual recipient (simon@qashivo.com)");
    } else {
      console.log("    ✗ toEmail does NOT show redirected address: " + em.toEmail);
    }

    if (em.subject?.startsWith("[TEST]")) {
      console.log("    ✓ subject correctly records [TEST] prefix");
    } else {
      console.log("    ✗ subject missing [TEST] prefix: " + em.subject);
    }
  }

  if (emailLogs.length === 0) {
    console.log("  ✗ No email_messages records found for this action");
  }

  // Final action state
  const [finalAction] = await db.select().from(actions).where(eq(actions.id, newAction.id));
  console.log(`\n  Final action status: ${finalAction.status}`);
  console.log(`  Approved by: ${finalAction.approvedBy}`);
  console.log(`  Approved at: ${finalAction.approvedAt}`);
  console.log(`  Completed at: ${finalAction.completedAt}`);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  TEST COMPLETE");
  console.log("═══════════════════════════════════════════════════");

  // Reset communication mode back to off for safety
  await db.update(tenants).set({ communicationMode: "off" }).where(eq(tenants.id, TENANT_ID));
  console.log("\n  (Communication mode reset to 'off' for safety)");

  process.exit(0);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err);
  // Reset communication mode on error too
  db.update(tenants).set({ communicationMode: "off" })
    .where(eq(tenants.id, TENANT_ID))
    .then(() => process.exit(1))
    .catch(() => process.exit(1));
});
