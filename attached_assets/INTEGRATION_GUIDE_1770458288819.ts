/**
 * INTEGRATION GUIDE: Wiring Demo Xero to Your Existing Code
 * 
 * This guide shows exactly how to integrate the demo Xero system
 * with your existing Xero integration service.
 */

// ============================================================================
// STEP 1: Initialize Demo Companies at Server Startup
// ============================================================================

// In your server/index.ts (or main entry point):

import { DemoXeroInterceptor } from './services/xero/demoXeroInterceptor';

// Add this near the top of your startup sequence:
async function initializeServer() {
  console.log('🚀 Starting Qashivo server...\n');
  
  // Initialize demo Xero companies
  DemoXeroInterceptor.initialize();
  
  // ... rest of your startup code
}

// ============================================================================
// STEP 2: Modify Your Existing Xero Service
// ============================================================================

// In your server/services/xero.ts (or wherever your Xero integration lives):

import { DemoXeroInterceptor } from './xero/demoXeroInterceptor';

// Example: Modify your existing syncXeroInvoices function
export async function syncXeroInvoices(tenantId: string) {
  try {
    // CHECK IF THIS IS A DEMO TENANT FIRST
    const intercepted = DemoXeroInterceptor.interceptXeroCall(
      tenantId,
      '/api.xero.com/api.xro/2.0/Invoices',
      'GET'
    );

    if (intercepted.shouldIntercept) {
      console.log(`📊 Using demo data for tenant ${tenantId}`);
      
      // Process demo invoices through your EXISTING pipeline
      const invoicesResponse = intercepted.response;
      await processXeroInvoicesResponse(tenantId, invoicesResponse);
      
      return {
        success: true,
        count: invoicesResponse.Invoices.length,
        source: 'demo',
      };
    }

    // NORMAL XERO API CALL (non-demo tenants)
    const xeroClient = await getXeroClient(tenantId);
    const response = await xeroClient.accountingApi.getInvoices(tenantId);
    await processXeroInvoicesResponse(tenantId, response.body);
    
    return {
      success: true,
      count: response.body.invoices?.length || 0,
      source: 'xero',
    };
  } catch (error) {
    console.error('Error syncing Xero invoices:', error);
    throw error;
  }
}

// Example: Modify your contacts sync
export async function syncXeroContacts(tenantId: string) {
  try {
    const intercepted = DemoXeroInterceptor.interceptXeroCall(
      tenantId,
      '/api.xero.com/api.xro/2.0/Contacts',
      'GET',
      { where: 'IsCustomer==true' }
    );

    if (intercepted.shouldIntercept) {
      const contactsResponse = intercepted.response;
      await processXeroContactsResponse(tenantId, contactsResponse);
      return { success: true, count: contactsResponse.Contacts.length, source: 'demo' };
    }

    // Normal Xero call
    const xeroClient = await getXeroClient(tenantId);
    const response = await xeroClient.accountingApi.getContacts(
      tenantId,
      undefined,
      'IsCustomer==true'
    );
    await processXeroContactsResponse(tenantId, response.body);
    
    return { success: true, count: response.body.contacts?.length || 0, source: 'xero' };
  } catch (error) {
    console.error('Error syncing Xero contacts:', error);
    throw error;
  }
}

// Example: Modify your payments sync
export async function syncXeroPayments(tenantId: string, fromDate?: Date) {
  try {
    const whereClause = fromDate 
      ? `Date >= DateTime(${fromDate.getFullYear()}, ${fromDate.getMonth() + 1}, ${fromDate.getDate()})`
      : undefined;

    const intercepted = DemoXeroInterceptor.interceptXeroCall(
      tenantId,
      '/api.xero.com/api.xro/2.0/Payments',
      'GET',
      { where: whereClause }
    );

    if (intercepted.shouldIntercept) {
      const paymentsResponse = intercepted.response;
      await processXeroPaymentsResponse(tenantId, paymentsResponse);
      return { success: true, count: paymentsResponse.Payments.length, source: 'demo' };
    }

    // Normal Xero call
    const xeroClient = await getXeroClient(tenantId);
    const response = await xeroClient.accountingApi.getPayments(
      tenantId,
      undefined,
      whereClause
    );
    await processXeroPaymentsResponse(tenantId, response.body);
    
    return { success: true, count: response.body.payments?.length || 0, source: 'xero' };
  } catch (error) {
    console.error('Error syncing Xero payments:', error);
    throw error;
  }
}

// ============================================================================
// STEP 3: Add API Routes for Demo Management
// ============================================================================

// In your server/routes.ts (or API route file):

import { DemoXeroInterceptor } from './services/xero/demoXeroInterceptor';
import { syncXeroInvoices, syncXeroContacts, syncXeroPayments } from './services/xero';

// List all available demo companies
app.get('/api/demo/xero-companies', (req, res) => {
  const companies = DemoXeroInterceptor.getAllCompanies();
  res.json({
    success: true,
    companies,
    total: companies.length,
  });
});

// Create a new demo company for a tenant
app.post('/api/demo/setup-xero-company', async (req, res) => {
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
    
    // Run initial sync to populate Qashivo database
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
    res.status(500).json({
      error: error.message || 'Failed to setup demo company',
    });
  }
});

// Simulate live trading activity
app.post('/api/demo/simulate-trading', async (req, res) => {
  try {
    const { tenantId, days = 7 } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    if (!DemoXeroInterceptor.isDemoTenant(tenantId)) {
      return res.status(404).json({
        error: 'Demo company not found. Create one first using /api/demo/setup-xero-company',
      });
    }

    // Simulate trading
    const result = DemoXeroInterceptor.simulateTradingActivity(tenantId, days);
    
    // Sync the new data into Qashivo
    console.log('\n🔄 Syncing simulated data...');
    await syncXeroInvoices(tenantId);
    await syncXeroPayments(tenantId);
    
    res.json({
      success: true,
      simulation: result,
    });
  } catch (error: any) {
    console.error('Error simulating trading:', error);
    res.status(500).json({
      error: error.message || 'Failed to simulate trading',
    });
  }
});

// Manually trigger sync for demo tenant
app.post('/api/demo/sync-xero-data', async (req, res) => {
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
    console.error('Error syncing demo data:', error);
    res.status(500).json({
      error: error.message || 'Failed to sync demo data',
    });
  }
});

// Create a single new invoice (webhook simulation)
app.post('/api/demo/create-invoice', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (!DemoXeroInterceptor.isDemoTenant(tenantId)) {
      return res.status(404).json({ error: 'Not a demo tenant' });
    }

    const invoice = DemoXeroInterceptor.simulateNewInvoice(tenantId);
    
    if (!invoice) {
      return res.status(500).json({ error: 'Failed to create invoice' });
    }

    // Sync to pull it into Qashivo
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

// Simulate a payment received (webhook simulation)
app.post('/api/demo/receive-payment', async (req, res) => {
  try {
    const { tenantId, invoiceId } = req.body;
    
    if (!DemoXeroInterceptor.isDemoTenant(tenantId)) {
      return res.status(404).json({ error: 'Not a demo tenant' });
    }

    const payment = DemoXeroInterceptor.simulatePaymentReceived(tenantId, invoiceId);
    
    if (!payment) {
      return res.status(404).json({ error: 'No unpaid invoices found' });
    }

    // Sync to pull it into Qashivo
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

// Clear demo company
app.delete('/api/demo/xero-company/:tenantId', (req, res) => {
  const { tenantId } = req.params;
  const cleared = DemoXeroInterceptor.clearCompany(tenantId);
  
  if (cleared) {
    res.json({ success: true, message: 'Demo company cleared' });
  } else {
    res.status(404).json({ error: 'Demo company not found' });
  }
});

// ============================================================================
// STEP 4: Usage Examples
// ============================================================================

/*

CURL EXAMPLES:

# 1. List available demo companies
curl http://localhost:5000/api/demo/xero-companies

# 2. Create a new demo SaaS company
curl -X POST http://localhost:5000/api/demo/setup-xero-company \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "my-demo-tenant-123",
    "archetype": "SaaS"
  }'

# 3. Simulate 30 days of trading
curl -X POST http://localhost:5000/api/demo/simulate-trading \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "my-demo-tenant-123",
    "days": 30
  }'

# 4. Create a single new invoice
curl -X POST http://localhost:5000/api/demo/create-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "my-demo-tenant-123"
  }'

# 5. Simulate a payment received
curl -X POST http://localhost:5000/api/demo/receive-payment \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "my-demo-tenant-123"
  }'

# 6. Manually sync data
curl -X POST http://localhost:5000/api/demo/sync-xero-data \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "my-demo-tenant-123"
  }'

# 7. Clear demo company
curl -X DELETE http://localhost:5000/api/demo/xero-company/my-demo-tenant-123

*/

// ============================================================================
// STEP 5: Frontend Integration (Optional)
// ============================================================================

/*

Example React component for demo management:

import React, { useState } from 'react';

export function DemoXeroManager() {
  const [tenantId, setTenantId] = useState('');
  const [archetype, setArchetype] = useState('SaaS');
  const [loading, setLoading] = useState(false);

  const createDemoCompany = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/demo/setup-xero-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, archetype }),
      });
      const data = await res.json();
      console.log('Demo company created:', data);
      alert(`Created ${data.company.name} with ${data.sync.invoices} invoices!`);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const simulateTrading = async (days: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/demo/simulate-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, days }),
      });
      const data = await res.json();
      alert(data.simulation.summary);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Demo Xero Company Manager</h2>
      
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Tenant ID"
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          className="border p-2 rounded"
        />
        
        <select
          value={archetype}
          onChange={e => setArchetype(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="SaaS">SaaS</option>
          <option value="Construction">Construction</option>
          <option value="Retail">Retail</option>
          <option value="Manufacturing">Manufacturing</option>
        </select>
        
        <button
          onClick={createDemoCompany}
          disabled={loading || !tenantId}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Create Demo Company
        </button>
        
        <button
          onClick={() => simulateTrading(7)}
          disabled={loading || !tenantId}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Simulate 7 Days
        </button>
        
        <button
          onClick={() => simulateTrading(30)}
          disabled={loading || !tenantId}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Simulate 30 Days
        </button>
      </div>
    </div>
  );
}

*/

// ============================================================================
// STEP 6: Automated Testing with Demo Data
// ============================================================================

/*

Use demo companies for testing:

// test/collections.test.ts
import { DemoXeroInterceptor } from '../server/services/xero/demoXeroInterceptor';
import { syncXeroInvoices } from '../server/services/xero';
import { charlieDecisionEngine } from '../server/services/charlieDecisionEngine';

describe('Collections Automation', () => {
  beforeAll(() => {
    DemoXeroInterceptor.initialize();
  });

  it('should generate correct collection actions for slow-paying construction company', async () => {
    const tenantId = DemoXeroInterceptor.createCompany('test-tenant-1', 'Construction').id;
    
    // Sync demo data
    await syncXeroInvoices(tenantId);
    
    // Run decision engine
    const decisions = await charlieDecisionEngine.generateDecisions(tenantId);
    
    // Assertions
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.some(d => d.tone === 'escalated')).toBe(true);
  });

  it('should handle reliable SaaS customer correctly', async () => {
    const tenantId = DemoXeroInterceptor.createCompany('test-tenant-2', 'SaaS').id;
    
    await syncXeroInvoices(tenantId);
    const decisions = await charlieDecisionEngine.generateDecisions(tenantId);
    
    // Reliable customers should get friendly reminders
    expect(decisions.every(d => d.tone !== 'escalated')).toBe(true);
  });
});

*/
