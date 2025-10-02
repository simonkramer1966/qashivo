import { syncService } from './syncService';
import { XeroSyncService } from './xeroSync';
import { db } from '../db';
import { tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Sync Scheduler for Automatic Background Sync Operations
 * Handles periodic sync scheduling and execution
 */
class SyncScheduler {
  private intervalId: NodeJS.Timeout | null = null;
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
    
    // Run API middleware syncs immediately
    this.runScheduledSyncs();
    
    // Schedule API middleware syncs to run every hour
    this.intervalId = setInterval(() => {
      this.runScheduledSyncs();
    }, 60 * 60 * 1000); // 1 hour

    // Start Xero background sync (every 4 hours)
    console.log('🔄 Starting Xero background sync scheduler...');
    this.runXeroSyncs(); // Run immediately
    
    this.xeroIntervalId = setInterval(() => {
      this.runXeroSyncs();
    }, 4 * 60 * 60 * 1000); // 4 hours

    this.isRunning = true;
    console.log('✅ Sync scheduler started - API syncs every hour, Xero syncs every 4 hours');
  }

  /**
   * Stop the sync scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.xeroIntervalId) {
      clearInterval(this.xeroIntervalId);
      this.xeroIntervalId = null;
    }
    
    this.isRunning = false;
    console.log('⏹️ Sync scheduler stopped');
  }

  /**
   * Execute scheduled syncs for all tenants
   */
  private async runScheduledSyncs(): Promise<void> {
    try {
      console.log('📅 Running scheduled syncs...');
      await syncService.scheduleAutomaticSyncs();
      console.log('✅ Scheduled syncs completed');
    } catch (error) {
      console.error('❌ Scheduled syncs failed:', error);
    }
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
        if (!tenant.xeroAccessToken) {
          console.log(`⏭️ Skipping tenant ${tenant.name} - no Xero connection`);
          continue;
        }

        // Check if sync interval has passed
        const syncInterval = tenant.xeroSyncInterval || 240; // Default 4 hours in minutes
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
          const result = await this.xeroSyncService.syncAllDataForTenant(tenant.id);
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

// Export singleton instance
export const syncScheduler = new SyncScheduler();

// Auto-start scheduler in production
if (process.env.NODE_ENV === 'production') {
  syncScheduler.start();
}