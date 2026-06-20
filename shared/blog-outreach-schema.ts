/**
 * Blog Outreach / Link-Building Schema (US-BLOG-056..060).
 *
 * Backs the whole link-building + outreach family with seven new tables. The
 * blog module's convention is followed throughout: status/platform-style enums
 * live as plain varchar columns (validated by Zod in the edge function, no pg
 * enum so new states ship without a migration), every table carries a NOT NULL
 * `tenant_id` (+ index) and a `created_by_user_id`, and user-facing tables have
 * a `deleted_at` soft-delete column. Third-party credentials (Ahrefs/SEMrush/
 * Majestic, Brand24/Mention, hunter.io/clearbit, SMTP/SendGrid/Resend, IMAP)
 * are never stored here in plaintext — the edge function persists them as an
 * `encrypted_config` jsonb marker on the relevant config rows and returns only
 * `*_set` booleans.
 *
 * Foreign keys to existing blog tables (blog_posts, blog_authors) are declared
 * ONLY in the backfill migration (drizzle/migrations/_backfill_blog_outreach.sql)
 * — mirroring blog_syndication_pieces — so this file has no cross-file FK refs.
 *
 * Tables:
 *   blog_backlinks          (US-BLOG-056) monitored inbound links per domain/post
 *   blog_backlink_events    (US-BLOG-056) append-style new/lost/high-DA events
 *   blog_brand_mentions     (US-BLOG-057) unlinked brand mentions across the web
 *   blog_outreach_prospects (US-BLOG-058) prioritized outreach targets per post
 *   blog_haro_queries       (US-BLOG-059) parsed HARO / HelpAB2BWriter source queries
 *   blog_haro_pitches       (US-BLOG-059) author-matched pitches per query
 *   blog_outreach_threads   (US-BLOG-057/060) one conversation per recipient
 *   blog_outreach_messages  (US-BLOG-060) in/out messages within a thread
 *
 * Re-exported from shared/schema.ts via `export * from './blog-outreach-schema'`
 * (registration is left to whoever wires it; this file does not modify schema.ts).
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
// Status / enum string sets (validated in the edge function, not pg enums)
// ---------------------------------------------------------------------------

/** Lifecycle of a monitored backlink (US-BLOG-056). */
export const BACKLINK_STATUSES = ['new', 'active', 'lost'] as const;
export type BacklinkStatus = (typeof BACKLINK_STATUSES)[number];

/** Backlink event kinds emitted by a sync (US-BLOG-056). */
export const BACKLINK_EVENT_TYPES = [
  'new', // a backlink first observed
  'lost', // a previously-active backlink disappeared
  'recovered', // a previously-lost backlink came back
  'high_da_alert', // new link above the configurable DA notification threshold
] as const;
export type BacklinkEventType = (typeof BACKLINK_EVENT_TYPES)[number];

/** Unlinked brand-mention outreach status (US-BLOG-057). */
export const BRAND_MENTION_STATUSES = [
  'detected', // found by the monitor, no outreach yet
  'queued', // outreach drafted/queued
  'sent', // outreach email sent
  'replied', // recipient replied
  'link_added', // re-crawl confirmed a link to our domain
  'declined', // recipient declined
  'ghosted', // no response after cadence
  'ignored', // dismissed by the editor
] as const;
export type BrandMentionStatus = (typeof BRAND_MENTION_STATUSES)[number];

/** Outreach prospect status (US-BLOG-058). */
export const OUTREACH_PROSPECT_STATUSES = [
  'new',
  'queued',
  'contacted',
  'replied',
  'won', // link acquired
  'lost', // declined / dead
] as const;
export type OutreachProspectStatus = (typeof OUTREACH_PROSPECT_STATUSES)[number];

/** HARO query status (US-BLOG-059). */
export const HARO_QUERY_STATUSES = [
  'new',
  'matched', // matched to an author by expertise
  'pitched', // a pitch was drafted/sent
  'ignored', // not relevant
  'expired', // deadline passed
] as const;
export type HaroQueryStatus = (typeof HARO_QUERY_STATUSES)[number];

/** HARO pitch status — feeds calibration (US-BLOG-059). */
export const HARO_PITCH_STATUSES = [
  'draft',
  'approved',
  'sent',
  'replied',
  'included', // we were quoted/published
  'ignored',
] as const;
export type HaroPitchStatus = (typeof HARO_PITCH_STATUSES)[number];

/** Outreach thread status (US-BLOG-060). */
export const OUTREACH_THREAD_STATUSES = [
  'draft', // agent drafted, awaiting human approval
  'queued', // approved, queued to send
  'sent', // first email sent
  'replied', // recipient replied
  'closed', // closed (no-response or terminal)
] as const;
export type OutreachThreadStatus = (typeof OUTREACH_THREAD_STATUSES)[number];

/** Direction of a message within a thread (US-BLOG-060). */
export const OUTREACH_MESSAGE_DIRECTIONS = ['in', 'out'] as const;
export type OutreachMessageDirection = (typeof OUTREACH_MESSAGE_DIRECTIONS)[number];

/** LLM reply classification (US-BLOG-060). */
export const OUTREACH_REPLY_CLASSES = [
  'interested',
  'decline',
  'question',
  'out_of_office',
  'unknown',
] as const;
export type OutreachReplyClass = (typeof OUTREACH_REPLY_CLASSES)[number];

// ---------------------------------------------------------------------------
// blog_backlinks — monitored inbound links (US-BLOG-056)
// ---------------------------------------------------------------------------
export const blogBacklinks = pgTable(
  'blog_backlinks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Optional source post this link points at. FK enforced in the migration. */
    postId: uuid('post_id'),
    sourceDomain: varchar('source_domain', { length: 255 }).notNull(),
    sourceUrl: varchar('source_url', { length: 2000 }).notNull(),
    targetUrl: varchar('target_url', { length: 2000 }),
    /** Domain Authority / Domain Rating as reported by the backlink adapter. */
    domainAuthority: integer('domain_authority'),
    anchorText: varchar('anchor_text', { length: 1000 }),
    /** new | active | lost. */
    status: varchar('status', { length: 20 }).notNull().default('new'),
    firstSeen: timestamp('first_seen').notNull().defaultNow(),
    lastSeen: timestamp('last_seen').notNull().defaultNow(),
    lostAt: timestamp('lost_at'),
    /** Which adapter produced this row: ahrefs | semrush | majestic | injected. */
    source: varchar('source', { length: 40 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_backlinks_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_backlinks_tenant_post_idx').on(table.tenantId, table.postId),
    tenantStatusIdx: index('blog_backlinks_tenant_status_idx').on(table.tenantId, table.status),
    tenantDomainIdx: index('blog_backlinks_tenant_domain_idx').on(
      table.tenantId,
      table.sourceDomain,
    ),
  }),
);

export type BlogBacklink = typeof blogBacklinks.$inferSelect;
export type NewBlogBacklink = typeof blogBacklinks.$inferInsert;

// ---------------------------------------------------------------------------
// blog_backlink_events — new/lost/recovered/high-DA notifications (US-BLOG-056)
// ---------------------------------------------------------------------------
export const blogBacklinkEvents = pgTable(
  'blog_backlink_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** The backlink this event concerns. FK enforced in the migration. */
    backlinkId: uuid('backlink_id'),
    postId: uuid('post_id'),
    /** new | lost | recovered | high_da_alert. */
    eventType: varchar('event_type', { length: 24 }).notNull(),
    sourceDomain: varchar('source_domain', { length: 255 }),
    sourceUrl: varchar('source_url', { length: 2000 }),
    /** Last-seen URL is carried so lost links can be chased (US-BLOG-056). */
    lastSeenUrl: varchar('last_seen_url', { length: 2000 }),
    domainAuthority: integer('domain_authority'),
    /** Stub notification dispatch marker — true once a notify adapter "sent" it. */
    notified: boolean('notified').notNull().default(false),
    notifiedAt: timestamp('notified_at'),
    detail: jsonb('detail'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_backlink_events_tenant_idx').on(table.tenantId),
    tenantTypeIdx: index('blog_backlink_events_tenant_type_idx').on(
      table.tenantId,
      table.eventType,
    ),
    backlinkIdx: index('blog_backlink_events_backlink_idx').on(table.backlinkId),
  }),
);

export type BlogBacklinkEvent = typeof blogBacklinkEvents.$inferSelect;
export type NewBlogBacklinkEvent = typeof blogBacklinkEvents.$inferInsert;

// ---------------------------------------------------------------------------
// blog_brand_mentions — unlinked brand mentions across the web (US-BLOG-057)
// ---------------------------------------------------------------------------
export const blogBrandMentions = pgTable(
  'blog_brand_mentions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    url: varchar('url', { length: 2000 }).notNull(),
    sourceDomain: varchar('source_domain', { length: 255 }),
    snippet: text('snippet'),
    /** Whether the page already links to our domain (true => filtered out of outreach). */
    hasLink: boolean('has_link').notNull().default(false),
    domainAuthority: integer('domain_authority'),
    /** detected | queued | sent | replied | link_added | declined | ghosted | ignored. */
    status: varchar('status', { length: 20 }).notNull().default('detected'),
    /** Set once outreach starts; links a mention to its conversation (US-BLOG-057/060). */
    threadId: uuid('thread_id'),
    detectedAt: timestamp('detected_at').notNull().defaultNow(),
    /** Last weekly re-crawl that checked whether a link was added. */
    lastCheckedAt: timestamp('last_checked_at'),
    linkAddedAt: timestamp('link_added_at'),
    source: varchar('source', { length: 40 }), // brand24 | mention | scrape | injected
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_brand_mentions_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('blog_brand_mentions_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    tenantHasLinkIdx: index('blog_brand_mentions_tenant_has_link_idx').on(
      table.tenantId,
      table.hasLink,
    ),
  }),
);

export type BlogBrandMention = typeof blogBrandMentions.$inferSelect;
export type NewBlogBrandMention = typeof blogBrandMentions.$inferInsert;

// ---------------------------------------------------------------------------
// blog_outreach_prospects — prioritized outreach targets per post (US-BLOG-058)
// ---------------------------------------------------------------------------
export const blogOutreachProspects = pgTable(
  'blog_outreach_prospects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** The post we're building links for. FK enforced in the migration. */
    postId: uuid('post_id'),
    siteDomain: varchar('site_domain', { length: 255 }).notNull(),
    contactEmail: varchar('contact_email', { length: 320 }),
    contactName: varchar('contact_name', { length: 200 }),
    contactRole: varchar('contact_role', { length: 200 }),
    domainAuthority: integer('domain_authority'),
    /** 0..100 niche-relevance score from the LLM site evaluation. */
    relevanceScore: numeric('relevance_score', { precision: 5, scale: 2 }),
    /** True when the site looks like a directory/aggregator (filtered down-list). */
    isDirectory: boolean('is_directory').notNull().default(false),
    suggestedAngle: text('suggested_angle'),
    /** Which competitor URL's backlink list surfaced this prospect (US-BLOG-058). */
    sourceCompetitorUrl: varchar('source_competitor_url', { length: 2000 }),
    /** Where the contact came from: hunter | clearbit | scrape | injected. */
    contactSource: varchar('contact_source', { length: 40 }),
    /** new | queued | contacted | replied | won | lost. */
    status: varchar('status', { length: 20 }).notNull().default('new'),
    /** Set once outreach starts (US-BLOG-060). */
    threadId: uuid('thread_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_outreach_prospects_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_outreach_prospects_tenant_post_idx').on(
      table.tenantId,
      table.postId,
    ),
    tenantStatusIdx: index('blog_outreach_prospects_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
  }),
);

export type BlogOutreachProspect = typeof blogOutreachProspects.$inferSelect;
export type NewBlogOutreachProspect = typeof blogOutreachProspects.$inferInsert;

// ---------------------------------------------------------------------------
// blog_haro_queries — parsed HARO / HelpAB2BWriter source queries (US-BLOG-059)
// ---------------------------------------------------------------------------
export const blogHaroQueries = pgTable(
  'blog_haro_queries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** External id from the source digest, if any (dedup key). */
    externalId: varchar('external_id', { length: 200 }),
    subject: varchar('subject', { length: 500 }),
    queryText: text('query_text').notNull(),
    category: varchar('category', { length: 200 }),
    outlet: varchar('outlet', { length: 255 }),
    deadline: timestamp('deadline'),
    /** Author matched by expertise tags. FK enforced in the migration. */
    matchedAuthorId: uuid('matched_author_id'),
    matchScore: numeric('match_score', { precision: 5, scale: 2 }),
    /** new | matched | pitched | ignored | expired. */
    status: varchar('status', { length: 20 }).notNull().default('new'),
    source: varchar('source', { length: 40 }), // haro | helpab2bwriter | injected
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_haro_queries_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('blog_haro_queries_tenant_status_idx').on(table.tenantId, table.status),
    authorIdx: index('blog_haro_queries_author_idx').on(table.matchedAuthorId),
  }),
);

export type BlogHaroQuery = typeof blogHaroQueries.$inferSelect;
export type NewBlogHaroQuery = typeof blogHaroQueries.$inferInsert;

// ---------------------------------------------------------------------------
// blog_haro_pitches — author-matched pitches per query (US-BLOG-059)
// ---------------------------------------------------------------------------
export const blogHaroPitches = pgTable(
  'blog_haro_pitches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** The HARO query this pitch answers. FK enforced in the migration. */
    queryId: uuid('query_id').notNull(),
    /** The author whose bio/expertise backs the pitch. FK enforced in the migration. */
    authorId: uuid('author_id'),
    pitchText: text('pitch_text').notNull(),
    /** draft | approved | sent | replied | included | ignored. */
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    /** Posts cited as evidence in the pitch (US-BLOG-059). */
    evidencePostIds: jsonb('evidence_post_ids'),
    approvedByUserId: varchar('approved_by_user_id'),
    approvedAt: timestamp('approved_at'),
    sentAt: timestamp('sent_at'),
    repliedAt: timestamp('replied_at'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_haro_pitches_tenant_idx').on(table.tenantId),
    queryIdx: index('blog_haro_pitches_query_idx').on(table.queryId),
    tenantStatusIdx: index('blog_haro_pitches_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

export type BlogHaroPitch = typeof blogHaroPitches.$inferSelect;
export type NewBlogHaroPitch = typeof blogHaroPitches.$inferInsert;

// ---------------------------------------------------------------------------
// blog_outreach_threads — one conversation per recipient (US-BLOG-057/060)
// ---------------------------------------------------------------------------
export const blogOutreachThreads = pgTable(
  'blog_outreach_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Optional prospect this thread came from. FK enforced in the migration. */
    prospectId: uuid('prospect_id'),
    /** Optional brand mention this thread came from (US-BLOG-057). FK in migration. */
    brandMentionId: uuid('brand_mention_id'),
    postId: uuid('post_id'),
    recipientEmail: varchar('recipient_email', { length: 320 }).notNull(),
    recipientName: varchar('recipient_name', { length: 200 }),
    subject: varchar('subject', { length: 500 }),
    /** Template + angle drive the per-template/angle engagement metrics (US-BLOG-060). */
    templateKey: varchar('template_key', { length: 120 }),
    angle: varchar('angle', { length: 200 }),
    /** draft | queued | sent | replied | closed. */
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    /** Cadence: follow-up 1 at +5d, follow-up 2 at +10d, then close (US-BLOG-060). */
    followupCount: integer('followup_count').notNull().default(0),
    lastActionAt: timestamp('last_action_at'),
    nextActionAt: timestamp('next_action_at'),
    closedReason: varchar('closed_reason', { length: 60 }), // no_response | declined | link_added | manual
    /** Research bundle the agent gathered about the recipient (US-BLOG-060). */
    research: jsonb('research'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_outreach_threads_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('blog_outreach_threads_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    prospectIdx: index('blog_outreach_threads_prospect_idx').on(table.prospectId),
    nextActionIdx: index('blog_outreach_threads_next_action_idx').on(
      table.tenantId,
      table.nextActionAt,
    ),
  }),
);

export type BlogOutreachThread = typeof blogOutreachThreads.$inferSelect;
export type NewBlogOutreachThread = typeof blogOutreachThreads.$inferInsert;

// ---------------------------------------------------------------------------
// blog_outreach_messages — in/out messages within a thread (US-BLOG-060)
// ---------------------------------------------------------------------------
export const blogOutreachMessages = pgTable(
  'blog_outreach_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Parent thread. FK enforced in the migration. */
    threadId: uuid('thread_id').notNull(),
    /** in | out. */
    direction: varchar('direction', { length: 8 }).notNull(),
    subject: varchar('subject', { length: 500 }),
    body: text('body').notNull(),
    /** Outbound: initial | followup_1 | followup_2. */
    kind: varchar('kind', { length: 24 }),
    /** Inbound LLM classification: interested | decline | question | out_of_office | unknown. */
    classification: varchar('classification', { length: 24 }),
    /** Proposed next action from the reply classifier (US-BLOG-060). */
    proposedNextAction: text('proposed_next_action'),
    sentAt: timestamp('sent_at'),
    receivedAt: timestamp('received_at'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_outreach_messages_tenant_idx').on(table.tenantId),
    threadIdx: index('blog_outreach_messages_thread_idx').on(table.threadId),
    tenantDirectionIdx: index('blog_outreach_messages_tenant_direction_idx').on(
      table.tenantId,
      table.direction,
    ),
  }),
);

export type BlogOutreachMessage = typeof blogOutreachMessages.$inferSelect;
export type NewBlogOutreachMessage = typeof blogOutreachMessages.$inferInsert;
