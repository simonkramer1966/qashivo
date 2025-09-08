import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  role: varchar("role").notNull().default("user"), // owner, admin, user
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tenants table for multi-tenancy
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  subdomain: varchar("subdomain").unique(),
  settings: jsonb("settings"),
  xeroAccessToken: text("xero_access_token"),
  xeroRefreshToken: text("xero_refresh_token"),
  xeroTenantId: varchar("xero_tenant_id"),
  xeroSyncInterval: integer("xero_sync_interval").default(60), // minutes
  xeroLastSyncAt: timestamp("xero_last_sync_at"),
  xeroAutoSync: boolean("xero_auto_sync").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contacts table
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  xeroContactId: varchar("xero_contact_id"),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  companyName: varchar("company_name"),
  address: text("address"),
  isActive: boolean("is_active").default(true),
  paymentTerms: integer("payment_terms").default(30), // days
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }),
  preferredContactMethod: varchar("preferred_contact_method").default("email"), // email, phone, sms
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  xeroInvoiceId: varchar("xero_invoice_id"),
  invoiceNumber: varchar("invoice_number").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status").notNull().default("pending"), // pending, paid, overdue, cancelled
  collectionStage: varchar("collection_stage").default("initial"), // initial, reminder_1, reminder_2, formal_notice, final_notice, escalated
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  description: text("description"),
  currency: varchar("currency").default("USD"),
  workflowId: varchar("workflow_id"),
  lastReminderSent: timestamp("last_reminder_sent"),
  reminderCount: integer("reminder_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cached Xero invoices table for sync functionality
export const cachedXeroInvoices = pgTable("cached_xero_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  xeroInvoiceId: varchar("xero_invoice_id").notNull(),
  invoiceNumber: varchar("invoice_number").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status").notNull(),
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  description: text("description"),
  currency: varchar("currency").default("USD"),
  contact: jsonb("contact"), // Store contact data from Xero
  paymentDetails: jsonb("payment_details"), // Store payment tracking info
  metadata: jsonb("metadata"), // Additional Xero data
  syncedAt: timestamp("synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Actions table for tracking collection activities
export const actions = pgTable("actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  userId: varchar("user_id").references(() => users.id),
  type: varchar("type").notNull(), // email, sms, call, payment, note, workflow_start, workflow_step
  status: varchar("status").notNull().default("pending"), // pending, completed, failed, cancelled
  subject: varchar("subject"),
  content: text("content"),
  scheduledFor: timestamp("scheduled_for"),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata"), // Additional data like email ID, SMS ID, etc.
  workflowStepId: varchar("workflow_step_id"),
  aiGenerated: boolean("ai_generated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflows table for collection processes
export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isTemplate: boolean("is_template").default(false),
  category: varchar("category"), // "email_sequence", "multi_channel", "escalation", etc.
  trigger: jsonb("trigger"), // Conditions to start workflow
  steps: jsonb("steps"), // Array of workflow steps (legacy - for backward compatibility)
  canvasData: jsonb("canvas_data"), // Visual workflow builder data (positions, zoom, etc.)
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  estimatedCost: decimal("estimated_cost", { precision: 8, scale: 2 }), // Cost per execution
  testScenarios: jsonb("test_scenarios"), // Saved test scenarios
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow nodes for visual workflow builder
export const workflowNodes = pgTable("workflow_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  nodeType: varchar("node_type").notNull(), // "trigger", "action", "decision", "delay"
  subType: varchar("sub_type"), // "email", "sms", "whatsapp", "voice", "payment_received", etc.
  label: varchar("label").notNull(),
  position: jsonb("position").notNull(), // {x: number, y: number}
  config: jsonb("config").notNull(), // Node-specific configuration
  isStartNode: boolean("is_start_node").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Workflow connections between nodes
export const workflowConnections = pgTable("workflow_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  sourceNodeId: varchar("source_node_id").notNull().references(() => workflowNodes.id, { onDelete: "cascade" }),
  targetNodeId: varchar("target_node_id").notNull().references(() => workflowNodes.id, { onDelete: "cascade" }),
  condition: jsonb("condition"), // Condition for this connection (for decision nodes)
  label: varchar("label"), // Optional label for the connection
  connectionType: varchar("connection_type").default("default"), // "yes", "no", "what_if", "default"
  successRate: decimal("success_rate", { precision: 5, scale: 2 }), // Historical success rate
  createdAt: timestamp("created_at").defaultNow(),
});

// Workflow templates
export const workflowTemplates = pgTable("workflow_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // "freelancer", "small_business", "enterprise", etc.
  industry: varchar("industry"), // "consulting", "retail", "construction", etc.
  workflowData: jsonb("workflow_data").notNull(), // Complete workflow definition
  isPublic: boolean("is_public").default(false), // System templates vs custom
  usageCount: integer("usage_count").default(0),
  averageSuccessRate: decimal("average_success_rate", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Communication templates for emails, SMS, etc.
export const communicationTemplates = pgTable("communication_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // "email", "sms", "whatsapp", "voice"
  category: varchar("category").notNull(), // "reminder", "formal_notice", "urgent", "final_notice", "collection_warning"
  stage: integer("stage"), // 1-5 for email sequence stages
  subject: varchar("subject"), // For emails
  content: text("content").notNull(),
  variables: jsonb("variables"), // Available variables for personalization
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Channel escalation rules
export const escalationRules = pgTable("escalation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name").notNull(),
  description: text("description"),
  rules: jsonb("rules").notNull(), // Escalation logic and conditions
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(1), // Rule execution order
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI agent configurations
export const aiAgentConfigs = pgTable("ai_agent_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // "whatsapp", "voice", "email_generator"
  personality: varchar("personality").default("professional"), // "professional", "friendly", "firm"
  instructions: text("instructions").notNull(),
  escalationTriggers: jsonb("escalation_triggers"), // When to escalate to human
  responseTemplates: jsonb("response_templates"), // Pre-built responses
  isActive: boolean("is_active").default(true),
  modelSettings: jsonb("model_settings"), // AI model parameters
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Channel performance analytics
export const channelAnalytics = pgTable("channel_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  channel: varchar("channel").notNull(), // "email", "sms", "whatsapp", "voice"
  stage: integer("stage"), // Which stage in the sequence
  templateId: varchar("template_id").references(() => communicationTemplates.id),
  date: timestamp("date").notNull(),
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  openedCount: integer("opened_count").default(0),
  respondedCount: integer("responded_count").default(0),
  paidCount: integer("paid_count").default(0),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0"),
  costPerCommunication: decimal("cost_per_communication", { precision: 6, scale: 4 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Retell AI configurations
export const retellConfigurations = pgTable("retell_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  apiKey: text("api_key").notNull(), // Encrypted Retell AI API key
  agentId: varchar("agent_id").notNull(), // Retell AI agent ID for collections
  phoneNumber: varchar("phone_number").notNull(), // From number in E.164 format
  phoneNumberId: varchar("phone_number_id"), // Retell phone number ID if using their numbers
  isActive: boolean("is_active").default(true),
  webhookUrl: varchar("webhook_url"), // Webhook endpoint for call events
  settings: jsonb("settings"), // Additional Retell AI settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Voice call logs for Retell AI calls
export const voiceCalls = pgTable("voice_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  retellCallId: varchar("retell_call_id").notNull(), // Retell AI call ID
  retellAgentId: varchar("retell_agent_id").notNull(), // Agent used for the call
  fromNumber: varchar("from_number").notNull(), // E.164 format
  toNumber: varchar("to_number").notNull(), // E.164 format
  direction: varchar("direction").notNull(), // "inbound" or "outbound"
  status: varchar("status").notNull().default("initiated"), // "initiated", "ringing", "answered", "completed", "failed", "no_answer"
  duration: integer("duration"), // Call duration in seconds
  cost: decimal("cost", { precision: 8, scale: 4 }), // Cost of the call
  transcript: text("transcript"), // Full call transcript
  recordingUrl: varchar("recording_url"), // Retell AI recording URL
  callAnalysis: jsonb("call_analysis"), // AI analysis from Retell
  userSentiment: varchar("user_sentiment"), // "positive", "neutral", "negative"
  callSuccessful: boolean("call_successful"), // Did the call achieve its goal
  disconnectionReason: varchar("disconnection_reason"), // Why the call ended
  customerResponse: varchar("customer_response"), // "payment_promised", "dispute", "no_response", etc.
  followUpRequired: boolean("follow_up_required").default(false),
  scheduledAt: timestamp("scheduled_at"), // When the call was scheduled
  startedAt: timestamp("started_at"), // When the call actually started
  endedAt: timestamp("ended_at"), // When the call ended
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leads table for CRM
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone").notNull(),
  company: varchar("company"),
  status: varchar("status").notNull().default("new"), // "new", "contacted", "qualified", "converted", "closed"
  source: varchar("source").notNull().default("demo"), // "demo", "website", "referral", etc.
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  actions: many(actions),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  contacts: many(contacts),
  invoices: many(invoices),
  cachedXeroInvoices: many(cachedXeroInvoices),
  actions: many(actions),
  workflows: many(workflows),
  communicationTemplates: many(communicationTemplates),
  escalationRules: many(escalationRules),
  aiAgentConfigs: many(aiAgentConfigs),
  channelAnalytics: many(channelAnalytics),
  retellConfigurations: many(retellConfigurations),
  voiceCalls: many(voiceCalls),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contacts.tenantId],
    references: [tenants.id],
  }),
  invoices: many(invoices),
  actions: many(actions),
  voiceCalls: many(voiceCalls),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [invoices.contactId],
    references: [contacts.id],
  }),
  actions: many(actions),
  voiceCalls: many(voiceCalls),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [actions.tenantId],
    references: [tenants.id],
  }),
  invoice: one(invoices, {
    fields: [actions.invoiceId],
    references: [invoices.id],
  }),
  contact: one(contacts, {
    fields: [actions.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [actions.userId],
    references: [users.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [workflows.tenantId],
    references: [tenants.id],
  }),
  nodes: many(workflowNodes),
  connections: many(workflowConnections),
}));

export const workflowNodesRelations = relations(workflowNodes, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [workflowNodes.workflowId],
    references: [workflows.id],
  }),
  sourceConnections: many(workflowConnections, {
    relationName: "sourceNode",
  }),
  targetConnections: many(workflowConnections, {
    relationName: "targetNode",
  }),
}));

export const workflowConnectionsRelations = relations(workflowConnections, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowConnections.workflowId],
    references: [workflows.id],
  }),
  sourceNode: one(workflowNodes, {
    fields: [workflowConnections.sourceNodeId],
    references: [workflowNodes.id],
    relationName: "sourceNode",
  }),
  targetNode: one(workflowNodes, {
    fields: [workflowConnections.targetNodeId],
    references: [workflowNodes.id],
    relationName: "targetNode",
  }),
}));

export const communicationTemplatesRelations = relations(communicationTemplates, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [communicationTemplates.tenantId],
    references: [tenants.id],
  }),
  analytics: many(channelAnalytics),
}));

export const escalationRulesRelations = relations(escalationRules, ({ one }) => ({
  tenant: one(tenants, {
    fields: [escalationRules.tenantId],
    references: [tenants.id],
  }),
}));

export const aiAgentConfigsRelations = relations(aiAgentConfigs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiAgentConfigs.tenantId],
    references: [tenants.id],
  }),
}));

export const channelAnalyticsRelations = relations(channelAnalytics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [channelAnalytics.tenantId],
    references: [tenants.id],
  }),
  template: one(communicationTemplates, {
    fields: [channelAnalytics.templateId],
    references: [communicationTemplates.id],
  }),
}));

export const retellConfigurationsRelations = relations(retellConfigurations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [retellConfigurations.tenantId],
    references: [tenants.id],
  }),
}));

export const voiceCallsRelations = relations(voiceCalls, ({ one }) => ({
  tenant: one(tenants, {
    fields: [voiceCalls.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [voiceCalls.contactId],
    references: [contacts.id],
  }),
  invoice: one(invoices, {
    fields: [voiceCalls.invoiceId],
    references: [invoices.id],
  }),
}));

export const cachedXeroInvoicesRelations = relations(cachedXeroInvoices, ({ one }) => ({
  tenant: one(tenants, {
    fields: [cachedXeroInvoices.tenantId],
    references: [tenants.id],
  }),
}));

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCachedXeroInvoiceSchema = createInsertSchema(cachedXeroInvoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  syncedAt: true,
});

export const insertActionSchema = createInsertSchema(actions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowNodeSchema = createInsertSchema(workflowNodes).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowConnectionSchema = createInsertSchema(workflowConnections).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommunicationTemplateSchema = createInsertSchema(communicationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEscalationRuleSchema = createInsertSchema(escalationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiAgentConfigSchema = createInsertSchema(aiAgentConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChannelAnalyticsSchema = createInsertSchema(channelAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertRetellConfigurationSchema = createInsertSchema(retellConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoiceCallSchema = createInsertSchema(voiceCalls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertCachedXeroInvoice = z.infer<typeof insertCachedXeroInvoiceSchema>;
export type CachedXeroInvoice = typeof cachedXeroInvoices.$inferSelect;
export type InsertAction = z.infer<typeof insertActionSchema>;
export type Action = typeof actions.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflowNode = z.infer<typeof insertWorkflowNodeSchema>;
export type WorkflowNode = typeof workflowNodes.$inferSelect;
export type InsertWorkflowConnection = z.infer<typeof insertWorkflowConnectionSchema>;
export type WorkflowConnection = typeof workflowConnections.$inferSelect;
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertCommunicationTemplate = z.infer<typeof insertCommunicationTemplateSchema>;
export type CommunicationTemplate = typeof communicationTemplates.$inferSelect;
export type InsertEscalationRule = z.infer<typeof insertEscalationRuleSchema>;
export type EscalationRule = typeof escalationRules.$inferSelect;
export type InsertAiAgentConfig = z.infer<typeof insertAiAgentConfigSchema>;
export type AiAgentConfig = typeof aiAgentConfigs.$inferSelect;
export type InsertChannelAnalytics = z.infer<typeof insertChannelAnalyticsSchema>;
export type ChannelAnalytics = typeof channelAnalytics.$inferSelect;
export type InsertRetellConfiguration = z.infer<typeof insertRetellConfigurationSchema>;
export type RetellConfiguration = typeof retellConfigurations.$inferSelect;
export type InsertVoiceCall = z.infer<typeof insertVoiceCallSchema>;
export type VoiceCall = typeof voiceCalls.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Node Configuration Types
export interface TriggerNodeConfig {
  invoice_overdue?: {
    daysOverdueThreshold: number; // 1-365
    minimumAmount: number;
    customerTypeFilter: 'individual' | 'business' | 'both';
    previousContactLimit: number;
    timeWindow: 'business_hours' | 'twenty_four_seven';
  };
  payment_received?: {
    paymentMethodFilters: string[];
    paymentType: 'partial' | 'full' | 'both';
    gracePeriodDays: number;
    notificationRecipients: string[];
  };
}

export interface ActionNodeConfig {
  send_email?: {
    templateId: string;
    personalizationFields: string[];
    sendDelay: 'immediate' | 'scheduled';
    scheduledTime?: string;
    trackOpens: boolean;
    trackClicks: boolean;
    escalationDays?: number;
  };
  send_sms?: {
    messageTemplate: string;
    sendTimeStart: string; // "09:00"
    sendTimeEnd: string; // "20:00"
    optOutCompliance: boolean;
    responseHandling: 'automated' | 'manual';
  };
  make_call?: {
    scriptId: string;
    callTimePreferences: string[];
    maxRetryAttempts: number;
    voicemailMessage: string;
    outcomeTracking: boolean;
  };
  wait_delay?: {
    duration: number;
    durationUnit: 'hours' | 'days' | 'weeks';
    businessDaysOnly: boolean;
    skipOnPayment: boolean;
  };
}

export interface DecisionNodeConfig {
  payment_status_check?: {
    condition: string;
    daysToCheck: number;
    yesAction: string;
    noAction: string;
    whatIfScenarios: Array<{
      id: string;
      condition: string;
      label: string;
    }>;
  };
  customer_response?: {
    condition: string;
    yesAction: string;
    noAction: string;
    whatIfScenarios: Array<{
      id: string;
      condition: string;
      label: string;
    }>;
  };
  amount_threshold?: {
    condition: string;
    thresholdAmount: number;
    yesAction: string;
    noAction: string;
    whatIfScenarios: Array<{
      id: string;
      condition: string;
      label: string;
    }>;
  };
}

export interface AINodeConfig {
  generate_email?: {
    tone: 'professional' | 'firm' | 'friendly';
    customerHistoryAnalysis: boolean;
    personalizationLevel: 'basic' | 'advanced';
    legalComplianceCheck: boolean;
    templateBase: string;
  };
  analyze_response?: {
    sentimentAnalysis: boolean;
    intentDetection: boolean;
    urgencyScoring: boolean;
    maxUrgencyScore: number;
    recommendedActions: string[];
  };
}

export type NodeConfigUnion = TriggerNodeConfig & ActionNodeConfig & DecisionNodeConfig & AINodeConfig;

// Enhanced WorkflowNode type for the frontend
export interface WorkflowNodeWithConfig extends Omit<WorkflowNode, 'config'> {
  config: NodeConfigUnion;
}

// Enhanced WorkflowConnection type for decision branches
export interface WorkflowConnectionWithType extends Omit<WorkflowConnection, 'connectionType'> {
  connectionType: 'yes' | 'no' | 'what_if' | 'default';
}
