// Search intent classifier (US-BLOG-014)
//
// Classifies a keyword into one of four canonical search intents using an
// LLM. Classification quality jumps dramatically when SERP context (the top
// organic titles + snippets) is supplied, so callers should pass the most
// recent SERP snapshot for the keyword when one exists.
//
// The four canonical intents are stored verbatim on `blog_keywords.intent`
// (varchar(20)). "commercial" is the short storage form of what the PRD calls
// "commercial-investigation" — the UI renders the long label.

import { generateCompletion } from '../../anthropic.ts';
import { createLogger } from '../../logger.ts';
import { extractJsonObject } from '../llm-json.ts';

const log = createLogger('intent-classifier');

export const INTENTS = ['informational', 'commercial', 'transactional', 'navigational'] as const;

export type SearchIntent = (typeof INTENTS)[number];

export interface SerpContextItem {
  rank: number;
  title: string;
  description: string | null;
}

export interface IntentClassification {
  intent: SearchIntent;
  /** 0..1 model-reported confidence. */
  confidence: number;
  /** Short human-readable justification (kept for the audit trail + UI tooltip). */
  reasoning: string;
  /** Whether SERP context was available for this classification. */
  serp_informed: boolean;
}

const SYSTEM_PROMPT = `You are an SEO search-intent classifier. Classify a keyword into exactly one of:

- informational: the searcher wants to learn or understand something ("how to", "what is", "guide", "ideas").
- commercial: commercial-investigation — the searcher is comparing options before a purchase ("best", "vs", "review", "alternatives", "top 10").
- transactional: the searcher is ready to act/buy/sign up ("buy", "pricing", "demo", "near me", "for sale", branded product purchase).
- navigational: the searcher wants a specific site, brand, or login page.

When SERP results are provided, weigh them heavily — the page types that rank reveal real intent better than the keyword text alone.

Respond with ONLY a JSON object, no markdown, no prose:
{"intent":"informational|commercial|transactional|navigational","confidence":0.0-1.0,"reasoning":"one short sentence"}`;

function buildUserPrompt(keyword: string, serp: SerpContextItem[]): string {
  const lines: string[] = [`Keyword: "${keyword}"`];
  if (serp.length > 0) {
    lines.push('', 'Top SERP results (rank — title — snippet):');
    for (const item of serp.slice(0, 10)) {
      const desc = (item.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const title = (item.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
      lines.push(`${item.rank}. ${title}${desc ? ` — ${desc}` : ''}`);
    }
  } else {
    lines.push('', 'No SERP context available — classify from the keyword text alone.');
  }
  return lines.join('\n');
}

function coerceIntent(value: unknown): SearchIntent {
  const v = String(value ?? '')
    .toLowerCase()
    .trim();
  if ((INTENTS as readonly string[]).includes(v)) return v as SearchIntent;
  // Tolerate common synonyms the model might emit.
  if (v.startsWith('commercial') || v === 'comparison') return 'commercial';
  if (v.startsWith('transac') || v === 'buy') return 'transactional';
  if (v.startsWith('nav') || v === 'brand') return 'navigational';
  return 'informational';
}

function coerceConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return n > 100 ? 1 : n / 100; // tolerate 0-100 scale
  return n;
}

/**
 * Classify a single keyword. `serp` should be the top organic results for the
 * keyword (titles + snippets); pass an empty array when no snapshot exists.
 */
export async function classifyIntent(
  keyword: string,
  serp: SerpContextItem[] = [],
  signal?: AbortSignal,
): Promise<IntentClassification> {
  const raw = await generateCompletion({
    max_tokens: 300,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(keyword, serp) }],
    signal,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(raw) as Record<string, unknown>;
  } catch (err) {
    log.error(
      { keyword, raw: raw.slice(0, 300), err: err instanceof Error ? err.message : String(err) },
      'intent_parse_failed',
    );
    // Degrade gracefully rather than fail the whole batch.
    return {
      intent: 'informational',
      confidence: 0,
      reasoning: 'Classifier returned an unparseable response; defaulted to informational.',
      serp_informed: serp.length > 0,
    };
  }

  return {
    intent: coerceIntent(parsed.intent),
    confidence: coerceConfidence(parsed.confidence),
    reasoning: String(parsed.reasoning ?? '').slice(0, 500),
    serp_informed: serp.length > 0,
  };
}
