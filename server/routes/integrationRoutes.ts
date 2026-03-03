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

import { apiMiddleware } from "../middleware";

export async function registerIntegrationRoutes(app: Express): Promise<void> {
  app.get("/api/integrations/xero/connect", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      if (!req.session) {
        return res.status(401).json({ message: "Session required for authentication. Please log in again." });
      }

      const ALLOWED_HOSTS = new Set([
        'qashivo.com',
        'www.qashivo.com',
        'qashivo.replit.app',
        ...(process.env.REPLIT_DOMAINS?.split(',').map(d => d.trim()) || []),
        'localhost:5000',
      ]);

      const xeroRedirectUri = (() => {
        const host = req.headers['x-forwarded-host'] as string || req.headers.host || '';
        const cleanHost = host.split(',')[0].trim();
        if (!ALLOWED_HOSTS.has(cleanHost)) {
          console.warn(`[Xero] Rejected unknown host: ${cleanHost}, falling back to REPLIT_DOMAINS`);
          const fallbackDomain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
          const fallbackProto = fallbackDomain.includes('localhost') ? 'http' : 'https';
          return `${fallbackProto}://${fallbackDomain}/api/xero/callback`;
        }
        const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || (cleanHost.includes('localhost') ? 'http' : 'https');
        return `${proto}://${cleanHost}/api/xero/callback`;
      })();
      console.log(`[Xero] /api/integrations/xero/connect - Dynamic redirect URI: ${xeroRedirectUri}`);

      req.session.xeroRedirectUri = xeroRedirectUri;
      req.session.oauthUserId = user.id;

      const result = await apiMiddleware.connectProvider('xero', req.session, user.tenantId, undefined, xeroRedirectUri);

      if (!result.success || !result.authUrl) {
        return res.status(400).json({ message: result.error || "Failed to generate Xero authorization URL" });
      }

      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({ authUrl: result.authUrl });
    } catch (error) {
      console.error("Error in /api/integrations/xero/connect:", error);
      res.status(500).json({ message: "Failed to initiate Xero connection" });
    }
  });

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

      const ALLOWED_XERO_HOSTS = new Set([
        'qashivo.com',
        'www.qashivo.com',
        'qashivo.replit.app',
        ...(process.env.REPLIT_DOMAINS?.split(',').map(d => d.trim()) || []),
        'localhost:5000',
      ]);

      const xeroRedirectUri = (() => {
        const host = req.headers['x-forwarded-host'] as string || req.headers.host || '';
        const cleanHost = host.split(',')[0].trim();
        if (!ALLOWED_XERO_HOSTS.has(cleanHost)) {
          console.warn(`[Xero] Rejected unknown host: ${cleanHost}, falling back to REPLIT_DOMAINS`);
          const fallbackDomain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
          const fallbackProto = fallbackDomain.includes('localhost') ? 'http' : 'https';
          return `${fallbackProto}://${fallbackDomain}/api/xero/callback`;
        }
        const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || (cleanHost.includes('localhost') ? 'http' : 'https');
        return `${proto}://${cleanHost}/api/xero/callback`;
      })();
      console.log(`[Xero] Dynamic redirect URI: ${xeroRedirectUri}`);

      req.session.xeroRedirectUri = xeroRedirectUri;

      const result = await apiMiddleware.connectProvider('xero', req.session, user.tenantId, undefined, xeroRedirectUri);
      
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

      const storedRedirectUri = req.session?.xeroRedirectUri;
      if (!storedRedirectUri) {
        console.error('[Xero] No stored redirect URI in session — session may have expired');
        const host = req.headers['x-forwarded-host'] as string || req.headers.host || '';
        const cleanHost = host.split(',')[0].trim();
        const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || (cleanHost.includes('localhost') ? 'http' : 'https');
        const fallbackUri = `${proto}://${cleanHost}/api/xero/callback`;
        console.log(`[Xero] Callback using fallback redirect URI: ${fallbackUri}`);
        req.session.xeroRedirectUri = fallbackUri;
      }
      const callbackRedirectUri = req.session.xeroRedirectUri;
      console.log(`[Xero] Callback redirect URI: ${callbackRedirectUri}`);

      const result = await apiMiddleware.completeConnection('xero', code as string, state as string, req.session, callbackRedirectUri);
      
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

      // Determine redirect: settings (if reconnecting) vs onboarding (if first time)
      let isOnboardingComplete = false;
      let redirectUrl = '/onboarding';
      
      try {
        isOnboardingComplete = await onboardingService.isOnboardingCompleted(appTenantId);
        
        // Clean up returnTo from session
        const rawReturnTo = req.session?.xeroReturnTo;
        if (req.session?.xeroReturnTo) {
          delete req.session.xeroReturnTo;
        }
        
        if (isOnboardingComplete) {
          const allowedRoutes = new Set([
            '/dashboard', '/settings', '/settings/integrations', '/settings/team',
            '/settings/billing', '/action-centre', '/contacts', '/invoices',
            '/workflows', '/analytics', '/profile', '/admin',
          ]);
          
          if (rawReturnTo && typeof rawReturnTo === 'string' && allowedRoutes.has(rawReturnTo)) {
            redirectUrl = rawReturnTo;
          } else {
            redirectUrl = '/dashboard';
          }
          console.log(`📍 Onboarding complete - redirecting to: ${redirectUrl}`);
        } else {
          // Mark step 2 (Connect Xero) as COMPLETED without touching other steps
          await onboardingService.updateStepStatus(appTenantId, 2, "COMPLETED");
          redirectUrl = '/onboarding';
          console.log(`📍 Onboarding incomplete - marked step 2 complete, redirecting to: ${redirectUrl}`);
        }
      } catch (error) {
        console.error(`⚠️ Failed to check onboarding status:`, error);
      }

      // Trigger automatic comprehensive sync after successful connection
      console.log(`🚀 Triggering automatic initial Xero sync for tenant: ${appTenantId}`);
      const syncService = new XeroSyncService();
      syncService.syncAllDataForTenant(appTenantId)
        .then(async (result) => {
          if (result.success) {
            console.log(`✅ Initial Xero sync completed successfully:`, result);
            try {
              const { enqueueDebtorScoringAfterSync } = await import("./jobs/debtorScoringJob");
              await enqueueDebtorScoringAfterSync(appTenantId);
            } catch (err) {
              console.error("Failed to enqueue debtor scoring after sync:", err);
            }
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
          totalBudgetedAmount: budgets.reduce((sum, budget) => sum + Number(budget.totalBudgetedAmount || 0), 0),
          totalActualAmount: budgets.reduce((sum, budget) => sum + Number(budget.totalActualAmount || 0), 0),
          years: [...new Set(budgets.map(b => b.year))].sort(),
          statuses: [...new Set(budgets.map(b => b.status))]
        }
      });
    } catch (error) {
      console.error('Error fetching budgets:', error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

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
}
