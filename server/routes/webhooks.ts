import type { Express, Request, Response } from "express";
import { db } from "../db";
import { inboundMessages, contacts, emailMessages, detectedOutcomes, actions, invoices } from "@shared/schema";
import { intentAnalyst } from "../services/intentAnalyst";
import { detectOutcomeFromText } from "../services/outcomeDetection";
import { eq, or, and } from "drizzle-orm";
import crypto from "crypto";

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
 * Webhook Routes for Inbound Communications
 * Handles: SendGrid (email), Vonage (SMS/WhatsApp), Retell (voice)
 */
export function registerWebhookRoutes(app: Express) {
  
  /**
   * SendGrid Inbound Email Webhook
   * https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
   * 
   * Enhanced to support reply token parsing for email threading
   * Security: Validates IP origin and reply token existence before processing
   */
  app.post("/api/webhooks/sendgrid/inbound", async (req: Request, res: Response) => {
    try {
      console.log('📧 Received inbound email webhook from SendGrid');
      
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
      console.log('🎙️  Received Custom LLM call ended webhook from Retell');
      
      // Handle nested call data structure
      const callData = req.body?.call || req.body;
      if (!callData || typeof callData !== 'object') {
        console.log('⚠️  Invalid call data structure');
        return res.status(200).json({ message: 'Invalid payload' });
      }
      
      const {
        call_id,
        call_status,
        end_timestamp,
        transcript,
        call_analysis,
        metadata,
        retell_llm_dynamic_variables
      } = callData;

      // Extract metadata (could be in metadata or retell_llm_dynamic_variables)
      const callMetadata = metadata || retell_llm_dynamic_variables || {};
      
      if (!callMetadata.tenant_id || !callMetadata.contact_id) {
        console.log('⚠️  Missing tenant or contact in call metadata');
        return res.status(200).json({ message: 'Missing metadata' });
      }

      const { storage } = await import("../storage");
      const { eventBus } = await import("../lib/event-bus");

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

      // Parse transcript for PTP if not in analysis
      // Handle both array of objects [{role, content}] and string format
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

      console.log(`✅ Charlie voice call processed: ${call_id} - outcome: ${callOutcome}`);

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
        sendgrid: '/api/webhooks/sendgrid/inbound',
        sendgrid_events: '/api/webhooks/sendgrid/events',
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
