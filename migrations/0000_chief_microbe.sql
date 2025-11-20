CREATE TABLE "action_effectiveness" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"was_delivered" boolean DEFAULT false,
	"was_opened" boolean DEFAULT false,
	"was_clicked" boolean DEFAULT false,
	"was_replied" boolean DEFAULT false,
	"reply_time" integer,
	"reply_sentiment" varchar,
	"led_to_payment" boolean DEFAULT false,
	"payment_amount" numeric(10, 2),
	"payment_delay" integer,
	"partial_payment" boolean DEFAULT false,
	"effectiveness_score" numeric(3, 2),
	"test_variant" varchar,
	"test_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "action_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"invoice_id" varchar,
	"type" varchar NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"due_at" timestamp NOT NULL,
	"assigned_to_user_id" varchar,
	"created_by_user_id" varchar NOT NULL,
	"notes" text,
	"outcome" text,
	"last_communication_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "action_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"action_item_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"details" jsonb,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"invoice_id" varchar,
	"contact_id" varchar,
	"user_id" varchar,
	"type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"subject" varchar,
	"content" text,
	"scheduled_for" timestamp,
	"completed_at" timestamp,
	"metadata" jsonb,
	"approved_by" varchar,
	"approved_at" timestamp,
	"confidence_score" numeric(3, 2),
	"exception_reason" varchar,
	"workflow_step_id" varchar,
	"ai_generated" boolean DEFAULT false,
	"source" varchar DEFAULT 'automated',
	"intent_type" varchar,
	"intent_confidence" numeric(3, 2),
	"sentiment" varchar,
	"has_response" boolean DEFAULT false,
	"experiment_variant" varchar,
	"invoice_ids" text[],
	"recommended_at" timestamp,
	"recommended_by" varchar,
	"recommended" jsonb,
	"override" jsonb,
	"assigned_to" varchar,
	"assigned_at" timestamp,
	"first_seen_at" timestamp DEFAULT now(),
	"feedback" varchar,
	"feedback_note" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"activity_type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"entity_type" varchar,
	"entity_id" varchar,
	"action" varchar NOT NULL,
	"description" text NOT NULL,
	"result" varchar NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"error_message" text,
	"error_code" varchar,
	"duration" integer,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_agent_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"personality" varchar DEFAULT 'professional',
	"instructions" text NOT NULL,
	"escalation_triggers" jsonb,
	"response_templates" jsonb,
	"is_active" boolean DEFAULT true,
	"model_settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_facts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"tags" jsonb,
	"priority" integer DEFAULT 5,
	"is_active" boolean DEFAULT true,
	"last_verified" timestamp DEFAULT now(),
	"source" varchar,
	"applicable_regions" jsonb,
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ard_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"calculation_date" timestamp NOT NULL,
	"average_receivable_days" numeric(6, 2) NOT NULL,
	"sample_size" integer NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"window_days" integer DEFAULT 90,
	"outliers_excluded" integer DEFAULT 0,
	"ard_by_customer" jsonb,
	"ard_by_industry" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"xero_account_id" varchar,
	"sage_account_id" varchar,
	"quick_books_account_id" varchar,
	"name" varchar NOT NULL,
	"account_number" varchar,
	"account_type" varchar NOT NULL,
	"currency" varchar DEFAULT 'USD',
	"current_balance" numeric(12, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"bank_name" varchar,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"bank_account_id" varchar NOT NULL,
	"xero_transaction_id" varchar,
	"sage_transaction_id" varchar,
	"quick_books_transaction_id" varchar,
	"transaction_date" timestamp NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"type" varchar NOT NULL,
	"description" text,
	"reference" varchar,
	"category" varchar,
	"contact_id" varchar,
	"invoice_id" varchar,
	"bill_id" varchar,
	"is_reconciled" boolean DEFAULT false,
	"reconciled_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bill_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"bill_id" varchar NOT NULL,
	"bank_account_id" varchar,
	"xero_payment_id" varchar,
	"sage_payment_id" varchar,
	"quick_books_payment_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"payment_date" timestamp NOT NULL,
	"payment_method" varchar NOT NULL,
	"reference" varchar,
	"currency" varchar DEFAULT 'USD',
	"exchange_rate" numeric(10, 6) DEFAULT '1',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"xero_invoice_id" varchar,
	"sage_invoice_id" varchar,
	"quick_books_invoice_id" varchar,
	"bill_number" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"status" varchar DEFAULT 'pending' NOT NULL,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"description" text,
	"currency" varchar DEFAULT 'USD',
	"reference" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budget_lines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"subcategory" varchar,
	"description" text,
	"budgeted_amount" numeric(10, 2) NOT NULL,
	"actual_amount" numeric(10, 2) DEFAULT '0',
	"variance" numeric(10, 2) DEFAULT '0',
	"variance_percentage" numeric(5, 2) DEFAULT '0',
	"period" varchar,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"budget_type" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"currency" varchar DEFAULT 'USD',
	"status" varchar DEFAULT 'draft' NOT NULL,
	"total_budget_amount" numeric(12, 2) DEFAULT '0',
	"total_actual_amount" numeric(12, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cached_xero_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"xero_invoice_id" varchar NOT NULL,
	"invoice_number" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"status" varchar NOT NULL,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"description" text,
	"currency" varchar DEFAULT 'USD',
	"contact" jsonb,
	"payment_details" jsonb,
	"metadata" jsonb,
	"synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "channel_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"channel" varchar NOT NULL,
	"stage" integer,
	"template_id" varchar,
	"date" timestamp NOT NULL,
	"sent_count" integer DEFAULT 0,
	"delivered_count" integer DEFAULT 0,
	"opened_count" integer DEFAULT 0,
	"responded_count" integer DEFAULT 0,
	"paid_count" integer DEFAULT 0,
	"total_amount" numeric(10, 2) DEFAULT '0',
	"cost_per_communication" numeric(6, 4) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "collection_ab_tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"test_name" varchar NOT NULL,
	"test_type" varchar NOT NULL,
	"description" text,
	"variant_a" jsonb,
	"variant_b" jsonb,
	"target_segment" jsonb,
	"is_active" boolean DEFAULT true,
	"start_date" timestamp DEFAULT now(),
	"end_date" timestamp,
	"variant_a_count" integer DEFAULT 0,
	"variant_b_count" integer DEFAULT 0,
	"variant_a_success_rate" numeric(5, 2),
	"variant_b_success_rate" numeric(5, 2),
	"winner" varchar,
	"confidence_level" numeric(3, 2),
	"significance_reached" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "collection_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"workflow" varchar DEFAULT 'monthly_statement' NOT NULL,
	"schedule_steps" jsonb NOT NULL,
	"success_rate" numeric(5, 2),
	"average_days_to_payment" numeric(5, 1),
	"total_customers_assigned" integer DEFAULT 0,
	"sending_settings" jsonb,
	"scheduler_type" varchar DEFAULT 'static',
	"adaptive_settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "communication_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"stage" integer,
	"subject" varchar,
	"content" text NOT NULL,
	"variables" jsonb,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"success_rate" numeric(5, 2),
	"usage_count" integer DEFAULT 0,
	"send_timing" jsonb,
	"ai_generated" boolean DEFAULT false,
	"optimization_score" numeric(5, 2),
	"tone_of_voice" varchar DEFAULT 'professional',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_outcomes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar,
	"invoice_id" varchar,
	"action_id" varchar,
	"idempotency_key" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"channel" varchar,
	"outcome" varchar,
	"payload" jsonb NOT NULL,
	"provider_message_id" varchar,
	"provider_status" varchar,
	"event_timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "contact_outcomes_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"xero_contact_id" varchar,
	"sage_contact_id" varchar,
	"quick_books_contact_id" varchar,
	"name" varchar NOT NULL,
	"email" varchar,
	"phone" varchar,
	"company_name" varchar,
	"address" text,
	"role" varchar DEFAULT 'customer' NOT NULL,
	"is_active" boolean DEFAULT true,
	"payment_terms" integer DEFAULT 30,
	"credit_limit" numeric(10, 2),
	"preferred_contact_method" varchar DEFAULT 'email',
	"tax_number" varchar,
	"account_number" varchar,
	"notes" text,
	"risk_score" integer,
	"risk_band" varchar(1),
	"credit_assessment" jsonb,
	"ar_contact_name" varchar,
	"ar_contact_email" varchar,
	"ar_contact_phone" varchar,
	"ar_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_behavior_signals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"median_days_to_pay" numeric(8, 2),
	"p75_days_to_pay" numeric(8, 2),
	"volatility" numeric(8, 4),
	"trend" numeric(8, 4),
	"email_open_rate" numeric(3, 2),
	"email_click_rate" numeric(3, 2),
	"email_reply_rate" numeric(3, 2),
	"sms_reply_rate" numeric(3, 2),
	"call_answer_rate" numeric(3, 2),
	"whatsapp_reply_rate" numeric(3, 2),
	"amount_sensitivity" jsonb,
	"weekday_effect" jsonb,
	"month_effect" jsonb,
	"dispute_count" integer DEFAULT 0,
	"partial_payment_count" integer DEFAULT 0,
	"promise_breach_count" integer DEFAULT 0,
	"segment" varchar,
	"segment_priors" jsonb,
	"invoice_count" integer DEFAULT 0,
	"last_payment_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "behavior_contact_unique" UNIQUE("contact_id")
);
--> statement-breakpoint
CREATE TABLE "customer_learning_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"email_effectiveness" numeric(3, 2) DEFAULT '0.5',
	"sms_effectiveness" numeric(3, 2) DEFAULT '0.5',
	"voice_effectiveness" numeric(3, 2) DEFAULT '0.5',
	"total_interactions" integer DEFAULT 0,
	"successful_actions" integer DEFAULT 0,
	"average_response_time" integer,
	"preferred_channel" varchar,
	"preferred_contact_time" varchar,
	"average_payment_delay" integer,
	"payment_reliability" numeric(3, 2) DEFAULT '0.5',
	"learning_confidence" numeric(3, 2) DEFAULT '0.1',
	"total_promises_made" integer DEFAULT 0,
	"promises_kept" integer DEFAULT 0,
	"promises_broken" integer DEFAULT 0,
	"promises_partially_kept" integer DEFAULT 0,
	"promise_reliability_score" numeric(5, 2),
	"prs_last_30_days" numeric(5, 2),
	"prs_last_90_days" numeric(5, 2),
	"prs_last_12_months" numeric(5, 2),
	"is_serial_promiser" boolean DEFAULT false,
	"is_reliable_late_payer" boolean DEFAULT false,
	"is_relationship_deteriorating" boolean DEFAULT false,
	"is_new_customer" boolean DEFAULT true,
	"has_active_dispute" boolean DEFAULT false,
	"average_days_late" numeric(8, 2),
	"preferred_payment_day" integer,
	"responsiveness" varchar,
	"sentiment_trend" varchar,
	"last_positive_interaction" timestamp,
	"last_negative_interaction" timestamp,
	"consecutive_negative_interactions" integer DEFAULT 0,
	"total_inbound_messages" integer DEFAULT 0,
	"total_outbound_messages" integer DEFAULT 0,
	"last_engagement_date" timestamp,
	"engagement_score" numeric(5, 2),
	"last_updated" timestamp DEFAULT now(),
	"last_calculated_at" timestamp DEFAULT now(),
	"calculation_version" varchar DEFAULT '1.0',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "customer_learning_profiles_tenant_contact" UNIQUE("tenant_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "customer_schedule_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"schedule_id" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"custom_settings" jsonb,
	"assigned_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_segment_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"segment_id" varchar NOT NULL,
	"assignment_confidence" numeric(5, 4),
	"distance_from_center" numeric(10, 6),
	"previous_segment_id" varchar,
	"assignment_date" timestamp DEFAULT now(),
	"model_version" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "segment_assignments_tenant_contact" UNIQUE("tenant_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "customer_segments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"segment_name" varchar NOT NULL,
	"segment_type" varchar NOT NULL,
	"description" text,
	"segment_criteria" jsonb,
	"typical_behavior" jsonb,
	"average_payment_time" integer,
	"payment_success_rate" numeric(5, 4),
	"preferred_channel" varchar,
	"response_rate" numeric(5, 4),
	"member_count" integer DEFAULT 0,
	"percent_of_customers" numeric(5, 2),
	"cluster_center" jsonb,
	"cluster_variance" numeric(10, 6),
	"model_version" varchar NOT NULL,
	"last_recalculated" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "debtor_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'GBP',
	"provider" varchar DEFAULT 'stripe' NOT NULL,
	"provider_session_id" varchar,
	"provider_payment_id" varchar,
	"checkout_url" text,
	"status" varchar DEFAULT 'initiated' NOT NULL,
	"failure_reason" text,
	"initiated_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"idempotency_key" varchar,
	"webhook_payload" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "debtor_payments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "dispute_evidence" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"filename" varchar NOT NULL,
	"original_filename" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"storage_url" text NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"uploaded_by_user_id" varchar,
	"notes" text,
	"checksum" varchar,
	"virus_scan_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"summary" text NOT NULL,
	"buyer_contact_name" varchar NOT NULL,
	"buyer_contact_email" varchar,
	"buyer_contact_phone" varchar,
	"response_due_at" timestamp NOT NULL,
	"responded_at" timestamp,
	"responded_by_user_id" varchar,
	"resolution" text,
	"resolution_type" varchar,
	"credit_note_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_senders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"signature" text,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"reply_to_email" varchar,
	"from_name" varchar NOT NULL,
	"department" varchar DEFAULT 'Accounts Receivable',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "escalation_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"rules" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" varchar NOT NULL,
	"to_currency" varchar NOT NULL,
	"rate" numeric(10, 6) NOT NULL,
	"rate_date" timestamp NOT NULL,
	"provider" varchar DEFAULT 'system' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "finance_advances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"invoice_amount" numeric(10, 2) NOT NULL,
	"advance_amount" numeric(10, 2) NOT NULL,
	"advance_percentage" numeric(5, 2) NOT NULL,
	"fee_amount" numeric(10, 2) NOT NULL,
	"fee_percentage" numeric(5, 2) NOT NULL,
	"total_repayment" numeric(10, 2) NOT NULL,
	"term_days" integer DEFAULT 60 NOT NULL,
	"advance_date" timestamp DEFAULT now() NOT NULL,
	"repayment_due_date" timestamp NOT NULL,
	"actual_repayment_date" timestamp,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"provider" varchar DEFAULT 'qashivo',
	"wallet_transaction_id" varchar,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forecast_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"forecast_horizon_weeks" integer DEFAULT 13,
	"forecast_mode" varchar NOT NULL,
	"scenario_type" varchar NOT NULL,
	"forecast_data" jsonb NOT NULL,
	"ard_at_snapshot" numeric(6, 2),
	"irregular_buffer_beta" numeric(3, 2) DEFAULT '0.5',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forecast_variance_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"snapshot_id" varchar,
	"comparison_date" timestamp NOT NULL,
	"forecasted_amount" numeric(12, 2) NOT NULL,
	"actual_amount" numeric(12, 2) NOT NULL,
	"variance" numeric(12, 2) NOT NULL,
	"variance_percentage" numeric(6, 2),
	"category" varchar NOT NULL,
	"mae" numeric(12, 2),
	"rmse" numeric(12, 2),
	"adjustments_made" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "global_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"channel" varchar NOT NULL,
	"tone" varchar NOT NULL,
	"locale" varchar DEFAULT 'en-GB' NOT NULL,
	"version" varchar DEFAULT '1.0.0' NOT NULL,
	"subject" varchar,
	"body" text NOT NULL,
	"required_vars" text[] DEFAULT '{}' NOT NULL,
	"compliance_flags" text[] DEFAULT '{}',
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "global_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "health_analytics_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"snapshot_type" varchar NOT NULL,
	"total_invoices_analyzed" integer NOT NULL,
	"average_health_score" numeric(5, 2) NOT NULL,
	"average_risk_score" numeric(5, 2) NOT NULL,
	"healthy_count" integer NOT NULL,
	"at_risk_count" integer NOT NULL,
	"critical_count" integer NOT NULL,
	"emergency_count" integer NOT NULL,
	"easy_collection_count" integer NOT NULL,
	"moderate_collection_count" integer NOT NULL,
	"difficult_collection_count" integer NOT NULL,
	"very_difficult_collection_count" integer NOT NULL,
	"total_value_at_risk" numeric(12, 2) NOT NULL,
	"predicted_collection_rate" numeric(5, 2) NOT NULL,
	"average_predicted_days_to_payment" numeric(5, 2),
	"model_accuracy" numeric(5, 2),
	"prediction_confidence" numeric(5, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar,
	"invoice_id" varchar,
	"channel" varchar NOT NULL,
	"from" varchar NOT NULL,
	"to" varchar,
	"subject" varchar,
	"content" text NOT NULL,
	"raw_payload" jsonb,
	"intent_analyzed" boolean DEFAULT false,
	"intent_type" varchar,
	"intent_confidence" numeric(3, 2),
	"sentiment" varchar,
	"extracted_entities" jsonb,
	"action_created" boolean DEFAULT false,
	"action_id" varchar,
	"provider_message_id" varchar,
	"provider_status" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interest_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"principal" numeric(10, 2) NOT NULL,
	"rate_annual" numeric(5, 2) NOT NULL,
	"accrued_amount" numeric(10, 2) DEFAULT '0',
	"is_paused" boolean DEFAULT false,
	"paused_reason" varchar,
	"paused_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investment_call_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"phone" varchar NOT NULL,
	"email" varchar NOT NULL,
	"is_high_net_worth" boolean DEFAULT false NOT NULL,
	"acknowledges_risk" boolean DEFAULT false NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now(),
	"contacted_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investor_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"voice_name" varchar,
	"sms_name" varchar,
	"voice_demo_completed" boolean DEFAULT false,
	"sms_demo_completed" boolean DEFAULT false,
	"voice_demo_results" jsonb,
	"sms_demo_results" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoice_health_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"overall_risk_score" integer NOT NULL,
	"payment_probability" numeric(5, 2) NOT NULL,
	"time_risk_score" integer NOT NULL,
	"amount_risk_score" integer NOT NULL,
	"customer_risk_score" integer NOT NULL,
	"communication_risk_score" integer NOT NULL,
	"health_status" varchar NOT NULL,
	"health_score" integer NOT NULL,
	"predicted_payment_date" timestamp,
	"collection_difficulty" varchar NOT NULL,
	"recommended_actions" jsonb,
	"ai_confidence" numeric(5, 2) NOT NULL,
	"model_version" varchar DEFAULT '1.0' NOT NULL,
	"last_analysis" timestamp NOT NULL,
	"trends" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"xero_invoice_id" varchar,
	"invoice_number" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0',
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"status" varchar DEFAULT 'pending' NOT NULL,
	"collection_stage" varchar DEFAULT 'initial',
	"stage" varchar DEFAULT 'overdue',
	"payment_plan_id" varchar,
	"is_on_hold" boolean DEFAULT false,
	"escalation_flag" boolean DEFAULT false,
	"legal_flag" boolean DEFAULT false,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"description" text,
	"currency" varchar DEFAULT 'USD',
	"workflow_id" varchar,
	"last_reminder_sent" timestamp,
	"reminder_count" integer DEFAULT 0,
	"next_action" varchar,
	"next_action_date" timestamp,
	"balance" numeric(10, 2),
	"base_rate_annual" numeric(5, 2),
	"statutory_uplift_pct" numeric(5, 2),
	"workflow_state" varchar DEFAULT 'pre_due',
	"pause_state" varchar,
	"paused_at" timestamp,
	"paused_until" timestamp,
	"pause_reason" text,
	"pause_metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar NOT NULL,
	"company" varchar,
	"status" varchar DEFAULT 'new' NOT NULL,
	"source" varchar DEFAULT 'demo' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"purpose" varchar DEFAULT 'invoice_access' NOT NULL,
	"invoice_ids" text[],
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"is_revoked" boolean DEFAULT false,
	"otp_code" varchar,
	"otp_expires_at" timestamp,
	"otp_verified_at" timestamp,
	"otp_attempts" integer DEFAULT 0,
	"session_id" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "magic_link_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "ml_model_performance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"model_name" varchar NOT NULL,
	"model_version" varchar NOT NULL,
	"model_type" varchar NOT NULL,
	"accuracy" numeric(5, 4),
	"precision" numeric(5, 4),
	"recall" numeric(5, 4),
	"f1_score" numeric(5, 4),
	"auc" numeric(5, 4),
	"business_impact" jsonb,
	"prediction_count" integer,
	"correct_predictions" integer,
	"training_data_size" integer,
	"test_data_size" integer,
	"features" jsonb,
	"hyperparameters" jsonb,
	"deployment_date" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"evaluation_period_start" timestamp,
	"evaluation_period_end" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"current_phase" varchar DEFAULT 'technical_connection' NOT NULL,
	"completed_phases" jsonb DEFAULT '[]',
	"phase_data" jsonb DEFAULT '{}',
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "onboarding_progress_tenant" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "onboarding_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"industry" varchar NOT NULL,
	"business_type" varchar NOT NULL,
	"template_type" varchar NOT NULL,
	"template_data" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_client_relationships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_user_id" varchar NOT NULL,
	"partner_tenant_id" varchar NOT NULL,
	"client_tenant_id" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"access_level" varchar DEFAULT 'full' NOT NULL,
	"permissions" jsonb DEFAULT '[]',
	"established_at" timestamp DEFAULT now(),
	"established_by" varchar NOT NULL,
	"last_accessed_at" timestamp,
	"terminated_at" timestamp,
	"terminated_by" varchar,
	"termination_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_partner_client" UNIQUE("partner_user_id","client_tenant_id")
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"website" varchar,
	"address_line1" varchar,
	"address_line2" varchar,
	"city" varchar,
	"state" varchar,
	"postal_code" varchar,
	"country" varchar DEFAULT 'GB',
	"logo_url" varchar,
	"brand_color" varchar DEFAULT '#17B6C3',
	"subscription_plan_id" varchar,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"subscription_status" varchar DEFAULT 'active',
	"current_client_count" integer DEFAULT 0,
	"max_client_count" integer DEFAULT 10,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pattern_library" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar,
	"entity_name" varchar NOT NULL,
	"pattern_type" varchar NOT NULL,
	"avg_interval_days" numeric(6, 2) NOT NULL,
	"variance_days" numeric(6, 2) NOT NULL,
	"robust_amount" numeric(12, 2) NOT NULL,
	"volatility_class" varchar NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"occurrence_count" integer NOT NULL,
	"first_occurrence" timestamp NOT NULL,
	"last_occurrence" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_plan_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_plan_id" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"added_at" timestamp DEFAULT now(),
	"added_by_user_id" varchar NOT NULL,
	CONSTRAINT "unique_payment_plan_invoice" UNIQUE("payment_plan_id","invoice_id")
);
--> statement-breakpoint
CREATE TABLE "payment_plan_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_plan_id" varchar NOT NULL,
	"payment_number" integer NOT NULL,
	"due_date" timestamp NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"payment_date" timestamp,
	"payment_reference" varchar,
	"payment_method" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_payment_plan_payment_number" UNIQUE("payment_plan_id","payment_number")
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"initial_payment_amount" numeric(10, 2) DEFAULT '0',
	"plan_start_date" timestamp NOT NULL,
	"initial_payment_date" timestamp,
	"payment_frequency" varchar NOT NULL,
	"number_of_payments" integer NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"current_payment_number" integer DEFAULT 0,
	"total_paid_amount" numeric(10, 2) DEFAULT '0',
	"notes" text,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_predictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"payment_probability" numeric(5, 4),
	"predicted_payment_date" timestamp,
	"payment_confidence_score" numeric(5, 4),
	"default_risk" numeric(5, 4),
	"escalation_risk" numeric(5, 4),
	"model_version" varchar NOT NULL,
	"prediction_date" timestamp DEFAULT now(),
	"features" jsonb,
	"actual_payment_date" timestamp,
	"actual_outcome" varchar,
	"prediction_accuracy" numeric(5, 4),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_promises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"promise_type" varchar DEFAULT 'payment_date' NOT NULL,
	"promised_amount" numeric(10, 2),
	"promised_date" timestamp NOT NULL,
	"source_type" varchar NOT NULL,
	"source_id" varchar,
	"channel" varchar,
	"status" varchar DEFAULT 'open' NOT NULL,
	"actual_payment_date" timestamp,
	"actual_payment_amount" numeric(10, 2),
	"days_late" integer,
	"is_serial_promise" boolean DEFAULT false,
	"previous_promise_id" varchar,
	"promise_sequence" integer DEFAULT 1,
	"notes" text,
	"metadata" jsonb,
	"created_by_user_id" varchar NOT NULL,
	"evaluated_at" timestamp,
	"evaluated_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permission_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"changed_by" varchar NOT NULL,
	"action" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar,
	"old_value" varchar,
	"new_value" varchar,
	"reason" text,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"description" text NOT NULL,
	"resource_type" varchar,
	"action" varchar NOT NULL,
	"is_system_permission" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "policy_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar,
	"invoice_id" varchar,
	"action_id" varchar,
	"policy_version" varchar NOT NULL,
	"experiment_variant" varchar,
	"decision_type" varchar NOT NULL,
	"channel" varchar,
	"score" numeric(5, 2),
	"factor_1" varchar,
	"factor_2" varchar,
	"factor_3" varchar,
	"score_breakdown" jsonb,
	"guard_status" varchar,
	"guard_reason" varchar,
	"decision_context" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promises_to_pay" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"promised_date" timestamp NOT NULL,
	"payment_method" varchar NOT NULL,
	"contact_name" varchar NOT NULL,
	"contact_email" varchar,
	"contact_phone" varchar,
	"status" varchar DEFAULT 'active' NOT NULL,
	"fulfilled_at" timestamp,
	"fulfilled_amount" numeric(10, 2),
	"breached_at" timestamp,
	"notes" text,
	"created_via" varchar DEFAULT 'debtor_portal',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"connection_name" varchar,
	"is_active" boolean DEFAULT true,
	"is_connected" boolean DEFAULT false,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"provider_id" varchar,
	"scopes" jsonb,
	"capabilities" jsonb,
	"last_connected_at" timestamp,
	"last_sync_at" timestamp,
	"sync_frequency" varchar DEFAULT 'hourly',
	"auto_sync_enabled" boolean DEFAULT true,
	"last_error" text,
	"error_count" integer DEFAULT 0,
	"last_error_at" timestamp,
	"connection_settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_connections_tenant_provider" UNIQUE("tenant_id","provider")
);
--> statement-breakpoint
CREATE TABLE "retell_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"api_key" text NOT NULL,
	"agent_id" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"phone_number_id" varchar,
	"is_active" boolean DEFAULT true,
	"webhook_url" varchar,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"overall_risk_score" numeric(5, 4),
	"payment_risk" numeric(5, 4),
	"credit_risk" numeric(5, 4),
	"communication_risk" numeric(5, 4),
	"risk_factors" jsonb,
	"risk_trend" varchar,
	"previous_risk_score" numeric(5, 4),
	"risk_change_percent" numeric(6, 3),
	"model_version" varchar NOT NULL,
	"last_calculated" timestamp DEFAULT now(),
	"next_reassessment" timestamp,
	"recommended_actions" jsonb,
	"urgency_level" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "risk_scores_tenant_contact" UNIQUE("tenant_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"is_default" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "role_permission_unique" UNIQUE("role","permission_id")
);
--> statement-breakpoint
CREATE TABLE "sales_forecasts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"forecast_month" varchar NOT NULL,
	"committed_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"uncommitted_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stretch_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"committed_confidence" numeric(3, 2) DEFAULT '0.90',
	"uncommitted_confidence" numeric(3, 2) DEFAULT '0.60',
	"stretch_confidence" numeric(3, 2) DEFAULT '0.30',
	"notes" text,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sales_forecast_tenant_month" UNIQUE("tenant_id","forecast_month")
);
--> statement-breakpoint
CREATE TABLE "scheduler_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"schedule_id" varchar,
	"dso_projected" numeric(7, 2),
	"urgency_factor" numeric(3, 2) DEFAULT '0.50',
	"last_computed_at" timestamp,
	"computation_metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_tenant_schedule" UNIQUE("tenant_id","schedule_id")
);
--> statement-breakpoint
CREATE TABLE "seasonal_patterns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar,
	"pattern_type" varchar NOT NULL,
	"pattern_name" varchar NOT NULL,
	"description" text,
	"time_component" varchar,
	"cycle_period" integer,
	"pattern_strength" numeric(5, 4),
	"confidence" numeric(5, 4),
	"reliability" numeric(5, 4),
	"average_payment_delay" integer,
	"payment_variance" numeric(10, 6),
	"sample_size" integer,
	"historical_data" jsonb,
	"trend_direction" varchar,
	"next_predicted_peak" timestamp,
	"next_predicted_trough" timestamp,
	"seasonal_multiplier" numeric(6, 4),
	"model_version" varchar NOT NULL,
	"last_updated" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar,
	"invoice_id" varchar,
	"provider" varchar DEFAULT 'twilio' NOT NULL,
	"twilio_message_sid" varchar,
	"vonage_message_id" varchar,
	"from_number" varchar NOT NULL,
	"to_number" varchar NOT NULL,
	"direction" varchar NOT NULL,
	"status" varchar DEFAULT 'sent' NOT NULL,
	"body" text NOT NULL,
	"num_segments" integer DEFAULT 1,
	"cost" numeric(6, 4),
	"error_code" varchar,
	"error_message" text,
	"intent" varchar,
	"sentiment" varchar,
	"requires_response" boolean DEFAULT false,
	"responded_at" timestamp,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sms_messages_twilio_message_sid_unique" UNIQUE("twilio_message_sid"),
	CONSTRAINT "sms_messages_vonage_message_id_unique" UNIQUE("vonage_message_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"description" text,
	"monthly_price" numeric(10, 2) NOT NULL,
	"yearly_price" numeric(10, 2),
	"currency" varchar DEFAULT 'USD',
	"max_client_tenants" integer DEFAULT 0,
	"max_users" integer DEFAULT 5,
	"max_invoices_per_month" integer DEFAULT 1000,
	"features" jsonb DEFAULT '[]',
	"stripe_price_id" varchar,
	"stripe_product_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"resource" varchar NOT NULL,
	"last_sync_at" timestamp,
	"last_successful_sync_at" timestamp,
	"sync_cursor" varchar,
	"sync_status" varchar DEFAULT 'idle' NOT NULL,
	"error_message" text,
	"records_processed" integer DEFAULT 0,
	"records_created" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sync_state_tenant_provider_resource" UNIQUE("tenant_id","provider","resource")
);
--> statement-breakpoint
CREATE TABLE "template_performance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"customer_segment" varchar,
	"time_of_day_sent" varchar,
	"day_of_week_sent" integer,
	"sent_count" integer DEFAULT 0,
	"delivered_count" integer DEFAULT 0,
	"opened_count" integer DEFAULT 0,
	"clicked_count" integer DEFAULT 0,
	"responded_count" integer DEFAULT 0,
	"paid_count" integer DEFAULT 0,
	"disputed_count" integer DEFAULT 0,
	"total_amount_paid" numeric(10, 2) DEFAULT '0',
	"average_response_time" integer,
	"sentiment_score" numeric(3, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_tenant_id" varchar NOT NULL,
	"invited_by_user_id" varchar NOT NULL,
	"partner_email" varchar NOT NULL,
	"partner_user_id" varchar,
	"access_level" varchar DEFAULT 'full' NOT NULL,
	"permissions" jsonb DEFAULT '[]',
	"personal_message" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp,
	"response_message" text,
	"expires_at" timestamp NOT NULL,
	"email_sent_at" timestamp,
	"email_opened_at" timestamp,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_metadata" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tenant_type" varchar DEFAULT 'client' NOT NULL,
	"subscription_plan_id" varchar,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"billing_email" varchar,
	"current_month_invoices" integer DEFAULT 0,
	"current_client_count" integer DEFAULT 0,
	"subscription_status" varchar DEFAULT 'active',
	"subscription_start_date" timestamp,
	"subscription_end_date" timestamp,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"is_in_trial" boolean DEFAULT false,
	"usage_limits" jsonb DEFAULT '{}',
	"current_usage" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_tenant_metadata" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_global_id" varchar,
	"source_version" varchar,
	"code" varchar NOT NULL,
	"channel" varchar NOT NULL,
	"tone" varchar NOT NULL,
	"locale" varchar DEFAULT 'en-GB' NOT NULL,
	"subject" varchar,
	"body" text NOT NULL,
	"required_vars" text[] DEFAULT '{}' NOT NULL,
	"compliance_flags" text[] DEFAULT '{}',
	"is_locked" boolean DEFAULT false,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"subdomain" varchar,
	"settings" jsonb,
	"xero_access_token" text,
	"xero_refresh_token" text,
	"xero_tenant_id" varchar,
	"xero_expires_at" timestamp,
	"xero_sync_interval" integer DEFAULT 240,
	"xero_last_sync_at" timestamp,
	"xero_auto_sync" boolean DEFAULT true,
	"collections_automation_enabled" boolean DEFAULT true,
	"communication_mode" varchar DEFAULT 'testing',
	"test_contact_name" varchar,
	"test_emails" text[],
	"test_phones" text[],
	"company_logo_url" varchar,
	"brand_primary_color" varchar DEFAULT '#17B6C3',
	"brand_secondary_color" varchar DEFAULT '#1396A1',
	"communication_tone" varchar DEFAULT 'professional',
	"industry" varchar,
	"company_size" varchar,
	"business_type" varchar DEFAULT 'b2b',
	"primary_market" varchar DEFAULT 'domestic',
	"automation_preference" jsonb DEFAULT '{}',
	"onboarding_completed" boolean DEFAULT false,
	"onboarding_completed_at" timestamp,
	"currency" varchar DEFAULT 'GBP',
	"boe_base_rate" numeric(5, 2) DEFAULT '5.00',
	"interest_markup" numeric(5, 2) DEFAULT '8.00',
	"interest_grace_period" integer DEFAULT 30,
	"approval_mode" varchar DEFAULT 'manual',
	"approval_timeout_hours" integer DEFAULT 12,
	"execution_time" varchar DEFAULT '09:00',
	"execution_timezone" varchar DEFAULT 'Europe/London',
	"daily_limits" jsonb DEFAULT '{"email":100,"sms":50,"voice":20}'::jsonb,
	"min_confidence" jsonb DEFAULT '{"email":0.8,"sms":0.85,"voice":0.9}'::jsonb,
	"exception_rules" jsonb DEFAULT '{"flagFirstContact":true,"flagHighValue":10000,"flagDisputeKeywords":true,"flagVipCustomers":true}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "user_contact_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_contact_assignment" UNIQUE("user_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"role" varchar DEFAULT 'user' NOT NULL,
	"invited_by" varchar NOT NULL,
	"invitation_token" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"message" text,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_invitations_invitation_token_unique" UNIQUE("invitation_token"),
	CONSTRAINT "invitation_tenant_email" UNIQUE("tenant_id","email")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"granted_by" varchar,
	"reason" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_permission_unique" UNIQUE("user_id","tenant_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"tenant_id" varchar,
	"partner_id" varchar,
	"role" varchar DEFAULT 'user' NOT NULL,
	"tenant_role" varchar DEFAULT 'user',
	"platform_admin" boolean DEFAULT false,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"reset_token" varchar,
	"reset_token_expiry" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "voice_calls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"invoice_id" varchar,
	"retell_call_id" varchar NOT NULL,
	"retell_agent_id" varchar NOT NULL,
	"from_number" varchar NOT NULL,
	"to_number" varchar NOT NULL,
	"direction" varchar NOT NULL,
	"status" varchar DEFAULT 'initiated' NOT NULL,
	"duration" integer,
	"cost" numeric(8, 4),
	"transcript" text,
	"recording_url" varchar,
	"call_analysis" jsonb,
	"user_sentiment" varchar,
	"call_successful" boolean,
	"disconnection_reason" varchar,
	"customer_response" varchar,
	"follow_up_required" boolean DEFAULT false,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_message_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"stage" integer,
	"subject" varchar,
	"content" text NOT NULL,
	"variables" jsonb,
	"voice_settings" jsonb,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"send_timing" jsonb,
	"success_rate" numeric(5, 2),
	"usage_count" integer DEFAULT 0,
	"average_listen_duration" integer,
	"tone_of_voice" varchar DEFAULT 'professional',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_state_transitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_workflow_id" varchar NOT NULL,
	"from_state_id" varchar NOT NULL,
	"to_state_id" varchar NOT NULL,
	"condition" jsonb,
	"label" varchar,
	"transition_type" varchar DEFAULT 'default',
	"confidence" numeric(5, 2),
	"success_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_workflow_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_workflow_id" varchar NOT NULL,
	"state_type" varchar NOT NULL,
	"label" varchar NOT NULL,
	"position" jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"is_start_state" boolean DEFAULT false,
	"is_end_state" boolean DEFAULT false,
	"prompt" text,
	"expected_responses" jsonb,
	"retell_state_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"category" varchar DEFAULT 'collection',
	"is_active" boolean DEFAULT true,
	"is_template" boolean DEFAULT false,
	"retell_agent_id" varchar,
	"canvas_data" jsonb,
	"voice_settings" jsonb,
	"success_rate" numeric(5, 2),
	"average_call_duration" integer,
	"total_calls" integer DEFAULT 0,
	"deployment_status" varchar DEFAULT 'draft',
	"last_deployed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"transaction_date" timestamp DEFAULT now() NOT NULL,
	"transaction_type" varchar NOT NULL,
	"source" varchar NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'GBP',
	"running_balance" numeric(12, 2),
	"description" text NOT NULL,
	"reference" varchar,
	"invoice_id" varchar,
	"contact_id" varchar,
	"insurance_provider" varchar,
	"insurance_policy_id" varchar,
	"finance_provider" varchar,
	"finance_advance_id" varchar,
	"status" varchar DEFAULT 'completed' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"source_node_id" varchar NOT NULL,
	"target_node_id" varchar NOT NULL,
	"condition" jsonb,
	"label" varchar,
	"connection_type" varchar DEFAULT 'default',
	"success_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_nodes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"node_type" varchar NOT NULL,
	"sub_type" varchar,
	"label" varchar NOT NULL,
	"position" jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"is_start_node" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"industry" varchar,
	"workflow_data" jsonb NOT NULL,
	"is_public" boolean DEFAULT false,
	"usage_count" integer DEFAULT 0,
	"average_success_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_timers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"contact_id" varchar NOT NULL,
	"timer_type" varchar NOT NULL,
	"trigger_at" timestamp NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"is_template" boolean DEFAULT false,
	"category" varchar,
	"trigger" jsonb,
	"steps" jsonb,
	"canvas_data" jsonb,
	"success_rate" numeric(5, 2),
	"estimated_cost" numeric(8, 2),
	"test_scenarios" jsonb,
	"scheduler_type" varchar DEFAULT 'static',
	"adaptive_settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "action_effectiveness" ADD CONSTRAINT "action_effectiveness_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_effectiveness" ADD CONSTRAINT "action_effectiveness_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_effectiveness" ADD CONSTRAINT "action_effectiveness_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_action_item_id_action_items_id_fk" FOREIGN KEY ("action_item_id") REFERENCES "public"."action_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_configs" ADD CONSTRAINT "ai_agent_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_facts" ADD CONSTRAINT "ai_facts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ard_history" ADD CONSTRAINT "ard_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_id_contacts_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cached_xero_invoices" ADD CONSTRAINT "cached_xero_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_analytics" ADD CONSTRAINT "channel_analytics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_analytics" ADD CONSTRAINT "channel_analytics_template_id_communication_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."communication_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_ab_tests" ADD CONSTRAINT "collection_ab_tests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_schedules" ADD CONSTRAINT "collection_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_outcomes" ADD CONSTRAINT "contact_outcomes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_outcomes" ADD CONSTRAINT "contact_outcomes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_outcomes" ADD CONSTRAINT "contact_outcomes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_outcomes" ADD CONSTRAINT "contact_outcomes_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_behavior_signals" ADD CONSTRAINT "customer_behavior_signals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_behavior_signals" ADD CONSTRAINT "customer_behavior_signals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_learning_profiles" ADD CONSTRAINT "customer_learning_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_learning_profiles" ADD CONSTRAINT "customer_learning_profiles_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_schedule_assignments" ADD CONSTRAINT "customer_schedule_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_schedule_assignments" ADD CONSTRAINT "customer_schedule_assignments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_schedule_assignments" ADD CONSTRAINT "customer_schedule_assignments_schedule_id_collection_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."collection_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_segment_assignments" ADD CONSTRAINT "customer_segment_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_segment_assignments" ADD CONSTRAINT "customer_segment_assignments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_segment_assignments" ADD CONSTRAINT "customer_segment_assignments_segment_id_customer_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."customer_segments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debtor_payments" ADD CONSTRAINT "debtor_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debtor_payments" ADD CONSTRAINT "debtor_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debtor_payments" ADD CONSTRAINT "debtor_payments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_responded_by_user_id_users_id_fk" FOREIGN KEY ("responded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_senders" ADD CONSTRAINT "email_senders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_advances" ADD CONSTRAINT "finance_advances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_advances" ADD CONSTRAINT "finance_advances_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_advances" ADD CONSTRAINT "finance_advances_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_variance_tracking" ADD CONSTRAINT "forecast_variance_tracking_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_variance_tracking" ADD CONSTRAINT "forecast_variance_tracking_snapshot_id_forecast_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."forecast_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_analytics_snapshots" ADD CONSTRAINT "health_analytics_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_ledger" ADD CONSTRAINT "interest_ledger_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_ledger" ADD CONSTRAINT "interest_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_health_scores" ADD CONSTRAINT "invoice_health_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_health_scores" ADD CONSTRAINT "invoice_health_scores_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_health_scores" ADD CONSTRAINT "invoice_health_scores_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_plan_id_payment_plans_id_fk" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ml_model_performance" ADD CONSTRAINT "ml_model_performance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_relationships" ADD CONSTRAINT "partner_client_relationships_partner_user_id_users_id_fk" FOREIGN KEY ("partner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_relationships" ADD CONSTRAINT "partner_client_relationships_partner_tenant_id_tenants_id_fk" FOREIGN KEY ("partner_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_relationships" ADD CONSTRAINT "partner_client_relationships_client_tenant_id_tenants_id_fk" FOREIGN KEY ("client_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_relationships" ADD CONSTRAINT "partner_client_relationships_terminated_by_users_id_fk" FOREIGN KEY ("terminated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_library" ADD CONSTRAINT "pattern_library_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plan_invoices" ADD CONSTRAINT "payment_plan_invoices_payment_plan_id_payment_plans_id_fk" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plan_invoices" ADD CONSTRAINT "payment_plan_invoices_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plan_invoices" ADD CONSTRAINT "payment_plan_invoices_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plan_schedules" ADD CONSTRAINT "payment_plan_schedules_payment_plan_id_payment_plans_id_fk" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_predictions" ADD CONSTRAINT "payment_predictions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_predictions" ADD CONSTRAINT "payment_predictions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_predictions" ADD CONSTRAINT "payment_predictions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_promises" ADD CONSTRAINT "payment_promises_evaluated_by_user_id_users_id_fk" FOREIGN KEY ("evaluated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_audit_log" ADD CONSTRAINT "permission_audit_log_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promises_to_pay" ADD CONSTRAINT "promises_to_pay_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promises_to_pay" ADD CONSTRAINT "promises_to_pay_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promises_to_pay" ADD CONSTRAINT "promises_to_pay_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retell_configurations" ADD CONSTRAINT "retell_configurations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_forecasts" ADD CONSTRAINT "sales_forecasts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_forecasts" ADD CONSTRAINT "sales_forecasts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduler_state" ADD CONSTRAINT "scheduler_state_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasonal_patterns" ADD CONSTRAINT "seasonal_patterns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_performance" ADD CONSTRAINT "template_performance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_performance" ADD CONSTRAINT "template_performance_template_id_communication_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."communication_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_client_tenant_id_tenants_id_fk" FOREIGN KEY ("client_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_partner_user_id_users_id_fk" FOREIGN KEY ("partner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_metadata" ADD CONSTRAINT "tenant_metadata_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_metadata" ADD CONSTRAINT "tenant_metadata_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_templates" ADD CONSTRAINT "tenant_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_templates" ADD CONSTRAINT "tenant_templates_source_global_id_global_templates_id_fk" FOREIGN KEY ("source_global_id") REFERENCES "public"."global_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contact_assignments" ADD CONSTRAINT "user_contact_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contact_assignments" ADD CONSTRAINT "user_contact_assignments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contact_assignments" ADD CONSTRAINT "user_contact_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_contact_assignments" ADD CONSTRAINT "user_contact_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_message_templates" ADD CONSTRAINT "voice_message_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_state_transitions" ADD CONSTRAINT "voice_state_transitions_voice_workflow_id_voice_workflows_id_fk" FOREIGN KEY ("voice_workflow_id") REFERENCES "public"."voice_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_state_transitions" ADD CONSTRAINT "voice_state_transitions_from_state_id_voice_workflow_states_id_fk" FOREIGN KEY ("from_state_id") REFERENCES "public"."voice_workflow_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_state_transitions" ADD CONSTRAINT "voice_state_transitions_to_state_id_voice_workflow_states_id_fk" FOREIGN KEY ("to_state_id") REFERENCES "public"."voice_workflow_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_workflow_states" ADD CONSTRAINT "voice_workflow_states_voice_workflow_id_voice_workflows_id_fk" FOREIGN KEY ("voice_workflow_id") REFERENCES "public"."voice_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_workflows" ADD CONSTRAINT "voice_workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_connections" ADD CONSTRAINT "workflow_connections_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_connections" ADD CONSTRAINT "workflow_connections_source_node_id_workflow_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_connections" ADD CONSTRAINT "workflow_connections_target_node_id_workflow_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_timers" ADD CONSTRAINT "workflow_timers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_timers" ADD CONSTRAINT "workflow_timers_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_timers" ADD CONSTRAINT "workflow_timers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_action_items_tenant_status_due" ON "action_items" USING btree ("tenant_id","status","due_at");--> statement-breakpoint
CREATE INDEX "idx_action_items_tenant_assigned" ON "action_items" USING btree ("tenant_id","assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "idx_action_items_tenant_invoice" ON "action_items" USING btree ("tenant_id","invoice_id");--> statement-breakpoint
CREATE INDEX "idx_action_items_contact_id" ON "action_items" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_action_items_type" ON "action_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_action_logs_tenant_action" ON "action_logs" USING btree ("tenant_id","action_item_id");--> statement-breakpoint
CREATE INDEX "idx_action_logs_event_type" ON "action_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_action_logs_created_at" ON "action_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_actions_tenant_type_status" ON "actions" USING btree ("tenant_id","type","status");--> statement-breakpoint
CREATE INDEX "idx_actions_tenant_updated" ON "actions" USING btree ("tenant_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_actions_tenant_scheduled" ON "actions" USING btree ("tenant_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_actions_contact" ON "actions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_actions_invoice" ON "actions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_tenant" ON "activity_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_type" ON "activity_logs" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_category" ON "activity_logs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_entity" ON "activity_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_result" ON "activity_logs" USING btree ("result");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_created_at" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ard_history_tenant_date_idx" ON "ard_history" USING btree ("tenant_id","calculation_date");--> statement-breakpoint
CREATE INDEX "idx_contact_notes_contact_id" ON "contact_notes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_contact_notes_tenant_id" ON "contact_notes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_contact_notes_created_at" ON "contact_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_contact_outcomes_tenant" ON "contact_outcomes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_contact_outcomes_contact" ON "contact_outcomes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_contact_outcomes_invoice" ON "contact_outcomes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_contact_outcomes_action" ON "contact_outcomes" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "idx_contact_outcomes_event_type" ON "contact_outcomes" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_contact_outcomes_timestamp" ON "contact_outcomes" USING btree ("tenant_id","event_timestamp");--> statement-breakpoint
CREATE INDEX "idx_contacts_name" ON "contacts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_contacts_email" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_contacts_company_name" ON "contacts" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "idx_contacts_tenant_id" ON "contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_behavior_contact" ON "customer_behavior_signals" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_behavior_tenant" ON "customer_behavior_signals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_customer_profiles_prs" ON "customer_learning_profiles" USING btree ("promise_reliability_score");--> statement-breakpoint
CREATE INDEX "idx_customer_profiles_flags" ON "customer_learning_profiles" USING btree ("is_serial_promiser","is_relationship_deteriorating");--> statement-breakpoint
CREATE INDEX "segment_assignments_tenant_idx" ON "customer_segment_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "segment_assignments_contact_idx" ON "customer_segment_assignments" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "segment_assignments_segment_idx" ON "customer_segment_assignments" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "customer_segments_tenant_idx" ON "customer_segments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customer_segments_type_idx" ON "customer_segments" USING btree ("segment_type");--> statement-breakpoint
CREATE INDEX "customer_segments_active_idx" ON "customer_segments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_debtor_payments_invoice" ON "debtor_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_debtor_payments_status" ON "debtor_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_dispute_evidence_dispute" ON "dispute_evidence" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "idx_disputes_invoice" ON "disputes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_disputes_tenant_status" ON "disputes" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_disputes_contact" ON "disputes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_finance_advances_tenant" ON "finance_advances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_finance_advances_invoice" ON "finance_advances" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_finance_advances_status" ON "finance_advances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_finance_advances_due_date" ON "finance_advances" USING btree ("repayment_due_date");--> statement-breakpoint
CREATE INDEX "forecast_snapshots_tenant_date_idx" ON "forecast_snapshots" USING btree ("tenant_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "forecast_variance_tenant_date_idx" ON "forecast_variance_tracking" USING btree ("tenant_id","comparison_date");--> statement-breakpoint
CREATE INDEX "forecast_variance_snapshot_idx" ON "forecast_variance_tracking" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_inbound_tenant" ON "inbound_messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_inbound_contact" ON "inbound_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_inbound_analyzed" ON "inbound_messages" USING btree ("intent_analyzed");--> statement-breakpoint
CREATE INDEX "idx_interest_ledger_invoice" ON "interest_ledger" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_interest_ledger_tenant" ON "interest_ledger" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_tenant_status" ON "invoices" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_invoice_number" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "idx_invoices_created_at" ON "invoices" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_invoices_contact_id" ON "invoices" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_next_action_date" ON "invoices" USING btree ("tenant_id","next_action_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_payment_plan_id" ON "invoices" USING btree ("payment_plan_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_workflow_state" ON "invoices" USING btree ("tenant_id","workflow_state");--> statement-breakpoint
CREATE INDEX "idx_invoices_pause_state" ON "invoices" USING btree ("tenant_id","pause_state");--> statement-breakpoint
CREATE INDEX "idx_magic_link_token" ON "magic_link_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_magic_link_expires" ON "magic_link_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ml_performance_tenant_idx" ON "ml_model_performance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ml_performance_model_idx" ON "ml_model_performance" USING btree ("model_name","model_version");--> statement-breakpoint
CREATE INDEX "ml_performance_active_idx" ON "ml_model_performance" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_onboarding_templates_industry_type" ON "onboarding_templates" USING btree ("industry","business_type","template_type");--> statement-breakpoint
CREATE INDEX "idx_partner_relationships_partner" ON "partner_client_relationships" USING btree ("partner_user_id");--> statement-breakpoint
CREATE INDEX "idx_partner_relationships_client" ON "partner_client_relationships" USING btree ("client_tenant_id");--> statement-breakpoint
CREATE INDEX "idx_partner_relationships_status" ON "partner_client_relationships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_partners_email" ON "partners" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_partners_status" ON "partners" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pattern_library_tenant_idx" ON "pattern_library" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pattern_library_entity_idx" ON "pattern_library" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_payment_plan_invoices_plan" ON "payment_plan_invoices" USING btree ("payment_plan_id");--> statement-breakpoint
CREATE INDEX "idx_payment_plan_invoices_invoice" ON "payment_plan_invoices" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_plan_schedules_plan" ON "payment_plan_schedules" USING btree ("payment_plan_id");--> statement-breakpoint
CREATE INDEX "idx_payment_plan_schedules_due_date" ON "payment_plan_schedules" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_payment_plan_schedules_status" ON "payment_plan_schedules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_plans_tenant" ON "payment_plans" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_payment_plans_contact" ON "payment_plans" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_payment_plans_status" ON "payment_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_plans_start_date" ON "payment_plans" USING btree ("plan_start_date");--> statement-breakpoint
CREATE INDEX "payment_predictions_tenant_idx" ON "payment_predictions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_predictions_invoice_idx" ON "payment_predictions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_predictions_contact_idx" ON "payment_predictions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "payment_predictions_date_idx" ON "payment_predictions" USING btree ("prediction_date");--> statement-breakpoint
CREATE INDEX "idx_payment_promises_tenant_status" ON "payment_promises" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_payment_promises_tenant_invoice" ON "payment_promises" USING btree ("tenant_id","invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payment_promises_promised_date" ON "payment_promises" USING btree ("promised_date");--> statement-breakpoint
CREATE INDEX "idx_payment_promises_contact_id" ON "payment_promises" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_payment_promises_source" ON "payment_promises" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_payment_promises_promise_type" ON "payment_promises" USING btree ("promise_type");--> statement-breakpoint
CREATE INDEX "idx_policy_decisions_tenant" ON "policy_decisions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_policy_decisions_contact" ON "policy_decisions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_policy_decisions_invoice" ON "policy_decisions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_policy_decisions_action" ON "policy_decisions" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "idx_policy_decisions_variant" ON "policy_decisions" USING btree ("experiment_variant");--> statement-breakpoint
CREATE INDEX "idx_policy_decisions_timestamp" ON "policy_decisions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ptp_invoice" ON "promises_to_pay" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_ptp_tenant_status" ON "promises_to_pay" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_ptp_promised_date" ON "promises_to_pay" USING btree ("promised_date");--> statement-breakpoint
CREATE INDEX "risk_scores_tenant_idx" ON "risk_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "risk_scores_overall_risk_idx" ON "risk_scores" USING btree ("overall_risk_score");--> statement-breakpoint
CREATE INDEX "risk_scores_urgency_idx" ON "risk_scores" USING btree ("urgency_level");--> statement-breakpoint
CREATE INDEX "sales_forecasts_tenant_idx" ON "sales_forecasts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_scheduler_state_tenant" ON "scheduler_state" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_scheduler_state_schedule" ON "scheduler_state" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "seasonal_patterns_tenant_idx" ON "seasonal_patterns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seasonal_patterns_contact_idx" ON "seasonal_patterns" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "seasonal_patterns_type_idx" ON "seasonal_patterns" USING btree ("pattern_type");--> statement-breakpoint
CREATE INDEX "seasonal_patterns_strength_idx" ON "seasonal_patterns" USING btree ("pattern_strength");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_sms_tenant_id" ON "sms_messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_sms_contact_id" ON "sms_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_sms_direction" ON "sms_messages" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "idx_sms_status" ON "sms_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sms_provider" ON "sms_messages" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_invitations_client_tenant" ON "tenant_invitations" USING btree ("client_tenant_id");--> statement-breakpoint
CREATE INDEX "idx_invitations_partner_email" ON "tenant_invitations" USING btree ("partner_email");--> statement-breakpoint
CREATE INDEX "idx_invitations_status" ON "tenant_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invitations_expires_at" ON "tenant_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_tenant_metadata_type" ON "tenant_metadata" USING btree ("tenant_type");--> statement-breakpoint
CREATE INDEX "idx_tenant_metadata_subscription" ON "tenant_metadata" USING btree ("subscription_plan_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_metadata_status" ON "tenant_metadata" USING btree ("subscription_status");--> statement-breakpoint
CREATE INDEX "idx_user_contact_assignments_user" ON "user_contact_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_contact_assignments_contact" ON "user_contact_assignments" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_user_contact_assignments_tenant" ON "user_contact_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_contact_assignments_active" ON "user_contact_assignments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_wallet_transactions_tenant" ON "wallet_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_wallet_transactions_date" ON "wallet_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "idx_wallet_transactions_type" ON "wallet_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "idx_wallet_transactions_source" ON "wallet_transactions" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_wallet_transactions_invoice" ON "wallet_transactions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_wallet_transactions_contact" ON "wallet_transactions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_timers_tenant" ON "workflow_timers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_timers_invoice" ON "workflow_timers" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_timers_trigger" ON "workflow_timers" USING btree ("tenant_id","trigger_at","status");--> statement-breakpoint
CREATE INDEX "idx_workflow_timers_type" ON "workflow_timers" USING btree ("timer_type","status");