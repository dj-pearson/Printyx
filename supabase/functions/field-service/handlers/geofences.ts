// Geofences CRUD + process-event + geofence_events queries.
//
// Hit-testing uses bounding-box math (circles + polygon centroids) in JS —
// no PostGIS dependency. Good enough for tenant-scoped fleet sizes.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { crud, dbErr } from '../_crud.ts';

export async function handleGeofences(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;
  const first = pathParts[0];

  // POST /process-event
  if (method === 'POST' && first === 'process-event') {
    return await processEvent(req, ctx);
  }

  // POST /check-dwell — stub (no geofence_dwell_sessions table)
  if (method === 'POST' && first === 'check-dwell') {
    return jsonResponse(
      {
        stub: true,
        message: 'Dwell check requires a geofence_dwell_sessions table — deferred to follow-up.',
        dwelling: false,
      },
      200,
      req,
      requestId,
    );
  }

  // /geofence-events
  if (first === 'geofence-events') {
    return await handleEvents(req, { ...ctx, pathParts: pathParts.slice(1) });
  }

  // /technicians/:id/events and /tickets/:id/events
  if (first === 'technicians' && pathParts[1] && pathParts[2] === 'events' && method === 'GET') {
    const { data, error } = await db
      .from('geofence_events')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('technician_id', pathParts[1])
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return dbErr(req, requestId, 'Failed to fetch events', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /geofences/check — test a lat/lng against tenant geofences
  if (method === 'POST' && first === 'check') {
    const body = (await req.json().catch(() => ({}))) as { latitude?: number; longitude?: number };
    if (body.latitude === undefined || body.longitude === undefined) {
      return errorResponse(400, 'latitude and longitude required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data } = await db
      .from('geofences')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('is_active', true);
    const hits = ((data ?? []) as Array<Record<string, unknown>>).filter((g) =>
      pointInGeofence(Number(body.latitude), Number(body.longitude), g),
    );
    return jsonResponse({ hits }, 200, req, requestId);
  }

  // /geofences CRUD — /geofences/* stripped, pathParts already contains id or empty
  return crud(
    req,
    { ...ctx, pathParts: pathParts },
    {
      table: 'geofences',
      defaultOrder: { column: 'name', ascending: true },
      queryFilters: [
        { param: 'isActive', column: 'is_active', type: 'bool' },
        { param: 'customerId', column: 'customer_id' },
      ],
      stamps: { tenantId: true, createdBy: 'created_by' },
      updateStamps: { updatedAt: true },
      requiredOnCreate: ['name', 'geofence_type', 'center_latitude', 'center_longitude'],
      mapRow: (b) => {
        const src = (c: string, s: string) => b[c] ?? b[s];
        const r: Record<string, unknown> = {};
        const set = (col: string, camel: string, snake: string) => {
          const v = src(camel, snake);
          if (v !== undefined) r[col] = v;
        };
        if (b.name !== undefined) r.name = b.name;
        if (b.description !== undefined) r.description = b.description;
        set('geofence_type', 'geofenceType', 'geofence_type');
        set('center_latitude', 'centerLatitude', 'center_latitude');
        set('center_longitude', 'centerLongitude', 'center_longitude');
        set('radius_meters', 'radiusMeters', 'radius_meters');
        set('polygon_coordinates', 'polygonCoordinates', 'polygon_coordinates');
        set('customer_id', 'customerId', 'customer_id');
        set('location_id', 'locationId', 'location_id');
        set('trigger_on_entry', 'triggerOnEntry', 'trigger_on_entry');
        set('trigger_on_exit', 'triggerOnExit', 'trigger_on_exit');
        set('trigger_on_dwell', 'triggerOnDwell', 'trigger_on_dwell');
        set('dwell_time_minutes', 'dwellTimeMinutes', 'dwell_time_minutes');
        set('is_active', 'isActive', 'is_active');
        if (b.notes !== undefined) r.notes = b.notes;
        return r;
      },
    },
  );
}

// ─── geofence_events subresource ─────────────────────────────────────────────

async function handleEvents(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;

  if (method === 'GET' && !pathParts[0]) {
    let q = db.from('geofence_events').select('*').eq('tenant_id', auth.tenantId);
    const geofenceId = url.searchParams.get('geofenceId') ?? url.searchParams.get('geofence_id');
    const technicianId =
      url.searchParams.get('technicianId') ?? url.searchParams.get('technician_id');
    if (geofenceId) q = q.eq('geofence_id', geofenceId);
    if (technicianId) q = q.eq('technician_id', technicianId);
    q = q.order('created_at', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) return dbErr(req, requestId, 'Failed to fetch events', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'POST' && !pathParts[0]) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = {
      tenant_id: auth.tenantId,
      geofence_id: body.geofenceId ?? body.geofence_id,
      technician_id: body.technicianId ?? body.technician_id,
      event_type: body.eventType ?? body.event_type,
      event_location: body.eventLocation ?? body.event_location,
      ticket_id: body.ticketId ?? body.ticket_id ?? null,
      route_id: body.routeId ?? body.route_id ?? null,
      entry_time: body.entryTime ?? body.entry_time ?? null,
      exit_time: body.exitTime ?? body.exit_time ?? null,
      dwell_duration: body.dwellDuration ?? body.dwell_duration ?? null,
      device_id: body.deviceId ?? body.device_id ?? null,
    };
    if (!row.geofence_id || !row.technician_id || !row.event_type || !row.event_location) {
      return errorResponse(
        400,
        'geofence_id, technician_id, event_type, event_location required',
        req,
        {
          code: 'VALIDATION_ERROR',
          requestId,
        },
      );
    }
    const { data, error } = await db.from('geofence_events').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create event', error);
    return jsonResponse(data, 201, req, requestId);
  }

  return null;
}

// ─── process-event (on location ping) ────────────────────────────────────────
// Accepts a location reading, matches against active geofences, emits enter/exit
// events, and returns what fired.

async function processEvent(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => ({}))) as {
    technicianId?: string;
    technician_id?: string;
    latitude?: number;
    longitude?: number;
    ticketId?: string;
    ticket_id?: string;
    routeId?: string;
    route_id?: string;
  };
  const techId = body.technicianId ?? body.technician_id;
  const lat = body.latitude;
  const lng = body.longitude;
  if (!techId || lat === undefined || lng === undefined) {
    return errorResponse(400, 'technicianId, latitude, longitude required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  const { data: fences } = await db
    .from('geofences')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true);

  const matches = ((fences ?? []) as Array<Record<string, unknown>>).filter((g) =>
    pointInGeofence(Number(lat), Number(lng), g),
  );

  // For each match, record an 'entry' event. True enter/exit detection would
  // compare against previous location — that's a follow-up when dwell
  // sessions land. For now each match emits one event.
  const eventRows = matches.map((g) => ({
    tenant_id: auth.tenantId,
    geofence_id: g.id,
    technician_id: techId,
    event_type: 'inside',
    event_location: { latitude: lat, longitude: lng },
    ticket_id: body.ticketId ?? body.ticket_id ?? null,
    route_id: body.routeId ?? body.route_id ?? null,
  }));

  let recorded: unknown[] = [];
  if (eventRows.length > 0) {
    const { data } = await db.from('geofence_events').insert(eventRows).select();
    recorded = data ?? [];
  }

  return jsonResponse(
    { matched: matches.length, events: recorded, geofences: matches },
    200,
    req,
    requestId,
  );
}

// ─── Hit testing ─────────────────────────────────────────────────────────────

function pointInGeofence(lat: number, lng: number, fence: Record<string, unknown>): boolean {
  if (fence.geofence_type === 'polygon' && Array.isArray(fence.polygon_coordinates)) {
    return pointInPolygon(lat, lng, fence.polygon_coordinates as Array<[number, number]>);
  }
  // Default: circle — radius in meters.
  const centerLat = Number(fence.center_latitude);
  const centerLng = Number(fence.center_longitude);
  const radiusM = Number(fence.radius_meters ?? 0);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || radiusM <= 0) return false;
  const d = haversineKm(lat, lng, centerLat, centerLng) * 1000;
  return d <= radiusM;
}

function pointInPolygon(lat: number, lng: number, poly: Array<[number, number]>): boolean {
  // Ray casting. Poly points expected as [lat, lng] pairs.
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
