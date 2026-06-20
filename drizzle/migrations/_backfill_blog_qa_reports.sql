-- US-BLOG-040: pre-publish QA reports (link check, OG preview, a11y, schema), cached 1h.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_qa_reports.sql

CREATE TABLE IF NOT EXISTS "blog_qa_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"overall_pass" boolean NOT NULL DEFAULT false,
	"link_check" jsonb,
	"og_preview" jsonb,
	"a11y" jsonb,
	"schema_check" jsonb,
	"summary" jsonb,
	"overridden" boolean NOT NULL DEFAULT false,
	"override_reason" text,
	"override_by_user_id" varchar,
	"checked_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_qa_reports_tenant_idx" ON "blog_qa_reports" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_qa_reports_post_checked_idx" ON "blog_qa_reports" USING btree ("post_id","checked_at");
