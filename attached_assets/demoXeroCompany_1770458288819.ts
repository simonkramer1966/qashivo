/**
 * Demo Xero Company Generator
 * 
 * Generates realistic demo Xero companies with different business archetypes,
 * payment behaviors, and trading patterns. All data matches Xero API formats exactly.
 */

import { randomUUID } from 'crypto';
import {
  XeroContact,
  XeroInvoice,
  XeroPayment,
  XeroAccount,
  XeroCreditNote,
  UK_TAX_TYPES,
  UK_ACCOUNT_CODES,
} from './xero-response-formats';

export interface DemoXeroCompany {
  id: string;
  name: string;
  archetype: BusinessArchetype;
  contacts: XeroContact[];
  invoices: XeroInvoice[];
  payments: XeroPayment[];
  creditNotes: XeroCreditNote[];
  accounts: XeroAccount[];
  metadata: {
    createdAt: Date;
    lastSyncAt: Date;
    totalRevenue: number;
    outstandingAmount: number;
  };
}

export type BusinessArchetype = 'SaaS' | 'Construction' | 'Retail' | 'Manufacturing' | 'Professional Services' | 'Wholesale';

interface ArchetypeConfig {
  name: string;
  invoicePattern: 'monthly-recurring' | 'project-milestone' | 'weekly-orders' | 'batch-orders' | 'adhoc';
  avgInvoiceValue: number;
  paymentBehavior: 'reliable' | 'slow' | 'mixed' | 'struggling';
  invoiceCount: number;
  paymentTermsDays: number;
  creditNoteFrequency: number; // 0-100, percentage chance per invoice
  description: string;
}

export class DemoXeroCompanyGenerator {
  static readonly ARCHETYPES: Record<BusinessArchetype, ArchetypeConfig> = {
    'SaaS': {
      name: 'CloudFlow SaaS Ltd',
      invoicePattern: 'monthly-recurring',
      avgInvoiceValue: 2500,
      paymentBehavior: 'reliable',
      invoiceCount: 36, // 3 years of monthly recurring
      paymentTermsDays: 30,
      creditNoteFrequency: 2,
      description: 'SaaS company with monthly recurring revenue, reliable customers',
    },
    'Construction': {
      name: 'BuildRight Construction Ltd',
      invoicePattern: 'project-milestone',
      avgInvoiceValue: 45000,
      paymentBehavior: 'slow',
      invoiceCount: 12, // Quarterly milestones over 3 years
      paymentTermsDays: 60,
      creditNoteFrequency: 5,
      description: 'Construction firm with large milestone payments, slow payment cycles',
    },
    'Retail': {
      name: 'HighStreet Fashion Ltd',
      invoicePattern: 'weekly-orders',
      avgInvoiceValue: 8500,
      paymentBehavior: 'mixed',
      invoiceCount: 52, // 1 year of weekly orders
      paymentTermsDays: 30,
      creditNoteFrequency: 8,
      description: 'Wholesale fashion retailer with weekly orders, mixed payment behavior',
    },
    'Manufacturing': {
      name: 'PrecisionTech Manufacturing Ltd',
      invoicePattern: 'batch-orders',
      avgInvoiceValue: 18000,
      paymentBehavior: 'reliable',
      invoiceCount: 24, // Bi-weekly over 1 year
      paymentTermsDays: 45,
      creditNoteFrequency: 3,
      description: 'Manufacturing company with batch orders, reliable B2B customers',
    },
    'Professional Services': {
      name: 'Excellence Consulting Group',
      invoicePattern: 'adhoc',
      avgInvoiceValue: 12000,
      paymentBehavior: 'mixed',
      invoiceCount: 28, // Various projects
      paymentTermsDays: 30,
      creditNoteFrequency: 4,
      description: 'Consulting firm with project-based billing',
    },
    'Wholesale': {
      name: 'Premier Distributors Ltd',
      invoicePattern: 'weekly-orders',
      avgInvoiceValue: 15000,
      paymentBehavior: 'struggling',
      invoiceCount: 48,
      paymentTermsDays: 30,
      creditNoteFrequency: 10,
      description: 'Wholesale distributor with cash flow challenges',
    },
  };

  /**
   * Generate a complete demo Xero company
   */
  static generate(archetype: BusinessArchetype, options?: {
    startDate?: Date;
    contactCount?: number;
    includeHistoricalData?: boolean;
  }): DemoXeroCompany {
    const config = this.ARCHETYPES[archetype];
    const companyId = `demo-${archetype.toLowerCase().replace(/\s+/g, '-')}-${randomUUID().slice(0, 8)}`;
    const startDate = options?.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    
    console.log(`📊 Generating demo Xero company: ${config.name} (${archetype})`);
    
    // Generate realistic customer contacts
    const contactCount = options?.contactCount || this.getContactCount(config.invoiceCount);
    const contacts = this.generateContacts(config.name, contactCount);
    console.log(`  ✓ Generated ${contacts.length} contacts`);
    
    // Generate invoices based on archetype pattern
    const invoices = this.generateInvoices(config, contacts, startDate);
    console.log(`  ✓ Generated ${invoices.length} invoices`);
    
    // Generate payments based on behavior profile
    const payments = this.generatePayments(invoices, config.paymentBehavior);
    console.log(`  ✓ Generated ${payments.length} payments`);
    
    // Generate credit notes (returns, discounts, errors)
    const creditNotes = this.generateCreditNotes(invoices, config.creditNoteFrequency);
    console.log(`  ✓ Generated ${creditNotes.length} credit notes`);
    
    // Generate chart of accounts
    const accounts = this.generateAccounts();
    console.log(`  ✓ Generated ${accounts.length} accounts`);
    
    // Calculate metadata
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.Total, 0);
    const outstandingAmount = invoices.reduce((sum, inv) => sum + inv.AmountDue, 0);

    return {
      id: companyId,
      name: config.name,
      archetype,
      contacts,
      invoices,
      payments,
      creditNotes,
      accounts,
      metadata: {
        createdAt: new Date(),
        lastSyncAt: new Date(),
        totalRevenue,
        outstandingAmount,
      },
    };
  }

  /**
   * Generate realistic business contacts
   */
  private static generateContacts(companyName: string, count: number): XeroContact[] {
    const ukCompanyNames = [
      { name: 'Acme Corporation Ltd', domain: 'acme.co.uk', phone: '020 7123 4567' },
      { name: 'Global Industries UK', domain: 'global-industries.com', phone: '020 7234 5678' },
      { name: 'TechStart Solutions Ltd', domain: 'techstart.io', phone: '020 7345 6789' },
      { name: 'Premium Business Services', domain: 'premiumservices.co.uk', phone: '020 7456 7890' },
      { name: 'FastGrowth Enterprises', domain: 'fastgrowth.com', phone: '020 7567 8901' },
      { name: 'Enterprise Solutions Group', domain: 'enterprisesolutions.co.uk', phone: '020 7678 9012' },
      { name: 'Innovation Hub Ltd', domain: 'innovationhub.com', phone: '020 7789 0123' },
      { name: 'Quality Products UK', domain: 'qualityproducts.co.uk', phone: '020 7890 1234' },
      { name: 'NextGen Technology', domain: 'nextgentech.com', phone: '020 7901 2345' },
      { name: 'Premier Distribution Ltd', domain: 'premier-dist.co.uk', phone: '020 8012 3456' },
      { name: 'Elite Manufacturing', domain: 'elite-mfg.com', phone: '020 8123 4567' },
      { name: 'Strategic Partners Group', domain: 'strategic-partners.co.uk', phone: '020 8234 5678' },
      { name: 'Quantum Retail Ltd', domain: 'quantumretail.com', phone: '020 8345 6789' },
      { name: 'Pinnacle Services UK', domain: 'pinnacle.co.uk', phone: '020 8456 7890' },
      { name: 'Dynamic Solutions Ltd', domain: 'dynamicsolutions.com', phone: '020 8567 8901' },
    ];

    const ukCities = [
      { city: 'London', postcodePrefix: 'SW' },
      { city: 'Manchester', postcodePrefix: 'M' },
      { city: 'Birmingham', postcodePrefix: 'B' },
      { city: 'Leeds', postcodePrefix: 'LS' },
      { city: 'Glasgow', postcodePrefix: 'G' },
      { city: 'Bristol', postcodePrefix: 'BS' },
      { city: 'Edinburgh', postcodePrefix: 'EH' },
      { city: 'Liverpool', postcodePrefix: 'L' },
    ];

    return ukCompanyNames.slice(0, count).map((company, i) => {
      const location = ukCities[i % ukCities.length];
      const contactNumber = `CUST${String(i + 1).padStart(4, '0')}`;
      
      return {
        ContactID: randomUUID(),
        ContactNumber: contactNumber,
        ContactStatus: 'ACTIVE' as const,
        Name: company.name,
        FirstName: this.getRandomFirstName(),
        LastName: 'Finance Team',
        EmailAddress: `accounts@${company.domain}`,
        Addresses: [
          {
            AddressType: 'STREET' as const,
            AddressLine1: `${(i + 1) * 10} Business Park`,
            AddressLine2: 'High Street',
            City: location.city,
            PostalCode: `${location.postcodePrefix}${i + 1} ${Math.floor(Math.random() * 9)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
            Country: 'United Kingdom',
          },
          {
            AddressType: 'POBOX' as const,
            AddressLine1: `PO Box ${1000 + i}`,
            City: location.city,
            PostalCode: `${location.postcodePrefix}${i + 1} 9ZZ`,
            Country: 'United Kingdom',
          },
        ],
        Phones: [
          {
            PhoneType: 'DEFAULT' as const,
            PhoneNumber: company.phone,
          },
          {
            PhoneType: 'MOBILE' as const,
            PhoneNumber: `07${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 900000 + 100000)}`,
          },
        ],
        UpdatedDateUTC: this.xeroDate(new Date()),
        IsSupplier: false,
        IsCustomer: true,
        DefaultCurrency: 'GBP',
        ContactPersons: [
          {
            FirstName: this.getRandomFirstName(),
            LastName: this.getRandomLastName(),
            EmailAddress: `${this.getRandomFirstName().toLowerCase()}@${company.domain}`,
            IncludeInEmails: true,
          },
        ],
        Balances: {
          AccountsReceivable: {
            Outstanding: 0, // Will be calculated from invoices
            Overdue: 0,
          },
        },
      };
    });
  }

  /**
   * Generate invoices based on business archetype
   */
  private static generateInvoices(
    config: ArchetypeConfig,
    contacts: XeroContact[],
    startDate: Date
  ): XeroInvoice[] {
    const invoices: XeroInvoice[] = [];
    const now = new Date();
    const daysRange = Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    
    for (let i = 0; i < config.invoiceCount; i++) {
      // Distribute invoices over the time period
      const daysAgo = Math.floor((i / config.invoiceCount) * daysRange);
      const invoiceDate = new Date(now);
      invoiceDate.setDate(invoiceDate.getDate() - daysAgo);
      
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + config.paymentTermsDays);
      
      const contact = contacts[i % contacts.length];
      const amount = this.calculateAmount(config.avgInvoiceValue, config.invoicePattern);
      const taxRate = 0.20; // UK VAT
      const taxAmount = Math.round(amount * taxRate * 100) / 100;
      const total = amount + taxAmount;
      
      // Determine payment status based on date and behavior
      const isPaid = this.shouldBePaid(invoiceDate, dueDate, now, config.paymentBehavior);
      const paymentDate = isPaid ? this.calculatePaymentDate(dueDate, config.paymentBehavior) : null;
      
      invoices.push({
        Type: 'ACCREC',
        InvoiceID: randomUUID(),
        InvoiceNumber: `INV-${String(1000 + i).padStart(5, '0')}`,
        Reference: `${contact.ContactNumber}-${new Date(invoiceDate).toISOString().slice(0, 7)}`,
        Contact: {
          ContactID: contact.ContactID,
          ContactNumber: contact.ContactNumber,
          Name: contact.Name,
          EmailAddress: contact.EmailAddress,
        },
        DateString: invoiceDate.toISOString(),
        DueDateString: dueDate.toISOString(),
        Status: isPaid ? 'PAID' : (dueDate < now ? 'AUTHORISED' : 'AUTHORISED'),
        LineAmountTypes: 'Exclusive',
        LineItems: this.generateLineItems(config, amount),
        SubTotal: amount,
        TotalTax: taxAmount,
        Total: total,
        AmountDue: isPaid ? 0 : total,
        AmountPaid: isPaid ? total : 0,
        AmountCredited: 0,
        CurrencyCode: 'GBP',
        FullyPaidOnDate: paymentDate ? paymentDate.toISOString() : null,
        Payments: [],
        HasAttachments: false,
        UpdatedDateUTC: this.xeroDate(new Date(Math.max(invoiceDate.getTime(), paymentDate?.getTime() || 0))),
        SentToContact: true,
      });
    }
    
    return invoices;
  }

  /**
   * Generate line items for an invoice
   */
  private static generateLineItems(config: ArchetypeConfig, totalAmount: number): any[] {
    const descriptions: Record<string, string[]> = {
      'monthly-recurring': [
        'Monthly SaaS Subscription - Professional Plan',
        'Platform License Fee',
        'User Seats (x10)',
        'API Usage & Storage',
      ],
      'project-milestone': [
        'Project Milestone Payment - Phase',
        'Design & Planning Services',
        'Construction Materials & Labor',
        'Project Management Fee',
      ],
      'weekly-orders': [
        'Wholesale Order - Spring Collection',
        'Product Inventory Restock',
        'Seasonal Merchandise',
        'Bulk Order Fulfillment',
      ],
      'batch-orders': [
        'Batch Manufacturing Order #',
        'Custom Component Production',
        'Quality Assurance & Testing',
        'Delivery & Installation',
      ],
      'adhoc': [
        'Professional Consulting Services',
        'Strategic Advisory - Project',
        'Implementation & Training',
        'Support & Maintenance',
      ],
    };

    const items = descriptions[config.invoicePattern] || descriptions['adhoc'];
    const description = items[Math.floor(Math.random() * items.length)];
    
    return [{
      Description: description,
      Quantity: 1.0,
      UnitAmount: totalAmount,
      AccountCode: UK_ACCOUNT_CODES.SALES,
      TaxType: 'OUTPUT2',
      TaxAmount: Math.round(totalAmount * 0.20 * 100) / 100,
      LineAmount: totalAmount,
    }];
  }

  /**
   * Generate payments for paid invoices
   */
  private static generatePayments(
    invoices: XeroInvoice[],
    behavior: string
  ): XeroPayment[] {
    return invoices
      .filter(inv => inv.Status === 'PAID' && inv.FullyPaidOnDate)
      .map(inv => ({
        PaymentID: randomUUID(),
        Date: inv.FullyPaidOnDate!,
        Amount: inv.AmountPaid,
        CurrencyRate: 1.0,
        PaymentType: 'ACCRECPAYMENT' as const,
        Status: 'AUTHORISED' as const,
        Reference: `Payment for ${inv.InvoiceNumber}`,
        IsReconciled: true,
        Invoice: {
          InvoiceID: inv.InvoiceID,
          InvoiceNumber: inv.InvoiceNumber,
        },
        Account: {
          AccountID: randomUUID(),
          Code: UK_ACCOUNT_CODES.BANK,
        },
        UpdatedDateUTC: inv.FullyPaidOnDate!,
      }));
  }

  /**
   * Generate credit notes (returns, discounts, corrections)
   */
  private static generateCreditNotes(
    invoices: XeroInvoice[],
    frequency: number
  ): XeroCreditNote[] {
    const creditNotes: XeroCreditNote[] = [];
    
    invoices.forEach((invoice, i) => {
      // Random chance to generate credit note
      if (Math.random() * 100 < frequency && invoice.Status === 'PAID') {
        const creditAmount = Math.round(invoice.Total * (0.1 + Math.random() * 0.3) * 100) / 100;
        const taxAmount = Math.round(creditAmount * 0.1667 * 100) / 100; // Reverse calculate VAT
        const subTotal = creditAmount - taxAmount;
        
        creditNotes.push({
          CreditNoteID: randomUUID(),
          CreditNoteNumber: `CN-${String(100 + creditNotes.length).padStart(4, '0')}`,
          Type: 'ACCRECCEDIT',
          Reference: `Credit for ${invoice.InvoiceNumber}`,
          Contact: invoice.Contact,
          Date: new Date(new Date(invoice.DateString).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          Status: 'AUTHORISED',
          LineAmountTypes: 'Exclusive',
          LineItems: [{
            Description: 'Credit Note - Refund/Adjustment',
            Quantity: 1.0,
            UnitAmount: subTotal,
            AccountCode: UK_ACCOUNT_CODES.SALES,
            TaxType: 'OUTPUT2',
            TaxAmount: taxAmount,
            LineAmount: subTotal,
          }],
          SubTotal: subTotal,
          TotalTax: taxAmount,
          Total: creditAmount,
          UpdatedDateUTC: this.xeroDate(new Date()),
          CurrencyCode: 'GBP',
          RemainingCredit: creditAmount,
          Allocations: [],
          HasAttachments: false,
        });
      }
    });
    
    return creditNotes;
  }

  /**
   * Generate chart of accounts
   */
  private static generateAccounts(): XeroAccount[] {
    return [
      {
        AccountID: randomUUID(),
        Code: UK_ACCOUNT_CODES.BANK,
        Name: 'Business Bank Account',
        Type: 'BANK',
        Status: 'ACTIVE',
        Class: 'ASSET',
        EnablePaymentsToAccount: true,
        BankAccountType: 'BANK',
        CurrencyCode: 'GBP',
      },
      {
        AccountID: randomUUID(),
        Code: UK_ACCOUNT_CODES.SALES,
        Name: 'Sales Revenue',
        Type: 'REVENUE',
        Status: 'ACTIVE',
        Class: 'REVENUE',
        EnablePaymentsToAccount: false,
        TaxType: 'OUTPUT2',
      },
      {
        AccountID: randomUUID(),
        Code: UK_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        Name: 'Accounts Receivable',
        Type: 'CURRENT',
        Status: 'ACTIVE',
        Class: 'ASSET',
        SystemAccount: 'DEBTORS',
      },
      {
        AccountID: randomUUID(),
        Code: UK_ACCOUNT_CODES.COST_OF_SALES,
        Name: 'Cost of Sales',
        Type: 'DIRECTCOSTS',
        Status: 'ACTIVE',
        Class: 'EXPENSE',
      },
    ];
  }

  // Helper methods
  private static calculateAmount(avg: number, pattern: string): number {
    // Add variation based on pattern
    const variation = pattern === 'monthly-recurring' ? 0.1 : 0.4;
    return Math.round(avg * (1 - variation + Math.random() * variation * 2) * 100) / 100;
  }

  private static shouldBePaid(
    invoiceDate: Date,
    dueDate: Date,
    now: Date,
    behavior: string
  ): boolean {
    const ageInDays = (now.getTime() - invoiceDate.getTime()) / (24 * 60 * 60 * 1000);
    const daysOverdue = (now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000);
    
    const probabilities: Record<string, (age: number, overdue: number) => number> = {
      reliable: (age, overdue) => {
        if (age < 20) return 0.3;
        if (age < 40) return 0.85;
        return 0.95;
      },
      mixed: (age, overdue) => {
        if (overdue < -10) return 0.2; // Not yet due
        if (overdue < 10) return 0.5;
        if (overdue < 30) return 0.7;
        return 0.8;
      },
      slow: (age, overdue) => {
        if (overdue < 0) return 0.1;
        if (overdue < 30) return 0.3;
        if (overdue < 60) return 0.5;
        return 0.7;
      },
      struggling: (age, overdue) => {
        if (overdue < 0) return 0.1;
        if (overdue < 45) return 0.2;
        if (overdue < 90) return 0.4;
        return 0.5;
      },
    };
    
    const probability = (probabilities[behavior] || probabilities.mixed)(ageInDays, daysOverdue);
    return Math.random() < probability;
  }

  private static calculatePaymentDate(dueDate: Date, behavior: string): Date {
    const delays: Record<string, number> = {
      reliable: -3, // Pays 3 days early
      mixed: 5,
      slow: 25,
      struggling: 45,
    };
    
    const delay = delays[behavior] || 0;
    const variation = Math.floor(Math.random() * 10) - 5;
    const paymentDate = new Date(dueDate);
    paymentDate.setDate(paymentDate.getDate() + delay + variation);
    
    return paymentDate;
  }

  private static getContactCount(invoiceCount: number): number {
    // More invoices = more diverse customer base
    if (invoiceCount > 40) return 12;
    if (invoiceCount > 20) return 8;
    return 5;
  }

  private static xeroDate(date: Date): string {
    return `/Date(${date.getTime()})/`;
  }

  private static getRandomFirstName(): string {
    const names = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Sophie', 'Robert', 'Emily', 'John', 'Olivia', 'Thomas', 'Charlotte'];
    return names[Math.floor(Math.random() * names.length)];
  }

  private static getRandomLastName(): string {
    const names = ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Thomas', 'Johnson'];
    return names[Math.floor(Math.random() * names.length)];
  }
}
