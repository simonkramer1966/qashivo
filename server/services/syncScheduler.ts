import { XeroSyncService } from './xeroSync';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Sync Scheduler for Automatic Background Sync Operations
 *
 * Primary sync path: Xero webhooks (near real-time, handled in server/index.ts)
 * Safety net: XeroSyncService polling (every 15 min, catches anything webhooks miss)
 *
 * The old SyncService/apiMiddleware hourly loop was removed — it used a broken
 * provider registration path that generated "Provider not found" errors silently.
 */
class SyncScheduler {
  private xeroIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private xeroSyncService: XeroSyncService;

  constructor() {
    this.xeroSyncService = new XeroSyncService();
  }

  /**
   * Start the sync scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('📅 Sync scheduler is already running');
      return;
    }

    console.log('📅 Starting sync scheduler...');

    // Start Xero background sync (every 15 minutes as safety net behind webhooks)
    console.log('Starting Xero background sync scheduler...');
    this.runXeroSyncs().catch(err => console.error('[syncScheduler] initial Xero sync error:', err));

    this.xeroIntervalId = setInterval(() => {
      this.runXeroSyncs().catch(err => console.error('[syncScheduler] Xero sync error:', err));
    }, 15 * 60 * 1000); // 15 minutes

    this.isRunning = true;
    console.log('✅ Sync scheduler started - Xero syncs every 15 minutes (webhooks provide real-time updates)');
  }

  /**
   * Stop the sync scheduler
   */
  stop(): void {
    if (this.xeroIntervalId) {
      clearInterval(this.xeroIntervalId);
      this.xeroIntervalId = null;
    }

    this.isRunning = false;
    console.log('⏹️ Sync scheduler stopped');
  }

  /**
   * Execute Xero background syncs for all tenants with auto-sync enabled
   */
  private async runXeroSyncs(): Promise<void> {
    try {
      console.log('🔄 Running Xero background syncs...');
      
      // Get all tenants with Xero connected and auto-sync enabled
      const tenantsToSync = await db
        .select()
        .from(tenants)
        .where(eq(tenants.xeroAutoSync, true));

      console.log(`Found ${tenantsToSync.length} tenants with Xero auto-sync enabled`);

      for (const tenant of tenantsToSync) {
        if (!tenant.xeroAccessToken || !tenant.xeroRefreshToken || !tenant.xeroTenantId) {
          console.log(`Skipping tenant ${tenant.name} - incomplete Xero credentials`);
          continue;
        }

        // Check if sync interval has passed
        const syncInterval = tenant.xeroSyncInterval || 15; // Default 15 minutes
        const lastSync = tenant.xeroLastSyncAt;
        
        if (lastSync) {
          const minutesSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60);
          if (minutesSinceLastSync < syncInterval) {
            console.log(`⏭️ Skipping tenant ${tenant.name} - synced ${Math.round(minutesSinceLastSync)} minutes ago`);
            continue;
          }
        }

        console.log(`🚀 Starting background sync for tenant: ${tenant.name}`);
        
        try {
          const result = await this.xeroSyncService.syncAllDataForTenant(tenant.id, 'ongoing');
          if (result.success) {
            console.log(`✅ Background sync completed for ${tenant.name}:`, {
              contacts: result.contactsCount,
              invoices: result.invoicesCount,
              bills: result.billsCount,
              bankAccounts: result.bankAccountsCount,
              bankTransactions: result.bankTransactionsCount
            });
          } else {
            console.error(`❌ Background sync failed for ${tenant.name}:`, result.error);
          }
        } catch (error) {
          console.error(`❌ Background sync error for ${tenant.name}:`, error);
        }
      }

      console.log('✅ Xero background syncs completed');
    } catch (error) {
      console.error('❌ Xero background syncs failed:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; nextRun?: Date } {
    return {
      isRunning: this.isRunning,
      nextRun: this.isRunning ? new Date(Date.now() + 60 * 60 * 1000) : undefined
    };
  }
}

// Export singleton instance (started from server/startup/orchestrator.ts)
export const syncScheduler = new SyncScheduler();