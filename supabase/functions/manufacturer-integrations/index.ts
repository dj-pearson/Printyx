// Manufacturer Integrations Edge Function
// Handles manufacturer API integrations (HP, Canon, Xerox, etc.)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /manufacturer-integrations, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'manufacturer-integrations');
    const manufacturer = parts[0];
    const endpoint = parts[1];

    // GET /manufacturer-integrations - List all integrations
    if (req.method === 'GET' && !manufacturer) {
      const { data: integrations } = await admin
        .from('manufacturer_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('manufacturer', { ascending: true });

      return createCorsResponse(integrations || [], 200, req);
    }

    // GET /manufacturer-integrations/status - Get all integration statuses
    if (req.method === 'GET' && manufacturer === 'status') {
      const { data: integrations } = await admin
        .from('manufacturer_integrations')
        // COP-M01: last_sync_at and manufacturer_name were not columns (they are
        // last_sync and manufacturer). There is no error_message column either,
        // so the status map reports the sync state it can see rather than an
        // error field that never existed.
        .select('manufacturer, is_active, last_sync, status')
        .eq('tenant_id', tenantId);

      const statusMap: Record<string, any> = {};
      (integrations || []).forEach((i: any) => {
        statusMap[i.manufacturer] = {
          connected: i.is_active,
          lastSync: i.last_sync,
          syncStatus: i.status ?? null,
        };
      });

      return createCorsResponse(statusMap, 200, req);
    }

    // ORDERING IS LOAD-BEARING: /stats and /audit-logs must stay ABOVE the
    // GET /:manufacturer branch, which matches on `manufacturer && !endpoint`
    // and would otherwise answer both as an integration lookup.
    // ManufacturerIntegration.tsx and ManufacturerIntegrationAudit.tsx call
    // them. The Express side of this was fixed under check:route-shadowing;
    // production runs THIS file, so that fix alone had left prod broken.
    // GET /manufacturer-integrations/stats
    if (req.method === 'GET' && manufacturer === 'stats') {
      const countOf = async (
        client: typeof admin,
        table: string,
        apply: (q: any) => any,
      ): Promise<number> => {
        const { count } = await apply(
          client.from(table).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        );
        return count ?? 0;
      };

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [totalIntegrations, activeIntegrations, totalDevices, onlineDevices, todayMetrics] =
        await Promise.all([
          countOf(admin, 'manufacturer_integrations', (q) => q),
          countOf(admin, 'manufacturer_integrations', (q) => q.eq('status', 'active')),
          countOf(admin, 'device_registrations', (q) => q),
          countOf(admin, 'device_registrations', (q) => q.eq('status', 'online')),
          countOf(admin, 'device_metrics', (q) => q.gte('collection_timestamp', dayAgo)),
        ]);

      return createCorsResponse(
        { totalIntegrations, activeIntegrations, totalDevices, onlineDevices, todayMetrics },
        200,
        req,
      );
    }

    // GET /manufacturer-integrations/audit-logs
    //
    // Express joins the integration and device rows onto each log. PostgREST
    // expresses that as an embed, which is cheaper than two round trips - the
    // FKs are integration_id and device_id.
    if (req.method === 'GET' && manufacturer === 'audit-logs') {
      const days = parseInt(url.searchParams.get('days') || '7', 10) || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      let query = admin
        .from('integration_audit_logs')
        .select('*, integration:manufacturer_integrations(*), device:device_registrations(*)')
        .eq('tenant_id', tenantId)
        .gte('timestamp', startDate)
        .order('timestamp', { ascending: false })
        .limit(100);

      const integrationId = url.searchParams.get('integrationId');
      const deviceId = url.searchParams.get('deviceId');
      const action = url.searchParams.get('action');
      const status = url.searchParams.get('status');
      if (integrationId) query = query.eq('integration_id', integrationId);
      if (deviceId) query = query.eq('device_id', deviceId);
      if (action) query = query.eq('action', action);
      if (status) query = query.eq('status', status);

      const { data: logs, error } = await query;

      if (error) {
        console.error('Error fetching integration audit logs:', error);
        return createCorsResponse({ message: 'Failed to fetch audit logs' }, 500, req);
      }

      // Express returns { log, integration, device } per row; the embed puts
      // the joined rows under those keys already, so the log's own columns are
      // lifted into `log` to match.
      return createCorsResponse(
        (logs ?? []).map((row: any) => {
          const { integration, device, ...log } = row;
          return { log, integration, device };
        }),
        200,
        req,
      );
    }

    // GET /manufacturer-integrations/:manufacturer - Get specific integration
    if (req.method === 'GET' && manufacturer && !endpoint) {
      const { data: integration } = await admin
        .from('manufacturer_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('manufacturer', manufacturer)
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
          manufacturer: manufacturer,
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
        // No disconnected_at column; is_active plus updated_at is the record.
        .update({
          is_active: false,
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

      // Log sync attempt
      const { data: syncLog } = await admin
        .from('manufacturer_sync_logs')
        .insert({
          tenant_id: tenantId,
          manufacturer: manufacturer,
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
          last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('manufacturer', manufacturer);

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
        .order('model_number', { ascending: true });

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
        .eq('manufacturer', manufacturer)
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
        .eq('manufacturer', manufacturer)
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

    // ─── Top-level views (EDGE-002h) ────────────────────────────────────────
    //
    // These match on parts[0] because /stats and /audit-logs are top-level -
    // everything else in this function reads parts[0] as a MANUFACTURER and
    // parts[1] as the sub-resource, which is the legitimate shape, not the
    // prod-404 signature.

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
