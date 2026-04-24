// Calendar events CRUD + availability — /meetings/calendar/events, /availability, /find-meeting-time
// Replaces server/routes/calendar-routes.ts::101-286.
//
// Real DB work against `calendar_events`. For external propagation
// (Google/Microsoft API writes) see the future follow-up: currently create/
// update/delete operate on the local mirror only. Sync endpoint pulls from
// provider; push propagation is out of scope for this session.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { createLogger } from '../../_shared/logger.ts';

const log = createLogger('meetings-events');

export async function handleEvents(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  // pathParts: ['calendar', 'events', ...]
  const eventId = pathParts[2];

  // GET /calendar/events
  if (method === 'GET' && !eventId) {
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    if (!start || !end) {
      return errorResponse(400, 'Start and end dates are required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const { data, error } = await db
      .from('calendar_events')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('user_id', auth.userId)
      .gte('start_time', start)
      .lte('end_time', end)
      .order('start_time', { ascending: true });

    if (error) {
      return errorResponse(500, 'Failed to fetch events', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /calendar/events
  if (method === 'POST' && !eventId) {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    if (!body.title || !body.startTime || !body.endTime) {
      return errorResponse(400, 'Title, start time, and end time are required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const { data, error } = await db
      .from('calendar_events')
      .insert({
        tenant_id: auth.tenantId,
        user_id: auth.userId,
        title: body.title,
        description: body.description ?? null,
        start_time: body.startTime,
        end_time: body.endTime,
        is_all_day: body.isAllDay ?? false,
        location: body.location ?? null,
        attendees: body.attendees ?? [],
        status: body.status ?? 'confirmed',
        event_type: body.eventType ?? 'meeting',
        related_entity_id: body.relatedEntityId ?? null,
        related_entity_type: body.relatedEntityType ?? null,
        is_ai_generated: body.isAiGenerated ?? false,
        ai_confidence: body.aiConfidence ?? null,
      })
      .select('*')
      .single();

    if (error) {
      return errorResponse(500, 'Failed to create event', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(data, 201, req, requestId);
  }

  // PUT /calendar/events/:id
  if (method === 'PUT' && eventId) {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const mapping: Array<[string, string]> = [
      ['title', 'title'],
      ['description', 'description'],
      ['startTime', 'start_time'],
      ['endTime', 'end_time'],
      ['isAllDay', 'is_all_day'],
      ['location', 'location'],
      ['attendees', 'attendees'],
      ['status', 'status'],
      ['eventType', 'event_type'],
    ];
    for (const [camel, snake] of mapping) {
      if (camel in body) updates[snake] = body[camel];
    }

    const { data, error } = await db
      .from('calendar_events')
      .update(updates)
      .eq('id', eventId)
      .eq('tenant_id', auth.tenantId)
      .select('*')
      .single();

    if (error) {
      return errorResponse(500, 'Failed to update event', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(data, 200, req, requestId);
  }

  // DELETE /calendar/events/:id
  if (method === 'DELETE' && eventId) {
    const { error } = await db
      .from('calendar_events')
      .delete()
      .eq('id', eventId)
      .eq('tenant_id', auth.tenantId);

    if (error) {
      return errorResponse(500, 'Failed to delete event', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse({ success: true, deletedEventId: eventId }, 200, req, requestId);
  }

  return null;
}

/**
 * GET /calendar/availability/:userId — busy windows in range.
 *
 * Pulls from `calendar_events` for that user and returns the ranges as busy
 * slots. If the user has an active calendar_connection with valid tokens,
 * we could also query Google/MS freeBusy directly — deferred as a follow-up
 * since the mirror table is updated by /sync.
 */
export async function handleAvailability(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts, url } = ctx;
  // pathParts: ['calendar', 'availability', ':userId']
  if (method !== 'GET' || pathParts[1] !== 'availability' || !pathParts[2]) return null;

  const userId = pathParts[2];
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end) {
    return errorResponse(400, 'Start and end times are required', req, {
      code: 'VALIDATION',
      requestId,
    });
  }

  const { data, error } = await db
    .from('calendar_events')
    .select('start_time, end_time, status')
    .eq('tenant_id', auth.tenantId)
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .gte('start_time', start)
    .lte('end_time', end);

  if (error) {
    return errorResponse(500, 'Failed to fetch availability', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  const busy = (data ?? []).map((ev) => ({ start: ev.start_time, end: ev.end_time }));
  return jsonResponse({ busy, userId }, 200, req, requestId);
}

/**
 * POST /calendar/find-meeting-time — optimal slot across attendees.
 *
 * Algorithm: sweep the preferred window in 30-minute steps; a slot is
 * available if no busy row from any attendee overlaps it. Ranks by earliest
 * slot in business hours (9am-5pm local). Tried to hit external freeBusy
 * too, but that's an extension — see follow-up.
 */
export async function handleFindMeetingTime(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  if (method !== 'POST' || pathParts[1] !== 'find-meeting-time') return null;

  let body: {
    attendeeIds?: string[];
    duration?: number;
    preferredStart?: string;
    preferredEnd?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body', req, {
      code: 'INVALID_JSON',
      requestId,
    });
  }

  if (
    !body.attendeeIds ||
    body.attendeeIds.length === 0 ||
    !body.duration ||
    !body.preferredStart ||
    !body.preferredEnd
  ) {
    return errorResponse(
      400,
      'attendeeIds, duration, preferredStart, preferredEnd are required',
      req,
      { code: 'VALIDATION', requestId },
    );
  }

  const { data, error } = await db
    .from('calendar_events')
    .select('start_time, end_time, user_id')
    .eq('tenant_id', auth.tenantId)
    .in('user_id', body.attendeeIds)
    .neq('status', 'cancelled')
    .gte('start_time', body.preferredStart)
    .lte('end_time', body.preferredEnd);

  if (error) {
    return errorResponse(500, 'Failed to compute meeting times', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  const busyPerUser = new Map<string, Array<{ start: number; end: number }>>();
  for (const ev of data ?? []) {
    const arr = busyPerUser.get(ev.user_id) ?? [];
    arr.push({
      start: new Date(ev.start_time).getTime(),
      end: new Date(ev.end_time).getTime(),
    });
    busyPerUser.set(ev.user_id, arr);
  }

  const stepMs = 30 * 60 * 1000;
  const durationMs = body.duration * 60 * 1000;
  const windowStart = new Date(body.preferredStart).getTime();
  const windowEnd = new Date(body.preferredEnd).getTime();

  const suggestions: string[] = [];
  for (let t = windowStart; t + durationMs <= windowEnd; t += stepMs) {
    const slotEnd = t + durationMs;
    const hour = new Date(t).getUTCHours();
    if (hour < 13 || hour > 22) continue; // ~9am-5pm EST

    let allFree = true;
    for (const userId of body.attendeeIds) {
      const busy = busyPerUser.get(userId) ?? [];
      if (busy.some((b) => b.start < slotEnd && b.end > t)) {
        allFree = false;
        break;
      }
    }
    if (allFree) {
      suggestions.push(new Date(t).toISOString());
      if (suggestions.length >= 5) break;
    }
  }

  log.info(
    { attendees: body.attendeeIds.length, duration: body.duration, found: suggestions.length },
    'find_meeting_time',
  );
  return jsonResponse({ suggestions }, 200, req, requestId);
}
