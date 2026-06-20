/**
 * Blog Topic Intelligence Schema — community mining, pillar-cluster modelling,
 * internal-link discovery, topical-authority scoring, source aggregation, and
 * readability/persona targeting (US-BLOG-017, 019, 020, 022, 025, 026).
 *
 * REUSES existing blog tables — does NOT recreate them:
 *   - blog_posts                 (source/target of internal links, readability)
 *   - blog_keywords              (cluster membership, embeddings)
 *   - blog_keyword_clusters      (pillar-cluster model is layered ON TOP via
 *                                 blog_cluster_extensions, keeping the existing
 *                                 cluster table untouched)
 *   - blog_briefs                (persona description source for US-BLOG-026)
 *   - blog_citations             (citation rows — extended here with
 *                                 blog_citation_sources for OG image/excerpt/order)
 *   - blog_performance_metrics   (impressions/position feed the authority score)
 *
 * NEW tables defined here:
 *   - blog_community_questions     (017) mined forum/community questions
 *   - blog_community_seeds         (017) per-workspace seed config (subreddits, etc.)
 *   - blog_cluster_extensions      (019) pillar-cluster overlay + supporting-keyword plan
 *   - blog_keyword_embeddings      (019) embedding vectors for keyword text+intent
 *   - blog_post_embeddings         (020) embedding vectors for full post bodies
 *   - blog_internal_link_suggestions (020) source->target link candidates + anchor text
 *   - blog_cluster_authority_scores  (022) per-cluster authority score time series
 *   - blog_citation_sources        (025) OG/excerpt/order overlay keyed to blog_citations
 *   - blog_readability_snapshots   (026) latest readability + persona snapshot per post
 *
 * FK references are enforced ONLY in drizzle/migrations/_backfill_blog_topic_intel.sql
 * (matching the blog-syndication convention: uuid + notNull here, REFERENCES in SQL).
 *
 * Embeddings are stored as jsonb arrays of floats (cosine similarity computed in
 * the edge function). NOTE: when pgvector is enabled these `embedding` columns
 * should migrate to a `vector(N)` column with an ivfflat/hnsw index — see the
 * matching TODOs in the backfill migration.
 *
 * Re-exported from shared/schema.ts via `export * from './blog-topic-intel-schema'`.
 */

import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Shared enum-ish constants (validated in the edge fn via Zod, not pg enums)
// ---------------------------------------------------------------------------
export const COMMUNITY_SOURCES = ['reddit', 'quora', 'stackexchange'] as const;
export type CommunitySource = (typeof COMMUNITY_SOURCES)[number];

export const CLUSTER_LIFECYCLE_STATUSES = [
  'planned',
  'in_progress',
  'published',
  'decaying',
] as const;
export type ClusterLifecycleStatus = (typeof CLUSTER_LIFECYCLE_STATUSES)[number];

export const INTERNAL_LINK_STATUSES = ['suggested', 'accepted', 'dismissed', 'applied'] as const;
export type InternalLinkStatus = (typeof INTERNAL_LINK_STATUSES)[number];

// ---------------------------------------------------------------------------
// blog_community_seeds — per-workspace seed config for the question miner (017)
// ---------------------------------------------------------------------------
// One row per workspace (tenant). Holds the configurable seed list the miner
// runs against: subreddits, Quora topics, and Stack Exchange sites. Stored as a
// single settings row rather than per-target rows so the whole config edits
// atomically from the settings panel.
export const blogCommunitySeeds = pgTable(
  'blog_community_seeds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** { subreddits: string[], quora_topics: string[], stackexchange_sites: string[] } */
    subreddits: jsonb('subreddits'),
    quoraTopics: jsonb('quora_topics'),
    stackexchangeSites: jsonb('stackexchange_sites'),
    /** Adapter/target config: API handles, default sort, result caps, etc. */
    targetConfig: jsonb('target_config'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_community_seeds_tenant_idx').on(table.tenantId),
  }),
);

export type BlogCommunitySeed = typeof blogCommunitySeeds.$inferSelect;
export type NewBlogCommunitySeed = typeof blogCommunitySeeds.$inferInsert;

// ---------------------------------------------------------------------------
// blog_community_questions — mined forum/community questions (017)
// ---------------------------------------------------------------------------
// Each question scraped from Reddit / Quora / Stack Exchange lands as a row,
// carrying the source, url, title, score/upvotes, capture time, top answer/
// comment snippet, and the LLM-assigned theme/cluster label.
export const blogCommunityQuestions = pgTable(
  'blog_community_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    source: varchar('source', { length: 20 }).notNull(), // reddit | quora | stackexchange
    /** Where it came from, e.g. subreddit name, quora topic, SE site. */
    sourceContext: varchar('source_context', { length: 255 }),
    url: text('url'),
    title: text('title').notNull(),
    score: integer('score'), // upvotes / votes
    /** Top comment (Reddit) / top answer snippet (Quora, SE). */
    topAnswerSnippet: text('top_answer_snippet'),
    /** LLM-assigned theme label (free text) — surfaced to the brief generator. */
    theme: varchar('theme', { length: 255 }),
    /** Optional FK to an existing keyword cluster, enforced in the migration. */
    clusterId: uuid('cluster_id'),
    capturedAt: timestamp('captured_at').notNull().defaultNow(),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_community_questions_tenant_idx').on(table.tenantId),
    tenantThemeIdx: index('blog_community_questions_tenant_theme_idx').on(
      table.tenantId,
      table.theme,
    ),
    tenantSourceIdx: index('blog_community_questions_tenant_source_idx').on(
      table.tenantId,
      table.source,
    ),
  }),
);

export type BlogCommunityQuestion = typeof blogCommunityQuestions.$inferSelect;
export type NewBlogCommunityQuestion = typeof blogCommunityQuestions.$inferInsert;

// ---------------------------------------------------------------------------
// blog_cluster_extensions — pillar-cluster overlay on blog_keyword_clusters (019)
// ---------------------------------------------------------------------------
// Layers the pillar-cluster model ON TOP of the existing blog_keyword_clusters
// table without modifying it. One row per cluster. Holds the LLM-named pillar
// keyword, supporting keywords + per-keyword suggested post type, and the
// cluster lifecycle status used by the topical authority heatmap.
export const blogClusterExtensions = pgTable(
  'blog_cluster_extensions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK to blog_keyword_clusters.id — enforced in the migration. */
    clusterId: uuid('cluster_id').notNull(),
    /** LLM-generated cluster name (may mirror blog_keyword_clusters.name). */
    name: varchar('name', { length: 200 }),
    pillarKeyword: varchar('pillar_keyword', { length: 500 }),
    /** [{ keyword, suggested_post_type }] — supporting keywords + post-type plan. */
    supportingKeywords: jsonb('supporting_keywords'),
    status: varchar('status', { length: 16 }).notNull().default('planned'), // planned | in_progress | published | decaying
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_cluster_extensions_tenant_idx').on(table.tenantId),
    tenantClusterIdx: index('blog_cluster_extensions_tenant_cluster_idx').on(
      table.tenantId,
      table.clusterId,
    ),
  }),
);

export type BlogClusterExtension = typeof blogClusterExtensions.$inferSelect;
export type NewBlogClusterExtension = typeof blogClusterExtensions.$inferInsert;

// ---------------------------------------------------------------------------
// blog_keyword_embeddings — embedding vectors for keyword text+intent (019)
// ---------------------------------------------------------------------------
// Feeds embedding-based keyword clustering and the cluster visualizer edges
// (similarity). One row per keyword.
//
// TODO(pgvector): when pgvector is enabled, replace `embedding jsonb` with a
// `vector(N)` column + ivfflat index and compute similarity in-DB.
export const blogKeywordEmbeddings = pgTable(
  'blog_keyword_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK to blog_keywords.id — enforced in the migration. */
    keywordId: uuid('keyword_id').notNull(),
    /** Adapter that produced the vector (stubbed): e.g. 'openai-text-3-small'. */
    embeddingModel: varchar('embedding_model', { length: 64 }),
    /** Float array stored as jsonb until pgvector lands. */
    embedding: jsonb('embedding'),
    dims: integer('dims'),
    /** The exact text embedded (keyword + intent), kept for re-embed dedupe. */
    sourceText: text('source_text'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_keyword_embeddings_tenant_idx').on(table.tenantId),
    tenantKeywordIdx: index('blog_keyword_embeddings_tenant_keyword_idx').on(
      table.tenantId,
      table.keywordId,
    ),
  }),
);

export type BlogKeywordEmbedding = typeof blogKeywordEmbeddings.$inferSelect;
export type NewBlogKeywordEmbedding = typeof blogKeywordEmbeddings.$inferInsert;

// ---------------------------------------------------------------------------
// blog_post_embeddings — embedding vectors for full post bodies (020)
// ---------------------------------------------------------------------------
// On post create/update the body is embedded and stored here; internal-link
// candidates are the top-N posts by cosine similarity within the workspace.
//
// TODO(pgvector): migrate `embedding jsonb` -> `vector(N)` + hnsw index.
export const blogPostEmbeddings = pgTable(
  'blog_post_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK to blog_posts.id — enforced in the migration. */
    postId: uuid('post_id').notNull(),
    embeddingModel: varchar('embedding_model', { length: 64 }),
    embedding: jsonb('embedding'),
    dims: integer('dims'),
    /** Primary keyword of the post — used to pick anchor phrases for links. */
    primaryKeyword: varchar('primary_keyword', { length: 500 }),
    /** Hash of the embedded body so we skip re-embedding unchanged content. */
    contentHash: varchar('content_hash', { length: 128 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_post_embeddings_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_post_embeddings_tenant_post_idx').on(table.tenantId, table.postId),
  }),
);

export type BlogPostEmbedding = typeof blogPostEmbeddings.$inferSelect;
export type NewBlogPostEmbedding = typeof blogPostEmbeddings.$inferInsert;

// ---------------------------------------------------------------------------
// blog_internal_link_suggestions — source->target link candidates (020)
// ---------------------------------------------------------------------------
// Suggestions are never auto-applied — they surface in the editor panel and the
// "backfill links" PR-style review. status tracks the human decision.
export const blogInternalLinkSuggestions = pgTable(
  'blog_internal_link_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK to blog_posts.id (the post that would link OUT). */
    sourcePostId: uuid('source_post_id').notNull(),
    /** FK to blog_posts.id (the post that would be linked TO). */
    targetPostId: uuid('target_post_id').notNull(),
    /** LLM-suggested anchor phrase (matches the target's primary keyword). */
    anchorText: text('anchor_text'),
    similarity: numeric('similarity', { precision: 6, scale: 5 }), // cosine 0..1
    /** Insert metadata for the editor: { section, sentence, char_offset, snippet }. */
    insertMeta: jsonb('insert_meta'),
    status: varchar('status', { length: 16 }).notNull().default('suggested'), // suggested | accepted | dismissed | applied
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_internal_link_suggestions_tenant_idx').on(table.tenantId),
    tenantSourceIdx: index('blog_internal_link_suggestions_tenant_source_idx').on(
      table.tenantId,
      table.sourcePostId,
    ),
    tenantTargetIdx: index('blog_internal_link_suggestions_tenant_target_idx').on(
      table.tenantId,
      table.targetPostId,
    ),
  }),
);

export type BlogInternalLinkSuggestion = typeof blogInternalLinkSuggestions.$inferSelect;
export type NewBlogInternalLinkSuggestion = typeof blogInternalLinkSuggestions.$inferInsert;

// ---------------------------------------------------------------------------
// blog_cluster_authority_scores — per-cluster authority time series (022)
// ---------------------------------------------------------------------------
// One row per (cluster, computed_at). Recomputed daily; retained for a 90-day
// trend. Score is normalised 0-100 with the component breakdown stored for the
// detail view and heatmap.
export const blogClusterAuthorityScores = pgTable(
  'blog_cluster_authority_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK to blog_keyword_clusters.id — enforced in the migration. */
    clusterId: uuid('cluster_id').notNull(),
    score: numeric('score', { precision: 5, scale: 2 }).notNull(), // 0-100 normalised
    /**
     * Component breakdown:
     * { pct_top10, pct_with_content, avg_rank, total_impressions, keyword_count }.
     */
    breakdown: jsonb('breakdown'),
    computedAt: timestamp('computed_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_cluster_authority_scores_tenant_idx').on(table.tenantId),
    tenantClusterComputedIdx: index('blog_cluster_authority_scores_tenant_cluster_computed_idx').on(
      table.tenantId,
      table.clusterId,
      table.computedAt,
    ),
  }),
);

export type BlogClusterAuthorityScore = typeof blogClusterAuthorityScores.$inferSelect;
export type NewBlogClusterAuthorityScore = typeof blogClusterAuthorityScores.$inferInsert;

// ---------------------------------------------------------------------------
// blog_citation_sources — OG/excerpt/order overlay for blog_citations (025)
// ---------------------------------------------------------------------------
// blog_citations already stores url/title/author/publication/publish_date/
// inline_position. The source aggregator's fetcher adds OG image, excerpt, and
// an explicit display order without touching the existing table — one
// extension row per citation.
export const blogCitationSources = pgTable(
  'blog_citation_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK to blog_citations.id — enforced in the migration. */
    citationId: uuid('citation_id').notNull(),
    /** Denormalised FK to blog_posts.id for cheap per-post listing. */
    postId: uuid('post_id').notNull(),
    ogImageUrl: text('og_image_url'),
    excerpt: text('excerpt'),
    /** Explicit display order in the references section (reorder endpoint). */
    displayOrder: integer('display_order'),
    /** Adapter that fetched the metadata (stubbed): e.g. 'opengraph-fetch'. */
    fetchAdapter: varchar('fetch_adapter', { length: 64 }),
    fetchedAt: timestamp('fetched_at'),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_citation_sources_tenant_idx').on(table.tenantId),
    tenantCitationIdx: index('blog_citation_sources_tenant_citation_idx').on(
      table.tenantId,
      table.citationId,
    ),
    tenantPostIdx: index('blog_citation_sources_tenant_post_idx').on(table.tenantId, table.postId),
  }),
);

export type BlogCitationSource = typeof blogCitationSources.$inferSelect;
export type NewBlogCitationSource = typeof blogCitationSources.$inferInsert;

// ---------------------------------------------------------------------------
// blog_readability_snapshots — latest readability + persona snapshot (026)
// ---------------------------------------------------------------------------
// Readability analysis is otherwise stateless; this table persists the most
// recent snapshot per post so the pre-publish gate and dashboards have a value
// without re-running the analysis.
export const blogReadabilitySnapshots = pgTable(
  'blog_readability_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK to blog_posts.id — enforced in the migration. */
    postId: uuid('post_id').notNull(),
    fleschKincaidGrade: numeric('flesch_kincaid_grade', { precision: 5, scale: 2 }),
    targetGrade: numeric('target_grade', { precision: 5, scale: 2 }),
    personaMatchScore: integer('persona_match_score'), // 0-100
    /** { sentences: [{ text, grade, tier }], gate: { pass, warnings[] } }. */
    analysis: jsonb('analysis'),
    computedAt: timestamp('computed_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_readability_snapshots_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_readability_snapshots_tenant_post_idx').on(
      table.tenantId,
      table.postId,
    ),
  }),
);

export type BlogReadabilitySnapshot = typeof blogReadabilitySnapshots.$inferSelect;
export type NewBlogReadabilitySnapshot = typeof blogReadabilitySnapshots.$inferInsert;
