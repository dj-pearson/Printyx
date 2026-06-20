/**
 * Blog Content Platform Schema — the "universal content platform" cluster.
 *
 * Five capabilities, each backed by its own table(s). FKs are enforced ONLY in
 * the backfill migration (drizzle/migrations/_backfill_blog_content_platform.sql),
 * matching the blog module convention (see shared/blog-syndication-schema.ts and
 * shared/blog-authoring-tools-schema.ts).
 *
 * Stories / tables:
 *   US-BLOG-042  CMS publish flow via adapter
 *                blog_publish_attempts   — per-attempt, per-stage publish record
 *                                          (images_uploaded → body_rewritten →
 *                                          post_created/updated → webhook_fired);
 *                                          makes partial-publish state visible +
 *                                          retryable. Canonical URL itself lands
 *                                          on blog_posts.canonical_url (existing).
 *   US-BLOG-074  Programmatic SEO: templated pages from data
 *                blog_pseo_templates      — markdown template + {{var}} bindings,
 *                                           SEO config, brand voice, CMS target.
 *                blog_pseo_jobs           — bulk render/publish job + progress +
 *                                           rate-limit metadata.
 *                blog_pseo_rows           — one rendered row per template+data row,
 *                                           with SEO score + quality-gate verdict.
 *   US-BLOG-075  Interactive content blocks
 *                blog_interactive_blocks  — block spec (inputs, formula/scoring,
 *                                           result config) as jsonb; SAFE eval.
 *                blog_interactive_events  — completion/share/conversion + lead
 *                                           capture events for engagement metrics.
 *   US-BLOG-076  Multimodal output (podcast TTS / video script / social clips)
 *                blog_media_outputs       — one row per generated output, linked
 *                                           to the source post + an optional asset.
 *   US-BLOG-077  Localization + translation pipeline
 *                blog_locales             — per-workspace enabled locales + voice.
 *                blog_glossary_terms      — do-not-translate terms (brand/product).
 *                blog_post_translations   — per-locale title/body + own status,
 *                                           reviewer, publish_date. NEVER auto-
 *                                           published (machine translation = draft).
 *
 * Reuses existing blog tables — does NOT recreate them:
 *   blog_posts            — publish/translation/pseo/media all reference post_id;
 *                           canonical_url/cms_target_key/cms_post_id/cms_post_url/
 *                           status columns are read+written by the publish flow.
 *   blog_assets           — uploaded CMS images + media outputs (podcast mp3,
 *                           audiogram specs) land here.
 *   blog_distribution_targets — CMS adapter creds (encrypted_config); resolved by
 *                           cms_target_key. The pseo + publish flows write to it.
 *   blog_data_assets      — datasets driving programmatic SEO (US-BLOG-074).
 *   blog_brand_voices     — per-locale + per-template brand voice variants.
 *
 * Conventions (match shared/blog-schema.ts):
 *   - tenant_id: varchar NOT NULL with index
 *   - created_by_user_id: varchar
 *   - Blog-internal IDs: uuid
 *   - JSONB for flexible spec/metadata bags
 *   - Soft-delete via deleted_at on user-facing entities
 *   - Enums kept as plain varchar columns; validated in the edge fn via Zod.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ===========================================================================
// US-BLOG-042 — CMS publish flow
// ===========================================================================

/**
 * Status workflow enforced on blog_posts.status before publishing:
 *   draft → in_review → approved → published
 * (blog_posts.status historically uses 'draft|in_review|scheduled|published|
 * archived'; we treat 'scheduled' as an approved-equivalent gate. The publish
 * endpoint validates the transition.)
 */
export const PUBLISH_WORKFLOW_STATUSES = ['draft', 'in_review', 'approved', 'published'] as const;
export type PublishWorkflowStatus = (typeof PUBLISH_WORKFLOW_STATUSES)[number];

/** Stages a publish attempt advances through; the last reached stage is persisted. */
export const PUBLISH_STAGES = [
  'started',
  'images_uploaded',
  'body_rewritten',
  'post_created',
  'post_updated',
  'canonical_saved',
  'webhook_fired',
  'succeeded',
  'failed',
] as const;
export type PublishStage = (typeof PUBLISH_STAGES)[number];

export const PUBLISH_ATTEMPT_STATUSES = ['in_progress', 'succeeded', 'failed'] as const;
export type PublishAttemptStatus = (typeof PUBLISH_ATTEMPT_STATUSES)[number];

/**
 * blog_publish_attempts — one row per publish attempt, tracking each stage so a
 * partial publish (images uploaded but post creation failed) is visible and the
 * retry path is idempotent (retries key on blog_posts.cms_post_id, never create
 * duplicates). `stage_log` is an append-only array of { stage, at, detail }.
 */
export const blogPublishAttempts = pgTable(
  'blog_publish_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Source post. FK enforced in the backfill migration (blog_posts.id). */
    postId: uuid('post_id').notNull(),
    /** CMS adapter platform (wordpress|ghost). Resolved via blog_distribution_targets. */
    cmsPlatform: varchar('cms_platform', { length: 40 }),
    /** blog_distribution_targets.id used for this attempt. */
    cmsTargetId: uuid('cms_target_id'),
    /** 'create' or 'update' — update when the post already has cms_post_id. */
    operation: varchar('operation', { length: 16 }).notNull().default('create'),
    /** External CMS post id (idempotency key — retries update, never re-create). */
    cmsPostId: varchar('cms_post_id', { length: 200 }),
    cmsPostUrl: text('cms_post_url'),
    canonicalUrl: text('canonical_url'),
    /** Furthest stage reached this attempt; see PUBLISH_STAGES. */
    stage: varchar('stage', { length: 24 }).notNull().default('started'),
    status: varchar('status', { length: 16 }).notNull().default('in_progress'),
    /** [{ asset_id, original_url, cms_asset_id, cms_url }] — uploaded-image map. */
    uploadedAssets: jsonb('uploaded_assets'),
    /** Append-only [{ stage, at, detail }] timeline for the retry/partial UI. */
    stageLog: jsonb('stage_log'),
    /** Webhook dispatch intent (US-BLOG-079 owns the real bus): { url, payload, dispatched }. */
    webhookIntent: jsonb('webhook_intent'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    finishedAt: timestamp('finished_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_publish_attempts_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_publish_attempts_tenant_post_idx').on(table.tenantId, table.postId),
  }),
);

export type BlogPublishAttempt = typeof blogPublishAttempts.$inferSelect;
export type NewBlogPublishAttempt = typeof blogPublishAttempts.$inferInsert;

// ===========================================================================
// US-BLOG-074 — Programmatic SEO
// ===========================================================================

export const PSEO_JOB_STATUSES = [
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
] as const;
export type PseoJobStatus = (typeof PSEO_JOB_STATUSES)[number];

export const PSEO_JOB_MODES = ['publish', 'update', 'unpublish'] as const;
export type PseoJobMode = (typeof PSEO_JOB_MODES)[number];

export const PSEO_ROW_STATUSES = [
  'pending',
  'rendered',
  'flagged', // SEO score < threshold → manual review
  'skipped', // below threshold and skip-mode chosen
  'published',
  'failed',
] as const;
export type PseoRowStatus = (typeof PSEO_ROW_STATUSES)[number];

/**
 * blog_pseo_templates — a markdown template with {{variables}} bound to columns
 * of a blog_data_asset, plus per-template SEO config, brand voice, and output
 * CMS target. One template + N data rows → N rendered posts.
 */
export const blogPseoTemplates = pgTable(
  'blog_pseo_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    name: varchar('name', { length: 300 }).notNull(),
    /** Source dataset. FK → blog_data_assets in the migration. */
    dataAssetId: uuid('data_asset_id').notNull(),
    /** Markdown body with {{column}} placeholders. */
    bodyTemplate: text('body_template').notNull(),
    /** Slug pattern, e.g. "best-{{product}}-in-{{city}}". */
    slugPattern: varchar('slug_pattern', { length: 500 }).notNull(),
    /** SEO config: { title_pattern, meta_pattern, schema_type }. */
    seoConfig: jsonb('seo_config').notNull(),
    /** Optional brand voice. FK → blog_brand_voices in the migration. */
    brandVoiceId: uuid('brand_voice_id'),
    /** Output destination: cms_target_key → blog_distribution_targets / blog_posts.cms_target_key. */
    cmsTargetKey: varchar('cms_target_key', { length: 64 }),
    /** Minimum SEO score to auto-pass the quality gate (default 70 in the edge fn). */
    minSeoScore: integer('min_seo_score').notNull().default(70),
    /** What to do with rows below threshold: 'review' (flag) | 'skip'. */
    belowThresholdAction: varchar('below_threshold_action', { length: 12 })
      .notNull()
      .default('review'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_pseo_templates_tenant_idx').on(table.tenantId),
    tenantDataAssetIdx: index('blog_pseo_templates_tenant_data_asset_idx').on(
      table.tenantId,
      table.dataAssetId,
    ),
  }),
);

export type BlogPseoTemplate = typeof blogPseoTemplates.$inferSelect;
export type NewBlogPseoTemplate = typeof blogPseoTemplates.$inferInsert;

/**
 * blog_pseo_jobs — a bulk render/publish (or update/unpublish) run over a
 * template's dataset, with progress counters and rate-limit metadata
 * (rate_per_hour). Processing N rows per invocation; the job persists its
 * cursor so it can be resumed within the rate budget.
 */
export const blogPseoJobs = pgTable(
  'blog_pseo_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK → blog_pseo_templates in the migration. */
    templateId: uuid('template_id').notNull(),
    mode: varchar('mode', { length: 12 }).notNull().default('publish'),
    status: varchar('status', { length: 12 }).notNull().default('queued'),
    /** Rate limit (rows published per hour); default 50 (US-BLOG-074). */
    ratePerHour: integer('rate_per_hour').notNull().default(50),
    totalRows: integer('total_rows').notNull().default(0),
    processedRows: integer('processed_rows').notNull().default(0),
    publishedRows: integer('published_rows').notNull().default(0),
    flaggedRows: integer('flagged_rows').notNull().default(0),
    skippedRows: integer('skipped_rows').notNull().default(0),
    failedRows: integer('failed_rows').notNull().default(0),
    /** Index into the dataset rows for resume. */
    cursor: integer('cursor').notNull().default(0),
    /** Count published in the current rolling hour window + window start. */
    windowStartedAt: timestamp('window_started_at'),
    windowCount: integer('window_count').notNull().default(0),
    error: text('error'),
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_pseo_jobs_tenant_idx').on(table.tenantId),
    tenantTemplateIdx: index('blog_pseo_jobs_tenant_template_idx').on(
      table.tenantId,
      table.templateId,
    ),
    tenantStatusIdx: index('blog_pseo_jobs_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

export type BlogPseoJob = typeof blogPseoJobs.$inferSelect;
export type NewBlogPseoJob = typeof blogPseoJobs.$inferInsert;

/**
 * blog_pseo_rows — the rendered output for one (template, data row) pair, with
 * its SEO score, quality-gate verdict, and the resulting blog_posts.id once
 * published. Lets bulk update / unpublish target exactly the rows a data change
 * touched (keyed by row_key, a stable hash of the source row).
 */
export const blogPseoRows = pgTable(
  'blog_pseo_rows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK → blog_pseo_jobs in the migration. */
    jobId: uuid('job_id').notNull(),
    /** FK → blog_pseo_templates in the migration. */
    templateId: uuid('template_id').notNull(),
    /** Stable key identifying the source data row (for bulk update/unpublish). */
    rowKey: varchar('row_key', { length: 300 }).notNull(),
    /** The substituted variable bag for this row. */
    variables: jsonb('variables').notNull(),
    renderedTitle: varchar('rendered_title', { length: 500 }),
    renderedSlug: varchar('rendered_slug', { length: 500 }),
    renderedBody: text('rendered_body'),
    metaTitle: varchar('meta_title', { length: 300 }),
    metaDescription: text('meta_description'),
    seoScore: integer('seo_score'),
    /** [{ rule, ok, detail }] from the deterministic scorer. */
    seoFindings: jsonb('seo_findings'),
    status: varchar('status', { length: 12 }).notNull().default('pending'),
    /** Resulting published post. FK → blog_posts in the migration. */
    postId: uuid('post_id'),
    error: text('error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_pseo_rows_tenant_idx').on(table.tenantId),
    jobIdx: index('blog_pseo_rows_job_idx').on(table.jobId),
    templateRowIdx: index('blog_pseo_rows_template_row_idx').on(table.templateId, table.rowKey),
  }),
);

export type BlogPseoRow = typeof blogPseoRows.$inferSelect;
export type NewBlogPseoRow = typeof blogPseoRows.$inferInsert;

// ===========================================================================
// US-BLOG-075 — Interactive content blocks
// ===========================================================================

export const INTERACTIVE_BLOCK_TYPES = [
  'calculator',
  'quiz',
  'comparison',
  'roi_estimator',
] as const;
export type InteractiveBlockType = (typeof INTERACTIVE_BLOCK_TYPES)[number];

export const INTERACTIVE_EVENT_TYPES = [
  'view',
  'start',
  'complete',
  'share',
  'conversion',
  'lead_capture',
] as const;
export type InteractiveEventType = (typeof INTERACTIVE_EVENT_TYPES)[number];

/**
 * blog_interactive_blocks — a no-code spec for a calculator / quiz / comparison
 * tool / ROI estimator. `spec` jsonb holds inputs, the formula expression (or
 * quiz scoring), and result config. The formula is evaluated SERVER-SIDE with a
 * SAFE restricted-arithmetic parser — never eval (see edge fn formula-eval).
 */
export const blogInteractiveBlocks = pgTable(
  'blog_interactive_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Optional owning post. FK → blog_posts in the migration. */
    postId: uuid('post_id'),
    blockType: varchar('block_type', { length: 20 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    /**
     * Spec bag. Shape varies by block_type:
     *   calculator/roi_estimator: { inputs:[{key,label,type,default,min,max}],
     *                               formula:"(a*b)-c", outputs:[{key,label,expression,format}] }
     *   quiz:        { questions:[{id,text,options:[{label,score}]}],
     *                  results:[{min,max,title,body}] }
     *   comparison:  { items:[...], dimensions:[...] }
     */
    spec: jsonb('spec').notNull(),
    /** Email gate before showing the result (US-BLOG-075 lead capture). */
    leadCaptureEnabled: boolean('lead_capture_enabled').notNull().default(false),
    leadCaptureCopy: text('lead_capture_copy'),
    /** 'iframe' | 'inline'. */
    embedMode: varchar('embed_mode', { length: 12 }).notNull().default('iframe'),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_interactive_blocks_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_interactive_blocks_tenant_post_idx').on(
      table.tenantId,
      table.postId,
    ),
    tenantTypeIdx: index('blog_interactive_blocks_tenant_type_idx').on(
      table.tenantId,
      table.blockType,
    ),
  }),
);

export type BlogInteractiveBlock = typeof blogInteractiveBlocks.$inferSelect;
export type NewBlogInteractiveBlock = typeof blogInteractiveBlocks.$inferInsert;

/**
 * blog_interactive_events — engagement + lead-capture events for a block, used
 * to compute completion / share / conversion rates per tool.
 */
export const blogInteractiveEvents = pgTable(
  'blog_interactive_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK → blog_interactive_blocks in the migration. */
    blockId: uuid('block_id').notNull(),
    eventType: varchar('event_type', { length: 20 }).notNull(),
    /** Anonymous session id (client-generated) for funnel grouping. */
    sessionId: varchar('session_id', { length: 100 }),
    /** Captured lead email when event_type='lead_capture'. */
    leadEmail: varchar('lead_email', { length: 320 }),
    /** Submitted inputs / computed outputs / share target. */
    payload: jsonb('payload'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_interactive_events_tenant_idx').on(table.tenantId),
    blockIdx: index('blog_interactive_events_block_idx').on(table.blockId),
    blockTypeIdx: index('blog_interactive_events_block_type_idx').on(
      table.blockId,
      table.eventType,
    ),
  }),
);

export type BlogInteractiveEvent = typeof blogInteractiveEvents.$inferSelect;
export type NewBlogInteractiveEvent = typeof blogInteractiveEvents.$inferInsert;

// ===========================================================================
// US-BLOG-076 — Multimodal output (podcast / video script / social clip)
// ===========================================================================

export const MEDIA_OUTPUT_TYPES = ['podcast', 'video_script', 'social_clip'] as const;
export type MediaOutputType = (typeof MEDIA_OUTPUT_TYPES)[number];

export const MEDIA_OUTPUT_STATUSES = [
  'pending', // spec built, generation not yet run
  'processing', // adapter generating
  'ready', // asset available
  'failed',
] as const;
export type MediaOutputStatus = (typeof MEDIA_OUTPUT_STATUSES)[number];

/**
 * blog_media_outputs — one generated multimodal artifact per (post, type).
 * Podcasts carry chapter markers (from H2s) + an audio asset; video scripts
 * carry structured beats; social clips carry 30-60s clip specs for audiograms.
 * The produced media file is stored as a blog_assets row (asset_ref → its id);
 * `spec` holds the script/markers/clip metadata.
 */
export const blogMediaOutputs = pgTable(
  'blog_media_outputs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Source post. FK → blog_posts in the migration. */
    postId: uuid('post_id').notNull(),
    outputType: varchar('output_type', { length: 20 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    /** Optional produced media file. FK → blog_assets in the migration. */
    assetRef: uuid('asset_ref'),
    /**
     * Type-specific payload:
     *   podcast:      { script, chapters:[{title,start_sec}], voice_id, mp3_url, duration_sec }
     *   video_script: { beats:[{scene,voiceover,on_screen,broll}], avatar_provider }
     *   social_clip:  { clips:[{platform,headline,quote,runtime_sec,caption}] }
     */
    spec: jsonb('spec'),
    /** TTS/avatar adapter key (elevenlabs|playht|heygen|synthesia). */
    adapter: varchar('adapter', { length: 40 }),
    /** Voice-clone gate (US-BLOG-076): only narrate with a cloned voice if true. */
    voiceLicensed: boolean('voice_licensed').notNull().default(false),
    /** Author whose voice license was checked. */
    authorId: uuid('author_id'),
    error: text('error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_media_outputs_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_media_outputs_tenant_post_idx').on(table.tenantId, table.postId),
    tenantTypeIdx: index('blog_media_outputs_tenant_type_idx').on(table.tenantId, table.outputType),
  }),
);

export type BlogMediaOutput = typeof blogMediaOutputs.$inferSelect;
export type NewBlogMediaOutput = typeof blogMediaOutputs.$inferInsert;

// ===========================================================================
// US-BLOG-077 — Localization + translation pipeline
// ===========================================================================

export const TRANSLATION_STATUSES = ['draft', 'in_review', 'published'] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

/**
 * blog_locales — locales enabled for a workspace (en-US, es-MX, de-DE, ...),
 * each with an optional per-locale brand voice variant and a default flag.
 */
export const blogLocales = pgTable(
  'blog_locales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** BCP-47 locale tag, e.g. 'en-US', 'es-MX', 'de-DE'. */
    locale: varchar('locale', { length: 16 }).notNull(),
    displayName: varchar('display_name', { length: 120 }),
    /** Per-locale brand voice variant. FK → blog_brand_voices in the migration. */
    brandVoiceId: uuid('brand_voice_id'),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_locales_tenant_idx').on(table.tenantId),
    tenantLocaleIdx: index('blog_locales_tenant_locale_idx').on(table.tenantId, table.locale),
  }),
);

export type BlogLocale = typeof blogLocales.$inferSelect;
export type NewBlogLocale = typeof blogLocales.$inferInsert;

/**
 * blog_glossary_terms — workspace glossary of terms that must NOT be translated
 * (brand / product names), optionally with a forced per-locale rendering.
 */
export const blogGlossaryTerms = pgTable(
  'blog_glossary_terms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    term: varchar('term', { length: 300 }).notNull(),
    /** 'do_not_translate' | 'force' (force a specific translation). */
    mode: varchar('mode', { length: 20 }).notNull().default('do_not_translate'),
    /** When mode='force': { 'es-MX': 'Impresora', ... }. */
    translations: jsonb('translations'),
    caseSensitive: boolean('case_sensitive').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_glossary_terms_tenant_idx').on(table.tenantId),
    tenantTermIdx: index('blog_glossary_terms_tenant_term_idx').on(table.tenantId, table.term),
  }),
);

export type BlogGlossaryTerm = typeof blogGlossaryTerms.$inferSelect;
export type NewBlogGlossaryTerm = typeof blogGlossaryTerms.$inferInsert;

/**
 * blog_post_translations — a per-locale translation of a post with its OWN
 * status / reviewer / publish_date. Machine translation always lands as 'draft'
 * with requires_review=true; translations are NEVER auto-published.
 */
export const blogPostTranslations = pgTable(
  'blog_post_translations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Source post. FK → blog_posts in the migration. */
    postId: uuid('post_id').notNull(),
    locale: varchar('locale', { length: 16 }).notNull(),
    translatedTitle: varchar('translated_title', { length: 500 }),
    translatedBody: text('translated_body'),
    translatedMetaTitle: varchar('translated_meta_title', { length: 300 }),
    translatedMetaDescription: text('translated_meta_description'),
    /** Per-locale slug for hreflang/sitemap URLs. */
    translatedSlug: varchar('translated_slug', { length: 500 }),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    /** Machine translation forces a human review pass before publish. */
    requiresReview: boolean('requires_review').notNull().default(true),
    /** Translation provider used (deepl|google|gpt). */
    translationAdapter: varchar('translation_adapter', { length: 40 }),
    reviewerUserId: varchar('reviewer_user_id'),
    publishDate: timestamp('publish_date'),
    /** Canonical/CMS coordinates once published per-locale. */
    cmsPostId: varchar('cms_post_id', { length: 200 }),
    cmsPostUrl: text('cms_post_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_post_translations_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_post_translations_tenant_post_idx').on(table.tenantId, table.postId),
    postLocaleIdx: index('blog_post_translations_post_locale_idx').on(table.postId, table.locale),
  }),
);

export type BlogPostTranslation = typeof blogPostTranslations.$inferSelect;
export type NewBlogPostTranslation = typeof blogPostTranslations.$inferInsert;
