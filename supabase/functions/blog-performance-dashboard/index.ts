// Blog Performance Dashboard Edge Function (US-BLOG-062)
//
// One-glance answer to "how is content doing?" — aggregates
// blog_performance_metrics into top-level cards, a per-cluster table, and a
// per-channel table, with prior-period comparison and CSV export. Read-only:
// no new schema, everything is derived from existing metrics + posts +
// clusters + distributions.
//
// Routes (tenant-scoped, gated to blog.analytics.view):
//   GET /blog-performance-dashboard?range=28d&compare=true
//       → { cards, clusters[], channels[], posts[] }
//   GET /blog-performance-dashboard/export.csv?view=posts|clusters|channels&range=28d
//
// Default range is "last 28 days vs prior 28" — the comparison most editors want.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

interface MetricRow {
  post_id: string;
  distribution_id: string | null;
  source: string;
  pageviews: number | null;
  unique_visitors: number | null;
  impressions: number | null;
  clicks: number | null;
  position: number | null;
  conversions: number | null;
  metric_date: string;
}

const ORGANIC_SOURCES = new Set(['search_console', 'gsc']);
const SITE_SOURCES = new Set(['ga4', 'google_analytics']);

function hasAnalyticsView(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.analytics.view')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

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
    if (!hasAnalyticsView(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.analytics.view required' }, 403, req);
    }
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-performance-dashboard');
    const action = parts[0];

    if (action === 'export.csv' && req.method === 'GET') {
      return await exportCsv(admin, tenantId, url, req);
    }
    if (!action && req.method === 'GET') {
      return await dashboard(admin, tenantId, url, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-performance-dashboard handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─── date helpers ──────────────────────────────────────────────────────────
function rangeToDays(range: string | null): number {
  switch (range) {
    case '7d':
      return 7;
    case '90d':
      return 90;
    case '28d':
    default:
      return 28;
  }
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// ─── metric fetch + aggregation ──────────────────────────────────────────────
async function fetchMetrics(
  admin: Admin,
  tenantId: string,
  fromDate: string,
  toDate: string,
): Promise<MetricRow[]> {
  const out: MetricRow[] = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await admin
      .from('blog_performance_metrics')
      .select(
        'post_id, distribution_id, source, pageviews, unique_visitors, impressions, clicks, position, conversions, metric_date',
      )
      .eq('tenant_id', tenantId)
      .gte('metric_date', fromDate)
      .lt('metric_date', toDate)
      .range(from, from + page - 1);
    if (error || !data || data.length === 0) break;
    out.push(...(data as MetricRow[]));
    if (data.length < page) break;
    from += page;
  }
  return out;
}

interface Agg {
  clicks: number;
  impressions: number;
  conversions: number;
  pageviews: number;
  // weighted position accumulation (sum(position*impressions) / sum(impressions))
  posWeightSum: number;
  posImprSum: number;
  posSimpleSum: number;
  posSimpleN: number;
}

function emptyAgg(): Agg {
  return {
    clicks: 0,
    impressions: 0,
    conversions: 0,
    pageviews: 0,
    posWeightSum: 0,
    posImprSum: 0,
    posSimpleSum: 0,
    posSimpleN: 0,
  };
}

function accumulate(a: Agg, r: MetricRow) {
  a.clicks += r.clicks ?? 0;
  a.impressions += r.impressions ?? 0;
  a.conversions += r.conversions ?? 0;
  a.pageviews += r.pageviews ?? 0;
  if (r.position != null) {
    const impr = r.impressions ?? 0;
    if (impr > 0) {
      a.posWeightSum += r.position * impr;
      a.posImprSum += impr;
    }
    a.posSimpleSum += r.position;
    a.posSimpleN += 1;
  }
}

function avgPosition(a: Agg): number | null {
  if (a.posImprSum > 0) return Number((a.posWeightSum / a.posImprSum).toFixed(2));
  if (a.posSimpleN > 0) return Number((a.posSimpleSum / a.posSimpleN).toFixed(2));
  return null;
}

// ─── dashboard ───────────────────────────────────────────────────────────────
async function dashboard(admin: Admin, tenantId: string, url: URL, req: Request) {
  const days = rangeToDays(url.searchParams.get('range'));
  const compare = url.searchParams.get('compare') !== 'false'; // default ON

  const curFrom = dateDaysAgo(days);
  const today = dateDaysAgo(0);
  const priorFrom = dateDaysAgo(days * 2);

  const [curRows, priorRows] = await Promise.all([
    fetchMetrics(admin, tenantId, curFrom, today),
    compare
      ? fetchMetrics(admin, tenantId, priorFrom, curFrom)
      : Promise.resolve([] as MetricRow[]),
  ]);

  // Reference data.
  const postIds = Array.from(new Set([...curRows, ...priorRows].map((r) => r.post_id)));
  const posts = await fetchPosts(admin, tenantId, postIds);
  const clusters = await fetchClusters(admin, tenantId);
  const distMap = await fetchDistributionPlatforms(admin, tenantId);

  // Per-post aggregation (current + prior for decline detection).
  const curByPost = new Map<string, Agg>();
  const priorByPost = new Map<string, Agg>();
  for (const r of curRows) accumulate(getOr(curByPost, r.post_id), r);
  for (const r of priorRows) accumulate(getOr(priorByPost, r.post_id), r);

  // Organic clicks total (search console only).
  const organicClicks = curRows
    .filter((r) => ORGANIC_SOURCES.has(r.source))
    .reduce((s, r) => s + (r.clicks ?? 0), 0);
  const priorOrganicClicks = priorRows
    .filter((r) => ORGANIC_SOURCES.has(r.source))
    .reduce((s, r) => s + (r.clicks ?? 0), 0);
  const totalConversions = curRows.reduce((s, r) => s + (r.conversions ?? 0), 0);

  // Per-post rows.
  const postRows = postIds
    .map((pid) => {
      const a = curByPost.get(pid) ?? emptyAgg();
      const p = priorByPost.get(pid);
      const meta = posts.get(pid);
      const priorClicks = p?.clicks ?? 0;
      return {
        post_id: pid,
        title: meta?.title ?? '(unknown)',
        slug: meta?.slug ?? null,
        cluster_id: meta?.cluster_id ?? null,
        clicks: a.clicks,
        impressions: a.impressions,
        conversions: a.conversions,
        avg_position: avgPosition(a),
        prior_clicks: priorClicks,
        delta_clicks: a.clicks - priorClicks,
        delta_pct:
          priorClicks > 0
            ? Number((((a.clicks - priorClicks) / priorClicks) * 100).toFixed(1))
            : null,
      };
    })
    .filter((r) => r.clicks > 0 || r.impressions > 0 || r.prior_clicks > 0);

  const topPosts = [...postRows].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  const decliningPosts = [...postRows]
    .filter((r) => r.delta_clicks < 0)
    .sort((a, b) => a.delta_clicks - b.delta_clicks)
    .slice(0, 10);

  // Per-cluster aggregation.
  const clusterAgg = new Map<string, Agg & { postIds: Set<string> }>();
  const NO_CLUSTER = '__none__';
  for (const r of curRows) {
    const cid = posts.get(r.post_id)?.cluster_id ?? NO_CLUSTER;
    const a = clusterAgg.get(cid) ?? Object.assign(emptyAgg(), { postIds: new Set<string>() });
    accumulate(a, r);
    a.postIds.add(r.post_id);
    clusterAgg.set(cid, a);
  }
  const clusterRows = Array.from(clusterAgg.entries())
    .map(([cid, a]) => ({
      cluster_id: cid === NO_CLUSTER ? null : cid,
      name: cid === NO_CLUSTER ? '(unclustered)' : (clusters.get(cid)?.name ?? '(unknown)'),
      authority_score: cid === NO_CLUSTER ? null : (clusters.get(cid)?.authority ?? null),
      clicks: a.clicks,
      impressions: a.impressions,
      conversions: a.conversions,
      avg_position: avgPosition(a),
      post_count: a.postIds.size,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  // Per-channel aggregation (from distributions: organic + each social platform).
  const channelAgg = new Map<string, Agg>();
  for (const r of curRows) {
    const channel = channelOf(r, distMap);
    accumulate(getOr(channelAgg, channel), r);
  }
  const channelRows = Array.from(channelAgg.entries())
    .map(([channel, a]) => ({
      channel,
      clicks: a.clicks,
      sessions: a.pageviews, // pageviews proxy for sessions where GA4 sessions aren't separated
      conversions: a.conversions,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  return createCorsResponse(
    {
      range: url.searchParams.get('range') ?? '28d',
      window_days: days,
      cards: {
        organic_clicks: organicClicks,
        organic_clicks_prior: compare ? priorOrganicClicks : null,
        organic_clicks_delta_pct:
          compare && priorOrganicClicks > 0
            ? Number((((organicClicks - priorOrganicClicks) / priorOrganicClicks) * 100).toFixed(1))
            : null,
        conversions_attributed: totalConversions,
        top_posts: topPosts,
        declining_posts: decliningPosts,
      },
      clusters: clusterRows,
      channels: channelRows,
      posts: postRows.sort((a, b) => b.clicks - a.clicks),
    },
    200,
    req,
  );
}

function channelOf(r: MetricRow, distMap: Map<string, string>): string {
  if (ORGANIC_SOURCES.has(r.source)) return 'organic';
  if (SITE_SOURCES.has(r.source)) return 'site';
  if (r.distribution_id && distMap.has(r.distribution_id)) return distMap.get(r.distribution_id)!;
  return r.source || 'other';
}

function getOr(map: Map<string, Agg>, key: string): Agg {
  let a = map.get(key);
  if (!a) {
    a = emptyAgg();
    map.set(key, a);
  }
  return a;
}

// ─── reference fetchers ────────────────────────────────────────────────────────
async function fetchPosts(
  admin: Admin,
  tenantId: string,
  ids: string[],
): Promise<Map<string, { title: string; slug: string | null; cluster_id: string | null }>> {
  const map = new Map<string, { title: string; slug: string | null; cluster_id: string | null }>();
  if (ids.length === 0) return map;
  // Chunk the IN list to keep URLs bounded.
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await admin
      .from('blog_posts')
      .select('id, title, slug, cluster_id')
      .eq('tenant_id', tenantId)
      .in('id', chunk);
    for (const p of data ?? []) {
      map.set(p.id, { title: p.title, slug: p.slug ?? null, cluster_id: p.cluster_id ?? null });
    }
  }
  return map;
}

async function fetchClusters(
  admin: Admin,
  tenantId: string,
): Promise<Map<string, { name: string; authority: number | null }>> {
  const map = new Map<string, { name: string; authority: number | null }>();
  const { data } = await admin
    .from('blog_keyword_clusters')
    .select('id, name, topical_authority_score')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  for (const c of data ?? []) {
    map.set(c.id, {
      name: c.name,
      authority: c.topical_authority_score != null ? Number(c.topical_authority_score) : null,
    });
  }
  return map;
}

async function fetchDistributionPlatforms(
  admin: Admin,
  tenantId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await admin
      .from('blog_distributions')
      .select('id, platform')
      .eq('tenant_id', tenantId)
      .range(from, from + page - 1);
    if (error || !data || data.length === 0) break;
    for (const d of data) map.set(d.id, d.platform);
    if (data.length < page) break;
    from += page;
  }
  return map;
}

// ─── CSV export ────────────────────────────────────────────────────────────────
async function exportCsv(admin: Admin, tenantId: string, url: URL, req: Request) {
  const view = url.searchParams.get('view') ?? 'posts';
  // Reuse the dashboard computation by calling it and slicing the relevant view.
  const dashResp = await dashboard(admin, tenantId, url, req);
  const payload = (await dashResp.json()) as {
    posts: Array<Record<string, unknown>>;
    clusters: Array<Record<string, unknown>>;
    channels: Array<Record<string, unknown>>;
  };

  let header: string;
  let rows: string[];
  if (view === 'clusters') {
    header =
      'cluster_id,name,authority_score,clicks,impressions,conversions,avg_position,post_count';
    rows = payload.clusters.map((c) =>
      [
        c.cluster_id,
        c.name,
        c.authority_score,
        c.clicks,
        c.impressions,
        c.conversions,
        c.avg_position,
        c.post_count,
      ]
        .map(csvCell)
        .join(','),
    );
  } else if (view === 'channels') {
    header = 'channel,clicks,sessions,conversions';
    rows = payload.channels.map((c) =>
      [c.channel, c.clicks, c.sessions, c.conversions].map(csvCell).join(','),
    );
  } else {
    header =
      'post_id,title,slug,clicks,impressions,conversions,avg_position,delta_clicks,delta_pct';
    rows = payload.posts.map((p) =>
      [
        p.post_id,
        p.title,
        p.slug,
        p.clicks,
        p.impressions,
        p.conversions,
        p.avg_position,
        p.delta_clicks,
        p.delta_pct,
      ]
        .map(csvCell)
        .join(','),
    );
  }

  const csv = [header, ...rows].join('\n');
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="blog-performance-${view}.csv"`,
      'Access-Control-Allow-Origin': req.headers.get('Origin') ?? '*',
    },
  });
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
