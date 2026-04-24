// GET /meetings/:meetingId/notes — list AI-generated notes.
// GET /meetings/:meetingId/highlights — list highlights.
// Ported from meeting-transcription-routes.ts::308-557 + 558-735.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleNotes(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  if (method !== 'GET' || pathParts[0] !== 'meetings' || !pathParts[1] || pathParts[2] !== 'notes')
    return null;

  const meetingId = pathParts[1];

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
  const { method, auth, db, requestId, pathParts } = ctx;
  if (
    method !== 'GET' ||
    pathParts[0] !== 'meetings' ||
    !pathParts[1] ||
    pathParts[2] !== 'highlights'
  )
    return null;

  const meetingId = pathParts[1];
  const highlightType = ctx.url.searchParams.get('type');

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
