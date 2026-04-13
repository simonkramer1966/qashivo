# QASHIVO — SYNC ABSTRACTION LAYER SPECIFICATION

**Version:** 1.0 — 6 April 2026
**Purpose:** Replace all existing sync infrastructure with a clean, robust, platform-agnostic sync system
**Status:** Specification — not yet built
**Approach:** Clean sheet — delete all existing sync code and rebuild from scratch

---

## 1. WHY THIS EXISTS

The current sync infrastructure has accumulated four critical problems:

1. **Two competing sync systems** — SyncService (broken, hourly) and XeroSyncService (working, 15 min) both exist. One was never properly connected. Removed the broken one on 6 April but the working one is monolithic and Xero-specific.

2. **Silent error swallowing** — API fetch failures are caught and silently ignored. The sync reports "success" with 0 invoices fetched, then reprocesses stale cached data indefinitely. This caused 10 days of stale data while reporting healthy status.

3. **No platform abstraction** — All sync logic (retry, caching, state management, error handling) is entangled with Xero-specific API calls. Adding QuickBooks would require duplicating 2,000+ lines of operational code.

4. **No health monitoring** — No visibility into whether sync is actually working. The user sees "Last synced: 08:31" with no indication that the sync recycled stale data instead of fetching fresh data.

This specification replaces everything with a clean architecture designed for multi-platform support from day one.

---

## 2. ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────┐
│                     SyncOrchestrator                              │
│                                                                   │
│  Platform-agnostic. Handles ALL operational concerns:             │
│  - Scheduling (polling intervals, webhook dispatch)               │
│  - Retry with exponential backoff                                 │
│  - Consecutive failure tracking + health status                   │
│  - Sync state / cursor management (modifiedSince)                 │
│  - Rate limiting (respects per-platform limits)                   │
│  - Result logging (typed, never silent)                           │
│  - Freshness monitoring + alerts                                  │
│  - Pre-action verification                                        │
│  - Cache management (write to cached tables, then process)        │
│  - Error escalation (degrade → pause Charlie → alert user)        │
│                                                                   │
│  Does NOT know: how to call Xero, what a QuickBooks token         │
│  looks like, or how to map platform-specific invoice fields.      │
│                                                                   │
│  Calls: adapter.fetchInvoices(), adapter.mapInvoice(), etc.       │
└───────────────┬──────────────────────────────┬────────────────────┘
                │                              │
   ┌────────────┴────────────┐    ┌────────────┴────────────────┐
   │      XeroAdapter        │    │    QuickBooksAdapter         │
   │                         │    │                              │
   │  Xero-specific only:    │    │  QB-specific only:           │
   │  - OAuth2 + token mgmt  │    │  - OAuth2 + token mgmt      │
   │  - API endpoint calls    │    │  - API endpoint calls        │
   │  - Field mapping         │    │  - Field mapping             │
   │  - Webhook verification  │    │  - Webhook verification      │
   │  - Rate limit params     │    │  - Rate limit params         │
   │                         │    │                              │
   │  ~300 lines             │    │  ~300 lines                  │
   └─────────────────────────┘    └──────────────────────────────┘
```

The adapter is deliberately thin. All intelligence lives in the orchestrator.

---

## 3. ADAPTER INTERFACE

Every accounting platform implements this interface:

```typescript
interface AccountingAdapter {
  // Identity
  readonly platformName: string;        // 'xero' | 'quickbooks' | 'sage'
  readonly platformDisplayName: string;  // 'Xero' | 'QuickBooks Online' | 'Sage'

  // ─── Authentication ────────────────────────────────────
  
  // Get current auth status for a tenant
  getAuthStatus(tenantId: string): Promise<AuthStatus>;
  
  // Refresh the access token. Throws on failure.
  refreshToken(tenantId: string): Promise<TokenResult>;
  
  // Check if the current token is valid (without calling API)
  isTokenValid(tenantId: string): boolean;
  
  // Get the OAuth scopes this adapter requires
  readonly requiredScopes: string[];

  // ─── Data Fetching ─────────────────────────────────────
  // All fetch methods return raw platform-specific data.
  // The orchestrator handles retry/error — adapters just 
  // make the API call and return or throw.
  
  // Fetch invoices, optionally modified since a date.
  // Must handle pagination internally and return all pages.
  // Throws on API error — never returns empty on failure.
  fetchInvoices(
    tenantId: string, 
    options: FetchOptions
  ): Promise<RawFetchResult<RawInvoice>>;
  
  // Fetch contacts, optionally modified since a date.
  fetchContacts(
    tenantId: string, 
    options: FetchOptions
  ): Promise<RawFetchResult<RawContact>>;
  
  // Fetch credit notes / overpayments
  fetchCreditNotes(
    tenantId: string, 
    options: FetchOptions
  ): Promise<RawFetchResult<RawCreditNote>>;
  
  // Fetch payment records (if platform supports direct 
  // payment API). Optional — some platforms only expose 
  // payments via invoice status changes.
  fetchPayments?(
    tenantId: string, 
    options: FetchOptions
  ): Promise<RawFetchResult<RawPayment>>;
  
  // Fetch bank transactions (for probable payment detection).
  // Optional — not all platforms expose this.
  fetchBankTransactions?(
    tenantId: string, 
    options: FetchOptions
  ): Promise<RawFetchResult<RawBankTransaction>>;
  
  // Health check — make a lightweight API call to verify 
  // the connection is alive. Returns true/false, never throws.
  healthCheck(tenantId: string): Promise<boolean>;

  // ─── Data Mapping ──────────────────────────────────────
  // Transform platform-specific data into Qashivo's schema.
  // Pure functions — no side effects, no API calls.
  
  mapInvoice(raw: RawInvoice): QashivoInvoice;
  mapContact(raw: RawContact): QashivoContact;
  mapCreditNote(raw: RawCreditNote): QashivoCreditNote;
  mapPayment?(raw: RawPayment): QashivoPayment;
  mapBankTransaction?(raw: RawBankTransaction): QashivoBankTransaction;
  
  // Determine invoice status from platform-specific fields.
  // Must return a Qashivo status, not a platform status.
  deriveInvoiceStatus(raw: RawInvoice): QashivoInvoiceStatus;

  // ─── Webhooks ──────────────────────────────────────────
  
  // Verify a webhook signature. Returns true if valid.
  verifyWebhookSignature(
    payload: Buffer, 
    signature: string, 
    secret: string
  ): boolean;
  
  // Parse a webhook payload into typed events.
  parseWebhookEvents(payload: any): WebhookEvent[];
  
  // Handle the platform's intent-to-receive validation.
  // Some platforms (Xero) require a specific response format.
  handleWebhookValidation?(
    req: Request, 
    res: Response, 
    secret: string
  ): boolean;

  // ─── Platform Configuration ────────────────────────────
  
  // Rate limiting parameters for this platform
  readonly rateLimits: {
    requestsPerMinute: number;       // e.g., Xero: 60
    delayBetweenPages: number;       // ms, e.g., 1500
    retryAfter429: number;           // ms, e.g., 60000
  };
  
  // Which resources support webhooks on this platform
  readonly webhookResources: string[];  // e.g., ['invoices', 'contacts', 'creditNotes']
  
  // Default sync window for initial sync (months of history)
  readonly defaultHistoryMonths: number;  // e.g., 24
}
```

### Supporting Types

```typescript
interface FetchOptions {
  modifiedSince?: Date;          // null = fetch all
  statuses?: string[];           // platform-specific status filters
  includeArchived?: boolean;     // default false
  pageSize?: number;             // override default page size
}

interface RawFetchResult<T> {
  data: T[];                     // the raw records
  totalCount: number;            // total available (for logging)
  pagesFetched: number;          // API calls made
  hasMore: boolean;              // pagination incomplete?
  fetchedAt: Date;               // timestamp of fetch
}

type QashivoInvoiceStatus = 
  | 'pending'      // not yet due
  | 'overdue'      // past due date
  | 'paid'         // fully paid
  | 'partial'      // partially paid
  | 'void'         // voided/cancelled
  | 'draft';       // not yet issued

interface AuthStatus {
  connected: boolean;
  tokenValid: boolean;
  tokenExpiresAt: Date | null;
  scopes: string[];
  platformOrgName: string | null;  // e.g., "Datum Creative Media Limited"
  platformOrgId: string | null;    // e.g., Xero tenant ID
}

interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}

interface WebhookEvent {
  resourceType: 'invoice' | 'contact' | 'creditNote' | 'payment';
  resourceId: string;             // platform-specific ID
  eventType: 'create' | 'update' | 'delete';
  tenantPlatformId: string;       // platform's org/tenant ID
  timestamp: Date;
}

// Qashivo canonical types (what gets written to the DB)
interface QashivoInvoice {
  platformInvoiceId: string;      // Xero invoice ID, QB invoice ID, etc.
  platformContactId: string;
  invoiceNumber: string;
  reference: string | null;
  status: QashivoInvoiceStatus;
  type: 'invoice' | 'credit_note' | 'overpayment';
  amount: number;                  // original total (inc. tax)
  amountPaid: number;
  amountDue: number;               // amount - amountPaid
  currencyCode: string;
  issueDate: Date;
  dueDate: Date;
  fullyPaidDate: Date | null;
  lineItems: LineItem[];           // optional, for future use
  platformRaw: Record<string, any>; // original API response for debugging
}

interface QashivoContact {
  platformContactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  contactPersons: ContactPerson[];
  address: Address | null;
  taxNumber: string | null;
  platformRaw: Record<string, any>;
}

interface QashivoCreditNote {
  platformCreditNoteId: string;
  platformContactId: string;
  amount: number;
  amountApplied: number;
  amountRemaining: number;
  status: string;
  issueDate: Date;
  platformRaw: Record<string, any>;
}

interface QashivoBankTransaction {
  platformTransactionId: string;
  date: Date;
  amount: number;
  reference: string | null;
  contactName: string | null;
  platformContactId: string | null;
  isReconciled: boolean;
  platformRaw: Record<string, any>;
}
```

---

## 4. SYNC ORCHESTRATOR

The orchestrator is the brain. It handles everything that isn't platform-specific.

### 4.1 Sync Modes

```typescript
type SyncMode = 
  | 'initial'       // First sync after connection — full history pull
  | 'incremental'   // Regular ongoing sync — modifiedSince cursor
  | 'force'         // User-triggered full re-pull — ignores cursor
  | 'webhook'       // Triggered by webhook event — targeted sync
  | 'reconciliation'; // Weekly full comparison sweep
```

### 4.2 Sync Lifecycle

Every sync follows this exact sequence. No shortcuts, no silent failures.

```
1. PRE-SYNC CHECKS
   ├── Is the tenant's connection active?
   ├── Is the token valid? If not, refresh (with mutex).
   ├── Is another sync already in progress for this tenant? (prevent overlap)
   └── Set sync status to 'running'

2. FETCH FROM PLATFORM (via adapter)
   ├── Call adapter.fetchInvoices(tenantId, options)
   ├── Call adapter.fetchContacts(tenantId, options)
   ├── Call adapter.fetchCreditNotes(tenantId, options)
   ├── Optionally: adapter.fetchPayments(), adapter.fetchBankTransactions()
   ├── Respect rate limits between calls
   ├── If ANY fetch throws → catch, log at ERROR level, set sync to FAILED
   └── NEVER continue with stale data on fetch failure

3. MAP TO QASHIVO SCHEMA (via adapter)
   ├── adapter.mapInvoice(raw) for each invoice
   ├── adapter.mapContact(raw) for each contact
   ├── adapter.deriveInvoiceStatus(raw) for status determination
   └── Pure transformation — no side effects

4. WRITE TO CACHE TABLES
   ├── Upsert to cached_platform_invoices (raw data archive)
   ├── Track what changed: new, updated, status_changed, amount_changed
   └── This is the "what did we get from the platform" record

5. PROCESS CACHE → MAIN TABLES
   ├── Upsert to invoices table (mapped data)
   ├── Upsert to contacts table (mapped data)
   ├── NEVER overwrite AR overlay fields (arContactEmail, arContactPhone, etc.)
   ├── Detect payment changes: compare old amount_paid vs new
   ├── Detect status transitions: unpaid → paid, active → void
   ├── Create timeline events for significant changes (payment received, etc.)
   └── Emit SSE events for real-time UI updates

6. POST-SYNC
   ├── Update sync cursor (modifiedSince = now)
   ├── Update lastSuccessfulSyncAt
   ├── Reset consecutiveSyncFailures to 0
   ├── Calculate and log sync result (typed, with counts)
   ├── Queue debtor scoring job if invoices changed
   ├── Queue AR recalculation if amounts changed
   └── Set sync status to 'completed'

7. ON FAILURE (at any step)
   ├── Log error at ERROR level with full context
   ├── Increment consecutiveSyncFailures
   ├── Set sync status to 'failed'
   ├── Store lastSyncError message
   ├── Schedule retry with backoff
   ├── If 6+ consecutive failures: pause Charlie for this tenant
   └── NEVER set status to 'completed' if data wasn't actually fetched
```

### 4.3 Sync Result Type

Every sync produces this result. No exceptions.

```typescript
interface SyncResult {
  status: 'success' | 'partial' | 'failed';
  syncMode: SyncMode;
  platform: string;
  tenantId: string;
  
  // What was fetched from the platform
  fetched: {
    invoices: number;
    contacts: number;
    creditNotes: number;
    payments: number;
    bankTransactions: number;
    apiCallsMade: number;
  };
  
  // What changed in Qashivo's database
  processed: {
    invoicesCreated: number;
    invoicesUpdated: number;
    statusChanges: number;          // e.g., unpaid → paid
    paymentChangesDetected: number;
    contactsCreated: number;
    contactsUpdated: number;
    creditNotesProcessed: number;
  };
  
  // Timing
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  
  // Errors (even on success, there may be warnings)
  errors: string[];
  warnings: string[];
}
```

**Critical rule:** If `fetched.invoices === 0` and `fetched.apiCallsMade === 0`, the result is NEVER `success`. This is either `failed` (API wasn't called) or `partial` (API was called but returned empty — legitimate for a brand new Xero org).

### 4.4 Retry and Backoff

```typescript
const RETRY_SCHEDULE = [
  { delay: 2 * 60 * 1000, label: '2 minutes' },     // 1st retry
  { delay: 5 * 60 * 1000, label: '5 minutes' },     // 2nd retry
  { delay: 15 * 60 * 1000, label: '15 minutes' },   // 3rd retry
  // After 3 retries: wait for next scheduled sync cycle
];

// On 429 (rate limit): use platform-specific retryAfter
// On 401 (auth): refresh token and retry once
// On 5xx (server error): use retry schedule
// On network error: use retry schedule
// On 403 (forbidden): log and skip this resource (e.g., bank transactions scope issue)
//   — do NOT fail the entire sync for a 403 on an optional resource
```

### 4.5 Token Refresh Mutex

```typescript
// Per-tenant, per-platform mutex prevents concurrent refresh races
const refreshLocks = new Map<string, Promise<TokenResult>>();

async function refreshTokenSafe(
  adapter: AccountingAdapter, 
  tenantId: string
): Promise<TokenResult> {
  const key = `${adapter.platformName}:${tenantId}`;
  
  if (refreshLocks.has(key)) {
    return refreshLocks.get(key)!;  // Wait for in-progress refresh
  }
  
  const refreshPromise = adapter.refreshToken(tenantId)
    .finally(() => refreshLocks.delete(key));
  
  refreshLocks.set(key, refreshPromise);
  return refreshPromise;
}
```

### 4.6 Health Status

```typescript
type SyncHealthStatus = 'healthy' | 'degraded' | 'failed' | 'disconnected';

// Derived from:
// - consecutiveSyncFailures
// - lastSuccessfulSyncAt
// - token validity
// - webhook activity

function deriveSyncHealth(state: TenantSyncState): SyncHealthStatus {
  if (!state.tokenValid) return 'disconnected';
  if (state.consecutiveFailures >= 6) return 'failed';
  if (state.consecutiveFailures >= 3) return 'degraded';
  if (state.lastSuccessfulSyncAt < sixHoursAgo()) return 'degraded';
  return 'healthy';
}
```

---

## 5. SYNC SCHEDULING

### 5.1 Polling Schedule

```
┌────────────────┬──────────────────┬──────────────────────────────────────┐
│   Sync Mode    │     Interval     │              Trigger                 │
├────────────────┼──────────────────┼──────────────────────────────────────┤
│ Incremental    │ Every 4 hours    │ Cron (safety net behind webhooks)    │
├────────────────┼──────────────────┼──────────────────────────────────────┤
│ Webhook        │ Near real-time   │ Platform webhook event               │
├────────────────┼──────────────────┼──────────────────────────────────────┤
│ Reconciliation │ Weekly (Sunday)  │ Cron — full re-pull + comparison     │
├────────────────┼──────────────────┼──────────────────────────────────────┤
│ Force          │ User-triggered   │ "Force Sync" button                  │
├────────────────┼──────────────────┼──────────────────────────────────────┤
│ Health check   │ Every 20 minutes │ Cron — lightweight API ping          │
└────────────────┴──────────────────┴──────────────────────────────────────┘
```

### 5.2 Webhook Dispatch

When a webhook arrives:

```
1. Verify signature (via adapter.verifyWebhookSignature)
2. Respond 200 immediately (within 5 seconds — platform requirement)
3. Parse events (via adapter.parseWebhookEvents)
4. Group events by tenant
5. For each tenant: trigger incremental sync (async, fire-and-forget)
6. Track lastWebhookReceivedAt for health monitoring
```

### 5.3 Webhook Health Monitoring

```
If no webhook received for 4+ hours AND tenant has active connection:
  → Log warning: "No webhooks received in 4 hours for tenant X"
  → Increase polling frequency temporarily (every 1 hour instead of 4)
  → After 24 hours without webhooks: alert user on Integrations page

If webhooks resume:
  → Reset polling to normal 4-hour interval
  → Clear alert
```

---

## 6. DATA FLOW

### 6.1 Two-Tier Data Model

```
Platform API → cached_invoices table (raw archive)
                       ↓
              Mapping + status derivation
                       ↓
              invoices table (Qashivo enriched)
              + AR overlay fields PRESERVED
              + debtor scoring triggered
              + timeline events created
              + SSE events emitted
```

**Cache table:** Raw platform data, stored exactly as received. Used for debugging and reprocessing if mapping logic changes. Columns include platformRaw (JSONB) for the complete API response.

**Main table:** Qashivo's enriched data. Includes AR overlay fields (arContactEmail, arContactPhone, arContactName, arNotes) that are NEVER overwritten by sync. These are Qashivo's proprietary data.

### 6.2 AR Overlay Protection

```typescript
// When upserting contacts from sync, EXCLUDE these fields:
const AR_OVERLAY_FIELDS = [
  'arContactEmail',
  'arContactPhone', 
  'arContactName',
  'arNotes',
  // Also exclude all customerPreferences fields
  // Also exclude all customerLearningProfiles fields
];

// The upsert update clause must explicitly list only 
// platform-sourced fields. Never use a blanket update.
```

### 6.3 Status Derivation

Status is derived from platform data + Qashivo logic, not stored raw from the platform:

```typescript
// In the orchestrator, after adapter.mapInvoice():
function deriveStatus(invoice: QashivoInvoice): QashivoInvoiceStatus {
  if (invoice.amountDue <= 0) return 'paid';
  if (invoice.status === 'void') return 'void';
  if (invoice.status === 'draft') return 'draft';
  if (invoice.amountPaid > 0 && invoice.amountDue > 0) return 'partial';
  if (new Date(invoice.dueDate) < new Date()) return 'overdue';
  return 'pending';
}
```

This ensures consistent status semantics regardless of which platform the data came from. Xero says "AUTHORISED", QuickBooks says "Open" — both map to either "pending" or "overdue" based on due date.

### 6.4 Change Detection

On each sync, the orchestrator detects and logs changes:

```typescript
interface ChangeSet {
  newInvoices: QashivoInvoice[];
  updatedInvoices: {
    invoice: QashivoInvoice;
    changes: {
      field: string;
      oldValue: any;
      newValue: any;
    }[];
  }[];
  statusChanges: {
    invoiceId: string;
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
```

Payment changes trigger:
- Timeline event: "Payment of £X received"
- SSE event: `{ type: 'payment_received', contactId, amount }`
- Probable payment matching (if Gap 14 is active)
- Debtor re-scoring

Status changes to 'paid' trigger:
- Cancel any pending/scheduled actions for this debtor (if all invoices now paid)
- Timeline event: "Invoice £X fully paid"

---

## 7. SYNC STATE SCHEMA

```typescript
// New table: sync_state (replaces scattered sync tracking)
syncState {
  id: uuid (PK)
  tenantId: uuid (FK → tenants)
  platform: varchar           // 'xero' | 'quickbooks' | 'sage'
  
  // Sync cursors
  invoicesCursor: timestamp   // modifiedSince for invoices
  contactsCursor: timestamp   // modifiedSince for contacts
  creditNotesCursor: timestamp
  
  // Health
  lastSyncMode: varchar       // 'initial' | 'incremental' | 'force' | 'webhook'
  lastSyncStartedAt: timestamp
  lastSyncCompletedAt: timestamp
  lastSuccessfulSyncAt: timestamp
  lastSyncResult: jsonb       // full SyncResult object
  lastSyncError: varchar
  syncStatus: varchar         // 'idle' | 'running' | 'failed'
  
  // Failure tracking
  consecutiveFailures: integer (default 0)
  syncHealthStatus: varchar   // 'healthy' | 'degraded' | 'failed' | 'disconnected'
  
  // Webhook tracking
  lastWebhookReceivedAt: timestamp
  webhookHealthy: boolean (default true)
  
  // Counts (for quick reference)
  totalInvoicesSynced: integer
  totalContactsSynced: integer
  
  createdAt, updatedAt
}
```

---

## 8. INTEGRATIONS PAGE DISPLAY

The Integrations page should show:

```
┌─────────────────────────────────────────────────────────────────┐
│ Xero                                             ● Connected    │
│ Datum Creative Media Limited                                    │
│                                                                 │
│ Sync status:    Healthy ✓                                       │
│ Last sync:      2 minutes ago (webhook — 3 invoices updated)    │
│ Webhooks:       Active (last received: 2 min ago) ✓             │
│ Next poll:      In 3 hours 58 minutes                           │
│ Data freshness: Current ✓                                       │
│                                                                 │
│ Invoices synced:  8,452    Contacts: 813                        │
│                                                                 │
│ [Sync Now]  [Force Sync]  [Disconnect]                          │
└─────────────────────────────────────────────────────────────────┘

-- or in degraded state --

┌─────────────────────────────────────────────────────────────────┐
│ Xero                                             ⚠ Degraded     │
│ Datum Creative Media Limited                                    │
│                                                                 │
│ Sync status:    Degraded — 3 consecutive failures  ⚠            │
│ Last sync:      45 minutes ago (incremental — failed)           │
│ Last error:     "Token refresh failed — 401 Unauthorized"       │
│ Webhooks:       Inactive (last received: 3 hours ago) ⚠         │
│ Retry in:       5 minutes                                       │
│ Charlie status: Active (data still within freshness window)     │
│                                                                 │
│ [Retry Now]  [Reconnect Xero]                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. WHAT GETS DELETED

When building the abstraction layer, remove ALL of the following:

```
DELETE:
├── server/services/xeroSync.ts          (entire file — replaced by XeroAdapter + Orchestrator)
├── server/services/syncService.ts       (already partially removed — finish the job)
├── server/services/syncScheduler.ts     (replaced by Orchestrator scheduling)
├── server/services/xeroHealthCheck.ts   (health check moves into Orchestrator)
├── server/routes/syncRoutes.ts          (replaced by Orchestrator webhook handling)
├── Webhook handler in server/index.ts   (moves into Orchestrator)
├── All syncState-related columns scattered across tenants table
└── The provider_connections table (if only used by dead SyncService)

KEEP:
├── server/services/xero.ts              (OAuth flows, token storage — becomes part of XeroAdapter)
├── server/services/arCalculations.ts    (AR logic — unchanged, consumes invoices table)
├── cached_xero_invoices table           (renamed to cached_platform_invoices)
├── invoices table                       (unchanged — the main table)
├── contacts table                       (unchanged — with AR overlay protection)
└── All AR overlay fields               (SACRED — never touched)

CREATE:
├── server/sync/SyncOrchestrator.ts      (the brain — ~500 lines)
├── server/sync/adapters/XeroAdapter.ts  (thin Xero adapter — ~300 lines)
├── server/sync/adapters/types.ts        (shared interfaces — ~150 lines)
├── server/sync/adapters/QuickBooksAdapter.stub.ts  (proves the interface works — ~50 lines)
├── server/sync/syncState.ts             (sync state management — ~100 lines)
├── server/sync/webhookRouter.ts         (platform-agnostic webhook dispatch — ~100 lines)
└── Database: sync_state table           (single source of truth for sync health)
```

---

## 10. NON-NEGOTIABLE RULES

These rules are absolute and must be enforced in code review:

1. **No silent error swallowing.** Every catch block must either re-throw or log at ERROR level AND mark the sync as failed/partial. The pattern `catch (e) { hasNextPage = false }` is permanently banned.

2. **No sync reports success without API data.** If `apiCallsMade === 0`, the sync did not succeed. Period.

3. **AR overlay fields are never overwritten.** The contact upsert must use an explicit field list, never a blanket update. Test this with a specific integration test.

4. **Token refresh is always mutex-protected.** Two concurrent refresh attempts for the same tenant must be impossible.

5. **Every sync produces a typed SyncResult.** No sync completes without logging a full result including counts, duration, and any errors.

6. **The freshness guard is non-negotiable.** If lastSuccessfulSyncAt > 6 hours, Charlie does not generate actions for that tenant.

7. **Webhook failures don't break sync.** If webhooks stop, polling continues. If polling fails, webhooks continue. Both can fail for up to 6 hours before Charlie pauses.

8. **Force Sync always calls the API.** A force sync that processes only cached data is a bug, not a feature.

9. **Optional resources don't fail the sync.** If bank transactions return 403, log it and continue. The invoice and contact sync must still succeed.

10. **Status is derived, not stored raw.** Platform-specific statuses (AUTHORISED, Open, etc.) are mapped to Qashivo statuses (pending, overdue, paid) using consistent logic regardless of platform.

---

## 11. BUILD ORDER

```
Phase 1: Types and interface (day 1 morning)
  - Define all types in adapters/types.ts
  - Define AccountingAdapter interface
  - Define SyncResult, SyncMode, SyncState types

Phase 2: XeroAdapter (day 1 afternoon)
  - Extract Xero-specific code from xeroSync.ts
  - Implement all AccountingAdapter methods
  - Test: adapter.fetchInvoices() returns real Xero data
  - Test: adapter.mapInvoice() produces correct QashivoInvoice

Phase 3: SyncOrchestrator core (day 2 morning)
  - Sync lifecycle (steps 1-7 from section 4.2)
  - Retry with backoff
  - SyncResult logging
  - Cache → main table processing
  - AR overlay protection

Phase 4: Scheduling + webhooks (day 2 afternoon)
  - Polling scheduler (4 hour interval)
  - Webhook router + dispatch
  - Health monitoring
  - Freshness guard integration

Phase 5: Cleanup + verification (day 2 evening)
  - Delete all old sync code
  - Run full sync, verify numbers match Xero
  - Verify webhooks fire and trigger sync
  - Verify health status displays correctly
  - Update CLAUDE.md with new architecture

Phase 6: QuickBooks stub (future — proves the interface)
  - QuickBooksAdapter.stub.ts with placeholder methods
  - Verify it compiles against the interface
  - No API calls — just proves extensibility
```

---

## 12. TESTING CHECKLIST

Before declaring the abstraction layer complete:

- [ ] Force Sync pulls fresh data from Xero API (not cached)
- [ ] Invoice counts match Xero aged receivables report
- [ ] Outstanding amounts match Xero (within £10 for rounding)
- [ ] Paid invoices in Xero show as paid in Qashivo
- [ ] New invoices in Xero appear in Qashivo within 5 minutes (via webhook)
- [ ] AR overlay fields survive a force sync (test: set arContactEmail, force sync, verify it persists)
- [ ] A Xero API failure results in sync status 'failed' (not 'success')
- [ ] 3 consecutive failures set health to 'degraded'
- [ ] 6 consecutive failures pause Charlie
- [ ] Token refresh mutex prevents concurrent refreshes
- [ ] Webhook signature verification works
- [ ] Webhook triggers immediate sync
- [ ] Integrations page shows accurate health status
- [ ] Weekly reconciliation detects discrepancies
- [ ] Bank transaction 403 doesn't fail the invoice sync

---

## 13. CTO REVIEW — ADDITIONAL REQUIREMENTS

The following requirements were identified during expert review and are mandatory for a world-class implementation.

### 13.1 Idempotency

Every sync operation must be idempotent. If a sync crashes halfway through processing, the retry must produce the same end state.

- Cache writes: upsert by platformInvoiceId, never insert-only. Duplicate webhook events produce no-ops.
- Main table processing: wrap step 4 (cache write) and step 5 (main table upsert) in a database transaction. If step 5 fails on invoice 150 of 200, the entire batch rolls back and retries cleanly.
- At current scale (hundreds of invoices), full-batch transactions are fine. At scale (10,000+), batch into chunks of 50 with per-chunk transactions and a processed-chunk cursor.

### 13.2 Webhook Deduplication

Webhooks are at-least-once delivery. Duplicates will arrive. Add:

```
webhook_event_log {
  id: uuid
  platformEventId: string
  tenantId: uuid
  receivedAt: timestamp
  processed: boolean
  UNIQUE(platformEventId, tenantId)
}
```

Before processing, check if platformEventId already exists. If yes, skip. Prune after 7 days.

### 13.3 Pagination Cursor Safety

When paginating through platform APIs, data can change between pages. An invoice on page 1 can get paid while fetching page 3.

Fix: the adapter's fetchInvoices must return a `fetchStartedAt` timestamp (captured BEFORE the first API call). The orchestrator sets the modifiedSince cursor to `fetchStartedAt`, not `completedAt`. This ensures the next incremental sync re-fetches anything that changed during the pagination window.

### 13.4 Streaming Pagination

Replace the batch-return pattern with a page-at-a-time callback:

```typescript
fetchInvoices(
  tenantId: string,
  options: FetchOptions,
  onPage: (page: RawInvoice[], pageNumber: number) => Promise<void>
): Promise<FetchSummary>;
```

The orchestrator processes each page as it arrives — map, cache-write, main-table-upsert. Memory stays flat regardless of dataset size. FetchSummary returns totals after all pages.

### 13.5 Multi-Currency

AR calculations must sum in the tenant's base currency. Add to QashivoInvoice:

```typescript
amount: number;                // in invoice currency
amountInBaseCurrency: number;  // converted at platform's rate
currencyCode: string;
baseCurrencyCode: string;
exchangeRate: number;
```

Xero, QuickBooks, and Sage all provide these fields. getARSummary() uses amountInBaseCurrency exclusively.

### 13.6 Deleted Invoice Detection

Deleted invoices disappear from the platform API — modifiedSince won't return them. Handle via:

- Weekly reconciliation: compare all Qashivo invoice IDs against all platform invoice IDs. Anything in Qashivo but not in the platform → soft-delete (set status to 'deleted', set deletedAt timestamp, never hard-delete).
- AR calculations already exclude 'deleted' status.

### 13.7 Reconciliation Detail

The weekly reconciliation must:

```
1. Fetch ALL active invoice IDs + AmountDue from platform
2. Fetch ALL active invoice IDs + (amount - amount_paid) from Qashivo
3. Compare:
   a. In platform, not Qashivo → missing invoices → fetch individually
   b. In Qashivo, not platform → deleted/paid → update status
   c. Amount mismatches → stale payment data → re-fetch and update
4. Log discrepancy count and total value
5. If discrepancy > £100 or > 2 invoices: create alert
6. Auto-fix by fetching the specific mismatched invoices
```

### 13.8 Connection Lifecycle

**Initial connection:** OAuth completes → orchestrator runs initial sync (full 24-month pull). UI shows progress banner ("Syncing... 1,200 of 3,400 invoices"). Non-blocking — user can navigate while sync runs.

**Disconnection:** User clicks Disconnect or token refresh permanently fails (60-day refresh token expiry). All sync stops. Charlie pauses. Existing data preserved. User sees "Reconnect" prompt.

**Reconnection after gap:** Orchestrator detects "last successful sync was 15 days ago" and runs a force sync (full pull), not incremental.

**Platform switch:** User disconnects Xero, connects QuickBooks. Xero data preserved as historical (stop syncing, don't delete). QuickBooks adapter starts fresh. Contact matching by name links debtors across platforms where possible.

### 13.9 Tenant Isolation

Non-negotiable: every database query in the sync pipeline must include `WHERE tenant_id = ?`. No exceptions.

The webhook router must verify that the platform's tenant/org ID in the webhook payload matches the Qashivo tenant's stored platform org ID. A misconfigured or malicious webhook must never write data to the wrong tenant.

The adapter must never have access to data from other tenants. The orchestrator passes tenantId explicitly to every adapter method.

### 13.10 Sync Audit Log

For acquisition due diligence, maintain a complete history:

```
sync_audit_log {
  id: uuid
  tenantId: uuid
  platform: varchar
  syncMode: varchar
  result: jsonb           // full SyncResult object
  startedAt: timestamp
  completedAt: timestamp
  triggeredBy: varchar    // 'webhook' | 'schedule' | 'user' | 'reconnect'
  invoicesFetched: integer
  changesDetected: integer
  errors: text[]
}
```

Retain for 12 months. This proves to a buyer that sync infrastructure is reliable and self-healing.

### 13.11 Backpressure and Queue Management

At 4,000 tenants syncing every 4 hours = ~17 syncs/minute. Each makes 5-10 API calls = 85-170 calls/minute.

Add a sync queue with concurrency control:

```typescript
syncQueue: {
  maxConcurrency: 10,
  priority: ['webhook', 'force', 'incremental', 'reconciliation'],
  tenantCooldown: 60_000,  // min 1 min between syncs per tenant
}
```

Webhook-triggered syncs always take priority. Scheduled syncs process through the queue. No tenant gets starved; no platform gets hammered.

### 13.12 Single-Record Fetch

For webhook efficiency, add a targeted fetch method to the adapter interface:

```typescript
fetchInvoiceById(
  tenantId: string,
  platformInvoiceId: string
): Promise<RawInvoice | null>;

fetchContactById(
  tenantId: string,
  platformContactId: string
): Promise<RawContact | null>;
```

When a webhook says "invoice X updated", fetch just that invoice instead of running a full incremental sync. Far more efficient for high-frequency webhook environments.

### 13.13 Rate Limiting in the Orchestrator

Rate limiting must be orchestrator-level, not adapter-level, because multiple tenants share the same platform app rate limit.

```typescript
class PlatformRateLimiter {
  private queues: Map<string, RequestQueue>;  // keyed by platform name

  async execute<T>(
    platform: string,
    fn: () => Promise<T>
  ): Promise<T>;
}
```

The adapter makes all API calls through this rate limiter. The orchestrator coordinates across concurrent syncs to prevent exceeding platform limits.

### 13.14 Updated Non-Negotiable Rules

Add to the existing 10 rules:

11. **Every sync operation is idempotent.** Duplicate webhooks, crashed-and-retried syncs, and concurrent syncs for the same tenant must all produce the same end state.

12. **Webhook events are deduplicated.** The same platform event ID processed twice is a no-op, not a double-sync.

13. **Tenant isolation is absolute.** Every query includes tenant_id. Webhook payloads are verified against stored platform org IDs. Cross-tenant data leaks are architecturally impossible.

14. **Deleted invoices are detected.** Weekly reconciliation identifies invoices that disappeared from the platform and soft-deletes them in Qashivo.

15. **Multi-currency is handled correctly.** AR calculations use base currency amounts. Invoice currency is preserved but never summed across currencies.

---

## 14. CAPACITY LIMITS AND SCALING PATH

### 14.1 v1.1 Capacity — Comfortable Operating Range

This specification is designed for **500-1,000 tenants** on a single Railway instance.

```
SYNC LOAD AT 1,000 TENANTS:

Polling:    1,000 tenants × 4-hourly × 5 API calls = 5,000 calls per 4hrs ≈ 21 calls/min
Webhooks:   1,000 tenants × 5 events/day = 5,000/day ≈ 3-4/min sustained
Database:   1,000 tenants × 500 invoices = 500,000 invoice rows
Memory:     In-memory mutex + queue ≈ 1,000 entries = negligible

VERDICT: Well within Xero per-app limits, single process handles comfortably,
Neon performs well with basic indexes, webhook endpoint handles load trivially.
```

### 14.2 Where v1.1 Breaks — 1,000-2,000 Tenants

At approximately 1,000-2,000 tenants, the following limitations emerge:

**In-memory state is fragile.** The token refresh mutex (Map in memory) and sync coordination don't survive server restarts or horizontal scaling. A deploy during a sync cycle loses all lock state. A second Railway instance can't share the mutex, so two instances could refresh the same tenant's token simultaneously.

**Serial sync creates staleness.** A single process syncing 1,000+ tenants serially means the last tenant in the queue waits while the first 999 sync. At 30 seconds per sync, the last tenant waits 8+ hours — defeating the 4-hour polling interval.

**Platform app-level API quotas.** Xero's partner tier determines daily API call limits across all tenants (not per-tenant). At 1,000+ tenants, daily consumption approaches tier limits, especially during reconciliation sweeps.

**Webhook burst handling.** Month-end invoice runs across 1,000 tenants could spike webhook volume to 100-500/minute. A single synchronous endpoint may struggle to verify signatures, write to the database, and respond within Xero's 5-second timeout window during peaks.

**Token refresh storms.** Batch tenant onboarding creates cohorts whose tokens expire simultaneously. 500 tenants onboarded in one week means 500 token refreshes within the same hour, 30 days later.

### 14.3 v2.0 Scaling Recommendations — 1,000-10,000 Tenants

When tenant count approaches 1,000, the following upgrades should be implemented. The v1.1 architecture is designed so these are additive changes, not rewrites.

**1. Distributed locking** — replace in-memory mutex with database-backed row-level locks. Workers acquire a lock with a TTL (10 min) before syncing a tenant. If another worker holds it, skip. TTL prevents crashed workers from permanently blocking a tenant. Token refresh uses the same mechanism.

**2. Webhook queue decoupling** — the webhook endpoint writes to a queue table and responds 200 immediately. All processing is asynchronous. Ingestion and processing scale independently. Handles 500+/minute burst traffic without timeout risk.

**3. Horizontal worker scaling** — multiple stateless worker containers pulling from a shared sync queue. No shared in-memory state. All coordination through database locks and queue tables.

**4. App-level API budget tracking** — orchestrator tracks daily API consumption per platform, throttles scheduled syncs at 80% of budget. Webhook-triggered syncs consume from a reserved 20% quota to ensure real-time events are never starved.

**5. Tenant prioritisation** — not all tenants need the same polling frequency:
- Priority 1: Webhook-triggered (real-time)
- Priority 2: Active tenants with Charlie running (4-hour poll)
- Priority 3: Active tenants without automation (6-hour poll)
- Priority 4: Dormant tenants — no login in 7+ days (24-hour poll)
- Priority 5: Suspended/expired tenants (weekly only)

This reduces total API consumption by 60-70%.

**6. Regional deployment** — sync workers deployed in multiple regions. EU workers handle EU tenants, AU workers handle AU tenants. Reduces API call latency from 300ms (cross-region) to 20ms (same region).

**7. Database partitioning** — at 5 million+ invoice rows, partition by tenant_id. Production indexes on (tenant_id, status), (tenant_id, contact_id, status), and (platform_invoice_id, tenant_id). Cached table retention: keep latest version per invoice only, prune older snapshots after 30 days.

**8. Observability dashboard** — at 1,000+ tenants, manual log checking is impossible. Required: tenant health distribution, API budget consumption, webhook volume trending, queue depth, data freshness distribution, automated alerts for platform failures and budget thresholds.

**9. Platform health monitoring** — per-platform, per-region health tracking with rolling failure rate. If failure rate exceeds 50% for a platform+region in a 15-minute window, stop polling that region (prevents wasting API quota on a regional outage). Resume automatically when failure rate drops below 10%.

**10. Data residency** — global rollout requires GDPR (EU), PDPA (Singapore), Privacy Act (Australia) compliance. Tenant data may need to stay in-region. The adapter interface should include dataResidencyRegion to support future region-specific database routing.

### 14.4 Scaling Timeline

```
TENANTS     ACTION
─────────   ──────────────────────────────────────────────────────────────
0-500       v1.1 as written. Single instance. No scaling concerns.

500-1,000   v1.1 with monitoring. Add observability. Watch API quotas.
            Plan v2.0 implementation.

1,000-2,000 Implement v2.0 items 1-5: distributed locks, webhook queue,
            horizontal workers, API budgets, tenant prioritisation.

2,000-5,000 Add items 6-7: regional deployment, database partitioning.

5,000-10,000 Add items 8-10: full observability, platform health,
             data residency. Consider dedicated infrastructure.

10,000+     Dedicated infrastructure per region. Message queue (Redis/SQS)
            replaces database-backed queue. Dedicated database per region.
            Full ops team.
```

The v1.1 specification is the right architecture for the next 18-24 months. It comfortably supports the product through to acquisition conversations (300-500 tenants). The scaling path ensures the architecture evolves incrementally rather than requiring a rewrite at each growth stage.

---

*Specification version: 1.1 — 6 April 2026 (CTO review incorporated)*
*Author: Simon Kramer / Claude*
*Status: Specification complete. Build follows Phase 1-6 order.*
*Capacity: 500-1,000 tenants. See Section 14 for scaling path beyond.*
*Dependencies: Current Xero sync fix (silent error bug) must be completed first.*
