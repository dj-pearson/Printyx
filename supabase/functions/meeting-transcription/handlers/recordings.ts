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
import { recordRecordingConsent, validateConsentAssertion } from '../_consent.ts';

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

  // GET /recordings/:id/consent
  // LEGAL-009: the consent behind a recording has to be answerable on demand.
  // A dispute about whether someone agreed to be recorded arrives months later,
  // and "we always ask" is not evidence.
  if (method === 'GET' && first === 'recordings' && second && third === 'consent') {
    const { data, error } = await db
      .from('consent_records')
      .select(
        'id, consent_type, status, legal_basis, source, source_details, proof_type, consent_text, processing_purposes, data_categories, given_at, withdrawn_at, notes, created_by, ip_address, user_agent',
      )
      .eq('tenant_id', auth.tenantId)
      .eq('consent_type', 'recording')
      .eq('proof_reference', second)
      .maybeSingle();

    if (error) {
      return errorResponse(500, 'Failed to fetch recording consent', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    if (!data) {
      // Explicit, not a 404: "there is no consent on file for this recording" is
      // a meaningful answer and the caller needs to be able to act on it.
      return jsonResponse(
        {
          recordingId: second,
          consented: false,
          reason:
            'No consent record found. This recording predates consent capture or was created outside the upload endpoint.',
        },
        200,
        req,
      );
    }

    return jsonResponse(
      { recordingId: second, consented: data.status === 'given', consent: data },
      200,
      req,
    );
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

  // LEGAL-009: no consent, no recording. Checked before any row is written and
  // before a single byte is stored, because the point is not to record first and
  // paper it over afterwards. Eleven US states require every party to agree, and
  // the person recorded has their own claim regardless of what the customer
  // agreed to in their contract with us.
  const consentCheck = validateConsentAssertion(form);
  if (!consentCheck.ok || !consentCheck.assertion) {
    return errorResponse(400, consentCheck.error ?? 'Recording consent is required', req, {
      code: 'CONSENT_REQUIRED',
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

  // Write the consent evidence before the audio exists. If this fails the
  // recording does not happen: audio with nothing to show that anyone agreed to
  // it is the exact position this story exists to get out of. The metadata row
  // is rolled back so a refused upload leaves nothing behind.
  const consent = await recordRecordingConsent(db, {
    tenantId: auth.tenantId,
    userId: auth.userId,
    recordingId: row.id,
    meetingId,
    assertion: consentCheck.assertion,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  });

  if (!consent.ok) {
    await db.from('meeting_recordings').delete().eq('id', row.id);
    log.error({ recordingId: row.id, meetingId, error: consent.error }, 'consent_record_failed');
    return errorResponse(500, 'Could not record consent; recording refused', req, {
      code: 'CONSENT_WRITE_FAILED',
      details: consent.error,
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
    // Roll back the metadata row so we don't leave orphans. The consent record
    // goes too: it attests to a recording that does not exist, and leaving it
    // would make the coverage report claim a recording is covered when there is
    // nothing there.
    await db.from('meeting_recordings').delete().eq('id', row.id);
    await db.from('consent_records').delete().eq('id', consent.consentRecordId);
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
