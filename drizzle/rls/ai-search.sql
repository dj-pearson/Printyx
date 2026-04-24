-- ============================================================================
-- ai-search.sql — RLS on vector search + knowledge graph tables.
--
-- All tenant_id columns are uuid. The canonical helper handles that.
-- Depends on: drizzle/rls/apply-rls.sql + ai-search-tables.sql.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'vector_embeddings',
    'ai_search_queries',
    'ai_generated_answers',
    'knowledge_entities',
    'search_sessions',
    'search_analytics',
    'content_similarities'
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
