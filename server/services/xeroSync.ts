import { db } from "../db";
import { tenants, cachedXeroInvoices } from "@shared/schema";
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

      // Fetch only collection-relevant invoices from Xero (filtering out unnecessary data)
      let totalInvoicesCount = 0;

      // Clear existing cached invoices for this tenant
      await db
        .delete(cachedXeroInvoices)
        .where(eq(cachedXeroInvoices.tenantId, tenantId));

      console.log("Cleared existing cached invoices");
      console.log("🎯 Syncing only collection-relevant invoices (unpaid with outstanding balances)");

      // Fetch unpaid invoices (AUTHORISED/SUBMITTED with outstanding balances)
      // Use 'unpaid' status which maps to: Status==AUTHORISED AND AmountDue>0
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
            'unpaid', // Maps to AUTHORISED invoices with AmountDue>0
            tenantId // Pass tenant ID for automatic token refresh and DB updates
          );

          if (response.invoices && response.invoices.length > 0) {
            // Transform and insert invoices - map Xero API fields to database schema
            const invoicesToInsert = response.invoices.map((invoice: any) => ({
              tenantId,
              xeroInvoiceId: invoice.InvoiceID,
              invoiceNumber: invoice.InvoiceNumber,
              amount: invoice.Total.toString(),
              amountPaid: invoice.AmountPaid?.toString() || "0",
              taxAmount: invoice.TotalTax?.toString() || "0",
              status: this.mapXeroStatus(invoice.Status, { amountPaid: invoice.AmountPaid, totalAmount: invoice.Total }),
              issueDate: new Date(invoice.DateString),
              dueDate: new Date(invoice.DueDateString),
              paidDate: invoice.Status === 'PAID' && invoice.AmountPaid ? new Date(invoice.DateString) : null,
              description: `Invoice ${invoice.InvoiceNumber}` || null,
              currency: invoice.CurrencyCode || "USD",
              contact: invoice.Contact || null,
              paymentDetails: {
                amountPaid: invoice.AmountPaid || 0,
                amountDue: invoice.AmountDue || 0,
                totalAmount: invoice.Total || 0
              },
              metadata: {
                xeroStatus: invoice.Status,
                invoiceType: invoice.Type,
                subTotal: invoice.SubTotal,
                lineItems: invoice.LineItems || [],
                branding: invoice.BrandingThemeID || null,
              },
            }));

            await db.insert(cachedXeroInvoices).values(invoicesToInsert);
            totalInvoicesCount += invoicesToInsert.length;
            
            console.log(`📄 Cached ${invoicesToInsert.length} unpaid invoices from page ${currentPage}`);
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
    filteredCount: number;
    error?: string;
  }> {
    try {
      console.log(`🚀 Starting complete filtered Xero sync for tenant: ${tenantId}`);

      // Sync contacts first (with filtering)
      const contactResult = await this.syncContactsForTenant(tenantId);
      if (!contactResult.success) {
        throw new Error(`Contact sync failed: ${contactResult.error}`);
      }

      // Then sync invoices (with filtering)
      const invoiceResult = await this.syncInvoicesForTenant(tenantId);
      if (!invoiceResult.success) {
        throw new Error(`Invoice sync failed: ${invoiceResult.error}`);
      }

      console.log(`🎉 Complete sync successful: ${contactResult.contactsCount} contacts, ${invoiceResult.invoicesCount} invoices (filtered from ~15,000+ total)`);

      return {
        success: true,
        contactsCount: contactResult.contactsCount,
        invoicesCount: invoiceResult.invoicesCount,
        filteredCount: contactResult.filteredCount,
      };

    } catch (error) {
      console.error("Complete sync failed:", error);
      return {
        success: false,
        contactsCount: 0,
        invoicesCount: 0,
        filteredCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}