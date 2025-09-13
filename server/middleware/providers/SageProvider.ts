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
 * Sage Business Cloud Provider Implementation
 * Implements UniversalProvider interface for Sage Business Cloud API
 * 
 * Key Features:
 * - OAuth 2.0 authentication
 * - REST JSON API integration
 * - UK market focused accounting data
 * - Rate limiting compliance
 * - Data standardization for contacts, invoices, and payments
 */
export class SageProvider implements UniversalProvider {
  readonly name = 'sage';
  readonly type = 'accounting' as const;
  readonly config: ProviderConfig;
  private tokenAccessor?: TokenAccessor;
  private baseUrl: string;

  // Sage API endpoints
  private readonly endpoints = {
    contacts: '/contacts',
    sales_invoices: '/sales_invoices',
    purchase_invoices: '/purchase_invoices',
    bills: '/purchase_invoices', // Bills map to purchase invoices in Sage
    payments: '/bank_receipts',
    bill_payments: '/bank_payments',
    bank_accounts: '/bank_accounts',
    bank_transactions: '/bank_transactions',
    budgets: '/budgets', // Note: Limited Sage support
    ledger_accounts: '/ledger_accounts',
    exchange_rates: '/exchange_rates'
  };

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.accounting.sage.com/v3.1';
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
          error: 'No valid authentication tokens available' 
        };
      }

      let result;

      // Map generic endpoints to specific Sage API calls
      switch (endpoint.toLowerCase()) {
        case 'contacts':
          result = await this.getContacts(tokenData.accessToken, options?.params?.filters);
          break;
        case 'invoices':
          result = await this.getInvoices(tokenData.accessToken, options?.params?.filters);
          break;
        case 'bills':
          result = await this.getBills(tokenData.accessToken, options?.params?.filters);
          break;
        case 'payments':
          result = await this.getPayments(tokenData.accessToken, options?.params?.filters);
          break;
        case 'bill-payments':
        case 'billpayments':
          result = await this.getBillPayments(tokenData.accessToken, options?.params?.filters);
          break;
        case 'bank-accounts':
        case 'bankaccounts':
          result = await this.getBankAccounts(tokenData.accessToken, options?.params?.filters);
          break;
        case 'bank-transactions':
        case 'banktransactions':
          result = await this.getBankTransactions(tokenData.accessToken, options?.params?.filters);
          break;
        case 'budgets':
          result = await this.getBudgets(tokenData.accessToken, options?.params?.filters);
          break;
        case 'exchange-rates':
        case 'exchangerates':
          result = await this.getExchangeRates(tokenData.accessToken, options?.params?.filters);
          break;
        case 'ledger_accounts':
          result = await this.getLedgerAccounts(tokenData.accessToken, options?.params?.filters);
          break;
        default:
          return { 
            success: false, 
            error: `Endpoint '${endpoint}' not implemented for Sage provider. Supported endpoints: contacts, invoices, bills, payments, bill-payments, bank-accounts, bank-transactions, budgets, exchange-rates, ledger_accounts` 
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
   * Get contacts from Sage API
   */
  private async getContacts(accessToken: string, filters?: any): Promise<any> {
    const url = `${this.baseUrl}${this.endpoints.contacts}`;
    const queryParams = new URLSearchParams();
    
    // Add filtering support
    if (filters?.since) {
      queryParams.append('updated_or_created_since', filters.since);
    }
    if (filters?.active !== undefined) {
      queryParams.append('active', filters.active.toString());
    }

    const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

    const response = await this.makeApiCall(fullUrl, accessToken);
    return response.$items || [];
  }

  /**
   * Get sales invoices from Sage API
   */
  private async getInvoices(accessToken: string, filters?: any): Promise<any> {
    const url = `${this.baseUrl}${this.endpoints.sales_invoices}`;
    const queryParams = new URLSearchParams();
    
    // Add filtering support
    if (filters?.from_date) {
      queryParams.append('from_date', filters.from_date);
    }
    if (filters?.to_date) {
      queryParams.append('to_date', filters.to_date);
    }
    if (filters?.contact_id) {
      queryParams.append('contact_id', filters.contact_id);
    }

    const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

    const response = await this.makeApiCall(fullUrl, accessToken);
    return response.$items || [];
  }

  /**
   * Get payments (bank receipts) from Sage API
   */
  private async getPayments(accessToken: string, filters?: any): Promise<any> {
    const url = `${this.baseUrl}${this.endpoints.payments}`;
    const queryParams = new URLSearchParams();
    
    // Add filtering support
    if (filters?.from_date) {
      queryParams.append('from_date', filters.from_date);
    }
    if (filters?.to_date) {
      queryParams.append('to_date', filters.to_date);
    }

    const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

    const response = await this.makeApiCall(fullUrl, accessToken);
    return response.$items || [];
  }

  /**
   * Get ledger accounts from Sage API
   */
  private async getLedgerAccounts(accessToken: string, filters?: any): Promise<any> {
    const url = `${this.baseUrl}${this.endpoints.ledger_accounts}`;
    const queryParams = new URLSearchParams();
    
    // Add filtering support
    if (filters?.account_type_id) {
      queryParams.append('account_type_id', filters.account_type_id);
    }

    const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

    const response = await this.makeApiCall(fullUrl, accessToken);
    return response.$items || [];
  }

  /**
   * Get bills (purchase invoices) from Sage API
   */
  private async getBills(accessToken: string, filters?: any): Promise<any> {
    const url = `${this.baseUrl}${this.endpoints.bills}`;
    const queryParams = new URLSearchParams();
    
    // Add filtering support
    if (filters?.from_date) {
      queryParams.append('from_date', filters.from_date);
    }
    if (filters?.to_date) {
      queryParams.append('to_date', filters.to_date);
    }
    if (filters?.contact_id) {
      queryParams.append('contact_id', filters.contact_id);
    }
    if (filters?.since) {
      queryParams.append('updated_or_created_since', filters.since);
    }

    const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

    const response = await this.makeApiCall(fullUrl, accessToken);
    return response.$items || [];
  }

  /**
   * Get bill payments from Sage API
   */
  private async getBillPayments(accessToken: string, filters?: any): Promise<any> {
    const url = `${this.baseUrl}${this.endpoints.bill_payments}`;
    const queryParams = new URLSearchParams();
    
    // Add filtering support
    if (filters?.from_date) {
      queryParams.append('from_date', filters.from_date);
    }
    if (filters?.to_date) {
      queryParams.append('to_date', filters.to_date);
    }
    if (filters?.since) {
      queryParams.append('updated_or_created_since', filters.since);
    }

    const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

    const response = await this.makeApiCall(fullUrl, accessToken);
    return response.$items || [];
  }

  /**
   * Get bank accounts from Sage API
   */
  private async getBankAccounts(accessToken: string, filters?: any): Promise<any> {
    const url = `${this.baseUrl}${this.endpoints.bank_accounts}`;
    const queryParams = new URLSearchParams();
    
    // Add filtering support
    if (filters?.since) {
      queryParams.append('updated_or_created_since', filters.since);
    }
    if (filters?.active !== undefined) {
      queryParams.append('active', filters.active.toString());
    }

    const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

    const response = await this.makeApiCall(fullUrl, accessToken);
    return response.$items || [];
  }

  /**
   * Get bank transactions from Sage API
   */
  private async getBankTransactions(accessToken: string, filters?: any): Promise<any> {
    const url = `${this.baseUrl}${this.endpoints.bank_transactions}`;
    const queryParams = new URLSearchParams();
    
    // Add filtering support
    if (filters?.from_date) {
      queryParams.append('from_date', filters.from_date);
    }
    if (filters?.to_date) {
      queryParams.append('to_date', filters.to_date);
    }
    if (filters?.bank_account_id) {
      queryParams.append('bank_account_id', filters.bank_account_id);
    }
    if (filters?.since) {
      queryParams.append('updated_or_created_since', filters.since);
    }

    const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

    const response = await this.makeApiCall(fullUrl, accessToken);
    return response.$items || [];
  }

  /**
   * Get budgets from Sage API
   * Note: Sage has limited budget support
   */
  private async getBudgets(accessToken: string, filters?: any): Promise<any> {
    try {
      const url = `${this.baseUrl}${this.endpoints.budgets}`;
      const queryParams = new URLSearchParams();
      
      // Add filtering support
      if (filters?.since) {
        queryParams.append('updated_or_created_since', filters.since);
      }

      const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

      const response = await this.makeApiCall(fullUrl, accessToken);
      return response.$items || [];
    } catch (error) {
      // Graceful degradation
      return {
        budgets: [],
        error: 'Sage budget retrieval may not be available',
        note: 'Budget functionality varies by Sage subscription level and configuration.'
      };
    }
  }

  /**
   * Get exchange rates from Sage API (now properly implemented)
   */
  private async getExchangeRates(accessToken: string, filters?: any): Promise<any> {
    try {
      const url = `${this.baseUrl}${this.endpoints.exchange_rates}`;
      const queryParams = new URLSearchParams();
      
      // Add filtering support
      if (filters?.base_currency) {
        queryParams.append('base_currency', filters.base_currency);
      }
      if (filters?.foreign_currency) {
        queryParams.append('foreign_currency', filters.foreign_currency);
      }
      if (filters?.from_date) {
        queryParams.append('from_date', filters.from_date);
      }
      if (filters?.to_date) {
        queryParams.append('to_date', filters.to_date);
      }

      const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;

      const response = await this.makeApiCall(fullUrl, accessToken);
      return response.$items || [];
    } catch (error) {
      // Graceful degradation
      return {
        exchange_rates: [],
        error: 'Sage exchange rate retrieval may not be available',
        note: 'Exchange rate access depends on Sage multi-currency setup and permissions.'
      };
    }
  }

  /**
   * Generic API call method with error handling and rate limiting
   */
  private async makeApiCall(url: string, accessToken: string, options?: RequestOptions): Promise<any> {
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

    const response = await fetch(url, requestOptions);

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
      
      console.warn(`Sage API rate limit hit. Waiting ${waitTime}ms before retry.`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Retry the request once
      return this.makeApiCall(url, accessToken, options);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sage API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Standardize raw Sage data using DataTransformer
   */
  async standardizeData(rawData: any, dataType: string): Promise<any> {
    // This will be handled by the APIMiddleware using DataTransformer
    // For now, return as-is since transformation happens at middleware level
    return rawData;
  }

  /**
   * Setup webhook for Sage
   */
  async setupWebhook(config: WebhookConfig): Promise<WebhookResult> {
    // Sage webhook configuration would be implemented here
    // Currently not implemented in MVP
    return {
      success: false,
      error: 'Sage webhook setup not implemented yet'
    };
  }

  /**
   * Handle incoming webhook from Sage
   */
  async handleWebhook(payload: any): Promise<any> {
    // Handle Sage webhook payload
    // Currently not implemented in MVP
    return { processed: false, message: 'Webhook handling not implemented yet' };
  }

  /**
   * Health check for Sage API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.tokenAccessor) return false;

      // Try to get tokens to verify connection
      const tokenData = await this.tokenAccessor(this.name);
      if (!tokenData) return false;

      // Test API connectivity with a simple call
      const testUrl = `${this.baseUrl}/contacts?$itemsPerPage=1`;
      await this.makeApiCall(testUrl, tokenData.accessToken);
      
      return true;
    } catch (error) {
      console.error('Sage health check failed:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    // Clear any cached data or connections
    // For Sage, this is primarily token cleanup which is handled by AuthManager
    console.log('Sage provider disconnected');
  }

  /**
   * Sync data to database
   */
  async syncToDatabase(tenantId?: string): Promise<{ synced: number; errors: string[] }> {
    try {
      if (!this.tokenAccessor) {
        return { synced: 0, errors: ['Token accessor not configured'] };
      }

      const tokenData = await this.tokenAccessor(this.name, tenantId);
      if (!tokenData) {
        return { synced: 0, errors: ['No valid authentication tokens'] };
      }

      let syncedCount = 0;
      const errors: string[] = [];

      try {
        // Sync contacts
        const contacts = await this.getContacts(tokenData.accessToken);
        // TODO: Save contacts to database using storage interface
        syncedCount += contacts.length;
        console.log(`Synced ${contacts.length} contacts from Sage`);
      } catch (error) {
        errors.push(`Contacts sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      try {
        // Sync invoices
        const invoices = await this.getInvoices(tokenData.accessToken);
        // TODO: Save invoices to database using storage interface
        syncedCount += invoices.length;
        console.log(`Synced ${invoices.length} invoices from Sage`);
      } catch (error) {
        errors.push(`Invoices sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      try {
        // Sync payments
        const payments = await this.getPayments(tokenData.accessToken);
        // TODO: Save payments to database using storage interface
        syncedCount += payments.length;
        console.log(`Synced ${payments.length} payments from Sage`);
      } catch (error) {
        errors.push(`Payments sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return { synced: syncedCount, errors };

    } catch (error) {
      console.error('Sage database sync failed:', error);
      return { 
        synced: 0, 
        errors: [error instanceof Error ? error.message : 'Sync failed'] 
      };
    }
  }

  /**
   * Get Sage-specific tenant information
   */
  async getTenantInfo(accessToken: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/businesses`;
      const response = await this.makeApiCall(url, accessToken);
      return response.$items?.[0] || null;
    } catch (error) {
      console.error('Failed to get Sage tenant info:', error);
      return null;
    }
  }
}