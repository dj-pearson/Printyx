-- ============================================================================
-- blog.sql — RLS on the blog module tables (US-BLOG-002 + extensions).
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
    'blog_agent_settings',
    'blog_jobs',
    'blog_serp_snapshots',
    'blog_competitor_keywords',
    'blog_ai_costs',
    'blog_ai_quotas',
    'blog_pipeline_runs',
    'blog_pipeline_stages',
    'blog_qa_reports',
    'blog_rank_forecasts',
    'blog_authors',
    'blog_outline_variants',
    'blog_experiments',
    'blog_post_variants',
    'blog_syndication_pieces',
    -- US-BLOG-017,019,020,022,025,026 (topic intelligence)
    'blog_community_seeds',
    'blog_community_questions',
    'blog_cluster_extensions',
    'blog_keyword_embeddings',
    'blog_post_embeddings',
    'blog_internal_link_suggestions',
    'blog_cluster_authority_scores',
    'blog_citation_sources',
    'blog_readability_snapshots',
    -- US-BLOG-029,032,034,035,037,038 (authoring tools)
    'blog_data_assets',
    'blog_chart_specs',
    'blog_content_scans',
    'blog_factcheck_runs',
    -- US-BLOG-021,052,053,054,055,063 (distribution engine)
    'blog_decay_events',
    'blog_schedule_models',
    'blog_utm_templates',
    'blog_reshare_cadences',
    'blog_link_injection_proposals',
    'blog_refresh_queue_details',
    -- US-BLOG-056,057,058,059,060 (outreach)
    'blog_backlinks',
    'blog_backlink_events',
    'blog_brand_mentions',
    'blog_outreach_prospects',
    'blog_haro_queries',
    'blog_haro_pitches',
    'blog_outreach_threads',
    'blog_outreach_messages',
    -- US-BLOG-061,065,067,068,069 (analytics intelligence)
    'blog_analytics_connections',
    'blog_conversion_config',
    'blog_cohort_metrics',
    'blog_llm_citations',
    'blog_aeo_scores',
    'blog_kg_entities',
    'blog_kg_edges',
    -- US-BLOG-066,070,071 (SERP monitor + auto-refresh agent)
    'blog_serp_monitor_config',
    'blog_serp_volatility_events',
    'blog_serp_alerts',
    'blog_competitor_feeds',
    'blog_competitor_posts',
    'blog_auto_refresh_config',
    'blog_auto_refresh_runs',
    'blog_auto_refresh_reviews',
    -- US-BLOG-042,074,075,076,077 (content platform)
    'blog_publish_attempts',
    'blog_pseo_templates',
    'blog_pseo_jobs',
    'blog_pseo_rows',
    'blog_interactive_blocks',
    'blog_interactive_events',
    'blog_media_outputs',
    'blog_locales',
    'blog_glossary_terms',
    'blog_post_translations',
    -- US-BLOG-079,080,081,083,084 (platform API + compliance)
    'blog_webhooks',
    'blog_webhook_deliveries',
    'blog_api_keys',
    'blog_api_usage',
    'blog_backups',
    'blog_backup_config',
    'blog_widget_config',
    'blog_dsar_requests'
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
