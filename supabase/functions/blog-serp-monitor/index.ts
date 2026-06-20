// Blog SERP Monitor + Competitor Alerts + Auto-Refresh Agent Edge Function
// (US-BLOG-070 / US-BLOG-071 / US-BLOG-066)
//
// Three cooperating feature families in one tenant-scoped edge function:
//
//   US-BLOG-070 — Real-time SERP monitor with auto-refresh triggers
//     Hourly polling for tier-1 keywords (configurable; default top-50 by
//     traffic), daily for the rest. Volatility detection (rank change >3, new
//     SERP feature, new top-10 competitor) → blog_serp_volatility_events.
//     Alerts (email/slack/in_app, stubbed send) → blog_serp_alerts. Significant
//     volatility on a PUBLISHED post → high-priority row in the EXISTING
//     blog_refresh_queue. Per-keyword volatility timeline endpoint.
//
//   US-BLOG-071 — Competitor publishing alerts with response brief
//     Competitor RSS/sitemap feeds per workspace → blog_competitor_feeds.
//     New posts detected within 24h, LLM summary + keyword-cluster tag →
//     blog_competitor_posts. Alert when a post targets a keyword we rank for.
//     Auto-generated response brief; "create brief from response" inserts into
//     the EXISTING blog_briefs table.
//
//   US-BLOG-066 — Auto-refresh agent (fully autonomous SERP-decay re-editing)
//     Agent run (cron + blog_refresh_queue-triggered). Calls
//     assertAgentsActive(admin, tenantId, 'auto_refresh_agent') FIRST; on pause
//     it skips + the helper writes the kill-switch audit entry. For each
//     candidate: re-run SERP analysis (reuse 070) → diff vs prior
//     blog_serp_snapshots → LLM-revise sections → commit a blog_post_revisions
//     row (revision_source='auto_refresh_agent') → re-publish via CMS adapter
//     (stub) → audit-log the change. DEFAULT = no human approval (scope 5D);
//     per-tenant auto_refresh_requires_review flag (NEW blog_auto_refresh_config
//     table — blog_agent_settings is NOT altered) flips it to manual review.
//     Hard guardrails (body change > max_body_change_pct, SEO score drop,
//     brand-voice/style-guide violations) park candidates in
//     blog_auto_refresh_reviews instead of auto-publishing. Cost-per-run is
//     recorded on the run row and forwarded to the AI cost dashboard.
//
// External services (SERP API, competitor RSS/sitemap fetch, CMS adapter,
// Slack/email) are behind clearly-named adapter stubs with TODOs and
// injected-data fallbacks (request bodies may inject results for tests).
//
// Routes (tenant-scoped; gated to blog.refresh.manage / blog.post.edit / admin):
//   --- 070 SERP monitor ---
//   GET    /blog-serp-monitor/config                  fetch monitor config
//   PATCH  /blog-serp-monitor/config                  update tier1 list / channels / thresholds
//   POST   /blog-serp-monitor/poll                    cron-callable; body { tier?, keywords?, injected_serp? }
//   GET    /blog-serp-monitor/volatility              list events (?keyword= &significant= &postId=)
//   GET    /blog-serp-monitor/volatility/timeline     per-keyword timeline (?keyword= required)
//   GET    /blog-serp-monitor/alerts                  list alerts (?status= &source=)
//   POST   /blog-serp-monitor/alerts/:id/read         mark in-app alert read
//   --- 071 competitor alerts ---
//   GET    /blog-serp-monitor/competitors             list feeds
//   POST   /blog-serp-monitor/competitors             add feed { feed_url, feed_kind?, competitor_name?, domain? }
//   DELETE /blog-serp-monitor/competitors/:id         soft-delete feed
//   POST   /blog-serp-monitor/competitors/poll        cron-callable; body { feed_id?, injected_items? }
//   GET    /blog-serp-monitor/competitor-posts        list detected posts (?status= &targetsOurKeyword=)
//   POST   /blog-serp-monitor/competitor-posts/:id/create-brief   insert into blog_briefs
//   --- 066 auto-refresh agent ---
//   GET    /blog-serp-monitor/auto-refresh/config     fetch auto-refresh config
//   PATCH  /blog-serp-monitor/auto-refresh/config     update flag + guardrails
//   POST   /blog-serp-monitor/auto-refresh/run        AGENT entry (cron/queue); body { post_ids?, injected? }
//   GET    /blog-serp-monitor/auto-refresh/runs       list runs
//   GET    /blog-serp-monitor/auto-refresh/reviews    list review-queue rows (?status=)
//   POST   /blog-serp-monitor/auto-refresh/reviews/:id/resolve   approve|reject

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { assertAgentsActive } from '../_shared/blog/safety/kill-switch.ts';
import { generateCompletionDetailed } from '../_shared/anthropic.ts';
import { extractJsonObject } from '../_shared/blog/llm-json.ts';
import { logAiCost, usdToCents } from '../_shared/blog/ai-cost.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const AGENT_KIND = 'auto_refresh_agent';

// ---------------------------------------------------------------------------
// Permission gate (CLAUDE.md "Patterns established for new blog edge functions"):
// isPlatformAdmin OR perms includes blog.refresh.manage / blog.post.edit OR
// role platform_admin / super_admin / company_admin.
// ---------------------------------------------------------------------------
function hasRefreshManage(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.refresh.manage') || perms.includes('blog.post.edit'))
  ) {
    return true;
  }
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function resolveTenantId(
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

// ===========================================================================
// Adapter stubs — every external service is isolated here with a TODO and an
// injected-data fallback so the request body can drive deterministic tests.
// ===========================================================================

interface OrganicResult {
  rank: number;
  url: string;
  title?: string;
  description?: string;
  domain?: string;
}
interface SerpSnapshotShape {
  organic_results: OrganicResult[];
  serp_features?: Record<string, unknown>;
  aggregate?: Record<string, unknown>;
}

/**
 * SERP API adapter (DataForSEO / SerpApi). STUB.
 * TODO: call the real SERP provider via _shared/blog/keyword adapters.
 * `injected` lets the poll endpoint inject a result set for cron/tests.
 */
async function fetchSerp(
  keyword: string,
  injected: SerpSnapshotShape | undefined,
  opts: { locationCode: number; languageCode: string },
): Promise<SerpSnapshotShape | null> {
  if (injected) return injected;
  // TODO(US-BLOG-070): integrate the DataForSEO live SERP adapter
  // (see _shared/blog/keyword/dataforseo.ts) keyed on opts.locationCode/languageCode.
  console.warn(
    `[blog-serp-monitor] fetchSerp stub — no SERP provider wired; pass injected_serp for "${keyword}"`,
  );
  return null;
}

/**
 * Competitor feed adapter (RSS/sitemap fetch + parse). STUB.
 * `injectedItems` lets the competitor-poll endpoint inject feed items.
 */
async function fetchCompetitorFeed(
  feedUrl: string,
  feedKind: string,
  injectedItems: CompetitorFeedItem[] | undefined,
): Promise<CompetitorFeedItem[]> {
  if (injectedItems) return injectedItems;
  // TODO(US-BLOG-071): fetch(feedUrl) then parse RSS <item> or sitemap <url>
  // entries into CompetitorFeedItem[]. Honor robots + conditional GET.
  console.warn(
    `[blog-serp-monitor] fetchCompetitorFeed stub — no fetcher wired for ${feedKind} ${feedUrl}`,
  );
  return [];
}
interface CompetitorFeedItem {
  external_id: string; // rss guid / sitemap loc
  url: string;
  title?: string;
  excerpt?: string;
  published_at?: string; // ISO
}

/**
 * CMS re-publish adapter. STUB.
 * TODO: dispatch to _shared/blog/cms registry (WordPress/Ghost) by cms_target_key.
 * `injectedResult` lets the agent-run endpoint simulate a publish for tests.
 */
async function cmsRepublish(
  post: { id: string; cms_target_key: string | null; cms_post_id: string | null },
  body: { title: string; body_markdown: string; meta_description: string | null },
  injectedResult: Record<string, unknown> | undefined,
): Promise<{ ok: boolean; result: Record<string, unknown> }> {
  if (injectedResult) return { ok: injectedResult.ok !== false, result: injectedResult };
  // TODO(US-BLOG-066): resolve the CMS adapter from post.cms_target_key and call
  // adapter.update(post.cms_post_id, body). Returns the external publish result.
  console.warn(
    `[blog-serp-monitor] cmsRepublish stub — no CMS adapter wired for post ${post.id}; treating as dry-run`,
  );
  return { ok: true, result: { stub: true, dry_run: true, cms_target_key: post.cms_target_key } };
}

/**
 * Alert channel sender (email/Slack/in-app). STUB.
 * The blog_serp_alerts row is the durable record regardless of send outcome.
 */
async function sendAlert(
  channel: string,
  destination: unknown,
  payload: { title: string; message: string },
): Promise<{ ok: boolean }> {
  if (channel === 'in_app') return { ok: true }; // in-app = the persisted row itself
  // TODO(US-BLOG-070): wire email (SendGrid via ../email-marketing/_sendgrid.ts)
  // and Slack (incoming webhook). For now we persist the row and no-op the send.
  console.warn(`[blog-serp-monitor] sendAlert stub — ${channel} not wired:`, payload.title);
  return { ok: true };
}

// ===========================================================================
// Zod schemas
// ===========================================================================

const ALERT_CHANNELS = ['email', 'slack', 'in_app'] as const;

const monitorConfigPatchSchema = z.object({
  tier1_keywords: z.array(z.string().max(500)).max(2000).optional(),
  tier1_auto_top_n: z.number().int().min(0).max(500).optional(),
  alert_channels: z.array(z.enum(ALERT_CHANNELS)).optional(),
  alert_config: z.record(z.unknown()).optional(),
  rank_change_threshold: z.number().int().min(1).max(50).optional(),
  enabled: z.boolean().optional(),
  location_code: z.number().int().optional(),
  language_code: z.string().max(16).optional(),
});

const injectedSerpSchema = z.object({
  organic_results: z.array(
    z.object({
      rank: z.number().int(),
      url: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      domain: z.string().optional(),
    }),
  ),
  serp_features: z.record(z.unknown()).optional(),
  aggregate: z.record(z.unknown()).optional(),
});

const pollSchema = z.object({
  tier: z.enum(['tier1', 'standard']).optional(), // default: all due
  keywords: z.array(z.string().max(500)).max(500).optional(),
  /** Injected per-keyword SERP results for cron/tests: { [keyword]: SerpSnapshotShape }. */
  injected_serp: z.record(injectedSerpSchema).optional(),
});

const feedSchema = z.object({
  feed_url: z.string().url().max(2000),
  feed_kind: z.enum(['rss', 'sitemap']).optional(),
  competitor_name: z.string().max(255).optional(),
  domain: z.string().max(255).optional(),
});

const competitorPollSchema = z.object({
  feed_id: z.string().uuid().optional(),
  /** Injected feed items per feed_id for cron/tests: { [feedId]: CompetitorFeedItem[] }. */
  injected_items: z
    .record(
      z.array(
        z.object({
          external_id: z.string().max(1000),
          url: z.string().url().max(2000),
          title: z.string().max(1000).optional(),
          excerpt: z.string().max(8000).optional(),
          published_at: z.string().datetime().optional(),
        }),
      ),
    )
    .optional(),
});

const autoRefreshConfigPatchSchema = z.object({
  auto_refresh_requires_review: z.boolean().optional(),
  max_body_change_pct: z.number().int().min(1).max(100).optional(),
  block_on_seo_score_drop: z.boolean().optional(),
  block_on_brand_voice_violation: z.boolean().optional(),
  min_days_between_refresh: z.number().int().min(0).max(365).optional(),
  max_posts_per_run: z.number().int().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
});

const autoRefreshRunSchema = z.object({
  post_ids: z.array(z.string().uuid()).max(100).optional(),
  refresh_queue_id: z.string().uuid().optional(),
  trigger: z.enum(['cron', 'queue', 'manual']).optional(),
  /** Per-post injected inputs for deterministic integration tests. */
  injected: z
    .record(
      z.object({
        serp: injectedSerpSchema.optional(),
        /** LLM revision output, to bypass the model in tests. */
        revision: z
          .object({
            title: z.string().optional(),
            body_markdown: z.string(),
            meta_description: z.string().nullable().optional(),
            change_summary: z.string().optional(),
            seo_score: z.number().optional(),
            brand_voice_violations: z.array(z.string()).optional(),
          })
          .optional(),
        cms_result: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
});

const resolveReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(2000).optional(),
});

// ===========================================================================
// Config helpers (idempotent first-read upsert, matching getAgentSettings)
// ===========================================================================

async function getMonitorConfig(admin: Admin, tenantId: string) {
  const { data: existing } = await admin
    .from('blog_serp_monitor_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await admin
    .from('blog_serp_monitor_config')
    .insert({ tenant_id: tenantId, alert_channels: ['in_app'] })
    .select('*')
    .single();
  if (error || !created) throw new Error(`getMonitorConfig failed: ${error?.message}`);
  return created;
}

async function getAutoRefreshConfig(admin: Admin, tenantId: string) {
  const { data: existing } = await admin
    .from('blog_auto_refresh_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await admin
    .from('blog_auto_refresh_config')
    .upsert({ tenant_id: tenantId }, { onConflict: 'tenant_id' })
    .select('*')
    .single();
  if (error || !created) throw new Error(`getAutoRefreshConfig failed: ${error?.message}`);
  return created;
}

// ===========================================================================
// US-BLOG-070 — SERP monitor
// ===========================================================================

interface MonitorConfigRow {
  tier1_keywords: string[] | null;
  tier1_auto_top_n: number;
  alert_channels: string[] | null;
  alert_config: Record<string, unknown> | null;
  rank_change_threshold: number;
  enabled: boolean;
  location_code: number;
  language_code: string;
}

/** Resolve the keyword set to poll for a tier. tier1 default = top-N by search_volume. */
async function resolveKeywords(
  admin: Admin,
  tenantId: string,
  cfg: MonitorConfigRow,
  tier: 'tier1' | 'standard',
  override: string[] | undefined,
): Promise<string[]> {
  if (override && override.length) return override;
  const tier1 = cfg.tier1_keywords && cfg.tier1_keywords.length ? cfg.tier1_keywords : null;
  if (tier === 'tier1') {
    if (tier1) return tier1;
    // Default: top-N keywords by search volume (proxy for "by traffic").
    const { data } = await admin
      .from('blog_keywords')
      .select('keyword')
      .eq('tenant_id', tenantId)
      .order('search_volume', { ascending: false, nullsFirst: false })
      .limit(cfg.tier1_auto_top_n || 50);
    return (data ?? []).map((r: { keyword: string }) => r.keyword);
  }
  // standard tier = everything NOT in tier1
  const { data } = await admin
    .from('blog_keywords')
    .select('keyword')
    .eq('tenant_id', tenantId)
    .limit(2000);
  const all = (data ?? []).map((r: { keyword: string }) => r.keyword);
  const t1 = new Set(tier1 ?? []);
  return all.filter((k) => !t1.has(k));
}

/** Latest snapshot for a keyword (for diffing). */
async function latestSnapshot(admin: Admin, tenantId: string, keyword: string) {
  const { data } = await admin
    .from('blog_serp_snapshots')
    .select('id,organic_results,serp_features,fetched_at')
    .eq('tenant_id', tenantId)
    .eq('keyword', keyword)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Find a published post whose ranking URL appears in the SERP (best-effort by slug match). */
async function findPublishedPostForKeyword(admin: Admin, tenantId: string, keyword: string) {
  // Best-effort: a post explicitly targeting this keyword via its brief, else null.
  const { data } = await admin
    .from('blog_posts')
    .select('id,slug,canonical_url,cms_post_url')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .limit(500);
  return (data ?? []) as Array<{
    id: string;
    slug: string;
    canonical_url: string | null;
    cms_post_url: string | null;
  }>;
}

/** Diff two SERPs → volatility event descriptors. */
function diffSerp(
  prev: { organic_results?: OrganicResult[]; serp_features?: Record<string, unknown> } | null,
  curr: SerpSnapshotShape,
  ourUrls: Set<string>,
  threshold: number,
): Array<{
  kind: string;
  magnitude: number;
  significant: boolean;
  previousRank?: number;
  currentRank?: number;
  detail: Record<string, unknown>;
}> {
  const events: ReturnType<typeof diffSerp> = [];
  const prevOrganic = prev?.organic_results ?? [];
  const prevRankByUrl = new Map(prevOrganic.map((r) => [r.url, r.rank]));
  const prevTop10 = new Set(prevOrganic.filter((r) => r.rank <= 10).map((r) => r.domain ?? ''));

  // 1) rank change for OUR URLs (>threshold positions)
  for (const r of curr.organic_results) {
    if (!ourUrls.has(r.url)) continue;
    const prevRank = prevRankByUrl.get(r.url);
    if (prevRank == null) continue;
    const moved = Math.abs(r.rank - prevRank);
    if (moved > 0) {
      events.push({
        kind: 'rank_change',
        magnitude: r.rank - prevRank, // positive = dropped (worse)
        significant: moved > threshold,
        previousRank: prevRank,
        currentRank: r.rank,
        detail: { our_url: r.url, before: prevRank, after: r.rank },
      });
    }
  }

  // 2) new SERP feature appearing
  const prevFeatures = new Set(Object.keys(prev?.serp_features ?? {}));
  for (const feat of Object.keys(curr.serp_features ?? {})) {
    if (!prevFeatures.has(feat)) {
      events.push({
        kind: 'new_serp_feature',
        magnitude: 1,
        significant: true,
        detail: { feature: feat },
      });
    }
  }

  // 3) new competitor entering top 10
  for (const r of curr.organic_results) {
    if (r.rank > 10) continue;
    const domain = r.domain ?? '';
    if (domain && !prevTop10.has(domain) && prevOrganic.length > 0) {
      events.push({
        kind: 'new_competitor_top10',
        magnitude: 1,
        significant: true,
        currentRank: r.rank,
        detail: { competitor_domain: domain, url: r.url, rank: r.rank },
      });
    }
  }

  return events;
}

async function fireAlerts(
  admin: Admin,
  tenantId: string,
  cfg: MonitorConfigRow,
  source: 'volatility' | 'competitor_post',
  refs: { volatilityEventId?: string; competitorPostId?: string; keyword?: string | null },
  payload: { title: string; message: string; extra?: Record<string, unknown> },
) {
  const channels =
    cfg.alert_channels && cfg.alert_channels.length ? cfg.alert_channels : ['in_app'];
  for (const channel of channels) {
    const dest =
      channel === 'email'
        ? cfg.alert_config?.email
        : channel === 'slack'
          ? cfg.alert_config?.slack_webhook
          : null;
    let status = 'queued';
    try {
      const sent = await sendAlert(channel, dest, payload);
      status = sent.ok ? 'sent' : 'failed';
    } catch {
      status = 'failed';
    }
    await admin.from('blog_serp_alerts').insert({
      tenant_id: tenantId,
      source,
      channel,
      volatility_event_id: refs.volatilityEventId ?? null,
      competitor_post_id: refs.competitorPostId ?? null,
      keyword: refs.keyword ?? null,
      title: payload.title,
      message: payload.message,
      payload: payload.extra ?? null,
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });
  }
}

async function poll(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }
  const parsed = pollSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const cfg = (await getMonitorConfig(admin, tenantId)) as MonitorConfigRow;
  if (!cfg.enabled) {
    return createCorsResponse({ skipped: true, reason: 'monitor_disabled' }, 200, req);
  }

  const tiers: Array<'tier1' | 'standard'> = parsed.data.tier
    ? [parsed.data.tier]
    : ['tier1', 'standard'];
  const injected = parsed.data.injected_serp ?? {};

  // Build our-URL set once for rank-change detection.
  const ourPosts = await findPublishedPostForKeyword(admin, tenantId, '');
  const ourUrls = new Set<string>();
  for (const p of ourPosts) {
    if (p.canonical_url) ourUrls.add(p.canonical_url);
    if (p.cms_post_url) ourUrls.add(p.cms_post_url);
  }

  let polled = 0;
  let eventsCreated = 0;
  let enqueued = 0;

  for (const tier of tiers) {
    const keywords = await resolveKeywords(admin, tenantId, cfg, tier, parsed.data.keywords);
    for (const keyword of keywords) {
      const serp = await fetchSerp(keyword, injected[keyword], {
        locationCode: cfg.location_code,
        languageCode: cfg.language_code,
      });
      if (!serp) continue; // no provider wired and nothing injected — skip silently
      polled++;

      const prev = await latestSnapshot(admin, tenantId, keyword);

      // Persist the new snapshot (reuse blog_serp_snapshots).
      const { data: snapInserted } = await admin
        .from('blog_serp_snapshots')
        .insert({
          tenant_id: tenantId,
          keyword,
          location_code: cfg.location_code,
          language_code: cfg.language_code,
          organic_results: serp.organic_results,
          serp_features: serp.serp_features ?? null,
          aggregate: serp.aggregate ?? null,
          source_adapter: injected[keyword] ? 'injected' : 'dataforseo',
          created_by_user_id: userId,
        })
        .select('id')
        .single();
      const currentSnapshotId = snapInserted?.id ?? null;

      const diffs = diffSerp(prev, serp, ourUrls, cfg.rank_change_threshold);
      for (const d of diffs) {
        // Map keyword → a published post via URL appearing in the SERP.
        let postId: string | null = null;
        if (d.detail.our_url && typeof d.detail.our_url === 'string') {
          const match = ourPosts.find(
            (p) => p.canonical_url === d.detail.our_url || p.cms_post_url === d.detail.our_url,
          );
          postId = match?.id ?? null;
        }

        const { data: eventRow } = await admin
          .from('blog_serp_volatility_events')
          .insert({
            tenant_id: tenantId,
            keyword,
            tier,
            kind: d.kind,
            magnitude: d.magnitude,
            significant: d.significant,
            previous_rank: d.previousRank ?? null,
            current_rank: d.currentRank ?? null,
            detail: d.detail,
            previous_snapshot_id: prev?.id ?? null,
            current_snapshot_id: currentSnapshotId,
            post_id: postId,
          })
          .select('id')
          .single();
        eventsCreated++;

        if (!d.significant) continue;

        // Auto-trigger: significant volatility on a PUBLISHED post → high-priority
        // row in the EXISTING blog_refresh_queue.
        let refreshQueueId: string | null = null;
        if (postId) {
          const { data: queued } = await admin
            .from('blog_refresh_queue')
            .insert({
              tenant_id: tenantId,
              post_id: postId,
              reason: 'serp_decay',
              priority: 90, // high
              status: 'queued',
              result_summary: `Auto-enqueued by SERP monitor: ${d.kind} on "${keyword}".`,
            })
            .select('id')
            .single();
          refreshQueueId = queued?.id ?? null;
          if (refreshQueueId) enqueued++;
          if (eventRow?.id) {
            await admin
              .from('blog_serp_volatility_events')
              .update({ refresh_queue_id: refreshQueueId })
              .eq('id', eventRow.id)
              .eq('tenant_id', tenantId);
          }
        }

        // Alerts (email/slack/in-app) — persisted regardless of channel send.
        await fireAlerts(
          admin,
          tenantId,
          cfg,
          'volatility',
          { volatilityEventId: eventRow?.id, keyword },
          {
            title: `SERP volatility: ${d.kind} on "${keyword}"`,
            message:
              d.kind === 'rank_change'
                ? `Rank moved ${d.previousRank} → ${d.currentRank} (${d.magnitude > 0 ? 'down' : 'up'} ${Math.abs(d.magnitude)}).`
                : `${d.kind} detected.`,
            extra: d.detail,
          },
        );
      }
    }
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: userId ? 'user' : 'system',
      action: 'blog_serp_monitor.poll',
      targetType: 'blog_serp_monitor_config',
      targetId: null,
      summary: `SERP poll: ${polled} keywords, ${eventsCreated} events, ${enqueued} refresh enqueues.`,
      afterState: { tiers, polled, eventsCreated, enqueued },
    }),
  );

  return createCorsResponse({ polled, eventsCreated, enqueued }, 200, req);
}

async function listVolatility(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_serp_volatility_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('detected_at', { ascending: false })
    .limit(200);
  const keyword = url.searchParams.get('keyword');
  const significant = url.searchParams.get('significant');
  const postId = url.searchParams.get('postId');
  if (keyword) q = q.eq('keyword', keyword);
  if (significant === 'true') q = q.eq('significant', true);
  if (postId) q = q.eq('post_id', postId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list events' }, 500, req);
  return createCorsResponse({ events: data ?? [] }, 200, req);
}

async function volatilityTimeline(admin: Admin, tenantId: string, url: URL, req: Request) {
  const keyword = url.searchParams.get('keyword');
  if (!keyword) return createCorsResponse({ error: 'keyword query param is required' }, 400, req);
  const { data, error } = await admin
    .from('blog_serp_volatility_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('keyword', keyword)
    .order('detected_at', { ascending: true })
    .limit(500);
  if (error) return createCorsResponse({ error: 'Failed to load timeline' }, 500, req);
  return createCorsResponse({ keyword, timeline: data ?? [] }, 200, req);
}

async function listAlerts(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_serp_alerts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  const status = url.searchParams.get('status');
  const source = url.searchParams.get('source');
  if (status) q = q.eq('status', status);
  if (source) q = q.eq('source', source);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list alerts' }, 500, req);
  return createCorsResponse({ alerts: data ?? [] }, 200, req);
}

async function markAlertRead(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_serp_alerts')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to mark read' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Alert not found' }, 404, req);
  return createCorsResponse({ alert: data }, 200, req);
}

async function getMonitorConfigRoute(admin: Admin, tenantId: string, req: Request) {
  const cfg = await getMonitorConfig(admin, tenantId);
  return createCorsResponse({ config: cfg }, 200, req);
}

async function patchMonitorConfig(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = monitorConfigPatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const before = await getMonitorConfig(admin, tenantId);
  const { data, error } = await admin
    .from('blog_serp_monitor_config')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select()
    .single();
  if (error || !data) return createCorsResponse({ error: 'Failed to update config' }, 500, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_serp_monitor.config_update',
      targetType: 'blog_serp_monitor_config',
      targetId: data.id,
      beforeState: before,
      afterState: data,
      summary: 'Updated SERP monitor config',
    }),
  );
  return createCorsResponse({ config: data }, 200, req);
}

// ===========================================================================
// US-BLOG-071 — Competitor publishing alerts
// ===========================================================================

async function listFeeds(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_competitor_feeds')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return createCorsResponse({ error: 'Failed to list feeds' }, 500, req);
  return createCorsResponse({ feeds: data ?? [] }, 200, req);
}

async function addFeed(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = feedSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const domain =
    parsed.data.domain ??
    (() => {
      try {
        return new URL(parsed.data.feed_url).hostname;
      } catch {
        return null;
      }
    })();
  const { data, error } = await admin
    .from('blog_competitor_feeds')
    .insert({
      tenant_id: tenantId,
      competitor_name: parsed.data.competitor_name ?? null,
      domain,
      feed_url: parsed.data.feed_url,
      feed_kind: parsed.data.feed_kind ?? 'rss',
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (error || !data) return createCorsResponse({ error: 'Failed to add feed' }, 500, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_competitor_feed.create',
      targetType: 'blog_competitor_feed',
      targetId: data.id,
      afterState: data,
      summary: `Added competitor feed ${data.feed_url}`,
    }),
  );
  return createCorsResponse({ feed: data }, 201, req);
}

async function deleteFeed(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_competitor_feeds')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to delete feed' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Feed not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_competitor_feed.delete',
      targetType: 'blog_competitor_feed',
      targetId: id,
      summary: 'Deleted competitor feed',
    }),
  );
  return createCorsResponse({ success: true }, 200, req);
}

/** Keywords we rank for (proxy: keywords on file for this tenant). */
async function ourKeywords(admin: Admin, tenantId: string): Promise<string[]> {
  const { data } = await admin
    .from('blog_keywords')
    .select('keyword')
    .eq('tenant_id', tenantId)
    .limit(2000);
  return (data ?? []).map((r: { keyword: string }) => r.keyword);
}

/** Available clusters for LLM tagging. */
async function clusterChoices(admin: Admin, tenantId: string) {
  const { data } = await admin
    .from('blog_keyword_clusters')
    .select('id,name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(200);
  return (data ?? []) as Array<{ id: string; name: string }>;
}

async function competitorPoll(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }
  const parsed = competitorPollSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  let feedsQuery = admin
    .from('blog_competitor_feeds')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .is('deleted_at', null);
  if (parsed.data.feed_id) feedsQuery = feedsQuery.eq('id', parsed.data.feed_id);
  const { data: feeds } = await feedsQuery;

  const cfg = (await getMonitorConfig(admin, tenantId)) as MonitorConfigRow;
  const myKeywords = await ourKeywords(admin, tenantId);
  const clusters = await clusterChoices(admin, tenantId);
  const injectedItems = parsed.data.injected_items ?? {};
  const now = Date.now();

  let detected = 0;
  let alerts = 0;

  for (const feed of feeds ?? []) {
    let items: CompetitorFeedItem[] = [];
    try {
      items = await fetchCompetitorFeed(feed.feed_url, feed.feed_kind, injectedItems[feed.id]);
    } catch (err) {
      await admin
        .from('blog_competitor_feeds')
        .update({
          poll_error_count: (feed.poll_error_count ?? 0) + 1,
          last_error: err instanceof Error ? err.message : String(err),
          last_polled_at: new Date().toISOString(),
        })
        .eq('id', feed.id)
        .eq('tenant_id', tenantId);
      continue;
    }

    for (const item of items) {
      // Dedupe on (feed_id, external_id) — unique index backs this.
      const { data: existing } = await admin
        .from('blog_competitor_posts')
        .select('id')
        .eq('feed_id', feed.id)
        .eq('external_id', item.external_id)
        .maybeSingle();
      if (existing) continue;

      const publishedMs = item.published_at ? Date.parse(item.published_at) : NaN;
      const detectedFresh = !Number.isNaN(publishedMs) && now - publishedMs <= 24 * 60 * 60 * 1000;

      // LLM: summarize + tag with a keyword cluster + detect overlap with our keywords.
      let summary: string | null = null;
      let clusterId: string | null = null;
      let overlapping: string[] = [];
      try {
        const sys =
          'You are a competitive content analyst for a print/MFP dealer SaaS. ' +
          'Return ONLY a JSON object, no prose, no code fences.';
        const prompt = [
          `Competitor post title: ${item.title ?? '(none)'}`,
          item.excerpt ? `Excerpt: ${item.excerpt.slice(0, 2000)}` : null,
          `URL: ${item.url}`,
          '',
          `Our keyword clusters: ${clusters.map((c) => `${c.id}:${c.name}`).join(', ') || '(none)'}`,
          `Keywords we rank for: ${myKeywords.slice(0, 200).join(', ') || '(none)'}`,
          '',
          'Shape: {"summary":string (2-3 sentences on what they covered),' +
            '"cluster_id":string|null (best-matching cluster id from the list, or null),' +
            '"overlapping_keywords":[strings from our keyword list this post appears to target]}.',
        ]
          .filter(Boolean)
          .join('\n');
        const { text, usage } = await generateCompletionDetailed({
          max_tokens: 700,
          temperature: 0.4,
          system: sys,
          messages: [{ role: 'user', content: prompt }],
        });
        const parsedLlm = extractJsonObject(text);
        summary = typeof parsedLlm.summary === 'string' ? parsedLlm.summary : null;
        const cid = parsedLlm.cluster_id;
        clusterId = clusters.some((c) => c.id === cid) ? (cid as string) : null;
        overlapping = Array.isArray(parsedLlm.overlapping_keywords)
          ? (parsedLlm.overlapping_keywords as unknown[]).map(String).filter(Boolean).slice(0, 50)
          : [];
        await logAiCost(admin, {
          tenantId,
          provider: 'anthropic',
          feature: 'competitor.analyze',
          promptTokens: usage.inputTokens,
          completionTokens: usage.outputTokens,
          costCents: usdToCents(usage.costUsd),
          userId,
        });
      } catch (err) {
        console.error('competitor LLM tagging failed', err);
      }

      const targetsOurKeyword = overlapping.length > 0;

      const { data: postRow } = await admin
        .from('blog_competitor_posts')
        .insert({
          tenant_id: tenantId,
          feed_id: feed.id,
          external_id: item.external_id,
          url: item.url,
          title: item.title ?? null,
          excerpt: item.excerpt ?? null,
          published_at: item.published_at ?? null,
          detected_fresh: detectedFresh,
          summary,
          cluster_id: clusterId,
          overlapping_keywords: overlapping,
          targets_our_keyword: targetsOurKeyword,
          status: 'analyzed',
        })
        .select()
        .single();
      detected++;

      // Alert if a new competitor post targets a keyword we rank for.
      if (targetsOurKeyword && postRow) {
        await fireAlerts(
          admin,
          tenantId,
          cfg,
          'competitor_post',
          { competitorPostId: postRow.id, keyword: overlapping[0] },
          {
            title: `Competitor published on a keyword you rank for`,
            message: `${feed.competitor_name ?? feed.domain ?? 'A competitor'} published "${item.title ?? item.url}" targeting: ${overlapping.join(', ')}.`,
            extra: { url: item.url, overlapping_keywords: overlapping },
          },
        );
        alerts++;
      }
    }

    await admin
      .from('blog_competitor_feeds')
      .update({
        last_polled_at: new Date().toISOString(),
        last_seen_cursor: items.length
          ? items[items.length - 1].external_id
          : feed.last_seen_cursor,
      })
      .eq('id', feed.id)
      .eq('tenant_id', tenantId);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: userId ? 'user' : 'system',
      action: 'blog_competitor.poll',
      targetType: 'blog_competitor_feed',
      targetId: null,
      summary: `Competitor poll: ${detected} new posts, ${alerts} alerts.`,
      afterState: { detected, alerts },
    }),
  );

  return createCorsResponse({ detected, alerts }, 200, req);
}

async function listCompetitorPosts(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_competitor_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  const status = url.searchParams.get('status');
  const targets = url.searchParams.get('targetsOurKeyword');
  if (status) q = q.eq('status', status);
  if (targets === 'true') q = q.eq('targets_our_keyword', true);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list competitor posts' }, 500, req);
  return createCorsResponse({ posts: data ?? [] }, 200, req);
}

/** Generate (if missing) a response brief and insert a row into blog_briefs. */
async function createBriefFromResponse(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: post } = await admin
    .from('blog_competitor_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Competitor post not found' }, 404, req);
  if (post.brief_id) {
    return createCorsResponse(
      { error: 'Brief already created', brief_id: post.brief_id },
      409,
      req,
    );
  }

  // Generate the response brief if we don't have one yet (US-BLOG-071: what they
  // covered, what we should add/counter, suggested response angle).
  let responseBrief = post.response_brief as Record<string, unknown> | null;
  if (!responseBrief) {
    try {
      const sys =
        'You are a content strategist for a print/MFP dealer SaaS planning a response to a ' +
        'competitor article. Return ONLY a JSON object, no prose, no code fences.';
      const prompt = [
        `Competitor post: ${post.title ?? post.url}`,
        post.summary ? `Summary: ${post.summary}` : null,
        post.overlapping_keywords?.length
          ? `Keywords we both target: ${post.overlapping_keywords.join(', ')}`
          : null,
        '',
        'Shape: {"they_covered":string,"we_should_add":[strings],"counter_points":[strings],' +
          '"response_angle":string,"suggested_title":string,"outline":[{"h2":string,"h3":[strings]}],' +
          '"recommended_word_count":number}.',
      ]
        .filter(Boolean)
        .join('\n');
      const { text, usage } = await generateCompletionDetailed({
        max_tokens: 1500,
        temperature: 0.6,
        system: sys,
        messages: [{ role: 'user', content: prompt }],
      });
      responseBrief = extractJsonObject(text);
      await logAiCost(admin, {
        tenantId,
        provider: 'anthropic',
        feature: 'competitor.response_brief',
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
        costCents: usdToCents(usage.costUsd),
        userId,
      });
    } catch (err) {
      console.error('response brief generation failed', err);
      return createCorsResponse({ error: 'Response brief generation failed' }, 502, req);
    }
  }

  const rb = (responseBrief ?? {}) as Record<string, unknown>;
  const title =
    (typeof rb.suggested_title === 'string' && rb.suggested_title) ||
    `Response to: ${post.title ?? post.url}`;

  const { data: brief, error: briefErr } = await admin
    .from('blog_briefs')
    .insert({
      tenant_id: tenantId,
      title: String(title).slice(0, 500),
      outline: rb.outline ?? null,
      recommended_word_count:
        typeof rb.recommended_word_count === 'number' ? rb.recommended_word_count : null,
      key_takeaways: Array.isArray(rb.we_should_add) ? rb.we_should_add.map(String) : null,
      status: 'draft',
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (briefErr || !brief) {
    return createCorsResponse({ error: 'Failed to create brief' }, 500, req);
  }

  await admin
    .from('blog_competitor_posts')
    .update({
      response_brief: responseBrief,
      brief_id: brief.id,
      status: 'brief_created',
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_competitor.create_brief',
      targetType: 'blog_brief',
      targetId: brief.id,
      summary: `Created response brief from competitor post ${id}`,
      afterState: { competitor_post_id: id, brief_id: brief.id },
    }),
  );

  return createCorsResponse({ brief, competitor_post_id: id }, 201, req);
}

// ===========================================================================
// US-BLOG-066 — Auto-refresh agent
// ===========================================================================

interface AutoRefreshConfigRow {
  auto_refresh_requires_review: boolean;
  max_body_change_pct: number;
  block_on_seo_score_drop: boolean;
  block_on_brand_voice_violation: boolean;
  min_days_between_refresh: number;
  max_posts_per_run: number;
  enabled: boolean;
}

/** Crude body-change estimate (% of changed lines). Deterministic for tests. */
function estimateBodyChangePct(before: string, after: string): number {
  const a = (before || '').split('\n');
  const b = (after || '').split('\n');
  const setA = new Set(a);
  let changed = 0;
  for (const line of b) if (!setA.has(line)) changed++;
  const denom = Math.max(b.length, 1);
  return Math.min(100, Math.round((changed / denom) * 100));
}

async function getAutoRefreshConfigRoute(admin: Admin, tenantId: string, req: Request) {
  const cfg = await getAutoRefreshConfig(admin, tenantId);
  return createCorsResponse({ config: cfg }, 200, req);
}

async function patchAutoRefreshConfig(
  admin: Admin,
  tenantId: string,
  userId: string,
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = autoRefreshConfigPatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const before = await getAutoRefreshConfig(admin, tenantId);
  const { data, error } = await admin
    .from('blog_auto_refresh_config')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (error || !data) return createCorsResponse({ error: 'Failed to update config' }, 500, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_auto_refresh.config_update',
      targetType: 'blog_auto_refresh_config',
      targetId: data.id,
      beforeState: before,
      afterState: data,
      summary: 'Updated auto-refresh config',
    }),
  );
  return createCorsResponse({ config: data }, 200, req);
}

/** Resolve the candidate posts for an agent run. */
async function resolveCandidates(
  admin: Admin,
  tenantId: string,
  postIds: string[] | undefined,
  cfg: AutoRefreshConfigRow,
) {
  if (postIds && postIds.length) {
    const { data } = await admin
      .from('blog_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('id', postIds)
      .eq('status', 'published')
      .is('deleted_at', null);
    return data ?? [];
  }
  // Otherwise pull queued serp_decay rows from blog_refresh_queue, highest priority first.
  const { data: queue } = await admin
    .from('blog_refresh_queue')
    .select('id,post_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'queued')
    .order('priority', { ascending: false })
    .order('scheduled_at', { ascending: true })
    .limit(cfg.max_posts_per_run);
  const ids = (queue ?? []).map((r: { post_id: string }) => r.post_id);
  if (!ids.length) return [];
  const { data } = await admin
    .from('blog_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', ids)
    .eq('status', 'published')
    .is('deleted_at', null);
  // attach the queue id for status updates
  const queueByPost = new Map(
    (queue ?? []).map((r: { id: string; post_id: string }) => [r.post_id, r.id]),
  );
  return (data ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    _refresh_queue_id: queueByPost.get(p.id as string) ?? null,
  }));
}

async function autoRefreshRun(admin: Admin, tenantId: string, userId: string | null, req: Request) {
  let body: unknown = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }
  const parsed = autoRefreshRunSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  // KILL SWITCH FIRST — assertAgentsActive writes the skip audit entry on pause.
  const settings = await assertAgentsActive(admin, tenantId, AGENT_KIND, {
    reason: parsed.data.refresh_queue_id ? `queue ${parsed.data.refresh_queue_id}` : 'cron/manual',
  });
  if (!settings) {
    return createCorsResponse(
      { skipped: true, reason: 'agents_paused', status: 'skipped_kill_switch' },
      423,
      req,
    );
  }

  const cfg = (await getAutoRefreshConfig(admin, tenantId)) as AutoRefreshConfigRow;
  if (!cfg.enabled) {
    return createCorsResponse({ skipped: true, reason: 'auto_refresh_disabled' }, 200, req);
  }
  // The companion flag drives manual-review fallback (NOT the kill switch).
  const requiresReview = cfg.auto_refresh_requires_review;

  const candidates = await resolveCandidates(admin, tenantId, parsed.data.post_ids, cfg);
  const injected = parsed.data.injected ?? {};
  const runs: Array<Record<string, unknown>> = [];

  for (const post of candidates.slice(0, cfg.max_posts_per_run)) {
    const postId = post.id as string;
    const refreshQueueId =
      (post._refresh_queue_id as string | null) ?? parsed.data.refresh_queue_id ?? null;
    const inj = injected[postId];

    // Open a run row immediately (so cost/status is always recorded).
    const { data: runRow } = await admin
      .from('blog_auto_refresh_runs')
      .insert({
        tenant_id: tenantId,
        post_id: postId,
        refresh_queue_id: refreshQueueId,
        trigger: parsed.data.trigger ?? (parsed.data.post_ids ? 'manual' : 'queue'),
        status: 'running',
      })
      .select()
      .single();
    const runId = runRow?.id as string;

    if (refreshQueueId) {
      await admin
        .from('blog_refresh_queue')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          agent_run_id: runId,
        })
        .eq('id', refreshQueueId)
        .eq('tenant_id', tenantId);
    }

    try {
      // (1) re-run SERP analysis (reuse 070): fetch + persist a fresh snapshot.
      const targetKeyword =
        (post.meta_title as string | null) ?? (post.title as string | null) ?? '';
      const serp = await fetchSerp(targetKeyword, inj?.serp, {
        locationCode: 2840,
        languageCode: 'en',
      });
      const prevSnap = await latestSnapshot(admin, tenantId, targetKeyword);
      let currentSnapshotId: string | null = null;
      if (serp) {
        const { data: snap } = await admin
          .from('blog_serp_snapshots')
          .insert({
            tenant_id: tenantId,
            keyword: targetKeyword,
            organic_results: serp.organic_results,
            serp_features: serp.serp_features ?? null,
            source_adapter: inj?.serp ? 'injected' : 'dataforseo',
            created_by_user_id: userId,
          })
          .select('id')
          .single();
        currentSnapshotId = snap?.id ?? null;
      }

      // (2) diff vs prior blog_serp_snapshots.
      const serpDiff = serp
        ? diffSerp(prevSnap, serp, new Set<string>(), cfg.max_body_change_pct)
        : [];

      // (3) generate revised sections (LLM) — or use injected revision for tests.
      let revision: {
        title?: string;
        body_markdown: string;
        meta_description?: string | null;
        change_summary?: string;
        seo_score?: number;
        brand_voice_violations?: string[];
      };
      let costCents = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      let model: string | null = null;

      if (inj?.revision) {
        revision = inj.revision;
      } else {
        const sys =
          'You are an SEO content editor for a print/MFP dealer SaaS performing an autonomous ' +
          'refresh of an existing post in response to SERP movement. Preserve voice and facts; ' +
          'only revise sections that need updating. Return ONLY a JSON object, no prose, no fences.';
        const prompt = [
          `Post title: ${post.title}`,
          post.meta_description ? `Meta description: ${post.meta_description}` : null,
          `Current SEO score: ${post.seo_score ?? 'unknown'}`,
          `SERP diff: ${JSON.stringify(serpDiff).slice(0, 2000)}`,
          '',
          'Current body (markdown, truncated):',
          String(post.body_markdown ?? '').slice(0, 8000),
          '',
          'Shape: {"title":string,"body_markdown":string (full revised body),' +
            '"meta_description":string,"change_summary":string (what changed and why),' +
            '"seo_score":number (0-100 estimate of the revised body),' +
            '"brand_voice_violations":[strings, empty if none]}.',
        ]
          .filter(Boolean)
          .join('\n');
        const { text, usage } = await generateCompletionDetailed({
          max_tokens: 4000,
          temperature: 0.5,
          system: sys,
          messages: [{ role: 'user', content: prompt }],
        });
        const parsedLlm = extractJsonObject(text);
        revision = {
          title: typeof parsedLlm.title === 'string' ? parsedLlm.title : (post.title as string),
          body_markdown:
            typeof parsedLlm.body_markdown === 'string'
              ? parsedLlm.body_markdown
              : String(post.body_markdown ?? ''),
          meta_description:
            typeof parsedLlm.meta_description === 'string' ? parsedLlm.meta_description : null,
          change_summary:
            typeof parsedLlm.change_summary === 'string' ? parsedLlm.change_summary : 'Refreshed.',
          seo_score: typeof parsedLlm.seo_score === 'number' ? parsedLlm.seo_score : undefined,
          brand_voice_violations: Array.isArray(parsedLlm.brand_voice_violations)
            ? parsedLlm.brand_voice_violations.map(String)
            : [],
        };
        promptTokens = usage.inputTokens;
        completionTokens = usage.outputTokens;
        costCents = usdToCents(usage.costUsd);
        model = 'anthropic';
        await logAiCost(admin, {
          tenantId,
          provider: 'anthropic',
          feature: 'auto_refresh.revise',
          promptTokens,
          completionTokens,
          costCents,
          postId,
          userId,
        });
      }

      // Hard guardrails.
      const seoBefore = post.seo_score != null ? Number(post.seo_score) : null;
      const seoAfter = revision.seo_score ?? null;
      const predictedPct = estimateBodyChangePct(
        String(post.body_markdown ?? ''),
        revision.body_markdown,
      );
      const violations = revision.brand_voice_violations ?? [];

      const guardReasons: string[] = [];
      if (predictedPct > cfg.max_body_change_pct) guardReasons.push('body_change_exceeds_max');
      if (
        cfg.block_on_seo_score_drop &&
        seoBefore != null &&
        seoAfter != null &&
        seoAfter < seoBefore
      )
        guardReasons.push('seo_score_drop');
      if (cfg.block_on_brand_voice_violation && violations.length > 0)
        guardReasons.push('brand_voice_violation');
      if (requiresReview) guardReasons.push('requires_review_flag');

      const guardrailResult = { passed: guardReasons.length === 0, reasons: guardReasons };

      // Common run-row patch.
      const runPatch: Record<string, unknown> = {
        serp_diff: serpDiff,
        predicted_body_change_pct: predictedPct,
        seo_score_before: seoBefore,
        seo_score_after: seoAfter,
        guardrail_result: guardrailResult,
        change_summary: revision.change_summary ?? null,
        cost_cents: costCents,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        model,
        completed_at: new Date().toISOString(),
      };

      if (guardReasons.length > 0) {
        // → Review queue. Park the proposed content; do NOT auto-publish.
        const reason = guardReasons[0];
        const { data: review } = await admin
          .from('blog_auto_refresh_reviews')
          .insert({
            tenant_id: tenantId,
            post_id: postId,
            run_id: runId,
            reason,
            reason_detail: {
              predicted_pct: predictedPct,
              max_pct: cfg.max_body_change_pct,
              seo_before: seoBefore,
              seo_after: seoAfter,
              violations,
            },
            proposed_content: {
              title: revision.title,
              body_markdown: revision.body_markdown,
              meta_description: revision.meta_description ?? null,
              diff_summary: revision.change_summary ?? null,
            },
            change_summary: revision.change_summary ?? null,
            status: 'pending',
          })
          .select('id')
          .single();

        await admin
          .from('blog_auto_refresh_runs')
          .update({ ...runPatch, status: 'review_required', review_id: review?.id ?? null })
          .eq('id', runId)
          .eq('tenant_id', tenantId);

        if (refreshQueueId) {
          await admin
            .from('blog_refresh_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              result_summary: `Parked for review (${reason}).`,
            })
            .eq('id', refreshQueueId)
            .eq('tenant_id', tenantId);
        }

        await writeAuditLog(admin, {
          tenantId,
          actorUserId: userId,
          actorType: userId ? 'user' : 'agent',
          agentKind: AGENT_KIND,
          action: 'blog_auto_refresh.review_required',
          targetType: 'blog_post',
          targetId: postId,
          summary: `Auto-refresh parked for review (${guardReasons.join(', ')}). ${revision.change_summary ?? ''}`,
          afterState: { run_id: runId, reasons: guardReasons, predictedPct, seoBefore, seoAfter },
        });

        runs.push({
          post_id: postId,
          run_id: runId,
          status: 'review_required',
          reasons: guardReasons,
        });
        continue;
      }

      // Guardrails passed AND autonomous → commit revision + re-publish.
      // (4) commit a new blog_post_revisions row (revision_source='auto_refresh_agent').
      const { data: lastRev } = await admin
        .from('blog_post_revisions')
        .select('revision_number')
        .eq('post_id', postId)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      const revisionNumber = (lastRev?.revision_number ?? 0) + 1;
      const { data: revisionRow } = await admin
        .from('blog_post_revisions')
        .insert({
          post_id: postId,
          tenant_id: tenantId,
          revision_number: revisionNumber,
          title: revision.title ?? (post.title as string),
          body_markdown: revision.body_markdown,
          meta_description: revision.meta_description ?? null,
          revision_source: 'auto_refresh_agent',
          diff_summary: revision.change_summary ?? null,
          changed_by_user_id: null, // agent revision
          agent_run_id: runId,
        })
        .select('id')
        .single();

      // Update the live post body.
      await admin
        .from('blog_posts')
        .update({
          title: revision.title ?? post.title,
          body_markdown: revision.body_markdown,
          meta_description: revision.meta_description ?? post.meta_description,
          seo_score: seoAfter ?? post.seo_score,
          last_seo_check_at: new Date().toISOString(),
          last_decay_check_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', postId);

      // (5) re-publish via CMS adapter (stub).
      const cms = await cmsRepublish(
        {
          id: postId,
          cms_target_key: (post.cms_target_key as string | null) ?? null,
          cms_post_id: (post.cms_post_id as string | null) ?? null,
        },
        {
          title: revision.title ?? (post.title as string),
          body_markdown: revision.body_markdown,
          meta_description: revision.meta_description ?? null,
        },
        inj?.cms_result,
      );

      await admin
        .from('blog_auto_refresh_runs')
        .update({
          ...runPatch,
          status: 'published',
          revision_id: revisionRow?.id ?? null,
          cms_published: cms.ok,
          cms_result: cms.result,
        })
        .eq('id', runId)
        .eq('tenant_id', tenantId);

      if (refreshQueueId) {
        await admin
          .from('blog_refresh_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result_summary: revision.change_summary ?? 'Auto-refreshed.',
          })
          .eq('id', refreshQueueId)
          .eq('tenant_id', tenantId);
      }

      // (6) audit-log entry summarizing what changed and why.
      await writeAuditLog(admin, {
        tenantId,
        actorUserId: userId,
        actorType: userId ? 'user' : 'agent',
        agentKind: AGENT_KIND,
        action: 'blog_auto_refresh.published',
        targetType: 'blog_post',
        targetId: postId,
        summary: `Auto-refreshed & re-published. ${revision.change_summary ?? ''} (body change ~${predictedPct}%, SEO ${seoBefore ?? '?'}→${seoAfter ?? '?'})`,
        afterState: {
          run_id: runId,
          revision_id: revisionRow?.id,
          revision_number: revisionNumber,
          predictedPct,
          seoBefore,
          seoAfter,
          cms_published: cms.ok,
          cost_cents: costCents,
        },
      });

      runs.push({
        post_id: postId,
        run_id: runId,
        status: 'published',
        revision_id: revisionRow?.id,
      });
    } catch (err) {
      console.error('auto-refresh run error', err);
      await admin
        .from('blog_auto_refresh_runs')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : String(err),
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)
        .eq('tenant_id', tenantId);
      if (refreshQueueId) {
        await admin
          .from('blog_refresh_queue')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : String(err),
            completed_at: new Date().toISOString(),
          })
          .eq('id', refreshQueueId)
          .eq('tenant_id', tenantId);
      }
      runs.push({ post_id: postId, run_id: runId, status: 'failed' });
    }
  }

  return createCorsResponse({ processed: runs.length, runs }, 200, req);
}

async function listRuns(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_auto_refresh_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(200);
  const status = url.searchParams.get('status');
  const postId = url.searchParams.get('postId');
  if (status) q = q.eq('status', status);
  if (postId) q = q.eq('post_id', postId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list runs' }, 500, req);
  return createCorsResponse({ runs: data ?? [] }, 200, req);
}

async function listReviews(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_auto_refresh_reviews')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  const status = url.searchParams.get('status') ?? 'pending';
  q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list reviews' }, 500, req);
  return createCorsResponse({ reviews: data ?? [] }, 200, req);
}

/** Approve → commit the parked revision + re-publish; reject → close. */
async function resolveReview(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = resolveReviewSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { data: review } = await admin
    .from('blog_auto_refresh_reviews')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!review) return createCorsResponse({ error: 'Review not found' }, 404, req);
  if (review.status !== 'pending') {
    return createCorsResponse({ error: `Review already ${review.status}` }, 409, req);
  }

  let revisionId: string | null = null;
  if (parsed.data.action === 'approve') {
    const proposed = (review.proposed_content ?? {}) as Record<string, unknown>;
    const { data: lastRev } = await admin
      .from('blog_post_revisions')
      .select('revision_number')
      .eq('post_id', review.post_id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const revisionNumber = (lastRev?.revision_number ?? 0) + 1;
    const { data: revisionRow } = await admin
      .from('blog_post_revisions')
      .insert({
        post_id: review.post_id,
        tenant_id: tenantId,
        revision_number: revisionNumber,
        title: (proposed.title as string) ?? null,
        body_markdown: (proposed.body_markdown as string) ?? null,
        meta_description: (proposed.meta_description as string) ?? null,
        revision_source: 'auto_refresh_agent',
        diff_summary: (proposed.diff_summary as string) ?? review.change_summary,
        changed_by_user_id: userId,
        agent_run_id: review.run_id,
      })
      .select('id')
      .single();
    revisionId = revisionRow?.id ?? null;

    await admin
      .from('blog_posts')
      .update({
        title: (proposed.title as string) ?? undefined,
        body_markdown: (proposed.body_markdown as string) ?? undefined,
        meta_description: (proposed.meta_description as string) ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', review.post_id);
  }

  const { data: updated } = await admin
    .from('blog_auto_refresh_reviews')
    .update({
      status: parsed.data.action === 'approve' ? 'approved' : 'rejected',
      resolved_by_user_id: userId,
      resolved_at: new Date().toISOString(),
      resolution_note: parsed.data.note ?? null,
      revision_id: revisionId,
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
      action: `blog_auto_refresh.review_${parsed.data.action}`,
      targetType: 'blog_auto_refresh_review',
      targetId: id,
      summary: `Auto-refresh review ${parsed.data.action}d.${parsed.data.note ? ` Note: ${parsed.data.note}` : ''}`,
      afterState: { revision_id: revisionId },
    }),
  );

  return createCorsResponse({ review: updated }, 200, req);
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
    if (!hasRefreshManage(user)) {
      return createCorsResponse(
        { error: 'Forbidden: blog.refresh.manage or blog.post.edit required' },
        403,
        req,
      );
    }
    const tenantId = resolveTenantId(user, req);
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-serp-monitor');
    const [a, b, c, d] = parts;

    // --- 070 SERP monitor ---
    if (a === 'config') {
      if (req.method === 'GET') return await getMonitorConfigRoute(admin, tenantId, req);
      if (req.method === 'PATCH' || req.method === 'PUT')
        return await patchMonitorConfig(admin, tenantId, user.id, req);
    }
    if (a === 'poll' && req.method === 'POST') {
      return await poll(admin, tenantId, user.id, req);
    }
    if (a === 'volatility') {
      if (b === 'timeline' && req.method === 'GET')
        return await volatilityTimeline(admin, tenantId, url, req);
      if (!b && req.method === 'GET') return await listVolatility(admin, tenantId, url, req);
    }
    if (a === 'alerts') {
      if (!b && req.method === 'GET') return await listAlerts(admin, tenantId, url, req);
      if (b && c === 'read' && req.method === 'POST')
        return await markAlertRead(admin, tenantId, b, req);
    }

    // --- 071 competitor alerts ---
    if (a === 'competitors') {
      if (b === 'poll' && req.method === 'POST')
        return await competitorPoll(admin, tenantId, user.id, req);
      if (!b && req.method === 'GET') return await listFeeds(admin, tenantId, req);
      if (!b && req.method === 'POST') return await addFeed(admin, tenantId, user.id, req);
      if (b && !c && req.method === 'DELETE')
        return await deleteFeed(admin, tenantId, user.id, b, req);
    }
    if (a === 'competitor-posts') {
      if (!b && req.method === 'GET') return await listCompetitorPosts(admin, tenantId, url, req);
      if (b && c === 'create-brief' && req.method === 'POST')
        return await createBriefFromResponse(admin, tenantId, user.id, b, req);
    }

    // --- 066 auto-refresh agent ---
    if (a === 'auto-refresh') {
      if (b === 'config') {
        if (req.method === 'GET') return await getAutoRefreshConfigRoute(admin, tenantId, req);
        if (req.method === 'PATCH' || req.method === 'PUT')
          return await patchAutoRefreshConfig(admin, tenantId, user.id, req);
      }
      if (b === 'run' && req.method === 'POST') {
        return await autoRefreshRun(admin, tenantId, user.id, req);
      }
      if (b === 'runs' && req.method === 'GET') return await listRuns(admin, tenantId, url, req);
      if (b === 'reviews') {
        if (!c && req.method === 'GET') return await listReviews(admin, tenantId, url, req);
        if (c && d === 'resolve' && req.method === 'POST')
          return await resolveReview(admin, tenantId, user.id, c, req);
      }
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-serp-monitor handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
