import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { actions, tenants, invoices } from "@shared/schema";
import { generateInvoiceTableHtml } from "./collectionsAutomation";
import { setupDefaultWorkflow } from "./defaultWorkflowSetup";
import { charlieDecisionEngine, type CharlieDecision, type DailyPlan } from "./charlieDecisionEngine";
import { charliePlaybook, prepareMessageFromDecision } from "./charliePlaybook";

export interface InvoiceSummary {
  id: string;
  number: string;
  amount: number;
  daysOverdue: number;
  dueDate: string;
}

export interface DailyPlanAction {
  id: string;
  contactId: string;
  contactName: string;
  companyName?: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  daysOverdue: number;
  actionType: 'email' | 'sms' | 'voice';
  status: 'pending_approval' | 'exception';
  subject?: string;
  content?: string;
  confidenceScore: number;
  exceptionReason?: string;
  priority: string;
  invoiceCount?: number;
  invoices?: InvoiceSummary[];
  totalOutstanding?: number;
}

export interface DailyPlanResponse {
  actions: DailyPlanAction[];
  summary: {
    totalActions: number;
    byType: {
      email: number;
      sms: number;
      voice: number;
    };
    totalAmount: number;
    avgDaysOverdue: number;
    highPriorityCount: number;
    exceptionCount: number;
    scheduledFor: string;
  };
  tenantPolicies: {
    executionTime: string;
    dailyLimits: { email: number; sms: number; voice: number };
  };
  planGeneratedAt: string;
}

/**
 * Generates tomorrow's daily action plan
 * - Uses existing collectionsAutomation to get recommended actions
 * - Applies tenant policy settings (limits, confidence thresholds)
 * - Flags exceptions based on rules
 * - Creates action records with status='pending_approval'
 * 
 * IDEMPOTENT: If a plan already exists (pending_approval actions), returns it
 * instead of creating duplicates. Pass regenerate=true to force recreation.
 * 
 * fetchOnly: If true, only returns existing plan without generating new actions
 */
export async function generateDailyPlan(
  tenantId: string, 
  userId: string,
  regenerate: boolean = false,
  fetchOnly: boolean = false
): Promise<DailyPlanResponse> {
  console.log(`📋 Generating daily plan for tenant ${tenantId}...`);
  
  // Get tenant settings
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId)
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  if (!tenant.collectionsAutomationEnabled) {
    console.log('Collections automation disabled for this tenant');
    return {
      actions: [],
      summary: {
        totalActions: 0,
        byType: { email: 0, sms: 0, voice: 0 },
        totalAmount: 0,
        avgDaysOverdue: 0,
        highPriorityCount: 0,
        exceptionCount: 0,
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      tenantPolicies: {
        executionTime: tenant.executionTime || '09:00',
        dailyLimits: (tenant.dailyLimits as any) || { email: 100, sms: 50, voice: 20 },
      },
      planGeneratedAt: new Date().toISOString(),
    };
  }

  // Calculate tomorrow's execution window (for checking if plan already exists for tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [hours, minutes] = (tenant.executionTime || '09:00').split(':');
  tomorrow.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  // Define window: 6 hours before to 6 hours after execution time
  const windowStart = new Date(tomorrow);
  windowStart.setHours(windowStart.getHours() - 6);
  const windowEnd = new Date(tomorrow);
  windowEnd.setHours(windowEnd.getHours() + 6);

  // Check if a plan already exists for tomorrow's execution time
  // Note: Only include pending_approval and scheduled - NOT exception (those are moved to VIP)
  const existingPlanActions = await db.query.actions.findMany({
    where: and(
      eq(actions.tenantId, tenantId),
      sql`${actions.status} IN ('pending_approval', 'scheduled')`,
      sql`${actions.scheduledFor} >= ${windowStart.toISOString()}`,
      sql`${actions.scheduledFor} <= ${windowEnd.toISOString()}`
    ),
    with: {
      contact: true,
      invoice: true,
    }
  });

  // If plan exists for tomorrow and not forcing regeneration, return existing plan
  if (existingPlanActions.length > 0 && !regenerate) {
    console.log(`♻️  Returning existing plan for tomorrow: ${existingPlanActions.length} actions`);
    
    return buildPlanSummary(existingPlanActions, tenant);
  }

  // If fetchOnly mode, return empty plan without generating (for demo/testing)
  if (fetchOnly) {
    console.log(`📭 Fetch-only mode: no existing plan, returning empty`);
    return {
      actions: [],
      summary: {
        totalActions: 0,
        byType: { email: 0, sms: 0, voice: 0 },
        totalAmount: 0,
        avgDaysOverdue: 0,
        highPriorityCount: 0,
        exceptionCount: 0,
        scheduledFor: tomorrow.toISOString(),
      },
      tenantPolicies: {
        executionTime: tenant.executionTime || '09:00',
        dailyLimits: (tenant.dailyLimits as any) || { email: 100, sms: 50, voice: 20 },
      },
      planGeneratedAt: new Date().toISOString(),
    };
  }

  // If regenerating, delete existing pending_approval/scheduled actions for tomorrow
  // Note: Do NOT delete exception actions - those are VIP items that need manual handling
  if (regenerate && existingPlanActions.length > 0) {
    console.log(`🔄 Regenerating plan - deleting ${existingPlanActions.length} existing actions for tomorrow`);
    await db.delete(actions).where(
      and(
        eq(actions.tenantId, tenantId),
        sql`${actions.status} IN ('pending_approval', 'scheduled')`,
        sql`${actions.scheduledFor} >= ${windowStart.toISOString()}`,
        sql`${actions.scheduledFor} <= ${windowEnd.toISOString()}`
      )
    );
  }

  // Ensure default workflow is set up (creates templates, schedule, assigns unassigned contacts)
  const workflowSetup = await setupDefaultWorkflow(tenantId);
  console.log(`🔧 Workflow setup: ${workflowSetup.contactsAssigned} contacts auto-assigned to default schedule`);

  // Generate daily plan using Charlie Decision Engine
  console.log(`🤖 Using Charlie Decision Engine for plan generation`);
  return generateDailyPlanWithCharlie(tenantId, userId, tenant, tomorrow);
}

/**
 * Helper: Build plan summary from existing action records
 */
function buildPlanSummary(existingActions: any[], tenant: any): DailyPlanResponse {
  const planActions: DailyPlanAction[] = existingActions.map(action => {
    // Parse invoices from metadata (stored as invoiceDetails)
    const invoiceDetails = action.metadata?.invoiceDetails || [];
    let invoices: InvoiceSummary[] = invoiceDetails.map((inv: any) => ({
      id: inv.id,
      number: inv.number,
      amount: parseFloat(inv.amount) || 0,
      daysOverdue: inv.daysOverdue || 0,
      dueDate: inv.dueDate || '',
    }));
    
    // Fallback for legacy actions: create single invoice entry from action's invoice
    if (invoices.length === 0 && action.invoice) {
      invoices = [{
        id: action.invoiceId || '',
        number: action.invoice.invoiceNumber || 'N/A',
        amount: parseFloat(action.invoice.amount) || 0,
        daysOverdue: action.metadata?.daysOverdue || 0,
        dueDate: action.invoice.dueDate ? new Date(action.invoice.dueDate).toISOString() : '',
      }];
    }
    
    // Total outstanding from metadata (all unpaid invoices for contact, not just overdue)
    const totalOutstanding = parseFloat(action.metadata?.totalOutstanding || action.metadata?.amount || action.invoice?.amount || '0');
    
    return {
      id: action.id,
      contactId: action.contactId,
      contactName: action.contact?.name || 'Unknown',
      companyName: action.contact?.companyName || undefined,
      invoiceId: action.invoiceId || '',
      invoiceNumber: action.invoice?.invoiceNumber || 'N/A',
      amount: action.metadata?.amount || action.invoice?.amount || '0',
      daysOverdue: action.metadata?.daysOverdue || 0,
      actionType: action.type as 'email' | 'sms' | 'voice',
      status: action.status,
      subject: action.subject || undefined,
      content: action.content || undefined,
      confidenceScore: parseFloat(action.confidenceScore || '0.85'),
      exceptionReason: action.exceptionReason || undefined,
      priority: action.metadata?.priority || 'normal',
      invoiceCount: action.metadata?.invoiceCount || 1,
      invoices: invoices.length > 0 ? invoices : undefined,
      totalOutstanding,
    };
  });

  const totalValue = planActions.reduce((sum, a) => sum + parseFloat(a.amount), 0);
  const exceptionsCount = planActions.filter(a => a.status === 'exception').length;
  const highPriorityCount = planActions.filter(a => a.priority === 'high').length;
  const avgDaysOverdue = planActions.length > 0 
    ? planActions.reduce((sum, a) => sum + a.daysOverdue, 0) / planActions.length 
    : 0;

  return {
    actions: planActions,
    summary: {
      totalActions: planActions.length,
      byType: {
        email: planActions.filter(a => a.actionType === 'email' && a.status === 'pending_approval').length,
        sms: planActions.filter(a => a.actionType === 'sms' && a.status === 'pending_approval').length,
        voice: planActions.filter(a => a.actionType === 'voice' && a.status === 'pending_approval').length,
      },
      totalAmount: totalValue,
      avgDaysOverdue: avgDaysOverdue,
      highPriorityCount: highPriorityCount,
      exceptionCount: exceptionsCount,
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    tenantPolicies: {
      executionTime: tenant.executionTime || '09:00',
      dailyLimits: (tenant.dailyLimits as { email: number; sms: number; voice: number }) || { email: 100, sms: 50, voice: 20 },
    },
    planGeneratedAt: new Date().toISOString(),
  };
}

// ============================================================================
// CHARLIE DECISION ENGINE INTEGRATION
// ============================================================================

/**
 * Generate daily plan using Charlie Decision Engine
 * 
 * Uses Charlie's intelligent decision-making:
 * - Invoice state machine (12 states)
 * - Customer segmentation
 * - Prioritization logic
 * - Cadence rules
 * - Tone progression
 */
async function generateDailyPlanWithCharlie(
  tenantId: string,
  userId: string,
  tenant: typeof tenants.$inferSelect,
  scheduledFor: Date
): Promise<DailyPlanResponse> {
  // Get Charlie's daily plan with all decisions
  const charliePlan = await charlieDecisionEngine.generateDailyPlan(tenantId);
  
  console.log(`🤖 Charlie generated ${charliePlan.decisions.length} decisions`);
  console.log(`   Critical: ${charliePlan.summary.byCriticalPriority}, High: ${charliePlan.summary.byHighPriority}`);
  console.log(`   Human review needed: ${charliePlan.summary.humanReviewRequired}`);
  
  // Parse policy settings
  const dailyLimits = (tenant.dailyLimits as any) || { email: 100, sms: 50, voice: 20 };
  const minConfidence = (tenant.minConfidence as any) || { email: 0.8, sms: 0.85, voice: 0.9 };
  const exceptionRules = (tenant.exceptionRules as any) || {
    flagFirstContact: true,
    flagHighValue: 10000,
    flagDisputeKeywords: true,
    flagVipCustomers: true,
  };
  
  // Get tenant config for message preparation
  const tenantConfig = {
    companyName: tenant.name,
    senderName: tenant.name,
    contactNumber: tenant.phone || '',
    paymentDetails: tenant.paymentDetails || 'Please contact us for payment details.',
  };
  
  // Filter actionable decisions (not excluded, within cadence)
  // Debug: Log filter breakdown to understand why decisions may be dropped
  const notExcluded = charliePlan.decisions.filter(d => d.priorityTier !== 'excluded');
  const hasChannel = charliePlan.decisions.filter(d => d.recommendedChannel !== 'none');
  const withinCadence = charliePlan.decisions.filter(d => d.isWithinCadence);
  
  console.log(`🔍 Decision filter breakdown:`);
  console.log(`   Total: ${charliePlan.decisions.length}`);
  console.log(`   Not excluded: ${notExcluded.length}`);
  console.log(`   Has channel: ${hasChannel.length}`);
  console.log(`   Within cadence: ${withinCadence.length}`);
  
  const actionableDecisions = charliePlan.decisions.filter(d => 
    d.priorityTier !== 'excluded' && 
    d.recommendedChannel !== 'none' &&
    d.isWithinCadence &&
    d.invoice.daysOverdue > 0  // Only include actually overdue invoices
  );
  
  console.log(`   All filters passed: ${actionableDecisions.length}`);
  
  // Sort by priority score (highest first)
  actionableDecisions.sort((a, b) => b.priorityScore - a.priorityScore);
  
  // Apply daily limits
  const channelCounts = { email: 0, sms: 0, voice: 0 };
  const planActions: DailyPlanAction[] = [];
  
  // GROUP DECISIONS BY CONTACT - consolidate multiple invoices into one action per contact
  const decisionsByContact = new Map<string, typeof actionableDecisions>();
  for (const decision of actionableDecisions) {
    const existing = decisionsByContact.get(decision.contactId) || [];
    existing.push(decision);
    decisionsByContact.set(decision.contactId, existing);
  }
  
  console.log(`📊 Grouped ${actionableDecisions.length} decisions into ${decisionsByContact.size} contacts`);
  
  // Process each contact ONCE (with all their invoices consolidated)
  for (const [contactId, contactDecisions] of decisionsByContact) {
    // Use first decision (highest priority due to earlier sort) for channel/priority
    const primaryDecision = contactDecisions[0];
    const channel = primaryDecision.recommendedChannel;
    if (channel === 'none') continue;
    
    // Map voice channel to correct type for limits
    const limitChannel = channel === 'voice' ? 'voice' : channel;
    
    // Skip if daily limit reached
    if (channelCounts[limitChannel] >= dailyLimits[limitChannel]) {
      console.log(`⏭️ Skipping ${channel} for ${primaryDecision.contact.name} - daily limit reached`);
      continue;
    }
    
    // Calculate consolidated amounts from all OVERDUE invoices for this contact (amount being chased)
    const totalAmount = contactDecisions.reduce((sum, d) => sum + d.invoice.amount, 0);
    const invoiceCount = contactDecisions.length;
    
    // Query total outstanding for ALL unpaid invoices for this contact (not just overdue)
    const allUnpaidInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.contactId, contactId),
        eq(invoices.tenantId, tenantId),
        sql`${invoices.status} NOT IN ('paid', 'voided', 'deleted')`
      ),
    });
    const contactTotalOutstanding = allUnpaidInvoices.reduce(
      (sum, inv) => sum + parseFloat(inv.amount?.toString() || '0'), 
      0
    );
    const maxDaysOverdue = Math.max(...contactDecisions.map(d => d.invoice.daysOverdue));
    
    // Find the oldest due date (earliest date = most overdue)
    const oldestDueDate = contactDecisions.reduce((oldest, d) => {
      const dueDate = new Date(d.invoice.dueDate);
      return dueDate < oldest ? dueDate : oldest;
    }, new Date(contactDecisions[0].invoice.dueDate));
    
    // Build invoice tables for multi-invoice contacts - plain text for SMS/voice, HTML for email
    const invoiceTablePlain = contactDecisions.map(d => 
      `• Invoice ${d.invoice.invoiceNumber}: £${d.invoice.amount.toFixed(2)} (${d.invoice.daysOverdue} days overdue)`
    ).join('\n');
    
    const invoiceTableHtml = generateInvoiceTableHtml(contactDecisions.map(d => ({
      invoiceId: d.invoiceId,
      invoiceNumber: d.invoice.invoiceNumber,
      amount: d.invoice.amount.toFixed(2),
      dueDate: new Date(d.invoice.dueDate).toLocaleDateString('en-GB'),
      daysOverdue: d.invoice.daysOverdue,
    })));
    
    // All Charlie-generated actions stay as pending_approval
    // VIP routing is user-driven only (manual action on debtor or from planned list)
    const status: 'pending_approval' = 'pending_approval';
    
    // Prepare consolidated message with invoice table (use HTML for email, plain text for SMS/voice)
    const invoiceTableForChannel = channel === 'email' ? invoiceTableHtml : invoiceTablePlain;
    
    const consolidatedDecision = {
      ...primaryDecision,
      invoice: {
        ...primaryDecision.invoice,
        amount: totalAmount,
        daysOverdue: maxDaysOverdue,
        dueDate: oldestDueDate,  // Use oldest due date for consistent messaging
      },
      invoiceCount,
      invoiceTable: invoiceTableForChannel,
      invoiceTablePlain,
      invoiceTableHtml,
      allInvoiceIds: contactDecisions.map(d => d.invoiceId),
    };
    
    const preparedMessage = prepareMessageFromDecision(consolidatedDecision as any, tenantConfig);
    
    // Generate subject line (different for single vs multiple invoices)
    const subject = invoiceCount > 1
      ? `Payment reminder - ${invoiceCount} outstanding invoices totalling £${totalAmount.toFixed(2)}`
      : preparedMessage?.subject || `Payment reminder: Invoice ${primaryDecision.invoice.invoiceNumber}`;
    
    // Map priority tier to priority string
    const priority = primaryDecision.priorityTier === 'critical' || primaryDecision.priorityTier === 'high' 
      ? 'high' 
      : primaryDecision.priorityTier === 'medium' ? 'medium' : 'low';
    
    // Create ONE action per contact (primary invoice ID, but metadata contains all)
    const [newAction] = await db.insert(actions).values({
      tenantId,
      contactId: primaryDecision.contactId,
      invoiceId: primaryDecision.invoiceId,
      userId,
      type: channel,
      status,
      subject,
      content: preparedMessage?.body || '',
      scheduledFor,
      confidenceScore: primaryDecision.confidence.toString(),
      metadata: {
        daysOverdue: maxDaysOverdue,
        amount: totalAmount.toString(),
        totalOutstanding: contactTotalOutstanding.toString(),
        priority,
        generatedBy: 'charlie_decision_engine',
        charlieState: primaryDecision.charlieState,
        customerSegment: primaryDecision.customerSegment,
        priorityScore: primaryDecision.priorityScore,
        priorityReasons: primaryDecision.priorityReasons,
        channelReason: primaryDecision.channelReason,
        escalationTrigger: primaryDecision.escalationTrigger,
        toneProfile: primaryDecision.toneProfile,
        invoiceCount,
        allInvoiceIds: contactDecisions.map(d => d.invoiceId),
        invoiceTable: invoiceCount > 1 ? invoiceTablePlain : undefined,
        invoiceTableHtml: invoiceCount > 1 ? invoiceTableHtml : undefined,
        invoiceDetails: contactDecisions.map(d => ({
          id: d.invoiceId,
          number: d.invoice.invoiceNumber,
          amount: d.invoice.amount,
          daysOverdue: d.invoice.daysOverdue,
          dueDate: d.invoice.dueDate ? new Date(d.invoice.dueDate).toISOString() : '',
        })),
      },
      aiGenerated: true,
      source: 'automated',
    }).returning();
    
    // Build invoices array for drawer display
    const invoicesSummary: InvoiceSummary[] = contactDecisions.map(d => ({
      id: d.invoiceId,
      number: d.invoice.invoiceNumber,
      amount: d.invoice.amount,
      daysOverdue: d.invoice.daysOverdue,
      dueDate: d.invoice.dueDate ? new Date(d.invoice.dueDate).toISOString() : '',
    }));
    
    planActions.push({
      id: newAction.id,
      contactId: primaryDecision.contactId,
      contactName: primaryDecision.contact.name,
      companyName: primaryDecision.contact.companyName,
      invoiceId: primaryDecision.invoiceId,
      invoiceNumber: invoiceCount > 1 
        ? `${invoiceCount} invoices`
        : primaryDecision.invoice.invoiceNumber,
      amount: totalAmount.toString(),
      daysOverdue: maxDaysOverdue,
      actionType: channel,
      status,
      subject: newAction.subject || undefined,
      content: newAction.content || undefined,
      confidenceScore: primaryDecision.confidence,
      priority,
      invoiceCount,
      invoices: invoicesSummary,
      totalOutstanding: contactTotalOutstanding,
    });
    
    channelCounts[limitChannel]++;
  }
  
  // Calculate summary stats
  const totalValue = planActions.reduce((sum, a) => sum + parseFloat(a.amount), 0);
  const exceptionsCount = planActions.filter(a => a.status === 'exception').length;
  const highPriorityCount = planActions.filter(a => a.priority === 'high').length;
  const avgDaysOverdue = planActions.length > 0 
    ? planActions.reduce((sum, a) => sum + a.daysOverdue, 0) / planActions.length 
    : 0;
  
  console.log(`✅ Charlie plan: ${planActions.length} actions (${exceptionsCount} exceptions)`);
  console.log(`📧 Email: ${channelCounts.email}, 📱 SMS: ${channelCounts.sms}, 📞 Voice: ${channelCounts.voice}`);
  
  return {
    actions: planActions,
    summary: {
      totalActions: planActions.length,
      byType: {
        email: planActions.filter(a => a.actionType === 'email' && a.status === 'pending_approval').length,
        sms: planActions.filter(a => a.actionType === 'sms' && a.status === 'pending_approval').length,
        voice: planActions.filter(a => a.actionType === 'voice' && a.status === 'pending_approval').length,
      },
      totalAmount: totalValue,
      avgDaysOverdue,
      highPriorityCount,
      exceptionCount: exceptionsCount,
      scheduledFor: scheduledFor.toISOString(),
    },
    tenantPolicies: {
      executionTime: tenant.executionTime || '09:00',
      dailyLimits: dailyLimits,
    },
    planGeneratedAt: new Date().toISOString(),
  };
}
