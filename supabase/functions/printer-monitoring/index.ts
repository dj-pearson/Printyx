// Printer Monitoring Edge Function
// Handles printer monitoring operations and OID presets
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'printer-monitoring');
    const resource = parts[0]; // oid-presets, devices, metrics
    const resourceId = parts[1];

    // For client-authenticated endpoints
    const apiKey = req.headers.get('x-api-key');

    // For user-authenticated endpoints
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // ============================================================================
    // AUTHENTICATION CHECK - Require some form of auth for all endpoints
    // ============================================================================
    if (!apiKey && !jwt) {
      return createCorsResponse(
        {
          error: 'Authentication required. Provide x-api-key header or Authorization Bearer token.',
        },
        401,
        req,
      );
    }

    // GET /printer-monitoring/oid-presets - Get all OID presets (requires auth)
    if (req.method === 'GET' && resource === 'oid-presets' && !resourceId) {
      // Verify user has valid JWT for OID presets access
      if (jwt) {
        const supabase = createSupabaseClient(req);
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(jwt);
        if (userError || !user) {
          return createCorsResponse({ error: 'Unauthorized' }, 401, req);
        }
      } else if (apiKey) {
        // Also allow API key authenticated clients to access presets
        const { data: client } = await admin
          .from('monitoring_clients')
          .select('id')
          .eq('api_key', apiKey)
          .eq('status', 'active')
          .single();
        if (!client) {
          return createCorsResponse({ error: 'Invalid or inactive API key' }, 401, req);
        }
      }

      const { data: presets, error } = await admin
        .from('oid_presets')
        .select('*')
        .order('manufacturer', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch OID presets' }, 500, req);
      }

      // Group by manufacturer
      const grouped: Record<string, any[]> = {};
      (presets || []).forEach((preset: any) => {
        if (!grouped[preset.manufacturer]) {
          grouped[preset.manufacturer] = [];
        }
        grouped[preset.manufacturer].push(preset);
      });

      return createCorsResponse(
        {
          presets: presets || [],
          byManufacturer: grouped,
        },
        200,
        req,
      );
    }

    // GET /printer-monitoring/oid-presets/:manufacturer - Get manufacturer-specific presets (requires auth)
    if (req.method === 'GET' && resource === 'oid-presets' && resourceId) {
      // Verify user has valid JWT or API key
      if (jwt) {
        const supabase = createSupabaseClient(req);
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(jwt);
        if (userError || !user) {
          return createCorsResponse({ error: 'Unauthorized' }, 401, req);
        }
      } else if (apiKey) {
        const { data: client } = await admin
          .from('monitoring_clients')
          .select('id')
          .eq('api_key', apiKey)
          .eq('status', 'active')
          .single();
        if (!client) {
          return createCorsResponse({ error: 'Invalid or inactive API key' }, 401, req);
        }
      }

      const { data: presets, error } = await admin
        .from('oid_presets')
        .select('*')
        .ilike('manufacturer', `%${resourceId}%`)
        .order('name', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch OID presets' }, 500, req);
      }

      return createCorsResponse(presets || [], 200, req);
    }

    // Client-authenticated endpoints
    if (apiKey) {
      // Verify API key
      const { data: client } = await admin
        .from('monitoring_clients')
        .select('id, tenant_id, customer_id, status')
        .eq('api_key', apiKey)
        .eq('status', 'active')
        .single();

      if (!client) {
        return createCorsResponse({ error: 'Invalid or inactive API key' }, 401, req);
      }

      // POST /printer-monitoring/devices - Submit discovered devices
      if (req.method === 'POST' && resource === 'devices') {
        const body = await req.json();
        const devices = body.devices || [body];

        const processedDevices = [];

        for (const device of devices) {
          const { data, error } = await admin
            .from('discovered_devices')
            .upsert(
              {
                tenant_id: client.tenant_id,
                client_id: client.id,
                ip_address: device.ipAddress || device.ip_address,
                mac_address: device.macAddress || device.mac_address,
                serial_number: device.serialNumber || device.serial_number,
                manufacturer: device.manufacturer,
                model: device.model,
                hostname: device.hostname,
                status: device.status || 'online',
                snmp_data: device.snmpData || device.snmp_data || {},
                discovered_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
              },
              {
                onConflict: 'tenant_id,serial_number',
              },
            )
            .select()
            .single();

          if (!error && data) {
            processedDevices.push(data);
          }
        }

        return createCorsResponse(
          {
            success: true,
            received: devices.length,
            processed: processedDevices.length,
          },
          200,
          req,
        );
      }

      // POST /printer-monitoring/metrics - Submit printer metrics
      if (req.method === 'POST' && resource === 'metrics') {
        const body = await req.json();
        const metrics = body.metrics || [body];

        const processedMetrics = [];

        for (const metric of metrics) {
          const { data, error } = await admin
            .from('printer_metrics')
            .insert({
              tenant_id: client.tenant_id,
              client_id: client.id,
              device_serial: metric.serialNumber || metric.device_serial,
              page_count_total: metric.pageCountTotal || metric.page_count_total,
              page_count_color: metric.pageCountColor || metric.page_count_color,
              page_count_bw: metric.pageCountBw || metric.page_count_bw,
              toner_black: metric.tonerBlack || metric.toner_black,
              toner_cyan: metric.tonerCyan || metric.toner_cyan,
              toner_magenta: metric.tonerMagenta || metric.toner_magenta,
              toner_yellow: metric.tonerYellow || metric.toner_yellow,
              drum_level: metric.drumLevel || metric.drum_level,
              fuser_level: metric.fuserLevel || metric.fuser_level,
              status: metric.status,
              errors: metric.errors || [],
              raw_data: metric.rawData || metric.raw_data || {},
              collected_at: metric.collectedAt || new Date().toISOString(),
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!error && data) {
            processedMetrics.push(data);
          }
        }

        // Update client last seen
        await admin
          .from('monitoring_clients')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', client.id);

        return createCorsResponse(
          {
            success: true,
            received: metrics.length,
            processed: processedMetrics.length,
          },
          200,
          req,
        );
      }
    }

    // User-authenticated endpoints
    if (jwt) {
      const supabase = createSupabaseClient(req);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(jwt);

      if (userError || !user) {
        return createCorsResponse({ error: 'Unauthorized' }, 401, req);
      }

      const tenantId =
        (user.app_metadata?.tenantId as string) ||
        (user.app_metadata?.tenant_id as string) ||
        (user.user_metadata?.tenantId as string) ||
        (user.user_metadata?.tenant_id as string) ||
        req.headers.get('x-tenant-id');

      // GET /printer-monitoring/dashboard - Get monitoring dashboard data
      if (req.method === 'GET' && resource === 'dashboard') {
        const { data: devices } = await admin
          .from('discovered_devices')
          .select('status')
          .eq('tenant_id', tenantId);

        const { data: recentMetrics } = await admin
          .from('printer_metrics')
          .select('toner_black, toner_cyan, toner_magenta, toner_yellow')
          .eq('tenant_id', tenantId)
          .order('collected_at', { ascending: false })
          .limit(100);

        const lowTonerCount = (recentMetrics || []).filter(
          (m: any) =>
            m.toner_black < 20 || m.toner_cyan < 20 || m.toner_magenta < 20 || m.toner_yellow < 20,
        ).length;

        return createCorsResponse(
          {
            totalDevices: devices?.length || 0,
            onlineDevices: devices?.filter((d: any) => d.status === 'online').length || 0,
            offlineDevices: devices?.filter((d: any) => d.status === 'offline').length || 0,
            lowTonerAlerts: lowTonerCount,
          },
          200,
          req,
        );
      }
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in printer-monitoring function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
