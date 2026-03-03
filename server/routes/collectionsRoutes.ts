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
  emailMessages, customerContactPersons, scheduledReports,
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

import { intentAnalyst } from "../services/intentAnalyst";

const actionItemQuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'snoozed', 'canceled']).optional(),
  assignedToUserId: z.string().optional(),
  type: z.enum(['nudge', 'call', 'email', 'sms', 'review', 'dispute', 'ptp_followup']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number),
  useSmartPriority: z.string().optional().default('false').transform(str => str === 'true'),
  queueType: z.enum(['today', 'due', 'overdue', 'serious', 'escalation']).optional().default('today'),
  sortBy: z.enum(['priority', 'dueDate', 'amount', 'risk', 'smart']).optional().default('smart'),
});
const bulkActionSchema = z.object({
  actionItemIds: z.array(z.string()).min(1, 'At least one action item is required'),
  assignedToUserId: z.string().optional(),
  outcome: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional()
});
const bulkNudgeSchema = z.object({
  actionItemIds: z.array(z.string()).min(1, 'At least one action item is required'),
  templateId: z.string().optional(),
  customMessage: z.string().optional()
});
const generateResponseSchema = z.object({
  message: z.string().min(1, "Message is required"),
  intent: z.string().optional(),
  sentiment: z.string().optional(),
  channel: z.string().min(1, "Channel is required")
});
const respondToQuerySchema = z.object({
  response: z.string().min(1, "Response is required"),
  channel: z.string().min(1, "Channel is required")
});
const generateOutboundSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  actionType: z.enum(['email', 'sms', 'voice']),
  totalOutstanding: z.number().positive("Total outstanding must be positive"),
  daysOverdue: z.number().nonnegative("Days overdue must be non-negative"),
  stage: z.enum(['overdue', 'debt_recovery', 'enforcement']),
  invoices: z.array(z.object({
    id: z.string(),
    invoiceNumber: z.string(),
    amount: z.string(),
    dueDate: z.string()
  })).min(1, "At least one invoice is required")
});
const sendActionSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  actionType: z.enum(['email', 'sms', 'voice']),
  content: z.string().min(1, "Content is required"),
  invoices: z.array(z.object({
    id: z.string(),
    invoiceNumber: z.string().optional(),
    amount: z.string().optional(),
    dueDate: z.string().optional()
  })).min(1, "At least one invoice is required")
});
const escalateCustomerSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  invoiceIds: z.array(z.string()).min(1, "At least one invoice ID is required"),
  currentStage: z.enum(['overdue', 'debt_recovery', 'enforcement']),
  nextStage: z.enum(['overdue', 'debt_recovery', 'enforcement'])
});
const nudgeInvoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required")
});

export function registerCollectionsRoutes(app: Express): void {
  app.get("/api/actions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      const statusFilter = req.query.status as string | undefined;
      let actionsData = await storage.getActions(user.tenantId, limit);
      
      // Filter by status if provided
      if (statusFilter) {
        actionsData = actionsData.filter(action => action.status === statusFilter);
      }
      
      // Enrich actions with contact and invoice info
      const enrichedActions = await Promise.all(
        actionsData.map(async (action) => {
          let companyName = null;
          let contactName = null;
          let invoiceNumber = null;
          let invoiceAmount = null;
          
          // Check if contact name is stored in metadata first (for historical accuracy)
          const metadata = action.metadata as Record<string, any> | null;
          if (metadata?.storedContactName) {
            contactName = metadata.storedContactName;
          }
          
          // Get contact info
          if (action.contactId) {
            try {
              const contact = await storage.getContact(action.contactId, user.tenantId);
              if (contact) {
                companyName = contact.companyName || null;
                // Only use dynamic contact name if not stored in metadata
                if (!contactName) {
                  // Use primary credit contact if available, otherwise fall back to contact.name
                  contactName = (contact as any).primaryCreditContact?.name || contact.name || null;
                }
              }
            } catch (e) {
              // Contact not found, skip
            }
          }
          
          // Get invoice info
          if (action.invoiceId) {
            try {
              const invoice = await storage.getInvoice(action.invoiceId, user.tenantId);
              if (invoice) {
                invoiceNumber = invoice.invoiceNumber;
                invoiceAmount = invoice.amount;
              }
            } catch (e) {
              // Invoice not found, skip
            }
          }
          
          return {
            ...action,
            companyName,
            contactName,
            invoiceNumber,
            invoiceAmount
          };
        })
      );
      
      res.json(enrichedActions);
    } catch (error) {
      console.error("Error fetching actions:", error);
      res.status(500).json({ message: "Failed to fetch actions" });
    }
  });

  app.get("/api/actions/all", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const {
        search = '',
        contactId = '',
        page = '1',
        limit = '20'
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Get all actions
      const allActions = await storage.getActions(user.tenantId);
      
      // Filter by search query (search in subject, content, contact name)
      let filteredActions = allActions;
      
      // Enrich with contact and invoice info first (needed for search)
      const enrichedActions = await Promise.all(
        filteredActions.map(async (action) => {
          let companyName = null;
          let contactName = null;
          let invoiceNumber = null;
          let invoiceAmount = null;
          
          if (action.contactId) {
            try {
              const contact = await storage.getContact(action.contactId, user.tenantId);
              if (contact) {
                companyName = contact.companyName || null;
                contactName = contact.name || null;
              }
            } catch (e) {
              // Contact not found
            }
          }
          
          if (action.invoiceId) {
            try {
              const invoice = await storage.getInvoice(action.invoiceId, user.tenantId);
              if (invoice) {
                invoiceNumber = invoice.invoiceNumber;
                invoiceAmount = invoice.amount;
              }
            } catch (e) {
              // Invoice not found
            }
          }
          
          return {
            ...action,
            companyName,
            contactName,
            invoiceNumber,
            invoiceAmount
          };
        })
      );

      // Apply customer filter (contactId param may contain either companyName or contactName)
      let filteredByCustomer = enrichedActions;
      if (contactId) {
        filteredByCustomer = enrichedActions.filter(action => 
          action.companyName === contactId || action.contactName === contactId
        );
      }

      // Apply search filter
      let searchedActions = filteredByCustomer;
      if (search) {
        const searchLower = search.toLowerCase();
        searchedActions = filteredByCustomer.filter(action => 
          action.subject?.toLowerCase().includes(searchLower) ||
          action.content?.toLowerCase().includes(searchLower) ||
          action.companyName?.toLowerCase().includes(searchLower) ||
          action.contactName?.toLowerCase().includes(searchLower) ||
          action.invoiceNumber?.toLowerCase().includes(searchLower)
        );
      }

      // Sort by date (newest first)
      const sortedActions = searchedActions.sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      // Paginate
      const paginatedActions = sortedActions.slice(offset, offset + limitNum);
      
      res.json({
        actions: paginatedActions,
        total: sortedActions.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(sortedActions.length / limitNum)
      });
    } catch (error) {
      console.error("Error fetching paginated actions:", error);
      res.status(500).json({ message: "Failed to fetch actions" });
    }
  });

  app.post("/api/actions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const actionData = insertActionSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
        userId: user.id,
      });

      const action = await storage.createAction(actionData);
      
      // Broadcast real-time update
      const wsService = (req.app as any).websocketService;
      if (wsService) {
        wsService.broadcastActionCreated(user.tenantId, action.id);
      }
      
      res.status(201).json(action);
    } catch (error) {
      console.error("Error creating action:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid action data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create action" });
    }
  });

  app.post("/api/action-centre/generate-outbound", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate request body
      const validatedData = generateOutboundSchema.parse(req.body);
      const { contactId, actionType, totalOutstanding, daysOverdue, stage, invoices } = validatedData;

      // Get contact details
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Use OpenAI to generate outbound content
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const invoiceList = invoices.map((inv: any) => 
        `${inv.invoiceNumber} - £${inv.amount} (Due: ${new Date(inv.dueDate).toLocaleDateString()})`
      ).join('\n');

      let systemPrompt = '';
      let userPrompt = '';

      if (actionType === 'email') {
        systemPrompt = `You are a professional accounts receivable specialist drafting collection emails.
Generate a professional, firm but polite collection email.

Context:
- Customer: ${contact.companyName || contact.name}
- Total Outstanding: £${totalOutstanding}
- Days Overdue: ${daysOverdue}
- Collection Stage: ${stage.replace('_', ' ')}
- Invoices:\n${invoiceList}

Guidelines:
- Be professional and direct
- Clearly state the outstanding amount and overdue period
- List all outstanding invoices
- Include a clear call-to-action (payment deadline, contact request)
- Tone should escalate based on stage: overdue (polite reminder), debt_recovery (firm), enforcement (final notice)
- Include professional sign-off
- DO NOT include subject line or greeting, just the body`;

        userPrompt = `Draft a ${stage.replace('_', ' ')} collection email for this customer.`;
      } else if (actionType === 'sms') {
        systemPrompt = `You are drafting a concise SMS collection message.
Generate a brief, professional SMS (max 160 characters).

Context:
- Customer: ${contact.companyName || contact.name}
- Total Outstanding: £${totalOutstanding}
- Days Overdue: ${daysOverdue}
- Collection Stage: ${stage.replace('_', ' ')}

Guidelines:
- Keep it under 160 characters
- Be direct and clear
- Include amount and urgency
- Professional tone matching the stage severity`;

        userPrompt = `Draft a ${stage.replace('_', ' ')} SMS collection message.`;
      } else if (actionType === 'voice') {
        systemPrompt = `You are creating a call script for an AI voice agent making collection calls.
Generate a clear, professional call script.

Context:
- Customer: ${contact.companyName || contact.name}
- Total Outstanding: £${totalOutstanding}
- Days Overdue: ${daysOverdue}
- Collection Stage: ${stage.replace('_', ' ')}
- Invoices:\n${invoiceList}

Guidelines:
- Start with a friendly greeting
- Clearly identify yourself and purpose
- State the outstanding balance
- Ask for payment commitment
- Handle objections professionally
- End with clear next steps
- Tone should match the collection stage`;

        userPrompt = `Create a ${stage.replace('_', ' ')} collection call script.`;
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: actionType === 'sms' ? 100 : 500,
      });

      const draftContent = completion.choices[0].message.content || "";

      res.json({ draftContent });
    } catch (error) {
      console.error("Error generating outbound content:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate content" });
    }
  });

  app.post("/api/action-centre/send-action", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate request body
      const validatedData = sendActionSchema.parse(req.body);
      const { contactId, actionType, content, invoices } = validatedData;

      // Create action record for each invoice (or one bundled action)
      const action = await storage.createAction({
        tenantId: user.tenantId,
        userId: user.id,
        contactId,
        invoiceId: invoices[0]?.id || null,
        type: actionType,
        status: 'completed',
        priority: 'high',
        subject: `Collection ${actionType} - ${invoices.length} invoice(s)`,
        content,
        metadata: {
          direction: 'outbound',
          invoiceIds: invoices.map((inv: any) => inv.id),
          bundledCount: invoices.length,
        }
      });

      // TODO: Actually send via the appropriate channel (email/SMS/voice)
      // For now, we just create the action record
      
      // Broadcast real-time update
      const wsService = (req.app as any).websocketService;
      if (wsService) {
        wsService.broadcastActionCompleted(user.tenantId, action.id, actionType);
      }

      res.json({ 
        success: true, 
        action,
        message: "Action sent successfully" 
      });
    } catch (error) {
      console.error("Error sending action:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to send action" });
    }
  });

  app.post("/api/action-centre/escalate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate request body
      const validatedData = escalateCustomerSchema.parse(req.body);
      const { contactId, invoiceIds, currentStage, nextStage } = validatedData;

      // Validate escalation path
      const validEscalations: Record<string, string> = {
        'overdue': 'debt_recovery',
        'debt_recovery': 'enforcement',
      };

      if (validEscalations[currentStage] !== nextStage) {
        return res.status(400).json({ 
          message: `Invalid escalation path: ${currentStage} -> ${nextStage}` 
        });
      }

      // Update all invoices to next stage
      await Promise.all(
        invoiceIds.map((invoiceId: string) =>
          storage.updateInvoice(invoiceId, user.tenantId, { stage: nextStage })
        )
      );

      // Create escalation action record
      await storage.createAction({
        tenantId: user.tenantId,
        userId: user.id,
        contactId,
        invoiceId: invoiceIds[0] || null,
        type: 'escalation',
        status: 'completed',
        priority: 'high',
        subject: `Escalated to ${nextStage.replace('_', ' ')}`,
        content: `Customer escalated from ${currentStage} to ${nextStage} stage`,
        metadata: {
          escalation: {
            from: currentStage,
            to: nextStage,
            invoiceIds,
            escalatedAt: new Date().toISOString(),
          }
        }
      });

      res.json({ 
        success: true, 
        message: `Customer escalated to ${nextStage}` 
      });
    } catch (error) {
      console.error("Error escalating customer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to escalate customer" });
    }
  });

  app.get("/api/action-centre/tabs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenantId = user.tenantId;
      // Normalize today to UTC midnight for timezone-safe comparisons
      // This ensures invoices due today are in "Due" not "Overdue" regardless of server timezone
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      
      // Get actions with smart filtering for performance
      // Load ALL OPEN actions with active intents, plus recent actions (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const allActions = await db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, tenantId),
            or(
              // Include ALL OPEN actions with general_query, promise_to_pay, or dispute intent
              and(
                eq(actions.status, 'open'),
                or(
                  eq(actions.intentType, 'general_query'),
                  eq(actions.intentType, 'promise_to_pay'),
                  eq(actions.intentType, 'dispute')
                )
              ),
              // Or recent actions (last 90 days) regardless of intent/status
              gte(actions.createdAt, ninetyDaysAgo)
            )
          )
        )
        .orderBy(desc(actions.createdAt));
        
      const allInvoices = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            or(
              // Include ALL overdue, unpaid, and outstanding invoices (active work items)
              eq(invoices.status, 'overdue'),
              eq(invoices.status, 'unpaid'),
              eq(invoices.status, 'outstanding'),
              // Or recently paid invoices (last 90 days)
              and(
                eq(invoices.status, 'paid'),
                gte(invoices.paidDate, ninetyDaysAgo)
              )
            )
          )
        )
        .orderBy(desc(invoices.dueDate));
      
      // Get pending payment promises for forecast
      const pendingPromises = await db
        .select()
        .from(paymentPromises)
        .where(
          and(
            eq(paymentPromises.tenantId, tenantId),
            eq(paymentPromises.status, 'pending'),
            gte(paymentPromises.promisedDate, today)
          )
        )
        .orderBy(paymentPromises.promisedDate);
      
      // Build a map of contactId -> array of pending promises with dates and amounts
      const contactPromisesMap = new Map<string, Array<{ date: Date; amount: number; invoiceId: string }>>();
      for (const promise of pendingPromises) {
        if (promise.contactId && promise.promisedDate) {
          if (!contactPromisesMap.has(promise.contactId)) {
            contactPromisesMap.set(promise.contactId, []);
          }
          contactPromisesMap.get(promise.contactId)!.push({
            date: new Date(promise.promisedDate),
            amount: parseFloat(String(promise.promisedAmount || 0)),
            invoiceId: promise.invoiceId || ''
          });
        }
      }
      // Also keep the old single-date map for backward compatibility
      const contactPtpMap = new Map<string, Date>();
      for (const promise of pendingPromises) {
        if (promise.contactId && !contactPtpMap.has(promise.contactId)) {
          contactPtpMap.set(promise.contactId, new Date(promise.promisedDate!));
        }
      }
      
      // Get formal disputes from debtor portal (needed for filtering)
      const formalDisputes = await db
        .select({
          dispute: disputes,
          invoice: invoices,
          contact: contacts
        })
        .from(disputes)
        .leftJoin(invoices, eq(disputes.invoiceId, invoices.id))
        .leftJoin(contacts, eq(invoices.contactId, contacts.id))
        .where(eq(disputes.tenantId, tenantId))
        .orderBy(desc(disputes.createdAt));
      
      // Get all invoice IDs that have active disputes from the disputes table
      const invoiceIdsWithDisputes = formalDisputes
        .filter(({ dispute }) => dispute.status !== 'resolved')
        .map(({ dispute }) => dispute.invoiceId);
      
      // 0. COMPLETED - actions that AI has executed (completed/sent outbound actions)
      // Support date range filtering: yesterday, week, month (defaults to week for backward compat)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const completedActionsRaw = allActions.filter(a => {
        const isCompleted = a.status === 'completed' || a.status === 'sent';
        const isOutbound = a.metadata?.direction === 'outbound' || !a.metadata?.direction;
        const isRecent = a.completedAt ? new Date(a.completedAt) >= thirtyDaysAgo : 
                         a.createdAt ? new Date(a.createdAt) >= thirtyDaysAgo : false;
        const isActionable = a.type === 'email' || a.type === 'sms' || a.type === 'call' || a.type === 'voice';
        return isCompleted && isOutbound && isRecent && isActionable;
      });
      
      // Helper to get date cutoffs
      const getDateCutoff = (range: 'yesterday' | 'week' | 'month') => {
        const cutoff = new Date();
        if (range === 'yesterday') {
          cutoff.setDate(cutoff.getDate() - 1);
          cutoff.setHours(0, 0, 0, 0);
        } else if (range === 'week') {
          cutoff.setDate(cutoff.getDate() - 7);
        } else {
          cutoff.setDate(cutoff.getDate() - 30);
        }
        return cutoff;
      };
      
      // Calculate metrics for each date range
      const calculateCompletedMetrics = (actions: typeof completedActionsRaw) => {
        const emailActions = actions.filter(a => a.type === 'email');
        const smsActions = actions.filter(a => a.type === 'sms');
        const voiceActions = actions.filter(a => a.type === 'call' || a.type === 'voice');
        
        // Count PTPs (promise to pay outcomes)
        const ptpActions = actions.filter(a => 
          a.intentType === 'promise_to_pay' || 
          a.metadata?.outcome === 'promise_to_pay' ||
          a.metadata?.outcome === 'ptp'
        );
        
        // Calculate commitment amounts from PTPs
        const commitmentAmount = ptpActions.reduce((sum, a) => {
          const amount = parseFloat(a.metadata?.ptpAmount || a.metadata?.amount || '0');
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
        
        // Unique customers contacted
        const uniqueCustomers = new Set(actions.map(a => a.contactId).filter(Boolean)).size;
        
        // Voice answered rate
        const voiceAnswered = voiceActions.filter(a => 
          a.metadata?.outcome === 'answered' || 
          a.metadata?.callStatus === 'completed' ||
          a.metadata?.answered === true
        ).length;
        
        // Calculate SMS delivery rate
        const smsDelivered = smsActions.filter(a => a.status === 'sent' || a.status === 'completed').length;
        const smsDeliveryRate = smsActions.length > 0 ? Math.round((smsDelivered / smsActions.length) * 100) : 100;
        
        return {
          actions: actions.length,
          actionsChange: '—', // Will be calculated by comparing periods
          emailCount: emailActions.length,
          smsCount: smsActions.length,
          voiceCount: voiceActions.length,
          voiceAnswered,
          ptpCount: ptpActions.length,
          commitments: Math.round(commitmentAmount),
          customers: uniqueCustomers,
          coverage: uniqueCustomers > 0 ? `${Math.min(100, Math.round((uniqueCustomers / Math.max(1, allInvoices.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue').length)) * 100))}%` : '0%',
          responseRate: actions.length > 0 ? Math.round((ptpActions.length / actions.length) * 100) : 0,
          responseChange: '—', // Will be calculated by comparing periods
          emailOpen: emailActions.length > 0 ? `${Math.round(emailActions.filter(a => a.metadata?.opened).length / emailActions.length * 100)}%` : '0%',
          smsDelivery: `${smsDeliveryRate}%`
        };
      };
      
      // Get metrics for each period
      const yesterdayCutoff = getDateCutoff('yesterday');
      const weekCutoff = getDateCutoff('week');
      const monthCutoff = getDateCutoff('month');
      
      // Calculate end of yesterday (23:59:59.999)
      const yesterdayEnd = new Date(yesterdayCutoff);
      yesterdayEnd.setHours(23, 59, 59, 999);
      
      const yesterdayActions = completedActionsRaw.filter(a => {
        const actionDate = a.completedAt ? new Date(a.completedAt) : new Date(a.createdAt);
        return actionDate >= yesterdayCutoff && actionDate <= yesterdayEnd;
      });
      const weekActions = completedActionsRaw.filter(a => {
        const actionDate = a.completedAt ? new Date(a.completedAt) : new Date(a.createdAt);
        return actionDate >= weekCutoff;
      });
      const monthActions = completedActionsRaw.filter(a => {
        const actionDate = a.completedAt ? new Date(a.completedAt) : new Date(a.createdAt);
        return actionDate >= monthCutoff;
      });
      
      const completedMetrics = {
        yesterday: calculateCompletedMetrics(yesterdayActions),
        week: calculateCompletedMetrics(weekActions),
        month: calculateCompletedMetrics(monthActions)
      };
      
      // Enrich completed actions with contact/invoice info and format for frontend
      const completedActions = await Promise.all(completedActionsRaw.map(async (action) => {
        let companyName = '';
        let contactName = '';
        let invoiceNumber = '';
        let invoiceAmount = '0';
        
        if (action.contactId) {
          try {
            const contact = await storage.getContact(action.contactId, tenantId);
            if (contact) {
              companyName = contact.companyName || '';
              contactName = contact.name || '';
            }
          } catch (e) {}
        }
        
        if (action.invoiceId) {
          const invoice = allInvoices.find(inv => inv.id === action.invoiceId);
          if (invoice) {
            invoiceNumber = invoice.invoiceNumber || '';
            invoiceAmount = invoice.amount || '0';
          }
        }
        
        // Determine outcome label
        let outcome = 'Delivered';
        if (action.intentType === 'promise_to_pay' || action.metadata?.outcome === 'promise_to_pay') {
          outcome = 'Promise to pay';
        } else if (action.intentType === 'dispute' || action.metadata?.outcome === 'dispute') {
          outcome = 'Dispute';
        } else if (action.metadata?.opened) {
          outcome = 'Opened';
        }
        
        const actionDate = action.completedAt ? new Date(action.completedAt) : new Date(action.createdAt);
        
        return {
          ...action,
          companyName,
          contactName,
          invoiceNumber,
          invoiceAmount,
          // Formatted fields for UI
          formattedDate: actionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          formattedTime: actionDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          outcome,
          outcomeAmount: outcome === 'Promise to pay' ? parseFloat(invoiceAmount) : null,
          channel: action.type === 'call' ? 'voice' : action.type
        };
      }));
      
      // Sort by most recent first
      completedActions.sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt) : new Date(a.createdAt);
        const dateB = b.completedAt ? new Date(b.completedAt) : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      
      // 0.5. EXCEPTIONS - actions flagged for human review
      const exceptionsRaw = allActions.filter(a => {
        return a.status === 'exception' || 
               (a.exceptionReason && a.status !== 'completed' && a.status !== 'sent' && a.status !== 'cancelled');
      });
      
      const exceptions = await Promise.all(exceptionsRaw.map(async (action) => {
        let companyName = '';
        let contactName = '';
        let invoiceNumber = '';
        let invoiceAmount = '0';
        
        if (action.contactId) {
          try {
            const contact = await storage.getContact(action.contactId, tenantId);
            if (contact) {
              companyName = contact.companyName || '';
              contactName = contact.name || '';
            }
          } catch (e) {}
        }
        
        if (action.invoiceId) {
          const invoice = allInvoices.find(inv => inv.id === action.invoiceId);
          if (invoice) {
            invoiceNumber = invoice.invoiceNumber || '';
            invoiceAmount = invoice.amount || '0';
          }
        }
        
        return {
          ...action,
          companyName,
          contactName,
          invoiceNumber,
          invoiceAmount
        };
      }));
      
      // 1. QUERIES - actions with general_query intent
      const queries = allActions.filter(a => a.intentType === 'general_query');
      
      // Helper function to enrich invoice with contact info
      const enrichInvoice = async (inv: any) => {
        let companyName = '';
        let contactName = '';
        try {
          const contact = await storage.getContact(inv.contactId, tenantId);
          if (contact) {
            companyName = contact.companyName || '';
            contactName = contact.name || '';
          }
        } catch (e) {
          // Contact not found
        }
        return { ...inv, companyName, contactName };
      };
      
      // 2. OVERDUE INVOICES - grouped by customer (stage = 'overdue')
      // No longer filter out PTPs, disputes, etc. - let frontend exception filters handle that
      const overdueInvoicesRaw = allInvoices.filter(inv => {
        const isOverdue = inv.status === 'overdue' && new Date(inv.dueDate) < today;
        const isOverdueStage = !inv.stage || inv.stage === 'overdue';
        
        return isOverdue && isOverdueStage;
      });
      
      // Group overdue invoices by customer
      const customerGroups = new Map<string, any>();
      
      for (const invoice of overdueInvoicesRaw) {
        const contactId = invoice.contactId;
        
        if (!customerGroups.has(contactId)) {
          // Get contact info
          let companyName = '';
          let contactName = '';
          let contact = null;
          try {
            contact = await storage.getContact(contactId, tenantId);
            if (contact) {
              companyName = contact.companyName || '';
              contactName = contact.name || '';
            }
          } catch (e) {
            // Contact not found
          }
          
          // Find last payment date (most recent paid invoice)
          const contactInvoices = allInvoices.filter(inv => inv.contactId === contactId);
          const paidInvoices = contactInvoices.filter(inv => inv.status === 'paid' && inv.paidDate);
          let lastPaymentDate: string | null = null;
          if (paidInvoices.length > 0) {
            const sortedPaid = paidInvoices.sort((a, b) => 
              new Date(b.paidDate!).getTime() - new Date(a.paidDate!).getTime()
            );
            lastPaymentDate = sortedPaid[0].paidDate!;
          }
          
          // Find last contact date (most recent outbound action)
          const contactActions = allActions.filter(action => 
            action.contactId === contactId && 
            action.metadata?.direction === 'outbound' &&
            (action.type === 'email' || action.type === 'sms' || action.type === 'call')
          );
          let lastContactDate: string | null = null;
          if (contactActions.length > 0) {
            const sortedActions = contactActions.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            lastContactDate = sortedActions[0].createdAt;
          }
          
          // Calculate payment trend (last 3 months)
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          const recentPaidInvoices = paidInvoices.filter(inv => 
            inv.paidDate && new Date(inv.paidDate) >= threeMonthsAgo
          );
          const recentOverdueCount = contactInvoices.filter(inv => 
            inv.status === 'overdue'
          ).length;
          
          let paymentTrend: 'improving' | 'stable' | 'declining' = 'stable';
          if (recentPaidInvoices.length >= 2 && recentOverdueCount === 0) {
            paymentTrend = 'improving';
          } else if (recentOverdueCount > 2 || (recentPaidInvoices.length === 0 && recentOverdueCount > 0)) {
            paymentTrend = 'declining';
          }
          
          // Determine next action based on last contact
          let nextAction = 'Email';
          const daysSinceLastContact = lastContactDate 
            ? Math.floor((today.getTime() - new Date(lastContactDate).getTime()) / (1000 * 3600 * 24))
            : 999;
          
          if (daysSinceLastContact > 14) {
            nextAction = 'Call';
          } else if (daysSinceLastContact > 7) {
            nextAction = 'SMS';
          }
          
          // Find assigned user (most recent action creator/assignee for this customer)
          let assignedToUserId: string | null = null;
          let assignedToUserName: string | null = null;
          
          const recentActions = contactActions.slice(0, 5); // Check last 5 actions
          for (const action of recentActions) {
            if (action.userId) {
              assignedToUserId = action.userId;
              try {
                const user = await storage.getUser(assignedToUserId);
                if (user) {
                  assignedToUserName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
                }
              } catch (e) {
                // User not found
              }
              break; // Use the most recent action's user
            }
          }
          
          customerGroups.set(contactId, {
            contactId,
            companyName,
            contactName,
            contact, // Include full contact for dialog
            totalOutstanding: 0,
            invoiceCount: 0,
            invoices: [],
            oldestDueDate: invoice.dueDate,
            escalationFlag: false,
            legalFlag: false,
            lastPaymentDate,
            lastContactDate,
            paymentTrend,
            nextAction,
            assignedToUserId,
            assignedToUserName,
          });
        }
        
        const group = customerGroups.get(contactId);
        group.totalOutstanding += parseFloat(invoice.amount || '0');
        group.invoiceCount += 1;
        group.invoices.push(invoice);
        
        // Track oldest due date
        if (new Date(invoice.dueDate) < new Date(group.oldestDueDate)) {
          group.oldestDueDate = invoice.dueDate;
        }
        
        // Inherit severity flags
        if (invoice.escalationFlag) group.escalationFlag = true;
        if (invoice.legalFlag) group.legalFlag = true;
      }
      
      const overdueCustomers = Array.from(customerGroups.values());
      
      // 3. UPCOMING PTP - promise_to_pay with future dates (enriched with invoice & customer data)
      const upcomingPTPRaw = allActions.filter(a => {
        if (a.intentType !== 'promise_to_pay') return false;
        const promisedDate = a.metadata?.analysis?.entities?.dates?.[0];
        if (!promisedDate) return false;
        return new Date(promisedDate) >= today;
      });
      
      const upcomingPTP = await Promise.all(upcomingPTPRaw.map(async (action) => {
        const promisedDate = action.metadata?.analysis?.entities?.dates?.[0];
        const promisedAmount = action.metadata?.analysis?.entities?.amounts?.[0] || null;
        
        // Get invoice details
        let invoice = null;
        let companyName = '';
        let contactName = '';
        if (action.invoiceId) {
          invoice = allInvoices.find(inv => inv.id === action.invoiceId);
          if (invoice?.contactId) {
            try {
              const contact = await storage.getContact(invoice.contactId, tenantId);
              if (contact) {
                companyName = contact.companyName || '';
                contactName = contact.name || '';
              }
            } catch (e) {
              // Contact not found
            }
          }
        }
        
        // Calculate days until promised date
        const daysUntil = Math.ceil((new Date(promisedDate).getTime() - today.getTime()) / (1000 * 3600 * 24));
        
        // Determine source
        let source = 'Manual';
        if (action.metadata?.direction === 'inbound') {
          if (action.type === 'email') source = 'Inbound Email';
          else if (action.type === 'sms') source = 'Inbound SMS';
          else if (action.type === 'call') source = 'Voice Call';
        }
        
        // Get confidence (only for AI-detected PTPs)
        const confidence = action.intentConfidence || null;
        
        return {
          ...action,
          companyName,
          contactName,
          invoiceNumber: invoice?.invoiceNumber || 'N/A',
          invoiceAmount: invoice?.amount || '0',
          promisedDate,
          promisedAmount,
          daysUntil,
          source,
          confidence
        };
      }));
      
      // 4. BROKEN PROMISES - PTP with past dates + invoice still unpaid
      const brokenPromises = allActions.filter(a => {
        if (a.intentType !== 'promise_to_pay' || !a.invoiceId) return false;
        const promisedDate = a.metadata?.analysis?.entities?.dates?.[0];
        if (!promisedDate || new Date(promisedDate) >= today) return false;
        
        const invoice = allInvoices.find(inv => inv.id === a.invoiceId);
        return invoice && invoice.status === 'overdue';
      });
      
      // 5. DISPUTES - both actions with dispute intent AND formal disputes from debtor portal
      const disputeActions = allActions.filter(a => a.intentType === 'dispute');
      
      // Transform formal disputes to match action format for display (formalDisputes already fetched above)
      const transformedDisputes = formalDisputes.map(({ dispute, invoice, contact }) => ({
        id: dispute.id,
        tenantId: dispute.tenantId,
        invoiceId: dispute.invoiceId,
        contactId: invoice?.contactId || null,
        userId: null,
        type: 'dispute',
        status: dispute.status,
        subject: `Dispute: ${dispute.reason}`,
        content: dispute.description,
        scheduledFor: null,
        completedAt: dispute.status === 'resolved' ? dispute.updatedAt : null,
        metadata: {
          disputeId: dispute.id,
          reason: dispute.reason,
          responseNotes: dispute.responseNotes,
          respondedAt: dispute.respondedAt,
          respondedBy: dispute.respondedBy
        },
        intentType: 'dispute',
        intentConfidence: '1.00',
        sentiment: 'negative',
        hasResponse: !!dispute.respondedAt,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt,
        companyName: contact?.companyName || '',
        contactName: contact?.name || '',
        invoiceNumber: invoice?.invoiceNumber || 'N/A',
        invoiceAmount: invoice?.amount || '0'
      }));
      
      // Combine both types of disputes
      const allDisputes = [...disputeActions, ...transformedDisputes];
      
      // 6. ON HOLD - invoices with active PTP, Payment Plan, or Dispute (paused from dunning)
      const onHoldRaw = allInvoices.filter(inv => {
        const isOverdueOrUnpaid = inv.status === 'overdue' || inv.status === 'unpaid';
        const hasPaymentPlan = inv.outcomeOverride === 'Plan';
        const hasActionDispute = allActions.some(a => a.invoiceId === inv.id && a.intentType === 'dispute' && a.status === 'open');
        const hasFormalDispute = invoiceIdsWithDisputes.includes(inv.id);
        const hasDispute = hasActionDispute || hasFormalDispute;
        const hasPTP = allActions.some(a => a.invoiceId === inv.id && a.intentType === 'promise_to_pay');
        
        return isOverdueOrUnpaid && (hasPaymentPlan || hasDispute || hasPTP);
      });
      
      const onHold = await Promise.all(onHoldRaw.map(async (inv) => {
        const enriched = await enrichInvoice(inv);
        
        // Determine why it's on hold
        const hasPaymentPlan = inv.outcomeOverride === 'Plan';
        const hasActionDispute = allActions.some(a => a.invoiceId === inv.id && a.intentType === 'dispute' && a.status === 'open');
        const hasFormalDispute = invoiceIdsWithDisputes.includes(inv.id);
        const hasDispute = hasActionDispute || hasFormalDispute;
        const hasPTP = allActions.some(a => a.invoiceId === inv.id && a.intentType === 'promise_to_pay');
        
        let holdReason = '';
        if (hasPaymentPlan) holdReason = 'Payment Plan';
        else if (hasDispute) holdReason = 'Dispute';
        else if (hasPTP) holdReason = 'Promise to Pay';
        
        return { ...enriched, holdReason };
      }));
      
      // 7. PAYMENT PLANS - invoices with active payment plans
      const paymentPlansRaw = allInvoices.filter(inv => inv.outcomeOverride === 'Plan');
      const paymentPlansItems = await Promise.all(paymentPlansRaw.map(enrichInvoice));
      
      // 8. DEBT RECOVERY - invoices with stage = 'debt_recovery'
      const debtRecoveryRaw = allInvoices.filter(inv => inv.stage === 'debt_recovery');
      const debtRecovery = await Promise.all(debtRecoveryRaw.map(enrichInvoice));
      
      // 9. ENFORCEMENT - invoices with stage = 'enforcement'
      const enforcementRaw = allInvoices.filter(inv => inv.stage === 'enforcement');
      const enforcement = await Promise.all(enforcementRaw.map(enrichInvoice));
      
      // ========== PRECEDENCE-BASED INVOICE CATEGORIZATION ==========
      // Each invoice appears in exactly ONE tab based on precedence:
      // Recovery > Disputes > Queries > Broken > Promises > VIP > Overdue > Due
      
      // Get all unpaid invoices (includes various unpaid statuses)
      const unpaidInvoices = allInvoices.filter(inv => 
        inv.status === 'unpaid' || inv.status === 'overdue' || inv.status === 'outstanding'
      );
      
      // Get invoice IDs for each category (for precedence checks)
      const recoveryInvoiceIds = new Set(
        unpaidInvoices.filter(inv => inv.stage === 'debt_recovery' || inv.stage === 'enforcement').map(inv => inv.id)
      );
      
      const disputeInvoiceIds = new Set([
        ...invoiceIdsWithDisputes,
        ...allActions.filter(a => a.intentType === 'dispute' && a.status === 'open' && a.invoiceId).map(a => a.invoiceId)
      ]);
      
      const queryInvoiceIds = new Set(
        allActions.filter(a => a.intentType === 'general_query' && a.status === 'open' && a.invoiceId).map(a => a.invoiceId)
      );
      
      const brokenInvoiceIds = new Set(
        brokenPromises.filter(a => a.invoiceId).map(a => a.invoiceId)
      );
      
      const promiseInvoiceIds = new Set(
        upcomingPTP.filter(a => a.invoiceId).map(a => a.invoiceId as string)
      );
      
      // VIP invoices - those with contacts marked as VIP or manually flagged
      const vipContactIds = new Set(
        exceptions.filter(e => e.contactId).map(e => e.contactId)
      );
      
      // Pre-compute GLOBAL overdue metrics per contact (across ALL their unpaid invoices)
      // This ensures consistent overdue data regardless of which bucket a debtor is pulled from
      const globalOverdueMetrics = new Map<string, { 
        oldestOverdueDueDate: string | null;
        totalOverdue: number;
        oldestDaysOverdue: number;
      }>();
      
      for (const inv of unpaidInvoices) {
        const contactId = inv.contactId;
        const invDueDate = new Date(inv.dueDate);
        invDueDate.setUTCHours(0, 0, 0, 0);
        
        if (invDueDate < today) {
          const invAmount = parseFloat(inv.amount || '0');
          const metrics = globalOverdueMetrics.get(contactId) || { 
            oldestOverdueDueDate: null, 
            totalOverdue: 0, 
            oldestDaysOverdue: 0 
          };
          
          metrics.totalOverdue += invAmount;
          
          if (!metrics.oldestOverdueDueDate || invDueDate < new Date(metrics.oldestOverdueDueDate)) {
            metrics.oldestOverdueDueDate = inv.dueDate;
            metrics.oldestDaysOverdue = Math.floor((today.getTime() - invDueDate.getTime()) / (1000 * 60 * 60 * 24));
          }
          
          globalOverdueMetrics.set(contactId, metrics);
        }
      }
      
      // Categorize each invoice using precedence
      const categorizedInvoices: Record<string, any[]> = {
        recovery: [],
        disputes: [],
        queries: [],
        broken: [],
        promises: [],
        vip: [],
        overdue: [],
        due: []
      };
      
      for (const inv of unpaidInvoices) {
        if (recoveryInvoiceIds.has(inv.id)) {
          categorizedInvoices.recovery.push(inv);
        } else if (disputeInvoiceIds.has(inv.id)) {
          categorizedInvoices.disputes.push(inv);
        } else if (queryInvoiceIds.has(inv.id)) {
          categorizedInvoices.queries.push(inv);
        } else if (brokenInvoiceIds.has(inv.id)) {
          categorizedInvoices.broken.push(inv);
        } else if (promiseInvoiceIds.has(inv.id)) {
          categorizedInvoices.promises.push(inv);
        } else if (vipContactIds.has(inv.contactId)) {
          categorizedInvoices.vip.push(inv);
        } else {
          // Normalize invoice due date to UTC midnight for comparison
          const invDueDate = new Date(inv.dueDate);
          invDueDate.setUTCHours(0, 0, 0, 0);
          
          if (invDueDate < today) {
            categorizedInvoices.overdue.push(inv);
          } else {
            categorizedInvoices.due.push(inv);
          }
        }
      }
      
      // Helper to group invoices by debtor
      const groupByDebtor = async (invoiceList: any[]) => {
        const debtorMap = new Map<string, any>();
        
        for (const inv of invoiceList) {
          const contactId = inv.contactId;
          
          if (!debtorMap.has(contactId)) {
            let companyName = '';
            let contactName = '';
            let contact = null;
            try {
              contact = await storage.getContact(contactId, tenantId);
              if (contact) {
                companyName = contact.companyName || '';
                contactName = contact.name || '';
              }
            } catch (e) {}
            
            // Get ptpDate from payment promises map
            const ptpDate = contactPtpMap.get(contactId);
            // Get all payment promises for this contact
            const promises = contactPromisesMap.get(contactId) || [];
            
            // Get GLOBAL overdue metrics for this contact (computed across all their invoices)
            const globalMetrics = globalOverdueMetrics.get(contactId);
            
            debtorMap.set(contactId, {
              contactId,
              companyName,
              contactName,
              contact,
              totalOutstanding: 0,
              // Use GLOBAL overdue metrics to ensure correct classification
              totalOverdue: globalMetrics?.totalOverdue || 0,
              oldestDaysOverdue: globalMetrics?.oldestDaysOverdue || 0,
              invoiceCount: 0,
              invoices: [],
              oldestDueDate: inv.dueDate,
              ptpDate: ptpDate ? ptpDate.toISOString() : null,
              paymentPromises: promises.map(p => ({
                date: p.date.toISOString(),
                amount: p.amount,
                invoiceId: p.invoiceId
              })),
            });
          }
          
          const debtor = debtorMap.get(contactId)!;
          const invAmount = parseFloat(inv.amount || '0');
          debtor.totalOutstanding += invAmount;
          debtor.invoiceCount += 1;
          debtor.invoices.push(inv);
          
          // Track oldest due date
          if (new Date(inv.dueDate) < new Date(debtor.oldestDueDate)) {
            debtor.oldestDueDate = inv.dueDate;
          }
        }
        
        return Array.from(debtorMap.values()).sort((a, b) => 
          b.totalOutstanding - a.totalOutstanding
        );
      };
      
      // Group each category by debtor
      const [
        recoveryDebtors,
        disputeDebtors,
        queryDebtors,
        brokenDebtors,
        promiseDebtors,
        vipDebtors,
        overdueDebtors,
        dueDebtors
      ] = await Promise.all([
        groupByDebtor(categorizedInvoices.recovery),
        groupByDebtor(categorizedInvoices.disputes),
        groupByDebtor(categorizedInvoices.queries),
        groupByDebtor(categorizedInvoices.broken),
        groupByDebtor(categorizedInvoices.promises),
        groupByDebtor(categorizedInvoices.vip),
        groupByDebtor(categorizedInvoices.overdue),
        groupByDebtor(categorizedInvoices.due)
      ]);
      
      res.json({
        vip: { count: vipDebtors.length, invoiceCount: categorizedInvoices.vip.length, items: vipDebtors },
        due: { count: dueDebtors.length, invoiceCount: categorizedInvoices.due.length, items: dueDebtors },
        overdue: { count: overdueDebtors.length, invoiceCount: categorizedInvoices.overdue.length, items: overdueDebtors },
        promises: { count: promiseDebtors.length, invoiceCount: categorizedInvoices.promises.length, items: promiseDebtors },
        broken: { count: brokenDebtors.length, invoiceCount: categorizedInvoices.broken.length, items: brokenDebtors },
        queries: { count: queryDebtors.length, invoiceCount: categorizedInvoices.queries.length, items: queryDebtors },
        disputes: { count: disputeDebtors.length, invoiceCount: categorizedInvoices.disputes.length, items: disputeDebtors },
        recovery: { count: recoveryDebtors.length, invoiceCount: categorizedInvoices.recovery.length, items: recoveryDebtors }
      });
    } catch (error) {
      console.error("Error fetching action centre tabs:", error);
      res.status(500).json({ message: "Failed to fetch action centre tabs" });
    }
  });

  app.post("/api/actions/schedule", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { 
        invoiceId, 
        contactId, 
        actionType, 
        scheduledFor, 
        subject, 
        content 
      } = req.body;

      // Validate required fields
      if (!contactId || !actionType || !scheduledFor) {
        return res.status(400).json({ 
          message: "Missing required fields: contactId, actionType, scheduledFor" 
        });
      }

      // Parse and validate scheduledFor datetime
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: "Invalid scheduledFor date format" });
      }

      // Check if scheduled time is in the past
      if (scheduledDate < new Date()) {
        return res.status(400).json({ message: "Scheduled time must be in the future" });
      }

      // Create scheduled action
      const actionData = {
        tenantId: user.tenantId,
        invoiceId: invoiceId || null,
        contactId,
        userId: user.id,
        type: actionType,
        status: 'scheduled',
        subject: subject || null,
        content: content || null,
        scheduledFor: scheduledDate,
        source: 'manual',
        metadata: {
          createdBy: user.id,
          createdByName: `${user.firstName} ${user.lastName}`.trim(),
        }
      };

      const action = await storage.createAction(actionData);
      
      console.log(`✅ Manual action scheduled: ${actionType} to ${contactId} at ${scheduledDate.toISOString()}`);
      
      res.status(201).json({
        ...action,
        message: `${actionType} scheduled for ${scheduledDate.toLocaleString('en-GB')}`
      });
    } catch (error) {
      console.error("Error scheduling manual action:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid action data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to schedule action" });
    }
  });

  app.get("/api/actions/:id/preview", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      // Get the action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];

      // Get contact info
      let contactName = 'Customer';
      let companyName = '';
      if (action.contactId) {
        const contact = await storage.getContact(action.contactId, user.tenantId);
        if (contact) {
          contactName = contact.name || 'Customer';
          companyName = contact.companyName || '';
        }
      }

      // Get tenant info for company name
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId)
      });

      // Get all overdue invoices for this contact
      const contactInvoices = action.contactId ? await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, user.tenantId),
            eq(invoices.contactId, action.contactId),
            sql`${invoices.dueDate} < CURRENT_DATE`,
            sql`COALESCE(${invoices.amountPaid}, 0) < ${invoices.amount}`,
            sql`${invoices.status} NOT IN ('paid', 'cancelled', 'void')`
          )
        ) : [];

      // Calculate totals
      const today = new Date();
      const invoicesWithOverdue = contactInvoices.map(inv => {
        const dueDate = new Date(inv.dueDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const outstanding = Number(inv.amount) - Number(inv.amountPaid || 0);
        return {
          invoiceNumber: inv.invoiceNumber,
          amount: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(outstanding),
          dueDate: dueDate.toLocaleDateString('en-GB'),
          daysOverdue
        };
      });

      const totalOverdue = contactInvoices.reduce((sum, inv) => 
        sum + (Number(inv.amount) - Number(inv.amountPaid || 0)), 0
      );

      // Check for pre-generated AI draft first
      let subject = '';
      let content = '';
      let usedPreGeneratedDraft = false;
      
      // Normalize channel to lowercase for consistent lookup
      const rawType = action.type?.toLowerCase() || 'email';
      const channel = rawType === 'call' ? 'voice' : rawType as 'email' | 'sms' | 'voice';
      const [draft] = await db.select()
        .from(messageDrafts)
        .where(and(
          eq(messageDrafts.actionId, action.id),
          eq(messageDrafts.channel, channel),
          eq(messageDrafts.status, 'generated')
        ));

      if (draft) {
        // Use pre-generated AI content
        subject = draft.subject || '';
        content = draft.body || draft.voiceScript || '';
        usedPreGeneratedDraft = true;
        console.log(`⚡ Using pre-generated ${channel} draft for action ${action.id}`);
      } else {
        // Fall back to channel-appropriate content
        if (channel === 'sms') {
          // Generate short SMS fallback with stage-appropriate messaging
          const formattedTotal = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalOverdue);
          const firstName = contactName.split(' ')[0];
          const maxDaysOverdue = Math.max(...invoicesWithOverdue.map(i => i.daysOverdue), 0);
          
          // Abbreviate tenant name if too long
          let tenantName = tenant?.name || 'Your Company';
          if (tenantName.length > 20) {
            tenantName = tenantName.replace(/\s+(Limited|Ltd\.?|LLP|PLC|Inc\.?)$/i, '').substring(0, 17) + '...';
          }
          
          if (maxDaysOverdue >= 60) {
            // Recovery stage: urgent, direct
            content = `Hi ${firstName},\n${formattedTotal} is ${maxDaysOverdue} days overdue.\nPay today to avoid escalation. ${tenantName}`;
          } else {
            // Credit Control: friendly reminder (shorter format)
            content = `Hi ${firstName},\n${formattedTotal} overdue (${invoicesWithOverdue.length} inv).\nPlease pay or call if any issues. ${tenantName}`;
          }
        } else if (channel === 'voice') {
          // Voice script fallback
          const formattedTotal = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalOverdue);
          content = `Hello, this is calling on behalf of ${tenant?.name || 'Your Company'}. I'm calling about ${invoicesWithOverdue.length} outstanding invoice${invoicesWithOverdue.length > 1 ? 's' : ''} totalling ${formattedTotal}. I wanted to check if there are any issues and see if we can help arrange payment.`;
        } else {
          // Email - use stored content or template
          subject = action.subject || '';
          content = action.content || '';
        }
      }

      // Replace template variables (for fallback content)
      const replacements: Record<string, string> = {
        '{{contactName}}': contactName,
        '{{companyName}}': tenant?.name || 'Your Company',
        '{{invoiceNumber}}': invoicesWithOverdue[0]?.invoiceNumber || '',
        '{{invoiceAmount}}': invoicesWithOverdue[0]?.amount || '',
        '{{daysOverdue}}': String(invoicesWithOverdue[0]?.daysOverdue || 0),
        '{{dueDate}}': invoicesWithOverdue[0]?.dueDate || '',
        '{{invoiceCount}}': String(invoicesWithOverdue.length),
        '{{totalOverdue}}': new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalOverdue),
        '{{oldestInvoiceDays}}': String(Math.max(...invoicesWithOverdue.map(i => i.daysOverdue), 0)),
      };

      // Generate invoice table HTML using shared function
      const { generateInvoiceTableHtml } = await import("./services/collectionsAutomation");
      const invoiceSummaries = invoicesWithOverdue.map(inv => ({
        invoiceId: '', // Not needed for table generation
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount.replace(/[£,]/g, ''), // Remove currency formatting for the function
        dueDate: inv.dueDate,
        daysOverdue: inv.daysOverdue
      }));
      replacements['{{invoiceTable}}'] = generateInvoiceTableHtml(invoiceSummaries);

      // Only apply template replacements for fallback content (not pre-generated AI content)
      if (!usedPreGeneratedDraft) {
        for (const [key, value] of Object.entries(replacements)) {
          subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
          content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
        }
        // Apply post-processing to ensure proper HTML paragraph formatting for emails
        if (channel === 'email') {
          content = cleanEmailContent(content);
        }
      }

      res.json({
        actionType: action.type,
        subject,
        content,
        invoices: invoicesWithOverdue,
        contactName,
        companyName,
        totalOverdue: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalOverdue),
        invoiceCount: invoicesWithOverdue.length,
        isAiGenerated: usedPreGeneratedDraft
      });
    } catch (error) {
      console.error("Error fetching action preview:", error);
      res.status(500).json({ message: "Failed to fetch action preview" });
    }
  });

  app.post("/api/actions/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];

      // Update status to scheduled and record who approved
      await db
        .update(actions)
        .set({
          status: "scheduled",
          approvedBy: user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`✅ Action ${id} approved by ${user.firstName} ${user.lastName}`);

      res.json({ 
        message: "Action approved and scheduled",
        actionId: id
      });
    } catch (error) {
      console.error("Error approving action:", error);
      res.status(500).json({ message: "Failed to approve action" });
    }
  });

  app.patch("/api/actions/:id/edit", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { channel, sendAt, subject, content } = req.body;

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];

      // Build override object tracking what was changed
      const override: any = {};
      if (channel && channel !== action.type) {
        override.channel = channel;
      }
      if (sendAt && sendAt !== action.scheduledFor?.toISOString()) {
        override.sendAt = new Date(sendAt);
      }
      if (subject && subject !== action.subject) {
        override.subject = subject;
      }
      if (content && content !== action.content) {
        override.content = content;
      }

      // Update action with overrides
      await db
        .update(actions)
        .set({
          type: channel || action.type,
          scheduledFor: sendAt ? new Date(sendAt) : action.scheduledFor,
          subject: subject || action.subject,
          content: content || action.content,
          override: override,
          overriddenBy: user.id,
          overriddenAt: new Date(),
          status: "scheduled", // Move to scheduled after edit
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`✏️ Action ${id} edited by ${user.firstName} ${user.lastName}`);

      res.json({ 
        message: "Action updated successfully",
        actionId: id,
        override
      });
    } catch (error) {
      console.error("Error editing action:", error);
      res.status(500).json({ message: "Failed to edit action" });
    }
  });

  app.post("/api/actions/:id/snooze", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { snoozeUntil, reason } = req.body;

      if (!snoozeUntil) {
        return res.status(400).json({ message: "snoozeUntil is required" });
      }

      const snoozeDate = new Date(snoozeUntil);
      if (isNaN(snoozeDate.getTime()) || snoozeDate <= new Date()) {
        return res.status(400).json({ message: "Invalid snoozeUntil date (must be in future)" });
      }

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      // Update action with snooze
      await db
        .update(actions)
        .set({
          scheduledFor: snoozeDate,
          status: "snoozed",
          snoozedBy: user.id,
          snoozedAt: new Date(),
          snoozedUntil: snoozeDate,
          snoozedReason: reason || null,
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`⏰ Action ${id} snoozed until ${snoozeDate.toISOString()} by ${user.firstName} ${user.lastName}`);

      res.json({ 
        message: "Action snoozed",
        actionId: id,
        snoozedUntil: snoozeDate
      });
    } catch (error) {
      console.error("Error snoozing action:", error);
      res.status(500).json({ message: "Failed to snooze action" });
    }
  });

  app.post("/api/actions/:id/escalate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { reason } = req.body;

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      // Update action status to exception (VIP) for manual handling
      await db
        .update(actions)
        .set({
          status: "exception",
          exceptionReason: reason || "manual_escalation",
          escalatedBy: user.id,
          escalatedAt: new Date(),
          escalationReason: reason || "manual_escalation",
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`🚨 Action ${id} moved to VIP by ${user.firstName} ${user.lastName}`);

      res.json({ 
        message: "Action moved to VIP for manual handling",
        actionId: id
      });
    } catch (error) {
      console.error("Error escalating action:", error);
      res.status(500).json({ message: "Failed to escalate action" });
    }
  });

  app.patch("/api/actions/:id/assign", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { assignedTo } = req.body;

      if (!assignedTo) {
        return res.status(400).json({ message: "assignedTo userId is required" });
      }

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      // Update action with assignment
      await db
        .update(actions)
        .set({
          assignedTo,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`👤 Action ${id} assigned to user ${assignedTo}`);

      res.json({ 
        message: "Action assigned successfully",
        actionId: id,
        assignedTo
      });
    } catch (error) {
      console.error("Error assigning action:", error);
      res.status(500).json({ message: "Failed to assign action" });
    }
  });

  app.post("/api/actions/:id/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { outcome, rating, comment } = req.body;

      if (!outcome) {
        return res.status(400).json({ message: "outcome is required (paid, promised, disputed, no_response, etc.)" });
      }

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      // Record feedback
      await db
        .update(actions)
        .set({
          feedbackOutcome: outcome,
          feedbackRating: rating || null,
          feedbackComment: comment || null,
          feedbackAt: new Date(),
          feedbackBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`📊 Feedback recorded for action ${id}: outcome=${outcome}, rating=${rating}`);

      res.json({ 
        message: "Feedback recorded successfully",
        actionId: id,
        feedback: { outcome, rating, comment }
      });
    } catch (error) {
      console.error("Error recording feedback:", error);
      res.status(500).json({ message: "Failed to record feedback" });
    }
  });

  app.post("/api/actions/:id/voice-call", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      // Get action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];
      
      // Get contact
      const contact = await storage.getContact(action.contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (!contact.phone) {
        return res.status(400).json({ message: "Contact has no phone number" });
      }

      // Get tenant for organization name
      const tenant = await storage.getTenant(user.tenantId);

      // Get invoices for this contact and filter for overdue
      const allInvoices = await storage.getInvoicesByContact(action.contactId, user.tenantId);
      const now = new Date();
      const overdueInvoices = allInvoices.filter(inv => 
        inv.status !== 'paid' && new Date(inv.dueDate) < now
      );
      
      // Calculate totals
      const totalOutstanding = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amountDue || inv.amount || 0), 0);
      const oldestDaysOverdue = overdueInvoices.length > 0 
        ? Math.max(...overdueInvoices.map(inv => {
            const due = new Date(inv.dueDate);
            return Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24));
          }))
        : 0;
      const invoiceNumbers = overdueInvoices.map(inv => inv.invoiceNumber).join(', ');

      // Build simple variables for Retell
      const dynamicVariables = {
        customerName: contact.name || 'Customer',
        companyName: contact.companyName || contact.name || 'Customer',
        organisationName: tenant?.name || 'our company',
        invoiceCount: String(overdueInvoices.length),
        invoiceNumbers: invoiceNumbers || 'outstanding invoices',
        totalOutstanding: totalOutstanding.toFixed(2),
        daysOverdue: String(oldestDaysOverdue),
        contactPhone: contact.phone,
      };

      // Call Retell directly
      const { createUnifiedRetellCall } = await import('./utils/retellCallHelper');
      
      const result = await createUnifiedRetellCall({
        toNumber: contact.phone,
        dynamicVariables,
        metadata: {
          actionId: id,
          contactId: action.contactId,
          tenantId: user.tenantId,
          initiatedBy: user.id,
        },
        context: 'ACTION_VOICE_CALL',
      });

      console.log(`🎙️ AI Voice call initiated: ${result.callId} for action ${id}`);

      // Update action status
      await db
        .update(actions)
        .set({
          status: 'in_progress',
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      res.json({ 
        message: "Voice call initiated successfully",
        callId: result.callId,
        actionId: id,
        toNumber: contact.phone,
        status: result.status,
      });
    } catch (error) {
      console.error("Error initiating voice call:", error);
      const message = error instanceof Error ? error.message : "Failed to initiate voice call";
      res.status(500).json({ message });
    }
  });

  app.post("/api/actions/:id/email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      // Get action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];
      
      // Get contact
      const contact = await storage.getContact(action.contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (!contact.email) {
        return res.status(400).json({ message: "Contact has no email address" });
      }

      // Use communications orchestrator for email
      const { communicationsOrchestrator } = await import('./services/communicationsOrchestrator');
      
      const invoiceIds = action.invoiceId ? [action.invoiceId] : [];

      const result = await communicationsOrchestrator.send({
        tenantId: user.tenantId,
        contactId: action.contactId,
        channel: 'email',
        invoiceIds,
        actionId: id,
        priority: 'normal',
        tone: 'friendly_assumptive',
        subject: action.subject || 'Invoice Reminder',
        content: action.content || 'This is a reminder about your outstanding invoice.',
      });

      if (!result.success) {
        return res.status(400).json({ 
          message: result.blockedReason || result.error || "Email could not be sent",
          status: result.status,
        });
      }

      console.log(`📧 Email sent for action ${id}: ${result.messageId}`);

      // Update action status
      await db
        .update(actions)
        .set({
          status: 'completed',
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      res.json({ 
        message: "Email sent successfully",
        messageId: result.messageId,
        actionId: id,
        toEmail: contact.email,
        status: result.status,
      });
    } catch (error) {
      console.error("Error sending email:", error);
      const message = error instanceof Error ? error.message : "Failed to send email";
      res.status(500).json({ message });
    }
  });

  app.post("/api/actions/:id/sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      // Get action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];
      
      // Get contact
      const contact = await storage.getContact(action.contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (!contact.phone) {
        return res.status(400).json({ message: "Contact has no phone number" });
      }

      // Use communications orchestrator for SMS
      const { communicationsOrchestrator } = await import('./services/communicationsOrchestrator');
      
      const invoiceIds = action.invoiceId ? [action.invoiceId] : [];

      const result = await communicationsOrchestrator.send({
        tenantId: user.tenantId,
        contactId: action.contactId,
        channel: 'sms',
        invoiceIds,
        actionId: id,
        priority: 'normal',
        tone: 'friendly_assumptive',
        content: action.content || 'Reminder: You have an outstanding invoice. Please contact us to arrange payment.',
      });

      if (!result.success) {
        return res.status(400).json({ 
          message: result.blockedReason || result.error || "SMS could not be sent",
          status: result.status,
        });
      }

      console.log(`📱 SMS sent for action ${id}: ${result.messageId}`);

      // Update action status
      await db
        .update(actions)
        .set({
          status: 'completed',
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      res.json({ 
        message: "SMS sent successfully",
        messageId: result.messageId,
        actionId: id,
        toPhone: contact.phone,
        status: result.status,
      });
    } catch (error) {
      console.error("Error sending SMS:", error);
      const message = error instanceof Error ? error.message : "Failed to send SMS";
      res.status(500).json({ message });
    }
  });

  app.post("/api/action-centre/create-test-items", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🔧 Creating test action items for tenant ${user.tenantId}`);

      // Create test action items with different due dates and statuses
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const testItems = [
        {
          tenantId: user.tenantId,
          contactId: "test-contact-1",
          type: "email_reminder",
          priority: "high",
          status: "open",
          dueAt: yesterday, // Overdue item
          createdByUserId: user.id,
        },
        {
          tenantId: user.tenantId,
          contactId: "test-contact-2",
          type: "payment_follow_up",
          priority: "medium",
          status: "in_progress",
          dueAt: today, // Due today item
          createdByUserId: user.id,
        },
        {
          tenantId: user.tenantId,
          contactId: "test-contact-3",
          type: "sms_reminder",
          priority: "low",
          status: "snoozed",
          dueAt: tomorrow, // Future item
          createdByUserId: user.id,
        },
      ];

      const createdItems = [];
      for (const item of testItems) {
        const actionItem = await storage.createActionItem(item);
        createdItems.push(actionItem);
      }

      console.log(`✅ Created ${createdItems.length} test action items`);

      res.json({
        success: true,
        message: `Created ${createdItems.length} test action items`,
        items: createdItems,
      });
    } catch (error) {
      console.error("Error creating test action items:", error);
      res.status(500).json({ message: "Failed to create test action items" });
    }
  });

  app.get("/api/action-centre/queue", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const filters = actionItemQuerySchema.parse(req.query);
      
      // Use ML prioritization service for smart queue ordering
      if (filters.useSmartPriority && filters.sortBy === 'smart') {
        console.log(`🧠 Smart Queue: Using ML prioritization for tenant ${user.tenantId}, queue type: ${filters.queueType}`);
        
        const smartResult = await actionPrioritizationService.getPrioritizedActions(user.tenantId, filters);
        
        console.log(`🎯 Smart Queue Results: ${smartResult.actionItems.length} items, ML coverage: ${(smartResult.queueMetadata.mlDataCoverage * 100).toFixed(1)}%, confidence: ${(smartResult.queueMetadata.averageConfidence * 100).toFixed(1)}%`);
        
        res.json({
          ...smartResult,
          // Add metadata for debugging and UI display
          smartPriorityEnabled: true,
          queueInsights: {
            mlCoverage: smartResult.queueMetadata.mlDataCoverage,
            averageConfidence: smartResult.queueMetadata.averageConfidence,
            queueType: filters.queueType,
            optimizedAt: smartResult.queueMetadata.lastOptimized,
          }
        });
        return;
      }

      // Fallback to standard queue logic for compatibility
      console.log(`📋 Standard Queue: Using basic prioritization for tenant ${user.tenantId}`);
      const result = await storage.getActionItems(user.tenantId, filters);
      
      res.json({
        ...result,
        smartPriorityEnabled: false,
        queueInsights: {
          mlCoverage: 0,
          averageConfidence: 0,
          queueType: 'default',
          optimizedAt: new Date(),
        }
      });
    } catch (error) {
      console.error("Error fetching action queue:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to fetch action queue" });
    }
  });

  app.get("/api/action-centre/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const [basicMetrics, invoiceCounts, cacheStats, filteredInvoiceCounts] = await Promise.all([
        storage.getActionCentreMetrics(user.tenantId),
        storage.getInvoiceCountsByOverdueCategory(user.tenantId),
        Promise.resolve(actionPrioritizationService.getCacheStats()),
        // Get filtered invoice counts that match what's displayed
        Promise.all([
          storage.getInvoicesFiltered(user.tenantId, { overdueCategory: 'due' }).then(result => result.total),
          storage.getInvoicesFiltered(user.tenantId, { overdueCategory: 'overdue' }).then(result => result.total),
          storage.getInvoicesFiltered(user.tenantId, { overdueCategory: 'serious' }).then(result => result.total),
          storage.getInvoicesFiltered(user.tenantId, { overdueCategory: 'escalation' }).then(result => result.total)
        ]).then(results => ({
          due: results[0],
          overdue: results[1],
          serious: results[2],
          escalation: results[3]
        }))
      ]);

      const enhancedMetrics = {
        ...basicMetrics,
        // Add frontend-expected field names as aliases
        totalActions: basicMetrics.totalOpen,
        todayActions: basicMetrics.todayActionsCount, // FIX: Use actual count for "today" queue
        overdueActions: basicMetrics.overdueCount,
        highRiskActions: Math.ceil(basicMetrics.overdueCount * 0.3), // Estimate 30% of overdue items are high risk
        avgDaysOverdue: basicMetrics.avgCompletionTime,
        totalValue: Math.floor(basicMetrics.highRiskExposure),
        // NEW WORKFLOW STRUCTURE: Map existing invoice categories to workflow buckets
        queueCounts: {
          // Due = invoices due within next 7 days but not yet overdue (filtered count)
          due: filteredInvoiceCounts.due,
          // Overdue = all overdue invoices WITHOUT exception status (filtered count)
          overdue: filteredInvoiceCounts.overdue + filteredInvoiceCounts.serious + filteredInvoiceCounts.escalation,
          // Promises = invoices with active PTPs (0 until PTP system implemented)
          promises: 0,
          // Broken Promises = invoices with broken PTPs (0 until PTP system implemented)
          brokenPromises: 0,
          // Payment Plans = invoices with active payment arrangements (query needed)
          paymentPlans: 0, // TODO: Query invoices.outcomeOverride = 'Plan' count
          // Legal = invoices in legal proceedings (0 until legal status implemented)  
          legal: 0,
          // Debt Recovery = invoices with external agencies (0 until debt recovery implemented)
          debtRecovery: 0
        },
        prioritization: {
          cacheStatus: cacheStats,
          smartQueueAvailable: true,
          supportedQueueTypes: ['today', 'overdue', 'high_risk', 'default'],
          mlServicesIntegrated: ['payment_predictions', 'risk_scoring', 'customer_learning'],
        }
      };

      res.json(enhancedMetrics);
    } catch (error) {
      console.error("Error fetching action centre metrics:", error);
      res.status(500).json({ message: "Failed to fetch action centre metrics" });
    }
  });

  app.post("/api/action-centre/priority/refresh", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🔄 Manual Priority Refresh: Refreshing priority scores for tenant ${user.tenantId}`);
      const refreshResult = await actionPrioritizationService.bulkRefreshPriorityScores(user.tenantId);
      
      console.log(`✅ Priority Refresh Complete: processed=${refreshResult.processed}, cached=${refreshResult.cached}, errors=${refreshResult.errors}`);
      
      res.json({
        message: "Priority scores refreshed successfully",
        stats: refreshResult,
        refreshedAt: new Date(),
      });
    } catch (error) {
      console.error("Error refreshing priority scores:", error);
      res.status(500).json({ message: "Failed to refresh priority scores" });
    }
  });

  app.get("/api/action-centre/priority/cache-stats", isAuthenticated, async (req: any, res) => {
    try {
      const cacheStats = actionPrioritizationService.getCacheStats();
      
      res.json({
        cacheStats,
        explanation: {
          totalEntries: "Number of cached priority calculations",
          hitRate: "Cache hit rate (not currently tracked)",
          averageAge: "Average age of cached entries in minutes",
          memoryUsage: "Estimated memory usage",
        },
        recommendations: cacheStats.totalEntries > 1000 
          ? ["Consider increasing cache cleanup frequency"]
          : cacheStats.totalEntries < 10
          ? ["Cache is building up - normal for new deployments"]
          : ["Cache performance looks good"],
      });
    } catch (error) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({ message: "Failed to fetch cache statistics" });
    }
  });

  app.get("/api/action-centre/queue-insights", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get sample of each queue type to show differences
      const queueComparisons = await Promise.allSettled([
        actionPrioritizationService.getPrioritizedActions(user.tenantId, {
          useSmartPriority: true,
          queueType: 'today',
          limit: 5,
          status: 'open'
        }),
        actionPrioritizationService.getPrioritizedActions(user.tenantId, {
          useSmartPriority: true,
          queueType: 'overdue',
          limit: 5,
          status: 'open'
        }),
        actionPrioritizationService.getPrioritizedActions(user.tenantId, {
          useSmartPriority: true,
          queueType: 'high_risk',
          limit: 5,
          status: 'open'
        })
      ]);

      const insights = {
        queueAnalysis: {
          today: queueComparisons[0].status === 'fulfilled' ? {
            topItems: queueComparisons[0].value.actionItems.slice(0, 3).map(item => ({
              id: item.id,
              priorityScore: item.priorityScore?.priorityScore || 0,
              reasoning: item.priorityScore?.reasoning || [],
              confidence: item.priorityScore?.confidence || 0,
            })),
            mlCoverage: queueComparisons[0].value.queueMetadata.mlDataCoverage,
            averageConfidence: queueComparisons[0].value.queueMetadata.averageConfidence,
          } : { error: 'Failed to analyze today queue' },
          
          overdue: queueComparisons[1].status === 'fulfilled' ? {
            topItems: queueComparisons[1].value.actionItems.slice(0, 3).map(item => ({
              id: item.id,
              priorityScore: item.priorityScore?.priorityScore || 0,
              reasoning: item.priorityScore?.reasoning || [],
              confidence: item.priorityScore?.confidence || 0,
            })),
            mlCoverage: queueComparisons[1].value.queueMetadata.mlDataCoverage,
            averageConfidence: queueComparisons[1].value.queueMetadata.averageConfidence,
          } : { error: 'Failed to analyze overdue queue' },
          
          highRisk: queueComparisons[2].status === 'fulfilled' ? {
            topItems: queueComparisons[2].value.actionItems.slice(0, 3).map(item => ({
              id: item.id,
              priorityScore: item.priorityScore?.priorityScore || 0,
              reasoning: item.priorityScore?.reasoning || [],
              confidence: item.priorityScore?.confidence || 0,
            })),
            mlCoverage: queueComparisons[2].value.queueMetadata.mlDataCoverage,
            averageConfidence: queueComparisons[2].value.queueMetadata.averageConfidence,
          } : { error: 'Failed to analyze high-risk queue' },
        },
        systemStatus: {
          mlServicesAvailable: true,
          cacheHealth: actionPrioritizationService.getCacheStats(),
          lastUpdated: new Date(),
        }
      };

      res.json(insights);
    } catch (error) {
      console.error("Error fetching queue insights:", error);
      res.status(500).json({ message: "Failed to fetch queue insights" });
    }
  });

  app.get("/api/action-centre/contact/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const contact = await storage.getContact(id, user.tenantId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get related invoices for payment history (filtered by contact ID)
      const allInvoices = await storage.getInvoices(user.tenantId, 100); // Get recent invoices
      const contactInvoices = allInvoices.filter(invoice => invoice.contactId === id).slice(0, 10);
      
      // Get comprehensive communication history data
      const actionHistory = await storage.getActionItemsByContact(id, user.tenantId);
      
      // Get detailed action logs for richer communication context
      const enrichedCommunications = [];
      for (const action of actionHistory.slice(0, 20)) { // Limit to recent 20 actions
        try {
          const actionLogs = await storage.getActionLogs(action.id, user.tenantId);
          enrichedCommunications.push({
            ...action,
            detailedLogs: actionLogs
          });
        } catch (error) {
          // If logs fail, include action without detailed logs
          enrichedCommunications.push({
            ...action,
            detailedLogs: []
          });
        }
      }
      
      // Try to get customer learning profile for AI insights
      let customerProfile = null;
      try {
        // Note: This may fail if the profile doesn't exist, which is fine
        const profiles = await db.select()
          .from(customerLearningProfiles)
          .where(and(
            eq(customerLearningProfiles.contactId, id),
            eq(customerLearningProfiles.tenantId, user.tenantId)
          ))
          .limit(1);
        
        customerProfile = profiles[0] || null;
      } catch (error) {
        console.log('Customer learning profile not available:', error instanceof Error ? error.message : 'Unknown error');
        customerProfile = null;
      }
      
      // Get risk profile data (enhanced with learning profile if available)
      const riskScore = { score: 0.5, riskLevel: 'medium', factors: ['Assessment pending'] }; // TODO: Implement proper risk scoring

      // Assemble contact details response
      const contactDetails = {
        ...contact,
        paymentHistory: contactInvoices.map(invoice => ({
          invoiceNumber: invoice.invoiceNumber,
          amount: parseFloat(invoice.amount),
          status: invoice.status,
          dueDate: invoice.dueDate.toISOString(),
          paidDate: invoice.paidDate?.toISOString(),
        })),
        communicationHistory: enrichedCommunications.map(action => ({
          id: action.id,
          type: action.type as 'email' | 'sms' | 'phone' | 'call',
          date: action.createdAt?.toISOString() || new Date().toISOString(),
          subject: action.notes || `${action.type.charAt(0).toUpperCase() + action.type.slice(1)} communication`,
          status: action.status,
          priority: action.priority,
          outcome: action.outcome || null,
          assignedTo: action.assignedToUserId,
          dueAt: action.dueAt?.toISOString(),
          invoiceId: action.invoiceId,
          // Enhanced with detailed event logs
          events: action.detailedLogs?.map(log => ({
            eventType: log.eventType,
            details: log.details,
            createdAt: log.createdAt?.toISOString(),
            createdBy: log.createdByUserId
          })) || [],
          // Calculate effectiveness if multiple events exist
          effectivenessIndicators: {
            wasDelivered: action.detailedLogs?.some(log => log.eventType === 'sent_email' || log.eventType === 'sent_sms'),
            hadResponse: action.detailedLogs?.some(log => log.eventType === 'responded'),
            resultedInPayment: action.outcome?.toLowerCase().includes('payment') || action.outcome?.toLowerCase().includes('paid'),
            totalEvents: action.detailedLogs?.length || 0
          }
        })),
        riskProfile: {
          score: typeof riskScore.score === 'number' ? riskScore.score : 0.5,
          level: riskScore.riskLevel as 'low' | 'medium' | 'high' | 'critical',
          factors: Array.isArray(riskScore.factors) ? riskScore.factors : ['No risk assessment available'],
        },
        // AI Communication Intelligence (if available)
        aiInsights: customerProfile ? {
          totalInteractions: customerProfile.totalInteractions || 0,
          successfulActions: customerProfile.successfulActions || 0,
          successRate: (customerProfile.totalInteractions || 0) > 0 
            ? Math.round(((customerProfile.successfulActions || 0) / (customerProfile.totalInteractions || 1)) * 100)
            : 0,
          channelEffectiveness: {
            email: parseFloat(customerProfile.emailEffectiveness?.toString() || '0.5'),
            sms: parseFloat(customerProfile.smsEffectiveness?.toString() || '0.5'),
            voice: parseFloat(customerProfile.voiceEffectiveness?.toString() || '0.5'),
          },
          preferredChannel: customerProfile.preferredChannel || 'unknown',
          preferredContactTime: customerProfile.preferredContactTime || 'unknown',
          averageResponseTime: customerProfile.averageResponseTime || null,
          averagePaymentDelay: customerProfile.averagePaymentDelay || null,
          paymentReliability: parseFloat(customerProfile.paymentReliability?.toString() || '0.5'),
          learningConfidence: parseFloat(customerProfile.learningConfidence?.toString() || '0.1'),
          lastUpdated: customerProfile.lastUpdated?.toISOString()
        } : null,
      };

      res.json(contactDetails);
    } catch (error) {
      console.error("Error fetching contact details:", error);
      res.status(500).json({ message: "Failed to fetch contact details" });
    }
  });

  app.post("/api/action-items", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const actionItemData = insertActionItemSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
        createdByUserId: user.id,
      });

      const actionItem = await storage.createActionItem(actionItemData);
      
      // Create initial log entry
      await storage.createActionLog({
        tenantId: user.tenantId,
        actionItemId: actionItem.id,
        eventType: 'created',
        details: { message: 'Action item created' },
        createdByUserId: user.id,
      });

      res.status(201).json(actionItem);
    } catch (error) {
      console.error("Error creating action item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid action item data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create action item" });
    }
  });

  app.get("/api/action-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const actionItem = await storage.getActionItem(id, user.tenantId);
      
      if (!actionItem) {
        return res.status(404).json({ message: "Action item not found" });
      }

      res.json(actionItem);
    } catch (error) {
      console.error("Error fetching action item:", error);
      res.status(500).json({ message: "Failed to fetch action item" });
    }
  });

  app.patch("/api/action-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const updates = insertActionItemSchema.partial().parse(req.body);
      
      const actionItem = await storage.updateActionItem(id, user.tenantId, updates);
      
      // Log the update
      await storage.createActionLog({
        tenantId: user.tenantId,
        actionItemId: id,
        eventType: 'updated',
        details: { message: `Action item updated: ${Object.keys(updates).join(', ')}`, updates },
        createdByUserId: user.id,
      });

      res.json(actionItem);
    } catch (error) {
      console.error("Error updating action item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update action item" });
    }
  });

  app.post("/api/action-items/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { outcome, notes } = actionItemCompleteSchema.parse(req.body);
      
      const actionItem = await storage.updateActionItem(id, user.tenantId, {
        status: 'completed',
        outcome,
        notes,
      });
      
      // Log completion
      await storage.createActionLog({
        tenantId: user.tenantId,
        actionItemId: id,
        eventType: 'completed',
        details: { message: `Action completed${outcome ? ` with outcome: ${outcome}` : ''}${notes ? `. Notes: ${notes}` : ''}`, outcome, notes },
        createdByUserId: user.id,
      });

      res.json(actionItem);
    } catch (error) {
      console.error("Error completing action item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid completion data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to complete action item" });
    }
  });

  app.post("/api/action-items/:id/snooze", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { newDueDate, reason } = actionItemSnoozeSchema.parse(req.body);
      
      const actionItem = await storage.updateActionItem(id, user.tenantId, {
        status: 'snoozed',
        dueAt: newDueDate,
        notes: reason,
      });
      
      // Log the snooze
      await storage.createActionLog({
        tenantId: user.tenantId,
        actionItemId: id,
        eventType: 'snoozed',
        details: { message: `Action snoozed until ${newDueDate.toISOString()}${reason ? `. Reason: ${reason}` : ''}`, newDueDate: newDueDate.toISOString(), reason },
        createdByUserId: user.id,
      });

      res.json(actionItem);
    } catch (error) {
      console.error("Error snoozing action item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid snooze data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to snooze action item" });
    }
  });

  app.get("/api/action-items/:id/logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const logs = await storage.getActionLogs(id, user.tenantId);
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching action logs:", error);
      res.status(500).json({ message: "Failed to fetch action logs" });
    }
  });

  app.post("/api/action-items/:id/logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const logData = insertActionLogSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
        actionItemId: id,
        createdByUserId: user.id,
      });

      const log = await storage.createActionLog(logData);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating action log:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid log data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create action log" });
    }
  });

  app.post("/api/payment-plans", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Parse and validate the payment plan data
      const { 
        invoiceIds, 
        totalAmount, 
        initialPaymentAmount = "0", 
        initialPaymentDate, 
        planStartDate, 
        paymentFrequency, 
        numberOfPayments, 
        notes 
      } = req.body;

      // Validate required fields
      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ message: "At least one invoice must be selected" });
      }
      if (!totalAmount || !planStartDate || !paymentFrequency || !numberOfPayments) {
        return res.status(400).json({ message: "Missing required payment plan data" });
      }

      // Get the first invoice to extract contact info
      const firstInvoice = await storage.getInvoice(invoiceIds[0], user.tenantId);
      if (!firstInvoice) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }

      // Create the payment plan
      const paymentPlanData = {
        tenantId: user.tenantId,
        contactId: firstInvoice.contactId,
        totalAmount,
        initialPaymentAmount,
        planStartDate: new Date(planStartDate),
        initialPaymentDate: initialPaymentDate ? new Date(initialPaymentDate) : undefined,
        paymentFrequency,
        numberOfPayments: parseInt(numberOfPayments),
        notes,
        createdByUserId: user.id,
      };

      const paymentPlan = await storage.createPaymentPlan(paymentPlanData);

      // Link invoices to payment plan
      await storage.linkInvoicesToPaymentPlan(paymentPlan.id, invoiceIds, user.id);

      // Calculate outstanding at creation and set up breach detection
      const linkedInvoices = await db.select().from(invoices).where(inArray(invoices.id, invoiceIds));
      const outstandingAtCreation = linkedInvoices.reduce((sum, inv) => {
        const balance = inv.balance ? parseFloat(inv.balance) : (parseFloat(inv.amount) - parseFloat(inv.amountPaid || "0"));
        return sum + balance;
      }, 0);

      // Calculate first check date based on frequency
      let nextCheckDate = new Date(planStartDate);
      switch (paymentFrequency) {
        case 'weekly':
          nextCheckDate.setDate(nextCheckDate.getDate() + 7);
          break;
        case 'monthly':
          nextCheckDate.setMonth(nextCheckDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextCheckDate.setMonth(nextCheckDate.getMonth() + 3);
          break;
      }

      // Update payment plan with breach detection fields
      const updatedPaymentPlan = await storage.updatePaymentPlan(paymentPlan.id, paymentPlan.tenantId, {
        outstandingAtCreation: outstandingAtCreation.toFixed(2),
        nextCheckDate,
        lastCheckedOutstanding: outstandingAtCreation.toFixed(2),
        lastCheckedAt: new Date(),
      } as any);

      // Return the complete payment plan
      res.status(201).json({
        paymentPlan: updatedPaymentPlan,
        linkedInvoices: invoiceIds.length,
      });

    } catch (error) {
      console.error("Error creating payment plan:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payment plan data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create payment plan", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/payment-plans", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { status, contactId } = req.query;
      const filters: { status?: string; contactId?: string } = {};
      if (status) filters.status = status as string;
      if (contactId) filters.contactId = contactId as string;

      const paymentPlans = await storage.getPaymentPlans(user.tenantId, filters);
      res.json(paymentPlans);

    } catch (error) {
      console.error("Error fetching payment plans:", error);
      res.status(500).json({ message: "Failed to fetch payment plans" });
    }
  });

  app.get("/api/payment-plans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const paymentPlan = await storage.getPaymentPlanWithDetails(id, user.tenantId);
      
      if (!paymentPlan) {
        return res.status(404).json({ message: "Payment plan not found" });
      }

      res.json(paymentPlan);

    } catch (error) {
      console.error("Error fetching payment plan:", error);
      res.status(500).json({ message: "Failed to fetch payment plan" });
    }
  });

  app.post("/api/payment-plans/check-duplicates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceIds } = req.body;
      
      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ message: "Invoice IDs are required" });
      }

      const duplicates = await storage.checkInvoicesForExistingPaymentPlans(invoiceIds, user.tenantId);
      
      res.json({
        hasDuplicates: duplicates.length > 0,
        duplicates,
        invoicesWithExistingPlans: duplicates.map(d => d.invoiceId)
      });

    } catch (error) {
      console.error("Error checking for duplicate payment plans:", error);
      res.status(500).json({ message: "Failed to check for duplicate payment plans" });
    }
  });

  app.get("/api/activity-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { activityType, category, result, entityType, entityId, limit, offset } = req.query;

      const logs = await storage.getActivityLogs(user.tenantId, {
        activityType: activityType as string | undefined,
        category: category as string | undefined,
        result: result as string | undefined,
        entityType: entityType as string | undefined,
        entityId: entityId as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/activity-logs/stats", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const stats = await storage.getActivityLogStats(user.tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching activity log stats:", error);
      res.status(500).json({ message: "Failed to fetch activity log stats" });
    }
  });

  app.post("/api/activity-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate request body
      const { insertActivityLogSchema } = await import("@shared/schema");
      const validatedData = insertActivityLogSchema.omit({ tenantId: true, userId: true }).parse(req.body);

      const logData = {
        ...validatedData,
        tenantId: user.tenantId,
        userId: user.id,
      };

      const log = await storage.createActivityLog(logData);
      res.json(log);
    } catch (error) {
      console.error("Error creating activity log:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid activity log data", error: error.message });
      }
      res.status(500).json({ message: "Failed to create activity log" });
    }
  });

  app.post("/api/action-items/bulk/complete", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { actionItemIds, outcome } = bulkActionSchema.parse(req.body);
      
      const results = await Promise.all(
        actionItemIds.map(async (id) => {
          try {
            const actionItem = await storage.updateActionItem(id, user.tenantId, {
              status: 'completed',
              completedAt: new Date(),
              outcome,
            });
            
            // Log completion
            await storage.createActionLog({
              tenantId: user.tenantId,
              actionItemId: id,
              eventType: 'bulk_completed',
              details: { message: `Bulk completed${outcome ? ` with outcome: ${outcome}` : ''}`, outcome },
              createdByUserId: user.id,
            });
            
            return { id, success: true, actionItem };
          } catch (error) {
            console.error(`Error completing action item ${id}:`, error);
            return { id, success: false, error: error.message };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      res.json({
        total: results.length,
        successful: successCount,
        failed: failCount,
        results
      });
    } catch (error) {
      console.error("Error bulk completing action items:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bulk action data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to bulk complete action items" });
    }
  });

  app.post("/api/action-items/bulk/assign", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { actionItemIds, assignedToUserId, priority } = bulkActionSchema.parse(req.body);
      
      const results = await Promise.all(
        actionItemIds.map(async (id) => {
          try {
            const updates: any = {};
            if (assignedToUserId) updates.assignedToUserId = assignedToUserId;
            if (priority) updates.priority = priority;
            
            const actionItem = await storage.updateActionItem(id, user.tenantId, updates);
            
            // Log assignment
            await storage.createActionLog({
              tenantId: user.tenantId,
              actionItemId: id,
              eventType: 'bulk_assigned',
              details: { message: `Bulk assigned to user ${assignedToUserId}`, assignedToUserId, priority },
              createdByUserId: user.id,
            });
            
            return { id, success: true, actionItem };
          } catch (error) {
            console.error(`Error assigning action item ${id}:`, error);
            return { id, success: false, error: error.message };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      res.json({
        total: results.length,
        successful: successCount,
        failed: failCount,
        results
      });
    } catch (error) {
      console.error("Error bulk assigning action items:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bulk action data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to bulk assign action items" });
    }
  });

  app.post("/api/action-items/bulk/nudge", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { actionItemIds, templateId, customMessage } = bulkNudgeSchema.parse(req.body);
      
      const results = await Promise.all(
        actionItemIds.map(async (id) => {
          try {
            const actionItem = await storage.getActionItem(id, user.tenantId);
            if (!actionItem) {
              return { id, success: false, error: 'Action item not found' };
            }

            // Create nudge action item
            const nudgeActionItem = await storage.createActionItem({
              tenantId: user.tenantId,
              contactId: actionItem.contactId,
              invoiceId: actionItem.invoiceId,
              type: 'nudge',
              priority: 'medium',
              status: 'open',
              title: `Nudge: ${actionItem.title}`,
              description: customMessage || `Follow-up nudge for: ${actionItem.description}`,
              dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due tomorrow
              createdByUserId: user.id,
            });
            
            // Log nudge creation
            await storage.createActionLog({
              tenantId: user.tenantId,
              actionItemId: id,
              eventType: 'bulk_nudged',
              details: { message: `Bulk nudge created${customMessage ? ` with message: ${customMessage}` : ''}`, customMessage, templateId: templateId },
              createdByUserId: user.id,
            });
            
            return { id, success: true, nudgeActionItem };
          } catch (error) {
            console.error(`Error nudging action item ${id}:`, error);
            return { id, success: false, error: error.message };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      res.json({
        total: results.length,
        successful: successCount,
        failed: failCount,
        results
      });
    } catch (error) {
      console.error("Error bulk nudging action items:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bulk nudge data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to bulk nudge action items" });
    }
  });

  app.get("/api/collections/templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, category } = req.query;
      const templates = await storage.getCommunicationTemplates(user.tenantId, { type, category });
      res.json(templates);
    } catch (error) {
      console.error("Error fetching communication templates:", error);
      res.status(500).json({ message: "Failed to fetch communication templates" });
    }
  });

  app.post("/api/collections/templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const templateData = insertCommunicationTemplateSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const template = await storage.createCommunicationTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating communication template:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create communication template" });
    }
  });

  app.put("/api/collections/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const updateData = insertCommunicationTemplateSchema.partial().parse(req.body);
      
      const template = await storage.updateCommunicationTemplate(id, user.tenantId, updateData);
      res.json(template);
    } catch (error) {
      console.error("Error updating communication template:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update communication template" });
    }
  });

  app.delete("/api/collections/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      await storage.deleteCommunicationTemplate(id, user.tenantId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting communication template:", error);
      res.status(500).json({ message: "Failed to delete communication template" });
    }
  });

  app.get("/api/collections/templates/by-category/:category", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { category } = req.params;
      const { type } = req.query;
      const templates = await storage.getTemplatesByCategory(user.tenantId, category, type);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates by category:", error);
      res.status(500).json({ message: "Failed to fetch templates by category" });
    }
  });

  app.get("/api/collections/templates/high-performing", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, limit } = req.query;
      const templates = await storage.getHighPerformingTemplates(
        user.tenantId,
        type,
        limit ? parseInt(limit as string) : 5
      );
      res.json(templates);
    } catch (error) {
      console.error("Error fetching high-performing templates:", error);
      res.status(500).json({ message: "Failed to fetch high-performing templates" });
    }
  });

  app.post("/api/collections/templates/ai-generate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, category, tone, stage } = req.body;
      
      // Generate AI template content based on parameters
      let content = "";
      let subject = "";

      // Generate content directly in the endpoint
      if (type === "email") {
        // Email subjects
        const subjectTemplates: Record<string, string[]> = {
          payment_reminder: [
            "Payment Reminder - Invoice #{invoiceNumber}",
            "Friendly Reminder: Payment Due for Invoice #{invoiceNumber}",
            "Payment Request - Invoice #{invoiceNumber}"
          ],
          overdue_notice: [
            "Overdue Notice - Invoice #{invoiceNumber}",
            "Important: Payment Past Due for Invoice #{invoiceNumber}",
            "Action Required: Overdue Payment"
          ],
          final_demand: [
            "FINAL NOTICE - Invoice #{invoiceNumber}",
            "Urgent: Final Payment Demand",
            "Last Notice Before Collection Action"
          ]
        };

        const subjects = subjectTemplates[category] || subjectTemplates.payment_reminder;
        subject = subjects[Math.min(stage - 1, subjects.length - 1)] || subjects[0];

        // Email content
        const emailContent: Record<string, Record<string, string>> = {
          payment_reminder: {
            friendly: `Dear {customerName},

I hope this message finds you well. This is a friendly reminder that your invoice #{invoiceNumber} for $\{amount} was due on {dueDate}.

We understand that sometimes invoices can be overlooked, so we wanted to bring this to your attention. If you have already sent the payment, please disregard this message.

If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to reach out to us.

Thank you for your business!

Best regards,
{senderName}`,
            professional: `Dear {customerName},

This is a payment reminder for invoice #{invoiceNumber} in the amount of $\{amount}, which was due on {dueDate}.

Please process payment at your earliest convenience. If payment has already been made, please disregard this notice.

For any questions regarding this invoice, please contact our accounts department.

Thank you for your prompt attention to this matter.

Regards,
{senderName}`,
            firm: `Dear {customerName},

Our records indicate that invoice #{invoiceNumber} for $\{amount} is past due as of {dueDate}.

Please remit payment immediately to avoid any potential service interruptions or late fees.

If you believe this notice is in error or need to discuss payment terms, contact us immediately.

{senderName}`,
            urgent: `Dear {customerName},

URGENT: Invoice #{invoiceNumber} for $\{amount} is significantly overdue (due date: {dueDate}).

Immediate payment is required to avoid collection action and additional fees. This is a serious matter that requires your immediate attention.

Contact us today to resolve this outstanding balance.

{senderName}`
          }
        };

        const categoryContent = emailContent[category] || emailContent.payment_reminder;
        content = categoryContent[tone] || categoryContent.professional;

      } else if (type === "sms") {
        const smsTemplates: Record<string, Record<string, string>> = {
          payment_reminder: {
            friendly: "Hi {customerName}! Just a friendly reminder that invoice #{invoiceNumber} for $\{amount} was due on {dueDate}. Thanks!",
            professional: "Payment reminder: Invoice #{invoiceNumber} ($\{amount}) due {dueDate}. Please process payment. Questions? Reply HELP",
            firm: "NOTICE: Invoice #{invoiceNumber} ($\{amount}) is past due. Payment required immediately. Contact us to avoid further action.",
            urgent: "URGENT: Invoice #{invoiceNumber} overdue. $\{amount} payment required NOW to avoid collection action. Call immediately."
          }
        };

        const categoryContent = smsTemplates[category] || smsTemplates.payment_reminder;
        content = categoryContent[tone] || categoryContent.professional;

      } else if (type === "whatsapp") {
        const whatsappTemplates: Record<string, Record<string, string>> = {
          payment_reminder: {
            friendly: `Hello {customerName}! 👋

Hope you're doing well. Just a quick reminder about invoice #{invoiceNumber} for $\{amount} that was due on {dueDate}.

If you've already sent payment, please ignore this message. Otherwise, we'd appreciate payment when convenient.

Thanks! 😊`,
            professional: `Dear {customerName},

Payment reminder for invoice #{invoiceNumber}:
• Amount: $\{amount}
• Due date: {dueDate}

Please process payment at your earliest convenience. Reply if you have any questions.

Best regards,
{senderName}`,
            firm: `{customerName},

Invoice #{invoiceNumber} for $\{amount} is past due (due: {dueDate}).

Immediate payment required. Contact us if you need to discuss payment arrangements.

{senderName}`,
            urgent: `🚨 URGENT NOTICE 🚨

{customerName}, invoice #{invoiceNumber} is seriously overdue.

Amount: $\{amount}
Due date: {dueDate}

Payment required immediately to avoid collection action. Contact us NOW.`
          }
        };

        const categoryContent = whatsappTemplates[category] || whatsappTemplates.payment_reminder;
        content = categoryContent[tone] || categoryContent.professional;
      }

      console.log("Generated content:", { content, subject }); // Debug log
      res.json({ content, subject });
    } catch (error) {
      console.error("Error generating AI template:", error);
      res.status(500).json({ message: "Failed to generate AI template" });
    }
  });

  app.get("/api/collections/email-senders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const senders = await storage.getEmailSenders(user.tenantId);
      res.json(senders);
    } catch (error) {
      console.error("Error fetching email senders:", error);
      res.status(500).json({ message: "Failed to fetch email senders" });
    }
  });

  app.post("/api/collections/email-senders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const senderData = {
        ...req.body,
        tenantId: user.tenantId,
      };

      const sender = await storage.createEmailSender(senderData);
      res.status(201).json(sender);
    } catch (error) {
      console.error("Error creating email sender:", error);
      res.status(500).json({ message: "Failed to create email sender" });
    }
  });

  app.put("/api/collections/email-senders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const sender = await storage.updateEmailSender(id, user.tenantId, req.body);
      res.json(sender);
    } catch (error) {
      console.error("Error updating email sender:", error);
      res.status(500).json({ message: "Failed to update email sender" });
    }
  });

  app.delete("/api/collections/email-senders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const success = await storage.deleteEmailSender(id, user.tenantId);
      if (success) {
        res.json({ message: "Email sender deleted successfully" });
      } else {
        res.status(404).json({ message: "Email sender not found" });
      }
    } catch (error) {
      console.error("Error deleting email sender:", error);
      res.status(500).json({ message: "Failed to delete email sender" });
    }
  });

  app.get("/api/collections/schedules", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const schedules = await storage.getCollectionSchedules(user.tenantId);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching collection schedules:", error);
      res.status(500).json({ message: "Failed to fetch collection schedules" });
    }
  });

  app.post("/api/collections/schedules", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Ensure scheduleSteps has a default value if not provided
      const defaultScheduleSteps = [
        {
          id: "step-1",
          order: 1,
          type: "email",
          delay: 0,
          delayUnit: "hours",
          templateId: null,
          conditions: []
        },
        {
          id: "step-2",
          order: 2,
          type: "email",
          delay: 7,
          delayUnit: "days",
          templateId: null,
          conditions: []
        },
        {
          id: "step-3",
          order: 3,
          type: "email",
          delay: 14,
          delayUnit: "days",
          templateId: null,
          conditions: []
        }
      ];

      const scheduleData = {
        ...req.body,
        tenantId: user.tenantId,
        scheduleSteps: req.body.scheduleSteps || req.body.steps || [],
      };

      console.log("Creating collection schedule with data:", {
        name: scheduleData.name,
        workflow: scheduleData.workflow,
        scheduleStepsCount: scheduleData.scheduleSteps?.length || 0,
      });

      const schedule = await storage.createCollectionSchedule(scheduleData);
      res.status(201).json(schedule);
    } catch (error) {
      console.error("Error creating collection schedule:", error);
      res.status(500).json({ message: "Failed to create collection schedule" });
    }
  });

  app.put("/api/collections/schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      
      // Transform the data like the create endpoint does
      const updateData = {
        ...req.body,
        scheduleSteps: req.body.scheduleSteps || req.body.steps || req.body.scheduleSteps || [],
      };
      
      // Remove the steps field to avoid confusion
      delete updateData.steps;
      
      console.log("Updating collection schedule with data:", {
        name: updateData.name,
        scheduleStepsCount: updateData.scheduleSteps?.length || 0,
      });

      const schedule = await storage.updateCollectionSchedule(id, user.tenantId, updateData);
      res.json(schedule);
    } catch (error) {
      console.error("Error updating collection schedule:", error);
      res.status(500).json({ message: "Failed to update collection schedule" });
    }
  });

  app.delete("/api/collections/schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const success = await storage.deleteCollectionSchedule(id, user.tenantId);
      if (success) {
        res.json({ message: "Collection schedule deleted successfully" });
      } else {
        res.status(404).json({ message: "Collection schedule not found" });
      }
    } catch (error) {
      console.error("Error deleting collection schedule:", error);
      res.status(500).json({ message: "Failed to delete collection schedule" });
    }
  });

  app.get("/api/collections/customer-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.query;
      const assignments = await storage.getCustomerScheduleAssignments(user.tenantId, contactId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching customer assignments:", error);
      res.status(500).json({ message: "Failed to fetch customer assignments" });
    }
  });

  app.post("/api/collections/customer-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const assignmentData = {
        ...req.body,
        tenantId: user.tenantId,
      };

      const assignment = await storage.assignCustomerToSchedule(assignmentData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating customer assignment:", error);
      res.status(500).json({ message: "Failed to create customer assignment" });
    }
  });

  app.delete("/api/collections/customer-assignments/:contactId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      const success = await storage.unassignCustomerFromSchedule(user.tenantId, contactId);
      if (success) {
        res.json({ message: "Customer unassigned successfully" });
      } else {
        res.status(404).json({ message: "Customer assignment not found" });
      }
    } catch (error) {
      console.error("Error unassigning customer:", error);
      res.status(500).json({ message: "Failed to unassign customer" });
    }
  });

  app.get("/api/collections/customer-assignments/:contactId/active", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      const activeSchedule = await storage.getCustomerActiveSchedule(user.tenantId, contactId);
      res.json(activeSchedule);
    } catch (error) {
      console.error("Error fetching customer active schedule:", error);
      res.status(500).json({ message: "Failed to fetch customer active schedule" });
    }
  });

  app.post("/api/collections/assign-all-to-default", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🎯 Starting bulk assignment to default schedule for tenant ${user.tenantId}`);

      // Find the default schedule for this tenant
      const schedules = await storage.getCollectionSchedules(user.tenantId);
      const defaultSchedule = schedules.find(s => s.isDefault);
      
      if (!defaultSchedule) {
        return res.status(404).json({ message: "No default schedule found for this tenant" });
      }

      console.log(`📋 Found default schedule: ${defaultSchedule.name} (${defaultSchedule.id})`);

      // Get all contacts for this tenant
      const contacts = await storage.getContacts(user.tenantId);
      console.log(`👥 Found ${contacts.length} contacts to assign`);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Assign each contact to the default schedule
      for (const contact of contacts) {
        try {
          const assignmentData = {
            tenantId: user.tenantId,
            contactId: contact.id,
            scheduleId: defaultSchedule.id,
            assignedBy: user.id,
            assignedAt: new Date(),
            isActive: true,
          };

          await storage.assignCustomerToSchedule(assignmentData);
          successCount++;
          
          if (successCount % 10 === 0) {
            console.log(`✅ Assigned ${successCount}/${contacts.length} contacts`);
          }
        } catch (error: any) {
          errorCount++;
          const errorMsg = `Failed to assign ${contact.name}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log(`🎉 Bulk assignment complete: ${successCount} successful, ${errorCount} errors`);

      res.json({
        message: "Bulk assignment completed",
        totalContacts: contacts.length,
        successfulAssignments: successCount,
        failedAssignments: errorCount,
        defaultSchedule: {
          id: defaultSchedule.id,
          name: defaultSchedule.name,
        },
        errors: errors.slice(0, 10), // Limit error messages
      });
    } catch (error) {
      console.error("Error in bulk assignment to default schedule:", error);
      res.status(500).json({ message: "Failed to assign customers to default schedule" });
    }
  });

  app.get("/api/collections/automation/check", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { checkCollectionActions } = await import("./services/collectionsAutomation");
      const actions = await checkCollectionActions(user.tenantId);
      res.json(actions);
    } catch (error) {
      console.error("Error checking collection actions:", error);
      res.status(500).json({ message: "Failed to check collection actions" });
    }
  });

  app.get("/api/collections/automation/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { getCollectionsAutomationStatus } = await import("./services/collectionsAutomation");
      const enabled = await getCollectionsAutomationStatus(user.tenantId);
      res.json({ enabled });
    } catch (error) {
      console.error("Error getting automation status:", error);
      res.status(500).json({ message: "Failed to get automation status" });
    }
  });

  app.put("/api/collections/automation/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: "Invalid enabled value - must be boolean" });
      }

      const { setCollectionsAutomation } = await import("./services/collectionsAutomation");
      await setCollectionsAutomation(user.tenantId, enabled);
      res.json({ enabled, message: `Collections automation ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error) {
      console.error("Error updating automation status:", error);
      res.status(500).json({ message: "Failed to update automation status" });
    }
  });

  app.post("/api/actions/bulk-approve", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { actionIds, scheduledFor } = req.body;

      if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
        return res.status(400).json({ message: "actionIds array is required" });
      }

      // Get tenant for execution time
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Calculate execution time
      let execTime: Date;
      if (scheduledFor) {
        execTime = new Date(scheduledFor);
      } else {
        // Default to tomorrow at tenant's execution time
        execTime = new Date();
        execTime.setDate(execTime.getDate() + 1);
        const [hours, minutes] = (tenant.executionTime || '09:00').split(':');
        execTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      // Bulk update actions
      const result = await db.update(actions)
        .set({
          status: 'scheduled',
          scheduledFor: execTime,
          approvedBy: user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.id, actionIds),
            eq(actions.status, 'pending_approval')
          )
        )
        .returning();

      console.log(`✅ Bulk approved ${result.length} actions`);

      res.json({
        message: "Actions approved successfully",
        approvedCount: result.length,
        executionTime: execTime.toISOString(),
      });
    } catch (error: any) {
      console.error("Error bulk approving actions:", error);
      res.status(500).json({ message: `Failed to bulk approve actions: ${error.message}` });
    }
  });

  app.post("/api/actions/bulk-decline", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { actionIds, reason } = req.body;

      if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
        return res.status(400).json({ message: "actionIds array is required" });
      }

      // Bulk update actions to cancelled
      const result = await db.update(actions)
        .set({
          status: 'cancelled',
          metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ declinedBy: user.id, declinedAt: new Date().toISOString(), declineReason: reason || 'Bulk declined' })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.id, actionIds),
            eq(actions.status, 'pending_approval')
          )
        )
        .returning();

      console.log(`✅ Bulk declined ${result.length} actions`);

      res.json({
        message: "Actions declined successfully",
        declinedCount: result.length,
      });
    } catch (error: any) {
      console.error("Error bulk declining actions:", error);
      res.status(500).json({ message: `Failed to bulk decline actions: ${error.message}` });
    }
  });

  app.post("/api/collections/nudge/:invoiceId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.params;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const { nudgeInvoiceToNextAction } = await import("./services/collectionsAutomation");
      const nudgeAction = await nudgeInvoiceToNextAction(invoiceId, user.tenantId);
      
      if (!nudgeAction) {
        return res.status(404).json({ message: "Unable to determine next action for this invoice" });
      }

      console.log(`✅ Nudged invoice ${nudgeAction.invoiceNumber} to action: ${nudgeAction.action}`);
      res.json({ 
        success: true, 
        action: nudgeAction,
        message: `Invoice ${nudgeAction.invoiceNumber} nudged to next action: ${nudgeAction.action}` 
      });
    } catch (error) {
      console.error("Error nudging invoice:", error);
      res.status(500).json({ 
        success: false, 
        message: (error as Error).message || "Failed to nudge invoice" 
      });
    }
  });

  app.post("/api/collections/nudge", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate request body using Zod schema
      const validatedData = nudgeInvoiceSchema.parse(req.body);
      const { invoiceId } = validatedData;

      // Get the invoice and validate it belongs to the tenant
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Import collections automation service to determine next action
      const { nudgeInvoiceToNextAction } = await import("./services/collectionsAutomation");
      const nudgeAction = await nudgeInvoiceToNextAction(invoiceId, user.tenantId);
      
      if (!nudgeAction) {
        return res.status(404).json({ message: "Unable to determine next action for this invoice" });
      }

      console.log(`📧 Executing nudge action for invoice ${nudgeAction.invoiceNumber}: ${nudgeAction.action} (${nudgeAction.actionType})`);

      let actionExecuted = false;
      let actionDetails = '';
      let nextActionDate = new Date();

      // Execute the action based on actionType
      if (nudgeAction.actionType === 'email') {
        // Execute email action
        if (!invoice.contact.email) {
          return res.status(400).json({ message: "Contact email not available for email action" });
        }

        // Get email template and sender
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'email' });
        const defaultSender = await storage.getDefaultEmailSender(user.tenantId);
        
        if (!defaultSender?.email) {
          return res.status(500).json({ message: "No email sender configured in Collection Workflow" });
        }

        // Use template if specified, otherwise create basic message
        let emailContent = nudgeAction.actionDetails?.message || 'Payment reminder regarding outstanding invoice.';
        let emailSubject = nudgeAction.actionDetails?.subject || `Payment Reminder - Invoice ${invoice.invoiceNumber}`;

        if (nudgeAction.templateId) {
          const template = templates.find(t => t.id === nudgeAction.templateId);
          if (template) {
            emailContent = template.content || emailContent;
            emailSubject = template.subject || emailSubject;
          }
        }

        // Process template variables
        const dueDate = new Date(invoice.dueDate);
        const today = new Date();
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        const templateVars = {
          first_name: invoice.contact.name?.split(' ')[0] || 'Valued Customer',
          invoice_number: invoice.invoiceNumber,
          amount: Number(invoice.amount).toLocaleString(),
          due_date: formatDate(invoice.dueDate),
          days_overdue: daysOverdue.toString(),
          company_name: invoice.contact.companyName || '',
          your_name: defaultSender.fromName || defaultSender.name || 'Collections Team'
        };

        // Replace template variables
        Object.entries(templateVars).forEach(([key, value]) => {
          const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          emailContent = emailContent.replace(placeholder, value);
          emailSubject = emailSubject.replace(placeholder, value);
        });

        // Send email using SendGrid
        const { sendEmail } = await import("./services/sendgrid");
        const formattedSender = `${defaultSender.fromName || defaultSender.name} <${defaultSender.email}>`;
        
        const emailSent = await sendEmail({
          to: invoice.contact.email,
          from: formattedSender,
          subject: emailSubject,
          html: emailContent.replace(/\n/g, '<br>'),
          tenantId: user.tenantId,
        });

        if (emailSent) {
          actionExecuted = true;
          actionDetails = `Email sent to ${invoice.contact.email}`;
          nextActionDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // +3 days for email
        }

      } else if (nudgeAction.actionType === 'sms') {
        // Execute SMS action
        if (!invoice.contact.phone) {
          return res.status(400).json({ message: "Contact phone not available for SMS action" });
        }

        const dueDate = new Date(invoice.dueDate);
        const today = new Date();
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        // Send SMS using Twilio
        const { sendPaymentReminderSMS } = await import("./services/twilio");
        const smsResult = await sendPaymentReminderSMS({
          phone: invoice.contact.phone,
          name: invoice.contact.name || 'Customer',
          invoiceNumber: invoice.invoiceNumber,
          amount: Number(invoice.amount),
          daysPastDue: daysOverdue
        });

        if (smsResult.success) {
          actionExecuted = true;
          actionDetails = `SMS sent to ${invoice.contact.phone}`;
          nextActionDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // +1 day for SMS
        }

      } else {
        // For call/manual actions, just log and schedule
        actionExecuted = true;
        actionDetails = `${nudgeAction.actionType} action scheduled`;
        nextActionDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2 days for call/manual
      }

      if (!actionExecuted && (nudgeAction.actionType === 'email' || nudgeAction.actionType === 'sms')) {
        return res.status(500).json({ message: `Failed to send ${nudgeAction.actionType}` });
      }

      // Update invoice with next action details
      await storage.updateInvoice(invoiceId, user.tenantId, {
        nextAction: nudgeAction.action,
        nextActionDate: nextActionDate,
        lastReminderSent: new Date(),
        reminderCount: (invoice.reminderCount || 0) + 1,
        collectionStage: nudgeAction.actionDetails?.escalationLevel || invoice.collectionStage
      });

      // Create audit trail entry
      await storage.createAction({
        tenantId: user.tenantId,
        invoiceId,
        contactId: invoice.contactId,
        userId: user.id,
        type: nudgeAction.actionType,
        status: actionExecuted ? 'completed' : 'scheduled',
        subject: nudgeAction.actionDetails?.subject || `${nudgeAction.action} - Invoice ${invoice.invoiceNumber}`,
        content: actionDetails,
        scheduledFor: nextActionDate,
        completedAt: actionExecuted ? new Date() : undefined,
        metadata: {
          nudgeAction: nudgeAction.action,
          priority: nudgeAction.priority,
          scheduleName: nudgeAction.scheduleName,
          templateId: nudgeAction.templateId
        }
      });

      console.log(`✅ Nudge completed for invoice ${nudgeAction.invoiceNumber}: ${nudgeAction.action} - ${actionDetails}`);

      res.json({
        success: true,
        action: nudgeAction.actionType,
        scheduledFor: nextActionDate.toISOString(),
        message: `${actionDetails || `${nudgeAction.action} scheduled`}`,
        actionDetails: {
          invoiceNumber: invoice.invoiceNumber,
          contactName: invoice.contact.name,
          action: nudgeAction.action,
          actionType: nudgeAction.actionType,
          priority: nudgeAction.priority,
          scheduleName: nudgeAction.scheduleName
        }
      });

    } catch (error) {
      console.error("Error executing nudge action:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({
        success: false,
        message: (error as Error).message || "Failed to execute nudge action"
      });
    }
  });

  app.get("/api/collections/scheduler/status", isOwner, async (req: any, res) => {
    try {
      const { collectionsScheduler } = await import("./services/collectionsScheduler");
      const status = collectionsScheduler.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting scheduler status:", error);
      res.status(500).json({ message: "Failed to get scheduler status" });
    }
  });

  app.post("/api/collections/scheduler/start", isOwner, async (req: any, res) => {
    try {
      const { collectionsScheduler } = await import("./services/collectionsScheduler");
      collectionsScheduler.start();
      res.json({ success: true, message: "Collections scheduler started" });
    } catch (error) {
      console.error("Error starting scheduler:", error);
      res.status(500).json({ message: "Failed to start scheduler" });
    }
  });

  app.post("/api/collections/scheduler/stop", isOwner, async (req: any, res) => {
    try {
      const { collectionsScheduler } = await import("./services/collectionsScheduler");
      collectionsScheduler.stop();
      res.json({ success: true, message: "Collections scheduler stopped" });
    } catch (error) {
      console.error("Error stopping scheduler:", error);
      res.status(500).json({ message: "Failed to stop scheduler" });
    }
  });

  app.post("/api/collections/scheduler/run-now", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Manually trigger a collection run
      const { checkCollectionActions } = await import("./services/collectionsAutomation");
      const actions = await checkCollectionActions(user.tenantId);
      
      res.json({ 
        success: true, 
        actionsFound: actions.length,
        actions,
        message: `Manual collection run completed - ${actions.length} actions found`
      });
    } catch (error) {
      console.error("Error running manual collection:", error);
      res.status(500).json({ message: "Failed to run manual collection" });
    }
  });

  app.get("/api/collections/escalation-rules", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const rules = await storage.getEscalationRules(user.tenantId);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching escalation rules:", error);
      res.status(500).json({ message: "Failed to fetch escalation rules" });
    }
  });

  app.post("/api/collections/escalation-rules", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const ruleData = insertEscalationRuleSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const rule = await storage.createEscalationRule(ruleData);
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating escalation rule:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid rule data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create escalation rule" });
    }
  });

  app.get("/api/collections/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { channel, startDate, endDate } = req.query;
      const analytics = await storage.getChannelAnalytics(user.tenantId, { 
        channel: channel as string, 
        startDate: startDate as string, 
        endDate: endDate as string 
      });
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching channel analytics:", error);
      res.status(500).json({ message: "Failed to fetch channel analytics" });
    }
  });

  app.get("/api/collections/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const dashboard = await storage.getCollectionsDashboard(user.tenantId);
      res.json(dashboard);
    } catch (error) {
      console.error("Error fetching collections dashboard:", error);
      res.status(500).json({ message: "Failed to fetch collections dashboard" });
    }
  });

  app.get("/api/collections/sms/configuration", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get SMS statistics from the database (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const smsActions = await db.select()
        .from(actions)
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            eq(actions.type, 'sms'),
            gte(actions.createdAt, thirtyDaysAgo)
          )
        );

      const messagesSent = smsActions.length;
      const deliveredMessages = smsActions.filter(a => a.status === 'completed').length;
      const failedMessages = smsActions.filter(a => a.status === 'failed').length;
      const deliveryRate = messagesSent > 0 
        ? Math.round((deliveredMessages / messagesSent) * 100) 
        : 0;

      res.json({
        phoneNumber: process.env.VONAGE_PHONE_NUMBER || '+44 7418 317011',
        country: 'United Kingdom',
        countryCode: 'GB',
        capabilities: ['sms', 'voice'],
        provider: 'Vonage',
        status: 'active',
        stats: {
          messagesSent,
          deliveryRate,
          failedMessages
        }
      });
    } catch (error) {
      console.error("Error fetching SMS configuration:", error);
      res.status(500).json({ message: "Failed to fetch SMS configuration" });
    }
  });

  app.get("/api/collections/workflow-templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { category, industry } = req.query;
      const templates = await storage.getWorkflowTemplates({ category, industry });
      res.json(templates);
    } catch (error) {
      console.error("Error fetching workflow templates:", error);
      res.status(500).json({ message: "Failed to fetch workflow templates" });
    }
  });

  app.post("/api/collections/workflow-templates/:templateId/clone", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { templateId } = req.params;
      const { name } = req.body;
      
      const workflow = await storage.cloneWorkflowTemplate(templateId, user.tenantId, name);
      res.status(201).json(workflow);
    } catch (error) {
      console.error("Error cloning workflow template:", error);
      res.status(500).json({ message: "Failed to clone workflow template" });
    }
  });

  app.get("/api/collections/ai-learning/insights", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { CollectionLearningService } = await import("./services/collectionLearningService");
      const learningService = new CollectionLearningService();
      
      const insights = await learningService.getLearningInsights(user.tenantId);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching AI learning insights:", error);
      res.status(500).json({ message: "Failed to fetch AI learning insights" });
    }
  });

  app.post("/api/collections/ai-learning/record-outcome", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const outcomeSchema = z.object({
        actionId: z.string(),
        wasDelivered: z.boolean(),
        wasOpened: z.boolean().optional(),
        wasClicked: z.boolean().optional(),
        wasReplied: z.boolean().optional(),
        replyTime: z.number().optional(),
        replySentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
        ledToPayment: z.boolean(),
        paymentAmount: z.number().optional(),
        paymentDelay: z.number().optional(),
        partialPayment: z.boolean().optional(),
      });

      const outcome = outcomeSchema.parse(req.body);

      const { CollectionLearningService } = await import("./services/collectionLearningService");
      const learningService = new CollectionLearningService();
      
      // Record the effectiveness data
      await learningService.recordActionEffectiveness(outcome);
      
      // Update customer learning profile
      await learningService.updateCustomerProfile(outcome);

      res.status(201).json({ 
        message: "Action outcome recorded successfully",
        aiLearning: true 
      });
    } catch (error) {
      console.error("Error recording action outcome:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid outcome data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to record action outcome" });
    }
  });

  app.get("/api/collections/ai-learning/customer-profile/:contactId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;

      const { CollectionLearningService } = await import("./services/collectionLearningService");
      const learningService = new CollectionLearningService();
      
      const profile = await learningService.getOrCreateCustomerProfile(contactId, user.tenantId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching customer learning profile:", error);
      res.status(500).json({ message: "Failed to fetch customer learning profile" });
    }
  });

  app.post("/api/collections/ai-learning/optimize-actions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const actionsSchema = z.array(z.object({
        invoiceId: z.string(),
        contactId: z.string(),
        invoiceNumber: z.string(),
        contactName: z.string(),
        daysOverdue: z.number(),
        amount: z.string(),
        action: z.string(),
        actionType: z.enum(['email', 'sms', 'voice', 'manual']),
        scheduleName: z.string(),
        templateId: z.string().optional(),
        priority: z.enum(['low', 'normal', 'high', 'urgent']),
        actionDetails: z.object({
          template: z.string().optional(),
          subject: z.string().optional(),
          message: z.string().optional(),
          escalationLevel: z.string().optional(),
        }),
      }));

      const actions = actionsSchema.parse(req.body.actions || req.body);

      const { CollectionLearningService } = await import("./services/collectionLearningService");
      const learningService = new CollectionLearningService();
      
      const optimizedActions = await learningService.optimizeActions(actions);
      
      res.json({
        originalCount: actions.length,
        optimizedCount: optimizedActions.length,
        actions: optimizedActions,
        aiOptimized: true
      });
    } catch (error) {
      console.error("Error optimizing actions with AI:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid actions data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to optimize actions" });
    }
  });
}
