-- US-BLOG-037: inline fact-checker — per-claim verdicts against captured sources.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_fact_check_claims.sql
--
-- After creating the table, apply RLS:
--   psql "$DATABASE_URL" -f drizzle/rls/blog.sql

CREATE TABLE IF NOT EXISTS "blog_fact_check_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"run_id" uuid NOT NULL,
	"claim_text" text NOT NULL,
	"citation_id" uuid REFERENCES "blog_citations"("id") ON DELETE SET NULL,
	"verdict" varchar(16) NOT NULL,
	"confidence" numeric(4, 3),
	"explanation" text,
	"char_start" integer,
	"char_end" integer,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_fact_check_claims_tenant_idx"
	ON "blog_fact_check_claims" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_fact_check_claims_post_run_idx"
	ON "blog_fact_check_claims" USING btree ("post_id","run_id");
