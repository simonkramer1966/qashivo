import { ensureMasterAdminExists } from "../services/ensureMasterAdmin";
import { apiMiddleware } from "../middleware";
import { XeroProvider } from "../middleware/providers/XeroProvider";
import { QuickBooksProvider } from "../middleware/providers/QuickBooksProvider";
import { SageProvider } from "../middleware/providers/SageProvider";
import { SendGridProvider } from "../middleware/providers/SendGridProvider";
import { RetellProvider } from "../middleware/providers/RetellProvider";
import { collectionsScheduler } from "../services/collectionsScheduler";
import { syncScheduler } from "../services/syncScheduler";
import { xeroHealthCheckService } from "../services/xeroHealthCheck";
import { ptpBreachDetector } from "../services/ptpBreachDetector";
import { startReportScheduler } from "../services/reportScheduler";
import { startDebtorScoringWorker } from "../jobs/debtorScoringJob";
import { workflowTimerProcessor } from "../jobs/workflow-timer-processor";
import { portfolioController } from "../services/portfolioController";
import { startDsoSnapshotJob } from "../jobs/dsoSnapshotJob";
import { startXeroReconciliationJob } from "../jobs/xeroReconciliationJob";
import { startWeeklyReviewJob } from "../jobs/weeklyReviewJob";
import { startLegalWindowJob } from "../jobs/legalWindowJob";
import { startEnrichmentJob } from "../jobs/enrichmentJob";
import { startImpactScheduler } from "../jobs/impactScheduler";
import { batchProcessor } from "../services/batchProcessor";
import { db } from "../db";
import { tenants, providerConnections } from "@shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { encryptToken, isEncrypted } from "../utils/tokenEncryption";

export async function startAll(): Promise<void> {
  // Phase 0 — Required env vars (fail early)
  const required = ["DATABASE_URL", "ANTHROPIC_API_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`[startup] Missing required environment variables: ${missing.join(", ")}`);
  }

  // Phase 0 — Bootstrap
  try {
    await ensureMasterAdminExists();
    console.log("[startup] master admin ready");
  } catch (error) {
    console.error("[startup] master admin failed:", error);
  }

  // Phase 1 — API providers
  try {
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0]
      || process.env.RAILWAY_PUBLIC_DOMAIN
      || process.env.APP_DOMAIN
      || 'localhost:5000';
    const protocol = domain.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${domain}`;

    if (process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET) {
      const xeroProvider = new XeroProvider({
        name: 'xero',
        type: 'accounting',
        clientId: process.env.XERO_CLIENT_ID,
        clientSecret: process.env.XERO_CLIENT_SECRET,
        baseUrl,
        scopes: ['accounting.transactions', 'accounting.contacts'],
        redirectUri: `${baseUrl}/api/xero/callback`,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      });
      await apiMiddleware.registerProvider(xeroProvider);
      console.log("[startup] xero provider registered");
    }

    if (process.env.SAGE_CLIENT_ID && process.env.SAGE_CLIENT_SECRET) {
      const sageProvider = new SageProvider({
        name: 'sage',
        type: 'accounting',
        clientId: process.env.SAGE_CLIENT_ID,
        clientSecret: process.env.SAGE_CLIENT_SECRET,
        baseUrl: 'https://api.accounting.sage.com/v3.1',
        scopes: ['full_access'],
        redirectUri: `${baseUrl}/api/providers/callback/sage`,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      });
      await apiMiddleware.registerProvider(sageProvider);
      console.log("[startup] sage provider registered");
    }

    if (process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET) {
      const quickBooksProvider = new QuickBooksProvider({
        name: 'quickbooks',
        type: 'accounting',
        clientId: process.env.QB_CLIENT_ID,
        clientSecret: process.env.QB_CLIENT_SECRET,
        baseUrl: process.env.NODE_ENV === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com',
        scopes: ['com.intuit.quickbooks.accounting'],
        redirectUri: `${baseUrl}/api/providers/callback/quickbooks`,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      });
      await apiMiddleware.registerProvider(quickBooksProvider);
      console.log("[startup] quickbooks provider registered");
    }

    if (process.env.SENDGRID_API_KEY) {
      const sendGridProvider = new SendGridProvider({
        name: 'sendgrid',
        type: 'email',
        apiKey: process.env.SENDGRID_API_KEY,
        baseUrl: 'https://api.sendgrid.com/v3',
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      });
      await apiMiddleware.registerProvider(sendGridProvider);
      console.log("[startup] sendgrid provider registered");
    }

    if (process.env.RETELL_API_KEY) {
      const retellProvider = new RetellProvider({
        name: 'retell',
        type: 'voice',
        apiKey: process.env.RETELL_API_KEY,
        baseUrl: 'https://api.retellai.com',
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      });
      await apiMiddleware.registerProvider(retellProvider);
      console.log("[startup] retell provider registered");
    }
  } catch (error) {
    console.error("[startup] API providers failed:", error);
  }

  // Phase 1.5 — Seed provider_connections from existing Xero tenants
  try {
    await seedProviderConnections();
    console.log("[startup] provider_connections seeded");
  } catch (error) {
    console.error("[startup] provider_connections seed failed:", error);
  }

  // Phase 2 — Background services
  try {
    collectionsScheduler.start();
    console.log("[startup] collections scheduler started");
  } catch (error) {
    console.error("[startup] collections scheduler failed:", error);
  }

  try {
    syncScheduler.start();
    console.log("[startup] sync scheduler started");
  } catch (error) {
    console.error("[startup] sync scheduler failed:", error);
  }

  try {
    await xeroHealthCheckService.start();
    console.log("[startup] xero health check started");
  } catch (error) {
    console.error("[startup] xero health check failed:", error);
  }

  try {
    ptpBreachDetector.start();
    console.log("[startup] ptp breach detector started");
  } catch (error) {
    console.error("[startup] ptp breach detector failed:", error);
  }

  try {
    startReportScheduler();
    console.log("[startup] report scheduler started");
  } catch (error) {
    console.error("[startup] report scheduler failed:", error);
  }

  try {
    workflowTimerProcessor.start();
    console.log("[startup] workflow timer processor started");
  } catch (error) {
    console.error("[startup] workflow timer processor failed:", error);
  }

  try {
    startDebtorScoringWorker();
    console.log("[startup] debtor scoring worker started");
  } catch (error) {
    console.error("[startup] debtor scoring worker failed:", error);
  }

  try {
    portfolioController.start();
    console.log("[startup] portfolio controller started");
  } catch (error) {
    console.error("[startup] portfolio controller failed:", error);
  }

  try {
    startDsoSnapshotJob();
    console.log("[startup] DSO snapshot job started");
  } catch (error) {
    console.error("[startup] DSO snapshot job failed:", error);
  }

  try {
    batchProcessor.start();
    console.log("[startup] batch processor started");
  } catch (error) {
    console.error("[startup] batch processor failed:", error);
  }

  try {
    startXeroReconciliationJob();
    console.log("[startup] xero reconciliation job scheduled");
  } catch (error) {
    console.error("[startup] xero reconciliation job failed:", error);
  }

  try {
    startWeeklyReviewJob();
    console.log("[startup] weekly review job scheduled");
  } catch (error) {
    console.error("[startup] weekly review job failed:", error);
  }

  try {
    startLegalWindowJob();
    console.log("[startup] legal window job scheduled");
  } catch (error) {
    console.error("[startup] legal window job failed:", error);
  }

  try {
    startEnrichmentJob();
    console.log("[startup] enrichment job scheduled");
  } catch (error) {
    console.error("[startup] enrichment job failed:", error);
  }

  try {
    startImpactScheduler();
    console.log("[startup] impact scheduler started");
  } catch (error) {
    console.error("[startup] impact scheduler failed:", error);
  }
}

/**
 * Seed provider_connections table from existing Xero tenant data.
 * Idempotent — safe to run on every startup. Skips tenants that already have a connection row.
 */
async function seedProviderConnections(): Promise<void> {
  const hasEncryptionKey = !!process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
  if (!hasEncryptionKey) {
    console.warn("[startup] PROVIDER_TOKEN_ENCRYPTION_KEY not set — skipping provider_connections seed");
    return;
  }

  // Find tenants with Xero tokens that don't yet have a provider_connections row
  const xeroTenants = await db.select()
    .from(tenants)
    .where(isNotNull(tenants.xeroAccessToken));

  let seeded = 0;
  for (const tenant of xeroTenants) {
    if (!tenant.xeroAccessToken) continue;

    // Check if connection already exists
    const [existing] = await db.select({ id: providerConnections.id })
      .from(providerConnections)
      .where(and(
        eq(providerConnections.tenantId, tenant.id),
        eq(providerConnections.provider, 'xero')
      ));

    if (existing) continue;

    // Encrypt tokens before storing
    const encryptedAccess = encryptToken(tenant.xeroAccessToken);
    const encryptedRefresh = tenant.xeroRefreshToken ? encryptToken(tenant.xeroRefreshToken) : null;

    await db.insert(providerConnections).values({
      tenantId: tenant.id,
      provider: 'xero',
      connectionName: tenant.xeroOrganisationName || 'Xero',
      isActive: true,
      isConnected: !!tenant.xeroAccessToken,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      tokenExpiresAt: tenant.xeroExpiresAt || null,
      providerId: tenant.xeroTenantId || null,
      lastConnectedAt: new Date(),
      lastSyncAt: tenant.xeroLastSyncAt || null,
      syncFrequency: 'hourly',
      autoSyncEnabled: tenant.xeroAutoSync ?? true,
    });

    seeded++;
  }

  if (seeded > 0) {
    console.log(`[startup] Seeded ${seeded} Xero connection(s) into provider_connections`);
  }
}
