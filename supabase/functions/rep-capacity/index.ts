// Rep Capacity Edge Function
// Handles sales rep capacity management
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
    const userId = pathParts[1];
    const action = pathParts[2];

    // GET /rep-capacity - List all rep capacity
    if (req.method === 'GET' && !userId) {
      const { data: capacity, error } = await admin
        .from('rep_capacity')
        .select(
          `
          *,
          user:user_id (id, full_name, email)
        `,
        )
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch rep capacity' }, 500, req);
      }

      return createCorsResponse(capacity || [], 200, req);
    }

    // GET /rep-capacity/:userId - Get single rep capacity
    if (req.method === 'GET' && userId && !action) {
      const { data: capacity, error } = await admin
        .from('rep_capacity')
        .select(
          `
          *,
          user:user_id (id, full_name, email)
        `,
        )
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        // Return default capacity if not found
        return createCorsResponse(
          {
            user_id: userId,
            max_leads: 50,
            current_leads: 0,
            is_available: true,
          },
          200,
          req,
        );
      }

      return createCorsResponse(capacity, 200, req);
    }

    // POST /rep-capacity - Create/update rep capacity
    if (req.method === 'POST' && !userId) {
      const body = await req.json();

      const { data: capacity, error } = await admin
        .from('rep_capacity')
        .upsert(
          {
            tenant_id: tenantId,
            user_id: body.userId || body.user_id,
            max_leads: body.maxLeads || body.max_leads || 50,
            current_leads: body.currentLeads || body.current_leads || 0,
            is_available: body.isAvailable !== false,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'tenant_id,user_id',
          },
        )
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update rep capacity' }, 500, req);
      }

      return createCorsResponse(capacity, 200, req);
    }

    // PATCH /rep-capacity/:userId/availability - Update availability
    if (req.method === 'PATCH' && userId && action === 'availability') {
      const body = await req.json();

      const { data: capacity, error } = await admin
        .from('rep_capacity')
        .update({
          is_available: body.isAvailable ?? body.is_available,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update availability' }, 500, req);
      }

      return createCorsResponse(capacity, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in rep-capacity function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
