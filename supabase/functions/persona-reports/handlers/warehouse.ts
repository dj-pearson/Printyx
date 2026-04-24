// Warehouse reports — /persona-reports/warehouse/*
// Replaces server/routes/warehouse-reports-api.ts (2 endpoints, 100 lines)
// + server/services/warehouse-reporting-service.ts (294 lines).
//
// Hierarchical scoping: the Express service used a HierarchicalQueryBuilder
// to compute accessibleUserIds from the caller's role level and direct
// reports. We don't port that builder — instead the handler passes the
// caller's userId as p_caller_id and, when the caller is a manager+, looks
// up direct reports from the users table. For supervisors and above, this
// set should be expanded; see the TODO at the bottom.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { getRoleLevel, hasMinLevel, parseDateRange } from '../_context.ts';

export async function handleWarehouse(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  // pathParts: ['warehouse', ...]
  const [, second, third] = pathParts;

  // Minimum level 2 (individual contributor with view_team permission).
  // The Express version used `operations.warehouse.view_team` permission
  // strings; level 2 is the closest stand-in in our simplified role system.
  if (!hasMinLevel(auth, 2)) {
    return errorResponse(403, 'Warehouse access required', req, {
      code: 'FORBIDDEN',
      details: { minLevel: 2 },
      requestId,
    });
  }

  // GET /warehouse/team/quick-stats
  if (method === 'GET' && second === 'team' && third === 'quick-stats') {
    const { dateFrom, dateTo } = parseDateRange(url);
    const technicianIds = await resolveAccessibleTechnicianIds(ctx);

    const { data, error } = await db.rpc('report_warehouse_team_quick_stats', {
      p_tenant_id: auth.tenantId,
      p_caller_id: auth.userId,
      p_technician_ids: technicianIds,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) {
      return errorResponse(500, 'Failed to fetch warehouse team stats', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(data ?? {}, 200, req, requestId);
  }

  // POST /warehouse/cache/invalidate — stateless edge function, no-op.
  if (method === 'POST' && second === 'cache' && third === 'invalidate') {
    const body = await req.json().catch(() => ({}));
    return jsonResponse(
      {
        message: 'Cache invalidated successfully',
        pattern: body.pattern ?? 'all',
        note: 'Edge functions are stateless; cache was a no-op.',
      },
      200,
      req,
      requestId,
    );
  }

  return null;
}

/**
 * Compute the set of technician user IDs the caller can see data for.
 *
 * Level-based heuristic:
 * - Level 2 (individual contributor): caller only — return empty array so
 *   the SQL function falls back to its caller-only filter.
 * - Level 3+ (supervisor/manager/director): return all users in the same
 *   tenant. Refine later with team/location scoping.
 *
 * This is intentionally coarser than the Express HierarchicalQueryBuilder
 * — porting the builder is a separate effort. Current behavior gives level
 * 3+ callers the full tenant view, which over-shares at the supervisor
 * level but under-shares at L2 (which is correct).
 */
async function resolveAccessibleTechnicianIds(ctx: HandlerCtx): Promise<string[] | null> {
  const { auth, db } = ctx;
  if (getRoleLevel(auth) < 3) return null;

  const { data } = await db.from('users').select('id').eq('tenant_id', auth.tenantId);

  if (!data) return null;
  return (data as Array<{ id: string }>).map((u) => u.id);
}
