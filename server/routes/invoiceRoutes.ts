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


const invoicesQuerySchema = z.object({
  status: z.enum(['pending', 'overdue', 'paid', 'cancelled', 'open', 'all']).optional().default('open'),
  search: z.string().optional(),
  overdue: z.enum(['paid', 'due', 'overdue', 'serious', 'escalation', '61-90', '90+', 'all']).optional(),
  contactId: z.string().optional(),
  sortBy: z.enum(['date', 'invoiceNumber', 'customer', 'daysOverdue', 'invoiceAge', 'status', 'amount', 'epd']).optional().default('daysOverdue'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number)
});

export function registerInvoiceRoutes(app: Express): void {
  app.get("/api/invoices/interest-summary", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Get all overdue invoices
      const allInvoices = await storage.getInvoices(user.tenantId);
      const overdueInvoices = allInvoices.filter(inv => inv.status === 'overdue');

      // Calculate interest for each invoice
      const invoicesWithInterest = overdueInvoices.map(invoice => {
        const principal = parseFloat(invoice.amount) - parseFloat(invoice.amountPaid || '0');
        const result = calculateLatePaymentInterest({
          principalAmount: principal,
          dueDate: new Date(invoice.dueDate),
          currentDate: new Date(),
          boeBaseRate: parseFloat(tenant.boeBaseRate || '5.00'),
          interestMarkup: parseFloat(tenant.interestMarkup || '8.00'),
          gracePeriod: tenant.interestGracePeriod || 30
        });

        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          contactId: invoice.contactId,
          principal,
          daysOverdue: result.daysOverdue,
          daysAccruing: result.daysAccruing,
          interestAmount: result.interestAmount,
          totalAmountDue: result.totalAmountDue,
          gracePeriodRemaining: result.gracePeriodRemaining,
          annualRate: result.annualRate
        };
      });

      // Calculate totals
      const totalInterest = invoicesWithInterest.reduce((sum, inv) => sum + inv.interestAmount, 0);
      const totalPrincipal = invoicesWithInterest.reduce((sum, inv) => sum + inv.principal, 0);
      const totalWithInterest = invoicesWithInterest.reduce((sum, inv) => sum + inv.totalAmountDue, 0);

      res.json({
        invoices: invoicesWithInterest,
        summary: {
          totalInvoices: invoicesWithInterest.length,
          totalPrincipal: Math.round(totalPrincipal * 100) / 100,
          totalInterest: Math.round(totalInterest * 100) / 100,
          totalWithInterest: Math.round(totalWithInterest * 100) / 100,
          boeBaseRate: parseFloat(tenant.boeBaseRate || '5.00'),
          interestMarkup: parseFloat(tenant.interestMarkup || '8.00'),
          combinedRate: parseFloat(tenant.boeBaseRate || '5.00') + parseFloat(tenant.interestMarkup || '8.00'),
          gracePeriod: tenant.interestGracePeriod || 30
        }
      });
    } catch (error) {
      console.error("Error calculating interest:", error);
      res.status(500).json({ message: "Failed to calculate interest" });
    }
  });

  app.get("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate and parse query parameters using Zod schema
      const validatedQuery = invoicesQuerySchema.parse(req.query);
      const { status, search, overdue, contactId, sortBy, sortDir, page, limit } = validatedQuery;

      const allowedContactIds = await getAssignedContactIds(user);

      console.log(`📊 Optimized Invoices API - Tenant: ${user.tenantId}, Filters: status=${status}, search="${search}", overdue=${overdue}, sortBy=${sortBy}, sortDir=${sortDir}, page=${page}, limit=${limit}${allowedContactIds ? `, restricted to ${allowedContactIds.length} assigned contacts` : ''}`);
      
      // Call optimized storage method with server-side filtering
      const result = await storage.getInvoicesFiltered(user.tenantId, {
        status,
        search,
        overdueCategory: overdue,
        contactId,
        sortBy,
        sortDir,
        page,
        limit
      });

      if (allowedContactIds) {
        result.invoices = result.invoices.filter((inv: any) => inv.contactId && allowedContactIds.includes(inv.contactId));
        result.total = result.invoices.length;
      }

      // Get total system count (all invoices regardless of filters)
      const systemTotal = allowedContactIds
        ? result.total
        : await storage.getInvoicesCount(user.tenantId);
      
      // Fetch EPD-related data for all invoices in the result
      const invoiceIds = result.invoices.map((inv: any) => inv.id);
      const contactIds = [...new Set(result.invoices.map((inv: any) => inv.contactId))];
      
      // Get active PTPs for these invoices (tenant-scoped for security)
      const activePtps = invoiceIds.length > 0 ? await db.select()
        .from(promisesToPay)
        .where(and(
          eq(promisesToPay.tenantId, user.tenantId),
          inArray(promisesToPay.invoiceId, invoiceIds),
          eq(promisesToPay.status, 'active')
        )) : [];
      const ptpByInvoice = new Map(activePtps.map(ptp => [ptp.invoiceId, ptp]));
      
      // Get active payment plans for these contacts
      const activePlans = contactIds.length > 0 ? await db.select()
        .from(paymentPlans)
        .where(and(
          eq(paymentPlans.tenantId, user.tenantId),
          inArray(paymentPlans.contactId, contactIds as string[]),
          eq(paymentPlans.status, 'active')
        )) : [];
      const planByContact = new Map(activePlans.map(plan => [plan.contactId, plan]));
      
      // Get historical avg days to pay for contacts (from paid invoices within this tenant)
      const contactAvgDays = new Map<string, number>();
      if (contactIds.length > 0) {
        const paidInvoices = await db.select({
          contactId: invoices.contactId,
          issueDate: invoices.issueDate,
          paidDate: invoices.paidDate,
        })
        .from(invoices)
        .where(and(
          eq(invoices.tenantId, user.tenantId),
          inArray(invoices.contactId, contactIds as string[]),
          eq(invoices.status, 'paid'),
          isNotNull(invoices.paidDate)
        ));
        
        // Group by contact and calculate average days to pay
        const contactPaymentDays = new Map<string, number[]>();
        for (const inv of paidInvoices) {
          if (inv.paidDate && inv.issueDate) {
            const days = Math.floor((new Date(inv.paidDate).getTime() - new Date(inv.issueDate).getTime()) / (1000 * 60 * 60 * 24));
            if (days >= 0) {
              const existing = contactPaymentDays.get(inv.contactId) || [];
              existing.push(days);
              contactPaymentDays.set(inv.contactId, existing);
            }
          }
        }
        for (const [contactId, days] of contactPaymentDays) {
          if (days.length > 0) {
            contactAvgDays.set(contactId, Math.round(days.reduce((a, b) => a + b, 0) / days.length));
          }
        }
      }
      
      // Calculate EPD for each invoice
      type EpdConfidence = 'high' | 'medium' | 'low';
      type EpdSource = 'ptp' | 'plan' | 'history' | 'due_date';
      
      const calculateEpd = (invoice: any): { date: string; confidence: EpdConfidence; source: EpdSource; sourceLabel: string } => {
        // 1. Check for active PTP (highest confidence)
        const ptp = ptpByInvoice.get(invoice.id);
        if (ptp?.promisedDate) {
          return {
            date: new Date(ptp.promisedDate).toISOString(),
            confidence: 'high',
            source: 'ptp',
            sourceLabel: 'Promise to Pay'
          };
        }
        
        // 2. Check for active payment plan (use next check date or plan start date as EPD proxy)
        const plan = planByContact.get(invoice.contactId);
        if (plan) {
          const planDate = plan.nextCheckDate 
            ? new Date(plan.nextCheckDate) 
            : plan.planStartDate 
              ? new Date(plan.planStartDate) 
              : null;
          if (planDate) {
            return {
              date: planDate.toISOString(),
              confidence: 'high',
              source: 'plan',
              sourceLabel: 'Payment Plan'
            };
          }
        }
        
        // 3. Calculate from historical average days to pay (from issue date)
        const avgDays = contactAvgDays.get(invoice.contactId);
        if (avgDays !== undefined && avgDays > 0) {
          const issueDate = new Date(invoice.issueDate);
          let epdFromHistory = new Date(issueDate.getTime() + avgDays * 24 * 60 * 60 * 1000);
          
          // If historical EPD is in the past, auto-adjust to today +7 days with low confidence
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (epdFromHistory < today) {
            epdFromHistory = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            return {
              date: epdFromHistory.toISOString(),
              confidence: 'low',
              source: 'adjusted',
              sourceLabel: 'Auto-adjusted (+7d)'
            };
          }
          
          return {
            date: epdFromHistory.toISOString(),
            confidence: 'medium',
            source: 'history',
            sourceLabel: `Avg ${avgDays}d to pay`
          };
        }
        
        // 4. Fall back to due date (low confidence)
        // If due date is in the past, auto-adjust to today +7 days
        const dueDate = new Date(invoice.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
          const adjustedDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
          return {
            date: adjustedDate.toISOString(),
            confidence: 'low',
            source: 'adjusted',
            sourceLabel: 'Auto-adjusted (+7d)'
          };
        }
        
        return {
          date: invoice.dueDate,
          confidence: 'low',
          source: 'due_date',
          sourceLabel: 'Due Date'
        };
      };
      
      // Add overdue category info and EPD to each invoice based on status
      const invoicesWithCategories = result.invoices.map((invoice: any) => {
        const epd = invoice.status !== 'paid' ? calculateEpd(invoice) : null;
        
        if (invoice.status === 'paid') {
          // Paid invoices always have category "paid"
          return {
            ...invoice,
            overdueCategory: 'paid',
            overdueCategoryInfo: {
              category: 'paid',
              label: 'Paid',
              color: 'text-green-800',
              bgColor: 'bg-green-100',
              daysOverdue: null
            },
            epd: null
          };
        } else {
          // Pending/overdue invoices get calculated categories
          const categoryInfo = getOverdueCategoryFromDueDate(invoice.dueDate);
          return {
            ...invoice,
            overdueCategory: categoryInfo.category,
            overdueCategoryInfo: categoryInfo,
            epd
          };
        }
      });
      
      console.log(`📊 Server-side filtered results: ${invoicesWithCategories.length}/${result.total} invoices (filtered from ${systemTotal} total)`);
      
      // Get all filtered invoices to calculate aggregates (not just current page)
      const allFilteredResult = await storage.getInvoicesFiltered(user.tenantId, {
        status,
        search,
        overdueCategory: overdue,
        contactId,
        page: 1,
        limit: 10000 // Get all
      });

      // Calculate aggregates across ALL filtered invoices
      const agingBuckets = {
        'total': { amount: 0, count: 0 },
        'due': { amount: 0, count: 0 },
        'overdue': { amount: 0, count: 0 },
        '1-30': { amount: 0, count: 0 },
        '31-60': { amount: 0, count: 0 },
        '61-90': { amount: 0, count: 0 },
        '90+': { amount: 0, count: 0 },
      };
      
      allFilteredResult.invoices.forEach((inv: any) => {
        if (inv.status === 'paid' || inv.status === 'cancelled') return;
        const dueDate = new Date(inv.dueDate);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const amount = Number(inv.amount) || 0;
        const amountPaid = Number(inv.amountPaid) || 0;
        const outstanding = amount - amountPaid;
        
        // Total always includes all outstanding invoices
        agingBuckets['total'].amount += outstanding;
        agingBuckets['total'].count++;
        
        if (daysOverdue <= 0) {
          // Due (not yet overdue)
          agingBuckets['due'].amount += outstanding;
          agingBuckets['due'].count++;
        } else {
          // Overdue (total of all overdue)
          agingBuckets['overdue'].amount += outstanding;
          agingBuckets['overdue'].count++;
          
          // Individual overdue buckets
          if (daysOverdue <= 30) {
            agingBuckets['1-30'].amount += outstanding;
            agingBuckets['1-30'].count++;
          } else if (daysOverdue <= 60) {
            agingBuckets['31-60'].amount += outstanding;
            agingBuckets['31-60'].count++;
          } else if (daysOverdue <= 90) {
            agingBuckets['61-90'].amount += outstanding;
            agingBuckets['61-90'].count++;
          } else {
            agingBuckets['90+'].amount += outstanding;
            agingBuckets['90+'].count++;
          }
        }
      });
      
      const aggregates = {
        totalOutstanding: allFilteredResult.invoices.reduce((sum, inv) => {
          if (inv.status !== 'paid' && inv.status !== 'cancelled') {
            const amount = Number(inv.amount) || 0;
            const amountPaid = Number(inv.amountPaid) || 0;
            return sum + (amount - amountPaid);
          }
          return sum;
        }, 0),
        overdueCount: allFilteredResult.invoices.filter(inv => inv.status === 'overdue').length,
        pendingCount: allFilteredResult.invoices.filter(inv => inv.status === 'pending').length,
        criticalCount: allFilteredResult.invoices.filter(inv => {
          if (inv.status === 'paid' || inv.status === 'cancelled') return false;
          const dueDate = new Date(inv.dueDate);
          const today = new Date();
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysOverdue >= 30;
        }).length,
        totalInvoices: allFilteredResult.total,
        agingBuckets
      };
      
      // Return paginated results with enhanced metadata
      res.json({
        invoices: invoicesWithCategories,
        aggregates,
        pagination: {
          page,
          limit,
          total: result.total,        // Filtered total
          systemTotal: systemTotal,   // Total invoices in system
          totalPages: Math.ceil(result.total / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching filtered invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/invoices/overdue", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const overdueInvoices = await storage.getOverdueInvoices(user.tenantId);
      res.json(overdueInvoices);
    } catch (error) {
      console.error("Error fetching overdue invoices:", error);
      res.status(500).json({ message: "Failed to fetch overdue invoices" });
    }
  });

  app.get("/api/invoices/overdue-categories", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const overdueCategorySummary = await storage.getOverdueCategorySummary(user.tenantId);
      res.json(overdueCategorySummary);
    } catch (error) {
      console.error("Error fetching overdue category summary:", error);
      res.status(500).json({ message: "Failed to fetch overdue category summary" });
    }
  });

  app.get("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const invoice = await storage.getInvoice(req.params.id, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.contactId && !await hasContactAccess(user, invoice.contactId)) {
        return res.status(403).json({ message: "You do not have access to this invoice" });
      }

      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.put("/api/invoices/:id/hold", ...withPermission('invoices:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const invoice = await storage.updateInvoice(req.params.id, user.tenantId, {
        isOnHold: true,
      });

      res.json(invoice);
    } catch (error) {
      console.error("Error holding invoice:", error);
      res.status(500).json({ message: "Failed to hold invoice" });
    }
  });

  app.put("/api/invoices/:id/unhold", ...withPermission('invoices:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const invoice = await storage.updateInvoice(req.params.id, user.tenantId, {
        isOnHold: false,
      });

      res.json(invoice);
    } catch (error) {
      console.error("Error unholding invoice:", error);
      res.status(500).json({ message: "Failed to unhold invoice" });
    }
  });

  app.post("/api/invoices/:id/mark-paid", ...withPermission('invoices:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id: invoiceId } = req.params;

      // Get invoice with contact details
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Get contact details
      const contact = await storage.getContact(invoice.contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Mark invoice as paid
      const updatedInvoice = await storage.updateInvoice(invoiceId, user.tenantId, {
        status: 'paid',
        paidDate: new Date(),
        amountPaid: invoice.amount,
      });

      // Trigger signal collection for manual payment
      signalCollector.recordPaymentEvent({
        contactId: invoice.contactId,
        tenantId: user.tenantId,
        invoiceId: invoice.id,
        amountPaid: parseFloat(invoice.amount),
        invoiceAmount: parseFloat(invoice.amount),
        dueDate: new Date(invoice.dueDate!),
        paidDate: new Date(),
        isPartial: false,
      }).catch((err: Error) => {
        console.error('❌ Failed to record payment signal from manual mark-paid:', err);
      });

      console.log(`📊 Triggered payment signal collection for invoice ${invoice.id} from manual mark-paid`);

      import('./services/emailCommunications.js').then(({ sendPaymentThankYouEmail }) => {
        sendPaymentThankYouEmail(invoice.id, user.tenantId).catch(err =>
          console.error(`[ThankYou] Failed for invoice ${invoice.id}:`, err.message)
        );
      }).catch(err => console.error('[ThankYou] Import failed:', err.message));

      // Send thank you SMS if contact has a phone number
      if (contact.phone) {
        const customerName = contact.name || contact.companyName || "Customer";
        const amount = `£${Number(invoice.amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        const thankYouMessage = `Thank you for your payment of ${amount} for invoice ${invoice.invoiceNumber}! We really appreciate your business.`;

        const vonageService = await import('./services/vonage.js');
        const smsResult = await vonageService.sendSMS({
          to: contact.phone,
          message: thankYouMessage,
        });

        // Log the SMS action
        if (smsResult.success) {
          await storage.createAction({
            tenantId: user.tenantId,
            invoiceId: invoice.id,
            contactId: contact.id,
            type: 'sms',
            status: 'completed',
            subject: 'Payment Thank You SMS',
            content: thankYouMessage,
            completedAt: new Date(),
            metadata: {
              direction: 'outbound',
              messageId: smsResult.messageId,
              recipient: contact.phone,
            },
          });
        }
      }

      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      res.status(500).json({ message: "Failed to mark invoice as paid" });
    }
  });

  app.post("/api/invoices/:id/pause", ...withPermission('invoices:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id: invoiceId } = req.params;
      const { pauseType, reason, pausedUntil, metadata } = req.body;

      // Validate pause type
      const validPauseTypes = ['dispute', 'ptp', 'payment_plan'];
      if (!pauseType || !validPauseTypes.includes(pauseType)) {
        return res.status(400).json({ message: "Invalid pause type. Must be one of: dispute, ptp, payment_plan" });
      }

      if (!reason) {
        return res.status(400).json({ message: "Pause reason is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const { pauseManager } = await import('./lib/pause-manager.js');
      
      await pauseManager.pauseInvoice({
        invoiceId,
        tenantId: user.tenantId,
        pauseType,
        reason,
        pausedUntil: pausedUntil ? new Date(pausedUntil) : undefined,
        metadata: metadata || {},
      });

      res.json({ success: true, message: `Invoice paused: ${reason}` });
    } catch (error) {
      console.error("Error pausing invoice:", error);
      res.status(500).json({ message: "Failed to pause invoice" });
    }
  });

  app.post("/api/invoices/:id/resume", ...withPermission('invoices:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id: invoiceId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "Resume reason is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const { pauseManager } = await import('./lib/pause-manager.js');
      
      await pauseManager.resumeInvoice({
        invoiceId,
        tenantId: user.tenantId,
        reason,
      });

      res.json({ success: true, message: `Invoice resumed: ${reason}` });
    } catch (error) {
      console.error("Error resuming invoice:", error);
      res.status(500).json({ message: "Failed to resume invoice" });
    }
  });

  app.get("/api/invoices/:id/pause-status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id: invoiceId } = req.params;

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const { pauseManager } = await import('./lib/pause-manager.js');
      
      const pauseDetails = await pauseManager.getPauseDetails(invoiceId, user.tenantId);

      res.json({
        isPaused: pauseDetails?.pauseState !== null,
        ...pauseDetails,
      });
    } catch (error) {
      console.error("Error getting pause status:", error);
      res.status(500).json({ message: "Failed to get pause status" });
    }
  });

  app.post("/api/invoices/:id/send-sms", ...withPermission('collections:sms'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id: invoiceId } = req.params;
      const { template } = req.body;

      // Validate template selection
      const validTemplates = ["friendly", "professional", "firm", "urgent"];
      if (!template || !validTemplates.includes(template)) {
        return res.status(400).json({ message: "Invalid SMS template selected" });
      }

      // Get invoice with contact details
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact?.phone) {
        return res.status(400).json({ message: "Contact phone number not available" });
      }

      // SMS template content
      const smsTemplateContent: Record<string, string> = {
        friendly: "Hi {customerName}! Just a friendly reminder that invoice #{invoiceNumber} for {amount} was due on {dueDate}. Thanks!",
        professional: "Payment reminder: Invoice #{invoiceNumber} ({amount}) due {dueDate}. Please process payment. Questions? Reply HELP",
        firm: "NOTICE: Invoice #{invoiceNumber} ({amount}) is past due. Payment required immediately. Contact us to avoid further action.",
        urgent: "URGENT: Invoice #{invoiceNumber} overdue. {amount} payment required NOW to avoid collection action. Call immediately.",
      };

      // Replace template variables
      const customerName = invoice.contact.name || invoice.contact.companyName || "Customer";
      const nameParts = (invoice.contact.name || "").split(' ');
      const firstName = nameParts[0] || invoice.contact.name || "Customer";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : "";
      const companyName = invoice.contact.companyName || "";
      const amount = `£${Number(invoice.amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-GB');
      const today = new Date();
      const due = new Date(invoice.dueDate);
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));

      let message = smsTemplateContent[template];
      // Replace all variables (order matters - do specific ones first)
      message = message
        .replace(/{firstName}/g, firstName)
        .replace(/{lastName}/g, lastName)
        .replace(/{companyName}/g, companyName)
        .replace(/{customerName}/g, customerName)
        .replace(/{invoiceNumber}/g, invoice.invoiceNumber)
        .replace(/{amount}/g, amount)
        .replace(/{dueDate}/g, dueDate)
        .replace(/{daysOverdue}/g, daysOverdue.toString());

      // Send via Vonage
      const vonageService = await import('./services/vonage.js');
      const result = await vonageService.sendSMS({
        to: invoice.contact.phone,
        message: message,
        invoiceId: invoice.id,
        customerId: invoice.contactId,
      });

      if (result.success) {
        // Save SMS to database
        const smsData: any = {
          tenantId: user.tenantId,
          contactId: invoice.contactId,
          invoiceId: invoice.id,
          provider: 'vonage',
          vonageMessageId: result.messageId,
          fromNumber: process.env.VONAGE_PHONE_NUMBER || '',
          toNumber: invoice.contact.phone,
          direction: 'outbound',
          status: 'sent',
          body: message,
          numSegments: Math.ceil(message.length / 160),
          sentAt: new Date(),
        };

        await storage.createSmsMessage(smsData);
        console.log("✅ SMS saved to database");

        // Log the action
        await storage.createAction({
          tenantId: user.tenantId,
          invoiceId: invoice.id,
          contactId: invoice.contactId,
          userId: user.id,
          type: 'sms',
          status: 'completed',
          subject: `SMS Reminder (${template}) - Invoice ${invoice.invoiceNumber}`,
          content: message,
          completedAt: new Date(),
          metadata: { messageId: result.messageId, template },
        });

        // Update invoice reminder tracking
        await storage.updateInvoice(invoiceId, user.tenantId, {
          lastReminderSent: new Date(),
          reminderCount: (invoice.reminderCount || 0) + 1,
        });

        res.json({
          success: true,
          messageId: result.messageId,
          message: "SMS sent successfully",
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Failed to send SMS",
        });
      }
    } catch (error) {
      console.error("Error sending SMS reminder:", error);
      res.status(500).json({ message: "Failed to send SMS reminder" });
    }
  });

  app.post("/api/invoices/:id/initiate-voice-call", ...withPermission('collections:voice'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id: invoiceId } = req.params;
      const { scriptType, agentTierId } = req.body;

      // Validate script type
      const validScripts = ["soft", "professional", "firm", "final"];
      if (!scriptType || !validScripts.includes(scriptType)) {
        return res.status(400).json({ message: "Invalid voice script selected" });
      }

      // Import agent manager
      const { getAgentManager } = await import('./services/agentManager.js');
      const agentManager = getAgentManager();

      // Get invoice with contact details
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact?.phone) {
        return res.status(400).json({ message: "Contact phone number not available" });
      }

      // Get tenant details for organization name
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(400).json({ message: "Tenant not found" });
      }

      // Calculate days overdue
      const today = new Date();
      const due = new Date(invoice.dueDate);
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));

      // Prepare dynamic variables for Retell AI
      const customerName = invoice.contact.name || invoice.contact.companyName || "Customer";
      const nameParts = (invoice.contact.name || "").split(' ');
      const firstName = nameParts[0] || invoice.contact.name || "Customer";
      const amount = `£${Number(invoice.amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      const dynamicVariables = {
        customer_name: customerName,
        first_name: firstName,
        organisation_name: tenant.name,
        invoice_number: invoice.invoiceNumber,
        invoice_amount: amount,
        due_date: dueDate,
        days_overdue: daysOverdue.toString(),
        script_type: scriptType,
        total_outstanding: amount,
      };

      // Determine which agent to use based on selection or days overdue
      let selectedAgent;
      if (agentTierId) {
        // Use explicitly selected agent
        selectedAgent = agentManager.getAgentByTierId(agentTierId);
        if (!selectedAgent) {
          return res.status(400).json({ message: "Invalid agent tier selected" });
        }
      } else {
        // Auto-select based on days overdue
        selectedAgent = agentManager.getAgentForInvoice(daysOverdue);
      }

      // Get or use fallback agent ID
      const agentId = agentManager.getRetellAgentId(selectedAgent.id) || process.env.RETELL_AGENT_ID;
      if (!agentId) {
        return res.status(500).json({ message: "Retell agent not configured" });
      }

      // Import and use RetellService
      const { RetellService } = await import('./retell-service.js');
      const retellService = new RetellService();

      // Initiate call
      const callResult = await retellService.createCall({
        fromNumber: process.env.RETELL_PHONE_NUMBER || '',
        toNumber: invoice.contact.phone,
        agentId: agentId,
        dynamicVariables,
        metadata: {
          tenantId: user.tenantId,
          invoiceId: invoice.id,
          contactId: invoice.contactId,
          scriptType,
          daysOverdue: daysOverdue.toString(),
        },
      });

      console.log(`📞 AI voice call initiated: ${callResult.callId} to ${invoice.contact.phone}`);

      // Log the action
      await storage.createAction({
        tenantId: user.tenantId,
        invoiceId: invoice.id,
        contactId: invoice.contactId,
        userId: user.id,
        type: 'ai_voice',
        status: 'scheduled',
        subject: `AI Voice Call (${selectedAgent.name}) - Invoice ${invoice.invoiceNumber}`,
        content: `Automated collection call initiated to ${customerName} using ${selectedAgent.name}`,
        scheduledFor: new Date(),
        metadata: {
          callId: callResult.callId,
          scriptType,
          agentId: callResult.agentId,
          agentTierId: selectedAgent.id,
          agentName: selectedAgent.name,
          daysOverdue,
        },
      });

      // Update invoice reminder tracking
      await storage.updateInvoice(invoiceId, user.tenantId, {
        lastReminderSent: new Date(),
        reminderCount: (invoice.reminderCount || 0) + 1,
      });

      res.json({
        success: true,
        callId: callResult.callId,
        message: `AI voice call initiated to ${customerName} using ${selectedAgent.name}`,
        toNumber: invoice.contact.phone,
        agentUsed: {
          id: selectedAgent.id,
          name: selectedAgent.name,
          tone: selectedAgent.tone,
        },
      });
    } catch (error: any) {
      console.error("Error initiating AI voice call:", error);
      res.status(500).json({ 
        message: error.message || "Failed to initiate AI voice call" 
      });
    }
  });

  app.get("/api/invoices/outstanding/:contactId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;

      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Get outstanding invoices for the specific contact
      const outstandingInvoices = await storage.getOutstandingInvoicesByContact(user.tenantId, contactId);
      
      res.json(outstandingInvoices);
    } catch (error) {
      console.error("Error fetching outstanding invoices for contact:", error);
      res.status(500).json({ message: "Failed to fetch outstanding invoices", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/invoices", ...withPermission('invoices:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const invoiceData = insertInvoiceSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.post("/api/invoices/:invoiceId/apply-advance", ...withPermission('invoices:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.params;
      const { advancePercentage = "80", feePercentage = "2.5", termDays = 60 } = req.body;

      // Get invoice details
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const outstanding = Number(invoice.amount) - Number(invoice.amountPaid);
      const advanceAmount = (outstanding * Number(advancePercentage)) / 100;
      const feeAmount = (advanceAmount * Number(feePercentage)) / 100;
      const totalRepayment = advanceAmount + feeAmount;
      
      // Calculate repayment due date
      const repaymentDueDate = new Date();
      repaymentDueDate.setDate(repaymentDueDate.getDate() + termDays);

      // Create finance advance record
      const financeAdvance = await storage.createFinanceAdvance({
        tenantId: user.tenantId,
        invoiceId: invoice.id,
        contactId: invoice.contactId,
        invoiceAmount: outstanding.toString(),
        advanceAmount: advanceAmount.toString(),
        advancePercentage: advancePercentage.toString(),
        feeAmount: feeAmount.toString(),
        feePercentage: feePercentage.toString(),
        totalRepayment: totalRepayment.toString(),
        termDays,
        repaymentDueDate,
        status: "funded",
        provider: "qashivo",
      });

      // Create wallet transaction to credit the advance
      const walletTransaction = await storage.createWalletTransaction({
        tenantId: user.tenantId,
        transactionType: "credit",
        transactionDate: new Date(),
        amount: advanceAmount.toString(),
        source: "finance_advance",
        description: `Invoice advance: ${invoice.invoiceNumber}`,
        invoiceId: invoice.id,
        contactId: invoice.contactId,
        financeProvider: "qashivo",
        financeAdvanceId: financeAdvance.id,
        status: "completed",
      });

      // Update finance advance with wallet transaction ID
      await storage.updateFinanceAdvance(financeAdvance.id, user.tenantId, {
        walletTransactionId: walletTransaction.id,
      });

      res.json({
        success: true,
        advance: financeAdvance,
        walletTransaction,
      });
    } catch (error) {
      console.error("Error applying for advance:", error);
      res.status(500).json({ message: "Failed to apply for advance", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/invoices/:invoiceId/accept-insurance", ...withPermission('invoices:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.params;
      const { coverageAmount, monthlyPremium, annualPremium, policyTerm } = req.body;

      // Get invoice details
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Create an action to record the insurance upgrade
      const action = await storage.createAction({
        tenantId: user.tenantId,
        contactId: invoice.contactId,
        invoiceId: invoice.id,
        type: "system",
        subject: `Insurance Upgraded: ${invoice.invoiceNumber}`,
        content: `Full coverage insurance activated. Coverage: ${coverageAmount}, Monthly Premium: ${monthlyPremium}, Annual Premium: ${annualPremium}, Term: ${policyTerm}`,
        status: "completed",
        scheduledFor: null,
        completedAt: new Date(),
        metadata: {
          insuranceActivated: true,
          coverageAmount,
          monthlyPremium,
          annualPremium,
          policyTerm,
          provider: "Qashivo Insurance Partners",
          activatedAt: new Date().toISOString(),
        },
      });

      res.json({
        success: true,
        message: "Insurance coverage activated successfully",
        action,
      });
    } catch (error) {
      console.error("Error activating insurance:", error);
      res.status(500).json({ message: "Failed to activate insurance", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/invoices/:invoiceId/contact-history", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.params;
      
      // Get the invoice to validate access and get contact info
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Get all actions for this invoice and contact
      const allActions = await storage.getActions(user.tenantId);
      const contactHistory = allActions
        .filter(action => 
          action.invoiceId === invoiceId || action.contactId === invoice.contactId
        )
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      res.json(contactHistory);
    } catch (error) {
      console.error("Error fetching contact history:", error);
      res.status(500).json({ message: "Failed to fetch contact history" });
    }
  });

  app.post("/api/invoices/:invoiceId/send-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.params;
      
      // Get invoice with contact details
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact?.email) {
        return res.status(400).json({ message: "No email address found for this contact" });
      }

      // Get default email template and sender
      const templates = await storage.getCommunicationTemplates(user.tenantId);
      const defaultTemplate = templates.find(t => t.name === "GE Invoice");
      const defaultSender = await storage.getDefaultEmailSender(user.tenantId);

      if (!defaultTemplate || !defaultSender) {
        return res.status(500).json({ message: "GE Invoice template or sender not configured. Please create a 'GE Invoice' template in Collections Workflow." });
      }

      // Process template variables for single invoice
      const dueDate = new Date(invoice.dueDate);
      const today = new Date();
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amountOverdue = daysOverdue > 0 ? Number(invoice.amount) : 0;
      
      let processedContent = defaultTemplate.content
        .replace(/\{\{first_name\}\}/g, invoice.contact.name?.split(' ')[0] || 'Valued Customer')
        .replace(/\{\{your_name\}\}/g, defaultSender.fromName || defaultSender.name || 'Accounts Receivable')
        .replace(/\{\{invoice_number\}\}/g, invoice.invoiceNumber)
        .replace(/\{\{amount\}\}/g, `£${Number(invoice.amount).toLocaleString()}`)
        .replace(/\{\{total_balance\}\}/g, `£${Number(invoice.amount).toLocaleString()}`)
        .replace(/\{\{invoice_count\}\}/g, '1')
        .replace(/\{\{due_date\}\}/g, formatDate(invoice.dueDate))
        .replace(/\{\{days_overdue\}\}/g, daysOverdue.toString())
        .replace(/\{\{total_amount_overdue\}\}/g, `£${amountOverdue.toLocaleString()}`)
        .replace(/£X as unpaid/g, `£${Number(invoice.amount).toLocaleString()} as unpaid`)
        .replace(/£X due for payment now/g, `£${Number(invoice.amount).toLocaleString()} due for payment ${daysOverdue > 0 ? `${daysOverdue} days ago` : 'now'}`);

      // Process template subject line with variables
      let processedSubject: string = defaultTemplate.subject || 'Payment Reminder';
      processedSubject = processedSubject
        .replace(/\{\{first_name\}\}/g, invoice.contact.name?.split(' ')[0] || 'Valued Customer')
        .replace(/\{\{your_name\}\}/g, defaultSender.fromName || defaultSender.name || 'Accounts Receivable')
        .replace(/\{\{invoice_number\}\}/g, invoice.invoiceNumber)
        .replace(/\{\{amount\}\}/g, `£${Number(invoice.amount).toLocaleString()}`)
        .replace(/\{\{total_balance\}\}/g, `£${Number(invoice.amount).toLocaleString()}`)
        .replace(/\{\{due_date\}\}/g, formatDate(invoice.dueDate))
        .replace(/\{\{days_overdue\}\}/g, daysOverdue.toString())
        .replace(/\{\{total_amount_overdue\}\}/g, `£${amountOverdue.toLocaleString()}`);
        
      if (daysOverdue > 0) {
        processedSubject = `Overdue Payment - ${processedSubject}`;
      }

      // Send email using SendGrid with properly formatted sender from Collection Workflow
      const { sendEmail } = await import("./services/sendgrid");
      const senderEmail = defaultSender.email;
      const senderName = defaultSender.fromName || defaultSender.name || 'Accounts Receivable';
      
      if (!senderEmail) {
        return res.status(500).json({ message: "Sender email not configured in Collection Workflow" });
      }
      
      const formattedSender = `${senderName} <${senderEmail}>`;
      
      const emailSent = await sendEmail({
        to: invoice.contact.email,
        from: formattedSender,
        subject: processedSubject,
        html: processedContent.replace(/\n/g, '<br>'),
        tenantId: user.tenantId,
      });

      if (emailSent) {
        console.log(`✅ Email sent for invoice ${invoice.invoiceNumber} to ${invoice.contact.email}`);
        res.json({ 
          success: true, 
          message: `Payment reminder sent to ${invoice.contact.name}` 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to send email" 
        });
      }
    } catch (error) {
      console.error("Error sending invoice email:", error);
      res.status(500).json({ 
        success: false, 
        message: (error as Error).message || "Failed to send email" 
      });
    }
  });

  app.post("/api/invoices/:invoiceId/send-email/:actionType", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId, actionType } = req.params;
      
      // Get invoice with contact details
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact?.email) {
        return res.status(400).json({ message: "No email address found for this contact" });
      }

      // Get templates and sender
      const templates = await storage.getCommunicationTemplates(user.tenantId);
      const defaultSender = await storage.getDefaultEmailSender(user.tenantId);

      if (!defaultSender) {
        return res.status(500).json({ message: "Email sender not configured" });
      }

      let templateToUse;
      let processedSubject: string;
      let processedContent: string;
      let successMessage: string;

      switch (actionType) {
        case 'general-chase':
          templateToUse = templates.find(t => t.name === "GE Invoice"); // GE Invoice template
          if (!templateToUse) {
            return res.status(500).json({ message: "GE Invoice template not found. Please create a 'GE Invoice' template in Collections Workflow." });
          }
          
          const dueDate = new Date(invoice.dueDate);
          const today = new Date();
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          const amountOverdue = daysOverdue > 0 ? Number(invoice.amount) : 0;
          
          processedContent = templateToUse.content
            .replace(/\{\{first_name\}\}/g, invoice.contact.name?.split(' ')[0] || 'Valued Customer')
            .replace(/\{\{your_name\}\}/g, defaultSender.fromName || defaultSender.name || 'Accounts Receivable')
            .replace(/\{\{invoice_number\}\}/g, invoice.invoiceNumber)
            .replace(/\{\{amount\}\}/g, `£${Number(invoice.amount).toLocaleString()}`)
            .replace(/\{\{total_balance\}\}/g, `£${Number(invoice.amount).toLocaleString()}`)
            .replace(/\{\{invoice_count\}\}/g, '1')
            .replace(/\{\{due_date\}\}/g, formatDate(invoice.dueDate))
            .replace(/\{\{days_overdue\}\}/g, daysOverdue.toString())
            .replace(/\{\{total_amount_overdue\}\}/g, `£${amountOverdue.toLocaleString()}`)
            .replace(/£X as unpaid/g, `£${Number(invoice.amount).toLocaleString()} as unpaid`)
            .replace(/£X due for payment now/g, `£${Number(invoice.amount).toLocaleString()} due for payment ${daysOverdue > 0 ? `${daysOverdue} days ago` : 'now'}`);

          // Process template subject line with variables
          processedSubject = templateToUse.subject || 'Payment Reminder';
          processedSubject = processedSubject
            .replace(/\{\{first_name\}\}/g, invoice.contact.name?.split(' ')[0] || 'Valued Customer')
            .replace(/\{\{your_name\}\}/g, defaultSender.fromName || defaultSender.name || 'Accounts Receivable')
            .replace(/\{\{invoice_number\}\}/g, invoice.invoiceNumber)
            .replace(/\{\{amount\}\}/g, `£${Number(invoice.amount).toLocaleString()}`)
            .replace(/\{\{total_balance\}\}/g, `£${Number(invoice.amount).toLocaleString()}`)
            .replace(/\{\{due_date\}\}/g, formatDate(invoice.dueDate))
            .replace(/\{\{days_overdue\}\}/g, daysOverdue.toString())
            .replace(/\{\{total_amount_overdue\}\}/g, `£${amountOverdue.toLocaleString()}`);
            
          if (daysOverdue > 0) {
            processedSubject = `Overdue Payment - ${processedSubject}`;
          }
          successMessage = `Payment reminder sent to ${invoice.contact.name}`;
          break;

        case 'invoice-copy':
          processedSubject = `Invoice Copy - ${invoice.invoiceNumber}`;
          processedContent = `Dear ${invoice.contact.name?.split(' ')[0] || 'Valued Customer'},<br><br>
            Please find attached a copy of your invoice as requested.<br><br>
            <strong>Invoice Details:</strong><br>
            • Invoice Number: ${invoice.invoiceNumber}<br>
            • Amount: £${Number(invoice.amount).toLocaleString()}<br>
            • Due Date: ${formatDate(invoice.dueDate)}<br><br>
            If you have any questions, please don't hesitate to contact us.<br><br>
            Best regards,<br>
            ${defaultSender.fromName || defaultSender.name || 'Accounts Receivable'}`;
          successMessage = `Invoice copy sent to ${invoice.contact.name}`;
          break;

        case 'thank-you':
          processedSubject = `Thank You for Your Payment - ${invoice.invoiceNumber}`;
          processedContent = `Dear ${invoice.contact.name?.split(' ')[0] || 'Valued Customer'},<br><br>
            Thank you for your recent payment of £${Number(invoice.amount).toLocaleString()} for invoice ${invoice.invoiceNumber}.<br><br>
            We appreciate your prompt payment and your continued business with us.<br><br>
            Best regards,<br>
            ${defaultSender.fromName || defaultSender.name || 'Accounts Receivable'}`;
          successMessage = `Thank you message sent to ${invoice.contact.name}`;
          break;

        default:
          return res.status(400).json({ message: "Invalid action type" });
      }

      // Send email using SendGrid with properly formatted sender from Collection Workflow
      const { sendEmail } = await import("./services/sendgrid");
      const senderEmail = defaultSender.email;
      const senderName = defaultSender.fromName || defaultSender.name || 'Accounts Receivable';
      
      if (!senderEmail) {
        return res.status(500).json({ message: "Sender email not configured in Collection Workflow" });
      }
      
      const formattedSender = `${senderName} <${senderEmail}>`;
      
      const emailSent = await sendEmail({
        to: invoice.contact.email,
        from: formattedSender,
        subject: processedSubject,
        html: processedContent,
        tenantId: user.tenantId,
      });

      if (emailSent) {
        console.log(`✅ Email (${actionType}) sent for invoice ${invoice.invoiceNumber} to ${invoice.contact.email}`);
        res.json({ 
          success: true, 
          message: successMessage
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to send email" 
        });
      }
    } catch (error) {
      console.error(`Error sending invoice email (${req.params.actionType}):`, error);
      res.status(500).json({ 
        success: false, 
        message: (error as Error).message || "Failed to send email" 
      });
    }
  });

  app.post("/api/invoices/:invoiceId/send-sms/:actionType", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId, actionType } = req.params;
      
      // Get invoice with contact details
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact?.phone) {
        return res.status(400).json({ message: "No phone number found for this contact" });
      }

      let smsMessage;
      let successMessage;

      switch (actionType) {
        case 'general-reminder':
          const dueDate = new Date(invoice.dueDate);
          const today = new Date();
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          smsMessage = `Payment reminder: Invoice ${invoice.invoiceNumber} for £${Number(invoice.amount).toLocaleString()} is ${daysOverdue > 0 ? `${daysOverdue} days overdue` : 'due for payment'}. Please contact us to arrange payment.`;
          successMessage = `SMS reminder sent to ${invoice.contact.name}`;
          break;

        case 'thank-you':
          smsMessage = `Thank you for your payment of £${Number(invoice.amount).toLocaleString()} for invoice ${invoice.invoiceNumber}. We appreciate your business!`;
          successMessage = `Thank you SMS sent to ${invoice.contact.name}`;
          break;

        default:
          return res.status(400).json({ message: "Invalid SMS action type" });
      }

      // Send SMS using Twilio (when implemented)
      // For now, we'll simulate the SMS sending
      console.log(`📱 SMS (${actionType}) would be sent to ${invoice.contact.phone}: ${smsMessage}`);
      
      res.json({ 
        success: true, 
        message: `${successMessage} (SMS functionality simulated)` 
      });

    } catch (error) {
      console.error(`Error sending invoice SMS (${req.params.actionType}):`, error);
      res.status(500).json({ 
        success: false, 
        message: (error as Error).message || "Failed to send SMS" 
      });
    }
  });

  app.post("/api/invoices/send-pdf-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId, customMessage, subject } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      // Get invoice with contact details
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact.email) {
        return res.status(400).json({ message: "Contact email not available" });
      }

      // Get tenant information for company details
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(400).json({ message: "Tenant not found" });
      }

      // Import PDF and email services
      const { generateInvoicePDF } = await import('./services/invoicePDF.js');
      const { sendEmailWithAttachment } = await import('./services/sendgrid.js');

      // Generate PDF
      console.log(`Generating PDF for invoice ${invoice.invoiceNumber}...`);
      const pdfBuffer = await generateInvoicePDF({
        invoiceNumber: invoice.invoiceNumber,
        contactName: invoice.contact.name,
        contactEmail: invoice.contact.email,
        companyName: invoice.contact.companyName || undefined,
        amount: Number(invoice.amount),
        taxAmount: Number(invoice.taxAmount),
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        description: invoice.description || 'Professional Services',
        currency: invoice.currency || 'USD',
        status: invoice.status,
        fromCompany: tenant.name,
        fromAddress: (tenant.settings as any)?.companyAddress || 'Not provided',
        fromEmail: user.email || DEFAULT_FROM_EMAIL,
        fromPhone: (tenant.settings as any)?.companyPhone || 'Not provided'
      });

      console.log(`PDF generated successfully, size: ${Math.round(pdfBuffer.length / 1024)}KB`);

      // Prepare email content
      const emailSubject = subject || `Invoice ${invoice.invoiceNumber} - ${tenant.name}`;
      const defaultMessage = `
Dear ${invoice.contact.name},

Please find attached invoice ${invoice.invoiceNumber} for ${invoice.currency} ${Number(invoice.amount).toFixed(2)}.

Invoice Details:
- Invoice Number: ${invoice.invoiceNumber}
- Issue Date: ${formatDate(invoice.issueDate)}
- Due Date: ${formatDate(invoice.dueDate)}
- Amount: ${invoice.currency} ${Number(invoice.amount).toFixed(2)}
- Status: ${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}

Payment is due by ${formatDate(invoice.dueDate)}. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.

Best regards,
${tenant.name}
      `.trim();

      const htmlMessage = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #17B6C3; margin: 0;">${tenant.name}</h1>
    <p style="color: #666; margin: 5px 0;">Invoice Delivery</p>
  </div>
  
  <p>Dear ${invoice.contact.name},</p>
  
  <p>Please find attached invoice ${invoice.invoiceNumber} for ${invoice.currency} ${Number(invoice.amount).toFixed(2)}.</p>
  
  <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #17B6C3; margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; color: #333;">Invoice Details</h3>
    <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
    <p style="margin: 5px 0;"><strong>Issue Date:</strong> ${formatDate(invoice.issueDate)}</p>
    <p style="margin: 5px 0;"><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
    <p style="margin: 5px 0;"><strong>Amount:</strong> ${invoice.currency} ${Number(invoice.amount).toFixed(2)}</p>
    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${invoice.status === 'paid' ? '#10B981' : invoice.status === 'overdue' ? '#EF4444' : '#F59E0B'};">${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</span></p>
  </div>
  
  <p>Payment is due by <strong>${formatDate(invoice.dueDate)}</strong>. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.</p>
  
  <div style="margin: 30px 0; padding: 15px; background: #f0f9ff; border-radius: 4px;">
    <p style="margin: 0; color: #0369a1; font-size: 14px;"><strong>📎 PDF Invoice attached</strong> - Please open the attached PDF for the complete invoice details.</p>
  </div>
  
  <p>Best regards,<br>
  <strong>${tenant.name}</strong></p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; text-align: center;">
    <p>This email was generated automatically. Please do not reply to this email.</p>
  </div>
</div>
      `;

      // Send email with PDF attachment
      console.log(`Sending email to ${invoice.contact.email}...`);
      const success = await sendEmailWithAttachment({
        to: invoice.contact.email,
        from: user.email || DEFAULT_FROM_EMAIL,
        subject: emailSubject,
        text: customMessage || defaultMessage,
        html: customMessage ? undefined : htmlMessage,
        attachments: [{
          content: pdfBuffer,
          filename: `Invoice-${invoice.invoiceNumber}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }]
      });

      if (success) {
        // Log the action
        await storage.createAction({
          tenantId: user.tenantId,
          invoiceId,
          contactId: invoice.contactId,
          userId: user.id,
          type: 'email',
          status: 'completed',
          subject: emailSubject,
          content: `Invoice PDF sent to ${invoice.contact.email}`,
          completedAt: new Date(),
          metadata: { 
            attachmentType: 'pdf',
            attachmentSize: `${Math.round(pdfBuffer.length / 1024)}KB`,
            fileName: `Invoice-${invoice.invoiceNumber}.pdf`
          },
        });

        // Update invoice reminder count
        await storage.updateInvoice(invoiceId, user.tenantId, {
          lastReminderSent: new Date(),
          reminderCount: (invoice.reminderCount || 0) + 1,
        });
      }

      const result = {
        success,
        message: success 
          ? `Invoice PDF email successfully sent to ${invoice.contact.email}` 
          : "Failed to send invoice PDF email",
        recipientEmail: invoice.contact.email,
        recipientName: invoice.contact.name,
        invoiceNumber: invoice.invoiceNumber,
        invoiceAmount: `${invoice.currency} ${Number(invoice.amount).toFixed(2)}`,
        attachmentSize: `${Math.round(pdfBuffer.length / 1024)}KB`,
        pdfFilename: `Invoice-${invoice.invoiceNumber}.pdf`,
        emailSubject
      };

      console.log('Invoice PDF email result:', result);
      res.json(result);
    } catch (error: any) {
      console.error("Error sending invoice PDF email:", error);
      res.status(500).json({ 
        success: false,
        message: `Failed to send invoice PDF email: ${error.message}`,
        error: error.message 
      });
    }
  });

  app.post('/api/invoices/:id/override', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user?.tenantId) {
        return res.status(400).json({ error: 'No tenant found' });
      }

      const { id } = req.params;
      const { reason, action } = req.body;

      if (!reason || !action) {
        return res.status(400).json({ error: 'reason and action are required' });
      }

      // Get invoice
      const invoice = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (invoice.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Update invoice metadata with override
      const currentMetadata = (invoice[0].metadata as any) || {};
      const updatedMetadata = {
        ...currentMetadata,
        manualOverride: {
          userId,
          reason,
          action,
          timestamp: new Date().toISOString(),
        },
      };

      await db
        .update(invoices)
        .set({ metadata: updatedMetadata })
        .where(eq(invoices.id, id));

      res.json({
        success: true,
        invoiceId: id,
        override: updatedMetadata.manualOverride,
      });
    } catch (error: any) {
      console.error('Invoice override error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
