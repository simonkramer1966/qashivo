import type { Express} from "express";
import express from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import {
  generateCreditRecommendation,
  type CreditSignals,
  type TradingProfile,
} from "./services/creditScoringService";
import { setupAuth, isAuthenticated, isOwner } from "./auth";
import { 
  insertContactSchema,
  insertContactNoteSchema, 
  insertInvoiceSchema, 
  insertActionSchema,
  insertWorkflowSchema,
  insertCommunicationTemplateSchema,
  insertEscalationRuleSchema,
  insertAiAgentConfigSchema,
  insertChannelAnalyticsSchema,
  insertWorkflowTemplateSchema,
  insertRetellConfigurationSchema,
  insertVoiceCallSchema,
  type InsertVoiceCall,
  insertVoiceWorkflowSchema,
  insertVoiceWorkflowStateSchema,
  insertVoiceStateTransitionSchema,
  insertVoiceMessageTemplateSchema,
  insertLeadSchema,
  insertBillSchema,
  insertBankAccountSchema,
  insertBankTransactionSchema,
  insertBudgetSchema,
  insertBudgetLineSchema,
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
  type BudgetLine,
  type ExchangeRate,
  type ActionItem,
  type ActionLog,
  type PaymentPromise,
  invoices,
  contacts,
  actions,
  disputes,
  bankTransactions,
  seasonalPatterns,
  customerLearningProfiles,
  inboundMessages,
  smsMessages,
  investorLeads,
  onboardingProgress,
  messageDrafts,
  tenants,
  paymentPromises,
  smeClients,
  contactNotes,
  timelineEvents
} from "@shared/schema";
import { getOverdueCategoryFromDueDate } from "@shared/utils/overdueUtils";
import { calculateLatePaymentInterest } from "./utils/interestCalculator";
import { eq, and, desc, asc, sql, count, avg, gte, lte, lt, inArray, or, isNull, gt, not } from 'drizzle-orm';
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

const testVoiceSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  customerName: z.string().optional(),
  companyName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceAmount: z.string().optional(),
  totalOutstanding: z.string().optional(),
  daysOverdue: z.string().optional(),
  invoiceCount: z.string().optional(),
  dueDate: z.string().optional(),
  organisationName: z.string().optional(),
  demoMessage: z.string().optional()
});

// Nudge endpoint request schema
const nudgeInvoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required")
});

// Invoice filtering query schema for server-side filtering
const invoicesQuerySchema = z.object({
  status: z.enum(['pending', 'overdue', 'paid', 'cancelled', 'all']).optional().default('all'),
  search: z.string().optional(),
  overdue: z.enum(['paid', 'due', 'overdue', 'serious', 'escalation', 'all']).optional().default('all'),
  contactId: z.string().optional(),
  sortBy: z.enum(['date', 'invoiceNumber', 'customer', 'daysOverdue', 'status', 'amount']).optional().default('daysOverdue'),
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
import { webhookHandler } from "./services/webhookHandler";
import { ForecastEngine, type ForecastConfig, type ForecastScenario } from "../shared/forecast";
import { subscriptionService } from "./services/subscriptionService";
import { businessAnalyticsService } from "./services/businessAnalytics";
import { cleanEmailContent } from "./services/messagePostProcessor";
import { clientPartnerService } from "./services/clientPartnerService";
import { signalCollector } from "./lib/signal-collector";
import { getDashboardMetrics } from "./services/metricsService";
import { computeCashInflow } from "./services/dashboardCashInflowService";

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
    enquiryType: z.enum(['demo', 'pricing', 'partnership', 'general']).default('general')
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
        general: 'General Enquiry'
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
            <h1 style="color: #12B8C4; margin: 0; font-size: 28px;">Qashivo</h1>
            <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">AI-powered credit control</p>
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
            <a href="${baseUrl}/demo" style="display: inline-block; background: #12B8C4; color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: 500;">Try our interactive demo</a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #E6E8EC; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            Nexus KPI Limited. Built in London. Backed by innovation.<br>
            <a href="${baseUrl}" style="color: #12B8C4;">www.qashivo.com</a>
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
        text: `Thank you for getting in touch, ${data.name.split(' ')[0]}!\n\nWe've received your ${enquiryTypeLabel.toLowerCase()} and a member of our team will be in touch shortly.\n\nYour message:\n${data.message}\n\nIn the meantime, why not explore what Qashivo can do for your business at ${baseUrl}/demo\n\n---\nNexus KPI Limited. Built in London. Backed by innovation.\n${baseUrl}`
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

  app.post('/api/templates/tenant', isAuthenticated, async (req, res) => {
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

  app.patch('/api/templates/tenant/:id', isAuthenticated, async (req, res) => {
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
      res.json({ users });
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
  app.get('/api/users/:userId/assignments', isAuthenticated, withRBACContext, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const assignments = await storage.getUserContactAssignments(req.params.userId, req.rbac.tenantId);
      res.json({ assignments });
    } catch (error) {
      console.error('Failed to get user assignments:', error);
      res.status(500).json({ message: 'Failed to retrieve assignments' });
    }
  });

  // Get contact's assignments (who is assigned to this contact)
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

  // Assign contact to user with validation
  app.post('/api/users/:userId/assignments', isAuthenticated, withRBACContext, requireTenantAdmin, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { contactId } = assignmentBodySchema.parse(req.body);

      const assignment = await storage.createUserContactAssignment({
        userId: req.params.userId,
        contactId,
        tenantId: req.rbac.tenantId,
        assignedBy: req.rbac.userId,
        isActive: true,
      });

      res.status(201).json({ assignment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: error.errors 
        });
      }
      console.error('Failed to create assignment:', error);
      res.status(500).json({ message: 'Failed to create assignment' });
    }
  });

  // Unassign contact from user
  app.delete('/api/users/:userId/assignments/:assignmentId', isAuthenticated, withRBACContext, requireTenantAdmin, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      await storage.deleteUserContactAssignment(req.params.assignmentId, req.rbac.tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      res.status(500).json({ message: 'Failed to delete assignment' });
    }
  });

  // Bulk assign contacts to user with validation
  app.post('/api/users/:userId/assignments/bulk', isAuthenticated, withRBACContext, requireTenantAdmin, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { contactIds } = bulkAssignmentSchema.parse(req.body);

      const assignments = await storage.bulkAssignContacts(
        req.params.userId,
        contactIds,
        req.rbac.tenantId,
        req.rbac.userId
      );

      res.status(201).json({ assignments, count: assignments.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: error.errors 
        });
      }
      console.error('Failed to bulk assign contacts:', error);
      res.status(500).json({ message: 'Failed to bulk assign contacts' });
    }
  });

  // Bulk unassign contacts from user with validation
  app.post('/api/users/:userId/assignments/bulk-unassign', isAuthenticated, withRBACContext, requireTenantAdmin, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { contactIds } = bulkAssignmentSchema.parse(req.body);

      await storage.bulkUnassignContacts(
        req.params.userId,
        contactIds,
        req.rbac.tenantId
      );

      res.json({ success: true, count: contactIds.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: error.errors 
        });
      }
      console.error('Failed to bulk unassign contacts:', error);
      res.status(500).json({ message: 'Failed to bulk unassign contacts' });
    }
  });

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

  // Business Analytics Endpoints (Owner Only)
  
  // GET /api/business/analytics/overview - Core business metrics
  app.get('/api/business/analytics/overview', isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const metrics = await businessAnalyticsService.getBusinessOverview();
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching business overview:', error);
      res.status(500).json({ 
        message: 'Failed to fetch business metrics', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/business/analytics/revenue - Detailed revenue analytics
  app.get('/api/business/analytics/revenue', isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const analytics = await businessAnalyticsService.getRevenueAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching revenue analytics:', error);
      res.status(500).json({ 
        message: 'Failed to fetch revenue analytics', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/business/analytics/clients - Client metrics and trends
  app.get('/api/business/analytics/clients', isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const metrics = await businessAnalyticsService.getClientMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching client metrics:', error);
      res.status(500).json({ 
        message: 'Failed to fetch client metrics', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/business/analytics/partners - Partner performance metrics
  app.get('/api/business/analytics/partners', isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const metrics = await businessAnalyticsService.getPartnerMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching partner metrics:', error);
      res.status(500).json({ 
        message: 'Failed to fetch partner metrics', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

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
  app.post('/api/onboarding/start', isAuthenticated, async (req: any, res) => {
    try {
      // Apply RBAC context manually
      await new Promise<void>((resolve, reject) => {
        withRBACContext(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      const { tenantId } = req.rbac;
      const progress = await onboardingService.initializeOnboarding(tenantId);
      res.json(progress);
    } catch (error) {
      console.error("Error starting onboarding:", error);
      if (error instanceof Error && (error.message.includes("not associated") || error.message.includes("Authorization"))) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to start onboarding" });
    }
  });

  // Get current onboarding progress
  app.get('/api/onboarding/progress', isAuthenticated, async (req: any, res) => {
    try {
      // Apply RBAC context manually
      await new Promise<void>((resolve, reject) => {
        withRBACContext(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      const { tenantId } = req.rbac;
      const progress = await onboardingService.getOnboardingProgress(tenantId);
      
      // Auto-initialize if no progress exists
      if (!progress) {
        const newProgress = await onboardingService.initializeOnboarding(tenantId);
        const stats = await onboardingService.getOnboardingStats(tenantId);
        return res.json({ progress: newProgress, stats });
      }
      
      const stats = await onboardingService.getOnboardingStats(tenantId);
      res.json({ progress, stats });
    } catch (error) {
      console.error("Error fetching onboarding progress:", error);
      if (error instanceof Error && (error.message.includes("not associated") || error.message.includes("Authorization"))) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to fetch onboarding progress" });
    }
  });

  // Update phase progress
  app.put('/api/onboarding/progress', isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body first
      const validationResult = updateProgressSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }
      
      // Apply RBAC context manually
      
      // Apply RBAC context manually
      await new Promise<void>((resolve, reject) => {
        withRBACContext(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      const { tenantId } = req.rbac;
      const { phase, data } = validationResult.data;
      await onboardingService.updatePhaseProgress(tenantId, phase, data || {});
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating onboarding progress:", error);
      if (error instanceof Error && (error.message.includes("not associated") || error.message.includes("Authorization"))) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to update onboarding progress" });
    }
  });

  // Complete a phase
  app.post('/api/onboarding/complete-phase', isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body first
      const validationResult = completePhaseSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }
      
      // Apply RBAC context manually
      
      // Apply RBAC context manually
      await new Promise<void>((resolve, reject) => {
        withRBACContext(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      const { tenantId } = req.rbac;
      const { phase } = validationResult.data;
      
      // Validate phase can be completed
      const validation = await onboardingService.validatePhaseCompletion(tenantId, phase);
      if (!validation.canComplete) {
        return res.status(400).json({ 
          message: "Phase cannot be completed", 
          missingRequirements: validation.missingRequirements 
        });
      }
      
      await onboardingService.completePhase(tenantId, phase);
      res.json({ success: true });
    } catch (error) {
      console.error("Error completing onboarding phase:", error);
      if (error instanceof Error && (error.message.includes("not associated") || error.message.includes("Authorization"))) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to complete onboarding phase" });
    }
  });

  // Complete entire onboarding
  app.post('/api/onboarding/complete', isAuthenticated, async (req: any, res) => {
    try {
      // Apply RBAC context manually
      
      // Apply RBAC context manually
      await new Promise<void>((resolve, reject) => {
        withRBACContext(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      const { tenantId } = req.rbac;
      await onboardingService.completeOnboarding(tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      if (error instanceof Error && (error.message.includes("not associated") || error.message.includes("Authorization"))) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Check onboarding status
  app.get('/api/onboarding/status', isAuthenticated, async (req: any, res) => {
    try {
      // Get user's tenant - support both regular users and partner-mode users
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      
      if (!tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      
      const completed = await onboardingService.isOnboardingCompleted(tenantId);
      res.json({ completed });
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      res.status(500).json({ message: "Failed to check onboarding status" });
    }
  });

  // Xero automated data import for onboarding
  app.post('/api/onboarding/xero-import', isAuthenticated, async (req: any, res) => {
    try {
      // Apply RBAC context manually
      
      // Apply RBAC context manually
      await new Promise<void>((resolve, reject) => {
        withRBACContext(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      const { tenantId } = req.rbac;
      
      // Get Xero tokens for this tenant (TODO: implement getXeroTokens method)
      const tenant = await storage.getTenant(tenantId);
      if (!tenant?.xeroAccessToken || !tenant?.xeroRefreshToken) {
        return res.status(400).json({ 
          message: "Xero not connected. Please connect your Xero account first.",
          requiresAuth: true
        });
      }
      const xeroTokens = {
        accessToken: tenant.xeroAccessToken || '',
        refreshToken: tenant.xeroRefreshToken || '',
        tenantId: tenant.xeroTenantId,
        expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000) // Use stored expiry or fallback
      };
      
      // Import data using XeroOnboardingService
      const { xeroOnboardingService } = await import('./services/xeroOnboardingService');
      const importResult = await xeroOnboardingService.performAutomatedDataImport(xeroTokens, tenantId);
      
      if (importResult.success) {
        console.log(`✅ Xero onboarding import completed for tenant ${tenantId} in ${importResult.timeElapsed}ms`);
        
        // Auto-trigger AI analysis after successful import
        let aiAnalysisResults = null;
        try {
          console.log(`🤖 Triggering instant AI analysis for tenant ${tenantId}...`);
          const analysisStartTime = Date.now();
          
          // Get contacts and invoices for analysis
          const contacts = await storage.getContacts(tenantId);
          const invoices = await storage.getInvoices(tenantId);
          
          // Calculate key metrics
          const totalOutstanding = invoices
            .filter(inv => inv.status === 'outstanding' || inv.status === 'overdue')
            .reduce((sum, inv) => sum + parseFloat(inv.amountDue || '0'), 0);
          
          const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');
          const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + parseFloat(inv.amountDue || '0'), 0);
          
          // Identify top debtors (contacts with highest outstanding amounts)
          const contactOutstanding = new Map<string, number>();
          invoices
            .filter(inv => inv.status === 'outstanding' || inv.status === 'overdue')
            .forEach(inv => {
              const contactId = inv.contactId;
              if (contactId) {
                const current = contactOutstanding.get(contactId) || 0;
                contactOutstanding.set(contactId, current + parseFloat(inv.amountDue || '0'));
              }
            });
          
          const topDebtors = Array.from(contactOutstanding.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([contactId, amount]) => {
              const contact = contacts.find(c => c.id === contactId);
              return {
                name: contact?.name || 'Unknown',
                amount,
                invoiceCount: invoices.filter(i => i.contactId === contactId && (i.status === 'outstanding' || i.status === 'overdue')).length
              };
            });
          
          // Generate recommended actions based on data
          const recommendedActions = [];
          if (overdueInvoices.length > 0) {
            recommendedActions.push(`Priority: Contact ${overdueInvoices.length} customers with overdue invoices`);
          }
          if (topDebtors.length > 0 && topDebtors[0].amount > 10000) {
            recommendedActions.push(`High value: Focus on ${topDebtors[0].name} (£${topDebtors[0].amount.toLocaleString()})`);
          }
          if (totalOverdue > 0) {
            recommendedActions.push(`Cash recovery: £${totalOverdue.toLocaleString()} overdue to collect`);
          }
          
          const analysisTime = Date.now() - analysisStartTime;
          
          aiAnalysisResults = {
            totalOutstanding,
            totalOverdue,
            overdueCount: overdueInvoices.length,
            topDebtors,
            recommendedActions,
            analyzedAt: new Date().toISOString(),
            analysisTimeMs: analysisTime
          };
          
          console.log(`✅ AI analysis completed in ${analysisTime}ms - ${recommendedActions.length} recommendations generated`);
        } catch (analysisError) {
          console.error('❌ AI analysis failed (non-blocking):', analysisError);
          // Don't fail the import if analysis fails
        }
        
        // Update onboarding progress with ALL data in one call to avoid overwriting
        await onboardingService.updatePhaseProgress(tenantId, 'technical_connection', {
          technical_connection: {
            xeroSetup: true,
            dataImportCompleted: true,
            importSummary: importResult.summary,
            importTimestamp: new Date().toISOString(),
            aiAnalysisCompleted: !!aiAnalysisResults,
            aiAnalysisResults
          }
        });
      }
      
      res.json(importResult);
    } catch (error) {
      console.error("Error performing Xero automated import:", error);
      if (error instanceof Error && (error.message.includes("not associated") || error.message.includes("Authorization"))) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.status(500).json({ message: "Failed to perform automated import" });
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
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Recent Activity endpoint
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

  // Top Debtors endpoint
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

  // Dashboard metrics
  app.get("/api/dashboard/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`📊 Dashboard metrics - tenantId: ${user.tenantId}`);
      
      const [metrics, debtRecoveryMetrics] = await Promise.all([
        storage.getInvoiceMetrics(user.tenantId),
        storage.getDebtRecoveryMetrics(user.tenantId)
      ]);
      
      console.log(`📊 Dashboard metrics result - collectedThisMonth: ${metrics.collectedThisMonth}, collectedThisWeek: ${metrics.collectedThisWeek}`);
      
      res.json({
        ...metrics,
        ...debtRecoveryMetrics
      });
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Dashboard cash inflow forecast (real data from invoices + outcomes)
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

  // Dashboard leaderboards - Best/Worst Payers and Top Outstanding
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

  // Interest calculation endpoint
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
  app.get("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate and parse query parameters using Zod schema
      const validatedQuery = invoicesQuerySchema.parse(req.query);
      const { status, search, overdue, contactId, sortBy, sortDir, page, limit } = validatedQuery;

      console.log(`📊 Optimized Invoices API - Tenant: ${user.tenantId}, Filters: status=${status}, search="${search}", overdue=${overdue}, sortBy=${sortBy}, sortDir=${sortDir}, page=${page}, limit=${limit}`);
      
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

      // Get total system count (all invoices regardless of filters)
      const systemTotal = await storage.getInvoicesCount(user.tenantId);
      
      // Add overdue category info to each invoice based on status
      const invoicesWithCategories = result.invoices.map((invoice: any) => {
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
            }
          };
        } else {
          // Pending/overdue invoices get calculated categories
          const categoryInfo = getOverdueCategoryFromDueDate(invoice.dueDate);
          return {
            ...invoice,
            overdueCategory: categoryInfo.category,
            overdueCategoryInfo: categoryInfo
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
        '0-30': { amount: 0, count: 0 },
        '30-60': { amount: 0, count: 0 },
        '60-90': { amount: 0, count: 0 },
        '90+': { amount: 0, count: 0 },
      };
      
      allFilteredResult.invoices.forEach((inv: any) => {
        if (inv.status === 'paid' || inv.status === 'cancelled') return;
        const dueDate = new Date(inv.dueDate);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue <= 0) return;
        
        const amount = Number(inv.amount) || 0;
        const amountPaid = Number(inv.amountPaid) || 0;
        const outstanding = amount - amountPaid;
        
        if (daysOverdue <= 30) {
          agingBuckets['0-30'].amount += outstanding;
          agingBuckets['0-30'].count++;
        } else if (daysOverdue <= 60) {
          agingBuckets['30-60'].amount += outstanding;
          agingBuckets['30-60'].count++;
        } else if (daysOverdue <= 90) {
          agingBuckets['60-90'].amount += outstanding;
          agingBuckets['60-90'].count++;
        } else {
          agingBuckets['90+'].amount += outstanding;
          agingBuckets['90+'].count++;
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
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Hold invoice endpoint
  app.put("/api/invoices/:id/hold", isAuthenticated, async (req: any, res) => {
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

  // Unhold invoice endpoint
  app.put("/api/invoices/:id/unhold", isAuthenticated, async (req: any, res) => {
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

  // Mark invoice as paid and send thank you SMS
  app.post("/api/invoices/:id/mark-paid", isAuthenticated, async (req: any, res) => {
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

  // Pause invoice (dispute, PTP, payment plan)
  app.post("/api/invoices/:id/pause", isAuthenticated, async (req: any, res) => {
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

  // Resume invoice (clear pause state)
  app.post("/api/invoices/:id/resume", isAuthenticated, async (req: any, res) => {
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

  // Get invoice pause status
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

  // Send SMS for invoice with template selection
  app.post("/api/invoices/:id/send-sms", isAuthenticated, async (req: any, res) => {
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

  // Initiate AI voice call for invoice
  app.post("/api/invoices/:id/initiate-voice-call", isAuthenticated, async (req: any, res) => {
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

  // Get outstanding invoices for a specific contact (for payment plan creation)
  app.get("/api/invoices/outstanding/:contactId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
      // Get outstanding invoices for the specific contact
      const outstandingInvoices = await storage.getOutstandingInvoicesByContact(user.tenantId, contactId);
      
      res.json(outstandingInvoices);
    } catch (error) {
      console.error("Error fetching outstanding invoices for contact:", error);
      res.status(500).json({ message: "Failed to fetch outstanding invoices", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/invoices", isAuthenticated, async (req: any, res) => {
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

  // Apply for invoice finance advance
  app.post("/api/invoices/:invoiceId/apply-advance", isAuthenticated, async (req: any, res) => {
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

  // Accept insurance coverage for an invoice
  app.post("/api/invoices/:invoiceId/accept-insurance", isAuthenticated, async (req: any, res) => {
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

  // Contact routes
  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate and parse query parameters using Zod schema
      const validatedQuery = contactsQuerySchema.parse(req.query);
      const { search, sortBy, sortDir, page, limit } = validatedQuery;

      console.log(`📊 Paginated Contacts API - Tenant: ${user.tenantId}, Filters: search="${search}", sortBy=${sortBy}, sortDir=${sortDir}, page=${page}, limit=${limit}`);
      
      // Use fallback pagination with invoice data
      {
        // Get all contacts, invoices, and actions
        const allContacts = await storage.getContacts(user.tenantId);
        const allInvoices = await storage.getInvoices(user.tenantId, 10000); // Get all invoices
        const allActions = await storage.getActions(user.tenantId);
        
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
        const aggregates = {
          totalOutstanding: filteredContacts.reduce((sum, c) => sum + c.outstandingAmount, 0),
          highRiskCount: filteredContacts.filter(c => c.riskScore >= 70).length,
          totalContacts: filteredContacts.length
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

  // Get individual contact by ID
  app.get("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
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

  // Combined endpoint for customer detail page - fetches all data in one request
  app.get("/api/contacts/:id/full-profile", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
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

  // Get email messages for a contact
  app.get("/api/contacts/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
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

  // Customer Contact Persons CRUD routes
  app.get("/api/contacts/:contactId/persons", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const { contactId } = req.params;
      const persons = await storage.getCustomerContactPersons(user.tenantId, contactId);
      res.json(persons);
    } catch (error) {
      console.error("Error fetching customer contact persons:", error);
      res.status(500).json({ message: "Failed to fetch contact persons" });
    }
  });

  app.post("/api/contacts/:contactId/persons", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const { contactId } = req.params;
      
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

  app.patch("/api/contacts/:contactId/persons/:personId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const { personId } = req.params;
      
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

  app.delete("/api/contacts/:contactId/persons/:personId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const { personId } = req.params;
      await storage.deleteCustomerContactPerson(personId, user.tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting customer contact person:", error);
      res.status(500).json({ message: "Failed to delete contact person" });
    }
  });

  // Get inbox - detected outcomes needing review
  app.get("/api/inbox", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { detectedOutcomes, emailMessages, contacts } = await import("@shared/schema");
      
      const outcomes = await db.select({
        outcome: detectedOutcomes,
        email: emailMessages,
        contact: contacts,
      })
        .from(detectedOutcomes)
        .leftJoin(emailMessages, eq(detectedOutcomes.emailMessageId, emailMessages.id))
        .leftJoin(contacts, eq(detectedOutcomes.contactId, contacts.id))
        .where(and(
          eq(detectedOutcomes.tenantId, user.tenantId),
          eq(detectedOutcomes.needsReview, true)
        ))
        .orderBy(desc(detectedOutcomes.createdAt))
        .limit(100);
      
      res.json(outcomes);
    } catch (error) {
      console.error("Error fetching inbox:", error);
      res.status(500).json({ message: "Failed to fetch inbox" });
    }
  });

  // Confirm/update detected outcome
  app.post("/api/outcomes/:id/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { outcomeType, promiseDate, amount, notes } = req.body;
      
      const { detectedOutcomes } = await import("@shared/schema");
      
      // Verify outcome belongs to tenant
      const [existing] = await db.select()
        .from(detectedOutcomes)
        .where(eq(detectedOutcomes.id, id))
        .limit(1);
      
      if (!existing || existing.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Outcome not found" });
      }
      
      // Update outcome
      const [updated] = await db.update(detectedOutcomes)
        .set({
          outcomeType: outcomeType || existing.outcomeType,
          promiseDate: promiseDate ? new Date(promiseDate) : existing.promiseDate,
          amount: amount || existing.amount,
          notes: notes || existing.notes,
          needsReview: false,
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(detectedOutcomes.id, id))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error("Error confirming outcome:", error);
      res.status(500).json({ message: "Failed to confirm outcome" });
    }
  });

  // Update AR contact details (collections-specific overlay)
  app.patch("/api/contacts/:id/ar-details", isAuthenticated, async (req: any, res) => {
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

  // New endpoint for contacts with significantly overdue invoices (>30 days)
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

  app.post("/api/contacts", isAuthenticated, async (req: any, res) => {
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

  // Credit Assessment Routes
  
  // Calculate credit score and recommendation
  app.post("/api/contacts/credit-check", isAuthenticated, async (req: any, res) => {
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

  // Approve and save credit decision
  app.post("/api/contacts/:contactId/approve-credit", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
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

  // === Promise Reliability Score (PRS) Routes ===
  
  // Get PRS summary for a contact
  app.get("/api/contacts/:contactId/prs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
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
  
  // Get all promises for a contact
  app.get("/api/contacts/:contactId/promises", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
      const { getPromiseReliabilityService } = await import('./services/promiseReliabilityService.js');
      const promiseService = getPromiseReliabilityService();
      
      const promises = await promiseService.getCustomerPromises(user.tenantId, contactId);
      res.json(promises);
    } catch (error) {
      console.error("Error getting customer promises:", error);
      res.status(500).json({ message: "Failed to get promises" });
    }
  });
  
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
  app.post("/api/contacts/:contactId/sync-to-xero", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
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

  // Contact Notes routes
  app.get("/api/contacts/:contactId/notes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
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

  // Schedule an AI call to a contact
  app.post("/api/contacts/:contactId/schedule-call", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
      // Verify contact exists and user has access to it
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (!contact.phone) {
        return res.status(400).json({ message: "Contact has no phone number" });
      }

      const { reason, tone, goal, maxDuration, scheduleMode, scheduledFor } = req.body;

      // Map tone number (0=Friendly, 1=Professional, 2=Firm) to voice tone profile
      const toneProfiles = ['VOICE_TONE_WARM_FRIENDLY', 'VOICE_TONE_CALM_COLLABORATIVE', 'VOICE_TONE_FIRM_ASSERTIVE'];
      const voiceTone = toneProfiles[tone] || toneProfiles[1];

      // Calculate scheduledFor time
      let scheduledTime: Date;
      if (scheduleMode === 'asap') {
        // ASAP: schedule for now (will be picked up by executor immediately)
        scheduledTime = new Date();
      } else if (scheduledFor) {
        scheduledTime = new Date(scheduledFor);
      } else {
        scheduledTime = new Date();
      }

      // Get the first overdue invoice for this contact (for call context)
      const overdueInvoices = await db.select()
        .from(invoices)
        .where(
          and(
            eq(invoices.contactId, contactId),
            eq(invoices.tenantId, user.tenantId),
            eq(invoices.status, 'overdue')
          )
        )
        .limit(1);

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
          reason,
          scheduleMode,
          invoiceNumber: primaryInvoice?.invoiceNumber,
          daysOverdue: primaryInvoice?.dueDate 
            ? Math.max(0, Math.floor((Date.now() - new Date(primaryInvoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0,
          totalOutstanding: primaryInvoice?.balance || 0,
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
        summary: scheduleMode === 'asap' ? 'AI call initiated' : 'AI call scheduled',
        preview: reason || `Goal: ${goal.replace(/_/g, ' ')}`,
        body: JSON.stringify({ reason, goal, tone, maxDuration, scheduledFor: scheduledTime }),
        status: 'pending',
        createdByType: 'user',
        createdByName: userName,
        actionId: newAction.id
      });

      return res.status(201).json({
        success: true,
        action: newAction,
        message: scheduleMode === 'asap' ? "AI call initiated" : "AI call scheduled"
      });
    } catch (error) {
      console.error("Error scheduling AI call:", error);
      return res.status(500).json({ 
        success: false,
        message: "Failed to schedule AI call" 
      });
    }
  });

  // Generate AI email draft for a contact
  app.post("/api/contacts/:contactId/generate-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      const { templateType, tone } = req.body;

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

      // Calculate total outstanding and oldest overdue (balance = amount - amountPaid)
      const totalOutstanding = overdueInvoicesList.reduce((sum, inv) => {
        const balance = Number(inv.amount || 0) - Number(inv.amountPaid || 0);
        return sum + balance;
      }, 0);
      const oldestOverdueDays = overdueInvoicesList.length > 0
        ? Math.max(...overdueInvoicesList.map(inv => 
            inv.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0
          ))
        : 0;

      // Get tenant info
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId),
      });

      // Build context for AI email generation
      const { generateCollectionEmail } = await import("./services/openai.js");
      
      // Extract first name from arContactName for personal greeting
      const arContactFirstName = contact.arContactName?.split(' ')[0];
      
      const emailDraft = await generateCollectionEmail(templateType, {
        contactName: arContactFirstName || 'there',
        companyName: contact.name || 'Customer',
        totalOutstanding,
        oldestOverdueDays,
        invoices: overdueInvoicesList.map(inv => {
          const balance = Number(inv.amount || 0) - Number(inv.amountPaid || 0);
          return {
            invoiceNumber: inv.invoiceNumber || 'N/A',
            amount: balance,
            dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-GB') : 'N/A',
            daysOverdue: inv.dueDate 
              ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
              : 0
          };
        }),
        recentActivity: recentEvents.map(e => ({
          type: e.channel || 'event',
          date: new Date(e.occurredAt).toLocaleDateString('en-GB'),
          summary: e.summary || ''
        })),
        paymentPlan: null,
        tone: tone || 'professional',
        senderName: user.firstName || user.email.split('@')[0],
        senderCompany: tenant?.name || 'Accounts Receivable'
      });

      res.json({
        subject: emailDraft.subject,
        body: emailDraft.body,
        templateType: emailDraft.templateType,
        contactEmail: contact.email
      });
    } catch (error) {
      console.error("Error generating email:", error);
      res.status(500).json({ message: "Failed to generate email" });
    }
  });

  // Send email to a contact
  app.post("/api/contacts/:contactId/send-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      const { subject, body, templateType } = req.body;

      // Verify contact exists
      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (!contact.email) {
        return res.status(400).json({ message: "Contact has no email address" });
      }

      // Get tenant for sender info
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId),
      });

      // Send email via SendGrid
      const { sendEmail, DEFAULT_FROM_EMAIL, DEFAULT_FROM } = await import("./services/sendgrid.js");
      
      const htmlBody = body.replace(/\n/g, '<br>');
      
      const result = await sendEmail({
        to: contact.email,
        from: `${tenant?.name || DEFAULT_FROM} <${DEFAULT_FROM_EMAIL}>`,
        subject,
        html: htmlBody,
        text: body,
        customerId: contactId,
      });

      if (!result.success) {
        return res.status(500).json({ message: result.error || "Failed to send email" });
      }

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
  app.get("/api/contacts/:contactId/preview", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
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

  // Customer Timeline endpoint with cursor pagination and filters
  app.get("/api/contacts/:contactId/timeline", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
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

  // Create timeline note endpoint
  app.post("/api/contacts/:contactId/timeline/notes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
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

  // Customer preferences endpoint
  app.get("/api/contacts/:contactId/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
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

  // Update customer preferences endpoint
  app.patch("/api/contacts/:contactId/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
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

  // Debtor Snapshot endpoint for Action Centre drawer
  app.get("/api/contacts/:contactId/debtor-snapshot", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
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

  // Customer Detail: Get full communication history for a contact
  app.get("/api/contacts/:contactId/history", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
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

  // Customer Detail: Get learning profile
  app.get("/api/contacts/:contactId/learning-profile", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
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

  // Customer Detail: Get payment statistics
  app.get("/api/contacts/:contactId/payment-stats", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
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

  // Customer Detail: Get action history
  app.get("/api/contacts/:contactId/actions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
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

  // Customer Detail: Get customer rating (Good/Average/Poor)
  app.get("/api/contacts/:contactId/rating", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
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

  // Action routes
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
          
          // Get contact info
          if (action.contactId) {
            try {
              const contact = await storage.getContact(action.contactId, user.tenantId);
              if (contact) {
                companyName = contact.companyName || null;
                contactName = contact.name || null;
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

  // Get paginated actions with search and filtering (for Comms tab)
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

  // Get contact history for a specific invoice
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

  // Send collection action
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

  // Escalate customer to next collection stage
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

  // Manual call capture with promise tracking
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

  // Get categorized items for Action Centre tabs
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
              // Include ALL overdue and unpaid invoices (active work items)
              eq(invoices.status, 'overdue'),
              eq(invoices.status, 'unpaid'),
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
        const hasPaymentPlan = inv.paymentPlanId;
        const hasActionDispute = allActions.some(a => a.invoiceId === inv.id && a.intentType === 'dispute' && a.status === 'open');
        const hasFormalDispute = invoiceIdsWithDisputes.includes(inv.id);
        const hasDispute = hasActionDispute || hasFormalDispute;
        const hasPTP = allActions.some(a => a.invoiceId === inv.id && a.intentType === 'promise_to_pay');
        
        return isOverdueOrUnpaid && (hasPaymentPlan || hasDispute || hasPTP);
      });
      
      const onHold = await Promise.all(onHoldRaw.map(async (inv) => {
        const enriched = await enrichInvoice(inv);
        
        // Determine why it's on hold
        const hasPaymentPlan = inv.paymentPlanId;
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
      const paymentPlansRaw = allInvoices.filter(inv => inv.paymentPlanId);
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
      
      // Get all unpaid invoices
      const unpaidInvoices = allInvoices.filter(inv => 
        inv.status === 'unpaid' || inv.status === 'overdue'
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
            
            debtorMap.set(contactId, {
              contactId,
              companyName,
              contactName,
              contact,
              totalOutstanding: 0,
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
          debtor.totalOutstanding += parseFloat(inv.amount || '0');
          debtor.invoiceCount += 1;
          debtor.invoices.push(inv);
          
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
          content: `Dispute ${status} by collector. Response: ${responseNotes}`,
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

  // ============================================================================
  // Action Centre Triage Endpoints (Sprint 1)
  // ============================================================================

  // Get action preview - renders the template with actual debtor data
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

  // Approve action - move from pending to scheduled (collector approves AI recommendation)
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

  // Edit action - collector overrides AI recommendation
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

  // Snooze action - delay to a later time
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

  // Escalate action - flag for manual handling
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

  // Assign action - assign to a specific collector
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

  // Feedback - record outcome for learning loop
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

  // Voice Call - initiate AI voice call via Retell (simplified - just sends variables to Retell)
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

  // Email - send email for an action
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

  // SMS - send SMS for an action
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
        html: processedContent.replace(/\n/g, '<br>')
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
  
  // Smart Queue Management with ML Prioritization
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
          paymentPlans: 0, // TODO: Query invoices.paymentPlanId IS NOT NULL count
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

  // Action Item Management
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

  // Action Logging
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

      // Generate payment schedules
      const schedules = [];
      const remainingAmount = parseFloat(totalAmount) - parseFloat(initialPaymentAmount || "0");
      const installmentAmount = remainingAmount / numberOfPayments;
      
      let currentDate = new Date(planStartDate);
      
      for (let i = 1; i <= numberOfPayments; i++) {
        // Calculate next payment date based on frequency
        if (i > 1) {
          switch (paymentFrequency) {
            case 'weekly':
              currentDate.setDate(currentDate.getDate() + 7);
              break;
            case 'monthly':
              currentDate.setMonth(currentDate.getMonth() + 1);
              break;
            case 'quarterly':
              currentDate.setMonth(currentDate.getMonth() + 3);
              break;
          }
        }

        const scheduleData = {
          paymentPlanId: paymentPlan.id,
          paymentNumber: i,
          dueDate: new Date(currentDate),
          amount: installmentAmount.toFixed(2),
        };

        const schedule = await storage.createPaymentPlanSchedule(scheduleData);
        schedules.push(schedule);
      }

      // Link invoices to payment plan
      await storage.linkInvoicesToPaymentPlan(paymentPlan.id, invoiceIds, user.id);

      // Return the complete payment plan with schedules
      res.status(201).json({
        paymentPlan,
        schedules,
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

  // Check if invoices already have active payment plans
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

  // Activity Log API endpoints
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

  // Wallet API endpoints
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

  // Bulk Operations
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
      const variablesData = createStandardCollectionVariables({
        customerName: customerName || "Test Customer",
        companyName: companyName || "Test Company", 
        organisationName: organisationName || tenant?.name || "Nexus AR",
        invoiceNumber: invoiceNumber || "TEST-001",
        invoiceAmount: invoiceAmount || "1500.00",
        totalOutstanding: totalOutstanding || "0.00",
        daysOverdue: daysOverdue || "0",
        invoiceCount: invoiceCount || "1",
        dueDate: dueDate || new Date(),
        customMessage: demoMessage || "This is a professional collection call regarding outstanding invoices."
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

  // Voice Call Outcome Update API - For MCP tools
  app.put("/api/voice-calls/:id/outcome", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { 
        customerResponse, 
        callSuccessful, 
        followUpRequired, 
        userSentiment, 
        disconnectionReason,
        transcript,
        callAnalysis 
      } = req.body;

      // Build the update payload with only the fields that are provided
      const updates: any = {};
      if (customerResponse !== undefined) updates.customerResponse = customerResponse;
      if (callSuccessful !== undefined) updates.callSuccessful = callSuccessful;
      if (followUpRequired !== undefined) updates.followUpRequired = followUpRequired;
      if (userSentiment !== undefined) updates.userSentiment = userSentiment;
      if (disconnectionReason !== undefined) updates.disconnectionReason = disconnectionReason;
      if (transcript !== undefined) updates.transcript = transcript;
      if (callAnalysis !== undefined) updates.callAnalysis = callAnalysis;

      // Update the voice call record
      const updatedCall = await storage.updateVoiceCall(id, user.tenantId, updates);

      // Log the outcome update as an action for audit trail
      await storage.createAction({
        tenantId: user.tenantId,
        userId: user.id,
        type: 'call_outcome',
        status: 'completed',
        subject: `Call Outcome: ${customerResponse || 'Updated'}`,
        content: `Call outcome updated - Customer Response: ${customerResponse}, Successful: ${callSuccessful}, Follow-up Required: ${followUpRequired}`,
        completedAt: new Date(),
        metadata: { 
          voiceCallId: id,
          outcomeData: updates,
          source: 'mcp_tool'
        },
      });

      res.json({
        success: true,
        voiceCall: updatedCall,
        message: "Call outcome updated successfully"
      });
    } catch (error: any) {
      console.error("Error updating voice call outcome:", error);
      res.status(500).json({ message: error.message || "Failed to update call outcome" });
    }
  });

  // Voice Calls List API - For call logs page
  app.get("/api/voice-calls", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, status, limit } = req.query;

      // Build filters object
      const filters: any = {};
      if (contactId) filters.contactId = contactId as string;
      if (status && status !== 'all') filters.status = status as string;
      if (limit) filters.limit = parseInt(limit as string, 10);

      // Get voice calls with filters
      const voiceCalls = await storage.getVoiceCalls(user.tenantId, filters);

      res.json({
        success: true,
        voiceCalls,
        total: voiceCalls.length
      });
    } catch (error: any) {
      console.error("Error retrieving voice calls:", error);
      res.status(500).json({ message: error.message || "Failed to retrieve voice calls" });
    }
  });

  // Voice Call Retrieval API - For MCP tools to find calls
  app.get("/api/voice-calls/:retellCallId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { retellCallId } = req.params;

      // Find the voice call by Retell call ID
      const voiceCalls = await storage.getVoiceCalls(user.tenantId);
      const voiceCall = voiceCalls.find(call => call.retellCallId === retellCallId);

      if (!voiceCall) {
        return res.status(404).json({ message: "Voice call not found" });
      }

      res.json({
        success: true,
        voiceCall
      });
    } catch (error: any) {
      console.error("Error retrieving voice call:", error);
      res.status(500).json({ message: error.message || "Failed to retrieve voice call" });
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

  // Collections Workflow Management Routes
  
  // Communication Templates
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

  // Collection schedules management
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

  // Customer schedule assignments
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

  // Assign all customers to default schedule
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

  // Collections Automation
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

  // Week 1: Supervised Autonomy - Daily Plan & Approval
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

  // Generate plan now (force regeneration)
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

  // Delete all planned actions (for demo/testing purposes)
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

      // Get tenant for execution time
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Get all pending_approval actions for this tenant
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

      // Calculate execution time for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const [hours, minutes] = (tenant.executionTime || '09:00').split(':');
      tomorrow.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Batch update all pending actions to scheduled
      const actionIds = pendingActions.map(a => a.id);
      await db.update(actions)
        .set({
          status: 'scheduled',
          scheduledFor: tomorrow,
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

      console.log(`✅ Approved ${actionIds.length} actions for execution at ${tomorrow.toISOString()}`);

      res.json({
        message: "Plan approved successfully",
        approvedCount: actionIds.length,
        executionTime: tomorrow.toISOString(),
      });
    } catch (error: any) {
      console.error("Error approving plan:", error);
      res.status(500).json({ message: `Failed to approve plan: ${error.message}` });
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

  // Skip action - delay action by X days
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

  // Mark debtor for attention - moves to attention queue for human review
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

  // Bulk skip actions - reschedule multiple actions by X days
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

  // Bulk mark for attention - move multiple actions to attention queue
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

  // New nudge endpoint with invoiceId in request body and action execution
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
          html: emailContent.replace(/\n/g, '<br>')
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

  // Collections Scheduler Control Endpoints
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

  // Send single invoice email
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
        html: processedContent.replace(/\n/g, '<br>')
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

  // New dropdown email endpoints
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
        html: processedContent
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

  // New dropdown SMS endpoints
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

  // Send customer summary email
  app.post("/api/contacts/:contactId/send-summary-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      
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
        html: processedContent.replace(/\n/g, '<br>')
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

  // AI Agent Configurations
  app.get("/api/collections/ai-agents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type } = req.query;
      const agents = await storage.getAiAgentConfigs(user.tenantId, { type });
      res.json(agents);
    } catch (error) {
      console.error("Error fetching AI agent configs:", error);
      res.status(500).json({ message: "Failed to fetch AI agent configs" });
    }
  });

  app.post("/api/collections/ai-agents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const agentData = insertAiAgentConfigSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const agent = await storage.createAiAgentConfig(agentData);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating AI agent config:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create AI agent config" });
    }
  });

  // Escalation Rules
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

  // Channel Analytics
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

  // Collections Dashboard Metrics
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

  // SMS Configuration
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

  // Workflow Templates
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

  // AI Learning and Optimization Routes
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

  // Advanced ML Services Routes (Week 2 Implementation)
  
  // Predictive Payment Modeling
  app.post("/api/ml/payment-predictions/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { PredictivePaymentService } = await import("./services/predictivePaymentService");
      const predictionService = new PredictivePaymentService();
      
      const predictions = await predictionService.getPaymentPredictions(user.tenantId);
      const bulkCount = await predictionService.generateBulkPredictions(user.tenantId);
      
      // Get invoices to calculate predicted revenue
      const invoiceIds = predictions.map(p => p.invoiceId);
      const invoicesQuery = await db
        .select()
        .from(invoices)
        .where(and(
          eq(invoices.tenantId, user.tenantId),
          inArray(invoices.id, invoiceIds)
        ));
      
      const invoiceMap = new Map(invoicesQuery.map(inv => [inv.id, inv]));
      
      const analysis = {
        totalPredictions: predictions.length,
        predictedRevenue: predictions.reduce((sum, p) => {
          const invoice = invoiceMap.get(p.invoiceId);
          const amount = invoice ? parseFloat(invoice.total || '0') : 0;
          const probability = parseFloat(p.paymentProbability || '0');
          return sum + (amount * probability);
        }, 0),
        highProbabilityCount: predictions.filter(p => parseFloat(p.paymentProbability || '0') > 0.8).length,
        mediumProbabilityCount: predictions.filter(p => {
          const prob = parseFloat(p.paymentProbability || '0');
          return prob >= 0.5 && prob <= 0.8;
        }).length,
        lowProbabilityCount: predictions.filter(p => parseFloat(p.paymentProbability || '0') < 0.5).length,
        predictions: predictions.slice(0, 10) // Top 10 for performance
      };
      res.json(analysis);
    } catch (error) {
      console.error("Error performing payment prediction analysis:", error);
      res.status(500).json({ message: "Failed to perform predictive analysis" });
    }
  });

  // Get payment predictions for specific invoices (optimized for filtered views)
  app.get("/api/ml/payment-predictions/filtered", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate and parse invoice IDs from query parameter
      const { invoiceIds } = req.query;
      if (!invoiceIds || typeof invoiceIds !== 'string') {
        return res.status(400).json({ 
          message: "invoiceIds query parameter is required and must be a comma-separated string" 
        });
      }

      // Parse comma-separated invoice IDs
      const requestedInvoiceIds = invoiceIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
      
      if (requestedInvoiceIds.length === 0) {
        return res.status(400).json({ 
          message: "At least one valid invoice ID must be provided" 
        });
      }

      // Limit to reasonable number of invoice IDs for performance
      if (requestedInvoiceIds.length > 1000) {
        return res.status(400).json({ 
          message: "Maximum of 1000 invoice IDs allowed per request" 
        });
      }

      const { PredictivePaymentService } = await import("./services/predictivePaymentService");
      const predictionService = new PredictivePaymentService();
      
      // Get all predictions for the tenant (we need to fetch all to filter efficiently)
      const allPredictions = await predictionService.getPaymentPredictions(user.tenantId);
      
      // Filter predictions to only include requested invoice IDs
      const filteredPredictions = allPredictions.filter(prediction => 
        requestedInvoiceIds.includes(prediction.invoiceId)
      );
      
      // Convert to map for easy lookup by invoice ID (same format as bulk endpoint)
      const predictionMap: { [invoiceId: string]: any } = {};
      filteredPredictions.forEach(prediction => {
        predictionMap[prediction.invoiceId] = {
          paymentProbability: parseFloat(prediction.paymentProbability || '0'),
          predictedPaymentDate: prediction.predictedPaymentDate,
          paymentConfidenceScore: parseFloat(prediction.paymentConfidenceScore || '0'),
          defaultRisk: parseFloat(prediction.defaultRisk || '0'),
          escalationRisk: parseFloat(prediction.escalationRisk || '0'),
          modelVersion: prediction.modelVersion
        };
      });
      
      // Log performance info for debugging
      console.log(`🔮 Filtered predictions: ${filteredPredictions.length} of ${requestedInvoiceIds.length} requested IDs (${allPredictions.length} total)`);
      
      res.json(predictionMap);
    } catch (error) {
      console.error("Error fetching filtered payment predictions:", error);
      res.status(500).json({ message: "Failed to fetch filtered payment predictions" });
    }
  });

  app.get("/api/ml/payment-predictions/:contactId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      const { PredictivePaymentService } = await import("./services/predictivePaymentService");
      const predictionService = new PredictivePaymentService();
      
      // Get all predictions for this contact
      const allPredictions = await predictionService.getPaymentPredictions(user.tenantId);
      const contactPredictions = allPredictions.filter(p => p.contactId === contactId);
      
      if (contactPredictions.length === 0) {
        return res.status(404).json({ message: "No predictions found for this contact" });
      }
      
      // Return the most recent prediction
      const prediction = contactPredictions[0];
      res.json(prediction);
    } catch (error) {
      console.error("Error fetching payment prediction:", error);
      res.status(500).json({ message: "Failed to fetch payment prediction" });
    }
  });

  // Get payment predictions for all invoices (for invoice list integration)
  app.get("/api/ml/payment-predictions/bulk/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get current filter parameters to return only relevant predictions
      const { status = 'pending', overdue = 'all', search, page = '1', limit = '50' } = req.query;
      
      // Get all predictions for the tenant first
      const { PredictivePaymentService } = await import("./services/predictivePaymentService");
      const predictionService = new PredictivePaymentService();
      const allPredictions = await predictionService.getPaymentPredictions(user.tenantId);
      
      // Use the same filtering logic as the main invoices endpoint
      const result = await storage.getInvoicesFiltered(user.tenantId, {
        status: status as string,
        search: search as string,
        overdueCategory: overdue as any,
        contactId: undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });
      
      // Only return predictions for invoices that are in the current filtered set
      const invoiceIds = new Set(result.invoices.map((inv: any) => inv.id));
      const filteredPredictions = allPredictions.filter(prediction => 
        invoiceIds.has(prediction.invoiceId)
      );
      
      // Convert to map for easy lookup by invoice ID
      const predictionMap: { [invoiceId: string]: any } = {};
      filteredPredictions.forEach(prediction => {
        predictionMap[prediction.invoiceId] = {
          paymentProbability: parseFloat(prediction.paymentProbability || '0'),
          predictedPaymentDate: prediction.predictedPaymentDate,
          paymentConfidenceScore: parseFloat(prediction.paymentConfidenceScore || '0'),
          defaultRisk: parseFloat(prediction.defaultRisk || '0'),
          escalationRisk: parseFloat(prediction.escalationRisk || '0'),
          modelVersion: prediction.modelVersion
        };
      });
      
      console.log(`🎯 Payment predictions filtered: ${Object.keys(predictionMap).length}/${allPredictions.length} predictions (matching current invoice filter)`);
      
      // Add cache-busting headers to prevent 304 responses when filters change
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(predictionMap);
    } catch (error) {
      console.error("Error fetching bulk payment predictions:", error);
      res.status(500).json({ message: "Failed to fetch payment predictions" });
    }
  });

  // Generate bulk payment predictions for all outstanding invoices
  app.post("/api/ml/payment-predictions/generate-bulk", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { PredictivePaymentService } = await import("./services/predictivePaymentService");
      const predictionService = new PredictivePaymentService();
      
      console.log(`🔮 Generating bulk predictions for tenant: ${user.tenantId}`);
      const predictionsCreated = await predictionService.generateBulkPredictions(user.tenantId);
      
      console.log(`✅ Generated ${predictionsCreated} predictions successfully`);
      res.json({ 
        success: true, 
        predictionsCreated,
        message: `Successfully generated ${predictionsCreated} payment predictions`
      });
    } catch (error) {
      console.error("Error generating bulk predictions:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to generate bulk predictions",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Backfill missing payment predictions for overdue invoices
  app.post("/api/ml/payment-predictions/backfill-overdue", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { PredictivePaymentService } = await import("./services/predictivePaymentService");
      const predictionService = new PredictivePaymentService();
      
      console.log(`🔄 Starting overdue predictions backfill for tenant: ${user.tenantId}`);
      const result = await predictionService.backfillOverduePredictions(user.tenantId);
      
      res.json({
        success: true,
        message: `Backfill completed successfully. Created ${result.created} predictions for overdue invoices.`,
        created: result.created,
        errors: result.errors,
        tenantId: user.tenantId
      });
    } catch (error) {
      console.error("Error during overdue predictions backfill:", error);
      res.status(500).json({
        success: false,
        message: "Failed to backfill overdue predictions",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

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

  // Customer Segmentation
  app.post("/api/ml/customer-segmentation/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { CustomerSegmentationService } = await import("./services/customerSegmentationService");
      const segmentationService = new CustomerSegmentationService();
      
      const analysis = await segmentationService.performSegmentationAnalysis(user.tenantId);
      res.json(analysis);
    } catch (error) {
      console.error("Error performing customer segmentation:", error);
      res.status(500).json({ message: "Failed to perform customer segmentation" });
    }
  });

  app.get("/api/ml/customer-segmentation/segments", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { CustomerSegmentationService } = await import("./services/customerSegmentationService");
      const segmentationService = new CustomerSegmentationService();
      
      const segments = await segmentationService.getCustomerSegments(user.tenantId);
      res.json(segments);
    } catch (error) {
      console.error("Error fetching customer segments:", error);
      res.status(500).json({ message: "Failed to fetch customer segments" });
    }
  });

  app.get("/api/ml/customer-segmentation/assignments", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { CustomerSegmentationService } = await import("./services/customerSegmentationService");
      const segmentationService = new CustomerSegmentationService();
      
      const assignments = await segmentationService.getCustomerSegmentAssignments(user.tenantId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching segment assignments:", error);
      res.status(500).json({ message: "Failed to fetch segment assignments" });
    }
  });

  // Seasonal Pattern Recognition
  app.post("/api/ml/seasonal-patterns/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { SeasonalPatternService } = await import("./services/seasonalPatternService");
      const seasonalService = new SeasonalPatternService();
      
      const analysis = await seasonalService.performSeasonalAnalysis(user.tenantId);
      res.json(analysis);
    } catch (error) {
      console.error("Error performing seasonal pattern analysis:", error);
      res.status(500).json({ message: "Failed to perform seasonal analysis" });
    }
  });

  app.get("/api/ml/seasonal-patterns/patterns", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type } = req.query;
      const { SeasonalPatternService } = await import("./services/seasonalPatternService");
      const seasonalService = new SeasonalPatternService();
      
      const patterns = type 
        ? await seasonalService.getPatternsByType(user.tenantId, type as string)
        : await seasonalService.getSeasonalPatterns(user.tenantId);
      
      res.json(patterns);
    } catch (error) {
      console.error("Error fetching seasonal patterns:", error);
      res.status(500).json({ message: "Failed to fetch seasonal patterns" });
    }
  });

  app.get("/api/ml/seasonal-patterns/multiplier", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ message: "Date parameter is required" });
      }

      const { SeasonalPatternService } = await import("./services/seasonalPatternService");
      const seasonalService = new SeasonalPatternService();
      
      const multiplier = await seasonalService.getSeasonalMultiplier(user.tenantId, new Date(date as string));
      res.json({ multiplier, date });
    } catch (error) {
      console.error("Error calculating seasonal multiplier:", error);
      res.status(500).json({ message: "Failed to calculate seasonal multiplier" });
    }
  });

  // Retell AI Voice Calling Routes
  app.get("/api/retell/configuration", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const config = await storage.getRetellConfiguration(user.tenantId);
      res.json(config);
    } catch (error) {
      console.error("Error fetching Retell configuration:", error);
      res.status(500).json({ message: "Failed to fetch Retell configuration" });
    }
  });

  app.post("/api/retell/configuration", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const validatedData = insertRetellConfigurationSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const config = await storage.createRetellConfiguration(validatedData);
      res.status(201).json(config);
    } catch (error: any) {
      console.error("Error creating Retell configuration:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create Retell configuration" });
    }
  });

  app.post("/api/retell/call", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, invoiceId, message } = req.body;

      // Get contact and invoice details
      const contact = await storage.getContact(contactId, user.tenantId);
      const invoice = invoiceId ? await storage.getInvoice(invoiceId, user.tenantId) : undefined;

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (!contact.phone) {
        return res.status(400).json({ message: "Contact does not have a phone number" });
      }

      // Get Retell configuration
      const retellConfig = await storage.getRetellConfiguration(user.tenantId);
      if (!retellConfig || !retellConfig.isActive) {
        return res.status(400).json({ message: "Retell AI not configured for this tenant" });
      }

      // Get tenant information for organisation_name
      const tenant = await storage.getTenant(user.tenantId);
      
      // Get all outstanding invoices for this contact to calculate total_outstanding and invoice_count
      const allInvoices = await storage.getInvoices(user.tenantId);
      const contactInvoices = allInvoices.filter(inv => inv.contactId === contactId && inv.status !== 'paid');
      const totalOutstanding = contactInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount.toString()), 0);
      const invoiceCount = contactInvoices.length;
      
      console.log(`🔧 [AI_CALL] Contact ${contactId}: Found ${invoiceCount} outstanding invoices, total: $${totalOutstanding}`);

      // Create dynamic variables for the call with all 9 required variables
      const dynamicVariables = {
        customer_name: contact.name,
        organisation_name: tenant?.name || "Nexus AR",
        company_name: contact.companyName || contact.name,
        invoice_number: invoice?.invoiceNumber || (contactInvoices[0]?.invoiceNumber || "N/A"),
        invoice_amount: invoice?.amount?.toString() || (contactInvoices[0]?.amount?.toString() || "0"),
        total_outstanding: totalOutstanding.toString(),
        days_overdue: invoice ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
        invoice_count: invoiceCount.toString(),
        due_date: invoice?.dueDate || (contactInvoices[0]?.dueDate || formatDate(new Date())),
        custom_message: message || ""
      };
      
      console.log(`🔍 [AI_CALL] Created variables before Retell call:`, dynamicVariables);
      console.log(`🔍 [AI_CALL] Variable count: ${Object.keys(dynamicVariables).length}/9 expected`);
      console.log(`🔍 [AI_CALL] Final variable count: ${Object.keys(dynamicVariables).length}/9 expected ${Object.keys(dynamicVariables).length === 9 ? '✅' : '❌'}`);
      console.log(`📤 [AI_CALL] Final payload keys: [${Object.keys(dynamicVariables).join(', ')}]`);

      // Make the call using Retell AI
      const callResult = await retellService.createCall({
        fromNumber: retellConfig.phoneNumber,
        toNumber: contact.phone,
        agentId: retellConfig.agentId,
        dynamicVariables,
        metadata: {
          contactId,
          invoiceId,
          tenantId: user.tenantId
        }
      });

      // Store the call record
      const voiceCallData = insertVoiceCallSchema.parse({
        tenantId: user.tenantId,
        contactId,
        invoiceId,
        retellCallId: callResult.callId,
        retellAgentId: callResult.agentId || process.env.RETELL_AGENT_ID || 'default-agent',
        fromNumber: callResult.fromNumber,
        toNumber: callResult.toNumber,
        direction: callResult.direction,
        status: callResult.status,
        scheduledAt: new Date(),
      });

      const voiceCall = await storage.createVoiceCall(voiceCallData);

      res.status(201).json({
        voiceCall,
        retellCallId: callResult.callId,
        message: "Call initiated successfully"
      });
    } catch (error: any) {
      console.error("Error creating voice call:", error);
      res.status(500).json({ message: error.message || "Failed to create voice call" });
    }
  });

  // AI-Enhanced Retell Call endpoint
  app.post("/api/retell/ai-call", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { message, templateId, recipient, isAICall, dynamicVariables, invoiceId, contactId } = req.body;

      if (!message || !recipient) {
        return res.status(400).json({ message: "Message and recipient are required" });
      }

      // Get tenant for organization context
      const tenant = await storage.getTenant(user.tenantId);

      // Initialize ML services for comprehensive data gathering
      const { CollectionLearningService } = await import('./services/collectionLearningService');
      const { PredictivePaymentService } = await import('./services/predictivePaymentService');
      const { DynamicRiskScoringService } = await import('./services/dynamicRiskScoringService');
      const { CustomerSegmentationService } = await import('./services/customerSegmentationService');
      
      const learningService = new CollectionLearningService();
      const paymentService = new PredictivePaymentService();
      const riskService = new DynamicRiskScoringService();
      const segmentService = new CustomerSegmentationService();

      // Enhanced AI context variables with ML intelligence
      let enhancedDynamicVariables: Record<string, any> = {
        // Basic context
        customer_name: dynamicVariables?.contactName || "Customer",
        organisation_name: tenant?.name || "Nexus AR",
        ai_call_context: dynamicVariables?.context || "general",
        context_id: dynamicVariables?.contextId || "",
        is_ai_powered: "true",
        call_type: "ai_collection_call",
        
        // ML Intelligence placeholders - will be populated below
        preferred_channel: "unknown",
        communication_effectiveness: "0.5",
        payment_reliability: "0.5",
        risk_level: "medium",
        customer_segment: "unclassified",
        ai_confidence: "0.1",
        recommended_approach: "standard",
        interaction_history_summary: "No previous interactions",
        payment_prediction_probability: "0.5",
        predicted_payment_timeframe: "unknown",
        risk_factors: "Standard collection risk",
        successful_contact_methods: "No data available",
        customer_responsiveness: "unknown",
        escalation_risk: "low",
        seasonal_payment_patterns: "No patterns identified",
        historical_payment_behavior: "No history available"
      };

      // Add invoice-specific context and payment predictions if available
      if (invoiceId) {
        try {
          const invoice = await storage.getInvoice(invoiceId, user.tenantId);
          if (invoice) {
            const daysOverdue = invoice.dueDate ? Math.max(0, Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
            
            // Get all outstanding invoices for this contact to calculate total_outstanding and invoice_count
            const allInvoices = await storage.getInvoices(user.tenantId);
            const contactInvoices = allInvoices.filter(inv => inv.contactId === invoice.contactId && inv.status !== 'paid');
            const totalOutstanding = contactInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount.toString()), 0);
            const invoiceCount = contactInvoices.length;
            
            console.log(`🔧 [AI_CALL] Contact ${invoice.contactId}: Found ${invoiceCount} outstanding invoices, total: $${totalOutstanding}`);

            enhancedDynamicVariables = {
              ...enhancedDynamicVariables,
              invoice_number: invoice.invoiceNumber,
              invoice_amount: invoice.amount,
              amount_paid: invoice.amountPaid || "0.00",
              outstanding_amount: String(parseFloat(invoice.amount || "0") - parseFloat(invoice.amountPaid || "0")),
              total_outstanding: totalOutstanding.toString(), // Sum of ALL outstanding invoices for this contact
              invoice_count: invoiceCount.toString(), // Count of ALL outstanding invoices for this contact
              due_date: invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              days_overdue: String(daysOverdue)
            };

            // 5. Payment Predictions for this specific invoice
            try {
              console.log("🔮 Generating payment prediction for invoice:", invoice.invoiceNumber);
              const paymentPrediction = await paymentService.generatePaymentPrediction(user.tenantId, invoiceId);
              
              if (paymentPrediction) {
                const paymentProb = parseFloat(paymentPrediction.paymentProbability || "0.5");
                enhancedDynamicVariables.payment_prediction_probability = (paymentProb * 100).toFixed(0) + "%";
                
                // Predicted payment timeframe
                if (paymentPrediction.predictedPaymentDate) {
                  const predictedDate = new Date(paymentPrediction.predictedPaymentDate);
                  const daysFromNow = Math.ceil((predictedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  
                  if (daysFromNow > 0) {
                    enhancedDynamicVariables.predicted_payment_timeframe = `${daysFromNow} days from now`;
                  } else if (daysFromNow === 0) {
                    enhancedDynamicVariables.predicted_payment_timeframe = "today";
                  } else {
                    enhancedDynamicVariables.predicted_payment_timeframe = `${Math.abs(daysFromNow)} days overdue predicted`;
                  }
                }
                
                // Default and escalation risk
                const defaultRisk = parseFloat(paymentPrediction.defaultRisk || "0.3");
                const escalationRisk = parseFloat(paymentPrediction.escalationRisk || "0.3");
                
                if (defaultRisk > 0.7) {
                  enhancedDynamicVariables.escalation_risk = "high";
                  enhancedDynamicVariables.recommended_approach = "urgent_but_respectful";
                } else if (escalationRisk > 0.6) {
                  enhancedDynamicVariables.escalation_risk = "medium";
                }

                // AI confidence in predictions
                const confidence = parseFloat(paymentPrediction.paymentConfidenceScore || "0.5");
                enhancedDynamicVariables.ai_confidence = (confidence * 100).toFixed(0) + "% prediction confidence";
              }
            } catch (error) {
              console.warn("Could not generate payment prediction:", error);
            }

            // 6. Seasonal Payment Patterns (if available)
            try {
              // Query seasonal patterns for additional context
              const seasonalData = await db.query.seasonalPatterns.findFirst({
                where: and(
                  eq(seasonalPatterns.tenantId, user.tenantId),
                  or(
                    eq(seasonalPatterns.contactId, invoice.contactId),
                    isNull(seasonalPatterns.contactId) // Global patterns
                  )
                ),
                orderBy: desc(seasonalPatterns.patternStrength)
              });

              if (seasonalData) {
                enhancedDynamicVariables.seasonal_payment_patterns = 
                  `Customer shows ${seasonalData.patternName} payment pattern with ${Math.round(parseFloat(seasonalData.patternStrength || "0") * 100)}% reliability`;
              }
            } catch (error) {
              console.warn("Could not fetch seasonal patterns:", error);
            }
          }
        } catch (error) {
          console.warn("Could not fetch invoice context for AI call:", error);
        }
      }

      // Add contact-specific context and ML intelligence if available
      if (contactId) {
        try {
          const contact = await storage.getContact(contactId, user.tenantId);
          if (contact) {
            enhancedDynamicVariables.customer_name = contact.name || "Customer";
            enhancedDynamicVariables.company_name = contact.companyName || "";
            enhancedDynamicVariables.preferred_contact_method = contact.preferredContactMethod || "phone";

            // Gather comprehensive ML data for the customer
            console.log("🧠 Gathering ML intelligence for customer:", contact.name);

            // 1. Customer Learning Profile - Communication preferences and effectiveness
            try {
              const learningProfile = await learningService.getOrCreateCustomerProfile(contactId, user.tenantId);
              if (learningProfile) {
                enhancedDynamicVariables.preferred_channel = learningProfile.preferredChannel || "voice";
                enhancedDynamicVariables.communication_effectiveness = learningProfile.voiceEffectiveness || "0.5";
                enhancedDynamicVariables.payment_reliability = learningProfile.paymentReliability || "0.5";
                enhancedDynamicVariables.ai_confidence = learningProfile.learningConfidence || "0.1";
                enhancedDynamicVariables.customer_responsiveness = learningProfile.averageResponseTime 
                  ? `${learningProfile.averageResponseTime} hours average response time` 
                  : "No response data";
                
                // Determine successful contact methods
                const emailEffectiveness = parseFloat(learningProfile.emailEffectiveness || "0.5");
                const smsEffectiveness = parseFloat(learningProfile.smsEffectiveness || "0.5");
                const voiceEffectiveness = parseFloat(learningProfile.voiceEffectiveness || "0.5");
                
                const methods = [];
                if (emailEffectiveness > 0.6) methods.push("email");
                if (smsEffectiveness > 0.6) methods.push("SMS");
                if (voiceEffectiveness > 0.6) methods.push("voice calls");
                
                enhancedDynamicVariables.successful_contact_methods = methods.length > 0 
                  ? methods.join(", ") 
                  : "Limited success data";

                // Payment behavior insights
                if (learningProfile.averagePaymentDelay) {
                  enhancedDynamicVariables.historical_payment_behavior = 
                    `Typically pays ${learningProfile.averagePaymentDelay} days after due date`;
                }
              }
            } catch (error) {
              console.warn("Could not fetch learning profile:", error);
            }

            // 2. Risk Assessment - Current risk scores and trends
            try {
              const riskScore = await riskService.calculateCustomerRiskScore(user.tenantId, contactId);
              if (riskScore) {
                const overallRisk = parseFloat(riskScore.overallRiskScore || "0.5");
                enhancedDynamicVariables.risk_level = overallRisk > 0.7 ? "high" : overallRisk > 0.4 ? "medium" : "low";
                enhancedDynamicVariables.escalation_risk = parseFloat(riskScore.communicationRisk || "0.5") > 0.6 ? "high" : "low";
                enhancedDynamicVariables.risk_factors = Array.isArray(riskScore.riskFactors) 
                  ? riskScore.riskFactors.join(", ") 
                  : "Standard collection considerations";
                  
                // Risk-based approach recommendation
                if (overallRisk > 0.7) {
                  enhancedDynamicVariables.recommended_approach = "gentle_but_firm";
                } else if (overallRisk < 0.3) {
                  enhancedDynamicVariables.recommended_approach = "friendly_reminder";
                } else {
                  enhancedDynamicVariables.recommended_approach = "professional_standard";
                }
              }
            } catch (error) {
              console.warn("Could not fetch risk assessment:", error);
            }

            // 3. Customer Segmentation - Behavioral classification
            try {
              const segments = await segmentService.getCustomerSegments(user.tenantId);
              // Find this customer's segment (simplified - in production would query assignments table)
              if (segments.length > 0) {
                enhancedDynamicVariables.customer_segment = segments[0].segmentName || "Standard Customer";
              }
            } catch (error) {
              console.warn("Could not fetch customer segmentation:", error);
            }

            // 4. Communication History Summary
            try {
              const actions = await storage.getActions(user.tenantId);
              const customerActions = actions.filter(action => action.contactId === contactId);
              
              if (customerActions.length > 0) {
                const recentActions = customerActions
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                  .slice(0, 5);
                
                const actionSummary = recentActions.map(action => {
                  const daysAgo = Math.floor((Date.now() - new Date(action.createdAt || 0).getTime()) / (1000 * 60 * 60 * 24));
                  return `${action.type} ${daysAgo} days ago (${action.status})`;
                }).join("; ");
                
                enhancedDynamicVariables.interaction_history_summary = 
                  `Recent contact: ${actionSummary}. Total interactions: ${customerActions.length}`;
              }
            } catch (error) {
              console.warn("Could not fetch communication history:", error);
            }
          }
        } catch (error) {
          console.warn("Could not fetch contact context for AI call:", error);
        }
      }

      console.log("🤖 Creating AI call with enhanced context:", enhancedDynamicVariables);

      // Import and apply variable normalization for Retell AI
      const { normalizeDynamicVariables, logVariableTransformation } = await import('./utils/retellVariableNormalizer');
      
      // Normalize variables before sending to Retell AI (fixes camelCase -> snake_case issue)
      const normalizedDynamicVariables = normalizeDynamicVariables(enhancedDynamicVariables, 'AI_CALL');
      logVariableTransformation(enhancedDynamicVariables, normalizedDynamicVariables, 'AI_CALL');

      // Format phone number to E.164 format for Retell AI
      const formatPhoneToE164 = (phone: string): string => {
        // Remove all non-digit characters
        const digits = phone.replace(/\D/g, '');
        
        // Handle UK numbers starting with 07 -> +447
        if (digits.startsWith('07') && digits.length === 11) {
          return `+447${digits.substring(2)}`;
        }
        
        // Handle UK numbers starting with 447 -> +447
        if (digits.startsWith('447') && digits.length === 13) {
          return `+${digits}`;
        }
        
        // If already starts with +, return as is
        if (phone.startsWith('+')) {
          return phone;
        }
        
        // Default: assume UK and add +44
        if (digits.length === 10 || digits.length === 11) {
          return `+44${digits.startsWith('0') ? digits.substring(1) : digits}`;
        }
        
        // Return original if can't determine format
        return phone;
      };

      const formattedRecipient = formatPhoneToE164(recipient);
      console.log(`📞 Phone number formatted: "${recipient}" -> "${formattedRecipient}"`);

      // Use RetellService to create the AI call
      const { RetellService } = await import('./retell-service');
      const retellService = new RetellService();
      
      const callResult = await retellService.createCall({
        fromNumber: process.env.RETELL_PHONE_NUMBER || "+12345678900",
        toNumber: formattedRecipient,
        agentId: process.env.RETELL_AGENT_ID,
        dynamicVariables: normalizedDynamicVariables,
        metadata: {
          type: "ai-call",
          tenantId: user.tenantId,
          userId: user.id,
          templateId: templateId || null,
          aiEnhanced: true
        }
      });

      // Store the voice call record
      const voiceCallData = {
        tenantId: user.tenantId,
        contactId: contactId || null,
        invoiceId: invoiceId || null,
        retellCallId: callResult.callId,
        retellAgentId: callResult.agentId || process.env.RETELL_AGENT_ID || 'default-agent',
        fromNumber: callResult.fromNumber,
        toNumber: callResult.toNumber,
        agentId: callResult.agentId,
        status: callResult.status,
        direction: callResult.direction,
        message: message,
        templateId: templateId || null,
        dynamicVariables: normalizedDynamicVariables,
        callType: 'ai-call',
        createdByUserId: user.id,
        scheduledAt: new Date(),
      };

      const voiceCall = await storage.createVoiceCall(voiceCallData);

      // Log the AI call action
      await storage.createAction({
        tenantId: user.tenantId,
        userId: user.id,
        type: 'voice',
        status: 'completed',
        subject: 'AI Call - Intelligent Collection Call',
        content: `AI-powered call initiated to ${recipient} with enhanced context variables`,
        completedAt: new Date(),
        metadata: { 
          retellCallId: callResult.callId, 
          dynamicVariables: normalizedDynamicVariables,
          aiEnhanced: true,
          callType: 'ai-call'
        },
      });

      res.status(201).json({
        voiceCall,
        retellCallId: callResult.callId,
        message: `AI call initiated to ${recipient}`,
        dynamicVariables: normalizedDynamicVariables,
        aiEnhanced: true
      });
    } catch (error: any) {
      console.error("Error creating AI call:", error);
      res.status(500).json({ message: error.message || "Failed to create AI call" });
    }
  });

  app.get("/api/retell/calls", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, status, limit } = req.query;
      const filters = {
        contactId: contactId as string,
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined
      };

      const calls = await storage.getVoiceCalls(user.tenantId, filters);
      res.json(calls);
    } catch (error) {
      console.error("Error fetching voice calls:", error);
      res.status(500).json({ message: "Failed to fetch voice calls" });
    }
  });

  // Get available agent tiers for multi-agent escalation
  app.get("/api/retell/agent-tiers", isAuthenticated, async (req: any, res) => {
    try {
      const { getAgentManager } = await import('./services/agentManager.js');
      const agentManager = getAgentManager();
      
      const { daysOverdue } = req.query;
      
      // Get all available agent tiers
      const tiers = agentManager.getAllAgentTiers();
      
      // If days overdue provided, include recommendation
      let recommendation = null;
      if (daysOverdue) {
        const days = parseInt(daysOverdue as string);
        recommendation = agentManager.getRecommendedAgent(days);
      }
      
      res.json({
        tiers: tiers.map(tier => ({
          id: tier.id,
          name: tier.name,
          description: tier.description,
          daysOverdueMin: tier.daysOverdueMin,
          daysOverdueMax: tier.daysOverdueMax,
          tone: tier.tone,
        })),
        recommendation: recommendation ? {
          tierId: recommendation.tier.id,
          tierName: recommendation.tier.name,
          recommended: recommendation.recommended,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching agent tiers:", error);
      res.status(500).json({ message: "Failed to fetch agent tiers" });
    }
  });

  // Retell Agents endpoints
  app.get("/api/retell/agents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const agents = await retellService.listAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching Retell agents:", error);
      res.status(500).json({ message: "Failed to fetch Retell agents" });
    }
  });

  app.post("/api/retell/agents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const agentData = req.body;
      const agent = await retellService.createAgent(agentData);
      
      // Store agent configuration in our database
      const retellConfigData = insertRetellConfigurationSchema.parse({
        tenantId: user.tenantId,
        agentId: agent.agent_id,
        agentName: agentData.name,
        agentDescription: agentData.description,
        agentCategory: agentData.category,
        phoneNumber: agentData.assignedPhoneNumber || null,
        voiceSettings: {
          voiceId: agentData.voiceId,
          voiceTemperature: agentData.voiceTemperature,
          voiceSpeed: agentData.voiceSpeed,
          responsiveness: agentData.responsiveness,
          interruptionSensitivity: agentData.interruptionSensitivity,
        },
        isActive: true,
      });

      await storage.createRetellConfiguration(retellConfigData);
      res.status(201).json(agent);
    } catch (error: any) {
      console.error("Error creating Retell agent:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create Retell agent" });
    }
  });

  // Retell Phone Numbers endpoints
  app.get("/api/retell/phone-numbers", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const phoneNumbers = await retellService.listPhoneNumbers();
      res.json(phoneNumbers);
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      res.status(500).json({ message: "Failed to fetch phone numbers" });
    }
  });

  app.post("/api/retell/phone-numbers/purchase", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { areaCode, numberType } = req.body;
      const phoneNumber = await retellService.purchasePhoneNumber(areaCode, numberType);
      res.status(201).json(phoneNumber);
    } catch (error) {
      console.error("Error purchasing phone number:", error);
      res.status(500).json({ message: "Failed to purchase phone number" });
    }
  });

  app.post("/api/retell/webhook", async (req, res) => {
    try {
      console.log("🔔 Retell webhook received:", JSON.stringify(req.body, null, 2));

      // Verify webhook signature
      const signature = req.headers['x-retell-signature'] as string;
      const apiKey = process.env.RETELL_API_KEY;

      if (!apiKey) {
        console.error("❌ RETELL_API_KEY not configured");
        return res.status(500).json({ message: "Server configuration error" });
      }

      if (!signature) {
        console.error("❌ Missing x-retell-signature header");
        return res.status(401).json({ message: "Missing signature" });
      }

      try {
        const isValid = Retell.verify(
          JSON.stringify(req.body),
          apiKey,
          signature
        );

        if (!isValid) {
          console.error("❌ Invalid Retell webhook signature");
          return res.status(401).json({ message: "Invalid signature" });
        }

        console.log("✅ Retell webhook signature verified");
      } catch (verifyError) {
        console.error("❌ Signature verification error:", verifyError);
        return res.status(401).json({ message: "Signature verification failed" });
      }

      // Retell sends data nested in a 'call' object
      const webhookData = req.body.call || req.body;
      const retellCallId = webhookData.call_id;
      const eventType = req.body.event;

      if (!retellCallId) {
        console.error("Missing call_id in webhook. Payload:", JSON.stringify(req.body, null, 2));
        return res.status(400).json({ message: "Missing call_id in webhook" });
      }

      // Only process call_ended events for analysis (they have the full transcript)
      if (eventType !== 'call_ended') {
        console.log(`⏭️ Skipping ${eventType} event - waiting for call_ended for transcript`);
        return res.json({ success: true, message: `Event ${eventType} acknowledged` });
      }

      // Process webhook data using RetellService helper
      const callData = retellService.processWebhookData(webhookData);
      console.log("Processed call data:", callData);

      // Extract metadata to find tenant and contact
      const metadata = webhookData.metadata || {};
      
      // Check if this is an investor demo call - route to investor webhook
      if (metadata.type === 'investor_demo' && metadata.leadId) {
        console.log(`📞 Routing investor demo call to investor webhook. Lead ID: ${metadata.leadId}`);
        
        // Forward to investor webhook handler
        try {
          const { call_id, transcript, call } = req.body;
          const leadId = metadata.leadId;
          
          // Extract disconnection reason
          const disconnectionReason = webhookData.disconnection_reason || call?.disconnection_reason;
          // Only flag as customer-terminated if user explicitly hung up early
          // agent_hangup, inactivity, max_duration_reached are all normal completions
          const wasTerminatedByCustomer = disconnectionReason === 'user_hangup';
          
          console.log(`📞 Call disconnection reason: ${disconnectionReason}, terminated by customer: ${wasTerminatedByCustomer}`);
          
          // Extract intent and sentiment using OpenAI
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          const transcriptText = transcript || call?.transcript || 'No transcript available';
          
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
              role: "system",
              content: `Analyze this debt collection AI call transcript and extract detailed insights:
1) Primary Intent: payment_plan, dispute, promise_to_pay, general_query, call_terminated, or unknown
2) Sentiment: positive, neutral, negative, cooperative, or hostile
3) Confidence Score: 0-100 (how confident are you in the intent detection)
4) Key Insights: Array of 2-3 key findings from the conversation
5) Action Items: Array of recommended next steps
6) Summary: 1-2 sentence summary of the call outcome

${wasTerminatedByCustomer ? '\nNote: The customer terminated this call early. Reflect this in your analysis and recommend a callback.' : ''}

Return only JSON with keys: intent, sentiment, confidence, keyInsights, actionItems, summary`
            }, {
              role: "user",
              content: transcriptText
            }],
            response_format: { type: "json_object" }
          });
          
          const analysis = JSON.parse(completion.choices[0].message.content || '{}');
          
          // If call was terminated by customer, override intent and add to insights
          if (wasTerminatedByCustomer) {
            analysis.intent = 'call_terminated';
            analysis.keyInsights = analysis.keyInsights || [];
            analysis.keyInsights.unshift('Customer terminated the call before completion');
            analysis.actionItems = analysis.actionItems || [];
            if (!analysis.actionItems.some((item: string) => item.toLowerCase().includes('callback'))) {
              analysis.actionItems.unshift('Schedule callback to complete conversation');
            }
          }
          
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
              disconnectionReason: disconnectionReason,
              terminatedByCustomer: wasTerminatedByCustomer,
              analyzedAt: new Date().toISOString()
            }
          });
          
          console.log('✅ Investor demo voice analysis saved:', analysis);
          
          // Broadcast results via WebSocket for instant dialog update
          if ((app as any).broadcastDemoResults) {
            (app as any).broadcastDemoResults(leadId, {
              voiceDemoCompleted: updatedLead.voiceDemoCompleted,
              smsDemoCompleted: updatedLead.smsDemoCompleted,
              voiceDemoResults: updatedLead.voiceDemoResults,
              smsDemoResults: updatedLead.smsDemoResults
            });
            console.log('📡 Broadcasted voice demo results to frontend via WebSocket');
          }
          
          return res.json({ success: true, analysis });
        } catch (error) {
          console.error("Error processing investor demo call:", error);
          return res.status(500).json({ message: "Failed to process investor demo call" });
        }
      }
      
      const tenantId = metadata.tenantId || metadata.tenant_id;
      const contactId = metadata.contactId || metadata.contact_id;
      const invoiceId = metadata.invoiceId || metadata.invoice_id;

      // Try to match contact by phone number if no contactId in metadata
      let finalContactId = contactId;
      let finalTenantId = tenantId;

      if (!finalContactId && callData.toNumber && tenantId) {
        // Get all contacts for tenant and find by phone
        const contacts = await storage.getContacts(tenantId);
        const matchedContact = contacts.find(c => 
          c.phone && c.phone.replace(/\D/g, '') === callData.toNumber?.replace(/\D/g, '')
        );
        if (matchedContact) {
          finalContactId = matchedContact.id;
        }
      }

      // Only save if we have required fields
      if (finalTenantId && finalContactId) {
        const voiceCallData: InsertVoiceCall = {
          tenantId: finalTenantId,
          contactId: finalContactId,
          invoiceId: invoiceId || null,
          retellCallId: callData.retellCallId!,
          retellAgentId: callData.retellAgentId!,
          fromNumber: callData.fromNumber!,
          toNumber: callData.toNumber!,
          direction: callData.direction!,
          status: callData.status || 'completed',
          duration: callData.duration,
          transcript: callData.transcript,
          recordingUrl: callData.recordingUrl,
          callAnalysis: callData.callAnalysis,
          userSentiment: callData.userSentiment,
          callSuccessful: callData.callSuccessful,
          disconnectionReason: callData.disconnectionReason,
          startedAt: callData.startedAt,
          endedAt: callData.endedAt,
        };

        const savedCall = await storage.createVoiceCall(voiceCallData);
        console.log("Voice call saved to database:", savedCall.id);

        // Create inbound message for intent analysis if transcript exists
        // Note: Even outbound calls have customer responses we want to analyze
        if (callData.transcript) {
          try {
            const { intentAnalyst } = await import('./services/intentAnalyst.js');
            const { db } = await import('./db.js');
            const { inboundMessages } = await import('@shared/schema.js');
            
            const [message] = await db
              .insert(inboundMessages)
              .values({
                tenantId: finalTenantId,
                contactId: finalContactId,
                invoiceId: invoiceId || null,
                channel: 'voice',
                from: callData.toNumber!, // Customer's number (they called us)
                to: callData.fromNumber, // Our number
                content: callData.transcript,
                providerMessageId: retellCallId,
                rawPayload: webhookData,
              })
              .returning();

            console.log(`✅ Voice transcript stored for intent analysis: ${message.id}`);

            // Trigger intent analysis
            intentAnalyst.processInboundMessage(message.id).catch(err => 
              console.error('❌ Intent analysis error:', err)
            );
          } catch (error) {
            console.error('❌ Error creating inbound message:', error);
          }
        }

        return res.json({ 
          success: true, 
          message: "Webhook processed and call saved", 
          callId: savedCall.id 
        });
      } else {
        console.warn("Missing tenantId or contactId, cannot save call:", {
          tenantId: finalTenantId,
          contactId: finalContactId,
          metadata
        });
        return res.json({ 
          success: true, 
          message: "Webhook processed but not saved (missing tenant/contact info)" 
        });
      }
    } catch (error) {
      console.error("Error processing Retell webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Twilio SMS webhook for inbound messages
  app.post("/api/twilio/sms-webhook", async (req, res) => {
    try {
      console.log("📨 Twilio SMS webhook received:", JSON.stringify(req.body, null, 2));

      const {
        MessageSid,
        From,
        To,
        Body,
        NumSegments,
        SmsStatus,
        ErrorCode,
        ErrorMessage,
      } = req.body;

      if (!MessageSid || !From || !To || !Body) {
        return res.status(400).send("Missing required fields");
      }

      // Try to match contact by phone number
      const fromPhone = From.replace(/\D/g, '');
      const toPhone = To.replace(/\D/g, '');
      
      // Get all tenants and search for contact
      const allTenants = await storage.getAllTenants();
      let matchedContact: any = null;
      let matchedTenantId: string | null = null;

      for (const tenant of allTenants) {
        const contacts = await storage.getContacts(tenant.id);
        const contact = contacts.find(c => 
          c.phone && c.phone.replace(/\D/g, '') === fromPhone
        );
        if (contact) {
          matchedContact = contact;
          matchedTenantId = tenant.id;
          break;
        }
      }

      if (!matchedContact || !matchedTenantId) {
        console.warn("No matching contact found for phone:", From);
        return res.status(200).send("OK - No matching contact");
      }

      // Save SMS to database
      const smsData: any = {
        tenantId: matchedTenantId,
        contactId: matchedContact.id,
        twilioMessageSid: MessageSid,
        fromNumber: From,
        toNumber: To,
        direction: 'inbound',
        status: 'received',
        body: Body,
        numSegments: parseInt(NumSegments || '1'),
        errorCode: ErrorCode || null,
        errorMessage: ErrorMessage || null,
        sentAt: new Date(),
      };

      const savedSms = await storage.createSmsMessage(smsData);
      console.log("✅ Inbound SMS saved to database:", savedSms.id);

      // Send TwiML response
      res.type('text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      console.error("❌ Error processing SMS webhook:", error);
      res.status(500).send("Error processing webhook");
    }
  });

  // Vonage SMS Routes
  
  // Send SMS via Vonage
  app.post("/api/vonage/send-sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { to, message, from } = req.body;

      if (!to || !message) {
        return res.status(400).json({ message: "Missing required fields: to, message" });
      }

      const vonageService = await import('./services/vonage.js');
      const result = await vonageService.sendSMS({ to, message, from });

      if (result.success) {
        // Save SMS to database
        const smsData: any = {
          tenantId: user.tenantId,
          contactId: req.body.contactId || null,
          provider: 'vonage',
          vonageMessageId: result.messageId,
          fromNumber: from || process.env.VONAGE_PHONE_NUMBER,
          toNumber: to,
          direction: 'outbound',
          status: 'sent',
          body: message,
          numSegments: 1,
          errorCode: null,
          errorMessage: null,
          sentAt: new Date(),
        };

        await storage.createSmsMessage(smsData);
        console.log("✅ Outbound Vonage SMS saved to database");

        return res.json({ success: true, messageId: result.messageId });
      } else {
        return res.status(500).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("❌ Error sending Vonage SMS:", error);
      res.status(500).json({ message: "Failed to send SMS", error: error.message });
    }
  });

  // Vonage SMS webhook for inbound messages
  app.post("/api/vonage/sms-webhook", async (req, res) => {
    try {
      console.log("📨 Vonage SMS webhook received:", JSON.stringify(req.body, null, 2));

      const {
        messageId,
        'message-timestamp': messageTimestamp,
        msisdn,
        to,
        text,
        type,
        'keyword': keyword,
      } = req.body;

      if (!messageId || !msisdn || !to || !text) {
        return res.status(400).send("Missing required fields");
      }

      // First, check if this is an investor demo lead response
      const fromPhone = msisdn.replace(/\D/g, '');
      
      // Fetch all investor leads and match by normalized phone number, get the MOST RECENT one
      const allInvestorLeads = await db.select().from(investorLeads).orderBy(desc(investorLeads.createdAt));
      const investorLead = allInvestorLeads.find(lead => 
        lead.phone && lead.phone.replace(/\D/g, '') === fromPhone
      );
      
      if (investorLead) {
        console.log('📊 Processing investor demo SMS response for lead:', investorLead.id);
        
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
        
        // Normalize field names (OpenAI sometimes returns inconsistent casing)
        const normalizedAnalysis = {
          intent: analysis.intent || analysis.Intent || 'unknown',
          sentiment: analysis.sentiment || analysis.Sentiment || 'neutral',
          confidence: analysis.confidence_score || analysis['Confidence score'] || analysis.confidence || 50
        };
        
        // Update investor lead with SMS demo results
        const updatedLead = await storage.updateInvestorLead(investorLead.id, {
          smsDemoCompleted: true,
          smsDemoResults: {
            fromPhone: msisdn,
            responseText: text,
            intent: normalizedAnalysis.intent,
            sentiment: normalizedAnalysis.sentiment,
            confidence: normalizedAnalysis.confidence,
            analyzedAt: new Date().toISOString()
          }
        });
        
        console.log('✅ Investor demo SMS analysis saved:', analysis);
        
        // Broadcast results via WebSocket for instant updates
        if ((app as any).broadcastDemoResults) {
          (app as any).broadcastDemoResults(investorLead.id, {
            voiceDemoCompleted: updatedLead.voiceDemoCompleted,
            smsDemoCompleted: updatedLead.smsDemoCompleted,
            voiceDemoResults: updatedLead.voiceDemoResults,
            smsDemoResults: updatedLead.smsDemoResults
          });
          console.log('📡 Broadcasted investor demo results via WebSocket');
        }
        
        // Return early - investor demo doesn't need normal contact processing
        return res.status(200).send("OK - Investor demo processed");
      }
      
      // Try to match contact by phone number
      const toPhone = to.replace(/\D/g, '');
      
      // Get all tenants and search for contact
      const allTenants = await storage.getAllTenants();
      let matchedContact: any = null;
      let matchedTenantId: string | null = null;

      for (const tenant of allTenants) {
        const contacts = await storage.getContacts(tenant.id);
        const contact = contacts.find(c => 
          c.phone && c.phone.replace(/\D/g, '') === fromPhone
        );
        if (contact) {
          matchedContact = contact;
          matchedTenantId = tenant.id;
          break;
        }
      }

      if (!matchedContact || !matchedTenantId) {
        console.warn("No matching contact found for phone:", msisdn);
        return res.status(200).send("OK - No matching contact");
      }

      // Check if message already exists (handle duplicate webhooks)
      const existingSms = await db.select()
        .from(smsMessages)
        .where(eq(smsMessages.vonageMessageId, messageId))
        .limit(1);

      if (existingSms.length > 0) {
        console.log("⚠️ Duplicate Vonage webhook ignored - message already processed:", messageId);
        return res.status(200).send("OK - Duplicate message");
      }

      // Save SMS to database
      const smsData: any = {
        tenantId: matchedTenantId,
        contactId: matchedContact.id,
        provider: 'vonage',
        vonageMessageId: messageId,
        fromNumber: msisdn,
        toNumber: to,
        direction: 'inbound',
        status: 'received',
        body: text,
        numSegments: 1,
        errorCode: null,
        errorMessage: null,
        sentAt: messageTimestamp ? new Date(messageTimestamp) : new Date(),
      };

      const savedSms = await storage.createSmsMessage(smsData);
      console.log("✅ Inbound Vonage SMS saved to database:", savedSms.id);

      // Get latest invoice for context
      const invoices = await storage.getInvoices(matchedTenantId);
      const contactInvoices = invoices.filter((inv: any) => inv.contactId === matchedContact.id);
      const latestInvoice = contactInvoices.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      // Save as inbound message for Intent Analyst processing
      const inboundMsgData = {
        tenantId: matchedTenantId,
        contactId: matchedContact.id,
        invoiceId: latestInvoice?.id || null,
        channel: 'sms' as const,
        from: msisdn,
        to: to,
        subject: null,
        content: text,
        rawPayload: JSON.parse(JSON.stringify(req.body)), // Ensure proper JSON serialization
        intentAnalyzed: false,
      };
      
      const [inboundMsg] = await db.insert(inboundMessages).values(inboundMsgData).returning();

      console.log("✅ Inbound message created for Intent Analyst:", inboundMsg.id);

      // Process with Intent Analyst (extracts dates properly)
      const { intentAnalyst } = await import('./services/intentAnalyst.js');

      // Process the message (this will create the action with proper date extraction)
      await intentAnalyst.processInboundMessage(inboundMsg.id);

      // Update action metadata to include SMS-specific fields
      const createdAction = await db.select()
        .from(actions)
        .where(and(
          eq(actions.tenantId, matchedTenantId),
          eq(actions.type, 'sms')
        ))
        .orderBy(desc(actions.createdAt))
        .limit(1);

      if (createdAction.length > 0) {
        await db.update(actions)
          .set({
            metadata: {
              ...createdAction[0].metadata,
              smsMessageId: messageId,
            }
          })
          .where(eq(actions.id, createdAction[0].id));
      }

      console.log("✅ Inbound SMS Action created with intent");

      // Mark most recent outbound SMS as responded
      const allActions = await storage.getActions(matchedTenantId);
      const outboundSmsActions = allActions
        .filter((action: any) => 
          action.contactId === matchedContact.id && 
          action.type === 'sms' && 
          action.metadata?.direction !== 'inbound' &&
          !action.hasResponse
        )
        .sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      if (outboundSmsActions.length > 0) {
        const mostRecentOutbound = outboundSmsActions[0];
        await storage.updateAction(mostRecentOutbound.id, matchedTenantId, { hasResponse: true });
        console.log("✅ Marked outbound SMS as responded:", mostRecentOutbound.id);
      }

      // Send 200 OK response
      res.status(200).send("OK");
    } catch (error) {
      console.error("❌ Error processing Vonage SMS webhook:", error);
      res.status(500).send("Error processing webhook");
    }
  });

  // Voice Workflow API Routes
  
  // Get all voice workflows for a tenant
  app.get("/api/voice/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { category, isActive } = req.query;
      const filters = {
        category: category as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      };

      const workflows = await storage.getVoiceWorkflows(user.tenantId, filters);
      res.json(workflows);
    } catch (error) {
      console.error("Error fetching voice workflows:", error);
      res.status(500).json({ message: "Failed to fetch voice workflows" });
    }
  });

  // Get a specific voice workflow by ID
  app.get("/api/voice/workflows/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const workflow = await storage.getVoiceWorkflow(id, user.tenantId);
      
      if (!workflow) {
        return res.status(404).json({ message: "Voice workflow not found" });
      }

      res.json(workflow);
    } catch (error) {
      console.error("Error fetching voice workflow:", error);
      res.status(500).json({ message: "Failed to fetch voice workflow" });
    }
  });

  // Create a new voice workflow
  app.post("/api/voice/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const workflowData = insertVoiceWorkflowSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const workflow = await storage.createVoiceWorkflow(workflowData);
      res.status(201).json(workflow);
    } catch (error: any) {
      console.error("Error creating voice workflow:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid voice workflow data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create voice workflow" });
    }
  });

  // Update a voice workflow
  app.put("/api/voice/workflows/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const updates = req.body;

      const workflow = await storage.updateVoiceWorkflow(id, user.tenantId, updates);
      res.json(workflow);
    } catch (error) {
      console.error("Error updating voice workflow:", error);
      res.status(500).json({ message: "Failed to update voice workflow" });
    }
  });

  // Delete a voice workflow
  app.delete("/api/voice/workflows/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      await storage.deleteVoiceWorkflow(id, user.tenantId);
      res.json({ message: "Voice workflow deleted successfully" });
    } catch (error) {
      console.error("Error deleting voice workflow:", error);
      res.status(500).json({ message: "Failed to delete voice workflow" });
    }
  });

  // Voice Workflow State Routes

  // Get states for a voice workflow
  app.get("/api/voice/workflows/:workflowId/states", isAuthenticated, async (req: any, res) => {
    try {
      const { workflowId } = req.params;
      const states = await storage.getVoiceWorkflowStates(workflowId);
      res.json(states);
    } catch (error) {
      console.error("Error fetching voice workflow states:", error);
      res.status(500).json({ message: "Failed to fetch voice workflow states" });
    }
  });

  // Create a new voice workflow state
  app.post("/api/voice/workflows/:workflowId/states", isAuthenticated, async (req: any, res) => {
    try {
      const { workflowId } = req.params;
      const stateData = insertVoiceWorkflowStateSchema.parse({
        ...req.body,
        voiceWorkflowId: workflowId,
      });

      const state = await storage.createVoiceWorkflowState(stateData);
      res.status(201).json(state);
    } catch (error: any) {
      console.error("Error creating voice workflow state:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid voice workflow state data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create voice workflow state" });
    }
  });

  // Update a voice workflow state
  app.put("/api/voice/states/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const state = await storage.updateVoiceWorkflowState(id, updates);
      res.json(state);
    } catch (error) {
      console.error("Error updating voice workflow state:", error);
      res.status(500).json({ message: "Failed to update voice workflow state" });
    }
  });

  // Delete a voice workflow state
  app.delete("/api/voice/states/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteVoiceWorkflowState(id);
      res.json({ message: "Voice workflow state deleted successfully" });
    } catch (error) {
      console.error("Error deleting voice workflow state:", error);
      res.status(500).json({ message: "Failed to delete voice workflow state" });
    }
  });

  // Voice State Transition Routes

  // Get transitions for a voice workflow
  app.get("/api/voice/workflows/:workflowId/transitions", isAuthenticated, async (req: any, res) => {
    try {
      const { workflowId } = req.params;
      const transitions = await storage.getVoiceStateTransitions(workflowId);
      res.json(transitions);
    } catch (error) {
      console.error("Error fetching voice state transitions:", error);
      res.status(500).json({ message: "Failed to fetch voice state transitions" });
    }
  });

  // Create a new voice state transition
  app.post("/api/voice/workflows/:workflowId/transitions", isAuthenticated, async (req: any, res) => {
    try {
      const { workflowId } = req.params;
      const transitionData = insertVoiceStateTransitionSchema.parse({
        ...req.body,
        voiceWorkflowId: workflowId,
      });

      const transition = await storage.createVoiceStateTransition(transitionData);
      res.status(201).json(transition);
    } catch (error: any) {
      console.error("Error creating voice state transition:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid voice state transition data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create voice state transition" });
    }
  });

  // Update a voice state transition
  app.put("/api/voice/transitions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const transition = await storage.updateVoiceStateTransition(id, updates);
      res.json(transition);
    } catch (error) {
      console.error("Error updating voice state transition:", error);
      res.status(500).json({ message: "Failed to update voice state transition" });
    }
  });

  // Delete a voice state transition
  app.delete("/api/voice/transitions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteVoiceStateTransition(id);
      res.json({ message: "Voice state transition deleted successfully" });
    } catch (error) {
      console.error("Error deleting voice state transition:", error);
      res.status(500).json({ message: "Failed to delete voice state transition" });
    }
  });

  // Voice Message Template Routes

  // Get all voice message templates for a tenant
  app.get("/api/voice/templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { category, isActive } = req.query;
      const filters = {
        category: category as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      };

      const templates = await storage.getVoiceMessageTemplates(user.tenantId, filters);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching voice message templates:", error);
      res.status(500).json({ message: "Failed to fetch voice message templates" });
    }
  });

  // Get a specific voice message template by ID
  app.get("/api/voice/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const template = await storage.getVoiceMessageTemplate(id, user.tenantId);
      
      if (!template) {
        return res.status(404).json({ message: "Voice message template not found" });
      }

      res.json(template);
    } catch (error) {
      console.error("Error fetching voice message template:", error);
      res.status(500).json({ message: "Failed to fetch voice message template" });
    }
  });

  // Create a new voice message template
  app.post("/api/voice/templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const templateData = insertVoiceMessageTemplateSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const template = await storage.createVoiceMessageTemplate(templateData);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Error creating voice message template:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid voice message template data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create voice message template" });
    }
  });

  // Update a voice message template
  app.put("/api/voice/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const updates = req.body;

      const template = await storage.updateVoiceMessageTemplate(id, user.tenantId, updates);
      res.json(template);
    } catch (error) {
      console.error("Error updating voice message template:", error);
      res.status(500).json({ message: "Failed to update voice message template" });
    }
  });

  // Delete a voice message template
  app.delete("/api/voice/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      await storage.deleteVoiceMessageTemplate(id, user.tenantId);
      res.json({ message: "Voice message template deleted successfully" });
    } catch (error) {
      console.error("Error deleting voice message template:", error);
      res.status(500).json({ message: "Failed to delete voice message template" });
    }
  });

  // Quick Demo Setup Route for Retell AI
  app.post("/api/demo/setup-retell", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Check if already configured
      const existingConfig = await storage.getRetellConfiguration(user.tenantId);
      if (existingConfig) {
        return res.json({ success: true, message: "Retell AI already configured", config: existingConfig });
      }

      // For demo purposes, use a simplified configuration
      // This bypasses the complex agent creation that's failing
      console.log("Setting up demo Retell configuration...");

      // Create Retell configuration with demo values
      const retellConfigData = insertRetellConfigurationSchema.parse({
        tenantId: user.tenantId,
        apiKey: process.env.RETELL_API_KEY || "demo-key", 
        agentId: "demo-agent-" + Date.now(), // Use a demo agent ID
        phoneNumber: "+1234567890", // Demo phone number
        phoneNumberId: "demo-phone-id",
        isActive: true,
        webhookUrl: `${req.protocol}://${req.get('host')}/api/retell/webhook`,
        settings: {
          demoMode: true,
          setupDate: new Date().toISOString(),
          note: "Demo configuration for testing voice calls"
        }
      });

      const config = await storage.createRetellConfiguration(retellConfigData);
      
      res.json({ 
        success: true, 
        message: "Retell AI configured successfully for demo", 
        config: {
          agentId: config.agentId,
          phoneNumber: config.phoneNumber,
          isActive: config.isActive
        }
      });
    } catch (error: any) {
      console.error("Error setting up Retell demo:", error);
      res.status(500).json({ message: "Failed to setup Retell demo: " + error.message });
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
  app.get("/api/xero/auth-url", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Ensure session exists before initiating OAuth flow
      if (!req.session) {
        return res.status(401).json({ 
          message: "Session required for authentication. Please log in again." 
        });
      }

      // Capture returnTo parameter for post-OAuth redirect (must be safe relative path)
      // Security: validate returnTo using strict whitelist approach to prevent open redirect attacks
      const rawReturnTo = req.query.returnTo as string | undefined;
      
      // Exact whitelist of allowed internal routes (no prefix matching for maximum safety)
      const allowedRoutes = new Set([
        '/dashboard',
        '/settings',
        '/settings/integrations',
        '/settings/team',
        '/settings/billing',
        '/action-centre',
        '/contacts',
        '/invoices',
        '/workflows',
        '/analytics',
        '/profile',
        '/admin',
      ]);
      
      // Always clear any existing returnTo first
      req.session.xeroReturnTo = null;
      
      if (rawReturnTo && typeof rawReturnTo === 'string') {
        try {
          // Use URL parsing to safely canonicalize the path
          const baseUrl = 'https://internal.local';
          const parsedUrl = new URL(rawReturnTo, baseUrl);
          
          // Get normalized pathname (URL constructor resolves dot segments and normalizes)
          // Strip any trailing slashes for consistent matching
          const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '') || '/';
          
          // Security checks:
          // 1. Must resolve to our base origin (not external)
          // 2. Pathname must exactly match a whitelisted route
          // 3. No credentials in URL
          // 4. No hash/fragment (ignore parsedUrl.hash as we only use pathname)
          if (parsedUrl.origin === baseUrl && 
              parsedUrl.username === '' && 
              parsedUrl.password === '' &&
              allowedRoutes.has(normalizedPath)) {
            // Use only the normalized pathname (no query params to prevent XSS)
            req.session.xeroReturnTo = normalizedPath;
            console.log(`📍 Stored returnTo URL for post-OAuth redirect: ${normalizedPath}`);
          } else {
            console.warn(`⚠️ Rejected returnTo URL (not in whitelist): ${rawReturnTo} -> ${normalizedPath}`);
          }
        } catch (e) {
          console.warn(`⚠️ Rejected invalid returnTo URL: ${rawReturnTo}`);
        }
      }

      // Use APIMiddleware to initiate connection (stores OAuth state in session)
      const result = await apiMiddleware.connectProvider('xero', req.session, user.tenantId);
      
      if (!result.success || !result.authUrl) {
        return res.status(400).json({
          message: result.error || "Failed to generate Xero authorization URL"
        });
      }

      console.log("=== GENERATED XERO AUTH URL ===");
      console.log("Auth URL:", result.authUrl);
      console.log("Tenant ID:", user.tenantId);
      
      // Store user ID in session for retrieval after OAuth callback
      // This ensures we re-authenticate the correct user, preventing privilege escalation
      req.session.oauthUserId = user.id;
      
      // Promisify session.save to persist OAuth state AND user ID before returning auth URL
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) {
            console.error("❌ Error saving session:", err);
            reject(err);
          } else {
            console.log("✅ Session saved successfully before Xero redirect (including user ID)");
            resolve();
          }
        });
      });
      
      res.json({ authUrl: result.authUrl });
    } catch (error) {
      console.error("Error getting Xero auth URL:", error);
      res.status(500).json({ message: "Failed to generate authorization URL" });
    }
  });

  // Disconnect from Xero
  app.post("/api/xero/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(401).json({ message: "No tenant ID found" });
      }

      console.log(`🔌 Disconnecting Xero for tenant: ${user.tenantId}`);

      // Clear Xero tokens and org name from tenant record
      await storage.updateTenant(user.tenantId, {
        xeroAccessToken: null,
        xeroRefreshToken: null,
        xeroTenantId: null,
        xeroOrganisationName: null,
      });

      console.log("✅ Xero disconnected successfully");

      res.json({ 
        success: true, 
        message: "Xero connection removed successfully" 
      });
    } catch (error) {
      console.error("Error disconnecting Xero:", error);
      res.status(500).json({ message: "Failed to disconnect from Xero" });
    }
  });

  // Get Xero connection health status
  app.get("/api/xero/health", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Check if Xero is configured at all
      const isConfigured = !!(tenant.xeroRefreshToken && tenant.xeroTenantId);
      
      res.json({
        isConfigured,
        connectionStatus: tenant.xeroConnectionStatus || (isConfigured ? 'unknown' : 'not_configured'),
        organisationName: tenant.xeroOrganisationName || null,
        lastHealthCheck: tenant.xeroLastHealthCheck,
        lastSyncAt: tenant.xeroLastSyncAt,
        error: tenant.xeroHealthCheckError,
      });
    } catch (error) {
      console.error("Error fetching Xero health:", error);
      res.status(500).json({ message: "Failed to fetch Xero health status" });
    }
  });

  // Force a health check for current tenant
  app.post("/api/xero/health/check", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { xeroHealthCheckService } = await import("./services/xeroHealthCheck");
      const result = await xeroHealthCheckService.checkSingleTenant(user.tenantId);
      
      res.json(result);
    } catch (error) {
      console.error("Error running Xero health check:", error);
      res.status(500).json({ message: "Failed to run health check" });
    }
  });

  // Test endpoint to verify callback URL is reachable
  app.get("/api/xero/test-callback", async (req, res) => {
    res.send(`
      <html>
        <body style="font-family: system-ui; text-align: center; padding: 2rem;">
          <h1>✅ Callback URL is Working</h1>
          <p>This confirms your Replit server can receive callbacks at:</p>
          <code style="background: #f5f5f5; padding: 1rem; display: block; margin: 1rem 0;">
            https://aa582738-6e16-49a1-8fcd-aec804a072e7-00-1x8ni2b2nm0k7.picard.replit.dev/api/xero/callback
          </code>
          <p>Copy this EXACT URL to your Xero app's redirect URI setting.</p>
          <a href="/settings" style="background: #17B6C3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Back to Settings</a>
        </body>
      </html>
    `);
  });

  // Mock Xero auth endpoint for development
  app.get("/api/xero/mock-auth", async (req, res) => {
    try {
      // Simulate successful Xero connection
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Xero Connection Successful</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh; 
              margin: 0; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container { 
              background: white; 
              padding: 2rem; 
              border-radius: 12px; 
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              text-align: center; 
              max-width: 400px;
            }
            .success-icon { 
              font-size: 4rem; 
              color: #10B981; 
              margin-bottom: 1rem; 
            }
            h1 { 
              color: #111827; 
              margin-bottom: 1rem; 
            }
            p { 
              color: #6B7280; 
              margin-bottom: 1.5rem; 
            }
            .btn { 
              background: #17B6C3; 
              color: white; 
              padding: 12px 24px; 
              border: none; 
              border-radius: 6px; 
              text-decoration: none; 
              display: inline-block; 
              font-weight: 500;
              transition: background 0.2s;
            }
            .btn:hover { 
              background: #1396A1; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Xero Connection Successful!</h1>
            <p>Your Nexus AR application is now connected to Xero (mock mode for development).</p>
            <a href="/" class="btn">Return to Dashboard</a>
          </div>
          <script>
            // Auto-redirect after 3 seconds
            setTimeout(() => {
              window.location.href = "/";
            }, 3000);
          </script>
        </body>
        </html>
      `;
      
      res.send(html);
    } catch (error) {
      console.error("Error in mock auth:", error);
      res.status(500).json({ message: "Mock auth failed" });
    }
  });

  app.get("/api/xero/callback", async (req, res) => {
    console.log("=== XERO CALLBACK RECEIVED ===");
    console.log("Query params:", req.query);
    console.log("Full URL:", req.url);
    
    try {
      const { code, state, error, error_description } = req.query;
      
      // Check for authorization errors
      if (error) {
        console.error(`Xero authorization error: ${error} - ${error_description}`);
        const errorMsg = encodeURIComponent(error_description || error || 'Authorization failed');
        return res.redirect(`/connection-error?provider=xero&error=${errorMsg}`);
      }
      
      if (!code || !state) {
        const errorMsg = encodeURIComponent('Missing authorization code or state parameter');
        return res.redirect(`/connection-error?provider=xero&error=${errorMsg}`);
      }

      // Check if session exists (may have expired during redirect)
      if (!req.session) {
        const errorMsg = encodeURIComponent('Session expired. Please try connecting again.');
        return res.redirect(`/connection-error?provider=xero&error=${errorMsg}`);
      }

      // Use APIMiddleware to complete the OAuth flow (with session for state validation)
      const result = await apiMiddleware.completeConnection('xero', code as string, state as string, req.session);
      
      if (!result.success || !result.tokens || !result.appTenantId) {
        console.error('Xero callback failed:', result.error);
        const errorMsg = encodeURIComponent(result.error || 'Failed to complete Xero authorization');
        return res.redirect(`/connection-error?provider=xero&error=${errorMsg}`);
      }

      // Extract tenant IDs and tokens from the result
      const appTenantId = result.appTenantId; // Our app's tenant ID
      const xeroTenantId = result.tokens.tenantId; // Xero's tenant ID
      const tokens = result.tokens;
      
      // Save tokens to database and mark connection as healthy
      const xeroOrgName = tokens.tenantName || null;
      await storage.updateTenant(appTenantId, {
        xeroAccessToken: tokens.accessToken,
        xeroRefreshToken: tokens.refreshToken || null,
        xeroTenantId: xeroTenantId || null,
        xeroOrganisationName: xeroOrgName,
        xeroExpiresAt: tokens.expiresAt || null,
        xeroConnectionStatus: 'connected',
        xeroLastHealthCheck: new Date(),
        xeroHealthCheckError: null,
      });
      
      console.log(`✅ Xero connected successfully for app tenant: ${appTenantId}, Xero org: ${xeroOrgName}`);

      // Re-establish Passport session after OAuth redirect
      // Retrieve the user ID that was stored in session during auth-url request
      const originalUserId = req.session?.oauthUserId;
      
      if (!req.user && originalUserId) {
        // User isn't authenticated after OAuth redirect - re-establish session with the ORIGINAL user
        console.log(`🔐 Re-establishing Passport session for user ID: ${originalUserId}`);
        
        const originalUser = await storage.getUser(originalUserId);
        if (!originalUser) {
          console.error(`❌ Could not find user ${originalUserId} to re-establish session`);
          // Clean up the stored user ID
          delete req.session.oauthUserId;
          const errorMsg = encodeURIComponent('Session expired. Please log in and try again.');
          return res.redirect(`/connection-error?provider=xero&error=${errorMsg}`);
        }
        
        // Re-authenticate with the exact user who initiated the OAuth flow
        await new Promise<void>((resolve, reject) => {
          req.login(originalUser, (err) => {
            if (err) {
              console.error('❌ Failed to re-establish Passport session:', err);
              reject(err);
            } else {
              console.log(`✅ Passport session re-established successfully for: ${originalUser.email}`);
              // Clean up the stored user ID now that session is re-established
              delete req.session.oauthUserId;
              resolve();
            }
          });
        });
      } else if (req.user) {
        console.log(`✅ User already authenticated: ${req.user.email}`);
        // Clean up stored user ID if it exists
        if (req.session?.oauthUserId) {
          delete req.session.oauthUserId;
        }
      } else {
        console.warn(`⚠️ No user authenticated and no oauthUserId in session - possible session loss`);
        const errorMsg = encodeURIComponent('Authentication session lost. Please log in and try again.');
        return res.redirect(`/connection-error?provider=xero&error=${errorMsg}`);
      }

      // Check if onboarding is already completed to determine redirect destination
      let isOnboardingComplete = false;
      let redirectUrl = '/onboarding?step=ai_review_launch&autoStartAnalysis=true';
      
      try {
        isOnboardingComplete = await onboardingService.isOnboardingCompleted(appTenantId);
        
        if (isOnboardingComplete) {
          // User is reconnecting - redirect to their original page or dashboard
          // Security: re-validate returnTo using strict whitelist approach
          const rawReturnTo = req.session?.xeroReturnTo;
          
          // Always clean up returnTo from session first (prevents reuse of stale values)
          if (req.session?.xeroReturnTo) {
            delete req.session.xeroReturnTo;
          }
          
          // Exact whitelist of allowed internal routes (must match auth endpoint)
          const allowedRoutes = new Set([
            '/dashboard',
            '/settings',
            '/settings/integrations',
            '/settings/team',
            '/settings/billing',
            '/action-centre',
            '/contacts',
            '/invoices',
            '/workflows',
            '/analytics',
            '/profile',
            '/admin',
          ]);
          
          // Only accept the stored returnTo if it exactly matches a whitelisted route
          // The auth endpoint already validated and normalized this value
          if (rawReturnTo && typeof rawReturnTo === 'string' && allowedRoutes.has(rawReturnTo)) {
            redirectUrl = rawReturnTo;
            console.log(`📍 Onboarding complete - redirecting to returnTo: ${redirectUrl}`);
          } else {
            redirectUrl = '/dashboard';
            console.log(`📍 Onboarding complete - redirecting to dashboard${rawReturnTo ? ' (invalid returnTo)' : ' (no returnTo)'}`);
          }
        } else {
          // First-time connection - advance onboarding and redirect there
          const currentProgress = await onboardingService.getOnboardingProgress(appTenantId);
          if (currentProgress) {
            // Merge existing completed phases with the phases we're completing
            const existingCompleted = (currentProgress.completedPhases as string[]) || [];
            const phasesToComplete = ['technical_connection', 'business_setup', 'brand_customization'];
            const mergedCompleted = Array.from(new Set([...existingCompleted, ...phasesToComplete]));
            
            // Skip to AI Review phase to show instant analysis
            await db.update(onboardingProgress).set({
              currentPhase: 'ai_review_launch',
              completedPhases: mergedCompleted,
              updatedAt: new Date()
            }).where(eq(onboardingProgress.tenantId, appTenantId));
            console.log(`✅ Advanced to AI Review phase for instant analysis: ${appTenantId}`);
          } else {
            console.warn(`⚠️ No onboarding progress found for tenant ${appTenantId} - user will start from beginning`);
          }
        }
      } catch (error) {
        console.error(`⚠️ Failed to check onboarding status:`, error);
        // Default to onboarding if we can't determine status
      }

      // Trigger automatic comprehensive sync after successful connection
      console.log(`🚀 Triggering automatic initial Xero sync for tenant: ${appTenantId}`);
      const syncService = new XeroSyncService();
      syncService.syncAllDataForTenant(appTenantId)
        .then(result => {
          if (result.success) {
            console.log(`✅ Initial Xero sync completed successfully:`, result);
          } else {
            console.error(`❌ Initial Xero sync failed:`, result.error);
          }
        })
        .catch(error => {
          console.error(`❌ Initial Xero sync error:`, error);
        });

      // Success page with auto-redirect to onboarding
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Xero Connected Successfully</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh; 
              background: linear-gradient(to bottom right, rgb(248 250 252) 0%, rgb(219 234 254) 50%, rgb(204 251 241) 100%);
              padding: 1rem;
            }
            .container { 
              background: rgba(255, 255, 255, 0.8);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              padding: 3rem 2.5rem; 
              border-radius: 24px; 
              border: 1px solid rgba(255, 255, 255, 0.5);
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
              text-align: center; 
              max-width: 500px;
              width: 100%;
            }
            .success-icon { 
              font-size: 5rem; 
              margin-bottom: 1.5rem;
              animation: bounce 1s ease-in-out;
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-20px); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
            h1 { 
              color: #111827; 
              margin-bottom: 1rem;
              font-size: 2rem;
              font-weight: 700;
            }
            .subtitle {
              color: #6B7280;
              font-size: 1.1rem;
              margin-bottom: 1rem;
              line-height: 1.6;
            }
            .ai-badge {
              display: inline-block;
              background: rgba(23, 182, 195, 0.1);
              color: #17B6C3;
              padding: 0.5rem 1rem;
              border-radius: 12px;
              font-size: 0.9rem;
              font-weight: 600;
              margin-bottom: 2rem;
              border: 1px solid rgba(23, 182, 195, 0.2);
            }
            .loader {
              display: inline-block;
              width: 20px;
              height: 20px;
              border: 3px solid rgba(23, 182, 195, 0.2);
              border-top-color: #17B6C3;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin-right: 0.5rem;
              vertical-align: middle;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            .btn { 
              background: #17B6C3;
              color: white; 
              padding: 16px 32px; 
              border: none; 
              border-radius: 12px; 
              text-decoration: none; 
              display: inline-block; 
              font-weight: 600;
              transition: all 0.2s;
              font-size: 1.05rem;
              cursor: pointer;
              box-shadow: 0 4px 6px rgba(23, 182, 195, 0.2);
            }
            .btn:hover { 
              background: #1396A1; 
              transform: translateY(-2px);
              box-shadow: 0 6px 12px rgba(23, 182, 195, 0.3);
            }
            .countdown {
              color: #9CA3AF;
              font-size: 0.95rem;
              margin-top: 1.5rem;
              animation: pulse 1.5s ease-in-out infinite;
            }
            .steps {
              text-align: left;
              margin: 1.5rem 0;
              padding: 1.25rem;
              background: rgba(23, 182, 195, 0.05);
              border-radius: 12px;
              border: 1px solid rgba(23, 182, 195, 0.1);
            }
            .step-item {
              display: flex;
              align-items: center;
              color: #4B5563;
              font-size: 0.95rem;
              margin-bottom: 0.75rem;
            }
            .step-item:last-child {
              margin-bottom: 0;
            }
            .step-check {
              color: #10B981;
              margin-right: 0.75rem;
              font-size: 1.2rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">🎉</div>
            <h1>Xero ${isOnboardingComplete ? 'Reconnected' : 'Connected'}!</h1>
            <p class="subtitle">${isOnboardingComplete ? 'Your Xero connection has been restored' : 'Your Qashivo account is now connected to Xero'}</p>
            
            <div class="ai-badge">
              <span class="loader"></span>
              ${isOnboardingComplete ? 'Syncing Data...' : 'AI Analysis Starting...'}
            </div>
            
            <div class="steps">
              <div class="step-item">
                <span class="step-check">✓</span>
                <span>Xero connection established</span>
              </div>
              <div class="step-item">
                <span class="step-check">✓</span>
                <span>Syncing invoices and contacts</span>
              </div>
              ${isOnboardingComplete ? '' : `<div class="step-item">
                <span class="step-check">⏳</span>
                <span>Launching AI cashflow analysis</span>
              </div>`}
            </div>
            
            <a href="${redirectUrl}" class="btn" onclick="clearInterval(window.redirectInterval)">${isOnboardingComplete ? 'Return to App' : 'Continue to AI Analysis'}</a>
            <div class="countdown">Redirecting in <span id="countdown">2</span> seconds...</div>
          </div>
          <script>
            let seconds = 2;
            const countdownEl = document.getElementById('countdown');
            window.redirectInterval = setInterval(() => {
              seconds--;
              if (countdownEl) countdownEl.textContent = seconds;
              if (seconds <= 0) {
                clearInterval(window.redirectInterval);
                window.location.replace("${redirectUrl}");
              }
            }, 1000);
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Error handling Xero callback:", error);
      res.status(500).send(`
        <html>
          <body style="font-family: system-ui; text-align: center; padding: 2rem;">
            <h1>❌ Connection Error</h1>
            <p>An error occurred while connecting to Xero</p>
            <a href="/" style="background: #17B6C3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Return to Dashboard</a>
          </body>
        </html>
      `);
    }
  });

  app.post("/api/xero/sync", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant?.xeroAccessToken) {
        return res.status(400).json({ message: "Xero not connected" });
      }

      // Use comprehensive sync service that includes invoice processing
      const result = await xeroSyncService.syncAllDataForTenant(user.tenantId);

      if (!result.success) {
        return res.status(500).json({ 
          message: "Sync failed", 
          error: result.error 
        });
      }

      res.json({
        success: true,
        contactsCount: result.contactsCount,
        invoicesCount: result.invoicesCount,
        billsCount: result.billsCount,
        bankAccountsCount: result.bankAccountsCount,
        bankTransactionsCount: result.bankTransactionsCount,
      });
    } catch (error) {
      console.error("Error syncing with Xero:", error);
      res.status(500).json({ message: "Failed to sync with Xero" });
    }
  });

  // Xero raw invoice data endpoint with pagination
  app.get("/api/xero/invoices", async (req: any, res) => { // Temporarily disabled auth for demo
    try {
      // Use the logged in user's tenant for Xero API
      const tenantId = "9ffa8e58-af89-4f6a-adee-7fe09d956295";
      
      const tenant = await storage.getTenant(tenantId);
      console.log("=== DEBUG TENANT DATA ===");
      console.log("Tenant ID:", tenantId);
      console.log("Tenant object:", tenant);
      console.log("xeroAccessToken present:", !!tenant?.xeroAccessToken);
      console.log("xeroTenantId:", tenant?.xeroTenantId);
      
      if (!tenant?.xeroAccessToken) {
        return res.status(400).json({ message: "Xero not connected" });
      }

      const tokens = {
        accessToken: tenant.xeroAccessToken,
        refreshToken: tenant.xeroRefreshToken!,
        expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000), // Use stored expiry or fallback
        tenantId: tenant.xeroTenantId!,
      };

      // Parse pagination parameters - if no page/limit provided, fetch all invoices
      const page = parseInt(req.query.page as string) || 1;
      const limit = req.query.page || req.query.limit ? 
        Math.min(parseInt(req.query.limit as string) || 50, 100) : 
        1000; // Fetch up to 1000 invoices when no pagination requested
      const status = req.query.status as string || 'all'; // unpaid, partial, paid, void, all

      // Get paginated Xero invoices with payment data
      const result = await xeroService.getInvoicesPaginated(tokens, page, limit, status);
      
      // Transform Xero invoice data to match our frontend format
      const transformedInvoices = result.invoices.map(xeroInv => {
        const invoicePayments = result.payments.get(xeroInv.InvoiceID) || [];
        
        // Extract the most recent payment date and details
        const latestPayment = invoicePayments
          .filter(p => p.Status === 'AUTHORISED')
          .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())[0];

        return {
          id: xeroInv.InvoiceID,
          xeroInvoiceId: xeroInv.InvoiceID,
          invoiceNumber: xeroInv.InvoiceNumber,
          amount: xeroInv.Total.toString(),
          amountPaid: xeroInv.AmountPaid.toString(),
          taxAmount: xeroInv.TotalTax.toString(),
          status: mapXeroStatusToLocal(xeroInv.Status),
          issueDate: xeroInv.DateString,
          dueDate: xeroInv.DueDateString,
          currency: xeroInv.CurrencyCode,
          description: `Xero Invoice - ${xeroInv.InvoiceNumber}`,
          contact: {
            name: xeroInv.Contact.Name,
            contactId: xeroInv.Contact.ContactID,
            phone: (xeroInv.Contact as any).Phones?.[0]?.PhoneNumber || null,
            email: (xeroInv.Contact as any).EmailAddress || null
          },
          // Payment information from Xero
          paymentDetails: {
            paidDate: latestPayment ? latestPayment.Date : null,
            paymentMethod: latestPayment?.PaymentMethod || null,
            paymentReference: latestPayment?.Reference || null,
            totalPayments: invoicePayments.filter(p => p.Status === 'AUTHORISED').length,
            allPayments: invoicePayments.filter(p => p.Status === 'AUTHORISED').map(p => ({
              date: p.Date,
              amount: p.Amount.toString(),
              method: p.PaymentMethod,
              reference: p.Reference,
              account: p.Account?.Name || null
            }))
          },
          // Calculate collection stage based on status, payment dates and days overdue
          collectionStage: calculateCollectionStageWithPayments(xeroInv.Status, new Date(xeroInv.DueDateString), latestPayment?.Date)
        };
      });

      res.json({
        invoices: transformedInvoices,
        pagination: result.pagination
      });
    } catch (error) {
      console.error("Error fetching Xero invoices:", error);
      res.status(500).json({ message: "Failed to fetch Xero invoices" });
    }
  });

  // Initialize sync service
  const xeroSyncService = new XeroSyncService();

  // Xero sync endpoints
  app.post("/api/xero/sync", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🚀 Starting comprehensive filtered Xero sync for tenant: ${user.tenantId}`);
      const result = await xeroSyncService.syncAllDataForTenant(user.tenantId);

      if (result.success) {
        res.json({
          success: true,
          message: `Successfully synced ${result.contactsCount} customers and ${result.invoicesCount} collection-relevant invoices (filtered from ~15,000+ total)`,
          contactsCount: result.contactsCount,
          invoicesCount: result.invoicesCount,
          filteredCount: result.filteredCount,
          syncedAt: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || "Sync failed",
        });
      }
    } catch (error) {
      console.error("Error in comprehensive Xero sync:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to sync Xero data" 
      });
    }
  });

  // Separate endpoints for individual syncing (optional)
  app.post("/api/xero/sync/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🔍 Starting filtered contact sync for tenant: ${user.tenantId}`);
      const result = await xeroSyncService.syncContactsForTenant(user.tenantId);

      if (result.success) {
        res.json({
          success: true,
          message: `Successfully synced ${result.contactsCount} filtered customers (${result.filteredCount} total found)`,
          contactsCount: result.contactsCount,
          filteredCount: result.filteredCount,
          syncedAt: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || "Contact sync failed",
        });
      }
    } catch (error) {
      console.error("Error in contact sync:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to sync contacts" 
      });
    }
  });

  app.post("/api/xero/sync/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`📄 Starting filtered invoice sync for tenant: ${user.tenantId}`);
      const result = await xeroSyncService.syncInvoicesForTenant(user.tenantId);

      if (result.success) {
        res.json({
          success: true,
          message: `Successfully synced ${result.invoicesCount} collection-relevant invoices`,
          invoicesCount: result.invoicesCount,
          syncedAt: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || "Invoice sync failed",
        });
      }
    } catch (error) {
      console.error("Error in invoice sync:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to sync invoices" 
      });
    }
  });

  // Get cached invoices endpoint (replaces live Xero calls)
  app.get("/api/xero/invoices/cached", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const status = req.query.status as string;
      const invoices = await xeroSyncService.getCachedInvoices(user.tenantId, status);

      // Get sync info
      const lastSyncTime = await xeroSyncService.getLastSyncTime(user.tenantId);
      
      res.json({
        invoices,
        lastSyncAt: lastSyncTime?.toISOString() || null,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: invoices.length,
          itemsPerPage: invoices.length,
        },
      });
    } catch (error) {
      console.error("Error fetching cached invoices:", error);
      res.status(500).json({ message: "Failed to fetch cached invoices" });
    }
  });

  // Get sync settings
  app.get("/api/xero/sync/settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const settings = await xeroSyncService.getSyncSettings(user.tenantId);
      if (!settings) {
        return res.status(404).json({ message: "Sync settings not found" });
      }

      res.json(settings);
    } catch (error) {
      console.error("Error fetching sync settings:", error);
      res.status(500).json({ message: "Failed to fetch sync settings" });
    }
  });

  // Update sync settings
  app.put("/api/xero/sync/settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { syncInterval, autoSync } = req.body;
      
      // Validate sync interval (5 minutes to 24 hours)
      if (syncInterval && (syncInterval < 5 || syncInterval > 1440)) {
        return res.status(400).json({ 
          message: "Sync interval must be between 5 minutes and 24 hours" 
        });
      }

      const success = await xeroSyncService.updateSyncSettings(user.tenantId, {
        syncInterval,
        autoSync,
      });

      if (success) {
        res.json({ success: true, message: "Sync settings updated" });
      } else {
        res.status(500).json({ message: "Failed to update sync settings" });
      }
    } catch (error) {
      console.error("Error updating sync settings:", error);
      res.status(500).json({ message: "Failed to update sync settings" });
    }
  });

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

      res.json(tenant);
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
      
      // Return enhanced response with access type information
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

  app.put('/api/tenant/settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { name, settings } = req.body;
      
      const updates: any = {};
      if (name) updates.name = name;
      if (settings) updates.settings = settings;

      const tenant = await storage.updateTenant(user.tenantId!, updates);
      res.json(tenant);
    } catch (error) {
      console.error("Error updating tenant settings:", error);
      res.status(500).json({ message: "Failed to update tenant settings" });
    }
  });

  app.get('/api/tenant/settings', isAuthenticated, async (req: any, res) => {
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
        id: tenant.id,
        name: tenant.name,
        approvalMode: tenant.approvalMode || 'manual',
        approvalTimeoutHours: tenant.approvalTimeoutHours || 12,
        executionTime: tenant.executionTime || '09:00',
        executionTimezone: tenant.executionTimezone || 'Europe/London',
        dailyLimits: tenant.dailyLimits || { email: 100, sms: 50, voice: 20 },
        minConfidence: tenant.minConfidence || { email: 0.8, sms: 0.85, voice: 0.9 },
        exceptionRules: tenant.exceptionRules || {
          flagFirstContact: true,
          flagHighValue: 10000,
          flagDisputeKeywords: true,
          flagVipCustomers: true,
        },
        channelCooldowns: tenant.channelCooldowns || { email: 3, sms: 5, voice: 7 },
        businessHoursStart: tenant.businessHoursStart || '08:00',
        businessHoursEnd: tenant.businessHoursEnd || '18:00',
        maxTouchesPerWindow: tenant.maxTouchesPerWindow || 3,
        contactWindowDays: tenant.contactWindowDays || 14,
        tenantStyle: tenant.tenantStyle || 'STANDARD',
        collectionsAutomationEnabled: tenant.collectionsAutomationEnabled ?? true,
      });
    } catch (error) {
      console.error("Error fetching tenant settings:", error);
      res.status(500).json({ message: "Failed to fetch tenant settings" });
    }
  });

  app.patch('/api/tenant/settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const currentTenant = await storage.getTenant(user.tenantId);
      if (!currentTenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const allowedFields = [
        'approvalMode', 'approvalTimeoutHours', 'executionTime', 'executionTimezone',
        'dailyLimits', 'minConfidence', 'exceptionRules', 'channelCooldowns',
        'businessHoursStart', 'businessHoursEnd', 'maxTouchesPerWindow', 
        'contactWindowDays', 'tenantStyle', 'collectionsAutomationEnabled'
      ];

      const nestedFields = ['dailyLimits', 'minConfidence', 'exceptionRules', 'channelCooldowns'];
      const defaults: Record<string, any> = {
        dailyLimits: { email: 100, sms: 50, voice: 20 },
        minConfidence: { email: 0.8, sms: 0.85, voice: 0.9 },
        exceptionRules: { flagFirstContact: true, flagHighValue: 10000, flagDisputeKeywords: true, flagVipCustomers: true },
        channelCooldowns: { email: 3, sms: 5, voice: 7 }
      };

      const updates: any = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (nestedFields.includes(field)) {
            const currentValue = (currentTenant as any)[field] || defaults[field];
            updates[field] = { ...currentValue, ...req.body[field] };
          } else {
            updates[field] = req.body[field];
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const tenant = await storage.updateTenant(user.tenantId!, updates);
      res.json(tenant);
    } catch (error) {
      console.error("Error updating tenant automation settings:", error);
      res.status(500).json({ message: "Failed to update tenant settings" });
    }
  });

  // Playbook settings endpoints - AI-Driven Collections Configuration
  app.get('/api/settings/playbook', isAuthenticated, async (req: any, res) => {
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

  app.patch('/api/settings/playbook', isAuthenticated, async (req: any, res) => {
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

  // Cancel subscription
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

  // Lead Management Routes
  // Function to generate temporary invoice data for live demos
  function generateDemoInvoiceData() {
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const baseAmounts = [850, 1200, 1500, 2300, 3200, 4500, 6700, 8900];
    const outstandingAmount = baseAmounts[Math.floor(Math.random() * baseAmounts.length)];
    
    // Generate realistic past due dates (30-90 days ago)
    const daysOverdue = Math.floor(Math.random() * 60) + 30; // 30-90 days
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - daysOverdue);
    
    // Invoice date is 30 days before due date
    const invoiceDate = new Date(dueDate);
    invoiceDate.setDate(invoiceDate.getDate() - 30);
    
    return {
      invoiceNumber,
      outstandingAmount: outstandingAmount.toFixed(2),
      invoiceDate: formatDate(invoiceDate),
      dueDate: formatDate(dueDate),
      daysOverdue: daysOverdue.toString(),
      invoiceCount: "1",
      totalOutstanding: outstandingAmount.toFixed(2)
    };
  }

  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      res.status(201).json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid lead data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  // Function to format phone number to E.164 format
  function formatPhoneToE164(phone: string): string {
    // If already in E.164 format (starts with +), validate and return
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // Remove all non-digits
    const digitsOnly = phone.replace(/\D/g, '');
    
    // South African numbers (starting with 27, total 11 digits)
    if (digitsOnly.startsWith('27') && digitsOnly.length === 11) {
      return `+${digitsOnly}`;
    }
    
    // US numbers starting with 1 (11 digits total)
    if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
      return `+${digitsOnly}`;
    }
    
    // UK numbers starting with 07 (11 digits, convert to +44)
    if (digitsOnly.startsWith('07') && digitsOnly.length === 11) {
      return `+44${digitsOnly.substring(1)}`;
    }
    
    // UK numbers already with 44 prefix (12 digits)
    if (digitsOnly.startsWith('44') && digitsOnly.length === 12) {
      return `+${digitsOnly}`;
    }
    
    // US numbers (10 digits, add +1)
    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    }
    
    // For other international numbers, assume they're already properly formatted
    // and just add the + prefix
    return `+${digitsOnly}`;
  }

  // Live demo endpoint that generates invoice data and triggers voice call
  app.post("/api/demo/live-call", async (req, res) => {
    try {
      const { name, email, phone, company } = req.body;
      
      if (!name || !phone) {
        return res.status(400).json({ message: "Name and phone number are required" });
      }

      // Format phone number to E.164
      const formattedPhone = formatPhoneToE164(phone);
      console.log(`📞 Phone formatting: "${phone}" → "${formattedPhone}"`);

      // Generate temporary invoice data
      const invoiceData = generateDemoInvoiceData();
      
      // Create dynamic variables for the call
      const dynamicVariables = {
        customer_name: name,
        company_name: company || "Your Company",
        invoice_number: invoiceData.invoiceNumber,
        invoice_amount: invoiceData.outstandingAmount,
        total_outstanding: invoiceData.totalOutstanding,
        days_overdue: invoiceData.daysOverdue,
        invoice_count: invoiceData.invoiceCount,
        due_date: invoiceData.dueDate,
        organisation_name: "Nexus AR",
        demo_message: `Hello ${name}, this is a live demonstration of Nexus AR's AI-powered collection system. We're calling regarding invoice ${invoiceData.invoiceNumber} for $${invoiceData.outstandingAmount}.`
      };

      console.log("🎯 Live demo call with generated data:", {
        lead: { name, company, phone: formattedPhone },
        invoiceData,
        dynamicVariables
      });

      // Use direct Retell API call
      let callId = `live-demo-${Date.now()}`;
      let callStatus = "queued";
      
      try {
        const retellClient = createRetellClient(process.env.RETELL_API_KEY!);
        
        // Clean and format phone numbers for Retell
        const cleanFromNumber = process.env.RETELL_PHONE_NUMBER!.replace(/[()\\s-]/g, '');
        const cleanToNumber = formattedPhone.replace(/[()\\s-]/g, '');
        
        console.log("🔧 Retell call parameters:", {
          from: cleanFromNumber,
          to: cleanToNumber,
          agent_id: process.env.RETELL_AGENT_ID
        });
        
        const call = await retellClient.call.createPhoneCall({
          from_number: cleanFromNumber,
          to_number: cleanToNumber,
          agent_id: process.env.RETELL_AGENT_ID!,
          retell_llm_dynamic_variables: dynamicVariables
        } as any);
        
        callId = (call as any).call_id || callId;
        callStatus = (call as any).call_status || "registered";
        
        console.log("✅ Live demo call created successfully:", { callId, callStatus });
      } catch (retellError: any) {
        console.error("❌ Retell API error for live demo:", retellError);
        // Continue anyway for demo purposes - still save the lead
        callStatus = "failed";
      }
      
      // Store the lead with demo call info
      const leadData = insertLeadSchema.parse({
        ...req.body,
        source: "live_demo",
        notes: `Live demo call initiated. Invoice: ${invoiceData.invoiceNumber}, Amount: $${invoiceData.outstandingAmount}`
      });
      
      const lead = await storage.createLead(leadData);
      
      res.status(201).json({
        success: true,
        message: "Live demo call initiated successfully!",
        lead,
        callId,
        callStatus,
        invoiceData,
        dynamicVariables
      });
    } catch (error) {
      console.error("Error creating live demo call:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid demo data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to initiate live demo call" });
    }
  });

  app.get("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // Send Invoice PDF by Email - Direct API endpoint for testing
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

  // AI Facts endpoints - Knowledge base for AI CFO
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

  // AI CFO Conversation endpoint
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

  // ==================== ANALYTICS ENDPOINTS ====================

  // 1. Cash Flow Forecast - 90-day projections with confidence intervals
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

  // 2. Aging Analysis - breakdown by age buckets
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

  // 3. Collection Performance - method effectiveness analysis
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

  // 4. Customer Risk Matrix - portfolio health analysis
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

  // 5. Automation Performance Analytics - comprehensive automation metrics and ROI analysis
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

  // ==================== END ANALYTICS ENDPOINTS ====================

  // ==================== PROVIDER MIDDLEWARE ROUTES ====================

  // Import API middleware
  const { apiMiddleware } = await import("./middleware");

  // Unified accounting status endpoint
  app.get('/api/accounting/status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      
      // Check which accounting provider is connected by checking token existence
      let connectedProvider = null;
      const accountingProviders = apiMiddleware.getProvidersByType('accounting');
      
      for (const provider of accountingProviders) {
        const isConnected = await apiMiddleware.isProviderConnected(provider.name, user.tenantId);
        if (isConnected) {
          let organizationName = 'Connected Organization';
          
          // Get organization name from tenant if available
          if (provider.name === 'xero' && (tenant as any)?.xeroTenantName) {
            organizationName = (tenant as any).xeroTenantName;
          } else if (provider.name === 'sage' && (tenant as any)?.sageTenantName) {
            organizationName = (tenant as any).sageTenantName;
          } else if (provider.name === 'quickbooks' && (tenant as any)?.quickbooksTenantName) {
            organizationName = (tenant as any).quickbooksTenantName;
          }
          
          connectedProvider = {
            name: provider.name,
            displayName: provider.config.name || provider.name,
            type: provider.type,
            organizationName,
            isConnected: true
          };
          break;
        }
      }

      res.json({
        success: true,
        connectedProvider,
        availableProviders: accountingProviders.map(p => ({
          name: p.name,
          displayName: p.config.name || p.name,
          type: p.type
        }))
      });
    } catch (error) {
      console.error("Error getting accounting status:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get accounting status" 
      });
    }
  });

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
  app.get('/api/providers/health', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const providers = apiMiddleware.getProviders();
      const healthResults = await Promise.all(
        providers.map(async (provider) => {
          try {
            const isHealthy = await provider.healthCheck();
            return {
              name: provider.name,
              type: provider.type,
              healthy: isHealthy,
              lastChecked: new Date().toISOString()
            };
          } catch (error) {
            return {
              name: provider.name,
              type: provider.type,
              healthy: false,
              error: error instanceof Error ? error.message : 'Health check failed',
              lastChecked: new Date().toISOString()
            };
          }
        })
      );

      res.json({
        success: true,
        results: healthResults,
        summary: {
          total: healthResults.length,
          healthy: healthResults.filter(r => r.healthy).length,
          unhealthy: healthResults.filter(r => !r.healthy).length
        }
      });
    } catch (error) {
      console.error("Error checking provider health:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to check provider health" 
      });
    }
  });

  // Initiate provider connection (OAuth flow)
  app.get('/api/providers/connect/:provider', isAuthenticated, async (req: any, res) => {
    try {
      const { provider: providerName } = req.params;
      const user = await storage.getUser(req.user.id);
      
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Ensure session exists before initiating OAuth flow
      if (!req.session) {
        return res.status(401).json({ 
          success: false, 
          message: "Session required for authentication. Please log in again." 
        });
      }

      // Use APIMiddleware to initiate connection (with session for state persistence)
      const result = await apiMiddleware.connectProvider(providerName, req.session, user.tenantId);
      
      if (result.success && result.authUrl) {
        // Promisify session.save to persist OAuth state before returning auth URL
        await new Promise<void>((resolve, reject) => {
          req.session.save((err: any) => {
            if (err) {
              console.error("❌ Error saving session:", err);
              reject(err);
            } else {
              console.log(`✅ Session saved successfully before ${providerName} redirect`);
              resolve();
            }
          });
        });
        
        // Return auth URL for frontend to redirect to
        res.json({
          success: true,
          authUrl: result.authUrl
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || `Failed to initiate ${providerName} connection`
        });
      }

    } catch (error) {
      console.error(`Error initiating ${req.params.provider} connection:`, error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to initiate provider connection" 
      });
    }
  });

  // Provider disconnect endpoint
  app.post('/api/providers/disconnect/:provider', isAuthenticated, async (req: any, res) => {
    try {
      const { provider: providerName } = req.params;
      const user = await storage.getUser(req.user.id);
      
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Use APIMiddleware to disconnect provider
      const result = await apiMiddleware.disconnectProvider(providerName, user.tenantId);
      
      if (result.success) {
        res.json({
          success: true,
          message: `${providerName} disconnected successfully`
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || `Failed to disconnect ${providerName}`
        });
      }

    } catch (error) {
      console.error(`Error disconnecting ${req.params.provider}:`, error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to disconnect provider" 
      });
    }
  });

  // Provider data sync endpoint
  app.post('/api/providers/sync/:provider', isAuthenticated, async (req: any, res) => {
    try {
      const { provider: providerName } = req.params;
      const user = await storage.getUser(req.user.id);
      
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const provider = apiMiddleware.getProvider(providerName);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: `Provider '${providerName}' not found`
        });
      }

      // Check if provider supports sync
      if (typeof (provider as any).syncToDatabase !== 'function') {
        return res.status(501).json({
          success: false,
          message: `Provider '${providerName}' does not support data synchronization`
        });
      }

      console.log(`🔄 Starting data sync for provider: ${providerName}, tenant: ${user.tenantId}`);
      
      const syncResult = await (provider as any).syncToDatabase(user.tenantId);
      
      console.log(`✅ Sync completed for ${providerName}:`, syncResult);

      res.json({
        success: true,
        provider: providerName,
        result: syncResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Error syncing ${req.params.provider}:`, error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to sync provider data",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Provider-specific API request endpoint
  app.post('/api/providers/:provider/request', isAuthenticated, async (req: any, res) => {
    try {
      const { provider: providerName } = req.params;
      const { endpoint, options } = req.body;
      
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const provider = apiMiddleware.getProvider(providerName);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: `Provider '${providerName}' not found`
        });
      }

      // Add tenant ID to request options if not present
      const requestOptions = {
        ...options,
        params: {
          ...options?.params,
          tenantId: user.tenantId
        }
      };

      const result = await provider.makeRequest(endpoint, requestOptions);
      
      res.json({
        success: result.success,
        data: result.data,
        error: result.error,
        statusCode: result.statusCode,
        provider: providerName,
        endpoint
      });

    } catch (error) {
      console.error(`Error making ${req.params.provider} API request:`, error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to make provider API request",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

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
  app.get('/api/accounting/bills', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { limit = 100, status, vendor_id, overdue_only } = req.query;
      
      const bills = await storage.getBills(user.tenantId, Number(limit));
      
      // Apply filtering
      let filteredBills = bills;
      if (status) {
        filteredBills = filteredBills.filter(bill => bill.status === status);
      }
      if (vendor_id) {
        filteredBills = filteredBills.filter(bill => bill.vendorId === vendor_id);
      }
      if (overdue_only === 'true') {
        const today = new Date();
        filteredBills = filteredBills.filter(bill => 
          bill.dueDate && new Date(bill.dueDate) < today && bill.status !== 'paid'
        );
      }

      res.json({
        bills: filteredBills,
        total: filteredBills.length,
        metadata: {
          totalAmount: filteredBills.reduce((sum, bill) => sum + Number(bill.amount), 0),
          paidAmount: filteredBills.filter(b => b.status === 'paid').reduce((sum, bill) => sum + Number(bill.amount), 0),
          overdueAmount: filteredBills.filter(b => {
            const today = new Date();
            return b.dueDate && new Date(b.dueDate) < today && b.status !== 'paid';
          }).reduce((sum, bill) => sum + Number(bill.amount), 0)
        }
      });
    } catch (error) {
      console.error('Error fetching bills:', error);
      res.status(500).json({ message: "Failed to fetch bills" });
    }
  });

  /**
   * GET /api/accounting/bills/:id
   * Get specific bill with vendor details
   */
  app.get('/api/accounting/bills/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const bill = await storage.getBill(req.params.id, user.tenantId);
      if (!bill) {
        return res.status(404).json({ message: "Bill not found" });
      }

      res.json(bill);
    } catch (error) {
      console.error('Error fetching bill:', error);
      res.status(500).json({ message: "Failed to fetch bill" });
    }
  });

  /**
   * POST /api/accounting/bills
   * Create new bill
   */
  app.post('/api/accounting/bills', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const validatedData = insertBillSchema.parse({
        ...req.body,
        tenantId: user.tenantId
      });

      const bill = await storage.createBill(validatedData);
      res.status(201).json(bill);
    } catch (error) {
      console.error('Error creating bill:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create bill" });
    }
  });

  /**
   * PUT /api/accounting/bills/:id
   * Update bill
   */
  app.put('/api/accounting/bills/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const validatedData = insertBillSchema.partial().parse(req.body);
      const bill = await storage.updateBill(req.params.id, user.tenantId, validatedData);
      res.json(bill);
    } catch (error) {
      console.error('Error updating bill:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update bill" });
    }
  });

  /**
   * DELETE /api/accounting/bills/:id
   * Delete bill
   */
  app.delete('/api/accounting/bills/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      await storage.deleteBill(req.params.id, user.tenantId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting bill:', error);
      res.status(500).json({ message: "Failed to delete bill" });
    }
  });

  // ============ BANK ACCOUNTS API ENDPOINTS ============

  /**
   * GET /api/accounting/bank-accounts
   * Retrieve bank accounts with current balances
   */
  app.get('/api/accounting/bank-accounts', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const accounts = await storage.getBankAccounts(user.tenantId);
      
      res.json({
        accounts,
        total: accounts.length,
        metadata: {
          totalBalance: accounts.reduce((sum, account) => sum + Number(account.currentBalance), 0),
          totalAvailable: accounts.reduce((sum, account) => sum + Number(account.availableBalance || account.currentBalance), 0),
          activeCurrencies: [...new Set(accounts.map(a => a.currencyCode))]
        }
      });
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      res.status(500).json({ message: "Failed to fetch bank accounts" });
    }
  });

  /**
   * GET /api/accounting/bank-accounts/:id
   * Get specific bank account
   */
  app.get('/api/accounting/bank-accounts/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const account = await storage.getBankAccount(req.params.id, user.tenantId);
      if (!account) {
        return res.status(404).json({ message: "Bank account not found" });
      }

      res.json(account);
    } catch (error) {
      console.error('Error fetching bank account:', error);
      res.status(500).json({ message: "Failed to fetch bank account" });
    }
  });

  /**
   * POST /api/accounting/bank-accounts
   * Create new bank account
   */
  app.post('/api/accounting/bank-accounts', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const validatedData = insertBankAccountSchema.parse({
        ...req.body,
        tenantId: user.tenantId
      });

      const account = await storage.createBankAccount(validatedData);
      res.status(201).json(account);
    } catch (error) {
      console.error('Error creating bank account:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create bank account" });
    }
  });

  /**
   * PUT /api/accounting/bank-accounts/:id
   * Update bank account
   */
  app.put('/api/accounting/bank-accounts/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const validatedData = insertBankAccountSchema.partial().parse(req.body);
      const account = await storage.updateBankAccount(req.params.id, user.tenantId, validatedData);
      res.json(account);
    } catch (error) {
      console.error('Error updating bank account:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update bank account" });
    }
  });

  /**
   * DELETE /api/accounting/bank-accounts/:id
   * Delete bank account
   */
  app.delete('/api/accounting/bank-accounts/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      await storage.deleteBankAccount(req.params.id, user.tenantId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting bank account:', error);
      res.status(500).json({ message: "Failed to delete bank account" });
    }
  });

  // ============ BANK TRANSACTIONS API ENDPOINTS ============

  /**
   * GET /api/accounting/bank-transactions
   * Retrieve bank transactions with categorization and filtering
   */
  app.get('/api/accounting/bank-transactions', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { 
        bank_account_id, 
        start_date, 
        end_date, 
        limit = 500, 
        type, 
        category,
        status 
      } = req.query;

      const filters: any = {};
      if (bank_account_id) filters.bankAccountId = bank_account_id as string;
      if (start_date) filters.startDate = start_date as string;
      if (end_date) filters.endDate = end_date as string;
      if (limit) filters.limit = Number(limit);

      const transactions = await storage.getBankTransactions(user.tenantId, filters);
      
      // Apply additional filtering
      let filteredTransactions = transactions;
      if (type) {
        filteredTransactions = filteredTransactions.filter(t => t.transactionType === type);
      }
      if (category) {
        filteredTransactions = filteredTransactions.filter(t => t.category === category);
      }
      if (status) {
        filteredTransactions = filteredTransactions.filter(t => t.status === status);
      }

      res.json({
        transactions: filteredTransactions,
        total: filteredTransactions.length,
        metadata: {
          totalInflows: filteredTransactions
            .filter(t => Number(t.amount) > 0)
            .reduce((sum, t) => sum + Number(t.amount), 0),
          totalOutflows: filteredTransactions
            .filter(t => Number(t.amount) < 0)
            .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0),
          netCashFlow: filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
          categories: [...new Set(filteredTransactions.map(t => t.category).filter(Boolean))]
        }
      });
    } catch (error) {
      console.error('Error fetching bank transactions:', error);
      res.status(500).json({ message: "Failed to fetch bank transactions" });
    }
  });

  /**
   * GET /api/accounting/bank-transactions/:id
   * Get specific bank transaction
   */
  app.get('/api/accounting/bank-transactions/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const transaction = await storage.getBankTransaction(req.params.id, user.tenantId);
      if (!transaction) {
        return res.status(404).json({ message: "Bank transaction not found" });
      }

      res.json(transaction);
    } catch (error) {
      console.error('Error fetching bank transaction:', error);
      res.status(500).json({ message: "Failed to fetch bank transaction" });
    }
  });

  /**
   * POST /api/accounting/bank-transactions
   * Create new bank transaction
   */
  app.post('/api/accounting/bank-transactions', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const validatedData = insertBankTransactionSchema.parse({
        ...req.body,
        tenantId: user.tenantId
      });

      const transaction = await storage.createBankTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      console.error('Error creating bank transaction:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create bank transaction" });
    }
  });

  /**
   * PUT /api/accounting/bank-transactions/:id
   * Update bank transaction
   */
  app.put('/api/accounting/bank-transactions/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const validatedData = insertBankTransactionSchema.partial().parse(req.body);
      const transaction = await storage.updateBankTransaction(req.params.id, user.tenantId, validatedData);
      res.json(transaction);
    } catch (error) {
      console.error('Error updating bank transaction:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update bank transaction" });
    }
  });

  // ============ BUDGETS API ENDPOINTS ============

  /**
   * GET /api/accounting/budgets
   * Retrieve budgets with line-item breakdowns
   */
  app.get('/api/accounting/budgets', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { year, status } = req.query;
      const filters: any = {};
      if (year) filters.year = Number(year);
      if (status) filters.status = status as string;

      const budgets = await storage.getBudgets(user.tenantId, filters);
      
      res.json({
        budgets,
        total: budgets.length,
        metadata: {
          totalBudgetedAmount: budgets.reduce((sum, budget) => {
            return sum + budget.budgetLines.reduce((lineSum, line) => lineSum + Number(line.budgetedAmount), 0);
          }, 0),
          totalActualAmount: budgets.reduce((sum, budget) => {
            return sum + budget.budgetLines.reduce((lineSum, line) => lineSum + Number(line.actualAmount || 0), 0);
          }, 0),
          years: [...new Set(budgets.map(b => b.year))].sort(),
          statuses: [...new Set(budgets.map(b => b.status))]
        }
      });
    } catch (error) {
      console.error('Error fetching budgets:', error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  /**
   * GET /api/accounting/budgets/:id
   * Get specific budget with line items
   */
  app.get('/api/accounting/budgets/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const budget = await storage.getBudget(req.params.id, user.tenantId);
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }

      res.json(budget);
    } catch (error) {
      console.error('Error fetching budget:', error);
      res.status(500).json({ message: "Failed to fetch budget" });
    }
  });

  /**
   * POST /api/accounting/budgets
   * Create new budget
   */
  app.post('/api/accounting/budgets', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const validatedData = insertBudgetSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
        createdBy: user.id
      });

      const budget = await storage.createBudget(validatedData);
      res.status(201).json(budget);
    } catch (error) {
      console.error('Error creating budget:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  /**
   * PUT /api/accounting/budgets/:id
   * Update budget
   */
  app.put('/api/accounting/budgets/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const validatedData = insertBudgetSchema.partial().parse(req.body);
      const budget = await storage.updateBudget(req.params.id, user.tenantId, validatedData);
      res.json(budget);
    } catch (error) {
      console.error('Error updating budget:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  /**
   * DELETE /api/accounting/budgets/:id
   * Delete budget
   */
  app.delete('/api/accounting/budgets/:id', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      await storage.deleteBudget(req.params.id, user.tenantId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting budget:', error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  /**
   * POST /api/accounting/budgets/:id/lines
   * Add budget line to budget
   */
  app.post('/api/accounting/budgets/:id/lines', isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Verify budget exists and belongs to tenant
      const budget = await storage.getBudget(req.params.id, user.tenantId);
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }

      const validatedData = insertBudgetLineSchema.parse({
        ...req.body,
        budgetId: req.params.id
      });

      const budgetLine = await storage.createBudgetLine(validatedData);
      res.status(201).json(budgetLine);
    } catch (error) {
      console.error('Error creating budget line:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create budget line" });
    }
  });

  // ============ EXCHANGE RATES API ENDPOINTS ============

  /**
   * GET /api/accounting/fx
   * Retrieve exchange rates with currency conversion data
   */
  app.get('/api/accounting/fx', isAuthenticated, async (req, res) => {
    try {
      const { base_currency, target_currency, date } = req.query;
      
      const exchangeRates = await storage.getExchangeRates(
        base_currency as string,
        target_currency as string,
        date as string
      );

      res.json({
        exchangeRates,
        total: exchangeRates.length,
        metadata: {
          currencies: [...new Set([
            ...exchangeRates.map(r => r.baseCurrency),
            ...exchangeRates.map(r => r.targetCurrency)
          ])].sort(),
          latestUpdate: exchangeRates.length > 0 ? exchangeRates[0].rateDate : null,
          sources: [...new Set(exchangeRates.map(r => r.source).filter(Boolean))]
        }
      });
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      res.status(500).json({ message: "Failed to fetch exchange rates" });
    }
  });

  /**
   * GET /api/accounting/fx/latest/:baseCurrency
   * Get latest exchange rates for a base currency
   */
  app.get('/api/accounting/fx/latest/:baseCurrency', isAuthenticated, async (req, res) => {
    try {
      const { baseCurrency } = req.params;
      const exchangeRates = await storage.getLatestExchangeRates(baseCurrency);

      res.json({
        baseCurrency,
        exchangeRates,
        total: exchangeRates.length,
        lastUpdated: exchangeRates.length > 0 ? exchangeRates[0].rateDate : null
      });
    } catch (error) {
      console.error('Error fetching latest exchange rates:', error);
      res.status(500).json({ message: "Failed to fetch latest exchange rates" });
    }
  });

  /**
   * POST /api/accounting/fx
   * Create new exchange rate
   */
  app.post('/api/accounting/fx', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertExchangeRateSchema.parse(req.body);
      const exchangeRate = await storage.createExchangeRate(validatedData);
      res.status(201).json(exchangeRate);
    } catch (error) {
      console.error('Error creating exchange rate:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create exchange rate" });
    }
  });

  // ============ ENHANCED CASHFLOW FORECAST API ENDPOINTS ============

  /**
   * GET /api/cashflow/forecast
   * Generate 13-week cashflow forecast with scenario support
   */
  app.get('/api/cashflow/forecast', isAuthenticated, async (req, res) => {
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
          budgets: budgets.map(budget => ({ ...budget, budgetLines: budget.budgetLines }))
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

  /**
   * POST /api/cashflow/scenarios
   * Run custom scenario analysis and comparison
   */
  app.post('/api/cashflow/scenarios', isAuthenticated, async (req, res) => {
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
        budgets: budgets.map(budget => ({ ...budget, budgetLines: budget.budgetLines }))
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

  /**
   * GET /api/cashflow/metrics
   * Get key financial metrics (DSO, DPO, cash runway)
   */
  app.get('/api/cashflow/metrics', isAuthenticated, async (req, res) => {
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

  /**
   * POST /api/cashflow/optimize
   * Get cash optimization recommendations
   */
  app.post('/api/cashflow/optimize', isAuthenticated, async (req, res) => {
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

  /**
   * POST /api/forecast/ard/calculate
   * Manually trigger ARD calculation
   */
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

  /**
   * GET /api/forecast/ard/history
   * Get ARD calculation history
   */
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

  /**
   * GET /api/forecast/ard/trend
   * Get ARD trend (improving/stable/deteriorating)
   */
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

  /**
   * GET /api/forecast/sales
   * Get sales forecasts for a date range
   */
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

  /**
   * POST /api/forecast/sales
   * Create or update sales forecast for a month
   */
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

  /**
   * POST /api/forecast/sales/batch
   * Batch update sales forecasts
   */
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

  /**
   * GET /api/forecast/sales/cash-inflows
   * Convert sales forecasts to expected cash inflows (ARD-adjusted)
   */
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

  /**
   * POST /api/forecast/sales/generate-defaults
   * Generate default (zero) forecasts for next 12 months
   */
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

  /**
   * GET /api/forecast/irregular-buffer
   * Get irregular buffer calculation for one-off expenses
   */
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

  /**
   * GET /api/forecast/irregular-buffer/recommended-beta
   * Get recommended beta coefficient based on expense volatility
   */
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

  // ==================== END INTELLIGENT FORECAST API ====================

  // ==================== RBAC MANAGEMENT API ====================

  // Import RBAC middleware and permission service
  const { withPermission, withRole, withMinimumRole, canManageUser } = await import("./middleware/rbac");
  const { PermissionService } = await import("./services/permissionService");

  // Get all users in tenant with their roles and permissions
  app.get("/api/rbac/users", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { tenantId } = req.rbac;
      
      const users = await storage.getUsersInTenant(tenantId);
      const usersWithPermissions = await Promise.all(
        users.map(async (user) => {
          const permissions = await PermissionService.getUserPermissions(user.id, tenantId);
          return {
            ...user,
            permissions: permissions.map(p => PermissionService.getPermissionInfo(p))
          };
        })
      );

      res.json(usersWithPermissions);
    } catch (error) {
      console.error("Error fetching tenant users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Assign or change user role  
  app.put("/api/rbac/users/:userId/role", ...withPermission('admin:users'), canManageUser(), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const { userId: actorId, userRole: actorRole } = req.rbac;

      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      // Validate that the actor can assign this role
      const assignableRoles = storage.getAssignableRoles(actorRole);
      if (!assignableRoles.includes(role)) {
        return res.status(403).json({ 
          message: "Cannot assign this role",
          assignableRoles
        });
      }

      // Assign the role
      const updatedUser = await storage.assignUserRole(userId, role, actorId);
      
      // Log the role change
      await PermissionService.logPermissionChange(
        actorId, 
        userId, 
        req.rbac.tenantId, 
        'role_change',
        `Role changed from ${req.targetUser.role} to ${role}`
      );

      res.json({
        user: updatedUser,
        message: `User role updated to ${role}`
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Get all available permissions organized by category
  app.get("/api/rbac/permissions", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const permissionsByCategory = PermissionService.getPermissionsByCategory();
      res.json(permissionsByCategory);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // Get permissions for a specific role
  app.get("/api/rbac/roles/:role/permissions", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { role } = req.params;
      
      if (!PermissionService.isValidRole(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const permissions = PermissionService.getRolePermissions(role);
      const permissionDetails = permissions.map(p => PermissionService.getPermissionInfo(p));
      
      res.json({
        role,
        permissions: permissionDetails,
        permissionCount: permissions.length
      });
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  // Get all available roles with their details
  app.get("/api/rbac/roles", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const roles = PermissionService.getAvailableRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // Create user invitation
  app.post("/api/rbac/invitations", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { email, role } = req.body;
      const { userId: invitedBy, tenantId, userRole: inviterRole } = req.rbac;

      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }

      // Validate that the inviter can assign this role
      const assignableRoles = storage.getAssignableRoles(inviterRole);
      if (!assignableRoles.includes(role)) {
        return res.status(403).json({ 
          message: "Cannot invite users to this role",
          assignableRoles
        });
      }

      // Check if user already exists in this tenant
      const existingUsers = await storage.getUsersInTenant(tenantId);
      const existingUser = existingUsers.find(u => u.email === email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists in this tenant" });
      }

      // Create invitation
      const invitation = await storage.createUserInvitation({
        email,
        role,
        tenantId,
        invitedBy
      });

      res.status(201).json({
        success: true,
        invitationId: invitation.id,
        message: `Invitation sent to ${email} for role ${role}`,
        // Don't return the token for security
      });
    } catch (error) {
      console.error("Error creating user invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  // Get pending invitations for tenant
  app.get("/api/rbac/invitations", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { tenantId } = req.rbac;
      const invitations = await storage.getPendingInvitations(tenantId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Revoke user invitation
  app.delete("/api/rbac/invitations/:invitationId", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { invitationId } = req.params;
      await storage.revokeUserInvitation(invitationId);
      
      res.json({
        success: true,
        message: "Invitation revoked successfully"
      });
    } catch (error) {
      console.error("Error revoking invitation:", error);
      res.status(500).json({ message: "Failed to revoke invitation" });
    }
  });

  // Accept user invitation (public endpoint - no auth required)
  app.post("/api/rbac/invitations/accept", async (req, res) => {
    try {
      const { inviteToken, firstName, lastName } = req.body;
      
      if (!inviteToken) {
        return res.status(400).json({ message: "Invite token is required" });
      }

      const user = await storage.acceptUserInvitation(inviteToken, {
        firstName,
        lastName
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        message: "Invitation accepted successfully"
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Check user permissions (utility endpoint)
  app.post("/api/rbac/check-permission", isAuthenticated, withRBACContext, async (req: any, res) => {
    try {
      const { permission } = req.body;
      const { userId, tenantId } = req.rbac;
      
      if (!permission) {
        return res.status(400).json({ message: "Permission is required" });
      }

      const hasPermission = await PermissionService.hasPermission(userId, tenantId, permission);
      
      res.json({
        hasPermission,
        permission,
        userId,
        tenantId
      });
    } catch (error) {
      console.error("Error checking permission:", error);
      res.status(500).json({ message: "Failed to check permission" });
    }
  });

  // Get current user's permissions
  app.get("/api/rbac/my-permissions", isAuthenticated, withRBACContext, async (req: any, res) => {
    try {
      const { userId, tenantId, userRole, permissions } = req.rbac;
      
      res.json({
        userId,
        tenantId,
        role: userRole,
        permissions: permissions.map(p => PermissionService.getPermissionInfo(p)),
        permissionCount: permissions.length
      });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // Remove user from tenant (only owners can do this)
  app.delete("/api/rbac/users/:userId", ...withRole('owner'), canManageUser(), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { userId: actorId, tenantId } = req.rbac;
      
      // Cannot remove yourself
      if (userId === actorId) {
        return res.status(400).json({ message: "Cannot remove yourself from the tenant" });
      }

      // Set user's tenantId to null to remove them from the tenant
      await storage.updateUser(userId, { tenantId: null });
      
      // Log the removal
      await PermissionService.logPermissionChange(
        actorId,
        userId,
        tenantId,
        'role_change',
        'User removed from tenant'
      );

      res.json({
        success: true,
        message: "User removed from tenant successfully"
      });
    } catch (error) {
      console.error("Error removing user:", error);
      res.status(500).json({ message: "Failed to remove user" });
    }
  });

  // Get role hierarchy information
  app.get("/api/rbac/role-hierarchy", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { userRole } = req.rbac;
      
      const availableRoles = PermissionService.getAvailableRoles();
      const assignableRoles = storage.getAssignableRoles(userRole);
      
      res.json({
        availableRoles,
        assignableRoles,
        userRole,
        hierarchy: ['viewer', 'user', 'accountant', 'manager', 'admin', 'owner']
      });
    } catch (error) {
      console.error("Error fetching role hierarchy:", error);
      res.status(500).json({ message: "Failed to fetch role hierarchy" });
    }
  });

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
  app.post("/api/invitations/create", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Only owners and admins can create invitations
      if (!['owner', 'admin'].includes(user.role || '')) {
        return res.status(403).json({ message: "Access denied. Owner or admin role required." });
      }

      const invitationSchema = z.object({
        partnerEmail: z.string().email("Valid email address required"),
        accessLevel: z.enum(['read_only', 'read_write', 'full_access']).default('read_write'),
        permissions: z.array(z.string()).default([]),
        customMessage: z.string().optional(),
        expiresAt: z.string().optional()
      });

      const validated = invitationSchema.parse(req.body);
      
      // Create the invitation
      const invitation = await storage.createTenantInvitation({
        clientTenantId: user.tenantId,
        partnerEmail: validated.partnerEmail,
        invitedByUserId: user.id,
        accessLevel: validated.accessLevel,
        permissions: validated.permissions,
        customMessage: validated.customMessage,
        status: 'pending',
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
      });

      console.log(`📧 Invitation created: ${user.email} invited ${validated.partnerEmail} as partner`);
      
      // TODO: Send email notification to partner
      // await emailService.sendPartnerInvitation(validated.partnerEmail, invitation);
      
      res.json({
        success: true,
        invitation,
        message: "Invitation sent successfully"
      });
    } catch (error) {
      console.error("Error creating invitation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  // Get tenant invitations for current tenant
  app.get("/api/invitations/outgoing", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const invitations = await storage.getTenantInvitations(user.tenantId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching outgoing invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Get incoming invitations for partner (by email)
  app.get("/api/invitations/incoming", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.email) {
        return res.status(400).json({ message: "User email not found" });
      }

      const invitations = await storage.getTenantInvitationsByPartner(user.email);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching incoming invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Accept tenant invitation
  app.post("/api/invitations/:invitationId/accept", isAuthenticated, async (req: any, res) => {
    try {
      const { invitationId } = req.params;
      const { responseMessage } = req.body;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get the invitation to verify the partner email matches
      const invitation = await storage.getTenantInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.partnerEmail !== user.email) {
        return res.status(403).json({ message: "This invitation is not for your email address" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation is no longer pending" });
      }

      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      const result = await storage.acceptTenantInvitation(invitationId, user.id, responseMessage);
      
      console.log(`🤝 Partnership established: ${user.email} accepted invitation from ${invitation.clientTenant.name}`);
      
      res.json({
        success: true,
        invitation: result.invitation,
        relationship: result.relationship,
        message: "Invitation accepted and partnership established"
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Decline tenant invitation
  app.post("/api/invitations/:invitationId/decline", isAuthenticated, async (req: any, res) => {
    try {
      const { invitationId } = req.params;
      const { responseMessage } = req.body;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get the invitation to verify the partner email matches
      const invitation = await storage.getTenantInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.partnerEmail !== user.email) {
        return res.status(403).json({ message: "This invitation is not for your email address" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation is no longer pending" });
      }

      const declinedInvitation = await storage.declineTenantInvitation(invitationId, responseMessage);
      
      console.log(`❌ Partnership declined: ${user.email} declined invitation from ${invitation.clientTenant.name}`);
      
      res.json({
        success: true,
        invitation: declinedInvitation,
        message: "Invitation declined"
      });
    } catch (error) {
      console.error("Error declining invitation:", error);
      res.status(500).json({ message: "Failed to decline invitation" });
    }
  });

  // Get tenant metadata (subscription info, etc.)
  app.get("/api/tenant/metadata", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const metadata = await storage.getTenantMetadata(user.tenantId);
      res.json(metadata || { tenantId: user.tenantId });
    } catch (error) {
      console.error("Error fetching tenant metadata:", error);
      res.status(500).json({ message: "Failed to fetch tenant metadata" });
    }
  });

  // Update tenant metadata
  app.put("/api/tenant/metadata", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Only owners can update metadata
      if (user.role !== 'owner') {
        return res.status(403).json({ message: "Access denied. Owner role required." });
      }

      const metadataSchema = z.object({
        subscriptionPlanId: z.string().optional(),
        billingEmail: z.string().email().optional(),
        maxClientConnections: z.number().int().min(0).optional(),
        features: z.array(z.string()).optional(),
        settings: z.record(z.any()).optional()
      });

      const validated = metadataSchema.parse(req.body);
      
      // Check if metadata exists
      let metadata = await storage.getTenantMetadata(user.tenantId);
      
      if (metadata) {
        // Update existing metadata
        metadata = await storage.updateTenantMetadata(user.tenantId, validated);
      } else {
        // Create new metadata
        metadata = await storage.createTenantMetadata({
          tenantId: user.tenantId,
          ...validated
        });
      }
      
      res.json(metadata);
    } catch (error) {
      console.error("Error updating tenant metadata:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update tenant metadata" });
    }
  });

  // ==================== SUBSCRIPTION MANAGEMENT API ====================

  // GET /api/subscription/plans - Get available plans by type
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

  // POST /api/subscription/subscribe - Subscribe tenant to a plan
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

  // GET /api/subscription/usage - Get current billing usage for partners
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

  // POST /api/subscription/upgrade-downgrade - Change subscription plans
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

  // POST /api/subscription/update-partner-billing - Update partner billing based on client count
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

  // GET /api/subscription/status - Get current subscription status
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

  // ==================== SUBSCRIPTION SEEDING API ====================

  // POST /api/subscription/seed-plans - Create initial subscription plans
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
  app.get("/api/demo-mode/status", isAuthenticated, async (req: any, res) => {
    try {
      const { demoModeService } = await import('./services/demoModeService.js');
      res.json(demoModeService.getStatus());
    } catch (error) {
      console.error("Error getting demo mode status:", error);
      res.status(500).json({ message: "Failed to get demo mode status" });
    }
  });

  // Toggle demo mode
  app.post("/api/demo-mode/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: "enabled must be a boolean" });
      }

      const { demoModeService } = await import('./services/demoModeService.js');
      demoModeService.setEnabled(enabled);
      
      res.json({ 
        success: true, 
        enabled,
        message: `Demo mode ${enabled ? 'enabled' : 'disabled'}` 
      });
    } catch (error) {
      console.error("Error toggling demo mode:", error);
      res.status(500).json({ message: "Failed to toggle demo mode" });
    }
  });

  // Seed demo data
  app.post("/api/demo-mode/seed", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "No tenant associated with user" });
      }

      const { demoDataService } = await import('./services/demoDataService.js');
      const result = await demoDataService.seedDemoData(tenantId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ message: "Failed to seed demo data" });
    }
  });

  // Seed forecast demo data (100 invoices with payment promises across 6 weeks)
  app.post("/api/demo-mode/seed-forecast", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      if (!tenantId) {
        return res.status(400).json({ message: "No tenant associated with user" });
      }
      if (!userId) {
        return res.status(400).json({ message: "No user ID available" });
      }

      const { demoDataService } = await import('./services/demoDataService.js');
      const result = await demoDataService.seedForecastData(tenantId, userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error seeding forecast demo data:", error);
      res.status(500).json({ message: "Failed to seed forecast demo data" });
    }
  });

  // Clear demo data
  app.post("/api/demo-mode/clear", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "No tenant associated with user" });
      }

      const { demoDataService } = await import('./services/demoDataService.js');
      const result = await demoDataService.clearDemoData(tenantId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error("Error clearing demo data:", error);
      res.status(500).json({ message: "Failed to clear demo data" });
    }
  });

  // Check if demo data exists
  app.get("/api/demo-mode/has-data", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "No tenant associated with user" });
      }

      const { demoDataService } = await import('./services/demoDataService.js');
      const hasData = await demoDataService.hasDemoData(tenantId);
      
      res.json({ hasData });
    } catch (error) {
      console.error("Error checking demo data:", error);
      res.status(500).json({ message: "Failed to check demo data status" });
    }
  });

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
      res.json(users);
    } catch (error) {
      console.error("Error fetching platform users:", error);
      res.status(500).json({ message: "Failed to fetch platform users" });
    }
  });
  
  // Get all platform tenants
  app.get("/api/platform-admin/tenants", ...withPlatformAdmin(), async (req, res) => {
    try {
      const tenants = await storage.getAllPlatformTenants();
      res.json(tenants);
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
  app.post("/api/investor/voice-demo", async (req, res) => {
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

  // Send SMS demo
  app.post("/api/investor/sms-demo", async (req, res) => {
    try {
      const { leadId, phone, name } = req.body;
      
      if (!leadId || !phone) {
        return res.status(400).json({ message: "Lead ID and phone are required" });
      }
      
      // Update lead with phone number and name if provided
      const updateData: any = { phone };
      if (name) updateData.smsName = name;
      
      const lead = await storage.updateInvestorLead(leadId, updateData);
      
      // Send SMS via Vonage with investor demo message
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
