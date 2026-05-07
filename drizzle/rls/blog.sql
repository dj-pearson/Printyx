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
    'blog_audit_log'
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

COMMIT;
