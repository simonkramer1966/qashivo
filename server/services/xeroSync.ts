import { db, pool } from "../db";
import { tenants, cachedXeroInvoices, cachedXeroContacts, cachedXeroOverpayments, cachedXeroPrepayments, contacts, invoices, syncState } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { xeroService } from "./xero";
import { attentionItemService } from "./attentionItemService";
import { assignContactToDefaultSchedule } from "./strategySeeder";

export type SyncMode = 'initial' | 'ongoing';

const RATE_LIMIT_DELAY_MS = 1500; // 1.5 seconds between API calls

export class XeroSyncService {
  constructor() {}

  // ══════════════════════════════════════════════════════════════════
  // Sync state management
  // ══════════════════════════════════════════════════════════════════

  private async getSyncState(tenantId: string): Promise<{
    lastSuccessfulSyncAt: Date | null;
    initialSyncComplete: boolean;
  }> {
    const [state] = await db
      .select({
        lastSuccessfulSyncAt: syncState.lastSuccessfulSyncAt,
        initialSyncComplete: syncState.initialSyncComplete,
      })
      .from(syncState)
      .where(and(
        eq(syncState.tenantId, tenantId),
        eq(syncState.provider, 'xero'),
        eq(syncState.resource, 'invoices'),
      ));

    return {
      lastSuccessfulSyncAt: state?.lastSuccessfulSyncAt || null,
      initialSyncComplete: state?.initialSyncComplete ?? false,
    };
  }

  private async updateSyncState(tenantId: string, updates: {
    syncStatus: string;
    errorMessage?: string | null;
    counts?: { processed: number; created: number; updated: number; failed: number };
    markInitialComplete?: boolean;
  }): Promise<void> {
    const now = new Date();
    const [existing] = await db
      .select({ id: syncState.id })
      .from(syncState)
      .where(and(
        eq(syncState.tenantId, tenantId),
        eq(syncState.provider, 'xero'),
        eq(syncState.resource, 'invoices'),
      ));

    const data: any = {
      lastSyncAt: now,
      syncStatus: updates.syncStatus,
      errorMessage: updates.errorMessage ?? null,
      updatedAt: now,
    };

    if (updates.syncStatus === 'success') {
      data.lastSuccessfulSyncAt = now;
    }
    if (updates.markInitialComplete) {
      data.initialSyncComplete = true;
    }
    if (updates.counts) {
      data.recordsProcessed = updates.counts.processed;
      data.recordsCreated = updates.counts.created;
      data.recordsUpdated = updates.counts.updated;
      data.recordsFailed = updates.counts.failed;
    }

    if (existing) {
      await db.update(syncState).set(data).where(eq(syncState.id, existing.id));
    } else {
      await db.insert(syncState).values({
        tenantId,
        provider: 'xero',
        resource: 'invoices',
        ...data,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Main sync: fetch invoices → cache → extract contacts → upsert
  // ══════════════════════════════════════════════════════════════════

  async syncInvoicesAndContacts(tenantId: string, mode: SyncMode = 'initial', onProgress?: (counts: { contactCount: number; invoiceCount: number }) => void): Promise<{
    success: boolean;
    invoicesCount: number;
    contactsCount: number;
    error?: string;
  }> {
    try {
      // Determine effective mode from sync_state
      const state = await this.getSyncState(tenantId);
      const isInitial = !state.initialSyncComplete;
      const effectiveMode = mode === 'initial' ? 'initial' : (isInitial ? 'initial' : 'ongoing');

      console.log(`📄 Xero sync for tenant: ${tenantId} (requested: ${mode}, effective: ${effectiveMode}, initialComplete: ${state.initialSyncComplete})`);

      // Mark sync as running
      await this.updateSyncState(tenantId, { syncStatus: 'syncing' });

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) throw new Error("Tenant not found");
      if (!tenant.xeroAccessToken) throw new Error("Xero access token not found for tenant");

      const tokens = {
        accessToken: tenant.xeroAccessToken,
        refreshToken: tenant.xeroRefreshToken!,
        expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000),
        tenantId: tenant.xeroTenantId!,
      };

      // ── Step 1: Fetch invoices from Xero ─────────────────────────
      // INITIAL: Only AUTHORISED + SUBMITTED (open invoices we need to chase)
      // ONGOING: All statuses via modifiedSince — catches when tracked invoices move to PAID
      const whereClause = `Type=="ACCREC"`;
      const additionalHeaders: Record<string, string> = {};
      let statusFilter = '';

      if (effectiveMode === 'initial') {
        // Only fetch open invoices — no need for paid/voided/deleted history
        statusFilter = '&Statuses=AUTHORISED,SUBMITTED';
        console.log(`  Initial sync: fetching only AUTHORISED + SUBMITTED invoices`);
      } else if (state.lastSuccessfulSyncAt) {
        // Ongoing: all statuses so we catch status changes (PAID, VOIDED, etc.)
        additionalHeaders['If-Modified-Since'] = state.lastSuccessfulSyncAt.toISOString();
        console.log(`  Using If-Modified-Since: ${state.lastSuccessfulSyncAt.toISOString()}`);
      }

      // Clear cached table before populating
      await db.delete(cachedXeroInvoices).where(eq(cachedXeroInvoices.tenantId, tenantId));

      let totalInvoicesCount = 0;
      let currentPage = 1;
      let hasNextPage = true;
      const uniqueContactIds = new Map<string, { name: string }>();

      while (hasNextPage) {
        try {
          const endpoint = `Invoices?where=${encodeURIComponent(whereClause)}${statusFilter}&page=${currentPage}`;
          console.log(`  📄 Fetching invoice page ${currentPage}...`);

          const response = await xeroService.makeAuthenticatedRequestPublic(
            tokens, endpoint, 'GET', undefined, tenantId, additionalHeaders
          );
          const pageInvoices = response.Invoices || [];

          if (pageInvoices.length > 0) {
            // Extract unique contact IDs
            for (const invoice of pageInvoices) {
              const contact = invoice.Contact as any;
              if (contact?.ContactID) {
                uniqueContactIds.set(contact.ContactID, { name: contact.Name || 'Unknown' });
              }
            }

            // Cache invoices — LEAN: only operational fields, no line items/metadata
            const invoicesToInsert = pageInvoices.map((invoice: any) => ({
              tenantId,
              xeroInvoiceId: invoice.InvoiceID,
              xeroContactId: invoice.Contact?.ContactID || null,
              invoiceNumber: invoice.InvoiceNumber || `INV-${invoice.InvoiceID.substring(0, 8)}`,
              reference: invoice.Reference || null,
              amount: (invoice.Total ?? 0).toString(),
              amountDue: (invoice.AmountDue ?? 0).toString(),
              amountPaid: (invoice.AmountPaid ?? 0).toString(),
              taxAmount: (invoice.TotalTax ?? 0).toString(),
              xeroStatus: invoice.Status || 'UNKNOWN',
              status: this.mapXeroStatus(invoice.Status, {
                amountPaid: invoice.AmountPaid,
                totalAmount: invoice.Total,
              }),
              issueDate: this.parseXeroDate(invoice.DateString || invoice.Date),
              dueDate: this.parseXeroDate(invoice.DueDateString || invoice.DueDate || invoice.DateString || invoice.Date),
              paidDate: invoice.FullyPaidOnDate ? this.parseXeroDate(invoice.FullyPaidOnDate) : null,
              currency: invoice.CurrencyCode || "GBP",
              updatedDateUtc: invoice.UpdatedDateUTC ? this.parseXeroDate(invoice.UpdatedDateUTC) : null,
            }));

            try {
              await db.insert(cachedXeroInvoices).values(invoicesToInsert);
              totalInvoicesCount += invoicesToInsert.length;
              console.log(`  ✅ Page ${currentPage}: ${invoicesToInsert.length} invoices cached`);
              onProgress?.({ contactCount: 0, invoiceCount: totalInvoicesCount });
            } catch (cacheErr: any) {
              console.error(`❌ Cache insert failed page ${currentPage}: ${cacheErr?.message}`);
              throw cacheErr;
            }
          }

          hasNextPage = pageInvoices.length === 100;
          currentPage++;

          if (hasNextPage) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
          }
        } catch (pageError) {
          console.error(`  Error fetching invoice page ${currentPage}:`, pageError);
          hasNextPage = false;
        }
      }

      console.log(`✅ Fetched ${totalInvoicesCount} invoices in ${currentPage - 1} API calls`);
      console.log(`📇 Found ${uniqueContactIds.size} unique contacts from invoices`);

      // ── Step 2: Fetch contact details + cache in cached_xero_contacts ──
      await db.delete(cachedXeroContacts).where(eq(cachedXeroContacts.tenantId, tenantId));

      const contactDetailsMap = new Map<string, {
        email: string | null;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        contactStatus: string;
        isCustomer: boolean;
        isSupplier: boolean;
      }>();

      if (uniqueContactIds.size > 0) {
        const contactIdArray = Array.from(uniqueContactIds.keys());
        const batchSize = 50;
        for (let i = 0; i < contactIdArray.length; i += batchSize) {
          const batch = contactIdArray.slice(i, i + batchSize);
          const batchNum = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(contactIdArray.length / batchSize);
          console.log(`  📇 Contact details batch ${batchNum}/${totalBatches} (${batch.length} contacts)`);

          try {
            const idsParam = batch.join(',');
            const response = await xeroService.makeAuthenticatedRequestPublic(
              tokens, `Contacts?IDs=${idsParam}`, 'GET', undefined, tenantId
            );

            const contactsToCache: any[] = [];
            for (const c of (response.Contacts || [])) {
              const details = {
                email: c.EmailAddress || null,
                phone: c.Phones?.find((p: any) => p.PhoneType === 'DEFAULT')?.PhoneNumber || null,
                firstName: c.FirstName || null,
                lastName: c.LastName || null,
                contactStatus: c.ContactStatus || 'ACTIVE',
                isCustomer: c.IsCustomer ?? false,
                isSupplier: c.IsSupplier ?? false,
              };
              contactDetailsMap.set(c.ContactID, details);

              contactsToCache.push({
                tenantId,
                xeroContactId: c.ContactID,
                name: c.Name || 'Unknown',
                firstName: details.firstName,
                lastName: details.lastName,
                emailAddress: details.email,
                phone: details.phone,
                contactStatus: details.contactStatus,
                isCustomer: details.isCustomer,
                isSupplier: details.isSupplier,
              });
            }

            if (contactsToCache.length > 0) {
              await db.insert(cachedXeroContacts).values(contactsToCache);
            }
          } catch (batchErr: any) {
            console.warn(`  ⚠️ Contact details batch failed: ${batchErr.message}`);
          }

          if (i + batchSize < contactIdArray.length) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
          }
        }
        console.log(`✅ Fetched and cached details for ${contactDetailsMap.size} contacts`);
      }

      // ── Step 3: Upsert contacts into main contacts table ───────────
      const existingContacts = await db.select().from(contacts).where(eq(contacts.tenantId, tenantId));
      const existingByXeroId = new Map(
        existingContacts.filter(c => c.xeroContactId).map(c => [c.xeroContactId, c])
      );

      let contactsCreated = 0;
      let contactsUpdated = 0;

      for (const [xeroContactId, contactInfo] of Array.from(uniqueContactIds.entries())) {
        try {
          const details = contactDetailsMap.get(xeroContactId);
          const existing = existingByXeroId.get(xeroContactId);

          if (existing) {
            await db.update(contacts).set({
              name: contactInfo.name,
              email: details?.email || existing.email,
              phone: details?.phone || existing.phone,
              companyName: contactInfo.name,
              isActive: true,
              updatedAt: new Date(),
            }).where(eq(contacts.id, existing.id));
            contactsUpdated++;
          } else {
            const [newContact] = await db.insert(contacts).values({
              tenantId,
              xeroContactId,
              name: contactInfo.name,
              email: details?.email || null,
              phone: details?.phone || null,
              companyName: contactInfo.name,
              role: 'customer',
              isActive: true,
            }).returning();
            try {
              await assignContactToDefaultSchedule(tenantId, newContact.id);
            } catch (seedErr) {
              console.warn(`  Schedule assign failed for ${newContact.id}:`, seedErr);
            }
            contactsCreated++;
          }
        } catch (err: any) {
          console.warn(`  Failed to sync contact ${contactInfo.name}: ${err.message}`);
        }
      }

      const totalContacts = contactsCreated + contactsUpdated;
      console.log(`✅ Contacts: ${contactsCreated} created, ${contactsUpdated} updated (${totalContacts} total)`);
      onProgress?.({ contactCount: totalContacts, invoiceCount: totalInvoicesCount });

      // ── Step 4: Process cached invoices into main invoices table ──
      const processCounts = await this.processCachedInvoices(tenantId);
      console.log(`✅ Processed ${processCounts.processed}/${totalInvoicesCount} invoices (${processCounts.created} new, ${processCounts.updated} updated, ${processCounts.failed} failed)`);

      // ── Step 4b: Sync overpayments and prepayments for reconciliation ──
      const overpaymentCount = await this.syncOverpayments(tenantId, tokens);
      const prepaymentCount = await this.syncPrepayments(tenantId, tokens);
      console.log(`✅ Credits: ${overpaymentCount} overpayments, ${prepaymentCount} prepayments`);

      // ── Step 5: Record successful sync ────────────────────────────
      await this.updateSyncState(tenantId, {
        syncStatus: 'success',
        counts: processCounts,
        markInitialComplete: isInitial, // Only set on first successful sync
      });
      await db.update(tenants).set({ xeroLastSyncAt: new Date() }).where(eq(tenants.id, tenantId));

      const totalApiCalls = (currentPage - 1) + Math.ceil(uniqueContactIds.size / 50);
      console.log(`📊 Total Xero API calls: ${totalApiCalls}`);

      return {
        success: true,
        invoicesCount: totalInvoicesCount,
        contactsCount: contactsCreated + contactsUpdated,
      };
    } catch (error) {
      console.error("Xero sync failed:", error);
      // Record failure — if initial sync, initialSyncComplete stays false so retry re-runs full sync
      await this.updateSyncState(tenantId, {
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }).catch(() => {}); // Don't let state update failure mask the real error
      return {
        success: false,
        invoicesCount: 0,
        contactsCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Process cached invoices into main invoices table (always upsert)
  // ══════════════════════════════════════════════════════════════════

  async processCachedInvoices(tenantId: string): Promise<{
    processed: number;
    created: number;
    updated: number;
    failed: number;
  }> {
    try {
      const cachedInvoices = await db
        .select()
        .from(cachedXeroInvoices)
        .where(eq(cachedXeroInvoices.tenantId, tenantId));

      console.log(`  processCachedInvoices: ${cachedInvoices.length} cached invoices`);
      if (cachedInvoices.length === 0) {
        return { processed: 0, created: 0, updated: 0, failed: 0 };
      }

      let created = 0;
      let updated = 0;
      let failed = 0;

      // Pre-load contacts for O(1) matching
      const allContacts = await db.select().from(contacts).where(eq(contacts.tenantId, tenantId));
      const contactsByXeroId = new Map(
        allContacts.filter(c => c.xeroContactId).map(c => [c.xeroContactId!, c])
      );

      // Pre-load existing invoices for O(1) upsert lookup
      const existingInvoices = await db
        .select({ id: invoices.id, xeroInvoiceId: invoices.xeroInvoiceId })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), sql`${invoices.xeroInvoiceId} IS NOT NULL`));
      const existingByXeroId = new Map(
        existingInvoices.map(inv => [inv.xeroInvoiceId!, inv.id])
      );

      for (const cachedInv of cachedInvoices) {
        try {
          // Use lean xeroContactId column (not JSONB blob)
          const contactXeroId = cachedInv.xeroContactId;

          if (!contactXeroId) {
            continue; // Skip invoices without a contact
          }

          const contact = contactsByXeroId.get(contactXeroId);
          if (!contact) {
            continue; // Contact not in our DB
          }

          // Map status for display
          let mappedStatus = cachedInv.status;
          if (cachedInv.status === 'unpaid' || cachedInv.status === 'partial') {
            mappedStatus = new Date(cachedInv.dueDate) < new Date() ? 'overdue' : 'pending';
          }

          // Map raw Xero status to invoiceStatus field
          const rawXeroStatus = cachedInv.xeroStatus;
          let invoiceStatus = 'OPEN';
          if (rawXeroStatus === 'PAID') invoiceStatus = 'PAID';
          else if (rawXeroStatus === 'VOIDED') invoiceStatus = 'VOID';
          else if (rawXeroStatus === 'DELETED') invoiceStatus = 'DELETED';
          else if (rawXeroStatus === 'DRAFT') invoiceStatus = 'DRAFT';

          const existingId = existingByXeroId.get(cachedInv.xeroInvoiceId);

          if (existingId) {
            // Update Xero-sourced fields ONLY — preserve AR overlay fields
            await db.update(invoices).set({
              contactId: contact.id,
              invoiceNumber: cachedInv.invoiceNumber,
              amount: cachedInv.amount,
              amountPaid: cachedInv.amountPaid,
              taxAmount: cachedInv.taxAmount,
              status: mappedStatus,
              invoiceStatus,
              paidDate: cachedInv.paidDate,
              dueDate: cachedInv.dueDate,
              issueDate: cachedInv.issueDate,
              currency: cachedInv.currency,
              updatedAt: new Date(),
            }).where(eq(invoices.id, existingId));
            updated++;
          } else {
            await db.insert(invoices).values({
              tenantId,
              contactId: contact.id,
              xeroInvoiceId: cachedInv.xeroInvoiceId,
              invoiceNumber: cachedInv.invoiceNumber,
              amount: cachedInv.amount,
              amountPaid: cachedInv.amountPaid,
              taxAmount: cachedInv.taxAmount,
              status: mappedStatus,
              invoiceStatus,
              issueDate: cachedInv.issueDate,
              dueDate: cachedInv.dueDate,
              paidDate: cachedInv.paidDate,
              currency: cachedInv.currency,
            });
            created++;
          }
        } catch (error: any) {
          failed++;
          if (failed <= 5) {
            console.error(`❌ Upsert failed for invoice ${cachedInv.invoiceNumber}: ${error?.message}`);
          }
        }
      }

      const processed = created + updated;
      console.log(`  Upsert summary: ${created} created, ${updated} updated, ${failed} failed, ${cachedInvoices.length - processed - failed} skipped`);
      return { processed, created, updated, failed };
    } catch (error) {
      console.error("Fatal error in processCachedInvoices:", error);
      return { processed: 0, created: 0, updated: 0, failed: 0 };
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Sync overpayments and prepayments (for reconciliation)
  // ══════════════════════════════════════════════════════════════════

  async syncOverpayments(tenantId: string, tokens: { accessToken: string; refreshToken: string; expiresAt: Date; tenantId: string }): Promise<number> {
    try {
      console.log(`💰 Syncing overpayments for tenant ${tenantId}...`);
      await db.delete(cachedXeroOverpayments).where(eq(cachedXeroOverpayments.tenantId, tenantId));

      let total = 0;
      let currentPage = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const endpoint = `Overpayments?where=${encodeURIComponent('Type=="RECEIVE-OVERPAYMENT"')}&page=${currentPage}`;
        const response = await xeroService.makeAuthenticatedRequestPublic(
          tokens, endpoint, 'GET', undefined, tenantId
        );
        const overpayments = response.Overpayments || [];

        if (overpayments.length > 0) {
          const toInsert = overpayments.map((op: any) => ({
            tenantId,
            xeroOverpaymentId: op.OverpaymentID,
            xeroContactId: op.Contact?.ContactID || null,
            status: op.Status || 'AUTHORISED',
            date: op.DateString ? this.parseXeroDate(op.DateString) : (op.Date ? this.parseXeroDate(op.Date) : null),
            total: (op.Total ?? 0).toString(),
            remainingCredit: (op.RemainingCredit ?? 0).toString(),
            updatedDateUtc: op.UpdatedDateUTC ? this.parseXeroDate(op.UpdatedDateUTC) : null,
          }));

          await db.insert(cachedXeroOverpayments).values(toInsert);
          total += toInsert.length;
        }

        hasNextPage = overpayments.length === 100;
        currentPage++;
        if (hasNextPage) await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
      }

      console.log(`✅ Synced ${total} overpayments`);
      return total;
    } catch (error) {
      console.error('❌ Overpayments sync failed:', error);
      return 0;
    }
  }

  async syncPrepayments(tenantId: string, tokens: { accessToken: string; refreshToken: string; expiresAt: Date; tenantId: string }): Promise<number> {
    try {
      console.log(`💰 Syncing prepayments for tenant ${tenantId}...`);
      await db.delete(cachedXeroPrepayments).where(eq(cachedXeroPrepayments.tenantId, tenantId));

      let total = 0;
      let currentPage = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const endpoint = `Prepayments?where=${encodeURIComponent('Type=="RECEIVE-PREPAYMENT"')}&page=${currentPage}`;
        const response = await xeroService.makeAuthenticatedRequestPublic(
          tokens, endpoint, 'GET', undefined, tenantId
        );
        const prepayments = response.Prepayments || [];

        if (prepayments.length > 0) {
          const toInsert = prepayments.map((pp: any) => ({
            tenantId,
            xeroPrepaymentId: pp.PrepaymentID,
            xeroContactId: pp.Contact?.ContactID || null,
            status: pp.Status || 'AUTHORISED',
            date: pp.DateString ? this.parseXeroDate(pp.DateString) : (pp.Date ? this.parseXeroDate(pp.Date) : null),
            total: (pp.Total ?? 0).toString(),
            remainingCredit: (pp.RemainingCredit ?? 0).toString(),
            updatedDateUtc: pp.UpdatedDateUTC ? this.parseXeroDate(pp.UpdatedDateUTC) : null,
          }));

          await db.insert(cachedXeroPrepayments).values(toInsert);
          total += toInsert.length;
        }

        hasNextPage = prepayments.length === 100;
        currentPage++;
        if (hasNextPage) await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
      }

      console.log(`✅ Synced ${total} prepayments`);
      return total;
    } catch (error) {
      console.error('❌ Prepayments sync failed:', error);
      return 0;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════════════

  /** Parse Xero date strings: ISO "2025-01-15", .NET "/Date(1609459200000+0000)/", or epoch ms */
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
      console.warn(`[xeroSync] Invalid date value "${value}", using current date`);
      return new Date();
    }
    return parsed;
  }

  private mapXeroStatus(xeroStatus: string, paymentDetails?: any): string {
    switch (xeroStatus?.toUpperCase()) {
      case 'AUTHORISED':
        if (paymentDetails?.amountPaid && parseFloat(paymentDetails.amountPaid) > 0) {
          return paymentDetails.amountPaid === paymentDetails.totalAmount ? 'paid' : 'partial';
        }
        return 'unpaid';
      case 'PAID': return 'paid';
      case 'VOIDED': return 'void';
      case 'DELETED': return 'void';
      case 'DRAFT': return 'draft';
      default: return 'unpaid';
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Read-only helpers
  // ══════════════════════════════════════════════════════════════════

  async getCachedInvoices(tenantId: string, status?: string): Promise<any[]> {
    try {
      const whereConditions = [eq(cachedXeroInvoices.tenantId, tenantId)];
      if (status) whereConditions.push(eq(cachedXeroInvoices.status, status));

      const result = await db.select().from(cachedXeroInvoices).where(and(...whereConditions));
      return result.map(invoice => ({
        id: invoice.xeroInvoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount: parseFloat(invoice.amount),
        amountDue: parseFloat(invoice.amountDue || '0'),
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        status: invoice.status,
        xeroStatus: invoice.xeroStatus,
        currency: invoice.currency,
        syncedAt: invoice.syncedAt?.toISOString(),
      }));
    } catch (error) {
      console.error("Error fetching cached invoices:", error);
      return [];
    }
  }

  async getLastSyncTime(tenantId: string): Promise<Date | null> {
    try {
      const [tenant] = await db.select({ xeroLastSyncAt: tenants.xeroLastSyncAt }).from(tenants).where(eq(tenants.id, tenantId));
      return tenant?.xeroLastSyncAt || null;
    } catch (error) {
      console.error("Error fetching last sync time:", error);
      return null;
    }
  }

  async getSyncSettings(tenantId: string): Promise<{ syncInterval: number; autoSync: boolean; lastSyncAt: Date | null } | null> {
    try {
      const [tenant] = await db.select({
        xeroSyncInterval: tenants.xeroSyncInterval,
        xeroAutoSync: tenants.xeroAutoSync,
        xeroLastSyncAt: tenants.xeroLastSyncAt,
      }).from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) return null;
      return { syncInterval: tenant.xeroSyncInterval || 60, autoSync: tenant.xeroAutoSync ?? true, lastSyncAt: tenant.xeroLastSyncAt };
    } catch (error) {
      console.error("Error fetching sync settings:", error);
      return null;
    }
  }

  async updateSyncSettings(tenantId: string, settings: { syncInterval?: number; autoSync?: boolean }): Promise<boolean> {
    try {
      await db.update(tenants).set({
        ...(settings.syncInterval !== undefined && { xeroSyncInterval: settings.syncInterval }),
        ...(settings.autoSync !== undefined && { xeroAutoSync: settings.autoSync }),
      }).where(eq(tenants.id, tenantId));
      return true;
    } catch (error) {
      console.error("Error updating sync settings:", error);
      return false;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // INITIAL SYNC — clean sweep + fresh insert
  // ══════════════════════════════════════════════════════════════════

  private async clearTenantDataForFreshSync(tenantId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log('🧹 INITIAL SYNC: Clearing tenant data in FK-safe order...');

      const tables = [
        'message_drafts', 'compliance_checks', 'action_logs', 'action_items',
        'attention_items', 'activity_logs', 'outcomes', 'payment_promises',
        'invoice_health_scores', 'wallet_transactions', 'finance_advances',
        'risk_scores', 'action_effectiveness', 'customer_learning_profiles',
        'customer_schedule_assignments', 'email_domain_mappings', 'email_sender_mappings',
        'magic_link_tokens', 'customer_preferences', 'debtor_profiles',
        'customer_behavior_signals', 'user_contact_assignments', 'customer_contact_persons',
        'contact_notes',
        'workflow_timers', 'timeline_events', 'email_messages', 'email_clarifications',
        'inbound_messages', 'contact_outcomes', 'policy_decisions', 'voice_calls',
        'sms_messages', 'interest_ledger', 'disputes', 'promises_to_pay',
        'debtor_payments', 'conversations',
        'actions',
        'payment_plan_invoices', 'payment_plans',
        'bank_transactions', 'bank_accounts', 'bills',
        'cached_xero_overpayments', 'cached_xero_prepayments',
        'cached_xero_invoices', 'cached_xero_contacts', 'invoices', 'contacts',
      ];

      for (const table of tables) {
        try {
          if (table === 'payment_plan_invoices') {
            await client.query(
              `DELETE FROM payment_plan_invoices WHERE payment_plan_id IN (SELECT id FROM payment_plans WHERE tenant_id = $1)`,
              [tenantId]
            );
          } else {
            await client.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
          }
        } catch (err: any) {
          if (err.code !== '42P01') {
            console.warn(`  ⚠️  Error clearing ${table}:`, err.message);
          }
        }
      }

      // Clear sync state so retry re-runs full initial sync
      await client.query(`DELETE FROM sync_state WHERE tenant_id = $1 AND provider = 'xero'`, [tenantId]);

      await client.query('COMMIT');
      console.log('✅ Tenant data cleared');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ══════════════════════════════════════════════════════════════════

  async syncAllDataForTenant(tenantId: string, mode: SyncMode = 'initial', onProgress?: (counts: { contactCount: number; invoiceCount: number }) => void): Promise<{
    success: boolean;
    contactsCount: number;
    invoicesCount: number;
    billsCount: number;
    bankAccountsCount: number;
    bankTransactionsCount: number;
    filteredCount: number;
    syncMode: SyncMode;
    error?: string;
  }> {
    try {
      console.log(`🚀 Starting ${mode.toUpperCase()} Xero sync for tenant: ${tenantId}`);

      if (mode === 'initial') {
        await this.clearTenantDataForFreshSync(tenantId);
      }

      const result = await this.syncInvoicesAndContacts(tenantId, mode, onProgress);
      if (!result.success) {
        throw new Error(`Sync failed: ${result.error}`);
      }

      console.log(`🎉 Sync completed: ${result.contactsCount} contacts, ${result.invoicesCount} invoices`);

      try {
        const count = await attentionItemService.createDataQualityAttentionItems(tenantId);
        if (count > 0) console.log(`📋 Created ${count} data quality attention items`);
      } catch (error) {
        console.warn('Failed to create data quality attention items:', error);
      }

      return {
        success: true,
        contactsCount: result.contactsCount,
        invoicesCount: result.invoicesCount,
        billsCount: 0,
        bankAccountsCount: 0,
        bankTransactionsCount: 0,
        filteredCount: result.contactsCount,
        syncMode: mode,
      };
    } catch (error) {
      console.error(`${mode.toUpperCase()} sync failed:`, error);
      return {
        success: false,
        contactsCount: 0,
        invoicesCount: 0,
        billsCount: 0,
        bankAccountsCount: 0,
        bankTransactionsCount: 0,
        filteredCount: 0,
        syncMode: mode,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
