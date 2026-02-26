import { ensureMasterAdminExists } from '../services/ensureMasterAdmin';
import { apiMiddleware } from '../middleware';
import { XeroProvider } from '../middleware/providers/XeroProvider';
import { QuickBooksProvider } from '../middleware/providers/QuickBooksProvider';
import { SageProvider } from '../middleware/providers/SageProvider';
import { SendGridProvider } from '../middleware/providers/SendGridProvider';
import { RetellProvider } from '../middleware/providers/RetellProvider';
import { collectionsScheduler } from '../services/collectionsScheduler';
import { syncScheduler } from '../services/syncScheduler';
import { xeroHealthCheckService } from '../services/xeroHealthCheck';
import { ptpBreachDetector } from '../services/ptpBreachDetector';
import { startReportScheduler } from '../services/reportScheduler';
import { startDebtorScoringWorker } from '../jobs/debtorScoringJob';
import { workflowTimerProcessor } from '../jobs/workflow-timer-processor';
import { portfolioController } from '../services/portfolioController';

async function registerProviders(): Promise<void> {
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
  const protocol = domain.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${domain}`;

  if (process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET) {
    await apiMiddleware.registerProvider(new XeroProvider({
      name: 'xero',
      type: 'accounting',
      clientId: process.env.XERO_CLIENT_ID,
      clientSecret: process.env.XERO_CLIENT_SECRET,
      baseUrl,
      scopes: ['accounting.transactions', 'accounting.contacts'],
      redirectUri: `${baseUrl}/api/xero/callback`,
      environment: env,
    }));
    console.log('[startup] xero provider registered');
  }

  if (process.env.SAGE_CLIENT_ID && process.env.SAGE_CLIENT_SECRET) {
    await apiMiddleware.registerProvider(new SageProvider({
      name: 'sage',
      type: 'accounting',
      clientId: process.env.SAGE_CLIENT_ID,
      clientSecret: process.env.SAGE_CLIENT_SECRET,
      baseUrl: 'https://api.accounting.sage.com/v3.1',
      scopes: ['full_access'],
      redirectUri: `${baseUrl}/api/providers/callback/sage`,
      environment: env,
    }));
    console.log('[startup] sage provider registered');
  }

  if (process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET) {
    await apiMiddleware.registerProvider(new QuickBooksProvider({
      name: 'quickbooks',
      type: 'accounting',
      clientId: process.env.QB_CLIENT_ID,
      clientSecret: process.env.QB_CLIENT_SECRET,
      baseUrl: process.env.NODE_ENV === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com',
      scopes: ['com.intuit.quickbooks.accounting'],
      redirectUri: `${baseUrl}/api/providers/callback/quickbooks`,
      environment: env,
    }));
    console.log('[startup] quickbooks provider registered');
  }

  if (process.env.SENDGRID_API_KEY) {
    await apiMiddleware.registerProvider(new SendGridProvider({
      name: 'sendgrid',
      type: 'email',
      apiKey: process.env.SENDGRID_API_KEY,
      baseUrl: 'https://api.sendgrid.com/v3',
      environment: env,
    }));
    console.log('[startup] sendgrid provider registered');
  }

  if (process.env.RETELL_API_KEY) {
    await apiMiddleware.registerProvider(new RetellProvider({
      name: 'retell',
      type: 'voice',
      apiKey: process.env.RETELL_API_KEY,
      baseUrl: 'https://api.retellai.com',
      environment: env,
    }));
    console.log('[startup] retell provider registered');
  }
}

export async function startAll(): Promise<void> {
  // Phase 0 — Bootstrap
  try {
    await ensureMasterAdminExists();
  } catch (error) {
    console.error('[startup] ensureMasterAdminExists failed:', error);
  }

  // Phase 1 — API providers
  try {
    await registerProviders();
  } catch (error) {
    console.error('[startup] provider registration failed:', error);
  }

  // Phase 2 — Background services (each isolated so one failure does not block others)
  const services: Array<{ name: string; start: () => void | Promise<void> }> = [
    { name: 'collectionsScheduler', start: () => collectionsScheduler.start() },
    { name: 'syncScheduler',        start: () => syncScheduler.start() },
    { name: 'xeroHealthCheck',      start: () => xeroHealthCheckService.start() },
    { name: 'ptpBreachDetector',    start: () => ptpBreachDetector.start() },
    { name: 'reportScheduler',      start: () => startReportScheduler() },
    { name: 'debtorScoringWorker',  start: () => startDebtorScoringWorker() },
    { name: 'workflowTimerProcessor', start: () => workflowTimerProcessor.start() },
    { name: 'portfolioController',  start: () => portfolioController.start() },
  ];

  for (const svc of services) {
    try {
      await svc.start();
      console.log(`[startup] ${svc.name} started`);
    } catch (error) {
      console.error(`[startup] ${svc.name} failed to start:`, error);
    }
  }
}
