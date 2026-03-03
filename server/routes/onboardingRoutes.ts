import { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { withPermission, withRBACContext } from "../middleware/rbac";
import { z } from "zod";
import { onboardingService } from "../services/onboardingService";
import { generateMockData } from "../mock-data";
import { db } from "../db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { 
  actions, 
  invoices, 
  contacts, 
  onboardingProgress,
  activityLogs,
  timelineEvents,
  paymentPromises,
  disputes,
  voiceCalls,
  emailMessages,
  smsMessages,
  contactNotes,
  customerContactPersons,
  paymentPlans,
  paymentPlanInvoices,
  workflowTimers,
  inboundMessages,
  contactOutcomes,
  policyDecisions,
  messageDrafts,
  customerBehaviorSignals,
  customerScheduleAssignments,
  customerPreferences,
  customerLearningProfiles,
  actionEffectiveness,
  actionItems,
  debtorPayments,
  financeAdvances,
  invoiceHealthScores,
  magicLinkTokens,
  promisesToPay,
  riskScores,
  userContactAssignments,
  walletTransactions,
  emailDomainMappings,
  debtorProfiles,
  outcomes,
  emailClarifications,
  conversations,
  attentionItems,
  investorLeads,
  tenants,
  bankTransactions,
  bills
} from "@shared/schema";
import { stripSensitiveUserFields, stripSensitiveTenantFields } from "../utils/sanitize";

export function registerOnboardingRoutes(app: Express): void {
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
      const { seedPaymentBehaviorCustomers } = await import("../mock-data");
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

  // Admin endpoint for comprehensive 3-year dataset generation
  app.post('/api/admin/seed/mock-dataset', isAuthenticated, withPermission('admin:settings')[0], withPermission('admin:settings')[1], async (req: any, res) => {
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

      const { generateComprehensiveDataset } = await import("../mock-data");
      
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
  app.post('/api/onboarding/start', ...withPermission('admin:settings'), async (req: any, res) => {
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
  app.put('/api/onboarding/progress', ...withPermission('admin:settings'), async (req: any, res) => {
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
  app.post('/api/onboarding/complete-phase', ...withPermission('admin:settings'), async (req: any, res) => {
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
  app.post('/api/onboarding/complete', ...withPermission('admin:settings'), async (req: any, res) => {
    try {
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
  app.post('/api/onboarding/xero-import', ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      // Apply RBAC context manually
      await new Promise<void>((resolve, reject) => {
        withRBACContext(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      const { tenantId } = req.rbac;
      
      // Get Xero tokens for this tenant
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
      const { xeroOnboardingService } = await import('../services/xeroOnboardingService');
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

  // New 6-step onboarding endpoints
  app.get('/api/onboarding/full-status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      if (!tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const status = await onboardingService.getFullStatus(tenantId);
      res.json(status);
    } catch (error) {
      console.error("Error fetching onboarding full status:", error);
      res.status(500).json({ message: "Failed to fetch onboarding status" });
    }
  });

  app.post('/api/onboarding/company-details', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      if (!tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { subscriberFirstName, subscriberLastName, companyName, companyAddress } = req.body;
      if (!subscriberFirstName || !subscriberLastName || !companyName || !companyAddress?.line1 || !companyAddress?.city || !companyAddress?.postcode || !companyAddress?.country) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      await onboardingService.saveCompanyDetails(tenantId, { subscriberFirstName, subscriberLastName, companyName, companyAddress });

      if (user) {
        await storage.updateUser(user.id, { firstName: subscriberFirstName, lastName: subscriberLastName });
      }

      await storage.createActivityLog({
        tenantId,
        userId: user?.id,
        activityType: "onboarding_step_completed",
        category: "audit",
        action: "completed",
        result: "success",
        description: "Onboarding step 1 (Company Details) completed",
        metadata: { step: 1, companyName },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving company details:", error);
      res.status(500).json({ message: "Failed to save company details" });
    }
  });

  app.post('/api/onboarding/step', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      if (!tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { step, status } = req.body;
      if (!step || step < 2 || step > 6 || !["COMPLETED", "SKIPPED"].includes(status)) {
        return res.status(400).json({ message: "Invalid step or status" });
      }

      await onboardingService.updateStepStatus(tenantId, step, status);

      await storage.createActivityLog({
        tenantId,
        userId: user?.id,
        activityType: status === "SKIPPED" ? "onboarding_step_skipped" : "onboarding_step_completed",
        category: "audit",
        description: `Onboarding step ${step} ${status.toLowerCase()}`,
        metadata: { step, status },
      });

      const fullStatus = await onboardingService.getFullStatus(tenantId);
      if (onboardingService.isAllStepsFinished(fullStatus)) {
        await onboardingService.tryCompleteOnboarding(tenantId);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating onboarding step:", error);
      res.status(500).json({ message: "Failed to update step" });
    }
  });

  app.post('/api/onboarding/restart', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      if (!tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      await onboardingService.restartOnboarding(tenantId);

      await storage.createActivityLog({
        tenantId,
        userId: user?.id,
        activityType: "onboarding_restarted",
        category: "audit",
        description: "Onboarding progress restarted (integrations preserved)",
        metadata: {},
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error restarting onboarding:", error);
      res.status(500).json({ message: "Failed to restart onboarding" });
    }
  });

  app.post('/api/onboarding/run-analysis', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      if (!tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const result = await onboardingService.runAnalysis(tenantId);

      await storage.createActivityLog({
        tenantId,
        userId: user?.id,
        activityType: "onboarding_analysis_run",
        category: "audit",
        description: "Aged debtors and contact data analysis completed",
        metadata: { overdueCount: result.agedDebtors.totalOverdueCount, contactCount: result.contactData.totalContacts },
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error running analysis:", error);
      res.status(400).json({ message: error.message || "Failed to run analysis" });
    }
  });

  app.post('/api/onboarding/sms-mobile-opt-in', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      if (!tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') return res.status(400).json({ message: "enabled must be a boolean" });

      await onboardingService.setSmsMobileOptIn(tenantId, enabled);

      await storage.createActivityLog({
        tenantId,
        userId: user?.id,
        activityType: "sms_mobile_opt_in_toggled",
        category: "audit",
        description: `SMS mobile opt-in ${enabled ? 'enabled' : 'disabled'}`,
        metadata: { enabled },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error toggling SMS opt-in:", error);
      res.status(500).json({ message: "Failed to update SMS opt-in" });
    }
  });

  app.post('/api/onboarding/start-debtor-scoring', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      if (!tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const job = await onboardingService.enqueueDebtorScoring(tenantId, "ONBOARDING");

      await storage.createActivityLog({
        tenantId,
        userId: user?.id,
        activityType: "debtor_scoring_queued",
        category: "audit",
        description: "Debtor scoring job queued from onboarding",
        metadata: { jobId: job.id, triggeredBy: "ONBOARDING" },
      });

      res.json(job);
    } catch (error) {
      console.error("Error starting debtor scoring:", error);
      res.status(500).json({ message: "Failed to start debtor scoring" });
    }
  });

  app.get('/api/onboarding/debtor-scoring-status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      if (!tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const job = await onboardingService.getLatestScoringJob(tenantId);
      res.json(job || { status: "NONE" });
    } catch (error) {
      console.error("Error fetching scoring status:", error);
      res.status(500).json({ message: "Failed to fetch scoring status" });
    }
  });

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

  app.post('/api/onboarding/complete-all', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const tenantId = user?.tenantId || req.session?.activeTenantId;
      if (!tenantId) return res.status(400).json({ message: "User not associated with a tenant" });

      const completed = await onboardingService.tryCompleteOnboarding(tenantId);
      if (completed) {
        await storage.createActivityLog({
          tenantId,
          userId: user?.id,
          activityType: "onboarding_completed",
          category: "audit",
          description: "Onboarding wizard completed",
          metadata: {},
        });
      }
      res.json({ success: true, completed });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
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
      await db
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

  // ==================== DEMO MODE API ====================
  
  // Get demo mode status
  app.get("/api/demo-mode/status", isAuthenticated, async (req: any, res) => {
    try {
      const { demoModeService } = await import('../services/demoModeService.js');
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

      const { demoModeService } = await import('../services/demoModeService.js');
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

      const { demoDataService } = await import('../services/demoDataService.js');
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

      const { demoDataService } = await import('../services/demoDataService.js');
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

      const { demoDataService } = await import('../services/demoDataService.js');
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

      const { demoDataService } = await import('../services/demoDataService.js');
      const hasData = await demoDataService.hasDemoData(tenantId);
      
      res.json({ hasData });
    } catch (error) {
      console.error("Error checking demo data:", error);
      res.status(500).json({ message: "Failed to check demo data status" });
    }
  });

  // ==================== DEMO DATA TESTING API ====================
  // Comprehensive testing environment for development and demos

  // Reset ALL data for tenant (not just DEMO-prefixed)
  app.post("/api/demo-data/reset-all", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "No tenant associated with user" });
      }

      // Delete in order respecting foreign key constraints (child tables first)
      const result = await db.transaction(async (tx) => {
        // Activity logs (audit entries) must be deleted first (FK references to outcomes and actions)
        const deletedActivityLogs = await tx.delete(activityLogs).where(eq(activityLogs.tenantId, tenantId)).returning();

        // Timeline and messaging
        const deletedTimeline = await tx.delete(timelineEvents).where(eq(timelineEvents.tenantId, tenantId)).returning();
        const deletedVoiceCalls = await tx.delete(voiceCalls).where(eq(voiceCalls.tenantId, tenantId)).returning();
        const deletedEmails = await tx.delete(emailMessages).where(eq(emailMessages.tenantId, tenantId)).returning();
        const deletedSms = await tx.delete(smsMessages).where(eq(smsMessages.tenantId, tenantId)).returning();
        const deletedInbound = await tx.delete(inboundMessages).where(eq(inboundMessages.tenantId, tenantId)).returning();
        const deletedDrafts = await tx.delete(messageDrafts).where(eq(messageDrafts.tenantId, tenantId)).returning();
        
        // Outcomes and decisions
        const deletedContactOutcomes = await tx.delete(contactOutcomes).where(eq(contactOutcomes.tenantId, tenantId)).returning();
        const deletedOutcomesResult = await tx.delete(outcomes).where(eq(outcomes.tenantId, tenantId)).returning();
        const deletedPolicyDecisions = await tx.delete(policyDecisions).where(eq(policyDecisions.tenantId, tenantId)).returning();
        
        // Promises, disputes, workflow timers
        const deletedPromises = await tx.delete(paymentPromises).where(eq(paymentPromises.tenantId, tenantId)).returning();
        const deletedDisputes = await tx.delete(disputes).where(eq(disputes.tenantId, tenantId)).returning();
        const deletedTimers = await tx.delete(workflowTimers).where(eq(workflowTimers.tenantId, tenantId)).returning();
        
        // Payment plans (invoices depend on plans - they don't have tenantId, so delete via parent)
        const tenantPaymentPlans = await tx.select({ id: paymentPlans.id }).from(paymentPlans).where(eq(paymentPlans.tenantId, tenantId));
        const planIds = tenantPaymentPlans.map(p => p.id);
        
        let deletedPlanInvoices: any[] = [];
        if (planIds.length > 0) {
          deletedPlanInvoices = await tx.delete(paymentPlanInvoices).where(inArray(paymentPlanInvoices.paymentPlanId, planIds)).returning();
        }
        const deletedPlans = await tx.delete(paymentPlans).where(eq(paymentPlans.tenantId, tenantId)).returning();
        
        // Actions (after activity_logs which references them)
        const deletedActions = await tx.delete(actions).where(eq(actions.tenantId, tenantId)).returning();
        
        // Invoices (before contacts due to foreign key)
        const deletedInvoices = await tx.delete(invoices).where(eq(invoices.tenantId, tenantId)).returning();
        
        // Contact-related tables (all tables with FK to contacts - must delete before contacts)
        const deletedNotes = await tx.delete(contactNotes).where(eq(contactNotes.tenantId, tenantId)).returning();
        const deletedContactPersons = await tx.delete(customerContactPersons).where(eq(customerContactPersons.tenantId, tenantId)).returning();
        const deletedSignals = await tx.delete(customerBehaviorSignals).where(eq(customerBehaviorSignals.tenantId, tenantId)).returning();
        const deletedScheduleAssignments = await tx.delete(customerScheduleAssignments).where(eq(customerScheduleAssignments.tenantId, tenantId)).returning();
        
        // Additional contact-related tables
        await tx.delete(customerPreferences).where(eq(customerPreferences.tenantId, tenantId));
        await tx.delete(customerLearningProfiles).where(eq(customerLearningProfiles.tenantId, tenantId));
        await tx.delete(actionEffectiveness).where(eq(actionEffectiveness.tenantId, tenantId));
        await tx.delete(actionItems).where(eq(actionItems.tenantId, tenantId));
        await tx.delete(bankTransactions).where(eq(bankTransactions.tenantId, tenantId));
        await tx.delete(bills).where(eq(bills.tenantId, tenantId));
        await tx.delete(debtorPayments).where(eq(debtorPayments.tenantId, tenantId));
        await tx.delete(financeAdvances).where(eq(financeAdvances.tenantId, tenantId));
        await tx.delete(invoiceHealthScores).where(eq(invoiceHealthScores.tenantId, tenantId));
        await tx.delete(magicLinkTokens).where(eq(magicLinkTokens.tenantId, tenantId));
        await tx.delete(promisesToPay).where(eq(promisesToPay.tenantId, tenantId));
        await tx.delete(riskScores).where(eq(riskScores.tenantId, tenantId));
        await tx.delete(userContactAssignments).where(eq(userContactAssignments.tenantId, tenantId));
        await tx.delete(walletTransactions).where(eq(walletTransactions.tenantId, tenantId));
        
        // Email domain mappings and debtor profiles (FK to contacts — must delete before contacts)
        await tx.delete(emailDomainMappings).where(eq(emailDomainMappings.tenantId, tenantId));
        await tx.delete(debtorProfiles).where(eq(debtorProfiles.tenantId, tenantId));

        // Contacts (last due to foreign keys)
        const deletedContacts = await tx.delete(contacts).where(eq(contacts.tenantId, tenantId)).returning();
        
        return {
          activityLogs: deletedActivityLogs.length,
          timeline: deletedTimeline.length,
          voiceCalls: deletedVoiceCalls.length,
          emails: deletedEmails.length,
          sms: deletedSms.length,
          inboundMessages: deletedInbound.length,
          messageDrafts: deletedDrafts.length,
          contactOutcomes: deletedContactOutcomes.length,
          outcomes: deletedOutcomesResult.length,
          policyDecisions: deletedPolicyDecisions.length,
          promises: deletedPromises.length,
          disputes: deletedDisputes.length,
          workflowTimers: deletedTimers.length,
          paymentPlans: deletedPlans.length,
          paymentPlanInvoices: deletedPlanInvoices.length,
          actions: deletedActions.length,
          invoices: deletedInvoices.length,
          contactNotes: deletedNotes.length,
          contactPersons: deletedContactPersons.length,
          behaviorSignals: deletedSignals.length,
          scheduleAssignments: deletedScheduleAssignments.length,
          contacts: deletedContacts.length,
        };
      });

      res.json({ 
        success: true, 
        message: "All data cleared successfully",
        stats: result 
      });
    } catch (error) {
      console.error("Error resetting all data:", error);
      res.status(500).json({ message: "Failed to reset data" });
    }
  });

  app.post("/api/demo-data/reset-comms", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "No tenant associated with user" });
      }

      const result = await db.transaction(async (tx) => {
        const deletedActivityLogs = await tx.delete(activityLogs).where(eq(activityLogs.tenantId, tenantId)).returning();

        const deletedTimeline = await tx.delete(timelineEvents).where(eq(timelineEvents.tenantId, tenantId)).returning();
        const deletedContactOutcomes = await tx.delete(contactOutcomes).where(eq(contactOutcomes.tenantId, tenantId)).returning();
        const deletedOutcomesResult = await tx.delete(outcomes).where(eq(outcomes.tenantId, tenantId)).returning();
        const deletedAttention = await tx.delete(attentionItems).where(eq(attentionItems.tenantId, tenantId)).returning();
        const deletedClarifications = await tx.delete(emailClarifications).where(eq(emailClarifications.tenantId, tenantId)).returning();
        const deletedEmails = await tx.delete(emailMessages).where(eq(emailMessages.tenantId, tenantId)).returning();
        const deletedSms = await tx.delete(smsMessages).where(eq(smsMessages.tenantId, tenantId)).returning();
        const deletedVoice = await tx.delete(voiceCalls).where(eq(voiceCalls.tenantId, tenantId)).returning();
        const deletedInbound = await tx.delete(inboundMessages).where(eq(inboundMessages.tenantId, tenantId)).returning();
        const deletedDrafts = await tx.delete(messageDrafts).where(eq(messageDrafts.tenantId, tenantId)).returning();
        const deletedConversations = await tx.delete(conversations).where(eq(conversations.tenantId, tenantId)).returning();
        const deletedPromises = await tx.delete(promisesToPay).where(eq(promisesToPay.tenantId, tenantId)).returning();
        const deletedPaymentPromises = await tx.delete(paymentPromises).where(eq(paymentPromises.tenantId, tenantId)).returning();
        const deletedDisputes = await tx.delete(disputes).where(eq(disputes.tenantId, tenantId)).returning();
        const deletedTimers = await tx.delete(workflowTimers).where(eq(workflowTimers.tenantId, tenantId)).returning();
        const deletedPolicyDecisions = await tx.delete(policyDecisions).where(eq(policyDecisions.tenantId, tenantId)).returning();

        const tenantPlans = await tx.select({ id: paymentPlans.id }).from(paymentPlans).where(eq(paymentPlans.tenantId, tenantId));
        const planIds = tenantPlans.map(p => p.id);
        let deletedPlanInvoices: any[] = [];
        if (planIds.length > 0) {
          deletedPlanInvoices = await tx.delete(paymentPlanInvoices).where(inArray(paymentPlanInvoices.paymentPlanId, planIds)).returning();
        }
        const deletedPlans = await tx.delete(paymentPlans).where(eq(paymentPlans.tenantId, tenantId)).returning();

        const deletedActions = await tx.delete(actions).where(eq(actions.tenantId, tenantId)).returning();

        await tx.update(invoices)
          .set({ outcomeOverride: null })
          .where(eq(invoices.tenantId, tenantId));

        return {
          activityLogs: deletedActivityLogs.length,
          timeline: deletedTimeline.length,
          emails: deletedEmails.length,
          sms: deletedSms.length,
          voiceCalls: deletedVoice.length,
          inboundMessages: deletedInbound.length,
          conversations: deletedConversations.length,
          outcomes: deletedOutcomesResult.length,
          contactOutcomes: deletedContactOutcomes.length,
          clarifications: deletedClarifications.length,
          attentionItems: deletedAttention.length,
          promises: deletedPromises.length,
          paymentPromises: deletedPaymentPromises.length,
          disputes: deletedDisputes.length,
          paymentPlans: deletedPlans.length,
          paymentPlanInvoices: deletedPlanInvoices.length,
          actions: deletedActions.length,
          drafts: deletedDrafts.length,
          timers: deletedTimers.length,
          policyDecisions: deletedPolicyDecisions.length,
        };
      });

      res.json({
        success: true,
        message: "Communications data cleared successfully",
        stats: result
      });
    } catch (error) {
      console.error("Error resetting comms data:", error);
      res.status(500).json({ message: "Failed to reset communications data" });
    }
  });

  // Create demo customer with varied invoices
  const createDemoCustomerSchema = z.object({
    customerName: z.string().min(1).max(200).default("Nexus KPI Limited"),
  });
  
  app.post("/api/demo-data/create-demo-customer", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "No tenant associated with user" });
      }

      const parsed = createDemoCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }
      const { customerName } = parsed.data;

      const result = await db.transaction(async (tx) => {
        // Create the customer
        const [contact] = await tx
          .insert(contacts)
          .values({
            tenantId,
            name: "Simon Kramer",
            companyName: customerName,
            email: "simon@nexuskpi.com",
            phone: "+447716273336",
            role: "customer",
            isActive: true,
            paymentTerms: 30,
            creditLimit: "100000",
            preferredContactMethod: "email",
            riskBand: "B",
            riskScore: 68,
            arContactName: "Simon Kramer",
            arContactEmail: "simon@nexuskpi.com",
            arContactPhone: "+447716273336",
          })
          .returning();

        // Create primary credit control contact person
        await tx
          .insert(customerContactPersons)
          .values({
            tenantId,
            contactId: contact.id,
            name: "Simon Kramer",
            email: "simon@qashivo.com",
            phone: "07716273336",
            smsNumber: "07716273336",
            jobTitle: "Credit Controller",
            isPrimaryCreditControl: true,
          });

        // Create 8 invoices with random amounts and unique invoice numbers
        const now = new Date();
        const randomAmount = () => {
          const min = 1500;
          const max = 25000;
          return (Math.random() * (max - min) + min);
        };
        const existingInvNums = await tx
          .select({ invoiceNumber: invoices.invoiceNumber })
          .from(invoices)
          .where(eq(invoices.tenantId, tenantId));
        const usedInvNums = new Set<string>(existingInvNums.map(r => r.invoiceNumber));

        const generateUniqueInvNum = () => {
          let invNum: string;
          do {
            const num = Math.floor(Math.random() * 900000) + 100000;
            invNum = `INV-${num}`;
          } while (usedInvNums.has(invNum));
          usedInvNums.add(invNum);
          return invNum;
        };
        const daysFromDueOptions = [15, 7, -5, -12, -35, -48, -72, -85];
        const serviceTypes = ['Consulting', 'Development', 'Analysis', 'Strategy', 'Implementation', 'Training', 'Support', 'Advisory'];

        const createdInvoices = [];
        for (let i = 0; i < 8; i++) {
          const daysFromDue = daysFromDueOptions[i];
          const amount = randomAmount();
          const invNum = generateUniqueInvNum();

          const status = daysFromDue < 0 ? "overdue" : "outstanding";
          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + daysFromDue);
          const issueDate = new Date(dueDate);
          issueDate.setDate(issueDate.getDate() - 30);

          const [invoice] = await tx
            .insert(invoices)
            .values({
              tenantId,
              contactId: contact.id,
              invoiceNumber: invNum,
              amount: amount.toFixed(2),
              amountPaid: "0",
              status,
              issueDate,
              dueDate,
              currency: "GBP",
              description: `Professional services - ${serviceTypes[i]}`,
              workflowState: status === "overdue" ? "late" : "pre_due",
            })
            .returning();
          createdInvoices.push(invoice);
        }

        return { contact, invoices: createdInvoices };
      });

      res.json({
        success: true,
        message: `Demo customer '${customerName}' created with 8 invoices`,
        data: result
      });
    } catch (error) {
      console.error("Error creating demo customer:", error);
      res.status(500).json({ message: "Failed to create demo customer" });
    }
  });

  // Generate varied invoices for existing customer
  const generateInvoiceSchema = z.object({
    contactId: z.string().min(1),
    count: z.number().min(1).max(50).default(5),
    daysOverdue: z.number().optional(),
  });

  app.post("/api/demo-data/generate-invoice", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "No tenant associated with user" });
      }

      const parsed = generateInvoiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }
      const { contactId, count, daysOverdue } = parsed.data;

      // Verify contact exists
      const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId))).limit(1);
      if (!contact) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const now = new Date();
      const existingInvNums = await db
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(eq(invoices.tenantId, tenantId));
      const usedInvNums = new Set<string>(existingInvNums.map(r => r.invoiceNumber));

      const generateUniqueInvNum = () => {
        let invNum: string;
        do {
          const num = Math.floor(Math.random() * 900000) + 100000;
          invNum = `INV-${num}`;
        } while (usedInvNums.has(invNum));
        usedInvNums.add(invNum);
        return invNum;
      };

      const createdInvoices = [];
      for (let i = 0; i < count; i++) {
        const invNum = generateUniqueInvNum();
        const amount = (Math.random() * 10000 + 500).toFixed(2);
        
        // If daysOverdue is specified, use it, otherwise random mix of current and overdue
        const offset = daysOverdue !== undefined ? -daysOverdue : Math.floor(Math.random() * 60) - 30;
        
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + offset);
        const issueDate = new Date(dueDate);
        issueDate.setDate(issueDate.getDate() - 30);
        
        const status = dueDate < now ? "overdue" : "outstanding";

        const [invoice] = await db
          .insert(invoices)
          .values({
            tenantId,
            contactId,
            invoiceNumber: invNum,
            amount,
            amountPaid: "0",
            status,
            issueDate,
            dueDate,
            currency: "GBP",
            description: "Generated demo invoice",
            workflowState: status === "overdue" ? "late" : "pre_due",
          })
          .returning();
        createdInvoices.push(invoice);
      }

      res.json({
        success: true,
        message: `Generated ${count} invoices for ${contact.companyName || contact.name}`,
        invoices: createdInvoices
      });
    } catch (error) {
      console.error("Error generating invoices:", error);
      res.status(500).json({ message: "Failed to generate invoices" });
    }
  });

  // Simulate payment for an invoice
  const simulatePaymentSchema = z.object({
    invoiceId: z.string().min(1),
    amount: z.number().optional(), // If not provided, pay in full
  });

  app.post("/api/demo-data/simulate-payment", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "No tenant associated with user" });
      }

      const parsed = simulatePaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }
      const { invoiceId, amount } = parsed.data;

      // Get invoice
      const [targetInvoice] = await db.select().from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId))).limit(1);
      if (!targetInvoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const outstanding = parseFloat(targetInvoice.amount) - parseFloat(targetInvoice.amountPaid || "0");
      const payment = amount !== undefined ? Math.min(amount, outstanding) : outstanding;
      const newAmountPaid = parseFloat(targetInvoice.amountPaid || "0") + payment;
      const isFullyPaid = newAmountPaid >= parseFloat(targetInvoice.amount);

      const [updatedInvoice] = await db
        .update(invoices)
        .set({
          amountPaid: newAmountPaid.toFixed(2),
          status: isFullyPaid ? "paid" : targetInvoice.status,
          paidDate: isFullyPaid ? new Date() : null,
          workflowState: isFullyPaid ? "resolved" : targetInvoice.workflowState,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoiceId))
        .returning();

      // Create activity log
      await storage.createActivityLog({
        tenantId,
        userId: req.user?.id,
        activityType: "payment_received",
        category: "collections",
        action: "payment",
        result: "success",
        description: `Simulated payment of £${payment.toFixed(2)} for invoice ${targetInvoice.invoiceNumber}`,
        metadata: { invoiceId, amount: payment, isFullyPaid },
      });

      if (isFullyPaid) {
        import('../services/emailCommunications.js').then(({ sendPaymentThankYouEmail }) => {
          sendPaymentThankYouEmail(targetInvoice.id, tenantId).catch(err =>
            console.error(`[ThankYou] Failed for invoice ${targetInvoice.id}:`, err.message)
          );
        }).catch(err => console.error('[ThankYou] Import failed:', err.message));
      }

      res.json({ 
        success: true, 
        message: `Payment of £${payment.toFixed(2)} applied to ${targetInvoice.invoiceNumber}${isFullyPaid ? ' (fully paid)' : ''}`,
        invoice: updatedInvoice,
        paymentDetails: {
          amount: payment,
          previousBalance: outstanding,
          newBalance: parseFloat(targetInvoice.amount) - newAmountPaid,
          isFullyPaid,
        }
      });
    } catch (error) {
      console.error("Error simulating payment:", error);
      res.status(500).json({ message: "Failed to simulate payment" });
    }
  });

  // Get demo data stats
  app.get("/api/demo-data/stats", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "No tenant associated with user" });
      }

      const [contactCount] = await db.select({ count: sql`count(*)::int` }).from(contacts).where(eq(contacts.tenantId, tenantId));
      const [invoiceCount] = await db.select({ count: sql`count(*)::int` }).from(invoices).where(eq(invoices.tenantId, tenantId));
      const [overdueCount] = await db.select({ count: sql`count(*)::int` }).from(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'overdue')));
      const [actionCount] = await db.select({ count: sql`count(*)::int` }).from(actions).where(eq(actions.tenantId, tenantId));

      res.json({
        customers: contactCount?.count || 0,
        invoices: invoiceCount?.count || 0,
        overdueInvoices: overdueCount?.count || 0,
        actions: actionCount?.count || 0,
      });
    } catch (error) {
      console.error("Error getting demo data stats:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });
}
