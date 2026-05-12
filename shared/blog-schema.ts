/**
 * Blog Module Schema — Platform Admin Blog System
 *
 * 14 Drizzle tables for the Universal Blog System integrated into Printyx.
 * Source PRD: blog-system-prd.json (US-BLOG-002 implementation).
 *
 * Conventions:
 *   - tenant_id: varchar to match tenants.id and existing Printyx pattern
 *   - created_by_user_id: varchar to match users.id
 *   - Blog-internal IDs (post_id, brief_id, etc.): uuid (new tables, no legacy)
 *   - Every tenant-scoped table has tenant_id NOT NULL with index
 *   - RLS policies live in drizzle/rls/blog.sql and use apply_tenant_rls()
 *   - JSONB used for flexible metadata bags (raw_data, source_metadata, before/after state)
 *   - Soft-delete via deleted_at on user-facing entities (posts, briefs, assets)
 *   - Hard delete on derived/log tables (revisions, citations, audit log)
 *
 * Re-exported from shared/schema.ts via `export * from './blog-schema'`.
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// blog_brand_voices — tone/voice profiles per tenant (US-BLOG-004)
// ---------------------------------------------------------------------------
export const blogBrandVoices = pgTable(
  'blog_brand_voices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    tone: text('tone'),
    bannedPhrases: text('banned_phrases').array(),
    preferredPhrases: text('preferred_phrases').array(),
    readingLevelTarget: varchar('reading_level_target', { length: 16 }), // grade-6 .. grade-14
    personaDescription: text('persona_description'),
    sampleCorpus: text('sample_corpus'), // up to 10k chars per PRD
    pov: varchar('pov', { length: 16 }), // first | second | third
    voiceAttributes: jsonb('voice_attributes'), // { humor, formality, technicality on 1-5 }
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_brand_voices_tenant_idx').on(table.tenantId),
  }),
);

// ---------------------------------------------------------------------------
// blog_style_guides — prose-level rules (US-BLOG-005)
// ---------------------------------------------------------------------------
export const blogStyleGuides = pgTable(
  'blog_style_guides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    rules: jsonb('rules'), // [{ pattern, severity, message, replacement? }]
    rulePacks: text('rule_packs').array(), // built-in packs enabled: ap, chicago, mla, plain-language, inclusive
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_style_guides_tenant_idx').on(table.tenantId),
  }),
);

// ---------------------------------------------------------------------------
// blog_keyword_clusters — pillar/cluster topic groups (US-BLOG-019)
// ---------------------------------------------------------------------------
export const blogKeywordClusters = pgTable(
  'blog_keyword_clusters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    pillarKeyword: varchar('pillar_keyword', { length: 500 }),
    clusterType: varchar('cluster_type', { length: 16 }), // pillar | supporting
    parentClusterId: uuid('parent_cluster_id'),
    topicalAuthorityScore: numeric('topical_authority_score', { precision: 5, scale: 2 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_keyword_clusters_tenant_idx').on(table.tenantId),
    parentIdx: index('blog_keyword_clusters_parent_idx').on(table.parentClusterId),
  }),
);

// ---------------------------------------------------------------------------
// blog_keywords — individual keywords with metrics (US-BLOG-013, 014)
// ---------------------------------------------------------------------------
export const blogKeywords = pgTable(
  'blog_keywords',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    keyword: varchar('keyword', { length: 500 }).notNull(),
    searchVolume: integer('search_volume'),
    keywordDifficulty: integer('keyword_difficulty'),
    cpc: numeric('cpc', { precision: 10, scale: 2 }),
    intent: varchar('intent', { length: 20 }), // informational | commercial | transactional | navigational | mixed
    clusterId: uuid('cluster_id').references(() => blogKeywordClusters.id, {
      onDelete: 'set null',
    }),
    sourceAdapter: varchar('source_adapter', { length: 32 }), // e.g. 'dataforseo'
    // How this keyword was added (US-BLOG-016): 'manual' | 'paa' | 'autocomplete' | 'related' | 'imported'.
    sourceType: varchar('source_type', { length: 20 }),
    // Self-FK: for PAA chains, the parent is the question that surfaced this one.
    // For autocomplete, parent is the seed keyword. NULL for top-level / manual.
    parentKeywordId: uuid('parent_keyword_id'),
    // For PAA rows, the literal upstream question text (deduped, kept for tree rendering).
    parentQuestion: text('parent_question'),
    // 0 for seeds; 1+ for mined descendants.
    miningDepth: integer('mining_depth'),
    lastRefreshedAt: timestamp('last_refreshed_at'),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_keywords_tenant_idx').on(table.tenantId),
    clusterIdx: index('blog_keywords_tenant_cluster_idx').on(table.tenantId, table.clusterId),
    parentIdx: index('blog_keywords_parent_idx').on(table.parentKeywordId),
    sourceIdx: index('blog_keywords_tenant_source_idx').on(table.tenantId, table.sourceType),
  }),
);

// ---------------------------------------------------------------------------
// blog_briefs — content briefs (US-BLOG-023, 024)
// ---------------------------------------------------------------------------
export const blogBriefs = pgTable(
  'blog_briefs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    targetKeywordId: uuid('target_keyword_id').references(() => blogKeywords.id, {
      onDelete: 'set null',
    }),
    targetAudience: text('target_audience'),
    searchIntent: varchar('search_intent', { length: 20 }),
    recommendedWordCount: integer('recommended_word_count'),
    outline: jsonb('outline'),
    keyTakeaways: text('key_takeaways').array(),
    serpSnapshot: jsonb('serp_snapshot'),
    status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | ready | in_progress | complete | archived
    assignedToUserId: varchar('assigned_to_user_id'),
    dueDate: timestamp('due_date'),
    brandVoiceId: uuid('brand_voice_id').references(() => blogBrandVoices.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_briefs_tenant_idx').on(table.tenantId),
    statusIdx: index('blog_briefs_tenant_status_idx').on(table.tenantId, table.status),
    assignedIdx: index('blog_briefs_assigned_idx').on(table.assignedToUserId),
  }),
);

// ---------------------------------------------------------------------------
// blog_assets — images, quotes, data, expert contacts (US-BLOG-010)
// ---------------------------------------------------------------------------
export const blogAssets = pgTable(
  'blog_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    assetType: varchar('asset_type', { length: 20 }).notNull(), // image | quote | data | expert_contact | file
    title: varchar('title', { length: 500 }),
    description: text('description'),
    storagePath: varchar('storage_path', { length: 1000 }),
    mimeType: varchar('mime_type', { length: 100 }),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    altText: text('alt_text'),
    attribution: text('attribution'),
    expertMetadata: jsonb('expert_metadata'), // for expert_contact type: { name, title, org, contact, expertise }
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_assets_tenant_idx').on(table.tenantId),
    typeIdx: index('blog_assets_tenant_type_idx').on(table.tenantId, table.assetType),
  }),
);

// ---------------------------------------------------------------------------
// blog_posts — main post entity (US-BLOG-008..)
// ---------------------------------------------------------------------------
export const blogPosts = pgTable(
  'blog_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    briefId: uuid('brief_id').references(() => blogBriefs.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 500 }).notNull(),
    slug: varchar('slug', { length: 500 }).notNull(),
    excerpt: text('excerpt'),
    bodyMarkdown: text('body_markdown'),
    bodyHtml: text('body_html'),
    metaTitle: varchar('meta_title', { length: 200 }),
    metaDescription: text('meta_description'),
    canonicalUrl: text('canonical_url'),
    featuredImageAssetId: uuid('featured_image_asset_id').references(() => blogAssets.id, {
      onDelete: 'set null',
    }),
    authorUserId: varchar('author_user_id'),
    status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | in_review | scheduled | published | archived
    publishedAt: timestamp('published_at'),
    scheduledFor: timestamp('scheduled_for'),
    cmsTargetKey: varchar('cms_target_key', { length: 64 }), // references blog_cms_targets indirectly; resolved by app
    cmsPostId: varchar('cms_post_id', { length: 200 }), // external CMS post ID after publish
    cmsPostUrl: text('cms_post_url'), // public URL of published post
    brandVoiceId: uuid('brand_voice_id').references(() => blogBrandVoices.id, {
      onDelete: 'set null',
    }),
    styleGuideId: uuid('style_guide_id').references(() => blogStyleGuides.id, {
      onDelete: 'set null',
    }),
    seoScore: numeric('seo_score', { precision: 5, scale: 2 }),
    lastSeoCheckAt: timestamp('last_seo_check_at'),
    aiAssistanceMeta: jsonb('ai_assistance_meta'), // { steps_used: [], tokens, cost_usd }
    decayScore: numeric('decay_score', { precision: 5, scale: 2 }),
    lastDecayCheckAt: timestamp('last_decay_check_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_posts_tenant_idx').on(table.tenantId),
    statusPublishedIdx: index('blog_posts_tenant_status_published_idx').on(
      table.tenantId,
      table.status,
      table.publishedAt,
    ),
    slugIdx: index('blog_posts_tenant_slug_idx').on(table.tenantId, table.slug),
    briefIdx: index('blog_posts_brief_idx').on(table.briefId),
  }),
);

// ---------------------------------------------------------------------------
// blog_post_revisions — version history (US-BLOG-009)
// ---------------------------------------------------------------------------
export const blogPostRevisions = pgTable(
  'blog_post_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id').notNull(), // denormalized for RLS
    revisionNumber: integer('revision_number').notNull(),
    title: varchar('title', { length: 500 }),
    bodyMarkdown: text('body_markdown'),
    bodyHtml: text('body_html'),
    metaTitle: varchar('meta_title', { length: 200 }),
    metaDescription: text('meta_description'),
    revisionSource: varchar('revision_source', { length: 24 }).notNull(), // manual | ai_draft | ai_rewrite | auto_refresh_agent
    diffSummary: text('diff_summary'),
    changedByUserId: varchar('changed_by_user_id'), // null for agent revisions
    agentRunId: varchar('agent_run_id', { length: 100 }), // null for manual revisions
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index('blog_post_revisions_post_idx').on(table.postId),
    tenantIdx: index('blog_post_revisions_tenant_idx').on(table.tenantId),
    postRevisionIdx: index('blog_post_revisions_post_revision_idx').on(
      table.postId,
      table.revisionNumber,
    ),
  }),
);

// ---------------------------------------------------------------------------
// blog_citations — sources cited in a post (US-BLOG-025, 037)
// ---------------------------------------------------------------------------
export const blogCitations = pgTable(
  'blog_citations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id').notNull(),
    url: text('url').notNull(),
    title: text('title'),
    author: varchar('author', { length: 255 }),
    publication: varchar('publication', { length: 255 }),
    publishDate: date('publish_date'),
    citationText: text('citation_text'),
    inlinePosition: integer('inline_position'),
    verifiedAt: timestamp('verified_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index('blog_citations_post_idx').on(table.postId),
    tenantIdx: index('blog_citations_tenant_idx').on(table.tenantId),
  }),
);

// ---------------------------------------------------------------------------
// blog_distribution_targets — tenant-level platform configs (US-BLOG-006, 043+)
// ---------------------------------------------------------------------------
export const blogDistributionTargets = pgTable(
  'blog_distribution_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    platform: varchar('platform', { length: 32 }).notNull(), // wordpress | ghost | twitter | linkedin | facebook | instagram | tiktok | pinterest | reddit | hn | medium | substack | slack | discord | email_newsletter
    accountHandle: varchar('account_handle', { length: 255 }),
    displayName: varchar('display_name', { length: 255 }),
    encryptedConfig: jsonb('encrypted_config'), // credential blob refs (handled by credential vault)
    isActive: boolean('is_active').notNull().default(true),
    lastHealthCheckAt: timestamp('last_health_check_at'),
    lastHealthCheckOk: boolean('last_health_check_ok'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_distribution_targets_tenant_idx').on(table.tenantId),
    platformIdx: index('blog_distribution_targets_tenant_platform_idx').on(
      table.tenantId,
      table.platform,
    ),
  }),
);

// ---------------------------------------------------------------------------
// blog_distributions — per-platform variants of a post (US-BLOG-043..052)
// ---------------------------------------------------------------------------
export const blogDistributions = pgTable(
  'blog_distributions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id').notNull(),
    targetId: uuid('target_id').references(() => blogDistributionTargets.id, {
      onDelete: 'set null',
    }),
    platform: varchar('platform', { length: 32 }).notNull(),
    variantType: varchar('variant_type', { length: 32 }), // thread | long_form | post | carousel | reel | pin | etc.
    content: text('content'),
    contentJson: jsonb('content_json'), // for structured variants (carousels, threads)
    status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | scheduled | published | failed
    scheduledFor: timestamp('scheduled_for'),
    publishedAt: timestamp('published_at'),
    platformPostId: varchar('platform_post_id', { length: 200 }),
    platformPostUrl: text('platform_post_url'),
    utmParams: jsonb('utm_params'),
    engagementMetrics: jsonb('engagement_metrics'), // likes, shares, clicks (snapshot)
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    postPlatformIdx: index('blog_distributions_post_platform_idx').on(table.postId, table.platform),
    tenantIdx: index('blog_distributions_tenant_idx').on(table.tenantId),
    statusIdx: index('blog_distributions_tenant_status_idx').on(table.tenantId, table.status),
    scheduledIdx: index('blog_distributions_scheduled_idx').on(table.scheduledFor),
  }),
);

// ---------------------------------------------------------------------------
// blog_performance_metrics — analytics over time (US-BLOG-059, 060)
// ---------------------------------------------------------------------------
export const blogPerformanceMetrics = pgTable(
  'blog_performance_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id').notNull(),
    distributionId: uuid('distribution_id').references(() => blogDistributions.id, {
      onDelete: 'set null',
    }),
    metricDate: date('metric_date').notNull(),
    source: varchar('source', { length: 32 }).notNull(), // ga4 | search_console | x | linkedin | etc.
    pageviews: integer('pageviews'),
    uniqueVisitors: integer('unique_visitors'),
    avgTimeOnPageSeconds: integer('avg_time_on_page_seconds'),
    bounceRate: numeric('bounce_rate', { precision: 5, scale: 4 }),
    impressions: integer('impressions'),
    clicks: integer('clicks'),
    ctr: numeric('ctr', { precision: 5, scale: 4 }),
    position: numeric('position', { precision: 6, scale: 2 }),
    conversions: integer('conversions'),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    postDateIdx: index('blog_performance_metrics_post_date_idx').on(table.postId, table.metricDate),
    tenantDateIdx: index('blog_performance_metrics_tenant_date_idx').on(
      table.tenantId,
      table.metricDate,
    ),
    sourceIdx: index('blog_performance_metrics_source_idx').on(table.source),
  }),
);

// ---------------------------------------------------------------------------
// blog_refresh_queue — auto-refresh scheduling (US-BLOG-061, 066)
// ---------------------------------------------------------------------------
export const blogRefreshQueue = pgTable(
  'blog_refresh_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    postId: uuid('post_id')
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 32 }).notNull(), // serp_decay | scheduled | manual | performance_drop
    scheduledAt: timestamp('scheduled_at').notNull().defaultNow(),
    priority: integer('priority').notNull().default(50),
    status: varchar('status', { length: 20 }).notNull().default('queued'), // queued | in_progress | completed | failed | skipped
    agentRunId: varchar('agent_run_id', { length: 100 }),
    resultSummary: text('result_summary'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantScheduledIdx: index('blog_refresh_queue_tenant_scheduled_idx').on(
      table.tenantId,
      table.scheduledAt,
    ),
    statusIdx: index('blog_refresh_queue_tenant_status_idx').on(table.tenantId, table.status),
    postIdx: index('blog_refresh_queue_post_idx').on(table.postId),
  }),
);

// ---------------------------------------------------------------------------
// blog_agent_settings — kill switch + agent-mode flags (US-BLOG-086)
// One row per tenant; auto-created with defaults on first read.
// ---------------------------------------------------------------------------
export const blogAgentSettings = pgTable(
  'blog_agent_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull().unique(), // exactly one row per tenant
    agentsPaused: boolean('agents_paused').notNull().default(false),
    pausedAt: timestamp('paused_at'),
    pausedByUserId: varchar('paused_by_user_id'),
    pausedReason: text('paused_reason'),
    autoRefreshRequiresReview: boolean('auto_refresh_requires_review').notNull().default(false),
    // Per-tenant blog_post_revisions retention. Default 90 days per US-BLOG-009 AC.
    // Enforced by POST /blog-post-revisions/cleanup (cron-friendly).
    revisionRetentionDays: integer('revision_retention_days').notNull().default(90),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_agent_settings_tenant_idx').on(table.tenantId),
  }),
);

// ---------------------------------------------------------------------------
// blog_jobs — background job queue with retries + observability (US-BLOG-012)
// ---------------------------------------------------------------------------
// Postgres-backed job queue. Claim/complete/fail go through edge function
// endpoints; worker invocation is external (k8s CronJob pings
// POST /blog-jobs/run-due on a schedule). SELECT ... FOR UPDATE SKIP LOCKED
// gives us safe concurrent claims without an extra dependency.
//
// Backoff policy (encoded in the run-due dispatcher, not the row):
//   attempt 1 → schedule retry +1m,  attempt 2 → +5m,
//   attempt 3 → +30m,                attempt 4 → +2h,
//   attempt 5 → mark failed (no retry).
export const blogJobs = pgTable(
  'blog_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    type: varchar('type', { length: 64 }).notNull(),
    payload: jsonb('payload'),
    status: varchar('status', { length: 16 }).notNull().default('queued'), // queued | active | completed | failed | cancelled
    priority: integer('priority').notNull().default(50),
    scheduledAt: timestamp('scheduled_at').notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    lastError: jsonb('last_error'), // { message, stack, code, attempt_at }
    result: jsonb('result'),
    /** Per-tenant deduplication; (tenant_id, idempotency_key) is UNIQUE when non-null. */
    idempotencyKey: varchar('idempotency_key', { length: 200 }),
    /** Soft claim lock — set when a worker picks up the job. */
    lockedUntil: timestamp('locked_until'),
    lockedBy: varchar('locked_by', { length: 200 }),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdByUserId: varchar('created_by_user_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_jobs_tenant_idx').on(table.tenantId),
    statusIdx: index('blog_jobs_tenant_status_idx').on(table.tenantId, table.status),
    runQueueIdx: index('blog_jobs_run_queue_idx').on(
      table.status,
      table.scheduledAt,
      table.priority,
    ),
  }),
);

// ---------------------------------------------------------------------------
// blog_serp_snapshots — cached SERP fetches for strategy work (US-BLOG-015)
// ---------------------------------------------------------------------------
// One row per (keyword, location_code, language_code, fetched_at). Editors
// re-fetch on demand; older snapshots stay around for trend comparison.
export const blogSerpSnapshots = pgTable(
  'blog_serp_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    keyword: varchar('keyword', { length: 500 }).notNull(),
    locationCode: integer('location_code').notNull().default(2840), // 2840 = United States in DFS
    languageCode: varchar('language_code', { length: 16 }).notNull().default('en'),
    /** Array of organic results, top 20: { rank, url, title, description, domain, word_count, headings: { h2: string[], h3: string[] } }. */
    organicResults: jsonb('organic_results').notNull(),
    /** Map of feature presence: { paa: [{q,a}], featured_snippet: {url,title,text}, knowledge_panel: {...}, video_pack: [], image_pack: [], local_pack: [] }. */
    serpFeatures: jsonb('serp_features'),
    /** Pre-computed aggregates: { median_word_count, mean_word_count, common_h2s: [{text, count}], dominant_content_type, total_results }. */
    aggregate: jsonb('aggregate'),
    sourceAdapter: varchar('source_adapter', { length: 32 }).notNull().default('dataforseo'),
    fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
    /** Adapter-reported call cost in cents (0 if free / unknown). */
    costCents: integer('cost_cents').notNull().default(0),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_serp_snapshots_tenant_idx').on(table.tenantId),
    keywordIdx: index('blog_serp_snapshots_tenant_keyword_idx').on(
      table.tenantId,
      table.keyword,
      table.fetchedAt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// blog_audit_log — every mutating action (US-BLOG-011, 086)
// ---------------------------------------------------------------------------
export const blogAuditLog = pgTable(
  'blog_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    actorUserId: varchar('actor_user_id'), // null for agent / system actions
    actorType: varchar('actor_type', { length: 16 }).notNull(), // user | agent | system
    agentKind: varchar('agent_kind', { length: 64 }), // null when actor_type=user
    action: varchar('action', { length: 100 }).notNull(), // e.g. 'post.publish', 'agent.refresh.complete', 'kill_switch.toggle'
    targetType: varchar('target_type', { length: 64 }),
    targetId: uuid('target_id'),
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state'),
    summary: text('summary'),
    requestIp: varchar('request_ip', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_audit_log_tenant_idx').on(table.tenantId),
    actionIdx: index('blog_audit_log_tenant_action_idx').on(table.tenantId, table.action),
    targetIdx: index('blog_audit_log_target_idx').on(table.targetType, table.targetId),
    createdIdx: index('blog_audit_log_tenant_created_idx').on(table.tenantId, table.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// Zod insert schemas (used by edge functions for validation)
// ---------------------------------------------------------------------------

export const insertBlogBrandVoiceSchema = createInsertSchema(blogBrandVoices, {
  pov: z.enum(['first', 'second', 'third']).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBlogStyleGuideSchema = createInsertSchema(blogStyleGuides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBlogKeywordClusterSchema = createInsertSchema(blogKeywordClusters, {
  clusterType: z.enum(['pillar', 'supporting']).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBlogKeywordSchema = createInsertSchema(blogKeywords, {
  intent: z
    .enum(['informational', 'commercial', 'transactional', 'navigational', 'mixed'])
    .optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlogBriefSchema = createInsertSchema(blogBriefs, {
  status: z.enum(['draft', 'ready', 'in_progress', 'complete', 'archived']).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBlogAssetSchema = createInsertSchema(blogAssets, {
  assetType: z.enum(['image', 'quote', 'data', 'expert_contact', 'file']),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBlogPostSchema = createInsertSchema(blogPosts, {
  status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBlogPostRevisionSchema = createInsertSchema(blogPostRevisions, {
  revisionSource: z.enum(['manual', 'ai_draft', 'ai_rewrite', 'auto_refresh_agent']),
}).omit({
  id: true,
  createdAt: true,
});

export const insertBlogCitationSchema = createInsertSchema(blogCitations).omit({
  id: true,
  createdAt: true,
});

export const insertBlogDistributionTargetSchema = createInsertSchema(blogDistributionTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertBlogDistributionSchema = createInsertSchema(blogDistributions, {
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlogPerformanceMetricSchema = createInsertSchema(blogPerformanceMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertBlogRefreshQueueSchema = createInsertSchema(blogRefreshQueue, {
  reason: z.enum(['serp_decay', 'scheduled', 'manual', 'performance_drop']),
  status: z.enum(['queued', 'in_progress', 'completed', 'failed', 'skipped']).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlogAuditLogSchema = createInsertSchema(blogAuditLog, {
  actorType: z.enum(['user', 'agent', 'system']),
}).omit({
  id: true,
  createdAt: true,
});

export const insertBlogAgentSettingsSchema = createInsertSchema(blogAgentSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ---------------------------------------------------------------------------
// Inferred Drizzle types — Select / Insert per table
// ---------------------------------------------------------------------------

export type BlogBrandVoice = typeof blogBrandVoices.$inferSelect;
export type NewBlogBrandVoice = typeof blogBrandVoices.$inferInsert;
export type BlogStyleGuide = typeof blogStyleGuides.$inferSelect;
export type NewBlogStyleGuide = typeof blogStyleGuides.$inferInsert;
export type BlogKeywordCluster = typeof blogKeywordClusters.$inferSelect;
export type NewBlogKeywordCluster = typeof blogKeywordClusters.$inferInsert;
export type BlogKeyword = typeof blogKeywords.$inferSelect;
export type NewBlogKeyword = typeof blogKeywords.$inferInsert;
export type BlogBrief = typeof blogBriefs.$inferSelect;
export type NewBlogBrief = typeof blogBriefs.$inferInsert;
export type BlogAsset = typeof blogAssets.$inferSelect;
export type NewBlogAsset = typeof blogAssets.$inferInsert;
export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
export type BlogPostRevision = typeof blogPostRevisions.$inferSelect;
export type NewBlogPostRevision = typeof blogPostRevisions.$inferInsert;
export type BlogCitation = typeof blogCitations.$inferSelect;
export type NewBlogCitation = typeof blogCitations.$inferInsert;
export type BlogDistributionTarget = typeof blogDistributionTargets.$inferSelect;
export type NewBlogDistributionTarget = typeof blogDistributionTargets.$inferInsert;
export type BlogDistribution = typeof blogDistributions.$inferSelect;
export type NewBlogDistribution = typeof blogDistributions.$inferInsert;
export type BlogPerformanceMetric = typeof blogPerformanceMetrics.$inferSelect;
export type NewBlogPerformanceMetric = typeof blogPerformanceMetrics.$inferInsert;
export type BlogRefreshQueueItem = typeof blogRefreshQueue.$inferSelect;
export type NewBlogRefreshQueueItem = typeof blogRefreshQueue.$inferInsert;
export type BlogAuditLogEntry = typeof blogAuditLog.$inferSelect;
export type NewBlogAuditLogEntry = typeof blogAuditLog.$inferInsert;
export type BlogAgentSettings = typeof blogAgentSettings.$inferSelect;
export type NewBlogAgentSettings = typeof blogAgentSettings.$inferInsert;
export type BlogJob = typeof blogJobs.$inferSelect;
export type NewBlogJob = typeof blogJobs.$inferInsert;
export type BlogSerpSnapshot = typeof blogSerpSnapshots.$inferSelect;
export type NewBlogSerpSnapshot = typeof blogSerpSnapshots.$inferInsert;

// Suppress unused-import warning for drizzle-orm sql helper (kept for future raw fragments)
void sql;
