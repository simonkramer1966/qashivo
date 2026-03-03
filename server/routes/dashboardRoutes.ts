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

import { ForecastEngine, type ForecastConfig, type ForecastScenario } from "@shared/forecast";

const forecastQuerySchema = z.object({
  weeks: z.string().optional().default('13').transform(Number),
  scenario: z.enum(['base', 'optimistic', 'pessimistic', 'custom']).optional().default('base'),
  currency: z.string().optional().default('USD'),
  include_weekends: z.string().optional().default('false')
});

export function registerDashboardRoutes(app: Express): void {
  app.get("/api/dashboard/recent-activity", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Helper function to get time ago
      const getTimeAgo = (date: Date | null): string => {
        if (!date) return 'unknown';
        
        const now = new Date();
        const diffInMs = now.getTime() - new Date(date).getTime();
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInDays === 0) {
          if (diffInHours === 0) return 'just now';
          return `${diffInHours} hour${diffInHours === 1 ? '' : 's'}`;
        } else if (diffInDays === 1) {
          return '1 day';
        } else {
          return `${diffInDays} days`;
        }
      };

      // Helper function to map action types
      const mapActionType = (actionType: string | null): string => {
        const typeMapping: { [key: string]: string } = {
          'email': 'reminder',
          'call': 'call',
          'sms': 'reminder', 
          'reminder': 'reminder',
          'dispute': 'dispute',
          'follow_up': 'reminder',
          'escalation': 'overdue'
        };
        
        return typeMapping[actionType || ''] || 'activity';
      };

      // Get recent actions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentActions = await db
        .select({
          id: actions.id,
          type: actions.type,
          status: actions.status,
          createdAt: actions.createdAt,
          contactName: contacts.name,
          invoiceNumber: invoices.invoiceNumber,
          invoiceAmount: invoices.amount,
        })
        .from(actions)
        .leftJoin(contacts, eq(actions.contactId, contacts.id))
        .leftJoin(invoices, eq(actions.invoiceId, invoices.id))
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            gte(actions.createdAt, thirtyDaysAgo)
          )
        )
        .orderBy(desc(actions.createdAt))
        .limit(10);

      // Get recent bank transactions (payments, last 30 days)
      const recentPayments = await db
        .select({
          id: bankTransactions.id,
          amount: bankTransactions.amount,
          description: bankTransactions.description,
          createdAt: bankTransactions.createdAt,
          contactName: contacts.name,
          type: bankTransactions.type,
        })
        .from(bankTransactions)
        .leftJoin(contacts, eq(bankTransactions.contactId, contacts.id))
        .where(
          and(
            eq(bankTransactions.tenantId, user.tenantId),
            gte(bankTransactions.createdAt, thirtyDaysAgo)
          )
        )
        .orderBy(desc(bankTransactions.createdAt))
        .limit(10);

      // Define activity type
      interface Activity {
        id: string;
        type: string;
        customer: string;
        amount: number;
        time: string;
        timestamp: Date | null;
        source: 'action' | 'payment';
      }

      // Combine and format the activities
      const activities: Activity[] = [];

      // Add collection actions
      recentActions.forEach(action => {
        const timeAgo = getTimeAgo(action.createdAt);
        activities.push({
          id: action.id,
          type: mapActionType(action.type),
          customer: action.contactName || 'Unknown Contact',
          amount: action.invoiceAmount || 0,
          time: timeAgo,
          timestamp: action.createdAt,
          source: 'action'
        });
      });

      // Add payments
      recentPayments.forEach(payment => {
        const timeAgo = getTimeAgo(payment.createdAt);
        activities.push({
          id: payment.id,
          type: 'payment',
          customer: payment.contactName || 'Unknown Contact',
          amount: Math.abs(payment.amount || 0),
          time: timeAgo,
          timestamp: payment.createdAt,
          source: 'payment'
        });
      });

      // Sort by timestamp (most recent first) and limit to 8
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const recentActivities = activities.slice(0, 8);

      res.json(recentActivities);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  app.get("/api/dashboard/top-debtors", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get top debtors by outstanding amount
      const topDebtors = await db
        .select({
          id: contacts.id,
          company: contacts.name,
          totalOutstanding: sql<number>`SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL))`,
          invoiceCount: sql<number>`COUNT(${invoices.id})`,
          oldestInvoiceDate: sql<Date>`MIN(${invoices.dueDate})`,
          contactEmail: contacts.email,
          contactPhone: contacts.phone,
        })
        .from(contacts)
        .leftJoin(invoices, and(
          eq(invoices.contactId, contacts.id),
          eq(invoices.tenantId, user.tenantId),
          sql`CAST(${invoices.amount} AS DECIMAL) > CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)` // Only unpaid invoices
        ))
        .where(eq(contacts.tenantId, user.tenantId))
        .groupBy(contacts.id, contacts.name, contacts.email, contacts.phone)
        .having(sql`SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)) > 0`)
        .orderBy(sql`SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)) DESC`)
        .limit(10);

      // Format the response
      const formattedDebtors = topDebtors.map((debtor, index) => ({
        id: debtor.id,
        rank: index + 1,
        company: debtor.company || 'Unknown Company',
        amount: Number(debtor.totalOutstanding) || 0,
        invoiceCount: Number(debtor.invoiceCount) || 0,
        oldestInvoiceDate: debtor.oldestInvoiceDate,
        email: debtor.contactEmail,
        phone: debtor.contactPhone,
      }));

      res.json(formattedDebtors);
    } catch (error) {
      console.error("Error fetching top debtors:", error);
      res.status(500).json({ message: "Failed to fetch top debtors" });
    }
  });

  app.get("/api/dashboard/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`📊 Dashboard metrics - tenantId: ${user.tenantId}`);
      
      const [metrics, debtRecoveryMetrics, ptpStats] = await Promise.all([
        storage.getInvoiceMetrics(user.tenantId),
        storage.getDebtRecoveryMetrics(user.tenantId),
        storage.getPromisesKeptRate(user.tenantId)
      ]);
      
      console.log(`📊 Dashboard metrics result - collectedThisMonth: ${metrics.collectedThisMonth}, collectedThisWeek: ${metrics.collectedThisWeek}`);
      
      res.json({
        ...metrics,
        ...debtRecoveryMetrics,
        promisesKeptRate: ptpStats.rate
      });
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.get("/api/dashboard/cash-inflow", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const range = parseInt(req.query.range as string) || 60;
      const bucket = (req.query.bucket as "day" | "week") || "week";
      
      const validRanges = [30, 60, 90];
      const rangeDays = validRanges.includes(range) ? range : 60;
      const bucketType = bucket === "day" ? "day" : "week";

      const result = await computeCashInflow(user.tenantId, rangeDays, bucketType);
      res.json(result);
    } catch (error) {
      console.error("Error computing cash inflow forecast:", error);
      res.status(500).json({ message: "Failed to compute cash inflow forecast" });
    }
  });

  app.get("/api/dashboard/leaderboards", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get all invoices for the tenant
      const allInvoices = await storage.getInvoices(user.tenantId);
      
      // Calculate payment behavior per contact
      const contactPaymentMap = new Map<string, {
        contactId: string;
        contactName: string;
        totalPaid: number;
        paidCount: number;
        totalDaysToPay: number;
        avgDaysToPay: number;
        outstanding: number;
        overdueCount: number;
      }>();

      for (const invoice of allInvoices) {
        if (!contactPaymentMap.has(invoice.contactId)) {
          const contact = await storage.getContact(invoice.contactId, user.tenantId);
          contactPaymentMap.set(invoice.contactId, {
            contactId: invoice.contactId,
            contactName: contact?.companyName || contact?.name || 'Unknown',
            totalPaid: 0,
            paidCount: 0,
            totalDaysToPay: 0,
            avgDaysToPay: 0,
            outstanding: 0,
            overdueCount: 0
          });
        }

        const contactData = contactPaymentMap.get(invoice.contactId)!;
        
        // Calculate for paid invoices
        if (invoice.status === 'paid' && invoice.paidDate && invoice.issueDate) {
          const daysToPay = Math.floor((new Date(invoice.paidDate).getTime() - new Date(invoice.issueDate).getTime()) / (1000 * 3600 * 24));
          contactData.paidCount++;
          contactData.totalDaysToPay += daysToPay;
          contactData.totalPaid += parseFloat(invoice.amount);
        }
        
        // Calculate outstanding
        if (invoice.status === 'overdue' || invoice.status === 'pending') {
          const outstanding = parseFloat(invoice.amount) - parseFloat(invoice.amountPaid || '0');
          contactData.outstanding += outstanding;
          
          if (invoice.status === 'overdue') {
            contactData.overdueCount++;
          }
        }
      }

      // Calculate average days to pay
      contactPaymentMap.forEach(data => {
        if (data.paidCount > 0) {
          data.avgDaysToPay = Math.round(data.totalDaysToPay / data.paidCount);
        }
      });

      // Filter contacts with at least one paid invoice
      const contactsWithPayments = Array.from(contactPaymentMap.values())
        .filter(c => c.paidCount > 0);

      // Best payers (lowest avg days to pay)
      const bestPayers = contactsWithPayments
        .sort((a, b) => a.avgDaysToPay - b.avgDaysToPay)
        .slice(0, 10)
        .map((c, idx) => ({
          rank: idx + 1,
          contactId: c.contactId,
          contactName: c.contactName,
          avgDaysToPay: c.avgDaysToPay,
          paidCount: c.paidCount,
          totalPaid: c.totalPaid
        }));

      // Worst payers (highest avg days to pay)
      const worstPayers = contactsWithPayments
        .sort((a, b) => b.avgDaysToPay - a.avgDaysToPay)
        .slice(0, 10)
        .map((c, idx) => ({
          rank: idx + 1,
          contactId: c.contactId,
          contactName: c.contactName,
          avgDaysToPay: c.avgDaysToPay,
          paidCount: c.paidCount,
          totalPaid: c.totalPaid
        }));

      // Top outstanding (highest current outstanding balance)
      const topOutstanding = Array.from(contactPaymentMap.values())
        .filter(c => c.outstanding > 0)
        .sort((a, b) => b.outstanding - a.outstanding)
        .slice(0, 10)
        .map((c, idx) => ({
          rank: idx + 1,
          contactId: c.contactId,
          contactName: c.contactName,
          outstanding: c.outstanding,
          overdueCount: c.overdueCount
        }));

      // Calculate interest summary for the metrics card
      const overdueInvoices = allInvoices.filter(inv => inv.status === 'overdue');
      const tenant = await storage.getTenant(user.tenantId);
      
      let interestSummary = {
        totalInterest: 0,
        totalPrincipal: 0,
        totalWithInterest: 0,
        combinedRate: parseFloat(tenant?.boeBaseRate || '5.00') + parseFloat(tenant?.interestMarkup || '8.00'),
        gracePeriod: tenant?.interestGracePeriod || 30
      };

      if (overdueInvoices.length > 0 && tenant) {
        overdueInvoices.forEach(invoice => {
          const principal = parseFloat(invoice.amount) - parseFloat(invoice.amountPaid || '0');
          const result = calculateLatePaymentInterest({
            principalAmount: principal,
            dueDate: new Date(invoice.dueDate),
            currentDate: new Date(),
            boeBaseRate: parseFloat(tenant.boeBaseRate || '5.00'),
            interestMarkup: parseFloat(tenant.interestMarkup || '8.00'),
            gracePeriod: tenant.interestGracePeriod || 30
          });
          
          interestSummary.totalInterest += result.interestAmount;
          interestSummary.totalPrincipal += principal;
          interestSummary.totalWithInterest += result.totalAmountDue;
        });
        
        // Round to 2 decimal places
        interestSummary.totalInterest = Math.round(interestSummary.totalInterest * 100) / 100;
        interestSummary.totalPrincipal = Math.round(interestSummary.totalPrincipal * 100) / 100;
        interestSummary.totalWithInterest = Math.round(interestSummary.totalWithInterest * 100) / 100;
      }

      res.json({
        bestPayers,
        worstPayers,
        topOutstanding,
        summary: interestSummary
      });
    } catch (error) {
      console.error("Error fetching dashboard leaderboards:", error);
      res.status(500).json({ message: "Failed to fetch leaderboards" });
    }
  });

  app.get('/api/analytics/cashflow-forecast', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get all invoices for cash flow analysis
      const invoices = await storage.getInvoices(user.tenantId, 5000);
      const now = new Date();
      const next90Days = Array.from({ length: 90 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        return date;
      });

      // Calculate expected inflows for each day
      const forecastData = next90Days.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        
        // Find invoices due on this date
        const dueTodayInvoices = invoices.filter(invoice => {
          const dueDate = new Date(invoice.dueDate);
          return dueDate.toISOString().split('T')[0] === dateStr;
        });

        const totalDue = dueTodayInvoices.reduce((sum, inv) => {
          const outstanding = Number(inv.amount) - Number(inv.amountPaid);
          return sum + outstanding;
        }, 0);

        // Apply confidence scenarios based on invoice age and payment history
        const optimistic = totalDue * 0.95; // 95% collection rate
        const realistic = totalDue * 0.75;  // 75% collection rate (typical)
        const pessimistic = totalDue * 0.55; // 55% collection rate

        return {
          date: dateStr,
          expectedInflow: Math.round(realistic),
          optimisticInflow: Math.round(optimistic),
          pessimisticInflow: Math.round(pessimistic),
          invoiceCount: dueTodayInvoices.length,
          averageAmount: dueTodayInvoices.length > 0 ? Math.round(totalDue / dueTodayInvoices.length) : 0
        };
      });

      // Calculate running balances
      let runningBalance = 0;
      let optimisticBalance = 0;
      let pessimisticBalance = 0;

      const forecastWithBalances = forecastData.map(day => {
        runningBalance += day.expectedInflow;
        optimisticBalance += day.optimisticInflow;
        pessimisticBalance += day.pessimisticInflow;

        return {
          ...day,
          runningBalance: Math.round(runningBalance),
          optimisticBalance: Math.round(optimisticBalance),
          pessimisticBalance: Math.round(pessimisticBalance)
        };
      });

      // Calculate summary metrics
      const totalExpected = Math.round(forecastData.reduce((sum, day) => sum + day.expectedInflow, 0));
      const totalOptimistic = Math.round(forecastData.reduce((sum, day) => sum + day.optimisticInflow, 0));
      const totalPessimistic = Math.round(forecastData.reduce((sum, day) => sum + day.pessimisticInflow, 0));

      res.json({
        forecast: forecastWithBalances,
        summary: {
          totalExpected,
          totalOptimistic,
          totalPessimistic,
          confidenceRange: totalOptimistic - totalPessimistic,
          averageDailyInflow: Math.round(totalExpected / 90),
          peakDay: forecastWithBalances.reduce((max, day) => 
            day.expectedInflow > max.expectedInflow ? day : max
          )
        }
      });

    } catch (error) {
      console.error("Error generating cash flow forecast:", error);
      res.status(500).json({ message: "Failed to generate cash flow forecast" });
    }
  });

  app.get('/api/analytics/aging-analysis', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const invoices = await storage.getInvoices(user.tenantId, 5000);
      const now = new Date();

      // Define age buckets
      type InvoiceWithOutstanding = (Invoice & { contact: Contact }) & { daysOverdue: number; outstanding: number };
      const buckets: {
        label: string;
        min: number;
        max: number;
        invoices: InvoiceWithOutstanding[];
        amount: number;
      }[] = [
        { label: "0-30 days", min: 0, max: 30, invoices: [], amount: 0 },
        { label: "31-60 days", min: 31, max: 60, invoices: [], amount: 0 },
        { label: "61-90 days", min: 61, max: 90, invoices: [], amount: 0 },
        { label: "90+ days", min: 91, max: Infinity, invoices: [], amount: 0 }
      ];

      // Categorize invoices by age
      invoices.forEach(invoice => {
        if (invoice.status !== 'paid') {
          const dueDate = new Date(invoice.dueDate);
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          const outstanding = Number(invoice.amount) - Number(invoice.amountPaid);

          const bucket = buckets.find(b => daysOverdue >= b.min && daysOverdue <= b.max);
          if (bucket) {
            bucket.invoices.push({
              ...invoice,
              daysOverdue,
              outstanding: Math.round(outstanding)
            });
            bucket.amount += outstanding;
          }
        }
      });

      // Calculate percentages and top customers
      const totalAmount = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
      const totalCount = buckets.reduce((sum, bucket) => sum + bucket.invoices.length, 0);

      const agingData = buckets.map(bucket => {
        // Get top 5 customers by outstanding amount in this bucket
        const customerAmounts = bucket.invoices.reduce((acc: Record<string, number>, invoice) => {
          const customerName = invoice.contact.name;
          acc[customerName] = (acc[customerName] || 0) + invoice.outstanding;
          return acc;
        }, {});

        const topCustomers = Object.entries(customerAmounts)
          .map(([name, amount]: [string, any]) => ({ name, amount: Math.round(amount) }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        return {
          bucket: bucket.label,
          amount: Math.round(bucket.amount),
          count: bucket.invoices.length,
          percentage: totalAmount > 0 ? Number((bucket.amount / totalAmount * 100).toFixed(1)) : 0,
          countPercentage: totalCount > 0 ? Number((bucket.invoices.length / totalCount * 100).toFixed(1)) : 0,
          averageAmount: bucket.invoices.length > 0 ? Math.round(bucket.amount / bucket.invoices.length) : 0,
          topCustomers
        };
      });

      res.json({
        aging: agingData,
        summary: {
          totalOutstanding: Math.round(totalAmount),
          totalInvoices: totalCount,
          averageAge: Math.round(
            invoices
              .filter(inv => inv.status !== 'paid')
              .reduce((sum, inv) => {
                const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                return sum + Math.max(0, daysOverdue);
              }, 0) / Math.max(1, totalCount)
          ),
          oldestInvoice: Math.max(...invoices
            .filter(inv => inv.status !== 'paid')
            .map(inv => Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
            , 0)
        }
      });

    } catch (error) {
      console.error("Error generating aging analysis:", error);
      res.status(500).json({ message: "Failed to generate aging analysis" });
    }
  });

  app.get('/api/analytics/collection-performance', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get actions and invoices for performance analysis
      const actions = await storage.getActions(user.tenantId, 5000);
      const invoices = await storage.getInvoices(user.tenantId, 5000);

      // Group actions by communication type
      const performanceByMethod = {
        email: { sent: 0, responded: 0, converted: 0, totalCost: 0, avgTimeToPay: 0 },
        sms: { sent: 0, responded: 0, converted: 0, totalCost: 0, avgTimeToPay: 0 },
        voice: { sent: 0, responded: 0, converted: 0, totalCost: 0, avgTimeToPay: 0 },
        other: { sent: 0, responded: 0, converted: 0, totalCost: 0, avgTimeToPay: 0 }
      };

      // Analyze actions
      actions.forEach(action => {
        const method = action.type === 'email' ? 'email' : 
                     action.type === 'sms' ? 'sms' : 
                     action.type === 'call' ? 'voice' : 'other';
        
        if (action.status === 'completed') {
          performanceByMethod[method].sent += 1;
          
          // Estimate costs per communication type
          const costs = { email: 0.1, sms: 0.5, voice: 2.0, other: 0.2 };
          performanceByMethod[method].totalCost += costs[method];
          
          // Simulate response and conversion rates based on method effectiveness
          const responseRates = { email: 0.25, sms: 0.45, voice: 0.65, other: 0.15 };
          const conversionRates = { email: 0.12, sms: 0.18, voice: 0.35, other: 0.08 };
          
          if (Math.random() < responseRates[method]) {
            performanceByMethod[method].responded += 1;
          }
          
          if (Math.random() < conversionRates[method]) {
            performanceByMethod[method].converted += 1;
          }
        }
      });

      // Calculate metrics for each method
      const performanceData = Object.entries(performanceByMethod).map(([method, data]) => {
        const successRate = data.sent > 0 ? Number((data.converted / data.sent * 100).toFixed(1)) : 0;
        const responseRate = data.sent > 0 ? Number((data.responded / data.sent * 100).toFixed(1)) : 0;
        const costPerCollection = data.converted > 0 ? Number((data.totalCost / data.converted).toFixed(2)) : 0;
        
        // Estimate average time to payment based on method effectiveness
        const avgTimes: Record<string, number> = { email: 14, sms: 10, voice: 7, other: 18 };
        
        return {
          method: method.charAt(0).toUpperCase() + method.slice(1),
          sent: data.sent,
          responded: data.responded,
          converted: data.converted,
          successRate,
          responseRate,
          totalCost: Number(data.totalCost.toFixed(2)),
          costPerCollection,
          avgTimeToPay: avgTimes[method] || 15,
          roi: costPerCollection > 0 ? Number((100 / costPerCollection).toFixed(1)) : 0
        };
      }).filter(item => item.sent > 0); // Only include methods that were actually used

      // Calculate overall performance metrics
      const totalSent = performanceData.reduce((sum, item) => sum + item.sent, 0);
      const totalConverted = performanceData.reduce((sum, item) => sum + item.converted, 0);
      const totalCost = performanceData.reduce((sum, item) => sum + item.totalCost, 0);

      res.json({
        performance: performanceData,
        summary: {
          totalCommunications: totalSent,
          totalConversions: totalConverted,
          overallSuccessRate: totalSent > 0 ? Number((totalConverted / totalSent * 100).toFixed(1)) : 0,
          totalCost: Number(totalCost.toFixed(2)),
          averageCostPerCollection: totalConverted > 0 ? Number((totalCost / totalConverted).toFixed(2)) : 0,
          bestPerformingMethod: performanceData.reduce((best, current) => 
            current.successRate > best.successRate ? current : best, 
            performanceData[0] || { method: 'None', successRate: 0 }
          ).method,
          mostCostEffective: performanceData.reduce((best, current) => 
            current.costPerCollection < best.costPerCollection ? current : best,
            performanceData[0] || { method: 'None', costPerCollection: 0 }
          ).method
        }
      });

    } catch (error) {
      console.error("Error generating collection performance analysis:", error);
      res.status(500).json({ message: "Failed to generate collection performance analysis" });
    }
  });

  app.get('/api/analytics/customer-risk-matrix', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const contacts = await storage.getContacts(user.tenantId);
      const invoices = await storage.getInvoices(user.tenantId, 5000);
      const now = new Date();

      // Calculate risk scores for each customer
      const customerRiskData = contacts.map(contact => {
        const customerInvoices = invoices.filter(inv => inv.contactId === contact.id);
        
        if (customerInvoices.length === 0) {
          return {
            customerId: contact.id,
            customerName: contact.name,
            riskScore: 0,
            riskLevel: 'No Data',
            totalOutstanding: 0,
            invoiceCount: 0,
            avgDaysOverdue: 0,
            paymentHistory: 'insufficient-data'
          };
        }

        // Calculate various risk factors
        const totalOutstanding = customerInvoices.reduce((sum, inv) => {
          return sum + (Number(inv.amount) - Number(inv.amountPaid));
        }, 0);

        const overdueInvoices = customerInvoices.filter(inv => {
          return inv.status !== 'paid' && new Date(inv.dueDate) < now;
        });

        const avgDaysOverdue = overdueInvoices.length > 0 ? 
          overdueInvoices.reduce((sum, inv) => {
            const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            return sum + Math.max(0, daysOverdue);
          }, 0) / overdueInvoices.length : 0;

        const paidInvoices = customerInvoices.filter(inv => inv.status === 'paid');
        const paymentRate = customerInvoices.length > 0 ? paidInvoices.length / customerInvoices.length : 0;

        // Calculate risk score (0-100, higher = riskier)
        let riskScore = 0;
        
        // Outstanding amount factor (0-25 points)
        if (totalOutstanding > 50000) riskScore += 25;
        else if (totalOutstanding > 20000) riskScore += 18;
        else if (totalOutstanding > 10000) riskScore += 12;
        else if (totalOutstanding > 5000) riskScore += 8;
        
        // Days overdue factor (0-30 points)
        if (avgDaysOverdue > 90) riskScore += 30;
        else if (avgDaysOverdue > 60) riskScore += 22;
        else if (avgDaysOverdue > 30) riskScore += 15;
        else if (avgDaysOverdue > 0) riskScore += 8;
        
        // Payment history factor (0-25 points)
        if (paymentRate < 0.3) riskScore += 25;
        else if (paymentRate < 0.5) riskScore += 18;
        else if (paymentRate < 0.7) riskScore += 12;
        else if (paymentRate < 0.9) riskScore += 6;
        
        // Number of overdue invoices factor (0-20 points)
        if (overdueInvoices.length > 10) riskScore += 20;
        else if (overdueInvoices.length > 5) riskScore += 15;
        else if (overdueInvoices.length > 2) riskScore += 10;
        else if (overdueInvoices.length > 0) riskScore += 5;

        // Determine risk level
        let riskLevel = 'Low';
        let paymentHistory = 'good';
        
        if (riskScore >= 70) {
          riskLevel = 'Critical';
          paymentHistory = 'poor';
        } else if (riskScore >= 50) {
          riskLevel = 'High';
          paymentHistory = 'concerning';
        } else if (riskScore >= 30) {
          riskLevel = 'Medium';
          paymentHistory = 'fair';
        } else if (riskScore >= 15) {
          riskLevel = 'Low-Medium';
          paymentHistory = 'good';
        } else {
          paymentHistory = 'excellent';
        }

        return {
          customerId: contact.id,
          customerName: contact.name,
          riskScore: Math.round(riskScore),
          riskLevel,
          totalOutstanding: Math.round(totalOutstanding),
          invoiceCount: customerInvoices.length,
          overdueCount: overdueInvoices.length,
          avgDaysOverdue: Math.round(avgDaysOverdue),
          paymentRate: Number((paymentRate * 100).toFixed(1)),
          paymentHistory,
          lastPaymentDate: paidInvoices.length > 0 ? 
            Math.max(...paidInvoices.filter(inv => inv.paidDate).map(inv => new Date(inv.paidDate!).getTime())) : null
        };
      }).filter(customer => customer.invoiceCount > 0); // Only include customers with invoices

      // Sort by risk score descending
      customerRiskData.sort((a, b) => b.riskScore - a.riskScore);

      // Calculate risk distribution
      const riskDistribution = {
        critical: customerRiskData.filter(c => c.riskLevel === 'Critical').length,
        high: customerRiskData.filter(c => c.riskLevel === 'High').length,
        medium: customerRiskData.filter(c => c.riskLevel === 'Medium').length,
        lowMedium: customerRiskData.filter(c => c.riskLevel === 'Low-Medium').length,
        low: customerRiskData.filter(c => c.riskLevel === 'Low').length
      };

      // Calculate portfolio metrics
      const totalOutstanding = customerRiskData.reduce((sum, customer) => sum + customer.totalOutstanding, 0);
      const highRiskOutstanding = customerRiskData
        .filter(c => c.riskLevel === 'Critical' || c.riskLevel === 'High')
        .reduce((sum, customer) => sum + customer.totalOutstanding, 0);

      res.json({
        customers: customerRiskData.slice(0, 100), // Limit to top 100 riskiest customers
        riskDistribution,
        summary: {
          totalCustomers: customerRiskData.length,
          totalOutstanding: Math.round(totalOutstanding),
          highRiskOutstanding: Math.round(highRiskOutstanding),
          highRiskPercentage: totalOutstanding > 0 ? Number((highRiskOutstanding / totalOutstanding * 100).toFixed(1)) : 0,
          averageRiskScore: customerRiskData.length > 0 ? 
            Math.round(customerRiskData.reduce((sum, c) => sum + c.riskScore, 0) / customerRiskData.length) : 0,
          criticalCustomers: riskDistribution.critical,
          topRiskCustomers: customerRiskData.slice(0, 10).map(c => ({
            name: c.customerName,
            riskScore: c.riskScore,
            outstanding: c.totalOutstanding
          }))
        }
      });

    } catch (error) {
      console.error("Error generating customer risk matrix:", error);
      res.status(500).json({ message: "Failed to generate customer risk matrix" });
    }
  });

  app.get('/api/analytics/automation-performance', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { timeframe = '30d' } = req.query;
      
      // Get base data
      const contacts = await storage.getContacts(user.tenantId);
      const invoices = await storage.getInvoices(user.tenantId, 5000);
      const schedules = await storage.getCollectionSchedules(user.tenantId);
      const assignments = await storage.getCustomerScheduleAssignments(user.tenantId);
      const actions = await storage.getActions(user.tenantId);

      const now = new Date();
      const timeframeMs = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000
      }[timeframe as string] || 30 * 24 * 60 * 60 * 1000;
      
      const startDate = new Date(now.getTime() - timeframeMs);

      // Calculate automation overview
      const totalContacts = contacts.length;
      const automatedContacts = assignments.filter(a => a.isActive).length;
      const automationCoveragePercentage = totalContacts > 0 ? Math.round((automatedContacts / totalContacts) * 100) : 0;

      // Calculate real success rates from actions within timeframe
      const timeframeActions = actions.filter(action => 
        action.createdAt && new Date(action.createdAt) >= startDate
      );
      
      const completedActions = timeframeActions.filter(a => a.status === 'completed');
      const failedActions = timeframeActions.filter(a => a.status === 'failed');
      const totalActionsInTimeframe = timeframeActions.length;
      
      // Real success rate calculation: completed actions / total actions
      const averageSuccessRate = totalActionsInTimeframe > 0 ? 
        Math.round((completedActions.length / totalActionsInTimeframe) * 100) : 0;

      const emailActions = completedActions.filter(a => a.type === 'email');
      const smsActions = completedActions.filter(a => a.type === 'sms');
      const callActions = completedActions.filter(a => a.type === 'voice' || a.type === 'call');

      // Real cost savings calculation based on automation
      const estimatedManualCostPerAction = 8.50; // $8.50 per manual action
      const estimatedAutomatedCostPerAction = 0.75; // $0.75 per automated action
      const costSavingsThisMonth = Math.round((completedActions.length * (estimatedManualCostPerAction - estimatedAutomatedCostPerAction)));

      // Generate real performance trends over time with proper bucketing
      const performanceTrends = [];
      const bucketSizeMs = timeframe === '7d' ? 24 * 60 * 60 * 1000 : // Daily for 7d
                         timeframe === '90d' ? 7 * 24 * 60 * 60 * 1000 : // Weekly for 90d  
                         timeframe === '1y' ? 30 * 24 * 60 * 60 * 1000 : // Monthly for 1y
                         24 * 60 * 60 * 1000; // Daily for 30d default
      
      const numBuckets = Math.ceil(timeframeMs / bucketSizeMs);
      
      for (let i = numBuckets - 1; i >= 0; i--) {
        const bucketStart = new Date(now.getTime() - ((i + 1) * bucketSizeMs));
        const bucketEnd = new Date(now.getTime() - (i * bucketSizeMs));
        
        // Get actions for this time bucket
        const bucketActions = actions.filter(action => 
          action.createdAt && 
          new Date(action.createdAt) >= bucketStart && 
          new Date(action.createdAt) < bucketEnd
        );
        
        const bucketCompleted = bucketActions.filter(a => a.status === 'completed');
        const bucketSuccessRate = bucketActions.length > 0 ? 
          Math.round((bucketCompleted.length / bucketActions.length) * 100) : 0;
        
        // Get assignments for this time bucket (for coverage calculation)
        const bucketAssignments = assignments.filter(a => 
          a.assignedAt && 
          new Date(a.assignedAt) <= bucketEnd && 
          a.isActive
        );
        
        const bucketCoverage = totalContacts > 0 ? 
          Math.round((bucketAssignments.length / totalContacts) * 100) : 0;
        
        // Calculate efficiency from response times
        const bucketActionsWithTimes = bucketCompleted.filter(a => 
          a.scheduledFor && a.completedAt
        );
        
        const avgResponseTime = bucketActionsWithTimes.length > 0 ?
          bucketActionsWithTimes.reduce((sum, action) => {
            const scheduled = new Date(action.scheduledFor!).getTime();
            const completed = new Date(action.completedAt!).getTime();
            return sum + (completed - scheduled);
          }, 0) / bucketActionsWithTimes.length / (1000 * 60 * 60) : 24; // hours
        
        const efficiency = Math.round(Math.max(0, Math.min(100, 100 - (avgResponseTime / 24) * 50)));
        
        performanceTrends.push({
          date: bucketStart.toISOString().split('T')[0],
          overallScore: Math.round((bucketSuccessRate + bucketCoverage + efficiency) / 3),
          successRate: bucketSuccessRate,
          efficiency,
          coverage: bucketCoverage
        });
      }

      // Generate real workflow performance data from schedules and actions
      const workflowPerformance = schedules.map(schedule => {
        const scheduleAssignments = assignments.filter(a => a.scheduleId === schedule.id && a.isActive);
        const accountsUsing = scheduleAssignments.length;
        
        // Get actions related to this schedule's assigned contacts
        const scheduleContactIds = scheduleAssignments.map(a => a.contactId);
        const scheduleActions = timeframeActions.filter(action => 
          action.contactId && scheduleContactIds.includes(action.contactId)
        );
        
        const scheduleCompleted = scheduleActions.filter(a => a.status === 'completed');
        const realSuccessRate = scheduleActions.length > 0 ? 
          Math.round((scheduleCompleted.length / scheduleActions.length) * 100) : 
          (schedule.successRate ? Math.round(Number(schedule.successRate)) : 0);
        
        // Calculate real average completion time from invoice payment data
        const scheduleInvoices = invoices.filter(inv => 
          scheduleContactIds.includes(inv.contactId) && 
          inv.paidDate && 
          new Date(inv.paidDate) >= startDate
        );
        
        const avgCompletionTime = scheduleInvoices.length > 0 ? 
          Math.round(scheduleInvoices.reduce((sum, inv) => {
            const issueTime = new Date(inv.issueDate).getTime();
            const paidTime = new Date(inv.paidDate!).getTime();
            return sum + ((paidTime - issueTime) / (1000 * 60 * 60 * 24));
          }, 0) / scheduleInvoices.length) : 
          (schedule.averageDaysToPayment ? Number(schedule.averageDaysToPayment) : 0);
        
        // Calculate real revenue from paid invoices
        const revenueGenerated = scheduleInvoices.reduce((sum, inv) => 
          sum + Number(inv.amountPaid || 0), 0
        );
        
        // Calculate cost efficiency: (revenue - costs) / costs
        const estimatedCosts = scheduleCompleted.length * estimatedAutomatedCostPerAction;
        const costEfficiency = estimatedCosts > 0 ? 
          Math.round(((revenueGenerated - estimatedCosts) / estimatedCosts) * 100) : 0;
        
        // Calculate automation score based on multiple factors
        const automationScore = Math.round((realSuccessRate + 
          Math.min(100, (accountsUsing / Math.max(1, totalContacts)) * 500) + 
          Math.min(100, costEfficiency > 0 ? 100 : 50)) / 3);
        
        // Determine trend by comparing recent vs older performance
        const midPoint = new Date(startDate.getTime() + (timeframeMs / 2));
        const recentActions = scheduleActions.filter(a => 
          a.createdAt && new Date(a.createdAt) >= midPoint
        );
        const olderActions = scheduleActions.filter(a => 
          a.createdAt && new Date(a.createdAt) < midPoint
        );
        
        const recentSuccessRate = recentActions.length > 0 ? 
          (recentActions.filter(a => a.status === 'completed').length / recentActions.length) * 100 : 0;
        const olderSuccessRate = olderActions.length > 0 ? 
          (olderActions.filter(a => a.status === 'completed').length / olderActions.length) * 100 : 0;
        
        const trendDiff = recentSuccessRate - olderSuccessRate;
        const trend = trendDiff > 5 ? 'improving' as const : 
                     trendDiff < -5 ? 'declining' as const : 'stable' as const;
        const trendPercentage = Math.abs(Math.round(trendDiff));
        
        return {
          workflowId: schedule.id,
          workflowName: schedule.name,
          type: 'email_sequence' as const,
          accountsUsing,
          successRate: realSuccessRate,
          averageCompletionTime: avgCompletionTime,
          revenueGenerated: Math.round(revenueGenerated),
          costEfficiency: Math.max(0, costEfficiency),
          automationScore: Math.max(0, Math.min(100, automationScore)),
          trend,
          trendPercentage,
          nextOptimizationDate: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString()
        };
      });

      // Generate automation recommendations
      const recommendations = [
        {
          id: 'auto-rec-001',
          priority: 'high' as const,
          category: 'coverage' as const,
          title: 'Expand Automation Coverage',
          description: `${totalContacts - automatedContacts} contacts are not using automation`,
          impact: 'Potential 25% increase in collection efficiency',
          effort: 'medium' as const,
          estimatedBenefit: Math.round((totalContacts - automatedContacts) * 150),
          implementationTime: '2-3 weeks',
          dependencies: ['schedule_templates'],
          status: 'new' as const
        },
        {
          id: 'auto-rec-002',
          priority: 'medium' as const,
          category: 'efficiency' as const,
          title: 'Optimize Email Send Times',
          description: 'Email open rates could improve by 15% with better timing',
          impact: 'Higher response rates for automated emails',
          effort: 'low' as const,
          estimatedBenefit: 2500,
          implementationTime: '1 week',
          dependencies: [],
          status: 'new' as const
        },
        {
          id: 'auto-rec-003',
          priority: 'high' as const,
          category: 'roi' as const,
          title: 'Enable Multi-Channel Workflows',
          description: 'Add SMS and voice follow-ups to email sequences',
          impact: 'Improve success rate by 30-40%',
          effort: 'high' as const,
          estimatedBenefit: 15000,
          implementationTime: '4-6 weeks',
          dependencies: ['sms_integration', 'voice_integration'],
          status: 'new' as const
        }
      ];

      // Generate system alerts
      const alerts = [];
      if (automationCoveragePercentage < 60) {
        alerts.push({
          id: 'alert-coverage-low',
          type: 'coverage' as const,
          severity: 'warning' as const,
          title: 'Low Automation Coverage',
          message: `Only ${automationCoveragePercentage}% of contacts are using automation`,
          timestamp: now.toISOString(),
          affectedWorkflows: [],
          estimatedImpact: 'Reduced collection efficiency',
          recommendedAction: 'Review and assign automation schedules to more contacts',
          isAcknowledged: false
        });
      }

      if (averageSuccessRate < 70) {
        alerts.push({
          id: 'alert-success-rate-low',
          type: 'performance' as const,
          severity: 'error' as const,
          title: 'Low Success Rate',
          message: `Automation success rate is ${averageSuccessRate}%, below target of 75%`,
          timestamp: now.toISOString(),
          affectedWorkflows: workflowPerformance.filter(w => w.successRate < 70).map(w => w.workflowId),
          estimatedImpact: 'Reduced revenue recovery',
          recommendedAction: 'Review and optimize underperforming workflows',
          isAcknowledged: false
        });
      }

      // Compile comprehensive response
      const automationPerformanceData = {
        overview: {
          totalAutomatedAccounts: automatedContacts,
          totalEligibleAccounts: totalContacts,
          automationCoveragePercentage,
          averageSuccessRate,
          monthlyActionsProcessed: completedActions.length,
          costSavingsThisMonth,
          revenueRecoveredThroughAutomation: Math.round(workflowPerformance.reduce((sum, w) => sum + w.revenueGenerated, 0)),
          manualEffortReduction: Math.round(completedActions.length * 0.33), // hours saved
          systemUptimePercentage: 99.2,
          lastPerformanceUpdate: now.toISOString()
        },
        coverage: {
          totalContacts,
          automatedContacts,
          manualOnlyContacts: totalContacts - automatedContacts,
          coverageBySegment: [
            {
              segment: 'high_value',
              totalAccounts: Math.round(totalContacts * 0.2),
              automatedAccounts: Math.round(automatedContacts * 0.8),
              coveragePercentage: 80,
              averageAccountValue: 15000,
              priorityScore: 95
            },
            {
              segment: 'medium_value', 
              totalAccounts: Math.round(totalContacts * 0.5),
              automatedAccounts: Math.round(automatedContacts * 0.6),
              coveragePercentage: 60,
              averageAccountValue: 5000,
              priorityScore: 75
            },
            {
              segment: 'low_value',
              totalAccounts: Math.round(totalContacts * 0.3),
              automatedAccounts: Math.round(automatedContacts * 0.3),
              coveragePercentage: 30,
              averageAccountValue: 1500,
              priorityScore: 45
            }
          ],
          coverageByChannel: [
            {
              channel: 'email' as const,
              accountsUsing: emailActions.length,
              successRate: timeframeActions.filter(a => a.type === 'email').length > 0 ? 
                Math.round((emailActions.length / timeframeActions.filter(a => a.type === 'email').length) * 100) : 0,
              averageResponseTime: emailActions.filter(a => a.scheduledFor && a.completedAt).length > 0 ?
                Math.round(emailActions.filter(a => a.scheduledFor && a.completedAt).reduce((sum, action) => {
                  const scheduled = new Date(action.scheduledFor!).getTime();
                  const completed = new Date(action.completedAt!).getTime();
                  return sum + (completed - scheduled);
                }, 0) / emailActions.filter(a => a.scheduledFor && a.completedAt).length / (1000 * 60 * 60)) : 12,
              costPerAction: 0.25,
              revenueGenerated: Math.round(emailActions.length * 42.50)
            },
            {
              channel: 'sms' as const,
              accountsUsing: smsActions.length,
              successRate: timeframeActions.filter(a => a.type === 'sms').length > 0 ? 
                Math.round((smsActions.length / timeframeActions.filter(a => a.type === 'sms').length) * 100) : 0,
              averageResponseTime: smsActions.filter(a => a.scheduledFor && a.completedAt).length > 0 ?
                Math.round(smsActions.filter(a => a.scheduledFor && a.completedAt).reduce((sum, action) => {
                  const scheduled = new Date(action.scheduledFor!).getTime();
                  const completed = new Date(action.completedAt!).getTime();
                  return sum + (completed - scheduled);
                }, 0) / smsActions.filter(a => a.scheduledFor && a.completedAt).length / (1000 * 60 * 60)) : 3,
              costPerAction: 0.15,
              revenueGenerated: Math.round(smsActions.length * 65.30)
            },
            {
              channel: 'voice' as const,
              accountsUsing: callActions.length,
              successRate: timeframeActions.filter(a => a.type === 'voice' || a.type === 'call').length > 0 ? 
                Math.round((callActions.length / timeframeActions.filter(a => a.type === 'voice' || a.type === 'call').length) * 100) : 0,
              averageResponseTime: callActions.filter(a => a.scheduledFor && a.completedAt).length > 0 ?
                Math.round(callActions.filter(a => a.scheduledFor && a.completedAt).reduce((sum, action) => {
                  const scheduled = new Date(action.scheduledFor!).getTime();
                  const completed = new Date(action.completedAt!).getTime();
                  return sum + (completed - scheduled);
                }, 0) / callActions.filter(a => a.scheduledFor && a.completedAt).length / (1000 * 60 * 60)) : 6,
              costPerAction: 1.50,
              revenueGenerated: Math.round(callActions.length * 85.00)
            }
          ],
          uncoveredReasons: [
            {
              reason: 'Missing contact information',
              accountCount: Math.round((totalContacts - automatedContacts) * 0.4),
              potentialValue: Math.round((totalContacts - automatedContacts) * 0.4 * 2500),
              difficulty: 'medium' as const,
              estimatedSetupTime: 8
            }
          ],
          coverageTrend: performanceTrends.map(trend => ({
            date: trend.date,
            totalAccounts: totalContacts,
            automatedAccounts: automatedContacts,
            coveragePercentage: trend.coverage
          })),
          potentialCoverageIncrease: Math.round((totalContacts - automatedContacts) / totalContacts * 100)
        },
        efficiency: {
          averageActionResponseTime: completedActions.filter(a => a.scheduledFor && a.completedAt).length > 0 ?
            Math.round(completedActions.filter(a => a.scheduledFor && a.completedAt).reduce((sum, action) => {
              const scheduled = new Date(action.scheduledFor!).getTime();
              const completed = new Date(action.completedAt!).getTime();
              return sum + (completed - scheduled);
            }, 0) / completedActions.filter(a => a.scheduledFor && a.completedAt).length / (1000 * 60 * 60) * 10) / 10 : 8.5,
          scheduleAccuracyRate: timeframeActions.filter(a => a.scheduledFor).length > 0 ?
            Math.round((timeframeActions.filter(a => a.scheduledFor && a.completedAt && 
              Math.abs(new Date(a.completedAt).getTime() - new Date(a.scheduledFor!).getTime()) < 2 * 60 * 60 * 1000
            ).length / timeframeActions.filter(a => a.scheduledFor).length) * 100) : 94,
          templateSuccessRates: [
            {
              templateId: 'template-001',
              templateName: 'Friendly Reminder',
              channel: 'email' as const,
              successRate: emailActions.length > 0 ? 
                Math.round((emailActions.length / Math.max(1, timeframeActions.filter(a => a.type === 'email').length)) * 100) : 0,
              responseRate: 45,
              usageCount: emailActions.length,
              averageResponseTime: emailActions.filter(a => a.scheduledFor && a.completedAt).length > 0 ?
                Math.round(emailActions.filter(a => a.scheduledFor && a.completedAt).reduce((sum, action) => {
                  const scheduled = new Date(action.scheduledFor!).getTime();
                  const completed = new Date(action.completedAt!).getTime();
                  return sum + (completed - scheduled);
                }, 0) / emailActions.filter(a => a.scheduledFor && a.completedAt).length / (1000 * 60 * 60)) : 12,
              revenuePerUse: 52.30,
              trend: 'improving' as const
            }
          ],
          workflowCompletionRate: timeframeActions.length > 0 ? 
            Math.round((completedActions.length / timeframeActions.length) * 100) : 0,
          errorRate: timeframeActions.length > 0 ? 
            Math.round((failedActions.length / timeframeActions.length) * 100 * 10) / 10 : 0,
          processingSpeed: Math.round(completedActions.length / Math.max(1, Math.ceil(timeframeMs / (24 * 60 * 60 * 1000)))), // actions per day
          resourceUtilization: Math.round(Math.min(100, (completedActions.length / Math.max(1, totalContacts * 0.1)) * 100)),
          scalabilityScore: Math.round(Math.min(100, averageSuccessRate * 0.6 + automationCoveragePercentage * 0.4))
        },
        roi: {
          totalInvestment: Math.round(completedActions.length * estimatedAutomatedCostPerAction),
          directSavings: costSavingsThisMonth,
          revenueImpact: Math.round(workflowPerformance.reduce((sum, w) => sum + w.revenueGenerated, 0)),
          netROI: costSavingsThisMonth > 0 ? Math.round((costSavingsThisMonth - (completedActions.length * estimatedAutomatedCostPerAction)) / (completedActions.length * estimatedAutomatedCostPerAction) * 100) : 0,
          paybackPeriod: costSavingsThisMonth > 0 ? Math.round((completedActions.length * estimatedAutomatedCostPerAction) / (costSavingsThisMonth / 12) * 10) / 10 : 0,
          costPerAction: estimatedAutomatedCostPerAction,
          manualCostPerAction: estimatedManualCostPerAction,
          efficiencyGain: Math.round(((estimatedManualCostPerAction - estimatedAutomatedCostPerAction) / estimatedManualCostPerAction) * 100),
          timeToValue: workflowPerformance.length > 0 ? Math.round(workflowPerformance.reduce((sum, w) => sum + w.averageCompletionTime, 0) / workflowPerformance.length) : 14,
          scalabilityBenefit: Math.round(costSavingsThisMonth * 12 * 1.1) // projected annual benefit with 10% growth
        },
        systemHealth: {
          overallHealthScore: Math.round(Math.min(100, (averageSuccessRate + automationCoveragePercentage + (100 - (failedActions.length / Math.max(1, timeframeActions.length) * 100))) / 3)),
          uptime: Math.round((1 - (failedActions.length / Math.max(1, timeframeActions.length))) * 100 * 10) / 10,
          errorRate: timeframeActions.length > 0 ? Math.round((failedActions.length / timeframeActions.length) * 100 * 10) / 10 : 0,
          averageLatency: 145, // milliseconds - static system metric
          queueDepth: Math.max(0, timeframeActions.filter(a => a.status === 'pending').length),
          systemLoad: Math.round(Math.min(100, (completedActions.length / Math.max(1, totalContacts * 0.2)) * 100)),
          lastMaintenanceDate: new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString(), // Weekly maintenance
          scheduledMaintenanceWindow: new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString(), // Next week
          performanceAlerts: [],
          redundancyStatus: 'active' as const
        },
        workflows: workflowPerformance,
        trends: {
          performanceOverTime: performanceTrends,
          coverageGrowth: performanceTrends.map(trend => ({
            date: trend.date,
            totalAccounts: totalContacts,
            automatedAccounts: automatedContacts,
            coveragePercentage: trend.coverage
          })),
          roiTrend: performanceTrends.map((trend, index) => {
            const bucketStart = new Date(now.getTime() - ((performanceTrends.length - index) * bucketSizeMs));
            const bucketEnd = new Date(now.getTime() - ((performanceTrends.length - index - 1) * bucketSizeMs));
            
            const bucketActions = completedActions.filter(action => 
              action.createdAt && 
              new Date(action.createdAt) >= bucketStart && 
              new Date(action.createdAt) < bucketEnd
            );
            
            const investment = Math.round(bucketActions.length * estimatedAutomatedCostPerAction);
            const savings = Math.round(bucketActions.length * (estimatedManualCostPerAction - estimatedAutomatedCostPerAction));
            const revenue = Math.round(bucketActions.length * 35.20);
            const netROI = investment > 0 ? Math.round(((savings + revenue - investment) / investment) * 100) : 0;
            
            return {
              date: trend.date,
              investment,
              savings,
              revenue,
              netROI
            };
          }),
          efficiencyTrend: performanceTrends.map((trend, index) => {
            const bucketStart = new Date(now.getTime() - ((performanceTrends.length - index) * bucketSizeMs));
            const bucketEnd = new Date(now.getTime() - ((performanceTrends.length - index - 1) * bucketSizeMs));
            
            const bucketActions = timeframeActions.filter(action => 
              action.createdAt && 
              new Date(action.createdAt) >= bucketStart && 
              new Date(action.createdAt) < bucketEnd
            );
            
            const bucketCompleted = bucketActions.filter(a => a.status === 'completed');
            const bucketFailed = bucketActions.filter(a => a.status === 'failed');
            
            const avgResponseTime = bucketCompleted.filter(a => a.scheduledFor && a.completedAt).length > 0 ?
              Math.round(bucketCompleted.filter(a => a.scheduledFor && a.completedAt).reduce((sum, action) => {
                const scheduled = new Date(action.scheduledFor!).getTime();
                const completed = new Date(action.completedAt!).getTime();
                return sum + (completed - scheduled);
              }, 0) / bucketCompleted.filter(a => a.scheduledFor && a.completedAt).length / (1000 * 60 * 60)) : 12;
            
            const scheduleAccuracy = bucketActions.filter(a => a.scheduledFor).length > 0 ?
              Math.round((bucketActions.filter(a => a.scheduledFor && a.completedAt && 
                Math.abs(new Date(a.completedAt).getTime() - new Date(a.scheduledFor!).getTime()) < 2 * 60 * 60 * 1000
              ).length / bucketActions.filter(a => a.scheduledFor).length) * 100) : 95;
            
            const errorRate = bucketActions.length > 0 ? 
              Math.round((bucketFailed.length / bucketActions.length) * 100) : 0;
            
            const processingSpeed = Math.round(bucketCompleted.length / Math.max(1, Math.ceil(bucketSizeMs / (24 * 60 * 60 * 1000))));
            
            return {
              date: trend.date,
              averageResponseTime: avgResponseTime,
              scheduleAccuracy,
              errorRate,
              processingSpeed
            };
          }),
          volumeTrend: performanceTrends.map((trend, index) => {
            const bucketStart = new Date(now.getTime() - ((performanceTrends.length - index) * bucketSizeMs));
            const bucketEnd = new Date(now.getTime() - ((performanceTrends.length - index - 1) * bucketSizeMs));
            
            const bucketActions = timeframeActions.filter(action => 
              action.createdAt && 
              new Date(action.createdAt) >= bucketStart && 
              new Date(action.createdAt) < bucketEnd
            );
            
            const bucketEmails = bucketActions.filter(a => a.type === 'email');
            const bucketSms = bucketActions.filter(a => a.type === 'sms');
            const bucketVoice = bucketActions.filter(a => a.type === 'voice' || a.type === 'call');
            const bucketManual = bucketActions.filter(a => !a.aiGenerated);
            
            return {
              date: trend.date,
              totalActions: bucketActions.length,
              emailActions: bucketEmails.length,
              smsActions: bucketSms.length,
              voiceActions: bucketVoice.length,
              manualActions: bucketManual.length
            };
          }),
          successRateTrend: performanceTrends.map((trend, index) => {
            const bucketStart = new Date(now.getTime() - ((performanceTrends.length - index) * bucketSizeMs));
            const bucketEnd = new Date(now.getTime() - ((performanceTrends.length - index - 1) * bucketSizeMs));
            
            const bucketActions = timeframeActions.filter(action => 
              action.createdAt && 
              new Date(action.createdAt) >= bucketStart && 
              new Date(action.createdAt) < bucketEnd
            );
            
            const emailActionsInBucket = bucketActions.filter(a => a.type === 'email');
            const smsActionsInBucket = bucketActions.filter(a => a.type === 'sms');
            const voiceActionsInBucket = bucketActions.filter(a => a.type === 'voice' || a.type === 'call');
            
            const emailSuccess = emailActionsInBucket.length > 0 ? 
              Math.round((emailActionsInBucket.filter(a => a.status === 'completed').length / emailActionsInBucket.length) * 100) : 0;
            const smsSuccess = smsActionsInBucket.length > 0 ? 
              Math.round((smsActionsInBucket.filter(a => a.status === 'completed').length / smsActionsInBucket.length) * 100) : 0;
            const voiceSuccess = voiceActionsInBucket.length > 0 ? 
              Math.round((voiceActionsInBucket.filter(a => a.status === 'completed').length / voiceActionsInBucket.length) * 100) : 0;
            
            return {
              date: trend.date,
              email: emailSuccess,
              sms: smsSuccess,
              voice: voiceSuccess,
              overall: trend.successRate
            };
          })
        },
        recommendations,
        alerts,
        benchmarks: {
          industryAverages: {
            coverageRate: 65,
            successRate: 72,
            roi: 185,
            responseTime: 14
          },
          yourPerformance: {
            coverageRate: automationCoveragePercentage,
            successRate: averageSuccessRate,
            roi: costSavingsThisMonth > 0 ? Math.round((costSavingsThisMonth - (totalActionsInTimeframe * estimatedAutomatedCostPerAction)) / (totalActionsInTimeframe * estimatedAutomatedCostPerAction) * 100) : 0,
            responseTime: 8.5
          },
          performanceGap: {
            coverage: automationCoveragePercentage - 65,
            success: averageSuccessRate - 72,
            roi: (costSavingsThisMonth > 0 ? Math.round((costSavingsThisMonth - (totalActionsInTimeframe * estimatedAutomatedCostPerAction)) / (totalActionsInTimeframe * estimatedAutomatedCostPerAction) * 100) : 0) - 185,
            speed: 14 - 8.5
          },
          ranking: automationCoveragePercentage > 80 && averageSuccessRate > 85 ? 'top_quartile' as const :
                   automationCoveragePercentage > 65 && averageSuccessRate > 72 ? 'above_average' as const :
                   automationCoveragePercentage > 50 && averageSuccessRate > 60 ? 'average' as const : 'below_average' as const
        }
      };

      res.json(automationPerformanceData);

    } catch (error) {
      console.error("Error generating automation performance analytics:", error);
      res.status(500).json({ message: "Failed to generate automation performance analytics" });
    }
  });

  app.get('/api/cashflow/forecast', ...withPermission('finance:cashflow'), async (req: any, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { 
        weeks = 13, 
        scenario = 'base',
        currency = 'USD',
        include_weekends = false
      } = req.query;

      // Create forecast engine instance
      const forecastEngine = new ForecastEngine();

      // Prepare forecast configuration
      const config: ForecastConfig = {
        forecastWeeks: Number(weeks),
        baseCurrency: currency as string,
        includeWeekends: include_weekends === 'true',
        scenario: scenario as ForecastScenario,
        
        // Default AR collection configuration
        arCollectionConfig: {
          paymentProbabilityCurve: {
            dayRanges: [
              { fromDay: 0, toDay: 30, probability: 0.85 },
              { fromDay: 31, toDay: 60, probability: 0.65 },
              { fromDay: 61, toDay: 90, probability: 0.45 },
              { fromDay: 91, toDay: 120, probability: 0.25 },
              { fromDay: 121, toDay: 365, probability: 0.10 }
            ]
          },
          collectionAccelerationFactor: scenario === 'optimistic' ? 1.2 : scenario === 'pessimistic' ? 0.8 : 1.0,
          badDebtThreshold: 365
        },

        // Default AP payment configuration
        apPaymentConfig: {
          paymentPolicy: 'standard',
          earlyPaymentDiscountThreshold: 2.0,
          averagePaymentDelay: scenario === 'optimistic' ? 28 : scenario === 'pessimistic' ? 45 : 35,
          cashOptimizationEnabled: true
        },

        // Budget integration configuration
        budgetConfig: {
          includeBudgetForecasts: true,
          budgetVarianceFactors: {
            revenue: scenario === 'optimistic' ? 1.1 : scenario === 'pessimistic' ? 0.9 : 1.0,
            expenses: scenario === 'optimistic' ? 0.95 : scenario === 'pessimistic' ? 1.05 : 1.0
          }
        },

        // Currency configuration
        currencyConfig: {
          enableFxForecasting: true,
          fxVolatilityFactor: scenario === 'pessimistic' ? 1.5 : 1.0,
          hedgingStrategy: 'none'
        }
      };

      // Fetch real data for forecast
      const invoices = await storage.getInvoices(user.tenantId, 5000);
      const bills = await storage.getBills(user.tenantId, 5000);
      const bankAccounts = await storage.getBankAccounts(user.tenantId);
      const bankTransactions = await storage.getBankTransactions(user.tenantId, { limit: 1000 });
      const budgets = await storage.getBudgets(user.tenantId, { year: new Date().getFullYear() });

      // Generate forecast
      const forecast = await forecastEngine.generateForecast({
        config,
        accountingData: {
          invoices: invoices.map(inv => ({ ...inv, contact: inv.contact })),
          bills: bills.map(bill => ({ ...bill, vendor: bill.vendor })),
          bankAccounts,
          bankTransactions: bankTransactions.map(tx => ({ 
            ...tx, 
            bankAccount: tx.bankAccount,
            contact: tx.contact,
            invoice: tx.invoice,
            bill: tx.bill
          })),
          budgets
        }
      });

      res.json({
        forecast,
        metadata: {
          scenario,
          weeks: Number(weeks),
          currency,
          generatedAt: new Date().toISOString(),
          dataPoints: {
            invoices: invoices.length,
            bills: bills.length,
            bankAccounts: bankAccounts.length,
            transactions: bankTransactions.length,
            budgets: budgets.length
          }
        }
      });
    } catch (error) {
      console.error('Error generating cashflow forecast:', error);
      res.status(500).json({ message: "Failed to generate cashflow forecast" });
    }
  });

  app.post('/api/cashflow/scenarios', ...withPermission('finance:cashflow'), async (req: any, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { scenarios, weeks = 13, currency = 'USD' } = req.body;

      if (!scenarios || !Array.isArray(scenarios)) {
        return res.status(400).json({ message: "Scenarios array is required" });
      }

      const forecastEngine = new ForecastEngine();
      
      // Fetch real data once for all scenarios
      const invoices = await storage.getInvoices(user.tenantId, 5000);
      const bills = await storage.getBills(user.tenantId, 5000);
      const bankAccounts = await storage.getBankAccounts(user.tenantId);
      const bankTransactions = await storage.getBankTransactions(user.tenantId, { limit: 1000 });
      const budgets = await storage.getBudgets(user.tenantId, { year: new Date().getFullYear() });

      const accountingData = {
        invoices: invoices.map(inv => ({ ...inv, contact: inv.contact })),
        bills: bills.map(bill => ({ ...bill, vendor: bill.vendor })),
        bankAccounts,
        bankTransactions: bankTransactions.map(tx => ({ 
          ...tx, 
          bankAccount: tx.bankAccount,
          contact: tx.contact,
          invoice: tx.invoice,
          bill: tx.bill
        })),
        budgets
      };

      // Generate forecasts for each scenario
      const scenarioResults = await Promise.all(
        scenarios.map(async (scenarioConfig: any) => {
          const config: ForecastConfig = {
            forecastWeeks: weeks,
            baseCurrency: currency,
            includeWeekends: false,
            scenario: scenarioConfig.scenario || 'custom',
            ...scenarioConfig.config
          };

          const forecast = await forecastEngine.generateForecast({
            config,
            accountingData
          });

          return {
            name: scenarioConfig.name || config.scenario,
            scenario: config.scenario,
            forecast,
            config: scenarioConfig.config
          };
        })
      );

      // Generate comparison metrics
      const comparison = forecastEngine.compareScenarios(scenarioResults.map(s => s.forecast));

      res.json({
        scenarios: scenarioResults,
        comparison,
        metadata: {
          weeks,
          currency,
          generatedAt: new Date().toISOString(),
          totalScenarios: scenarios.length
        }
      });
    } catch (error) {
      console.error('Error running scenario analysis:', error);
      res.status(500).json({ message: "Failed to run scenario analysis" });
    }
  });

  app.get('/api/cashflow/metrics', ...withPermission('finance:cashflow'), async (req: any, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { period = 90 } = req.query; // Default to 90 days

      // Get invoice metrics
      const invoiceMetrics = await storage.getInvoiceMetrics(user.tenantId);

      // Get bank account data
      const bankAccounts = await storage.getBankAccounts(user.tenantId);
      const totalCash = bankAccounts.reduce((sum, account) => sum + Number(account.currentBalance), 0);

      // Get recent transactions for burn rate calculation
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(period));

      const recentTransactions = await storage.getBankTransactions(user.tenantId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 10000
      });

      // Calculate burn rate (cash outflow)
      const totalOutflows = recentTransactions
        .filter(tx => Number(tx.amount) < 0)
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
      
      const dailyBurnRate = totalOutflows / Number(period);
      const monthlyBurnRate = dailyBurnRate * 30;

      // Calculate cash runway (days until cash runs out)
      const cashRunwayDays = dailyBurnRate > 0 ? Math.floor(totalCash / dailyBurnRate) : Infinity;

      // Calculate additional metrics
      const totalInflows = recentTransactions
        .filter(tx => Number(tx.amount) > 0)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      const netCashFlow = totalInflows - totalOutflows;
      const operatingCashFlowRatio = totalInflows > 0 ? netCashFlow / totalInflows : 0;

      const metrics = {
        // Core AR metrics
        dso: invoiceMetrics.dso,
        totalOutstanding: invoiceMetrics.totalOutstanding,
        overdueCount: invoiceMetrics.overdueCount,
        collectionRate: invoiceMetrics.collectionRate,
        avgDaysToPay: invoiceMetrics.avgDaysToPay,

        // Cash metrics
        totalCash,
        dailyBurnRate,
        monthlyBurnRate,
        cashRunwayDays,
        cashRunwayMonths: Math.floor(cashRunwayDays / 30),

        // Cash flow metrics
        totalInflows,
        totalOutflows,
        netCashFlow,
        operatingCashFlowRatio,

        // Additional metrics
        activeBankAccounts: bankAccounts.filter(a => a.isActive).length,
        currencyExposure: [...new Set(bankAccounts.map(a => a.currencyCode))],

        // Period information
        calculationPeriod: {
          days: Number(period),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      };

      res.json({
        metrics,
        metadata: {
          calculatedAt: new Date().toISOString(),
          dataPoints: {
            invoices: invoiceMetrics.overdueCount + invoiceMetrics.collectionsWithinTerms,
            transactions: recentTransactions.length,
            bankAccounts: bankAccounts.length
          }
        }
      });
    } catch (error) {
      console.error('Error calculating financial metrics:', error);
      res.status(500).json({ message: "Failed to calculate financial metrics" });
    }
  });

  app.post('/api/cashflow/optimize', ...withPermission('finance:cashflow'), async (req: any, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { 
        optimizationGoals = ['maximize_cash', 'minimize_risk'], 
        timeHorizon = 90,
        constraints = {}
      } = req.body;

      const forecastEngine = new ForecastEngine();

      // Fetch current data
      const invoices = await storage.getInvoices(user.tenantId, 5000);
      const bills = await storage.getBills(user.tenantId, 5000);
      const bankAccounts = await storage.getBankAccounts(user.tenantId);

      // Generate optimization recommendations
      const recommendations = await forecastEngine.generateOptimizationRecommendations({
        goals: optimizationGoals,
        timeHorizon,
        constraints,
        currentData: {
          invoices: invoices.map(inv => ({ ...inv, contact: inv.contact })),
          bills: bills.map(bill => ({ ...bill, vendor: bill.vendor })),
          bankAccounts
        }
      });

      res.json({
        recommendations,
        metadata: {
          goals: optimizationGoals,
          timeHorizon,
          constraints,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error generating optimization recommendations:', error);
      res.status(500).json({ message: "Failed to generate optimization recommendations" });
    }
  });

  app.get('/api/forecast/ard', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const ard = await getLatestARD(user.tenantId);
      
      res.json({ averageReceivableDays: ard });
    } catch (error) {
      console.error('Error fetching ARD:', error);
      res.status(500).json({ message: "Failed to fetch ARD" });
    }
  });

  app.post('/api/forecast/ard/calculate', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const options = req.body || {};
      const result = await calculateAndStoreARD(user.tenantId, options);
      
      res.json(result);
    } catch (error) {
      console.error('Error calculating ARD:', error);
      res.status(500).json({ message: "Failed to calculate ARD" });
    }
  });

  app.get('/api/forecast/ard/history', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const history = await getARDHistory(user.tenantId, limit);
      
      res.json(history);
    } catch (error) {
      console.error('Error fetching ARD history:', error);
      res.status(500).json({ message: "Failed to fetch ARD history" });
    }
  });

  app.get('/api/forecast/ard/trend', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const trend = await getARDTrend(user.tenantId);
      
      res.json(trend);
    } catch (error) {
      console.error('Error fetching ARD trend:', error);
      res.status(500).json({ message: "Failed to fetch ARD trend" });
    }
  });

  app.get('/api/forecast/sales', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { fromMonth, toMonth } = req.query;
      
      if (!fromMonth) {
        return res.status(400).json({ message: "fromMonth is required (format: YYYY-MM)" });
      }

      const forecasts = await getSalesForecasts(
        user.tenantId,
        fromMonth as string,
        toMonth as string | undefined
      );
      
      res.json(forecasts);
    } catch (error) {
      console.error('Error fetching sales forecasts:', error);
      res.status(500).json({ message: "Failed to fetch sales forecasts" });
    }
  });

  app.post('/api/forecast/sales', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { forecastMonth, ...data } = req.body;
      
      if (!forecastMonth) {
        return res.status(400).json({ message: "forecastMonth is required (format: YYYY-MM)" });
      }

      const forecast = await upsertSalesForecast(
        user.tenantId,
        forecastMonth,
        data,
        user.id
      );
      
      res.json(forecast);
    } catch (error) {
      console.error('Error upserting sales forecast:', error);
      res.status(500).json({ message: "Failed to save sales forecast" });
    }
  });

  app.post('/api/forecast/sales/batch', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { forecasts } = req.body;
      
      if (!Array.isArray(forecasts)) {
        return res.status(400).json({ message: "forecasts must be an array" });
      }

      const results = await Promise.all(
        forecasts.map(({ forecastMonth, ...data }) =>
          upsertSalesForecast(user.tenantId!, forecastMonth, data, user.id)
        )
      );
      
      res.json({ updated: results.length, forecasts: results });
    } catch (error) {
      console.error('Error batch updating sales forecasts:', error);
      res.status(500).json({ message: "Failed to batch update sales forecasts" });
    }
  });

  app.get('/api/forecast/sales/cash-inflows', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const monthsAhead = req.query.months ? parseInt(req.query.months as string) : 6;
      
      const cashInflows = await getSalesForecastCashInflows(user.tenantId, monthsAhead);
      
      res.json(cashInflows);
    } catch (error) {
      console.error('Error fetching sales cash inflows:', error);
      res.status(500).json({ message: "Failed to fetch sales cash inflows" });
    }
  });

  app.post('/api/forecast/sales/generate-defaults', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const forecasts = await generateDefaultForecasts(user.tenantId, user.id);
      
      res.json({ generated: forecasts.length, forecasts });
    } catch (error) {
      console.error('Error generating default forecasts:', error);
      res.status(500).json({ message: "Failed to generate default forecasts" });
    }
  });

  app.get('/api/forecast/irregular-buffer', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const forecastDays = req.query.days ? parseInt(req.query.days as string) : 91;
      const beta = req.query.beta ? parseFloat(req.query.beta as string) : undefined;

      const buffer = await calculateIrregularBufferForForecast(
        user.tenantId,
        forecastDays,
        beta ? { beta } : {}
      );
      
      res.json(buffer);
    } catch (error) {
      console.error('Error calculating irregular buffer:', error);
      res.status(500).json({ message: "Failed to calculate irregular buffer" });
    }
  });

  app.get('/api/forecast/irregular-buffer/recommended-beta', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const beta = await getRecommendedBeta(user.tenantId);
      
      res.json({ recommendedBeta: beta });
    } catch (error) {
      console.error('Error calculating recommended beta:', error);
      res.status(500).json({ message: "Failed to calculate recommended beta" });
    }
  });
}
