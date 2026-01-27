// Assign Lead Edge Function
// Handles direct lead assignment
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

    // POST /assign-lead - Assign lead to user
    if (req.method === 'POST') {
      const body = await req.json();

      const leadId = body.leadId || body.lead_id;
      const assignedToId = body.assignedToId || body.assigned_to_id;

      if (!leadId || !assignedToId) {
        return createCorsResponse({ error: 'Lead ID and assigned user ID are required' }, 400, req);
      }

      // Update lead
      const { data: lead, error: updateError } = await admin
        .from('leads')
        .update({
          assigned_to_id: assignedToId,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (updateError) {
        return createCorsResponse({ error: 'Failed to assign lead' }, 500, req);
      }

      // Record in assignment history
      await admin.from('lead_assignment_history').insert({
        tenant_id: tenantId,
        lead_id: leadId,
        assigned_to_id: assignedToId,
        assigned_by_id: user.id,
        assignment_reason: body.reason || 'manual',
        assigned_at: new Date().toISOString(),
      });

      return createCorsResponse(
        {
          success: true,
          lead,
          message: 'Lead assigned successfully',
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in assign-lead function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
