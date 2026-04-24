/**
 * OpenAI embeddings wrapper for edge functions.
 *
 * Deno-compatible — plain fetch, no SDK. Only the embeddings endpoint is wired;
 * if you need chat/completion, use _shared/anthropic.ts (Claude is our default).
 *
 * Requires env var: OPENAI_API_KEY. When unset, `createEmbedding` returns null
 * so callers can degrade gracefully (e.g. fall back to textual search). This
 * mirrors the simulation-mode pattern used by _shared/sendgrid.ts and
 * mfa/_twilio.ts.
 */

import { createLogger } from './logger.ts';

const log = createLogger('openai');

const API_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_MODEL = 'text-embedding-3-small'; // 1536 dims, OpenAI's current recommendation
const DEFAULT_TIMEOUT_MS = 15_000;

export class OpenAIRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`OpenAI rate limited. Retry after ${retryAfterSeconds}s.`);
    this.name = 'OpenAIRateLimitError';
  }
}

export class OpenAIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAIUnavailableError';
  }
}

function getApiKey(): string | null {
  try {
    return Deno.env.get('OPENAI_API_KEY') ?? null;
  } catch {
    return null;
  }
}

/**
 * Generate an embedding vector for the given text.
 *
 * Returns `null` when OPENAI_API_KEY is unset (simulation mode for dev + tests).
 * Throws {@link OpenAIRateLimitError} on 429 so handlers can surface 503 to the
 * client with a retryable signal. Throws {@link OpenAIUnavailableError} on
 * other failures.
 */
export async function createEmbedding(
  text: string,
  opts: { model?: string; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<number[] | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    log.warn({}, 'openai_key_missing — returning null (simulation mode)');
    return null;
  }

  const model = opts.model ?? DEFAULT_MODEL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  // Chain caller's signal into our timeout controller.
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const t0 = Date.now();

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text, model }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '60');
      throw new OpenAIRateLimitError(Number.isFinite(retryAfter) ? retryAfter : 60);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable>');
      log.error({ status: res.status, body: body.slice(0, 500) }, 'openai_embedding_error');
      throw new OpenAIUnavailableError(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
      model: string;
      usage: { prompt_tokens: number; total_tokens: number };
    };

    const vec = json.data[0]?.embedding;
    if (!vec || !Array.isArray(vec)) {
      throw new OpenAIUnavailableError('OpenAI response missing embedding vector');
    }

    log.info(
      {
        model: json.model,
        dims: vec.length,
        tokens: json.usage?.total_tokens,
        durationMs: Date.now() - t0,
      },
      'openai_embedding',
    );

    return vec;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Cosine similarity between two equal-length vectors.
 * Used for in-memory re-ranking or client-side comparisons when we read a
 * small candidate set from the DB and want to rank by similarity to the query.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
