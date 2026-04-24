// POST /content/search — keyword search across meeting transcriptions.
// GET  /analytics/content — aggregated stats on processed content.
// POST /speakers/profile — upsert a speaker profile (name-based labelling).
// Ported from meeting-transcription-routes.ts::736-826.

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleContent(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  if (pathParts[0] !== 'content') return null;
  const sub = pathParts[1];

  // POST /content/search
  if (method === 'POST' && sub === 'search') {
    let body: { query?: string; limit?: number } = {};
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body', req, {
        code: 'INVALID_JSON',
        requestId,
      });
    }

    const q = body.query?.trim();
    if (!q) {
      return errorResponse(400, 'query is required', req, {
        code: 'VALIDATION',
        requestId,
      });
    }

    const limit = Math.min(50, Math.max(1, Number(body.limit ?? 20)));

    const { data, error } = await db
      .from('meeting_transcriptions')
      .select('id, meeting_id, recording_id, full_transcript, word_count, transcribed_at')
      .eq('tenant_id', auth.tenantId)
      .ilike('full_transcript', `%${q}%`)
      .order('transcribed_at', { ascending: false })
      .limit(limit);

    if (error) {
      return errorResponse(500, 'Failed to search content', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    // Trim transcripts to snippets around the first match.
    const results = (data ?? []).map((row) => {
      const text = String(row.full_transcript ?? '');
      const idx = text.toLowerCase().indexOf(q.toLowerCase());
      const snippetStart = Math.max(0, idx - 80);
      const snippetEnd = Math.min(text.length, idx + q.length + 80);
      return {
        transcriptionId: row.id,
        meetingId: row.meeting_id,
        recordingId: row.recording_id,
        wordCount: row.word_count,
        transcribedAt: row.transcribed_at,
        snippet:
          (snippetStart > 0 ? '…' : '') +
          text.slice(snippetStart, snippetEnd) +
          (snippetEnd < text.length ? '…' : ''),
      };
    });

    return jsonResponse({ query: q, results, total: results.length }, 200, req, requestId);
  }

  return null;
}

export async function handleContentAnalytics(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  if (method !== 'GET' || pathParts[0] !== 'analytics' || pathParts[1] !== 'content') return null;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await db
    .from('meeting_transcriptions')
    .select(
      'word_count, speaker_count, processing_time_seconds, transcription_service, overall_confidence',
    )
    .eq('tenant_id', auth.tenantId)
    .gte('transcribed_at', since);

  if (error) {
    return errorResponse(500, 'Failed to fetch content analytics', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  const rows = data ?? [];
  const total = rows.length;
  const totalWords = rows.reduce((sum, r) => sum + Number(r.word_count ?? 0), 0);
  const avgConfidence =
    total > 0 ? rows.reduce((sum, r) => sum + Number(r.overall_confidence ?? 0), 0) / total : 0;
  const providerCounts = new Map<string, number>();
  for (const r of rows) {
    const p = String(r.transcription_service ?? 'unknown');
    providerCounts.set(p, (providerCounts.get(p) ?? 0) + 1);
  }

  return jsonResponse(
    {
      windowDays: 30,
      transcriptionsProcessed: total,
      totalWordsTranscribed: totalWords,
      averageConfidence: Number(avgConfidence.toFixed(2)),
      byProvider: Array.from(providerCounts.entries()).map(([provider, count]) => ({
        provider,
        count,
      })),
    },
    200,
    req,
    requestId,
  );
}

export async function handleSpeakerProfile(
  req: Request,
  ctx: HandlerCtx,
): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  if (method !== 'POST' || pathParts[0] !== 'speakers' || pathParts[1] !== 'profile') return null;

  let body: {
    speakerId?: string;
    meetingId?: string;
    name?: string;
    email?: string;
    role?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body', req, {
      code: 'INVALID_JSON',
      requestId,
    });
  }

  if (!body.meetingId || !body.name) {
    return errorResponse(400, 'meetingId and name are required', req, {
      code: 'VALIDATION',
      requestId,
    });
  }

  const { data, error } = await db
    .from('meeting_speakers')
    .upsert(
      {
        tenant_id: auth.tenantId,
        meeting_id: body.meetingId,
        speaker_id: body.speakerId ?? `speaker-${Date.now()}`,
        speaker_name: body.name,
        speaker_email: body.email ?? null,
        speaker_role: body.role ?? null,
      },
      { onConflict: 'tenant_id,meeting_id,speaker_id' },
    )
    .select('*')
    .single();

  if (error) {
    return errorResponse(500, 'Failed to upsert speaker profile', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }

  return jsonResponse(data, 200, req, requestId);
}
