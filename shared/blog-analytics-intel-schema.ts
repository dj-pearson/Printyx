/**
 * Blog Analytics & Answer-Engine Intelligence Schema (US-BLOG-061, 065, 067, 068, 069).
 *
 * This file backs the "answer-engine / analytics intel" cluster of the Universal
 * Blog System. It deliberately REUSES existing blog tables wherever per-post,
 * per-cluster, or per-keyword data already has a home:
 *   - Per-post GA4 / Search Console daily metrics  → blog_performance_metrics
 *     (existing; this module upserts ga4 / search_console rows there, see the
 *     edge fn). No new per-post-metric table is created.
 *   - Topic groups / clusters                       → blog_keyword_clusters (existing)
 *   - Keywords (PAA, intent, cluster membership)     → blog_keywords (existing)
 *   - Posts                                          → blog_posts (existing)
 *
 * NEW tables introduced here (FKs declared ONLY in the backfill migration, per
 * the blog module convention — keep them out of the Drizzle column defs so the
 * generated DDL and the hand-run migration don't fight over constraint names):
 *   - blog_analytics_connections  (US-BLOG-061) per-workspace GA4 / GSC OAuth links
 *   - blog_conversion_config      (US-BLOG-065) conversion event + attribution model
 *   - blog_cohort_metrics         (US-BLOG-065) cluster → sessions → conversions → revenue
 *   - blog_llm_citations          (US-BLOG-067) LLM citation-graph probe results
 *   - blog_aeo_scores             (US-BLOG-068) answer-engine optimization scores
 *   - blog_kg_entities            (US-BLOG-069) NER entities from published posts
 *   - blog_kg_edges               (US-BLOG-069) entity co-occurrence graph edges
 *
 * Conventions match shared/blog-schema.ts:
 *   - tenant_id varchar NOT NULL + index on every table
 *   - created_by_user_id varchar
 *   - Soft-delete via deleted_at on user-facing config tables
 *   - JSONB for flexible bags (encrypted_config, breakdown, raw payloads)
 *   - Encrypted third-party credentials live in encrypted_config jsonb; the API
 *     never returns them (returns *_set booleans instead).
 *
 * Re-exported from shared/schema.ts via `export * from './blog-analytics-intel-schema'`.
 * NOTE: this re-export is NOT added here — see deployment notes; importers can
 * pull directly from this module.
 */

import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums-as-string-arrays (validated in the edge fn via Zod; no pg enums so new
// providers / models / attribution modes ship without a migration).
// ---------------------------------------------------------------------------

/** Analytics providers we connect per workspace (US-BLOG-061). */
export const ANALYTICS_PROVIDERS = ['ga4', 'search_console'] as const;
export type AnalyticsProvider = (typeof ANALYTICS_PROVIDERS)[number];

/** Conversion event kinds (US-BLOG-065). */
export const CONVERSION_KINDS = ['signup', 'purchase', 'demo_request'] as const;
export type ConversionKind = (typeof CONVERSION_KINDS)[number];

/** Attribution models for cohort revenue/signup attribution (US-BLOG-065). */
export const ATTRIBUTION_MODELS = ['last_non_direct', 'first_touch', 'linear'] as const;
export type AttributionModel = (typeof ATTRIBUTION_MODELS)[number];

/** Answer-engine probe engines (US-BLOG-067). */
export const LLM_ENGINES = ['chatgpt_search', 'perplexity', 'google_ai_overview'] as const;
export type LlmEngine = (typeof LLM_ENGINES)[number];

/** Knowledge-graph entity types (US-BLOG-069). */
export const KG_ENTITY_TYPES = [
  'person',
  'organization',
  'product',
  'concept',
  'location',
  'date',
] as const;
export type KgEntityType = (typeof KG_ENTITY_TYPES)[number];

// ---------------------------------------------------------------------------
// blog_analytics_connections — per-workspace GA4 / Search Console OAuth links
// (US-BLOG-061). Tokens are stored encrypted in encrypted_config jsonb and are
// NEVER returned by the API; the API exposes connected / tokens_set booleans.
// ---------------------------------------------------------------------------
export const blogAnalyticsConnections = pgTable(
  'blog_analytics_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** 'ga4' | 'search_console'. */
    provider: varchar('provider', { length: 32 }).notNull(),
    /** GA4 property id (e.g. "properties/123456789") or GSC site URL. */
    propertyId: varchar('property_id', { length: 400 }),
    /** Human label shown in the connect UI. */
    propertyLabel: varchar('property_label', { length: 400 }),
    connected: boolean('connected').notNull().default(false),
    /**
     * Encrypted OAuth/connection credentials envelope:
     *   { access_token: EncryptedCredential, refresh_token: EncryptedCredential, ... }
     * Each value is the AES-256-GCM envelope from _shared/credential-vault.ts.
     * NEVER returned to clients — the API returns tokens_set booleans instead.
     */
    encryptedConfig: jsonb('encrypted_config'),
    /** When the most recent backfill (16mo GSC / 90d GA4) was last run. */
    lastBackfillAt: timestamp('last_backfill_at'),
    /** When metrics were last synced from the provider. */
    lastSyncedAt: timestamp('last_synced_at'),
    /** Free-form provider metadata: scopes[], account ids, sync cursors. */
    metadata: jsonb('metadata'),
    status: varchar('status', { length: 20 }).notNull().default('disconnected'), // disconnected | connected | error
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_analytics_connections_tenant_idx').on(table.tenantId),
    tenantProviderIdx: index('blog_analytics_connections_tenant_provider_idx').on(
      table.tenantId,
      table.provider,
    ),
  }),
);

export type BlogAnalyticsConnection = typeof blogAnalyticsConnections.$inferSelect;
export type NewBlogAnalyticsConnection = typeof blogAnalyticsConnections.$inferInsert;

// ---------------------------------------------------------------------------
// blog_conversion_config — per-workspace conversion + attribution settings
// (US-BLOG-065). One active config per tenant (uniqueness enforced in the edge
// fn by clearing other defaults, matching the blog default-row pattern).
// ---------------------------------------------------------------------------
export const blogConversionConfig = pgTable(
  'blog_conversion_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** 'signup' | 'purchase' | 'demo_request'. */
    conversionKind: varchar('conversion_kind', { length: 32 }).notNull(),
    /** The GA4 conversion event name that maps to conversionKind, e.g. "sign_up". */
    ga4EventName: varchar('ga4_event_name', { length: 200 }),
    /** 'last_non_direct' (default) | 'first_touch' | 'linear'. */
    attributionModel: varchar('attribution_model', { length: 32 })
      .notNull()
      .default('last_non_direct'),
    /** For 'purchase' kinds: whether revenue (cents) comes from the GA4 event value. */
    revenueFromEventValue: boolean('revenue_from_event_value').notNull().default(true),
    /** Fixed revenue per conversion (cents) when revenueFromEventValue is false. */
    revenuePerConversionCents: integer('revenue_per_conversion_cents'),
    /** Default cost inputs for ROI (cents): writing + tooling per post/cluster. */
    writingCostPerPostCents: integer('writing_cost_per_post_cents'),
    toolsCostPerMonthCents: integer('tools_cost_per_month_cents'),
    isDefault: boolean('is_default').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_conversion_config_tenant_idx').on(table.tenantId),
    tenantDefaultIdx: index('blog_conversion_config_tenant_default_idx').on(
      table.tenantId,
      table.isDefault,
    ),
  }),
);

export type BlogConversionConfig = typeof blogConversionConfig.$inferSelect;
export type NewBlogConversionConfig = typeof blogConversionConfig.$inferInsert;

// ---------------------------------------------------------------------------
// blog_cohort_metrics — cluster cohort rollup (US-BLOG-065).
// One row per (cluster, period, attribution_model) computation: sessions →
// conversions → revenue, plus the time-to-conversion histogram and ROI inputs.
// ---------------------------------------------------------------------------
export const blogCohortMetrics = pgTable(
  'blog_cohort_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK → blog_keyword_clusters.id (enforced in migration). */
    clusterId: uuid('cluster_id').notNull(),
    /** Period label: '28d' | '90d' | 'all_time' | 'YYYY-MM' etc. */
    period: varchar('period', { length: 32 }).notNull(),
    sessions: integer('sessions').notNull().default(0),
    conversions: integer('conversions').notNull().default(0),
    /** Attributed revenue in cents (0 for signup-count conversions). */
    revenueCents: integer('revenue_cents').notNull().default(0),
    /** Signup count when conversionKind is signup/demo_request (mirror of conversions). */
    signupCount: integer('signup_count').notNull().default(0),
    /** 'last_non_direct' | 'first_touch' | 'linear'. */
    attributionModel: varchar('attribution_model', { length: 32 }).notNull(),
    /** Time-to-conversion histogram: { buckets: [{ label, days_min, days_max, count }] }. */
    timeToConversionHistogram: jsonb('time_to_conversion_histogram'),
    /** ROI inputs/outputs: { cost_cents, revenue_cents, roi_ratio }. */
    roi: jsonb('roi'),
    computedAt: timestamp('computed_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_cohort_metrics_tenant_idx').on(table.tenantId),
    tenantClusterIdx: index('blog_cohort_metrics_tenant_cluster_idx').on(
      table.tenantId,
      table.clusterId,
    ),
    tenantPeriodIdx: index('blog_cohort_metrics_tenant_period_idx').on(
      table.tenantId,
      table.period,
    ),
  }),
);

export type BlogCohortMetric = typeof blogCohortMetrics.$inferSelect;
export type NewBlogCohortMetric = typeof blogCohortMetrics.$inferInsert;

// ---------------------------------------------------------------------------
// blog_llm_citations — LLM citation-graph probe results (US-BLOG-067).
// One row per (cluster, engine, query, cited_url) captured by a weekly probe.
// is_own_domain drives the "share of voice" dashboard; post_id links a citation
// back to a specific post when the cited_url resolves to one.
// ---------------------------------------------------------------------------
export const blogLlmCitations = pgTable(
  'blog_llm_citations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK → blog_keyword_clusters.id (enforced in migration). */
    clusterId: uuid('cluster_id'),
    /** FK → blog_posts.id when the cited URL maps to one of our posts. */
    postId: uuid('post_id'),
    /** 'chatgpt_search' | 'perplexity' | 'google_ai_overview'. */
    engine: varchar('engine', { length: 40 }).notNull(),
    /** The probe query (usually a tracked keyword / cluster pillar). */
    query: varchar('query', { length: 1000 }).notNull(),
    citedUrl: varchar('cited_url', { length: 2000 }).notNull(),
    citedDomain: varchar('cited_domain', { length: 400 }),
    isOwnDomain: boolean('is_own_domain').notNull().default(false),
    /** Position/rank of the citation within the answer, when available. */
    rank: integer('rank'),
    /** Whether we also appear in classic SERP top-10 for this query (diff view). */
    inSerpTop10: boolean('in_serp_top10'),
    /** Raw probe payload for audit / re-parsing. */
    rawData: jsonb('raw_data'),
    capturedAt: timestamp('captured_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_llm_citations_tenant_idx').on(table.tenantId),
    tenantClusterIdx: index('blog_llm_citations_tenant_cluster_idx').on(
      table.tenantId,
      table.clusterId,
    ),
    tenantEngineIdx: index('blog_llm_citations_tenant_engine_idx').on(table.tenantId, table.engine),
    postIdx: index('blog_llm_citations_post_idx').on(table.postId),
  }),
);

export type BlogLlmCitation = typeof blogLlmCitations.$inferSelect;
export type NewBlogLlmCitation = typeof blogLlmCitations.$inferInsert;

// ---------------------------------------------------------------------------
// blog_aeo_scores — Answer-Engine Optimization scores (US-BLOG-068).
// One row per (post, check run). breakdown holds per-check results; the
// generated Quick-answers section + Schema.org JSON-LD are returned by the
// endpoint and (optionally) persisted alongside the score.
// ---------------------------------------------------------------------------
export const blogAeoScores = pgTable(
  'blog_aeo_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK → blog_posts.id (enforced in migration). */
    postId: uuid('post_id').notNull(),
    /** Overall 0-100 AEO score (sits alongside the SEO score in the UI). */
    score: numeric('score', { precision: 5, scale: 2 }).notNull(),
    /**
     * Per-check breakdown:
     *   { self_contained_paragraphs, question_shaped_h3s, explicit_definitions,
     *     factual_statements_dated, original_data_callouts } each
     *     { passed: boolean, score: number, notes: string }.
     */
    breakdown: jsonb('breakdown'),
    /** LLM rewrite suggestions for vague paragraphs: [{ original, rewrite, reason }]. */
    suggestions: jsonb('suggestions'),
    /** Generated 'Quick answers' section: { items: [{ question, answer }] }. */
    quickAnswers: jsonb('quick_answers'),
    /** Generated Schema.org QAPage/FAQPage JSON-LD blocks. */
    jsonLd: jsonb('json_ld'),
    checkedAt: timestamp('checked_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_aeo_scores_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_aeo_scores_tenant_post_idx').on(table.tenantId, table.postId),
  }),
);

export type BlogAeoScore = typeof blogAeoScores.$inferSelect;
export type NewBlogAeoScore = typeof blogAeoScores.$inferInsert;

// ---------------------------------------------------------------------------
// blog_kg_entities — domain knowledge-graph entities (US-BLOG-069).
// One row per (tenant, normalized entity name + type). Frequency, first/last
// seen, and related posts accumulate as published posts are NER-processed.
// ---------------------------------------------------------------------------
export const blogKgEntities = pgTable(
  'blog_kg_entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Display name as extracted. */
    name: varchar('name', { length: 500 }).notNull(),
    /** Lowercased/trimmed key used for dedup within a tenant+type. */
    normalizedName: varchar('normalized_name', { length: 500 }).notNull(),
    /** 'person'|'organization'|'product'|'concept'|'location'|'date'. */
    entityType: varchar('entity_type', { length: 32 }).notNull(),
    /** Total mention count across all posts. */
    frequency: integer('frequency').notNull().default(0),
    firstSeenAt: timestamp('first_seen_at'),
    lastSeenAt: timestamp('last_seen_at'),
    /** Post ids mentioning this entity: string[] of blog_posts.id. */
    relatedPostIds: jsonb('related_post_ids'),
    /** True for entities seeded from competitor coverage (gap detector input). */
    isCompetitorOnly: boolean('is_competitor_only').notNull().default(false),
    /** For graph coloring: a cluster/community label assigned by the visualizer. */
    clusterLabel: varchar('cluster_label', { length: 200 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_kg_entities_tenant_idx').on(table.tenantId),
    tenantTypeIdx: index('blog_kg_entities_tenant_type_idx').on(table.tenantId, table.entityType),
    tenantNormIdx: index('blog_kg_entities_tenant_norm_idx').on(
      table.tenantId,
      table.normalizedName,
    ),
  }),
);

export type BlogKgEntity = typeof blogKgEntities.$inferSelect;
export type NewBlogKgEntity = typeof blogKgEntities.$inferInsert;

// ---------------------------------------------------------------------------
// blog_kg_edges — entity co-occurrence edges (US-BLOG-069).
// Undirected edge between two entities; weight = co-mention frequency. We store
// a canonical orientation (source <= target by id) so each pair has one row.
// ---------------------------------------------------------------------------
export const blogKgEdges = pgTable(
  'blog_kg_edges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK → blog_kg_entities.id (enforced in migration). */
    sourceEntityId: uuid('source_entity_id').notNull(),
    /** FK → blog_kg_entities.id (enforced in migration). */
    targetEntityId: uuid('target_entity_id').notNull(),
    /** Co-mention frequency across posts. */
    weight: integer('weight').notNull().default(1),
    /** Post ids where the pair co-occurs. */
    coPostIds: jsonb('co_post_ids'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_kg_edges_tenant_idx').on(table.tenantId),
    tenantSourceIdx: index('blog_kg_edges_tenant_source_idx').on(
      table.tenantId,
      table.sourceEntityId,
    ),
    tenantPairIdx: index('blog_kg_edges_tenant_pair_idx').on(
      table.tenantId,
      table.sourceEntityId,
      table.targetEntityId,
    ),
  }),
);

export type BlogKgEdge = typeof blogKgEdges.$inferSelect;
export type NewBlogKgEdge = typeof blogKgEdges.$inferInsert;
