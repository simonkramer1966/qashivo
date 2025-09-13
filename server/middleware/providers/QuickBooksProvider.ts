import { 
  UniversalProvider, 
  ProviderConfig, 
  APIResponse, 
  RequestOptions,
  WebhookConfig,
  WebhookResult,
  TokenAccessor
} from '../types';

/**
 * QuickBooks Online Provider Implementation
 * Implements UniversalProvider interface for QuickBooks Online API
 * 
 * Key Features:
 * - OAuth 2.0 authentication with realmId (company ID) support
 * - REST JSON API integration
 * - Global accounting data support
 * - Sandbox and production environment support
 * - Data standardization for contacts, invoices, and payments
 * - Rate limiting compliance
 */
export class QuickBooksProvider implements UniversalProvider {
  readonly name = 'quickbooks';
  readonly type = 'accounting' as const;
  readonly config: ProviderConfig;
  private tokenAccessor?: TokenAccessor;
  private baseUrl: string;

  // QuickBooks API endpoints
  private readonly endpoints = {
    customers: '/customer',
    vendors: '/vendor',
    invoices: '/invoice',
    payments: '/payment',
    accounts: '/account',
    items: '/item',
    estimates: '/estimate',
    bills: '/bill',
    bill_payments: '/billpayment',
    bank_accounts: '/account', // Bank accounts are special Account types
    bank_transactions: '/banktransfer', // Limited support via BankTransfer
    budgets: '/budget', // Note: Limited QB support
    exchange_rates: '/exchangerate', // Note: Limited QB support
    company_info: '/companyinfo'
  };

  constructor(config: ProviderConfig) {
    this.config = config;
    // Use sandbox URL by default for development, production URL for production environment
    this.baseUrl = config.environment === 'production' 
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
  }

  /**
   * Set token accessor (called by APIMiddleware during registration)
   */
  setTokenAccessor(accessor: TokenAccessor): void {
    this.tokenAccessor = accessor;
  }

  /**
   * Make authenticated request to QuickBooks API
   */
  async makeRequest<T = any>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    try {
      if (!this.tokenAccessor) {
        return { 
          success: false, 
          error: 'Token accessor not configured' 
        };
      }

      // Get access token via the injected accessor
      // For QuickBooks, realmId is critical and should be provided
      const realmId = options?.params?.realmId || options?.params?.tenantId;
      const tokenData = await this.tokenAccessor(this.name, realmId);
      
      if (!tokenData) {
        return { 
          success: false, 
          error: 'No valid authentication tokens available' 
        };
      }

      if (!realmId) {
        return {
          success: false,
          error: 'QuickBooks realmId (company ID) is required for API calls'
        };
      }

      let result;

      // Map generic endpoints to specific QuickBooks API calls
      switch (endpoint.toLowerCase()) {
        case 'contacts':
        case 'customers':
          result = await this.getCustomers(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'vendors':
          result = await this.getVendors(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'invoices':
          result = await this.getInvoices(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'payments':
          result = await this.getPayments(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'accounts':
          result = await this.getAccounts(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'items':
          result = await this.getItems(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'estimates':
          result = await this.getEstimates(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'bills':
          result = await this.getBills(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'bill-payments':
        case 'billpayments':
          result = await this.getBillPayments(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'bank-accounts':
        case 'bankaccounts':
          result = await this.getBankAccounts(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'bank-transactions':
        case 'banktransactions':
          result = await this.getBankTransactions(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'budgets':
          result = await this.getBudgets(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'exchange-rates':
        case 'exchangerates':
          result = await this.getExchangeRates(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'company_info':
          result = await this.getCompanyInfo(tokenData.accessToken, realmId);
          break;
        default:
          return { 
            success: false, 
            error: `Endpoint '${endpoint}' not implemented for QuickBooks provider. Supported endpoints: contacts/customers, vendors, invoices, payments, accounts, items, estimates, bills, bill-payments, bank-accounts, bank-transactions, budgets, exchange-rates, company_info` 
          };
      }

      return {
        success: true,
        data: result as T,
        statusCode: 200
      };

    } catch (error) {
      console.error(`QuickBooks API request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  /**
   * Get customers from QuickBooks API
   */
  private async getCustomers(accessToken: string, realmId: string, filters?: any): Promise<any> {
    let query = "SELECT * FROM Customer";
    
    // Add filtering support
    if (filters?.active !== undefined) {
      query += ` WHERE Active = ${filters.active}`;
    }
    if (filters?.since) {
      const whereClause = query.includes('WHERE') ? ' AND ' : ' WHERE ';
      query += `${whereClause} MetaData.LastUpdatedTime >= '${filters.since}'`;
    }

    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.Customer || [];
  }

  /**
   * Get invoices from QuickBooks API
   */
  private async getInvoices(accessToken: string, realmId: string, filters?: any): Promise<any> {
    let query = "SELECT * FROM Invoice";
    
    // Add filtering support
    const conditions: string[] = [];
    
    if (filters?.customer_id) {
      conditions.push(`CustomerRef = '${filters.customer_id}'`);
    }
    if (filters?.from_date) {
      conditions.push(`TxnDate >= '${filters.from_date}'`);
    }
    if (filters?.to_date) {
      conditions.push(`TxnDate <= '${filters.to_date}'`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.Invoice || [];
  }

  /**
   * Get payments from QuickBooks API
   */
  private async getPayments(accessToken: string, realmId: string, filters?: any): Promise<any> {
    let query = "SELECT * FROM Payment";
    
    // Add filtering support
    const conditions: string[] = [];
    
    if (filters?.customer_id) {
      conditions.push(`CustomerRef = '${filters.customer_id}'`);
    }
    if (filters?.from_date) {
      conditions.push(`TxnDate >= '${filters.from_date}'`);
    }
    if (filters?.to_date) {
      conditions.push(`TxnDate <= '${filters.to_date}'`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.Payment || [];
  }

  /**
   * Get accounts from QuickBooks API
   */
  private async getAccounts(accessToken: string, realmId: string, filters?: any): Promise<any> {
    let query = "SELECT * FROM Account";
    
    // Add filtering support
    if (filters?.account_type) {
      query += ` WHERE AccountType = '${filters.account_type}'`;
    }
    if (filters?.active !== undefined) {
      const whereClause = query.includes('WHERE') ? ' AND ' : ' WHERE ';
      query += `${whereClause} Active = ${filters.active}`;
    }

    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.Account || [];
  }

  /**
   * Get company info from QuickBooks API
   */
  private async getCompanyInfo(accessToken: string, realmId: string): Promise<any> {
    const query = "SELECT * FROM CompanyInfo";
    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.CompanyInfo?.[0] || null;
  }

  /**
   * Get vendors from QuickBooks API
   */
  private async getVendors(accessToken: string, realmId: string, filters?: any): Promise<any> {
    let query = "SELECT * FROM Vendor";
    
    // Add filtering support
    if (filters?.active !== undefined) {
      query += ` WHERE Active = ${filters.active}`;
    }
    if (filters?.since) {
      const whereClause = query.includes('WHERE') ? ' AND ' : ' WHERE ';
      query += `${whereClause} MetaData.LastUpdatedTime >= '${filters.since}'`;
    }

    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.Vendor || [];
  }

  /**
   * Get items from QuickBooks API
   */
  private async getItems(accessToken: string, realmId: string, filters?: any): Promise<any> {
    let query = "SELECT * FROM Item";
    
    // Add filtering support
    if (filters?.item_type) {
      query += ` WHERE Type = '${filters.item_type}'`;
    }
    if (filters?.active !== undefined) {
      const whereClause = query.includes('WHERE') ? ' AND ' : ' WHERE ';
      query += `${whereClause} Active = ${filters.active}`;
    }
    if (filters?.since) {
      const whereClause = query.includes('WHERE') ? ' AND ' : ' WHERE ';
      query += `${whereClause} MetaData.LastUpdatedTime >= '${filters.since}'`;
    }

    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.Item || [];
  }

  /**
   * Get estimates from QuickBooks API
   */
  private async getEstimates(accessToken: string, realmId: string, filters?: any): Promise<any> {
    let query = "SELECT * FROM Estimate";
    
    // Add filtering support
    const conditions: string[] = [];
    
    if (filters?.customer_id) {
      conditions.push(`CustomerRef = '${filters.customer_id}'`);
    }
    if (filters?.from_date) {
      conditions.push(`TxnDate >= '${filters.from_date}'`);
    }
    if (filters?.to_date) {
      conditions.push(`TxnDate <= '${filters.to_date}'`);
    }
    if (filters?.since) {
      conditions.push(`MetaData.LastUpdatedTime >= '${filters.since}'`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.Estimate || [];
  }

  /**
   * Get bills from QuickBooks API
   */
  private async getBills(accessToken: string, realmId: string, filters?: any): Promise<any> {
    let query = "SELECT * FROM Bill";
    
    // Add filtering support
    const conditions: string[] = [];
    
    if (filters?.vendor_id) {
      conditions.push(`VendorRef = '${filters.vendor_id}'`);
    }
    if (filters?.from_date) {
      conditions.push(`TxnDate >= '${filters.from_date}'`);
    }
    if (filters?.to_date) {
      conditions.push(`TxnDate <= '${filters.to_date}'`);
    }
    if (filters?.since) {
      conditions.push(`MetaData.LastUpdatedTime >= '${filters.since}'`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.Bill || [];
  }

  /**
   * Get bill payments from QuickBooks API
   */
  private async getBillPayments(accessToken: string, realmId: string, filters?: any): Promise<any> {
    let query = "SELECT * FROM BillPayment";
    
    // Add filtering support
    const conditions: string[] = [];
    
    if (filters?.vendor_id) {
      conditions.push(`VendorRef = '${filters.vendor_id}'`);
    }
    if (filters?.from_date) {
      conditions.push(`TxnDate >= '${filters.from_date}'`);
    }
    if (filters?.to_date) {
      conditions.push(`TxnDate <= '${filters.to_date}'`);
    }
    if (filters?.since) {
      conditions.push(`MetaData.LastUpdatedTime >= '${filters.since}'`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.BillPayment || [];
  }

  /**
   * Get bank accounts from QuickBooks API (subset of accounts)
   */
  private async getBankAccounts(accessToken: string, realmId: string, filters?: any): Promise<any> {
    let query = "SELECT * FROM Account WHERE AccountType IN ('Bank', 'Other Current Asset', 'Credit Card')";
    
    // Add additional filtering support
    if (filters?.active !== undefined) {
      query += ` AND Active = ${filters.active}`;
    }
    if (filters?.since) {
      query += ` AND MetaData.LastUpdatedTime >= '${filters.since}'`;
    }

    const response = await this.makeApiCall(realmId, query, accessToken);
    return response.QueryResponse?.Account || [];
  }

  /**
   * Get bank transactions from QuickBooks API
   * Note: QuickBooks has limited support for bank transactions via BankTransfer
   */
  private async getBankTransactions(accessToken: string, realmId: string, filters?: any): Promise<any> {
    try {
      // QuickBooks doesn't have a direct "BankTransaction" entity like Xero
      // We can get some bank-related data via BankTransfer, but it's limited
      let query = "SELECT * FROM Transfer";
      
      // Add filtering support
      const conditions: string[] = [];
      
      if (filters?.from_account_id) {
        conditions.push(`FromAccountRef = '${filters.from_account_id}'`);
      }
      if (filters?.to_account_id) {
        conditions.push(`ToAccountRef = '${filters.to_account_id}'`);
      }
      if (filters?.from_date) {
        conditions.push(`TxnDate >= '${filters.from_date}'`);
      }
      if (filters?.to_date) {
        conditions.push(`TxnDate <= '${filters.to_date}'`);
      }
      if (filters?.since) {
        conditions.push(`MetaData.LastUpdatedTime >= '${filters.since}'`);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      const response = await this.makeApiCall(realmId, query, accessToken);
      const transfers = response.QueryResponse?.Transfer || [];

      // Return with a note about limited functionality
      return {
        transfers: transfers,
        note: 'QuickBooks has limited bank transaction support. Only internal transfers are available via this endpoint.'
      };
    } catch (error) {
      // Graceful degradation
      return {
        transfers: [],
        error: 'QuickBooks bank transaction retrieval not fully supported',
        note: 'Consider using QuickBooks native bank feeds or manual transaction entry.'
      };
    }
  }

  /**
   * Get budgets from QuickBooks API
   * Note: QuickBooks has limited budget support in the API
   */
  private async getBudgets(accessToken: string, realmId: string, filters?: any): Promise<any> {
    try {
      // QuickBooks budget API is very limited and not commonly available
      // Most budget functionality is UI-only
      return {
        budgets: [],
        note: 'QuickBooks budget data is not available via public API',
        error: 'Budget endpoint not supported by QuickBooks Online API'
      };
    } catch (error) {
      // Graceful degradation
      return {
        budgets: [],
        error: 'QuickBooks budget retrieval not supported',
        note: 'Budget data must be accessed through QuickBooks UI or reports.'
      };
    }
  }

  /**
   * Get exchange rates from QuickBooks API
   * Note: QuickBooks has limited exchange rate support
   */
  private async getExchangeRates(accessToken: string, realmId: string, filters?: any): Promise<any> {
    try {
      // QuickBooks doesn't provide historical exchange rates via API
      // Exchange rates are handled automatically for multi-currency transactions
      return {
        exchange_rates: [],
        note: 'QuickBooks exchange rates are handled automatically for multi-currency transactions',
        error: 'Historical exchange rate data not available via QuickBooks API'
      };
    } catch (error) {
      // Graceful degradation
      return {
        exchange_rates: [],
        error: 'QuickBooks exchange rate retrieval not supported',
        note: 'Exchange rates are managed automatically in QuickBooks multi-currency companies.'
      };
    }
  }

  /**
   * Generic API call method for QuickBooks with proper query formatting
   */
  private async makeApiCall(realmId: string, query: string, accessToken: string, options?: RequestOptions): Promise<any> {
    const apiVersion = 'v3';
    const url = `${this.baseUrl}/${apiVersion}/company/${realmId}/query`;
    
    const queryParams = new URLSearchParams({
      query: query
    });

    const fullUrl = `${url}?${queryParams.toString()}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    const requestOptions: RequestInit = {
      method: options?.method || 'GET',
      headers,
    };

    if (options?.body && (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH')) {
      requestOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(fullUrl, requestOptions);

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
      
      console.warn(`QuickBooks API rate limit hit. Waiting ${waitTime}ms before retry.`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Retry the request once
      return this.makeApiCall(realmId, query, accessToken, options);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Create entities in QuickBooks (for future use)
   */
  private async createEntity(realmId: string, entityType: string, entityData: any, accessToken: string): Promise<any> {
    const apiVersion = 'v3';
    const url = `${this.baseUrl}/${apiVersion}/company/${realmId}/${entityType}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(entityData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QuickBooks create ${entityType} failed (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Standardize raw QuickBooks data using DataTransformer
   */
  async standardizeData(rawData: any, dataType: string): Promise<any> {
    // This will be handled by the APIMiddleware using DataTransformer
    // For now, return as-is since transformation happens at middleware level
    return rawData;
  }

  /**
   * Setup webhook for QuickBooks
   */
  async setupWebhook(config: WebhookConfig): Promise<WebhookResult> {
    // QuickBooks webhook configuration would be implemented here
    // QuickBooks uses webhooks via App Dashboard configuration
    return {
      success: false,
      error: 'QuickBooks webhook setup requires configuration in Intuit Developer Dashboard'
    };
  }

  /**
   * Handle incoming webhook from QuickBooks
   */
  async handleWebhook(payload: any): Promise<any> {
    // Handle QuickBooks webhook payload
    // QuickBooks sends webhook notifications for entity changes
    return { processed: false, message: 'Webhook handling not implemented yet' };
  }

  /**
   * Health check for QuickBooks API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.tokenAccessor) return false;

      // Try to get tokens to verify connection
      const tokenData = await this.tokenAccessor(this.name);
      if (!tokenData) return false;

      // Test API connectivity with company info query
      // Note: This requires a realmId, so we'll just validate token presence
      return true;
    } catch (error) {
      console.error('QuickBooks health check failed:', error);
      return false;
    }
  }

  /**
   * Health check with specific realmId
   */
  async healthCheckWithRealm(realmId: string): Promise<boolean> {
    try {
      if (!this.tokenAccessor) return false;

      const tokenData = await this.tokenAccessor(this.name, realmId);
      if (!tokenData) return false;

      // Test with a simple company info query
      await this.getCompanyInfo(tokenData.accessToken, realmId);
      return true;
    } catch (error) {
      console.error(`QuickBooks health check failed for realm ${realmId}:`, error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    // Clear any cached data or connections
    // For QuickBooks, this is primarily token cleanup which is handled by AuthManager
    console.log('QuickBooks provider disconnected');
  }

  /**
   * Sync data to database
   */
  async syncToDatabase(tenantId?: string): Promise<{ synced: number; errors: string[] }> {
    try {
      if (!this.tokenAccessor) {
        return { synced: 0, errors: ['Token accessor not configured'] };
      }

      // For QuickBooks, tenantId should be the realmId
      const realmId = tenantId;
      if (!realmId) {
        return { synced: 0, errors: ['QuickBooks realmId is required for sync'] };
      }

      const tokenData = await this.tokenAccessor(this.name, realmId);
      if (!tokenData) {
        return { synced: 0, errors: ['No valid authentication tokens'] };
      }

      let syncedCount = 0;
      const errors: string[] = [];

      try {
        // Sync customers
        const customers = await this.getCustomers(tokenData.accessToken, realmId);
        // TODO: Save customers to database using storage interface
        syncedCount += customers.length;
        console.log(`Synced ${customers.length} customers from QuickBooks`);
      } catch (error) {
        errors.push(`Customers sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      try {
        // Sync invoices
        const invoices = await this.getInvoices(tokenData.accessToken, realmId);
        // TODO: Save invoices to database using storage interface
        syncedCount += invoices.length;
        console.log(`Synced ${invoices.length} invoices from QuickBooks`);
      } catch (error) {
        errors.push(`Invoices sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      try {
        // Sync payments
        const payments = await this.getPayments(tokenData.accessToken, realmId);
        // TODO: Save payments to database using storage interface
        syncedCount += payments.length;
        console.log(`Synced ${payments.length} payments from QuickBooks`);
      } catch (error) {
        errors.push(`Payments sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return { synced: syncedCount, errors };

    } catch (error) {
      console.error('QuickBooks database sync failed:', error);
      return { 
        synced: 0, 
        errors: [error instanceof Error ? error.message : 'Sync failed'] 
      };
    }
  }

  /**
   * Get all available companies (realms) for the authenticated user
   */
  async getAvailableCompanies(accessToken: string): Promise<any[]> {
    try {
      // This would typically be handled during the OAuth flow
      // QuickBooks provides company selection during authorization
      // For now, return empty array as this is handled in OAuth callback
      return [];
    } catch (error) {
      console.error('Failed to get QuickBooks companies:', error);
      return [];
    }
  }
}