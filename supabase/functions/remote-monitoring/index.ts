// Remote Monitoring Edge Function
// Handles remote device monitoring and alerts
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
    const endpoint = pathParts[1];
    const deviceId = pathParts[2];

    // GET /remote-monitoring/devices - List monitored devices
    if (req.method === 'GET' && endpoint === 'devices') {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');

      let query = admin
        .from('monitored_devices')
        .select(
          `
          *,
          equipment:equipment_id (
            id,
            name,
            serial_number,
            model
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('last_seen', { ascending: false });

      if (status) query = query.eq('status', status);
      if (customerId) query = query.eq('customer_id', customerId);

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
      if (acknowledged === 'false') query = query.eq('acknowledged', false);
      if (acknowledged === 'true') query = query.eq('acknowledged', true);

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

      const { count: onlineDevices } = await admin
        .from('monitored_devices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'online');

      const { count: activeAlerts } = await admin
        .from('device_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('acknowledged', false);

      const { count: criticalAlerts } = await admin
        .from('device_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('acknowledged', false)
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

      const deviceData = {
        tenant_id: tenantId,
        equipment_id: body.equipmentId || body.equipment_id,
        customer_id: body.customerId || body.customer_id,
        ip_address: body.ipAddress || body.ip_address,
        hostname: body.hostname,
        device_type: body.deviceType || body.device_type,
        status: 'pending',
        monitoring_enabled: true,
        poll_interval: body.pollInterval || body.poll_interval || 300,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: device, error } = await admin
        .from('monitored_devices')
        .insert(deviceData)
        .select()
        .single();

      if (error) {
        console.error('Error registering device:', error);
        return createCorsResponse({ error: 'Failed to register device' }, 500, req);
      }

      return createCorsResponse(device, 201, req);
    }

    // POST /remote-monitoring/alerts/:id/acknowledge - Acknowledge alert
    if (
      req.method === 'POST' &&
      endpoint === 'alerts' &&
      deviceId &&
      pathParts[3] === 'acknowledge'
    ) {
      const { data: alert, error } = await admin
        .from('device_alerts')
        .update({
          acknowledged: true,
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
        .eq('id', body.deviceId || body.device_id);

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
