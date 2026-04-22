/**
 * Anthropic Claude API wrapper for edge functions.
 *
 * Deno-compatible — uses plain fetch, no SDK. Matches the signature of
 * the Express-side ClaudeAIService.generateCompletion() so ported handlers
 * don't need to change call sites.
 *
 * Requires env var: CLAUDE_API_KEY
 */

import { createLogger } from './logger.ts';

const log = createLogger('anthropic');

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateCompletionOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
  messages: ClaudeMessage[];
  /**
   * Optional AbortSignal for request cancellation (timeouts, etc.).
   */
  signal?: AbortSignal;
}

interface ClaudeResponse {
  content: Array<{ type: 'text'; text: string }>;
  id: string;
  model: string;
  role: 'assistant';
  stop_reason: string;
  stop_sequence: string | null;
  type: 'message';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

function getApiKey(): string {
  const key = Deno.env.get('CLAUDE_API_KEY') ?? Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) {
    throw new Error(
      'CLAUDE_API_KEY env var is required. Set it in Coolify for the edge functions service.',
    );
  }
  return key;
}

export async function generateCompletion(options: GenerateCompletionOptions): Promise<string> {
  const apiKey = getApiKey();

  const body = {
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: options.max_tokens ?? 4000,
    temperature: options.temperature ?? 0.7,
    system: options.system,
    messages: options.messages,
  };

  const t0 = Date.now();

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '<unreadable>');
    log.error(
      { status: res.status, statusText: res.statusText, body: errText.slice(0, 500) },
      'claude_api_error',
    );
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as ClaudeResponse;
  const text = json.content[0]?.text ?? '';

  log.info(
    {
      model: body.model,
      inputTokens: json.usage?.input_tokens,
      outputTokens: json.usage?.output_tokens,
      stopReason: json.stop_reason,
      durationMs: Date.now() - t0,
    },
    'claude_completion',
  );

  return text;
}
