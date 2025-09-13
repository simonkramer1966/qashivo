import { syncService } from './syncService';

/**
 * Sync Scheduler for Automatic Background Sync Operations
 * Handles periodic sync scheduling and execution
 */
class SyncScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the sync scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('📅 Sync scheduler is already running');
      return;
    }

    console.log('📅 Starting sync scheduler...');
    
    // Run immediately
    this.runScheduledSyncs();
    
    // Schedule to run every hour
    this.intervalId = setInterval(() => {
      this.runScheduledSyncs();
    }, 60 * 60 * 1000); // 1 hour

    this.isRunning = true;
    console.log('✅ Sync scheduler started - will run every hour');
  }

  /**
   * Stop the sync scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
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