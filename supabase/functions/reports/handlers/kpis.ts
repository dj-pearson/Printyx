// KPI endpoints — /reports/kpis/*
// Replaces server/routes-reporting.ts KPI section + adds /summary aggregate.
//
// URL layout:
//   GET /reports/kpis                  — list active KPIs in scope, with latest values
//   GET /reports/kpis/summary          — dashboard-friendly aggregate (NEW; Express had no equivalent)
//   GET /reports/kpis/:id/historical   — historical KPI values + trend analysis
//
// Tables: kpi_definitions, kpi_values (shared/reporting-schema.ts).
// Both schemas match the original Express implementation; no degradation needed.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleKpis(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts } = ctx;
  // pathParts: ['kpis', ...]
  const sub = pathParts[1];
  const sub2 = pathParts[2];

  if (method !== 'GET') return null;

  if (!sub) return await listKpis(req, ctx);
  if (sub === 'summary') return await kpiSummary(req, ctx);
  if (sub2 === 'historical') return await kpiHistorical(req, ctx, sub);

  return null;
}

// ─── GET /reports/kpis ──────────────────────────────────────────────────────

async function listKpis(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const category = url.searchParams.get('category');
  const timePeriod = url.searchParams.get('time_period') ?? 'monthly';

  let q = db
    .from('kpi_definitions')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true);
  if (category) q = q.eq('category', category);

  const { data: defs, error: defErr } = await q;
  if (defErr) {
    return errorResponse(500, 'Failed to fetch KPIs', req, {
      code: 'DB_ERROR',
      details: defErr.message,
      requestId,
    });
  }

  const definitions = (defs ?? []) as Array<Record<string, unknown>>;

  // Fetch the latest value per KPI in the requested time period.
  const kpiIds = definitions.map((k) => k.id as string);
  const valueMap = await fetchLatestValues(db, auth.tenantId, kpiIds, timePeriod);

  const kpis = definitions.map((kpi) => {
    const id = kpi.id as string;
    const v = valueMap.get(id);
    return {
      ...kpi,
      current_value: v?.actual_value ?? null,
      target_value: v?.target_value ?? kpi.target_value ?? null,
      performance_level: v?.performance_level ?? null,
      last_updated: v?.calculation_timestamp ?? null,
      variance_percentage: v?.variance_percentage ?? null,
    };
  });

  return jsonResponse(
    {
      kpis,
      lastUpdated: new Date().toISOString(),
      availableCategories: Array.from(new Set(kpis.map((k) => k.category as string))).sort(),
    },
    200,
    req,
    requestId,
  );
}

// ─── GET /reports/kpis/summary ──────────────────────────────────────────────

async function kpiSummary(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const timePeriod = url.searchParams.get('time_period') ?? 'monthly';

  const { data: defs, error: defErr } = await db
    .from('kpi_definitions')
    .select(
      'id, code, name, category, display_format, prefix, suffix, decimal_places, is_high_priority',
    )
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true);

  if (defErr) {
    return errorResponse(500, 'Failed to fetch KPI summary', req, {
      code: 'DB_ERROR',
      details: defErr.message,
      requestId,
    });
  }

  const definitions = (defs ?? []) as Array<Record<string, unknown>>;
  const kpiIds = definitions.map((k) => k.id as string);
  const valueMap = await fetchLatestValues(db, auth.tenantId, kpiIds, timePeriod);

  type Bucket = {
    exceeding: number;
    on_track: number;
    near_target: number;
    at_risk: number;
    unknown: number;
  };
  const counts: Bucket = { exceeding: 0, on_track: 0, near_target: 0, at_risk: 0, unknown: 0 };
  const items: Array<Record<string, unknown>> = [];

  for (const def of definitions) {
    const id = def.id as string;
    const v = valueMap.get(id);
    const level = (v?.performance_level as string | undefined) ?? 'unknown';
    if (level in counts) counts[level as keyof Bucket] += 1;
    else counts.unknown += 1;
    items.push({
      id,
      code: def.code,
      name: def.name,
      category: def.category,
      isHighPriority: def.is_high_priority ?? false,
      displayFormat: def.display_format,
      prefix: def.prefix,
      suffix: def.suffix,
      decimalPlaces: def.decimal_places,
      currentValue: v?.actual_value ?? null,
      targetValue: v?.target_value ?? null,
      variancePercentage: v?.variance_percentage ?? null,
      performanceLevel: level,
      lastUpdated: v?.calculation_timestamp ?? null,
    });
  }

  const totalKpis = items.length;
  const onTargetCount = counts.exceeding + counts.on_track;
  const onTargetPct = totalKpis > 0 ? Math.round((onTargetCount / totalKpis) * 100) : 0;

  return jsonResponse(
    {
      summary: {
        totalKpis,
        onTargetCount,
        onTargetPercentage: onTargetPct,
        atRiskCount: counts.at_risk,
        nearTargetCount: counts.near_target,
        exceedingCount: counts.exceeding,
        unknownCount: counts.unknown,
      },
      items,
      lastUpdated: new Date().toISOString(),
    },
    200,
    req,
    requestId,
  );
}

// ─── GET /reports/kpis/:id/historical ───────────────────────────────────────

async function kpiHistorical(req: Request, ctx: HandlerCtx, kpiId: string): Promise<Response> {
  const { auth, db, requestId, url } = ctx;
  const fromDate = url.searchParams.get('from_date');
  const toDate = url.searchParams.get('to_date');
  const granularity = url.searchParams.get('granularity') ?? 'monthly';

  let q = db
    .from('kpi_values')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('kpi_definition_id', kpiId)
    .eq('time_period', granularity)
    .order('date_value', { ascending: false });

  if (fromDate) q = q.gte('date_value', fromDate);
  if (toDate) q = q.lte('date_value', toDate);

  const { data, error } = await q;
  if (error) {
    return errorResponse(500, 'Failed to fetch KPI historical data', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const values = rows.map((r) => Number(r.actual_value ?? 0));
  const total = values.reduce((s, v) => s + v, 0);
  const avg = values.length > 0 ? total / values.length : 0;
  const trend = calculateTrend(values);

  return jsonResponse(
    {
      historicalData: rows,
      trendAnalysis: trend,
      summary: {
        totalPeriods: values.length,
        averageValue: Number(avg.toFixed(4)),
        bestPerformance: values.length > 0 ? Math.max(...values) : 0,
        worstPerformance: values.length > 0 ? Math.min(...values) : 0,
      },
    },
    200,
    req,
    requestId,
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function fetchLatestValues(
  db: HandlerCtx['db'],
  tenantId: string,
  kpiIds: string[],
  timePeriod: string,
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  if (kpiIds.length === 0) return map;

  // Fetch all rows for the KPI IDs in the time period, ordered by date desc.
  // We pick the first row per kpi_definition_id in JS to avoid a per-KPI query.
  const { data, error } = await db
    .from('kpi_values')
    .select(
      'kpi_definition_id, actual_value, target_value, performance_level, variance_percentage, calculation_timestamp, date_value',
    )
    .eq('tenant_id', tenantId)
    .in('kpi_definition_id', kpiIds)
    .eq('time_period', timePeriod)
    .order('date_value', { ascending: false });

  if (error || !data) return map;

  for (const row of data as Array<Record<string, unknown>>) {
    const id = row.kpi_definition_id as string;
    if (!map.has(id)) map.set(id, row);
  }
  return map;
}

function calculateTrend(values: number[]): {
  direction: 'up' | 'down' | 'stable' | 'unknown';
  changePercentage: number;
  volatility: number;
} {
  if (values.length < 2) {
    return { direction: 'unknown', changePercentage: 0, volatility: 0 };
  }
  // values are ordered date desc, so [0] is latest, [last] is oldest.
  const latest = values[0];
  const oldest = values[values.length - 1];
  const change = oldest === 0 ? 0 : ((latest - oldest) / Math.abs(oldest)) * 100;

  const direction: 'up' | 'down' | 'stable' =
    Math.abs(change) < 1 ? 'stable' : change > 0 ? 'up' : 'down';

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const volatility = Math.sqrt(variance);

  return {
    direction,
    changePercentage: Number(change.toFixed(2)),
    volatility: Number(volatility.toFixed(4)),
  };
}
