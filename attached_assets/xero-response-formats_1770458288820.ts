/**
 * Xero API Response Format Reference
 * 
 * This file documents the exact structure of responses from Xero's API.
 * All demo data must match these formats exactly to flow through the
 * existing integration middleware without modification.
 * 
 * Reference: https://developer.xero.com/documentation/api/accounting/overview
 */

export interface XeroContact {
  ContactID: string;
  ContactNumber?: string;
  ContactStatus: 'ACTIVE' | 'ARCHIVED' | 'GDPRREQUEST';
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  BankAccountDetails?: string;
  TaxNumber?: string;
  AccountsReceivableTaxType?: string;
  AccountsPayableTaxType?: string;
  Addresses?: XeroAddress[];
  Phones?: XeroPhone[];
  UpdatedDateUTC: string; // Format: /Date(1234567890123)/
  ContactGroups?: any[];
  IsSupplier: boolean;
  IsCustomer: boolean;
  DefaultCurrency?: string;
  ContactPersons?: XeroContactPerson[];
  HasAttachments?: boolean;
  Discount?: number;
  Balances?: {
    AccountsReceivable?: {
      Outstanding?: number;
      Overdue?: number;
    };
    AccountsPayable?: {
      Outstanding?: number;
      Overdue?: number;
    };
  };
}

export interface XeroAddress {
  AddressType: 'POBOX' | 'STREET' | 'DELIVERY';
  AddressLine1?: string;
  AddressLine2?: string;
  AddressLine3?: string;
  AddressLine4?: string;
  City?: string;
  Region?: string;
  PostalCode?: string;
  Country?: string;
  AttentionTo?: string;
}

export interface XeroPhone {
  PhoneType: 'DEFAULT' | 'DDI' | 'MOBILE' | 'FAX';
  PhoneNumber: string;
  PhoneAreaCode?: string;
  PhoneCountryCode?: string;
}

export interface XeroContactPerson {
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  IncludeInEmails?: boolean;
}

export interface XeroInvoice {
  Type: 'ACCREC' | 'ACCPAY'; // ACCREC = Sales Invoice, ACCPAY = Purchase Invoice
  InvoiceID: string;
  InvoiceNumber: string;
  Reference?: string;
  Payments?: XeroPayment[];
  CreditNotes?: any[];
  Prepayments?: any[];
  Overpayments?: any[];
  AmountDue: number;
  AmountPaid: number;
  AmountCredited: number;
  CurrencyRate?: number;
  IsDiscounted?: boolean;
  HasAttachments?: boolean;
  HasErrors?: boolean;
  Contact: {
    ContactID: string;
    ContactNumber?: string;
    Name: string;
    EmailAddress?: string;
  };
  DateString: string; // ISO 8601 format
  DueDateString: string; // ISO 8601 format
  BrandingThemeID?: string;
  Status: 'DRAFT' | 'SUBMITTED' | 'DELETED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  LineAmountTypes: 'Exclusive' | 'Inclusive' | 'NoTax';
  LineItems: XeroLineItem[];
  SubTotal: number;
  TotalTax: number;
  Total: number;
  UpdatedDateUTC: string; // Format: /Date(1234567890123)/
  CurrencyCode: string;
  FullyPaidOnDate?: string | null;
  SentToContact?: boolean;
  ExpectedPaymentDate?: string;
  PlannedPaymentDate?: string;
  Url?: string;
}

export interface XeroLineItem {
  LineItemID?: string;
  Description: string;
  Quantity: number;
  UnitAmount: number;
  ItemCode?: string;
  AccountCode: string;
  TaxType?: string;
  TaxAmount: number;
  LineAmount: number;
  DiscountRate?: number;
  DiscountAmount?: number;
  Tracking?: XeroTrackingCategory[];
}

export interface XeroTrackingCategory {
  TrackingCategoryID: string;
  TrackingOptionID: string;
  Name: string;
  Option: string;
}

export interface XeroPayment {
  PaymentID: string;
  Date: string; // Format: /Date(1234567890123)/ or ISO 8601
  Amount: number;
  CurrencyRate?: number;
  PaymentType?: 'ACCRECPAYMENT' | 'ACCPAYPAYMENT' | 'ARCREDITPAYMENT' | 'APCREDITPAYMENT' | 'AROVERPAYMENTPAYMENT' | 'ARPREPAYMENTPAYMENT' | 'APPREPAYMENTPAYMENT' | 'APOVERPAYMENTPAYMENT';
  Status?: 'AUTHORISED' | 'DELETED';
  UpdatedDateUTC?: string;
  Reference?: string;
  IsReconciled?: boolean;
  Invoice?: {
    InvoiceID: string;
    InvoiceNumber: string;
  };
  CreditNote?: {
    CreditNoteID: string;
    CreditNoteNumber: string;
  };
  Account?: {
    AccountID: string;
    Code: string;
  };
  HasAccount?: boolean;
  HasValidationErrors?: boolean;
}

export interface XeroAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type?: 'BANK' | 'CURRENT' | 'CURRLIAB' | 'DEPRECIATN' | 'DIRECTCOSTS' | 'EQUITY' | 'EXPENSE' | 'FIXED' | 'INVENTORY' | 'LIABILITY' | 'NONCURRENT' | 'OTHERINCOME' | 'OVERHEADS' | 'PREPAYMENT' | 'REVENUE' | 'SALES' | 'TERMLIAB' | 'PAYGLIABILITY' | 'SUPERANNUATIONEXPENSE' | 'SUPERANNUATIONLIABILITY' | 'WAGESEXPENSE';
  Status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  Description?: string;
  BankAccountNumber?: string;
  BankAccountType?: 'BANK' | 'CREDITCARD' | 'PAYPAL';
  CurrencyCode?: string;
  TaxType?: string;
  EnablePaymentsToAccount?: boolean;
  ShowInExpenseClaims?: boolean;
  Class?: 'ASSET' | 'EQUITY' | 'EXPENSE' | 'LIABILITY' | 'REVENUE';
  SystemAccount?: string;
  ReportingCode?: string;
  ReportingCodeName?: string;
  HasAttachments?: boolean;
  UpdatedDateUTC?: string;
}

export interface XeroCreditNote {
  CreditNoteID: string;
  CreditNoteNumber: string;
  Type: 'ACCRECCEDIT' | 'ACCPAYCREDIT';
  Reference?: string;
  Contact: {
    ContactID: string;
    ContactNumber?: string;
    Name: string;
  };
  Date: string;
  Status: 'DRAFT' | 'SUBMITTED' | 'DELETED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  LineAmountTypes: 'Exclusive' | 'Inclusive' | 'NoTax';
  LineItems: XeroLineItem[];
  SubTotal: number;
  TotalTax: number;
  Total: number;
  UpdatedDateUTC: string;
  CurrencyCode: string;
  FullyPaidOnDate?: string | null;
  RemainingCredit?: number;
  Allocations?: any[];
  HasAttachments?: boolean;
}

export interface XeroBankTransaction {
  BankTransactionID: string;
  Type: 'RECEIVE' | 'SPEND' | 'RECEIVE-OVERPAYMENT' | 'RECEIVE-PREPAYMENT' | 'SPEND-OVERPAYMENT' | 'SPEND-PREPAYMENT';
  Contact: {
    ContactID: string;
    Name: string;
  };
  LineItems: XeroLineItem[];
  BankAccount: {
    AccountID: string;
    Code: string;
  };
  IsReconciled: boolean;
  Date: string;
  Reference?: string;
  CurrencyCode: string;
  CurrencyRate?: number;
  Status: 'AUTHORISED' | 'DELETED';
  LineAmountTypes: 'Exclusive' | 'Inclusive' | 'NoTax';
  SubTotal: number;
  TotalTax: number;
  Total: number;
  UpdatedDateUTC: string;
  HasAttachments?: boolean;
}

// Wrapper types for API responses
export interface XeroInvoicesResponse {
  Id: string;
  Status: string;
  ProviderName: string;
  DateTimeUTC: string;
  Invoices: XeroInvoice[];
}

export interface XeroContactsResponse {
  Id: string;
  Status: string;
  ProviderName: string;
  DateTimeUTC: string;
  Contacts: XeroContact[];
}

export interface XeroPaymentsResponse {
  Id: string;
  Status: string;
  ProviderName: string;
  DateTimeUTC: string;
  Payments: XeroPayment[];
}

export interface XeroAccountsResponse {
  Id: string;
  Status: string;
  ProviderName: string;
  DateTimeUTC: string;
  Accounts: XeroAccount[];
}

export interface XeroCreditNotesResponse {
  Id: string;
  Status: string;
  ProviderName: string;
  DateTimeUTC: string;
  CreditNotes: XeroCreditNote[];
}

export interface XeroBankTransactionsResponse {
  Id: string;
  Status: string;
  ProviderName: string;
  DateTimeUTC: string;
  BankTransactions: XeroBankTransaction[];
}

// Xero webhook event types
export type XeroWebhookEvent = 
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE';

export type XeroWebhookResourceType =
  | 'INVOICE'
  | 'CONTACT'
  | 'PAYMENT'
  | 'CREDITNOTE'
  | 'BANKTRANSACTION'
  | 'ACCOUNT';

export interface XeroWebhookPayload {
  events: Array<{
    resourceUrl: string;
    resourceId: string;
    eventDateUtc: string;
    eventType: XeroWebhookEvent;
    eventCategory: XeroWebhookResourceType;
    tenantId: string;
    tenantType: string;
  }>;
  firstEventSequence: number;
  lastEventSequence: number;
  entropy: string;
}

/**
 * UK Tax Rates (common in Xero UK accounts)
 */
export const UK_TAX_TYPES = {
  OUTPUT2: { rate: 0.20, name: 'VAT on Income (20%)' },
  OUTPUT: { rate: 0.20, name: 'VAT on Income (20%)' },
  INPUT2: { rate: 0.20, name: 'VAT on Expenses (20%)' },
  INPUT: { rate: 0.20, name: 'VAT on Expenses (20%)' },
  ZERORATEDINPUT: { rate: 0.00, name: 'Zero Rated Expenses' },
  ZERORATEDOUTPUT: { rate: 0.00, name: 'Zero Rated Income' },
  EXEMPTINPUT: { rate: 0.00, name: 'Exempt Expenses' },
  EXEMPTOUTPUT: { rate: 0.00, name: 'Exempt Income' },
} as const;

/**
 * Common UK Chart of Accounts codes
 */
export const UK_ACCOUNT_CODES = {
  BANK: '090',
  ACCOUNTS_RECEIVABLE: '610',
  SALES: '200',
  SALES_DISCOUNTS: '260',
  COST_OF_SALES: '310',
  ADVERTISING: '400',
  BANK_FEES: '404',
  CONSULTING: '408',
  DEPRECIATION: '416',
  INSURANCE: '448',
  RENT: '472',
  TELEPHONE: '489',
  TRAVEL: '493',
  WAGES: '477',
} as const;
