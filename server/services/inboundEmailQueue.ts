/**
 * Inbound Email Queue Service v0.5
 * Handles idempotency deduplication and retry logic
 */

import crypto from 'crypto';
import type { NormalizedInboundEmail, InboundEmailQueueItem } from '../../shared/types/inboundEmail';
import { generateQashivoSignature } from './inboundEmailNormalizer';

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 5000, 30000, 120000, 600000]; // 1s, 5s, 30s, 2m, 10m

const processedKeys = new Map<string, { processedAt: Date; result: 'success' | 'duplicate' }>();
const retryQueue: InboundEmailQueueItem[] = [];
let isProcessingQueue = false;

/**
 * Check if message has already been processed (idempotency)
 */
export function isDuplicate(idempotencyKey: string): boolean {
  return processedKeys.has(idempotencyKey);
}

/**
 * Mark message as processed
 */
export function markProcessed(idempotencyKey: string, result: 'success' | 'duplicate' = 'success'): void {
  processedKeys.set(idempotencyKey, {
    processedAt: new Date(),
    result,
  });
  
  // Clean up old entries (keep last 24 hours)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  processedKeys.forEach((value, key) => {
    if (value.processedAt.getTime() < cutoff) {
      processedKeys.delete(key);
    }
  });
}

/**
 * Queue email for retry
 */
export function queueForRetry(email: NormalizedInboundEmail, error: string): void {
  const id = crypto.randomUUID();
  
  const item: InboundEmailQueueItem = {
    id,
    normalizedEmail: email,
    attempts: 0,
    lastAttemptAt: new Date(),
    nextRetryAt: new Date(Date.now() + RETRY_DELAYS[0]),
    status: 'pending',
    error,
    createdAt: new Date(),
  };
  
  retryQueue.push(item);
  console.log(`📬 Queued inbound email for retry: ${id} (${email.idempotency.key})`);
  
  // Start processing if not already running
  if (!isProcessingQueue) {
    processRetryQueue();
  }
}

/**
 * Post normalized email to internal webhook
 */
export async function postToInternalWebhook(email: NormalizedInboundEmail): Promise<{ success: boolean; error?: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyString = JSON.stringify(email);
  const signature = generateQashivoSignature(timestamp, bodyString);
  
  try {
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co`
      : 'http://localhost:5000';
    
    const response = await fetch(`${baseUrl}/webhooks/inbound/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Qashivo-Timestamp': timestamp,
        'X-Qashivo-Signature': signature,
        'X-Idempotency-Key': email.idempotency.key,
      },
      body: bodyString,
    });
    
    if (response.ok) {
      return { success: true };
    }
    
    const text = await response.text();
    return { success: false, error: `HTTP ${response.status}: ${text}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Process retry queue
 */
async function processRetryQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  
  const checkInterval = setInterval(async () => {
    const now = Date.now();
    const itemsToProcess = retryQueue.filter(
      item => item.status === 'pending' && item.nextRetryAt && item.nextRetryAt.getTime() <= now
    );
    
    for (const item of itemsToProcess) {
      item.status = 'processing';
      item.attempts++;
      item.lastAttemptAt = new Date();
      
      console.log(`📬 Retrying inbound email: ${item.id} (attempt ${item.attempts}/${MAX_RETRIES})`);
      
      const result = await postToInternalWebhook(item.normalizedEmail);
      
      if (result.success) {
        item.status = 'completed';
        markProcessed(item.normalizedEmail.idempotency.key, 'success');
        console.log(`✅ Retry successful: ${item.id}`);
        
        // Remove from queue
        const index = retryQueue.indexOf(item);
        if (index > -1) {
          retryQueue.splice(index, 1);
        }
      } else if (item.attempts >= MAX_RETRIES) {
        item.status = 'failed';
        item.error = result.error;
        console.error(`❌ Retry failed (max attempts): ${item.id} - ${result.error}`);
        
        // Remove from queue but log for manual intervention
        const index = retryQueue.indexOf(item);
        if (index > -1) {
          retryQueue.splice(index, 1);
        }
      } else {
        // Schedule next retry
        item.status = 'pending';
        item.error = result.error;
        const delay = RETRY_DELAYS[Math.min(item.attempts, RETRY_DELAYS.length - 1)];
        item.nextRetryAt = new Date(Date.now() + delay);
        console.log(`⏰ Scheduled retry for ${item.id} in ${delay / 1000}s`);
      }
    }
    
    // Stop processing if queue is empty
    if (retryQueue.length === 0) {
      clearInterval(checkInterval);
      isProcessingQueue = false;
    }
  }, 1000);
}

/**
 * Get queue stats
 */
export function getQueueStats(): { pending: number; processing: number; total: number } {
  return {
    pending: retryQueue.filter(i => i.status === 'pending').length,
    processing: retryQueue.filter(i => i.status === 'processing').length,
    total: retryQueue.length,
  };
}
