import { eq, and, lte, sql, isNotNull, inArray } from "drizzle-orm";
import { db } from "../db";
import { actions, contacts, invoices, tenants, messageDrafts, emailMessages, timelineEvents, customerBehaviorSignals, debtorGroups } from "@shared/schema";
import { fitDistribution, estimatePaymentProbability } from "./paymentDistribution";
import { sendEmail } from "./sendgrid";
import { sendSMS } from "./vonage";
// RetellService import removed — voice calls now go through sendVoiceCall() wrapper
import { websocketService } from "./websocketService";
import { aiMessageGenerator, type MessageContext, type ToneSettings } from "./aiMessageGenerator";
import { CircuitOpenError } from "./llmCircuitBreaker";
import { ToneProfile, PlaybookStage } from "./playbookEngine";
import { messagePreGenerator } from "./messagePreGenerator";
import { resolvePrimaryEmail, resolvePrimarySmsNumber } from "./contactEmailResolver";
import { buildConversationBrief } from "./conversationBriefService";
import { generateReplyToEmail, findOrCreateConversation, updateConversationStats } from "./emailCommunications";
import { approveAndSendReply } from "./inboundReplyPipeline";
import { CONVERSATION_TYPE } from "@shared/types/actionMetadata";
import { transitionState } from "./conversationStateService";
import { v4 as uuidv4 } from "uuid";

/**
 * Action Executor Service
 * Phase 2 of two-phase scheduling:
 * - Runs every 5-15 minutes
 * - Finds actions with scheduledFor <= NOW() AND approved
 * - Executes them (email/SMS/WhatsApp/voice)
 * - Updates status to completed/failed
 * 
 * Week 1 Enhancement: Only executes actions that have been approved
 * via the daily plan approval workflow (status='scheduled' AND approvedBy set)
 */
export class ActionExecutor {
  private isRunning: boolean = false;

  /**
   * Execute all pending scheduled actions
   */
  async executeScheduledActions(): Promise<void> {
    if (this.isRunning) {
      console.log("⏭️  Action Executor already running, skipping...");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const now = new Date();
      console.log(`⚡ Action Executor: Checking for scheduled actions at ${now.toISOString()}`);

      // Find all actions scheduled for now or earlier
      // Week 1: Only execute approved actions (status='scheduled' AND approvedBy is set)
      const scheduledActions = await db
        .select({
          action: actions,
          contact: contacts,
          invoice: invoices,
          tenant: tenants,
        })
        .from(actions)
        .innerJoin(contacts, eq(actions.contactId, contacts.id))
        .leftJoin(invoices, eq(actions.invoiceId, invoices.id))
        .innerJoin(tenants, eq(actions.tenantId, tenants.id))
        .where(
          and(
            eq(actions.status, 'scheduled'),
            lte(actions.scheduledFor, now),
            isNotNull(actions.approvedBy) // Only execute approved actions
          )
        )
        .limit(50); // Process max 50 actions per run

      if (scheduledActions.length === 0) {
        console.log("✅ Action Executor: No scheduled actions to execute");
        return;
      }

      console.log(`🚀 Action Executor: Found ${scheduledActions.length} actions to execute`);

      let successCount = 0;
      let errorCount = 0;

      for (const record of scheduledActions) {
        const { action, contact, invoice, tenant } = record;

        try {
          // Gap 4: Execution-time re-validation gate
          const validation = await this.validateActionBeforeExecution(action, contact, tenant);
          if (!validation.valid) {
            await db.update(actions).set({
              status: 'cancelled',
              cancellationReason: validation.reason,
              updatedAt: new Date(),
            }).where(eq(actions.id, action.id));
            console.log(`[Executor] Action ${action.id} cancelled: ${validation.reason}`);
            continue;
          }

          // Compliance gate — ALL outbound must pass compliance before delivery
          const complianceOutcome = await this.runComplianceGate(action);
          if (complianceOutcome === 'blocked' || complianceOutcome === 'queued') {
            if (complianceOutcome === 'blocked') errorCount++;
            continue;
          }

          // Update status to executing
          await db
            .update(actions)
            .set({ status: 'executing' })
            .where(eq(actions.id, action.id));

          // Execute based on action type
          const result = await this.executeAction(action, contact, invoice, tenant);

          if (result.success) {
            // TODO: When outcomes arrive (payment, response, bounce),
            // update decisionAuditLog.outcomeType/outcomeAt/daysToOutcome
            // via the action's decisionEvaluationId
            await db
              .update(actions)
              .set({
                status: 'completed',
                completedAt: new Date(),
                metadata: {
                  ...(action.metadata || {}),
                  executionResult: result.data,
                }
              })
              .where(eq(actions.id, action.id));
            successCount++;
            console.log(`✅ Executed ${action.type} action for ${contact.name}`);

            // Create timeline event for Activity Feed
            // Voice calls: timeline event created by Retell webhook (outcome-based, not initiation-based)
            if (action.type !== 'voice' && action.type !== 'call') {
              await this.createOutboundTimelineEvent(action, contact, invoice, result.data);
            }

            // Conversation state transition (non-fatal)
            if (action.contactId) {
              const convTrigger = (action.metadata as any)?.conversationType === CONVERSATION_TYPE.REPLY ? 'reply_sent' : 'chase_sent';
              await transitionState(action.tenantId, action.contactId, convTrigger as any, {
                eventId: action.id, eventType: 'action',
              }).catch(err => console.warn('[State] post-send transition failed:', err));
            }

            // Gap 10: Set legal response window if this was a Legal tone action
            await setLegalResponseWindowIfNeeded(action.id, action.contactId, action.tenantId, action.agentToneLevel);

            // Broadcast real-time update to connected clients
            websocketService.broadcastActionCompleted(action.tenantId, action.id, action.type);
            const { emitTenantEvent } = await import("./realtimeEvents");
            emitTenantEvent(action.tenantId, 'action_completed', {
              actionId: action.id, type: action.type, contactId: action.contactId,
            });
          } else {
            await db
              .update(actions)
              .set({
                status: 'failed',
                metadata: {
                  ...(action.metadata || {}),
                  executionError: result.error,
                }
              })
              .where(eq(actions.id, action.id));
            errorCount++;
            console.error(`❌ Failed ${action.type} action for ${contact.name}: ${result.error}`);
          }
        } catch (error: any) {
          // Gap 9: Circuit open — leave action queued for retry on next executor run
          if (error instanceof CircuitOpenError) {
            await db.update(actions).set({ status: 'scheduled' }).where(eq(actions.id, action.id));
            console.log(`[CircuitBreaker] Skipping action ${action.id} — circuit open, will retry`);
            continue;
          }

          await db
            .update(actions)
            .set({
              status: 'failed',
              metadata: {
                ...(action.metadata || {}),
                executionError: error.message,
              }
            })
            .where(eq(actions.id, action.id));
          errorCount++;
          console.error(`❌ Error executing action ${action.id}:`, error.message);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Action Executor: Completed in ${duration}ms - ${successCount} successful, ${errorCount} failed`);

    } catch (error: any) {
      console.error("❌ Action Executor error:", error);
    } finally {
      this.isRunning = false;
    }
  }

  async executeActionsByIds(actionIds: number[], approvedBy: string): Promise<{ successCount: number; errorCount: number }> {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    try {
      console.log(`⚡ Immediate Executor: Executing ${actionIds.length} actions now`);

      await db.update(actions)
        .set({
          status: 'scheduled',
          scheduledFor: new Date(),
          approvedBy,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(actions.id, actionIds));

      const actionRecords = await db
        .select({
          action: actions,
          contact: contacts,
          invoice: invoices,
          tenant: tenants,
        })
        .from(actions)
        .innerJoin(contacts, eq(actions.contactId, contacts.id))
        .leftJoin(invoices, eq(actions.invoiceId, invoices.id))
        .innerJoin(tenants, eq(actions.tenantId, tenants.id))
        .where(inArray(actions.id, actionIds));

      for (const record of actionRecords) {
        const { action, contact, invoice, tenant } = record;

        try {
          // Gap 4: Execution-time re-validation gate
          const validation = await this.validateActionBeforeExecution(action, contact, tenant);
          if (!validation.valid) {
            await db.update(actions).set({
              status: 'cancelled',
              cancellationReason: validation.reason,
              updatedAt: new Date(),
            }).where(eq(actions.id, action.id));
            console.log(`[Executor] Action ${action.id} cancelled at execution: ${validation.reason}`);
            continue;
          }

          // Compliance gate — ALL outbound must pass compliance before delivery
          const complianceOutcome = await this.runComplianceGate(action);
          if (complianceOutcome === 'blocked' || complianceOutcome === 'queued') {
            if (complianceOutcome === 'blocked') errorCount++;
            continue;
          }

          await db.update(actions)
            .set({ status: 'executing' })
            .where(eq(actions.id, action.id));

          const result = await this.executeAction(action, contact, invoice, tenant);

          if (result.success) {
            await db.update(actions)
              .set({
                status: 'completed',
                completedAt: new Date(),
                metadata: { ...(action.metadata || {}), executionResult: result.data },
              })
              .where(eq(actions.id, action.id));
            successCount++;
            console.log(`✅ Immediately executed ${action.type} action for ${contact.name}`);

            // Create timeline event for Activity Feed
            // Voice calls: timeline event created by Retell webhook (outcome-based, not initiation-based)
            if (action.type !== 'voice' && action.type !== 'call') {
              await this.createOutboundTimelineEvent(action, contact, invoice, result.data);
            }

            // Conversation state transition (non-fatal)
            if (action.contactId) {
              const convTrigger2 = (action.metadata as any)?.conversationType === CONVERSATION_TYPE.REPLY ? 'reply_sent' : 'chase_sent';
              await transitionState(action.tenantId, action.contactId, convTrigger2 as any, {
                eventId: action.id, eventType: 'action',
              }).catch(err => console.warn('[State] post-send transition failed:', err));
            }

            // Gap 10: Set legal response window if this was a Legal tone action
            await setLegalResponseWindowIfNeeded(action.id, action.contactId, action.tenantId, action.agentToneLevel);

            websocketService.broadcastActionCompleted(action.tenantId, action.id, action.type);
            const { emitTenantEvent } = await import("./realtimeEvents");
            emitTenantEvent(action.tenantId, 'action_completed', {
              actionId: action.id, type: action.type, contactId: action.contactId,
            });
          } else {
            await db.update(actions)
              .set({
                status: 'failed',
                metadata: { ...(action.metadata || {}), executionError: result.error },
              })
              .where(eq(actions.id, action.id));
            errorCount++;
            console.error(`❌ Failed ${action.type} action for ${contact.name}: ${result.error}`);
          }
        } catch (error: any) {
          // Gap 9: Circuit open — leave action queued for retry
          if (error instanceof CircuitOpenError) {
            await db.update(actions).set({ status: 'scheduled' }).where(eq(actions.id, action.id));
            console.log(`[CircuitBreaker] Skipping action ${action.id} — circuit open, will retry`);
            continue;
          }

          await db.update(actions)
            .set({
              status: 'failed',
              metadata: { ...(action.metadata || {}), executionError: error.message },
            })
            .where(eq(actions.id, action.id));
          errorCount++;
          console.error(`❌ Error executing action ${action.id}:`, error.message);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Immediate Executor: Completed in ${duration}ms - ${successCount} successful, ${errorCount} failed`);
    } catch (error: any) {
      console.error("❌ Immediate Executor error:", error);
    }

    return { successCount, errorCount };
  }

  /**
   * Gap 4: Validate action is still valid before execution.
   * Checks legal response windows, probable payments, invoice status changes,
   * and minimum chase threshold. Cancels stale actions instead of sending
   * outdated content.
   */
  private async validateActionBeforeExecution(
    action: any,
    contact: any,
    tenant: any
  ): Promise<{ valid: boolean; reason?: string }> {
    // 1. Legal response window — do not contact during statutory response period
    // Gap 10: Block both active windows AND expired-but-unresolved windows
    if (contact.legalResponseWindowEnd) {
      const windowEnd = new Date(contact.legalResponseWindowEnd);
      if (windowEnd > new Date()) {
        return { valid: false, reason: 'legal_response_window_active' };
      } else {
        // Window expired but user hasn't resolved — block until explicit decision
        return { valid: false, reason: 'legal_response_window_expired_pending_resolution' };
      }
    }

    // 2. Probable payment detected — hold off if medium/high confidence
    if (contact.probablePaymentDetected &&
        ['high', 'medium'].includes(contact.probablePaymentConfidence)) {
      return { valid: false, reason: 'probable_payment_detected' };
    }

    // 3. P(Pay) defensive check — if debtor has statistically likely paid by now, flag for review
    // Gap 14 Phase 1 Approach 1: works without bank transaction matching
    if (contact.id) {
      try {
        const [signals] = await db
          .select({
            medianDaysToPay: customerBehaviorSignals.medianDaysToPay,
            p75DaysToPay: customerBehaviorSignals.p75DaysToPay,
            volatility: customerBehaviorSignals.volatility,
            trend: customerBehaviorSignals.trend,
          })
          .from(customerBehaviorSignals)
          .where(
            and(
              eq(customerBehaviorSignals.contactId, contact.id),
              eq(customerBehaviorSignals.tenantId, action.tenantId),
            ),
          )
          .limit(1);

        if (signals?.medianDaysToPay) {
          const params = fitDistribution(
            parseFloat(String(signals.medianDaysToPay)),
            signals.p75DaysToPay ? parseFloat(String(signals.p75DaysToPay)) : null,
            signals.volatility ? parseFloat(String(signals.volatility)) : null,
            signals.trend ? parseFloat(String(signals.trend)) : null,
          );
          // Calculate how many days the oldest invoice is overdue
          const oldestDaysOverdue = action.metadata?.daysOverdue || 0;
          if (oldestDaysOverdue > 0) {
            // Probability debtor has already paid (CDF at current day)
            const pAlreadyPaid = estimatePaymentProbability(oldestDaysOverdue, 0, params);
            // If > 60%, they've statistically likely paid — flag for human review
            if (pAlreadyPaid > 0.60) {
              return {
                valid: false,
                reason: `ppay_likely_paid_${Math.round(pAlreadyPaid * 100)}pct`,
              };
            }
          }
        }
      } catch {
        // Non-fatal: if P(Pay) check fails, proceed with action
      }
    }

    // 4. Invoice-level checks — fresh DB read to catch changes since planning
    const actionInvoiceIds: string[] = action.invoiceIds?.length
      ? action.invoiceIds
      : (action.invoiceId ? [action.invoiceId] : []);

    if (actionInvoiceIds.length === 0) {
      // No invoices tied to this action (shouldn't happen, but safe to proceed)
      return { valid: true };
    }

    const freshInvoices = await db
      .select()
      .from(invoices)
      .where(inArray(invoices.id, actionInvoiceIds));

    const excludedStatuses = ['paid', 'void', 'voided', 'deleted'];
    const validInvoices = freshInvoices.filter(inv => {
      if (excludedStatuses.includes(inv.status || '')) return false;
      if (inv.pauseState) return false; // dispute, ptp, payment_plan
      if (inv.isOnHold) return false;
      return true;
    });

    // 5. All invoices excluded
    if (validInvoices.length === 0) {
      return { valid: false, reason: 'all_invoices_excluded' };
    }

    // 6. Any invoices removed from bundle — cancel for replan (LLM content may reference removed invoices)
    if (validInvoices.length < actionInvoiceIds.length) {
      return { valid: false, reason: 'bundle_modified_requires_replan' };
    }

    // Note: small-balance threshold is enforced at planning time only.
    // User-approved actions always send, regardless of the current total.

    return { valid: true };
  }

  /**
   * Compliance gate — runs the compliance engine on outbound actions before delivery.
   * Returns 'pass' | 'blocked' | 'queued'. Handles DB updates and timeline logging.
   *
   * This is a SAFETY-CRITICAL check. Without it, the executor path would deliver
   * emails/SMS without frequency caps, time-of-day checks, prohibited language
   * checks, or data isolation checks.
   */
  private async runComplianceGate(action: any): Promise<'pass' | 'blocked' | 'queued'> {
    // Only check content-bearing channels (email, sms). Voice is a live call — no content to check.
    if (action.type !== 'email' && action.type !== 'sms') {
      return 'pass';
    }

    // Actions need content to check — if no content yet, pass through (content will be generated later)
    if (!action.content && !action.subject) {
      return 'pass';
    }

    try {
      const { checkCompliance } = await import('./compliance/complianceEngine');
      const compliance = await checkCompliance({
        tenantId: action.tenantId,
        contactId: action.contactId,
        actionId: action.id,
        emailSubject: action.subject || '',
        emailBody: action.content || '',
        toneLevel: action.agentToneLevel || 'professional',
        agentReasoning: (action.metadata as any)?.agentReasoning,
      });

      if (compliance.action === 'send') {
        return 'pass';
      }

      if (compliance.action === 'block' || compliance.action === 'regenerate') {
        // Block the action — set status to failed with compliance reason
        await db.update(actions).set({
          status: 'failed',
          cancellationReason: `compliance_blocked: ${compliance.violations.join('; ')}`,
          metadata: {
            ...(action.metadata || {}),
            complianceBlocked: true,
            complianceViolations: compliance.violations,
          },
          updatedAt: new Date(),
        }).where(eq(actions.id, action.id));

        // Log timeline event
        try {
          await db.insert(timelineEvents).values({
            tenantId: action.tenantId,
            customerId: action.contactId,
            occurredAt: new Date(),
            direction: 'system',
            channel: 'system',
            summary: `Compliance blocked ${action.type}: ${compliance.violations.join('; ')}`,
            status: 'failed',
            createdByType: 'system',
            actionId: action.id,
          });
        } catch (err) {
          console.warn(`[Executor] Failed to log compliance timeline event:`, err);
        }

        console.log(`🚫 [Executor] Compliance BLOCKED action ${action.id}: ${compliance.violations.join('; ')}`);
        return 'blocked';
      }

      if (compliance.action === 'queue_for_approval') {
        // Send back to approval queue for human review
        await db.update(actions).set({
          status: 'pending_approval',
          metadata: {
            ...(action.metadata || {}),
            complianceQueued: true,
            complianceViolations: compliance.violations,
          },
          updatedAt: new Date(),
        }).where(eq(actions.id, action.id));

        console.log(`⚠️  [Executor] Compliance QUEUED action ${action.id} for approval: ${compliance.violations.join('; ')}`);
        return 'queued';
      }

      return 'pass';
    } catch (err: any) {
      // Fail closed — if compliance engine errors, do not send
      console.error(`[Executor] Compliance engine error for action ${action.id}:`, err.message);
      await db.update(actions).set({
        status: 'failed',
        cancellationReason: `compliance_error: ${err.message}`,
        updatedAt: new Date(),
      }).where(eq(actions.id, action.id));
      return 'blocked';
    }
  }

  /**
   * Execute a single action based on its type
   */
  private async executeAction(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Check communication mode
    if (tenant.communicationMode === 'off') {
      return {
        success: false,
        error: 'Communication mode is OFF for this tenant'
      };
    }

    // In testing mode, redirect to test addresses instead of real debtor
    if (tenant.communicationMode === 'testing') {
      const testEmails = tenant.testEmails as string[] | null;
      const testPhones = tenant.testPhones as string[] | null;

      if (!testEmails?.length && !testPhones?.length) {
        console.log(`🧪 TEST MODE: No test addresses configured — skipping ${action.type} to ${contact.name}`);
        return {
          success: true,
          data: { mode: 'testing', message: 'No test addresses configured, skipping send' }
        };
      }

      // Clone contact with test addresses so the real send methods are used
      // but deliver to test recipients instead
      const testContact = {
        ...contact,
        _originalEmail: contact.email,
        _originalPhone: contact.phone,
        _originalName: contact.name,
        email: testEmails?.[0] || contact.email,
        phone: testPhones?.[0] || contact.phone,
      };

      console.log(`🧪 TEST MODE: Redirecting ${action.type} for ${contact.name} → test addresses`);

      switch (action.type) {
        case 'email':
          return await this.sendEmailAction(action, testContact, invoice, tenant);
        case 'sms':
          return await this.sendSMSAction(action, testContact, invoice, tenant);
        case 'whatsapp':
          return await this.sendWhatsAppAction(action, testContact, invoice, tenant);
        case 'voice':
        case 'call':
          return await this.initiateVoiceCall(action, testContact, invoice, tenant);
        default:
          return { success: false, error: `Unknown action type: ${action.type}` };
      }
    }

    // Execute based on action type
    switch (action.type) {
      case 'email':
        return await this.sendEmailAction(action, contact, invoice, tenant);
      
      case 'sms':
        return await this.sendSMSAction(action, contact, invoice, tenant);
      
      case 'whatsapp':
        return await this.sendWhatsAppAction(action, contact, invoice, tenant);
      
      case 'voice':
      case 'call':
        return await this.initiateVoiceCall(action, contact, invoice, tenant);
      
      default:
        return { 
          success: false, 
          error: `Unknown action type: ${action.type}` 
        };
    }
  }

  /**
   * Build message context from action data
   */
  private async buildMessageContext(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<MessageContext> {
    const daysOverdue = invoice?.dueDate
      ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      : action.metadata?.daysOverdue || 0;

    // Build conversation brief for full debtor context. Pass chase context
    // (the bundled invoices) so the brief tells the LLM to demand the
    // bundled total, not the relationship-wide total.
    let conversationBrief: string | undefined;
    try {
      if (contact.id && action.tenantId) {
        const actionInvoiceIds: string[] = Array.isArray(action.invoiceIds) && action.invoiceIds.length > 0
          ? action.invoiceIds
          : (action.invoiceId ? [action.invoiceId] : []);
        let chaseContext: { chaseAmount: number; chaseInvoiceCount: number } | undefined;
        if (actionInvoiceIds.length > 0) {
          const bundleRows = await db
            .select({ amount: invoices.amount, amountPaid: invoices.amountPaid })
            .from(invoices)
            .where(inArray(invoices.id, actionInvoiceIds));
          const chaseAmount = bundleRows.reduce(
            (sum, inv) => sum + (Number(inv.amount || 0) - Number(inv.amountPaid || 0)),
            0,
          );
          chaseContext = { chaseAmount, chaseInvoiceCount: bundleRows.length };
        }
        const brief = await buildConversationBrief(action.tenantId, contact.id, chaseContext);
        conversationBrief = brief.text;
      }
    } catch (err) {
      console.warn(`⚠️ Failed to build conversation brief for ${contact.name}:`, err);
      // Non-fatal — continue without brief
    }

    const ctx: MessageContext = {
      customerName: contact.name || 'Customer',
      companyName: contact.companyName || contact.name,
      invoiceNumber: invoice?.invoiceNumber || action.metadata?.invoiceNumber || 'N/A',
      invoiceAmount: this.parseAmount(invoice?.amount ?? action.metadata?.amount ?? 0),
      currency: '£',
      dueDate: invoice?.dueDate ? new Date(invoice.dueDate) : new Date(),
      daysOverdue,
      totalOutstanding: action.metadata?.totalOutstanding,
      invoiceCount: action.metadata?.invoiceCount,
      previousContactCount: action.metadata?.previousContactCount,
      lastContactDate: action.metadata?.lastContactDate ? new Date(action.metadata.lastContactDate) : undefined,
      lastContactChannel: action.metadata?.lastContactChannel,
      hasPromiseToPay: action.metadata?.hasPromiseToPay,
      promiseToPayDate: action.metadata?.promiseToPayDate ? new Date(action.metadata.promiseToPayDate) : undefined,
      promiseToPayMissed: action.metadata?.promiseToPayMissed,
      isHighValue: action.metadata?.isHighValue,
      isVip: action.metadata?.isVip,
      hasDispute: action.metadata?.hasDispute,
      tenantName: tenant.name || 'Accounts Team',
      tenantPhone: tenant.phone,
      tenantEmail: tenant.email,
      conversationBrief,
    };

    // Enrich with group context for consolidated group actions
    const actionMeta = (action.metadata ?? {}) as Record<string, any>;
    if (actionMeta.isGroupAction) {
      (ctx as any).isGroupAction = true;
      (ctx as any).groupName = actionMeta.groupName;
      (ctx as any).groupMemberCount = actionMeta.memberCompanyNames?.length ?? 0;
      (ctx as any).groupMemberCompanyNames = actionMeta.memberCompanyNames ?? [];
    }

    return ctx;
  }

  /**
   * Build tone settings from action metadata
   */
  private buildToneSettings(action: any): ToneSettings {
    return {
      stage: (action.metadata?.stage || 'CREDIT_CONTROL') as PlaybookStage,
      toneProfile: (action.metadata?.toneProfile || 'CREDIT_CONTROL_FRIENDLY') as ToneProfile,
      reasonCode: action.metadata?.reasonCode,
      templateId: action.metadata?.templateId,
      tenantStyle: action.metadata?.tenantStyle,
      useLatePaymentLegislation: action.metadata?.useLatePaymentLegislation,
    };
  }

  /**
   * Send email action with pre-generated or AI-generated content
   */
  private async sendEmailAction(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Conversation replies must go through the threaded delivery path so
      // In-Reply-To/References headers are attached and the debtor sees a
      // proper thread, not a fresh email.
      const meta = (action.metadata ?? {}) as { conversationType?: string };
      if (meta.conversationType === CONVERSATION_TYPE.REPLY) {
        const replyResult = await approveAndSendReply(action.id, null);
        if (replyResult.status === "sent") {
          return { success: true, data: { mode: "conversation_reply" } };
        }
        return { success: false, error: replyResult.error || `reply status: ${replyResult.status}` };
      }

      let recipientEmail = await resolvePrimaryEmail(contact.id, action.tenantId, contact.email, contact.arContactEmail);

      // Group action: override recipient email if the group has a primaryEmail set
      const groupMeta = (action.metadata ?? {}) as Record<string, any>;
      if (groupMeta.isGroupAction && groupMeta.groupId) {
        const [group] = await db
          .select({ primaryEmail: debtorGroups.primaryEmail })
          .from(debtorGroups)
          .where(eq(debtorGroups.id, groupMeta.groupId))
          .limit(1);
        if (group?.primaryEmail) {
          recipientEmail = group.primaryEmail;
        }
      }

      if (!recipientEmail) {
        return { success: false, error: 'Contact has no email address' };
      }

      const messageContext = await this.buildMessageContext(action, contact, invoice, tenant);
      const toneSettings = this.buildToneSettings(action);

      let emailContent: { subject: string; body: string };
      let usedPreGenerated = false;

      if (action.content && action.content.trim() !== '') {
        emailContent = {
          subject: action.subject || 'Payment Reminder',
          body: this.replaceTemplateVariables(action.content, contact, invoice)
        };
      } else {
        const { draft, contextChanged } = await messagePreGenerator.getDraftForAction(
          action.id,
          'email',
          messageContext,
          toneSettings
        );

        if (draft && draft.body) {
          console.log(`⚡ Using pre-generated email for ${contact.name}`);
          emailContent = {
            subject: draft.subject || 'Payment Reminder',
            body: draft.body
          };
          usedPreGenerated = true;
        } else {
          console.log(`🤖 Generating debtor email via debtorEmailService for ${contact.name}${contextChanged ? ' (context changed)' : ''}...`);
          const { generateDebtorEmail } = await import("./debtorEmailService");

          const invoiceIds: string[] | undefined =
            Array.isArray(action.invoiceIds) && action.invoiceIds.length > 0
              ? action.invoiceIds
              : (action.invoiceId ? [action.invoiceId] : undefined);

          const generated = await generateDebtorEmail({
            tenantId: action.tenantId,
            contactId: contact.id,
            emailType: (action.touchCount ?? 0) > 1 ? 'follow_up' : 'first_chase',
            invoiceIds,
            toneLevel: (action.agentToneLevel as
              | 'friendly' | 'professional' | 'firm' | 'formal' | 'legal'
            ) || 'professional',
            sequencePosition: action.touchCount ?? undefined,
            currency: contact.preferredCurrency || undefined,
            // Pass group context for consolidated group actions
            groupContext: groupMeta.isGroupAction ? {
              groupId: groupMeta.groupId,
              groupName: groupMeta.groupName,
              memberContactIds: groupMeta.memberContactIds ?? [],
              memberCompanyNames: groupMeta.memberCompanyNames ?? [],
            } : undefined,
          });

          emailContent = {
            subject: generated.subject || 'Payment Reminder',
            body: generated.body,
          };

          // Mark the action as LLM-generated by debtorEmailService for audit.
          await db.update(actions)
            .set({ generationMethod: 'llm' })
            .where(eq(actions.id, action.id));

          console.log(`✅ debtorEmailService email generated with subject: ${emailContent.subject}`);
        }
      }

      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'cc@qashivo.com';
      const fromName = tenant.name ? `${tenant.name} via Qashivo` : 'Qashivo Credit Control';

      // Convert LLM plain text to proper HTML email with tenant footer
      const { formatEmailHtml, buildEmailFooter, buildEmailFooterText } = await import('./emailFormatter');
      const footerHtml = buildEmailFooter(tenant.name || 'Our company', tenant.emailFooterText);
      const htmlBody = formatEmailHtml(emailContent.body, footerHtml);
      const textBody = emailContent.body + buildEmailFooterText(tenant.name || 'Our company', tenant.emailFooterText);

      // Testing mode: prefix subject and add original recipient note
      const isTestMode = !!(contact as any)._originalEmail;
      const originalEmail = (contact as any)._originalEmail;
      let finalHtml = htmlBody;
      if (isTestMode) {
        emailContent.subject = `[TEST] ${emailContent.subject}`;
        const testBanner = `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#92400e;"><strong>TEST MODE</strong> — Original recipient: ${originalEmail} (${(contact as any)._originalName || 'Unknown'})</div>`;
        finalHtml = testBanner + finalHtml;
      }

      // Reply-To wiring — pre-generate the emailMessages id and a signed
      // reply token so debtor replies route into the inbound parse webhook
      // (reply+TOKEN@in.qashivo.com → /api/webhooks/sendgrid/inbound).
      // Without this, replies bounce back to the from address and never
      // reach Qashivo's inbound pipeline. Same pattern as collectionsPipeline.
      const conversationId = await findOrCreateConversation(action.tenantId, contact.id, emailContent.subject);
      const emailMessageId = uuidv4();
      const replyToEmail = generateReplyToEmail(action.tenantId, conversationId, emailMessageId);

      console.log(`[Executor] Sending email to ${recipientEmail} (replyTo: ${replyToEmail})`);
      const result = await sendEmail({
        to: recipientEmail,
        from: `${fromName} <${fromEmail}>`,
        subject: emailContent.subject,
        html: finalHtml,
        text: textBody,
        replyTo: replyToEmail,
        tenantId: action.tenantId,
        actionId: action.id,
        contactId: contact.id,
        invoiceId: invoice?.id,
      });

      // Gap 8: Track delivery status on the action record
      if (result?.success) {
        await db.update(actions).set({
          deliveryStatus: 'sent',
          providerMessageId: result.messageId,
          updatedAt: new Date(),
        }).where(eq(actions.id, action.id));
      } else {
        await this.handleSendFailure(action, result?.error);
      }

      if (usedPreGenerated) {
        await messagePreGenerator.markDraftUsed(action.id);
      }

      try {
        await db.insert(emailMessages).values({
          id: emailMessageId,
          tenantId: action.tenantId,
          conversationId,
          direction: 'OUTBOUND',
          channel: 'EMAIL',
          actionId: action.id,
          contactId: contact.id,
          invoiceId: invoice?.id || null,
          toEmail: recipientEmail,
          toName: contact.name || null,
          fromEmail,
          fromName,
          subject: emailContent.subject,
          textBody,
          htmlBody: emailContent.body,
          replyToken: `${action.tenantId}.${conversationId}.${emailMessageId}`,
          status: result?.success ? 'SENT' : 'FAILED',
          sendgridMessageId: result?.messageId || null,
          sentAt: result?.success ? new Date() : null,
        });
        await updateConversationStats(conversationId, 'outbound');
      } catch (recordErr) {
        console.warn(`⚠️ Email sent but failed to record in email_messages:`, recordErr);
      }

      return { 
        success: result?.success ?? !!result, 
        data: { 
          emailSent: true, 
          to: recipientEmail,
          subject: emailContent.subject,
          aiGenerated: !action.content || action.content.trim() === '',
          usedPreGenerated
        } 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS action with pre-generated or AI-generated content
   */
  private async sendSMSAction(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      let recipientPhone = await resolvePrimarySmsNumber(contact.id, action.tenantId, contact.phone, contact.arContactPhone);

      // Group action: override phone if the group has a primaryPhone set
      const smsMeta = (action.metadata ?? {}) as Record<string, any>;
      if (smsMeta.isGroupAction && smsMeta.groupId) {
        const [group] = await db
          .select({ primaryPhone: debtorGroups.primaryPhone })
          .from(debtorGroups)
          .where(eq(debtorGroups.id, smsMeta.groupId))
          .limit(1);
        if (group?.primaryPhone) {
          recipientPhone = group.primaryPhone;
        }
      }

      if (!recipientPhone) {
        return { success: false, error: 'Contact has no phone number' };
      }

      let message: string;
      let usedPreGenerated = false;
      const messageContext = await this.buildMessageContext(action, contact, invoice, tenant);
      const toneSettings = this.buildToneSettings(action);

      if (action.content && action.content.trim() !== '') {
        message = this.replaceTemplateVariables(action.content, contact, invoice);
      } else {
        const { draft, contextChanged } = await messagePreGenerator.getDraftForAction(
          action.id,
          'sms',
          messageContext,
          toneSettings
        );

        if (draft && draft.body) {
          console.log(`⚡ Using pre-generated SMS for ${contact.name}`);
          message = draft.body;
          usedPreGenerated = true;
        } else {
          console.log(`🤖 Generating AI SMS for ${contact.name}${contextChanged ? ' (context changed)' : ''}...`);
          const generated = await aiMessageGenerator.generateSMS(messageContext, toneSettings, {
            tenantId: action.tenantId,
            toneLevel: action.agentToneLevel || 'professional',
          });
          message = generated.body;
          if (generated.generationMethod) {
            await db.update(actions).set({ generationMethod: generated.generationMethod }).where(eq(actions.id, action.id));
          }
          console.log(`✅ AI SMS generated (${generated.generationMethod || 'llm'}): ${message.substring(0, 50)}...`);
        }
      }

      // Testing mode: prepend original recipient info
      const isTestMode = !!(contact as any)._originalPhone;
      if (isTestMode) {
        const originalPhone = (contact as any)._originalPhone;
        message = `[TEST] Original recipient: ${originalPhone} (${(contact as any)._originalName || 'Unknown'})\n\n${message}`;
      }

      const result = await sendSMS({
        to: recipientPhone,
        message: message,
        tenantId: action.tenantId,
      });

      if (usedPreGenerated && result.success) {
        await messagePreGenerator.markDraftUsed(action.id);
      }

      return { 
        success: result.success, 
        data: { 
          messageId: result.messageId,
          aiGenerated: !action.content || action.content.trim() === '',
          usedPreGenerated
        },
        error: result.error 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send WhatsApp action with AI-generated content
   */
  private async sendWhatsAppAction(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!contact.phone) {
        return { success: false, error: 'Contact has no phone number' };
      }

      let message: string;

      if (action.content && action.content.trim() !== '') {
        message = this.replaceTemplateVariables(action.content, contact, invoice);
      } else {
        console.log(`🤖 Generating AI WhatsApp message for ${contact.name}...`);
        const messageContext = await this.buildMessageContext(action, contact, invoice, tenant);
        const toneSettings = this.buildToneSettings(action);
        const generated = await aiMessageGenerator.generateSMS(messageContext, toneSettings, {
          tenantId: action.tenantId,
          toneLevel: action.agentToneLevel || 'professional',
        });
        message = generated.body;
        console.log(`✅ AI WhatsApp message generated`);
      }

      const result = await sendSMS({
        to: contact.phone,
        message: message,
        from: process.env.VONAGE_WHATSAPP_NUMBER || process.env.VONAGE_PHONE_NUMBER,
        tenantId: action.tenantId,
      });

      return { 
        success: result.success, 
        data: { 
          messageId: result.messageId,
          aiGenerated: !action.content || action.content.trim() === ''
        },
        error: result.error 
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Initiate AI voice call with pre-generated or AI-generated opening script
   */
  private async initiateVoiceCall(
    action: any,
    contact: any,
    invoice: any,
    tenant: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!contact.phone) {
        return { success: false, error: 'Contact has no phone number' };
      }

      const agentId = action.metadata?.agentId || process.env.RETELL_AGENT_ID;
      if (!agentId) {
        return { success: false, error: 'No AI agent ID configured' };
      }

      let openingScript: string | undefined;
      let usedPreGenerated = false;
      const messageContext = await this.buildMessageContext(action, contact, invoice, tenant);
      const toneSettings = this.buildToneSettings(action);
      
      if (!action.content || action.content.trim() === '') {
        // Check for pre-generated draft first
        const { draft, contextChanged } = await messagePreGenerator.getDraftForAction(
          action.id,
          'voice',
          messageContext,
          toneSettings
        );

        if (draft && draft.voiceScript) {
          console.log(`⚡ Using pre-generated voice script for ${contact.name}`);
          openingScript = draft.voiceScript;
          usedPreGenerated = true;
        } else {
          console.log(`🤖 Generating AI voice script for ${contact.name}${contextChanged ? ' (context changed)' : ''}...`);
          const generated = await aiMessageGenerator.generateVoiceScript(messageContext, toneSettings, {
            tenantId: action.tenantId,
            toneLevel: action.agentToneLevel || 'professional',
          });
          openingScript = generated.voiceScript;
          if (generated.generationMethod) {
            await db.update(actions).set({ generationMethod: generated.generationMethod }).where(eq(actions.id, action.id));
          }
          console.log(`✅ AI voice script generated (${generated.generationMethod || 'llm'})`);
        }
      }

      // Use recipientPhone/recipientName from metadata if available (set by schedule-call)
      let phoneToCall = action.metadata?.recipientPhone || contact.phone;
      const nameToCall = action.metadata?.recipientName || contact.name;

      // Group action: override phone if the group has a primaryPhone set
      const voiceMeta = (action.metadata ?? {}) as Record<string, any>;
      if (voiceMeta.isGroupAction && voiceMeta.groupId) {
        const [group] = await db
          .select({ primaryPhone: debtorGroups.primaryPhone })
          .from(debtorGroups)
          .where(eq(debtorGroups.id, voiceMeta.groupId))
          .limit(1);
        if (group?.primaryPhone) {
          phoneToCall = group.primaryPhone;
        }
      }

      // Use central voice wrapper (enforces communication mode)
      const { sendVoiceCall } = await import('./communications/sendVoiceCall.js');

      // Build group-aware dynamic variables for Retell
      const groupCompanyRef = voiceMeta.isGroupAction
        ? (voiceMeta.memberCompanyNames?.length <= 3
          ? voiceMeta.memberCompanyNames.join(', ')
          : `${voiceMeta.groupName} (${voiceMeta.memberCompanyNames.length} accounts)`)
        : undefined;

      const result = await sendVoiceCall({
        tenantId: tenant.id,
        to: phoneToCall,
        contactName: nameToCall,
        agentId: agentId,
        fromNumber: process.env.RETELL_PHONE_NUMBER || '+442045772088',
        dynamicVariables: {
          companyName: groupCompanyRef || contact.companyName || contact.name,
          invoiceNumber: invoice?.invoiceNumber || 'N/A',
          amount: invoice?.amount || 'N/A',
          daysOverdue: action.metadata?.daysOverdue || 0,
          voiceTone: action.metadata?.voiceTone || 'VOICE_TONE_CALM_COLLABORATIVE',
          toneProfile: action.metadata?.toneProfile || 'CREDIT_CONTROL_FRIENDLY',
          stage: action.metadata?.stage || 'CREDIT_CONTROL',
          reasonCode: action.metadata?.reasonCode || 'GENERIC_OVERDUE_FOLLOWUP',
          openingScript: openingScript || '',
          reasonForCall: action.metadata?.reason || action.content || '',
          callGoal: action.metadata?.goal || 'payment_commitment',
        },
        metadata: {
          contactId: contact.id,
          invoiceId: invoice?.id,
          actionId: action.id,
          voiceTone: action.metadata?.voiceTone,
          stage: action.metadata?.stage,
          aiGenerated: !action.content || action.content.trim() === '',
          usedPreGenerated,
        },
        context: 'ACTION_EXECUTOR',
      });

      if (usedPreGenerated) {
        await messagePreGenerator.markDraftUsed(action.id);
      }

      return { 
        success: true, 
        data: { ...result, aiGenerated: !action.content || action.content.trim() === '', usedPreGenerated }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Safely parse amount value (handles both string and number)
   */
  private parseAmount(value: any): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Replace template variables in content
   */
  private replaceTemplateVariables(
    content: string,
    contact: any,
    invoice: any
  ): string {
    const variables: Record<string, string> = {
      '{firstName}': contact.name?.split(' ')[0] || '',
      '{lastName}': contact.name?.split(' ').slice(1).join(' ') || '',
      '{companyName}': contact.companyName || contact.name || '',
      '{customerName}': contact.name || '',
      '{invoiceNumber}': invoice?.invoiceNumber || 'N/A',
      '{amount}': invoice?.amount ? `£${this.parseAmount(invoice.amount).toFixed(2)}` : 'N/A',
      '{dueDate}': invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : 'N/A',
      '{daysOverdue}': invoice?.dueDate 
        ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)).toString()
        : '0',
    };

    let result = content;
    for (const [variable, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(variable, 'g'), value);
    }

    return result;
  }

  /**
   * Gap 8: Handle synchronous send failures with retry logic
   * Max 2 retries: first after 5 minutes, second after 30 minutes.
   */
  private async handleSendFailure(action: any, error?: string): Promise<void> {
    const currentRetryCount = action.retryCount || 0;

    if (currentRetryCount < 2) {
      const delayMinutes = currentRetryCount === 0 ? 5 : 30;
      const retryScheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);

      // Create a retry action by cloning the failed one
      try {
        await db.insert(actions).values({
          tenantId: action.tenantId,
          invoiceId: action.invoiceId,
          contactId: action.contactId,
          type: action.type,
          subject: action.subject,
          content: action.content,
          scheduledFor: retryScheduledFor,
          status: 'scheduled',
          approvedBy: action.approvedBy,
          approvedAt: action.approvedAt,
          agentType: action.agentType || 'collections',
          actionSummary: `[RETRY ${currentRetryCount + 1}] ${action.actionSummary || action.subject || ''}`,
          retryOf: action.id,
          retryCount: currentRetryCount + 1,
          agentToneLevel: action.agentToneLevel,
          agentChannel: action.agentChannel,
          metadata: action.metadata,
          priority: action.priority,
        });
      } catch (insertErr) {
        console.error(`[Retry] Failed to create retry action for ${action.id}:`, insertErr);
      }

      // Mark original as failed (not permanent — retry pending)
      await db.update(actions).set({
        deliveryStatus: 'failed',
        retryCount: currentRetryCount + 1,
        updatedAt: new Date(),
      }).where(eq(actions.id, action.id));

      console.log(`[Retry] Action ${action.id} failed, retry ${currentRetryCount + 1} scheduled in ${delayMinutes}m`);
    } else {
      // Retries exhausted
      await db.update(actions).set({
        deliveryStatus: 'failed_permanent',
        retryCount: currentRetryCount,
        updatedAt: new Date(),
      }).where(eq(actions.id, action.id));

      console.log(`[Retry] Action ${action.id} failed permanently after ${currentRetryCount} retries`);

      // Record hard bounce for Data Health
      if (action.contactId) {
        try {
          const { eventBus } = await import('../lib/event-bus');
          await (eventBus as any).handleHardBounce(action.tenantId, action.contactId);
        } catch (err) {
          console.error('[Retry] Failed to record hard bounce (non-fatal):', err);
        }
      }
    }
  }

  /**
   * Create a timeline event for a successfully executed outbound action.
   * This populates the Activity Feed tab.
   * Non-fatal — a failed timeline insert must never block delivery.
   */
  private async createOutboundTimelineEvent(
    action: any,
    contact: any,
    invoice: any,
    resultData: any,
  ): Promise<void> {
    try {
      // Map action type to channel name used by timeline
      const channelMap: Record<string, string> = {
        email: 'email',
        sms: 'sms',
        whatsapp: 'sms',
        voice: 'voice',
        call: 'voice',
      };
      const channel = channelMap[action.type] || action.type;

      const summary = action.type === 'email'
        ? `Sent email: ${action.subject || 'Payment reminder'}`
        : action.type === 'sms'
          ? `Sent SMS to ${contact.name}`
          : action.type === 'voice' || action.type === 'call'
            ? `Voice call initiated to ${contact.name}`
            : `${action.type} sent to ${contact.name}`;

      const preview = action.content
        ? action.content.substring(0, 240)
        : resultData?.subject || summary;

      await db.insert(timelineEvents).values({
        tenantId: action.tenantId,
        customerId: action.contactId,
        invoiceId: action.invoiceId || invoice?.id || null,
        occurredAt: new Date(),
        direction: 'outbound',
        channel,
        summary,
        preview,
        subject: action.subject || null,
        body: action.content || null,
        status: 'sent',
        createdByType: 'system',
        createdByName: 'Charlie',
        actionId: action.id,
      });
    } catch (err) {
      console.warn(`[Executor] Failed to create outbound timeline event for action ${action.id}:`, err);
      // Non-fatal — delivery already succeeded
    }
  }
}

/**
 * Gap 10: Set 30-day legal response window when a Legal tone action is successfully sent.
 * Called from ActionExecutor completion paths after successful delivery.
 */
export async function setLegalResponseWindowIfNeeded(
  actionId: string,
  contactId: string,
  tenantId: string,
  agentToneLevel: string | null,
): Promise<void> {
  if (agentToneLevel !== 'legal') return;

  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 30);

  await db.update(contacts).set({
    legalResponseWindowEnd: windowEnd,
    updatedAt: new Date(),
  }).where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));

  // Record in timeline for audit trail
  try {
    await db.insert(timelineEvents).values({
      tenantId,
      customerId: contactId,
      occurredAt: new Date(),
      direction: 'internal',
      channel: 'system',
      summary: `Pre-action 30-day response window started (expires ${windowEnd.toISOString().split('T')[0]})`,
      preview: `Legal Letter Before Action sent. No automated contact until ${windowEnd.toISOString().split('T')[0]}.`,
      status: 'sent',
      actionId,
      createdByType: 'system',
    });
  } catch (err) {
    console.warn(`[Legal] Failed to record timeline event for legal window:`, err);
  }

  console.log(`⚖️ [Legal] 30-day response window set for contact ${contactId}, expires ${windowEnd.toISOString()}`);
}

// Export singleton instance
export const actionExecutor = new ActionExecutor();
