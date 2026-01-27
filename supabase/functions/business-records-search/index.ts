// Business Records Search Edge Function
// Handles business record search
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

    // GET /business-records - Search business records
    if (req.method === 'GET') {
      const search = url.searchParams.get('search') || url.searchParams.get('q');
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      let query = admin
        .from('business_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (search) {
        query = query.or(`company_name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (type) query = query.eq('record_type', type);
      if (status) query = query.eq('status', status);

      const { data: records, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to search business records' }, 500, req);
      }

      return createCorsResponse(records || [], 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in business-records-search function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
