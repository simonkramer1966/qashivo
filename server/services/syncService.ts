import { db } from "../db";
import { 
  syncState, 
  providerConnections, 
  contacts, 
  invoices, 
  bills, 
  billPayments, 
  bankAccounts, 
  bankTransactions, 
  budgets, 
  exchangeRates,
  tenants
} from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { APIMiddleware } from "../middleware/APIMiddleware";
import { jobQueue } from "./jobQueue";
import { createDataTypeHandler, type DataTypeHandler } from "./dataTypeHandlers";

/**
 * Comprehensive Sync Service
 * Orchestrates all accounting data synchronization across multiple providers
 */
export class SyncService {
  private apiMiddleware: APIMiddleware;
  
  constructor() {
    this.apiMiddleware = new APIMiddleware();
    this.setupJobHandlers();
  }

  /**
   * Initialize job queue handlers for sync operations
   */
  private setupJobHandlers(): void {
    jobQueue.addHandler('sync-full', this.handleFullSyncJob.bind(this));
    jobQueue.addHandler('sync-incremental', this.handleIncrementalSyncJob.bind(this));
    jobQueue.addHandler('sync-webhook', this.handleWebhookSyncJob.bind(this));
    
    console.log('✅ Sync service job handlers registered');
  }

  /**
   * Trigger a full sync (24-month backfill) for a tenant and provider
   */
  async triggerFullSync(tenantId: string, provider: string): Promise<{
    success: boolean;
    jobId?: string;
    error?: string;
  }> {
    try {
      // Verify provider connection exists and is active
      const [connection] = await db
        .select()
        .from(providerConnections)
        .where(and(
          eq(providerConnections.tenantId, tenantId),
          eq(providerConnections.provider, provider),
          eq(providerConnections.isActive, true),
          eq(providerConnections.isConnected, true)
        ));

      if (!connection) {
        return {
          success: false,
          error: `No active ${provider} connection found for tenant ${tenantId}`
        };
      }

      // Check if full sync is already in progress
      const inProgressSync = await this.getSyncState(tenantId, provider, 'full_sync');
      if (inProgressSync && inProgressSync.syncStatus === 'running') {
        return {
          success: false,
          error: `Full sync for ${provider} is already in progress`
        };
      }

      // Queue full sync job with high priority
      const jobId = jobQueue.enqueue('sync-full', {
        tenantId,
        provider,
        backfillMonths: 24,
        priority: 'high'
      }, 3); // Max 3 retries for full sync

      console.log(`📋 Full sync job queued for tenant ${tenantId}, provider ${provider}: ${jobId}`);

      return {
        success: true,
        jobId
      };

    } catch (error) {
      console.error(`Failed to trigger full sync for ${provider}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Trigger an incremental sync for a tenant and provider
   */
  async triggerIncrementalSync(tenantId: string, provider: string, force = false): Promise<{
    success: boolean;
    jobId?: string;
    error?: string;
  }> {
    try {
      // Verify provider connection
      const [connection] = await db
        .select()
        .from(providerConnections)
        .where(and(
          eq(providerConnections.tenantId, tenantId),
          eq(providerConnections.provider, provider),
          eq(providerConnections.isActive, true),
          eq(providerConnections.isConnected, true)
        ));

      if (!connection) {
        return {
          success: false,
          error: `No active ${provider} connection found for tenant ${tenantId}`
        };
      }

      // Check sync frequency unless forced
      if (!force && connection.syncFrequency !== 'manual') {
        const lastSync = await this.getLastSuccessfulSync(tenantId, provider);
        const now = new Date();
        const timeSinceLastSync = lastSync ? now.getTime() - lastSync.getTime() : Infinity;
        
        // Check if enough time has passed based on sync frequency
        const frequencyMs = this.getSyncFrequencyMs(connection.syncFrequency);
        if (timeSinceLastSync < frequencyMs) {
          return {
            success: false,
            error: `Incremental sync too frequent. Last sync: ${lastSync?.toISOString()}`
          };
        }
      }

      // Queue incremental sync job
      const jobId = jobQueue.enqueue('sync-incremental', {
        tenantId,
        provider,
        force
      }, 2); // Max 2 retries for incremental sync

      console.log(`📋 Incremental sync job queued for tenant ${tenantId}, provider ${provider}: ${jobId}`);

      return {
        success: true,
        jobId
      };

    } catch (error) {
      console.error(`Failed to trigger incremental sync for ${provider}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get sync status for a tenant and provider
   */
  async getSyncStatus(tenantId: string, provider: string): Promise<{
    overall: {
      lastSync?: Date;
      lastSuccessfulSync?: Date;
      status: string;
      error?: string;
    };
    byResource: Array<{
      resource: string;
      lastSync?: Date;
      lastSuccessfulSync?: Date;
      status: string;
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
      error?: string;
    }>;
  }> {
    try {
      // Get all sync states for this tenant and provider
      const states = await db
        .select()
        .from(syncState)
        .where(and(
          eq(syncState.tenantId, tenantId),
          eq(syncState.provider, provider)
        ))
        .orderBy(desc(syncState.updatedAt));

      if (states.length === 0) {
        return {
          overall: {
            status: 'never_synced'
          },
          byResource: []
        };
      }

      // Calculate overall status
      const lastSync = states.reduce((latest, state) => {
        const stateDate = state.lastSyncAt || state.updatedAt;
        return !latest || stateDate > latest ? stateDate : latest;
      }, null as Date | null);

      const lastSuccessfulSync = states.reduce((latest, state) => {
        const stateDate = state.lastSuccessfulSyncAt;
        return !latest || (stateDate && stateDate > latest) ? stateDate : latest;
      }, null as Date | null);

      const hasRunning = states.some(s => s.syncStatus === 'running');
      const hasError = states.some(s => s.syncStatus === 'error');
      const overallStatus = hasRunning ? 'running' : hasError ? 'error' : 'success';

      const overallError = states.find(s => s.syncStatus === 'error')?.errorMessage;

      return {
        overall: {
          lastSync: lastSync || undefined,
          lastSuccessfulSync: lastSuccessfulSync || undefined,
          status: overallStatus,
          error: overallError || undefined
        },
        byResource: states.map(state => ({
          resource: state.resource,
          lastSync: state.lastSyncAt || undefined,
          lastSuccessfulSync: state.lastSuccessfulSyncAt || undefined,
          status: state.syncStatus,
          recordsProcessed: state.recordsProcessed || 0,
          recordsCreated: state.recordsCreated || 0,
          recordsUpdated: state.recordsUpdated || 0,
          recordsFailed: state.recordsFailed || 0,
          error: state.errorMessage || undefined
        }))
      };

    } catch (error) {
      console.error(`Failed to get sync status for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Handle full sync job execution
   */
  private async handleFullSyncJob(job: any): Promise<void> {
    const { tenantId, provider, backfillMonths = 24 } = job.data;
    
    console.log(`🔄 Starting full sync for tenant ${tenantId}, provider ${provider} (${backfillMonths} months)`);

    try {
      // Define all resource types to sync
      const resourceTypes = [
        'contacts',
        'invoices', 
        'bills',
        'payments',
        'bill-payments',
        'bank-accounts',
        'bank-transactions',
        'budgets',
        'exchange-rates'
      ];

      // Sync each resource type with monthly time windows
      for (const resource of resourceTypes) {
        try {
          await this.syncResourceWithTimeWindows(tenantId, provider, resource, backfillMonths);
        } catch (resourceError) {
          console.error(`❌ Failed to sync ${resource} for ${provider}:`, resourceError);
          // Continue with other resources even if one fails
        }
      }

      console.log(`✅ Full sync completed for tenant ${tenantId}, provider ${provider}`);

    } catch (error) {
      console.error(`❌ Full sync failed for tenant ${tenantId}, provider ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Sync resource with monthly time windows for full sync backfill
   */
  private async syncResourceWithTimeWindows(
    tenantId: string,
    provider: string,
    resource: string,
    backfillMonths: number
  ): Promise<void> {
    console.log(`🗓️ Starting time-windowed sync for ${resource} (${backfillMonths} months)`);
    
    // Check if we've already completed a full sync for this resource
    const existingState = await this.getSyncState(tenantId, provider, resource);
    if (existingState && existingState.lastSuccessfulSyncAt && existingState.syncStatus === 'success') {
      console.log(`⏭️ Skipping ${resource} - already fully synced`);
      return;
    }

    // Generate monthly time windows
    const timeWindows = this.generateMonthlyTimeWindows(backfillMonths);
    
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    // Initialize sync state for this resource
    await this.updateSyncState(tenantId, provider, resource, {
      syncStatus: 'running',
      lastSyncAt: new Date(),
      errorMessage: null,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0
    });

    // Process each time window
    for (let i = 0; i < timeWindows.length; i++) {
      const { startDate, endDate } = timeWindows[i];
      
      console.log(`📅 Processing window ${i + 1}/${timeWindows.length}: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      try {
        // Sync this specific time window
        const windowResult = await this.syncResourceTimeWindow(
          tenantId,
          provider,
          resource,
          startDate,
          endDate
        );

        totalProcessed += windowResult.processed;
        totalCreated += windowResult.created;
        totalUpdated += windowResult.updated;
        totalFailed += windowResult.failed;

        // Update progress in sync state after each window
        await this.updateSyncState(tenantId, provider, resource, {
          recordsProcessed: totalProcessed,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          recordsFailed: totalFailed,
          syncCursor: `window_${i + 1}_of_${timeWindows.length}`,
          lastSyncAt: new Date()
        });

        console.log(`✅ Window ${i + 1} completed: ${windowResult.processed} processed`);

      } catch (windowError) {
        console.error(`❌ Failed to sync window ${i + 1}:`, windowError);
        totalFailed += 1;
        
        // Update sync state with error but continue
        await this.updateSyncState(tenantId, provider, resource, {
          recordsProcessed: totalProcessed,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          recordsFailed: totalFailed,
          syncCursor: `window_${i + 1}_failed`,
          errorMessage: `Failed window ${i + 1}: ${windowError instanceof Error ? windowError.message : 'Unknown error'}`
        });

        // Continue with next window
      }

      // Add small delay between windows to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Mark sync as complete
    await this.updateSyncState(tenantId, provider, resource, {
      syncStatus: 'success',
      lastSuccessfulSyncAt: new Date(),
      syncCursor: null, // Reset cursor after full sync
      recordsProcessed: totalProcessed,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      recordsFailed: totalFailed
    });

    console.log(`✅ Time-windowed sync completed for ${resource}: ${totalProcessed} total processed`);
  }

  /**
   * Generate monthly time windows for backfill
   */
  private generateMonthlyTimeWindows(backfillMonths: number): Array<{ startDate: Date; endDate: Date }> {
    const windows = [];
    const now = new Date();
    
    // Start from oldest month and work forward
    for (let i = backfillMonths - 1; i >= 0; i--) {
      const windowStart = new Date();
      windowStart.setMonth(now.getMonth() - i);
      windowStart.setDate(1);
      windowStart.setHours(0, 0, 0, 0);

      const windowEnd = new Date(windowStart);
      windowEnd.setMonth(windowStart.getMonth() + 1);
      windowEnd.setDate(0); // Last day of month
      windowEnd.setHours(23, 59, 59, 999);

      // Don't go beyond current date
      if (windowEnd > now) {
        windowEnd.setTime(now.getTime());
      }

      windows.push({
        startDate: windowStart,
        endDate: windowEnd
      });
    }

    return windows;
  }

  /**
   * Sync resource for specific time window
   */
  private async syncResourceTimeWindow(
    tenantId: string,
    provider: string,
    resource: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ processed: number; created: number; updated: number; failed: number }> {
    
    // Get provider instance
    const providerInstance = this.apiMiddleware.getProvider(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not found or not registered`);
    }

    // Build request options for this time window
    const requestOptions: any = {
      params: {
        tenantId,
        filters: {
          modifiedSince: startDate.toISOString(),
          modifiedBefore: endDate.toISOString() // Some providers support upper bound
        }
      }
    };

    let allResults = [];
    let page = 1;
    const maxPages = 100; // Prevent infinite loops

    // Handle pagination within the time window
    do {
      try {
        requestOptions.params.page = page;
        
        const response = await providerInstance.makeRequest(resource, requestOptions);

        if (!response.success) {
          throw new Error(response.error || `Failed to fetch ${resource} from ${provider}`);
        }

        const data = response.data || [];
        allResults = allResults.concat(data);

        // Check if we have more pages
        if (!response.hasMore || data.length === 0 || page >= maxPages) {
          break;
        }

        page++;

        // Small delay between page requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Failed to fetch page ${page} of ${resource} for time window:`, error);
        throw error;
      }

    } while (page <= maxPages);

    // Process all results from this time window
    return await this.processResourceData(tenantId, provider, resource, allResults);
  }

  /**
   * Handle incremental sync job execution
   */
  private async handleIncrementalSyncJob(job: any): Promise<void> {
    const { tenantId, provider, force = false } = job.data;
    
    console.log(`🔄 Starting incremental sync for tenant ${tenantId}, provider ${provider}`);

    try {
      // Define resource types for incremental sync (excluding less frequently changing data)
      const resourceTypes = [
        'contacts',
        'invoices',
        'bills', 
        'payments',
        'bill-payments',
        'bank-transactions'
      ];

      // Sync each resource type incrementally with cursor support
      for (const resource of resourceTypes) {
        try {
          await this.syncResourceIncremental(tenantId, provider, resource, force);
        } catch (resourceError) {
          console.error(`❌ Failed to incrementally sync ${resource} for ${provider}:`, resourceError);
          // Continue with other resources even if one fails
        }
      }

      console.log(`✅ Incremental sync completed for tenant ${tenantId}, provider ${provider}`);

    } catch (error) {
      console.error(`❌ Incremental sync failed for tenant ${tenantId}, provider ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Sync resource incrementally with cursor-based pagination
   */
  private async syncResourceIncremental(
    tenantId: string,
    provider: string,
    resource: string,
    force: boolean
  ): Promise<void> {
    console.log(`🔄 Starting incremental sync for ${resource} (force: ${force})`);

    // Get existing sync state to determine where to start
    const syncState = await this.getSyncState(tenantId, provider, resource);
    
    // Determine modifiedSince parameter
    let modifiedSince: Date;
    let syncCursor: string | null = null;

    if (force || !syncState || !syncState.lastSuccessfulSyncAt) {
      // If forcing or no previous sync, start from 7 days ago for incremental
      modifiedSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else {
      // Use last successful sync time with some buffer (5 minutes overlap)
      modifiedSince = new Date(syncState.lastSuccessfulSyncAt.getTime() - 5 * 60 * 1000);
      syncCursor = syncState.syncCursor;
    }

    console.log(`🔄 Incremental sync for ${resource} starting from: ${modifiedSince.toISOString()}`);

    // Initialize sync tracking
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    // Update sync state to running
    await this.updateSyncState(tenantId, provider, resource, {
      syncStatus: 'running',
      lastSyncAt: new Date(),
      errorMessage: null
    });

    try {
      // Get provider instance
      const providerInstance = this.apiMiddleware.getProvider(provider);
      if (!providerInstance) {
        throw new Error(`Provider ${provider} not found or not registered`);
      }

      let hasMore = true;
      let currentCursor = syncCursor;
      let page = 1;
      const maxPages = 500; // Prevent infinite loops in incremental sync

      while (hasMore && page <= maxPages) {
        // Build request options with cursor and filters
        const requestOptions: any = {
          params: {
            tenantId,
            page,
            filters: {
              modifiedSince: modifiedSince.toISOString()
            }
          }
        };

        // Add cursor for pagination if available
        if (currentCursor) {
          requestOptions.params.cursor = currentCursor;
          requestOptions.params.filters.cursor = currentCursor;
        }

        console.log(`📄 Fetching page ${page} for ${resource}${currentCursor ? ` (cursor: ${currentCursor.substring(0, 20)}...)` : ''}`);

        // Make API request
        const response = await providerInstance.makeRequest(resource, requestOptions);

        if (!response.success) {
          throw new Error(response.error || `Failed to fetch ${resource} from ${provider}`);
        }

        const data = response.data || [];
        
        if (data.length === 0) {
          console.log(`📄 No more data for ${resource} at page ${page}`);
          break;
        }

        // Process this batch of data
        const batchResult = await this.processResourceData(tenantId, provider, resource, data);
        
        totalProcessed += batchResult.processed;
        totalCreated += batchResult.created;
        totalUpdated += batchResult.updated;
        totalFailed += batchResult.failed;

        console.log(`📄 Processed page ${page}: ${batchResult.processed} records`);

        // Update sync progress after each batch
        await this.updateSyncState(tenantId, provider, resource, {
          recordsProcessed: totalProcessed,
          recordsCreated: totalCreated,
          recordsUpdated: totalUpdated,
          recordsFailed: totalFailed,
          syncCursor: response.cursor || currentCursor,
          lastSyncAt: new Date()
        });

        // Check for more data
        hasMore = response.hasMore && data.length > 0;
        currentCursor = response.cursor || null;

        if (!hasMore) {
          console.log(`📄 Completed incremental sync for ${resource} - no more pages`);
          break;
        }

        page++;

        // Rate limiting - small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (page > maxPages) {
        console.warn(`⚠️ Incremental sync for ${resource} stopped at max pages (${maxPages})`);
      }

      // Mark incremental sync as successful
      await this.updateSyncState(tenantId, provider, resource, {
        syncStatus: 'success',
        lastSuccessfulSyncAt: new Date(),
        syncCursor: currentCursor,
        recordsProcessed: totalProcessed,
        recordsCreated: totalCreated,
        recordsUpdated: totalUpdated,
        recordsFailed: totalFailed,
        errorMessage: null
      });

      console.log(`✅ Incremental sync completed for ${resource}: ${totalProcessed} processed (${totalCreated} new, ${totalUpdated} updated)`);

    } catch (error) {
      console.error(`❌ Incremental sync failed for ${resource}:`, error);

      // Update sync state with error
      await this.updateSyncState(tenantId, provider, resource, {
        syncStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        recordsProcessed: totalProcessed,
        recordsCreated: totalCreated,
        recordsUpdated: totalUpdated,
        recordsFailed: totalFailed
      });

      throw error;
    }
  }

  /**
   * Handle webhook-triggered sync job execution
   */
  private async handleWebhookSyncJob(job: any): Promise<void> {
    const { tenantId, provider, resourceType, resourceId } = job.data;
    
    console.log(`🔄 Starting webhook sync for ${resourceType} ${resourceId}, tenant ${tenantId}, provider ${provider}`);

    try {
      // Sync specific resource based on webhook
      await this.syncResource(tenantId, provider, resourceType, {
        isFullSync: false,
        resourceId, // Sync specific resource if provided
        triggeredByWebhook: true
      });

      console.log(`✅ Webhook sync completed for ${resourceType}, tenant ${tenantId}, provider ${provider}`);

    } catch (error) {
      console.error(`❌ Webhook sync failed for ${resourceType}, tenant ${tenantId}, provider ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Core resource sync logic
   */
  private async syncResource(
    tenantId: string, 
    provider: string, 
    resource: string, 
    options: {
      isFullSync: boolean;
      modifiedSince?: Date;
      resourceId?: string;
      triggeredByWebhook?: boolean;
    }
  ): Promise<void> {
    const { isFullSync, modifiedSince, resourceId, triggeredByWebhook = false } = options;

    // Initialize or update sync state
    await this.updateSyncState(tenantId, provider, resource, {
      syncStatus: 'running',
      lastSyncAt: new Date(),
      errorMessage: null
    });

    try {
      // Get provider instance
      const providerInstance = this.apiMiddleware.getProvider(provider);
      if (!providerInstance) {
        throw new Error(`Provider ${provider} not found or not registered`);
      }

      // Build request options
      const requestOptions: any = {
        params: {
          tenantId,
          filters: {}
        }
      };

      // Add modifiedSince filter for incremental sync
      if (modifiedSince && !isFullSync) {
        requestOptions.params.filters.modifiedSince = modifiedSince.toISOString();
      }

      // Add specific resource ID filter for webhook sync
      if (resourceId) {
        requestOptions.params.filters.id = resourceId;
      }

      // Make API request to provider
      const response = await providerInstance.makeRequest(resource, requestOptions);

      if (!response.success) {
        throw new Error(response.error || `Failed to fetch ${resource} from ${provider}`);
      }

      // Process and store the data
      const processResult = await this.processResourceData(
        tenantId, 
        provider, 
        resource, 
        response.data || []
      );

      // Update sync state with success
      await this.updateSyncState(tenantId, provider, resource, {
        syncStatus: 'success',
        lastSuccessfulSyncAt: new Date(),
        recordsProcessed: processResult.processed,
        recordsCreated: processResult.created,
        recordsUpdated: processResult.updated,
        recordsFailed: processResult.failed,
        syncCursor: response.cursor || null, // Store pagination cursor if available
        errorMessage: null
      });

      console.log(`✅ Synced ${resource} for ${provider}: ${processResult.processed} processed, ${processResult.created} created, ${processResult.updated} updated`);

    } catch (error) {
      console.error(`❌ Failed to sync ${resource} for ${provider}:`, error);

      // Update sync state with error
      await this.updateSyncState(tenantId, provider, resource, {
        syncStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Process and store resource data from provider
   */
  private async processResourceData(
    tenantId: string,
    provider: string,
    resource: string,
    data: any[]
  ): Promise<{
    processed: number;
    created: number;
    updated: number;
    failed: number;
  }> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const item of data) {
      try {
        processed++;
        
        // Transform provider data to our schema format
        const transformedData = await this.transformResourceData(provider, resource, item, tenantId);
        
        if (!transformedData) {
          failed++;
          continue;
        }

        // Upsert the record (insert or update based on provider ID)
        const wasCreated = await this.upsertRecord(resource, transformedData, provider);
        
        if (wasCreated) {
          created++;
        } else {
          updated++;
        }

      } catch (itemError) {
        console.error(`Failed to process ${resource} item:`, itemError);
        failed++;
      }
    }

    return { processed, created, updated, failed };
  }

  /**
   * Transform provider-specific data to our unified schema
   */
  private async transformResourceData(
    provider: string,
    resource: string,
    data: any,
    tenantId: string
  ): Promise<any | null> {
    try {
      const handler = createDataTypeHandler(resource);
      return await handler.transform(data, provider, tenantId);
    } catch (error) {
      console.error(`Failed to transform ${resource} data for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Upsert record to database with duplicate prevention
   */
  private async upsertRecord(resource: string, data: any, provider: string): Promise<boolean> {
    try {
      const handler = createDataTypeHandler(resource);
      return await handler.upsert(data, provider);
    } catch (error) {
      console.error(`Failed to upsert ${resource} record for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Get or create sync state record
   */
  private async getSyncState(tenantId: string, provider: string, resource: string) {
    const [state] = await db
      .select()
      .from(syncState)
      .where(and(
        eq(syncState.tenantId, tenantId),
        eq(syncState.provider, provider),
        eq(syncState.resource, resource)
      ));

    return state;
  }

  /**
   * Update sync state in database
   */
  private async updateSyncState(
    tenantId: string,
    provider: string,
    resource: string,
    updates: Partial<{
      syncStatus: string;
      lastSyncAt: Date;
      lastSuccessfulSyncAt: Date;
      syncCursor: string | null;
      errorMessage: string | null;
      recordsProcessed: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsFailed: number;
    }>
  ): Promise<void> {
    try {
      // Check if sync state record exists
      const existingState = await this.getSyncState(tenantId, provider, resource);
      
      if (existingState) {
        // Update existing sync state record
        await db
          .update(syncState)
          .set({
            ...updates,
            updatedAt: new Date()
          })
          .where(and(
            eq(syncState.tenantId, tenantId),
            eq(syncState.provider, provider),
            eq(syncState.resource, resource)
          ));
        
        console.log(`📝 Updated sync state for ${provider}/${resource}: ${updates.syncStatus || 'status unchanged'}`);
      } else {
        // Create new sync state record
        await db.insert(syncState).values({
          tenantId,
          provider,
          resource,
          syncStatus: updates.syncStatus || 'running',
          lastSyncAt: updates.lastSyncAt || new Date(),
          lastSuccessfulSyncAt: updates.lastSuccessfulSyncAt || null,
          syncCursor: updates.syncCursor || null,
          errorMessage: updates.errorMessage || null,
          recordsProcessed: updates.recordsProcessed || 0,
          recordsCreated: updates.recordsCreated || 0,
          recordsUpdated: updates.recordsUpdated || 0,
          recordsFailed: updates.recordsFailed || 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`📝 Created new sync state for ${provider}/${resource}: ${updates.syncStatus || 'running'}`);
      }

    } catch (error) {
      console.error(`❌ Failed to update sync state for ${provider}/${resource}:`, error);
      throw error;
    }
  }

  /**
   * Get last successful sync time for a provider
   */
  private async getLastSuccessfulSync(tenantId: string, provider: string): Promise<Date | null> {
    const states = await db
      .select()
      .from(syncState)
      .where(and(
        eq(syncState.tenantId, tenantId),
        eq(syncState.provider, provider)
      ))
      .orderBy(desc(syncState.lastSuccessfulSyncAt));

    // Return the most recent successful sync across all resources
    const mostRecent = states.reduce((latest, state) => {
      if (!state.lastSuccessfulSyncAt) return latest;
      return !latest || state.lastSuccessfulSyncAt > latest ? state.lastSuccessfulSyncAt : latest;
    }, null as Date | null);

    return mostRecent;
  }

  /**
   * Convert sync frequency string to milliseconds
   */
  private getSyncFrequencyMs(frequency: string): number {
    switch (frequency) {
      case 'hourly': return 60 * 60 * 1000;
      case 'daily': return 24 * 60 * 60 * 1000;
      case 'weekly': return 7 * 24 * 60 * 60 * 1000;
      case 'manual': return 0;
      default: return 24 * 60 * 60 * 1000; // Default to daily
    }
  }

  /**
   * Trigger webhook sync for specific resource
   */
  async triggerWebhookSync(
    tenantId: string,
    provider: string,
    resourceType: string,
    resourceId: string
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      // Verify provider connection
      const [connection] = await db
        .select()
        .from(providerConnections)
        .where(and(
          eq(providerConnections.tenantId, tenantId),
          eq(providerConnections.provider, provider),
          eq(providerConnections.isActive, true),
          eq(providerConnections.isConnected, true)
        ));

      if (!connection) {
        return {
          success: false,
          error: `No active ${provider} connection found for tenant ${tenantId}`
        };
      }

      // Queue webhook sync job with high priority
      const jobId = jobQueue.enqueue('sync-webhook', {
        tenantId,
        provider,
        resourceType,
        resourceId,
        priority: 'high'
      }, 2); // Max 2 retries for webhook sync

      console.log(`📋 Webhook sync job queued for ${resourceType} ${resourceId}: ${jobId}`);

      return {
        success: true,
        jobId
      };

    } catch (error) {
      console.error(`Failed to trigger webhook sync for ${provider}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Schedule automatic syncs for all tenants
   */
  async scheduleAutomaticSyncs(): Promise<void> {
    try {
      // Get all active provider connections with auto sync enabled
      const connections = await db
        .select()
        .from(providerConnections)
        .where(and(
          eq(providerConnections.isActive, true),
          eq(providerConnections.isConnected, true),
          eq(providerConnections.autoSyncEnabled, true)
        ));

      for (const connection of connections) {
        if (connection.syncFrequency === 'manual') continue;

        // Check if it's time for a sync
        const lastSync = await this.getLastSuccessfulSync(connection.tenantId, connection.provider);
        const now = new Date();
        const timeSinceLastSync = lastSync ? now.getTime() - lastSync.getTime() : Infinity;
        const frequencyMs = this.getSyncFrequencyMs(connection.syncFrequency);

        if (timeSinceLastSync >= frequencyMs) {
          console.log(`⏰ Scheduling automatic ${connection.syncFrequency} sync for tenant ${connection.tenantId}, provider ${connection.provider}`);
          
          await this.triggerIncrementalSync(connection.tenantId, connection.provider, false);
        }
      }

    } catch (error) {
      console.error('Failed to schedule automatic syncs:', error);
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();