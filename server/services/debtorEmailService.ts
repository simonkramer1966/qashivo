/**
 * Debtor Email Service — single entry point for all debtor-facing email
 * generation.
 *
 * Phase 1 (extraction only): the core logic from
 * `collectionsAgent.generateCollectionEmail()` lives here. The legacy function
 * is now a thin wrapper that maps its arguments to a `DebtorEmailRequest` and
 * calls `generateDebtorEmail()`. No other callers have been rewired yet — they
 * still call `collectionsAgent.generateCollectionEmail()` exactly as before.
 *
 * The intent is for every future debtor-email path (chase, reply,
 * clarification, confirmation, conversation) to converge on this function.
 */

import { db } from "../db";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  agentPersonas,
  contacts,
  invoices,
  tenants,
  timelineEvents,
  customerBehaviorSignals,
  collectionPolicies,
  type AgentPersona,
} from "@shared/schema";
import { generateJSON } from "./llm/claude";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type DebtorProfile,
  type OutstandingInvoice,
  type ConversationEntry,
  type ActionContext,
  type PolicyConstraints,
} from "../agents/prompts/collectionEmail";
import { buildConversationBrief } from "./conversationBriefService";

// ── Public types ─────────────────────────────────────────────

export type DebtorEmailType =
  | "first_chase"
  | "follow_up"
  | "reply"
  | "clarification"
  | "confirmation"
  | "conversation";

export type DebtorToneLevel =
  | "friendly"
  | "professional"
  | "firm"
  | "formal"
  | "legal";

export interface DebtorEmailRequest {
  tenantId: string;
  contactId: string;

  /** What kind of email this is. */
  emailType: DebtorEmailType;

  /**
   * Explicit invoice bundle — usually `actions.invoiceIds`. If omitted, the
   * service falls back to loading all currently overdue invoices for the
   * debtor (matching the legacy `loadChaseInvoices` fallback).
   */
  invoiceIds?: string[];

  /**
   * Charlie chose this. The LLM cannot change it — it can only render the
   * email at this tone. Vulnerable customers are still capped at
   * "professional" inside this service.
   */
  toneLevel: DebtorToneLevel;

  /** Sequence position (1 = first chase, 2 = second, etc.). */
  sequencePosition?: number;

  /** For replies / conversation continuations. */
  inboundMessage?: {
    body: string;
    senderName: string;
    senderEmail: string;
    intent?: string;
    receivedAt: Date;
  };

  /** For clarification emails. */
  clarificationContext?: {
    ambiguousField: "date" | "amount" | "both";
    originalPromise: string;
  };

  /** Optional user-provided context for the LLM (e.g. from the approval UI). */
  userBrief?: string;

  /** Currency override. Falls back to debtor / tenant default. */
  currency?: string;
}

export interface DebtorEmailResult {
  subject: string;
  /** Always valid HTML (wrapped paragraphs, may contain a <table>). */
  body: string;
  toEmail: string;
  ccEmails: string[];
  signature: {
    name: string;
    title: string;
    company: string;
  };
  invoicesReferenced: string[];
  chaseAmount: number;
  metadata: {
    generatedBy: "debtorEmailService";
    toneUsed: string;
    emailType: string;
    invoiceCount: number;
  };
  /** Internal — agent reasoning for the audit log, never sent to the debtor. */
  agentReasoning: string;
}

// ── Internal escape hatches for the legacy wrapper ───────────

/**
 * @internal — used only by `collectionsAgent.generateCollectionEmail()` so the
 * wrapper can preserve the exact `ActionContext` and `personaOverride` that
 * the legacy callers used to pass in. These fields will be removed once every
 * caller is migrated to the new interface.
 */
export interface InternalDebtorEmailRequest extends DebtorEmailRequest {
  _legacyActionContext?: ActionContext;
  _personaOverride?: AgentPersona;
}

// ── Public API ───────────────────────────────────────────────

export async function generateDebtorEmail(
  request: InternalDebtorEmailRequest,
): Promise<DebtorEmailResult> {
  const { tenantId, contactId } = request;

  // 1. Persona — always loaded, never skipped.
  const persona =
    request._personaOverride ?? (await resolvePersona(tenantId));

  // 2. Load debtor profile, invoices, history, policy in parallel.
  // For conversational replies and clarification requests, an undefined
  // bundle means "no invoices" — don't auto-load the relationship-wide
  // overdue set. Explicit empty array forces loadChaseInvoices to return
  // nothing.
  const invoiceIdsForLoad =
    (request.emailType === 'conversation' ||
      request.emailType === 'clarification') &&
    request.invoiceIds === undefined
      ? []
      : request.invoiceIds;

  const [debtor, chaseInvoices, history, policy] = await Promise.all([
    loadDebtorProfile(tenantId, contactId),
    loadChaseInvoices(tenantId, contactId, invoiceIdsForLoad),
    loadConversationHistory(tenantId, contactId),
    loadPolicy(tenantId),
  ]);

  // 3. Compute chase context from the loaded bundle.
  const chaseAmount = chaseInvoices.reduce(
    (sum, inv) =>
      sum + (Number(inv.amount || 0) - Number(inv.amountPaid || 0)),
    0,
  );
  const currency = request.currency ?? debtor.currency;

  // 4. Build the conversation brief with chase context so the LLM frames the
  //    email around the bundle, not the relationship-wide total.
  const brief = await buildConversationBrief(tenantId, contactId, {
    chaseAmount,
    chaseInvoiceCount: chaseInvoices.length,
    currency,
  });

  // 5. Build the prompt's ActionContext (legacy escape hatch wins if present).
  const actionContext = buildActionContext(request);

  // Vulnerable-customer tone ceiling.
  let effectiveAction = actionContext;
  if (debtor.isPotentiallyVulnerable) {
    const maxTone = "professional";
    const toneOrder = ["friendly", "professional", "firm", "formal"];
    const requested = toneOrder.indexOf(actionContext.toneLevel);
    const ceiling = toneOrder.indexOf(maxTone);
    if (requested > ceiling) {
      effectiveAction = {
        ...actionContext,
        toneLevel: maxTone as ActionContext["toneLevel"],
      };
    }
  }

  // 6. Assemble prompts.
  const policyConstraints: PolicyConstraints = {
    maxTouchesBeforeEscalation:
      policy?.maxTouchesBeforeEscalation ?? undefined,
    cooldownDaysBetweenTouches:
      policy?.cooldownDaysBetweenTouches ?? undefined,
  };
  const systemPrompt = buildSystemPrompt(
    persona,
    policyConstraints,
    debtor.language,
    currency,
  );
  let userPrompt = buildUserPrompt(
    debtor,
    chaseInvoices,
    history,
    effectiveAction,
    brief.text,
  );

  // Append email-type-specific addenda the base prompt doesn't natively carry.
  // (`prompts/collectionEmail.ts` is unchanged in Phase 1.)
  userPrompt += buildEmailTypeAddendum(request);

  // 7. Call Claude (Sonnet — cost-effective, fast).
  const result = await generateJSON<{
    subject?: string;
    body?: string;
    agentReasoning?: string;
  }>({
    system: systemPrompt,
    prompt: userPrompt,
    model: "standard",
    temperature: 0.4,
    maxTokens: 2048,
  });

  const subject = result.subject || "Payment Reminder";
  const body = result.body || "";
  const agentReasoning = result.agentReasoning || "";

  // 8. Validation — non-throwing in Phase 1 so existing callers continue
  //    working unchanged. Failures are logged for observability.
  validateGeneratedBody({
    body,
    persona,
    invoiceCount: chaseInvoices.length,
    contactId,
  });

  // 9. Return the rich result. Legacy wrapper maps it back to the old shape.
  return {
    subject,
    body,
    toEmail: debtor.contactEmail,
    ccEmails: [],
    signature: {
      name: persona.emailSignatureName,
      title: persona.emailSignatureTitle,
      company: persona.emailSignatureCompany,
    },
    invoicesReferenced: chaseInvoices.map((inv) => inv.invoiceNumber),
    chaseAmount,
    metadata: {
      generatedBy: "debtorEmailService",
      toneUsed: effectiveAction.toneLevel,
      emailType: request.emailType,
      invoiceCount: chaseInvoices.length,
    },
    agentReasoning,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function buildActionContext(req: InternalDebtorEmailRequest): ActionContext {
  // Legacy escape hatch — preserves daysSinceLastContact / phase / etc. that
  // existing callers may rely on.
  if (req._legacyActionContext) return req._legacyActionContext;

  const actionTypeMap: Record<DebtorEmailType, ActionContext["actionType"]> = {
    first_chase: "follow_up",
    follow_up: "follow_up",
    reply: "follow_up",
    clarification: "follow_up",
    confirmation: "follow_up",
    conversation: "follow_up",
  };

  // The underlying prompt vocab doesn't include "legal" as a discrete tone
  // level — collapse to "formal", which is its closest legitimate ancestor.
  const tone: ActionContext["toneLevel"] =
    req.toneLevel === "legal" ? "formal" : req.toneLevel;

  return {
    actionType: actionTypeMap[req.emailType],
    toneLevel: tone,
    daysSinceLastContact: 0,
    touchCount: req.sequencePosition ?? 0,
  };
}

function buildEmailTypeAddendum(req: InternalDebtorEmailRequest): string {
  const parts: string[] = [];

  if (req.inboundMessage) {
    parts.push("");
    parts.push("INBOUND MESSAGE BEING REPLIED TO:");
    parts.push(
      `- From: ${req.inboundMessage.senderName} <${req.inboundMessage.senderEmail}>`,
    );
    parts.push(
      `- Received: ${req.inboundMessage.receivedAt.toISOString()}`,
    );
    if (req.inboundMessage.intent) {
      parts.push(`- Detected intent: ${req.inboundMessage.intent}`);
    }
    parts.push(`- Body:`);
    parts.push(req.inboundMessage.body);
  }

  if (req.clarificationContext) {
    parts.push("");
    parts.push("CLARIFICATION REQUEST:");
    parts.push(
      `- The debtor made a promise to pay but the ${req.clarificationContext.ambiguousField} was ambiguous.`,
    );
    parts.push(
      `- Their original message: "${req.clarificationContext.originalPromise}"`,
    );
    parts.push(
      `- Politely ask them to confirm the specific ${req.clarificationContext.ambiguousField}. Reference their original words so it feels like a natural follow-up, not a form letter.`,
    );
    parts.push(`- Keep the body under 100 words. One short paragraph of acknowledgement, one clear ask.`);
    parts.push(`- Do NOT include an invoice table in this email — clarification is about the promise, not the ledger.`);
    parts.push(`- Sign off with the persona signature (Name / Title / Company). Never sign as "Accounts Team".`);
  }

  if (req.emailType === 'conversation') {
    parts.push('');
    parts.push('CONVERSATIONAL REPLY MODE:');
    parts.push('- This is a reply in an active conversation thread. The debtor already knows who you are — do not re-introduce yourself or re-state the account balance.');
    parts.push('- Keep the body under 120 words. Be natural, warm, and specific to what the debtor just said.');
    parts.push('- Do NOT include the invoice table unless the debtor asked about specific invoices. If they did, render only those invoices.');
    parts.push('- Still sign off with the persona signature (Name / Title / Company). Never sign as "Accounts Team".');
    parts.push('- Reference concrete figures only — never placeholders like "the agreed amount" or "your outstanding balance".');
  }

  if (req.userBrief) {
    parts.push("");
    parts.push(
      "USER-PROVIDED BRIEF (additional context for this specific email):",
    );
    parts.push(req.userBrief);
  }

  return parts.length ? "\n" + parts.join("\n") : "";
}

function validateGeneratedBody(args: {
  body: string;
  persona: AgentPersona;
  invoiceCount: number;
  contactId: string;
}): void {
  const { body, persona, invoiceCount, contactId } = args;

  if (!body) {
    console.warn(
      `[debtorEmailService] empty body returned for contact ${contactId}`,
    );
    return;
  }

  if (
    persona.emailSignatureName &&
    !body.includes(persona.emailSignatureName)
  ) {
    console.warn(
      `[debtorEmailService] body for contact ${contactId} is missing persona name "${persona.emailSignatureName}"`,
    );
  }

  if (invoiceCount > 0 && !/<table[\s>]/i.test(body)) {
    console.warn(
      `[debtorEmailService] body for contact ${contactId} has ${invoiceCount} invoices but no <table>`,
    );
  }

  if (!/<p[\s>]/i.test(body)) {
    console.warn(
      `[debtorEmailService] body for contact ${contactId} contains no <p> tags — may not be valid HTML`,
    );
  }
}

// ── Data loaders (extracted from collectionsAgent) ───────────

async function resolvePersona(tenantId: string): Promise<AgentPersona> {
  const [persona] = await db
    .select()
    .from(agentPersonas)
    .where(
      and(
        eq(agentPersonas.tenantId, tenantId),
        eq(agentPersonas.isActive, true),
      ),
    )
    .limit(1);

  if (!persona) {
    throw new Error(
      `No active agent persona found for tenant ${tenantId}. Create one in Settings → Agent Personas.`,
    );
  }
  return persona;
}

async function loadDebtorProfile(
  tenantId: string,
  contactId: string,
): Promise<DebtorProfile> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
    .limit(1);

  if (!contact) {
    throw new Error(`Contact ${contactId} not found for tenant ${tenantId}`);
  }

  const [tenant] = await db
    .select({
      currency: tenants.currency,
      defaultLanguage: tenants.defaultLanguage,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  let behaviour: DebtorProfile["behaviour"] | undefined;
  const [signals] = await db
    .select()
    .from(customerBehaviorSignals)
    .where(
      and(
        eq(customerBehaviorSignals.contactId, contactId),
        eq(customerBehaviorSignals.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (signals) {
    behaviour = {
      medianDaysToPay: signals.medianDaysToPay
        ? Number(signals.medianDaysToPay)
        : undefined,
      trend: signals.trend ? Number(signals.trend) : undefined,
      promiseBreachCount: signals.promiseBreachCount ?? undefined,
      emailReplyRate: signals.emailReplyRate
        ? Number(signals.emailReplyRate)
        : undefined,
    };
  }

  return {
    companyName: contact.companyName || contact.name,
    contactName: contact.arContactName || contact.name,
    contactEmail: contact.arContactEmail || contact.email || "",
    paymentTerms: contact.paymentTerms ?? 30,
    creditLimit: contact.creditLimit ? Number(contact.creditLimit) : undefined,
    riskTag:
      (contact.playbookRiskTag as "NORMAL" | "HIGH_VALUE") || "NORMAL",
    currency: contact.preferredCurrency || tenant?.currency || "GBP",
    language:
      contact.preferredLanguage || tenant?.defaultLanguage || "en-GB",
    isPotentiallyVulnerable: contact.isPotentiallyVulnerable ?? false,
    arNotes: contact.arNotes ?? undefined,
    behaviour,
  };
}

/**
 * Load the invoices the email will reference.
 *
 * - If `actionInvoiceIds` is provided, returns those exact invoices (the
 *   action's bundle), filtered to those still chaseable.
 * - Otherwise, returns only invoices that are actually OVERDUE (`dueDate < now`).
 *
 * Excluded statuses: paid, cancelled, voided, deleted, draft. Paused invoices
 * (dispute, ptp, payment_plan) are also excluded.
 */
async function loadChaseInvoices(
  tenantId: string,
  contactId: string,
  actionInvoiceIds?: string[],
): Promise<OutstandingInvoice[]> {
  // Explicit empty array = "no invoices referenced in this email" (used by
  // conversational replies). Undefined = fall back to overdue-only.
  if (actionInvoiceIds !== undefined && actionInvoiceIds.length === 0) {
    return [];
  }

  const baseConditions = [
    eq(invoices.tenantId, tenantId),
    eq(invoices.contactId, contactId),
  ];

  if (actionInvoiceIds && actionInvoiceIds.length > 0) {
    baseConditions.push(inArray(invoices.id, actionInvoiceIds));
  }

  const rows = await db
    .select()
    .from(invoices)
    .where(and(...baseConditions))
    .orderBy(desc(invoices.dueDate));

  const now = new Date();
  const EXCLUDED_STATUSES = new Set([
    "paid",
    "cancelled",
    "void",
    "voided",
    "deleted",
    "draft",
  ]);
  const EXCLUDED_INVOICE_STATUSES = new Set([
    "VOID",
    "PAID",
    "DELETED",
    "DRAFT",
  ]);

  return rows
    .filter((inv) => {
      if (inv.status && EXCLUDED_STATUSES.has(inv.status.toLowerCase())) {
        return false;
      }
      if (
        inv.invoiceStatus &&
        EXCLUDED_INVOICE_STATUSES.has(inv.invoiceStatus)
      ) {
        return false;
      }
      if (inv.pauseState) return false;
      if (inv.isOnHold) return false;

      // When loading without an explicit bundle, only return overdue invoices.
      // When loading from a specific action bundle, trust the planner.
      if (!actionInvoiceIds || actionInvoiceIds.length === 0) {
        if (inv.dueDate.getTime() >= now.getTime()) return false;
      }

      return true;
    })
    .map((inv) => {
      const daysOverdue = Math.floor(
        (now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        invoiceNumber: inv.invoiceNumber,
        amount: Number(inv.amount),
        amountPaid: Number(inv.amountPaid ?? 0),
        dueDate: inv.dueDate,
        daysOverdue,
        currency: inv.currency ?? "GBP",
        workflowState:
          (inv.workflowState as OutstandingInvoice["workflowState"]) ||
          "pre_due",
        pauseState:
          (inv.pauseState as OutstandingInvoice["pauseState"]) || null,
      };
    });
}

async function loadConversationHistory(
  tenantId: string,
  contactId: string,
): Promise<ConversationEntry[]> {
  const rows = await db
    .select()
    .from(timelineEvents)
    .where(
      and(
        eq(timelineEvents.tenantId, tenantId),
        eq(timelineEvents.customerId, contactId),
      ),
    )
    .orderBy(desc(timelineEvents.occurredAt))
    .limit(10);

  return rows.map((row) => ({
    date: row.occurredAt,
    channel: row.channel,
    direction: row.direction as ConversationEntry["direction"],
    summary: row.summary,
    outcomeType: row.outcomeType ?? undefined,
    sentiment: undefined,
  }));
}

async function loadPolicy(tenantId: string) {
  const [policy] = await db
    .select()
    .from(collectionPolicies)
    .where(
      and(
        eq(collectionPolicies.tenantId, tenantId),
        eq(collectionPolicies.isDefault, true),
      ),
    )
    .limit(1);

  return policy ?? null;
}
