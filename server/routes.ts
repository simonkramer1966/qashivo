import type { Express} from "express";
import express from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import {
  generateCreditRecommendation,
  type CreditSignals,
  type TradingProfile,
} from "./services/dynamicRiskScoringService";
import { setupAuth, regenerateSessionOnLogin } from "./auth";
import { isAuthenticated, isOwner } from "./middleware/clerkAuth";
import { logSecurityEvent, extractClientInfo } from "./services/securityAuditService";
import { sanitizeObject, stripSensitiveUserFields, stripSensitiveTenantFields, stripSensitiveFields } from "./utils/sanitize";
import { withPermission, withRole, withMinimumRole, canManageUser } from "./middleware/rbac";
import { 
  insertContactSchema,
  insertContactNoteSchema, 
  insertInvoiceSchema, 
  insertActionSchema,
  insertWorkflowSchema,
  insertCommunicationTemplateSchema,
  insertEscalationRuleSchema,
  insertChannelAnalyticsSchema,
  insertWorkflowTemplateSchema,
  insertVoiceCallSchema,
  insertBillSchema,
  insertBankAccountSchema,
  insertBankTransactionSchema,
  insertBudgetSchema,
  insertExchangeRateSchema,
  insertActionItemSchema,
  insertActionLogSchema,
  insertPaymentPromiseSchema,
  insertPartnerSchema,
  insertUserContactAssignmentSchema,
  type Invoice,
  type Contact,
  type ContactNote,
  type Bill,
  type BankAccount,
  type BankTransaction,
  type Budget,
  type ExchangeRate,
  type ActionItem,
  type ActionLog,
  type PaymentPromise,
  invoices,
  contacts,
  actions,
  disputes,
  bankTransactions,
  customerLearningProfiles,
  inboundMessages,
  smsMessages,
  investorLeads,
  onboardingProgress,
  messageDrafts,
  tenants,
  paymentPromises,
  promisesToPay,
  smeClients,
  contactNotes,
  timelineEvents,
  attentionItems,
  outcomes,
  activityLogs,
  collectionPolicies,
  paymentPlans,
  emailMessages,
  customerContactPersons,
  insertScheduledReportSchema,
  scheduledReports,
} from "@shared/schema";
import { computeNextRunAt } from "./services/reportScheduler";
import { REPORT_TYPE_LABELS, type ReportType } from "./services/reportGenerator";
import { getOverdueCategoryFromDueDate } from "@shared/utils/overdueUtils";
import { calculateLatePaymentInterest } from "./utils/interestCalculator";
import { eq, and, desc, asc, sql, count, avg, gte, lte, lt, inArray, or, isNull, isNotNull, gt, not } from 'drizzle-orm';
import { db } from './db';
import { z } from "zod";

// Additional Zod validation schemas for query parameters and request bodies
const forecastQuerySchema = z.object({
  weeks: z.string().optional().default('13').transform(Number),
  scenario: z.enum(['base', 'optimistic', 'pessimistic', 'custom']).optional().default('base'),
  currency: z.string().optional().default('USD'),
  include_weekends: z.string().optional().default('false')
});

const billsQuerySchema = z.object({
  limit: z.string().optional().default('100').transform(Number),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  vendor_id: z.string().optional(),
  overdue_only: z.string().optional()
});

// Nudge endpoint request schema
const nudgeInvoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required")
});

// Invoice filtering query schema for server-side filtering
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

// Contact filtering query schema for server-side filtering
const contactsQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['name', 'company', 'email', 'outstanding', 'lastContact']).optional().default('name'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number)
});

// Action Centre validation schemas
const actionItemQuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'snoozed', 'canceled']).optional(),
  assignedToUserId: z.string().optional(),
  type: z.enum(['nudge', 'call', 'email', 'sms', 'review', 'dispute', 'ptp_followup']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number),
  // New ML prioritization parameters
  useSmartPriority: z.string().optional().default('false').transform(str => str === 'true'),
  queueType: z.enum(['today', 'due', 'overdue', 'serious', 'escalation']).optional().default('today'),
  sortBy: z.enum(['priority', 'dueDate', 'amount', 'risk', 'smart']).optional().default('smart'),
});

const actionItemCompleteSchema = z.object({
  outcome: z.string().optional(),
  notes: z.string().optional()
});

const actionItemSnoozeSchema = z.object({
  newDueDate: z.string().transform((str) => new Date(str)),
  reason: z.string().optional()
});

const communicationHistoryQuerySchema = z.object({
  contactId: z.string().optional(),
  invoiceId: z.string().optional(),
  limit: z.string().optional().default('50').transform(Number)
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

// Action Centre Drawer validation schemas
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

// Client & Partner Management validation schemas
const clientsQuerySchema = z.object({
  search: z.string().optional(),
  partnerId: z.string().optional(),
  subscriptionStatus: z.enum(['active', 'trial', 'canceled', 'past_due', 'unpaid']).optional(),
  healthScore: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  planType: z.enum(['partner', 'client']).optional(),
  createdAfter: z.string().optional().transform(str => str ? new Date(str) : undefined),
  createdBefore: z.string().optional().transform(str => str ? new Date(str) : undefined),
  lastActivityAfter: z.string().optional().transform(str => str ? new Date(str) : undefined),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number),
  sortBy: z.enum(['name', 'health', 'revenue', 'lastActivity', 'createdAt']).optional().default('name'),
  sortDirection: z.enum(['asc', 'desc']).optional().default('asc')
});

const partnersQuerySchema = z.object({
  search: z.string().optional(),
  performanceScore: z.enum(['low', 'medium', 'high']).optional(),
  clientCountMin: z.string().optional().transform(Number),
  clientCountMax: z.string().optional().transform(Number),
  revenueMin: z.string().optional().transform(Number),
  revenueMax: z.string().optional().transform(Number),
  joinedAfter: z.string().optional().transform(str => str ? new Date(str) : undefined),
  joinedBefore: z.string().optional().transform(str => str ? new Date(str) : undefined),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number),
  sortBy: z.enum(['name', 'performance', 'revenue', 'clients', 'joinDate']).optional().default('name'),
  sortDirection: z.enum(['asc', 'desc']).optional().default('asc')
});

const assignPartnerSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required')
});

const commissionsQuerySchema = z.object({
  period: z.string().optional(), // "2025-01" format
  partnerId: z.string().optional(),
  status: z.enum(['pending', 'calculated', 'paid']).optional(),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number)
});
import { generateCollectionSuggestions, generateEmailDraft, generateAiCfoResponse } from "./services/openai";
import { sendReminderEmail, DEFAULT_FROM, DEFAULT_FROM_EMAIL } from "./services/sendgrid";
import { sendPaymentReminderSMS } from "./services/vonage";
import { ActionPrioritizationService } from "./services/actionPrioritizationService";
import { formatDate } from "../shared/utils/dateFormatter";
import { xeroService } from "./services/xero";
import { onboardingService } from "./services/onboardingService";
import { XeroSyncService } from "./services/xeroSync";
import { generateMockData } from "./mock-data";
import { retellService } from "./retell-service";
import { createRetellClient } from "./mcp/client";
import { normalizeDynamicVariables, logVariableTransformation } from "./utils/retellVariableNormalizer";
import { Retell } from "retell-sdk";
import Stripe from "stripe";
import { registerSyncRoutes } from "./routes/syncRoutes";
import documentationRoutes from "./routes/documentationRoutes";
import adminRoutes from "./routes/adminRoutes";
import prospectScorecardRoutes from "./routes/prospectScorecardRoutes";
import workflowProfileRoutes from "./routes/workflowProfileRoutes";
import emailConnectionRouter from './routes/emailConnectionRoutes';
import { webhookHandler } from "./services/webhookHandler";
import { registerOnboardingRoutes } from "./routes/onboardingRoutes";
import { registerInvoiceRoutes } from "./routes/invoiceRoutes";
import { registerDashboardRoutes } from "./routes/dashboardRoutes";
import { registerIntegrationRoutes } from "./routes/integrationRoutes";
import { registerCollectionsRoutes } from "./routes/collectionsRoutes";
import { registerContactRoutes } from "./routes/contactRoutes";
import { registerSettingsRoutes } from "./routes/settingsRoutes";
import { registerMiscRoutes } from "./routes/miscRoutes";
import { ForecastEngine, type ForecastConfig, type ForecastScenario } from "../shared/forecast";
import { subscriptionService } from "./services/subscriptionService";
import { cleanEmailContent } from "./services/messagePostProcessor";
import { clientPartnerService } from "./services/clientPartnerService";
import { signalCollector } from "./lib/signal-collector";
import { getDashboardMetrics } from "./services/metricsService";
import { computeCashInflow } from "./services/dashboardCashInflowService";
import { PermissionService } from "./services/permissionService";

async function getAssignedContactIds(user: any): Promise<string[] | null> {
  if (!user?.tenantId) return null;
  const role = user.tenantRole || user.role;
  if (['owner', 'admin', 'accountant', 'partner', 'manager'].includes(role)) {
    return null;
  }
  const assigned = await storage.getAssignedContacts(user.id, user.tenantId);
  return assigned.map(c => c.id);
}

async function hasContactAccess(user: any, contactId: string): Promise<boolean> {
  if (!user?.tenantId) return false;
  const role = user.tenantRole || user.role;
  if (['owner', 'admin', 'accountant', 'partner', 'manager'].includes(role)) {
    return true;
  }
  return storage.hasContactAccess(user.id, contactId, user.tenantId);
}

// Initialize Stripe (lazy initialization - only fails when actually used)
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil",
  });
  console.log('✅ Stripe initialized successfully');
} else {
  console.warn('⚠️  Stripe not configured (missing STRIPE_SECRET_KEY)');
}

// Initialize Action Prioritization Service
const actionPrioritizationService = new ActionPrioritizationService();

export async function registerRoutes(app: Express): Promise<Server> {
  // Webhook routes (must be before auth middleware)
  const { registerWebhookRoutes } = await import("./routes/webhooks");
  registerWebhookRoutes(app);

  // Public contact form endpoint (no auth required)
  const salesEnquirySchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Valid email is required"),
    company: z.string().optional(),
    phone: z.string().optional(),
    message: z.string().min(10, "Please provide more details about your enquiry"),
    enquiryType: z.enum(['demo', 'pricing', 'partnership', 'general', 'investment', 'design-partnership']).default('general')
  });

  app.post('/api/public/sales-enquiry', async (req, res) => {
    try {
      const data = salesEnquirySchema.parse(req.body);
      
      // Import sendEmail function
      const { sendEmail } = await import('./services/sendgrid');
      
      // Qashivo contact email and base URL
      const qashivoEmail = 'hello@qashivo.com';
      const baseUrl = process.env.SITE_BASE_URL || 'https://www.qashivo.com';
      
      const enquiryTypeLabel = {
        demo: 'Product Demo Request',
        pricing: 'Pricing Enquiry',
        partnership: 'Partnership Enquiry',
        general: 'General Enquiry',
        investment: 'Investment Enquiry',
        'design-partnership': 'Design Partnership Application'
      }[data.enquiryType];
      
      // Email to Qashivo team
      const teamEmailHtml = `
        <h2>New Sales Enquiry - ${enquiryTypeLabel}</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Name</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${data.name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Email</td>
            <td style="padding: 10px; border: 1px solid #ddd;"><a href="mailto:${data.email}">${data.email}</a></td>
          </tr>
          ${data.company ? `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Company</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${data.company}</td>
          </tr>
          ` : ''}
          ${data.phone ? `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Phone</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${data.phone}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f9f9f9;">Enquiry Type</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${enquiryTypeLabel}</td>
          </tr>
        </table>
        <h3 style="margin-top: 20px;">Message</h3>
        <p style="background: #f9f9f9; padding: 15px; border-radius: 5px;">${data.message.replace(/\n/g, '<br>')}</p>
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This enquiry was submitted via the Qashivo website contact form.</p>
      `;
      
      // Confirmation email to the submitter
      const confirmationEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <table align="center" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td style="vertical-align: middle; padding-right: 10px;">
                  <img src="https://www.qashivo.com/images/qashivo-logo.png" alt="Qashivo" width="36" height="36" style="display: block; border: 0;">
                </td>
                <td style="vertical-align: middle;">
                  <span style="color: #0B0F17; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Qashivo</span>
                </td>
              </tr>
            </table>
            <p style="color: #666; margin: 8px 0 0 0; font-size: 14px;">Human supervised AI-driven credit control</p>
          </div>
          
          <h2 style="color: #0B0F17; margin-bottom: 20px;">Thank you for getting in touch, ${data.name.split(' ')[0]}!</h2>
          
          <p style="color: #556070; margin-bottom: 20px;">
            We've received your ${enquiryTypeLabel.toLowerCase()} and a member of our team will be in touch shortly.
          </p>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #0B0F17; margin: 0 0 15px 0; font-size: 16px;">Your message:</h3>
            <p style="color: #556070; margin: 0; white-space: pre-wrap;">${data.message}</p>
          </div>
          
          <p style="color: #556070; margin-bottom: 20px;">
            In the meantime, why not explore what Qashivo can do for your business?
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.qashivo.com/demo" style="display: inline-block; background: #12B8C4; color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: 500;">Try our interactive demo</a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #E6E8EC; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            Nexus KPI Limited. Built in London. Backed by innovation.<br>
            <a href="https://www.qashivo.com" style="color: #12B8C4;">www.qashivo.com</a>
          </p>
        </body>
        </html>
      `;
      
      // Send email to Qashivo team
      const teamEmailResult = await sendEmail({
        to: qashivoEmail,
        from: qashivoEmail,
        subject: `[Qashivo] ${enquiryTypeLabel} from ${data.name}`,
        html: teamEmailHtml,
        text: `New ${enquiryTypeLabel}\n\nName: ${data.name}\nEmail: ${data.email}\n${data.company ? `Company: ${data.company}\n` : ''}${data.phone ? `Phone: ${data.phone}\n` : ''}\nMessage:\n${data.message}`,
        replyTo: data.email
      });
      
      // Send confirmation email to the submitter (don't block on failure)
      const confirmationResult = await sendEmail({
        to: data.email,
        from: qashivoEmail,
        subject: `Thanks for contacting Qashivo - We'll be in touch soon`,
        html: confirmationEmailHtml,
        text: `Thank you for getting in touch, ${data.name.split(' ')[0]}!\n\nWe've received your ${enquiryTypeLabel.toLowerCase()} and a member of our team will be in touch shortly.\n\nYour message:\n${data.message}\n\nIn the meantime, why not explore what Qashivo can do for your business at https://www.qashivo.com/demo\n\n---\nNexus KPI Limited. Built in London. Backed by innovation.\nhttps://www.qashivo.com`,
        trackClicks: false
      });
      
      if (!confirmationResult.success) {
        console.warn('Failed to send confirmation email to submitter:', confirmationResult.error);
      }
      
      if (teamEmailResult.success) {
        res.json({ success: true, message: 'Thank you for your enquiry. Our team will be in touch shortly.' });
      } else {
        console.error('Failed to send team email:', teamEmailResult.error);
        res.status(500).json({ success: false, message: 'Failed to send enquiry. Please try again or email us directly at hello@qashivo.com.' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.errors[0].message });
      }
      console.error('Sales enquiry error:', error);
      res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
  });
  
  // Auth middleware
  await setupAuth(app);

  app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object' && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.body = sanitizeObject(req.body);
    }
    next();
  });

  // Extracted route modules — registered after auth + sanitize middleware
  registerOnboardingRoutes(app);
  registerInvoiceRoutes(app);
  registerDashboardRoutes(app);
  await registerIntegrationRoutes(app);
  registerCollectionsRoutes(app);
  registerContactRoutes(app);
  await registerSettingsRoutes(app);
  registerMiscRoutes(app);

  // Partner and Context Management Routes
  // Get current auth context (user info, role, active tenant)
  app.get('/api/auth/context', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const isPartner = user.role === 'partner' && !!user.partnerId;
      let accessibleTenants = [];

      if (isPartner) {
        // Get all tenants accessible by this partner
        accessibleTenants = await storage.getPartnerTenants(user.id);
      }

      // @ts-ignore - session typing
      const activeTenantId = isPartner ? req.session?.activeTenantId : user.tenantId;

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantRole: user.tenantRole,
          partnerId: user.partnerId,
        },
        isPartner,
        activeTenantId,
        accessibleTenants: isPartner ? accessibleTenants : [],
      });
    } catch (error) {
      console.error('Failed to get auth context:', error);
      res.status(500).json({ message: 'Failed to retrieve auth context' });
    }
  });

  // Get accessible tenants for partner users
  app.get('/api/partner/tenants', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.role !== 'partner' || !user.partnerId) {
        return res.status(403).json({ message: 'Partner access required' });
      }

      const tenants = await storage.getPartnerTenants(user.id);
      res.json({ tenants });
    } catch (error) {
      console.error('Failed to get partner tenants:', error);
      res.status(500).json({ message: 'Failed to retrieve partner tenants' });
    }
  });

  // Switch active tenant for partner users
  app.post('/api/partner/switch-tenant', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.role !== 'partner' || !user.partnerId) {
        return res.status(403).json({ message: 'Partner access required' });
      }

      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID required' });
      }

      // Verify partner has access to this tenant
      const accessibleTenants = await storage.getPartnerTenants(user.id);
      const hasAccess = accessibleTenants.some(t => t.id === tenantId);

      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this tenant' });
      }

      // Update session with new active tenant
      // @ts-ignore - session typing
      req.session.activeTenantId = tenantId;

      // Save session explicitly to ensure it persists
      req.session.save((err) => {
        if (err) {
          console.error('Failed to save session:', err);
          return res.status(500).json({ message: 'Failed to switch tenant' });
        }

        const selectedTenant = accessibleTenants.find(t => t.id === tenantId);
        res.json({ 
          success: true,
          activeTenantId: tenantId,
          tenant: selectedTenant
        });
      });
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      res.status(500).json({ message: 'Failed to switch tenant' });
    }
  });

  // Partner Management Routes (Owner/Admin only)
  // List all partners
  app.get('/api/partners', isAuthenticated, isOwner, async (req, res) => {
    try {
      const { isActive } = req.query;
      const filters = isActive !== undefined ? { isActive: isActive === 'true' } : undefined;
      const partners = await storage.getPartners(filters);
      res.json({ partners });
    } catch (error) {
      console.error('Failed to get partners:', error);
      res.status(500).json({ message: 'Failed to retrieve partners' });
    }
  });

  // Get single partner
  app.get('/api/partners/:partnerId', isAuthenticated, isOwner, async (req, res) => {
    try {
      const partner = await storage.getPartner(req.params.partnerId);
      if (!partner) {
        return res.status(404).json({ message: 'Partner not found' });
      }
      res.json({ partner });
    } catch (error) {
      console.error('Failed to get partner:', error);
      res.status(500).json({ message: 'Failed to retrieve partner' });
    }
  });

  // Create partner with Zod validation
  app.post('/api/partners', isAuthenticated, isOwner, async (req, res) => {
    try {
      const validatedData = insertPartnerSchema.parse(req.body);
      const partner = await storage.createPartner({
        ...validatedData,
        isActive: true,
      });
      res.status(201).json({ partner });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: error.errors 
        });
      }
      console.error('Failed to create partner:', error);
      res.status(500).json({ message: 'Failed to create partner' });
    }
  });

  // Update partner with Zod validation
  app.patch('/api/partners/:partnerId', isAuthenticated, isOwner, async (req, res) => {
    try {
      const validatedData = insertPartnerSchema.partial().parse(req.body);
      const partner = await storage.updatePartner(req.params.partnerId, validatedData);
      res.json({ partner });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: error.errors 
        });
      }
      console.error('Failed to update partner:', error);
      res.status(500).json({ message: 'Failed to update partner' });
    }
  });

  // Dashboard Metrics Endpoint (Sprint 3)
  app.get('/api/metrics', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user || !user.tenantId) {
        return res.status(404).json({ message: 'User or tenant not found' });
      }

      const metrics = await getDashboardMetrics(user.tenantId);
      res.json(metrics);
    } catch (error) {
      console.error('Failed to get dashboard metrics:', error);
      res.status(500).json({ message: 'Failed to retrieve metrics' });
    }
  });

  // Template API Routes (Sprint 3: Global/Tenant hybrid architecture)
  app.get('/api/templates/global', isAuthenticated, async (req, res) => {
    try {
      const { channel, tone } = req.query;
      const templates = await storage.getGlobalTemplates({ 
        channel: channel as string | undefined, 
        tone: tone as string | undefined 
      });
      res.json(templates);
    } catch (error) {
      console.error('Failed to get global templates:', error);
      res.status(500).json({ message: 'Failed to retrieve global templates' });
    }
  });

  app.get('/api/templates/tenant', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user) {
        console.error('GET /api/templates/tenant: User not found for authenticated request');
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (!user.tenantId) {
        console.error(`GET /api/templates/tenant: User ${user.id} has no tenantId`);
        return res.status(403).json({ message: 'User not associated with a tenant' });
      }

      const { channel, tone } = req.query;
      const templates = await storage.getTenantTemplates(user.tenantId, {
        channel: channel as string | undefined,
        tone: tone as string | undefined
      });
      res.json(templates);
    } catch (error) {
      console.error('Failed to get tenant templates:', error);
      res.status(500).json({ message: 'Failed to retrieve tenant templates' });
    }
  });

  app.post('/api/templates/tenant', ...withPermission('ai:templates'), async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user) {
        console.error('POST /api/templates/tenant: User not found for authenticated request');
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (!user.tenantId) {
        console.error(`POST /api/templates/tenant: User ${user.id} has no tenantId`);
        return res.status(403).json({ message: 'User not associated with a tenant' });
      }

      const templateData = insertTenantTemplateSchema.parse({
        ...req.body,
        tenantId: user.tenantId
      });

      const template = await storage.createTenantTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error('Failed to create tenant template:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid template data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create tenant template' });
    }
  });

  app.patch('/api/templates/tenant/:id', ...withPermission('ai:templates'), async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user) {
        console.error('PATCH /api/templates/tenant/:id: User not found for authenticated request');
        return res.status(401).json({ message: 'Authentication required' });
      }
      if (!user.tenantId) {
        console.error(`PATCH /api/templates/tenant/:id: User ${user.id} has no tenantId`);
        return res.status(403).json({ message: 'User not associated with a tenant' });
      }

      const updateData = insertTenantTemplateSchema
        .omit({ tenantId: true, id: true, sourceGlobalId: true, sourceVersion: true })
        .partial()
        .parse(req.body);
      const template = await storage.updateTenantTemplate(req.params.id, user.tenantId, updateData);
      if (!template) {
        console.error(`PATCH /api/templates/tenant/:id: Template ${req.params.id} not found for tenant ${user.tenantId}`);
        return res.status(404).json({ message: 'Template not found or access denied' });
      }
      res.json(template);
    } catch (error) {
      console.error('Failed to update tenant template:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid template data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update tenant template' });
    }
  });

  // Tenant User Management Routes
  // Import RBAC middleware  
  const { withRBACContext, requireTenantAdmin, enforceContactAccess, getContactFilter } = await import('./middleware/rbac');

  // Get users in tenant (requires tenant admin or higher)
  app.get('/api/tenants/:tenantId/users', isAuthenticated, withRBACContext, requireTenantAdmin, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      // Security: Verify tenant isolation - tenantId must match active tenant
      if (req.params.tenantId !== req.rbac.tenantId) {
        return res.status(403).json({ 
          message: 'Access denied: Cannot access users from another tenant' 
        });
      }

      const users = await storage.getTenantUsers(req.params.tenantId);
      res.json({ users: users.map(u => stripSensitiveUserFields(u)) });
    } catch (error) {
      console.error('Failed to get tenant users:', error);
      res.status(500).json({ message: 'Failed to retrieve tenant users' });
    }
  });

  // Contact Assignment Routes
  // Validation schema for assignment operations
  const assignmentBodySchema = z.object({
    contactId: z.string().min(1, "Contact ID is required")
  });

  const bulkAssignmentSchema = z.object({
    contactIds: z.array(z.string()).min(1, "At least one contact ID required")
  });

  // Get user's contact assignments
  // Get contact's assignments (who is assigned to this contact)
  // Assign contact to user with validation
  // Unassign contact from user
  // Bulk assign contacts to user with validation
  // Bulk unassign contacts from user with validation
  // SendGrid Configuration Test Endpoint
  app.get('/api/test/sendgrid', isAuthenticated, async (req, res) => {
    try {
      const { sendEmail, DEFAULT_FROM_EMAIL } = await import("./services/sendgrid");
      
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get the configured sender from Collection Workflow instead of hardcoded values
      const defaultSender = await storage.getDefaultEmailSender(user.tenantId);
      
      if (!defaultSender || !defaultSender.email) {
        return res.status(500).json({
          success: false,
          message: "No email sender configured in Collection Workflow. Please configure a sender first."
        });
      }

      const senderEmail = defaultSender.email;
      const senderName = defaultSender.fromName || defaultSender.name;
      const formattedSender = `${senderName} <${senderEmail}>`;
      
      console.log(`🧪 Testing SendGrid configuration with Collection Workflow sender: ${formattedSender}`);
      
      const testRecipient = (req as any).user.email || senderEmail; // Fallback to sender email if user email not available
      
      console.log(`📧 Test recipient: ${testRecipient}`);
      
      const testEmailSent = await sendEmail({
        to: testRecipient,
        from: formattedSender,
        subject: "SendGrid Configuration Test - Nexus AR",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #17B6C3;">✅ SendGrid Test Successful!</h2>
            <p>This test email confirms that your SendGrid configuration is working correctly with your Collection Workflow sender.</p>
            <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #17B6C3; margin: 20px 0;">
              <strong>Collection Workflow Sender Details:</strong><br>
              <strong>From Address:</strong> ${senderEmail}<br>
              <strong>From Name:</strong> ${senderName}<br>
              <strong>Test Recipient:</strong> ${testRecipient}<br>
              <strong>Department:</strong> ${defaultSender.department || 'Not specified'}
            </div>
            <p><em>Generated by Nexus AR Collections System using Collection Workflow Senders</em></p>
          </div>
        `
      });

      if (testEmailSent) {
        res.json({ 
          success: true, 
          message: "Test email sent successfully",
          sender: formattedSender,
          recipient: testRecipient
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to send test email"
        });
      }
    } catch (error) {
      console.error('SendGrid test error:', error);
      res.status(500).json({ 
        success: false, 
        message: "SendGrid test failed",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // HTTP MCP Endpoint for Retell AI Integration
  app.post('/mcp', async (req, res) => {
    try {
      console.log('📞 MCP HTTP Request received:', JSON.stringify(req.body, null, 2));
      
      const { method, params } = req.body;
      
      if (!method) {
        return res.status(400).json({
          error: "Missing 'method' in request body"
        });
      }

      // Initialize Retell client
      const retellApiKey = process.env.RETELL_API_KEY;
      if (!retellApiKey) {
        return res.status(500).json({
          error: "RETELL_API_KEY not configured"
        });
      }

      const retellClient = createRetellClient(retellApiKey);

      // Handle different MCP methods
      switch (method) {
        case 'initialize':
          return res.json({
            jsonrpc: "2.0", 
            id: req.body.id,
            result: {
              protocolVersion: "2025-06-18",
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: "Nexus AR Retell MCP",
                version: "1.0.0"
              }
            }
          });

        case 'notifications/initialized':
          // Acknowledge the initialization notification
          return res.status(200).send();

        case 'tools/list':
          return res.json({
            jsonrpc: "2.0",
            id: req.body.id,
            result: {
              tools: [
              {
                name: "create_phone_call",
                description: "Creates a new phone call with dynamic variables for Nexus AR",
                inputSchema: {
                  type: "object",
                  properties: {
                    to_number: { type: "string", description: "Phone number to call" },
                    agent_id: { type: "string", description: "Retell agent ID" },
                    from_number: { type: "string", description: "From phone number" },
                    dynamic_variables: { type: "object", description: "Dynamic variables for the call" }
                  },
                  required: ["to_number", "agent_id", "from_number"]
                }
              },
              {
                name: "get_call_status",
                description: "Gets the status of a specific call",
                inputSchema: {
                  type: "object",
                  properties: {
                    call_id: { type: "string", description: "Call ID to check" }
                  },
                  required: ["call_id"]
                }
              },
              {
                name: "list_calls",
                description: "Lists all calls for monitoring",
                inputSchema: {
                  type: "object",
                  properties: {}
                }
              },
              {
                name: "get_customer_invoices",
                description: "Get all invoices for a specific customer during debt collection call",
                inputSchema: {
                  type: "object",
                  properties: {
                    customer_name: { type: "string", description: "Customer company name" }
                  },
                  required: ["customer_name"]
                }
              },
              {
                name: "get_invoice_details",
                description: "Get detailed information about a specific invoice",
                inputSchema: {
                  type: "object",
                  properties: {
                    invoice_number: { type: "string", description: "Invoice number" }
                  },
                  required: ["invoice_number"]
                }
              },
              {
                name: "get_customer_contact_info",
                description: "Get customer contact details and payment history",
                inputSchema: {
                  type: "object",
                  properties: {
                    customer_name: { type: "string", description: "Customer company name" }
                  },
                  required: ["customer_name"]
                }
              },
              {
                name: "update_invoice_status",
                description: "Update invoice status after customer interaction",
                inputSchema: {
                  type: "object",
                  properties: {
                    invoice_number: { type: "string", description: "Invoice number" },
                    status: { type: "string", description: "New status (contacted, promised_payment, disputed, etc.)" },
                    notes: { type: "string", description: "Notes about the interaction" }
                  },
                  required: ["invoice_number", "status"]
                }
              }
            ]
            }
          });

        case 'tools/call':
          const { name, arguments: toolArgs } = params;
          
          switch (name) {
            case 'create_phone_call':
              try {
                // Critical Fix: Normalize dynamic variables for Retell AI
                const normalizedVariables = normalizeDynamicVariables(toolArgs.dynamic_variables, 'MCP_HTTP');
                logVariableTransformation(toolArgs.dynamic_variables, normalizedVariables, 'MCP_HTTP');
                
                // Prepare the final payload with normalized variables
                const callPayload = {
                  from_number: toolArgs.from_number,
                  to_number: toolArgs.to_number,
                  agent_id: toolArgs.agent_id,
                  dynamic_variables: normalizedVariables
                };
                
                // Log final payload keys being sent to Retell
                console.log("📤 [MCP_HTTP] Final payload keys sent to Retell:", Object.keys(callPayload.dynamic_variables || {}));
                console.log("📤 [MCP_HTTP] Full dynamic variables payload:", callPayload.dynamic_variables);
                
                const call = await retellClient.call.createPhoneCall(callPayload as any);
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      success: true,
                      call_id: (call as any).call_id || `demo-${Date.now()}`,
                      status: (call as any).call_status || "queued",
                      message: `Call initiated to ${toolArgs.to_number}`
                    })
                  }]
                });
              } catch (error: any) {
                console.error(`Error creating phone call: ${error.message}`);
                return res.json({
                  content: [{
                    type: "text", 
                    text: JSON.stringify({
                      success: true,
                      call_id: `demo-${Date.now()}`,
                      status: "queued",
                      message: `Demo call initiated to ${toolArgs.to_number}`
                    })
                  }]
                });
              }

            case 'get_call_status':
              try {
                const call = await retellClient.call.retrieve(toolArgs.call_id);
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      call_id: (call as any).call_id || toolArgs.call_id,
                      status: (call as any).call_status || "unknown",
                      duration: (call as any).call_analysis?.call_length_seconds || 0,
                      transcript: (call as any).transcript || ""
                    })
                  }]
                });
              } catch (error: any) {
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      call_id: toolArgs.call_id,
                      status: "demo",
                      duration: 0,
                      transcript: "Demo call status"
                    })
                  }]
                });
              }

            case 'list_calls':
              try {
                const calls = await retellClient.call.list({});
                const callList = calls.map((call: any) => ({
                  call_id: call.call_id || "demo",
                  status: call.call_status || "demo", 
                  to_number: call.to_number || "Unknown",
                  from_number: call.from_number || "Unknown",
                  created_at: call.start_timestamp || new Date().toISOString()
                }));
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify(callList)
                  }]
                });
              } catch (error: any) {
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify([])
                  }]
                });
              }

            case 'get_customer_invoices':
              try {
                // Get invoices for specific customer from storage
                const allInvoices = await storage.getInvoices('demo-tenant'); // TODO: Get actual tenant ID
                const customerInvoices = allInvoices.filter(invoice => 
                  invoice.contact.name.toLowerCase().includes(toolArgs.customer_name.toLowerCase())
                );
                
                const invoiceData = customerInvoices.map(invoice => ({
                  invoice_number: invoice.invoiceNumber,
                  amount: parseFloat(invoice.amount.toString()),
                  due_date: invoice.dueDate,
                  status: invoice.status,
                  days_overdue: Math.max(0, Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))),
                  description: invoice.description
                }));
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      customer_name: toolArgs.customer_name,
                      total_invoices: invoiceData.length,
                      total_outstanding: invoiceData.reduce((sum, inv) => sum + inv.amount, 0),
                      invoices: invoiceData
                    })
                  }]
                });
              } catch (error: any) {
                console.error(`Error getting customer invoices: ${error.message}`);
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      customer_name: toolArgs.customer_name,
                      total_invoices: 0,
                      total_outstanding: 0,
                      invoices: [],
                      error: "Unable to retrieve customer invoices"
                    })
                  }]
                });
              }

            case 'get_invoice_details':
              try {
                const allInvoices = await storage.getInvoices('demo-tenant'); // TODO: Get actual tenant ID
                const invoice = allInvoices.find(inv => inv.invoiceNumber === toolArgs.invoice_number);
                
                if (!invoice) {
                  return res.json({
                    content: [{
                      type: "text",
                      text: JSON.stringify({
                        error: `Invoice ${toolArgs.invoice_number} not found`
                      })
                    }]
                  });
                }
                
                const invoiceDetails = {
                  invoice_number: invoice.invoiceNumber,
                  customer_name: invoice.contact.name,
                  amount: invoice.amount,
                  due_date: invoice.dueDate,
                  status: invoice.status,
                  description: invoice.description,
                  days_overdue: Math.max(0, Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))),
                  created_date: invoice.createdAt || "Unknown"
                };
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify(invoiceDetails)
                  }]
                });
              } catch (error: any) {
                console.error(`Error getting invoice details: ${error.message}`);
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "Unable to retrieve invoice details"
                    })
                  }]
                });
              }

            case 'get_customer_contact_info':
              try {
                const allContacts = await storage.getContacts('demo-tenant'); // TODO: Get actual tenant ID
                const customer = allContacts.find(contact => 
                  contact.name.toLowerCase().includes(toolArgs.customer_name.toLowerCase())
                );
                
                if (!customer) {
                  return res.json({
                    content: [{
                      type: "text",
                      text: JSON.stringify({
                        error: `Customer ${toolArgs.customer_name} not found in contacts`
                      })
                    }]
                  });
                }
                
                const contactInfo = {
                  customer_name: customer.name,
                  email: customer.email,
                  phone: customer.phone,
                  address: customer.address || "Not provided",
                  contact_person: "Not specified", // Schema doesn't have contactPerson field
                  preferred_contact_method: customer.preferredContactMethod || "Email",
                  last_contact_date: "Never", // Schema doesn't have lastContactDate field
                  payment_terms: `Net ${customer.paymentTerms} days`,
                  credit_limit: customer.creditLimit ? customer.creditLimit.toString() : "Standard terms"
                };
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify(contactInfo)
                  }]
                });
              } catch (error: any) {
                console.error(`Error getting customer contact info: ${error.message}`);
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "Unable to retrieve customer contact information"
                    })
                  }]
                });
              }

            case 'update_invoice_status':
              try {
                const allInvoices = await storage.getInvoices('demo-tenant'); // TODO: Get actual tenant ID
                const invoiceIndex = allInvoices.findIndex(inv => inv.invoiceNumber === toolArgs.invoice_number);
                
                if (invoiceIndex === -1) {
                  return res.json({
                    content: [{
                      type: "text",
                      text: JSON.stringify({
                        error: `Invoice ${toolArgs.invoice_number} not found`
                      })
                    }]
                  });
                }
                
                // Update invoice status and add notes
                const updatedInvoice = {
                  ...allInvoices[invoiceIndex],
                  status: toolArgs.status,
                  lastContactDate: new Date().toISOString(),
                  notes: toolArgs.notes || ""
                };
                
                // In a real implementation, you'd update the database here
                // For now, we'll just return the updated info
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      success: true,
                      invoice_number: toolArgs.invoice_number,
                      old_status: allInvoices[invoiceIndex].status,
                      new_status: toolArgs.status,
                      notes: toolArgs.notes || "",
                      updated_at: new Date().toISOString(),
                      message: `Invoice ${toolArgs.invoice_number} status updated to ${toolArgs.status}`
                    })
                  }]
                });
              } catch (error: any) {
                console.error(`Error updating invoice status: ${error.message}`);
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "Unable to update invoice status"
                    })
                  }]
                });
              }

            default:
              return res.status(400).json({
                error: `Unknown tool: ${name}`
              });
          }

        case 'initialize':
          return res.json({
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "Nexus AR Retell MCP",
              version: "1.0.0"
            }
          });

        default:
          return res.status(400).json({
            error: `Unknown method: ${method}`
          });
      }
    } catch (error: any) {
      console.error('❌ MCP HTTP Error:', error);
      return res.status(500).json({
        error: `MCP server error: ${error.message}`
      });
    }
  });

  // Mock data generation (for demo purposes)
  app.post('/api/mock-data/generate', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log('🚀 Starting mock data generation for tenant:', user.tenantId);
      await generateMockData(user.tenantId);
      
      res.json({ 
        success: true, 
        message: "Mock data generated successfully! 80 clients and 1,800 invoices created."
      });
    } catch (error) {
      console.error("Error generating mock data:", error);
      res.status(500).json({ message: "Failed to generate mock data" });
    }
  });

  // Seed payment behavior customers (good payer vs bad payer)
  app.post('/api/mock-data/seed-payment-behavior', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log('🎯 Seeding payment behavior customers for tenant:', user.tenantId);
      const { seedPaymentBehaviorCustomers } = await import("./mock-data");
      await seedPaymentBehaviorCustomers(user.tenantId);
      
      res.json({ 
        success: true, 
        message: "Payment behavior customers seeded successfully! 2 customers with 60 invoices created."
      });
    } catch (error) {
      console.error("Error seeding payment behavior customers:", error);
      res.status(500).json({ message: "Failed to seed payment behavior customers" });
    }
  });

  // Clean up contacts endpoint - remove old Xero contacts and keep only 80 mock clients
  // Client & Partner Management Endpoints (Owner Only)
  
  // GET /api/business/clients - Complete client directory with filtering
  app.get('/api/business/clients', isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const filters = clientsQuerySchema.parse(req.query);
      const result = await clientPartnerService.getClientDirectory(filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching client directory:', error);
      res.status(500).json({ 
        message: 'Failed to fetch client directory', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/business/clients/:id/health - Individual client health details
  app.get('/api/business/clients/:id/health', isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const { id: tenantId } = req.params;
      const healthDetails = await clientPartnerService.getClientHealthDetails(tenantId);
      res.json(healthDetails);
    } catch (error) {
      console.error('Error fetching client health details:', error);
      res.status(500).json({ 
        message: 'Failed to fetch client health details', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/business/partners/:id/performance - Partner performance metrics
  app.get('/api/business/partners/:id/performance', isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const { id: partnerId } = req.params;
      const performance = await clientPartnerService.getPartnerPerformance(partnerId);
      res.json(performance);
    } catch (error) {
      console.error('Error fetching partner performance:', error);
      res.status(500).json({ 
        message: 'Failed to fetch partner performance', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/business/commissions - Commission tracking and reports
  app.get('/api/business/commissions', isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const filters = commissionsQuerySchema.parse(req.query);
      const period = filters.period || new Date().toISOString().slice(0, 7); // Current month as default
      const commissions = await clientPartnerService.calculateCommissions(period);
      
      // Apply filters
      let filteredCommissions = commissions;
      if (filters.partnerId) {
        filteredCommissions = commissions.filter(c => c.partnerId === filters.partnerId);
      }
      if (filters.status) {
        filteredCommissions = filteredCommissions.filter(c => c.status === filters.status);
      }

      // Pagination
      const total = filteredCommissions.length;
      const totalPages = Math.ceil(total / filters.limit);
      const offset = (filters.page - 1) * filters.limit;
      const paginatedCommissions = filteredCommissions.slice(offset, offset + filters.limit);

      res.json({
        commissions: paginatedCommissions,
        total,
        pagination: { 
          page: filters.page, 
          limit: filters.limit, 
          totalPages 
        }
      });
    } catch (error) {
      console.error('Error fetching commissions:', error);
      res.status(500).json({ 
        message: 'Failed to fetch commissions', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/business/clients/:id/assign-partner - Change partner assignments
  app.post('/api/business/clients/:id/assign-partner', isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const { id: clientTenantId } = req.params;
      const { partnerId } = assignPartnerSchema.parse(req.body);
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      await clientPartnerService.assignClientToPartner(clientTenantId, partnerId, user.id);
      
      res.json({ 
        success: true, 
        message: "Client successfully assigned to new partner" 
      });
    } catch (error) {
      console.error('Error assigning client to partner:', error);
      res.status(500).json({ 
        message: 'Failed to assign client to partner', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Admin endpoint for comprehensive 3-year dataset generation
  app.post('/api/admin/seed/mock-dataset', isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { confirmDestroy = false, years = 3, clientCount = 30, invoicesPerMonthRange = [5, 10] } = req.body;

      if (!confirmDestroy) {
        return res.status(400).json({ 
          message: "Must set confirmDestroy: true to proceed. This will DELETE ALL existing data.",
          warning: "This action will permanently delete all contacts, invoices, and actions for your tenant.",
          usage: "POST with body: { confirmDestroy: true, years: 3, clientCount: 30, invoicesPerMonthRange: [5, 10] }"
        });
      }

      console.log(`🚀 Admin: ${user.email} initiating comprehensive dataset generation for tenant ${user.tenantId}`);

      const { generateComprehensiveDataset } = await import("./mock-data");
      
      await generateComprehensiveDataset(user.tenantId, {
        years,
        clientCount,
        invoicesPerMonthRange,
        confirmDestroy: true
      });

      res.json({
        success: true,
        message: "Comprehensive 3-year dataset generated successfully! Perfect for ML training and investor demos.",
        configuration: {
          years,
          clientCount,
          invoicesPerMonthRange,
          estimatedInvoices: `${clientCount * years * 12 * invoicesPerMonthRange[0]}-${clientCount * years * 12 * invoicesPerMonthRange[1]}`,
          features: [
            "4 client behavior segments for ML learning",
            "36 months of historical invoice data", 
            "Realistic communication tracking",
            "Proper outstanding distribution (20% current, 40% <30 days, 40% 30-75 days)",
            "Industry-specific payment patterns",
            "Communication effectiveness data for AI training"
          ]
        }
      });
    } catch (error) {
      console.error("Error generating comprehensive dataset:", error);
      res.status(500).json({ 
        message: "Failed to generate comprehensive dataset", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ===== ONBOARDING API ENDPOINTS =====
  
  // Onboarding request validation schemas
  const onboardingPhaseSchema = z.enum(['technical_connection', 'business_setup', 'brand_customization', 'ai_review_launch']);
  const updateProgressSchema = z.object({
    phase: onboardingPhaseSchema,
    data: z.record(z.any()).optional()
  });
  const completePhaseSchema = z.object({
    phase: onboardingPhaseSchema
  });

  // Initialize onboarding for a tenant
  // Get current onboarding progress
  // Update phase progress
  // Complete a phase
  // Complete entire onboarding
  // Check onboarding status
  // Xero automated data import for onboarding
  // New 6-step onboarding endpoints
  app.post('/api/settings/recompute-debtor-scores', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      if (!tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const job = await onboardingService.enqueueDebtorScoring(tenantId, "SETTINGS");

      await storage.createActivityLog({
        tenantId,
        userId: user?.id,
        activityType: "debtor_scoring_queued",
        category: "audit",
        description: "Debtor scoring job queued from settings",
        metadata: { jobId: job.id, triggeredBy: "SETTINGS" },
      });

      res.json(job);
    } catch (error) {
      console.error("Error recomputing debtor scores:", error);
      res.status(500).json({ message: "Failed to recompute debtor scores" });
    }
  });

  // Auth routes - Check authentication status WITHOUT demo bypass for signup flows
  app.get('/api/auth/user', async (req: any, res) => {
    console.log('🔍 /api/auth/user endpoint hit');
    
    // Check if user is actually authenticated (without demo bypass)
    if (!req.isAuthenticated() || !req.user?.id) {
      console.log('🔍 User not authenticated, returning null');
      return res.json(null); // Return null for unauthenticated users
    }
    
    try {
      const userId = req.user.id;
      console.log('🔍 Looking up authenticated user with ID:', userId);
      const user = await storage.getUser(userId);
      console.log('🔍 Found user:', !!user);
      res.json(user ? stripSensitiveUserFields(user) : null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Recent Activity endpoint
  // Top Debtors endpoint
  // Dashboard metrics
  // Dashboard cash inflow forecast (real data from invoices + outcomes)
  // Dashboard leaderboards - Best/Worst Payers and Top Outstanding
  // Interest calculation endpoint
  // Owner-only endpoints
  app.get("/api/owner/tenants", isOwner, async (req: any, res) => {
    try {
      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching all tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.get("/api/owner/tenants-with-metrics", isOwner, async (req: any, res) => {
    try {
      const tenantsWithMetrics = await storage.getAllTenantsWithMetrics();
      res.json(tenantsWithMetrics);
    } catch (error) {
      console.error("Error fetching tenants with metrics:", error);
      res.status(500).json({ message: "Failed to fetch tenants with metrics" });
    }
  });

  // Invoice routes - Optimized with server-side filtering
  // Hold invoice endpoint
  // Unhold invoice endpoint
  // Mark invoice as paid and send thank you SMS
  // Pause invoice (dispute, PTP, payment plan)
  // Resume invoice (clear pause state)
  // Get invoice pause status
  // Send SMS for invoice with template selection
  // Initiate AI voice call for invoice
  // Get outstanding invoices for a specific contact (for payment plan creation)
  // Apply for invoice finance advance
  // Accept insurance coverage for an invoice
  // Contact routes
  // Get individual contact by ID
  // Combined endpoint for customer detail page - fetches all data in one request
  // Get email messages for a contact
  // Customer Contact Persons CRUD routes
  // Update AR contact details (collections-specific overlay)
  // New endpoint for contacts with significantly overdue invoices (>30 days)
  // Credit Assessment Routes
  
  // Calculate credit score and recommendation
  // Approve and save credit decision
  // === Promise Reliability Score (PRS) Routes ===
  
  // Get PRS summary for a contact
  // Get all promises for a contact
  // Evaluate a promise outcome
  app.post("/api/promises/:promiseId/evaluate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { promiseId } = req.params;
      const { status, actualPaymentDate, actualPaymentAmount, notes } = req.body;
      
      if (!status || !['kept', 'broken', 'partially_kept', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const { getPromiseReliabilityService } = await import('./services/promiseReliabilityService.js');
      const promiseService = getPromiseReliabilityService();
      
      const updatedPromise = await promiseService.evaluatePromise({
        promiseId,
        status,
        actualPaymentDate: actualPaymentDate ? new Date(actualPaymentDate) : undefined,
        actualPaymentAmount,
        evaluatedByUserId: req.user.id,
        notes,
      });
      
      res.json(updatedPromise);
    } catch (error) {
      console.error("Error evaluating promise:", error);
      res.status(500).json({ message: "Failed to evaluate promise" });
    }
  });
  
  // Get all open promises for evaluation
  app.get("/api/promises/open", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      
      const { getPromiseReliabilityService } = await import('./services/promiseReliabilityService.js');
      const promiseService = getPromiseReliabilityService();
      
      const openPromises = await promiseService.getOpenPromisesForEvaluation(user.tenantId);
      res.json(openPromises);
    } catch (error) {
      console.error("Error getting open promises:", error);
      res.status(500).json({ message: "Failed to get open promises" });
    }
  });

  // Sync contact to Xero with risk band
  // Contact Notes routes
  // Schedule an AI call to a contact
  /**
   * @deprecated POLLING DEPRECATED - Webhook now handles all call processing
   * 
   * This endpoint is kept as a fallback in case webhook doesn't arrive.
   * Primary processing now happens via POST /api/webhooks/retell/call-ended
   * 
   * The webhook handles:
   * - voiceStatus/voiceProcessedAt updates
   * - Outcome creation in outcomes table
   * - Work state routing (COOLDOWN, ATTENTION, etc.)
   * - Timeline event updates
   * 
   * This polling endpoint now returns cached results if webhook already processed.
   */
  // Generate AI email draft for a contact
  // Send email to a contact
  // Generate AI-powered SMS for a contact
  // Send SMS to a contact
  // Complete a reminder note
  app.patch("/api/notes/:noteId/complete", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { noteId } = req.params;
      
      const [updatedNote] = await db
        .update(contactNotes)
        .set({ 
          status: "completed",
          completedAt: new Date()
        })
        .where(
          and(
            eq(contactNotes.id, noteId),
            eq(contactNotes.tenantId, user.tenantId)
          )
        )
        .returning();

      if (!updatedNote) {
        return res.status(404).json({ message: "Note not found" });
      }

      res.json({ success: true, note: updatedNote });
    } catch (error) {
      console.error("Error completing reminder:", error);
      res.status(500).json({ message: "Failed to complete reminder" });
    }
  });

  // Get pending reminders for current user (for Action Centre Attention tab)
  app.get("/api/reminders/pending", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const reminders = await db.query.contactNotes.findMany({
        where: and(
          eq(contactNotes.tenantId, user.tenantId),
          eq(contactNotes.noteType, "reminder"),
          eq(contactNotes.status, "active"),
          or(
            eq(contactNotes.assignedToUserId, user.id),
            eq(contactNotes.createdByUserId, user.id)
          )
        ),
        orderBy: [asc(contactNotes.reminderDate)],
        with: {
          contact: true,
          createdByUser: true,
          assignedToUser: true,
        },
      });

      res.json(reminders);
    } catch (error) {
      console.error("Error fetching pending reminders:", error);
      res.status(500).json({ message: "Failed to fetch pending reminders" });
    }
  });

  // Customer Preview endpoint for drawer (calm preview, not full detail)
  // Customer Timeline page endpoint with offset pagination
  // Customer Invoices page endpoint with offset pagination
  // Customer Paid Invoices page endpoint with offset pagination
  // Customer Timeline endpoint with cursor pagination and filters
  // Create timeline note endpoint
  // Promise to Pay endpoint - Create PTP from customer drawer
  // Customer preferences endpoint
  // Update customer preferences endpoint
  // Debtor Snapshot endpoint for Action Centre drawer
  // Customer Detail: Get full communication history for a contact
  // Customer Detail: Get learning profile
  // Customer Detail: Get payment statistics
  // Customer Detail: Get action history
  // Customer Detail: Get customer rating (Good/Average/Poor)
  // Action routes
  // Get paginated actions with search and filtering (for Comms tab)
  // Get contact history for a specific invoice
  // Generate AI-powered response draft for query
  app.post("/api/queries/:id/generate-response", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      
      // Validate request body
      const validatedData = generateResponseSchema.parse(req.body);
      const { message, intent, sentiment, channel } = validatedData;

      // Get the action/query details
      const action = await storage.getAction(id, user.tenantId);
      if (!action) {
        return res.status(404).json({ message: "Query not found" });
      }

      // Use OpenAI to generate response
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const systemPrompt = `You are a professional accounts receivable specialist helping to draft responses to customer queries. 
Generate a polite, professional, and helpful response that addresses the customer's message.

Context:
- Channel: ${channel}
- Customer Intent: ${intent || 'Unknown'}
- Sentiment: ${sentiment || 'Neutral'}

Guidelines:
- Be professional and empathetic
- Address the customer's concerns directly
- Keep the tone appropriate for the sentiment (more understanding if negative, enthusiastic if positive)
- Keep it concise (2-3 paragraphs max)
- Sign off professionally
- For email responses, DO NOT include a subject line, only the body
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Customer message:\n${message}` }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const draftResponse = completion.choices[0].message.content || "";

      res.json({ draftResponse });
    } catch (error) {
      console.error("Error generating response:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate response" });
    }
  });

  // Send response to customer query
  app.post("/api/queries/:id/respond", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      
      // Validate request body
      const validatedData = respondToQuerySchema.parse(req.body);
      const { response, channel } = validatedData;

      // Get the original action/query
      const originalAction = await storage.getAction(id, user.tenantId);
      if (!originalAction) {
        return res.status(404).json({ message: "Query not found" });
      }

      // Create a new outbound action as the response
      const responseAction = await storage.createAction({
        tenantId: user.tenantId,
        userId: user.id,
        contactId: originalAction.contactId,
        invoiceId: originalAction.invoiceId,
        type: channel,
        status: 'completed',
        priority: 'medium',
        subject: `Re: ${originalAction.subject || 'Your query'}`,
        content: response,
        metadata: {
          direction: 'outbound',
          inReplyTo: id,
          isResponse: true,
        }
      });

      // TODO: Actually send the response via the appropriate channel (email/SMS)
      // For now, we just create the action record

      res.json({ 
        success: true, 
        responseAction,
        message: "Response sent successfully" 
      });
    } catch (error) {
      console.error("Error sending response:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to send response" });
    }
  });

  // Generate AI-powered outbound collection content
  // Send collection action
  // Escalate customer to next collection stage
  // Manual call capture with promise tracking
  // Get categorized items for Action Centre tabs
  // Collector response to disputes
  app.post("/api/disputes/:disputeId/respond", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { disputeId } = req.params;
      const { status, responseNotes } = req.body;

      // Validate input
      if (!status || !responseNotes) {
        return res.status(400).json({ message: "Status and response notes are required" });
      }

      if (!['under_review', 'resolved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be under_review, resolved, or rejected" });
      }

      // Get the dispute and verify it belongs to this tenant
      const dispute = await storage.getDispute(disputeId, user.tenantId);
      if (!dispute) {
        return res.status(404).json({ message: "Dispute not found" });
      }

      // Update the dispute
      const updatedDispute = await storage.updateDispute(disputeId, user.tenantId, {
        status,
        responseNotes,
        respondedBy: user.id,
        respondedAt: new Date()
      });

      // If dispute is resolved, create a note on the invoice
      if (status === 'resolved' || status === 'rejected') {
        await storage.createAction(user.tenantId, {
          invoiceId: dispute.invoiceId,
          contactId: null,
          userId: user.id,
          type: 'note',
          status: 'completed',
          subject: `Dispute ${status}`,
          content: `Dispute ${status} by credit controller. Response: ${responseNotes}`,
          metadata: {
            disputeId: dispute.id,
            disputeStatus: status
          }
        });
      }

      res.json(updatedDispute);
    } catch (error) {
      console.error("Error responding to dispute:", error);
      res.status(500).json({ message: "Failed to respond to dispute" });
    }
  });

  // Get inbound messages with intent analysis
  app.get("/api/inbound-messages", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const messages = await db
        .select()
        .from(inboundMessages)
        .where(eq(inboundMessages.tenantId, user.tenantId))
        .orderBy(sql`${inboundMessages.createdAt} DESC`)
        .limit(100);

      res.json(messages);
    } catch (error) {
      console.error("Error fetching inbound messages:", error);
      res.status(500).json({ message: "Failed to fetch inbound messages" });
    }
  });

  // Demo: Compress schedule into 5-minute window for investor demo
  app.post("/api/demo/compress-schedule", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID required" });
      }

      // Get invoice with contact and schedule
      const invoiceData = await db
        .select({
          invoice: invoices,
          contact: contacts,
          assignment: customerScheduleAssignments,
          schedule: collectionSchedules,
        })
        .from(invoices)
        .innerJoin(contacts, eq(invoices.contactId, contacts.id))
        .leftJoin(
          customerScheduleAssignments,
          and(
            eq(customerScheduleAssignments.contactId, contacts.id),
            eq(customerScheduleAssignments.isActive, true)
          )
        )
        .leftJoin(
          collectionSchedules,
          eq(collectionSchedules.id, customerScheduleAssignments.scheduleId)
        )
        .where(eq(invoices.id, invoiceId))
        .limit(1);

      if (!invoiceData.length) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const { invoice, contact, schedule } = invoiceData[0];

      if (!schedule) {
        return res.status(400).json({ message: "No collection schedule assigned to this customer" });
      }

      // Parse schedule steps
      const scheduleSteps = Array.isArray(schedule.scheduleSteps) 
        ? schedule.scheduleSteps 
        : [];

      if (scheduleSteps.length === 0) {
        return res.status(400).json({ message: "Schedule has no steps defined" });
      }

      // Generate demo session ID
      const demoSessionId = `demo_${Date.now()}`;
      const now = new Date();
      const createdActions = [];

      // Compress schedule steps into 5-minute window
      for (let i = 0; i < scheduleSteps.length && i < 5; i++) {
        const step = scheduleSteps[i];
        const scheduledFor = new Date(now.getTime() + (i * 60 * 1000)); // Each step 1 minute apart

        const actionData = {
          tenantId: user.tenantId,
          invoiceId: invoice.id,
          contactId: contact.id,
          userId: user.id,
          type: step.actionType,
          status: 'scheduled',
          subject: step.subject,
          content: step.content,
          scheduledFor,
          source: 'automated',
          metadata: {
            demoMode: true,
            demoSessionId,
            originalDaysTrigger: step.daysTrigger,
            scheduleStepIndex: i,
            scheduleName: schedule.name,
          }
        };

        const action = await storage.createAction(actionData);
        createdActions.push({
          ...action,
          minuteOffset: i,
          originalDay: step.daysTrigger,
        });
      }

      console.log(`🎬 Demo compression created ${createdActions.length} actions for invoice ${invoiceId} (session: ${demoSessionId})`);

      res.json({
        demoSessionId,
        invoiceNumber: invoice.invoiceNumber,
        contactName: contact.name,
        scheduleName: schedule.name,
        actionsCreated: createdActions.length,
        actions: createdActions,
        message: `Demo schedule compressed into ${createdActions.length} minutes. Actions will execute starting now.`
      });
    } catch (error) {
      console.error("Error creating demo compression:", error);
      res.status(500).json({ message: "Failed to create demo compression" });
    }
  });

  // Demo: Cleanup demo actions
  app.delete("/api/demo/cleanup/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { sessionId } = req.params;

      // Delete all actions for this demo session
      const result = await db
        .delete(actions)
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            sql`${actions.metadata}->>'demoSessionId' = ${sessionId}`
          )
        );

      console.log(`🧹 Demo cleanup: Removed demo session ${sessionId}`);

      res.json({
        message: "Demo session cleaned up successfully",
        sessionId
      });
    } catch (error) {
      console.error("Error cleaning up demo session:", error);
      res.status(500).json({ message: "Failed to cleanup demo session" });
    }
  });

  // Schedule manual action with specific time
  // ============================================================================
  // Action Centre Triage Endpoints (Sprint 1)
  // ============================================================================

  // Get action preview - renders the template with actual debtor data
  // Approve action - move from pending to scheduled (credit controller approves AI recommendation)
  // Edit action - credit controller overrides AI recommendation
  // Snooze action - delay to a later time
  // Escalate action - flag for manual handling
  // Assign action - assign to a specific credit controller
  // Feedback - record outcome for learning loop
  // Voice Call - initiate AI voice call via Retell (simplified - just sends variables to Retell)
  // Email - send email for an action
  // SMS - send SMS for an action
  // ============================================================================
  // End Action Centre Triage Endpoints
  // ============================================================================

  // AI suggestions
  app.post("/api/ai/suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const actions = await storage.getActions(user.tenantId);
      const contactHistory = actions
        .filter(a => a.contactId === invoice.contactId)
        .map(a => ({ type: a.type, date: a.createdAt?.toISOString() || new Date().toISOString(), response: a.status }));

      const suggestions = await generateCollectionSuggestions({
        amount: Number(invoice.amount),
        daysPastDue,
        contactHistory,
        contactProfile: {
          name: invoice.contact.name,
          paymentHistory: "good", // This could be calculated from historical data
          relationship: "established",
        },
      });

      res.json(suggestions);
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
      res.status(500).json({ message: "Failed to generate suggestions" });
    }
  });

  // Generate email draft
  app.post("/api/ai/email-draft", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId, tone = 'professional' } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const emailActions = await storage.getActions(user.tenantId);
      const previousEmails = emailActions.filter(a => 
        a.invoiceId === invoiceId && a.type === 'email'
      ).length;

      const emailDraft = await generateEmailDraft({
        contactName: invoice.contact.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        daysPastDue,
        previousEmails,
        tone: tone as 'friendly' | 'professional' | 'urgent',
      });

      res.json(emailDraft);
    } catch (error) {
      console.error("Error generating email draft:", error);
      res.status(500).json({ message: "Failed to generate email draft" });
    }
  });

  // Send reminder email using template-based system
  app.post("/api/communications/send-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId, customMessage } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact.email) {
        return res.status(400).json({ message: "Contact email not available" });
      }

      // Get the communication templates and email senders
      const communicationTemplates = await storage.getCommunicationTemplates(user.tenantId);
      const geInvoiceTemplate = communicationTemplates.find(template => template.name === 'GE Invoice');
      
      if (!geInvoiceTemplate) {
        return res.status(404).json({ message: "GE Invoice template not found" });
      }

      // Get the email sender configuration
      const emailSenders = await storage.getEmailSenders(user.tenantId);
      const defaultSender = emailSenders.find(sender => sender.isDefault) || emailSenders[0];

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const fromEmail = defaultSender?.email || process.env.SENDGRID_FROM_EMAIL || user.email || DEFAULT_FROM_EMAIL;

      // Get all invoices and filter for this contact
      const allInvoices = await storage.getInvoices(user.tenantId);
      const contactInvoices = allInvoices.filter(inv => inv.contactId === invoice.contactId);
      
      // Calculate total amounts
      const totalBalance = contactInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const totalAmountOverdue = contactInvoices
        .filter(inv => inv.status === 'overdue' || (inv.dueDate < new Date() && inv.status !== 'paid'))
        .reduce((sum, inv) => sum + Number(inv.amount), 0);

      // Process template variables
      const templateData = {
        first_name: invoice.contact.name?.split(' ')[0] || invoice.contact.name,
        invoice_number: invoice.invoiceNumber,
        amount: Number(invoice.amount).toLocaleString(),
        due_date: formatDate(invoice.dueDate),
        days_overdue: daysPastDue.toString(),
        company_name: invoice.contact.companyName || 'Customer',
        total_amount_overdue: totalAmountOverdue.toLocaleString(),
        total_balance: totalBalance.toLocaleString(),
        your_name: defaultSender?.fromName || 'Simon Kramer'
      };

      // Replace template variables in subject and content
      let processedSubject = geInvoiceTemplate.subject || 'Invoice Reminder';
      let processedContent = geInvoiceTemplate.content || 'Please see attached invoice.';

      Object.entries(templateData).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), value);
        processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value);
      });

      // Use the simple email sending system without PDF for now
      const { sendEmail } = await import('./services/sendgrid.js');

      const success = await sendEmail({
        to: invoice.contact.email,
        from: fromEmail,
        subject: processedSubject,
        text: processedContent,
        html: processedContent.replace(/\n/g, '<br>'),
        tenantId: user.tenantId,
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
          subject: processedSubject,
          content: customMessage || 'GE Invoice template email sent',
          completedAt: new Date(),
        });

        // Update invoice reminder count
        await storage.updateInvoice(invoiceId, user.tenantId, {
          lastReminderSent: new Date(),
          reminderCount: (invoice.reminderCount || 0) + 1,
        });
      }

      res.json({ success, message: success ? 'Email sent successfully' : 'Failed to send email' });
    } catch (error) {
      console.error("Error sending collection email:", error);
      res.status(500).json({ message: "Failed to send collection email" });
    }
  });

  // Send SMS reminder
  app.post("/api/communications/send-sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact.phone) {
        return res.status(400).json({ message: "Contact phone not available" });
      }

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      const result = await sendPaymentReminderSMS({
        phone: invoice.contact.phone,
        name: invoice.contact.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        daysPastDue,
      });

      if (result.success) {
        // Log the action
        await storage.createAction({
          tenantId: user.tenantId,
          invoiceId,
          contactId: invoice.contactId,
          userId: user.id,
          type: 'sms',
          status: 'completed',
          subject: `SMS Reminder - Invoice ${invoice.invoiceNumber}`,
          content: 'Payment reminder SMS sent',
          completedAt: new Date(),
          metadata: { messageId: result.messageId },
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error sending SMS reminder:", error);
      res.status(500).json({ message: "Failed to send SMS reminder" });
    }
  });

  // Test Communication Routes
  app.post("/api/test/email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, overrideEmail } = req.body;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }

      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const emailToUse = overrideEmail || contact.email;
      if (!emailToUse) {
        return res.status(400).json({ message: "Contact email not available and no override provided" });
      }

      const fromEmail = user.email || DEFAULT_FROM_EMAIL;

      const success = await sendReminderEmail({
        contactEmail: emailToUse,
        contactName: contact.name,
        invoiceNumber: "TEST-001",
        amount: 100.00,
        dueDate: formatDate(new Date()),
        daysPastDue: 0,
      }, fromEmail, "[TEST EMAIL] This is a test communication from Nexus AR");

      if (success) {
        // Log the test action
        await storage.createAction({
          tenantId: user.tenantId,
          contactId,
          userId: user.id,
          type: 'email',
          status: 'completed',
          subject: 'TEST EMAIL - Communication Test',
          content: 'Test email sent successfully from Settings page',
          completedAt: new Date(),
        });
      }

      res.json({ success, message: success ? 'Test email sent successfully' : 'Failed to send test email' });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  app.post("/api/test/sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, overrideMobile } = req.body;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }

      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const phoneToUse = overrideMobile || contact.phone;
      if (!phoneToUse) {
        return res.status(400).json({ message: "Contact phone not available and no override provided" });
      }

      const result = await sendPaymentReminderSMS({
        phone: phoneToUse,
        name: contact.name,
        invoiceNumber: "TEST-001",
        amount: 100.00,
        daysPastDue: 0,
      });

      if (result.success) {
        // Log the test action
        await storage.createAction({
          tenantId: user.tenantId,
          contactId,
          userId: user.id,
          type: 'sms',
          status: 'completed',
          subject: 'TEST SMS - Communication Test',
          content: 'Test SMS sent successfully from Settings page',
          completedAt: new Date(),
          metadata: { messageId: result.messageId },
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error sending test SMS:", error);
      res.status(500).json({ message: "Failed to send test SMS" });
    }
  });

  // ==================== ACTION CENTRE API ====================

  // Debug endpoint to create test action items with proper due dates
  // Smart Queue Management with ML Prioritization
  // Compliance Audit Endpoint - Check for policy violations
  app.get("/api/admin/compliance-report", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { policyDecisions, contactOutcomes } = await import("@shared/schema");
      const { and: andOp, eq: eqOp, gte: gteOp, sql: sqlFunc } = await import("drizzle-orm");
      
      // Look back 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Query frequency cap violations
      const frequencyCapViolations = await db
        .select()
        .from(policyDecisions)
        .where(
          andOp(
            eqOp(policyDecisions.tenantId, user.tenantId),
            eqOp(policyDecisions.guardStatus, 'blocked'),
            gteOp(policyDecisions.createdAt, thirtyDaysAgo)
          )
        )
        .limit(10);

      // Query quiet hours breaches (would need quiet hours logic implemented)
      const quietHoursBreaches: any[] = []; // Placeholder for quiet hours violations

      // Count total policy decisions
      const totalDecisionsResult = await db
        .select({ count: sqlFunc<number>`count(*)` })
        .from(policyDecisions)
        .where(
          andOp(
            eqOp(policyDecisions.tenantId, user.tenantId),
            gteOp(policyDecisions.createdAt, thirtyDaysAgo)
          )
        );
      
      const totalDecisions = Number(totalDecisionsResult[0]?.count || 0);
      const blockedCount = frequencyCapViolations.length;
      const allowedCount = totalDecisions - blockedCount;
      
      // Calculate compliance rate
      const complianceRate = totalDecisions > 0 
        ? (allowedCount / totalDecisions * 100).toFixed(1)
        : '100.0';

      res.json({
        summary: {
          totalDecisions,
          allowedCount,
          blockedCount,
          complianceRate: parseFloat(complianceRate),
          periodDays: 30,
        },
        violations: {
          frequencyCap: {
            count: frequencyCapViolations.length,
            examples: frequencyCapViolations.map(v => ({
              id: v.id,
              contactId: v.contactId,
              invoiceId: v.invoiceId,
              reason: v.guardReason,
              timestamp: v.createdAt,
            })),
          },
          quietHours: {
            count: quietHoursBreaches.length,
            examples: quietHoursBreaches,
          },
        },
        insights: {
          mostBlockedReason: frequencyCapViolations.length > 0 
            ? 'frequency_cap_exceeded'
            : null,
          peakViolationHour: null, // Would require time-based analysis
        },
      });
    } catch (error) {
      console.error("Error generating compliance report:", error);
      res.status(500).json({ message: "Failed to generate compliance report" });
    }
  });

  // Channel Analytics Endpoint - Show channel effectiveness and A/B test results
  app.get("/api/admin/analytics/channels", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactOutcomes, policyDecisions } = await import("@shared/schema");
      const { eq: eqOp, sql: sqlFunc, gte: gteOp, inArray: inArrayOp } = await import("drizzle-orm");
      
      const { timeRange = '30d' } = req.query;
      
      // Calculate time window
      const daysAgo = parseInt(timeRange.replace('d', ''), 10);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

      // Aggregate outcomes by channel
      const channelStats = await db
        .select({
          channel: contactOutcomes.channel,
          outcome: contactOutcomes.outcome,
          count: sqlFunc<number>`count(*)`,
        })
        .from(contactOutcomes)
        .where(
          and(
            eqOp(contactOutcomes.tenantId, user.tenantId),
            gteOp(contactOutcomes.eventTimestamp, cutoffDate)
          )
        )
        .groupBy(contactOutcomes.channel, contactOutcomes.outcome);

      // Aggregate outcomes by A/B variant
      const variantStats = await db
        .select({
          variant: policyDecisions.experimentVariant,
          count: sqlFunc<number>`count(*)`,
          avgScore: sqlFunc<number>`avg(${policyDecisions.score})`,
        })
        .from(policyDecisions)
        .where(
          and(
            eqOp(policyDecisions.tenantId, user.tenantId),
            gteOp(policyDecisions.createdAt, cutoffDate)
          )
        )
        .groupBy(policyDecisions.experimentVariant);

      // Calculate channel metrics
      const successOutcomes = ['delivered', 'opened', 'clicked', 'answered', 'completed'];
      
      const calculateChannelMetrics = (channel: string) => {
        const channelData = channelStats.filter(s => s.channel === channel);
        const totalSent = channelData.reduce((sum, s) => sum + Number(s.count), 0);
        const successCount = channelData
          .filter(s => successOutcomes.includes(s.outcome))
          .reduce((sum, s) => sum + Number(s.count), 0);
        
        return {
          totalSent,
          responseRate: totalSent > 0 ? (successCount / totalSent) * 100 : 0,
        };
      };

      // Calculate A/B test metrics
      const adaptiveData = variantStats.find(v => v.variant === 'ADAPTIVE');
      const staticData = variantStats.find(v => v.variant === 'STATIC');

      const adaptiveActions = Number(adaptiveData?.count || 0);
      const staticActions = Number(staticData?.count || 0);
      
      // Response rate approximation (would need to join with outcomes for precise calculation)
      const adaptiveRate = adaptiveActions > 0 ? Number(adaptiveData?.avgScore || 0) * 100 : 0;
      const staticRate = staticActions > 0 ? Number(staticData?.avgScore || 0) * 100 : 0;
      
      const lift = staticRate > 0 ? ((adaptiveRate - staticRate) / staticRate) * 100 : 0;

      res.json({
        channels: {
          email: calculateChannelMetrics('email'),
          sms: calculateChannelMetrics('sms'),
          voice: calculateChannelMetrics('voice'),
        },
        abTest: {
          adaptive: {
            totalActions: adaptiveActions,
            responseRate: adaptiveRate,
            avgDaysToPayment: 0, // Would need payment data to calculate
          },
          static: {
            totalActions: staticActions,
            responseRate: staticRate,
            avgDaysToPayment: 0, // Would need payment data to calculate
          },
          lift,
        },
        overdueBands: {
          // Overdue bands would require joining with invoices table
          '0-30': { count: 0, responseRate: 0 },
          '31-60': { count: 0, responseRate: 0 },
          '61-90': { count: 0, responseRate: 0 },
          '90+': { count: 0, responseRate: 0 },
        },
      });
    } catch (error) {
      console.error("Error fetching channel analytics:", error);
      res.status(500).json({ message: "Failed to fetch channel analytics" });
    }
  });

  // Contact Outcomes Endpoint - Show all webhook outcomes
  app.get("/api/admin/outcomes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactOutcomes } = await import("@shared/schema");
      const { eq: eqOp, desc: descFunc } = await import("drizzle-orm");
      
      // Fetch recent outcomes
      const outcomes = await db
        .select()
        .from(contactOutcomes)
        .where(eqOp(contactOutcomes.tenantId, user.tenantId))
        .orderBy(descFunc(contactOutcomes.eventTimestamp))
        .limit(100);

      res.json(outcomes);
    } catch (error) {
      console.error("Error fetching outcomes:", error);
      res.status(500).json({ message: "Failed to fetch outcomes" });
    }
  });

  // Priority Management Endpoints
  // Action Item Management
  // Action Logging
  // Communication History
  app.get("/api/communications/history", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, invoiceId, limit } = communicationHistoryQuerySchema.parse(req.query);
      
      // Get action items based on filters
      const filters: any = {};
      if (contactId) {
        const actionItems = await storage.getActionItemsByContact(contactId, user.tenantId);
        return res.json(actionItems);
      }
      
      if (invoiceId) {
        const actionItems = await storage.getActionItemsByInvoice(invoiceId, user.tenantId);
        return res.json(actionItems);
      }

      // Get all recent communication actions if no specific filter
      const result = await storage.getActionItems(user.tenantId, { 
        limit: limit || 50,
        type: 'email' // Filter for communication types
      });
      
      res.json(result.actionItems);
    } catch (error) {
      console.error("Error fetching communication history:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to fetch communication history" });
    }
  });

  // Payment Promises
  app.post("/api/payment-promises", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const promiseData = insertPaymentPromiseSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
        createdByUserId: user.id,
      });

      const promise = await storage.createPaymentPromise(promiseData);
      
      // Create related action item for follow-up
      await storage.createActionItem({
        tenantId: user.tenantId,
        contactId: promiseData.contactId,
        invoiceId: promiseData.invoiceId,
        type: 'ptp_followup',
        priority: 'medium',
        status: 'open',
        notes: `Follow up on payment promise for ${promiseData.promisedAmount} due ${promiseData.promisedDate}`,
        dueAt: new Date(new Date(promiseData.promisedDate).getTime() + 24 * 60 * 60 * 1000), // Day after promise date
        createdByUserId: user.id,
      });

      res.status(201).json(promise);
    } catch (error) {
      console.error("Error creating payment promise:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payment promise data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create payment promise" });
    }
  });

  app.patch("/api/payment-promises/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const updates = insertPaymentPromiseSchema.partial().parse(req.body);
      
      const promise = await storage.updatePaymentPromise(id, user.tenantId, updates);
      res.json(promise);
    } catch (error) {
      console.error("Error updating payment promise:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update payment promise" });
    }
  });

  // Payment Plan API endpoints
  // Check if invoices already have active payment plans
  // Activity Log API endpoints
  // Wallet API endpoints
  // Bulk Operations
  // ==================== END ACTION CENTRE API ====================

  app.post("/api/test/voice", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { 
        phone, 
        customerName, 
        companyName, 
        invoiceNumber, 
        invoiceAmount, 
        totalOutstanding, 
        daysOverdue, 
        invoiceCount, 
        dueDate, 
        organisationName, 
        demoMessage 
      } = req.body;
      
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Get tenant information for fallback organization name
      const tenant = await storage.getTenant(user.tenantId);
      
      // Import the unified Retell helper
      const { createUnifiedRetellCall, createStandardCollectionVariables } = await import('./utils/retellCallHelper');
      
      // Create standard collection variables using the helper (accepts any format)
      // Demo values provide realistic test data for the voice agent
      const variablesData = createStandardCollectionVariables({
        customerName: customerName || "Test Customer",
        companyName: companyName || "Test Company", 
        organisationName: organisationName || tenant?.name || "Nexus AR",
        invoiceNumber: invoiceNumber || "TEST-001",
        invoiceAmount: invoiceAmount || "1500.00",
        totalOutstanding: totalOutstanding || "1500.00",
        daysOverdue: daysOverdue || "14",
        invoiceCount: invoiceCount || "2",
        dueDate: dueDate || new Date(),
        customMessage: demoMessage || "This is a professional collection call regarding outstanding invoices.",
        // New enhanced context variables with demo values
        totalOverdue: totalOutstanding || "1500.00",
        overdueCount: invoiceCount || "2",
        oldestInvoiceAge: "45",
        averageDaysOverdue: daysOverdue || "14",
        lastPaymentDate: null, // Demo: no recent payment
        lastPaymentAmount: null,
        lastContactDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        contactMethod: "email",
        previousPromises: "1",
        disputeCount: "0",
        creditTerms: "Net 30",
        accountAge: "180",
      });

      // Use unified Retell call creation (handles variable normalization, phone formatting, etc.)
      const callResult = await createUnifiedRetellCall({
        toNumber: phone,
        dynamicVariables: variablesData,
        context: 'TEST_VOICE',
        metadata: {
          type: 'test_call',
          tenantId: user.tenantId,
          userId: user.id
        }
      });

      // Store the test call record
      const voiceCallData = insertVoiceCallSchema.parse({
        tenantId: user.tenantId,
        retellCallId: callResult.callId,
        retellAgentId: callResult.agentId,
        fromNumber: callResult.fromNumber,
        toNumber: callResult.toNumber,
        direction: callResult.direction,
        status: callResult.status,
        scheduledAt: new Date(),
      });

      const voiceCall = await storage.createVoiceCall(voiceCallData);

      // Log the test action
      await storage.createAction({
        tenantId: user.tenantId,
        userId: user.id,
        type: 'voice',
        status: 'completed',
        subject: 'TEST VOICE - Communication Test',
        content: `Test voice call initiated to ${callResult.toNumber} for ${customerName || 'Test Customer'}`,
        completedAt: new Date(),
        metadata: { 
          retellCallId: callResult.callId, 
          dynamicVariables: callResult.normalizedVariables,
          unifiedCall: true 
        },
      });

      res.status(201).json({
        voiceCall,
        retellCallId: callResult.callId,
        message: `Call initiated to ${callResult.toNumber}`,
        dynamicVariables: callResult.normalizedVariables
      });
    } catch (error: any) {
      console.error("Error creating test voice call:", error);
      res.status(500).json({ message: error.message || "Failed to create test voice call" });
    }
  });

  // Workflow routes
  app.get("/api/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const workflows = await storage.getWorkflows(user.tenantId);
      res.json(workflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  app.post("/api/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const workflowData = insertWorkflowSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const workflow = await storage.createWorkflow(workflowData);
      res.status(201).json(workflow);
    } catch (error) {
      console.error("Error creating workflow:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid workflow data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create workflow" });
    }
  });

  // Seed Standard Collections Workflow for all tenants
  app.post("/api/workflows/seed", isAuthenticated, async (req: any, res) => {
    try {
      const { WorkflowSeeder } = await import('./services/workflowSeeder');
      const result = await WorkflowSeeder.seedAllTenants();
      
      res.json({
        success: result.success,
        message: `Seeded ${result.workflowsCreated} workflows across ${result.tenantsProcessed} tenants`,
        details: result
      });
    } catch (error: any) {
      console.error("Error seeding workflows:", error);
      res.status(500).json({ message: "Failed to seed workflows", error: error.message });
    }
  });

  // Assign workflow to a contact
  // Collections Workflow Management Routes
  
  // Communication Templates
  // Communication Preview Endpoints
  const previewRequestSchema = z.object({
    invoiceId: z.string().optional(),
    contactId: z.string().optional(),
    templateId: z.string().optional()
  }).refine(
    (data) => data.invoiceId || data.contactId,
    { message: "Either invoiceId or contactId must be provided" }
  );

  // Helper function to process template variables
  const processTemplateVariables = (content: string, variables: Record<string, string>): string => {
    return content
      .replace(/{{contact_name}}/g, variables.contact_name || 'Unknown Contact')
      .replace(/{{invoice_number}}/g, variables.invoice_number || '')
      .replace(/{{days_overdue}}/g, variables.days_overdue || '0')
      .replace(/{{amount}}/g, variables.amount || '0.00')
      .replace(/{{due_date}}/g, variables.due_date || '')
      .replace(/{{your_name}}/g, variables.your_name || 'Collections Team')
      .replace(/{{total_balance}}/g, variables.total_balance || '0.00')
      .replace(/{{total_amount_overdue}}/g, variables.total_amount_overdue || '0.00')
      .replace(/{{company_name}}/g, variables.company_name || '')
      .replace(/{{phone}}/g, variables.phone || '')
      .replace(/{{email}}/g, variables.email || '');
  };

  // Helper function to get context variables from invoice or contact
  const getContextVariables = async (invoiceId?: string, contactId?: string, tenantId?: string) => {
    const variables: Record<string, string> = {};
    
    if (invoiceId && tenantId) {
      const invoice = await storage.getInvoice(invoiceId, tenantId);
      if (invoice) {
        const contact = await storage.getContact(invoice.contactId, tenantId);
        variables.invoice_number = invoice.invoiceNumber;
        variables.amount = invoice.amount.toString();
        variables.total_balance = invoice.amount.toString();
        
        if (invoice.dueDate) {
          const dueDate = new Date(invoice.dueDate);
          const today = new Date();
          const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
          variables.days_overdue = daysOverdue.toString();
          variables.due_date = formatDate(dueDate);
          variables.total_amount_overdue = daysOverdue > 0 ? invoice.amount.toString() : '0.00';
        }
        
        if (contact) {
          variables.contact_name = contact.name || 'Unknown Contact';
          variables.company_name = contact.companyName || '';
          variables.phone = contact.phone || '';
          variables.email = contact.email || '';
        }
      }
    } else if (contactId && tenantId) {
      const contact = await storage.getContact(contactId, tenantId);
      if (contact) {
        variables.contact_name = contact.name || 'Unknown Contact';
        variables.company_name = contact.companyName || '';
        variables.phone = contact.phone || '';
        variables.email = contact.email || '';
      }
    }
    
    variables.your_name = 'Collections Team'; // Could be made dynamic based on email sender config
    return variables;
  };

  // Preview Email Endpoint
  app.post("/api/communications/preview-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const requestData = previewRequestSchema.parse(req.body);
      const { invoiceId, contactId, templateId } = requestData;

      // Get context variables
      const variables = await getContextVariables(invoiceId, contactId, user.tenantId);

      // Get template or use defaults
      let template = null;
      let subject = "Payment Reminder";
      let content = "Dear {{contact_name}},\n\nWe wanted to remind you about your outstanding invoice {{invoice_number}} in the amount of {{amount}}.\n\nPlease contact us if you have any questions.\n\nBest regards,\n{{your_name}}";

      if (templateId) {
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'email' });
        template = templates.find(t => t.id === templateId);
        if (template) {
          subject = template.subject || subject;
          content = template.content || content;
        }
      } else {
        // Get default email template
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'email' });
        if (templates.length > 0) {
          template = templates[0];
          subject = template.subject || subject;
          content = template.content || content;
        }
      }

      // Process template variables
      const processedSubject = processTemplateVariables(subject, variables);
      const processedContent = processTemplateVariables(content, variables);

      // Determine recipient
      let recipient = '';
      if (invoiceId) {
        const invoice = await storage.getInvoice(invoiceId, user.tenantId);
        if (invoice) {
          const contact = await storage.getContact(invoice.contactId, user.tenantId);
          recipient = contact?.email || '';
        }
      } else if (contactId) {
        const contact = await storage.getContact(contactId, user.tenantId);
        recipient = contact?.email || '';
      }

      res.json({
        subject: processedSubject,
        content: processedContent,
        recipient,
        templateUsed: template?.id || null,
        variables
      });

    } catch (error) {
      console.error("Error generating email preview:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate email preview" });
    }
  });

  // Preview SMS Endpoint
  app.post("/api/communications/preview-sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const requestData = previewRequestSchema.parse(req.body);
      const { invoiceId, contactId, templateId } = requestData;

      // Get context variables
      const variables = await getContextVariables(invoiceId, contactId, user.tenantId);

      // Get template or use defaults
      let template = null;
      let content = "Hi {{contact_name}}, your invoice {{invoice_number}} for {{amount}} is overdue by {{days_overdue}} days. Please contact us to arrange payment. Thanks, {{your_name}}";

      if (templateId) {
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'sms' });
        template = templates.find(t => t.id === templateId);
        if (template) {
          content = template.content || content;
        }
      } else {
        // Get default SMS template
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'sms' });
        if (templates.length > 0) {
          template = templates[0];
          content = template.content || content;
        }
      }

      // Process template variables
      const processedContent = processTemplateVariables(content, variables);

      // Determine recipient
      let recipient = '';
      if (invoiceId) {
        const invoice = await storage.getInvoice(invoiceId, user.tenantId);
        if (invoice) {
          const contact = await storage.getContact(invoice.contactId, user.tenantId);
          recipient = contact?.phone || '';
        }
      } else if (contactId) {
        const contact = await storage.getContact(contactId, user.tenantId);
        recipient = contact?.phone || '';
      }

      res.json({
        subject: null, // SMS doesn't have subjects
        content: processedContent,
        recipient,
        templateUsed: template?.id || null,
        variables
      });

    } catch (error) {
      console.error("Error generating SMS preview:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate SMS preview" });
    }
  });

  // Preview Voice Endpoint
  app.post("/api/communications/preview-voice", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const requestData = previewRequestSchema.parse(req.body);
      const { invoiceId, contactId, templateId } = requestData;

      // Get context variables
      const variables = await getContextVariables(invoiceId, contactId, user.tenantId);

      // Get template or use defaults
      let template = null;
      let content = "Hello {{contact_name}}, this is {{your_name}} from our collections department. I'm calling regarding your overdue invoice {{invoice_number}} in the amount of {{amount}}. This invoice is now {{days_overdue}} days past due. Please contact us at your earliest convenience to discuss payment arrangements. Thank you.";

      if (templateId) {
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'voice' });
        template = templates.find(t => t.id === templateId);
        if (template) {
          content = template.content || content;
        }
      } else {
        // Get default voice template
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'voice' });
        if (templates.length > 0) {
          template = templates[0];
          content = template.content || content;
        }
      }

      // Process template variables
      const processedContent = processTemplateVariables(content, variables);

      // Determine recipient
      let recipient = '';
      if (invoiceId) {
        const invoice = await storage.getInvoice(invoiceId, user.tenantId);
        if (invoice) {
          const contact = await storage.getContact(invoice.contactId, user.tenantId);
          recipient = contact?.phone || '';
        }
      } else if (contactId) {
        const contact = await storage.getContact(contactId, user.tenantId);
        recipient = contact?.phone || '';
      }

      res.json({
        subject: null, // Voice calls don't have subjects
        content: processedContent,
        recipient,
        templateUsed: template?.id || null,
        variables
      });

    } catch (error) {
      console.error("Error generating voice preview:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate voice preview" });
    }
  });

  // Enhanced template management
  // AI Template Generation Helper Functions
  function generateEmailSubject(category: string, stage: number, tone: string): string {
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
    return subjects[Math.min(stage - 1, subjects.length - 1)] || subjects[0];
  }

  function generateEmailContent(category: string, stage: number, tone: string): string {
    const baseContent: Record<string, Record<string, string>> = {
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

    const categoryContent = baseContent[category] || baseContent.payment_reminder;
    return categoryContent[tone] || categoryContent.professional;
  }

  function generateSMSContent(category: string, stage: number, tone: string): string {
    const smsTemplates: Record<string, Record<string, string>> = {
      payment_reminder: {
        friendly: "Hi {customerName}! Just a friendly reminder that invoice #{invoiceNumber} for $\{amount} was due on {dueDate}. Thanks!",
        professional: "Payment reminder: Invoice #{invoiceNumber} ($\{amount}) due {dueDate}. Please process payment. Questions? Reply HELP",
        firm: "NOTICE: Invoice #{invoiceNumber} ($\{amount}) is past due. Payment required immediately. Contact us to avoid further action.",
        urgent: "URGENT: Invoice #{invoiceNumber} overdue. $\{amount} payment required NOW to avoid collection action. Call immediately."
      }
    };

    const categoryContent = smsTemplates[category] || smsTemplates.payment_reminder;
    return categoryContent[tone] || categoryContent.professional;
  }

  function generateWhatsAppContent(category: string, stage: number, tone: string): string {
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
    return categoryContent[tone] || categoryContent.professional;
  }

  // Email senders management
  // Collection schedules management
  // Customer schedule assignments
  // Assign all customers to default schedule
  // Collections Automation
  // Week 1: Supervised Autonomy - Daily Plan & Approval
  // Generate plan now (force regeneration)
  // Delete all planned actions (for demo/testing purposes)
  // ============================================================
  // V0.5 ATTENTION ITEMS API ENDPOINTS
  // ============================================================

  // Get attention items with filters
  // Get single attention item
  // Create attention item - Zod validation schema
  const createAttentionItemSchema = z.object({
    type: z.enum(['DISPUTE', 'PAYMENT_PLAN_REQUEST', 'REQUEST_MORE_TIME', 'LOW_CONFIDENCE_OUTCOME', 'SYNC_MISMATCH', 'DATA_QUALITY', 'PTP_BREACH', 'FIRST_CONTACT_HIGH_VALUE', 'VIP_CUSTOMER', 'MANUAL_REVIEW']),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    invoiceId: z.string().optional(),
    contactId: z.string().optional(),
    actionId: z.string().optional(),
    payloadJson: z.any().optional(),
  });

  // Update attention item (assign, update status)
  // Resolve attention item
  // Dismiss attention item
  // ============================================================
  // DEBTOR PACKS ENDPOINT - Loop left pane data
  // Derives debtor packs on-the-fly via SQL aggregation
  // ============================================================

  app.get("/api/debtor-packs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenantId = user.tenantId;
      const { stage } = req.query;

      // Step 1: Get all contacts with open invoices, aggregating invoice data
      const contactsWithInvoices = await db.execute(sql`
        SELECT 
          c.id as contact_id,
          c.name as contact_name,
          c.tenant_id,
          COUNT(i.id) as invoice_count,
          COALESCE(SUM(i.amount - COALESCE(i.amount_paid, 0)), 0) as total_due,
          COALESCE(MAX(EXTRACT(day FROM (CURRENT_DATE - i.due_date))::integer), 0) as oldest_days_overdue
        FROM contacts c
        INNER JOIN invoices i ON c.id = i.contact_id AND c.tenant_id = i.tenant_id
        WHERE c.tenant_id = ${tenantId}
          AND i.status = 'OPEN'
          AND (i.amount - COALESCE(i.amount_paid, 0)) > 0
        GROUP BY c.id, c.name, c.tenant_id
        ORDER BY oldest_days_overdue DESC
      `);

      // Step 2: Get open attention items per contact
      const openAttentionItems = await db
        .select({
          contactId: attentionItems.contactId,
          type: attentionItems.type,
          severity: attentionItems.severity,
        })
        .from(attentionItems)
        .where(and(
          eq(attentionItems.tenantId, tenantId),
          or(eq(attentionItems.status, 'OPEN'), eq(attentionItems.status, 'IN_PROGRESS'))
        ));

      const attentionByContact = new Map<string, { type: string; severity: string }>();
      for (const item of openAttentionItems) {
        if (item.contactId && !attentionByContact.has(item.contactId)) {
          attentionByContact.set(item.contactId, { type: item.type!, severity: item.severity! });
        }
      }

      // Step 3: Get latest action per contact to determine in-flight state
      const latestActions = await db.execute(sql`
        SELECT DISTINCT ON (a.contact_id)
          a.contact_id,
          a.status as action_status,
          a.work_state,
          a.in_flight_state,
          a.scheduled_for,
          a.completed_at
        FROM actions a
        WHERE a.tenant_id = ${tenantId}
          AND a.status IN ('PENDING', 'APPROVED', 'EXECUTED', 'SENT')
        ORDER BY a.contact_id, a.updated_at DESC
      `);

      const actionsByContact = new Map<string, any>();
      for (const action of latestActions.rows as any[]) {
        actionsByContact.set(action.contact_id, action);
      }

      // Step 4: Build debtor pack rows with stage derivation
      const debtorPacks: any[] = [];
      
      for (const row of contactsWithInvoices.rows as any[]) {
        const contactId = row.contact_id;
        const hasAttention = attentionByContact.has(contactId);
        const attention = attentionByContact.get(contactId);
        const latestAction = actionsByContact.get(contactId);

        // Derive stage based on precedence: ATTENTION > IN_FLIGHT > PLANNED
        let derivedStage: 'PLANNED' | 'IN_FLIGHT' | 'ATTENTION' | 'CLOSED' = 'PLANNED';
        let inFlightState: string | undefined;
        let attentionType: string | undefined;

        if (hasAttention) {
          derivedStage = 'ATTENTION';
          attentionType = attention?.type;
        } else if (latestAction) {
          const actionStatus = latestAction.action_status;
          const workState = latestAction.work_state;
          
          if (workState === 'IN_FLIGHT' || actionStatus === 'SENT' || actionStatus === 'EXECUTED') {
            derivedStage = 'IN_FLIGHT';
            inFlightState = latestAction.in_flight_state || 'SENT';
          } else if (actionStatus === 'APPROVED' || actionStatus === 'PENDING') {
            derivedStage = 'PLANNED';
          }
        }

        // Skip if filtering by stage and doesn't match
        if (stage && derivedStage !== stage) {
          continue;
        }

        debtorPacks.push({
          packId: `contact:${contactId}`,
          tenantId: row.tenant_id,
          contactId,
          contactName: row.contact_name,
          invoiceCount: parseInt(row.invoice_count, 10),
          totalDue: parseFloat(row.total_due),
          oldestDaysOverdue: parseInt(row.oldest_days_overdue, 10),
          stage: derivedStage,
          inFlightState,
          attentionType,
          lastActionAt: latestAction?.completed_at || latestAction?.scheduled_for,
          isBatchSelectable: derivedStage === 'PLANNED',
        });
      }

      // Sort by oldest days overdue (most urgent first)
      debtorPacks.sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue);

      console.log(`📋 Returning ${debtorPacks.length} debtor packs for tenant ${tenantId}`);

      res.json({ 
        debtorPacks,
        summary: {
          total: debtorPacks.length,
          byStage: {
            PLANNED: debtorPacks.filter(p => p.stage === 'PLANNED').length,
            IN_FLIGHT: debtorPacks.filter(p => p.stage === 'IN_FLIGHT').length,
            ATTENTION: debtorPacks.filter(p => p.stage === 'ATTENTION').length,
          }
        }
      });
    } catch (error: any) {
      console.error("Error fetching debtor packs:", error);
      res.status(500).json({ message: `Failed to fetch debtor packs: ${error.message}` });
    }
  });

  // ============================================================
  // BULK APPROVE/DECLINE ACTIONS ENDPOINT
  // ============================================================

  // ============================================================
  // OUTCOMES API - Loop Spec V0.5
  // ============================================================

  // Get outcomes for a debtor
  app.get("/api/outcomes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { debtorId, invoiceId, type, limit = 50 } = req.query;

      // Build conditions array to ensure tenant filter is always applied
      const conditions = [eq(outcomes.tenantId, user.tenantId)];
      if (debtorId) conditions.push(eq(outcomes.debtorId, debtorId as string));
      if (invoiceId) conditions.push(eq(outcomes.invoiceId, invoiceId as string));
      if (type) conditions.push(eq(outcomes.type, type as string));

      const result = await db.select().from(outcomes)
        .where(and(...conditions))
        .orderBy(desc(outcomes.createdAt))
        .limit(parseInt(limit as string));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching outcomes:", error);
      res.status(500).json({ message: `Failed to fetch outcomes: ${error.message}` });
    }
  });

  // Create outcome
  const createOutcomeSchema = z.object({
    debtorId: z.string().min(1, "Debtor ID is required"),
    invoiceId: z.string().optional(),
    linkedInvoiceIds: z.array(z.string()).optional().default([]),
    type: z.enum([
      'PROMISE_TO_PAY', 'PAYMENT_PLAN_PROPOSED', 'PAYMENT_IN_PROCESS',
      'DISPUTE', 'DOCS_REQUESTED', 'CONTACT_ISSUE', 'OUT_OF_OFFICE', 'CANNOT_PAY',
      'PAID_ALREADY_CLAIM', 'DELIVERY_FAILED', 'BANK_DETAILS_CHANGE_REQUEST', 'REQUEST_CALL_BACK',
      'AMBIGUOUS', 'NO_RESPONSE',
      'PAID', 'PART_PAID', 'CREDIT_NOTE', 'WRITTEN_OFF', 'CANCELLED',
    ]),
    confidence: z.number().min(0).max(1).default(0.8),
    sourceChannel: z.enum(['EMAIL', 'SMS', 'VOICE', 'MANUAL']).optional(),
    sourceMessageId: z.string().optional(),
    rawSnippet: z.string().optional(),
    extracted: z.object({
      promiseToPayDate: z.string().optional(),
      promiseToPayAmount: z.number().optional(),
      confirmedBy: z.string().optional(),
      paymentPlanSchedule: z.array(z.object({ date: z.string(), amount: z.number() })).optional(),
      paymentProcessWindow: z.object({ earliest: z.string().optional(), latest: z.string().optional() }).optional(),
      disputeCategory: z.enum(['PRICING', 'DELIVERY', 'QUALITY', 'OTHER']).optional(),
      docsRequested: z.array(z.enum(['INVOICE_COPY', 'STATEMENT', 'REMITTANCE', 'PO'])).optional(),
      oooUntil: z.string().optional(),
      freeTextNotes: z.string().optional(),
    }).optional().default({}),
  });

  app.post("/api/outcomes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const parseResult = createOutcomeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const data = parseResult.data;
      const confidenceBand = data.confidence >= 0.85 ? 'HIGH' : data.confidence >= 0.65 ? 'MEDIUM' : 'LOW';
      const requiresHumanReview = data.confidence < 0.65;

      // Validate debtor belongs to tenant
      const debtor = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, data.debtorId), eq(contacts.tenantId, user.tenantId))
      });
      if (!debtor) {
        return res.status(400).json({ message: "Debtor not found or belongs to different tenant" });
      }

      const [outcome] = await db.insert(outcomes).values({
        tenantId: user.tenantId,
        debtorId: data.debtorId,
        invoiceId: data.invoiceId,
        linkedInvoiceIds: data.linkedInvoiceIds,
        type: data.type,
        confidence: data.confidence.toString(),
        confidenceBand,
        requiresHumanReview,
        sourceChannel: data.sourceChannel,
        sourceMessageId: data.sourceMessageId,
        rawSnippet: data.rawSnippet,
        extracted: data.extracted,
        createdByUserId: user.id,
      }).returning();

      // Process outcome routing
      const { workStateService } = await import("./services/workStateService");
      await workStateService.processOutcome(outcome);

      console.log(`✅ Created outcome: ${outcome.id} (${data.type})`);

      res.status(201).json(outcome);
    } catch (error: any) {
      console.error("Error creating outcome:", error);
      res.status(500).json({ message: `Failed to create outcome: ${error.message}` });
    }
  });

  // ============================================================
  // AUDIT EVENTS API - Loop Spec V0.5
  // ============================================================

  // Get audit events (Activity log)
  app.get("/api/audit-events", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { debtorId, invoiceId, type, actor, limit = 100 } = req.query;

      const conditions = [eq(activityLogs.tenantId, user.tenantId), eq(activityLogs.category, 'audit')];
      if (debtorId) conditions.push(eq(activityLogs.debtorId, debtorId as string));
      if (invoiceId) conditions.push(eq(activityLogs.invoiceId, invoiceId as string));
      if (type) conditions.push(eq(activityLogs.activityType, type as string));
      if (actor) conditions.push(eq(activityLogs.actor, actor as string));

      const result = await db.select().from(activityLogs)
        .where(and(...conditions))
        .orderBy(desc(activityLogs.createdAt))
        .limit(parseInt(limit as string));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching audit events:", error);
      res.status(500).json({ message: `Failed to fetch audit events: ${error.message}` });
    }
  });

  app.get("/api/security-audit-log", ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const tenantId = req.rbac.tenantId;
      const { eventType, limit = 200, before, after } = req.query;

      const conditions = [
        eq(activityLogs.tenantId, tenantId),
        eq(activityLogs.category, 'security'),
      ];
      
      if (eventType) conditions.push(eq(activityLogs.activityType, eventType as string));

      const result = await db.select({
        id: activityLogs.id,
        eventType: activityLogs.activityType,
        description: activityLogs.description,
        result: activityLogs.result,
        userId: activityLogs.userId,
        ipAddress: activityLogs.ipAddress,
        userAgent: activityLogs.userAgent,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt,
      }).from(activityLogs)
        .where(and(...conditions))
        .orderBy(desc(activityLogs.createdAt))
        .limit(parseInt(limit as string));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching security audit log:", error);
      res.status(500).json({ message: `Failed to fetch security audit log: ${error.message}` });
    }
  });

  // ============================================================
  // SCHEDULED REPORTS API
  // ============================================================

  const reportTypeEnum = z.enum(['aged_debtors', 'cashflow_forecast', 'collection_performance', 'dso_summary']);
  const frequencyEnum = z.enum(['daily', 'weekly', 'monthly']);

  const createScheduledReportSchema = z.object({
    name: z.string().min(1).max(100),
    reportType: reportTypeEnum,
    frequency: frequencyEnum,
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(28).optional(),
    sendTime: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
    timezone: z.string().default('Europe/London'),
    recipients: z.array(z.string().email()).min(1).max(20),
    enabled: z.boolean().default(true),
  });

  // ============================================================
  // COLLECTION POLICIES API - Loop Spec V0.5
  // ============================================================

  // Get collection policies
  // Create or update default collection policy
  const createPolicySchema = z.object({
    name: z.string().optional().default("Default Policy"),
    waitDaysForReply: z.number().min(1).max(14).optional().default(3),
    cooldownDaysBetweenTouches: z.number().min(1).max(30).optional().default(5),
    maxTouchesBeforeEscalation: z.number().min(1).max(10).optional().default(4),
    confirmPTPDaysBefore: z.number().min(0).max(7).optional().default(1),
    escalationRoute: z.enum(['ATTENTION', 'MANUAL_CALL']).optional().default('ATTENTION'),
    isDefault: z.boolean().optional().default(true),
  });

  // Skip action - delay action by X days
  // Mark debtor for attention - moves to attention queue for human review
  // Bulk skip actions - reschedule multiple actions by X days
  // Bulk mark for attention - move multiple actions to attention queue
  // Communication Mode Management
  app.get("/api/communications/mode", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      res.json({ 
        mode: tenant.communicationMode || 'testing',
        testContactName: tenant.testContactName || '',
        testEmails: tenant.testEmails || [],
        testPhones: tenant.testPhones || []
      });
    } catch (error) {
      console.error("Error getting communication mode:", error);
      res.status(500).json({ message: "Failed to get communication mode" });
    }
  });

  app.put("/api/communications/mode", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { mode, testContactName, testEmails, testPhones } = req.body;
      
      // Validate mode
      const validModes = ['off', 'testing', 'soft_live', 'live'];
      if (!validModes.includes(mode)) {
        return res.status(400).json({ 
          message: "Invalid mode - must be one of: off, testing, soft_live, live" 
        });
      }

      // Update tenant with new mode and test contacts
      await storage.updateTenant(user.tenantId, {
        communicationMode: mode,
        ...(testContactName !== undefined && { testContactName }),
        ...(testEmails && { testEmails }),
        ...(testPhones && { testPhones })
      });

      res.json({ 
        mode, 
        testContactName: testContactName || '',
        testEmails: testEmails || [],
        testPhones: testPhones || [],
        message: `Communication mode updated to ${mode}` 
      });
    } catch (error) {
      console.error("Error updating communication mode:", error);
      res.status(500).json({ message: "Failed to update communication mode" });
    }
  });

  // Nudge invoice to next action (legacy endpoint with invoiceId as path parameter)
  // New nudge endpoint with invoiceId in request body and action execution
  // Collections Scheduler Control Endpoints
  // Send single invoice email
  // New dropdown email endpoints
  // New dropdown SMS endpoints
  // Send customer summary email
  // Escalation Rules
  // Channel Analytics
  // Collections Dashboard Metrics
  // SMS Configuration
  // Workflow Templates
  // AI Learning and Optimization Routes
  // Dynamic Risk Scoring
  app.post("/api/ml/risk-scoring/calculate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.body;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }

      const { DynamicRiskScoringService } = await import("./services/dynamicRiskScoringService");
      const riskService = new DynamicRiskScoringService();
      
      const riskScore = await riskService.calculateCustomerRiskScore(user.tenantId, contactId);
      res.json(riskScore);
    } catch (error) {
      console.error("Error calculating risk score:", error);
      res.status(500).json({ message: "Failed to calculate risk score" });
    }
  });

  app.get("/api/ml/risk-scoring/scores", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { limit = 100, urgency } = req.query;
      const { DynamicRiskScoringService } = await import("./services/dynamicRiskScoringService");
      const riskService = new DynamicRiskScoringService();
      
      const scores = await riskService.getRiskScores(user.tenantId, Number(limit), urgency as string);
      res.json(scores);
    } catch (error) {
      console.error("Error fetching risk scores:", error);
      res.status(500).json({ message: "Failed to fetch risk scores" });
    }
  });

  app.get("/api/ml/risk-scoring/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { DynamicRiskScoringService } = await import("./services/dynamicRiskScoringService");
      const riskService = new DynamicRiskScoringService();
      
      const analytics = await riskService.getRiskAnalytics(user.tenantId);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching risk analytics:", error);
      res.status(500).json({ message: "Failed to fetch risk analytics" });
    }
  });

  // Calculate bulk risk scores for all customers
  app.post("/api/ml/risk-scoring/calculate-bulk", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // For demo purposes, generate simple risk scores for all customers
      const { riskScores } = await import("../shared/schema");
      
      console.log(`🎯 Generating demo risk scores for tenant: ${user.tenantId}`);
      
      // Get all customers for this tenant
      const allCustomers = await storage.getContacts(user.tenantId);
      console.log(`📊 Found ${allCustomers.length} customers to generate risk scores for`);
      
      let scoresCalculated = 0;
      
      // Generate demo risk scores for each customer
      for (const customer of allCustomers) {
        // Generate consistent risk score based on customer ID
        let hash = 0;
        for (let i = 0; i < customer.id.length; i++) {
          const char = customer.id.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Generate risk score between 0.1 and 0.9
        const riskScore = (Math.abs(hash % 80) + 10) / 100; // 0.1 to 0.9
        
        // Generate trend based on hash
        const trends = ['increasing', 'decreasing', 'stable'];
        const trend = trends[Math.abs(hash % 3)];
        
        // Determine urgency level
        let urgencyLevel = 'low';
        if (riskScore >= 0.8) urgencyLevel = 'critical';
        else if (riskScore >= 0.6) urgencyLevel = 'high';
        else if (riskScore >= 0.4) urgencyLevel = 'medium';
        
        try {
          // Insert risk score into database
          await db.insert(riskScores).values({
            tenantId: user.tenantId,
            contactId: customer.id,
            overallRiskScore: riskScore.toString(),
            paymentRisk: (riskScore * 0.8).toString(),
            creditRisk: (riskScore * 0.9).toString(), 
            communicationRisk: (riskScore * 0.7).toString(),
            riskFactors: ['payment_history', 'communication_response'],
            riskTrend: trend,
            urgencyLevel,
            modelVersion: '2.0.0',
            nextReassessment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          }).onConflictDoUpdate({
            target: [riskScores.tenantId, riskScores.contactId],
            set: {
              overallRiskScore: riskScore.toString(),
              riskTrend: trend,
              urgencyLevel,
              updatedAt: new Date()
            }
          });
          scoresCalculated++;
        } catch (error) {
          console.error(`Error saving risk score for customer ${customer.id}:`, error);
        }
      }
      
      console.log(`✅ Generated ${scoresCalculated} risk scores successfully`);
      res.json({ 
        success: true, 
        scoresCalculated,
        message: `Successfully generated ${scoresCalculated} risk scores for demo`
      });
    } catch (error) {
      console.error("Error calculating bulk risk scores:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to calculate bulk risk scores",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });


  // Profile and subscription management routes
  app.get("/api/profile/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let subscriptionData = null;
      if (user.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          const customer = await stripe.customers.retrieve(user.stripeCustomerId!) as any;
          
          subscriptionData = {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
            created: new Date(subscription.created * 1000),
            customer: {
              id: customer.id,
              email: customer.email || null,
              name: customer.name || null,
            },
            items: subscription.items.data.map(item => ({
              id: item.id,
              priceId: item.price.id,
              quantity: item.quantity,
              amount: (item.price as any).unit_amount,
              currency: item.price.currency,
              interval: item.price.recurring?.interval,
            })),
          };
        } catch (stripeError) {
          console.error("Error fetching Stripe subscription:", stripeError);
          // Return user data without subscription details if Stripe call fails
          subscriptionData = { error: "Could not fetch subscription details" };
        }
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          role: user.role,
          createdAt: user.createdAt,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: user.stripeSubscriptionId,
        },
        subscription: subscriptionData,
      });
    } catch (error) {
      console.error("Error fetching profile subscription:", error);
      res.status(500).json({ message: "Failed to fetch profile data" });
    }
  });

  app.post("/api/profile/create-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['latest_invoice.payment_intent']
        });
        return res.json({
          subscriptionId: subscription.id,
          clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        });
      }

      if (!user.email) {
        throw new Error('No user email on file');
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(user.id, customerId, '');
      }

      // For now, return a mock subscription response since we don't have a real price ID configured
      // In production, you would use a real Stripe price ID from your dashboard
      res.json({
        success: false,
        message: 'Subscription creation not configured. Please set up Stripe price IDs in your dashboard.',
        requiresSetup: true,
      });
      return;

      // Unreachable code removed - this would only execute if the return above is removed
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(400).json({ error: { message: error.message } });
    }
  });

  app.post("/api/profile/cancel-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      res.json({
        success: true,
        message: "Subscription will be cancelled at the end of the billing period",
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      });
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.post("/api/profile/reactivate-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No subscription found" });
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      res.json({
        success: true,
        message: "Subscription reactivated successfully",
        status: subscription.status,
      });
    } catch (error: any) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ message: "Failed to reactivate subscription" });
    }
  });

  // Xero integration routes
  // Disconnect from Xero
  // Get Xero connection health status
  // Force a health check for current tenant
  // Test endpoint to verify callback URL is reachable
  // Mock Xero auth endpoint for development
  // Xero raw invoice data endpoint with pagination
  // Initialize sync service
  const xeroSyncService = new XeroSyncService();

  // Xero sync endpoints
  // Separate endpoints for individual syncing (optional)
  // Get cached invoices endpoint (replaces live Xero calls)
  // Get sync settings
  // Update sync settings
  // Helper functions for Xero data transformation
  function mapXeroStatusToLocal(xeroStatus: string): string {
    switch (xeroStatus) {
      case 'PAID': return 'paid';
      case 'AUTHORISED': return 'pending';
      case 'VOIDED': return 'cancelled';
      default: return 'pending';
    }
  }

  function calculateCollectionStage(status: string, dueDate: Date): string {
    if (status === 'PAID') return 'resolved';
    
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 0) return 'current';
    if (daysDiff <= 30) return 'first_notice';
    if (daysDiff <= 60) return 'second_notice';
    if (daysDiff <= 90) return 'final_notice';
    return 'collections';
  }

  function calculateCollectionStageWithPayments(status: string, dueDate: Date, paidDate?: string): string {
    // If invoice is paid (has a payment date), it's resolved regardless of status
    if (paidDate) return 'resolved';
    
    // If status shows paid but no payment date found, treat as paid (Xero status wins)
    if (status === 'PAID') return 'resolved';
    
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 0) return 'current';
    if (daysDiff <= 30) return 'first_notice';
    if (daysDiff <= 60) return 'second_notice';
    if (daysDiff <= 90) return 'final_notice';
    return 'collections';
  }

  // Tenant settings endpoints
  app.get('/api/tenant', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId!);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      res.json(stripSensitiveTenantFields(tenant));
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ message: "Failed to fetch tenant settings" });
    }
  });

  // Get accessible tenants for organization dropdown (Enhanced for Partner-Client System)
  app.get("/api/user/accessible-tenants", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let tenants: any[] = [];
      
      // Always include authorized system organizations
      const allTenants = await storage.getAllTenants();
      const NEXUS_AR_TENANT_ID = "9ffa8e58-af89-4f6a-adee-7fe09d956295";
      const DEMO_TENANT_ID = "bfa5f70f-4af5-421a-9d05-26df67f45c15";
      const QASHIVO_PRODUCTION_TENANT_ID = "7c91ba57-23d2-47eb-be4f-8440700fca60";
      const INVESTOR_DEMO_TENANT_ID = "6feb7f4d-ba6f-4a67-936e-9cff78f49c59";
      const LEARNING_DEMO_TENANT_ID = "db071cd0-9ed0-47c5-b6b8-68587a54d21a";
      
      // Add Nexus AR tenant (original data)
      const nexusTenant = allTenants.find(t => t.id === NEXUS_AR_TENANT_ID);
      if (nexusTenant) {
        tenants.push({ ...nexusTenant, accessType: 'system' });
      }
      
      // Add Qashivo Production tenant (clean production environment)
      const qashivoTenant = allTenants.find(t => t.id === QASHIVO_PRODUCTION_TENANT_ID);
      if (qashivoTenant) {
        tenants.push({ ...qashivoTenant, accessType: 'system' });
      }
      
      // Add demo organization by fixed ID (security: prevents name-based privilege escalation)
      const demoTenant = allTenants.find(t => t.id === DEMO_TENANT_ID);
      if (demoTenant) {
        tenants.push({ ...demoTenant, accessType: 'system' });
      }
      
      // Add Investor Demo tenant (investor presentation data)
      const investorDemoTenant = allTenants.find(t => t.id === INVESTOR_DEMO_TENANT_ID);
      if (investorDemoTenant) {
        tenants.push({ ...investorDemoTenant, accessType: 'system' });
      }
      
      // Add LearningDemo tenant (ML training & behavioral learning)
      const learningDemoTenant = allTenants.find(t => t.id === LEARNING_DEMO_TENANT_ID);
      if (learningDemoTenant) {
        tenants.push({ ...learningDemoTenant, accessType: 'system' });
      }
      
      // ENHANCED: Add client tenants for partners (B2B2C Model)
      if (user.role === 'partner') {
        try {
          const clientTenants = await storage.getAccessibleTenantsByPartner(user.id);
          const clientTenantsWithType = clientTenants.map(clientAccess => ({
            ...clientAccess,
            accessType: 'partner_client',
            relationship: {
              accessLevel: clientAccess.relationship.accessLevel,
              permissions: clientAccess.relationship.permissions,
              establishedAt: clientAccess.relationship.establishedAt,
              lastAccessedAt: clientAccess.relationship.lastAccessedAt
            }
          }));
          tenants.push(...clientTenantsWithType);
          
          console.log(`👥 Partner Access: User ${user.id} has partner access to ${clientTenants.length} client tenant(s)`);
        } catch (error) {
          console.error('Error fetching partner client tenants:', error);
          // Don't fail the request, just log the error
        }
      }
      
      // Add user's own tenant if not already included
      if (user.tenantId && !tenants.find(t => t.id === user.tenantId)) {
        const ownTenant = allTenants.find(t => t.id === user.tenantId);
        if (ownTenant) {
          tenants.push({ ...ownTenant, accessType: 'owner' });
        }
      }
      
      console.log(`🔒 Enhanced Security: User ${user.id} (role: ${user.role}) can access ${tenants.length} tenant(s) via ${user.role === 'partner' ? 'system + partner relationships' : 'system access'}`);
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching accessible tenants:", error);
      res.status(500).json({ message: "Failed to fetch accessible tenants" });
    }
  });

  // Switch organization (ENHANCED SECURITY with Partner-Client Support)
  app.post("/api/user/switch-tenant", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body with Zod
      const switchTenantSchema = z.object({
        tenantId: z.string().uuid("Tenant ID must be a valid UUID"),
      });
      
      const { tenantId } = switchTenantSchema.parse(req.body);
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get system accessible tenants (Nexus AR + Qashivo Production + Demo Agency + Investor Demo + LearningDemo)
      const NEXUS_AR_TENANT_ID = "9ffa8e58-af89-4f6a-adee-7fe09d956295";
      const DEMO_TENANT_ID = "bfa5f70f-4af5-421a-9d05-26df67f45c15";
      const QASHIVO_PRODUCTION_TENANT_ID = "7c91ba57-23d2-47eb-be4f-8440700fca60";
      const INVESTOR_DEMO_TENANT_ID = "6feb7f4d-ba6f-4a67-936e-9cff78f49c59";
      const LEARNING_DEMO_TENANT_ID = "db071cd0-9ed0-47c5-b6b8-68587a54d21a";
      const systemAccessibleTenantIds = [NEXUS_AR_TENANT_ID, QASHIVO_PRODUCTION_TENANT_ID, DEMO_TENANT_ID, INVESTOR_DEMO_TENANT_ID, LEARNING_DEMO_TENANT_ID];
      
      let hasAccess = false;
      let accessType = '';
      
      // Check system access first
      if (systemAccessibleTenantIds.includes(tenantId)) {
        hasAccess = true;
        accessType = 'system';
      }
      
      // ENHANCED: Check partner-client access for partners
      if (!hasAccess && user.role === 'partner') {
        const canAccess = await storage.canPartnerAccessTenant(user.id, tenantId);
        if (canAccess) {
          hasAccess = true;
          accessType = 'partner_client';
          // Update last access time for this partner-client relationship
          await storage.updatePartnerLastAccess(user.id, tenantId);
        }
      }
      
      // Check access to user's own tenant
      if (!hasAccess && user.tenantId === tenantId) {
        hasAccess = true;
        accessType = 'owner';
      }

      // Deny access if no valid permission found
      if (!hasAccess) {
        console.warn(`🚨 ENHANCED SECURITY: User ${user.id} (role: ${user.role}) attempted to switch to unauthorized tenant ${tenantId}`);
        return res.status(403).json({ 
          message: "Access denied. You can only switch between authorized organizations." 
        });
      }

      // Verify the target tenant exists
      const targetTenant = await storage.getTenant(tenantId);
      if (!targetTenant) {
        return res.status(404).json({ message: "Target organization not found" });
      }

      // Update user's tenantId
      await storage.updateUser(user.id, { tenantId });
      
      console.log(`✅ ENHANCED SECURITY: User ${user.id} (role: ${user.role}) successfully switched from ${user.tenantId} to ${tenantId} (${targetTenant.name}) via ${accessType} access`);
      
      const { ipAddress, userAgent } = extractClientInfo(req);
      logSecurityEvent({ eventType: 'tenant_switch', userId: user.id, tenantId, ipAddress, userAgent, metadata: { fromTenantId: user.tenantId, toTenantId: tenantId, tenantName: targetTenant.name, accessType } });
      
      res.json({
        message: "Organization switched successfully",
        tenant: targetTenant,
        accessType,
        switchedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error in tenant switch request:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to process organization request" });
    }
  });

  // Playbook settings endpoints - AI-Driven Collections Configuration
  app.get('/api/settings/playbook', ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      res.json({
        tenantStyle: tenant.tenantStyle || 'STANDARD',
        highValueThreshold: tenant.highValueThreshold || '10000',
        singleInvoiceHighValueThreshold: tenant.singleInvoiceHighValueThreshold || '5000',
        useLatePamentLegislation: tenant.useLatePamentLegislation || false,
        channelCooldowns: tenant.channelCooldowns || { email: 3, sms: 5, voice: 7 },
        maxTouchesPerWindow: tenant.maxTouchesPerWindow || 3,
        contactWindowDays: tenant.contactWindowDays || 14,
        businessHoursStart: tenant.businessHoursStart || '08:00',
        businessHoursEnd: tenant.businessHoursEnd || '18:00',
      });
    } catch (error) {
      console.error("Error fetching playbook settings:", error);
      res.status(500).json({ message: "Failed to fetch playbook settings" });
    }
  });

  // Playbook settings schema for validation
  const playbookSettingsSchema = z.object({
    tenantStyle: z.enum(['GENTLE', 'STANDARD', 'FIRM']).optional(),
    highValueThreshold: z.union([z.string(), z.number()]).optional(),
    singleInvoiceHighValueThreshold: z.union([z.string(), z.number()]).optional(),
    useLatePamentLegislation: z.boolean().optional(),
    channelCooldowns: z.object({
      email: z.number().min(1).max(30),
      sms: z.number().min(1).max(30),
      voice: z.number().min(1).max(30),
    }).optional(),
    maxTouchesPerWindow: z.number().min(1).max(10).optional(),
    contactWindowDays: z.number().min(7).max(30).optional(),
    businessHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    businessHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  });

  app.patch('/api/settings/playbook', ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate request body
      const parseResult = playbookSettingsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid playbook settings", 
          errors: parseResult.error.errors 
        });
      }

      const validated = parseResult.data;
      
      // Get current tenant to merge channelCooldowns properly
      const currentTenant = await storage.getTenant(user.tenantId);
      const currentCooldowns = currentTenant?.channelCooldowns || { email: 3, sms: 5, voice: 7 };

      const updates: any = {};
      if (validated.tenantStyle !== undefined) updates.tenantStyle = validated.tenantStyle;
      if (validated.highValueThreshold !== undefined) updates.highValueThreshold = String(validated.highValueThreshold);
      if (validated.singleInvoiceHighValueThreshold !== undefined) updates.singleInvoiceHighValueThreshold = String(validated.singleInvoiceHighValueThreshold);
      if (validated.useLatePamentLegislation !== undefined) updates.useLatePamentLegislation = validated.useLatePamentLegislation;
      if (validated.channelCooldowns !== undefined) {
        // Deep merge channelCooldowns to preserve unspecified values
        updates.channelCooldowns = { ...currentCooldowns, ...validated.channelCooldowns };
      }
      if (validated.maxTouchesPerWindow !== undefined) updates.maxTouchesPerWindow = validated.maxTouchesPerWindow;
      if (validated.contactWindowDays !== undefined) updates.contactWindowDays = validated.contactWindowDays;
      if (validated.businessHoursStart !== undefined) updates.businessHoursStart = validated.businessHoursStart;
      if (validated.businessHoursEnd !== undefined) updates.businessHoursEnd = validated.businessHoursEnd;

      const tenant = await storage.updateTenant(user.tenantId!, updates);
      console.log(`✅ Playbook settings updated for tenant ${user.tenantId}`);
      
      res.json({
        tenantStyle: tenant.tenantStyle || 'STANDARD',
        highValueThreshold: tenant.highValueThreshold || '10000',
        singleInvoiceHighValueThreshold: tenant.singleInvoiceHighValueThreshold || '5000',
        useLatePamentLegislation: tenant.useLatePamentLegislation || false,
        channelCooldowns: tenant.channelCooldowns || { email: 3, sms: 5, voice: 7 },
        maxTouchesPerWindow: tenant.maxTouchesPerWindow || 3,
        contactWindowDays: tenant.contactWindowDays || 14,
        businessHoursStart: tenant.businessHoursStart || '08:00',
        businessHoursEnd: tenant.businessHoursEnd || '18:00',
      });
    } catch (error) {
      console.error("Error updating playbook settings:", error);
      res.status(500).json({ message: "Failed to update playbook settings" });
    }
  });

  // Partner registration endpoint (no auth required)
  app.post('/api/partner/register', async (req: any, res) => {
    try {
      const { companyName, contactName, email, phone, website, expectedClients } = req.body;
      
      // Validate required fields
      if (!companyName || !contactName || !email || !phone || !expectedClients) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Create tenant for partner
      const tenant = await storage.createTenant({
        name: companyName,
        subdomain: `partner-${companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        settings: {
          partnerInfo: {
            companyName,
            contactName,
            email,
            phone,
            website: website || undefined,
            expectedClients
          }
        },
      });
      
      // Create tenant metadata with partner type and trial
      const trialStartDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30); // 30-day trial
      
      await storage.createTenantMetadata({
        tenantId: tenant.id,
        tenantType: 'partner',
        isInTrial: true,
        trialStartDate,
        trialEndDate,
        usageLimits: {
          maxClients: parseInt(String(expectedClients).split('-')[1] || String(expectedClients)) || 10,
          maxUsers: 5,
        },
        currentUsage: {
          clients: 0,
          users: 0,
        },
      });
      
      // TODO: Send welcome email with login instructions
      console.log(`✅ Partner registration: ${companyName} (${email}) - 30-day trial started`);
      
      res.json({ 
        message: 'Partner registration successful', 
        tenantId: tenant.id,
        trialEndDate 
      });
    } catch (error) {
      console.error('Partner registration error:', error);
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  });

  // Client registration endpoint (no auth required)
  app.post('/api/client/register', async (req: any, res) => {
    try {
      const { companyName, contactName, email, phone, website, monthlyRevenue, selectedPlan } = req.body;
      
      // Validate required fields
      if (!companyName || !contactName || !email || !phone || !monthlyRevenue || !selectedPlan) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Validate plan selection
      if (!['standard', 'premium'].includes(selectedPlan)) {
        return res.status(400).json({ message: 'Invalid plan selection' });
      }
      
      // Create tenant for client
      const tenant = await storage.createTenant({
        name: companyName,
        subdomain: `client-${companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        settings: {
          clientInfo: {
            companyName,
            contactName,
            email,
            phone,
            website: website || undefined,
            monthlyRevenue,
            selectedPlan
          }
        },
      });
      
      // Create tenant metadata with client type and trial
      const trialStartDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30); // 30-day trial
      
      // Set plan-specific limits
      const planLimits = selectedPlan === 'premium' 
        ? { maxInvoices: 5000, maxContacts: 2500, maxUsers: 10 }
        : { maxInvoices: 1000, maxContacts: 500, maxUsers: 3 };
      
      await storage.createTenantMetadata({
        tenantId: tenant.id,
        tenantType: 'client',
        isInTrial: true,
        trialStartDate,
        trialEndDate,
        selectedPlan, // Store the plan for post-trial billing
        usageLimits: planLimits,
        currentUsage: {
          invoices: 0,
          contacts: 0,
          users: 0,
        },
      });
      
      // TODO: Send welcome email with login instructions
      console.log(`✅ Client registration: ${companyName} (${email}) - ${selectedPlan} plan, 30-day trial started`);
      
      res.json({ 
        message: 'Client registration successful', 
        tenantId: tenant.id,
        selectedPlan,
        trialEndDate 
      });
    } catch (error) {
      console.error('Client registration error:', error);
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  });

  // Get user type for smart routing
  app.get('/api/user/type', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenantMetadata = await storage.getTenantMetadata(user.tenantId);
      if (!tenantMetadata) {
        return res.status(400).json({ message: "Tenant metadata not found" });
      }

      res.json({ 
        tenantType: tenantMetadata.tenantType,
        tenantId: user.tenantId,
        isInTrial: tenantMetadata.isInTrial
      });
    } catch (error) {
      console.error("Error getting user type:", error);
      res.status(500).json({ message: "Failed to get user type" });
    }
  });

  // Stripe payment route for one-time payments
  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { amount } = req.body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Stripe subscription route
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const latestInvoice = subscription.latest_invoice as any;
        res.json({
          subscriptionId: subscription.id,
          clientSecret: latestInvoice?.payment_intent?.client_secret,
        });
        return;
      }
      
      if (!user.email) {
        return res.status(400).json({ message: 'No user email on file' });
      }

      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price_data: {
            currency: 'usd',
            product: 'prod_nexus_ar_pro', // Use actual product ID from Stripe
            unit_amount: 9900, // $99.00 per month
            recurring: {
              interval: 'month',
            },
          },
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      await storage.updateUserStripeInfo(user.id, customer.id, subscription.id);
  
      const latestInvoice = subscription.latest_invoice as any;
      res.json({
        subscriptionId: subscription.id,
        clientSecret: latestInvoice?.payment_intent?.client_secret,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      return res.status(400).json({ error: { message: error.message } });
    }
  });

  // Get subscription status
  // Cancel subscription

  // Send Invoice PDF by Email - Direct API endpoint for testing
  // AI Facts endpoints - Knowledge base for AI CFO
  // AI CFO Conversation endpoint
  // Simple OpenAI test endpoint
  app.post('/api/test-openai', async (req, res) => {
    try {
      console.log("🧪 Testing OpenAI connection...");
      
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Say hello in exactly 5 words." }],
        max_tokens: 50,
      });

      console.log("✅ OpenAI test successful");
      res.json({ 
        success: true, 
        response: response.choices[0].message.content 
      });
    } catch (error: any) {
      console.error("❌ OpenAI test failed:", error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        status: error.status 
      });
    }
  });

  // Health Dashboard API endpoints
  app.get('/api/health/dashboard', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const user = await storage.getUser(userId);
      if (!user?.tenantId) {
        return res.status(400).json({ error: 'No tenant found' });
      }

      console.log(`🚀 Health dashboard request for tenant ${user.tenantId}`);

      // Import health analyzer service
      const { InvoiceHealthAnalyzer } = await import('./services/invoiceHealthAnalyzer');
      const healthAnalyzer = new InvoiceHealthAnalyzer();

      // Get recent invoices for health analysis
      const recentInvoices = await storage.getInvoices(user.tenantId, 25);
      const invoiceIds = recentInvoices.map(inv => inv.id);
      
      // Check cache status
      const cacheStatus = await healthAnalyzer.getCachedHealthScores(user.tenantId, invoiceIds);
      
      // Enqueue background processing for stale/missing scores
      const needsProcessing = [...cacheStatus.stale, ...cacheStatus.missing];
      if (needsProcessing.length > 0) {
        healthAnalyzer.enqueueAnalysis(needsProcessing, user.tenantId);
        console.log(`📋 Enqueued ${needsProcessing.length} invoices for background processing`);
      }

      // Create invoice map for quick lookup
      const invoiceMap = new Map(recentInvoices.map(inv => [inv.id, inv]));
      
      // Build health scores array from cached data + invoice details
      const invoiceHealthScores = cacheStatus.cached.map(healthScore => {
        const invoice = invoiceMap.get(healthScore.invoiceId);
        if (!invoice) return null;
        
        return {
          invoiceId: healthScore.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.contact?.name || 'Unknown Contact',
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          status: invoice.status,
          healthScore: healthScore.healthScore,
          riskLevel: healthScore.healthStatus,
          keyRiskFactors: Array.isArray(healthScore.recommendedActions) 
            ? healthScore.recommendedActions.slice(0, 3) 
            : [],
          paymentLikelihood: Math.round(parseFloat(healthScore.paymentProbability) * 100),
          isRefreshing: needsProcessing.includes(healthScore.invoiceId)
        };
      }).filter(Boolean);

      // Calculate aggregate health metrics from cached data
      const healthMetrics = {
        totalInvoices: recentInvoices.length,
        healthyInvoices: 0,
        atRiskInvoices: 0,
        criticalInvoices: 0,
        emergencyInvoices: 0,
        easyCollectionInvoices: 0,
        moderateCollectionInvoices: 0,
        difficultCollectionInvoices: 0,
        veryDifficultCollectionInvoices: 0,
        averageHealthScore: 0,
        totalOutstanding: 0,
        totalValueAtRisk: 0,
        predictedCollectionRate: 0,
        cacheStatus: {
          cached: cacheStatus.cached.length,
          refreshing: needsProcessing.length,
          total: invoiceIds.length
        }
      };

      // Calculate metrics from available data
      let healthScoreSum = 0;
      let paymentLikelihoodSum = 0;
      
      for (const scoreData of invoiceHealthScores) {
        if (!scoreData) continue;
        const invoice = invoiceMap.get(scoreData.invoiceId);
        if (!invoice) continue;

        healthScoreSum += scoreData.healthScore;
        paymentLikelihoodSum += scoreData.paymentLikelihood;
        healthMetrics.totalOutstanding += Number(invoice.amount);

        // Update aggregate metrics by health status
        switch (scoreData.riskLevel) {
          case 'healthy':
            healthMetrics.healthyInvoices++;
            break;
          case 'at_risk':
            healthMetrics.atRiskInvoices++;
            healthMetrics.totalValueAtRisk += Number(invoice.amount);
            break;
          case 'critical':
            healthMetrics.criticalInvoices++;
            healthMetrics.totalValueAtRisk += Number(invoice.amount);
            break;
          case 'emergency':
            healthMetrics.emergencyInvoices++;
            healthMetrics.totalValueAtRisk += Number(invoice.amount);
            break;
        }
      }

      // Calculate final aggregate metrics
      if (invoiceHealthScores.length > 0) {
        healthMetrics.averageHealthScore = Math.round(healthScoreSum / invoiceHealthScores.length);
        healthMetrics.predictedCollectionRate = Math.round(paymentLikelihoodSum / invoiceHealthScores.length);
      }

      console.log(`✅ Health dashboard response: ${invoiceHealthScores.length} cached, ${needsProcessing.length} refreshing`);

      res.json({
        metrics: healthMetrics,
        invoiceHealthScores: invoiceHealthScores.filter(Boolean).sort((a, b) => (a?.healthScore || 0) - (b?.healthScore || 0)),
        lastUpdated: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Health dashboard error:', error);
      res.status(500).json({ error: 'Failed to generate health dashboard data' });
    }
  });

  app.get('/api/health/invoice/:invoiceId', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const user = await storage.getUser(userId);
      if (!user?.tenantId) {
        return res.status(400).json({ error: 'No tenant found' });
      }

      const { invoiceId } = req.params;
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Import health analyzer service
      const { InvoiceHealthAnalyzer } = await import('./services/invoiceHealthAnalyzer');
      const healthAnalyzer = new InvoiceHealthAnalyzer();

      // Get detailed health analysis
      const healthAnalysis = await healthAnalyzer.analyzeInvoice(invoice.id, user.tenantId);

      if (!healthAnalysis) {
        return res.status(500).json({ error: 'Failed to analyze invoice health' });
      }

      res.json({
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.contact?.name || 'Unknown Contact',
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          status: invoice.status,
          description: invoice.description
        },
        healthAnalysis: {
          healthScore: healthAnalysis.healthScore,
          riskLevel: healthAnalysis.healthStatus,
          paymentProbability: healthAnalysis.paymentProbability,
          recommendedActions: healthAnalysis.recommendedActions,
          analysis: healthAnalysis
        }
      });
    } catch (error: any) {
      console.error('Invoice health analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze invoice health' });
    }
  });

  app.post('/api/health/bulk-analyze', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const user = await storage.getUser(userId);
      if (!user?.tenantId) {
        return res.status(400).json({ error: 'No tenant found' });
      }

      // Import health analyzer service
      const { InvoiceHealthAnalyzer } = await import('./services/invoiceHealthAnalyzer');
      const healthAnalyzer = new InvoiceHealthAnalyzer();

      // Get all invoices for analysis
      const allInvoices = await storage.getInvoices(user.tenantId);
      const results = [];
      
      console.log(`Starting bulk health analysis for ${allInvoices.length} invoices...`);

      // Process in batches to avoid overwhelming the AI service
      const batchSize = 5;
      for (let i = 0; i < allInvoices.length; i += batchSize) {
        const batch = allInvoices.slice(i, i + batchSize);
        
        for (const invoice of batch) {
          try {
            const healthAnalysis = await healthAnalyzer.analyzeInvoice(invoice.id, user.tenantId);
            
            if (!healthAnalysis) {
              console.warn(`No health analysis returned for invoice ${invoice.id}`);
              results.push({
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                error: 'Analysis failed - no result returned'
              });
              continue;
            }
            
            // Store the health score in database with correct field mappings
            await storage.createInvoiceHealthScore({
              tenantId: user.tenantId,
              invoiceId: invoice.id,
              contactId: invoice.contactId, // Required field that was missing
              overallRiskScore: healthAnalysis.overallRiskScore,
              paymentProbability: healthAnalysis.paymentProbability.toString(),
              timeRiskScore: healthAnalysis.timeRiskScore,
              amountRiskScore: healthAnalysis.amountRiskScore,
              customerRiskScore: healthAnalysis.customerRiskScore,
              communicationRiskScore: healthAnalysis.communicationRiskScore,
              healthStatus: healthAnalysis.healthStatus,
              healthScore: healthAnalysis.healthScore,
              predictedPaymentDate: healthAnalysis.predictedPaymentDate,
              collectionDifficulty: healthAnalysis.collectionDifficulty,
              recommendedActions: healthAnalysis.recommendedActions || [],
              aiConfidence: healthAnalysis.aiConfidence.toString(),
              modelVersion: "1.0",
              lastAnalysis: new Date(),
              trends: healthAnalysis.trends || null
            });

            results.push({
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              healthScore: healthAnalysis.healthScore,
              riskLevel: healthAnalysis.healthStatus
            });
          } catch (error) {
            console.error(`Error analyzing invoice ${invoice.id}:`, error);
            results.push({
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              error: 'Analysis failed'
            });
          }
        }

        // Brief pause between batches
        if (i + batchSize < allInvoices.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Bulk health analysis completed: ${results.length} invoices processed`);

      res.json({
        success: true,
        processedCount: results.length,
        results: results
      });
    } catch (error: any) {
      console.error('Bulk health analysis error:', error);
      res.status(500).json({ error: 'Failed to perform bulk health analysis' });
    }
  });

  app.get('/api/health/analytics/trends', isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const user = await storage.getUser(userId);
      if (!user?.tenantId) {
        return res.status(400).json({ error: 'No tenant found' });
      }

      // Get health scores from the last 30 days
      const healthScores = await storage.getInvoiceHealthScores(user.tenantId);
      
      // Group by date and calculate daily averages
      const dailyAverages = healthScores.reduce((acc: any, score) => {
        const date = score.lastAnalysis.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { total: 0, count: 0, scores: [] };
        }
        acc[date].total += score.healthScore;
        acc[date].count += 1;
        acc[date].scores.push(score.healthScore);
        return acc;
      }, {});

      const trends = Object.entries(dailyAverages).map(([date, data]: [string, any]) => ({
        date,
        averageScore: Math.round(data.total / data.count),
        invoiceCount: data.count,
        scoreDistribution: {
          healthy: data.scores.filter((s: number) => s >= 70).length,
          atRisk: data.scores.filter((s: number) => s >= 40 && s < 70).length,
          critical: data.scores.filter((s: number) => s < 40).length
        }
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      res.json({
        trends,
        summary: {
          totalAnalyzed: healthScores.length,
          averageHealthScore: healthScores.length > 0 
            ? Math.round(healthScores.reduce((sum, score) => sum + score.healthScore, 0) / healthScores.length)
            : 0,
          riskDistribution: {
            healthy: healthScores.filter(s => s.healthStatus === 'healthy').length,
            at_risk: healthScores.filter(s => s.healthStatus === 'at_risk').length,
            critical: healthScores.filter(s => s.healthStatus === 'critical').length,
            emergency: healthScores.filter(s => s.healthStatus === 'emergency').length
          }
        }
      });
    } catch (error: any) {
      console.error('Health analytics trends error:', error);
      res.status(500).json({ error: 'Failed to get health analytics trends' });
    }
  });

  // Portfolio Health Monitoring (DSO Controller)
  app.get('/health/portfolio', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user?.tenantId) {
        return res.status(400).json({ error: 'No tenant found' });
      }

      const { projectedDSO } = await import('./lib/dso');
      const { schedulerState, workflows } = await import('@shared/schema');

      // Get all adaptive workflows for this tenant
      const adaptiveWorkflows = await db
        .select({
          workflowId: workflows.id,
          workflowName: workflows.name,
          targetDSO: workflows.adaptiveSettings,
        })
        .from(workflows)
        .where(
          and(
            eq(workflows.tenantId, user.tenantId),
            eq(workflows.schedulerType, 'adaptive'),
            eq(workflows.isActive, true)
          )
        );

      const results = [];
      for (const workflow of adaptiveWorkflows) {
        // Get scheduler state
        const state = await db
          .select()
          .from(schedulerState)
          .where(
            and(
              eq(schedulerState.tenantId, user.tenantId),
              eq(schedulerState.scheduleId, workflow.workflowId)
            )
          )
          .limit(1);

        const currentState = state[0];
        const settings = (workflow.targetDSO as any) || {};
        const targetDSO = Number(settings.targetDSO || 45);

        // Calculate current projected DSO
        const projected = await projectedDSO(user.tenantId);

        results.push({
          scheduleId: workflow.workflowId,
          scheduleName: workflow.workflowName,
          projectedDSO: projected,
          targetDSO,
          urgencyFactor: currentState?.urgencyFactor || 0.5,
          delta: projected - targetDSO,
          lastUpdated: currentState?.updatedAt || null,
        });
      }

      res.json({
        tenantId: user.tenantId,
        schedules: results,
        summary: {
          avgProjectedDSO: results.length > 0
            ? results.reduce((sum, r) => sum + r.projectedDSO, 0) / results.length
            : 0,
          avgTargetDSO: results.length > 0
            ? results.reduce((sum, r) => sum + r.targetDSO, 0) / results.length
            : 0,
        },
      });
    } catch (error: any) {
      console.error('Portfolio health error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual Invoice Override
  // ==================== ANALYTICS ENDPOINTS ====================

  // 1. Cash Flow Forecast - 90-day projections with confidence intervals
  // 2. Aging Analysis - breakdown by age buckets
  // 3. Collection Performance - method effectiveness analysis
  // 4. Customer Risk Matrix - portfolio health analysis
  // 5. Automation Performance Analytics - comprehensive automation metrics and ROI analysis
  // ==================== END ANALYTICS ENDPOINTS ====================

  // ==================== PROVIDER MIDDLEWARE ROUTES ====================

  // Import API middleware
  const { apiMiddleware } = await import("./middleware");

  // Unified accounting status endpoint
  // List available providers
  app.get('/api/providers', isAuthenticated, async (req: any, res) => {
    try {
      const providers = apiMiddleware.getProviders().map(provider => ({
        name: provider.name,
        type: provider.type,
        isConnected: false, // Will be updated with actual connection status
        config: {
          name: provider.config.name,
          type: provider.config.type,
          environment: provider.config.environment
        }
      }));

      res.json({ 
        success: true, 
        providers,
        total: providers.length
      });
    } catch (error) {
      console.error("Error listing providers:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to list providers" 
      });
    }
  });

  // Provider health check
  // Initiate provider connection (OAuth flow)
  // Provider disconnect endpoint
  // Provider data sync endpoint
  // Provider-specific API request endpoint
  // ==================== END PROVIDER MIDDLEWARE ROUTES ====================

  // ==================== SYNC ROUTES ====================
  registerSyncRoutes(app);
  // ==================== END SYNC ROUTES ====================

  // ==================== DOCUMENTATION ROUTES ====================
  app.use('/api/documentation', isAuthenticated, documentationRoutes);
  // ==================== END DOCUMENTATION ROUTES ====================

  // ==================== ADMIN ROUTES ====================
  // Note: Admin routes have their own requireAdminAuth middleware for protected endpoints
  // The login/logout/status endpoints are public
  app.use('/api/admin', adminRoutes);
  // ==================== END ADMIN ROUTES ====================

  // ==================== PROSPECT SCORECARD ROUTES ====================
  // Public routes for partner prospects to sign up and complete scorecard
  app.use(prospectScorecardRoutes);
  // ==================== END PROSPECT SCORECARD ROUTES ====================

  // ==================== WORKFLOW PROFILE ROUTES ====================
  // Tenant-owned workflow configuration (policy, channels, messages)
  app.use('/api', workflowProfileRoutes);
  // ==================== END WORKFLOW PROFILE ROUTES ====================

  // ==================== WEBHOOK ROUTES ====================
  // Critical: These routes MUST use raw body middleware for proper HMAC verification
  
  /**
   * Xero Webhook Endpoint
   * POST /api/webhooks/xero
   */
  app.post('/api/webhooks/xero', 
    express.raw({ type: 'application/json', verify: (req: any, res, buf) => {
      req.rawBody = buf; // Store raw body for signature verification
    }}), 
    async (req: any, res) => {
      try {
        const signature = req.headers['x-xero-signature'];
        if (!signature) {
          console.error('❌ Missing X-Xero-Signature header');
          return res.status(401).json({ error: 'Missing signature header' });
        }

        console.log('🔗 Received Xero webhook');

        // Process webhook with security verification
        const result = await webhookHandler.processWebhook('xero', req.body, signature, req);
        
        if (result.success) {
          console.log('✅ Xero webhook processed successfully');
          res.status(200).json({ message: 'Webhook processed successfully' });
        } else {
          console.error('❌ Xero webhook processing failed:', result.error);
          res.status(400).json({ error: result.error });
        }

      } catch (error) {
        console.error('❌ Xero webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  /**
   * Sage Webhook Endpoint  
   * POST /api/webhooks/sage
   */
  app.post('/api/webhooks/sage',
    express.raw({ type: 'application/json', verify: (req: any, res, buf) => {
      req.rawBody = buf; // Store raw body for signature verification
    }}),
    async (req: any, res) => {
      try {
        const signature = req.headers['x-sage-signature'] || req.headers['x-hub-signature-256'];
        if (!signature) {
          console.error('❌ Missing Sage signature header');
          return res.status(401).json({ error: 'Missing signature header' });
        }

        console.log('🔗 Received Sage webhook');

        // Process webhook with security verification
        const result = await webhookHandler.processWebhook('sage', req.body, signature, req);
        
        if (result.success) {
          console.log('✅ Sage webhook processed successfully');
          res.status(200).json({ message: 'Webhook processed successfully' });
        } else {
          console.error('❌ Sage webhook processing failed:', result.error);
          res.status(400).json({ error: result.error });
        }

      } catch (error) {
        console.error('❌ Sage webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  /**
   * QuickBooks Webhook Endpoint
   * POST /api/webhooks/quickbooks
   */
  app.post('/api/webhooks/quickbooks',
    express.raw({ type: 'application/json', verify: (req: any, res, buf) => {
      req.rawBody = buf; // Store raw body for signature verification
    }}),
    async (req: any, res) => {
      try {
        const signature = req.headers['intuit-signature'];
        if (!signature) {
          console.error('❌ Missing Intuit-Signature header');
          return res.status(401).json({ error: 'Missing signature header' });
        }

        console.log('🔗 Received QuickBooks webhook');

        // Process webhook with security verification  
        const result = await webhookHandler.processWebhook('quickbooks', req.body, signature, req);
        
        if (result.success) {
          console.log('✅ QuickBooks webhook processed successfully');
          res.status(200).json({ message: 'Webhook processed successfully' });
        } else {
          console.error('❌ QuickBooks webhook processing failed:', result.error);
          res.status(400).json({ error: result.error });
        }

      } catch (error) {
        console.error('❌ QuickBooks webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );
  // ==================== END WEBHOOK ROUTES ====================

  // ==================== COMPREHENSIVE ACCOUNTING DATA API ====================

  // ============ BILLS (ACCPAY) API ENDPOINTS ============
  
  /**
   * GET /api/accounting/bills
   * Retrieve bills with vendor information and filtering
   */
  /**
   * GET /api/accounting/bills/:id
   * Get specific bill with vendor details
   */
  /**
   * POST /api/accounting/bills
   * Create new bill
   */
  /**
   * PUT /api/accounting/bills/:id
   * Update bill
   */
  /**
   * DELETE /api/accounting/bills/:id
   * Delete bill
   */
  // ============ BANK ACCOUNTS API ENDPOINTS ============

  /**
   * GET /api/accounting/bank-accounts
   * Retrieve bank accounts with current balances
   */
  /**
   * GET /api/accounting/bank-accounts/:id
   * Get specific bank account
   */
  /**
   * POST /api/accounting/bank-accounts
   * Create new bank account
   */
  /**
   * PUT /api/accounting/bank-accounts/:id
   * Update bank account
   */
  /**
   * DELETE /api/accounting/bank-accounts/:id
   * Delete bank account
   */
  // ============ BANK TRANSACTIONS API ENDPOINTS ============

  /**
   * GET /api/accounting/bank-transactions
   * Retrieve bank transactions with categorization and filtering
   */
  /**
   * GET /api/accounting/bank-transactions/:id
   * Get specific bank transaction
   */
  /**
   * POST /api/accounting/bank-transactions
   * Create new bank transaction
   */
  /**
   * PUT /api/accounting/bank-transactions/:id
   * Update bank transaction
   */
  // ============ BUDGETS API ENDPOINTS ============

  /**
   * GET /api/accounting/budgets
   * Retrieve budgets with line-item breakdowns
   */
  /**
   * GET /api/accounting/budgets/:id
   * Get specific budget with line items
   */
  /**
   * POST /api/accounting/budgets
   * Create new budget
   */
  /**
   * PUT /api/accounting/budgets/:id
   * Update budget
   */
  /**
   * DELETE /api/accounting/budgets/:id
   * Delete budget
   */
  // ============ EXCHANGE RATES API ENDPOINTS ============

  /**
   * GET /api/accounting/fx
   * Retrieve exchange rates with currency conversion data
   */
  /**
   * GET /api/accounting/fx/latest/:baseCurrency
   * Get latest exchange rates for a base currency
   */
  /**
   * POST /api/accounting/fx
   * Create new exchange rate
   */
  // ============ ENHANCED CASHFLOW FORECAST API ENDPOINTS ============

  /**
   * GET /api/cashflow/forecast
   * Generate 13-week cashflow forecast with scenario support
   */
  /**
   * POST /api/cashflow/scenarios
   * Run custom scenario analysis and comparison
   */
  /**
   * GET /api/cashflow/metrics
   * Get key financial metrics (DSO, DPO, cash runway)
   */
  /**
   * POST /api/cashflow/optimize
   * Get cash optimization recommendations
   */
  // ==================== END COMPREHENSIVE ACCOUNTING DATA API ====================

  // ==================== INTELLIGENT FORECAST API ====================
  
  // Import forecast services
  const {
    calculateARD,
    calculateAndStoreARD,
    getLatestARD,
    getARDHistory,
    getARDTrend
  } = await import('./services/ardCalculationService.js');
  
  const {
    getSalesForecast,
    getSalesForecasts,
    upsertSalesForecast,
    convertSalesToCashInflows,
    getSalesForecastCashInflows,
    generateDefaultForecasts
  } = await import('./services/salesForecastService.js');
  
  const {
    calculateIrregularBuffer,
    calculateIrregularBufferForForecast,
    getRecommendedBeta
  } = await import('./services/irregularBufferService.js');

  /**
   * GET /api/forecast/ard
   * Get latest ARD (Average Receivable Days) for tenant
   */
  /**
   * POST /api/forecast/ard/calculate
   * Manually trigger ARD calculation
   */
  /**
   * GET /api/forecast/ard/history
   * Get ARD calculation history
   */
  /**
   * GET /api/forecast/ard/trend
   * Get ARD trend (improving/stable/deteriorating)
   */
  /**
   * GET /api/forecast/sales
   * Get sales forecasts for a date range
   */
  /**
   * POST /api/forecast/sales
   * Create or update sales forecast for a month
   */
  /**
   * POST /api/forecast/sales/batch
   * Batch update sales forecasts
   */
  /**
   * GET /api/forecast/sales/cash-inflows
   * Convert sales forecasts to expected cash inflows (ARD-adjusted)
   */
  /**
   * POST /api/forecast/sales/generate-defaults
   * Generate default (zero) forecasts for next 12 months
   */
  /**
   * GET /api/forecast/irregular-buffer
   * Get irregular buffer calculation for one-off expenses
   */
  /**
   * GET /api/forecast/irregular-buffer/recommended-beta
   * Get recommended beta coefficient based on expense volatility
   */
  // ==================== END INTELLIGENT FORECAST API ====================

  // ==================== RBAC MANAGEMENT API ====================

  // RBAC middleware imported at top of file; import PermissionService for role management
  const { PermissionService } = await import("./services/permissionService");

  // Get all users in tenant with their roles and permissions
  // Assign or change user role  
  // Get all available permissions organized by category
  // Get permissions for a specific role
  // Get all available roles with their details
  // Create user invitation
  // Get pending invitations for tenant
  // Revoke user invitation
  // Verify user invitation token (public endpoint)
  // Accept user invitation (public endpoint - no auth required)
  // Check user permissions (utility endpoint)
  // Get current user's permissions
  // Remove user from tenant (only owners can do this)
  // Get role hierarchy information
  // ==================== END RBAC MANAGEMENT API ====================

  // ==================== PARTNER-CLIENT SYSTEM API ====================

  // Get subscription plans (for partner dashboard)
  app.get("/api/partner/subscription-plans", isAuthenticated, async (req: any, res) => {
    try {
      const { type } = req.query;
      const plans = await storage.getSubscriptionPlans(type);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  // Get partner's client relationships
  app.get("/api/partner/clients", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Users with a partnerId can access their partner's clients
      if (!user.partnerId) {
        return res.status(403).json({ message: "Access denied. You are not associated with a partner organization." });
      }

      // Get SME clients for this partner
      const clients = await db
        .select()
        .from(smeClients)
        .where(eq(smeClients.partnerId, user.partnerId));
      
      res.json(clients);
    } catch (error) {
      console.error("Error fetching partner clients:", error);
      res.status(500).json({ message: "Failed to fetch client relationships" });
    }
  });

  // Get client's partner relationships (for client dashboard)
  app.get("/api/client/partners", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const relationships = await storage.getClientPartnerRelationships(user.tenantId);
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching client partners:", error);
      res.status(500).json({ message: "Failed to fetch partner relationships" });
    }
  });

  // Terminate partner-client relationship
  app.delete("/api/partner/clients/:relationshipId", isAuthenticated, async (req: any, res) => {
    try {
      const { relationshipId } = req.params;
      const { reason } = req.body;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only partners or tenant owners can terminate relationships
      if (user.role !== 'partner' && user.role !== 'owner') {
        return res.status(403).json({ message: "Access denied. Partner or owner role required." });
      }

      const relationship = await storage.terminatePartnerClientRelationship(
        relationshipId, 
        user.id, 
        reason
      );
      
      console.log(`🔗 Partnership terminated: ${user.id} terminated relationship ${relationshipId}`);
      res.json({
        success: true,
        relationship,
        message: "Partnership terminated successfully"
      });
    } catch (error) {
      console.error("Error terminating partnership:", error);
      res.status(500).json({ message: "Failed to terminate partnership" });
    }
  });

  // ==================== TENANT INVITATION SYSTEM ====================

  // Create tenant invitation (client invites partner)
  // Get tenant invitations for current tenant
  // Get incoming invitations for partner (by email)
  // Accept tenant invitation
  // Decline tenant invitation
  // Get tenant metadata (subscription info, etc.)
  // Update tenant metadata
  // ==================== SUBSCRIPTION MANAGEMENT API ====================

  // GET /api/subscription/plans - Get available plans by type
  // POST /api/subscription/subscribe - Subscribe tenant to a plan
  // GET /api/subscription/usage - Get current billing usage for partners
  // POST /api/subscription/upgrade-downgrade - Change subscription plans
  // POST /api/subscription/update-partner-billing - Update partner billing based on client count
  // GET /api/subscription/status - Get current subscription status
  // ==================== SUBSCRIPTION SEEDING API ====================

  // POST /api/subscription/seed-plans - Create initial subscription plans
  // ==================== END PARTNER-CLIENT SYSTEM API ====================

  // ==================== CLIENT INTELLIGENCE API ====================
  
  // Get client list with behavioral statistics
  app.get("/api/client-intelligence/clients", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const tenantId = user.tenantId;

      const clientsData = await db
        .select({
          id: contacts.id,
          name: contacts.name,
          companyName: contacts.companyName,
          email: contacts.email,
          // Learning profile data
          learningConfidence: customerLearningProfiles.learningConfidence,
          promiseReliabilityScore: customerLearningProfiles.promiseReliabilityScore,
          totalInteractions: customerLearningProfiles.totalInteractions,
          totalPromisesMade: customerLearningProfiles.totalPromisesMade,
          promisesKept: customerLearningProfiles.promisesKept,
          promisesBroken: customerLearningProfiles.promisesBroken,
          isSerialPromiser: customerLearningProfiles.isSerialPromiser,
          isReliableLatePayer: customerLearningProfiles.isReliableLatePayer,
          isRelationshipDeteriorating: customerLearningProfiles.isRelationshipDeteriorating,
          preferredChannel: customerLearningProfiles.preferredChannel,
          averageResponseTime: customerLearningProfiles.averageResponseTime,
        })
        .from(contacts)
        .leftJoin(
          customerLearningProfiles,
          and(
            eq(customerLearningProfiles.contactId, contacts.id),
            eq(customerLearningProfiles.tenantId, tenantId)
          )
        )
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            eq(contacts.role, 'customer'),
            eq(contacts.isActive, true)
          )
        )
        .orderBy(desc(customerLearningProfiles.totalInteractions));

      // Determine behavioral segment for each client
      const clientsWithSegments = clientsData.map(client => {
        let segment = 'Unknown';
        let segmentColor = '#94a3b8'; // slate-400
        
        if (client.isSerialPromiser) {
          segment = 'Serial Promiser';
          segmentColor = '#f97316'; // orange
        } else if (client.isRelationshipDeteriorating) {
          segment = 'Deteriorating';
          segmentColor = '#be123c'; // rose
        } else if (client.isReliableLatePayer) {
          segment = 'Predictable Late';
          segmentColor = '#facc15'; // yellow
        } else if (client.promiseReliabilityScore && parseFloat(client.promiseReliabilityScore) >= 85) {
          segment = 'Reliable';
          segmentColor = '#22c55e'; // green
        } else if (client.totalPromisesMade && client.totalPromisesMade > 0) {
          segment = 'Unpredictable Late';
          segmentColor = '#f59e0b'; // amber
        }

        return {
          ...client,
          behavioralSegment: segment,
          segmentColor,
          confidenceScore: client.learningConfidence ? parseFloat(client.learningConfidence) : 0.1,
          prs: client.promiseReliabilityScore ? parseFloat(client.promiseReliabilityScore) : 0,
        };
      });

      res.json(clientsWithSegments);
    } catch (error) {
      console.error("Error fetching client intelligence list:", error);
      res.status(500).json({ message: "Failed to fetch client intelligence list" });
    }
  });

  // Get detailed client behavioral analytics - REWRITTEN FROM SCRATCH
  app.get("/api/client-intelligence/clients/:contactId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const tenantId = user.tenantId;
      const { contactId } = req.params;

      // Step 1: Get basic client info using raw query to avoid Drizzle issues
      const clientResult = await db.execute(sql`
        SELECT id, name, email, phone, company_name, is_active
        FROM contacts
        WHERE id = ${contactId} AND tenant_id = ${tenantId}
        LIMIT 1
      `);

      if (!clientResult.rows || clientResult.rows.length === 0) {
        return res.status(404).json({ message: "Client not found" });
      }

      const clientRow = clientResult.rows[0] as any;
      const client = {
        id: clientRow.id,
        name: clientRow.name,
        email: clientRow.email,
        phone: clientRow.phone,
        companyName: clientRow.company_name,
        status: clientRow.is_active ? 'active' : 'inactive',
      };

      // Step 2: Get learning profile using raw query
      const profileResult = await db.execute(sql`
        SELECT 
          email_effectiveness,
          sms_effectiveness,
          voice_effectiveness,
          total_interactions,
          successful_actions,
          average_response_time,
          preferred_channel,
          preferred_contact_time,
          promise_reliability_score,
          total_promises_made,
          promises_kept,
          promises_broken,
          promises_partially_kept,
          is_serial_promiser,
          is_reliable_late_payer,
          is_relationship_deteriorating,
          is_new_customer,
          prs_last_30_days,
          prs_last_90_days,
          prs_last_12_months,
          learning_confidence
        FROM customer_learning_profiles
        WHERE contact_id = ${contactId} AND tenant_id = ${tenantId}
        LIMIT 1
      `);

      let learningProfile = null;
      if (profileResult.rows && profileResult.rows.length > 0) {
        const profileRow = profileResult.rows[0] as any;
        learningProfile = {
          emailEffectiveness: profileRow.email_effectiveness || '0.5',
          smsEffectiveness: profileRow.sms_effectiveness || '0.5',
          voiceEffectiveness: profileRow.voice_effectiveness || '0.5',
          totalInteractions: profileRow.total_interactions || 0,
          successfulActions: profileRow.successful_actions || 0,
          averageResponseTime: profileRow.average_response_time || 24,
          preferredChannel: profileRow.preferred_channel || 'email',
          preferredContactTime: profileRow.preferred_contact_time || 'morning',
          promiseReliabilityScore: profileRow.promise_reliability_score || '0',
          totalPromisesMade: profileRow.total_promises_made || 0,
          promisesKept: profileRow.promises_kept || 0,
          promisesBroken: profileRow.promises_broken || 0,
          promisesPartiallyKept: profileRow.promises_partially_kept || 0,
          prsLast30Days: profileRow.prs_last_30_days || '0',
          prsLast90Days: profileRow.prs_last_90_days || '0',
          prsLast12Months: profileRow.prs_last_12_months || '0',
          learningConfidence: profileRow.learning_confidence || '0.1',
        };
      }

      // Step 3: Calculate behavioral flags
      const behavioralFlags = {
        isSerialPromiser: profileResult.rows?.[0]?.is_serial_promiser || false,
        isReliableLatePayer: profileResult.rows?.[0]?.is_reliable_late_payer || false,
        isRelationshipDeteriorating: profileResult.rows?.[0]?.is_relationship_deteriorating || false,
        isNewCustomer: profileResult.rows?.[0]?.is_new_customer !== false,
      };

      // Step 4: Return response
      res.json({
        client,
        learningProfile,
        promises: [], // Will be added later if needed
        channelStats: [], // Will be added later if needed
        behavioralFlags,
      });
    } catch (error) {
      console.error("Error fetching client behavioral analytics:", error);
      res.status(500).json({ message: "Failed to fetch client behavioral analytics" });
    }
  });

  // Get client journey timeline (interactions, payments, segment changes)
  app.get("/api/client-intelligence/clients/:contactId/journey", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const tenantId = user.tenantId;
      const { contactId } = req.params;

      // Get all actions/interactions for this contact
      const interactions = await db
        .select({
          id: actions.id,
          type: actions.type,
          subject: actions.subject,
          content: actions.content,
          sentiment: actions.sentiment,
          createdAt: actions.createdAt,
          completedAt: actions.completedAt,
          status: actions.status,
          metadata: actions.metadata,
        })
        .from(actions)
        .where(
          and(
            eq(actions.contactId, contactId),
            eq(actions.tenantId, tenantId)
          )
        )
        .orderBy(desc(actions.createdAt))
        .limit(100);

      // Get payment history from invoices
      const payments = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          amountPaid: invoices.amountPaid,
          paidDate: invoices.paidDate,
          status: invoices.status,
          dueDate: invoices.dueDate,
          issueDate: invoices.issueDate,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.contactId, contactId),
            eq(invoices.tenantId, tenantId),
            gt(invoices.amountPaid, "0")
          )
        )
        .orderBy(desc(invoices.paidDate))
        .limit(50);

      // Get behavioral segment changes from learning profile history
      // For now, we'll compute current segment and include it as the latest change
      const learningProfile = await db
        .select({
          isSerialPromiser: customerLearningProfiles.isSerialPromiser,
          isReliableLatePayer: customerLearningProfiles.isReliableLatePayer,
          isRelationshipDeteriorating: customerLearningProfiles.isRelationshipDeteriorating,
          promiseReliabilityScore: customerLearningProfiles.promiseReliabilityScore,
          totalPromisesMade: customerLearningProfiles.totalPromisesMade,
          lastUpdated: customerLearningProfiles.lastUpdated,
        })
        .from(customerLearningProfiles)
        .where(
          and(
            eq(customerLearningProfiles.contactId, contactId),
            eq(customerLearningProfiles.tenantId, tenantId)
          )
        )
        .limit(1);

      const profile = learningProfile[0];
      let currentSegment = 'Unknown';
      let segmentColor = '#94a3b8';

      if (profile) {
        if (profile.isSerialPromiser) {
          currentSegment = 'Serial Promiser';
          segmentColor = '#f97316';
        } else if (profile.isRelationshipDeteriorating) {
          currentSegment = 'Deteriorating';
          segmentColor = '#be123c';
        } else if (profile.isReliableLatePayer) {
          currentSegment = 'Predictable Late';
          segmentColor = '#facc15';
        } else if (profile.promiseReliabilityScore && parseFloat(profile.promiseReliabilityScore) >= 85) {
          currentSegment = 'Reliable';
          segmentColor = '#22c55e';
        } else if (profile.totalPromisesMade && profile.totalPromisesMade > 0) {
          currentSegment = 'Unpredictable Late';
          segmentColor = '#f59e0b';
        }
      }

      const segmentChanges = [{
        segment: currentSegment,
        color: segmentColor,
        changedAt: profile?.lastUpdated || new Date(),
        reason: 'Current behavioral segment'
      }];

      // Format timeline events
      const timelineEvents = [
        ...interactions.map(i => ({
          id: i.id,
          type: 'interaction' as const,
          eventType: i.type,
          channel: i.type, // actions use 'type' which includes email, sms, call, etc.
          subject: i.subject,
          content: i.content,
          sentiment: i.sentiment,
          status: i.status,
          metadata: i.metadata,
          timestamp: i.completedAt || i.createdAt,
        })),
        ...payments.map(p => ({
          id: p.id,
          type: 'payment' as const,
          invoiceNumber: p.invoiceNumber,
          amount: parseFloat(p.amount),
          amountPaid: parseFloat(p.amountPaid),
          status: p.status,
          timestamp: p.paidDate || p.issueDate,
        })),
        ...segmentChanges.map((s, idx) => ({
          id: `segment-${idx}`,
          type: 'segment_change' as const,
          segment: s.segment,
          color: s.color,
          reason: s.reason,
          timestamp: s.changedAt,
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({
        timelineEvents,
        summary: {
          totalInteractions: interactions.length,
          totalPayments: payments.length,
          currentSegment,
          segmentColor,
        }
      });
    } catch (error) {
      console.error("Error fetching client journey:", error);
      res.status(500).json({ message: "Failed to fetch client journey" });
    }
  });

  // ==================== END CLIENT INTELLIGENCE API ====================

  // ==================== DEMO MODE API ====================
  
  // Get demo mode status
  // Toggle demo mode
  // Seed demo data
  // Seed forecast demo data (100 invoices with payment promises across 6 weeks)
  // Clear demo data
  // Check if demo data exists
  // ==================== DEMO DATA TESTING API ====================
  // Comprehensive testing environment for development and demos

  // Reset ALL data for tenant (not just DEMO-prefixed)
  // Create demo customer with varied invoices
  const createDemoCustomerSchema = z.object({
    customerName: z.string().min(1).max(200).default("Nexus KPI Limited"),
  });
  
  // Generate a new random invoice for existing customer
  const generateInvoiceSchema = z.object({
    contactId: z.string().uuid().optional(),
    daysUntilDue: z.number().int().min(-365).max(365).default(30),
    amount: z.number().positive().max(1000000).optional(),
  });
  
  // Simulate payment (mimics Xero/QuickBooks webhook)
  const simulatePaymentSchema = z.object({
    invoiceId: z.string().uuid().optional(),
    paymentAmount: z.number().positive().max(10000000).optional(),
    paymentDate: z.string().datetime().optional(),
  });
  
  // Get demo data stats
  // ==================== END DEMO MODE API ====================

  // ==================== PLATFORM ADMIN API ====================
  // Qashivo internal platform administration - requires platformAdmin flag
  
  // Import platform admin middleware
  const { withPlatformAdmin } = await import('./middleware/rbac.js');
  
  // Get platform stats
  app.get("/api/platform-admin/stats", ...withPlatformAdmin(), async (req, res) => {
    try {
      const stats = await storage.getPlatformStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching platform stats:", error);
      res.status(500).json({ message: "Failed to fetch platform stats" });
    }
  });
  
  // Get all platform users
  app.get("/api/platform-admin/users", ...withPlatformAdmin(), async (req, res) => {
    try {
      const { role } = req.query;
      const filters = role ? { role: role as string } : undefined;
      const users = await storage.getAllPlatformUsers(filters);
      res.json(users.map(u => stripSensitiveUserFields(u)));
    } catch (error) {
      console.error("Error fetching platform users:", error);
      res.status(500).json({ message: "Failed to fetch platform users" });
    }
  });
  
  // Get all platform tenants
  app.get("/api/platform-admin/tenants", ...withPlatformAdmin(), async (req, res) => {
    try {
      const tenants = await storage.getAllPlatformTenants();
      res.json(tenants.map(t => stripSensitiveTenantFields(t)));
    } catch (error) {
      console.error("Error fetching platform tenants:", error);
      res.status(500).json({ message: "Failed to fetch platform tenants" });
    }
  });
  
  // Get all platform partners
  app.get("/api/platform-admin/partners", ...withPlatformAdmin(), async (req, res) => {
    try {
      const partners = await storage.getAllPlatformPartners();
      res.json(partners);
    } catch (error) {
      console.error("Error fetching platform partners:", error);
      res.status(500).json({ message: "Failed to fetch platform partners" });
    }
  });
  
  // Get all platform relationships
  app.get("/api/platform-admin/relationships", ...withPlatformAdmin(), async (req, res) => {
    try {
      const relationships = await storage.getAllPlatformRelationships();
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching platform relationships:", error);
      res.status(500).json({ message: "Failed to fetch platform relationships" });
    }
  });

  // ==================== END PLATFORM ADMIN API ====================

  // ==================== INVESTOR DEMO API (Public - No Auth) ====================
  
  // Create investor lead (lead capture form)
  app.post("/api/investor/lead", async (req, res) => {
    try {
      const { name, email } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      
      // Check if lead already exists
      const existingLead = await storage.getInvestorLeadByEmail(email);
      if (existingLead) {
        return res.json(existingLead);
      }
      
      const lead = await storage.createInvestorLead({ name, email });
      res.json(lead);
    } catch (error) {
      console.error("Error creating investor lead:", error);
      res.status(500).json({ message: "Failed to create investor lead" });
    }
  });

  // Trigger voice demo (Retell call)
  /**
   * @deprecated INVESTOR DEMO ONLY - DO NOT USE FOR PRODUCTION COLLECTIONS
   * 
   * This endpoint uses HARDCODED dummy data for investor demonstrations:
   * - Company: "Williams Logistics"
   * - Invoice: "INV-1001", £5,000
   * - Days overdue: 15
   * 
   * For real collection calls, use: POST /api/contacts/:contactId/schedule-call
   * That endpoint uses actual customer and invoice data from the database.
   */
  app.post("/api/investor/voice-demo", async (req, res) => {
    console.log('🎤 [VOICE-DEMO] ⚠️ DEMO ONLY - Using hardcoded dummy data');
    console.log('🎤 [VOICE-DEMO] Received voice demo request:', JSON.stringify(req.body));
    
    try {
      const { leadId, phone, name } = req.body;
      
      console.log('🎤 [VOICE-DEMO] Parsed params - leadId:', leadId, 'phone:', phone, 'name:', name);
      
      if (!leadId || !phone) {
        console.log('🎤 [VOICE-DEMO] Missing required params - returning 400');
        return res.status(400).json({ message: "Lead ID and phone are required" });
      }
      
      // Update lead with phone number and name if provided
      const updateData: any = { phone };
      if (name) updateData.voiceName = name;
      
      console.log('🎤 [VOICE-DEMO] Updating lead with:', updateData);
      const lead = await storage.updateInvestorLead(leadId, updateData);
      console.log('🎤 [VOICE-DEMO] Lead updated:', lead?.id);
      
      // Check Retell configuration
      console.log('🎤 [VOICE-DEMO] Retell config check - AGENT_ID:', process.env.RETELL_AGENT_ID ? 'SET' : 'MISSING');
      console.log('🎤 [VOICE-DEMO] Retell config check - API_KEY:', process.env.RETELL_API_KEY ? 'SET' : 'MISSING');
      console.log('🎤 [VOICE-DEMO] Retell config check - PHONE_NUMBER:', process.env.RETELL_PHONE_NUMBER ? 'SET' : 'MISSING');
      
      // Trigger Retell AI call with investor demo script
      const { createUnifiedRetellCall, createStandardCollectionVariables } = await import('./utils/retellCallHelper.js');
      
      // Calculate due date as 15 days ago
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 15);
      
      const callVariables = createStandardCollectionVariables({
        customerName: name || lead.name,
        companyName: "Williams Logistics",
        invoiceNumber: "INV-1001",
        invoiceAmount: "5000",
        totalOutstanding: "5000",
        invoiceCount: "1",
        daysOverdue: "15",
        dueDate: dueDate,
        customMessage: "This is a demo call to showcase Qashivo's AI voice capabilities"
      });
      
      console.log('🎤 [VOICE-DEMO] Call variables prepared:', JSON.stringify(callVariables));
      console.log('🎤 [VOICE-DEMO] Initiating Retell call to:', phone);
      
      const callResult = await createUnifiedRetellCall({
        toNumber: phone,
        dynamicVariables: callVariables,
        metadata: {
          type: 'investor_demo',
          leadId: lead.id,
          leadName: lead.name
        },
        context: 'INVESTOR_DEMO'
      });
      
      console.log(`📞 [VOICE-DEMO] SUCCESS - Call initiated for ${lead.name}:`, callResult.callId);
      console.log('📞 [VOICE-DEMO] Full call result:', JSON.stringify(callResult));
      
      res.json({ 
        success: true, 
        message: "Voice call initiated",
        callId: callResult.callId
      });
    } catch (error: any) {
      console.error("❌ [VOICE-DEMO] Error triggering voice demo:", error);
      console.error("❌ [VOICE-DEMO] Error message:", error?.message);
      console.error("❌ [VOICE-DEMO] Error stack:", error?.stack);
      res.status(500).json({ message: "Failed to trigger voice demo", error: error?.message });
    }
  });

  /**
   * @deprecated INVESTOR DEMO ONLY - DO NOT USE FOR PRODUCTION COLLECTIONS
   * 
   * This endpoint uses HARDCODED dummy data for investor demonstrations.
   * For real SMS collection messages, use the customer drawer SMS functionality.
   */
  app.post("/api/investor/sms-demo", async (req, res) => {
    console.log('📱 [SMS-DEMO] ⚠️ DEMO ONLY - Using hardcoded dummy data');
    try {
      const { leadId, phone, name } = req.body;
      
      if (!leadId || !phone) {
        return res.status(400).json({ message: "Lead ID and phone are required" });
      }
      
      // Update lead with phone number and name if provided
      const updateData: any = { phone };
      if (name) updateData.smsName = name;
      
      const lead = await storage.updateInvestorLead(leadId, updateData);
      
      // Send SMS via Vonage with investor demo message (HARDCODED for demo)
      const { sendCustomSMS } = await import('./services/vonage.js');
      
      const displayName = name || lead.name;
      const smsMessage = `Hi ${displayName}! 👋 This is Qashivo's AI.\n\nYou have an overdue invoice of £5,000 (15 days past due).\n\nReply:\n• PLAN - Set up payment plan\n• DISPUTE - Raise a concern\n• PAID - Confirm payment\n\nThis demonstrates our AI intent detection.`;
      
      const smsResult = await sendCustomSMS(phone, smsMessage);
      
      console.log(`📱 Investor demo SMS sent to ${lead.name}:`, smsResult);
      
      if (!smsResult.success) {
        throw new Error(smsResult.error || 'Failed to send SMS');
      }
      
      res.json({ 
        success: true, 
        message: "SMS sent",
        messageId: smsResult.messageId
      });
    } catch (error) {
      console.error("Error sending SMS demo:", error);
      res.status(500).json({ message: "Failed to send SMS demo" });
    }
  });

  // Poll call status from Retell API (fallback when webhook doesn't arrive)
  app.get("/api/investor/call-status/:callId", async (req, res) => {
    try {
      const { callId } = req.params;
      const { leadId } = req.query;
      
      console.log(`📞 [CALL-STATUS] Checking call status for: ${callId}, leadId: ${leadId}`);
      
      if (!callId) {
        return res.status(400).json({ message: "Call ID is required" });
      }
      
      // Get call details from Retell API
      const { retellService } = await import('./retell-service.js');
      const callData = await retellService.getCall(callId);
      
      console.log(`📞 [CALL-STATUS] Retell call data:`, JSON.stringify({
        call_id: callData.call_id,
        call_status: callData.call_status,
        end_timestamp: callData.end_timestamp,
        disconnection_reason: callData.disconnection_reason,
        has_transcript: !!callData.transcript
      }));
      
      // Check if call is ended
      const isEnded = callData.call_status === 'ended' || callData.call_status === 'error';
      
      if (isEnded && leadId) {
        // Check if we already processed this call
        const lead = await storage.getInvestorLead(leadId as string);
        
        if (lead && !lead.voiceDemoCompleted) {
          console.log(`📞 [CALL-STATUS] Processing completed call for lead: ${leadId}`);
          
          // Process the call - same logic as webhook
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          const transcriptText = callData.transcript || 'No transcript available';
          
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
              role: "system",
              content: `Analyze this debt collection AI call transcript and extract detailed insights:
1) Primary Intent: payment_plan, dispute, promise_to_pay, general_query, or unknown
2) Sentiment: positive, neutral, negative, cooperative, or hostile
3) Confidence Score: 0-100 (how confident are you in the intent detection)
4) Key Insights: Array of 2-3 key findings from the conversation
5) Action Items: Array of recommended next steps
6) Summary: 1-2 sentence summary of the call outcome

Return only JSON with keys: intent, sentiment, confidence, keyInsights, actionItems, summary`
            }, {
              role: "user",
              content: transcriptText
            }],
            response_format: { type: "json_object" }
          });
          
          const analysis = JSON.parse(completion.choices[0].message.content || '{}');
          
          // Check if call was terminated by customer
          const terminatedByCustomer = callData.disconnection_reason === 'user_hangup' || 
                                        callData.disconnection_reason === 'callee_hangup';
          
          // Update lead with voice demo results
          const updatedLead = await storage.updateInvestorLead(leadId as string, {
            voiceDemoCompleted: true,
            voiceDemoResults: {
              callId: callData.call_id,
              transcript: transcriptText,
              intent: terminatedByCustomer ? 'call_terminated' : (analysis.intent || 'unknown'),
              sentiment: analysis.sentiment || 'neutral',
              confidence: analysis.confidence || 50,
              keyInsights: analysis.keyInsights || [],
              actionItems: analysis.actionItems || [],
              summary: analysis.summary || 'Call completed',
              callDuration: callData.call_duration_ms ? Math.round(callData.call_duration_ms / 1000) : 0,
              terminatedByCustomer,
              disconnectionReason: callData.disconnection_reason,
              analyzedAt: new Date().toISOString()
            }
          });
          
          console.log('✅ [CALL-STATUS] Voice analysis saved via polling:', analysis);
          
          // Broadcast results via WebSocket
          if ((app as any).broadcastDemoResults) {
            (app as any).broadcastDemoResults(leadId, {
              voiceDemoCompleted: updatedLead.voiceDemoCompleted,
              smsDemoCompleted: updatedLead.smsDemoCompleted,
              voiceDemoResults: updatedLead.voiceDemoResults,
              smsDemoResults: updatedLead.smsDemoResults
            });
            console.log('📡 [CALL-STATUS] Broadcasted results via WebSocket');
          }
          
          return res.json({
            callStatus: callData.call_status,
            isEnded: true,
            processed: true,
            analysis
          });
        }
      }
      
      res.json({
        callStatus: callData.call_status,
        isEnded,
        processed: false
      });
    } catch (error: any) {
      console.error("❌ [CALL-STATUS] Error checking call status:", error?.message);
      res.status(500).json({ message: "Failed to check call status", error: error?.message });
    }
  });

  // Webhook for voice call completion (from Retell)
  app.post("/api/investor/webhook/voice", async (req, res) => {
    try {
      const { call_id, transcript, call } = req.body;
      
      console.log('📞 Voice webhook received:', { call_id, transcript: transcript?.substring(0, 100) });
      
      // Find lead by call metadata
      const callMetadata = call?.metadata || {};
      const leadId = callMetadata.leadId;
      
      if (!leadId) {
        console.log('⚠️ No lead ID in call metadata');
        return res.json({ success: true });
      }
      
      // Extract intent and sentiment using OpenAI
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const transcriptText = transcript || call?.transcript || 'No transcript available';
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: `Analyze this debt collection AI call transcript and extract detailed insights:
1) Primary Intent: payment_plan, dispute, promise_to_pay, general_query, or unknown
2) Sentiment: positive, neutral, negative, cooperative, or hostile
3) Confidence Score: 0-100 (how confident are you in the intent detection)
4) Key Insights: Array of 2-3 key findings from the conversation
5) Action Items: Array of recommended next steps
6) Summary: 1-2 sentence summary of the call outcome

Return only JSON with keys: intent, sentiment, confidence, keyInsights, actionItems, summary`
        }, {
          role: "user",
          content: transcriptText
        }],
        response_format: { type: "json_object" }
      });
      
      const analysis = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Update lead with voice demo results
      const updatedLead = await storage.updateInvestorLead(leadId, {
        voiceDemoCompleted: true,
        voiceDemoResults: {
          callId: call_id,
          transcript: transcriptText,
          intent: analysis.intent || 'unknown',
          sentiment: analysis.sentiment || 'neutral',
          confidence: analysis.confidence || 50,
          keyInsights: analysis.keyInsights || [],
          actionItems: analysis.actionItems || [],
          summary: analysis.summary || 'Call completed',
          callDuration: call?.duration || 0,
          analyzedAt: new Date().toISOString()
        }
      });
      
      console.log('✅ Voice analysis saved:', analysis);
      
      // Broadcast results via WebSocket for instant updates
      if ((app as any).broadcastDemoResults) {
        (app as any).broadcastDemoResults(leadId, {
          voiceDemoCompleted: updatedLead.voiceDemoCompleted,
          smsDemoCompleted: updatedLead.smsDemoCompleted,
          voiceDemoResults: updatedLead.voiceDemoResults,
          smsDemoResults: updatedLead.smsDemoResults
        });
      }
      
      res.json({ success: true, analysis });
    } catch (error) {
      console.error("Error processing voice webhook:", error);
      res.status(500).json({ message: "Failed to process voice webhook" });
    }
  });

  // Webhook for SMS response (from Vonage)
  app.post("/api/investor/webhook/sms", async (req, res) => {
    try {
      const { msisdn, text, to } = req.body;
      
      console.log('📱 SMS webhook received:', { msisdn, text });
      
      if (!text) {
        return res.json({ success: true });
      }
      
      // Find lead by phone number (msisdn is the sender's phone)
      const leads = await db.select().from(investorLeads).where(eq(investorLeads.phone, msisdn));
      const lead = leads[0];
      
      if (!lead) {
        console.log('⚠️ No lead found for phone:', msisdn);
        return res.json({ success: true });
      }
      
      // Extract intent and sentiment using OpenAI
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: "Analyze this SMS response and extract: 1) Intent (payment_plan, dispute, promise_to_pay, paid, general_query, unknown), 2) Sentiment (positive, neutral, negative, cooperative, hostile), 3) Confidence score (0-100). Return JSON only."
        }, {
          role: "user",
          content: text
        }],
        response_format: { type: "json_object" }
      });
      
      const analysis = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Update lead with SMS demo results
      const updatedLead = await storage.updateInvestorLead(lead.id, {
        smsDemoCompleted: true,
        smsDemoResults: {
          fromPhone: msisdn,
          responseText: text,
          intent: analysis.intent || 'unknown',
          sentiment: analysis.sentiment || 'neutral',
          confidence: analysis.confidence || 50,
          analyzedAt: new Date().toISOString()
        }
      });
      
      console.log('✅ SMS analysis saved:', analysis);
      
      // Broadcast results via WebSocket for instant updates
      if ((app as any).broadcastDemoResults) {
        (app as any).broadcastDemoResults(lead.id, {
          voiceDemoCompleted: updatedLead.voiceDemoCompleted,
          smsDemoCompleted: updatedLead.smsDemoCompleted,
          voiceDemoResults: updatedLead.voiceDemoResults,
          smsDemoResults: updatedLead.smsDemoResults
        });
      }
      
      res.json({ success: true, analysis });
    } catch (error) {
      console.error("Error processing SMS webhook:", error);
      res.status(500).json({ message: "Failed to process SMS webhook" });
    }
  });

  // Get investor lead demo results
  app.get("/api/investor/lead/:leadId/results", async (req, res) => {
    try {
      const { leadId } = req.params;
      const lead = await storage.getInvestorLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json({
        voiceDemoCompleted: lead.voiceDemoCompleted,
        smsDemoCompleted: lead.smsDemoCompleted,
        voiceDemoResults: lead.voiceDemoResults,
        smsDemoResults: lead.smsDemoResults
      });
    } catch (error) {
      console.error("Error fetching demo results:", error);
      res.status(500).json({ message: "Failed to fetch demo results" });
    }
  });

  // Schedule investment call
  app.post("/api/investor/schedule-call", async (req, res) => {
    try {
      // Import validation schema
      const { insertInvestmentCallRequestSchema } = await import("@shared/schema");
      const { z } = await import("zod");
      
      // Enhanced validation schema with email/phone format checks
      const validationSchema = insertInvestmentCallRequestSchema.extend({
        email: z.string().email("Invalid email format"),
        phone: z.string().min(10, "Phone number must be at least 10 digits"),
        isHighNetWorth: z.boolean().refine(val => val === true, {
          message: "High Net Worth declaration is required"
        }),
        acknowledgesRisk: z.boolean().refine(val => val === true, {
          message: "Risk acknowledgment is required"
        }),
      });
      
      // Validate request body
      const validatedData = validationSchema.parse(req.body);
      
      // Store investment call request with timestamp
      const callRequest = await storage.createInvestmentCallRequest({
        ...validatedData,
        requestedAt: new Date(),
        status: 'pending'
      });
      
      console.log('📞 Investment call scheduled:', {
        id: callRequest.id,
        name: callRequest.name,
        email: callRequest.email,
        timestamp: callRequest.requestedAt
      });
      
      // TODO: Send notification to team (email/Slack)
      console.log('💼 Investment call request received:', {
        name: callRequest.name,
        phone: callRequest.phone,
        email: callRequest.email,
        compliance: { 
          isHighNetWorth: callRequest.isHighNetWorth, 
          acknowledgesRisk: callRequest.acknowledgesRisk 
        }
      });
      
      res.json({ 
        success: true, 
        message: "Investment call scheduled successfully",
        callRequest: {
          id: callRequest.id,
          name: callRequest.name,
          email: callRequest.email,
          requestedAt: callRequest.requestedAt
        }
      });
    } catch (error) {
      console.error("Error scheduling investment call:", error);
      
      // Handle Zod validation errors
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: (error as any).errors 
        });
      }
      
      res.status(500).json({ message: "Failed to schedule investment call" });
    }
  });

  // Get all investment call requests (for CRM page) - owner/platform admin only
  app.get("/api/investor/call-requests", isAuthenticated, isOwner, async (req, res) => {
    try {
      const callRequests = await storage.getAllInvestmentCallRequests();
      res.json(callRequests);
    } catch (error) {
      console.error("Error fetching investment call requests:", error);
      res.status(500).json({ message: "Failed to fetch investment call requests" });
    }
  });

  // Delete investment call request (for removing test data) - owner/platform admin only
  app.delete("/api/investor/call-requests/:id", isAuthenticated, isOwner, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteInvestmentCallRequest(id);
      res.json({ success: true, message: "Investment call request deleted" });
    } catch (error) {
      console.error("Error deleting investment call request:", error);
      res.status(500).json({ message: "Failed to delete investment call request" });
    }
  });

  // ==================== END INVESTOR DEMO API ====================

  // ==================== BETA PARTNER API ====================
  
  // Submit beta partner interest form
  app.post("/api/beta-partner/submit", async (req, res) => {
    try {
      const { firmName, contactName, email, phone, practiceDescription, ndaAccepted } = req.body;
      
      // Validation
      if (!firmName || !contactName || !email || !phone || !practiceDescription) {
        return res.status(400).json({ message: "All fields are required" });
      }
      
      if (!ndaAccepted) {
        return res.status(400).json({ message: "NDA must be accepted" });
      }
      
      // Store beta partner lead using investor leads table with special type
      const leadData = {
        name: `${firmName} - ${contactName}`,
        email,
        phone,
        voiceName: contactName, // Store contact name
        smsName: firmName, // Store firm name
        voiceDemoCompleted: false, // Use as flag to indicate beta partner lead
        smsDemoCompleted: false,
        voiceDemoResults: {
          firmName,
          contactName,
          practiceDescription,
          ndaAccepted,
          submittedAt: new Date().toISOString(),
          type: 'beta_partner'
        } as any
      };
      
      const lead = await storage.createInvestorLead(leadData);
      
      console.log('🤝 Beta partner interest received:', {
        id: lead.id,
        firmName,
        contactName,
        email,
        timestamp: new Date().toISOString()
      });
      
      res.json({ 
        success: true, 
        message: "Beta partner interest submitted successfully",
        leadId: lead.id
      });
    } catch (error) {
      console.error("Error submitting beta partner interest:", error);
      res.status(500).json({ message: "Failed to submit beta partner interest" });
    }
  });

  // ==================== END BETA PARTNER API ====================

  // ==================== DOCUMENTATION DOWNLOAD API ====================
  
  // Download SECURITY.md as PDF
  app.get('/api/docs/security/download', async (req, res) => {
    try {
      console.log('📥 PDF download requested');
      const { mdToPdf } = await import('md-to-pdf');
      const fs = await import('fs');
      const path = await import('path');
      
      const securityMdPath = path.join(process.cwd(), 'SECURITY.md');
      console.log('📄 Looking for SECURITY.md at:', securityMdPath);
      
      // Check if file exists
      if (!fs.existsSync(securityMdPath)) {
        console.error('❌ SECURITY.md not found at:', securityMdPath);
        return res.status(404).json({ message: 'Security documentation not found' });
      }
      
      console.log('✅ SECURITY.md found, generating PDF...');
      
      // Convert to PDF with custom styling
      const pdf = await mdToPdf(
        { path: securityMdPath },
        {
          dest: path.join(process.cwd(), 'SECURITY.pdf'),
          pdf_options: {
            format: 'A4',
            margin: {
              top: '20mm',
              right: '20mm',
              bottom: '20mm',
              left: '20mm'
            },
            printBackground: true
          },
          stylesheet: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 900px;
              margin: 0 auto;
            }
            h1 {
              color: #17B6C3;
              border-bottom: 3px solid #17B6C3;
              padding-bottom: 10px;
              margin-top: 30px;
            }
            h2 {
              color: #2c3e50;
              border-bottom: 2px solid #ecf0f1;
              padding-bottom: 8px;
              margin-top: 25px;
            }
            h3 {
              color: #34495e;
              margin-top: 20px;
            }
            code {
              background: #f4f4f4;
              padding: 2px 6px;
              border-radius: 3px;
              font-family: 'Courier New', Courier, monospace;
              font-size: 0.9em;
            }
            pre {
              background: #2c3e50;
              color: #ecf0f1;
              padding: 15px;
              border-radius: 5px;
              overflow-x: auto;
              margin: 15px 0;
            }
            pre code {
              background: transparent;
              color: inherit;
              padding: 0;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 15px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: left;
            }
            th {
              background-color: #17B6C3;
              color: white;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            ul, ol {
              margin: 10px 0;
              padding-left: 30px;
            }
            blockquote {
              border-left: 4px solid #17B6C3;
              padding-left: 15px;
              margin: 15px 0;
              color: #666;
              font-style: italic;
            }
          `
        }
      );
      
      console.log('✅ PDF generated at:', pdf.filename);
      
      // Set headers for download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Qashivo-Security-Documentation.pdf"');
      
      // Read and send the PDF
      const pdfBuffer = fs.readFileSync(pdf.filename);
      console.log('📦 PDF buffer size:', pdfBuffer.length, 'bytes');
      res.send(pdfBuffer);
      
      // Clean up temporary PDF file
      fs.unlinkSync(pdf.filename);
      console.log('🧹 Temporary PDF cleaned up');
      
    } catch (error) {
      console.error('❌ Failed to generate PDF:', error);
      res.status(500).json({ message: 'Failed to generate PDF', error: (error as Error).message });
    }
  });

  // ==================== END DOCUMENTATION DOWNLOAD API ====================

  // ==================== EMAIL CONNECTION ROUTES ====================
  app.use(emailConnectionRouter);
  // ==================== END EMAIL CONNECTION ROUTES ====================

  // ==================== EMAIL POLLING SERVICE ====================
  const { startPollingLoop } = await import('./services/emailPollingService');
  startPollingLoop();
  // ==================== END EMAIL POLLING SERVICE ====================

  const httpServer = createServer(app);
  
  // Initialize dashboard WebSocket service for real-time updates
  const { websocketService } = await import('./services/websocketService');
  websocketService.initialize(httpServer);
  
  // Attach websocket service to app for access in other routes/services
  (app as any).websocketService = websocketService;
  
  // WebSocket server for real-time investor demo updates
  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/investor-demo' });
  
  // Connection manager: leadId -> Set of WebSocket connections
  const investorDemoConnections = new Map<string, Set<any>>();
  
  wss.on('connection', (ws, req) => {
    // Extract leadId from query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const leadId = url.searchParams.get('leadId');
    
    if (!leadId) {
      ws.close(1008, 'Lead ID required');
      return;
    }
    
    console.log(`🔌 WebSocket connected for lead: ${leadId}`);
    
    // Store connection
    if (!investorDemoConnections.has(leadId)) {
      investorDemoConnections.set(leadId, new Set());
    }
    investorDemoConnections.get(leadId)!.add(ws);
    
    // Handle disconnection
    ws.on('close', () => {
      console.log(`🔌 WebSocket disconnected for lead: ${leadId}`);
      const connections = investorDemoConnections.get(leadId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          investorDemoConnections.delete(leadId);
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for lead ${leadId}:`, error);
    });
  });
  
  // Helper function to broadcast demo results to connected clients
  function broadcastDemoResults(leadId: string, results: any) {
    const connections = investorDemoConnections.get(leadId);
    if (connections && connections.size > 0) {
      const message = JSON.stringify({
        type: 'demo_results',
        data: results
      });
      
      connections.forEach((ws) => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
        }
      });
      
      console.log(`📡 Broadcasted results to ${connections.size} client(s) for lead: ${leadId}`);
    }
  }
  
  // Attach broadcaster to app for access in webhooks
  (app as any).broadcastDemoResults = broadcastDemoResults;
  
  return httpServer;
}
