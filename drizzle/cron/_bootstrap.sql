-- ============================================================================
-- _bootstrap.sql — enables pg_cron + pg_net and grants the permissions
-- subsequent drizzle/cron/*.sql files depend on.
--
-- Run ONCE before applying any per-domain schedule file. Safe to re-run
-- (extensions use IF NOT EXISTS; GRANTs are idempotent).
--
-- If pg_cron isn't available in your Supabase deployment, every per-domain
-- cron file will fail — `cron.schedule` won't exist. Verify first:
--
--   SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
--
-- Supabase self-hosted includes both by default; if you get an "extension not
-- found" error, enable them in postgresql.conf via
-- `shared_preload_libraries = 'pg_cron,pg_net'` and restart.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- pg_cron creates its own `cron` schema owned by the `postgres` role. The
-- service-role account that applies migrations needs USAGE on that schema to
-- call cron.schedule() and cron.unschedule() from subsequent SQL files.
GRANT USAGE ON SCHEMA cron TO postgres;

-- INTERNAL_CRON_TOKEN guards edge-function endpoints that are only meant to
-- be hit by pg_net calls from scheduled jobs. We store it as a Postgres
-- runtime setting so cron bodies can read it via `current_setting()`. Set
-- the actual value OUT OF BAND (e.g. via `ALTER DATABASE postgres SET
-- app.internal_cron_token = 'actual-token'`), not in this file, because this
-- file is committed to git.
--
-- Example (run manually, never commit):
--   ALTER DATABASE postgres SET app.internal_cron_token = 'REDACTED';
--
-- The edge functions check the token via _shared/cron-auth.ts.

-- Sanity probe — surfaces a NOTICE if either extension is missing so the
-- operator catches it before per-domain files run.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE WARNING 'pg_cron extension not available — per-domain cron files will fail';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE WARNING 'pg_net extension not available — HTTP-calling cron jobs will fail';
  END IF;
END $$;
