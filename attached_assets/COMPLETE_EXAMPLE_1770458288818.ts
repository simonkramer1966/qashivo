/**
 * COMPLETE EXAMPLE IMPLEMENTATION
 * 
 * This file shows a complete, working example of integrating
 * the demo Xero system into your Qashivo codebase.
 */

// ============================================================================
// FILE: server/index.ts
// ============================================================================

import express from 'express';
import { DemoXeroInterceptor } from './services/xero/demoXeroInterceptor';
import { setupRoutes } from './routes';
import { initializeDatabase } from './database';

const app = express();
const PORT = process.env.PORT || 5000;

async function startServer() {
  console.log('🚀 Starting Qashivo server...\n');
  
  // Initialize database
  await initializeDatabase();
  console.log('✅ Database connected\n');
  
  // Initialize demo Xero companies
  // This creates 4 companies automatically (SaaS, Construction, Retail, Manufacturing)
  DemoXeroInterceptor.initialize();
  
  // Setup middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Setup routes
  setupRoutes(app);
  
  // Start listening
  app.listen(PORT, () => {
    console.log(`\n✅ Server running on port ${PORT}`);
    console.log(`   📊 Demo companies available at http://localhost:${PORT}/api/demo/xero-companies\n`);
  });
}

startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// ============================================================================
// FILE: server/services/xero.ts (Your existing Xero service - MODIFIED)
// ============================================================================

import { XeroClient } from 'xero-node';
import { db } from '../database';
import { invoices, contacts, payments } from '../schema';
import { DemoXeroInterceptor } from './xero/demoXeroInterceptor';
import { eq, and } from 'drizzle-orm';

/**
 * Sync invoices from Xero (or demo data)
 */
export async function syncXeroInvoices(tenantId: string, options?: {
  fromDate?: Date;
  status?: string;
}) {
  try {
    console.log(`\n🔄 Syncing invoices for tenant ${tenantId}...`);
    
    // Build filter params
    const whereParams: string[] = [];
    if (options?.fromDate) {
      const date = options.fromDate;
      whereParams.push(`Date >= DateTime(${date.getFullYear()}, ${date.getMonth() + 1}, ${date.getDate()})`);
    }
    if (options?.status) {
      whereParams.push(`Status == "${options.status}"`);
    }
    
    const whereClause = whereParams.length > 0 ? whereParams.join(' AND ') : undefined;

    // CHECK FOR DEMO TENANT
    const intercepted = DemoXeroInterceptor.interceptXeroCall(
      tenantId,
      '/api.xero.com/api.xro/2.0/Invoices',
      'GET',
      { where: whereClause }
    );

    let invoicesResponse;
    let source: 'demo' | 'xero' = 'xero';

    if (intercepted.shouldIntercept) {
      // Use demo data
      console.log('  📊 Using demo data');
      invoicesResponse = intercepted.response;
      source = 'demo';
    } else {
      // Real Xero API call
      console.log('  🔗 Calling Xero API');
      const xeroClient = await getXeroClient(tenantId);
      const response = await xeroClient.accountingApi.getInvoices(
        tenantId,
        undefined,
        whereClause
      );
      invoicesResponse = response.body;
    }

    // Process invoices through common pipeline
    const processed = await processInvoicesResponse(tenantId, invoicesResponse);
    
    console.log(`  ✅ Synced ${processed.count} invoices (${source})`);
    
    return {
      success: true,
      count: processed.count,
      created: processed.created,
      updated: processed.updated,
      source,
    };
  } catch (error) {
    console.error('❌ Error syncing invoices:', error);
    throw error;
  }
}

/**
 * Sync contacts from Xero (or demo data)
 */
export async function syncXeroContacts(tenantId: string) {
  try {
    console.log(`\n🔄 Syncing contacts for tenant ${tenantId}...`);
    
    const intercepted = DemoXeroInterceptor.interceptXeroCall(
      tenantId,
      '/api.xero.com/api.xro/2.0/Contacts',
      'GET',
      { where: 'IsCustomer==true' }
    );

    let contactsResponse;
    let source: 'demo' | 'xero' = 'xero';

    if (intercepted.shouldIntercept) {
      console.log('  📊 Using demo data');
      contactsResponse = intercepted.response;
      source = 'demo';
    } else {
      console.log('  🔗 Calling Xero API');
      const xeroClient = await getXeroClient(tenantId);
      const response = await xeroClient.accountingApi.getContacts(
        tenantId,
        undefined,
        'IsCustomer==true'
      );
      contactsResponse = response.body;
    }

    const processed = await processContactsResponse(tenantId, contactsResponse);
    
    console.log(`  ✅ Synced ${processed.count} contacts (${source})`);
    
    return {
      success: true,
      count: processed.count,
      created: processed.created,
      updated: processed.updated,
      source,
    };
  } catch (error) {
    console.error('❌ Error syncing contacts:', error);
    throw error;
  }
}

/**
 * Sync payments from Xero (or demo data)
 */
export async function syncXeroPayments(tenantId: string, fromDate?: Date) {
  try {
    console.log(`\n🔄 Syncing payments for tenant ${tenantId}...`);
    
    let whereClause: string | undefined;
    if (fromDate) {
      whereClause = `Date >= DateTime(${fromDate.getFullYear()}, ${fromDate.getMonth() + 1}, ${fromDate.getDate()})`;
    }

    const intercepted = DemoXeroInterceptor.interceptXeroCall(
      tenantId,
      '/api.xero.com/api.xro/2.0/Payments',
      'GET',
      { where: whereClause }
    );

    let paymentsResponse;
    let source: 'demo' | 'xero' = 'xero';

    if (intercepted.shouldIntercept) {
      console.log('  📊 Using demo data');
      paymentsResponse = intercepted.response;
      source = 'demo';
    } else {
      console.log('  🔗 Calling Xero API');
      const xeroClient = await getXeroClient(tenantId);
      const response = await xeroClient.accountingApi.getPayments(
        tenantId,
        undefined,
        whereClause
      );
      paymentsResponse = response.body;
    }

    const processed = await processPaymentsResponse(tenantId, paymentsResponse);
    
    console.log(`  ✅ Synced ${processed.count} payments (${source})`);
    
    return {
      success: true,
      count: processed.count,
      created: processed.created,
      updated: processed.updated,
      source,
    };
  } catch (error) {
    console.error('❌ Error syncing payments:', error);
    throw error;
  }
}

/**
 * Process invoices response (works for both Xero and demo data)
 */
async function processInvoicesResponse(tenantId: string, response: any) {
  const xeroInvoices = response.Invoices || [];
  let created = 0;
  let updated = 0;

  for (const xeroInvoice of xeroInvoices) {
    // Check if invoice exists
    const existing = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.xeroInvoiceId, xeroInvoice.InvoiceID)
      ),
    });

    const invoiceData = {
      tenantId,
      xeroInvoiceId: xeroInvoice.InvoiceID,
      invoiceNumber: xeroInvoice.InvoiceNumber,
      contactId: xeroInvoice.Contact.ContactID,
      contactName: xeroInvoice.Contact.Name,
      date: new Date(xeroInvoice.DateString),
      dueDate: new Date(xeroInvoice.DueDateString),
      status: xeroInvoice.Status.toLowerCase(),
      total: xeroInvoice.Total,
      amountDue: xeroInvoice.AmountDue,
      amountPaid: xeroInvoice.AmountPaid,
      currencyCode: xeroInvoice.CurrencyCode,
      reference: xeroInvoice.Reference || null,
    };

    if (existing) {
      // Update existing
      await db
        .update(invoices)
        .set({
          ...invoiceData,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, existing.id));
      updated++;
    } else {
      // Create new
      await db.insert(invoices).values(invoiceData);
      created++;
    }
  }

  return { count: xeroInvoices.length, created, updated };
}

/**
 * Process contacts response
 */
async function processContactsResponse(tenantId: string, response: any) {
  const xeroContacts = response.Contacts || [];
  let created = 0;
  let updated = 0;

  for (const xeroContact of xeroContacts) {
    const existing = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.tenantId, tenantId),
        eq(contacts.xeroContactId, xeroContact.ContactID)
      ),
    });

    const contactData = {
      tenantId,
      xeroContactId: xeroContact.ContactID,
      name: xeroContact.Name,
      email: xeroContact.EmailAddress || null,
      phone: xeroContact.Phones?.[0]?.PhoneNumber || null,
      status: xeroContact.ContactStatus.toLowerCase(),
    };

    if (existing) {
      await db
        .update(contacts)
        .set({
          ...contactData,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, existing.id));
      updated++;
    } else {
      await db.insert(contacts).values(contactData);
      created++;
    }
  }

  return { count: xeroContacts.length, created, updated };
}

/**
 * Process payments response
 */
async function processPaymentsResponse(tenantId: string, response: any) {
  const xeroPayments = response.Payments || [];
  let created = 0;
  let updated = 0;

  for (const xeroPayment of xeroPayments) {
    const existing = await db.query.payments.findFirst({
      where: and(
        eq(payments.tenantId, tenantId),
        eq(payments.xeroPaymentId, xeroPayment.PaymentID)
      ),
    });

    const paymentData = {
      tenantId,
      xeroPaymentId: xeroPayment.PaymentID,
      invoiceId: xeroPayment.Invoice?.InvoiceID || null,
      amount: xeroPayment.Amount,
      date: new Date(xeroPayment.Date),
      reference: xeroPayment.Reference || null,
      status: xeroPayment.Status?.toLowerCase() || 'authorised',
    };

    if (existing) {
      await db
        .update(payments)
        .set({
          ...paymentData,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existing.id));
      updated++;
    } else {
      await db.insert(payments).values(paymentData);
      created++;
    }
  }

  return { count: xeroPayments.length, created, updated };
}

/**
 * Get Xero client (for real API calls)
 */
async function getXeroClient(tenantId: string): Promise<XeroClient> {
  // Your existing Xero client initialization
  // This is only called for NON-demo tenants
  const tokenSet = await getXeroTokenSet(tenantId);
  
  const xeroClient = new XeroClient({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
    redirectUris: [process.env.XERO_REDIRECT_URI!],
    scopes: process.env.XERO_SCOPES!.split(' '),
  });
  
  await xeroClient.setTokenSet(tokenSet);
  return xeroClient;
}

// ============================================================================
// FILE: server/routes.ts (Demo management routes - NEW)
// ============================================================================

import { Express, Request, Response } from 'express';
import { DemoXeroInterceptor } from './services/xero/demoXeroInterceptor';
import { syncXeroInvoices, syncXeroContacts, syncXeroPayments } from './services/xero';

export function setupRoutes(app: Express) {
  // Your existing routes...
  
  // ==================== DEMO ROUTES ====================
  
  /**
   * List all demo companies
   */
  app.get('/api/demo/xero-companies', (req: Request, res: Response) => {
    try {
      const companies = DemoXeroInterceptor.getAllCompanies();
      res.json({
        success: true,
        companies,
        total: companies.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Create a new demo company
   */
  app.post('/api/demo/setup-xero-company', async (req: Request, res: Response) => {
    try {
      const { tenantId, archetype } = req.body;
      
      if (!tenantId || !archetype) {
        return res.status(400).json({
          error: 'Missing required fields: tenantId, archetype',
        });
      }

      const validArchetypes = ['SaaS', 'Construction', 'Retail', 'Manufacturing', 'Professional Services', 'Wholesale'];
      if (!validArchetypes.includes(archetype)) {
        return res.status(400).json({
          error: `Invalid archetype. Must be one of: ${validArchetypes.join(', ')}`,
        });
      }

      // Create demo company
      const company = DemoXeroInterceptor.createCompany(tenantId, archetype);
      
      // Run initial sync
      console.log(`\n🔄 Running initial sync for ${company.name}...`);
      const invoiceSync = await syncXeroInvoices(tenantId);
      const contactSync = await syncXeroContacts(tenantId);
      const paymentSync = await syncXeroPayments(tenantId);
      
      res.json({
        success: true,
        company: {
          id: company.id,
          name: company.name,
          archetype: company.archetype,
        },
        sync: {
          invoices: invoiceSync.count,
          contacts: contactSync.count,
          payments: paymentSync.count,
        },
        stats: {
          totalRevenue: company.metadata.totalRevenue,
          outstandingAmount: company.metadata.outstandingAmount,
        },
      });
    } catch (error: any) {
      console.error('Error setting up demo company:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Simulate trading activity
   */
  app.post('/api/demo/simulate-trading', async (req: Request, res: Response) => {
    try {
      const { tenantId, days = 7 } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      if (!DemoXeroInterceptor.isDemoTenant(tenantId)) {
        return res.status(404).json({ error: 'Demo company not found' });
      }

      // Simulate trading
      const result = DemoXeroInterceptor.simulateTradingActivity(tenantId, days);
      
      // Sync new data
      await syncXeroInvoices(tenantId);
      await syncXeroPayments(tenantId);
      
      res.json({
        success: true,
        simulation: result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Create single invoice
   */
  app.post('/api/demo/create-invoice', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.body;
      
      if (!DemoXeroInterceptor.isDemoTenant(tenantId)) {
        return res.status(404).json({ error: 'Not a demo tenant' });
      }

      const invoice = DemoXeroInterceptor.simulateNewInvoice(tenantId);
      if (!invoice) {
        return res.status(500).json({ error: 'Failed to create invoice' });
      }

      await syncXeroInvoices(tenantId);
      
      res.json({
        success: true,
        invoice: {
          id: invoice.InvoiceID,
          number: invoice.InvoiceNumber,
          amount: invoice.Total,
          contact: invoice.Contact.Name,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Simulate payment received
   */
  app.post('/api/demo/receive-payment', async (req: Request, res: Response) => {
    try {
      const { tenantId, invoiceId } = req.body;
      
      if (!DemoXeroInterceptor.isDemoTenant(tenantId)) {
        return res.status(404).json({ error: 'Not a demo tenant' });
      }

      const payment = DemoXeroInterceptor.simulatePaymentReceived(tenantId, invoiceId);
      if (!payment) {
        return res.status(404).json({ error: 'No unpaid invoices found' });
      }

      await syncXeroInvoices(tenantId);
      await syncXeroPayments(tenantId);
      
      res.json({
        success: true,
        payment: {
          id: payment.PaymentID,
          amount: payment.Amount,
          invoice: payment.Invoice?.InvoiceNumber,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Manual sync
   */
  app.post('/api/demo/sync-xero-data', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.body;
      
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      if (!DemoXeroInterceptor.isDemoTenant(tenantId)) {
        return res.status(404).json({ error: 'Not a demo tenant' });
      }

      const invoiceSync = await syncXeroInvoices(tenantId);
      const contactSync = await syncXeroContacts(tenantId);
      const paymentSync = await syncXeroPayments(tenantId);
      
      res.json({
        success: true,
        synced: {
          invoices: invoiceSync.count,
          contacts: contactSync.count,
          payments: paymentSync.count,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Clear demo company
   */
  app.delete('/api/demo/xero-company/:tenantId', (req: Request, res: Response) => {
    const { tenantId } = req.params;
    const cleared = DemoXeroInterceptor.clearCompany(tenantId);
    
    if (cleared) {
      res.json({ success: true, message: 'Demo company cleared' });
    } else {
      res.status(404).json({ error: 'Demo company not found' });
    }
  });
}

// ============================================================================
// TESTING THE IMPLEMENTATION
// ============================================================================

/*

1. Start your server:
   npm run dev

2. In another terminal, test the demo system:

# List demo companies (should show 4 auto-generated ones)
curl http://localhost:5000/api/demo/xero-companies

# Create your own demo company
curl -X POST http://localhost:5000/api/demo/setup-xero-company \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "my-saas-demo", "archetype": "SaaS"}'

# Check the database - should see invoices, contacts, payments
SELECT COUNT(*) FROM invoices WHERE tenant_id = 'my-saas-demo';

# Simulate 30 days of trading
curl -X POST http://localhost:5000/api/demo/simulate-trading \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "my-saas-demo", "days": 30}'

# Check database again - should see new invoices and payments
SELECT COUNT(*) FROM invoices WHERE tenant_id = 'my-saas-demo';
SELECT COUNT(*) FROM payments WHERE tenant_id = 'my-saas-demo';

3. Test with your UI:
   - Load dashboard for tenant 'my-saas-demo'
   - Should see all the invoices, contacts, and actions
   - Collections automation should work normally

4. Test collections automation:
   - Run your decision engine for the demo tenant
   - Should generate appropriate collection actions
   - Actions should respect payment behavior patterns

*/
