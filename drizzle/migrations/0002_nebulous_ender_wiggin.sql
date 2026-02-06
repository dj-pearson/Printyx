CREATE TYPE "public"."appointment_status" AS ENUM('requested', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."blog_content_queue_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."equipment_health_status" AS ENUM('excellent', 'good', 'warning', 'critical', 'offline');--> statement-breakpoint
CREATE TYPE "public"."maintenance_type" AS ENUM('routine_maintenance', 'preventive_maintenance', 'deep_cleaning', 'firmware_update', 'parts_replacement', 'calibration', 'inspection');--> statement-breakpoint
CREATE TYPE "public"."period_type" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."satisfaction_question_type" AS ENUM('rating_scale', 'yes_no', 'multiple_choice', 'text_short', 'text_long', 'nps_score');--> statement-breakpoint
CREATE TYPE "public"."satisfaction_response_status" AS ENUM('invited', 'started', 'completed', 'expired', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."satisfaction_survey_type" AS ENUM('service_request_completion', 'maintenance_appointment', 'supply_delivery', 'technical_support', 'general_experience', 'annual_review');--> statement-breakpoint
CREATE TYPE "public"."usage_type" AS ENUM('total', 'black_white', 'color', 'large_format', 'scan', 'fax');--> statement-breakpoint
CREATE TABLE "article_bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"collection_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookmark_user_article_unique" UNIQUE("user_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "article_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"rating_type" varchar(50) DEFAULT 'overall' NOT NULL,
	"comment" text,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"verified_reader" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rating_user_article_type_unique" UNIQUE("user_id","article_id","rating_type")
);
--> statement-breakpoint
CREATE TABLE "article_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"vote_type" varchar(20) NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vote_user_article_unique" UNIQUE("user_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "billing_disputes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"dispute_number" varchar NOT NULL,
	"invoice_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"equipment_id" varchar,
	"meter_reading_id" varchar,
	"dispute_type" varchar NOT NULL,
	"dispute_status" varchar DEFAULT 'open',
	"severity" varchar DEFAULT 'medium',
	"disputed_amount" numeric(10, 2) NOT NULL,
	"approved_credit_amount" numeric(10, 2) DEFAULT '0',
	"customer_complaint" text NOT NULL,
	"customer_contact_name" varchar,
	"customer_contact_email" varchar,
	"customer_contact_phone" varchar,
	"filed_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"assigned_to" varchar,
	"assigned_at" timestamp,
	"priority_level" integer DEFAULT 3,
	"internal_notes" text,
	"research_notes" text,
	"resolution_type" varchar,
	"resolution_description" text,
	"resolution_date" timestamp,
	"resolved_by" varchar,
	"credit_memo_id" varchar,
	"credit_memo_number" varchar,
	"credit_memo_amount" numeric(10, 2),
	"credit_memo_issued" boolean DEFAULT false,
	"credit_memo_issued_at" timestamp,
	"corrected_invoice_id" varchar,
	"communication_log" jsonb,
	"requires_manager_approval" boolean DEFAULT false,
	"manager_approved" boolean,
	"approved_by" varchar,
	"approved_at" timestamp,
	"approval_notes" text,
	"escalated" boolean DEFAULT false,
	"escalated_to" varchar,
	"escalated_at" timestamp,
	"escalation_reason" text,
	"customer_satisfaction_rating" integer,
	"customer_feedback" text,
	"preventative_action" text,
	"metadata" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "billing_disputes_dispute_number_unique" UNIQUE("dispute_number")
);
--> statement-breakpoint
CREATE TABLE "blog_content_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"title" varchar(500) NOT NULL,
	"primary_keyword" varchar(255) NOT NULL,
	"secondary_keywords" jsonb,
	"category" "content_category" NOT NULL,
	"target_audience" text,
	"priority" integer DEFAULT 0,
	"status" "blog_content_queue_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"blog_post_id" uuid,
	"generated_title" varchar(500),
	"generated_slug" varchar(255),
	"requested_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_memos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"credit_memo_number" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"invoice_id" varchar,
	"dispute_id" varchar,
	"credit_amount" numeric(10, 2) NOT NULL,
	"credit_reason" varchar NOT NULL,
	"credit_description" text,
	"credit_status" varchar DEFAULT 'pending',
	"applied_to_invoice" boolean DEFAULT false,
	"applied_to_invoice_id" varchar,
	"applied_at" timestamp,
	"issued_date" timestamp NOT NULL,
	"expiration_date" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"voided_by" varchar,
	"voided_at" timestamp,
	"void_reason" text,
	"metadata" jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "credit_memos_credit_memo_number_unique" UNIQUE("credit_memo_number")
);
--> statement-breakpoint
CREATE TABLE "customer_maintenance_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"portal_user_id" varchar,
	"equipment_id" varchar,
	"equipment_name" varchar,
	"equipment_make" varchar,
	"equipment_model" varchar,
	"equipment_serial" varchar,
	"equipment_location" varchar,
	"maintenance_type" "maintenance_type" NOT NULL,
	"appointment_date" timestamp NOT NULL,
	"appointment_time" varchar NOT NULL,
	"duration" integer DEFAULT 60 NOT NULL,
	"time_zone" varchar DEFAULT 'America/New_York',
	"assigned_technician_id" varchar,
	"technician_name" varchar,
	"status" "appointment_status" DEFAULT 'requested' NOT NULL,
	"confirmation_code" varchar,
	"confirmed_at" timestamp,
	"description" text,
	"service_notes" text,
	"special_instructions" text,
	"estimated_cost" numeric(10, 2),
	"contact_method" varchar DEFAULT 'email',
	"customer_phone" varchar,
	"customer_email" varchar,
	"original_date" timestamp,
	"reschedule_count" integer DEFAULT 0,
	"reschedule_reason" text,
	"service_request_id" varchar,
	"service_ticket_id" varchar,
	"reminder_sent" boolean DEFAULT false,
	"reminder_sent_at" timestamp,
	"confirmation_sent" boolean DEFAULT false,
	"completed_at" timestamp,
	"customer_satisfaction_rating" integer,
	"customer_feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_surveys_sent" integer DEFAULT 0 NOT NULL,
	"total_surveys_completed" integer DEFAULT 0 NOT NULL,
	"response_rate" numeric(5, 2) DEFAULT '0.00',
	"service_request_scores" jsonb DEFAULT '{}'::jsonb,
	"maintenance_scores" jsonb DEFAULT '{}'::jsonb,
	"supply_order_scores" jsonb DEFAULT '{}'::jsonb,
	"average_overall_score" numeric(4, 2),
	"average_nps_score" numeric(4, 2),
	"service_quality_score" numeric(4, 2),
	"timeliness_score" numeric(4, 2),
	"communication_score" numeric(4, 2),
	"value_score" numeric(4, 2),
	"score_change" numeric(4, 2),
	"response_rate_change" numeric(5, 2),
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction_survey_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"question_type" "satisfaction_question_type" NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"order_index" integer NOT NULL,
	"rating_scale" jsonb DEFAULT '{"min":1,"max":5,"labels":["Very Poor","Poor","Fair","Good","Excellent"]}'::jsonb,
	"multiple_choice_options" jsonb DEFAULT '[]'::jsonb,
	"depends_on_question" uuid,
	"show_condition" jsonb,
	"category" varchar(100),
	"weight" numeric(3, 2) DEFAULT '1.00',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction_survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"rating_value" integer,
	"text_value" text,
	"selected_options" jsonb DEFAULT '[]'::jsonb,
	"boolean_value" boolean,
	"time_spent_seconds" integer,
	"response_order" integer,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction_survey_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"survey_type" "satisfaction_survey_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"send_delay_hours" integer DEFAULT 24 NOT NULL,
	"reminder_delay_hours" integer DEFAULT 72 NOT NULL,
	"expiry_days" integer DEFAULT 14 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_portal_user_id" uuid,
	"template_id" uuid NOT NULL,
	"survey_type" "satisfaction_survey_type" NOT NULL,
	"status" "satisfaction_response_status" DEFAULT 'invited' NOT NULL,
	"related_service_request_id" uuid,
	"related_maintenance_appointment_id" uuid,
	"related_supply_order_id" uuid,
	"related_payment_id" uuid,
	"invitation_sent_at" timestamp,
	"first_viewed_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"reminder_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"access_token" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"overall_score" numeric(4, 2),
	"nps_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_satisfaction_surveys_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "customer_service_request_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_request_id" uuid NOT NULL,
	"previous_status" "service_request_status",
	"new_status" "service_request_status" NOT NULL,
	"change_reason" text,
	"customer_visible_notes" text,
	"internal_notes" text,
	"changed_by_type" varchar(50) NOT NULL,
	"changed_by_id" uuid,
	"changed_by_name" varchar(255) NOT NULL,
	"estimated_completion_date" timestamp,
	"actual_completion_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"scroll_position" integer DEFAULT 0 NOT NULL,
	"reading_progress" integer DEFAULT 0 NOT NULL,
	"current_section_id" varchar(255),
	"completed" boolean DEFAULT false NOT NULL,
	"total_time_seconds" integer DEFAULT 0 NOT NULL,
	"last_read_duration" integer DEFAULT 0 NOT NULL,
	"first_viewed_at" timestamp DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "reading_history_user_article_unique" UNIQUE("user_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "technician_availability_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"technician_name" varchar,
	"date" timestamp NOT NULL,
	"start_time" varchar NOT NULL,
	"end_time" varchar NOT NULL,
	"duration" integer NOT NULL,
	"is_available" boolean DEFAULT true,
	"is_blocked" boolean DEFAULT false,
	"block_reason" varchar,
	"appointment_id" varchar,
	"appointment_type" varchar,
	"service_area" varchar,
	"max_travel_distance" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"report_key" varchar NOT NULL,
	"report_name" varchar NOT NULL,
	"report_category" varchar NOT NULL,
	"description" text,
	"required_permission" varchar,
	"applicable_roles" text[],
	"date_range" varchar DEFAULT 'last_30_days',
	"custom_start_date" timestamp,
	"custom_end_date" timestamp,
	"filters" jsonb DEFAULT '{}'::jsonb,
	"is_scheduled" boolean DEFAULT false,
	"schedule_frequency" varchar,
	"email_recipients" text[],
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"configuration_id" varchar NOT NULL,
	"report_key" varchar NOT NULL,
	"generated_at" timestamp DEFAULT now(),
	"date_range_start" timestamp NOT NULL,
	"date_range_end" timestamp NOT NULL,
	"report_data" jsonb NOT NULL,
	"summary" jsonb,
	"download_url" varchar,
	"created_by" varchar
);
--> statement-breakpoint
DROP INDEX "idx_dashboard_layouts_tenant";--> statement-breakpoint
DROP INDEX "idx_dashboard_layouts_user";--> statement-breakpoint
DROP INDEX "idx_dashboard_layouts_category";--> statement-breakpoint
DROP INDEX "location_history_tenant_id_idx";--> statement-breakpoint
DROP INDEX "location_history_technician_id_idx";--> statement-breakpoint
DROP INDEX "location_history_ticket_id_idx";--> statement-breakpoint
DROP INDEX "location_history_timestamp_idx";--> statement-breakpoint
DROP INDEX "location_history_activity_type_idx";--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ALTER COLUMN "widgets" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ALTER COLUMN "widgets" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "location_history" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "location_history" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "location_history" ALTER COLUMN "heading" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "location_history" ALTER COLUMN "speed" SET DATA TYPE numeric(5, 2);--> statement-breakpoint
ALTER TABLE "location_history" ALTER COLUMN "timestamp" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "location_history" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "name" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "proposal_approvals" ALTER COLUMN "approval_level" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "proposal_approvals" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal_comments" ALTER COLUMN "comment_type" SET DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "proposal_comments" ALTER COLUMN "comment_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ALTER COLUMN "quantity" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ALTER COLUMN "unit_cost" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ALTER COLUMN "total_price" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "version" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "version" SET DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "subtotal" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "subtotal" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "discount_amount" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "discount_percentage" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "tax_amount" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "total_amount" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "total_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "assigned_to" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "title" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "status" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "priority" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "tags" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "tags" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD COLUMN "role_id" varchar;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD COLUMN "is_user_custom" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD COLUMN "columns" integer DEFAULT 12;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD COLUMN "gap" integer DEFAULT 4;--> statement-breakpoint
ALTER TABLE "equipment_packages" ADD COLUMN "total_value" numeric;--> statement-breakpoint
ALTER TABLE "equipment_packages" ADD COLUMN "discount_percentage" numeric;--> statement-breakpoint
ALTER TABLE "equipment_packages" ADD COLUMN "margin_percentage" numeric;--> statement-breakpoint
ALTER TABLE "location_history" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "location_history" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "estimated_hours" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "actual_hours" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "proposal_analytics" ADD COLUMN "event_timestamp" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "proposal_analytics" ADD COLUMN "user_id" varchar;--> statement-breakpoint
ALTER TABLE "proposal_approvals" ADD COLUMN "required_by" varchar;--> statement-breakpoint
ALTER TABLE "proposal_approvals" ADD COLUMN "approved_by" varchar;--> statement-breakpoint
ALTER TABLE "proposal_approvals" ADD COLUMN "approval_comments" text;--> statement-breakpoint
ALTER TABLE "proposal_comments" ADD COLUMN "is_internal" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD COLUMN "service_frequency" varchar;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD COLUMN "service_duration" varchar;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD COLUMN "equipment_condition" varchar;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD COLUMN "warranty_info" text;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD COLUMN "is_alternative" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD COLUMN "package_id" varchar;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD COLUMN "specifications" jsonb;--> statement-breakpoint
ALTER TABLE "proposal_templates" ADD COLUMN "name" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal_templates" ADD COLUMN "category" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal_templates" ADD COLUMN "access_level" varchar DEFAULT 'company';--> statement-breakpoint
ALTER TABLE "proposal_templates" ADD COLUMN "styling" jsonb DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "proposal_templates" ADD COLUMN "team_id" varchar;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "company_introduction" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "solution_overview" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "terms_and_conditions" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "investment_summary" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "next_steps" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "estimated_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "estimated_end_date" timestamp;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "custom_styling" jsonb DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "priority" varchar DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "customer_id" varchar;--> statement-breakpoint
ALTER TABLE "customer_maintenance_appointments" ADD CONSTRAINT "customer_maintenance_appointments_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_survey_questions" ADD CONSTRAINT "customer_satisfaction_survey_questions_template_id_customer_satisfaction_survey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."customer_satisfaction_survey_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_survey_responses" ADD CONSTRAINT "customer_satisfaction_survey_responses_survey_id_customer_satisfaction_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."customer_satisfaction_surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_survey_responses" ADD CONSTRAINT "customer_satisfaction_survey_responses_question_id_customer_satisfaction_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."customer_satisfaction_survey_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_customer_portal_user_id_customer_portal_access_id_fk" FOREIGN KEY ("customer_portal_user_id") REFERENCES "public"."customer_portal_access"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_template_id_customer_satisfaction_survey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."customer_satisfaction_survey_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_related_service_request_id_customer_service_requests_id_fk" FOREIGN KEY ("related_service_request_id") REFERENCES "public"."customer_service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_related_maintenance_appointment_id_customer_maintenance_appointments_id_fk" FOREIGN KEY ("related_maintenance_appointment_id") REFERENCES "public"."customer_maintenance_appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_related_supply_order_id_customer_supply_orders_id_fk" FOREIGN KEY ("related_supply_order_id") REFERENCES "public"."customer_supply_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_satisfaction_surveys" ADD CONSTRAINT "customer_satisfaction_surveys_related_payment_id_customer_payments_id_fk" FOREIGN KEY ("related_payment_id") REFERENCES "public"."customer_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_service_request_status_history" ADD CONSTRAINT "customer_service_request_status_history_service_request_id_customer_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."customer_service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_availability_slots" ADD CONSTRAINT "technician_availability_slots_appointment_id_customer_maintenance_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."customer_maintenance_appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmark_user_idx" ON "article_bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmark_tenant_user_idx" ON "article_bookmarks" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "rating_article_idx" ON "article_ratings" USING btree ("article_id","rating");--> statement-breakpoint
CREATE INDEX "rating_user_idx" ON "article_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rating_tenant_article_idx" ON "article_ratings" USING btree ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "rating_created_idx" ON "article_ratings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "vote_article_idx" ON "article_votes" USING btree ("article_id","vote_type");--> statement-breakpoint
CREATE INDEX "vote_user_idx" ON "article_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vote_tenant_article_idx" ON "article_votes" USING btree ("tenant_id","article_id");--> statement-breakpoint
CREATE INDEX "billing_disputes_tenant_id_idx" ON "billing_disputes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_disputes_tenant_status_idx" ON "billing_disputes" USING btree ("tenant_id","dispute_status");--> statement-breakpoint
CREATE INDEX "billing_disputes_tenant_invoice_idx" ON "billing_disputes" USING btree ("tenant_id","invoice_id");--> statement-breakpoint
CREATE INDEX "billing_disputes_tenant_customer_idx" ON "billing_disputes" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "billing_disputes_tenant_dispute_num_idx" ON "billing_disputes" USING btree ("tenant_id","dispute_number");--> statement-breakpoint
CREATE INDEX "blog_content_queue_status_idx" ON "blog_content_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_content_queue_priority_idx" ON "blog_content_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "blog_content_queue_tenant_idx" ON "blog_content_queue" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_content_queue_created_at_idx" ON "blog_content_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "credit_memos_tenant_id_idx" ON "credit_memos" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "credit_memos_tenant_status_idx" ON "credit_memos" USING btree ("tenant_id","credit_status");--> statement-breakpoint
CREATE INDEX "credit_memos_tenant_customer_idx" ON "credit_memos" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "credit_memos_tenant_invoice_idx" ON "credit_memos" USING btree ("tenant_id","invoice_id");--> statement-breakpoint
CREATE INDEX "credit_memos_tenant_memo_num_idx" ON "credit_memos" USING btree ("tenant_id","credit_memo_number");--> statement-breakpoint
CREATE INDEX "analytics_tenant_period_idx" ON "customer_satisfaction_analytics" USING btree ("tenant_id","period_type","period_start");--> statement-breakpoint
CREATE INDEX "analytics_period_idx" ON "customer_satisfaction_analytics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "survey_question_template_order_idx" ON "customer_satisfaction_survey_questions" USING btree ("template_id","order_index");--> statement-breakpoint
CREATE INDEX "survey_question_category_idx" ON "customer_satisfaction_survey_questions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "survey_response_survey_question_idx" ON "customer_satisfaction_survey_responses" USING btree ("survey_id","question_id");--> statement-breakpoint
CREATE INDEX "survey_response_rating_idx" ON "customer_satisfaction_survey_responses" USING btree ("rating_value");--> statement-breakpoint
CREATE INDEX "survey_template_tenant_type_idx" ON "customer_satisfaction_survey_templates" USING btree ("tenant_id","survey_type");--> statement-breakpoint
CREATE INDEX "survey_template_active_idx" ON "customer_satisfaction_survey_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "survey_tenant_customer_idx" ON "customer_satisfaction_surveys" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "survey_status_idx" ON "customer_satisfaction_surveys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "survey_type_idx" ON "customer_satisfaction_surveys" USING btree ("survey_type");--> statement-breakpoint
CREATE INDEX "survey_completed_idx" ON "customer_satisfaction_surveys" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "survey_access_token_idx" ON "customer_satisfaction_surveys" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "status_history_tenant_idx" ON "customer_service_request_status_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "status_history_request_idx" ON "customer_service_request_status_history" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "status_history_status_idx" ON "customer_service_request_status_history" USING btree ("new_status");--> statement-breakpoint
CREATE INDEX "status_history_timeline_idx" ON "customer_service_request_status_history" USING btree ("service_request_id","created_at");--> statement-breakpoint
CREATE INDEX "reading_history_user_idx" ON "reading_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reading_history_last_viewed_idx" ON "reading_history" USING btree ("user_id","last_viewed_at");--> statement-breakpoint
CREATE INDEX "reading_history_completed_idx" ON "reading_history" USING btree ("user_id","completed");--> statement-breakpoint
CREATE INDEX "report_config_tenant_idx" ON "report_configurations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "report_config_key_idx" ON "report_configurations" USING btree ("report_key");--> statement-breakpoint
CREATE INDEX "snapshot_tenant_idx" ON "report_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "snapshot_config_idx" ON "report_snapshots" USING btree ("configuration_id");--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_session_id_mobile_service_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mobile_service_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_layouts_tenant_id_idx" ON "dashboard_layouts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dashboard_layouts_user_id_idx" ON "dashboard_layouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dashboard_layouts_role_id_idx" ON "dashboard_layouts" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "dashboard_layouts" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "dashboard_layouts" DROP COLUMN "layout";--> statement-breakpoint
ALTER TABLE "dashboard_layouts" DROP COLUMN "is_public";--> statement-breakpoint
ALTER TABLE "dashboard_layouts" DROP COLUMN "allowed_roles";--> statement-breakpoint
ALTER TABLE "dashboard_layouts" DROP COLUMN "allowed_users";--> statement-breakpoint
ALTER TABLE "dashboard_layouts" DROP COLUMN "display_order";--> statement-breakpoint
ALTER TABLE "dashboard_layouts" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "dashboard_layouts" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "equipment_packages" DROP COLUMN "base_price";--> statement-breakpoint
ALTER TABLE "equipment_packages" DROP COLUMN "total_retail_price";--> statement-breakpoint
ALTER TABLE "equipment_packages" DROP COLUMN "recommended_selling_price";--> statement-breakpoint
ALTER TABLE "location_history" DROP COLUMN "altitude";--> statement-breakpoint
ALTER TABLE "location_history" DROP COLUMN "ticket_id";--> statement-breakpoint
ALTER TABLE "location_history" DROP COLUMN "customer_id";--> statement-breakpoint
ALTER TABLE "location_history" DROP COLUMN "activity_type";--> statement-breakpoint
ALTER TABLE "location_history" DROP COLUMN "distance_from_previous";--> statement-breakpoint
ALTER TABLE "location_history" DROP COLUMN "distance_from_ticket";--> statement-breakpoint
ALTER TABLE "location_history" DROP COLUMN "device_id";--> statement-breakpoint
ALTER TABLE "location_history" DROP COLUMN "battery_level";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "project_manager";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "contract_id";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "estimated_budget";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "actual_budget";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "color";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "template";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "workflow";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "custom_fields";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "completed_at";--> statement-breakpoint
ALTER TABLE "proposal_analytics" DROP COLUMN "visitor_id";--> statement-breakpoint
ALTER TABLE "proposal_analytics" DROP COLUMN "session_id";--> statement-breakpoint
ALTER TABLE "proposal_analytics" DROP COLUMN "timestamp";--> statement-breakpoint
ALTER TABLE "proposal_approvals" DROP COLUMN "approval_type";--> statement-breakpoint
ALTER TABLE "proposal_approvals" DROP COLUMN "required_role";--> statement-breakpoint
ALTER TABLE "proposal_approvals" DROP COLUMN "approver_id";--> statement-breakpoint
ALTER TABLE "proposal_approvals" DROP COLUMN "approver_name";--> statement-breakpoint
ALTER TABLE "proposal_approvals" DROP COLUMN "approval_notes";--> statement-breakpoint
ALTER TABLE "proposal_approvals" DROP COLUMN "conditions";--> statement-breakpoint
ALTER TABLE "proposal_approvals" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "proposal_comments" DROP COLUMN "parent_comment_id";--> statement-breakpoint
ALTER TABLE "proposal_comments" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "product_code";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "discount";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "margin";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "is_recurring";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "recurring_frequency";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "recurring_duration";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "lead_time";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "warranty_period";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "service_level";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "is_customizable";--> statement-breakpoint
ALTER TABLE "proposal_line_items" DROP COLUMN "configuration_options";--> statement-breakpoint
ALTER TABLE "proposal_templates" DROP COLUMN "template_name";--> statement-breakpoint
ALTER TABLE "proposal_templates" DROP COLUMN "template_type";--> statement-breakpoint
ALTER TABLE "proposal_templates" DROP COLUMN "header_content";--> statement-breakpoint
ALTER TABLE "proposal_templates" DROP COLUMN "cover_page_template";--> statement-breakpoint
ALTER TABLE "proposal_templates" DROP COLUMN "executive_summary_template";--> statement-breakpoint
ALTER TABLE "proposal_templates" DROP COLUMN "proposal_body_template";--> statement-breakpoint
ALTER TABLE "proposal_templates" DROP COLUMN "terms_conditions_template";--> statement-breakpoint
ALTER TABLE "proposal_templates" DROP COLUMN "footer_template";--> statement-breakpoint
ALTER TABLE "proposal_templates" DROP COLUMN "branding_colors";--> statement-breakpoint
ALTER TABLE "proposal_templates" DROP COLUMN "font_settings";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "customer_needs";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "proposed_solution";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "implementation_plan";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "equipment_package_id";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "custom_equipment";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "payment_terms";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "delivery_terms";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "warranty_terms";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "service_terms";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "e_signature_required";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "e_signature_provider";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "e_signature_document_id";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "e_signature_status";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "time_spent_viewing";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "customer_feedback";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "parent_task_id";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "start_date";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "dependencies";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "watchers";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "time_tracked";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "comment_count";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "attachment_count";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "custom_fields";--> statement-breakpoint
ALTER TABLE "public"."alert_instances" ALTER COLUMN "severity" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."proactive_threat_detection" ALTER COLUMN "severity" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."alert_severity";--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
ALTER TABLE "public"."alert_instances" ALTER COLUMN "severity" SET DATA TYPE "public"."alert_severity" USING "severity"::"public"."alert_severity";--> statement-breakpoint
ALTER TABLE "public"."proactive_threat_detection" ALTER COLUMN "severity" SET DATA TYPE "public"."alert_severity" USING "severity"::"public"."alert_severity";--> statement-breakpoint
ALTER TABLE "public"."alert_instances" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."alert_status";--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('new', 'triaged', 'investigating', 'contained', 'resolved', 'false_positive');--> statement-breakpoint
ALTER TABLE "public"."alert_instances" ALTER COLUMN "status" SET DATA TYPE "public"."alert_status" USING "status"::"public"."alert_status";--> statement-breakpoint
DROP TYPE "public"."duplicate_match_type";--> statement-breakpoint
DROP TYPE "public"."merge_strategy";