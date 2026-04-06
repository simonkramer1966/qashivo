// ═══════════════════════════════════════════════════════════════════════════
// XeroAdapter — Xero-specific implementation of AccountingAdapter
// ═══════════════════════════════════════════════════════════════════════════
// Thin adapter. Makes API calls, maps fields, verifies webhooks.
// ALL operational logic (retry, state, scheduling) is in SyncOrchestrator.
// THROWS on errors — never catches and swallows.
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '../../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import type {
  AccountingAdapter,
  AuthStatus,
  TokenResult,
  FetchOptions,
  FetchSummary,
  QashivoInvoice,
  QashivoInvoiceStatus,
  QashivoContact,
  QashivoCreditNote,
  QashivoBankTransaction,
  ContactPerson,
  Address,
  LineItem,
  WebhookEvent,
  RateLimitConfig,
} from './types';

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';
const XERO_IDENTITY_BASE = 'https://identity.xero.com';

// Per-tenant mutex prevents concurrent token refresh races.
// Xero uses rotating refresh tokens — a second concurrent refresh
// would use the now-revoked old token and fail.
const refreshLocks = new Map<string, Promise<TokenResult>>();

interface TenantTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  xeroTenantId: string;
}

export class XeroAdapter implements AccountingAdapter {
  readonly platformName = 'xero';
  readonly platformDisplayName = 'Xero';
  readonly requiredScopes = [
    'openid', 'profile', 'email',
    'accounting.transactions', 'accounting.invoices',
    'accounting.contacts', 'accounting.settings',
    'offline_access',
  ];
  readonly rateLimits: RateLimitConfig = {
    requestsPerMinute: 60,
    delayBetweenPages: 1500,
    retryAfter429: 60000,
  };
  readonly webhookResources = ['invoices', 'contacts', 'creditNotes'];
  readonly defaultHistoryMonths = 24;

  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.XERO_CLIENT_ID || '';
    this.clientSecret = process.env.XERO_CLIENT_SECRET || '';
  }

  // ─── Authentication ──────────────────────────────────────────────────────

  async getAuthStatus(tenantId: string): Promise<AuthStatus> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant.xeroAccessToken || !tenant.xeroRefreshToken) {
      return {
        connected: false,
        tokenValid: false,
        tokenExpiresAt: null,
        scopes: [],
        platformOrgName: null,
        platformOrgId: null,
      };
    }

    const tokenValid = tenant.xeroExpiresAt
      ? !this.isExpired(tenant.xeroExpiresAt)
      : false;

    return {
      connected: true,
      tokenValid,
      tokenExpiresAt: tenant.xeroExpiresAt ?? null,
      scopes: this.requiredScopes,
      platformOrgName: tenant.xeroOrganisationName ?? null,
      platformOrgId: tenant.xeroTenantId ?? null,
    };
  }

  async refreshToken(tenantId: string): Promise<TokenResult> {
    // Mutex: if a refresh is already in progress, wait for it
    const lockKey = `xero:${tenantId}`;
    const existing = refreshLocks.get(lockKey);
    if (existing) {
      console.log(`[XeroAdapter] Token refresh already in progress for ${tenantId}, waiting...`);
      return existing;
    }

    const promise = this.doRefreshToken(tenantId).finally(() => {
      refreshLocks.delete(lockKey);
    });
    refreshLocks.set(lockKey, promise);
    return promise;
  }

  private async doRefreshToken(tenantId: string): Promise<TokenResult> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant.xeroRefreshToken) {
      throw new Error('No Xero refresh token available');
    }

    const response = await fetch(`${XERO_IDENTITY_BASE}/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tenant.xeroRefreshToken,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // Mark connection as expired so UI prompts reconnection
      await db.update(tenants)
        .set({ xeroConnectionStatus: 'expired' })
        .where(eq(tenants.id, tenantId));
      throw new Error(`Xero token refresh failed: ${response.status} — ${errorBody.substring(0, 500)}`);
    }

    const tokenData = await response.json();
    const result: TokenResult = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      scopes: this.requiredScopes,
    };

    // Persist new tokens
    await db.update(tenants).set({
      xeroAccessToken: result.accessToken,
      xeroRefreshToken: result.refreshToken,
      xeroExpiresAt: result.expiresAt,
      xeroConnectionStatus: 'connected',
    }).where(eq(tenants.id, tenantId));

    console.log(`[XeroAdapter] Token refreshed for tenant ${tenantId} (expires: ${result.expiresAt.toISOString()})`);
    return result;
  }

  async isTokenValid(tenantId: string): Promise<boolean> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant.xeroAccessToken || !tenant.xeroExpiresAt) return false;
    return !this.isExpired(tenant.xeroExpiresAt);
  }

  // ─── Data Fetching (streaming pagination) ────────────────────────────────

  async fetchInvoices(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary> {
    const fetchedAt = new Date(); // BEFORE first API call (spec 13.3)
    const tokens = await this.getTokens(tenantId);

    const whereClause = 'Type=="ACCREC"';
    let statusFilter = '';
    if (options.statuses?.length) {
      statusFilter = `&Statuses=${options.statuses.join(',')}`;
    }

    const headers: Record<string, string> = {};
    if (options.modifiedSince) {
      headers['If-Modified-Since'] = options.modifiedSince.toISOString();
    }

    let currentPage = 1;
    let totalCount = 0;
    let hasNextPage = true;

    while (hasNextPage) {
      const endpoint = `Invoices?where=${encodeURIComponent(whereClause)}${statusFilter}&page=${currentPage}`;
      const response = await this.makeApiCall(tokens, endpoint, tenantId, headers);
      const pageInvoices: any[] = response.Invoices || [];

      if (pageInvoices.length > 0) {
        await onPage(pageInvoices, currentPage);
        totalCount += pageInvoices.length;
      }

      hasNextPage = pageInvoices.length === 100;
      currentPage++;

      if (hasNextPage) {
        await this.rateDelay();
      }
    }

    return { totalCount, pagesFetched: currentPage - 1, fetchedAt };
  }

  async fetchContacts(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary> {
    // Contacts are fetched by IDs extracted from invoices, not paginated.
    // This method is used for bulk contact fetch during initial sync.
    const fetchedAt = new Date();
    const tokens = await this.getTokens(tenantId);

    const headers: Record<string, string> = {};
    if (options.modifiedSince) {
      headers['If-Modified-Since'] = options.modifiedSince.toISOString();
    }

    let currentPage = 1;
    let totalCount = 0;
    let hasNextPage = true;

    while (hasNextPage) {
      const endpoint = `Contacts?where=${encodeURIComponent('IsCustomer==true')}&page=${currentPage}`;
      const response = await this.makeApiCall(tokens, endpoint, tenantId, headers);
      const pageContacts: any[] = response.Contacts || [];

      if (pageContacts.length > 0) {
        await onPage(pageContacts, currentPage);
        totalCount += pageContacts.length;
      }

      hasNextPage = pageContacts.length === 100;
      currentPage++;

      if (hasNextPage) {
        await this.rateDelay();
      }
    }

    return { totalCount, pagesFetched: currentPage - 1, fetchedAt };
  }

  async fetchCreditNotes(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary> {
    const fetchedAt = new Date();
    const tokens = await this.getTokens(tenantId);

    let currentPage = 1;
    let totalCount = 0;
    let hasNextPage = true;

    while (hasNextPage) {
      const endpoint = `CreditNotes?where=${encodeURIComponent('Type=="ACCRECCREDIT"')}&page=${currentPage}`;
      const response = await this.makeApiCall(tokens, endpoint, tenantId);
      const pageCreditNotes: any[] = response.CreditNotes || [];

      if (pageCreditNotes.length > 0) {
        await onPage(pageCreditNotes, currentPage);
        totalCount += pageCreditNotes.length;
      }

      hasNextPage = pageCreditNotes.length === 100;
      currentPage++;

      if (hasNextPage) {
        await this.rateDelay();
      }
    }

    return { totalCount, pagesFetched: currentPage - 1, fetchedAt };
  }

  async fetchBankTransactions(
    tenantId: string,
    options: FetchOptions,
    onPage: (page: any[], pageNumber: number) => Promise<void>,
  ): Promise<FetchSummary> {
    const fetchedAt = new Date();
    const tokens = await this.getTokens(tenantId);

    // Only unreconciled RECEIVE transactions (for probable payment matching)
    const whereClause = 'Type=="RECEIVE"&&IsReconciled==false';
    let currentPage = 1;
    let totalCount = 0;
    let hasNextPage = true;

    while (hasNextPage) {
      const endpoint = `BankTransactions?where=${encodeURIComponent(whereClause)}&page=${currentPage}`;
      const response = await this.makeApiCall(tokens, endpoint, tenantId);
      const pageTxns: any[] = response.BankTransactions || [];

      if (pageTxns.length > 0) {
        await onPage(pageTxns, currentPage);
        totalCount += pageTxns.length;
      }

      hasNextPage = pageTxns.length === 100;
      currentPage++;

      if (hasNextPage) {
        await this.rateDelay();
      }
    }

    return { totalCount, pagesFetched: currentPage - 1, fetchedAt };
  }

  // ── Single-Record Fetch (spec 13.12 — webhook efficiency) ────────────

  async fetchInvoiceById(tenantId: string, platformInvoiceId: string): Promise<any | null> {
    const tokens = await this.getTokens(tenantId);
    try {
      const response = await this.makeApiCall(tokens, `Invoices/${platformInvoiceId}`, tenantId);
      return response.Invoices?.[0] ?? null;
    } catch {
      return null;
    }
  }

  async fetchContactById(tenantId: string, platformContactId: string): Promise<any | null> {
    const tokens = await this.getTokens(tenantId);
    try {
      const response = await this.makeApiCall(tokens, `Contacts/${platformContactId}`, tenantId);
      return response.Contacts?.[0] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch a batch of contacts by their Xero contact IDs.
   * Used by the orchestrator after extracting contact IDs from invoices.
   */
  async fetchContactsByIds(tenantId: string, contactIds: string[]): Promise<any[]> {
    const tokens = await this.getTokens(tenantId);
    const allContacts: any[] = [];
    const batchSize = 50; // Xero limit for IDs filter

    for (let i = 0; i < contactIds.length; i += batchSize) {
      const batch = contactIds.slice(i, i + batchSize);
      const idsParam = batch.join(',');
      const response = await this.makeApiCall(tokens, `Contacts?IDs=${idsParam}`, tenantId);
      allContacts.push(...(response.Contacts || []));

      if (i + batchSize < contactIds.length) {
        await this.rateDelay();
      }
    }

    return allContacts;
  }

  // ─── Data Mapping (pure functions) ───────────────────────────────────────

  mapInvoice(raw: any): QashivoInvoice {
    const amount = raw.Total ?? 0;
    const amountDue = raw.AmountDue ?? 0;
    const amountPaid = raw.AmountPaid ?? (amount - amountDue);
    const exchangeRate = raw.CurrencyRate ?? 1;
    const currencyCode = raw.CurrencyCode || 'GBP';

    return {
      platformInvoiceId: raw.InvoiceID,
      platformContactId: raw.Contact?.ContactID || '',
      invoiceNumber: raw.InvoiceNumber || `INV-${raw.InvoiceID?.substring(0, 8)}`,
      reference: raw.Reference || null,
      status: this.deriveInvoiceStatus(raw),
      type: 'invoice',
      amount,
      amountPaid,
      amountDue,
      amountInBaseCurrency: amount * exchangeRate,
      currencyCode,
      baseCurrencyCode: 'GBP', // Tenant base currency — Xero doesn't return this per-invoice
      exchangeRate,
      issueDate: this.parseXeroDate(raw.DateString || raw.Date),
      dueDate: this.parseXeroDate(raw.DueDateString || raw.DueDate || raw.DateString || raw.Date),
      fullyPaidDate: raw.FullyPaidOnDate ? this.parseXeroDate(raw.FullyPaidOnDate) : null,
      lineItems: (raw.LineItems || []).map((li: any): LineItem => ({
        description: li.Description || null,
        quantity: li.Quantity ?? 0,
        unitAmount: li.UnitAmount ?? 0,
        taxAmount: li.TaxAmount ?? 0,
        lineAmount: li.LineAmount ?? 0,
      })),
      platformRaw: raw,
    };
  }

  mapContact(raw: any): QashivoContact {
    const phones = raw.Phones || [];
    const defaultPhone = phones.find((p: any) => p.PhoneType === 'DEFAULT');
    const addresses = raw.Addresses || [];
    const street = addresses.find((a: any) => a.AddressType === 'STREET') || addresses[0];

    return {
      platformContactId: raw.ContactID,
      name: raw.Name || 'Unknown',
      email: raw.EmailAddress || null,
      phone: defaultPhone?.PhoneNumber || null,
      contactPersons: (raw.ContactPersons || []).map((cp: any): ContactPerson => ({
        firstName: cp.FirstName || '',
        lastName: cp.LastName || '',
        email: cp.EmailAddress || null,
        isPrimary: cp.IncludeInEmails ?? false,
      })),
      address: street ? {
        line1: street.AddressLine1 || null,
        line2: street.AddressLine2 || null,
        city: street.City || null,
        region: street.Region || null,
        postalCode: street.PostalCode || null,
        country: street.Country || null,
      } as Address : null,
      taxNumber: raw.TaxNumber || null,
      platformRaw: raw,
    };
  }

  mapCreditNote(raw: any): QashivoCreditNote {
    return {
      platformCreditNoteId: raw.CreditNoteID,
      platformContactId: raw.Contact?.ContactID || '',
      amount: raw.Total ?? 0,
      amountApplied: raw.AppliedAmount ?? 0,
      amountRemaining: raw.RemainingCredit ?? 0,
      status: raw.Status || 'UNKNOWN',
      issueDate: this.parseXeroDate(raw.DateString || raw.Date),
      platformRaw: raw,
    };
  }

  mapBankTransaction(raw: any): QashivoBankTransaction {
    return {
      platformTransactionId: raw.BankTransactionID,
      date: this.parseXeroDate(raw.DateString || raw.Date),
      amount: raw.Total ?? 0,
      reference: raw.Reference || null,
      contactName: raw.Contact?.Name || null,
      platformContactId: raw.Contact?.ContactID || null,
      isReconciled: raw.IsReconciled ?? false,
      platformRaw: raw,
    };
  }

  deriveInvoiceStatus(raw: any): QashivoInvoiceStatus {
    const xeroStatus = (raw.Status || '').toUpperCase();
    const amountPaid = raw.AmountPaid ?? 0;
    const total = raw.Total ?? 0;
    const amountDue = raw.AmountDue ?? 0;

    if (xeroStatus === 'PAID' || amountDue <= 0) return 'paid';
    if (xeroStatus === 'VOIDED' || xeroStatus === 'DELETED') return 'void';
    if (xeroStatus === 'DRAFT') return 'draft';

    // AUTHORISED or SUBMITTED with payment activity
    if (amountPaid > 0 && amountDue > 0) return 'partial';

    // Check if overdue
    const dueDate = this.parseXeroDate(raw.DueDateString || raw.DueDate || raw.DateString || raw.Date);
    if (dueDate < new Date()) return 'overdue';

    return 'pending';
  }

  // ─── Webhooks ────────────────────────────────────────────────────────────

  verifyWebhookSignature(payload: Buffer, signature: string, secret: string): boolean {
    const computed = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computed),
    );
  }

  parseWebhookEvents(payload: any): WebhookEvent[] {
    const events: WebhookEvent[] = [];
    for (const event of payload.events || []) {
      const resourceType = this.mapResourceType(event.resourceType);
      if (!resourceType) continue;

      events.push({
        resourceType,
        resourceId: event.resourceId,
        eventType: this.mapEventType(event.eventType),
        tenantPlatformId: event.tenantId,
        timestamp: new Date(event.eventDateUtc),
      });
    }
    return events;
  }

  handleWebhookValidation(req: any, res: any, secret: string): boolean {
    // Xero sends an intent-to-receive validation with empty events.
    // We must respond with the correct HMAC to prove we own the webhook key.
    const payload = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['x-xero-signature'] as string;

    if (!signature) {
      res.status(401).send('Missing signature');
      return true; // handled
    }

    const isValid = this.verifyWebhookSignature(
      Buffer.isBuffer(payload) ? payload : Buffer.from(payload),
      signature,
      secret,
    );

    if (!isValid) {
      res.status(401).send('Invalid signature');
      return true;
    }

    // Check if this is a validation request (empty events array)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body.events || body.events.length === 0) {
      res.status(200).send();
      return true; // handled — validation request, no processing needed
    }

    return false; // not a validation-only request, proceed with normal processing
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  async healthCheck(tenantId: string): Promise<boolean> {
    try {
      const tokens = await this.getTokens(tenantId);
      // Lightweight call — Organisation endpoint returns quickly
      await this.makeApiCall(tokens, 'Organisation', tenantId);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private async getTenant(tenantId: string) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
    return tenant;
  }

  private async getTokens(tenantId: string): Promise<TenantTokens> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant.xeroAccessToken || !tenant.xeroRefreshToken || !tenant.xeroTenantId) {
      throw new Error(`Xero not connected for tenant ${tenantId}`);
    }

    // Proactive refresh if token is expired or about to expire
    if (tenant.xeroExpiresAt && this.isExpired(tenant.xeroExpiresAt)) {
      console.log(`[XeroAdapter] Token expired for ${tenantId}, refreshing...`);
      const result = await this.refreshToken(tenantId);
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
        xeroTenantId: tenant.xeroTenantId,
      };
    }

    return {
      accessToken: tenant.xeroAccessToken,
      refreshToken: tenant.xeroRefreshToken,
      expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000),
      xeroTenantId: tenant.xeroTenantId,
    };
  }

  private async makeApiCall(
    tokens: TenantTokens,
    endpoint: string,
    tenantId: string,
    additionalHeaders?: Record<string, string>,
  ): Promise<any> {
    const url = `${XERO_API_BASE}/${endpoint}`;
    console.log(`[XeroAdapter] GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Xero-tenant-id': tokens.xeroTenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...additionalHeaders,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      const status = response.status;

      if (status === 429) {
        throw new Error(`XERO_RATE_LIMIT: 429 rate limit hit for ${endpoint}`);
      }
      if (status === 401 || status === 403) {
        throw new Error(`XERO_AUTH_ERROR: ${status} for ${endpoint} — ${errorText.substring(0, 500)}`);
      }
      throw new Error(`Xero API error: ${status} ${response.statusText} — ${errorText.substring(0, 500)}`);
    }

    return await response.json();
  }

  /** Check if token is expired with 2-minute buffer */
  private isExpired(expiresAt: Date): boolean {
    const bufferMs = 2 * 60 * 1000;
    return new Date(expiresAt).getTime() - bufferMs < Date.now();
  }

  /** Rate limit delay between paginated API calls */
  private async rateDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.rateLimits.delayBetweenPages));
  }

  /** Parse Xero date strings: ISO, .NET /Date(ms)/, or epoch ms */
  private parseXeroDate(value: string | number | null | undefined): Date {
    if (!value) return new Date();

    if (typeof value === 'string') {
      const dotNetMatch = value.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
      if (dotNetMatch) {
        return new Date(parseInt(dotNetMatch[1], 10));
      }
    }

    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      console.warn(`[XeroAdapter] Invalid date value "${value}", using current date`);
      return new Date();
    }
    return parsed;
  }

  private mapResourceType(xeroType: string): WebhookEvent['resourceType'] | null {
    switch (xeroType?.toLowerCase()) {
      case 'invoice': return 'invoice';
      case 'contact': return 'contact';
      case 'creditnote': return 'creditNote';
      case 'payment': return 'payment';
      default: return null;
    }
  }

  private mapEventType(xeroType: string): WebhookEvent['eventType'] {
    switch (xeroType?.toUpperCase()) {
      case 'CREATE': return 'create';
      case 'UPDATE': return 'update';
      case 'DELETE': return 'delete';
      default: return 'update';
    }
  }
}
