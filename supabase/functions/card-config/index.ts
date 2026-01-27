// Card Config Edge Function
// Handles dashboard card configuration
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

    // GET /card-config - Get user's dashboard card configuration
    if (req.method === 'GET') {
      const { data: config, error } = await admin
        .from('dashboard_card_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        return createCorsResponse({ error: 'Failed to fetch card config' }, 500, req);
      }

      // Return default config if none exists
      if (!config) {
        return createCorsResponse(
          {
            cards: [
              { id: 'tasks', enabled: true, position: 0 },
              { id: 'appointments', enabled: true, position: 1 },
              { id: 'leads', enabled: true, position: 2 },
              { id: 'deals', enabled: true, position: 3 },
              { id: 'activities', enabled: true, position: 4 },
            ],
            layout: 'grid',
          },
          200,
          req,
        );
      }

      return createCorsResponse(config.config, 200, req);
    }

    // PUT /card-config - Update card configuration
    if (req.method === 'PUT') {
      const body = await req.json();

      const { data: config, error } = await admin
        .from('dashboard_card_configs')
        .upsert(
          {
            user_id: user.id,
            tenant_id: tenantId,
            config: body,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,tenant_id',
          },
        )
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update card config' }, 500, req);
      }

      return createCorsResponse(config.config, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in card-config function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
