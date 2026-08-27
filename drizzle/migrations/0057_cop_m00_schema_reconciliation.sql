DO $$ BEGIN
 CREATE TYPE "public"."custom_field_object_type" AS ENUM('deals', 'leads', 'contacts', 'companies');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'date', 'boolean', 'select', 'multiselect', 'url', 'email');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TYPE "public"."consent_type" ADD VALUE IF NOT EXISTS 'recording';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_associations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"source_id" varchar NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" varchar NOT NULL,
	"relation" varchar(40) DEFAULT 'related' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_associations_link_uq" UNIQUE("tenant_id","source_type","source_id","target_type","target_id","relation")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"parent_type" varchar(20) NOT NULL,
	"parent_id" varchar NOT NULL,
	"body" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"author_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_field_definitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"object_type" "custom_field_object_type" NOT NULL,
	"key" varchar(64) NOT NULL,
	"label" varchar(255) NOT NULL,
	"field_type" "custom_field_type" NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"default_value" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_definitions_tenant_object_key_uq" UNIQUE("tenant_id","object_type","key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_sequence_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"campaign_id" varchar NOT NULL,
	"recipient_email" varchar NOT NULL,
	"business_record_id" varchar,
	"contact_id" varchar,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"next_send_at" timestamp,
	"last_sent_at" timestamp,
	"stopped_reason" text,
	"send_count" integer DEFAULT 0 NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enrolled_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_form_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"form_id" varchar NOT NULL,
	"business_record_id" varchar,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"utm" jsonb,
	"referrer" text,
	"ip_address" varchar,
	"user_agent" text,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"deduped_to_existing" boolean DEFAULT false NOT NULL,
	"processing_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_forms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb,
	"public_token" varchar NOT NULL,
	"submission_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_ai_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"provider" varchar(32) NOT NULL,
	"model" varchar(80),
	"feature" varchar(64) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"request_id" varchar(200),
	"post_id" uuid,
	"pipeline_run_id" uuid,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_ai_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"monthly_limit_cents" integer,
	"warn_threshold_pct" integer DEFAULT 80 NOT NULL,
	"hard_stop" boolean DEFAULT true NOT NULL,
	"anomaly_multiplier" numeric(5, 2) DEFAULT '3' NOT NULL,
	"alert_email" varchar(320),
	"alert_slack_webhook" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_ai_quotas_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"bio" text,
	"headshot_asset_id" uuid,
	"headshot_url" text,
	"credentials" text,
	"job_title" varchar(200),
	"expertise_tags" text[],
	"social_links" jsonb,
	"schema_person" jsonb,
	"user_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"element_type" varchar(20) NOT NULL,
	"variant_a" jsonb NOT NULL,
	"variant_b" jsonb NOT NULL,
	"serving_mode" varchar(16) DEFAULT 'weekly_alternate' NOT NULL,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"winner" varchar(8),
	"significance" jsonb,
	"min_sample" integer DEFAULT 100 NOT NULL,
	"auto_promote" boolean DEFAULT false NOT NULL,
	"approved_by_user_id" varchar,
	"promoted_at" timestamp,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"a_impressions" integer DEFAULT 0 NOT NULL,
	"a_clicks" integer DEFAULT 0 NOT NULL,
	"a_assignments" integer DEFAULT 0 NOT NULL,
	"a_conversions" integer DEFAULT 0 NOT NULL,
	"b_impressions" integer DEFAULT 0 NOT NULL,
	"b_clicks" integer DEFAULT 0 NOT NULL,
	"b_assignments" integer DEFAULT 0 NOT NULL,
	"b_conversions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_outline_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"brief_id" uuid,
	"keyword" varchar(500) NOT NULL,
	"angle" varchar(32),
	"target_intent" varchar(20),
	"outline" jsonb NOT NULL,
	"serp_fit_score" numeric(5, 2),
	"differentiation_score" numeric(5, 2),
	"scoring_rationale" text,
	"status" varchar(16) DEFAULT 'candidate' NOT NULL,
	"ab_test_group" uuid,
	"post_id" uuid,
	"serp_snapshot_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"brief_id" uuid,
	"post_id" uuid,
	"topic" varchar(500) NOT NULL,
	"target_keyword" varchar(500),
	"brand_voice_id" uuid,
	"stages_config" jsonb,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"current_stage" varchar(24),
	"total_cost_cents" integer DEFAULT 0 NOT NULL,
	"total_latency_ms" integer DEFAULT 0 NOT NULL,
	"error" jsonb,
	"agent_run_id" varchar(100),
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"tenant_id" varchar NOT NULL,
	"stage" varchar(24) NOT NULL,
	"seq" integer NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"model" varchar(80),
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_post_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"audience_key" varchar(64) NOT NULL,
	"audience_label" varchar(200),
	"intro" text,
	"examples" jsonb,
	"cta" jsonb,
	"match_rules" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"served_count" integer DEFAULT 0 NOT NULL,
	"conversion_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_qa_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"overall_pass" boolean DEFAULT false NOT NULL,
	"link_check" jsonb,
	"og_preview" jsonb,
	"a11y" jsonb,
	"schema_check" jsonb,
	"summary" jsonb,
	"overridden" boolean DEFAULT false NOT NULL,
	"override_reason" text,
	"override_by_user_id" varchar,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_rank_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"keyword" varchar(500),
	"search_volume" integer,
	"keyword_difficulty" integer,
	"domain_authority" integer,
	"quality_score" numeric(5, 2),
	"serp_competitiveness" numeric(5, 2),
	"predicted_rank_low" integer,
	"predicted_rank_high" integer,
	"predicted_position" numeric(6, 2),
	"predicted_clicks_month" integer,
	"confidence" varchar(8),
	"recommendation" varchar(32),
	"rationale" text,
	"inputs" jsonb,
	"calibration" jsonb,
	"actual_position" numeric(6, 2),
	"actual_clicks_month" integer,
	"actuals_updated_at" timestamp,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_failure_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"machine_id" varchar NOT NULL,
	"predicted_window_start" timestamp,
	"predicted_window_end" timestamp,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"signals" jsonb,
	"contract_value" double precision DEFAULT 0,
	"service_ticket_id" varchar,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"outcome" varchar(20),
	"snoozed_until" timestamp,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "predictive_dispatch_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"agent_enabled" boolean DEFAULT true NOT NULL,
	"confidence_threshold" double precision DEFAULT 0.7 NOT NULL,
	"paused_at" timestamp,
	"paused_reason" varchar(500),
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "churn_risk_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"weights" jsonb,
	"watch_threshold" integer DEFAULT 31 NOT NULL,
	"at_risk_threshold" integer DEFAULT 61 NOT NULL,
	"digest_enabled" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_churn_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"band" varchar(20) DEFAULT 'healthy' NOT NULL,
	"signals" jsonb,
	"contract_value" double precision DEFAULT 0,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_pnl_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"tech_burdened_rate" numeric(10, 2) DEFAULT '75.00' NOT NULL,
	"avg_part_cost" numeric(10, 2) DEFAULT '45.00' NOT NULL,
	"financing_rate" double precision DEFAULT 0 NOT NULL,
	"gp_alert_threshold" integer DEFAULT 20 NOT NULL,
	"digest_enabled" boolean DEFAULT true NOT NULL,
	"last_refreshed_at" timestamp,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "renewal_auto_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"contract_id" varchar NOT NULL,
	"parent_contract_id" varchar,
	"customer_id" varchar NOT NULL,
	"status" varchar(24) DEFAULT 'renewal_draft' NOT NULL,
	"assigned_sales_rep" varchar,
	"contract_end_date" timestamp,
	"expiration_date" timestamp,
	"total_black_pages" integer DEFAULT 0 NOT NULL,
	"total_color_pages" integer DEFAULT 0 NOT NULL,
	"monthly_avg_black" double precision DEFAULT 0 NOT NULL,
	"monthly_avg_color" double precision DEFAULT 0 NOT NULL,
	"peak_month" varchar,
	"peak_volume" integer DEFAULT 0 NOT NULL,
	"machine_breakdown" jsonb,
	"current_black_rate" double precision,
	"current_color_rate" double precision,
	"current_monthly_base" double precision,
	"recommended_black_rate" double precision,
	"recommended_color_rate" double precision,
	"recommended_monthly_base" double precision,
	"current_monthly_revenue" double precision DEFAULT 0 NOT NULL,
	"recommended_monthly_revenue" double precision DEFAULT 0 NOT NULL,
	"is_underage" boolean DEFAULT false NOT NULL,
	"retier_detail" jsonb,
	"line_items" jsonb,
	"quote_value" double precision DEFAULT 0 NOT NULL,
	"outcome" varchar(12) DEFAULT 'pending' NOT NULL,
	"outcome_at" timestamp,
	"outcome_note" varchar,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "renewal_autoquote_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"days_window_start" integer DEFAULT 90 NOT NULL,
	"days_window_end" integer DEFAULT 100 NOT NULL,
	"growth_buffer_pct" integer DEFAULT 10 NOT NULL,
	"underage_threshold_pct" integer DEFAULT 10 NOT NULL,
	"expiration_days" integer DEFAULT 30 NOT NULL,
	"auto_generate_enabled" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "renewal_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"reason" varchar,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qbr_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"quarter" varchar(12) NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"content" jsonb,
	"pdf_url" varchar,
	"html_url" varchar,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"sent_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qbr_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"reason" varchar,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "truck_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tech_user_id" varchar NOT NULL,
	"part_sku" varchar NOT NULL,
	"quantity_on_truck" integer DEFAULT 0 NOT NULL,
	"capacity_constraint" integer,
	"last_audited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "truck_stock_callbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tech_user_id" varchar,
	"ticket_id" varchar,
	"missing_part_sku" varchar,
	"note" varchar,
	"unit_cost" numeric(10, 4),
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "truck_stock_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tech_user_id" varchar NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"current_fill_rate" double precision DEFAULT 0 NOT NULL,
	"projected_fill_rate" double precision DEFAULT 0 NOT NULL,
	"capacity_total" integer,
	"capacity_distinct" integer,
	"recommended_items" jsonb,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"picked_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "truck_stock_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tech_user_id" varchar NOT NULL,
	"max_total_quantity" integer DEFAULT 120 NOT NULL,
	"max_distinct_skus" integer DEFAULT 40 NOT NULL,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deal_desk_copilot_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"gp_floor_pct" double precision DEFAULT 30 NOT NULL,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_briefing_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(24) NOT NULL,
	"briefing_date" varchar(10) NOT NULL,
	"variant" varchar(12) DEFAULT 'numbers' NOT NULL,
	"subject" varchar(300),
	"email_sent" boolean DEFAULT false NOT NULL,
	"in_app_sent" boolean DEFAULT false NOT NULL,
	"content" jsonb,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"opened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_briefing_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"frequency" varchar(12) DEFAULT 'daily' NOT NULL,
	"role" varchar(24),
	"email_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"ab_variant" varchar(12) DEFAULT 'numbers' NOT NULL,
	"last_sent_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portal_service_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"request_id" varchar NOT NULL,
	"service_ticket_id" varchar,
	"raw_text" varchar(2000),
	"category" varchar(80),
	"suggested_priority" varchar(16),
	"recommended_parts" jsonb,
	"suggested_tech_id" varchar,
	"playbook" jsonb,
	"confidence" double precision,
	"source" varchar(12) DEFAULT 'fallback' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "machine_supply_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"machine_id" varchar NOT NULL,
	"color" varchar(2) NOT NULL,
	"percent_remaining" double precision,
	"page_count_remaining" integer,
	"source" varchar(16) DEFAULT 'injected' NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "machine_supply_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"machine_id" varchar NOT NULL,
	"auto_ship_enabled" boolean DEFAULT true NOT NULL,
	"cost_ceiling" double precision,
	"emergency_override" boolean DEFAULT false NOT NULL,
	"customer_managed" boolean DEFAULT false NOT NULL,
	"lead_time_days" integer,
	"safety_buffer_days" integer,
	"updated_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supply_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"machine_id" varchar NOT NULL,
	"color" varchar(2),
	"status" varchar(20) DEFAULT 'pending_approval' NOT NULL,
	"vendor" varchar,
	"part_number" varchar,
	"supply_name" varchar,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost" numeric(10, 2),
	"total_cost" numeric(10, 2),
	"predicted_depletion_date" timestamp,
	"trigger_reason" varchar(300),
	"tracking_number" varchar,
	"carrier" varchar,
	"expected_arrival_date" timestamp,
	"customer_notified" boolean DEFAULT false NOT NULL,
	"is_emergency" boolean DEFAULT false NOT NULL,
	"created_by_user_id" varchar,
	"shipped_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_supply_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"approval_cost_threshold" double precision DEFAULT 150 NOT NULL,
	"default_lead_time_days" integer DEFAULT 5 NOT NULL,
	"default_safety_buffer_days" integer DEFAULT 3 NOT NULL,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meter_read_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"max_delta_multiplier" integer DEFAULT 3 NOT NULL,
	"confirm_template" varchar(1000),
	"clarify_template" varchar(1000),
	"encrypted_config" jsonb,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meter_read_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source" varchar(12) DEFAULT 'manual' NOT NULL,
	"from_phone" varchar,
	"customer_id" varchar,
	"machine_id" varchar,
	"raw_image_url" varchar,
	"image_hash" varchar,
	"extracted_values" jsonb,
	"validation_status" varchar(16) DEFAULT 'pending' NOT NULL,
	"validation_detail" jsonb,
	"outbound_message" varchar(1000),
	"meter_reading_id" varchar,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_knowledge_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"federated_opt_in" jsonb,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_ticket_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"machine_model" varchar,
	"error_codes" varchar(500),
	"content" varchar(8000),
	"content_hash" varchar,
	"embedding" jsonb,
	"embedding_source" varchar(16) DEFAULT 'fallback' NOT NULL,
	"embedded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voice_ticket_closes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"tech_user_id" varchar,
	"client_dedupe_key" varchar,
	"audio_url" varchar,
	"transcript" varchar(8000),
	"transcript_source" varchar(16) DEFAULT 'fallback' NOT NULL,
	"extracted" jsonb,
	"extraction_source" varchar(16) DEFAULT 'fallback' NOT NULL,
	"sku_resolutions" jsonb,
	"draft_invoice_items" jsonb,
	"labor_minutes" integer,
	"follow_up_needed" boolean DEFAULT false NOT NULL,
	"status" varchar(12) DEFAULT 'draft' NOT NULL,
	"audio_purge_at" timestamp,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_autopilot_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar(12) NOT NULL,
	"email_address" varchar,
	"encrypted_tokens" jsonb,
	"voice_fingerprint" jsonb,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_scan_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_autopilot_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"provider_message_id" varchar,
	"thread_id" varchar,
	"contact_email" varchar,
	"crm_contact_id" varchar,
	"classification" varchar(16) DEFAULT 'needs_reply' NOT NULL,
	"classification_confidence" double precision,
	"inbound_subject" varchar(500),
	"inbound_snippet" varchar(2000),
	"draft_subject" varchar(500),
	"draft_body" varchar(8000),
	"draft_source" varchar(12) DEFAULT 'fallback' NOT NULL,
	"external_draft_id" varchar,
	"status" varchar(12) DEFAULT 'draft' NOT NULL,
	"edit_distance_pct" double precision,
	"final_body" varchar(8000),
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_autopilot_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"contact_email" varchar NOT NULL,
	"reason" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chatbot_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"platform" varchar(12) NOT NULL,
	"team_id" varchar NOT NULL,
	"team_name" varchar,
	"encrypted_tokens" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"installed_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chatbot_query_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"platform" varchar(12),
	"channel" varchar,
	"platform_user_id" varchar,
	"printyx_user_id" varchar,
	"question" varchar(2000),
	"tools_called" jsonb,
	"response_excerpt" varchar(2000),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chatbot_user_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"platform" varchar(12) NOT NULL,
	"platform_user_id" varchar NOT NULL,
	"email" varchar,
	"printyx_user_id" varchar,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voice_agent_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"call_sid" varchar,
	"from_number" varchar,
	"caller_customer_id" varchar,
	"language" varchar(8),
	"transcript" varchar(8000),
	"recording_url" varchar,
	"recording_purge_at" timestamp,
	"detected_issue" varchar(2000),
	"machine_ref" varchar,
	"callback_number" varchar,
	"priority" varchar(4),
	"ticket_id" varchar,
	"escalated" boolean DEFAULT false NOT NULL,
	"on_call_tech_id" varchar,
	"twilio_cost" double precision DEFAULT 0 NOT NULL,
	"ai_cost" double precision DEFAULT 0 NOT NULL,
	"total_cost" double precision DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voice_agent_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"after_hours_only" boolean DEFAULT true NOT NULL,
	"business_hours" jsonb,
	"languages" jsonb,
	"pii_redaction" boolean DEFAULT true NOT NULL,
	"twilio_number" varchar,
	"encrypted_config" jsonb,
	"updated_by_user_id" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_syndication_pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"platform" varchar(40) NOT NULL,
	"variant_label" varchar(200),
	"content" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"post_url" varchar(2000),
	"utm" jsonb,
	"target_config" jsonb,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_citation_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"citation_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"og_image_url" text,
	"excerpt" text,
	"display_order" integer,
	"fetch_adapter" varchar(64),
	"fetched_at" timestamp,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_cluster_authority_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cluster_id" uuid NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"breakdown" jsonb,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_cluster_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cluster_id" uuid NOT NULL,
	"name" varchar(200),
	"pillar_keyword" varchar(500),
	"supporting_keywords" jsonb,
	"status" varchar(16) DEFAULT 'planned' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_community_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source" varchar(20) NOT NULL,
	"source_context" varchar(255),
	"url" text,
	"title" text NOT NULL,
	"score" integer,
	"top_answer_snippet" text,
	"theme" varchar(255),
	"cluster_id" uuid,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_community_seeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"subreddits" jsonb,
	"quora_topics" jsonb,
	"stackexchange_sites" jsonb,
	"target_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_internal_link_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_post_id" uuid NOT NULL,
	"target_post_id" uuid NOT NULL,
	"anchor_text" text,
	"similarity" numeric(6, 5),
	"insert_meta" jsonb,
	"status" varchar(16) DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_keyword_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"keyword_id" uuid NOT NULL,
	"embedding_model" varchar(64),
	"embedding" jsonb,
	"dims" integer,
	"source_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_post_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"embedding_model" varchar(64),
	"embedding" jsonb,
	"dims" integer,
	"primary_keyword" varchar(500),
	"content_hash" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_readability_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"flesch_kincaid_grade" numeric(5, 2),
	"target_grade" numeric(5, 2),
	"persona_match_score" integer,
	"analysis" jsonb,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_chart_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid,
	"data_asset_id" uuid,
	"chart_type" varchar(20) NOT NULL,
	"title" varchar(500),
	"spec" jsonb,
	"source" jsonb,
	"description" text,
	"alt_text" text,
	"asset_id" uuid,
	"png_ref" varchar(1000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_content_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"scan_type" varchar(20) NOT NULL,
	"provider" varchar(40),
	"score" integer,
	"matches" jsonb,
	"threshold_pct" integer,
	"passed" boolean,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_data_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid,
	"name" varchar(300) NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"source_ref" text,
	"columns" jsonb,
	"rows" jsonb,
	"row_count" integer,
	"encrypted_config" jsonb,
	"citation_id" uuid,
	"refreshed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_factcheck_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"claims" jsonb,
	"claim_count" integer,
	"flagged_count" integer,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_decay_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"severity" varchar(12) DEFAULT 'none' NOT NULL,
	"triggers" jsonb NOT NULL,
	"current_window" jsonb,
	"prior_window" jsonb,
	"deltas" jsonb,
	"refresh_queue_id" uuid,
	"notification_channel" varchar(16),
	"notification_status" varchar(16),
	"notification_detail" jsonb,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_link_injection_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"batch_id" uuid NOT NULL,
	"pillar_post_id" uuid NOT NULL,
	"target_post_id" uuid NOT NULL,
	"similarity_score" numeric(6, 4),
	"anchor_text" varchar(300),
	"sentence_before" varchar(4000),
	"sentence_after" varchar(4000),
	"pillar_url" varchar(2000),
	"status" varchar(16) DEFAULT 'proposed' NOT NULL,
	"applied_revision_id" uuid,
	"cms_push_result" jsonb,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_refresh_queue_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"queue_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"severity" varchar(12),
	"suggested_edits" jsonb,
	"estimated_effort" jsonb,
	"last_refreshed_at" timestamp,
	"baseline_position" numeric(6, 2),
	"recovery_status" varchar(16),
	"recovery_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_reshare_cadences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"published_at" timestamp,
	"steps" jsonb NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"engagement_stop_threshold" numeric(6, 4),
	"auto_stopped_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_schedule_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"platform" varchar(40) NOT NULL,
	"buckets" jsonb NOT NULL,
	"ranked_slots" jsonb NOT NULL,
	"source" varchar(24) DEFAULT 'industry_default' NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_utm_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) DEFAULT 'Default' NOT NULL,
	"source_template" varchar(200) DEFAULT '{platform}' NOT NULL,
	"medium_template" varchar(200) DEFAULT '{channel}' NOT NULL,
	"campaign_template" varchar(200) DEFAULT '{post_slug}' NOT NULL,
	"content_template" varchar(200),
	"term_template" varchar(200),
	"short_link_provider" varchar(24),
	"short_link_config" jsonb,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_backlink_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"backlink_id" uuid,
	"post_id" uuid,
	"event_type" varchar(24) NOT NULL,
	"source_domain" varchar(255),
	"source_url" varchar(2000),
	"last_seen_url" varchar(2000),
	"domain_authority" integer,
	"notified" boolean DEFAULT false NOT NULL,
	"notified_at" timestamp,
	"detail" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_backlinks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid,
	"source_domain" varchar(255) NOT NULL,
	"source_url" varchar(2000) NOT NULL,
	"target_url" varchar(2000),
	"domain_authority" integer,
	"anchor_text" varchar(1000),
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"lost_at" timestamp,
	"source" varchar(40),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_brand_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"url" varchar(2000) NOT NULL,
	"source_domain" varchar(255),
	"snippet" text,
	"has_link" boolean DEFAULT false NOT NULL,
	"domain_authority" integer,
	"status" varchar(20) DEFAULT 'detected' NOT NULL,
	"thread_id" uuid,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"last_checked_at" timestamp,
	"link_added_at" timestamp,
	"source" varchar(40),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_haro_pitches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"query_id" uuid NOT NULL,
	"author_id" uuid,
	"pitch_text" text NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"evidence_post_ids" jsonb,
	"approved_by_user_id" varchar,
	"approved_at" timestamp,
	"sent_at" timestamp,
	"replied_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_haro_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_id" varchar(200),
	"subject" varchar(500),
	"query_text" text NOT NULL,
	"category" varchar(200),
	"outlet" varchar(255),
	"deadline" timestamp,
	"matched_author_id" uuid,
	"match_score" numeric(5, 2),
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"source" varchar(40),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_outreach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"thread_id" uuid NOT NULL,
	"direction" varchar(8) NOT NULL,
	"subject" varchar(500),
	"body" text NOT NULL,
	"kind" varchar(24),
	"classification" varchar(24),
	"proposed_next_action" text,
	"sent_at" timestamp,
	"received_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_outreach_prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid,
	"site_domain" varchar(255) NOT NULL,
	"contact_email" varchar(320),
	"contact_name" varchar(200),
	"contact_role" varchar(200),
	"domain_authority" integer,
	"relevance_score" numeric(5, 2),
	"is_directory" boolean DEFAULT false NOT NULL,
	"suggested_angle" text,
	"source_competitor_url" varchar(2000),
	"contact_source" varchar(40),
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"thread_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_outreach_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"prospect_id" uuid,
	"brand_mention_id" uuid,
	"post_id" uuid,
	"recipient_email" varchar(320) NOT NULL,
	"recipient_name" varchar(200),
	"subject" varchar(500),
	"template_key" varchar(120),
	"angle" varchar(200),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"followup_count" integer DEFAULT 0 NOT NULL,
	"last_action_at" timestamp,
	"next_action_at" timestamp,
	"closed_reason" varchar(60),
	"research" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_aeo_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"breakdown" jsonb,
	"suggestions" jsonb,
	"quick_answers" jsonb,
	"json_ld" jsonb,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_analytics_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"provider" varchar(32) NOT NULL,
	"property_id" varchar(400),
	"property_label" varchar(400),
	"connected" boolean DEFAULT false NOT NULL,
	"encrypted_config" jsonb,
	"last_backfill_at" timestamp,
	"last_synced_at" timestamp,
	"metadata" jsonb,
	"status" varchar(20) DEFAULT 'disconnected' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_cohort_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cluster_id" uuid NOT NULL,
	"period" varchar(32) NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue_cents" integer DEFAULT 0 NOT NULL,
	"signup_count" integer DEFAULT 0 NOT NULL,
	"attribution_model" varchar(32) NOT NULL,
	"time_to_conversion_histogram" jsonb,
	"roi" jsonb,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_conversion_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"conversion_kind" varchar(32) NOT NULL,
	"ga4_event_name" varchar(200),
	"attribution_model" varchar(32) DEFAULT 'last_non_direct' NOT NULL,
	"revenue_from_event_value" boolean DEFAULT true NOT NULL,
	"revenue_per_conversion_cents" integer,
	"writing_cost_per_post_cents" integer,
	"tools_cost_per_month_cents" integer,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_kg_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"co_post_ids" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_kg_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(500) NOT NULL,
	"normalized_name" varchar(500) NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"frequency" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp,
	"last_seen_at" timestamp,
	"related_post_ids" jsonb,
	"is_competitor_only" boolean DEFAULT false NOT NULL,
	"cluster_label" varchar(200),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_llm_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cluster_id" uuid,
	"post_id" uuid,
	"engine" varchar(40) NOT NULL,
	"query" varchar(1000) NOT NULL,
	"cited_url" varchar(2000) NOT NULL,
	"cited_domain" varchar(400),
	"is_own_domain" boolean DEFAULT false NOT NULL,
	"rank" integer,
	"in_serp_top10" boolean,
	"raw_data" jsonb,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_auto_refresh_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"auto_refresh_requires_review" boolean DEFAULT false NOT NULL,
	"max_body_change_pct" integer DEFAULT 40 NOT NULL,
	"block_on_seo_score_drop" boolean DEFAULT true NOT NULL,
	"block_on_brand_voice_violation" boolean DEFAULT true NOT NULL,
	"min_days_between_refresh" integer DEFAULT 14 NOT NULL,
	"max_posts_per_run" integer DEFAULT 10 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar,
	CONSTRAINT "blog_auto_refresh_config_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_auto_refresh_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"reason" varchar(32) NOT NULL,
	"reason_detail" jsonb,
	"proposed_content" jsonb,
	"change_summary" text,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"resolved_by_user_id" varchar,
	"resolved_at" timestamp,
	"resolution_note" text,
	"revision_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_auto_refresh_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"refresh_queue_id" uuid,
	"trigger" varchar(16) DEFAULT 'cron' NOT NULL,
	"status" varchar(24) DEFAULT 'running' NOT NULL,
	"serp_diff" jsonb,
	"predicted_body_change_pct" numeric(5, 2),
	"seo_score_before" numeric(5, 2),
	"seo_score_after" numeric(5, 2),
	"guardrail_result" jsonb,
	"revision_id" uuid,
	"review_id" uuid,
	"cms_published" boolean DEFAULT false NOT NULL,
	"cms_result" jsonb,
	"change_summary" text,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"model" varchar(64),
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_competitor_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"competitor_name" varchar(255),
	"domain" varchar(255),
	"feed_url" text NOT NULL,
	"feed_kind" varchar(16) DEFAULT 'rss' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_polled_at" timestamp,
	"last_seen_cursor" text,
	"poll_error_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_competitor_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"feed_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"title" varchar(1000),
	"excerpt" text,
	"published_at" timestamp,
	"detected_fresh" boolean DEFAULT false NOT NULL,
	"summary" text,
	"cluster_id" uuid,
	"overlapping_keywords" text[],
	"targets_our_keyword" boolean DEFAULT false NOT NULL,
	"response_brief" jsonb,
	"brief_id" uuid,
	"status" varchar(16) DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_serp_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source" varchar(24) NOT NULL,
	"channel" varchar(16) NOT NULL,
	"volatility_event_id" uuid,
	"competitor_post_id" uuid,
	"keyword" varchar(500),
	"title" varchar(500),
	"message" text,
	"payload" jsonb,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_serp_monitor_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tier1_keywords" text[],
	"tier1_auto_top_n" integer DEFAULT 50 NOT NULL,
	"alert_channels" text[],
	"alert_config" jsonb,
	"rank_change_threshold" integer DEFAULT 3 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"location_code" integer DEFAULT 2840 NOT NULL,
	"language_code" varchar(16) DEFAULT 'en' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_serp_volatility_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"keyword" varchar(500) NOT NULL,
	"tier" varchar(16) DEFAULT 'standard' NOT NULL,
	"kind" varchar(32) NOT NULL,
	"magnitude" integer DEFAULT 0 NOT NULL,
	"significant" boolean DEFAULT false NOT NULL,
	"previous_rank" integer,
	"current_rank" integer,
	"detail" jsonb,
	"previous_snapshot_id" uuid,
	"current_snapshot_id" uuid,
	"post_id" uuid,
	"refresh_queue_id" uuid,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_glossary_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"term" varchar(300) NOT NULL,
	"mode" varchar(20) DEFAULT 'do_not_translate' NOT NULL,
	"translations" jsonb,
	"case_sensitive" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_interactive_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid,
	"block_type" varchar(20) NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"spec" jsonb NOT NULL,
	"lead_capture_enabled" boolean DEFAULT false NOT NULL,
	"lead_capture_copy" text,
	"embed_mode" varchar(12) DEFAULT 'iframe' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_interactive_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"block_id" uuid NOT NULL,
	"event_type" varchar(20) NOT NULL,
	"session_id" varchar(100),
	"lead_email" varchar(320),
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"locale" varchar(16) NOT NULL,
	"display_name" varchar(120),
	"brand_voice_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_media_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"output_type" varchar(20) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"asset_ref" uuid,
	"spec" jsonb,
	"adapter" varchar(40),
	"voice_licensed" boolean DEFAULT false NOT NULL,
	"author_id" uuid,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_post_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"locale" varchar(16) NOT NULL,
	"translated_title" varchar(500),
	"translated_body" text,
	"translated_meta_title" varchar(300),
	"translated_meta_description" text,
	"translated_slug" varchar(500),
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"requires_review" boolean DEFAULT true NOT NULL,
	"translation_adapter" varchar(40),
	"reviewer_user_id" varchar,
	"publish_date" timestamp,
	"cms_post_id" varchar(200),
	"cms_post_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_pseo_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"template_id" uuid NOT NULL,
	"mode" varchar(12) DEFAULT 'publish' NOT NULL,
	"status" varchar(12) DEFAULT 'queued' NOT NULL,
	"rate_per_hour" integer DEFAULT 50 NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"processed_rows" integer DEFAULT 0 NOT NULL,
	"published_rows" integer DEFAULT 0 NOT NULL,
	"flagged_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp,
	"window_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_pseo_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"job_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"row_key" varchar(300) NOT NULL,
	"variables" jsonb NOT NULL,
	"rendered_title" varchar(500),
	"rendered_slug" varchar(500),
	"rendered_body" text,
	"meta_title" varchar(300),
	"meta_description" text,
	"seo_score" integer,
	"seo_findings" jsonb,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"post_id" uuid,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_pseo_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(300) NOT NULL,
	"data_asset_id" uuid NOT NULL,
	"body_template" text NOT NULL,
	"slug_pattern" varchar(500) NOT NULL,
	"seo_config" jsonb NOT NULL,
	"brand_voice_id" uuid,
	"cms_target_key" varchar(64),
	"min_seo_score" integer DEFAULT 70 NOT NULL,
	"below_threshold_action" varchar(12) DEFAULT 'review' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_publish_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"cms_platform" varchar(40),
	"cms_target_id" uuid,
	"operation" varchar(16) DEFAULT 'create' NOT NULL,
	"cms_post_id" varchar(200),
	"cms_post_url" text,
	"canonical_url" text,
	"stage" varchar(24) DEFAULT 'started' NOT NULL,
	"status" varchar(16) DEFAULT 'in_progress' NOT NULL,
	"uploaded_assets" jsonb,
	"stage_log" jsonb,
	"webhook_intent" jsonb,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"key_prefix" varchar(32) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"scopes" varchar(40)[],
	"rate_limit_per_minute" integer DEFAULT 120 NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"api_key_id" uuid NOT NULL,
	"window_start" timestamp NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"last_endpoint" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_backup_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"scheduled_enabled" boolean DEFAULT false NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"storage_config" jsonb,
	"encrypted_storage_creds" jsonb,
	"last_backup_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"kind" varchar(20) DEFAULT 'manual' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"manifest" jsonb,
	"storage_key" varchar(500),
	"size_bytes" integer,
	"expires_at" timestamp,
	"error" varchar(2000),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_dsar_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"subject_user_id" varchar NOT NULL,
	"request_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'requested' NOT NULL,
	"result" jsonb,
	"error" varchar(2000),
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_type" varchar(60) NOT NULL,
	"payload" jsonb NOT NULL,
	"signature" varchar(128),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_response_status" integer,
	"last_response_body" varchar(2000),
	"next_attempt_at" timestamp,
	"delivered_at" timestamp,
	"attempts" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" varchar(2000) NOT NULL,
	"encrypted_secret" jsonb,
	"event_filter" varchar(60)[],
	"retry_policy" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blog_widget_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"hide_branding" boolean DEFAULT false NOT NULL,
	"logo_url" varchar(2000),
	"theme" varchar(40) DEFAULT 'light' NOT NULL,
	"css_variables" jsonb,
	"encrypted_sso_secret" jsonb,
	"sso_session_ttl_seconds" integer DEFAULT 3600 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_page_bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"booking_page_id" varchar NOT NULL,
	"assigned_user_id" varchar NOT NULL,
	"invitee_name" varchar NOT NULL,
	"invitee_email" varchar NOT NULL,
	"invitee_phone" varchar,
	"invitee_company" varchar,
	"invitee_notes" text,
	"invitee_timezone" varchar DEFAULT 'America/New_York' NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"status" varchar DEFAULT 'confirmed' NOT NULL,
	"calendar_event_id" varchar,
	"external_event_id" varchar,
	"business_record_id" varchar,
	"contact_id" varchar,
	"activity_id" varchar,
	"manage_token" varchar NOT NULL,
	"confirmation_email_sent" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"rescheduled_from_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"owner_user_id" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"timezone" varchar DEFAULT 'America/New_York' NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"min_notice_minutes" integer DEFAULT 240 NOT NULL,
	"date_range_days" integer DEFAULT 30 NOT NULL,
	"slot_interval_minutes" integer DEFAULT 30 NOT NULL,
	"availability_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_type" varchar DEFAULT 'individual' NOT NULL,
	"team_member_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calendar_connection_id" varchar,
	"branding" jsonb,
	"location" varchar,
	"confirmation_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_data_provenance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"subject_type" varchar(20) NOT NULL,
	"subject_id" varchar NOT NULL,
	"subject_email" varchar(320),
	"source" varchar(32) NOT NULL,
	"source_record_id" varchar(128),
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"fields_acquired" jsonb DEFAULT '[]'::jsonb,
	"art14_notice_status" varchar(20) DEFAULT 'not_required' NOT NULL,
	"art14_notice_sent_at" timestamp,
	"art14_exemption_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_suppressions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"email" varchar(320) NOT NULL,
	"reason" varchar(32) NOT NULL,
	"reason_detail" text,
	"source" varchar(32) DEFAULT 'privacy_request' NOT NULL,
	"suppressed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extension_api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"key_hash" varchar NOT NULL,
	"key_prefix" varchar NOT NULL,
	"name" varchar,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"entry_number" varchar NOT NULL,
	"description" text NOT NULL,
	"entry_date" date NOT NULL,
	"reference" varchar,
	"total_debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_credit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leases" ALTER COLUMN "total_paid" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD COLUMN IF NOT EXISTS "legacy_stage_id" varchar;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "dedupe_key" varchar;--> statement-breakpoint
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "resume_at" timestamp;--> statement-breakpoint
ALTER TABLE "business_records" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb;--> statement-breakpoint
ALTER TABLE "company_branding_profiles" ADD COLUMN IF NOT EXISTS "settings" jsonb;--> statement-breakpoint
ALTER TABLE "company_contacts" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb;--> statement-breakpoint
ALTER TABLE "data_import_validations" ADD COLUMN IF NOT EXISTS "raw_rows" jsonb;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD COLUMN IF NOT EXISTS "product_code" varchar;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD COLUMN IF NOT EXISTS "margin" numeric;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "blog_agent_settings" ADD COLUMN IF NOT EXISTS "pipeline_stages_config" jsonb;--> statement-breakpoint
ALTER TABLE "blog_agent_settings" ADD COLUMN IF NOT EXISTS "domain_authority" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blog_authors" ADD CONSTRAINT "blog_authors_headshot_asset_id_blog_assets_id_fk" FOREIGN KEY ("headshot_asset_id") REFERENCES "public"."blog_assets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blog_experiments" ADD CONSTRAINT "blog_experiments_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blog_outline_variants" ADD CONSTRAINT "blog_outline_variants_brief_id_blog_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."blog_briefs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blog_pipeline_runs" ADD CONSTRAINT "blog_pipeline_runs_brief_id_blog_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."blog_briefs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blog_pipeline_runs" ADD CONSTRAINT "blog_pipeline_runs_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blog_pipeline_stages" ADD CONSTRAINT "blog_pipeline_stages_run_id_blog_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."blog_pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blog_post_variants" ADD CONSTRAINT "blog_post_variants_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blog_qa_reports" ADD CONSTRAINT "blog_qa_reports_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blog_rank_forecasts" ADD CONSTRAINT "blog_rank_forecasts_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_associations_tenant_source_idx" ON "crm_associations" USING btree ("tenant_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_associations_tenant_target_idx" ON "crm_associations" USING btree ("tenant_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_notes_tenant_parent_idx" ON "crm_notes" USING btree ("tenant_id","parent_type","parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_field_definitions_tenant_object_idx" ON "custom_field_definitions" USING btree ("tenant_id","object_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_seq_enroll_tenant_idx" ON "email_sequence_enrollments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_seq_enroll_campaign_idx" ON "email_sequence_enrollments" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_seq_enroll_status_idx" ON "email_sequence_enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_seq_enroll_next_send_idx" ON "email_sequence_enrollments" USING btree ("next_send_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_seq_enroll_campaign_email_unique" ON "email_sequence_enrollments" USING btree ("campaign_id","recipient_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_form_submissions_tenant_idx" ON "web_form_submissions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_form_submissions_form_idx" ON "web_form_submissions" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_form_submissions_status_idx" ON "web_form_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_form_submissions_created_at_idx" ON "web_form_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_forms_tenant_idx" ON "web_forms" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "web_forms_tenant_slug_unique" ON "web_forms" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_forms_public_token_idx" ON "web_forms" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_forms_status_idx" ON "web_forms" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_ai_costs_tenant_created_idx" ON "blog_ai_costs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_ai_costs_tenant_feature_idx" ON "blog_ai_costs" USING btree ("tenant_id","feature");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_ai_costs_tenant_model_idx" ON "blog_ai_costs" USING btree ("tenant_id","model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_ai_costs_post_idx" ON "blog_ai_costs" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_ai_quotas_tenant_idx" ON "blog_ai_quotas" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_authors_tenant_idx" ON "blog_authors" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_authors_tenant_slug_idx" ON "blog_authors" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_experiments_tenant_idx" ON "blog_experiments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_experiments_post_idx" ON "blog_experiments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_experiments_tenant_status_idx" ON "blog_experiments" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outline_variants_tenant_idx" ON "blog_outline_variants" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outline_variants_brief_idx" ON "blog_outline_variants" USING btree ("brief_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outline_variants_tenant_keyword_idx" ON "blog_outline_variants" USING btree ("tenant_id","keyword");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pipeline_runs_tenant_idx" ON "blog_pipeline_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pipeline_runs_tenant_status_idx" ON "blog_pipeline_runs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pipeline_runs_post_idx" ON "blog_pipeline_runs" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pipeline_stages_run_idx" ON "blog_pipeline_stages" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pipeline_stages_tenant_idx" ON "blog_pipeline_stages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pipeline_stages_run_seq_idx" ON "blog_pipeline_stages" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_variants_tenant_idx" ON "blog_post_variants" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_variants_post_idx" ON "blog_post_variants" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_variants_post_audience_idx" ON "blog_post_variants" USING btree ("post_id","audience_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_qa_reports_tenant_idx" ON "blog_qa_reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_qa_reports_post_checked_idx" ON "blog_qa_reports" USING btree ("post_id","checked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_rank_forecasts_tenant_idx" ON "blog_rank_forecasts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_rank_forecasts_post_checked_idx" ON "blog_rank_forecasts" USING btree ("post_id","checked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_failure_predictions_tenant_idx" ON "equipment_failure_predictions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_failure_predictions_tenant_status_idx" ON "equipment_failure_predictions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_failure_predictions_tenant_machine_idx" ON "equipment_failure_predictions" USING btree ("tenant_id","machine_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_churn_scores_tenant_idx" ON "customer_churn_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_churn_scores_tenant_customer_idx" ON "customer_churn_scores" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_churn_scores_tenant_band_idx" ON "customer_churn_scores" USING btree ("tenant_id","band");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "renewal_auto_quotes_tenant_idx" ON "renewal_auto_quotes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "renewal_auto_quotes_tenant_status_idx" ON "renewal_auto_quotes" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "renewal_auto_quotes_tenant_contract_idx" ON "renewal_auto_quotes" USING btree ("tenant_id","contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "renewal_suppressions_tenant_customer_uq" ON "renewal_suppressions" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qbr_reports_tenant_idx" ON "qbr_reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qbr_reports_tenant_customer_idx" ON "qbr_reports" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "qbr_reports_tenant_customer_quarter_uq" ON "qbr_reports" USING btree ("tenant_id","customer_id","quarter");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "qbr_suppressions_tenant_customer_uq" ON "qbr_suppressions" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "truck_inventory_tenant_idx" ON "truck_inventory" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "truck_inventory_tenant_tech_idx" ON "truck_inventory" USING btree ("tenant_id","tech_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "truck_inventory_tenant_tech_sku_uq" ON "truck_inventory" USING btree ("tenant_id","tech_user_id","part_sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "truck_stock_callbacks_tenant_idx" ON "truck_stock_callbacks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "truck_stock_callbacks_tenant_tech_idx" ON "truck_stock_callbacks" USING btree ("tenant_id","tech_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "truck_stock_recs_tenant_idx" ON "truck_stock_recommendations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "truck_stock_recs_tenant_tech_idx" ON "truck_stock_recommendations" USING btree ("tenant_id","tech_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "truck_stock_recs_tenant_status_idx" ON "truck_stock_recommendations" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "truck_stock_settings_tenant_tech_uq" ON "truck_stock_settings" USING btree ("tenant_id","tech_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_briefing_log_tenant_idx" ON "daily_briefing_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_briefing_log_tenant_user_date_idx" ON "daily_briefing_log" USING btree ("tenant_id","user_id","briefing_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_briefing_log_tenant_variant_idx" ON "daily_briefing_log" USING btree ("tenant_id","variant");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_briefing_preferences_tenant_user_uq" ON "daily_briefing_preferences" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portal_service_classifications_tenant_idx" ON "portal_service_classifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "portal_service_classifications_tenant_request_idx" ON "portal_service_classifications" USING btree ("tenant_id","request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "machine_supply_levels_tenant_idx" ON "machine_supply_levels" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "machine_supply_levels_tenant_machine_color_idx" ON "machine_supply_levels" USING btree ("tenant_id","machine_id","color");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "machine_supply_levels_captured_idx" ON "machine_supply_levels" USING btree ("captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "machine_supply_settings_tenant_machine_uq" ON "machine_supply_settings" USING btree ("tenant_id","machine_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_orders_tenant_idx" ON "supply_orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_orders_tenant_status_idx" ON "supply_orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_orders_tenant_machine_idx" ON "supply_orders" USING btree ("tenant_id","machine_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meter_read_submissions_tenant_idx" ON "meter_read_submissions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meter_read_submissions_tenant_status_idx" ON "meter_read_submissions" USING btree ("tenant_id","validation_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meter_read_submissions_tenant_hash_idx" ON "meter_read_submissions" USING btree ("tenant_id","image_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_ticket_embeddings_tenant_idx" ON "service_ticket_embeddings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "service_ticket_embeddings_tenant_ticket_uq" ON "service_ticket_embeddings" USING btree ("tenant_id","ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_ticket_embeddings_tenant_model_idx" ON "service_ticket_embeddings" USING btree ("tenant_id","machine_model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_ticket_closes_tenant_idx" ON "voice_ticket_closes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_ticket_closes_tenant_ticket_idx" ON "voice_ticket_closes" USING btree ("tenant_id","ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_ticket_closes_tenant_status_idx" ON "voice_ticket_closes" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_ticket_closes_purge_idx" ON "voice_ticket_closes" USING btree ("audio_purge_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_autopilot_accounts_tenant_user_uq" ON "email_autopilot_accounts" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_autopilot_drafts_tenant_user_idx" ON "email_autopilot_drafts" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_autopilot_drafts_tenant_status_idx" ON "email_autopilot_drafts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_autopilot_suppressions_uq" ON "email_autopilot_suppressions" USING btree ("tenant_id","user_id","contact_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatbot_connections_tenant_idx" ON "chatbot_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chatbot_connections_tenant_platform_team_uq" ON "chatbot_connections" USING btree ("tenant_id","platform","team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatbot_query_log_tenant_idx" ON "chatbot_query_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatbot_query_log_tenant_created_idx" ON "chatbot_query_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chatbot_user_links_tenant_platform_user_uq" ON "chatbot_user_links" USING btree ("tenant_id","platform","platform_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_agent_calls_tenant_idx" ON "voice_agent_calls" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_agent_calls_tenant_created_idx" ON "voice_agent_calls" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_agent_calls_purge_idx" ON "voice_agent_calls" USING btree ("recording_purge_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_syndication_pieces_tenant_idx" ON "blog_syndication_pieces" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_syndication_pieces_tenant_post_idx" ON "blog_syndication_pieces" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_syndication_pieces_tenant_platform_idx" ON "blog_syndication_pieces" USING btree ("tenant_id","platform");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_citation_sources_tenant_idx" ON "blog_citation_sources" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_citation_sources_tenant_citation_idx" ON "blog_citation_sources" USING btree ("tenant_id","citation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_citation_sources_tenant_post_idx" ON "blog_citation_sources" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_cluster_authority_scores_tenant_idx" ON "blog_cluster_authority_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_cluster_authority_scores_tenant_cluster_computed_idx" ON "blog_cluster_authority_scores" USING btree ("tenant_id","cluster_id","computed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_cluster_extensions_tenant_idx" ON "blog_cluster_extensions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_cluster_extensions_tenant_cluster_idx" ON "blog_cluster_extensions" USING btree ("tenant_id","cluster_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_community_questions_tenant_idx" ON "blog_community_questions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_community_questions_tenant_theme_idx" ON "blog_community_questions" USING btree ("tenant_id","theme");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_community_questions_tenant_source_idx" ON "blog_community_questions" USING btree ("tenant_id","source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_community_seeds_tenant_idx" ON "blog_community_seeds" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_internal_link_suggestions_tenant_idx" ON "blog_internal_link_suggestions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_internal_link_suggestions_tenant_source_idx" ON "blog_internal_link_suggestions" USING btree ("tenant_id","source_post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_internal_link_suggestions_tenant_target_idx" ON "blog_internal_link_suggestions" USING btree ("tenant_id","target_post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_keyword_embeddings_tenant_idx" ON "blog_keyword_embeddings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_keyword_embeddings_tenant_keyword_idx" ON "blog_keyword_embeddings" USING btree ("tenant_id","keyword_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_embeddings_tenant_idx" ON "blog_post_embeddings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_embeddings_tenant_post_idx" ON "blog_post_embeddings" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_readability_snapshots_tenant_idx" ON "blog_readability_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_readability_snapshots_tenant_post_idx" ON "blog_readability_snapshots" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_chart_specs_tenant_idx" ON "blog_chart_specs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_chart_specs_tenant_post_idx" ON "blog_chart_specs" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_chart_specs_data_asset_idx" ON "blog_chart_specs" USING btree ("data_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_content_scans_tenant_idx" ON "blog_content_scans" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_content_scans_post_idx" ON "blog_content_scans" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_content_scans_tenant_type_idx" ON "blog_content_scans" USING btree ("tenant_id","scan_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_data_assets_tenant_idx" ON "blog_data_assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_data_assets_tenant_post_idx" ON "blog_data_assets" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_factcheck_runs_tenant_idx" ON "blog_factcheck_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_factcheck_runs_post_idx" ON "blog_factcheck_runs" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_factcheck_runs_tenant_status_idx" ON "blog_factcheck_runs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_decay_events_tenant_idx" ON "blog_decay_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_decay_events_tenant_post_idx" ON "blog_decay_events" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_decay_events_detected_idx" ON "blog_decay_events" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_link_injection_proposals_tenant_idx" ON "blog_link_injection_proposals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_link_injection_proposals_batch_idx" ON "blog_link_injection_proposals" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_link_injection_proposals_pillar_idx" ON "blog_link_injection_proposals" USING btree ("tenant_id","pillar_post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_refresh_queue_details_tenant_idx" ON "blog_refresh_queue_details" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_refresh_queue_details_queue_idx" ON "blog_refresh_queue_details" USING btree ("queue_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_refresh_queue_details_post_idx" ON "blog_refresh_queue_details" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_reshare_cadences_tenant_idx" ON "blog_reshare_cadences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_reshare_cadences_tenant_post_idx" ON "blog_reshare_cadences" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_schedule_models_tenant_idx" ON "blog_schedule_models" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_schedule_models_tenant_platform_idx" ON "blog_schedule_models" USING btree ("tenant_id","platform");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_utm_templates_tenant_idx" ON "blog_utm_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_utm_templates_tenant_default_idx" ON "blog_utm_templates" USING btree ("tenant_id","is_default");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_backlink_events_tenant_idx" ON "blog_backlink_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_backlink_events_tenant_type_idx" ON "blog_backlink_events" USING btree ("tenant_id","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_backlink_events_backlink_idx" ON "blog_backlink_events" USING btree ("backlink_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_backlinks_tenant_idx" ON "blog_backlinks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_backlinks_tenant_post_idx" ON "blog_backlinks" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_backlinks_tenant_status_idx" ON "blog_backlinks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_backlinks_tenant_domain_idx" ON "blog_backlinks" USING btree ("tenant_id","source_domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_brand_mentions_tenant_idx" ON "blog_brand_mentions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_brand_mentions_tenant_status_idx" ON "blog_brand_mentions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_brand_mentions_tenant_has_link_idx" ON "blog_brand_mentions" USING btree ("tenant_id","has_link");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_haro_pitches_tenant_idx" ON "blog_haro_pitches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_haro_pitches_query_idx" ON "blog_haro_pitches" USING btree ("query_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_haro_pitches_tenant_status_idx" ON "blog_haro_pitches" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_haro_queries_tenant_idx" ON "blog_haro_queries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_haro_queries_tenant_status_idx" ON "blog_haro_queries" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_haro_queries_author_idx" ON "blog_haro_queries" USING btree ("matched_author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outreach_messages_tenant_idx" ON "blog_outreach_messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outreach_messages_thread_idx" ON "blog_outreach_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outreach_messages_tenant_direction_idx" ON "blog_outreach_messages" USING btree ("tenant_id","direction");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outreach_prospects_tenant_idx" ON "blog_outreach_prospects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outreach_prospects_tenant_post_idx" ON "blog_outreach_prospects" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outreach_prospects_tenant_status_idx" ON "blog_outreach_prospects" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outreach_threads_tenant_idx" ON "blog_outreach_threads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outreach_threads_tenant_status_idx" ON "blog_outreach_threads" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outreach_threads_prospect_idx" ON "blog_outreach_threads" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_outreach_threads_next_action_idx" ON "blog_outreach_threads" USING btree ("tenant_id","next_action_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_aeo_scores_tenant_idx" ON "blog_aeo_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_aeo_scores_tenant_post_idx" ON "blog_aeo_scores" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_analytics_connections_tenant_idx" ON "blog_analytics_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_analytics_connections_tenant_provider_idx" ON "blog_analytics_connections" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_cohort_metrics_tenant_idx" ON "blog_cohort_metrics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_cohort_metrics_tenant_cluster_idx" ON "blog_cohort_metrics" USING btree ("tenant_id","cluster_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_cohort_metrics_tenant_period_idx" ON "blog_cohort_metrics" USING btree ("tenant_id","period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_conversion_config_tenant_idx" ON "blog_conversion_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_conversion_config_tenant_default_idx" ON "blog_conversion_config" USING btree ("tenant_id","is_default");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_kg_edges_tenant_idx" ON "blog_kg_edges" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_kg_edges_tenant_source_idx" ON "blog_kg_edges" USING btree ("tenant_id","source_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_kg_edges_tenant_pair_idx" ON "blog_kg_edges" USING btree ("tenant_id","source_entity_id","target_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_kg_entities_tenant_idx" ON "blog_kg_entities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_kg_entities_tenant_type_idx" ON "blog_kg_entities" USING btree ("tenant_id","entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_kg_entities_tenant_norm_idx" ON "blog_kg_entities" USING btree ("tenant_id","normalized_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_llm_citations_tenant_idx" ON "blog_llm_citations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_llm_citations_tenant_cluster_idx" ON "blog_llm_citations" USING btree ("tenant_id","cluster_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_llm_citations_tenant_engine_idx" ON "blog_llm_citations" USING btree ("tenant_id","engine");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_llm_citations_post_idx" ON "blog_llm_citations" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_config_tenant_idx" ON "blog_auto_refresh_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_reviews_tenant_idx" ON "blog_auto_refresh_reviews" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_reviews_tenant_status_idx" ON "blog_auto_refresh_reviews" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_reviews_post_idx" ON "blog_auto_refresh_reviews" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_runs_tenant_idx" ON "blog_auto_refresh_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_runs_post_idx" ON "blog_auto_refresh_runs" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_runs_tenant_status_idx" ON "blog_auto_refresh_runs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_competitor_feeds_tenant_idx" ON "blog_competitor_feeds" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_competitor_feeds_tenant_domain_idx" ON "blog_competitor_feeds" USING btree ("tenant_id","domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_competitor_posts_tenant_idx" ON "blog_competitor_posts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_competitor_posts_feed_external_idx" ON "blog_competitor_posts" USING btree ("feed_id","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_competitor_posts_tenant_status_idx" ON "blog_competitor_posts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_serp_alerts_tenant_idx" ON "blog_serp_alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_serp_alerts_tenant_status_idx" ON "blog_serp_alerts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_serp_monitor_config_tenant_idx" ON "blog_serp_monitor_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_serp_volatility_events_tenant_idx" ON "blog_serp_volatility_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_serp_volatility_events_tenant_keyword_idx" ON "blog_serp_volatility_events" USING btree ("tenant_id","keyword","detected_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_serp_volatility_events_post_idx" ON "blog_serp_volatility_events" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_glossary_terms_tenant_idx" ON "blog_glossary_terms" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_glossary_terms_tenant_term_idx" ON "blog_glossary_terms" USING btree ("tenant_id","term");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_interactive_blocks_tenant_idx" ON "blog_interactive_blocks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_interactive_blocks_tenant_post_idx" ON "blog_interactive_blocks" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_interactive_blocks_tenant_type_idx" ON "blog_interactive_blocks" USING btree ("tenant_id","block_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_interactive_events_tenant_idx" ON "blog_interactive_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_interactive_events_block_idx" ON "blog_interactive_events" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_interactive_events_block_type_idx" ON "blog_interactive_events" USING btree ("block_id","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_locales_tenant_idx" ON "blog_locales" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_locales_tenant_locale_idx" ON "blog_locales" USING btree ("tenant_id","locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_media_outputs_tenant_idx" ON "blog_media_outputs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_media_outputs_tenant_post_idx" ON "blog_media_outputs" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_media_outputs_tenant_type_idx" ON "blog_media_outputs" USING btree ("tenant_id","output_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_translations_tenant_idx" ON "blog_post_translations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_translations_tenant_post_idx" ON "blog_post_translations" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_post_translations_post_locale_idx" ON "blog_post_translations" USING btree ("post_id","locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pseo_jobs_tenant_idx" ON "blog_pseo_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pseo_jobs_tenant_template_idx" ON "blog_pseo_jobs" USING btree ("tenant_id","template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pseo_jobs_tenant_status_idx" ON "blog_pseo_jobs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pseo_rows_tenant_idx" ON "blog_pseo_rows" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pseo_rows_job_idx" ON "blog_pseo_rows" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pseo_rows_template_row_idx" ON "blog_pseo_rows" USING btree ("template_id","row_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pseo_templates_tenant_idx" ON "blog_pseo_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_pseo_templates_tenant_data_asset_idx" ON "blog_pseo_templates" USING btree ("tenant_id","data_asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_publish_attempts_tenant_idx" ON "blog_publish_attempts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_publish_attempts_tenant_post_idx" ON "blog_publish_attempts" USING btree ("tenant_id","post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_api_keys_tenant_idx" ON "blog_api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_api_keys_hash_idx" ON "blog_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_api_usage_tenant_idx" ON "blog_api_usage" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_api_usage_key_window_idx" ON "blog_api_usage" USING btree ("api_key_id","window_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_backup_config_tenant_idx" ON "blog_backup_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_backups_tenant_idx" ON "blog_backups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_backups_tenant_status_idx" ON "blog_backups" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_dsar_requests_tenant_idx" ON "blog_dsar_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_dsar_requests_subject_idx" ON "blog_dsar_requests" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_webhook_deliveries_tenant_idx" ON "blog_webhook_deliveries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_webhook_deliveries_webhook_idx" ON "blog_webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_webhook_deliveries_status_idx" ON "blog_webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_webhooks_tenant_idx" ON "blog_webhooks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_webhooks_tenant_active_idx" ON "blog_webhooks" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blog_widget_config_tenant_idx" ON "blog_widget_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_booking_bookings_manage_token" ON "booking_page_bookings" USING btree ("manage_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booking_bookings_page_time" ON "booking_page_bookings" USING btree ("booking_page_id","start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booking_bookings_tenant" ON "booking_page_bookings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booking_bookings_assigned_time" ON "booking_page_bookings" USING btree ("assigned_user_id","start_time");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_booking_pages_slug" ON "booking_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_booking_pages_tenant_owner" ON "booking_pages" USING btree ("tenant_id","owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_data_provenance_tenant_idx" ON "contact_data_provenance" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_data_provenance_subject_uq" ON "contact_data_provenance" USING btree ("tenant_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_data_provenance_email_idx" ON "contact_data_provenance" USING btree ("tenant_id","subject_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_data_provenance_notice_idx" ON "contact_data_provenance" USING btree ("tenant_id","art14_notice_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_suppressions_tenant_email_uq" ON "contact_suppressions" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_suppressions_email_idx" ON "contact_suppressions" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_executions_dedupe_unique" ON "workflow_executions" USING btree ("tenant_id","workflow_id","dedupe_key") WHERE "workflow_executions"."dedupe_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_executions_resume_at_idx" ON "workflow_executions" USING btree ("resume_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_payable_tenant_status_due_idx" ON "accounts_payable" USING btree ("tenant_id","status","due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_receivable_tenant_status_due_idx" ON "accounts_receivable" USING btree ("tenant_id","status","due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_timestamp_idx" ON "audit_logs" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_resource_idx" ON "audit_logs" USING btree ("tenant_id","resource","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_record_activities_record_created_idx" ON "business_record_activities" USING btree ("business_record_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_record_activities_tenant_idx" ON "business_record_activities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_tenant_customer_idx" ON "contracts" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_tenant_status_idx" ON "contracts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_tenant_customer_idx" ON "equipment" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "equipment_tenant_status_idx" ON "equipment" USING btree ("tenant_id","equipment_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_tenant_category_idx" ON "inventory_items" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_line_items_invoice_idx" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_line_items_tenant_idx" ON "invoice_line_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_tenant_customer_idx" ON "invoices" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_tenant_status_idx" ON "invoices" USING btree ("tenant_id","invoice_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_tenant_created_idx" ON "invoices" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_external_customer_idx" ON "invoices" USING btree ("external_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_tenant_account_idx" ON "opportunities" USING btree ("tenant_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_tenant_stage_idx" ON "opportunities" USING btree ("tenant_id","stage_name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permission_cache_user_context_tenant_uniq" ON "permission_cache" USING btree ("user_id","organizational_context","tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_line_items_proposal_line_idx" ON "proposal_line_items" USING btree ("proposal_id","line_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_line_items_tenant_idx" ON "proposal_line_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_tenant_status_idx" ON "proposals" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_tenant_created_idx" ON "proposals" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_tenant_type_status_idx" ON "proposals" USING btree ("tenant_id","proposal_type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_status_idx" ON "purchase_orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_vendor_idx" ON "purchase_orders" USING btree ("tenant_id","vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_tenant_customer_idx" ON "quotes" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_tenant_status_idx" ON "quotes" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_tenant_status_idx" ON "tasks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_tenant_idx" ON "users" USING btree ("tenant_id");