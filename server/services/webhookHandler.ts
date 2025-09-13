import crypto from 'crypto';
import { Request, Response } from 'express';
import { syncService } from './syncService';

/**
 * Webhook Handler for Provider Real-time Updates
 * Processes webhooks from Xero, Sage, and QuickBooks for real-time sync
 */

export interface WebhookEvent {
  provider: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  tenantId: string;
  timestamp: Date;
  data?: any;
}

export class WebhookHandler {
  /**
   * Process incoming webhook from any provider
   */
  async processWebhook(
    provider: string,
    payload: any,
    signature: string,
    req: Request
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify webhook signature FIRST using raw payload/body for security
      const isValid = await this.verifySignature(provider, payload, signature, req);
      if (!isValid) {
        console.error(`❌ Invalid webhook signature for ${provider}`);
        return { success: false, error: 'Invalid signature' };
      }

      // Parse payload to JSON if it's a Buffer (while keeping raw body for HMAC verification)
      let parsedPayload = payload;
      if (Buffer.isBuffer(payload)) {
        try {
          parsedPayload = JSON.parse(payload.toString('utf8'));
          console.log(`🔄 Parsed Buffer payload to JSON for ${provider} webhook processing`);
        } catch (parseError) {
          console.error(`❌ Failed to parse ${provider} webhook payload as JSON:`, parseError);
          return { success: false, error: 'Invalid JSON payload' };
        }
      } else if (typeof payload === 'string') {
        try {
          parsedPayload = JSON.parse(payload);
          console.log(`🔄 Parsed string payload to JSON for ${provider} webhook processing`);
        } catch (parseError) {
          console.error(`❌ Failed to parse ${provider} webhook payload string as JSON:`, parseError);
          return { success: false, error: 'Invalid JSON payload' };
        }
      }

      // Parse webhook events based on provider using parsed JSON payload
      const events = await this.parseWebhookEvents(provider, parsedPayload);
      
      if (events.length === 0) {
        console.log(`📝 No actionable events in ${provider} webhook`);
        return { success: true };
      }

      // Process each event
      const results = await Promise.allSettled(
        events.map(event => this.processWebhookEvent(event))
      );

      // Check for failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error(`❌ ${failures.length}/${events.length} webhook events failed for ${provider}`);
        return { 
          success: false, 
          error: `${failures.length} events failed to process` 
        };
      }

      console.log(`✅ Successfully processed ${events.length} ${provider} webhook events`);
      return { success: true };

    } catch (error) {
      console.error(`❌ Webhook processing failed for ${provider}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Verify webhook signature for security
   */
  private async verifySignature(
    provider: string,
    payload: any,
    signature: string,
    req: Request
  ): Promise<boolean> {
    try {
      switch (provider) {
        case 'xero':
          return this.verifyXeroSignature(payload, signature, req);
        case 'sage':
          return this.verifySageSignature(payload, signature, req);
        case 'quickbooks':
          return this.verifyQuickBooksSignature(payload, signature, req);
        default:
          console.error(`❌ Unknown provider for webhook verification: ${provider}`);
          return false; // Fail-closed: reject unknown providers
      }
    } catch (error) {
      console.error(`❌ Signature verification failed for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Verify Xero webhook signature
   */
  private verifyXeroSignature(payload: any, signature: string, req: Request): boolean {
    if (!process.env.XERO_WEBHOOK_KEY) {
      console.error('❌ XERO_WEBHOOK_KEY not configured - webhook verification FAILED');
      return false; // Fail-closed security: always fail when secrets missing
    }

    try {
      // Use raw body data for HMAC verification
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(payload));
      const expectedSignature = crypto
        .createHmac('sha256', process.env.XERO_WEBHOOK_KEY)
        .update(rawBody)
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('❌ Xero signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify Sage webhook signature
   */
  private verifySageSignature(payload: any, signature: string, req: Request): boolean {
    if (!process.env.SAGE_WEBHOOK_SECRET) {
      console.error('❌ SAGE_WEBHOOK_SECRET not configured - webhook verification FAILED');
      return false; // Fail-closed security: always fail when secrets missing
    }

    try {
      // Use raw body data for HMAC verification
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(payload));
      const expectedSignature = crypto
        .createHmac('sha256', process.env.SAGE_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('❌ Sage signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify QuickBooks webhook signature
   */
  private verifyQuickBooksSignature(payload: any, signature: string, req: Request): boolean {
    if (!process.env.QUICKBOOKS_WEBHOOK_TOKEN) {
      console.error('❌ QUICKBOOKS_WEBHOOK_TOKEN not configured - webhook verification FAILED');
      return false; // Fail-closed security: always fail when secrets missing
    }

    try {
      // Use raw body data for HMAC verification
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(payload));
      const expectedSignature = crypto
        .createHmac('sha256', process.env.QUICKBOOKS_WEBHOOK_TOKEN)
        .update(rawBody)
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('❌ QuickBooks signature verification error:', error);
      return false;
    }
  }

  /**
   * Parse webhook events based on provider format
   */
  private async parseWebhookEvents(provider: string, payload: any): Promise<WebhookEvent[]> {
    switch (provider) {
      case 'xero':
        return this.parseXeroWebhook(payload);
      case 'sage':
        return this.parseSageWebhook(payload);
      case 'quickbooks':
        return this.parseQuickBooksWebhook(payload);
      default:
        console.warn(`⚠️ No webhook parser for provider: ${provider}`);
        return [];
    }
  }

  /**
   * Parse Xero webhook events
   */
  private parseXeroWebhook(payload: any): WebhookEvent[] {
    const events: WebhookEvent[] = [];

    if (!payload.events || !Array.isArray(payload.events)) {
      return events;
    }

    for (const event of payload.events) {
      try {
        const resourceType = this.mapXeroResourceType(event.eventCategory, event.eventType);
        if (!resourceType) continue;

        events.push({
          provider: 'xero',
          eventType: event.eventType,
          resourceType,
          resourceId: event.resourceId,
          tenantId: event.tenantId,
          timestamp: new Date(event.eventDateUtc),
          data: event
        });
      } catch (error) {
        console.error('❌ Failed to parse Xero webhook event:', error);
      }
    }

    return events;
  }

  /**
   * Parse Sage webhook events
   */
  private parseSageWebhook(payload: any): WebhookEvent[] {
    const events: WebhookEvent[] = [];

    if (!payload.notification || !Array.isArray(payload.notification)) {
      return events;
    }

    for (const notification of payload.notification) {
      try {
        const resourceType = this.mapSageResourceType(notification.resource_type);
        if (!resourceType) continue;

        events.push({
          provider: 'sage',
          eventType: notification.event_type,
          resourceType,
          resourceId: notification.resource_id,
          tenantId: notification.business_id, // Sage uses business_id
          timestamp: new Date(notification.timestamp),
          data: notification
        });
      } catch (error) {
        console.error('❌ Failed to parse Sage webhook event:', error);
      }
    }

    return events;
  }

  /**
   * Parse QuickBooks webhook events
   */
  private parseQuickBooksWebhook(payload: any): WebhookEvent[] {
    const events: WebhookEvent[] = [];

    if (!payload.eventNotifications || !Array.isArray(payload.eventNotifications)) {
      return events;
    }

    for (const notification of payload.eventNotifications) {
      try {
        if (!notification.dataChangeEvent || !notification.dataChangeEvent.entities) {
          continue;
        }

        for (const entity of notification.dataChangeEvent.entities) {
          const resourceType = this.mapQuickBooksResourceType(entity.name);
          if (!resourceType) continue;

          events.push({
            provider: 'quickbooks',
            eventType: entity.operation,
            resourceType,
            resourceId: entity.id,
            tenantId: notification.realmId,
            timestamp: new Date(entity.lastUpdated),
            data: entity
          });
        }
      } catch (error) {
        console.error('❌ Failed to parse QuickBooks webhook event:', error);
      }
    }

    return events;
  }

  /**
   * Process individual webhook event
   */
  private async processWebhookEvent(event: WebhookEvent): Promise<void> {
    try {
      console.log(`🔄 Processing ${event.provider} webhook: ${event.eventType} for ${event.resourceType} ${event.resourceId}`);

      // Filter out events we don't need to sync
      if (this.shouldSkipEvent(event)) {
        console.log(`⏭️ Skipping ${event.eventType} event for ${event.resourceType}`);
        return;
      }

      // Trigger targeted sync for this specific resource
      const result = await syncService.triggerWebhookSync(
        event.tenantId,
        event.provider,
        event.resourceType,
        event.resourceId
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to trigger webhook sync');
      }

      console.log(`✅ Webhook sync queued for ${event.resourceType} ${event.resourceId}`);

    } catch (error) {
      console.error(`❌ Failed to process webhook event:`, error);
      throw error;
    }
  }

  /**
   * Determine if we should skip processing this event
   */
  private shouldSkipEvent(event: WebhookEvent): boolean {
    // Skip delete events for now (we might want to handle these differently)
    if (event.eventType.toLowerCase().includes('delete')) {
      return true;
    }

    // Skip test events
    if (event.eventType.toLowerCase().includes('test')) {
      return true;
    }

    // Only process resource types we care about
    const supportedResources = [
      'contacts', 'customers', 'vendors',
      'invoices', 'bills', 'payments', 'bill-payments',
      'bank-accounts', 'bank-transactions'
    ];

    return !supportedResources.includes(event.resourceType);
  }

  /**
   * Map Xero resource types to our standard names
   */
  private mapXeroResourceType(category: string, eventType: string): string | null {
    switch (category) {
      case 'CONTACT':
        return 'contacts';
      case 'INVOICE':
        return 'invoices';
      case 'BILL':
        return 'bills';
      case 'PAYMENT':
        return 'payments';
      case 'BANK-TRANSACTION':
        return 'bank-transactions';
      case 'ACCOUNT':
        // Filter to only bank accounts
        return eventType.includes('BANK') ? 'bank-accounts' : null;
      default:
        return null;
    }
  }

  /**
   * Map Sage resource types to our standard names
   */
  private mapSageResourceType(resourceType: string): string | null {
    switch (resourceType) {
      case 'contacts':
        return 'contacts';
      case 'sales_invoices':
        return 'invoices';
      case 'purchase_invoices':
        return 'bills';
      case 'bank_receipts':
        return 'payments';
      case 'bank_payments':
        return 'bill-payments';
      case 'bank_accounts':
        return 'bank-accounts';
      case 'bank_transactions':
        return 'bank-transactions';
      default:
        return null;
    }
  }

  /**
   * Map QuickBooks resource types to our standard names
   */
  private mapQuickBooksResourceType(entityName: string): string | null {
    switch (entityName) {
      case 'Customer':
        return 'contacts';
      case 'Vendor':
        return 'contacts';
      case 'Invoice':
        return 'invoices';
      case 'Bill':
        return 'bills';
      case 'Payment':
        return 'payments';
      case 'BillPayment':
        return 'bill-payments';
      case 'Account':
        return 'bank-accounts';
      case 'BankTransfer':
        return 'bank-transactions';
      default:
        return null;
    }
  }

  /**
   * Add method to trigger webhook sync (add to SyncService)
   */
  async triggerWebhookSync(
    tenantId: string,
    provider: string,
    resourceType: string,
    resourceId: string
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    return syncService.triggerWebhookSync(tenantId, provider, resourceType, resourceId);
  }
}

// Export singleton instance
export const webhookHandler = new WebhookHandler();