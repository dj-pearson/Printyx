-- US-BLOG-027: JSON-LD schema markup support.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_schema_markup.sql

ALTER TABLE "blog_posts"
  ADD COLUMN IF NOT EXISTS "schema_type" varchar(20);

ALTER TABLE "blog_agent_settings"
  ADD COLUMN IF NOT EXISTS "organization_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "organization_url" varchar(500),
  ADD COLUMN IF NOT EXISTS "organization_logo_url" varchar(1000);
