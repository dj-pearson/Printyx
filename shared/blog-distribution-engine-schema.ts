/**
 * Blog Distribution Engine Schema — the closed-loop distribution + refresh side
 * of the Universal Blog System (US-BLOG-021, 052, 053, 054, 055, 063).
 *
 * This file holds ONLY the new tables this feature cluster introduces. It REUSES
 * the existing blog tables (do NOT recreate them here):
 *   - blog_posts                  (source of truth for posts)
 *   - blog_refresh_queue          (decay candidates land here — US-BLOG-021/063)
 *   - blog_performance_metrics    (GA4 / Search Console snapshots — decay math)
 *   - blog_distributions          (per-platform sends — optimal-time history)
 *   - blog_distribution_targets   (tenant platform configs)
 *   - blog_post_revisions         (internal-link injection writes revisions here)
 *   - blog_keyword_clusters       (clustering)
 *   - blog_syndication_pieces     (shared/blog-syndication-schema.ts — re-share
 *                                  cadence acts on / references these rows)
 *
 * New tables introduced here:
 *   - blog_decay_events             (US-BLOG-021) one row per decay flag/notification
 *   - blog_schedule_models          (US-BLOG-052) per (tenant, platform) optimal-time model
 *   - blog_utm_templates            (US-BLOG-053) per-tenant UTM template + short-link config
 *   - blog_reshare_cadences         (US-BLOG-054) per-post re-share cadence state
 *   - blog_link_injection_proposals (US-BLOG-055) proposed internal-link edits (PR-style)
 *   - blog_refresh_queue_details    (US-BLOG-063) companion to blog_refresh_queue
 *                                    (suggested edits, effort, last_refreshed_at) —
 *                                    keyed by queue id so we never ALTER the existing table
 *
 * Convention notes (match the blog module):
 *   - platform/status/severity are plain varchar columns (not pg enums) so new
 *     channels ship without a migration; the edge function validates via Zod.
 *   - tenant_id varchar NOT NULL + index on every table.
 *   - All FKs are declared as `.references(...)` here for Drizzle typing, but are
 *     ENFORCED at the DB layer only by the backfill migration .sql.
 *   - Soft delete (deleted_at) only on user-facing tables.
 *
 * Re-exported from shared/schema.ts via `export * from './blog-distribution-engine-schema'`
 * (mirrors blog-syndication-schema). This file does not modify schema.ts.
 */

import {
  boolean,
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
// Shared enum-ish string sets (validated in the edge function via Zod).
// ---------------------------------------------------------------------------

/** Decay severity, also used as blog_refresh_queue.priority bucket. */
export const DECAY_SEVERITIES = ['none', 'low', 'medium', 'high'] as const;
export type DecaySeverity = (typeof DECAY_SEVERITIES)[number];

/** Platforms the scheduling / re-share / UTM engines understand. */
export const DISTRIBUTION_PLATFORMS = [
  'email',
  'x',
  'linkedin',
  'facebook',
  'instagram',
  'tiktok',
  'youtube_shorts',
  'pinterest',
  'reddit',
  'hackernews',
  'medium',
  'substack',
  'slack',
  'discord',
] as const;
export type DistributionPlatform = (typeof DISTRIBUTION_PLATFORMS)[number];

// ---------------------------------------------------------------------------
// blog_decay_events — US-BLOG-021
// One row per time a post crosses a decay threshold (or a scan re-confirms it).
// Carries the 28-day rolling window vs prior window deltas + the queued refresh
// id and a notification stub record.
// ---------------------------------------------------------------------------
export const blogDecayEvents = pgTable(
  'blog_decay_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Source post. FK enforced in migration (blog_posts.id). */
    postId: uuid('post_id').notNull(),
    severity: varchar('severity', { length: 12 }).notNull().default('none'), // none|low|medium|high
    /** Which rules fired: subset of ['clicks','impressions','position']. */
    triggers: jsonb('triggers').notNull(),
    /** Current 28-day window aggregates: { clicks, impressions, position, ctr }. */
    currentWindow: jsonb('current_window'),
    /** Prior 28-day window aggregates (same shape). */
    priorWindow: jsonb('prior_window'),
    /** Percent/absolute deltas: { clicks_pct, impressions_pct, position_delta }. */
    deltas: jsonb('deltas'),
    /** blog_refresh_queue row this event auto-created/updated (US-BLOG-021). */
    refreshQueueId: uuid('refresh_queue_id'),
    /** Notification send is stubbed; we persist intent + status here. */
    notificationChannel: varchar('notification_channel', { length: 16 }), // slack|email|null
    notificationStatus: varchar('notification_status', { length: 16 }), // pending|sent|skipped|failed
    notificationDetail: jsonb('notification_detail'),
    detectedAt: timestamp('detected_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_decay_events_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_decay_events_tenant_post_idx').on(table.tenantId, table.postId),
    detectedIdx: index('blog_decay_events_detected_idx').on(table.detectedAt),
  }),
);

export type BlogDecayEvent = typeof blogDecayEvents.$inferSelect;
export type NewBlogDecayEvent = typeof blogDecayEvents.$inferInsert;

// ---------------------------------------------------------------------------
// blog_schedule_models — US-BLOG-052
// One row per (tenant, platform). Stores the computed day-of-week x hour
// optimal-time model derived from historical sends + engagement, plus the
// ranked best slots. First-time platforms seed from industry defaults.
// ---------------------------------------------------------------------------
export const blogScheduleModels = pgTable(
  'blog_schedule_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    platform: varchar('platform', { length: 40 }).notNull(),
    /** Engagement score per "dow:hour" bucket, e.g. { "1:9": 0.83, ... } (dow 0=Sun). */
    buckets: jsonb('buckets').notNull(),
    /** Ranked best slots: [{ dow, hour, score }] best-first. */
    rankedSlots: jsonb('ranked_slots').notNull(),
    /** 'history' once we have data, 'industry_default' for first-time platforms. */
    source: varchar('source', { length: 24 }).notNull().default('industry_default'),
    /** How many historical sends fed the model. */
    sampleSize: integer('sample_size').notNull().default(0),
    computedAt: timestamp('computed_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_schedule_models_tenant_idx').on(table.tenantId),
    tenantPlatformIdx: index('blog_schedule_models_tenant_platform_idx').on(
      table.tenantId,
      table.platform,
    ),
  }),
);

export type BlogScheduleModel = typeof blogScheduleModels.$inferSelect;
export type NewBlogScheduleModel = typeof blogScheduleModels.$inferInsert;

// ---------------------------------------------------------------------------
// blog_utm_templates — US-BLOG-053
// One active template per tenant (default-row uniqueness enforced in the edge
// function). Holds the utm_source/medium/campaign template + short-link config.
// ---------------------------------------------------------------------------
export const blogUtmTemplates = pgTable(
  'blog_utm_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    name: varchar('name', { length: 200 }).notNull().default('Default'),
    /**
     * Template strings; tokens {platform} and {post_slug} are interpolated.
     * Defaults: source={platform}, medium=channel-class, campaign={post_slug}.
     */
    sourceTemplate: varchar('source_template', { length: 200 }).notNull().default('{platform}'),
    mediumTemplate: varchar('medium_template', { length: 200 }).notNull().default('{channel}'),
    campaignTemplate: varchar('campaign_template', { length: 200 })
      .notNull()
      .default('{post_slug}'),
    /** Optional fixed content/term tokens. */
    contentTemplate: varchar('content_template', { length: 200 }),
    termTemplate: varchar('term_template', { length: 200 }),
    /** Short-link provider config (Bitly/Rebrandly) — credentials behind vault. */
    shortLinkProvider: varchar('short_link_provider', { length: 24 }), // bitly|rebrandly|null
    shortLinkConfig: jsonb('short_link_config'), // { domain, *_set markers } — never decrypted creds
    isDefault: boolean('is_default').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_utm_templates_tenant_idx').on(table.tenantId),
    tenantDefaultIdx: index('blog_utm_templates_tenant_default_idx').on(
      table.tenantId,
      table.isDefault,
    ),
  }),
);

export type BlogUtmTemplate = typeof blogUtmTemplates.$inferSelect;
export type NewBlogUtmTemplate = typeof blogUtmTemplates.$inferInsert;

// ---------------------------------------------------------------------------
// blog_reshare_cadences — US-BLOG-054
// One row per post. `steps` is the full cadence timeline (offset/platform/
// status/scheduled_at/variant_hook), `paused` gates auto-scheduling.
// Default cadence: T+0, T+3 (X), T+7 (LinkedIn), T+30 (community), T+90, T+180.
// ---------------------------------------------------------------------------
export const blogReshareCadences = pgTable(
  'blog_reshare_cadences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** One cadence per post. FK enforced in migration (blog_posts.id). */
    postId: uuid('post_id').notNull(),
    /** Anchor the offsets are measured from (usually publish date). */
    publishedAt: timestamp('published_at'),
    /**
     * [{ key, offset_days, platform, angle, status, scheduled_at, variant_hook,
     *    syndication_piece_id, engagement_score }]
     * status: planned | scheduled | sent | skipped | stopped
     */
    steps: jsonb('steps').notNull(),
    paused: boolean('paused').notNull().default(false),
    /** Auto-stop threshold: if prior re-share engagement < this, stop scheduling. */
    engagementStopThreshold: numeric('engagement_stop_threshold', { precision: 6, scale: 4 }),
    /** Set when the engine auto-stopped the cadence (US-BLOG-054). */
    autoStoppedAt: timestamp('auto_stopped_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_reshare_cadences_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_reshare_cadences_tenant_post_idx').on(table.tenantId, table.postId),
  }),
);

export type BlogReshareCadence = typeof blogReshareCadences.$inferSelect;
export type NewBlogReshareCadence = typeof blogReshareCadences.$inferInsert;

// ---------------------------------------------------------------------------
// blog_link_injection_proposals — US-BLOG-055
// One row per proposed internal link from a target post -> a new pillar post.
// PR-style: status accept/reject per change; on accept a blog_post_revisions row
// is written on the target post and a CMS re-publish is noted (stubbed).
// ---------------------------------------------------------------------------
export const blogLinkInjectionProposals = pgTable(
  'blog_link_injection_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Batch id so accept-all / reject-all can act on a whole proposal set. */
    batchId: uuid('batch_id').notNull(),
    /** The new pillar post that should receive backlinks. */
    pillarPostId: uuid('pillar_post_id').notNull(),
    /** The existing post that will be edited to link to the pillar. */
    targetPostId: uuid('target_post_id').notNull(),
    similarityScore: numeric('similarity_score', { precision: 6, scale: 4 }),
    anchorText: varchar('anchor_text', { length: 300 }),
    /** The sentence as it currently reads in the target post. */
    sentenceBefore: varchar('sentence_before', { length: 4000 }),
    /** The proposed rewritten sentence with the natural inline link. */
    sentenceAfter: varchar('sentence_after', { length: 4000 }),
    /** Absolute/relative URL of the pillar the anchor points at. */
    pillarUrl: varchar('pillar_url', { length: 2000 }),
    status: varchar('status', { length: 16 }).notNull().default('proposed'), // proposed|accepted|rejected|applied
    /** blog_post_revisions row created on acceptance (US-BLOG-055). */
    appliedRevisionId: uuid('applied_revision_id'),
    /** CMS re-publish result (stubbed): { adapter, status, note }. */
    cmsPushResult: jsonb('cms_push_result'),
    decidedAt: timestamp('decided_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_link_injection_proposals_tenant_idx').on(table.tenantId),
    batchIdx: index('blog_link_injection_proposals_batch_idx').on(table.batchId),
    pillarIdx: index('blog_link_injection_proposals_pillar_idx').on(
      table.tenantId,
      table.pillarPostId,
    ),
  }),
);

export type BlogLinkInjectionProposal = typeof blogLinkInjectionProposals.$inferSelect;
export type NewBlogLinkInjectionProposal = typeof blogLinkInjectionProposals.$inferInsert;

// ---------------------------------------------------------------------------
// blog_refresh_queue_details — US-BLOG-063
// Companion to the EXISTING blog_refresh_queue. We do NOT alter that table; this
// row (keyed by queue_id) carries the extra fields US-BLOG-063 needs: severity,
// LLM-suggested edits (SERP vs current post), estimated effort, last_refreshed_at
// (blog_posts has no such column), and ranking-recovery monitoring state.
// ---------------------------------------------------------------------------
export const blogRefreshQueueDetails = pgTable(
  'blog_refresh_queue_details',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** 1:1 with a blog_refresh_queue row. FK enforced in migration. */
    queueId: uuid('queue_id').notNull(),
    /** Denormalized for convenience / direct post lookups. */
    postId: uuid('post_id').notNull(),
    severity: varchar('severity', { length: 12 }), // none|low|medium|high
    /** LLM diff: current SERP intent vs current post — inline annotation blocks. */
    suggestedEdits: jsonb('suggested_edits'),
    /** Estimated effort: { level: 'small'|'medium'|'large', minutes: number }. */
    estimatedEffort: jsonb('estimated_effort'),
    /** Tracked separately from publish date (US-BLOG-063). */
    lastRefreshedAt: timestamp('last_refreshed_at'),
    /** Position at refresh time, so recovery can be measured against it. */
    baselinePosition: numeric('baseline_position', { precision: 6, scale: 2 }),
    /** Recovery monitoring: pending | recovered | not_recovered. */
    recoveryStatus: varchar('recovery_status', { length: 16 }),
    recoveryCheckedAt: timestamp('recovery_checked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_refresh_queue_details_tenant_idx').on(table.tenantId),
    queueIdx: index('blog_refresh_queue_details_queue_idx').on(table.queueId),
    postIdx: index('blog_refresh_queue_details_post_idx').on(table.postId),
  }),
);

export type BlogRefreshQueueDetail = typeof blogRefreshQueueDetails.$inferSelect;
export type NewBlogRefreshQueueDetail = typeof blogRefreshQueueDetails.$inferInsert;
