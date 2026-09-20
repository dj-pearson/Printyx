// Business Records Search Edge Function
// Handles business record search
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

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
        // AUDIT-037: `business_records` has no `email` column - the contact
        // address is `primary_contact_email`. A PostgREST `.or()` naming an
        // unknown column fails the WHOLE query, so searching by anything at
        // all returned a 42703 rather than just missing the email match.
        query = query.or(`company_name.ilike.%${search}%,primary_contact_email.ilike.%${search}%`);
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
