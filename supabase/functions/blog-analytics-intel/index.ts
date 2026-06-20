// Blog Analytics & Answer-Engine Intelligence Edge Function (US-BLOG-061, 065, 067, 068, 069)
//
// One edge function backing the "answer-engine / analytics intel" cluster:
//
//   US-BLOG-061  GA4 + Search Console integration
//                - per-workspace OAuth connect (encrypted tokens, *_set markers)
//                - GA4 / GSC metric ingest → EXISTING blog_performance_metrics
//                - 16mo GSC / 90d GA4 backfill on connect
//                - per-post trend (28d / 90d / all-time)
//   US-BLOG-065  Cohort analysis: topic → revenue/signups
//                - per-workspace conversion + attribution config
//                - cluster cohort table (sessions → conversions → revenue)
//                - time-to-conversion histogram + ROI per cluster
//   US-BLOG-067  LLM citation graph analyzer (ChatGPT/Perplexity/Google AIO)
//                - weekly probes per cluster (adapter stubs; injectable results)
//                - 'share of voice' per cluster + per-post citation count
//                - SERP-vs-AI diff opportunity list
//   US-BLOG-068  Answer-Engine Optimization chunk structuring
//                - pre-publish AEO score (deterministic + LLM-assisted checks)
//                - vague-paragraph rewrite suggestions (LLM)
//                - 'Quick answers' section + Schema.org QAPage/FAQPage JSON-LD
//   US-BLOG-069  Domain knowledge graph of entities and relationships
//                - LLM NER over published posts → entities + co-occurrence edges
//                - force-directed visualizer data
//                - competitor gap detector → feeds keyword cluster planning
//
// External services (GA4 Data API, Search Console API, OAuth, ChatGPT-search /
// Perplexity / Google AI Overview probes) all live behind clearly-named adapter
// stub functions with TODOs. Every such endpoint ALSO accepts injected
// metrics/probe-results/entities in the request body so the closed loop is
// testable without live credentials. All results are persisted.
//
// Per-post GA4/GSC metrics are written into the EXISTING blog_performance_metrics
// table (source='ga4' | 'search_console'); no new per-post-metric table.
//
// Auth/permission gate (any of): isPlatformAdmin OR perms includes
// 'blog.analytics.view' / 'blog.post.edit' OR role platform_admin/super_admin/
// company_admin.
//
// Routes (tenant-scoped):
//   GA4 / Search Console (US-BLOG-061)
//     GET    /blog-analytics-intel/connections                       list connections (*_set markers)
//     POST   /blog-analytics-intel/connections                       connect/upsert a property (encrypts tokens)
//     DELETE /blog-analytics-intel/connections/:id                   soft-delete a connection
//     POST   /blog-analytics-intel/metrics/ingest                    body { provider, rows[] | sync? } → blog_performance_metrics
//     POST   /blog-analytics-intel/metrics/backfill                  body { provider, rows[]? } 16mo GSC / 90d GA4
//     GET    /blog-analytics-intel/posts/:postId/trend?window=28d|90d|all  per-post trend chart data
//   Cohort analysis (US-BLOG-065)
//     GET    /blog-analytics-intel/conversion-config                 current config
//     PUT    /blog-analytics-intel/conversion-config                 upsert config
//     POST   /blog-analytics-intel/cohorts/compute                   body { period, attribution_model?, clusters[]? } compute + persist
//     GET    /blog-analytics-intel/cohorts?period=                   cohort table data
//   LLM citation graph (US-BLOG-067)
//     POST   /blog-analytics-intel/citations/probe                   body { cluster_id?, queries[]?, engines[]?, results[]? } run/ingest probes
//     GET    /blog-analytics-intel/citations/share-of-voice?cluster_id=  share-of-voice dashboard
//     GET    /blog-analytics-intel/citations/opportunities           SERP-top10-but-not-cited diff list
//   AEO (US-BLOG-068)
//     POST   /blog-analytics-intel/aeo/score                         body { post_id, suggest?, quick_answers? } score + persist
//     GET    /blog-analytics-intel/aeo/score?post_id=                latest AEO score for a post
//   Knowledge graph (US-BLOG-069)
//     POST   /blog-analytics-intel/kg/extract                        body { post_id, entities?, competitor_entities? } NER + edges
//     GET    /blog-analytics-intel/kg/graph                          force-directed nodes+edges
//     GET    /blog-analytics-intel/kg/gaps                           competitor entity gap list

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonObject } from '../_shared/blog/llm-json.ts';
import { encryptCredential } from '../_shared/credential-vault.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const ANALYTICS_PROVIDERS = ['ga4', 'search_console'] as const;
const CONVERSION_KINDS = ['signup', 'purchase', 'demo_request'] as const;
const ATTRIBUTION_MODELS = ['last_non_direct', 'first_touch', 'linear'] as const;
const LLM_ENGINES = ['chatgpt_search', 'perplexity', 'google_ai_overview'] as const;
const KG_ENTITY_TYPES = [
  'person',
  'organization',
  'product',
  'concept',
  'location',
  'date',
] as const;

// ===========================================================================
// Auth / permission gate
// ===========================================================================
function hasAnalyticsAccess(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.analytics.view') || perms.includes('blog.post.edit'))
  ) {
    return true;
  }
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function resolveTenantId(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string | null {
  return (
    (user.app_metadata?.tenantId as string) ||
    (user.app_metadata?.tenant_id as string) ||
    (user.user_metadata?.tenantId as string) ||
    (user.user_metadata?.tenant_id as string) ||
    null
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

/** Our own domain(s) for citation share-of-voice. Configurable via env. */
function ownDomains(): string[] {
  const raw = Deno.env.get('BLOG_OWN_DOMAINS') ?? 'printyx.net,www.printyx.net';
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isOwnDomainUrl(url: string): boolean {
  const host = hostnameOf(url);
  return ownDomains().some((d) => host === d || host.endsWith(`.${d}`));
}

async function parseJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function validationError(req: Request, error: z.ZodError): Response {
  return createCorsResponse({ error: 'Validation failed', details: error.flatten() }, 400, req);
}

// ===========================================================================
// ADAPTER STUBS — external services. Each returns injected data when provided
// (testability) and otherwise TODOs out to the real API.
// ===========================================================================

interface Ga4MetricRow {
  post_id: string;
  metric_date: string; // YYYY-MM-DD
  sessions?: number;
  users?: number;
  engagement_time_seconds?: number;
  conversions?: number;
}

interface GscMetricRow {
  post_id: string;
  metric_date: string; // YYYY-MM-DD
  clicks?: number;
  impressions?: number;
  ctr?: number; // 0..1
  position?: number;
}

/**
 * GA4 Data API adapter (US-BLOG-061). Pulls sessions/users/engagement_time/
 * conversions per post URL daily. Returns injected rows for tests.
 *
 * TODO: implement the real GA4 Data API (runReport) call using the connection's
 * decrypted access token + property id. Map page paths → blog_posts.id.
 */
async function ga4Adapter(
  _connection: Record<string, unknown> | null,
  opts: { injected?: Ga4MetricRow[]; lookbackDays?: number },
): Promise<Ga4MetricRow[]> {
  if (opts.injected && opts.injected.length) return opts.injected;
  // TODO: call GA4 Data API here. No live credentials → return empty.
  console.warn('ga4Adapter: no injected rows and live GA4 not wired (stub).');
  return [];
}

/**
 * Google Search Console adapter (US-BLOG-061). Pulls clicks/impressions/ctr/
 * position per post URL daily. Returns injected rows for tests.
 *
 * TODO: implement the real Search Console Search Analytics API query using the
 * connection's decrypted token + site URL. 16-month max window on backfill.
 */
async function searchConsoleAdapter(
  _connection: Record<string, unknown> | null,
  opts: { injected?: GscMetricRow[]; lookbackDays?: number },
): Promise<GscMetricRow[]> {
  if (opts.injected && opts.injected.length) return opts.injected;
  // TODO: call Search Console API here. No live credentials → return empty.
  console.warn('searchConsoleAdapter: no injected rows and live GSC not wired (stub).');
  return [];
}

interface ProbeCitation {
  cited_url: string;
  rank?: number;
}
interface ProbeResult {
  engine: (typeof LLM_ENGINES)[number];
  query: string;
  citations: ProbeCitation[];
  /** Optional: whether our domain ranks in classic SERP top-10 for this query. */
  in_serp_top10?: boolean;
}

/**
 * Answer-engine probe adapters (US-BLOG-067). Each takes a query and returns
 * the URLs cited in that engine's answer. Returns injected results for tests.
 *
 * TODO: wire real probes:
 *   chatgpt_search    → ChatGPT search / SearchGPT API
 *   perplexity        → Perplexity API (sonar online models return citations)
 *   google_ai_overview→ SERP provider that surfaces the AI Overview block
 */
async function runProbe(
  engine: (typeof LLM_ENGINES)[number],
  query: string,
  injected?: ProbeResult[],
): Promise<ProbeResult> {
  const match = injected?.find((r) => r.engine === engine && r.query === query);
  if (match) return match;
  // TODO: call the real engine. No live probe → empty citation set.
  console.warn(`runProbe(${engine}): live probe not wired (stub).`);
  return { engine, query, citations: [] };
}

/**
 * Competitor entity source (US-BLOG-069 gap detector). Accepts entities in the
 * request body, or TODO: scrape/ingest competitor coverage via an SEO adapter.
 */
function competitorEntitiesAdapter(
  injected?: Array<{ name: string; entity_type: string }>,
): Array<{ name: string; entity_type: string }> {
  if (injected && injected.length) return injected;
  // TODO: pull competitor entity coverage from an external SEO/SERP source.
  return [];
}

// ===========================================================================
// US-BLOG-061: connections (OAuth, encrypted tokens, *_set markers)
// ===========================================================================

const connectSchema = z.object({
  provider: z.enum(ANALYTICS_PROVIDERS),
  property_id: z.string().max(400).optional(),
  property_label: z.string().max(400).optional(),
  /** OAuth tokens to encrypt at rest. Never returned. */
  tokens: z
    .object({
      access_token: z.string().min(1).optional(),
      refresh_token: z.string().min(1).optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** Strip encrypted_config and surface *_set boolean markers instead. */
function safeConnection(row: Record<string, unknown>): Record<string, unknown> {
  const cfg = (row.encrypted_config as Record<string, unknown>) ?? {};
  const { encrypted_config: _omit, ...rest } = row;
  return {
    ...rest,
    access_token_set: Boolean(cfg.access_token),
    refresh_token_set: Boolean(cfg.refresh_token),
  };
}

async function listConnections(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_analytics_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('listConnections error', error);
    return createCorsResponse({ error: 'Failed to list connections' }, 500, req);
  }
  return createCorsResponse(
    { connections: (data ?? []).map((r) => safeConnection(r as Record<string, unknown>)) },
    200,
    req,
  );
}

async function upsertConnection(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseJson(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) return validationError(req, parsed.error);
  const { provider, property_id, property_label, tokens, metadata } = parsed.data;

  // Encrypt any provided tokens into the encrypted_config envelope.
  const encryptedConfig: Record<string, unknown> = {};
  if (tokens?.access_token) {
    encryptedConfig.access_token = await encryptCredential(tokens.access_token);
  }
  if (tokens?.refresh_token) {
    encryptedConfig.refresh_token = await encryptCredential(tokens.refresh_token);
  }
  const hasTokens = Object.keys(encryptedConfig).length > 0;

  // One connection per (tenant, provider, property): find existing, else insert.
  const { data: existing } = await admin
    .from('blog_analytics_connections')
    .select('id, encrypted_config')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .eq('property_id', property_id ?? '')
    .is('deleted_at', null)
    .maybeSingle();

  const now = new Date().toISOString();
  const writeCfg = hasTokens
    ? { ...((existing?.encrypted_config as Record<string, unknown>) ?? {}), ...encryptedConfig }
    : ((existing?.encrypted_config as Record<string, unknown>) ?? null);
  const connected = Boolean(writeCfg && Object.keys(writeCfg).length > 0);

  let row: Record<string, unknown> | null = null;
  if (existing) {
    const { data, error } = await admin
      .from('blog_analytics_connections')
      .update({
        property_label: property_label ?? null,
        encrypted_config: writeCfg,
        connected,
        status: connected ? 'connected' : 'disconnected',
        metadata: metadata ?? null,
        updated_at: now,
      })
      .eq('tenant_id', tenantId)
      .eq('id', existing.id)
      .select()
      .maybeSingle();
    if (error) return createCorsResponse({ error: 'Failed to update connection' }, 500, req);
    row = data as Record<string, unknown>;
  } else {
    const { data, error } = await admin
      .from('blog_analytics_connections')
      .insert({
        tenant_id: tenantId,
        provider,
        property_id: property_id ?? null,
        property_label: property_label ?? null,
        encrypted_config: hasTokens ? encryptedConfig : null,
        connected,
        status: connected ? 'connected' : 'disconnected',
        metadata: metadata ?? null,
        created_by_user_id: userId,
      })
      .select()
      .maybeSingle();
    if (error) return createCorsResponse({ error: 'Failed to create connection' }, 500, req);
    row = data as Record<string, unknown>;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_analytics_connection.upsert',
      targetType: 'blog_analytics_connection',
      targetId: (row?.id as string) ?? null,
      summary: `Connected ${provider} property`,
      afterState: { provider, property_id, connected },
    }),
  );

  return createCorsResponse({ connection: safeConnection(row ?? {}) }, 200, req);
}

async function deleteConnection(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_analytics_connections')
    .update({ deleted_at: new Date().toISOString(), connected: false, status: 'disconnected' })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to delete connection' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Connection not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_analytics_connection.delete',
      targetType: 'blog_analytics_connection',
      targetId: id,
      summary: 'Disconnected analytics property',
    }),
  );
  return createCorsResponse({ success: true }, 200, req);
}

// ---- Metric ingest → EXISTING blog_performance_metrics ----

const ga4RowSchema = z.object({
  post_id: z.string().uuid(),
  metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessions: z.number().int().nonnegative().optional(),
  users: z.number().int().nonnegative().optional(),
  engagement_time_seconds: z.number().nonnegative().optional(),
  conversions: z.number().int().nonnegative().optional(),
});
const gscRowSchema = z.object({
  post_id: z.string().uuid(),
  metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clicks: z.number().int().nonnegative().optional(),
  impressions: z.number().int().nonnegative().optional(),
  ctr: z.number().min(0).max(1).optional(),
  position: z.number().min(0).optional(),
});
const ingestSchema = z.object({
  provider: z.enum(ANALYTICS_PROVIDERS),
  /** When true, pull from the (stubbed) live adapter instead of injected rows. */
  sync: z.boolean().optional(),
  lookback_days: z.number().int().positive().max(490).optional(),
  ga4_rows: z.array(ga4RowSchema).optional(),
  gsc_rows: z.array(gscRowSchema).optional(),
});

/**
 * Upsert daily metrics into blog_performance_metrics (existing table). Keyed by
 * (post_id, metric_date, source) — we delete any prior same-key rows then insert
 * (no unique constraint exists on the table, so we emulate upsert).
 */
async function ingestMetrics(
  admin: Admin,
  tenantId: string,
  userId: string,
  req: Request,
  isBackfill: boolean,
) {
  const body = await parseJson(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) return validationError(req, parsed.error);
  const { provider } = parsed.data;

  const connection = await admin
    .from('blog_analytics_connections')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .is('deleted_at', null)
    .maybeSingle()
    .then((r) => (r.data as Record<string, unknown>) ?? null);

  // Backfill windows: 16 months GSC, 90 days GA4 (US-BLOG-061).
  const lookbackDays =
    parsed.data.lookback_days ?? (isBackfill ? (provider === 'search_console' ? 16 * 31 : 90) : 30);

  const performanceRows: Array<Record<string, unknown>> = [];

  if (provider === 'ga4') {
    const rows = await ga4Adapter(connection, {
      injected: parsed.data.ga4_rows,
      lookbackDays,
    });
    // Only accept rows for posts that belong to this tenant.
    const validPosts = await loadTenantPostIds(
      admin,
      tenantId,
      rows.map((r) => r.post_id),
    );
    for (const r of rows) {
      if (!validPosts.has(r.post_id)) continue;
      performanceRows.push({
        tenant_id: tenantId,
        post_id: r.post_id,
        metric_date: r.metric_date,
        source: 'ga4',
        pageviews: r.sessions ?? null,
        unique_visitors: r.users ?? null,
        avg_time_on_page_seconds:
          r.engagement_time_seconds != null ? Math.round(r.engagement_time_seconds) : null,
        conversions: r.conversions ?? null,
        raw_data: r,
      });
    }
  } else {
    const rows = await searchConsoleAdapter(connection, {
      injected: parsed.data.gsc_rows,
      lookbackDays,
    });
    const validPosts = await loadTenantPostIds(
      admin,
      tenantId,
      rows.map((r) => r.post_id),
    );
    for (const r of rows) {
      if (!validPosts.has(r.post_id)) continue;
      performanceRows.push({
        tenant_id: tenantId,
        post_id: r.post_id,
        metric_date: r.metric_date,
        source: 'search_console',
        impressions: r.impressions ?? null,
        clicks: r.clicks ?? null,
        ctr: r.ctr ?? null,
        position: r.position ?? null,
        raw_data: r,
      });
    }
  }

  let written = 0;
  if (performanceRows.length) {
    // Emulated upsert: clear existing same-key rows, then insert.
    for (const row of performanceRows) {
      await admin
        .from('blog_performance_metrics')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('post_id', row.post_id as string)
        .eq('metric_date', row.metric_date as string)
        .eq('source', row.source as string);
    }
    const { error: insErr, count } = await admin
      .from('blog_performance_metrics')
      .insert(performanceRows, { count: 'exact' });
    if (insErr) {
      console.error('ingestMetrics insert error', insErr);
      return createCorsResponse({ error: 'Failed to store metrics' }, 500, req);
    }
    written = count ?? performanceRows.length;
  }

  if (connection) {
    const stamp = isBackfill
      ? { last_backfill_at: new Date().toISOString(), last_synced_at: new Date().toISOString() }
      : { last_synced_at: new Date().toISOString() };
    await admin
      .from('blog_analytics_connections')
      .update(stamp)
      .eq('tenant_id', tenantId)
      .eq('id', connection.id as string);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: isBackfill ? 'blog_analytics_metrics.backfill' : 'blog_analytics_metrics.ingest',
      targetType: 'blog_performance_metrics',
      targetId: null,
      summary: `${isBackfill ? 'Backfilled' : 'Ingested'} ${written} ${provider} metric rows`,
      afterState: { provider, rows_written: written, lookback_days: lookbackDays },
    }),
  );

  return createCorsResponse(
    { provider, rows_written: written, lookback_days: lookbackDays },
    200,
    req,
  );
}

async function loadTenantPostIds(
  admin: Admin,
  tenantId: string,
  postIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(postIds.filter(Boolean))];
  if (!unique.length) return new Set();
  const { data } = await admin
    .from('blog_posts')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .in('id', unique);
  return new Set((data ?? []).map((r) => (r as { id: string }).id));
}

// ---- Per-post trend (28d / 90d / all-time) ----

async function postTrend(admin: Admin, tenantId: string, postId: string, url: URL, req: Request) {
  const window = url.searchParams.get('window') ?? '90d';
  const days = window === '28d' ? 28 : window === 'all' ? null : 90;

  // Confirm the post belongs to the tenant.
  const { data: post } = await admin
    .from('blog_posts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  let q = admin
    .from('blog_performance_metrics')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('metric_date', { ascending: true });
  if (days !== null) {
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    q = q.gte('metric_date', since);
  }
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to load trend' }, 500, req);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const ga4 = rows.filter((r) => r.source === 'ga4');
  const gsc = rows.filter((r) => r.source === 'search_console');
  // Per-post AI citation count surfaced alongside organic metrics (US-BLOG-067).
  const { count: aiCitationCount } = await admin
    .from('blog_llm_citations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .eq('is_own_domain', true);

  return createCorsResponse(
    {
      window,
      ga4_series: ga4.map((r) => ({
        date: r.metric_date,
        sessions: r.pageviews,
        users: r.unique_visitors,
        engagement_time_seconds: r.avg_time_on_page_seconds,
        conversions: r.conversions,
      })),
      search_console_series: gsc.map((r) => ({
        date: r.metric_date,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      ai_citation_count: aiCitationCount ?? 0,
    },
    200,
    req,
  );
}

// ===========================================================================
// US-BLOG-065: conversion config + cohort analysis
// ===========================================================================

const conversionConfigSchema = z.object({
  conversion_kind: z.enum(CONVERSION_KINDS),
  ga4_event_name: z.string().max(200).optional(),
  attribution_model: z.enum(ATTRIBUTION_MODELS).optional(),
  revenue_from_event_value: z.boolean().optional(),
  revenue_per_conversion_cents: z.number().int().nonnegative().optional(),
  writing_cost_per_post_cents: z.number().int().nonnegative().optional(),
  tools_cost_per_month_cents: z.number().int().nonnegative().optional(),
});

async function getConversionConfig(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_conversion_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to load config' }, 500, req);
  return createCorsResponse({ config: data ?? null }, 200, req);
}

async function putConversionConfig(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseJson(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = conversionConfigSchema.safeParse(body);
  if (!parsed.success) return validationError(req, parsed.error);
  const d = parsed.data;

  // Default-row uniqueness: clear other defaults in the same call.
  await admin
    .from('blog_conversion_config')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .is('deleted_at', null);

  const { data, error } = await admin
    .from('blog_conversion_config')
    .insert({
      tenant_id: tenantId,
      conversion_kind: d.conversion_kind,
      ga4_event_name: d.ga4_event_name ?? null,
      attribution_model: d.attribution_model ?? 'last_non_direct',
      revenue_from_event_value: d.revenue_from_event_value ?? true,
      revenue_per_conversion_cents: d.revenue_per_conversion_cents ?? null,
      writing_cost_per_post_cents: d.writing_cost_per_post_cents ?? null,
      tools_cost_per_month_cents: d.tools_cost_per_month_cents ?? null,
      is_default: true,
      created_by_user_id: userId,
    })
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to save config' }, 500, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_conversion_config.upsert',
      targetType: 'blog_conversion_config',
      targetId: (data?.id as string) ?? null,
      summary: `Set conversion=${d.conversion_kind}, attribution=${d.attribution_model ?? 'last_non_direct'}`,
      afterState: d,
    }),
  );
  return createCorsResponse({ config: data }, 200, req);
}

const cohortComputeSchema = z.object({
  period: z.string().max(32).default('90d'),
  attribution_model: z.enum(ATTRIBUTION_MODELS).optional(),
  cluster_ids: z.array(z.string().uuid()).optional(),
  /** Injected per-cluster cohort rows for testability. */
  rows: z
    .array(
      z.object({
        cluster_id: z.string().uuid(),
        sessions: z.number().int().nonnegative(),
        conversions: z.number().int().nonnegative(),
        revenue_cents: z.number().int().nonnegative().optional(),
        time_to_conversion_days: z.array(z.number().nonnegative()).optional(),
      }),
    )
    .optional(),
});

/** Bucket a list of days-to-conversion into a histogram (US-BLOG-065). */
function buildHistogram(days: number[]): {
  buckets: Array<{ label: string; days_min: number; days_max: number | null; count: number }>;
} {
  const edges: Array<[string, number, number | null]> = [
    ['0-1d', 0, 1],
    ['1-7d', 1, 7],
    ['7-30d', 7, 30],
    ['30-90d', 30, 90],
    ['90d+', 90, null],
  ];
  const buckets = edges.map(([label, min, max]) => ({
    label,
    days_min: min,
    days_max: max,
    count: days.filter((d) => d >= min && (max === null || d < max)).length,
  }));
  return { buckets };
}

async function computeCohorts(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = (await parseJson(req)) ?? {};
  const parsed = cohortComputeSchema.safeParse(body);
  if (!parsed.success) return validationError(req, parsed.error);
  const { period } = parsed.data;

  const cfg = await admin
    .from('blog_conversion_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .maybeSingle()
    .then((r) => (r.data as Record<string, unknown>) ?? null);
  const attribution =
    parsed.data.attribution_model ?? ((cfg?.attribution_model as string) || 'last_non_direct');
  const writingCost = (cfg?.writing_cost_per_post_cents as number) ?? 0;
  const toolsCost = (cfg?.tools_cost_per_month_cents as number) ?? 0;

  // Restrict to tenant clusters.
  let clusterQ = admin
    .from('blog_keyword_clusters')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  if (parsed.data.cluster_ids?.length) clusterQ = clusterQ.in('id', parsed.data.cluster_ids);
  const tenantClusters = new Set(
    (await clusterQ.then((r) => r.data ?? [])).map((c) => (c as { id: string }).id),
  );

  // Count posts per cluster for ROI cost basis (writing cost * posts).
  const postsByCluster = new Map<string, number>();
  if (tenantClusters.size) {
    const { data: posts } = await admin
      .from('blog_posts')
      .select('cluster_id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('cluster_id', [...tenantClusters]);
    for (const p of posts ?? []) {
      const cid = (p as { cluster_id: string | null }).cluster_id;
      if (cid) postsByCluster.set(cid, (postsByCluster.get(cid) ?? 0) + 1);
    }
  }

  const injected = parsed.data.rows ?? [];
  const computedAt = new Date().toISOString();
  const persisted: Array<Record<string, unknown>> = [];

  for (const row of injected) {
    if (!tenantClusters.has(row.cluster_id)) continue;
    const revenueCents = row.revenue_cents ?? 0;
    const histogram = buildHistogram(row.time_to_conversion_days ?? []);
    const postCount = postsByCluster.get(row.cluster_id) ?? 0;
    const costCents = writingCost * postCount + toolsCost;
    const roi = {
      cost_cents: costCents,
      revenue_cents: revenueCents,
      roi_ratio: costCents > 0 ? Number((revenueCents / costCents).toFixed(4)) : null,
    };

    const { data: inserted } = await admin
      .from('blog_cohort_metrics')
      .insert({
        tenant_id: tenantId,
        cluster_id: row.cluster_id,
        period,
        sessions: row.sessions,
        conversions: row.conversions,
        revenue_cents: revenueCents,
        signup_count: row.conversions,
        attribution_model: attribution,
        time_to_conversion_histogram: histogram,
        roi,
        computed_at: computedAt,
      })
      .select()
      .maybeSingle();
    if (inserted) persisted.push(inserted as Record<string, unknown>);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_cohort_metrics.compute',
      targetType: 'blog_cohort_metrics',
      targetId: null,
      summary: `Computed ${persisted.length} cohort rows (period=${period}, attribution=${attribution})`,
      afterState: { period, attribution, rows: persisted.length },
    }),
  );

  return createCorsResponse(
    { period, attribution_model: attribution, cohorts: persisted },
    200,
    req,
  );
}

async function listCohorts(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_cohort_metrics')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(500);
  const period = url.searchParams.get('period');
  if (period) q = q.eq('period', period);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list cohorts' }, 500, req);
  return createCorsResponse({ cohorts: data ?? [] }, 200, req);
}

// ===========================================================================
// US-BLOG-067: LLM citation graph
// ===========================================================================

const probeSchema = z.object({
  cluster_id: z.string().uuid().optional(),
  queries: z.array(z.string().min(1).max(1000)).optional(),
  engines: z.array(z.enum(LLM_ENGINES)).optional(),
  /** Injected probe results for testability. */
  results: z
    .array(
      z.object({
        engine: z.enum(LLM_ENGINES),
        query: z.string().min(1).max(1000),
        citations: z.array(
          z.object({ cited_url: z.string().url(), rank: z.number().int().optional() }),
        ),
        in_serp_top10: z.boolean().optional(),
      }),
    )
    .optional(),
});

async function probeCitations(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseJson(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = probeSchema.safeParse(body);
  if (!parsed.success) return validationError(req, parsed.error);
  const { cluster_id, results } = parsed.data;
  const engines = parsed.data.engines ?? [...LLM_ENGINES];

  // Validate cluster ownership when provided; build the query set.
  let queries = parsed.data.queries ?? [];
  if (cluster_id) {
    const { data: cluster } = await admin
      .from('blog_keyword_clusters')
      .select('id, pillar_keyword')
      .eq('tenant_id', tenantId)
      .eq('id', cluster_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!cluster) return createCorsResponse({ error: 'Cluster not found' }, 404, req);
    if (!queries.length) {
      // Default the probe queries to the cluster's keywords (US-BLOG-067 weekly probes).
      const { data: kws } = await admin
        .from('blog_keywords')
        .select('keyword')
        .eq('tenant_id', tenantId)
        .eq('cluster_id', cluster_id)
        .limit(25);
      queries = (kws ?? []).map((k) => (k as { keyword: string }).keyword);
      const pillar = (cluster as { pillar_keyword: string | null }).pillar_keyword;
      if (pillar) queries.unshift(pillar);
    }
  }
  queries = [...new Set(queries.filter(Boolean))];
  if (!queries.length) {
    return createCorsResponse(
      { error: 'No probe queries — supply queries[] or a cluster_id with keywords' },
      400,
      req,
    );
  }

  const injected = (results ?? []) as ProbeResult[];
  const ownPostUrls = await loadOwnPostUrlMap(admin, tenantId);
  const rowsToInsert: Array<Record<string, unknown>> = [];

  for (const query of queries) {
    for (const engine of engines) {
      const probe = await runProbe(engine, query, injected);
      for (const cite of probe.citations) {
        const own = isOwnDomainUrl(cite.cited_url);
        rowsToInsert.push({
          tenant_id: tenantId,
          cluster_id: cluster_id ?? null,
          post_id: own ? (ownPostUrls.get(normalizeUrl(cite.cited_url)) ?? null) : null,
          engine,
          query,
          cited_url: cite.cited_url,
          cited_domain: hostnameOf(cite.cited_url),
          is_own_domain: own,
          rank: cite.rank ?? null,
          in_serp_top10: probe.in_serp_top10 ?? null,
          raw_data: probe,
          created_by_user_id: userId,
        });
      }
    }
  }

  let written = 0;
  if (rowsToInsert.length) {
    const { error, count } = await admin
      .from('blog_llm_citations')
      .insert(rowsToInsert, { count: 'exact' });
    if (error) {
      console.error('probeCitations insert error', error);
      return createCorsResponse({ error: 'Failed to store citations' }, 500, req);
    }
    written = count ?? rowsToInsert.length;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_llm_citations.probe',
      targetType: 'blog_llm_citations',
      targetId: cluster_id ?? null,
      summary: `Ran ${queries.length} queries × ${engines.length} engines → ${written} citations`,
      afterState: { cluster_id, queries: queries.length, engines, citations: written },
    }),
  );

  return createCorsResponse(
    { queries: queries.length, engines, citations_written: written },
    200,
    req,
  );
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, '')}`;
  } catch {
    return url.toLowerCase();
  }
}

async function loadOwnPostUrlMap(admin: Admin, tenantId: string): Promise<Map<string, string>> {
  const { data } = await admin
    .from('blog_posts')
    .select('id, slug, canonical_url, cms_post_url')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  const map = new Map<string, string>();
  for (const p of data ?? []) {
    const row = p as {
      id: string;
      slug: string;
      canonical_url: string | null;
      cms_post_url: string | null;
    };
    for (const u of [row.canonical_url, row.cms_post_url]) {
      if (u) map.set(normalizeUrl(u), row.id);
    }
    // Also index by bare slug path so own-domain root-relative citations resolve.
    if (row.slug) map.set(`/${row.slug.replace(/^\/+|\/+$/g, '')}`, row.id);
  }
  return map;
}

async function shareOfVoice(admin: Admin, tenantId: string, url: URL, req: Request) {
  const clusterId = url.searchParams.get('cluster_id');
  let q = admin
    .from('blog_llm_citations')
    .select('cluster_id, engine, is_own_domain')
    .eq('tenant_id', tenantId);
  if (clusterId) q = q.eq('cluster_id', clusterId);
  const { data, error } = await q.limit(10000);
  if (error) return createCorsResponse({ error: 'Failed to compute share of voice' }, 500, req);

  // Aggregate % of citations that are our own domain, per cluster (and overall).
  const byCluster = new Map<string, { total: number; own: number }>();
  let total = 0;
  let own = 0;
  for (const r of data ?? []) {
    const row = r as { cluster_id: string | null; is_own_domain: boolean };
    const key = row.cluster_id ?? 'unclustered';
    const agg = byCluster.get(key) ?? { total: 0, own: 0 };
    agg.total += 1;
    if (row.is_own_domain) agg.own += 1;
    byCluster.set(key, agg);
    total += 1;
    if (row.is_own_domain) own += 1;
  }
  const clusters = [...byCluster.entries()].map(([cluster_id, agg]) => ({
    cluster_id,
    total_citations: agg.total,
    own_citations: agg.own,
    share_of_voice: agg.total ? Number((agg.own / agg.total).toFixed(4)) : 0,
  }));

  return createCorsResponse(
    {
      overall: {
        total_citations: total,
        own_citations: own,
        share_of_voice: total ? Number((own / total).toFixed(4)) : 0,
      },
      clusters,
    },
    200,
    req,
  );
}

async function citationOpportunities(admin: Admin, tenantId: string, req: Request) {
  // Hot opportunities: queries where we rank in classic SERP top-10 but are NOT
  // cited by any AI engine (US-BLOG-067 diff view).
  const { data, error } = await admin
    .from('blog_llm_citations')
    .select('query, cluster_id, engine, is_own_domain, in_serp_top10')
    .eq('tenant_id', tenantId)
    .limit(10000);
  if (error) return createCorsResponse({ error: 'Failed to compute opportunities' }, 500, req);

  const byQuery = new Map<
    string,
    { cluster_id: string | null; serpTop10: boolean; aiCited: boolean }
  >();
  for (const r of data ?? []) {
    const row = r as {
      query: string;
      cluster_id: string | null;
      is_own_domain: boolean;
      in_serp_top10: boolean | null;
    };
    const cur = byQuery.get(row.query) ?? {
      cluster_id: row.cluster_id,
      serpTop10: false,
      aiCited: false,
    };
    if (row.in_serp_top10) cur.serpTop10 = true;
    if (row.is_own_domain) cur.aiCited = true;
    byQuery.set(row.query, cur);
  }
  const opportunities = [...byQuery.entries()]
    .filter(([, v]) => v.serpTop10 && !v.aiCited)
    .map(([query, v]) => ({ query, cluster_id: v.cluster_id }));

  return createCorsResponse({ opportunities }, 200, req);
}

// ===========================================================================
// US-BLOG-068: Answer-Engine Optimization (AEO)
// ===========================================================================

const aeoScoreSchema = z.object({
  post_id: z.string().uuid(),
  /** When true, also produce LLM rewrite suggestions for vague paragraphs. */
  suggest: z.boolean().optional(),
  /** When true, generate a 'Quick answers' section + Schema.org JSON-LD. */
  quick_answers: z.boolean().optional(),
});

interface AeoPost {
  id: string;
  title: string;
  body_markdown: string | null;
  excerpt: string | null;
}

/** Deterministic AEO checks over the post body (US-BLOG-068). */
function deterministicAeoChecks(post: AeoPost): {
  breakdown: Record<string, { passed: boolean; score: number; notes: string }>;
  score: number;
} {
  const body = post.body_markdown || post.excerpt || '';
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const headings = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1].trim());
  const h3s = [...body.matchAll(/^###\s+(.+)$/gm)].map((m) => m[1].trim());

  // Self-contained paragraphs: paragraphs that don't open with a back-reference.
  const backRef = /^(this|that|these|those|it|they|he|she|here|there)\b/i;
  const selfContained = paragraphs.filter((p) => !backRef.test(p));
  const selfContainedRatio = paragraphs.length ? selfContained.length / paragraphs.length : 0;

  // Question-shaped H3s.
  const questionH3s = h3s.filter(
    (h) => /\?$/.test(h) || /^(how|what|why|when|where|who|which|can|do|does|is|are)\b/i.test(h),
  );

  // Explicit definitions: "X is ...", "X refers to ...", "X means ...".
  const definitions = (
    body.match(/\b\w[\w\s-]{2,40}\s+(is|are|refers to|means|is defined as)\s+/gi) ?? []
  ).length;

  // Factual statements with dates + named entities (capitalized multiword + a year/number).
  const datedFacts = (body.match(/\b(19|20)\d{2}\b/g) ?? []).length;
  const namedEntities = (body.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g) ?? []).length;

  // Original-data callouts: tables, %, "our data", "we found".
  const dataCallouts =
    (body.match(/\|.*\|/g) ?? []).length +
    (body.match(/\b\d+(\.\d+)?%/g) ?? []).length +
    (body.match(/\b(our data|we found|our analysis|according to our)\b/gi) ?? []).length;

  const checks = {
    self_contained_paragraphs: {
      passed: selfContainedRatio >= 0.7,
      score: Math.round(selfContainedRatio * 100) / 100,
      notes: `${selfContained.length}/${paragraphs.length} paragraphs are self-contained`,
    },
    question_shaped_h3s: {
      passed: h3s.length > 0 && questionH3s.length / Math.max(h3s.length, 1) >= 0.4,
      score: h3s.length ? Math.round((questionH3s.length / h3s.length) * 100) / 100 : 0,
      notes: `${questionH3s.length}/${h3s.length} H3s are question-shaped`,
    },
    explicit_definitions: {
      passed: definitions >= 1,
      score: definitions,
      notes: `${definitions} explicit definition pattern(s)`,
    },
    factual_statements_dated: {
      passed: datedFacts >= 1 && namedEntities >= 1,
      score: Math.min(datedFacts, 10),
      notes: `${datedFacts} dated fact(s), ${namedEntities} named-entity mention(s)`,
    },
    original_data_callouts: {
      passed: dataCallouts >= 1,
      score: Math.min(dataCallouts, 10),
      notes: `${dataCallouts} original-data callout signal(s)`,
    },
  };

  // Weighted overall score (0-100): each check contributes equally to a pass band.
  const weights = {
    self_contained_paragraphs: 30,
    question_shaped_h3s: 20,
    explicit_definitions: 20,
    factual_statements_dated: 20,
    original_data_callouts: 10,
  } as const;
  let score = 0;
  score += Math.min(checks.self_contained_paragraphs.score, 1) * weights.self_contained_paragraphs;
  score += Math.min(checks.question_shaped_h3s.score, 1) * weights.question_shaped_h3s;
  score += (checks.explicit_definitions.passed ? 1 : 0) * weights.explicit_definitions;
  score += (checks.factual_statements_dated.passed ? 1 : 0) * weights.factual_statements_dated;
  score += (checks.original_data_callouts.passed ? 1 : 0) * weights.original_data_callouts;

  return { breakdown: checks, score: Math.round(score * 100) / 100 };
}

async function scoreAeo(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseJson(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = aeoScoreSchema.safeParse(body);
  if (!parsed.success) return validationError(req, parsed.error);
  const { post_id, suggest, quick_answers } = parsed.data;

  const { data: post } = await admin
    .from('blog_posts')
    .select('id, title, body_markdown, excerpt')
    .eq('tenant_id', tenantId)
    .eq('id', post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);
  const p = post as AeoPost;

  const { breakdown, score } = deterministicAeoChecks(p);

  // LLM-assisted: rewrite vague paragraphs + quick-answers + JSON-LD.
  let suggestions: unknown = null;
  let quickAnswers: unknown = null;
  let jsonLd: unknown = null;

  if (suggest || quick_answers) {
    // Read PAA questions if available (US-BLOG-068 quick answers).
    const { data: paa } = await admin
      .from('blog_keywords')
      .select('keyword')
      .eq('tenant_id', tenantId)
      .eq('source_type', 'paa')
      .limit(10);
    const paaQuestions = (paa ?? []).map((k) => (k as { keyword: string }).keyword);

    const wantBlocks: string[] = [];
    if (suggest) {
      wantBlocks.push(
        '"suggestions": array of { "original": string, "rewrite": string (a self-contained answer chunk), "reason": string } for the 3 vaguest paragraphs.',
      );
    }
    if (quick_answers) {
      wantBlocks.push(
        '"quick_answers": { "items": array of { "question": string, "answer": string (1-3 sentence direct answer) } } answering the top People-Also-Ask questions.',
      );
    }
    const system =
      'You are an Answer-Engine Optimization (AEO) editor. You make B2B content directly quotable ' +
      'by AI answer engines. Return ONLY a single JSON object, no prose, no code fences.';
    const userPrompt = [
      `Post title: ${p.title}`,
      paaQuestions.length ? `People-Also-Ask questions: ${paaQuestions.join(' | ')}` : null,
      '',
      'Post body (markdown, truncated):',
      (p.body_markdown || p.excerpt || '').slice(0, 8000) || '(no body)',
      '',
      `Return a JSON object with: ${wantBlocks.join(' ')}`,
    ]
      .filter((l) => l !== null)
      .join('\n');

    try {
      const raw = await generateCompletion({
        max_tokens: 2000,
        temperature: 0.4,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const obj = extractJsonObject(raw);
      if (suggest) suggestions = obj.suggestions ?? [];
      if (quick_answers) {
        quickAnswers = obj.quick_answers ?? { items: [] };
        jsonLd = buildFaqJsonLd(
          quickAnswers as { items?: Array<{ question: string; answer: string }> },
        );
      }
    } catch (err) {
      console.error('scoreAeo LLM error', err);
      // Non-fatal — still return the deterministic score.
    }
  }

  const { data: inserted, error: insErr } = await admin
    .from('blog_aeo_scores')
    .insert({
      tenant_id: tenantId,
      post_id,
      score,
      breakdown,
      suggestions,
      quick_answers: quickAnswers,
      json_ld: jsonLd,
      created_by_user_id: userId,
    })
    .select()
    .maybeSingle();
  if (insErr) {
    console.error('scoreAeo insert error', insErr);
    return createCorsResponse({ error: 'Failed to store AEO score' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_aeo_score.create',
      targetType: 'blog_aeo_score',
      targetId: (inserted?.id as string) ?? null,
      summary: `AEO score ${score} for post ${post_id}`,
      afterState: { post_id, score },
    }),
  );

  return createCorsResponse({ aeo: inserted }, 201, req);
}

/** Schema.org FAQPage / QAPage JSON-LD for the quick-answers section (US-BLOG-068). */
function buildFaqJsonLd(quick: { items?: Array<{ question: string; answer: string }> } | null): {
  faqPage: Record<string, unknown>;
  qaPage: Record<string, unknown> | null;
} {
  const items = quick?.items ?? [];
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  };
  const qaPage = items.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'QAPage',
        mainEntity: {
          '@type': 'Question',
          name: items[0].question,
          acceptedAnswer: { '@type': 'Answer', text: items[0].answer },
        },
      }
    : null;
  return { faqPage, qaPage };
}

async function latestAeo(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  if (!postId) return createCorsResponse({ error: 'post_id is required' }, 400, req);
  const { data, error } = await admin
    .from('blog_aeo_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to load AEO score' }, 500, req);
  return createCorsResponse({ aeo: data ?? null }, 200, req);
}

// ===========================================================================
// US-BLOG-069: domain knowledge graph
// ===========================================================================

const kgExtractSchema = z.object({
  post_id: z.string().uuid(),
  /** Injected entities for testability (skips the LLM NER call). */
  entities: z
    .array(z.object({ name: z.string().min(1).max(500), entity_type: z.enum(KG_ENTITY_TYPES) }))
    .optional(),
  /** Competitor entities for the gap detector. */
  competitor_entities: z
    .array(z.object({ name: z.string().min(1).max(500), entity_type: z.enum(KG_ENTITY_TYPES) }))
    .optional(),
});

function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** LLM NER over a published post (US-BLOG-069). Returns injected entities when given. */
async function nerExtract(
  post: { title: string; body: string },
  injected?: Array<{ name: string; entity_type: string }>,
): Promise<Array<{ name: string; entity_type: string }>> {
  if (injected && injected.length) return injected;
  const system =
    'You are a named-entity recognition engine. Extract notable entities from the article. ' +
    'Return ONLY a single JSON object: { "entities": [ { "name": string, "type": ' +
    '"person"|"organization"|"product"|"concept"|"location"|"date" } ] }. No prose, no fences.';
  const userPrompt = [
    `Title: ${post.title}`,
    '',
    'Body (truncated):',
    post.body.slice(0, 8000),
  ].join('\n');
  try {
    const raw = await generateCompletion({
      max_tokens: 1500,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const obj = extractJsonObject(raw);
    const ents = Array.isArray(obj.entities) ? obj.entities : [];
    return ents
      .map((e) => {
        const o = e as { name?: unknown; type?: unknown };
        return { name: String(o.name ?? ''), entity_type: String(o.type ?? 'concept') };
      })
      .filter((e) => e.name && (KG_ENTITY_TYPES as readonly string[]).includes(e.entity_type));
  } catch (err) {
    console.error('nerExtract LLM error', err);
    return [];
  }
}

async function extractKg(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseJson(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = kgExtractSchema.safeParse(body);
  if (!parsed.success) return validationError(req, parsed.error);
  const { post_id } = parsed.data;

  const { data: post } = await admin
    .from('blog_posts')
    .select('id, title, body_markdown, excerpt, status')
    .eq('tenant_id', tenantId)
    .eq('id', post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);
  const p = post as {
    id: string;
    title: string;
    body_markdown: string | null;
    excerpt: string | null;
  };

  const extracted = await nerExtract(
    { title: p.title, body: p.body_markdown || p.excerpt || '' },
    parsed.data.entities,
  );

  const now = new Date().toISOString();
  const entityIdsInPost: string[] = [];

  // Upsert entities (dedup by tenant + normalized_name + type), accumulate frequency.
  for (const e of extracted) {
    const norm = normalizeEntityName(e.name);
    const { data: existing } = await admin
      .from('blog_kg_entities')
      .select('id, frequency, related_post_ids')
      .eq('tenant_id', tenantId)
      .eq('normalized_name', norm)
      .eq('entity_type', e.entity_type)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      const relatedRaw = (existing.related_post_ids as string[] | null) ?? [];
      const related = new Set(relatedRaw);
      related.add(post_id);
      await admin
        .from('blog_kg_entities')
        .update({
          frequency: ((existing.frequency as number) ?? 0) + 1,
          last_seen_at: now,
          related_post_ids: [...related],
          is_competitor_only: false,
          updated_at: now,
        })
        .eq('tenant_id', tenantId)
        .eq('id', existing.id as string);
      entityIdsInPost.push(existing.id as string);
    } else {
      const { data: created } = await admin
        .from('blog_kg_entities')
        .insert({
          tenant_id: tenantId,
          name: e.name,
          normalized_name: norm,
          entity_type: e.entity_type,
          frequency: 1,
          first_seen_at: now,
          last_seen_at: now,
          related_post_ids: [post_id],
          is_competitor_only: false,
          created_by_user_id: userId,
        })
        .select('id')
        .maybeSingle();
      if (created) entityIdsInPost.push((created as { id: string }).id);
    }
  }

  // Co-occurrence edges: every pair of entities in this post (canonical orient).
  let edgesTouched = 0;
  const uniqIds = [...new Set(entityIdsInPost)];
  for (let i = 0; i < uniqIds.length; i++) {
    for (let j = i + 1; j < uniqIds.length; j++) {
      const [src, tgt] = [uniqIds[i], uniqIds[j]].sort();
      const { data: edge } = await admin
        .from('blog_kg_edges')
        .select('id, weight, co_post_ids')
        .eq('tenant_id', tenantId)
        .eq('source_entity_id', src)
        .eq('target_entity_id', tgt)
        .maybeSingle();
      if (edge) {
        const posts = new Set((edge.co_post_ids as string[] | null) ?? []);
        posts.add(post_id);
        await admin
          .from('blog_kg_edges')
          .update({
            weight: ((edge.weight as number) ?? 1) + 1,
            co_post_ids: [...posts],
            updated_at: now,
          })
          .eq('tenant_id', tenantId)
          .eq('id', edge.id as string);
      } else {
        await admin.from('blog_kg_edges').insert({
          tenant_id: tenantId,
          source_entity_id: src,
          target_entity_id: tgt,
          weight: 1,
          co_post_ids: [post_id],
        });
      }
      edgesTouched += 1;
    }
  }

  // Competitor entities → gap detector seed (is_competitor_only when not ours).
  const competitor = competitorEntitiesAdapter(parsed.data.competitor_entities);
  let competitorSeeded = 0;
  for (const e of competitor) {
    if (!(KG_ENTITY_TYPES as readonly string[]).includes(e.entity_type)) continue;
    const norm = normalizeEntityName(e.name);
    const { data: existing } = await admin
      .from('blog_kg_entities')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('normalized_name', norm)
      .eq('entity_type', e.entity_type)
      .is('deleted_at', null)
      .maybeSingle();
    if (existing) continue; // we already cover it — not a gap
    await admin.from('blog_kg_entities').insert({
      tenant_id: tenantId,
      name: e.name,
      normalized_name: norm,
      entity_type: e.entity_type,
      frequency: 0,
      is_competitor_only: true,
      created_by_user_id: userId,
    });
    competitorSeeded += 1;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_kg.extract',
      targetType: 'blog_post',
      targetId: post_id,
      summary: `Extracted ${extracted.length} entities, ${edgesTouched} edges, ${competitorSeeded} competitor gaps`,
      afterState: {
        entities: extracted.length,
        edges: edgesTouched,
        competitor_seeded: competitorSeeded,
      },
    }),
  );

  return createCorsResponse(
    {
      post_id,
      entities_extracted: extracted.length,
      edges_touched: edgesTouched,
      competitor_gaps_seeded: competitorSeeded,
    },
    200,
    req,
  );
}

async function kgGraph(admin: Admin, tenantId: string, req: Request) {
  const { data: entities, error: eErr } = await admin
    .from('blog_kg_entities')
    .select('id, name, entity_type, frequency, cluster_label, is_competitor_only')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .eq('is_competitor_only', false)
    .order('frequency', { ascending: false })
    .limit(2000);
  if (eErr) return createCorsResponse({ error: 'Failed to load entities' }, 500, req);

  const { data: edges, error: edgeErr } = await admin
    .from('blog_kg_edges')
    .select('source_entity_id, target_entity_id, weight')
    .eq('tenant_id', tenantId)
    .order('weight', { ascending: false })
    .limit(5000);
  if (edgeErr) return createCorsResponse({ error: 'Failed to load edges' }, 500, req);

  // Force-directed shape: nodes carry size (frequency) + group (type/cluster) for coloring.
  const nodes = (entities ?? []).map((e) => {
    const row = e as {
      id: string;
      name: string;
      entity_type: string;
      frequency: number;
      cluster_label: string | null;
    };
    return {
      id: row.id,
      label: row.name,
      type: row.entity_type,
      group: row.cluster_label ?? row.entity_type,
      size: row.frequency,
    };
  });
  const links = (edges ?? []).map((e) => {
    const row = e as { source_entity_id: string; target_entity_id: string; weight: number };
    return { source: row.source_entity_id, target: row.target_entity_id, weight: row.weight };
  });

  return createCorsResponse({ nodes, links }, 200, req);
}

async function kgGaps(admin: Admin, tenantId: string, req: Request) {
  // Entities competitors cover that we don't (US-BLOG-069 gap detector).
  const { data, error } = await admin
    .from('blog_kg_entities')
    .select('id, name, entity_type, metadata')
    .eq('tenant_id', tenantId)
    .eq('is_competitor_only', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) return createCorsResponse({ error: 'Failed to load gaps' }, 500, req);
  const gaps = (data ?? []).map((e) => {
    const row = e as { id: string; name: string; entity_type: string };
    return {
      entity_id: row.id,
      name: row.name,
      entity_type: row.entity_type,
      // Suggestion fed to keyword-cluster planning (US-BLOG-069).
      suggested_cluster_keyword: row.name,
    };
  });
  return createCorsResponse({ gaps }, 200, req);
}

// ===========================================================================
// Router
// ===========================================================================
export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }
    if (!hasAnalyticsAccess(user)) {
      return createCorsResponse(
        { error: 'Forbidden: blog.analytics.view or blog.post.edit required' },
        403,
        req,
      );
    }
    const tenantId = resolveTenantId(user) || req.headers.get('x-tenant-id');
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-analytics-intel');
    const [a, b, c] = parts;
    const m = req.method;

    // --- US-BLOG-061: connections ---
    if (a === 'connections' && !b) {
      if (m === 'GET') return await listConnections(admin, tenantId, req);
      if (m === 'POST') return await upsertConnection(admin, tenantId, user.id, req);
    }
    if (a === 'connections' && b && m === 'DELETE') {
      return await deleteConnection(admin, tenantId, user.id, b, req);
    }

    // --- US-BLOG-061: metric ingest / backfill / trend ---
    if (a === 'metrics' && b === 'ingest' && m === 'POST') {
      return await ingestMetrics(admin, tenantId, user.id, req, false);
    }
    if (a === 'metrics' && b === 'backfill' && m === 'POST') {
      return await ingestMetrics(admin, tenantId, user.id, req, true);
    }
    if (a === 'posts' && b && c === 'trend' && m === 'GET') {
      return await postTrend(admin, tenantId, b, url, req);
    }

    // --- US-BLOG-065: conversion config + cohorts ---
    if (a === 'conversion-config' && !b) {
      if (m === 'GET') return await getConversionConfig(admin, tenantId, req);
      if (m === 'PUT' || m === 'POST')
        return await putConversionConfig(admin, tenantId, user.id, req);
    }
    if (a === 'cohorts' && b === 'compute' && m === 'POST') {
      return await computeCohorts(admin, tenantId, user.id, req);
    }
    if (a === 'cohorts' && !b && m === 'GET') {
      return await listCohorts(admin, tenantId, url, req);
    }

    // --- US-BLOG-067: citations ---
    if (a === 'citations' && b === 'probe' && m === 'POST') {
      return await probeCitations(admin, tenantId, user.id, req);
    }
    if (a === 'citations' && b === 'share-of-voice' && m === 'GET') {
      return await shareOfVoice(admin, tenantId, url, req);
    }
    if (a === 'citations' && b === 'opportunities' && m === 'GET') {
      return await citationOpportunities(admin, tenantId, req);
    }

    // --- US-BLOG-068: AEO ---
    if (a === 'aeo' && b === 'score') {
      if (m === 'POST') return await scoreAeo(admin, tenantId, user.id, req);
      if (m === 'GET') return await latestAeo(admin, tenantId, url, req);
    }

    // --- US-BLOG-069: knowledge graph ---
    if (a === 'kg' && b === 'extract' && m === 'POST') {
      return await extractKg(admin, tenantId, user.id, req);
    }
    if (a === 'kg' && b === 'graph' && m === 'GET') {
      return await kgGraph(admin, tenantId, req);
    }
    if (a === 'kg' && b === 'gaps' && m === 'GET') {
      return await kgGaps(admin, tenantId, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-analytics-intel handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
