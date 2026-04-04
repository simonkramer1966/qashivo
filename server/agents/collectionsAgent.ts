/**
 * Collections Agent — LLM email generation service.
 * MVP v1 Build Spec Section 1.2.
 *
 * CHARLIE'S OBJECTIVE: Get a payment date. Every communication exists to move
 * the debtor from silence to a committed date.
 * Phase 1 (0 to chaseDelayDays overdue): inform, don't chase.
 * Phase 2 (chaseDelayDays+ overdue): elicit a date, escalate directness if
 * silence continues. Never escalate hostility.
 *
 * Assembles a dynamic prompt from persona, debtor profile, outstanding
 * invoices, and conversation history, then calls Claude to generate a
 * contextual, persona-consistent collection email.
 */

import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
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
import { generateJSON } from "../services/llm/claude";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type DebtorProfile,
  type OutstandingInvoice,
  type ConversationEntry,
  type ActionContext,
  type PolicyConstraints,
} from "./prompts/collectionEmail";
import { buildConversationBrief } from "../services/conversationBriefService";

// ── Output type ──────────────────────────────────────────────

export interface CollectionEmailResult {
  subject: string;
  body: string;
  agentReasoning: string;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Generate a collection email for a specific debtor.
 *
 * @param tenantId - Tenant scope
 * @param contactId - The debtor (contact) to email
 * @param actionContext - What kind of email this is and at what tone
 * @param personaOverride - Optional persona; if omitted uses the tenant's active persona
 */
export async function generateCollectionEmail(
  tenantId: string,
  contactId: string,
  actionContext: ActionContext,
  personaOverride?: AgentPersona,
): Promise<CollectionEmailResult> {
  // 1. Resolve persona
  const persona = personaOverride ?? await resolvePersona(tenantId);

  // 2. Load debtor profile, invoices, history, policy, and conversation brief in parallel
  const [debtor, outstandingInvoices, history, policy, brief] = await Promise.all([
    loadDebtorProfile(tenantId, contactId),
    loadOutstandingInvoices(tenantId, contactId),
    loadConversationHistory(tenantId, contactId),
    loadPolicy(tenantId),
    buildConversationBrief(tenantId, contactId),
  ]);

  // 3. Enforce vulnerable-customer tone ceiling
  let effectiveAction = actionContext;
  if (debtor.isPotentiallyVulnerable) {
    const maxTone = "professional";
    const toneOrder = ["friendly", "professional", "firm", "formal"];
    const requested = toneOrder.indexOf(actionContext.toneLevel);
    const ceiling = toneOrder.indexOf(maxTone);
    if (requested > ceiling) {
      effectiveAction = { ...actionContext, toneLevel: maxTone as ActionContext["toneLevel"] };
    }
  }

  // 4. Assemble prompts
  const policyConstraints: PolicyConstraints = {
    maxTouchesBeforeEscalation: policy?.maxTouchesBeforeEscalation ?? undefined,
    cooldownDaysBetweenTouches: policy?.cooldownDaysBetweenTouches ?? undefined,
  };
  const systemPrompt = buildSystemPrompt(persona, policyConstraints, debtor.language, debtor.currency);
  const userPrompt = buildUserPrompt(debtor, outstandingInvoices, history, effectiveAction, brief.text);

  // 5. Call Claude (Sonnet — cost-effective, fast)
  const result = await generateJSON<CollectionEmailResult>({
    system: systemPrompt,
    prompt: userPrompt,
    model: "standard", // claude-sonnet
    temperature: 0.4,
    maxTokens: 1024,
  });

  return {
    subject: result.subject || "Payment Reminder",
    body: result.body || "",
    agentReasoning: result.agentReasoning || "",
  };
}

// ── Data loaders ─────────────────────────────────────────────

async function resolvePersona(tenantId: string): Promise<AgentPersona> {
  const [persona] = await db
    .select()
    .from(agentPersonas)
    .where(and(eq(agentPersonas.tenantId, tenantId), eq(agentPersonas.isActive, true)))
    .limit(1);

  if (!persona) {
    throw new Error(`No active agent persona found for tenant ${tenantId}. Create one in Settings → Agent Personas.`);
  }
  return persona;
}

async function loadDebtorProfile(tenantId: string, contactId: string): Promise<DebtorProfile> {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
    .limit(1);

  if (!contact) {
    throw new Error(`Contact ${contactId} not found for tenant ${tenantId}`);
  }

  // Load tenant for currency/language defaults
  const [tenant] = await db
    .select({ currency: tenants.currency, defaultLanguage: tenants.defaultLanguage })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  // Load behaviour signals if available
  let behaviour: DebtorProfile["behaviour"] | undefined;
  const [signals] = await db
    .select()
    .from(customerBehaviorSignals)
    .where(and(
      eq(customerBehaviorSignals.contactId, contactId),
      eq(customerBehaviorSignals.tenantId, tenantId),
    ))
    .limit(1);

  if (signals) {
    behaviour = {
      medianDaysToPay: signals.medianDaysToPay ? Number(signals.medianDaysToPay) : undefined,
      trend: signals.trend ? Number(signals.trend) : undefined,
      promiseBreachCount: signals.promiseBreachCount ?? undefined,
      emailReplyRate: signals.emailReplyRate ? Number(signals.emailReplyRate) : undefined,
    };
  }

  return {
    companyName: contact.companyName || contact.name,
    contactName: contact.arContactName || contact.name,
    contactEmail: contact.arContactEmail || contact.email || "",
    paymentTerms: contact.paymentTerms ?? 30,
    creditLimit: contact.creditLimit ? Number(contact.creditLimit) : undefined,
    riskTag: (contact.playbookRiskTag as "NORMAL" | "HIGH_VALUE") || "NORMAL",
    currency: contact.preferredCurrency || tenant?.currency || 'GBP',
    language: contact.preferredLanguage || tenant?.defaultLanguage || 'en-GB',
    isPotentiallyVulnerable: contact.isPotentiallyVulnerable ?? false,
    arNotes: contact.arNotes ?? undefined,
    behaviour,
  };
}

async function loadOutstandingInvoices(tenantId: string, contactId: string): Promise<OutstandingInvoice[]> {
  const rows = await db
    .select()
    .from(invoices)
    .where(and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.contactId, contactId),
    ))
    .orderBy(desc(invoices.dueDate));

  const now = new Date();
  return rows
    .filter(inv => {
      // Only include unpaid / partially paid invoices that aren't cancelled
      const isPaid = inv.status === "paid" || inv.status === "cancelled";
      const isVoided = inv.invoiceStatus === "VOID" || inv.invoiceStatus === "PAID";
      return !isPaid && !isVoided;
    })
    .map(inv => {
      const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        invoiceNumber: inv.invoiceNumber,
        amount: Number(inv.amount),
        amountPaid: Number(inv.amountPaid ?? 0),
        dueDate: inv.dueDate,
        daysOverdue,
        currency: inv.currency ?? "GBP",
        workflowState: (inv.workflowState as OutstandingInvoice["workflowState"]) || "pre_due",
        pauseState: (inv.pauseState as OutstandingInvoice["pauseState"]) || null,
      };
    });
}

async function loadConversationHistory(tenantId: string, contactId: string): Promise<ConversationEntry[]> {
  const rows = await db
    .select()
    .from(timelineEvents)
    .where(and(
      eq(timelineEvents.tenantId, tenantId),
      eq(timelineEvents.customerId, contactId),
    ))
    .orderBy(desc(timelineEvents.occurredAt))
    .limit(10);

  return rows.map(row => ({
    date: row.occurredAt,
    channel: row.channel,
    direction: row.direction as ConversationEntry["direction"],
    summary: row.summary,
    outcomeType: row.outcomeType ?? undefined,
    sentiment: undefined, // timelineEvents doesn't have sentiment; available on actions
  }));
}

async function loadPolicy(tenantId: string) {
  const [policy] = await db
    .select()
    .from(collectionPolicies)
    .where(and(
      eq(collectionPolicies.tenantId, tenantId),
      eq(collectionPolicies.isDefault, true),
    ))
    .limit(1);

  return policy ?? null;
}
