/**
 * Audit Logs edge function.
 *
 * Replaces: server/routes-audit-logs.ts (1 endpoint, 49 lines).
 *
 * GET /audit-logs — paginated query against `audit_logs`. Platform-admin only
 * (same gate the Express version enforced). Supports filters:
 *   ?page&limit&startDate&endDate&action&userId&category
 *
 * Tenant scoping: the caller's tenant. A future platform-admin UI could allow
 * cross-tenant queries via ?tenantId=, but the Express version didn't support
 * that — keep it tight here.
 *
 * One-time SQL:
 *   \i drizzle/rls/admin.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('audit-logs');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/audit-logs(?=\/|$)/, '')
      .replace(/\/$/, '') || '/'
  );
}

function isPlatformAdmin(auth: Awaited<ReturnType<typeof requireAuth>>): boolean {
  return (
    auth.supabaseUser.app_metadata?.isPlatformAdmin === true ||
    auth.supabaseUser.app_metadata?.role === 'platform_admin'
  );
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(req);
    const db = getDb();

    const rest = stripPrefix(url.pathname);
    // Only one endpoint — anything else 404s.
    if (rest !== '/' || method !== 'GET') {
      return errorResponse(404, 'Not found', req, {
        code: 'NOT_FOUND',
        details: { path: url.pathname, method },
        requestId,
      });
    }

    if (!isPlatformAdmin(auth)) {
      return errorResponse(403, 'Forbidden: platform admin access required', req, {
        code: 'FORBIDDEN',
        requestId,
      });
    }

    const q = url.searchParams;
    const page = Math.max(1, Number(q.get('page') ?? '1'));
    const limit = Math.min(200, Math.max(1, Number(q.get('limit') ?? '50')));
    const startDate = q.get('startDate');
    const endDate = q.get('endDate');
    const action = q.get('action');
    const userId = q.get('userId');
    const category = q.get('category');

    // The column is `timestamp` per shared/security-schema.ts (not `created_at`).
    let query = db
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', auth.tenantId)
      .order('timestamp', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (startDate) query = query.gte('timestamp', startDate);
    if (endDate) query = query.lte('timestamp', endDate);
    if (action) query = query.eq('action', action);
    if (userId) query = query.eq('user_id', userId);
    if (category) query = query.eq('category', category);

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(500, 'Failed to retrieve audit logs', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(
      {
        logs: data ?? [],
        pagination: {
          page,
          limit,
          total: count ?? data?.length ?? 0,
          pages: count ? Math.max(1, Math.ceil(count / limit)) : 1,
        },
        filters: { startDate, endDate, action, userId, category },
      },
      200,
      req,
      requestId,
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err) }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}
