// GPS tracking — technician locations + history + ticket timeline.
//
// AUDIT-037: location_history is a bare GPS trail - technician_id, session_id,
// lat/lng, accuracy, address, timestamp, speed, heading - and this file wrote
// ticket_id, customer_id, device_id and activity_type onto it, so every append
// 42703'd. The context those four carry lives on technician_locations, which
// does have current_ticket_id, current_customer_id and device_id.
//
// The ticket link is NOT missing, which is why no column was added for it:
// location_history.session_id references mobile_service_sessions, whose
// service_ticket_id is NOT NULL. The timeline resolves ticket -> sessions ->
// history now, which is the model the schema already expresses and cannot
// drift from the session's own ticket the way a copied column would.
//
// Paths (full dispatcher pathParts):
//   GET   /technicians/locations                    — list all current locations
//   GET   /technicians/:id/location                 — current location
//   PUT   /technicians/:id/location                 — write location (real-time path)
//   GET   /technicians/nearby                       — ?lat&lng&radiusKm
//   GET   /technicians/:id/history                  — location_history
//   POST  /location-history                         — append history row
//   GET   /locations/status/:status                 — filter by tech status
//   GET   /tickets/:ticketId/activity-timeline      — aggregate view
//
// Performance note: write path is idempotent per technician_id — uses upsert
// on (tenant_id, technician_id) so the row stays single-per-tech; history
// append is separate so the full trail is preserved.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { dbErr } from '../_crud.ts';

export async function handleLocations(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId, url } = ctx;

  // /location-history (append)
  if (pathParts[0] === 'location-history' && method === 'POST') {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });
    const row = {
      tenant_id: auth.tenantId,
      technician_id: body.technicianId ?? body.technician_id,
      session_id: body.sessionId ?? body.session_id ?? null,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy ?? null,
      address: body.address ?? null,
      speed: body.speed ?? null,
      heading: body.heading ?? null,
    };
    if (!row.technician_id || row.latitude === undefined || row.longitude === undefined) {
      return errorResponse(400, 'technician_id, latitude, longitude required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('location_history').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to append history', error);

    // Reported rather than dropped silently. Pass sessionId to tie a ping to a
    // ticket - the session carries service_ticket_id - and the technician's
    // current ticket, customer and device live on technician_locations.
    const ignored = ['ticketId', 'customerId', 'deviceId', 'activityType'].filter(
      (k) =>
        body[k] !== undefined ||
        body[k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())] !== undefined,
    );
    return jsonResponse(
      ignored.length > 0
        ? {
            ...(data as Record<string, unknown>),
            unpersisted: ignored.map(
              (k) => `${k}: location_history is a GPS trail; pass sessionId to link a ticket`,
            ),
          }
        : data,
      201,
      req,
      requestId,
    );
  }

  // /technicians/locations — list all current
  if (pathParts[0] === 'technicians' && pathParts[1] === 'locations' && method === 'GET') {
    const { data, error } = await db
      .from('technician_locations')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('updated_at', { ascending: false });
    if (error) return dbErr(req, requestId, 'Failed to fetch locations', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // /technicians/nearby
  if (pathParts[0] === 'technicians' && pathParts[1] === 'nearby' && method === 'GET') {
    const lat = parseFloat(url.searchParams.get('lat') ?? '');
    const lng = parseFloat(url.searchParams.get('lng') ?? '');
    const radiusKm = parseFloat(url.searchParams.get('radiusKm') ?? '25') || 25;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return errorResponse(400, 'lat and lng required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db
      .from('technician_locations')
      .select('*')
      .eq('tenant_id', auth.tenantId);
    if (error) return dbErr(req, requestId, 'Failed to fetch nearby', error);
    // Filter in JS by great-circle distance (no PostGIS dependency). For
    // large tenants (>500 techs), move this to a PL/pgSQL function.
    const nearby = ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => ({
        ...row,
        distance_km: haversineKm(lat, lng, Number(row.latitude), Number(row.longitude)),
      }))
      .filter((r) => r.distance_km <= radiusKm)
      .sort((a, b) => (a.distance_km as number) - (b.distance_km as number));
    return jsonResponse(nearby, 200, req, requestId);
  }

  // /technicians/:id/location or /:id/history
  if (pathParts[0] === 'technicians' && pathParts[1] && pathParts[2] === 'location') {
    const techId = pathParts[1];
    if (method === 'GET') {
      const { data, error } = await db
        .from('technician_locations')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('technician_id', techId)
        .maybeSingle();
      if (error) return dbErr(req, requestId, 'Failed to fetch location', error);
      if (!data)
        return errorResponse(404, 'Location not found', req, { code: 'NOT_FOUND', requestId });
      return jsonResponse(data, 200, req, requestId);
    }
    if (method === 'PUT') {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body)
        return errorResponse(400, 'Invalid JSON', req, { code: 'INVALID_JSON', requestId });

      const row: Record<string, unknown> = {
        tenant_id: auth.tenantId,
        technician_id: techId,
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy: body.accuracy ?? null,
        altitude: body.altitude ?? null,
        heading: body.heading ?? null,
        speed: body.speed ?? null,
        status: body.status ?? 'active',
        is_moving: body.isMoving ?? body.is_moving ?? null,
        battery_level: body.batteryLevel ?? body.battery_level ?? null,
        current_ticket_id: body.currentTicketId ?? body.current_ticket_id ?? null,
        current_customer_id: body.currentCustomerId ?? body.current_customer_id ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        zip_code: body.zipCode ?? body.zip_code ?? null,
        device_id: body.deviceId ?? body.device_id ?? null,
        app_version: body.appVersion ?? body.app_version ?? null,
        timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (row.latitude === undefined || row.longitude === undefined) {
        return errorResponse(400, 'latitude and longitude required', req, {
          code: 'VALIDATION_ERROR',
          requestId,
        });
      }

      // Upsert on (tenant_id, technician_id) — single row per tech.
      // Fall back to check-then-insert if the DB lacks the unique constraint.
      const { data: existing } = await db
        .from('technician_locations')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('technician_id', techId)
        .maybeSingle();

      let result;
      if (existing?.id) {
        result = await db
          .from('technician_locations')
          .update(row)
          .eq('id', existing.id)
          .select()
          .maybeSingle();
      } else {
        result = await db.from('technician_locations').insert(row).select().maybeSingle();
      }
      if (result.error) return dbErr(req, requestId, 'Failed to write location', result.error);

      // Also append to history for trail analytics.
      //
      // This is the real-time path, so it is the one that has actually been
      // failing: it wrote ticket_id, customer_id and device_id, which
      // location_history does not have, and discarded the error entirely - so
      // every ping since this was written returned 200 and stored nothing, and
      // the trail is empty. The current ticket, customer and device are on the
      // technician_locations row this handler just wrote; the history row is
      // the position.
      //
      // session_id is passed through when the caller supplies it. It is not
      // looked up here: resolving a session per ping is a query on a real-time
      // path, and the caller already knows which session it is in. A ping
      // written without one will not appear in a ticket's activity timeline.
      const { error: historyError } = await db.from('location_history').insert({
        tenant_id: auth.tenantId,
        technician_id: techId,
        session_id: body.sessionId ?? body.session_id ?? null,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.accuracy,
        speed: row.speed,
        heading: row.heading,
      });
      if (historyError) {
        // The current position is written and that is what the caller asked
        // for, so this does not fail the request - but it is never silent.
        console.error('[field-service] location_history append failed', historyError);
      }

      return jsonResponse(result.data, 200, req, requestId);
    }
  }

  // /technicians/:id/history
  if (
    pathParts[0] === 'technicians' &&
    pathParts[1] &&
    pathParts[2] === 'history' &&
    method === 'GET'
  ) {
    const techId = pathParts[1];
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10) || 200, 1000);
    const { data, error } = await db
      .from('location_history')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('technician_id', techId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) return dbErr(req, requestId, 'Failed to fetch history', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // /locations/status/:status
  if (
    pathParts[0] === 'locations' &&
    pathParts[1] === 'status' &&
    pathParts[2] &&
    method === 'GET'
  ) {
    const { data, error } = await db
      .from('technician_locations')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('status', pathParts[2]);
    if (error) return dbErr(req, requestId, 'Failed to fetch by status', error);
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // /tickets/:ticketId/activity-timeline — aggregate location_history +
  // geofence_events for a ticket, ordered chronologically.
  if (
    pathParts[0] === 'tickets' &&
    pathParts[1] &&
    pathParts[2] === 'activity-timeline' &&
    method === 'GET'
  ) {
    const ticketId = pathParts[1];

    // location_history has no ticket_id. It hangs off a session, and the
    // session names the ticket, so the trail is resolved through that rather
    // than filtered on a column this table has never had.
    const { data: sessionRows } = await db
      .from('mobile_service_sessions')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .eq('service_ticket_id', ticketId);
    const sessionIds = ((sessionRows ?? []) as Array<{ id: string }>).map((r) => r.id);

    const [history, events] = await Promise.all([
      sessionIds.length > 0
        ? db
            .from('location_history')
            .select('*')
            .eq('tenant_id', auth.tenantId)
            .in('session_id', sessionIds)
            .order('timestamp', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      db
        .from('geofence_events')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
    ]);

    const timeline = [
      ...((history.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        kind: 'location',
        at: r.timestamp ?? r.created_at,
        ...r,
      })),
      ...((events.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        kind: 'geofence_event',
        at: r.created_at,
        ...r,
      })),
    ].sort((a, b) => new Date(String(a.at)).getTime() - new Date(String(b.at)).getTime());
    return jsonResponse({ ticketId, timeline }, 200, req, requestId);
  }

  return null;
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
