// GET /recordings/:recordingId/transcription — fetch transcription for a recording.
// Ported from server/routes/meeting-transcription-routes.ts::166-306.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleTranscription(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  if (
    method !== 'GET' ||
    pathParts[0] !== 'recordings' ||
    !pathParts[1] ||
    pathParts[2] !== 'transcription'
  )
    return null;

  const recordingId = pathParts[1];

  const { data, error } = await db
    .from('meeting_transcriptions')
    .select('*')
    .eq('recording_id', recordingId)
    .eq('tenant_id', auth.tenantId)
    .order('transcribed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to fetch transcription', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  if (!data) {
    return errorResponse(404, 'Transcription not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }

  return jsonResponse(data, 200, req, requestId);
}
