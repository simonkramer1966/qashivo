// Shared email types for enterprise email service abstraction

export enum EmailProvider {
  SENDGRID = 'sendgrid',
  SES = 'ses',
  POSTMARK = 'postmark',
  MAILGUN = 'mailgun'
}

export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum EmailCategory {
  TRANSACTIONAL = 'transactional',
  MARKETING = 'marketing',
  NOTIFICATION = 'notification',
  REMINDER = 'reminder',
  INVOICE = 'invoice',
  COLLECTIONS = 'collections'
}

export enum DeliveryStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  OPENED = 'opened',
  CLICKED = 'clicked'
}

export interface EmailAttachment {
  content: Uint8Array;
  filename: string;
  type: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string; // For inline attachments
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  variables?: Record<string, any>;
  provider?: EmailProvider;
  category?: EmailCategory;
}

export interface EmailMessage {
  // Recipients
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  
  // Sender
  from: EmailAddress;
  replyTo?: EmailAddress;
  
  // Content
  subject: string;
  htmlContent?: string;
  textContent?: string;
  
  // Metadata
  messageId?: string;
  category?: EmailCategory;
  priority?: EmailPriority;
  tags?: string[];
  customHeaders?: Record<string, string>;
  
  // Advanced features
  attachments?: EmailAttachment[];
  templateId?: string;
  templateData?: Record<string, any>;
  
  // Tracking & Analytics
  trackOpens?: boolean;
  trackClicks?: boolean;
  trackUnsubscribes?: boolean;
  
  // Scheduling
  sendAt?: Date;
  timezone?: string;
  
  // Enterprise features
  tenantId?: string;
  userId?: string;
  batchId?: string;
  
  // Provider-specific settings
  providerSettings?: Record<string, any>;
}

export interface BulkEmailMessage {
  from: EmailAddress;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: string;
  
  recipients: Array<{
    to: EmailAddress;
    templateData?: Record<string, any>;
    customHeaders?: Record<string, string>;
    metadata?: Record<string, any>;
  }>;
  
  category?: EmailCategory;
  priority?: EmailPriority;
  tags?: string[];
  
  // Bulk-specific settings
  batchSize?: number;
  throttleRate?: number; // emails per second
  retryAttempts?: number;
  
  // Enterprise features
  tenantId?: string;
  userId?: string;
  batchId?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  providerMessageId?: string;
  status: DeliveryStatus;
  message?: string;
  error?: string;
  timestamp: Date;
  
  // Enterprise tracking
  tenantId?: string;
  userId?: string;
  batchId?: string;
  
  // Provider details
  provider: EmailProvider;
  providerResponse?: any;
}

export interface BulkEmailResult {
  totalSent: number;
  successfulSends: number;
  failedSends: number;
  results: EmailSendResult[];
  batchId: string;
  startTime: Date;
  endTime: Date;
  
  // Error summary
  errors: Array<{
    recipient: string;
    error: string;
    retryable: boolean;
  }>;
}

export interface ParsedEmail {
  messageId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  attachments?: EmailAttachment[];
  headers: Record<string, string>;
  timestamp: Date;
  
  // Inbound processing metadata
  originalMessageId?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  
  // Enterprise features
  tenantId?: string;
  classification?: string;
  autoReplyProcessed?: boolean;
  forwardedTo?: string[];
}

export interface EmailWebhookEvent {
  eventType: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed' | 'inbound';
  messageId: string;
  providerMessageId?: string;
  recipient: string;
  timestamp: Date;
  
  // Event-specific data
  eventData?: {
    url?: string; // For click events
    userAgent?: string; // For open/click events
    ip?: string;
    location?: string;
    bounceReason?: string; // For bounce events
    unsubscribeReason?: string; // For unsubscribe events
  };
  
  // Enterprise tracking
  tenantId?: string;
  userId?: string;
  batchId?: string;
  
  // Provider details
  provider: EmailProvider;
  rawWebhookData?: any;
}

export interface EmailServiceConfig {
  provider: EmailProvider;
  
  // Provider credentials
  apiKey?: string;
  apiSecret?: string;
  domain?: string;
  region?: string;
  
  // Default settings
  defaultFrom: EmailAddress;
  defaultReplyTo?: EmailAddress;
  
  // Rate limiting
  rateLimit?: {
    requestsPerSecond: number;
    requestsPerDay?: number;
    burstLimit?: number;
  };
  
  // Retry configuration
  retryConfig?: {
    maxAttempts: number;
    backoffMultiplier: number;
    maxBackoffSeconds: number;
  };
  
  // Webhook configuration
  webhookConfig?: {
    url: string;
    secret: string;
    events: string[];
  };
  
  // Enterprise features
  fallbackProvider?: EmailProvider;
  enableTracking?: boolean;
  enableTemplating?: boolean;
  
  // Environment
  environment: 'development' | 'staging' | 'production';
  debug?: boolean;
}

export interface EmailProviderStatus {
  provider: EmailProvider;
  isHealthy: boolean;
  lastChecked: Date;
  errorCount: number;
  successRate: number;
  averageResponseTime: number;
  dailyQuotaUsed?: number;
  dailyQuotaLimit?: number;
  
  // Error details
  lastError?: {
    message: string;
    timestamp: Date;
    code?: string;
  };
}

export interface EmailMetrics {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
  
  // Rate calculations
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  
  // Time-based metrics
  period: {
    start: Date;
    end: Date;
  };
  
  // Provider breakdown
  providerMetrics?: Record<EmailProvider, {
    sent: number;
    delivered: number;
    failed: number;
    averageResponseTime: number;
  }>;
  
  // Category breakdown
  categoryMetrics?: Record<EmailCategory, {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }>;
}

// Utility types for enterprise features
export interface EmailRateLimiter {
  checkLimit(identifier: string, limit: number, windowMs: number): Promise<boolean>;
  getCurrentUsage(identifier: string, windowMs: number): Promise<number>;
  resetLimit(identifier: string): Promise<void>;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  variables?: Record<string, any>;
  provider?: EmailProvider;
  category?: EmailCategory;
  
  // Template metadata
  version: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Enterprise features
  tenantId?: string;
  locale?: string;
  tags?: string[];
}

export interface EmailTrackingData {
  messageId: string;
  events: EmailWebhookEvent[];
  currentStatus: DeliveryStatus;
  
  // Aggregated metrics
  deliveredAt?: Date;
  openedAt?: Date;
  firstClickAt?: Date;
  bouncedAt?: Date;
  unsubscribedAt?: Date;
  
  // Detailed tracking
  openCount: number;
  clickCount: number;
  uniqueOpens: number;
  uniqueClicks: number;
  
  // Enterprise tracking
  tenantId?: string;
  userId?: string;
  batchId?: string;
}