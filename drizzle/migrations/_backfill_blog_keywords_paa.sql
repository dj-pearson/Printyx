-- US-BLOG-016: extend blog_keywords with PAA/autocomplete provenance fields.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_keywords_paa.sql

ALTER TABLE "blog_keywords"
  ADD COLUMN IF NOT EXISTS "source_type" varchar(20),
  ADD COLUMN IF NOT EXISTS "parent_keyword_id" uuid,
  ADD COLUMN IF NOT EXISTS "parent_question" text,
  ADD COLUMN IF NOT EXISTS "mining_depth" integer;

CREATE INDEX IF NOT EXISTS "blog_keywords_parent_idx" ON "blog_keywords" USING btree ("parent_keyword_id");
CREATE INDEX IF NOT EXISTS "blog_keywords_tenant_source_idx" ON "blog_keywords" USING btree ("tenant_id","source_type");
