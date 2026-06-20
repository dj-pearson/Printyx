// Blog Topical Authority Scorer Edge Function (US-BLOG-022)
//
// Scores each keyword cluster 0-100 by combining four signals:
//   1. top10_pct       — % of cluster keywords where OUR domain ranks top 10
//   2. coverage_pct    — % of cluster keywords we have published content for
//   3. avg_rank        — average of our ranks across the cluster (lower is better)
//   4. total_impr      — total impressions captured by the cluster's posts
// The absolute score is stored on blog_keyword_clusters.topical_authority_score
// and snapshotted daily into blog_cluster_authority_snapshots for the 90-day
// trend line. A comparative "authority vs top competitor" score is computed from
// blog_competitor_keywords (is_own = false) — authority is comparative.
//
// Routes (gated to platform admin OR users holding blog.analytics.view):
//   POST /blog-topical-authority/score                 body: { cluster_id? }  recompute + snapshot
//   GET  /blog-topical-authority/heatmap               clusters + current score
//   GET  /blog-topical-authority/clusters/:id/authority   full breakdown + 90-day trend
//
// Our per-keyword rank comes from blog_competitor_keywords (is_own = true);
// coverage comes from published posts carrying the cluster_id. All inputs are
// already-persisted rows, so scoring is deterministic without live API calls.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const scoreSchema = z.object({ cluster_id: z.string().uuid().optional() });

interface ClusterRow {
  id: string;
  name: string;
}
interface KeywordRow {
  id: string;
  keyword: string;
  cluster_id: string | null;
}
interface CompRow {
  keyword: string;
  is_own: boolean;
  rank: number | null;
}

interface Components {
  top10_pct: number;
  coverage_pct: number;
  avg_rank: number | null;
  total_impressions: number;
  keyword_count: number;
}

function hasAnalyticsView(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.analytics.view') || perms.includes('blog.post.edit'))
  )
    return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function normKw(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Blend the four component signals into a 0-100 authority score. Weighting:
 * top-10 share 40, coverage 25, avg-rank quality 20, impression scale 15. The
 * impression term uses a log curve so a handful of huge posts can't dominate.
 */
function blendScore(c: Components): number {
  const top10 = c.top10_pct; // 0..1
  const coverage = c.coverage_pct; // 0..1
  // Rank quality: rank 1 → 1.0, rank 20+ → 0. Null (unranked) → 0.
  const rankQuality = c.avg_rank == null ? 0 : Math.max(0, (20 - Math.min(c.avg_rank, 20)) / 19);
  // Impression scale: log10 normalized so 100k impressions ≈ 1.0.
  const imprScale = c.total_impressions > 0 ? Math.min(Math.log10(c.total_impressions) / 5, 1) : 0;
  const score = top10 * 40 + coverage * 25 + rankQuality * 20 + imprScale * 15;
  return Math.round(Math.min(score, 100) * 100) / 100;
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
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-topical-authority');
    const action = parts[0];

    if (action === 'score' && req.method === 'POST') {
      return await score(admin, tenantId, user.id, req);
    }
    if (action === 'heatmap' && req.method === 'GET') {
      return await heatmap(admin, tenantId, req);
    }
    if (action === 'clusters' && parts[2] === 'authority' && parts[1] && req.method === 'GET') {
      return await breakdown(admin, tenantId, parts[1], req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-topical-authority handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function computeCluster(
  admin: Admin,
  tenantId: string,
  cluster: ClusterRow,
): Promise<{ components: Components; ownScore: number; competitorScore: number | null }> {
  // Cluster keywords.
  const { data: kws } = await admin
    .from('blog_keywords')
    .select('id, keyword, cluster_id')
    .eq('tenant_id', tenantId)
    .eq('cluster_id', cluster.id);
  const keywords = (kws ?? []) as KeywordRow[];
  const keywordCount = keywords.length;

  if (keywordCount === 0) {
    const empty: Components = {
      top10_pct: 0,
      coverage_pct: 0,
      avg_rank: null,
      total_impressions: 0,
      keyword_count: 0,
    };
    return { components: empty, ownScore: 0, competitorScore: null };
  }
  const kwSet = new Set(keywords.map((k) => normKw(k.keyword)));

  // Our ranks + competitor ranks for those keywords.
  const { data: comps } = await admin
    .from('blog_competitor_keywords')
    .select('keyword, is_own, rank')
    .eq('tenant_id', tenantId);
  const ownRankByKw = new Map<string, number>();
  const compBestRankByKw = new Map<string, number>();
  for (const c of (comps ?? []) as CompRow[]) {
    const k = normKw(c.keyword);
    if (!kwSet.has(k) || c.rank == null) continue;
    if (c.is_own) {
      if (!ownRankByKw.has(k) || c.rank < ownRankByKw.get(k)!) ownRankByKw.set(k, c.rank);
    } else {
      if (!compBestRankByKw.has(k) || c.rank < compBestRankByKw.get(k)!)
        compBestRankByKw.set(k, c.rank);
    }
  }

  const ownRanks = Array.from(ownRankByKw.values());
  const top10 = ownRanks.filter((r) => r <= 10).length;
  const avgRank = ownRanks.length > 0 ? ownRanks.reduce((a, b) => a + b, 0) / ownRanks.length : null;

  // Coverage: published posts carrying this cluster_id.
  const { count: publishedPosts } = await admin
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('cluster_id', cluster.id)
    .eq('status', 'published')
    .is('deleted_at', null);
  const coverage = Math.min((publishedPosts ?? 0) / keywordCount, 1);

  // Total impressions across the cluster's published posts (search_console).
  let totalImpr = 0;
  const { data: postRows } = await admin
    .from('blog_posts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('cluster_id', cluster.id)
    .eq('status', 'published')
    .is('deleted_at', null);
  const postIds = (postRows ?? []).map((p) => p.id);
  if (postIds.length > 0) {
    const { data: metrics } = await admin
      .from('blog_performance_metrics')
      .select('impressions')
      .eq('tenant_id', tenantId)
      .eq('source', 'search_console')
      .in('post_id', postIds);
    for (const m of (metrics ?? []) as Array<{ impressions: number | null }>) {
      totalImpr += m.impressions ?? 0;
    }
  }

  const components: Components = {
    top10_pct: ownRanks.length > 0 ? top10 / keywordCount : 0,
    coverage_pct: coverage,
    avg_rank: avgRank,
    total_impressions: totalImpr,
    keyword_count: keywordCount,
  };
  const ownScore = blendScore(components);

  // Competitor comparative score: same blend but using their best ranks; coverage
  // and impressions are unknown for competitors, so use neutral mid-values.
  const compRanks = Array.from(compBestRankByKw.values());
  let competitorScore: number | null = null;
  if (compRanks.length > 0) {
    const compTop10 = compRanks.filter((r) => r <= 10).length / keywordCount;
    const compAvg = compRanks.reduce((a, b) => a + b, 0) / compRanks.length;
    competitorScore = blendScore({
      top10_pct: compTop10,
      coverage_pct: 0.5,
      avg_rank: compAvg,
      total_impressions: 0,
      keyword_count: keywordCount,
    });
  }

  return { components, ownScore, competitorScore };
}

async function score(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown = {};
  if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
    try {
      body = await req.json();
    } catch {
      return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
    }
  }
  const parsed = scoreSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  let clusterQuery = admin
    .from('blog_keyword_clusters')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  if (parsed.data.cluster_id) clusterQuery = clusterQuery.eq('id', parsed.data.cluster_id);
  const { data: clusters } = await clusterQuery.limit(500);
  if (!clusters || clusters.length === 0) {
    return createCorsResponse({ scored: 0, results: [] }, 200, req);
  }

  const today = new Date().toISOString().slice(0, 10);
  const results: Array<{ cluster_id: string; name: string; score: number; competitor: number | null }> =
    [];

  for (const cluster of clusters as ClusterRow[]) {
    const { components, ownScore, competitorScore } = await computeCluster(admin, tenantId, cluster);
    await admin
      .from('blog_keyword_clusters')
      .update({ topical_authority_score: ownScore, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', cluster.id);

    // Upsert today's snapshot (idempotent re-runs overwrite the day's row).
    const { data: existing } = await admin
      .from('blog_cluster_authority_snapshots')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('cluster_id', cluster.id)
      .eq('snapshot_date', today)
      .limit(1)
      .maybeSingle();
    const payload = {
      tenant_id: tenantId,
      cluster_id: cluster.id,
      snapshot_date: today,
      authority_score: ownScore,
      competitor_score: competitorScore,
      components,
    };
    if (existing) {
      await admin
        .from('blog_cluster_authority_snapshots')
        .update(payload)
        .eq('id', existing.id);
    } else {
      await admin.from('blog_cluster_authority_snapshots').insert(payload);
    }

    results.push({
      cluster_id: cluster.id,
      name: cluster.name,
      score: ownScore,
      competitor: competitorScore,
    });
  }

  results.sort((a, b) => b.score - a.score);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_authority.score',
      targetType: 'blog_keyword_cluster',
      afterState: { scored: results.length },
      summary: `Recomputed topical authority for ${results.length} clusters`,
    }),
  );

  return createCorsResponse({ scored: results.length, results }, 200, req);
}

async function heatmap(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_keyword_clusters')
    .select('id, name, cluster_type, pillar_keyword, topical_authority_score, updated_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('topical_authority_score', { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ clusters: data ?? [] }, 200, req);
}

async function breakdown(admin: Admin, tenantId: string, clusterId: string, req: Request) {
  const { data: cluster } = await admin
    .from('blog_keyword_clusters')
    .select('id, name, pillar_keyword, topical_authority_score')
    .eq('tenant_id', tenantId)
    .eq('id', clusterId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!cluster) return createCorsResponse({ error: 'Cluster not found' }, 404, req);

  // 90-day trend.
  const since = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
  })();
  const { data: trend } = await admin
    .from('blog_cluster_authority_snapshots')
    .select('snapshot_date, authority_score, competitor_score, components')
    .eq('tenant_id', tenantId)
    .eq('cluster_id', clusterId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });

  const latest = (trend ?? [])[trend && trend.length ? trend.length - 1 : 0];
  return createCorsResponse(
    {
      cluster,
      current_score: cluster.topical_authority_score,
      latest_components: latest?.components ?? null,
      competitor_score: latest?.competitor_score ?? null,
      trend: trend ?? [],
    },
    200,
    req,
  );
}
