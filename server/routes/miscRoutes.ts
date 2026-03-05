import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, isOwner } from "../auth";
import { logSecurityEvent, extractClientInfo } from "../services/securityAuditService";
import { sanitizeObject, stripSensitiveUserFields, stripSensitiveTenantFields, stripSensitiveFields } from "../utils/sanitize";
import { withPermission, withRole, withMinimumRole, canManageUser, withRBACContext } from "../middleware/rbac";
import { 
  insertContactSchema, insertContactNoteSchema, insertInvoiceSchema, 
  insertActionSchema, insertWorkflowSchema, insertCommunicationTemplateSchema,
  insertEscalationRuleSchema, insertChannelAnalyticsSchema, insertWorkflowTemplateSchema,
  insertVoiceCallSchema, insertBillSchema, insertBankAccountSchema,
  insertBankTransactionSchema, insertBudgetSchema, insertExchangeRateSchema,
  insertActionItemSchema, insertActionLogSchema, insertPaymentPromiseSchema,
  insertPartnerSchema, insertUserContactAssignmentSchema, insertScheduledReportSchema,
  type Invoice, type Contact, type ContactNote, type Bill, type BankAccount,
  type BankTransaction, type Budget, type ExchangeRate, type ActionItem,
  type ActionLog, type PaymentPromise,
  invoices, contacts, actions, disputes, bankTransactions, customerLearningProfiles,
  inboundMessages, smsMessages, investorLeads, onboardingProgress, messageDrafts,
  tenants, paymentPromises, promisesToPay, smeClients, contactNotes, timelineEvents,
  attentionItems, outcomes, activityLogs, collectionPolicies, paymentPlans,
  emailMessages, customerContactPersons, scheduledReports, partnerWaitlist,
} from "@shared/schema";
import { computeNextRunAt } from "../services/reportScheduler";
import { REPORT_TYPE_LABELS, type ReportType } from "../services/reportGenerator";
import { getOverdueCategoryFromDueDate } from "@shared/utils/overdueUtils";
import { calculateLatePaymentInterest } from "../utils/interestCalculator";
import { eq, and, desc, asc, sql, count, avg, gte, lte, lt, inArray, or, isNull, isNotNull, gt, not } from 'drizzle-orm';
import { db } from '../db';
import { z } from "zod";
import { generateCollectionSuggestions, generateEmailDraft, generateAiCfoResponse } from "../services/openai";
import { sendReminderEmail, DEFAULT_FROM, DEFAULT_FROM_EMAIL } from "../services/sendgrid";
import { sendPaymentReminderSMS } from "../services/vonage";
import { ActionPrioritizationService } from "../services/actionPrioritizationService";
import { formatDate } from "@shared/utils/dateFormatter";
import { xeroService } from "../services/xero";
import { onboardingService } from "../services/onboardingService";
import { XeroSyncService } from "../services/xeroSync";
import { generateMockData } from "../mock-data";
import { retellService } from "../retell-service";
import { createRetellClient } from "../mcp/client";
import { normalizeDynamicVariables, logVariableTransformation } from "../utils/retellVariableNormalizer";
import { Retell } from "retell-sdk";
import Stripe from "stripe";
import { cleanEmailContent } from "../services/messagePostProcessor";
import { subscriptionService } from "../services/subscriptionService";
import { getDashboardMetrics } from "../services/metricsService";
import { computeCashInflow } from "../services/dashboardCashInflowService";
import { PermissionService } from "../services/permissionService";
import { signalCollector } from "../lib/signal-collector";
import { getAssignedContactIds, hasContactAccess } from "./routeHelpers";



export function registerMiscRoutes(app: Express): void {
  app.post("/api/calls/manual", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { 
        invoiceId, 
        contactId, 
        direction, 
        outcome, 
        notes,
        capturePromise,
        promiseType,
        promiseDate,
        promiseAmount,
        installments 
      } = req.body;

      // Create the call action
      const callAction = await storage.createAction({
        tenantId: user.tenantId,
        userId: user.id,
        contactId,
        invoiceId,
        type: 'call',
        status: 'completed',
        priority: 'medium',
        title: `${direction === 'inbound' ? 'Inbound' : 'Outbound'} call - ${outcome}`,
        description: notes || `Manual call capture: ${outcome}`,
        metadata: {
          direction,
          outcome,
          notes,
          source: 'manual',
          capturedPromise: capturePromise
        }
      });

      const promises: any[] = [];

      // If capturing a promise, create promise records
      if (capturePromise) {
        const { getPromiseReliabilityService } = await import('./services/promiseReliabilityService.js');
        const promiseService = getPromiseReliabilityService();

        if (promiseType === 'payment_plan') {
          // Payment plan must have installments array
          if (!installments || installments.length === 0) {
            return res.status(400).json({ 
              message: "Payment plan requires at least one installment" 
            });
          }

          // Validate installments
          const validInstallments = installments.filter(i => {
            const amount = parseFloat(i.amount);
            return i.date && i.amount && !isNaN(amount) && amount > 0;
          });

          if (validInstallments.length === 0) {
            return res.status(400).json({ 
              message: "Payment plan requires at least one installment with valid date and positive amount" 
            });
          }

          // Create multiple promises for payment plan
          for (const installment of validInstallments) {
            const promise = await promiseService.createPromise({
              tenantId: user.tenantId,
              contactId,
              invoiceId,
              promiseType: 'payment_plan',
              promisedDate: new Date(installment.date),
              promisedAmount: parseFloat(installment.amount),
              sourceType: 'manual',
              sourceId: callAction.id,
              channel: 'phone',
              createdByUserId: user.id,
              notes: `Payment plan installment: ${notes || ''}`,
            });
            promises.push(promise);
          }
        } else if (promiseDate && promiseAmount) {
          // Validate promise amount
          const amount = parseFloat(promiseAmount);
          if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ 
              message: "Promise amount must be a valid positive number" 
            });
          }

          // Create single promise
          const promise = await promiseService.createPromise({
            tenantId: user.tenantId,
            contactId,
            invoiceId,
            promiseType: promiseType || 'payment_date',
            promisedDate: new Date(promiseDate),
            promisedAmount: amount,
            sourceType: 'manual',
            sourceId: callAction.id,
            channel: 'phone',
            createdByUserId: user.id,
            notes: notes || '',
          });
          promises.push(promise);
        } else if (promiseType !== 'payment_plan') {
          // If not payment plan, require promiseDate and promiseAmount
          return res.status(400).json({ 
            message: "Promise date and amount are required for single promises" 
          });
        }
      }

      res.status(201).json({ 
        action: callAction,
        promises,
        message: capturePromise 
          ? `Call captured with ${promises.length} promise(s) recorded` 
          : 'Call captured successfully'
      });
    } catch (error) {
      console.error("Error capturing manual call:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid call data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to capture call" });
    }
  });

  app.get("/api/wallet/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { transactionType, source, startDate, endDate, limit } = req.query;

      const transactions = await storage.getWalletTransactions(user.tenantId, {
        transactionType: transactionType as string | undefined,
        source: source as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });

      res.json(transactions);
    } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      res.status(500).json({ message: "Failed to fetch wallet transactions" });
    }
  });

  app.get("/api/wallet/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const transaction = await storage.getWalletTransaction(req.params.id, user.tenantId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      res.json(transaction);
    } catch (error) {
      console.error("Error fetching wallet transaction:", error);
      res.status(500).json({ message: "Failed to fetch wallet transaction" });
    }
  });

  app.post("/api/wallet/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { insertWalletTransactionSchema } = await import("@shared/schema");
      const validatedData = insertWalletTransactionSchema.omit({ tenantId: true }).parse(req.body);

      const transactionData = {
        ...validatedData,
        tenantId: user.tenantId,
      };

      const transaction = await storage.createWalletTransaction(transactionData);
      res.json(transaction);
    } catch (error) {
      console.error("Error creating wallet transaction:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid transaction data", error: error.message });
      }
      res.status(500).json({ message: "Failed to create wallet transaction" });
    }
  });

  app.get("/api/wallet/balance", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const balance = await storage.getWalletBalance(user.tenantId);
      res.json(balance);
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      res.status(500).json({ message: "Failed to fetch wallet balance" });
    }
  });

  app.get("/api/wallet/summary", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const summary = await storage.getWalletSummary(user.tenantId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching wallet summary:", error);
      res.status(500).json({ message: "Failed to fetch wallet summary" });
    }
  });

  app.get("/api/automation/daily-plan", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // fetchOnly=true means don't auto-generate if no plan exists
      // This allows showing empty state after deletion
      const { generateDailyPlan } = await import("./services/dailyPlanGenerator");
      const plan = await generateDailyPlan(user.tenantId, req.user.id, false, true);
      
      res.json(plan);
    } catch (error: any) {
      console.error("Error fetching daily plan:", error);
      res.status(500).json({ message: `Failed to fetch daily plan: ${error.message}` });
    }
  });

  app.post("/api/automation/generate-plan", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🔄 Manual plan generation triggered by user ${req.user.id}`);

      const { generateDailyPlan } = await import("./services/dailyPlanGenerator");
      const plan = await generateDailyPlan(user.tenantId, req.user.id, true); // Force regeneration
      
      console.log(`✅ Generated ${plan.actions.length} actions for today's plan`);

      // Trigger message pre-generation asynchronously (don't block response)
      if (plan.actions.length > 0) {
        const { messagePreGenerator } = await import("./services/messagePreGenerator");
        const actionIds = plan.actions.map((a: any) => a.id);
        
        // Run pre-generation in background - user gets fast response while messages are prepared
        messagePreGenerator.preGenerateForActions(actionIds)
          .then(result => {
            console.log(`✅ Pre-generated messages: ${result.generated} generated, ${result.failed} failed, ${result.skipped} skipped`);
          })
          .catch(err => {
            console.error(`❌ Message pre-generation failed:`, err.message);
          });
      }

      res.json(plan);
    } catch (error: any) {
      console.error("Error generating daily plan:", error);
      res.status(500).json({ message: `Failed to generate daily plan: ${error.message}` });
    }
  });

  app.delete("/api/automation/daily-plan", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Delete all pending_approval and scheduled actions for this tenant
      const result = await db
        .delete(actions)
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ['pending_approval', 'scheduled'])
          )
        )
        .returning({ id: actions.id });

      console.log(`🗑️ Deleted ${result.length} planned actions for tenant ${user.tenantId}`);

      res.json({
        message: "All planned actions deleted",
        deletedCount: result.length,
      });
    } catch (error: any) {
      console.error("Error deleting planned actions:", error);
      res.status(500).json({ message: `Failed to delete planned actions: ${error.message}` });
    }
  });

  app.post("/api/automation/approve-plan", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const { mode, scheduledFor } = req.body || {};

      const pendingActions = await db.query.actions.findMany({
        where: and(
          eq(actions.tenantId, user.tenantId),
          eq(actions.status, 'pending_approval')
        )
      });

      if (pendingActions.length === 0) {
        return res.json({ 
          message: "No actions pending approval",
          approvedCount: 0 
        });
      }

      const actionIds = pendingActions.map(a => a.id);

      if (mode === 'immediate') {
        res.json({
          message: "Executing actions now",
          approvedCount: actionIds.length,
          mode: 'immediate',
        });

        const { actionExecutor } = await import("./services/actionExecutor");
        actionExecutor.executeActionsByIds(actionIds, req.user.id).then(result => {
          console.log(`✅ Immediate execution complete: ${result.successCount} success, ${result.errorCount} failed`);
        }).catch(err => {
          console.error("❌ Immediate execution error:", err);
        });
      } else {
        let executionTime: Date;
        if (scheduledFor) {
          executionTime = new Date(scheduledFor);
        } else {
          executionTime = new Date();
          executionTime.setDate(executionTime.getDate() + 1);
          const [hours, minutes] = (tenant.executionTime || '09:00').split(':');
          executionTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }

        await db.update(actions)
          .set({
            status: 'scheduled',
            scheduledFor: executionTime,
            approvedBy: req.user.id,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(actions.tenantId, user.tenantId),
              inArray(actions.id, actionIds)
            )
          );

        console.log(`✅ Approved ${actionIds.length} actions for execution at ${executionTime.toISOString()}`);

        res.json({
          message: "Plan approved successfully",
          approvedCount: actionIds.length,
          mode: 'scheduled',
          executionTime: executionTime.toISOString(),
        });
      }
    } catch (error: any) {
      console.error("Error approving plan:", error);
      res.status(500).json({ message: `Failed to approve plan: ${error.message}` });
    }
  });

  app.get("/api/attention-items", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, status, severity, invoiceId, contactId, limit = 50, offset = 0 } = req.query;

      const conditions = [eq(attentionItems.tenantId, user.tenantId)];
      
      if (type) conditions.push(eq(attentionItems.type, type as string));
      if (status) conditions.push(eq(attentionItems.status, status as string));
      if (severity) conditions.push(eq(attentionItems.severity, severity as string));
      if (invoiceId) conditions.push(eq(attentionItems.invoiceId, invoiceId as string));
      if (contactId) conditions.push(eq(attentionItems.contactId, contactId as string));

      console.log("📋 Fetching attention items for tenant:", user.tenantId);
      
      const items = await db.query.attentionItems.findMany({
        where: and(...conditions),
        with: {
          invoice: true,
          contact: true,
          assignedTo: true,
        },
        orderBy: [desc(attentionItems.createdAt)],
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
      
      console.log("📋 Found", items.length, "attention items");

      // Get counts by status
      const openCount = await db.select({ count: sql<number>`count(*)` })
        .from(attentionItems)
        .where(and(eq(attentionItems.tenantId, user.tenantId), eq(attentionItems.status, 'OPEN')));
      
      const inProgressCount = await db.select({ count: sql<number>`count(*)` })
        .from(attentionItems)
        .where(and(eq(attentionItems.tenantId, user.tenantId), eq(attentionItems.status, 'IN_PROGRESS')));

      res.json({
        items,
        counts: {
          open: Number(openCount[0]?.count ?? 0),
          inProgress: Number(inProgressCount[0]?.count ?? 0),
        },
      });
    } catch (error: any) {
      console.error("Error fetching attention items:", error);
      res.status(500).json({ message: `Failed to fetch attention items: ${error.message}` });
    }
  });

  app.get("/api/attention-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const item = await db.query.attentionItems.findFirst({
        where: and(
          eq(attentionItems.id, req.params.id),
          eq(attentionItems.tenantId, user.tenantId)
        ),
        with: {
          invoice: true,
          contact: true,
          action: true,
          assignedTo: true,
          resolvedBy: true,
        },
      });

      if (!item) {
        return res.status(404).json({ message: "Attention item not found" });
      }

      res.json(item);
    } catch (error: any) {
      console.error("Error fetching attention item:", error);
      res.status(500).json({ message: `Failed to fetch attention item: ${error.message}` });
    }
  });

  app.post("/api/attention-items", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate request body with Zod
      const parseResult = createAttentionItemSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { type, severity, title, description, invoiceId, contactId, actionId, payloadJson } = parseResult.data;

      // Validate foreign keys belong to tenant (prevent cross-tenant references)
      if (invoiceId) {
        const invoice = await db.query.invoices.findFirst({
          where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, user.tenantId))
        });
        if (!invoice) {
          return res.status(400).json({ message: "Invoice not found or belongs to different tenant" });
        }
      }

      if (contactId) {
        const contact = await db.query.contacts.findFirst({
          where: and(eq(contacts.id, contactId), eq(contacts.tenantId, user.tenantId))
        });
        if (!contact) {
          return res.status(400).json({ message: "Contact not found or belongs to different tenant" });
        }
      }

      if (actionId) {
        const action = await db.query.actions.findFirst({
          where: and(eq(actions.id, actionId), eq(actions.tenantId, user.tenantId))
        });
        if (!action) {
          return res.status(400).json({ message: "Action not found or belongs to different tenant" });
        }
      }

      const [item] = await db.insert(attentionItems).values({
        tenantId: user.tenantId,
        type,
        severity,
        title,
        description,
        invoiceId,
        contactId,
        actionId,
        payloadJson,
      }).returning();

      console.log(`✅ Created attention item: ${item.id} (${type})`);

      res.status(201).json(item);
    } catch (error: any) {
      console.error("Error creating attention item:", error);
      res.status(500).json({ message: `Failed to create attention item: ${error.message}` });
    }
  });

  app.patch("/api/attention-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { status, severity, assignedToUserId, description } = req.body;

      const updates: any = { updatedAt: new Date() };
      if (status) updates.status = status;
      if (severity) updates.severity = severity;
      if (assignedToUserId !== undefined) updates.assignedToUserId = assignedToUserId;
      if (description !== undefined) updates.description = description;

      const [item] = await db.update(attentionItems)
        .set(updates)
        .where(and(
          eq(attentionItems.id, req.params.id),
          eq(attentionItems.tenantId, user.tenantId)
        ))
        .returning();

      if (!item) {
        return res.status(404).json({ message: "Attention item not found" });
      }

      res.json(item);
    } catch (error: any) {
      console.error("Error updating attention item:", error);
      res.status(500).json({ message: `Failed to update attention item: ${error.message}` });
    }
  });

  app.post("/api/attention-items/:id/resolve", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { resolutionNotes, resolutionAction } = req.body;

      const [item] = await db.update(attentionItems)
        .set({
          status: 'RESOLVED',
          resolvedByUserId: user.id,
          resolvedAt: new Date(),
          resolutionNotes,
          resolutionAction,
          updatedAt: new Date(),
        })
        .where(and(
          eq(attentionItems.id, req.params.id),
          eq(attentionItems.tenantId, user.tenantId)
        ))
        .returning();

      if (!item) {
        return res.status(404).json({ message: "Attention item not found" });
      }

      console.log(`✅ Resolved attention item: ${item.id}`);

      res.json(item);
    } catch (error: any) {
      console.error("Error resolving attention item:", error);
      res.status(500).json({ message: `Failed to resolve attention item: ${error.message}` });
    }
  });

  app.post("/api/attention-items/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { resolutionNotes } = req.body;

      const [item] = await db.update(attentionItems)
        .set({
          status: 'DISMISSED',
          resolvedByUserId: user.id,
          resolvedAt: new Date(),
          resolutionNotes,
          updatedAt: new Date(),
        })
        .where(and(
          eq(attentionItems.id, req.params.id),
          eq(attentionItems.tenantId, user.tenantId)
        ))
        .returning();

      if (!item) {
        return res.status(404).json({ message: "Attention item not found" });
      }

      console.log(`✅ Dismissed attention item: ${item.id}`);

      res.json(item);
    } catch (error: any) {
      console.error("Error dismissing attention item:", error);
      res.status(500).json({ message: `Failed to dismiss attention item: ${error.message}` });
    }
  });

  app.patch("/api/automation/policy-settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const {
        approvalMode,
        approvalTimeoutHours,
        executionTime,
        executionTimezone,
        dailyLimits,
        minConfidence,
        exceptionRules,
      } = req.body;

      // Validate approval mode
      if (approvalMode && !['manual', 'auto_after_timeout', 'full_auto'].includes(approvalMode)) {
        return res.status(400).json({ 
          message: "Invalid approvalMode - must be manual, auto_after_timeout, or full_auto" 
        });
      }

      // Validate minConfidence values if provided
      if (minConfidence !== undefined) {
        const { email, sms, voice } = minConfidence;
        if (email !== undefined && (email < 0 || email > 1)) {
          return res.status(400).json({ message: "minConfidence.email must be between 0 and 1" });
        }
        if (sms !== undefined && (sms < 0 || sms > 1)) {
          return res.status(400).json({ message: "minConfidence.sms must be between 0 and 1" });
        }
        if (voice !== undefined && (voice < 0 || voice > 1)) {
          return res.status(400).json({ message: "minConfidence.voice must be between 0 and 1" });
        }
      }

      // Build update object with only provided fields
      const updates: any = { updatedAt: new Date() };
      if (approvalMode !== undefined) updates.approvalMode = approvalMode;
      if (approvalTimeoutHours !== undefined) updates.approvalTimeoutHours = approvalTimeoutHours;
      if (executionTime !== undefined) updates.executionTime = executionTime;
      if (executionTimezone !== undefined) updates.executionTimezone = executionTimezone;
      if (dailyLimits !== undefined) updates.dailyLimits = dailyLimits;
      if (minConfidence !== undefined) updates.minConfidence = minConfidence;
      if (exceptionRules !== undefined) updates.exceptionRules = exceptionRules;

      await storage.updateTenant(user.tenantId, updates);

      console.log(`✅ Updated automation policy settings for tenant ${user.tenantId}`);

      res.json({
        message: "Policy settings updated successfully",
        settings: updates,
      });
    } catch (error: any) {
      console.error("Error updating policy settings:", error);
      res.status(500).json({ message: `Failed to update policy settings: ${error.message}` });
    }
  });

  app.post("/api/automation/skip-action/:actionId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const actionId = parseInt(req.params.actionId);
      const { days } = req.body;

      if (!days || days < 1 || days > 90) {
        return res.status(400).json({ message: "Days must be between 1 and 90" });
      }

      // Find the action and verify it belongs to this tenant
      const [action] = await db.select()
        .from(actions)
        .where(
          and(
            eq(actions.id, actionId),
            eq(actions.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!action) {
        return res.status(404).json({ message: "Action not found" });
      }

      // Calculate new scheduled date - set to X days from now
      const newScheduledFor = new Date();
      newScheduledFor.setDate(newScheduledFor.getDate() + days);
      // Set time to 9am on that day for scheduling
      newScheduledFor.setHours(9, 0, 0, 0);

      // Update action with new scheduled date and set to pending so it appears in future plans
      await db.update(actions)
        .set({
          status: 'pending',
          scheduledFor: newScheduledFor,
          notes: `Skipped until ${newScheduledFor.toLocaleDateString('en-GB')} (${days} days delay)`,
          updatedAt: new Date(),
        })
        .where(eq(actions.id, actionId));

      console.log(`✅ Rescheduled action ${actionId} for ${days} days later (${newScheduledFor.toISOString()})`);

      res.json({
        message: `Action rescheduled for ${days} days`,
        actionId,
        newScheduledFor: newScheduledFor.toISOString(),
      });
    } catch (error: any) {
      console.error("Error skipping action:", error);
      res.status(500).json({ message: `Failed to skip action: ${error.message}` });
    }
  });

  app.post("/api/automation/mark-attention/:actionId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const actionId = parseInt(req.params.actionId);

      // Find the action and verify it belongs to this tenant
      const [action] = await db.select()
        .from(actions)
        .where(
          and(
            eq(actions.id, actionId),
            eq(actions.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!action) {
        return res.status(404).json({ message: "Action not found" });
      }

      // Update action status to flagged for human attention
      await db.update(actions)
        .set({
          status: 'requires_attention',
          escalationLevel: 1,
          notes: 'Manually flagged for human attention',
          updatedAt: new Date(),
        })
        .where(eq(actions.id, actionId));

      console.log(`✅ Marked action ${actionId} for attention`);

      res.json({
        message: "Debtor marked for attention",
        actionId,
      });
    } catch (error: any) {
      console.error("Error marking action for attention:", error);
      res.status(500).json({ message: `Failed to mark for attention: ${error.message}` });
    }
  });

  app.post("/api/automation/bulk-skip", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { actionIds, days } = req.body;

      if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
        return res.status(400).json({ message: "actionIds must be a non-empty array" });
      }

      if (!days || days < 1 || days > 90) {
        return res.status(400).json({ message: "Days must be between 1 and 90" });
      }

      // Calculate new scheduled date
      const newScheduledFor = new Date();
      newScheduledFor.setDate(newScheduledFor.getDate() + days);
      newScheduledFor.setHours(9, 0, 0, 0);

      // Update all actions
      await db.update(actions)
        .set({
          status: 'pending',
          scheduledFor: newScheduledFor,
          notes: `Bulk skipped until ${newScheduledFor.toLocaleDateString('en-GB')} (${days} days delay)`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.id, actionIds)
          )
        );

      console.log(`✅ Bulk skipped ${actionIds.length} actions for ${days} days`);

      res.json({
        message: `${actionIds.length} actions rescheduled for ${days} days`,
        count: actionIds.length,
        newScheduledFor: newScheduledFor.toISOString(),
      });
    } catch (error: any) {
      console.error("Error bulk skipping actions:", error);
      res.status(500).json({ message: `Failed to bulk skip: ${error.message}` });
    }
  });

  app.post("/api/automation/bulk-attention", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { actionIds } = req.body;

      if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
        return res.status(400).json({ message: "actionIds must be a non-empty array" });
      }

      // Update all actions to requires_attention
      await db.update(actions)
        .set({
          status: 'requires_attention',
          escalationLevel: 1,
          notes: 'Bulk flagged for human attention',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.id, actionIds)
          )
        );

      console.log(`✅ Bulk marked ${actionIds.length} actions for attention`);

      res.json({
        message: `${actionIds.length} debtors marked for attention`,
        count: actionIds.length,
      });
    } catch (error: any) {
      console.error("Error bulk marking for attention:", error);
      res.status(500).json({ message: `Failed to bulk mark for attention: ${error.message}` });
    }
  });

  app.get('/api/subscription/status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (!user.stripeSubscriptionId) {
        return res.json({ status: 'none' });
      }

      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      res.json({
        status: subscription.status,
        currentPeriodEnd: (subscription as any).current_period_end,
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      });
    } catch (error: any) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  app.post('/api/subscription/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No subscription found" });
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      res.json({
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.get('/api/ai-facts', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const category = req.query.category as string | undefined;
      const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
      const search = req.query.search as string | undefined;

      let facts;
      if (search) {
        facts = await storage.searchAiFacts(user.tenantId, search);
      } else if (tags) {
        facts = await storage.getAiFactsByTags(user.tenantId, tags);
      } else {
        facts = await storage.getAiFacts(user.tenantId, category);
      }

      res.json(facts);
    } catch (error) {
      console.error('Error fetching AI facts:', error);
      res.status(500).json({ message: 'Failed to fetch AI facts' });
    }
  });

  app.post('/api/ai-facts', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const fact = await storage.createAiFact({
        ...req.body,
        tenantId: user.tenantId,
        createdBy: user.id,
      });
      res.json(fact);
    } catch (error) {
      console.error('Error creating AI fact:', error);
      res.status(500).json({ message: 'Failed to create AI fact' });
    }
  });

  app.put('/api/ai-facts/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const fact = await storage.updateAiFact(id, req.body);
      res.json(fact);
    } catch (error) {
      console.error('Error updating AI fact:', error);
      res.status(500).json({ message: 'Failed to update AI fact' });
    }
  });

  app.delete('/api/ai-facts/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req.user as any).id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      await storage.deleteAiFact(id, user.tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting AI fact:', error);
      res.status(500).json({ message: 'Failed to delete AI fact' });
    }
  });

  app.post('/api/ai-cfo/chat', isAuthenticated, async (req, res) => {
    try {
      const { message, conversationHistory = [] } = req.body;
      
      // Get user with tenant info (same as invoices endpoint)
      const user = await storage.getUser((req.user as any).id);
      console.log(`🔍 AI CFO Debug: User ID: ${(req.user as any).id}, User found: ${!!user}, TenantId: ${user?.tenantId}`);
      
      if (!user?.tenantId) {
        console.log(`❌ AI CFO Debug: No tenant ID found for user!`);
        return res.status(400).json({ error: 'User not associated with a tenant' });
      }

      // Seed AI Facts if this is the first time using AI CFO for this tenant
      const { seedAiFacts } = await import('./seed-ai-facts');
      await seedAiFacts(user.tenantId);

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Get current AR context for the user (get ALL invoices for complete visibility)
      console.log(`🔍 AI CFO Debug: About to fetch invoices for tenant: ${user.tenantId}`);
      const [invoiceMetrics, allInvoices] = await Promise.all([
        storage.getInvoiceMetrics(user.tenantId),
        storage.getInvoices(user.tenantId) // No limit - get all invoices like the invoices page
      ]);

      console.log(`🔍 AI CFO Debug: Raw invoices fetched: ${allInvoices.length}, Invoice metrics: ${JSON.stringify(invoiceMetrics)}`);
      
      // Get only outstanding invoices for AI context (paid invoices don't matter for AR analysis)
      const invoices = allInvoices.filter(inv => inv.status !== 'Paid');
      console.log(`🔍 AI CFO Debug: Outstanding invoices after filtering: ${invoices.length}`);
      
      if (allInvoices.length > 0) {
        console.log(`🔍 AI CFO Debug: Sample invoice statuses:`, allInvoices.slice(0, 3).map(inv => `${inv.contact?.name || 'Unknown'}: ${inv.status} - $${inv.amount}`));
      }

      // Calculate additional context
      const overdueInvoices = invoices.filter(inv => {
        const dueDate = new Date(inv.dueDate);
        return dueDate < new Date();
      });

      const overdueAmount = overdueInvoices.reduce((total, inv) => total + Number(inv.amount), 0);
      const totalOutstanding = invoices.reduce((total, inv) => total + Number(inv.amount), 0);

      // Get relevant AI Facts for enhanced responses
      console.log(`🧠 AI CFO: Fetching AI Facts for context enhancement...`);
      const [allFacts, searchFacts] = await Promise.all([
        storage.getAiFacts(user.tenantId), // Get all facts
        storage.searchAiFacts(user.tenantId, message).catch(() => []) // Search for relevant facts based on message
      ]);
      
      // Combine and prioritize facts
      const relevantFacts = Array.from(new Set([...searchFacts, ...allFacts.slice(0, 5)])).slice(0, 8);
      console.log(`🧠 AI CFO: Found ${allFacts.length} total facts, ${searchFacts.length} relevant to query, using ${relevantFacts.length} in context`);

      // Prepare AR context for AI
      const arContext = {
        totalOutstanding: totalOutstanding,
        overdueAmount: overdueAmount,
        collectionRate: invoiceMetrics?.collectionRate || 85,
        averageDaysToPay: invoiceMetrics?.avgDaysToPay || 30,
        activeContacts: invoices.length,
        knowledgeBase: relevantFacts.map(fact => ({
          title: fact.title,
          content: fact.content,
          category: fact.category,
          priority: fact.priority,
          source: fact.source
        })),
        recentInvoices: invoices.slice(0, 5).map(inv => ({
          id: inv.id,
          amount: Number(inv.amount),
          daysPastDue: Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))),
          customerName: inv.contact?.companyName || inv.contact?.name || 'Unknown',
          status: inv.status
        })),
        allCustomers: invoices.map(inv => ({
          customerName: inv.contact?.companyName || inv.contact?.name || 'Unknown',
          amount: Number(inv.amount),
          daysPastDue: Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))),
          status: inv.status,
          invoiceNumber: inv.invoiceNumber
        })),
        cashflowTrends: {
          thirtyDays: invoices.filter(inv => {
            const daysPast = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            return daysPast >= 0 && daysPast <= 30;
          }).reduce((sum, inv) => sum + Number(inv.amount), 0),
          sixtyDays: invoices.filter(inv => {
            const daysPast = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            return daysPast > 30 && daysPast <= 60;
          }).reduce((sum, inv) => sum + Number(inv.amount), 0),
          ninetyDays: invoices.filter(inv => {
            const daysPast = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            return daysPast > 60;
          }).reduce((sum, inv) => sum + Number(inv.amount), 0)
        }
      };

      // Check if user is asking about a specific customer (improved detection)
      console.log(`🔍 AI CFO: Parsing message for customer names: "${message}"`);
      
      // Simple but effective pattern to extract company names
      let searchedCustomer = null;
      
      // Look for patterns like "FashionTech Pro", "DeliveryTech Solutions", etc.
      const companyMatch = message.match(/\b([A-Z][a-zA-Z]*(?:Tech|Fashion|Smart|Food|Plastic|Space|Fitness|Home|Delivery|Payment|Green|Health|Auto|Digital|Mobile|Cloud|Data|Cyber|AI|ML|Bio|Nano|Quantum)[A-Za-z]*(?:\s+(?:Pro|Solutions?|Services?|Inc|LLC|Corp|Company|Group|Technologies?|Tech|Systems?|Associates?|Partners?|Enterprises?|Industries?|Limited|Ltd))?)\b/gi);
      
      if (companyMatch && companyMatch.length > 0) {
        searchedCustomer = companyMatch[0].trim();
        console.log(`🔍 AI CFO: Found company name: "${searchedCustomer}"`);
      } else {
        // Fallback: look for any two capitalized words
        const fallbackMatch = message.match(/\b([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)\b/);
        if (fallbackMatch) {
          searchedCustomer = fallbackMatch[1].trim();
          console.log(`🔍 AI CFO: Found customer with fallback pattern: "${searchedCustomer}"`);
        }
      }
      
      let specificCustomerData = null;
      
      if (searchedCustomer) {
        console.log(`🔍 AI CFO: Searching for customer: "${searchedCustomer}"`);
        
        // Debug: Show some customer names and company names from database
        const uniquePersons = Array.from(new Set(allInvoices.map(inv => inv.contact?.name).filter(Boolean))).slice(0, 10);
        const uniqueCompanies = Array.from(new Set(allInvoices.map(inv => inv.contact?.companyName).filter(Boolean))).slice(0, 10);
        console.log(`🔍 AI CFO: Sample person names:`, uniquePersons);
        console.log(`🔍 AI CFO: Sample company names:`, uniqueCompanies);
        console.log(`🔍 AI CFO: Total unique persons: ${uniquePersons.length}, Total unique companies: ${uniqueCompanies.length}`);
        
        // PRIORITIZE company name search over individual contact names
        console.log(`🔍 AI CFO: Searching in database - looking for company name first`);
        
        // First: Search by exact company name match
        let customerInvoices = allInvoices.filter(inv => 
          inv.contact?.companyName?.toLowerCase() === searchedCustomer.toLowerCase()
        );
        
        // Second: Search by partial company name match  
        if (customerInvoices.length === 0) {
          customerInvoices = allInvoices.filter(inv => 
            inv.contact?.companyName?.toLowerCase().includes(searchedCustomer.toLowerCase()) ||
            searchedCustomer.toLowerCase().includes(inv.contact?.companyName?.toLowerCase() || '')
          );
          console.log(`🔍 AI CFO: No exact company match, trying partial company name match...`);
        }
        
        // Third: Fallback to individual contact name search (only if no company matches)
        if (customerInvoices.length === 0) {
          customerInvoices = allInvoices.filter(inv => 
            inv.contact?.name?.toLowerCase() === searchedCustomer.toLowerCase() ||
            inv.contact?.name?.toLowerCase().includes(searchedCustomer.toLowerCase()) ||
            searchedCustomer.toLowerCase().includes(inv.contact?.name?.toLowerCase() || '')
          );
          console.log(`🔍 AI CFO: No company matches found, trying individual contact names as fallback...`);
        }
        
        if (customerInvoices.length > 0) {
          const totalOwed = customerInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
          
          // Filter for unpaid/outstanding invoices - case insensitive and multiple status check
          const outstandingInvoices = customerInvoices.filter(inv => 
            inv.status?.toLowerCase() !== 'paid' && 
            inv.status?.toLowerCase() !== 'completed'
          );
          const outstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
          
          // Debug invoice status breakdown
          const statusBreakdown = customerInvoices.reduce((acc, inv) => {
            acc[inv.status || 'unknown'] = (acc[inv.status || 'unknown'] || 0) + Number(inv.amount);
            return acc;
          }, {} as Record<string, number>);
          console.log(`🔍 AI CFO: Invoice status breakdown for ${searchedCustomer}:`, statusBreakdown);
          
          specificCustomerData = {
            customerName: customerInvoices[0].contact?.companyName || customerInvoices[0].contact?.name || searchedCustomer,
            totalInvoices: customerInvoices.length,
            totalAmount: totalOwed,
            outstandingAmount: outstandingAmount,
            invoiceDetails: outstandingInvoices.slice(0, 10).map(inv => ({
              invoiceNumber: inv.invoiceNumber,
              amount: Number(inv.amount),
              status: inv.status,
              daysPastDue: Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
            }))
          };
          
          console.log(`✅ AI CFO: Found ${customerInvoices.length} total invoices for ${searchedCustomer}`);
          console.log(`💰 AI CFO: Outstanding Balance: $${outstandingAmount} (${outstandingInvoices.length} unpaid invoices)`);
          console.log(`📊 AI CFO: Total Invoiced: $${totalOwed} (includes paid invoices)`);
        } else {
          console.log(`❌ AI CFO: No invoices found for "${searchedCustomer}"`);
        }
      }

      // Generate AI CFO response
      console.log(`🚀 AI CFO: Processing request for message: "${message}"`);
      console.log(`📊 AI CFO: AR Context - Outstanding: $${arContext.totalOutstanding}, Overdue: $${arContext.overdueAmount}`);
      console.log(`📋 AI CFO: Analyzing ${invoices.length} outstanding invoices from ${allInvoices.length} total invoices`);
      if (arContext.recentInvoices.length > 0) {
        console.log(`🏢 AI CFO: Top customers in analysis:`, arContext.recentInvoices.map(inv => `${inv.customerName}: $${inv.amount}`).join(', '));
      }
      const aiResponse = await generateAiCfoResponse(message, conversationHistory, {
        ...arContext,
        knowledgeBase: relevantFacts.map(fact => ({
          title: fact.title,
          content: fact.content,
          category: fact.category,
          priority: fact.priority || 0,
          source: fact.source || undefined
        }))
      }, specificCustomerData);
      console.log(`✅ AI CFO: Response generated, length: ${aiResponse.length}`);

      res.json({
        response: aiResponse,
        context: {
          totalOutstanding: arContext.totalOutstanding,
          overdueAmount: arContext.overdueAmount,
          collectionRate: arContext.collectionRate
        }
      });

    } catch (error: any) {
      console.error("Error in AI CFO chat:", error);
      res.status(500).json({ 
        error: 'Failed to generate AI CFO response',
        message: error.message 
      });
    }
  });

  app.get("/api/subscription/plans", isAuthenticated, async (req: any, res) => {
    try {
      const typeFilter = req.query.type as 'partner' | 'client' | undefined;
      const plans = await storage.getSubscriptionPlans(typeFilter);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  app.post("/api/subscription/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Only owners can manage subscriptions
      if (user.role !== 'owner') {
        return res.status(403).json({ message: "Access denied. Owner role required." });
      }

      const subscribeSchema = z.object({
        planId: z.string().min(1, "Plan ID is required"),
        stripeCustomerId: z.string().optional(),
      });

      const { planId, stripeCustomerId } = subscribeSchema.parse(req.body);

      // Check if tenant already has an active subscription
      const existingMetadata = await storage.getTenantMetadata(user.tenantId);
      if (existingMetadata?.stripeSubscriptionId) {
        return res.status(400).json({ 
          message: "Tenant already has an active subscription. Use upgrade-downgrade endpoint to change plans." 
        });
      }

      let finalStripeCustomerId = stripeCustomerId;
      if (!finalStripeCustomerId) {
        // Create Stripe customer if not provided
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          metadata: {
            tenantId: user.tenantId,
            userId: user.id,
          }
        });
        finalStripeCustomerId = customer.id;
      }

      const { subscription, metadata } = await subscriptionService.subscribeTenantToPlan(
        user.tenantId,
        planId,
        finalStripeCustomerId
      );

      res.json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: (subscription as any).current_period_start,
          currentPeriodEnd: (subscription as any).current_period_end,
        },
        metadata,
      });
    } catch (error) {
      console.error("Error subscribing tenant to plan:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to subscribe to plan" });
    }
  });

  app.get("/api/subscription/usage", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const metadata = await storage.getTenantMetadata(user.tenantId);
      if (!metadata || metadata.tenantType !== 'partner') {
        return res.status(400).json({ message: "Usage tracking only available for partner tenants" });
      }

      const usage = await subscriptionService.getPartnerUsage(user.tenantId);
      res.json(usage);
    } catch (error) {
      console.error("Error fetching partner usage:", error);
      res.status(500).json({ message: "Failed to fetch usage data" });
    }
  });

  app.post("/api/subscription/upgrade-downgrade", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Only owners can manage subscriptions
      if (user.role !== 'owner') {
        return res.status(403).json({ message: "Access denied. Owner role required." });
      }

      const changeSchema = z.object({
        newPlanId: z.string().min(1, "New plan ID is required"),
      });

      const { newPlanId } = changeSchema.parse(req.body);

      const { subscription, metadata } = await subscriptionService.changeSubscriptionPlan(
        user.tenantId,
        newPlanId
      );

      res.json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: (subscription as any).current_period_start,
          currentPeriodEnd: (subscription as any).current_period_end,
        },
        metadata,
      });
    } catch (error) {
      console.error("Error changing subscription plan:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to change subscription plan" });
    }
  });

  app.post("/api/subscription/update-partner-billing", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const metadata = await storage.getTenantMetadata(user.tenantId);
      if (!metadata || metadata.tenantType !== 'partner') {
        return res.status(400).json({ message: "Billing updates only available for partner tenants" });
      }

      await subscriptionService.updatePartnerBilling(user.tenantId);
      
      // Return updated usage info
      const usage = await subscriptionService.getPartnerUsage(user.tenantId);
      res.json({ success: true, usage });
    } catch (error) {
      console.error("Error updating partner billing:", error);
      res.status(500).json({ message: "Failed to update billing" });
    }
  });

  app.get("/api/subscription/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const metadata = await storage.getTenantMetadata(user.tenantId);
      if (!metadata) {
        return res.json({ 
          hasSubscription: false,
          tenantType: 'client',
          message: "No subscription found"
        });
      }

      const response = {
        hasSubscription: !!metadata.stripeSubscriptionId,
        tenantType: metadata.tenantType,
        subscriptionStatus: metadata.subscriptionStatus,
        subscriptionPlan: metadata.subscriptionPlan,
        isInTrial: metadata.isInTrial,
        currentClientCount: metadata.currentClientCount,
        currentMonthInvoices: metadata.currentMonthInvoices,
        subscriptionStartDate: metadata.subscriptionStartDate,
        subscriptionEndDate: metadata.subscriptionEndDate,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  app.post("/api/subscription/seed-plans", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      console.log("🌱 Seeding subscription plans...");

      // Check if plans already exist
      const existingPlans = await storage.getSubscriptionPlans();
      if (existingPlans.length > 0) {
        return res.status(400).json({ 
          message: "Subscription plans already exist",
          existingPlans: existingPlans.length 
        });
      }

      // Create Direct Customer Plan
      const clientPlan = await storage.createSubscriptionPlan({
        name: "Direct Customer Plan",
        type: "client",
        description: "Monthly subscription for direct customers with full access to collections automation and AR management.",
        monthlyPrice: "29.00",
        yearlyPrice: "290.00", // 10 months price for yearly
        currency: "GBP",
        maxClientTenants: 0, // Not applicable for client plans
        maxUsers: 5,
        maxInvoicesPerMonth: 1000,
        features: JSON.stringify([
          "collections_automation",
          "ai_insights",
          "payment_tracking",
          "customer_management",
          "basic_reporting",
          "email_reminders",
          "sms_notifications"
        ]),
        isActive: true,
      });

      // Create Partner Wholesale Plan
      const partnerPlan = await storage.createSubscriptionPlan({
        name: "Partner Wholesale Plan",
        type: "partner",
        description: "Per-client billing plan for accounting partners managing multiple client tenants.",
        monthlyPrice: "19.00",
        yearlyPrice: "190.00", // 10 months price for yearly
        currency: "GBP",
        maxClientTenants: 0, // Unlimited
        maxUsers: 20,
        maxInvoicesPerMonth: 5000,
        features: JSON.stringify([
          "collections_automation",
          "ai_insights",
          "payment_tracking",
          "customer_management",
          "advanced_reporting",
          "multi_tenant_management",
          "partner_dashboard",
          "client_billing",
          "white_label",
          "api_access",
          "email_reminders",
          "sms_notifications",
          "phone_automation"
        ]),
        isActive: true,
      });

      // Create Stripe products and prices for both plans
      const clientStripeData = await subscriptionService.createStripeProductsAndPrices(clientPlan);
      const partnerStripeData = await subscriptionService.createStripeProductsAndPrices(partnerPlan);

      // Update plans with Stripe IDs
      await storage.updateSubscriptionPlan(clientPlan.id, {
        stripeProductId: clientStripeData.productId,
        stripePriceId: clientStripeData.priceId,
      });

      await storage.updateSubscriptionPlan(partnerPlan.id, {
        stripeProductId: partnerStripeData.productId,
        stripePriceId: partnerStripeData.priceId,
      });

      const updatedClientPlan = await storage.getSubscriptionPlan(clientPlan.id);
      const updatedPartnerPlan = await storage.getSubscriptionPlan(partnerPlan.id);

      console.log("✅ Subscription plans seeded successfully");

      res.json({
        success: true,
        message: "Subscription plans created successfully",
        plans: {
          client: updatedClientPlan,
          partner: updatedPartnerPlan,
        },
        stripe: {
          client: clientStripeData,
          partner: partnerStripeData,
        }
      });
    } catch (error) {
      console.error("Error seeding subscription plans:", error);
      res.status(500).json({ message: "Failed to seed subscription plans", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/public/partner-waitlist", async (req, res) => {
    try {
      const bodySchema = z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        firmName: z.string().min(1),
        mobile: z.string().min(1),
        q1: z.string().min(1),
        q2: z.string().min(1),
        q3: z.string().min(1),
        q4: z.string().min(1),
        q5: z.string().min(1),
        otherText: z.string().optional(),
        sourcePath: z.string().optional(),
        website: z.string().optional(),
      });

      const data = bodySchema.parse(req.body);

      if (data.website && data.website.trim() !== "") {
        return res.status(400).json({ error: "Bot detected" });
      }

      await db.insert(partnerWaitlist).values({
        fullName: data.fullName,
        email: data.email,
        firmName: data.firmName,
        mobile: data.mobile,
        q1: data.q1,
        q2: data.q2,
        q3: data.q3,
        q4: data.q4,
        q5: data.q5,
        otherText: data.otherText || null,
        sourcePath: data.sourcePath || "/founding-partners",
      });

      console.log(`[waitlist] new application: ${data.email} — ${data.firmName}`);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid form data", issues: error.errors });
      }
      console.error("[waitlist] Error saving application:", error);
      res.status(500).json({ error: "Failed to save application" });
    }
  });
}
