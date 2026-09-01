/**
 * Device monitoring read/action API (AUDIT-029).
 *
 * Four routed pages call this prefix - DeviceMonitoring (/device-monitoring),
 * SupplyRunway (/supply-runway), SupplyOrders (/supply-orders) and
 * FleetMonitoringDashboard (/fleet-monitoring) - and until this function existed
 * there was no edge function of that name, no proxy entry and no server.ts
 * alias, so every one of their nine calls 404'd in production. Dev reaches it
 * through the crmProxies entry, so there is no Express copy to diverge from.
 *
 * THE PROJECTION IS SHARED, NOT REIMPLEMENTED. The pages read flat keys that no
 * table stores under those names - tonerBlack, serialNumber, currentLevel - so
 * the shaping is the contract, and _shared/device-monitoring-shape.ts is the one
 * definition of it. The Express router imports the same functions.
 *
 * TWO THINGS POSTGREST CANNOT DO THE WAY SQL DID:
 *
 *   DISTINCT ON. The latest metric per device came from
 *   `SELECT DISTINCT ON (device_id) ... ORDER BY device_id, collection_timestamp
 *   DESC`. Ordering by the same two columns and keeping the first row per device
 *   is exactly equivalent, which is what latestPerDevice() does - but only under
 *   that ordering, so do not reorder the query without reading its comment.
 *
 *   The LEFT JOIN onto device_registrations is an embed here. That is only
 *   possible because device_metrics.device_id, device_alerts.device_id and
 *   device_supply_orders.device_id each carry a declared FK to
 *   device_registrations.id (migration 0000 and 0008); PostgREST embeds across
 *   declared foreign keys and nothing else.
 *
 * `manufacturer` is NOT selected. device_registrations has no such column - the
 * Express queries asked for one and Postgres answered "column r.manufacturer
 * does not exist", which is why three of these endpoints were a 500 in dev on
 * top of a 404 in production.
 */
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { getRoleLevel } from '../_shared/rbac.ts';
import { createAdapter } from '../_shared/manufacturer-adapters.ts';
import {
  shapeMetricForUi,
  decorateAlert,
  latestPerDevice,
  forecastSupplies,
  buildFleetDashboard,
  enrichDeviceWithMetrics,
  OPEN_ALERT_STATUSES,
} from '../_shared/device-monitoring-shape.ts';

const REGISTRATION_FIELDS = 'serial_number, ip_address, device_name, model';

// deno-lint-ignore no-explicit-any
type Admin = any;

/** The registration embedded by a PostgREST join, whatever alias it arrives under. */
// deno-lint-ignore no-explicit-any
function embeddedRegistration(row: any) {
  return row?.device_registrations ?? null;
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
      return createCorsResponse({ message: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');
    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    // Level 3 and above, mirroring what navigation-permissions.ts already
    // applies to the three pages that call this (/device-monitoring,
    // /supply-runway, /supply-orders all sit at minLevel 3). A LEVEL check
    // rather than a permission code on purpose: per SEC-EDGE-002 the codes the
    // Express gates name are not the codes any seeder creates, so copying one
    // across would deny everyone below platform admin.
    const roleLevel = getRoleLevel({
      userId: user.id,
      tenantId,
      email: user.email,
      jwt: jwt ?? '',
      // deno-lint-ignore no-explicit-any
      supabaseUser: user as any,
    });
    if (roleLevel < 3) {
      return createCorsResponse(
        { message: 'Requires role level 3 or higher', code: 'INSUFFICIENT_ROLE' },
        403,
        req,
      );
    }

    const admin: Admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'device-monitoring');
    const resource = parts[0];
    const method = req.method.toUpperCase();

    // ─── GET /latest-metrics ────────────────────────────────────────────────
    if (method === 'GET' && resource === 'latest-metrics') {
      const { data, error } = await admin
        .from('device_metrics')
        .select(`*, device_registrations(${REGISTRATION_FIELDS})`)
        .eq('tenant_id', tenantId)
        .order('device_id', { ascending: true })
        .order('collection_timestamp', { ascending: false })
        .limit(5000);

      if (error) return dbError(req, 'Failed to fetch latest metrics', error);

      const metrics = latestPerDevice(data ?? []).map((row: any) =>
        shapeMetricForUi(row, embeddedRegistration(row)),
      );
      return createCorsResponse({ metrics }, 200, req);
    }

    // ─── GET /statistics ────────────────────────────────────────────────────
    //
    // No client tree calls this today, but it is the same roll-up the header
    // badge would use, and leaving one endpoint behind is how a prefix ends up
    // half-served. `activeAlerts` deliberately excludes snoozed: the badge
    // counts what needs attention now, and a snoozed alert is one somebody has
    // already decided about.
    if (method === 'GET' && resource === 'statistics') {
      const [metricsRes, alertsRes] = await Promise.all([
        admin
          .from('device_metrics')
          .select('device_id, device_status, total_impressions')
          .eq('tenant_id', tenantId)
          .order('device_id', { ascending: true })
          .order('collection_timestamp', { ascending: false })
          .limit(5000),
        admin
          .from('device_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['active', 'acknowledged']),
      ]);

      if (metricsRes.error) return dbError(req, 'Failed to fetch statistics', metricsRes.error);

      const latest = latestPerDevice(metricsRes.data ?? []);
      let online = 0;
      let totalImpressions = 0;
      for (const row of latest as any[]) {
        if (row.device_status === 'online') online += 1;
        if (typeof row.total_impressions === 'number') totalImpressions += row.total_impressions;
      }

      return createCorsResponse(
        {
          statistics: {
            totalDevices: latest.length,
            onlineDevices: online,
            totalImpressions,
            activeAlerts: alertsRes.count ?? 0,
          },
        },
        200,
        req,
      );
    }

    // ─── GET /active-alerts ─────────────────────────────────────────────────
    if (method === 'GET' && resource === 'active-alerts') {
      const { data, error } = await admin
        .from('device_alerts')
        .select(`*, device_registrations(serial_number, device_name)`)
        .eq('tenant_id', tenantId)
        .in('status', [...OPEN_ALERT_STATUSES])
        .order('severity', { ascending: false })
        .order('last_seen_at', { ascending: false })
        .limit(1000);

      if (error) return dbError(req, 'Failed to fetch active alerts', error);

      const alerts = (data ?? []).map((row: any) => decorateAlert(row, embeddedRegistration(row)));
      return createCorsResponse({ alerts }, 200, req);
    }

    // ─── GET /supply-forecast ───────────────────────────────────────────────
    if (method === 'GET' && resource === 'supply-forecast') {
      const windowDays = Math.min(
        Math.max(Number(url.searchParams.get('windowDays')) || 14, 3),
        90,
      );
      const lowOnly = url.searchParams.get('lowOnly') === 'true';
      const serialFilter = url.searchParams.get('serialNumber') || undefined;
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

      let query = admin
        .from('device_metrics')
        .select(
          `device_id, collection_timestamp, toner_levels, device_registrations(${REGISTRATION_FIELDS})`,
        )
        .eq('tenant_id', tenantId)
        .gte('collection_timestamp', since)
        .order('device_id', { ascending: true })
        .order('collection_timestamp', { ascending: true })
        .limit(20000);

      // An embedded filter (`!inner`) is the only way to restrict on a joined
      // column; without the bang PostgREST would return every device with a
      // null registration rather than none.
      if (serialFilter) {
        query = admin
          .from('device_metrics')
          .select(
            `device_id, collection_timestamp, toner_levels, device_registrations!inner(${REGISTRATION_FIELDS})`,
          )
          .eq('tenant_id', tenantId)
          .eq('device_registrations.serial_number', serialFilter)
          .gte('collection_timestamp', since)
          .order('device_id', { ascending: true })
          .order('collection_timestamp', { ascending: true })
          .limit(20000);
      }

      const { data, error } = await query;
      if (error) return dbError(req, 'Failed to compute supply forecast', error);

      const forecasts = forecastSupplies(
        (data ?? []).map((row: any) => {
          const reg = embeddedRegistration(row);
          return {
            deviceId: row.device_id,
            collectionTimestamp: row.collection_timestamp,
            tonerLevels: row.toner_levels,
            serialNumber: reg?.serial_number ?? null,
            deviceName: reg?.device_name ?? null,
            manufacturer: null,
            model: reg?.model ?? null,
          };
        }),
        { windowDays, lowOnly },
      );
      return createCorsResponse({ windowDays, forecasts }, 200, req);
    }

    // ─── GET /supply-orders ─────────────────────────────────────────────────
    if (method === 'GET' && resource === 'supply-orders' && !parts[1]) {
      const status = url.searchParams.get('status');
      let query = admin
        .from('device_supply_orders')
        .select(`*, device_registrations(${REGISTRATION_FIELDS})`)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) return dbError(req, 'Failed to fetch supply orders', error);

      const orders = (data ?? []).map((row: any) => {
        const reg = embeddedRegistration(row);
        return {
          id: row.id,
          tenantId: row.tenant_id,
          customerId: row.customer_id,
          deviceId: row.device_id,
          alertId: row.alert_id,
          supplyType: row.supply_type,
          productSku: row.product_sku,
          productName: row.product_name,
          quantity: row.quantity,
          unitPrice: row.unit_price,
          totalPrice: row.total_price,
          status: row.status,
          triggeredBy: row.triggered_by,
          createdAt: row.created_at,
          approvedAt: row.approved_at,
          orderedAt: row.ordered_at,
          cancelledAt: row.cancelled_at,
          notes: row.notes,
          device: {
            serialNumber: reg?.serial_number ?? null,
            deviceName: reg?.device_name ?? null,
            model: reg?.model ?? null,
          },
        };
      });
      return createCorsResponse({ orders }, 200, req);
    }

    // ─── GET /devices ───────────────────────────────────────────────────────
    //
    // PA-054: the page's list and per-device metrics called /api/devices, a
    // prefix neither host proxies, so both 404'd in production. Serving them
    // here keeps the whole page on the function that owns these two tables.
    if (method === 'GET' && resource === 'devices' && !parts[1]) {
      const integrationId = url.searchParams.get('integrationId');

      let query = admin
        .from('device_registrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('last_seen', { ascending: false, nullsFirst: false })
        .limit(500);

      if (integrationId) query = query.eq('integration_id', integrationId);

      const { data, error } = await query;
      if (error) return dbError(req, 'Failed to fetch devices', error);

      return createCorsResponse(data ?? [], 200, req);
    }

    // ─── GET /devices/:id/metrics ───────────────────────────────────────────
    if (method === 'GET' && resource === 'devices' && parts[1] && parts[2] === 'metrics') {
      const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 1000);

      const { data, error } = await admin
        .from('device_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('device_id', parts[1])
        .order('collection_timestamp', { ascending: false })
        .limit(limit);

      if (error) return dbError(req, 'Failed to fetch device metrics', error);

      return createCorsResponse(data ?? [], 200, req);
    }

    // ─── POST /devices/:id/collect ──────────────────────────────────────────
    //
    // PA-054: the page called /api/devices/:id/collect, a prefix neither host
    // proxies, so it 404'd in production and was served in dev by a handler in
    // routes-manufacturer-integration.ts that runs the Node-only adapters. This
    // is the same capability on the function that already owns
    // device_registrations and device_metrics (AUDIT-031).
    if (method === 'POST' && resource === 'devices' && parts[1] && parts[2] === 'collect') {
      const registrationId = parts[1];

      const { data: registration, error: regError } = await admin
        .from('device_registrations')
        .select('id, device_id, integration_id, serial_number')
        .eq('id', registrationId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (regError) return dbError(req, 'Failed to load device', regError);
      if (!registration) {
        return createCorsResponse({ message: 'Device not found' }, 404, req);
      }

      const { data: integration } = await admin
        .from('manufacturer_integrations')
        .select('id, manufacturer, credentials, api_endpoint, is_active')
        .eq('id', registration.integration_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!integration) {
        return createCorsResponse(
          { message: 'The device is not linked to a manufacturer integration' },
          409,
          req,
        );
      }
      if (!integration.is_active) {
        return createCorsResponse({ message: 'Integration is inactive' }, 400, req);
      }

      let metrics: Record<string, any>;
      try {
        const adapter = createAdapter(
          integration.manufacturer,
          integration.credentials ?? {},
          integration.api_endpoint || '',
        );
        // The adapter is asked for the MANUFACTURER's device id, not our row id.
        metrics = await adapter.collectMetrics(registration.device_id);
      } catch (err) {
        // collectMetrics rethrows on a vendor failure, unlike discoverDevices.
        // A failed collection must not be written as a reading of zero.
        console.error('Metric collection failed:', err);
        return createCorsResponse(
          {
            message: 'Metric collection failed',
            details: err instanceof Error ? err.message : String(err),
          },
          502,
          req,
        );
      }

      const { data: inserted, error: insertError } = await admin
        .from('device_metrics')
        .insert({
          tenant_id: tenantId,
          device_id: registration.id,
          integration_id: integration.id,
          collection_timestamp: new Date().toISOString(),
          total_impressions: metrics.totalImpressions ?? null,
          bw_impressions: metrics.bwImpressions ?? null,
          color_impressions: metrics.colorImpressions ?? null,
          large_impressions: metrics.largeImpressions ?? null,
          toner_levels: metrics.tonerLevels ?? {},
          paper_levels: metrics.paperLevels ?? {},
          error_codes: metrics.errorCodes ?? null,
          response_time: metrics.responseTime ?? null,
          uptime: metrics.uptime ?? null,
          raw_data: metrics.rawData ?? metrics,
        })
        .select('id, collection_timestamp')
        .single();

      if (insertError) return dbError(req, 'Failed to record metrics', insertError);

      await admin
        .from('device_registrations')
        .update({ last_seen: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', registration.id)
        .eq('tenant_id', tenantId);

      return createCorsResponse(
        { metricId: inserted.id, collectedAt: inserted.collection_timestamp },
        200,
        req,
      );
    }

    // ─── GET /device/:serialNumber/{history,alerts} ─────────────────────────
    if (method === 'GET' && resource === 'device' && parts[1]) {
      const serialNumber = decodeURIComponent(parts[1]);
      const sub = parts[2];

      const { data: registration } = await admin
        .from('device_registrations')
        .select(`id, ${REGISTRATION_FIELDS}`)
        .eq('tenant_id', tenantId)
        .eq('serial_number', serialNumber)
        .maybeSingle();

      // An unknown serial is an empty list, not a 404: the pages poll this and a
      // device that has not registered yet is a normal state, not an error.
      if (!registration) {
        return createCorsResponse(sub === 'alerts' ? { alerts: [] } : { metrics: [] }, 200, req);
      }

      if (sub === 'alerts') {
        const includeResolved = url.searchParams.get('includeResolved') === 'true';
        const statuses = includeResolved
          ? [...OPEN_ALERT_STATUSES, 'resolved']
          : [...OPEN_ALERT_STATUSES];
        const { data, error } = await admin
          .from('device_alerts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('device_id', registration.id)
          .in('status', statuses)
          .order('last_seen_at', { ascending: false })
          .limit(200);
        if (error) return dbError(req, 'Failed to fetch device alerts', error);
        return createCorsResponse(
          { alerts: (data ?? []).map((row: any) => decorateAlert(row, registration)) },
          200,
          req,
        );
      }

      const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 1000);
      const { data, error } = await admin
        .from('device_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('device_id', registration.id)
        .order('collection_timestamp', { ascending: false })
        .limit(limit);
      if (error) return dbError(req, 'Failed to fetch device history', error);
      return createCorsResponse(
        { metrics: (data ?? []).map((row: any) => shapeMetricForUi(row, registration)) },
        200,
        req,
      );
    }

    // ─── GET /fleet-dashboard ───────────────────────────────────────────────
    //
    // FleetMonitoringDashboard used to call /api/fleet/dashboard. That prefix
    // belongs to supabase/functions/fleet/, which is about VEHICLES - so in
    // production the page got a 200 of vehicle counts under keys it does not
    // read, and /api/fleet/devices 404'd because that function has no such
    // branch. Two domains sharing one prefix word is worse than a missing route:
    // nothing errors, the page just renders zeroes. It lives here because this
    // is the function that already owns device_registrations, device_metrics
    // and device_alerts.
    if (method === 'GET' && resource === 'fleet-dashboard') {
      const [regRes, metricRes, alertRes] = await Promise.all([
        admin
          .from('device_registrations')
          .select('id, device_name, serial_number, status')
          .eq('tenant_id', tenantId)
          .limit(5000),
        admin
          .from('device_metrics')
          .select('device_id, bw_impressions, color_impressions, collection_timestamp')
          .eq('tenant_id', tenantId)
          .order('device_id', { ascending: true })
          .order('collection_timestamp', { ascending: false })
          .limit(5000),
        admin
          .from('device_alerts')
          .select('device_id, supply_type, severity, current_value, message, status')
          .eq('tenant_id', tenantId)
          .in('status', [...OPEN_ALERT_STATUSES])
          .limit(1000),
      ]);

      if (regRes.error) return dbError(req, 'Failed to fetch fleet devices', regRes.error);
      if (metricRes.error) return dbError(req, 'Failed to fetch fleet metrics', metricRes.error);
      if (alertRes.error) return dbError(req, 'Failed to fetch fleet alerts', alertRes.error);

      return createCorsResponse(
        buildFleetDashboard(
          regRes.data ?? [],
          latestPerDevice(metricRes.data ?? []),
          alertRes.data ?? [],
        ),
        200,
        req,
      );
    }

    // ─── GET /fleet-devices, GET /fleet-devices/:id/metrics ─────────────────
    if (method === 'GET' && resource === 'fleet-devices') {
      const deviceRowId = parts[1];

      if (deviceRowId && parts[2] === 'metrics') {
        const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 1000);
        const { data: registration } = await admin
          .from('device_registrations')
          .select(`id, ${REGISTRATION_FIELDS}, status, location, last_seen`)
          .eq('tenant_id', tenantId)
          .eq('id', deviceRowId)
          .maybeSingle();
        if (!registration) {
          return createCorsResponse({ message: 'Device not found' }, 404, req);
        }
        const { data, error } = await admin
          .from('device_metrics')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('device_id', deviceRowId)
          .order('collection_timestamp', { ascending: false })
          .limit(limit);
        if (error) return dbError(req, 'Failed to fetch device metrics', error);
        const metrics = (data ?? []).map((row: any) => shapeMetricForUi(row, registration));
        return createCorsResponse(
          { device: registration, metrics, totalReadings: metrics.length },
          200,
          req,
        );
      }

      if (deviceRowId) return createCorsResponse({ message: 'Endpoint not found' }, 404, req);

      // No search or status parameter. The page filters the list it already has,
      // and its query key is joined into the URL by the default queryFn - so a
      // search term passed as a key element would arrive as a path SEGMENT and
      // hit the branch above as a device id. Accepting a parameter nothing sends
      // is how a filter comes to look supported.
      const [regRes, metricRes] = await Promise.all([
        admin
          .from('device_registrations')
          .select(`id, ${REGISTRATION_FIELDS}, status, location, last_seen`)
          .eq('tenant_id', tenantId)
          .order('last_seen', { ascending: false, nullsFirst: false })
          .limit(5000),
        admin
          .from('device_metrics')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('device_id', { ascending: true })
          .order('collection_timestamp', { ascending: false })
          .limit(5000),
      ]);
      if (regRes.error) return dbError(req, 'Failed to fetch fleet devices', regRes.error);
      if (metricRes.error) return dbError(req, 'Failed to fetch fleet metrics', metricRes.error);

      const byDevice = new Map<string, any>();
      for (const row of latestPerDevice(metricRes.data ?? []) as any[]) {
        byDevice.set(String(row.device_id), row);
      }
      const devices = (regRes.data ?? []).map((reg: any) =>
        enrichDeviceWithMetrics(reg, byDevice.get(String(reg.id)) ?? null),
      );

      return createCorsResponse(devices, 200, req);
    }

    // ─── POST /fleet-devices/:id/order-toner ────────────────────────────────
    //
    // The page used to post this to /api/devices/:id/order-toner, whose handler
    // inserted device_id / order_type / items / requested_by into supply_orders.
    // supply_orders has none of those columns (it is machine_id / color /
    // part_number / quantity / created_by_user_id, with machine_id NOT NULL), so
    // every order was a PGRST204 the handler reported as "Failed to create toner
    // order". Ordering toner from this screen has never worked. Rows go to
    // device_supply_orders, the table the rest of this surface approves and
    // cancels, one per colour so each can be fulfilled or cancelled on its own.
    if (
      method === 'POST' &&
      resource === 'fleet-devices' &&
      parts[1] &&
      parts[2] === 'order-toner'
    ) {
      const deviceRowId = parts[1];
      const body = await req.json().catch(() => ({}));
      const colors: string[] = Array.isArray(body?.colors)
        ? body.colors.filter((c: unknown) => typeof c === 'string' && c.trim() !== '')
        : [];
      if (colors.length === 0) {
        return createCorsResponse({ message: 'At least one toner colour is required' }, 400, req);
      }

      const { data: registration } = await admin
        .from('device_registrations')
        .select('id, customer_id')
        .eq('tenant_id', tenantId)
        .eq('id', deviceRowId)
        .maybeSingle();
      if (!registration) {
        return createCorsResponse({ message: 'Device not found' }, 404, req);
      }

      const notes = [
        typeof body?.notes === 'string' ? body.notes : '',
        body?.urgent ? 'Marked urgent by requester' : '',
      ]
        .filter(Boolean)
        .join(' - ');

      const { data, error } = await admin
        .from('device_supply_orders')
        .insert(
          colors.map((color) => ({
            tenant_id: tenantId,
            device_id: deviceRowId,
            customer_id: registration.customer_id ?? null,
            supply_type: color,
            quantity: 1,
            status: 'pending',
            triggered_by: 'manual',
            triggered_by_user_id: user.id,
            notes: notes || null,
          })),
        )
        .select();

      if (error) return dbError(req, 'Failed to create toner order', error);
      return createCorsResponse({ orders: data ?? [] }, 201, req);
    }

    // ─── POST /alerts/:id/{acknowledge,snooze,resolve} ──────────────────────
    if (method === 'POST' && resource === 'alerts' && parts[1] && parts[2]) {
      return await alertAction(req, admin, tenantId, user.id, parts[1], parts[2]);
    }

    // ─── POST /supply-orders/:id/{approve,cancel} ───────────────────────────
    if (method === 'POST' && resource === 'supply-orders' && parts[1] && parts[2]) {
      return await orderAction(req, admin, tenantId, user.id, parts[1], parts[2]);
    }

    return createCorsResponse({ message: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in device-monitoring function:', error);
    return createCorsResponse({ message: 'Internal server error' }, 500, req);
  }
}

function dbError(req: Request, message: string, error: unknown): Response {
  console.error(message + ':', error);
  return createCorsResponse({ message }, 500, req);
}

/**
 * Acknowledge, snooze or resolve. All three refuse a resolved alert with 409
 * rather than silently doing nothing, and acknowledging twice is a no-op, which
 * is what the Express versions did.
 */
async function alertAction(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  alertId: string,
  action: string,
): Promise<Response> {
  const { data: alert } = await admin
    .from('device_alerts')
    .select('id, status')
    .eq('id', alertId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!alert) return createCorsResponse({ message: 'Alert not found' }, 404, req);
  if (alert.status === 'resolved') {
    return createCorsResponse({ message: 'Alert already resolved' }, 409, req);
  }

  const now = new Date().toISOString();

  if (action === 'acknowledge') {
    const { error } = await admin
      .from('device_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: now,
        acknowledged_by: userId,
        updated_at: now,
      })
      .eq('id', alert.id);
    if (error) return dbError(req, 'Failed to acknowledge alert', error);
    return createCorsResponse({ message: 'Acknowledged' }, 200, req);
  }

  if (action === 'snooze') {
    const body = (await req.json().catch(() => ({}))) as { hours?: number };
    // One hour minimum, one week maximum - the Express bounds.
    const hours = Math.min(Math.max(Number(body?.hours) || 4, 1), 24 * 7);
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { error } = await admin
      .from('device_alerts')
      .update({ status: 'snoozed', snoozed_until: until, updated_at: now })
      .eq('id', alert.id);
    if (error) return dbError(req, 'Failed to snooze alert', error);
    return createCorsResponse({ message: 'Snoozed', snoozedUntil: until }, 200, req);
  }

  if (action === 'resolve') {
    const { error } = await admin
      .from('device_alerts')
      .update({ status: 'resolved', resolved_at: now, updated_at: now })
      .eq('id', alert.id);
    if (error) return dbError(req, 'Failed to resolve alert', error);
    return createCorsResponse({ message: 'Resolved' }, 200, req);
  }

  return createCorsResponse({ message: 'Unknown alert action' }, 404, req);
}

/** Approve or cancel a supply order. Only a pending order can be approved. */
async function orderAction(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  orderId: string,
  action: string,
): Promise<Response> {
  const { data: order } = await admin
    .from('device_supply_orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!order) return createCorsResponse({ message: 'Order not found' }, 404, req);

  const now = new Date().toISOString();

  if (action === 'approve') {
    if (order.status !== 'pending') {
      return createCorsResponse(
        { message: `Cannot approve an order that is ${order.status}` },
        409,
        req,
      );
    }
    const { error } = await admin
      .from('device_supply_orders')
      .update({ status: 'approved', approved_at: now, approved_by: userId, updated_at: now })
      .eq('id', order.id);
    if (error) return dbError(req, 'Failed to approve order', error);
    return createCorsResponse({ message: 'Approved' }, 200, req);
  }

  if (action === 'cancel') {
    if (order.status === 'cancelled') {
      return createCorsResponse({ message: 'Order already cancelled' }, 409, req);
    }
    const { error } = await admin
      .from('device_supply_orders')
      .update({ status: 'cancelled', cancelled_at: now, updated_at: now })
      .eq('id', order.id);
    if (error) return dbError(req, 'Failed to cancel order', error);
    return createCorsResponse({ message: 'Cancelled' }, 200, req);
  }

  return createCorsResponse({ message: 'Unknown order action' }, 404, req);
}
