-- US-BLOG-039: per-tenant self-critique loop toggle.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_critique_loop.sql

ALTER TABLE "blog_agent_settings"
  ADD COLUMN IF NOT EXISTS "critique_loop_enabled" boolean NOT NULL DEFAULT false;
