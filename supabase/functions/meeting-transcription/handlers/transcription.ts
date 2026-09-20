// GET /recordings/:recordingId/transcription — fetch transcription for a recording.
// Ported from server/routes/meeting-transcription-routes.ts::166-306.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { canAccessRecording } from '../_access.ts';

export async function handleTranscription(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, scope, requestId, pathParts } = ctx;
  if (
    method !== 'GET' ||
    pathParts[0] !== 'recordings' ||
    !pathParts[1] ||
    pathParts[2] !== 'transcription'
  )
    return null;

  const recordingId = pathParts[1];

  /**
   * meeting_transcriptions carries no owner of its own - it hangs off a
   * recording - so the recording decides. Checked BEFORE the lookup: a check
   * afterwards has already answered whether a transcript exists, and a full
   * transcript is the most sensitive thing this function holds.
   */
  if (!(await canAccessRecording(db, auth, scope, recordingId))) {
    return errorResponse(404, 'Transcription not found', req, { code: 'NOT_FOUND', requestId });
  }

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
