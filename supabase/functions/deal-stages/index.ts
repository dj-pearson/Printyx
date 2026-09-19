// Deal Stages Edge Function
//
// Returns the TENANT'S OWN pipeline stages (WF-S-03).
//
// It used to return six hardcoded stages with ids '1'..'6' and a TODO saying
// custom stages would come later. /api/deal-stages is NOT proxied, so dev was
// served by server/routes-workflow-mobile.ts reading real `deal_stages` rows
// while production answered the fixture - the both-divergent shape, and the
// damaging direction of it: the stage picker in LeadDeals showed six stage
// names that were not the tenant's, and creating a deal there posted '1'..'6'
// into deals.stage_id, which references deal_stages.id.
//
// What saved it from writing a dangling id is COP-M01's resolveStageId: an
// unrecognised value falls back to the front of the tenant's own pipeline. So
// the rep picked "Negotiation" and the deal landed in "Prospecting", silently.
// Reading the real rows is what makes the picker mean anything.
//
// `probability` and `order` are NOT returned, because deal_stages has neither
// column. The client interface declares both and reads neither; inventing them
// here would be a number with nothing behind it.
//
// IDENTITY ONLY, which is the COP-M07 rule: deals.stage_id holds a LEGACY
// deal_stages id, so the legacy row is the authoritative copy of a stage's name
// and colour and a picker has to offer those ids. is_won_stage and
// is_closing_stage are stage CONFIGURATION and live canonically on
// pipeline_stages; reading them here would make the legacy table a second
// source of truth for what a stage MEANS. server/tests/unit/deal-stages-inventory.test.ts
// holds that line and caught this on the first run.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const { data, error } = await admin
      .from('deal_stages')
      .select('id, name, description, color, sort_order, is_active')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading deal stages:', error);
      return createCorsResponse({ error: 'Failed to fetch deal stages' }, 500, req);
    }

    // An empty list is the honest answer for a tenant with no pipeline
    // configured. POST /deals already replies 400 NO_DEAL_STAGES in that case,
    // so the two agree instead of offering stages that cannot be used.
    return createCorsResponse(
      (data ?? []).map((stage: Record<string, unknown>) => ({
        ...stage,
        sortOrder: stage.sort_order,
        isActive: stage.is_active,
      })),
      200,
      req,
    );
  } catch (error) {
    console.error('Error in deal-stages function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
