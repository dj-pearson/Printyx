// Monitoring Clients Edge Function
// Handles printer monitoring client management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    const { parts } = normalizePath(url.pathname, 'monitoring-clients');
    const clientId = parts[0];
    const action = parts[1];

    // GET /monitoring-clients - List monitoring clients
    if (req.method === 'GET' && !clientId) {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');

      let query = admin
        .from('monitoring_clients')
        .select(
          `
          *,
          customer:customer_id (id, company_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data: clients, error } = await query;

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch monitoring clients' }, 500, req);
      }

      return createCorsResponse(clients || [], 200, req);
    }

    // GET /monitoring-clients/:id - Get single client
    if (req.method === 'GET' && clientId && !action) {
      const { data: client, error } = await admin
        .from('monitoring_clients')
        .select(
          `
          *,
          customer:customer_id (*)
        `,
        )
        .eq('id', clientId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Monitoring client not found' }, 404, req);
      }

      return createCorsResponse(client, 200, req);
    }

    // POST /monitoring-clients - Create monitoring client
    if (req.method === 'POST' && !clientId) {
      const body = await req.json();

      // Generate API key for client
      const apiKey = `mc_${crypto.randomUUID().replace(/-/g, '')}`;

      const { data: client, error } = await admin
        .from('monitoring_clients')
        .insert({
          tenant_id: tenantId,
          customer_id: body.customerId || body.customer_id,
          name: body.name,
          description: body.description,
          api_key: apiKey,
          status: 'active',
          config: body.config || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create monitoring client' }, 500, req);
      }

      return createCorsResponse(
        {
          ...client,
          apiKey, // Return the API key only on creation
          message: 'Save this API key - it will not be shown again',
        },
        201,
        req,
      );
    }

    // PUT /monitoring-clients/:id - Update client
    if (req.method === 'PUT' && clientId && !action) {
      const body = await req.json();

      const { data: client, error } = await admin
        .from('monitoring_clients')
        .update({
          name: body.name,
          description: body.description,
          status: body.status,
          config: body.config,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update monitoring client' }, 500, req);
      }

      return createCorsResponse(client, 200, req);
    }

    // POST /monitoring-clients/:id/rotate-key - Rotate API key
    if (req.method === 'POST' && clientId && action === 'rotate-key') {
      const newApiKey = `mc_${crypto.randomUUID().replace(/-/g, '')}`;

      const { data: client, error } = await admin
        .from('monitoring_clients')
        .update({
          api_key: newApiKey,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to rotate API key' }, 500, req);
      }

      return createCorsResponse(
        {
          ...client,
          apiKey: newApiKey,
          message: 'Save this new API key - it will not be shown again',
        },
        200,
        req,
      );
    }

    // GET /monitoring-clients/:id/activity - Get client activity
    if (req.method === 'GET' && clientId && action === 'activity') {
      const { data: activity, error } = await admin
        .from('monitoring_client_activity')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch client activity' }, 500, req);
      }

      return createCorsResponse(activity || [], 200, req);
    }

    // GET /monitoring-clients/:id/discovered-devices - Get discovered devices
    if (req.method === 'GET' && clientId && action === 'discovered-devices') {
      const { data: devices, error } = await admin
        .from('discovered_devices')
        .select('*')
        .eq('client_id', clientId)
        .eq('tenant_id', tenantId)
        .order('discovered_at', { ascending: false });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch discovered devices' }, 500, req);
      }

      return createCorsResponse(devices || [], 200, req);
    }

    // DELETE /monitoring-clients/:id - Delete client
    if (req.method === 'DELETE' && clientId) {
      const { error } = await admin
        .from('monitoring_clients')
        .delete()
        .eq('id', clientId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete monitoring client' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Monitoring client deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in monitoring-clients function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
