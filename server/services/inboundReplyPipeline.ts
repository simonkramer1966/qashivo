/**
 * Inbound Reply Pipeline — Agent response to debtor emails.
 * MVP v1 Build Spec Section 1.5.
 *
 * When a debtor replies to a collection email, this pipeline:
 *   1. Loads the full conversation thread
 *   2. Uses the Collections Agent to generate a contextual reply
 *   3. Routes through compliance → approval → delivery (task 1.4 pipeline)
 *   4. Maintains email threading via In-Reply-To and References headers
 */

import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  actions,
  contacts,
  invoices,
  tenants,
  emailMessages,
  timelineEvents,
} from "@shared/schema";
import { generateCollectionEmail } from "../agents/collectionsAgent";
import { checkCompliance } from "./compliance/complianceEngine";
import { sendEmail } from "./sendgrid";
import { resolvePrimaryEmail } from "./contactEmailResolver";
import type { ActionContext } from "../agents/prompts/collectionEmail";

// ── Types ────────────────────────────────────────────────────

interface InboundReplyContext {
  tenantId: string;
  contactId: string;
  inboundEmailMessageId: string; // The emailMessages row for the inbound email
  inboundText: string;           // The debtor's reply text
  inboundSubject: string | null;
  intentType: string;
  invoiceId?: string | null;
}

export interface InboundReplyResult {
  actionId: string | null;
  status: "pending_approval" | "sent" | "blocked" | "skipped" | "failed";
  error?: string;
}

// ── Main pipeline ────────────────────────────────────────────

/**
 * Generate and route an agent reply to a debtor's inbound email.
 *
 * Called after intent analysis completes on an inbound email.
 * Only generates replies for intents that warrant an automated response.
 */
export async function processInboundReply(
  ctx: InboundReplyContext,
): Promise<InboundReplyResult> {
  try {
    // Skip reply for intents that don't need automated responses
    const skipIntents = ["dispute", "unclear", "unknown"];
    if (skipIntents.includes(ctx.intentType)) {
      console.log(`[InboundReply] Skipping auto-reply for intent: ${ctx.intentType}`);
      return { actionId: null, status: "skipped" };
    }

    // 1. Load tenant
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    if (!tenant) {
      return { actionId: null, status: "failed", error: "Tenant not found" };
    }

    // 2. Load inbound email message for threading
    const [inboundEmail] = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.id, ctx.inboundEmailMessageId))
      .limit(1);

    if (!inboundEmail) {
      return { actionId: null, status: "failed", error: "Inbound email not found" };
    }

    // 3. Determine action context based on intent
    const actionContext = mapIntentToActionContext(ctx.intentType);

    // 4. Generate reply via Collections Agent
    console.log(`[InboundReply] Generating reply for contact ${ctx.contactId}, intent: ${ctx.intentType}`);
    const emailResult = await generateCollectionEmail(
      ctx.tenantId,
      ctx.contactId,
      actionContext,
    );

    if (!emailResult.body) {
      return { actionId: null, status: "failed", error: "LLM returned empty reply body" };
    }

    // 5. Run compliance check
    const compliance = await checkCompliance({
      tenantId: ctx.tenantId,
      contactId: ctx.contactId,
      emailSubject: emailResult.subject,
      emailBody: emailResult.body,
      toneLevel: actionContext.toneLevel,
      agentReasoning: emailResult.agentReasoning,
    });

    if (compliance.action === "block") {
      console.log(`[InboundReply] Blocked: ${compliance.violations.join("; ")}`);
      return { actionId: null, status: "blocked" };
    }

    // If compliance says regenerate, try at lower tone
    if (compliance.action === "regenerate") {
      const lowerContext: ActionContext = { ...actionContext, toneLevel: "professional" };
      const regenerated = await generateCollectionEmail(ctx.tenantId, ctx.contactId, lowerContext);
      const recheck = await checkCompliance({
        tenantId: ctx.tenantId,
        contactId: ctx.contactId,
        emailSubject: regenerated.subject,
        emailBody: regenerated.body,
        toneLevel: "professional",
        agentReasoning: regenerated.agentReasoning,
      });
      if (!recheck.approved) {
        return { actionId: null, status: "blocked" };
      }
      emailResult.subject = regenerated.subject;
      emailResult.body = regenerated.body;
      emailResult.agentReasoning = regenerated.agentReasoning;
    }

    // 6. Create action record for the reply
    const [action] = await db
      .insert(actions)
      .values({
        tenantId: ctx.tenantId,
        contactId: ctx.contactId,
        invoiceId: ctx.invoiceId || null,
        type: "email",
        status: "pending_approval",
        subject: emailResult.subject,
        content: emailResult.body,
        aiGenerated: true,
        source: "charlie_inbound",
        metadata: {
          direction: "outbound_reply",
          inboundEmailMessageId: ctx.inboundEmailMessageId,
          intentType: ctx.intentType,
          agentReasoning: emailResult.agentReasoning,
          generatedBy: "collections_agent_llm",
        },
      })
      .returning();

    // 7. Route based on approval mode
    const approvalMode = tenant.approvalMode ?? "manual";

    if (approvalMode === "full_auto" && compliance.approved) {
      // Send immediately with threading
      const sendResult = await deliverThreadedReply(
        action.id,
        ctx.tenantId,
        ctx.contactId,
        emailResult,
        inboundEmail,
        tenant,
      );
      return sendResult;
    }

    if (approvalMode === "auto_after_timeout") {
      const timeoutHours = tenant.approvalTimeoutHours ?? 12;
      const autoApproveAt = new Date();
      autoApproveAt.setHours(autoApproveAt.getHours() + timeoutHours);

      await db
        .update(actions)
        .set({
          metadata: {
            ...(action.metadata as any),
            autoApproveAt: autoApproveAt.toISOString(),
            threadingData: extractThreadingData(inboundEmail),
          },
          updatedAt: new Date(),
        })
        .where(eq(actions.id, action.id));
    } else {
      // Manual — store threading data for when it's approved
      await db
        .update(actions)
        .set({
          metadata: {
            ...(action.metadata as any),
            threadingData: extractThreadingData(inboundEmail),
          },
          updatedAt: new Date(),
        })
        .where(eq(actions.id, action.id));
    }

    console.log(`[InboundReply] Queued for approval (mode: ${approvalMode})`);
    return { actionId: action.id, status: "pending_approval" };
  } catch (error: any) {
    console.error(`[InboundReply] Error:`, error.message);
    return { actionId: null, status: "failed", error: error.message };
  }
}

// ── Approve & send threaded reply ───────────────────────────

/**
 * Approve and send a pending inbound reply action with threading.
 * Called from the approval queue or auto-approval processor.
 */
export async function approveAndSendReply(
  actionId: string,
  approvedBy: string | null,
): Promise<InboundReplyResult> {
  const [record] = await db
    .select({
      action: actions,
      contact: contacts,
      tenant: tenants,
    })
    .from(actions)
    .innerJoin(contacts, eq(actions.contactId, contacts.id))
    .innerJoin(tenants, eq(actions.tenantId, tenants.id))
    .where(eq(actions.id, actionId))
    .limit(1);

  if (!record) {
    return { actionId, status: "failed", error: "Action not found" };
  }

  if (record.action.status !== "pending_approval") {
    return { actionId, status: "failed", error: `Action is ${record.action.status}` };
  }

  // Mark approved
  await db
    .update(actions)
    .set({ approvedBy, approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(actions.id, actionId));

  const meta = record.action.metadata as any;
  const threadingData = meta?.threadingData;

  // If we have threading data, load the inbound email for headers
  let inboundEmail: any = null;
  if (meta?.inboundEmailMessageId) {
    const [found] = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.id, meta.inboundEmailMessageId))
      .limit(1);
    inboundEmail = found;
  }

  return deliverThreadedReply(
    actionId,
    record.action.tenantId,
    record.action.contactId!,
    {
      subject: record.action.subject || "Re: Payment Reminder",
      body: record.action.content || "",
      agentReasoning: meta?.agentReasoning || "",
    },
    inboundEmail,
    record.tenant,
  );
}

// ── Threaded email delivery ─────────────────────────────────

async function deliverThreadedReply(
  actionId: string,
  tenantId: string,
  contactId: string,
  email: { subject: string; body: string; agentReasoning: string },
  inboundEmail: typeof emailMessages.$inferSelect | null,
  tenant: typeof tenants.$inferSelect,
): Promise<InboundReplyResult> {
  try {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
      .limit(1);

    if (!contact) {
      return { actionId, status: "failed", error: "Contact not found" };
    }

    // Resolve recipient — reply to the sender's email if available
    const recipientEmail =
      inboundEmail?.inboundFromEmail ||
      (await resolvePrimaryEmail(contactId, tenantId, contact.email));

    if (!recipientEmail) {
      return { actionId, status: "failed", error: "No email address for contact" };
    }

    // Replace portal link placeholder
    const portalBaseUrl =
      process.env.PORTAL_BASE_URL ||
      `${process.env.APP_URL || "https://app.qashivo.com"}/portal`;
    const portalLink = `${portalBaseUrl}/${tenantId}/${contactId}`;
    const finalBody = email.body.replace(/\{\{PORTAL_LINK\}\}/g, portalLink);

    // Build threading headers
    const headers: Record<string, string> = {};
    if (inboundEmail) {
      const inboundHeaders = inboundEmail.inboundHeaders as Record<string, any> | null;
      const inboundMessageId =
        inboundHeaders?.["Message-ID"] ||
        inboundHeaders?.["message-id"] ||
        null;

      if (inboundMessageId) {
        headers["In-Reply-To"] = inboundMessageId;
        // Build References chain: existing references + this message
        const existingRefs =
          inboundHeaders?.["References"] ||
          inboundHeaders?.["references"] ||
          "";
        headers["References"] = existingRefs
          ? `${existingRefs} ${inboundMessageId}`
          : inboundMessageId;
      }
    }

    // Ensure subject has Re: prefix for threading
    const subject = email.subject.startsWith("Re:")
      ? email.subject
      : `Re: ${inboundEmail?.inboundSubject || email.subject}`;

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || "cc@qashivo.com";
    const fromName = tenant.name
      ? `${tenant.name} via Qashivo`
      : "Qashivo Credit Control";
    const textBody = finalBody.replace(/<[^>]*>/g, "");

    // Send via SendGrid with threading headers
    console.log(`[InboundReply] Sending threaded reply to ${recipientEmail}`);
    const sendResult = await sendEmail({
      to: recipientEmail,
      from: `${fromName} <${fromEmail}>`,
      subject,
      html: finalBody,
      text: textBody,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      tenantId,
    });

    // Update action status
    await db
      .update(actions)
      .set({
        status: sendResult.success ? "completed" : "failed",
        completedAt: sendResult.success ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(actions.id, actionId));

    // Log to emailMessages with threading metadata
    const threadKey = inboundEmail?.threadKey || `cust_${contactId}`;
    try {
      await db.insert(emailMessages).values({
        tenantId,
        conversationId: inboundEmail?.conversationId || null,
        direction: "OUTBOUND",
        channel: "EMAIL",
        actionId,
        contactId,
        invoiceId: inboundEmail?.invoiceId || null,
        toEmail: recipientEmail,
        toName: contact.name || null,
        fromEmail,
        fromName,
        subject,
        textBody,
        htmlBody: finalBody,
        threadKey,
        inReplyTo: headers["In-Reply-To"] || null,
        references: headers["References"] || null,
        sendgridMessageId: sendResult.messageId || null,
        status: sendResult.success ? "SENT" : "FAILED",
        sentAt: sendResult.success ? new Date() : null,
      });
    } catch (err) {
      console.warn(`[InboundReply] Sent but failed to record in email_messages:`, err);
    }

    // Log to timelineEvents
    try {
      await db.insert(timelineEvents).values({
        tenantId,
        customerId: contactId,
        invoiceId: inboundEmail?.invoiceId || null,
        occurredAt: new Date(),
        direction: "outbound",
        channel: "email",
        summary: `AI reply to debtor email: "${subject}"`,
        preview: textBody.substring(0, 240),
        subject,
        body: finalBody,
        status: sendResult.success ? "sent" : "failed",
        provider: "sendgrid",
        providerMessageId: sendResult.messageId || null,
        createdByType: "system",
        actionId,
      });
    } catch (err) {
      console.warn(`[InboundReply] Failed to record timeline event:`, err);
    }

    if (sendResult.success) {
      console.log(`[InboundReply] Threaded reply delivered to ${recipientEmail}`);
      return { actionId, status: "sent" };
    } else {
      return { actionId, status: "failed", error: sendResult.error || "Delivery failed" };
    }
  } catch (error: any) {
    console.error(`[InboundReply] Delivery error:`, error.message);
    return { actionId, status: "failed", error: error.message };
  }
}

// ── Helpers ─────────────────────────────────────────────────

function mapIntentToActionContext(intentType: string): ActionContext {
  // Map debtor intent → appropriate reply tone and action type
  switch (intentType) {
    case "promise_to_pay":
    case "payment_confirmation":
      return {
        actionType: "follow_up",
        toneLevel: "friendly",
        daysSinceLastContact: 0,
        touchCount: 1,
      };
    case "acknowledge":
      return {
        actionType: "follow_up",
        toneLevel: "professional",
        daysSinceLastContact: 0,
        touchCount: 1,
      };
    case "payment_plan":
      return {
        actionType: "follow_up",
        toneLevel: "professional",
        daysSinceLastContact: 0,
        touchCount: 1,
      };
    case "callback_request":
    case "admin_issue":
    case "general_query":
      return {
        actionType: "follow_up",
        toneLevel: "friendly",
        daysSinceLastContact: 0,
        touchCount: 1,
      };
    default:
      return {
        actionType: "follow_up",
        toneLevel: "professional",
        daysSinceLastContact: 0,
        touchCount: 1,
      };
  }
}

function extractThreadingData(inboundEmail: typeof emailMessages.$inferSelect | null) {
  if (!inboundEmail) return null;
  const headers = inboundEmail.inboundHeaders as Record<string, any> | null;
  return {
    inboundMessageId: headers?.["Message-ID"] || headers?.["message-id"] || null,
    existingReferences: headers?.["References"] || headers?.["references"] || null,
    threadKey: inboundEmail.threadKey,
    conversationId: inboundEmail.conversationId,
    inboundSubject: inboundEmail.inboundSubject,
  };
}
