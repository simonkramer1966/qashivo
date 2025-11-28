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
  tenantName?: string;
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

interface XeroBill {
  InvoiceID: string;
  InvoiceNumber: string;
  Type: 'ACCPAY';
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
  LineItems?: Array<{
    LineItemID: string;
    Description: string;
    Quantity: number;
    UnitAmount: number;
    LineAmount: number;
    AccountCode: string;
  }>;
}

interface XeroBillPayment {
  PaymentID: string;
  InvoiceID?: string;
  BankTransactionID?: string;
  AccountID: string;
  Date: string;
  Amount: number;
  PaymentType: 'ACCPAYPAYMENT' | 'APCREDITPAYMENT';
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

interface XeroBankAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type: 'BANK';
  BankAccountType: 'BANK' | 'CREDITCARD' | 'PAYPAL' | 'NONE';
  BankAccountNumber?: string;
  CurrencyCode: string;
  Class: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  EnablePaymentsToAccount: boolean;
  ShowInExpenseClaims: boolean;
  Status: 'ACTIVE' | 'ARCHIVED';
  Description?: string;
  BankName?: string;
  TaxType?: string;
}

interface XeroBankTransaction {
  BankTransactionID: string;
  BankAccountID: string;
  Type: 'RECEIVE' | 'SPEND' | 'RECEIVE-OVERPAYMENT' | 'RECEIVE-PREPAYMENT' | 'SPEND-OVERPAYMENT' | 'SPEND-PREPAYMENT';
  Status: 'AUTHORISED' | 'DELETED';
  Contact?: { ContactID: string; Name: string };
  DateString: string;
  Reference?: string;
  CurrencyCode: string;
  CurrencyRate?: number;
  SubTotal: number;
  TotalTax: number;
  Total: number;
  IsReconciled: boolean;
  LineItems?: Array<{
    LineItemID: string;
    Description: string;
    Quantity: number;
    UnitAmount: number;
    LineAmount: number;
    AccountCode: string;
    TaxType?: string;
  }>;
}

interface XeroBudget {
  BudgetID: string;
  Type: 'OVERALL';
  Description: string;
  UpdatedDateUTC: string;
  BudgetLines?: Array<{
    AccountID: string;
    AccountCode: string;
    AccountName: string;
    Amount: number;
  }>;
}

interface XeroExchangeRate {
  CurrencyCode: string;
  Rate: number;
  DateUpdated?: string;
  BaseCurrency: string;
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
      scopes: "openid profile email accounting.transactions accounting.contacts accounting.settings offline_access",
    };

    // Log configuration status (without secrets)
    console.log(`Xero Config: Client ID present: ${!!process.env.XERO_CLIENT_ID}, Redirect URI: ${this.config.redirectUri}`);
  }

  private isTokenExpired(expiresAt: Date): boolean {
    // Consider token expired if it expires within the next 2 minutes (buffer for safety)
    const bufferMs = 2 * 60 * 1000; // 2 minutes
    return new Date(expiresAt).getTime() - bufferMs < Date.now();
  }

  private async makeAuthenticatedRequest(
    tokens: XeroTokens,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    data?: any,
    tenantIdForDbUpdate?: string,  // Optional tenant ID for database token updates
    additionalHeaders?: Record<string, string>  // Optional additional headers (e.g., If-Modified-Since)
  ): Promise<any> {
    if (this.config.clientId === "default_client_id") {
      console.log(`Xero API not configured, mocking request to ${endpoint}`);
      throw new Error("Xero API not configured. Please set XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables.");
    }

    // PROACTIVE TOKEN REFRESH: Check if token is expired before making request
    if (tokens.expiresAt && this.isTokenExpired(tokens.expiresAt)) {
      console.log('🔄 Xero token expired or expiring soon, proactively refreshing...');
      
      try {
        const refreshedTokens = await this.refreshAccessToken(tokens.refreshToken, tokens.tenantId);
        
        if (!refreshedTokens) {
          throw new Error('Failed to refresh Xero access token');
        }
        
        console.log('✅ Xero token refreshed proactively (expires:', refreshedTokens.expiresAt, ')');
        
        // Update the database with new tokens if tenant ID provided
        if (tenantIdForDbUpdate) {
          await this.updateTenantTokens(tenantIdForDbUpdate, refreshedTokens);
        }
        
        // Update the tokens object for this request
        tokens.accessToken = refreshedTokens.accessToken;
        tokens.refreshToken = refreshedTokens.refreshToken;
        tokens.expiresAt = refreshedTokens.expiresAt;
      } catch (refreshError) {
        console.error('❌ Proactive token refresh failed:', refreshError);
        // Continue anyway - if it fails, the reactive refresh (on 401) will catch it
      }
    }

    const makeRequest = async (accessToken: string): Promise<any> => {
      if (!tokens.tenantId) {
        throw new Error('Xero tenant ID is required for API requests');
      }
      
      const url = `https://api.xero.com/api.xro/2.0/${endpoint}`;
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tokens.tenantId,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...additionalHeaders,
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Handle 401 unauthorized errors specifically
        if (response.status === 401) {
          throw new Error(`XERO_AUTH_ERROR:${response.status}:${errorText}`);
        }
        
        throw new Error(`Xero API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    };

    try {
      // Try the request with current access token
      return await makeRequest(tokens.accessToken);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if this is a 401 authentication error
      if (errorMessage.includes('XERO_AUTH_ERROR:401')) {
        console.warn('🔄 Xero access token expired, attempting refresh...');
        
        try {
          // Attempt to refresh the token
          const refreshedTokens = await this.refreshAccessToken(tokens.refreshToken, tokens.tenantId);
          
          if (!refreshedTokens) {
            throw new Error('Failed to refresh Xero access token');
          }
          
          console.log('✅ Xero token refreshed successfully');
          
          // Update the database with new tokens if tenant ID provided
          if (tenantIdForDbUpdate) {
            await this.updateTenantTokens(tenantIdForDbUpdate, refreshedTokens);
          }
          
          // Update the tokens object for this request
          tokens.accessToken = refreshedTokens.accessToken;
          tokens.refreshToken = refreshedTokens.refreshToken;
          tokens.expiresAt = refreshedTokens.expiresAt;
          
          // Retry the original request with new token
          console.log('🔄 Retrying original request with refreshed token...');
          return await makeRequest(refreshedTokens.accessToken);
          
        } catch (refreshError) {
          console.error('❌ Failed to refresh Xero token:', refreshError);
          throw new Error(`Xero authentication failed: ${refreshError instanceof Error ? refreshError.message : 'Token refresh failed'}`);
        }
      }
      
      // Re-throw non-auth errors
      console.error('Xero API request failed:', error);
      throw error;
    }
  }

  private async updateTenantTokens(tenantId: string, tokens: XeroTokens): Promise<void> {
    try {
      const { db } = await import('../db');
      const { tenants } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      await db
        .update(tenants)
        .set({
          xeroAccessToken: tokens.accessToken,
          xeroRefreshToken: tokens.refreshToken,
          xeroExpiresAt: tokens.expiresAt,
        })
        .where(eq(tenants.id, tenantId));
        
      console.log('✅ Updated tenant Xero tokens in database (expires:', tokens.expiresAt, ')');
    } catch (dbError) {
      console.error('❌ Failed to update tenant tokens in database:', dbError);
      // Don't throw here - we still want the API request to succeed even if DB update fails
    }
  }

  async refreshAccessToken(refreshToken: string, currentTenantId?: string): Promise<XeroTokens | null> {
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
      
      // Get tenant ID from connections endpoint if not provided
      let tenantId = currentTenantId || '';
      if (!tenantId) {
        try {
          const connectionsResponse = await fetch('https://api.xero.com/connections', {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
          });
          
          if (connectionsResponse.ok) {
            const connections = await connectionsResponse.json();
            tenantId = connections[0]?.tenantId || '';
          }
        } catch (connectionsError) {
          console.warn('Failed to fetch connections during token refresh:', connectionsError);
        }
      }
      
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        tenantId,
      };
    } catch (error) {
      console.error('Failed to refresh Xero token:', error);
      return null;
    }
  }

  async getContacts(tokens: XeroTokens, filters?: {
    hasOutstandingInvoices?: boolean;
    activeOnly?: boolean;
    recentActivityMonths?: number;
    minOutstandingAmount?: number;
  }, tenantIdForDbUpdate?: string): Promise<XeroContact[]> {
    try {
      let endpoint = 'Contacts';
      const whereClauses: string[] = [];

      // Note: Xero Contacts don't have an IsActive field in the API
      // We filter active contacts after fetching, not via API query
      
      if (whereClauses.length > 0) {
        // Properly encode the where clause
        const whereClause = whereClauses.join(' AND ');
        endpoint += `?where=${encodeURIComponent(whereClause)}`;
      }

      console.log(`Fetching Xero contacts with endpoint: ${endpoint}`);
      const response = await this.makeAuthenticatedRequest(tokens, endpoint, 'GET', undefined, tenantIdForDbUpdate);
      let contacts = response.Contacts || [];
      
      // Filter for active contacts after fetching if requested
      if (filters?.activeOnly !== false && contacts.length > 0) {
        contacts = contacts.filter((c: any) => c.ContactStatus === 'ACTIVE' || !c.ContactStatus);
      }

      console.log(`Fetched ${contacts.length} active contacts from Xero`);

      // Additional filtering that requires invoice analysis
      if (filters?.hasOutstandingInvoices || filters?.recentActivityMonths || filters?.minOutstandingAmount) {
        console.log('Applying invoice-based filtering...');
        contacts = await this.filterContactsByInvoiceActivity(tokens, contacts, filters, tenantIdForDbUpdate);
      }

      return contacts;
    } catch (error) {
      console.error('Failed to fetch Xero contacts:', error);
      // For configuration errors, rethrow to fail fast
      if (error instanceof Error && error.message.includes('not configured')) {
        throw error;
      }
      // For other errors, return empty array to allow graceful degradation
      return [];
    }
  }

  private async filterContactsByInvoiceActivity(
    tokens: XeroTokens, 
    contacts: XeroContact[], 
    filters: {
      hasOutstandingInvoices?: boolean;
      recentActivityMonths?: number;
      minOutstandingAmount?: number;
    },
    tenantIdForDbUpdate?: string
  ): Promise<XeroContact[]> {
    const filteredContacts: XeroContact[] = [];
    const recentDate = filters.recentActivityMonths 
      ? new Date(Date.now() - (filters.recentActivityMonths * 30 * 24 * 60 * 60 * 1000))
      : null;

    console.log(`Filtering ${contacts.length} contacts based on invoice activity...`);
    
    // Process contacts in batches to avoid overwhelming the API
    const batchSize = 50;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      const contactPromises = batch.map(async (contact) => {
        try {
          // Get invoices for this contact - properly encoded
          const whereClause = `Contact.ContactID=guid"${contact.ContactID}" AND Type=="ACCREC" AND (Status=="AUTHORISED" OR Status=="SUBMITTED")`;
          const invoiceEndpoint = `Invoices?where=${encodeURIComponent(whereClause)}`;
          
          const invoiceResponse = await this.makeAuthenticatedRequest(tokens, invoiceEndpoint, 'GET', undefined, tenantIdForDbUpdate);
          const invoices = invoiceResponse.Invoices || [];
          
          if (invoices.length === 0) {
            return null; // No relevant invoices
          }

          let hasRecentActivity = false;
          let totalOutstanding = 0;
          
          for (const invoice of invoices) {
            // Check for recent activity
            if (recentDate) {
              const invoiceDate = new Date(invoice.DateString);
              if (invoiceDate >= recentDate) {
                hasRecentActivity = true;
              }
            } else {
              hasRecentActivity = true; // No date filter applied
            }
            
            // Calculate outstanding amount
            const outstandingAmount = invoice.AmountDue || (invoice.Total - invoice.AmountPaid);
            if (outstandingAmount > 0) {
              totalOutstanding += outstandingAmount;
            }
          }

          // Apply filters
          if (filters.hasOutstandingInvoices && totalOutstanding === 0) {
            return null; // No outstanding balance
          }
          
          if (filters.recentActivityMonths && !hasRecentActivity) {
            return null; // No recent activity
          }
          
          if (filters.minOutstandingAmount && totalOutstanding < filters.minOutstandingAmount) {
            return null; // Outstanding amount too low
          }

          // Contact meets all criteria
          return { contact, totalOutstanding, invoiceCount: invoices.length };
          
        } catch (error) {
          console.warn(`Failed to check invoices for contact ${contact.Name}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(contactPromises);
      const validContacts = batchResults.filter(result => result !== null);
      
      filteredContacts.push(...validContacts.map(result => result!.contact));
      
      // Log progress
      console.log(`Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(contacts.length/batchSize)}, found ${validContacts.length} qualifying contacts`);
    }

    console.log(`Filtered ${contacts.length} contacts down to ${filteredContacts.length} with relevant invoice activity`);
    return filteredContacts;
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

  async getInvoices(tokens: XeroTokens, modifiedSince?: Date, filters?: {
    outstandingOnly?: boolean;
    collectionRelevantOnly?: boolean;
    recentActivityMonths?: number;
  }): Promise<XeroInvoice[]> {
    try {
      let whereClause = 'Type%3D%3D%22ACCREC%22'; // Type=="ACCREC"
      
      // Apply collection-focused filters
      if (filters?.outstandingOnly) {
        whereClause += '%20AND%20AmountDue%3E0'; // AmountDue>0
      }
      
      if (filters?.collectionRelevantOnly) {
        // Focus on AUTHORISED and SUBMITTED invoices (exclude PAID, VOIDED, DRAFT)
        whereClause += '%20AND%20(Status%3D%3D%22AUTHORISED%22%20OR%20Status%3D%3D%22SUBMITTED%22)';
      }
      
      if (filters?.recentActivityMonths) {
        const recentDate = new Date(Date.now() - (filters.recentActivityMonths * 30 * 24 * 60 * 60 * 1000));
        whereClause += `%20AND%20Date%3E%3DDateTime(${recentDate.getFullYear()},${recentDate.getMonth()+1},${recentDate.getDate()})`;
      }
      
      let endpoint = `Invoices?where=${whereClause}`;
      
      // Use If-Modified-Since header instead of ModifiedAfter parameter
      const headers = modifiedSince ? { 'If-Modified-Since': modifiedSince.toUTCString() } : undefined;
      
      const response = await this.makeAuthenticatedRequest(tokens, endpoint, 'GET', undefined, undefined, headers);
      return response.Invoices || [];
    } catch (error) {
      console.error('Failed to fetch Xero invoices:', error);
      // For configuration errors, rethrow to fail fast
      if (error instanceof Error && error.message.includes('not configured')) {
        throw error;
      }
      // For other errors, return empty array to allow graceful degradation
      return [];
    }
  }

  async getInvoicesPaginated(tokens: XeroTokens, page: number = 1, limit: number = 50, status: string = 'all', tenantIdForDbUpdate?: string): Promise<{
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
      
      const response = await this.makeAuthenticatedRequest(tokens, endpoint, 'GET', undefined, tenantIdForDbUpdate);
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
        const paymentPromises = batch.map(async (invoice: XeroInvoice) => {
          try {
            const payments = await this.getInvoicePayments(tokens, invoice.InvoiceID, tenantIdForDbUpdate);
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

  async getInvoicePayments(tokens: XeroTokens, invoiceId: string, tenantIdForDbUpdate?: string): Promise<XeroPayment[]> {
    try {
      const response = await this.makeAuthenticatedRequest(tokens, `Invoices/${invoiceId}/Payments`, 'GET', undefined, tenantIdForDbUpdate);
      return response.Payments || [];
    } catch (error) {
      console.error('Failed to fetch Xero invoice payments:', error);
      return [];
    }
  }

  // ===== BILLS SUPPORT (ACCPAY INVOICES) =====
  async getBills(tokens: XeroTokens, filters?: {
    modifiedSince?: Date;
    outstandingOnly?: boolean;
    status?: string;
    page?: number;
    limit?: number;
  }, tenantIdForDbUpdate?: string): Promise<XeroBill[]> {
    try {
      let whereClause = 'Type%3D%3D%22ACCPAY%22'; // Type=="ACCPAY"
      
      if (filters?.outstandingOnly) {
        whereClause += '%20AND%20AmountDue%3E0'; // AmountDue>0
      }
      
      if (filters?.status && filters.status !== 'all') {
        switch (filters.status) {
          case 'unpaid':
            whereClause += '%20AND%20Status%3D%3D%22AUTHORISED%22%20AND%20AmountDue%3E0';
            break;
          case 'paid':
            whereClause += '%20AND%20Status%3D%3D%22PAID%22';
            break;
          case 'void':
            whereClause += '%20AND%20Status%3D%3D%22VOIDED%22';
            break;
        }
      }
      
      let endpoint = `Invoices?where=${whereClause}`;
      
      if (filters?.page && filters.page > 1) {
        endpoint += `&page=${filters.page}`;
      }
      
      // Use If-Modified-Since header instead of ModifiedAfter parameter
      const headers = filters?.modifiedSince ? { 'If-Modified-Since': filters.modifiedSince.toUTCString() } : undefined;
      
      console.log(`Fetching Xero bills with endpoint: ${endpoint}`);
      const response = await this.makeAuthenticatedRequest(tokens, endpoint, 'GET', undefined, tenantIdForDbUpdate, headers);
      const bills = response.Invoices || [];
      
      return bills;
    } catch (error) {
      console.error('Failed to fetch Xero bills:', error);
      if (error instanceof Error && error.message.includes('not configured')) {
        throw error;
      }
      return [];
    }
  }

  async getBill(tokens: XeroTokens, billId: string, tenantIdForDbUpdate?: string): Promise<XeroBill | null> {
    try {
      const response = await this.makeAuthenticatedRequest(tokens, `Invoices/${billId}`, 'GET', undefined, tenantIdForDbUpdate);
      const bill = response.Invoices?.[0];
      return bill && bill.Type === 'ACCPAY' ? bill : null;
    } catch (error) {
      console.error('Failed to fetch Xero bill:', error);
      return null;
    }
  }

  // ===== BILL PAYMENTS SUPPORT =====
  async getBillPayments(tokens: XeroTokens, filters?: {
    billId?: string;
    modifiedSince?: Date;
    dateFrom?: Date;
    dateTo?: Date;
  }, tenantIdForDbUpdate?: string): Promise<XeroBillPayment[]> {
    try {
      let endpoint = 'Payments';
      const whereClauses: string[] = [];
      
      // Filter for bill payments (ACCPAY)
      whereClauses.push('PaymentType%3D%3D%22ACCPAYPAYMENT%22'); // PaymentType=="ACCPAYPAYMENT"
      
      if (filters?.billId) {
        whereClauses.push(`Invoice.InvoiceID%3Dguid"${filters.billId}"`); // Invoice.InvoiceID=guid"billId"
      }
      
      if (whereClauses.length > 0) {
        endpoint += `?where=${whereClauses.join('%20AND%20')}`;
      }
      
      // Use If-Modified-Since header instead of ModifiedAfter parameter for bill payments
      const headers = filters?.modifiedSince ? { 'If-Modified-Since': filters.modifiedSince.toUTCString() } : undefined;
      
      console.log(`Fetching Xero bill payments with endpoint: ${endpoint}`);
      const response = await this.makeAuthenticatedRequest(tokens, endpoint, 'GET', undefined, tenantIdForDbUpdate, headers);
      let payments = response.Payments || [];
      
      // Additional client-side filtering for date range if specified
      if (filters?.dateFrom || filters?.dateTo) {
        payments = payments.filter((payment: XeroBillPayment) => {
          const paymentDate = new Date(payment.Date);
          if (filters.dateFrom && paymentDate < filters.dateFrom) return false;
          if (filters.dateTo && paymentDate > filters.dateTo) return false;
          return true;
        });
      }
      
      return payments;
    } catch (error) {
      console.error('Failed to fetch Xero bill payments:', error);
      return [];
    }
  }

  // ===== BANK ACCOUNTS SUPPORT =====
  async getBankAccounts(tokens: XeroTokens, filters?: {
    activeOnly?: boolean;
    modifiedSince?: Date;
  }, tenantIdForDbUpdate?: string): Promise<XeroBankAccount[]> {
    try {
      let endpoint = 'Accounts';
      const whereClauses: string[] = [];
      
      // Filter for bank accounts only
      whereClauses.push('Type%3D%3D%22BANK%22'); // Type=="BANK"
      
      if (filters?.activeOnly !== false) {
        whereClauses.push('Status%3D%3D%22ACTIVE%22'); // Status=="ACTIVE"
      }
      
      if (whereClauses.length > 0) {
        endpoint += `?where=${whereClauses.join('%20AND%20')}`;
      }
      
      // Use If-Modified-Since header instead of ModifiedAfter parameter for bank accounts
      const headers = filters?.modifiedSince ? { 'If-Modified-Since': filters.modifiedSince.toUTCString() } : undefined;
      
      console.log(`Fetching Xero bank accounts with endpoint: ${endpoint}`);
      const response = await this.makeAuthenticatedRequest(tokens, endpoint, 'GET', undefined, tenantIdForDbUpdate, headers);
      return response.Accounts || [];
    } catch (error) {
      console.error('Failed to fetch Xero bank accounts:', error);
      return [];
    }
  }

  async getBankAccount(tokens: XeroTokens, accountId: string, tenantIdForDbUpdate?: string): Promise<XeroBankAccount | null> {
    try {
      const response = await this.makeAuthenticatedRequest(tokens, `Accounts/${accountId}`, 'GET', undefined, tenantIdForDbUpdate);
      const account = response.Accounts?.[0];
      return account && account.Type === 'BANK' ? account : null;
    } catch (error) {
      console.error('Failed to fetch Xero bank account:', error);
      return null;
    }
  }

  // ===== BANK TRANSACTIONS SUPPORT =====
  async getBankTransactions(tokens: XeroTokens, filters?: {
    bankAccountId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    modifiedSince?: Date;
    reconciled?: boolean;
    transactionType?: 'RECEIVE' | 'SPEND';
    page?: number;
    limit?: number;
  }, tenantIdForDbUpdate?: string): Promise<XeroBankTransaction[]> {
    try {
      let endpoint = 'BankTransactions';
      const whereClauses: string[] = [];
      
      // Note: Xero bank transaction filtering is complex - it's often better to fetch all and filter in-app
      // For now, we'll fetch all transactions and filter in-memory for reliability
      
      // Date filtering using proper Xero DateTime format
      if (filters?.dateFrom) {
        const d = filters.dateFrom;
        whereClauses.push(`Date>=DateTime(${d.getFullYear()},${d.getMonth()+1},${d.getDate()})`);
      }
      
      if (filters?.dateTo) {
        const d = filters.dateTo;
        whereClauses.push(`Date<=DateTime(${d.getFullYear()},${d.getMonth()+1},${d.getDate()})`);
      }
      
      if (whereClauses.length > 0) {
        // Use proper encoding for Xero where clauses
        const whereClause = whereClauses.join(' AND ');
        endpoint += `?where=${encodeURIComponent(whereClause)}`;
      }
      
      if (filters?.page && filters.page > 1) {
        const separator = endpoint.includes('?') ? '&' : '?';
        endpoint += `${separator}page=${filters.page}`;
      }
      
      // Use If-Modified-Since header instead of ModifiedAfter parameter for bank transactions
      const headers = filters?.modifiedSince ? { 'If-Modified-Since': filters.modifiedSince.toUTCString() } : undefined;
      
      console.log(`Fetching Xero bank transactions with endpoint: ${endpoint}`);
      const response = await this.makeAuthenticatedRequest(tokens, endpoint, 'GET', undefined, tenantIdForDbUpdate, headers);
      let transactions = response.BankTransactions || [];
      
      // Apply in-memory filtering for fields that don't work well in Xero API queries
      if (filters?.bankAccountId && transactions.length > 0) {
        transactions = transactions.filter((t: any) => 
          t.BankAccount?.AccountID === filters.bankAccountId
        );
      }
      
      if (filters?.transactionType && transactions.length > 0) {
        transactions = transactions.filter((t: any) => t.Type === filters.transactionType);
      }
      
      if (filters?.reconciled !== undefined && transactions.length > 0) {
        transactions = transactions.filter((t: any) => t.IsReconciled === filters.reconciled);
      }
      
      return transactions;
    } catch (error) {
      console.error('Failed to fetch Xero bank transactions:', error);
      return [];
    }
  }

  async getBankTransaction(tokens: XeroTokens, transactionId: string, tenantIdForDbUpdate?: string): Promise<XeroBankTransaction | null> {
    try {
      const response = await this.makeAuthenticatedRequest(tokens, `BankTransactions/${transactionId}`, 'GET', undefined, tenantIdForDbUpdate);
      return response.BankTransactions?.[0] || null;
    } catch (error) {
      console.error('Failed to fetch Xero bank transaction:', error);
      return null;
    }
  }

  // ===== BUDGETS SUPPORT =====
  async getBudgets(tokens: XeroTokens, filters?: {
    modifiedSince?: Date;
  }, tenantIdForDbUpdate?: string): Promise<XeroBudget[]> {
    try {
      let endpoint = 'Budgets';
      
      // Use If-Modified-Since header instead of ModifiedAfter parameter for budgets
      const headers = filters?.modifiedSince ? { 'If-Modified-Since': filters.modifiedSince.toUTCString() } : undefined;
      
      console.log(`Fetching Xero budgets with endpoint: ${endpoint}`);
      const response = await this.makeAuthenticatedRequest(tokens, endpoint, 'GET', undefined, tenantIdForDbUpdate, headers);
      return response.Budgets || [];
    } catch (error) {
      console.error('Failed to fetch Xero budgets:', error);
      // Budgets endpoint might not be available in all Xero plans
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
        console.warn('Budgets endpoint not available, this is normal for some Xero plans');
        return [];
      }
      return [];
    }
  }

  async getBudget(tokens: XeroTokens, budgetId: string, tenantIdForDbUpdate?: string): Promise<XeroBudget | null> {
    try {
      const response = await this.makeAuthenticatedRequest(tokens, `Budgets/${budgetId}`, 'GET', undefined, tenantIdForDbUpdate);
      return response.Budgets?.[0] || null;
    } catch (error) {
      console.error('Failed to fetch Xero budget:', error);
      return null;
    }
  }

  // ===== EXCHANGE RATES SUPPORT =====
  async getExchangeRates(tokens: XeroTokens, filters?: {
    currencyCode?: string;
    modifiedSince?: Date;
  }, tenantIdForDbUpdate?: string): Promise<XeroExchangeRate[]> {
    try {
      let endpoint = 'Currencies';
      
      // Use If-Modified-Since header instead of ModifiedAfter parameter for exchange rates
      const headers = filters?.modifiedSince ? { 'If-Modified-Since': filters.modifiedSince.toUTCString() } : undefined;
      
      console.log(`Fetching Xero currencies/exchange rates with endpoint: ${endpoint}`);
      const response = await this.makeAuthenticatedRequest(tokens, endpoint, 'GET', undefined, tenantIdForDbUpdate, headers);
      let currencies = response.Currencies || [];
      
      // Transform to exchange rate format
      const exchangeRates: XeroExchangeRate[] = currencies.map((currency: any) => ({
        CurrencyCode: currency.Code,
        Rate: currency.Rate || 1.0,
        DateUpdated: currency.UpdatedDateUTC,
        BaseCurrency: 'USD', // Xero typically uses USD as base
      }));
      
      // Filter by currency code if specified
      if (filters?.currencyCode) {
        return exchangeRates.filter(rate => rate.CurrencyCode === filters.currencyCode);
      }
      
      return exchangeRates;
    } catch (error) {
      console.error('Failed to fetch Xero exchange rates:', error);
      return [];
    }
  }

  async getCurrentExchangeRate(tokens: XeroTokens, fromCurrency: string, toCurrency: string, tenantIdForDbUpdate?: string): Promise<XeroExchangeRate | null> {
    try {
      // For current rates, just get all currencies and find the specific one
      const allRates = await this.getExchangeRates(tokens, { currencyCode: fromCurrency }, tenantIdForDbUpdate);
      return allRates.find(rate => rate.CurrencyCode === fromCurrency && rate.BaseCurrency === toCurrency) || null;
    } catch (error) {
      console.error('Failed to fetch current Xero exchange rate:', error);
      return null;
    }
  }

  async syncContactsToDatabase(tokens: XeroTokens, tenantId: string): Promise<{
    synced: number;
    errors: string[];
    filtered: number;
  }> {
    const results = { synced: 0, errors: [] as string[], filtered: 0 };

    try {
      console.log('🔍 Fetching Xero contacts with collection-focused filters...');
      
      // Apply smart filters to only get relevant customers
      const filterConfig = {
        hasOutstandingInvoices: true,           // Only customers with outstanding balances
        activeOnly: true,                       // Only active customers
        recentActivityMonths: 36,               // Activity within last 36 months (more flexible)
        minOutstandingAmount: 1                 // Minimum $1 outstanding balance (very flexible)
      };
      
      const xeroContacts = await this.getContacts(tokens, filterConfig, tenantId);
      results.filtered = xeroContacts.length;
      
      console.log(`✅ Filtered contacts: ${xeroContacts.length} relevant customers found (vs ~15,000+ total)`);
      
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
      const tenantName = connections[0]?.tenantName || '';

      console.log(`Xero integration successful, tenant ID: ${tenantId}, org name: ${tenantName}`);

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        tenantId,
        tenantName,
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      return null;
    }
  }
}

export const xeroService = new XeroService();
