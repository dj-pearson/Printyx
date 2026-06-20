-- US-BLOG-061, 065, 067, 068, 069: Blog Analytics & Answer-Engine Intelligence.
--   061  GA4 + Search Console integration         → blog_analytics_connections
--   065  Cohort analysis: topic → revenue/signups → blog_conversion_config, blog_cohort_metrics
--   067  LLM citation graph analyzer              → blog_llm_citations
--   068  Answer-Engine Optimization (AEO)         → blog_aeo_scores
--   069  Domain knowledge graph                   → blog_kg_entities, blog_kg_edges
--
-- Per-post GA4/GSC daily metrics are written into the EXISTING
-- blog_performance_metrics table (source='ga4' | 'search_console'); no new
-- per-post-metric table is created here.
--
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_blog_analytics_intel.sql

-- ---------------------------------------------------------------------------
-- US-BLOG-061: per-workspace GA4 / Search Console OAuth connections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_analytics_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"provider" varchar(32) NOT NULL,
	"property_id" varchar(400),
	"property_label" varchar(400),
	"connected" boolean NOT NULL DEFAULT false,
	"encrypted_config" jsonb,
	"last_backfill_at" timestamp,
	"last_synced_at" timestamp,
	"metadata" jsonb,
	"status" varchar(20) NOT NULL DEFAULT 'disconnected',
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_analytics_connections_tenant_idx"
	ON "blog_analytics_connections" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_analytics_connections_tenant_provider_idx"
	ON "blog_analytics_connections" USING btree ("tenant_id","provider");

-- ---------------------------------------------------------------------------
-- US-BLOG-065: conversion + attribution config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_conversion_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"conversion_kind" varchar(32) NOT NULL,
	"ga4_event_name" varchar(200),
	"attribution_model" varchar(32) NOT NULL DEFAULT 'last_non_direct',
	"revenue_from_event_value" boolean NOT NULL DEFAULT true,
	"revenue_per_conversion_cents" integer,
	"writing_cost_per_post_cents" integer,
	"tools_cost_per_month_cents" integer,
	"is_default" boolean NOT NULL DEFAULT true,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_conversion_config_tenant_idx"
	ON "blog_conversion_config" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_conversion_config_tenant_default_idx"
	ON "blog_conversion_config" USING btree ("tenant_id","is_default");

-- ---------------------------------------------------------------------------
-- US-BLOG-065: cluster cohort rollup
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_cohort_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cluster_id" uuid NOT NULL REFERENCES "blog_keyword_clusters"("id") ON DELETE CASCADE,
	"period" varchar(32) NOT NULL,
	"sessions" integer NOT NULL DEFAULT 0,
	"conversions" integer NOT NULL DEFAULT 0,
	"revenue_cents" integer NOT NULL DEFAULT 0,
	"signup_count" integer NOT NULL DEFAULT 0,
	"attribution_model" varchar(32) NOT NULL,
	"time_to_conversion_histogram" jsonb,
	"roi" jsonb,
	"computed_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_cohort_metrics_tenant_idx"
	ON "blog_cohort_metrics" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_cohort_metrics_tenant_cluster_idx"
	ON "blog_cohort_metrics" USING btree ("tenant_id","cluster_id");
CREATE INDEX IF NOT EXISTS "blog_cohort_metrics_tenant_period_idx"
	ON "blog_cohort_metrics" USING btree ("tenant_id","period");

-- ---------------------------------------------------------------------------
-- US-BLOG-067: LLM citation-graph probe results
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_llm_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"cluster_id" uuid REFERENCES "blog_keyword_clusters"("id") ON DELETE SET NULL,
	"post_id" uuid REFERENCES "blog_posts"("id") ON DELETE SET NULL,
	"engine" varchar(40) NOT NULL,
	"query" varchar(1000) NOT NULL,
	"cited_url" varchar(2000) NOT NULL,
	"cited_domain" varchar(400),
	"is_own_domain" boolean NOT NULL DEFAULT false,
	"rank" integer,
	"in_serp_top10" boolean,
	"raw_data" jsonb,
	"captured_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_llm_citations_tenant_idx"
	ON "blog_llm_citations" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_llm_citations_tenant_cluster_idx"
	ON "blog_llm_citations" USING btree ("tenant_id","cluster_id");
CREATE INDEX IF NOT EXISTS "blog_llm_citations_tenant_engine_idx"
	ON "blog_llm_citations" USING btree ("tenant_id","engine");
CREATE INDEX IF NOT EXISTS "blog_llm_citations_post_idx"
	ON "blog_llm_citations" USING btree ("post_id");

-- ---------------------------------------------------------------------------
-- US-BLOG-068: Answer-Engine Optimization scores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_aeo_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "blog_posts"("id") ON DELETE CASCADE,
	"score" numeric(5, 2) NOT NULL,
	"breakdown" jsonb,
	"suggestions" jsonb,
	"quick_answers" jsonb,
	"json_ld" jsonb,
	"checked_at" timestamp NOT NULL DEFAULT now(),
	"created_at" timestamp NOT NULL DEFAULT now(),
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_aeo_scores_tenant_idx"
	ON "blog_aeo_scores" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_aeo_scores_tenant_post_idx"
	ON "blog_aeo_scores" USING btree ("tenant_id","post_id");

-- ---------------------------------------------------------------------------
-- US-BLOG-069: domain knowledge-graph entities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_kg_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" varchar(500) NOT NULL,
	"normalized_name" varchar(500) NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"frequency" integer NOT NULL DEFAULT 0,
	"first_seen_at" timestamp,
	"last_seen_at" timestamp,
	"related_post_ids" jsonb,
	"is_competitor_only" boolean NOT NULL DEFAULT false,
	"cluster_label" varchar(200),
	"metadata" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now(),
	"deleted_at" timestamp,
	"created_by_user_id" varchar
);

CREATE INDEX IF NOT EXISTS "blog_kg_entities_tenant_idx"
	ON "blog_kg_entities" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_kg_entities_tenant_type_idx"
	ON "blog_kg_entities" USING btree ("tenant_id","entity_type");
CREATE INDEX IF NOT EXISTS "blog_kg_entities_tenant_norm_idx"
	ON "blog_kg_entities" USING btree ("tenant_id","normalized_name");

-- ---------------------------------------------------------------------------
-- US-BLOG-069: entity co-occurrence edges
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "blog_kg_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"source_entity_id" uuid NOT NULL REFERENCES "blog_kg_entities"("id") ON DELETE CASCADE,
	"target_entity_id" uuid NOT NULL REFERENCES "blog_kg_entities"("id") ON DELETE CASCADE,
	"weight" integer NOT NULL DEFAULT 1,
	"co_post_ids" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "blog_kg_edges_tenant_idx"
	ON "blog_kg_edges" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "blog_kg_edges_tenant_source_idx"
	ON "blog_kg_edges" USING btree ("tenant_id","source_entity_id");
CREATE INDEX IF NOT EXISTS "blog_kg_edges_tenant_pair_idx"
	ON "blog_kg_edges" USING btree ("tenant_id","source_entity_id","target_entity_id");
