/**
 * Collections Pipeline — End-to-end email generation & delivery.
 * MVP v1 Build Spec Section 1.4.
 *
 * Orchestrates: Charlie Decision → LLM Generation → Compliance Check
 *   → Approval Gate → SendGrid Delivery → Logging.
 */

import { db } from "../db";
import { eq, and, lte, sql, isNull } from "drizzle-orm";
import {
  actions,
  tenants,
  contacts,
  invoices,
  messageDrafts,
  emailMessages,
  timelineEvents,
  customerContactPersons,
} from "@shared/schema";
import { generateCollectionEmail } from "../agents/collectionsAgent";
import { checkCompliance, type ComplianceResult } from "./compliance/complianceEngine";
import { sendEmail } from "./sendgrid";
import { resolvePrimaryEmail } from "./contactEmailResolver";
import { storage } from "../storage";
import { approveAndSendReply } from "./inboundReplyPipeline";
import { generateReplyToEmail, findOrCreateConversation, updateConversationStats } from "./emailCommunications";
import { v4 as uuidv4 } from "uuid";
import type { ActionContext } from "../agents/prompts/collectionEmail";
import type { CharlieDecision } from "./playbookEngine";
import { determineTone, mapToneToActionContext } from "./toneEscalationEngine";

// ── Types ────────────────────────────────────────────────────

export interface PipelineResult {
  actionId: string;
  status: "pending_approval" | "sent" | "blocked" | "regenerated" | "failed";
  subject?: string;
  body?: string;
  agentReasoning?: string;
  complianceResult?: ComplianceResult;
  error?: string;
}

// ── Main pipeline ────────────────────────────────────────────

/**
 * Generate an LLM collection email for a debtor, run compliance,
 * and route through the tenant's approval mode.
 *
 * Called from dailyPlanGenerator when Charlie recommends an email action.
 */
export async function processCollectionEmail(
  tenantId: string,
  contactId: string,
  decision: CharlieDecision,
  actionId: string,
): Promise<PipelineResult> {
  try {
    // 1. Map Charlie decision → agent action context
    let actionContext = await mapDecisionToActionContext(decision);

    // 2. Generate email via Collections Agent (LLM)
    console.log(`[Pipeline] Generating LLM email for contact ${contactId}`);
    const emailResult = await generateCollectionEmail(
      tenantId,
      contactId,
      actionContext,
    );

    if (!emailResult.body) {
      return {
        actionId,
        status: "failed",
        error: "LLM returned empty email body",
      };
    }

    // 3. Run compliance check
    console.log(`[Pipeline] Running compliance check for action ${actionId}`);
    let compliance = await checkCompliance({
      tenantId,
      contactId,
      actionId,
      emailSubject: emailResult.subject,
      emailBody: emailResult.body,
      toneLevel: actionContext.toneLevel,
      agentReasoning: emailResult.agentReasoning,
    });

    // 4. Handle compliance result
    if (compliance.action === "block") {
      console.log(`[Pipeline] Blocked: ${compliance.violations.join("; ")}`);
      await db
        .update(actions)
        .set({
          status: "failed",
          metadata: sql`jsonb_set(COALESCE(${actions.metadata}, '{}'), '{complianceBlocked}', 'true')`,
          updatedAt: new Date(),
        })
        .where(eq(actions.id, actionId));

      return {
        actionId,
        status: "blocked",
        complianceResult: compliance,
      };
    }

    if (compliance.action === "regenerate") {
      // Regenerate at lower tone — cap at "professional"
      console.log(`[Pipeline] Regenerating at lower tone`);
      const lowerContext: ActionContext = { ...actionContext, toneLevel: "professional" };
      const regenerated = await generateCollectionEmail(tenantId, contactId, lowerContext);

      // Re-run compliance on regenerated content
      const recheck = await checkCompliance({
        tenantId,
        contactId,
        actionId,
        emailSubject: regenerated.subject,
        emailBody: regenerated.body,
        toneLevel: "professional",
        agentReasoning: regenerated.agentReasoning,
      });

      if (!recheck.approved) {
        await db
          .update(actions)
          .set({
            status: "failed",
            metadata: sql`jsonb_set(COALESCE(${actions.metadata}, '{}'), '{complianceBlocked}', 'true')`,
            updatedAt: new Date(),
          })
          .where(eq(actions.id, actionId));

        return {
          actionId,
          status: "blocked",
          complianceResult: recheck,
        };
      }

      // Use regenerated content and update context to reflect downgraded tone
      emailResult.subject = regenerated.subject;
      emailResult.body = regenerated.body;
      emailResult.agentReasoning = regenerated.agentReasoning;
      actionContext = lowerContext;
      compliance = recheck;
    }

    // 5. Update action with generated content + metrics
    await db
      .update(actions)
      .set({
        subject: emailResult.subject,
        content: emailResult.body,
        aiGenerated: true,
        agentReasoning: emailResult.agentReasoning,
        agentToneLevel: actionContext.toneLevel,
        agentChannel: "email",
        complianceResult: compliance.approved ? "approved" : (compliance.action || "blocked"),
        metadata: sql`jsonb_set(
          jsonb_set(COALESCE(${actions.metadata}, '{}'), '{agentReasoning}', ${JSON.stringify(emailResult.agentReasoning)}::jsonb),
          '{generatedBy}', '"collections_agent_llm"'::jsonb
        )`,
        updatedAt: new Date(),
      })
      .where(eq(actions.id, actionId));

    // 6. Load tenant to check approval mode
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return { actionId, status: "failed", error: "Tenant not found" };
    }

    const approvalMode = tenant.approvalMode ?? "manual";

    // 7. Route based on approval mode
    if (approvalMode === "full_auto" && compliance.approved) {
      // Full auto: send immediately
      const sendResult = await deliverEmail(actionId, tenantId, contactId, emailResult, tenant);
      return sendResult;
    }

    if (approvalMode === "auto_after_timeout") {
      // Semi-auto: create draft with timeout
      const timeoutHours = tenant.approvalTimeoutHours ?? 12;
      const autoApproveAt = new Date();
      autoApproveAt.setHours(autoApproveAt.getHours() + timeoutHours);

      await db
        .update(actions)
        .set({
          status: "pending_approval",
          metadata: sql`jsonb_set(
            COALESCE(${actions.metadata}, '{}'),
            '{autoApproveAt}',
            ${JSON.stringify(autoApproveAt.toISOString())}::jsonb
          )`,
          updatedAt: new Date(),
        })
        .where(eq(actions.id, actionId));

      console.log(`[Pipeline] Queued for approval (auto-approve at ${autoApproveAt.toISOString()})`);
    } else {
      // Manual: just leave as pending_approval
      await db
        .update(actions)
        .set({ status: "pending_approval", updatedAt: new Date() })
        .where(eq(actions.id, actionId));

      console.log(`[Pipeline] Queued for manual approval`);
    }

    return {
      actionId,
      status: "pending_approval",
      subject: emailResult.subject,
      body: emailResult.body,
      agentReasoning: emailResult.agentReasoning,
      complianceResult: compliance,
    };
  } catch (error: any) {
    console.error(`[Pipeline] Error processing email for action ${actionId}:`, error.message);

    await db
      .update(actions)
      .set({
        status: "failed",
        metadata: sql`jsonb_set(COALESCE(${actions.metadata}, '{}'), '{pipelineError}', ${JSON.stringify(error.message)}::jsonb)`,
        updatedAt: new Date(),
      })
      .where(eq(actions.id, actionId));

    return { actionId, status: "failed", error: error.message };
  }
}

// ── Approve & send ──────────────────────────────────────────

/**
 * Approve a pending action and deliver via SendGrid.
 * Called when a user approves from the dashboard, or by the auto-approval job.
 */
export async function approveAndSend(
  actionId: string,
  approvedBy: string | null,
): Promise<PipelineResult> {
  const [action] = await db
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

  if (!action) {
    return { actionId, status: "failed", error: "Action not found" };
  }

  if (action.action.status !== "pending_approval") {
    return { actionId, status: "failed", error: `Action is ${action.action.status}, not pending_approval` };
  }

  // Mark as approved
  await db
    .update(actions)
    .set({
      approvedBy: approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(actions.id, actionId));

  return deliverEmail(
    actionId,
    action.action.tenantId,
    action.action.contactId!,
    {
      subject: action.action.subject || "Payment Reminder",
      body: action.action.content || "",
      agentReasoning: (action.action.metadata as any)?.agentReasoning || "",
    },
    action.tenant,
  );
}

// ── Auto-approval processor ─────────────────────────────────

/**
 * Find actions past their auto-approve timeout and send them.
 * Should be called periodically (e.g. every 15 minutes via cron).
 */
export async function processAutoApprovals(): Promise<number> {
  const now = new Date();

  // Find pending_approval email actions with auto_after_timeout where timeout has passed
  // Skip actions with a batchId — those are handled by batchProcessor
  const pendingActions = await db
    .select({ id: actions.id, metadata: actions.metadata })
    .from(actions)
    .innerJoin(tenants, eq(actions.tenantId, tenants.id))
    .where(
      and(
        eq(actions.status, "pending_approval"),
        eq(actions.type, "email"),
        eq(tenants.approvalMode, "auto_after_timeout"),
        isNull(actions.batchId),
      ),
    );

  let processed = 0;

  for (const action of pendingActions) {
    const meta = action.metadata as any;
    const autoApproveAt = meta?.autoApproveAt ? new Date(meta.autoApproveAt) : null;

    if (autoApproveAt && autoApproveAt <= now) {
      console.log(`[Pipeline] Auto-approving action ${action.id}`);

      // Use threaded reply delivery if this is an inbound reply action
      if (meta?.direction === "outbound_reply" && meta?.inboundEmailMessageId) {
        await approveAndSendReply(action.id, null);
      } else {
        await approveAndSend(action.id, null);
      }
      processed++;
    }
  }

  if (processed > 0) {
    console.log(`[Pipeline] Auto-approved ${processed} actions`);
  }

  return processed;
}

// ── Email delivery ──────────────────────────────────────────

async function deliverEmail(
  actionId: string,
  tenantId: string,
  contactId: string,
  email: { subject: string; body: string; agentReasoning: string },
  tenant: typeof tenants.$inferSelect,
): Promise<PipelineResult> {
  try {
    // Resolve recipient email
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
      .limit(1);

    if (!contact) {
      return { actionId, status: "failed", error: "Contact not found" };
    }

    const recipientEmail = await resolvePrimaryEmail(contactId, tenantId, contact.email, contact.arContactEmail);
    if (!recipientEmail) {
      return { actionId, status: "failed", error: "No email address for contact" };
    }

    // Fetch escalation contacts for auto-CC
    const escalationCc = await getEscalationCc(tenantId, contactId);

    // Replace portal link placeholder
    const portalBaseUrl = process.env.PORTAL_BASE_URL || `${process.env.APP_URL || "https://app.qashivo.com"}/portal`;
    const portalLink = `${portalBaseUrl}/${tenantId}/${contactId}`;
    const finalBody = email.body.replace(/\{\{PORTAL_LINK\}\}/g, portalLink);

    // Find or create conversation for threading
    const conversationId = await findOrCreateConversation(tenantId, contactId, email.subject);
    const emailMessageId = uuidv4();
    const replyToEmail = generateReplyToEmail(tenantId, conversationId, emailMessageId);

    // Send via SendGrid
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || "cc@qashivo.com";
    const fromName = tenant.name ? `${tenant.name} via Qashivo` : "Qashivo Credit Control";
    const textBody = finalBody.replace(/<[^>]*>/g, "");

    console.log(`[Pipeline] Sending email to ${recipientEmail} (replyTo: ${replyToEmail}, cc: ${escalationCc.length ? escalationCc.join(', ') : 'none'})`);
    const sendResult = await sendEmail({
      to: recipientEmail,
      cc: escalationCc.length ? escalationCc : undefined,
      from: `${fromName} <${fromEmail}>`,
      subject: email.subject,
      html: finalBody,
      text: textBody,
      replyTo: replyToEmail,
      tenantId,
      actionId: actionId,
      contactId: contactId,
    });

    // Update action status + Gap 8 delivery tracking
    await db
      .update(actions)
      .set({
        status: sendResult.success ? "completed" : "failed",
        completedAt: sendResult.success ? new Date() : undefined,
        deliveryStatus: sendResult.success ? 'sent' : 'failed',
        providerMessageId: sendResult.messageId,
        updatedAt: new Date(),
      })
      .where(eq(actions.id, actionId));

    // Log to emailMessages — use actual post-enforcement values when available
    try {
      await db.insert(emailMessages).values({
        id: emailMessageId,
        tenantId,
        conversationId,
        direction: "OUTBOUND",
        channel: "EMAIL",
        actionId,
        contactId,
        toEmail: sendResult.actualTo || recipientEmail,
        toName: contact.name || null,
        fromEmail,
        fromName,
        subject: sendResult.actualSubject || email.subject,
        textBody,
        htmlBody: finalBody,
        ccRecipients: sendResult.actualCc?.length ? sendResult.actualCc : null,
        replyToken: `${tenantId}.${conversationId}.${emailMessageId}`,
        status: sendResult.success ? "SENT" : "FAILED",
        sendgridMessageId: sendResult.messageId || null,
        sentAt: sendResult.success ? new Date() : null,
      });

      // Update conversation stats
      await updateConversationStats(conversationId, "outbound");
    } catch (err) {
      console.warn(`[Pipeline] Email sent but failed to record in email_messages:`, err);
    }

    // Log to timelineEvents
    try {
      await db.insert(timelineEvents).values({
        tenantId,
        customerId: contactId,
        occurredAt: new Date(),
        direction: "outbound",
        channel: "email",
        summary: `AI-generated collection email: "${email.subject}"`,
        preview: textBody.substring(0, 240),
        subject: email.subject,
        body: finalBody,
        status: sendResult.success ? "sent" : "failed",
        provider: "sendgrid",
        providerMessageId: sendResult.messageId || null,
        createdByType: "system",
        actionId,
      });
    } catch (err) {
      console.warn(`[Pipeline] Failed to record timeline event:`, err);
    }

    if (sendResult.success) {
      console.log(`[Pipeline] Email delivered successfully to ${recipientEmail}`);
      return {
        actionId,
        status: "sent",
        subject: email.subject,
        body: finalBody,
        agentReasoning: email.agentReasoning,
      };
    } else {
      return {
        actionId,
        status: "failed",
        error: sendResult.error || "SendGrid delivery failed",
      };
    }
  } catch (error: any) {
    console.error(`[Pipeline] Delivery error for action ${actionId}:`, error.message);
    return { actionId, status: "failed", error: error.message };
  }
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Fetch escalation contact email(s) for auto-CC on agent-sent emails.
 */
async function getEscalationCc(tenantId: string, contactId: string): Promise<string[]> {
  try {
    const persons = await db
      .select({ email: customerContactPersons.email })
      .from(customerContactPersons)
      .where(
        and(
          eq(customerContactPersons.contactId, contactId),
          eq(customerContactPersons.tenantId, tenantId),
          eq(customerContactPersons.isEscalation, true),
        ),
      );
    return persons.filter(p => p.email).map(p => p.email!);
  } catch (err) {
    console.warn(`[Pipeline] Failed to fetch escalation CC for contact ${contactId}:`, err);
    return [];
  }
}

/**
 * Map a CharlieDecision to an ActionContext, using the tone escalation engine
 * to determine the correct tone based on multiple signals.
 */
async function mapDecisionToActionContext(decision: CharlieDecision): Promise<ActionContext> {
  // Map Charlie state → action type
  let actionType: ActionContext["actionType"];
  if (decision.charlieState === "due_soon" || decision.charlieState === "due") {
    actionType = "pre_due_reminder";
  } else if (decision.charlieState === "final_demand") {
    actionType = "final_notice";
  } else if (decision.shouldEscalate) {
    actionType = "escalation";
  } else {
    actionType = "follow_up";
  }

  // Use tone escalation engine for signal-based tone determination
  let toneLevel: ActionContext["toneLevel"];
  try {
    const toneResult = await determineTone({
      tenantId: decision.tenantId,
      contactId: decision.contactId,
      daysOverdue: decision.invoice.daysOverdue,
      touchCount: decision.contact.daysSinceLastContact != null
        ? Math.max(1, Math.floor(decision.invoice.daysOverdue / 7))
        : 0,
    });
    toneLevel = mapToneToActionContext(toneResult.toneLevel);
    console.log(`[Pipeline] Tone escalation: ${toneResult.toneLevel} for contact ${decision.contactId} (${toneResult.reasoning})`);
  } catch (err) {
    // Fallback to static mapping if engine fails
    console.warn("[Pipeline] Tone escalation engine failed, falling back to static:", err);
    const tp = String(decision.toneProfile || "");
    if (tp.includes("FRIENDLY")) {
      toneLevel = "friendly";
    } else if (tp.includes("FIRM")) {
      toneLevel = "firm";
    } else if (tp.includes("FORMAL") || tp.includes("RECOVERY")) {
      toneLevel = "formal";
    } else {
      toneLevel = "professional";
    }
  }

  return {
    actionType,
    toneLevel,
    daysSinceLastContact: decision.contact.daysSinceLastContact ?? 0,
    touchCount: decision.invoice.daysOverdue > 0 ? 1 : 0,
  };
}
