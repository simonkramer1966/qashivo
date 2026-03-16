import { ProviderConfig, AuthResult } from './types';
import crypto from 'crypto';
import { db } from '../db';
import { providerConnections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { encryptToken, decryptToken } from '../utils/tokenEncryption';

/**
 * Universal Authentication Manager
 * Handles OAuth flows and token management across all providers
 */
export class AuthManager {
  private tokenCache: Map<string, any> = new Map();
  private refreshPromises: Map<string, Promise<AuthResult>> = new Map();

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(
    config: ProviderConfig, 
    session: any,
    tenantId?: string,
    customState?: string
  ): { authUrl: string; state: string } {
    // Ensure session exists before generating auth URL
    if (!session) {
      throw new Error('Session required for OAuth flow. Please ensure user is authenticated.');
    }

    const state = customState || crypto.randomBytes(16).toString('hex');
    
    // Store state in session for validation (survives redirects)
    if (!session.oauthStates) {
      session.oauthStates = {};
    }
    session.oauthStates[state] = { provider: config.name, tenantId };

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId || '',
      redirect_uri: config.redirectUri || '',
      scope: config.scopes?.join(' ') || '',
      state,
    });

    const authUrl = `${this.getAuthEndpoint(config.name)}?${params.toString()}`;
    
    return { authUrl, state };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    providerName: string,
    code: string,
    state: string,
    config: ProviderConfig,
    session: any
  ): Promise<AuthResult> {
    try {
      // Check if session exists (user may have lost session during redirect)
      if (!session || !session.oauthStates) {
        return { success: false, error: 'Session expired. Please try connecting again.' };
      }

      // Validate state from session
      const stateData = session.oauthStates[state];
      if (!stateData || stateData.provider !== providerName) {
        // State not found could mean session expired or invalid state
        if (!stateData) {
          return { success: false, error: 'Session expired. Please try connecting again.' };
        }
        return { success: false, error: 'Invalid state parameter' };
      }

      // Clean up state from session
      delete session.oauthStates[state];

      const tokenEndpoint = this.getTokenEndpoint(providerName);
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.redirectUri || '',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Token exchange failed: ${errorText}` };
      }

      const tokenData = await response.json();

      // Get additional provider-specific data (like tenant ID)
      const additionalData = await this.getAdditionalAuthData(providerName, tokenData.access_token);

      const tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        tenantId: additionalData?.tenantId, // Provider's tenant ID (e.g., Xero tenant ID)
        tenantName: additionalData?.tenantName, // Provider's tenant/org name (e.g., Xero organisation name)
        scope: tokenData.scope,
      };

      // Cache tokens with app tenant ID
      const cacheKey = `${providerName}:${stateData.tenantId || 'default'}`;
      this.tokenCache.set(cacheKey, tokens);

      // Return both app tenant ID and tokens (which contain provider tenant ID)
      return { 
        success: true, 
        tokens,
        appTenantId: stateData.tenantId // Our app's tenant ID
      };
    } catch (error) {
      console.error(`Token exchange failed for ${providerName}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Token exchange failed' };
    }
  }

  /**
   * Refresh access token with concurrent refresh protection.
   * Uses promise deduplication so only one refresh executes per connection.
   */
  async refreshAccessToken(
    providerName: string,
    refreshToken: string,
    config: ProviderConfig,
    tenantId?: string
  ): Promise<AuthResult> {
    const dedupeKey = `${providerName}:${tenantId || 'default'}`;

    // If a refresh is already in-flight for this connection, reuse it
    if (this.refreshPromises.has(dedupeKey)) {
      return this.refreshPromises.get(dedupeKey)!;
    }

    const promise = this._doRefresh(providerName, refreshToken, config, tenantId)
      .finally(() => this.refreshPromises.delete(dedupeKey));

    this.refreshPromises.set(dedupeKey, promise);
    return promise;
  }

  private async _doRefresh(
    providerName: string,
    refreshToken: string,
    config: ProviderConfig,
    tenantId?: string
  ): Promise<AuthResult> {
    try {
      const tokenEndpoint = this.getTokenEndpoint(providerName);
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Token refresh failed for ${providerName}:`, errorText);
        return { success: false, error: `Token refresh failed: ${response.status}` };
      }

      const tokenData = await response.json();

      const tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        tenantId,
        scope: tokenData.scope,
      };

      // Persist encrypted tokens to provider_connections before updating cache
      if (tenantId) {
        await this.persistTokensToDb(providerName, tenantId, tokens);
      }

      // Update cache only after DB write succeeds
      const cacheKey = `${providerName}:${tenantId || 'default'}`;
      this.tokenCache.set(cacheKey, tokens);

      return { success: true, tokens };
    } catch (error) {
      console.error(`Token refresh failed for ${providerName}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Token refresh failed' };
    }
  }

  /**
   * Persist refreshed tokens to provider_connections with retry.
   */
  private async persistTokensToDb(
    providerName: string,
    tenantId: string,
    tokens: { accessToken: string; refreshToken: string; expiresAt: Date }
  ): Promise<void> {
    const delays = [100, 500, 2000];

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const hasEncryptionKey = !!process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
        const accessTokenValue = hasEncryptionKey ? encryptToken(tokens.accessToken) : tokens.accessToken;
        const refreshTokenValue = hasEncryptionKey ? encryptToken(tokens.refreshToken) : tokens.refreshToken;

        await db.update(providerConnections)
          .set({
            accessToken: accessTokenValue,
            refreshToken: refreshTokenValue,
            tokenExpiresAt: tokens.expiresAt,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(providerConnections.tenantId, tenantId),
            eq(providerConnections.provider, providerName)
          ));

        return; // Success
      } catch (error) {
        if (attempt < delays.length) {
          console.warn(`[AuthManager] Token DB write retry ${attempt + 1} for ${providerName}:${tenantId.slice(-4)}`);
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        } else {
          console.error(`[CRITICAL] Failed to persist refreshed tokens to DB after ${delays.length + 1} attempts. ` +
            `Provider: ${providerName}, Tenant: ...${tenantId.slice(-4)}. ` +
            `In-memory cache has valid tokens but DB is stale — next restart will load stale tokens.`);
        }
      }
    }
  }

  /**
   * Get cached tokens — falls back to provider_connections DB if cache misses.
   */
  async getCachedTokens(providerName: string, tenantId?: string): Promise<any> {
    const cacheKey = `${providerName}:${tenantId || 'default'}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached) return cached;

    // DB fallback
    if (!tenantId) return undefined;

    try {
      const [conn] = await db.select()
        .from(providerConnections)
        .where(and(
          eq(providerConnections.tenantId, tenantId),
          eq(providerConnections.provider, providerName),
          eq(providerConnections.isConnected, true)
        ));

      if (!conn?.accessToken) return undefined;

      const hasEncryptionKey = !!process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
      let accessToken: string;
      let refreshToken: string | undefined;

      try {
        accessToken = hasEncryptionKey ? decryptToken(conn.accessToken) : conn.accessToken;
        refreshToken = conn.refreshToken
          ? (hasEncryptionKey ? decryptToken(conn.refreshToken) : conn.refreshToken)
          : undefined;
      } catch {
        // Token may be stored unencrypted (pre-migration) — use as-is
        accessToken = conn.accessToken;
        refreshToken = conn.refreshToken || undefined;
      }

      const tokens = {
        accessToken,
        refreshToken,
        expiresAt: conn.tokenExpiresAt || undefined,
        tenantId: conn.providerId || undefined,
      };

      // Populate cache for next time
      this.tokenCache.set(cacheKey, tokens);
      return tokens;
    } catch (error) {
      console.error(`[AuthManager] DB token lookup failed for ${providerName}:`, error);
      return undefined;
    }
  }

  /**
   * Set cached tokens
   */
  setCachedTokens(providerName: string, tokens: any, tenantId?: string): void {
    const cacheKey = `${providerName}:${tenantId || 'default'}`;
    this.tokenCache.set(cacheKey, tokens);
  }

  /**
   * Check if tokens are expired
   */
  areTokensExpired(tokens: { expiresAt?: Date }): boolean {
    if (!tokens.expiresAt) return false; // No expiry means non-expiring token
    return new Date() >= tokens.expiresAt;
  }

  /**
   * Clear cached tokens
   */
  clearTokens(providerName?: string, tenantId?: string): void {
    if (providerName) {
      const cacheKey = `${providerName}:${tenantId || 'default'}`;
      this.tokenCache.delete(cacheKey);
    } else {
      this.tokenCache.clear();
    }
  }

  /**
   * Get provider-specific auth endpoint
   */
  private getAuthEndpoint(providerName: string): string {
    const endpoints: Record<string, string> = {
      xero: 'https://login.xero.com/identity/connect/authorize',
      quickbooks: 'https://appcenter.intuit.com/connect/oauth2',
      sage: 'https://www.sageone.com/oauth2/auth',
      freshbooks: 'https://my.freshbooks.com/service/auth/oauth/authorize',
      wave: 'https://api.waveapps.com/oauth2/authorize/',
      zoho: 'https://accounts.zoho.com/oauth/v2/auth',
    };

    return endpoints[providerName.toLowerCase()] || '';
  }

  /**
   * Get provider-specific token endpoint
   */
  private getTokenEndpoint(providerName: string): string {
    const endpoints: Record<string, string> = {
      xero: 'https://identity.xero.com/connect/token',
      quickbooks: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      sage: 'https://oauth.sageone.com/token',
      freshbooks: 'https://api.freshbooks.com/auth/oauth/token',
      wave: 'https://api.waveapps.com/oauth2/token/',
      zoho: 'https://accounts.zoho.com/oauth/v2/token',
    };

    return endpoints[providerName.toLowerCase()] || '';
  }

  /**
   * Get additional provider-specific authentication data
   */
  private async getAdditionalAuthData(providerName: string, accessToken: string): Promise<any> {
    try {
      switch (providerName.toLowerCase()) {
        case 'xero':
          // Get Xero tenant connections
          const xeroResponse = await fetch('https://api.xero.com/connections', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (xeroResponse.ok) {
            const connections = await xeroResponse.json();
            return { 
              tenantId: connections[0]?.tenantId,
              tenantName: connections[0]?.tenantName 
            };
          }
          break;

        case 'quickbooks':
          // QuickBooks includes company ID in initial token response
          // This would be handled in the token exchange step
          break;

        default:
          return {};
      }
    } catch (error) {
      console.warn(`Failed to get additional auth data for ${providerName}:`, error);
    }
    return {};
  }
}