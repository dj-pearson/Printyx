// Meeting recordings — upload, list, process.
//
// - POST /upload           multipart upload → stores metadata in meeting_recordings.
//                          Audio bytes go to Supabase Storage bucket
//                          `meeting-recordings/{tenantId}/{recordingId}.{ext}`.
// - GET  /meetings/:id/recordings — list recordings for a meeting.
// - POST /recordings/:id/process — enqueue transcription (stub calls synchronously).

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { createLogger } from '../../_shared/logger.ts';
import { transcribe, TranscriptionUnavailableError } from '../_stt.ts';

const log = createLogger('meeting-transcription-recordings');
const STORAGE_BUCKET = 'meeting-recordings';

export async function handleRecordings(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  const first = pathParts[0];
  const second = pathParts[1];
  const third = pathParts[2];

  // POST /upload
  if (method === 'POST' && first === 'upload') {
    return await handleUpload(req, ctx);
  }

  // GET /meetings/:meetingId/recordings
  if (method === 'GET' && first === 'meetings' && second && third === 'recordings') {
    const { data, error } = await db
      .from('meeting_recordings')
      .select(
        'id, meeting_id, recording_name, recording_format, file_size_bytes, duration_seconds, recording_source, processing_status, transcription_status, ai_analysis_status, ai_confidence_score, ai_speaker_count, uploaded_at, uploaded_by, is_public',
      )
      .eq('tenant_id', auth.tenantId)
      .eq('meeting_id', second)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return errorResponse(500, 'Failed to fetch recordings', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  // POST /recordings/:recordingId/process
  if (method === 'POST' && first === 'recordings' && second && third === 'process') {
    return await processRecording(req, ctx, second);
  }

  return null;
}

async function handleUpload(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return errorResponse(
      400,
      'Upload must be multipart/form-data with "file" and meetingId fields',
      req,
      { code: 'VALIDATION', requestId },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return errorResponse(400, 'Invalid multipart body', req, {
      code: 'INVALID_MULTIPART',
      details: String(err),
      requestId,
    });
  }

  const file = form.get('file');
  const meetingId = form.get('meetingId');
  const recordingName =
    (form.get('recordingName') as string | null) ??
    (file instanceof File ? file.name : 'recording');
  const source = (form.get('source') as string | null) ?? 'manual_upload';
  const format = (form.get('format') as string | null) ?? 'mp4';
  const isPublic = form.get('isPublic') === 'true';

  if (!(file instanceof File)) {
    return errorResponse(400, 'file is required', req, {
      code: 'VALIDATION',
      requestId,
    });
  }
  if (typeof meetingId !== 'string' || !meetingId) {
    return errorResponse(400, 'meetingId is required', req, {
      code: 'VALIDATION',
      requestId,
    });
  }

  // Insert metadata row first so we have the id for the storage path.
  const { data: row, error: insertErr } = await db
    .from('meeting_recordings')
    .insert({
      meeting_id: meetingId,
      tenant_id: auth.tenantId,
      recording_name: recordingName,
      recording_format: format,
      file_size_bytes: file.size,
      recording_source: source,
      processing_status: 'pending',
      transcription_status: 'pending',
      ai_analysis_status: 'pending',
      uploaded_by: auth.userId,
      is_public: isPublic,
    })
    .select('id')
    .single();

  if (insertErr || !row) {
    return errorResponse(500, 'Failed to create recording metadata', req, {
      code: 'DB_ERROR',
      details: insertErr?.message,
      requestId,
    });
  }

  const ext = format || 'mp4';
  const path = `${auth.tenantId}/${row.id}.${ext}`;

  const { data: uploadRes, error: uploadErr } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

  if (uploadErr) {
    // Roll back the metadata row so we don't leave orphans.
    await db.from('meeting_recordings').delete().eq('id', row.id);
    return errorResponse(500, 'Failed to upload recording audio', req, {
      code: 'STORAGE_ERROR',
      details: uploadErr.message,
      requestId,
    });
  }

  const recordingUrl = uploadRes?.path ? `${STORAGE_BUCKET}/${uploadRes.path}` : path;
  await db
    .from('meeting_recordings')
    .update({ recording_url: recordingUrl, processing_started_at: new Date().toISOString() })
    .eq('id', row.id);

  log.info({ recordingId: row.id, meetingId, sizeBytes: file.size, path }, 'recording_uploaded');

  return jsonResponse(
    {
      id: row.id,
      meetingId,
      recordingName,
      recordingFormat: format,
      recordingUrl,
      fileSizeBytes: file.size,
      processingStatus: 'pending',
      transcriptionStatus: 'pending',
    },
    201,
    req,
    requestId,
  );
}

async function processRecording(
  req: Request,
  ctx: HandlerCtx,
  recordingId: string,
): Promise<Response> {
  const { auth, db, requestId } = ctx;

  const { data: recording, error } = await db
    .from('meeting_recordings')
    .select('*')
    .eq('id', recordingId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to load recording', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  if (!recording) {
    return errorResponse(404, 'Recording not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }

  if (!recording.recording_url) {
    return errorResponse(400, 'Recording has no stored audio', req, {
      code: 'NO_AUDIO',
      requestId,
    });
  }

  await db
    .from('meeting_recordings')
    .update({ transcription_status: 'processing' })
    .eq('id', recordingId);

  // Fetch audio from storage.
  const path = recording.recording_url.replace(new RegExp(`^${STORAGE_BUCKET}/`), '');
  const { data: blob, error: dlErr } = await db.storage.from(STORAGE_BUCKET).download(path);

  if (dlErr || !blob) {
    await db
      .from('meeting_recordings')
      .update({
        transcription_status: 'failed',
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', recordingId);
    return errorResponse(500, 'Failed to download recording audio', req, {
      code: 'STORAGE_ERROR',
      details: dlErr?.message,
      requestId,
    });
  }

  try {
    const result = await transcribe(blob);

    const wordCount = result.text.trim().split(/\s+/).filter(Boolean).length;

    const { data: inserted, error: insertErr } = await db
      .from('meeting_transcriptions')
      .insert({
        recording_id: recordingId,
        meeting_id: recording.meeting_id,
        tenant_id: auth.tenantId,
        full_transcript: result.text,
        transcript_segments: result.segments,
        transcription_service: result.provider,
        ai_model_version: result.provider === 'whisper' ? 'whisper-1' : 'stub-v1',
        processing_time_seconds: Math.round(result.processingTimeMs / 1000),
        overall_confidence:
          result.segments.length > 0
            ? result.segments
                .map((s) => s.confidence ?? 0)
                .reduce((a, b, _, arr) => a + b / arr.length, 0)
            : 0.0,
        word_count: wordCount,
        speaker_count: new Set(result.segments.map((s) => s.speaker).filter(Boolean)).size,
        primary_language: result.language,
      })
      .select('id, full_transcript, word_count, speaker_count, transcription_service')
      .single();

    await db
      .from('meeting_recordings')
      .update({
        transcription_status: result.provider === 'stub' ? 'completed' : 'completed',
        processing_completed_at: new Date().toISOString(),
        ai_language_detected: result.language,
      })
      .eq('id', recordingId);

    if (insertErr) {
      return errorResponse(500, 'Failed to save transcription', req, {
        code: 'DB_ERROR',
        details: insertErr.message,
        requestId,
      });
    }

    return jsonResponse(
      {
        recordingId,
        transcriptionId: inserted?.id,
        provider: result.provider,
        wordCount,
        speakerCount: inserted?.speaker_count ?? 0,
        processingTimeMs: result.processingTimeMs,
        status: 'completed',
      },
      200,
      req,
      requestId,
    );
  } catch (err) {
    await db
      .from('meeting_recordings')
      .update({
        transcription_status: 'failed',
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    if (err instanceof TranscriptionUnavailableError) {
      return errorResponse(503, err.message, req, {
        code: 'TRANSCRIPTION_UNAVAILABLE',
        requestId,
      });
    }
    log.error({ recordingId, err: String(err) }, 'process_failed');
    return errorResponse(500, 'Transcription failed', req, {
      code: 'INTERNAL',
      details: String(err),
      requestId,
    });
  }
}
