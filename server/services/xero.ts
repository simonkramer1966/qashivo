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
      scopes: "accounting.transactions accounting.contacts accounting.settings",
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

  async getInvoice(tokens: XeroTokens, invoiceId: string): Promise<XeroInvoice | null> {
    try {
      const response = await this.makeAuthenticatedRequest(tokens, `Invoices/${invoiceId}`);
      return response.Invoices?.[0] || null;
    } catch (error) {
      console.error('Failed to fetch Xero invoice:', error);
      return null;
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
      const response = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const tokenData = await response.json();
      
      // Get tenant info
      const connectionsResponse = await fetch('https://api.xero.com/connections', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      const connections = await connectionsResponse.json();
      const tenantId = connections[0]?.tenantId || '';

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
