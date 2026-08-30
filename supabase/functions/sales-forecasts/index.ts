// Sales forecasts Edge Function (EDGE-022).
//
// Prod parity for the /api/sales-forecasts reads in
// server/routes-sales-forecasting.ts.
//
// WHY THIS EXISTS: SalesCommandCenter.tsx and SalesPipelineForecasting.tsx both
// list forecasts from /api/sales-forecasts, which only Express served — there
// was no edge function, so it 404'd in PRODUCTION where the frontend targets
// functions.printyx.net. Found by npm run check:routes.
//
// URL layout (all under /sales-forecasts):
//   GET /                 — list forecasts for the tenant, newest first
//   GET /:id/pipeline     — pipeline items belonging to one forecast
//
// SCOPE: reads only, and NOTHING WRITES sales_forecasts ANYWHERE (PA-022).
// The Express POST this note used to defer to is deleted: it had no caller in
// any client tree, and it could not run in production regardless, since
// production does not reach Express. So the table has never had a producer that
// a deployed user could trigger, and both pages that read it list an empty set
// until someone builds a create path - which starts with a UI, not an endpoint.
// Recorded in docs/unwritten-tables-baseline.json for that reason rather than
// left to look like a table nobody happens to use.
//
// Rows come back camelCase: the Express handler returns Drizzle rows, which are
// already camelCase, and the pages read forecastName/revenueTarget/startDate
// directly. Raw PostgREST snake_case would render blank.
//
// Dir name == URL segment, so prod routing needs no server.ts override.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamelShallow } from '../_shared/case.ts';

// deno-lint-ignore no-explicit-any
const camel = (row: any) => (row ? toCamelShallow(row) : row);

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
      return createCorsResponse({ message: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'sales-forecasts');
    const method = req.method;

    // ─── GET /:id/pipeline ───────────────────────────────────────────
    if (method === 'GET' && parts[0] && parts[1] === 'pipeline') {
      const { data, error } = await admin
        .from('forecast_pipeline_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('forecast_id', parts[0])
        .order('expected_close_date', { ascending: true });

      if (error) return createCorsResponse({ message: error.message }, 500, req);
      return createCorsResponse((data ?? []).map(camel), 200, req);
    }

    // ─── GET / (list) ────────────────────────────────────────────────
    if (method === 'GET' && !parts[0]) {
      const { data, error } = await admin
        .from('sales_forecasts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) return createCorsResponse({ message: error.message }, 500, req);
      return createCorsResponse((data ?? []).map(camel), 200, req);
    }

    return createCorsResponse({ message: 'Not found' }, 404, req);
  } catch (error) {
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal error' },
      500,
      req,
    );
  }
}
