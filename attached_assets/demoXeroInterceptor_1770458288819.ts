/**
 * Demo Xero Interceptor
 * 
 * Intercepts Xero API calls for demo tenants and returns realistic mock data.
 * Simulates live trading activity with webhooks and data updates.
 */

import { DemoXeroCompanyGenerator, DemoXeroCompany, BusinessArchetype } from './demoXeroCompany';
import {
  XeroInvoice,
  XeroContact,
  XeroPayment,
  XeroAccount,
  XeroInvoicesResponse,
  XeroContactsResponse,
  XeroPaymentsResponse,
  XeroAccountsResponse,
  XeroWebhookEvent,
  XeroWebhookResourceType,
} from './xero-response-formats';
import { randomUUID } from 'crypto';

export class DemoXeroInterceptor {
  private static companies = new Map<string, DemoXeroCompany>();
  private static initialized = false;

  /**
   * Initialize demo companies - call once at server startup
   */
  static initialize(archetypes?: BusinessArchetype[]): void {
    if (this.initialized) {
      console.log('⚠️  Demo Xero companies already initialized');
      return;
    }

    console.log('🚀 Initializing Demo Xero companies...');
    
    const typesToGenerate: BusinessArchetype[] = archetypes || [
      'SaaS',
      'Construction',
      'Retail',
      'Manufacturing',
    ];

    typesToGenerate.forEach(archetype => {
      const company = DemoXeroCompanyGenerator.generate(archetype);
      this.companies.set(company.id, company);
      console.log(`  ✅ ${company.name} (${company.id})`);
      console.log(`     📊 ${company.invoices.length} invoices, ${company.contacts.length} contacts, ${company.payments.length} payments`);
    });

    this.initialized = true;
    console.log(`✅ Demo Xero initialization complete - ${this.companies.size} companies ready\n`);
  }

  /**
   * Get all demo companies (for listing)
   */
  static getAllCompanies(): Array<{
    id: string;
    name: string;
    archetype: BusinessArchetype;
    stats: {
      invoices: number;
      contacts: number;
      payments: number;
      totalRevenue: number;
      outstandingAmount: number;
    };
  }> {
    return Array.from(this.companies.values()).map(company => ({
      id: company.id,
      name: company.name,
      archetype: company.archetype,
      stats: {
        invoices: company.invoices.length,
        contacts: company.contacts.length,
        payments: company.payments.length,
        totalRevenue: company.metadata.totalRevenue,
        outstandingAmount: company.metadata.outstandingAmount,
      },
    }));
  }

  /**
   * Get a specific demo company
   */
  static getCompany(tenantId: string): DemoXeroCompany | null {
    return this.companies.get(tenantId) || null;
  }

  /**
   * Create a new demo company on-demand
   */
  static createCompany(
    tenantId: string,
    archetype: BusinessArchetype,
    options?: {
      startDate?: Date;
      contactCount?: number;
    }
  ): DemoXeroCompany {
    if (this.companies.has(tenantId)) {
      throw new Error(`Demo company already exists for tenant: ${tenantId}`);
    }

    console.log(`📊 Creating new demo company for tenant ${tenantId}...`);
    const company = DemoXeroCompanyGenerator.generate(archetype, options);
    
    // Use the provided tenantId instead of generated one
    company.id = tenantId;
    
    this.companies.set(tenantId, company);
    console.log(`  ✅ Created ${company.name}`);
    
    return company;
  }

  /**
   * Check if this is a demo tenant and should intercept Xero calls
   */
  static isDemoTenant(tenantId: string): boolean {
    return this.companies.has(tenantId);
  }

  /**
   * Intercept Xero API call and return mock response
   */
  static interceptXeroCall(
    tenantId: string,
    endpoint: string,
    method: string = 'GET',
    params?: any
  ): { shouldIntercept: boolean; response?: any } {
    const company = this.companies.get(tenantId);
    
    if (!company) {
      return { shouldIntercept: false };
    }

    console.log(`🔄 Intercepting Xero API call: ${method} ${endpoint} (tenant: ${tenantId})`);

    // Update last sync time
    company.metadata.lastSyncAt = new Date();

    // Parse endpoint and return appropriate data
    if (endpoint.includes('/Invoices')) {
      return {
        shouldIntercept: true,
        response: this.buildInvoicesResponse(company, params),
      };
    }

    if (endpoint.includes('/Contacts')) {
      return {
        shouldIntercept: true,
        response: this.buildContactsResponse(company, params),
      };
    }

    if (endpoint.includes('/Payments')) {
      return {
        shouldIntercept: true,
        response: this.buildPaymentsResponse(company, params),
      };
    }

    if (endpoint.includes('/Accounts')) {
      return {
        shouldIntercept: true,
        response: this.buildAccountsResponse(company),
      };
    }

    if (endpoint.includes('/CreditNotes')) {
      return {
        shouldIntercept: true,
        response: {
          Id: randomUUID(),
          Status: 'OK',
          ProviderName: 'Demo Xero',
          DateTimeUTC: new Date().toISOString(),
          CreditNotes: company.creditNotes,
        },
      };
    }

    console.log(`⚠️  Unhandled Xero endpoint: ${endpoint}`);
    return { shouldIntercept: false };
  }

  /**
   * Build Xero-formatted invoices response
   */
  private static buildInvoicesResponse(
    company: DemoXeroCompany,
    params?: any
  ): XeroInvoicesResponse {
    let invoices = [...company.invoices];

    // Apply filters if provided
    if (params?.where) {
      const where = params.where.toLowerCase();
      
      if (where.includes('status')) {
        const statusMatch = where.match(/status\s*==\s*"([^"]+)"/i);
        if (statusMatch) {
          const status = statusMatch[1];
          invoices = invoices.filter(inv => inv.Status === status);
        }
      }

      if (where.includes('invoicenumber')) {
        const numberMatch = where.match(/invoicenumber\s*==\s*"([^"]+)"/i);
        if (numberMatch) {
          const number = numberMatch[1];
          invoices = invoices.filter(inv => inv.InvoiceNumber === number);
        }
      }

      if (where.includes('date')) {
        // Handle date range filters
        const dateMatch = where.match(/date\s*>=\s*datetime\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/i);
        if (dateMatch) {
          const filterDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
          invoices = invoices.filter(inv => new Date(inv.DateString) >= filterDate);
        }
      }
    }

    // Apply ordering
    if (params?.order) {
      const order = params.order.toLowerCase();
      if (order.includes('date')) {
        invoices.sort((a, b) => {
          const dateA = new Date(a.DateString).getTime();
          const dateB = new Date(b.DateString).getTime();
          return order.includes('desc') ? dateB - dateA : dateA - dateB;
        });
      }
    }

    return {
      Id: randomUUID(),
      Status: 'OK',
      ProviderName: 'Demo Xero',
      DateTimeUTC: new Date().toISOString(),
      Invoices: invoices,
    };
  }

  /**
   * Build Xero-formatted contacts response
   */
  private static buildContactsResponse(
    company: DemoXeroCompany,
    params?: any
  ): XeroContactsResponse {
    let contacts = [...company.contacts];

    // Apply filters
    if (params?.where) {
      const where = params.where.toLowerCase();
      
      if (where.includes('contactid')) {
        const idMatch = where.match(/contactid\s*==\s*guid\("([^"]+)"\)/i);
        if (idMatch) {
          const contactId = idMatch[1];
          contacts = contacts.filter(c => c.ContactID === contactId);
        }
      }

      if (where.includes('iscustomer')) {
        contacts = contacts.filter(c => c.IsCustomer);
      }
    }

    // Calculate outstanding balances from invoices
    contacts.forEach(contact => {
      const contactInvoices = company.invoices.filter(
        inv => inv.Contact.ContactID === contact.ContactID
      );
      
      const outstanding = contactInvoices.reduce((sum, inv) => sum + inv.AmountDue, 0);
      const overdue = contactInvoices
        .filter(inv => new Date(inv.DueDateString) < new Date() && inv.AmountDue > 0)
        .reduce((sum, inv) => sum + inv.AmountDue, 0);
      
      contact.Balances = {
        AccountsReceivable: {
          Outstanding: Math.round(outstanding * 100) / 100,
          Overdue: Math.round(overdue * 100) / 100,
        },
      };
    });

    return {
      Id: randomUUID(),
      Status: 'OK',
      ProviderName: 'Demo Xero',
      DateTimeUTC: new Date().toISOString(),
      Contacts: contacts,
    };
  }

  /**
   * Build Xero-formatted payments response
   */
  private static buildPaymentsResponse(
    company: DemoXeroCompany,
    params?: any
  ): XeroPaymentsResponse {
    let payments = [...company.payments];

    // Apply filters
    if (params?.where) {
      const where = params.where.toLowerCase();
      
      if (where.includes('date')) {
        const dateMatch = where.match(/date\s*>=\s*datetime\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/i);
        if (dateMatch) {
          const filterDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
          payments = payments.filter(p => new Date(p.Date) >= filterDate);
        }
      }
    }

    return {
      Id: randomUUID(),
      Status: 'OK',
      ProviderName: 'Demo Xero',
      DateTimeUTC: new Date().toISOString(),
      Payments: payments,
    };
  }

  /**
   * Build Xero-formatted accounts response
   */
  private static buildAccountsResponse(company: DemoXeroCompany): XeroAccountsResponse {
    return {
      Id: randomUUID(),
      Status: 'OK',
      ProviderName: 'Demo Xero',
      DateTimeUTC: new Date().toISOString(),
      Accounts: company.accounts,
    };
  }

  /**
   * Simulate a new invoice being created (webhook simulation)
   */
  static simulateNewInvoice(tenantId: string): XeroInvoice | null {
    const company = this.companies.get(tenantId);
    if (!company) return null;

    console.log(`📨 Simulating new invoice for ${company.name}...`);

    // Pick a random contact
    const contact = company.contacts[Math.floor(Math.random() * company.contacts.length)];
    
    // Generate invoice based on archetype
    const config = DemoXeroCompanyGenerator['ARCHETYPES'][company.archetype];
    const amount = Math.round(config.avgInvoiceValue * (0.8 + Math.random() * 0.4) * 100) / 100;
    const taxAmount = Math.round(amount * 0.20 * 100) / 100;
    const total = amount + taxAmount;
    
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + config.paymentTermsDays);
    
    const newInvoice: XeroInvoice = {
      Type: 'ACCREC',
      InvoiceID: randomUUID(),
      InvoiceNumber: `INV-${String(1000 + company.invoices.length + 1).padStart(5, '0')}`,
      Reference: `${contact.ContactNumber}-${now.toISOString().slice(0, 7)}`,
      Contact: {
        ContactID: contact.ContactID,
        ContactNumber: contact.ContactNumber,
        Name: contact.Name,
        EmailAddress: contact.EmailAddress,
      },
      DateString: now.toISOString(),
      DueDateString: dueDate.toISOString(),
      Status: 'AUTHORISED',
      LineAmountTypes: 'Exclusive',
      LineItems: [{
        Description: `New Order - ${now.toLocaleDateString('en-GB')}`,
        Quantity: 1.0,
        UnitAmount: amount,
        AccountCode: '200',
        TaxType: 'OUTPUT2',
        TaxAmount: taxAmount,
        LineAmount: amount,
      }],
      SubTotal: amount,
      TotalTax: taxAmount,
      Total: total,
      AmountDue: total,
      AmountPaid: 0,
      AmountCredited: 0,
      CurrencyCode: 'GBP',
      FullyPaidOnDate: null,
      Payments: [],
      HasAttachments: false,
      UpdatedDateUTC: `/Date(${now.getTime()})/`,
      SentToContact: true,
    };

    company.invoices.push(newInvoice);
    company.metadata.totalRevenue += total;
    company.metadata.outstandingAmount += total;
    
    console.log(`  ✅ Created invoice ${newInvoice.InvoiceNumber} for £${total.toFixed(2)}`);
    
    return newInvoice;
  }

  /**
   * Simulate a payment being received (webhook simulation)
   */
  static simulatePaymentReceived(tenantId: string, invoiceId?: string): XeroPayment | null {
    const company = this.companies.get(tenantId);
    if (!company) return null;

    // Find an unpaid invoice
    let invoice: XeroInvoice | undefined;
    
    if (invoiceId) {
      invoice = company.invoices.find(inv => inv.InvoiceID === invoiceId && inv.AmountDue > 0);
    } else {
      // Pick random unpaid invoice
      const unpaidInvoices = company.invoices.filter(inv => inv.AmountDue > 0);
      if (unpaidInvoices.length === 0) {
        console.log('⚠️  No unpaid invoices to simulate payment for');
        return null;
      }
      invoice = unpaidInvoices[Math.floor(Math.random() * unpaidInvoices.length)];
    }

    if (!invoice) {
      console.log('⚠️  Invoice not found or already paid');
      return null;
    }

    console.log(`💰 Simulating payment for ${invoice.InvoiceNumber}...`);

    const paymentDate = new Date();
    const payment: XeroPayment = {
      PaymentID: randomUUID(),
      Date: paymentDate.toISOString(),
      Amount: invoice.AmountDue,
      CurrencyRate: 1.0,
      PaymentType: 'ACCRECPAYMENT',
      Status: 'AUTHORISED',
      Reference: `Payment for ${invoice.InvoiceNumber}`,
      IsReconciled: true,
      Invoice: {
        InvoiceID: invoice.InvoiceID,
        InvoiceNumber: invoice.InvoiceNumber,
      },
      Account: {
        AccountID: company.accounts[0].AccountID,
        Code: company.accounts[0].Code,
      },
      UpdatedDateUTC: `/Date(${paymentDate.getTime()})/`,
    };

    // Update invoice
    invoice.Status = 'PAID';
    invoice.AmountPaid = invoice.Total;
    invoice.AmountDue = 0;
    invoice.FullyPaidOnDate = paymentDate.toISOString();
    invoice.Payments = [payment];

    // Add payment to company
    company.payments.push(payment);
    company.metadata.outstandingAmount -= payment.Amount;

    console.log(`  ✅ Payment received: £${payment.Amount.toFixed(2)}`);

    return payment;
  }

  /**
   * Simulate multiple days of trading activity
   */
  static simulateTradingActivity(
    tenantId: string,
    days: number = 7
  ): {
    invoicesCreated: number;
    paymentsReceived: number;
    summary: string;
  } {
    const company = this.companies.get(tenantId);
    if (!company) {
      throw new Error(`Demo company not found: ${tenantId}`);
    }

    console.log(`\n🎬 Simulating ${days} days of trading for ${company.name}...`);

    let invoicesCreated = 0;
    let paymentsReceived = 0;

    const config = DemoXeroCompanyGenerator['ARCHETYPES'][company.archetype];
    
    for (let day = 0; day < days; day++) {
      console.log(`\n📅 Day ${day + 1}/${days}`);
      
      // New invoices based on archetype pattern
      const shouldCreateInvoice = this.shouldCreateInvoiceToday(config.invoicePattern, day);
      
      if (shouldCreateInvoice) {
        this.simulateNewInvoice(tenantId);
        invoicesCreated++;
      }

      // Payment probability based on behavior
      const paymentProbability = this.getPaymentProbability(config.paymentBehavior);
      
      if (Math.random() < paymentProbability) {
        const payment = this.simulatePaymentReceived(tenantId);
        if (payment) paymentsReceived++;
      }

      // Occasionally simulate multiple events in a day
      if (config.invoicePattern === 'weekly-orders' && Math.random() < 0.3) {
        this.simulateNewInvoice(tenantId);
        invoicesCreated++;
      }
    }

    const summary = `
📊 Trading Simulation Complete for ${company.name}
   Duration: ${days} days
   📨 Invoices Created: ${invoicesCreated}
   💰 Payments Received: ${paymentsReceived}
   📈 Total Revenue: £${company.metadata.totalRevenue.toFixed(2)}
   ⚠️  Outstanding: £${company.metadata.outstandingAmount.toFixed(2)}
    `;

    console.log(summary);

    return {
      invoicesCreated,
      paymentsReceived,
      summary,
    };
  }

  /**
   * Clear all demo data for a tenant
   */
  static clearCompany(tenantId: string): boolean {
    if (this.companies.has(tenantId)) {
      this.companies.delete(tenantId);
      console.log(`🗑️  Cleared demo company: ${tenantId}`);
      return true;
    }
    return false;
  }

  /**
   * Reset all demo companies
   */
  static resetAll(): void {
    this.companies.clear();
    this.initialized = false;
    console.log('🔄 All demo companies cleared');
  }

  // Helper methods
  private static shouldCreateInvoiceToday(pattern: string, day: number): boolean {
    switch (pattern) {
      case 'monthly-recurring':
        return day % 30 === 0;
      case 'weekly-orders':
        return day % 7 === 0;
      case 'batch-orders':
        return day % 14 === 0;
      case 'project-milestone':
        return day % 90 === 0;
      case 'adhoc':
        return Math.random() < 0.2; // 20% chance per day
      default:
        return Math.random() < 0.15;
    }
  }

  private static getPaymentProbability(behavior: string): number {
    const probabilities: Record<string, number> = {
      reliable: 0.3,
      mixed: 0.15,
      slow: 0.08,
      struggling: 0.05,
    };
    return probabilities[behavior] || 0.15;
  }
}
