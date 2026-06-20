-- US-BLOG-056..060: link-building / outreach tables.
--   056 backlink monitoring + lost-link recovery: blog_backlinks, blog_backlink_events
--   057 unlinked brand-mention monitor -> outreach: blog_brand_mentions (+ threads)
--   058 outreach list generator: blog_outreach_prospects
--   059 HARO / Help-A-B2B-Writer pitch generator: blog_haro_queries, blog_haro_pitches
--   060 outreach agent (research + draft + reply tracking): blog_outreach_threads, blog_outreach_messages
--
-- FKs to existing blog tables (blog_posts, blog_authors) are declared here only,
-- mirroring _backfill_blog_syndication.sql. Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_outreach.sql

-- ---------------------------------------------------------------------------
-- blog_backlinks (US-BLOG-056)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_backlinks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid REFERENCES "blog_posts"("id") ON DELETE SET NULL,
	"source_domain" varchar(255) NOT NULL,
	"source_url" varchar(2000) NOT NULL,
	"target_url" varchar(2000),
	"domain_authority" integer,
	"anchor_text" varchar(1000),
	"status" varchar(20) NOT NULL DEFAULT 'new',
	"first_seen" timestamp NOT NULL DEFAULT now(),
	"last_seen" timestamp NOT NULL DEFAULT now(),
	"lost_at" timestamp,
	"source" varchar(40),
	"metadata" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_backlinks_tenant_idx"
	ON "blog_backlinks" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_backlinks_tenant_post_idx"
	ON "blog_backlinks" USING btree ("tenant_id","post_id");
CREATE INDEX IF NOT EXISTS "blog_backlinks_tenant_status_idx"
	ON "blog_backlinks" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "blog_backlinks_tenant_domain_idx"
	ON "blog_backlinks" USING btree ("tenant_id","source_domain");

-- ---------------------------------------------------------------------------
-- blog_backlink_events (US-BLOG-056)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_backlink_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"backlink_id" uuid REFERENCES "blog_backlinks"("id") ON DELETE CASCADE,
	"post_id" uuid REFERENCES "blog_posts"("id") ON DELETE SET NULL,
	"event_type" varchar(24) NOT NULL,
	"source_domain" varchar(255),
	"source_url" varchar(2000),
	"last_seen_url" varchar(2000),
	"domain_authority" integer,
	"notified" boolean NOT NULL DEFAULT false,
	"notified_at" timestamp,
	"detail" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_backlink_events_tenant_idx"
	ON "blog_backlink_events" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_backlink_events_tenant_type_idx"
	ON "blog_backlink_events" USING btree ("tenant_id","event_type");
CREATE INDEX IF NOT EXISTS "blog_backlink_events_backlink_idx"
	ON "blog_backlink_events" USING btree ("backlink_id");

-- ---------------------------------------------------------------------------
-- blog_brand_mentions (US-BLOG-057)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_brand_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"url" varchar(2000) NOT NULL,
	"source_domain" varchar(255),
	"snippet" text,
	"has_link" boolean NOT NULL DEFAULT false,
	"domain_authority" integer,
	"status" varchar(20) NOT NULL DEFAULT 'detected',
	"thread_id" uuid,
	"detected_at" timestamp NOT NULL DEFAULT now(),
	"last_checked_at" timestamp,
	"link_added_at" timestamp,
	"source" varchar(40),
	"metadata" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_brand_mentions_tenant_idx"
	ON "blog_brand_mentions" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_brand_mentions_tenant_status_idx"
	ON "blog_brand_mentions" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "blog_brand_mentions_tenant_has_link_idx"
	ON "blog_brand_mentions" USING btree ("tenant_id","has_link");

-- ---------------------------------------------------------------------------
-- blog_outreach_prospects (US-BLOG-058)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_outreach_prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid REFERENCES "blog_posts"("id") ON DELETE SET NULL,
	"site_domain" varchar(255) NOT NULL,
	"contact_email" varchar(320),
	"contact_name" varchar(200),
	"contact_role" varchar(200),
	"domain_authority" integer,
	"relevance_score" numeric(5, 2),
	"is_directory" boolean NOT NULL DEFAULT false,
	"suggested_angle" text,
	"source_competitor_url" varchar(2000),
	"contact_source" varchar(40),
	"status" varchar(20) NOT NULL DEFAULT 'new',
	"thread_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_outreach_prospects_tenant_idx"
	ON "blog_outreach_prospects" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_outreach_prospects_tenant_post_idx"
	ON "blog_outreach_prospects" USING btree ("tenant_id","post_id");
CREATE INDEX IF NOT EXISTS "blog_outreach_prospects_tenant_status_idx"
	ON "blog_outreach_prospects" USING btree ("tenant_id","status");

-- ---------------------------------------------------------------------------
-- blog_haro_queries (US-BLOG-059)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_haro_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"external_id" varchar(200),
	"subject" varchar(500),
	"query_text" text NOT NULL,
	"category" varchar(200),
	"outlet" varchar(255),
	"deadline" timestamp,
	"matched_author_id" uuid REFERENCES "blog_authors"("id") ON DELETE SET NULL,
	"match_score" numeric(5, 2),
	"status" varchar(20) NOT NULL DEFAULT 'new',
	"source" varchar(40),
	"metadata" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_haro_queries_tenant_idx"
	ON "blog_haro_queries" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_haro_queries_tenant_status_idx"
	ON "blog_haro_queries" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "blog_haro_queries_author_idx"
	ON "blog_haro_queries" USING btree ("matched_author_id");

-- ---------------------------------------------------------------------------
-- blog_haro_pitches (US-BLOG-059)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_haro_pitches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"query_id" uuid NOT NULL REFERENCES "blog_haro_queries"("id") ON DELETE CASCADE,
	"author_id" uuid REFERENCES "blog_authors"("id") ON DELETE SET NULL,
	"pitch_text" text NOT NULL,
	"status" varchar(20) NOT NULL DEFAULT 'draft',
	"evidence_post_ids" jsonb,
	"approved_by_user_id" varchar,
	"approved_at" timestamp,
	"sent_at" timestamp,
	"replied_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_haro_pitches_tenant_idx"
	ON "blog_haro_pitches" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_haro_pitches_query_idx"
	ON "blog_haro_pitches" USING btree ("query_id");
CREATE INDEX IF NOT EXISTS "blog_haro_pitches_tenant_status_idx"
	ON "blog_haro_pitches" USING btree ("tenant_id","status");

-- ---------------------------------------------------------------------------
-- blog_outreach_threads (US-BLOG-057 / US-BLOG-060)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_outreach_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"prospect_id" uuid REFERENCES "blog_outreach_prospects"("id") ON DELETE SET NULL,
	"brand_mention_id" uuid REFERENCES "blog_brand_mentions"("id") ON DELETE SET NULL,
	"post_id" uuid REFERENCES "blog_posts"("id") ON DELETE SET NULL,
	"recipient_email" varchar(320) NOT NULL,
	"recipient_name" varchar(200),
	"subject" varchar(500),
	"template_key" varchar(120),
	"angle" varchar(200),
	"status" varchar(20) NOT NULL DEFAULT 'draft',
	"followup_count" integer NOT NULL DEFAULT 0,
	"last_action_at" timestamp,
	"next_action_at" timestamp,
	"closed_reason" varchar(60),
	"research" jsonb,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_outreach_threads_tenant_idx"
	ON "blog_outreach_threads" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_outreach_threads_tenant_status_idx"
	ON "blog_outreach_threads" USING btree ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "blog_outreach_threads_prospect_idx"
	ON "blog_outreach_threads" USING btree ("prospect_id");
CREATE INDEX IF NOT EXISTS "blog_outreach_threads_next_action_idx"
	ON "blog_outreach_threads" USING btree ("tenant_id","next_action_at");

-- ---------------------------------------------------------------------------
-- blog_outreach_messages (US-BLOG-060)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_outreach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"thread_id" uuid NOT NULL REFERENCES "blog_outreach_threads"("id") ON DELETE CASCADE,
	"direction" varchar(8) NOT NULL,
	"subject" varchar(500),
	"body" text NOT NULL,
	"kind" varchar(24),
	"classification" varchar(24),
	"proposed_next_action" text,
	"sent_at" timestamp,
	"received_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_outreach_messages_tenant_idx"
	ON "blog_outreach_messages" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_outreach_messages_thread_idx"
	ON "blog_outreach_messages" USING btree ("thread_id");
CREATE INDEX IF NOT EXISTS "blog_outreach_messages_tenant_direction_idx"
	ON "blog_outreach_messages" USING btree ("tenant_id","direction");
