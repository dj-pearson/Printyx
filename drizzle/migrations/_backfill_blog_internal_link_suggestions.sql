-- US-BLOG-020: internal-link opportunity finder.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_internal_link_suggestions.sql
--
-- After creating the table, apply RLS:
--   psql "$DATABASE_URL" -f drizzle/rls/blog.sql

CREATE TABLE IF NOT EXISTS "blog_internal_link_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"target_post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"anchor_text" varchar(300) NOT NULL,
	"context_snippet" text,
	"relevance_score" numeric(4, 3),
	"rationale" text,
	"status" varchar(16) NOT NULL DEFAULT 'suggested',
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_internal_link_suggestions_tenant_idx"
	ON "blog_internal_link_suggestions" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_internal_link_suggestions_source_idx"
	ON "blog_internal_link_suggestions" USING btree ("tenant_id","source_post_id");
CREATE INDEX IF NOT EXISTS "blog_internal_link_suggestions_status_idx"
	ON "blog_internal_link_suggestions" USING btree ("tenant_id","status");
