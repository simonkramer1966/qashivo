import { db, pool } from "../db";
import { tenants, cachedXeroInvoices, bills, contacts, bankAccounts, bankTransactions, invoices } from "@shared/schema";
import { eq, and, sql, notInArray } from "drizzle-orm";
import { xeroService } from "./xero";
import { attentionItemService } from "./attentionItemService";
import { assignContactToDefaultSchedule } from "./strategySeeder";

export type SyncMode = 'initial' | 'ongoing';

export class XeroSyncService {
  constructor() {
    // Use the existing xeroService instance
  }

  // ── Contact sync (used by both modes) ──────────────────────────────

  async syncContactsForTenant(tenantId: string): Promise<{
    success: boolean;
    contactsCount: number;
    filteredCount: number;
    error?: string;
  }> {
    try {
      console.log(`🔍 Starting filtered Xero contact sync for tenant: ${tenantId}`);

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant || !tenant.xeroAccessToken) {
        throw new Error("Tenant not found or Xero access token missing");
      }

      const contactSyncResult = await xeroService.syncContactsToDatabase(
        {
          accessToken: tenant.xeroAccessToken,
          refreshToken: tenant.xeroRefreshToken!,
          expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000),
          tenantId: tenant.xeroTenantId!,
        },
        tenantId
      );

      console.log(`✅ Contact sync completed: ${contactSyncResult.synced} contacts synced (${contactSyncResult.filtered} filtered)`);

      return {
        success: true,
        contactsCount: contactSyncResult.synced,
        filteredCount: contactSyncResult.filtered,
      };
    } catch (error) {
      console.error("Contact sync failed:", error);
      return {
        success: false,
        contactsCount: 0,
        filteredCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ── Invoice sync (fetches from Xero API into cache, then processes) ─

  async syncInvoicesForTenant(tenantId: string, mode: SyncMode = 'initial'): Promise<{
    success: boolean;
    invoicesCount: number;
    error?: string;
  }> {
    try {
      console.log(`Starting Xero invoice sync for tenant: ${tenantId} (mode: ${mode})`);

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant) throw new Error("Tenant not found");
      if (!tenant.xeroAccessToken) throw new Error("Xero access token not found for tenant");

      let totalInvoicesCount = 0;

      // Always replace the cache table (no FK deps on it)
      await db.delete(cachedXeroInvoices).where(eq(cachedXeroInvoices.tenantId, tenantId));
      console.log("Cleared existing cached invoices");

      // Fetch ALL invoices from Xero (paid + unpaid)
      let currentPage = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        try {
          const response = await xeroService.getInvoicesPaginated(
            {
              accessToken: tenant.xeroAccessToken,
              refreshToken: tenant.xeroRefreshToken!,
              expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000),
              tenantId: tenant.xeroTenantId!,
            },
            currentPage,
            100,
            'all',
            tenantId
          );

          if (response.invoices && response.invoices.length > 0) {
            const invoicesToInsert = response.invoices.map((invoice: any) => {
              let actualPaidDate: Date | null = null;
              if (invoice.Status === 'PAID' || (invoice.AmountPaid && invoice.AmountPaid > 0)) {
                const payments = response.payments.get(invoice.InvoiceID);
                if (payments && payments.length > 0) {
                  const sortedPayments = payments.sort((a: any, b: any) =>
                    new Date(b.Date).getTime() - new Date(a.Date).getTime()
                  );
                  actualPaidDate = new Date(sortedPayments[0].Date);
                }
              }

              return {
                tenantId,
                xeroInvoiceId: invoice.InvoiceID,
                invoiceNumber: invoice.InvoiceNumber,
                amount: invoice.Total.toString(),
                amountPaid: invoice.AmountPaid?.toString() || "0",
                taxAmount: invoice.TotalTax?.toString() || "0",
                status: this.mapXeroStatus(invoice.Status, { amountPaid: invoice.AmountPaid, totalAmount: invoice.Total }),
                issueDate: new Date(invoice.DateString),
                dueDate: new Date(invoice.DueDateString),
                paidDate: actualPaidDate,
                description: `Invoice ${invoice.InvoiceNumber}` || null,
                currency: invoice.CurrencyCode || "USD",
                contact: invoice.Contact || null,
                paymentDetails: {
                  amountPaid: invoice.AmountPaid || 0,
                  amountDue: invoice.AmountDue || 0,
                  totalAmount: invoice.Total || 0,
                  payments: response.payments.get(invoice.InvoiceID) || [],
                },
                metadata: {
                  xeroStatus: invoice.Status,
                  invoiceType: invoice.Type,
                  subTotal: invoice.SubTotal,
                  lineItems: invoice.LineItems || [],
                  branding: invoice.BrandingThemeID || null,
                },
              };
            });

            await db.insert(cachedXeroInvoices).values(invoicesToInsert);
            totalInvoicesCount += invoicesToInsert.length;
            console.log(`📄 Cached ${invoicesToInsert.length} invoices from page ${currentPage}`);
          }

          hasNextPage = response.pagination.hasNextPage;
          currentPage++;

          // Rate limiting: wait 1 second between paginated calls
          if (hasNextPage) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (pageError) {
          console.error(`Error fetching page ${currentPage}:`, pageError);
          hasNextPage = false;
        }
      }

      await db.update(tenants).set({ xeroLastSyncAt: new Date() }).where(eq(tenants.id, tenantId));

      // Process cached invoices into main invoices table
      const processedCount = await this.processCachedInvoices(tenantId, mode);
      console.log(`✅ Processed ${processedCount} collection-relevant invoices (mode: ${mode})`);

      return { success: true, invoicesCount: totalInvoicesCount };
    } catch (error) {
      console.error("Xero invoice sync failed:", error);
      return {
        success: false,
        invoicesCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ── Process cached invoices into main invoices table ────────────────

  async processCachedInvoices(tenantId: string, mode: SyncMode = 'initial'): Promise<number> {
    try {
      const cachedInvoices = await db
        .select()
        .from(cachedXeroInvoices)
        .where(eq(cachedXeroInvoices.tenantId, tenantId));

      console.log(`📊 Processing ${cachedInvoices.length} cached invoices (mode: ${mode})...`);

      const collectionRelevant = cachedInvoices.filter(inv => {
        const amountDue = parseFloat(inv.amount) - parseFloat(inv.amountPaid || "0");
        return (inv.status === 'unpaid' || inv.status === 'partial') && amountDue > 0;
      });

      console.log(`🎯 Found ${collectionRelevant.length} collection-relevant invoices`);

      let processedCount = 0;
      const seenXeroInvoiceIds: string[] = [];

      for (const cachedInv of collectionRelevant) {
        try {
          const contactXeroId = (cachedInv.contact as any)?.ContactID;
          const contactName = (cachedInv.contact as any)?.Name;

          if (!contactXeroId) {
            console.warn(`⚠️  Skipping invoice ${cachedInv.invoiceNumber} - no contact ID`);
            continue;
          }

          seenXeroInvoiceIds.push(cachedInv.xeroInvoiceId);

          // Find or create contact
          let [contact] = await db
            .select()
            .from(contacts)
            .where(and(eq(contacts.tenantId, tenantId), eq(contacts.xeroContactId, contactXeroId)));

          if (!contact) {
            const [newContact] = await db
              .insert(contacts)
              .values({ tenantId, xeroContactId: contactXeroId, name: contactName || 'Unknown', role: 'customer' })
              .returning();
            contact = newContact;
            try {
              await assignContactToDefaultSchedule(tenantId, newContact.id);
            } catch (seedErr) {
              console.warn(`[xero-sync] Failed to assign schedule for contact ${newContact.id}:`, seedErr);
            }
          }

          let mappedStatus = cachedInv.status;
          if (cachedInv.status === 'unpaid' || cachedInv.status === 'partial') {
            mappedStatus = new Date(cachedInv.dueDate) < new Date() ? 'overdue' : 'pending';
          }

          if (mode === 'ongoing') {
            // Upsert: update if exists by xeroInvoiceId, insert if new
            const [existing] = await db
              .select({ id: invoices.id })
              .from(invoices)
              .where(and(eq(invoices.tenantId, tenantId), eq(invoices.xeroInvoiceId, cachedInv.xeroInvoiceId)));

            if (existing) {
              await db.update(invoices).set({
                contactId: contact.id,
                invoiceNumber: cachedInv.invoiceNumber,
                amount: cachedInv.amount,
                amountPaid: cachedInv.amountPaid,
                taxAmount: cachedInv.taxAmount,
                status: mappedStatus,
                issueDate: cachedInv.issueDate,
                dueDate: cachedInv.dueDate,
                paidDate: cachedInv.paidDate,
                description: cachedInv.description,
                currency: cachedInv.currency,
                updatedAt: new Date(),
              }).where(eq(invoices.id, existing.id));
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
                issueDate: cachedInv.issueDate,
                dueDate: cachedInv.dueDate,
                paidDate: cachedInv.paidDate,
                description: cachedInv.description,
                currency: cachedInv.currency,
              });
            }
          } else {
            // Initial mode: just insert (table was already cleared)
            await db.insert(invoices).values({
              tenantId,
              contactId: contact.id,
              xeroInvoiceId: cachedInv.xeroInvoiceId,
              invoiceNumber: cachedInv.invoiceNumber,
              amount: cachedInv.amount,
              amountPaid: cachedInv.amountPaid,
              taxAmount: cachedInv.taxAmount,
              status: mappedStatus,
              issueDate: cachedInv.issueDate,
              dueDate: cachedInv.dueDate,
              paidDate: cachedInv.paidDate,
              description: cachedInv.description,
              currency: cachedInv.currency,
            });
          }

          processedCount++;
        } catch (error) {
          console.error(`Error processing invoice ${cachedInv.invoiceNumber}:`, error);
        }
      }

      // Ongoing mode: mark invoices no longer in Xero as paid/resolved
      if (mode === 'ongoing' && seenXeroInvoiceIds.length > 0) {
        try {
          const staleResult = await db.update(invoices)
            .set({ status: 'paid', updatedAt: new Date() })
            .where(and(
              eq(invoices.tenantId, tenantId),
              sql`${invoices.xeroInvoiceId} IS NOT NULL`,
              notInArray(invoices.xeroInvoiceId, seenXeroInvoiceIds),
              sql`${invoices.status} NOT IN ('paid', 'void', 'voided')`,
            ));
          console.log(`📦 Marked stale invoices as paid (no longer collection-relevant in Xero)`);
        } catch (err) {
          console.warn('Could not mark stale invoices:', err);
        }
      }

      console.log(`✅ Successfully processed ${processedCount} invoices into main table`);
      return processedCount;
    } catch (error) {
      console.error("Error processing cached invoices:", error);
      return 0;
    }
  }

  // ── Bills sync ─────────────────────────────────────────────────────

  async syncBillsForTenant(tenantId: string): Promise<{
    success: boolean;
    billsCount: number;
    error?: string;
  }> {
    try {
      console.log(`🧾 Starting Xero bills sync for tenant: ${tenantId}`);

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant || !tenant.xeroAccessToken) throw new Error("Tenant not found or Xero access token missing");

      let totalBillsCount = 0;
      let currentPage = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        try {
          const xeroBills = await xeroService.getBills(
            {
              accessToken: tenant.xeroAccessToken,
              refreshToken: tenant.xeroRefreshToken!,
              expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000),
              tenantId: tenant.xeroTenantId!,
            },
            { status: 'all', page: currentPage },
            tenantId
          );

          if (xeroBills && xeroBills.length > 0) {
            const billsToInsert = [];
            for (const bill of xeroBills) {
              let [contact] = await db.select().from(contacts)
                .where(and(eq(contacts.tenantId, tenantId), eq(contacts.xeroContactId, bill.Contact.ContactID)));

              if (!contact) {
                const [newContact] = await db.insert(contacts)
                  .values({ tenantId, xeroContactId: bill.Contact.ContactID, name: bill.Contact.Name, role: 'vendor' })
                  .returning();
                contact = newContact;
              }

              billsToInsert.push({
                tenantId,
                vendorId: contact.id,
                xeroInvoiceId: bill.InvoiceID,
                billNumber: bill.InvoiceNumber,
                amount: bill.Total.toString(),
                amountPaid: bill.AmountPaid?.toString() || "0",
                taxAmount: bill.TotalTax?.toString() || "0",
                status: this.mapXeroStatus(bill.Status, { amountPaid: bill.AmountPaid, totalAmount: bill.Total }),
                issueDate: new Date(bill.DateString),
                dueDate: new Date(bill.DueDateString),
                paidDate: bill.Status === 'PAID' ? new Date(bill.DateString) : null,
                description: `Bill ${bill.InvoiceNumber}`,
                currency: bill.CurrencyCode || "USD",
                reference: bill.InvoiceNumber,
              });
            }

            if (billsToInsert.length > 0) {
              await db.insert(bills).values(billsToInsert);
              totalBillsCount += billsToInsert.length;
              console.log(`📄 Synced ${billsToInsert.length} bills from page ${currentPage}`);
            }
          }

          hasNextPage = xeroBills && xeroBills.length === 100;
          currentPage++;

          // Rate limiting: wait 1 second between paginated calls
          if (hasNextPage) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (pageError) {
          console.error(`Error fetching bills page ${currentPage}:`, pageError);
          hasNextPage = false;
        }
      }

      return { success: true, billsCount: totalBillsCount };
    } catch (error) {
      console.error("Bills sync failed:", error);
      return { success: false, billsCount: 0, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // ── Bank accounts sync ─────────────────────────────────────────────

  async syncBankAccountsForTenant(tenantId: string): Promise<{
    success: boolean;
    accountsCount: number;
    error?: string;
  }> {
    try {
      console.log(`🏦 Starting Xero bank accounts sync for tenant: ${tenantId}`);

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant || !tenant.xeroAccessToken) throw new Error("Tenant not found or Xero access token missing");

      const xeroAccounts = await xeroService.getBankAccounts(
        {
          accessToken: tenant.xeroAccessToken,
          refreshToken: tenant.xeroRefreshToken!,
          expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000),
          tenantId: tenant.xeroTenantId!,
        },
        { activeOnly: false },
        tenantId
      );

      if (xeroAccounts && xeroAccounts.length > 0) {
        const accountsToInsert = xeroAccounts.map((account: any) => ({
          tenantId,
          xeroAccountId: account.AccountID,
          name: account.Name,
          accountNumber: account.BankAccountNumber || null,
          accountType: this.mapBankAccountType(account.BankAccountType),
          currency: account.CurrencyCode || "USD",
          currentBalance: "0",
          isActive: account.Status === 'ACTIVE',
          bankName: account.BankName || null,
          description: account.Description || null,
        }));

        await db.insert(bankAccounts).values(accountsToInsert);
        console.log(`✅ Bank accounts sync completed: ${accountsToInsert.length} accounts`);
        return { success: true, accountsCount: accountsToInsert.length };
      }

      return { success: true, accountsCount: 0 };
    } catch (error) {
      console.error("Bank accounts sync failed:", error);
      return { success: false, accountsCount: 0, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // ── Bank transactions sync ─────────────────────────────────────────

  async syncBankTransactionsForTenant(tenantId: string, dateFrom?: Date): Promise<{
    success: boolean;
    transactionsCount: number;
    error?: string;
  }> {
    try {
      console.log(`💰 Starting Xero bank transactions sync for tenant: ${tenantId}`);

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant || !tenant.xeroAccessToken) throw new Error("Tenant not found or Xero access token missing");

      const accounts = await db.select().from(bankAccounts).where(eq(bankAccounts.tenantId, tenantId));
      let totalTransactionsCount = 0;

      for (const account of accounts) {
        if (!account.xeroAccountId) continue;
        let currentPage = 1;
        let hasNextPage = true;

        while (hasNextPage) {
          try {
            const xeroTransactions = await xeroService.getBankTransactions(
              {
                accessToken: tenant.xeroAccessToken,
                refreshToken: tenant.xeroRefreshToken!,
                expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000),
                tenantId: tenant.xeroTenantId!,
              },
              {
                bankAccountId: account.xeroAccountId,
                dateFrom: dateFrom || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
                page: currentPage,
              },
              tenantId
            );

            if (xeroTransactions && xeroTransactions.length > 0) {
              const transactionsToInsert = xeroTransactions.map((txn: any) => ({
                tenantId,
                bankAccountId: account.id,
                xeroTransactionId: txn.BankTransactionID,
                transactionDate: new Date(txn.DateString),
                amount: txn.Total?.toString() || "0",
                type: txn.Type === 'RECEIVE' ? 'credit' : 'debit',
                description: txn.LineItems?.[0]?.Description || txn.Reference || null,
                reference: txn.Reference || null,
                category: txn.LineItems?.[0]?.AccountCode || null,
                isReconciled: txn.IsReconciled || false,
                reconciledAt: txn.IsReconciled ? new Date() : null,
                metadata: { xeroType: txn.Type, status: txn.Status, lineItems: txn.LineItems || [] },
              }));

              await db.insert(bankTransactions).values(transactionsToInsert);
              totalTransactionsCount += transactionsToInsert.length;
            }

            hasNextPage = xeroTransactions && xeroTransactions.length === 100;
            currentPage++;

            // Rate limiting: wait 1 second between paginated calls
            if (hasNextPage) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (pageError) {
            console.error(`Error fetching transactions for account ${account.name}, page ${currentPage}:`, pageError);
            hasNextPage = false;
          }
        }
      }

      return { success: true, transactionsCount: totalTransactionsCount };
    } catch (error) {
      console.error("Bank transactions sync failed:", error);
      return { success: false, transactionsCount: 0, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private mapBankAccountType(xeroType: string): string {
    switch (xeroType?.toUpperCase()) {
      case 'BANK': return 'checking';
      case 'CREDITCARD': return 'credit_card';
      case 'PAYPAL': return 'cash';
      default: return 'checking';
    }
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
      case 'DRAFT': return 'draft';
      default: return 'unpaid';
    }
  }

  // ── Read-only helpers ──────────────────────────────────────────────

  async getCachedInvoices(tenantId: string, status?: string): Promise<any[]> {
    try {
      const whereConditions = [eq(cachedXeroInvoices.tenantId, tenantId)];
      if (status) whereConditions.push(eq(cachedXeroInvoices.status, status));

      const result = await db.select().from(cachedXeroInvoices).where(and(...whereConditions));
      return result.map(invoice => ({
        id: invoice.xeroInvoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount: parseFloat(invoice.amount),
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        status: invoice.status,
        currency: invoice.currency,
        contact: invoice.contact,
        paymentDetails: invoice.paymentDetails,
        metadata: invoice.metadata,
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
  // INITIAL SYNC — clean sweep + fresh insert (replaces demo data)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Delete all tenant data that depends on invoices/contacts in correct FK order.
   * Wrapped in a single transaction for atomicity.
   */
  private async clearTenantDataForFreshSync(tenantId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log('🧹 INITIAL SYNC: Clearing all tenant data in FK-safe order...');

      // Delete in reverse-FK order: leaf tables first, then parents
      const tables = [
        // Leaf tables that reference actions/invoices/contacts
        'message_drafts',
        'compliance_checks',
        'action_logs',
        'action_items',
        'attention_items',
        'activity_logs',
        'outcomes',
        'payment_promises',
        'invoice_health_scores',
        'wallet_transactions',
        'finance_advances',
        'risk_scores',
        'action_effectiveness',
        'customer_learning_profiles',
        'customer_schedule_assignments',
        'email_domain_mappings',
        'email_sender_mappings',
        'magic_link_tokens',
        'customer_preferences',
        'debtor_profiles',
        'customer_behavior_signals',
        'user_contact_assignments',
        'customer_contact_persons',
        'contact_notes',
        // Tables referencing invoices and/or contacts
        'workflow_timers',
        'timeline_events',
        'email_messages',
        'email_clarifications',
        'inbound_messages',
        'contact_outcomes',
        'policy_decisions',
        'voice_calls',
        'sms_messages',
        'interest_ledger',
        'disputes',
        'promises_to_pay',
        'debtor_payments',
        'conversations',
        // actions references invoices + contacts
        'actions',
        // payment_plans references contacts; payment_plan_invoices references both
        'payment_plan_invoices',  // handled specially below
        'payment_plans',
        // Synced data tables
        'bank_transactions',
        'bank_accounts',
        'bills',
        'cached_xero_invoices',
        'invoices',
        'contacts',
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
          if (err.code === '42P01') {
            // Table doesn't exist yet — skip
          } else {
            console.warn(`  ⚠️  Error clearing ${table}:`, err.message);
          }
        }
      }

      await client.query('COMMIT');
      console.log('✅ All tenant data cleared successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT — syncAllDataForTenant(tenantId, mode)
  // ══════════════════════════════════════════════════════════════════

  async syncAllDataForTenant(tenantId: string, mode: SyncMode = 'initial'): Promise<{
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

      // INITIAL mode: clean sweep first
      if (mode === 'initial') {
        await this.clearTenantDataForFreshSync(tenantId);
      }

      // Sync contacts (upsert by xeroContactId — handled inside xeroService.syncContactsToDatabase)
      const contactResult = await this.syncContactsForTenant(tenantId);
      if (!contactResult.success) {
        throw new Error(`Contact sync failed: ${contactResult.error}`);
      }

      // Sync invoices (mode determines insert vs upsert in processCachedInvoices)
      const invoiceResult = await this.syncInvoicesForTenant(tenantId, mode);
      if (!invoiceResult.success) {
        throw new Error(`Invoice sync failed: ${invoiceResult.error}`);
      }

      // Bills sync (only in initial mode — ongoing doesn't need to re-sync bills)
      let billsResult: { success: boolean; billsCount: number; error?: string } = { success: true, billsCount: 0 };
      if (mode === 'initial') {
        billsResult = await this.syncBillsForTenant(tenantId);
        if (!billsResult.success) console.warn(`Bills sync failed: ${billsResult.error}`);
      }

      // Bank accounts (only in initial mode)
      let bankAccountsResult: { success: boolean; accountsCount: number; error?: string } = { success: true, accountsCount: 0 };
      if (mode === 'initial') {
        bankAccountsResult = await this.syncBankAccountsForTenant(tenantId);
        if (!bankAccountsResult.success) console.warn(`Bank accounts sync failed: ${bankAccountsResult.error}`);
      }

      // Bank transactions (only in initial mode)
      let bankTransactionsResult: { success: boolean; transactionsCount: number; error?: string } = { success: true, transactionsCount: 0 };
      if (mode === 'initial') {
        bankTransactionsResult = await this.syncBankTransactionsForTenant(tenantId);
        if (!bankTransactionsResult.success) console.warn(`Bank transactions sync failed: ${bankTransactionsResult.error}`);
      }

      console.log(`🎉 ${mode.toUpperCase()} sync completed:
        ✅ ${contactResult.contactsCount} contacts
        ✅ ${invoiceResult.invoicesCount} invoices
        ${mode === 'initial' ? `✅ ${billsResult.billsCount} bills` : ''}
        ${mode === 'initial' ? `✅ ${bankAccountsResult.accountsCount} bank accounts` : ''}
        ${mode === 'initial' ? `✅ ${bankTransactionsResult.transactionsCount} bank transactions` : ''}`);

      // Data quality attention items
      try {
        const count = await attentionItemService.createDataQualityAttentionItems(tenantId);
        if (count > 0) console.log(`📋 Created ${count} data quality attention items`);
      } catch (error) {
        console.warn('Failed to create data quality attention items:', error);
      }

      return {
        success: true,
        contactsCount: contactResult.contactsCount,
        invoicesCount: invoiceResult.invoicesCount,
        billsCount: billsResult.billsCount,
        bankAccountsCount: bankAccountsResult.accountsCount,
        bankTransactionsCount: bankTransactionsResult.transactionsCount,
        filteredCount: contactResult.filteredCount,
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
