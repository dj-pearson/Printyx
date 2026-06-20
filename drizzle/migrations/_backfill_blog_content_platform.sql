-- Blog Content Platform — universal content platform cluster.
--
-- US-BLOG-042 (CMS publish flow), US-BLOG-074 (programmatic SEO),
-- US-BLOG-075 (interactive blocks), US-BLOG-076 (multimodal output),
-- US-BLOG-077 (localization + translation).
--
-- Schema: shared/blog-content-platform-schema.ts. FKs are enforced ONLY here,
-- matching the blog module convention (see _backfill_blog_syndication.sql).
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_content_platform.sql

-- ===========================================================================
-- US-BLOG-042 — blog_publish_attempts
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "blog_publish_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"cms_platform" varchar(40),
	"cms_target_id" uuid REFERENCES "blog_distribution_targets"("id") ON DELETE SET NULL,
	"operation" varchar(16) NOT NULL DEFAULT 'create',
	"cms_post_id" varchar(200),
	"cms_post_url" text,
	"canonical_url" text,
	"stage" varchar(24) NOT NULL DEFAULT 'started',
	"status" varchar(16) NOT NULL DEFAULT 'in_progress',
	"uploaded_assets" jsonb,
	"stage_log" jsonb,
	"webhook_intent" jsonb,
	"error_message" text,
	"started_at" timestamp NOT NULL DEFAULT now(),
	"finished_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);
CREATE INDEX IF NOT EXISTS "blog_publish_attempts_tenant_idx"
	ON "blog_publish_attempts" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_publish_attempts_tenant_post_idx"
	ON "blog_publish_attempts" USING btree ("tenant_id","post_id");

-- ===========================================================================
-- US-BLOG-074 — blog_pseo_templates / blog_pseo_jobs / blog_pseo_rows
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "blog_pseo_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(300) NOT NULL,
	"data_asset_id" uuid NOT NULL REFERENCES "blog_data_assets"("id") ON DELETE CASCADE,
	"body_template" text NOT NULL,
	"slug_pattern" varchar(500) NOT NULL,
	"seo_config" jsonb NOT NULL,
	"brand_voice_id" uuid REFERENCES "blog_brand_voices"("id") ON DELETE SET NULL,
	"cms_target_key" varchar(64),
	"min_seo_score" integer NOT NULL DEFAULT 70,
	"below_threshold_action" varchar(12) NOT NULL DEFAULT 'review',
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
CREATE INDEX IF NOT EXISTS "blog_pseo_templates_tenant_idx"
	ON "blog_pseo_templates" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_pseo_templates_tenant_data_asset_idx"
	ON "blog_pseo_templates" USING btree ("tenant_id","data_asset_id");

CREATE TABLE IF NOT EXISTS "blog_pseo_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"template_id" uuid NOT NULL REFERENCES "blog_pseo_templates"("id") ON DELETE CASCADE,
	"mode" varchar(12) NOT NULL DEFAULT 'publish',
	"status" varchar(12) NOT NULL DEFAULT 'queued',
	"rate_per_hour" integer NOT NULL DEFAULT 50,
	"total_rows" integer NOT NULL DEFAULT 0,
	"processed_rows" integer NOT NULL DEFAULT 0,
	"published_rows" integer NOT NULL DEFAULT 0,
	"flagged_rows" integer NOT NULL DEFAULT 0,
	"skipped_rows" integer NOT NULL DEFAULT 0,
	"failed_rows" integer NOT NULL DEFAULT 0,
	"cursor" integer NOT NULL DEFAULT 0,
	"window_started_at" timestamp,
	"window_count" integer NOT NULL DEFAULT 0,
	"error" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
CREATE INDEX IF NOT EXISTS "blog_pseo_jobs_tenant_idx"
	ON "blog_pseo_jobs" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_pseo_jobs_tenant_template_idx"
	ON "blog_pseo_jobs" USING btree ("tenant_id","template_id");
CREATE INDEX IF NOT EXISTS "blog_pseo_jobs_tenant_status_idx"
	ON "blog_pseo_jobs" USING btree ("tenant_id","status");

CREATE TABLE IF NOT EXISTS "blog_pseo_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"job_id" uuid NOT NULL REFERENCES "blog_pseo_jobs"("id") ON DELETE CASCADE,
	"template_id" uuid NOT NULL REFERENCES "blog_pseo_templates"("id") ON DELETE CASCADE,
	"row_key" varchar(300) NOT NULL,
	"variables" jsonb NOT NULL,
	"rendered_title" varchar(500),
	"rendered_slug" varchar(500),
	"rendered_body" text,
	"meta_title" varchar(300),
	"meta_description" text,
	"seo_score" integer,
	"seo_findings" jsonb,
	"status" varchar(12) NOT NULL DEFAULT 'pending',
	"post_id" uuid REFERENCES "blog_posts"("id") ON DELETE SET NULL,
	"error" text,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "blog_pseo_rows_tenant_idx"
	ON "blog_pseo_rows" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_pseo_rows_job_idx"
	ON "blog_pseo_rows" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "blog_pseo_rows_template_row_idx"
	ON "blog_pseo_rows" USING btree ("template_id","row_key");

-- ===========================================================================
-- US-BLOG-075 — blog_interactive_blocks / blog_interactive_events
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "blog_interactive_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid REFERENCES "blog_posts"("id") ON DELETE SET NULL,
	"block_type" varchar(20) NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"spec" jsonb NOT NULL,
	"lead_capture_enabled" boolean NOT NULL DEFAULT false,
	"lead_capture_copy" text,
	"embed_mode" varchar(12) NOT NULL DEFAULT 'iframe',
	"is_published" boolean NOT NULL DEFAULT false,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
CREATE INDEX IF NOT EXISTS "blog_interactive_blocks_tenant_idx"
	ON "blog_interactive_blocks" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_interactive_blocks_tenant_post_idx"
	ON "blog_interactive_blocks" USING btree ("tenant_id","post_id");
CREATE INDEX IF NOT EXISTS "blog_interactive_blocks_tenant_type_idx"
	ON "blog_interactive_blocks" USING btree ("tenant_id","block_type");

CREATE TABLE IF NOT EXISTS "blog_interactive_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"block_id" uuid NOT NULL REFERENCES "blog_interactive_blocks"("id") ON DELETE CASCADE,
	"event_type" varchar(20) NOT NULL,
	"session_id" varchar(100),
	"lead_email" varchar(320),
	"payload" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "blog_interactive_events_tenant_idx"
	ON "blog_interactive_events" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_interactive_events_block_idx"
	ON "blog_interactive_events" USING btree ("block_id");
CREATE INDEX IF NOT EXISTS "blog_interactive_events_block_type_idx"
	ON "blog_interactive_events" USING btree ("block_id","event_type");

-- ===========================================================================
-- US-BLOG-076 — blog_media_outputs
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "blog_media_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"output_type" varchar(20) NOT NULL,
	"status" varchar(16) NOT NULL DEFAULT 'pending',
	"asset_ref" uuid REFERENCES "blog_assets"("id") ON DELETE SET NULL,
	"spec" jsonb,
	"adapter" varchar(40),
	"voice_licensed" boolean NOT NULL DEFAULT false,
	"author_id" uuid,
	"error" text,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
CREATE INDEX IF NOT EXISTS "blog_media_outputs_tenant_idx"
	ON "blog_media_outputs" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_media_outputs_tenant_post_idx"
	ON "blog_media_outputs" USING btree ("tenant_id","post_id");
CREATE INDEX IF NOT EXISTS "blog_media_outputs_tenant_type_idx"
	ON "blog_media_outputs" USING btree ("tenant_id","output_type");

-- ===========================================================================
-- US-BLOG-077 — blog_locales / blog_glossary_terms / blog_post_translations
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "blog_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"locale" varchar(16) NOT NULL,
	"display_name" varchar(120),
	"brand_voice_id" uuid REFERENCES "blog_brand_voices"("id") ON DELETE SET NULL,
	"is_default" boolean NOT NULL DEFAULT false,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
CREATE INDEX IF NOT EXISTS "blog_locales_tenant_idx"
	ON "blog_locales" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_locales_tenant_locale_idx"
	ON "blog_locales" USING btree ("tenant_id","locale");

CREATE TABLE IF NOT EXISTS "blog_glossary_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"term" varchar(300) NOT NULL,
	"mode" varchar(20) NOT NULL DEFAULT 'do_not_translate',
	"translations" jsonb,
	"case_sensitive" boolean NOT NULL DEFAULT false,
	"notes" text,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
CREATE INDEX IF NOT EXISTS "blog_glossary_terms_tenant_idx"
	ON "blog_glossary_terms" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_glossary_terms_tenant_term_idx"
	ON "blog_glossary_terms" USING btree ("tenant_id","term");

CREATE TABLE IF NOT EXISTS "blog_post_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"locale" varchar(16) NOT NULL,
	"translated_title" varchar(500),
	"translated_body" text,
	"translated_meta_title" varchar(300),
	"translated_meta_description" text,
	"translated_slug" varchar(500),
	"status" varchar(16) NOT NULL DEFAULT 'draft',
	"requires_review" boolean NOT NULL DEFAULT true,
	"translation_adapter" varchar(40),
	"reviewer_user_id" varchar,
	"publish_date" timestamp,
	"cms_post_id" varchar(200),
	"cms_post_url" text,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);
CREATE INDEX IF NOT EXISTS "blog_post_translations_tenant_idx"
	ON "blog_post_translations" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_post_translations_tenant_post_idx"
	ON "blog_post_translations" USING btree ("tenant_id","post_id");
CREATE INDEX IF NOT EXISTS "blog_post_translations_post_locale_idx"
	ON "blog_post_translations" USING btree ("post_id","locale");
