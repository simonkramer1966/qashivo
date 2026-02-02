import type { Express, Request, Response } from "express";
import { db } from "../db";
import { inboundMessages, contacts, emailMessages, detectedOutcomes, actions, invoices, timelineEvents, outcomes, conversations } from "@shared/schema";
import { intentAnalyst } from "../services/intentAnalyst";
import { detectOutcomeFromText } from "../services/outcomeDetection";
import { eq, or, and, desc } from "drizzle-orm";
import crypto from "crypto";
import multer from "multer";
import {
  verifyInboundToken,
  normalizeSendGridInboundEmail,
  verifyQashivoSignature,
} from "../services/inboundEmailNormalizer";
import {
  isDuplicate,
  markProcessed,
  queueForRetry,
  getQueueStats,
} from "../services/inboundEmailQueue";
import type { NormalizedInboundEmail } from "../../shared/types/inboundEmail";

/**
 * SendGrid IP ranges for Inbound Parse webhook
 * https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook#security
 * Updated periodically - check SendGrid docs for latest list
 */
const SENDGRID_WEBHOOK_IPS = [
  '167.89.0.0/17',    // SendGrid primary range
  '208.117.48.0/20',  // SendGrid secondary range
  '50.31.32.0/19',    // SendGrid tertiary range
  '198.37.144.0/20',  // Additional range
  '159.26.0.0/16',    // SendGrid newer range (includes 159.26.144.x, 159.26.150.x)
  '149.72.0.0/16',    // SendGrid outbound range (seen in production)
];

/**
 * Normalize IP address (handle IPv6-mapped IPv4 like ::ffff:192.168.1.1)
 */
function normalizeIpAddress(ip: string): string {
  if (!ip) return '';
  
  // Handle IPv6-mapped IPv4 format (::ffff:x.x.x.x)
  const ipv4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4Mapped) {
    return ipv4Mapped[1];
  }
  
  // Handle [::ffff:x.x.x.x] bracket format
  const bracketMapped = ip.match(/^\[::ffff:(\d+\.\d+\.\d+\.\d+)\]$/i);
  if (bracketMapped) {
    return bracketMapped[1];
  }
  
  return ip;
}

/**
 * Check if an IP address falls within CIDR range
 * Validates IPv4 addresses only
 */
function ipInCidr(ip: string, cidr: string): boolean {
  // Validate IPv4 format
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (!ipv4Regex.test(ip)) {
    return false;
  }
  
  const [range, bits] = cidr.split('/');
  const bitsNum = parseInt(bits);
  if (isNaN(bitsNum) || bitsNum < 0 || bitsNum > 32) {
    return false;
  }
  
  const mask = bitsNum === 0 ? 0 : ~(2 ** (32 - bitsNum) - 1);
  
  const ipOctets = ip.split('.').map(o => parseInt(o));
  const rangeOctets = range.split('.').map(o => parseInt(o));
  
  // Validate octets are in valid range
  if (ipOctets.some(o => isNaN(o) || o < 0 || o > 255) ||
      rangeOctets.some(o => isNaN(o) || o < 0 || o > 255)) {
    return false;
  }
  
  const ipNum = ipOctets.reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0;
  const rangeNum = rangeOctets.reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0;
  
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Validate request comes from SendGrid
 * Uses multiple layers of security:
 * 1. In development: allow all for testing
 * 2. IP allowlisting using the direct socket connection (not spoofable headers)
 * 3. Additional logging for security audit
 * 
 * Note: In Replit's trusted proxy environment, we use the socket address
 * since Replit's load balancer handles X-Forwarded-For reliably.
 * For maximum security, implement SendGrid's signed webhook verification.
 */
function validateSendGridOrigin(req: Request): boolean {
  // Development mode: allow all for testing
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 SendGrid webhook: Development mode, skipping IP validation');
    return true;
  }
  
  // In Replit's environment, use the IP from the trusted proxy chain
  // Express.js req.ip respects trust proxy settings
  // Fallback to socket remoteAddress which cannot be spoofed
  const socketIp = normalizeIpAddress(req.socket?.remoteAddress || '');
  
  // For Replit's proxy setup, X-Forwarded-For is reliable
  // We check both the socket IP and the forwarded IP
  const forwardedFor = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim();
  const forwardedIp = forwardedFor ? normalizeIpAddress(forwardedFor) : '';
  
  // Log both for audit trail
  console.log(`📧 SendGrid webhook origin check: socket=${socketIp}, forwarded=${forwardedIp}`);
  
  // Check if either IP is in the allowlist
  // In Replit, the forwarded IP is the actual client IP from the trusted proxy
  const ipToCheck = forwardedIp || socketIp;
  
  if (!ipToCheck) {
    console.warn('⚠️  SendGrid webhook: No client IP detected');
    return false;
  }
  
  const isAllowed = SENDGRID_WEBHOOK_IPS.some(cidr => ipInCidr(ipToCheck, cidr));
  
  if (!isAllowed) {
    console.warn(`⚠️  SendGrid webhook rejected: IP ${ipToCheck} not in allowlist`);
    console.warn(`    Socket IP: ${socketIp}, Forwarded IP: ${forwardedIp}`);
  }
  
  return isAllowed;
}

/**
 * Multer configuration for SendGrid multipart form-data parsing
 * SendGrid sends inbound emails as multipart/form-data
 */
const sendGridUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max attachment size
  },
});

/**
 * Webhook Routes for Inbound Communications
 * Handles: SendGrid (email), Vonage (SMS/WhatsApp), Retell (voice)
 */
export function registerWebhookRoutes(app: Express) {
  
  /**
   * SendGrid Inbound Email Webhook v0.5
   * https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
   * 
   * Enhanced with:
   * - Shared-secret token verification
   * - Normalized canonical JSON output
   * - Idempotency deduplication
   * - Retry queue for reliability
   */
  app.post("/api/webhooks/sendgrid/inbound", sendGridUpload.any(), async (req: Request, res: Response) => {
    try {
      console.log('📧 Received inbound email webhook from SendGrid');
      
      // Security: Verify shared-secret token from query string
      if (!verifyInboundToken(req)) {
        console.warn('❌ SendGrid webhook rejected: Invalid or missing token');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Security: Validate request origin (IP allowlist)
      if (!validateSendGridOrigin(req)) {
        console.warn('❌ SendGrid webhook rejected: Invalid origin');
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      // Normalize to canonical format
      const normalizedEmail = await normalizeSendGridInboundEmail(req);
      console.log(`📧 Normalized email: ${normalizedEmail.idempotency.key}`);
      
      // Check idempotency - reject duplicates
      if (isDuplicate(normalizedEmail.idempotency.key)) {
        console.log(`📧 Duplicate email ignored: ${normalizedEmail.idempotency.key}`);
        return res.status(200).json({ message: 'Duplicate ignored' });
      }
      
      // Process the normalized email inline (v0.5 - no internal HTTP call needed)
      const processResult = await processNormalizedInboundEmail(normalizedEmail);
      
      if (processResult.success) {
        markProcessed(normalizedEmail.idempotency.key, 'success');
        return res.status(200).json({ 
          message: 'Email received',
          emailMessageId: processResult.emailMessageId,
          legacyMessageId: processResult.legacyMessageId,
        });
      } else {
        // Queue for retry if processing failed
        queueForRetry(normalizedEmail, processResult.error || 'Processing failed');
        return res.status(200).json({ message: 'Queued for retry' });
      }

    } catch (error) {
      console.error('❌ SendGrid webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Internal Inbound Email Webhook (for future provider abstraction)
   * POST /webhooks/inbound/email
   * 
   * Accepts normalized email JSON with Qashivo HMAC verification
   */
  app.post("/webhooks/inbound/email", async (req: Request, res: Response) => {
    try {
      const timestamp = req.headers['x-qashivo-timestamp'] as string;
      const signature = req.headers['x-qashivo-signature'] as string;
      const idempotencyKey = req.headers['x-idempotency-key'] as string;
      
      if (!timestamp || !signature) {
        return res.status(401).json({ error: 'Missing authentication headers' });
      }
      
      // Verify HMAC signature
      const bodyString = JSON.stringify(req.body);
      if (!verifyQashivoSignature(timestamp, bodyString, signature)) {
        console.warn('❌ Internal webhook rejected: Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      // Check timestamp freshness (5 minute window)
      const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp));
      if (timestampAge > 300) {
        return res.status(401).json({ error: 'Request too old' });
      }
      
      const normalizedEmail = req.body as NormalizedInboundEmail;
      
      // Check idempotency
      const key = idempotencyKey || normalizedEmail.idempotency?.key;
      if (key && isDuplicate(key)) {
        return res.status(200).json({ message: 'Duplicate ignored' });
      }
      
      // Process the normalized email
      const result = await processNormalizedInboundEmail(normalizedEmail);
      
      if (result.success && key) {
        markProcessed(key, 'success');
      }
      
      res.status(200).json(result);
    } catch (error) {
      console.error('❌ Internal email webhook error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  /**
   * Queue status endpoint
   */
  app.get("/api/webhooks/inbound/queue-stats", (req: Request, res: Response) => {
    res.json(getQueueStats());
  });

  /**
   * Legacy SendGrid Inbound Email Webhook (original processing logic)
   * Kept for backward compatibility during migration
   */
  app.post("/api/webhooks/sendgrid/inbound-legacy", sendGridUpload.any(), async (req: Request, res: Response) => {
    try {
      console.log('📧 Received inbound email webhook from SendGrid (legacy)');
      
      // Security: Validate request origin (IP allowlist)
      if (!validateSendGridOrigin(req)) {
        console.warn('❌ SendGrid webhook rejected: Invalid origin');
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { 
        from, 
        to, 
        subject, 
        text, 
        html,
        envelope 
      } = req.body;

      if (!from || (!text && !html)) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Extract email address from "Name <email>" format
      const fromEmail = extractEmail(from);
      
      // Parse reply token from To address (format: reply+TOKEN@in.qashivo.com)
      const replyToken = extractReplyToken(to);
      let linkedAction: any = null;
      let linkedContact: any = null;
      let linkedInvoice: any = null;
      
      if (replyToken) {
        // Decode reply token: base64url -> actionId.contactId.invoiceId.random
        try {
          const decodedToken = Buffer.from(replyToken, 'base64url').toString();
          const [actionId, contactId, invoiceId] = decodedToken.split('.');
          
          console.log(`📨 Parsed reply token: action=${actionId}, contact=${contactId}, invoice=${invoiceId}`);
          
          // Security: Verify the reply token exists in our database AND matches decoded IDs
          // This prevents attackers from crafting arbitrary tokens or replaying stolen tokens
          const [existingEmail] = await db
            .select()
            .from(emailMessages)
            .where(and(
              eq(emailMessages.replyToken, replyToken),
              eq(emailMessages.direction, 'OUTBOUND')
            ))
            .limit(1);
          
          if (!existingEmail) {
            console.warn(`⚠️  Reply token not found in database: ${replyToken.substring(0, 10)}...`);
            // Reject - don't process emails with invalid tokens
            return res.status(200).json({ message: 'Invalid reply token' });
          }
          
          // Cross-check token IDs match the stored outbound message
          const tokenContactId = contactId || null;
          const tokenInvoiceId = (invoiceId && invoiceId !== 'none') ? invoiceId : null;
          const tokenActionId = actionId || null;
          
          const mismatch = (
            (tokenContactId && existingEmail.contactId !== tokenContactId) ||
            (tokenInvoiceId && existingEmail.invoiceId !== tokenInvoiceId) ||
            (tokenActionId && existingEmail.actionId !== tokenActionId)
          );
          
          if (mismatch) {
            console.warn(`⚠️  Reply token mismatch - decoded IDs don't match stored message`);
            console.warn(`    Token: contact=${tokenContactId}, invoice=${tokenInvoiceId}, action=${tokenActionId}`);
            console.warn(`    Stored: contact=${existingEmail.contactId}, invoice=${existingEmail.invoiceId}, action=${existingEmail.actionId}`);
            return res.status(200).json({ message: 'Token mismatch' });
          }
          
          console.log(`✅ Reply token verified for email ${existingEmail.id}`);
          
          // Get the linked action
          if (actionId) {
            const [action] = await db
              .select()
              .from(actions)
              .where(eq(actions.id, actionId))
              .limit(1);
            if (action) {
              linkedAction = action;
            }
          }
          
          // Get the linked invoice
          if (invoiceId && invoiceId !== 'none') {
            const [invoice] = await db
              .select()
              .from(invoices)
              .where(eq(invoices.id, invoiceId))
              .limit(1);
            if (invoice) {
              linkedInvoice = invoice;
            }
          }
          
          // Get the linked contact
          if (contactId) {
            const [contact] = await db
              .select()
              .from(contacts)
              .where(eq(contacts.id, contactId))
              .limit(1);
            if (contact) {
              linkedContact = contact;
            }
          }
        } catch (tokenErr) {
          console.log('⚠️  Failed to parse reply token:', tokenErr);
        }
      }
      
      // Fallback: find contact by email if no reply token
      if (!linkedContact) {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(eq(contacts.email, fromEmail))
          .limit(1);
        linkedContact = contact;
      }

      if (!linkedContact) {
        console.log(`⚠️  No contact found for email: ${fromEmail}`);
        return res.status(200).json({ message: 'No matching contact' });
      }

      // Store in emailMessages table (new unified table)
      const threadKey = linkedInvoice?.id ? `inv_${linkedInvoice.id}` : `cust_${linkedContact.id}`;
      
      const [emailMessage] = await db
        .insert(emailMessages)
        .values({
          tenantId: linkedContact.tenantId,
          direction: 'INBOUND',
          channel: 'EMAIL',
          actionId: linkedAction?.id || null,
          contactId: linkedContact.id,
          invoiceId: linkedInvoice?.id || null,
          inboundToEmail: to,
          inboundFromEmail: fromEmail,
          inboundFromName: extractName(from),
          inboundSubject: subject || '(No Subject)',
          inboundText: text || null,
          inboundHtml: html || null,
          inboundHeaders: { envelope },
          threadKey,
          replyToken: replyToken || null,
          status: 'RECEIVED',
          receivedAt: new Date(),
        })
        .returning();

      console.log(`✅ Inbound email stored in emailMessages: ${emailMessage.id}`);
      
      // Also store in legacy inboundMessages table for backward compatibility
      const [legacyMessage] = await db
        .insert(inboundMessages)
        .values({
          tenantId: linkedContact.tenantId,
          contactId: linkedContact.id,
          channel: 'email',
          from: fromEmail,
          to: to,
          subject: subject,
          content: text || html,
          rawPayload: {
            from,
            to,
            subject,
            text,
            html,
            envelope,
            emailMessageId: emailMessage.id
          },
        })
        .returning();

      console.log(`✅ Legacy inbound message stored: ${legacyMessage.id}`);

      // Record email reply signal
      const { signalCollector } = await import("../lib/signal-collector");
      signalCollector.recordChannelEvent({
        contactId: linkedContact.id,
        tenantId: linkedContact.tenantId,
        channel: 'email',
        eventType: 'replied',
        timestamp: new Date(),
      }).catch(err => console.error('Failed to record email signal:', err));

      // Trigger outcome detection asynchronously
      processInboundEmailOutcome(emailMessage.id, text || html || '', linkedContact, linkedAction, linkedInvoice).catch(err => 
        console.error('❌ Outcome detection error:', err)
      );
      
      // Trigger legacy intent analysis asynchronously
      intentAnalyst.processInboundMessage(legacyMessage.id).catch(err => 
        console.error('❌ Intent analysis error:', err)
      );

      res.status(200).json({ 
        message: 'Email received', 
        emailMessageId: emailMessage.id,
        legacyMessageId: legacyMessage.id 
      });

    } catch (error) {
      console.error('❌ SendGrid webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Vonage SMS Inbound Webhook
   * https://developer.vonage.com/en/messaging/sms/guides/inbound-sms
   */
  app.post("/api/webhooks/vonage/sms", async (req: Request, res: Response) => {
    try {
      console.log('📱 Received inbound SMS webhook from Vonage');
      
      const {
        msisdn,      // Sender's phone number
        to,          // Recipient (your Vonage number)
        text,        // Message content
        'message-id': messageId,
        'message-timestamp': timestamp
      } = req.body;

      if (!msisdn || !text) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Normalize phone number
      const fromPhone = normalizePhone(msisdn);
      
      // Find contact by phone
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.phone, fromPhone))
        .limit(1);

      if (!contact) {
        console.log(`⚠️  No contact found for phone: ${fromPhone}`);
        return res.status(200).json({ message: 'No matching contact' });
      }

      // Store inbound message
      const [message] = await db
        .insert(inboundMessages)
        .values({
          tenantId: contact.tenantId,
          contactId: contact.id,
          channel: 'sms',
          from: fromPhone,
          to: to,
          content: text,
          providerMessageId: messageId,
          rawPayload: req.body,
        })
        .returning();

      console.log(`✅ Inbound SMS stored: ${message.id}`);

      // Record SMS reply signal
      const { signalCollector } = await import("../lib/signal-collector");
      signalCollector.recordChannelEvent({
        contactId: contact.id,
        tenantId: contact.tenantId,
        channel: 'sms',
        eventType: 'replied',
        timestamp: new Date(),
      }).catch(err => console.error('Failed to record SMS signal:', err));

      // Trigger intent analysis
      intentAnalyst.processInboundMessage(message.id).catch(err => 
        console.error('❌ Intent analysis error:', err)
      );

      res.status(200).json({ 
        message: 'SMS received', 
        messageId: message.id 
      });

    } catch (error) {
      console.error('❌ Vonage SMS webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Vonage WhatsApp Inbound Webhook
   * https://developer.vonage.com/en/messages/concepts/whatsapp
   */
  app.post("/api/webhooks/vonage/whatsapp", async (req: Request, res: Response) => {
    try {
      console.log('💬 Received inbound WhatsApp webhook from Vonage');
      
      const {
        from,        // Sender's WhatsApp number
        to,          // Recipient
        message,     // Message object
        message_uuid
      } = req.body;

      const messageText = message?.content?.text || '';

      if (!from || !messageText) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Normalize phone number
      const fromPhone = normalizePhone(from);
      
      // Find contact by phone
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.phone, fromPhone))
        .limit(1);

      if (!contact) {
        console.log(`⚠️  No contact found for WhatsApp: ${fromPhone}`);
        return res.status(200).json({ message: 'No matching contact' });
      }

      // Store inbound message
      const [msg] = await db
        .insert(inboundMessages)
        .values({
          tenantId: contact.tenantId,
          contactId: contact.id,
          channel: 'whatsapp',
          from: fromPhone,
          to: to,
          content: messageText,
          providerMessageId: message_uuid,
          rawPayload: req.body,
        })
        .returning();

      console.log(`✅ Inbound WhatsApp stored: ${msg.id}`);

      // Record WhatsApp reply signal
      const { signalCollector } = await import("../lib/signal-collector");
      signalCollector.recordChannelEvent({
        contactId: contact.id,
        tenantId: contact.tenantId,
        channel: 'whatsapp',
        eventType: 'replied',
        timestamp: new Date(),
      }).catch(err => console.error('Failed to record WhatsApp signal:', err));

      // Trigger intent analysis
      intentAnalyst.processInboundMessage(msg.id).catch(err => 
        console.error('❌ Intent analysis error:', err)
      );

      res.status(200).json({ 
        message: 'WhatsApp message received', 
        messageId: msg.id 
      });

    } catch (error) {
      console.error('❌ Vonage WhatsApp webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Retell AI Voice Transcript Webhook
   * Receives call transcripts after voice interactions
   */
  app.post("/api/webhooks/retell/transcript", async (req: Request, res: Response) => {
    try {
      console.log('🎙️  Received voice transcript webhook from Retell');
      console.log('📦 Webhook payload:', JSON.stringify(req.body, null, 2));
      
      // Retell sends data nested in a 'call' object
      const callData = req.body.call || req.body;
      
      const {
        call_id,
        from_number,
        to_number,
        transcript,
        call_analysis,
        metadata
      } = callData;

      if (!from_number || !transcript) {
        console.error('❌ Missing required fields in Retell webhook:', { from_number, transcript, payload: req.body });
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Normalize phone number
      const fromPhone = normalizePhone(from_number);
      
      // Find contact by phone
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.phone, fromPhone))
        .limit(1);

      if (!contact) {
        console.log(`⚠️  No contact found for voice call: ${fromPhone}`);
        return res.status(200).json({ message: 'No matching contact' });
      }

      // Extract transcript text (handle both string and array formats)
      let transcriptText = transcript;
      if (typeof transcript === 'object' && Array.isArray(transcript)) {
        transcriptText = transcript.map((t: any) => t.content || '').join('\n');
      } else if (typeof transcript === 'object' && !Array.isArray(transcript)) {
        transcriptText = JSON.stringify(transcript);
      }

      // Store inbound message with transcript
      const [message] = await db
        .insert(inboundMessages)
        .values({
          tenantId: contact.tenantId,
          contactId: contact.id,
          channel: 'voice',
          from: fromPhone,
          to: to_number,
          content: transcriptText,
          providerMessageId: call_id,
          rawPayload: {
            call_id,
            transcript,
            call_analysis,
            metadata
          },
        })
        .returning();

      console.log(`✅ Voice transcript stored: ${message.id}`);

      // Record call answered signal (if we got a transcript, call was answered)
      const { signalCollector } = await import("../lib/signal-collector");
      signalCollector.recordChannelEvent({
        contactId: contact.id,
        tenantId: contact.tenantId,
        channel: 'call',
        eventType: 'answered',
        timestamp: new Date(),
      }).catch(err => console.error('Failed to record voice call signal:', err));

      // Trigger intent analysis
      intentAnalyst.processInboundMessage(message.id).catch(err => 
        console.error('❌ Intent analysis error:', err)
      );

      res.status(200).json({ 
        message: 'Transcript received', 
        messageId: message.id 
      });

    } catch (error) {
      console.error('❌ Retell webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * SendGrid Event Webhook (Outbound Email Tracking)
   * Tracks: delivered, opened, clicked, bounced, dropped, etc.
   * https://docs.sendgrid.com/for-developers/tracking-events/event
   */
  app.post("/api/webhooks/sendgrid/events", async (req: Request, res: Response) => {
    try {
      const events = Array.isArray(req.body) ? req.body : [req.body];
      const { eventBus } = await import("../lib/event-bus");
      
      for (const event of events) {
        const { 
          event: eventType,
          email,
          sg_message_id,
          timestamp,
          tenant_id, // Custom arg we'll add when sending
          action_id,
          contact_id,
          invoice_id
        } = event;

        if (!tenant_id) continue;

        const idempotencyKey = eventBus.generateIdempotencyKey(
          tenant_id,
          'contact.outcome',
          sg_message_id || `${email}-${timestamp}`
        );

        await eventBus.publishContactOutcome({
          type: 'contact.outcome',
          tenantId: tenant_id,
          contactId: contact_id,
          invoiceId: invoice_id,
          actionId: action_id,
          idempotencyKey,
          channel: 'email',
          outcome: eventType, // delivered, open, click, bounce, etc.
          providerMessageId: sg_message_id,
          payload: event,
          eventTimestamp: new Date(timestamp * 1000),
        }).catch(err => console.error('Failed to log SendGrid outcome:', err));
      }

      res.status(200).json({ message: 'Events processed' });
    } catch (error) {
      console.error('❌ SendGrid events webhook error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  /**
   * Vonage Delivery Receipt Webhook (Outbound SMS/WhatsApp Tracking)
   * https://developer.vonage.com/en/messaging/sms/guides/delivery-receipts
   */
  app.post("/api/webhooks/vonage/delivery-receipt", async (req: Request, res: Response) => {
    try {
      const {
        msisdn, // Recipient phone
        to, // Sender
        status, // delivered, failed, expired, etc.
        'message-id': messageId,
        'message-timestamp': timestamp,
        'client-ref': clientRef // We'll use this to store tenant_id:action_id:contact_id
      } = req.body;

      if (!clientRef) {
        return res.status(200).json({ message: 'No client ref' });
      }

      // Parse client ref: "tenant_id:action_id:contact_id:invoice_id"
      const [tenantId, actionId, contactId, invoiceId] = clientRef.split(':');
      
      const { eventBus } = await import("../lib/event-bus");
      const idempotencyKey = eventBus.generateIdempotencyKey(
        tenantId,
        'contact.outcome',
        messageId
      );

      await eventBus.publishContactOutcome({
        type: 'contact.outcome',
        tenantId,
        contactId,
        invoiceId,
        actionId,
        idempotencyKey,
        channel: 'sms', // Could be whatsapp based on message type
        outcome: status, // delivered, failed, expired
        providerMessageId: messageId,
        providerStatus: status,
        payload: req.body,
        eventTimestamp: new Date(timestamp || Date.now()),
      }).catch(err => console.error('Failed to log Vonage outcome:', err));

      res.status(200).json({ message: 'Receipt processed' });
    } catch (error) {
      console.error('❌ Vonage delivery receipt webhook error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  /**
   * Retell Custom LLM Call Ended Webhook
   * Handles call completion events from Charlie voice agent
   * Captures PTP commitments, disputes, and conversation outcomes
   */
  app.post("/api/webhooks/retell/call-ended", async (req: Request, res: Response) => {
    try {
      console.log('🎙️  [WEBHOOK] Received call-ended webhook from Retell');
      
      // Handle nested call data structure
      const callData = req.body?.call || req.body;
      if (!callData || typeof callData !== 'object') {
        console.log('⚠️  [WEBHOOK] Invalid call data structure');
        return res.status(200).json({ message: 'Invalid payload' });
      }
      
      const {
        call_id,
        call_status,
        end_timestamp,
        start_timestamp,
        transcript,
        call_analysis,
        metadata,
        retell_llm_dynamic_variables,
        disconnection_reason,
        recording_url
      } = callData;

      // Extract metadata (could be in metadata or retell_llm_dynamic_variables)
      const callMetadata = metadata || retell_llm_dynamic_variables || {};
      
      if (!callMetadata.tenant_id || !callMetadata.contact_id) {
        console.log('⚠️  [WEBHOOK] Missing tenant or contact in call metadata');
        return res.status(200).json({ message: 'Missing metadata' });
      }

      const tenantId = callMetadata.tenant_id;
      const contactId = callMetadata.contact_id;
      const actionId = callMetadata.action_id;
      const linkedInvoiceIds: string[] = callMetadata.invoice_id ? [callMetadata.invoice_id] : [];

      const { storage } = await import("../storage");
      const { eventBus } = await import("../lib/event-bus");
      const { WorkStateService } = await import("../services/workStateService");
      const { AttentionItemService } = await import("../services/attentionItemService");
      const workStateService = new WorkStateService();
      const attentionService = new AttentionItemService();

      // Calculate duration
      const durationSeconds = start_timestamp && end_timestamp
        ? Math.round((end_timestamp - start_timestamp) / 1000)
        : 0;

      // Map Retell status to voiceStatus (same logic as polling)
      let voiceStatus: 'completed' | 'no_answer' | 'busy' | 'voicemail' | 'failed' | 'in_progress' = 'completed';
      const disconnectReason = disconnection_reason || '';
      
      if (call_status === 'ended') {
        if (disconnectReason.includes('no_answer') || disconnectReason === 'no_audio_timeout') {
          voiceStatus = 'no_answer';
        } else if (disconnectReason.includes('busy') || disconnectReason === 'line_busy') {
          voiceStatus = 'busy';
        } else if (disconnectReason.includes('voicemail') || disconnectReason === 'voicemail_reached') {
          voiceStatus = 'voicemail';
        } else if (disconnectReason.includes('fail') || disconnectReason === 'call_transfer_failed') {
          voiceStatus = 'failed';
        } else {
          voiceStatus = 'completed';
        }
      } else if (call_status === 'error') {
        voiceStatus = 'failed';
      }

      console.log(`🎙️  [WEBHOOK] Call ${call_id} - status: ${voiceStatus}, duration: ${durationSeconds}s`);

      // Prepare transcript snippets
      let transcriptText = '';
      let transcriptArray: Array<{role: string; content: string}> = [];
      
      if (typeof transcript === 'string') {
        transcriptText = transcript;
      } else if (Array.isArray(transcript)) {
        transcriptArray = transcript.filter(
          (t: any) => t && typeof t === 'object' && typeof t.role === 'string' && typeof t.content === 'string'
        );
        transcriptText = transcriptArray.map(t => `${t.role}: ${t.content}`).join('\n');
      }

      const transcriptSnippet = transcriptText ? transcriptText.substring(0, 500) : null;
      const summarySnippet = call_analysis?.call_summary?.substring(0, 240) || null;

      // Check if action exists and hasn't been processed yet (idempotency)
      if (actionId) {
        const [existingAction] = await db.select()
          .from(actions)
          .where(and(
            eq(actions.id, actionId),
            eq(actions.tenantId, tenantId)
          ))
          .limit(1);

        if (existingAction?.voiceProcessedAt) {
          console.log(`🎙️  [WEBHOOK] Call ${call_id} already processed at ${existingAction.voiceProcessedAt}, skipping`);
          return res.status(200).json({ message: 'Already processed', call_id });
        }

        // Update action with voice tracking fields
        await db.update(actions)
          .set({
            voiceStatus,
            voiceCompletedAt: new Date(),
            voiceTranscriptSnippet: transcriptSnippet,
            voiceSummarySnippet: summarySnippet,
            voiceRecordingUrl: recording_url || null,
            voiceLastPolledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(actions.id, actionId));
      }

      // HANDLE NON-COMPLETED STATUSES (no_answer, busy, voicemail → COOLDOWN)
      if (['no_answer', 'busy', 'voicemail'].includes(voiceStatus) && actionId) {
        // Write REPLY_RECEIVED audit event
        await workStateService.emitAuditEvent({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || undefined,
          actionId,
          type: 'REPLY_RECEIVED',
          summary: `AI call — ${voiceStatus === 'no_answer' ? 'No answer' : voiceStatus === 'busy' ? 'Busy' : 'Voicemail'}${durationSeconds > 0 ? ` (${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s)` : ''}`,
          payload: {
            channel: 'VOICE',
            provider: 'RETELL',
            callId: call_id,
            status: voiceStatus,
            durationSeconds,
            linkedInvoiceIds,
          },
          actor: 'SYSTEM',
        });

        // Get cooldown policy
        const policy = await workStateService.getPolicy(tenantId);
        const cooldownDays = policy?.cooldownDays || 2;
        const cooldownUntil = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000);

        // Update action to COOLDOWN
        await db.update(actions)
          .set({
            workState: 'IN_FLIGHT',
            inFlightState: 'COOLDOWN',
            cooldownUntil,
            voiceProcessedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(actions.id, actionId));

        // Emit STATE_CHANGED
        await workStateService.emitAuditEvent({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || undefined,
          actionId,
          type: 'STATE_CHANGED',
          summary: `Action entered cooldown (${cooldownDays} days) after ${voiceStatus}`,
          payload: { cooldownDays, cooldownUntil, voiceStatus },
          actor: 'SYSTEM',
        });

        console.log(`🎙️  [WEBHOOK] ${voiceStatus} → COOLDOWN for ${cooldownDays} days`);

        return res.status(200).json({
          message: 'Call ended processed',
          call_id,
          voiceStatus,
          workState: 'IN_FLIGHT',
          inFlightState: 'COOLDOWN'
        });
      }

      // HANDLE FAILED STATUS → ATTENTION
      if (voiceStatus === 'failed' && actionId) {
        // Write REPLY_RECEIVED audit event
        await workStateService.emitAuditEvent({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || undefined,
          actionId,
          type: 'REPLY_RECEIVED',
          summary: `AI call — Failed`,
          payload: {
            channel: 'VOICE',
            provider: 'RETELL',
            callId: call_id,
            status: voiceStatus,
            disconnectionReason: disconnectReason,
            linkedInvoiceIds,
          },
          actor: 'SYSTEM',
        });

        // Create attention item
        await attentionService.createItem({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || null,
          type: 'DELIVERY_FAILED',
          title: 'Voice call delivery failed',
          description: `Call failed: ${disconnectReason || 'Unknown reason'}`,
          severity: 'medium',
        });

        // Update action to ATTENTION
        await db.update(actions)
          .set({
            workState: 'ATTENTION',
            inFlightState: 'DELIVERY_FAILED',
            voiceProcessedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(actions.id, actionId));

        // Emit ROUTED_TO_ATTENTION
        await workStateService.emitAuditEvent({
          tenantId,
          debtorId: contactId,
          invoiceId: linkedInvoiceIds[0] || undefined,
          actionId,
          type: 'ROUTED_TO_ATTENTION',
          summary: 'Call delivery failed, routed to attention',
          payload: { attentionItemType: 'DELIVERY_FAILED', disconnectionReason: disconnectReason },
          actor: 'SYSTEM',
        });

        console.log(`🎙️  [WEBHOOK] failed → ATTENTION (DELIVERY_FAILED)`);

        return res.status(200).json({
          message: 'Call ended processed',
          call_id,
          voiceStatus,
          workState: 'ATTENTION',
          inFlightState: 'DELIVERY_FAILED'
        });
      }

      // COMPLETED CALL - Extract intent and process outcome
      // Extract captured PTP from call analysis or transcript
      let capturedPtp: { amount?: string; date?: string } | null = null;
      let capturedDispute: string | null = null;
      let callOutcome = 'completed';

      // Check call_analysis for structured data (with type guards)
      if (call_analysis && typeof call_analysis === 'object') {
        if (call_analysis.ptp_captured) {
          capturedPtp = {
            amount: typeof call_analysis.ptp_amount === 'string' ? call_analysis.ptp_amount : undefined,
            date: typeof call_analysis.ptp_date === 'string' ? call_analysis.ptp_date : undefined
          };
          callOutcome = 'ptp_captured';
        }
        if (call_analysis.dispute_raised) {
          capturedDispute = typeof call_analysis.dispute_details === 'string' 
            ? call_analysis.dispute_details 
            : 'Dispute raised during call';
          callOutcome = 'dispute_raised';
        }
        if (call_analysis.refused_to_pay) {
          callOutcome = 'refused';
        }
        if (call_analysis.wrong_person) {
          callOutcome = 'wrong_contact';
        }
      }

      // Parse transcript for PTP if not already in analysis (using transcriptText from above)
      if (!capturedPtp && transcriptText) {
        // Look for payment commitment patterns
        const ptpDatePattern = /(?:pay|commit|promise).*?(?:by|on|before)\s+(\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)?|\w+day|tomorrow|next\s+\w+)/i;
        const ptpAmountPattern = /(?:pay|commit|promise).*?(?:£|GBP)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i;
        
        const dateMatch = transcriptText.match(ptpDatePattern);
        const amountMatch = transcriptText.match(ptpAmountPattern);
        
        if (dateMatch || amountMatch) {
          capturedPtp = {
            amount: amountMatch ? amountMatch[1] : undefined,
            date: dateMatch ? dateMatch[1] : undefined
          };
          callOutcome = 'ptp_captured';
        }

        // Look for dispute patterns
        const disputePattern = /(?:dispute|wrong|incorrect|problem|issue|not received|never got)/i;
        if (disputePattern.test(transcriptText)) {
          const disputeMatch = transcriptArray.find(t => 
            t.role === 'user' && disputePattern.test(t.content)
          );
          if (disputeMatch) {
            capturedDispute = disputeMatch.content;
            if (callOutcome === 'completed') {
              callOutcome = 'dispute_raised';
            }
          } else if (!capturedDispute && disputePattern.test(transcriptText)) {
            // Fallback for string transcript
            capturedDispute = 'Dispute mentioned during call';
            if (callOutcome === 'completed') {
              callOutcome = 'dispute_raised';
            }
          }
        }
      }

      // If PTP was captured, create promise-to-pay record
      if (capturedPtp && (capturedPtp.amount || capturedPtp.date) && callMetadata.invoice_id) {
        try {
          // Get contact details for the PTP record
          const contact = await storage.getContact(callMetadata.contact_id, callMetadata.tenant_id);
          if (contact) {
            await storage.createPromiseToPay({
              tenantId: callMetadata.tenant_id,
              invoiceId: callMetadata.invoice_id,
              contactId: callMetadata.contact_id,
              amount: capturedPtp.amount || callMetadata.invoice_amount || '0',
              promisedDate: capturedPtp.date ? new Date(capturedPtp.date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              paymentMethod: 'bank_transfer',
              contactName: contact.name || 'Unknown',
              contactEmail: contact.email || undefined,
              contactPhone: contact.phone || undefined,
              notes: `Captured via Charlie voice call ${call_id}`,
            });
            console.log(`✅ PTP recorded from voice call: ${capturedPtp.amount} by ${capturedPtp.date}`);
          }
        } catch (err) {
          console.error('Failed to create PTP from voice call:', err);
        }
      }

      // If dispute was raised, create dispute record
      if (capturedDispute && callMetadata.invoice_id) {
        try {
          // Get contact details for the dispute record
          const contact = await storage.getContact(callMetadata.contact_id, callMetadata.tenant_id);
          if (contact) {
            const responseDue = new Date();
            responseDue.setDate(responseDue.getDate() + 14); // 14 days to respond
            
            await storage.createDispute({
              tenantId: callMetadata.tenant_id,
              invoiceId: callMetadata.invoice_id,
              contactId: callMetadata.contact_id,
              type: 'other',
              summary: capturedDispute,
              buyerContactName: contact.name || 'Unknown',
              buyerContactEmail: contact.email || undefined,
              buyerContactPhone: contact.phone || undefined,
              responseDueAt: responseDue,
            });
            console.log(`✅ Dispute recorded from voice call: ${capturedDispute.substring(0, 50)}...`);
          }
        } catch (err) {
          console.error('Failed to create dispute from voice call:', err);
        }
      }

      // Publish outcome to event bus
      const idempotencyKey = eventBus.generateIdempotencyKey(
        callMetadata.tenant_id,
        'contact.outcome',
        `charlie-voice-${call_id}`
      );

      await eventBus.publishContactOutcome({
        type: 'contact.outcome',
        tenantId: callMetadata.tenant_id,
        contactId: callMetadata.contact_id,
        invoiceId: callMetadata.invoice_id,
        actionId: callMetadata.action_id,
        idempotencyKey,
        channel: 'voice',
        outcome: callOutcome,
        providerMessageId: call_id,
        providerStatus: call_status,
        payload: {
          call_id,
          call_status,
          ptp_captured: capturedPtp,
          dispute_raised: capturedDispute,
          call_analysis,
          transcript_length: transcript?.length || 0
        },
        eventTimestamp: end_timestamp ? new Date(end_timestamp) : new Date(),
      }).catch(err => console.error('Failed to publish voice call outcome:', err));

      // Process outcome to create follow-up actions (only for actionable outcomes)
      const actionableOutcomes = ['ptp_captured', 'dispute_raised', 'callback_requested', 'wrong_contact', 'refused'];
      if (actionableOutcomes.includes(callOutcome)) {
        const { communicationOutcomeProcessor } = await import("../services/communicationOutcomeProcessor");
        await communicationOutcomeProcessor.processFromEvent({
          tenantId: callMetadata.tenant_id,
          contactId: callMetadata.contact_id,
          invoiceId: callMetadata.invoice_id,
          actionId: callMetadata.action_id,
          channel: 'voice',
          outcome: callOutcome,
          idempotencyKey: `voice-${call_id}`,
          payload: {
            ptp_captured: capturedPtp,
            dispute_raised: capturedDispute,
            callback_time: call_analysis?.callback_time,
          },
        }).catch(err => console.error('Failed to process outcome:', err));
      }

      console.log(`🎙️  [WEBHOOK] Outcome extracted: ${callOutcome}`);

      // For completed calls, create detected outcome and route via workStateService
      if (voiceStatus === 'completed' && actionId) {
        const summaryText = call_analysis?.call_summary || '';

        // Check if we have content to extract from
        if (!transcriptText && !summaryText) {
          console.log(`🎙️  [WEBHOOK] No transcript/summary for call ${call_id} - marking for attention`);
          
          // Emit audit event for missing transcript
          await workStateService.emitAuditEvent({
            tenantId,
            debtorId: contactId,
            invoiceId: linkedInvoiceIds[0] || undefined,
            actionId,
            type: 'REPLY_RECEIVED',
            summary: 'AI call completed - transcript missing',
            payload: {
              channel: 'VOICE',
              provider: 'RETELL',
              callId: call_id,
              status: voiceStatus,
              issue: 'transcript_missing',
            },
            actor: 'SYSTEM',
          });

          // Update action to ATTENTION
          await db.update(actions)
            .set({
              workState: 'ATTENTION',
              inFlightState: 'DATA_QUALITY',
              voiceProcessedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(actions.id, actionId));

          // Emit ROUTED_TO_ATTENTION
          await workStateService.emitAuditEvent({
            tenantId,
            debtorId: contactId,
            invoiceId: linkedInvoiceIds[0] || undefined,
            actionId,
            type: 'ROUTED_TO_ATTENTION',
            summary: 'Transcript missing, routed to attention for manual review',
            payload: { attentionItemType: 'DATA_QUALITY', subtype: 'VOICE_TRANSCRIPT_MISSING' },
            actor: 'SYSTEM',
          });

          console.log(`🎙️  [WEBHOOK] completed but no transcript → ATTENTION`);

          return res.status(200).json({
            message: 'Call ended processed',
            call_id,
            voiceStatus,
            workState: 'ATTENTION',
            transcriptMissing: true
          });
        }

        // Check if outcome already exists for this call (skip OpenAI if duplicate)
        const [existingOutcome] = await db.select()
          .from(outcomes)
          .where(and(
            eq(outcomes.sourceMessageId, call_id),
            eq(outcomes.sourceChannel, 'VOICE'),
            eq(outcomes.tenantId, tenantId)
          ))
          .limit(1);

        if (existingOutcome) {
          console.log(`🎙️  [WEBHOOK] Outcome already exists for call ${call_id}, skipping OpenAI analysis`);
          
          // Check if action was already processed (voiceProcessedAt set)
          const [currentAction] = await db.select()
            .from(actions)
            .where(eq(actions.id, actionId))
            .limit(1);

          // If NOT already processed, we need to complete routing (crash recovery scenario)
          if (currentAction && !currentAction.voiceProcessedAt) {
            console.log(`🎙️  [WEBHOOK] Outcome exists but action not processed - completing routing`);
            
            // Route the existing outcome
            await workStateService.processOutcome(existingOutcome);
            
            // Emit audit event for crash recovery
            await workStateService.emitAuditEvent({
              tenantId,
              debtorId: contactId,
              invoiceId: linkedInvoiceIds[0] || undefined,
              actionId,
              type: 'REPLY_RECEIVED',
              summary: `AI call — Completed (${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s) [recovered]`,
              payload: {
                channel: 'VOICE',
                provider: 'RETELL',
                callId: call_id,
                status: voiceStatus,
                outcomeId: existingOutcome.id,
                recovered: true,
              },
              actor: 'SYSTEM',
            });
          }
          
          // Update voiceProcessedAt for idempotency
          await db.update(actions)
            .set({
              voiceProcessedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(actions.id, actionId));

          // Fetch updated action for response
          const [updatedAction] = await db.select()
            .from(actions)
            .where(eq(actions.id, actionId))
            .limit(1);

          return res.status(200).json({
            message: 'Call ended processed (existing outcome)',
            call_id,
            voiceStatus,
            workState: updatedAction?.workState,
            outcomeType: existingOutcome.type,
            duplicate: true,
            recovered: !currentAction?.voiceProcessedAt
          });
        }

        // Run intent extraction with OpenAI
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const contentToAnalyze = transcriptText || summaryText;
        const currentDate = new Date().toISOString().split('T')[0];
        const currentYear = new Date().getFullYear();

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{
            role: "system",
            content: `Today's date is ${currentDate}. When interpreting dates mentioned in the call (like "28th February" or "next month"), use the current year ${currentYear} or the next appropriate future date.

Analyze this debt collection AI call and extract the outcome. Use these EXACT outcome types:
- PROMISE_TO_PAY: Debtor commits to pay on a specific date
- PAYMENT_IN_PROCESS: Payment is being processed, awaiting authorization, in payment run
- DISPUTE: Debtor disputes the invoice (pricing, delivery, quality issues)
- DOCS_REQUESTED: Debtor requests invoice copy, statement, PO, or remittance
- REQUEST_CALL_BACK: Debtor asks to be called back or speak to someone else
- CONTACT_ISSUE: Wrong number, contact no longer works there, etc.
- CANNOT_PAY: Debtor explicitly cannot pay (financial difficulties)
- BANK_DETAILS_CHANGE_REQUEST: Debtor wants to change bank details (ALWAYS flag for review)
- OUT_OF_OFFICE: Contact is away/on leave
- NO_RESPONSE: Debtor acknowledged but gave no commitment
- CONFIRMATION: Simple acknowledgment without commitment

Return JSON with:
- type: One of the outcome types above
- confidence: 0-100 (how confident are you)
- promisedPaymentDate: ISO date string if PTP mentioned
- promisedPaymentAmount: number if amount mentioned
- disputeCategory: PRICING|DELIVERY|QUALITY|OTHER if dispute
- docsRequested: array of INVOICE_COPY|STATEMENT|REMITTANCE|PO if docs requested
- summary: Brief 1-2 sentence summary`
          }, {
            role: "user",
            content: contentToAnalyze
          }],
          response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0].message.content || '{}');
        const outcomeType = analysis.type || 'NO_RESPONSE';
        const confidenceScore = (analysis.confidence || 70) / 100;
        const confidenceBand = confidenceScore >= 0.85 ? 'HIGH' : confidenceScore >= 0.65 ? 'MEDIUM' : 'LOW';
        const requiresHumanReview = confidenceScore < 0.65 || ['BANK_DETAILS_CHANGE_REQUEST', 'DISPUTE'].includes(outcomeType);

        // Build extracted data
        const extracted: Record<string, any> = {};
        if (analysis.promisedPaymentDate) extracted.promisedPaymentDate = analysis.promisedPaymentDate;
        if (analysis.promisedPaymentAmount) extracted.promisedPaymentAmount = analysis.promisedPaymentAmount;
        if (analysis.disputeCategory) extracted.disputeCategory = analysis.disputeCategory;
        if (analysis.docsRequested) extracted.docsRequested = analysis.docsRequested;
        if (analysis.summary) extracted.freeTextNotes = analysis.summary;

        // Idempotent outcome creation using try/catch for race conditions
        let newOutcome: any;
        let wasNewlyCreated = false;
        
        try {
          // Try to create outcome
          const [createdOutcome] = await db.insert(outcomes)
            .values({
              tenantId,
              debtorId: contactId,
              invoiceId: linkedInvoiceIds[0] || null,
              linkedInvoiceIds,
              type: outcomeType,
              confidence: String(confidenceScore.toFixed(2)),
              confidenceBand,
              requiresHumanReview,
              extracted,
              sourceChannel: 'VOICE',
              sourceMessageId: call_id,
              rawSnippet: contentToAnalyze.substring(0, 200),
            })
            .returning();
          newOutcome = createdOutcome;
          wasNewlyCreated = true;
          console.log(`🎙️  [WEBHOOK] Created outcome: ${outcomeType} (${confidenceBand})`);
        } catch (insertError: any) {
          // If duplicate key error, fetch existing outcome
          if (insertError?.message?.includes('uniq_outcomes_source') || insertError?.code === '23505') {
            const [existingOutcome] = await db.select()
              .from(outcomes)
              .where(and(
                eq(outcomes.sourceMessageId, call_id),
                eq(outcomes.sourceChannel, 'VOICE'),
                eq(outcomes.tenantId, tenantId)
              ))
              .limit(1);
            newOutcome = existingOutcome;
            console.log(`🎙️  [WEBHOOK] Outcome already exists for callId ${call_id}, using existing`);
          } else {
            throw insertError;
          }
        }

        // Process outcome and update action
        if (newOutcome) {
          // Only emit audit event and route if newly created (avoid duplicate processing)
          if (wasNewlyCreated) {
            // Write REPLY_RECEIVED audit event
            await workStateService.emitAuditEvent({
              tenantId,
              debtorId: contactId,
              invoiceId: linkedInvoiceIds[0] || undefined,
              actionId,
              type: 'REPLY_RECEIVED',
              summary: `AI call — Completed (${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s)`,
              payload: {
                channel: 'VOICE',
                provider: 'RETELL',
                callId: call_id,
                status: voiceStatus,
                durationSeconds,
                transcriptSnippet,
                summarySnippet,
                recordingUrl: recording_url,
                linkedInvoiceIds,
                outcomeId: newOutcome.id,
              },
              actor: 'SYSTEM',
            });

            // Process outcome through Loop routing
            await workStateService.processOutcome(newOutcome);
          }

          // ALWAYS update action with voiceProcessedAt (even for duplicate outcomes)
          // This ensures idempotency - subsequent webhooks will short-circuit early
          await db.update(actions)
            .set({
              voiceProcessedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(actions.id, actionId));
        }

        // Fetch updated action for response
        const [updatedAction] = await db.select()
          .from(actions)
          .where(eq(actions.id, actionId))
          .limit(1);

        console.log(`🎙️  [WEBHOOK] completed → ${updatedAction?.workState}/${updatedAction?.inFlightState || '-'} (${wasNewlyCreated ? 'new' : 'duplicate'})`);
      }

      // Update the timeline event with call results
      if (callMetadata.action_id) {
        try {
          // Map call outcome to timeline outcome type
          const outcomeTypeMap: Record<string, string> = {
            'ptp_captured': 'promise_to_pay',
            'dispute_raised': 'dispute',
            'refused': 'refused',
            'wrong_contact': 'wrong_contact',
            'completed': 'other',
            'callback_requested': 'request_more_time',
            'no_answer': 'no_response',
          };
          const timelineOutcomeType = outcomeTypeMap[callOutcome] || 'other';
          
          // Extract sentiment from call_analysis if available
          const sentiment = call_analysis?.sentiment || call_analysis?.customer_sentiment || null;
          const intent = call_analysis?.intent || call_analysis?.primary_intent || null;
          const confidenceScore = call_analysis?.confidence || 0.8;
          
          // Build extracted data for the outcome
          const extractedData: Record<string, any> = {};
          if (capturedPtp) {
            if (capturedPtp.amount) extractedData.amount = capturedPtp.amount;
            if (capturedPtp.date) extractedData.promiseDate = capturedPtp.date;
          }
          if (capturedDispute) {
            extractedData.disputeDetails = capturedDispute;
          }
          if (sentiment) {
            extractedData.sentiment = sentiment;
          }
          if (intent) {
            extractedData.intent = intent;
          }
          if (call_status) {
            extractedData.callStatus = call_status;
          }
          if (call_analysis?.call_summary) {
            extractedData.summary = call_analysis.call_summary;
          }
          if (call_analysis?.next_steps) {
            extractedData.nextSteps = call_analysis.next_steps;
          }
          
          // Update the timeline event linked to this action
          // Safe transcript text with fallback
          const safeTranscriptText = transcriptText || '';
          
          await db.update(timelineEvents)
            .set({
              status: 'transcribed',
              body: safeTranscriptText || null,
              summary: callOutcome === 'ptp_captured' ? 'AI call completed - Payment commitment received' :
                       callOutcome === 'dispute_raised' ? 'AI call completed - Dispute raised' :
                       callOutcome === 'refused' ? 'AI call completed - Payment refused' :
                       callOutcome === 'wrong_contact' ? 'AI call completed - Wrong contact' :
                       'AI call completed',
              outcomeType: timelineOutcomeType,
              outcomeConfidence: String(confidenceScore),
              outcomeExtracted: Object.keys(extractedData).length > 0 ? extractedData : null,
              outcomeRequiresReview: callOutcome === 'dispute_raised' || callOutcome === 'wrong_contact',
              provider: 'retell',
              providerMessageId: call_id,
            })
            .where(
              and(
                eq(timelineEvents.actionId, callMetadata.action_id),
                eq(timelineEvents.tenantId, callMetadata.tenant_id)
              )
            );
          
          console.log(`📝 Timeline event updated for action ${callMetadata.action_id} with call results`);
        } catch (timelineErr) {
          console.error('Failed to update timeline event with call results:', timelineErr);
        }
      }

      res.status(200).json({ 
        message: 'Call ended processed',
        call_id,
        outcome: callOutcome,
        ptp_captured: !!capturedPtp,
        dispute_raised: !!capturedDispute
      });

    } catch (error) {
      console.error('❌ Retell Custom LLM call ended webhook error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  /**
   * Retell Call Status Webhook (Outbound Voice Tracking)
   * https://docs.retellai.com/api-references/register-call
   */
  app.post("/api/webhooks/retell/call-status", async (req: Request, res: Response) => {
    try {
      const {
        call_id,
        call_status, // registered, ongoing, ended
        call_analysis, // { user_sentiment, call_successful, etc. }
        metadata // { tenant_id, action_id, contact_id, invoice_id }
      } = req.body;

      if (!metadata?.tenant_id) {
        return res.status(200).json({ message: 'No metadata' });
      }

      const { eventBus } = await import("../lib/event-bus");
      const idempotencyKey = eventBus.generateIdempotencyKey(
        metadata.tenant_id,
        'contact.outcome',
        `${call_id}-${call_status}`
      );

      // Map Retell status to our outcome
      const outcomeMap: Record<string, string> = {
        registered: 'initiated',
        ongoing: 'answered',
        ended: call_analysis?.call_successful ? 'completed' : 'failed'
      };

      await eventBus.publishContactOutcome({
        type: 'contact.outcome',
        tenantId: metadata.tenant_id,
        contactId: metadata.contact_id,
        invoiceId: metadata.invoice_id,
        actionId: metadata.action_id,
        idempotencyKey,
        channel: 'voice',
        outcome: outcomeMap[call_status] || call_status,
        providerMessageId: call_id,
        providerStatus: call_status,
        payload: { ...req.body, sentiment: call_analysis?.user_sentiment },
        eventTimestamp: new Date(),
      }).catch(err => console.error('Failed to log Retell outcome:', err));

      res.status(200).json({ message: 'Status processed' });
    } catch (error) {
      console.error('❌ Retell call status webhook error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  /**
   * Webhook status endpoint for testing
   */
  app.get("/api/webhooks/status", (req: Request, res: Response) => {
    res.json({
      status: 'active',
      webhooks: {
        sendgrid: '/api/webhooks/sendgrid/inbound?token=<INBOUND_WEBHOOK_TOKEN>',
        sendgrid_legacy: '/api/webhooks/sendgrid/inbound-legacy',
        sendgrid_events: '/api/webhooks/sendgrid/events',
        inbound_email: '/webhooks/inbound/email',
        inbound_queue_stats: '/api/webhooks/inbound/queue-stats',
        vonage_sms: '/api/webhooks/vonage/sms',
        vonage_whatsapp: '/api/webhooks/vonage/whatsapp',
        vonage_delivery: '/api/webhooks/vonage/delivery-receipt',
        retell_transcript: '/api/webhooks/retell/transcript',
        retell_call_status: '/api/webhooks/retell/call-status',
        retell_call_ended: '/api/webhooks/retell/call-ended'
      },
      custom_llm_websocket: '/retell-llm'
    });
  });

  console.log('✅ Webhook routes registered');
}

/**
 * Process normalized inbound email
 * Handles routing, contact lookup, storage, and outcome detection
 */
async function processNormalizedInboundEmail(
  email: NormalizedInboundEmail
): Promise<{ success: boolean; emailMessageId?: string; legacyMessageId?: string; error?: string }> {
  try {
    const { routing, email: emailContent, idempotency } = email;
    const fromEmail = emailContent.from.email;
    const fromName = emailContent.from.name || null;
    const to = emailContent.to.map(t => t.email).join(', ');
    const subject = emailContent.subject;
    const text = emailContent.textBody;
    const html = emailContent.htmlBody;
    
    let linkedAction: any = null;
    let linkedContact: any = null;
    let linkedInvoice: any = null;
    let linkedConversationId: string | null = null;
    
    // Use routing info if available (high or medium confidence)
    const useRouting = routing.outboundMessageId && (
      routing.confidence === 'high' || routing.confidence === 'medium'
    );
    
    // Use conversation ID from routing if available, with tenant verification
    if (routing.conversationId) {
      // Verify conversation exists and belongs to the correct tenant before using
      const [existingConversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, routing.conversationId))
        .limit(1);
      
      if (existingConversation) {
        // Store for later tenant verification after we know linkedContact
        linkedConversationId = routing.conversationId;
      } else {
        console.log(`⚠️  Conversation ${routing.conversationId} from routing not found, will create new`);
      }
    }
    
    if (useRouting) {
      console.log(`📨 Using ${routing.method} routing (${routing.confidence}): outboundMessageId=${routing.outboundMessageId}, conversationId=${routing.conversationId}`);
      
      // For reply_to_token, look up by our internal message ID
      // For in_reply_to/references, the outboundMessageId is the external Message-ID header
      let existingEmail: any = null;
      
      if (routing.method === 'reply_to_token') {
        // Direct lookup by our internal ID
        const [found] = await db
          .select()
          .from(emailMessages)
          .where(and(
            eq(emailMessages.id, routing.outboundMessageId!),
            eq(emailMessages.direction, 'OUTBOUND')
          ))
          .limit(1);
        existingEmail = found;
      } else if (routing.method === 'in_reply_to' || routing.method === 'references') {
        // Look up by external Message-ID stored in our outbound emails
        // The Message-ID is typically stored in the headers or as a separate field
        // For now, search by checking if the message-id appears in outbound headers
        const results = await db
          .select()
          .from(emailMessages)
          .where(eq(emailMessages.direction, 'OUTBOUND'))
          .limit(100);
        
        // Find email where headers contain this Message-ID
        for (const em of results) {
          const headers = em.inboundHeaders as Record<string, any> || {};
          const msgId = headers['Message-ID'] || headers['message-id'] || '';
          if (msgId.includes(routing.outboundMessageId!)) {
            existingEmail = em;
            break;
          }
        }
      }
      
      if (existingEmail) {
        // Get linked entities
        if (existingEmail.actionId) {
          const [action] = await db
            .select()
            .from(actions)
            .where(eq(actions.id, existingEmail.actionId))
            .limit(1);
          linkedAction = action;
        }
        
        if (existingEmail.invoiceId) {
          const [invoice] = await db
            .select()
            .from(invoices)
            .where(eq(invoices.id, existingEmail.invoiceId))
            .limit(1);
          linkedInvoice = invoice;
        }
        
        if (existingEmail.contactId) {
          const [contact] = await db
            .select()
            .from(contacts)
            .where(eq(contacts.id, existingEmail.contactId))
            .limit(1);
          linkedContact = contact;
        }
      }
    }
    
    // Fallback: find contact by email if no routing match
    if (!linkedContact) {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.email, fromEmail))
        .limit(1);
      linkedContact = contact;
    }
    
    if (!linkedContact) {
      console.log(`⚠️  No contact found for email: ${fromEmail}`);
      return { success: true, error: 'No matching contact' };
    }
    
    // Verify conversation belongs to same tenant as contact (prevent cross-tenant mislinking)
    if (linkedConversationId) {
      const [conv] = await db
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.id, linkedConversationId),
          eq(conversations.tenantId, linkedContact.tenantId)
        ))
        .limit(1);
      
      if (!conv) {
        console.log(`⚠️  Conversation ${linkedConversationId} does not belong to tenant ${linkedContact.tenantId}, creating new`);
        linkedConversationId = null;
      }
    }
    
    // Find or create conversation for this contact if not already linked
    if (!linkedConversationId) {
      // Look for existing open conversation
      const [existingConv] = await db
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.tenantId, linkedContact.tenantId),
          eq(conversations.contactId, linkedContact.id),
          eq(conversations.status, 'open')
        ))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(1);
      
      if (existingConv) {
        linkedConversationId = existingConv.id;
      } else {
        // Create new conversation for this inbound email
        const [newConv] = await db
          .insert(conversations)
          .values({
            tenantId: linkedContact.tenantId,
            contactId: linkedContact.id,
            subject: subject || 'Inbound correspondence',
            status: 'open',
            channel: 'email',
            messageCount: 0,
          })
          .returning();
        linkedConversationId = newConv.id;
        console.log(`📝 Created new conversation: ${linkedConversationId}`);
      }
    }
    
    // Store in emailMessages table
    const threadKey = linkedInvoice?.id ? `inv_${linkedInvoice.id}` : `cust_${linkedContact.id}`;
    
    const [emailMessage] = await db
      .insert(emailMessages)
      .values({
        tenantId: linkedContact.tenantId,
        conversationId: linkedConversationId, // Link to conversation
        direction: 'INBOUND',
        channel: 'EMAIL',
        actionId: linkedAction?.id || null,
        contactId: linkedContact.id,
        invoiceId: linkedInvoice?.id || null,
        inboundToEmail: to,
        inboundFromEmail: fromEmail,
        inboundFromName: fromName,
        inboundSubject: subject,
        inboundText: text || null,
        inboundHtml: html || null,
        inboundHeaders: emailContent.headers,
        threadKey,
        replyToken: null,
        status: 'RECEIVED',
        receivedAt: new Date(),
      })
      .returning();
    
    // Update conversation stats
    if (linkedConversationId) {
      const [conv] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, linkedConversationId))
        .limit(1);
      
      if (conv) {
        await db
          .update(conversations)
          .set({
            messageCount: (conv.messageCount || 0) + 1,
            lastMessageAt: new Date(),
            lastMessageDirection: 'inbound',
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, linkedConversationId));
      }
    }
    
    console.log(`✅ Inbound email stored: ${emailMessage.id} (conversation: ${linkedConversationId})`);
    
    // Add to timelineEvents for customer drawer display
    await db
      .insert(timelineEvents)
      .values({
        tenantId: linkedContact.tenantId,
        customerId: linkedContact.id,
        invoiceId: linkedInvoice?.id || null,
        channel: 'email',
        direction: 'inbound',
        summary: subject || '(No Subject)',
        preview: (text || html || '').substring(0, 200),
        body: text || html || null,
        status: 'received',
        occurredAt: new Date(),
        createdByType: 'external',
        createdByName: fromName || fromEmail,
        sourceId: emailMessage.id,
        sourceType: 'email_message',
      });
    console.log(`✅ Timeline event created for inbound email`);
    
    // Store in legacy inboundMessages table
    const [legacyMessage] = await db
      .insert(inboundMessages)
      .values({
        tenantId: linkedContact.tenantId,
        contactId: linkedContact.id,
        channel: 'email',
        from: fromEmail,
        to: to,
        subject: subject || '(No Subject)',
        content: text || html || '(No content)',
        rawPayload: {
          normalized: email,
          emailMessageId: emailMessage.id,
        },
      })
      .returning();
    
    console.log(`✅ Legacy inbound message stored: ${legacyMessage.id}`);
    
    // Record email reply signal
    const { signalCollector } = await import("../lib/signal-collector");
    signalCollector.recordChannelEvent({
      contactId: linkedContact.id,
      tenantId: linkedContact.tenantId,
      channel: 'email',
      eventType: 'replied',
      timestamp: new Date(),
    }).catch(err => console.error('Failed to record email signal:', err));
    
    // Trigger outcome detection asynchronously
    processInboundEmailOutcome(emailMessage.id, text || html || '', linkedContact, linkedAction, linkedInvoice)
      .catch(err => console.error('❌ Outcome detection error:', err));
    
    // Trigger legacy intent analysis asynchronously
    intentAnalyst.processInboundMessage(legacyMessage.id)
      .catch(err => console.error('❌ Intent analysis error:', err));
    
    return {
      success: true,
      emailMessageId: emailMessage.id,
      legacyMessageId: legacyMessage.id,
    };
  } catch (error) {
    console.error('❌ Error processing normalized email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Extract email from "Name <email@domain.com>" format
 */
function extractEmail(emailString: string): string {
  const match = emailString.match(/<(.+?)>/);
  return match ? match[1] : emailString.trim().toLowerCase();
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Add + prefix if not present
  if (!cleaned.startsWith('+')) {
    // Assume UK if no country code
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = '44' + cleaned.replace(/^0/, '');
    }
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

/**
 * Extract reply token from To address
 * Format: reply+TOKEN@in.qashivo.com
 */
function extractReplyToken(toAddress: string): string | null {
  if (!toAddress) return null;
  
  // Handle multiple To addresses
  const addresses = toAddress.split(',').map(a => a.trim());
  
  for (const addr of addresses) {
    const email = extractEmail(addr);
    // Match reply+TOKEN@domain or reply-TOKEN@domain
    const match = email.match(/^reply[+-]([a-zA-Z0-9_-]+)@/i);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Extract name from "Name <email@domain.com>" format
 */
function extractName(emailString: string): string | null {
  const match = emailString.match(/^(.+?)\s*</);
  if (match) {
    return match[1].replace(/"/g, '').trim() || null;
  }
  return null;
}

/**
 * Process inbound email to detect outcomes (MVP heuristics)
 */
async function processInboundEmailOutcome(
  emailMessageId: string,
  messageText: string,
  contact: any,
  action: any | null,
  invoice: any | null
): Promise<void> {
  try {
    const detection = detectOutcomeFromText(messageText);
    
    if (!detection.outcomeType) {
      console.log(`📧 No outcome detected for email ${emailMessageId}`);
      return;
    }
    
    console.log(`📧 Detected outcome: ${detection.outcomeType} (${detection.confidence})`);
    
    // Store in detectedOutcomes table
    await db
      .insert(detectedOutcomes)
      .values({
        tenantId: contact.tenantId,
        emailMessageId,
        contactId: contact.id,
        invoiceId: invoice?.id || null,
        outcomeType: detection.outcomeType,
        confidence: detection.confidence.toString(),
        amount: detection.extractedAmount || null,
        promiseDate: detection.extractedDate || null,
        notes: detection.extractedReason || null,
        needsReview: detection.confidence < 0.65,
        originalOutcomeType: detection.outcomeType,
        originalConfidence: detection.confidence.toString(),
      });
    
    // Update email message with outcome
    await db
      .update(emailMessages)
      .set({
        status: 'PARSED',
        updatedAt: new Date(),
      })
      .where(eq(emailMessages.id, emailMessageId));
    
    console.log(`✅ Outcome stored for email ${emailMessageId}`);
  } catch (error) {
    console.error('Failed to process email outcome:', error);
  }
}
