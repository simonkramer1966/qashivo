/**
 * Riley AI Assistant — the system brain.
 *
 * Onboarding guide, business intelligence gatherer, virtual CFO,
 * system help, and action taker. Every response is LLM-generated
 * with full context of the customer's business.
 *
 * MVP v1.1 Build Spec Sprint 7 / Context Addendum Section 20.
 */

import { storage } from "../storage";
import { db } from "../db";
import { eq, and, desc, gte, sql, count } from "drizzle-orm";
import {
  invoices,
  contacts,
  paymentPromises,
  messageDrafts,
  type AiFact,
} from "@shared/schema";
import {
  generateConversation,
  generateJSON,
  type ConversationMessage,
} from "../services/llm/claude";

// ── Types ───────────────────────────────────────────────────

export type RileyTopic =
  | "debtor_intel"
  | "forecast_input"
  | "system_help"
  | "onboarding"
  | "weekly_review";

export interface RileyContext {
  userName: string;
  userRole: string;
  pageContext: string;
  topic: RileyTopic;
  isOnboarding: boolean;
  tenantSnapshot: TenantSnapshot;
  relevantFacts: AiFact[];
  relatedEntityType?: string;
  relatedEntityId?: string;
}

interface TenantSnapshot {
  totalOutstanding: number;
  overdueAmount: number;
  debtorCount: number;
  currentDso: number;
  overdueCount: number;
  tenantName: string;
  currency: string;
}

export interface ProactiveSuggestion {
  type: string;
  message: string;
  priority: "high" | "medium" | "low";
  entityId?: string;
}

interface ExtractionResult {
  facts: Array<{
    category: string;
    entityType?: string;
    entityId?: string;
    factKey: string;
    factValue: string;
    confidence: number;
  }>;
  forecastInputs: Array<{
    category: string;
    description: string;
    amount: number;
    timingType: string;
    startDate?: string;
    endDate?: string;
    affects: string;
  }>;
  debtorUpdates: Array<{
    contactId: string;
    field: string;
    value: string;
  }>;
  actionRequests: Array<{
    type: string;
    entityId?: string;
    details: string;
  }>;
}

// ── System Prompt Assembly ───────────────────────────────────

const RILEY_IDENTITY = `You are Riley, an AI assistant built into Qashivo — a credit control and cashflow platform for UK SMEs.

Your personality:
- Friendly, warm, and approachable — but professional. You're the colleague everyone likes.
- You speak in plain English. No jargon unless explaining a concept, then you define it.
- You use £ (GBP), not $. You understand UK business context: HMRC, Companies House, Late Payment of Commercial Debts Act 1998, FCA guidelines.
- You're conversational, not robotic. Use contractions ("I've", "you're", "let's"). Keep responses concise — 2-4 sentences for simple answers, longer for analysis.
- You NEVER say "I'm an AI" or "As an AI". The user knows what you are. Just be helpful.
- You connect the dots — if a debtor discussion has cashflow implications, mention it.
- When you learn something about the business, naturally acknowledge it ("Good to know — I'll factor that in").`;

const PRODUCT_KNOWLEDGE = `Qashivo has three pillars:

**Qollections (Credit Control):**
- AI-powered collections agent that chases debtors via email on behalf of the business
- Agent has a configurable persona (name, title, tone, signature)
- Autonomy modes: Semi-Auto (user approves before sending), Full Auto (agent sends autonomously)
- AR overlay: user-curated data (arContactEmail, arContactPhone, arNotes) that sits on top of Xero data and is never overwritten by sync
- Data Health: assesses debtor readiness — Ready, Needs Email, Generic Email, Needs Phone, Needs Attention
- DSO (Days Sales Outstanding): key metric for collection efficiency — lower is better
- Workflows, escalation rules, and collection policies control agent behaviour

**Qashflow (Cashflow Forecasting):**
- 13-week rolling cashflow forecast (being built)
- Forecast user adjustments: known upcoming costs, revenue changes, hiring, capex
- Weekly CFO review: Riley prepares a plain-English cashflow briefing each week
- Three scenarios: optimistic (pay on time), expected (pay at historic average), pessimistic

**Qapital (Working Capital Finance):**
- Invoice finance marketplace (future feature)
- Connects cashflow gaps to finance options
- Risk assessment for eligibility

**Key terminology:**
- "Agent persona": the AI credit controller identity that sends emails
- "Compliance check": every outbound message is checked against rules before sending
- "Timeline events": log of all communications and actions for a debtor
- "Promise to pay": a debtor's commitment to pay by a specific date
- "Open Banking": read-only bank connection for real-time cash position`;

function buildOnboardingGuidance(topic: RileyTopic): string {
  if (topic !== "onboarding") return "";
  return `\n\nONBOARDING MODE:
You are guiding a new user through setup. Be encouraging and clear about what's happening at each step.
After Xero syncs, review the top debtors and ask targeted questions:
- Relationship type (key client, standard, difficult)
- Preferred contact and any sensitivities
- Payment quirks or special arrangements
- Any debtors to avoid chasing

For weekly review setup, ask: "When would you like your weekly cashflow catch-up? Most clients like Monday mornings or Friday afternoons."

Keep it conversational — you're building rapport while gathering intelligence.`;
}

export function buildRileySystemPrompt(context: RileyContext): string {
  const {
    userName,
    userRole,
    pageContext,
    topic,
    isOnboarding,
    tenantSnapshot,
    relevantFacts,
  } = context;

  const factsBlock =
    relevantFacts.length > 0
      ? `\n\nBUSINESS INTELLIGENCE (facts you've learned):\n${relevantFacts
          .map(
            (f) =>
              `- [${f.category}] ${f.factKey || f.title}: ${f.factValue || f.content}${f.entityId ? ` (entity: ${f.entityId})` : ""}${f.confidence ? ` (confidence: ${f.confidence})` : ""}`,
          )
          .join("\n")}`
      : "";

  const parts = [
    RILEY_IDENTITY,
    PRODUCT_KNOWLEDGE,
    `\nCURRENT USER: ${userName} (${userRole})`,
    `CURRENT PAGE: ${pageContext}`,
    `CONVERSATION TOPIC: ${topic}`,
    `\nTENANT SNAPSHOT (${tenantSnapshot.tenantName}):`,
    `- Total outstanding: £${tenantSnapshot.totalOutstanding.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
    `- Overdue amount: £${tenantSnapshot.overdueAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
    `- Overdue invoices: ${tenantSnapshot.overdueCount}`,
    `- Active debtors: ${tenantSnapshot.debtorCount}`,
    `- Current DSO: ${tenantSnapshot.currentDso} days`,
    `- Currency: ${tenantSnapshot.currency}`,
    factsBlock,
    buildOnboardingGuidance(topic),
    `\nINSTRUCTIONS:
- Respond naturally and conversationally. Keep it concise.
- If you learn something about the business, acknowledge it — it will be extracted and stored after the conversation.
- If the user asks about their data, reference the snapshot and facts above. Explain in plain English.
- If the user wants to take an action (pause a debtor, change settings, etc.), confirm what they want before saying you'll do it. You cannot execute actions directly — note what was requested.
- Connect insights across pillars when relevant (e.g., "That overdue invoice from Acme affects your cashflow forecast too").
- For debtor-specific questions, use any facts you have. If you don't have context, ask.
- Never fabricate data. If you don't know, say so and suggest where to look.`,
  ];

  return parts.join("\n");
}

// ── Tenant Snapshot Assembly ─────────────────────────────────

async function getTenantSnapshot(tenantId: string): Promise<TenantSnapshot> {
  const tenant = await storage.getTenant(tenantId);
  const tenantName = tenant?.name || "Unknown";
  const currency = tenant?.currency || "GBP";

  let totalOutstanding = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let currentDso = 0;

  try {
    const metrics = await storage.getInvoiceMetrics(tenantId);
    totalOutstanding = metrics.totalOutstanding || 0;
    overdueAmount = (metrics as any).overdueAmount || 0;
    overdueCount = metrics.overdueCount || 0;
    currentDso = metrics.dso || 0;
  } catch {
    // Metrics may not be available for new tenants
  }

  // Count active debtors
  let debtorCount = 0;
  try {
    const [result] = await db
      .select({ count: count() })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          eq(contacts.role, "customer"),
          eq(contacts.isActive, true),
        ),
      );
    debtorCount = Number(result?.count || 0);
  } catch {
    // Graceful fallback
  }

  return {
    totalOutstanding,
    overdueAmount,
    debtorCount,
    currentDso,
    overdueCount,
    tenantName,
    currency,
  };
}

// ── Core API ─────────────────────────────────────────────────

export async function getRileyResponse(params: {
  tenantId: string;
  userId: string;
  conversationId: string | null;
  userMessage: string;
  pageContext: string;
  topic: RileyTopic;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Promise<{ response: string; conversationId: string }> {
  const {
    tenantId,
    userId,
    conversationId,
    userMessage,
    pageContext,
    topic,
    relatedEntityType,
    relatedEntityId,
  } = params;

  // 1. Load or create conversation
  let conversation = conversationId
    ? await storage.getRileyConversation(conversationId, tenantId)
    : null;

  if (!conversation) {
    conversation = await storage.createRileyConversation({
      tenantId,
      userId,
      messages: [],
      topic,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
    });
  }

  // 2. Fetch context in parallel
  const [user, tenantSnapshot, relevantFacts] = await Promise.all([
    storage.getUser(userId),
    getTenantSnapshot(tenantId),
    storage.listAiFacts(
      tenantId,
      relatedEntityId || undefined,
    ),
  ]);

  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const userRole = user?.role || "owner";

  // 3. Build system prompt
  const systemPrompt = buildRileySystemPrompt({
    userName,
    userRole,
    pageContext,
    topic,
    isOnboarding: topic === "onboarding",
    tenantSnapshot,
    relevantFacts: relevantFacts.slice(0, 30), // Cap to avoid token bloat
    relatedEntityType,
    relatedEntityId,
  });

  // 4. Build conversation messages (last 20)
  const existingMessages = (conversation.messages as Array<{ role: string; content: string }>) || [];
  const recentMessages = existingMessages.slice(-19); // Leave room for new user message
  const conversationHistory: ConversationMessage[] = recentMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  conversationHistory.push({ role: "user", content: userMessage });

  // 5. Call Claude
  const response = await generateConversation({
    system: systemPrompt,
    messages: conversationHistory,
    model: "standard",
    temperature: 0.5,
    maxTokens: 1024,
  });

  // 6. Append messages and save
  const now = new Date().toISOString();
  const updatedMessages = [
    ...existingMessages,
    { role: "user", content: userMessage, timestamp: now },
    { role: "assistant", content: response, timestamp: now },
  ];

  await storage.updateRileyConversation(conversation.id, tenantId, {
    messages: updatedMessages as any,
  });

  return { response, conversationId: conversation.id };
}

// ── Intelligence Extraction ──────────────────────────────────

const EXTRACTION_PROMPT = `You are an intelligence extraction engine. Given a conversation between Riley (an AI assistant) and a user of Qashivo (a UK credit control platform), extract any structured business intelligence.

Return JSON with these arrays (any can be empty):

- facts[]: Business intelligence learned. Each: { category, entityType?, entityId?, factKey, factValue, confidence }
  Categories: "debtor_relationship", "payment_behaviour", "business_context", "seasonal_pattern", "cashflow_input", "finance_preference", "industry_norm", "internal_policy", "contact_intel"
  Confidence: 1.0 if user stated directly, 0.7 if reasonably inferred, 0.5 if speculative.

- forecastInputs[]: Cashflow-relevant items. Each: { category, description, amount, timingType, startDate?, endDate?, affects }
  Categories: "revenue_change", "cost_change", "hiring", "capex", "tax", "other"
  timingType: "one_off_date", "date_range", "recurring_monthly"
  affects: "inflows" or "outflows"
  Only include if a specific amount or estimate was mentioned.

- debtorUpdates[]: AR overlay updates. Each: { contactId, field, value }
  Fields: "arNotes", "arContactEmail", "arContactPhone", "preferredContactMethod", "paymentTerms"
  Only include if the user explicitly asked to update a debtor's info and a contactId is identifiable.

- actionRequests[]: Actions the user asked Riley to perform. Each: { type, entityId?, details }
  Types: "pause_debtor", "resume_debtor", "change_tone", "add_note", "send_email", "other"
  Only include if the user explicitly asked to take an action.

If the conversation is just greetings or small talk with no business content, return all empty arrays.`;

export async function extractIntelligence(
  conversationId: string,
  tenantId: string,
): Promise<void> {
  try {
    const conversation = await storage.getRileyConversation(
      conversationId,
      tenantId,
    );
    if (!conversation) return;

    const messages = conversation.messages as Array<{
      role: string;
      content: string;
    }>;
    if (messages.length < 2) return; // Need at least one exchange

    // Take the last 10 messages for extraction (keeps token cost low)
    const recentMessages = messages.slice(-10);
    const conversationText = recentMessages
      .map((m) => `${m.role === "user" ? "User" : "Riley"}: ${m.content}`)
      .join("\n\n");

    const result = await generateJSON<ExtractionResult>({
      system: EXTRACTION_PROMPT,
      prompt: `Extract intelligence from this conversation:\n\n${conversationText}`,
      model: "fast", // Use Haiku for cost efficiency
      temperature: 0.1,
      maxTokens: 2048,
      schemaHint:
        '{ facts: [{category, entityType?, entityId?, factKey, factValue, confidence}], forecastInputs: [{category, description, amount, timingType, startDate?, endDate?, affects}], debtorUpdates: [{contactId, field, value}], actionRequests: [{type, entityId?, details}] }',
    });

    // Write facts to aiFacts
    if (result.facts?.length) {
      for (const fact of result.facts) {
        await storage.upsertAiFact({
          tenantId,
          category: fact.category,
          title: fact.factKey,
          content: fact.factValue,
          entityType: fact.entityType || null,
          entityId: fact.entityId || null,
          factKey: fact.factKey,
          factValue: fact.factValue,
          confidence: String(fact.confidence),
          source: "riley_conversation",
          sourceConversationId: conversationId,
        });
      }
    }

    // Write forecast inputs
    if (result.forecastInputs?.length) {
      for (const input of result.forecastInputs) {
        const enteredDate = new Date();
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 3);

        // Compute materiality score if we can estimate monthly revenue
        let materialityScore: string | undefined;
        try {
          const metrics = await storage.getInvoiceMetrics(tenantId);
          const monthlyRevenue = metrics.totalOutstanding > 0
            ? metrics.totalOutstanding / 3 // Rough estimate: outstanding / 3 months
            : 0;
          if (monthlyRevenue > 0) {
            materialityScore = String(
              Math.round((Math.abs(input.amount) / monthlyRevenue) * 10000) /
                10000,
            );
          }
        } catch {
          // Skip materiality if metrics unavailable
        }

        await storage.createForecastAdjustment({
          tenantId,
          category: input.category,
          description: input.description,
          amount: String(input.amount),
          timingType: input.timingType,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          enteredDate,
          expiryDate,
          affects: input.affects,
          source: "riley_conversation",
          sourceConversationId: conversationId,
          materialityScore: materialityScore || null,
        });
      }
    }

    // Apply debtor updates (AR overlay fields only)
    if (result.debtorUpdates?.length) {
      const safeFields = new Set([
        "arNotes",
        "arContactEmail",
        "arContactPhone",
        "preferredContactMethod",
        "paymentTerms",
        "notes",
      ]);

      for (const update of result.debtorUpdates) {
        if (!update.contactId || !safeFields.has(update.field)) continue;
        try {
          const fieldUpdate: Record<string, any> = {};
          if (update.field === "paymentTerms") {
            fieldUpdate[update.field] = parseInt(update.value, 10);
          } else {
            fieldUpdate[update.field] = update.value;
          }
          await storage.updateContact(
            update.contactId,
            tenantId,
            fieldUpdate as any,
          );
        } catch {
          // Skip individual update failures
        }
      }
    }

    // Log action requests (don't execute — that's a later task)
    if (result.actionRequests?.length) {
      console.log(
        `[Riley] Action requests from conversation ${conversationId}:`,
        JSON.stringify(result.actionRequests),
      );
    }
  } catch (error) {
    console.error(
      `[Riley] Intelligence extraction failed for conversation ${conversationId}:`,
      error,
    );
    // Don't throw — extraction failures should never break the chat flow
  }
}

// ── Proactive Suggestions ────────────────────────────────────

export async function getProactiveSuggestions(
  tenantId: string,
): Promise<ProactiveSuggestion[]> {
  const suggestions: ProactiveSuggestion[] = [];
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  try {
    // 1. Broken promises this week
    const brokenPromises = await storage.getPaymentPromises(tenantId, {
      status: "broken",
    });
    const recentBroken = brokenPromises.filter(
      (p) => p.createdAt && new Date(p.createdAt) >= oneWeekAgo,
    );
    if (recentBroken.length >= 2) {
      suggestions.push({
        type: "broken_promises",
        message: `${recentBroken.length} debtors broke their payment promises this week — want me to show you?`,
        priority: "high",
      });
    }

    // 2. Pending approval drafts
    try {
      const pendingDrafts = await storage.getMessageDrafts(
        tenantId,
        "pending_approval",
      );
      if (pendingDrafts.length > 0) {
        suggestions.push({
          type: "pending_approvals",
          message: `${pendingDrafts.length} email${pendingDrafts.length === 1 ? "" : "s"} waiting for your approval`,
          priority: pendingDrafts.length >= 5 ? "high" : "medium",
        });
      }
    } catch {
      // Message drafts may not have pending items
    }

    // 3. DSO change vs last snapshot
    try {
      const snapshots = await storage.getDsoSnapshots(tenantId, 14);
      if (snapshots.length >= 2) {
        const latest = Number(snapshots[0].dsoValue);
        const previous = Number(snapshots[snapshots.length - 1].dsoValue);
        const change = latest - previous;
        if (change <= -3) {
          suggestions.push({
            type: "dso_improvement",
            message: `Your DSO improved by ${Math.abs(Math.round(change))} days recently — nice work!`,
            priority: "low",
          });
        } else if (change >= 5) {
          suggestions.push({
            type: "dso_deterioration",
            message: `Your DSO has increased by ${Math.round(change)} days — want to look at what's causing it?`,
            priority: "medium",
          });
        }
      }
    } catch {
      // DSO snapshots may not exist yet
    }

    // 4. Expiring forecast adjustments
    try {
      const adjustments = await storage.listForecastAdjustments(tenantId);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const expiring = adjustments.filter(
        (a) =>
          !a.expired &&
          a.expiryDate &&
          new Date(a.expiryDate) <= nextWeek &&
          a.followUpStatus === "pending",
      );
      for (const adj of expiring.slice(0, 3)) {
        suggestions.push({
          type: "forecast_expiring",
          message: `The ${adj.description} (£${Number(adj.amount).toLocaleString("en-GB")}) was expected — did it go through?`,
          priority:
            Number(adj.materialityScore || 0) > 0.1 ? "high" : "medium",
          entityId: adj.id,
        });
      }
    } catch {
      // Forecast adjustments may not exist yet
    }

    // 5. New overdue invoices (invoices that became overdue in last 7 days)
    try {
      const [result] = await db
        .select({ count: count() })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.status, "overdue"),
            gte(invoices.dueDate, oneWeekAgo),
          ),
        );
      const newOverdue = Number(result?.count || 0);
      if (newOverdue >= 3) {
        suggestions.push({
          type: "new_overdue",
          message: `${newOverdue} invoices became overdue this week`,
          priority: "medium",
        });
      }
    } catch {
      // Invoice query may fail for new tenants
    }
  } catch (error) {
    console.error("[Riley] Failed to generate proactive suggestions:", error);
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  return suggestions;
}
