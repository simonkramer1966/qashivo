import { db } from "../db";
import { tenants, cachedXeroInvoices } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { xeroService } from "./xero";

export class XeroSyncService {
  constructor() {
    // Use the existing xeroService instance
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

      // Fetch all invoices from Xero
      const allStatuses = ['AUTHORISED', 'PAID', 'VOIDED', 'DRAFT'];
      let totalInvoicesCount = 0;

      // Clear existing cached invoices for this tenant
      await db
        .delete(cachedXeroInvoices)
        .where(eq(cachedXeroInvoices.tenantId, tenantId));

      console.log("Cleared existing cached invoices");

      // Fetch invoices for each status
      for (const status of allStatuses) {
        try {
          const response = await xeroService.getInvoicesPaginated(
            {
              accessToken: tenant.xeroAccessToken,
              refreshToken: tenant.xeroRefreshToken!,
              expiresAt: new Date(Date.now() + 3600000),
              tenantId: tenant.xeroTenantId!,
            },
            1, // page
            100, // pageSize  
            status.toLowerCase()
          );

          if (response.invoices && response.invoices.length > 0) {
            // Transform and insert invoices
            const invoicesToInsert = response.invoices.map((invoice: any) => ({
              tenantId,
              xeroInvoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount.toString(),
              amountPaid: invoice.paymentDetails?.amountPaid?.toString() || "0",
              taxAmount: invoice.taxAmount?.toString() || "0",
              status: this.mapXeroStatus(invoice.status, invoice.paymentDetails),
              issueDate: new Date(invoice.issueDate),
              dueDate: new Date(invoice.dueDate),
              paidDate: invoice.paymentDetails?.paidDate ? new Date(invoice.paymentDetails.paidDate) : null,
              description: invoice.description || null,
              currency: invoice.currency || "USD",
              contact: invoice.contact || null,
              paymentDetails: invoice.paymentDetails || null,
              metadata: {
                xeroStatus: invoice.status,
                lineItems: invoice.lineItems || [],
                branding: invoice.branding || null,
              },
            }));

            await db.insert(cachedXeroInvoices).values(invoicesToInsert);
            totalInvoicesCount += invoicesToInsert.length;
            
            console.log(`Cached ${invoicesToInsert.length} ${status} invoices`);
          }
        } catch (statusError) {
          console.error(`Error fetching ${status} invoices:`, statusError);
          // Continue with other statuses even if one fails
        }
      }

      // Update tenant's last sync timestamp
      await db
        .update(tenants)
        .set({ xeroLastSyncAt: new Date() })
        .where(eq(tenants.id, tenantId));

      console.log(`Sync completed. Total invoices cached: ${totalInvoicesCount}`);

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
      let query = db
        .select()
        .from(cachedXeroInvoices)
        .where(eq(cachedXeroInvoices.tenantId, tenantId));

      if (status) {
        query = query.where(and(
          eq(cachedXeroInvoices.tenantId, tenantId),
          eq(cachedXeroInvoices.status, status)
        ));
      }

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
}