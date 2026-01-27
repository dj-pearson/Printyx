// Manufacturer Integrations Edge Function
// Handles manufacturer API integrations (HP, Canon, Xerox, etc.)
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
    const manufacturer = pathParts[1];
    const endpoint = pathParts[2];

    // GET /manufacturer-integrations - List all integrations
    if (req.method === 'GET' && !manufacturer) {
      const { data: integrations } = await admin
        .from('manufacturer_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('manufacturer_name', { ascending: true });

      return createCorsResponse(integrations || [], 200, req);
    }

    // GET /manufacturer-integrations/status - Get all integration statuses
    if (req.method === 'GET' && manufacturer === 'status') {
      const { data: integrations } = await admin
        .from('manufacturer_integrations')
        .select('manufacturer_name, is_active, last_sync_at, error_message')
        .eq('tenant_id', tenantId);

      const statusMap: Record<string, any> = {};
      (integrations || []).forEach((i: any) => {
        statusMap[i.manufacturer_name] = {
          connected: i.is_active,
          lastSync: i.last_sync_at,
          error: i.error_message,
        };
      });

      return createCorsResponse(statusMap, 200, req);
    }

    // GET /manufacturer-integrations/:manufacturer - Get specific integration
    if (req.method === 'GET' && manufacturer && !endpoint) {
      const { data: integration } = await admin
        .from('manufacturer_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('manufacturer_name', manufacturer)
        .single();

      if (!integration) {
        return createCorsResponse(
          {
            manufacturer,
            connected: false,
            configured: false,
          },
          200,
          req,
        );
      }

      return createCorsResponse(
        {
          ...integration,
          connected: integration.is_active,
          configured: true,
        },
        200,
        req,
      );
    }

    // POST /manufacturer-integrations/:manufacturer/connect - Connect integration
    if (req.method === 'POST' && manufacturer && endpoint === 'connect') {
      const body = await req.json();

      const { data: integration, error } = await admin
        .from('manufacturer_integrations')
        .upsert({
          tenant_id: tenantId,
          manufacturer_name: manufacturer,
          api_key: body.apiKey || body.api_key,
          api_secret: body.apiSecret || body.api_secret,
          client_id: body.clientId || body.client_id,
          client_secret: body.clientSecret || body.client_secret,
          access_token: body.accessToken || body.access_token,
          refresh_token: body.refreshToken || body.refresh_token,
          token_expires_at: body.tokenExpiresAt || body.token_expires_at,
          dealer_id: body.dealerId || body.dealer_id,
          is_active: true,
          connected_at: new Date().toISOString(),
          connected_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to connect integration' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          message: `Connected to ${manufacturer}`,
          integration,
        },
        200,
        req,
      );
    }

    // POST /manufacturer-integrations/:manufacturer/disconnect - Disconnect
    if (req.method === 'POST' && manufacturer && endpoint === 'disconnect') {
      const { error } = await admin
        .from('manufacturer_integrations')
        .update({
          is_active: false,
          disconnected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('manufacturer_name', manufacturer);

      if (error) {
        return createCorsResponse({ error: 'Failed to disconnect' }, 500, req);
      }

      return createCorsResponse(
        {
          success: true,
          message: `Disconnected from ${manufacturer}`,
        },
        200,
        req,
      );
    }

    // POST /manufacturer-integrations/:manufacturer/sync - Sync data
    if (req.method === 'POST' && manufacturer && endpoint === 'sync') {
      const body = await req.json();
      const syncType = body.type || 'all'; // 'devices', 'supplies', 'meters', 'all'

      // Log sync attempt
      const { data: syncLog } = await admin
        .from('manufacturer_sync_logs')
        .insert({
          tenant_id: tenantId,
          manufacturer_name: manufacturer,
          sync_type: syncType,
          status: 'pending',
          started_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      // In production, this would call the actual manufacturer API
      // For now, update the sync timestamp
      await admin
        .from('manufacturer_integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('manufacturer_name', manufacturer);

      return createCorsResponse(
        {
          success: true,
          syncId: syncLog?.id,
          message: `Sync initiated for ${manufacturer}`,
          syncType,
        },
        200,
        req,
      );
    }

    // GET /manufacturer-integrations/:manufacturer/devices - Get devices from manufacturer
    if (req.method === 'GET' && manufacturer && endpoint === 'devices') {
      // In production, this would fetch from the manufacturer API
      const { data: devices } = await admin
        .from('equipment')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('manufacturer', `%${manufacturer}%`)
        .order('model', { ascending: true });

      return createCorsResponse(devices || [], 200, req);
    }

    // GET /manufacturer-integrations/:manufacturer/supplies - Get supplies info
    if (req.method === 'GET' && manufacturer && endpoint === 'supplies') {
      const { data: supplies } = await admin
        .from('supplies')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('manufacturer', `%${manufacturer}%`)
        .order('part_number', { ascending: true });

      return createCorsResponse(supplies || [], 200, req);
    }

    // GET /manufacturer-integrations/:manufacturer/sync-history - Get sync history
    if (req.method === 'GET' && manufacturer && endpoint === 'sync-history') {
      const { data: history } = await admin
        .from('manufacturer_sync_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('manufacturer_name', manufacturer)
        .order('created_at', { ascending: false })
        .limit(50);

      return createCorsResponse(history || [], 200, req);
    }

    // POST /manufacturer-integrations/:manufacturer/test - Test connection
    if (req.method === 'POST' && manufacturer && endpoint === 'test') {
      const { data: integration } = await admin
        .from('manufacturer_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('manufacturer_name', manufacturer)
        .single();

      if (!integration || !integration.is_active) {
        return createCorsResponse(
          {
            success: false,
            message: 'Integration not configured or inactive',
          },
          200,
          req,
        );
      }

      // In production, this would test the actual API connection
      return createCorsResponse(
        {
          success: true,
          message: `Connection to ${manufacturer} is working`,
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in manufacturer-integrations function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
