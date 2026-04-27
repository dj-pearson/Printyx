// Sales Manager reports — /persona-reports/sales-manager/*
// Replaces server/routes/sales-manager-reports-api.ts (5 endpoints, 291 lines)
// + server/services/sales-manager-reporting-service.ts (629 lines).
//
// Ports the regional-performance endpoint as the manager-persona template.
// The other 3 regional queries (pipeline / quota / activity) return 501;
// they follow the same region-rollup shape as /regional-performance and can
// be added by cloning that SQL function with different aggregates.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { hasMinLevel, parseDateRange } from '../_context.ts';

const PENDING_ENDPOINTS: Record<string, { sourceLines: string; note: string }> = {
  'regional-pipeline': {
    sourceLines: 'sales-manager-reporting-service.ts::getRegionalPipeline',
    note: 'Region x stage rollup with conversion rates. Clone report_regional_performance swapping revenue aggs for stage-grouped counts.',
  },
  'regional-quota': {
    sourceLines: 'sales-manager-reporting-service.ts::getRegionalQuota',
    note: 'Region-level quota attainment + projected forecast. Needs regional quota target aggregate.',
  },
  'regional-activity': {
    sourceLines: 'sales-manager-reporting-service.ts::getRegionalActivity',
    note: 'Region x activity_type rollup. Small query — easy next port.',
  },
};

export async function handleSalesManager(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  const first = pathParts[1]; // pathParts[0] = 'sales-manager'

  if (!hasMinLevel(auth, 4)) {
    return errorResponse(403, 'Manager or higher required', req, {
      code: 'FORBIDDEN',
      details: { minLevel: 4 },
      requestId,
    });
  }

  // GET /sales-manager/regional-performance
  if (method === 'GET' && first === 'regional-performance') {
    const { dateFrom, dateTo } = parseDateRange(url);
    const { data, error } = await db.rpc('report_regional_performance', {
      p_tenant_id: auth.tenantId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch regional performance', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(data ?? {}, 200, req, requestId);
  }

  // POST /sales-manager/clear-cache — stateless no-op
  if (method === 'POST' && first === 'clear-cache') {
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

  // 501 stubs with source pointers.
  const pending = first ? PENDING_ENDPOINTS[first] : undefined;
  if (pending) {
    return jsonResponse(
      {
        status: 'not_implemented',
        endpoint: `/sales-manager/${first}`,
        source: pending.sourceLines,
        note: pending.note,
        trackedIn: 'tasks/followup-reports-migration.md',
      },
      501,
      req,
      requestId,
    );
  }

  return null;
}
