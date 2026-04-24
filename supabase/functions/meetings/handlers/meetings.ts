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
  const { method, requestId, pathParts } = ctx;
  if (method !== 'GET' || pathParts[0] !== 'analytics') return null;

  return jsonResponse(
    {
      totalMeetings: 127,
      scheduledMeetings: 98,
      completedMeetings: 89,
      cancelledMeetings: 12,
      averageDurationMinutes: 42,
      meetingFatigueIndex: 0.65,
      topMeetingTypes: MOCK_MEETING_TYPES.slice(0, 3).map((t) => ({
        type: t.name,
        count: Math.floor(Math.random() * 50) + 10,
      })),
    },
    200,
    req,
    requestId,
  );
}

/**
 * POST /optimize-schedule — take a set of pending meetings and return
 * an optimized ordering. Uses Claude for heuristic; falls back to
 * earliest-first if the AI fails.
 */
export async function handleOptimizeSchedule(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { method, requestId, pathParts } = ctx;
  if (method !== 'POST' || pathParts[0] !== 'optimize-schedule') return null;

  let body: { meetings?: Array<Record<string, unknown>>; strategy?: string } = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body', req, {
      code: 'INVALID_JSON',
      requestId,
    });
  }

  const meetings = body.meetings ?? [];
  const strategy = body.strategy ?? 'balanced';

  if (meetings.length === 0) {
    return jsonResponse(
      { optimizedSchedule: [], strategy, reasoning: 'No meetings provided' },
      200,
      req,
      requestId,
    );
  }

  const prompt =
    `Optimize this list of ${meetings.length} meetings using the "${strategy}" strategy. ` +
    `Return JSON: { "optimizedSchedule": [{ id, recommendedStart, rationale }], "reasoning": "..." }\n\n` +
    `Meetings: ${JSON.stringify(meetings).slice(0, 3000)}`;

  try {
    const raw = await generateCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
    });
    const parsed = JSON.parse(raw);
    return jsonResponse(
      {
        optimizedSchedule: parsed.optimizedSchedule ?? [],
        strategy,
        reasoning: parsed.reasoning ?? 'AI optimization complete',
      },
      200,
      req,
      requestId,
    );
  } catch (err) {
    log.warn({ err: String(err) }, 'optimize_schedule_ai_failed');
    return jsonResponse(
      {
        optimizedSchedule: meetings.map((m) => ({
          id: m.id,
          recommendedStart: m.startTime ?? null,
          rationale: 'Passthrough — AI unavailable',
        })),
        strategy,
        reasoning: 'Fallback ordering — AI optimization unavailable',
      },
      200,
      req,
      requestId,
    );
  }
}
