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
  weeklyReviews,
  type AiFact,
} from "@shared/schema";
import {
  generateConversation,
  streamConversation,
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

// ── Page Context Assembly ────────────────────────────────────

function formatGBP(amount: number): string {
  return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date | string | null): string {
  if (!d) return "N/A";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Deep debtor context — loaded when user is viewing a specific debtor record.
 */
export async function buildDebtorContext(contactId: string, tenantId: string): Promise<string> {
  try {
    // Parallel fetch all debtor data
    const [contact, contactInvoices, contactPersons, aiFacts] = await Promise.all([
      storage.getContact(contactId, tenantId),
      storage.getInvoicesByContact(contactId, tenantId),
      storage.getCustomerContactPersons(tenantId, contactId),
      storage.listAiFacts(tenantId, contactId),
    ]);

    if (!contact) return `DEBTOR CONTEXT: Contact not found (${contactId})`;

    // Fetch last 20 actions for this contact
    let recentActions: any[] = [];
    try {
      const allActions = await storage.getActions(tenantId, 500);
      recentActions = allActions
        .filter((a: any) => a.contactId === contactId)
        .slice(0, 20);
    } catch { /* graceful */ }

    // Compute payment statistics
    const now = new Date();
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let paidOnTime = 0;
    let paidTotal = 0;
    let totalDaysToPay = 0;
    let paidWithDaysCount = 0;

    const overdueInvoices: any[] = [];
    const otherInvoices: any[] = [];

    for (const inv of contactInvoices) {
      const amount = Number(inv.amount || 0);
      const status = (inv.status || "").toLowerCase();

      if (status === "paid") {
        paidTotal++;
        if (inv.paidDate && inv.dueDate) {
          const paidDate = new Date(inv.paidDate);
          const dueDate = new Date(inv.dueDate);
          const daysToPay = Math.round((paidDate.getTime() - new Date(inv.issueDate || inv.createdAt || dueDate).getTime()) / 86400000);
          if (daysToPay > 0) {
            totalDaysToPay += daysToPay;
            paidWithDaysCount++;
          }
          if (paidDate <= dueDate) paidOnTime++;
        }
      } else if (["authorised", "sent", "overdue"].includes(status)) {
        totalOutstanding += amount;
        if (inv.dueDate && new Date(inv.dueDate) < now) {
          totalOverdue += amount;
          overdueCount++;
          const daysOverdue = Math.round((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
          overdueInvoices.push({ ...inv, amount, daysOverdue });
        } else {
          otherInvoices.push({ ...inv, amount, daysOverdue: 0 });
        }
      }
    }

    // Sort: overdue (most days first), then upcoming by due date
    overdueInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue);
    otherInvoices.sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const db2 = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return da - db2;
    });

    const avgDaysToPay = paidWithDaysCount > 0 ? Math.round(totalDaysToPay / paidWithDaysCount) : 0;
    const onTimeRate = paidTotal > 0 ? Math.round((paidOnTime / paidTotal) * 100) : 0;

    // Build the text block
    const lines: string[] = [];
    lines.push(`DEBTOR: ${contact.companyName || contact.name}`);
    lines.push(`Outstanding: ${formatGBP(totalOutstanding)} | Overdue: ${formatGBP(totalOverdue)} | Avg days to pay: ${avgDaysToPay || "N/A"}`);
    lines.push(`Risk score: ${contact.riskScore ?? "Not assessed"} (${contact.riskBand || "N/A"}) | On-time rate: ${onTimeRate}%`);
    lines.push(`Blocked from chasing: ${contact.manualBlocked ? "Yes" : "No"} | Vulnerable: ${contact.isPotentiallyVulnerable ? "Yes" : "No"}`);
    lines.push(`Stage: ${contact.playbookStage || "CREDIT_CONTROL"} | Contact method: ${contact.preferredContactMethod || "email"}`);
    if (contact.arNotes) lines.push(`Internal notes: ${contact.arNotes}`);
    if (contact.notes) lines.push(`General notes: ${contact.notes}`);

    // Contact persons
    lines.push("");
    lines.push("CONTACTS ON FILE:");
    // Primary from contact record
    const primaryEmail = contact.arContactEmail || contact.email || "Not set";
    const primaryPhone = contact.arContactPhone || contact.phone || "Not set";
    lines.push(`- ${contact.arContactName || contact.name} — Primary`);
    lines.push(`  Email: ${primaryEmail} | Phone: ${primaryPhone}`);

    if (contactPersons.length > 0) {
      for (const cp of contactPersons) {
        const roles: string[] = [];
        if ((cp as any).isPrimaryCreditControl) roles.push("Primary AR Contact");
        if ((cp as any).isEscalation) roles.push("Escalation Contact");
        if (roles.length === 0) roles.push("Other");
        lines.push(`- ${cp.name || "Unnamed"} (${(cp as any).jobTitle || "No title"}) — ${roles.join(", ")}`);
        lines.push(`  Email: ${cp.email || "Not set"} | Phone: ${cp.phone || "Not set"}`);
      }
    }

    // Invoices
    const allDisplayInvoices = [...overdueInvoices, ...otherInvoices].slice(0, 30);
    lines.push("");
    lines.push(`INVOICES (${contactInvoices.length} total, ${overdueCount} overdue):`);
    for (const inv of allDisplayInvoices) {
      let line = `- ${inv.invoiceNumber || "No number"} ${formatGBP(inv.amount)} due ${formatDate(inv.dueDate)}`;
      if (inv.daysOverdue > 0) line += ` — ${inv.daysOverdue} days overdue`;
      if ((inv.status || "").toLowerCase() === "paid") line += ` — paid ${formatDate(inv.paidDate)}`;
      lines.push(line);
    }
    if (contactInvoices.length > 30) {
      lines.push(`... and ${contactInvoices.length - 30} more invoices`);
    }

    // Agent activity
    lines.push("");
    lines.push(`AGENT ACTIVITY (last ${recentActions.length} actions):`);
    if (recentActions.length === 0) {
      lines.push("No agent actions recorded yet.");
    } else {
      for (const action of recentActions) {
        const date = formatDate(action.createdAt);
        const summary = action.subject || action.type || "Action";
        lines.push(`- ${date}: ${action.type} — ${summary}`);
        if (action.intentType) lines.push(`  → Intent detected: ${action.intentType} (${action.sentiment || "neutral"})`);
      }
    }

    // AI Facts
    lines.push("");
    lines.push("RILEY'S KNOWN FACTS ABOUT THIS DEBTOR:");
    if (aiFacts.length === 0) {
      lines.push("None gathered yet — this is your first conversation about them.");
    } else {
      for (const f of aiFacts.slice(0, 20)) {
        lines.push(`- ${f.factKey || f.title}: ${f.factValue || f.content} (confidence: ${f.confidence || "N/A"}, source: ${f.source || "unknown"})`);
      }
    }

    // Gap 6: Debtor intelligence enrichment context
    try {
      const { db: dbEnrich } = await import("../db");
      const { debtorIntelligence } = await import("@shared/schema");
      const { eq: eqEnrich, and: andEnrich } = await import("drizzle-orm");

      const [intel] = await dbEnrich
        .select()
        .from(debtorIntelligence)
        .where(andEnrich(
          eqEnrich(debtorIntelligence.contactId, contactId),
          eqEnrich(debtorIntelligence.tenantId, tenantId),
        ))
        .limit(1);

      if (intel) {
        lines.push("");
        lines.push("COMPANY INTELLIGENCE:");
        const parts: string[] = [];
        if (intel.companyStatus) parts.push(`status: ${intel.companyStatus}`);
        if (intel.companyAge !== null) parts.push(`${intel.companyAge} years old`);
        if (intel.industrySector) parts.push(`sector: ${intel.industrySector}`);
        if (intel.sizeClassification) parts.push(`size: ${intel.sizeClassification}`);
        if (intel.companiesHouseNumber) parts.push(`CH# ${intel.companiesHouseNumber}`);
        if (intel.creditRiskScore !== null) parts.push(`credit risk score: ${intel.creditRiskScore}/100`);
        if (intel.lateFilingCount && intel.lateFilingCount > 0) parts.push(`${intel.lateFilingCount} late filings`);
        if (intel.insolvencyRisk) parts.push("WARNING: insolvency risk detected");
        if (parts.length > 0) lines.push(parts.join(", "));
        if (intel.aiRiskSummary) lines.push(`Risk assessment: ${intel.aiRiskSummary}`);
        if (intel.registeredAddress) lines.push(`Registered: ${intel.registeredAddress}`);
      }
    } catch { /* graceful — enrichment context is supplementary */ }

    // Gap 7: Payment distribution forecast
    try {
      const { db } = await import("../db");
      const { customerBehaviorSignals } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const { fitDistribution, describeDistribution, getPaymentForecast } = await import("../services/paymentDistribution");

      const [signals] = await db
        .select()
        .from(customerBehaviorSignals)
        .where(and(
          eq(customerBehaviorSignals.contactId, contactId),
          eq(customerBehaviorSignals.tenantId, tenantId),
        ))
        .limit(1);

      if (signals?.medianDaysToPay) {
        // Gap 13: Fetch seasonal adjustments for this debtor
        const { getEffectiveSeasonalAdjustments } = await import("../services/paymentDistribution");
        const seasonalAdj = await getEffectiveSeasonalAdjustments(tenantId, contactId);

        const params = fitDistribution(
          Number(signals.medianDaysToPay),
          signals.p75DaysToPay ? Number(signals.p75DaysToPay) : null,
          signals.volatility ? Number(signals.volatility) : null,
          signals.trend ? Number(signals.trend) : null,
          undefined,
          seasonalAdj,
        );
        const description = describeDistribution(params);
        const forecast = getPaymentForecast(params, 0.8);
        lines.push("");
        lines.push(`PAYMENT PATTERN: Based on their history, this debtor ${description}. Forecast: optimistic day ${forecast.optimisticDate}, expected day ${forecast.expectedDate}, pessimistic day ${forecast.pessimisticDate}.`);
        if (signals.trend && Number(signals.trend) > 0.5) {
          lines.push(`⚠ Payment trend is deteriorating (trend: +${Number(signals.trend).toFixed(1)}). This debtor is paying slower over time.`);
        } else if (signals.trend && Number(signals.trend) < -0.5) {
          lines.push(`Payment trend is improving (trend: ${Number(signals.trend).toFixed(1)}). This debtor is paying faster over time.`);
        }
        // Gap 13: Note seasonal effects
        const currentMonth = new Date().getMonth() + 1;
        const activeSeasonalForNow = seasonalAdj.filter(a => a.month === currentMonth);
        if (activeSeasonalForNow.length > 0) {
          const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const types = activeSeasonalForNow.map(a => a.adjustmentType === 'slow' ? 'slower payments' : a.adjustmentType === 'year_end' ? 'year-end acceleration' : 'faster payments');
          lines.push(`Seasonal note: ${monthNames[currentMonth]} typically shows ${types.join(' and ')} for this debtor.`);
        }
      }
    } catch { /* graceful — distribution context is supplementary */ }

    return lines.join("\n");
  } catch (error) {
    console.error(`[Riley] buildDebtorContext failed for ${contactId}:`, error);
    return `DEBTOR CONTEXT: Failed to load context for contact ${contactId}`;
  }
}

/**
 * Build page-aware context based on the current route the user is viewing.
 */
async function buildPageContext(
  pageContext: string,
  tenantId: string,
  relatedEntityType?: string,
  relatedEntityId?: string,
): Promise<string> {
  // Detect debtor context from either explicit entity or URL pattern
  const debtorId = detectDebtorId(pageContext, relatedEntityType, relatedEntityId);
  if (debtorId) {
    return buildDebtorContext(debtorId, tenantId);
  }

  try {
    // Route-based context loading
    const route = pageContext.toLowerCase();

    // ── Debtors list ──
    if (route.includes("/qollections/debtors") || route === "debtors list") {
      return await buildDebtorsListContext(tenantId);
    }

    // ── Invoice detail ──
    if (relatedEntityType === "invoice" && relatedEntityId) {
      return await buildInvoiceDetailContext(relatedEntityId, tenantId);
    }

    // ── Invoices list ──
    if (route.includes("/qollections/invoices") || route === "invoices") {
      return await buildInvoicesListContext(tenantId);
    }

    // ── Agent activity ──
    if (route.includes("/qollections/agent-activity") || route.includes("agent activity")) {
      return await buildActivityContext(tenantId);
    }

    // ── Qashflow (weekly review) ──
    if (route.includes("/qashflow") || route === "qashflow") {
      return await buildQashflowContext(tenantId);
    }

    // ── Data Health ──
    if (route.includes("/settings/data-health") || route === "data health") {
      return await buildDataHealthContext(tenantId);
    }

    // ── Settings pages ──
    if (route.includes("/settings") || route.includes("settings")) {
      return await buildSettingsContext(tenantId);
    }

    // ── Onboarding ──
    if (route.includes("/onboarding") || route === "onboarding") {
      return await buildOnboardingContext(tenantId);
    }

    // Default: no extra page context (tenant snapshot is always present)
    return "";
  } catch (error) {
    console.error("[Riley] buildPageContext failed:", error);
    return "";
  }
}

function detectDebtorId(
  pageContext: string,
  relatedEntityType?: string,
  relatedEntityId?: string,
): string | null {
  // Explicit entity
  if (relatedEntityType === "debtor" && relatedEntityId) return relatedEntityId;
  // URL pattern: /qollections/debtors/<uuid>
  const match = pageContext.match(/\/qollections\/debtors\/([0-9a-f-]{36})/i);
  return match?.[1] || null;
}

async function buildDebtorsListContext(tenantId: string): Promise<string> {
  const lines: string[] = ["PAGE CONTEXT: Debtors List"];

  const [metrics, brokenPromises, pendingDrafts] = await Promise.all([
    storage.getInvoiceMetrics(tenantId).catch(() => null),
    storage.getPaymentPromises(tenantId, { status: "broken" }).catch(() => []),
    storage.getMessageDrafts(tenantId, "pending_approval").catch(() => []),
  ]);

  if (metrics) {
    lines.push(`AR Summary: ${formatGBP(metrics.totalOutstanding || 0)} outstanding, ${formatGBP((metrics as any).overdueAmount || 0)} overdue`);
    lines.push(`Debtors: ${metrics.totalInvoiceCount || 0} invoices, ${metrics.overdueCount || 0} overdue, DSO: ${metrics.dso || 0} days`);
  }
  lines.push(`Pending approvals: ${pendingDrafts.length} emails awaiting review`);

  // Broken promises this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentBroken = brokenPromises.filter((p: any) => p.createdAt && new Date(p.createdAt) >= oneWeekAgo);
  if (recentBroken.length > 0) {
    lines.push(`Broken promises this week: ${recentBroken.length}`);
  }

  // Top 5 debtors by overdue amount
  try {
    const overdueInvs = await storage.getOverdueInvoices(tenantId);
    const debtorTotals = new Map<string, { name: string; total: number }>();
    for (const inv of overdueInvs) {
      const cid = (inv as any).contactId;
      const name = (inv as any).contact?.name || "Unknown";
      const existing = debtorTotals.get(cid) || { name, total: 0 };
      existing.total += Number(inv.amount || 0);
      debtorTotals.set(cid, existing);
    }
    const sorted = Array.from(debtorTotals.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    if (sorted.length > 0) {
      lines.push("\nTop 5 debtors by overdue amount:");
      for (const [, { name, total }] of sorted) {
        lines.push(`- ${name}: ${formatGBP(total)} overdue`);
      }
    }
  } catch { /* graceful */ }

  // Gap 12: Debtor group context + suggestions
  try {
    const { debtorGroups } = await import("@shared/schema");
    const { detectPotentialGroups } = await import("../routes/debtorGroupRoutes");

    // Show existing groups
    const groups = await db
      .select({
        groupName: debtorGroups.groupName,
        memberCount: sql<number>`count(${contacts.id})`.as('member_count'),
      })
      .from(debtorGroups)
      .leftJoin(contacts, eq(contacts.debtorGroupId, debtorGroups.id))
      .where(eq(debtorGroups.tenantId, tenantId))
      .groupBy(debtorGroups.id, debtorGroups.groupName);

    if (groups.length > 0) {
      lines.push("\nDebtor groups:");
      for (const g of groups) {
        lines.push(`- ${g.groupName}: ${g.memberCount} linked debtor${g.memberCount !== 1 ? 's' : ''}`);
      }
    }

    // Suggest potential groupings
    const suggestions = await detectPotentialGroups(tenantId);
    if (suggestions.length > 0) {
      lines.push("\nPotential debtor groupings detected:");
      for (const s of suggestions.slice(0, 5)) {
        lines.push(`- ${s.suggestedGroupName}: ${s.reason} (${s.contactNames.join(', ')})`);
      }
    }
  } catch { /* graceful */ }

  return lines.join("\n");
}

async function buildInvoicesListContext(tenantId: string): Promise<string> {
  const lines: string[] = ["PAGE CONTEXT: Invoices List"];

  try {
    const allInvoices = await storage.getInvoices(tenantId, 10000);
    const statusCounts: Record<string, { count: number; value: number }> = {};
    let overdue60 = 0;
    const now = new Date();

    for (const inv of allInvoices) {
      const status = (inv.status || "unknown").toLowerCase();
      if (!statusCounts[status]) statusCounts[status] = { count: 0, value: 0 };
      statusCounts[status].count++;
      statusCounts[status].value += Number(inv.amount || 0);

      if (status === "overdue" && inv.dueDate) {
        const days = Math.round((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
        if (days > 60) overdue60++;
      }
    }

    for (const [status, { count: c, value }] of Object.entries(statusCounts)) {
      lines.push(`${status}: ${c} invoices, ${formatGBP(value)}`);
    }
    if (overdue60 > 0) lines.push(`Overdue >60 days: ${overdue60} invoices`);
  } catch { /* graceful */ }

  return lines.join("\n");
}

async function buildInvoiceDetailContext(invoiceId: string, tenantId: string): Promise<string> {
  const lines: string[] = ["PAGE CONTEXT: Invoice Detail"];

  try {
    const inv = await storage.getInvoice(invoiceId, tenantId);
    if (!inv) return "PAGE CONTEXT: Invoice not found";

    const amount = Number(inv.amount || 0);
    const now = new Date();
    const daysOverdue = inv.dueDate ? Math.round((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000) : 0;

    lines.push(`Invoice: ${inv.invoiceNumber} | ${formatGBP(amount)} | Status: ${inv.status}`);
    lines.push(`Due: ${formatDate(inv.dueDate)}${daysOverdue > 0 ? ` (${daysOverdue} days overdue)` : ""}`);

    // Parent debtor
    const contact = (inv as any).contact;
    if (contact) {
      lines.push(`\nDebtor: ${contact.companyName || contact.name}`);
      lines.push(`Total outstanding: ${formatGBP(Number((contact as any).totalOutstanding || 0))}`);
      if (contact.riskScore) lines.push(`Risk: ${contact.riskScore} (${contact.riskBand || "N/A"})`);
    }

    // AI facts for parent debtor
    if (contact?.id) {
      const facts = await storage.listAiFacts(tenantId, contact.id);
      if (facts.length > 0) {
        lines.push("\nKnown facts about this debtor:");
        for (const f of facts.slice(0, 10)) {
          lines.push(`- ${f.factKey || f.title}: ${f.factValue || f.content}`);
        }
      }
    }

    // Actions/comms for this invoice
    try {
      const allActions = await storage.getActions(tenantId, 500);
      const invActions = allActions.filter((a: any) => a.invoiceId === invoiceId).slice(0, 10);
      if (invActions.length > 0) {
        lines.push("\nCommunications thread:");
        for (const a of invActions) {
          lines.push(`- ${formatDate(a.createdAt)}: ${a.type} — ${a.subject || a.status}`);
          if (a.intentType) lines.push(`  → Intent: ${a.intentType} (${a.sentiment || "neutral"})`);
        }
      }
    } catch { /* graceful */ }
  } catch (error) {
    console.error("[Riley] buildInvoiceDetailContext failed:", error);
  }

  return lines.join("\n");
}

async function buildActivityContext(tenantId: string): Promise<string> {
  const lines: string[] = ["PAGE CONTEXT: Agent Activity"];

  try {
    const recentActions = await storage.getActions(tenantId, 30);
    lines.push(`Showing last ${recentActions.length} agent actions`);

    // Summarise by type
    const typeCounts: Record<string, number> = {};
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    let weekEmails = 0;
    let weekResponses = 0;
    const intentSummary: Record<string, number> = {};

    for (const a of recentActions) {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
      if (a.createdAt && new Date(a.createdAt) >= oneWeekAgo) {
        if (a.type === "email") weekEmails++;
        if (a.hasResponse) weekResponses++;
        if (a.intentType) intentSummary[a.intentType] = (intentSummary[a.intentType] || 0) + 1;
      }
    }

    lines.push(`\nThis week: ${weekEmails} emails sent, ${weekResponses} responses received`);
    if (weekEmails > 0) {
      lines.push(`Response rate: ${Math.round((weekResponses / weekEmails) * 100)}%`);
    }
    if (Object.keys(intentSummary).length > 0) {
      lines.push("Intent signals this week: " + Object.entries(intentSummary).map(([k, v]) => `${k}: ${v}`).join(", "));
    }

    // Recent actions list
    lines.push("\nRecent actions:");
    for (const a of recentActions.slice(0, 15)) {
      lines.push(`- ${formatDate(a.createdAt)}: ${a.type} — ${a.subject || a.status || "N/A"}`);
    }
  } catch { /* graceful */ }

  return lines.join("\n");
}

async function buildQashflowContext(tenantId: string): Promise<string> {
  const lines: string[] = ["PAGE CONTEXT: Qashflow (Weekly Review)"];

  // Each query is independently try/caught — one failure must not kill the whole context

  // Expected inflows from AR
  try {
    const metrics = await storage.getInvoiceMetrics(tenantId);
    if (metrics) {
      lines.push(`\nAR snapshot: ${formatGBP(metrics.totalOutstanding || 0)} outstanding`);
      lines.push(`Avg days to pay: ${metrics.avgDaysToPay || "N/A"}, On-time rate: ${metrics.onTimePaymentRate || "N/A"}%`);
      lines.push(`Collected this week: ${formatGBP(metrics.collectedThisWeek || 0)}, this month: ${formatGBP(metrics.collectedThisMonth || 0)}`);
    }
  } catch (err) {
    console.error("[Riley] buildQashflowContext: getInvoiceMetrics failed:", err);
  }

  // DSO trend
  try {
    const snapshots = await storage.getDsoSnapshots(tenantId, 30);
    if (snapshots && snapshots.length >= 2) {
      const latest = Number(snapshots[0].dsoValue);
      const oldest = Number(snapshots[snapshots.length - 1].dsoValue);
      lines.push(`DSO trend (30d): ${Math.round(oldest)} → ${Math.round(latest)} days`);
    }
  } catch (err) {
    console.error("[Riley] buildQashflowContext: getDsoSnapshots failed:", err);
  }

  // Latest weekly review context
  try {
    const latestReview = await storage.getLatestWeeklyReview(tenantId);
    if (latestReview && latestReview.summaryText) {
      lines.push(`\nLatest weekly review (${latestReview.weekStartDate}):`);
      lines.push(latestReview.summaryText.slice(0, 500));
      if (latestReview.keyNumbers) {
        const kn = latestReview.keyNumbers as any;
        if (kn?.expected) {
          lines.push(`Expected collection: ${formatGBP(kn.expected.expectedIn || 0)}`);
        }
      }
    }
  } catch (err) {
    console.error("[Riley] buildQashflowContext: getLatestWeeklyReview failed:", err);
  }

  lines.push("\nFOCUS: Help the user understand expected cash inflows from debtors. Identify which debtors are most important to collect this week. If asked about outflows, acknowledge and say outflow forecasting is coming in a future update.");

  return lines.join("\n");
}

async function buildDataHealthContext(tenantId: string): Promise<string> {
  const lines: string[] = ["PAGE CONTEXT: Data Health"];

  try {
    const allContacts = await storage.getContacts(tenantId);
    const customers = allContacts.filter((c: any) => c.role === "customer" && c.isActive);

    let ready = 0, needsEmail = 0, genericEmail = 0, needsPhone = 0, needsAttention = 0;
    const needsFixing: Array<{ name: string; outstanding: number; issues: string[] }> = [];

    for (const c of customers) {
      const issues: string[] = [];
      const email = (c as any).arContactEmail || c.email;
      if (!email) {
        needsEmail++;
        issues.push("no email");
      } else if (email.includes("noreply") || email.includes("info@") || email.includes("admin@")) {
        genericEmail++;
        issues.push("generic email");
      }
      if (!c.phone && !(c as any).arContactPhone) {
        needsPhone++;
        issues.push("no phone");
      }
      if (issues.length === 0) {
        ready++;
      } else {
        if (issues.length >= 2) needsAttention++;
        // We'll sort by outstanding later via invoices
        needsFixing.push({ name: c.name, outstanding: 0, issues });
      }
    }

    lines.push(`Ready: ${ready} | Needs email: ${needsEmail} | Generic email: ${genericEmail} | Needs phone: ${needsPhone} | Needs attention: ${needsAttention}`);
    lines.push(`Total active customers: ${customers.length}`);

    // Get outstanding amounts for contacts that need fixing
    if (needsFixing.length > 0) {
      try {
        const overdueInvs = await storage.getOverdueInvoices(tenantId);
        const debtorTotals = new Map<string, number>();
        for (const inv of overdueInvs) {
          const cid = (inv as any).contactId;
          debtorTotals.set(cid, (debtorTotals.get(cid) || 0) + Number(inv.amount || 0));
        }

        // Match back
        for (const nf of needsFixing) {
          const contact = customers.find((c: any) => c.name === nf.name);
          if (contact) nf.outstanding = debtorTotals.get(contact.id) || 0;
        }

        const topNeedFix = needsFixing
          .sort((a, b) => b.outstanding - a.outstanding)
          .slice(0, 10);

        if (topNeedFix.length > 0) {
          lines.push("\nTop debtors needing data fixes (by outstanding):");
          for (const d of topNeedFix) {
            lines.push(`- ${d.name}: ${formatGBP(d.outstanding)} — ${d.issues.join(", ")}`);
          }
        }
      } catch { /* graceful */ }
    }
  } catch { /* graceful */ }

  return lines.join("\n");
}

async function buildSettingsContext(tenantId: string): Promise<string> {
  const lines: string[] = ["PAGE CONTEXT: Settings"];

  try {
    const tenant = await storage.getTenant(tenantId);
    if (tenant) {
      lines.push(`Communication mode: ${(tenant as any).communicationMode || "testing"}`);
      lines.push(`Approval mode: ${(tenant as any).approvalMode || "manual"}`);
    }

    // Agent persona
    try {
      const persona = await storage.getActiveAgentPersona(tenantId);
      if (persona) {
        lines.push(`Active persona: ${persona.personaName} (${(persona as any).jobTitle || "Agent"})`);
        lines.push(`Tone: ${(persona as any).toneDefault || "professional"}`);
      }
    } catch { /* graceful */ }

    // Xero connection
    try {
      // Check if Xero is connected by looking at the tenant's xero fields or accounting connections
      if (tenant && (tenant as any).xeroOrganisationId) {
        lines.push(`Xero: Connected (org: ${(tenant as any).xeroOrganisationName || "N/A"})`);
      } else {
        lines.push("Xero: Not connected");
      }
    } catch { /* graceful */ }
  } catch { /* graceful */ }

  return lines.join("\n");
}

async function buildOnboardingContext(tenantId: string): Promise<string> {
  const lines: string[] = ["PAGE CONTEXT: Onboarding"];

  try {
    const tenant = await storage.getTenant(tenantId);
    if (tenant && (tenant as any).xeroOrganisationId) {
      lines.push("Xero: Connected and syncing");
    } else {
      lines.push("Xero: Not yet connected");
    }

    // Quick data health summary
    const allContacts = await storage.getContacts(tenantId);
    const customers = allContacts.filter((c: any) => c.role === "customer" && c.isActive);
    const withEmail = customers.filter((c: any) => c.arContactEmail || c.email);
    lines.push(`Contacts synced: ${customers.length} (${withEmail.length} with email)`);
  } catch { /* graceful */ }

  return lines.join("\n");
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
- Seasonal patterns: "Are there any months where your clients typically pay slower or faster? For example, many businesses see slower payments in December or a rush before financial year-end."

For weekly review setup, ask: "When would you like your weekly cashflow catch-up? Most clients like Monday mornings or Friday afternoons."

Keep it conversational — you're building rapport while gathering intelligence.`;
}

export function buildRileySystemPrompt(context: RileyContext, pageContextBlock?: string): string {
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
    pageContextBlock ? `\nCURRENT PAGE CONTEXT:\n${pageContextBlock}` : "",
    buildOnboardingGuidance(topic),
    `\nINSTRUCTIONS:
- Respond naturally and conversationally. Keep it concise.
- If you learn something about the business, acknowledge it — it will be extracted and stored after the conversation.
- If the user asks about their data, reference the snapshot and facts above. Explain in plain English.
- If the user wants to take an action (pause a debtor, change settings, etc.), confirm what they want before saying you'll do it. You cannot execute actions directly — note what was requested.
- Connect insights across pillars when relevant (e.g., "That overdue invoice from Acme affects your cashflow forecast too").
- For debtor-specific questions, use any facts you have. If you don't have context, ask.
- Never fabricate data. If you don't know, say so and suggest where to look.

You always know exactly where the user is in the app and have the relevant data for that page loaded. Use it proactively — if you can see they're on Data Health and 12 debtors need email addresses, lead with that. Don't make them ask.

When you have full debtor context (on the debtor detail page), you can give specific credit control advice:
- Which invoices to prioritise chasing and why
- Whether the current agent approach is working based on response rates
- What tone or channel to recommend based on payment history
- Whether to escalate, put on hold, or change strategy
- Specific risks or opportunities with this debtor

Always refer to the debtor by name. Reference specific invoice numbers and amounts when relevant. Be a genuine credit control advisor, not a data reader.
If you have no aiFacts for a debtor yet, treat the conversation as an opportunity to start gathering intelligence — ask one focused question at the end of your response.`,
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
  const [user, tenantSnapshot, relevantFacts, pageContextBlock] = await Promise.all([
    storage.getUser(userId),
    getTenantSnapshot(tenantId),
    storage.listAiFacts(
      tenantId,
      relatedEntityId || undefined,
    ),
    buildPageContext(pageContext, tenantId, relatedEntityType, relatedEntityId),
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
  }, pageContextBlock);

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

/**
 * Streaming variant of getRileyResponse.
 * Performs the same context assembly, then streams deltas via callback.
 * Returns the conversationId immediately so the route can begin SSE,
 * then calls onDelta for each text chunk and onDone when finished.
 */
export async function getRileyResponseStreaming(params: {
  tenantId: string;
  userId: string;
  conversationId: string | null;
  userMessage: string;
  pageContext: string;
  topic: RileyTopic;
  relatedEntityType?: string;
  relatedEntityId?: string;
  onDelta: (text: string) => void;
  onDone: (fullResponse: string, conversationId: string) => void;
  onError: (error: Error) => void;
}): Promise<{ conversationId: string }> {
  const {
    tenantId,
    userId,
    userMessage,
    pageContext,
    topic,
    relatedEntityType,
    relatedEntityId,
    onDelta,
    onDone,
    onError,
  } = params;

  // 1. Load or create conversation
  let conversation = params.conversationId
    ? await storage.getRileyConversation(params.conversationId, tenantId)
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
  const [user, tenantSnapshot, relevantFacts, pageContextBlock] = await Promise.all([
    storage.getUser(userId),
    getTenantSnapshot(tenantId),
    storage.listAiFacts(tenantId, relatedEntityId || undefined),
    buildPageContext(pageContext, tenantId, relatedEntityType, relatedEntityId),
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
    relevantFacts: relevantFacts.slice(0, 30),
    relatedEntityType,
    relatedEntityId,
  }, pageContextBlock);

  // 4. Build conversation messages (last 20)
  const existingMessages = (conversation.messages as Array<{ role: string; content: string }>) || [];
  const recentMessages = existingMessages.slice(-19);
  const conversationHistory: ConversationMessage[] = recentMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  conversationHistory.push({ role: "user", content: userMessage });

  const convId = conversation.id;
  const existingMsgs = existingMessages;

  // 5. Stream Claude response (async — runs after we return)
  streamConversation(
    {
      system: systemPrompt,
      messages: conversationHistory,
      model: "standard",
      temperature: 0.5,
      maxTokens: 1024,
    },
    onDelta,
  )
    .then(async (fullResponse) => {
      // 6. Persist to conversation
      const now = new Date().toISOString();
      const updatedMessages = [
        ...existingMsgs,
        { role: "user", content: userMessage, timestamp: now },
        { role: "assistant", content: fullResponse, timestamp: now },
      ];
      await storage.updateRileyConversation(convId, tenantId, {
        messages: updatedMessages as any,
      });
      onDone(fullResponse, convId);
    })
    .catch(onError);

  // Return immediately so the route can start SSE headers
  return { conversationId: convId };
}

// ── Intelligence Extraction ──────────────────────────────────

const EXTRACTION_PROMPT = `You are an intelligence extraction engine. Given a conversation between Riley (an AI assistant) and a user of Qashivo (a UK credit control platform), extract any structured business intelligence.

Return JSON with these arrays (any can be empty):

- facts[]: Business intelligence learned. Each: { category, entityType?, entityId?, factKey, factValue, confidence }
  Categories: "debtor_relationship", "payment_behaviour", "business_context", "seasonal_pattern", "cashflow_input", "finance_preference", "industry_norm", "internal_policy", "contact_intel"
  Confidence: 1.0 if user stated directly, 0.7 if reasonably inferred, 0.5 if speculative.

  SEASONAL PATTERNS (category="seasonal_pattern"):
  If the user mentions any seasonal, monthly, or cyclical payment behaviour, extract it.
  - "December is always slow" → entityType="tenant", factKey="slow_month", factValue="december", confidence=1.0
  - "They pay everything before their March year-end" → entityType="debtor", entityId=contactId, factKey="fast_month", factValue="march" AND factKey="year_end_month", factValue="march"
  - "Construction clients delay in winter" → entityType="tenant", factKey="slow_month", factValue="december" (repeat for january, february)
  - "Q4 is always tight for them" → entityType="debtor", factKey="slow_month", factValue="october" (repeat for november, december)
  factKey must be one of: "slow_month", "fast_month", "year_end_month", "seasonal_note"
  factValue must be the month name in lowercase (january–december) except for "seasonal_note" which is free text.
  Do NOT extract day-of-week or time-of-day patterns here — those are weekday patterns, not seasonal.

- forecastInputs[]: Cashflow-relevant items. Each: { category, description, amount, timingType, startDate?, endDate?, affects }
  Categories: "revenue_change", "cost_change", "hiring", "capex", "tax", "other"
  timingType: "one_off_date", "date_range", "recurring_monthly"
  affects: "inflows" or "outflows"
  Only include if a specific amount or estimate was mentioned.

- debtorUpdates[]: AR overlay updates. Each: { contactId, field, value }
  Fields: "arNotes", "arContactEmail", "arContactPhone", "preferredContactMethod", "paymentTerms", "channelPreference"
  Only include if the user explicitly asked to update a debtor's info and a contactId is identifiable.
  For channelPreference: if the user or debtor states a communication preference (e.g. "don't call them", "email only", "stop sending SMS"),
  set field="channelPreference" and value as JSON: {"emailEnabled": true/false, "smsEnabled": true/false, "voiceEnabled": true/false, "notes": "<what was said>"}.
  "don't call" → voiceEnabled=false. "email only" → smsEnabled=false, voiceEnabled=false. "stop SMS" → smsEnabled=false.

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
        "channelPreference",
      ]);

      for (const update of result.debtorUpdates) {
        if (!update.contactId || !safeFields.has(update.field)) continue;
        try {
          // Gap 11: Channel preference updates go to customerPreferences table
          if (update.field === "channelPreference") {
            const prefValue = typeof update.value === 'string' ? JSON.parse(update.value) : update.value;
            const { customerTimelineService } = await import('../services/customerTimelineService');
            await customerTimelineService.updatePreferences(tenantId, update.contactId, {
              emailEnabled: prefValue.emailEnabled ?? true,
              smsEnabled: prefValue.smsEnabled ?? true,
              voiceEnabled: prefValue.voiceEnabled ?? true,
              channelPreferenceSource: 'riley_conversation',
              channelPreferenceNotes: prefValue.notes || `Extracted from Riley conversation ${conversationId}`,
            });
            console.log(`[Riley] Channel preference updated for contact ${update.contactId}: ${JSON.stringify(prefValue)}`);
            continue;
          }

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
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  // 1. Broken promises this week
  try {
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
  } catch (err) {
    console.error("[Riley] Proactive: broken promises query failed:", err);
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
  } catch (err) {
    console.error("[Riley] Proactive: pending approvals query failed:", err);
  }

  // 3. New invoices created/synced in last 24 hours
  try {
    const [result] = await db
      .select({ count: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          gte(invoices.createdAt, oneDayAgo),
        ),
      );
    const newCount = Number(result?.count || 0);
    if (newCount > 0) {
      suggestions.push({
        type: "new_invoices",
        message: `${newCount} new invoice${newCount === 1 ? "" : "s"} synced in the last 24 hours`,
        priority: "low",
      });
    }
  } catch (err) {
    console.error("[Riley] Proactive: new invoices query failed:", err);
  }

  // 4. DSO change vs 7 days ago
  try {
    const snapshots = await storage.getDsoSnapshots(tenantId, 14);
    if (snapshots.length >= 2) {
      const latest = Number(snapshots[0].dsoValue);
      const previous = Number(snapshots[snapshots.length - 1].dsoValue);
      const change = latest - previous;
      if (change <= -3) {
        suggestions.push({
          type: "dso_change",
          message: `Your DSO improved by ${Math.abs(Math.round(change))} days recently — nice work!`,
          priority: "low",
        });
      } else if (change >= 5) {
        suggestions.push({
          type: "dso_change",
          message: `Your DSO has increased by ${Math.round(change)} days — want to look at what's causing it?`,
          priority: "medium",
        });
      }
    }
  } catch (err) {
    console.error("[Riley] Proactive: DSO snapshots query failed:", err);
  }

  // 5. Weekly review ready (generated in last 7 days)
  try {
    const [review] = await db
      .select({ id: weeklyReviews.id, generatedAt: weeklyReviews.generatedAt })
      .from(weeklyReviews)
      .where(
        and(
          eq(weeklyReviews.tenantId, tenantId),
          gte(weeklyReviews.generatedAt, oneWeekAgo),
        ),
      )
      .orderBy(desc(weeklyReviews.generatedAt))
      .limit(1);
    if (review) {
      suggestions.push({
        type: "weekly_review_ready",
        message: "Your weekly CFO review is ready — want to walk through it?",
        priority: "medium",
        entityId: review.id,
      });
    }
  } catch (err) {
    console.error("[Riley] Proactive: weekly review query failed:", err);
  }

  // 6. Expiring forecast adjustments (within next 7 days)
  try {
    const adjustments = await storage.listForecastAdjustments(tenantId);
    const nextWeek = new Date(now);
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
  } catch (err) {
    console.error("[Riley] Proactive: forecast expiring query failed:", err);
  }

  // 7. Debtor deteriorating (avgDaysToPay increased >20% vs 30 days ago)
  try {
    const allContacts = await storage.getContacts(tenantId);
    const customers = allContacts.filter((c: any) => c.role === "customer" && c.isActive);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get invoices paid recently vs paid before to compare average days to pay
    for (const contact of customers.slice(0, 50)) {
      const contactInvoices = await db
        .select({
          paidDate: invoices.paidDate,
          issueDate: invoices.issueDate,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.contactId, contact.id),
            eq(invoices.status, "paid"),
          ),
        );

      if (contactInvoices.length < 4) continue; // Not enough data

      const recent = contactInvoices.filter(
        (i) => i.paidDate && new Date(i.paidDate) >= thirtyDaysAgo,
      );
      const older = contactInvoices.filter(
        (i) => i.paidDate && new Date(i.paidDate) < thirtyDaysAgo,
      );

      if (recent.length < 2 || older.length < 2) continue;

      const avgRecent =
        recent.reduce((sum, i) => {
          if (!i.paidDate || !i.issueDate) return sum;
          return sum + (new Date(i.paidDate).getTime() - new Date(i.issueDate).getTime()) / 86400000;
        }, 0) / recent.length;

      const avgOlder =
        older.reduce((sum, i) => {
          if (!i.paidDate || !i.issueDate) return sum;
          return sum + (new Date(i.paidDate).getTime() - new Date(i.issueDate).getTime()) / 86400000;
        }, 0) / older.length;

      if (avgOlder > 0 && avgRecent > avgOlder * 1.2) {
        suggestions.push({
          type: "debtor_deteriorating",
          message: `${contact.name} is paying slower — avg ${Math.round(avgRecent)} days vs ${Math.round(avgOlder)} days previously`,
          priority: "medium",
          entityId: contact.id,
        });
        // Limit to top 3 deteriorating debtors
        const deterioratingCount = suggestions.filter(
          (s) => s.type === "debtor_deteriorating",
        ).length;
        if (deterioratingCount >= 3) break;
      }
    }
  } catch (err) {
    console.error("[Riley] Proactive: debtor deteriorating query failed:", err);
  }

  // 8. New overdue invoices (became overdue in last 7 days)
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
  } catch (err) {
    console.error("[Riley] Proactive: new overdue query failed:", err);
  }

  // Sort by priority, then by type tiebreaker
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const typeOrder: Record<string, number> = {
    broken_promises: 0,
    pending_approvals: 1,
    new_invoices: 2,
    dso_change: 3,
    weekly_review_ready: 4,
    forecast_expiring: 5,
    debtor_deteriorating: 6,
    new_overdue: 7,
  };
  suggestions.sort((a, b) => {
    const pDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    if (pDiff !== 0) return pDiff;
    return (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
  });

  return suggestions;
}
