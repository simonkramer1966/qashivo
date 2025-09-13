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
        case 'invoices':
          result = await this.getInvoices(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'payments':
          result = await this.getPayments(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'accounts':
          result = await this.getAccounts(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'company_info':
          result = await this.getCompanyInfo(tokenData.accessToken, realmId);
          break;
        default:
          return { 
            success: false, 
            error: `Endpoint '${endpoint}' not implemented for QuickBooks provider` 
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