import { pgTable, index, foreignKey, unique, varchar, boolean, jsonb, timestamp, text, numeric, integer, date, serial } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const customerPreferences = pgTable("customer_preferences", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	tradingName: varchar("trading_name"),
	emailEnabled: boolean("email_enabled").default(true),
	smsEnabled: boolean("sms_enabled").default(true),
	voiceEnabled: boolean("voice_enabled").default(true),
	bestContactWindowStart: varchar("best_contact_window_start"),
	bestContactWindowEnd: varchar("best_contact_window_end"),
	bestContactDays: jsonb("best_contact_days"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_customer_preferences_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_customer_preferences_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "customer_preferences_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "customer_preferences_contact_id_contacts_id_fk"
		}),
	unique("customer_preferences_contact_id_unique").on(table.contactId),
]);

export const timelineEvents = pgTable("timeline_events", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	customerId: varchar("customer_id").notNull(),
	invoiceId: varchar("invoice_id"),
	occurredAt: timestamp("occurred_at", { mode: 'string' }).notNull(),
	direction: varchar().notNull(),
	channel: varchar().notNull(),
	summary: text().notNull(),
	preview: text(),
	subject: varchar(),
	body: text(),
	participantsFrom: varchar("participants_from"),
	participantsTo: jsonb("participants_to"),
	outcomeType: varchar("outcome_type"),
	outcomeConfidence: numeric("outcome_confidence", { precision: 3, scale:  2 }),
	outcomeExtracted: jsonb("outcome_extracted"),
	outcomeRequiresReview: boolean("outcome_requires_review").default(false),
	status: varchar(),
	provider: varchar(),
	providerMessageId: varchar("provider_message_id"),
	createdByType: varchar("created_by_type").default('system').notNull(),
	createdByUserId: varchar("created_by_user_id"),
	createdByName: varchar("created_by_name"),
	actionId: varchar("action_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_timeline_events_channel").using("btree", table.channel.asc().nullsLast().op("text_ops")),
	index("idx_timeline_events_customer").using("btree", table.customerId.asc().nullsLast().op("text_ops")),
	index("idx_timeline_events_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_timeline_events_occurred").using("btree", table.tenantId.asc().nullsLast().op("timestamp_ops"), table.customerId.asc().nullsLast().op("text_ops"), table.occurredAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_timeline_events_outcome").using("btree", table.outcomeType.asc().nullsLast().op("text_ops")),
	index("idx_timeline_events_review").using("btree", table.outcomeRequiresReview.asc().nullsLast().op("bool_ops")),
	index("idx_timeline_events_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "timeline_events_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [contacts.id],
			name: "timeline_events_customer_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "timeline_events_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "timeline_events_created_by_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.actionId],
			foreignColumns: [actions.id],
			name: "timeline_events_action_id_actions_id_fk"
		}),
]);

export const messageDrafts = pgTable("message_drafts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	actionId: varchar("action_id"),
	tenantId: varchar("tenant_id").notNull(),
	channel: varchar().default('email').notNull(),
	subject: varchar(),
	body: text().notNull(),
	status: varchar().default('pending_approval').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	contactId: varchar("contact_id").notNull(),
	agentReasoning: text("agent_reasoning"),
	personaId: varchar("persona_id"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	reviewedByUserId: varchar("reviewed_by_user_id"),
	reviewNote: text("review_note"),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	context: jsonb(),
}, (table) => [
	index("idx_message_drafts_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_message_drafts_tenant_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "message_drafts_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "message_drafts_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.personaId],
			foreignColumns: [agentPersonas.id],
			name: "message_drafts_persona_id_agent_personas_id_fk"
		}),
	foreignKey({
			columns: [table.reviewedByUserId],
			foreignColumns: [users.id],
			name: "message_drafts_reviewed_by_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.actionId],
			foreignColumns: [actions.id],
			name: "message_drafts_action_id_actions_id_fk"
		}),
]);

export const complianceChecks = pgTable("compliance_checks", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	actionId: varchar("action_id"),
	contactId: varchar("contact_id"),
	checkResult: varchar("check_result").notNull(),
	rulesChecked: jsonb("rules_checked").notNull(),
	violations: jsonb(),
	agentReasoning: text("agent_reasoning"),
	reviewedBy: varchar("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_compliance_checks_action_id").using("btree", table.actionId.asc().nullsLast().op("text_ops")),
	index("idx_compliance_checks_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "compliance_checks_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.actionId],
			foreignColumns: [actions.id],
			name: "compliance_checks_action_id_actions_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "compliance_checks_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "compliance_checks_reviewed_by_users_id_fk"
		}),
]);

export const agentPersonas = pgTable("agent_personas", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	personaName: varchar("persona_name").notNull(),
	jobTitle: varchar("job_title").notNull(),
	emailSignatureName: varchar("email_signature_name").notNull(),
	emailSignatureTitle: varchar("email_signature_title").notNull(),
	emailSignatureCompany: varchar("email_signature_company").notNull(),
	emailSignaturePhone: varchar("email_signature_phone"),
	toneDefault: varchar("tone_default").default('professional').notNull(),
	voiceCharacteristics: jsonb("voice_characteristics"),
	companyContext: text("company_context"),
	sectorContext: varchar("sector_context").default('general'),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	defaultLanguage: varchar("default_language").default('en-GB'),
}, (table) => [
	index("idx_agent_personas_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "agent_personas_tenant_id_tenants_id_fk"
		}),
]);

export const smeContacts = pgTable("sme_contacts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	smeClientId: varchar("sme_client_id").notNull(),
	name: varchar().notNull(),
	email: varchar(),
	phone: varchar(),
	isPrimaryCreditContact: boolean("is_primary_credit_contact").default(false),
	isEscalationContact: boolean("is_escalation_contact").default(false),
	source: varchar().default('QASHIVO').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_sme_contacts_client").using("btree", table.smeClientId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.smeClientId],
			foreignColumns: [smeClients.id],
			name: "sme_contacts_sme_client_id_sme_clients_id_fk"
		}).onDelete("cascade"),
]);

export const smeInviteTokens = pgTable("sme_invite_tokens", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	smeClientId: varchar("sme_client_id").notNull(),
	partnerId: varchar("partner_id").notNull(),
	email: varchar().notNull(),
	tokenHash: varchar("token_hash").notNull(),
	status: varchar().default('SENT').notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow(),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_sme_invite_tokens_client").using("btree", table.smeClientId.asc().nullsLast().op("text_ops")),
	index("idx_sme_invite_tokens_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_sme_invite_tokens_token").using("btree", table.tokenHash.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.smeClientId],
			foreignColumns: [smeClients.id],
			name: "sme_invite_tokens_sme_client_id_sme_clients_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "sme_invite_tokens_partner_id_partners_id_fk"
		}),
]);

export const dsoSnapshots = pgTable("dso_snapshots", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	snapshotDate: timestamp("snapshot_date", { mode: 'string' }).notNull(),
	dsoValue: numeric("dso_value").notNull(),
	totalReceivables: numeric("total_receivables").notNull(),
	totalRevenue90D: numeric("total_revenue_90d").notNull(),
	overdueAmount: numeric("overdue_amount").notNull(),
	overduePercentage: numeric("overdue_percentage").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_dso_snapshots_tenant_date").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.snapshotDate.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "dso_snapshots_tenant_id_tenants_id_fk"
		}),
]);

export const emailMessages = pgTable("email_messages", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	direction: varchar().notNull(),
	channel: varchar().default('EMAIL').notNull(),
	actionId: varchar("action_id"),
	contactId: varchar("contact_id"),
	invoiceId: varchar("invoice_id"),
	smeClientId: varchar("sme_client_id"),
	partnerId: varchar("partner_id"),
	toEmail: varchar("to_email"),
	toName: varchar("to_name"),
	fromEmail: varchar("from_email"),
	fromName: varchar("from_name"),
	subject: varchar(),
	textBody: text("text_body"),
	htmlBody: text("html_body"),
	sendgridMessageId: varchar("sendgrid_message_id"),
	inReplyTo: varchar("in_reply_to"),
	references: text(),
	threadKey: varchar("thread_key"),
	replyToken: varchar("reply_token"),
	inboundFromEmail: varchar("inbound_from_email"),
	inboundFromName: varchar("inbound_from_name"),
	inboundToEmail: varchar("inbound_to_email"),
	inboundCc: jsonb("inbound_cc"),
	inboundSubject: varchar("inbound_subject"),
	inboundText: text("inbound_text"),
	inboundHtml: text("inbound_html"),
	inboundHeaders: jsonb("inbound_headers"),
	inboundAttachmentsMeta: jsonb("inbound_attachments_meta"),
	status: varchar().default('QUEUED').notNull(),
	error: text(),
	receivedAt: timestamp("received_at", { mode: 'string' }),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	conversationId: varchar("conversation_id"),
	ccRecipients: jsonb("cc_recipients"),
}, (table) => [
	index("idx_email_messages_action").using("btree", table.actionId.asc().nullsLast().op("text_ops")),
	index("idx_email_messages_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_email_messages_conversation").using("btree", table.conversationId.asc().nullsLast().op("text_ops")),
	index("idx_email_messages_direction").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.direction.asc().nullsLast().op("text_ops")),
	index("idx_email_messages_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_email_messages_reply_token").using("btree", table.replyToken.asc().nullsLast().op("text_ops")),
	index("idx_email_messages_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("idx_email_messages_thread").using("btree", table.threadKey.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "email_messages_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.actionId],
			foreignColumns: [actions.id],
			name: "email_messages_action_id_actions_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "email_messages_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "email_messages_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "email_messages_conversation_id_conversations_id_fk"
		}),
]);

export const cachedXeroContacts = pgTable("cached_xero_contacts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	xeroContactId: varchar("xero_contact_id").notNull(),
	name: varchar().notNull(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	emailAddress: varchar("email_address"),
	phone: varchar(),
	contactStatus: varchar("contact_status").default('ACTIVE'),
	isCustomer: boolean("is_customer").default(false),
	isSupplier: boolean("is_supplier").default(false),
	syncedAt: timestamp("synced_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "cached_xero_contacts_tenant_id_tenants_id_fk"
		}),
]);

export const importJobs = pgTable("import_jobs", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	smeClientId: varchar("sme_client_id").notNull(),
	type: varchar().notNull(),
	status: varchar().default('QUEUED').notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }),
	finishedAt: timestamp("finished_at", { mode: 'string' }),
	counts: jsonb().default({"failed":0,"updated":0,"inserted":0}),
	errorSummary: text("error_summary"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_import_jobs_sme").using("btree", table.smeClientId.asc().nullsLast().op("text_ops")),
	index("idx_import_jobs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.smeClientId],
			foreignColumns: [smeClients.id],
			name: "import_jobs_sme_client_id_sme_clients_id_fk"
		}).onDelete("cascade"),
]);

export const smeClients = pgTable("sme_clients", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	partnerId: varchar("partner_id").notNull(),
	name: varchar().notNull(),
	status: varchar().default('CREATED').notNull(),
	primaryCreditControllerId: varchar("primary_credit_controller_id"),
	tenantId: varchar("tenant_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	tradingName: varchar("trading_name"),
	industry: varchar(),
	timezone: varchar().default('Europe/London'),
	currency: varchar().default('GBP'),
	approvalMode: varchar("approval_mode").default('REQUIRED'),
	voiceEnabled: boolean("voice_enabled").default(false),
	sendKillSwitch: boolean("send_kill_switch").default(true),
}, (table) => [
	index("idx_sme_clients_controller").using("btree", table.primaryCreditControllerId.asc().nullsLast().op("text_ops")),
	index("idx_sme_clients_partner").using("btree", table.partnerId.asc().nullsLast().op("text_ops")),
	index("idx_sme_clients_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "sme_clients_partner_id_partners_id_fk"
		}),
	foreignKey({
			columns: [table.primaryCreditControllerId],
			foreignColumns: [users.id],
			name: "sme_clients_primary_credit_controller_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "sme_clients_tenant_id_tenants_id_fk"
		}),
]);

export const contacts = pgTable("contacts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	xeroContactId: varchar("xero_contact_id"),
	name: varchar().notNull(),
	email: varchar(),
	phone: varchar(),
	companyName: varchar("company_name"),
	address: text(),
	isActive: boolean("is_active").default(true),
	paymentTerms: integer("payment_terms").default(30),
	creditLimit: numeric("credit_limit", { precision: 10, scale:  2 }),
	preferredContactMethod: varchar("preferred_contact_method").default('email'),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	sageContactId: varchar("sage_contact_id"),
	quickBooksContactId: varchar("quick_books_contact_id"),
	role: varchar().default('customer').notNull(),
	taxNumber: varchar("tax_number"),
	accountNumber: varchar("account_number"),
	riskScore: integer("risk_score"),
	riskBand: varchar("risk_band", { length: 1 }),
	creditAssessment: jsonb("credit_assessment"),
	arContactName: varchar("ar_contact_name"),
	arContactEmail: varchar("ar_contact_email"),
	arContactPhone: varchar("ar_contact_phone"),
	arNotes: text("ar_notes"),
	workflowId: varchar("workflow_id"),
	playbookStage: varchar("playbook_stage").default('CREDIT_CONTROL'),
	playbookRiskTag: varchar("playbook_risk_tag").default('NORMAL'),
	manualBlocked: boolean("manual_blocked").default(false),
	nextTouchNotBefore: timestamp("next_touch_not_before", { mode: 'string' }),
	lastOutboundAt: timestamp("last_outbound_at", { mode: 'string' }),
	lastOutboundChannel: varchar("last_outbound_channel"),
	lastInboundAt: timestamp("last_inbound_at", { mode: 'string' }),
	contactCountLast30D: integer("contact_count_last_30d").default(0),
	isPotentiallyVulnerable: boolean("is_potentially_vulnerable").default(false),
	wrongPartyRisk: varchar("wrong_party_risk").default('NONE'),
	interestNotified: boolean("interest_notified").default(false),
	preferredCurrency: varchar("preferred_currency"),
	preferredLanguage: varchar("preferred_language"),
	lpiEnabled: boolean("lpi_enabled").default(true),
	lpiGracePeriodDays: integer("lpi_grace_period_days").default(7),
	isException: boolean("is_exception").default(false),
	exceptionType: text("exception_type"),
	exceptionNote: text("exception_note"),
	exceptionFlaggedAt: timestamp("exception_flagged_at", { mode: 'string' }),
	exceptionResolvedAt: timestamp("exception_resolved_at", { mode: 'string' }),
	legalResponseWindowEnd: timestamp("legal_response_window_end", { mode: 'string' }),
	probablePaymentDetected: boolean("probable_payment_detected").default(false),
	probablePaymentConfidence: varchar("probable_payment_confidence"),
	probablePaymentDetectedAt: timestamp("probable_payment_detected_at", { mode: 'string' }),
}, (table) => [
	index("idx_contacts_company_name").using("btree", table.companyName.asc().nullsLast().op("text_ops")),
	index("idx_contacts_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_contacts_exception").using("btree", table.isException.asc().nullsLast().op("bool_ops")),
	index("idx_contacts_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("idx_contacts_next_touch").using("btree", table.nextTouchNotBefore.asc().nullsLast().op("timestamp_ops")),
	index("idx_contacts_playbook_stage").using("btree", table.playbookStage.asc().nullsLast().op("text_ops")),
	index("idx_contacts_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "contacts_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.workflowId],
			foreignColumns: [workflows.id],
			name: "contacts_workflow_id_workflows_id_fk"
		}),
]);

export const partnerScorecardSubmissions = pgTable("partner_scorecard_submissions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	prospectId: varchar("prospect_id").notNull(),
	totalScore: integer("total_score").notNull(),
	band: varchar().notNull(),
	categoryScores: jsonb("category_scores").notNull(),
	version: varchar().default('v1').notNull(),
	notes: text(),
	confirmationEmailSent: boolean("confirmation_email_sent").default(false),
	confirmationEmailSentAt: timestamp("confirmation_email_sent_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_scorecard_submissions_band").using("btree", table.band.asc().nullsLast().op("text_ops")),
	index("idx_scorecard_submissions_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_scorecard_submissions_prospect").using("btree", table.prospectId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.prospectId],
			foreignColumns: [partnerProspects.id],
			name: "partner_scorecard_submissions_prospect_id_partner_prospects_id_"
		}).onDelete("cascade"),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const users = pgTable("users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	email: varchar().notNull(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	tenantId: varchar("tenant_id"),
	role: varchar().default('user').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	stripeCustomerId: varchar("stripe_customer_id"),
	stripeSubscriptionId: varchar("stripe_subscription_id"),
	partnerId: varchar("partner_id"),
	tenantRole: varchar("tenant_role"),
	platformAdmin: boolean("platform_admin").default(false),
	password: varchar().notNull(),
	resetToken: varchar("reset_token"),
	resetTokenExpiry: timestamp("reset_token_expiry", { mode: 'string' }),
	clerkId: varchar("clerk_id"),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "users_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.partnerId],
			foreignColumns: [partners.id],
			name: "users_partner_id_partners_id_fk"
		}),
	unique("users_email_unique").on(table.email),
	unique("users_clerk_id_unique").on(table.clerkId),
]);

export const partnerProspects = pgTable("partner_prospects", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	firstName: varchar("first_name").notNull(),
	lastName: varchar("last_name").notNull(),
	email: varchar().notNull(),
	phone: varchar(),
	companyName: varchar("company_name").notNull(),
	jobTitle: varchar("job_title"),
	source: varchar().default('scorecard_landing'),
	utmSource: varchar("utm_source"),
	utmMedium: varchar("utm_medium"),
	utmCampaign: varchar("utm_campaign"),
	status: varchar().default('NEW').notNull(),
	convertedToPartnerId: varchar("converted_to_partner_id"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_partner_prospects_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_partner_prospects_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_partner_prospects_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.convertedToPartnerId],
			foreignColumns: [partners.id],
			name: "partner_prospects_converted_to_partner_id_partners_id_fk"
		}),
]);

export const workflowConnections = pgTable("workflow_connections", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	workflowId: varchar("workflow_id").notNull(),
	sourceNodeId: varchar("source_node_id").notNull(),
	targetNodeId: varchar("target_node_id").notNull(),
	condition: jsonb(),
	label: varchar(),
	successRate: numeric("success_rate", { precision: 5, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	connectionType: varchar("connection_type").default('default'),
}, (table) => [
	foreignKey({
			columns: [table.workflowId],
			foreignColumns: [workflows.id],
			name: "workflow_connections_workflow_id_workflows_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sourceNodeId],
			foreignColumns: [workflowNodes.id],
			name: "workflow_connections_source_node_id_workflow_nodes_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.targetNodeId],
			foreignColumns: [workflowNodes.id],
			name: "workflow_connections_target_node_id_workflow_nodes_id_fk"
		}).onDelete("cascade"),
]);

export const partnerScorecardAnswers = pgTable("partner_scorecard_answers", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	submissionId: varchar("submission_id").notNull(),
	questionKey: varchar("question_key").notNull(),
	score: integer().notNull(),
	comment: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_scorecard_answers_submission").using("btree", table.submissionId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.submissionId],
			foreignColumns: [partnerScorecardSubmissions.id],
			name: "partner_scorecard_answers_submission_id_partner_scorecard_submi"
		}).onDelete("cascade"),
	unique("unique_submission_question").on(table.submissionId, table.questionKey),
]);

export const escalationRules = pgTable("escalation_rules", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	name: varchar().notNull(),
	description: text(),
	rules: jsonb().notNull(),
	isActive: boolean("is_active").default(true),
	priority: integer().default(1),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "escalation_rules_tenant_id_tenants_id_fk"
		}),
]);

export const workflowTemplates = pgTable("workflow_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	description: text(),
	category: varchar().notNull(),
	industry: varchar(),
	workflowData: jsonb("workflow_data").notNull(),
	isPublic: boolean("is_public").default(false),
	usageCount: integer("usage_count").default(0),
	averageSuccessRate: numeric("average_success_rate", { precision: 5, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const channelAnalytics = pgTable("channel_analytics", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	channel: varchar().notNull(),
	stage: integer(),
	templateId: varchar("template_id"),
	date: timestamp({ mode: 'string' }).notNull(),
	sentCount: integer("sent_count").default(0),
	deliveredCount: integer("delivered_count").default(0),
	openedCount: integer("opened_count").default(0),
	respondedCount: integer("responded_count").default(0),
	paidCount: integer("paid_count").default(0),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).default('0'),
	costPerCommunication: numeric("cost_per_communication", { precision: 6, scale:  4 }).default('0'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "channel_analytics_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [communicationTemplates.id],
			name: "channel_analytics_template_id_communication_templates_id_fk"
		}),
]);

export const workflows = pgTable("workflows", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	name: varchar().notNull(),
	description: text(),
	isActive: boolean("is_active").default(true),
	trigger: jsonb(),
	steps: jsonb(),
	successRate: numeric("success_rate", { precision: 5, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	isTemplate: boolean("is_template").default(false),
	category: varchar(),
	canvasData: jsonb("canvas_data"),
	estimatedCost: numeric("estimated_cost", { precision: 8, scale:  2 }),
	testScenarios: jsonb("test_scenarios"),
	schedulerType: varchar("scheduler_type").default('static'),
	adaptiveSettings: jsonb("adaptive_settings"),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "workflows_tenant_id_tenants_id_fk"
		}),
]);

export const workflowNodes = pgTable("workflow_nodes", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	workflowId: varchar("workflow_id").notNull(),
	nodeType: varchar("node_type").notNull(),
	subType: varchar("sub_type"),
	label: varchar().notNull(),
	position: jsonb().notNull(),
	config: jsonb().notNull(),
	isStartNode: boolean("is_start_node").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.workflowId],
			foreignColumns: [workflows.id],
			name: "workflow_nodes_workflow_id_workflows_id_fk"
		}).onDelete("cascade"),
]);

export const communicationTemplates = pgTable("communication_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	name: varchar().notNull(),
	type: varchar().notNull(),
	category: varchar().notNull(),
	stage: integer(),
	subject: varchar(),
	content: text().notNull(),
	variables: jsonb(),
	isActive: boolean("is_active").default(true),
	isDefault: boolean("is_default").default(false),
	successRate: numeric("success_rate", { precision: 5, scale:  2 }),
	usageCount: integer("usage_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	sendTiming: jsonb("send_timing"),
	aiGenerated: boolean("ai_generated").default(false),
	optimizationScore: numeric("optimization_score", { precision: 5, scale:  2 }),
	toneOfVoice: varchar("tone_of_voice").default('professional'),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "communication_templates_tenant_id_tenants_id_fk"
		}),
]);

export const tenants = pgTable("tenants", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	subdomain: varchar(),
	settings: jsonb(),
	xeroAccessToken: text("xero_access_token"),
	xeroRefreshToken: text("xero_refresh_token"),
	xeroTenantId: varchar("xero_tenant_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	xeroSyncInterval: integer("xero_sync_interval").default(240),
	xeroLastSyncAt: timestamp("xero_last_sync_at", { mode: 'string' }),
	xeroAutoSync: boolean("xero_auto_sync").default(true),
	collectionsAutomationEnabled: boolean("collections_automation_enabled").default(true),
	companyLogoUrl: varchar("company_logo_url"),
	brandPrimaryColor: varchar("brand_primary_color").default('#17B6C3'),
	brandSecondaryColor: varchar("brand_secondary_color").default('#1396A1'),
	communicationTone: varchar("communication_tone").default('professional'),
	industry: varchar(),
	companySize: varchar("company_size"),
	businessType: varchar("business_type").default('b2b'),
	primaryMarket: varchar("primary_market").default('domestic'),
	automationPreference: jsonb("automation_preference").default({}),
	onboardingCompleted: boolean("onboarding_completed").default(false),
	onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: 'string' }),
	communicationMode: varchar("communication_mode").default('testing'),
	testEmails: text("test_emails").array(),
	testPhones: text("test_phones").array(),
	testContactName: varchar("test_contact_name"),
	xeroExpiresAt: timestamp("xero_expires_at", { mode: 'string' }),
	currency: varchar().default('GBP'),
	boeBaseRate: numeric("boe_base_rate", { precision: 5, scale:  2 }).default('5.00'),
	interestMarkup: numeric("interest_markup", { precision: 5, scale:  2 }).default('8.00'),
	interestGracePeriod: integer("interest_grace_period").default(30),
	approvalMode: varchar("approval_mode").default('manual'),
	approvalTimeoutHours: integer("approval_timeout_hours").default(12),
	executionTime: varchar("execution_time").default('09:00'),
	executionTimezone: varchar("execution_timezone").default('Europe/London'),
	dailyLimits: jsonb("daily_limits").default({"sms":50,"email":100,"voice":20}),
	minConfidence: jsonb("min_confidence").default({"sms":0.85,"email":0.8,"voice":0.9}),
	exceptionRules: jsonb("exception_rules").default({"flagHighValue":10000,"flagFirstContact":true,"flagVipCustomers":true,"flagDisputeKeywords":true}),
	xeroConnectionStatus: varchar("xero_connection_status").default('unknown'),
	xeroLastHealthCheck: timestamp("xero_last_health_check", { mode: 'string' }),
	xeroHealthCheckError: text("xero_health_check_error"),
	xeroOrganisationName: varchar("xero_organisation_name"),
	tenantStyle: varchar("tenant_style").default('STANDARD'),
	highValueThreshold: numeric("high_value_threshold", { precision: 10, scale:  2 }).default('10000'),
	singleInvoiceHighValueThreshold: numeric("single_invoice_high_value_threshold", { precision: 10, scale:  2 }).default('5000'),
	useLatePaymentLegislation: boolean("use_late_payment_legislation").default(false),
	channelCooldowns: jsonb("channel_cooldowns").default({"sms":5,"email":3,"voice":7}),
	maxTouchesPerWindow: integer("max_touches_per_window").default(3),
	contactWindowDays: integer("contact_window_days").default(14),
	businessHoursStart: varchar("business_hours_start").default('08:00'),
	businessHoursEnd: varchar("business_hours_end").default('18:00'),
	emailProvider: varchar("email_provider"),
	emailConnectedAddress: varchar("email_connected_address"),
	emailAccessToken: text("email_access_token"),
	emailRefreshToken: text("email_refresh_token"),
	emailTokenExpiresAt: timestamp("email_token_expires_at", { mode: 'string' }),
	emailConnectionStatus: varchar("email_connection_status").default('disconnected'),
	emailLastSyncAt: timestamp("email_last_sync_at", { mode: 'string' }),
	emailSyncEnabled: boolean("email_sync_enabled").default(false),
	batchFrequencyMinutes: integer("batch_frequency_minutes").default(60),
	countdownResetOnInteraction: boolean("countdown_reset_on_interaction").default(false),
	defaultPersonaId: varchar("default_persona_id"),
	rileyReviewDay: text("riley_review_day"),
	rileyReviewTime: text("riley_review_time"),
	rileyReviewTimezone: text("riley_review_timezone").default('Europe/London'),
	defaultLanguage: varchar("default_language").default('en-GB'),
}, (table) => [
	unique("tenants_subdomain_unique").on(table.subdomain),
]);

export const actionBatches = pgTable("action_batches", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	status: varchar().default('pending').notNull(),
	scheduledFor: timestamp("scheduled_for", { mode: 'string' }).notNull(),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	totalActions: integer("total_actions").default(0),
	approvedCount: integer("approved_count").default(0),
	rejectedCount: integer("rejected_count").default(0),
	deferredCount: integer("deferred_count").default(0),
	autoApprovedCount: integer("auto_approved_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_batches_tenant_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "action_batches_tenant_id_tenants_id_fk"
		}),
]);

export const rejectionPatterns = pgTable("rejection_patterns", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	category: varchar().notNull(),
	actionType: varchar("action_type"),
	contactId: varchar("contact_id"),
	occurrences: integer().default(1),
	lastOccurredAt: timestamp("last_occurred_at", { mode: 'string' }).defaultNow(),
	suggestedAdjustment: text("suggested_adjustment"),
	status: varchar().default('open'),
	acknowledgedBy: varchar("acknowledged_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_rejection_patterns_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "rejection_patterns_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "rejection_patterns_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.acknowledgedBy],
			foreignColumns: [users.id],
			name: "rejection_patterns_acknowledged_by_users_id_fk"
		}),
]);

export const customerScheduleAssignments = pgTable("customer_schedule_assignments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	scheduleId: varchar("schedule_id").notNull(),
	isActive: boolean("is_active").default(true),
	customSettings: jsonb("custom_settings"),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "customer_schedule_assignments_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "customer_schedule_assignments_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.scheduleId],
			foreignColumns: [collectionSchedules.id],
			name: "customer_schedule_assignments_schedule_id_collection_schedules_"
		}),
]);

export const cachedXeroInvoices = pgTable("cached_xero_invoices", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	xeroInvoiceId: varchar("xero_invoice_id").notNull(),
	invoiceNumber: varchar("invoice_number").notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	amountPaid: numeric("amount_paid", { precision: 10, scale:  2 }).default('0'),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }).default('0'),
	status: varchar().notNull(),
	issueDate: timestamp("issue_date", { mode: 'string' }).notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }).notNull(),
	paidDate: timestamp("paid_date", { mode: 'string' }),
	description: text(),
	currency: varchar().default('GBP'),
	contact: jsonb(),
	paymentDetails: jsonb("payment_details"),
	metadata: jsonb(),
	syncedAt: timestamp("synced_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	xeroContactId: varchar("xero_contact_id"),
	reference: varchar(),
	amountDue: numeric("amount_due", { precision: 10, scale:  2 }).default('0'),
	xeroStatus: varchar("xero_status").default('UNKNOWN').notNull(),
	updatedDateUtc: timestamp("updated_date_utc", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "cached_xero_invoices_tenant_id_tenants_id_fk"
		}),
]);

export const emailSenders = pgTable("email_senders", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	name: varchar().notNull(),
	email: varchar().notNull(),
	signature: text(),
	isDefault: boolean("is_default").default(false),
	isActive: boolean("is_active").default(true),
	replyToEmail: varchar("reply_to_email"),
	fromName: varchar("from_name").notNull(),
	department: varchar().default('Accounts Receivable'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "email_senders_tenant_id_tenants_id_fk"
		}),
]);

export const actions = pgTable("actions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	invoiceId: varchar("invoice_id"),
	contactId: varchar("contact_id"),
	userId: varchar("user_id"),
	type: varchar().notNull(),
	status: varchar().default('pending').notNull(),
	subject: varchar(),
	content: text(),
	scheduledFor: timestamp("scheduled_for", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	metadata: jsonb(),
	workflowStepId: varchar("workflow_step_id"),
	aiGenerated: boolean("ai_generated").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	intentType: varchar("intent_type"),
	intentConfidence: numeric("intent_confidence", { precision: 3, scale:  2 }),
	sentiment: varchar(),
	hasResponse: boolean("has_response").default(false),
	source: varchar().default('automated'),
	experimentVariant: varchar("experiment_variant"),
	invoiceIds: text("invoice_ids").array(),
	recommendedAt: timestamp("recommended_at", { mode: 'string' }),
	recommendedBy: varchar("recommended_by"),
	recommended: jsonb(),
	override: jsonb(),
	assignedTo: varchar("assigned_to"),
	assignedAt: timestamp("assigned_at", { mode: 'string' }),
	firstSeenAt: timestamp("first_seen_at", { mode: 'string' }).defaultNow(),
	feedback: varchar(),
	feedbackNote: text("feedback_note"),
	approvedBy: varchar("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	confidenceScore: numeric("confidence_score", { precision: 3, scale:  2 }),
	exceptionReason: varchar("exception_reason"),
	emailReplyToken: varchar("email_reply_token"),
	workState: varchar("work_state"),
	inFlightState: varchar("in_flight_state"),
	awaitingReplyUntil: timestamp("awaiting_reply_until", { mode: 'string' }),
	cooldownUntil: timestamp("cooldown_until", { mode: 'string' }),
	touchCount: integer("touch_count").default(0),
	voiceStatus: varchar("voice_status"),
	voiceCompletedAt: timestamp("voice_completed_at", { mode: 'string' }),
	voiceTranscriptSnippet: text("voice_transcript_snippet"),
	voiceSummarySnippet: text("voice_summary_snippet"),
	voiceRecordingUrl: varchar("voice_recording_url"),
	voiceLastPolledAt: timestamp("voice_last_polled_at", { mode: 'string' }),
	voiceProcessedAt: timestamp("voice_processed_at", { mode: 'string' }),
	agentReasoning: text("agent_reasoning"),
	agentToneLevel: varchar("agent_tone_level"),
	agentChannel: varchar("agent_channel"),
	complianceResult: varchar("compliance_result"),
	batchId: varchar("batch_id"),
	agentType: varchar("agent_type"),
	actionSummary: text("action_summary"),
	priority: integer().default(50),
	rejectedBy: varchar("rejected_by"),
	rejectedAt: timestamp("rejected_at", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	rejectionCategory: varchar("rejection_category"),
	deferredBy: varchar("deferred_by"),
	deferredAt: timestamp("deferred_at", { mode: 'string' }),
	deferredToBatchId: varchar("deferred_to_batch_id"),
	exceptionType: text("exception_type"),
	providerMessageId: varchar("provider_message_id"),
	deliveryStatus: varchar("delivery_status"),
	deliveryConfirmedAt: timestamp("delivery_confirmed_at", { mode: 'string' }),
	deliveryRawPayload: jsonb("delivery_raw_payload"),
	retryCount: integer("retry_count").default(0),
	retryOf: varchar("retry_of"),
	generationMethod: varchar("generation_method").default('llm'),
	cancellationReason: varchar("cancellation_reason"),
}, (table) => [
	index("idx_actions_batch").using("btree", table.batchId.asc().nullsLast().op("text_ops")),
	index("idx_actions_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_actions_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_actions_tenant_scheduled").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.scheduledFor.asc().nullsLast().op("timestamp_ops")),
	index("idx_actions_tenant_type_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.type.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("idx_actions_tenant_updated").using("btree", table.tenantId.asc().nullsLast().op("timestamp_ops"), table.updatedAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "actions_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "actions_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "actions_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "actions_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [users.id],
			name: "actions_assigned_to_users_id_fk"
		}),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "actions_approved_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.rejectedBy],
			foreignColumns: [users.id],
			name: "actions_rejected_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.deferredBy],
			foreignColumns: [users.id],
			name: "actions_deferred_by_users_id_fk"
		}),
]);

export const collectionSchedules = pgTable("collection_schedules", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	name: varchar().notNull(),
	description: text(),
	isActive: boolean("is_active").default(true),
	isDefault: boolean("is_default").default(false),
	workflow: varchar().default('monthly_statement').notNull(),
	scheduleSteps: jsonb("schedule_steps").notNull(),
	successRate: numeric("success_rate", { precision: 5, scale:  2 }),
	averageDaysToPayment: numeric("average_days_to_payment", { precision: 5, scale:  1 }),
	totalCustomersAssigned: integer("total_customers_assigned").default(0),
	sendingSettings: jsonb("sending_settings"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	schedulerType: varchar("scheduler_type").default('static'),
	adaptiveSettings: jsonb("adaptive_settings"),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "collection_schedules_tenant_id_tenants_id_fk"
		}),
]);

export const aiFacts = pgTable("ai_facts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	category: varchar().notNull(),
	title: varchar().notNull(),
	content: text().notNull(),
	tags: jsonb(),
	priority: integer().default(5),
	isActive: boolean("is_active").default(true),
	lastVerified: timestamp("last_verified", { mode: 'string' }).defaultNow(),
	source: varchar(),
	applicableRegions: jsonb("applicable_regions"),
	effectiveDate: timestamp("effective_date", { mode: 'string' }),
	expirationDate: timestamp("expiration_date", { mode: 'string' }),
	createdBy: varchar("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	entityType: text("entity_type"),
	entityId: text("entity_id"),
	factKey: text("fact_key"),
	factValue: text("fact_value"),
	confidence: numeric({ precision: 3, scale:  2 }),
	sourceConversationId: varchar("source_conversation_id"),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "ai_facts_tenant_id_tenants_id_fk"
		}),
]);

export const cachedXeroOverpayments = pgTable("cached_xero_overpayments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	xeroOverpaymentId: varchar("xero_overpayment_id").notNull(),
	xeroContactId: varchar("xero_contact_id"),
	status: varchar().default('AUTHORISED').notNull(),
	date: timestamp({ mode: 'string' }),
	total: numeric({ precision: 10, scale:  2 }).default('0'),
	remainingCredit: numeric("remaining_credit", { precision: 10, scale:  2 }).default('0'),
	updatedDateUtc: timestamp("updated_date_utc", { mode: 'string' }),
	syncedAt: timestamp("synced_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "cached_xero_overpayments_tenant_id_tenants_id_fk"
		}),
]);

export const cachedXeroPrepayments = pgTable("cached_xero_prepayments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	xeroPrepaymentId: varchar("xero_prepayment_id").notNull(),
	xeroContactId: varchar("xero_contact_id"),
	status: varchar().default('AUTHORISED').notNull(),
	date: timestamp({ mode: 'string' }),
	total: numeric({ precision: 10, scale:  2 }).default('0'),
	remainingCredit: numeric("remaining_credit", { precision: 10, scale:  2 }).default('0'),
	updatedDateUtc: timestamp("updated_date_utc", { mode: 'string' }),
	syncedAt: timestamp("synced_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "cached_xero_prepayments_tenant_id_tenants_id_fk"
		}),
]);

export const bills = pgTable("bills", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	vendorId: varchar("vendor_id").notNull(),
	xeroInvoiceId: varchar("xero_invoice_id"),
	sageInvoiceId: varchar("sage_invoice_id"),
	quickBooksInvoiceId: varchar("quick_books_invoice_id"),
	billNumber: varchar("bill_number").notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	amountPaid: numeric("amount_paid", { precision: 10, scale:  2 }).default('0'),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }).default('0'),
	status: varchar().default('pending').notNull(),
	issueDate: timestamp("issue_date", { mode: 'string' }).notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }).notNull(),
	paidDate: timestamp("paid_date", { mode: 'string' }),
	description: text(),
	currency: varchar().default('GBP'),
	reference: varchar(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "bills_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.vendorId],
			foreignColumns: [contacts.id],
			name: "bills_vendor_id_contacts_id_fk"
		}),
]);

export const billPayments = pgTable("bill_payments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	billId: varchar("bill_id").notNull(),
	bankAccountId: varchar("bank_account_id"),
	xeroPaymentId: varchar("xero_payment_id"),
	sagePaymentId: varchar("sage_payment_id"),
	quickBooksPaymentId: varchar("quick_books_payment_id"),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	paymentDate: timestamp("payment_date", { mode: 'string' }).notNull(),
	paymentMethod: varchar("payment_method").notNull(),
	reference: varchar(),
	currency: varchar().default('GBP'),
	exchangeRate: numeric("exchange_rate", { precision: 10, scale:  6 }).default('1'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "bill_payments_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.billId],
			foreignColumns: [bills.id],
			name: "bill_payments_bill_id_bills_id_fk"
		}),
	foreignKey({
			columns: [table.bankAccountId],
			foreignColumns: [bankAccounts.id],
			name: "bill_payments_bank_account_id_bank_accounts_id_fk"
		}),
]);

export const budgets = pgTable("budgets", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	name: varchar().notNull(),
	description: text(),
	budgetType: varchar("budget_type").notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	currency: varchar().default('GBP'),
	status: varchar().default('draft').notNull(),
	totalBudgetAmount: numeric("total_budget_amount", { precision: 12, scale:  2 }).default('0'),
	totalActualAmount: numeric("total_actual_amount", { precision: 12, scale:  2 }).default('0'),
	isActive: boolean("is_active").default(true),
	createdBy: varchar("created_by"),
	approvedBy: varchar("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "budgets_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "budgets_created_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "budgets_approved_by_users_id_fk"
		}),
]);

export const exchangeRates = pgTable("exchange_rates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	fromCurrency: varchar("from_currency").notNull(),
	toCurrency: varchar("to_currency").notNull(),
	rate: numeric({ precision: 10, scale:  6 }).notNull(),
	rateDate: timestamp("rate_date", { mode: 'string' }).notNull(),
	provider: varchar().default('system').notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const bankAccounts = pgTable("bank_accounts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	xeroAccountId: varchar("xero_account_id"),
	sageAccountId: varchar("sage_account_id"),
	quickBooksAccountId: varchar("quick_books_account_id"),
	name: varchar().notNull(),
	accountNumber: varchar("account_number"),
	accountType: varchar("account_type").notNull(),
	currency: varchar().default('GBP'),
	currentBalance: numeric("current_balance", { precision: 12, scale:  2 }).default('0'),
	isActive: boolean("is_active").default(true),
	bankName: varchar("bank_name"),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "bank_accounts_tenant_id_tenants_id_fk"
		}),
]);

export const providerConnections = pgTable("provider_connections", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	provider: varchar().notNull(),
	connectionName: varchar("connection_name"),
	isActive: boolean("is_active").default(true),
	isConnected: boolean("is_connected").default(false),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	tokenExpiresAt: timestamp("token_expires_at", { mode: 'string' }),
	providerId: varchar("provider_id"),
	scopes: jsonb(),
	capabilities: jsonb(),
	lastConnectedAt: timestamp("last_connected_at", { mode: 'string' }),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }),
	syncFrequency: varchar("sync_frequency").default('hourly'),
	autoSyncEnabled: boolean("auto_sync_enabled").default(true),
	lastError: text("last_error"),
	errorCount: integer("error_count").default(0),
	lastErrorAt: timestamp("last_error_at", { mode: 'string' }),
	connectionSettings: jsonb("connection_settings"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "provider_connections_tenant_id_tenants_id_fk"
		}),
	unique("provider_connections_tenant_provider").on(table.tenantId, table.provider),
]);

export const syncState = pgTable("sync_state", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	provider: varchar().notNull(),
	resource: varchar().notNull(),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }),
	lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { mode: 'string' }),
	syncCursor: varchar("sync_cursor"),
	syncStatus: varchar("sync_status").default('idle').notNull(),
	errorMessage: text("error_message"),
	recordsProcessed: integer("records_processed").default(0),
	recordsCreated: integer("records_created").default(0),
	recordsUpdated: integer("records_updated").default(0),
	recordsFailed: integer("records_failed").default(0),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	initialSyncComplete: boolean("initial_sync_complete").default(false),
	syncInProgress: boolean("sync_in_progress").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "sync_state_tenant_id_tenants_id_fk"
		}),
	unique("sync_state_tenant_provider_resource").on(table.tenantId, table.provider, table.resource),
]);

export const customerLearningProfiles = pgTable("customer_learning_profiles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	emailEffectiveness: numeric("email_effectiveness", { precision: 3, scale:  2 }).default('0.5'),
	smsEffectiveness: numeric("sms_effectiveness", { precision: 3, scale:  2 }).default('0.5'),
	voiceEffectiveness: numeric("voice_effectiveness", { precision: 3, scale:  2 }).default('0.5'),
	totalInteractions: integer("total_interactions").default(0),
	successfulActions: integer("successful_actions").default(0),
	averageResponseTime: integer("average_response_time"),
	preferredChannel: varchar("preferred_channel"),
	preferredContactTime: varchar("preferred_contact_time"),
	averagePaymentDelay: integer("average_payment_delay"),
	paymentReliability: numeric("payment_reliability", { precision: 3, scale:  2 }).default('0.5'),
	learningConfidence: numeric("learning_confidence", { precision: 3, scale:  2 }).default('0.1'),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	totalPromisesMade: integer("total_promises_made").default(0),
	promisesKept: integer("promises_kept").default(0),
	promisesBroken: integer("promises_broken").default(0),
	promisesPartiallyKept: integer("promises_partially_kept").default(0),
	promiseReliabilityScore: numeric("promise_reliability_score", { precision: 5, scale:  2 }),
	prsLast30Days: numeric("prs_last_30_days", { precision: 5, scale:  2 }),
	prsLast90Days: numeric("prs_last_90_days", { precision: 5, scale:  2 }),
	prsLast12Months: numeric("prs_last_12_months", { precision: 5, scale:  2 }),
	isSerialPromiser: boolean("is_serial_promiser").default(false),
	isReliableLatePayer: boolean("is_reliable_late_payer").default(false),
	isRelationshipDeteriorating: boolean("is_relationship_deteriorating").default(false),
	isNewCustomer: boolean("is_new_customer").default(true),
	hasActiveDispute: boolean("has_active_dispute").default(false),
	averageDaysLate: numeric("average_days_late", { precision: 8, scale:  2 }),
	preferredPaymentDay: integer("preferred_payment_day"),
	responsiveness: varchar(),
	sentimentTrend: varchar("sentiment_trend"),
	lastPositiveInteraction: timestamp("last_positive_interaction", { mode: 'string' }),
	lastNegativeInteraction: timestamp("last_negative_interaction", { mode: 'string' }),
	consecutiveNegativeInteractions: integer("consecutive_negative_interactions").default(0),
	totalInboundMessages: integer("total_inbound_messages").default(0),
	totalOutboundMessages: integer("total_outbound_messages").default(0),
	lastEngagementDate: timestamp("last_engagement_date", { mode: 'string' }),
	engagementScore: numeric("engagement_score", { precision: 5, scale:  2 }),
	lastCalculatedAt: timestamp("last_calculated_at", { mode: 'string' }).defaultNow(),
	calculationVersion: varchar("calculation_version").default('1.0'),
}, (table) => [
	index("idx_customer_profiles_flags").using("btree", table.isSerialPromiser.asc().nullsLast().op("bool_ops"), table.isRelationshipDeteriorating.asc().nullsLast().op("bool_ops")),
	index("idx_customer_profiles_prs").using("btree", table.promiseReliabilityScore.asc().nullsLast().op("numeric_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "customer_learning_profiles_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "customer_learning_profiles_contact_id_contacts_id_fk"
		}),
	unique("customer_learning_profiles_tenant_contact").on(table.tenantId, table.contactId),
]);

export const riskScores = pgTable("risk_scores", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	overallRiskScore: numeric("overall_risk_score", { precision: 5, scale:  4 }),
	paymentRisk: numeric("payment_risk", { precision: 5, scale:  4 }),
	creditRisk: numeric("credit_risk", { precision: 5, scale:  4 }),
	communicationRisk: numeric("communication_risk", { precision: 5, scale:  4 }),
	riskFactors: jsonb("risk_factors"),
	riskTrend: varchar("risk_trend"),
	previousRiskScore: numeric("previous_risk_score", { precision: 5, scale:  4 }),
	riskChangePercent: numeric("risk_change_percent", { precision: 6, scale:  3 }),
	modelVersion: varchar("model_version").notNull(),
	lastCalculated: timestamp("last_calculated", { mode: 'string' }).defaultNow(),
	nextReassessment: timestamp("next_reassessment", { mode: 'string' }),
	recommendedActions: jsonb("recommended_actions"),
	urgencyLevel: varchar("urgency_level"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("risk_scores_overall_risk_idx").using("btree", table.overallRiskScore.asc().nullsLast().op("numeric_ops")),
	index("risk_scores_tenant_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("risk_scores_urgency_idx").using("btree", table.urgencyLevel.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "risk_scores_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "risk_scores_contact_id_contacts_id_fk"
		}),
	unique("risk_scores_tenant_contact").on(table.tenantId, table.contactId),
]);

export const workflowProfiles = pgTable("workflow_profiles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	name: varchar().default('Default workflow').notNull(),
	policyJson: jsonb("policy_json").default({"chasingStart":"on_due","chasingStartDays":0,"escalationCadence":"standard","maxTouchesPerWeek":3,"messagesAppearFrom":"tenant","typicalPaymentTerms":30}),
	channelsJson: jsonb("channels_json").default({"smsEnabled":false,"channelOrder":["EMAIL","SMS","VOICE"],"emailEnabled":true,"voiceEnabled":false}),
	outcomeRulesJson: jsonb("outcome_rules_json").default({"dispute":{"action":"stop_chasing","createException":true,"requireManualReview":true},"moreTime":{"action":"flag_for_approval","suggestNextStep":true},"promiseToPay":{"action":"pause_until_date","followUpNextDay":true}}),
	requiredFooterJson: jsonb("required_footer_json").default({"bankDetails":"","paymentLink":"","contactEmail":"","contactPhone":"","disputeGuidance":"If you have any queries about this invoice, please reply to this email."}),
	tone: integer().default(3),
	version: integer().default(1),
	status: varchar().default('DRAFT').notNull(),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	approvedByUserId: varchar("approved_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_workflow_profiles_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_workflow_profiles_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "workflow_profiles_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.approvedByUserId],
			foreignColumns: [users.id],
			name: "workflow_profiles_approved_by_user_id_users_id_fk"
		}),
]);

export const cachedXeroCreditNotes = pgTable("cached_xero_credit_notes", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	xeroCreditNoteId: varchar("xero_credit_note_id").notNull(),
	xeroContactId: varchar("xero_contact_id"),
	creditNoteNumber: varchar("credit_note_number"),
	status: varchar().default('AUTHORISED').notNull(),
	type: varchar().default('ACCRECCREDIT').notNull(),
	date: timestamp({ mode: 'string' }),
	total: numeric({ precision: 10, scale:  2 }).default('0'),
	remainingCredit: numeric("remaining_credit", { precision: 10, scale:  2 }).default('0'),
	updatedDateUtc: timestamp("updated_date_utc", { mode: 'string' }),
	syncedAt: timestamp("synced_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "cached_xero_credit_notes_tenant_id_tenants_id_fk"
		}),
]);

export const workflowMessageVariants = pgTable("workflow_message_variants", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	workflowProfileId: varchar("workflow_profile_id").notNull(),
	key: varchar().notNull(),
	channel: varchar().notNull(),
	subject: varchar(),
	body: text().notNull(),
	version: integer().default(1),
	isEdited: boolean("is_edited").default(false),
	generatedAt: timestamp("generated_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_workflow_message_variants_key_channel").using("btree", table.key.asc().nullsLast().op("text_ops"), table.channel.asc().nullsLast().op("text_ops")),
	index("idx_workflow_message_variants_profile_id").using("btree", table.workflowProfileId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.workflowProfileId],
			foreignColumns: [workflowProfiles.id],
			name: "workflow_message_variants_workflow_profile_id_workflow_profiles"
		}).onDelete("cascade"),
]);

export const permissions = pgTable("permissions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	category: varchar().notNull(),
	description: text().notNull(),
	resourceType: varchar("resource_type"),
	action: varchar().notNull(),
	isSystemPermission: boolean("is_system_permission").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("permissions_name_unique").on(table.name),
]);

export const rolePermissions = pgTable("role_permissions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	role: varchar().notNull(),
	permissionId: varchar("permission_id").notNull(),
	isDefault: boolean("is_default").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.permissionId],
			foreignColumns: [permissions.id],
			name: "role_permissions_permission_id_permissions_id_fk"
		}).onDelete("cascade"),
	unique("role_permission_unique").on(table.role, table.permissionId),
]);

export const customerContactPersons = pgTable("customer_contact_persons", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	name: varchar().notNull(),
	email: varchar(),
	phone: varchar(),
	jobTitle: varchar("job_title"),
	isPrimaryCreditControl: boolean("is_primary_credit_control").default(false),
	isEscalation: boolean("is_escalation").default(false),
	isFromXero: boolean("is_from_xero").default(false),
	xeroContactPersonId: varchar("xero_contact_person_id"),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	smsNumber: varchar("sms_number"),
}, (table) => [
	index("idx_customer_contact_persons_contact_id").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_customer_contact_persons_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "customer_contact_persons_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "customer_contact_persons_contact_id_contacts_id_fk"
		}),
]);

export const contactNotes = pgTable("contact_notes", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	content: text().notNull(),
	createdByUserId: varchar("created_by_user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	noteType: varchar("note_type").default('general'),
	reminderDate: timestamp("reminder_date", { mode: 'string' }),
	assignedToUserId: varchar("assigned_to_user_id"),
	status: varchar().default('active'),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	index("idx_contact_notes_assigned_to").using("btree", table.assignedToUserId.asc().nullsLast().op("text_ops")),
	index("idx_contact_notes_contact_id").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_contact_notes_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_contact_notes_reminder_date").using("btree", table.reminderDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_contact_notes_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "contact_notes_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "contact_notes_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "contact_notes_created_by_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedToUserId],
			foreignColumns: [users.id],
			name: "contact_notes_assigned_to_user_id_users_id_fk"
		}),
]);

export const invoices = pgTable("invoices", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	xeroInvoiceId: varchar("xero_invoice_id"),
	invoiceNumber: varchar("invoice_number").notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	amountPaid: numeric("amount_paid", { precision: 10, scale:  2 }).default('0'),
	taxAmount: numeric("tax_amount", { precision: 10, scale:  2 }).default('0'),
	status: varchar().default('pending').notNull(),
	issueDate: timestamp("issue_date", { mode: 'string' }).notNull(),
	dueDate: timestamp("due_date", { mode: 'string' }).notNull(),
	paidDate: timestamp("paid_date", { mode: 'string' }),
	description: text(),
	currency: varchar().default('GBP'),
	workflowId: varchar("workflow_id"),
	lastReminderSent: timestamp("last_reminder_sent", { mode: 'string' }),
	reminderCount: integer("reminder_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	collectionStage: varchar("collection_stage").default('initial'),
	isOnHold: boolean("is_on_hold").default(false),
	nextAction: varchar("next_action"),
	nextActionDate: timestamp("next_action_date", { mode: 'string' }),
	escalationFlag: boolean("escalation_flag").default(false),
	legalFlag: boolean("legal_flag").default(false),
	balance: numeric({ precision: 10, scale:  2 }),
	baseRateAnnual: numeric("base_rate_annual", { precision: 5, scale:  2 }),
	statutoryUpliftPct: numeric("statutory_uplift_pct", { precision: 5, scale:  2 }),
	workflowState: varchar("workflow_state").default('pre_due'),
	pauseState: varchar("pause_state"),
	pausedAt: timestamp("paused_at", { mode: 'string' }),
	pausedUntil: timestamp("paused_until", { mode: 'string' }),
	pauseReason: text("pause_reason"),
	pauseMetadata: jsonb("pause_metadata"),
	stage: varchar().default('overdue'),
	invoiceStatus: varchar("invoice_status").default('OPEN'),
	outcomeOverride: varchar("outcome_override"),
	sageInvoiceId: varchar("sage_invoice_id"),
	quickBooksInvoiceId: varchar("quick_books_invoice_id"),
}, (table) => [
	index("idx_invoices_contact_id").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_invoices_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_invoices_due_date").using("btree", table.dueDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_invoices_invoice_number").using("btree", table.invoiceNumber.asc().nullsLast().op("text_ops")),
	index("idx_invoices_invoice_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.invoiceStatus.asc().nullsLast().op("text_ops")),
	index("idx_invoices_next_action_date").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.nextActionDate.asc().nullsLast().op("text_ops")),
	index("idx_invoices_pause_state").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.pauseState.asc().nullsLast().op("text_ops")),
	index("idx_invoices_tenant_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("idx_invoices_workflow_state").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.workflowState.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "invoices_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "invoices_contact_id_contacts_id_fk"
		}),
]);

export const activityEvents = pgTable("activity_events", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	eventType: varchar("event_type").notNull(),
	category: varchar().notNull(),
	title: varchar().notNull(),
	description: text(),
	triggeredBy: varchar("triggered_by").notNull(),
	direction: varchar(),
	linkedInvoiceId: varchar("linked_invoice_id"),
	linkedWorkflowId: varchar("linked_workflow_id"),
	linkedDisputeId: varchar("linked_dispute_id"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_activity_events_tenant_contact_date").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.contactId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "activity_events_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "activity_events_contact_id_contacts_id_fk"
		}),
]);

export const paymentPlans = pgTable("payment_plans", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	totalAmount: numeric("total_amount", { precision: 10, scale:  2 }).notNull(),
	initialPaymentAmount: numeric("initial_payment_amount", { precision: 10, scale:  2 }).default('0'),
	planStartDate: timestamp("plan_start_date", { mode: 'string' }).notNull(),
	initialPaymentDate: timestamp("initial_payment_date", { mode: 'string' }),
	paymentFrequency: varchar("payment_frequency").notNull(),
	numberOfPayments: integer("number_of_payments").notNull(),
	status: varchar().default('active').notNull(),
	notes: text(),
	createdByUserId: varchar("created_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	source: varchar().default('manual'),
	outstandingAtCreation: numeric("outstanding_at_creation", { precision: 10, scale:  2 }),
	nextCheckDate: timestamp("next_check_date", { mode: 'string' }),
	lastCheckedOutstanding: numeric("last_checked_outstanding", { precision: 10, scale:  2 }),
	lastCheckedAt: timestamp("last_checked_at", { mode: 'string' }),
}, (table) => [
	index("idx_payment_plans_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_payment_plans_next_check").using("btree", table.nextCheckDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_payment_plans_start_date").using("btree", table.planStartDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_payment_plans_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_payment_plans_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "payment_plans_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "payment_plans_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "payment_plans_created_by_user_id_users_id_fk"
		}),
]);

export const attentionItems = pgTable("attention_items", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	type: varchar().notNull(),
	severity: varchar().default('MEDIUM').notNull(),
	status: varchar().default('OPEN').notNull(),
	invoiceId: varchar("invoice_id"),
	contactId: varchar("contact_id"),
	actionId: varchar("action_id"),
	inboundMessageId: varchar("inbound_message_id"),
	title: varchar().notNull(),
	description: text(),
	payloadJson: jsonb("payload_json"),
	assignedToUserId: varchar("assigned_to_user_id"),
	resolvedByUserId: varchar("resolved_by_user_id"),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	resolutionNotes: text("resolution_notes"),
	resolutionAction: varchar("resolution_action"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_attention_items_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_attention_items_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_attention_items_severity").using("btree", table.severity.asc().nullsLast().op("text_ops")),
	index("idx_attention_items_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_attention_items_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("idx_attention_items_tenant_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("idx_attention_items_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "attention_items_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "attention_items_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "attention_items_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.actionId],
			foreignColumns: [actions.id],
			name: "attention_items_action_id_actions_id_fk"
		}),
	foreignKey({
			columns: [table.inboundMessageId],
			foreignColumns: [inboundMessages.id],
			name: "attention_items_inbound_message_id_inbound_messages_id_fk"
		}),
	foreignKey({
			columns: [table.assignedToUserId],
			foreignColumns: [users.id],
			name: "attention_items_assigned_to_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.resolvedByUserId],
			foreignColumns: [users.id],
			name: "attention_items_resolved_by_user_id_users_id_fk"
		}),
]);

export const forecastPoints = pgTable("forecast_points", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	dateBucket: timestamp("date_bucket", { mode: 'string' }).notNull(),
	bucketType: varchar("bucket_type").default('DAY').notNull(),
	highAmount: numeric("high_amount", { precision: 12, scale:  2 }).default('0').notNull(),
	mediumAmount: numeric("medium_amount", { precision: 12, scale:  2 }).default('0').notNull(),
	lowAmount: numeric("low_amount", { precision: 12, scale:  2 }).default('0').notNull(),
	highInvoiceCount: integer("high_invoice_count").default(0).notNull(),
	mediumInvoiceCount: integer("medium_invoice_count").default(0).notNull(),
	lowInvoiceCount: integer("low_invoice_count").default(0).notNull(),
	excludedAmount: numeric("excluded_amount", { precision: 12, scale:  2 }).default('0').notNull(),
	excludedInvoiceCount: integer("excluded_invoice_count").default(0).notNull(),
	computedAt: timestamp("computed_at", { mode: 'string' }).defaultNow(),
	triggerEvent: varchar("trigger_event"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_forecast_points_bucket_type").using("btree", table.bucketType.asc().nullsLast().op("text_ops")),
	index("idx_forecast_points_date").using("btree", table.dateBucket.asc().nullsLast().op("timestamp_ops")),
	index("idx_forecast_points_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "forecast_points_tenant_id_tenants_id_fk"
		}),
	unique("uq_forecast_points_tenant_date_type").on(table.tenantId, table.dateBucket, table.bucketType),
]);

export const rileyConversations = pgTable("riley_conversations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	userId: varchar("user_id").notNull(),
	messages: jsonb().default([]).notNull(),
	topic: text(),
	relatedEntityType: text("related_entity_type"),
	relatedEntityId: text("related_entity_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_riley_conversations_tenant_user").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "riley_conversations_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "riley_conversations_user_id_users_id_fk"
		}),
]);

export const forecastUserAdjustments = pgTable("forecast_user_adjustments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	category: text().notNull(),
	description: text().notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	timingType: text("timing_type").notNull(),
	startDate: timestamp("start_date", { mode: 'string' }),
	endDate: timestamp("end_date", { mode: 'string' }),
	enteredDate: timestamp("entered_date", { mode: 'string' }).defaultNow().notNull(),
	expiryDate: timestamp("expiry_date", { mode: 'string' }),
	lastConfirmedDate: timestamp("last_confirmed_date", { mode: 'string' }),
	expired: boolean().default(false),
	affects: text().notNull(),
	source: text().notNull(),
	sourceConversationId: varchar("source_conversation_id"),
	materialityScore: numeric("materiality_score", { precision: 6, scale:  4 }),
	followUpPriority: text("follow_up_priority").default('none'),
	followUpStatus: text("follow_up_status").default('pending'),
	lastFollowUpAt: timestamp("last_follow_up_at", { mode: 'string' }),
	followUpCount: integer("follow_up_count").default(0),
	autoResolved: boolean("auto_resolved").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_forecast_adjustments_expired").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.expired.asc().nullsLast().op("text_ops")),
	index("idx_forecast_adjustments_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "forecast_user_adjustments_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.sourceConversationId],
			foreignColumns: [rileyConversations.id],
			name: "forecast_user_adjustments_source_conversation_id_riley_conversa"
		}),
]);

export const onboardingProgress = pgTable("onboarding_progress", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	currentPhase: varchar("current_phase").default('technical_connection').notNull(),
	completedPhases: jsonb("completed_phases").default([]),
	phaseData: jsonb("phase_data").default({}),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	step1Status: varchar("step1_status").default('NOT_STARTED').notNull(),
	step2Status: varchar("step2_status").default('NOT_STARTED').notNull(),
	step3Status: varchar("step3_status").default('NOT_STARTED').notNull(),
	step4Status: varchar("step4_status").default('NOT_STARTED').notNull(),
	step5Status: varchar("step5_status").default('NOT_STARTED').notNull(),
	step6Status: varchar("step6_status").default('NOT_STARTED').notNull(),
	companyDetails: jsonb("company_details"),
	smsMobileOptIn: boolean("sms_mobile_opt_in").default(false),
	agedDebtorsSummary: jsonb("aged_debtors_summary"),
	contactDataSummary: jsonb("contact_data_summary"),
	lastAnalysisAt: timestamp("last_analysis_at", { mode: 'string' }),
	step7Status: varchar("step7_status").default('NOT_STARTED').notNull(),
	step8Status: varchar("step8_status").default('NOT_STARTED').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "onboarding_progress_tenant_id_tenants_id_fk"
		}),
	unique("onboarding_progress_tenant").on(table.tenantId),
]);

export const tenantMetadata = pgTable("tenant_metadata", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	tenantType: varchar("tenant_type").default('client').notNull(),
	subscriptionPlanId: varchar("subscription_plan_id"),
	stripeCustomerId: varchar("stripe_customer_id"),
	stripeSubscriptionId: varchar("stripe_subscription_id"),
	billingEmail: varchar("billing_email"),
	currentMonthInvoices: integer("current_month_invoices").default(0),
	currentClientCount: integer("current_client_count").default(0),
	subscriptionStatus: varchar("subscription_status").default('active'),
	subscriptionStartDate: timestamp("subscription_start_date", { mode: 'string' }),
	subscriptionEndDate: timestamp("subscription_end_date", { mode: 'string' }),
	trialStartDate: timestamp("trial_start_date", { mode: 'string' }),
	trialEndDate: timestamp("trial_end_date", { mode: 'string' }),
	isInTrial: boolean("is_in_trial").default(false),
	usageLimits: jsonb("usage_limits").default({}),
	currentUsage: jsonb("current_usage").default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_tenant_metadata_status").using("btree", table.subscriptionStatus.asc().nullsLast().op("text_ops")),
	index("idx_tenant_metadata_subscription").using("btree", table.subscriptionPlanId.asc().nullsLast().op("text_ops")),
	index("idx_tenant_metadata_type").using("btree", table.tenantType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "tenant_metadata_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.subscriptionPlanId],
			foreignColumns: [subscriptionPlans.id],
			name: "tenant_metadata_subscription_plan_id_subscription_plans_id_fk"
		}),
	unique("unique_tenant_metadata").on(table.tenantId),
]);

export const subscriptionPlans = pgTable("subscription_plans", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	type: varchar().notNull(),
	description: text(),
	monthlyPrice: numeric("monthly_price", { precision: 10, scale:  2 }).notNull(),
	yearlyPrice: numeric("yearly_price", { precision: 10, scale:  2 }),
	currency: varchar().default('GBP'),
	maxClientTenants: integer("max_client_tenants").default(0),
	maxUsers: integer("max_users").default(5),
	maxInvoicesPerMonth: integer("max_invoices_per_month").default(1000),
	features: jsonb().default([]),
	stripePriceId: varchar("stripe_price_id"),
	stripeProductId: varchar("stripe_product_id"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const outcomes = pgTable("outcomes", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	debtorId: varchar("debtor_id").notNull(),
	invoiceId: varchar("invoice_id"),
	linkedInvoiceIds: jsonb("linked_invoice_ids").default([]),
	type: varchar().notNull(),
	confidence: numeric({ precision: 3, scale:  2 }).notNull(),
	confidenceBand: varchar("confidence_band").notNull(),
	requiresHumanReview: boolean("requires_human_review").default(false).notNull(),
	effect: varchar(),
	extracted: jsonb().default({}),
	sourceChannel: varchar("source_channel"),
	sourceMessageId: varchar("source_message_id"),
	rawSnippet: text("raw_snippet"),
	createdByUserId: varchar("created_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_outcomes_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_outcomes_debtor").using("btree", table.debtorId.asc().nullsLast().op("text_ops")),
	index("idx_outcomes_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_outcomes_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("idx_outcomes_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "outcomes_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.debtorId],
			foreignColumns: [contacts.id],
			name: "outcomes_debtor_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "outcomes_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "outcomes_created_by_user_id_users_id_fk"
		}),
	unique("uniq_outcomes_source").on(table.tenantId, table.sourceChannel, table.sourceMessageId),
]);

export const collectionPolicies = pgTable("collection_policies", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	name: varchar().default('Default Policy').notNull(),
	isDefault: boolean("is_default").default(false),
	waitDaysForReply: integer("wait_days_for_reply").default(3).notNull(),
	cooldownDaysBetweenTouches: integer("cooldown_days_between_touches").default(5).notNull(),
	maxTouchesBeforeEscalation: integer("max_touches_before_escalation").default(4).notNull(),
	confirmPtpDaysBefore: integer("confirm_ptp_days_before").default(1).notNull(),
	escalationRoute: varchar("escalation_route").default('ATTENTION').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_collection_policies_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "collection_policies_tenant_id_tenants_id_fk"
		}),
]);

export const weeklyReviews = pgTable("weekly_reviews", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	weekStartDate: date("week_start_date").notNull(),
	weekEndDate: date("week_end_date").notNull(),
	generatedAt: timestamp("generated_at", { mode: 'string' }).defaultNow().notNull(),
	summaryText: text("summary_text").notNull(),
	keyNumbers: jsonb("key_numbers"),
	debtorFocus: jsonb("debtor_focus"),
	forecastAdjustmentsUsed: jsonb("forecast_adjustments_used"),
	previousReviewId: varchar("previous_review_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "weekly_reviews_tenant_id_tenants_id_fk"
		}),
]);

export const voiceCalls = pgTable("voice_calls", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	invoiceId: varchar("invoice_id"),
	retellCallId: varchar("retell_call_id").notNull(),
	retellAgentId: varchar("retell_agent_id").notNull(),
	fromNumber: varchar("from_number").notNull(),
	toNumber: varchar("to_number").notNull(),
	direction: varchar().notNull(),
	status: varchar().default('initiated').notNull(),
	duration: integer(),
	cost: numeric({ precision: 8, scale:  4 }),
	transcript: text(),
	recordingUrl: varchar("recording_url"),
	callAnalysis: jsonb("call_analysis"),
	userSentiment: varchar("user_sentiment"),
	callSuccessful: boolean("call_successful"),
	disconnectionReason: varchar("disconnection_reason"),
	customerResponse: varchar("customer_response"),
	followUpRequired: boolean("follow_up_required").default(false),
	scheduledAt: timestamp("scheduled_at", { mode: 'string' }),
	startedAt: timestamp("started_at", { mode: 'string' }),
	endedAt: timestamp("ended_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	callDisposition: varchar("call_disposition"),
	promisedAmount: numeric("promised_amount", { precision: 10, scale:  2 }),
	promisedDate: timestamp("promised_date", { mode: 'string' }),
	disputeReason: text("dispute_reason"),
	callbackRequested: boolean("callback_requested").default(false),
	callbackTime: varchar("callback_time"),
	financialHardship: boolean("financial_hardship").default(false),
	wrongNumber: boolean("wrong_number").default(false),
	partialPaymentOffered: numeric("partial_payment_offered", { precision: 10, scale:  2 }),
	customExtractedData: jsonb("custom_extracted_data"),
	conversationId: varchar("conversation_id"),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "voice_calls_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "voice_calls_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "voice_calls_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "voice_calls_conversation_id_conversations_id_fk"
		}),
]);

export const smsMessages = pgTable("sms_messages", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id"),
	invoiceId: varchar("invoice_id"),
	twilioMessageSid: varchar("twilio_message_sid"),
	fromNumber: varchar("from_number").notNull(),
	toNumber: varchar("to_number").notNull(),
	direction: varchar().notNull(),
	status: varchar().default('sent').notNull(),
	body: text().notNull(),
	numSegments: integer("num_segments").default(1),
	cost: numeric({ precision: 6, scale:  4 }),
	errorCode: varchar("error_code"),
	errorMessage: text("error_message"),
	intent: varchar(),
	sentiment: varchar(),
	requiresResponse: boolean("requires_response").default(false),
	respondedAt: timestamp("responded_at", { mode: 'string' }),
	sentAt: timestamp("sent_at", { mode: 'string' }),
	deliveredAt: timestamp("delivered_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	provider: varchar().default('twilio').notNull(),
	vonageMessageId: varchar("vonage_message_id"),
	conversationId: varchar("conversation_id"),
}, (table) => [
	index("idx_sms_contact_id").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_sms_direction").using("btree", table.direction.asc().nullsLast().op("text_ops")),
	index("idx_sms_provider").using("btree", table.provider.asc().nullsLast().op("text_ops")),
	index("idx_sms_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_sms_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "sms_messages_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "sms_messages_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "sms_messages_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "sms_messages_conversation_id_conversations_id_fk"
		}),
	unique("sms_messages_twilio_message_sid_unique").on(table.twilioMessageSid),
	unique("sms_messages_vonage_message_id_unique").on(table.vonageMessageId),
]);

export const conversations = pgTable("conversations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	subject: varchar(),
	status: varchar().default('open').notNull(),
	channel: varchar().default('email').notNull(),
	messageCount: integer("message_count").default(0).notNull(),
	lastMessageAt: timestamp("last_message_at", { mode: 'string' }),
	lastMessageDirection: varchar("last_message_direction"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_conversations_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_conversations_last_message").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.lastMessageAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_conversations_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("idx_conversations_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "conversations_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "conversations_contact_id_contacts_id_fk"
		}),
]);

export const quizLeads = pgTable("quiz_leads", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	fullName: varchar("full_name").notNull(),
	email: varchar().notNull(),
	companyName: varchar("company_name"),
	role: varchar(),
	completed: boolean().default(false),
	totalScore: integer("total_score"),
	creditControlScore: integer("credit_control_score"),
	cashflowScore: integer("cashflow_score"),
	financeScore: integer("finance_score"),
	overallTier: varchar("overall_tier"),
	creditControlTier: varchar("credit_control_tier"),
	cashflowTier: varchar("cashflow_tier"),
	financeTier: varchar("finance_tier"),
	weakestSection: varchar("weakest_section"),
	answers: jsonb(),
	bookSent: boolean("book_sent").default(false),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	demoBooked: boolean("demo_booked").default(false),
	demoBookedAt: timestamp("demo_booked_at", { mode: 'string' }),
	calBookingUid: varchar("cal_booking_uid"),
}, (table) => [
	index("idx_quiz_leads_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const partners = pgTable("partners", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	email: varchar().notNull(),
	phone: varchar(),
	website: varchar(),
	addressLine1: varchar("address_line1"),
	addressLine2: varchar("address_line2"),
	city: varchar(),
	state: varchar(),
	postalCode: varchar("postal_code"),
	country: varchar().default('GB'),
	logoUrl: varchar("logo_url"),
	brandColor: varchar("brand_color").default('#17B6C3'),
	subscriptionPlanId: varchar("subscription_plan_id"),
	stripeCustomerId: varchar("stripe_customer_id"),
	stripeSubscriptionId: varchar("stripe_subscription_id"),
	subscriptionStatus: varchar("subscription_status").default('active'),
	currentClientCount: integer("current_client_count").default(0),
	maxClientCount: integer("max_client_count").default(10),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	slug: varchar().notNull(),
	accentColor: varchar("accent_color").default('#1396A1'),
	brandName: varchar("brand_name"),
	emailFromName: varchar("email_from_name"),
	emailReplyTo: varchar("email_reply_to"),
	emailFooterText: text("email_footer_text"),
	status: varchar().default('PILOT'),
	defaultExecutionTime: varchar("default_execution_time").default('09:00'),
	channelsEnabled: jsonb("channels_enabled").default({"sms":false,"email":true,"voice":false}),
	whitelabelEnabled: boolean("whitelabel_enabled").default(false),
	notes: text(),
}, (table) => [
	index("idx_partners_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_partners_slug").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("idx_partners_status").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.subscriptionPlanId],
			foreignColumns: [subscriptionPlans.id],
			name: "partners_subscription_plan_id_subscription_plans_id_fk"
		}),
	unique("partners_slug_unique").on(table.slug),
]);

export const quizConversations = pgTable("quiz_conversations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	quizLeadId: varchar("quiz_lead_id").notNull(),
	messages: jsonb().default([]),
	messageCount: integer("message_count").default(0),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow(),
	lastMessageAt: timestamp("last_message_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_quiz_conversations_lead").using("btree", table.quizLeadId.asc().nullsLast().op("text_ops")),
]);

export const webhookEvents = pgTable("webhook_events", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	idempotencyKey: varchar("idempotency_key").notNull(),
	source: varchar().notNull(),
	eventType: varchar("event_type").notNull(),
	status: varchar().default('processed').notNull(),
	tenantId: varchar("tenant_id"),
	payload: jsonb(),
	errorMessage: text("error_message"),
	processedAt: timestamp("processed_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_webhook_events_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_webhook_events_key").using("btree", table.idempotencyKey.asc().nullsLast().op("text_ops")),
	index("idx_webhook_events_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
	unique("webhook_events_idempotency_key_unique").on(table.idempotencyKey),
]);

export const ardHistory = pgTable("ard_history", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	calculationDate: timestamp("calculation_date", { mode: 'string' }).notNull(),
	averageReceivableDays: numeric("average_receivable_days", { precision: 6, scale:  2 }).notNull(),
	sampleSize: integer("sample_size").notNull(),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }).notNull(),
	windowDays: integer("window_days").default(90),
	outliersExcluded: integer("outliers_excluded").default(0),
	ardByCustomer: jsonb("ard_by_customer"),
	ardByIndustry: jsonb("ard_by_industry"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("ard_history_tenant_date_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.calculationDate.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "ard_history_tenant_id_tenants_id_fk"
		}),
]);

export const investorLeads = pgTable("investor_leads", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	email: varchar().notNull(),
	phone: varchar(),
	voiceDemoCompleted: boolean("voice_demo_completed").default(false),
	smsDemoCompleted: boolean("sms_demo_completed").default(false),
	voiceDemoResults: jsonb("voice_demo_results"),
	smsDemoResults: jsonb("sms_demo_results"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	voiceName: varchar("voice_name"),
	smsName: varchar("sms_name"),
});

export const investmentCallRequests = pgTable("investment_call_requests", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar().notNull(),
	phone: varchar().notNull(),
	email: varchar().notNull(),
	isHighNetWorth: boolean("is_high_net_worth").default(false).notNull(),
	acknowledgesRisk: boolean("acknowledges_risk").default(false).notNull(),
	status: varchar().default('pending').notNull(),
	requestedAt: timestamp("requested_at", { mode: 'string' }).defaultNow(),
	contactedAt: timestamp("contacted_at", { mode: 'string' }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const emailClarifications = pgTable("email_clarifications", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	conversationId: varchar("conversation_id"),
	originalMessageId: varchar("original_message_id"),
	ambiguityType: varchar("ambiguity_type").notNull(),
	ambiguityDetails: jsonb("ambiguity_details"),
	clarificationEmailId: varchar("clarification_email_id"),
	clarificationSentAt: timestamp("clarification_sent_at", { mode: 'string' }),
	responseMessageId: varchar("response_message_id"),
	responseReceivedAt: timestamp("response_received_at", { mode: 'string' }),
	status: varchar().default('pending').notNull(),
	resolvedIntentType: varchar("resolved_intent_type"),
	resolvedData: jsonb("resolved_data"),
	confirmationEmailId: varchar("confirmation_email_id"),
	confirmationSentAt: timestamp("confirmation_sent_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
}, (table) => [
	index("idx_email_clarifications_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_email_clarifications_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_email_clarifications_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "email_clarifications_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "email_clarifications_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "email_clarifications_conversation_id_conversations_id_fk"
		}),
	foreignKey({
			columns: [table.originalMessageId],
			foreignColumns: [inboundMessages.id],
			name: "email_clarifications_original_message_id_inbound_messages_id_fk"
		}),
	foreignKey({
			columns: [table.responseMessageId],
			foreignColumns: [inboundMessages.id],
			name: "email_clarifications_response_message_id_inbound_messages_id_fk"
		}),
]);

export const demoCalls = pgTable("demo_calls", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	callerName: text("caller_name").notNull(),
	phoneNumber: text("phone_number").notNull(),
	ipAddress: text("ip_address"),
	retellCallId: text("retell_call_id"),
	status: text().default('initiated'),
	transcript: jsonb(),
	intentScore: integer("intent_score"),
	sentiment: text(),
	commitmentLevel: text("commitment_level"),
	cashflowImpact: jsonb("cashflow_impact"),
	recommendedActions: jsonb("recommended_actions"),
	riskInsights: jsonb("risk_insights"),
	callDurationSeconds: integer("call_duration_seconds"),
	startedAt: timestamp("started_at", { mode: 'string' }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_demo_calls_ip").using("btree", table.ipAddress.asc().nullsLast().op("text_ops")),
	index("idx_demo_calls_phone").using("btree", table.phoneNumber.asc().nullsLast().op("text_ops")),
]);

export const magicLinkTokens = pgTable("magic_link_tokens", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	token: varchar().notNull(),
	purpose: varchar().default('invoice_access').notNull(),
	invoiceIds: text("invoice_ids").array(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { mode: 'string' }),
	isRevoked: boolean("is_revoked").default(false),
	otpCode: varchar("otp_code"),
	otpExpiresAt: timestamp("otp_expires_at", { mode: 'string' }),
	otpVerifiedAt: timestamp("otp_verified_at", { mode: 'string' }),
	otpAttempts: integer("otp_attempts").default(0),
	sessionId: varchar("session_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_magic_link_expires").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_magic_link_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "magic_link_tokens_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "magic_link_tokens_contact_id_contacts_id_fk"
		}),
	unique("magic_link_tokens_token_unique").on(table.token),
]);

export const customerBehaviorSignals = pgTable("customer_behavior_signals", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	contactId: varchar("contact_id").notNull(),
	tenantId: varchar("tenant_id").notNull(),
	medianDaysToPay: numeric("median_days_to_pay", { precision: 8, scale:  2 }),
	p75DaysToPay: numeric("p75_days_to_pay", { precision: 8, scale:  2 }),
	volatility: numeric({ precision: 8, scale:  4 }),
	trend: numeric({ precision: 8, scale:  4 }),
	emailOpenRate: numeric("email_open_rate", { precision: 3, scale:  2 }),
	emailClickRate: numeric("email_click_rate", { precision: 3, scale:  2 }),
	emailReplyRate: numeric("email_reply_rate", { precision: 3, scale:  2 }),
	smsReplyRate: numeric("sms_reply_rate", { precision: 3, scale:  2 }),
	callAnswerRate: numeric("call_answer_rate", { precision: 3, scale:  2 }),
	whatsappReplyRate: numeric("whatsapp_reply_rate", { precision: 3, scale:  2 }),
	amountSensitivity: jsonb("amount_sensitivity"),
	weekdayEffect: jsonb("weekday_effect"),
	monthEffect: jsonb("month_effect"),
	disputeCount: integer("dispute_count").default(0),
	partialPaymentCount: integer("partial_payment_count").default(0),
	promiseBreachCount: integer("promise_breach_count").default(0),
	segment: varchar(),
	segmentPriors: jsonb("segment_priors"),
	invoiceCount: integer("invoice_count").default(0),
	lastPaymentDate: timestamp("last_payment_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_behavior_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_behavior_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "customer_behavior_signals_contact_id_contacts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "customer_behavior_signals_tenant_id_tenants_id_fk"
		}),
	unique("behavior_contact_unique").on(table.contactId),
]);

export const collectionAbTests = pgTable("collection_ab_tests", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	testName: varchar("test_name").notNull(),
	testType: varchar("test_type").notNull(),
	description: text(),
	variantA: jsonb("variant_a"),
	variantB: jsonb("variant_b"),
	targetSegment: jsonb("target_segment"),
	isActive: boolean("is_active").default(true),
	startDate: timestamp("start_date", { mode: 'string' }).defaultNow(),
	endDate: timestamp("end_date", { mode: 'string' }),
	variantACount: integer("variant_a_count").default(0),
	variantBCount: integer("variant_b_count").default(0),
	variantASuccessRate: numeric("variant_a_success_rate", { precision: 5, scale:  2 }),
	variantBSuccessRate: numeric("variant_b_success_rate", { precision: 5, scale:  2 }),
	winner: varchar(),
	confidenceLevel: numeric("confidence_level", { precision: 3, scale:  2 }),
	significanceReached: boolean("significance_reached").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "collection_ab_tests_tenant_id_tenants_id_fk"
		}),
]);

export const emailDomainMappings = pgTable("email_domain_mappings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	domain: varchar().notNull(),
	contactId: varchar("contact_id").notNull(),
	createdByUserId: varchar("created_by_user_id"),
	isAutoMatched: boolean("is_auto_matched").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_email_domain_mappings_domain").using("btree", table.domain.asc().nullsLast().op("text_ops")),
	index("idx_email_domain_mappings_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "email_domain_mappings_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "email_domain_mappings_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "email_domain_mappings_created_by_user_id_users_id_fk"
		}),
	unique("unique_tenant_domain").on(table.tenantId, table.domain),
]);

export const emailSenderMappings = pgTable("email_sender_mappings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	senderEmail: varchar("sender_email").notNull(),
	contactId: varchar("contact_id").notNull(),
	createdByUserId: varchar("created_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_email_sender_mappings_sender_email").using("btree", table.senderEmail.asc().nullsLast().op("text_ops")),
	index("idx_email_sender_mappings_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "email_sender_mappings_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "email_sender_mappings_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "email_sender_mappings_created_by_user_id_users_id_fk"
		}),
	unique("unique_tenant_sender_email").on(table.tenantId, table.senderEmail),
]);

export const schedulerState = pgTable("scheduler_state", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	scheduleId: varchar("schedule_id"),
	dsoProjected: numeric("dso_projected", { precision: 7, scale:  2 }),
	urgencyFactor: numeric("urgency_factor", { precision: 3, scale:  2 }).default('0.50'),
	lastComputedAt: timestamp("last_computed_at", { mode: 'string' }),
	computationMetadata: jsonb("computation_metadata"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_scheduler_state_schedule").using("btree", table.scheduleId.asc().nullsLast().op("text_ops")),
	index("idx_scheduler_state_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "scheduler_state_tenant_id_tenants_id_fk"
		}),
	unique("unique_tenant_schedule").on(table.tenantId, table.scheduleId),
]);

export const globalTemplates = pgTable("global_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	code: varchar().notNull(),
	channel: varchar().notNull(),
	tone: varchar().notNull(),
	locale: varchar().default('en-GB').notNull(),
	version: varchar().default('1.0.0').notNull(),
	subject: varchar(),
	body: text().notNull(),
	requiredVars: text("required_vars").array().default([""]).notNull(),
	complianceFlags: text("compliance_flags").array().default([""]),
	status: varchar().default('active').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("global_templates_code_unique").on(table.code),
]);

export const tenantTemplates = pgTable("tenant_templates", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	sourceGlobalId: varchar("source_global_id"),
	sourceVersion: varchar("source_version"),
	code: varchar().notNull(),
	channel: varchar().notNull(),
	tone: varchar().notNull(),
	locale: varchar().default('en-GB').notNull(),
	subject: varchar(),
	body: text().notNull(),
	requiredVars: text("required_vars").array().default([""]).notNull(),
	complianceFlags: text("compliance_flags").array().default([""]),
	isLocked: boolean("is_locked").default(false),
	status: varchar().default('active').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "tenant_templates_tenant_id_tenants_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sourceGlobalId],
			foreignColumns: [globalTemplates.id],
			name: "tenant_templates_source_global_id_global_templates_id_fk"
		}),
]);

export const analysisJobs = pgTable("analysis_jobs", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	type: varchar().notNull(),
	status: varchar().default('QUEUED').notNull(),
	progressCurrent: integer("progress_current").default(0),
	progressTotal: integer("progress_total").default(0),
	startedAt: timestamp("started_at", { mode: 'string' }),
	finishedAt: timestamp("finished_at", { mode: 'string' }),
	errorMessage: text("error_message"),
	triggeredBy: varchar("triggered_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("analysis_jobs_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("analysis_jobs_tenant_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "analysis_jobs_tenant_id_tenants_id_fk"
		}),
]);

export const actionItems = pgTable("action_items", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	invoiceId: varchar("invoice_id"),
	type: varchar().notNull(),
	status: varchar().default('open').notNull(),
	priority: varchar().default('medium').notNull(),
	dueAt: timestamp("due_at", { mode: 'string' }).notNull(),
	assignedToUserId: varchar("assigned_to_user_id"),
	createdByUserId: varchar("created_by_user_id").notNull(),
	notes: text(),
	outcome: text(),
	lastCommunicationId: varchar("last_communication_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_action_items_contact_id").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_action_items_tenant_assigned").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.assignedToUserId.asc().nullsLast().op("text_ops")),
	index("idx_action_items_tenant_invoice").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_action_items_tenant_status_due").using("btree", table.tenantId.asc().nullsLast().op("timestamp_ops"), table.status.asc().nullsLast().op("timestamp_ops"), table.dueAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_action_items_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "action_items_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "action_items_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "action_items_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.assignedToUserId],
			foreignColumns: [users.id],
			name: "action_items_assigned_to_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "action_items_created_by_user_id_users_id_fk"
		}),
]);

export const actionLogs = pgTable("action_logs", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	actionItemId: varchar("action_item_id").notNull(),
	eventType: varchar("event_type").notNull(),
	details: jsonb(),
	createdByUserId: varchar("created_by_user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_action_logs_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_action_logs_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_action_logs_tenant_action").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.actionItemId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "action_logs_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.actionItemId],
			foreignColumns: [actionItems.id],
			name: "action_logs_action_item_id_action_items_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "action_logs_created_by_user_id_users_id_fk"
		}),
]);

export const paymentPromises = pgTable("payment_promises", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	promisedAmount: numeric("promised_amount", { precision: 10, scale:  2 }),
	promisedDate: timestamp("promised_date", { mode: 'string' }).notNull(),
	status: varchar().default('open').notNull(),
	notes: text(),
	createdByUserId: varchar("created_by_user_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	promiseType: varchar("promise_type").default('payment_date').notNull(),
	sourceType: varchar("source_type").notNull(),
	sourceId: varchar("source_id"),
	channel: varchar(),
	actualPaymentDate: timestamp("actual_payment_date", { mode: 'string' }),
	actualPaymentAmount: numeric("actual_payment_amount", { precision: 10, scale:  2 }),
	daysLate: integer("days_late"),
	isSerialPromise: boolean("is_serial_promise").default(false),
	previousPromiseId: varchar("previous_promise_id"),
	promiseSequence: integer("promise_sequence").default(1),
	metadata: jsonb(),
	evaluatedAt: timestamp("evaluated_at", { mode: 'string' }),
	evaluatedByUserId: varchar("evaluated_by_user_id"),
}, (table) => [
	index("idx_payment_promises_contact_id").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_payment_promises_promise_type").using("btree", table.promiseType.asc().nullsLast().op("text_ops")),
	index("idx_payment_promises_promised_date").using("btree", table.promisedDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_payment_promises_source").using("btree", table.sourceType.asc().nullsLast().op("text_ops"), table.sourceId.asc().nullsLast().op("text_ops")),
	index("idx_payment_promises_tenant_invoice").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_payment_promises_tenant_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "payment_promises_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "payment_promises_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "payment_promises_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "payment_promises_created_by_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.evaluatedByUserId],
			foreignColumns: [users.id],
			name: "payment_promises_evaluated_by_user_id_users_id_fk"
		}),
]);

export const paymentPlanInvoices = pgTable("payment_plan_invoices", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	paymentPlanId: varchar("payment_plan_id").notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow(),
	addedByUserId: varchar("added_by_user_id").notNull(),
}, (table) => [
	index("idx_payment_plan_invoices_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_payment_plan_invoices_plan").using("btree", table.paymentPlanId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.paymentPlanId],
			foreignColumns: [paymentPlans.id],
			name: "payment_plan_invoices_payment_plan_id_payment_plans_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "payment_plan_invoices_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.addedByUserId],
			foreignColumns: [users.id],
			name: "payment_plan_invoices_added_by_user_id_users_id_fk"
		}),
	unique("unique_payment_plan_invoice").on(table.paymentPlanId, table.invoiceId),
]);

export const partnerClientRelationships = pgTable("partner_client_relationships", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	partnerUserId: varchar("partner_user_id").notNull(),
	partnerTenantId: varchar("partner_tenant_id").notNull(),
	clientTenantId: varchar("client_tenant_id").notNull(),
	status: varchar().default('active').notNull(),
	accessLevel: varchar("access_level").default('full').notNull(),
	permissions: jsonb().default([]),
	establishedAt: timestamp("established_at", { mode: 'string' }).defaultNow(),
	establishedBy: varchar("established_by").notNull(),
	lastAccessedAt: timestamp("last_accessed_at", { mode: 'string' }),
	terminatedAt: timestamp("terminated_at", { mode: 'string' }),
	terminatedBy: varchar("terminated_by"),
	terminationReason: text("termination_reason"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_partner_relationships_client").using("btree", table.clientTenantId.asc().nullsLast().op("text_ops")),
	index("idx_partner_relationships_partner").using("btree", table.partnerUserId.asc().nullsLast().op("text_ops")),
	index("idx_partner_relationships_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.partnerUserId],
			foreignColumns: [users.id],
			name: "partner_client_relationships_partner_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.partnerTenantId],
			foreignColumns: [tenants.id],
			name: "partner_client_relationships_partner_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.clientTenantId],
			foreignColumns: [tenants.id],
			name: "partner_client_relationships_client_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.terminatedBy],
			foreignColumns: [users.id],
			name: "partner_client_relationships_terminated_by_users_id_fk"
		}),
	unique("unique_partner_client").on(table.partnerUserId, table.clientTenantId),
]);

export const tenantInvitations = pgTable("tenant_invitations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	clientTenantId: varchar("client_tenant_id").notNull(),
	invitedByUserId: varchar("invited_by_user_id").notNull(),
	partnerEmail: varchar("partner_email").notNull(),
	partnerUserId: varchar("partner_user_id"),
	accessLevel: varchar("access_level").default('full').notNull(),
	permissions: jsonb().default([]),
	personalMessage: text("personal_message"),
	status: varchar().default('pending').notNull(),
	respondedAt: timestamp("responded_at", { mode: 'string' }),
	responseMessage: text("response_message"),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	emailSentAt: timestamp("email_sent_at", { mode: 'string' }),
	emailOpenedAt: timestamp("email_opened_at", { mode: 'string' }),
	remindersSent: integer("reminders_sent").default(0),
	lastReminderSentAt: timestamp("last_reminder_sent_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_invitations_client_tenant").using("btree", table.clientTenantId.asc().nullsLast().op("text_ops")),
	index("idx_invitations_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_invitations_partner_email").using("btree", table.partnerEmail.asc().nullsLast().op("text_ops")),
	index("idx_invitations_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientTenantId],
			foreignColumns: [tenants.id],
			name: "tenant_invitations_client_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.invitedByUserId],
			foreignColumns: [users.id],
			name: "tenant_invitations_invited_by_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.partnerUserId],
			foreignColumns: [users.id],
			name: "tenant_invitations_partner_user_id_users_id_fk"
		}),
]);

export const activityLogs = pgTable("activity_logs", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id"),
	activityType: varchar("activity_type").notNull(),
	category: varchar().notNull(),
	entityType: varchar("entity_type"),
	entityId: varchar("entity_id"),
	action: varchar().notNull(),
	description: text().notNull(),
	result: varchar().notNull(),
	metadata: jsonb().default({}),
	errorMessage: text("error_message"),
	errorCode: varchar("error_code"),
	duration: integer(),
	userId: varchar("user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	debtorId: varchar("debtor_id"),
	invoiceId: varchar("invoice_id"),
	actionId: varchar("action_id"),
	outcomeId: varchar("outcome_id"),
	actor: varchar().default('USER'),
	ipAddress: varchar("ip_address"),
	userAgent: text("user_agent"),
}, (table) => [
	index("idx_activity_logs_actor").using("btree", table.actor.asc().nullsLast().op("text_ops")),
	index("idx_activity_logs_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("idx_activity_logs_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("idx_activity_logs_debtor").using("btree", table.debtorId.asc().nullsLast().op("text_ops")),
	index("idx_activity_logs_entity").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	index("idx_activity_logs_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_activity_logs_result").using("btree", table.result.asc().nullsLast().op("text_ops")),
	index("idx_activity_logs_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("idx_activity_logs_type").using("btree", table.activityType.asc().nullsLast().op("text_ops")),
	index("idx_activity_logs_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.debtorId],
			foreignColumns: [contacts.id],
			name: "activity_logs_debtor_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "activity_logs_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.actionId],
			foreignColumns: [actions.id],
			name: "activity_logs_action_id_actions_id_fk"
		}),
	foreignKey({
			columns: [table.outcomeId],
			foreignColumns: [outcomes.id],
			name: "activity_logs_outcome_id_outcomes_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "activity_logs_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "activity_logs_user_id_users_id_fk"
		}),
]);

export const userContactAssignments = pgTable("user_contact_assignments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	tenantId: varchar("tenant_id").notNull(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow(),
	assignedBy: varchar("assigned_by").notNull(),
	isActive: boolean("is_active").default(true),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_contact_assignments_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_user_contact_assignments_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_user_contact_assignments_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("idx_user_contact_assignments_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_contact_assignments_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "user_contact_assignments_contact_id_contacts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "user_contact_assignments_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.assignedBy],
			foreignColumns: [users.id],
			name: "user_contact_assignments_assigned_by_users_id_fk"
		}),
	unique("unique_user_contact_assignment").on(table.userId, table.contactId),
]);

export const salesForecasts = pgTable("sales_forecasts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	forecastMonth: varchar("forecast_month").notNull(),
	committedAmount: numeric("committed_amount", { precision: 12, scale:  2 }).default('0').notNull(),
	uncommittedAmount: numeric("uncommitted_amount", { precision: 12, scale:  2 }).default('0').notNull(),
	stretchAmount: numeric("stretch_amount", { precision: 12, scale:  2 }).default('0').notNull(),
	committedConfidence: numeric("committed_confidence", { precision: 3, scale:  2 }).default('0.90'),
	uncommittedConfidence: numeric("uncommitted_confidence", { precision: 3, scale:  2 }).default('0.60'),
	stretchConfidence: numeric("stretch_confidence", { precision: 3, scale:  2 }).default('0.30'),
	notes: text(),
	createdByUserId: varchar("created_by_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("sales_forecasts_tenant_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "sales_forecasts_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "sales_forecasts_created_by_user_id_users_id_fk"
		}),
	unique("sales_forecast_tenant_month").on(table.tenantId, table.forecastMonth),
]);

export const disputes = pgTable("disputes", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	type: varchar().notNull(),
	status: varchar().default('pending').notNull(),
	summary: text().notNull(),
	buyerContactName: varchar("buyer_contact_name").notNull(),
	buyerContactEmail: varchar("buyer_contact_email"),
	buyerContactPhone: varchar("buyer_contact_phone"),
	responseDueAt: timestamp("response_due_at", { mode: 'string' }).notNull(),
	respondedAt: timestamp("responded_at", { mode: 'string' }),
	respondedByUserId: varchar("responded_by_user_id"),
	resolution: text(),
	resolutionType: varchar("resolution_type"),
	creditNoteAmount: numeric("credit_note_amount", { precision: 10, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_disputes_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_disputes_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_disputes_tenant_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "disputes_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "disputes_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "disputes_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.respondedByUserId],
			foreignColumns: [users.id],
			name: "disputes_responded_by_user_id_users_id_fk"
		}),
]);

export const actionEffectiveness = pgTable("action_effectiveness", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	actionId: varchar("action_id").notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	wasDelivered: boolean("was_delivered").default(false),
	wasOpened: boolean("was_opened").default(false),
	wasClicked: boolean("was_clicked").default(false),
	wasReplied: boolean("was_replied").default(false),
	replyTime: integer("reply_time"),
	replySentiment: varchar("reply_sentiment"),
	ledToPayment: boolean("led_to_payment").default(false),
	paymentAmount: numeric("payment_amount", { precision: 10, scale:  2 }),
	paymentDelay: integer("payment_delay"),
	partialPayment: boolean("partial_payment").default(false),
	effectivenessScore: numeric("effectiveness_score", { precision: 3, scale:  2 }),
	testVariant: varchar("test_variant"),
	testId: varchar("test_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.actionId],
			foreignColumns: [actions.id],
			name: "action_effectiveness_action_id_actions_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "action_effectiveness_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "action_effectiveness_contact_id_contacts_id_fk"
		}),
]);

export const inboundMessages = pgTable("inbound_messages", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id"),
	invoiceId: varchar("invoice_id"),
	channel: varchar().notNull(),
	from: varchar().notNull(),
	to: varchar(),
	subject: varchar(),
	content: text().notNull(),
	rawPayload: jsonb("raw_payload"),
	intentAnalyzed: boolean("intent_analyzed").default(false),
	intentType: varchar("intent_type"),
	intentConfidence: numeric("intent_confidence", { precision: 3, scale:  2 }),
	sentiment: varchar(),
	extractedEntities: jsonb("extracted_entities"),
	actionCreated: boolean("action_created").default(false),
	actionId: varchar("action_id"),
	providerMessageId: varchar("provider_message_id"),
	providerStatus: varchar("provider_status"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_inbound_analyzed").using("btree", table.intentAnalyzed.asc().nullsLast().op("bool_ops")),
	index("idx_inbound_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_inbound_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "inbound_messages_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "inbound_messages_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "inbound_messages_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.actionId],
			foreignColumns: [actions.id],
			name: "inbound_messages_action_id_actions_id_fk"
		}),
]);

export const contactOutcomes = pgTable("contact_outcomes", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id"),
	invoiceId: varchar("invoice_id"),
	actionId: varchar("action_id"),
	idempotencyKey: varchar("idempotency_key").notNull(),
	eventType: varchar("event_type").notNull(),
	channel: varchar(),
	outcome: varchar(),
	payload: jsonb().notNull(),
	providerMessageId: varchar("provider_message_id"),
	providerStatus: varchar("provider_status"),
	eventTimestamp: timestamp("event_timestamp", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_contact_outcomes_action").using("btree", table.actionId.asc().nullsLast().op("text_ops")),
	index("idx_contact_outcomes_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_contact_outcomes_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_contact_outcomes_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_contact_outcomes_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("idx_contact_outcomes_timestamp").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.eventTimestamp.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "contact_outcomes_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "contact_outcomes_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "contact_outcomes_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.actionId],
			foreignColumns: [actions.id],
			name: "contact_outcomes_action_id_actions_id_fk"
		}),
	unique("contact_outcomes_idempotency_key_unique").on(table.idempotencyKey),
]);

export const policyDecisions = pgTable("policy_decisions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id"),
	invoiceId: varchar("invoice_id"),
	actionId: varchar("action_id"),
	policyVersion: varchar("policy_version").notNull(),
	experimentVariant: varchar("experiment_variant"),
	decisionType: varchar("decision_type").notNull(),
	channel: varchar(),
	score: numeric({ precision: 5, scale:  2 }),
	factor1: varchar("factor_1"),
	factor2: varchar("factor_2"),
	factor3: varchar("factor_3"),
	scoreBreakdown: jsonb("score_breakdown"),
	guardStatus: varchar("guard_status"),
	guardReason: varchar("guard_reason"),
	decisionContext: jsonb("decision_context"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_policy_decisions_action").using("btree", table.actionId.asc().nullsLast().op("text_ops")),
	index("idx_policy_decisions_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_policy_decisions_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_policy_decisions_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("idx_policy_decisions_timestamp").using("btree", table.tenantId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	index("idx_policy_decisions_variant").using("btree", table.experimentVariant.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "policy_decisions_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "policy_decisions_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "policy_decisions_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.actionId],
			foreignColumns: [actions.id],
			name: "policy_decisions_action_id_actions_id_fk"
		}),
]);

export const invoiceHealthScores = pgTable("invoice_health_scores", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	overallRiskScore: integer("overall_risk_score").notNull(),
	paymentProbability: numeric("payment_probability", { precision: 5, scale:  2 }).notNull(),
	timeRiskScore: integer("time_risk_score").notNull(),
	amountRiskScore: integer("amount_risk_score").notNull(),
	customerRiskScore: integer("customer_risk_score").notNull(),
	communicationRiskScore: integer("communication_risk_score").notNull(),
	healthStatus: varchar("health_status").notNull(),
	healthScore: integer("health_score").notNull(),
	predictedPaymentDate: timestamp("predicted_payment_date", { mode: 'string' }),
	collectionDifficulty: varchar("collection_difficulty").notNull(),
	recommendedActions: jsonb("recommended_actions"),
	aiConfidence: numeric("ai_confidence", { precision: 5, scale:  2 }).notNull(),
	modelVersion: varchar("model_version").default('1.0').notNull(),
	lastAnalysis: timestamp("last_analysis", { mode: 'string' }).notNull(),
	trends: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "invoice_health_scores_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "invoice_health_scores_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "invoice_health_scores_contact_id_contacts_id_fk"
		}),
]);

export const bankTransactions = pgTable("bank_transactions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	bankAccountId: varchar("bank_account_id").notNull(),
	xeroTransactionId: varchar("xero_transaction_id"),
	sageTransactionId: varchar("sage_transaction_id"),
	quickBooksTransactionId: varchar("quick_books_transaction_id"),
	transactionDate: timestamp("transaction_date", { mode: 'string' }).notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	type: varchar().notNull(),
	description: text(),
	reference: varchar(),
	category: varchar(),
	contactId: varchar("contact_id"),
	invoiceId: varchar("invoice_id"),
	billId: varchar("bill_id"),
	isReconciled: boolean("is_reconciled").default(false),
	reconciledAt: timestamp("reconciled_at", { mode: 'string' }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "bank_transactions_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.bankAccountId],
			foreignColumns: [bankAccounts.id],
			name: "bank_transactions_bank_account_id_bank_accounts_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "bank_transactions_contact_id_contacts_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "bank_transactions_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.billId],
			foreignColumns: [bills.id],
			name: "bank_transactions_bill_id_bills_id_fk"
		}),
]);

export const walletTransactions = pgTable("wallet_transactions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	transactionDate: timestamp("transaction_date", { mode: 'string' }).defaultNow().notNull(),
	transactionType: varchar("transaction_type").notNull(),
	source: varchar().notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	currency: varchar().default('GBP'),
	runningBalance: numeric("running_balance", { precision: 12, scale:  2 }),
	description: text().notNull(),
	reference: varchar(),
	invoiceId: varchar("invoice_id"),
	contactId: varchar("contact_id"),
	insuranceProvider: varchar("insurance_provider"),
	insurancePolicyId: varchar("insurance_policy_id"),
	financeProvider: varchar("finance_provider"),
	financeAdvanceId: varchar("finance_advance_id"),
	status: varchar().default('completed').notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_wallet_transactions_contact").using("btree", table.contactId.asc().nullsLast().op("text_ops")),
	index("idx_wallet_transactions_date").using("btree", table.transactionDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_wallet_transactions_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_wallet_transactions_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
	index("idx_wallet_transactions_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("idx_wallet_transactions_type").using("btree", table.transactionType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "wallet_transactions_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "wallet_transactions_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "wallet_transactions_contact_id_contacts_id_fk"
		}),
]);

export const financeAdvances = pgTable("finance_advances", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	invoiceAmount: numeric("invoice_amount", { precision: 10, scale:  2 }).notNull(),
	advanceAmount: numeric("advance_amount", { precision: 10, scale:  2 }).notNull(),
	advancePercentage: numeric("advance_percentage", { precision: 5, scale:  2 }).notNull(),
	feeAmount: numeric("fee_amount", { precision: 10, scale:  2 }).notNull(),
	feePercentage: numeric("fee_percentage", { precision: 5, scale:  2 }).notNull(),
	totalRepayment: numeric("total_repayment", { precision: 10, scale:  2 }).notNull(),
	termDays: integer("term_days").default(60).notNull(),
	advanceDate: timestamp("advance_date", { mode: 'string' }).defaultNow().notNull(),
	repaymentDueDate: timestamp("repayment_due_date", { mode: 'string' }).notNull(),
	actualRepaymentDate: timestamp("actual_repayment_date", { mode: 'string' }),
	status: varchar().default('pending').notNull(),
	provider: varchar().default('qashivo'),
	walletTransactionId: varchar("wallet_transaction_id"),
	notes: text(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_finance_advances_due_date").using("btree", table.repaymentDueDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_finance_advances_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_finance_advances_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_finance_advances_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "finance_advances_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "finance_advances_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "finance_advances_contact_id_contacts_id_fk"
		}),
]);

export const debtorPayments = pgTable("debtor_payments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	currency: varchar().default('GBP'),
	provider: varchar().default('stripe').notNull(),
	providerSessionId: varchar("provider_session_id"),
	providerPaymentId: varchar("provider_payment_id"),
	checkoutUrl: text("checkout_url"),
	status: varchar().default('initiated').notNull(),
	failureReason: text("failure_reason"),
	initiatedAt: timestamp("initiated_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	idempotencyKey: varchar("idempotency_key"),
	webhookPayload: jsonb("webhook_payload"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_debtor_payments_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_debtor_payments_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "debtor_payments_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "debtor_payments_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "debtor_payments_contact_id_contacts_id_fk"
		}),
	unique("debtor_payments_idempotency_key_unique").on(table.idempotencyKey),
]);

export const interestLedger = pgTable("interest_ledger", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	tenantId: varchar("tenant_id").notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }),
	principal: numeric({ precision: 10, scale:  2 }).notNull(),
	rateAnnual: numeric("rate_annual", { precision: 5, scale:  2 }).notNull(),
	accruedAmount: numeric("accrued_amount", { precision: 10, scale:  2 }).default('0'),
	isPaused: boolean("is_paused").default(false),
	pausedReason: varchar("paused_reason"),
	pausedAt: timestamp("paused_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_interest_ledger_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_interest_ledger_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "interest_ledger_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "interest_ledger_tenant_id_tenants_id_fk"
		}),
]);

export const promisesToPay = pgTable("promises_to_pay", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	promisedDate: timestamp("promised_date", { mode: 'string' }).notNull(),
	paymentMethod: varchar("payment_method").notNull(),
	contactName: varchar("contact_name").notNull(),
	contactEmail: varchar("contact_email"),
	contactPhone: varchar("contact_phone"),
	status: varchar().default('active').notNull(),
	fulfilledAt: timestamp("fulfilled_at", { mode: 'string' }),
	fulfilledAmount: numeric("fulfilled_amount", { precision: 10, scale:  2 }),
	breachedAt: timestamp("breached_at", { mode: 'string' }),
	notes: text(),
	createdVia: varchar("created_via").default('debtor_portal'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ptp_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_ptp_promised_date").using("btree", table.promisedDate.asc().nullsLast().op("timestamp_ops")),
	index("idx_ptp_tenant_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "promises_to_pay_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "promises_to_pay_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "promises_to_pay_contact_id_contacts_id_fk"
		}),
]);

export const workflowTimers = pgTable("workflow_timers", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	invoiceId: varchar("invoice_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	timerType: varchar("timer_type").notNull(),
	triggerAt: timestamp("trigger_at", { mode: 'string' }).notNull(),
	status: varchar().default('pending').notNull(),
	processedAt: timestamp("processed_at", { mode: 'string' }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_workflow_timers_invoice").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("idx_workflow_timers_tenant").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("idx_workflow_timers_trigger").using("btree", table.tenantId.asc().nullsLast().op("timestamp_ops"), table.triggerAt.asc().nullsLast().op("timestamp_ops"), table.status.asc().nullsLast().op("timestamp_ops")),
	index("idx_workflow_timers_type").using("btree", table.timerType.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "workflow_timers_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "workflow_timers_invoice_id_invoices_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "workflow_timers_contact_id_contacts_id_fk"
		}),
]);

export const partnerWaitlist = pgTable("partner_waitlist", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	fullName: text("full_name").notNull(),
	email: text().notNull(),
	firmName: text("firm_name").notNull(),
	mobile: text().notNull(),
	q1: text().notNull(),
	q2: text().notNull(),
	q3: text().notNull(),
	q4: text().notNull(),
	q5: text().notNull(),
	otherText: text("other_text"),
	sourcePath: text("source_path").default('/founding-partners').notNull(),
});

export const debtorProfiles = pgTable("debtor_profiles", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	score0To100: integer("score_0_to_100"),
	scoreBand: varchar("score_band"),
	dataCoverageDays: integer("data_coverage_days"),
	paidInvoiceMonthsCovered: integer("paid_invoice_months_covered"),
	paidInvoiceCount: integer("paid_invoice_count"),
	avgDaysLate: numeric("avg_days_late", { precision: 8, scale:  2 }),
	onTimeRate: numeric("on_time_rate", { precision: 5, scale:  4 }),
	late30PlusRate: numeric("late_30_plus_rate", { precision: 5, scale:  4 }),
	volatility: numeric({ precision: 8, scale:  4 }),
	lastComputedAt: timestamp("last_computed_at", { mode: 'string' }),
	scoreFactorsJson: jsonb("score_factors_json"),
	strategyJson: jsonb("strategy_json"),
	strategyReason: text("strategy_reason"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("debtor_profiles_score_idx").using("btree", table.score0To100.asc().nullsLast().op("int4_ops")),
	index("debtor_profiles_tenant_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "debtor_profiles_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "debtor_profiles_contact_id_contacts_id_fk"
		}).onDelete("cascade"),
	unique("debtor_profiles_tenant_contact").on(table.tenantId, table.contactId),
]);

export const scheduledReports = pgTable("scheduled_reports", {
	id: varchar().primaryKey().notNull(),
	tenantId: varchar("tenant_id").notNull(),
	createdBy: varchar("created_by").notNull(),
	reportType: varchar("report_type").notNull(),
	name: varchar().notNull(),
	frequency: varchar().notNull(),
	dayOfWeek: integer("day_of_week"),
	dayOfMonth: integer("day_of_month"),
	sendTime: varchar("send_time").default('08:00').notNull(),
	timezone: varchar().default('Europe/London').notNull(),
	recipients: text().array().notNull(),
	enabled: boolean().default(true).notNull(),
	lastSentAt: timestamp("last_sent_at", { mode: 'string' }),
	nextRunAt: timestamp("next_run_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "scheduled_reports_tenant_id_tenants_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "scheduled_reports_created_by_users_id_fk"
		}),
]);
