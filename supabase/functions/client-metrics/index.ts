// Client Metrics Edge Function
// Handles metrics submission from monitoring clients
import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[1]; // submit, heartbeat, config

    // Authenticate client via API key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return createCorsResponse({ error: 'API key required' }, 401, req);
    }

    // Verify API key and get client
    const { data: client } = await admin
      .from('monitoring_clients')
      .select('id, tenant_id, customer_id, config, status')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (!client) {
      return createCorsResponse({ error: 'Invalid or inactive API key' }, 401, req);
    }

    // POST /client-metrics/submit - Submit device metrics
    if (req.method === 'POST' && action === 'submit') {
      const body = await req.json();
      const metrics = body.metrics || [body];

      const insertedMetrics = [];

      for (const metric of metrics) {
        const { data, error } = await admin
          .from('device_metrics')
          .insert({
            tenant_id: client.tenant_id,
            client_id: client.id,
            device_id: metric.deviceId || metric.device_id,
            serial_number: metric.serialNumber || metric.serial_number,
            metric_type: metric.metricType || metric.metric_type,
            value: metric.value,
            unit: metric.unit,
            metadata: metric.metadata || {},
            collected_at: metric.collectedAt || metric.collected_at || new Date().toISOString(),
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          insertedMetrics.push(data);
        }
      }

      // Update client last_seen
      await admin
        .from('monitoring_clients')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', client.id);

      return createCorsResponse(
        {
          success: true,
          received: metrics.length,
          processed: insertedMetrics.length,
        },
        200,
        req,
      );
    }

    // POST /client-metrics/heartbeat - Client heartbeat
    if (req.method === 'POST' && action === 'heartbeat') {
      const body = await req.json();

      await admin
        .from('monitoring_clients')
        .update({
          last_seen_at: new Date().toISOString(),
          last_heartbeat: {
            timestamp: new Date().toISOString(),
            version: body.version,
            device_count: body.deviceCount || body.device_count,
            status: body.status || 'healthy',
          },
        })
        .eq('id', client.id);

      return createCorsResponse(
        {
          success: true,
          timestamp: new Date().toISOString(),
        },
        200,
        req,
      );
    }

    // GET /client-metrics/config - Get client configuration
    if (req.method === 'GET' && action === 'config') {
      return createCorsResponse(
        {
          clientId: client.id,
          config: client.config || {
            pollInterval: 300, // 5 minutes
            metricsToCollect: ['toner_levels', 'page_counts', 'status'],
            alertThresholds: {
              toner_low: 20,
              toner_critical: 10,
            },
          },
        },
        200,
        req,
      );
    }

    // POST /client-metrics/devices - Submit discovered devices
    if (req.method === 'POST' && action === 'devices') {
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
              device_type: device.deviceType || device.device_type || 'printer',
              hostname: device.hostname,
              status: device.status || 'online',
              capabilities: device.capabilities || {},
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
          devices: processedDevices,
        },
        200,
        req,
      );
    }

    // POST /client-metrics/alerts - Submit alerts
    if (req.method === 'POST' && action === 'alerts') {
      const body = await req.json();
      const alerts = body.alerts || [body];

      const processedAlerts = [];

      for (const alert of alerts) {
        const { data, error } = await admin
          .from('device_alerts')
          .insert({
            tenant_id: client.tenant_id,
            client_id: client.id,
            device_id: alert.deviceId || alert.device_id,
            serial_number: alert.serialNumber || alert.serial_number,
            alert_type: alert.alertType || alert.alert_type,
            severity: alert.severity || 'warning',
            message: alert.message,
            metadata: alert.metadata || {},
            triggered_at: alert.triggeredAt || new Date().toISOString(),
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && data) {
          processedAlerts.push(data);
        }
      }

      return createCorsResponse(
        {
          success: true,
          processed: processedAlerts.length,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in client-metrics function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
