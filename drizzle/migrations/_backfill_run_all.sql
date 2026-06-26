-- _backfill_run_all.sql
--
-- Single ordered entry point for every hand-run _backfill_*.sql repair script.
-- These scripts carry an underscore prefix so drizzle-kit ignores them (they are
-- NOT in meta/_journal.json); they exist because 0008 bombed mid-script on some
-- installs and never reached the blog DDL. They are idempotent, so re-running
-- this whole file is safe.
--
-- Run with (psql \ir = include relative to THIS file, so CWD doesn't matter):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/migrations/_backfill_run_all.sql
--
-- ON_ERROR_STOP=1 makes psql halt on the FIRST failure instead of plowing on,
-- so if a dependency is still missing you find out immediately and in order.
--
-- IMPORTANT: run with psql's default autocommit — do NOT pass --single-transaction
-- and do NOT paste this into a GUI client (DBeaver/pgAdmin) that wraps the whole
-- script in one transaction. Each CREATE/ALTER here is independently idempotent;
-- a single transaction would roll back every successful statement if any one
-- later statement fails (this is exactly how a stray 42703 on a sibling table
-- rolled back the freshly-created machine_supply_levels).
--
-- Ordering rule: a script that REFERENCES a table must run AFTER the script that
-- CREATES it. Tiers below encode that. Do not reorder without re-checking deps.

\set ON_ERROR_STOP on

-- ===========================================================================
-- Pre-flight self-heal: non-destructive fixes for partially-applied tables.
-- ===========================================================================
-- A half-applied install can leave any of the machine-keyed tables present but
-- WITHOUT machine_id, which makes its CREATE INDEX (machine_id) throw 42703 and
-- (under a wrapping transaction) roll back the rest. For each such table: if it
-- already exists, add the column. ADD COLUMN IF NOT EXISTS never drops data; if
-- the table is absent the backfill below creates it correctly with the column.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'machine_supply_levels',
    'supply_orders',
    'machine_supply_settings',
    'equipment_failure_predictions'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS machine_id varchar', t);
    END IF;
  END LOOP;
END $$;

-- ===========================================================================
-- Tier 0 — standalone feature tables (only external dep is business_records,
-- which already exists in the base schema). Order within the tier is irrelevant.
-- ===========================================================================
\echo '== Tier 0: standalone feature backfills =='
\ir _backfill_chatbot.sql
\ir _backfill_churn_risk.sql
\ir _backfill_contract_pnl.sql
\ir _backfill_daily_briefing.sql
\ir _backfill_deal_desk_copilot.sql
\ir _backfill_email_autopilot.sql
\ir _backfill_meter_read_vision.sql
\ir _backfill_portal_service_classification.sql
\ir _backfill_predictive_failure.sql
\ir _backfill_qbr.sql
\ir _backfill_renewal_autoquote.sql
\ir _backfill_service_knowledge.sql
\ir _backfill_toner_replenish.sql
\ir _backfill_truck_stock.sql
\ir _backfill_voice_agent.sql
\ir _backfill_voice_ticket_close.sql

-- ===========================================================================
-- Tier 1 — blog FOUNDATION. Creates blog_posts, blog_assets, blog_briefs,
-- blog_keywords, blog_keyword_clusters, blog_citations, blog_brand_voices,
-- blog_distribution_targets, blog_refresh_queue, blog_post_revisions, etc.
-- EVERYTHING below depends on this. Must run first among the blog scripts.
-- ===========================================================================
\echo '== Tier 1: blog foundation =='
\ir _backfill_blog_tables.sql

-- ===========================================================================
-- Tier 2 — depend only on the foundation. Note the three that LATER tiers need:
--   blog_authors          -> needed by blog_outreach
--   blog_serp_snapshots   -> needed by blog_serp_monitor
--   blog_authoring_tools  -> creates blog_data_assets, needed by blog_content_platform
-- so those three are placed first within this tier.
-- ===========================================================================
\echo '== Tier 2: blog (foundation-only deps) =='
\ir _backfill_blog_authors.sql
\ir _backfill_blog_serp_snapshots.sql
\ir _backfill_blog_authoring_tools.sql
\ir _backfill_blog_ai_costs.sql
\ir _backfill_blog_jobs.sql
\ir _backfill_blog_pipeline.sql
\ir _backfill_blog_platform_api.sql
\ir _backfill_blog_competitor_gap.sql
\ir _backfill_blog_assets_bucket.sql
\ir _backfill_blog_experiments.sql
\ir _backfill_blog_outline_variants.sql
\ir _backfill_blog_post_variants.sql
\ir _backfill_blog_qa_reports.sql
\ir _backfill_blog_rank_forecasts.sql
\ir _backfill_blog_syndication.sql
\ir _backfill_blog_topic_intel.sql
\ir _backfill_blog_distribution_engine.sql
\ir _backfill_blog_analytics_intel.sql
-- ALTER-only blog scripts (alter foundation tables blog_posts/blog_keywords/blog_agent_settings):
\ir _backfill_blog_critique_loop.sql
\ir _backfill_blog_keywords_paa.sql
\ir _backfill_blog_schema_markup.sql
\ir _backfill_blog_posts_calendar.sql

-- ===========================================================================
-- Tier 3 — depend on a Tier 2 script (these are the ones that broke before).
-- ===========================================================================
\echo '== Tier 3: blog (cross-script deps) =='
\ir _backfill_blog_outreach.sql          -- needs blog_authors
\ir _backfill_blog_serp_monitor.sql      -- needs blog_serp_snapshots
\ir _backfill_blog_content_platform.sql  -- needs blog_data_assets (from authoring_tools)

\echo '== All backfills applied =='
