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
 * Handles OAuth 2.0 authentication and API requests to QuickBooks Online
 */
export class QuickBooksProvider implements UniversalProvider {
  readonly name = 'quickbooks';
  readonly type = 'accounting' as const;
  readonly config: ProviderConfig;
  private tokenAccessor?: TokenAccessor;

  constructor(config: ProviderConfig) {
    this.config = config;
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
      const tokenData = await this.tokenAccessor(this.name, options?.params?.tenantId);
      if (!tokenData) {
        return { 
          success: false, 
          error: 'No valid authentication tokens available. Please connect to QuickBooks first.' 
        };
      }

      // QuickBooks uses realmId instead of tenantId
      const realmId = tokenData.tenantId;
      if (!realmId) {
        return {
          success: false,
          error: 'QuickBooks realm ID not found. Please reconnect your account.'
        };
      }

      const baseUrl = this.config.baseUrl || 'https://quickbooks.api.intuit.com';
      let result;

      // Map generic endpoints to QuickBooks API calls
      switch (endpoint.toLowerCase()) {
        case 'contacts':
          result = await this.getCustomers(tokenData.accessToken, realmId);
          break;
        case 'invoices':
          result = await this.getInvoices(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'payments':
          result = await this.getPayments(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'bills':
          result = await this.getBills(tokenData.accessToken, realmId, options?.params?.filters);
          break;
        case 'company-info':
          result = await this.getCompanyInfo(tokenData.accessToken, realmId);
          break;
        default:
          return { 
            success: false, 
            error: `Endpoint '${endpoint}' not implemented for QuickBooks provider. Supported endpoints: contacts, invoices, payments, bills, company-info` 
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
   * Get customers from QuickBooks
   */
  private async getCustomers(accessToken: string, realmId: string): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://quickbooks.api.intuit.com';
    const response = await fetch(
      `${baseUrl}/v3/company/${realmId}/query?query=SELECT * FROM Customer MAXRESULTS 1000`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Customer || [];
  }

  /**
   * Get invoices from QuickBooks
   */
  private async getInvoices(accessToken: string, realmId: string, filters?: any): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://quickbooks.api.intuit.com';
    let query = 'SELECT * FROM Invoice';
    
    if (filters?.status) {
      query += ` WHERE Balance > '0'`;
    }
    
    query += ' MAXRESULTS 1000';

    const response = await fetch(
      `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Invoice || [];
  }

  /**
   * Get payments from QuickBooks
   */
  private async getPayments(accessToken: string, realmId: string, filters?: any): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://quickbooks.api.intuit.com';
    const query = 'SELECT * FROM Payment MAXRESULTS 1000';

    const response = await fetch(
      `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Payment || [];
  }

  /**
   * Get bills from QuickBooks
   */
  private async getBills(accessToken: string, realmId: string, filters?: any): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://quickbooks.api.intuit.com';
    const query = 'SELECT * FROM Bill MAXRESULTS 1000';

    const response = await fetch(
      `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Bill || [];
  }

  /**
   * Get company info from QuickBooks
   */
  private async getCompanyInfo(accessToken: string, realmId: string): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://quickbooks.api.intuit.com';
    const response = await fetch(
      `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`QuickBooks API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.CompanyInfo;
  }

  /**
   * Standardize raw QuickBooks data
   */
  async standardizeData(rawData: any, dataType: string): Promise<any> {
    // Transform QuickBooks data to standard format
    // This will be handled by DataTransformer at middleware level
    return rawData;
  }

  /**
   * Setup webhook for QuickBooks events
   */
  async setupWebhook(config: WebhookConfig): Promise<WebhookResult> {
    return {
      success: true,
      webhookId: 'qb-webhook',
      url: config.url
    };
  }

  /**
   * Handle incoming webhook from QuickBooks
   */
  async handleWebhook(payload: any): Promise<any> {
    console.log('QuickBooks webhook received:', payload);
    return { received: true };
  }

  /**
   * Health check for QuickBooks connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.tokenAccessor) {
        return false;
      }

      const tokenData = await this.tokenAccessor(this.name);
      if (!tokenData || !tokenData.accessToken) {
        return false;
      }

      // Try to get company info to verify connection
      const result = await this.makeRequest('company-info');
      return result.success;
    } catch (error) {
      console.error('QuickBooks health check failed:', error);
      return false;
    }
  }

  /**
   * Disconnect from QuickBooks
   */
  async disconnect(): Promise<void> {
    console.log('Disconnecting from QuickBooks');
    // Cleanup any resources if needed
  }

  /**
   * Sync data to database (not implemented yet)
   */
  async syncToDatabase(tenantId: string): Promise<{ synced: number; errors: string[] }> {
    console.log(`QuickBooks sync to database not implemented yet for tenant ${tenantId}`);
    return { synced: 0, errors: ['Sync not implemented'] };
  }
}
