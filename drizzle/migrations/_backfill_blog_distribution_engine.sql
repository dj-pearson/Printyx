-- US-BLOG-021/052/053/054/055/063: Blog Distribution Engine.
-- New tables for the closed-loop distribution + refresh side of the blog system:
--   blog_decay_events             (021) decay flags + notification stub records
--   blog_schedule_models          (052) per (tenant, platform) optimal-time model
--   blog_utm_templates            (053) per-tenant UTM template + short-link config
--   blog_reshare_cadences         (054) per-post re-share cadence state
--   blog_link_injection_proposals (055) PR-style internal-link edit proposals
--   blog_refresh_queue_details    (063) companion to EXISTING blog_refresh_queue
--
-- Reuses (does NOT recreate): blog_posts, blog_refresh_queue,
-- blog_performance_metrics, blog_distributions, blog_distribution_targets,
-- blog_post_revisions, blog_keyword_clusters, blog_syndication_pieces.
--
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_distribution_engine.sql

-- ---------------------------------------------------------------------------
-- blog_decay_events (US-BLOG-021)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_decay_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"severity" varchar(12) NOT NULL DEFAULT 'none',
	"triggers" jsonb NOT NULL,
	"current_window" jsonb,
	"prior_window" jsonb,
	"deltas" jsonb,
	"refresh_queue_id" uuid REFERENCES "blog_refresh_queue"("id") ON DELETE SET NULL,
	"notification_channel" varchar(16),
	"notification_status" varchar(16),
	"notification_detail" jsonb,
	"detected_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_decay_events_tenant_idx"
	ON "blog_decay_events" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_decay_events_tenant_post_idx"
	ON "blog_decay_events" USING btree ("tenant_id","post_id");
CREATE INDEX IF NOT EXISTS "blog_decay_events_detected_idx"
	ON "blog_decay_events" USING btree ("detected_at");

-- ---------------------------------------------------------------------------
-- blog_schedule_models (US-BLOG-052)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_schedule_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"platform" varchar(40) NOT NULL,
	"buckets" jsonb NOT NULL,
	"ranked_slots" jsonb NOT NULL,
	"source" varchar(24) NOT NULL DEFAULT 'industry_default',
	"sample_size" integer NOT NULL DEFAULT 0,
	"computed_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_schedule_models_tenant_idx"
	ON "blog_schedule_models" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_schedule_models_tenant_platform_idx"
	ON "blog_schedule_models" USING btree ("tenant_id","platform");
-- One model per (tenant, platform) — upsert target.
CREATE UNIQUE INDEX IF NOT EXISTS "blog_schedule_models_tenant_platform_uq"
	ON "blog_schedule_models" USING btree ("tenant_id","platform");

-- ---------------------------------------------------------------------------
-- blog_utm_templates (US-BLOG-053)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_utm_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL DEFAULT 'Default',
	"source_template" varchar(200) NOT NULL DEFAULT '{platform}',
	"medium_template" varchar(200) NOT NULL DEFAULT '{channel}',
	"campaign_template" varchar(200) NOT NULL DEFAULT '{post_slug}',
	"content_template" varchar(200),
	"term_template" varchar(200),
	"short_link_provider" varchar(24),
	"short_link_config" jsonb,
	"is_default" boolean NOT NULL DEFAULT true,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_utm_templates_tenant_idx"
	ON "blog_utm_templates" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_utm_templates_tenant_default_idx"
	ON "blog_utm_templates" USING btree ("tenant_id","is_default");

-- ---------------------------------------------------------------------------
-- blog_reshare_cadences (US-BLOG-054)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_reshare_cadences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"published_at" timestamp,
	"steps" jsonb NOT NULL,
	"paused" boolean NOT NULL DEFAULT false,
	"engagement_stop_threshold" numeric(6, 4),
	"auto_stopped_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_reshare_cadences_tenant_idx"
	ON "blog_reshare_cadences" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_reshare_cadences_tenant_post_idx"
	ON "blog_reshare_cadences" USING btree ("tenant_id","post_id");

-- ---------------------------------------------------------------------------
-- blog_link_injection_proposals (US-BLOG-055)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_link_injection_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"batch_id" uuid NOT NULL,
	"pillar_post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"target_post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"similarity_score" numeric(6, 4),
	"anchor_text" varchar(300),
	"sentence_before" varchar(4000),
	"sentence_after" varchar(4000),
	"pillar_url" varchar(2000),
	"status" varchar(16) NOT NULL DEFAULT 'proposed',
	"applied_revision_id" uuid REFERENCES "blog_post_revisions"("id") ON DELETE SET NULL,
	"cms_push_result" jsonb,
	"decided_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_link_injection_proposals_tenant_idx"
	ON "blog_link_injection_proposals" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_link_injection_proposals_batch_idx"
	ON "blog_link_injection_proposals" USING btree ("batch_id");
CREATE INDEX IF NOT EXISTS "blog_link_injection_proposals_pillar_idx"
	ON "blog_link_injection_proposals" USING btree ("tenant_id","pillar_post_id");

-- ---------------------------------------------------------------------------
-- blog_refresh_queue_details (US-BLOG-063) — companion to blog_refresh_queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_refresh_queue_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"queue_id" uuid NOT NULL REFERENCES "blog_refresh_queue"("id") ON DELETE CASCADE,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"severity" varchar(12),
	"suggested_edits" jsonb,
	"estimated_effort" jsonb,
	"last_refreshed_at" timestamp,
	"baseline_position" numeric(6, 2),
	"recovery_status" varchar(16),
	"recovery_checked_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_refresh_queue_details_tenant_idx"
	ON "blog_refresh_queue_details" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_refresh_queue_details_queue_idx"
	ON "blog_refresh_queue_details" USING btree ("queue_id");
CREATE INDEX IF NOT EXISTS "blog_refresh_queue_details_post_idx"
	ON "blog_refresh_queue_details" USING btree ("post_id");
-- 1:1 with a queue row.
CREATE UNIQUE INDEX IF NOT EXISTS "blog_refresh_queue_details_queue_uq"
	ON "blog_refresh_queue_details" USING btree ("queue_id");
