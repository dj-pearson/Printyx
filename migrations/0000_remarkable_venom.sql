CREATE TYPE "public"."access_type" AS ENUM('read', 'write', 'delete', 'export');--> statement-breakpoint
CREATE TYPE "public"."activity_goal_type" AS ENUM('calls', 'emails', 'meetings', 'reachouts', 'proposals', 'new_opportunities', 'demos', 'follow_ups');--> statement-breakpoint
CREATE TYPE "public"."adjustment_type" AS ENUM('chargeback', 'bonus', 'penalty', 'correction', 'manual_adjustment', 'split_adjustment');--> statement-breakpoint
CREATE TYPE "public"."analysis_type" AS ENUM('diagnostic', 'repair', 'maintenance', 'installation', 'inspection', 'training');--> statement-breakpoint
CREATE TYPE "public"."audit_category" AS ENUM('authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."auth_method" AS ENUM('api_key', 'oauth2', 'basic_auth', 'certificate', 'hmac');--> statement-breakpoint
CREATE TYPE "public"."calculation_status" AS ENUM('draft', 'calculated', 'approved', 'paid', 'disputed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."check_in_type" AS ENUM('arrival', 'departure', 'break_start', 'break_end');--> statement-breakpoint
CREATE TYPE "public"."collection_frequency" AS ENUM('real_time', 'hourly', 'daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."contact_method" AS ENUM('phone', 'email', 'portal', 'chat', 'walk_in');--> statement-breakpoint
CREATE TYPE "public"."customer_portal_status" AS ENUM('active', 'inactive', 'suspended', 'pending_activation');--> statement-breakpoint
CREATE TYPE "public"."data_classification" AS ENUM('public', 'internal', 'confidential', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('online', 'offline', 'error', 'maintenance', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('submitted', 'under_review', 'escalated', 'resolved', 'rejected', 'closed');--> statement-breakpoint
CREATE TYPE "public"."dispute_type" AS ENUM('calculation_error', 'split_commission', 'chargeback_dispute', 'rate_dispute', 'quota_dispute', 'bonus_dispute');--> statement-breakpoint
CREATE TYPE "public"."enhanced_ticket_status" AS ENUM('new', 'assigned', 'scheduled', 'en_route', 'on_site', 'in_progress', 'parts_needed', 'customer_approval', 'testing', 'completed', 'follow_up_required', 'cancelled', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."field_service_status" AS ENUM('scheduled', 'en_route', 'checked_in', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."gdpr_request_type" AS ENUM('access', 'rectification', 'erasure', 'portability', 'restrict_processing', 'object_processing');--> statement-breakpoint
CREATE TYPE "public"."gdpr_status" AS ENUM('pending', 'in_progress', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."goal_period" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."installation_type" AS ENUM('new_installation', 'replacement', 'relocation', 'upgrade');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('active', 'inactive', 'error', 'pending');--> statement-breakpoint
CREATE TYPE "public"."issue_category" AS ENUM('paper_jam', 'print_quality', 'connectivity', 'hardware_failure', 'software_issue', 'toner_cartridge', 'maintenance', 'installation', 'training', 'other');--> statement-breakpoint
CREATE TYPE "public"."kit_quality_status" AS ENUM('pass', 'fail', 'rework_required', 'pending_inspection');--> statement-breakpoint
CREATE TYPE "public"."manufacturer" AS ENUM('canon', 'xerox', 'hp', 'konica_minolta', 'lexmark', 'fmaudit', 'printanista');--> statement-breakpoint
CREATE TYPE "public"."meter_submission_method" AS ENUM('manual_entry', 'photo_upload', 'email', 'automated');--> statement-breakpoint
CREATE TYPE "public"."network_assignment" AS ENUM('static', 'dhcp', 'reserved_dhcp');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('service_update', 'invoice_ready', 'payment_due', 'supply_low', 'maintenance_reminder', 'system_alert');--> statement-breakpoint
CREATE TYPE "public"."onboarding_status" AS ENUM('draft', 'in_progress', 'pending_review', 'completed', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."organizational_tier" AS ENUM('platform', 'company', 'regional', 'location');--> statement-breakpoint
CREATE TYPE "public"."parts_order_status" AS ENUM('pending', 'ordered', 'shipped', 'delivered', 'installed', 'returned');--> statement-breakpoint
CREATE TYPE "public"."payment_frequency" AS ENUM('weekly', 'bi_weekly', 'monthly', 'quarterly', 'annually');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('credit_card', 'ach', 'wire_transfer', 'check', 'auto_pay');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_paid');--> statement-breakpoint
CREATE TYPE "public"."permission_effect" AS ENUM('ALLOW', 'DENY');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('sales_rep', 'sales_manager', 'service_tech', 'account_manager', 'inside_sales', 'field_sales');--> statement-breakpoint
CREATE TYPE "public"."print_management_system" AS ENUM('papercut', 'equitrac', 'ysoft', 'other', 'none');--> statement-breakpoint
CREATE TYPE "public"."role_hierarchy_level" AS ENUM('level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'level_6', 'level_7', 'level_8');--> statement-breakpoint
CREATE TYPE "public"."role_type" AS ENUM('platform_admin', 'company_admin', 'regional_manager', 'location_manager', 'department_role');--> statement-breakpoint
CREATE TYPE "public"."service_outcome" AS ENUM('resolved', 'partial_fix', 'requires_parts', 'requires_escalation', 'customer_declined', 'follow_up_needed', 'warranty_claim', 'preventive_maintenance');--> statement-breakpoint
CREATE TYPE "public"."service_request_priority" AS ENUM('low', 'normal', 'high', 'urgent', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."service_request_status" AS ENUM('submitted', 'acknowledged', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_request_type" AS ENUM('maintenance', 'repair', 'installation', 'training', 'supplies', 'technical_support', 'other');--> statement-breakpoint
CREATE TYPE "public"."supply_order_status" AS ENUM('draft', 'submitted', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."warehouse_operation_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('view_report', 'export_report', 'schedule_report', 'customize_dashboard', 'create_report', 'share_report');--> statement-breakpoint
CREATE TYPE "public"."delivery_method" AS ENUM('email', 'webhook', 'sftp', 'download');--> statement-breakpoint
CREATE TYPE "public"."display_format" AS ENUM('number', 'currency', 'percentage', 'decimal');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('json', 'csv', 'xlsx', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."organizational_scope" AS ENUM('platform', 'company', 'regional', 'location', 'team', 'individual');--> statement-breakpoint
CREATE TYPE "public"."performance_level" AS ENUM('excellent', 'good', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."report_category" AS ENUM('sales', 'service', 'finance', 'operations', 'hr', 'it', 'compliance', 'executive');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('success', 'failed', 'running', 'timeout', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."report_visualization" AS ENUM('table', 'chart', 'dashboard', 'kpi_widget', 'chart_table_combo');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('absolute', 'percentage', 'ratio');--> statement-breakpoint
CREATE TYPE "public"."time_period" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TABLE "accessory_model_compatibility" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"accessory_id" varchar NOT NULL,
	"model_id" varchar NOT NULL,
	"is_required" boolean DEFAULT false,
	"is_optional" boolean DEFAULT true,
	"installation_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts_payable" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"bill_number" varchar NOT NULL,
	"purchase_order_number" varchar,
	"reference_number" varchar,
	"bill_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"description" text,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"balance_amount" numeric(12, 2) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"priority" varchar DEFAULT 'normal',
	"category" varchar,
	"department" varchar,
	"payment_method" varchar,
	"payment_date" timestamp,
	"check_number" varchar,
	"approved_by" varchar,
	"approved_date" timestamp,
	"approval_notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts_receivable" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"invoice_number" varchar NOT NULL,
	"contract_id" varchar,
	"sales_order_number" varchar,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"description" text,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"balance_amount" numeric(12, 2) NOT NULL,
	"status" varchar DEFAULT 'outstanding' NOT NULL,
	"invoice_type" varchar NOT NULL,
	"category" varchar,
	"payment_terms" varchar DEFAULT 'Net 30',
	"payment_method" varchar,
	"last_payment_date" timestamp,
	"follow_up_date" timestamp,
	"collection_notes" text,
	"days_overdue" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"team_id" varchar,
	"report_date" timestamp NOT NULL,
	"period" "goal_period" NOT NULL,
	"total_calls" integer DEFAULT 0,
	"total_emails" integer DEFAULT 0,
	"total_meetings" integer DEFAULT 0,
	"total_reachouts" integer DEFAULT 0,
	"total_proposals" integer DEFAULT 0,
	"total_new_opportunities" integer DEFAULT 0,
	"total_demos" integer DEFAULT 0,
	"total_follow_ups" integer DEFAULT 0,
	"connected_calls" integer DEFAULT 0,
	"email_replies" integer DEFAULT 0,
	"meetings_scheduled" integer DEFAULT 0,
	"proposals_accepted" integer DEFAULT 0,
	"opportunities_converted" integer DEFAULT 0,
	"call_connect_rate" numeric(5, 2),
	"email_reply_rate" numeric(5, 2),
	"meeting_show_rate" numeric(5, 2),
	"proposal_win_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(255) NOT NULL,
	"resource" varchar(255) NOT NULL,
	"resource_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"session_id" varchar(255),
	"severity" "audit_severity" NOT NULL,
	"category" "audit_category" NOT NULL,
	"request_id" uuid,
	"parent_action_id" uuid,
	"additional_context" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_invoice_generation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_type" varchar NOT NULL,
	"source_id" varchar NOT NULL,
	"invoice_id" varchar,
	"invoice_number" varchar,
	"generation_status" varchar DEFAULT 'pending',
	"generation_attempts" integer DEFAULT 0,
	"error_message" text,
	"triggered_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"issuance_delay_hours" numeric(8, 2),
	"labor_hours" numeric(6, 2),
	"labor_rate" numeric(8, 2),
	"parts_total" numeric(10, 2),
	"total_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_record_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"business_record_id" varchar NOT NULL,
	"activity_type" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"description" text,
	"direction" varchar,
	"email_from" varchar,
	"email_to" text,
	"email_cc" text,
	"email_subject" varchar,
	"email_body" text,
	"is_shared" boolean DEFAULT false,
	"call_duration" integer,
	"call_outcome" varchar,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"due_date" timestamp,
	"outcome" varchar,
	"next_action" text,
	"follow_up_date" timestamp,
	"related_records" jsonb,
	"attachments" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_customer_id" varchar,
	"external_system_id" varchar,
	"external_salesforce_id" varchar,
	"external_lead_id" varchar,
	"migration_status" varchar,
	"last_sync_date" timestamp,
	"external_data" jsonb,
	"record_type" varchar DEFAULT 'lead' NOT NULL,
	"status" varchar DEFAULT 'new' NOT NULL,
	"company_name" varchar NOT NULL,
	"account_number" varchar,
	"account_type" varchar,
	"website" varchar,
	"industry" varchar,
	"company_size" varchar,
	"employee_count" integer,
	"annual_revenue" numeric(15, 2),
	"customer_rating" varchar,
	"parent_account_id" varchar,
	"customer_priority" varchar,
	"sla_level" varchar,
	"is_active" boolean DEFAULT true,
	"upsell_opportunity" varchar,
	"account_notes" text,
	"primary_contact_name" varchar,
	"primary_contact_email" varchar,
	"primary_contact_phone" varchar,
	"primary_contact_title" varchar,
	"billing_contact_name" varchar,
	"billing_contact_email" varchar,
	"billing_contact_phone" varchar,
	"address_line1" varchar,
	"address_line2" varchar,
	"city" varchar,
	"state" varchar,
	"postal_code" varchar,
	"country" varchar DEFAULT 'US',
	"billing_address_1" varchar,
	"billing_address_2" varchar,
	"billing_city" varchar,
	"billing_state" varchar,
	"billing_zip_code" varchar,
	"phone" varchar,
	"fax" varchar,
	"preferred_contact_method" varchar,
	"source" varchar DEFAULT 'website' NOT NULL,
	"estimated_deal_value" numeric(10, 2),
	"probability" integer DEFAULT 50,
	"close_date" timestamp,
	"sales_stage" varchar,
	"interest_level" varchar,
	"owner_id" varchar,
	"assigned_sales_rep" varchar,
	"territory" varchar,
	"account_manager_id" varchar,
	"lead_score" integer DEFAULT 0,
	"priority" varchar DEFAULT 'medium',
	"customer_number" varchar,
	"company_display_id" varchar,
	"url_slug" varchar,
	"customer_since" timestamp,
	"customer_until" timestamp,
	"deactivation_reason" varchar,
	"reactivation_date" timestamp,
	"churned_date" timestamp,
	"competitor_name" varchar,
	"credit_limit" numeric(10, 2),
	"payment_terms" varchar,
	"billing_terms" varchar,
	"tax_exempt" boolean DEFAULT false,
	"tax_id" varchar,
	"customer_tier" varchar,
	"preferred_technician" varchar,
	"last_service_date" timestamp,
	"next_scheduled_service" timestamp,
	"last_invoice_date" timestamp,
	"last_payment_date" timestamp,
	"current_balance" numeric(10, 2) DEFAULT '0',
	"last_meter_reading_date" timestamp,
	"next_meter_reading_date" timestamp,
	"last_contact_date" timestamp,
	"next_follow_up_date" timestamp,
	"notes" text,
	"created_by" varchar NOT NULL,
	"converted_by" varchar,
	"deactivated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "business_records_customer_number_unique" UNIQUE("customer_number"),
	CONSTRAINT "business_records_company_display_id_unique" UNIQUE("company_display_id"),
	CONSTRAINT "business_records_url_slug_unique" UNIQUE("url_slug")
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"account_code" varchar NOT NULL,
	"account_name" varchar NOT NULL,
	"account_type" varchar NOT NULL,
	"account_subtype" varchar,
	"parent_account_id" varchar,
	"level" integer DEFAULT 1,
	"description" text,
	"is_active" boolean DEFAULT true,
	"is_system" boolean DEFAULT false,
	"current_balance" numeric(12, 2) DEFAULT '0',
	"debit_balance" numeric(12, 2) DEFAULT '0',
	"credit_balance" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commission_adjustments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"calculation_id" varchar,
	"employee_id" varchar NOT NULL,
	"adjustment_type" "adjustment_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"reference_type" varchar,
	"reference_id" varchar,
	"reference_name" varchar,
	"is_processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"processed_by" varchar,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"approved_at" timestamp,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_bonuses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calculation_id" varchar NOT NULL,
	"bonus_type" varchar NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"eligibility_met" boolean DEFAULT false NOT NULL,
	"eligibility_criteria" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_calculation_details" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calculation_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"category_name" varchar NOT NULL,
	"sales_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"description" text,
	"billable_hours" numeric(8, 2),
	"hourly_rate" numeric(8, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_calculations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"employee_id" varchar NOT NULL,
	"plan_id" varchar NOT NULL,
	"calculation_period_start" timestamp NOT NULL,
	"calculation_period_end" timestamp NOT NULL,
	"period_name" varchar NOT NULL,
	"total_sales" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"quota_target" numeric(15, 2),
	"quota_achievement" numeric(5, 2),
	"gross_commission" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_bonuses" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_adjustments" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"net_commission" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"status" "calculation_status" DEFAULT 'draft' NOT NULL,
	"calculated_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"paid_at" timestamp,
	"payout_date" timestamp,
	"calculated_by" varchar,
	"approved_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_dispute_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"user" varchar NOT NULL,
	"user_id" varchar,
	"description" text NOT NULL,
	"previous_status" "dispute_status",
	"new_status" "dispute_status",
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_disputes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"dispute_number" varchar NOT NULL,
	"calculation_id" varchar NOT NULL,
	"employee_id" varchar NOT NULL,
	"dispute_type" "dispute_type" NOT NULL,
	"status" "dispute_status" DEFAULT 'submitted' NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"disputed_amount" numeric(12, 2) NOT NULL,
	"expected_amount" numeric(12, 2) NOT NULL,
	"difference" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"employee_comments" text,
	"manager_comments" text,
	"assigned_to" varchar,
	"estimated_resolution" timestamp,
	"actual_resolution" timestamp,
	"resolution_type" varchar,
	"adjustment_amount" numeric(12, 2),
	"resolution_notes" text,
	"submitted_date" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"submitted_by" varchar NOT NULL,
	"resolved_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "commission_disputes_dispute_number_unique" UNIQUE("dispute_number")
);
--> statement-breakpoint
CREATE TABLE "commission_plan_tiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"tier_level" integer NOT NULL,
	"tier_name" varchar NOT NULL,
	"minimum_sales" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"maximum_sales" numeric(15, 2),
	"commission_rate" numeric(5, 2) NOT NULL,
	"bonus_threshold" numeric(15, 2),
	"bonus_amount" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"plan_name" varchar NOT NULL,
	"plan_type" "plan_type" NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_date" timestamp NOT NULL,
	"end_date" timestamp,
	"payment_frequency" "payment_frequency" DEFAULT 'monthly' NOT NULL,
	"payment_delay" integer DEFAULT 30 NOT NULL,
	"minimum_commission_payment" numeric(10, 2) DEFAULT '0.00',
	"split_commission_allowed" boolean DEFAULT false NOT NULL,
	"chargeback_enabled" boolean DEFAULT true NOT NULL,
	"chargeback_period" integer DEFAULT 90 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "commission_product_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"category_name" varchar NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_sales_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"calculation_id" varchar,
	"employee_id" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"transaction_id" varchar NOT NULL,
	"transaction_number" varchar,
	"transaction_date" timestamp NOT NULL,
	"customer_id" varchar,
	"customer_name" varchar,
	"sale_amount" numeric(15, 2) NOT NULL,
	"commissionable_amount" numeric(15, 2) NOT NULL,
	"category" varchar NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"is_split_commission" boolean DEFAULT false NOT NULL,
	"split_percentage" numeric(5, 2) DEFAULT '100.00',
	"primary_employee_id" varchar,
	"is_processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"is_charged_back" boolean DEFAULT false NOT NULL,
	"charged_back_at" timestamp,
	"chargeback_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"business_record_type" varchar DEFAULT 'Customer' NOT NULL,
	"customer_number" varchar,
	"business_name" varchar NOT NULL,
	"business_site" varchar,
	"parent_business" varchar,
	"industry" varchar,
	"activity" varchar,
	"description" text,
	"phone" varchar,
	"fax" varchar,
	"website" varchar,
	"next_call_back" timestamp,
	"billing_address" text,
	"billing_city" varchar,
	"billing_state" varchar,
	"billing_zip" varchar,
	"shipping_address" text,
	"shipping_city" varchar,
	"shipping_state" varchar,
	"shipping_zip" varchar,
	"customer_since" timestamp,
	"employees" integer,
	"annual_revenue" numeric(12, 2),
	"number_of_locations" integer,
	"sic_code" varchar,
	"product_services_interest" text,
	"number_of_steps_rights" integer,
	"special_delivery_instructions" text,
	"tax_state" varchar,
	"elevator" varchar,
	"created_by" varchar,
	"business_owner" varchar,
	"last_modified_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "companies_customer_number_unique" UNIQUE("customer_number")
);
--> statement-breakpoint
CREATE TABLE "company_branding_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"is_default" boolean DEFAULT false,
	"company_name" varchar NOT NULL,
	"tagline" varchar,
	"logo_url" varchar,
	"website_url" varchar,
	"primary_color" varchar DEFAULT '#0066CC',
	"secondary_color" varchar DEFAULT '#F8F9FA',
	"accent_color" varchar DEFAULT '#28A745',
	"text_color" varchar DEFAULT '#212529',
	"heading_font" varchar DEFAULT 'Inter',
	"body_font" varchar DEFAULT 'Inter',
	"address" text,
	"phone" varchar,
	"email" varchar,
	"social_links" jsonb DEFAULT '{}',
	"custom_css" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"salutation" varchar,
	"first_name" varchar,
	"last_name" varchar NOT NULL,
	"title" varchar,
	"department" varchar,
	"phone" varchar,
	"mobile" varchar,
	"email" varchar,
	"reports_to" varchar,
	"contact_roles" text,
	"is_primary_contact" boolean DEFAULT false,
	"lead_status" varchar DEFAULT 'new',
	"last_contact_date" timestamp,
	"next_follow_up_date" timestamp,
	"owner_id" varchar,
	"favorite_content_type" varchar,
	"preferred_channels" text,
	"assistant" varchar,
	"assistant_phone" varchar,
	"other_phone" varchar,
	"home_phone" varchar,
	"fax" varchar,
	"birthdate" timestamp,
	"mailing_address" text,
	"mailing_city" varchar,
	"mailing_state" varchar,
	"mailing_zip" varchar,
	"other_address" text,
	"other_city" varchar,
	"other_state" varchar,
	"other_zip" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_pricing_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"default_markup_percentage" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"allow_salesperson_override" boolean DEFAULT true,
	"minimum_gross_profit_percentage" numeric(5, 2) DEFAULT '5.00',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"document_type" varchar NOT NULL,
	"document_url" varchar,
	"metadata" jsonb,
	"verification_status" varchar DEFAULT 'pending',
	"verified_by" uuid,
	"verification_date" timestamp,
	"expiration_date" timestamp,
	"reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"gdpr_enabled" boolean DEFAULT true,
	"gdpr_contact_email" varchar(255),
	"gdpr_response_days" integer DEFAULT 30,
	"automatic_data_retention" boolean DEFAULT false,
	"data_retention_period_days" integer DEFAULT 2555,
	"audit_retention_period_days" integer DEFAULT 2555,
	"audit_high_risk_only" boolean DEFAULT false,
	"audit_failed_logins_only" boolean DEFAULT false,
	"session_timeout_minutes" integer DEFAULT 30,
	"session_warning_minutes" integer DEFAULT 25,
	"max_concurrent_sessions" integer DEFAULT 3,
	"force_logout_suspicious" boolean DEFAULT true,
	"encrypt_sensitive_fields" boolean DEFAULT true,
	"mask_data_in_logs" boolean DEFAULT true,
	"require_data_classification" boolean DEFAULT true,
	"notify_on_gdpr_request" boolean DEFAULT true,
	"notify_on_suspicious_activity" boolean DEFAULT true,
	"notify_on_data_breach" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_tiered_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contract_id" varchar NOT NULL,
	"tier_name" varchar NOT NULL,
	"color_type" varchar NOT NULL,
	"minimum_volume" integer DEFAULT 0 NOT NULL,
	"maximum_volume" integer,
	"rate" numeric(10, 4) NOT NULL,
	"minimum_charge" numeric(10, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"contract_number" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"black_rate" numeric(10, 4),
	"color_rate" numeric(10, 4),
	"monthly_base" numeric(10, 2),
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversion_funnel" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"team_id" varchar,
	"tracking_period" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"total_activities" integer DEFAULT 0,
	"connections_established" integer DEFAULT 0,
	"meetings_scheduled" integer DEFAULT 0,
	"meetings_held" integer DEFAULT 0,
	"proposals_sent" integer DEFAULT 0,
	"deals_won" integer DEFAULT 0,
	"activity_to_connection_rate" numeric(5, 2) DEFAULT '0',
	"connection_to_meeting_rate" numeric(5, 2) DEFAULT '0',
	"meeting_to_proposal_rate" numeric(5, 2) DEFAULT '0',
	"proposal_to_win_rate" numeric(5, 2) DEFAULT '0',
	"overall_conversion_rate" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cpc_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"model_id" varchar NOT NULL,
	"service_name" varchar NOT NULL,
	"pricing_level" varchar NOT NULL,
	"color_mode" varchar NOT NULL,
	"type" varchar NOT NULL,
	"min_volume" integer DEFAULT 0,
	"max_volume" integer,
	"base_rate" numeric(10, 5),
	"cpc" numeric(10, 5),
	"cpc_overage" numeric(10, 5),
	"includes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"title" varchar,
	"department" varchar,
	"phone" varchar,
	"email" varchar,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_meter_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"equipment_serial_number" varchar(100) NOT NULL,
	"total_impressions" integer,
	"black_white_impressions" integer,
	"color_impressions" integer,
	"large_format_impressions" integer,
	"scan_impressions" integer,
	"fax_impressions" integer,
	"submission_method" "meter_submission_method" NOT NULL,
	"reading_date" timestamp NOT NULL,
	"submission_date" timestamp DEFAULT now() NOT NULL,
	"photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_validated" boolean DEFAULT false NOT NULL,
	"validated_by" uuid,
	"validated_at" timestamp,
	"validation_notes" text,
	"is_billed" boolean DEFAULT false NOT NULL,
	"billing_date" timestamp,
	"invoice_id" uuid,
	"customer_notes" text,
	"internal_notes" text
);
--> statement-breakpoint
CREATE TABLE "customer_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_email_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp,
	"is_sms_capable" boolean DEFAULT false NOT NULL,
	"is_sms_sent" boolean DEFAULT false NOT NULL,
	"sms_sent_at" timestamp,
	"is_portal_read" boolean DEFAULT false NOT NULL,
	"portal_read_at" timestamp,
	"related_service_request_id" uuid,
	"related_invoice_id" uuid,
	"related_payment_id" uuid,
	"related_supply_order_id" uuid,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"scheduled_send_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customer_number_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"prefix" varchar(10) DEFAULT 'CUST' NOT NULL,
	"current_sequence" integer DEFAULT 1000 NOT NULL,
	"sequence_length" integer DEFAULT 4 NOT NULL,
	"separator_char" varchar(1) DEFAULT '-',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_number_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"customer_number" varchar NOT NULL,
	"config_id" varchar NOT NULL,
	"generated_at" timestamp DEFAULT now(),
	"generated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "customer_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid,
	"payment_number" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"invoice_id" uuid,
	"invoice_number" varchar(100),
	"transaction_id" varchar(255),
	"processor_name" varchar(100),
	"processor_response" jsonb,
	"payment_method_details" jsonb,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"customer_notes" text,
	"internal_notes" text,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	CONSTRAINT "customer_payments_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "customer_portal_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"status" "customer_portal_status" DEFAULT 'pending_activation' NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" varchar(255),
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp,
	"last_login_at" timestamp,
	"session_token" varchar(255),
	"session_expires" timestamp,
	"permissions" jsonb DEFAULT '{"canViewInvoices":true,"canSubmitServiceRequests":true,"canOrderSupplies":true,"canSubmitMeterReadings":true,"canViewServiceHistory":true,"canMakePayments":true}'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '{"emailNotifications":true,"smsNotifications":false,"language":"en","timezone":"America/New_York"}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "customer_portal_access_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "customer_portal_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"description" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"related_record_type" varchar(50),
	"related_record_id" uuid,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_related_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"record_type" varchar NOT NULL,
	"record_id" varchar NOT NULL,
	"record_title" varchar,
	"record_count" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid NOT NULL,
	"request_number" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"type" "service_request_type" NOT NULL,
	"priority" "service_request_priority" DEFAULT 'normal' NOT NULL,
	"status" "service_request_status" DEFAULT 'submitted' NOT NULL,
	"equipment_id" uuid,
	"equipment_serial_number" varchar(100),
	"equipment_model" varchar(100),
	"equipment_location" varchar(255),
	"contact_name" varchar(100) NOT NULL,
	"contact_phone" varchar(20),
	"contact_email" varchar(255),
	"preferred_date" timestamp,
	"preferred_time" varchar(50),
	"urgency_notes" text,
	"assigned_technician_id" uuid,
	"service_ticket_id" uuid,
	"estimated_completion_date" timestamp,
	"actual_completion_date" timestamp,
	"customer_notes" text,
	"internal_notes" text,
	"resolution_notes" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"customer_rating" integer,
	"customer_feedback" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_service_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "customer_supply_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_sku" varchar(100) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"product_description" text,
	"compatible_equipment_id" uuid,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"estimated_ship_date" timestamp,
	"customer_notes" text
);
--> statement-breakpoint
CREATE TABLE "customer_supply_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"status" "supply_order_status" DEFAULT 'draft' NOT NULL,
	"delivery_address" jsonb NOT NULL,
	"delivery_instructions" text,
	"requested_delivery_date" timestamp,
	"actual_delivery_date" timestamp,
	"subtotal" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"shipping" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"is_contract_covered" boolean DEFAULT false NOT NULL,
	"contract_id" uuid,
	"purchase_order_number" varchar(100),
	"tracking_number" varchar(100),
	"carrier" varchar(50),
	"shipped_at" timestamp,
	"customer_notes" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_supply_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "data_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"resource" varchar(255) NOT NULL,
	"resource_id" uuid,
	"access_type" "access_type" NOT NULL,
	"query" text,
	"result_count" integer,
	"response_time_ms" integer,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"session_id" varchar(255),
	"data_classification" "data_classification" NOT NULL,
	"contains_pii" boolean DEFAULT false,
	"suspicious_activity" boolean DEFAULT false,
	"risk_score" integer DEFAULT 0,
	"accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"deal_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"subject" varchar(200),
	"description" text,
	"user_id" varchar NOT NULL,
	"duration" integer,
	"outcome" varchar,
	"previous_value" text,
	"new_value" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_stages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#3B82F6',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_closing_stage" boolean DEFAULT false,
	"is_won_stage" boolean DEFAULT false,
	"requires_approval" boolean DEFAULT false,
	"auto_move_conditions" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"amount" numeric(12, 2),
	"owner_id" varchar NOT NULL,
	"customer_id" varchar,
	"company_name" varchar,
	"stage_id" varchar NOT NULL,
	"probability" integer DEFAULT 0,
	"expected_close_date" timestamp,
	"actual_close_date" timestamp,
	"source" varchar,
	"deal_type" varchar,
	"priority" varchar DEFAULT 'medium',
	"primary_contact_name" varchar,
	"primary_contact_email" varchar,
	"primary_contact_phone" varchar,
	"products_interested" text,
	"estimated_monthly_value" numeric(10, 2),
	"status" varchar DEFAULT 'open' NOT NULL,
	"lost_reason" varchar,
	"last_activity_date" timestamp,
	"next_follow_up_date" timestamp,
	"created_by_id" varchar NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "delivery_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"time_window" varchar,
	"delivery_type" varchar DEFAULT 'standard' NOT NULL,
	"special_instructions" text,
	"delivery_address" jsonb NOT NULL,
	"contact_person" varchar,
	"contact_phone" varchar,
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"driver_id" uuid,
	"vehicle_id" varchar,
	"actual_delivery_time" timestamp,
	"delivery_notes" text,
	"signature_url" varchar,
	"photo_urls" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demo_equipment_requirements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demo_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"equipment_type" varchar NOT NULL,
	"manufacturer" varchar,
	"model" varchar NOT NULL,
	"serial_number" varchar,
	"required_features" jsonb DEFAULT '[]'::jsonb,
	"special_configuration" text,
	"accessories_needed" jsonb DEFAULT '[]'::jsonb,
	"transport_required" boolean DEFAULT false,
	"setup_time" integer DEFAULT 30,
	"teardown_time" integer DEFAULT 15,
	"is_available" boolean DEFAULT true,
	"current_location" varchar,
	"available_from" timestamp,
	"available_until" timestamp,
	"status" varchar DEFAULT 'required',
	"reserved_by" varchar,
	"reserved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demo_outcomes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"demo_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"overall_outcome" varchar NOT NULL,
	"customer_interest_level" varchar,
	"decision_timeframe" varchar,
	"budget_confirmed" boolean DEFAULT false,
	"decision_maker_present" boolean DEFAULT false,
	"features_of_interest" jsonb DEFAULT '[]'::jsonb,
	"concerns" jsonb DEFAULT '[]'::jsonb,
	"competitive_situation" text,
	"price_expectations" text,
	"product_fit_rating" integer,
	"price_value_rating" integer,
	"service_rating" integer,
	"overall_satisfaction" integer,
	"immediate_next_steps" text,
	"proposal_requested" boolean DEFAULT false,
	"proposal_deadline" timestamp,
	"additional_info_needed" text,
	"next_meeting_scheduled" boolean DEFAULT false,
	"next_meeting_date" timestamp,
	"next_meeting_type" varchar,
	"stakeholders_to_involve" jsonb DEFAULT '[]'::jsonb,
	"probability_assessment" integer,
	"expected_close_date" timestamp,
	"estimated_value" numeric(10, 2),
	"confidence" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "demo_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"business_record_id" varchar NOT NULL,
	"customer_name" varchar NOT NULL,
	"contact_person" varchar NOT NULL,
	"contact_email" varchar,
	"contact_phone" varchar,
	"demo_type" varchar NOT NULL,
	"demo_title" varchar,
	"demo_description" text,
	"demo_objectives" text,
	"scheduled_date" timestamp NOT NULL,
	"scheduled_time" varchar NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"time_zone" varchar DEFAULT 'America/New_York',
	"demo_location" varchar NOT NULL,
	"customer_address" text,
	"showroom_location" varchar,
	"virtual_meeting_link" varchar,
	"virtual_meeting_id" varchar,
	"virtual_platform" varchar,
	"equipment_models" jsonb DEFAULT '[]'::jsonb,
	"product_categories" jsonb DEFAULT '[]'::jsonb,
	"software_features" jsonb DEFAULT '[]'::jsonb,
	"assigned_sales_rep" varchar NOT NULL,
	"assigned_technician" varchar,
	"backup_sales_rep" varchar,
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"confirmation_status" varchar DEFAULT 'pending',
	"confirmation_date" timestamp,
	"confirmation_method" varchar,
	"preparation_completed" boolean DEFAULT false,
	"preparation_notes" text,
	"special_requirements" text,
	"equipment_to_transport" jsonb DEFAULT '[]'::jsonb,
	"materials_needed" jsonb DEFAULT '[]'::jsonb,
	"proposal_amount" numeric(10, 2),
	"proposal_id" varchar,
	"expected_close_date" timestamp,
	"probability" integer DEFAULT 50,
	"demo_completed" boolean DEFAULT false,
	"customer_feedback" text,
	"customer_satisfaction" integer,
	"follow_up_required" boolean DEFAULT true,
	"follow_up_date" timestamp,
	"follow_up_method" varchar,
	"next_steps" text,
	"resulting_proposal_id" varchar,
	"resulting_sale_id" varchar,
	"conversion_value" numeric(10, 2),
	"conversion_date" timestamp,
	"lost_reason" varchar,
	"competitor_information" text,
	"original_scheduled_date" timestamp,
	"reschedule_count" integer DEFAULT 0,
	"reschedule_reason" varchar,
	"reschedule_history" jsonb DEFAULT '[]'::jsonb,
	"external_event_id" varchar,
	"calendar_provider" varchar,
	"calendar_event_link" varchar,
	"attendees_notified" boolean DEFAULT false,
	"calendar_sync_status" varchar DEFAULT 'pending',
	"last_calendar_sync" timestamp,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_date" timestamp,
	"communication_history" jsonb DEFAULT '[]'::jsonb,
	"internal_notes" text,
	"sales_notes" text,
	"technician_notes" text,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"collection_timestamp" timestamp NOT NULL,
	"total_impressions" integer,
	"bw_impressions" integer,
	"color_impressions" integer,
	"large_impressions" integer,
	"device_status" "device_status" DEFAULT 'unknown',
	"toner_levels" jsonb DEFAULT '{}'::jsonb,
	"paper_levels" jsonb DEFAULT '{}'::jsonb,
	"error_codes" text[],
	"response_time" integer,
	"uptime" numeric(5, 2),
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"device_name" varchar(255),
	"model" varchar(255),
	"serial_number" varchar(255),
	"ip_address" varchar(45),
	"mac_address" varchar(17),
	"location" varchar(255),
	"department" varchar(255),
	"status" "device_status" DEFAULT 'unknown' NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"last_seen" timestamp,
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"document_number" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"agreement_number" varchar,
	"buyer_name" varchar,
	"buyer_address" text,
	"ship_to_name" varchar,
	"ship_to_address" text,
	"po_number" varchar,
	"order_date" timestamp,
	"line_items" jsonb,
	"include_service_contract" boolean DEFAULT false,
	"service_term" integer,
	"service_start_date" timestamp,
	"auto_renewal" boolean DEFAULT false,
	"minimum_black_prints" integer,
	"minimum_color_prints" integer,
	"black_rate" numeric(10, 4),
	"color_rate" numeric(10, 4),
	"monthly_base" numeric(10, 2),
	"include_consumables" boolean DEFAULT false,
	"include_black_supplies" boolean DEFAULT false,
	"include_color_supplies" boolean DEFAULT false,
	"payment_terms" varchar,
	"warranty_terms" text,
	"special_terms" text,
	"authorized_signer_title" varchar,
	"customer_name" varchar,
	"status" varchar DEFAULT 'draft',
	"created_by" varchar NOT NULL,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_commission_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"employee_id" varchar NOT NULL,
	"plan_id" varchar NOT NULL,
	"effective_date" timestamp NOT NULL,
	"end_date" timestamp,
	"quota_target" numeric(15, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"custom_rates" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_employee_id" varchar,
	"employee_number" varchar,
	"last_sync_date" timestamp,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"work_email" varchar,
	"work_phone" varchar,
	"mobile_phone" varchar,
	"department" varchar,
	"job_title" varchar,
	"hire_date" timestamp,
	"termination_date" timestamp,
	"manager_id" varchar,
	"assigned_territory" varchar,
	"commission_rate" numeric(5, 4),
	"hourly_labor_rate" numeric(10, 2),
	"technician_certification_level" varchar,
	"is_active" boolean DEFAULT true,
	"employee_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "employees_employee_number_unique" UNIQUE("employee_number")
);
--> statement-breakpoint
CREATE TABLE "enabled_products" (
	"enabled_product_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"master_product_id" varchar,
	"source" varchar DEFAULT 'master_catalog' NOT NULL,
	"enabled" boolean DEFAULT true,
	"custom_sku" varchar,
	"custom_name" varchar,
	"dealer_cost" numeric(10, 2),
	"company_price" numeric(10, 2),
	"markup_rule_id" varchar,
	"price_overridden" boolean DEFAULT false,
	"enabled_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "encrypted_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"table_name" varchar(255) NOT NULL,
	"record_id" uuid NOT NULL,
	"field_name" varchar(255) NOT NULL,
	"encrypted_value" text NOT NULL,
	"encryption_iv" varchar(255) NOT NULL,
	"encryption_tag" varchar(255) NOT NULL,
	"encryption_algorithm" varchar(50) DEFAULT 'aes-256-gcm' NOT NULL,
	"key_version" varchar(50) DEFAULT 'v1' NOT NULL,
	"encrypted_at" timestamp DEFAULT now() NOT NULL,
	"access_level" "data_classification" DEFAULT 'confidential' NOT NULL,
	"retention_period_days" integer,
	"original_data_type" varchar(50),
	"field_category" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enhanced_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_contact_id" varchar,
	"external_account_id" varchar,
	"external_lead_id" varchar,
	"migration_status" varchar,
	"last_sync_date" timestamp,
	"first_name" varchar,
	"last_name" varchar,
	"full_name" varchar,
	"salutation" varchar,
	"suffix" varchar,
	"title" varchar,
	"department" varchar,
	"company_id" varchar,
	"company_name" varchar,
	"email" varchar,
	"work_phone" varchar,
	"mobile_phone" varchar,
	"home_phone" varchar,
	"other_phone" varchar,
	"fax" varchar,
	"reports_to_contact_id" varchar,
	"contact_level" varchar,
	"contact_role" varchar,
	"is_decision_maker" boolean DEFAULT false,
	"is_primary_contact" boolean DEFAULT false,
	"lead_status" varchar,
	"lead_source" varchar,
	"owner_id" varchar,
	"owner_name" varchar,
	"has_opted_out_of_email" boolean DEFAULT false,
	"do_not_call" boolean DEFAULT false,
	"preferred_contact_method" varchar,
	"languages" varchar,
	"mailing_address_line_1" varchar,
	"mailing_city" varchar,
	"mailing_state" varchar,
	"mailing_zip_code" varchar,
	"mailing_country" varchar,
	"birthdate" timestamp,
	"assistant_name" varchar,
	"assistant_phone" varchar,
	"description" text,
	"is_person_account" boolean DEFAULT false,
	"last_contact_date" timestamp,
	"next_follow_up_date" timestamp,
	"last_activity_date" timestamp,
	"favorite_content_type" varchar,
	"preferred_channels" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enhanced_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_product_id" varchar,
	"migration_status" varchar,
	"last_sync_date" timestamp,
	"product_name" varchar NOT NULL,
	"product_code" varchar,
	"description" text,
	"product_family" varchar,
	"category" varchar,
	"subcategory" varchar,
	"product_type" varchar,
	"is_active" boolean DEFAULT true,
	"can_use_quantity_schedule" boolean DEFAULT false,
	"can_use_revenue_schedule" boolean DEFAULT false,
	"quantity_unit_of_measure" varchar,
	"sku" varchar,
	"display_url" varchar,
	"external_data_source_id" varchar,
	"external_id" varchar,
	"manufacturer" varchar,
	"model_number" varchar,
	"specifications" text,
	"warranty_period_months" integer,
	"weight" numeric(10, 2),
	"dimensions" varchar,
	"power_requirements" varchar,
	"monthly_duty_cycle" integer,
	"print_speed_ppm" integer,
	"is_color_capable" boolean DEFAULT false,
	"is_duplex_capable" boolean DEFAULT false,
	"is_network_capable" boolean DEFAULT false,
	"product_cost" numeric(10, 2),
	"msrp" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enhanced_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"organizational_unit_id" varchar,
	"name" varchar(128) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"hierarchy_level" "role_hierarchy_level" NOT NULL,
	"organizational_tier" "organizational_tier" NOT NULL,
	"parent_role_id" varchar,
	"lft" integer NOT NULL,
	"rght" integer NOT NULL,
	"depth" integer NOT NULL,
	"department" varchar(50) NOT NULL,
	"functional_area" varchar(50),
	"is_system_role" boolean DEFAULT false,
	"is_customizable" boolean DEFAULT true,
	"is_template" boolean DEFAULT false,
	"max_direct_reports" integer,
	"territory_scope" varchar(50),
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enriched_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"zoominfo_company_id" varchar,
	"apollo_company_id" varchar,
	"company_name" varchar NOT NULL,
	"website" varchar,
	"primary_domain" varchar,
	"main_phone" varchar,
	"primary_industry" varchar,
	"sub_industry" varchar,
	"employee_count" integer,
	"employee_range" varchar,
	"annual_revenue" numeric,
	"revenue_range" varchar,
	"founded_year" integer,
	"company_type" varchar,
	"stock_ticker" varchar,
	"street_address" varchar,
	"city" varchar,
	"state" varchar,
	"zip_code" varchar,
	"country" varchar,
	"parent_company_id" varchar,
	"parent_company_name" varchar,
	"technologies" jsonb,
	"departments" jsonb,
	"key_executives" jsonb,
	"business_keywords" jsonb,
	"total_funding" numeric,
	"funding_stage" varchar,
	"last_funding_date" timestamp,
	"company_score" integer,
	"target_account_tier" varchar,
	"account_priority" varchar DEFAULT 'medium',
	"enrichment_source" varchar,
	"last_enriched_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enriched_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"zoominfo_contact_id" varchar,
	"apollo_contact_id" varchar,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"full_name" varchar,
	"email" varchar,
	"direct_phone" varchar,
	"mobile_phone" varchar,
	"job_title" varchar,
	"management_level" varchar,
	"department" varchar,
	"sub_department" varchar,
	"job_function" varchar,
	"company_external_id" varchar,
	"company_name" varchar,
	"company_domain" varchar,
	"city" varchar,
	"state" varchar,
	"country" varchar,
	"zip_code" varchar,
	"time_zone" varchar,
	"linkedin_url" varchar,
	"twitter_url" varchar,
	"facebook_url" varchar,
	"person_score" integer,
	"is_verified" boolean DEFAULT false,
	"email_verification_status" varchar,
	"work_history" jsonb,
	"education_history" jsonb,
	"skills" jsonb,
	"prospecting_status" varchar DEFAULT 'new',
	"lead_score" integer,
	"priority_level" varchar DEFAULT 'medium',
	"enrichment_source" varchar,
	"last_enriched_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enriched_intent_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"company_external_id" varchar NOT NULL,
	"company_name" varchar,
	"intent_topic" varchar,
	"topic_category" varchar,
	"intent_score" integer,
	"intent_level" varchar,
	"buying_stage" varchar,
	"decision_timeframe" varchar,
	"is_trending" boolean DEFAULT false,
	"first_seen_date" timestamp,
	"last_activity_date" timestamp,
	"days_active" integer,
	"intent_keywords" jsonb,
	"research_areas" jsonb,
	"competitor_activity" jsonb,
	"sales_opportunity_score" integer,
	"recommended_actions" jsonb,
	"optimal_timing_window" varchar,
	"data_source" varchar DEFAULT 'zoominfo',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enriched_org_hierarchy" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"company_external_id" varchar NOT NULL,
	"person_external_id" varchar NOT NULL,
	"manager_person_id" varchar,
	"department_name" varchar,
	"organizational_level" integer,
	"team_size" integer,
	"direct_reports_count" integer,
	"decision_making_power" varchar,
	"has_budget_authority" boolean DEFAULT false,
	"procurement_influence_level" varchar,
	"influence_score" integer,
	"accessibility_score" integer,
	"hierarchy_path" jsonb,
	"peer_contacts" jsonb,
	"subordinate_contacts" jsonb,
	"data_source" varchar DEFAULT 'zoominfo',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enrichment_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contact_id" varchar,
	"company_id" varchar,
	"activity_type" varchar NOT NULL,
	"activity_subtype" varchar,
	"activity_description" text,
	"outcome" varchar,
	"outcome_details" text,
	"campaign_name" varchar,
	"sequence_step" integer,
	"follow_up_required" boolean DEFAULT false,
	"next_action_date" timestamp,
	"next_action_type" varchar,
	"response_time_hours" integer,
	"engagement_score" integer,
	"lead_quality_score" integer,
	"assigned_user_id" varchar,
	"completed_by_user_id" varchar,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_equipment_id" varchar,
	"external_customer_id" varchar,
	"last_sync_date" timestamp,
	"serial_number" varchar,
	"model_number" varchar,
	"manufacturer" varchar,
	"description" text,
	"asset_tag" varchar,
	"customer_id" varchar NOT NULL,
	"location_description" text,
	"install_date" timestamp,
	"ip_address" varchar,
	"meter_type" varchar,
	"is_color_capable" boolean DEFAULT false,
	"equipment_status" varchar DEFAULT 'active',
	"purchase_price" numeric(10, 2),
	"monthly_payment" numeric(10, 2),
	"lease_expires_date" timestamp,
	"warranty_expires_date" timestamp,
	"service_contract_number" varchar,
	"last_service_date" timestamp,
	"next_service_due_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "equipment_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "equipment_lifecycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"manufacturer" varchar(100),
	"model" varchar(100),
	"qr_code" varchar(255),
	"current_stage" varchar DEFAULT 'ordered' NOT NULL,
	"current_location" varchar,
	"customer_id" uuid,
	"purchase_order_id" uuid,
	"warranty_start_date" timestamp,
	"warranty_end_date" timestamp,
	"warranty_registered" boolean DEFAULT false,
	"last_service_date" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "equipment_lifecycle_equipment_id_unique" UNIQUE("equipment_id")
);
--> statement-breakpoint
CREATE TABLE "equipment_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"package_name" varchar NOT NULL,
	"package_code" varchar,
	"category" varchar,
	"description" text,
	"equipment" jsonb,
	"accessories" jsonb,
	"services" jsonb,
	"total_value" numeric,
	"discount_percentage" numeric,
	"margin_percentage" numeric,
	"is_active" boolean DEFAULT true,
	"allow_customization" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forecast_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"total_pipeline_value" numeric(12, 2),
	"weighted_pipeline_value" numeric(12, 2),
	"commit_revenue" numeric(12, 2),
	"best_case_revenue" numeric(12, 2),
	"worst_case_revenue" numeric(12, 2),
	"total_deals" integer,
	"new_deals" integer,
	"advanced_deals" integer,
	"closed_won_deals" integer,
	"closed_lost_deals" integer,
	"conversion_rate" numeric(5, 2),
	"average_deal_size" numeric(10, 2),
	"average_sales_cycle" integer,
	"velocity_score" numeric(8, 2),
	"stage_distribution" jsonb,
	"pipeline_trend" varchar,
	"velocity_trend" varchar,
	"quality_trend" varchar,
	"territory_metrics" jsonb,
	"calculated_by" varchar,
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forecast_pipeline_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"business_record_id" varchar NOT NULL,
	"deal_name" varchar NOT NULL,
	"customer_name" varchar NOT NULL,
	"deal_value" numeric(10, 2) NOT NULL,
	"weighted_value" numeric(10, 2),
	"probability" integer DEFAULT 50,
	"expected_close_date" timestamp,
	"actual_close_date" timestamp,
	"days_in_pipeline" integer,
	"sales_stage" varchar NOT NULL,
	"stage_progress" integer DEFAULT 0,
	"next_milestone" varchar,
	"next_milestone_date" timestamp,
	"assigned_sales_rep" varchar NOT NULL,
	"sales_team" varchar,
	"product_category" varchar,
	"equipment_type" varchar,
	"service_type" varchar,
	"quantity" integer DEFAULT 1,
	"competitor_involved" boolean DEFAULT false,
	"primary_competitor" varchar,
	"competitive_advantage" text,
	"risk_level" varchar DEFAULT 'medium',
	"risk_factors" jsonb DEFAULT '[]'::jsonb,
	"mitigation_strategies" text,
	"last_activity_date" timestamp,
	"next_activity_date" timestamp,
	"activity_count" integer DEFAULT 0,
	"outcome" varchar,
	"lost_reason" varchar,
	"actual_revenue" numeric(10, 2),
	"included_in_forecast" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forecast_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"rule_name" varchar NOT NULL,
	"rule_type" varchar NOT NULL,
	"description" text,
	"conditions" jsonb,
	"actions" jsonb,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"frequency" varchar DEFAULT 'daily',
	"last_executed" timestamp,
	"execution_count" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fpy_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_operations" integer NOT NULL,
	"first_pass_operations" integer NOT NULL,
	"fpy_percentage" numeric(5, 2) NOT NULL,
	"fpy_by_technician" jsonb DEFAULT '{}'::jsonb,
	"fpy_by_equipment_type" jsonb DEFAULT '{}'::jsonb,
	"top_defect_types" jsonb DEFAULT '[]'::jsonb,
	"rework_rate" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gdpr_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "gdpr_request_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"subject_email" varchar(255) NOT NULL,
	"requestor_id" uuid NOT NULL,
	"description" text NOT NULL,
	"legal_basis" text,
	"processing_purpose" text,
	"status" "gdpr_status" DEFAULT 'pending' NOT NULL,
	"priority" "audit_severity" DEFAULT 'medium' NOT NULL,
	"due_date" timestamp NOT NULL,
	"completion_date" timestamp,
	"rejection_reason" text,
	"data_categories" jsonb NOT NULL,
	"affected_systems" jsonb NOT NULL,
	"identity_verified" boolean DEFAULT false,
	"verification_method" varchar(100),
	"verification_date" timestamp,
	"response_data" jsonb,
	"response_format" varchar(50),
	"response_size_bytes" integer,
	"processing_notes" text,
	"approved_by" uuid,
	"approval_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gl_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"account_number" varchar(50),
	"account_description" text,
	"fully_qualified_name" varchar(500),
	"is_active" boolean DEFAULT true,
	"is_sub_account" boolean DEFAULT false,
	"parent_account_id" varchar,
	"account_classification" varchar(50),
	"account_type" varchar(100),
	"account_sub_type" varchar(100),
	"bank_account_number" varchar,
	"routing_number" varchar,
	"opening_balance" numeric(15, 2) DEFAULT '0.00',
	"opening_balance_date" timestamp,
	"current_balance" numeric(15, 2) DEFAULT '0.00',
	"current_balance_with_sub_accounts" numeric(15, 2) DEFAULT '0.00',
	"currency_id" varchar,
	"tax_code_id" varchar,
	"account_alias" varchar,
	"is_tax_account" boolean DEFAULT false,
	"external_account_id" varchar,
	"qb_domain" varchar,
	"is_sparse" boolean DEFAULT false,
	"sync_token" varchar,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goal_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"goal_id" varchar NOT NULL,
	"report_date" timestamp NOT NULL,
	"current_count" integer DEFAULT 0,
	"target_count" integer NOT NULL,
	"progress_percentage" numeric(5, 2),
	"daily_average" numeric(10, 2),
	"projected_total" integer,
	"on_track" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "installation_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"estimated_duration" integer,
	"installation_type" varchar NOT NULL,
	"site_requirements" jsonb,
	"pre_installation_checklist" jsonb,
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"actual_start_time" timestamp,
	"actual_end_time" timestamp,
	"installation_notes" text,
	"customer_signature" varchar,
	"installation_photos" jsonb,
	"configuration_backup" jsonb,
	"training_provided" boolean DEFAULT false,
	"customer_satisfaction_rating" integer,
	"follow_up_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"integration_id" uuid,
	"device_id" uuid,
	"action" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"message" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"response_time" integer,
	"error_code" varchar(50),
	"user_id" uuid,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_item_id" varchar,
	"last_sync_date" timestamp,
	"part_number" varchar,
	"manufacturer_part_number" varchar,
	"item_description" text,
	"item_category" varchar,
	"manufacturer" varchar,
	"quantity_on_hand" integer DEFAULT 0,
	"quantity_committed" integer DEFAULT 0,
	"quantity_available" integer DEFAULT 0,
	"quantity_on_order" integer DEFAULT 0,
	"reorder_point" integer DEFAULT 0,
	"reorder_quantity" integer DEFAULT 0,
	"max_stock_level" integer,
	"unit_cost" numeric(10, 4),
	"average_cost" numeric(10, 4),
	"last_cost" numeric(10, 4),
	"unit_price" numeric(10, 4),
	"retail_price" numeric(10, 4),
	"warehouse_location" varchar,
	"bin_location" varchar,
	"primary_vendor" varchar,
	"vendor_part_number" varchar,
	"unit_of_measure" varchar DEFAULT 'EA',
	"item_weight" numeric(8, 3),
	"is_taxable" boolean DEFAULT true,
	"is_serialized" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"last_sold_date" timestamp,
	"last_received_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "inventory_items_part_number_unique" UNIQUE("part_number")
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_line_item_id" varchar,
	"external_invoice_id" varchar,
	"external_item_id" varchar,
	"external_equipment_id" varchar,
	"invoice_id" varchar NOT NULL,
	"equipment_id" varchar,
	"meter_reading_id" varchar,
	"line_description" text,
	"quantity" integer DEFAULT 0,
	"unit_price" numeric(10, 4),
	"extended_price" numeric(10, 2),
	"discount_percent" numeric(5, 2),
	"discount_amount" numeric(10, 2),
	"tax_rate" numeric(5, 4),
	"tax_amount" numeric(10, 2),
	"line_total" numeric(10, 2),
	"gl_account_code" varchar,
	"serial_number" varchar,
	"meter_start_reading" integer,
	"meter_end_reading" integer,
	"meter_usage" integer,
	"billing_type" varchar,
	"description" varchar,
	"rate" numeric(10, 4) DEFAULT '0',
	"amount" numeric(10, 2),
	"line_type" varchar DEFAULT 'meter',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_invoice_id" varchar,
	"external_customer_id" varchar,
	"last_sync_date" timestamp,
	"customer_id" varchar NOT NULL,
	"contract_id" varchar,
	"invoice_number" varchar,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"po_number" varchar,
	"sales_rep" varchar,
	"invoice_type" varchar DEFAULT 'sales',
	"subtotal_amount" numeric(10, 2),
	"tax_amount" numeric(10, 2),
	"total_amount" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0',
	"balance_due" numeric(10, 2),
	"invoice_status" varchar DEFAULT 'open',
	"payment_terms" varchar,
	"billing_period_start" timestamp,
	"billing_period_end" timestamp,
	"monthly_base" numeric(10, 2) DEFAULT '0',
	"black_copies_total" integer DEFAULT 0,
	"color_copies_total" integer DEFAULT 0,
	"black_amount" numeric(10, 2) DEFAULT '0',
	"color_amount" numeric(10, 2) DEFAULT '0',
	"status" varchar DEFAULT 'draft',
	"paid_date" timestamp,
	"issuance_delay_hours" integer DEFAULT 0,
	"issued_at" timestamp,
	"invoice_notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "lead_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"title" varchar,
	"department" varchar,
	"phone" varchar,
	"email" varchar,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lead_related_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"record_type" varchar NOT NULL,
	"record_id" varchar NOT NULL,
	"record_title" varchar,
	"record_count" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "location_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"session_id" varchar,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy" numeric(6, 2),
	"address" text,
	"timestamp" timestamp DEFAULT now(),
	"speed" numeric(5, 2),
	"heading" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"address" varchar,
	"city" varchar,
	"state" varchar(2),
	"zip_code" varchar(10),
	"phone" varchar,
	"email" varchar,
	"location_type" varchar(30) DEFAULT 'branch',
	"is_headquarters" boolean DEFAULT false,
	"region_id" varchar,
	"location_manager_id" varchar,
	"is_active" boolean DEFAULT true,
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "managed_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"category" varchar DEFAULT 'IT Services',
	"service_type" varchar,
	"service_level" varchar,
	"description" text,
	"summary" text,
	"note" text,
	"ea_notes" text,
	"config_note" text,
	"related_products" text,
	"support_hours" varchar,
	"response_time" varchar,
	"includes_hardware" boolean DEFAULT false,
	"remote_mgmt" boolean DEFAULT false,
	"onsite_support" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"repost_edit" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT true,
	"funding" boolean DEFAULT true,
	"lease" boolean DEFAULT false,
	"payment_type" varchar,
	"new_active" boolean DEFAULT false,
	"new_rep_price" numeric,
	"upgrade_active" boolean DEFAULT false,
	"upgrade_rep_price" numeric,
	"lexmark_active" boolean DEFAULT false,
	"lexmark_rep_price" numeric,
	"graphic_active" boolean DEFAULT false,
	"graphic_rep_price" numeric,
	"price_book_id" varchar,
	"temp_key" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "manager_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"manager_id" varchar NOT NULL,
	"team_id" varchar,
	"user_id" varchar,
	"insight_type" varchar NOT NULL,
	"insight_category" varchar NOT NULL,
	"current_performance" numeric(10, 2),
	"target_performance" numeric(10, 2),
	"performance_gap" numeric(10, 2),
	"recommended_actions" jsonb,
	"priority_level" varchar NOT NULL,
	"expected_impact" varchar,
	"timeframe" varchar,
	"insight_title" varchar NOT NULL,
	"insight_description" text,
	"supporting_data" jsonb,
	"is_active" boolean DEFAULT true,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "manufacturer_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"manufacturer" "manufacturer" NOT NULL,
	"integration_name" varchar(255) NOT NULL,
	"status" "integration_status" DEFAULT 'pending' NOT NULL,
	"auth_method" "auth_method" NOT NULL,
	"credentials" jsonb NOT NULL,
	"api_endpoint" varchar(500),
	"collection_frequency" "collection_frequency" DEFAULT 'daily' NOT NULL,
	"last_sync" timestamp,
	"next_sync" timestamp,
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_product_accessories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manufacturer" varchar NOT NULL,
	"accessory_code" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"specs_json" jsonb,
	"msrp" numeric(10, 2),
	"category" varchar,
	"status" varchar DEFAULT 'active' NOT NULL,
	"discontinued_at" timestamp,
	"version" varchar DEFAULT '1.0' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "master_product_accessory_relationships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_product_id" varchar NOT NULL,
	"accessory_id" varchar NOT NULL,
	"relationship_type" varchar DEFAULT 'compatible' NOT NULL,
	"category" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "master_product_models" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manufacturer" varchar NOT NULL,
	"model_code" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"specs_json" jsonb,
	"msrp" numeric(10, 2),
	"dealer_cost" numeric(10, 2),
	"margin_percentage" numeric(5, 2),
	"status" varchar DEFAULT 'active' NOT NULL,
	"discontinued_at" timestamp,
	"version" varchar DEFAULT '1.0' NOT NULL,
	"category" varchar,
	"product_type" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meter_readings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_reading_id" varchar,
	"external_equipment_id" varchar,
	"last_sync_date" timestamp,
	"equipment_id" varchar NOT NULL,
	"contract_id" varchar,
	"reading_date" timestamp NOT NULL,
	"bw_meter_reading" integer,
	"color_meter_reading" integer,
	"scan_meter_reading" integer,
	"fax_meter_reading" integer,
	"large_paper_meter_reading" integer,
	"previous_black_meter" integer DEFAULT 0,
	"previous_color_meter" integer DEFAULT 0,
	"black_copies" integer DEFAULT 0,
	"color_copies" integer DEFAULT 0,
	"reading_method" varchar DEFAULT 'manual',
	"collection_method" varchar DEFAULT 'manual',
	"dca_device_id" varchar,
	"dca_last_sync" timestamp,
	"dca_error" text,
	"email_source" varchar,
	"email_subject" varchar,
	"email_timestamp" timestamp,
	"api_source" varchar,
	"api_response_id" varchar,
	"technician_id" varchar,
	"is_verified" boolean DEFAULT false,
	"verified_by" varchar,
	"verified_at" timestamp,
	"has_exception" boolean DEFAULT false,
	"exception_reason" varchar,
	"exception_notes" text,
	"adjustment_amount" numeric(10, 2) DEFAULT '0',
	"billing_period" varchar,
	"billing_status" varchar DEFAULT 'pending',
	"invoice_number" varchar,
	"invoice_id" varchar,
	"billing_amount" numeric(10, 2),
	"reading_notes" text,
	"notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mobile_service_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"service_ticket_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"check_in_latitude" numeric(10, 7),
	"check_in_longitude" numeric(10, 7),
	"check_in_address" text,
	"check_in_timestamp" timestamp,
	"check_out_latitude" numeric(10, 7),
	"check_out_longitude" numeric(10, 7),
	"check_out_address" text,
	"check_out_timestamp" timestamp,
	"total_hours" numeric(4, 2),
	"break_hours" numeric(4, 2),
	"working_hours" numeric(4, 2),
	"status" "field_service_status" DEFAULT 'scheduled',
	"service_notes" text,
	"customer_signature" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_checklists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"quote_id" varchar,
	"order_id" varchar,
	"checklist_title" varchar NOT NULL,
	"description" text,
	"status" "onboarding_status" DEFAULT 'draft',
	"installation_type" "installation_type" NOT NULL,
	"customer_data" jsonb,
	"site_information" jsonb,
	"equipment_details" jsonb,
	"scheduled_install_date" timestamp,
	"actual_install_date" timestamp,
	"assigned_technician_id" varchar,
	"estimated_duration" integer,
	"access_requirements" text,
	"business_hours" jsonb,
	"special_instructions" text,
	"pdf_url" varchar,
	"pdf_generated_at" timestamp,
	"completed_sections" integer DEFAULT 0,
	"total_sections" integer DEFAULT 0,
	"progress_percentage" numeric(5, 2) DEFAULT '0',
	"created_by" varchar NOT NULL,
	"last_modified_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_dynamic_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"checklist_id" varchar NOT NULL,
	"section_title" varchar NOT NULL,
	"section_description" text,
	"section_order" integer DEFAULT 0,
	"section_type" varchar NOT NULL,
	"fields_config" jsonb,
	"form_data" jsonb,
	"is_required" boolean DEFAULT false,
	"is_completed" boolean DEFAULT false,
	"completed_by" varchar,
	"completed_at" timestamp,
	"notes" text,
	"attachments" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"checklist_id" varchar NOT NULL,
	"equipment_id" varchar,
	"manufacturer" varchar NOT NULL,
	"model" varchar NOT NULL,
	"serial_number" varchar,
	"asset_tag" varchar,
	"target_ip_address" varchar,
	"hostname" varchar,
	"mac_address" varchar,
	"network_assignment" "network_assignment",
	"building_location" varchar,
	"room_location" varchar,
	"specific_location" text,
	"is_replacement" boolean DEFAULT false,
	"old_equipment_data" jsonb,
	"is_installed" boolean DEFAULT false,
	"install_date" timestamp,
	"install_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_network_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"checklist_id" varchar NOT NULL,
	"equipment_id" varchar,
	"ip_address" varchar,
	"subnet_mask" varchar,
	"gateway" varchar,
	"dns_servers" text[],
	"vlan_id" integer,
	"switch_port" varchar,
	"switch_location" varchar,
	"domain_name" varchar,
	"hostname_convention" varchar,
	"dns_update_required" boolean DEFAULT false,
	"firewall_rules" jsonb,
	"qos_settings" jsonb,
	"is_configured" boolean DEFAULT false,
	"configuration_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_print_management" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"checklist_id" varchar NOT NULL,
	"equipment_id" varchar,
	"system" "print_management_system" NOT NULL,
	"system_version" varchar,
	"server_address" varchar,
	"queue_name" varchar,
	"cost_center" varchar,
	"location_code" varchar,
	"device_type" varchar,
	"authorized_groups" text[],
	"print_quotas" jsonb,
	"print_restrictions" jsonb,
	"account_codes_required" boolean DEFAULT false,
	"valid_account_codes" text[],
	"default_account_code" varchar,
	"is_configured" boolean DEFAULT false,
	"configuration_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"checklist_id" varchar NOT NULL,
	"section_id" varchar,
	"task_title" varchar NOT NULL,
	"task_description" text,
	"task_type" varchar NOT NULL,
	"priority" varchar DEFAULT 'medium',
	"assigned_to" varchar,
	"assigned_team" varchar,
	"estimated_hours" numeric(4, 2),
	"due_date" timestamp,
	"scheduled_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"depends_on" text[],
	"blocked_by" text[],
	"status" varchar DEFAULT 'pending',
	"progress_notes" text,
	"completion_notes" text,
	"attachments" text[],
	"verified_by" varchar,
	"verification_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_opportunity_id" varchar,
	"external_account_id" varchar,
	"migration_status" varchar,
	"last_sync_date" timestamp,
	"opportunity_name" varchar NOT NULL,
	"account_id" varchar,
	"account_name" varchar,
	"stage_name" varchar NOT NULL,
	"amount" numeric(15, 2),
	"probability" integer DEFAULT 50,
	"close_date" timestamp,
	"opportunity_type" varchar,
	"lead_source" varchar,
	"campaign_id" varchar,
	"is_won" boolean DEFAULT false,
	"is_closed" boolean DEFAULT false,
	"is_private" boolean DEFAULT false,
	"owner_id" varchar,
	"owner_name" varchar,
	"description" text,
	"next_step" text,
	"forecast_category" varchar,
	"expected_revenue" numeric(15, 2),
	"total_quantity" numeric(10, 2),
	"has_line_items" boolean DEFAULT false,
	"price_book_id" varchar,
	"main_competitors" text,
	"delivery_status" varchar,
	"tracking_number" varchar,
	"order_number" varchar,
	"current_situation" text,
	"product_type" varchar,
	"financing_type" varchar,
	"monthly_payment" numeric(10, 2),
	"lease_term_months" integer,
	"commission_rate" numeric(5, 4),
	"gross_margin_percent" numeric(5, 2),
	"territory" varchar,
	"partner_account_id" varchar,
	"last_activity_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizational_units" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"parent_unit_id" varchar,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"unit_type" "organizational_tier" NOT NULL,
	"description" text,
	"lft" integer NOT NULL,
	"rght" integer NOT NULL,
	"depth" integer NOT NULL,
	"address" text,
	"city" varchar(100),
	"state" varchar(2),
	"zip_code" varchar(10),
	"phone" varchar(20),
	"email" varchar(255),
	"manager_id" varchar,
	"is_active" boolean DEFAULT true,
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "parts_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"part_number" varchar(100) NOT NULL,
	"part_name" varchar(255) NOT NULL,
	"part_description" text,
	"quantity_ordered" integer NOT NULL,
	"quantity_received" integer DEFAULT 0,
	"quantity_backordered" integer DEFAULT 0,
	"unit_price" numeric(10, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"line_total" numeric(10, 2) NOT NULL,
	"item_status" "parts_order_status" DEFAULT 'pending' NOT NULL,
	"expected_date" timestamp,
	"received_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"service_ticket_id" uuid NOT NULL,
	"order_number" varchar(100) NOT NULL,
	"vendor_id" uuid,
	"vendor_name" varchar(255) NOT NULL,
	"status" "parts_order_status" DEFAULT 'pending' NOT NULL,
	"order_date" timestamp NOT NULL,
	"expected_delivery_date" timestamp,
	"actual_delivery_date" timestamp,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0',
	"shipping" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"rush_order" boolean DEFAULT false,
	"special_instructions" text,
	"delivery_address" text,
	"tracking_number" varchar(100),
	"follow_up_ticket_id" uuid,
	"installation_scheduled" boolean DEFAULT false,
	"installation_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"payment_method_name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"payment_method_type" varchar(50),
	"external_payment_method_id" varchar,
	"qb_domain" varchar,
	"is_sparse" boolean DEFAULT false,
	"sync_token" varchar,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"term_name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true,
	"term_type" varchar(50),
	"due_days" integer,
	"discount_percent" numeric(5, 4),
	"discount_days" integer,
	"day_of_month_due" integer,
	"due_next_month_days" integer,
	"discount_day_of_month" integer,
	"external_term_id" varchar,
	"qb_domain" varchar,
	"is_sparse" boolean DEFAULT false,
	"sync_token" varchar,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"metric_type" varchar NOT NULL,
	"value" numeric(10, 4) NOT NULL,
	"unit" varchar NOT NULL,
	"endpoint" varchar,
	"timestamp" timestamp DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "permission_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"organizational_context" varchar NOT NULL,
	"effective_permissions" jsonb NOT NULL,
	"permission_hash" varchar(64) NOT NULL,
	"computed_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"cache_version" integer DEFAULT 1,
	"computation_time" integer,
	"cache_hits" integer DEFAULT 0,
	"tenant_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"effect" "permission_effect" NOT NULL,
	"override_reason" text NOT NULL,
	"business_justification" text NOT NULL,
	"requested_by" varchar NOT NULL,
	"approved_by" varchar,
	"approval_date" timestamp,
	"effective_from" timestamp DEFAULT now(),
	"effective_until" timestamp,
	"tenant_id" varchar NOT NULL,
	"organizational_unit_id" varchar,
	"requires_review" boolean DEFAULT true,
	"next_review_date" timestamp,
	"last_review_date" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"module" varchar(50) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"scope_level" varchar(50) NOT NULL,
	"requires_approval" boolean DEFAULT false,
	"requires_mfa" boolean DEFAULT false,
	"risk_level" varchar(20) DEFAULT 'low',
	"compliance_level" varchar(20) DEFAULT 'standard',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "permissions_name_unique" UNIQUE("name"),
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "phone_in_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"caller_name" varchar NOT NULL,
	"caller_phone" varchar NOT NULL,
	"caller_email" varchar,
	"caller_role" varchar,
	"customer_id" varchar,
	"customer_name" varchar NOT NULL,
	"location_address" text NOT NULL,
	"location_building" varchar,
	"location_floor" varchar,
	"location_room" varchar,
	"equipment_id" varchar,
	"equipment_brand" varchar,
	"equipment_model" varchar,
	"equipment_serial" varchar,
	"issue_category" "issue_category" NOT NULL,
	"issue_description" text NOT NULL,
	"urgency_level" "ticket_priority" NOT NULL,
	"troubleshooting_attempted" text,
	"error_codes" jsonb DEFAULT '[]'::jsonb,
	"business_impact" text,
	"affected_users" integer,
	"preferred_service_time" varchar,
	"contact_method" "contact_method" NOT NULL,
	"special_instructions" text,
	"handled_by" varchar NOT NULL,
	"call_duration_minutes" integer,
	"converted_to_ticket_id" varchar,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_accessories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"accessory_code" varchar NOT NULL,
	"accessory_name" varchar NOT NULL,
	"accessory_type" varchar,
	"category" varchar,
	"manufacturer" varchar,
	"description" text,
	"standard_cost" numeric(10, 2),
	"standard_rep_price" numeric(10, 2),
	"new_cost" numeric(10, 2),
	"new_rep_price" numeric(10, 2),
	"upgrade_cost" numeric(10, 2),
	"upgrade_rep_price" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT false,
	"funding" boolean DEFAULT false,
	"lease" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_models" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"category" varchar DEFAULT 'MFP',
	"manufacturer" varchar,
	"description" text,
	"msrp" numeric(10, 2),
	"color_mode" varchar,
	"color_speed" varchar,
	"bw_speed" varchar,
	"product_family" varchar,
	"required_accessories" text,
	"new_active" boolean DEFAULT false,
	"new_rep_price" numeric(10, 2),
	"upgrade_active" boolean DEFAULT false,
	"upgrade_rep_price" numeric(10, 2),
	"lexmark_active" boolean DEFAULT false,
	"lexmark_rep_price" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"dealer_cost" numeric(12, 2) NOT NULL,
	"company_markup_percentage" numeric(5, 2),
	"company_price" numeric(12, 2) NOT NULL,
	"minimum_sale_price" numeric(12, 2),
	"suggested_retail_price" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"effective_date" timestamp DEFAULT now(),
	"expiration_date" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "professional_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"category" varchar DEFAULT 'Professional Services',
	"accessory_type" varchar,
	"description" text,
	"summary" text,
	"note" text,
	"ea_notes" text,
	"related_products" text,
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"repost_edit" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT true,
	"funding" boolean DEFAULT true,
	"lease" boolean DEFAULT false,
	"payment_type" varchar,
	"msrp" numeric,
	"new_active" boolean DEFAULT false,
	"new_rep_price" numeric,
	"upgrade_active" boolean DEFAULT false,
	"upgrade_rep_price" numeric,
	"lexmark_active" boolean DEFAULT false,
	"lexmark_rep_price" numeric,
	"graphic_active" boolean DEFAULT false,
	"graphic_rep_price" numeric,
	"manufacturer" varchar,
	"manufacturer_product_code" varchar,
	"model" varchar,
	"units" varchar,
	"environment" varchar,
	"color_mode" varchar,
	"ea_item_number" varchar,
	"price_book_id" varchar,
	"temp_key" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'active' NOT NULL,
	"customer_id" varchar,
	"start_date" timestamp,
	"end_date" timestamp,
	"estimated_hours" integer,
	"actual_hours" integer,
	"budget" numeric(10, 2),
	"completion_percentage" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"event_timestamp" timestamp DEFAULT now(),
	"event_details" jsonb,
	"user_id" varchar,
	"customer_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_id" varchar NOT NULL,
	"approval_level" varchar NOT NULL,
	"required_by" varchar,
	"approved_by" varchar,
	"status" varchar DEFAULT 'pending',
	"approval_comments" text,
	"requested_at" timestamp DEFAULT now(),
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_id" varchar NOT NULL,
	"comment_type" varchar DEFAULT 'general',
	"content" text NOT NULL,
	"author_id" varchar NOT NULL,
	"author_name" varchar NOT NULL,
	"author_role" varchar,
	"is_internal" boolean DEFAULT false,
	"is_resolved" boolean DEFAULT false,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_content_blocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"block_type" varchar NOT NULL,
	"category" varchar,
	"title" varchar,
	"content" text NOT NULL,
	"html_content" text,
	"is_global" boolean DEFAULT false,
	"created_by" varchar NOT NULL,
	"team_id" varchar,
	"tags" jsonb DEFAULT '[]',
	"usage_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_id" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"item_type" varchar NOT NULL,
	"product_id" varchar,
	"product_name" varchar NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1,
	"unit_price" numeric NOT NULL,
	"unit_cost" numeric,
	"total_price" numeric NOT NULL,
	"service_frequency" varchar,
	"service_duration" varchar,
	"equipment_condition" varchar,
	"warranty_info" text,
	"is_optional" boolean DEFAULT false,
	"is_alternative" boolean DEFAULT false,
	"package_id" varchar,
	"specifications" jsonb,
	"alternative_options" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_id" varchar NOT NULL,
	"section_type" varchar NOT NULL,
	"section_title" varchar NOT NULL,
	"display_order" integer NOT NULL,
	"content" text,
	"html_content" text,
	"is_visible" boolean DEFAULT true,
	"is_completed" boolean DEFAULT false,
	"template_section_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_template_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"section_type" varchar NOT NULL,
	"section_title" varchar NOT NULL,
	"display_order" integer NOT NULL,
	"is_required" boolean DEFAULT false,
	"is_visible" boolean DEFAULT true,
	"is_editable" boolean DEFAULT true,
	"default_content" text,
	"settings" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"access_level" varchar DEFAULT 'company',
	"styling" jsonb DEFAULT '{}',
	"created_by" varchar NOT NULL,
	"team_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"proposal_number" varchar NOT NULL,
	"version" varchar DEFAULT '1.0',
	"title" varchar NOT NULL,
	"business_record_id" varchar NOT NULL,
	"contact_id" varchar,
	"created_by" varchar NOT NULL,
	"assigned_to" varchar NOT NULL,
	"team_id" varchar,
	"proposal_type" varchar NOT NULL,
	"description" text,
	"executive_summary" text,
	"company_introduction" text,
	"solution_overview" text,
	"terms_and_conditions" text,
	"investment_summary" text,
	"next_steps" text,
	"subtotal" numeric DEFAULT '0',
	"discount_amount" numeric DEFAULT '0',
	"discount_percentage" numeric DEFAULT '0',
	"tax_amount" numeric DEFAULT '0',
	"total_amount" numeric DEFAULT '0',
	"valid_until" timestamp,
	"estimated_start_date" timestamp,
	"estimated_end_date" timestamp,
	"template_id" varchar,
	"custom_styling" jsonb DEFAULT '{}',
	"status" varchar DEFAULT 'draft',
	"priority" varchar DEFAULT 'medium',
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"open_count" integer DEFAULT 0,
	"last_opened_at" timestamp,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "proposals_proposal_number_unique" UNIQUE("proposal_number")
);
--> statement-breakpoint
CREATE TABLE "prospecting_campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"campaign_name" varchar NOT NULL,
	"campaign_description" text,
	"campaign_type" varchar,
	"target_industries" jsonb,
	"target_company_sizes" jsonb,
	"target_job_titles" jsonb,
	"target_management_levels" jsonb,
	"target_technologies" jsonb,
	"sequence_steps" jsonb,
	"follow_up_cadence" jsonb,
	"personalization_rules" jsonb,
	"total_contacts" integer DEFAULT 0,
	"contacts_reached" integer DEFAULT 0,
	"responses_received" integer DEFAULT 0,
	"meetings_booked" integer DEFAULT 0,
	"opportunities_created" integer DEFAULT 0,
	"response_rate" numeric,
	"meeting_rate" numeric,
	"opportunity_rate" numeric,
	"status" varchar DEFAULT 'draft',
	"start_date" timestamp,
	"end_date" timestamp,
	"campaign_owner_id" varchar,
	"team_members" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"purchase_order_id" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"item_description" text NOT NULL,
	"item_code" varchar,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"received_quantity" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"po_number" varchar NOT NULL,
	"vendor_id" varchar NOT NULL,
	"requested_by" varchar NOT NULL,
	"order_date" timestamp NOT NULL,
	"expected_date" timestamp,
	"description" text,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"shipping_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"delivery_address" text,
	"special_instructions" text,
	"approved_by" varchar,
	"approved_date" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qb_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"vendor_name" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"display_name" varchar(255),
	"print_on_check_name" varchar(255),
	"is_active" boolean DEFAULT true,
	"external_vendor_id" varchar,
	"vendor_type_id" varchar,
	"tax_id" varchar,
	"account_number" varchar,
	"is_1099_vendor" boolean DEFAULT false,
	"currency_id" varchar,
	"ap_account_id" varchar,
	"payment_terms_id" varchar,
	"current_balance" numeric(15, 2) DEFAULT '0.00',
	"open_balance_date" timestamp,
	"credit_limit" numeric(15, 2),
	"primary_phone_json" jsonb,
	"alternate_phone_json" jsonb,
	"mobile_phone_json" jsonb,
	"fax_json" jsonb,
	"primary_email_json" jsonb,
	"website_json" jsonb,
	"billing_address_json" jsonb,
	"vendor_notes" text,
	"qb_domain" varchar,
	"is_sparse" boolean DEFAULT false,
	"sync_token" varchar,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quickbooks_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"qb_company_id" varchar NOT NULL,
	"qb_company_name" varchar,
	"connection_status" varchar(50) DEFAULT 'connected',
	"access_token_hash" text,
	"refresh_token_hash" text,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"last_sync_status" varchar(50),
	"sync_errors" jsonb,
	"customers_synced_at" timestamp,
	"vendors_synced_at" timestamp,
	"items_synced_at" timestamp,
	"invoices_synced_at" timestamp,
	"accounts_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"quote_id" varchar NOT NULL,
	"description" varchar NOT NULL,
	"quantity" integer DEFAULT 1,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar,
	"customer_id" varchar,
	"quote_number" varchar NOT NULL,
	"blanket_gross_profit_percentage" numeric(5, 2) DEFAULT '10.00',
	"apply_blanket_to_all_items" boolean DEFAULT true,
	"total_dealer_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_company_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_sale_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_gross_profit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_gross_profit_percentage" numeric(5, 2) DEFAULT '0',
	"status" varchar DEFAULT 'draft' NOT NULL,
	"created_by" varchar NOT NULL,
	"approved_by" varchar,
	"approved_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_pricing_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"quote_pricing_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"product_name" varchar NOT NULL,
	"product_description" text,
	"product_sku" varchar,
	"quantity" integer DEFAULT 1 NOT NULL,
	"dealer_cost" numeric(12, 2) NOT NULL,
	"company_price" numeric(12, 2) NOT NULL,
	"sale_price" numeric(12, 2) NOT NULL,
	"total_dealer_cost" numeric(12, 2) NOT NULL,
	"total_company_price" numeric(12, 2) NOT NULL,
	"total_sale_price" numeric(12, 2) NOT NULL,
	"unit_gross_profit" numeric(12, 2) NOT NULL,
	"total_gross_profit" numeric(12, 2) NOT NULL,
	"gross_profit_percentage" numeric(5, 2) NOT NULL,
	"use_custom_gross_profit" boolean DEFAULT false,
	"custom_gross_profit_percentage" numeric(5, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lead_id" varchar,
	"customer_id" varchar,
	"quote_number" varchar NOT NULL,
	"title" varchar NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"valid_until" timestamp NOT NULL,
	"terms" text,
	"notes" text,
	"created_by" varchar NOT NULL,
	"sent_date" timestamp,
	"accepted_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"description" text,
	"regional_manager_id" varchar,
	"states" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" varchar NOT NULL,
	"permission_id" varchar NOT NULL,
	"effect" "permission_effect" DEFAULT 'ALLOW' NOT NULL,
	"conditions" jsonb DEFAULT '{}',
	"constraints" jsonb DEFAULT '{}',
	"is_customized" boolean DEFAULT false,
	"customized_by" varchar,
	"customized_at" timestamp,
	"customization_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"code" varchar(30) NOT NULL,
	"role_type" "role_type" DEFAULT 'department_role' NOT NULL,
	"department" varchar(30) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"description" varchar(255),
	"permissions" jsonb DEFAULT '{}' NOT NULL,
	"can_access_all_tenants" boolean DEFAULT false,
	"can_view_system_metrics" boolean DEFAULT false,
	"can_access_all_locations" boolean DEFAULT false,
	"can_manage_company_users" boolean DEFAULT false,
	"can_create_locations" boolean DEFAULT false,
	"can_view_company_financials" boolean DEFAULT false,
	"can_manage_regional_users" boolean DEFAULT false,
	"can_view_regional_reports" boolean DEFAULT false,
	"can_approve_regional_deals" boolean DEFAULT false,
	"can_manage_location_users" boolean DEFAULT false,
	"can_view_location_reports" boolean DEFAULT false,
	"can_approve_location_deals" boolean DEFAULT false,
	"can_manage_compliance" boolean DEFAULT false,
	"can_manage_training" boolean DEFAULT false,
	"can_manage_hr" boolean DEFAULT false,
	"can_manage_it" boolean DEFAULT false,
	"can_view_analytics" boolean DEFAULT false,
	"can_manage_quality" boolean DEFAULT false,
	"can_access_audit_logs" boolean DEFAULT false,
	"can_manage_integrations" boolean DEFAULT false,
	"can_manage_users" boolean DEFAULT false,
	"is_system_role" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sales_forecasts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"forecast_name" varchar NOT NULL,
	"forecast_type" varchar NOT NULL,
	"description" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"revenue_target" numeric(12, 2) NOT NULL,
	"unit_target" integer,
	"deal_count_target" integer,
	"actual_revenue" numeric(12, 2) DEFAULT '0',
	"actual_units" integer DEFAULT 0,
	"actual_deals" integer DEFAULT 0,
	"pipeline_value" numeric(12, 2) DEFAULT '0',
	"weighted_pipeline_value" numeric(12, 2) DEFAULT '0',
	"probability_adjusted_revenue" numeric(12, 2) DEFAULT '0',
	"confidence_level" varchar NOT NULL,
	"confidence_percentage" integer DEFAULT 50,
	"conversion_rate" numeric(5, 2) DEFAULT '0',
	"average_deal_size" numeric(10, 2) DEFAULT '0',
	"sales_cycle_length" integer DEFAULT 30,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"achievement_percentage" numeric(5, 2) DEFAULT '0',
	"projected_revenue" numeric(12, 2) DEFAULT '0',
	"gap_to_target" numeric(12, 2) DEFAULT '0',
	"sales_territory" varchar,
	"sales_team" jsonb DEFAULT '[]'::jsonb,
	"sales_manager" varchar,
	"forecast_notes" text,
	"assumptions" text,
	"risk_factors" text,
	"opportunities" text,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_calculated" timestamp
);
--> statement-breakpoint
CREATE TABLE "sales_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"assigned_to_user_id" varchar,
	"assigned_to_team_id" varchar,
	"assigned_by" varchar NOT NULL,
	"goal_type" "activity_goal_type" NOT NULL,
	"target_count" integer NOT NULL,
	"period" "goal_period" NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"team_id" varchar,
	"metric_period" varchar NOT NULL,
	"period_start_date" timestamp NOT NULL,
	"period_end_date" timestamp NOT NULL,
	"total_calls" integer DEFAULT 0,
	"answered_calls" integer DEFAULT 0,
	"total_emails" integer DEFAULT 0,
	"email_replies" integer DEFAULT 0,
	"total_meetings" integer DEFAULT 0,
	"meetings_held" integer DEFAULT 0,
	"call_answer_rate" numeric(5, 2) DEFAULT '0',
	"email_response_rate" numeric(5, 2) DEFAULT '0',
	"activity_to_meeting_rate" numeric(5, 2) DEFAULT '0',
	"meeting_to_proposal_rate" numeric(5, 2) DEFAULT '0',
	"proposal_closing_rate" numeric(5, 2) DEFAULT '0',
	"total_proposals" integer DEFAULT 0,
	"closed_deals" integer DEFAULT 0,
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"average_deal_size" numeric(12, 2) DEFAULT '0',
	"activities_per_deal" numeric(8, 2) DEFAULT '0',
	"activities_needed_for_goal" integer DEFAULT 0,
	"projected_revenue" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"team_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'member',
	"joined_date" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"parent_team_id" varchar,
	"team_level" integer DEFAULT 1,
	"manager_id" varchar NOT NULL,
	"territory" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"device_fingerprint" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"terminated_at" timestamp,
	"is_active" boolean DEFAULT true,
	"timeout_warning_shown" boolean DEFAULT false,
	"is_suspicious" boolean DEFAULT false,
	"failed_login_attempts" integer DEFAULT 0,
	"last_failed_login" timestamp,
	"mfa_verified" boolean DEFAULT false,
	"mfa_method" varchar(50),
	"mfa_verified_at" timestamp,
	"country" varchar(2),
	"city" varchar(100),
	"risk_score" integer DEFAULT 0,
	"risk_factors" jsonb,
	"termination_reason" varchar(100),
	"terminated_by" uuid,
	CONSTRAINT "security_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "seo_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"path" varchar NOT NULL,
	"title" varchar,
	"description" text,
	"lastmod" timestamp DEFAULT now(),
	"changefreq" varchar DEFAULT 'monthly',
	"priority" numeric(2, 1) DEFAULT '0.5',
	"include_in_sitemap" boolean DEFAULT true,
	"schema_type" varchar,
	"schema_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seo_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"site_name" varchar,
	"site_url" varchar,
	"default_title" varchar,
	"default_description" text,
	"default_og_image" varchar,
	"twitter_handle" varchar,
	"allow_ai_crawling" boolean DEFAULT true,
	"sitemap_changefreq" varchar DEFAULT 'weekly',
	"sitemap_priority_default" numeric(2, 1) DEFAULT '0.5',
	"last_sitemap_generated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_call_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_ticket_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"call_start_time" timestamp NOT NULL,
	"call_end_time" timestamp,
	"actual_arrival_time" timestamp,
	"on_site_time_minutes" integer,
	"travel_time_minutes" integer,
	"analysis_type" "analysis_type" NOT NULL,
	"problem_description" text NOT NULL,
	"root_cause" text,
	"actions_taken" jsonb DEFAULT '[]'::jsonb,
	"outcome" "service_outcome" NOT NULL,
	"equipment_condition" text,
	"meter_reading" integer,
	"diagnostic_codes" jsonb DEFAULT '[]'::jsonb,
	"customer_present" boolean DEFAULT false,
	"customer_signature" text,
	"customer_feedback" text,
	"customer_satisfaction_score" integer,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_date" timestamp,
	"follow_up_reason" text,
	"labor_hours" numeric(4, 2),
	"labor_rate" numeric(10, 2),
	"total_labor_cost" numeric(10, 2),
	"before_photos" jsonb DEFAULT '[]'::jsonb,
	"after_photos" jsonb DEFAULT '[]'::jsonb,
	"service_report_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_calls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_service_call_id" varchar,
	"external_customer_id" varchar,
	"external_equipment_id" varchar,
	"last_sync_date" timestamp,
	"service_call_number" varchar,
	"customer_id" varchar NOT NULL,
	"equipment_id" varchar,
	"call_date" timestamp NOT NULL,
	"call_time" varchar,
	"call_type" varchar,
	"priority_level" varchar DEFAULT 'medium',
	"call_status" varchar DEFAULT 'open',
	"problem_description" text,
	"problem_code" varchar,
	"resolution_description" text,
	"resolution_code" varchar,
	"assigned_technician_id" varchar,
	"dispatched_by_user_id" varchar,
	"time_on_site_minutes" integer,
	"travel_time_minutes" integer,
	"completed_date" timestamp,
	"customer_signature" text,
	"customer_satisfaction_rating" integer,
	"labor_charge_amount" numeric(10, 2),
	"parts_charge_amount" numeric(10, 2),
	"travel_charge_amount" numeric(10, 2),
	"total_charge_amount" numeric(10, 2),
	"is_billable" boolean DEFAULT true,
	"invoice_number" varchar,
	"service_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "service_calls_service_call_number_unique" UNIQUE("service_call_number")
);
--> statement-breakpoint
CREATE TABLE "service_contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_contract_id" varchar,
	"external_customer_id" varchar,
	"external_equipment_id" varchar,
	"last_sync_date" timestamp,
	"contract_number" varchar,
	"customer_id" varchar NOT NULL,
	"equipment_id" varchar,
	"contract_type" varchar,
	"contract_status" varchar DEFAULT 'active',
	"start_date" timestamp,
	"end_date" timestamp,
	"auto_renewal" boolean DEFAULT false,
	"billing_frequency" varchar DEFAULT 'monthly',
	"monthly_base_rate" numeric(10, 2),
	"bw_overage_rate" numeric(6, 4),
	"color_overage_rate" numeric(6, 4),
	"base_volume_bw" integer,
	"base_volume_color" integer,
	"total_contract_value" numeric(10, 2),
	"includes_toner" boolean DEFAULT true,
	"includes_parts" boolean DEFAULT true,
	"includes_labor" boolean DEFAULT true,
	"response_time_hours" integer DEFAULT 24,
	"sales_rep" varchar,
	"commission_rate" numeric(5, 4),
	"contract_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "service_contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "service_parts_used" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"part_number" varchar(100) NOT NULL,
	"part_name" varchar(255) NOT NULL,
	"part_description" text,
	"quantity_used" integer NOT NULL,
	"quantity_wasted" integer DEFAULT 0,
	"was_in_stock" boolean DEFAULT false,
	"inventory_item_id" uuid,
	"unit_cost" numeric(10, 2),
	"total_cost" numeric(10, 2),
	"billable" boolean DEFAULT true,
	"warranty_period_months" integer,
	"serial_numbers" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"service_ticket_id" varchar NOT NULL,
	"session_id" varchar,
	"file_name" varchar NOT NULL,
	"original_name" varchar,
	"mime_type" varchar NOT NULL,
	"file_size" integer,
	"object_path" text NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"address" text,
	"category" varchar,
	"description" text,
	"taken_at" timestamp,
	"uploaded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"category" varchar DEFAULT 'Service',
	"service_type" varchar,
	"pricing_level" varchar,
	"description" text,
	"summary" text,
	"note" text,
	"ea_notes" text,
	"related_products" text,
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"repost_edit" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT true,
	"funding" boolean DEFAULT true,
	"lease" boolean DEFAULT false,
	"payment_type" varchar,
	"new_active" boolean DEFAULT false,
	"new_rep_price" numeric,
	"upgrade_active" boolean DEFAULT false,
	"upgrade_rep_price" numeric,
	"lexmark_active" boolean DEFAULT false,
	"lexmark_rep_price" numeric,
	"graphic_active" boolean DEFAULT false,
	"graphic_rep_price" numeric,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_ticket_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"update_type" varchar NOT NULL,
	"old_value" text,
	"new_value" text,
	"notes" text,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"equipment_id" varchar,
	"ticket_number" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"assigned_technician_id" varchar,
	"scheduled_date" timestamp,
	"estimated_duration" integer,
	"customer_address" text,
	"customer_phone" varchar,
	"required_skills" text[],
	"required_parts" text[],
	"work_order_notes" text,
	"resolution_notes" text,
	"customer_signature" text,
	"parts_used" text[],
	"labor_hours" numeric(4, 2),
	"created_by" varchar NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_media_cron_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"cron_expression" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"prompt_template" text NOT NULL,
	"target_platforms" jsonb NOT NULL,
	"webhook_url" varchar NOT NULL,
	"last_executed" timestamp,
	"next_execution" timestamp,
	"execution_count" integer DEFAULT 0,
	"failure_count" integer DEFAULT 0,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_media_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"generation_type" varchar NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"claude_model" varchar DEFAULT 'claude-sonnet-4-20250514',
	"claude_prompt" text,
	"claude_response" jsonb,
	"title" varchar NOT NULL,
	"short_content" text NOT NULL,
	"long_content" text NOT NULL,
	"website_link" varchar DEFAULT 'https://printyx.net',
	"scheduled_for" timestamp,
	"cron_expression" varchar,
	"is_recurring" boolean DEFAULT false,
	"webhook_url" varchar,
	"webhook_payload" jsonb,
	"webhook_status" varchar,
	"webhook_sent_at" timestamp,
	"target_platforms" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "software_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"vendor" varchar,
	"product_type" varchar,
	"category" varchar,
	"accessory_type" varchar,
	"description" text,
	"summary" text,
	"note" text,
	"ea_notes" text,
	"config_note" text,
	"related_products" text,
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"repost_edit" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT true,
	"funding" boolean DEFAULT true,
	"lease" boolean DEFAULT false,
	"payment_type" varchar,
	"standard_active" boolean DEFAULT false,
	"standard_cost" numeric,
	"standard_rep_price" numeric,
	"new_active" boolean DEFAULT false,
	"new_cost" numeric,
	"new_rep_price" numeric,
	"upgrade_active" boolean DEFAULT false,
	"upgrade_cost" numeric,
	"upgrade_rep_price" numeric,
	"price_book_id" varchar,
	"temp_key" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"product_type" varchar DEFAULT 'Supplies',
	"dealer_comp" varchar,
	"inventory" varchar,
	"in_stock" varchar,
	"summary" text,
	"note" text,
	"ea_notes" text,
	"related_products" text,
	"is_active" boolean DEFAULT true,
	"available_for_all" boolean DEFAULT false,
	"repost_edit" boolean DEFAULT false,
	"sales_rep_credit" boolean DEFAULT true,
	"funding" boolean DEFAULT true,
	"lease" boolean DEFAULT false,
	"payment_type" varchar,
	"new_active" boolean DEFAULT false,
	"new_rep_price" numeric,
	"upgrade_active" boolean DEFAULT false,
	"upgrade_rep_price" numeric,
	"lexmark_active" boolean DEFAULT false,
	"lexmark_rep_price" numeric,
	"graphic_active" boolean DEFAULT false,
	"graphic_rep_price" numeric,
	"price_book_id" varchar,
	"temp_key" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"severity" varchar DEFAULT 'medium',
	"source" varchar,
	"resolved" boolean DEFAULT false,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"name" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"type" varchar NOT NULL,
	"status" varchar DEFAULT 'disconnected' NOT NULL,
	"configuration" jsonb,
	"credentials" jsonb,
	"last_sync" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'todo' NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"assigned_to" varchar,
	"project_id" varchar,
	"customer_id" varchar,
	"due_date" timestamp,
	"estimated_hours" integer,
	"actual_hours" integer,
	"completion_percentage" integer DEFAULT 0,
	"tags" text[],
	"created_by" varchar NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"location_id" varchar,
	"name" varchar(100) NOT NULL,
	"department" varchar(30) NOT NULL,
	"manager_id" varchar,
	"parent_team_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_availability" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"start_time" varchar NOT NULL,
	"end_time" varchar NOT NULL,
	"is_booked" boolean DEFAULT false,
	"ticket_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"certification_type" varchar NOT NULL,
	"certification_number" varchar,
	"issued_date" timestamp,
	"expiration_date" timestamp,
	"certification_body" varchar,
	"document_url" varchar,
	"is_active" boolean DEFAULT true,
	"reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_ticket_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"service_ticket_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"expected_latitude" numeric(10, 7),
	"expected_longitude" numeric(10, 7),
	"actual_latitude" numeric(10, 7),
	"actual_longitude" numeric(10, 7),
	"location_verified" boolean DEFAULT false,
	"distance_from_expected" numeric(8, 2),
	"check_in_timestamp" timestamp DEFAULT now(),
	"check_in_address" text,
	"check_in_notes" text,
	"workflow_step" varchar DEFAULT 'initial_assessment',
	"initial_assessment" text,
	"diagnosis_notes" text,
	"customer_approval_needed" boolean DEFAULT false,
	"customer_approval_received" boolean DEFAULT false,
	"work_performed" text,
	"parts_used_ids" jsonb DEFAULT '[]'::jsonb,
	"parts_requested_ids" jsonb DEFAULT '[]'::jsonb,
	"issue_resolved" boolean DEFAULT false,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_reason" text,
	"check_out_timestamp" timestamp,
	"total_duration_minutes" integer,
	"billable_hours" numeric(4, 2),
	"customer_present" boolean DEFAULT false,
	"customer_signature" text,
	"customer_satisfaction_rating" integer,
	"customer_feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technicians" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"employee_id" varchar,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"skills" text[],
	"certifications" text[],
	"current_location" text,
	"is_active" boolean DEFAULT true,
	"is_available" boolean DEFAULT true,
	"working_hours" text,
	"hourly_rate" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_enabled_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"master_product_id" varchar,
	"source" varchar DEFAULT 'master' NOT NULL,
	"enabled" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"discontinued" boolean DEFAULT false,
	"custom_sku" varchar,
	"custom_name" varchar,
	"dealer_cost" numeric(10, 2),
	"markup_rule_id" varchar,
	"company_price" numeric(10, 2),
	"price_overridden" boolean DEFAULT false,
	"tenant_product_json" jsonb,
	"enabled_at" timestamp,
	"enabled_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"domain" varchar,
	"subdomain_prefix" varchar,
	"path_prefix" varchar,
	"is_active" boolean DEFAULT true,
	"plan" varchar(20) DEFAULT 'basic',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_domain_unique" UNIQUE("domain"),
	CONSTRAINT "tenants_subdomain_prefix_unique" UNIQUE("subdomain_prefix"),
	CONSTRAINT "tenants_path_prefix_unique" UNIQUE("path_prefix")
);
--> statement-breakpoint
CREATE TABLE "third_party_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_name" varchar(100) NOT NULL,
	"integration_name" varchar(255) NOT NULL,
	"status" "integration_status" DEFAULT 'pending' NOT NULL,
	"credentials" jsonb NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb,
	"supported_manufacturers" "manufacturer"[],
	"last_sync" timestamp,
	"next_sync" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_parts_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"service_ticket_id" varchar NOT NULL,
	"session_id" varchar,
	"technician_id" varchar NOT NULL,
	"part_number" varchar NOT NULL,
	"part_description" varchar NOT NULL,
	"quantity_needed" integer NOT NULL,
	"urgency" "ticket_priority" NOT NULL,
	"justification" text,
	"requires_approval" boolean DEFAULT false,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejected_reason" text,
	"status" varchar DEFAULT 'requested',
	"estimated_cost" numeric(10, 2),
	"vendor_id" varchar,
	"expected_delivery_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "time_tracking_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"address" text,
	"check_in_type" "check_in_type" NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_customer_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"location_id" varchar,
	"user_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"assignment_type" varchar(20) DEFAULT 'primary' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_location_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"location_id" varchar NOT NULL,
	"access_type" varchar(20) DEFAULT 'full' NOT NULL,
	"assigned_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"organizational_unit_id" varchar,
	"assigned_by" varchar NOT NULL,
	"assignment_reason" text,
	"effective_from" timestamp DEFAULT now(),
	"effective_until" timestamp,
	"territory_restrictions" jsonb DEFAULT '{}',
	"scope_restrictions" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"phone" varchar,
	"job_title" varchar,
	"department" varchar,
	"bio" text,
	"avatar" varchar,
	"theme" varchar(20) DEFAULT 'system',
	"language" varchar(10) DEFAULT 'en',
	"timezone" varchar DEFAULT 'America/New_York',
	"date_format" varchar DEFAULT 'MM/dd/yyyy',
	"time_format" varchar(2) DEFAULT '12',
	"currency" varchar(3) DEFAULT 'USD',
	"notifications" jsonb DEFAULT '{"email": true, "push": true, "sms": false, "marketing": false}',
	"accessibility" jsonb DEFAULT '{"highContrast": false, "reducedMotion": false, "fontSize": "medium", "screenReader": false, "keyboardNavigation": false, "colorBlind": "none", "soundEnabled": true, "voiceCommands": false}',
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_secret" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"password_hash" varchar,
	"role_id" varchar,
	"team_id" varchar,
	"manager_id" varchar,
	"employee_id" varchar,
	"primary_location_id" varchar,
	"region_id" varchar,
	"access_scope" varchar(20) DEFAULT 'location',
	"is_platform_user" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendor_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"bill_number" varchar(100),
	"transaction_date" timestamp NOT NULL,
	"due_date" timestamp,
	"vendor_id" varchar,
	"ap_account_id" varchar,
	"total_amount" numeric(15, 2) NOT NULL,
	"balance_due" numeric(15, 2) NOT NULL,
	"department_id" varchar,
	"currency_id" varchar,
	"exchange_rate" numeric(10, 6),
	"private_note" text,
	"memo" text,
	"line_items_json" jsonb,
	"linked_transactions_json" jsonb,
	"remit_to_address_json" jsonb,
	"tax_detail_json" jsonb,
	"payment_terms_id" varchar,
	"global_tax_calculation" varchar,
	"transaction_location_type" varchar,
	"class_id" varchar,
	"sales_terms_id" varchar,
	"recurring_data_id" varchar,
	"external_bill_id" varchar,
	"qb_domain" varchar,
	"sync_token" varchar,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_vendor_id" varchar,
	"last_sync_date" timestamp,
	"vendor_name" varchar NOT NULL,
	"primary_contact_name" varchar,
	"address_line_1" varchar,
	"address_line_2" varchar,
	"city" varchar,
	"state" varchar,
	"zip_code" varchar,
	"phone" varchar,
	"fax" varchar,
	"email" varchar,
	"website" varchar,
	"payment_terms" varchar,
	"tax_id" varchar,
	"account_number" varchar,
	"credit_limit" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"vendor_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warehouse_kitting_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"purchase_order_id" varchar,
	"order_number" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"kit_name" varchar NOT NULL,
	"equipment_model" varchar,
	"required_accessories" jsonb DEFAULT '[]'::jsonb,
	"checklist_items" jsonb DEFAULT '[]'::jsonb,
	"first_pass_yield" boolean DEFAULT false,
	"quality_status" "kit_quality_status" DEFAULT 'pending_inspection',
	"defects_found" jsonb DEFAULT '[]'::jsonb,
	"rework_required" boolean DEFAULT false,
	"rework_count" integer DEFAULT 0,
	"rework_notes" text,
	"assigned_technician" varchar NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"total_duration_minutes" integer,
	"operation_status" "warehouse_operation_status" DEFAULT 'pending',
	"completed_by" varchar,
	"supervisor_approval" boolean DEFAULT false,
	"approved_by" varchar,
	"approved_at" timestamp,
	"asset_tags" jsonb DEFAULT '[]'::jsonb,
	"firmware_versions" jsonb DEFAULT '{}'::jsonb,
	"serial_numbers" jsonb DEFAULT '[]'::jsonb,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warehouse_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"operation_type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"notes" text,
	"quality_control_checks" jsonb,
	"photos" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"step_name" varchar NOT NULL,
	"step_started" timestamp DEFAULT now(),
	"step_completed" timestamp,
	"step_data" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_layouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "report_category",
	"layout" jsonb NOT NULL,
	"widgets" jsonb NOT NULL,
	"is_public" boolean DEFAULT false,
	"allowed_roles" jsonb DEFAULT '[]',
	"allowed_users" jsonb DEFAULT '[]',
	"is_default" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kpi_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"category" "report_category" NOT NULL,
	"calculation_sql" text NOT NULL,
	"target_value" numeric(15, 2),
	"target_type" "target_type" DEFAULT 'absolute',
	"display_format" "display_format" DEFAULT 'number',
	"prefix" varchar(10),
	"suffix" varchar(10),
	"decimal_places" integer DEFAULT 0,
	"color_scheme" jsonb DEFAULT '{}',
	"alert_enabled" boolean DEFAULT false,
	"alert_thresholds" jsonb DEFAULT '{}',
	"alert_recipients" jsonb DEFAULT '[]',
	"required_permissions" jsonb NOT NULL,
	"organizational_scope" "organizational_scope" NOT NULL,
	"refresh_frequency" integer DEFAULT 3600,
	"cache_duration" integer DEFAULT 300,
	"is_active" boolean DEFAULT true,
	"is_high_priority" boolean DEFAULT false,
	"tags" jsonb DEFAULT '[]',
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kpi_values" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"kpi_definition_id" varchar NOT NULL,
	"location_id" varchar,
	"region_id" varchar,
	"user_id" varchar,
	"team_id" varchar,
	"department_id" varchar,
	"date_value" date NOT NULL,
	"time_period" time_period NOT NULL,
	"fiscal_year" integer,
	"fiscal_quarter" integer,
	"actual_value" numeric(15, 2) NOT NULL,
	"target_value" numeric(15, 2),
	"variance_value" numeric(15, 2),
	"variance_percentage" numeric(8, 4),
	"performance_level" "performance_level",
	"is_target_met" boolean,
	"alert_triggered" boolean DEFAULT false,
	"calculation_timestamp" timestamp DEFAULT now(),
	"data_freshness" timestamp,
	"source_query" text,
	"data_quality_score" integer,
	"confidence_level" numeric(5, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"category" "report_category" NOT NULL,
	"sql_query" text NOT NULL,
	"default_parameters" jsonb DEFAULT '{}',
	"available_filters" jsonb DEFAULT '{}',
	"available_groupings" jsonb DEFAULT '{}',
	"required_permissions" jsonb NOT NULL,
	"organizational_scope" "organizational_scope" NOT NULL,
	"contains_sensitive_data" boolean DEFAULT false,
	"default_visualization" "report_visualization" DEFAULT 'table',
	"chart_config" jsonb DEFAULT '{}',
	"cache_duration" integer DEFAULT 300,
	"query_timeout" integer DEFAULT 30,
	"max_row_limit" integer DEFAULT 10000,
	"is_real_time" boolean DEFAULT false,
	"supports_drill_down" boolean DEFAULT false,
	"supports_export" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"version" varchar(10) DEFAULT '1.0',
	"tags" jsonb DEFAULT '[]',
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_executions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"report_definition_id" varchar NOT NULL,
	"user_id" varchar,
	"schedule_id" varchar,
	"parameters" jsonb DEFAULT '{}',
	"filters" jsonb DEFAULT '{}',
	"execution_time_ms" integer,
	"row_count" integer,
	"data_size" integer,
	"cache_hit" boolean DEFAULT false,
	"export_format" "export_format",
	"file_path" varchar(500),
	"file_size" integer,
	"download_count" integer DEFAULT 0,
	"status" "report_status" NOT NULL,
	"error_message" text,
	"error_code" varchar(50),
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"session_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"report_definition_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"cron_expression" varchar(100) NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC',
	"parameters" jsonb DEFAULT '{}',
	"filters" jsonb DEFAULT '{}',
	"recipients" jsonb NOT NULL,
	"delivery_method" "delivery_method" DEFAULT 'email',
	"export_format" "export_format" DEFAULT 'pdf',
	"email_subject" varchar(255),
	"email_body" text,
	"attach_file_name" varchar(255),
	"is_active" boolean DEFAULT true,
	"last_run" timestamp,
	"next_run" timestamp,
	"run_count" integer DEFAULT 0,
	"last_status" "report_status",
	"last_error" text,
	"average_execution_time" integer,
	"last_execution_time" integer,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_report_activity" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_type" "activity_type" NOT NULL,
	"report_definition_id" varchar,
	"kpi_definition_id" varchar,
	"session_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"referrer" varchar,
	"parameters" jsonb DEFAULT '{}',
	"duration_seconds" integer,
	"load_time_ms" integer,
	"error_occurred" boolean DEFAULT false,
	"error_message" text,
	"scroll_depth" integer,
	"export_count" integer DEFAULT 0,
	"share_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_report_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"report_definition_id" varchar NOT NULL,
	"custom_filters" jsonb DEFAULT '{}',
	"custom_groupings" jsonb DEFAULT '{}',
	"custom_chart_config" jsonb DEFAULT '{}',
	"custom_columns" jsonb DEFAULT '[]',
	"sort_preferences" jsonb DEFAULT '{}',
	"favorite_dashboard" boolean DEFAULT false,
	"dashboard_position" integer,
	"widget_size" varchar(20) DEFAULT 'medium',
	"last_accessed" timestamp,
	"access_count" integer DEFAULT 0,
	"average_view_duration" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "conversion_funnel" ADD CONSTRAINT "conversion_funnel_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_funnel" ADD CONSTRAINT "conversion_funnel_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_funnel" ADD CONSTRAINT "conversion_funnel_team_id_sales_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sales_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_meter_submissions" ADD CONSTRAINT "customer_meter_submissions_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_related_service_request_id_customer_service_requests_id_fk" FOREIGN KEY ("related_service_request_id") REFERENCES "public"."customer_service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_related_payment_id_customer_payments_id_fk" FOREIGN KEY ("related_payment_id") REFERENCES "public"."customer_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_related_supply_order_id_customer_supply_orders_id_fk" FOREIGN KEY ("related_supply_order_id") REFERENCES "public"."customer_supply_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_portal_activity_log" ADD CONSTRAINT "customer_portal_activity_log_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_requests" ADD CONSTRAINT "customer_service_requests_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_supply_order_items" ADD CONSTRAINT "customer_supply_order_items_order_id_customer_supply_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."customer_supply_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_supply_orders" ADD CONSTRAINT "customer_supply_orders_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_metrics" ADD CONSTRAINT "device_metrics_device_id_device_registrations_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_metrics" ADD CONSTRAINT "device_metrics_integration_id_manufacturer_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."manufacturer_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_integration_id_manufacturer_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."manufacturer_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_integration_id_manufacturer_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."manufacturer_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_device_id_device_registrations_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_session_id_mobile_service_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mobile_service_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_insights" ADD CONSTRAINT "manager_insights_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_insights" ADD CONSTRAINT "manager_insights_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_insights" ADD CONSTRAINT "manager_insights_team_id_sales_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sales_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_insights" ADD CONSTRAINT "manager_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_metrics" ADD CONSTRAINT "sales_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_metrics" ADD CONSTRAINT "sales_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_metrics" ADD CONSTRAINT "sales_metrics_team_id_sales_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sales_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_photos" ADD CONSTRAINT "service_photos_session_id_mobile_service_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mobile_service_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_parts_requests" ADD CONSTRAINT "ticket_parts_requests_session_id_technician_ticket_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."technician_ticket_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_tracking_entries" ADD CONSTRAINT "time_tracking_entries_session_id_mobile_service_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mobile_service_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_session_id_technician_ticket_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."technician_ticket_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_adjustments_tenant_id_idx" ON "commission_adjustments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_adjustments_calculation_id_idx" ON "commission_adjustments" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "commission_adjustments_employee_id_idx" ON "commission_adjustments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "commission_adjustments_adjustment_type_idx" ON "commission_adjustments" USING btree ("adjustment_type");--> statement-breakpoint
CREATE INDEX "commission_adjustments_processed_idx" ON "commission_adjustments" USING btree ("is_processed");--> statement-breakpoint
CREATE INDEX "commission_bonuses_calculation_id_idx" ON "commission_bonuses" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "commission_bonuses_bonus_type_idx" ON "commission_bonuses" USING btree ("bonus_type");--> statement-breakpoint
CREATE INDEX "commission_calculation_details_calculation_id_idx" ON "commission_calculation_details" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "commission_calculation_details_category_idx" ON "commission_calculation_details" USING btree ("category");--> statement-breakpoint
CREATE INDEX "commission_calculations_tenant_id_idx" ON "commission_calculations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_calculations_employee_id_idx" ON "commission_calculations" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "commission_calculations_plan_id_idx" ON "commission_calculations" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "commission_calculations_status_idx" ON "commission_calculations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_calculations_period_idx" ON "commission_calculations" USING btree ("calculation_period_start","calculation_period_end");--> statement-breakpoint
CREATE INDEX "commission_calculations_payout_date_idx" ON "commission_calculations" USING btree ("payout_date");--> statement-breakpoint
CREATE INDEX "commission_dispute_history_dispute_id_idx" ON "commission_dispute_history" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "commission_dispute_history_action_idx" ON "commission_dispute_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "commission_dispute_history_created_at_idx" ON "commission_dispute_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "commission_disputes_tenant_id_idx" ON "commission_disputes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_disputes_dispute_number_idx" ON "commission_disputes" USING btree ("dispute_number");--> statement-breakpoint
CREATE INDEX "commission_disputes_calculation_id_idx" ON "commission_disputes" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "commission_disputes_employee_id_idx" ON "commission_disputes" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "commission_disputes_status_idx" ON "commission_disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_disputes_assigned_to_idx" ON "commission_disputes" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "commission_plan_tiers_plan_id_idx" ON "commission_plan_tiers" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "commission_plan_tiers_tier_level_idx" ON "commission_plan_tiers" USING btree ("tier_level");--> statement-breakpoint
CREATE INDEX "commission_plans_tenant_id_idx" ON "commission_plans" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_plans_active_idx" ON "commission_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "commission_plans_effective_date_idx" ON "commission_plans" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "commission_product_rates_plan_id_idx" ON "commission_product_rates" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "commission_product_rates_category_idx" ON "commission_product_rates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_tenant_id_idx" ON "commission_sales_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_calculation_id_idx" ON "commission_sales_transactions" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_employee_id_idx" ON "commission_sales_transactions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_transaction_type_idx" ON "commission_sales_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_transaction_id_idx" ON "commission_sales_transactions" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_transaction_date_idx" ON "commission_sales_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_processed_idx" ON "commission_sales_transactions" USING btree ("is_processed");--> statement-breakpoint
CREATE INDEX "commission_sales_transactions_charged_back_idx" ON "commission_sales_transactions" USING btree ("is_charged_back");--> statement-breakpoint
CREATE INDEX "tenant_customer_meter_idx" ON "customer_meter_submissions" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "meter_equipment_idx" ON "customer_meter_submissions" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "meter_reading_date_idx" ON "customer_meter_submissions" USING btree ("reading_date");--> statement-breakpoint
CREATE INDEX "meter_submission_date_idx" ON "customer_meter_submissions" USING btree ("submission_date");--> statement-breakpoint
CREATE INDEX "meter_validation_idx" ON "customer_meter_submissions" USING btree ("is_validated");--> statement-breakpoint
CREATE INDEX "tenant_customer_notification_idx" ON "customer_notifications" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "notification_type_idx" ON "customer_notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notification_created_idx" ON "customer_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "unread_portal_notifications_idx" ON "customer_notifications" USING btree ("is_portal_read");--> statement-breakpoint
CREATE INDEX "tenant_customer_payment_idx" ON "customer_payments" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "customer_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_number_idx" ON "customer_payments" USING btree ("payment_number");--> statement-breakpoint
CREATE INDEX "payment_date_idx" ON "customer_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "payment_invoice_idx" ON "customer_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "tenant_customer_idx" ON "customer_portal_access" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "portal_status_idx" ON "customer_portal_access" USING btree ("status");--> statement-breakpoint
CREATE INDEX "portal_email_idx" ON "customer_portal_access" USING btree ("email");--> statement-breakpoint
CREATE INDEX "portal_username_idx" ON "customer_portal_access" USING btree ("username");--> statement-breakpoint
CREATE INDEX "tenant_customer_activity_idx" ON "customer_portal_activity_log" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "activity_action_idx" ON "customer_portal_activity_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "activity_timestamp_idx" ON "customer_portal_activity_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "tenant_customer_service_idx" ON "customer_service_requests" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "service_request_status_idx" ON "customer_service_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_request_priority_idx" ON "customer_service_requests" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "service_request_type_idx" ON "customer_service_requests" USING btree ("type");--> statement-breakpoint
CREATE INDEX "service_request_submitted_idx" ON "customer_service_requests" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "service_request_number_idx" ON "customer_service_requests" USING btree ("request_number");--> statement-breakpoint
CREATE INDEX "supply_order_items_order_idx" ON "customer_supply_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "supply_order_items_product_idx" ON "customer_supply_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "tenant_customer_supply_idx" ON "customer_supply_orders" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "supply_order_status_idx" ON "customer_supply_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supply_order_number_idx" ON "customer_supply_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "supply_order_submitted_idx" ON "customer_supply_orders" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "tenant_device_time_idx" ON "device_metrics" USING btree ("tenant_id","device_id","collection_timestamp");--> statement-breakpoint
CREATE INDEX "collection_timestamp_idx" ON "device_metrics" USING btree ("collection_timestamp");--> statement-breakpoint
CREATE INDEX "metrics_device_idx" ON "device_metrics" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "tenant_device_idx" ON "device_registrations" USING btree ("tenant_id","device_id");--> statement-breakpoint
CREATE INDEX "device_integration_idx" ON "device_registrations" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "device_status_idx" ON "device_registrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "device_last_seen_idx" ON "device_registrations" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "employee_commission_assignments_tenant_id_idx" ON "employee_commission_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "employee_commission_assignments_employee_id_idx" ON "employee_commission_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_commission_assignments_plan_id_idx" ON "employee_commission_assignments" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "employee_commission_assignments_active_idx" ON "employee_commission_assignments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "employee_commission_assignments_effective_date_idx" ON "employee_commission_assignments" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "enabled_products_tenant_master_idx" ON "enabled_products" USING btree ("tenant_id","master_product_id");--> statement-breakpoint
CREATE INDEX "enabled_products_tenant_enabled_idx" ON "enabled_products" USING btree ("tenant_id","enabled");--> statement-breakpoint
CREATE INDEX "idx_enhanced_roles_tenant" ON "enhanced_roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_enhanced_roles_org_unit" ON "enhanced_roles" USING btree ("organizational_unit_id");--> statement-breakpoint
CREATE INDEX "idx_enhanced_roles_hierarchy" ON "enhanced_roles" USING btree ("hierarchy_level");--> statement-breakpoint
CREATE INDEX "idx_enhanced_roles_nested_set" ON "enhanced_roles" USING btree ("lft","rght");--> statement-breakpoint
CREATE INDEX "idx_enhanced_roles_department" ON "enhanced_roles" USING btree ("department");--> statement-breakpoint
CREATE INDEX "tenant_time_idx" ON "integration_audit_logs" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "integration_time_idx" ON "integration_audit_logs" USING btree ("integration_id","timestamp");--> statement-breakpoint
CREATE INDEX "audit_status_idx" ON "integration_audit_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "integration_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "tenant_manufacturer_idx" ON "manufacturer_integrations" USING btree ("tenant_id","manufacturer");--> statement-breakpoint
CREATE INDEX "integration_status_idx" ON "manufacturer_integrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "next_sync_idx" ON "manufacturer_integrations" USING btree ("next_sync");--> statement-breakpoint
CREATE INDEX "master_relationships_base_idx" ON "master_product_accessory_relationships" USING btree ("base_product_id");--> statement-breakpoint
CREATE INDEX "master_relationships_accessory_idx" ON "master_product_accessory_relationships" USING btree ("accessory_id");--> statement-breakpoint
CREATE INDEX "master_relationships_unique_idx" ON "master_product_accessory_relationships" USING btree ("base_product_id","accessory_id");--> statement-breakpoint
CREATE INDEX "master_models_manufacturer_model_idx" ON "master_product_models" USING btree ("manufacturer","model_code");--> statement-breakpoint
CREATE INDEX "master_models_status_idx" ON "master_product_models" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_org_units_tenant" ON "organizational_units" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_org_units_parent" ON "organizational_units" USING btree ("parent_unit_id");--> statement-breakpoint
CREATE INDEX "idx_org_units_nested_set" ON "organizational_units" USING btree ("lft","rght");--> statement-breakpoint
CREATE INDEX "idx_org_units_type" ON "organizational_units" USING btree ("unit_type");--> statement-breakpoint
CREATE INDEX "idx_permission_cache_user_context" ON "permission_cache" USING btree ("user_id","organizational_context");--> statement-breakpoint
CREATE INDEX "idx_permission_cache_expires" ON "permission_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_permission_cache_hash" ON "permission_cache" USING btree ("permission_hash");--> statement-breakpoint
CREATE INDEX "idx_permission_overrides_user" ON "permission_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_permission_overrides_permission" ON "permission_overrides" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "idx_permission_overrides_effective" ON "permission_overrides" USING btree ("effective_from","effective_until");--> statement-breakpoint
CREATE INDEX "idx_permission_overrides_review" ON "permission_overrides" USING btree ("next_review_date");--> statement-breakpoint
CREATE INDEX "idx_permissions_module" ON "permissions" USING btree ("module");--> statement-breakpoint
CREATE INDEX "idx_permissions_resource_action" ON "permissions" USING btree ("resource_type","action");--> statement-breakpoint
CREATE INDEX "idx_permissions_scope" ON "permissions" USING btree ("scope_level");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_role" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_permission" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_effect" ON "role_permissions" USING btree ("effect");--> statement-breakpoint
CREATE INDEX "seo_pages_path_idx" ON "seo_pages" USING btree ("path");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "tenant_enabled_products_tenant_master_idx" ON "tenant_enabled_products" USING btree ("tenant_id","master_product_id");--> statement-breakpoint
CREATE INDEX "tenant_enabled_products_tenant_enabled_idx" ON "tenant_enabled_products" USING btree ("tenant_id","enabled");--> statement-breakpoint
CREATE INDEX "tenant_provider_idx" ON "third_party_integrations" USING btree ("tenant_id","provider_name");--> statement-breakpoint
CREATE INDEX "third_party_status_idx" ON "third_party_integrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_user" ON "user_role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_role" ON "user_role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_tenant" ON "user_role_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_org_unit" ON "user_role_assignments" USING btree ("organizational_unit_id");--> statement-breakpoint
CREATE INDEX "idx_user_role_assignments_effective" ON "user_role_assignments" USING btree ("effective_from","effective_until");--> statement-breakpoint
CREATE INDEX "idx_dashboard_layouts_tenant" ON "dashboard_layouts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_dashboard_layouts_user" ON "dashboard_layouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dashboard_layouts_category" ON "dashboard_layouts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_kpi_definitions_tenant" ON "kpi_definitions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_kpi_definitions_category" ON "kpi_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_kpi_definitions_scope" ON "kpi_definitions" USING btree ("organizational_scope");--> statement-breakpoint
CREATE INDEX "idx_kpi_definitions_code" ON "kpi_definitions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_tenant_date" ON "kpi_values" USING btree ("tenant_id","date_value");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_kpi_period" ON "kpi_values" USING btree ("kpi_definition_id","time_period","date_value");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_location_date" ON "kpi_values" USING btree ("location_id","date_value");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_user_date" ON "kpi_values" USING btree ("user_id","date_value");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_performance" ON "kpi_values" USING btree ("performance_level");--> statement-breakpoint
CREATE INDEX "idx_report_definitions_tenant" ON "report_definitions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_report_definitions_category" ON "report_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_report_definitions_scope" ON "report_definitions" USING btree ("organizational_scope");--> statement-breakpoint
CREATE INDEX "idx_report_definitions_code" ON "report_definitions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_report_executions_tenant_date" ON "report_executions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_report_executions_user_date" ON "report_executions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_report_executions_report" ON "report_executions" USING btree ("report_definition_id");--> statement-breakpoint
CREATE INDEX "idx_report_executions_status" ON "report_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_report_schedules_tenant" ON "report_schedules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_report_schedules_next_run" ON "report_schedules" USING btree ("next_run");--> statement-breakpoint
CREATE INDEX "idx_report_schedules_active" ON "report_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_user_activity_user_date" ON "user_report_activity" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_activity_tenant_type" ON "user_report_activity" USING btree ("tenant_id","activity_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_activity_report" ON "user_report_activity" USING btree ("report_definition_id");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_user" ON "user_report_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_report" ON "user_report_preferences" USING btree ("report_definition_id");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_favorite" ON "user_report_preferences" USING btree ("favorite_dashboard");