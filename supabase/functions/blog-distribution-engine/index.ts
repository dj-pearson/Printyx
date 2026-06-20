// Blog Distribution Engine Edge Function (US-BLOG-021, 052, 053, 054, 055, 063)
//
// The closed-loop "distribute + watch + refresh" side of the Universal Blog
// System. One edge function, six cooperating subsystems, all tenant-scoped:
//
//   US-BLOG-021  Content decay detector — 28d-vs-prior-28d Search Console/GA4
//                rolling-window scan; flags decaying posts, auto-enqueues them
//                into the EXISTING blog_refresh_queue, persists a decay_event +
//                (stubbed) Slack/email notification. Dashboard sparkline endpoint.
//   US-BLOG-052  Auto-scheduling with optimal-time prediction — builds a per
//                (tenant, platform) day-of-week x hour model from historical
//                blog_distributions/blog_syndication_pieces sends; smart-schedule
//                picks the next optimal slot, avoiding same-platform <2h conflicts.
//   US-BLOG-053  UTM strategy + per-channel link tracking — workspace UTM template
//                (utm_source=platform / utm_medium=channel / utm_campaign=slug),
//                bulk link-rewriter, short-link adapter stub, GA4 verifier stub.
//   US-BLOG-054  Re-share cadence engine — default T+0/+3/+7/+30/+90/+180 cadence;
//                each step auto-generates a fresh hook (generateCompletion);
//                pause/resume per post; auto-stop on low prior engagement;
//                distribution timeline (past + future).
//   US-BLOG-055  Internal-link auto-injection on publish — for a pillar post, find
//                semantically-similar posts with no link yet, propose anchor +
//                sentence edits (LLM) as a PR-style diff (accept/reject, never
//                auto-apply); on accept writes blog_post_revisions + (stub) CMS
//                push; backlink count on the pillar's stats endpoint.
//   US-BLOG-063  Refresh queue + auto-flagged decay candidates — reuses
//                blog_refresh_queue; companion blog_refresh_queue_details carries
//                suggested edits / effort / last_refreshed_at; start-refresh,
//                ranking-recovery monitor + auto-close.
//
// External services (Search Console, GA4, Bitly/Rebrandly, semantic similarity,
// CMS push) are ALL behind clearly-named adapter stubs with TODOs. Every adapter
// also accepts inline data in the request body so the flows are testable without
// live integrations. Results are always persisted.
//
// Auth/permission gate copied from blog-syndication: isPlatformAdmin OR perms
// include blog.distribution.publish / blog.post.edit OR role in
// {platform_admin, super_admin, company_admin}. Every mutation is audit-logged.
//
// Routes (tenant-scoped). Resource id at parts[0], action at parts[1]:
//   -- US-BLOG-021 decay --
//   POST   /blog-distribution-engine/decay/scan          run decay scan (daily job)
//   GET    /blog-distribution-engine/decay/dashboard     decaying posts + sparklines
//   GET    /blog-distribution-engine/decay/events        list decay events
//   -- US-BLOG-052 scheduling --
//   POST   /blog-distribution-engine/schedule/model      (re)compute optimal-time model(s)
//   GET    /blog-distribution-engine/schedule/models     list models
//   POST   /blog-distribution-engine/schedule/smart      pick next optimal slot(s)
//   -- US-BLOG-053 utm --
//   GET    /blog-distribution-engine/utm/template        get active UTM template
//   PUT    /blog-distribution-engine/utm/template        upsert UTM template
//   POST   /blog-distribution-engine/utm/rewrite         bulk link-rewriter (+short link)
//   POST   /blog-distribution-engine/utm/verify          GA4 UTM-session verifier (stub)
//   -- US-BLOG-054 re-share cadence --
//   POST   /blog-distribution-engine/cadence             create/seed cadence for a post
//   GET    /blog-distribution-engine/cadence/:postId     get cadence
//   POST   /blog-distribution-engine/cadence/:postId/pause
//   POST   /blog-distribution-engine/cadence/:postId/resume
//   POST   /blog-distribution-engine/cadence/:postId/advance   gen next hook / evaluate stop
//   GET    /blog-distribution-engine/cadence/:postId/timeline  past + scheduled shares
//   -- US-BLOG-055 internal links --
//   POST   /blog-distribution-engine/links/propose       propose injections for a pillar
//   POST   /blog-distribution-engine/links/:id/accept     accept one proposal
//   POST   /blog-distribution-engine/links/:id/reject     reject one proposal
//   POST   /blog-distribution-engine/links/batch/:batchId/accept   accept all
//   POST   /blog-distribution-engine/links/batch/:batchId/reject   reject all
//   GET    /blog-distribution-engine/links/pillar/:postId/stats    backlink count
//   -- US-BLOG-063 refresh queue --
//   GET    /blog-distribution-engine/refresh/queue       queue + details
//   POST   /blog-distribution-engine/refresh/:queueId/start    start refresh (annotations)
//   POST   /blog-distribution-engine/refresh/:queueId/recover  monitor + auto-close on recovery

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonObject } from '../_shared/blog/llm-json.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS = [
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
type Platform = (typeof PLATFORMS)[number];

/** utm_medium class per platform (US-BLOG-053). */
const PLATFORM_CHANNEL: Record<string, string> = {
  email: 'email',
  x: 'social',
  linkedin: 'social',
  facebook: 'social',
  instagram: 'social',
  tiktok: 'social',
  youtube_shorts: 'social',
  pinterest: 'social',
  reddit: 'community',
  hackernews: 'community',
  medium: 'syndication',
  substack: 'syndication',
  slack: 'community',
  discord: 'community',
};

/** Decay rule thresholds (US-BLOG-021). */
const DECAY_RULES = {
  clicksDropPct: 0.2, // clicks down > 20%
  impressionsDropPct: 0.25, // impressions down > 25%
  positionDrop: 3, // position dropped > 3 (rank got worse)
};

/** Severity -> blog_refresh_queue.priority. Higher = more urgent. */
const SEVERITY_PRIORITY: Record<string, number> = {
  none: 0,
  low: 40,
  medium: 70,
  high: 95,
};

/**
 * Industry-default optimal slots per platform for first-time platforms
 * (US-BLOG-052). dow: 0=Sun..6=Sat, hour: 0..23 local. Configurable via the
 * DEFAULT_SCHEDULE_OVERRIDES env (JSON) without a redeploy.
 */
const INDUSTRY_DEFAULT_SLOTS: Record<
  string,
  Array<{ dow: number; hour: number; score: number }>
> = {
  email: [
    { dow: 2, hour: 10, score: 0.9 },
    { dow: 4, hour: 10, score: 0.85 },
  ],
  x: [
    { dow: 3, hour: 12, score: 0.9 },
    { dow: 2, hour: 9, score: 0.85 },
  ],
  linkedin: [
    { dow: 2, hour: 8, score: 0.9 },
    { dow: 3, hour: 11, score: 0.85 },
  ],
  facebook: [{ dow: 4, hour: 13, score: 0.8 }],
  instagram: [{ dow: 3, hour: 11, score: 0.8 }],
  tiktok: [{ dow: 5, hour: 18, score: 0.8 }],
  youtube_shorts: [{ dow: 6, hour: 15, score: 0.78 }],
  pinterest: [{ dow: 6, hour: 20, score: 0.78 }],
  reddit: [{ dow: 1, hour: 9, score: 0.75 }],
  hackernews: [{ dow: 2, hour: 15, score: 0.75 }],
  medium: [{ dow: 2, hour: 10, score: 0.72 }],
  substack: [{ dow: 4, hour: 9, score: 0.72 }],
  slack: [{ dow: 1, hour: 9, score: 0.7 }],
  discord: [{ dow: 5, hour: 19, score: 0.7 }],
};

/** Default re-share cadence (US-BLOG-054). */
const DEFAULT_CADENCE: Array<{
  key: string;
  offset_days: number;
  platform: Platform;
  angle: string;
}> = [
  { key: 't0', offset_days: 0, platform: 'x', angle: 'launch announcement (all platforms)' },
  { key: 't3', offset_days: 3, platform: 'x', angle: 're-hook with a different opening line' },
  { key: 't7', offset_days: 7, platform: 'linkedin', angle: 'fresh professional angle' },
  { key: 't30', offset_days: 30, platform: 'reddit', angle: 'community resurface, value-first' },
  { key: 't90', offset_days: 90, platform: 'x', angle: 'evergreen reminder' },
  { key: 't180', offset_days: 180, platform: 'linkedin', angle: 'updated-with-new-data angle' },
];

const SCHEDULE_CONFLICT_MS = 2 * 60 * 60 * 1000; // no two sends within 2h (US-BLOG-052)
const RESHARE_ENGAGEMENT_STOP_DEFAULT = 0.02; // stop cadence below this prior engagement

// ---------------------------------------------------------------------------
// Auth/permission gate (copied from blog-syndication)
// ---------------------------------------------------------------------------

function hasDistributionPublish(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.distribution.publish') || perms.includes('blog.post.edit'))
  ) {
    return true;
  }
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

// ===========================================================================
// External-service ADAPTER STUBS (US-BLOG-021/053/055). All accept inline data
// for testability and carry TODOs for the real integration.
// ===========================================================================

interface PostMetrics {
  clicks: number;
  impressions: number;
  position: number;
  ctr?: number;
}

/**
 * Search Console + GA4 adapter (US-BLOG-021). Returns the current 28-day window
 * and the prior 28-day window per post.
 *
 * TODO: wire to Google Search Console Search Analytics API (clicks/impressions/
 * position/ctr) + GA4 Data API (sessions/pageviews) using the tenant's stored
 * OAuth credentials (credential vault). Until then we read whatever is already
 * in blog_performance_metrics, and accept an inline `metricsByPost` override.
 */
async function fetchDecayMetrics(
  admin: Admin,
  tenantId: string,
  postId: string,
  asOf: Date,
  inline?: { current?: PostMetrics; prior?: PostMetrics },
): Promise<{ current: PostMetrics; prior: PostMetrics }> {
  if (inline?.current && inline?.prior) {
    return { current: inline.current, prior: inline.prior };
  }
  // Fall back to aggregating blog_performance_metrics rows (search_console source).
  const dayMs = 24 * 60 * 60 * 1000;
  const curStart = new Date(asOf.getTime() - 28 * dayMs);
  const priorStart = new Date(asOf.getTime() - 56 * dayMs);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { data } = await admin
    .from('blog_performance_metrics')
    .select('metric_date,source,clicks,impressions,position,ctr')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .gte('metric_date', iso(priorStart))
    .lte('metric_date', iso(asOf));

  const rows = (data ?? []) as Array<{
    metric_date: string;
    clicks: number | null;
    impressions: number | null;
    position: number | null;
    ctr: number | null;
  }>;

  const agg = (from: Date, to: Date): PostMetrics => {
    const slice = rows.filter((r) => {
      const d = new Date(r.metric_date);
      return d >= from && d < to;
    });
    const clicks = slice.reduce((s, r) => s + (r.clicks ?? 0), 0);
    const impressions = slice.reduce((s, r) => s + (r.impressions ?? 0), 0);
    const positions = slice.map((r) => r.position ?? 0).filter((p) => p > 0);
    const position = positions.length ? positions.reduce((s, p) => s + p, 0) / positions.length : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    return { clicks, impressions, position, ctr };
  };

  return {
    current: agg(curStart, new Date(asOf.getTime() + dayMs)),
    prior: agg(priorStart, curStart),
  };
}

/**
 * Notification adapter (US-BLOG-021). Stub: we never actually send; we record
 * the intent. TODO: post to Slack incoming webhook / send email via the tenant's
 * configured channel from blog_distribution_targets / settings.
 */
function sendDecayNotificationStub(
  channel: 'slack' | 'email' | null,
  payload: Record<string, unknown>,
): { channel: string | null; status: 'pending' | 'skipped'; detail: Record<string, unknown> } {
  if (!channel) return { channel: null, status: 'skipped', detail: { reason: 'no channel' } };
  // TODO: real send. For now mark pending so a worker can pick it up.
  return { channel, status: 'pending', detail: { stubbed: true, payload } };
}

/**
 * Short-link adapter (US-BLOG-053). Stub for Bitly/Rebrandly. TODO: call the
 * provider API with the tenant's vault-stored token; return the shortened URL.
 */
function shortenLinkStub(
  provider: string | null,
  longUrl: string,
): { provider: string | null; short_url: string | null; stubbed: boolean } {
  if (!provider) return { provider: null, short_url: null, stubbed: true };
  // TODO: real Bitly/Rebrandly call. Deterministic fake so callers can render UI.
  const hash = Math.abs([...longUrl].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))
    .toString(36)
    .slice(0, 7);
  const domain = provider === 'rebrandly' ? 'rebrand.ly' : 'bit.ly';
  return { provider, short_url: `https://${domain}/${hash}`, stubbed: true };
}

/**
 * GA4 UTM-session verifier (US-BLOG-053). Stub. TODO: query GA4 Data API for
 * sessions filtered by the UTM campaign and confirm arrivals.
 */
function verifyUtmSessionsStub(
  campaign: string,
  inline?: { sessions?: number },
): { campaign: string; sessions: number; verified: boolean; stubbed: boolean } {
  const sessions = inline?.sessions ?? 0;
  return { campaign, sessions, verified: sessions > 0, stubbed: true };
}

/**
 * Semantic-similarity adapter (US-BLOG-055). Stub. TODO: embed the pillar + each
 * candidate post and rank by cosine similarity. Accepts inline candidate scores
 * for testability.
 */
async function findSimilarPosts(
  admin: Admin,
  tenantId: string,
  pillarPostId: string,
  topN: number,
  inline?: Array<{ post_id: string; score: number }>,
): Promise<Array<{ post_id: string; score: number }>> {
  if (inline && inline.length) {
    return inline
      .filter((c) => c.post_id !== pillarPostId)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }
  // TODO: real embeddings. Fallback heuristic: published posts that don't already
  // link the pillar, scored by a neutral placeholder so the flow is exercisable.
  const { data } = await admin
    .from('blog_posts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .neq('id', pillarPostId)
    .limit(topN);
  return ((data ?? []) as Array<{ id: string }>).map((r) => ({ post_id: r.id, score: 0.5 }));
}

/**
 * CMS re-publish adapter (US-BLOG-055/063). Stub. TODO: push the updated body to
 * the post's CMS target via the cms/ adapter registry.
 */
function cmsRepublishStub(
  postId: string,
  note: string,
): { adapter: string; status: 'queued'; note: string; stubbed: boolean } {
  return { adapter: 'cms-registry', status: 'queued', note: `${postId}: ${note}`, stubbed: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTenantId(
  user: {
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  },
  req: Request,
): string | null {
  return (
    (user.app_metadata?.tenantId as string) ||
    (user.app_metadata?.tenant_id as string) ||
    (user.user_metadata?.tenantId as string) ||
    (user.user_metadata?.tenant_id as string) ||
    req.headers.get('x-tenant-id') ||
    null
  );
}

async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

function severityFromTriggers(triggers: string[]): string {
  if (triggers.length >= 3) return 'high';
  if (triggers.length === 2) return 'medium';
  if (triggers.length === 1) return 'low';
  return 'none';
}

// ===========================================================================
// US-BLOG-021 — Content decay detector
// ===========================================================================

const decayScanSchema = z.object({
  /** Optional explicit set of posts; default = all published posts. */
  post_ids: z.array(z.string().uuid()).optional(),
  as_of: z.string().datetime().optional(),
  notification_channel: z.enum(['slack', 'email']).nullable().optional(),
  /** Inline metrics for testability: { [postId]: { current, prior } }. */
  metrics_by_post: z
    .record(
      z.object({
        current: z.object({
          clicks: z.number(),
          impressions: z.number(),
          position: z.number(),
          ctr: z.number().optional(),
        }),
        prior: z.object({
          clicks: z.number(),
          impressions: z.number(),
          position: z.number(),
          ctr: z.number().optional(),
        }),
      }),
    )
    .optional(),
});

function evaluateDecay(
  current: PostMetrics,
  prior: PostMetrics,
): { triggers: string[]; deltas: Record<string, number> } {
  const triggers: string[] = [];
  const clicksPct = prior.clicks > 0 ? (current.clicks - prior.clicks) / prior.clicks : 0;
  const imprPct =
    prior.impressions > 0 ? (current.impressions - prior.impressions) / prior.impressions : 0;
  // Position: higher number = worse rank. "dropped > 3" = got worse by >3.
  const positionDelta = current.position - prior.position;

  if (prior.clicks > 0 && clicksPct < -DECAY_RULES.clicksDropPct) triggers.push('clicks');
  if (prior.impressions > 0 && imprPct < -DECAY_RULES.impressionsDropPct)
    triggers.push('impressions');
  if (prior.position > 0 && positionDelta > DECAY_RULES.positionDrop) triggers.push('position');

  return {
    triggers,
    deltas: {
      clicks_pct: Number((clicksPct * 100).toFixed(2)),
      impressions_pct: Number((imprPct * 100).toFixed(2)),
      position_delta: Number(positionDelta.toFixed(2)),
    },
  };
}

async function decayScan(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = (await parseBody<unknown>(req)) ?? {};
  const parsed = decayScanSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const asOf = parsed.data.as_of ? new Date(parsed.data.as_of) : new Date();
  const channel = parsed.data.notification_channel ?? null;

  // Target posts: explicit list or all published.
  let postIds = parsed.data.post_ids ?? null;
  if (!postIds) {
    const { data } = await admin
      .from('blog_posts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'published')
      .is('deleted_at', null)
      .limit(1000);
    postIds = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  }

  const flagged: Array<Record<string, unknown>> = [];
  for (const postId of postIds) {
    const inline = parsed.data.metrics_by_post?.[postId];
    const { current, prior } = await fetchDecayMetrics(admin, tenantId, postId, asOf, inline);
    const { triggers, deltas } = evaluateDecay(current, prior);
    if (triggers.length === 0) continue;

    const severity = severityFromTriggers(triggers);
    const priority = SEVERITY_PRIORITY[severity] ?? 50;

    // Auto-add to EXISTING blog_refresh_queue (or refresh an existing open item).
    const { data: existingQueue } = await admin
      .from('blog_refresh_queue')
      .select('id,priority,status')
      .eq('tenant_id', tenantId)
      .eq('post_id', postId)
      .in('status', ['queued', 'in_progress'])
      .limit(1)
      .maybeSingle();

    let queueId: string | null = existingQueue?.id ?? null;
    if (queueId) {
      await admin
        .from('blog_refresh_queue')
        .update({
          reason: 'serp_decay',
          priority: Math.max(priority, (existingQueue?.priority as number) ?? 0),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', queueId);
    } else {
      const { data: inserted } = await admin
        .from('blog_refresh_queue')
        .insert({
          tenant_id: tenantId,
          post_id: postId,
          reason: 'serp_decay',
          priority,
          status: 'queued',
        })
        .select('id')
        .single();
      queueId = inserted?.id ?? null;
    }

    // Upsert companion details (US-BLOG-063 fields populated by 021).
    if (queueId) {
      const { data: existingDetail } = await admin
        .from('blog_refresh_queue_details')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('queue_id', queueId)
        .maybeSingle();
      if (existingDetail) {
        await admin
          .from('blog_refresh_queue_details')
          .update({
            severity,
            baseline_position: current.position,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('id', existingDetail.id);
      } else {
        await admin.from('blog_refresh_queue_details').insert({
          tenant_id: tenantId,
          queue_id: queueId,
          post_id: postId,
          severity,
          baseline_position: current.position,
        });
      }
    }

    // Notification (stubbed) — persisted on the decay_event.
    const notif = sendDecayNotificationStub(channel, {
      post_id: postId,
      severity,
      triggers,
      deltas,
    });

    // Persist decay_event.
    const { data: event } = await admin
      .from('blog_decay_events')
      .insert({
        tenant_id: tenantId,
        post_id: postId,
        severity,
        triggers,
        current_window: current,
        prior_window: prior,
        deltas,
        refresh_queue_id: queueId,
        notification_channel: notif.channel,
        notification_status: notif.status,
        notification_detail: notif.detail,
        detected_at: asOf.toISOString(),
        created_by_user_id: userId,
      })
      .select()
      .single();

    // Keep blog_posts.decay_score / last_decay_check_at fresh (columns exist).
    await admin
      .from('blog_posts')
      .update({
        decay_score: priority,
        last_decay_check_at: asOf.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', postId);

    flagged.push({
      post_id: postId,
      severity,
      triggers,
      deltas,
      refresh_queue_id: queueId,
      event_id: event?.id,
    });
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.decay_scan',
      targetType: 'blog_decay_scan',
      targetId: null,
      summary: `Decay scan flagged ${flagged.length}/${postIds.length} posts`,
      afterState: { scanned: postIds.length, flagged: flagged.length },
    }),
  );

  return createCorsResponse({ scanned: postIds.length, flagged }, 200, req);
}

async function decayDashboard(admin: Admin, tenantId: string, url: URL, req: Request) {
  // Decaying posts = those with an open serp_decay queue item; sparkline = recent
  // clicks per metric_date per post (US-BLOG-021 dashboard).
  const { data: queueRows } = await admin
    .from('blog_refresh_queue')
    .select('id,post_id,priority,status,reason,scheduled_at')
    .eq('tenant_id', tenantId)
    .eq('reason', 'serp_decay')
    .in('status', ['queued', 'in_progress'])
    .order('priority', { ascending: false })
    .limit(200);

  const rows = (queueRows ?? []) as Array<{ id: string; post_id: string; priority: number }>;
  const postIds = [...new Set(rows.map((r) => r.post_id))];

  // Sparkline series per post: last 56 days of clicks/impressions/position.
  const since = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sparklines: Record<string, Array<Record<string, unknown>>> = {};
  if (postIds.length) {
    const { data: metrics } = await admin
      .from('blog_performance_metrics')
      .select('post_id,metric_date,clicks,impressions,position')
      .eq('tenant_id', tenantId)
      .in('post_id', postIds)
      .gte('metric_date', since)
      .order('metric_date', { ascending: true });
    for (const m of (metrics ?? []) as Array<Record<string, unknown>>) {
      const pid = m.post_id as string;
      (sparklines[pid] ??= []).push({
        date: m.metric_date,
        clicks: m.clicks,
        impressions: m.impressions,
        position: m.position,
      });
    }
  }

  // Latest decay_event per post for severity/deltas.
  const { data: events } = await admin
    .from('blog_decay_events')
    .select('post_id,severity,deltas,detected_at')
    .eq('tenant_id', tenantId)
    .in('post_id', postIds.length ? postIds : ['00000000-0000-0000-0000-000000000000'])
    .order('detected_at', { ascending: false });
  const latestEvent: Record<string, Record<string, unknown>> = {};
  for (const e of (events ?? []) as Array<Record<string, unknown>>) {
    const pid = e.post_id as string;
    if (!latestEvent[pid]) latestEvent[pid] = e;
  }

  const posts = rows.map((r) => ({
    post_id: r.post_id,
    queue_id: r.id,
    priority: r.priority,
    severity: latestEvent[r.post_id]?.severity ?? null,
    deltas: latestEvent[r.post_id]?.deltas ?? null,
    sparkline: sparklines[r.post_id] ?? [],
  }));

  return createCorsResponse({ decaying_posts: posts }, 200, req);
}

async function listDecayEvents(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_decay_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('detected_at', { ascending: false })
    .limit(200);
  const postId = url.searchParams.get('post_id');
  if (postId) q = q.eq('post_id', postId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list decay events' }, 500, req);
  return createCorsResponse({ events: data ?? [] }, 200, req);
}

// ===========================================================================
// US-BLOG-052 — Auto-scheduling with optimal-time prediction
// ===========================================================================

const buildModelSchema = z.object({
  platforms: z.array(z.enum(PLATFORMS)).optional(), // default = all with history
});

/** Read historical sends (blog_distributions + blog_syndication_pieces) into engagement-weighted buckets. */
async function computeBuckets(
  admin: Admin,
  tenantId: string,
  platform: string,
): Promise<{ buckets: Record<string, number>; sampleSize: number }> {
  const buckets: Record<string, number> = {};
  let sampleSize = 0;

  const addSample = (when: string | null, engagement: number) => {
    if (!when) return;
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getUTCDay()}:${d.getUTCHours()}`;
    buckets[key] = (buckets[key] ?? 0) + Math.max(engagement, 0.01);
    sampleSize += 1;
  };

  const engagementOf = (m: unknown): number => {
    const e = (m ?? {}) as Record<string, unknown>;
    const n = (k: string) => (typeof e[k] === 'number' ? (e[k] as number) : 0);
    return n('clicks') + n('likes') + n('shares') + n('comments') + n('engagements');
  };

  // blog_distributions — sent_at proxy = published_at; engagement_metrics jsonb.
  const { data: dists } = await admin
    .from('blog_distributions')
    .select('published_at,engagement_metrics')
    .eq('tenant_id', tenantId)
    .eq('platform', platform)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .limit(2000);
  for (const r of (dists ?? []) as Array<Record<string, unknown>>) {
    addSample(r.published_at as string, engagementOf(r.engagement_metrics));
  }

  // blog_syndication_pieces — sent_at + content may carry engagement snapshots.
  const { data: pieces } = await admin
    .from('blog_syndication_pieces')
    .select('sent_at,content')
    .eq('tenant_id', tenantId)
    .eq('platform', platform)
    .not('sent_at', 'is', null)
    .is('deleted_at', null)
    .limit(2000);
  for (const r of (pieces ?? []) as Array<Record<string, unknown>>) {
    const content = (r.content ?? {}) as Record<string, unknown>;
    addSample(r.sent_at as string, engagementOf(content.engagement));
  }

  return { buckets, sampleSize };
}

function rankSlots(
  buckets: Record<string, number>,
): Array<{ dow: number; hour: number; score: number }> {
  const entries = Object.entries(buckets);
  if (!entries.length) return [];
  const max = Math.max(...entries.map(([, v]) => v));
  return entries
    .map(([key, v]) => {
      const [dow, hour] = key.split(':').map(Number);
      return { dow, hour, score: max > 0 ? Number((v / max).toFixed(4)) : 0 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}

function envDefaultSlots(platform: string): Array<{ dow: number; hour: number; score: number }> {
  try {
    const override = Deno.env.get('DEFAULT_SCHEDULE_OVERRIDES');
    if (override) {
      const parsed = JSON.parse(override) as Record<
        string,
        Array<{ dow: number; hour: number; score: number }>
      >;
      if (parsed[platform]) return parsed[platform];
    }
  } catch {
    // ignore malformed env
  }
  return INDUSTRY_DEFAULT_SLOTS[platform] ?? [{ dow: 2, hour: 10, score: 0.6 }];
}

async function upsertScheduleModel(
  admin: Admin,
  tenantId: string,
  userId: string,
  platform: string,
) {
  const { buckets, sampleSize } = await computeBuckets(admin, tenantId, platform);
  let rankedSlots = rankSlots(buckets);
  let source = 'history';
  if (rankedSlots.length === 0) {
    rankedSlots = envDefaultSlots(platform);
    source = 'industry_default';
  }

  const { data: existing } = await admin
    .from('blog_schedule_models')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('platform', platform)
    .maybeSingle();

  const payload = {
    tenant_id: tenantId,
    platform,
    buckets,
    ranked_slots: rankedSlots,
    source,
    sample_size: sampleSize,
    computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by_user_id: userId,
  };

  let row;
  if (existing) {
    const { data } = await admin
      .from('blog_schedule_models')
      .update(payload)
      .eq('tenant_id', tenantId)
      .eq('id', existing.id)
      .select()
      .single();
    row = data;
  } else {
    const { data } = await admin.from('blog_schedule_models').insert(payload).select().single();
    row = data;
  }
  return row;
}

async function buildModels(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = (await parseBody<unknown>(req)) ?? {};
  const parsed = buildModelSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const platforms = parsed.data.platforms ?? PLATFORMS;
  const models = [];
  for (const p of platforms) {
    models.push(await upsertScheduleModel(admin, tenantId, userId, p));
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.schedule_model',
      targetType: 'blog_schedule_model',
      targetId: null,
      summary: `Computed ${models.length} optimal-time models`,
    }),
  );
  return createCorsResponse({ models }, 200, req);
}

async function listModels(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_schedule_models')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('platform', { ascending: true });
  if (error) return createCorsResponse({ error: 'Failed to list models' }, 500, req);
  return createCorsResponse({ models: data ?? [] }, 200, req);
}

const smartScheduleSchema = z.object({
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  /** Earliest acceptable slot (defaults to now). */
  after: z.string().datetime().optional(),
  /** Manual override per platform — always honored (US-BLOG-052). */
  overrides: z.record(z.string().datetime()).optional(),
  /** Optional post id to associate / log against. */
  post_id: z.string().uuid().optional(),
});

/** Next datetime >= after that matches dow/hour. */
function nextSlotDate(after: Date, dow: number, hour: number): Date {
  const d = new Date(after.getTime());
  d.setUTCMinutes(0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const cand = new Date(d.getTime());
    cand.setUTCDate(d.getUTCDate() + i);
    cand.setUTCHours(hour, 0, 0, 0);
    if (cand.getUTCDay() === dow && cand.getTime() >= after.getTime()) return cand;
  }
  // Fallback: after + (i) days at the hour.
  const fb = new Date(after.getTime() + 24 * 60 * 60 * 1000);
  fb.setUTCHours(hour, 0, 0, 0);
  return fb;
}

async function smartSchedule(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseBody<unknown>(req);
  const parsed = smartScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const after = parsed.data.after ? new Date(parsed.data.after) : new Date();
  const results: Array<Record<string, unknown>> = [];

  // Existing scheduled sends per platform for conflict avoidance (<2h).
  for (const platform of parsed.data.platforms) {
    // Manual override always wins.
    const override = parsed.data.overrides?.[platform];
    if (override) {
      results.push({ platform, scheduled_at: override, source: 'manual_override' });
      continue;
    }

    // Load model (or build a default-backed one on the fly).
    let { data: model } = await admin
      .from('blog_schedule_models')
      .select('ranked_slots,source')
      .eq('tenant_id', tenantId)
      .eq('platform', platform)
      .maybeSingle();
    if (!model) {
      const built = await upsertScheduleModel(admin, tenantId, userId, platform);
      model = built ? { ranked_slots: built.ranked_slots, source: built.source } : null;
    }
    const slots = (model?.ranked_slots ?? envDefaultSlots(platform)) as Array<{
      dow: number;
      hour: number;
      score: number;
    }>;

    // Gather already-scheduled times on this platform for conflict checks.
    const { data: distScheduled } = await admin
      .from('blog_distributions')
      .select('scheduled_for')
      .eq('tenant_id', tenantId)
      .eq('platform', platform)
      .in('status', ['scheduled'])
      .not('scheduled_for', 'is', null);
    const { data: pieceScheduled } = await admin
      .from('blog_syndication_pieces')
      .select('scheduled_at')
      .eq('tenant_id', tenantId)
      .eq('platform', platform)
      .eq('status', 'scheduled')
      .is('deleted_at', null)
      .not('scheduled_at', 'is', null);
    const taken = [
      ...((distScheduled ?? []) as Array<{ scheduled_for: string }>).map((r) =>
        new Date(r.scheduled_for).getTime(),
      ),
      ...((pieceScheduled ?? []) as Array<{ scheduled_at: string }>).map((r) =>
        new Date(r.scheduled_at).getTime(),
      ),
    ];

    // Walk ranked slots, stepping forward a week at a time until no <2h conflict.
    let chosen: Date | null = null;
    outer: for (const slot of slots.length ? slots : envDefaultSlots(platform)) {
      let cand = nextSlotDate(after, slot.dow, slot.hour);
      for (let week = 0; week < 8; week++) {
        const conflict = taken.some((t) => Math.abs(t - cand.getTime()) < SCHEDULE_CONFLICT_MS);
        if (!conflict) {
          chosen = cand;
          break outer;
        }
        cand = new Date(cand.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }
    if (!chosen) chosen = new Date(after.getTime() + SCHEDULE_CONFLICT_MS);

    results.push({
      platform,
      scheduled_at: chosen.toISOString(),
      source: model?.source ?? 'industry_default',
    });
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.smart_schedule',
      targetType: 'blog_post',
      targetId: parsed.data.post_id ?? null,
      afterState: { slots: results },
    }),
  );
  return createCorsResponse({ slots: results }, 200, req);
}

// ===========================================================================
// US-BLOG-053 — UTM strategy + per-channel link tracking
// ===========================================================================

const utmTemplateSchema = z.object({
  name: z.string().max(200).optional(),
  source_template: z.string().max(200).optional(),
  medium_template: z.string().max(200).optional(),
  campaign_template: z.string().max(200).optional(),
  content_template: z.string().max(200).nullable().optional(),
  term_template: z.string().max(200).nullable().optional(),
  short_link_provider: z.enum(['bitly', 'rebrandly']).nullable().optional(),
  /** Plaintext token — only *_set markers and non-secret config are stored back. */
  short_link_config: z.record(z.unknown()).optional(),
});

async function getUtmTemplate(admin: Admin, tenantId: string, req: Request) {
  const { data } = await admin
    .from('blog_utm_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .maybeSingle();
  return createCorsResponse({ template: data ?? null }, 200, req);
}

async function putUtmTemplate(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseBody<unknown>(req);
  const parsed = utmTemplateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;
  // Never persist secrets; reduce short_link_config to *_set markers (pattern 7).
  let shortLinkConfig: Record<string, unknown> | null = null;
  if (d.short_link_config) {
    shortLinkConfig = {};
    for (const [k, v] of Object.entries(d.short_link_config)) {
      if (
        k.toLowerCase().includes('token') ||
        k.toLowerCase().includes('key') ||
        k.toLowerCase().includes('secret')
      ) {
        shortLinkConfig[`${k}_set`] = Boolean(v);
      } else {
        shortLinkConfig[k] = v;
      }
    }
    // TODO: encrypt the real token via the credential vault and store the ciphertext.
  }

  const { data: existing } = await admin
    .from('blog_utm_templates')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .maybeSingle();

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (d.name !== undefined) payload.name = d.name;
  if (d.source_template !== undefined) payload.source_template = d.source_template;
  if (d.medium_template !== undefined) payload.medium_template = d.medium_template;
  if (d.campaign_template !== undefined) payload.campaign_template = d.campaign_template;
  if (d.content_template !== undefined) payload.content_template = d.content_template;
  if (d.term_template !== undefined) payload.term_template = d.term_template;
  if (d.short_link_provider !== undefined) payload.short_link_provider = d.short_link_provider;
  if (shortLinkConfig !== null) payload.short_link_config = shortLinkConfig;

  let row;
  if (existing) {
    const { data } = await admin
      .from('blog_utm_templates')
      .update(payload)
      .eq('tenant_id', tenantId)
      .eq('id', existing.id)
      .select()
      .single();
    row = data;
  } else {
    const { data } = await admin
      .from('blog_utm_templates')
      .insert({ tenant_id: tenantId, is_default: true, created_by_user_id: userId, ...payload })
      .select()
      .single();
    row = data;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.utm_template_upsert',
      targetType: 'blog_utm_template',
      targetId: row?.id ?? null,
      summary: 'Upserted UTM template',
    }),
  );
  return createCorsResponse({ template: row }, 200, req);
}

const rewriteSchema = z.object({
  url: z.string().url(),
  post_slug: z.string().max(500),
  platforms: z.array(z.enum(PLATFORMS)).optional(),
  short_link: z.boolean().optional(),
});

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

function buildUtmUrl(
  base: string,
  tpl: {
    source_template: string;
    medium_template: string;
    campaign_template: string;
    content_template?: string | null;
    term_template?: string | null;
  } | null,
  platform: string,
  postSlug: string,
): string {
  const vars = { platform, channel: PLATFORM_CHANNEL[platform] ?? 'social', post_slug: postSlug };
  const params: Record<string, string> = {
    utm_source: interpolate(tpl?.source_template ?? '{platform}', vars),
    utm_medium: interpolate(tpl?.medium_template ?? '{channel}', vars),
    utm_campaign: interpolate(tpl?.campaign_template ?? '{post_slug}', vars),
  };
  if (tpl?.content_template) params.utm_content = interpolate(tpl.content_template, vars);
  if (tpl?.term_template) params.utm_term = interpolate(tpl.term_template, vars);
  const qp = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${qp}`;
}

async function rewriteLinks(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseBody<unknown>(req);
  const parsed = rewriteSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const platforms = parsed.data.platforms ?? PLATFORMS;
  const { data: tpl } = await admin
    .from('blog_utm_templates')
    .select(
      'source_template,medium_template,campaign_template,content_template,term_template,short_link_provider',
    )
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .maybeSingle();

  const links = platforms.map((platform) => {
    const tagged = buildUtmUrl(parsed.data.url, tpl as never, platform, parsed.data.post_slug);
    const out: Record<string, unknown> = {
      platform,
      channel: PLATFORM_CHANNEL[platform] ?? 'social',
      url: tagged,
    };
    if (parsed.data.short_link) {
      out.short = shortenLinkStub((tpl?.short_link_provider as string) ?? null, tagged);
    }
    return out;
  });

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.utm_rewrite',
      targetType: 'blog_post',
      targetId: null,
      summary: `Rewrote ${links.length} UTM links for "${parsed.data.post_slug}"`,
    }),
  );
  return createCorsResponse({ links }, 200, req);
}

const verifySchema = z.object({
  campaign: z.string().max(200),
  /** Inline session count for testability (GA4 is stubbed). */
  sessions: z.number().optional(),
});

async function verifyUtm(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseBody<unknown>(req);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const result = verifyUtmSessionsStub(parsed.data.campaign, { sessions: parsed.data.sessions });
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.utm_verify',
      targetType: 'blog_utm_template',
      targetId: null,
      afterState: result,
    }),
  );
  return createCorsResponse({ verification: result }, 200, req);
}

// ===========================================================================
// US-BLOG-054 — Re-share cadence engine
// ===========================================================================

const createCadenceSchema = z.object({
  post_id: z.string().uuid(),
  published_at: z.string().datetime().optional(),
  engagement_stop_threshold: z.number().optional(),
  /** Optional custom steps; defaults to DEFAULT_CADENCE. */
  steps: z
    .array(
      z.object({
        key: z.string().max(40),
        offset_days: z.number().int(),
        platform: z.enum(PLATFORMS),
        angle: z.string().max(300).optional(),
      }),
    )
    .optional(),
});

function buildCadenceSteps(
  base: Array<{ key: string; offset_days: number; platform: string; angle?: string }>,
  publishedAt: Date,
) {
  return base.map((s) => ({
    key: s.key,
    offset_days: s.offset_days,
    platform: s.platform,
    angle: s.angle ?? '',
    status: 'planned',
    scheduled_at: new Date(
      publishedAt.getTime() + s.offset_days * 24 * 60 * 60 * 1000,
    ).toISOString(),
    variant_hook: null as string | null,
    syndication_piece_id: null as string | null,
    engagement_score: null as number | null,
  }));
}

async function createCadence(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseBody<unknown>(req);
  const parsed = createCadenceSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  // Verify post belongs to tenant.
  const { data: post } = await admin
    .from('blog_posts')
    .select('id,published_at')
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const publishedAt = parsed.data.published_at
    ? new Date(parsed.data.published_at)
    : post.published_at
      ? new Date(post.published_at as string)
      : new Date();
  const steps = buildCadenceSteps(parsed.data.steps ?? DEFAULT_CADENCE, publishedAt);

  // One cadence per post — upsert.
  const { data: existing } = await admin
    .from('blog_reshare_cadences')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('post_id', parsed.data.post_id)
    .is('deleted_at', null)
    .maybeSingle();

  const payload = {
    tenant_id: tenantId,
    post_id: parsed.data.post_id,
    published_at: publishedAt.toISOString(),
    steps,
    paused: false,
    engagement_stop_threshold:
      parsed.data.engagement_stop_threshold ?? RESHARE_ENGAGEMENT_STOP_DEFAULT,
    updated_at: new Date().toISOString(),
    created_by_user_id: userId,
  };

  let row;
  if (existing) {
    const { data } = await admin
      .from('blog_reshare_cadences')
      .update(payload)
      .eq('tenant_id', tenantId)
      .eq('id', existing.id)
      .select()
      .single();
    row = data;
  } else {
    const { data } = await admin.from('blog_reshare_cadences').insert(payload).select().single();
    row = data;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.cadence_create',
      targetType: 'blog_reshare_cadence',
      targetId: row?.id ?? null,
      summary: `Seeded re-share cadence (${steps.length} steps)`,
    }),
  );
  return createCorsResponse({ cadence: row }, 201, req);
}

async function loadCadence(admin: Admin, tenantId: string, postId: string) {
  const { data } = await admin
    .from('blog_reshare_cadences')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}

async function getCadence(admin: Admin, tenantId: string, postId: string, req: Request) {
  const row = await loadCadence(admin, tenantId, postId);
  if (!row) return createCorsResponse({ error: 'Cadence not found' }, 404, req);
  return createCorsResponse({ cadence: row }, 200, req);
}

async function pauseResumeCadence(
  admin: Admin,
  tenantId: string,
  userId: string,
  postId: string,
  paused: boolean,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_reshare_cadences')
    .update({ paused, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to update cadence' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Cadence not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: paused ? 'blog_distribution.cadence_pause' : 'blog_distribution.cadence_resume',
      targetType: 'blog_reshare_cadence',
      targetId: data.id,
      afterState: { paused },
    }),
  );
  return createCorsResponse({ cadence: data }, 200, req);
}

const advanceSchema = z.object({
  step_key: z.string().max(40),
  /** Prior re-share engagement score used for the auto-stop decision. */
  prior_engagement: z.number().optional(),
});

/** Advance one cadence step: generate a fresh hook, evaluate the auto-stop rule. */
async function advanceCadence(
  admin: Admin,
  tenantId: string,
  userId: string,
  postId: string,
  req: Request,
) {
  const body = await parseBody<unknown>(req);
  const parsed = advanceSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const cadence = await loadCadence(admin, tenantId, postId);
  if (!cadence) return createCorsResponse({ error: 'Cadence not found' }, 404, req);
  if (cadence.paused) {
    return createCorsResponse({ error: 'Cadence is paused — resume before advancing.' }, 409, req);
  }

  const steps = (cadence.steps as Array<Record<string, unknown>>) ?? [];
  const idx = steps.findIndex((s) => s.key === parsed.data.step_key);
  if (idx === -1) return createCorsResponse({ error: 'Step not found' }, 404, req);

  // Auto-stop if prior re-share engagement is below threshold (US-BLOG-054).
  const threshold = Number(cadence.engagement_stop_threshold ?? RESHARE_ENGAGEMENT_STOP_DEFAULT);
  if (parsed.data.prior_engagement !== undefined && parsed.data.prior_engagement < threshold) {
    steps[idx].status = 'stopped';
    const { data } = await admin
      .from('blog_reshare_cadences')
      .update({
        steps,
        auto_stopped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', cadence.id)
      .select()
      .single();
    await writeAuditLog(
      admin,
      withRequestContext(req, {
        tenantId,
        actorUserId: userId,
        actorType: 'user',
        action: 'blog_distribution.cadence_auto_stop',
        targetType: 'blog_reshare_cadence',
        targetId: cadence.id,
        summary: `Auto-stopped at ${parsed.data.step_key}: engagement ${parsed.data.prior_engagement} < ${threshold}`,
      }),
    );
    return createCorsResponse({ cadence: data, auto_stopped: true }, 200, req);
  }

  // Load the post for hook context.
  const { data: post } = await admin
    .from('blog_posts')
    .select('title,slug,excerpt,meta_description,canonical_url,cms_post_url')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .maybeSingle();

  const platform = String(steps[idx].platform);
  const angle = String(steps[idx].angle ?? '');
  let hook = '';
  try {
    const raw = await generateCompletion({
      max_tokens: 300,
      temperature: 0.9,
      system:
        'You are a B2B social copywriter. Write ONE fresh scroll-stopping hook (<=240 chars) for a re-share of an existing blog post. ' +
        'Return ONLY a JSON object {"hook": string}. Never repeat earlier hooks; use the requested angle.',
      messages: [
        {
          role: 'user',
          content: [
            `Platform: ${platform}`,
            `Angle for this re-share: ${angle}`,
            `Post title: ${post?.title ?? ''}`,
            post?.meta_description ? `Summary: ${post.meta_description}` : '',
            'Shape: {"hook": string}',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    });
    hook = String(extractJsonObject(raw).hook ?? '').slice(0, 280);
  } catch (err) {
    console.error('cadence hook generation error', err);
    // Non-fatal: continue scheduling without a generated hook.
    hook = '';
  }

  steps[idx].variant_hook = hook || null;
  steps[idx].status = 'scheduled';
  if (parsed.data.prior_engagement !== undefined)
    steps[idx].engagement_score = parsed.data.prior_engagement;

  const { data: updated } = await admin
    .from('blog_reshare_cadences')
    .update({ steps, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', cadence.id)
    .select()
    .single();

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.cadence_advance',
      targetType: 'blog_reshare_cadence',
      targetId: cadence.id,
      afterState: { step: parsed.data.step_key, platform, hook_generated: Boolean(hook) },
    }),
  );
  return createCorsResponse({ cadence: updated, step: steps[idx] }, 200, req);
}

/** Distribution timeline: past sends (from distributions/pieces) + scheduled cadence steps. */
async function cadenceTimeline(admin: Admin, tenantId: string, postId: string, req: Request) {
  const cadence = await loadCadence(admin, tenantId, postId);

  const { data: dists } = await admin
    .from('blog_distributions')
    .select('platform,status,scheduled_for,published_at,platform_post_url')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  const { data: pieces } = await admin
    .from('blog_syndication_pieces')
    .select('platform,status,scheduled_at,sent_at')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const past = [
    ...((dists ?? []) as Array<Record<string, unknown>>)
      .filter((d) => d.published_at)
      .map((d) => ({
        kind: 'distribution',
        platform: d.platform,
        at: d.published_at,
        url: d.platform_post_url,
      })),
    ...((pieces ?? []) as Array<Record<string, unknown>>)
      .filter((p) => p.sent_at)
      .map((p) => ({ kind: 'syndication', platform: p.platform, at: p.sent_at })),
  ].sort((a, b) => new Date(a.at as string).getTime() - new Date(b.at as string).getTime());

  const future = [
    ...((dists ?? []) as Array<Record<string, unknown>>)
      .filter((d) => d.status === 'scheduled' && d.scheduled_for)
      .map((d) => ({ kind: 'distribution', platform: d.platform, at: d.scheduled_for })),
    ...((pieces ?? []) as Array<Record<string, unknown>>)
      .filter((p) => p.status === 'scheduled' && p.scheduled_at)
      .map((p) => ({ kind: 'syndication', platform: p.platform, at: p.scheduled_at })),
    ...((cadence?.steps as Array<Record<string, unknown>>) ?? [])
      .filter((s) => s.status !== 'sent' && s.status !== 'stopped' && s.status !== 'skipped')
      .map((s) => ({
        kind: 'cadence',
        platform: s.platform,
        at: s.scheduled_at,
        step: s.key,
        status: s.status,
        variant_hook: s.variant_hook,
      })),
  ].sort((a, b) => new Date(a.at as string).getTime() - new Date(b.at as string).getTime());

  return createCorsResponse(
    { post_id: postId, paused: cadence?.paused ?? null, past, future },
    200,
    req,
  );
}

// ===========================================================================
// US-BLOG-055 — Internal-link auto-injection on publish
// ===========================================================================

const proposeSchema = z.object({
  pillar_post_id: z.string().uuid(),
  top_n: z.number().int().min(1).max(25).optional(),
  /** Inline candidate scores for testability (similarity adapter stubbed). */
  candidates: z.array(z.object({ post_id: z.string().uuid(), score: z.number() })).optional(),
});

async function proposeInjections(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await parseBody<unknown>(req);
  const parsed = proposeSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const topN = parsed.data.top_n ?? 5;

  const { data: pillar } = await admin
    .from('blog_posts')
    .select('id,title,slug,canonical_url,cms_post_url,meta_description')
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.pillar_post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!pillar) return createCorsResponse({ error: 'Pillar post not found' }, 404, req);
  const pillarUrl =
    (pillar.canonical_url as string) || (pillar.cms_post_url as string) || `/${pillar.slug}`;

  const candidates = await findSimilarPosts(
    admin,
    tenantId,
    parsed.data.pillar_post_id,
    topN,
    parsed.data.candidates,
  );

  const batchId = crypto.randomUUID();
  const proposals: Array<Record<string, unknown>> = [];

  for (const cand of candidates) {
    const { data: target } = await admin
      .from('blog_posts')
      .select('id,title,body_markdown')
      .eq('tenant_id', tenantId)
      .eq('id', cand.post_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!target) continue;
    const targetBody = String(target.body_markdown ?? '');
    // Skip if the target already links the pillar (AC: "no link to the new pillar").
    if (pillarUrl && targetBody.includes(pillarUrl)) continue;
    if (pillar.slug && targetBody.includes(`/${pillar.slug}`)) continue;

    // LLM proposes anchor + sentence-level edit.
    let anchor = '';
    let before = '';
    let after = '';
    try {
      const raw = await generateCompletion({
        max_tokens: 500,
        temperature: 0.5,
        system:
          'You are an SEO editor. Given a target post body and a pillar post to link to, pick ONE existing sentence ' +
          'in the target where a natural internal link to the pillar fits, and rewrite ONLY that sentence to include ' +
          'a markdown link with descriptive anchor text. Do not invent facts. ' +
          'Return ONLY JSON {"anchor_text": string, "sentence_before": string, "sentence_after": string}.',
        messages: [
          {
            role: 'user',
            content: [
              `Pillar title: ${pillar.title}`,
              `Pillar URL: ${pillarUrl}`,
              `Target title: ${target.title}`,
              'Target body (truncated):',
              targetBody.slice(0, 4000) || '(empty)',
              'Shape: {"anchor_text": string, "sentence_before": string, "sentence_after": string}',
            ].join('\n'),
          },
        ],
      });
      const obj = extractJsonObject(raw);
      anchor = String(obj.anchor_text ?? '').slice(0, 300);
      before = String(obj.sentence_before ?? '').slice(0, 4000);
      after = String(obj.sentence_after ?? '').slice(0, 4000);
    } catch (err) {
      console.error('link injection LLM error', err);
      continue; // skip this candidate rather than fail the batch
    }
    if (!after) continue;

    const { data: prop } = await admin
      .from('blog_link_injection_proposals')
      .insert({
        tenant_id: tenantId,
        batch_id: batchId,
        pillar_post_id: parsed.data.pillar_post_id,
        target_post_id: cand.post_id,
        similarity_score: cand.score,
        anchor_text: anchor,
        sentence_before: before,
        sentence_after: after,
        pillar_url: pillarUrl,
        status: 'proposed',
        created_by_user_id: userId,
      })
      .select()
      .single();
    if (prop) proposals.push(prop);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.link_propose',
      targetType: 'blog_post',
      targetId: parsed.data.pillar_post_id,
      summary: `Proposed ${proposals.length} internal-link injections (batch ${batchId})`,
    }),
  );

  // PR-style diff structure: batch + per-change accept/reject targets.
  return createCorsResponse(
    {
      batch_id: batchId,
      pillar_post_id: parsed.data.pillar_post_id,
      changes: proposals.map((p) => ({
        id: p.id,
        target_post_id: p.target_post_id,
        anchor_text: p.anchor_text,
        diff: { before: p.sentence_before, after: p.sentence_after },
        status: p.status,
      })),
    },
    201,
    req,
  );
}

/** Apply one accepted proposal: write a blog_post_revisions row + stub CMS push. */
async function applyProposal(
  admin: Admin,
  tenantId: string,
  userId: string,
  prop: Record<string, unknown>,
  req: Request,
) {
  const targetPostId = prop.target_post_id as string;
  // Load current post + max revision number.
  const { data: target } = await admin
    .from('blog_posts')
    .select('title,body_markdown,body_html,meta_title,meta_description')
    .eq('tenant_id', tenantId)
    .eq('id', targetPostId)
    .maybeSingle();
  if (!target) return null;

  const { data: lastRev } = await admin
    .from('blog_post_revisions')
    .select('revision_number')
    .eq('tenant_id', tenantId)
    .eq('post_id', targetPostId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextRevision = ((lastRev?.revision_number as number) ?? 0) + 1;

  // Splice the rewritten sentence into the body.
  const before = String(prop.sentence_before ?? '');
  const after = String(prop.sentence_after ?? '');
  const currentBody = String(target.body_markdown ?? '');
  const newBody =
    before && currentBody.includes(before) ? currentBody.replace(before, after) : currentBody;

  const { data: revision } = await admin
    .from('blog_post_revisions')
    .insert({
      post_id: targetPostId,
      tenant_id: tenantId,
      revision_number: nextRevision,
      title: target.title,
      body_markdown: newBody,
      body_html: target.body_html,
      meta_title: target.meta_title,
      meta_description: target.meta_description,
      revision_source: 'ai_rewrite',
      diff_summary: `Internal link injected: "${prop.anchor_text}" -> ${prop.pillar_url}`,
      changed_by_user_id: userId,
    })
    .select()
    .single();

  // Write the new body back onto the post + stub CMS re-publish.
  await admin
    .from('blog_posts')
    .update({ body_markdown: newBody, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', targetPostId);
  const cmsResult = cmsRepublishStub(targetPostId, 'internal link injected');

  return { revision, cmsResult };
}

async function decideProposal(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  accept: boolean,
  req: Request,
) {
  const { data: prop } = await admin
    .from('blog_link_injection_proposals')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!prop) return createCorsResponse({ error: 'Proposal not found' }, 404, req);
  if (prop.status !== 'proposed') {
    return createCorsResponse({ error: `Proposal already ${prop.status}` }, 409, req);
  }

  if (!accept) {
    const { data } = await admin
      .from('blog_link_injection_proposals')
      .update({
        status: 'rejected',
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single();
    await writeAuditLog(
      admin,
      withRequestContext(req, {
        tenantId,
        actorUserId: userId,
        actorType: 'user',
        action: 'blog_distribution.link_reject',
        targetType: 'blog_link_injection_proposal',
        targetId: id,
      }),
    );
    return createCorsResponse({ proposal: data }, 200, req);
  }

  const applied = await applyProposal(admin, tenantId, userId, prop, req);
  const { data } = await admin
    .from('blog_link_injection_proposals')
    .update({
      status: 'applied',
      applied_revision_id: applied?.revision?.id ?? null,
      cms_push_result: applied?.cmsResult ?? null,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single();

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.link_accept',
      targetType: 'blog_link_injection_proposal',
      targetId: id,
      summary: `Applied internal link; revision ${applied?.revision?.revision_number ?? '?'}`,
      afterState: { revision_id: applied?.revision?.id, cms: applied?.cmsResult },
    }),
  );
  return createCorsResponse(
    { proposal: data, revision: applied?.revision, cms: applied?.cmsResult },
    200,
    req,
  );
}

async function decideBatch(
  admin: Admin,
  tenantId: string,
  userId: string,
  batchId: string,
  accept: boolean,
  req: Request,
) {
  const { data: props } = await admin
    .from('blog_link_injection_proposals')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('batch_id', batchId)
    .eq('status', 'proposed')
    .is('deleted_at', null);
  const ids = ((props ?? []) as Array<{ id: string }>).map((p) => p.id);
  for (const id of ids) {
    // Each call applies/rejects + audit-logs + writes revisions as needed.
    await decideProposal(admin, tenantId, userId, id, accept, req);
  }
  return createCorsResponse({ batch_id: batchId, processed: ids.length, accept }, 200, req);
}

/** Backlink count on the pillar's stats (US-BLOG-055). */
async function pillarStats(admin: Admin, tenantId: string, postId: string, req: Request) {
  const { count: appliedCount } = await admin
    .from('blog_link_injection_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('pillar_post_id', postId)
    .eq('status', 'applied')
    .is('deleted_at', null);
  const { count: proposedCount } = await admin
    .from('blog_link_injection_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('pillar_post_id', postId)
    .eq('status', 'proposed')
    .is('deleted_at', null);

  return createCorsResponse(
    {
      pillar_post_id: postId,
      backlink_count: appliedCount ?? 0,
      proposed_pending: proposedCount ?? 0,
    },
    200,
    req,
  );
}

// ===========================================================================
// US-BLOG-063 — Refresh queue + auto-flagged decay candidates
// ===========================================================================

async function refreshQueue(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_refresh_queue')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('priority', { ascending: false })
    .order('scheduled_at', { ascending: true })
    .limit(200);
  const status = url.searchParams.get('status');
  if (status) q = q.eq('status', status);
  const { data: items, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list refresh queue' }, 500, req);

  const queueRows = (items ?? []) as Array<Record<string, unknown>>;
  const queueIds = queueRows.map((r) => r.id as string);
  const detailByQueue: Record<string, Record<string, unknown>> = {};
  if (queueIds.length) {
    const { data: details } = await admin
      .from('blog_refresh_queue_details')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('queue_id', queueIds);
    for (const d of (details ?? []) as Array<Record<string, unknown>>) {
      detailByQueue[d.queue_id as string] = d;
    }
  }

  return createCorsResponse(
    {
      items: queueRows.map((r) => ({ ...r, details: detailByQueue[r.id as string] ?? null })),
    },
    200,
    req,
  );
}

const startRefreshSchema = z.object({
  /** Optional inline SERP intent text to compare the post against (adapter stub). */
  serp_summary: z.string().max(8000).optional(),
});

async function startRefresh(
  admin: Admin,
  tenantId: string,
  userId: string,
  queueId: string,
  req: Request,
) {
  const body = (await parseBody<unknown>(req)) ?? {};
  const parsed = startRefreshSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const { data: item } = await admin
    .from('blog_refresh_queue')
    .select('id,post_id,status,priority')
    .eq('tenant_id', tenantId)
    .eq('id', queueId)
    .maybeSingle();
  if (!item) return createCorsResponse({ error: 'Queue item not found' }, 404, req);

  const { data: post } = await admin
    .from('blog_posts')
    .select('id,title,slug,body_markdown,meta_description')
    .eq('tenant_id', tenantId)
    .eq('id', item.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // LLM: suggested edits as inline annotations (current SERP intent vs current post).
  let suggestedEdits: unknown[] = [];
  let estimatedEffort: Record<string, unknown> = { level: 'medium', minutes: 45 };
  try {
    const raw = await generateCompletion({
      max_tokens: 1500,
      temperature: 0.5,
      system:
        'You are a content refresh editor. Compare the current post against current search intent and return ' +
        'inline annotation suggestions. Return ONLY a JSON object ' +
        '{"annotations":[{"location":string,"issue":string,"suggestion":string,"severity":"low"|"medium"|"high"}],' +
        '"effort":{"level":"small"|"medium"|"large","minutes":number}}.',
      messages: [
        {
          role: 'user',
          content: [
            `Post title: ${post.title}`,
            parsed.data.serp_summary
              ? `Current SERP intent summary:\n${parsed.data.serp_summary.slice(0, 4000)}`
              : 'No SERP summary provided — infer likely intent from the title.',
            'Post body (truncated):',
            String(post.body_markdown ?? '').slice(0, 5000) || '(empty)',
            'Shape: {"annotations":[...],"effort":{...}}',
          ].join('\n'),
        },
      ],
    });
    const obj = extractJsonObject(raw);
    suggestedEdits = Array.isArray(obj.annotations) ? (obj.annotations as unknown[]) : [];
    if (obj.effort && typeof obj.effort === 'object')
      estimatedEffort = obj.effort as Record<string, unknown>;
  } catch (err) {
    console.error('start refresh LLM error', err);
    // Non-fatal: return the post with empty annotations so the editor can proceed.
  }

  // Mark queue item in_progress.
  await admin
    .from('blog_refresh_queue')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', queueId);

  // Upsert companion details with suggested edits + effort + last_refreshed_at.
  const nowIso = new Date().toISOString();
  const { data: existingDetail } = await admin
    .from('blog_refresh_queue_details')
    .select('id,baseline_position')
    .eq('tenant_id', tenantId)
    .eq('queue_id', queueId)
    .maybeSingle();
  if (existingDetail) {
    await admin
      .from('blog_refresh_queue_details')
      .update({
        suggested_edits: suggestedEdits,
        estimated_effort: estimatedEffort,
        last_refreshed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('tenant_id', tenantId)
      .eq('id', existingDetail.id);
  } else {
    await admin.from('blog_refresh_queue_details').insert({
      tenant_id: tenantId,
      queue_id: queueId,
      post_id: item.post_id,
      suggested_edits: suggestedEdits,
      estimated_effort: estimatedEffort,
      last_refreshed_at: nowIso,
    });
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_distribution.refresh_start',
      targetType: 'blog_refresh_queue',
      targetId: queueId,
      summary: `Started refresh for "${post.title}" (${suggestedEdits.length} annotations)`,
    }),
  );

  return createCorsResponse(
    {
      queue_id: queueId,
      post,
      annotations: suggestedEdits,
      estimated_effort: estimatedEffort,
      last_refreshed_at: nowIso,
    },
    200,
    req,
  );
}

const recoverSchema = z.object({
  /** Current position from Search Console (adapter-stubbed; accept inline). */
  current_position: z.number().optional(),
  /** Recovery rule: recovered if current_position improves (lower) by >= this. */
  recovery_improvement: z.number().optional(),
});

/** Monitor for ranking recovery; auto-close the queue item on recovery (US-BLOG-063). */
async function recoverRefresh(
  admin: Admin,
  tenantId: string,
  userId: string,
  queueId: string,
  req: Request,
) {
  const body = (await parseBody<unknown>(req)) ?? {};
  const parsed = recoverSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const { data: detail } = await admin
    .from('blog_refresh_queue_details')
    .select('id,post_id,baseline_position')
    .eq('tenant_id', tenantId)
    .eq('queue_id', queueId)
    .maybeSingle();
  if (!detail) return createCorsResponse({ error: 'Queue details not found' }, 404, req);

  // Pull current position via the metrics adapter if not provided inline.
  let currentPos = parsed.data.current_position;
  if (currentPos === undefined) {
    const { current } = await fetchDecayMetrics(
      admin,
      tenantId,
      detail.post_id as string,
      new Date(),
    );
    currentPos = current.position;
  }
  const baseline = Number(detail.baseline_position ?? 0);
  const improvement = parsed.data.recovery_improvement ?? 1; // ranks improved by >=1 by default
  // Lower position = better rank. Recovered if it improved by >= improvement.
  const recovered = baseline > 0 && currentPos > 0 && baseline - currentPos >= improvement;

  const nowIso = new Date().toISOString();
  await admin
    .from('blog_refresh_queue_details')
    .update({
      recovery_status: recovered ? 'recovered' : 'not_recovered',
      recovery_checked_at: nowIso,
      updated_at: nowIso,
    })
    .eq('tenant_id', tenantId)
    .eq('id', detail.id);

  if (recovered) {
    // Auto-close the queue item.
    await admin
      .from('blog_refresh_queue')
      .update({
        status: 'completed',
        completed_at: nowIso,
        result_summary: `Auto-closed on ranking recovery: ${baseline} -> ${currentPos}`,
        updated_at: nowIso,
      })
      .eq('tenant_id', tenantId)
      .eq('id', queueId);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: recovered
        ? 'blog_distribution.refresh_recovered'
        : 'blog_distribution.refresh_monitor',
      targetType: 'blog_refresh_queue',
      targetId: queueId,
      afterState: { baseline_position: baseline, current_position: currentPos, recovered },
    }),
  );

  return createCorsResponse(
    { queue_id: queueId, baseline_position: baseline, current_position: currentPos, recovered },
    200,
    req,
  );
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
    if (!hasDistributionPublish(user)) {
      return createCorsResponse(
        { error: 'Forbidden: blog.distribution.publish required' },
        403,
        req,
      );
    }
    const tenantId = getTenantId(user, req);
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-distribution-engine');
    const [a, b, c] = parts;
    const m = req.method;

    // -- US-BLOG-021 decay --
    if (a === 'decay' && b === 'scan' && m === 'POST')
      return await decayScan(admin, tenantId, user.id, req);
    if (a === 'decay' && b === 'dashboard' && m === 'GET')
      return await decayDashboard(admin, tenantId, url, req);
    if (a === 'decay' && b === 'events' && m === 'GET')
      return await listDecayEvents(admin, tenantId, url, req);

    // -- US-BLOG-052 scheduling --
    if (a === 'schedule' && b === 'model' && m === 'POST')
      return await buildModels(admin, tenantId, user.id, req);
    if (a === 'schedule' && b === 'models' && m === 'GET')
      return await listModels(admin, tenantId, req);
    if (a === 'schedule' && b === 'smart' && m === 'POST')
      return await smartSchedule(admin, tenantId, user.id, req);

    // -- US-BLOG-053 utm --
    if (a === 'utm' && b === 'template' && m === 'GET')
      return await getUtmTemplate(admin, tenantId, req);
    if (a === 'utm' && b === 'template' && (m === 'PUT' || m === 'PATCH'))
      return await putUtmTemplate(admin, tenantId, user.id, req);
    if (a === 'utm' && b === 'rewrite' && m === 'POST')
      return await rewriteLinks(admin, tenantId, user.id, req);
    if (a === 'utm' && b === 'verify' && m === 'POST')
      return await verifyUtm(admin, tenantId, user.id, req);

    // -- US-BLOG-054 re-share cadence --
    if (a === 'cadence' && !b && m === 'POST')
      return await createCadence(admin, tenantId, user.id, req);
    if (a === 'cadence' && b && !c && m === 'GET') return await getCadence(admin, tenantId, b, req);
    if (a === 'cadence' && b && c === 'pause' && m === 'POST')
      return await pauseResumeCadence(admin, tenantId, user.id, b, true, req);
    if (a === 'cadence' && b && c === 'resume' && m === 'POST')
      return await pauseResumeCadence(admin, tenantId, user.id, b, false, req);
    if (a === 'cadence' && b && c === 'advance' && m === 'POST')
      return await advanceCadence(admin, tenantId, user.id, b, req);
    if (a === 'cadence' && b && c === 'timeline' && m === 'GET')
      return await cadenceTimeline(admin, tenantId, b, req);

    // -- US-BLOG-055 internal links --
    if (a === 'links' && b === 'propose' && m === 'POST')
      return await proposeInjections(admin, tenantId, user.id, req);
    if (a === 'links' && b === 'batch' && c && parts[3] === 'accept' && m === 'POST')
      return await decideBatch(admin, tenantId, user.id, c, true, req);
    if (a === 'links' && b === 'batch' && c && parts[3] === 'reject' && m === 'POST')
      return await decideBatch(admin, tenantId, user.id, c, false, req);
    if (a === 'links' && b === 'pillar' && c && parts[3] === 'stats' && m === 'GET')
      return await pillarStats(admin, tenantId, c, req);
    if (a === 'links' && b && c === 'accept' && m === 'POST')
      return await decideProposal(admin, tenantId, user.id, b, true, req);
    if (a === 'links' && b && c === 'reject' && m === 'POST')
      return await decideProposal(admin, tenantId, user.id, b, false, req);

    // -- US-BLOG-063 refresh queue --
    if (a === 'refresh' && b === 'queue' && m === 'GET')
      return await refreshQueue(admin, tenantId, url, req);
    if (a === 'refresh' && b && c === 'start' && m === 'POST')
      return await startRefresh(admin, tenantId, user.id, b, req);
    if (a === 'refresh' && b && c === 'recover' && m === 'POST')
      return await recoverRefresh(admin, tenantId, user.id, b, req);

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-distribution-engine handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
