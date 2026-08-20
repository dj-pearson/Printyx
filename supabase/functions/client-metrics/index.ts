// DEPRECATED — DO NOT EXTEND.
//
// This edge function predates the consolidated ingest path. The live
// /api/client-metrics/{submit,heartbeat,config} handlers live in
// server/routes-client-monitoring.ts (Express) and authenticate against
// monitoring_clients.api_key (SHA-256). This function uses a divergent
// auth header (x-api-key vs Bearer) and a divergent schema (snake_case
// monitoring_clients vs camelCase). It is retained for backwards
// compatibility with anything that may still call it directly. New
// integrations MUST use the Express endpoints documented in
// printyx-client/AUDIT.md.
//
// To remove: confirm no DNS or proxy rule routes /functions/v1/client-metrics
// to this function, then delete the directory.
import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /client-metrics, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'client-metrics');
    const action = parts[0]; // submit, heartbeat, config

    // Authenticate client via API key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return createCorsResponse({ error: 'API key required' }, 401, req);
    }

    // Verify API key and get client
    const { data: client } = await admin
      .from('monitoring_clients')
      // COP-M01: monitoring_clients names these configuration and last_heartbeat.
      .select('id, tenant_id, customer_id, configuration, status')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (!client) {
      return createCorsResponse({ error: 'Invalid or inactive API key' }, 401, req);
    }

    // POST /client-metrics/submit - Submit device metrics
    // COP-M01, and this one is NOT a rename. The agent posts a generic
    // measurement — { deviceId, serialNumber, metricType, value, unit, metadata,
    // collectedAt } — but device_metrics is a FIXED-SHAPE meter snapshot:
    // device_id, integration_id, collection_timestamp, total_impressions,
    // bw_impressions, color_impressions, large_impressions, device_status,
    // toner_levels, paper_levels, error_codes, response_time, uptime, raw_data.
    // There is no metric_type/value/unit triple and no client_id at all, so
    // every submitted metric has been failing to insert. device_alerts is the
    // same story (no client_id, serial_number or metadata).
    //
    // Mapping one onto the other means deciding which metric names become which
    // impression counters and how an agent's client is resolved to a device —
    // a product decision, not a substitution — so it is left named here rather
    // than guessed at. The two clean renames in this file (configuration,
    // last_heartbeat, first_seen_at) ARE fixed.
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
        .update({ last_heartbeat: new Date().toISOString() })
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
          last_heartbeat: new Date().toISOString(),
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
          config: client.configuration || {
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
              last_heartbeat: new Date().toISOString(),
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
            // device_alerts records first_seen_at, not triggered_at.
            first_seen_at: alert.triggeredAt || new Date().toISOString(),
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
