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
  debtorIntelligence,
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
import {
  getSmallBalancePolicy,
  isSmallBalance,
  applySmallBalancePriority,
  type SmallBalancePolicy,
} from "./smallBalancePolicy";
import {
  buildBarrierContext,
  diagnoseBarrier,
  deriveEscalationStage,
  selectStrategy,
  generateInfluenceBrief,
  getSocialProofData,
} from "./influence";

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

  /** Group context — present when this action covers invoices from multiple
   *  group members consolidated under the primary contact. */
  groupContext?: {
    groupId: string;
    groupName: string;
    memberContactIds: string[];
    memberCompanyNames: string[];
  };
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

  const [debtorResult, chaseInvoices, history, policy] = await Promise.all([
    loadDebtorProfile(tenantId, contactId),
    loadChaseInvoices(tenantId, contactId, invoiceIdsForLoad),
    loadConversationHistory(tenantId, contactId),
    loadPolicy(tenantId),
  ]);
  const debtor = debtorResult.profile;
  const smallBalancePolicy = debtorResult.smallBalancePolicy;

  // 3. Compute chase context from the loaded bundle.
  const chaseAmount = chaseInvoices.reduce(
    (sum, inv) =>
      sum + (Number(inv.amount || 0) - Number(inv.amountPaid || 0)),
    0,
  );
  const currency = request.currency ?? debtor.currency;

  // Small-balance detection — drives the SMALL BALANCE NOTE in the user
  // prompt and forces tone back to 'friendly' regardless of what the caller
  // asked for.
  const isSmallBalanceChase = isSmallBalance(chaseAmount, smallBalancePolicy);

  // 4. Build the conversation brief with chase context so the LLM frames the
  //    email around the bundle, not the relationship-wide total.
  const brief = await buildConversationBrief(tenantId, contactId, {
    chaseAmount,
    chaseInvoiceCount: chaseInvoices.length,
    currency,
  });

  // Detect unallocated payments from the brief. When present, the email
  // must chase only the net remaining balance and suppress the invoice
  // table. The brief has already been rendered with UNALLOCATED PAYMENTS
  // section and strict instructions — we still pass a dedicated context
  // object to the user prompt so the rules are enforced there too.
  const unallocatedTotal = brief.data.unallocatedPayments.reduce(
    (sum, r) => sum + r.remainingAmount,
    0,
  );
  const hasUnallocatedPayments = unallocatedTotal > 0;
  const netRemaining = Math.max(0, chaseAmount - unallocatedTotal);

  // 5a. Influence Engine — barrier diagnosis + strategy selection.
  //     Load debtorIntelligence for structured credit risk data.
  let influenceBriefText: string | undefined;
  let influenceDiagnosis: {
    barrier: string;
    strategy: string;
    signals: string[];
    reasoning: string;
    confidence: string;
  } | undefined;
  try {
    const [intel] = await db
      .select({
        creditRiskScore: debtorIntelligence.creditRiskScore,
        insolvencyRisk: debtorIntelligence.insolvencyRisk,
        industrySector: debtorIntelligence.industrySector,
        sizeClassification: debtorIntelligence.sizeClassification,
      })
      .from(debtorIntelligence)
      .where(
        and(
          eq(debtorIntelligence.tenantId, tenantId),
          eq(debtorIntelligence.contactId, contactId),
        ),
      )
      .limit(1);

    const barrierCtx = buildBarrierContext(
      brief.data,
      debtor.contactEmail,
      intel ?? null,
    );
    const diagnosis = diagnoseBarrier(barrierCtx);
    const stage = deriveEscalationStage(barrierCtx.communicationCount);
    const strategy = selectStrategy(diagnosis.barrier, stage);

    const maxDaysOverdue = chaseInvoices.length > 0
      ? Math.max(...chaseInvoices.map((inv) => inv.daysOverdue))
      : 0;

    // CIE social proof — segment-level data for influence brief
    const socialProof = await getSocialProofData(
      intel?.industrySector ?? null,
      intel?.sizeClassification ?? null,
      null, // region not available yet
    );

    influenceBriefText = generateInfluenceBrief(diagnosis, strategy, {
      contactName: debtor.contactName,
      companyName: debtor.companyName,
      totalChaseAmount: chaseAmount,
      daysOverdue: maxDaysOverdue,
      currency,
    }, socialProof);

    influenceDiagnosis = {
      barrier: diagnosis.barrier,
      strategy: strategy.name,
      signals: diagnosis.signals,
      reasoning: diagnosis.reasoning,
      confidence: diagnosis.confidence,
    };
  } catch (err) {
    // Non-fatal — influence engine failure must never block email generation
    console.warn(`[debtorEmailService] Influence engine failed for contact ${contactId}:`, err);
  }

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

  // Small-balance: force friendly tone, overriding any escalation.
  if (isSmallBalanceChase) {
    effectiveAction = {
      ...effectiveAction,
      toneLevel: "friendly",
    };
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
    hasUnallocatedPayments,
    influenceBriefText,
  );
  // Build group invoice breakdown when this is a consolidated group action.
  // Each company's invoices are grouped separately for the LLM prompt.
  let groupInvoiceContext: { companyName: string; invoices: OutstandingInvoice[] }[] | undefined;
  if (request.groupContext && chaseInvoices.length > 0) {
    const byContactId = new Map<string, OutstandingInvoice[]>();
    for (const inv of chaseInvoices) {
      const cid = inv.contactId;
      if (!byContactId.has(cid)) byContactId.set(cid, []);
      byContactId.get(cid)!.push(inv);
    }
    // Look up company names for each contactId from the group metadata
    const memberNames = request.groupContext.memberCompanyNames;
    const memberIds = request.groupContext.memberContactIds;
    groupInvoiceContext = [];
    for (const [cid, invs] of byContactId) {
      const idx = memberIds.indexOf(cid);
      const companyName = idx >= 0 ? memberNames[idx] : 'Unknown';
      groupInvoiceContext.push({ companyName, invoices: invs });
    }
  }

  let userPrompt = buildUserPrompt(
    debtor,
    hasUnallocatedPayments ? [] : chaseInvoices,
    history,
    effectiveAction,
    brief.text,
    isSmallBalanceChase,
    hasUnallocatedPayments
      ? { hasUnallocatedPayments: true, netRemaining, unallocatedTotal }
      : undefined,
    request.groupContext && groupInvoiceContext
      ? { ...request.groupContext, companies: groupInvoiceContext }
      : undefined,
    influenceBriefText,
  );

  // Append email-type-specific addenda the base prompt doesn't natively carry.
  // (`prompts/collectionEmail.ts` is unchanged in Phase 1.)
  userPrompt += buildEmailTypeAddendum(request);

  // 7. Call Claude (Sonnet — cost-effective, fast).
  // Increase maxTokens for group actions (multiple invoice tables).
  const maxTokens = request.groupContext ? 3072 : 2048;
  const result = await generateJSON<{
    subject?: string;
    body?: string;
    agentReasoning?: string;
  }>({
    system: systemPrompt,
    prompt: userPrompt,
    model: "standard",
    temperature: 0.4,
    maxTokens,
    logContext: { tenantId, caller: 'charlie_email_gen', relatedEntityId: contactId, relatedEntityType: 'contact', metadata: { emailType: request.emailType } },
  });

  const subject = result.subject || "Payment Reminder";
  const rawBody = result.body || "";
  const body = ensureHtmlFormatting(rawBody, chaseInvoices, currency);
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
      ...(influenceDiagnosis ? { influenceDiagnosis } : {}),
    },
    agentReasoning,
  };
}

// ── HTML post-processing safety net ──────────────────────────

/**
 * Ensures the LLM-generated body contains proper HTML formatting:
 * 1. If body already has a `<table>` → pass through.
 * 2. If no `<table>` and invoices exist → build one from the invoice data.
 * 3. If body lacks `<p>` tags → wrap paragraphs.
 * 4. Insert the table after the first or second `</p>`.
 *
 * The table is built from the invoice objects, NOT parsed from LLM text.
 */
function ensureHtmlFormatting(
  body: string,
  chaseInvoices: OutstandingInvoice[],
  currency: string,
): string {
  if (!body) return body;

  let html = body;

  // If the body has no <p> tags, wrap paragraphs
  if (!/<p[\s>]/i.test(html)) {
    html = html
      .split(/\n\n+/)
      .filter((p) => p.trim())
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("\n");
  }

  // If the LLM already rendered a table, we're done
  if (/<table[\s>]/i.test(html)) return html;

  // No table but we have invoices — build one from data
  if (chaseInvoices.length > 0) {
    const fmt = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    });
    const thStyle =
      'style="border:1px solid #ddd;padding:8px;background:#f5f5f5;text-align:left"';
    const tdStyle = 'style="border:1px solid #ddd;padding:8px"';

    const rows = chaseInvoices.map((inv) => {
      const outstanding = inv.amount - (inv.amountPaid || 0);
      const due = inv.dueDate instanceof Date
        ? inv.dueDate.toLocaleDateString("en-GB")
        : new Date(inv.dueDate).toLocaleDateString("en-GB");
      return `<tr><td ${tdStyle}>${inv.invoiceNumber}</td><td ${tdStyle}>${fmt.format(outstanding)}</td><td ${tdStyle}>${due}</td></tr>`;
    });

    const table = [
      '<table style="border-collapse:collapse;width:100%;margin:16px 0">',
      `<thead><tr><th ${thStyle}>Invoice #</th><th ${thStyle}>Amount</th><th ${thStyle}>Due Date</th></tr></thead>`,
      `<tbody>${rows.join("")}</tbody>`,
      "</table>",
    ].join("");

    // Insert after the first or second </p>
    const closingPs: number[] = [];
    const closingPRegex = /<\/p>/gi;
    let m: RegExpExecArray | null;
    while ((m = closingPRegex.exec(html)) !== null) {
      closingPs.push(m.index + m[0].length);
    }
    const insertAfterIdx = closingPs.length >= 2 ? 1 : 0;
    if (closingPs.length > 0) {
      const pos = closingPs[insertAfterIdx];
      html = html.slice(0, pos) + "\n" + table + "\n" + html.slice(pos);
    } else {
      // No </p> found — prepend table
      html = table + "\n" + html;
    }
  }

  return html;
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
): Promise<{ profile: DebtorProfile; smallBalancePolicy: SmallBalancePolicy }> {
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
      smallAmountThreshold: tenants.smallAmountThreshold,
      smallAmountChaseEnabled: tenants.smallAmountChaseEnabled,
      minimumChaseThreshold: tenants.minimumChaseThreshold,
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
    profile: {
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
    },
    smallBalancePolicy: getSmallBalancePolicy(tenant),
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

  // When actionInvoiceIds are explicitly provided, invoice IDs are the source
  // of truth — skip the contactId filter so group-consolidated actions can load
  // invoices belonging to other contacts in the same debtor group.
  // tenantId still enforces multi-tenant isolation.
  const baseConditions = [eq(invoices.tenantId, tenantId)];
  if (!actionInvoiceIds || actionInvoiceIds.length === 0) {
    baseConditions.push(eq(invoices.contactId, contactId));
  }
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
        contactId: inv.contactId ?? undefined,
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
