/**
 * Blog Authoring Tools Schema — in-editor research, rewrite, QA, media, and
 * diagram tooling for drafts.
 *
 * Covers the authoring-tools cluster (US-BLOG-029, 032, 034, 035, 037, 038).
 * New tables (FKs enforced only in the backfill migration, matching the blog
 * module convention):
 *
 *   blog_data_assets   — datasets behind charts/tables (US-BLOG-029/038)
 *   blog_chart_specs   — persisted chart/diagram specs rendered from a dataset
 *   blog_content_scans — plagiarism + AI-detection scan results (US-BLOG-034)
 *   blog_factcheck_runs— claim-extraction + verification jobs (US-BLOG-037)
 *
 * Reuses existing blog tables — does NOT recreate them:
 *   blog_assets   — generated/stock images and diagrams land here
 *                   (asset_type 'image' | 'diagram'); alt text + attribution.
 *   blog_citations— data-source URLs and chart sources are stored as citations.
 *   blog_posts    — scans/factcheck/charts reference post_id.
 *   blog_brand_voices — the inline-rewrite toolbar (US-BLOG-032) reads voice.
 *   blog_ai_costs — AI/scan spend is logged there; per-scan cost also denormalized
 *                   onto blog_content_scans.cost_cents.
 *
 * Conventions (match shared/blog-schema.ts):
 *   - tenant_id: varchar NOT NULL with index
 *   - created_by_user_id: varchar
 *   - Blog-internal IDs: uuid
 *   - JSONB for flexible metadata bags
 *   - Soft-delete via deleted_at on user-facing entities (data assets, chart specs)
 *
 * Re-exported intentionally NOT wired into shared/schema.ts here (separate file,
 * matching shared/blog-syndication-schema.ts); add the re-export when the module
 * is registered. The backfill migration creates the tables directly.
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

// ---------------------------------------------------------------------------
// Enum-ish string unions — validated in the edge function via Zod (no pg enum,
// matching the blog module convention so new values ship without a migration).
// ---------------------------------------------------------------------------

/** Where a dataset came from (US-BLOG-029). */
export const DATA_ASSET_SOURCE_TYPES = [
  'csv', // inline CSV text upload
  'google_sheet', // adapter stub
  'internal_view', // read-only Postgres view, per-workspace creds (encrypted marker)
  'public_api', // adapter stub
] as const;
export type DataAssetSourceType = (typeof DATA_ASSET_SOURCE_TYPES)[number];

/** Chart/diagram render kinds (US-BLOG-029 charts + US-BLOG-038 diagrams). */
export const CHART_SPEC_TYPES = [
  'bar',
  'line',
  'pie',
  'scatter',
  'mermaid', // US-BLOG-038 mermaid block
  'excalidraw', // US-BLOG-038 excalidraw embed
] as const;
export type ChartSpecType = (typeof CHART_SPEC_TYPES)[number];

/** Content-scan kinds (US-BLOG-034). */
export const CONTENT_SCAN_TYPES = ['plagiarism', 'ai_detection'] as const;
export type ContentScanType = (typeof CONTENT_SCAN_TYPES)[number];

/** Fact-check job lifecycle (US-BLOG-037). */
export const FACTCHECK_RUN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;
export type FactcheckRunStatus = (typeof FACTCHECK_RUN_STATUSES)[number];

// ---------------------------------------------------------------------------
// blog_data_assets — datasets behind charts/tables (US-BLOG-029, 038)
// ---------------------------------------------------------------------------
// One dataset per row. Small datasets store their parsed rows inline in `rows`
// (jsonb); large/external ones store only row_count and re-fetch on refresh.
// `columns` holds column metadata: [{ name, type: 'string'|'number'|'date' }].
// For internal_view sources we store an encrypted connection marker in
// `encrypted_config` (never returned to the client) — secrets stay server-side.
export const blogDataAssets = pgTable(
  'blog_data_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Optional owning post (datasets can be workspace-level and reused). */
    postId: uuid('post_id'),
    name: varchar('name', { length: 300 }).notNull(),
    sourceType: varchar('source_type', { length: 20 }).notNull(), // see DATA_ASSET_SOURCE_TYPES
    /** Source reference: sheet URL, API endpoint, view name, or upload filename. */
    sourceRef: text('source_ref'),
    /** Column metadata: [{ name, type }]. */
    columns: jsonb('columns'),
    /** Parsed rows for inline datasets (CSV uploads, small results). NULL for external. */
    rows: jsonb('rows'),
    rowCount: integer('row_count'),
    /**
     * Encrypted per-workspace connection config for internal_view / private API
     * sources (credential vault envelope). NEVER returned to the client — the
     * edge fn returns a `credentials_set: boolean` marker instead.
     */
    encryptedConfig: jsonb('encrypted_config'),
    /** Stored as a blog_citations row; this is the citation id for the source URL. */
    citationId: uuid('citation_id'),
    refreshedAt: timestamp('refreshed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_data_assets_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_data_assets_tenant_post_idx').on(table.tenantId, table.postId),
  }),
);

export type BlogDataAsset = typeof blogDataAssets.$inferSelect;
export type NewBlogDataAsset = typeof blogDataAssets.$inferInsert;

// ---------------------------------------------------------------------------
// blog_chart_specs — persisted chart/diagram specs (US-BLOG-029, 038)
// ---------------------------------------------------------------------------
// A chart spec is a serializable description the client renders to SVG and the
// server renders to PNG (for email/AMP). For mermaid/excalidraw diagrams the
// `source` block carries the raw source so the block stays editable later.
// On insert we also create the corresponding blog_assets row (image/diagram)
// and link it via asset_id so the rendered output lives with other media.
export const blogChartSpecs = pgTable(
  'blog_chart_specs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    postId: uuid('post_id'),
    /** NULL for mermaid/excalidraw diagrams that aren't data-driven. */
    dataAssetId: uuid('data_asset_id'),
    chartType: varchar('chart_type', { length: 20 }).notNull(), // see CHART_SPEC_TYPES
    title: varchar('title', { length: 500 }),
    /** Axes/series/colors config for data charts: { x, y[], series?, colors? }. */
    spec: jsonb('spec'),
    /** Raw editable source for diagrams: { mermaid_text } | { excalidraw_json } | { csv }. */
    source: jsonb('source'),
    /** LLM-generated description used to derive alt text. */
    description: text('description'),
    altText: text('alt_text'),
    /** blog_assets row holding the rendered SVG/PNG (asset_type image|diagram). */
    assetId: uuid('asset_id'),
    /** Placeholder ref for the server-side PNG fallback (stubbed render). */
    pngRef: varchar('png_ref', { length: 1000 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_chart_specs_tenant_idx').on(table.tenantId),
    tenantPostIdx: index('blog_chart_specs_tenant_post_idx').on(table.tenantId, table.postId),
    dataAssetIdx: index('blog_chart_specs_data_asset_idx').on(table.dataAssetId),
  }),
);

export type BlogChartSpec = typeof blogChartSpecs.$inferSelect;
export type NewBlogChartSpec = typeof blogChartSpecs.$inferInsert;

// ---------------------------------------------------------------------------
// blog_content_scans — plagiarism + AI-detection results (US-BLOG-034)
// ---------------------------------------------------------------------------
// One row per scan run. `score` semantics depend on scan_type:
//   plagiarism   → originality percent (0-100); matches[] = [{ url, percent }]
//   ai_detection → AI-likelihood percent (0-100)
// cost_cents logs the third-party scan spend (also mirrored to blog_ai_costs).
// passed reflects the run against the workspace threshold at scan time.
export const blogContentScans = pgTable(
  'blog_content_scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    postId: uuid('post_id').notNull(),
    scanType: varchar('scan_type', { length: 20 }).notNull(), // see CONTENT_SCAN_TYPES
    provider: varchar('provider', { length: 40 }), // copyscape | originality_ai | gptzero | stub
    /** Percent (0-100): originality% for plagiarism, AI-likelihood% for ai_detection. */
    score: integer('score'),
    /** Matched sources for plagiarism: [{ url, percent, snippet }]. */
    matches: jsonb('matches'),
    /** Threshold used to evaluate pass/fail at scan time. */
    thresholdPct: integer('threshold_pct'),
    passed: boolean('passed'),
    costCents: integer('cost_cents').notNull().default(0),
    createdByUserId: varchar('created_by_user_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_content_scans_tenant_idx').on(table.tenantId),
    postIdx: index('blog_content_scans_post_idx').on(table.postId),
    tenantTypeIdx: index('blog_content_scans_tenant_type_idx').on(table.tenantId, table.scanType),
  }),
);

export type BlogContentScan = typeof blogContentScans.$inferSelect;
export type NewBlogContentScan = typeof blogContentScans.$inferInsert;

// ---------------------------------------------------------------------------
// blog_factcheck_runs — claim-extraction + verification jobs (US-BLOG-037)
// ---------------------------------------------------------------------------
// Long posts run as a server-side job so the editor can poll for results.
// `claims` is the verified array once status='completed':
//   [{ text, offsets:{start,end}, citation_id|null, verdict, confidence,
//      color, source_excerpt }]
// flaggedCount counts <70%-confidence claims that need a human.
export const blogFactcheckRuns = pgTable(
  'blog_factcheck_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    postId: uuid('post_id').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('queued'), // see FACTCHECK_RUN_STATUSES
    claims: jsonb('claims'),
    claimCount: integer('claim_count'),
    flaggedCount: integer('flagged_count'),
    error: text('error'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdByUserId: varchar('created_by_user_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_factcheck_runs_tenant_idx').on(table.tenantId),
    postIdx: index('blog_factcheck_runs_post_idx').on(table.postId),
    statusIdx: index('blog_factcheck_runs_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

export type BlogFactcheckRun = typeof blogFactcheckRuns.$inferSelect;
export type NewBlogFactcheckRun = typeof blogFactcheckRuns.$inferInsert;
