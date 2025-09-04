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
  role: varchar("role").notNull().default("user"), // admin, user
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
  actions: many(actions),
  workflows: many(workflows),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contacts.tenantId],
    references: [tenants.id],
  }),
  invoices: many(invoices),
  actions: many(actions),
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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
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
