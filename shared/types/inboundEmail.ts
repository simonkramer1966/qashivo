/**
 * Canonical Inbound Email Schema v0.5
 * Standardized format for all inbound email providers
 */

export interface InboundEmailProvider {
  name: 'sendgrid' | 'mailgun' | 'postmark';
  rawPayloadRef?: string;
}

export interface InboundEmailRouting {
  method: 'reply_to_token' | 'in_reply_to' | 'references' | 'heuristic' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  tenantId?: string;
  conversationId?: string;
  outboundMessageId?: string;
  contactId?: string;
  invoiceId?: string;
  actionId?: string;
}

export interface InboundEmailAddress {
  email: string;
  name?: string;
}

export interface InboundEmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  contentRef?: string;
}

export interface InboundEmailContent {
  from: InboundEmailAddress;
  to: InboundEmailAddress[];
  cc?: InboundEmailAddress[];
  replyTo?: InboundEmailAddress;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  headers: Record<string, string>;
  raw?: {
    mimeRef?: string;
  };
}

export interface InboundEmailIdempotency {
  key: string;
  receivedAt: string;
}

export interface InboundEmailMeta {
  receivedAt: string;
  processedAt?: string;
  sourceIp?: string;
}

export interface NormalizedInboundEmail {
  event: 'inbound_email';
  version: '0.5';
  provider: InboundEmailProvider;
  routing: InboundEmailRouting;
  email: InboundEmailContent;
  attachments: InboundEmailAttachment[];
  idempotency: InboundEmailIdempotency;
  meta: InboundEmailMeta;
}

export interface InboundEmailQueueItem {
  id: string;
  normalizedEmail: NormalizedInboundEmail;
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}
