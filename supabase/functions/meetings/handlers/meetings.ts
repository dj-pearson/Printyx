// Meeting scheduling - /meetings/schedule-request, /schedule/:id, /meetings, /meetings/:id,
//                       /types, /rooms, /analytics, /optimize-schedule.
// Replaced server/routes/meeting-scheduling-routes.ts, which MEETINGS-READS-001
// deleted along with its service (775 lines that imported `db` and never
// queried anything).
//
// FOUR OF THESE ANSWER 410 OR 501 NOW, and which one says something different.
//
// `GET /meetings` and `GET /meetings/:id` were mocks - a single "Weekly Team
// Sync" for the list, and THE SAME "Scheduled Meeting" object for every id, so
// no two requests could disagree and nothing could be caught by comparison.
// They are 410 rather than 501 because the capability is not missing: the real
// meetings read is `GET /meetings/calendar/events?start=&end=`, which serves
// `calendar_events` with provider propagation and has a live caller in
// CalendarProvider.tsx. A second reader of the same concept is the duplicate
// this repo keeps paying for, so the withdrawal names the replacement.
//
// `/types` and `/rooms` are 501: there is no meeting_types or meeting_rooms
// table in any schema or migration, so a list of three types and two rooms was
// a claim about a dealer's configuration that nothing could have made.
//
// `POST /schedule/:requestId` is 501, and it was the worst of them - it
// answered **201 Created** with a meeting id for a row it never stored, so a
// caller booked a meeting, got an identifier back, and nothing existed. A
// fabricated write outcome is harder to catch than a fabricated read, because
// the success is the evidence. `calendar_events` is where a real
// implementation would write (COP-B12 established it as this product's meeting
// entity); that is a create path with no caller and belongs to its own story.
//
// WHAT STAYS REAL: `/analytics` counts `calendar_events` (AUDIT-020),
// `/schedule-request` runs a genuine Claude call and stores nothing it claims
// to store, and `/optimize-schedule` is untouched.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { generateCompletion } from '../../_shared/anthropic.ts';
import { createLogger } from '../../_shared/logger.ts';

const log = createLogger('meetings-scheduling');

export async function handleSchedulingRequest(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { method, auth, requestId, pathParts } = ctx;

  // POST /schedule-request
  if (method === 'POST' && pathParts[0] === 'schedule-request') {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    const requestPayload = {
      id: `req-${Date.now()}`,
      tenantId: auth.tenantId,
      requesterId: auth.userId,
      title: body.title ?? 'New Meeting',
      durationMinutes: Number(body.durationMinutes ?? 30),
      priority: body.priority ?? 'medium',
      requiredParticipants: (body.requiredParticipants as string[]) ?? [],
      optionalParticipants: (body.optionalParticipants as string[]) ?? [],
      earliestStartTime: body.earliestStartTime,
      latestEndTime: body.latestEndTime,
    };

    const prompt =
      `Optimize meeting scheduling with these constraints:\n\n` +
      `Meeting: "${requestPayload.title}"\n` +
      `Duration: ${requestPayload.durationMinutes} minutes\n` +
      `Priority: ${requestPayload.priority}\n` +
      `Required Participants: ${requestPayload.requiredParticipants.length}\n` +
      `Optional Participants: ${requestPayload.optionalParticipants.length}\n\n` +
      `Time Constraints:\n` +
      `- Earliest: ${requestPayload.earliestStartTime ?? 'No limit'}\n` +
      `- Latest: ${requestPayload.latestEndTime ?? 'No limit'}\n\n` +
      `Generate 3-5 optimal meeting time suggestions in JSON:\n` +
      `{ "suggestions": [{ "startTime": "ISO", "endTime": "ISO", "confidence": 0.92, ` +
      `"participantAvailability": {}, "optimizationFactors": { "participantProductivity": 0.9, ` +
      `"travelTime": 0.8, "meetingFatigue": 0.85, "businessPriority": 0.9 }, "reasoning": "..." }] }`;

    let suggestions: unknown[] = [];
    try {
      const raw = await generateCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions;
    } catch (err) {
      log.warn({ err: String(err) }, 'scheduling_ai_failed_falling_back');
      // Fallback: deterministic suggestions every 2h in the preferred window.
      const start = requestPayload.earliestStartTime
        ? new Date(requestPayload.earliestStartTime as string)
        : new Date();
      const end = requestPayload.latestEndTime
        ? new Date(requestPayload.latestEndTime as string)
        : new Date(start.getTime() + 5 * 86_400_000);
      let cursor = new Date(start);
      while (cursor < end && suggestions.length < 3) {
        const suggestionEnd = new Date(cursor.getTime() + requestPayload.durationMinutes * 60_000);
        suggestions.push({
          startTime: cursor.toISOString(),
          endTime: suggestionEnd.toISOString(),
          confidence: 0.65,
          participantAvailability: {},
          optimizationFactors: {
            participantProductivity: 0.7,
            travelTime: 0.8,
            meetingFatigue: 0.7,
            businessPriority: 0.7,
          },
          reasoning: 'Deterministic fallback — AI optimization unavailable',
        });
        cursor = new Date(cursor.getTime() + 2 * 3600_000);
      }
    }

    return jsonResponse(
      { requestId: requestPayload.id, suggestions, processingStatus: 'completed' },
      201,
      req,
      requestId,
    );
  }

  // POST /schedule/:requestId - 501. See the header: this returned 201 with a
  // meeting id for a row it never wrote.
  if (method === 'POST' && pathParts[0] === 'schedule' && pathParts[1]) {
    return errorResponse(501, 'Booking a suggested slot is not implemented', req, {
      code: 'NOT_IMPLEMENTED',
      details:
        'This answered 201 with an id for a meeting it never stored. Create the event ' +
        'through POST /meetings/calendar/events, which writes calendar_events and ' +
        'propagates to the connected provider.',
      requestId,
    });
  }

  return null;
}

export async function handleMeetings(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, requestId, pathParts } = ctx;
  if (pathParts[0] !== 'meetings') return null;

  if (method === 'GET') {
    return errorResponse(410, 'Use GET /meetings/calendar/events', req, {
      code: 'USE_CALENDAR_EVENTS',
      details:
        'This returned one invented meeting for the list and the same object for every id. ' +
        'GET /meetings/calendar/events?start=&end= reads calendar_events, which is this ' +
        "product's meeting entity.",
      requestId,
    });
  }

  return null;
}

export async function handleTypes(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, requestId, pathParts } = ctx;
  if (method !== 'GET' || pathParts[0] !== 'types') return null;
  return errorResponse(501, 'Meeting types are not configurable', req, {
    code: 'NO_MEETING_TYPES_TABLE',
    details:
      'There is no meeting_types table in any schema or migration. This listed three ' +
      "invented types as though they were the dealer's configuration.",
    requestId,
  });
}

export async function handleRooms(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, requestId, pathParts } = ctx;
  if (method !== 'GET' || pathParts[0] !== 'rooms') return null;
  return errorResponse(501, 'Meeting rooms are not configurable', req, {
    code: 'NO_MEETING_ROOMS_TABLE',
    details:
      'There is no meeting_rooms table in any schema or migration. This listed two ' +
      'invented rooms with capacities and equipment.',
    requestId,
  });
}

export async function handleAnalytics(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, requestId, pathParts, auth, db } = ctx;
  if (method !== 'GET' || pathParts[0] !== 'analytics') return null;

  // AUDIT-020: this returned 127 total meetings, 98 scheduled, 89 completed, a
  // 42-minute average and a meetingFatigueIndex of 0.65 - every one a literal,
  // with the per-type counts randomised on each request so they moved like real
  // data. Unlike the Express fabrications this is an EDGE function, which is
  // what production actually runs.
  //
  // calendar_events carries start_time, end_time, status and event_type, so
  // everything below is counted. meetingFatigueIndex is not derivable - nothing
  // in the repo defines it - so it is named in `unbacked` rather than invented.
  const windowDays = 90;
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const { data, error } = await db
    .from('calendar_events')
    .select('start_time, end_time, status, event_type')
    .eq('tenant_id', auth.tenantId)
    .gte('start_time', since);

  if (error) {
    return errorResponse(500, 'Failed to load meeting analytics', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  const rows = data ?? [];
  const now = Date.now();

  let durationSumMinutes = 0;
  let durationCount = 0;
  let upcoming = 0;
  let past = 0;
  let cancelled = 0;
  const byType = new Map<string, number>();

  for (const row of rows) {
    const start = row.start_time ? new Date(row.start_time as string).getTime() : NaN;
    const end = row.end_time ? new Date(row.end_time as string).getTime() : NaN;

    if (row.status === 'cancelled') {
      cancelled++;
    } else if (Number.isFinite(start)) {
      if (start > now) upcoming++;
      else past++;
    }

    // An all-day or malformed row would drag the mean, so only well-formed
    // positive durations count toward it.
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      durationSumMinutes += (end - start) / 60_000;
      durationCount++;
    }

    const type = String(row.event_type ?? 'meeting');
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }

  return jsonResponse(
    {
      windowDays,
      totalMeetings: rows.length,
      upcomingMeetings: upcoming,
      pastMeetings: past,
      cancelledMeetings: cancelled,
      // null, not 0: no timed events is not a zero-minute average.
      averageDurationMinutes:
        durationCount > 0 ? Math.round(durationSumMinutes / durationCount) : null,
      topMeetingTypes: Array.from(byType.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      unbacked: ['meetingFatigueIndex'],
    },
    200,
    req,
    requestId,
  );
}
