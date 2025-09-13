import { 
  StandardContact, 
  StandardInvoice, 
  StandardPayment, 
  StandardVendor,
  StandardBill,
  StandardBillPayment,
  StandardBankAccount,
  StandardBankTransaction,
  StandardBudget,
  StandardBudgetLine,
  StandardExchangeRate,
  DataMapping 
} from './types';

/**
 * Universal Data Transformation Engine
 * Converts provider-specific data formats to standardized models
 */
export class DataTransformer {
  private mappings: Map<string, DataMapping[]> = new Map();

  /**
   * Safe metadata fields allowlist - only these fields can be included in metadata
   * to prevent leakage of sensitive data like tokens, PII, or credentials
   */
  private static readonly SAFE_METADATA_FIELDS = new Set([
    // Basic identifier fields
    'id', 'type', 'status', 'state',
    
    // Timestamps (safe operational data)
    'created_at', 'updated_at', 'created', 'updated', 
    'date_created', 'date_updated', 'last_modified',
    'timestamp', 'date_string', 'date_string_utc',
    
    // Document metadata
    'document_type', 'document_status', 'version',
    'revision', 'line_amount_types',
    
    // Non-sensitive status indicators
    'is_active', 'active', 'enabled', 'is_enabled',
    'is_reconciled', 'reconciled', 'is_approved',
    
    // Safe reference fields (not containing PII)
    'reference_number', 'doc_number', 'invoice_type',
    'transaction_type', 'payment_type', 'account_type',
    
    // Currency and localization (non-sensitive)
    'currency_code', 'currency', 'locale', 'timezone',
    
    // Non-sensitive counts and totals (already in main fields)
    'line_count', 'attachment_count', 'total_lines',
    
    // Safe boolean flags
    'has_attachments', 'has_errors', 'is_deleted',
    'sent_to_contact', 'is_placeholder'
  ]);

  constructor() {
    this.initializeDefaultMappings();
    this.addQuickBooksMappings();
    this.addSageMappings();
    this.addVendorMappings();
    this.addBillMappings();
    this.addBillPaymentMappings();
    this.addBankingMappings();
    this.addBudgetMappings();
    this.addExchangeRateMappings();
  }

  /**
   * Register a data mapping for a provider
   */
  registerMapping(mapping: DataMapping): void {
    const key = `${mapping.provider}:${mapping.dataType}`;
    const existingMappings = this.mappings.get(key) || [];
    existingMappings.push(mapping);
    this.mappings.set(key, existingMappings);
  }

  /**
   * Transform provider data to standard format
   */
  transformToStandard<T>(
    provider: string,
    dataType: 'contact' | 'invoice' | 'payment' | 'vendor' | 'bill' | 'bill_payment' | 'bank_account' | 'bank_transaction' | 'budget' | 'budget_line' | 'exchange_rate',
    rawData: any
  ): T {
    const key = `${provider}:${dataType}`;
    const mappings = this.mappings.get(key);

    if (!mappings || mappings.length === 0) {
      throw new Error(`No mapping found for ${provider}:${dataType}`);
    }

    // Use the first mapping (could be extended for multiple mappings)
    const mapping = mappings[0];

    const transformed: any = {};

    // Apply field mappings
    for (const [standardField, providerField] of Object.entries(mapping.fieldMappings)) {
      if (typeof providerField === 'string') {
        // Simple field mapping
        transformed[standardField] = this.getNestedValue(rawData, providerField);
      } else if (typeof providerField === 'function') {
        // Function-based transformation
        transformed[standardField] = providerField(rawData);
      }
    }

    // Apply transformations
    if (mapping.transformations) {
      for (const [field, transformer] of Object.entries(mapping.transformations)) {
        if (transformed[field] !== undefined) {
          transformed[field] = transformer(transformed[field]);
        }
      }
    }

    // Add provider metadata
    transformed.provider = provider;
    transformed.metadata = this.extractMetadata(rawData, mapping);

    return transformed as T;
  }

  /**
   * Transform standard data to provider-specific format
   */
  transformToProvider(
    provider: string,
    dataType: 'contact' | 'invoice' | 'payment' | 'vendor' | 'bill' | 'bill_payment' | 'bank_account' | 'bank_transaction' | 'budget' | 'budget_line' | 'exchange_rate',
    standardData: any
  ): any {
    const key = `${provider}:${dataType}`;
    const mappings = this.mappings.get(key);

    if (!mappings || mappings.length === 0) {
      throw new Error(`No mapping found for ${provider}:${dataType}`);
    }

    const mapping = mappings[0];
    const transformed: any = {};

    // Reverse field mappings
    for (const [standardField, providerField] of Object.entries(mapping.fieldMappings)) {
      if (typeof providerField === 'string' && standardData[standardField] !== undefined) {
        this.setNestedValue(transformed, providerField, standardData[standardField]);
      }
    }

    return transformed;
  }

  /**
   * Batch transform multiple items
   */
  transformBatch<T>(
    provider: string,
    dataType: 'contact' | 'invoice' | 'payment' | 'vendor' | 'bill' | 'bill_payment' | 'bank_account' | 'bank_transaction' | 'budget' | 'budget_line' | 'exchange_rate',
    rawDataArray: any[]
  ): T[] {
    return rawDataArray.map(item => this.transformToStandard<T>(provider, dataType, item));
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      current[key] = current[key] || {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Extract metadata from raw data using a secure allowlist approach
   * Only includes fields from SAFE_METADATA_FIELDS to prevent sensitive data leakage
   */
  private extractMetadata(rawData: any, mapping: DataMapping): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Get already mapped field paths to avoid duplication
    const mappedPaths = Object.values(mapping.fieldMappings)
      .filter(field => typeof field === 'string') as string[];

    // Flatten the raw data for field access
    const flattenedRaw = this.flattenObject(rawData);
    
    // Only include fields that are in the safe allowlist and not already mapped
    for (const [key, value] of Object.entries(flattenedRaw)) {
      // Check if field is in safe allowlist
      const fieldName = key.toLowerCase();
      const isFieldSafe = DataTransformer.SAFE_METADATA_FIELDS.has(fieldName) ||
                         Array.from(DataTransformer.SAFE_METADATA_FIELDS).some(safeField => 
                           fieldName.includes(safeField) || fieldName.endsWith(safeField)
                         );
      
      // Only include if safe, not already mapped, and not the metadata field itself
      if (isFieldSafe && !mappedPaths.includes(key) && key !== 'metadata' && value !== null && value !== undefined) {
        // Limit string length to prevent large payloads in metadata
        if (typeof value === 'string' && value.length > 100) {
          metadata[key] = value.substring(0, 100) + '...';
        } else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
          metadata[key] = value;
        }
        // Exclude objects, arrays, and functions for security
      }
    }

    return metadata;
  }

  /**
   * Flatten nested object for metadata extraction
   */
  private flattenObject(obj: any, prefix: string = ''): Record<string, any> {
    const flattened: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }
    
    return flattened;
  }

  /**
   * Initialize default mappings for supported providers
   */
  private initializeDefaultMappings(): void {
    // Xero Contact Mapping
    this.registerMapping({
      provider: 'xero',
      dataType: 'contact',
      fieldMappings: {
        id: 'ContactID',
        name: 'Name',
        email: 'EmailAddress',
        phone: (data: any) => data.Phones?.find((p: any) => p.PhoneType === 'DEFAULT')?.PhoneNumber || null,
        company: 'Name',
        isActive: 'IsActive',
        providerContactId: 'ContactID',
        outstandingBalance: (data: any) => parseFloat(data.Balances?.AccountsReceivable?.Outstanding) || 0,
      },
      transformations: {
        outstandingBalance: (value: any) => parseFloat(value) || 0,
        isActive: (value: any) => Boolean(value),
      }
    });

    // Xero Invoice Mapping
    this.registerMapping({
      provider: 'xero',
      dataType: 'invoice',
      fieldMappings: {
        id: 'InvoiceID',
        number: 'InvoiceNumber',
        contactId: 'Contact.ContactID',
        amount: 'Total',
        amountPaid: 'AmountPaid',
        status: (data: any) => this.mapXeroStatusToStandard(data.Status),
        issueDate: (data: any) => data.Date || data.DateString,
        dueDate: (data: any) => data.DueDate || data.DueDateString,
        currency: 'CurrencyCode',
        description: (data: any) => `Invoice from Xero - ${data.InvoiceNumber}`,
        providerInvoiceId: 'InvoiceID',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        amountPaid: (value: any) => parseFloat(value) || 0,
        issueDate: (value: any) => new Date(value),
        dueDate: (value: any) => new Date(value),
      }
    });

    // Xero Payment Mapping
    this.registerMapping({
      provider: 'xero',
      dataType: 'payment',
      fieldMappings: {
        id: 'PaymentID',
        invoiceId: 'Invoice.InvoiceID',
        amount: 'Amount',
        date: 'Date',
        method: (data: any) => data.Account?.Name || 'Unknown',
        reference: 'Reference',
        providerPaymentId: 'PaymentID',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        date: (value: any) => new Date(value),
      }
    });
  }

  /**
   * Map Xero status to standard status
   */
  private mapXeroStatusToStandard(xeroStatus: string): string {
    const statusMap: Record<string, string> = {
      'PAID': 'paid',
      'VOIDED': 'cancelled',
      'AUTHORISED': 'pending',
      'SUBMITTED': 'pending',
      'DRAFT': 'pending',
    };
    
    return statusMap[xeroStatus] || 'pending';
  }

  /**
   * Map QuickBooks status to standard status
   */
  private mapQuickBooksStatusToStandard(emailStatus: string, balance: number): string {
    // QuickBooks doesn't have a direct status field, we derive it from balance and email status
    const balanceValue = parseFloat(balance?.toString() || '0');
    
    if (balanceValue === 0) {
      return 'paid';
    }
    
    // Check if overdue (would need due date comparison in real implementation)
    // For now, use email status as indicator
    if (emailStatus === 'NotSet') {
      return 'pending';
    }
    
    return 'pending';
  }

  /**
   * Map Sage status to standard status
   */
  private mapSageStatusToStandard(sageStatus: string): string {
    const statusMap: Record<string, string> = {
      'PAID': 'paid',
      'PAID_IN_FULL': 'paid',
      'PART_PAID': 'pending',
      'UNPAID': 'pending',
      'OVERDUE': 'overdue',
      'VOID': 'cancelled',
      'CANCELLED': 'cancelled',
    };
    
    return statusMap[sageStatus?.toUpperCase()] || 'pending';
  }

  /**
   * Type guard for Xero bills - only ACCPAY invoices should be processed as bills
   * This prevents sales invoices (ACCREC) from being incorrectly processed as bills
   */
  private isXeroBill(data: any): boolean {
    // Only process as bill if it's an ACCPAY (Accounts Payable) invoice
    return data.Type === 'ACCPAY';
  }

  /**
   * Add QuickBooks mappings
   */
  addQuickBooksMappings(): void {
    // QuickBooks Customer Mapping
    this.registerMapping({
      provider: 'quickbooks',
      dataType: 'contact',
      fieldMappings: {
        id: 'Id',
        name: 'Name',
        email: 'PrimaryEmailAddr.Address',
        phone: 'PrimaryPhone.FreeFormNumber',
        company: 'CompanyName',
        isActive: 'Active',
        providerContactId: 'Id',
        outstandingBalance: (data: any) => parseFloat(data.Balance) || 0,
      },
      transformations: {
        outstandingBalance: (value: any) => parseFloat(value) || 0,
        isActive: (value: any) => Boolean(value),
      }
    });

    // QuickBooks Invoice Mapping
    this.registerMapping({
      provider: 'quickbooks',
      dataType: 'invoice',
      fieldMappings: {
        id: 'Id',
        number: 'DocNumber',
        contactId: 'CustomerRef.value',
        amount: 'TotalAmt',
        amountPaid: (data: any) => parseFloat(data.TotalAmt) - parseFloat(data.Balance || 0),
        status: (data: any) => this.mapQuickBooksStatusToStandard(data.EmailStatus, data.Balance),
        issueDate: 'TxnDate',
        dueDate: 'DueDate',
        currency: 'CurrencyRef.value',
        description: (data: any) => `Invoice ${data.DocNumber} from QuickBooks`,
        providerInvoiceId: 'Id',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        amountPaid: (value: any) => parseFloat(value) || 0,
        issueDate: (value: any) => new Date(value),
        dueDate: (value: any) => new Date(value),
      }
    });

    // QuickBooks Payment Mapping
    this.registerMapping({
      provider: 'quickbooks',
      dataType: 'payment',
      fieldMappings: {
        id: 'Id',
        invoiceId: (data: any) => data.Line?.[0]?.LinkedTxn?.[0]?.TxnId,
        amount: 'TotalAmt',
        date: 'TxnDate',
        method: (data: any) => data.PaymentMethodRef?.name || 'Unknown',
        reference: 'PaymentRefNum',
        providerPaymentId: 'Id',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        date: (value: any) => new Date(value),
      }
    });
  }

  /**
   * Add Sage mappings
   */
  addSageMappings(): void {
    // Sage Contact Mapping
    this.registerMapping({
      provider: 'sage',
      dataType: 'contact',
      fieldMappings: {
        id: 'id',
        name: 'name',
        email: 'main_contact_person.email',
        phone: 'main_contact_person.telephone',
        company: 'name',
        isActive: (data: any) => !data.deleted_at,
        providerContactId: 'id',
        outstandingBalance: (data: any) => parseFloat(data.balance) || 0,
      },
      transformations: {
        outstandingBalance: (value: any) => parseFloat(value) || 0,
        isActive: (value: any) => Boolean(value),
      }
    });

    // Sage Invoice Mapping
    this.registerMapping({
      provider: 'sage',
      dataType: 'invoice',
      fieldMappings: {
        id: 'id',
        number: 'invoice_number',
        contactId: 'contact.id',
        amount: 'total_amount',
        amountPaid: 'paid_amount',
        status: (data: any) => this.mapSageStatusToStandard(data.status),
        issueDate: 'date',
        dueDate: 'due_date',
        currency: 'currency.iso_code',
        description: (data: any) => `Invoice ${data.invoice_number} from Sage`,
        providerInvoiceId: 'id',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        amountPaid: (value: any) => parseFloat(value) || 0,
        issueDate: (value: any) => new Date(value),
        dueDate: (value: any) => new Date(value),
      }
    });

    // Sage Payment Mapping (Bank Receipts)
    this.registerMapping({
      provider: 'sage',
      dataType: 'payment',
      fieldMappings: {
        id: 'id',
        invoiceId: (data: any) => data.allocated_artefacts?.[0]?.artefact?.id,
        amount: 'total_amount',
        date: 'date',
        method: (data: any) => data.bank_account?.name || 'Bank Transfer',
        reference: 'reference',
        providerPaymentId: 'id',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        date: (value: any) => new Date(value),
      }
    });
  }

  /**
   * Add vendor mappings for all providers
   */
  addVendorMappings(): void {
    // Xero Vendor Mapping (Contacts with type supplier)
    this.registerMapping({
      provider: 'xero',
      dataType: 'vendor',
      fieldMappings: {
        id: 'ContactID',
        name: 'Name',
        email: 'EmailAddress',
        phone: (data: any) => data.Phones?.find((p: any) => p.PhoneType === 'DEFAULT')?.PhoneNumber || null,
        company: 'Name',
        address: (data: any) => {
          const address = data.Addresses?.find((a: any) => a.AddressType === 'POBOX' || a.AddressType === 'STREET');
          return address ? `${address.AddressLine1 || ''} ${address.AddressLine2 || ''} ${address.City || ''} ${address.PostalCode || ''}`.trim() : undefined;
        },
        taxNumber: 'TaxNumber',
        accountNumber: 'AccountNumber',
        paymentTerms: (data: any) => data.PaymentTerms?.Bills || 30,
        creditLimit: (data: any) => parseFloat(data.CreditLimit) || 0,
        isActive: 'IsActive',
        providerVendorId: 'ContactID',
      },
      transformations: {
        creditLimit: (value: any) => parseFloat(value) || 0,
        isActive: (value: any) => Boolean(value),
        paymentTerms: (value: any) => parseInt(value) || 30,
      }
    });

    // QuickBooks Vendor Mapping
    this.registerMapping({
      provider: 'quickbooks',
      dataType: 'vendor',
      fieldMappings: {
        id: 'Id',
        name: 'DisplayName',
        email: 'PrimaryEmailAddr.Address',
        phone: 'PrimaryPhone.FreeFormNumber',
        company: 'CompanyName',
        address: (data: any) => {
          const addr = data.BillAddr;
          return addr ? `${addr.Line1 || ''} ${addr.Line2 || ''} ${addr.City || ''} ${addr.PostalCode || ''}`.trim() : undefined;
        },
        taxNumber: 'TaxIdentifier',
        accountNumber: 'AcctNum',
        paymentTerms: (data: any) => data.TermRef?.value || 30,
        isActive: 'Active',
        providerVendorId: 'Id',
      },
      transformations: {
        isActive: (value: any) => Boolean(value),
        paymentTerms: (value: any) => parseInt(value) || 30,
      }
    });

    // Sage Vendor Mapping (Suppliers)
    this.registerMapping({
      provider: 'sage',
      dataType: 'vendor',
      fieldMappings: {
        id: 'id',
        name: 'name',
        email: 'main_contact_person.email',
        phone: 'main_contact_person.telephone',
        company: 'name',
        address: (data: any) => {
          const addr = data.main_address;
          return addr ? `${addr.address_line_1 || ''} ${addr.address_line_2 || ''} ${addr.city || ''} ${addr.postal_code || ''}`.trim() : undefined;
        },
        taxNumber: 'tax_number',
        accountNumber: 'supplier_code',
        paymentTerms: (data: any) => data.payment_terms_days || 30,
        creditLimit: (data: any) => parseFloat(data.credit_limit) || 0,
        isActive: (data: any) => !data.deleted_at,
        providerVendorId: 'id',
      },
      transformations: {
        creditLimit: (value: any) => parseFloat(value) || 0,
        isActive: (value: any) => Boolean(value),
        paymentTerms: (value: any) => parseInt(value) || 30,
      }
    });
  }

  /**
   * Add bill mappings for all providers
   */
  addBillMappings(): void {
    // Xero Bill Mapping (ACCPAY invoices only - with type guard)
    this.registerMapping({
      provider: 'xero',
      dataType: 'bill',
      fieldMappings: {
        id: (data: any) => this.isXeroBill(data) ? data.InvoiceID : null,
        number: (data: any) => this.isXeroBill(data) ? data.InvoiceNumber : null,
        vendorId: (data: any) => this.isXeroBill(data) ? data.Contact?.ContactID : null,
        amount: (data: any) => this.isXeroBill(data) ? data.Total : null,
        amountPaid: (data: any) => this.isXeroBill(data) ? data.AmountPaid : null,
        taxAmount: (data: any) => this.isXeroBill(data) ? data.TotalTax : null,
        status: (data: any) => this.isXeroBill(data) ? this.mapXeroStatusToStandard(data.Status) : null,
        issueDate: (data: any) => this.isXeroBill(data) ? (data.Date || data.DateString) : null,
        dueDate: (data: any) => this.isXeroBill(data) ? (data.DueDate || data.DueDateString) : null,
        paidDate: (data: any) => this.isXeroBill(data) ? data.FullyPaidOnDate : null,
        currency: (data: any) => this.isXeroBill(data) ? data.CurrencyCode : null,
        description: (data: any) => this.isXeroBill(data) ? `Bill from Xero - ${data.InvoiceNumber}` : null,
        reference: (data: any) => this.isXeroBill(data) ? data.Reference : null,
        providerBillId: (data: any) => this.isXeroBill(data) ? data.InvoiceID : null,
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        amountPaid: (value: any) => parseFloat(value) || 0,
        taxAmount: (value: any) => parseFloat(value) || 0,
        issueDate: (value: any) => new Date(value),
        dueDate: (value: any) => new Date(value),
        paidDate: (value: any) => value ? new Date(value) : undefined,
      }
    });

    // QuickBooks Bill Mapping
    this.registerMapping({
      provider: 'quickbooks',
      dataType: 'bill',
      fieldMappings: {
        id: 'Id',
        number: 'DocNumber',
        vendorId: 'VendorRef.value',
        amount: 'TotalAmt',
        amountPaid: (data: any) => parseFloat(data.TotalAmt) - parseFloat(data.Balance || 0),
        taxAmount: (data: any) => parseFloat(data.TxnTaxDetail?.TotalTax) || 0,
        status: (data: any) => this.mapQuickBooksStatusToStandard(data.EmailStatus, data.Balance),
        issueDate: 'TxnDate',
        dueDate: 'DueDate',
        currency: 'CurrencyRef.value',
        description: (data: any) => `Bill ${data.DocNumber} from QuickBooks`,
        reference: 'DocNumber',
        providerBillId: 'Id',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        amountPaid: (value: any) => parseFloat(value) || 0,
        taxAmount: (value: any) => parseFloat(value) || 0,
        issueDate: (value: any) => new Date(value),
        dueDate: (value: any) => new Date(value),
      }
    });

    // Sage Bill Mapping (Purchase Invoices)
    this.registerMapping({
      provider: 'sage',
      dataType: 'bill',
      fieldMappings: {
        id: 'id',
        number: 'invoice_number',
        vendorId: 'supplier.id',
        amount: 'total_amount',
        amountPaid: 'paid_amount',
        taxAmount: 'total_tax_amount',
        status: (data: any) => this.mapSageStatusToStandard(data.status),
        issueDate: 'date',
        dueDate: 'due_date',
        paidDate: (data: any) => data.payment_date,
        currency: 'currency.iso_code',
        description: (data: any) => `Bill ${data.invoice_number} from Sage`,
        reference: 'vendor_reference',
        providerBillId: 'id',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        amountPaid: (value: any) => parseFloat(value) || 0,
        taxAmount: (value: any) => parseFloat(value) || 0,
        issueDate: (value: any) => new Date(value),
        dueDate: (value: any) => new Date(value),
        paidDate: (value: any) => value ? new Date(value) : undefined,
      }
    });
  }

  /**
   * Add bill payment mappings for all providers
   */
  addBillPaymentMappings(): void {
    // Xero Bill Payment Mapping (BankTransfers for bill payments)
    this.registerMapping({
      provider: 'xero',
      dataType: 'bill_payment',
      fieldMappings: {
        id: 'PaymentID',
        billId: 'Invoice.InvoiceID',
        bankAccountId: 'Account.AccountID',
        amount: 'Amount',
        paymentDate: 'Date',
        paymentMethod: (data: any) => data.Account?.Name || 'Bank Transfer',
        reference: 'Reference',
        currency: 'CurrencyCode',
        exchangeRate: (data: any) => parseFloat(data.CurrencyRate) || 1,
        providerPaymentId: 'PaymentID',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        paymentDate: (value: any) => new Date(value),
        exchangeRate: (value: any) => parseFloat(value) || 1,
      }
    });

    // QuickBooks Bill Payment Mapping
    this.registerMapping({
      provider: 'quickbooks',
      dataType: 'bill_payment',
      fieldMappings: {
        id: 'Id',
        billId: (data: any) => data.Line?.[0]?.LinkedTxn?.[0]?.TxnId,
        bankAccountId: 'CheckPayment.BankAccountRef.value',
        amount: 'TotalAmt',
        paymentDate: 'TxnDate',
        paymentMethod: (data: any) => data.PayType || 'Check',
        reference: 'DocNumber',
        currency: 'CurrencyRef.value',
        exchangeRate: (data: any) => parseFloat(data.ExchangeRate) || 1,
        providerPaymentId: 'Id',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        paymentDate: (value: any) => new Date(value),
        exchangeRate: (value: any) => parseFloat(value) || 1,
      }
    });

    // Sage Bill Payment Mapping (Purchase Payments)
    this.registerMapping({
      provider: 'sage',
      dataType: 'bill_payment',
      fieldMappings: {
        id: 'id',
        billId: (data: any) => data.allocated_artefacts?.[0]?.artefact?.id,
        bankAccountId: (data: any) => data.bank_account?.id,
        amount: 'total_amount',
        paymentDate: 'date',
        paymentMethod: (data: any) => data.payment_method || 'Bank Transfer',
        reference: 'reference',
        currency: 'currency.iso_code',
        exchangeRate: (data: any) => parseFloat(data.exchange_rate) || 1,
        providerPaymentId: 'id',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        paymentDate: (value: any) => new Date(value),
        exchangeRate: (value: any) => parseFloat(value) || 1,
      }
    });
  }

  /**
   * Add banking mappings for all providers
   */
  addBankingMappings(): void {
    // Xero Bank Account Mapping
    this.registerMapping({
      provider: 'xero',
      dataType: 'bank_account',
      fieldMappings: {
        id: 'AccountID',
        name: 'Name',
        accountNumber: 'AccountNumber',
        accountType: (data: any) => data.Type?.toLowerCase() || 'bank',
        currency: 'CurrencyCode',
        currentBalance: (data: any) => parseFloat(data.BankAccountNumber) || 0,
        isActive: (data: any) => data.Status === 'ACTIVE',
        bankName: 'BankAccountName',
        description: 'Description',
        providerAccountId: 'AccountID',
      },
      transformations: {
        currentBalance: (value: any) => parseFloat(value) || 0,
        isActive: (value: any) => Boolean(value),
      }
    });

    // Xero Bank Transaction Mapping
    this.registerMapping({
      provider: 'xero',
      dataType: 'bank_transaction',
      fieldMappings: {
        id: 'BankTransactionID',
        bankAccountId: 'BankAccount.AccountID',
        transactionDate: 'Date',
        amount: (data: any) => Math.abs(parseFloat(data.Total)) || 0,
        type: (data: any) => parseFloat(data.Total) >= 0 ? 'credit' : 'debit',
        description: 'Reference',
        reference: 'Reference',
        category: (data: any) => data.LineItems?.[0]?.AccountCode || undefined,
        contactId: 'Contact.ContactID',
        isReconciled: (data: any) => data.IsReconciled,
        reconciledAt: 'DateStringUTC',
        providerTransactionId: 'BankTransactionID',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        transactionDate: (value: any) => new Date(value),
        isReconciled: (value: any) => Boolean(value),
        reconciledAt: (value: any) => value ? new Date(value) : undefined,
      }
    });

    // QuickBooks Bank Account Mapping
    this.registerMapping({
      provider: 'quickbooks',
      dataType: 'bank_account',
      fieldMappings: {
        id: 'Id',
        name: 'Name',
        accountNumber: 'AcctNum',
        accountType: (data: any) => data.AccountSubType?.toLowerCase() || 'bank',
        currency: 'CurrencyRef.value',
        currentBalance: 'CurrentBalance',
        isActive: 'Active',
        description: 'Description',
        providerAccountId: 'Id',
      },
      transformations: {
        currentBalance: (value: any) => parseFloat(value) || 0,
        isActive: (value: any) => Boolean(value),
      }
    });

    // QuickBooks Bank Transaction Mapping (through Journal Entries)
    this.registerMapping({
      provider: 'quickbooks',
      dataType: 'bank_transaction',
      fieldMappings: {
        id: 'Id',
        bankAccountId: (data: any) => data.Line?.[0]?.JournalEntryLineDetail?.AccountRef?.value,
        transactionDate: 'TxnDate',
        amount: (data: any) => Math.abs(parseFloat(data.Line?.[0]?.Amount)) || 0,
        type: (data: any) => parseFloat(data.Line?.[0]?.Amount) >= 0 ? 'credit' : 'debit',
        description: (data: any) => data.Line?.[0]?.Description,
        reference: 'DocNumber',
        isReconciled: (data: any) => data.Line?.[0]?.JournalEntryLineDetail?.IsReconciled,
        providerTransactionId: 'Id',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        transactionDate: (value: any) => new Date(value),
        isReconciled: (value: any) => Boolean(value),
      }
    });

    // Sage Bank Account Mapping
    this.registerMapping({
      provider: 'sage',
      dataType: 'bank_account',
      fieldMappings: {
        id: 'id',
        name: 'name',
        accountNumber: 'account_number',
        accountType: (data: any) => data.bank_account_type?.name?.toLowerCase() || 'bank',
        currency: 'currency.iso_code',
        currentBalance: 'balance',
        isActive: (data: any) => !data.deleted_at,
        bankName: 'bank_name',
        description: 'description',
        providerAccountId: 'id',
      },
      transformations: {
        currentBalance: (value: any) => parseFloat(value) || 0,
        isActive: (value: any) => Boolean(value),
      }
    });

    // Sage Bank Transaction Mapping
    this.registerMapping({
      provider: 'sage',
      dataType: 'bank_transaction',
      fieldMappings: {
        id: 'id',
        bankAccountId: 'bank_account.id',
        transactionDate: 'date',
        amount: (data: any) => Math.abs(parseFloat(data.total_amount)) || 0,
        type: (data: any) => data.transaction_type?.name === 'Receipt' ? 'credit' : 'debit',
        description: 'description',
        reference: 'reference',
        category: (data: any) => data.nominal_code?.name,
        contactId: (data: any) => data.contact?.id,
        isReconciled: (data: any) => data.reconciled,
        reconciledAt: 'reconciled_date',
        providerTransactionId: 'id',
      },
      transformations: {
        amount: (value: any) => parseFloat(value) || 0,
        transactionDate: (value: any) => new Date(value),
        isReconciled: (value: any) => Boolean(value),
        reconciledAt: (value: any) => value ? new Date(value) : undefined,
      }
    });
  }

  /**
   * Add budget mappings for all providers
   */
  addBudgetMappings(): void {
    // Xero Budget Mapping
    this.registerMapping({
      provider: 'xero',
      dataType: 'budget',
      fieldMappings: {
        id: 'BudgetID',
        name: (data: any) => `Budget ${data.BudgetID}`,
        description: 'Description',
        budgetType: 'Type',
        startDate: (data: any) => data.Periods?.[0]?.PeriodDateStart,
        endDate: (data: any) => data.Periods?.[data.Periods?.length - 1]?.PeriodDateEnd,
        currency: 'CurrencyCode',
        status: 'Status',
        totalBudgetAmount: (data: any) => data.BudgetLines?.reduce((sum: number, line: any) => sum + parseFloat(line.AccountBudgetTotal || 0), 0) || 0,
        totalActualAmount: () => 0,
        isActive: (data: any) => data.Status === 'ACTIVE',
        providerBudgetId: 'BudgetID',
      },
      transformations: {
        totalBudgetAmount: (value: any) => parseFloat(value) || 0,
        totalActualAmount: (value: any) => parseFloat(value) || 0,
        startDate: (value: any) => new Date(value),
        endDate: (value: any) => new Date(value),
        isActive: (value: any) => Boolean(value),
      }
    });

    // Xero Budget Line Mapping
    this.registerMapping({
      provider: 'xero',
      dataType: 'budget_line',
      fieldMappings: {
        id: (data: any) => `${data.BudgetID}-${data.AccountID}`,
        budgetId: 'BudgetID',
        category: 'AccountCode',
        subcategory: 'AccountName',
        description: (data: any) => `Budget for ${data.AccountName}`,
        budgetedAmount: 'AccountBudgetTotal',
        actualAmount: () => 0,
        variance: (data: any) => 0 - parseFloat(data.AccountBudgetTotal || 0),
        variancePercentage: () => 0,
        isActive: () => true,
        providerBudgetLineId: (data: any) => `${data.BudgetID}-${data.AccountID}`,
      },
      transformations: {
        budgetedAmount: (value: any) => parseFloat(value) || 0,
        actualAmount: (value: any) => parseFloat(value) || 0,
        variance: (value: any) => parseFloat(value) || 0,
        variancePercentage: (value: any) => parseFloat(value) || 0,
        isActive: (value: any) => Boolean(value),
      }
    });

    // QuickBooks Class as Budget Mapping (simplified)
    this.registerMapping({
      provider: 'quickbooks',
      dataType: 'budget',
      fieldMappings: {
        id: 'Id',
        name: 'Name',
        description: 'Description',
        budgetType: 'annual',
        startDate: (data: any) => new Date().getFullYear() + '-01-01',
        endDate: (data: any) => new Date().getFullYear() + '-12-31',
        currency: 'USD',
        status: 'active',
        totalBudgetAmount: () => 0,
        totalActualAmount: () => 0,
        isActive: 'Active',
        providerBudgetId: 'Id',
      },
      transformations: {
        totalBudgetAmount: (value: any) => parseFloat(value) || 0,
        totalActualAmount: (value: any) => parseFloat(value) || 0,
        startDate: (value: any) => new Date(value),
        endDate: (value: any) => new Date(value),
        isActive: (value: any) => Boolean(value),
      }
    });

    // Sage Budget Mapping (if available)
    this.registerMapping({
      provider: 'sage',
      dataType: 'budget',
      fieldMappings: {
        id: 'id',
        name: 'name',
        description: 'description',
        budgetType: 'budget_type',
        startDate: 'start_date',
        endDate: 'end_date',
        currency: 'currency.iso_code',
        status: 'status',
        totalBudgetAmount: 'total_budget_amount',
        totalActualAmount: 'total_actual_amount',
        isActive: (data: any) => !data.deleted_at,
        providerBudgetId: 'id',
      },
      transformations: {
        totalBudgetAmount: (value: any) => parseFloat(value) || 0,
        totalActualAmount: (value: any) => parseFloat(value) || 0,
        startDate: (value: any) => new Date(value),
        endDate: (value: any) => new Date(value),
        isActive: (value: any) => Boolean(value),
      }
    });
  }

  /**
   * Add exchange rate mappings for all providers
   */
  addExchangeRateMappings(): void {
    // Xero Exchange Rate Mapping
    this.registerMapping({
      provider: 'xero',
      dataType: 'exchange_rate',
      fieldMappings: {
        id: (data: any) => `${data.FromCurrency}-${data.ToCurrency}-${data.Date}`,
        fromCurrency: 'FromCurrency',
        toCurrency: 'ToCurrency',
        rate: 'Rate',
        rateDate: 'Date',
        providerRateId: (data: any) => `${data.FromCurrency}-${data.ToCurrency}-${data.Date}`,
      },
      transformations: {
        rate: (value: any) => parseFloat(value) || 1,
        rateDate: (value: any) => new Date(value),
      }
    });

    // QuickBooks Exchange Rate Mapping
    this.registerMapping({
      provider: 'quickbooks',
      dataType: 'exchange_rate',
      fieldMappings: {
        id: (data: any) => `${data.SourceCurrencyCode}-${data.TargetCurrencyCode}-${data.AsOfDate}`,
        fromCurrency: 'SourceCurrencyCode',
        toCurrency: 'TargetCurrencyCode',
        rate: 'Rate',
        rateDate: 'AsOfDate',
        providerRateId: (data: any) => `${data.SourceCurrencyCode}-${data.TargetCurrencyCode}-${data.AsOfDate}`,
      },
      transformations: {
        rate: (value: any) => parseFloat(value) || 1,
        rateDate: (value: any) => new Date(value),
      }
    });

    // Sage Exchange Rate Mapping
    this.registerMapping({
      provider: 'sage',
      dataType: 'exchange_rate',
      fieldMappings: {
        id: (data: any) => `${data.from_currency?.iso_code}-${data.to_currency?.iso_code}-${data.rate_date}`,
        fromCurrency: 'from_currency.iso_code',
        toCurrency: 'to_currency.iso_code',
        rate: 'exchange_rate',
        rateDate: 'rate_date',
        providerRateId: 'id',
      },
      transformations: {
        rate: (value: any) => parseFloat(value) || 1,
        rateDate: (value: any) => new Date(value),
      }
    });
  }
}