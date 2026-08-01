/**
 * AI analytics dashboard edge function (PROD-010) — port of the
 * /api/ai-analytics/dashboard handler in server/routes-sample-data.ts.
 *
 * WHY: the domain had an Express handler and NO edge function, so
 * pages/AIAnalyticsDashboard.tsx worked in dev and hard-404'd in production,
 * where getApiUrl() rewrites /api/ai-analytics -> functions.printyx.net/ai-analytics
 * with no Express fallback.
 *
 * ROUTES:
 *   GET /dashboard  -> the AiAnalyticsResponse the page types
 *
 * SHAPE: the page declares a full AiAnalyticsResponse interface and — since
 * CRMX-001 — has NO mock fallback, so a shape mismatch surfaces as visibly empty
 * sections rather than fabricated numbers. Every key below is reproduced exactly:
 * generatedAt, availability{8 flags}, overview{4 counts}, churn{available,
 * totalAnalyzed, highRisk, mediumRisk, lowRisk, customers[]} and
 * predictiveMaintenance{available, equipmentMonitored, predictedFailures,
 * accuracyRate, alerts[]}. Nested rows are hand-built in camelCase rather than
 * key-converted, because `signals` is a jsonb column whose inner keys are
 * snake_case (ticket_delta, suggested_parts) and must NOT be rewritten — only
 * specific fields are read out of it.
 *
 * The `availability` map is the honesty contract of this page: the six false
 * flags mark capabilities with no backing pipeline, and the UI renders an
 * explicit "Preview — not yet available" card for each. They stay hard-coded
 * false here exactly as in Express; flipping one on without a real data source
 * would put fabricated numbers back on the page, which is what CRMX-001 removed.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { computeDashboard } from './dashboard.ts';

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
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
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

    const url = new URL(req.url);
    // Idempotent: the dispatcher strips segment 0 before the handler runs.
    const { parts } = normalizePath(url.pathname, 'ai-analytics');

    if (req.method !== 'GET' || parts[0] !== 'dashboard') {
      return createCorsResponse({ error: 'Not found' }, 404, req);
    }

    const admin = createSupabaseServiceClient();
    return createCorsResponse(await computeDashboard(admin, tenantId), 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('ai-analytics function error:', message);
    return createCorsResponse(
      { message: 'Failed to fetch AI analytics dashboard', error: message },
      500,
      req,
    );
  }
}
