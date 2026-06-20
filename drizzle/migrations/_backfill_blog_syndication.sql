-- US-BLOG-043..051: per-platform syndication pieces (email, X, LinkedIn, Meta,
-- TikTok/Shorts, Pinterest, Reddit, HN/Medium/Substack, Slack/Discord).
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_syndication.sql

CREATE TABLE IF NOT EXISTS "blog_syndication_pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"platform" varchar(40) NOT NULL,
	"variant_label" varchar(200),
	"content" jsonb NOT NULL,
	"status" varchar(20) NOT NULL DEFAULT 'draft',
	"post_url" varchar(2000),
	"utm" jsonb,
	"target_config" jsonb,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_syndication_pieces_tenant_idx"
	ON "blog_syndication_pieces" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_syndication_pieces_tenant_post_idx"
	ON "blog_syndication_pieces" USING btree ("tenant_id","post_id");
CREATE INDEX IF NOT EXISTS "blog_syndication_pieces_tenant_platform_idx"
	ON "blog_syndication_pieces" USING btree ("tenant_id","platform");
