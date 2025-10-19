import type { Express, Request, Response } from "express";
import { db } from "../db";
import { inboundMessages, contacts } from "@shared/schema";
import { intentAnalyst } from "../services/intentAnalyst";
import { eq, or } from "drizzle-orm";
import crypto from "crypto";

/**
 * Webhook Routes for Inbound Communications
 * Handles: SendGrid (email), Vonage (SMS/WhatsApp), Retell (voice)
 */
export function registerWebhookRoutes(app: Express) {
  
  /**
   * SendGrid Inbound Email Webhook
   * https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
   */
  app.post("/api/webhooks/sendgrid/inbound", async (req: Request, res: Response) => {
    try {
      console.log('📧 Received inbound email webhook from SendGrid');
      
      const { 
        from, 
        to, 
        subject, 
        text, 
        html,
        envelope 
      } = req.body;

      if (!from || !text) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Extract email address from "Name <email>" format
      const fromEmail = extractEmail(from);
      
      // Find contact by email
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.email, fromEmail))
        .limit(1);

      if (!contact) {
        console.log(`⚠️  No contact found for email: ${fromEmail}`);
        return res.status(200).json({ message: 'No matching contact' });
      }

      // Store inbound message
      const [message] = await db
        .insert(inboundMessages)
        .values({
          tenantId: contact.tenantId,
          contactId: contact.id,
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
            envelope
          },
        })
        .returning();

      console.log(`✅ Inbound email stored: ${message.id}`);

      // Record email reply signal
      const { signalCollector } = await import("../lib/signal-collector");
      signalCollector.recordChannelEvent({
        contactId: contact.id,
        tenantId: contact.tenantId,
        channel: 'email',
        eventType: 'replied',
        timestamp: new Date(),
      }).catch(err => console.error('Failed to record email signal:', err));

      // Trigger intent analysis asynchronously
      intentAnalyst.processInboundMessage(message.id).catch(err => 
        console.error('❌ Intent analysis error:', err)
      );

      res.status(200).json({ 
        message: 'Email received', 
        messageId: message.id 
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
        vonage_sms: '/api/webhooks/vonage/sms',
        vonage_whatsapp: '/api/webhooks/vonage/whatsapp',
        retell: '/api/webhooks/retell/transcript'
      }
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
