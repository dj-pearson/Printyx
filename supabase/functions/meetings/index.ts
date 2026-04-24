/**
 * Meetings + Calendar + Advanced Scheduling edge function.
 *
 * Replaces:
 *   server/routes/calendar-routes.ts              (9 endpoints)
 *   server/routes/meeting-scheduling-routes.ts    (8 endpoints)
 *   server/routes/advanced-scheduling-routes.ts   (9 endpoints)
 *   server/services/calendar-service.ts           (uses googleapis + graph SDK)
 *   server/services/meeting-scheduling-service.ts
 *   server/services/constraint-solver.ts          (CSP → Claude-assisted port)
 *
 * URL layout (under /meetings):
 *   /meetings/calendar/connections                — CRUD calendar_connections (tokens redacted)
 *   /meetings/calendar/sync/:connectionId         — POST, pulls events from Google/MS
 *   /meetings/calendar/events[/:id]               — CRUD calendar_events
 *   /meetings/calendar/availability/:userId       — GET busy windows
 *   /meetings/calendar/find-meeting-time          — POST cross-attendee slot search
 *   /meetings/schedule-request                    — POST Claude-assisted suggestions
 *   /meetings/schedule/:requestId                 — POST commit a suggestion
 *   /meetings/meetings                            — GET list (mock — no table)
 *   /meetings/meetings/:id                        — GET detail (mock)
 *   /meetings/types                               — GET static catalog
 *   /meetings/rooms                               — GET static catalog
 *   /meetings/analytics                           — GET (mock)
 *   /meetings/optimize-schedule                   — POST Claude ordering
 *   /meetings/advanced/optimize                   — POST Claude CSP
 *   /meetings/advanced/reschedule                 — POST Claude replanning
 *   /meetings/advanced/constraints                — GET builtin + validate
 *   /meetings/advanced/strategies                 — GET builtin + create custom
 *   /meetings/advanced/patterns/:userId           — GET histogram from calendar_events
 *   /meetings/advanced/analytics                  — GET (mock)
 *
 * One-time SQL:
 *   \i drizzle/rls/meetings-tables.sql
 *   \i drizzle/rls/meetings.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { requireRateLimit, RateLimitError, PRESETS } from '../_shared/rate-limit.ts';

import { handleConnections } from './handlers/connections.ts';
import { handleEvents, handleAvailability, handleFindMeetingTime } from './handlers/events.ts';
import {
  handleSchedulingRequest,
  handleMeetings,
  handleTypes,
  handleRooms,
  handleAnalytics,
  handleOptimizeSchedule,
} from './handlers/meetings.ts';
import { handleAdvanced } from './handlers/advanced.ts';

const log = createLogger('meetings');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/meetings(?=\/|$)/, '')
      .replace(/\/$/, '') || '/'
  );
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(req);
    const db = getDb();

    const rest = stripPrefix(url.pathname);
    const pathParts = rest.split('/').filter(Boolean);
    const ctx = { auth, db, requestId, pathParts, method, url };

    const firstSegment = pathParts[0];

    // Rate-limit Claude-hitting endpoints per tenant.
    const isHeavyAi =
      method === 'POST' &&
      (firstSegment === 'schedule-request' ||
        firstSegment === 'optimize-schedule' ||
        (firstSegment === 'advanced' &&
          (pathParts[1] === 'optimize' || pathParts[1] === 'reschedule')));
    if (isHeavyAi) {
      try {
        requireRateLimit(`claude:${auth.tenantId}`, PRESETS.aiGenerationPerTenant);
      } catch (err) {
        if (err instanceof RateLimitError) {
          return errorResponse(429, 'AI rate limit exceeded', req, {
            code: 'RATE_LIMIT',
            details: { retryAfterSeconds: err.retryAfterSeconds },
            requestId,
          });
        }
        throw err;
      }
    }

    let result: Response | null = null;

    switch (firstSegment) {
      case 'calendar': {
        const sub = pathParts[1];
        if (sub === 'connections' || sub === 'sync') {
          result = await handleConnections(req, ctx);
        } else if (sub === 'events') {
          result = await handleEvents(req, ctx);
        } else if (sub === 'availability') {
          result = await handleAvailability(req, ctx);
        } else if (sub === 'find-meeting-time') {
          result = await handleFindMeetingTime(req, ctx);
        }
        break;
      }
      case 'schedule-request':
      case 'schedule':
        result = await handleSchedulingRequest(req, ctx);
        break;
      case 'meetings':
        result = await handleMeetings(req, ctx);
        break;
      case 'types':
        result = await handleTypes(req, ctx);
        break;
      case 'rooms':
        result = await handleRooms(req, ctx);
        break;
      case 'analytics':
        result = await handleAnalytics(req, ctx);
        break;
      case 'optimize-schedule':
        result = await handleOptimizeSchedule(req, ctx);
        break;
      case 'advanced':
        result = await handleAdvanced(req, ctx);
        break;
      default:
        result = null;
    }

    if (!result) {
      return errorResponse(404, 'Not found', req, {
        code: 'NOT_FOUND',
        details: { path: url.pathname, method },
        requestId,
      });
    }
    return result;
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}
