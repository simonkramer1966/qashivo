import { db } from "../db";
import { tenants, cachedXeroInvoices, bills, contacts, bankAccounts, bankTransactions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { xeroService } from "./xero";

export class XeroSyncService {
  constructor() {
    // Use the existing xeroService instance
  }

  async syncContactsForTenant(tenantId: string): Promise<{
    success: boolean;
    contactsCount: number;
    filteredCount: number;
    error?: string;
  }> {
    try {
      console.log(`🔍 Starting filtered Xero contact sync for tenant: ${tenantId}`);

      // Get tenant with Xero tokens
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant || !tenant.xeroAccessToken) {
        throw new Error("Tenant not found or Xero access token missing");
      }

      // Sync contacts with collection-focused filters
      const contactSyncResult = await xeroService.syncContactsToDatabase(
        {
          accessToken: tenant.xeroAccessToken,
          refreshToken: tenant.xeroRefreshToken!,
          expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000), // Use stored expiry or fallback
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

  async syncInvoicesForTenant(tenantId: string): Promise<{
    success: boolean;
    invoicesCount: number;
    error?: string;
  }> {
    try {
      console.log(`Starting Xero sync for tenant: ${tenantId}`);

      // Get tenant with Xero tokens
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant) {
        throw new Error("Tenant not found");
      }

      if (!tenant.xeroAccessToken) {
        throw new Error("Xero access token not found for tenant");
      }

      // Fetch ALL invoices from Xero for comprehensive analysis (paid + unpaid)
      let totalInvoicesCount = 0;

      // Clear existing cached invoices for this tenant
      await db
        .delete(cachedXeroInvoices)
        .where(eq(cachedXeroInvoices.tenantId, tenantId));

      console.log("Cleared existing cached invoices");
      console.log("🎯 Syncing ALL invoices (paid and unpaid) for comprehensive cashflow analysis");

      // Fetch ALL invoices (no status filter - for cashflow forecasting and payment analysis)
      let currentPage = 1;
      let hasNextPage = true;
      
      while (hasNextPage) {
        try {
          const response = await xeroService.getInvoicesPaginated(
            {
              accessToken: tenant.xeroAccessToken,
              refreshToken: tenant.xeroRefreshToken!,
              expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000), // Use stored expiry or fallback
              tenantId: tenant.xeroTenantId!,
            },
            currentPage,
            100, // pageSize  
            'all', // Fetch ALL invoices for comprehensive analysis
            tenantId // Pass tenant ID for automatic token refresh and DB updates
          );

          if (response.invoices && response.invoices.length > 0) {
            // Transform and insert invoices - map Xero API fields to database schema
            const invoicesToInsert = response.invoices.map((invoice: any) => {
              // Get actual payment date from payments map (not issue date!)
              let actualPaidDate: Date | null = null;
              if (invoice.Status === 'PAID' || (invoice.AmountPaid && invoice.AmountPaid > 0)) {
                const payments = response.payments.get(invoice.InvoiceID);
                if (payments && payments.length > 0) {
                  // Get the most recent payment date as the paid date
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
                paidDate: actualPaidDate, // Use actual payment date from payments, not issue date
                description: `Invoice ${invoice.InvoiceNumber}` || null,
                currency: invoice.CurrencyCode || "USD",
                contact: invoice.Contact || null,
                paymentDetails: {
                  amountPaid: invoice.AmountPaid || 0,
                  amountDue: invoice.AmountDue || 0,
                  totalAmount: invoice.Total || 0,
                  payments: response.payments.get(invoice.InvoiceID) || [] // Store payment history
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

          // Update pagination control
          hasNextPage = response.pagination.hasNextPage;
          currentPage++;
          
          console.log(`📋 Page ${currentPage - 1} complete. HasNextPage: ${hasNextPage}, Total cached so far: ${totalInvoicesCount}`);
          
        } catch (pageError) {
          console.error(`Error fetching page ${currentPage}:`, pageError);
          // For page errors, break the loop to avoid infinite retry
          hasNextPage = false;
        }
      }

      // Update tenant's last sync timestamp
      await db
        .update(tenants)
        .set({ xeroLastSyncAt: new Date() })
        .where(eq(tenants.id, tenantId));

      console.log(`✅ Invoice sync completed. Total collection-relevant invoices cached: ${totalInvoicesCount}`);

      // Now process cached invoices and insert collection-relevant ones into main invoices table
      const processedCount = await this.processCachedInvoices(tenantId);
      console.log(`✅ Processed ${processedCount} collection-relevant invoices into main invoices table`);

      return {
        success: true,
        invoicesCount: totalInvoicesCount,
      };

    } catch (error) {
      console.error("Xero sync failed:", error);
      return {
        success: false,
        invoicesCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async processCachedInvoices(tenantId: string): Promise<number> {
    try {
      // Get all collection-relevant cached invoices (AUTHORISED status with amount due)
      const cachedInvoices = await db
        .select()
        .from(cachedXeroInvoices)
        .where(eq(cachedXeroInvoices.tenantId, tenantId));

      console.log(`📊 Processing ${cachedInvoices.length} cached invoices...`);

      // Filter for collection-relevant: AUTHORISED status with outstanding amount
      const collectionRelevant = cachedInvoices.filter(inv => {
        const xeroStatus = inv.metadata?.xeroStatus;
        const amountDue = parseFloat(inv.amount) - parseFloat(inv.amountPaid || "0");
        return xeroStatus === 'AUTHORISED' && amountDue > 0;
      });

      console.log(`🎯 Found ${collectionRelevant.length} collection-relevant invoices (AUTHORISED with amount due)`);

      // Clear existing invoices for this tenant
      await db
        .delete(invoices)
        .where(eq(invoices.tenantId, tenantId));

      console.log(`🗑️  Cleared existing invoices`);

      let processedCount = 0;

      // Insert collection-relevant invoices into main table
      for (const cachedInv of collectionRelevant) {
        try {
          // Find or create contact
          const contactXeroId = cachedInv.contact?.ContactID;
          const contactName = cachedInv.contact?.Name;

          if (!contactXeroId) {
            console.warn(`⚠️  Skipping invoice ${cachedInv.invoiceNumber} - no contact ID`);
            continue;
          }

          let [contact] = await db
            .select()
            .from(contacts)
            .where(
              and(
                eq(contacts.tenantId, tenantId),
                eq(contacts.xeroContactId, contactXeroId)
              )
            );

          if (!contact) {
            // Create contact if it doesn't exist
            const [newContact] = await db
              .insert(contacts)
              .values({
                tenantId,
                xeroContactId: contactXeroId,
                name: contactName || 'Unknown',
                role: 'customer',
              })
              .returning();
            contact = newContact;
          }

          // Insert invoice
          await db
            .insert(invoices)
            .values({
              tenantId,
              contactId: contact.id,
              xeroInvoiceId: cachedInv.xeroInvoiceId,
              invoiceNumber: cachedInv.invoiceNumber,
              amount: cachedInv.amount,
              amountPaid: cachedInv.amountPaid,
              taxAmount: cachedInv.taxAmount,
              status: cachedInv.status,
              issueDate: cachedInv.issueDate,
              dueDate: cachedInv.dueDate,
              paidDate: cachedInv.paidDate,
              description: cachedInv.description,
              currency: cachedInv.currency,
            });

          processedCount++;
        } catch (error) {
          console.error(`Error processing invoice ${cachedInv.invoiceNumber}:`, error);
        }
      }

      console.log(`✅ Successfully processed ${processedCount} invoices into main table`);
      return processedCount;

    } catch (error) {
      console.error("Error processing cached invoices:", error);
      return 0;
    }
  }

  async syncBillsForTenant(tenantId: string): Promise<{
    success: boolean;
    billsCount: number;
    error?: string;
  }> {
    try {
      console.log(`🧾 Starting Xero bills sync for tenant: ${tenantId}`);

      // Get tenant with Xero tokens
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant || !tenant.xeroAccessToken) {
        throw new Error("Tenant not found or Xero access token missing");
      }

      // Fetch ALL bills from Xero for cashflow analysis
      let totalBillsCount = 0;

      // Clear existing bills for this tenant
      await db
        .delete(bills)
        .where(eq(bills.tenantId, tenantId));

      console.log("Cleared existing bills");
      console.log("🎯 Syncing ALL bills (paid and unpaid) for cashflow forecasting");

      // Fetch bills paginated
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
            // Get or create vendor contacts
            const billsToInsert = [];
            
            for (const bill of xeroBills) {
              // Find or create contact for vendor
              let [contact] = await db
                .select()
                .from(contacts)
                .where(
                  and(
                    eq(contacts.tenantId, tenantId),
                    eq(contacts.xeroContactId, bill.Contact.ContactID)
                  )
                );

              if (!contact) {
                // Create vendor contact
                const [newContact] = await db
                  .insert(contacts)
                  .values({
                    tenantId,
                    xeroContactId: bill.Contact.ContactID,
                    name: bill.Contact.Name,
                    role: 'vendor',
                  })
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

          // Check if there are more pages
          hasNextPage = xeroBills && xeroBills.length === 100; // Xero's default page size
          currentPage++;
          
        } catch (pageError) {
          console.error(`Error fetching bills page ${currentPage}:`, pageError);
          hasNextPage = false;
        }
      }

      console.log(`✅ Bills sync completed. Total bills synced: ${totalBillsCount}`);

      return {
        success: true,
        billsCount: totalBillsCount,
      };

    } catch (error) {
      console.error("Bills sync failed:", error);
      return {
        success: false,
        billsCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async syncBankAccountsForTenant(tenantId: string): Promise<{
    success: boolean;
    accountsCount: number;
    error?: string;
  }> {
    try {
      console.log(`🏦 Starting Xero bank accounts sync for tenant: ${tenantId}`);

      // Get tenant with Xero tokens
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant || !tenant.xeroAccessToken) {
        throw new Error("Tenant not found or Xero access token missing");
      }

      // Fetch ALL bank accounts from Xero
      const xeroAccounts = await xeroService.getBankAccounts(
        {
          accessToken: tenant.xeroAccessToken,
          refreshToken: tenant.xeroRefreshToken!,
          expiresAt: tenant.xeroExpiresAt || new Date(Date.now() + 30 * 60 * 1000),
          tenantId: tenant.xeroTenantId!,
        },
        { activeOnly: false }, // Get all accounts including inactive
        tenantId
      );

      // Clear existing bank accounts for this tenant
      await db
        .delete(bankAccounts)
        .where(eq(bankAccounts.tenantId, tenantId));

      if (xeroAccounts && xeroAccounts.length > 0) {
        const accountsToInsert = xeroAccounts.map((account: any) => ({
          tenantId,
          xeroAccountId: account.AccountID,
          name: account.Name,
          accountNumber: account.BankAccountNumber || null,
          accountType: this.mapBankAccountType(account.BankAccountType),
          currency: account.CurrencyCode || "USD",
          currentBalance: "0", // Xero doesn't provide real-time balance via API
          isActive: account.Status === 'ACTIVE',
          bankName: account.BankName || null,
          description: account.Description || null,
        }));

        await db.insert(bankAccounts).values(accountsToInsert);
        console.log(`✅ Bank accounts sync completed. Total accounts synced: ${accountsToInsert.length}`);

        return {
          success: true,
          accountsCount: accountsToInsert.length,
        };
      }

      console.log(`✅ Bank accounts sync completed. No accounts found.`);
      return {
        success: true,
        accountsCount: 0,
      };

    } catch (error) {
      console.error("Bank accounts sync failed:", error);
      return {
        success: false,
        accountsCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async syncBankTransactionsForTenant(tenantId: string, dateFrom?: Date): Promise<{
    success: boolean;
    transactionsCount: number;
    error?: string;
  }> {
    try {
      console.log(`💰 Starting Xero bank transactions sync for tenant: ${tenantId}`);

      // Get tenant with Xero tokens
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant || !tenant.xeroAccessToken) {
        throw new Error("Tenant not found or Xero access token missing");
      }

      // Get all bank accounts for this tenant to fetch transactions per account
      const accounts = await db
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.tenantId, tenantId));

      let totalTransactionsCount = 0;

      // Clear existing bank transactions for this tenant
      await db
        .delete(bankTransactions)
        .where(eq(bankTransactions.tenantId, tenantId));

      console.log(`Fetching transactions for ${accounts.length} bank accounts`);

      // Fetch transactions for each bank account
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
                dateFrom: dateFrom || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year by default
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
                metadata: {
                  xeroType: txn.Type,
                  status: txn.Status,
                  lineItems: txn.LineItems || [],
                },
              }));

              await db.insert(bankTransactions).values(transactionsToInsert);
              totalTransactionsCount += transactionsToInsert.length;
              console.log(`📊 Synced ${transactionsToInsert.length} transactions for account ${account.name} (page ${currentPage})`);
            }

            hasNextPage = xeroTransactions && xeroTransactions.length === 100;
            currentPage++;

          } catch (pageError) {
            console.error(`Error fetching transactions for account ${account.name}, page ${currentPage}:`, pageError);
            hasNextPage = false;
          }
        }
      }

      console.log(`✅ Bank transactions sync completed. Total transactions synced: ${totalTransactionsCount}`);

      return {
        success: true,
        transactionsCount: totalTransactionsCount,
      };

    } catch (error) {
      console.error("Bank transactions sync failed:", error);
      return {
        success: false,
        transactionsCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private mapBankAccountType(xeroType: string): string {
    switch (xeroType?.toUpperCase()) {
      case 'BANK':
        return 'checking';
      case 'CREDITCARD':
        return 'credit_card';
      case 'PAYPAL':
        return 'cash'; // Treat as cash equivalent
      default:
        return 'checking';
    }
  }

  private mapXeroStatus(xeroStatus: string, paymentDetails?: any): string {
    // Map Xero statuses to our internal status format
    switch (xeroStatus?.toUpperCase()) {
      case 'AUTHORISED':
        if (paymentDetails?.amountPaid && parseFloat(paymentDetails.amountPaid) > 0) {
          return paymentDetails.amountPaid === paymentDetails.totalAmount ? 'paid' : 'partial';
        }
        return 'unpaid';
      case 'PAID':
        return 'paid';
      case 'VOIDED':
        return 'void';
      case 'DRAFT':
        return 'draft';
      default:
        return 'unpaid';
    }
  }

  async getCachedInvoices(tenantId: string, status?: string): Promise<any[]> {
    try {
      const whereConditions = [eq(cachedXeroInvoices.tenantId, tenantId)];
      
      if (status) {
        whereConditions.push(eq(cachedXeroInvoices.status, status));
      }

      const query = db
        .select()
        .from(cachedXeroInvoices)
        .where(and(...whereConditions));

      const invoices = await query;
      
      return invoices.map(invoice => ({
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
      const [tenant] = await db
        .select({ xeroLastSyncAt: tenants.xeroLastSyncAt })
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      return tenant?.xeroLastSyncAt || null;
    } catch (error) {
      console.error("Error fetching last sync time:", error);
      return null;
    }
  }

  async getSyncSettings(tenantId: string): Promise<{
    syncInterval: number;
    autoSync: boolean;
    lastSyncAt: Date | null;
  } | null> {
    try {
      const [tenant] = await db
        .select({
          xeroSyncInterval: tenants.xeroSyncInterval,
          xeroAutoSync: tenants.xeroAutoSync,
          xeroLastSyncAt: tenants.xeroLastSyncAt,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant) return null;

      return {
        syncInterval: tenant.xeroSyncInterval || 60,
        autoSync: tenant.xeroAutoSync ?? true,
        lastSyncAt: tenant.xeroLastSyncAt,
      };
    } catch (error) {
      console.error("Error fetching sync settings:", error);
      return null;
    }
  }

  async updateSyncSettings(tenantId: string, settings: {
    syncInterval?: number;
    autoSync?: boolean;
  }): Promise<boolean> {
    try {
      await db
        .update(tenants)
        .set({
          ...(settings.syncInterval !== undefined && { xeroSyncInterval: settings.syncInterval }),
          ...(settings.autoSync !== undefined && { xeroAutoSync: settings.autoSync }),
        })
        .where(eq(tenants.id, tenantId));

      return true;
    } catch (error) {
      console.error("Error updating sync settings:", error);
      return false;
    }
  }

  async syncAllDataForTenant(tenantId: string): Promise<{
    success: boolean;
    contactsCount: number;
    invoicesCount: number;
    billsCount: number;
    bankAccountsCount: number;
    bankTransactionsCount: number;
    filteredCount: number;
    error?: string;
  }> {
    try {
      console.log(`🚀 Starting comprehensive Xero sync for tenant: ${tenantId}`);

      // Sync contacts first (with filtering)
      const contactResult = await this.syncContactsForTenant(tenantId);
      if (!contactResult.success) {
        throw new Error(`Contact sync failed: ${contactResult.error}`);
      }

      // Sync invoices (ALL - paid and unpaid)
      const invoiceResult = await this.syncInvoicesForTenant(tenantId);
      if (!invoiceResult.success) {
        throw new Error(`Invoice sync failed: ${invoiceResult.error}`);
      }

      // Sync bills (ACCPAY invoices)
      const billsResult = await this.syncBillsForTenant(tenantId);
      if (!billsResult.success) {
        console.warn(`Bills sync failed: ${billsResult.error}`); // Don't fail entire sync
      }

      // Sync bank accounts
      const bankAccountsResult = await this.syncBankAccountsForTenant(tenantId);
      if (!bankAccountsResult.success) {
        console.warn(`Bank accounts sync failed: ${bankAccountsResult.error}`); // Don't fail entire sync
      }

      // Sync bank transactions (last year)
      const bankTransactionsResult = await this.syncBankTransactionsForTenant(tenantId);
      if (!bankTransactionsResult.success) {
        console.warn(`Bank transactions sync failed: ${bankTransactionsResult.error}`); // Don't fail entire sync
      }

      console.log(`🎉 Comprehensive sync completed:
        ✅ ${contactResult.contactsCount} contacts
        ✅ ${invoiceResult.invoicesCount} invoices
        ✅ ${billsResult.billsCount} bills
        ✅ ${bankAccountsResult.accountsCount} bank accounts
        ✅ ${bankTransactionsResult.transactionsCount} bank transactions`);

      return {
        success: true,
        contactsCount: contactResult.contactsCount,
        invoicesCount: invoiceResult.invoicesCount,
        billsCount: billsResult.billsCount,
        bankAccountsCount: bankAccountsResult.accountsCount,
        bankTransactionsCount: bankTransactionsResult.transactionsCount,
        filteredCount: contactResult.filteredCount,
      };

    } catch (error) {
      console.error("Complete sync failed:", error);
      return {
        success: false,
        contactsCount: 0,
        invoicesCount: 0,
        billsCount: 0,
        bankAccountsCount: 0,
        bankTransactionsCount: 0,
        filteredCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}