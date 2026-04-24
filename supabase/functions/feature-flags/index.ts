/**
 * Feature Flags edge function.
 *
 * Replaces:
 *   server/routes-feature-flags.ts  (5 endpoints, 148 lines)
 *   server/services/feature-flags-service.ts (evaluation logic inlined)
 *
 * URL layout (under /feature-flags):
 *   GET    /                — all flags resolved for current tenant/user
 *   GET    /raw             — raw flag rows, platform admin only
 *   GET    /:name           — single flag
 *   POST   /                — create flag, platform admin only
 *   PUT    /:name           — update flag, platform admin only
 *
 * Table: `feature_flags` is CROSS-TENANT (no tenant_id column). Per-tenant
 * behavior comes from the `tenant_overrides` jsonb column which maps
 * tenantId → boolean. Resolution order: tenantOverride → rolloutPercentage
 * bucket → default `enabled`.
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('feature-flags');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/feature-flags(?=\/|$)/, '')
      .replace(/\/$/, '') || '/'
  );
}

function isPlatformAdmin(auth: Awaited<ReturnType<typeof requireAuth>>): boolean {
  return (
    auth.supabaseUser.app_metadata?.isPlatformAdmin === true ||
    auth.supabaseUser.app_metadata?.role === 'platform_admin'
  );
}

interface FlagRow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rollout_percentage: number;
  tenant_overrides: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hash a string to a uniform 0-99 bucket for rollout percentage evaluation.
 * Same algorithm the Express service used (djb2-like).
 */
function bucketForKey(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100;
}

function resolveFlag(flag: FlagRow, tenantId: string, userId: string): boolean {
  const overrides = flag.tenant_overrides ?? {};
  if (tenantId in overrides) return Boolean(overrides[tenantId]);
  if (!flag.enabled) return false;
  const rollout = Number(flag.rollout_percentage ?? 100);
  if (rollout >= 100) return true;
  if (rollout <= 0) return false;
  return bucketForKey(`${flag.name}:${userId}`) < rollout;
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
    const parts = rest.split('/').filter(Boolean);
    const first = parts[0];

    // GET /raw — platform admin only
    if (method === 'GET' && first === 'raw') {
      if (!isPlatformAdmin(auth)) {
        return errorResponse(403, 'Platform admin access required', req, {
          code: 'FORBIDDEN',
          requestId,
        });
      }
      const { data, error } = await db.from('feature_flags').select('*').order('name');
      if (error) {
        return errorResponse(500, 'Failed to list feature flags', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(data ?? [], 200, req, requestId);
    }

    // GET / — resolved flags for current tenant/user
    if (method === 'GET' && !first) {
      const { data, error } = await db.from('feature_flags').select('*').order('name');
      if (error) {
        return errorResponse(500, 'Failed to retrieve feature flags', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      const resolved = (data ?? []).map((f) => {
        const flag = f as FlagRow;
        return {
          name: flag.name,
          description: flag.description,
          enabled: resolveFlag(flag, auth.tenantId, auth.userId),
          rolloutPercentage: flag.rollout_percentage,
        };
      });
      return jsonResponse(resolved, 200, req, requestId);
    }

    // POST / — create, platform admin only
    if (method === 'POST' && !first) {
      if (!isPlatformAdmin(auth)) {
        return errorResponse(403, 'Platform admin access required', req, {
          code: 'FORBIDDEN',
          requestId,
        });
      }
      let body: {
        name?: string;
        description?: string;
        enabled?: boolean;
        rolloutPercentage?: number;
        tenantOverrides?: Record<string, boolean>;
      } = {};
      try {
        body = await req.json();
      } catch {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }
      if (!body.name || typeof body.name !== 'string') {
        return errorResponse(400, 'Flag name is required', req, {
          code: 'VALIDATION',
          requestId,
        });
      }

      const { data: existing } = await db
        .from('feature_flags')
        .select('id')
        .eq('name', body.name)
        .maybeSingle();

      if (existing) {
        return jsonResponse(
          { message: `Feature flag "${body.name}" already exists` },
          409,
          req,
          requestId,
        );
      }

      const { data, error } = await db
        .from('feature_flags')
        .insert({
          name: body.name,
          description: body.description ?? '',
          enabled: body.enabled ?? false,
          rollout_percentage: body.rolloutPercentage ?? 100,
          tenant_overrides: body.tenantOverrides ?? {},
        })
        .select('*')
        .single();

      if (error) {
        return errorResponse(500, 'Failed to create feature flag', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(data, 201, req, requestId);
    }

    // GET /:name — single flag (any authenticated user can read)
    if (method === 'GET' && first) {
      const { data, error } = await db
        .from('feature_flags')
        .select('*')
        .eq('name', first)
        .maybeSingle();
      if (error) {
        return errorResponse(500, 'Failed to retrieve feature flag', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      if (!data) {
        return jsonResponse({ message: 'Feature flag not found' }, 404, req, requestId);
      }
      return jsonResponse(data, 200, req, requestId);
    }

    // PUT /:name — update, platform admin only
    if (method === 'PUT' && first) {
      if (!isPlatformAdmin(auth)) {
        return errorResponse(403, 'Platform admin access required', req, {
          code: 'FORBIDDEN',
          requestId,
        });
      }
      let body: {
        enabled?: boolean;
        description?: string;
        rolloutPercentage?: number;
        tenantOverrides?: Record<string, boolean>;
      } = {};
      try {
        body = await req.json();
      } catch {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.enabled !== undefined) updates.enabled = body.enabled;
      if (body.description !== undefined) updates.description = body.description;
      if (body.rolloutPercentage !== undefined) updates.rollout_percentage = body.rolloutPercentage;
      if (body.tenantOverrides !== undefined) updates.tenant_overrides = body.tenantOverrides;

      const { data, error } = await db
        .from('feature_flags')
        .update(updates)
        .eq('name', first)
        .select('*')
        .maybeSingle();

      if (error) {
        return errorResponse(500, 'Failed to update feature flag', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      if (!data) {
        return jsonResponse({ message: 'Feature flag not found' }, 404, req, requestId);
      }
      return jsonResponse(data, 200, req, requestId);
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path: url.pathname, method },
      requestId,
    });
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
