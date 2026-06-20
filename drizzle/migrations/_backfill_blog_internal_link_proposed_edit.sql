-- US-BLOG-055: internal-link auto-injection — store the PR-style sentence edit.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_internal_link_proposed_edit.sql

ALTER TABLE "blog_internal_link_suggestions"
	ADD COLUMN IF NOT EXISTS "proposed_edit" jsonb;
