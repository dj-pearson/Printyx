-- US-BLOG-070 / US-BLOG-071 / US-BLOG-066:
--   070 Real-time SERP monitor + auto-refresh triggers
--   071 Competitor publishing alerts with response brief
--   066 Auto-refresh agent (fully autonomous SERP-decay re-editing)
--
-- New-table FKs to existing blog tables are declared HERE (not in the Drizzle
-- schema), matching the blog module convention. Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_serp_monitor.sql

-- ===========================================================================
-- US-BLOG-070
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "blog_serp_monitor_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tier1_keywords" text[],
	"tier1_auto_top_n" integer NOT NULL DEFAULT 50,
	"alert_channels" text[],
	"alert_config" jsonb,
	"rank_change_threshold" integer NOT NULL DEFAULT 3,
	"enabled" boolean NOT NULL DEFAULT true,
	"location_code" integer NOT NULL DEFAULT 2840,
	"language_code" varchar(16) NOT NULL DEFAULT 'en',
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_serp_monitor_config_tenant_idx"
	ON "blog_serp_monitor_config" USING btree ("tenant_id");

CREATE TABLE IF NOT EXISTS "blog_serp_volatility_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"keyword" varchar(500) NOT NULL,
	"tier" varchar(16) NOT NULL DEFAULT 'standard',
	"kind" varchar(32) NOT NULL,
	"magnitude" integer NOT NULL DEFAULT 0,
	"significant" boolean NOT NULL DEFAULT false,
	"previous_rank" integer,
	"current_rank" integer,
	"detail" jsonb,
	"previous_snapshot_id" uuid REFERENCES "blog_serp_snapshots"("id") ON DELETE SET NULL,
	"current_snapshot_id" uuid REFERENCES "blog_serp_snapshots"("id") ON DELETE SET NULL,
	"post_id" uuid REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"refresh_queue_id" uuid REFERENCES "blog_refresh_queue"("id") ON DELETE SET NULL,
	"detected_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_serp_volatility_events_tenant_idx"
	ON "blog_serp_volatility_events" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_serp_volatility_events_tenant_keyword_idx"
	ON "blog_serp_volatility_events" USING btree ("tenant_id","keyword","detected_at");
CREATE INDEX IF NOT EXISTS "blog_serp_volatility_events_post_idx"
	ON "blog_serp_volatility_events" USING btree ("post_id");

CREATE TABLE IF NOT EXISTS "blog_serp_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source" varchar(24) NOT NULL,
	"channel" varchar(16) NOT NULL,
	"volatility_event_id" uuid REFERENCES "blog_serp_volatility_events"("id") ON DELETE SET NULL,
	"competitor_post_id" uuid,
	"keyword" varchar(500),
	"title" varchar(500),
	"message" text,
	"payload" jsonb,
	"status" varchar(16) NOT NULL DEFAULT 'queued',
	"sent_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_serp_alerts_tenant_idx"
	ON "blog_serp_alerts" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_serp_alerts_tenant_status_idx"
	ON "blog_serp_alerts" USING btree ("tenant_id","status");

-- ===========================================================================
-- US-BLOG-071
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "blog_competitor_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"competitor_name" varchar(255),
	"domain" varchar(255),
	"feed_url" text NOT NULL,
	"feed_kind" varchar(16) NOT NULL DEFAULT 'rss',
	"enabled" boolean NOT NULL DEFAULT true,
	"last_polled_at" timestamp,
	"last_seen_cursor" text,
	"poll_error_count" integer NOT NULL DEFAULT 0,
	"last_error" text,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_competitor_feeds_tenant_idx"
	ON "blog_competitor_feeds" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_competitor_feeds_tenant_domain_idx"
	ON "blog_competitor_feeds" USING btree ("tenant_id","domain");

CREATE TABLE IF NOT EXISTS "blog_competitor_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"feed_id" uuid NOT NULL REFERENCES "blog_competitor_feeds"("id") ON DELETE CASCADE,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"title" varchar(1000),
	"excerpt" text,
	"published_at" timestamp,
	"detected_fresh" boolean NOT NULL DEFAULT false,
	"summary" text,
	"cluster_id" uuid REFERENCES "blog_keyword_clusters"("id") ON DELETE SET NULL,
	"overlapping_keywords" text[],
	"targets_our_keyword" boolean NOT NULL DEFAULT false,
	"response_brief" jsonb,
	"brief_id" uuid REFERENCES "blog_briefs"("id") ON DELETE SET NULL,
	"status" varchar(16) NOT NULL DEFAULT 'new',
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "blog_competitor_posts_tenant_idx"
	ON "blog_competitor_posts" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_competitor_posts_feed_external_idx"
	ON "blog_competitor_posts" USING btree ("feed_id","external_id");
CREATE INDEX IF NOT EXISTS "blog_competitor_posts_tenant_status_idx"
	ON "blog_competitor_posts" USING btree ("tenant_id","status");

-- Dedupe: at most one row per (feed, external_id).
CREATE UNIQUE INDEX IF NOT EXISTS "blog_competitor_posts_feed_external_uq"
	ON "blog_competitor_posts" USING btree ("feed_id","external_id");

-- Deferred FK from 070's alerts table to 071's competitor_posts (created here
-- now that the target table exists).
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'blog_serp_alerts_competitor_post_id_fkey'
	) THEN
		ALTER TABLE "blog_serp_alerts"
			ADD CONSTRAINT "blog_serp_alerts_competitor_post_id_fkey"
			FOREIGN KEY ("competitor_post_id")
			REFERENCES "blog_competitor_posts"("id") ON DELETE SET NULL;
	END IF;
END $$;

-- ===========================================================================
-- US-BLOG-066
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "blog_auto_refresh_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL UNIQUE,
	"auto_refresh_requires_review" boolean NOT NULL DEFAULT false,
	"max_body_change_pct" integer NOT NULL DEFAULT 40,
	"block_on_seo_score_drop" boolean NOT NULL DEFAULT true,
	"block_on_brand_voice_violation" boolean NOT NULL DEFAULT true,
	"min_days_between_refresh" integer NOT NULL DEFAULT 14,
	"max_posts_per_run" integer NOT NULL DEFAULT 10,
	"enabled" boolean NOT NULL DEFAULT true,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_auto_refresh_config_tenant_idx"
	ON "blog_auto_refresh_config" USING btree ("tenant_id");

CREATE TABLE IF NOT EXISTS "blog_auto_refresh_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"refresh_queue_id" uuid REFERENCES "blog_refresh_queue"("id") ON DELETE SET NULL,
	"trigger" varchar(16) NOT NULL DEFAULT 'cron',
	"status" varchar(24) NOT NULL DEFAULT 'running',
	"serp_diff" jsonb,
	"predicted_body_change_pct" numeric(5,2),
	"seo_score_before" numeric(5,2),
	"seo_score_after" numeric(5,2),
	"guardrail_result" jsonb,
	"revision_id" uuid REFERENCES "blog_post_revisions"("id") ON DELETE SET NULL,
	"review_id" uuid,
	"cms_published" boolean NOT NULL DEFAULT false,
	"cms_result" jsonb,
	"change_summary" text,
	"cost_cents" integer NOT NULL DEFAULT 0,
	"prompt_tokens" integer NOT NULL DEFAULT 0,
	"completion_tokens" integer NOT NULL DEFAULT 0,
	"model" varchar(64),
	"error_message" text,
	"started_at" timestamp NOT NULL DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_auto_refresh_runs_tenant_idx"
	ON "blog_auto_refresh_runs" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_runs_post_idx"
	ON "blog_auto_refresh_runs" USING btree ("post_id");
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_runs_tenant_status_idx"
	ON "blog_auto_refresh_runs" USING btree ("tenant_id","status");

CREATE TABLE IF NOT EXISTS "blog_auto_refresh_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"run_id" uuid NOT NULL REFERENCES "blog_auto_refresh_runs"("id") ON DELETE CASCADE,
	"reason" varchar(32) NOT NULL,
	"reason_detail" jsonb,
	"proposed_content" jsonb,
	"change_summary" text,
	"status" varchar(16) NOT NULL DEFAULT 'pending',
	"resolved_by_user_id" varchar,
	"resolved_at" timestamp,
	"resolution_note" text,
	"revision_id" uuid REFERENCES "blog_post_revisions"("id") ON DELETE SET NULL,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "blog_auto_refresh_reviews_tenant_idx"
	ON "blog_auto_refresh_reviews" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_reviews_tenant_status_idx"
	ON "blog_auto_refresh_reviews" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "blog_auto_refresh_reviews_post_idx"
	ON "blog_auto_refresh_reviews" USING btree ("post_id");

-- Deferred FK from runs.review_id → reviews (created here now that reviews exists).
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'blog_auto_refresh_runs_review_id_fkey'
	) THEN
		ALTER TABLE "blog_auto_refresh_runs"
			ADD CONSTRAINT "blog_auto_refresh_runs_review_id_fkey"
			FOREIGN KEY ("review_id")
			REFERENCES "blog_auto_refresh_reviews"("id") ON DELETE SET NULL;
	END IF;
END $$;
