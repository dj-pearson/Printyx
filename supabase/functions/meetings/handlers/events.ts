// Calendar events CRUD + availability — /meetings/calendar/events, /availability, /find-meeting-time
// Replaces server/routes/calendar-routes.ts::101-286.
//
// Real DB work against `calendar_events`. POST/PUT/DELETE also propagate to
// Google or Microsoft when the local row is bound to a `calendar_connection_id`
// (POST: client supplies it; PUT/DELETE: read from the existing row). External
// propagation is best-effort — local write is authoritative; provider failure
// is logged and surfaced as `propagation` metadata in the response so the UI
// can warn the user without aborting the save.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { createLogger } from '../../_shared/logger.ts';
import * as google from '../../_shared/google.ts';
import * as microsoft from '../../_shared/microsoft.ts';

const log = createLogger('meetings-events');

interface PropagationResult {
  status: 'skipped' | 'success' | 'failed';
  provider?: 'google' | 'outlook';
  externalEventId?: string | null;
  error?: string;
}

interface LocalEventRow {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean | null;
  location: string | null;
  attendees: unknown;
  status: string | null;
}

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

    const connectionId =
      typeof body.calendarConnectionId === 'string' ? body.calendarConnectionId : null;

    const { data, error } = await db
      .from('calendar_events')
      .insert({
        tenant_id: auth.tenantId,
        user_id: auth.userId,
        calendar_connection_id: connectionId,
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

    const propagation = connectionId
      ? await pushInsert(ctx, connectionId, data as LocalEventRow)
      : ({ status: 'skipped' } as PropagationResult);

    if (propagation.status === 'success' && propagation.externalEventId) {
      await db
        .from('calendar_events')
        .update({ external_event_id: propagation.externalEventId })
        .eq('id', data.id);
      (data as Record<string, unknown>).external_event_id = propagation.externalEventId;
    }

    return jsonResponse({ ...data, propagation }, 201, req, requestId);
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

    const propagation =
      data.calendar_connection_id && data.external_event_id
        ? await pushPatch(
            ctx,
            data.calendar_connection_id,
            data.external_event_id,
            data as LocalEventRow,
          )
        : ({ status: 'skipped' } as PropagationResult);

    return jsonResponse({ ...data, propagation }, 200, req, requestId);
  }

  // DELETE /calendar/events/:id
  if (method === 'DELETE' && eventId) {
    // Snapshot the row before deletion so we can propagate.
    const { data: existing } = await db
      .from('calendar_events')
      .select('id, calendar_connection_id, external_event_id')
      .eq('id', eventId)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();

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

    const propagation =
      existing?.calendar_connection_id && existing.external_event_id
        ? await pushDelete(ctx, existing.calendar_connection_id, existing.external_event_id)
        : ({ status: 'skipped' } as PropagationResult);

    return jsonResponse(
      { success: true, deletedEventId: eventId, propagation },
      200,
      req,
      requestId,
    );
  }

  return null;
}

// ─── External calendar push propagation ─────────────────────────────────────
//
// Each helper loads the connection (with tokens), builds the provider payload
// from the local row, calls the REST helper through `withAutoRefresh`, and
// persists any rotated tokens. Failures never throw out of these helpers —
// the local write has already happened and we don't want to surface a 500
// just because Google was unreachable.

async function loadConnection(
  ctx: HandlerCtx,
  connectionId: string,
): Promise<
  | {
      provider: 'google' | 'outlook';
      accessToken: string;
      refreshToken: string | null;
      calendarId: string;
    }
  | { error: string }
> {
  const { db, auth } = ctx;
  const { data, error } = await db
    .from('calendar_connections')
    .select('provider, access_token, refresh_token, calendar_id')
    .eq('id', connectionId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: 'connection_not_found' };
  if (!data.access_token) return { error: 'connection_missing_access_token' };
  if (data.provider !== 'google' && data.provider !== 'outlook') {
    return { error: `unsupported_provider:${data.provider}` };
  }
  return {
    provider: data.provider,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    calendarId: data.calendar_id ?? 'primary',
  };
}

function persistRefreshedGoogleToken(ctx: HandlerCtx, connectionId: string) {
  return async (refreshed: google.RefreshResult) => {
    await ctx.db
      .from('calendar_connections')
      .update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq('id', connectionId);
  };
}

function persistRefreshedMicrosoftToken(
  ctx: HandlerCtx,
  connectionId: string,
  fallbackRefresh: string | null,
) {
  return async (refreshed: microsoft.RefreshResult) => {
    await ctx.db
      .from('calendar_connections')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? fallbackRefresh,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq('id', connectionId);
  };
}

function localToGoogle(row: LocalEventRow): google.GoogleEvent {
  const isAllDay = row.is_all_day === true;
  return {
    summary: row.title,
    description: row.description ?? undefined,
    start: isAllDay
      ? { date: row.start_time.slice(0, 10) }
      : { dateTime: row.start_time, timeZone: 'UTC' },
    end: isAllDay
      ? { date: row.end_time.slice(0, 10) }
      : { dateTime: row.end_time, timeZone: 'UTC' },
    location: row.location ?? undefined,
    attendees: Array.isArray(row.attendees)
      ? (row.attendees as Array<{ email?: string; displayName?: string }>)
          .filter((a) => typeof a.email === 'string')
          .map((a) => ({ email: a.email!, displayName: a.displayName }))
      : undefined,
    status: (row.status as 'confirmed' | 'tentative' | 'cancelled' | undefined) ?? 'confirmed',
  };
}

function localToGraph(row: LocalEventRow): microsoft.GraphEvent {
  return {
    subject: row.title,
    body: row.description ? { contentType: 'text', content: row.description } : undefined,
    start: { dateTime: row.start_time, timeZone: 'UTC' },
    end: { dateTime: row.end_time, timeZone: 'UTC' },
    isAllDay: row.is_all_day === true,
    location: row.location ? { displayName: row.location } : undefined,
    attendees: Array.isArray(row.attendees)
      ? (row.attendees as Array<string | { email?: string; displayName?: string }>)
          .map((a) => {
            const email = typeof a === 'string' ? a : a?.email;
            if (!email) return null;
            return {
              emailAddress: {
                address: email,
                name: typeof a === 'object' ? a?.displayName : undefined,
              },
              type: 'required' as const,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : undefined,
  };
}

async function pushInsert(
  ctx: HandlerCtx,
  connectionId: string,
  row: LocalEventRow,
): Promise<PropagationResult> {
  const conn = await loadConnection(ctx, connectionId);
  if ('error' in conn) {
    log.warn({ connectionId, err: conn.error }, 'push_insert_skipped');
    return { status: 'failed', error: conn.error };
  }

  try {
    if (conn.provider === 'google') {
      const created = await google.withAutoRefresh(
        { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
        (token) => google.insertEvent(token, conn.calendarId, localToGoogle(row)),
        persistRefreshedGoogleToken(ctx, connectionId),
      );
      return {
        status: 'success',
        provider: 'google',
        externalEventId: created.id ?? null,
      };
    }
    const created = await microsoft.withAutoRefresh(
      { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
      (token) => microsoft.insertEvent(token, localToGraph(row)),
      persistRefreshedMicrosoftToken(ctx, connectionId, conn.refreshToken),
    );
    return {
      status: 'success',
      provider: 'outlook',
      externalEventId: created.id ?? null,
    };
  } catch (err) {
    log.error({ connectionId, err: String(err) }, 'push_insert_failed');
    return { status: 'failed', provider: conn.provider, error: String(err).slice(0, 300) };
  }
}

async function pushPatch(
  ctx: HandlerCtx,
  connectionId: string,
  externalEventId: string,
  row: LocalEventRow,
): Promise<PropagationResult> {
  const conn = await loadConnection(ctx, connectionId);
  if ('error' in conn) {
    log.warn({ connectionId, err: conn.error }, 'push_patch_skipped');
    return { status: 'failed', error: conn.error };
  }

  try {
    if (conn.provider === 'google') {
      await google.withAutoRefresh(
        { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
        (token) => google.patchEvent(token, conn.calendarId, externalEventId, localToGoogle(row)),
        persistRefreshedGoogleToken(ctx, connectionId),
      );
      return { status: 'success', provider: 'google', externalEventId };
    }
    await microsoft.withAutoRefresh(
      { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
      (token) => microsoft.patchEvent(token, externalEventId, localToGraph(row)),
      persistRefreshedMicrosoftToken(ctx, connectionId, conn.refreshToken),
    );
    return { status: 'success', provider: 'outlook', externalEventId };
  } catch (err) {
    log.error({ connectionId, externalEventId, err: String(err) }, 'push_patch_failed');
    return { status: 'failed', provider: conn.provider, error: String(err).slice(0, 300) };
  }
}

async function pushDelete(
  ctx: HandlerCtx,
  connectionId: string,
  externalEventId: string,
): Promise<PropagationResult> {
  const conn = await loadConnection(ctx, connectionId);
  if ('error' in conn) {
    log.warn({ connectionId, err: conn.error }, 'push_delete_skipped');
    return { status: 'failed', error: conn.error };
  }

  try {
    if (conn.provider === 'google') {
      await google.withAutoRefresh(
        { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
        (token) => google.deleteEvent(token, conn.calendarId, externalEventId),
        persistRefreshedGoogleToken(ctx, connectionId),
      );
      return { status: 'success', provider: 'google', externalEventId };
    }
    await microsoft.withAutoRefresh(
      { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
      (token) => microsoft.deleteEvent(token, externalEventId),
      persistRefreshedMicrosoftToken(ctx, connectionId, conn.refreshToken),
    );
    return { status: 'success', provider: 'outlook', externalEventId };
  } catch (err) {
    log.error({ connectionId, externalEventId, err: String(err) }, 'push_delete_failed');
    return { status: 'failed', provider: conn.provider, error: String(err).slice(0, 300) };
  }
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
