import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, isOwner } from "../auth";
import { logSecurityEvent, extractClientInfo } from "../services/securityAuditService";
import { sanitizeObject, stripSensitiveUserFields, stripSensitiveTenantFields, stripSensitiveFields } from "../utils/sanitize";
import { withPermission, withRole, withMinimumRole, canManageUser, withRBACContext, requireTenantAdmin } from "../middleware/rbac";
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

import { generateCreditRecommendation, type CreditSignals, type TradingProfile } from "../services/dynamicRiskScoringService";

const contactsQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['name', 'company', 'email', 'outstanding', 'lastContact']).optional().default('name'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number)
});

export function registerContactRoutes(app: Express): void {
  app.get('/api/contacts/:contactId/assignments', isAuthenticated, withRBACContext, requireTenantAdmin, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const assignments = await storage.getContactAssignments(req.params.contactId, req.rbac.tenantId);
      res.json({ assignments });
    } catch (error) {
      console.error('Failed to get contact assignments:', error);
      res.status(500).json({ message: 'Failed to retrieve assignments' });
    }
  });

  app.post('/api/contacts/cleanup', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log('🧹 Cleaning up contacts for tenant:', user.tenantId);
      await generateMockData(user.tenantId);
      
      res.json({ 
        success: true, 
        message: "Contacts cleaned up successfully! Now showing only 80 mock clients."
      });
    } catch (error) {
      console.error("Error cleaning up contacts:", error);
      res.status(500).json({ message: "Failed to clean up contacts" });
    }
  });

  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate and parse query parameters using Zod schema
      const validatedQuery = contactsQuerySchema.parse(req.query);
      const { search, sortBy, sortDir, page, limit } = validatedQuery;

      const allowedContactIds = await getAssignedContactIds(user);

      console.log(`📊 Paginated Contacts API - Tenant: ${user.tenantId}, Filters: search="${search}", sortBy=${sortBy}, sortDir=${sortDir}, page=${page}, limit=${limit}${allowedContactIds ? `, restricted to ${allowedContactIds.length} assigned contacts` : ''}`);
      
      // Use fallback pagination with invoice data
      {
        // Get all contacts, invoices, and actions in parallel for performance
        const [rawContacts, allInvoices, allActions] = await Promise.all([
          storage.getContacts(user.tenantId),
          storage.getInvoices(user.tenantId, 10000),
          storage.getActions(user.tenantId)
        ]);

        const allContacts = allowedContactIds
          ? rawContacts.filter(c => allowedContactIds.includes(c.id))
          : rawContacts;
        
        // Calculate outstanding amounts and invoice counts for each contact
        const contactsWithData = allContacts.map(contact => {
          const contactInvoices = allInvoices.filter(inv => inv.contactId === contact.id);
          const unpaidInvoices = contactInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled');
          
          // Calculate outstanding amount
          const outstandingAmount = unpaidInvoices.reduce((sum, inv) => {
            const amount = Number(inv.amount) || 0;
            const amountPaid = Number(inv.amountPaid) || 0;
            return sum + (amount - amountPaid);
          }, 0);
          
          // Calculate overdue invoices and amounts
          const today = new Date();
          const overdueInvoices = unpaidInvoices.filter(inv => {
            if (inv.dueDate) {
              const dueDate = new Date(inv.dueDate);
              return dueDate < today;
            }
            return false;
          });
          
          const overdueAmount = overdueInvoices.reduce((sum, inv) => {
            const amount = Number(inv.amount) || 0;
            const amountPaid = Number(inv.amountPaid) || 0;
            return sum + (amount - amountPaid);
          }, 0);
          
          const overdueCount = overdueInvoices.length;
          
          // Calculate average days past due (ADPD)
          let averageDaysPastDue = 0;
          if (overdueInvoices.length > 0) {
            const totalDaysPastDue = overdueInvoices.reduce((sum, inv) => {
              if (inv.dueDate) {
                const dueDate = new Date(inv.dueDate);
                const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                return sum + Math.max(0, daysPastDue);
              }
              return sum;
            }, 0);
            averageDaysPastDue = Math.round(totalDaysPastDue / overdueInvoices.length);
          }
          
          // Calculate risk score based on overdue invoices
          let riskScore = 0;
          unpaidInvoices.forEach(inv => {
            if (inv.dueDate) {
              const dueDate = new Date(inv.dueDate);
              const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysOverdue > 90) riskScore += 30;
              else if (daysOverdue > 60) riskScore += 20;
              else if (daysOverdue > 30) riskScore += 15;
              else if (daysOverdue > 0) riskScore += 10;
            }
          });
          riskScore = Math.min(riskScore, 100); // Cap at 100
          
          // Find last payment date (most recent paid invoice)
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
            action.contactId === contact.id && 
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
          
          return {
            ...contact,
            outstandingAmount,
            invoiceCount: contactInvoices.length,
            overdueAmount,
            overdueCount,
            averageDaysPastDue,
            lastPaymentDate,
            lastContactDate,
            riskScore
          };
        })
        // Filter to only show customers with outstanding balances (collections focus)
        .filter(contact => contact.outstandingAmount > 0);
        
        // Filter contacts based on search
        let filteredContacts = contactsWithData;
        if (search && search.trim()) {
          const searchLower = search.toLowerCase();
          filteredContacts = contactsWithData.filter(contact => 
            contact.name?.toLowerCase().includes(searchLower) ||
            contact.email?.toLowerCase().includes(searchLower) ||
            contact.companyName?.toLowerCase().includes(searchLower) ||
            contact.phone?.toLowerCase().includes(searchLower)
          );
        }

        // Sort contacts
        filteredContacts.sort((a, b) => {
          let aValue: any = '';
          let bValue: any = '';
          
          switch (sortBy) {
            case 'name':
              aValue = a.name?.toLowerCase() || '';
              bValue = b.name?.toLowerCase() || '';
              break;
            case 'company':
              aValue = a.companyName?.toLowerCase() || '';
              bValue = b.companyName?.toLowerCase() || '';
              break;
            case 'email':
              aValue = a.email?.toLowerCase() || '';
              bValue = b.email?.toLowerCase() || '';
              break;
            case 'outstanding':
              aValue = a.outstandingAmount;
              bValue = b.outstandingAmount;
              break;
            default:
              aValue = a.name?.toLowerCase() || '';
              bValue = b.name?.toLowerCase() || '';
          }
          
          if (sortDir === 'desc') {
            return typeof aValue === 'string' ? bValue.localeCompare(aValue) : bValue - aValue;
          }
          return typeof aValue === 'string' ? aValue.localeCompare(bValue) : aValue - bValue;
        });

        // Implement pagination
        const total = filteredContacts.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const paginatedContacts = filteredContacts.slice(offset, offset + limit);

        // Calculate aggregates across ALL filtered contacts (not just current page)
        // Calculate behavior profile percentages based on risk bands
        // A = On Time, B = Late Reliable, C = Inconsistent, D or no band = Unknown
        const totalForProfiles = filteredContacts.length || 1; // Avoid division by zero
        const onTimeCount = filteredContacts.filter(c => c.riskBand === 'A').length;
        const lateReliableCount = filteredContacts.filter(c => c.riskBand === 'B').length;
        const inconsistentCount = filteredContacts.filter(c => c.riskBand === 'C').length;
        const unknownCount = filteredContacts.filter(c => c.riskBand === 'D' || c.riskBand === 'E' || !c.riskBand).length;
        
        // Calculate invoice aggregates scoped to filtered contacts
        const today = new Date();
        const filteredContactIds = new Set(filteredContacts.map(c => c.id));
        const filteredUnpaidInvoices = allInvoices.filter(inv => {
          const status = (inv.status || '').toLowerCase();
          return status !== 'paid' && status !== 'cancelled' && status !== 'void' && filteredContactIds.has(inv.contactId);
        });
        
        // Helper to calculate outstanding balance for an invoice
        const getInvoiceBalance = (inv: typeof allInvoices[0]) => {
          const amount = Number(inv.amount) || 0;
          const amountPaid = Number(inv.amountPaid) || 0;
          return amount - amountPaid;
        };
        
        // Calculate amounts for All/Due/Overdue
        const allInvoiceAmount = filteredUnpaidInvoices.reduce((sum, inv) => sum + getInvoiceBalance(inv), 0);
        const overdueInvoices = filteredUnpaidInvoices.filter(inv => inv.dueDate && new Date(inv.dueDate) < today);
        const overdueInvoiceAmount = overdueInvoices.reduce((sum, inv) => sum + getInvoiceBalance(inv), 0);
        const dueInvoiceAmount = allInvoiceAmount - overdueInvoiceAmount;

        const aggregates = {
          totalOutstanding: filteredContacts.reduce((sum, c) => sum + c.outstandingAmount, 0),
          highRiskCount: filteredContacts.filter(c => c.riskScore >= 70).length,
          totalContacts: filteredContacts.length,
          // Invoice amounts
          allInvoiceAmount,
          dueInvoiceAmount,
          overdueInvoiceAmount,
          // Behavior profile percentages
          onTimePercent: filteredContacts.length > 0 ? Math.round((onTimeCount / totalForProfiles) * 100) : 0,
          lateReliablePercent: filteredContacts.length > 0 ? Math.round((lateReliableCount / totalForProfiles) * 100) : 0,
          inconsistentPercent: filteredContacts.length > 0 ? Math.round((inconsistentCount / totalForProfiles) * 100) : 0,
          unknownPercent: filteredContacts.length > 0 ? Math.round((unknownCount / totalForProfiles) * 100) : 0
        };

        const result = {
          contacts: paginatedContacts,
          aggregates,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            systemTotal: allContacts.length
          }
        };

        console.log(`📊 Server-side filtered results: ${paginatedContacts.length}/${total} contacts (page ${page})`);
        res.json(result);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      if (!await hasContactAccess(user, id)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }

      const contacts = await storage.getContacts(user.tenantId);
      const contact = contacts.find(c => c.id === id);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.get("/api/contacts/:id/full-profile", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      if (!await hasContactAccess(user, req.params.id)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }

      const { id } = req.params;
      const tenantId = user.tenantId;

      const { customerTimelineService } = await import("./services/customerTimelineService");

      // Fetch all data in parallel for speed
      const [contact, invoicesResult, preferences, timeline] = await Promise.all([
        storage.getContact(id, tenantId),
        storage.getContactInvoices(id, tenantId),
        customerTimelineService.getPreferences(tenantId, id),
        customerTimelineService.getTimeline(tenantId, id, { limit: 50 })
      ]);

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json({
        contact,
        invoices: invoicesResult,
        preferences,
        timeline
      });
    } catch (error) {
      console.error("Error fetching customer full profile:", error);
      res.status(500).json({ message: "Failed to fetch customer profile" });
    }
  });

  app.get("/api/contacts/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      if (!await hasContactAccess(user, req.params.id)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }

      const { id } = req.params;
      const { invoiceId } = req.query;
      
      const { emailMessages } = await import("@shared/schema");
      
      let query;
      if (invoiceId) {
        query = db.select()
          .from(emailMessages)
          .where(and(
            eq(emailMessages.tenantId, user.tenantId),
            eq(emailMessages.invoiceId, invoiceId as string)
          ))
          .orderBy(desc(emailMessages.createdAt));
      } else {
        query = db.select()
          .from(emailMessages)
          .where(and(
            eq(emailMessages.tenantId, user.tenantId),
            eq(emailMessages.contactId, id)
          ))
          .orderBy(desc(emailMessages.createdAt));
      }
      
      const messages = await query;
      res.json(messages);
    } catch (error) {
      console.error("Error fetching contact messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/contacts/:contactId/persons", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const { contactId } = req.params;

      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const persons = await storage.getCustomerContactPersons(user.tenantId, contactId);
      res.json(persons);
    } catch (error) {
      console.error("Error fetching customer contact persons:", error);
      res.status(500).json({ message: "Failed to fetch contact persons" });
    }
  });

  app.post("/api/contacts/:contactId/persons", ...withPermission('customers:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      const { insertCustomerContactPersonSchema } = await import("@shared/schema");
      const createSchema = insertCustomerContactPersonSchema.pick({
        name: true,
        email: true,
        phone: true,
        smsNumber: true,
        jobTitle: true,
        isPrimaryCreditControl: true,
        isEscalation: true,
        notes: true,
      });
      
      const validatedBody = createSchema.parse(req.body);
      
      const person = await storage.createCustomerContactPerson({
        ...validatedBody,
        tenantId: user.tenantId,
        contactId,
      });
      res.json(person);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid request body", errors: error.errors });
      }
      console.error("Error creating customer contact person:", error);
      res.status(500).json({ message: "Failed to create contact person" });
    }
  });

  app.patch("/api/contacts/:contactId/persons/:personId", ...withPermission('customers:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const { contactId, personId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      const { insertCustomerContactPersonSchema } = await import("@shared/schema");
      const updateSchema = insertCustomerContactPersonSchema.pick({
        name: true,
        email: true,
        phone: true,
        smsNumber: true,
        jobTitle: true,
        isPrimaryCreditControl: true,
        isEscalation: true,
        notes: true,
      }).partial();
      
      const validatedBody = updateSchema.parse(req.body);
      
      const person = await storage.updateCustomerContactPerson(personId, user.tenantId, validatedBody);
      res.json(person);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid request body", errors: error.errors });
      }
      console.error("Error updating customer contact person:", error);
      res.status(500).json({ message: "Failed to update contact person" });
    }
  });

  app.delete("/api/contacts/:contactId/persons/:personId", ...withPermission('customers:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const { contactId, personId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      await storage.deleteCustomerContactPerson(personId, user.tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting customer contact person:", error);
      res.status(500).json({ message: "Failed to delete contact person" });
    }
  });

  app.patch("/api/contacts/:id/ar-details", ...withPermission('customers:edit'), async (req: any, res) => {
    try {
      console.log("📝 AR contact update request:", {
        params: req.params,
        body: req.body,
        userId: req.user?.id,
        userClaims: req.user?.claims
      });
      
      // Get user ID from claims structure (Passport deserialize adds this)
      const userId = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { arContactName, arContactEmail, arContactPhone, arNotes } = req.body;

      // Validate the contact exists and belongs to the tenant
      const tenantContacts = await storage.getContacts(user.tenantId);
      const contact = tenantContacts.find(c => c.id === id);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Update AR overlay fields in database (using contacts table schema from @shared/schema)
      await db.update(contacts)
        .set({
          arContactName,
          arContactEmail,
          arContactPhone,
          arNotes,
          updatedAt: new Date()
        })
        .where(eq(contacts.id, id));

      // Fetch updated contact
      const [updatedContact] = await db.select()
        .from(contacts)
        .where(eq(contacts.id, id))
        .limit(1);

      res.json(updatedContact);
    } catch (error) {
      console.error("Error updating AR contact details:", error);
      res.status(500).json({ message: "Failed to update AR contact details" });
    }
  });

  app.get("/api/contacts/overdue", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get all invoices for the tenant
      const allInvoices = await storage.getInvoices(user.tenantId, 1000);
      
      // Calculate 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Find contacts with invoices overdue by more than 30 days
      const overdueContactIds = new Set<string>();
      
      allInvoices.forEach(invoice => {
        const invoiceDueDate = new Date(invoice.dueDate);
        const isOverdue = (invoice.status === 'overdue' || invoice.status === 'pending') && invoiceDueDate < thirtyDaysAgo;
        
        if (isOverdue) {
          overdueContactIds.add(invoice.contactId);
        }
      });
      
      // Get all contacts and filter to those with significantly overdue invoices
      const allContacts = await storage.getContacts(user.tenantId);
      const overdueContacts = allContacts.filter(contact => 
        overdueContactIds.has(contact.id)
      );
      
      res.json(overdueContacts);
    } catch (error) {
      console.error("Error fetching overdue contacts:", error);
      res.status(500).json({ message: "Failed to fetch overdue contacts" });
    }
  });

  app.post("/api/contacts", ...withPermission('customers:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const contactData = insertContactSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.post("/api/contacts/credit-check", ...withPermission('customers:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { signals, tradingProfile, policyCap } = req.body as {
        signals: CreditSignals;
        tradingProfile: TradingProfile;
        policyCap?: number;
      };

      if (!signals || !tradingProfile) {
        return res.status(400).json({ message: "Missing signals or trading profile" });
      }

      const recommendation = generateCreditRecommendation(signals, tradingProfile, policyCap);
      res.json(recommendation);
    } catch (error) {
      console.error("Error calculating credit score:", error);
      res.status(500).json({ message: "Failed to calculate credit score" });
    }
  });

  app.post("/api/contacts/:contactId/approve-credit", ...withPermission('customers:edit'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { creditAssessment, riskScore, riskBand, creditLimit, paymentTerms } = req.body;

      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Update contact with credit decision
      await storage.updateContact(contactId, user.tenantId, {
        riskScore,
        riskBand,
        creditLimit,
        paymentTerms,
        creditAssessment,
      });

      const updatedContact = await storage.getContact(contactId, user.tenantId);
      res.json(updatedContact);
    } catch (error) {
      console.error("Error approving credit:", error);
      res.status(500).json({ message: "Failed to approve credit" });
    }
  });

  app.get("/api/contacts/:contactId/prs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;

      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Import Promise Reliability Service
      const { getPromiseReliabilityService } = await import('./services/promiseReliabilityService.js');
      const promiseService = getPromiseReliabilityService();
      
      const prsSummary = await promiseService.getCustomerPRSSummary(user.tenantId, contactId);
      
      if (!prsSummary) {
        return res.json({
          contactId,
          promiseReliabilityScore: 0,
          totalPromises: 0,
          promisesKept: 0,
          promisesBroken: 0,
          promisesPartiallyKept: 0,
          prsLast30Days: 0,
          prsLast90Days: 0,
          prsLast12Months: 0,
          behavioralFlags: {
            isSerialPromiser: false,
            isReliableLatePayer: false,
            isRelationshipDeteriorating: false,
            isNewCustomer: true,
          },
        });
      }
      
      res.json(prsSummary);
    } catch (error) {
      console.error("Error getting PRS summary:", error);
      res.status(500).json({ message: "Failed to get PRS summary" });
    }
  });

  app.get("/api/contacts/:contactId/promises", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;

      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      const { getPromiseReliabilityService } = await import('./services/promiseReliabilityService.js');
      const promiseService = getPromiseReliabilityService();
      
      const promises = await promiseService.getCustomerPromises(user.tenantId, contactId);
      res.json(promises);
    } catch (error) {
      console.error("Error getting customer promises:", error);
      res.status(500).json({ message: "Failed to get promises" });
    }
  });

  app.post("/api/contacts/:contactId/sync-to-xero", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Get contact
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // TODO: Implement Xero sync with contact groups for risk bands
      // This will use the existing XeroProvider to:
      // 1. Create/update contact in Xero
      // 2. Add to contact group based on risk band (Risk_A, Risk_B, etc.)
      // 3. Set payment terms if supported
      
      res.json({ 
        message: "Xero sync initiated", 
        contact,
        xeroContactId: contact.xeroContactId 
      });
    } catch (error) {
      console.error("Error syncing to Xero:", error);
      res.status(500).json({ message: "Failed to sync to Xero" });
    }
  });

  app.get("/api/contacts/:contactId/notes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Verify contact exists and user has access to it
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const notes = await storage.listNotesByContact(user.tenantId, contactId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching contact notes:", error);
      res.status(500).json({ message: "Failed to fetch contact notes" });
    }
  });

  app.post("/api/contacts/:contactId/notes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Verify contact exists and user has access to it
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Ensure proper content-type is set before parsing
      res.setHeader('Content-Type', 'application/json');

      const parsedData = insertContactNoteSchema.parse({
        ...req.body,
        contactId,
        createdByUserId: user.id,
        tenantId: user.tenantId,
      });

      // Convert reminderDate string to Date object for Drizzle
      // Also convert "self" assignedToUserId to the current user's ID
      const noteData = {
        ...parsedData,
        reminderDate: parsedData.reminderDate ? new Date(parsedData.reminderDate) : null,
        assignedToUserId: parsedData.assignedToUserId === "self" ? user.id : parsedData.assignedToUserId,
      };

      const note = await storage.createNote(noteData);
      
      // Create a timeline event so the note shows in Recent Activity
      const noteTypeLabel = noteData.noteType === 'reminder' ? 'Reminder' : 'Internal note';
      const preview = noteData.content.length > 100 
        ? noteData.content.substring(0, 100) + '...' 
        : noteData.content;
      
      const userName = user.firstName || user.lastName 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() 
        : user.email;
      
      await db.insert(timelineEvents).values({
        tenantId: user.tenantId,
        customerId: contactId,
        occurredAt: new Date(),
        direction: 'internal',
        channel: 'note',
        summary: `${noteTypeLabel} added`,
        preview: preview,
        body: noteData.content,
        status: 'completed',
        createdByType: 'user',
        createdByName: userName
      });
      
      // If this is a reminder note, create an attention item so it appears in the Attention list
      if (noteData.noteType === 'reminder' && noteData.reminderDate) {
        const { attentionItemService } = await import("./services/attentionItemService");
        await attentionItemService.createReminderAttentionItem(
          user.tenantId,
          contactId,
          contact.name || 'Unknown Customer',
          note.id,
          noteData.reminderDate,
          noteData.content,
          user.id
        );
        console.log(`📋 Created reminder attention item for contact ${contactId}`);
      }
      
      // Return a properly structured JSON response
      return res.status(201).json({
        success: true,
        note: note,
        message: "Note created successfully"
      });
    } catch (error) {
      console.error("Error creating contact note:", error);
      
      // Ensure proper content-type for error responses
      res.setHeader('Content-Type', 'application/json');
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid note data", 
          errors: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false,
        message: "Failed to create contact note" 
      });
    }
  });

  app.post("/api/contacts/:contactId/schedule-call", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Verify contact exists and user has access to it
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (!contact.phone) {
        return res.status(400).json({ message: "Contact has no phone number" });
      }

      const { reason, tone, goal, maxDuration, scheduleMode, scheduledFor, recipientPhone, recipientName } = req.body;

      // Use recipientPhone if provided, otherwise fall back to contact.phone
      const phoneToCall = recipientPhone || contact.phone;
      // Use recipientName if provided, otherwise fall back to contact.name
      const nameToCall = recipientName || contact.name;

      // Map tone number (0=Friendly, 1=Professional, 2=Firm) to voice tone profile
      const toneProfiles = ['VOICE_TONE_WARM_FRIENDLY', 'VOICE_TONE_CALM_COLLABORATIVE', 'VOICE_TONE_FIRM_ASSERTIVE'];
      const voiceTone = toneProfiles[tone] || toneProfiles[1];
      const toneLabels = ['Friendly', 'Professional', 'Firm'];
      const toneLabel = toneLabels[tone] || 'Professional';

      // Calculate scheduledFor time
      let scheduledTime: Date;
      if (scheduleMode === 'now' || scheduleMode === 'asap') {
        // NOW/ASAP: schedule for now (will be picked up by executor immediately)
        scheduledTime = new Date();
      } else if (scheduledFor) {
        scheduledTime = new Date(scheduledFor);
      } else {
        scheduledTime = new Date();
      }

      // Get ALL overdue invoices for this contact to calculate total outstanding
      // Filter by both status='overdue' AND due_date < today for robustness
      const overdueInvoices = await db.select()
        .from(invoices)
        .where(
          and(
            eq(invoices.contactId, contactId),
            eq(invoices.tenantId, user.tenantId),
            eq(invoices.status, 'overdue'),
            sql`${invoices.dueDate} < CURRENT_DATE`
          )
        )
        .orderBy(sql`COALESCE(${invoices.dueDate}, ${invoices.createdAt}) ASC`); // Oldest first, null-safe

      // Calculate totals across all overdue invoices (amount - amountPaid)
      const totalOutstanding = overdueInvoices.reduce((sum, inv) => {
        const amount = parseFloat(String(inv.amount || 0));
        const amountPaid = parseFloat(String(inv.amountPaid || 0));
        const outstanding = amount - amountPaid;
        return sum + (isNaN(outstanding) ? 0 : outstanding);
      }, 0);
      const invoiceCount = overdueInvoices.length;
      
      // Use the oldest (most overdue) invoice as the primary reference
      const primaryInvoice = overdueInvoices[0] || null;

      // Create an action for the AI voice call
      const [newAction] = await db.insert(actions).values({
        tenantId: user.tenantId,
        contactId: contactId,
        invoiceId: primaryInvoice?.id || null,
        userId: user.id,
        type: 'voice',
        status: 'scheduled',
        scheduledFor: scheduledTime,
        approvedBy: user.id, // Auto-approved since user manually scheduled
        approvedAt: new Date(),
        subject: `AI Call: ${goal.replace(/_/g, ' ')}`,
        content: reason || '',
        source: 'manual',
        aiGenerated: true,
        metadata: {
          goal,
          maxDuration,
          voiceTone,
          toneLabel,
          reason,
          scheduleMode,
          recipientPhone: phoneToCall,
          recipientName: nameToCall,
          invoiceNumber: primaryInvoice?.invoiceNumber,
          daysOverdue: primaryInvoice?.dueDate 
            ? Math.max(0, Math.floor((Date.now() - new Date(primaryInvoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0,
          totalOutstanding: totalOutstanding,
          invoiceCount: invoiceCount,
        }
      }).returning();

      // Create timeline event
      const userName = user.firstName || user.lastName 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() 
        : user.email;

      await db.insert(timelineEvents).values({
        tenantId: user.tenantId,
        customerId: contactId,
        occurredAt: new Date(),
        direction: 'outbound',
        channel: 'voice',
        summary: scheduleMode === 'now' ? 'AI call started' : (scheduleMode === 'asap' ? 'AI call initiated' : 'AI call scheduled'),
        preview: reason || `Goal: ${goal.replace(/_/g, ' ')}`,
        body: reason || null,
        status: 'pending',
        createdByType: 'user',
        createdByName: userName,
        actionId: newAction.id
      });

      // If scheduleMode is 'now', immediately trigger Retell call
      let retellResult = null;
      if (scheduleMode === 'now') {
        try {
          
          // Get tenant for agent configuration
          const tenant = await storage.getTenant(user.tenantId);
          
          // Use default agent if tenant doesn't have one configured
          const agentId = tenant?.retellAgentId || process.env.RETELL_AGENT_ID || '';
          
          if (!agentId) {
            console.warn('⚠️ No Retell agent ID configured, call will be scheduled for executor pickup');
          } else {
            console.log(`📞 Immediately initiating Retell call to ${phoneToCall}`);
            
            // Import and use the unified Retell call helper with standard variables
            const { createUnifiedRetellCall, createStandardCollectionVariables } = await import('./utils/retellCallHelper.js');
            
            // Calculate days overdue from the oldest invoice
            const daysOverdue = primaryInvoice?.dueDate 
              ? Math.max(0, Math.floor((Date.now() - new Date(primaryInvoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
              : 0;
            
            // Calculate additional context variables for the voice agent
            // totalOverdue = sum of overdue invoice amounts (same as totalOutstanding for overdue invoices)
            const totalOverdue = totalOutstanding;
            const overdueCount = invoiceCount;
            
            // Calculate oldest invoice age (days since invoice was created)
            const oldestInvoiceAge = primaryInvoice?.createdAt 
              ? Math.floor((Date.now() - new Date(primaryInvoice.createdAt).getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            
            // Calculate average days overdue across all overdue invoices
            const totalDaysOverdue = overdueInvoices.reduce((sum, inv) => {
              if (inv.dueDate) {
                const days = Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
                return sum + days;
              }
              return sum;
            }, 0);
            const averageDaysOverdue = overdueCount > 0 ? Math.round(totalDaysOverdue / overdueCount) : 0;
            
            // Get last payment info from invoices (using amountPaid for actual payment amount)
            const paidInvoices = await db.select()
              .from(invoices)
              .where(
                and(
                  eq(invoices.contactId, contactId),
                  eq(invoices.tenantId, user.tenantId),
                  sql`${invoices.paidDate} IS NOT NULL`
                )
              )
              .orderBy(sql`${invoices.paidDate} DESC`)
              .limit(1);
            const lastPaymentDate = paidInvoices[0]?.paidDate || null;
            // Use amountPaid for actual payment amount (handles partial payments correctly)
            const lastPaymentAmount = paidInvoices[0]?.amountPaid || null;
            
            // Get last contact from timeline events (most accurate record of communications)
            const lastTimelineEvents = await db.select()
              .from(timelineEvents)
              .where(
                and(
                  eq(timelineEvents.customerId, contactId),
                  eq(timelineEvents.tenantId, user.tenantId),
                  eq(timelineEvents.direction, 'outbound')
                )
              )
              .orderBy(sql`${timelineEvents.occurredAt} DESC`)
              .limit(1);
            const lastContactDate = lastTimelineEvents[0]?.occurredAt || null;
            const contactMethod = lastTimelineEvents[0]?.channel || null;
            
            // Count previous promises to pay from payment_plans and promisesToPay tables
            const ptpPlans = await db.select({ count: sql<number>`count(*)` })
              .from(paymentPlans)
              .where(
                and(
                  eq(paymentPlans.contactId, contactId),
                  eq(paymentPlans.tenantId, user.tenantId)
                )
              );
            const ptpPromises = await db.select({ count: sql<number>`count(*)` })
              .from(promisesToPay)
              .where(
                and(
                  eq(promisesToPay.contactId, contactId),
                  eq(promisesToPay.tenantId, user.tenantId)
                )
              );
            const previousPromises = Number(ptpPlans[0]?.count || 0) + Number(ptpPromises[0]?.count || 0);
            
            // Count disputed invoices
            const disputedInvoices = await db.select({ count: sql<number>`count(*)` })
              .from(invoices)
              .where(
                and(
                  eq(invoices.contactId, contactId),
                  eq(invoices.tenantId, user.tenantId),
                  eq(invoices.outcomeOverride, 'Disputed')
                )
              );
            const disputeCount = Number(disputedInvoices[0]?.count || 0);
            
            // Get credit terms from contact (paymentTerms is stored as days, e.g., 30 -> "Net 30")
            const creditTermsDays = contact.paymentTerms || 30;
            const creditTerms = `Net ${creditTermsDays}`;
            
            // Calculate account age (days since first invoice)
            const firstInvoice = await db.select()
              .from(invoices)
              .where(
                and(
                  eq(invoices.contactId, contactId),
                  eq(invoices.tenantId, user.tenantId)
                )
              )
              .orderBy(sql`${invoices.createdAt} ASC`)
              .limit(1);
            const accountAge = firstInvoice[0]?.createdAt 
              ? Math.floor((Date.now() - new Date(firstInvoice[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            
            // Create standard collection variables with real customer data
            const callVariables = createStandardCollectionVariables({
              customerName: nameToCall,
              companyName: contact.companyName || contact.name,
              invoiceNumber: primaryInvoice?.invoiceNumber || 'N/A',
              invoiceAmount: totalOutstanding,
              totalOutstanding: totalOutstanding,
              invoiceCount: invoiceCount,
              daysOverdue: daysOverdue,
              dueDate: primaryInvoice?.dueDate,
              // New enhanced context variables
              totalOverdue: totalOverdue,
              overdueCount: overdueCount,
              oldestInvoiceAge: oldestInvoiceAge,
              averageDaysOverdue: averageDaysOverdue,
              lastPaymentDate: lastPaymentDate,
              lastPaymentAmount: lastPaymentAmount,
              lastContactDate: lastContactDate,
              contactMethod: contactMethod,
              previousPromises: previousPromises,
              disputeCount: disputeCount,
              creditTerms: creditTerms,
              accountAge: accountAge,
            });
            
            const unifiedResult = await createUnifiedRetellCall({
              fromNumber: process.env.RETELL_PHONE_NUMBER || '+442045772088',
              toNumber: phoneToCall,
              agentId: agentId,
              dynamicVariables: {
                ...callVariables,
                voiceTone: voiceTone,
                toneLabel: toneLabel,
                reasonForCall: reason || '',
                callGoal: goal || 'payment_commitment',
                maxDuration: String(maxDuration || 5),
              },
              metadata: {
                // Use snake_case keys to match webhook expectations
                tenant_id: user.tenantId,
                contact_id: contact.id,
                invoice_id: primaryInvoice?.id,
                action_id: newAction.id,
                invoice_amount: totalOutstanding,
                type: 'system_call',
                voiceTone,
                goal,
                reason,
              },
              context: 'SYSTEM_CALL'
            });
            
            // Convert unified result to expected format
            retellResult = {
              call_id: unifiedResult.callId,
              status: unifiedResult.status,
              from_number: unifiedResult.fromNumber,
              to_number: unifiedResult.toNumber,
              agent_id: unifiedResult.agentId,
            };
            
            console.log(`✅ Retell call initiated: ${JSON.stringify(retellResult)}`);
            
            // Update action with call ID and status
            if (retellResult?.call_id) {
              await db.update(actions)
                .set({ 
                  status: 'executing',
                  executedAt: new Date(),
                  metadata: { 
                    ...newAction.metadata as any, 
                    retellCallId: retellResult.call_id 
                  } 
                })
                .where(eq(actions.id, newAction.id));
            }
          }
        } catch (retellError: any) {
          console.error('❌ Failed to initiate immediate Retell call:', retellError.message);
          // Update action status back to scheduled for executor pickup
          await db.update(actions)
            .set({ status: 'scheduled' })
            .where(eq(actions.id, newAction.id));
        }
      }

      return res.status(201).json({
        success: true,
        action: newAction,
        retellCall: retellResult,
        message: scheduleMode === 'now' ? "AI call started" : (scheduleMode === 'asap' ? "AI call initiated" : "AI call scheduled")
      });
    } catch (error) {
      console.error("Error scheduling AI call:", error);
      return res.status(500).json({ 
        success: false,
        message: "Failed to schedule AI call" 
      });
    }
  });

  app.get("/api/contacts/:contactId/call-status/:callId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, callId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { actionId } = req.query;
      const tenantId = user.tenantId;

      console.log(`📞 [CALL-STATUS] ⚠️ DEPRECATED - Polling endpoint (webhook preferred)`);
      console.log(`📞 [CALL-STATUS] callId=${callId}, contactId=${contactId}, actionId=${actionId}`);

      if (!callId) {
        return res.status(400).json({ message: "Call ID is required" });
      }

      // Get call details from Retell API
      const { retellService } = await import('./retell-service.js');
      const callData = await retellService.getCall(callId);

      // Normalize Retell status to our status values
      const retellStatus = callData.call_status;
      const disconnectionReason = callData.disconnection_reason || '';
      
      // Map Retell statuses to our terminal/non-terminal statuses
      let voiceStatus: 'completed' | 'no_answer' | 'busy' | 'voicemail' | 'failed' | 'in_progress' = 'in_progress';
      let isTerminal = false;
      
      if (retellStatus === 'ended') {
        isTerminal = true;
        // Check disconnection reason for non-completed statuses
        if (disconnectionReason.includes('no_answer') || disconnectionReason === 'no_audio_timeout') {
          voiceStatus = 'no_answer';
        } else if (disconnectionReason.includes('busy') || disconnectionReason === 'line_busy') {
          voiceStatus = 'busy';
        } else if (disconnectionReason.includes('voicemail') || disconnectionReason === 'voicemail_reached') {
          voiceStatus = 'voicemail';
        } else if (disconnectionReason.includes('fail') || disconnectionReason === 'call_transfer_failed') {
          voiceStatus = 'failed';
        } else {
          voiceStatus = 'completed';
        }
      } else if (retellStatus === 'error') {
        isTerminal = true;
        voiceStatus = 'failed';
      }

      // Calculate duration
      const durationSeconds = callData.start_timestamp && callData.end_timestamp
        ? Math.round((callData.end_timestamp - callData.start_timestamp) / 1000)
        : 0;

      // If not terminal, return progress
      if (!isTerminal) {
        return res.json({
          status: retellStatus === 'registered' || retellStatus === 'queued' ? 'connecting' : 'in_progress',
          terminal: false,
          processed: false,
          callStatus: retellStatus
        });
      }

      // If no actionId, can't process further
      if (!actionId) {
        return res.json({
          status: voiceStatus,
          terminal: true,
          processed: false,
          message: 'No actionId provided, cannot process'
        });
      }

      // Load action and verify tenant security
      const [action] = await db.select()
        .from(actions)
        .where(and(
          eq(actions.id, actionId as string),
          eq(actions.tenantId, tenantId)
        ))
        .limit(1);

      if (!action) {
        return res.status(404).json({ message: "Action not found or access denied" });
      }

      // Verify action is for the right contact
      if (action.contactId !== contactId) {
        return res.status(403).json({ message: "Action does not belong to this contact" });
      }

      // Idempotency check: if already processed, return cached result
      if (action.voiceProcessedAt) {
        console.log(`📞 [CALL-STATUS] Already processed at ${action.voiceProcessedAt}`);
        return res.json({
          status: action.voiceStatus || voiceStatus,
          terminal: true,
          processed: true,
          alreadyProcessed: true,
          workState: action.workState,
          inFlightState: action.inFlightState,
          message: 'Call already processed'
        });
      }

      // Prepare snippets
      const transcriptSnippet = callData.transcript ? callData.transcript.substring(0, 500) : null;
      const summarySnippet = callData.call_analysis?.call_summary?.substring(0, 240) || null;
      const recordingUrl = callData.recording_url || null;

      // Update action with voice tracking fields
      await db.update(actions)
        .set({
          voiceStatus,
          voiceCompletedAt: new Date(),
          voiceTranscriptSnippet: transcriptSnippet,
          voiceSummarySnippet: summarySnippet,
          voiceRecordingUrl: recordingUrl,
          voiceLastPolledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, action.id));

      // Get linked invoice IDs from action
      const linkedInvoiceIds: string[] = action.invoiceIds || (action.invoiceId ? [action.invoiceId] : []);

      // Import WorkStateService
      const { WorkStateService } = await import('./services/workStateService.js');
      const workStateService = new WorkStateService();

      // HANDLE DIFFERENT TERMINAL STATUSES
      
      // 1) no_answer / busy / voicemail → COOLDOWN
      if (['no_answer', 'busy', 'voicemail'].includes(voiceStatus)) {
        // Write REPLY_RECEIVED audit event
        await workStateService.emitAuditEvent({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || undefined,
          actionId: action.id,
          type: 'REPLY_RECEIVED',
          summary: `AI call — ${voiceStatus === 'no_answer' ? 'No answer' : voiceStatus === 'busy' ? 'Busy' : 'Voicemail'}${durationSeconds > 0 ? ` (${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s)` : ''}`,
          payload: {
            channel: 'VOICE',
            provider: 'RETELL',
            callId,
            status: voiceStatus,
            durationSeconds,
            transcriptSnippet,
            summarySnippet,
            recordingUrl,
            linkedInvoiceIds,
          },
          actor: 'SYSTEM',
        });

        // Get cooldown policy
        const policy = await workStateService.getPolicy(tenantId);
        const cooldownDays = policy?.cooldownDays || 2;
        const cooldownUntil = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000);

        // Update action to COOLDOWN
        await db.update(actions)
          .set({
            workState: 'IN_FLIGHT',
            inFlightState: 'COOLDOWN',
            cooldownUntil,
            voiceProcessedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(actions.id, action.id));

        // Emit STATE_CHANGED
        await workStateService.emitAuditEvent({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || undefined,
          actionId: action.id,
          type: 'STATE_CHANGED',
          summary: `Action entered cooldown (${cooldownDays} days) after ${voiceStatus}`,
          payload: { cooldownDays, cooldownUntil, voiceStatus },
          actor: 'SYSTEM',
        });

        console.log(`📞 [CALL-STATUS] ${voiceStatus} → COOLDOWN for ${cooldownDays} days`);

        return res.json({
          status: voiceStatus,
          terminal: true,
          processed: true,
          workState: 'IN_FLIGHT',
          inFlightState: 'COOLDOWN',
          message: `No answer, entering ${cooldownDays}-day cooldown`
        });
      }

      // 2) failed → ATTENTION + attention_item DELIVERY_FAILED
      if (voiceStatus === 'failed') {
        // Write REPLY_RECEIVED audit event
        await workStateService.emitAuditEvent({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || undefined,
          actionId: action.id,
          type: 'REPLY_RECEIVED',
          summary: `AI call — Failed`,
          payload: {
            channel: 'VOICE',
            provider: 'RETELL',
            callId,
            status: voiceStatus,
            disconnectionReason,
            linkedInvoiceIds,
          },
          actor: 'SYSTEM',
        });

        // Create attention item
        const { AttentionItemService } = await import('./services/attentionItemService.js');
        const attentionService = new AttentionItemService();
        await attentionService.createItem({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || null,
          type: 'DELIVERY_FAILED',
          title: 'Voice call delivery failed',
          description: `Call failed: ${disconnectionReason || 'Unknown reason'}`,
          severity: 'medium',
        });

        // Update action to ATTENTION
        await db.update(actions)
          .set({
            workState: 'ATTENTION',
            inFlightState: 'DELIVERY_FAILED',
            voiceProcessedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(actions.id, action.id));

        // Emit ROUTED_TO_ATTENTION + STATE_CHANGED
        await workStateService.emitAuditEvent({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || undefined,
          actionId: action.id,
          type: 'ROUTED_TO_ATTENTION',
          summary: 'Call delivery failed, routed to attention',
          payload: { attentionItemType: 'DELIVERY_FAILED', disconnectionReason },
          actor: 'SYSTEM',
        });

        await workStateService.emitAuditEvent({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || undefined,
          actionId: action.id,
          type: 'STATE_CHANGED',
          summary: `Action state changed: IN_FLIGHT → ATTENTION (delivery failed)`,
          payload: { previousWorkState: action.workState, newWorkState: 'ATTENTION', inFlightState: 'DELIVERY_FAILED' },
          actor: 'SYSTEM',
        });

        console.log(`📞 [CALL-STATUS] failed → ATTENTION (DELIVERY_FAILED)`);

        return res.json({
          status: voiceStatus,
          terminal: true,
          processed: true,
          workState: 'ATTENTION',
          inFlightState: 'DELIVERY_FAILED',
          message: 'Call failed, routed to attention'
        });
      }

      // 3) completed → extract intent, create outcome, routeFromOutcome
      if (voiceStatus === 'completed') {
        const transcriptText = callData.transcript || '';
        const summaryText = callData.call_analysis?.call_summary || '';

        // Check if we have content to extract from
        if (!transcriptText && !summaryText) {
          // No transcript, create DATA_QUALITY attention item
          const { AttentionItemService } = await import('./services/attentionItemService.js');
          const attentionService = new AttentionItemService();
          await attentionService.createItem({
            tenantId,
            debtorId: contactId,
            invoiceId: linkedInvoiceIds[0] || null,
            type: 'DATA_QUALITY',
            subtype: 'VOICE_TRANSCRIPT_MISSING',
            title: 'Voice call transcript missing',
            description: 'Call completed but no transcript available for analysis',
            severity: 'medium',
          });

          // Write REPLY_RECEIVED audit event
          await workStateService.emitAuditEvent({
            tenantId,
            debtorId: contactId,
            invoiceId: linkedInvoiceIds[0] || undefined,
            actionId: action.id,
            type: 'REPLY_RECEIVED',
            summary: `AI call — Completed (${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s)`,
            payload: {
              channel: 'VOICE',
              provider: 'RETELL',
              callId,
              status: voiceStatus,
              durationSeconds,
              transcriptMissing: true,
              linkedInvoiceIds,
            },
            actor: 'SYSTEM',
          });

          // Update action
          await db.update(actions)
            .set({
              workState: 'ATTENTION',
              voiceProcessedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(actions.id, action.id));

          // Emit ROUTED_TO_ATTENTION
          await workStateService.emitAuditEvent({
            tenantId,
            debtorId: contactId,
            invoiceId: linkedInvoiceIds[0] || undefined,
            actionId: action.id,
            type: 'ROUTED_TO_ATTENTION',
            summary: 'Transcript missing, routed to attention for manual review',
            payload: { attentionItemType: 'DATA_QUALITY', subtype: 'VOICE_TRANSCRIPT_MISSING' },
            actor: 'SYSTEM',
          });

          console.log(`📞 [CALL-STATUS] completed but no transcript → ATTENTION`);

          return res.json({
            status: voiceStatus,
            terminal: true,
            processed: true,
            workState: 'ATTENTION',
            message: 'Transcript missing; review required'
          });
        }

        // Run intent extraction with OpenAI
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const contentToAnalyze = transcriptText || summaryText;
        
        // Get current date for context (so AI uses correct year for dates like "28th Feb")
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const currentYear = new Date().getFullYear();

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{
            role: "system",
            content: `Today's date is ${currentDate}. When interpreting dates mentioned in the call (like "28th February" or "next month"), use the current year ${currentYear} or the next appropriate future date.

Analyze this debt collection AI call and extract the outcome. Use these EXACT outcome types:
- PROMISE_TO_PAY: Debtor commits to pay on a specific date
- PAYMENT_IN_PROCESS: Payment is being processed, awaiting authorization, in payment run
- DISPUTE: Debtor disputes the invoice (pricing, delivery, quality issues)
- DOCS_REQUESTED: Debtor requests invoice copy, statement, PO, or remittance
- REQUEST_CALL_BACK: Debtor asks to be called back or speak to someone else
- CONTACT_ISSUE: Wrong number, contact no longer works there, etc.
- CANNOT_PAY: Debtor explicitly cannot pay (financial difficulties)
- BANK_DETAILS_CHANGE_REQUEST: Debtor wants to change bank details (ALWAYS flag for review)
- OUT_OF_OFFICE: Contact is away/on leave
- NO_RESPONSE: Debtor acknowledged but gave no commitment
- CONFIRMATION: Simple acknowledgment without commitment

Return JSON with:
- type: One of the outcome types above
- confidence: 0-100 (how confident are you)
- promisedPaymentDate: ISO date string if PTP mentioned
- promisedPaymentAmount: number if amount mentioned
- disputeCategory: PRICING|DELIVERY|QUALITY|OTHER if dispute
- docsRequested: array of INVOICE_COPY|STATEMENT|REMITTANCE|PO if docs requested
- summary: Brief 1-2 sentence summary`
          }, {
            role: "user",
            content: contentToAnalyze
          }],
          response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0].message.content || '{}');
        const outcomeType = analysis.type || 'NO_RESPONSE';
        const confidenceScore = (analysis.confidence || 70) / 100;
        const confidenceBand = confidenceScore >= 0.85 ? 'HIGH' : confidenceScore >= 0.65 ? 'MEDIUM' : 'LOW';
        const requiresHumanReview = confidenceScore < 0.65 || ['BANK_DETAILS_CHANGE_REQUEST', 'DISPUTE'].includes(outcomeType);

        // Build extracted data
        const extracted: Record<string, any> = {};
        if (analysis.promisedPaymentDate) extracted.promisedPaymentDate = analysis.promisedPaymentDate;
        if (analysis.promisedPaymentAmount) extracted.promisedPaymentAmount = analysis.promisedPaymentAmount;
        if (analysis.disputeCategory) extracted.disputeCategory = analysis.disputeCategory;
        if (analysis.docsRequested) extracted.docsRequested = analysis.docsRequested;
        if (analysis.summary) extracted.freeTextNotes = analysis.summary;

        // Idempotent outcome creation using try/catch for race conditions
        let newOutcome: any;
        let wasNewlyCreated = false;
        
        try {
          // Try to create outcome
          const [createdOutcome] = await db.insert(outcomes)
            .values({
              tenantId,
              debtorId: contactId,
              invoiceId: linkedInvoiceIds[0] || null,
              linkedInvoiceIds,
              type: outcomeType,
              confidence: String(confidenceScore.toFixed(2)),
              confidenceBand,
              requiresHumanReview,
              extracted,
              sourceChannel: 'VOICE',
              sourceMessageId: callId,
              rawSnippet: (transcriptText || summaryText).substring(0, 200),
            })
            .returning();
          newOutcome = createdOutcome;
          wasNewlyCreated = true;
          console.log(`📞 [CALL-STATUS] Created outcome: ${outcomeType} (${confidenceBand})`);
        } catch (insertError: any) {
          // If duplicate key error, fetch existing outcome
          if (insertError?.message?.includes('uniq_outcomes_source') || insertError?.code === '23505') {
            const [existingOutcome] = await db.select()
              .from(outcomes)
              .where(and(
                eq(outcomes.sourceMessageId, callId),
                eq(outcomes.sourceChannel, 'VOICE'),
                eq(outcomes.tenantId, tenantId)
              ))
              .limit(1);
            newOutcome = existingOutcome;
            console.log(`📞 [CALL-STATUS] Outcome already exists for callId ${callId}, using existing`);
          } else {
            throw insertError; // Re-throw non-duplicate errors
          }
        }

        // Only process if newly created (not duplicate)
        if (wasNewlyCreated) {
          // Write REPLY_RECEIVED audit event with transcript info
          await workStateService.emitAuditEvent({
            tenantId,
            debtorId: contactId,
            invoiceId: linkedInvoiceIds[0] || undefined,
            actionId: action.id,
            type: 'REPLY_RECEIVED',
            summary: `AI call — Completed (${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s)`,
            payload: {
              channel: 'VOICE',
              provider: 'RETELL',
              callId,
              status: voiceStatus,
              durationSeconds,
              transcriptSnippet,
              summarySnippet,
              recordingUrl,
              linkedInvoiceIds,
              outcomeId: newOutcome.id,
            },
            actor: 'SYSTEM',
          });

          // Process outcome through Loop routing
          await workStateService.processOutcome(newOutcome);

          // Update action with voiceProcessedAt
          await db.update(actions)
            .set({
              voiceProcessedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(actions.id, action.id));
        }

        // Fetch updated action for response
        const [updatedAction] = await db.select()
          .from(actions)
          .where(eq(actions.id, action.id))
          .limit(1);

        // Use stored outcome data for consistent response
        const storedOutcomeType = newOutcome?.type || outcomeType;
        const storedConfidenceBand = newOutcome?.confidenceBand || confidenceBand;
        const effectLabel = storedConfidenceBand === 'HIGH' ? 'High' : storedConfidenceBand === 'MEDIUM' ? 'Medium' : 'Low';

        console.log(`📞 [CALL-STATUS] completed → ${updatedAction.workState}/${updatedAction.inFlightState || '-'}`);

        return res.json({
          status: voiceStatus,
          terminal: true,
          processed: true,
          outcomeId: newOutcome?.id,
          workState: updatedAction.workState,
          inFlightState: updatedAction.inFlightState,
          message: `Outcome captured: ${storedOutcomeType.replace(/_/g, ' ')} (${effectLabel})`
        });
      }

      // Fallback
      return res.json({
        status: voiceStatus,
        terminal: true,
        processed: false,
        message: 'Unknown terminal state'
      });

    } catch (error: any) {
      console.error("❌ [CALL-STATUS] Error:", error?.message);
      res.status(500).json({ message: "Failed to check call status", error: error?.message });
    }
  });

  app.post("/api/contacts/:contactId/generate-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { templateType, tone, includeStatutoryInterest = true, recipientName, recipientEmail } = req.body;

      // Verify contact exists and user has access
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get overdue invoices for this contact (unpaid invoices past due date)
      const overdueInvoicesList = await db.select()
        .from(invoices)
        .where(
          and(
            eq(invoices.contactId, contactId),
            eq(invoices.tenantId, user.tenantId),
            lt(invoices.dueDate, new Date()),
            not(eq(invoices.status, 'paid'))
          )
        )
        .orderBy(desc(invoices.dueDate));

      // Get recent timeline events
      const recentEvents = await db.select()
        .from(timelineEvents)
        .where(
          and(
            eq(timelineEvents.customerId, contactId),
            eq(timelineEvents.tenantId, user.tenantId)
          )
        )
        .orderBy(desc(timelineEvents.occurredAt))
        .limit(10);

      // Calculate total outstanding, interest, and oldest overdue (balance = amount - amountPaid)
      const BOE_BASE_RATE = 4.5; // Bank of England base rate
      const STATUTORY_MARKUP = 8.0; // UK Late Payment of Commercial Debts Act markup
      const GRACE_PERIOD = 0; // No grace period for statutory interest
      
      let totalInterest = 0;
      const invoicesWithInterest = overdueInvoicesList.map(inv => {
        const balance = Number(inv.amount || 0) - Number(inv.amountPaid || 0);
        const daysOverdue = inv.dueDate 
          ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        
        // Calculate statutory interest if enabled
        let interest = 0;
        if (includeStatutoryInterest && daysOverdue > 0 && balance > 0) {
          const interestResult = calculateLatePaymentInterest({
            principalAmount: balance,
            dueDate: new Date(inv.dueDate!),
            boeBaseRate: BOE_BASE_RATE,
            interestMarkup: STATUTORY_MARKUP,
            gracePeriod: GRACE_PERIOD
          });
          interest = interestResult.interestAmount;
          totalInterest += interest;
        }
        
        return {
          invoiceNumber: inv.invoiceNumber || 'N/A',
          amount: balance,
          interest,
          dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-GB') : 'N/A',
          daysOverdue
        };
      });
      
      const totalOutstanding = invoicesWithInterest.reduce((sum, inv) => sum + inv.amount, 0);
      const oldestOverdueDays = invoicesWithInterest.length > 0
        ? Math.max(...invoicesWithInterest.map(inv => inv.daysOverdue))
        : 0;

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId),
      });

      // Fetch failed PTP details if this is a failed_ptp template
      let failedPtpDetails = null;
      if (templateType === 'failed_ptp') {
        const failedPtps = await db.select()
          .from(promisesToPay)
          .innerJoin(invoices, eq(promisesToPay.invoiceId, invoices.id))
          .where(
            and(
              eq(promisesToPay.contactId, contactId),
              eq(promisesToPay.tenantId, user.tenantId),
              eq(promisesToPay.status, 'breached')
            )
          )
          .orderBy(desc(promisesToPay.breachedAt))
          .limit(5);

        if (failedPtps.length > 0) {
          // Get the most recent breached PTP
          const mostRecentPtp = failedPtps[0];
          const breachDate = mostRecentPtp.promisesToPay.breachedAt || mostRecentPtp.promisesToPay.promisedDate;
          const daysSinceBreach = Math.floor((Date.now() - new Date(breachDate).getTime()) / (1000 * 60 * 60 * 24));
          
          failedPtpDetails = {
            promiseDate: new Date(mostRecentPtp.promisesToPay.promisedDate).toLocaleDateString('en-GB'),
            promisedAmount: Number(mostRecentPtp.promisesToPay.amount),
            invoiceNumbers: failedPtps.map(p => p.invoices.invoiceNumber || 'N/A'),
            daysSinceBreach
          };
        }
      }

      // Build context for AI email generation
      const { generateCollectionEmail } = await import("./services/openai.js");
      
      // Use recipient name from request, or fall back to AR contact name
      // Extract first name for personal greeting
      const recipientFirstName = recipientName 
        ? recipientName.split(' ')[0] 
        : contact.arContactName?.split(' ')[0];
      
      // Calculate 7-day notice date for debt escalation template
      let debtEscalationNoticeDate: string | undefined;
      if (templateType === 'debt_escalation') {
        const noticeDate = new Date();
        noticeDate.setDate(noticeDate.getDate() + 7);
        debtEscalationNoticeDate = noticeDate.toLocaleDateString('en-GB', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });
      }
      
      const emailDraft = await generateCollectionEmail(templateType, {
        contactName: recipientFirstName || 'there',
        companyName: contact.name || 'Customer',
        totalOutstanding,
        oldestOverdueDays,
        invoices: invoicesWithInterest,
        recentActivity: recentEvents.map(e => ({
          type: e.channel || 'event',
          date: new Date(e.occurredAt).toLocaleDateString('en-GB'),
          summary: e.summary || ''
        })),
        paymentPlan: null,
        tone: tone || 'professional',
        senderName: user.firstName || user.email.split('@')[0],
        senderCompany: tenant?.name || 'Accounts Receivable',
        includeStatutoryInterest,
        totalInterest,
        statutoryInterestRate: BOE_BASE_RATE + STATUTORY_MARKUP,
        failedPtpDetails,
        debtEscalationNoticeDate
      });

      res.json({
        subject: emailDraft.subject,
        body: emailDraft.body,
        templateType: emailDraft.templateType,
        contactEmail: contact.arContactEmail || contact.email
      });
    } catch (error) {
      console.error("Error generating email:", error);
      res.status(500).json({ message: "Failed to generate email" });
    }
  });

  app.post("/api/contacts/:contactId/send-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { subject, body, templateType, recipientEmail: providedRecipient } = req.body;

      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Use provided recipient email, or fallback to AR contact email, then primary email
      const recipientEmail = providedRecipient || contact.arContactEmail || contact.email;
      if (!recipientEmail) {
        return res.status(400).json({ message: "Contact has no email address" });
      }

      // Get tenant for sender info
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId),
      });

      // Send email via SendGrid with conversation tracking
      const { sendEmail, DEFAULT_FROM_EMAIL, DEFAULT_FROM } = await import("./services/sendgrid.js");
      const { generateReplyToEmail, findOrCreateConversation, updateConversationStats } = await import("./services/emailCommunications.js");
      const { v4: uuidv4 } = await import("uuid");
      
      // Generate IDs for conversation tracking
      const emailMessageId = uuidv4();
      const conversationId = await findOrCreateConversation(user.tenantId, contactId, subject);
      const replyToEmail = generateReplyToEmail(user.tenantId, conversationId, emailMessageId);
      const replyToken = `${user.tenantId}.${conversationId}.${emailMessageId}`;
      const threadKey = `cust_${contactId}`;
      
      const htmlBody = body.replace(/\n/g, '<br>');
      
      // Create emailMessages record BEFORE sending (with pre-generated ID)
      const [emailMessageRecord] = await db.insert(emailMessages).values({
        id: emailMessageId,
        tenantId: user.tenantId,
        conversationId,
        direction: 'OUTBOUND',
        channel: 'EMAIL',
        contactId,
        invoiceId: null,
        subject,
        textBody: body,
        htmlBody,
        threadKey,
        replyToken,
        status: 'QUEUED',
      }).returning();
      
      const result = await sendEmail({
        to: recipientEmail,
        from: `${tenant?.name || DEFAULT_FROM} <${DEFAULT_FROM_EMAIL}>`,
        replyTo: replyToEmail,
        subject,
        html: htmlBody,
        text: body,
        customerId: contactId,
        tenantId: user.tenantId,
      });

      if (!result.success) {
        // Update emailMessages record to failed status
        await db.update(emailMessages)
          .set({ status: 'FAILED', error: result.error, updatedAt: new Date() })
          .where(eq(emailMessages.id, emailMessageId));
        return res.status(500).json({ message: result.error || "Failed to send email" });
      }
      
      // Update emailMessages record to sent status
      await db.update(emailMessages)
        .set({ status: 'SENT', sentAt: new Date(), updatedAt: new Date() })
        .where(eq(emailMessages.id, emailMessageId));
      
      // Update conversation stats
      await updateConversationStats(conversationId, 'outbound');

      // Create action record
      const [newAction] = await db.insert(actions).values({
        tenantId: user.tenantId,
        contactId: contactId,
        invoiceId: null,
        userId: user.id,
        type: 'email',
        status: 'completed',
        scheduledFor: new Date(),
        completedAt: new Date(),
        approvedBy: user.id,
        approvedAt: new Date(),
        subject,
        content: body,
        source: 'manual',
        aiGenerated: templateType !== 'manual',
        metadata: {
          templateType,
          messageId: result.messageId,
          sentTo: contact.email
        }
      }).returning();

      // Create timeline event
      const userName = user.firstName || user.lastName 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() 
        : user.email;

      await db.insert(timelineEvents).values({
        tenantId: user.tenantId,
        customerId: contactId,
        occurredAt: new Date(),
        direction: 'outbound',
        channel: 'email',
        summary: `Email sent: ${subject}`,
        preview: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
        body: body,
        status: 'sent',
        createdByUserId: user.id,
        createdByName: userName,
        metadata: {
          templateType,
          messageId: result.messageId,
          actionId: newAction.id
        }
      });

      res.json({ 
        success: true, 
        messageId: result.messageId,
        actionId: newAction.id 
      });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  app.post("/api/contacts/:contactId/generate-sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { templateType, tone, recipientName } = req.body;

      // Verify contact exists and user has access
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get overdue invoices for this contact
      const overdueInvoicesList = await db.select()
        .from(invoices)
        .where(
          and(
            eq(invoices.contactId, contactId),
            eq(invoices.tenantId, user.tenantId),
            lt(invoices.dueDate, new Date()),
            not(eq(invoices.status, 'paid'))
          )
        )
        .orderBy(desc(invoices.dueDate));

      // Calculate total outstanding
      const totalOutstanding = overdueInvoicesList.reduce((sum, inv) => {
        const balance = Number(inv.amount || 0) - Number(inv.amountPaid || 0);
        return sum + balance;
      }, 0);

      const oldestOverdueDays = overdueInvoicesList.length > 0
        ? Math.max(...overdueInvoicesList.map(inv => {
            return inv.dueDate 
              ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
              : 0;
          }))
        : 0;

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId),
      });

      // Build context for AI SMS generation
      const { generateCollectionSms } = await import("./services/openai.js");
      
      // Use the passed recipientName if provided, otherwise fall back to contact.arContactName
      const recipientFirstName = recipientName 
        ? recipientName.split(' ')[0] 
        : (contact.arContactName?.split(' ')[0] || 'there');
      
      const smsDraft = await generateCollectionSms(templateType, {
        contactName: recipientFirstName,
        companyName: contact.name || 'Customer',
        totalOutstanding,
        oldestOverdueDays,
        tone: tone || 'professional',
        senderCompany: tenant?.name || 'Accounts Receivable'
      });

      res.json({
        body: smsDraft.body,
        templateType: smsDraft.templateType
      });
    } catch (error) {
      console.error("Error generating SMS:", error);
      res.status(500).json({ message: "Failed to generate SMS" });
    }
  });

  app.post("/api/contacts/:contactId/send-sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { body, templateType, recipientPhone: providedPhone } = req.body;

      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Use provided phone, or fallback to AR contact phone
      const recipientPhone = providedPhone || contact.arContactPhone || contact.phone;
      if (!recipientPhone) {
        return res.status(400).json({ message: "Contact has no phone number" });
      }

      // Normalize UK phone numbers to E.164 format for Vonage
      // UK local: 07xxx -> 447xxx, +44 7xxx -> 447xxx
      const normalizeUKPhone = (phone: string): string => {
        let normalized = phone.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
        if (normalized.startsWith('+44')) {
          normalized = '44' + normalized.slice(3);
        } else if (normalized.startsWith('0044')) {
          normalized = '44' + normalized.slice(4);
        } else if (normalized.startsWith('0')) {
          normalized = '44' + normalized.slice(1);
        }
        return normalized;
      };
      
      const normalizedPhone = normalizeUKPhone(recipientPhone);

      // Send SMS via Vonage
      const { sendSMS } = await import("./services/vonage.js");
      
      const result = await sendSMS({
        to: normalizedPhone,
        message: body
      });

      if (!result.success) {
        return res.status(500).json({ message: result.error || "Failed to send SMS" });
      }

      // Create action record
      const [newAction] = await db.insert(actions).values({
        tenantId: user.tenantId,
        contactId: contactId,
        invoiceId: null,
        userId: user.id,
        type: 'sms',
        status: 'completed',
        scheduledFor: new Date(),
        completedAt: new Date(),
        approvedBy: user.id,
        approvedAt: new Date(),
        subject: null,
        content: body,
        source: 'manual',
        aiGenerated: templateType !== 'manual',
        metadata: {
          templateType,
          messageId: result.messageId,
          sentTo: recipientPhone
        }
      }).returning();

      // Create timeline event
      const userName = user.firstName || user.lastName 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() 
        : user.email;

      await db.insert(timelineEvents).values({
        tenantId: user.tenantId,
        customerId: contactId,
        occurredAt: new Date(),
        direction: 'outbound',
        channel: 'sms',
        summary: `SMS sent to ${recipientPhone}`,
        preview: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
        body: body,
        status: 'sent',
        createdByUserId: user.id,
        createdByName: userName,
        metadata: {
          templateType,
          messageId: result.messageId,
          actionId: newAction.id
        }
      });

      res.json({ 
        success: true, 
        messageId: result.messageId,
        actionId: newAction.id 
      });
    } catch (error) {
      console.error("Error sending SMS:", error);
      res.status(500).json({ message: "Failed to send SMS" });
    }
  });

  app.get("/api/contacts/:contactId/preview", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { customerTimelineService } = await import("./services/customerTimelineService");
      
      const preview = await customerTimelineService.getCustomerPreview(user.tenantId, contactId);
      if (!preview) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json(preview);
    } catch (error) {
      console.error("Error fetching customer preview:", error);
      res.status(500).json({ message: "Failed to fetch customer preview" });
    }
  });

  app.get("/api/contacts/:contactId/timeline/page", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { offset, limit } = req.query;
      
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const { customerTimelineService } = await import("./services/customerTimelineService");
      
      const result = await customerTimelineService.getTimelinePage(
        user.tenantId, 
        contactId,
        offset ? parseInt(offset as string, 10) : 0,
        limit ? parseInt(limit as string, 10) : 20
      );

      res.json(result);
    } catch (error) {
      console.error("Error fetching customer timeline page:", error);
      res.status(500).json({ message: "Failed to fetch customer timeline" });
    }
  });

  app.get("/api/contacts/:contactId/invoices/page", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { offset, limit } = req.query;
      
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const { customerTimelineService } = await import("./services/customerTimelineService");
      
      const result = await customerTimelineService.getInvoicesPage(
        user.tenantId, 
        contactId,
        offset ? parseInt(offset as string, 10) : 0,
        limit ? parseInt(limit as string, 10) : 20
      );

      res.json(result);
    } catch (error) {
      console.error("Error fetching customer invoices page:", error);
      res.status(500).json({ message: "Failed to fetch customer invoices" });
    }
  });

  app.get("/api/contacts/:contactId/invoices/paid", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { offset, limit } = req.query;
      
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const { customerTimelineService } = await import("./services/customerTimelineService");
      
      const result = await customerTimelineService.getPaidInvoicesPage(
        user.tenantId, 
        contactId,
        offset ? parseInt(offset as string, 10) : 0,
        limit ? parseInt(limit as string, 10) : 20
      );

      res.json(result);
    } catch (error) {
      console.error("Error fetching paid invoices:", error);
      res.status(500).json({ message: "Failed to fetch paid invoices" });
    }
  });

  app.get("/api/contacts/:contactId/timeline", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { cursor, limit, channel, direction, outcomesOnly, needsReviewOnly, invoiceId } = req.query;
      
      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const { customerTimelineService } = await import("./services/customerTimelineService");
      
      const timeline = await customerTimelineService.getTimeline(user.tenantId, contactId, {
        cursor: cursor as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 50,
        invoiceId: invoiceId as string | undefined,
        filters: {
          channel: channel ? (channel as string).split(",") as any[] : undefined,
          direction: direction ? (direction as string).split(",") as any[] : undefined,
          outcomesOnly: outcomesOnly === "true",
          needsReviewOnly: needsReviewOnly === "true"
        }
      });

      res.json(timeline);
    } catch (error) {
      console.error("Error fetching customer timeline:", error);
      res.status(500).json({ message: "Failed to fetch customer timeline" });
    }
  });

  app.post("/api/contacts/:contactId/timeline/notes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { body, invoiceId } = req.body;
      
      if (!body || typeof body !== "string" || body.trim().length === 0) {
        return res.status(400).json({ message: "Note body is required" });
      }

      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const { customerTimelineService } = await import("./services/customerTimelineService");
      
      const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
      const note = await customerTimelineService.createNote(
        user.tenantId,
        contactId,
        user.id,
        userName,
        body.trim(),
        invoiceId
      );

      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating timeline note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.post("/api/contacts/:contactId/promise-to-pay", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const { invoiceIds, paymentDate, paymentType, amount, confirmedBy, notes } = req.body;

      // Validate required fields
      if (!paymentDate || typeof paymentDate !== 'string') {
        return res.status(400).json({ message: "Payment date is required" });
      }
      
      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ message: "At least one invoice must be selected" });
      }

      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Parse the payment date (DD/MM/YYYY format)
      let parsedDate: Date;
      if (paymentDate.includes('/')) {
        const parts = paymentDate.split('/');
        parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        parsedDate = new Date(paymentDate);
      }
      
      // Validate parsed date
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid payment date format" });
      }

      // Get the promise reliability service
      const { getPromiseReliabilityService } = await import('./services/promiseReliabilityService.js');
      const promiseService = getPromiseReliabilityService();

      // Create promises for each invoice or a single promise for full payment
      const createdPromises = [];
      
      if (invoiceIds && invoiceIds.length > 0) {
        // Get invoices to calculate amounts - fetch each individually
        for (const invoiceId of invoiceIds) {
          const invoice = await storage.getInvoice(invoiceId, user.tenantId);
          if (!invoice) continue;
          const invoiceBalance = parseFloat(invoice.amountDue?.toString() || invoice.total?.toString() || '0') - parseFloat(invoice.amountPaid?.toString() || '0');
          const promiseAmount = paymentType === 'full' ? invoiceBalance : (amount || 0);
          
          const promise = await promiseService.createPromise({
            tenantId: user.tenantId,
            contactId,
            invoiceId: invoice.id,
            promisedAmount: promiseAmount,
            promisedDate: parsedDate,
            promiseType: paymentType === 'full' ? 'payment_date' : 'partial_payment',
            sourceType: 'manual',
            notes: notes || `Confirmed by: ${confirmedBy || 'Unknown'}`,
            createdByUserId: user.id,
          });
          
          createdPromises.push(promise);
        }
        
        // Update invoice outcome override to 'Plan' for PTP
        for (const invoiceId of invoiceIds) {
          await storage.updateInvoice(invoiceId, user.tenantId, {
            outcomeOverride: 'Plan',
          });
        }
      }

      // Create a timeline note for the PTP
      const { customerTimelineService } = await import("./services/customerTimelineService");
      const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
      
      // Always use the amount from the frontend - that's what the user confirmed
      const totalAmount = amount || 0;
      
      const formattedAmount = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
      }).format(totalAmount);
      
      const formattedDate = parsedDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      await customerTimelineService.createNote(
        user.tenantId,
        contactId,
        user.id,
        userName,
        `Promise to Pay recorded: ${formattedAmount} by ${formattedDate}. Confirmed by: ${confirmedBy || 'Unknown'}${notes ? `. Notes: ${notes}` : ''}`,
        invoiceIds?.[0] || null
      );

      res.status(201).json({ 
        success: true, 
        promisesCreated: createdPromises.length,
        promiseIds: createdPromises.map(p => p.id),
      });
    } catch (error) {
      console.error("Error creating promise to pay:", error);
      res.status(500).json({ message: "Failed to create promise to pay" });
    }
  });

  app.get("/api/contacts/:contactId/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const { customerTimelineService } = await import("./services/customerTimelineService");
      const preferences = await customerTimelineService.getPreferences(user.tenantId, contactId);

      res.json(preferences);
    } catch (error) {
      console.error("Error fetching customer preferences:", error);
      res.status(500).json({ message: "Failed to fetch customer preferences" });
    }
  });

  app.patch("/api/contacts/:contactId/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const updates = req.body;
      
      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const { customerTimelineService } = await import("./services/customerTimelineService");
      const preferences = await customerTimelineService.updatePreferences(user.tenantId, contactId, updates);

      res.json(preferences);
    } catch (error) {
      console.error("Error updating customer preferences:", error);
      res.status(500).json({ message: "Failed to update customer preferences" });
    }
  });

  app.get("/api/contacts/:contactId/debtor-snapshot", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Get contact
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get customer profile for PRS metrics
      const customerProfile = await db.query.customerProfiles.findFirst({
        where: and(
          eq(customerProfiles.contactId, contactId),
          eq(customerProfiles.tenantId, user.tenantId)
        )
      });

      // Get overdue invoices for financial snapshot
      const overdueInvoices = await db.query.invoices.findMany({
        where: and(
          eq(invoices.contactId, contactId),
          eq(invoices.tenantId, user.tenantId),
          eq(invoices.status, 'overdue')
        )
      });

      const totalOutstanding = overdueInvoices.reduce((sum, inv) => 
        sum + parseFloat(inv.amountDue?.toString() || '0'), 0);
      
      const oldestOverdueDays = overdueInvoices.length > 0 
        ? Math.max(...overdueInvoices.map(inv => {
            const dueDate = new Date(inv.dueDate!);
            const now = new Date();
            return Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          }))
        : 0;

      // Get active PTP
      const activePTP = await db.query.paymentPromises.findFirst({
        where: and(
          eq(paymentPromises.contactId, contactId),
          eq(paymentPromises.tenantId, user.tenantId),
          eq(paymentPromises.status, 'open')
        ),
        orderBy: desc(paymentPromises.createdAt)
      });

      // Get communications timeline (last 10)
      const recentActions = await db.query.actions.findMany({
        where: and(
          eq(actions.contactId, contactId),
          eq(actions.tenantId, user.tenantId),
          inArray(actions.type, ['email', 'sms', 'voice', 'note', 'manual_call'])
        ),
        orderBy: desc(actions.createdAt),
        limit: 10
      });

      // Also get notes
      const recentNotes = await db.query.contactNotes.findMany({
        where: and(
          eq(contactNotes.contactId, contactId),
          eq(contactNotes.tenantId, user.tenantId)
        ),
        orderBy: desc(contactNotes.createdAt),
        limit: 10,
        with: {
          createdByUser: true
        }
      });

      // Combine and sort timeline entries with rich metadata
      const timeline = [
        ...recentActions.map(action => {
          const actionMeta = action.metadata as Record<string, any> || {};
          const actionOutcome = action.outcome as Record<string, any> || {};
          const ptpAmount = actionMeta.ptpAmount || actionMeta.promised_amount || actionOutcome.promisedAmount || undefined;
          const ptpDate = actionMeta.ptpDate || actionMeta.promised_payment_date || actionOutcome.promisedDate || undefined;
          const disputeReason = actionMeta.disputeReason || actionMeta.dispute_reason || actionOutcome.disputeReason || undefined;
          const callbackTime = actionMeta.callbackTime || actionMeta.callback_time || actionOutcome.callbackTime || undefined;
          const outcomeType = actionOutcome.outcome || action.status;
          
          const displayDate = action.completedAt || action.scheduledFor || action.createdAt || new Date();
          return {
            id: action.id,
            type: action.type as 'email' | 'sms' | 'voice' | 'note' | 'manual_call',
            direction: action.source === 'inbound' ? 'inbound' as const : 'outbound' as const,
            description: action.subject || action.content?.substring(0, 100) || `${action.type} action`,
            outcome: outcomeType,
            status: action.status,
            createdAt: displayDate instanceof Date ? displayDate.toISOString() : displayDate,
            completedAt: action.completedAt?.toISOString() || undefined,
            createdBy: undefined,
            metadata: {
              ptpAmount: ptpAmount ? parseFloat(ptpAmount.toString()) / 100 : undefined,
              ptpDate: ptpDate,
              disputeReason: disputeReason,
              callbackRequested: actionMeta.callbackRequested || actionMeta.callback_requested || actionOutcome.callback_requested || false,
              callbackTime: callbackTime,
              callDuration: actionMeta.callDuration || actionMeta.call_duration || undefined,
              deliveryStatus: actionMeta.deliveryStatus || undefined,
              opened: actionMeta.opened || false,
              replied: actionMeta.replied || false,
              sentiment: actionOutcome.sentiment || undefined
            }
          };
        }),
        ...recentNotes.map(note => ({
          id: note.id,
          type: 'note' as const,
          direction: 'manual' as const,
          description: note.content,
          outcome: undefined,
          createdAt: note.createdAt?.toISOString() || new Date().toISOString(),
          createdBy: note.createdByUser?.firstName || 'User',
          metadata: {}
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
       .slice(0, 20);

      // Build debtor snapshot
      const debtor = {
        id: contact.id,
        companyName: contact.companyName || contact.name,
        contactName: contact.name,
        email: contact.email,
        phone: contact.phone,
        preferredChannel: customerProfile?.preferredChannel || undefined,
        totalOutstanding,
        invoiceCount: overdueInvoices.length,
        oldestOverdueDays,
        riskScore: customerProfile?.riskScore ? parseFloat(customerProfile.riskScore.toString()) : undefined,
        paymentBehavior: customerProfile?.paymentBehavior || undefined,
        vipFlag: contact.isVip || false,
        activePTP: activePTP ? {
          amount: parseFloat(activePTP.promisedAmount?.toString() || '0'),
          promisedDate: activePTP.promisedDate?.toISOString() || '',
          status: activePTP.status || 'open'
        } : undefined,
        promisesKept: customerProfile?.promisesKept || 0,
        promisesBroken: customerProfile?.promisesBroken || 0
      };

      res.json({ debtor, timeline });
    } catch (error) {
      console.error("Error fetching debtor snapshot:", error);
      res.status(500).json({ message: "Failed to fetch debtor snapshot" });
    }
  });

  app.get("/api/contacts/:contactId/history", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Fetch all outbound actions for this contact
      const outboundActions = await db
        .select()
        .from(actions)
        .where(and(
          eq(actions.contactId, contactId),
          eq(actions.tenantId, user.tenantId),
          inArray(actions.status, ['completed', 'failed', 'in_progress', 'sent'])
        ))
        .orderBy(desc(actions.createdAt))
        .limit(limit);

      // Fetch all inbound messages for this contact
      const inbound = await db
        .select()
        .from(inboundMessages)
        .where(and(
          eq(inboundMessages.contactId, contactId),
          eq(inboundMessages.tenantId, user.tenantId)
        ))
        .orderBy(desc(inboundMessages.createdAt))
        .limit(limit);

      // Fetch SMS messages (both directions)
      const sms = await db
        .select()
        .from(smsMessages)
        .where(and(
          eq(smsMessages.contactId, contactId),
          eq(smsMessages.tenantId, user.tenantId)
        ))
        .orderBy(desc(smsMessages.createdAt))
        .limit(limit);

      // Normalize and merge into unified timeline
      type HistoryEntry = {
        id: string;
        channel: string;
        direction: 'inbound' | 'outbound';
        occurredAt: string;
        status: string;
        outcome?: string;
        subject?: string;
        bodySnippet?: string;
        metadata?: Record<string, any>;
      };

      const history: HistoryEntry[] = [];

      // Add outbound actions
      for (const action of outboundActions) {
        const meta = (action.metadata as Record<string, any>) || {};
        const outcome = (action.outcome as Record<string, any>) || {};
        history.push({
          id: action.id,
          channel: action.actionType || 'email',
          direction: 'outbound',
          occurredAt: (action.completedAt || action.executedAt || action.createdAt)?.toISOString() || new Date().toISOString(),
          status: action.status || 'unknown',
          outcome: outcome.type || outcome.outcome || action.feedbackOutcome || undefined,
          subject: meta.subject || action.subject || undefined,
          bodySnippet: meta.preview || (action.description?.substring(0, 150) + (action.description && action.description.length > 150 ? '...' : '')),
          metadata: {
            invoiceId: action.invoiceId,
            priority: action.priority,
            ptpAmount: outcome.ptpAmount || meta.ptpAmount,
            ptpDate: outcome.ptpDate || meta.ptpDate,
            callDuration: meta.callDuration,
            sentiment: outcome.sentiment
          }
        });
      }

      // Track seen entries to avoid duplicates
      // Use a dedup key based on providerMessageId or channel+direction+timestamp
      const seenKeys = new Set<string>();

      // Add inbound messages from inboundMessages table
      for (const msg of inbound) {
        const dedupKey = msg.providerMessageId || `${msg.channel}-inbound-${msg.from}-${msg.createdAt?.getTime()}`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);
        
        history.push({
          id: msg.id,
          channel: msg.channel || 'email',
          direction: 'inbound',
          occurredAt: msg.createdAt?.toISOString() || new Date().toISOString(),
          status: msg.providerStatus || 'received',
          outcome: msg.intentType || undefined,
          subject: msg.subject || undefined,
          bodySnippet: msg.content?.substring(0, 150) + (msg.content && msg.content.length > 150 ? '...' : ''),
          metadata: {
            from: msg.from,
            intentConfidence: msg.intentConfidence,
            sentiment: msg.sentiment,
            extractedEntities: msg.extractedEntities
          }
        });
      }

      // Add inbound SMS from smsMessages table (only if not already added from inboundMessages)
      for (const msg of sms) {
        // Skip outbound SMS - already in actions
        if (msg.direction === 'outbound') continue;
        
        // Create dedup key matching inboundMessages pattern
        const dedupKey = msg.vonageMessageId || msg.twilioMessageSid || `sms-inbound-${msg.fromNumber}-${msg.createdAt?.getTime()}`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);
        
        history.push({
          id: msg.id,
          channel: 'sms',
          direction: 'inbound',
          occurredAt: (msg.sentAt || msg.createdAt)?.toISOString() || new Date().toISOString(),
          status: msg.status || 'unknown',
          outcome: msg.intent || undefined,
          bodySnippet: msg.body?.substring(0, 150) + (msg.body && msg.body.length > 150 ? '...' : ''),
          metadata: {
            from: msg.fromNumber,
            to: msg.toNumber,
            sentiment: msg.sentiment,
            segments: msg.numSegments
          }
        });
      }

      // Sort by occurredAt descending
      history.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

      // Limit final results
      const trimmedHistory = history.slice(0, limit);

      res.json({ 
        history: trimmedHistory,
        total: history.length,
        contact: {
          id: contact.id,
          name: contact.name,
          companyName: contact.companyName,
          email: contact.email,
          phone: contact.phone
        }
      });
    } catch (error) {
      console.error("Error fetching contact history:", error);
      res.status(500).json({ message: "Failed to fetch contact history" });
    }
  });

  app.get("/api/contacts/:contactId/learning-profile", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get learning profile
      const profile = await db.query.customerLearningProfiles.findFirst({
        where: and(
          eq(customerLearningProfiles.contactId, contactId),
          eq(customerLearningProfiles.tenantId, user.tenantId)
        )
      });

      if (!profile) {
        // Return default neutral profile if none exists
        return res.json({
          contactId,
          emailEffectiveness: "0.50",
          smsEffectiveness: "0.50",
          voiceEffectiveness: "0.50",
          totalInteractions: 0,
          successfulActions: 0,
          learningConfidence: "0.00",
          preferredChannel: null,
          averageResponseTime: null,
          paymentReliability: "0.50",
          averagePaymentDelay: null
        });
      }

      res.json(profile);
    } catch (error) {
      console.error("Error fetching learning profile:", error);
      res.status(500).json({ message: "Failed to fetch learning profile" });
    }
  });

  app.get("/api/contacts/:contactId/payment-stats", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get all paid invoices for this contact
      const allInvoices = await storage.getInvoices(user.tenantId);
      const contactInvoices = allInvoices.filter(inv => 
        inv.contactId === contactId && inv.status === 'paid'
      );

      // Calculate payment stats
      let averageDaysToPay = 0;
      let paymentTimes: number[] = [];
      let paymentReliability = 0;

      if (contactInvoices.length > 0) {
        const totalInvoices = allInvoices.filter(inv => inv.contactId === contactId).length;
        paymentReliability = (contactInvoices.length / totalInvoices) * 100;

        // Calculate days to pay for each invoice
        contactInvoices.forEach(invoice => {
          const dueDate = new Date(invoice.dueDate);
          const paidDate = invoice.paidAt ? new Date(invoice.paidAt) : new Date();
          const daysToPay = Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          paymentTimes.push(daysToPay);
        });

        // Get last 10 payment times for sparkline
        const last10Payments = paymentTimes.slice(-10);
        
        // Calculate average
        averageDaysToPay = Math.round(paymentTimes.reduce((a, b) => a + b, 0) / paymentTimes.length);

        // Calculate trend (compare recent vs historical)
        let trend = 'stable';
        if (last10Payments.length >= 5) {
          const recentAvg = last10Payments.slice(-5).reduce((a, b) => a + b, 0) / 5;
          const olderAvg = last10Payments.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
          
          if (recentAvg < olderAvg - 2) trend = 'improving';
          else if (recentAvg > olderAvg + 2) trend = 'declining';
        }

        res.json({
          averageDaysToPay,
          paymentReliability: Math.round(paymentReliability),
          trend,
          paymentHistory: last10Payments,
          totalInvoices: contactInvoices.length
        });
      } else {
        res.json({
          averageDaysToPay: 0,
          paymentReliability: 0,
          trend: 'stable',
          paymentHistory: [],
          totalInvoices: 0
        });
      }
    } catch (error) {
      console.error("Error fetching payment stats:", error);
      res.status(500).json({ message: "Failed to fetch payment stats" });
    }
  });

  app.get("/api/contacts/:contactId/actions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get all actions for this contact
      const contactActions = await db
        .select()
        .from(actions)
        .where(and(
          eq(actions.contactId, contactId),
          eq(actions.tenantId, user.tenantId)
        ))
        .orderBy(desc(actions.createdAt))
        .limit(50);

      res.json(contactActions);
    } catch (error) {
      console.error("Error fetching contact actions:", error);
      res.status(500).json({ message: "Failed to fetch contact actions" });
    }
  });

  app.get("/api/contacts/:contactId/rating", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get all invoices and actions for this contact
      const allInvoices = await storage.getInvoices(user.tenantId);
      const contactInvoices = allInvoices.filter(inv => inv.contactId === contactId);
      const contactActions = await db
        .select()
        .from(actions)
        .where(and(
          eq(actions.contactId, contactId),
          eq(actions.tenantId, user.tenantId)
        ));

      // Initialize scores
      let daysToPayScore = 0;
      let paymentReliabilityScore = 0;
      let responseRateScore = 0;
      let disputeScore = 100; // Start at perfect, deduct for disputes

      // 1. Calculate Days to Pay Score (35%) - Lower is better
      const paidInvoices = contactInvoices.filter(inv => inv.status === 'paid');
      if (paidInvoices.length > 0) {
        const daysToPays = paidInvoices.map(invoice => {
          const dueDate = new Date(invoice.dueDate);
          const paidDate = invoice.paidAt ? new Date(invoice.paidAt) : new Date();
          return Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        });
        
        const avgDaysToPay = daysToPays.reduce((a, b) => a + b, 0) / daysToPays.length;
        
        // Score: 100 if paid early/on-time, decreasing for late payments
        if (avgDaysToPay <= 0) daysToPayScore = 100;
        else if (avgDaysToPay <= 7) daysToPayScore = 85;
        else if (avgDaysToPay <= 14) daysToPayScore = 70;
        else if (avgDaysToPay <= 30) daysToPayScore = 50;
        else if (avgDaysToPay <= 60) daysToPayScore = 25;
        else daysToPayScore = 0;
      } else if (contactInvoices.length === 0) {
        daysToPayScore = 50; // Neutral for new customers
      }

      // 2. Calculate Payment Reliability Score (30%) - Paid vs Total
      if (contactInvoices.length > 0) {
        paymentReliabilityScore = (paidInvoices.length / contactInvoices.length) * 100;
      } else {
        paymentReliabilityScore = 50; // Neutral for new customers
      }

      // 3. Calculate Response Rate Score (20%)
      const communicationActions = contactActions.filter(a => 
        ['email_sent', 'sms_sent', 'voice_call'].includes(a.type)
      );
      const responseActions = contactActions.filter(a => 
        ['email_opened', 'sms_replied', 'call_answered', 'payment_promise'].includes(a.type)
      );
      
      if (communicationActions.length > 0) {
        responseRateScore = (responseActions.length / communicationActions.length) * 100;
      } else {
        responseRateScore = 50; // Neutral if no communications yet
      }

      // 4. Calculate Dispute Score (15%) - Deduct for disputes
      const disputes = contactActions.filter(a => a.type === 'dispute' || a.type === 'complaint');
      const disputesPerInvoice = contactInvoices.length > 0 ? disputes.length / contactInvoices.length : 0;
      
      if (disputesPerInvoice === 0) disputeScore = 100;
      else if (disputesPerInvoice < 0.1) disputeScore = 75;
      else if (disputesPerInvoice < 0.25) disputeScore = 50;
      else if (disputesPerInvoice < 0.5) disputeScore = 25;
      else disputeScore = 0;

      // Calculate weighted total
      const totalScore = 
        (daysToPayScore * 0.35) +
        (paymentReliabilityScore * 0.30) +
        (responseRateScore * 0.20) +
        (disputeScore * 0.15);

      // Determine rating
      let rating: 'Good' | 'Average' | 'Poor';
      let color: 'green' | 'amber' | 'red';
      
      if (totalScore >= 70) {
        rating = 'Good';
        color = 'green';
      } else if (totalScore >= 40) {
        rating = 'Average';
        color = 'amber';
      } else {
        rating = 'Poor';
        color = 'red';
      }

      res.json({
        rating,
        color,
        score: Math.round(totalScore),
        breakdown: {
          daysToPayScore: Math.round(daysToPayScore),
          paymentReliabilityScore: Math.round(paymentReliabilityScore),
          responseRateScore: Math.round(responseRateScore),
          disputeScore: Math.round(disputeScore)
        }
      });
    } catch (error) {
      console.error("Error calculating customer rating:", error);
      res.status(500).json({ message: "Failed to calculate customer rating" });
    }
  });

  app.patch("/api/contacts/:id/workflow", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id: contactId } = req.params;
      const { workflowId } = req.body;

      // Validate request body
      if (!workflowId || typeof workflowId !== 'string') {
        return res.status(400).json({ message: "Invalid workflowId" });
      }

      // Validate contact exists and belongs to tenant
      const tenantContacts = await storage.getContacts(user.tenantId);
      const contact = tenantContacts.find(c => c.id === contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Validate workflow exists and belongs to same tenant
      const [workflow] = await db.select()
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .limit(1);

      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      if (workflow.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "Workflow does not belong to your organization" });
      }

      // Update contact's workflow assignment with tenant scoping
      await db.update(contacts)
        .set({ workflowId, updatedAt: new Date() })
        .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, user.tenantId)));

      // Fetch updated contact with tenant scoping
      const [updatedContact] = await db.select()
        .from(contacts)
        .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, user.tenantId)))
        .limit(1);

      res.json({
        success: true,
        contact: updatedContact
      });
    } catch (error: any) {
      console.error("Error updating contact workflow:", error);
      res.status(500).json({ message: "Failed to update contact workflow", error: error.message });
    }
  });

  app.post("/api/contacts/:contactId/send-summary-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      if (!await hasContactAccess(user, contactId)) {
        return res.status(403).json({ message: "You do not have access to this contact" });
      }
      
      // Get contact details
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (!contact.email) {
        return res.status(400).json({ message: "No email address found for this contact" });
      }

      // Get all invoices for this contact that are due/overdue
      const allInvoices = await storage.getInvoices(user.tenantId);
      const contactInvoices = allInvoices.filter(inv => 
        inv.contactId === contactId && 
        (inv.status === 'pending' || inv.status === 'overdue') &&
        Number(inv.amount) > (Number(inv.amountPaid) || 0)
      );

      if (contactInvoices.length === 0) {
        return res.status(400).json({ message: "No outstanding invoices found for this contact" });
      }

      // Get default email template and sender
      const templates = await storage.getCommunicationTemplates(user.tenantId);
      const defaultTemplate = templates.find(t => t.name === "GE Client");
      const defaultSender = await storage.getDefaultEmailSender(user.tenantId);

      if (!defaultTemplate || !defaultSender) {
        return res.status(500).json({ message: "GE Client template or sender not configured. Please create a 'GE Client' template in Collections Workflow." });
      }

      // Calculate totals and create invoice summary
      const totalAmount = contactInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const today = new Date();
      
      const overdueInvoices = contactInvoices.filter(inv => new Date(inv.dueDate) < today);
      const currentInvoices = contactInvoices.filter(inv => new Date(inv.dueDate) >= today);
      const totalAmountOverdue = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

      // Create detailed invoice list for template variable
      let invoiceDetails = '';
      if (overdueInvoices.length > 0) {
        invoiceDetails += '<strong>Overdue Invoices:</strong><br>';
        overdueInvoices.forEach(inv => {
          const daysOverdue = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          invoiceDetails += `• Invoice ${inv.invoiceNumber}: £${Number(inv.amount).toLocaleString()} (${daysOverdue} days overdue)<br>`;
        });
      }
      
      if (currentInvoices.length > 0) {
        if (invoiceDetails) invoiceDetails += '<br>'; // Add spacing if we have overdue invoices
        invoiceDetails += '<strong>Current Due:</strong><br>';
        currentInvoices.forEach(inv => {
          invoiceDetails += `• Invoice ${inv.invoiceNumber}: £${Number(inv.amount).toLocaleString()} (due ${formatDate(inv.dueDate)})<br>`;
        });
      }

      // Process template variables for summary
      let processedContent = defaultTemplate.content
        .replace(/\{\{first_name\}\}/g, contact.name?.split(' ')[0] || 'Valued Customer')
        .replace(/\{\{your_name\}\}/g, defaultSender.fromName || defaultSender.name || 'Accounts Receivable')
        .replace(/\{\{total_amount\}\}/g, `£${totalAmount.toLocaleString()}`)
        .replace(/\{\{total_balance\}\}/g, `£${totalAmount.toLocaleString()}`)
        .replace(/\{\{total_amount_overdue\}\}/g, `£${totalAmountOverdue.toLocaleString()}`)
        .replace(/\{\{invoice_count\}\}/g, contactInvoices.length.toString())
        .replace(/\{\{invoice_details\}\}/g, invoiceDetails)
        .replace(/£X as unpaid/g, `£${totalAmount.toLocaleString()} across ${contactInvoices.length} invoice${contactInvoices.length > 1 ? 's' : ''}`)
        .replace(/£X due for payment now/g, `£${totalAmount.toLocaleString()} total outstanding`);

      // Process template subject line with variables
      let processedSubject = defaultTemplate.subject || 'Account Summary';
      processedSubject = processedSubject
        .replace(/\{\{first_name\}\}/g, contact.name?.split(' ')[0] || 'Valued Customer')
        .replace(/\{\{your_name\}\}/g, defaultSender.fromName || defaultSender.name || 'Accounts Receivable')
        .replace(/\{\{total_amount\}\}/g, `£${totalAmount.toLocaleString()}`)
        .replace(/\{\{total_balance\}\}/g, `£${totalAmount.toLocaleString()}`)
        .replace(/\{\{total_amount_overdue\}\}/g, `£${totalAmountOverdue.toLocaleString()}`)
        .replace(/\{\{invoice_count\}\}/g, contactInvoices.length.toString());

      // Send email using SendGrid with properly formatted sender from Collection Workflow
      const { sendEmail } = await import("./services/sendgrid");
      const senderEmail = defaultSender.email;
      const senderName = defaultSender.fromName || defaultSender.name || 'Accounts Receivable';
      
      if (!senderEmail) {
        return res.status(500).json({ message: "Sender email not configured in Collection Workflow" });
      }
      
      const formattedSender = `${senderName} <${senderEmail}>`;
      
      const emailSent = await sendEmail({
        to: contact.email,
        from: formattedSender,
        subject: processedSubject,
        html: processedContent.replace(/\n/g, '<br>'),
        tenantId: user.tenantId,
      });

      if (emailSent) {
        console.log(`✅ Summary email sent to ${contact.name} (${contact.email}) for ${contactInvoices.length} invoices`);
        res.json({ 
          success: true, 
          message: `Account summary sent to ${contact.name}` 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to send email" 
        });
      }
    } catch (error) {
      console.error("Error sending customer summary email:", error);
      res.status(500).json({ 
        success: false, 
        message: (error as Error).message || "Failed to send email" 
      });
    }
  });
}
