-- US-BLOG-009: per-tenant retention for blog_post_revisions.
-- Default 90 days; configurable via PATCH /blog-agents/settings (range 7-730).
--
-- Idempotent + tolerant of migration ordering: if blog_agent_settings has not
-- been created yet (e.g. migration 0008_pretty_rocket_raccoon has not been
-- applied on this database), this migration is a no-op. Once 0008 runs the
-- column will already be present from the Drizzle schema definition for new
-- tables, so re-running 0013 afterwards is also safe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'blog_agent_settings'
  ) THEN
    ALTER TABLE "blog_agent_settings"
      ADD COLUMN IF NOT EXISTS "revision_retention_days" integer NOT NULL DEFAULT 90;
  END IF;
END $$;
