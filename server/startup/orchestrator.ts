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

export async function startAll(): Promise<void> {
  // Phase 0 — Bootstrap
  try {
    await ensureMasterAdminExists();
    console.log("[startup] master admin ready");
  } catch (error) {
    console.error("[startup] master admin failed:", error);
  }

  // Phase 1 — API providers
  try {
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
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

  // Phase 2 — Background services
  try {
    void collectionsScheduler;
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
}
