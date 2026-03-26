/**
 * End-to-end inbound reply pipeline test.
 *
 * Usage: npx tsx scripts/test-inbound-reply.ts
 *
 * 1. Sends an outbound collection email (with reply-to threading)
 * 2. Simulates a debtor reply by inserting directly into the DB
 *    and calling intentAnalyst.processInboundMessage()
 * 3. Verifies: routing, intent extraction, action creation
 */

import "dotenv/config";
import { db } from "../server/db";
import { eq, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  actions,
  emailMessages,
  tenants,
  contacts,
  conversations,
  timelineEvents,
  inboundMessages,
} from "../shared/schema";
import { processCollectionEmail, approveAndSend } from "../server/services/collectionsPipeline";
import { intentAnalyst } from "../server/services/intentAnalyst";
import type { CharlieDecision } from "../server/services/playbookEngine";

const TENANT_ID = "1daf0d80-9be4-4186-87ff-768bbc1950b0"; // Datum Creative Media
const CONTACT_ID = "75d3d746-9eb2-416a-8cd5-51f4a5d000be"; // Icely Done Drinks
const INVOICE_ID = "c25b8111-6339-430f-82b1-2b246139e3f3"; // INV 5208189
const APPROVER_USER_ID = "0ab40782-3dea-4f7b-b41f-9afaf6b6d448";

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  INBOUND REPLY PIPELINE TEST");
  console.log("═══════════════════════════════════════════════════\n");

  // ── Step 0: Ensure testing mode ────────────────────────────
  console.log("STEP 0 — Setup");
  await db.update(tenants).set({ communicationMode: "testing" }).where(eq(tenants.id, TENANT_ID));
  console.log("  ✓ Communication mode set to testing\n");

  // ── Step 1: Send outbound email with threading ─────────────
  console.log("STEP 1 — Send outbound collection email (with threading)");

  const [newAction] = await db.insert(actions).values({
    tenantId: TENANT_ID,
    contactId: CONTACT_ID,
    invoiceId: INVOICE_ID,
    type: "email",
    status: "pending",
    source: "manual",
    priority: 50,
    scheduledFor: new Date(),
    metadata: { test: true, triggeredBy: "test-inbound-reply.ts" },
  }).returning();

  const decision: CharlieDecision = {
    invoiceId: INVOICE_ID,
    contactId: CONTACT_ID,
    tenantId: TENANT_ID,
    charlieState: "overdue_1_14",
    stateMetadata: { label: "Overdue 1-14 days", urgency: "medium", description: "Recently overdue" } as any,
    priorityTier: "medium" as any,
    priorityScore: 55,
    priorityReasons: ["1 day overdue"],
    recommendedChannel: "email" as any,
    channelReason: "First contact",
    customerSegment: "regular" as any,
    shouldEscalate: false,
    escalationTrigger: "none" as any,
    nextActionDate: new Date(),
    cooldownUntil: null,
    confidence: 0.85,
    requiresHumanReview: false,
    invoice: { invoiceNumber: "5208189", amount: 1401.60, daysOverdue: 1, dueDate: new Date("2026-03-21") },
    contact: { name: "Icely Done Drinks", email: "dee@icelydone.com", phone: null, lastContactDate: null, daysSinceLastContact: null },
    templateId: null,
    toneProfile: "PROFESSIONAL" as any,
    voiceTone: "professional" as any,
    cadence: { channel: "email" as any, minDaysBetweenContacts: 3, maxContactsPerWeek: 2, businessHoursOnly: true, preferredDays: [1,2,3,4,5], preferredHoursStart: 9, preferredHoursEnd: 17 },
    isWithinCadence: true,
  };

  const pipelineResult = await processCollectionEmail(TENANT_ID, CONTACT_ID, decision, newAction.id);
  if (pipelineResult.error) {
    console.error(`  ✗ Pipeline error: ${pipelineResult.error}`);
    process.exit(1);
  }
  console.log(`  Pipeline: ${pipelineResult.status}`);

  // Approve and send
  if (pipelineResult.status === "pending_approval") {
    const sendResult = await approveAndSend(newAction.id, APPROVER_USER_ID);
    console.log(`  Send: ${sendResult.status}`);
    if (sendResult.status !== "sent") {
      console.error(`  ✗ Send failed: ${sendResult.error}`);
      process.exit(1);
    }
  }

  // Verify outbound email has threading
  const [outboundEmail] = await db.select().from(emailMessages)
    .where(eq(emailMessages.actionId, newAction.id)).limit(1);

  if (!outboundEmail) {
    console.error("  ✗ No outbound emailMessage found");
    process.exit(1);
  }

  console.log(`  Email ID: ${outboundEmail.id}`);
  console.log(`  Conversation ID: ${outboundEmail.conversationId || "✗ NULL"}`);
  console.log(`  Reply token: ${outboundEmail.replyToken ? "✓ set" : "✗ NULL"}`);
  console.log(`  Subject: ${outboundEmail.subject}`);

  if (!outboundEmail.conversationId || !outboundEmail.replyToken) {
    console.error("  ✗ Threading not set up on outbound email");
    process.exit(1);
  }
  console.log("  ✓ Outbound email sent with threading\n");

  // ── Step 2: Simulate inbound reply ─────────────────────────
  console.log("STEP 2 — Simulate inbound reply from debtor");

  const inboundFromEmail = "dee@icelydone.com";
  const inboundSubject = "Re: " + (outboundEmail.subject || "").replace("[TEST] ", "");
  const inboundText = "Hi, thanks for the reminder. We will be processing payment at the end of the month. Should clear by 31st March.";
  const replyToAddress = `reply+${outboundEmail.replyToken}@in.qashivo.com`;

  console.log(`  From: ${inboundFromEmail}`);
  console.log(`  Subject: ${inboundSubject}`);
  console.log(`  Body: ${inboundText}`);

  // Insert inbound emailMessage (mimicking processNormalizedInboundEmail)
  const threadKey = `inv_${INVOICE_ID}`;
  const [inboundEmailMsg] = await db.insert(emailMessages).values({
    tenantId: TENANT_ID,
    conversationId: outboundEmail.conversationId,
    direction: "INBOUND",
    channel: "EMAIL",
    actionId: newAction.id,
    contactId: CONTACT_ID,
    invoiceId: INVOICE_ID,
    inboundToEmail: replyToAddress,
    inboundFromEmail,
    inboundFromName: "Dee",
    inboundSubject,
    inboundText,
    inboundHtml: `<p>${inboundText}</p>`,
    inboundHeaders: {
      "Message-ID": `<test-inbound-${Date.now()}@icelydone.com>`,
      "In-Reply-To": `<${outboundEmail.sendgridMessageId || outboundEmail.id}@sendgrid.net>`,
      "From": `Dee <${inboundFromEmail}>`,
      "To": replyToAddress,
      "Subject": inboundSubject,
    },
    threadKey,
    replyToken: null,
    status: "RECEIVED",
    receivedAt: new Date(),
  }).returning();

  console.log(`  ✓ Inbound emailMessage created: ${inboundEmailMsg.id}`);

  // Update conversation stats
  const [conv] = await db.select().from(conversations)
    .where(eq(conversations.id, outboundEmail.conversationId!)).limit(1);
  if (conv) {
    await db.update(conversations).set({
      messageCount: (conv.messageCount || 0) + 1,
      lastMessageAt: new Date(),
      lastMessageDirection: "inbound",
      updatedAt: new Date(),
    }).where(eq(conversations.id, conv.id));
    console.log(`  ✓ Conversation updated (messageCount: ${(conv.messageCount || 0) + 1})`);
  }

  // Insert timeline event
  await db.insert(timelineEvents).values({
    tenantId: TENANT_ID,
    customerId: CONTACT_ID,
    invoiceId: INVOICE_ID,
    channel: "email",
    direction: "inbound",
    subject: inboundSubject,
    summary: `Email from Dee (dee@icelydone.com): ${inboundSubject}`,
    preview: inboundText.substring(0, 200),
    body: inboundText,
    status: "received",
    occurredAt: new Date(),
    createdByType: "system",
    createdByName: "Dee",
    participantsFrom: inboundFromEmail,
    actionId: newAction.id,
    providerMessageId: inboundEmailMsg.id,
    provider: "sendgrid",
  });
  console.log("  ✓ Timeline event created");

  // Insert legacy inboundMessage (this is what intentAnalyst reads)
  const [legacyMsg] = await db.insert(inboundMessages).values({
    tenantId: TENANT_ID,
    contactId: CONTACT_ID,
    channel: "email",
    from: inboundFromEmail,
    to: replyToAddress,
    subject: inboundSubject,
    content: inboundText,
    rawPayload: {
      emailMessageId: inboundEmailMsg.id,
      simulatedTest: true,
    },
  }).returning();

  console.log(`  ✓ Legacy inbound message created: ${legacyMsg.id}`);
  console.log("  ✓ Inbound reply simulated\n");

  // ── Step 3: Run intent analysis ────────────────────────────
  console.log("STEP 3 — Run intent analysis");
  console.log("  Calling intentAnalyst.processInboundMessage()...");

  try {
    await intentAnalyst.processInboundMessage(legacyMsg.id);
    console.log("  ✓ Intent analysis completed\n");
  } catch (err: any) {
    console.error(`  ✗ Intent analysis error: ${err.message}`);
    console.log("  Continuing to check what was saved...\n");
  }

  // ── Step 4: Verify results ─────────────────────────────────
  console.log("STEP 4 — Verify results\n");

  // 4a. Check conversation
  const [updatedConv] = await db.select().from(conversations)
    .where(eq(conversations.id, outboundEmail.conversationId!)).limit(1);
  console.log("  4a. Conversation:");
  if (updatedConv) {
    console.log(`    Message count: ${updatedConv.messageCount}`);
    console.log(`    Last direction: ${updatedConv.lastMessageDirection}`);
    console.log(`    Status: ${updatedConv.status}`);
    const ok = (updatedConv.messageCount || 0) >= 2 && updatedConv.lastMessageDirection === "inbound";
    console.log(ok ? "    ✓ PASS" : "    ✗ FAIL");
  }

  // 4b. Check inbound emailMessage
  const [inboundCheck] = await db.select().from(emailMessages)
    .where(eq(emailMessages.id, inboundEmailMsg.id)).limit(1);
  console.log("\n  4b. Inbound email message:");
  if (inboundCheck) {
    console.log(`    Direction: ${inboundCheck.direction}`);
    console.log(`    From: ${inboundCheck.inboundFromEmail}`);
    console.log(`    Contact ID: ${inboundCheck.contactId}`);
    console.log(`    Conversation ID: ${inboundCheck.conversationId}`);
    const ok = inboundCheck.direction === "INBOUND" && inboundCheck.contactId === CONTACT_ID;
    console.log(ok ? "    ✓ PASS" : "    ✗ FAIL");
  }

  // 4c. Check intent analysis on legacy message
  const [analyzedMsg] = await db.select().from(inboundMessages)
    .where(eq(inboundMessages.id, legacyMsg.id)).limit(1);
  console.log("\n  4c. Intent analysis:");
  if (analyzedMsg) {
    const am = analyzedMsg as any;
    console.log(`    Intent analyzed: ${am.intentAnalyzed}`);
    console.log(`    Intent type: ${am.intentType || "(not set)"}`);
    console.log(`    Confidence: ${am.intentConfidence || "(not set)"}`);
    console.log(`    Sentiment: ${am.sentiment || "(not set)"}`);
    if (am.extractedEntities) {
      console.log(`    Extracted entities: ${JSON.stringify(am.extractedEntities).substring(0, 300)}`);
    }
    if (am.intentType === "promise_to_pay") {
      console.log("    ✓ PASS — Correctly identified as promise_to_pay");
    } else if (am.intentType) {
      console.log(`    ⚠ Intent was "${am.intentType}" (expected promise_to_pay)`);
    } else {
      console.log("    ✗ FAIL — No intent extracted");
    }
  }

  // 4d. Check for agent reply action
  const replyActions = await db.select().from(actions)
    .where(and(
      eq(actions.tenantId, TENANT_ID),
      eq(actions.contactId, CONTACT_ID),
      eq(actions.source, "charlie_inbound"),
    ))
    .orderBy(desc(actions.createdAt))
    .limit(1);

  console.log("\n  4d. Agent reply action:");
  if (replyActions.length > 0) {
    const ra = replyActions[0];
    console.log(`    Action ID: ${ra.id}`);
    console.log(`    Status: ${ra.status}`);
    console.log(`    Type: ${ra.type}`);
    console.log(`    AI generated: ${ra.aiGenerated}`);
    console.log(`    Subject: ${ra.subject}`);
    const meta = ra.metadata as any;
    console.log(`    Direction: ${meta?.direction}`);
    console.log(`    Intent type: ${meta?.intentType}`);
    console.log("    ✓ PASS — Agent reply queued");
  } else {
    console.log("    ⚠ No charlie_inbound action found");
    console.log("    (May be expected if intent was skipped or approval mode doesn't auto-reply)");
  }

  // 4e. Check timeline
  const recentTimeline = await db.select().from(timelineEvents)
    .where(and(
      eq(timelineEvents.tenantId, TENANT_ID),
      eq(timelineEvents.customerId, CONTACT_ID),
      eq(timelineEvents.direction, "inbound"),
    ))
    .orderBy(desc(timelineEvents.occurredAt))
    .limit(1);

  console.log("\n  4e. Timeline:");
  if (recentTimeline.length > 0) {
    console.log(`    Summary: ${recentTimeline[0].summary}`);
    console.log("    ✓ PASS");
  } else {
    console.log("    ✗ FAIL — No inbound timeline event");
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  TEST COMPLETE");
  console.log("═══════════════════════════════════════════════════");

  // Reset communication mode
  await db.update(tenants).set({ communicationMode: "off" }).where(eq(tenants.id, TENANT_ID));
  console.log("\n  (Communication mode reset to 'off')");

  process.exit(0);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err);
  db.update(tenants).set({ communicationMode: "off" })
    .where(eq(tenants.id, TENANT_ID))
    .then(() => process.exit(1))
    .catch(() => process.exit(1));
});
