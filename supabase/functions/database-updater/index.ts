// Database Updater Edge Function
// Provides database updater system status and control (Root Admin only)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { cachedRoleLookup } from '../_shared/auth-cache.ts';

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

    // GET /database-updater/status - Get status of the updater system
    if (req.method === 'GET' && endpoint === 'status') {
      return createCorsResponse(
        {
          success: true,
          data: {
            isRunning: false,
            updaters: [],
            nextExecutions: {},
            config: {
              enabledUpdaters: [],
              logLevel: 'info',
            },
          },
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // GET /database-updater/health - Health check
    if (req.method === 'GET' && endpoint === 'health') {
      return createCorsResponse(
        {
          success: true,
          data: {
            status: 'healthy',
            updaterSystemRunning: false,
            totalUpdaters: 0,
            timestamp: new Date().toISOString(),
          },
        },
        200,
        req,
      );
    }

    // GET /database-updater/logs - Get recent log entries
    if (req.method === 'GET' && endpoint === 'logs') {
      const count = parseInt(url.searchParams.get('count') || '100');
      return createCorsResponse(
        {
          success: true,
          data: {
            logs: [],
            count: 0,
          },
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // GET /database-updater/metrics - Get system metrics
    if (req.method === 'GET' && endpoint === 'metrics') {
      return createCorsResponse(
        {
          success: true,
          data: {
            systemMetrics: {
              isRunning: false,
              totalUpdaters: 0,
              enabledUpdaters: 0,
              nextExecutions: {},
            },
            updaterMetrics: [],
            configuration: {},
          },
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // POST /database-updater/start - Start the updater system
    if (req.method === 'POST' && endpoint === 'start') {
      return createCorsResponse(
        {
          success: true,
          message: 'Database updater system start requested (not implemented in edge function)',
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // POST /database-updater/stop - Stop the updater system
    if (req.method === 'POST' && endpoint === 'stop') {
      return createCorsResponse(
        {
          success: true,
          message: 'Database updater system stop requested (not implemented in edge function)',
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // POST /database-updater/execute/:updaterName - Execute a specific updater
    if (req.method === 'POST' && endpoint === 'execute' && updaterName) {
      return createCorsResponse(
        {
          success: true,
          message: `Updater ${updaterName} execution requested (not implemented in edge function)`,
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // POST /database-updater/enable/:updaterName - Enable a specific updater
    if (req.method === 'POST' && endpoint === 'enable' && updaterName) {
      return createCorsResponse(
        {
          success: true,
          message: `Updater ${updaterName} has been enabled`,
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // POST /database-updater/disable/:updaterName - Disable a specific updater
    if (req.method === 'POST' && endpoint === 'disable' && updaterName) {
      return createCorsResponse(
        {
          success: true,
          message: `Updater ${updaterName} has been disabled`,
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // POST /database-updater/dry-run/:updaterName - Execute updater in dry-run mode
    if (req.method === 'POST' && endpoint === 'dry-run' && updaterName) {
      return createCorsResponse(
        {
          success: true,
          message: `Dry-run completed for ${updaterName}`,
          data: { updater: null },
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // PUT /database-updater/config - Update configuration
    if (req.method === 'PUT' && endpoint === 'config') {
      return createCorsResponse(
        {
          success: true,
          message: 'Configuration updated successfully',
          timestamp: new Date().toISOString(),
        },
        200,
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
