import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { actions, tenants, contacts, invoices } from "@shared/schema";
import { checkCollectionActions, type CollectionAction } from "./collectionsAutomation";

export interface DailyPlanAction {
  id: string;
  contactId: string;
  contactName: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  daysOverdue: number;
  type: 'email' | 'sms' | 'voice';
  status: 'pending_approval' | 'exception';
  subject?: string;
  content?: string;
  confidenceScore: number;
  exceptionReason?: string;
  priority: string;
}

export interface DailyPlanSummary {
  totalActions: number;
  byChannel: {
    email: { count: number; totalValue: number };
    sms: { count: number; totalValue: number };
    voice: { count: number; totalValue: number };
  };
  exceptions: number;
  estimatedOutcomes: {
    expectedPTPs: number;
    expectedValue: number;
  };
  actions: DailyPlanAction[];
  executionTime: string;
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
 */
export async function generateDailyPlan(
  tenantId: string, 
  userId: string,
  regenerate: boolean = false
): Promise<DailyPlanSummary> {
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
      totalActions: 0,
      byChannel: {
        email: { count: 0, totalValue: 0 },
        sms: { count: 0, totalValue: 0 },
        voice: { count: 0, totalValue: 0 },
      },
      exceptions: 0,
      estimatedOutcomes: { expectedPTPs: 0, expectedValue: 0 },
      actions: [],
      executionTime: tenant.executionTime || '09:00',
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
  const existingPlanActions = await db.query.actions.findMany({
    where: and(
      eq(actions.tenantId, tenantId),
      sql`${actions.status} IN ('pending_approval', 'exception')`,
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

  // If regenerating, delete existing pending_approval/exception actions for tomorrow
  if (regenerate && existingPlanActions.length > 0) {
    console.log(`🔄 Regenerating plan - deleting ${existingPlanActions.length} existing actions for tomorrow`);
    await db.delete(actions).where(
      and(
        eq(actions.tenantId, tenantId),
        sql`${actions.status} IN ('pending_approval', 'exception')`,
        sql`${actions.scheduledFor} >= ${windowStart.toISOString()}`,
        sql`${actions.scheduledFor} <= ${windowEnd.toISOString()}`
      )
    );
  }

  // Get recommended actions from existing service
  const recommendedActions = await checkCollectionActions(tenantId);
  
  console.log(`🤖 AI recommended ${recommendedActions.length} actions`);

  // Parse policy settings with safe defaults
  const dailyLimits = (tenant.dailyLimits as any) || { email: 100, sms: 50, voice: 20 };
  const minConfidence = (tenant.minConfidence as any) || { email: 0.8, sms: 0.85, voice: 0.9 };
  const exceptionRules = (tenant.exceptionRules as any) || {
    flagFirstContact: true,
    flagHighValue: 10000,
    flagDisputeKeywords: true,
    flagVipCustomers: true,
  };

  // Group actions by type and apply limits
  const channelCounts = { email: 0, sms: 0, voice: 0 };
  const planActions: DailyPlanAction[] = [];

  // Reuse the execution time calculated earlier (tomorrow variable already defined above)

  // Process each recommended action
  for (const rec of recommendedActions) {
    const actionType = rec.actionType === 'manual' ? 'email' : rec.actionType;
    
    // Skip if daily limit reached for this channel
    if (channelCounts[actionType] >= dailyLimits[actionType]) {
      console.log(`⏭️ Skipping ${actionType} for ${rec.contactName} - daily limit reached`);
      continue;
    }

    // Calculate confidence score (using existing AI learning if available)
    const confidenceScore = (rec as any).confidence || 0.85; // Default to 85% if not provided

    // Check for exceptions
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, rec.contactId)
    });

    let exceptionReason: string | undefined;
    let status: 'pending_approval' | 'exception' = 'pending_approval';

    // Exception Rule 1: First contact high value
    if (exceptionRules.flagFirstContact && !contact?.arContactEmail) {
      const invoiceAmount = parseFloat(rec.amount);
      if (invoiceAmount > exceptionRules.flagHighValue) {
        exceptionReason = 'first_contact_high_value';
        status = 'exception';
      }
    }

    // Exception Rule 2: VIP customer
    if (exceptionRules.flagVipCustomers && contact?.notes?.toLowerCase().includes('vip')) {
      exceptionReason = 'vip_customer';
      status = 'exception';
    }

    // Exception Rule 3: Low confidence
    if (confidenceScore < minConfidence[actionType]) {
      exceptionReason = 'low_confidence';
      status = 'exception';
    }

    // Create action record in database
    const [newAction] = await db.insert(actions).values({
      tenantId,
      contactId: rec.contactId,
      invoiceId: rec.invoiceId,
      userId,
      type: actionType,
      status,
      subject: rec.actionDetails.subject || `Payment reminder - Invoice ${rec.invoiceNumber}`,
      content: rec.actionDetails.message || generateDefaultMessage(rec),
      scheduledFor: tomorrow,
      confidenceScore: confidenceScore.toString(),
      exceptionReason,
      metadata: {
        daysOverdue: rec.daysOverdue,
        amount: rec.amount,
        scheduleName: rec.scheduleName,
        priority: rec.priority,
        generatedBy: 'daily_plan',
      },
      aiGenerated: true,
      source: 'automated',
    }).returning();

    planActions.push({
      id: newAction.id,
      contactId: rec.contactId,
      contactName: rec.contactName,
      invoiceId: rec.invoiceId,
      invoiceNumber: rec.invoiceNumber,
      amount: rec.amount,
      daysOverdue: rec.daysOverdue,
      type: actionType,
      status,
      subject: newAction.subject || undefined,
      content: newAction.content || undefined,
      confidenceScore,
      exceptionReason,
      priority: rec.priority,
    });

    channelCounts[actionType]++;
  }

  // Calculate summary stats
  const totalValue = planActions.reduce((sum, a) => sum + parseFloat(a.amount), 0);
  const exceptionsCount = planActions.filter(a => a.status === 'exception').length;
  
  const byChannel = {
    email: {
      count: planActions.filter(a => a.type === 'email' && a.status === 'pending_approval').length,
      totalValue: planActions.filter(a => a.type === 'email').reduce((sum, a) => sum + parseFloat(a.amount), 0),
    },
    sms: {
      count: planActions.filter(a => a.type === 'sms' && a.status === 'pending_approval').length,
      totalValue: planActions.filter(a => a.type === 'sms').reduce((sum, a) => sum + parseFloat(a.amount), 0),
    },
    voice: {
      count: planActions.filter(a => a.type === 'voice' && a.status === 'pending_approval').length,
      totalValue: planActions.filter(a => a.type === 'voice').reduce((sum, a) => sum + parseFloat(a.amount), 0),
    },
  };

  // Estimate outcomes (rough heuristic: 35% PTP rate, 60% of value)
  const expectedPTPs = Math.round((planActions.length - exceptionsCount) * 0.35);
  const expectedValue = Math.round(totalValue * 0.6);

  console.log(`✅ Generated plan: ${planActions.length} actions (${exceptionsCount} exceptions)`);
  console.log(`📧 Email: ${byChannel.email.count}, 📱 SMS: ${byChannel.sms.count}, 📞 Voice: ${byChannel.voice.count}`);

  return {
    totalActions: planActions.length,
    byChannel,
    exceptions: exceptionsCount,
    estimatedOutcomes: {
      expectedPTPs,
      expectedValue,
    },
    actions: planActions,
    executionTime: tenant.executionTime || '09:00',
    planGeneratedAt: new Date().toISOString(),
  };
}

/**
 * Helper: Build plan summary from existing action records
 */
function buildPlanSummary(existingActions: any[], tenant: any): DailyPlanSummary {
  const planActions: DailyPlanAction[] = existingActions.map(action => ({
    id: action.id,
    contactId: action.contactId,
    contactName: action.contact?.name || 'Unknown',
    invoiceId: action.invoiceId || '',
    invoiceNumber: action.invoice?.invoiceNumber || 'N/A',
    amount: action.invoice?.amount || '0',
    daysOverdue: action.metadata?.daysOverdue || 0,
    type: action.type,
    status: action.status,
    subject: action.subject || undefined,
    content: action.content || undefined,
    confidenceScore: parseFloat(action.confidenceScore || '0.85'),
    exceptionReason: action.exceptionReason || undefined,
    priority: action.metadata?.priority || 'normal',
  }));

  const totalValue = planActions.reduce((sum, a) => sum + parseFloat(a.amount), 0);
  const exceptionsCount = planActions.filter(a => a.status === 'exception').length;
  
  const byChannel = {
    email: {
      count: planActions.filter(a => a.type === 'email' && a.status === 'pending_approval').length,
      totalValue: planActions.filter(a => a.type === 'email').reduce((sum, a) => sum + parseFloat(a.amount), 0),
    },
    sms: {
      count: planActions.filter(a => a.type === 'sms' && a.status === 'pending_approval').length,
      totalValue: planActions.filter(a => a.type === 'sms').reduce((sum, a) => sum + parseFloat(a.amount), 0),
    },
    voice: {
      count: planActions.filter(a => a.type === 'voice' && a.status === 'pending_approval').length,
      totalValue: planActions.filter(a => a.type === 'voice').reduce((sum, a) => sum + parseFloat(a.amount), 0),
    },
  };

  const expectedPTPs = Math.round((planActions.length - exceptionsCount) * 0.35);
  const expectedValue = Math.round(totalValue * 0.6);

  return {
    totalActions: planActions.length,
    byChannel,
    exceptions: exceptionsCount,
    estimatedOutcomes: {
      expectedPTPs,
      expectedValue,
    },
    actions: planActions,
    executionTime: tenant.executionTime || '09:00',
    planGeneratedAt: new Date().toISOString(),
  };
}

/**
 * Helper: Generate default message content
 */
function generateDefaultMessage(action: CollectionAction): string {
  if (action.daysOverdue < 7) {
    return `Dear ${action.contactName},\n\nThis is a friendly reminder that invoice ${action.invoiceNumber} for ${action.amount} is now ${action.daysOverdue} days overdue.\n\nPlease arrange payment at your earliest convenience.\n\nThank you.`;
  } else if (action.daysOverdue < 30) {
    return `Dear ${action.contactName},\n\nInvoice ${action.invoiceNumber} for ${action.amount} is now ${action.daysOverdue} days overdue.\n\nWe would appreciate your immediate attention to this matter.\n\nPlease contact us if there are any issues preventing payment.\n\nThank you.`;
  } else {
    return `Dear ${action.contactName},\n\nWe note that invoice ${action.invoiceNumber} for ${action.amount} remains unpaid after ${action.daysOverdue} days.\n\nWe require urgent payment to avoid further action.\n\nPlease contact us immediately to discuss payment arrangements.\n\nThank you.`;
  }
}
