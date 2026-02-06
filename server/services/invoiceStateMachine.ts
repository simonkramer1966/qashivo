import { db } from "../db";
import { invoices, actions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Charlie Invoice State Machine
 * 
 * 12-state model representing the lifecycle of a B2B invoice from issuance to resolution.
 * Based on Charlie Requirements document.
 * 
 * State Flow:
 * ISSUED → DELIVERED → DUE_SOON → DUE → OVERDUE → (branches to various outcomes)
 *   ↓ (any stage can branch to)
 *   ├── ADMIN_BLOCKED → (resolved) → back to previous workflow state
 *   ├── DISPUTED → (resolved) → back to previous workflow state  
 *   ├── PTP → PTP_MET (success) or PTP_MISSED (escalation)
 *   ├── FINAL_DEMAND → DEBT_RECOVERY (if unpaid)
 *   └── DEBT_RECOVERY (terminal - human-led)
 */

// Charlie's 12 invoice states
export type CharlieInvoiceState = 
  | 'issued'           // Invoice sent, awaiting acknowledgment
  | 'delivered'        // Customer confirmed receipt
  | 'due_soon'         // Pre-due reminder sent (optional for high-value/new customers)
  | 'due'              // Due date reached, first reminder
  | 'overdue'          // Past due, in soft chase cadence
  | 'admin_blocked'    // Missing PO, GRN, supplier setup, wrong address
  | 'disputed'         // Quality/delivery/price dispute raised
  | 'ptp'              // Promise to Pay - payment date committed
  | 'ptp_met'          // Payment received as promised
  | 'ptp_missed'       // PTP deadline passed without payment
  | 'final_demand'     // Final notice before legal action
  | 'debt_recovery';   // Passed to collections/solicitor (human-led)

// State metadata for each state
export interface StateMetadata {
  label: string;
  description: string;
  category: 'workflow' | 'blocker' | 'commitment' | 'escalation' | 'terminal';
  allowsAutomation: boolean;
  requiresHumanApproval: boolean;
  defaultNextAction?: string;
}

// State definitions with metadata
export const CHARLIE_STATES: Record<CharlieInvoiceState, StateMetadata> = {
  issued: {
    label: 'Issued',
    description: 'Invoice sent to customer',
    category: 'workflow',
    allowsAutomation: true,
    requiresHumanApproval: false,
    defaultNextAction: 'Confirm delivery'
  },
  delivered: {
    label: 'Delivered',
    description: 'Customer acknowledged receipt',
    category: 'workflow',
    allowsAutomation: true,
    requiresHumanApproval: false,
    defaultNextAction: 'Monitor for due date'
  },
  due_soon: {
    label: 'Due Soon',
    description: 'Pre-due reminder sent',
    category: 'workflow',
    allowsAutomation: true,
    requiresHumanApproval: false,
    defaultNextAction: 'Confirm payment scheduled'
  },
  due: {
    label: 'Due',
    description: 'Payment due date reached',
    category: 'workflow',
    allowsAutomation: true,
    requiresHumanApproval: false,
    defaultNextAction: 'Send first reminder'
  },
  overdue: {
    label: 'Overdue',
    description: 'Past due, in collection cadence',
    category: 'workflow',
    allowsAutomation: true,
    requiresHumanApproval: false,
    defaultNextAction: 'Follow up per cadence'
  },
  admin_blocked: {
    label: 'Admin Blocked',
    description: 'Blocked by missing PO, GRN, or admin issue',
    category: 'blocker',
    allowsAutomation: false,
    requiresHumanApproval: false,
    defaultNextAction: 'Resolve admin issue'
  },
  disputed: {
    label: 'Disputed',
    description: 'Customer raised a dispute',
    category: 'blocker',
    allowsAutomation: false,
    requiresHumanApproval: true,
    defaultNextAction: 'Review and resolve dispute'
  },
  ptp: {
    label: 'Promise to Pay',
    description: 'Customer committed to payment date',
    category: 'commitment',
    allowsAutomation: true,
    requiresHumanApproval: false,
    defaultNextAction: 'Monitor PTP deadline'
  },
  ptp_met: {
    label: 'PTP Met',
    description: 'Payment received as promised',
    category: 'terminal',
    allowsAutomation: false,
    requiresHumanApproval: false,
    defaultNextAction: 'None - resolved'
  },
  ptp_missed: {
    label: 'PTP Missed',
    description: 'Promise deadline passed without payment',
    category: 'escalation',
    allowsAutomation: true,
    requiresHumanApproval: false,
    defaultNextAction: 'Escalate - call or final demand'
  },
  final_demand: {
    label: 'Final Demand',
    description: 'Pre-action letter sent',
    category: 'escalation',
    allowsAutomation: false,
    requiresHumanApproval: true,
    defaultNextAction: 'Await response or proceed to debt recovery'
  },
  debt_recovery: {
    label: 'Debt Recovery',
    description: 'Passed to collections or legal',
    category: 'terminal',
    allowsAutomation: false,
    requiresHumanApproval: true,
    defaultNextAction: 'Human-led recovery process'
  }
};

// Valid state transitions
// Note: Time-based automation may skip intermediate states (e.g., issued → overdue when due date passes)
export const VALID_TRANSITIONS: Record<CharlieInvoiceState, CharlieInvoiceState[]> = {
  issued: ['delivered', 'due_soon', 'due', 'overdue', 'admin_blocked', 'disputed', 'ptp', 'ptp_met'],
  delivered: ['due_soon', 'due', 'overdue', 'admin_blocked', 'disputed', 'ptp', 'ptp_met'],
  due_soon: ['due', 'overdue', 'admin_blocked', 'disputed', 'ptp', 'ptp_met'],
  due: ['overdue', 'admin_blocked', 'disputed', 'ptp', 'ptp_met'],
  overdue: ['admin_blocked', 'disputed', 'ptp', 'final_demand', 'ptp_met'],
  admin_blocked: ['issued', 'delivered', 'due_soon', 'due', 'overdue', 'ptp', 'disputed', 'ptp_met'],
  disputed: ['overdue', 'ptp', 'final_demand', 'ptp_met'],
  ptp: ['ptp_met', 'ptp_missed', 'disputed'],
  ptp_met: [], // Terminal state - no further transitions
  ptp_missed: ['ptp', 'final_demand', 'debt_recovery', 'ptp_met'],
  final_demand: ['ptp', 'debt_recovery', 'ptp_met'],
  debt_recovery: ['ptp_met'] // Only if payment received during recovery
};

// Transition reason categories
export type TransitionReason = 
  | 'time_based'           // Due date passed, PTP deadline passed
  | 'customer_response'    // Customer replied, made promise, raised dispute
  | 'payment_received'     // Payment detected in Xero
  | 'admin_issue'          // Admin blocker identified or resolved
  | 'dispute_resolution'   // Dispute resolved
  | 'escalation'           // Escalated due to non-response or missed PTP
  | 'manual'               // User manually changed state
  | 'system';              // System automation

interface TransitionOptions {
  reason: TransitionReason;
  notes?: string;
  triggeredBy?: 'charlie' | 'user' | 'xero_sync' | 'webhook';
  metadata?: Record<string, any>;
  pauseUntil?: Date;      // For PTP or blockers
  pauseReason?: string;
}

/**
 * Invoice State Machine Service
 * Manages invoice lifecycle states with validation and audit trail
 */
class InvoiceStateMachine {
  
  /**
   * Compute the current Charlie state from invoice fields
   * Maps the existing schema fields to unified Charlie state
   * 
   * Priority order:
   * 1. Terminal states (paid, cancelled)
   * 2. Pause states (admin_blocked, disputed, ptp)
   * 3. Escalation flags (legal, debt recovery)
   * 4. Date-based workflow states (due_soon, due, overdue)
   * 5. Default states (delivered, issued)
   */
  computeState(invoice: typeof invoices.$inferSelect): CharlieInvoiceState {
    const now = new Date();
    const dueDate = invoice.dueDate;
    const daysToDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // 1. Check terminal states first
    if (invoice.status === 'paid') {
      return 'ptp_met';
    }
    
    if (invoice.status === 'cancelled' || invoice.workflowState === 'resolved') {
      return 'ptp_met';
    }
    
    // 2. Check pause states (blockers/commitments) - these take priority over workflow
    if (invoice.pauseState === 'admin_blocked' || (invoice.isOnHold && invoice.pauseReason)) {
      return 'admin_blocked';
    }
    
    if (invoice.pauseState === 'dispute') {
      return 'disputed';
    }
    
    if (invoice.pauseState === 'ptp' || invoice.pauseState === 'payment_plan') {
      // Check if PTP deadline passed
      if (invoice.pausedUntil && invoice.pausedUntil < now) {
        return 'ptp_missed';
      }
      return 'ptp';
    }
    
    // 3. Check escalation flags
    if (invoice.legalFlag || invoice.stage === 'enforcement') {
      return 'debt_recovery';
    }
    
    if (invoice.collectionStage === 'final_notice') {
      return 'final_demand';
    }
    
    if (invoice.escalationFlag || invoice.stage === 'debt_recovery') {
      return 'final_demand';
    }
    
    // 4. Date-based workflow states (primary source of truth for active invoices)
    // Check overdue first (most urgent)
    if (daysToDue < 0) {
      return 'overdue';
    }
    
    // Due date is today
    if (daysToDue === 0) {
      return 'due';
    }
    
    // Within 7 days of due date
    if (daysToDue <= 7) {
      return 'due_soon';
    }
    
    // 5. Default states for invoices with time remaining
    // Check if delivered/acknowledged via reminder count
    if (invoice.reminderCount && invoice.reminderCount > 0) {
      return 'delivered';
    }
    
    return 'issued';
  }
  
  /**
   * Validate if a transition is allowed
   */
  canTransition(fromState: CharlieInvoiceState, toState: CharlieInvoiceState): boolean {
    const allowedTransitions = VALID_TRANSITIONS[fromState];
    return allowedTransitions.includes(toState);
  }
  
  /**
   * Get allowed next states from current state
   */
  getAllowedTransitions(currentState: CharlieInvoiceState): CharlieInvoiceState[] {
    return VALID_TRANSITIONS[currentState];
  }
  
  /**
   * Transition an invoice to a new state
   * Updates invoice fields and logs the transition
   */
  async transition(
    invoiceId: string,
    tenantId: string,
    toState: CharlieInvoiceState,
    options: TransitionOptions
  ): Promise<{ success: boolean; error?: string; invoice?: typeof invoices.$inferSelect }> {
    try {
      // Get current invoice
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
        .limit(1);
      
      if (!invoice) {
        return { success: false, error: `Invoice ${invoiceId} not found` };
      }
      
      const fromState = this.computeState(invoice);
      
      // Validate transition
      if (!this.canTransition(fromState, toState)) {
        return { 
          success: false, 
          error: `Invalid transition from ${fromState} to ${toState}. Allowed: ${VALID_TRANSITIONS[fromState].join(', ')}` 
        };
      }
      
      // Prepare update based on target state
      const updates = this.buildStateUpdates(toState, options);
      
      // Update invoice
      const [updatedInvoice] = await db
        .update(invoices)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoiceId))
        .returning();
      
      // Log state transition
      await this.logTransition(invoiceId, tenantId, fromState, toState, options);
      
      console.log(`📊 Invoice ${invoiceId} transitioned: ${fromState} → ${toState} (${options.reason})`);
      
      if (toState === 'ptp_met') {
        import('./emailCommunications.js').then(({ sendPaymentThankYouEmail }) => {
          sendPaymentThankYouEmail(invoiceId, tenantId).catch(err =>
            console.error(`[ThankYou] Failed for invoice ${invoiceId}:`, err.message)
          );
        }).catch(err => console.error('[ThankYou] Import failed:', err.message));
      }
      
      return { success: true, invoice: updatedInvoice };
    } catch (error) {
      console.error('❌ State transition failed:', error);
      return { success: false, error: String(error) };
    }
  }
  
  /**
   * Build field updates based on target state
   */
  private buildStateUpdates(
    toState: CharlieInvoiceState, 
    options: TransitionOptions
  ): Partial<typeof invoices.$inferInsert> {
    const updates: Partial<typeof invoices.$inferInsert> = {};
    
    switch (toState) {
      case 'issued':
        updates.workflowState = 'pre_due';
        updates.pauseState = null;
        updates.isOnHold = false;
        break;
        
      case 'delivered':
        updates.workflowState = 'pre_due';
        updates.pauseState = null;
        break;
        
      case 'due_soon':
        updates.workflowState = 'pre_due';
        updates.collectionStage = 'initial';
        break;
        
      case 'due':
        updates.workflowState = 'due';
        updates.status = 'pending';
        break;
        
      case 'overdue':
        updates.workflowState = 'late';
        updates.status = 'overdue';
        updates.pauseState = null;
        break;
        
      case 'admin_blocked':
        updates.isOnHold = true;
        updates.pauseState = 'admin_blocked';
        updates.pausedAt = new Date();
        updates.pauseReason = options.pauseReason || 'Admin issue - awaiting resolution';
        updates.pauseMetadata = options.metadata || {};
        break;
        
      case 'disputed':
        updates.pauseState = 'dispute';
        updates.pausedAt = new Date();
        updates.pauseReason = options.pauseReason || 'Customer dispute';
        updates.pauseMetadata = options.metadata || {};
        break;
        
      case 'ptp':
        updates.pauseState = 'ptp';
        updates.pausedAt = new Date();
        updates.pausedUntil = options.pauseUntil || null;
        updates.pauseReason = options.pauseReason || 'Promise to pay received';
        updates.pauseMetadata = options.metadata || {};
        break;
        
      case 'ptp_met':
        updates.status = 'paid';
        updates.workflowState = 'resolved';
        updates.pauseState = null;
        updates.paidDate = new Date();
        break;
        
      case 'ptp_missed':
        updates.pauseState = null;
        updates.workflowState = 'late';
        updates.escalationFlag = true;
        break;
        
      case 'final_demand':
        updates.collectionStage = 'final_notice';
        updates.stage = 'debt_recovery';
        updates.escalationFlag = true;
        updates.pauseState = null;
        break;
        
      case 'debt_recovery':
        updates.stage = 'enforcement';
        updates.legalFlag = true;
        updates.collectionStage = 'escalated';
        break;
    }
    
    return updates;
  }
  
  /**
   * Log state transition for audit trail
   */
  private async logTransition(
    invoiceId: string,
    tenantId: string,
    fromState: CharlieInvoiceState,
    toState: CharlieInvoiceState,
    options: TransitionOptions
  ): Promise<void> {
    try {
      // Create an action record for the transition
      await db.insert(actions).values({
        tenantId,
        invoiceId,
        type: 'note',
        status: 'completed',
        subject: `State: ${CHARLIE_STATES[fromState].label} → ${CHARLIE_STATES[toState].label}`,
        content: `Invoice state changed from "${CHARLIE_STATES[fromState].label}" to "${CHARLIE_STATES[toState].label}".\n\nReason: ${options.reason}\n${options.notes ? `\nNotes: ${options.notes}` : ''}`,
        source: options.triggeredBy || 'charlie',
        aiGenerated: options.triggeredBy === 'charlie',
        metadata: {
          stateTransition: {
            fromState,
            toState,
            reason: options.reason,
            timestamp: new Date().toISOString(),
            ...options.metadata
          }
        }
      });
    } catch (error) {
      console.error('Failed to log state transition:', error);
    }
  }
  
  /**
   * Batch update invoices that need state changes based on time
   * Run this periodically (e.g., daily) to handle time-based transitions
   * 
   * This function:
   * - Updates invoice database fields to reflect current time-based state
   * - Detects PTP breaches and transitions to ptp_missed
   * - Logs all transitions for audit trail
   */
  async processTimeBasedTransitions(tenantId: string): Promise<{
    dueSoon: number;
    due: number;
    overdue: number;
    ptpMissed: number;
    errors: number;
  }> {
    const now = new Date();
    
    const results = {
      dueSoon: 0,
      due: 0,
      overdue: 0,
      ptpMissed: 0,
      errors: 0
    };
    
    // Get all active invoices for tenant (pending AND overdue status)
    // Exclude paid, cancelled, and resolved invoices
    const activeInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId));
    
    // Filter to active invoices only (not terminal states)
    const nonTerminalInvoices = activeInvoices.filter(inv => 
      inv.status !== 'paid' && 
      inv.status !== 'cancelled' && 
      inv.workflowState !== 'resolved'
    );
    
    for (const invoice of nonTerminalInvoices) {
      try {
        const currentState = this.computeState(invoice);
        const dueDate = invoice.dueDate;
        const daysToDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check for PTP missed (has pauseState='ptp' with passed deadline)
        if (invoice.pauseState === 'ptp' && invoice.pausedUntil && invoice.pausedUntil < now) {
          const result = await this.transition(invoice.id, tenantId, 'ptp_missed', {
            reason: 'time_based',
            notes: 'PTP deadline passed without payment',
            triggeredBy: 'charlie'
          });
          if (result.success) {
            results.ptpMissed++;
          } else {
            console.warn(`⚠️ PTP missed transition failed for ${invoice.id}: ${result.error}`);
            results.errors++;
          }
          continue;
        }
        
        // Skip if invoice is in a pause/blocker state (let those resolve first)
        if (currentState === 'admin_blocked' || currentState === 'disputed' || currentState === 'ptp') {
          continue;
        }
        
        // Skip terminal or escalation states
        if (currentState === 'ptp_met' || currentState === 'final_demand' || currentState === 'debt_recovery') {
          continue;
        }
        
        // Determine if database fields need updating based on date
        // Note: computeState() already determines the correct state from dates,
        // but we may need to update workflowState/status fields to persist the state
        
        if (daysToDue < 0 && currentState !== 'overdue') {
          // Should be overdue but database fields don't reflect it
          const result = await this.transition(invoice.id, tenantId, 'overdue', {
            reason: 'time_based',
            notes: `${Math.abs(daysToDue)} days overdue`,
            triggeredBy: 'charlie'
          });
          if (result.success) {
            results.overdue++;
          } else {
            console.warn(`⚠️ Overdue transition failed for ${invoice.id}: ${result.error}`);
            results.errors++;
          }
        } else if (daysToDue === 0 && invoice.workflowState !== 'due') {
          // Due today - update workflowState
          const result = await this.transition(invoice.id, tenantId, 'due', {
            reason: 'time_based',
            notes: 'Due date reached',
            triggeredBy: 'charlie'
          });
          if (result.success) {
            results.due++;
          } else {
            console.warn(`⚠️ Due transition failed for ${invoice.id}: ${result.error}`);
            results.errors++;
          }
        } else if (daysToDue > 0 && daysToDue <= 7 && invoice.collectionStage !== 'initial') {
          // Due soon - could optionally update collectionStage
          // This is more of an informational state, so we just count it
          results.dueSoon++;
        }
      } catch (error) {
        console.error(`❌ Error processing invoice ${invoice.id}:`, error);
        results.errors++;
      }
    }
    
    console.log(`⏰ Time-based transitions for tenant ${tenantId}:`, results);
    return results;
  }
  
  /**
   * Get state summary for a tenant's invoices
   */
  async getStateSummary(tenantId: string): Promise<Record<CharlieInvoiceState, number>> {
    const summary: Record<CharlieInvoiceState, number> = {
      issued: 0,
      delivered: 0,
      due_soon: 0,
      due: 0,
      overdue: 0,
      admin_blocked: 0,
      disputed: 0,
      ptp: 0,
      ptp_met: 0,
      ptp_missed: 0,
      final_demand: 0,
      debt_recovery: 0
    };
    
    const allInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId));
    
    for (const invoice of allInvoices) {
      const state = this.computeState(invoice);
      summary[state]++;
    }
    
    return summary;
  }
  
  /**
   * Get all invoices in a specific state
   */
  async getInvoicesInState(
    tenantId: string, 
    state: CharlieInvoiceState
  ): Promise<Array<typeof invoices.$inferSelect>> {
    const allInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId));
    
    return allInvoices.filter(inv => this.computeState(inv) === state);
  }
  
  /**
   * Mark invoice as paid (helper for Xero sync)
   */
  async markAsPaid(
    invoiceId: string,
    tenantId: string,
    paymentDate?: Date
  ): Promise<{ success: boolean; error?: string }> {
    return this.transition(invoiceId, tenantId, 'ptp_met', {
      reason: 'payment_received',
      notes: `Payment received${paymentDate ? ` on ${paymentDate.toLocaleDateString()}` : ''}`,
      triggeredBy: 'xero_sync'
    });
  }
  
  /**
   * Record a PTP (Promise to Pay)
   */
  async recordPTP(
    invoiceId: string,
    tenantId: string,
    promisedDate: Date,
    promisedAmount?: number,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.transition(invoiceId, tenantId, 'ptp', {
      reason: 'customer_response',
      notes: notes || `Payment promised by ${promisedDate.toLocaleDateString()}`,
      pauseUntil: promisedDate,
      metadata: {
        promisedDate: promisedDate.toISOString(),
        promisedAmount
      },
      triggeredBy: 'charlie'
    });
  }
  
  /**
   * Flag invoice as disputed
   */
  async flagAsDisputed(
    invoiceId: string,
    tenantId: string,
    disputeReason: string,
    disputeDetails?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    return this.transition(invoiceId, tenantId, 'disputed', {
      reason: 'customer_response',
      pauseReason: disputeReason,
      notes: `Customer raised dispute: ${disputeReason}`,
      metadata: disputeDetails,
      triggeredBy: 'charlie'
    });
  }
  
  /**
   * Flag invoice as admin blocked
   */
  async flagAsAdminBlocked(
    invoiceId: string,
    tenantId: string,
    blockReason: string,
    blockDetails?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    return this.transition(invoiceId, tenantId, 'admin_blocked', {
      reason: 'admin_issue',
      pauseReason: blockReason,
      notes: `Admin blocker: ${blockReason}`,
      metadata: blockDetails,
      triggeredBy: 'charlie'
    });
  }
}

// Export singleton instance
export const invoiceStateMachine = new InvoiceStateMachine();
