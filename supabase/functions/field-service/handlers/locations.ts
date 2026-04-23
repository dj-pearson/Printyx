// GPS tracking — technician locations + history + ticket timeline.
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
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy ?? null,
      speed: body.speed ?? null,
      heading: body.heading ?? null,
      ticket_id: body.ticketId ?? body.ticket_id ?? null,
      customer_id: body.customerId ?? body.customer_id ?? null,
      device_id: body.deviceId ?? body.device_id ?? null,
      activity_type: body.activityType ?? body.activity_type ?? null,
    };
    if (!row.technician_id || row.latitude === undefined || row.longitude === undefined) {
      return errorResponse(400, 'technician_id, latitude, longitude required', req, {
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }
    const { data, error } = await db.from('location_history').insert(row).select().maybeSingle();
    if (error) return dbErr(req, requestId, 'Failed to append history', error);
    return jsonResponse(data, 201, req, requestId);
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
      await db.from('location_history').insert({
        tenant_id: auth.tenantId,
        technician_id: techId,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.accuracy,
        speed: row.speed,
        heading: row.heading,
        ticket_id: row.current_ticket_id,
        customer_id: row.current_customer_id,
        device_id: row.device_id,
      });

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
    const [history, events] = await Promise.all([
      db
        .from('location_history')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('ticket_id', ticketId)
        .order('timestamp', { ascending: true }),
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
