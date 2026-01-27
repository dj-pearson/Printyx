// Demos Edge Function
// Handles demo scheduling and management
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const subRoute = pathParts[1]; // e.g., 'customers'
    const demoId = pathParts[1] && pathParts[1] !== 'customers' ? pathParts[1] : null;

    // GET /demos/customers - List customers eligible for demos
    if (req.method === 'GET' && subRoute === 'customers') {
      const { data: customers, error } = await admin
        .from('companies')
        .select('id, business_name, status')
        .eq('tenant_id', tenantId)
        .order('business_name');

      if (error) {
        console.error('Error fetching demo customers:', error);
        return createCorsResponse({ error: 'Failed to fetch customers' }, 500, req);
      }

      return createCorsResponse(customers || [], 200, req);
    }

    // GET /demos - List all demos
    if (req.method === 'GET' && !demoId) {
      // TODO: Create demos table and fetch from database
      return createCorsResponse([], 200, req);
    }

    // GET /demos/:id - Get single demo
    if (req.method === 'GET' && demoId) {
      // TODO: Fetch single demo from database
      return createCorsResponse({ error: 'Demo not found' }, 404, req);
    }

    // POST /demos - Create demo
    if (req.method === 'POST') {
      const body = await req.json();
      // TODO: Create demo in database
      return createCorsResponse({ success: true, message: 'Demo scheduled' }, 201, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in demos function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
