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
  }): Promise<void> {
    console.log(`🏥 Checking Xero connection for tenant: ${tenant.name}`);

    try {
      // Import XeroService dynamically to avoid circular deps
      const { XeroService } = await import('./xero');
      const xeroService = new XeroService();

      // Check if we have required tokens
      if (!tenant.xeroRefreshToken || !tenant.xeroTenantId) {
        await this.updateConnectionStatus(tenant.id, 'disconnected', 'Missing refresh token or tenant ID');
        return;
      }

      // Try to refresh the token (this will validate the connection)
      const refreshedTokens = await xeroService.refreshAccessToken(
        tenant.xeroRefreshToken,
        tenant.xeroTenantId
      );

      if (!refreshedTokens) {
        await this.updateConnectionStatus(tenant.id, 'disconnected', 'Token refresh failed');
        console.log(`❌ Xero connection FAILED for tenant: ${tenant.name}`);
        return;
      }

      // Token refresh succeeded - try a lightweight API call to verify
      const orgInfo = await this.testApiCall(refreshedTokens.accessToken, refreshedTokens.tenantId);
      
      if (orgInfo) {
        // Update tokens and mark as connected
        await db
          .update(tenants)
          .set({
            xeroAccessToken: refreshedTokens.accessToken,
            xeroRefreshToken: refreshedTokens.refreshToken,
            xeroExpiresAt: refreshedTokens.expiresAt,
            xeroConnectionStatus: 'connected',
            xeroLastHealthCheck: new Date(),
            xeroHealthCheckError: null,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenant.id));

        console.log(`✅ Xero connection HEALTHY for tenant: ${tenant.name}`);
      } else {
        await this.updateConnectionStatus(tenant.id, 'error', 'API call failed after token refresh');
        console.log(`⚠️ Xero connection ERROR for tenant: ${tenant.name} (API call failed)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateConnectionStatus(tenant.id, 'disconnected', errorMessage);
      console.log(`❌ Xero connection FAILED for tenant: ${tenant.name} - ${errorMessage}`);
    }
  }

  private async testApiCall(accessToken: string, tenantId: string): Promise<boolean> {
    try {
      // Lightweight API call - just get organisation info
      const response = await fetch('https://api.xero.com/api.xro/2.0/Organisation', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Xero-tenant-id': tenantId,
          'Accept': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Error testing Xero API:', error);
      return false;
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
