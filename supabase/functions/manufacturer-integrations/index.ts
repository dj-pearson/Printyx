// Manufacturer Integrations Edge Function
// Handles manufacturer API integrations (HP, Canon, Xerox, etc.)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Reserved first segments that are NOT a manufacturer name or integration id.
const RESERVED = new Set(['stats', 'status']);

// Camelize a manufacturer_integrations row for the frontend (reads camelCase).
function toIntegration(r: any) {
  if (!r) return r;
  return {
    id: r.id,
    manufacturer: r.manufacturer,
    integrationName: r.integration_name,
    status: r.status,
    authMethod: r.auth_method,
    apiEndpoint: r.api_endpoint,
    collectionFrequency: r.collection_frequency,
    lastSync: r.last_sync,
    nextSync: r.next_sync,
    isActive: r.is_active,
    configuration: r.configuration,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

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
    // Coolify-safe routing: parts[0] = manufacturer | id | reserved, parts[1] = action
    const { parts } = normalizePath(url.pathname, 'manufacturer-integrations');
    const first = parts[0];
    const endpoint = parts[1];
    const isId = !!first && UUID_RE.test(first);

    // ========================================================================
    // ROOT + STATS
    // ========================================================================

    // GET /manufacturer-integrations - List all integrations (frontend list)
    if (req.method === 'GET' && !first) {
      const { data: integrations, error } = await admin
        .from('manufacturer_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return createCorsResponse([], 200, req);
      }

      return createCorsResponse(((integrations || []) as any[]).map(toIntegration), 200, req);
    }

    // POST /manufacturer-integrations - Create integration (frontend create)
    if (req.method === 'POST' && !first) {
      const body = await req.json();

      const insertData = {
        tenant_id: tenantId,
        manufacturer: body.manufacturer,
        integration_name: body.integrationName || body.integration_name,
        status: body.status || (body.isActive === false ? 'inactive' : 'pending'),
        auth_method: body.authMethod || body.auth_method,
        credentials: body.credentials || {},
        api_endpoint: body.apiEndpoint || body.api_endpoint || null,
        collection_frequency: body.collectionFrequency || body.collection_frequency || 'daily',
        configuration: body.configuration || {},
        is_active: body.isActive !== undefined ? body.isActive : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: integration, error } = await admin
        .from('manufacturer_integrations')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating manufacturer integration:', error);
        return createCorsResponse(
          { error: 'Failed to create integration', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse(toIntegration(integration), 201, req);
    }

    // GET /manufacturer-integrations/stats - Integration statistics (frontend dashboard)
    if (req.method === 'GET' && first === 'stats') {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [totalRes, activeRes, devicesRes, onlineRes, metricsRes] = await Promise.all([
        admin
          .from('manufacturer_integrations')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        admin
          .from('manufacturer_integrations')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
        admin
          .from('device_registrations')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        admin
          .from('device_registrations')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'online'),
        admin
          .from('device_metrics')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('collection_timestamp', dayAgo),
      ]);

      return createCorsResponse(
        {
          totalIntegrations: totalRes.error ? 0 : totalRes.count || 0,
          activeIntegrations: activeRes.error ? 0 : activeRes.count || 0,
          totalDevices: devicesRes.error ? 0 : devicesRes.count || 0,
          onlineDevices: onlineRes.error ? 0 : onlineRes.count || 0,
          todayMetrics: metricsRes.error ? 0 : metricsRes.count || 0,
        },
        200,
        req,
      );
    }

    // GET /manufacturer-integrations/status - Get all integration statuses
    if (req.method === 'GET' && first === 'status') {
      const { data: integrations } = await admin
        .from('manufacturer_integrations')
        .select('manufacturer, status, last_sync')
        .eq('tenant_id', tenantId);

      const statusMap: Record<string, any> = {};
      ((integrations || []) as any[]).forEach((i: any) => {
        statusMap[i.manufacturer] = {
          connected: i.status === 'active',
          status: i.status,
          lastSync: i.last_sync,
        };
      });

      return createCorsResponse(statusMap, 200, req);
    }

    // ========================================================================
    // INTEGRATION-BY-ID ROUTES (UUID :id — frontend test/discover/get)
    // ========================================================================

    // POST /manufacturer-integrations/:id/test - Test connection
    if (req.method === 'POST' && isId && endpoint === 'test') {
      const { data: integration, error } = await admin
        .from('manufacturer_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', first)
        .single();

      if (error || !integration) {
        return createCorsResponse({ success: false, message: 'Integration not found' }, 200, req);
      }

      // Real connection testing requires Node-only manufacturer SDK calls.
      // Degrade honestly: report config presence + active status rather than a
      // fake random success (the Express handler returned Math.random()).
      const hasCreds =
        !!integration.credentials && Object.keys(integration.credentials || {}).length > 0;
      const ok = integration.is_active && hasCreds;

      return createCorsResponse(
        {
          success: ok,
          message: ok
            ? 'Integration is active and credentials are configured'
            : !integration.is_active
              ? 'Integration is inactive'
              : 'Integration credentials are not configured',
          degraded: true,
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // POST /manufacturer-integrations/:id/discover - Discover devices
    if (req.method === 'POST' && isId && endpoint === 'discover') {
      const { data: integration, error: intError } = await admin
        .from('manufacturer_integrations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('id', first)
        .single();

      if (intError || !integration) {
        return createCorsResponse({ message: 'Integration not found', devices: [] }, 404, req);
      }

      // Real discovery calls the manufacturer API (Node-only). Degrade by
      // returning the already-registered devices for this integration.
      const { data: devices, error } = await admin
        .from('device_registrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_id', first)
        .order('registered_at', { ascending: false });

      if (error) {
        return createCorsResponse(
          { message: 'Discovered 0 devices', devices: [], degraded: true },
          200,
          req,
        );
      }

      const list = (devices || []) as any[];
      return createCorsResponse(
        {
          message: `Discovered and registered ${list.length} devices`,
          devices: list,
          degraded: true,
        },
        200,
        req,
      );
    }

    // GET /manufacturer-integrations/:id/devices - Devices for an integration
    if (req.method === 'GET' && isId && endpoint === 'devices') {
      const { data: devices, error } = await admin
        .from('device_registrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_id', first)
        .order('registered_at', { ascending: false });

      if (error) {
        return createCorsResponse([], 200, req);
      }

      return createCorsResponse(devices || [], 200, req);
    }

    // GET /manufacturer-integrations/:id - Get single integration by UUID
    if (req.method === 'GET' && isId && !endpoint) {
      const { data: integration, error } = await admin
        .from('manufacturer_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', first)
        .single();

      if (error || !integration) {
        return createCorsResponse({ error: 'Integration not found' }, 404, req);
      }

      return createCorsResponse(toIntegration(integration), 200, req);
    }

    // PUT/PATCH /manufacturer-integrations/:id - Update integration
    if ((req.method === 'PUT' || req.method === 'PATCH') && isId && !endpoint) {
      const body = await req.json();
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      const fieldMap: Record<string, string> = {
        manufacturer: 'manufacturer',
        integrationName: 'integration_name',
        status: 'status',
        authMethod: 'auth_method',
        credentials: 'credentials',
        apiEndpoint: 'api_endpoint',
        collectionFrequency: 'collection_frequency',
        configuration: 'configuration',
        isActive: 'is_active',
      };
      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined) updateData[snakeKey] = body[camelKey];
        else if (body[snakeKey] !== undefined) updateData[snakeKey] = body[snakeKey];
      }

      const { data: integration, error } = await admin
        .from('manufacturer_integrations')
        .update(updateData)
        .eq('tenant_id', tenantId)
        .eq('id', first)
        .select()
        .single();

      if (error || !integration) {
        return createCorsResponse({ error: 'Failed to update integration' }, 500, req);
      }

      return createCorsResponse(toIntegration(integration), 200, req);
    }

    // DELETE /manufacturer-integrations/:id - Delete integration
    if (req.method === 'DELETE' && isId && !endpoint) {
      const { error } = await admin
        .from('manufacturer_integrations')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', first);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete integration' }, 500, req);
      }

      return createCorsResponse({ message: 'Integration deleted successfully' }, 200, req);
    }

    // ========================================================================
    // LEGACY :manufacturer ROUTES (by manufacturer name, e.g. 'canon')
    // Preserved from the original edge fn. Note: these reference legacy column
    // names (manufacturer_name/is_active/last_sync_at) that drift from the real
    // manufacturer_integrations schema; they have no frontend callers and are
    // kept for backward compatibility only.
    // ========================================================================

    const manufacturer = first && !isId && !RESERVED.has(first) ? first : undefined;

    // GET /manufacturer-integrations/:manufacturer - Get specific integration
    if (req.method === 'GET' && manufacturer && !endpoint) {
      const { data: integration } = await admin
        .from('manufacturer_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('manufacturer', manufacturer)
        .maybeSingle();

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
          ...toIntegration(integration),
          connected: (integration as any).status === 'active',
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
          manufacturer,
          integration_name: body.integrationName || body.integration_name || `${manufacturer}`,
          auth_method: body.authMethod || body.auth_method || 'api_key',
          credentials: body.credentials || {
            apiKey: body.apiKey || body.api_key,
            apiSecret: body.apiSecret || body.api_secret,
            clientId: body.clientId || body.client_id,
            clientSecret: body.clientSecret || body.client_secret,
          },
          api_endpoint: body.apiEndpoint || body.api_endpoint || null,
          status: 'active',
          is_active: true,
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
          integration: toIntegration(integration),
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
          status: 'inactive',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('manufacturer', manufacturer);

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

      // Update the sync timestamp on the integration. Real sync calls the
      // manufacturer API (Node-only) — degrade by recording the attempt.
      await admin
        .from('manufacturer_integrations')
        .update({
          last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('manufacturer', manufacturer);

      return createCorsResponse(
        {
          success: true,
          message: `Sync initiated for ${manufacturer}`,
          syncType,
          degraded: true,
        },
        200,
        req,
      );
    }

    // GET /manufacturer-integrations/:manufacturer/devices - Devices by manufacturer
    if (req.method === 'GET' && manufacturer && endpoint === 'devices') {
      const { data: devices } = await admin
        .from('equipment')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('manufacturer', `%${manufacturer}%`)
        .order('model_number', { ascending: true });

      return createCorsResponse(devices || [], 200, req);
    }

    // GET /manufacturer-integrations/:manufacturer/supplies - Supplies info
    if (req.method === 'GET' && manufacturer && endpoint === 'supplies') {
      const { data: supplies, error } = await admin
        .from('supplies')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('manufacturer', `%${manufacturer}%`)
        .order('part_number', { ascending: true });

      if (error) {
        return createCorsResponse([], 200, req);
      }

      return createCorsResponse(supplies || [], 200, req);
    }

    // GET /manufacturer-integrations/:manufacturer/sync-history - Sync history
    if (req.method === 'GET' && manufacturer && endpoint === 'sync-history') {
      // Sync history is recorded in integration_audit_logs for the real schema.
      // Resolve the integration id first, then read its audit logs.
      const { data: integration } = await admin
        .from('manufacturer_integrations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('manufacturer', manufacturer)
        .maybeSingle();

      if (!integration) {
        return createCorsResponse([], 200, req);
      }

      const { data: history, error } = await admin
        .from('integration_audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_id', (integration as any).id)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) {
        return createCorsResponse([], 200, req);
      }

      return createCorsResponse(history || [], 200, req);
    }

    // POST /manufacturer-integrations/:manufacturer/test - Test connection by name
    if (req.method === 'POST' && manufacturer && endpoint === 'test') {
      const { data: integration } = await admin
        .from('manufacturer_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('manufacturer', manufacturer)
        .maybeSingle();

      if (!integration || !(integration as any).is_active) {
        return createCorsResponse(
          {
            success: false,
            message: 'Integration not configured or inactive',
          },
          200,
          req,
        );
      }

      return createCorsResponse(
        {
          success: true,
          message: `Connection to ${manufacturer} is configured`,
          degraded: true,
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
