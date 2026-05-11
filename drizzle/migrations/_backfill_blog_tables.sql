-- _backfill_blog_tables.sql
--
-- Idempotent re-apply of the blog_* tables originally defined in
-- 0008_pretty_rocket_raccoon.sql. The Drizzle journal claims 0008 ran, but
-- some installs are missing the blog tables (likely because 0008 bombed
-- mid-script on a pre-existing non-blog table like device_alerts and
-- never reached the blog DDL).
--
-- This file extracts ONLY the blog_* table DDL with:
--   - CREATE TABLE IF NOT EXISTS
--   - DO-block guarded ADD CONSTRAINT (skips if constraint already exists)
--   - CREATE INDEX IF NOT EXISTS
--
-- The underscore prefix keeps drizzle-kit from picking this up as a real
-- migration. Run manually with:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_tables.sql
--
-- After this runs, 0013_blog_revision_retention_days.sql is safe to re-apply.
-- This script does NOT touch non-blog tables — those are 0008's other concern.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "blog_agent_settings" (
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

CREATE TABLE IF NOT EXISTS "blog_assets" (
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

CREATE TABLE IF NOT EXISTS "blog_audit_log" (
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

CREATE TABLE IF NOT EXISTS "blog_brand_voices" (
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

CREATE TABLE IF NOT EXISTS "blog_briefs" (
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

-- Note: this is the NEW blog_posts shape required by shared/blog-schema.ts
-- and the blog-* edge functions (body_markdown, body_html, status varchar,
-- tenant_id varchar). The legacy blog_posts in 0000_fuzzy_blizzard.sql is a
-- different abandoned CMS shape (tenant_id uuid, content text, etc.) — that
-- one belongs to a different code path. Because IF NOT EXISTS is used, this
-- statement is a no-op on any DB that already has *some* blog_posts table.
CREATE TABLE IF NOT EXISTS "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"brief_id" uuid,
	"title" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"excerpt" text,
	"body_markdown" text,
	"body_html" text,
	"meta_title" varchar(200),
	"meta_description" text,
	"canonical_url" text,
	"featured_image_asset_id" uuid,
	"author_user_id" varchar,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"scheduled_for" timestamp,
	"cms_target_key" varchar(64),
	"cms_post_id" varchar(200),
	"cms_post_url" text,
	"brand_voice_id" uuid,
	"style_guide_id" uuid,
	"seo_score" numeric(5, 2),
	"last_seo_check_at" timestamp,
	"ai_assistance_meta" jsonb,
	"decay_score" numeric(5, 2),
	"last_decay_check_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE TABLE IF NOT EXISTS "blog_citations" (
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

CREATE TABLE IF NOT EXISTS "blog_distribution_targets" (
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

CREATE TABLE IF NOT EXISTS "blog_distributions" (
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

CREATE TABLE IF NOT EXISTS "blog_keyword_clusters" (
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

CREATE TABLE IF NOT EXISTS "blog_keywords" (
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

CREATE TABLE IF NOT EXISTS "blog_performance_metrics" (
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

CREATE TABLE IF NOT EXISTS "blog_post_revisions" (
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

CREATE TABLE IF NOT EXISTS "blog_refresh_queue" (
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

CREATE TABLE IF NOT EXISTS "blog_style_guides" (
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

-- ---------------------------------------------------------------------------
-- Foreign keys (guarded; skip when constraint already present)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_posts_brief_id_blog_briefs_id_fk') THEN
    ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_brief_id_blog_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."blog_briefs"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_posts_featured_image_asset_id_blog_assets_id_fk') THEN
    ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_featured_image_asset_id_blog_assets_id_fk" FOREIGN KEY ("featured_image_asset_id") REFERENCES "public"."blog_assets"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_posts_brand_voice_id_blog_brand_voices_id_fk') THEN
    ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_brand_voice_id_blog_brand_voices_id_fk" FOREIGN KEY ("brand_voice_id") REFERENCES "public"."blog_brand_voices"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_posts_style_guide_id_blog_style_guides_id_fk') THEN
    ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_style_guide_id_blog_style_guides_id_fk" FOREIGN KEY ("style_guide_id") REFERENCES "public"."blog_style_guides"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_briefs_target_keyword_id_blog_keywords_id_fk') THEN
    ALTER TABLE "blog_briefs" ADD CONSTRAINT "blog_briefs_target_keyword_id_blog_keywords_id_fk" FOREIGN KEY ("target_keyword_id") REFERENCES "public"."blog_keywords"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_briefs_brand_voice_id_blog_brand_voices_id_fk') THEN
    ALTER TABLE "blog_briefs" ADD CONSTRAINT "blog_briefs_brand_voice_id_blog_brand_voices_id_fk" FOREIGN KEY ("brand_voice_id") REFERENCES "public"."blog_brand_voices"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_citations_post_id_blog_posts_id_fk') THEN
    ALTER TABLE "blog_citations" ADD CONSTRAINT "blog_citations_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_distributions_post_id_blog_posts_id_fk') THEN
    ALTER TABLE "blog_distributions" ADD CONSTRAINT "blog_distributions_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_distributions_target_id_blog_distribution_targets_id_fk') THEN
    ALTER TABLE "blog_distributions" ADD CONSTRAINT "blog_distributions_target_id_blog_distribution_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."blog_distribution_targets"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_keywords_cluster_id_blog_keyword_clusters_id_fk') THEN
    ALTER TABLE "blog_keywords" ADD CONSTRAINT "blog_keywords_cluster_id_blog_keyword_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."blog_keyword_clusters"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_performance_metrics_post_id_blog_posts_id_fk') THEN
    ALTER TABLE "blog_performance_metrics" ADD CONSTRAINT "blog_performance_metrics_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_performance_metrics_distribution_id_blog_distributions_id_fk') THEN
    ALTER TABLE "blog_performance_metrics" ADD CONSTRAINT "blog_performance_metrics_distribution_id_blog_distributions_id_fk" FOREIGN KEY ("distribution_id") REFERENCES "public"."blog_distributions"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_post_revisions_post_id_blog_posts_id_fk') THEN
    ALTER TABLE "blog_post_revisions" ADD CONSTRAINT "blog_post_revisions_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'blog_refresh_queue_post_id_blog_posts_id_fk') THEN
    ALTER TABLE "blog_refresh_queue" ADD CONSTRAINT "blog_refresh_queue_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "blog_agent_settings_tenant_idx" ON "blog_agent_settings" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_assets_tenant_idx" ON "blog_assets" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_assets_tenant_type_idx" ON "blog_assets" USING btree ("tenant_id","asset_type");
CREATE INDEX IF NOT EXISTS "blog_audit_log_tenant_idx" ON "blog_audit_log" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_audit_log_tenant_action_idx" ON "blog_audit_log" USING btree ("tenant_id","action");
CREATE INDEX IF NOT EXISTS "blog_audit_log_target_idx" ON "blog_audit_log" USING btree ("target_type","target_id");
CREATE INDEX IF NOT EXISTS "blog_audit_log_tenant_created_idx" ON "blog_audit_log" USING btree ("tenant_id","created_at");
CREATE INDEX IF NOT EXISTS "blog_brand_voices_tenant_idx" ON "blog_brand_voices" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_briefs_tenant_idx" ON "blog_briefs" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_briefs_tenant_status_idx" ON "blog_briefs" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "blog_briefs_assigned_idx" ON "blog_briefs" USING btree ("assigned_to_user_id");
CREATE INDEX IF NOT EXISTS "blog_citations_post_idx" ON "blog_citations" USING btree ("post_id");
CREATE INDEX IF NOT EXISTS "blog_citations_tenant_idx" ON "blog_citations" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_distribution_targets_tenant_idx" ON "blog_distribution_targets" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_distribution_targets_tenant_platform_idx" ON "blog_distribution_targets" USING btree ("tenant_id","platform");
CREATE INDEX IF NOT EXISTS "blog_distributions_post_platform_idx" ON "blog_distributions" USING btree ("post_id","platform");
CREATE INDEX IF NOT EXISTS "blog_distributions_tenant_idx" ON "blog_distributions" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_distributions_tenant_status_idx" ON "blog_distributions" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "blog_distributions_scheduled_idx" ON "blog_distributions" USING btree ("scheduled_for");
CREATE INDEX IF NOT EXISTS "blog_keyword_clusters_tenant_idx" ON "blog_keyword_clusters" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_keyword_clusters_parent_idx" ON "blog_keyword_clusters" USING btree ("parent_cluster_id");
CREATE INDEX IF NOT EXISTS "blog_keywords_tenant_idx" ON "blog_keywords" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_keywords_tenant_cluster_idx" ON "blog_keywords" USING btree ("tenant_id","cluster_id");
CREATE INDEX IF NOT EXISTS "blog_performance_metrics_post_date_idx" ON "blog_performance_metrics" USING btree ("post_id","metric_date");
CREATE INDEX IF NOT EXISTS "blog_performance_metrics_tenant_date_idx" ON "blog_performance_metrics" USING btree ("tenant_id","metric_date");
CREATE INDEX IF NOT EXISTS "blog_performance_metrics_source_idx" ON "blog_performance_metrics" USING btree ("source");
CREATE INDEX IF NOT EXISTS "blog_posts_tenant_idx" ON "blog_posts" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_posts_tenant_status_published_idx" ON "blog_posts" USING btree ("tenant_id","status","published_at");
CREATE INDEX IF NOT EXISTS "blog_posts_tenant_slug_idx" ON "blog_posts" USING btree ("tenant_id","slug");
CREATE INDEX IF NOT EXISTS "blog_posts_brief_idx" ON "blog_posts" USING btree ("brief_id");
CREATE INDEX IF NOT EXISTS "blog_post_revisions_post_idx" ON "blog_post_revisions" USING btree ("post_id");
CREATE INDEX IF NOT EXISTS "blog_post_revisions_tenant_idx" ON "blog_post_revisions" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_post_revisions_post_revision_idx" ON "blog_post_revisions" USING btree ("post_id","revision_number");
CREATE INDEX IF NOT EXISTS "blog_refresh_queue_tenant_scheduled_idx" ON "blog_refresh_queue" USING btree ("tenant_id","scheduled_at");
CREATE INDEX IF NOT EXISTS "blog_refresh_queue_tenant_status_idx" ON "blog_refresh_queue" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "blog_refresh_queue_post_idx" ON "blog_refresh_queue" USING btree ("post_id");

-- ---------------------------------------------------------------------------
-- Per US-BLOG-009: add the retention column inline so 0013 isn't needed after
-- this. Safe to re-run.
-- ---------------------------------------------------------------------------

ALTER TABLE "blog_agent_settings"
  ADD COLUMN IF NOT EXISTS "revision_retention_days" integer NOT NULL DEFAULT 90;
