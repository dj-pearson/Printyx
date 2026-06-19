// Client-metrics edge function — CANONICAL agent-ingest path.
//
// EDGE-002j resolution. This function used to be a deprecated stub that
// authenticated via `x-api-key` and wrote a DIVERGENT schema (device_metrics
// columns client_id/metric_type/value/unit; discovered_devices; device_alerts)
// that did not exist on the live tables. The live ingest path ran only through
// server/routes-client-monitoring.ts (Express). This rewrite makes the edge
// function a FAITHFUL port of that Express path so prod (and the eventual
// Express sunset, EDGE-011) have a single, correct implementation.
//
// Decision (EDGE-002j AC #1/#2): EXTEND/repurpose this `client-metrics`
// function as the agent-ingest path (the admin UI path already lives in the
// `monitoring-clients` edge function). The old x-api-key implementation is
// replaced. The companion admin function stays in monitoring-clients/.
//
// Auth: the agent sends `Authorization: Bearer <plainApiKey>` + `x-tenant-id`
// (NOT a Supabase JWT — the bearer is the per-client API key). We SHA-256 the
// bearer and look it up against monitoring_clients.api_key (the hash column),
// exactly like authenticateClient() in routes-client-monitoring.ts. config.toml
// pins this function to `verify_jwt = false` so Supabase's native runtime does
// not reject the API-key bearer before our handler runs (the signup/calculator
// pattern).
//
// ROUTING TOPOLOGY (important): agents POST to their configured `endpoint`
// (PUBLIC_API_BASE_URL — the Express/app host), NOT functions.printyx.net, so
// in the CURRENT deploy the live agent path still hits Express. This edge
// function is the prod-ready replacement for the Express sunset. Per the
// EDGE-002j note, DO NOT add /api/client-metrics to crmProxies — the dev proxy
// must stay off so local agent ingest keeps hitting Express.
//
// Endpoints (paths relative to /client-metrics; the dispatcher in
// supabase/functions/server.ts strips the function name):
//   POST /submit                      ingest a metrics submission (multi-device)
//   POST /heartbeat                   liveness + pull queued commands + update signal
//   GET  /config                      return the client's configuration blob
//   POST /install-report              post-install self-test report
//   POST /commands/:id/ack            agent acks a dispatched command

import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const TONER_WARN = 20;
const TONER_CRIT = 10;
const OFFLINE_SUPPLY_TYPE = 'device';

// ──────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Numeric semver-ish compare. 1 if a>b, -1 if a<b, 0 if equal. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

// Base URL agents should target for /install/* and /api/client-metrics/*.
// MUST resolve to the Express/app host — never the edge host. Mirrors
// monitoring-clients/index.ts platformBaseUrl + EDGE-015.
function platformBaseUrl(req: Request): string {
  const configured = Deno.env.get('PUBLIC_API_BASE_URL');
  if (configured) return configured.replace(/\/$/, '');
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') || url.host;
  return `${proto}://${host}`;
}

// Version the platform currently serves at /install/printyx-client.cjs. Read
// from PRINTYX_CLIENT_AGENT_VERSION, else the baked bundle-manifest.json next
// to the agent bundle (mirrors server/services/client-agent-assets.ts, which
// reads disk on the Express side). Returns null when no bundle ships.
let _versionCache: { value: string | null; at: number } | null = null;
async function getPublishedAgentVersion(): Promise<string | null> {
  const now = Date.now();
  if (_versionCache && now - _versionCache.at < 60_000) return _versionCache.value;
  let version: string | null = Deno.env.get('PRINTYX_CLIENT_AGENT_VERSION') || null;
  if (!version) {
    const bundlePath =
      Deno.env.get('PRINTYX_CLIENT_BUNDLE_PATH') || '/app/printyx-client/dist/printyx-client.cjs';
    const manifestPath = bundlePath.replace(/[^/\\]+$/, 'bundle-manifest.json');
    try {
      const raw = await Deno.readTextFile(manifestPath);
      version = JSON.parse(raw).version || null;
    } catch {
      version = null;
    }
  }
  _versionCache = { value: version, at: now };
  return version;
}

// Build the auto-update signal returned on each heartbeat. The agent uses this
// to self-update. Returns undefined when the platform isn't serving a bundle.
async function buildUpdateSignal(req: Request, client: any) {
  const latestVersion = await getPublishedAgentVersion();
  if (!latestVersion) return undefined;
  const clientVersion = client.version || '0.0.0';
  const cfg = (client.configuration as Record<string, any>) || {};
  const enabled = cfg.autoUpdate !== false; // default ON; per-client opt-out
  const newer = compareVersions(latestVersion, clientVersion) > 0;
  const baseUrl = platformBaseUrl(req);
  return {
    latestVersion,
    available: newer && enabled,
    enabled,
    url: `${baseUrl}/install/printyx-client.cjs`,
  };
}

// Authenticate the agent via Bearer-as-API-key + x-tenant-id. Returns the
// monitoring_clients row or a Response to short-circuit with.
async function authenticateClient(
  req: Request,
  admin: Admin,
): Promise<{ client: any; tenantId: string } | Response> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tenantId = req.headers.get('x-tenant-id');

  if (!apiKey || !tenantId) {
    return createCorsResponse(
      {
        message:
          'Missing authentication credentials. Required: Authorization header with Bearer token and X-Tenant-ID header',
      },
      401,
      req,
    );
  }

  const hashedApiKey = await sha256Hex(apiKey);
  const { data: client, error } = await admin
    .from('monitoring_clients')
    .select('*')
    .eq('api_key', hashedApiKey)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !client) {
    return createCorsResponse({ message: 'Invalid API key or client not found' }, 401, req);
  }
  if (client.status === 'inactive') {
    return createCorsResponse({ message: 'Client is inactive' }, 403, req);
  }
  return { client, tenantId };
}

// Ensure a manufacturer_integrations row exists for this client (custom agents
// are bucketed under the 'printanista' manufacturer). Mirrors the Express
// find-or-create. Returns the integration id.
async function ensureIntegration(admin: Admin, tenantId: string, client: any): Promise<string> {
  const integrationName = `Client: ${client.client_name}`;
  const { data: existing } = await admin
    .from('manufacturer_integrations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('manufacturer', 'printanista')
    .eq('integration_name', integrationName)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await admin
    .from('manufacturer_integrations')
    .insert({
      tenant_id: tenantId,
      manufacturer: 'printanista',
      integration_name: integrationName,
      status: 'active',
      auth_method: 'api_key',
      credentials: { clientId: client.id },
      collection_frequency: 'hourly',
      is_active: true,
    })
    .select('id')
    .single();
  if (error || !created) {
    throw new Error(`Failed to ensure integration: ${error?.message || 'unknown'}`);
  }
  return created.id;
}

interface DesiredAlert {
  alertType: 'low' | 'critical' | 'empty';
  severity: 'warning' | 'critical';
  threshold: number;
  message: string;
}

function computeDesired(supply: string, level: number): DesiredAlert | null {
  if (level === 0) {
    return {
      alertType: 'empty',
      severity: 'critical',
      threshold: 0,
      message: `${supply} is empty (0%)`,
    };
  }
  if (level <= TONER_CRIT) {
    return {
      alertType: 'critical',
      severity: 'critical',
      threshold: TONER_CRIT,
      message: `${supply} critically low (${level}%)`,
    };
  }
  if (level <= TONER_WARN) {
    return {
      alertType: 'low',
      severity: 'warning',
      threshold: TONER_WARN,
      message: `${supply} low (${level}%)`,
    };
  }
  return null;
}

// Materialise supply-level alerts into device_alerts. Faithful port of
// server/services/alert-materializer.ts's insert/update/resolve logic, MINUS
// the maybeAutoOrder side-effect (the auto-order pipeline is a Node-only
// service touching product/inventory/supply-order tables — not portable here).
// DEGRADED: alerts still materialise so the dashboard is correct; auto-order
// stays on the Express path until the EDGE-011 sunset ports it.
async function materializeAlerts(
  admin: Admin,
  tenantId: string,
  deviceId: string,
  tonerLevels: Record<string, unknown>,
  paperLevels: Record<string, unknown>,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const supplies: Array<{ key: string; level: number }> = [];
  for (const [color, raw] of Object.entries(tonerLevels || {})) {
    if (typeof raw !== 'number' || raw < 0 || raw > 100) continue;
    supplies.push({ key: color, level: raw });
  }
  for (const [tray, raw] of Object.entries(paperLevels || {})) {
    if (typeof raw !== 'number' || raw < 0 || raw > 100) continue;
    supplies.push({ key: `paper-${tray}`, level: raw });
  }

  for (const { key, level } of supplies) {
    try {
      const desired = computeDesired(key, level);
      const { data: existing } = await admin
        .from('device_alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('device_id', deviceId)
        .eq('supply_type', key)
        .in('status', ['active', 'acknowledged', 'snoozed'])
        .maybeSingle();

      // Case A: condition cleared → resolve any open alert.
      if (!desired) {
        if (existing) {
          await admin
            .from('device_alerts')
            .update({
              status: 'resolved',
              resolved_at: nowIso,
              current_value: level,
              last_seen_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', existing.id);
        }
        continue;
      }

      // Case B: tripping, no open row → insert. (Auto-order intentionally
      // skipped here — see function header.)
      if (!existing) {
        await admin.from('device_alerts').insert({
          tenant_id: tenantId,
          device_id: deviceId,
          supply_type: key,
          alert_type: desired.alertType,
          severity: desired.severity,
          current_value: level,
          threshold: desired.threshold,
          status: 'active',
          message: desired.message,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
        });
        continue;
      }

      // Case C: tripping, open row exists → refresh; preserve ack/snooze.
      let nextStatus = existing.status;
      if (
        existing.status === 'snoozed' &&
        existing.snoozed_until &&
        new Date(existing.snoozed_until) <= new Date()
      ) {
        nextStatus = 'active';
      }
      await admin
        .from('device_alerts')
        .update({
          alert_type: desired.alertType,
          severity: desired.severity,
          current_value: level,
          threshold: desired.threshold,
          status: nextStatus,
          message: desired.message,
          last_seen_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', existing.id);
    } catch (err) {
      console.warn(
        `[client-metrics] alert materialise failed device=${deviceId} supply=${key}`,
        err,
      );
    }
  }
}

// Resolve any open offline alert the moment a fresh metric arrives. Faithful
// port of offline-detector.ts resolveOfflineFor().
async function resolveOfflineFor(admin: Admin, tenantId: string, deviceId: string): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    await admin
      .from('device_alerts')
      .update({ status: 'resolved', resolved_at: nowIso, last_seen_at: nowIso, updated_at: nowIso })
      .eq('tenant_id', tenantId)
      .eq('device_id', deviceId)
      .eq('supply_type', OFFLINE_SUPPLY_TYPE)
      .in('status', ['active', 'acknowledged', 'snoozed']);
  } catch (err) {
    console.warn('[client-metrics] resolveOfflineFor failed (non-fatal)', err);
  }
}

// ──────────────────────────────────────────────────────────────────────
// handler
// ──────────────────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const admin = createSupabaseServiceClient();
  const url = new URL(req.url);
  const { parts } = normalizePath(url.pathname, 'client-metrics');
  const action = parts[0]; // submit | heartbeat | config | install-report | commands

  // All endpoints authenticate via the per-client API key.
  const auth = await authenticateClient(req, admin);
  if (auth instanceof Response) return auth;
  const { client, tenantId } = auth;

  try {
    // ── POST /submit ──────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'submit') {
      const body = await req.json().catch(() => ({}));
      const devices = Array.isArray(body?.devices) ? body.devices : null;
      if (!devices) {
        return createCorsResponse({ message: 'devices array is required' }, 400, req);
      }

      // Update client heartbeat + version.
      await admin
        .from('monitoring_clients')
        .update({
          last_heartbeat: new Date().toISOString(),
          version: body.clientVersion || client.version,
          updated_at: new Date().toISOString(),
        })
        .eq('id', client.id);

      const integrationId = await ensureIntegration(admin, tenantId, client);

      const processedDevices: Array<{ serialNumber: string; status: string }> = [];
      const errors: Array<{ serialNumber: string; error: string }> = [];

      for (const deviceData of devices) {
        const serialNumber = deviceData?.serialNumber;
        try {
          if (!serialNumber || !deviceData?.collectionTimestamp) {
            throw new Error('serialNumber and collectionTimestamp are required');
          }
          const collectedAt = new Date(deviceData.collectionTimestamp).toISOString();

          // Find or create device registration.
          let { data: device } = await admin
            .from('device_registrations')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('serial_number', serialNumber)
            .maybeSingle();

          if (!device) {
            const { data: created, error: regErr } = await admin
              .from('device_registrations')
              .insert({
                tenant_id: tenantId,
                integration_id: integrationId,
                device_id: serialNumber,
                device_name: deviceData.model || `Device ${serialNumber}`,
                model: deviceData.model || null,
                serial_number: serialNumber,
                ip_address: deviceData.ipAddress || null,
                status: deviceData.deviceStatus || 'online',
                customer_id: client.customer_id || null,
                last_seen: collectedAt,
              })
              .select()
              .single();
            if (regErr || !created)
              throw new Error(regErr?.message || 'device registration failed');
            device = created;

            await admin.from('client_discovered_devices').insert({
              tenant_id: tenantId,
              client_id: client.id,
              ip_address: deviceData.ipAddress || 'unknown',
              mac_address: deviceData.macAddress || null,
              serial_number: serialNumber,
              manufacturer: deviceData.manufacturer || null,
              model: deviceData.model || null,
              protocol: 'snmp',
              is_registered: true,
              registered_device_id: device.id,
              last_seen: collectedAt,
            });
          } else {
            await admin
              .from('device_registrations')
              .update({
                status: deviceData.deviceStatus || device.status,
                last_seen: collectedAt,
                ip_address: deviceData.ipAddress || device.ip_address,
                customer_id: client.customer_id || device.customer_id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', device.id);
          }

          // Insert device metrics.
          await admin.from('device_metrics').insert({
            tenant_id: tenantId,
            device_id: device.id,
            integration_id: integrationId,
            collection_timestamp: collectedAt,
            total_impressions: deviceData.meters?.totalImpressions ?? null,
            bw_impressions: deviceData.meters?.bwImpressions ?? null,
            color_impressions: deviceData.meters?.colorImpressions ?? null,
            large_impressions: deviceData.meters?.largeImpressions ?? null,
            device_status: deviceData.deviceStatus || 'online',
            toner_levels: deviceData.tonerLevels || {},
            paper_levels: deviceData.paperLevels || {},
            error_codes: deviceData.errorCodes || [],
            raw_data: deviceData.rawData || {},
          });

          // Materialise supply alerts (non-fatal) + clear offline alert.
          await materializeAlerts(
            admin,
            tenantId,
            device.id,
            deviceData.tonerLevels || {},
            deviceData.paperLevels || {},
          );
          await resolveOfflineFor(admin, tenantId, device.id);

          processedDevices.push({ serialNumber, status: 'success' });
        } catch (deviceError) {
          errors.push({
            serialNumber: serialNumber || 'unknown',
            error: deviceError instanceof Error ? deviceError.message : 'Unknown error',
          });
        }
      }

      // Update client statistics.
      await admin
        .from('monitoring_clients')
        .update({
          last_successful_collection: new Date().toISOString(),
          total_devices_monitored: processedDevices.length,
          total_metrics_collected:
            (Number(client.total_metrics_collected) || 0) + processedDevices.length,
        })
        .eq('id', client.id);

      await admin.from('client_activity_logs').insert({
        tenant_id: tenantId,
        client_id: client.id,
        activity: 'metrics_submitted',
        status: errors.length > 0 ? 'warning' : 'success',
        message: `Processed ${processedDevices.length} devices, ${errors.length} errors`,
        details: {
          successCount: processedDevices.length,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        },
        devices_in_submission: devices.length,
        metrics_count: processedDevices.length,
      });

      return createCorsResponse(
        {
          message: 'Metrics submitted successfully',
          processed: processedDevices.length,
          errors: errors.length,
          details: { successful: processedDevices, failed: errors },
        },
        200,
        req,
      );
    }

    // ── POST /heartbeat ───────────────────────────────────────────────
    if (req.method === 'POST' && action === 'heartbeat') {
      const nowIso = new Date().toISOString();
      await admin
        .from('monitoring_clients')
        .update({ last_heartbeat: nowIso, updated_at: nowIso })
        .eq('id', client.id);

      // Expire stale commands so the queue self-heals.
      await admin
        .from('client_commands')
        .update({ status: 'expired', completed_at: nowIso })
        .eq('client_id', client.id)
        .in('status', ['queued', 'dispatched'])
        .lte('expires_at', nowIso);

      // Pull queued commands and atomically mark them dispatched.
      const { data: dispatched } = await admin
        .from('client_commands')
        .update({ status: 'dispatched', dispatched_at: nowIso })
        .eq('client_id', client.id)
        .eq('status', 'queued')
        .select('id, command, payload');
      const cmds = dispatched || [];

      await admin.from('client_activity_logs').insert({
        tenant_id: tenantId,
        client_id: client.id,
        activity: 'heartbeat',
        status: 'success',
        message:
          cmds.length > 0
            ? `Heartbeat — dispatched ${cmds.length} command(s)`
            : 'Client heartbeat received',
      });

      return createCorsResponse(
        {
          message: 'Heartbeat received',
          serverTime: nowIso,
          pendingCommands: cmds.map((c: any) => ({
            id: c.id,
            command: c.command,
            payload: c.payload || {},
          })),
          update: await buildUpdateSignal(req, client),
        },
        200,
        req,
      );
    }

    // ── POST /commands/:id/ack ────────────────────────────────────────
    if (req.method === 'POST' && action === 'commands' && parts[2] === 'ack') {
      const commandId = parts[1];
      const body = await req.json().catch(() => ({}));
      const { status, result, errorMessage } = body || {};
      if (status !== 'done' && status !== 'failed') {
        return createCorsResponse({ message: 'status must be "done" or "failed"' }, 400, req);
      }
      const { data: command } = await admin
        .from('client_commands')
        .select('*')
        .eq('id', commandId)
        .eq('client_id', client.id)
        .maybeSingle();
      if (!command) return createCorsResponse({ message: 'Command not found' }, 404, req);
      if (command.status !== 'dispatched') {
        return createCorsResponse(
          { message: `Command is in status '${command.status}', cannot ack` },
          409,
          req,
        );
      }
      await admin
        .from('client_commands')
        .update({
          status,
          completed_at: new Date().toISOString(),
          result: result ?? null,
          error_message: errorMessage ?? null,
        })
        .eq('id', commandId);
      await admin.from('client_activity_logs').insert({
        tenant_id: tenantId,
        client_id: client.id,
        activity: 'command_ack',
        status: status === 'done' ? 'success' : 'error',
        message: `Command '${command.command}' ${status}`,
        details: { commandId, result, errorMessage },
      });
      return createCorsResponse({ message: 'Command ack recorded' }, 200, req);
    }

    // ── GET /config ───────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'config') {
      return createCorsResponse(
        {
          clientId: client.client_id,
          clientName: client.client_name,
          configuration: client.configuration,
          status: client.status,
        },
        200,
        req,
      );
    }

    // ── POST /install-report ──────────────────────────────────────────
    if (req.method === 'POST' && action === 'install-report') {
      const body = await req.json().catch(() => ({}));
      const report = {
        agentVersion: typeof body.agentVersion === 'string' ? body.agentVersion : client.version,
        printersFound: Number(body.printersFound) || 0,
        printersReporting: Number(body.printersReporting) || 0,
        errors: Array.isArray(body.errors) ? body.errors.slice(0, 20).map(String) : [],
        durationMs: Number(body.durationMs) || 0,
        ok: body.ok === true,
        receivedAt: new Date().toISOString(),
      };

      const cfg = (client.configuration as Record<string, unknown>) || {};
      await admin
        .from('monitoring_clients')
        .update({
          configuration: { ...cfg, lastInstallReport: report },
          status: report.printersReporting > 0 ? 'active' : client.status,
          last_heartbeat: new Date().toISOString(),
          version: report.agentVersion || client.version,
          updated_at: new Date().toISOString(),
        })
        .eq('id', client.id);

      await admin.from('client_activity_logs').insert({
        tenant_id: tenantId,
        client_id: client.id,
        activity: 'install_selftest',
        status: report.ok ? 'success' : 'warning',
        message: report.ok
          ? `Install self-test passed — ${report.printersReporting}/${report.printersFound} printers reporting`
          : `Install self-test — ${report.printersReporting}/${report.printersFound} printers reporting`,
        details: { installSelfTest: report },
      });

      return createCorsResponse({ message: 'Install report recorded' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in client-metrics function:', error);
    // Best-effort error activity (mirrors the Express handler).
    try {
      await admin.from('client_activity_logs').insert({
        tenant_id: tenantId,
        client_id: client.id,
        activity: 'metrics_submitted',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { error: String(error) },
        error_code: 'SUBMISSION_ERROR',
      });
    } catch {
      /* swallow */
    }
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
