// Deal Desk Requests Edge Function
// Handles deal desk approval requests
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
    const requestId = pathParts[2]; // deal-desk/requests/:id
    const action = pathParts[3];

    // GET /deal-desk/requests - List requests
    if (req.method === 'GET' && !requestId) {
      const status = url.searchParams.get('status');

      let query = admin
        .from('deal_desk_requests')
        .select(
          `
          *,
          deal:deal_id (id, name, value),
          requester:requester_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);

      const { data: requests, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch deal desk requests' }, 500, req);
      }

      return createCorsResponse(requests || [], 200, req);
    }

    // GET /deal-desk/requests/:id - Get single request
    if (req.method === 'GET' && requestId && !action) {
      const { data: request, error } = await admin
        .from('deal_desk_requests')
        .select(
          `
          *,
          deal:deal_id (*),
          requester:requester_id (id, full_name, email),
          comments:deal_desk_comments (*)
        `,
        )
        .eq('id', requestId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Deal desk request not found' }, 404, req);
      }

      return createCorsResponse(request, 200, req);
    }

    // POST /deal-desk/requests - Create request
    if (req.method === 'POST' && !requestId) {
      const body = await req.json();

      const { data: request, error } = await admin
        .from('deal_desk_requests')
        .insert({
          tenant_id: tenantId,
          deal_id: body.dealId || body.deal_id,
          request_type: body.requestType || body.request_type,
          discount_amount: body.discountAmount || body.discount_amount,
          discount_percentage: body.discountPercentage || body.discount_percentage,
          justification: body.justification,
          status: 'pending',
          requester_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create deal desk request' }, 500, req);
      }

      return createCorsResponse(request, 201, req);
    }

    // POST /deal-desk/requests/:id/decision - Make decision
    if (req.method === 'POST' && requestId && action === 'decision') {
      const body = await req.json();

      const { data: request, error } = await admin
        .from('deal_desk_requests')
        .update({
          status: body.decision, // 'approved' or 'rejected'
          decision_notes: body.notes || body.decision_notes,
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to record decision' }, 500, req);
      }

      return createCorsResponse(request, 200, req);
    }

    // POST /deal-desk/requests/:id/comments - Add comment
    if (req.method === 'POST' && requestId && action === 'comments') {
      const body = await req.json();

      const { data: comment, error } = await admin
        .from('deal_desk_comments')
        .insert({
          request_id: requestId,
          user_id: user.id,
          content: body.content,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to add comment' }, 500, req);
      }

      return createCorsResponse(comment, 201, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in deal-desk-requests function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
