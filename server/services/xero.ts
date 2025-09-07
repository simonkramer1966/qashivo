// Note: This is a simplified Xero integration structure
// In production, you would use the official Xero API SDK

interface XeroConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
}

interface XeroTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tenantId: string;
}

interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
  Phones?: Array<{ PhoneType: string; PhoneNumber: string }>;
  Addresses?: Array<{ AddressType: string; AddressLine1: string; City: string; PostalCode: string }>;
  IsActive: boolean;
}

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Type: 'ACCREC' | 'ACCPAY';
  Contact: { ContactID: string; Name: string };
  DateString: string;
  DueDateString: string;
  Status: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  SubTotal: number;
  TotalTax: number;
  Total: number;
  AmountDue: number;
  AmountPaid: number;
  CurrencyCode: string;
}

interface XeroPayment {
  PaymentID: string;
  InvoiceID: string;
  AccountID: string;
  Date: string;
  Amount: number;
  PaymentType: 'ACCRECPAYMENT' | 'ACCPAYPAYMENT' | 'ARCREDITPAYMENT' | 'APCREDITPAYMENT' | 'AROVERPAYMENTPAYMENT' | 'ARPREPAYMENTPAYMENT';
  Status: 'AUTHORISED' | 'DELETED';
  Reference?: string;
  IsReconciled: boolean;
  CurrencyRate?: number;
  PaymentMethod?: string;
  Account?: {
    AccountID: string;
    Name: string;
    Code: string;
  };
}

class XeroService {
  private config: XeroConfig;

  constructor() {
    // Get the current domain from environment or use localhost for development
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
    const protocol = domain.includes('localhost') ? 'http' : 'https';
    
    this.config = {
      clientId: process.env.XERO_CLIENT_ID || "default_client_id",
      clientSecret: process.env.XERO_CLIENT_SECRET || "default_secret",
      redirectUri: `${protocol}://${domain}/api/xero/callback`,
      scopes: "accounting.transactions.read accounting.contacts.read",
    };

    // Log configuration status (without secrets)
    console.log(`Xero Config: Client ID present: ${!!process.env.XERO_CLIENT_ID}, Redirect URI: ${this.config.redirectUri}`);
  }

  private async makeAuthenticatedRequest(
    tokens: XeroTokens,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    data?: any
  ): Promise<any> {
    if (this.config.clientId === "default_client_id") {
      console.log(`Xero API not configured, mocking request to ${endpoint}`);
      return { error: "Xero API not configured" };
    }

    try {
      const url = `https://api.xero.com/api.xro/2.0/${endpoint}`;
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Xero-tenant-id': tokens.tenantId,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Xero API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Xero API request failed:', error);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<XeroTokens | null> {
    if (this.config.clientId === "default_client_id") {
      console.log("Xero API not configured, mocking token refresh");
      return null;
    }

    try {
      const response = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokenData = await response.json();
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        tenantId: tokenData.tenant_id || '',
      };
    } catch (error) {
      console.error('Failed to refresh Xero token:', error);
      return null;
    }
  }

  async getContacts(tokens: XeroTokens): Promise<XeroContact[]> {
    try {
      const response = await this.makeAuthenticatedRequest(tokens, 'Contacts');
      return response.Contacts || [];
    } catch (error) {
      console.error('Failed to fetch Xero contacts:', error);
      return [];
    }
  }

  async getContact(tokens: XeroTokens, contactId: string): Promise<XeroContact | null> {
    try {
      const response = await this.makeAuthenticatedRequest(tokens, `Contacts/${contactId}`);
      return response.Contacts?.[0] || null;
    } catch (error) {
      console.error('Failed to fetch Xero contact:', error);
      return null;
    }
  }

  async getInvoices(tokens: XeroTokens, modifiedSince?: Date): Promise<XeroInvoice[]> {
    try {
      let endpoint = 'Invoices?where=Type%3D%3D%22ACCREC%22';
      if (modifiedSince) {
        endpoint += `&ModifiedAfter=${modifiedSince.toISOString()}`;
      }
      
      const response = await this.makeAuthenticatedRequest(tokens, endpoint);
      return response.Invoices || [];
    } catch (error) {
      console.error('Failed to fetch Xero invoices:', error);
      return [];
    }
  }

  async getInvoicesPaginated(tokens: XeroTokens, page: number = 1, limit: number = 50, status: string = 'all'): Promise<{
    invoices: XeroInvoice[];
    payments: Map<string, XeroPayment[]>;
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    try {
      // Xero API uses 1-based pagination
      const xeroPage = Math.max(1, page);
      
      // Build status-based filter for Xero API
      let whereClause = 'Type%3D%3D%22ACCREC%22'; // Type=="ACCREC"
      
      switch (status) {
        case 'unpaid':
          // Invoices that are authorized but not fully paid
          whereClause += '%20AND%20Status%3D%3D%22AUTHORISED%22%20AND%20AmountDue%3E0';
          break;
        case 'partial':
          // Invoices with some payment but still have amount due
          whereClause += '%20AND%20AmountPaid%3E0%20AND%20AmountDue%3E0';
          break;
        case 'paid':
          // Fully paid invoices
          whereClause += '%20AND%20Status%3D%3D%22PAID%22';
          break;
        case 'void':
          // Voided invoices
          whereClause += '%20AND%20Status%3D%3D%22VOIDED%22';
          break;
        case 'all':
        default:
          // No additional filter - show all ACCREC invoices
          break;
      }
      
      const endpoint = `Invoices?where=${whereClause}&page=${xeroPage}`;
      
      const response = await this.makeAuthenticatedRequest(tokens, endpoint);
      const invoices = response.Invoices || [];
      
      // Calculate pagination info based on Xero's response
      // Xero doesn't always provide total count, so we estimate based on returned results
      const hasMore = invoices.length === 100; // Xero's default page size is 100
      const currentPage = xeroPage;
      
      // Take only the requested limit from the results
      const limitedInvoices = invoices.slice(0, limit);
      
      // Fetch payment data for each invoice (Option B - separate API calls)
      const paymentsMap = new Map<string, XeroPayment[]>();
      
      // Process invoices in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < limitedInvoices.length; i += batchSize) {
        const batch = limitedInvoices.slice(i, i + batchSize);
        const paymentPromises = batch.map(async (invoice) => {
          try {
            const payments = await this.getInvoicePayments(tokens, invoice.InvoiceID);
            return { invoiceId: invoice.InvoiceID, payments };
          } catch (error) {
            console.warn(`Failed to fetch payments for invoice ${invoice.InvoiceID}:`, error);
            return { invoiceId: invoice.InvoiceID, payments: [] };
          }
        });
        
        const batchResults = await Promise.all(paymentPromises);
        batchResults.forEach(({ invoiceId, payments }) => {
          paymentsMap.set(invoiceId, payments);
        });
      }
      
      return {
        invoices: limitedInvoices,
        payments: paymentsMap,
        pagination: {
          currentPage,
          totalPages: hasMore ? currentPage + 1 : currentPage, // Estimate
          totalCount: hasMore ? (currentPage * 100) + 1 : (currentPage - 1) * 100 + invoices.length, // Estimate
          hasNextPage: hasMore && limitedInvoices.length === limit,
          hasPreviousPage: currentPage > 1,
        },
      };
    } catch (error) {
      console.error('Failed to fetch paginated Xero invoices:', error);
      return {
        invoices: [],
        payments: new Map(),
        pagination: {
          currentPage: page,
          totalPages: 1,
          totalCount: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }
  }

  async getInvoice(tokens: XeroTokens, invoiceId: string): Promise<XeroInvoice | null> {
    try {
      const response = await this.makeAuthenticatedRequest(tokens, `Invoices/${invoiceId}`);
      return response.Invoices?.[0] || null;
    } catch (error) {
      console.error('Failed to fetch Xero invoice:', error);
      return null;
    }
  }

  async getPayments(tokens: XeroTokens, invoiceId?: string): Promise<XeroPayment[]> {
    try {
      let endpoint = 'Payments';
      if (invoiceId) {
        endpoint += `?where=Invoice.InvoiceID%3Dguid"${invoiceId}"`;
      }
      
      const response = await this.makeAuthenticatedRequest(tokens, endpoint);
      return response.Payments || [];
    } catch (error) {
      console.error('Failed to fetch Xero payments:', error);
      return [];
    }
  }

  async getInvoicePayments(tokens: XeroTokens, invoiceId: string): Promise<XeroPayment[]> {
    try {
      const response = await this.makeAuthenticatedRequest(tokens, `Invoices/${invoiceId}/Payments`);
      return response.Payments || [];
    } catch (error) {
      console.error('Failed to fetch Xero invoice payments:', error);
      return [];
    }
  }

  async syncContactsToDatabase(tokens: XeroTokens, tenantId: string): Promise<{
    synced: number;
    errors: string[];
  }> {
    const results = { synced: 0, errors: [] as string[] };

    try {
      const xeroContacts = await this.getContacts(tokens);
      const { storage } = await import('../storage');

      for (const xeroContact of xeroContacts) {
        try {
          const contactData = {
            tenantId,
            xeroContactId: xeroContact.ContactID,
            name: xeroContact.Name,
            email: xeroContact.EmailAddress || null,
            phone: xeroContact.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber || null,
            companyName: xeroContact.Name,
            isActive: xeroContact.IsActive,
          };

          await storage.createContact(contactData);
          results.synced++;
        } catch (error: any) {
          results.errors.push(`Failed to sync contact ${xeroContact.Name}: ${error.message}`);
        }
      }
    } catch (error: any) {
      results.errors.push(`Failed to fetch contacts from Xero: ${error.message}`);
    }

    return results;
  }

  async syncInvoicesToDatabase(tokens: XeroTokens, tenantId: string): Promise<{
    synced: number;
    errors: string[];
  }> {
    const results = { synced: 0, errors: [] as string[] };

    try {
      const xeroInvoices = await this.getInvoices(tokens);
      const { storage } = await import('../storage');

      for (const xeroInvoice of xeroInvoices) {
        try {
          // Find matching contact
          const contacts = await storage.getContacts(tenantId);
          const contact = contacts.find(c => c.xeroContactId === xeroInvoice.Contact.ContactID);
          
          if (!contact) {
            results.errors.push(`Contact not found for invoice ${xeroInvoice.InvoiceNumber}`);
            continue;
          }

          const invoiceData = {
            tenantId,
            contactId: contact.id,
            xeroInvoiceId: xeroInvoice.InvoiceID,
            invoiceNumber: xeroInvoice.InvoiceNumber,
            amount: xeroInvoice.Total.toString(),
            amountPaid: xeroInvoice.AmountPaid.toString(),
            taxAmount: xeroInvoice.TotalTax.toString(),
            status: this.mapXeroStatusToLocal(xeroInvoice.Status),
            issueDate: new Date(xeroInvoice.DateString),
            dueDate: new Date(xeroInvoice.DueDateString),
            currency: xeroInvoice.CurrencyCode,
            description: `Invoice from Xero - ${xeroInvoice.InvoiceNumber}`,
          };

          await storage.createInvoice(invoiceData);
          results.synced++;
        } catch (error: any) {
          results.errors.push(`Failed to sync invoice ${xeroInvoice.InvoiceNumber}: ${error.message}`);
        }
      }
    } catch (error: any) {
      results.errors.push(`Failed to fetch invoices from Xero: ${error.message}`);
    }

    return results;
  }

  private mapXeroStatusToLocal(xeroStatus: string): string {
    switch (xeroStatus) {
      case 'PAID':
        return 'paid';
      case 'VOIDED':
        return 'cancelled';
      case 'AUTHORISED':
      case 'SUBMITTED':
        return 'pending';
      default:
        return 'pending';
    }
  }

  getAuthorizationUrl(state?: string): string {
    if (this.config.clientId === "default_client_id") {
      return "/api/xero/mock-auth";
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes,
      state: state || '',
    });

    return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<XeroTokens | null> {
    if (this.config.clientId === "default_client_id") {
      console.log("Xero API not configured, mocking token exchange");
      return null;
    }

    try {
      console.log(`Xero token exchange - Redirect URI: ${this.config.redirectUri}`);
      console.log(`Xero token exchange - Client ID: ${this.config.clientId.substring(0, 8)}...`);
      
      const tokenRequestBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
      });

      console.log(`Xero token request body: ${tokenRequestBody.toString()}`);

      const response = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        },
        body: tokenRequestBody,
      });

      console.log(`Xero token response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Xero token exchange failed: ${response.status} - ${errorText}`);
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      console.log('Xero token exchange successful');
      
      // Get tenant info
      const connectionsResponse = await fetch('https://api.xero.com/connections', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      if (!connectionsResponse.ok) {
        const errorText = await connectionsResponse.text();
        console.error(`Xero connections request failed: ${connectionsResponse.status} - ${errorText}`);
        throw new Error(`Connections request failed: ${connectionsResponse.status}`);
      }

      const connections = await connectionsResponse.json();
      const tenantId = connections[0]?.tenantId || '';

      console.log(`Xero integration successful, tenant ID: ${tenantId}`);

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        tenantId,
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      return null;
    }
  }
}

export const xeroService = new XeroService();
