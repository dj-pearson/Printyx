/**
 * Meeting Transcription edge function.
 *
 * Replaces:
 *   server/routes/meeting-transcription-routes.ts  (9 endpoints)
 *   server/services/meeting-transcription-service.ts (828 lines — mock today)
 *
 * URL layout (under /meeting-transcription):
 *   POST /upload                                       — multipart audio upload
 *   GET  /meetings/:meetingId/recordings               — list recordings
 *   GET  /recordings/:recordingId/transcription        — fetch transcript
 *   GET  /meetings/:meetingId/notes                    — list AI notes
 *   GET  /meetings/:meetingId/highlights               — list highlights
 *   POST /content/search                               — keyword search transcripts
 *   GET  /analytics/content                            — content aggregates
 *   POST /speakers/profile                             — upsert speaker label
 *   POST /recordings/:recordingId/process              — run STT via _stt.ts
 *
 * Transcription provider is controlled by TRANSCRIPTION_PROVIDER env:
 *   `stub` (default) — returns placeholder text; useful for dev without spend
 *   `whisper`       — calls OpenAI Whisper via OPENAI_API_KEY
 *
 * One-time SQL:
 *   \i drizzle/rls/meeting-transcription-tables.sql
 *   \i drizzle/rls/meeting-transcription.sql
 *   # Also: create Supabase Storage bucket `meeting-recordings` (private)
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { requireRateLimit, RateLimitError, PRESETS } from '../_shared/rate-limit.ts';

import { handleRecordings } from './handlers/recordings.ts';
import { handleTranscription } from './handlers/transcription.ts';
import { handleNotes, handleHighlights } from './handlers/notes.ts';
import { handleContent, handleContentAnalytics, handleSpeakerProfile } from './handlers/content.ts';

const log = createLogger('meeting-transcription');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/meeting-transcription(?=\/|$)/, '')
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

    // Transcription processing is expensive (Whisper) — apply the
    // transcriptionPerTenant preset (10/hour by default).
    if (
      method === 'POST' &&
      firstSegment === 'recordings' &&
      pathParts[1] &&
      pathParts[2] === 'process'
    ) {
      try {
        requireRateLimit(`transcribe:${auth.tenantId}`, PRESETS.transcriptionPerTenant);
      } catch (err) {
        if (err instanceof RateLimitError) {
          return errorResponse(429, 'Transcription rate limit exceeded', req, {
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
      case 'upload':
        result = await handleRecordings(req, ctx);
        break;
      case 'meetings':
        // Two sub-resources under /meetings/:id — recordings, notes, highlights.
        if (pathParts[2] === 'recordings') {
          result = await handleRecordings(req, ctx);
        } else if (pathParts[2] === 'notes') {
          result = await handleNotes(req, ctx);
        } else if (pathParts[2] === 'highlights') {
          result = await handleHighlights(req, ctx);
        }
        break;
      case 'recordings':
        // /recordings/:id/transcription OR /recordings/:id/process
        if (pathParts[2] === 'transcription') {
          result = await handleTranscription(req, ctx);
        } else if (pathParts[2] === 'process') {
          result = await handleRecordings(req, ctx);
        }
        break;
      case 'content':
        result = await handleContent(req, ctx);
        break;
      case 'analytics':
        result = await handleContentAnalytics(req, ctx);
        break;
      case 'speakers':
        result = await handleSpeakerProfile(req, ctx);
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
