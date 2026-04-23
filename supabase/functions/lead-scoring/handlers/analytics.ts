// Lead-scoring analytics (admin|manager only).
//
// Path: GET /lead-scoring/analytics
// Delegates the heavy lifting to the `lead_scoring_analytics` PL/pgSQL fn.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { isAdminOrManager } from '../_rbac.ts';

export async function handleAnalytics(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId } = ctx;
  if (method !== 'GET') return null;
  if (!isAdminOrManager(auth)) {
    return errorResponse(403, 'Admin or manager role required', req, {
      code: 'FORBIDDEN',
      requestId,
    });
  }

  const { data, error } = await db.rpc('lead_scoring_analytics', {
    p_tenant_id: auth.tenantId,
  });
  if (error) {
    return errorResponse(500, 'Failed to fetch analytics', req, {
      code: 'DB_ERROR',
      details: error,
      requestId,
    });
  }
  return jsonResponse(data ?? {}, 200, req, requestId);
}
