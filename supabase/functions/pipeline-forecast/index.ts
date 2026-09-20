// Pipeline forecast Edge Function (EDGE-022).
//
// Prod parity for GET /api/pipeline-forecast/:forecastId? in
// server/routes-sales-forecasting.ts. Aggregates open deals + quotes +
// proposals into a weighted pipeline and compares it against active sales goals.
//
// WHY THIS EXISTS: SalesCommandCenter.tsx and SalesPipelineForecasting.tsx both
// read this endpoint, which only Express served — no edge function, so it 404'd
// in PRODUCTION. Found by npm run check:routes.
//
// URL layout (under /pipeline-forecast):
//   GET /                 — pipeline for the default period (current month)
//   GET /:forecastId      — pipeline scoped to one saved forecast's date range
//   query: ?period=monthly|... &startDate=&endDate=
//
// THE STAGE JOIN IS DONE IN TWO QUERIES, NOT ONE. The Express version uses
// `LEFT JOIN pipeline_stages ps ON ps.legacy_stage_id = d.stage_id`. PostgREST
// can only embed across a declared FOREIGN KEY, and legacy_stage_id is not one,
// so an embedded select would fail rather than degrade. Fetching the stages
// separately and joining in JS reproduces the same result.
//
// CRMX-005 semantics, with the COP-M07 correction:
//   - a closed stage decides outright (won = 100, lost = 0)
//   - otherwise a deal's own probability wins, but only when it is > 0
//   - else the stage's default_probability; else 50
//   - deals whose stage sets include_in_forecast = false are DROPPED
//   - quotes default to 50% and proposals to 70%
//
// The `> 0` is load-bearing, not defensive. This used to read
// `d.probability ?? stage.prob ?? 50`, and deals.probability DEFAULTS TO 0
// rather than null, so the `??` never fell through and the stage's
// default_probability was read into a map and then never used. Measured on the
// demo tenant: three open deals worth $158,000, all at probability 0, all in
// stages configured at 50% — the whole pipeline weighted to $0. See
// _shared/deal-probability.ts for why 0 has to be read as "unset".
//
// Response keys are camelCase — the pages read forecastData.pipeline.totalValue,
// .breakdown.deals.weightedValue, .remaining.progressPercent directly.
//
// Dir name == URL segment, so prod routing needs no server.ts override.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamelShallow } from '../_shared/case.ts';
import {
  DEAL_FALLBACK_PROBABILITY as SHARED_FALLBACK_PROBABILITY,
  resolveDealProbability,
} from '../_shared/deal-probability.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { applyUserScope, isUnscoped, resolveScope } from '../_shared/scope.ts';
import type { ResolvedScope } from '../_shared/scope.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import { startOfUtcDay, startOfNextUtcDay } from '../_shared/date-months.ts';
import { buildTerritoryIndex, rollupByTerritory } from '../_shared/territory.ts';
import {
  FORECAST_CATEGORIES,
  summarizeAccuracy,
  summarizeForecast,
  type ForecastDealRow,
  type ForecastSnapshotRow,
} from '../_shared/forecast-category.ts';

const QUOTE_DEFAULT_PROBABILITY = 50;
const PROPOSAL_DEFAULT_PROBABILITY = 70;
const DEAL_FALLBACK_PROBABILITY = SHARED_FALLBACK_PROBABILITY;

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

interface PipelineItem {
  id: string;
  title: string;
  value: number;
  probability: number;
  expectedCloseDate: string;
  status: string;
  type: 'deal' | 'quote' | 'proposal';
}

const weighted = (items: PipelineItem[]) =>
  items.reduce((sum, i) => sum + i.value * (i.probability / 100), 0);
const gross = (items: PipelineItem[]) => items.reduce((sum, i) => sum + i.value, 0);

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ message: userError?.message || 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const url = new URL(req.url);

    /**
     * WF-R-04 row scope, resolved once and applied to every owned query below.
     *
     * This function filtered on `tenant_id` and nothing else, so every caller
     * saw every deal in the tenant - and on the Categories tab that means a
     * per-owner commit list, which is each rep's forecast number beside their
     * name. The page is `minLevel: 3` in navigation-permissions, but A NAV GATE
     * HIDES A MENU ITEM AND PROTECTS NOTHING: the endpoint had no role check at
     * all, so any authenticated member of the tenant could ask for it directly.
     *
     * Narrowing rows rather than refusing the request is the right shape here.
     * A rep has a forecast and should see it; what they should not see is
     * everyone else's. `resolveScope` degrades to the NARROWER tier when the org
     * structure cannot answer a wider one, which is the safe direction.
     */
    const scope = await resolveScope(admin, {
      userId: user.id,
      tenantId,
      appMetadata: user.app_metadata,
      requestedScope: url.searchParams.get('scope'),
    });
    const { parts } = normalizePath(url.pathname, 'pipeline-forecast');
    const resource = parts[0];

    // ─── COP-I06 sub-resources ───────────────────────────────────────
    //
    // THESE BRANCH BEFORE `forecastId` IS READ, and that ordering is the whole
    // point. parts[0] is a saved forecast's id on the original route, so
    // /categories would otherwise be looked up as a forecast whose id is the
    // string "categories" - the SUPA-024 shape, where a real endpoint 404s
    // because a generic :id branch swallowed it first.
    if (resource === 'categories' || resource === 'accuracy' || resource === 'snapshots') {
      return await handleForecastCategories(req, {
        admin,
        tenantId,
        userId: user.id,
        url,
        resource,
        scope,
      });
    }

    const forecastId = resource;

    if (req.method !== 'GET') {
      return createCorsResponse({ message: 'Not found' }, 404, req);
    }

    const period = url.searchParams.get('period') ?? 'monthly';
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // ─── Optional saved forecast ─────────────────────────────────────
    let forecast: Record<string, unknown> | null = null;
    if (forecastId) {
      const { data, error } = await admin
        .from('sales_forecasts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', forecastId)
        .maybeSingle();
      if (error) return createCorsResponse({ message: error.message }, 500, req);
      forecast = data ? toCamelShallow(data) : null;
    }

    // ─── Date range: explicit query > the forecast's own range > this month
    let dateStart: Date;
    let dateEnd: Date;
    if (startDate && endDate) {
      dateStart = new Date(startDate);
      dateEnd = new Date(endDate);
    } else if (forecast) {
      dateStart = new Date(String(forecast.startDate));
      dateEnd = new Date(String(forecast.endDate));
    } else {
      const now = new Date();
      dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // ─── Source rows ─────────────────────────────────────────────────
    const [dealsRes, stagesRes, quotesRes, proposalsRes, goalsRes] = await Promise.all([
      applyUserScope(
        admin
          .from('deals')
          .select('id, title, amount, probability, status, expected_close_date, stage_id')
          .eq('tenant_id', tenantId)
          .not('status', 'in', '("won","lost")'),
        ['owner_id', 'created_by_id'],
        scope,
      ),
      admin
        .from('pipeline_stages')
        .select(
          'legacy_stage_id, default_probability, include_in_forecast, is_closed_won, is_closed_lost',
        )
        .eq('tenant_id', tenantId),
      // `quotes` has no owner column - only `created_by` - and `proposals`
      // carries `created_by` plus `assigned_to`. Scoped on what each table can
      // actually express rather than left tenant-wide, because these feed the
      // same weighted pipeline total as the deals above.
      applyUserScope(
        admin
          .from('quotes')
          .select('id, title, total_amount, status, valid_until, quote_number')
          .eq('tenant_id', tenantId)
          .in('status', ['Sent', 'Draft', 'Pending']),
        'created_by',
        scope,
      ),
      applyUserScope(
        admin
          .from('proposals')
          .select('id, title, total_amount, status, valid_until')
          .eq('tenant_id', tenantId)
          .in('status', ['sent', 'draft', 'pending', 'under_review']),
        ['assigned_to', 'created_by'],
        scope,
      ),
      // Mirrors the Express handler's inner try/catch: a tenant with no
      // sales_goals table/rows must not fail the whole forecast.
      admin
        .from('sales_goals')
        // AUDIT-037: `target_value` is not a column - sales_goals carries a
        // single `target_count` and a goal_type that says what it counts. Naming
        // it 42703'd the whole select, and because the result feeds an inner
        // try/catch the forecast simply showed no goals rather than an error.
        .select('id, goal_type, target_count, start_date, end_date')
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
    ]);

    for (const r of [dealsRes, stagesRes, quotesRes, proposalsRes]) {
      if (r.error) return createCorsResponse({ message: r.error.message }, 500, req);
    }
    const goalRows = goalsRes.error ? [] : (goalsRes.data ?? []);

    // Stage lookup, standing in for the LEFT JOIN (see the header note).
    const stageByLegacyId = new Map<
      string,
      {
        prob: number | null;
        include: boolean | null;
        isClosedWon: boolean | null;
        isClosedLost: boolean | null;
      }
    >();
    for (const s of stagesRes.data ?? []) {
      const row = s as {
        legacy_stage_id: string | null;
        default_probability: number | null;
        include_in_forecast: boolean | null;
        is_closed_won: boolean | null;
        is_closed_lost: boolean | null;
      };
      if (row.legacy_stage_id) {
        stageByLegacyId.set(row.legacy_stage_id, {
          prob: row.default_probability,
          include: row.include_in_forecast,
          isClosedWon: row.is_closed_won,
          isClosedLost: row.is_closed_lost,
        });
      }
    }

    const nowIso = new Date().toISOString();

    // deno-lint-ignore no-explicit-any
    const deals: PipelineItem[] = (dealsRes.data ?? [])
      .filter((d: any) => stageByLegacyId.get(d.stage_id)?.include !== false)
      .map((d: any) => ({
        id: d.id,
        title: d.title || `Deal ${d.id}`,
        value: num(d.amount),
        probability: resolveDealProbability(
          d.probability,
          stageByLegacyId.get(d.stage_id),
          DEAL_FALLBACK_PROBABILITY,
        ),
        expectedCloseDate: d.expected_close_date || nowIso,
        status: d.status || 'open',
        type: 'deal',
      }));

    // deno-lint-ignore no-explicit-any
    const quotes: PipelineItem[] = (quotesRes.data ?? []).map((q: any) => ({
      id: q.id,
      title: q.title || `Quote #${q.quote_number || q.id}`,
      value: num(q.total_amount),
      probability: QUOTE_DEFAULT_PROBABILITY,
      expectedCloseDate: q.valid_until || nowIso,
      status: q.status || 'sent',
      type: 'quote',
    }));

    // deno-lint-ignore no-explicit-any
    const proposals: PipelineItem[] = (proposalsRes.data ?? []).map((p: any) => ({
      id: p.id,
      title: p.title || `Proposal ${p.id}`,
      value: num(p.total_amount),
      probability: PROPOSAL_DEFAULT_PROBABILITY,
      expectedCloseDate: p.valid_until || nowIso,
      status: p.status || 'sent',
      type: 'proposal',
    }));

    const pipelineItems = [...deals, ...quotes, ...proposals];
    const totalPipelineValue = weighted(pipelineItems);
    const totalPipelineCount = pipelineItems.length;

    // deno-lint-ignore no-explicit-any
    // A revenue goal's amount is in target_count, the one target column this
    // table has.
    const totalGoalValue = (goalRows as any[])
      .filter((g) => g.goal_type === 'revenue')
      .reduce((sum, g) => sum + num(g.target_count), 0);
    // deno-lint-ignore no-explicit-any
    const totalGoalCount = (goalRows as any[])
      .filter((g) => g.goal_type !== 'revenue')
      .reduce((sum, g) => sum + (parseInt(String(g.target_count ?? '0'), 10) || 0), 0);

    return createCorsResponse(
      {
        forecast,
        period: { type: period, startDate: dateStart, endDate: dateEnd },
        pipeline: {
          items: pipelineItems,
          totalValue: totalPipelineValue,
          totalCount: totalPipelineCount,
          breakdown: {
            deals: { count: deals.length, value: gross(deals), weightedValue: weighted(deals) },
            quotes: { count: quotes.length, value: gross(quotes), weightedValue: weighted(quotes) },
            proposals: {
              count: proposals.length,
              value: gross(proposals),
              weightedValue: weighted(proposals),
            },
          },
        },
        goals: { items: goalRows, totalValue: totalGoalValue, totalCount: totalGoalCount },
        // The pipeline above is scoped; the GOALS beside it are not, because
        // sales_goals carries no owner column. A rep therefore sees their own
        // pipeline against a company target, which `remaining` would otherwise
        // present as a personal shortfall. Named rather than hidden.
        scope: describeScope(scope),
        scopeCaveat: isUnscoped(scope)
          ? null
          : 'Pipeline is narrowed to your scope; sales goals are not owner-specific, so progress against goal compares your pipeline to a company target.',
        remaining: {
          toGoalValue: Math.max(0, totalGoalValue - totalPipelineValue),
          toGoalCount: Math.max(0, totalGoalCount - totalPipelineCount),
          progressPercent:
            totalGoalValue > 0 ? Math.min(100, (totalPipelineValue / totalGoalValue) * 100) : 0,
        },
      },
      200,
      req,
    );
  } catch (error) {
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// COP-I06: forecast categories, the copier revenue split, and accuracy.
// ─────────────────────────────────────────────────────────────────────

/**
 * What the caller was allowed to see, said out loud.
 *
 * A roll-up that has been narrowed and does not SAY it was narrowed is a wrong
 * number, not a safe one: a supervisor reading "commit $240,000" has no way to
 * tell it covers their own deals rather than the team's, and it sits beside a
 * territory breakdown that would then not add up to it. The same reasoning as
 * COP-B10's explicit UNASSIGNED bucket.
 *
 * `degradedFrom` is reported because it is the honest part of resolveScope's
 * design: no story has filled in the org structure yet, so a tier that cannot
 * be answered falls back to a narrower one, and the caller is told which.
 */
function describeScope(scope: ResolvedScope): Record<string, unknown> {
  return {
    tier: scope.tier,
    coversWholeTenant: isUnscoped(scope),
    degradedFrom: scope.degradedFrom,
    note: isUnscoped(scope)
      ? null
      : scope.degradedFrom
        ? `These figures cover ${scope.tier === 'own' ? 'your own deals' : `your ${scope.tier}`} only. ${scope.degradedFrom} scope was requested but the organisation structure does not record it yet, so it narrowed rather than guessing wide.`
        : `These figures cover ${scope.tier === 'own' ? 'your own deals' : `your ${scope.tier}`} only, not the whole company.`,
  };
}

interface CategoryCtx {
  // deno-lint-ignore no-explicit-any
  admin: any;
  tenantId: string;
  userId: string;
  url: URL;
  resource: string;
  scope: ResolvedScope;
}

/**
 * The period being forecast. Defaults to the current calendar month.
 *
 * Snapped to DAY BOUNDARIES per DATE-LOCAL-002: `expected_close_date` is a
 * timestamp holding a calendar date, so a bound built from `new Date()` carries
 * a time of day and the window lands half a day off - silently, and in
 * whichever direction the operator happens to point.
 */
function resolvePeriod(url: URL): { start: Date; endExclusive: Date } {
  const startParam = url.searchParams.get('periodStart') ?? url.searchParams.get('startDate');
  const endParam = url.searchParams.get('periodEnd') ?? url.searchParams.get('endDate');
  if (startParam && endParam) {
    return {
      start: startOfUtcDay(new Date(startParam)),
      // Exclusive next-day bound, not an inclusive 23:59:59.999 - that is a
      // real timestamp a row can exceed.
      endExclusive: startOfNextUtcDay(new Date(endParam)),
    };
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, endExclusive };
}

/** The tenant's canonical stages, keyed by the legacy id deals.stage_id holds. */
// deno-lint-ignore no-explicit-any
async function loadStageWeighting(admin: any, tenantId: string) {
  const { data } = await admin
    .from('pipeline_stages')
    .select(
      'legacy_stage_id, default_probability, include_in_forecast, is_closed_won, is_closed_lost',
    )
    .eq('tenant_id', tenantId);
  const map = new Map<
    string,
    {
      prob: number | null;
      include: boolean | null;
      isClosedWon: boolean | null;
      isClosedLost: boolean | null;
    }
  >();
  // deno-lint-ignore no-explicit-any
  for (const row of (data ?? []) as any[]) {
    if (row.legacy_stage_id) {
      map.set(row.legacy_stage_id, {
        prob: row.default_probability,
        include: row.include_in_forecast,
        isClosedWon: row.is_closed_won,
        isClosedLost: row.is_closed_lost,
      });
    }
  }
  return map;
}

async function handleForecastCategories(req: Request, ctx: CategoryCtx): Promise<Response> {
  const { admin, tenantId, userId, url, resource, scope } = ctx;
  const { start, endExclusive } = resolvePeriod(url);

  // ─── GET /accuracy ─────────────────────────────────────────────────
  if (resource === 'accuracy') {
    if (req.method !== 'GET') {
      return createCorsResponse({ message: 'Method not allowed' }, 405, req);
    }

    const snapshots = await fetchAllRows<ForecastSnapshotRow>(() =>
      // A snapshot's `owner_id` is the rep it was captured FOR (null = the
      // whole book), and `captured_by` is who pressed the button. Scoped on
      // both: a rep may see the snapshots taken of their own number and the
      // ones they took, not their colleagues'.
      applyUserScope(
        admin
          .from('forecast_snapshots')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('period_start', { ascending: false }),
        ['owner_id', 'captured_by'],
        scope,
      ),
    );

    if ((snapshots ?? []).length === 0) {
      // AC6. No snapshot means no accuracy - not 100%, not zero. The only
      // honest answer is that nothing has been captured yet.
      return createCorsResponse(
        {
          periods: [],
          scope: describeScope(scope),
          unbacked: [
            'No forecast has been captured yet, so there is no commit to compare actuals against. Accuracy starts being measurable from the first capture.',
          ],
        },
        200,
        req,
      );
    }

    // Actual closed-won per period, keyed the way summarizeAccuracy expects.
    // One read spanning every snapshot period rather than one per period.
    const earliest = (snapshots ?? [])
      .map((s) => s.period_start)
      .filter(Boolean)
      .sort()[0] as string | undefined;

    const wonDeals = await fetchAllRows<Record<string, any>>(() =>
      applyUserScope(
        admin
          .from('deals')
          .select('owner_id, amount, actual_close_date')
          .eq('tenant_id', tenantId)
          .eq('status', 'won'),
        ['owner_id', 'created_by_id'],
        scope,
      ).gte(
        'actual_close_date',
        earliest ? startOfUtcDay(new Date(earliest)).toISOString() : '1970-01-01',
      ),
    );

    const actualByPeriod = new Map<string, number>();
    for (const snapshot of snapshots ?? []) {
      if (!snapshot.period_start || !snapshot.period_end) continue;
      const from = startOfUtcDay(new Date(snapshot.period_start)).getTime();
      const to = startOfNextUtcDay(new Date(snapshot.period_end)).getTime();
      const ownerId = snapshot.owner_id ?? null;
      const key = `${snapshot.period_start}|${ownerId ?? ''}`;
      if (actualByPeriod.has(key)) continue;

      let total = 0;
      for (const deal of wonDeals ?? []) {
        if (!deal.actual_close_date) continue;
        const closed = new Date(deal.actual_close_date).getTime();
        if (closed < from || closed >= to) continue;
        // A tenant-wide snapshot counts every rep; a per-rep one counts theirs.
        if (ownerId && deal.owner_id !== ownerId) continue;
        const amount = Number(deal.amount);
        if (Number.isFinite(amount)) total += amount;
      }
      actualByPeriod.set(key, total);
    }

    return createCorsResponse(
      {
        periods: summarizeAccuracy(snapshots ?? [], actualByPeriod),
        scope: describeScope(scope),
        unbacked: [
          'Attainment is measured on one-time (equipment) revenue only. Recurring CPC and service revenue is captured on the snapshot but lands over the life of a contract, so a single period cannot settle it.',
        ],
      },
      200,
      req,
    );
  }

  // ─── The open deals in the period, for both remaining branches ──────
  const stageByLegacyId = await loadStageWeighting(admin, tenantId);
  const dealRows = await fetchAllRows<ForecastDealRow>(() =>
    applyUserScope(
      admin
        .from('deals')
        .select(
          'id, owner_id, status, amount, estimated_monthly_value, forecast_category, probability, stage_id, expected_close_date',
        )
        .eq('tenant_id', tenantId)
        .not('status', 'in', '("won","lost")')
        .gte('expected_close_date', start.toISOString())
        .lt('expected_close_date', endExclusive.toISOString()),
      ['owner_id', 'created_by_id'],
      scope,
    ),
  );

  // AC2: the stage decides whether a deal forecasts at all, and at what
  // weight. Same rule the main handler uses, from the same shared helper.
  const inForecast = (dealRows ?? []).filter(
    (d) => stageByLegacyId.get(String(d.stage_id ?? ''))?.include !== false,
  );
  const summary = summarizeForecast(inForecast, (deal) =>
    resolveDealProbability(
      deal.probability,
      stageByLegacyId.get(String(deal.stage_id ?? '')),
      SHARED_FALLBACK_PROBABILITY,
    ),
  );

  // ─── POST /snapshots (AC4) ─────────────────────────────────────────
  if (resource === 'snapshots') {
    if (req.method === 'POST') {
      const commit = summary.buckets.find((b) => b.category === 'commit');
      const bestCase = summary.buckets.find((b) => b.category === 'best_case');
      const pipeline = summary.buckets.find((b) => b.category === 'pipeline');

      const { data, error } = await admin
        .from('forecast_snapshots')
        .insert({
          tenant_id: tenantId,
          period_start: start.toISOString(),
          // Stored INCLUSIVE, as the last day of the period: the exclusive
          // bound is a query detail and a stored 1 November would read as a
          // period that runs into the next month.
          period_end: new Date(endExclusive.getTime() - 86_400_000).toISOString(),
          owner_id: url.searchParams.get('ownerId') || null,
          commit_one_time_value: (commit?.oneTimeValue ?? 0).toFixed(2),
          best_case_one_time_value: (bestCase?.oneTimeValue ?? 0).toFixed(2),
          pipeline_one_time_value: (pipeline?.oneTimeValue ?? 0).toFixed(2),
          commit_recurring_monthly_value: (commit?.recurringMonthlyValue ?? 0).toFixed(2),
          deal_count: summary.totals.count,
          uncategorized_count: summary.totals.uncategorizedCount,
          captured_by: userId,
        })
        .select()
        .single();
      if (error) return createCorsResponse({ message: error.message }, 500, req);
      return createCorsResponse(toCamelShallow(data), 201, req);
    }

    if (req.method === 'GET') {
      const rows = await fetchAllRows<Record<string, unknown>>(() =>
        applyUserScope(
          admin
            .from('forecast_snapshots')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('captured_at', { ascending: false }),
          ['owner_id', 'captured_by'],
          scope,
        ),
      );
      return createCorsResponse({ data: (rows ?? []).map(toCamelShallow) }, 200, req);
    }

    return createCorsResponse({ message: 'Method not allowed' }, 405, req);
  }

  // ─── GET /categories ───────────────────────────────────────────────
  if (req.method !== 'GET') {
    return createCorsResponse({ message: 'Method not allowed' }, 405, req);
  }

  // Owner names, so a roll-up reads as people rather than as uuids.
  const ownerIds = [...new Set(summary.byOwner.map((o) => o.ownerId).filter(Boolean))] as string[];
  const ownerNames = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data } = await admin
      .from('users')
      .select('id, first_name, last_name')
      .in('id', ownerIds);
    // COP-M01's phantom-column note: `users` has first_name/last_name, NOT name.
    // deno-lint-ignore no-explicit-any
    for (const u of (data ?? []) as any[]) {
      const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      if (full) ownerNames.set(u.id, full);
    }
  }

  // COP-B09 AC5 / COP-I06 AC3: the TERRITORY roll-up, which until COP-B09 did
  // not exist and was named as absent rather than approximated. Resolved from
  // the account's territory text through the shared resolver, and the
  // UNASSIGNED bucket is kept explicitly - dropping it is how a territory
  // roll-up stops adding up to the totals shown everywhere else.
  let byTerritory: Array<Record<string, unknown>> = [];
  try {
    const dealAccountIds = [
      ...new Set(inForecast.map((d) => (d as Record<string, any>).customer_id).filter(Boolean)),
    ] as string[];
    if (dealAccountIds.length > 0) {
      const [territories, accounts] = await Promise.all([
        fetchAllRows<Record<string, any>>(() =>
          admin
            .from('sales_territories')
            .select('id, territory_name, territory_code, is_active')
            .eq('tenant_id', tenantId),
        ),
        fetchAllRows<Record<string, any>>(() =>
          admin
            .from('business_records')
            .select('id, territory')
            .eq('tenant_id', tenantId)
            .in('id', dealAccountIds),
        ),
      ]);
      const index = buildTerritoryIndex((territories ?? []).filter((t) => t.is_active !== false));
      const territoryByAccount = new Map(
        (accounts ?? []).map((a) => [a.id, a.territory as string | null]),
      );

      byTerritory = rollupByTerritory(
        inForecast,
        (deal) =>
          territoryByAccount.get(String((deal as Record<string, any>).customer_id ?? '')) ?? null,
        index,
      ).map((group) => {
        const summary = summarizeForecast(group.items, (deal) =>
          resolveDealProbability(
            deal.probability,
            stageByLegacyId.get(String(deal.stage_id ?? '')),
            SHARED_FALLBACK_PROBABILITY,
          ),
        );
        return {
          territoryId: group.territoryId,
          territoryName: group.territoryName,
          count: summary.totals.count,
          oneTimeValue: summary.totals.oneTimeValue,
          recurringMonthlyValue: summary.totals.recurringMonthlyValue,
          commitOneTimeValue:
            summary.buckets.find((b) => b.category === 'commit')?.oneTimeValue ?? 0,
          uncategorizedCount: summary.totals.uncategorizedCount,
        };
      });
    }
  } catch (err) {
    // A territory roll-up failing must not take down the forecast.
    console.error('Error building the territory roll-up:', err);
  }

  return createCorsResponse(
    {
      period: {
        start: start.toISOString(),
        // Echoed inclusive, matching what a snapshot stores.
        end: new Date(endExclusive.getTime() - 86_400_000).toISOString(),
      },
      byTerritory,
      categories: FORECAST_CATEGORIES,
      buckets: summary.buckets,
      byOwner: summary.byOwner.map((o) => ({
        ...o,
        ownerName: o.ownerId ? (ownerNames.get(o.ownerId) ?? null) : null,
      })),
      totals: summary.totals,
      scope: describeScope(scope),
      unbacked: summary.unbacked,
      // COP-B09 landed the territory roll-up above; TEAM roll-up still needs a
      // reporting hierarchy, which no story has built.
      territoryNote:
        byTerritory.length === 0
          ? 'No deal in this period resolves to a defined territory. Define territories, or check that accounts carry a matching territory name or code.'
          : null,
    },
    200,
    req,
  );
}
