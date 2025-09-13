/**
 * TypeScript type definitions for provider-specific API responses
 * These types help with proper type checking and IDE support
 */

// Sage Business Cloud API Response Types
export interface SageContact {
  id: string;
  name: string;
  main_contact_person?: {
    email?: string;
    telephone?: string;
    name?: string;
  };
  balance: string;
  credit_limit: string;
  currency: {
    iso_code: string;
  };
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SageInvoice {
  id: string;
  invoice_number: string;
  contact: {
    id: string;
    name: string;
  };
  date: string;
  due_date: string;
  total_amount: string;
  paid_amount: string;
  currency: {
    iso_code: string;
  };
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SagePayment {
  id: string;
  reference: string;
  total_amount: string;
  date: string;
  bank_account: {
    name: string;
    id: string;
  };
  allocated_artefacts?: Array<{
    artefact: {
      id: string;
      reference: string;
    };
    amount: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface SageApiResponse<T> {
  $items: T[];
  $page: number;
  $itemsPerPage: number;
  $total: number;
}

// QuickBooks Online API Response Types
export interface QuickBooksCustomer {
  Id: string;
  Name: string;
  CompanyName?: string;
  Active: boolean;
  Balance: number;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  BillAddr?: {
    Line1?: string;
    City?: string;
    Country?: string;
    PostalCode?: string;
  };
  CurrencyRef?: {
    value: string;
    name: string;
  };
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

export interface QuickBooksInvoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate?: string;
  TotalAmt: number;
  Balance: number;
  EmailStatus?: string;
  CustomerRef: {
    value: string;
    name: string;
  };
  CurrencyRef?: {
    value: string;
    name: string;
  };
  Line: Array<{
    Id?: string;
    LineNum?: number;
    Amount: number;
    DetailType: string;
    SalesItemLineDetail?: {
      ItemRef: {
        value: string;
        name: string;
      };
      Qty?: number;
      UnitPrice?: number;
    };
    LinkedTxn?: Array<{
      TxnId: string;
      TxnType: string;
    }>;
  }>;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

export interface QuickBooksPayment {
  Id: string;
  TotalAmt: number;
  TxnDate: string;
  PaymentRefNum?: string;
  CustomerRef: {
    value: string;
    name: string;
  };
  PaymentMethodRef?: {
    value: string;
    name: string;
  };
  Line: Array<{
    Amount: number;
    LinkedTxn?: Array<{
      TxnId: string;
      TxnType: string;
    }>;
  }>;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

export interface QuickBooksAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType: string;
  Active: boolean;
  CurrentBalance?: number;
  CurrencyRef?: {
    value: string;
    name: string;
  };
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

export interface QuickBooksQueryResponse<T> {
  QueryResponse: {
    [K in keyof T]: T[K][];
  } & {
    maxResults?: number;
    startPosition?: number;
  };
  time: string;
}

export interface QuickBooksCompanyInfo {
  Id: string;
  CompanyName: string;
  LegalName?: string;
  CompanyAddr?: {
    Line1?: string;
    City?: string;
    Country?: string;
    PostalCode?: string;
  };
  CustomerCommunicationAddr?: {
    Line1?: string;
    City?: string;
    Country?: string;
    PostalCode?: string;
  };
  Email?: {
    Address: string;
  };
  WebAddr?: {
    URI: string;
  };
  Country: string;
  QBVersion?: string;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

// Common provider error types
export interface ProviderError {
  code: string;
  message: string;
  detail?: string;
  moreInfo?: string;
}

export interface SageErrorResponse {
  $severity: string;
  $dataCode: string;
  $message: string;
  $details?: string;
}

export interface QuickBooksErrorResponse {
  Fault: {
    Error: Array<{
      code: string;
      Detail: string;
      element?: string;
    }>;
    type: string;
  };
  time: string;
}

// Provider configuration types
export interface SageProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
  scopes: string[];
  baseUrl?: string;
}

export interface QuickBooksProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
  scopes: string[];
  baseUrl?: string;
  discoveryDocument?: string;
}