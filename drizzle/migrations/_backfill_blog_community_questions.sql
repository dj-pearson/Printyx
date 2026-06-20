-- US-BLOG-017: forum/community question miner (Reddit, Quora, Stack Exchange).
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_community_questions.sql
--
-- After creating the tables, apply RLS:
--   psql "$DATABASE_URL" -f drizzle/rls/blog.sql

CREATE TABLE IF NOT EXISTS "blog_community_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source" varchar(20) NOT NULL,
	"handle" varchar(200) NOT NULL,
	"label" varchar(200),
	"is_active" boolean NOT NULL DEFAULT true,
	"last_mined_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_community_sources_tenant_idx"
	ON "blog_community_sources" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_community_sources_tenant_source_idx"
	ON "blog_community_sources" USING btree ("tenant_id","source");

CREATE TABLE IF NOT EXISTS "blog_community_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_id" uuid REFERENCES "blog_community_sources"("id") ON DELETE SET NULL,
	"source" varchar(20) NOT NULL,
	"external_id" varchar(255),
	"source_url" text NOT NULL,
	"question_title" text NOT NULL,
	"question_body" text,
	"top_answer" text,
	"score" integer,
	"answer_count" integer,
	"theme_cluster" varchar(200),
	"theme_confidence" numeric(4, 3),
	"cluster_id" uuid REFERENCES "blog_keyword_clusters"("id") ON DELETE SET NULL,
	"raw_data" jsonb,
	"captured_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_community_questions_tenant_idx"
	ON "blog_community_questions" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_community_questions_tenant_source_idx"
	ON "blog_community_questions" USING btree ("tenant_id","source");
CREATE INDEX IF NOT EXISTS "blog_community_questions_tenant_theme_idx"
	ON "blog_community_questions" USING btree ("tenant_id","theme_cluster");
CREATE INDEX IF NOT EXISTS "blog_community_questions_tenant_external_idx"
	ON "blog_community_questions" USING btree ("tenant_id","external_id");
