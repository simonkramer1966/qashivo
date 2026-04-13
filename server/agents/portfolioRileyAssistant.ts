/**
 * Portfolio Riley — partner-level AI assistant.
 *
 * Sees the entire client portfolio across tenants. Can compare,
 * benchmark, and advise across clients. Separate from SME Riley
 * which knows one business deeply.
 *
 * Partner Portal Phase 6.
 */

import { storage } from "../storage";
import { db } from "../db";
import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import {
  invoices,
  contacts,
  actions,
  disputes,
  promisesToPay,
  timelineEvents,
  partners,
  partnerTenantLinks,
  partnerClientRelationships,
  tenants,
  aiFacts,
  type Partner,
} from "@shared/schema";
import {
  generateConversation,
  streamConversation,
  type ConversationMessage,
} from "../services/llm/claude";

// ── Types ───────────────────────────────────────────────────

export type PortfolioRileyTopic =
  | "portfolio_overview"
  | "client_comparison"
  | "staff_workload"
  | "system_help";

interface PortfolioSnapshot {
  totalClients: number;
  totalAR: number;
  totalOverdue: number;
  portfolioDSO: number;
  collectionRate: number;
  pendingApprovals: number;
  activeDisputes: number;
  brokenPromises: number;
}

interface ClientSnapshot {
  tenantId: string;
  name: string;
  outstanding: number;
  overdue: number;
  dso: number;
  debtorCount: number;
  charlieEnabled: boolean;
  flags: string[];
}

interface ActivitySummary {
  sent: number;
  replies: number;
  payments: number;
  paymentAmount: number;
  disputes: number;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  clientCount: number;
}

// ── Context Assembly ────────────────────────────────────────

function formatGBP(amount: number): string {
  return `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getPartnerTenantIds(partnerId: string): Promise<string[]> {
  const links = await db
    .select({ tenantId: partnerTenantLinks.tenantId })
    .from(partnerTenantLinks)
    .where(and(eq(partnerTenantLinks.partnerId, partnerId), eq(partnerTenantLinks.status, "active")));
  return links.map(l => l.tenantId);
}

async function getUserAssignedTenantIds(userId: string): Promise<string[]> {
  const rels = await db
    .select({ clientTenantId: partnerClientRelationships.clientTenantId })
    .from(partnerClientRelationships)
    .where(and(eq(partnerClientRelationships.partnerUserId, userId), eq(partnerClientRelationships.status, "active")));
  return rels.map(r => r.clientTenantId);
}

async function getAccessibleTenantIds(partnerId: string, userId: string, isAdmin: boolean): Promise<string[]> {
  if (isAdmin) {
    return getPartnerTenantIds(partnerId);
  }
  return getUserAssignedTenantIds(userId);
}

async function getPortfolioSnapshot(tenantIds: string[]): Promise<PortfolioSnapshot> {
  if (tenantIds.length === 0) {
    return { totalClients: 0, totalAR: 0, totalOverdue: 0, portfolioDSO: 0, collectionRate: 0, pendingApprovals: 0, activeDisputes: 0, brokenPromises: 0 };
  }

  const now = new Date();

  const [arResult, collectionResult, dsoResult, pendingResult, disputeResult, brokenPtpResult] = await Promise.all([
    db.select({
      totalAR: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
      totalOverdue: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.dueDate} < ${now} THEN CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL) ELSE 0 END), 0)`,
    }).from(invoices).where(and(
      inArray(invoices.tenantId, tenantIds),
      sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`
    )),

    db.select({
      paidTotal: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN CAST(${invoices.amount} AS DECIMAL) ELSE 0 END), 0)`,
      issuedTotal: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
    }).from(invoices).where(and(
      inArray(invoices.tenantId, tenantIds),
      sql`${invoices.status} NOT IN ('void', 'voided', 'deleted', 'draft')`
    )),

    db.select({
      weightedDays: sql<string>`COALESCE(SUM(
        (CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL))
        * GREATEST(EXTRACT(EPOCH FROM (NOW() - ${invoices.issueDate})) / 86400, 0)
      ), 0)`,
      weightedBalance: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
    }).from(invoices).where(and(
      inArray(invoices.tenantId, tenantIds),
      sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`
    )),

    db.select({ count: sql<string>`COUNT(*)` }).from(actions).where(and(
      inArray(actions.tenantId, tenantIds),
      inArray(actions.status, ["pending_approval", "pending"])
    )),

    db.select({ count: sql<string>`COUNT(*)` }).from(disputes).where(and(
      inArray(disputes.tenantId, tenantIds),
      eq(disputes.status, "pending")
    )),

    db.select({ count: sql<string>`COUNT(*)` }).from(promisesToPay).where(and(
      inArray(promisesToPay.tenantId, tenantIds),
      eq(promisesToPay.status, "active"),
      sql`${promisesToPay.promisedDate} < NOW()`
    )),
  ]);

  const totalAR = Number(arResult[0]?.totalAR || 0);
  const totalOverdue = Number(arResult[0]?.totalOverdue || 0);
  const paidTotal = Number(collectionResult[0]?.paidTotal || 0);
  const issuedTotal = Number(collectionResult[0]?.issuedTotal || 0);
  const collectionRate = issuedTotal > 0 ? Math.round((paidTotal / issuedTotal) * 100) : 0;
  const weightedDays = Number(dsoResult[0]?.weightedDays || 0);
  const weightedBalance = Number(dsoResult[0]?.weightedBalance || 0);
  const portfolioDSO = weightedBalance > 0 ? Math.round(weightedDays / weightedBalance) : 0;

  return {
    totalClients: tenantIds.length,
    totalAR,
    totalOverdue,
    portfolioDSO,
    collectionRate,
    pendingApprovals: Number(pendingResult[0]?.count || 0),
    activeDisputes: Number(disputeResult[0]?.count || 0),
    brokenPromises: Number(brokenPtpResult[0]?.count || 0),
  };
}

async function getClientSnapshots(tenantIds: string[]): Promise<ClientSnapshot[]> {
  if (tenantIds.length === 0) return [];

  const now = new Date();
  const snapshots: ClientSnapshot[] = [];

  // Batch query per-tenant stats (limited to 25 for token budget)
  const limitedIds = tenantIds.slice(0, 25);

  for (const tenantId of limitedIds) {
    try {
      const [tenantRow] = await db.select({
        name: tenants.name,
        xeroOrganisationName: tenants.xeroOrganisationName,
        collectionsAutomationEnabled: tenants.collectionsAutomationEnabled,
      }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

      const [stats] = await db.select({
        outstanding: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
        overdue: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.dueDate} < ${now} THEN CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL) ELSE 0 END), 0)`,
      }).from(invoices).where(and(
        eq(invoices.tenantId, tenantId),
        sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`
      ));

      // Weighted DSO for this tenant
      const [dsoStats] = await db.select({
        weightedDays: sql<string>`COALESCE(SUM(
          (CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL))
          * GREATEST(EXTRACT(EPOCH FROM (NOW() - ${invoices.issueDate})) / 86400, 0)
        ), 0)`,
        weightedBalance: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
      }).from(invoices).where(and(
        eq(invoices.tenantId, tenantId),
        sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`
      ));

      const wd = Number(dsoStats?.weightedDays || 0);
      const wb = Number(dsoStats?.weightedBalance || 0);

      // Debtor count
      const [debtorCount] = await db.select({
        count: sql<string>`COUNT(DISTINCT ${invoices.contactId})`,
      }).from(invoices).where(and(
        eq(invoices.tenantId, tenantId),
        sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`
      ));

      const outstanding = Number(stats?.outstanding || 0);
      const overdue = Number(stats?.overdue || 0);

      // Flags
      const flags: string[] = [];
      if (overdue > outstanding * 0.5 && outstanding > 0) flags.push("high_overdue_ratio");
      if (wb > 0 && Math.round(wd / wb) > 60) flags.push("high_dso");
      if (!tenantRow?.collectionsAutomationEnabled) flags.push("charlie_disabled");

      // Get display name from partner link
      const linkRows = await db
        .select({ clientDisplayName: partnerTenantLinks.clientDisplayName })
        .from(partnerTenantLinks)
        .where(eq(partnerTenantLinks.tenantId, tenantId))
        .limit(1);

      snapshots.push({
        tenantId,
        name: linkRows[0]?.clientDisplayName || tenantRow?.xeroOrganisationName || tenantRow?.name || "Unknown",
        outstanding,
        overdue,
        dso: wb > 0 ? Math.round(wd / wb) : 0,
        debtorCount: Number(debtorCount?.count || 0),
        charlieEnabled: !!tenantRow?.collectionsAutomationEnabled,
        flags,
      });
    } catch (err) {
      console.error(`[PortfolioRiley] Error getting snapshot for tenant ${tenantId}:`, err);
    }
  }

  // Sort by overdue desc
  snapshots.sort((a, b) => b.overdue - a.overdue);
  return snapshots;
}

async function getRecentActivitySummary(tenantIds: string[]): Promise<ActivitySummary> {
  if (tenantIds.length === 0) return { sent: 0, replies: 0, payments: 0, paymentAmount: 0, disputes: 0 };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [result] = await db.select({
    sent: sql<string>`COUNT(*) FILTER (WHERE ${timelineEvents.direction} = 'outbound')`,
    replies: sql<string>`COUNT(*) FILTER (WHERE ${timelineEvents.direction} = 'inbound')`,
    payments: sql<string>`COUNT(*) FILTER (WHERE ${timelineEvents.eventType} = 'payment_received')`,
    paymentAmount: sql<string>`COALESCE(SUM(CASE WHEN ${timelineEvents.eventType} = 'payment_received' THEN CAST(COALESCE(${timelineEvents.metadata}->>'amount', '0') AS DECIMAL) ELSE 0 END), 0)`,
    disputes: sql<string>`COUNT(*) FILTER (WHERE ${timelineEvents.eventType} = 'dispute_detected')`,
  }).from(timelineEvents).where(and(
    inArray(timelineEvents.tenantId, tenantIds),
    gte(timelineEvents.createdAt, todayStart),
  ));

  return {
    sent: Number(result?.sent || 0),
    replies: Number(result?.replies || 0),
    payments: Number(result?.payments || 0),
    paymentAmount: Number(result?.paymentAmount || 0),
    disputes: Number(result?.disputes || 0),
  };
}

async function getStaffSummary(partnerId: string): Promise<StaffMember[]> {
  try {
    const { users: usersTable } = await import("@shared/schema");
    const teamMembers = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(eq(usersTable.partnerId, partnerId));

    const allRelationships = await db
      .select()
      .from(partnerClientRelationships)
      .where(eq(partnerClientRelationships.status, "active"));

    const partnerTenants = await getPartnerTenantIds(partnerId);

    return teamMembers.map(m => {
      const clientCount = m.role === "partner"
        ? partnerTenants.length
        : allRelationships.filter(r => r.partnerUserId === m.id).length;

      return {
        id: m.id,
        name: [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || "Unknown",
        email: m.email || "",
        role: m.role || "controller",
        clientCount,
      };
    });
  } catch (err) {
    console.error("[PortfolioRiley] Error getting staff summary:", err);
    return [];
  }
}

function buildPortfolioPageContext(route: string): string {
  if (route.includes("/partner/dashboard")) return "The user is on the Partner Portfolio Dashboard — they can see aggregated KPIs across all clients.";
  if (route.includes("/partner/clients")) return "The user is on the Clients page — they can see per-client details and health indicators.";
  if (route.includes("/partner/activity")) return "The user is on the Activity Feed — cross-client timeline of communications, payments, and events.";
  if (route.includes("/partner/settings/staff")) return "The user is on the Staff Management page — team members, assignments, and workload.";
  if (route.includes("/partner/reports")) return "The user is on the Reports page.";
  if (route.includes("/partner/settings/billing")) return "The user is on the Billing page — revenue metrics, client billing management, invoices, and billing settings.";
  return "The user is in the Partner Portal.";
}

// ── System Prompt ───────────────────────────────────────────

function buildPortfolioRileySystemPrompt(
  partner: Partner,
  userName: string,
  userRole: string,
  isAdmin: boolean,
  snapshot: PortfolioSnapshot,
  clientSnapshots: ClientSnapshot[],
  activity: ActivitySummary,
  staff: StaffMember[],
  pageContext: string,
  relevantFacts: Array<{ factKey: string; factValue: string; confidence: number | null; source: string | null }>,
  billingSnapshot?: { mrr: number; wholesaleCost: number; margin: number; activeClients: number; trialClients: number; pausedClients: number; volumeDiscountPercent: number; volumeDiscountTier: string } | null,
): string {
  const partnerType = partner.partnerType || "accounting_firm";

  const lines: string[] = [];

  // Identity
  lines.push("You are Riley, the portfolio advisor for " + (partner.name || "this partner organisation") + ".");
  lines.push("");

  if (partnerType === "funder") {
    lines.push("This is a funder organisation. Focus on risk, exposure, credit quality, and portfolio health. Flag any clients with deteriorating payment behaviour or high concentration risk.");
  } else {
    lines.push("This is an accounting/advisory firm. Focus on client health, advisory opportunities, fee protection, and proactive recommendations. Help the team prioritise which clients need attention.");
  }

  lines.push("");
  lines.push("You are speaking with " + userName + " (role: " + userRole + ").");
  lines.push("");

  // Portfolio snapshot
  lines.push("PORTFOLIO SNAPSHOT:");
  lines.push(`- Clients: ${snapshot.totalClients}`);
  lines.push(`- Total AR: ${formatGBP(snapshot.totalAR)}`);
  lines.push(`- Overdue: ${formatGBP(snapshot.totalOverdue)} (${snapshot.totalAR > 0 ? Math.round((snapshot.totalOverdue / snapshot.totalAR) * 100) : 0}%)`);
  lines.push(`- Portfolio DSO: ${snapshot.portfolioDSO} days`);
  lines.push(`- Collection Rate: ${snapshot.collectionRate}%`);
  lines.push(`- Pending approvals: ${snapshot.pendingApprovals}`);
  lines.push(`- Active disputes: ${snapshot.activeDisputes}`);
  lines.push(`- Broken promises: ${snapshot.brokenPromises}`);
  lines.push("");

  // Client table
  if (clientSnapshots.length > 0) {
    lines.push("CLIENT-BY-CLIENT:");
    lines.push("Name | Outstanding | Overdue | DSO | Debtors | Charlie | Flags");
    lines.push("--- | --- | --- | --- | --- | --- | ---");
    for (const c of clientSnapshots) {
      lines.push(`${c.name} | ${formatGBP(c.outstanding)} | ${formatGBP(c.overdue)} | ${c.dso}d | ${c.debtorCount} | ${c.charlieEnabled ? "On" : "Off"} | ${c.flags.length > 0 ? c.flags.join(", ") : "none"}`);
    }
    lines.push("");
  }

  // Recent activity
  lines.push("TODAY'S ACTIVITY ACROSS PORTFOLIO:");
  lines.push(`- Sent: ${activity.sent} | Replies: ${activity.replies} | Payments: ${activity.payments} (${formatGBP(activity.paymentAmount)}) | Disputes: ${activity.disputes}`);
  lines.push("");

  // Staff (admin only)
  if (isAdmin && staff.length > 0) {
    lines.push("TEAM:");
    for (const s of staff) {
      lines.push(`- ${s.name} (${s.role}) — ${s.clientCount} clients`);
    }
    lines.push("");
  }

  // Page context
  lines.push("CURRENT PAGE:");
  lines.push(pageContext);
  lines.push("");

  // Known facts
  if (relevantFacts.length > 0) {
    lines.push("KNOWN INTELLIGENCE:");
    for (const f of relevantFacts.slice(0, 15)) {
      lines.push(`- ${f.factKey}: ${f.factValue} (confidence: ${f.confidence || "N/A"})`);
    }
    lines.push("");
  }

  // Billing (admin only)
  if (billingSnapshot && billingSnapshot.activeClients > 0) {
    const formatPence = (p: number) => `£${(p / 100).toFixed(2)}`;
    lines.push("BILLING:");
    lines.push(`- Monthly Retail Revenue (MRR): ${formatPence(billingSnapshot.mrr)}`);
    lines.push(`- Qashivo Cost (after discount): ${formatPence(billingSnapshot.wholesaleCost)}`);
    lines.push(`- Partner Margin: ${formatPence(billingSnapshot.margin)}`);
    lines.push(`- Active clients: ${billingSnapshot.activeClients} | Trial: ${billingSnapshot.trialClients} | Paused: ${billingSnapshot.pausedClients}`);
    if (billingSnapshot.volumeDiscountPercent > 0) {
      lines.push(`- Volume discount: ${billingSnapshot.volumeDiscountPercent}% (${billingSnapshot.volumeDiscountTier} tier)`);
    }
    lines.push("");
  }

  // Instructions
  lines.push("INSTRUCTIONS:");
  lines.push("- Compare and benchmark clients when asked. Use the data above.");
  lines.push("- Prioritise which clients need attention based on overdue ratios, DSO, and flags.");
  lines.push("- Never cross-pollinate specific debtor data between clients unless the user explicitly asks.");
  lines.push("- Be concise and direct. This user manages multiple businesses — they need efficiency.");
  lines.push("- Use GBP formatting (£) for all amounts.");
  lines.push("- If asked about a specific client and you have data above, reference it. If not, say so.");
  lines.push("- Do not make up data. Only reference figures from the context provided.");

  return lines.join("\n");
}

// ── API Functions ───────────────────────────────────────────

export async function getPortfolioRileyResponse(params: {
  partnerId: string;
  userId: string;
  conversationId: string | null;
  userMessage: string;
  currentPage: string;
  topic: PortfolioRileyTopic;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Promise<{ response: string; conversationId: string }> {
  const { partnerId, userId, conversationId, userMessage, currentPage, topic, relatedEntityType, relatedEntityId } = params;

  // 1. Load or create conversation
  let conversation = conversationId
    ? await storage.getPartnerRileyConversation(conversationId, partnerId)
    : null;

  if (!conversation) {
    conversation = await storage.createPartnerRileyConversation({
      partnerId,
      userId,
      messages: [],
      topic,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
    });
  }

  // 2. Fetch context
  const [user, partner] = await Promise.all([
    storage.getUser(userId),
    db.select().from(partners).where(eq(partners.id, partnerId)).limit(1).then(r => r[0]),
  ]);

  if (!partner) throw new Error("Partner not found");

  const isAdmin = (user as any)?.role === "partner";
  const tenantIds = await getAccessibleTenantIds(partnerId, userId, isAdmin);

  const { getBillingSnapshot: fetchBillingSnapshot } = await import("../services/partnerBillingService");
  const [snapshot, clientSnapshots, activity, staff, relevantFacts, billingSnapshot] = await Promise.all([
    getPortfolioSnapshot(tenantIds),
    getClientSnapshots(tenantIds),
    getRecentActivitySummary(tenantIds),
    isAdmin ? getStaffSummary(partnerId) : Promise.resolve([]),
    db.select().from(aiFacts)
      .where(and(eq(aiFacts.entityType, "partner"), eq(aiFacts.entityId, partnerId)))
      .limit(15)
      .then(rows => rows.map(r => ({ factKey: r.factKey || r.title || "", factValue: r.factValue || r.content || "", confidence: r.confidence ? Number(r.confidence) : null, source: r.source }))),
    isAdmin ? fetchBillingSnapshot(partnerId).catch(() => null) : Promise.resolve(null),
  ]);

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const userRole = isAdmin ? "Admin" : "Controller";
  const pageContext = buildPortfolioPageContext(currentPage);

  // 3. Build system prompt
  const systemPrompt = buildPortfolioRileySystemPrompt(
    partner, userName, userRole, isAdmin, snapshot, clientSnapshots, activity, staff, pageContext, relevantFacts, billingSnapshot,
  );

  // 4. Build conversation messages (last 20)
  const existingMessages = (conversation.messages as Array<{ role: string; content: string }>) || [];
  const recentMessages = existingMessages.slice(-19);
  const conversationHistory: ConversationMessage[] = recentMessages.map(m => ({
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

  // 6. Save
  const now = new Date().toISOString();
  const updatedMessages = [
    ...existingMessages,
    { role: "user", content: userMessage, timestamp: now },
    { role: "assistant", content: response, timestamp: now },
  ];

  await storage.updatePartnerRileyConversation(conversation.id, partnerId, {
    messages: updatedMessages as any,
  });

  return { response, conversationId: conversation.id };
}

export async function getPortfolioRileyResponseStreaming(params: {
  partnerId: string;
  userId: string;
  conversationId: string | null;
  userMessage: string;
  currentPage: string;
  topic: PortfolioRileyTopic;
  relatedEntityType?: string;
  relatedEntityId?: string;
  onDelta: (text: string) => void;
  onDone: (fullResponse: string, conversationId: string) => void;
  onError: (error: Error) => void;
}): Promise<{ conversationId: string }> {
  const { partnerId, userId, userMessage, currentPage, topic, relatedEntityType, relatedEntityId, onDelta, onDone, onError } = params;

  // 1. Load or create conversation
  let conversation = params.conversationId
    ? await storage.getPartnerRileyConversation(params.conversationId, partnerId)
    : null;

  if (!conversation) {
    conversation = await storage.createPartnerRileyConversation({
      partnerId,
      userId,
      messages: [],
      topic,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
    });
  }

  // 2. Fetch context
  const [user, partner] = await Promise.all([
    storage.getUser(userId),
    db.select().from(partners).where(eq(partners.id, partnerId)).limit(1).then(r => r[0]),
  ]);

  if (!partner) throw new Error("Partner not found");

  const isAdmin = (user as any)?.role === "partner";
  const tenantIds = await getAccessibleTenantIds(partnerId, userId, isAdmin);

  const { getBillingSnapshot: fetchBillingSnapshot } = await import("../services/partnerBillingService");
  const [snapshot, clientSnapshots, activity, staff, relevantFacts, billingSnapshot] = await Promise.all([
    getPortfolioSnapshot(tenantIds),
    getClientSnapshots(tenantIds),
    getRecentActivitySummary(tenantIds),
    isAdmin ? getStaffSummary(partnerId) : Promise.resolve([]),
    db.select().from(aiFacts)
      .where(and(eq(aiFacts.entityType, "partner"), eq(aiFacts.entityId, partnerId)))
      .limit(15)
      .then(rows => rows.map(r => ({ factKey: r.factKey || r.title || "", factValue: r.factValue || r.content || "", confidence: r.confidence ? Number(r.confidence) : null, source: r.source }))),
    isAdmin ? fetchBillingSnapshot(partnerId).catch(() => null) : Promise.resolve(null),
  ]);

  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const userRole = isAdmin ? "Admin" : "Controller";
  const pageContext = buildPortfolioPageContext(currentPage);

  // 3. Build system prompt
  const systemPrompt = buildPortfolioRileySystemPrompt(
    partner, userName, userRole, isAdmin, snapshot, clientSnapshots, activity, staff, pageContext, relevantFacts, billingSnapshot,
  );

  // 4. Build conversation messages (last 20)
  const existingMessages = (conversation.messages as Array<{ role: string; content: string }>) || [];
  const recentMessages = existingMessages.slice(-19);
  const conversationHistory: ConversationMessage[] = recentMessages.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  conversationHistory.push({ role: "user", content: userMessage });

  const convId = conversation.id;
  const existingMsgs = existingMessages;

  // 5. Stream Claude response
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
      const now = new Date().toISOString();
      const updatedMessages = [
        ...existingMsgs,
        { role: "user", content: userMessage, timestamp: now },
        { role: "assistant", content: fullResponse, timestamp: now },
      ];
      await storage.updatePartnerRileyConversation(convId, partnerId, {
        messages: updatedMessages as any,
      });
      onDone(fullResponse, convId);
    })
    .catch(onError);

  return { conversationId: convId };
}
