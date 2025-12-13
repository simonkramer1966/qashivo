import { db } from "../db";
import { invoices, contacts, actions, tenants } from "@shared/schema";
import { eq, and, desc, gt, lt, isNull, or, sql } from "drizzle-orm";
import { invoiceStateMachine, CharlieInvoiceState, CHARLIE_STATES } from "./invoiceStateMachine";
import { 
  charliePlaybook, 
  CadenceRule, 
  PreparedMessage, 
  TemplateContext 
} from "./charliePlaybook";
import { TemplateId, ToneProfile, VoiceTone } from "./playbookEngine";

/**
 * Charlie Decision Engine
 * 
 * Implements the decision-making logic from Charlie Requirements document:
 * - Prioritization: Which invoices to chase first
 * - Channel Selection: Email → SMS → Call based on context
 * - Escalation: When to move from friendly to formal
 * 
 * Design principles:
 * - Charlie IS the credit controller (autonomous execution)
 * - User supervises, Charlie executes
 * - Protect relationships while securing payment
 */

// Priority tiers from Charlie Requirements Section 4
export type PriorityTier = 
  | 'critical'      // Missed PTP - top priority
  | 'high'          // 60+ days overdue high value, or 30-60 moderate/high
  | 'medium'        // Newly overdue high value / new customer
  | 'low'           // Everything else
  | 'excluded';     // On hold, disputed, or in PTP

// Channel options
export type CharlieChannel = 'email' | 'sms' | 'voice' | 'none';

// Customer segment for approach adjustment (Section 6)
export type CustomerSegment = 
  | 'new_customer'          // Tighter follow-up, confirm AP process
  | 'good_payer'            // Assume admin slip, friendly tone
  | 'chronic_late_payer'    // Shorter cadence, earlier escalation
  | 'enterprise'            // Process-driven, PO/portal focus
  | 'small_business'        // More cashflow-driven, phone effective
  | 'standard';             // Default segment

// Escalation trigger reasons
export type EscalationTrigger = 
  | 'missed_ptp'
  | 'repeated_non_response'
  | 'overdue_30_plus_no_progress'
  | 'high_value_avoidance'
  | 'pattern_change'
  | 'none';

// Decision output structure
export interface CharlieDecision {
  invoiceId: string;
  contactId: string;
  tenantId: string;
  
  // Current state
  charlieState: CharlieInvoiceState;
  stateMetadata: typeof CHARLIE_STATES[CharlieInvoiceState];
  
  // Priority
  priorityTier: PriorityTier;
  priorityScore: number;  // 0-100
  priorityReasons: string[];
  
  // Channel recommendation
  recommendedChannel: CharlieChannel;
  channelReason: string;
  
  // Customer context
  customerSegment: CustomerSegment;
  
  // Escalation
  shouldEscalate: boolean;
  escalationTrigger: EscalationTrigger;
  
  // Timing
  nextActionDate: Date;
  cooldownUntil: Date | null;
  
  // Confidence
  confidence: number;  // 0-1
  requiresHumanReview: boolean;
  
  // Invoice details for context
  invoice: {
    invoiceNumber: string;
    amount: number;
    daysOverdue: number;
    dueDate: Date;
  };
  
  // Contact details
  contact: {
    name: string;
    email: string | null;
    phone: string | null;
    lastContactDate: Date | null;
    daysSinceLastContact: number | null;
  };
  
  // Template and messaging (from Playbook)
  templateId: TemplateId | null;
  toneProfile: ToneProfile;
  voiceTone: VoiceTone;
  cadence: CadenceRule;
  isWithinCadence: boolean;
}

// Decision batch for daily planning
export interface DailyPlan {
  tenantId: string;
  generatedAt: Date;
  decisions: CharlieDecision[];
  summary: {
    total: number;
    byCriticalPriority: number;
    byHighPriority: number;
    byMediumPriority: number;
    byLowPriority: number;
    excluded: number;
    byChannel: {
      email: number;
      sms: number;
      voice: number;
    };
    escalationRequired: number;
    humanReviewRequired: number;
  };
}

/**
 * Charlie Decision Engine Class
 */
class CharlieDecisionEngine {
  
  /**
   * Generate decision for a single invoice
   */
  async makeDecision(
    invoiceId: string,
    tenantId: string
  ): Promise<CharlieDecision | null> {
    // Get invoice with contact
    const [result] = await db
      .select({
        invoice: invoices,
        contact: contacts,
      })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(
        eq(invoices.id, invoiceId),
        eq(invoices.tenantId, tenantId)
      ))
      .limit(1);
    
    if (!result) return null;
    
    const { invoice, contact } = result;
    
    // Get last action for contact
    const [lastAction] = await db
      .select()
      .from(actions)
      .where(and(
        eq(actions.tenantId, tenantId),
        eq(actions.contactId, contact.id),
        or(
          eq(actions.type, 'email'),
          eq(actions.type, 'sms'),
          eq(actions.type, 'call')
        )
      ))
      .orderBy(desc(actions.createdAt))
      .limit(1);
    
    // Count actions in the last 7 days for weekly cadence check
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const [weeklyCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(actions)
      .where(and(
        eq(actions.tenantId, tenantId),
        eq(actions.contactId, contact.id),
        or(
          eq(actions.type, 'email'),
          eq(actions.type, 'sms'),
          eq(actions.type, 'call')
        ),
        gt(actions.createdAt, sevenDaysAgo)
      ));
    
    const weeklyContactCount = weeklyCountResult?.count || 0;
    
    // Compute state
    const charlieState = invoiceStateMachine.computeState(invoice);
    const stateMetadata = CHARLIE_STATES[charlieState];
    
    // Calculate days overdue
    const now = new Date();
    const dueDate = invoice.dueDate;
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate days since last contact
    const lastContactDate = lastAction?.createdAt || null;
    const daysSinceLastContact = lastContactDate 
      ? Math.floor((now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    // Determine customer segment
    const customerSegment = this.determineCustomerSegment(contact);
    
    // Calculate priority
    const { priorityTier, priorityScore, priorityReasons } = this.calculatePriority(
      invoice,
      contact,
      charlieState,
      daysOverdue,
      daysSinceLastContact
    );
    
    // Check for exclusion
    if (priorityTier === 'excluded') {
      const excludedCadence = charliePlaybook.getCadenceForSegment(customerSegment, 'none');
      return {
        invoiceId: invoice.id,
        contactId: contact.id,
        tenantId,
        charlieState,
        stateMetadata,
        priorityTier,
        priorityScore: 0,
        priorityReasons,
        recommendedChannel: 'none',
        channelReason: 'Invoice excluded from automation',
        customerSegment,
        shouldEscalate: false,
        escalationTrigger: 'none',
        nextActionDate: now,
        cooldownUntil: invoice.pausedUntil || null,
        confidence: 1,
        requiresHumanReview: stateMetadata.requiresHumanApproval,
        invoice: {
          invoiceNumber: invoice.invoiceNumber,
          amount: parseFloat(invoice.amount as string),
          daysOverdue,
          dueDate: invoice.dueDate,
        },
        contact: {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          lastContactDate,
          daysSinceLastContact,
        },
        templateId: null,
        toneProfile: ToneProfile.CREDIT_CONTROL_FRIENDLY,
        voiceTone: VoiceTone.VOICE_TONE_CALM_COLLABORATIVE,
        cadence: excludedCadence,
        isWithinCadence: false,
      };
    }
    
    // Select channel
    const { channel, reason: channelReason } = this.selectChannel(
      invoice,
      contact,
      charlieState,
      daysOverdue,
      daysSinceLastContact,
      customerSegment
    );
    
    // Check escalation triggers
    const { shouldEscalate, trigger: escalationTrigger } = this.checkEscalation(
      invoice,
      contact,
      charlieState,
      daysOverdue,
      daysSinceLastContact
    );
    
    // Calculate cooldown
    const cooldownUntil = this.calculateCooldown(lastContactDate, charlieState);
    
    // Determine next action date
    const nextActionDate = cooldownUntil && cooldownUntil > now ? cooldownUntil : now;
    
    // Calculate confidence
    const confidence = this.calculateConfidence(invoice, contact, daysSinceLastContact);
    
    // Check if human review is needed
    const requiresHumanReview = this.needsHumanReview(
      invoice,
      contact,
      charlieState,
      stateMetadata,
      confidence
    );
    
    // Get playbook cadence and template info
    const cadence = charliePlaybook.getCadenceForSegment(customerSegment, channel);
    const isWithinCadence = charliePlaybook.isWithinCadence(lastContactDate, channel, customerSegment, weeklyContactCount);
    const { toneProfile, voiceTone, templateId } = this.selectTemplateFromPlaybook(
      charlieState,
      channel,
      shouldEscalate
    );
    
    return {
      invoiceId: invoice.id,
      contactId: contact.id,
      tenantId,
      charlieState,
      stateMetadata,
      priorityTier,
      priorityScore,
      priorityReasons,
      recommendedChannel: channel,
      channelReason,
      customerSegment,
      shouldEscalate,
      escalationTrigger,
      nextActionDate,
      cooldownUntil,
      confidence,
      requiresHumanReview,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        amount: parseFloat(invoice.amount as string),
        daysOverdue,
        dueDate: invoice.dueDate,
      },
      contact: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        lastContactDate,
        daysSinceLastContact,
      },
      templateId,
      toneProfile,
      voiceTone,
      cadence,
      isWithinCadence,
    };
  }
  
  /**
   * Generate daily plan for a tenant
   * Returns prioritized list of decisions for user approval
   */
  async generateDailyPlan(tenantId: string): Promise<DailyPlan> {
    const now = new Date();
    
    // Get all active invoices for tenant
    const allInvoices = await db
      .select()
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        // Exclude paid and cancelled
        sql`${invoices.status} NOT IN ('paid', 'cancelled')`,
        // Must have a due date
        sql`${invoices.dueDate} IS NOT NULL`
      ));
    
    // Generate decisions for each invoice
    const decisions: CharlieDecision[] = [];
    
    for (const invoice of allInvoices) {
      const decision = await this.makeDecision(invoice.id, tenantId);
      if (decision) {
        decisions.push(decision);
      }
    }
    
    // Sort by priority (critical first, then high, etc.)
    const sortedDecisions = this.sortByPriority(decisions);
    
    // Calculate summary
    const summary = {
      total: decisions.length,
      byCriticalPriority: decisions.filter(d => d.priorityTier === 'critical').length,
      byHighPriority: decisions.filter(d => d.priorityTier === 'high').length,
      byMediumPriority: decisions.filter(d => d.priorityTier === 'medium').length,
      byLowPriority: decisions.filter(d => d.priorityTier === 'low').length,
      excluded: decisions.filter(d => d.priorityTier === 'excluded').length,
      byChannel: {
        email: decisions.filter(d => d.recommendedChannel === 'email').length,
        sms: decisions.filter(d => d.recommendedChannel === 'sms').length,
        voice: decisions.filter(d => d.recommendedChannel === 'voice').length,
      },
      escalationRequired: decisions.filter(d => d.shouldEscalate).length,
      humanReviewRequired: decisions.filter(d => d.requiresHumanReview).length,
    };
    
    return {
      tenantId,
      generatedAt: now,
      decisions: sortedDecisions,
      summary,
    };
  }
  
  /**
   * Determine customer segment based on contact data (Section 6)
   */
  private determineCustomerSegment(contact: typeof contacts.$inferSelect): CustomerSegment {
    // Check for new customer (less than 90 days or few invoices)
    const daysSinceCreated = contact.createdAt 
      ? Math.floor((Date.now() - contact.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    if (daysSinceCreated < 90) {
      return 'new_customer';
    }
    
    // Check behavioral score for payment patterns (use riskScore as proxy)
    const behaviorScore = contact.riskScore ? 100 - parseFloat(String(contact.riskScore)) : 50;
    
    if (behaviorScore >= 80) {
      return 'good_payer';
    }
    
    if (behaviorScore <= 30) {
      return 'chronic_late_payer';
    }
    
    // Check for enterprise indicators
    const creditLimit = contact.creditLimit ? parseFloat(contact.creditLimit as string) : 0;
    if (creditLimit > 50000) {
      return 'enterprise';
    }
    
    // Check for small business indicators
    if (creditLimit < 5000) {
      return 'small_business';
    }
    
    return 'standard';
  }
  
  /**
   * Calculate priority tier and score (Section 4)
   */
  private calculatePriority(
    invoice: typeof invoices.$inferSelect,
    contact: typeof contacts.$inferSelect,
    charlieState: CharlieInvoiceState,
    daysOverdue: number,
    daysSinceLastContact: number | null
  ): { priorityTier: PriorityTier; priorityScore: number; priorityReasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    
    // Check for exclusion first
    if (charlieState === 'admin_blocked' || charlieState === 'disputed' || charlieState === 'ptp') {
      reasons.push(`Invoice in ${CHARLIE_STATES[charlieState].label} state`);
      return { priorityTier: 'excluded', priorityScore: 0, priorityReasons: reasons };
    }
    
    if (invoice.isOnHold) {
      reasons.push('Invoice is on hold');
      return { priorityTier: 'excluded', priorityScore: 0, priorityReasons: reasons };
    }
    
    // Terminal states
    if (charlieState === 'ptp_met' || charlieState === 'debt_recovery') {
      reasons.push(`Invoice in terminal state: ${CHARLIE_STATES[charlieState].label}`);
      return { priorityTier: 'excluded', priorityScore: 0, priorityReasons: reasons };
    }
    
    const amount = parseFloat(invoice.amount as string);
    const isHighValue = amount >= 10000;
    const isModerateValue = amount >= 5000;
    
    // Tier 1: Missed PTP (highest priority)
    if (charlieState === 'ptp_missed') {
      score = 95;
      reasons.push('Missed promise to pay - requires immediate follow-up');
      return { priorityTier: 'critical', priorityScore: score, priorityReasons: reasons };
    }
    
    // Tier 2: 60+ days overdue high value
    if (daysOverdue >= 60 && isHighValue) {
      score = 85;
      reasons.push(`60+ days overdue with high value (${this.formatCurrency(amount)})`);
      return { priorityTier: 'high', priorityScore: score, priorityReasons: reasons };
    }
    
    // Tier 3: 30-60 days overdue moderate/high value
    if (daysOverdue >= 30 && daysOverdue < 60 && (isHighValue || isModerateValue)) {
      score = 75;
      reasons.push(`30-60 days overdue with ${isHighValue ? 'high' : 'moderate'} value`);
      return { priorityTier: 'high', priorityScore: score, priorityReasons: reasons };
    }
    
    // Tier 4: Newly overdue high value / new customer
    const isNewlyOverdue = daysOverdue > 0 && daysOverdue <= 7;
    const daysSinceCreated = contact.createdAt 
      ? Math.floor((Date.now() - contact.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 365;
    const isNewCustomer = daysSinceCreated < 90;
    
    if (isNewlyOverdue && (isHighValue || isNewCustomer)) {
      score = 65;
      if (isHighValue) reasons.push('Newly overdue high value invoice');
      if (isNewCustomer) reasons.push('New customer - establish payment pattern early');
      return { priorityTier: 'medium', priorityScore: score, priorityReasons: reasons };
    }
    
    // Add score components for remaining invoices
    
    // Overdue severity
    if (daysOverdue > 60) {
      score += 40;
      reasons.push(`${daysOverdue} days overdue`);
    } else if (daysOverdue > 30) {
      score += 30;
      reasons.push(`${daysOverdue} days overdue`);
    } else if (daysOverdue > 14) {
      score += 20;
      reasons.push(`${daysOverdue} days overdue`);
    } else if (daysOverdue > 7) {
      score += 10;
      reasons.push(`${daysOverdue} days overdue`);
    } else if (daysOverdue > 0) {
      score += 5;
      reasons.push('Recently overdue');
    }
    
    // Amount at risk
    if (isHighValue) {
      score += 15;
      reasons.push(`High value: ${this.formatCurrency(amount)}`);
    } else if (isModerateValue) {
      score += 10;
      reasons.push(`Moderate value: ${this.formatCurrency(amount)}`);
    }
    
    // Contact recency boost
    if (daysSinceLastContact !== null) {
      if (daysSinceLastContact >= 14 && daysOverdue > 0) {
        score += 15;
        reasons.push(`No contact in ${daysSinceLastContact} days`);
      } else if (daysSinceLastContact >= 7) {
        score += 5;
      }
    } else if (daysOverdue > 0) {
      score += 10;
      reasons.push('Never contacted while overdue');
    }
    
    // Final demand stage
    if (charlieState === 'final_demand') {
      score += 20;
      reasons.push('In final demand stage');
    }
    
    score = Math.min(100, score);
    
    // Determine tier from score
    let tier: PriorityTier = 'low';
    if (score >= 80) tier = 'high';
    else if (score >= 50) tier = 'medium';
    
    return { priorityTier: tier, priorityScore: score, priorityReasons: reasons };
  }
  
  /**
   * Select communication channel (Section 5)
   * 
   * Mandated progression: Email first → SMS after 48-72h → Call for escalated cases
   * Voice calls only allowed when:
   * - PTP missed (after prior contact attempts)
   * - Extended non-response with prior attempts (reminderCount >= 2)
   * - High value/aged debt with prior attempts
   */
  private selectChannel(
    invoice: typeof invoices.$inferSelect,
    contact: typeof contacts.$inferSelect,
    charlieState: CharlieInvoiceState,
    daysOverdue: number,
    daysSinceLastContact: number | null,
    customerSegment: CustomerSegment
  ): { channel: CharlieChannel; reason: string } {
    const amount = parseFloat(invoice.amount as string);
    const isHighValue = amount >= 10000;
    
    const hasEmail = !!contact.email;
    const hasPhone = !!contact.phone;
    
    // Track prior contact attempts - use reminderCount as proxy for outbound attempts
    const priorAttempts = invoice.reminderCount || 0;
    const hasHadEmailAttempt = priorAttempts >= 1;
    const hasHadSmsAttempt = priorAttempts >= 2;
    
    // Final demand - always formal email first
    if (charlieState === 'final_demand') {
      return { channel: 'email', reason: 'Final demand requires formal written notice' };
    }
    
    // PTP missed - escalation rules apply
    // Still follow cadence: need prior attempts before calling
    if (charlieState === 'ptp_missed') {
      // Only call if we've already tried email and SMS
      if (hasPhone && hasHadSmsAttempt && (isHighValue || daysOverdue > 30)) {
        return { channel: 'voice', reason: 'Missed PTP after prior attempts - call for immediate commitment' };
      }
      // If we've had email but not SMS, try SMS
      if (hasPhone && hasHadEmailAttempt && !hasHadSmsAttempt) {
        return { channel: 'sms', reason: 'Missed PTP - SMS nudge before escalating to call' };
      }
      // First touch on missed PTP - still email first
      if (hasEmail && !hasHadEmailAttempt) {
        return { channel: 'email', reason: 'Missed PTP - email first for audit trail' };
      }
      // Fallback if no email
      if (hasPhone) {
        return { channel: 'sms', reason: 'Missed PTP - SMS as email not available' };
      }
      return { channel: 'email', reason: 'Missed PTP - email as only channel available' };
    }
    
    // STEP 1: First touch - ALWAYS email (unless no email available)
    if (daysSinceLastContact === null || !hasHadEmailAttempt) {
      if (hasEmail) {
        return { channel: 'email', reason: 'First touch - email for audit trail' };
      }
      if (hasPhone) {
        return { channel: 'sms', reason: 'First touch - SMS as email not available' };
      }
      return { channel: 'none', reason: 'No valid contact channel available' };
    }
    
    // STEP 2: No response after 48-72h - SMS nudge
    // Only after we've sent at least one email (hasHadEmailAttempt)
    if (daysSinceLastContact >= 2 && daysSinceLastContact <= 5 && !hasHadSmsAttempt) {
      if (hasPhone) {
        return { channel: 'sms', reason: 'No response after 48-72h - SMS nudge per cadence' };
      }
      return { channel: 'email', reason: 'Follow-up needed - SMS not available' };
    }
    
    // STEP 3: Extended non-response (5+ days) - can escalate to call if prior attempts exist
    if (daysSinceLastContact >= 5 && hasHadSmsAttempt) {
      // Only call for high value or aged debt when we've had multiple attempts
      if (hasPhone && (isHighValue || daysOverdue > 30)) {
        return { channel: 'voice', reason: 'Extended non-response after email+SMS - call required' };
      }
      // Otherwise continue with SMS
      if (hasPhone) {
        return { channel: 'sms', reason: 'Extended non-response - continue SMS follow-up' };
      }
      return { channel: 'email', reason: 'Follow-up needed - phone not available' };
    }
    
    // Still waiting for SMS window or haven't tried SMS yet
    if (daysSinceLastContact >= 5 && !hasHadSmsAttempt) {
      if (hasPhone) {
        return { channel: 'sms', reason: 'Extended non-response - SMS nudge' };
      }
      return { channel: 'email', reason: 'Extended non-response - email follow-up' };
    }
    
    // Enterprise customers - prefer formal email throughout
    if (customerSegment === 'enterprise') {
      return { channel: 'email', reason: 'Enterprise customer - formal written communication' };
    }
    
    // Default to email for all other cases
    if (hasEmail) {
      return { channel: 'email', reason: 'Standard follow-up via email' };
    }
    
    if (hasPhone) {
      return { channel: 'sms', reason: 'Email not available - using SMS' };
    }
    
    return { channel: 'none', reason: 'No valid contact channel available' };
  }
  
  /**
   * Check escalation triggers (Section 10)
   * 
   * Escalation triggers from requirements:
   * - Missed PTP
   * - Repeated non-response (3+ touches across channels with no reply)
   * - >30 days overdue with no progress
   * - High value exposure + signs of avoidance
   * - Pattern change (good payer now slipping)
   */
  private checkEscalation(
    invoice: typeof invoices.$inferSelect,
    contact: typeof contacts.$inferSelect,
    charlieState: CharlieInvoiceState,
    daysOverdue: number,
    daysSinceLastContact: number | null
  ): { shouldEscalate: boolean; trigger: EscalationTrigger } {
    // Missed PTP - highest priority trigger
    if (charlieState === 'ptp_missed') {
      return { shouldEscalate: true, trigger: 'missed_ptp' };
    }
    
    // Already at escalation stages
    if (charlieState === 'final_demand' || charlieState === 'debt_recovery') {
      return { shouldEscalate: false, trigger: 'none' }; // Already escalated
    }
    
    const priorAttempts = invoice.reminderCount || 0;
    const amount = parseFloat(invoice.amount as string);
    const isHighValue = amount >= 10000;
    
    // Repeated non-response: 3+ contact attempts with no reply
    // This applies to ALL invoices, not just high-value
    if (priorAttempts >= 3 && daysOverdue > 7) {
      // Check if there's been any response (no inbound since outbound started)
      // Use daysSinceLastContact as proxy - if we've contacted but no response pattern
      if (daysSinceLastContact !== null && daysSinceLastContact > 3) {
        return { shouldEscalate: true, trigger: 'repeated_non_response' };
      }
    }
    
    // >30 days overdue with no progress
    if (daysOverdue > 30 && !invoice.pauseState) {
      // No response despite contact attempts
      if (daysSinceLastContact !== null && daysSinceLastContact > 14) {
        return { shouldEscalate: true, trigger: 'overdue_30_plus_no_progress' };
      }
      // Or never contacted and still no payment (rare edge case)
      if (daysSinceLastContact === null && priorAttempts === 0) {
        return { shouldEscalate: true, trigger: 'overdue_30_plus_no_progress' };
      }
    }
    
    // High value with signs of avoidance
    if (isHighValue && daysOverdue > 14) {
      // Multiple attempts with extended non-response
      if (priorAttempts >= 2 && daysSinceLastContact !== null && daysSinceLastContact > 7) {
        return { shouldEscalate: true, trigger: 'high_value_avoidance' };
      }
    }
    
    // TODO: Check for pattern change (good payer now slipping)
    // This would require historical payment data comparison
    
    return { shouldEscalate: false, trigger: 'none' };
  }
  
  /**
   * Calculate cooldown period (don't contact more than once every X days)
   */
  private calculateCooldown(
    lastContactDate: Date | null,
    charlieState: CharlieInvoiceState
  ): Date | null {
    if (!lastContactDate) return null;
    
    // Shorter cooldown for escalated states
    let cooldownDays = 3;
    
    if (charlieState === 'ptp_missed') {
      cooldownDays = 1; // Can contact again quickly
    } else if (charlieState === 'final_demand') {
      cooldownDays = 7; // Formal stage, longer gaps
    } else if (charlieState === 'overdue') {
      cooldownDays = 3; // Standard collection cadence
    } else if (charlieState === 'due_soon' || charlieState === 'due') {
      cooldownDays = 5; // Early stage, lighter touch
    }
    
    const cooldownUntil = new Date(lastContactDate);
    cooldownUntil.setDate(cooldownUntil.getDate() + cooldownDays);
    
    return cooldownUntil;
  }
  
  /**
   * Calculate confidence in the decision
   */
  private calculateConfidence(
    invoice: typeof invoices.$inferSelect,
    contact: typeof contacts.$inferSelect,
    daysSinceLastContact: number | null
  ): number {
    let confidence = 0.8; // Base confidence
    
    // Reduce confidence for missing data
    if (!contact.email && !contact.phone) {
      confidence -= 0.3;
    }
    
    // Reduce confidence for very old debt (patterns may have changed)
    const daysOverdue = Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue > 90) {
      confidence -= 0.1;
    }
    
    // Increase confidence with recent contact history
    if (daysSinceLastContact !== null && daysSinceLastContact < 14) {
      confidence += 0.1;
    }
    
    return Math.max(0.3, Math.min(1, confidence));
  }
  
  /**
   * Determine if human review is needed (Section 12)
   */
  private needsHumanReview(
    invoice: typeof invoices.$inferSelect,
    contact: typeof contacts.$inferSelect,
    charlieState: CharlieInvoiceState,
    stateMetadata: typeof CHARLIE_STATES[CharlieInvoiceState],
    confidence: number
  ): boolean {
    // State requires approval
    if (stateMetadata.requiresHumanApproval) {
      return true;
    }
    
    // Low confidence
    if (confidence < 0.5) {
      return true;
    }
    
    // First contact on high value (>£10K)
    const amount = parseFloat(invoice.amount as string);
    if (amount >= 10000 && (!invoice.reminderCount || invoice.reminderCount === 0)) {
      return true;
    }
    
    // Vulnerable customer flag (check notes for vulnerability indicators)
    const notes = contact.notes?.toLowerCase() || '';
    if (notes.includes('vulnerable') || notes.includes('vulnerability')) {
      return true;
    }
    
    // VIP customer (check notes for VIP indicators)
    if (notes.includes('vip') || notes.includes('key account')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Sort decisions by priority
   */
  private sortByPriority(decisions: CharlieDecision[]): CharlieDecision[] {
    const tierOrder: Record<PriorityTier, number> = {
      'critical': 0,
      'high': 1,
      'medium': 2,
      'low': 3,
      'excluded': 4,
    };
    
    return decisions.sort((a, b) => {
      // First sort by tier
      const tierDiff = tierOrder[a.priorityTier] - tierOrder[b.priorityTier];
      if (tierDiff !== 0) return tierDiff;
      
      // Then by score within tier
      return b.priorityScore - a.priorityScore;
    });
  }
  
  /**
   * Select template from playbook based on state and channel
   */
  private selectTemplateFromPlaybook(
    charlieState: CharlieInvoiceState,
    channel: CharlieChannel,
    shouldEscalate: boolean
  ): { toneProfile: ToneProfile; voiceTone: VoiceTone; templateId: TemplateId | null } {
    // Determine tone based on state
    let toneProfile: ToneProfile;
    let voiceTone: VoiceTone;
    
    if (charlieState === 'debt_recovery' || charlieState === 'final_demand') {
      toneProfile = ToneProfile.RECOVERY_FORMAL_FIRM;
      voiceTone = VoiceTone.VOICE_TONE_FORMAL_RECOVERY;
    } else if (charlieState === 'ptp_missed' || shouldEscalate) {
      toneProfile = ToneProfile.CREDIT_CONTROL_FIRM;
      voiceTone = VoiceTone.VOICE_TONE_FIRM_COLLABORATIVE;
    } else {
      toneProfile = ToneProfile.CREDIT_CONTROL_FRIENDLY;
      voiceTone = VoiceTone.VOICE_TONE_CALM_COLLABORATIVE;
    }
    
    // Select template based on state and channel
    let templateId: TemplateId | null = null;
    
    if (channel === 'email') {
      if (charlieState === 'ptp_missed') {
        templateId = TemplateId.EMAIL_FIRM_REMINDER;
      } else if (charlieState === 'final_demand' || charlieState === 'debt_recovery') {
        templateId = TemplateId.RECOVERY_EMAIL_FORMAL_REMINDER;
      } else if (shouldEscalate) {
        templateId = TemplateId.EMAIL_FIRM_REMINDER;
      } else {
        templateId = TemplateId.EMAIL_FRIENDLY_REMINDER;
      }
    } else if (channel === 'sms') {
      if (charlieState === 'ptp_missed') {
        templateId = TemplateId.SMS_PTP_CHASE;
      } else if (shouldEscalate) {
        templateId = TemplateId.SMS_ESCALATED_REMINDER;
      } else {
        templateId = TemplateId.SMS_OVERDUE_REMINDER;
      }
    } else if (channel === 'voice') {
      if (charlieState === 'ptp_missed') {
        templateId = TemplateId.VOICE_PTP_CHASE;
      } else if (charlieState === 'final_demand' || charlieState === 'debt_recovery') {
        templateId = TemplateId.RECOVERY_VOICE_FORMAL_CALL;
      } else if (shouldEscalate) {
        templateId = TemplateId.VOICE_ESCALATED_REMINDER;
      } else {
        templateId = TemplateId.VOICE_PTP_REQUEST;
      }
    }
    
    return { toneProfile, voiceTone, templateId };
  }
  
  /**
   * Format currency for display
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  }
  
  /**
   * Get actionable decisions only (filter out excluded and those in cooldown)
   */
  async getActionableDecisions(tenantId: string, limit: number = 50): Promise<CharlieDecision[]> {
    const plan = await this.generateDailyPlan(tenantId);
    const now = new Date();
    
    return plan.decisions
      .filter(d => 
        d.priorityTier !== 'excluded' && 
        d.recommendedChannel !== 'none' &&
        (!d.cooldownUntil || d.cooldownUntil <= now)
      )
      .slice(0, limit);
  }
}

// Export singleton
export const charlieDecisionEngine = new CharlieDecisionEngine();
