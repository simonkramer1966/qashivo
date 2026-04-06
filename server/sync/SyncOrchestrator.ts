// ═══════════════════════════════════════════════════════════════════════════
// SyncOrchestrator — The Brain
// ═══════════════════════════════════════════════════════════════════════════
// Platform-agnostic. Handles ALL operational concerns:
//   - Sync lifecycle (fetch → cache → process → emit events)
//   - Token refresh mutex, retry with backoff, health status
//   - AR overlay protection, change detection, SSE events
//   - Scheduling (4-hour poll, weekly reconciliation, health checks)
//   - Sync queue with tenant cooldown
//
// Does NOT know: how to call Xero, what a QuickBooks token looks like,
// or how to map platform-specific invoice fields.
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '../db';
import {
  tenants, contacts, invoices, cachedXeroInvoices, cachedXeroContacts,
  cachedXeroCreditNotes, cachedXeroOverpayments, cachedXeroPrepayments,
  syncState, customerContactPersons, timelineEvents,
} from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import type {
  AccountingAdapter, SyncMode, SyncResult, SyncStatus,
  SyncHealthStatus, SyncTrigger, QashivoInvoice, QashivoContact,
  FetchOptions, ChangeSet,
} from './adapters/types';

// ─── Constants ─────────────────────────────────────────────────────────────

const RETRY_SCHEDULE = [
  { delay: 2 * 60 * 1000, label: '2 minutes' },
  { delay: 5 * 60 * 1000, label: '5 minutes' },
  { delay: 15 * 60 * 1000, label: '15 minutes' },
];

const POLL_INTERVAL_MS = 4 * 60 * 60 * 1000;     // 4 hours
const HEALTH_CHECK_INTERVAL_MS = 20 * 60 * 1000;  // 20 minutes
const TENANT_COOLDOWN_MS = 60 * 1000;              // 1 min between syncs per tenant
const CONSECUTIVE_FAILURES_DEGRADED = 3;
const CONSECUTIVE_FAILURES_PAUSE_CHARLIE = 6;
const DATA_FRESHNESS_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

// AR overlay fields — NEVER overwritten during sync (Critical Rule 7)
const AR_OVERLAY_FIELDS = [
  'arContactEmail', 'arContactPhone', 'arContactName', 'arNotes',
];

// ─── Sync Queue Entry ──────────────────────────────────────────────────────

interface SyncQueueEntry {
  tenantId: string;
  mode: SyncMode;
  trigger: SyncTrigger;
  priority: number; // lower = higher priority
  enqueuedAt: Date;
}

// ─── SyncOrchestrator ──────────────────────────────────────────────────────

export class SyncOrchestrator {
  private adapter: AccountingAdapter;
  private syncQueue: SyncQueueEntry[] = [];
  private activeSyncs = new Set<string>(); // tenantIds currently syncing
  private lastSyncTimes = new Map<string, number>(); // tenantId → epoch ms
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private queueTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessingQueue = false;

  constructor(adapter: AccountingAdapter) {
    this.adapter = adapter;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  start() {
    console.log(`[SyncOrchestrator] Starting with ${this.adapter.platformDisplayName} adapter`);

    // Process sync queue every 5 seconds
    this.queueTimer = setInterval(() => this.processQueue(), 5000);

    // Schedule 4-hour incremental polls for all connected tenants
    this.pollTimer = setInterval(() => this.scheduleAllTenants('incremental', 'schedule'), POLL_INTERVAL_MS);

    // Schedule health checks every 20 minutes
    this.healthTimer = setInterval(() => this.runHealthChecks(), HEALTH_CHECK_INTERVAL_MS);

    // Schedule weekly reconciliation (Sunday 2 AM)
    this.scheduleWeeklyReconciliation();

    // Run initial poll on startup (after 10 seconds to let the server boot)
    setTimeout(() => this.scheduleAllTenants('incremental', 'schedule'), 10_000);

    console.log('[SyncOrchestrator] Started — polling every 4 hours, health checks every 20 min');
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.queueTimer) clearInterval(this.queueTimer);
    this.pollTimer = null;
    this.healthTimer = null;
    this.queueTimer = null;
    console.log('[SyncOrchestrator] Stopped');
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /** Enqueue a sync for a specific tenant */
  enqueueSync(tenantId: string, mode: SyncMode, trigger: SyncTrigger) {
    const priority = { webhook: 0, force: 1, incremental: 2, reconciliation: 3, initial: 1 }[mode] ?? 2;

    // Don't enqueue duplicates
    const exists = this.syncQueue.find(e => e.tenantId === tenantId && e.mode === mode);
    if (exists) return;

    this.syncQueue.push({ tenantId, mode, trigger, priority, enqueuedAt: new Date() });
    this.syncQueue.sort((a, b) => a.priority - b.priority);
  }

  /** Run a sync immediately (bypasses queue — for user-triggered actions) */
  async syncTenant(tenantId: string, mode: SyncMode, trigger: SyncTrigger): Promise<SyncResult> {
    return this.executeSyncForTenant(tenantId, mode, trigger);
  }

  /** Get current sync health for a tenant */
  async getSyncHealth(tenantId: string): Promise<{
    status: SyncHealthStatus;
    lastSyncAt: Date | null;
    lastSuccessfulSyncAt: Date | null;
    lastSyncMode: string | null;
    lastSyncError: string | null;
    consecutiveFailures: number;
    invoicesSynced: number;
    contactsSynced: number;
    isRunning: boolean;
  }> {
    const state = await this.getOrCreateSyncState(tenantId);
    const isRunning = this.activeSyncs.has(tenantId);

    return {
      status: await this.deriveSyncHealth(tenantId, state),
      lastSyncAt: state.lastSyncAt,
      lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
      lastSyncMode: state.lastSyncMode,
      lastSyncError: state.lastSyncError,
      consecutiveFailures: state.consecutiveFailures ?? 0,
      invoicesSynced: state.totalInvoicesSynced ?? 0,
      contactsSynced: state.totalContactsSynced ?? 0,
      isRunning,
    };
  }

  // ─── Queue Processing ────────────────────────────────────────────────────

  private async processQueue() {
    if (this.isProcessingQueue || this.syncQueue.length === 0) return;
    this.isProcessingQueue = true;

    try {
      // Process one entry at a time (can be made concurrent later)
      const entry = this.syncQueue.shift();
      if (!entry) return;

      // Tenant cooldown check
      const lastSync = this.lastSyncTimes.get(entry.tenantId) ?? 0;
      if (Date.now() - lastSync < TENANT_COOLDOWN_MS) {
        // Re-enqueue at the back
        this.syncQueue.push(entry);
        return;
      }

      // Skip if already syncing
      if (this.activeSyncs.has(entry.tenantId)) return;

      await this.executeSyncForTenant(entry.tenantId, entry.mode, entry.trigger).catch(err => {
        console.error(`[SyncOrchestrator] Queue sync failed for ${entry.tenantId}:`, err);
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async scheduleAllTenants(mode: SyncMode, trigger: SyncTrigger) {
    try {
      const connectedTenants = await db.select({ id: tenants.id })
        .from(tenants)
        .where(sql`${tenants.xeroAccessToken} IS NOT NULL AND ${tenants.xeroTenantId} IS NOT NULL`);

      for (const t of connectedTenants) {
        this.enqueueSync(t.id, mode, trigger);
      }
      console.log(`[SyncOrchestrator] Scheduled ${mode} sync for ${connectedTenants.length} tenants`);
    } catch (err) {
      console.error('[SyncOrchestrator] Failed to schedule tenant syncs:', err);
    }
  }

  private scheduleWeeklyReconciliation() {
    const checkReconciliation = () => {
      const now = new Date();
      // Sunday = 0, 2 AM
      if (now.getDay() === 0 && now.getHours() === 2 && now.getMinutes() < 5) {
        this.scheduleAllTenants('reconciliation', 'schedule');
      }
    };
    // Check every 5 minutes
    setInterval(checkReconciliation, 5 * 60 * 1000);
  }

  // ─── Core Sync Execution ─────────────────────────────────────────────────

  private async executeSyncForTenant(
    tenantId: string,
    mode: SyncMode,
    trigger: SyncTrigger,
  ): Promise<SyncResult> {
    const startedAt = new Date();
    const result: SyncResult = {
      status: 'failed',
      syncMode: mode,
      platform: this.adapter.platformName,
      tenantId,
      fetched: { invoices: 0, contacts: 0, creditNotes: 0, overpayments: 0, prepayments: 0, payments: 0, bankTransactions: 0, apiCallsMade: 0 },
      processed: { invoicesCreated: 0, invoicesUpdated: 0, statusChanges: 0, paymentChangesDetected: 0, contactsCreated: 0, contactsUpdated: 0, creditNotesProcessed: 0 },
      startedAt,
      completedAt: startedAt,
      durationMs: 0,
      errors: [],
      warnings: [],
    };

    // ── Step 1: Pre-sync checks ──────────────────────────────────────────
    if (this.activeSyncs.has(tenantId)) {
      result.warnings.push('Sync already in progress for this tenant');
      return result;
    }
    this.activeSyncs.add(tenantId);
    this.lastSyncTimes.set(tenantId, Date.now());

    try {
      // Check auth status
      const authStatus = await this.adapter.getAuthStatus(tenantId);
      if (!authStatus.connected) {
        result.errors.push('Not connected to accounting platform');
        await this.recordSyncFailure(tenantId, result);
        return result;
      }

      // Refresh token if needed
      if (!authStatus.tokenValid) {
        try {
          await this.adapter.refreshToken(tenantId);
          console.log(`[SyncOrchestrator] Token refreshed for ${tenantId}`);
        } catch (err) {
          result.errors.push(`Token refresh failed: ${(err as Error).message}`);
          await this.recordSyncFailure(tenantId, result);
          return result;
        }
      }

      // Update sync state to running
      await this.updateSyncState(tenantId, { syncStatus: 'running', lastSyncMode: mode });

      // ── Step 2: Determine effective mode ─────────────────────────────
      const state = await this.getOrCreateSyncState(tenantId);
      let effectiveMode = mode;
      if (mode === 'incremental' && !state.initialSyncComplete) {
        effectiveMode = 'initial';
        console.log(`[SyncOrchestrator] First sync for ${tenantId}, switching to initial mode`);
      }

      // Build fetch options
      const fetchOptions: FetchOptions = {};
      if (effectiveMode === 'incremental' && state.invoicesCursor) {
        fetchOptions.modifiedSince = new Date(state.invoicesCursor);
      }
      // force + reconciliation: no filters — fetch everything

      // ── Step 3: Fetch invoices ───────────────────────────────────────
      console.log(`[SyncOrchestrator] Starting ${effectiveMode} sync for tenant ${tenantId}`);

      // Clear cache on initial sync
      if (effectiveMode === 'initial') {
        await db.delete(cachedXeroInvoices).where(eq(cachedXeroInvoices.tenantId, tenantId));
        await db.delete(cachedXeroContacts).where(eq(cachedXeroContacts.tenantId, tenantId));
        await db.delete(cachedXeroCreditNotes).where(eq(cachedXeroCreditNotes.tenantId, tenantId));
        await db.delete(cachedXeroOverpayments).where(eq(cachedXeroOverpayments.tenantId, tenantId));
        await db.delete(cachedXeroPrepayments).where(eq(cachedXeroPrepayments.tenantId, tenantId));
      }

      const uniqueContactIds = new Map<string, string>(); // platformContactId → name

      const onInvoicePage = async (pageInvoices: any[], pageNumber: number) => {
        for (const inv of pageInvoices) {
          const contactId = inv.Contact?.ContactID;
          if (contactId) {
            uniqueContactIds.set(contactId, inv.Contact?.Name || 'Unknown');
          }
        }
        await this.cacheInvoicePage(tenantId, pageInvoices, effectiveMode);
        result.fetched.apiCallsMade++;
        console.log(`[SyncOrchestrator] Page ${pageNumber}: ${pageInvoices.length} invoices cached`);
      };

      let invoiceFetchedAt: Date;

      if (effectiveMode === 'initial' || effectiveMode === 'force' || effectiveMode === 'reconciliation') {
        // Two-pass bounded sync:
        // Pass 1: All open invoices (any age) — these are what we're chasing
        console.log(`[SyncOrchestrator] ${effectiveMode} sync pass 1: open invoices (AUTHORISED, SUBMITTED)`);
        const openSummary = await this.adapter.fetchInvoices(
          tenantId,
          { statuses: ['AUTHORISED', 'SUBMITTED'] },
          onInvoicePage,
        );

        // Pass 2: Paid/voided history from last 24 months — for payment behaviour analysis
        const historyStart = new Date();
        historyStart.setMonth(historyStart.getMonth() - this.adapter.defaultHistoryMonths);
        console.log(`[SyncOrchestrator] ${effectiveMode} sync pass 2: closed invoices since ${historyStart.toISOString().slice(0, 10)}`);
        const closedSummary = await this.adapter.fetchInvoices(
          tenantId,
          { statuses: ['PAID', 'VOIDED'], dateFrom: historyStart },
          onInvoicePage,
        );

        result.fetched.invoices = openSummary.totalCount + closedSummary.totalCount;
        // Use the earlier fetchedAt for cursor safety
        invoiceFetchedAt = openSummary.fetchedAt < closedSummary.fetchedAt ? openSummary.fetchedAt : closedSummary.fetchedAt;
      } else {
        // Incremental: fetch all statuses modified since cursor
        const invoiceSummary = await this.adapter.fetchInvoices(
          tenantId,
          fetchOptions,
          onInvoicePage,
        );
        result.fetched.invoices = invoiceSummary.totalCount;
        invoiceFetchedAt = invoiceSummary.fetchedAt;
      }

      // ── Step 4: Fetch contacts ───────────────────────────────────────
      if (uniqueContactIds.size > 0) {
        const contactIds = Array.from(uniqueContactIds.keys());
        // Use the XeroAdapter-specific batch fetch
        const adapter = this.adapter as any;
        let rawContacts: any[] = [];

        if (typeof adapter.fetchContactsByIds === 'function') {
          rawContacts = await adapter.fetchContactsByIds(tenantId, contactIds);
          result.fetched.apiCallsMade += Math.ceil(contactIds.length / 50);
        }

        // Cache contacts
        for (const raw of rawContacts) {
          await this.cacheContact(tenantId, raw, effectiveMode);
        }
        result.fetched.contacts = rawContacts.length;
        console.log(`[SyncOrchestrator] Fetched ${rawContacts.length} contacts`);

        // Upsert contacts into main table
        const contactResult = await this.processContacts(tenantId, rawContacts);
        result.processed.contactsCreated = contactResult.created;
        result.processed.contactsUpdated = contactResult.updated;
      }

      // ── Step 5: Process cached invoices → main table ─────────────────
      const changeSet = await this.processInvoices(tenantId);
      result.processed.invoicesCreated = changeSet.created;
      result.processed.invoicesUpdated = changeSet.updated;
      result.processed.statusChanges = changeSet.statusChanges;
      result.processed.paymentChangesDetected = changeSet.paymentChanges;

      // ── Step 6: Fetch credit notes (non-fatal) ──────────────────────
      try {
        const cnSummary = await this.adapter.fetchCreditNotes(
          tenantId,
          {},
          async (pageCreditNotes) => {
            result.fetched.apiCallsMade++;
            result.fetched.creditNotes += pageCreditNotes.length;
            await this.cacheCreditNotePage(tenantId, pageCreditNotes, effectiveMode);
          },
        );
        result.processed.creditNotesProcessed = cnSummary.totalCount;
        console.log(`[SyncOrchestrator] Cached ${cnSummary.totalCount} credit notes`);
      } catch (err) {
        result.warnings.push(`Credit notes fetch failed: ${(err as Error).message}`);
      }

      // ── Step 6b: Fetch overpayments (optional, non-fatal) ─────────
      if (this.adapter.fetchOverpayments) {
        try {
          if (effectiveMode === 'initial') {
            await db.delete(cachedXeroOverpayments).where(eq(cachedXeroOverpayments.tenantId, tenantId));
          }
          const opSummary = await this.adapter.fetchOverpayments(
            tenantId,
            {},
            async (pageOverpayments) => {
              result.fetched.apiCallsMade++;
              result.fetched.overpayments += pageOverpayments.length;
              await this.cacheOverpaymentPage(tenantId, pageOverpayments, effectiveMode);
            },
          );
          console.log(`[SyncOrchestrator] Cached ${opSummary.totalCount} overpayments`);
        } catch (err) {
          result.warnings.push(`Overpayments fetch failed: ${(err as Error).message}`);
        }
      }

      // ── Step 6c: Fetch prepayments (optional, non-fatal) ──────────
      if (this.adapter.fetchPrepayments) {
        try {
          if (effectiveMode === 'initial') {
            await db.delete(cachedXeroPrepayments).where(eq(cachedXeroPrepayments.tenantId, tenantId));
          }
          const ppSummary = await this.adapter.fetchPrepayments(
            tenantId,
            {},
            async (pagePrepayments) => {
              result.fetched.apiCallsMade++;
              result.fetched.prepayments += pagePrepayments.length;
              await this.cachePrepaymentPage(tenantId, pagePrepayments, effectiveMode);
            },
          );
          console.log(`[SyncOrchestrator] Cached ${ppSummary.totalCount} prepayments`);
        } catch (err) {
          result.warnings.push(`Prepayments fetch failed: ${(err as Error).message}`);
        }
      }

      // ── Step 7: Fetch bank transactions (optional, non-fatal) ────────
      if (this.adapter.fetchBankTransactions) {
        try {
          await this.adapter.fetchBankTransactions(
            tenantId,
            {},
            async (pageTxns) => {
              result.fetched.apiCallsMade++;
              result.fetched.bankTransactions += pageTxns.length;
            },
          );
        } catch (err) {
          // 403 on bank transactions is expected (scope issue) — don't fail the sync
          result.warnings.push(`Bank transactions fetch failed: ${(err as Error).message}`);
        }
      }

      // ── Step 8: Post-sync ────────────────────────────────────────────
      result.status = 'success';
      result.completedAt = new Date();
      result.durationMs = result.completedAt.getTime() - startedAt.getTime();

      // Critical rule: if no invoices fetched AND no API calls, never report success
      if (result.fetched.invoices === 0 && result.fetched.apiCallsMade === 0) {
        result.status = 'failed';
        result.errors.push('No API calls made — sync did not fetch any data');
      }

      // Update sync state
      await this.updateSyncState(tenantId, {
        syncStatus: 'idle',
        lastSyncMode: effectiveMode,
        lastSyncCompletedAt: result.completedAt,
        lastSuccessfulSyncAt: result.status === 'success' ? result.completedAt : undefined,
        lastSyncError: result.errors.length > 0 ? result.errors[0] : null,
        lastSyncResult: result,
        invoicesCursor: result.status === 'success' ? invoiceFetchedAt.toISOString() : undefined,
        consecutiveFailures: 0,
        initialSyncComplete: effectiveMode === 'initial' && result.status === 'success' ? true : undefined,
        totalInvoicesSynced: result.fetched.invoices > 0 ? result.fetched.invoices : undefined,
        totalContactsSynced: result.fetched.contacts > 0 ? result.fetched.contacts : undefined,
      });

      // Update tenant last sync timestamp
      await db.update(tenants).set({
        xeroLastSyncAt: result.completedAt,
        xeroConnectionStatus: 'connected',
      }).where(eq(tenants.id, tenantId));

      // Emit SSE event
      try {
        const { emitTenantEvent } = await import('../services/realtimeEvents');
        emitTenantEvent(tenantId, 'sync_complete', {
          invoices: result.fetched.invoices,
          contacts: result.fetched.contacts,
          mode: effectiveMode,
        });
      } catch { /* non-fatal */ }

      console.log(`[SyncOrchestrator] Sync complete for ${tenantId}: ${result.fetched.invoices} invoices, ${result.fetched.contacts} contacts, ${result.fetched.creditNotes} credit notes, ${result.fetched.overpayments} overpayments, ${result.fetched.prepayments} prepayments in ${result.durationMs}ms`);

      // Log to sync audit
      await this.logSyncAudit(tenantId, result, trigger);

      return result;

    } catch (err) {
      // ── On failure ─────────────────────────────────────────────────
      const errorMessage = (err as Error).message;
      result.status = 'failed';
      result.errors.push(errorMessage);
      result.completedAt = new Date();
      result.durationMs = result.completedAt.getTime() - startedAt.getTime();

      console.error(`[SyncOrchestrator] Sync FAILED for ${tenantId}: ${errorMessage}`);

      await this.recordSyncFailure(tenantId, result);
      await this.logSyncAudit(tenantId, result, trigger);

      // Schedule retry
      await this.scheduleRetry(tenantId, trigger);

      return result;

    } finally {
      this.activeSyncs.delete(tenantId);
    }
  }

  // ─── Cache Operations ────────────────────────────────────────────────────

  private async cacheInvoicePage(tenantId: string, rawInvoices: any[], mode: SyncMode) {
    const mapped = rawInvoices.map(raw => {
      const inv = this.adapter.mapInvoice(raw);
      return {
        tenantId,
        xeroInvoiceId: inv.platformInvoiceId,
        xeroContactId: inv.platformContactId || null,
        invoiceNumber: inv.invoiceNumber,
        reference: inv.reference || null,
        amount: inv.amount.toString(),
        amountDue: inv.amountDue.toString(),
        amountPaid: inv.amountPaid.toString(),
        taxAmount: '0', // Xero TotalTax
        xeroStatus: raw.Status || 'UNKNOWN',
        status: inv.status,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        paidDate: inv.fullyPaidDate,
        currency: inv.currencyCode || 'GBP',
        updatedDateUtc: raw.UpdatedDateUTC ? this.safeParseDate(raw.UpdatedDateUTC) : null,
      };
    });

    if (mapped.length === 0) return;

    if (mode === 'incremental' || mode === 'force' || mode === 'webhook' || mode === 'reconciliation') {
      // Delete existing cached rows for these invoices before re-inserting (upsert pattern)
      const xeroIds = mapped.map(m => m.xeroInvoiceId);
      await db.delete(cachedXeroInvoices).where(
        and(eq(cachedXeroInvoices.tenantId, tenantId), inArray(cachedXeroInvoices.xeroInvoiceId, xeroIds)),
      );
    }

    await db.insert(cachedXeroInvoices).values(mapped);
  }

  private async cacheContact(tenantId: string, raw: any, mode: SyncMode) {
    const contact = this.adapter.mapContact(raw);
    const toCache = {
      tenantId,
      xeroContactId: contact.platformContactId,
      name: contact.name,
      firstName: raw.FirstName || null,
      lastName: raw.LastName || null,
      emailAddress: contact.email,
      phone: contact.phone,
      contactStatus: raw.ContactStatus || 'ACTIVE',
      isCustomer: raw.IsCustomer ?? false,
      isSupplier: raw.IsSupplier ?? false,
    };

    if (mode !== 'initial') {
      await db.delete(cachedXeroContacts).where(
        and(eq(cachedXeroContacts.tenantId, tenantId), eq(cachedXeroContacts.xeroContactId, contact.platformContactId)),
      );
    }

    await db.insert(cachedXeroContacts).values(toCache);
  }

  private async cacheCreditNotePage(tenantId: string, rawCreditNotes: any[], mode: SyncMode) {
    if (!this.adapter.mapCreditNote) return;

    const mapped = rawCreditNotes.map(raw => {
      const cn = this.adapter.mapCreditNote(raw);
      return {
        tenantId,
        xeroCreditNoteId: cn.platformCreditNoteId,
        xeroContactId: cn.platformContactId || null,
        creditNoteNumber: raw.CreditNoteNumber || null,
        type: raw.Type || 'ACCRECCREDIT',
        status: cn.status,
        total: cn.amount.toString(),
        remainingCredit: cn.amountRemaining.toString(),
        date: cn.issueDate,
        updatedDateUtc: raw.UpdatedDateUTC ? this.safeParseDate(raw.UpdatedDateUTC) : null,
      };
    });

    if (mapped.length === 0) return;

    if (mode !== 'initial') {
      const ids = mapped.map(m => m.xeroCreditNoteId);
      await db.delete(cachedXeroCreditNotes).where(
        and(eq(cachedXeroCreditNotes.tenantId, tenantId), inArray(cachedXeroCreditNotes.xeroCreditNoteId, ids)),
      );
    }

    await db.insert(cachedXeroCreditNotes).values(mapped);
  }

  private async cacheOverpaymentPage(tenantId: string, rawOverpayments: any[], mode: SyncMode) {
    if (!this.adapter.mapOverpayment) return;

    const mapped = rawOverpayments.map(raw => {
      const op = this.adapter.mapOverpayment!(raw);
      return {
        tenantId,
        xeroOverpaymentId: op.platformOverpaymentId,
        xeroContactId: op.platformContactId || null,
        status: op.status,
        total: op.amount.toString(),
        remainingCredit: op.amountRemaining.toString(),
        date: op.date,
        updatedDateUtc: raw.UpdatedDateUTC ? this.safeParseDate(raw.UpdatedDateUTC) : null,
      };
    });

    if (mapped.length === 0) return;

    if (mode !== 'initial') {
      const ids = mapped.map(m => m.xeroOverpaymentId);
      await db.delete(cachedXeroOverpayments).where(
        and(eq(cachedXeroOverpayments.tenantId, tenantId), inArray(cachedXeroOverpayments.xeroOverpaymentId, ids)),
      );
    }

    await db.insert(cachedXeroOverpayments).values(mapped);
  }

  private async cachePrepaymentPage(tenantId: string, rawPrepayments: any[], mode: SyncMode) {
    if (!this.adapter.mapPrepayment) return;

    const mapped = rawPrepayments.map(raw => {
      const pp = this.adapter.mapPrepayment!(raw);
      return {
        tenantId,
        xeroPrepaymentId: pp.platformPrepaymentId,
        xeroContactId: pp.platformContactId || null,
        status: pp.status,
        total: pp.amount.toString(),
        remainingCredit: pp.amountRemaining.toString(),
        date: pp.date,
        updatedDateUtc: raw.UpdatedDateUTC ? this.safeParseDate(raw.UpdatedDateUTC) : null,
      };
    });

    if (mapped.length === 0) return;

    if (mode !== 'initial') {
      const ids = mapped.map(m => m.xeroPrepaymentId);
      await db.delete(cachedXeroPrepayments).where(
        and(eq(cachedXeroPrepayments.tenantId, tenantId), inArray(cachedXeroPrepayments.xeroPrepaymentId, ids)),
      );
    }

    await db.insert(cachedXeroPrepayments).values(mapped);
  }

  // ─── Main Table Processing ───────────────────────────────────────────────

  private async processContacts(tenantId: string, rawContacts: any[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    // Pre-load existing contacts
    const existing = await db.select().from(contacts).where(eq(contacts.tenantId, tenantId));
    const byXeroId = new Map(existing.filter(c => c.xeroContactId).map(c => [c.xeroContactId!, c]));

    for (const raw of rawContacts) {
      const mapped = this.adapter.mapContact(raw);
      const xeroId = mapped.platformContactId;
      const existingContact = byXeroId.get(xeroId);

      try {
        if (existingContact) {
          // Update platform-sourced fields ONLY — AR overlay fields are SACRED
          await db.update(contacts).set({
            name: mapped.name,
            email: mapped.email || existingContact.email,
            phone: mapped.phone || existingContact.phone,
            companyName: mapped.name,
            isActive: true,
            updatedAt: new Date(),
          }).where(eq(contacts.id, existingContact.id));
          updated++;
        } else {
          const [newContact] = await db.insert(contacts).values({
            tenantId,
            xeroContactId: xeroId,
            name: mapped.name,
            email: mapped.email,
            phone: mapped.phone,
            companyName: mapped.name,
            role: 'customer',
            isActive: true,
          }).returning();
          byXeroId.set(xeroId, newContact as any);
          created++;

          // Assign to default schedule
          try {
            const { assignContactToDefaultSchedule } = await import('../services/strategySeeder');
            await assignContactToDefaultSchedule(tenantId, newContact.id);
          } catch { /* non-fatal */ }

          // Queue enrichment (fire-and-forget)
          import('../services/debtorEnrichmentService').then(({ enrichNewContacts }) => {
            enrichNewContacts(tenantId, [{ id: newContact.id, name: mapped.name }]).catch(() => { /* non-fatal */ });
          }).catch(() => { /* non-fatal */ });
        }

        // Upsert contact persons
        if (mapped.contactPersons.length > 0) {
          const parentId = existingContact?.id || byXeroId.get(xeroId)?.id;
          if (parentId) {
            await this.upsertContactPersons(tenantId, parentId, mapped.contactPersons, raw.ContactPersons || []);
          }
        }
      } catch (err) {
        console.warn(`[SyncOrchestrator] Failed to process contact ${mapped.name}: ${(err as Error).message}`);
      }
    }

    return { created, updated };
  }

  private async upsertContactPersons(tenantId: string, contactId: string, persons: QashivoContact['contactPersons'], rawPersons: any[]) {
    for (let i = 0; i < persons.length; i++) {
      const cp = persons[i];
      const name = [cp.firstName, cp.lastName].filter(Boolean).join(' ').trim();
      if (!name) continue;

      try {
        const [existing] = await db.select({ id: customerContactPersons.id })
          .from(customerContactPersons)
          .where(and(
            eq(customerContactPersons.tenantId, tenantId),
            eq(customerContactPersons.contactId, contactId),
            eq(customerContactPersons.name, name),
            eq(customerContactPersons.isFromXero, true),
          ));

        if (existing) {
          await db.update(customerContactPersons).set({
            email: cp.email,
            isPrimaryCreditControl: cp.isPrimary,
            updatedAt: new Date(),
          }).where(eq(customerContactPersons.id, existing.id));
        } else {
          await db.insert(customerContactPersons).values({
            tenantId,
            contactId,
            name,
            email: cp.email,
            isPrimaryCreditControl: cp.isPrimary,
            isFromXero: true,
          });
        }
      } catch { /* non-fatal */ }
    }
  }

  private async processInvoices(tenantId: string): Promise<{
    created: number; updated: number; statusChanges: number; paymentChanges: number;
  }> {
    let created = 0;
    let updated = 0;
    let statusChanges = 0;
    let paymentChanges = 0;

    // Load cached invoices
    const cachedInvs = await db.select().from(cachedXeroInvoices).where(eq(cachedXeroInvoices.tenantId, tenantId));
    if (cachedInvs.length === 0) return { created, updated, statusChanges, paymentChanges };

    // Pre-load existing data
    const allContacts = await db.select().from(contacts).where(eq(contacts.tenantId, tenantId));
    const contactsByXeroId = new Map(allContacts.filter(c => c.xeroContactId).map(c => [c.xeroContactId!, c]));

    const existingInvs = await db.select({
      id: invoices.id,
      xeroInvoiceId: invoices.xeroInvoiceId,
      invoiceStatus: invoices.invoiceStatus,
      amountPaid: invoices.amountPaid,
    }).from(invoices).where(and(eq(invoices.tenantId, tenantId), sql`${invoices.xeroInvoiceId} IS NOT NULL`));

    const existingById = new Map<string, { id: string; invoiceStatus: string | null; amountPaid: string | null }>();
    for (const inv of existingInvs) {
      if (inv.xeroInvoiceId && !existingById.has(inv.xeroInvoiceId)) {
        existingById.set(inv.xeroInvoiceId, { id: inv.id, invoiceStatus: inv.invoiceStatus, amountPaid: inv.amountPaid });
      }
    }

    for (const cachedInv of cachedInvs) {
      try {
        const contactXeroId = cachedInv.xeroContactId;
        if (!contactXeroId) continue;

        const contact = contactsByXeroId.get(contactXeroId);
        if (!contact) continue;

        // Derive display status
        let mappedStatus = cachedInv.status;
        if (mappedStatus === 'unpaid' || mappedStatus === 'partial' || mappedStatus === 'pending') {
          mappedStatus = new Date(cachedInv.dueDate) < new Date() ? 'overdue' : 'pending';
        }

        // Map Xero status → invoiceStatus field
        const rawXeroStatus = cachedInv.xeroStatus;
        let invoiceStatus = 'OPEN';
        if (rawXeroStatus === 'PAID') invoiceStatus = 'PAID';
        else if (rawXeroStatus === 'VOIDED') invoiceStatus = 'VOID';
        else if (rawXeroStatus === 'DELETED') invoiceStatus = 'DELETED';
        else if (rawXeroStatus === 'DRAFT') invoiceStatus = 'DRAFT';

        // Compute effective amountPaid: amount - amountDue
        // Xero's AmountDue accounts for credit notes, so this matches exactly
        const totalAmount = parseFloat(cachedInv.amount) || 0;
        const xeroAmountDue = parseFloat(cachedInv.amountDue || '0');
        const effectiveAmountPaid = Math.max(0, totalAmount - xeroAmountDue).toFixed(2);

        const existing = existingById.get(cachedInv.xeroInvoiceId);

        const updateData = {
          contactId: contact.id,
          invoiceNumber: cachedInv.invoiceNumber,
          amount: cachedInv.amount,
          amountPaid: effectiveAmountPaid,
          taxAmount: cachedInv.taxAmount,
          status: mappedStatus,
          invoiceStatus,
          paidDate: cachedInv.paidDate,
          dueDate: cachedInv.dueDate,
          issueDate: cachedInv.issueDate,
          currency: cachedInv.currency,
          updatedAt: new Date(),
        };

        if (existing) {
          // Detect status transitions
          const previousStatus = existing.invoiceStatus;
          const isNewlyPaid = invoiceStatus === 'PAID' && previousStatus !== 'PAID';

          // Detect payment changes
          const previousAmountPaid = parseFloat(existing.amountPaid || '0');
          const newAmountPaid = parseFloat(effectiveAmountPaid);
          if (newAmountPaid > previousAmountPaid) {
            paymentChanges++;
          }

          await db.update(invoices).set(updateData).where(eq(invoices.id, existing.id));
          updated++;

          if (isNewlyPaid) {
            statusChanges++;
            await this.handlePaymentDetected(tenantId, contact, cachedInv);
          }
        } else {
          // Check for duplicates before insert
          const [dup] = await db.select({ id: invoices.id }).from(invoices)
            .where(and(eq(invoices.xeroInvoiceId, cachedInv.xeroInvoiceId), eq(invoices.tenantId, tenantId)))
            .limit(1);

          if (dup) {
            await db.update(invoices).set(updateData).where(eq(invoices.id, dup.id));
            existingById.set(cachedInv.xeroInvoiceId, { id: dup.id, invoiceStatus, amountPaid: effectiveAmountPaid });
            updated++;
          } else {
            await db.insert(invoices).values({
              tenantId,
              contactId: contact.id,
              xeroInvoiceId: cachedInv.xeroInvoiceId,
              invoiceNumber: cachedInv.invoiceNumber,
              amount: cachedInv.amount,
              amountPaid: effectiveAmountPaid,
              taxAmount: cachedInv.taxAmount,
              status: mappedStatus,
              invoiceStatus,
              issueDate: cachedInv.issueDate,
              dueDate: cachedInv.dueDate,
              paidDate: cachedInv.paidDate,
              currency: cachedInv.currency,
            });
            existingById.set(cachedInv.xeroInvoiceId, { id: 'new', invoiceStatus, amountPaid: effectiveAmountPaid });
            created++;
          }
        }
      } catch (err) {
        console.warn(`[SyncOrchestrator] Invoice upsert failed for ${cachedInv.invoiceNumber}: ${(err as Error).message}`);
      }
    }

    // Post-processing: clear legal windows + probable payments for fully-paid contacts
    await this.clearResolvedFlags(tenantId, allContacts);

    console.log(`[SyncOrchestrator] Invoices: ${created} created, ${updated} updated, ${statusChanges} status changes, ${paymentChanges} payment changes`);
    return { created, updated, statusChanges, paymentChanges };
  }

  // ─── Payment + Status Change Handlers ────────────────────────────────────

  private async handlePaymentDetected(
    tenantId: string,
    contact: any,
    cachedInv: any,
  ) {
    // Timeline event
    try {
      await db.insert(timelineEvents).values({
        tenantId,
        customerId: contact.id,
        occurredAt: new Date(),
        direction: 'internal',
        channel: 'system',
        summary: `Payment received — invoice ${cachedInv.invoiceNumber} fully paid`,
        preview: `£${parseFloat(cachedInv.amount).toFixed(2)} received`,
        createdByType: 'system',
      });
    } catch { /* non-fatal */ }

    // SSE event
    try {
      const { emitTenantEvent } = await import('../services/realtimeEvents');
      emitTenantEvent(tenantId, 'payment_received', {
        contactId: contact.id,
        contactName: contact.name,
        invoiceNumber: cachedInv.invoiceNumber,
        amount: cachedInv.amount,
      });
    } catch { /* non-fatal */ }

    // Channel effectiveness attribution (Gap 1)
    try {
      const { processPaymentAttribution } = await import('../services/channelEffectivenessService');
      const paidDate = cachedInv.paidDate ? new Date(cachedInv.paidDate) : new Date();
      await processPaymentAttribution(tenantId, contact.id, paidDate);
    } catch (err) {
      console.warn(`[SyncOrchestrator] Payment attribution failed for ${cachedInv.invoiceNumber}: ${(err as Error).message}`);
    }
  }

  private async clearResolvedFlags(tenantId: string, allContacts: any[]) {
    // Gap 10: Clear legal response window for contacts where all invoices are paid
    try {
      const contactsWithWindow = allContacts.filter(c => c.legalResponseWindowEnd);
      for (const contact of contactsWithWindow) {
        const [unpaid] = await db.select({ id: invoices.id }).from(invoices)
          .where(and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.contactId, contact.id),
            sql`LOWER(${invoices.status}) NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`,
          )).limit(1);

        if (!unpaid) {
          await db.update(contacts).set({ legalResponseWindowEnd: null, updatedAt: new Date() })
            .where(eq(contacts.id, contact.id));
          await db.insert(timelineEvents).values({
            tenantId, customerId: contact.id, occurredAt: new Date(),
            direction: 'internal', channel: 'system',
            summary: 'Legal response window auto-cleared — all invoices settled.',
            preview: 'Full payment received. Automated collections unblocked.',
            createdByType: 'system',
          });
        }
      }
    } catch (err) {
      console.warn('[SyncOrchestrator] Error checking legal windows:', err);
    }

    // Gap 14: Clear probable payment flags
    try {
      const contactsWithPP = allContacts.filter(c => c.probablePaymentDetected);
      for (const contact of contactsWithPP) {
        const [unpaid] = await db.select({ id: invoices.id }).from(invoices)
          .where(and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.contactId, contact.id),
            sql`LOWER(${invoices.status}) NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`,
          )).limit(1);

        if (!unpaid) {
          await db.update(contacts).set({
            probablePaymentDetected: false,
            probablePaymentConfidence: null,
            probablePaymentDetectedAt: null,
            updatedAt: new Date(),
          }).where(eq(contacts.id, contact.id));
        }
      }
    } catch (err) {
      console.warn('[SyncOrchestrator] Error checking probable payment flags:', err);
    }
  }

  // ─── Health Monitoring ───────────────────────────────────────────────────

  private async runHealthChecks() {
    try {
      const connected = await db.select({ id: tenants.id })
        .from(tenants)
        .where(sql`${tenants.xeroAccessToken} IS NOT NULL AND ${tenants.xeroTenantId} IS NOT NULL`);

      for (const t of connected) {
        try {
          const healthy = await this.adapter.healthCheck(t.id);
          await db.update(tenants).set({
            xeroLastHealthCheck: new Date(),
            xeroConnectionStatus: healthy ? 'connected' : 'error',
            xeroHealthCheckError: healthy ? null : 'Health check failed',
          }).where(eq(tenants.id, t.id));
        } catch { /* non-fatal */ }
      }
    } catch (err) {
      console.error('[SyncOrchestrator] Health check run failed:', err);
    }
  }

  private async deriveSyncHealth(tenantId: string, state: any): Promise<SyncHealthStatus> {
    const authStatus = await this.adapter.getAuthStatus(tenantId);
    if (!authStatus.connected || !authStatus.tokenValid) return 'disconnected';
    if ((state.consecutiveFailures ?? 0) >= CONSECUTIVE_FAILURES_PAUSE_CHARLIE) return 'failed';
    if ((state.consecutiveFailures ?? 0) >= CONSECUTIVE_FAILURES_DEGRADED) return 'degraded';
    if (state.lastSuccessfulSyncAt) {
      const age = Date.now() - new Date(state.lastSuccessfulSyncAt).getTime();
      if (age > DATA_FRESHNESS_THRESHOLD_MS) return 'degraded';
    }
    return 'healthy';
  }

  /** Check if data is fresh enough for Charlie to run */
  async isDataFresh(tenantId: string): Promise<boolean> {
    const state = await this.getOrCreateSyncState(tenantId);
    if (!state.lastSuccessfulSyncAt) return false;
    const age = Date.now() - new Date(state.lastSuccessfulSyncAt).getTime();
    return age < DATA_FRESHNESS_THRESHOLD_MS;
  }

  // ─── Sync State Management ───────────────────────────────────────────────

  private async getOrCreateSyncState(tenantId: string): Promise<any> {
    const [state] = await db.select().from(syncState)
      .where(and(
        eq(syncState.tenantId, tenantId),
        eq(syncState.provider, this.adapter.platformName),
        eq(syncState.resource, 'all'),
      ));

    if (state) return state;

    // Create new state entry
    const [created] = await db.insert(syncState).values({
      tenantId,
      provider: this.adapter.platformName,
      resource: 'all',
      syncStatus: 'idle',
    }).returning();

    return created;
  }

  private async updateSyncState(tenantId: string, updates: Record<string, any>) {
    const state = await this.getOrCreateSyncState(tenantId);

    const setData: Record<string, any> = { updatedAt: new Date() };

    if (updates.syncStatus) setData.syncStatus = updates.syncStatus;
    if (updates.lastSyncMode) setData.metadata = { ...((state.metadata as any) || {}), lastSyncMode: updates.lastSyncMode };
    if (updates.lastSyncCompletedAt) setData.lastSyncAt = updates.lastSyncCompletedAt;
    if (updates.lastSuccessfulSyncAt) setData.lastSuccessfulSyncAt = updates.lastSuccessfulSyncAt;
    if (updates.lastSyncError !== undefined) setData.errorMessage = updates.lastSyncError;
    if (updates.lastSyncResult) {
      setData.metadata = {
        ...((setData.metadata || state.metadata || {}) as any),
        lastSyncResult: updates.lastSyncResult,
      };
    }
    if (updates.invoicesCursor) setData.syncCursor = updates.invoicesCursor;
    if (updates.consecutiveFailures !== undefined) {
      setData.metadata = {
        ...((setData.metadata || state.metadata || {}) as any),
        consecutiveFailures: updates.consecutiveFailures,
      };
    }
    if (updates.initialSyncComplete) setData.initialSyncComplete = true;
    if (updates.totalInvoicesSynced) setData.recordsProcessed = updates.totalInvoicesSynced;
    if (updates.totalContactsSynced) {
      setData.metadata = {
        ...((setData.metadata || state.metadata || {}) as any),
        totalContactsSynced: updates.totalContactsSynced,
      };
    }

    await db.update(syncState).set(setData).where(eq(syncState.id, state.id));
  }

  private async recordSyncFailure(tenantId: string, result: SyncResult) {
    const state = await this.getOrCreateSyncState(tenantId);
    const failures = ((state.metadata as any)?.consecutiveFailures ?? 0) + 1;

    await this.updateSyncState(tenantId, {
      syncStatus: 'failed',
      lastSyncError: result.errors[0] || 'Unknown error',
      lastSyncCompletedAt: result.completedAt,
      lastSyncResult: result,
      consecutiveFailures: failures,
    });

    if (failures >= CONSECUTIVE_FAILURES_PAUSE_CHARLIE) {
      console.error(`[SyncOrchestrator] ${failures} consecutive failures for ${tenantId} — Charlie should be paused for this tenant`);
    }
  }

  private async scheduleRetry(tenantId: string, trigger: SyncTrigger) {
    const state = await this.getOrCreateSyncState(tenantId);
    const failures = (state.metadata as any)?.consecutiveFailures ?? 0;
    const retryIdx = Math.min(failures - 1, RETRY_SCHEDULE.length - 1);

    if (retryIdx < 0 || retryIdx >= RETRY_SCHEDULE.length) return;

    const { delay, label } = RETRY_SCHEDULE[retryIdx];
    console.log(`[SyncOrchestrator] Scheduling retry for ${tenantId} in ${label}`);

    setTimeout(() => {
      this.enqueueSync(tenantId, 'incremental', trigger);
    }, delay);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Parse Xero dates safely — handles /Date(ms)/ format, ISO, and epoch */
  private safeParseDate(value: string | number | null | undefined): Date | null {
    if (!value) return null;
    if (typeof value === 'string') {
      const dotNetMatch = value.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
      if (dotNetMatch) return new Date(parseInt(dotNetMatch[1], 10));
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // ─── Audit Logging ───────────────────────────────────────────────────────

  private async logSyncAudit(tenantId: string, result: SyncResult, trigger: SyncTrigger) {
    // Store audit in metadata of sync state for now.
    // A dedicated sync_audit_log table can be added when needed.
    try {
      const state = await this.getOrCreateSyncState(tenantId);
      const auditLog: any[] = ((state.metadata as any)?.auditLog || []).slice(-49); // Keep last 50
      auditLog.push({
        syncMode: result.syncMode,
        status: result.status,
        trigger,
        startedAt: result.startedAt.toISOString(),
        completedAt: result.completedAt.toISOString(),
        durationMs: result.durationMs,
        invoicesFetched: result.fetched.invoices,
        contactsFetched: result.fetched.contacts,
        changesDetected: result.processed.invoicesCreated + result.processed.invoicesUpdated + result.processed.statusChanges,
        errors: result.errors,
      });

      await db.update(syncState).set({
        metadata: { ...((state.metadata as any) || {}), auditLog },
        updatedAt: new Date(),
      }).where(eq(syncState.id, state.id));
    } catch { /* non-fatal */ }
  }
}
