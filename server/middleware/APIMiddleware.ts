import { 
  UniversalProvider, 
  ProviderConfig, 
  ProviderType, 
  AuthResult, 
  APIResponse, 
  RequestOptions, 
  SyncResult,
  StandardContact,
  StandardInvoice,
  StandardPayment 
} from './types';
import { AuthManager } from './AuthManager';
import { DataTransformer } from './DataTransformer';
import { ProviderRegistry } from './ProviderRegistry';
import { storage } from '../storage';

/**
 * Main API Middleware Manager
 * Coordinates all providers and provides unified interface
 */
export class APIMiddleware {
  private authManager: AuthManager;
  private dataTransformer: DataTransformer;
  private providerRegistry: ProviderRegistry;

  constructor() {
    this.authManager = new AuthManager();
    this.dataTransformer = new DataTransformer();
    this.providerRegistry = new ProviderRegistry();
  }

  /**
   * Register a new provider
   */
  registerProvider(provider: UniversalProvider): void {
    // Inject token accessor into provider
    provider.setTokenAccessor(async (providerName: string, tenantId?: string) => {
      const tokens = this.authManager.getCachedTokens(providerName, tenantId);
      if (!tokens) return null;
      
      // Refresh if expired
      if (this.authManager.areTokensExpired(tokens)) {
        const registeredProvider = this.getProvider(providerName);
        if (!registeredProvider || !tokens.refreshToken) return null;
        
        const refreshResult = await this.authManager.refreshAccessToken(
          providerName,
          tokens.refreshToken,
          registeredProvider.config,
          tenantId
        );
        
        if (!refreshResult.success || !refreshResult.tokens) return null;
        return {
          accessToken: refreshResult.tokens.accessToken,
          refreshToken: refreshResult.tokens.refreshToken,
          expiresAt: refreshResult.tokens.expiresAt,
          tenantId: refreshResult.tokens.tenantId
        };
      }
      
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        tenantId: tokens.tenantId
      };
    });

    this.providerRegistry.register(provider);
    console.log(`✅ Provider registered: ${provider.name} (${provider.type})`);
  }

  /**
   * Get all registered providers
   */
  getProviders(): UniversalProvider[] {
    return this.providerRegistry.list();
  }

  /**
   * Get providers by type
   */
  getProvidersByType(type: ProviderType): UniversalProvider[] {
    return this.providerRegistry.getByType(type);
  }

  /**
   * Get a specific provider
   */
  getProvider(providerName: string): UniversalProvider | undefined {
    return this.providerRegistry.get(providerName);
  }

  /**
   * Connect to a provider (initiate OAuth flow)
   */
  async connectProvider(
    providerName: string,
    session: any,
    tenantId?: string,
    customState?: string,
    dynamicRedirectUri?: string
  ): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    try {
      const provider = this.getProvider(providerName);
      if (!provider) {
        return { success: false, error: `Provider ${providerName} not found` };
      }

      const effectiveConfig = dynamicRedirectUri 
        ? { ...provider.config, redirectUri: dynamicRedirectUri }
        : provider.config;

      const { authUrl, state } = this.authManager.generateAuthUrl(
        effectiveConfig,
        session,
        tenantId, 
        customState
      );

      return { success: true, authUrl };
    } catch (error) {
      console.error(`Failed to connect to ${providerName}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  /**
   * Complete OAuth flow with authorization code
   */
  async completeConnection(
    providerName: string,
    code: string,
    state: string,
    session: any,
    dynamicRedirectUri?: string
  ): Promise<AuthResult> {
    try {
      const provider = this.getProvider(providerName);
      if (!provider) {
        return { success: false, error: `Provider ${providerName} not found` };
      }

      const effectiveConfig = dynamicRedirectUri 
        ? { ...provider.config, redirectUri: dynamicRedirectUri }
        : provider.config;

      return await this.authManager.exchangeCodeForTokens(
        providerName,
        code,
        state,
        effectiveConfig,
        session
      );
    } catch (error) {
      console.error(`Failed to complete connection for ${providerName}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection completion failed' 
      };
    }
  }

  /**
   * Check if a provider is connected and authenticated
   */
  async isProviderConnected(providerName: string, tenantId?: string): Promise<boolean> {
    try {
      const provider = this.getProvider(providerName);
      if (!provider) return false;

      const tokens = this.authManager.getCachedTokens(providerName, tenantId);
      if (!tokens) return false;

      if (this.authManager.areTokensExpired(tokens)) {
        // Try to refresh tokens
        const refreshResult = await this.authManager.refreshAccessToken(
          providerName,
          tokens.refreshToken,
          provider.config,
          tenantId
        );
        return refreshResult.success;
      }

      return true;
    } catch (error) {
      console.error(`Failed to check connection for ${providerName}:`, error);
      return false;
    }
  }

  /**
   * Disconnect a provider
   */
  async disconnectProvider(providerName: string, tenantId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = this.getProvider(providerName);
      if (!provider) {
        return { success: false, error: `Provider ${providerName} not found` };
      }

      // Clear cached tokens
      await this.authManager.clearTokens(providerName, tenantId);
      
      // Call provider's disconnect method if it exists
      if (typeof (provider as any).disconnect === 'function') {
        await (provider as any).disconnect();
      }

      // Clear provider-specific database fields
      if (providerName === 'xero' && tenantId) {
        console.log(`🔌 Clearing Xero connection fields for tenant: ${tenantId}`);
        await storage.updateTenant(tenantId, {
          xeroAccessToken: null,
          xeroRefreshToken: null,
          xeroTenantId: null,
          xeroOrganisationName: null,
          xeroConnectionStatus: 'disconnected',
        });
        console.log(`✅ Xero connection fields cleared for tenant: ${tenantId}`);
      }

      console.log(`${providerName} provider disconnected`);
      return { success: true };
    } catch (error) {
      console.error(`Failed to disconnect ${providerName}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Disconnect failed' 
      };
    }
  }

  /**
   * Sync data from a provider
   */
  async syncData(
    providerName: string, 
    dataTypes: ('contacts' | 'invoices' | 'payments')[], 
    tenantId?: string
  ): Promise<SyncResult> {
    try {
      const provider = this.getProvider(providerName);
      if (!provider) {
        return { 
          success: false, 
          synced: 0, 
          errors: [`Provider ${providerName} not found`] 
        };
      }

      const isConnected = await this.isProviderConnected(providerName, tenantId);
      if (!isConnected) {
        return { 
          success: false, 
          synced: 0, 
          errors: [`Provider ${providerName} is not connected`] 
        };
      }

      let totalSynced = 0;
      const errors: string[] = [];

      // Sync each requested data type
      for (const dataType of dataTypes) {
        try {
          const result = await this.syncDataType(provider, dataType, tenantId);
          totalSynced += result.synced;
          errors.push(...result.errors);
        } catch (error) {
          errors.push(`Failed to sync ${dataType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        synced: totalSynced,
        errors
      };
    } catch (error) {
      console.error(`Data sync failed for ${providerName}:`, error);
      return {
        success: false,
        synced: 0,
        errors: [error instanceof Error ? error.message : 'Sync failed']
      };
    }
  }

  /**
   * Make a unified request across all providers of a type
   */
  async makeUnifiedRequest<T = any>(
    providerType: ProviderType,
    endpoint: string,
    options?: RequestOptions,
    tenantId?: string
  ): Promise<Record<string, APIResponse<T>>> {
    const providers = this.getProvidersByType(providerType);
    const results: Record<string, APIResponse<T>> = {};

    const requests = providers.map(async (provider) => {
      try {
        const isConnected = await this.isProviderConnected(provider.name, tenantId);
        if (!isConnected) {
          results[provider.name] = { 
            success: false, 
            error: `Provider ${provider.name} not connected` 
          };
          return;
        }

        results[provider.name] = await provider.makeRequest<T>(endpoint, options);
      } catch (error) {
        results[provider.name] = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Request failed' 
        };
      }
    });

    await Promise.allSettled(requests);
    return results;
  }

  /**
   * Get standardized data from all connected providers
   */
  async getAllContacts(tenantId?: string): Promise<StandardContact[]> {
    const accountingProviders = this.getProvidersByType('accounting');
    const allContacts: StandardContact[] = [];

    for (const provider of accountingProviders) {
      try {
        const isConnected = await this.isProviderConnected(provider.name, tenantId);
        if (!isConnected) continue;

        const response = await provider.makeRequest('contacts');
        if (response.success && response.data) {
          const standardized = this.dataTransformer.transformBatch<StandardContact>(
            provider.name,
            'contact',
            response.data
          );
          allContacts.push(...standardized);
        }
      } catch (error) {
        console.error(`Failed to get contacts from ${provider.name}:`, error);
      }
    }

    return allContacts;
  }

  /**
   * Get standardized invoices from all connected providers
   */
  async getAllInvoices(tenantId?: string): Promise<StandardInvoice[]> {
    const accountingProviders = this.getProvidersByType('accounting');
    const allInvoices: StandardInvoice[] = [];

    for (const provider of accountingProviders) {
      try {
        const isConnected = await this.isProviderConnected(provider.name, tenantId);
        if (!isConnected) continue;

        const response = await provider.makeRequest('invoices');
        if (response.success && response.data) {
          const standardized = this.dataTransformer.transformBatch<StandardInvoice>(
            provider.name,
            'invoice',
            response.data
          );
          allInvoices.push(...standardized);
        }
      } catch (error) {
        console.error(`Failed to get invoices from ${provider.name}:`, error);
      }
    }

    return allInvoices;
  }

  /**
   * Health check all providers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const providers = this.getProviders();
    const results: Record<string, boolean> = {};

    const checks = providers.map(async (provider) => {
      try {
        results[provider.name] = await provider.healthCheck();
      } catch (error) {
        console.error(`Health check failed for ${provider.name}:`, error);
        results[provider.name] = false;
      }
    });

    await Promise.allSettled(checks);
    return results;
  }

  /**
   * Disconnect all providers
   */
  async disconnectAll(): Promise<void> {
    const providers = this.getProviders();
    
    const disconnects = providers.map(async (provider) => {
      try {
        await provider.disconnect();
        console.log(`Disconnected from ${provider.name}`);
      } catch (error) {
        console.error(`Failed to disconnect from ${provider.name}:`, error);
      }
    });

    await Promise.allSettled(disconnects);
    this.authManager.clearTokens();
  }

  /**
   * Get authentication manager instance
   */
  getAuthManager(): AuthManager {
    return this.authManager;
  }

  /**
   * Get data transformer instance
   */
  getDataTransformer(): DataTransformer {
    return this.dataTransformer;
  }

  /**
   * Private helper to sync specific data type
   */
  private async syncDataType(
    provider: UniversalProvider,
    dataType: 'contacts' | 'invoices' | 'payments',
    tenantId?: string
  ): Promise<SyncResult> {
    // This would integrate with your existing storage system
    // For now, return a placeholder result
    return { success: true, synced: 0, errors: [] };
  }
}