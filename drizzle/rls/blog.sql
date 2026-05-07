-- ============================================================================
-- blog.sql — RLS on the 14 blog module tables (US-BLOG-002).
--
-- Run order:
--   1. apply-rls.sql (first time, installs apply_tenant_rls function)
--   2. drizzle/migrations/00XX_*.sql for blog tables (or blog-tables.sql baseline)
--   3. this file
--
-- Idempotent; defensive (skips missing tables, emits NOTICE).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'blog_brand_voices',
    'blog_style_guides',
    'blog_keyword_clusters',
    'blog_keywords',
    'blog_briefs',
    'blog_assets',
    'blog_posts',
    'blog_post_revisions',
    'blog_citations',
    'blog_distribution_targets',
    'blog_distributions',
    'blog_performance_metrics',
    'blog_refresh_queue',
    'blog_audit_log',
    'blog_agent_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      PERFORM apply_tenant_rls(t);
    ELSE
      RAISE NOTICE 'SKIP: relation public.% does not exist — run the blog schema migration first', t;
    END IF;
  END LOOP;
END $$;

-- Append-only enforcement for blog_audit_log (US-BLOG-011).
-- The standard apply_tenant_rls() applies SELECT/INSERT/UPDATE/DELETE policies.
-- For an audit log we want INSERT + SELECT only — drop UPDATE and DELETE so
-- no tenant user (including platform admin) can rewrite history. Service role
-- bypasses RLS, but humans must not be able to mutate audit rows once written.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'blog_audit_log'
  ) THEN
    -- Drop the UPDATE / DELETE policies created by apply_tenant_rls
    EXECUTE 'DROP POLICY IF EXISTS "blog_audit_log_tenant_update" ON blog_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "blog_audit_log_tenant_delete" ON blog_audit_log';
    -- Revoke the corresponding GRANTs at the table level so PostgREST returns 403
    -- instead of "no rows" on UPDATE / DELETE attempts (clearer failure mode).
    EXECUTE 'REVOKE UPDATE, DELETE ON blog_audit_log FROM authenticated';
    RAISE NOTICE 'blog_audit_log is now append-only for the authenticated role';
  END IF;
END $$;

COMMIT;
