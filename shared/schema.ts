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
  unique,
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
  role: varchar("role").notNull().default("user"), // owner, admin, user, partner, client_owner, client_user
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
  xeroExpiresAt: timestamp("xero_expires_at"),
  xeroSyncInterval: integer("xero_sync_interval").default(60), // minutes
  xeroLastSyncAt: timestamp("xero_last_sync_at"),
  xeroAutoSync: boolean("xero_auto_sync").default(true),
  collectionsAutomationEnabled: boolean("collections_automation_enabled").default(true),
  
  // Communication Mode: off, testing, soft_live, live
  communicationMode: varchar("communication_mode").default("testing"), // off, testing, soft_live, live
  testContactName: varchar("test_contact_name"), // Test contact name for soft_live mode
  testEmails: text("test_emails").array(), // Test email addresses for soft_live mode
  testPhones: text("test_phones").array(), // Test phone numbers for soft_live mode
  
  // Onboarding-specific fields
  companyLogoUrl: varchar("company_logo_url"),
  brandPrimaryColor: varchar("brand_primary_color").default("#17B6C3"),
  brandSecondaryColor: varchar("brand_secondary_color").default("#1396A1"),
  communicationTone: varchar("communication_tone").default("professional"), // professional, friendly, firm
  industry: varchar("industry"),
  companySize: varchar("company_size"), // small, medium, large, enterprise
  businessType: varchar("business_type").default("b2b"), // b2b, b2c, mixed
  primaryMarket: varchar("primary_market").default("domestic"), // domestic, international, both
  automationPreference: jsonb("automation_preference").default("{}"), // per customer segment preferences
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contacts table (supports both customers and vendors)
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  xeroContactId: varchar("xero_contact_id"),
  sageContactId: varchar("sage_contact_id"),
  quickBooksContactId: varchar("quick_books_contact_id"),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  companyName: varchar("company_name"),
  address: text("address"),
  role: varchar("role").notNull().default("customer"), // customer, vendor, both
  isActive: boolean("is_active").default(true),
  paymentTerms: integer("payment_terms").default(30), // days
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }),
  preferredContactMethod: varchar("preferred_contact_method").default("email"), // email, phone, sms
  taxNumber: varchar("tax_number"), // For vendors
  accountNumber: varchar("account_number"), // Vendor account number
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Performance indexes for search functionality
  index("idx_contacts_name").on(table.name),
  index("idx_contacts_email").on(table.email),
  index("idx_contacts_company_name").on(table.companyName),
  index("idx_contacts_tenant_id").on(table.tenantId),
]);

// Contact Notes table
export const contactNotes = pgTable("contact_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  content: text("content").notNull(),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Performance indexes for querying notes by contact
  index("idx_contact_notes_contact_id").on(table.contactId),
  index("idx_contact_notes_tenant_id").on(table.tenantId),
  index("idx_contact_notes_created_at").on(table.createdAt),
]);

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
  status: varchar("status").notNull().default("pending"), // pending, paid, overdue, cancelled, payment_plan
  collectionStage: varchar("collection_stage").default("initial"), // initial, reminder_1, reminder_2, formal_notice, final_notice, escalated
  paymentPlanId: varchar("payment_plan_id").references(() => paymentPlans.id),
  isOnHold: boolean("is_on_hold").default(false), // whether invoice is on hold (excluded from collections workflow)
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  description: text("description"),
  currency: varchar("currency").default("USD"),
  workflowId: varchar("workflow_id"),
  lastReminderSent: timestamp("last_reminder_sent"),
  reminderCount: integer("reminder_count").default(0),
  nextAction: varchar("next_action"), // email, sms, call, visit
  nextActionDate: timestamp("next_action_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Performance indexes for server-side filtering optimization
  index("idx_invoices_tenant_status").on(table.tenantId, table.status),
  index("idx_invoices_due_date").on(table.dueDate),
  index("idx_invoices_invoice_number").on(table.invoiceNumber),
  index("idx_invoices_created_at").on(table.createdAt),
  index("idx_invoices_contact_id").on(table.contactId),
  index("idx_invoices_next_action_date").on(table.tenantId, table.nextActionDate),
  index("idx_invoices_payment_plan_id").on(table.paymentPlanId),
]);

// Payment Plans table
export const paymentPlans = pgTable("payment_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  
  // Plan details
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  initialPaymentAmount: decimal("initial_payment_amount", { precision: 10, scale: 2 }).default("0"),
  
  // Dates
  planStartDate: timestamp("plan_start_date").notNull(),
  initialPaymentDate: timestamp("initial_payment_date"),
  
  // Configuration
  paymentFrequency: varchar("payment_frequency").notNull(), // weekly, monthly, quarterly
  numberOfPayments: integer("number_of_payments").notNull(),
  
  // Status and tracking
  status: varchar("status").notNull().default("active"), // active, completed, defaulted, cancelled
  currentPaymentNumber: integer("current_payment_number").default(0),
  totalPaidAmount: decimal("total_paid_amount", { precision: 10, scale: 2 }).default("0"),
  
  // Metadata
  notes: text("notes"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_plans_tenant").on(table.tenantId),
  index("idx_payment_plans_contact").on(table.contactId),
  index("idx_payment_plans_status").on(table.status),
  index("idx_payment_plans_start_date").on(table.planStartDate),
]);

// Payment Plan Schedules table (individual scheduled payments)
export const paymentPlanSchedules = pgTable("payment_plan_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentPlanId: varchar("payment_plan_id").notNull().references(() => paymentPlans.id),
  
  // Payment details
  paymentNumber: integer("payment_number").notNull(), // 1, 2, 3, etc.
  dueDate: timestamp("due_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  
  // Status tracking
  status: varchar("status").notNull().default("pending"), // pending, paid, overdue, skipped
  paymentDate: timestamp("payment_date"),
  paymentReference: varchar("payment_reference"), // Reference from accounting system
  paymentMethod: varchar("payment_method"), // bank_transfer, credit_card, cheque, etc.
  
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payment_plan_schedules_plan").on(table.paymentPlanId),
  index("idx_payment_plan_schedules_due_date").on(table.dueDate),
  index("idx_payment_plan_schedules_status").on(table.status),
  unique("unique_payment_plan_payment_number").on(table.paymentPlanId, table.paymentNumber),
]);

// Payment Plan Invoices table (links invoices to payment plans)
export const paymentPlanInvoices = pgTable("payment_plan_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentPlanId: varchar("payment_plan_id").notNull().references(() => paymentPlans.id),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  
  // Tracking
  addedAt: timestamp("added_at").defaultNow(),
  addedByUserId: varchar("added_by_user_id").notNull().references(() => users.id),
}, (table) => [
  index("idx_payment_plan_invoices_plan").on(table.paymentPlanId),
  index("idx_payment_plan_invoices_invoice").on(table.invoiceId),
  unique("unique_payment_plan_invoice").on(table.paymentPlanId, table.invoiceId),
]);

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

// Bills table (accounts payable)
export const bills = pgTable("bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  vendorId: varchar("vendor_id").notNull().references(() => contacts.id),
  xeroInvoiceId: varchar("xero_invoice_id"),
  sageInvoiceId: varchar("sage_invoice_id"),
  quickBooksInvoiceId: varchar("quick_books_invoice_id"),
  billNumber: varchar("bill_number").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status").notNull().default("pending"), // pending, paid, overdue, cancelled
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  description: text("description"),
  currency: varchar("currency").default("USD"),
  reference: varchar("reference"), // Vendor's reference number
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bill payments table (payments to vendors)
export const billPayments = pgTable("bill_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  billId: varchar("bill_id").notNull().references(() => bills.id),
  bankAccountId: varchar("bank_account_id").references(() => bankAccounts.id),
  xeroPaymentId: varchar("xero_payment_id"),
  sagePaymentId: varchar("sage_payment_id"),
  quickBooksPaymentId: varchar("quick_books_payment_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: varchar("payment_method").notNull(), // bank_transfer, credit_card, check, cash
  reference: varchar("reference"), // Payment reference number
  currency: varchar("currency").default("USD"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }).default("1"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bank accounts table
export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  xeroAccountId: varchar("xero_account_id"),
  sageAccountId: varchar("sage_account_id"),
  quickBooksAccountId: varchar("quick_books_account_id"),
  name: varchar("name").notNull(),
  accountNumber: varchar("account_number"),
  accountType: varchar("account_type").notNull(), // checking, savings, credit_card, cash
  currency: varchar("currency").default("USD"),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  bankName: varchar("bank_name"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bank transactions table
export const bankTransactions = pgTable("bank_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  bankAccountId: varchar("bank_account_id").notNull().references(() => bankAccounts.id),
  xeroTransactionId: varchar("xero_transaction_id"),
  sageTransactionId: varchar("sage_transaction_id"),
  quickBooksTransactionId: varchar("quick_books_transaction_id"),
  transactionDate: timestamp("transaction_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: varchar("type").notNull(), // debit, credit
  description: text("description"),
  reference: varchar("reference"),
  category: varchar("category"), // expense, income, transfer, etc.
  contactId: varchar("contact_id").references(() => contacts.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  billId: varchar("bill_id").references(() => bills.id),
  isReconciled: boolean("is_reconciled").default(false),
  reconciledAt: timestamp("reconciled_at"),
  metadata: jsonb("metadata"), // Additional provider-specific data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Budgets table (budget headers)
export const budgets = pgTable("budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name").notNull(),
  description: text("description"),
  budgetType: varchar("budget_type").notNull(), // annual, monthly, quarterly, project
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  currency: varchar("currency").default("USD"),
  status: varchar("status").notNull().default("draft"), // draft, active, completed, cancelled
  totalBudgetAmount: decimal("total_budget_amount", { precision: 12, scale: 2 }).default("0"),
  totalActualAmount: decimal("total_actual_amount", { precision: 12, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Budget lines table (individual budget line items)
export const budgetLines = pgTable("budget_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  budgetId: varchar("budget_id").notNull().references(() => budgets.id, { onDelete: "cascade" }),
  category: varchar("category").notNull(), // income, expense, asset, liability
  subcategory: varchar("subcategory"), // salaries, rent, marketing, etc.
  description: text("description"),
  budgetedAmount: decimal("budgeted_amount", { precision: 10, scale: 2 }).notNull(),
  actualAmount: decimal("actual_amount", { precision: 10, scale: 2 }).default("0"),
  variance: decimal("variance", { precision: 10, scale: 2 }).default("0"),
  variancePercentage: decimal("variance_percentage", { precision: 5, scale: 2 }).default("0"),
  period: varchar("period"), // monthly, quarterly, yearly breakdown
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Exchange rates table for multi-currency support
// NOTE: Exchange rates are intentionally system-wide (no tenantId) as currency exchange rates
// are global financial data that should be consistent across all tenants. This reduces 
// data redundancy and ensures all tenants get the same accurate rates from external providers.
export const exchangeRates = pgTable("exchange_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromCurrency: varchar("from_currency").notNull(),
  toCurrency: varchar("to_currency").notNull(),
  rate: decimal("rate", { precision: 10, scale: 6 }).notNull(),
  rateDate: timestamp("rate_date").notNull(),
  provider: varchar("provider").notNull().default("system"), // system, xe, fixer, etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sync state table for tracking provider sync cursors
export const syncState = pgTable("sync_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  provider: varchar("provider").notNull(), // xero, sage, quickbooks
  resource: varchar("resource").notNull(), // invoices, contacts, bills, transactions, etc.
  lastSyncAt: timestamp("last_sync_at"),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
  syncCursor: varchar("sync_cursor"), // Provider-specific cursor for incremental sync
  syncStatus: varchar("sync_status").notNull().default("idle"), // idle, running, success, error
  errorMessage: text("error_message"),
  recordsProcessed: integer("records_processed").default(0),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsFailed: integer("records_failed").default(0),
  metadata: jsonb("metadata"), // Provider-specific sync metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("sync_state_tenant_provider_resource").on(table.tenantId, table.provider, table.resource)
]);

// Provider connections table for OAuth and API management
export const providerConnections = pgTable("provider_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  provider: varchar("provider").notNull(), // xero, sage, quickbooks, stripe, etc.
  connectionName: varchar("connection_name"), // User-friendly name
  isActive: boolean("is_active").default(true),
  isConnected: boolean("is_connected").default(false),
  
  // OAuth/API credentials
  // TODO: SECURITY - These tokens should be encrypted at rest using a proper encryption service
  // Consider using AWS KMS, Azure Key Vault, or similar for secure token storage
  accessToken: text("access_token"), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted
  tokenExpiresAt: timestamp("token_expires_at"),
  providerId: varchar("provider_id"), // Provider-specific ID (e.g., Xero tenant ID)
  
  // Capabilities and scopes
  scopes: jsonb("scopes"), // Array of authorized scopes
  capabilities: jsonb("capabilities"), // What this connection can do
  
  // Connection metadata
  lastConnectedAt: timestamp("last_connected_at"),
  lastSyncAt: timestamp("last_sync_at"),
  syncFrequency: varchar("sync_frequency").default("hourly"), // hourly, daily, manual
  autoSyncEnabled: boolean("auto_sync_enabled").default(true),
  
  // Error tracking
  lastError: text("last_error"),
  errorCount: integer("error_count").default(0),
  lastErrorAt: timestamp("last_error_at"),
  
  connectionSettings: jsonb("connection_settings"), // Provider-specific settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("provider_connections_tenant_provider").on(table.tenantId, table.provider)
]);

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

// RBAC System Tables

// Permissions table - defines all available permissions in the system
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // "view_invoices", "edit_customers", "manage_users"
  category: varchar("category").notNull(), // "invoices", "customers", "admin", "reports"
  description: text("description").notNull(),
  resourceType: varchar("resource_type"), // "invoice", "customer", "user", "report"
  action: varchar("action").notNull(), // "view", "create", "edit", "delete", "manage"
  isSystemPermission: boolean("is_system_permission").default(false), // System vs tenant-specific
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Role permissions table - maps default permissions to roles
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: varchar("role").notNull(), // "owner", "admin", "accountant", "viewer", "user"
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  isDefault: boolean("is_default").default(true), // Whether this is a default permission for the role
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("role_permission_unique").on(table.role, table.permissionId)
]);

// User permissions table - custom permissions per user within a tenant
export const userPermissions = pgTable("user_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  granted: boolean("granted").notNull().default(true), // true = granted, false = explicitly revoked
  grantedBy: varchar("granted_by").references(() => users.id), // Who assigned this permission
  reason: text("reason"), // Optional reason for granting/revoking
  expiresAt: timestamp("expires_at"), // Optional expiration for temporary permissions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("user_permission_unique").on(table.userId, table.tenantId, table.permissionId)
]);

// User invitations table - track pending user invitations
export const userInvitations = pgTable("user_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email: varchar("email").notNull(),
  role: varchar("role").notNull().default("user"), // Pre-assigned role
  invitedBy: varchar("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  invitationToken: varchar("invitation_token").notNull().unique(),
  status: varchar("status").notNull().default("pending"), // pending, accepted, expired, revoked
  message: text("message"), // Optional personal message
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("invitation_tenant_email").on(table.tenantId, table.email)
]);

// Permission audit log - track permission changes
export const permissionAuditLog = pgTable("permission_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id), // The user whose permissions changed
  changedBy: varchar("changed_by").notNull().references(() => users.id), // Who made the change
  action: varchar("action").notNull(), // "role_assigned", "role_removed", "permission_granted", "permission_revoked"
  entityType: varchar("entity_type").notNull(), // "role", "permission"
  entityId: varchar("entity_id"), // Role name or permission ID
  oldValue: varchar("old_value"), // Previous role/permission state
  newValue: varchar("new_value"), // New role/permission state
  reason: text("reason"), // Optional reason for change
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
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

// SMS messages for bidirectional text communication
export const smsMessages = pgTable("sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  twilioMessageSid: varchar("twilio_message_sid").notNull().unique(), // Twilio message SID
  fromNumber: varchar("from_number").notNull(), // E.164 format
  toNumber: varchar("to_number").notNull(), // E.164 format
  direction: varchar("direction").notNull(), // "inbound" or "outbound"
  status: varchar("status").notNull().default("sent"), // "sent", "delivered", "failed", "received"
  body: text("body").notNull(), // Message content
  numSegments: integer("num_segments").default(1), // Number of SMS segments
  cost: decimal("cost", { precision: 6, scale: 4 }), // Cost of the SMS
  errorCode: varchar("error_code"), // Twilio error code if failed
  errorMessage: text("error_message"), // Error details if failed
  intent: varchar("intent"), // AI-detected intent: "payment_promise", "dispute", "query", "confirmation"
  sentiment: varchar("sentiment"), // "positive", "neutral", "negative"
  requiresResponse: boolean("requires_response").default(false),
  respondedAt: timestamp("responded_at"), // When we responded to an inbound message
  sentAt: timestamp("sent_at"), // When the message was sent/received
  deliveredAt: timestamp("delivered_at"), // When Twilio confirmed delivery
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sms_tenant_id").on(table.tenantId),
  index("idx_sms_contact_id").on(table.contactId),
  index("idx_sms_direction").on(table.direction),
  index("idx_sms_status").on(table.status),
]);

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
  bills: many(bills),
  billPayments: many(billPayments),
  bankAccounts: many(bankAccounts),
  bankTransactions: many(bankTransactions),
  budgets: many(budgets),
  syncState: many(syncState),
  providerConnections: many(providerConnections),
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
  bills: many(bills), // When contact is a vendor
  bankTransactions: many(bankTransactions),
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
  bankTransactions: many(bankTransactions),
  actions: many(actions),
  voiceCalls: many(voiceCalls),
}));

// New table relations
export const billsRelations = relations(bills, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [bills.tenantId],
    references: [tenants.id],
  }),
  vendor: one(contacts, {
    fields: [bills.vendorId],
    references: [contacts.id],
  }),
  payments: many(billPayments),
  bankTransactions: many(bankTransactions),
}));

export const billPaymentsRelations = relations(billPayments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [billPayments.tenantId],
    references: [tenants.id],
  }),
  bill: one(bills, {
    fields: [billPayments.billId],
    references: [bills.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [billPayments.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [bankAccounts.tenantId],
    references: [tenants.id],
  }),
  transactions: many(bankTransactions),
  billPayments: many(billPayments),
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [bankTransactions.tenantId],
    references: [tenants.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [bankTransactions.bankAccountId],
    references: [bankAccounts.id],
  }),
  contact: one(contacts, {
    fields: [bankTransactions.contactId],
    references: [contacts.id],
  }),
  invoice: one(invoices, {
    fields: [bankTransactions.invoiceId],
    references: [invoices.id],
  }),
  bill: one(bills, {
    fields: [bankTransactions.billId],
    references: [bills.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [budgets.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [budgets.createdBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [budgets.approvedBy],
    references: [users.id],
  }),
  budgetLines: many(budgetLines),
}));

export const budgetLinesRelations = relations(budgetLines, ({ one }) => ({
  budget: one(budgets, {
    fields: [budgetLines.budgetId],
    references: [budgets.id],
  }),
}));

export const syncStateRelations = relations(syncState, ({ one }) => ({
  tenant: one(tenants, {
    fields: [syncState.tenantId],
    references: [tenants.id],
  }),
}));

export const providerConnectionsRelations = relations(providerConnections, ({ one }) => ({
  tenant: one(tenants, {
    fields: [providerConnections.tenantId],
    references: [tenants.id],
  }),
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

// AI Learning Tables for Credit Control Optimization
// Customer learning profiles - tracks what we learn about each customer's preferences
export const customerLearningProfiles = pgTable("customer_learning_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  
  // Channel effectiveness scores (0-1, start at 0.5 neutral)
  emailEffectiveness: decimal("email_effectiveness", { precision: 3, scale: 2 }).default("0.5"),
  smsEffectiveness: decimal("sms_effectiveness", { precision: 3, scale: 2 }).default("0.5"),
  voiceEffectiveness: decimal("voice_effectiveness", { precision: 3, scale: 2 }).default("0.5"),
  
  // Response patterns
  totalInteractions: integer("total_interactions").default(0),
  successfulActions: integer("successful_actions").default(0),
  averageResponseTime: integer("average_response_time"), // Hours to response
  preferredChannel: varchar("preferred_channel"), // email, sms, voice
  preferredContactTime: varchar("preferred_contact_time"), // morning, afternoon, evening
  
  // Payment behavior patterns
  averagePaymentDelay: integer("average_payment_delay"), // Days after due date
  paymentReliability: decimal("payment_reliability", { precision: 3, scale: 2 }).default("0.5"),
  
  // AI learning confidence (0-1, how confident we are in our recommendations)
  learningConfidence: decimal("learning_confidence", { precision: 3, scale: 2 }).default("0.1"),
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("customer_learning_profiles_tenant_contact").on(table.tenantId, table.contactId)
]);

// Action effectiveness tracking - measures success of each collection action
export const actionEffectiveness = pgTable("action_effectiveness", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actionId: varchar("action_id").notNull().references(() => actions.id),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  
  // Delivery and engagement tracking
  wasDelivered: boolean("was_delivered").default(false),
  wasOpened: boolean("was_opened").default(false), // Email opens, SMS reads
  wasClicked: boolean("was_clicked").default(false), // Link clicks
  wasReplied: boolean("was_replied").default(false),
  replyTime: integer("reply_time"), // Hours to reply after action
  replySentiment: varchar("reply_sentiment"), // positive, neutral, negative
  
  // Payment outcome tracking
  ledToPayment: boolean("led_to_payment").default(false),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  paymentDelay: integer("payment_delay"), // Days after action until payment
  partialPayment: boolean("partial_payment").default(false),
  
  // Effectiveness scoring (0-1)
  effectivenessScore: decimal("effectiveness_score", { precision: 3, scale: 2 }),
  
  // A/B testing support
  testVariant: varchar("test_variant"), // A, B, control
  testId: varchar("test_id"), // Groups actions into tests
  
  createdAt: timestamp("created_at").defaultNow(),
});

// A/B testing framework for collection strategies
export const collectionABTests = pgTable("collection_ab_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  testName: varchar("test_name").notNull(),
  testType: varchar("test_type").notNull(), // channel, timing, template, sequence
  description: text("description"),
  
  // Test configuration
  variantA: jsonb("variant_a"), // {channel: "email", template: "gentle", timing: 7}
  variantB: jsonb("variant_b"), // {channel: "sms", template: "gentle", timing: 7}
  targetSegment: jsonb("target_segment"), // Customer criteria for test
  
  // Test status and results
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  
  variantACount: integer("variant_a_count").default(0),
  variantBCount: integer("variant_b_count").default(0),
  variantASuccessRate: decimal("variant_a_success_rate", { precision: 5, scale: 2 }),
  variantBSuccessRate: decimal("variant_b_success_rate", { precision: 5, scale: 2 }),
  
  winner: varchar("winner"), // A, B, inconclusive
  confidenceLevel: decimal("confidence_level", { precision: 3, scale: 2 }),
  significanceReached: boolean("significance_reached").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Onboarding progress tracking table
export const onboardingProgress = pgTable("onboarding_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  currentPhase: varchar("current_phase").notNull().default("technical_connection"), // technical_connection, business_setup, brand_customization, ai_review_launch
  completedPhases: jsonb("completed_phases").default("[]"), // Array of completed phases
  phaseData: jsonb("phase_data").default("{}"), // Data collected in each phase
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("onboarding_progress_tenant").on(table.tenantId)
]);

// Industry-specific onboarding templates
export const onboardingTemplates = pgTable("onboarding_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  industry: varchar("industry").notNull(),
  businessType: varchar("business_type").notNull(), // b2b, b2c, mixed
  templateType: varchar("template_type").notNull(), // workflow, communication, automation_settings, collection_schedule
  templateData: jsonb("template_data").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_onboarding_templates_industry_type").on(table.industry, table.businessType, table.templateType)
]);

// AI learning relations
export const customerLearningProfilesRelations = relations(customerLearningProfiles, ({ one }) => ({
  tenant: one(tenants, {
    fields: [customerLearningProfiles.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [customerLearningProfiles.contactId],
    references: [contacts.id],
  }),
}));

export const actionEffectivenessRelations = relations(actionEffectiveness, ({ one }) => ({
  action: one(actions, {
    fields: [actionEffectiveness.actionId],
    references: [actions.id],
  }),
  tenant: one(tenants, {
    fields: [actionEffectiveness.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [actionEffectiveness.contactId],
    references: [contacts.id],
  }),
}));

export const collectionABTestsRelations = relations(collectionABTests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [collectionABTests.tenantId],
    references: [tenants.id],
  }),
}));

// Onboarding relations
export const onboardingProgressRelations = relations(onboardingProgress, ({ one }) => ({
  tenant: one(tenants, {
    fields: [onboardingProgress.tenantId],
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

export const insertContactNoteSchema = createInsertSchema(contactNotes).omit({
  id: true,
  createdAt: true,
}).extend({
  content: z.string().min(1, "Content is required").max(5000, "Content must be 5000 characters or less"),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// Payment Plan schemas
export const insertPaymentPlanSchema = createInsertSchema(paymentPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentPaymentNumber: true,
  totalPaidAmount: true,
}).extend({
  totalAmount: z.string().min(1, "Total amount is required"),
  initialPaymentAmount: z.string().default("0"),
  numberOfPayments: z.number().min(1, "At least 1 payment required").max(120, "Maximum 120 payments allowed"),
  planStartDate: z.date({ required_error: "Plan start date is required" }),
  initialPaymentDate: z.date().optional(),
  notes: z.string().max(1000, "Notes must be 1000 characters or less").optional(),
});

export const insertPaymentPlanScheduleSchema = createInsertSchema(paymentPlanSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  paymentDate: true,
  paymentReference: true,
  paymentMethod: true,
});

export const insertPaymentPlanInvoiceSchema = createInsertSchema(paymentPlanInvoices).omit({
  id: true,
  addedAt: true,
});

// Payment Plan TypeScript types
export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type InsertPaymentPlan = z.infer<typeof insertPaymentPlanSchema>;
export type PaymentPlanSchedule = typeof paymentPlanSchedules.$inferSelect;
export type InsertPaymentPlanSchedule = z.infer<typeof insertPaymentPlanScheduleSchema>;
export type PaymentPlanInvoice = typeof paymentPlanInvoices.$inferSelect;
export type InsertPaymentPlanInvoice = z.infer<typeof insertPaymentPlanInvoiceSchema>;

// Outstanding invoice summary for payment plan selection
export const outstandingInvoiceSummarySchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  amount: z.string(), // Decimal as string for precision
  dueDate: z.string(), // ISO date string
  contactId: z.string(),
  contactName: z.string(),
  daysPastDue: z.number(),
});

export type OutstandingInvoiceSummary = z.infer<typeof outstandingInvoiceSummarySchema>;

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

// AI Learning insert schemas
export const insertCustomerLearningProfileSchema = createInsertSchema(customerLearningProfiles).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertActionEffectivenessSchema = createInsertSchema(actionEffectiveness).omit({
  id: true,
  createdAt: true,
});

export const insertCollectionABTestSchema = createInsertSchema(collectionABTests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Onboarding insert schemas
export const insertOnboardingProgressSchema = createInsertSchema(onboardingProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
});

export const insertOnboardingTemplateSchema = createInsertSchema(onboardingTemplates).omit({
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

// AI Learning types
export type InsertCustomerLearningProfile = z.infer<typeof insertCustomerLearningProfileSchema>;
export type CustomerLearningProfile = typeof customerLearningProfiles.$inferSelect;
export type InsertActionEffectiveness = z.infer<typeof insertActionEffectivenessSchema>;
export type ActionEffectiveness = typeof actionEffectiveness.$inferSelect;
export type InsertCollectionABTest = z.infer<typeof insertCollectionABTestSchema>;
export type CollectionABTest = typeof collectionABTests.$inferSelect;

// Onboarding types
export type InsertOnboardingProgress = z.infer<typeof insertOnboardingProgressSchema>;
export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingTemplate = z.infer<typeof insertOnboardingTemplateSchema>;
export type OnboardingTemplate = typeof onboardingTemplates.$inferSelect;

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

// Zod schemas for new accounting tables
export const insertBillSchema = createInsertSchema(bills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBillPaymentSchema = createInsertSchema(billPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBankTransactionSchema = createInsertSchema(bankTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBudgetLineSchema = createInsertSchema(budgetLines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSyncStateSchema = createInsertSchema(syncState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProviderConnectionSchema = createInsertSchema(providerConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// TypeScript types for new accounting tables
export type Bill = typeof bills.$inferSelect;
export type InsertBill = z.infer<typeof insertBillSchema>;
export type BillPayment = typeof billPayments.$inferSelect;
export type InsertBillPayment = z.infer<typeof insertBillPaymentSchema>;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;
export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type BudgetLine = typeof budgetLines.$inferSelect;
export type InsertBudgetLine = z.infer<typeof insertBudgetLineSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type SyncState = typeof syncState.$inferSelect;
export type InsertSyncState = z.infer<typeof insertSyncStateSchema>;
export type ProviderConnection = typeof providerConnections.$inferSelect;
export type InsertProviderConnection = z.infer<typeof insertProviderConnectionSchema>;

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

// Standard transformation types for provider integration
export interface StandardVendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  taxNumber?: string;
  accountNumber?: string;
  paymentTerms?: number;
  isActive: boolean;
  providerContactId: string; // Original provider ID
  provider: string; // xero, sage, quickbooks
  metadata?: Record<string, any>; // Provider-specific additional data
}

export interface StandardBill {
  id: string;
  billNumber: string;
  vendorId: string;
  amount: number;
  amountPaid: number;
  taxAmount: number;
  status: string; // pending, paid, overdue, cancelled
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  description?: string;
  currency: string;
  reference?: string;
  providerBillId: string; // Original provider ID
  provider: string; // xero, sage, quickbooks
  metadata?: Record<string, any>; // Provider-specific additional data
}

export interface StandardBillPayment {
  id: string;
  billId: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string; // bank_transfer, credit_card, check, cash
  reference?: string;
  currency: string;
  exchangeRate: number;
  providerPaymentId: string; // Original provider ID
  provider: string; // xero, sage, quickbooks
  metadata?: Record<string, any>; // Provider-specific additional data
}

export interface StandardBankAccount {
  id: string;
  name: string;
  accountNumber?: string;
  accountType: string; // checking, savings, credit_card, cash
  currency: string;
  currentBalance: number;
  isActive: boolean;
  bankName?: string;
  description?: string;
  providerAccountId: string; // Original provider ID
  provider: string; // xero, sage, quickbooks
  metadata?: Record<string, any>; // Provider-specific additional data
}

export interface StandardBankTransaction {
  id: string;
  bankAccountId: string;
  transactionDate: Date;
  amount: number;
  type: string; // debit, credit
  description?: string;
  reference?: string;
  category?: string;
  contactId?: string;
  invoiceId?: string;
  billId?: string;
  isReconciled: boolean;
  reconciledAt?: Date;
  providerTransactionId: string; // Original provider ID
  provider: string; // xero, sage, quickbooks
  metadata?: Record<string, any>; // Provider-specific additional data
}

export interface StandardBudget {
  id: string;
  name: string;
  description?: string;
  budgetType: string; // annual, monthly, quarterly, project
  startDate: Date;
  endDate: Date;
  currency: string;
  status: string; // draft, active, completed, cancelled
  totalBudgetAmount: number;
  totalActualAmount: number;
  isActive: boolean;
  providerBudgetId?: string; // Original provider ID (if supported)
  provider?: string; // xero, sage, quickbooks
  metadata?: Record<string, any>; // Provider-specific additional data
}

export interface StandardBudgetLine {
  id: string;
  budgetId: string;
  category: string; // income, expense, asset, liability
  subcategory?: string; // salaries, rent, marketing, etc.
  description?: string;
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  period?: string; // monthly, quarterly, yearly breakdown
  isActive: boolean;
  notes?: string;
  providerBudgetLineId?: string; // Original provider ID (if supported)
  provider?: string; // xero, sage, quickbooks
  metadata?: Record<string, any>; // Provider-specific additional data
}

export interface StandardExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  rateDate: Date;
  provider: string; // system, xe, fixer, etc.
  isActive: boolean;
  metadata?: Record<string, any>; // Provider-specific additional data
}

// === ADVANCED ML TABLES FOR WEEK 2 ===

// Payment prediction models - ML predictions for payment probability and timing
export const paymentPredictions = pgTable("payment_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  
  // Prediction metrics
  paymentProbability: decimal("payment_probability", { precision: 5, scale: 4 }), // 0-1
  predictedPaymentDate: timestamp("predicted_payment_date"),
  paymentConfidenceScore: decimal("payment_confidence_score", { precision: 5, scale: 4 }), // 0-1
  
  // Risk assessment
  defaultRisk: decimal("default_risk", { precision: 5, scale: 4 }), // 0-1
  escalationRisk: decimal("escalation_risk", { precision: 5, scale: 4 }), // 0-1
  
  // Model metadata
  modelVersion: varchar("model_version").notNull(),
  predictionDate: timestamp("prediction_date").defaultNow(),
  features: jsonb("features"), // Input features used for prediction
  
  // Validation tracking
  actualPaymentDate: timestamp("actual_payment_date"),
  actualOutcome: varchar("actual_outcome"), // paid, defaulted, escalated
  predictionAccuracy: decimal("prediction_accuracy", { precision: 5, scale: 4 }), // 0-1
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("payment_predictions_tenant_idx").on(table.tenantId),
  index("payment_predictions_invoice_idx").on(table.invoiceId),
  index("payment_predictions_contact_idx").on(table.contactId),
  index("payment_predictions_date_idx").on(table.predictionDate),
]);

// Dynamic risk scores - Real-time risk assessment for customers
export const riskScores = pgTable("risk_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  
  // Risk metrics
  overallRiskScore: decimal("overall_risk_score", { precision: 5, scale: 4 }), // 0-1
  paymentRisk: decimal("payment_risk", { precision: 5, scale: 4 }), // 0-1
  creditRisk: decimal("credit_risk", { precision: 5, scale: 4 }), // 0-1
  communicationRisk: decimal("communication_risk", { precision: 5, scale: 4 }), // 0-1
  
  // Risk factors
  riskFactors: jsonb("risk_factors"), // Array of contributing factors
  riskTrend: varchar("risk_trend"), // increasing, stable, decreasing
  
  // Historical context
  previousRiskScore: decimal("previous_risk_score", { precision: 5, scale: 4 }),
  riskChangePercent: decimal("risk_change_percent", { precision: 6, scale: 3 }),
  
  // Model metadata
  modelVersion: varchar("model_version").notNull(),
  lastCalculated: timestamp("last_calculated").defaultNow(),
  nextReassessment: timestamp("next_reassessment"),
  
  // Action recommendations
  recommendedActions: jsonb("recommended_actions"), // Array of suggested actions
  urgencyLevel: varchar("urgency_level"), // low, medium, high, critical
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("risk_scores_tenant_contact").on(table.tenantId, table.contactId),
  index("risk_scores_tenant_idx").on(table.tenantId),
  index("risk_scores_overall_risk_idx").on(table.overallRiskScore),
  index("risk_scores_urgency_idx").on(table.urgencyLevel),
]);

// Customer segments - ML-based customer clustering and segmentation
export const customerSegments = pgTable("customer_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Segment definition
  segmentName: varchar("segment_name").notNull(),
  segmentType: varchar("segment_type").notNull(), // behavioral, demographic, payment_pattern, risk_based
  description: text("description"),
  
  // Segment characteristics
  segmentCriteria: jsonb("segment_criteria"), // Rules or ML cluster parameters
  typicalBehavior: jsonb("typical_behavior"), // Common behaviors in segment
  
  // Performance metrics
  averagePaymentTime: integer("average_payment_time"), // Days
  paymentSuccessRate: decimal("payment_success_rate", { precision: 5, scale: 4 }),
  preferredChannel: varchar("preferred_channel"),
  responseRate: decimal("response_rate", { precision: 5, scale: 4 }),
  
  // Segment size and composition
  memberCount: integer("member_count").default(0),
  percentOfCustomers: decimal("percent_of_customers", { precision: 5, scale: 2 }),
  
  // ML clustering data
  clusterCenter: jsonb("cluster_center"), // Centroid coordinates for ML clusters
  clusterVariance: decimal("cluster_variance", { precision: 10, scale: 6 }),
  
  // Model metadata
  modelVersion: varchar("model_version").notNull(),
  lastRecalculated: timestamp("last_recalculated").defaultNow(),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("customer_segments_tenant_idx").on(table.tenantId),
  index("customer_segments_type_idx").on(table.segmentType),
  index("customer_segments_active_idx").on(table.isActive),
]);

// Customer segment assignments - Which customers belong to which segments
export const customerSegmentAssignments = pgTable("customer_segment_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  segmentId: varchar("segment_id").notNull().references(() => customerSegments.id),
  
  // Assignment metadata
  assignmentConfidence: decimal("assignment_confidence", { precision: 5, scale: 4 }), // 0-1
  distanceFromCenter: decimal("distance_from_center", { precision: 10, scale: 6 }),
  
  // Assignment history
  previousSegmentId: varchar("previous_segment_id"),
  assignmentDate: timestamp("assignment_date").defaultNow(),
  
  // Model metadata
  modelVersion: varchar("model_version").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("segment_assignments_tenant_contact").on(table.tenantId, table.contactId),
  index("segment_assignments_tenant_idx").on(table.tenantId),
  index("segment_assignments_contact_idx").on(table.contactId),
  index("segment_assignments_segment_idx").on(table.segmentId),
]);

// Seasonal patterns - Time-based payment pattern recognition
export const seasonalPatterns = pgTable("seasonal_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id"), // Null for global patterns, specific for customer patterns
  
  // Pattern identification
  patternType: varchar("pattern_type").notNull(), // daily, weekly, monthly, quarterly, yearly
  patternName: varchar("pattern_name").notNull(),
  description: text("description"),
  
  // Temporal characteristics
  timeComponent: varchar("time_component"), // monday, january, q1, holiday_season
  cyclePeriod: integer("cycle_period"), // Length in days/weeks/months
  
  // Pattern strength and reliability
  patternStrength: decimal("pattern_strength", { precision: 5, scale: 4 }), // 0-1
  confidence: decimal("confidence", { precision: 5, scale: 4 }), // 0-1
  reliability: decimal("reliability", { precision: 5, scale: 4 }), // 0-1
  
  // Statistical measures
  averagePaymentDelay: integer("average_payment_delay"), // Days
  paymentVariance: decimal("payment_variance", { precision: 10, scale: 6 }),
  sampleSize: integer("sample_size"), // Number of observations
  
  // Pattern data
  historicalData: jsonb("historical_data"), // Time series data points
  trendDirection: varchar("trend_direction"), // increasing, decreasing, stable, cyclical
  
  // Prediction capabilities
  nextPredictedPeak: timestamp("next_predicted_peak"),
  nextPredictedTrough: timestamp("next_predicted_trough"),
  seasonalMultiplier: decimal("seasonal_multiplier", { precision: 6, scale: 4 }), // Adjustment factor
  
  // Model metadata
  modelVersion: varchar("model_version").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("seasonal_patterns_tenant_idx").on(table.tenantId),
  index("seasonal_patterns_contact_idx").on(table.contactId),
  index("seasonal_patterns_type_idx").on(table.patternType),
  index("seasonal_patterns_strength_idx").on(table.patternStrength),
]);

// ML model performance tracking
export const mlModelPerformance = pgTable("ml_model_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Model identification
  modelName: varchar("model_name").notNull(), // payment_prediction, risk_scoring, segmentation
  modelVersion: varchar("model_version").notNull(),
  modelType: varchar("model_type").notNull(), // classification, regression, clustering
  
  // Performance metrics
  accuracy: decimal("accuracy", { precision: 5, scale: 4 }),
  precision: decimal("precision", { precision: 5, scale: 4 }),
  recall: decimal("recall", { precision: 5, scale: 4 }),
  f1Score: decimal("f1_score", { precision: 5, scale: 4 }),
  auc: decimal("auc", { precision: 5, scale: 4 }), // Area under curve
  
  // Business metrics
  businessImpact: jsonb("business_impact"), // Revenue, efficiency gains, etc.
  predictionCount: integer("prediction_count"),
  correctPredictions: integer("correct_predictions"),
  
  // Model details
  trainingDataSize: integer("training_data_size"),
  testDataSize: integer("test_data_size"),
  features: jsonb("features"), // Features used in model
  hyperparameters: jsonb("hyperparameters"),
  
  // Deployment tracking
  deploymentDate: timestamp("deployment_date").defaultNow(),
  isActive: boolean("is_active").default(true),
  
  // Performance over time
  evaluationPeriodStart: timestamp("evaluation_period_start"),
  evaluationPeriodEnd: timestamp("evaluation_period_end"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("ml_performance_tenant_idx").on(table.tenantId),
  index("ml_performance_model_idx").on(table.modelName, table.modelVersion),
  index("ml_performance_active_idx").on(table.isActive),
]);

// Relations for new ML tables
export const paymentPredictionsRelations = relations(paymentPredictions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentPredictions.tenantId],
    references: [tenants.id],
  }),
  invoice: one(invoices, {
    fields: [paymentPredictions.invoiceId],
    references: [invoices.id],
  }),
  contact: one(contacts, {
    fields: [paymentPredictions.contactId],
    references: [contacts.id],
  }),
}));

export const riskScoresRelations = relations(riskScores, ({ one }) => ({
  tenant: one(tenants, {
    fields: [riskScores.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [riskScores.contactId],
    references: [contacts.id],
  }),
}));

export const customerSegmentsRelations = relations(customerSegments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customerSegments.tenantId],
    references: [tenants.id],
  }),
  assignments: many(customerSegmentAssignments),
}));

export const customerSegmentAssignmentsRelations = relations(customerSegmentAssignments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [customerSegmentAssignments.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [customerSegmentAssignments.contactId],
    references: [contacts.id],
  }),
  segment: one(customerSegments, {
    fields: [customerSegmentAssignments.segmentId],
    references: [customerSegments.id],
  }),
}));

export const seasonalPatternsRelations = relations(seasonalPatterns, ({ one }) => ({
  tenant: one(tenants, {
    fields: [seasonalPatterns.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [seasonalPatterns.contactId],
    references: [contacts.id],
  }),
}));

export const mlModelPerformanceRelations = relations(mlModelPerformance, ({ one }) => ({
  tenant: one(tenants, {
    fields: [mlModelPerformance.tenantId],
    references: [tenants.id],
  }),
}));

// Insert schemas for new ML tables
export const insertPaymentPredictionSchema = createInsertSchema(paymentPredictions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRiskScoreSchema = createInsertSchema(riskScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSegmentSchema = createInsertSchema(customerSegments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSegmentAssignmentSchema = createInsertSchema(customerSegmentAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertSeasonalPatternSchema = createInsertSchema(seasonalPatterns).omit({
  id: true,
  createdAt: true,
});

export const insertMlModelPerformanceSchema = createInsertSchema(mlModelPerformance).omit({
  id: true,
  createdAt: true,
});

// RBAC Insert Schemas
export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPermissionAuditLogSchema = createInsertSchema(permissionAuditLog).omit({
  id: true,
  createdAt: true,
});

// Type exports for RBAC tables
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;

export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;

export type PermissionAuditLog = typeof permissionAuditLog.$inferSelect;
export type InsertPermissionAuditLog = z.infer<typeof insertPermissionAuditLogSchema>;

// Type exports for new ML tables
export type PaymentPrediction = typeof paymentPredictions.$inferSelect;
export type InsertPaymentPrediction = z.infer<typeof insertPaymentPredictionSchema>;

export type RiskScore = typeof riskScores.$inferSelect;
export type InsertRiskScore = z.infer<typeof insertRiskScoreSchema>;

export type CustomerSegment = typeof customerSegments.$inferSelect;
export type InsertCustomerSegment = z.infer<typeof insertCustomerSegmentSchema>;

export type CustomerSegmentAssignment = typeof customerSegmentAssignments.$inferSelect;
export type InsertCustomerSegmentAssignment = z.infer<typeof insertCustomerSegmentAssignmentSchema>;

export type SeasonalPattern = typeof seasonalPatterns.$inferSelect;
export type InsertSeasonalPattern = z.infer<typeof insertSeasonalPatternSchema>;

export type MlModelPerformance = typeof mlModelPerformance.$inferSelect;
export type InsertMlModelPerformance = z.infer<typeof insertMlModelPerformanceSchema>;

// Action Centre Tables

// Action items table for managing collections and customer communication tasks
export const actionItems = pgTable("action_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id), // nullable - some actions may not be invoice-specific
  type: varchar("type").notNull(), // 'nudge', 'call', 'email', 'sms', 'review', 'dispute', 'ptp_followup'
  status: varchar("status").notNull().default("open"), // 'open', 'in_progress', 'completed', 'snoozed', 'canceled'
  priority: varchar("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  dueAt: timestamp("due_at").notNull(),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id), // nullable - unassigned actions
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  notes: text("notes"), // nullable - additional context or instructions
  outcome: text("outcome"), // nullable - result/outcome after completion
  lastCommunicationId: varchar("last_communication_id"), // nullable - reference to last communication sent
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Performance indexes for action queue management
  index("idx_action_items_tenant_status_due").on(table.tenantId, table.status, table.dueAt),
  index("idx_action_items_tenant_assigned").on(table.tenantId, table.assignedToUserId),
  index("idx_action_items_tenant_invoice").on(table.tenantId, table.invoiceId),
  index("idx_action_items_contact_id").on(table.contactId),
  index("idx_action_items_type").on(table.type),
]);

// Action logs table for tracking events and activities related to action items
export const actionLogs = pgTable("action_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  actionItemId: varchar("action_item_id").notNull().references(() => actionItems.id, { onDelete: "cascade" }),
  eventType: varchar("event_type").notNull(), // 'created', 'assigned', 'sent_email', 'sent_sms', 'called', 'completed', 'snoozed', 'escalated', 'note'
  details: jsonb("details"), // Additional event-specific data (e.g., email subject, call duration, etc.)
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Performance index for action history lookup
  index("idx_action_logs_tenant_action").on(table.tenantId, table.actionItemId),
  index("idx_action_logs_event_type").on(table.eventType),
  index("idx_action_logs_created_at").on(table.createdAt),
]);

// Payment promises table for tracking customer payment commitments
export const paymentPromises = pgTable("payment_promises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  promisedAmount: decimal("promised_amount", { precision: 10, scale: 2 }).notNull(),
  promisedDate: timestamp("promised_date").notNull(),
  status: varchar("status").notNull().default("open"), // 'open', 'kept', 'broken', 'rescheduled'
  notes: text("notes"), // Additional context about the promise
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Performance indexes for payment promise tracking
  index("idx_payment_promises_tenant_status").on(table.tenantId, table.status),
  index("idx_payment_promises_tenant_invoice").on(table.tenantId, table.invoiceId),
  index("idx_payment_promises_promised_date").on(table.promisedDate),
  index("idx_payment_promises_contact_id").on(table.contactId),
]);

// Relations for Action Centre tables
export const actionItemsRelations = relations(actionItems, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [actionItems.tenantId],
    references: [tenants.id],
  }),
  contact: one(contacts, {
    fields: [actionItems.contactId],
    references: [contacts.id],
  }),
  invoice: one(invoices, {
    fields: [actionItems.invoiceId],
    references: [invoices.id],
  }),
  assignedToUser: one(users, {
    fields: [actionItems.assignedToUserId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [actionItems.createdByUserId],
    references: [users.id],
  }),
  logs: many(actionLogs),
}));

export const actionLogsRelations = relations(actionLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [actionLogs.tenantId],
    references: [tenants.id],
  }),
  actionItem: one(actionItems, {
    fields: [actionLogs.actionItemId],
    references: [actionItems.id],
  }),
  createdByUser: one(users, {
    fields: [actionLogs.createdByUserId],
    references: [users.id],
  }),
}));

export const paymentPromisesRelations = relations(paymentPromises, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentPromises.tenantId],
    references: [tenants.id],
  }),
  invoice: one(invoices, {
    fields: [paymentPromises.invoiceId],
    references: [invoices.id],
  }),
  contact: one(contacts, {
    fields: [paymentPromises.contactId],
    references: [contacts.id],
  }),
  createdByUser: one(users, {
    fields: [paymentPromises.createdByUserId],
    references: [users.id],
  }),
}));

// Insert schemas for Action Centre tables
export const insertActionItemSchema = createInsertSchema(actionItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActionLogSchema = createInsertSchema(actionLogs).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentPromiseSchema = createInsertSchema(paymentPromises).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for Contact Notes
export type ContactNote = typeof contactNotes.$inferSelect;
export type InsertContactNote = z.infer<typeof insertContactNoteSchema>;

// Type exports for Action Centre tables
export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;

export type ActionLog = typeof actionLogs.$inferSelect;
export type InsertActionLog = z.infer<typeof insertActionLogSchema>;

export type PaymentPromise = typeof paymentPromises.$inferSelect;
export type InsertPaymentPromise = z.infer<typeof insertPaymentPromiseSchema>;

// === PARTNER-CLIENT SUBSCRIPTION SYSTEM ===

// Subscription plans for partners and clients
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // "Partner Pro", "Client Standard", etc.
  type: varchar("type").notNull(), // "partner", "client"
  description: text("description"),
  
  // Pricing
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
  currency: varchar("currency").default("USD"),
  
  // Limits and features
  maxClientTenants: integer("max_client_tenants").default(0), // 0 = unlimited for partners
  maxUsers: integer("max_users").default(5),
  maxInvoicesPerMonth: integer("max_invoices_per_month").default(1000),
  
  // Feature flags
  features: jsonb("features").default("[]"), // Array of feature names
  
  // Stripe integration
  stripePriceId: varchar("stripe_price_id"),
  stripeProductId: varchar("stripe_product_id"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Partner-client relationships
export const partnerClientRelationships = pgTable("partner_client_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // The partner (accountant)
  partnerUserId: varchar("partner_user_id").notNull().references(() => users.id),
  partnerTenantId: varchar("partner_tenant_id").notNull().references(() => tenants.id),
  
  // The client tenant they have access to
  clientTenantId: varchar("client_tenant_id").notNull().references(() => tenants.id),
  
  // Relationship metadata
  status: varchar("status").notNull().default("active"), // active, suspended, terminated
  accessLevel: varchar("access_level").notNull().default("full"), // full, read_only, limited
  
  // Permission overrides
  permissions: jsonb("permissions").default("[]"), // Specific permissions for this relationship
  
  // Relationship tracking
  establishedAt: timestamp("established_at").defaultNow(),
  establishedBy: varchar("established_by").notNull(), // "invitation", "direct_assignment"
  lastAccessedAt: timestamp("last_accessed_at"),
  
  // Termination tracking
  terminatedAt: timestamp("terminated_at"),
  terminatedBy: varchar("terminated_by").references(() => users.id),
  terminationReason: text("termination_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Ensure unique partner-client relationships
  unique("unique_partner_client").on(table.partnerUserId, table.clientTenantId),
  // Performance indexes
  index("idx_partner_relationships_partner").on(table.partnerUserId),
  index("idx_partner_relationships_client").on(table.clientTenantId),
  index("idx_partner_relationships_status").on(table.status),
]);

// Tenant invitations system
export const tenantInvitations = pgTable("tenant_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Invitation details
  clientTenantId: varchar("client_tenant_id").notNull().references(() => tenants.id),
  invitedByUserId: varchar("invited_by_user_id").notNull().references(() => users.id),
  
  // Partner being invited
  partnerEmail: varchar("partner_email").notNull(),
  partnerUserId: varchar("partner_user_id").references(() => users.id), // Set when partner exists
  
  // Invitation configuration
  accessLevel: varchar("access_level").notNull().default("full"),
  permissions: jsonb("permissions").default("[]"),
  personalMessage: text("personal_message"),
  
  // Status tracking
  status: varchar("status").notNull().default("pending"), // pending, accepted, declined, expired, cancelled
  
  // Response tracking
  respondedAt: timestamp("responded_at"),
  responseMessage: text("response_message"),
  
  // Expiration
  expiresAt: timestamp("expires_at").notNull(), // 7 days from creation
  
  // Email tracking
  emailSentAt: timestamp("email_sent_at"),
  emailOpenedAt: timestamp("email_opened_at"),
  remindersSent: integer("reminders_sent").default(0),
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Performance indexes
  index("idx_invitations_client_tenant").on(table.clientTenantId),
  index("idx_invitations_partner_email").on(table.partnerEmail),
  index("idx_invitations_status").on(table.status),
  index("idx_invitations_expires_at").on(table.expiresAt),
]);

// Enhanced tenants table for partner support
export const tenantMetadata = pgTable("tenant_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Tenant type and subscription
  tenantType: varchar("tenant_type").notNull().default("client"), // "partner", "client"
  subscriptionPlanId: varchar("subscription_plan_id").references(() => subscriptionPlans.id),
  
  // Billing information
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  billingEmail: varchar("billing_email"),
  
  // Usage tracking
  currentMonthInvoices: integer("current_month_invoices").default(0),
  currentClientCount: integer("current_client_count").default(0), // For partners
  
  // Subscription status
  subscriptionStatus: varchar("subscription_status").default("active"), // active, past_due, cancelled, suspended
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  
  // Trial information
  trialStartDate: timestamp("trial_start_date"),
  trialEndDate: timestamp("trial_end_date"),
  isInTrial: boolean("is_in_trial").default(false),
  
  // Feature usage limits
  usageLimits: jsonb("usage_limits").default("{}"), // Custom limits per tenant
  currentUsage: jsonb("current_usage").default("{}"), // Current usage statistics
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_tenant_metadata").on(table.tenantId),
  index("idx_tenant_metadata_type").on(table.tenantType),
  index("idx_tenant_metadata_subscription").on(table.subscriptionPlanId),
  index("idx_tenant_metadata_status").on(table.subscriptionStatus),
]);

// Activity Logs table - Comprehensive audit trail for all system activities
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  
  // Activity classification
  activityType: varchar("activity_type").notNull(), // email, sms, whatsapp, voice, ai_learning, ml_prediction, automation, workflow
  category: varchar("category").notNull(), // communication, learning, automation, system
  
  // Entity references
  entityType: varchar("entity_type"), // invoice, contact, action, workflow
  entityId: varchar("entity_id"), // ID of the related entity
  
  // Activity details
  action: varchar("action").notNull(), // sent, received, analyzed, predicted, optimized, executed
  description: text("description").notNull(), // User-friendly description
  result: varchar("result").notNull(), // success, failure, pending, skipped
  
  // Rich metadata (JSON)
  metadata: jsonb("metadata").default("{}"), // Additional context (recipients, scores, reasoning, etc.)
  
  // Error tracking
  errorMessage: text("error_message"),
  errorCode: varchar("error_code"),
  
  // Performance tracking
  duration: integer("duration"), // milliseconds
  
  // User context (if applicable)
  userId: varchar("user_id").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Performance indexes for filtering and search
  index("idx_activity_logs_tenant").on(table.tenantId),
  index("idx_activity_logs_type").on(table.activityType),
  index("idx_activity_logs_category").on(table.category),
  index("idx_activity_logs_entity").on(table.entityType, table.entityId),
  index("idx_activity_logs_result").on(table.result),
  index("idx_activity_logs_created_at").on(table.createdAt),
]);

// Relations for partner system
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  tenantMetadata: many(tenantMetadata),
}));

export const partnerClientRelationshipsRelations = relations(partnerClientRelationships, ({ one }) => ({
  partnerUser: one(users, {
    fields: [partnerClientRelationships.partnerUserId],
    references: [users.id],
  }),
  partnerTenant: one(tenants, {
    fields: [partnerClientRelationships.partnerTenantId],
    references: [tenants.id],
  }),
  clientTenant: one(tenants, {
    fields: [partnerClientRelationships.clientTenantId],
    references: [tenants.id],
  }),
  terminatedByUser: one(users, {
    fields: [partnerClientRelationships.terminatedBy],
    references: [users.id],
  }),
}));

export const tenantInvitationsRelations = relations(tenantInvitations, ({ one }) => ({
  clientTenant: one(tenants, {
    fields: [tenantInvitations.clientTenantId],
    references: [tenants.id],
  }),
  invitedByUser: one(users, {
    fields: [tenantInvitations.invitedByUserId],
    references: [users.id],
  }),
  partnerUser: one(users, {
    fields: [tenantInvitations.partnerUserId],
    references: [users.id],
  }),
}));

export const tenantMetadataRelations = relations(tenantMetadata, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMetadata.tenantId],
    references: [tenants.id],
  }),
  subscriptionPlan: one(subscriptionPlans, {
    fields: [tenantMetadata.subscriptionPlanId],
    references: [subscriptionPlans.id],
  }),
}));

// Insert schemas for partner system
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartnerClientRelationshipSchema = createInsertSchema(partnerClientRelationships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantInvitationSchema = createInsertSchema(tenantInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantMetadataSchema = createInsertSchema(tenantMetadata).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for partner system
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;

export type PartnerClientRelationship = typeof partnerClientRelationships.$inferSelect;
export type InsertPartnerClientRelationship = z.infer<typeof insertPartnerClientRelationshipSchema>;

export type TenantInvitation = typeof tenantInvitations.$inferSelect;
export type InsertTenantInvitation = z.infer<typeof insertTenantInvitationSchema>;

export type TenantMetadata = typeof tenantMetadata.$inferSelect;
export type InsertTenantMetadata = z.infer<typeof insertTenantMetadataSchema>;

// Activity Logs schema and types
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
