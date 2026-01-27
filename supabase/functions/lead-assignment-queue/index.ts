// Lead Assignment Queue Edge Function
// Handles lead assignment queue management
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
    const queueId = pathParts[1];
    const action = pathParts[2];

    // GET /lead-assignment-queue - Get queue
    if (req.method === 'GET' && !queueId) {
      const status = url.searchParams.get('status') || 'pending';

      const { data: queue, error } = await admin
        .from('lead_assignment_queue')
        .select(
          `
          *,
          lead:lead_id (id, company_name, status)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('status', status)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch assignment queue' }, 500, req);
      }

      return createCorsResponse(queue || [], 200, req);
    }

    // POST /lead-assignment-queue - Add to queue
    if (req.method === 'POST' && !queueId) {
      const body = await req.json();

      const { data: queueItem, error } = await admin
        .from('lead_assignment_queue')
        .insert({
          tenant_id: tenantId,
          lead_id: body.leadId || body.lead_id,
          priority: body.priority || 0,
          source: body.source,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add to queue' }, 500, req);
      }

      return createCorsResponse(queueItem, 201, req);
    }

    // POST /lead-assignment-queue/:id/process - Process queue item
    if (req.method === 'POST' && queueId && action === 'process') {
      const body = await req.json();

      // Update queue item
      const { data: queueItem, error } = await admin
        .from('lead_assignment_queue')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          assigned_to_id: body.assignedToId || body.assigned_to_id,
        })
        .eq('id', queueId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to process queue item' }, 500, req);
      }

      // If assigned, update the lead
      if (body.assignedToId || body.assigned_to_id) {
        await admin
          .from('leads')
          .update({
            assigned_to_id: body.assignedToId || body.assigned_to_id,
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', queueItem.lead_id)
          .eq('tenant_id', tenantId);
      }

      return createCorsResponse(queueItem, 200, req);
    }

    // DELETE /lead-assignment-queue/:id - Remove from queue
    if (req.method === 'DELETE' && queueId) {
      const { error } = await admin
        .from('lead_assignment_queue')
        .delete()
        .eq('id', queueId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to remove from queue' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Removed from queue' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in lead-assignment-queue function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
