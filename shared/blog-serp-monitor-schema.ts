/**
 * Blog SERP Monitor + Competitor Alerts + Auto-Refresh Agent Schema
 * (US-BLOG-070 / US-BLOG-071 / US-BLOG-066).
 *
 * Three cooperating feature families, all backing the blog-serp-monitor edge
 * function, all tenant-scoped:
 *
 *   US-BLOG-070 — Real-time SERP monitor with auto-refresh triggers.
 *     - blog_serp_monitor_config: per-workspace tier-1 keyword list + alert
 *       channel config (email / slack / in_app).
 *     - blog_serp_volatility_events: persisted volatility detections (rank
 *       change >3, new SERP feature, new top-10 competitor) used for the
 *       per-keyword volatility timeline. Significant volatility on a published
 *       post auto-enqueues a high-priority row in the EXISTING blog_refresh_queue.
 *     - blog_serp_alerts: one row per delivered/queued alert (channel send is
 *       stubbed; the row is the source of truth).
 *
 *   US-BLOG-071 — Competitor publishing alerts with response brief.
 *     - blog_competitor_feeds: competitor blog URLs (RSS/sitemap) per workspace.
 *     - blog_competitor_posts: detected competitor posts, LLM summary + keyword
 *       cluster tag + an optional auto-generated response brief. "Create brief
 *       from response" inserts into the EXISTING blog_briefs table.
 *
 *   US-BLOG-066 — Auto-refresh agent (fully autonomous SERP-decay re-editing).
 *     - blog_auto_refresh_config: per-tenant companion to blog_agent_settings
 *       (NOT altered). Holds auto_refresh_requires_review (default false =
 *       fully autonomous, scope decision 5D) + guardrail thresholds.
 *     - blog_auto_refresh_runs: one row per agent run, with cost-per-run.
 *     - blog_auto_refresh_reviews: guardrail-tripped candidates parked for human
 *       review and surfaced on the Refresh page.
 *
 * Existing tables REUSED (not recreated): blog_posts, blog_post_revisions
 * (auto_refresh_agent commits revisions here), blog_refresh_queue (volatility
 * auto-enqueues), blog_serp_snapshots (SERP history + diff), blog_keywords,
 * blog_keyword_clusters, blog_briefs (071 inserts here), blog_agent_settings
 * (kill switch — read only, never altered).
 *
 * FKs to existing tables are declared ONLY in the backfill migration
 * (drizzle/migrations/_backfill_blog_serp_monitor.sql), matching the blog
 * module convention. Re-export from shared/schema.ts is intentionally left to a
 * separate change — this file does not modify shared/schema.ts.
 */

import {
  boolean,
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
// Shared enum-ish constants. Stored as plain varchar (not pg enums) so new
// values ship without a migration — the edge function validates via Zod.
// ---------------------------------------------------------------------------

/** Alert delivery channels (US-BLOG-070, configurable per workspace). */
export const SERP_ALERT_CHANNELS = ['email', 'slack', 'in_app'] as const;
export type SerpAlertChannel = (typeof SERP_ALERT_CHANNELS)[number];

/** Volatility event kinds (US-BLOG-070). */
export const SERP_VOLATILITY_KINDS = [
  'rank_change', // our tracked URL moved >3 positions
  'new_serp_feature', // a SERP feature appeared (featured_snippet, paa, video_pack, ...)
  'new_competitor_top10', // a new competitor domain entered the top 10
] as const;
export type SerpVolatilityKind = (typeof SERP_VOLATILITY_KINDS)[number];

/** Monitoring tier — drives poll cadence (US-BLOG-070). */
export const SERP_MONITOR_TIERS = ['tier1', 'standard'] as const; // tier1 = hourly, standard = daily
export type SerpMonitorTier = (typeof SERP_MONITOR_TIERS)[number];

/** Competitor feed kinds (US-BLOG-071). */
export const COMPETITOR_FEED_KINDS = ['rss', 'sitemap'] as const;
export type CompetitorFeedKind = (typeof COMPETITOR_FEED_KINDS)[number];

/** Auto-refresh run outcomes (US-BLOG-066). */
export const AUTO_REFRESH_RUN_STATUSES = [
  'running',
  'published', // revised + re-published autonomously
  'review_required', // guardrail tripped → parked in blog_auto_refresh_reviews
  'no_change', // SERP diff didn't warrant a rewrite
  'skipped_kill_switch', // global kill switch engaged
  'failed',
] as const;
export type AutoRefreshRunStatus = (typeof AUTO_REFRESH_RUN_STATUSES)[number];

/** Why a candidate landed in the review queue (US-BLOG-066 hard guardrails). */
export const AUTO_REFRESH_REVIEW_REASONS = [
  'body_change_exceeds_max', // predicted change > max_body_change_pct
  'seo_score_drop', // SEO score would drop
  'brand_voice_violation', // brand-voice / style-guide violations introduced
  'requires_review_flag', // tenant opted into manual review
] as const;
export type AutoRefreshReviewReason = (typeof AUTO_REFRESH_REVIEW_REASONS)[number];

// ===========================================================================
// US-BLOG-070 — Real-time SERP monitor
// ===========================================================================

// ---------------------------------------------------------------------------
// blog_serp_monitor_config — per-workspace monitor settings (one row/tenant)
// ---------------------------------------------------------------------------
// Holds the configurable tier-1 keyword list (default: top 50 by traffic,
// resolved by the edge function) and the per-workspace alert channel config.
export const blogSerpMonitorConfig = pgTable(
  'blog_serp_monitor_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Explicit tier-1 keyword list (hourly polling). Empty/NULL → default top-N by traffic. */
    tier1Keywords: text('tier1_keywords').array(),
    /** How many top-by-traffic keywords are auto-promoted to tier-1 when the list is empty. */
    tier1AutoTopN: integer('tier1_auto_top_n').notNull().default(50),
    /** Enabled alert channels: subset of email | slack | in_app. */
    alertChannels: text('alert_channels').array(),
    /** Channel destinations: { email: ["a@b.com"], slack_webhook: "https://..." }. */
    alertConfig: jsonb('alert_config'),
    /** Rank-change threshold (positions) that counts as volatility. Default 3 per AC. */
    rankChangeThreshold: integer('rank_change_threshold').notNull().default(3),
    /** Master on/off for the monitor (independent of the global agent kill switch). */
    enabled: boolean('enabled').notNull().default(true),
    locationCode: integer('location_code').notNull().default(2840),
    languageCode: varchar('language_code', { length: 16 }).notNull().default('en'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_serp_monitor_config_tenant_idx').on(table.tenantId),
  }),
);

export type BlogSerpMonitorConfig = typeof blogSerpMonitorConfig.$inferSelect;
export type NewBlogSerpMonitorConfig = typeof blogSerpMonitorConfig.$inferInsert;

// ---------------------------------------------------------------------------
// blog_serp_volatility_events — persisted volatility detections
// ---------------------------------------------------------------------------
// Append-only event log. Backs the per-keyword volatility timeline endpoint and
// the auto-refresh trigger. `postId` is set when the keyword maps to one of our
// published posts (drives the high-priority blog_refresh_queue enqueue).
export const blogSerpVolatilityEvents = pgTable(
  'blog_serp_volatility_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    keyword: varchar('keyword', { length: 500 }).notNull(),
    tier: varchar('tier', { length: 16 }).notNull().default('standard'), // tier1 | standard
    kind: varchar('kind', { length: 32 }).notNull(), // rank_change | new_serp_feature | new_competitor_top10
    /** Magnitude — rank positions moved (rank_change) or 1 for boolean kinds. */
    magnitude: integer('magnitude').notNull().default(0),
    /** True when |magnitude|/feature/competitor crosses the configured threshold. */
    significant: boolean('significant').notNull().default(false),
    previousRank: integer('previous_rank'),
    currentRank: integer('current_rank'),
    /** The SERP feature / competitor domain that appeared, when applicable. */
    detail: jsonb('detail'), // { feature?, competitor_domain?, our_url?, before, after }
    /** Snapshot the diff was computed against (blog_serp_snapshots.id), when available. */
    previousSnapshotId: uuid('previous_snapshot_id'),
    currentSnapshotId: uuid('current_snapshot_id'),
    /** Published post this keyword maps to — drives the refresh-queue auto-trigger. */
    postId: uuid('post_id'),
    /** Refresh-queue row created in response, when significant + on a published post. */
    refreshQueueId: uuid('refresh_queue_id'),
    detectedAt: timestamp('detected_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_serp_volatility_events_tenant_idx').on(table.tenantId),
    tenantKeywordIdx: index('blog_serp_volatility_events_tenant_keyword_idx').on(
      table.tenantId,
      table.keyword,
      table.detectedAt,
    ),
    postIdx: index('blog_serp_volatility_events_post_idx').on(table.postId),
  }),
);

export type BlogSerpVolatilityEvent = typeof blogSerpVolatilityEvents.$inferSelect;
export type NewBlogSerpVolatilityEvent = typeof blogSerpVolatilityEvents.$inferInsert;

// ---------------------------------------------------------------------------
// blog_serp_alerts — one row per alert fired (email / slack / in_app)
// ---------------------------------------------------------------------------
// Channel send is stubbed behind an adapter; the row is the durable record and
// also backs the in-app alert feed.
export const blogSerpAlerts = pgTable(
  'blog_serp_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** What triggered the alert: 'volatility' (070) | 'competitor_post' (071). */
    source: varchar('source', { length: 24 }).notNull(),
    channel: varchar('channel', { length: 16 }).notNull(), // email | slack | in_app
    /** Linkage to the originating event/post for drill-down. */
    volatilityEventId: uuid('volatility_event_id'),
    competitorPostId: uuid('competitor_post_id'),
    keyword: varchar('keyword', { length: 500 }),
    title: varchar('title', { length: 500 }),
    message: text('message'),
    payload: jsonb('payload'),
    status: varchar('status', { length: 16 }).notNull().default('queued'), // queued | sent | failed | read
    sentAt: timestamp('sent_at'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_serp_alerts_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('blog_serp_alerts_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

export type BlogSerpAlert = typeof blogSerpAlerts.$inferSelect;
export type NewBlogSerpAlert = typeof blogSerpAlerts.$inferInsert;

// ===========================================================================
// US-BLOG-071 — Competitor publishing alerts
// ===========================================================================

// ---------------------------------------------------------------------------
// blog_competitor_feeds — competitor blog URLs (RSS / sitemap) per workspace
// ---------------------------------------------------------------------------
export const blogCompetitorFeeds = pgTable(
  'blog_competitor_feeds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    competitorName: varchar('competitor_name', { length: 255 }),
    domain: varchar('domain', { length: 255 }),
    feedUrl: text('feed_url').notNull(),
    feedKind: varchar('feed_kind', { length: 16 }).notNull().default('rss'), // rss | sitemap
    enabled: boolean('enabled').notNull().default(true),
    lastPolledAt: timestamp('last_polled_at'),
    /** Cursor for incremental polling (last item guid / lastmod). */
    lastSeenCursor: text('last_seen_cursor'),
    pollErrorCount: integer('poll_error_count').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_competitor_feeds_tenant_idx').on(table.tenantId),
    tenantDomainIdx: index('blog_competitor_feeds_tenant_domain_idx').on(
      table.tenantId,
      table.domain,
    ),
  }),
);

export type BlogCompetitorFeed = typeof blogCompetitorFeeds.$inferSelect;
export type NewBlogCompetitorFeed = typeof blogCompetitorFeeds.$inferInsert;

// ---------------------------------------------------------------------------
// blog_competitor_posts — detected competitor posts + LLM analysis
// ---------------------------------------------------------------------------
// One row per newly-detected competitor post. `summary` + `clusterId` come from
// the LLM tagging pass. `responseBrief` is the auto-generated response angle;
// `briefId` is set once "create brief from response" inserts into blog_briefs.
export const blogCompetitorPosts = pgTable(
  'blog_competitor_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    feedId: uuid('feed_id').notNull(),
    /** Stable external id (rss guid / sitemap loc) — dedupe key per feed. */
    externalId: text('external_id').notNull(),
    url: text('url').notNull(),
    title: varchar('title', { length: 1000 }),
    excerpt: text('excerpt'),
    publishedAt: timestamp('published_at'),
    /** True when detected within 24h of publish (US-BLOG-071 AC). */
    detectedFresh: boolean('detected_fresh').notNull().default(false),
    /** LLM summary of what they covered. */
    summary: text('summary'),
    /** Keyword cluster the LLM tagged this post with. */
    clusterId: uuid('cluster_id'),
    /** Keywords we rank for that this post appears to target (drives the alert). */
    overlappingKeywords: text('overlapping_keywords').array(),
    /** True when this post targets a keyword we rank for → alert worthy. */
    targetsOurKeyword: boolean('targets_our_keyword').notNull().default(false),
    /** Auto-generated response brief: { they_covered, we_should_add, counter_points, response_angle }. */
    responseBrief: jsonb('response_brief'),
    /** Set once a brief is created from the response (FK → blog_briefs in migration). */
    briefId: uuid('brief_id'),
    status: varchar('status', { length: 16 }).notNull().default('new'), // new | analyzed | brief_created | dismissed
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    tenantIdx: index('blog_competitor_posts_tenant_idx').on(table.tenantId),
    feedExternalIdx: index('blog_competitor_posts_feed_external_idx').on(
      table.feedId,
      table.externalId,
    ),
    tenantStatusIdx: index('blog_competitor_posts_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
  }),
);

export type BlogCompetitorPost = typeof blogCompetitorPosts.$inferSelect;
export type NewBlogCompetitorPost = typeof blogCompetitorPosts.$inferInsert;

// ===========================================================================
// US-BLOG-066 — Auto-refresh agent
// ===========================================================================

// ---------------------------------------------------------------------------
// blog_auto_refresh_config — per-tenant companion to blog_agent_settings
// ---------------------------------------------------------------------------
// Deliberately a SEPARATE table from blog_agent_settings (which we must not
// alter). Holds the per-tenant manual-review opt-in (default false = fully
// autonomous, scope decision 5D) and the hard guardrail thresholds.
export const blogAutoRefreshConfig = pgTable(
  'blog_auto_refresh_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull().unique(), // one row per tenant
    /** Opt-in to a human-approval step. DEFAULT false → fully autonomous. */
    autoRefreshRequiresReview: boolean('auto_refresh_requires_review').notNull().default(false),
    /** Guardrail: block auto-publish if predicted body change exceeds this %. Default 40. */
    maxBodyChangePct: integer('max_body_change_pct').notNull().default(40),
    /** Guardrail: block auto-publish if the recomputed SEO score would drop. */
    blockOnSeoScoreDrop: boolean('block_on_seo_score_drop').notNull().default(true),
    /** Guardrail: block auto-publish on brand-voice / style-guide violations. */
    blockOnBrandVoiceViolation: boolean('block_on_brand_voice_violation').notNull().default(true),
    /** Don't auto-refresh a post more often than this. */
    minDaysBetweenRefresh: integer('min_days_between_refresh').notNull().default(14),
    /** Per-run cap so a runaway cron can't drain the AI budget. */
    maxPostsPerRun: integer('max_posts_per_run').notNull().default(10),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_auto_refresh_config_tenant_idx').on(table.tenantId),
  }),
);

export type BlogAutoRefreshConfig = typeof blogAutoRefreshConfig.$inferSelect;
export type NewBlogAutoRefreshConfig = typeof blogAutoRefreshConfig.$inferInsert;

// ---------------------------------------------------------------------------
// blog_auto_refresh_runs — one row per agent run (with cost-per-run)
// ---------------------------------------------------------------------------
export const blogAutoRefreshRuns = pgTable(
  'blog_auto_refresh_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    postId: uuid('post_id').notNull(),
    /** Refresh-queue row that triggered this run, when applicable. */
    refreshQueueId: uuid('refresh_queue_id'),
    /** What kicked it off: 'cron' | 'queue' | 'manual'. */
    trigger: varchar('trigger', { length: 16 }).notNull().default('cron'),
    status: varchar('status', { length: 24 }).notNull().default('running'),
    /** SERP diff vs the prior snapshot driving the rewrite decision. */
    serpDiff: jsonb('serp_diff'),
    /** Predicted fraction of the body changed (0-100), checked vs max_body_change_pct. */
    predictedBodyChangePct: numeric('predicted_body_change_pct', { precision: 5, scale: 2 }),
    seoScoreBefore: numeric('seo_score_before', { precision: 5, scale: 2 }),
    seoScoreAfter: numeric('seo_score_after', { precision: 5, scale: 2 }),
    /** Guardrail evaluation outcome: { passed, reasons[] }. */
    guardrailResult: jsonb('guardrail_result'),
    /** Revision committed to blog_post_revisions (revision_source='auto_refresh_agent'). */
    revisionId: uuid('revision_id'),
    /** Review row spawned when a guardrail tripped. */
    reviewId: uuid('review_id'),
    /** Whether the CMS re-publish adapter was invoked (and its stub result). */
    cmsPublished: boolean('cms_published').notNull().default(false),
    cmsResult: jsonb('cms_result'),
    /** Human-readable summary of what changed and why (also written to the audit log). */
    changeSummary: text('change_summary'),
    /** Cost-per-run in cents — also forwarded to the AI cost dashboard (blog_ai_costs). */
    costCents: integer('cost_cents').notNull().default(0),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    model: varchar('model', { length: 64 }),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_auto_refresh_runs_tenant_idx').on(table.tenantId),
    postIdx: index('blog_auto_refresh_runs_post_idx').on(table.postId),
    tenantStatusIdx: index('blog_auto_refresh_runs_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
  }),
);

export type BlogAutoRefreshRun = typeof blogAutoRefreshRuns.$inferSelect;
export type NewBlogAutoRefreshRun = typeof blogAutoRefreshRuns.$inferInsert;

// ---------------------------------------------------------------------------
// blog_auto_refresh_reviews — guardrail-tripped candidates parked for review
// ---------------------------------------------------------------------------
// Surfaced on the Refresh page. Holds the proposed revision (not yet committed
// as live) so a human can approve/reject. Soft-deletable / resolvable.
export const blogAutoRefreshReviews = pgTable(
  'blog_auto_refresh_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    postId: uuid('post_id').notNull(),
    runId: uuid('run_id').notNull(),
    /** Why it needs review: body_change_exceeds_max | seo_score_drop | brand_voice_violation | requires_review_flag. */
    reason: varchar('reason', { length: 32 }).notNull(),
    /** Extra detail per reason: { predicted_pct, max_pct, seo_before, seo_after, violations[] }. */
    reasonDetail: jsonb('reason_detail'),
    /** The proposed rewrite, held for approval: { title, body_markdown, meta_description, diff_summary }. */
    proposedContent: jsonb('proposed_content'),
    changeSummary: text('change_summary'),
    status: varchar('status', { length: 16 }).notNull().default('pending'), // pending | approved | rejected
    resolvedByUserId: varchar('resolved_by_user_id'),
    resolvedAt: timestamp('resolved_at'),
    resolutionNote: text('resolution_note'),
    /** Revision committed to blog_post_revisions once approved. */
    revisionId: uuid('revision_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    tenantIdx: index('blog_auto_refresh_reviews_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('blog_auto_refresh_reviews_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    postIdx: index('blog_auto_refresh_reviews_post_idx').on(table.postId),
  }),
);

export type BlogAutoRefreshReview = typeof blogAutoRefreshReviews.$inferSelect;
export type NewBlogAutoRefreshReview = typeof blogAutoRefreshReviews.$inferInsert;
