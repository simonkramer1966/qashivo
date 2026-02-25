import cron from 'node-cron';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq, isNotNull, and } from 'drizzle-orm';

export class XeroHealthCheckService {
  private isRunning = false;

  async start(): Promise<void> {
    console.log('🏥 Starting Xero health check service (every 20 minutes)...');
    
    // Run immediately on startup
    await this.runHealthChecks();
    
    // Schedule to run every 20 minutes
    cron.schedule('*/20 * * * *', async () => {
      await this.runHealthChecks();
    });
    
    console.log('✅ Xero health check service started');
  }

  async runHealthChecks(): Promise<void> {
    if (this.isRunning) {
      console.log('⏭️ Health check already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🏥 Running Xero connection health checks...');

    try {
      // Get all tenants with Xero refresh tokens
      const tenantsWithXero = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          xeroAccessToken: tenants.xeroAccessToken,
          xeroRefreshToken: tenants.xeroRefreshToken,
          xeroTenantId: tenants.xeroTenantId,
          xeroExpiresAt: tenants.xeroExpiresAt,
          xeroConnectionStatus: tenants.xeroConnectionStatus,
        })
        .from(tenants)
        .where(isNotNull(tenants.xeroRefreshToken));

      console.log(`🔍 Checking ${tenantsWithXero.length} tenants with Xero connections`);

      for (const tenant of tenantsWithXero) {
        await this.checkTenantConnection(tenant);
      }

      console.log('✅ Xero health checks completed');
    } catch (error) {
      console.error('❌ Error during Xero health checks:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async checkTenantConnection(tenant: {
    id: string;
    name: string;
    xeroAccessToken: string | null;
    xeroRefreshToken: string | null;
    xeroTenantId: string | null;
    xeroExpiresAt: Date | null;
    xeroConnectionStatus?: string | null;
  }): Promise<void> {
    console.log(`🏥 Checking Xero connection for tenant: ${tenant.name}`);

    try {
      // Import xeroService dynamically to avoid circular deps
      const { xeroService } = await import('./xero');

      // Check if we have required tokens
      if (!tenant.xeroRefreshToken || !tenant.xeroTenantId) {
        await this.updateConnectionStatus(tenant.id, 'disconnected', 'Missing Xero credentials');
        return;
      }

      // Try to refresh the token (this will validate the connection)
      const refreshedTokens = await xeroService.refreshAccessToken(
        tenant.xeroRefreshToken,
        tenant.xeroTenantId
      );

      if (!refreshedTokens) {
        await this.updateConnectionStatus(tenant.id, 'disconnected', 'Token refresh failed - please reconnect');
        console.log(`❌ Xero connection FAILED for tenant: ${tenant.name}`);
        return;
      }

      // Token refresh succeeded - try a lightweight API call to verify and get org info
      const orgInfo = await this.getOrganisationInfo(refreshedTokens.accessToken, refreshedTokens.tenantId);
      
      if (orgInfo.isConnected) {
        const wasDisconnected = tenant.xeroConnectionStatus !== 'connected';

        // Update health check status and organisation name if available
        await db
          .update(tenants)
          .set({
            xeroConnectionStatus: 'connected',
            xeroLastHealthCheck: new Date(),
            xeroHealthCheckError: null,
            ...(orgInfo.organisationName && { xeroOrganisationName: orgInfo.organisationName }),
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenant.id));

        console.log(`✅ Xero connection HEALTHY for tenant: ${tenant.name}${orgInfo.organisationName ? ` (${orgInfo.organisationName})` : ''}`);

        // If this is a recovery (was disconnected → now connected), trigger a background sync
        if (wasDisconnected) {
          console.log(`🔄 Triggering recovery sync for tenant: ${tenant.name} (was disconnected)`);
          const { XeroSyncService } = await import('./xeroSync');
          const syncService = new XeroSyncService();
          syncService.syncAllDataForTenant(tenant.id)
            .then(async (result) => {
              if (result.success) {
                console.log(`✅ Recovery sync completed for ${tenant.name}`);
                try {
                  const { enqueueDebtorScoringAfterSync } = await import('../jobs/debtorScoringJob');
                  await enqueueDebtorScoringAfterSync(tenant.id);
                } catch (err) {
                  console.error(`[HealthCheck] Failed to enqueue scoring after recovery sync:`, err);
                }
              } else {
                console.error(`❌ Recovery sync failed for ${tenant.name}:`, result.error);
              }
            })
            .catch(err => console.error(`❌ Recovery sync error for ${tenant.name}:`, err));
        }
      } else {
        await this.updateConnectionStatus(tenant.id, 'error', 'API verification failed');
        console.log(`⚠️ Xero connection ERROR for tenant: ${tenant.name} (API call failed)`);
      }
    } catch (error) {
      // Sanitize error message to avoid exposing sensitive OAuth details
      const rawError = error instanceof Error ? error.message : 'Unknown error';
      const sanitizedError = this.sanitizeErrorMessage(rawError);
      await this.updateConnectionStatus(tenant.id, 'disconnected', sanitizedError);
      console.log(`❌ Xero connection FAILED for tenant: ${tenant.name} - ${sanitizedError}`);
    }
  }

  private sanitizeErrorMessage(error: string): string {
    // Remove sensitive OAuth/token details and truncate to reasonable length
    const sensitivePatterns = [
      /access_token[=:][^\s&]+/gi,
      /refresh_token[=:][^\s&]+/gi,
      /client_secret[=:][^\s&]+/gi,
      /Bearer [^\s]+/gi,
    ];
    
    let sanitized = error;
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    // Map common errors to user-friendly messages
    if (sanitized.includes('400') || sanitized.includes('invalid_grant')) {
      return 'Authorization expired - please reconnect';
    }
    if (sanitized.includes('401') || sanitized.includes('unauthorized')) {
      return 'Authentication failed - please reconnect';
    }
    if (sanitized.includes('403')) {
      return 'Access denied - please reconnect and grant permissions';
    }
    
    // Truncate if still too long
    return sanitized.length > 100 ? sanitized.substring(0, 100) + '...' : sanitized;
  }

  private async getOrganisationInfo(accessToken: string, tenantId: string): Promise<{
    isConnected: boolean;
    organisationName?: string;
  }> {
    try {
      // Lightweight API call - get organisation info
      const response = await fetch('https://api.xero.com/api.xro/2.0/Organisation', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return { isConnected: false };
      }

      // Try to extract organisation name from response
      try {
        const data = await response.json();
        const orgName = data?.Organisations?.[0]?.Name;
        return { 
          isConnected: true,
          organisationName: orgName || undefined
        };
      } catch {
        return { isConnected: true };
      }
    } catch (error) {
      console.error('Error testing Xero API:', error);
      return { isConnected: false };
    }
  }

  private async updateConnectionStatus(
    tenantId: string,
    status: 'connected' | 'disconnected' | 'error',
    errorMessage?: string
  ): Promise<void> {
    await db
      .update(tenants)
      .set({
        xeroConnectionStatus: status,
        xeroLastHealthCheck: new Date(),
        xeroHealthCheckError: errorMessage || null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));
  }

  // Check a single tenant's connection on demand
  async checkSingleTenant(tenantId: string): Promise<{
    status: 'connected' | 'disconnected' | 'error';
    error?: string;
  }> {
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        xeroAccessToken: tenants.xeroAccessToken,
        xeroRefreshToken: tenants.xeroRefreshToken,
        xeroTenantId: tenants.xeroTenantId,
        xeroExpiresAt: tenants.xeroExpiresAt,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (!tenant) {
      return { status: 'error', error: 'Tenant not found' };
    }

    await this.checkTenantConnection(tenant);

    // Fetch updated status
    const [updated] = await db
      .select({
        xeroConnectionStatus: tenants.xeroConnectionStatus,
        xeroHealthCheckError: tenants.xeroHealthCheckError,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    return {
      status: (updated?.xeroConnectionStatus as 'connected' | 'disconnected' | 'error') || 'error',
      error: updated?.xeroHealthCheckError || undefined,
    };
  }
}

// Singleton instance
export const xeroHealthCheckService = new XeroHealthCheckService();
