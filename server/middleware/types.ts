// Universal provider types for API middleware
export type ProviderType = 'accounting' | 'communication' | 'payment' | 'ai' | 'email' | 'sms' | 'voice';

export interface ProviderConfig {
  name: string;
  type: ProviderType;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  baseUrl?: string;
  scopes?: string[];
  redirectUri?: string;
  environment?: 'sandbox' | 'production';
}

export interface AuthResult {
  success: boolean;
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    tenantId?: string;
    scope?: string;
  };
  error?: string;
  authUrl?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
  timeout?: number;
  retries?: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  rawResponse?: any;
}

export interface WebhookConfig {
  endpoint: string;
  events: string[];
  secret?: string;
}

export interface WebhookResult {
  success: boolean;
  webhookId?: string;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  errors: string[];
  filtered?: number;
  skipped?: number;
}

// Token accessor function for providers
export type TokenAccessor = (providerName: string, tenantId?: string) => Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tenantId?: string;
} | null>;

// Universal Provider Interface - All providers implement this
export interface UniversalProvider {
  readonly name: string;
  readonly type: ProviderType;
  readonly config: ProviderConfig;
  
  // Token accessor injected during registration
  setTokenAccessor(accessor: TokenAccessor): void;
  
  // Core API methods
  makeRequest<T = any>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>>;
  
  // Data standardization
  standardizeData(rawData: any, dataType: string): Promise<any>;
  
  // Webhook management
  setupWebhook?(config: WebhookConfig): Promise<WebhookResult>;
  handleWebhook?(payload: any): Promise<any>;
  
  // Health check
  healthCheck(): Promise<boolean>;
  
  // Cleanup resources
  disconnect(): Promise<void>;
}

// Standardized data models that all providers map to
export interface StandardContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  outstandingBalance: number;
  isActive: boolean;
  provider: string;
  providerContactId: string;
  metadata?: Record<string, any>;
}

export interface StandardInvoice {
  id: string;
  number: string;
  contactId: string;
  amount: number;
  amountPaid: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'on-hold';
  issueDate: Date;
  dueDate: Date;
  currency: string;
  description?: string;
  provider: string;
  providerInvoiceId: string;
  metadata?: Record<string, any>;
}

export interface StandardPayment {
  id: string;
  invoiceId: string;
  amount: number;
  date: Date;
  method: string;
  reference?: string;
  provider: string;
  providerPaymentId: string;
  metadata?: Record<string, any>;
}

export interface StandardEmail {
  id: string;
  to: string;
  from: string;
  subject: string;
  body?: string;
  htmlBody?: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt?: Date;
  deliveredAt?: Date;
  templateId?: string;
  templateData?: Record<string, any>;
  provider: string;
  providerMessageId: string;
  metadata?: Record<string, any>;
}

export interface StandardSMS {
  id: string;
  to: string;
  from: string;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  sentAt?: Date;
  deliveredAt?: Date;
  provider: string;
  providerMessageId: string;
  metadata?: Record<string, any>;
}

export interface StandardVoiceCall {
  id: string;
  to: string;
  from: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';
  duration?: number;
  startTime?: Date;
  endTime?: Date;
  recordingUrl?: string;
  transcription?: string;
  provider: string;
  providerCallId: string;
  metadata?: Record<string, any>;
}

export interface StandardAIResponse {
  id: string;
  prompt: string;
  response: string;
  model?: string;
  tokensUsed?: number;
  requestTime: Date;
  responseTime?: Date;
  status: 'pending' | 'completed' | 'failed';
  provider: string;
  providerRequestId: string;
  metadata?: Record<string, any>;
}

// Data transformation mappings
export interface DataMapping {
  provider: string;
  dataType: 'contact' | 'invoice' | 'payment' | 'email' | 'sms' | 'voice_call' | 'ai_response';
  fieldMappings: Record<string, string | ((data: any) => any)>;
  transformations?: Record<string, (value: any) => any>;
}

// Provider registry
export interface ProviderRegistry {
  providers: Map<string, UniversalProvider>;
  register(provider: UniversalProvider): void;
  unregister(providerName: string): void;
  get(providerName: string): UniversalProvider | undefined;
  list(): UniversalProvider[];
  getByType(type: ProviderType): UniversalProvider[];
}