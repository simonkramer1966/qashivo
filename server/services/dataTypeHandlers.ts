import { db } from "../db";
import { 
  contacts, 
  invoices, 
  bills, 
  billPayments, 
  bankAccounts, 
  bankTransactions, 
  budgets, 
  budgetLines,
  exchangeRates
} from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import { signalCollector } from "../lib/signal-collector";
import { timerService } from "../lib/timer-service";

/**
 * Data Type Handlers for Sync Operations
 * Each handler knows how to transform and upsert data for specific resource types
 */

export interface SyncResult {
  created: number;
  updated: number;
  failed: number;
}

export interface DataTypeHandler {
  transform(providerData: any, provider: string, tenantId: string): Promise<any>;
  upsert(transformedData: any, provider: string): Promise<boolean>; // Returns true if created, false if updated
}

/**
 * Contacts/Customers Handler
 */
export class ContactsHandler implements DataTypeHandler {
  async transform(providerData: any, provider: string, tenantId: string): Promise<any> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = this.getProviderId(providerData, provider);

    if (!providerId) {
      throw new Error(`No ID found for ${provider} contact`);
    }

    // Base contact data
    const contactData = {
      tenantId,
      [providerIdField]: providerId,
      name: this.extractName(providerData, provider),
      email: this.extractEmail(providerData, provider),
      phone: this.extractPhone(providerData, provider),
      companyName: this.extractCompanyName(providerData, provider),
      address: this.extractAddress(providerData, provider),
      role: this.extractRole(providerData, provider),
      isActive: this.extractIsActive(providerData, provider),
      paymentTerms: this.extractPaymentTerms(providerData, provider),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return contactData;
  }

  async upsert(transformedData: any, provider: string): Promise<boolean> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = transformedData[providerIdField];

    // Try to find existing contact
    const [existingContact] = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.tenantId, transformedData.tenantId),
        eq(contacts[providerIdField], providerId)
      ));

    if (existingContact) {
      // Update existing contact
      await db
        .update(contacts)
        .set({
          ...transformedData,
          updatedAt: new Date()
        })
        .where(eq(contacts.id, existingContact.id));
      
      return false; // Updated
    } else {
      // Create new contact
      await db.insert(contacts).values(transformedData);
      return true; // Created
    }
  }

  private getProviderIdField(provider: string): string {
    switch (provider) {
      case 'xero': return 'xeroContactId';
      case 'sage': return 'sageContactId';
      case 'quickbooks': return 'quickBooksContactId';
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private getProviderId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.ContactID || data.Id || data.id;
      case 'sage': return data.id || data.ID;
      case 'quickbooks': return data.Id || data.id;
      default: return data.id || data.ID || data.Id;
    }
  }

  private extractName(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.Name || '';
      case 'sage': return data.display_name || data.name || '';
      case 'quickbooks': return data.Name || data.FullyQualifiedName || '';
      default: return data.name || data.Name || '';
    }
  }

  private extractEmail(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': 
        return data.EmailAddress || (data.ContactPersons && data.ContactPersons[0]?.EmailAddress) || null;
      case 'sage': 
        return data.email || data.primary_email || null;
      case 'quickbooks': 
        return data.PrimaryEmailAddr?.Address || null;
      default: 
        return data.email || data.Email || null;
    }
  }

  private extractPhone(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero':
        const xeroPhones = data.Phones || [];
        const xeroPhone = xeroPhones.find((p: any) => p.PhoneType === 'DEFAULT' || p.PhoneType === 'MOBILE');
        return xeroPhone?.PhoneNumber || null;
      case 'sage':
        return data.phone || data.telephone || null;
      case 'quickbooks':
        return data.PrimaryPhone?.FreeFormNumber || null;
      default:
        return data.phone || data.Phone || null;
    }
  }

  private extractCompanyName(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.Name || null;
      case 'sage': return data.company_name || data.name || null;
      case 'quickbooks': return data.CompanyName || data.Name || null;
      default: return data.companyName || data.company || null;
    }
  }

  private extractAddress(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero':
        const xeroAddresses = data.Addresses || [];
        const xeroAddress = xeroAddresses.find((a: any) => a.AddressType === 'STREET' || a.AddressType === 'POBOX');
        if (xeroAddress) {
          return [
            xeroAddress.AddressLine1,
            xeroAddress.AddressLine2,
            xeroAddress.City,
            xeroAddress.Region,
            xeroAddress.PostalCode,
            xeroAddress.Country
          ].filter(Boolean).join(', ');
        }
        return null;
      case 'sage':
        return [data.address_line_1, data.address_line_2, data.city, data.postal_code, data.country].filter(Boolean).join(', ') || null;
      case 'quickbooks':
        const qbAddress = data.BillAddr;
        if (qbAddress) {
          return [
            qbAddress.Line1,
            qbAddress.Line2,
            qbAddress.City,
            qbAddress.CountrySubDivisionCode,
            qbAddress.PostalCode,
            qbAddress.Country
          ].filter(Boolean).join(', ');
        }
        return null;
      default:
        return data.address || null;
    }
  }

  private extractRole(data: any, provider: string): string {
    switch (provider) {
      case 'xero': 
        return data.IsCustomer && data.IsSupplier ? 'both' : 
               data.IsCustomer ? 'customer' : 
               data.IsSupplier ? 'vendor' : 'customer';
      case 'sage':
        return data.contact_type || 'customer';
      case 'quickbooks':
        // QuickBooks separates customers and vendors into different endpoints
        return 'customer'; // Will be overridden based on endpoint called
      default:
        return 'customer';
    }
  }

  private extractIsActive(data: any, provider: string): boolean {
    switch (provider) {
      case 'xero': return data.ContactStatus === 'ACTIVE';
      case 'sage': return data.status === 'active' || data.active === true;
      case 'quickbooks': return data.Active !== false;
      default: return true;
    }
  }

  private extractPaymentTerms(data: any, provider: string): number {
    switch (provider) {
      case 'xero': 
        const terms = data.DefaultCurrency?.PaymentTerms;
        return terms ? parseInt(terms) : 30;
      case 'sage':
        return data.payment_terms_in_days || 30;
      case 'quickbooks':
        const qbTerms = data.TermRef?.name;
        return qbTerms ? this.parseQBPaymentTerms(qbTerms) : 30;
      default:
        return 30;
    }
  }

  private parseQBPaymentTerms(termsName: string): number {
    // Parse QuickBooks payment terms like "Net 30", "2% 10 Net 30", etc.
    const match = termsName.match(/Net (\d+)/i);
    return match ? parseInt(match[1]) : 30;
  }
}

/**
 * Invoices Handler
 */
export class InvoicesHandler implements DataTypeHandler {
  async transform(providerData: any, provider: string, tenantId: string): Promise<any> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = this.getProviderId(providerData, provider);

    if (!providerId) {
      throw new Error(`No ID found for ${provider} invoice`);
    }

    // Find corresponding contact
    const contactId = await this.findContactId(providerData, provider, tenantId);

    const invoiceData = {
      tenantId,
      contactId,
      [providerIdField]: providerId,
      invoiceNumber: this.extractInvoiceNumber(providerData, provider),
      amount: this.extractAmount(providerData, provider),
      amountPaid: this.extractAmountPaid(providerData, provider),
      taxAmount: this.extractTaxAmount(providerData, provider),
      status: this.extractStatus(providerData, provider),
      issueDate: this.extractIssueDate(providerData, provider),
      dueDate: this.extractDueDate(providerData, provider),
      paidDate: this.extractPaidDate(providerData, provider),
      description: this.extractDescription(providerData, provider),
      currency: this.extractCurrency(providerData, provider),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return invoiceData;
  }

  async upsert(transformedData: any, provider: string): Promise<boolean> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = transformedData[providerIdField];

    // Try to find existing invoice
    const [existingInvoice] = await db
      .select()
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, transformedData.tenantId),
        eq(invoices[providerIdField], providerId)
      ));

    let invoiceId: string;
    let isCreate = false;

    if (existingInvoice) {
      // Update existing invoice
      await db
        .update(invoices)
        .set({
          ...transformedData,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, existingInvoice.id));
      
      invoiceId = existingInvoice.id;
      isCreate = false;
    } else {
      // Create new invoice
      const [newInvoice] = await db.insert(invoices).values(transformedData).returning();
      invoiceId = newInvoice.id;
      isCreate = true;
    }

    // Trigger signal collection if invoice has payment data (Xero sync)
    const hasPaymentData = 
      (transformedData.amountPaid && parseFloat(transformedData.amountPaid) > 0) || 
      transformedData.paidDate;

    if (hasPaymentData && transformedData.contactId) {
      // Trigger signal collection asynchronously
      signalCollector.recordPaymentEvent({
        contactId: transformedData.contactId,
        tenantId: transformedData.tenantId,
        invoiceId: invoiceId,
        amountPaid: parseFloat(transformedData.amountPaid || '0'),
        invoiceAmount: parseFloat(transformedData.amount),
        dueDate: new Date(transformedData.dueDate),
        paidDate: transformedData.paidDate ? new Date(transformedData.paidDate) : new Date(),
        isPartial: parseFloat(transformedData.amountPaid || '0') < parseFloat(transformedData.amount),
      }).catch((err: Error) => {
        console.error('❌ Failed to record payment signal from Xero sync:', err);
      });

      console.log(`📊 Triggered payment signal collection for invoice ${invoiceId} from Xero sync`);
    }

    // Create dispute window timer for new invoices (T0+25 days)
    if (isCreate && transformedData.contactId) {
      try {
        await timerService.createDisputeWindowTimer(
          transformedData.tenantId,
          invoiceId,
          transformedData.contactId,
          new Date(transformedData.issueDate)
        );
        console.log(`⏰ Created dispute window timer for invoice ${invoiceId}`);
      } catch (error: any) {
        console.error('⚠️ Failed to create dispute window timer:', error.message);
      }
    }
    
    return isCreate;
  }

  private getProviderIdField(provider: string): string {
    switch (provider) {
      case 'xero': return 'xeroInvoiceId';
      case 'sage': return 'sageInvoiceId';
      case 'quickbooks': return 'quickBooksInvoiceId';
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private getProviderId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.InvoiceID || data.Id || data.id;
      case 'sage': return data.id || data.ID;
      case 'quickbooks': return data.Id || data.id;
      default: return data.id || data.ID || data.Id;
    }
  }

  private async findContactId(data: any, provider: string, tenantId: string): Promise<string | null> {
    let providerContactId: string | null = null;
    let contactIdField: string;

    switch (provider) {
      case 'xero':
        providerContactId = data.Contact?.ContactID;
        contactIdField = 'xeroContactId';
        break;
      case 'sage':
        providerContactId = data.contact_id || data.customer_id;
        contactIdField = 'sageContactId';
        break;
      case 'quickbooks':
        providerContactId = data.CustomerRef?.value || data.customer_ref?.value;
        contactIdField = 'quickBooksContactId';
        break;
      default:
        return null;
    }

    if (!providerContactId) return null;

    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.tenantId, tenantId),
        eq(contacts[contactIdField], providerContactId)
      ));

    return contact?.id || null;
  }

  private extractInvoiceNumber(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.InvoiceNumber || '';
      case 'sage': return data.invoice_number || data.reference || '';
      case 'quickbooks': return data.DocNumber || '';
      default: return data.invoiceNumber || data.number || '';
    }
  }

  private extractAmount(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.Total || data.SubTotal || '0');
      case 'sage': return parseFloat(data.total_amount || data.net_amount || '0');
      case 'quickbooks': return parseFloat(data.TotalAmt || '0');
      default: return parseFloat(data.amount || data.total || '0');
    }
  }

  private extractAmountPaid(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.AmountPaid || '0');
      case 'sage': return parseFloat(data.payments_allocations_total_amount || '0');
      case 'quickbooks': 
        const total = parseFloat(data.TotalAmt || '0');
        const balance = parseFloat(data.Balance || '0');
        return total - balance;
      default: return parseFloat(data.amountPaid || '0');
    }
  }

  private extractTaxAmount(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.TotalTax || '0');
      case 'sage': return parseFloat(data.total_tax_amount || '0');
      case 'quickbooks': 
        // Sum up tax amounts from TxnTaxDetail
        const taxDetail = data.TxnTaxDetail;
        return taxDetail ? parseFloat(taxDetail.TotalTax || '0') : 0;
      default: return parseFloat(data.taxAmount || '0');
    }
  }

  private extractStatus(data: any, provider: string): string {
    switch (provider) {
      case 'xero':
        const xeroStatus = data.Status;
        switch (xeroStatus) {
          case 'PAID': return 'paid';
          case 'AUTHORISED': 
          case 'SUBMITTED': return 'pending';
          case 'VOIDED': return 'cancelled';
          default: return 'pending';
        }
      case 'sage':
        const sageStatus = data.status;
        return sageStatus === 'paid' ? 'paid' : 'pending';
      case 'quickbooks':
        const balance = parseFloat(data.Balance || '0');
        return balance === 0 ? 'paid' : 'pending';
      default:
        return 'pending';
    }
  }

  private extractIssueDate(data: any, provider: string): Date {
    switch (provider) {
      case 'xero': return new Date(data.Date || data.DateString);
      case 'sage': return new Date(data.date || data.issue_date);
      case 'quickbooks': return new Date(data.TxnDate);
      default: return new Date(data.issueDate || data.date);
    }
  }

  private extractDueDate(data: any, provider: string): Date {
    switch (provider) {
      case 'xero': return new Date(data.DueDate || data.DueDateString);
      case 'sage': return new Date(data.due_date);
      case 'quickbooks': return new Date(data.DueDate || data.TxnDate);
      default: return new Date(data.dueDate || data.date);
    }
  }

  private extractPaidDate(data: any, provider: string): Date | null {
    const status = this.extractStatus(data, provider);
    if (status !== 'paid') return null;

    switch (provider) {
      case 'xero': return data.FullyPaidOnDate ? new Date(data.FullyPaidOnDate) : null;
      case 'sage': return data.paid_date ? new Date(data.paid_date) : null;
      case 'quickbooks': 
        // QuickBooks doesn't provide a direct paid date, estimate from status
        const balance = parseFloat(data.Balance || '0');
        return balance === 0 ? new Date() : null;
      default: return data.paidDate ? new Date(data.paidDate) : null;
    }
  }

  private extractDescription(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': 
        const lineItems = data.LineItems || [];
        return lineItems.map((item: any) => item.Description).filter(Boolean).join('; ') || null;
      case 'sage': return data.description || data.notes || null;
      case 'quickbooks': 
        const qbLines = data.Line || [];
        return qbLines.map((line: any) => line.Description).filter(Boolean).join('; ') || null;
      default: return data.description || null;
    }
  }

  private extractCurrency(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.CurrencyCode || 'USD';
      case 'sage': return data.currency || 'USD';
      case 'quickbooks': return data.CurrencyRef?.value || 'USD';
      default: return data.currency || 'USD';
    }
  }
}

/**
 * Bills Handler (Accounts Payable)
 */
export class BillsHandler implements DataTypeHandler {
  async transform(providerData: any, provider: string, tenantId: string): Promise<any> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = this.getProviderId(providerData, provider);

    if (!providerId) {
      throw new Error(`No ID found for ${provider} bill`);
    }

    // Find corresponding vendor
    const vendorId = await this.findVendorId(providerData, provider, tenantId);

    const billData = {
      tenantId,
      vendorId,
      [providerIdField]: providerId,
      billNumber: this.extractBillNumber(providerData, provider),
      amount: this.extractAmount(providerData, provider),
      amountPaid: this.extractAmountPaid(providerData, provider),
      taxAmount: this.extractTaxAmount(providerData, provider),
      status: this.extractStatus(providerData, provider),
      issueDate: this.extractIssueDate(providerData, provider),
      dueDate: this.extractDueDate(providerData, provider),
      paidDate: this.extractPaidDate(providerData, provider),
      description: this.extractDescription(providerData, provider),
      currency: this.extractCurrency(providerData, provider),
      reference: this.extractReference(providerData, provider),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return billData;
  }

  async upsert(transformedData: any, provider: string): Promise<boolean> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = transformedData[providerIdField];

    // Try to find existing bill
    const [existingBill] = await db
      .select()
      .from(bills)
      .where(and(
        eq(bills.tenantId, transformedData.tenantId),
        eq(bills[providerIdField], providerId)
      ));

    if (existingBill) {
      // Update existing bill
      await db
        .update(bills)
        .set({
          ...transformedData,
          updatedAt: new Date()
        })
        .where(eq(bills.id, existingBill.id));
      
      return false; // Updated
    } else {
      // Create new bill
      await db.insert(bills).values(transformedData);
      return true; // Created
    }
  }

  private getProviderIdField(provider: string): string {
    switch (provider) {
      case 'xero': return 'xeroInvoiceId'; // Bills are invoices in Xero
      case 'sage': return 'sageInvoiceId';
      case 'quickbooks': return 'quickBooksInvoiceId';
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private getProviderId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.InvoiceID || data.Id || data.id;
      case 'sage': return data.id || data.ID;
      case 'quickbooks': return data.Id || data.id;
      default: return data.id || data.ID || data.Id;
    }
  }

  private async findVendorId(data: any, provider: string, tenantId: string): Promise<string | null> {
    let providerVendorId: string | null = null;
    let vendorIdField: string;

    switch (provider) {
      case 'xero':
        providerVendorId = data.Contact?.ContactID;
        vendorIdField = 'xeroContactId';
        break;
      case 'sage':
        providerVendorId = data.contact_id || data.vendor_id;
        vendorIdField = 'sageContactId';
        break;
      case 'quickbooks':
        providerVendorId = data.VendorRef?.value || data.vendor_ref?.value;
        vendorIdField = 'quickBooksContactId';
        break;
      default:
        return null;
    }

    if (!providerVendorId) return null;

    const [vendor] = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.tenantId, tenantId),
        eq(contacts[vendorIdField], providerVendorId),
        or(eq(contacts.role, 'vendor'), eq(contacts.role, 'both'))
      ));

    return vendor?.id || null;
  }

  private extractBillNumber(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.InvoiceNumber || '';
      case 'sage': return data.invoice_number || data.reference || '';
      case 'quickbooks': return data.DocNumber || '';
      default: return data.billNumber || data.number || '';
    }
  }

  private extractAmount(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.Total || data.SubTotal || '0');
      case 'sage': return parseFloat(data.total_amount || data.net_amount || '0');
      case 'quickbooks': return parseFloat(data.TotalAmt || '0');
      default: return parseFloat(data.amount || data.total || '0');
    }
  }

  private extractAmountPaid(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.AmountPaid || '0');
      case 'sage': return parseFloat(data.payments_allocations_total_amount || '0');
      case 'quickbooks': 
        const total = parseFloat(data.TotalAmt || '0');
        const balance = parseFloat(data.Balance || '0');
        return total - balance;
      default: return parseFloat(data.amountPaid || '0');
    }
  }

  private extractTaxAmount(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.TotalTax || '0');
      case 'sage': return parseFloat(data.total_tax_amount || '0');
      case 'quickbooks': 
        const taxDetail = data.TxnTaxDetail;
        return taxDetail ? parseFloat(taxDetail.TotalTax || '0') : 0;
      default: return parseFloat(data.taxAmount || '0');
    }
  }

  private extractStatus(data: any, provider: string): string {
    switch (provider) {
      case 'xero':
        const xeroStatus = data.Status;
        switch (xeroStatus) {
          case 'PAID': return 'paid';
          case 'AUTHORISED': 
          case 'SUBMITTED': return 'pending';
          case 'VOIDED': return 'cancelled';
          default: return 'pending';
        }
      case 'sage':
        const sageStatus = data.status;
        return sageStatus === 'paid' ? 'paid' : 'pending';
      case 'quickbooks':
        const balance = parseFloat(data.Balance || '0');
        return balance === 0 ? 'paid' : 'pending';
      default:
        return 'pending';
    }
  }

  private extractIssueDate(data: any, provider: string): Date {
    switch (provider) {
      case 'xero': return new Date(data.Date || data.DateString);
      case 'sage': return new Date(data.date || data.issue_date);
      case 'quickbooks': return new Date(data.TxnDate);
      default: return new Date(data.issueDate || data.date);
    }
  }

  private extractDueDate(data: any, provider: string): Date {
    switch (provider) {
      case 'xero': return new Date(data.DueDate || data.DueDateString);
      case 'sage': return new Date(data.due_date);
      case 'quickbooks': return new Date(data.DueDate || data.TxnDate);
      default: return new Date(data.dueDate || data.date);
    }
  }

  private extractPaidDate(data: any, provider: string): Date | null {
    const status = this.extractStatus(data, provider);
    if (status !== 'paid') return null;

    switch (provider) {
      case 'xero': return data.FullyPaidOnDate ? new Date(data.FullyPaidOnDate) : null;
      case 'sage': return data.paid_date ? new Date(data.paid_date) : null;
      case 'quickbooks': 
        const balance = parseFloat(data.Balance || '0');
        return balance === 0 ? new Date() : null;
      default: return data.paidDate ? new Date(data.paidDate) : null;
    }
  }

  private extractDescription(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': 
        const lineItems = data.LineItems || [];
        return lineItems.map((item: any) => item.Description).filter(Boolean).join('; ') || null;
      case 'sage': return data.description || data.notes || null;
      case 'quickbooks': 
        const qbLines = data.Line || [];
        return qbLines.map((line: any) => line.Description).filter(Boolean).join('; ') || null;
      default: return data.description || null;
    }
  }

  private extractCurrency(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.CurrencyCode || 'USD';
      case 'sage': return data.currency || 'USD';
      case 'quickbooks': return data.CurrencyRef?.value || 'USD';
      default: return data.currency || 'USD';
    }
  }

  private extractReference(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.Reference || null;
      case 'sage': return data.vendor_reference || data.reference || null;
      case 'quickbooks': return data.VendorRef?.name || null;
      default: return data.reference || null;
    }
  }
}

/**
 * Bank Accounts Handler
 */
export class BankAccountsHandler implements DataTypeHandler {
  async transform(providerData: any, provider: string, tenantId: string): Promise<any> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = this.getProviderId(providerData, provider);

    if (!providerId) {
      throw new Error(`No ID found for ${provider} bank account`);
    }

    const bankAccountData = {
      tenantId,
      [providerIdField]: providerId,
      name: this.extractName(providerData, provider),
      accountNumber: this.extractAccountNumber(providerData, provider),
      accountType: this.extractAccountType(providerData, provider),
      currency: this.extractCurrency(providerData, provider),
      currentBalance: this.extractCurrentBalance(providerData, provider),
      isActive: this.extractIsActive(providerData, provider),
      bankName: this.extractBankName(providerData, provider),
      description: this.extractDescription(providerData, provider),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return bankAccountData;
  }

  async upsert(transformedData: any, provider: string): Promise<boolean> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = transformedData[providerIdField];

    // Try to find existing bank account
    const [existingAccount] = await db
      .select()
      .from(bankAccounts)
      .where(and(
        eq(bankAccounts.tenantId, transformedData.tenantId),
        eq(bankAccounts[providerIdField], providerId)
      ));

    if (existingAccount) {
      // Update existing bank account
      await db
        .update(bankAccounts)
        .set({
          ...transformedData,
          updatedAt: new Date()
        })
        .where(eq(bankAccounts.id, existingAccount.id));
      
      return false; // Updated
    } else {
      // Create new bank account
      await db.insert(bankAccounts).values(transformedData);
      return true; // Created
    }
  }

  private getProviderIdField(provider: string): string {
    switch (provider) {
      case 'xero': return 'xeroAccountId';
      case 'sage': return 'sageAccountId';
      case 'quickbooks': return 'quickBooksAccountId';
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private getProviderId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.AccountID || data.Id || data.id;
      case 'sage': return data.id || data.ID;
      case 'quickbooks': return data.Id || data.id;
      default: return data.id || data.ID || data.Id;
    }
  }

  private extractName(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.Name || '';
      case 'sage': return data.display_name || data.name || '';
      case 'quickbooks': return data.Name || '';
      default: return data.name || data.Name || '';
    }
  }

  private extractAccountNumber(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.BankAccountNumber || data.Code || null;
      case 'sage': return data.account_number || null;
      case 'quickbooks': return data.AcctNum || null;
      default: return data.accountNumber || null;
    }
  }

  private extractAccountType(data: any, provider: string): string {
    switch (provider) {
      case 'xero':
        const xeroType = data.BankAccountType;
        switch (xeroType) {
          case 'BANK': return 'checking';
          case 'CREDITCARD': return 'credit_card';
          case 'PAYPAL': return 'cash';
          default: return 'checking';
        }
      case 'sage':
        const sageType = data.bank_account_type;
        return sageType || 'checking';
      case 'quickbooks':
        const qbType = data.AccountSubType;
        switch (qbType) {
          case 'Checking': return 'checking';
          case 'Savings': return 'savings';
          case 'CreditCard': return 'credit_card';
          case 'Cash': return 'cash';
          default: return 'checking';
        }
      default:
        return 'checking';
    }
  }

  private extractCurrency(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.CurrencyCode || 'USD';
      case 'sage': return data.currency || 'USD';
      case 'quickbooks': return data.CurrencyRef?.value || 'USD';
      default: return data.currency || 'USD';
    }
  }

  private extractCurrentBalance(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.BankBalance || '0');
      case 'sage': return parseFloat(data.balance || '0');
      case 'quickbooks': return parseFloat(data.CurrentBalance?.amount || '0');
      default: return parseFloat(data.balance || data.currentBalance || '0');
    }
  }

  private extractIsActive(data: any, provider: string): boolean {
    switch (provider) {
      case 'xero': return data.Status === 'ACTIVE';
      case 'sage': return data.status === 'active' || data.active === true;
      case 'quickbooks': return data.Active !== false;
      default: return true;
    }
  }

  private extractBankName(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.BankName || null;
      case 'sage': return data.bank_name || null;
      case 'quickbooks': return data.BankNum || null;
      default: return data.bankName || null;
    }
  }

  private extractDescription(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.Description || null;
      case 'sage': return data.description || null;
      case 'quickbooks': return data.Description || null;
      default: return data.description || null;
    }
  }
}

/**
 * Payments Handler
 */
export class PaymentsHandler implements DataTypeHandler {
  async transform(providerData: any, provider: string, tenantId: string): Promise<any> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = this.getProviderId(providerData, provider);

    if (!providerId) {
      throw new Error(`No ID found for ${provider} payment`);
    }

    const paymentData = {
      tenantId,
      [providerIdField]: providerId,
      invoiceId: this.extractInvoiceId(providerData, provider),
      amount: this.extractAmount(providerData, provider),
      date: this.extractDate(providerData, provider),
      reference: this.extractReference(providerData, provider),
      currencyCode: this.extractCurrency(providerData, provider),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return paymentData;
  }

  async upsert(transformedData: any, provider: string): Promise<boolean> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = transformedData[providerIdField];

    // Try to find existing payment
    const [existingPayment] = await db
      .select()
      .from(bankTransactions)
      .where(and(
        eq(bankTransactions.tenantId, transformedData.tenantId),
        eq(bankTransactions[providerIdField], providerId)
      ));

    if (existingPayment) {
      // Update existing payment
      await db
        .update(bankTransactions)
        .set({
          ...transformedData,
          updatedAt: new Date()
        })
        .where(eq(bankTransactions.id, existingPayment.id));
      
      return false; // Updated
    } else {
      // Create new payment
      await db.insert(bankTransactions).values(transformedData);
      return true; // Created
    }
  }

  private getProviderIdField(provider: string): string {
    switch (provider) {
      case 'xero': return 'xeroTransactionId';
      case 'sage': return 'sageTransactionId';
      case 'quickbooks': return 'quickBooksTransactionId';
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private getProviderId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.PaymentID || data.Id || data.id;
      case 'sage': return data.id || data.ID;
      case 'quickbooks': return data.Id || data.id;
      default: return data.id || data.ID || data.Id;
    }
  }

  private extractInvoiceId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.Invoice?.InvoiceID || null;
      case 'sage': return data.invoice_id || null;
      case 'quickbooks': return data.LinkedTxn?.[0]?.TxnId || null;
      default: return data.invoiceId || null;
    }
  }

  private extractAmount(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.Amount || '0');
      case 'sage': return parseFloat(data.total_amount || data.amount || '0');
      case 'quickbooks': return parseFloat(data.TotalAmt || '0');
      default: return parseFloat(data.amount || '0');
    }
  }

  private extractDate(data: any, provider: string): Date {
    switch (provider) {
      case 'xero': return new Date(data.Date || data.UpdatedDateUTC);
      case 'sage': return new Date(data.date || data.created_at);
      case 'quickbooks': return new Date(data.TxnDate || data.TimeCreated);
      default: return new Date(data.date || data.createdAt || Date.now());
    }
  }

  private extractReference(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.Reference || null;
      case 'sage': return data.reference || null;
      case 'quickbooks': return data.PaymentRefNum || null;
      default: return data.reference || null;
    }
  }

  private extractCurrency(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.CurrencyCode || 'USD';
      case 'sage': return data.currency || 'USD';
      case 'quickbooks': return data.CurrencyRef?.value || 'USD';
      default: return data.currency || 'USD';
    }
  }
}

/**
 * Bill Payments Handler
 */
export class BillPaymentsHandler implements DataTypeHandler {
  async transform(providerData: any, provider: string, tenantId: string): Promise<any> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = this.getProviderId(providerData, provider);

    if (!providerId) {
      throw new Error(`No ID found for ${provider} bill payment`);
    }

    const billPaymentData = {
      tenantId,
      [providerIdField]: providerId,
      billId: this.extractBillId(providerData, provider),
      amount: this.extractAmount(providerData, provider),
      date: this.extractDate(providerData, provider),
      reference: this.extractReference(providerData, provider),
      currencyCode: this.extractCurrency(providerData, provider),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return billPaymentData;
  }

  async upsert(transformedData: any, provider: string): Promise<boolean> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = transformedData[providerIdField];

    // Try to find existing bill payment
    const [existingPayment] = await db
      .select()
      .from(billPayments)
      .where(and(
        eq(billPayments.tenantId, transformedData.tenantId),
        eq(billPayments[providerIdField], providerId)
      ));

    if (existingPayment) {
      // Update existing bill payment
      await db
        .update(billPayments)
        .set({
          ...transformedData,
          updatedAt: new Date()
        })
        .where(eq(billPayments.id, existingPayment.id));
      
      return false; // Updated
    } else {
      // Create new bill payment
      await db.insert(billPayments).values(transformedData);
      return true; // Created
    }
  }

  private getProviderIdField(provider: string): string {
    switch (provider) {
      case 'xero': return 'xeroBillPaymentId';
      case 'sage': return 'sageBillPaymentId';
      case 'quickbooks': return 'quickBooksBillPaymentId';
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private getProviderId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.BillPaymentID || data.Id || data.id;
      case 'sage': return data.id || data.ID;
      case 'quickbooks': return data.Id || data.id;
      default: return data.id || data.ID || data.Id;
    }
  }

  private extractBillId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.Bill?.BillID || null;
      case 'sage': return data.bill_id || null;
      case 'quickbooks': return data.VendorRef?.value || null;
      default: return data.billId || null;
    }
  }

  private extractAmount(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.Amount || '0');
      case 'sage': return parseFloat(data.total_amount || data.amount || '0');
      case 'quickbooks': return parseFloat(data.TotalAmt || '0');
      default: return parseFloat(data.amount || '0');
    }
  }

  private extractDate(data: any, provider: string): Date {
    switch (provider) {
      case 'xero': return new Date(data.Date || data.UpdatedDateUTC);
      case 'sage': return new Date(data.date || data.created_at);
      case 'quickbooks': return new Date(data.TxnDate || data.TimeCreated);
      default: return new Date(data.date || data.createdAt || Date.now());
    }
  }

  private extractReference(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.Reference || null;
      case 'sage': return data.reference || null;
      case 'quickbooks': return data.DocNumber || null;
      default: return data.reference || null;
    }
  }

  private extractCurrency(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.CurrencyCode || 'USD';
      case 'sage': return data.currency || 'USD';
      case 'quickbooks': return data.CurrencyRef?.value || 'USD';
      default: return data.currency || 'USD';
    }
  }
}

/**
 * Bank Transactions Handler
 */
export class BankTransactionsHandler implements DataTypeHandler {
  async transform(providerData: any, provider: string, tenantId: string): Promise<any> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = this.getProviderId(providerData, provider);

    if (!providerId) {
      throw new Error(`No ID found for ${provider} bank transaction`);
    }

    const bankTransactionData = {
      tenantId,
      [providerIdField]: providerId,
      bankAccountId: this.extractBankAccountId(providerData, provider),
      amount: this.extractAmount(providerData, provider),
      date: this.extractDate(providerData, provider),
      description: this.extractDescription(providerData, provider),
      reference: this.extractReference(providerData, provider),
      type: this.extractType(providerData, provider),
      currencyCode: this.extractCurrency(providerData, provider),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return bankTransactionData;
  }

  async upsert(transformedData: any, provider: string): Promise<boolean> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = transformedData[providerIdField];

    // Try to find existing bank transaction
    const [existingTransaction] = await db
      .select()
      .from(bankTransactions)
      .where(and(
        eq(bankTransactions.tenantId, transformedData.tenantId),
        eq(bankTransactions[providerIdField], providerId)
      ));

    if (existingTransaction) {
      // Update existing bank transaction
      await db
        .update(bankTransactions)
        .set({
          ...transformedData,
          updatedAt: new Date()
        })
        .where(eq(bankTransactions.id, existingTransaction.id));
      
      return false; // Updated
    } else {
      // Create new bank transaction
      await db.insert(bankTransactions).values(transformedData);
      return true; // Created
    }
  }

  private getProviderIdField(provider: string): string {
    switch (provider) {
      case 'xero': return 'xeroTransactionId';
      case 'sage': return 'sageTransactionId';
      case 'quickbooks': return 'quickBooksTransactionId';
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private getProviderId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.BankTransactionID || data.Id || data.id;
      case 'sage': return data.id || data.ID;
      case 'quickbooks': return data.Id || data.id;
      default: return data.id || data.ID || data.Id;
    }
  }

  private extractBankAccountId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.BankAccount?.AccountID || null;
      case 'sage': return data.bank_account_id || null;
      case 'quickbooks': return data.AccountRef?.value || null;
      default: return data.bankAccountId || null;
    }
  }

  private extractAmount(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.Total || '0');
      case 'sage': return parseFloat(data.amount || '0');
      case 'quickbooks': return parseFloat(data.Amount || '0');
      default: return parseFloat(data.amount || '0');
    }
  }

  private extractDate(data: any, provider: string): Date {
    switch (provider) {
      case 'xero': return new Date(data.Date || data.UpdatedDateUTC);
      case 'sage': return new Date(data.date || data.created_at);
      case 'quickbooks': return new Date(data.TxnDate || data.TimeCreated);
      default: return new Date(data.date || data.createdAt || Date.now());
    }
  }

  private extractDescription(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.Reference || null;
      case 'sage': return data.description || null;
      case 'quickbooks': return data.Description || null;
      default: return data.description || null;
    }
  }

  private extractReference(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.Reference || null;
      case 'sage': return data.reference || null;
      case 'quickbooks': return data.DocNumber || null;
      default: return data.reference || null;
    }
  }

  private extractType(data: any, provider: string): string {
    switch (provider) {
      case 'xero': 
        return data.Type === 'RECEIVE' ? 'credit' : 'debit';
      case 'sage': 
        return data.type === 'receipt' ? 'credit' : 'debit';
      case 'quickbooks': 
        return parseFloat(data.Amount) >= 0 ? 'credit' : 'debit';
      default: 
        return parseFloat(data.amount || '0') >= 0 ? 'credit' : 'debit';
    }
  }

  private extractCurrency(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.CurrencyCode || 'USD';
      case 'sage': return data.currency || 'USD';
      case 'quickbooks': return data.CurrencyRef?.value || 'USD';
      default: return data.currency || 'USD';
    }
  }
}

/**
 * Budgets Handler
 */
export class BudgetsHandler implements DataTypeHandler {
  async transform(providerData: any, provider: string, tenantId: string): Promise<any> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = this.getProviderId(providerData, provider);

    if (!providerId) {
      throw new Error(`No ID found for ${provider} budget`);
    }

    const budgetData = {
      tenantId,
      [providerIdField]: providerId,
      name: this.extractName(providerData, provider),
      type: this.extractType(providerData, provider),
      period: this.extractPeriod(providerData, provider),
      startDate: this.extractStartDate(providerData, provider),
      endDate: this.extractEndDate(providerData, provider),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return budgetData;
  }

  async upsert(transformedData: any, provider: string): Promise<boolean> {
    const providerIdField = this.getProviderIdField(provider);
    const providerId = transformedData[providerIdField];

    // Try to find existing budget
    const [existingBudget] = await db
      .select()
      .from(budgets)
      .where(and(
        eq(budgets.tenantId, transformedData.tenantId),
        eq(budgets[providerIdField], providerId)
      ));

    if (existingBudget) {
      // Update existing budget
      await db
        .update(budgets)
        .set({
          ...transformedData,
          updatedAt: new Date()
        })
        .where(eq(budgets.id, existingBudget.id));
      
      return false; // Updated
    } else {
      // Create new budget
      await db.insert(budgets).values(transformedData);
      return true; // Created
    }
  }

  private getProviderIdField(provider: string): string {
    switch (provider) {
      case 'xero': return 'xeroBudgetId';
      case 'sage': return 'sageBudgetId';
      case 'quickbooks': return 'quickBooksBudgetId';
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private getProviderId(data: any, provider: string): string | null {
    switch (provider) {
      case 'xero': return data.BudgetID || data.Id || data.id;
      case 'sage': return data.id || data.ID;
      case 'quickbooks': return data.Id || data.id;
      default: return data.id || data.ID || data.Id;
    }
  }

  private extractName(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.Description || data.Name || '';
      case 'sage': return data.name || data.display_name || '';
      case 'quickbooks': return data.Name || '';
      default: return data.name || data.Name || '';
    }
  }

  private extractType(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.Type || 'overall';
      case 'sage': return data.budget_type || 'overall';
      case 'quickbooks': return data.BudgetType || 'overall';
      default: return data.type || 'overall';
    }
  }

  private extractPeriod(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.Period || 'annual';
      case 'sage': return data.period || 'annual';
      case 'quickbooks': return data.BudgetEntryType || 'annual';
      default: return data.period || 'annual';
    }
  }

  private extractStartDate(data: any, provider: string): Date {
    switch (provider) {
      case 'xero': return new Date(data.BudgetLines?.[0]?.AccountID || Date.now());
      case 'sage': return new Date(data.start_date || Date.now());
      case 'quickbooks': return new Date(data.StartDate || Date.now());
      default: return new Date(data.startDate || Date.now());
    }
  }

  private extractEndDate(data: any, provider: string): Date {
    switch (provider) {
      case 'xero': return new Date(data.BudgetLines?.[0]?.AccountID || Date.now());
      case 'sage': return new Date(data.end_date || Date.now());
      case 'quickbooks': return new Date(data.EndDate || Date.now());
      default: return new Date(data.endDate || Date.now());
    }
  }
}

/**
 * Exchange Rates Handler
 */
export class ExchangeRatesHandler implements DataTypeHandler {
  async transform(providerData: any, provider: string, tenantId: string): Promise<any> {
    const exchangeRateData = {
      tenantId,
      provider,
      fromCurrency: this.extractFromCurrency(providerData, provider),
      toCurrency: this.extractToCurrency(providerData, provider),
      rate: this.extractRate(providerData, provider),
      date: this.extractDate(providerData, provider),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return exchangeRateData;
  }

  async upsert(transformedData: any, provider: string): Promise<boolean> {
    // Try to find existing exchange rate for same date and currency pair
    const [existingRate] = await db
      .select()
      .from(exchangeRates)
      .where(and(
        eq(exchangeRates.tenantId, transformedData.tenantId),
        eq(exchangeRates.provider, provider),
        eq(exchangeRates.fromCurrency, transformedData.fromCurrency),
        eq(exchangeRates.toCurrency, transformedData.toCurrency),
        eq(exchangeRates.date, transformedData.date)
      ));

    if (existingRate) {
      // Update existing exchange rate
      await db
        .update(exchangeRates)
        .set({
          ...transformedData,
          updatedAt: new Date()
        })
        .where(eq(exchangeRates.id, existingRate.id));
      
      return false; // Updated
    } else {
      // Create new exchange rate
      await db.insert(exchangeRates).values(transformedData);
      return true; // Created
    }
  }

  private extractFromCurrency(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.FromCode || 'USD';
      case 'sage': return data.base_currency || 'USD';
      case 'quickbooks': return data.SourceCurrencyCode || 'USD';
      default: return data.fromCurrency || 'USD';
    }
  }

  private extractToCurrency(data: any, provider: string): string {
    switch (provider) {
      case 'xero': return data.ToCode || 'USD';
      case 'sage': return data.target_currency || 'USD';
      case 'quickbooks': return data.TargetCurrencyCode || 'USD';
      default: return data.toCurrency || 'USD';
    }
  }

  private extractRate(data: any, provider: string): number {
    switch (provider) {
      case 'xero': return parseFloat(data.Rate || '1.0');
      case 'sage': return parseFloat(data.exchange_rate || '1.0');
      case 'quickbooks': return parseFloat(data.ExchangeRate || '1.0');
      default: return parseFloat(data.rate || '1.0');
    }
  }

  private extractDate(data: any, provider: string): Date {
    switch (provider) {
      case 'xero': return new Date(data.EffectiveDate || Date.now());
      case 'sage': return new Date(data.date || Date.now());
      case 'quickbooks': return new Date(data.AsOfDate || Date.now());
      default: return new Date(data.date || Date.now());
    }
  }
}


/**
 * Factory function to create appropriate handler for resource type
 */
export function createDataTypeHandler(resourceType: string): DataTypeHandler {
  switch (resourceType) {
    case 'contacts':
    case 'customers':
    case 'vendors':
      return new ContactsHandler();
    case 'invoices':
      return new InvoicesHandler();
    case 'bills':
      return new BillsHandler();
    case 'payments':
      return new PaymentsHandler();
    case 'bill-payments':
      return new BillPaymentsHandler();
    case 'bank-accounts':
    case 'bankaccounts':
      return new BankAccountsHandler();
    case 'bank-transactions':
      return new BankTransactionsHandler();
    case 'budgets':
      return new BudgetsHandler();
    case 'exchange-rates':
      return new ExchangeRatesHandler();
    default:
      throw new Error(`No handler available for resource type: ${resourceType}`);
  }
}