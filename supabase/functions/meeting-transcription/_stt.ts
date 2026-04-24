// Speech-to-text wrapper. Controlled by TRANSCRIPTION_PROVIDER env var:
//
//   TRANSCRIPTION_PROVIDER=stub      (default) returns placeholder text; no spend
//   TRANSCRIPTION_PROVIDER=whisper   calls OpenAI Whisper (OPENAI_API_KEY required)
//
// Stub mode is the safety net — it lets the endpoint return 200 with mock
// content so the frontend can render "transcription pending" UX even when
// there's no STT spend budget. Same pattern as _shared/sendgrid.ts simulation
// mode from Phase 2 and mfa/_twilio.ts from Phase 5.

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  provider: string;
  processingTimeMs: number;
}

export class TranscriptionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionUnavailableError';
  }
}

function provider(): 'stub' | 'whisper' {
  const raw = (Deno.env.get('TRANSCRIPTION_PROVIDER') ?? 'stub').toLowerCase();
  return raw === 'whisper' ? 'whisper' : 'stub';
}

export async function transcribe(
  audio: Blob,
  opts: { language?: string } = {},
): Promise<TranscriptionResult> {
  const t0 = Date.now();
  const p = provider();

  if (p === 'stub') {
    return {
      text: '[Stub transcription — set TRANSCRIPTION_PROVIDER=whisper and OPENAI_API_KEY to enable real STT]',
      segments: [
        {
          start: 0,
          end: 10,
          text: '[Stub transcription — real STT disabled]',
          speaker: 'Speaker 1',
          confidence: 0.0,
        },
      ],
      language: opts.language ?? 'en',
      provider: 'stub',
      processingTimeMs: Date.now() - t0,
    };
  }

  // Whisper path.
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new TranscriptionUnavailableError(
      'TRANSCRIPTION_PROVIDER=whisper but OPENAI_API_KEY is unset',
    );
  }

  const form = new FormData();
  // Whisper requires a filename — use a generic one; the actual mime comes
  // from the Blob type.
  form.append('file', audio, 'audio.mp3');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  if (opts.language) form.append('language', opts.language);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>');
    throw new TranscriptionUnavailableError(`Whisper ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    text: string;
    language?: string;
    segments?: Array<{
      start: number;
      end: number;
      text: string;
      avg_logprob?: number;
      no_speech_prob?: number;
    }>;
  };

  const segments: TranscriptionSegment[] = (data.segments ?? []).map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
    // Whisper doesn't label speakers; diarization would need a separate pass.
    confidence: typeof s.avg_logprob === 'number' ? Math.exp(s.avg_logprob) : undefined,
  }));

  return {
    text: data.text,
    segments,
    language: data.language ?? opts.language ?? 'en',
    provider: 'whisper',
    processingTimeMs: Date.now() - t0,
  };
}
