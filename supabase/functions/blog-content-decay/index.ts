// Blog Content Decay Detector Edge Function (US-BLOG-021)
//
// Compares each published post's last-28-day Search Console window to the prior
// 28-day window and flags decay when clicks drop >20%, impressions drop >25%, or
// average position worsens by >3. Decaying posts are written back to
// blog_posts.decay_score + last_decay_check_at and auto-queued into
// blog_refresh_queue with priority = severity. The GA4/Search Console INGESTION
// (the daily pull into blog_performance_metrics) is a separate concern — this
// function operates on whatever metrics already exist, so it is deterministic
// and testable independent of external credentials.
//
// Routes (gated to platform admin OR users holding blog.refresh.manage):
//   POST /blog-content-decay/detect      body: { post_id?, thresholds?, enqueue? }
//   GET  /blog-content-decay/dashboard   list decaying posts + 8-week click sparkline
//
// Thresholds are configurable per call (defaults below); a workspace can persist
// its own defaults in blog_agent_settings.config and pass them in — high-volume
// sites need different sensitivity than long-tail blogs.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const DEFAULT_THRESHOLDS = {
  clicks_drop_pct: 0.2,
  impressions_drop_pct: 0.25,
  position_drop: 3,
};

const thresholdsSchema = z
  .object({
    clicks_drop_pct: z.number().min(0).max(1).optional(),
    impressions_drop_pct: z.number().min(0).max(1).optional(),
    position_drop: z.number().min(0).max(100).optional(),
  })
  .optional();

const detectSchema = z.object({
  post_id: z.string().uuid().optional(),
  thresholds: thresholdsSchema,
  // When false, only score posts (don't add to the refresh queue). Default true.
  enqueue: z.boolean().optional(),
});

interface MetricRow {
  post_id: string;
  metric_date: string;
  impressions: number | null;
  clicks: number | null;
  position: number | null;
}

interface PostRow {
  id: string;
  title: string;
}

interface WindowAgg {
  clicks: number;
  impressions: number;
  // Impression-weighted average position (lower is better).
  position: number;
  days: number;
}

function hasRefreshManage(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && (perms.includes('blog.refresh.manage') || perms.includes('blog.post.edit')))
    return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function aggregate(rows: MetricRow[]): WindowAgg {
  let clicks = 0;
  let impressions = 0;
  let weightedPos = 0;
  let posWeight = 0;
  const days = new Set<string>();
  for (const r of rows) {
    clicks += r.clicks ?? 0;
    impressions += r.impressions ?? 0;
    if (r.position != null && r.impressions) {
      weightedPos += r.position * r.impressions;
      posWeight += r.impressions;
    }
    days.add(r.metric_date);
  }
  return {
    clicks,
    impressions,
    position: posWeight > 0 ? weightedPos / posWeight : 0,
    days: days.size,
  };
}

/** Severity 0..100 from how far each metric exceeds its decay threshold. */
function severity(
  current: WindowAgg,
  prior: WindowAgg,
  th: typeof DEFAULT_THRESHOLDS,
): { decaying: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (prior.clicks > 0) {
    const drop = (prior.clicks - current.clicks) / prior.clicks;
    if (drop > th.clicks_drop_pct) {
      reasons.push(`clicks -${Math.round(drop * 100)}%`);
      score += Math.min((drop - th.clicks_drop_pct) * 200, 40);
    }
  }
  if (prior.impressions > 0) {
    const drop = (prior.impressions - current.impressions) / prior.impressions;
    if (drop > th.impressions_drop_pct) {
      reasons.push(`impressions -${Math.round(drop * 100)}%`);
      score += Math.min((drop - th.impressions_drop_pct) * 160, 35);
    }
  }
  if (prior.position > 0 && current.position > 0) {
    const worse = current.position - prior.position; // positive = dropped down the SERP
    if (worse > th.position_drop) {
      reasons.push(`position +${worse.toFixed(1)}`);
      score += Math.min((worse - th.position_drop) * 6, 25);
    }
  }

  return { decaying: reasons.length > 0, score: Math.min(Math.round(score), 100), reasons };
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
    if (!hasRefreshManage(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.refresh.manage required' }, 403, req);
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
    const { parts } = normalizePath(url.pathname, 'blog-content-decay');
    const action = parts[0];

    if (action === 'detect' && req.method === 'POST') {
      return await detect(admin, tenantId, user.id, req);
    }
    if (action === 'dashboard' && req.method === 'GET') {
      return await dashboard(admin, tenantId, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-content-decay handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function detect(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown = {};
  if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
    try {
      body = await req.json();
    } catch {
      return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
    }
  }
  const parsed = detectSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const th = { ...DEFAULT_THRESHOLDS, ...(parsed.data.thresholds ?? {}) };
  const enqueue = parsed.data.enqueue ?? true;

  // Candidate posts.
  let postQuery = admin
    .from('blog_posts')
    .select('id, title')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .is('deleted_at', null);
  if (parsed.data.post_id) postQuery = postQuery.eq('id', parsed.data.post_id);
  const { data: posts } = await postQuery.limit(1000);
  if (!posts || posts.length === 0) {
    return createCorsResponse({ analyzed: 0, decaying: 0, results: [] }, 200, req);
  }

  // Pull 56 days of Search Console metrics for these posts in one query.
  const windowStart = daysAgoISO(56);
  const midpoint = daysAgoISO(28);
  const postIds = (posts as PostRow[]).map((p) => p.id);
  const { data: metrics } = await admin
    .from('blog_performance_metrics')
    .select('post_id, metric_date, impressions, clicks, position')
    .eq('tenant_id', tenantId)
    .eq('source', 'search_console')
    .gte('metric_date', windowStart)
    .in('post_id', postIds);

  const byPost = new Map<string, MetricRow[]>();
  for (const m of (metrics ?? []) as MetricRow[]) {
    const arr = byPost.get(m.post_id) ?? [];
    arr.push(m);
    byPost.set(m.post_id, arr);
  }

  const results: Array<{
    post_id: string;
    title: string;
    decaying: boolean;
    score: number;
    reasons: string[];
  }> = [];
  let decayingCount = 0;

  for (const post of posts as PostRow[]) {
    const rows = byPost.get(post.id) ?? [];
    if (rows.length === 0) continue; // no data — can't judge decay
    const current = aggregate(rows.filter((r) => r.metric_date >= midpoint));
    const prior = aggregate(rows.filter((r) => r.metric_date < midpoint));
    if (prior.days === 0) continue; // need a baseline window

    const sev = severity(current, prior, th);
    await admin
      .from('blog_posts')
      .update({ decay_score: sev.score, last_decay_check_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', post.id);

    if (sev.decaying) {
      decayingCount++;
      results.push({ post_id: post.id, title: post.title, ...sev });

      if (enqueue) {
        // Don't double-queue a post already waiting in the refresh queue.
        const { data: existing } = await admin
          .from('blog_refresh_queue')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('post_id', post.id)
          .in('status', ['queued', 'in_progress'])
          .limit(1)
          .maybeSingle();
        if (!existing) {
          await admin.from('blog_refresh_queue').insert({
            tenant_id: tenantId,
            post_id: post.id,
            reason: 'performance_drop',
            priority: sev.score,
            status: 'queued',
            result_summary: `Auto-flagged by decay detector: ${sev.reasons.join(', ')}`,
          });
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_decay.detect',
      targetType: 'blog_post',
      afterState: { analyzed: posts.length, decaying: decayingCount, thresholds: th, enqueue },
      summary: `Decay scan: ${decayingCount}/${posts.length} posts decaying`,
    }),
  );

  return createCorsResponse(
    { analyzed: posts.length, decaying: decayingCount, results },
    200,
    req,
  );
}

async function dashboard(admin: Admin, tenantId: string, req: Request) {
  // Top decaying posts by score.
  const { data: posts } = await admin
    .from('blog_posts')
    .select('id, title, slug, decay_score, last_decay_check_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .gt('decay_score', 0)
    .order('decay_score', { ascending: false })
    .limit(50);

  const ids = (posts ?? []).map((p) => p.id);
  // 8-week click sparkline per post (search_console).
  const sparkStart = daysAgoISO(56);
  const sparkByPost = new Map<string, { date: string; clicks: number }[]>();
  if (ids.length > 0) {
    const { data: metrics } = await admin
      .from('blog_performance_metrics')
      .select('post_id, metric_date, clicks')
      .eq('tenant_id', tenantId)
      .eq('source', 'search_console')
      .gte('metric_date', sparkStart)
      .in('post_id', ids)
      .order('metric_date', { ascending: true });
    for (const m of (metrics ?? []) as Array<{
      post_id: string;
      metric_date: string;
      clicks: number | null;
    }>) {
      const arr = sparkByPost.get(m.post_id) ?? [];
      arr.push({ date: m.metric_date, clicks: m.clicks ?? 0 });
      sparkByPost.set(m.post_id, arr);
    }
  }

  const cards = (posts ?? []).map((p) => ({
    ...p,
    sparkline: sparkByPost.get(p.id) ?? [],
  }));

  return createCorsResponse({ decaying_posts: cards }, 200, req);
}
