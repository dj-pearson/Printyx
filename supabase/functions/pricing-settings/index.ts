// Pricing Settings Edge Function
// Handles pricing settings and visibility configuration
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // server.ts strips the function name before invoking this handler, so the
    // resource segment is pathParts[0] (e.g. /pricing-settings/visibility arrives
    // here as /visibility). Reading pathParts[1] left resource undefined → 404.
    const resource = pathParts[0]; // settings or visibility

    // GET /pricing/settings - Get pricing settings
    if (req.method === 'GET' && resource === 'settings') {
      const { data: settings, error } = await admin
        .from('pricing_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return createCorsResponse({ error: 'Failed to fetch pricing settings' }, 500, req);
      }

      // Return default settings if none exist
      return createCorsResponse(
        settings || {
          default_margin: 30,
          show_cost_to_sales: false,
          allow_manual_pricing: true,
          require_approval_below_margin: 15,
          currency: 'USD',
        },
        200,
        req,
      );
    }

    // PUT /pricing/settings - Update pricing settings
    if (req.method === 'PUT' && resource === 'settings') {
      const body = await req.json();

      const { data: settings, error } = await admin
        .from('pricing_settings')
        .upsert(
          {
            tenant_id: tenantId,
            default_margin: body.defaultMargin || body.default_margin,
            show_cost_to_sales: body.showCostToSales ?? body.show_cost_to_sales,
            allow_manual_pricing: body.allowManualPricing ?? body.allow_manual_pricing,
            require_approval_below_margin:
              body.requireApprovalBelowMargin || body.require_approval_below_margin,
            currency: body.currency,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'tenant_id',
          },
        )
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update pricing settings' }, 500, req);
      }

      return createCorsResponse(settings, 200, req);
    }

    // GET /pricing/visibility - Get price visibility settings
    if (req.method === 'GET' && resource === 'visibility') {
      const { data: settings, error } = await admin
        .from('pricing_visibility')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      // Visibility is non-critical: if the row is missing OR the query errors
      // (e.g. the table isn't provisioned for this tenant), fall back to safe
      // defaults rather than 500-ing and breaking every page that reads it.
      if (error && error.code !== 'PGRST116') {
        console.warn('pricing-settings: visibility lookup failed, using defaults:', error.message);
      }

      return createCorsResponse(
        settings || {
          show_msrp: true,
          show_dealer_cost: false,
          show_margin: false,
          show_competitor_pricing: false,
        },
        200,
        req,
      );
    }

    // PUT /pricing/visibility - Update visibility settings
    if (req.method === 'PUT' && resource === 'visibility') {
      const body = await req.json();

      const { data: settings, error } = await admin
        .from('pricing_visibility')
        .upsert(
          {
            tenant_id: tenantId,
            show_msrp: body.showMsrp ?? body.show_msrp,
            show_dealer_cost: body.showDealerCost ?? body.show_dealer_cost,
            show_margin: body.showMargin ?? body.show_margin,
            show_competitor_pricing: body.showCompetitorPricing ?? body.show_competitor_pricing,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'tenant_id',
          },
        )
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update visibility settings' }, 500, req);
      }

      return createCorsResponse(settings, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in pricing-settings function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
