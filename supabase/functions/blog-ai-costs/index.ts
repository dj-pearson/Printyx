// Blog AI Cost Dashboard + Quotas Edge Function (US-BLOG-078)
//
// Full visibility into AI spend per workspace so operators can bill / cap
// accurately. Every blog LLM/adapter call logs to blog_ai_costs (via the
// shared ../_shared/blog/ai-cost.ts helper); this function surfaces the
// aggregates, manages the per-workspace monthly quota, and flags anomalies.
//
// Routes (tenant-scoped on every query):
//   POST /blog-ai-costs/log          body: { provider, model?, feature, prompt_tokens?,
//                                            completion_tokens?, cost_cents, request_id?, post_id? }
//                                     Records a cost row + returns the post-write quota status.
//                                     (Most features log via the shared helper directly; this
//                                      endpoint exists for clients/adapters that can't import it.)
//   GET  /blog-ai-costs/dashboard?range=28d&compare=true
//                                     Cards + by-feature + by-model + daily series + forecast +
//                                     quota status. range ∈ 7d|28d|90d|mtd (default 28d).
//   GET  /blog-ai-costs/dashboard.csv?view=feature|model|day&range=28d   → CSV export
//   GET  /blog-ai-costs/quota         Quota config + current month status.
//   PUT  /blog-ai-costs/quota         body: { monthly_limit_cents?, warn_threshold_pct?,
//                                            hard_stop?, anomaly_multiplier?, alert_email?,
//                                            alert_slack_webhook? }   (platform admin only)
//   GET  /blog-ai-costs/anomalies     Days/features whose spend exceeds anomaly_multiplier ×
//                                     the trailing 7-day daily average.
//
// Cross-workspace (all-tenant) rollups for a platform operator are intentionally
// NOT served here — that would break tenant isolation. A separate platform-admin
// endpoint would aggregate across tenants; within this function everything is
// scoped to the caller's tenant_id.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import {
  logAiCost,
  getQuotaRow,
  getQuotaStatus,
  getSpendSinceCents,
  currentMonthStart,
  type QuotaRow,
} from '../_shared/blog/ai-cost.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

interface CostRow {
  feature: string;
  model: string | null;
  provider: string;
  cost_cents: number | null;
  total_tokens: number | null;
  created_at: string;
}

const logSchema = z.object({
  provider: z.string().min(1).max(32),
  model: z.string().max(80).optional(),
  feature: z.string().min(1).max(64),
  prompt_tokens: z.number().int().min(0).optional(),
  completion_tokens: z.number().int().min(0).optional(),
  cost_cents: z.number().int().min(0),
  request_id: z.string().max(200).optional(),
  post_id: z.string().uuid().optional(),
  pipeline_run_id: z.string().uuid().optional(),
});

const quotaSchema = z.object({
  monthly_limit_cents: z.number().int().min(0).nullable().optional(),
  warn_threshold_pct: z.number().int().min(1).max(100).optional(),
  hard_stop: z.boolean().optional(),
  anomaly_multiplier: z.number().min(1).max(100).optional(),
  alert_email: z.string().email().max(320).nullable().optional(),
  alert_slack_webhook: z.string().url().max(2000).nullable().optional(),
});

function isPlatformAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin';
}

function hasCostView(user: { app_metadata?: Record<string, unknown> }): boolean {
  if (isPlatformAdmin(user)) return true;
  const meta = user.app_metadata ?? {};
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.analytics.view') || perms.includes('blog.refresh.manage'))
  ) {
    return true;
  }
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'company_admin';
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
    if (!hasCostView(user)) {
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
    const { parts } = normalizePath(url.pathname, 'blog-ai-costs');
    const action = parts[0];

    if (action === 'log' && req.method === 'POST') {
      return await handleLog(admin, tenantId, user.id, req);
    }
    if (action === 'dashboard' && req.method === 'GET') {
      return await handleDashboard(admin, tenantId, url, req);
    }
    if (action === 'dashboard.csv' && req.method === 'GET') {
      return await handleDashboardCsv(admin, tenantId, url, req);
    }
    if (action === 'quota' && req.method === 'GET') {
      return await handleGetQuota(admin, tenantId, req);
    }
    if (action === 'quota' && req.method === 'PUT') {
      if (!isPlatformAdmin(user)) {
        return createCorsResponse({ error: 'Forbidden: platform admin required' }, 403, req);
      }
      return await handlePutQuota(admin, tenantId, user.id, req);
    }
    if (action === 'anomalies' && req.method === 'GET') {
      return await handleAnomalies(admin, tenantId, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-ai-costs handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─── POST /log ──────────────────────────────────────────────────────────────
async function handleLog(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = logSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;
  await logAiCost(admin, {
    tenantId,
    provider: d.provider,
    model: d.model ?? null,
    feature: d.feature,
    promptTokens: d.prompt_tokens,
    completionTokens: d.completion_tokens,
    costCents: d.cost_cents,
    requestId: d.request_id ?? null,
    postId: d.post_id ?? null,
    pipelineRunId: d.pipeline_run_id ?? null,
    userId,
  });
  const status = await getQuotaStatus(admin, tenantId);
  return createCorsResponse({ ok: true, quota: status }, 201, req);
}

// ─── range parsing ────────────────────────────────────────────────────────
function rangeToDays(range: string | null): number {
  switch (range) {
    case '7d':
      return 7;
    case '90d':
      return 90;
    case 'mtd': {
      const now = new Date();
      return now.getUTCDate(); // days elapsed this month, inclusive
    }
    case '28d':
    default:
      return 28;
  }
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Paginated fetch of cost rows for a tenant since an ISO timestamp. */
async function fetchCostRows(
  admin: Admin,
  tenantId: string,
  sinceIso: string,
  untilIso?: string,
): Promise<CostRow[]> {
  const out: CostRow[] = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    let q = admin
      .from('blog_ai_costs')
      .select('feature, model, provider, cost_cents, total_tokens, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(from, from + page - 1);
    if (untilIso) q = q.lt('created_at', untilIso);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    out.push(...(data as CostRow[]));
    if (data.length < page) break;
    from += page;
  }
  return out;
}

interface Bucket {
  cost_cents: number;
  tokens: number;
  calls: number;
}

function emptyBucket(): Bucket {
  return { cost_cents: 0, tokens: 0, calls: 0 };
}

function bucketize(rows: CostRow[], keyOf: (r: CostRow) => string): Record<string, Bucket> {
  const map: Record<string, Bucket> = {};
  for (const r of rows) {
    const key = keyOf(r) || '(none)';
    const b = (map[key] ??= emptyBucket());
    b.cost_cents += r.cost_cents ?? 0;
    b.tokens += r.total_tokens ?? 0;
    b.calls += 1;
  }
  return map;
}

function bucketsToSortedList(map: Record<string, Bucket>) {
  return Object.entries(map)
    .map(([key, b]) => ({ key, ...b }))
    .sort((a, b) => b.cost_cents - a.cost_cents);
}

function sumCost(rows: CostRow[]): number {
  return rows.reduce((s, r) => s + (r.cost_cents ?? 0), 0);
}

// ─── GET /dashboard ──────────────────────────────────────────────────────────
async function handleDashboard(admin: Admin, tenantId: string, url: URL, req: Request) {
  const range = url.searchParams.get('range');
  const days = rangeToDays(range);
  const compare = url.searchParams.get('compare') === 'true';

  const sinceIso = isoDaysAgo(days);
  const rows = await fetchCostRows(admin, tenantId, sinceIso);

  const byFeature = bucketsToSortedList(bucketize(rows, (r) => r.feature));
  const byModel = bucketsToSortedList(bucketize(rows, (r) => r.model ?? '(none)'));
  const byProvider = bucketsToSortedList(bucketize(rows, (r) => r.provider));

  // Daily series over the window (fill gaps with zero).
  const dayMap = bucketize(rows, (r) => dayKey(r.created_at));
  const daily: Array<{ date: string; cost_cents: number; calls: number; tokens: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(isoDaysAgo(i));
    const b = dayMap[key] ?? emptyBucket();
    daily.push({ date: key, cost_cents: b.cost_cents, calls: b.calls, tokens: b.tokens });
  }

  const totalCents = sumCost(rows);

  // Comparison vs the prior equal-length window.
  let comparison:
    | { prior_cost_cents: number; delta_cents: number; delta_pct: number | null }
    | undefined;
  if (compare) {
    const priorSince = isoDaysAgo(days * 2);
    const priorRows = await fetchCostRows(admin, tenantId, priorSince, sinceIso);
    const priorCents = sumCost(priorRows);
    comparison = {
      prior_cost_cents: priorCents,
      delta_cents: totalCents - priorCents,
      delta_pct: priorCents > 0 ? ((totalCents - priorCents) / priorCents) * 100 : null,
    };
  }

  // Forecast: trailing 7-day daily average × days remaining in month + MTD spend.
  const monthStart = currentMonthStart();
  const mtdCents = await getSpendSinceCents(admin, tenantId, monthStart);
  const last7 = await fetchCostRows(admin, tenantId, isoDaysAgo(7));
  const avgDailyCents = sumCost(last7) / 7;
  const now = new Date();
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const daysRemaining = daysInMonth - now.getUTCDate();
  const forecastMonthCents = Math.round(mtdCents + avgDailyCents * daysRemaining);

  const quota = await getQuotaStatus(admin, tenantId);

  return createCorsResponse(
    {
      range: range ?? '28d',
      window_days: days,
      cards: {
        total_cost_cents: totalCents,
        total_calls: rows.length,
        total_tokens: rows.reduce((s, r) => s + (r.total_tokens ?? 0), 0),
        avg_daily_cents: Math.round(avgDailyCents),
        comparison,
      },
      by_feature: byFeature,
      by_model: byModel,
      by_provider: byProvider,
      daily,
      forecast: {
        month_to_date_cents: mtdCents,
        avg_daily_cents: Math.round(avgDailyCents),
        days_remaining: daysRemaining,
        forecast_month_cents: forecastMonthCents,
      },
      quota,
    },
    200,
    req,
  );
}

// ─── GET /dashboard.csv ───────────────────────────────────────────────────────
async function handleDashboardCsv(admin: Admin, tenantId: string, url: URL, req: Request) {
  const view = url.searchParams.get('view') ?? 'feature';
  const days = rangeToDays(url.searchParams.get('range'));
  const rows = await fetchCostRows(admin, tenantId, isoDaysAgo(days));

  let header: string;
  let lines: string[];
  if (view === 'day') {
    header = 'date,cost_cents,calls,tokens';
    const dayMap = bucketize(rows, (r) => dayKey(r.created_at));
    lines = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = dayKey(isoDaysAgo(i));
      const b = dayMap[key] ?? emptyBucket();
      lines.push(`${key},${b.cost_cents},${b.calls},${b.tokens}`);
    }
  } else {
    const keyOf =
      view === 'model'
        ? (r: CostRow) => r.model ?? '(none)'
        : view === 'provider'
          ? (r: CostRow) => r.provider
          : (r: CostRow) => r.feature;
    header = `${view},cost_cents,calls,tokens`;
    lines = bucketsToSortedList(bucketize(rows, keyOf)).map(
      (b) => `${csvCell(b.key)},${b.cost_cents},${b.calls},${b.tokens}`,
    );
  }

  const csv = [header, ...lines].join('\n');
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ai-costs-${view}-${days}d.csv"`,
      'Access-Control-Allow-Origin': req.headers.get('Origin') ?? '*',
    },
  });
}

function csvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ─── GET /quota ───────────────────────────────────────────────────────────────
async function handleGetQuota(admin: Admin, tenantId: string, req: Request) {
  const quota = await getQuotaRow(admin, tenantId);
  const status = await getQuotaStatus(admin, tenantId);
  return createCorsResponse({ quota: redactQuota(quota), status }, 200, req);
}

// ─── PUT /quota ───────────────────────────────────────────────────────────────
async function handlePutQuota(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = quotaSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const before = await getQuotaRow(admin, tenantId);
  const d = parsed.data;
  const patch: Record<string, unknown> = { tenant_id: tenantId, updated_at: new Date().toISOString() };
  if (d.monthly_limit_cents !== undefined) patch.monthly_limit_cents = d.monthly_limit_cents;
  if (d.warn_threshold_pct !== undefined) patch.warn_threshold_pct = d.warn_threshold_pct;
  if (d.hard_stop !== undefined) patch.hard_stop = d.hard_stop;
  if (d.anomaly_multiplier !== undefined) patch.anomaly_multiplier = d.anomaly_multiplier;
  if (d.alert_email !== undefined) patch.alert_email = d.alert_email;
  if (d.alert_slack_webhook !== undefined) patch.alert_slack_webhook = d.alert_slack_webhook;

  const { data: updated, error } = await admin
    .from('blog_ai_quotas')
    .upsert(patch, { onConflict: 'tenant_id' })
    .select('*')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Update failed' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_ai_quota.update',
      targetType: 'blog_ai_quota',
      targetId: (updated as QuotaRow).id,
      beforeState: redactQuota(before),
      afterState: redactQuota(updated as QuotaRow),
      summary: `Updated AI quota (limit ${(updated as QuotaRow).monthly_limit_cents ?? 'unlimited'}¢/mo, hard_stop=${(updated as QuotaRow).hard_stop})`,
    }),
  );

  const status = await getQuotaStatus(admin, tenantId);
  return createCorsResponse({ quota: redactQuota(updated as QuotaRow), status }, 200, req);
}

/** Never return the raw Slack webhook; expose a boolean marker instead. */
function redactQuota(q: QuotaRow) {
  const { alert_slack_webhook, ...rest } = q;
  return { ...rest, alert_slack_webhook_set: Boolean(alert_slack_webhook) };
}

// ─── GET /anomalies ───────────────────────────────────────────────────────────
async function handleAnomalies(admin: Admin, tenantId: string, req: Request) {
  const quota = await getQuotaRow(admin, tenantId);
  const multiplier = Number(quota.anomaly_multiplier) || 3;

  // Compare each of the last 14 days against the trailing 7-day average that
  // PRECEDES it, so a single spike doesn't inflate its own baseline.
  const rows = await fetchCostRows(admin, tenantId, isoDaysAgo(21));
  const perDay = bucketize(rows, (r) => dayKey(r.created_at));

  const anomalies: Array<{
    date: string;
    cost_cents: number;
    baseline_cents: number;
    multiple: number;
  }> = [];
  for (let i = 13; i >= 0; i--) {
    const day = dayKey(isoDaysAgo(i));
    const cost = perDay[day]?.cost_cents ?? 0;
    // baseline = mean of the 7 days before this one
    let sum = 0;
    let n = 0;
    for (let j = i + 1; j <= i + 7; j++) {
      sum += perDay[dayKey(isoDaysAgo(j))]?.cost_cents ?? 0;
      n++;
    }
    const baseline = n > 0 ? sum / n : 0;
    if (baseline > 0 && cost >= baseline * multiplier) {
      anomalies.push({
        date: day,
        cost_cents: cost,
        baseline_cents: Math.round(baseline),
        multiple: Number((cost / baseline).toFixed(2)),
      });
    }
  }

  return createCorsResponse(
    {
      multiplier,
      anomalies,
      note:
        'Anomaly = a day whose spend is ≥ multiplier × the mean of the prior 7 days. ' +
        'Alert delivery (email/Slack) is wired by the worker that reads this endpoint.',
    },
    200,
    req,
  );
}
