// ═══════════════════════════════════════════════════════════════════════════
// Qashivo Sync Abstraction Layer — Types & Interface
// ═══════════════════════════════════════════════════════════════════════════
// Platform-agnostic types for multi-accounting-platform sync.
// Every adapter (Xero, QuickBooks, Sage) implements AccountingAdapter.
// All operational logic lives in SyncOrchestrator.
// ═══════════════════════════════════════════════════════════════════════════

import type { Request, Response } from 'express';

// ─── Core Enums ────────────────────────────────────────────────────────────

export type QashivoInvoiceStatus =
  | 'pending'   // not yet due
  | 'overdue'   // past due date
  | 'paid'      // fully paid
  | 'partial'   // partially paid
  | 'void'      // voided/cancelled
  | 'draft';    // not yet issued

export type SyncMode =
  | 'initial'        // first sync after connection — full history pull
  | 'incremental'    // regular ongoing sync — modifiedSince cursor
  | 'force'          // user-triggered full re-pull — ignores cursor
  | 'webhook'        // triggered by webhook event — targeted sync
  | 'reconciliation'; // weekly full comparison sweep

export type SyncHealthStatus =
  | 'healthy'        // everything working
  | 'degraded'       // 3+ consecutive failures or stale data
  | 'failed'         // 6+ consecutive failures — Charlie paused
  | 'disconnected';  // token invalid or revoked

export type SyncStatus = 'idle' | 'running' | 'failed';

export type SyncTrigger = 'webhook' | 'schedule' | 'user' | 'reconnect';

// ─── Adapter Fetch Types ───────────────────────────────────────────────────

export interface FetchOptions {
  modifiedSince?: Date;       // null = fetch all
  statuses?: string[];        // platform-specific status filters
  dateFrom?: Date;            // only records with Date >= this value
  includeArchived?: boolean;  // default false
  pageSize?: number;          // override default page size
}

/**
 * Returned when the adapter uses the batch-return pattern (single-record fetch).
 * `fetchedAt` is captured BEFORE the first API call (spec 13.3 — pagination cursor safety).
 */
export interface RawFetchResult<T> {
  data: T[];
  totalCount: number;
  pagesFetched: number;
  hasMore: boolean;
  fetchedAt: Date; // BEFORE first API call — used as modifiedSince cursor
}

/**
 * Returned by streaming pagination methods (spec 13.4).
 * The adapter processes each page via the onPage callback;
 * FetchSummary returns totals only after all pages are processed.
 */
export interface FetchSummary {
  totalCount: number;
  pagesFetched: number;
  fetchedAt: Date; // BEFORE first API call — pagination cursor safety
}

// ─── Canonical Qashivo Types (platform-agnostic) ──────────────────────────

export interface ContactPerson {
  firstName: string;
  lastName: string;
  email: string | null;
  isPrimary: boolean;
}

export interface Address {
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface LineItem {
  description: string | null;
  quantity: number;
  unitAmount: number;
  taxAmount: number;
  lineAmount: number;
}

export interface QashivoInvoice {
  platformInvoiceId: string;
  platformContactId: string;
  invoiceNumber: string;
  reference: string | null;
  status: QashivoInvoiceStatus;
  type: 'invoice' | 'credit_note' | 'overpayment';
  amount: number;               // original total (inc. tax) in invoice currency
  amountPaid: number;
  amountDue: number;
  amountInBaseCurrency: number; // converted at platform's exchange rate
  currencyCode: string;
  baseCurrencyCode: string;
  exchangeRate: number;
  issueDate: Date;
  dueDate: Date;
  fullyPaidDate: Date | null;
  lineItems: LineItem[];
  platformRaw: Record<string, any>; // original API response for debugging
}

export interface QashivoContact {
  platformContactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  contactPersons: ContactPerson[];
  address: Address | null;
  taxNumber: string | null;
  platformRaw: Record<string, any>;
}

export interface QashivoCreditNote {
  platformCreditNoteId: string;
  platformContactId: string;
  amount: number;
  amountApplied: number;
  amountRemaining: number;
  status: string;
  issueDate: Date;
  platformRaw: Record<string, any>;
}

export interface QashivoOverpayment {
  platformOverpaymentId: string;
  platformContactId: string;
  amount: number;
  amountRemaining: number;
  status: string;
  date: Date;
  platformRaw: Record<string, any>;
}

export interface QashivoPrepayment {
  platformPrepaymentId: string;
  platformContactId: string;
  amount: number;
  amountRemaining: number;
  status: string;
  date: Date;
  platformRaw: Record<string, any>;
}

export interface QashivoBankTransaction {
  platformTransactionId: string;
  date: Date;
  amount: number;
  reference: string | null;
  contactName: string | null;
  platformContactId: string | null;
  isReconciled: boolean;
  platformRaw: Record<string, any>;
}

export interface QashivoPayment {
  platformPaymentId: string;
  platformInvoiceId: string;
  platformContactId: string | null;
  amount: number;
  date: Date;
  reference: string | null;
  isReconciled: boolean;
  platformRaw: Record<string, any>;
}

// ─── Auth Types ────────────────────────────────────────────────────────────

export interface AuthStatus {
  connected: boolean;
  tokenValid: boolean;
  tokenExpiresAt: Date | null;
  scopes: string[];
  platformOrgName: string | null;  // e.g., "Datum Creative Media Limited"
  platformOrgId: string | null;    // e.g., Xero tenant ID
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}

// ─── Webhook Types ─────────────────────────────────────────────────────────

export interface WebhookEvent {
  resourceType: 'invoice' | 'contact' | 'creditNote' | 'payment';
  resourceId: string;                // platform-specific ID
  eventType: 'create' | 'update' | 'delete';
  tenantPlatformId: string;          // platform's org/tenant ID
  timestamp: Date;
}

// ─── Sync Result Types ─────────────────────────────────────────────────────

export interface SyncResult {
  status: 'success' | 'partial' | 'failed' | 'skipped';
  syncMode: SyncMode;
  platform: string;
  tenantId: string;

  fetched: {
    invoices: number;
    contacts: number;
    creditNotes: number;
    overpayments: number;
    prepayments: number;
    payments: number;
    bankTransactions: number;
    apiCallsMade: number;
  };

  processed: {
    invoicesCreated: number;
    invoicesUpdated: number;
    statusChanges: number;
    paymentChangesDetected: number;
    contactsCreated: number;
    contactsUpdated: number;
    creditNotesProcessed: number;
  };

  startedAt: Date;
  completedAt: Date;
  durationMs: number;

  errors: string[];
  warnings: string[];
}

export interface ChangeSet {
  newInvoices: QashivoInvoice[];
  updatedInvoices: {
    invoice: QashivoInvoice;
    changes: { field: string; oldValue: any; newValue: any }[];
  }[];
  statusChanges: {
    invoiceId: string;
    contactId: string;
    oldStatus: QashivoInvoiceStatus;
    newStatus: QashivoInvoiceStatus;
  }[];
  paymentChanges: {
    invoiceId: string;
    contactId: string;
    previousAmountPaid: number;
    newAmountPaid: number;
    paymentAmount: number;
  }[];
}

// ─── Rate Limit Config ─────────────────────────────────────────────────────

export interface RateLimitConfig {
  requestsPerMinute: number;     // e.g., Xero: 60
  delayBetweenPages: number;     // ms, e.g., 1500
  retryAfter429: number;         // ms, e.g., 60000
}

// ─── Accounting Adapter Interface ──────────────────────────────────────────

/**
 * Every accounting platform implements this interface.
 * The adapter is deliberately thin — all operational intelligence
 * (retry, scheduling, state management, error escalation) lives
 * in the SyncOrchestrator.
 *
 * Adapters THROW on errors. They never catch and swallow.
 */
export interface AccountingAdapter {
  // ── Identity ──────────────────────────────────────────────
  readonly platformName: string;        // 'xero' | 'quickbooks' | 'sage'
  readonly platformDisplayName: string; // 'Xero' | 'QuickBooks Online' | 'Sage'

  // ── Authentication ────────────────────────────────────────
  getAuthStatus(tenantId: string): Promise<AuthStatus>;
  refreshToken(tenantId: string): Promise<TokenResult>;
  isTokenValid(tenantId: string): Promise<boolean>;
  readonly requiredScopes: string[];

  // ── Data Fetching (streaming pagination — spec 13.4) ──────
  // Each fetch method calls onPage for each page of results.
  // Returns FetchSummary with totals after all pages.
  // fetchedAt is captured BEFORE the first API call (spec 13.3).
  // Throws on API error — never returns empty on failure.

  fetchInvoices(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary>;

  fetchContacts(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary>;

  fetchCreditNotes(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary>;

  // Optional — not all platforms support these
  fetchPayments?(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary>;

  fetchBankTransactions?(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary>;

  fetchOverpayments?(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary>;

  fetchPrepayments?(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary>;

  // ── Single-Record Fetch (spec 13.12 — webhook efficiency) ─
  fetchInvoiceById?(tenantId: string, platformInvoiceId: string): Promise<any | null>;
  fetchContactById?(tenantId: string, platformContactId: string): Promise<any | null>;

  // ── Data Mapping (pure functions — no side effects) ───────
  mapInvoice(raw: any): QashivoInvoice;
  mapContact(raw: any): QashivoContact;
  mapCreditNote(raw: any): QashivoCreditNote;
  mapPayment?(raw: any): QashivoPayment;
  mapBankTransaction?(raw: any): QashivoBankTransaction;
  mapOverpayment?(raw: any): QashivoOverpayment;
  mapPrepayment?(raw: any): QashivoPrepayment;

  // Determine invoice status from platform-specific fields
  deriveInvoiceStatus(raw: any): QashivoInvoiceStatus;

  // ── Webhooks ──────────────────────────────────────────────
  verifyWebhookSignature(payload: Buffer, signature: string, secret: string): boolean;
  parseWebhookEvents(payload: any): WebhookEvent[];
  handleWebhookValidation?(req: Request, res: Response, secret: string): boolean;

  // ── Health ────────────────────────────────────────────────
  healthCheck(tenantId: string): Promise<boolean>;

  // ── Platform Configuration ────────────────────────────────
  readonly rateLimits: RateLimitConfig;
  readonly webhookResources: string[];
  readonly defaultHistoryMonths: number;
}
