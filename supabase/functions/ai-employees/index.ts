// AI Employees Edge Function (EDGE-019).
//
// Prod parity for the endpoints client/src/pages/AIEmployeeDashboard.tsx calls
// against server/routes/ai-employee-routes.ts.
//
// WHY THIS EXISTS: the dashboard is routed at /ai-employees and calls
// /api/ai-employees + /api/ai-employees/analytics/overview. Only Express served
// them, and prod bypasses Express for functions.printyx.net — so BOTH of the
// page's queries 404'd in production. Found by npm run check:routes.
//
// URL layout (all under /ai-employees):
//   GET /                     — list employees (?employeeType=&status=&autonomyLevel=)
//   GET /analytics/overview   — dashboard aggregates
//   GET /:employeeId          — one employee
//
// SCOPE — READ ENDPOINTS ONLY, deliberately. The Express router also has
// POST / (create), POST /tasks, POST /workflows/execute and friends, but those
// call ClaudeAIService to actually run an agent; that is a Node-side concern and
// the dashboard calls none of them (AUDIT-015 removed its two fake write
// controls). Porting the read path is what unbreaks the page; porting agent
// execution is a separate piece of work, not a routing fix.
//
// ROUTING GOTCHA: `analytics` is a LITERAL first segment, but the same position
// holds an :employeeId on the other route. The literal branch MUST be matched
// first or /analytics/overview is read as employeeId='analytics'.
//
// Dir name == URL segment, so prod routing needs no server.ts override.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

// Shape the dashboard reads. Mirrors AiEmployeeAnalytics in
// server/services/ai-employee-service.ts.
const EMPTY_ANALYTICS = {
  totalEmployees: 0,
  activeEmployees: 0,
  totalTasksToday: 0,
  completedTasksToday: 0,
  averageQualityScore: 0,
  averageResponseTime: 0,
  // null when unknown — there is no source for a savings figure. Never invented.
  costSavings: null,
  customerSatisfaction: 0,
  employeeTypes: [],
  recentTasks: [],
  performanceTrends: { tasksCompleted: [], qualityScores: [], responseTime: [] },
};

// True when the error means the RPC itself is absent, i.e. nobody has applied
// drizzle/functions/ai-employee-analytics.sql to this database yet. Same
// tolerate-a-missing-object convention as billing/handlers/_context.ts and the
// fallback documented in drizzle/functions/README.md, so the function can deploy
// before the SQL is applied without taking the page down.
function isMissingFunction(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42883' || error.code === 'PGRST202') return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('could not find the function') || msg.includes('does not exist');
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse(
        { success: false, message: userError?.message || 'Unauthorized' },
        401,
        req,
      );
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ success: false, message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'ai-employees');
    const method = req.method;

    // ─── GET /analytics/overview (literal — must precede /:employeeId) ─
    if (method === 'GET' && parts[0] === 'analytics') {
      if (parts[1] !== 'overview') {
        return createCorsResponse({ success: false, message: 'Not found' }, 404, req);
      }

      const { data, error } = await admin.rpc('ai_employee_analytics_overview', {
        p_tenant_id: tenantId,
      });

      if (error) {
        if (isMissingFunction(error)) {
          // The aggregation is five raw-SQL queries (COUNT FILTER, GROUP BY, a
          // LEFT JOIN, a generate_series series) that PostgREST cannot express,
          // so there is no meaningful in-JS fallback to compute here. Return the
          // empty shape — the dashboard renders zeroes — rather than 500ing the
          // page. Apply drizzle/functions/ai-employee-analytics.sql to fix.
          return createCorsResponse({ success: true, data: EMPTY_ANALYTICS }, 200, req);
        }
        return createCorsResponse({ success: false, message: error.message }, 500, req);
      }

      return createCorsResponse({ success: true, data: data ?? EMPTY_ANALYTICS }, 200, req);
    }

    // ─── GET / (list) ────────────────────────────────────────────────
    if (method === 'GET' && !parts[0]) {
      let query = admin.from('ai_employees').select('*').eq('tenant_id', tenantId);

      const employeeType = url.searchParams.get('employeeType');
      const status = url.searchParams.get('status');
      const autonomyLevel = url.searchParams.get('autonomyLevel');
      if (employeeType) query = query.eq('employee_type', employeeType);
      if (status) query = query.eq('status', status);
      if (autonomyLevel) query = query.eq('autonomy_level', autonomyLevel);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) return createCorsResponse({ success: false, message: error.message }, 500, req);

      // Raw snake_case rows, matching the Express handler, which returns
      // `SELECT * FROM ai_employees` untouched. The dashboard normalises these
      // itself via toAiEmployee() (it accepts either casing), so converting here
      // would be a gratuitous divergence from the endpoint being mirrored.
      const rows = data ?? [];
      return createCorsResponse({ success: true, data: rows, count: rows.length }, 200, req);
    }

    // ─── GET /:employeeId ────────────────────────────────────────────
    if (method === 'GET' && parts[0] && !parts[1]) {
      const { data, error } = await admin
        .from('ai_employees')
        .select('*')
        .eq('id', parts[0])
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) return createCorsResponse({ success: false, message: error.message }, 500, req);
      if (!data) {
        return createCorsResponse({ success: false, message: 'AI employee not found' }, 404, req);
      }
      return createCorsResponse({ success: true, data }, 200, req);
    }

    return createCorsResponse({ success: false, message: 'Not found' }, 404, req);
  } catch (error) {
    return createCorsResponse(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal error',
      },
      500,
      req,
    );
  }
}
