// GET /meetings/:meetingId/notes — list AI-generated notes.
// GET /meetings/:meetingId/highlights — list highlights.
// Ported from meeting-transcription-routes.ts::308-557 + 558-735.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { canAccessMeeting } from '../_access.ts';

export async function handleNotes(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, scope, requestId, pathParts } = ctx;
  if (method !== 'GET' || pathParts[0] !== 'meetings' || !pathParts[1] || pathParts[2] !== 'notes')
    return null;

  const meetingId = pathParts[1];

  // AI notes are a summary OF the recording, so they inherit its predicate.
  // An empty list rather than a 404: a meeting the caller cannot reach and a
  // meeting with no notes yet are both "nothing to show", and 404 here would
  // confirm which meeting ids exist.
  if (!(await canAccessMeeting(db, auth, scope, meetingId))) {
    return jsonResponse([], 200, req, requestId);
  }

  const { data, error } = await db
    .from('meeting_notes')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('meeting_id', meetingId)
    .order('version', { ascending: false });

  if (error) {
    return errorResponse(500, 'Failed to fetch notes', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  return jsonResponse(data ?? [], 200, req, requestId);
}

export async function handleHighlights(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, scope, requestId, pathParts } = ctx;
  if (
    method !== 'GET' ||
    pathParts[0] !== 'meetings' ||
    !pathParts[1] ||
    pathParts[2] !== 'highlights'
  )
    return null;

  const meetingId = pathParts[1];
  const highlightType = ctx.url.searchParams.get('type');

  if (!(await canAccessMeeting(db, auth, scope, meetingId))) {
    return jsonResponse([], 200, req, requestId);
  }

  let query = db
    .from('meeting_highlights')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('meeting_id', meetingId)
    .order('start_time_seconds', { ascending: true });

  if (highlightType) query = query.eq('highlight_type', highlightType);

  const { data, error } = await query;

  if (error) {
    return errorResponse(500, 'Failed to fetch highlights', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  return jsonResponse(data ?? [], 200, req, requestId);
}
