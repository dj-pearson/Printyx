-- ============================================================================
-- knowledge-base-engagement.sql — RLS on engagement tables (bookmarks,
-- ratings, votes, reading_history).
--
-- All four tables have uuid tenant_id columns, so the canonical
-- apply_tenant_rls helper handles them. Per-user scoping (the user can only
-- see their own bookmarks / history / ratings) is enforced by the handlers,
-- not by RLS — but RLS still prevents cross-tenant access even if a handler
-- bug leaks through.
--
-- Depends on: drizzle/rls/apply-rls.sql + knowledge-base-engagement-tables.sql.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'article_bookmarks',
    'reading_history',
    'article_ratings',
    'article_votes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      PERFORM apply_tenant_rls(t);
    ELSE
      RAISE NOTICE 'SKIP: relation public.% does not exist', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
