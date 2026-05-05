// Security Dashboard Edge Function
// Replaces server/routes-security-dashboard.ts. Platform-admin gated.
//
// URL layout (under /security):
//   GET /security/overview          — aggregate stats (failed logins 24h, locked accounts,
//                                      audit events last hour, security event breakdown)
//   GET /security/events            — paginated audit events (filterable by action + since)
//   GET /security/failed-logins     — recent failed login attempts (with lock status)
//   GET /security/threats/active    — active threat scores (degraded — Express integrates
//                                      with threat-detection-service which doesn't exist
//                                      in the edge runtime)
//
// Tables:
//   audit_logs (shared/security-schema.ts) — uses 'timestamp' column (NOT 'created_at')
//                                            and 'category', 'severity', 'action', 'resource'
//   login_attempts (shared/auth-schema.ts) — email, attempt_count, last_attempt_at,
//                                            locked_until, last_ip_address
//
// Note: the Express implementation queried non-existent columns (createdAt,
// resourceType, details). Same pattern as the audit-log singular bug fixed in
// EDGE-006. This port uses the real schema.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

const SECURITY_AUDIT_ACTIONS = [
  'login_failure',
  'account_locked',
  'account_unlocked',
  'permission_denied',
  'admin_bypass',
  'password_change',
  'mfa_enable',
  'mfa_disable',
];

type Admin = ReturnType<typeof createSupabaseServiceClient>;

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Platform-admin gating (matches Express middleware at routes-security-dashboard.ts:204).
    const roleLevel =
      (user.app_metadata?.roleLevel as number | undefined) ??
      (user.user_metadata?.roleLevel as number | undefined) ??
      0;
    const isPlatformUser =
      user.app_metadata?.isPlatformUser === true || user.user_metadata?.isPlatformUser === true;
    const hasAllPermissions =
      user.app_metadata?.hasAllPermissions === true ||
      user.user_metadata?.hasAllPermissions === true;

    if (!isPlatformUser && roleLevel < 8 && !hasAllPermissions) {
      return createCorsResponse({ error: 'Platform admin access required' }, 403, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'security');
    const endpoint = parts[0];
    const sub = parts[1];

    if (req.method === 'GET' && endpoint === 'overview') return await getOverview(admin, req);
    if (req.method === 'GET' && endpoint === 'events') return await getEvents(admin, url, req);
    if (req.method === 'GET' && endpoint === 'failed-logins') {
      return await getFailedLogins(admin, url, req);
    }
    if (req.method === 'GET' && endpoint === 'threats' && sub === 'active') {
      return await getActiveThreats(req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in security function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ─── handlers ───────────────────────────────────────────────────────────────

async function getOverview(admin: Admin, req: Request): Promise<Response> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  // Failed login attempts in last 24 hours
  const { count: failedLogins24h } = await admin
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .gte('last_attempt_at', last24h);

  // Currently locked accounts (locked_until in the future, OR sentinel '1970-01-01' for permanent)
  // Postgres comparison: lockedUntil > NOW() catches future timestamps including the sentinel
  // (since 1970-01-01 < NOW always evaluates false; permanent-lock pattern uses a row marker
  // we can't easily express in PostgREST without raw SQL). We use the simpler "future" semantic
  // here and document the divergence.
  const { count: lockedAccounts } = await admin
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .gte('locked_until', now.toISOString());

  // Audit events in last hour
  const { count: auditEventsLastHour } = await admin
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', lastHour);

  // Security event breakdown (last 24h, security-related actions only).
  // Aggregate in JS — bounded list because we filter by action.
  const { data: securityEventRows } = await admin
    .from('audit_logs')
    .select('action')
    .gte('timestamp', last24h)
    .in('action', SECURITY_AUDIT_ACTIONS);

  const breakdownMap = new Map<string, number>();
  for (const r of (securityEventRows ?? []) as Array<{ action: string }>) {
    breakdownMap.set(r.action, (breakdownMap.get(r.action) ?? 0) + 1);
  }
  const securityEventBreakdown = Array.from(breakdownMap.entries()).map(([action, count]) => ({
    action,
    count,
  }));

  return createCorsResponse(
    {
      overview: {
        failedLogins24h: failedLogins24h ?? 0,
        lockedAccounts: lockedAccounts ?? 0,
        auditEventsLastHour: auditEventsLastHour ?? 0,
        securityEventBreakdown,
      },
      generatedAt: now.toISOString(),
      degraded: {
        permanentLockSentinel: true,
        reason:
          "Permanent-lock pattern (locked_until = '1970-01-01') is not counted under PostgREST's gte filter. Migrate to a boolean is_permanently_locked column or use a stored function to detect both temporal + sentinel locks.",
      },
    },
    200,
    req,
  );
}

async function getEvents(admin: Admin, url: URL, req: Request): Promise<Response> {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));
  const offset = (page - 1) * limit;
  const action = url.searchParams.get('action');
  const since = url.searchParams.get('since');

  let q = admin
    .from('audit_logs')
    .select(
      'id, action, resource, resource_id, user_id, tenant_id, severity, category, additional_context, ip_address, timestamp',
      { count: 'exact' },
    )
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (action) q = q.eq('action', action);
  if (since) q = q.gte('timestamp', since);

  const { data, count, error } = await q;
  if (error) {
    return createCorsResponse({ error: 'Failed to fetch security events' }, 500, req);
  }

  return createCorsResponse(
    {
      data: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: count ? Math.ceil(count / limit) : 1,
      },
    },
    200,
    req,
  );
}

async function getFailedLogins(admin: Admin, url: URL, req: Request): Promise<Response> {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));

  const { data, error } = await admin
    .from('login_attempts')
    .select('id, email, attempt_count, last_attempt_at, locked_until, last_ip_address')
    .gt('attempt_count', 0)
    .order('last_attempt_at', { ascending: false })
    .limit(limit);

  if (error) {
    return createCorsResponse({ error: 'Failed to fetch failed login data' }, 500, req);
  }

  const now = new Date();
  const enriched = (data ?? []).map((a: any) => {
    const lockedUntil = a.locked_until ? new Date(a.locked_until) : null;
    const isPermanent = lockedUntil ? lockedUntil.getTime() === 0 : false;
    const isFutureLock = lockedUntil ? lockedUntil > now : false;
    return {
      ...a,
      isLocked: isPermanent || isFutureLock,
      lockType: !lockedUntil
        ? 'none'
        : isPermanent
          ? 'permanent'
          : isFutureLock
            ? 'temporary'
            : 'expired',
    };
  });

  return createCorsResponse({ data: enriched, count: enriched.length }, 200, req);
}

function getActiveThreats(req: Request): Response {
  // Express integrated with server/services/threat-detection-service. That
  // service is in-process Express memory and not portable to edge runtime.
  // Returns empty list with a degraded marker. A future port should move
  // threat detection to a Postgres-backed table or a separate edge function
  // that the threat detector writes to.
  return createCorsResponse(
    {
      data: [],
      count: 0,
      degraded: {
        threatDetectionService: true,
        reason:
          'Threat detection service is in-process Express memory (server/services/threat-detection-service). Port to a persisted threat_signals table + scoring function to make it edge-accessible.',
      },
    },
    200,
    req,
  );
}
