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

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'pipeline-forecast');
    const forecastId = parts[0];

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
      admin
        .from('deals')
        .select('id, title, amount, probability, status, expected_close_date, stage_id')
        .eq('tenant_id', tenantId)
        .not('status', 'in', '("won","lost")'),
      admin
        .from('pipeline_stages')
        .select(
          'legacy_stage_id, default_probability, include_in_forecast, is_closed_won, is_closed_lost',
        )
        .eq('tenant_id', tenantId),
      admin
        .from('quotes')
        .select('id, title, total_amount, status, valid_until, quote_number')
        .eq('tenant_id', tenantId)
        .in('status', ['Sent', 'Draft', 'Pending']),
      admin
        .from('proposals')
        .select('id, title, total_amount, status, valid_until')
        .eq('tenant_id', tenantId)
        .in('status', ['sent', 'draft', 'pending', 'under_review']),
      // Mirrors the Express handler's inner try/catch: a tenant with no
      // sales_goals table/rows must not fail the whole forecast.
      admin
        .from('sales_goals')
        .select('id, goal_type, target_value, target_count, start_date, end_date')
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
    const totalGoalValue = (goalRows as any[])
      .filter((g) => g.goal_type === 'revenue')
      .reduce((sum, g) => sum + num(g.target_value), 0);
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
