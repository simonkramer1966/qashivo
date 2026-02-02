/**
 * Inbound Email Normalizer Service v0.5
 * Transforms provider-specific payloads into canonical format
 * 
 * SECURITY: All secrets MUST be set via environment variables in production.
 * The fallback defaults are for development/testing only.
 * 
 * Known v0.5 Limitations:
 * - Reply token signature is 8 chars (adequate for MVP, consider 16+ for production)
 * - In-Reply-To/References routing scans limited records (needs Message-ID column)
 * - Retry queue is in-memory only (lost on restart)
 * - Invalid reply tokens fall back to heuristic routing (fail-open for UX)
 */

import crypto from 'crypto';
import type { Request } from 'express';
import { simpleParser, type ParsedMail } from 'mailparser';
import type {
  NormalizedInboundEmail,
  InboundEmailRouting,
  InboundEmailAddress,
  InboundEmailAttachment,
} from '../../shared/types/inboundEmail';

// Security: Warn if using default secrets in production
const INBOUND_WEBHOOK_TOKEN = process.env.INBOUND_WEBHOOK_TOKEN || 'kramerS123*AL&&t_UiKLLK-1678%_';
const REPLY_TOKEN_SECRET = process.env.REPLY_TOKEN_SECRET || 'qashivo-reply-token-secret-v1';
const QASHIVO_WEBHOOK_SECRET = process.env.QASHIVO_WEBHOOK_SECRET || 'qashivo-internal-webhook-secret';

if (process.env.NODE_ENV === 'production') {
  if (!process.env.INBOUND_WEBHOOK_TOKEN) {
    console.warn('⚠️ SECURITY: INBOUND_WEBHOOK_TOKEN not set - using default (unsafe in production)');
  }
  if (!process.env.REPLY_TOKEN_SECRET) {
    console.warn('⚠️ SECURITY: REPLY_TOKEN_SECRET not set - using default (unsafe in production)');
  }
  if (!process.env.QASHIVO_WEBHOOK_SECRET) {
    console.warn('⚠️ SECURITY: QASHIVO_WEBHOOK_SECRET not set - using default (unsafe in production)');
  }
}

/**
 * Verify shared-secret token from query string
 */
export function verifyInboundToken(req: Request): boolean {
  const token = req.query.token as string;
  if (!token) {
    console.warn('❌ Inbound webhook: Missing token parameter');
    return false;
  }
  
  if (token !== INBOUND_WEBHOOK_TOKEN) {
    console.warn('❌ Inbound webhook: Invalid token');
    return false;
  }
  
  return true;
}

/**
 * Parse email address from "Name <email>" format
 */
function parseEmailAddress(raw: string): InboundEmailAddress {
  if (!raw) return { email: '' };
  
  const match = raw.match(/^(?:(.+?)\s*)?<?([^<>]+@[^<>]+)>?$/);
  if (match) {
    return {
      email: match[2].trim().toLowerCase(),
      name: match[1]?.trim() || undefined,
    };
  }
  
  return { email: raw.trim().toLowerCase() };
}

/**
 * Parse multiple email addresses from comma-separated string
 */
function parseEmailAddresses(raw: string | undefined): InboundEmailAddress[] {
  if (!raw) return [];
  
  return raw.split(',').map(addr => parseEmailAddress(addr.trim())).filter(a => a.email);
}

/**
 * Reply token format: reply+{tenantId}.{conversationId}.{outboundMessageId}.{sig}@in.qashivo.com
 */
interface ParsedReplyToken {
  tenantId: string;
  conversationId: string;
  outboundMessageId: string;
  signature: string;
}

/**
 * Generate HMAC signature for reply token
 */
export function generateReplyTokenSignature(tenantId: string, conversationId: string, outboundMessageId: string): string {
  const payload = `${tenantId}.${conversationId}.${outboundMessageId}`;
  return crypto.createHmac('sha256', REPLY_TOKEN_SECRET)
    .update(payload)
    .digest('base64url')
    .substring(0, 8);
}

/**
 * Verify reply token HMAC signature
 * Returns false if signature length doesn't match or verification fails
 */
function verifyReplyTokenSignature(token: ParsedReplyToken): boolean {
  const expectedSig = generateReplyTokenSignature(token.tenantId, token.conversationId, token.outboundMessageId);
  
  // Check signature length first (must be exactly 8 chars)
  if (token.signature.length !== 8 || expectedSig.length !== 8) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token.signature),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

/**
 * Parse reply token from email address
 * Format: reply+{tenantId}.{conversationId}.{outboundMessageId}.{sig}@in.qashivo.com
 */
function parseReplyToken(toAddress: string): ParsedReplyToken | null {
  const match = toAddress.match(/reply\+([^@]+)@/i);
  if (!match) return null;
  
  const parts = match[1].split('.');
  if (parts.length !== 4) return null;
  
  return {
    tenantId: parts[0],
    conversationId: parts[1],
    outboundMessageId: parts[2],
    signature: parts[3],
  };
}

/**
 * Extract routing information from various sources
 */
function extractRouting(
  toAddresses: string[],
  headers: Record<string, string>
): InboundEmailRouting {
  console.log(`🔍 Extracting routing from ${toAddresses.length} addresses:`, toAddresses);
  
  // Try reply token first (highest confidence)
  for (const to of toAddresses) {
    console.log(`🔍 Checking address for reply token: ${to}`);
    const token = parseReplyToken(to);
    if (token) {
      console.log(`🔍 Parsed reply token:`, {
        tenantId: token.tenantId,
        conversationId: token.conversationId,
        outboundMessageId: token.outboundMessageId,
        signature: token.signature,
      });
      try {
        const expectedSig = generateReplyTokenSignature(token.tenantId, token.conversationId, token.outboundMessageId);
        console.log(`🔍 Signature check: expected=${expectedSig}, received=${token.signature}`);
        
        if (verifyReplyTokenSignature(token)) {
          console.log(`✅ Reply token signature verified successfully`);
          return {
            method: 'reply_to_token',
            confidence: 'high',
            tenantId: token.tenantId,
            conversationId: token.conversationId,
            outboundMessageId: token.outboundMessageId,
          };
        } else {
          console.warn(`⚠️ Reply token signature verification failed: expected=${expectedSig}, got=${token.signature}`);
        }
      } catch (err) {
        console.warn('⚠️ Reply token signature verification error:', err);
      }
    } else {
      console.log(`🔍 No reply token found in: ${to}`);
    }
  }
  
  // Try In-Reply-To header
  const inReplyTo = headers['in-reply-to'] || headers['In-Reply-To'];
  if (inReplyTo) {
    const messageIdMatch = inReplyTo.match(/<([^>]+)>/);
    if (messageIdMatch) {
      return {
        method: 'in_reply_to',
        confidence: 'medium',
        outboundMessageId: messageIdMatch[1],
      };
    }
  }
  
  // Try References header
  const references = headers['references'] || headers['References'];
  if (references) {
    const refs = references.match(/<([^>]+)>/g);
    if (refs && refs.length > 0) {
      const lastRef = refs[refs.length - 1].replace(/<|>/g, '');
      return {
        method: 'references',
        confidence: 'medium',
        outboundMessageId: lastRef,
      };
    }
  }
  
  // Fallback to heuristic (from email lookup)
  return {
    method: 'heuristic',
    confidence: 'low',
  };
}

/**
 * Compute SHA-256 hash of content
 */
function sha256(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Extract attachments from SendGrid multipart payload
 */
function extractSendGridAttachments(body: any): InboundEmailAttachment[] {
  const attachments: InboundEmailAttachment[] = [];
  
  // SendGrid sends attachment info in 'attachment-info' and 'attachmentN' fields
  const attachmentInfo = body['attachment-info'];
  if (!attachmentInfo) return attachments;
  
  try {
    const info = typeof attachmentInfo === 'string' ? JSON.parse(attachmentInfo) : attachmentInfo;
    
    for (const [key, meta] of Object.entries(info as Record<string, any>)) {
      const attachmentContent = body[key];
      const content = attachmentContent ? Buffer.from(attachmentContent) : Buffer.alloc(0);
      
      attachments.push({
        filename: meta.filename || key,
        contentType: meta['content-type'] || meta.type || 'application/octet-stream',
        size: content.length,
        sha256: sha256(content),
        contentRef: undefined, // Will be set after blob storage
      });
    }
  } catch (err) {
    console.error('Failed to parse attachment info:', err);
  }
  
  return attachments;
}

/**
 * Generate idempotency key for SendGrid email
 * Uses stable fields only - no timestamps to ensure duplicates are detected
 */
function generateIdempotencyKey(body: any): string {
  // Prefer Message-ID header if available (most reliable)
  const headers = body.headers;
  if (headers) {
    try {
      const parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers;
      const messageId = parsedHeaders['Message-ID'] || parsedHeaders['message-id'];
      if (messageId) {
        return `sendgrid:${messageId.replace(/<|>/g, '')}`;
      }
    } catch {}
  }
  
  // Fall back to hash of stable fields only (no timestamp!)
  // These fields uniquely identify an email without timestamp
  const envelope = typeof body.envelope === 'string' ? body.envelope : JSON.stringify(body.envelope || {});
  const from = body.from || '';
  const to = body.to || '';
  const subject = body.subject || '';
  const textPreview = (body.text || body.html || '').substring(0, 200);
  
  const hash = sha256(`${envelope}${from}${to}${subject}${textPreview}`).substring(0, 32);
  return `sendgrid:hash:${hash}`;
}

/**
 * Parse raw headers from SendGrid
 */
function parseHeaders(rawHeaders: string | Record<string, string> | undefined): Record<string, string> {
  if (!rawHeaders) return {};
  
  if (typeof rawHeaders === 'object') return rawHeaders;
  
  try {
    return JSON.parse(rawHeaders);
  } catch {
    // Parse raw header format (key: value\n)
    const headers: Record<string, string> = {};
    const lines = rawHeaders.split(/\r?\n/);
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }
    
    return headers;
  }
}

/**
 * Store raw payload to object storage (placeholder for v0.5)
 */
async function storeRawPayload(payload: any): Promise<string | undefined> {
  // For v0.5, we just return undefined - actual blob storage can be added later
  // In production, this would store to object storage and return the ref
  return undefined;
}

/**
 * Parse raw MIME content to extract text/html body
 * SendGrid sometimes only provides raw MIME in body.email field
 */
async function parseRawMimeContent(rawMime: string): Promise<{ text?: string; html?: string }> {
  try {
    const parsed: ParsedMail = await simpleParser(rawMime);
    return {
      text: parsed.text || undefined,
      html: typeof parsed.html === 'string' ? parsed.html : undefined,
    };
  } catch (error) {
    console.error('❌ Failed to parse MIME content:', error);
    return {};
  }
}

/**
 * Normalize SendGrid Inbound Parse webhook payload to canonical format
 */
export async function normalizeSendGridInboundEmail(req: Request): Promise<NormalizedInboundEmail> {
  const body = req.body;
  const receivedAt = new Date().toISOString();
  
  // DEBUG: Log full body keys and structure
  console.log(`📧 SendGrid body keys: ${Object.keys(body).join(', ')}`);
  console.log(`📧 SendGrid body type: ${typeof body}`);
  console.log(`📧 SendGrid full body (first 2000 chars): ${JSON.stringify(body).substring(0, 2000)}`);
  
  console.log(`📧 SendGrid raw 'to' field: ${body.to}`);
  console.log(`📧 SendGrid raw envelope: ${body.envelope}`);
  
  // Parse envelope for routing
  let envelope: { to?: string[]; from?: string } = {};
  try {
    envelope = typeof body.envelope === 'string' ? JSON.parse(body.envelope) : (body.envelope || {});
  } catch {}
  
  console.log(`📧 Parsed envelope:`, envelope);
  
  // Get To addresses from envelope (preferred) or body
  const toAddresses = envelope.to || [body.to].filter(Boolean);
  console.log(`📧 Using toAddresses for routing:`, toAddresses);
  
  // Parse headers
  const headers = parseHeaders(body.headers);
  
  // Extract routing information
  const routing = extractRouting(toAddresses, headers);
  
  // Parse email addresses
  const from = parseEmailAddress(body.from);
  const to = parseEmailAddresses(body.to);
  const cc = parseEmailAddresses(body.cc);
  
  // Extract attachments
  const attachments = extractSendGridAttachments(body);
  
  // Store raw payload
  const rawPayloadRef = await storeRawPayload(body);
  
  // Check for raw MIME content
  const rawMimeRef = body.email ? await storeRawPayload(body.email) : undefined;
  
  // Extract text/html - try body fields first, fall back to MIME parsing
  let textBody = body.text || undefined;
  let htmlBody = body.html || undefined;
  
  // If text/html are empty but raw MIME exists, parse it
  if (!textBody && !htmlBody && body.email) {
    console.log('📧 No text/html in body, parsing raw MIME content...');
    const parsed = await parseRawMimeContent(body.email);
    textBody = parsed.text;
    htmlBody = parsed.html;
    console.log(`📧 Parsed MIME: text=${textBody?.length || 0} chars, html=${htmlBody?.length || 0} chars`);
  }
  
  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(body);
  
  const normalized: NormalizedInboundEmail = {
    event: 'inbound_email',
    version: '0.5',
    provider: {
      name: 'sendgrid',
      rawPayloadRef,
    },
    routing,
    email: {
      from,
      to,
      cc,
      subject: body.subject || '(No Subject)',
      textBody,
      htmlBody,
      headers,
      raw: rawMimeRef ? { mimeRef: rawMimeRef } : undefined,
    },
    attachments,
    idempotency: {
      key: idempotencyKey,
      receivedAt,
    },
    meta: {
      receivedAt,
      sourceIp: req.ip || req.socket?.remoteAddress || undefined,
    },
  };
  
  return normalized;
}

/**
 * Generate Qashivo HMAC signature for internal webhook
 */
export function generateQashivoSignature(timestamp: string, body: string): string {
  const payload = `${timestamp}.${body}`;
  return crypto.createHmac('sha256', QASHIVO_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}

/**
 * Verify Qashivo HMAC signature
 */
export function verifyQashivoSignature(timestamp: string, body: string, signature: string): boolean {
  const expectedSig = generateQashivoSignature(timestamp, body);
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

/**
 * Generic normalizer dispatcher for future provider support
 */
export async function normalizeInboundEmail(
  provider: 'sendgrid' | 'mailgun' | 'postmark',
  req: Request
): Promise<NormalizedInboundEmail> {
  switch (provider) {
    case 'sendgrid':
      return normalizeSendGridInboundEmail(req);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
