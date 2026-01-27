// Deal Desk Delegations Edge Function
// Handles approval delegation management
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
    const delegationId = pathParts[2]; // deal-desk/delegations/:id
    const action = pathParts[3];

    // GET /deal-desk/delegations - List delegations
    if (req.method === 'GET' && !delegationId) {
      const { data: delegations, error } = await admin
        .from('deal_desk_delegations')
        .select(
          `
          *,
          delegator:delegator_id (id, full_name),
          delegate:delegate_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch delegations' }, 500, req);
      }

      return createCorsResponse(delegations || [], 200, req);
    }

    // POST /deal-desk/delegations - Create delegation
    if (req.method === 'POST' && !delegationId) {
      const body = await req.json();

      const { data: delegation, error } = await admin
        .from('deal_desk_delegations')
        .insert({
          tenant_id: tenantId,
          delegator_id: user.id,
          delegate_id: body.delegateId || body.delegate_id,
          start_date: body.startDate || body.start_date,
          end_date: body.endDate || body.end_date,
          reason: body.reason,
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create delegation' }, 500, req);
      }

      return createCorsResponse(delegation, 201, req);
    }

    // PATCH /deal-desk/delegations/:id/deactivate - Deactivate delegation
    if (req.method === 'PATCH' && delegationId && action === 'deactivate') {
      const { data: delegation, error } = await admin
        .from('deal_desk_delegations')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
        })
        .eq('id', delegationId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to deactivate delegation' }, 500, req);
      }

      return createCorsResponse(delegation, 200, req);
    }

    // DELETE /deal-desk/delegations/:id - Delete delegation
    if (req.method === 'DELETE' && delegationId) {
      const { error } = await admin
        .from('deal_desk_delegations')
        .delete()
        .eq('id', delegationId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete delegation' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Delegation deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in deal-desk-delegations function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
