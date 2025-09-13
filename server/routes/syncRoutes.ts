import type { Express } from "express";
import express from "express";
import { syncService } from "../services/syncService";
import { webhookHandler } from "../services/webhookHandler";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";

/**
 * Raw body middleware for webhook signature verification
 * Webhooks need access to raw body data for HMAC verification
 */
const rawBodyMiddleware = (req: any, res: any, buf: Buffer) => {
  req.rawBody = buf;
};

/**
 * Sync API Routes
 * Provides endpoints for triggering and monitoring sync operations
 */
export function registerSyncRoutes(app: Express): void {
  
  /**
   * Trigger full sync (24-month backfill) for a provider
   * POST /api/sync/full/:provider
   */
  app.post('/api/sync/full/:provider', isAuthenticated, async (req, res) => {
    try {
      const { provider } = req.params;
      const { backfillMonths = 24, force = false } = req.body;
      
      // Get user's tenant
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ 
          success: false, 
          error: "User not associated with a tenant" 
        });
      }

      // Validate provider
      const supportedProviders = ['xero', 'sage', 'quickbooks'];
      if (!supportedProviders.includes(provider)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported provider: ${provider}. Supported providers: ${supportedProviders.join(', ')}`
        });
      }

      console.log(`🔄 Triggering full sync for tenant ${user.tenantId}, provider ${provider} (${backfillMonths} months)`);

      // Trigger full sync
      const result = await syncService.triggerFullSync(user.tenantId, provider);

      if (result.success) {
        res.json({
          success: true,
          message: `Full sync initiated for ${provider}`,
          jobId: result.jobId,
          backfillMonths
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Full sync API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  /**
   * Trigger incremental sync for a provider
   * POST /api/sync/incremental/:provider
   */
  app.post('/api/sync/incremental/:provider', isAuthenticated, async (req, res) => {
    try {
      const { provider } = req.params;
      const { force = false } = req.body;
      
      // Get user's tenant
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ 
          success: false, 
          error: "User not associated with a tenant" 
        });
      }

      // Validate provider
      const supportedProviders = ['xero', 'sage', 'quickbooks'];
      if (!supportedProviders.includes(provider)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported provider: ${provider}. Supported providers: ${supportedProviders.join(', ')}`
        });
      }

      console.log(`🔄 Triggering incremental sync for tenant ${user.tenantId}, provider ${provider} (force: ${force})`);

      // Trigger incremental sync
      const result = await syncService.triggerIncrementalSync(user.tenantId, provider, force);

      if (result.success) {
        res.json({
          success: true,
          message: `Incremental sync initiated for ${provider}`,
          jobId: result.jobId,
          force
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Incremental sync API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  /**
   * Get sync status for a provider
   * GET /api/sync/status/:provider
   */
  app.get('/api/sync/status/:provider', isAuthenticated, async (req, res) => {
    try {
      const { provider } = req.params;
      
      // Get user's tenant
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ 
          success: false, 
          error: "User not associated with a tenant" 
        });
      }

      // Validate provider
      const supportedProviders = ['xero', 'sage', 'quickbooks'];
      if (!supportedProviders.includes(provider)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported provider: ${provider}. Supported providers: ${supportedProviders.join(', ')}`
        });
      }

      // Get sync status
      const status = await syncService.getSyncStatus(user.tenantId, provider);

      res.json({
        success: true,
        provider,
        tenantId: user.tenantId,
        status
      });

    } catch (error) {
      console.error('❌ Sync status API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  /**
   * Get sync status for all providers
   * GET /api/sync/status
   */
  app.get('/api/sync/status', isAuthenticated, async (req, res) => {
    try {
      // Get user's tenant
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ 
          success: false, 
          error: "User not associated with a tenant" 
        });
      }

      const providers = ['xero', 'sage', 'quickbooks'];
      const allStatus: any = {};

      // Get status for all providers in parallel
      const statusResults = await Promise.allSettled(
        providers.map(async (provider) => {
          const status = await syncService.getSyncStatus(user.tenantId, provider);
          return { provider, status };
        })
      );

      // Process results
      statusResults.forEach((result, index) => {
        const provider = providers[index];
        if (result.status === 'fulfilled') {
          allStatus[provider] = result.value.status;
        } else {
          allStatus[provider] = {
            overall: { status: 'error', error: 'Failed to get status' },
            byResource: []
          };
        }
      });

      res.json({
        success: true,
        tenantId: user.tenantId,
        providers: allStatus
      });

    } catch (error) {
      console.error('❌ All sync status API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  /**
   * Webhook receiver for Xero
   * POST /api/sync/webhook/xero
   */
  app.post('/api/sync/webhook/xero', 
    express.raw({ type: 'application/json', verify: rawBodyMiddleware }),
    async (req, res) => {
    try {
      const signature = req.headers['x-xero-signature'] as string;
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing webhook signature'
        });
      }

      console.log('📥 Received Xero webhook');

      const result = await webhookHandler.processWebhook('xero', req.body, signature, req);

      if (result.success) {
        res.json({ success: true, message: 'Webhook processed successfully' });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Xero webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed'
      });
    }
  });

  /**
   * Webhook receiver for Sage
   * POST /api/sync/webhook/sage
   */
  app.post('/api/sync/webhook/sage',
    express.raw({ type: 'application/json', verify: rawBodyMiddleware }),
    async (req, res) => {
    try {
      const signature = req.headers['x-sage-signature'] as string;
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing webhook signature'
        });
      }

      console.log('📥 Received Sage webhook');

      const result = await webhookHandler.processWebhook('sage', req.body, signature, req);

      if (result.success) {
        res.json({ success: true, message: 'Webhook processed successfully' });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Sage webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed'
      });
    }
  });

  /**
   * Webhook receiver for QuickBooks
   * POST /api/sync/webhook/quickbooks
   */
  app.post('/api/sync/webhook/quickbooks',
    express.raw({ type: 'application/json', verify: rawBodyMiddleware }),
    async (req, res) => {
    try {
      const signature = req.headers['intuit-signature'] as string;
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing webhook signature'
        });
      }

      console.log('📥 Received QuickBooks webhook');

      const result = await webhookHandler.processWebhook('quickbooks', req.body, signature, req);

      if (result.success) {
        res.json({ success: true, message: 'Webhook processed successfully' });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ QuickBooks webhook error:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed'
      });
    }
  });

  /**
   * Manual webhook trigger for testing
   * POST /api/sync/webhook/test
   */
  app.post('/api/sync/webhook/test', isAuthenticated, async (req, res) => {
    try {
      const { provider, resourceType, resourceId } = req.body;
      
      if (!provider || !resourceType || !resourceId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: provider, resourceType, resourceId'
        });
      }

      // Get user's tenant
      const user = await storage.getUser((req as any).user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ 
          success: false, 
          error: "User not associated with a tenant" 
        });
      }

      console.log(`🧪 Manual webhook test for tenant ${user.tenantId}, provider ${provider}, resource ${resourceType}:${resourceId}`);

      const result = await syncService.triggerWebhookSync(
        user.tenantId,
        provider,
        resourceType,
        resourceId
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Test webhook sync initiated',
          jobId: result.jobId
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('❌ Test webhook error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  /**
   * Get job queue status for sync operations
   * GET /api/sync/queue
   */
  app.get('/api/sync/queue', isAuthenticated, async (req, res) => {
    try {
      const { jobQueue } = await import("../services/jobQueue");
      const queueStatus = jobQueue.getStatus();

      res.json({
        success: true,
        queue: queueStatus
      });

    } catch (error) {
      console.error('❌ Queue status API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  console.log('✅ Sync API routes registered');
}