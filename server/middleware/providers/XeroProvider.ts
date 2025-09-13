import { 
  UniversalProvider, 
  ProviderConfig, 
  APIResponse, 
  RequestOptions,
  WebhookConfig,
  WebhookResult,
  TokenAccessor
} from '../types';
import { xeroService } from '../../services/xero';

/**
 * Xero Provider Implementation
 * Wraps the existing Xero service to conform to UniversalProvider interface
 */
export class XeroProvider implements UniversalProvider {
  readonly name = 'xero';
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
   * Make authenticated request to Xero API
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

      const tokens = {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || '',
        expiresAt: tokenData.expiresAt || new Date(),
        tenantId: tokenData.tenantId || '',
      };

      let result;

      // Map generic endpoints to specific Xero service methods
      switch (endpoint.toLowerCase()) {
        case 'contacts':
          result = await xeroService.getContacts(tokens, options?.params?.filters, tokenData.tenantId);
          break;
        case 'invoices':
          result = await xeroService.getInvoices(tokens, options?.params?.filters);
          break;
        case 'payments':
          if (options?.params?.invoiceId) {
            result = await xeroService.getInvoicePayments(tokens, options.params.invoiceId, tokenData.tenantId);
          } else {
            result = await xeroService.getPayments(tokens);
          }
          break;
          
        // ===== NEW ENDPOINTS FOR COMPREHENSIVE CASHFLOW FORECASTING =====
        case 'bills':
          result = await xeroService.getBills(tokens, options?.params?.filters, tokenData.tenantId);
          break;
        case 'bill':
          if (options?.params?.billId) {
            result = await xeroService.getBill(tokens, options.params.billId, tokenData.tenantId);
          } else {
            return { success: false, error: 'Bill ID required for single bill retrieval' };
          }
          break;
        case 'bill-payments':
        case 'billpayments':
          result = await xeroService.getBillPayments(tokens, options?.params?.filters, tokenData.tenantId);
          break;
        case 'bank-accounts':
        case 'bankaccounts':
          result = await xeroService.getBankAccounts(tokens, options?.params?.filters, tokenData.tenantId);
          break;
        case 'bank-account':
        case 'bankaccount':
          if (options?.params?.accountId) {
            result = await xeroService.getBankAccount(tokens, options.params.accountId, tokenData.tenantId);
          } else {
            return { success: false, error: 'Account ID required for single bank account retrieval' };
          }
          break;
        case 'bank-transactions':
        case 'banktransactions':
          result = await xeroService.getBankTransactions(tokens, options?.params?.filters, tokenData.tenantId);
          break;
        case 'bank-transaction':
        case 'banktransaction':
          if (options?.params?.transactionId) {
            result = await xeroService.getBankTransaction(tokens, options.params.transactionId, tokenData.tenantId);
          } else {
            return { success: false, error: 'Transaction ID required for single bank transaction retrieval' };
          }
          break;
        case 'budgets':
          result = await xeroService.getBudgets(tokens, options?.params?.filters, tokenData.tenantId);
          break;
        case 'budget':
          if (options?.params?.budgetId) {
            result = await xeroService.getBudget(tokens, options.params.budgetId, tokenData.tenantId);
          } else {
            return { success: false, error: 'Budget ID required for single budget retrieval' };
          }
          break;
        case 'exchange-rates':
        case 'exchangerates':
          result = await xeroService.getExchangeRates(tokens, options?.params?.filters, tokenData.tenantId);
          break;
        case 'exchange-rate':
        case 'exchangerate':
          if (options?.params?.fromCurrency && options?.params?.toCurrency) {
            result = await xeroService.getCurrentExchangeRate(
              tokens, 
              options.params.fromCurrency, 
              options.params.toCurrency, 
              tokenData.tenantId
            );
          } else {
            return { success: false, error: 'From and to currency codes required for exchange rate retrieval' };
          }
          break;
        default:
          // For other endpoints, we could extend this or use direct API calls
          return { 
            success: false, 
            error: `Endpoint '${endpoint}' not implemented for Xero provider. Supported endpoints: contacts, invoices, payments, bills, bill-payments, bank-accounts, bank-transactions, budgets, exchange-rates` 
          };
      }

      return {
        success: true,
        data: result as T,
        statusCode: 200
      };

    } catch (error) {
      console.error(`Xero API request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500
      };
    }
  }

  /**
   * Standardize raw Xero data using DataTransformer
   */
  async standardizeData(rawData: any, dataType: string): Promise<any> {
    // This will be handled by the APIMiddleware using DataTransformer
    // For now, return as-is since transformation happens at middleware level
    return rawData;
  }

  /**
   * Setup webhook for Xero
   */
  async setupWebhook(config: WebhookConfig): Promise<WebhookResult> {
    // Xero webhooks would be configured here
    // For MVP, return not implemented
    return {
      success: false,
      error: 'Xero webhook setup not implemented yet'
    };
  }

  /**
   * Handle incoming webhook from Xero
   */
  async handleWebhook(payload: any): Promise<any> {
    // Handle Xero webhook payload
    // For MVP, return not implemented
    return { processed: false, message: 'Webhook handling not implemented yet' };
  }

  /**
   * Health check for Xero API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.tokenAccessor) return false;

      // Try to get tokens to verify connection
      const tokenData = await this.tokenAccessor(this.name);
      return !!tokenData;
    } catch (error) {
      console.error('Xero health check failed:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    // Clear any cached data or connections
    // For Xero, this is primarily token cleanup which is handled by AuthManager
    console.log('Xero provider disconnected');
  }

  /**
   * Sync data to database using existing Xero sync methods
   */
  async syncToDatabase(tenantId: string): Promise<{ synced: number; errors: string[] }> {
    try {
      if (!this.tokenAccessor) {
        return { synced: 0, errors: ['Token accessor not configured'] };
      }

      const tokenData = await this.tokenAccessor(this.name, tenantId);
      if (!tokenData) {
        return { synced: 0, errors: ['No valid authentication tokens'] };
      }

      const tokens = {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || '',
        expiresAt: tokenData.expiresAt || new Date(),
        tenantId: tokenData.tenantId || tenantId,
      };

      // Sync contacts
      const contactsResult = await xeroService.syncContactsToDatabase(tokens, tenantId);
      
      // Sync invoices  
      const invoicesResult = await xeroService.syncInvoicesToDatabase(tokens, tenantId);

      const totalSynced = contactsResult.synced + invoicesResult.synced;
      const allErrors = [...contactsResult.errors, ...invoicesResult.errors];

      return { synced: totalSynced, errors: allErrors };

    } catch (error) {
      console.error('Xero database sync failed:', error);
      return { 
        synced: 0, 
        errors: [error instanceof Error ? error.message : 'Sync failed'] 
      };
    }
  }
}