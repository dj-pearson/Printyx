// Remote Monitoring Edge Function
// Handles remote device monitoring and alerts
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { tenantFromJwt } from '../_shared/resolve-tenant.ts';

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

    // CR-010: service client bypasses RLS — derive tenant from the verified JWT
    // app_metadata ONLY (never user_metadata / x-tenant-id header, both spoofable).
    const tenantId = tenantFromJwt(user);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /remote-monitoring, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'remote-monitoring');
    const endpoint = parts[0];
    const deviceId = parts[1];

    // GET /remote-monitoring/devices - List monitored devices
    if (req.method === 'GET' && endpoint === 'devices') {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');

      // monitored_devices has no equipment_id, so the equipment embed failed the
      // WHOLE query — the device list never loaded. It also has no status column
      // and names the customer client_id. The device row already carries
      // serial_number, manufacturer and model, so the embed had nothing to add.
      let query = admin
        .from('monitored_devices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('last_seen', { ascending: false });

      // Reachability is not stored as a status string: `enabled` says whether
      // the device is polled and consecutive_failures says whether polling is
      // currently working.
      if (status === 'online') query = query.eq('enabled', true).eq('consecutive_failures', 0);
      if (status === 'offline') query = query.gt('consecutive_failures', 0);
      if (status === 'disabled') query = query.eq('enabled', false);
      if (customerId) query = query.eq('client_id', customerId);

      const { data: devices, error } = await query;

      if (error) {
        console.error('Error fetching monitored devices:', error);
        return createCorsResponse({ error: 'Failed to fetch devices' }, 500, req);
      }

      return createCorsResponse(devices || [], 200, req);
    }

    // GET /remote-monitoring/alerts - Get active alerts
    if (req.method === 'GET' && endpoint === 'alerts') {
      const severity = url.searchParams.get('severity');
      const acknowledged = url.searchParams.get('acknowledged');

      let query = admin
        .from('device_alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (severity) query = query.eq('severity', severity);
      // device_alerts records WHEN an alert was acknowledged (acknowledged_at /
      // acknowledged_by); there is no boolean `acknowledged` column, so both of
      // these filters 42703'd.
      if (acknowledged === 'false') query = query.is('acknowledged_at', null);
      if (acknowledged === 'true') query = query.not('acknowledged_at', 'is', null);

      const { data: alerts, error } = await query.limit(100);

      if (error) {
        console.error('Error fetching alerts:', error);
        return createCorsResponse({ error: 'Failed to fetch alerts' }, 500, req);
      }

      return createCorsResponse(alerts || [], 200, req);
    }

    // GET /remote-monitoring/status - Get overall monitoring status
    if (req.method === 'GET' && endpoint === 'status') {
      const { count: totalDevices } = await admin
        .from('monitored_devices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      // "Online" is derived, not stored: a device being polled with no run of
      // failures behind it. The old .eq('status','online') was a 42703, so this
      // dashboard reported zero devices online however many were up.
      const { count: onlineDevices } = await admin
        .from('monitored_devices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('enabled', true)
        .eq('consecutive_failures', 0);

      const { count: activeAlerts } = await admin
        .from('device_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('acknowledged_at', null);

      const { count: criticalAlerts } = await admin
        .from('device_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('acknowledged_at', null)
        .eq('severity', 'critical');

      return createCorsResponse(
        {
          totalDevices: totalDevices || 0,
          onlineDevices: onlineDevices || 0,
          offlineDevices: (totalDevices || 0) - (onlineDevices || 0),
          activeAlerts: activeAlerts || 0,
          criticalAlerts: criticalAlerts || 0,
          healthScore: totalDevices ? Math.round(((onlineDevices || 0) / totalDevices) * 100) : 100,
        },
        200,
        req,
      );
    }

    // GET /remote-monitoring/devices/:id - Get device details
    if (req.method === 'GET' && endpoint === 'devices' && deviceId) {
      const { data: device, error } = await admin
        .from('monitored_devices')
        .select('*')
        .eq('id', deviceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Device not found' }, 404, req);
      }

      // Get recent readings
      const { data: readings } = await admin
        .from('device_readings')
        .select('*')
        .eq('device_id', deviceId)
        .order('timestamp', { ascending: false })
        .limit(100);

      // Get recent alerts
      const { data: alerts } = await admin
        .from('device_alerts')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(20);

      return createCorsResponse(
        { ...device, readings: readings || [], alerts: alerts || [] },
        200,
        req,
      );
    }

    // POST /remote-monitoring/devices - Register device for monitoring
    if (req.method === 'POST' && endpoint === 'devices') {
      const body = await req.json();

      // Seven of this payload's names were phantom — equipment_id, customer_id,
      // device_type, status, monitoring_enabled, poll_interval and created_at —
      // so registering a device always failed. Only customer_id and status were
      // visible to check:phantom-cols, the payload being a named variable. The
      // real columns are client_id, enabled, polling_interval and added_at, and
      // a device identifies its hardware directly (serial_number, manufacturer,
      // model) rather than through an equipment FK.
      const deviceData = {
        tenant_id: tenantId,
        client_id: body.customerId || body.customer_id || body.clientId || null,
        serial_number: body.serialNumber || body.serial_number || null,
        ip_address: body.ipAddress || body.ip_address,
        hostname: body.hostname,
        device_name: body.deviceName || body.device_name || null,
        manufacturer: body.manufacturer ?? null,
        model: body.model ?? null,
        enabled: true,
        polling_interval: body.pollInterval || body.poll_interval || 300,
        added_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const unpersisted = [];
      if (body.equipmentId || body.equipment_id) {
        unpersisted.push(
          'equipmentId: monitored_devices has no equipment FK; identify the device by serial_number',
        );
      }
      if (body.deviceType || body.device_type) {
        unpersisted.push('deviceType: monitored_devices has no device_type column');
      }

      const { data: device, error } = await admin
        .from('monitored_devices')
        .insert(deviceData)
        .select()
        .single();

      if (error) {
        console.error('Error registering device:', error);
        return createCorsResponse({ error: 'Failed to register device' }, 500, req);
      }

      return createCorsResponse(
        unpersisted.length > 0 ? { ...device, unpersisted } : device,
        201,
        req,
      );
    }

    // POST /remote-monitoring/alerts/:id/acknowledge - Acknowledge alert
    if (req.method === 'POST' && endpoint === 'alerts' && deviceId && parts[2] === 'acknowledge') {
      const { data: alert, error } = await admin
        .from('device_alerts')
        // acknowledged_at being set IS the acknowledgement; there is no boolean
        // column, so this update 42703'd and no alert could be acknowledged.
        .update({
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', deviceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to acknowledge alert' }, 500, req);
      }

      return createCorsResponse(alert, 200, req);
    }

    // POST /remote-monitoring/readings - Record device reading (webhook endpoint)
    if (req.method === 'POST' && endpoint === 'readings') {
      const body = await req.json();

      const { data: reading, error } = await admin
        .from('device_readings')
        .insert({
          tenant_id: tenantId,
          device_id: body.deviceId || body.device_id,
          reading_type: body.readingType || body.reading_type,
          value: body.value,
          unit: body.unit,
          metadata: body.metadata || {},
          timestamp: body.timestamp || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to record reading' }, 500, req);
      }

      // Update device last_seen
      await admin
        .from('monitored_devices')
        .update({ last_seen: new Date().toISOString(), status: 'online' })
        .eq('id', body.deviceId || body.device_id)
        .eq('tenant_id', tenantId); // CR-002: scope device update to caller's tenant

      return createCorsResponse(reading, 201, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in remote-monitoring function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
