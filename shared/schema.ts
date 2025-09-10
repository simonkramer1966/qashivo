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
  collectionsAutomationEnabled: boolean("collections_automation_enabled").default(true),
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
  isOnHold: boolean("is_on_hold").default(false), // whether invoice is on hold (excluded from collections workflow)
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
  category: varchar("category").notNull(), // "before_due", "early_overdue", "medium_overdue", "late_overdue", "final_reminder", "thanks_for_paying"
  stage: integer("stage"), // 1-5 for email sequence stages
  subject: varchar("subject"), // For emails
  content: text("content").notNull(),
  variables: jsonb("variables"), // Available variables for personalization
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  usageCount: integer("usage_count").default(0),
  sendTiming: jsonb("send_timing"), // When to send: {daysOffset: number, timeOfDay: string, weekdaysOnly: boolean}
  aiGenerated: boolean("ai_generated").default(false),
  optimizationScore: decimal("optimization_score", { precision: 5, scale: 2 }), // AI-calculated effectiveness score
  toneOfVoice: varchar("tone_of_voice").default("professional"), // "professional", "friendly", "urgent", "formal"
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

// Voice workflows for conversational AI flows
export const voiceWorkflows = pgTable("voice_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").default("collection"), // "collection", "sales", "support", "custom"
  isActive: boolean("is_active").default(true),
  isTemplate: boolean("is_template").default(false),
  retellAgentId: varchar("retell_agent_id"), // Associated Retell agent
  canvasData: jsonb("canvas_data"), // Visual workflow builder data (positions, zoom, etc.)
  voiceSettings: jsonb("voice_settings"), // Voice-specific settings (tone, speed, etc.)
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  averageCallDuration: integer("average_call_duration"), // Average duration in seconds
  totalCalls: integer("total_calls").default(0),
  deploymentStatus: varchar("deployment_status").default("draft"), // "draft", "deployed", "failed"
  lastDeployedAt: timestamp("last_deployed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual states within voice workflows
export const voiceWorkflowStates = pgTable("voice_workflow_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voiceWorkflowId: varchar("voice_workflow_id").notNull().references(() => voiceWorkflows.id, { onDelete: "cascade" }),
  stateType: varchar("state_type").notNull(), // "greeting", "information_gathering", "decision_point", "payment_options", "confirmation", "schedule_followup", "call_ending"
  label: varchar("label").notNull(),
  position: jsonb("position").notNull(), // {x: number, y: number}
  config: jsonb("config").notNull(), // State-specific configuration
  isStartState: boolean("is_start_state").default(false),
  isEndState: boolean("is_end_state").default(false),
  prompt: text("prompt"), // What the AI says in this state
  expectedResponses: jsonb("expected_responses"), // Expected customer responses
  retellStateId: varchar("retell_state_id"), // Corresponding Retell AI state ID
  createdAt: timestamp("created_at").defaultNow(),
});

// Transitions between voice workflow states
export const voiceStateTransitions = pgTable("voice_state_transitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voiceWorkflowId: varchar("voice_workflow_id").notNull().references(() => voiceWorkflows.id, { onDelete: "cascade" }),
  fromStateId: varchar("from_state_id").notNull().references(() => voiceWorkflowStates.id, { onDelete: "cascade" }),
  toStateId: varchar("to_state_id").notNull().references(() => voiceWorkflowStates.id, { onDelete: "cascade" }),
  condition: jsonb("condition"), // Condition for this transition
  label: varchar("label"), // Optional label for the transition
  transitionType: varchar("transition_type").default("default"), // "yes", "no", "timeout", "error", "default"
  confidence: decimal("confidence", { precision: 5, scale: 2 }), // AI confidence for this transition
  successRate: decimal("success_rate", { precision: 5, scale: 2 }), // Historical success rate
  createdAt: timestamp("created_at").defaultNow(),
});

// Voice message templates for non-conversational messages
export const voiceMessageTemplates = pgTable("voice_message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // "payment_reminder", "overdue_notice", "thank_you", "follow_up", "custom"
  stage: integer("stage"), // 1-5 for sequence stages
  subject: varchar("subject"), // Brief description of the message
  content: text("content").notNull(), // Message text that will be converted to speech
  variables: jsonb("variables"), // Available variables for personalization
  voiceSettings: jsonb("voice_settings"), // Voice-specific settings (voice_id, speed, tone)
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  sendTiming: jsonb("send_timing"), // When to send: {daysOffset: number, timeOfDay: string, weekdaysOnly: boolean}
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  usageCount: integer("usage_count").default(0),
  averageListenDuration: integer("average_listen_duration"), // Average listening duration in seconds
  toneOfVoice: varchar("tone_of_voice").default("professional"), // "professional", "friendly", "urgent", "formal"
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

// AI CFO Facts Database - Knowledge base for accurate AI responses
export const aiFacts = pgTable("ai_facts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  category: varchar("category").notNull(), // 'policies', 'procedures', 'benchmarks', 'regulations', 'company_info', 'industry_data'
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  tags: jsonb("tags"), // Array of strings for searchability
  priority: integer("priority").default(5), // 1-10, higher priority facts are referenced first
  isActive: boolean("is_active").default(true),
  lastVerified: timestamp("last_verified").defaultNow(),
  source: varchar("source"), // Where this fact came from (e.g., "company_policy", "regulation", "industry_report")
  applicableRegions: jsonb("applicable_regions"), // Geographic applicability
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  createdBy: varchar("created_by"),
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
  voiceWorkflows: many(voiceWorkflows),
  voiceMessageTemplates: many(voiceMessageTemplates),
  aiFacts: many(aiFacts),
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

export const voiceWorkflowsRelations = relations(voiceWorkflows, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [voiceWorkflows.tenantId],
    references: [tenants.id],
  }),
  states: many(voiceWorkflowStates),
  transitions: many(voiceStateTransitions),
}));

export const voiceWorkflowStatesRelations = relations(voiceWorkflowStates, ({ one, many }) => ({
  voiceWorkflow: one(voiceWorkflows, {
    fields: [voiceWorkflowStates.voiceWorkflowId],
    references: [voiceWorkflows.id],
  }),
  outgoingTransitions: many(voiceStateTransitions, {
    relationName: "fromState",
  }),
  incomingTransitions: many(voiceStateTransitions, {
    relationName: "toState",
  }),
}));

export const voiceStateTransitionsRelations = relations(voiceStateTransitions, ({ one }) => ({
  voiceWorkflow: one(voiceWorkflows, {
    fields: [voiceStateTransitions.voiceWorkflowId],
    references: [voiceWorkflows.id],
  }),
  fromState: one(voiceWorkflowStates, {
    fields: [voiceStateTransitions.fromStateId],
    references: [voiceWorkflowStates.id],
    relationName: "fromState",
  }),
  toState: one(voiceWorkflowStates, {
    fields: [voiceStateTransitions.toStateId],
    references: [voiceWorkflowStates.id],
    relationName: "toState",
  }),
}));

export const voiceMessageTemplatesRelations = relations(voiceMessageTemplates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [voiceMessageTemplates.tenantId],
    references: [tenants.id],
  }),
}));

// AI Facts relations
export const aiFactsRelations = relations(aiFacts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiFacts.tenantId],
    references: [tenants.id],
  }),
}));

export const cachedXeroInvoicesRelations = relations(cachedXeroInvoices, ({ one }) => ({
  tenant: one(tenants, {
    fields: [cachedXeroInvoices.tenantId],
    references: [tenants.id],
  }),
}));

// Email senders configuration for multi-sender support
export const emailSenders = pgTable("email_senders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name").notNull(), // Display name (e.g., "John Smith - Accounts Receivable")
  email: varchar("email").notNull(), // Sender email address
  signature: text("signature"), // HTML email signature
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  replyToEmail: varchar("reply_to_email"), // Different reply-to if needed
  fromName: varchar("from_name").notNull(), // "From" display name
  department: varchar("department").default("Accounts Receivable"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Collection schedules that can be assigned to customers (like Chaser's schedules)
export const collectionSchedules = pgTable("collection_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name").notNull(), // e.g., "Standard Collection Process", "VIP Customer Process"
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  workflow: varchar("workflow").notNull().default("monthly_statement"), // "monthly_statement", "single_invoice", "overdue_only"
  scheduleSteps: jsonb("schedule_steps").notNull(), // Array of schedule steps with timing and templates
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  averageDaysToPayment: decimal("average_days_to_payment", { precision: 5, scale: 1 }),
  totalCustomersAssigned: integer("total_customers_assigned").default(0),
  sendingSettings: jsonb("sending_settings"), // Time zones, sending windows, holiday settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer schedule assignments (which customers use which collection schedule)
export const customerScheduleAssignments = pgTable("customer_schedule_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  scheduleId: varchar("schedule_id").notNull().references(() => collectionSchedules.id),
  isActive: boolean("is_active").default(true),
  customSettings: jsonb("custom_settings"), // Customer-specific overrides
  assignedAt: timestamp("assigned_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Template performance analytics enhanced for AI optimization
export const templatePerformance = pgTable("template_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  templateId: varchar("template_id").notNull().references(() => communicationTemplates.id),
  date: timestamp("date").notNull(),
  customerSegment: varchar("customer_segment"), // "small_business", "enterprise", "individual"
  timeOfDaySent: varchar("time_of_day_sent"), // "morning", "afternoon", "evening"
  dayOfWeekSent: integer("day_of_week_sent"), // 1-7 (Monday = 1)
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  openedCount: integer("opened_count").default(0),
  clickedCount: integer("clicked_count").default(0),
  respondedCount: integer("responded_count").default(0),
  paidCount: integer("paid_count").default(0),
  disputedCount: integer("disputed_count").default(0),
  totalAmountPaid: decimal("total_amount_paid", { precision: 10, scale: 2 }).default("0"),
  averageResponseTime: integer("average_response_time"), // Hours to response
  sentimentScore: decimal("sentiment_score", { precision: 3, scale: 2 }), // AI-analyzed sentiment of responses
  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced relations
export const emailSendersRelations = relations(emailSenders, ({ one }) => ({
  tenant: one(tenants, {
    fields: [emailSenders.tenantId],
    references: [tenants.id],
  }),
}));

export const collectionSchedulesRelations = relations(collectionSchedules, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [collectionSchedules.tenantId],
    references: [tenants.id],
  }),
  customerAssignments: many(customerScheduleAssignments),
}));

export const customerScheduleAssignmentsRelations = relations(customerScheduleAssignments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [customerScheduleAssignments.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [customerScheduleAssignments.contactId],
    references: [contacts.id],
  }),
  schedule: one(collectionSchedules, {
    fields: [customerScheduleAssignments.scheduleId],
    references: [collectionSchedules.id],
  }),
}));

export const templatePerformanceRelations = relations(templatePerformance, ({ one }) => ({
  tenant: one(tenants, {
    fields: [templatePerformance.tenantId],
    references: [tenants.id],
  }),
  template: one(communicationTemplates, {
    fields: [templatePerformance.templateId],
    references: [communicationTemplates.id],
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

export const insertVoiceWorkflowSchema = createInsertSchema(voiceWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoiceWorkflowStateSchema = createInsertSchema(voiceWorkflowStates).omit({
  id: true,
  createdAt: true,
});

export const insertVoiceStateTransitionSchema = createInsertSchema(voiceStateTransitions).omit({
  id: true,
  createdAt: true,
});

export const insertVoiceMessageTemplateSchema = createInsertSchema(voiceMessageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiFactSchema = createInsertSchema(aiFacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastVerified: true,
});

export const insertEmailSenderSchema = createInsertSchema(emailSenders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCollectionScheduleSchema = createInsertSchema(collectionSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerScheduleAssignmentSchema = createInsertSchema(customerScheduleAssignments).omit({
  id: true,
  createdAt: true,
  assignedAt: true,
});

export const insertTemplatePerformanceSchema = createInsertSchema(templatePerformance).omit({
  id: true,
  createdAt: true,
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
export type InsertVoiceWorkflow = z.infer<typeof insertVoiceWorkflowSchema>;
export type VoiceWorkflow = typeof voiceWorkflows.$inferSelect;
export type InsertVoiceWorkflowState = z.infer<typeof insertVoiceWorkflowStateSchema>;
export type VoiceWorkflowState = typeof voiceWorkflowStates.$inferSelect;
export type InsertVoiceStateTransition = z.infer<typeof insertVoiceStateTransitionSchema>;
export type VoiceStateTransition = typeof voiceStateTransitions.$inferSelect;
export type InsertVoiceMessageTemplate = z.infer<typeof insertVoiceMessageTemplateSchema>;
export type VoiceMessageTemplate = typeof voiceMessageTemplates.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertAiFact = z.infer<typeof insertAiFactSchema>;
export type AiFact = typeof aiFacts.$inferSelect;
export type InsertEmailSender = z.infer<typeof insertEmailSenderSchema>;
export type EmailSender = typeof emailSenders.$inferSelect;
export type InsertCollectionSchedule = z.infer<typeof insertCollectionScheduleSchema>;
export type CollectionSchedule = typeof collectionSchedules.$inferSelect;
export type InsertCustomerScheduleAssignment = z.infer<typeof insertCustomerScheduleAssignmentSchema>;
export type CustomerScheduleAssignment = typeof customerScheduleAssignments.$inferSelect;
export type InsertTemplatePerformance = z.infer<typeof insertTemplatePerformanceSchema>;
export type TemplatePerformance = typeof templatePerformance.$inferSelect;

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

// Voice State Configuration Types
export interface VoiceStateConfig {
  greeting?: {
    welcomeMessage: string;
    customerNamePersonalization: boolean;
    companyIntroduction: boolean;
    callPurposeStatement: string;
    voiceSettings: {
      tone: 'professional' | 'friendly' | 'warm';
      speed: number; // 0.5 - 2.0
      volume: number; // 0.1 - 1.0
    };
  };
  information_gathering?: {
    questions: Array<{
      id: string;
      question: string;
      expectedResponseType: 'text' | 'yes_no' | 'number' | 'date';
      required: boolean;
      followUpPrompts: string[];
    }>;
    maxRetries: number;
    timeoutHandling: string;
    clarificationPrompts: string[];
  };
  decision_point?: {
    condition: string;
    branches: Array<{
      id: string;
      label: string;
      condition: string;
      nextStateId: string;
    }>;
    defaultBranch: string;
    confidenceThreshold: number;
  };
  payment_options?: {
    paymentMethods: Array<{
      type: 'credit_card' | 'bank_transfer' | 'payment_plan' | 'check';
      description: string;
      instructions: string;
    }>;
    discountOffers: Array<{
      percentage: number;
      conditions: string;
      timeLimit: string;
    }>;
    paymentPlanOptions: boolean;
  };
  confirmation?: {
    summaryPrompt: string;
    confirmationRequest: string;
    nextStepsExplanation: string;
    contactInformation: string;
    followUpScheduling: boolean;
  };
  schedule_followup?: {
    availableTimeSlots: string[];
    calendarIntegration: boolean;
    reminderSettings: {
      enabled: boolean;
      timeBefore: number; // hours
      method: 'call' | 'sms' | 'email';
    };
    rescheduleOptions: boolean;
  };
  call_ending?: {
    closingMessage: string;
    thankYouNote: string;
    contactInformation: string;
    nextStepsReminder: string;
    courtesyCheck: boolean;
  };
}

// Invoice Health Scores table for AI-powered risk assessment
export const invoiceHealthScores = pgTable("invoice_health_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  
  // AI-powered risk scoring (0-100, where 100 is highest risk)
  overallRiskScore: integer("overall_risk_score").notNull(), // 0-100
  paymentProbability: decimal("payment_probability", { precision: 5, scale: 2 }).notNull(), // 0.00-1.00
  
  // Component risk scores
  timeRiskScore: integer("time_risk_score").notNull(), // Based on days overdue, payment terms
  amountRiskScore: integer("amount_risk_score").notNull(), // Based on invoice amount vs customer history
  customerRiskScore: integer("customer_risk_score").notNull(), // Based on customer payment history
  communicationRiskScore: integer("communication_risk_score").notNull(), // Based on responsiveness
  
  // Health indicators
  healthStatus: varchar("health_status").notNull(), // healthy, at_risk, critical, emergency
  healthScore: integer("health_score").notNull(), // 0-100, where 100 is healthiest
  
  // Predictive analytics
  predictedPaymentDate: timestamp("predicted_payment_date"),
  collectionDifficulty: varchar("collection_difficulty").notNull(), // easy, moderate, difficult, very_difficult
  recommendedActions: jsonb("recommended_actions"), // AI-generated action recommendations
  
  // Confidence and metadata
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }).notNull(), // 0.00-1.00
  modelVersion: varchar("model_version").notNull().default("1.0"),
  lastAnalysis: timestamp("last_analysis").notNull(),
  trends: jsonb("trends"), // Historical trend analysis
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Health Analytics Snapshots for trend tracking
export const healthAnalyticsSnapshots = pgTable("health_analytics_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Snapshot metadata
  snapshotDate: timestamp("snapshot_date").notNull(),
  snapshotType: varchar("snapshot_type").notNull(), // daily, weekly, monthly
  
  // Overall portfolio health metrics
  totalInvoicesAnalyzed: integer("total_invoices_analyzed").notNull(),
  averageHealthScore: decimal("average_health_score", { precision: 5, scale: 2 }).notNull(),
  averageRiskScore: decimal("average_risk_score", { precision: 5, scale: 2 }).notNull(),
  
  // Risk distribution
  healthyCount: integer("healthy_count").notNull(),
  atRiskCount: integer("at_risk_count").notNull(),
  criticalCount: integer("critical_count").notNull(),
  emergencyCount: integer("emergency_count").notNull(),
  
  // Collection difficulty distribution
  easyCollectionCount: integer("easy_collection_count").notNull(),
  moderateCollectionCount: integer("moderate_collection_count").notNull(),
  difficultCollectionCount: integer("difficult_collection_count").notNull(),
  veryDifficultCollectionCount: integer("very_difficult_collection_count").notNull(),
  
  // Predictive metrics
  totalValueAtRisk: decimal("total_value_at_risk", { precision: 12, scale: 2 }).notNull(),
  predictedCollectionRate: decimal("predicted_collection_rate", { precision: 5, scale: 2 }).notNull(),
  averagePredictedDaysToPayment: decimal("average_predicted_days_to_payment", { precision: 5, scale: 2 }),
  
  // AI performance metrics
  modelAccuracy: decimal("model_accuracy", { precision: 5, scale: 2 }),
  predictionConfidence: decimal("prediction_confidence", { precision: 5, scale: 2 }).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Table relations for health scoring
export const invoiceHealthScoresRelations = relations(invoiceHealthScores, ({ one }) => ({
  tenant: one(tenants, {
    fields: [invoiceHealthScores.tenantId],
    references: [tenants.id],
  }),
  invoice: one(invoices, {
    fields: [invoiceHealthScores.invoiceId],
    references: [invoices.id],
  }),
  contact: one(contacts, {
    fields: [invoiceHealthScores.contactId],
    references: [contacts.id],
  }),
}));

export const healthAnalyticsSnapshotsRelations = relations(healthAnalyticsSnapshots, ({ one }) => ({
  tenant: one(tenants, {
    fields: [healthAnalyticsSnapshots.tenantId],
    references: [tenants.id],
  }),
}));

// Zod schemas for health scoring
export const insertInvoiceHealthScoreSchema = createInsertSchema(invoiceHealthScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHealthAnalyticsSnapshotSchema = createInsertSchema(healthAnalyticsSnapshots).omit({
  id: true,
  createdAt: true,
});

// Types for health scoring
export type InvoiceHealthScore = typeof invoiceHealthScores.$inferSelect;
export type InsertInvoiceHealthScore = z.infer<typeof insertInvoiceHealthScoreSchema>;
export type HealthAnalyticsSnapshot = typeof healthAnalyticsSnapshots.$inferSelect;
export type InsertHealthAnalyticsSnapshot = z.infer<typeof insertHealthAnalyticsSnapshotSchema>;

// Enhanced WorkflowNode type for the frontend
export interface WorkflowNodeWithConfig extends Omit<WorkflowNode, 'config'> {
  config: NodeConfigUnion;
}

// Enhanced VoiceWorkflowState type for the frontend  
export interface VoiceWorkflowStateWithConfig extends Omit<VoiceWorkflowState, 'config'> {
  config: VoiceStateConfig;
}

// Enhanced WorkflowConnection type for decision branches
export interface WorkflowConnectionWithType extends Omit<WorkflowConnection, 'connectionType'> {
  connectionType: 'yes' | 'no' | 'what_if' | 'default';
}
