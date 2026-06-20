/**
 * Blog Syndication Schema — per-platform repurposing of published posts.
 *
 * One table, blog_syndication_pieces, backs the whole syndication family
 * (US-BLOG-043..051): email newsletter, X/Twitter thread, LinkedIn long-form,
 * Facebook/Instagram (post + carousel + Reel), TikTok/Shorts script, Pinterest
 * pins, Reddit (rule-aware), Hacker News / Medium / Substack, and Slack/Discord
 * snippets. Each generated piece is a row keyed to its source post and platform,
 * carrying the platform-specific payload in `content` (jsonb) plus scheduling and
 * UTM/tracking metadata. Manual-only platforms (Reddit, HN) never auto-submit —
 * status simply moves to `ready` and the editor copies it out.
 *
 * Re-exported from shared/schema.ts via `export * from './blog-syndication-schema'`.
 */

import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Supported syndication platforms. Kept as a plain string column (not a pg enum)
 * so new channels can ship without a migration, matching the blog module's
 * convention of validating enums in the edge function via Zod.
 */
export const SYNDICATION_PLATFORMS = [
  'email', // US-BLOG-043
  'x', // US-BLOG-044
  'linkedin', // US-BLOG-045
  'facebook', // US-BLOG-046
  'instagram_carousel', // US-BLOG-046
  'instagram_reel', // US-BLOG-046
  'tiktok', // US-BLOG-047
  'youtube_shorts', // US-BLOG-047
  'pinterest', // US-BLOG-048
  'reddit', // US-BLOG-049
  'hackernews', // US-BLOG-050
  'medium', // US-BLOG-050
  'substack', // US-BLOG-050
  'slack', // US-BLOG-051
  'discord', // US-BLOG-051
] as const;
export type SyndicationPlatform = (typeof SYNDICATION_PLATFORMS)[number];

export const SYNDICATION_STATUSES = [
  'draft', // generated, editable
  'ready', // approved for manual copy/paste (Reddit, HN, etc.)
  'scheduled', // queued for a future send via an adapter
  'published', // sent / posted
  'failed', // adapter error — see content.error
] as const;
export type SyndicationStatus = (typeof SYNDICATION_STATUSES)[number];

// ---------------------------------------------------------------------------
// blog_syndication_pieces — one repurposed artifact per (post, platform, variant)
// ---------------------------------------------------------------------------
export const blogSyndicationPieces = pgTable(
  'blog_syndication_pieces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Source post. FK enforced in the backfill migration (blog_posts.id). */
    postId: uuid('post_id').notNull(),
    platform: varchar('platform', { length: 40 }).notNull(),
    /** Human label, e.g. "Hook variant 2" or "Carousel — quote style". */
    variantLabel: varchar('variant_label', { length: 200 }),
    /**
     * Platform-specific payload. Shape varies by platform, e.g.:
     *   email:   { subject_variants[], preheader, body_html, body_text, cta }
     *   x:       { hook_variants[], tweets[], cta_tweet, char_counts[] }
     *   linkedin:{ hook, body, hashtags[], first_comment }
     *   carousel:{ slides[{title, body}], description }
     *   reel/tiktok: { hook, beats[], on_screen_text[], broll[], runtime_sec }
     *   pinterest: { pins[{headline, description, layout, colors}] }
     *   reddit:  { title, body, format, rule_findings[], subreddit }
     *   hackernews/medium/substack: { title, canonical_url, tags[], seed_comment }
     *   slack/discord: { blocks/embed, summary, cta_url }
     */
    content: jsonb('content').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    /** Canonical URL of the source post — links/UTM and canonical tags derive from it. */
    postUrl: varchar('post_url', { length: 2000 }),
    /** UTM bag applied to outbound links: { source, medium, campaign, content, term }. */
    utm: jsonb('utm'),
    /** Adapter + per-channel target config (handle, webhook id, subreddit rules, etc.). */
    targetConfig: jsonb('target_config'),
    scheduledAt: timestamp('scheduled_at'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_syndication_pieces_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_syndication_pieces_tenant_post_idx').on(
      table.tenantId,
      table.postId,
    ),
    tenantPlatformIdx: index('blog_syndication_pieces_tenant_platform_idx').on(
      table.tenantId,
      table.platform,
    ),
  }),
);

export type BlogSyndicationPiece = typeof blogSyndicationPieces.$inferSelect;
export type NewBlogSyndicationPiece = typeof blogSyndicationPieces.$inferInsert;
