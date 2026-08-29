// Meeting scheduling — /meetings/schedule-request, /schedule/:id, /meetings, /meetings/:id,
//                       /types, /rooms, /analytics, /optimize-schedule.
// Replaces server/routes/meeting-scheduling-routes.ts.
//
// No dedicated meetings/meeting_types/meeting_rooms tables in migrations on
// disk — the Express service returned mock data with embedded Claude prompts
// for scheduling suggestions. We preserve the same response shape and wire
// the real Claude call for schedule-request.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { generateCompletion } from '../../_shared/anthropic.ts';
import { createLogger } from '../../_shared/logger.ts';

const log = createLogger('meetings-scheduling');

const MOCK_MEETING_TYPES = [
  {
    id: 'type-1',
    name: 'Team Standup',
    defaultDurationMinutes: 15,
    bufferTimeMinutes: 5,
    maxParticipants: 12,
    requiresRoom: false,
    aiSchedulingPriority: 8,
  },
  {
    id: 'type-2',
    name: 'Sales Call',
    defaultDurationMinutes: 30,
    bufferTimeMinutes: 10,
    maxParticipants: 5,
    requiresRoom: false,
    aiSchedulingPriority: 9,
  },
  {
    id: 'type-3',
    name: 'Strategic Planning',
    defaultDurationMinutes: 90,
    bufferTimeMinutes: 15,
    maxParticipants: 8,
    requiresRoom: true,
    aiSchedulingPriority: 7,
  },
];

const MOCK_ROOMS = [
  {
    id: 'room-1',
    name: 'Conference Room A',
    capacity: 10,
    equipment: ['projector', 'whiteboard', 'video_conference'],
    isBookable: true,
  },
  {
    id: 'room-2',
    name: 'Huddle Room',
    capacity: 4,
    equipment: ['tv_display', 'video_conference'],
    isBookable: true,
  },
];

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

  // POST /schedule/:requestId
  if (method === 'POST' && pathParts[0] === 'schedule' && pathParts[1]) {
    let body: { selectedSuggestion?: Record<string, unknown>; roomId?: string } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }
    if (!body.selectedSuggestion) {
      return errorResponse(400, 'Selected suggestion is required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const meeting = {
      id: `meeting-${Date.now()}`,
      tenantId: auth.tenantId,
      organizerId: auth.userId,
      title: body.selectedSuggestion.title ?? 'Scheduled Meeting',
      startTime: body.selectedSuggestion.startTime,
      endTime: body.selectedSuggestion.endTime,
      roomId: body.roomId ?? null,
      status: 'scheduled',
      priority: 'medium',
      createdAt: new Date().toISOString(),
    };
    return jsonResponse(meeting, 201, req, requestId);
  }

  return null;
}

export async function handleMeetings(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, requestId, pathParts } = ctx;
  if (pathParts[0] !== 'meetings') return null;
  const meetingId = pathParts[1];

  // GET /meetings — mock (table not in migrations/)
  if (method === 'GET' && !meetingId) {
    return jsonResponse(
      [
        {
          id: 'meeting-1',
          tenantId: auth.tenantId,
          title: 'Weekly Team Sync',
          startTime: new Date(Date.now() + 86_400_000).toISOString(),
          endTime: new Date(Date.now() + 86_400_000 + 3600_000).toISOString(),
          status: 'scheduled',
          priority: 'medium',
        },
      ],
      200,
      req,
      requestId,
    );
  }

  // GET /meetings/:id
  if (method === 'GET' && meetingId) {
    return jsonResponse(
      {
        id: meetingId,
        tenantId: auth.tenantId,
        title: 'Scheduled Meeting',
        status: 'scheduled',
        participants: [],
        agenda: [],
      },
      200,
      req,
      requestId,
    );
  }

  return null;
}

export async function handleTypes(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, requestId, pathParts } = ctx;
  if (method !== 'GET' || pathParts[0] !== 'types') return null;
  return jsonResponse(MOCK_MEETING_TYPES, 200, req, requestId);
}

export async function handleRooms(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, requestId, pathParts } = ctx;
  if (method !== 'GET' || pathParts[0] !== 'rooms') return null;
  return jsonResponse(MOCK_ROOMS, 200, req, requestId);
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
