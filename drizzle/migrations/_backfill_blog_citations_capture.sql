-- US-BLOG-025: source aggregator + citation capture.
-- Adds link-rot-protection columns to the existing blog_citations table.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_citations_capture.sql

ALTER TABLE "blog_citations" ADD COLUMN IF NOT EXISTS "excerpt" text;
ALTER TABLE "blog_citations" ADD COLUMN IF NOT EXISTS "og_image" text;
ALTER TABLE "blog_citations" ADD COLUMN IF NOT EXISTS "retrieved_at" timestamp;
ALTER TABLE "blog_citations" ADD COLUMN IF NOT EXISTS "ref_key" varchar(64);

CREATE INDEX IF NOT EXISTS "blog_citations_post_refkey_idx"
	ON "blog_citations" USING btree ("post_id","ref_key");
