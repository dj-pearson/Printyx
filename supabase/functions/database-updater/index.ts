// Database Updater Edge Function
// Provides database updater system status and control (Root Admin only)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { cachedRoleLookup } from '../_shared/auth-cache.ts';

export const UPDATER_UNAVAILABLE_CODE = 'UPDATER_NOT_ON_EDGE';
export const UPDATER_UNAVAILABLE_REASON =
  'The database updater is an in-process Node scheduler and does not run on this host. ' +
  'Nothing here can start, stop, enable or execute it.';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Check for root admin access (role level 7+)
    const admin = createSupabaseServiceClient();
    // AUDIT-005: this users->roles gate ran on EVERY request to this fn, a second
    // serialized hop after auth.getUser. Cached by user id for ROLE_CACHE_TTL_MS
    // (default 30s) — a role change takes effect within that window.
    const { data: userWithRole } = await cachedRoleLookup(user.id, () =>
      admin
        .from('users')
        .select('role_id, roles!inner(level, can_access_all_tenants)')
        .eq('id', user.id)
        .single(),
    );

    const roleLevel = (userWithRole?.roles as any)?.level || 0;
    const canAccessAllTenants = (userWithRole?.roles as any)?.can_access_all_tenants || false;

    if (roleLevel < 7 && !canAccessAllTenants) {
      return createCorsResponse({ error: 'Root admin access required' }, 403, req);
    }

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /database-updater, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'database-updater');
    const endpoint = parts[0]; // /database-updater/status, /database-updater/start, etc.
    const updaterName = parts[1]; // /database-updater/execute/:updaterName

    // Round 166: every branch below used to answer 200 with `success: true` -
    // "start requested", "Updater X has been enabled", "Dry-run completed",
    // "Configuration updated successfully" - while doing nothing, and status
    // reported `isRunning: false`, which the two admin pages render as a
    // system that is merely STOPPED and can be started. It cannot be started
    // here: the updater is DatabaseUpdaterManager, an in-process Node scheduler
    // (server/database-updater/) with its registry, cron timers and config
    // held in memory. A Deno isolate has no process that outlives the request,
    // so there is nothing to start, stop, enable or run. Dev serves this
    // prefix from Express (not proxied), where the manager is real.
    //
    // So status answers `available: false` with the reason, and every control
    // answers 501 with the same code, rather than a success nobody can check.
    if (req.method === 'GET' && endpoint === 'status') {
      return createCorsResponse(
        {
          success: true,
          available: false,
          code: UPDATER_UNAVAILABLE_CODE,
          reason: UPDATER_UNAVAILABLE_REASON,
          data: null,
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    const CONTROLS: Record<string, string[]> = {
      GET: ['health', 'logs', 'metrics'],
      POST: ['start', 'stop', 'execute', 'enable', 'disable', 'dry-run'],
      PUT: ['config'],
    };
    if (CONTROLS[req.method]?.includes(endpoint)) {
      return createCorsResponse(
        {
          message: UPDATER_UNAVAILABLE_REASON,
          code: UPDATER_UNAVAILABLE_CODE,
          notImplemented: true,
          ...(updaterName ? { details: { updaterName } } : {}),
        },
        501,
        req,
      );
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in database-updater function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
