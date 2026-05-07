CREATE TABLE "address_book_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"encrypted_blob" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address_book_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"entry_type" varchar(16) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"sort_name" varchar(200),
	"short_name" varchar(50),
	"email" varchar(320),
	"smb_host" varchar(255),
	"smb_share_path" varchar(500),
	"smb_full_unc" varchar(500),
	"smb_username" varchar(255),
	"credential_id" uuid,
	"speed_dial_index" integer,
	"group_member_entry_ids" jsonb,
	"source_uuid" varchar(100),
	"source_metadata" jsonb,
	"is_override" boolean DEFAULT false NOT NULL,
	"overrides_entry_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address_book_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"target_vendor" varchar(32) NOT NULL,
	"target_filename" varchar(500) NOT NULL,
	"conversion_report_json" jsonb,
	"exported_at" timestamp DEFAULT now() NOT NULL,
	"exported_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "address_book_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"vendor" varchar(32) NOT NULL,
	"raw_filename" varchar(500) NOT NULL,
	"raw_file_storage_path" varchar(1000),
	"password_was_required" boolean DEFAULT false NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"errors_json" jsonb,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"imported_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "address_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"device_id" uuid,
	"name" varchar(200) NOT NULL,
	"source_vendor" varchar(32),
	"source_model" varchar(100),
	"source_subbook_name" varchar(200),
	"last_imported_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "device_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"supply_type" varchar(64) NOT NULL,
	"alert_type" varchar(32) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"current_value" integer,
	"threshold" integer,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"message" text,
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar(255),
	"snoozed_until" timestamp,
	"resolved_at" timestamp,
	"triggered_order_id" uuid,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_supply_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" varchar(255),
	"device_id" uuid NOT NULL,
	"alert_id" uuid,
	"supply_type" varchar(64) NOT NULL,
	"product_id" varchar(255),
	"product_sku" varchar(100),
	"product_name" varchar(255),
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2),
	"total_price" numeric(10, 2),
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"triggered_by" varchar(16) DEFAULT 'auto' NOT NULL,
	"triggered_by_user_id" varchar(255),
	"approved_at" timestamp,
	"approved_by" varchar(255),
	"ordered_at" timestamp,
	"cancelled_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"command" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"issued_by_user_id" varchar(255),
	"dispatched_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"result" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_enrollment_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_by_user_id" varchar(255),
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"used_from_ip" varchar(45),
	"used_from_hostname" varchar(255),
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_enrollment_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "blog_agent_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"agents_paused" boolean DEFAULT false NOT NULL,
	"paused_at" timestamp,
	"paused_by_user_id" varchar,
	"paused_reason" text,
	"auto_refresh_requires_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_agent_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "blog_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"asset_type" varchar(20) NOT NULL,
	"title" varchar(500),
	"description" text,
	"storage_path" varchar(1000),
	"mime_type" varchar(100),
	"file_size_bytes" bigint,
	"alt_text" text,
	"attribution" text,
	"expert_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "blog_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"actor_user_id" varchar,
	"actor_type" varchar(16) NOT NULL,
	"agent_kind" varchar(64),
	"action" varchar(100) NOT NULL,
	"target_type" varchar(64),
	"target_id" uuid,
	"before_state" jsonb,
	"after_state" jsonb,
	"summary" text,
	"request_ip" varchar(64),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_brand_voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"tone" text,
	"banned_phrases" text[],
	"preferred_phrases" text[],
	"reading_level_target" varchar(16),
	"persona_description" text,
	"sample_corpus" text,
	"pov" varchar(16),
	"voice_attributes" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "blog_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" varchar(500) NOT NULL,
	"target_keyword_id" uuid,
	"target_audience" text,
	"search_intent" varchar(20),
	"recommended_word_count" integer,
	"outline" jsonb,
	"key_takeaways" text[],
	"serp_snapshot" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"assigned_to_user_id" varchar,
	"due_date" timestamp,
	"brand_voice_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "blog_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"tenant_id" varchar NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"author" varchar(255),
	"publication" varchar(255),
	"publish_date" date,
	"citation_text" text,
	"inline_position" integer,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_distribution_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"platform" varchar(32) NOT NULL,
	"account_handle" varchar(255),
	"display_name" varchar(255),
	"encrypted_config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_health_check_at" timestamp,
	"last_health_check_ok" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "blog_distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"tenant_id" varchar NOT NULL,
	"target_id" uuid,
	"platform" varchar(32) NOT NULL,
	"variant_type" varchar(32),
	"content" text,
	"content_json" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp,
	"published_at" timestamp,
	"platform_post_id" varchar(200),
	"platform_post_url" text,
	"utm_params" jsonb,
	"engagement_metrics" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "blog_keyword_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"pillar_keyword" varchar(500),
	"cluster_type" varchar(16),
	"parent_cluster_id" uuid,
	"topical_authority_score" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "blog_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"keyword" varchar(500) NOT NULL,
	"search_volume" integer,
	"keyword_difficulty" integer,
	"cpc" numeric(10, 2),
	"intent" varchar(20),
	"cluster_id" uuid,
	"source_adapter" varchar(32),
	"last_refreshed_at" timestamp,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "blog_performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"tenant_id" varchar NOT NULL,
	"distribution_id" uuid,
	"metric_date" date NOT NULL,
	"source" varchar(32) NOT NULL,
	"pageviews" integer,
	"unique_visitors" integer,
	"avg_time_on_page_seconds" integer,
	"bounce_rate" numeric(5, 4),
	"impressions" integer,
	"clicks" integer,
	"ctr" numeric(5, 4),
	"position" numeric(6, 2),
	"conversions" integer,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_post_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"tenant_id" varchar NOT NULL,
	"revision_number" integer NOT NULL,
	"title" varchar(500),
	"body_markdown" text,
	"body_html" text,
	"meta_title" varchar(200),
	"meta_description" text,
	"revision_source" varchar(24) NOT NULL,
	"diff_summary" text,
	"changed_by_user_id" varchar,
	"agent_run_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_refresh_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL,
	"reason" varchar(32) NOT NULL,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"agent_run_id" varchar(100),
	"result_summary" text,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_style_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"rules" jsonb,
	"rule_packs" text[],
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
--> statement-breakpoint
ALTER TABLE "device_registrations" ADD COLUMN "customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "monitoring_clients" ADD COLUMN "customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "address_book_entries" ADD CONSTRAINT "address_book_entries_book_id_address_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."address_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_book_entries" ADD CONSTRAINT "address_book_entries_credential_id_address_book_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."address_book_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_book_exports" ADD CONSTRAINT "address_book_exports_book_id_address_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."address_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address_book_imports" ADD CONSTRAINT "address_book_imports_book_id_address_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."address_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_alerts" ADD CONSTRAINT "device_alerts_device_id_device_registrations_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_supply_orders" ADD CONSTRAINT "device_supply_orders_device_id_device_registrations_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."device_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_commands" ADD CONSTRAINT "client_commands_client_id_monitoring_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."monitoring_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_enrollment_tokens" ADD CONSTRAINT "client_enrollment_tokens_client_id_monitoring_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."monitoring_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_briefs" ADD CONSTRAINT "blog_briefs_target_keyword_id_blog_keywords_id_fk" FOREIGN KEY ("target_keyword_id") REFERENCES "public"."blog_keywords"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_briefs" ADD CONSTRAINT "blog_briefs_brand_voice_id_blog_brand_voices_id_fk" FOREIGN KEY ("brand_voice_id") REFERENCES "public"."blog_brand_voices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_citations" ADD CONSTRAINT "blog_citations_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_distributions" ADD CONSTRAINT "blog_distributions_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_distributions" ADD CONSTRAINT "blog_distributions_target_id_blog_distribution_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."blog_distribution_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_keywords" ADD CONSTRAINT "blog_keywords_cluster_id_blog_keyword_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."blog_keyword_clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_performance_metrics" ADD CONSTRAINT "blog_performance_metrics_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_performance_metrics" ADD CONSTRAINT "blog_performance_metrics_distribution_id_blog_distributions_id_fk" FOREIGN KEY ("distribution_id") REFERENCES "public"."blog_distributions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_revisions" ADD CONSTRAINT "blog_post_revisions_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_refresh_queue" ADD CONSTRAINT "blog_refresh_queue_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "address_book_credentials_tenant_idx" ON "address_book_credentials" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "address_book_entries_book_idx" ON "address_book_entries" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "address_book_entries_book_type_idx" ON "address_book_entries" USING btree ("book_id","entry_type");--> statement-breakpoint
CREATE INDEX "address_book_entries_overrides_idx" ON "address_book_entries" USING btree ("overrides_entry_id");--> statement-breakpoint
CREATE INDEX "address_book_exports_tenant_idx" ON "address_book_exports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "address_book_exports_book_idx" ON "address_book_exports" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "address_book_imports_tenant_idx" ON "address_book_imports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "address_book_imports_book_idx" ON "address_book_imports" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "address_books_tenant_idx" ON "address_books" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "address_books_customer_idx" ON "address_books" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "address_books_device_idx" ON "address_books" USING btree ("tenant_id","device_id");--> statement-breakpoint
CREATE INDEX "device_alerts_tenant_status_idx" ON "device_alerts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "device_alerts_device_idx" ON "device_alerts" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_alerts_severity_idx" ON "device_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "device_alerts_snooze_expiry_idx" ON "device_alerts" USING btree ("snoozed_until");--> statement-breakpoint
CREATE INDEX "device_supply_orders_tenant_status_idx" ON "device_supply_orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "device_supply_orders_device_idx" ON "device_supply_orders" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_supply_orders_alert_idx" ON "device_supply_orders" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "device_supply_orders_customer_idx" ON "device_supply_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "client_commands_client_status_idx" ON "client_commands" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "client_commands_expires_idx" ON "client_commands" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "enrollment_tenant_idx" ON "client_enrollment_tokens" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "enrollment_client_idx" ON "client_enrollment_tokens" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "enrollment_token_hash_idx" ON "client_enrollment_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "enrollment_expires_idx" ON "client_enrollment_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "blog_agent_settings_tenant_idx" ON "blog_agent_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_assets_tenant_idx" ON "blog_assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_assets_tenant_type_idx" ON "blog_assets" USING btree ("tenant_id","asset_type");--> statement-breakpoint
CREATE INDEX "blog_audit_log_tenant_idx" ON "blog_audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_audit_log_tenant_action_idx" ON "blog_audit_log" USING btree ("tenant_id","action");--> statement-breakpoint
CREATE INDEX "blog_audit_log_target_idx" ON "blog_audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "blog_audit_log_tenant_created_idx" ON "blog_audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "blog_brand_voices_tenant_idx" ON "blog_brand_voices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_briefs_tenant_idx" ON "blog_briefs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_briefs_tenant_status_idx" ON "blog_briefs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "blog_briefs_assigned_idx" ON "blog_briefs" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "blog_citations_post_idx" ON "blog_citations" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_citations_tenant_idx" ON "blog_citations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_distribution_targets_tenant_idx" ON "blog_distribution_targets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_distribution_targets_tenant_platform_idx" ON "blog_distribution_targets" USING btree ("tenant_id","platform");--> statement-breakpoint
CREATE INDEX "blog_distributions_post_platform_idx" ON "blog_distributions" USING btree ("post_id","platform");--> statement-breakpoint
CREATE INDEX "blog_distributions_tenant_idx" ON "blog_distributions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_distributions_tenant_status_idx" ON "blog_distributions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "blog_distributions_scheduled_idx" ON "blog_distributions" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "blog_keyword_clusters_tenant_idx" ON "blog_keyword_clusters" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_keyword_clusters_parent_idx" ON "blog_keyword_clusters" USING btree ("parent_cluster_id");--> statement-breakpoint
CREATE INDEX "blog_keywords_tenant_idx" ON "blog_keywords" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_keywords_tenant_cluster_idx" ON "blog_keywords" USING btree ("tenant_id","cluster_id");--> statement-breakpoint
CREATE INDEX "blog_performance_metrics_post_date_idx" ON "blog_performance_metrics" USING btree ("post_id","metric_date");--> statement-breakpoint
CREATE INDEX "blog_performance_metrics_tenant_date_idx" ON "blog_performance_metrics" USING btree ("tenant_id","metric_date");--> statement-breakpoint
CREATE INDEX "blog_performance_metrics_source_idx" ON "blog_performance_metrics" USING btree ("source");--> statement-breakpoint
CREATE INDEX "blog_post_revisions_post_idx" ON "blog_post_revisions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_post_revisions_tenant_idx" ON "blog_post_revisions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "blog_post_revisions_post_revision_idx" ON "blog_post_revisions" USING btree ("post_id","revision_number");--> statement-breakpoint
CREATE INDEX "blog_refresh_queue_tenant_scheduled_idx" ON "blog_refresh_queue" USING btree ("tenant_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "blog_refresh_queue_tenant_status_idx" ON "blog_refresh_queue" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "blog_refresh_queue_post_idx" ON "blog_refresh_queue" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "blog_style_guides_tenant_idx" ON "blog_style_guides" USING btree ("tenant_id");