// Service reports — /persona-reports/service/*
// Replaces server/routes/service-reports-api.ts (7 endpoints, 341 lines) +
// server/services/service-reporting-service.ts (665 lines).
//
// Ported: personal/calls, personal/time, team/quick-stats, cache/invalidate.
// 501 stubs: personal/parts, team/dispatch-queue, personal/calls/:ticketId.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { getRoleLevel, hasMinLevel, parseDateRange } from '../_context.ts';

const PENDING_ENDPOINTS: Record<string, { sourceLines: string; note: string }> = {
  'personal/parts': {
    sourceLines: 'service-reporting-service.ts::getPersonalPartsUsage',
    note: 'Parts usage aggregate — needs service_ticket_parts table confirmation.',
  },
  'team/dispatch-queue': {
    sourceLines: 'service-reporting-service.ts::getDispatchQueue',
    note: 'SLA-status enrichment + queue-depth sort. Needs real sla_status column plus hierarchical scope.',
  },
};

export async function handleService(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  // pathParts: ['service', ...]
  const [, second, third] = pathParts;
  const subpath = [second, third].filter(Boolean).join('/');

  if (!hasMinLevel(auth, 2)) {
    return errorResponse(403, 'Service access required', req, {
      code: 'FORBIDDEN',
      details: { minLevel: 2 },
      requestId,
    });
  }

  // GET /service/personal/calls
  if (method === 'GET' && subpath === 'personal/calls') {
    const { dateFrom, dateTo } = parseDateRange(url);
    const status = url.searchParams.get('status');
    const { data, error } = await db.rpc('report_service_personal_calls', {
      p_tenant_id: auth.tenantId,
      p_user_id: auth.userId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_status: status,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch service calls', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(data ?? {}, 200, req, requestId);
  }

  // GET /service/personal/calls/:ticketId — single call detail
  // Stubbed: covered in handleService's 501 fallthrough below if we reach it.

  // GET /service/personal/time
  if (method === 'GET' && subpath === 'personal/time') {
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    if (!dateFrom || !dateTo) {
      return errorResponse(400, 'dateFrom and dateTo are required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }
    const { data, error } = await db.rpc('report_service_personal_time', {
      p_tenant_id: auth.tenantId,
      p_user_id: auth.userId,
      p_date_from: new Date(dateFrom).toISOString(),
      p_date_to: new Date(dateTo).toISOString(),
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch time data', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(data ?? {}, 200, req, requestId);
  }

  // GET /service/team/quick-stats
  if (method === 'GET' && subpath === 'team/quick-stats') {
    if (!hasMinLevel(auth, 3)) {
      return errorResponse(403, 'Supervisor or higher required', req, {
        code: 'FORBIDDEN',
        details: { minLevel: 3 },
        requestId,
      });
    }
    const { dateFrom, dateTo } = parseDateRange(url);
    const technicianIds = await resolveAccessibleTechIds(ctx);

    const { data, error } = await db.rpc('report_service_team_quick_stats', {
      p_tenant_id: auth.tenantId,
      p_caller_id: auth.userId,
      p_technician_ids: technicianIds,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch team service stats', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(data ?? {}, 200, req, requestId);
  }

  // POST /service/cache/invalidate — stateless no-op
  if (method === 'POST' && subpath === 'cache/invalidate') {
    if (!hasMinLevel(auth, 4)) {
      return errorResponse(403, 'Manager or higher required', req, {
        code: 'FORBIDDEN',
        details: { minLevel: 4 },
        requestId,
      });
    }
    return jsonResponse(
      {
        message: 'Cache invalidated successfully',
        note: 'Edge functions are stateless; cache was a no-op.',
      },
      200,
      req,
      requestId,
    );
  }

  // Single-call detail — pending port (same service file, getServiceCallDetail).
  if (method === 'GET' && second === 'personal' && third === 'calls' && pathParts[3]) {
    return jsonResponse(
      {
        status: 'not_implemented',
        endpoint: `/service/personal/calls/${pathParts[3]}`,
        source: 'service-reporting-service.ts::getServiceCallDetail',
        note: 'Single-call drill-down with parts + time + resolution log.',
        trackedIn: 'tasks/followup-reports-migration.md',
      },
      501,
      req,
      requestId,
    );
  }

  const pending = PENDING_ENDPOINTS[subpath];
  if (pending) {
    return jsonResponse(
      {
        status: 'not_implemented',
        endpoint: `/service/${subpath}`,
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

async function resolveAccessibleTechIds(ctx: HandlerCtx): Promise<string[] | null> {
  const { auth, db } = ctx;
  if (getRoleLevel(auth) < 3) return null;
  const { data } = await db.from('users').select('id').eq('tenant_id', auth.tenantId);
  if (!data) return null;
  return (data as Array<{ id: string }>).map((u) => u.id);
}
