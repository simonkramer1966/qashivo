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
 * Sage Provider Implementation
 * Handles OAuth 2.0 authentication and API requests to Sage Business Cloud Accounting
 */
export class SageProvider implements UniversalProvider {
  readonly name = 'sage';
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
   * Make authenticated request to Sage API
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
          error: 'No valid authentication tokens available. Please connect to Sage first.' 
        };
      }

      const baseUrl = this.config.baseUrl || 'https://api.accounting.sage.com/v3.1';
      let result;

      // Map generic endpoints to Sage API calls
      switch (endpoint.toLowerCase()) {
        case 'contacts':
          result = await this.getContacts(tokenData.accessToken);
          break;
        case 'invoices':
          result = await this.getInvoices(tokenData.accessToken, options?.params?.filters);
          break;
        case 'payments':
          result = await this.getPayments(tokenData.accessToken, options?.params?.filters);
          break;
        case 'bills':
          result = await this.getBills(tokenData.accessToken, options?.params?.filters);
          break;
        case 'company-info':
          result = await this.getBusinessInfo(tokenData.accessToken);
          break;
        default:
          return { 
            success: false, 
            error: `Endpoint '${endpoint}' not implemented for Sage provider. Supported endpoints: contacts, invoices, payments, bills, company-info` 
          };
      }

      return {
        success: true,
        data: result as T,
        statusCode: 200
      };

    } catch (error) {
      console.error(`Sage API request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  /**
   * Get contacts from Sage
   */
  private async getContacts(accessToken: string): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://api.accounting.sage.com/v3.1';
    const response = await fetch(
      `${baseUrl}/contacts`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Sage API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.$items || [];
  }

  /**
   * Get sales invoices from Sage
   */
  private async getInvoices(accessToken: string, filters?: any): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://api.accounting.sage.com/v3.1';
    let url = `${baseUrl}/sales_invoices`;
    
    // Add filters if needed
    const params = new URLSearchParams();
    if (filters?.status === 'unpaid') {
      params.append('$filter', 'outstanding_amount gt 0');
    }
    
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Sage API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.$items || [];
  }

  /**
   * Get payments from Sage
   */
  private async getPayments(accessToken: string, filters?: any): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://api.accounting.sage.com/v3.1';
    const response = await fetch(
      `${baseUrl}/contact_payments`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Sage API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.$items || [];
  }

  /**
   * Get purchase invoices (bills) from Sage
   */
  private async getBills(accessToken: string, filters?: any): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://api.accounting.sage.com/v3.1';
    const response = await fetch(
      `${baseUrl}/purchase_invoices`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Sage API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.$items || [];
  }

  /**
   * Get business info from Sage
   */
  private async getBusinessInfo(accessToken: string): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://api.accounting.sage.com/v3.1';
    const response = await fetch(
      `${baseUrl}/businesses`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Sage API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.$items?.[0];
  }

  /**
   * Standardize raw Sage data
   */
  async standardizeData(rawData: any, dataType: string): Promise<any> {
    // Transform Sage data to standard format
    // This will be handled by DataTransformer at middleware level
    return rawData;
  }

  /**
   * Setup webhook for Sage events
   */
  async setupWebhook(config: WebhookConfig): Promise<WebhookResult> {
    return {
      success: true,
      webhookId: 'sage-webhook',
      url: config.url
    };
  }

  /**
   * Handle incoming webhook from Sage
   */
  async handleWebhook(payload: any): Promise<any> {
    console.log('Sage webhook received:', payload);
    return { received: true };
  }

  /**
   * Health check for Sage connection
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

      // Try to get business info to verify connection
      const result = await this.makeRequest('company-info');
      return result.success;
    } catch (error) {
      console.error('Sage health check failed:', error);
      return false;
    }
  }

  /**
   * Disconnect from Sage
   */
  async disconnect(): Promise<void> {
    console.log('Disconnecting from Sage');
    // Cleanup any resources if needed
  }

  /**
   * Sync data to database (not implemented yet)
   */
  async syncToDatabase(tenantId: string): Promise<{ synced: number; errors: string[] }> {
    console.log(`Sage sync to database not implemented yet for tenant ${tenantId}`);
    return { synced: 0, errors: ['Sync not implemented'] };
  }
}
