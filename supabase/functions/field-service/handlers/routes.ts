// Routes (route_assignments) + route deviations + optimize.
//
// Paths (dispatcher passes full parts):
//   /routes                             — list + CRUD
//   /routes/:id
//   /routes/:id/start
//   /routes/:id/complete
//   /routes/:id/progress (PATCH)
//   /routes/:id/reoptimize
//   /deviations                         — list (?unresolved=true)
//   /deviations/unresolved
//   /deviations/:id[/acknowledge|/resolve]
//   /optimize                           — POST — compute order for a set of stops
//   /multi-technician                   — POST — assign stops across multiple techs

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { dbErr } from '../_crud.ts';

export async function handleRoutes(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const first = pathParts[0];

  if (first === 'routes')
    return await handleRouteCrud(req, { ...ctx, pathParts: pathParts.slice(1) });
  if (first === 'deviations')
    return await handleDeviations(req, { ...ctx, pathParts: pathParts.slice(1) });
  if (first === 'optimize' && method === 'POST') return await optimize(req, ctx);
  if (first === 'multi-technician' && method === 'POST') return await multiTechnician(req, ctx);
  return null;
}

// ─── Route CRUD + actions ────────────────────────────────────────────────────

async function handleRouteCrud(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const id = pathParts[0];
  const action = pathParts[1];

  // Actions
  if (method === 'POST' && id && action === 'start') {
    const { data, error } = await db
      .from('route_assignments')
      .update({
        route_status: 'in_progress',
        route_start_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to start route', error);
    if (!data) return errorResponse(404, 'Route not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && id && action === 'complete') {
    const now = new Date().toISOString();
    const { data: existing } = await db
      .from('route_assignments')
      .select('route_start_time')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    const duration = existing?.route_start_time
      ? Math.round((Date.now() - new Date(existing.route_start_time as string).getTime()) / 60000)
      : null;
    const { data, error } = await db
      .from('route_assignments')
      .update({
        route_status: 'completed',
        route_end_time: now,
        actual_duration: duration,
        updated_at: now,
      })
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to complete route', error);
    if (!data) return errorResponse(404, 'Route not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if ((method === 'PATCH' || method === 'PUT') && id && action === 'progress') {
    const body = (await req.json().catch(() => ({}))) as {
      completedStops?: number;
      completed_stops?: number;
    };
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.completedStops !== undefined || body.completed_stops !== undefined) {
      update.completed_stops = body.completedStops ?? body.completed_stops;
    }
    const { data, error } = await db
      .from('route_assignments')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update progress', error);
    if (!data) return errorResponse(404, 'Route not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && id && action === 'reoptimize') {
    // Reoptimize — reorder waypoints using the simple nearest-neighbor below.
    const { data: route } = await db
      .from('route_assignments')
      .select('waypoints, start_location')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (!route) return errorResponse(404, 'Route not found', req, { code: 'NOT_FOUND', requestId });
    const waypoints = (route.waypoints ?? []) as Array<{ latitude: number; longitude: number }>;
    const startLoc = (route.start_location ?? null) as {
      latitude: number;
      longitude: number;
    } | null;
    const reordered = nearestNeighbor(startLoc, waypoints);
    const { data, error } = await db
      .from('route_assignments')
      .update({
        waypoints: reordered,
        optimized_route: true,
        optimization_algorithm: 'nearest_neighbor',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to reoptimize', error);
    return jsonResponse(data, 200, req, requestId);
  }

  // Core CRUD
  if (method === 'GET' && !id) {
    const { data, error } = await db
      .from('route_assignments')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('route_date', { ascending: false })
      .limit(500);
    if (error) return dbErr(req, requestId, 'Failed to fetch routes', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id && !action) {
    const { data, error } = await db
      .from('route_assignments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch route', error);
    if (!data) return errorResponse(404, 'Route not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapRoute(body);
    row.tenant_id = auth.tenantId;
    row.created_by = auth.userId;
    if (
      !row.technician_id ||
      !row.route_name ||
      !row.route_date ||
      !row.waypoints ||
      row.total_stops === undefined
    ) {
      return errorResponse(
        400,
        'technician_id, route_name, route_date, waypoints, total_stops required',
        req,
        {
          code: 'VALIDATION_ERROR',
          requestId,
        },
      );
    }
    const { data, error } = await db.from('route_assignments').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create route', error);
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PUT' || method === 'PATCH') && id && !action) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = mapRoute(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('route_assignments')
      .update(row)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to update route', error);
    if (!data) return errorResponse(404, 'Route not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && id && !action) {
    const { error } = await db
      .from('route_assignments')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to delete route', error);
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

function mapRoute(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (c: string, s: string) => body[c] ?? body[s];
  const set = (col: string, camel: string, snake: string) => {
    const v = src(camel, snake);
    if (v !== undefined) r[col] = v;
  };
  set('technician_id', 'technicianId', 'technician_id');
  set('route_name', 'routeName', 'route_name');
  set('route_date', 'routeDate', 'route_date');
  set('route_status', 'routeStatus', 'route_status');
  if (body.waypoints !== undefined) r.waypoints = body.waypoints;
  set('total_stops', 'totalStops', 'total_stops');
  set('optimized_route', 'optimizedRoute', 'optimized_route');
  set('optimization_algorithm', 'optimizationAlgorithm', 'optimization_algorithm');
  set('total_distance', 'totalDistance', 'total_distance');
  set('estimated_duration', 'estimatedDuration', 'estimated_duration');
  set('start_location', 'startLocation', 'start_location');
  set('end_location', 'endLocation', 'end_location');
  if (body.notes !== undefined) r.notes = body.notes;
  return r;
}

// ─── Deviations ──────────────────────────────────────────────────────────────

async function handleDeviations(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const id = pathParts[0];
  const action = pathParts[1];

  if (method === 'GET' && id === 'unresolved') {
    const { data, error } = await db
      .from('route_deviations')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('resolved', false)
      .order('detected_at', { ascending: false })
      .limit(500);
    if (error) return dbErr(req, requestId, 'Failed to fetch unresolved deviations', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'POST' && id && action === 'acknowledge') {
    const now = new Date().toISOString();
    const { data, error } = await db
      .from('route_deviations')
      .update({ acknowledged: true, acknowledged_at: now, acknowledged_by: auth.userId })
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to acknowledge', error);
    if (!data)
      return errorResponse(404, 'Deviation not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && id && action === 'resolve') {
    const body = (await req.json().catch(() => ({}))) as { resolutionNotes?: string };
    const { data, error } = await db
      .from('route_deviations')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_notes: body.resolutionNotes ?? null,
      })
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to resolve', error);
    if (!data)
      return errorResponse(404, 'Deviation not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'GET' && !id) {
    const { data, error } = await db
      .from('route_deviations')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('detected_at', { ascending: false })
      .limit(500);
    if (error) return dbErr(req, requestId, 'Failed to fetch deviations', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && id && !action) {
    const { data, error } = await db
      .from('route_deviations')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to fetch deviation', error);
    if (!data)
      return errorResponse(404, 'Deviation not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !id) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row: Record<string, unknown> = {
      tenant_id: auth.tenantId,
      route_id: body.routeId ?? body.route_id,
      technician_id: body.technicianId ?? body.technician_id,
      deviation_type: body.deviationType ?? body.deviation_type,
      severity: body.severity,
      deviation_location: body.deviationLocation ?? body.deviation_location,
      intended_location: body.intendedLocation ?? body.intended_location ?? null,
      deviation_distance: body.deviationDistance ?? body.deviation_distance ?? null,
      delay_minutes: body.delayMinutes ?? body.delay_minutes ?? null,
      affected_ticket_id: body.affectedTicketId ?? body.affected_ticket_id ?? null,
      reason: body.reason ?? null,
    };
    if (
      !row.route_id ||
      !row.technician_id ||
      !row.deviation_type ||
      !row.severity ||
      !row.deviation_location
    ) {
      return errorResponse(
        400,
        'route_id, technician_id, deviation_type, severity, deviation_location required',
        req,
        { code: 'VALIDATION_ERROR', requestId },
      );
    }
    const { data, error } = await db.from('route_deviations').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to create deviation', error);
    return jsonResponse(data, 201, req, requestId);
  }

  return null;
}

// ─── Optimize — nearest-neighbor ─────────────────────────────────────────────

async function optimize(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { requestId } = ctx;
  const body = (await req.json().catch(() => null)) as {
    start?: { latitude: number; longitude: number };
    stops?: Array<{ latitude: number; longitude: number; [k: string]: unknown }>;
  } | null;
  if (!Array.isArray(body?.stops) || body!.stops.length === 0) {
    return errorResponse(400, 'stops array required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }
  const ordered = nearestNeighbor(body!.start ?? null, body!.stops);
  return jsonResponse(
    {
      orderedStops: ordered,
      algorithm: 'nearest_neighbor',
      totalDistanceKm: totalDistanceKm(body!.start ?? null, ordered),
      stub: false,
    },
    200,
    req,
    requestId,
  );
}

async function multiTechnician(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { requestId } = ctx;
  const body = (await req.json().catch(() => null)) as {
    technicians?: Array<{ id: string; startLocation?: { latitude: number; longitude: number } }>;
    stops?: Array<{ latitude: number; longitude: number; [k: string]: unknown }>;
  } | null;
  if (!Array.isArray(body?.technicians) || body!.technicians.length === 0) {
    return errorResponse(400, 'technicians array required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }
  if (!Array.isArray(body?.stops) || body!.stops.length === 0) {
    return errorResponse(400, 'stops array required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  // Round-robin assignment as a baseline, then per-technician nearest-neighbor.
  const buckets: Record<string, typeof body.stops> = {};
  body!.technicians.forEach((t) => (buckets[t.id] = []));
  body!.stops.forEach((stop, i) => {
    const techId = body!.technicians[i % body!.technicians.length].id;
    buckets[techId].push(stop);
  });

  const assignments = body!.technicians.map((tech) => ({
    technicianId: tech.id,
    orderedStops: nearestNeighbor(tech.startLocation ?? null, buckets[tech.id] ?? []),
  }));

  return jsonResponse(
    { algorithm: 'round_robin + nearest_neighbor', assignments },
    200,
    req,
    requestId,
  );
}

interface Point {
  latitude: number;
  longitude: number;
  [k: string]: unknown;
}

function nearestNeighbor<T extends Point>(
  start: { latitude: number; longitude: number } | null,
  stops: T[],
): T[] {
  if (stops.length === 0) return [];
  const remaining = [...stops];
  const ordered: T[] = [];
  let cur = start ?? remaining[0];
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(
        cur.latitude,
        cur.longitude,
        remaining[i].latitude,
        remaining[i].longitude,
      );
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    cur = next;
  }
  return ordered;
}

function totalDistanceKm(
  start: { latitude: number; longitude: number } | null,
  stops: Array<{ latitude: number; longitude: number }>,
): number {
  if (stops.length === 0) return 0;
  let total = 0;
  let cur = start ?? stops[0];
  const iter = start ? stops : stops.slice(1);
  for (const s of iter) {
    total += haversineKm(cur.latitude, cur.longitude, s.latitude, s.longitude);
    cur = s;
  }
  return Number(total.toFixed(2));
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
