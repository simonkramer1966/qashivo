import { StandardContact, StandardInvoice, StandardPayment, DataMapping } from './types';

/**
 * Universal Data Transformation Engine
 * Converts provider-specific data formats to standardized models
 */
export class DataTransformer {
  private mappings: Map<string, DataMapping[]> = new Map();

  constructor() {
    this.initializeDefaultMappings();
    this.addQuickBooksMappings();
    this.addSageMappings();
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
    dataType: 'contact' | 'invoice' | 'payment',
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
    dataType: 'contact' | 'invoice' | 'payment',
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
    dataType: 'contact' | 'invoice' | 'payment',
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
   * Extract metadata from raw data
   */
  private extractMetadata(rawData: any, mapping: DataMapping): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Store original provider data keys that weren't mapped
    const mappedPaths = Object.values(mapping.fieldMappings)
      .filter(field => typeof field === 'string') as string[];

    // Add unmapped fields as metadata
    const flattenedRaw = this.flattenObject(rawData);
    for (const [key, value] of Object.entries(flattenedRaw)) {
      if (!mappedPaths.includes(key) && key !== 'metadata') {
        metadata[key] = value;
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
}