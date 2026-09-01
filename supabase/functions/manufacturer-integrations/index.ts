// Manufacturer Integrations Edge Function
// Handles manufacturer API integrations (HP, Canon, Xerox, etc.)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { createAdapter } from '../_shared/manufacturer-adapters.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve parts[0], which is EITHER an integration id or a manufacturer name.
 *
 * PA-052: every per-integration branch here looked the row up by
 * `.eq('manufacturer', parts[0])`, and the only caller in any client tree -
 * ManufacturerIntegration.tsx - passes `integration.id`. `manufacturer` is a
 * pgEnum, so a uuid in that filter is 22P02: not "no row", a 500. Express keys
 * the same paths by id, so the page worked in dev and failed in prod on every
 * per-integration action.
 *
 * The id form is checked first and only against `id`, so a uuid never reaches
 * the enum column.
 */
async function resolveIntegration(admin: any, tenantId: string, ref: string) {
  const column = UUID_RE.test(ref) ? 'id' : 'manufacturer';
  const { data, error } = await admin
    .from('manufacturer_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq(column, ref)
    .maybeSingle();
  return { integration: data ?? null, error: error ?? null };
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
      const { integration } = await resolveIntegration(admin, tenantId, manufacturer);

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
      const { integration, error } = await resolveIntegration(admin, tenantId, manufacturer);

      if (error) {
        console.error('Error loading integration for test:', error);
        return createCorsResponse({ error: 'Failed to load integration' }, 500, req);
      }

      if (!integration) {
        return createCorsResponse({ success: false, message: 'Integration not found' }, 404, req);
      }

      if (!integration.is_active) {
        return createCorsResponse(
          { success: false, connectivityVerified: false, message: 'Integration is inactive' },
          200,
          req,
        );
      }

      // PA-052: this used to answer `success: true, "Connection to X is
      // working"` unconditionally, under a comment saying a real test would go
      // here - so a misconfigured integration reported a working connection.
      // There is no manufacturer API client in this function, so what it can
      // honestly report is what is stored. connectivityVerified stays false.
      const credentials = (integration.credentials ?? {}) as Record<string, unknown>;
      const hasCredentials = Object.values(credentials).some(
        (v) => v !== null && v !== undefined && String(v).trim() !== '',
      );
      const problems: string[] = [];
      if (!hasCredentials) problems.push('no credentials are stored');
      if (!integration.api_endpoint) problems.push('no API endpoint is configured');

      return createCorsResponse(
        {
          success: problems.length === 0,
          connectivityVerified: false,
          lastSync: integration.last_sync ?? null,
          message:
            problems.length === 0
              ? `${integration.manufacturer} is configured (credentials and endpoint present). The connection itself was not tested.`
              : `Configuration incomplete: ${problems.join(', ')}.`,
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // POST /manufacturer-integrations/:id/discover - Discover and register devices
    //
    // PA-054: this answered 501 (PA-052) because the vendor adapters were
    // Node-only and the browser cannot reach Express in production. They are
    // ported to _shared/manufacturer-adapters.ts now - plain fetch and field
    // mapping, no Node built-ins - so discovery runs here.
    if (req.method === 'POST' && manufacturer && endpoint === 'discover') {
      const { integration, error } = await resolveIntegration(admin, tenantId, manufacturer);

      if (error) {
        console.error('Error loading integration for discovery:', error);
        return createCorsResponse({ error: 'Failed to load integration' }, 500, req);
      }
      if (!integration) {
        return createCorsResponse({ error: 'Integration not found' }, 404, req);
      }
      if (!integration.is_active) {
        return createCorsResponse({ error: 'Integration is inactive' }, 400, req);
      }

      let devices: Awaited<ReturnType<ReturnType<typeof createAdapter>['discoverDevices']>>;
      try {
        const adapter = createAdapter(
          integration.manufacturer,
          integration.credentials ?? {},
          integration.api_endpoint || '',
        );
        devices = await adapter.discoverDevices();
      } catch (err) {
        // A vendor API that errors must NOT come back as an empty device list.
        // Every adapter's discoverDevices already swallows its own fetch failure
        // and returns [], which is why this says so explicitly: "registered 0
        // devices" and "could not reach the vendor" are different answers, and
        // the Express version reported them identically.
        console.error('Device discovery failed:', err);
        return createCorsResponse(
          {
            error: 'Device discovery failed',
            details: err instanceof Error ? err.message : String(err),
          },
          502,
          req,
        );
      }

      if (!devices.length) {
        return createCorsResponse(
          {
            registered: 0,
            devices: [],
            message:
              'The integration answered with no devices. That is either an empty fleet or a ' +
              'vendor error the adapter swallowed; check the integration credentials if this is unexpected.',
          },
          200,
          req,
        );
      }

      const adapter = createAdapter(
        integration.manufacturer,
        integration.credentials ?? {},
        integration.api_endpoint || '',
      );

      const rows = [];
      for (const device of devices) {
        try {
          const shaped = await adapter.registerDevice(device);
          rows.push({
            tenant_id: tenantId,
            integration_id: integration.id,
            device_id: String(shaped.deviceId ?? ''),
            device_name: shaped.deviceName ?? null,
            model: shaped.model ?? null,
            serial_number: shaped.serialNumber ?? null,
            ip_address: shaped.ipAddress ?? null,
            mac_address: shaped.macAddress ?? null,
            location: shaped.location ?? null,
            capabilities: shaped.capabilities ?? [],
            status: shaped.status ?? 'unknown',
            last_seen: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Failed to shape a discovered device:', err);
        }
      }

      // device_id is the manufacturer's id and is NOT NULL; a device the adapter
      // could not identify is counted as skipped rather than inserted blank.
      const registrable = rows.filter((r) => r.device_id);

      // NO UPSERT: device_registrations has indexes on (tenant_id, device_id)
      // and integration_id but no UNIQUE constraint, and PostgREST's onConflict
      // needs one. Re-running discovery would otherwise duplicate the whole
      // fleet, so existing ids are read first and updated in place.
      const { data: existing } = await admin
        .from('device_registrations')
        .select('id, device_id')
        .eq('tenant_id', tenantId)
        .eq('integration_id', integration.id);

      const existingByDeviceId = new Map<string, string>(
        (existing || []).map((d: any) => [d.device_id, d.id]),
      );

      let updated = 0;
      let created = 0;
      const toInsert: typeof registrable = [];

      for (const row of registrable) {
        const id = existingByDeviceId.get(row.device_id);
        if (id) {
          const { error: updateError } = await admin
            .from('device_registrations')
            .update({ ...row, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('tenant_id', tenantId);
          if (updateError) {
            console.error('Error updating a discovered device:', updateError);
          } else {
            updated++;
          }
        } else {
          toInsert.push(row);
        }
      }

      if (toInsert.length) {
        const { data: inserted, error: insertError } = await admin
          .from('device_registrations')
          .insert(toInsert)
          .select('id');
        if (insertError) {
          console.error('Error registering devices:', insertError);
          return createCorsResponse(
            {
              error: 'Devices were discovered but could not be registered',
              details: insertError,
              updated,
            },
            500,
            req,
          );
        }
        created = inserted?.length ?? 0;
      }

      return createCorsResponse(
        {
          registered: created + updated,
          created,
          updated,
          skipped: rows.length - registrable.length,
          message: `Discovered ${devices.length} device(s): ${created} new, ${updated} updated.`,
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
