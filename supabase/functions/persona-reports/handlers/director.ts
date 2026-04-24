// Director reports — /persona-reports/director/*
// Replaces server/routes/director-reports-api.ts (3 endpoints).
//
// Queries live in Postgres as PL/pgSQL functions (see
// drizzle/reports/director.sql) and are called via supabase.rpc(). The
// Express version cached results in an in-memory Map; we skip that here
// and let Postgres handle query caching — each edge invocation is a fresh
// isolate anyway, so in-memory cache adds no value.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { hasMinLevel, parseDateRange } from '../_context.ts';

export async function handleDirector(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  // pathParts: ['director', ...]
  const [, second, third] = pathParts;

  // All director endpoints require level 5+ (Regional Director and above).
  if (!hasMinLevel(auth, 5)) {
    return errorResponse(403, 'Regional Director or higher required', req, {
      code: 'FORBIDDEN',
      details: { minLevel: 5 },
      requestId,
    });
  }

  // GET /director/sales/company-performance
  if (method === 'GET' && second === 'sales' && third === 'company-performance') {
    const { dateFrom, dateTo } = parseDateRange(url);
    const { data, error } = await db.rpc('report_company_sales_performance', {
      p_tenant_id: auth.tenantId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch company sales performance', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const payload = (data ?? {}) as {
      totalRevenue?: number;
      totalDeals?: number;
      averageWinRate?: number;
      quotaAttainment?: number;
      pipelineValue?: number;
      regions?: Array<{ regionName: string; revenue: number }>;
    };

    const qa = Number(payload.quotaAttainment ?? 0);
    return jsonResponse(
      {
        ...payload,
        insights: {
          performanceStatus:
            qa >= 100 ? 'exceeding' : qa >= 90 ? 'on_track' : qa >= 75 ? 'near_target' : 'at_risk',
          topRegions: (payload.regions ?? []).slice(0, 3),
          pipelineCoverage:
            Number(payload.pipelineValue ?? 0) / Math.max(1, Number(payload.totalRevenue ?? 0)),
        },
      },
      200,
      req,
      requestId,
    );
  }

  // GET /director/service/company-performance
  if (method === 'GET' && second === 'service' && third === 'company-performance') {
    const { dateFrom, dateTo } = parseDateRange(url);
    const { data, error } = await db.rpc('report_company_service_performance', {
      p_tenant_id: auth.tenantId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch company service performance', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    const payload = (data ?? {}) as {
      avgFirstTimeFixRate?: number;
      avgSlaCompliance?: number;
      avgUtilization?: number;
      regions?: Array<{ ftfRate: number }>;
    };

    const ftf = Number(payload.avgFirstTimeFixRate ?? 0);
    const sla = Number(payload.avgSlaCompliance ?? 0);
    const util = Number(payload.avgUtilization ?? 0);

    return jsonResponse(
      {
        ...payload,
        insights: {
          serviceHealth:
            ftf >= 85 && sla >= 90
              ? 'excellent'
              : ftf >= 75 && sla >= 85
                ? 'good'
                : ftf >= 65 && sla >= 75
                  ? 'fair'
                  : 'needs_improvement',
          topRegions: (payload.regions ?? [])
            .slice()
            .sort((a, b) => Number(b.ftfRate ?? 0) - Number(a.ftfRate ?? 0))
            .slice(0, 3),
          utilizationStatus: util >= 80 ? 'optimal' : util >= 60 ? 'adequate' : 'low',
        },
      },
      200,
      req,
      requestId,
    );
  }

  // POST /director/clear-cache
  // Express kept an in-memory Map cache per Node process. Edge functions run
  // in short-lived isolates so there's nothing to clear — kept as a no-op
  // for frontend compatibility.
  if (method === 'POST' && second === 'clear-cache' && !third) {
    return jsonResponse(
      {
        message: 'Cache cleared successfully',
        note: 'Edge functions are stateless; cache was a no-op.',
      },
      200,
      req,
      requestId,
    );
  }

  return null;
}
