// Stack Exchange community-question adapter (US-BLOG-017)
//
// Uses the public Stack Exchange API v2.3. Works keyless (300 req/day/IP) but
// an application `key` raises the quota to 10k/day — passed through when set.
// `handle` is the SE site param (e.g. 'stackoverflow', 'superuser', 'serverfault').
//
// Flow:
//   - With a query: GET /search/advanced?q=...&site=...&sort=relevance&answers=1
//   - Without:      GET /questions?site=...&sort=votes&filter=...
//   The `withbody` filter returns question bodies; we then fetch the accepted
//   (or top) answer body via /questions/{ids}/answers for the top N.

import {
  type CommunityAdapter,
  type CommunityCredentials,
  type MineOptions,
  type MineResult,
  type MinedQuestion,
  CommunityAdapterError,
} from './adapter.ts';

const API_BASE = 'https://api.stackexchange.com/2.3';
// Filter that includes question + answer bodies (Stack Exchange "filter" param).
// '!nNPvSNdWme' is the well-known withbody filter; falls back gracefully if SE
// rejects it (the API just omits body fields).
const WITHBODY_FILTER = '!nNPvSNdWme';

interface SeQuestion {
  question_id: number;
  title: string;
  body?: string;
  link: string;
  score?: number;
  answer_count?: number;
  accepted_answer_id?: number;
}

interface SeAnswer {
  answer_id: number;
  question_id: number;
  body?: string;
  score?: number;
  is_accepted?: boolean;
}

interface SeResponse<T> {
  items?: T[];
  error_message?: string;
  backoff?: number;
}

function withKey(url: string, creds: CommunityCredentials): string {
  return creds.apiKey ? `${url}&key=${encodeURIComponent(creds.apiKey)}` : url;
}

function stripHtml(html: string | undefined): string | null {
  if (!html) return null;
  return (
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000) || null
  );
}

async function seGet<T>(
  url: string,
  creds: CommunityCredentials,
  signal?: AbortSignal,
): Promise<SeResponse<T>> {
  const res = await fetch(withKey(url, creds), { signal });
  if (!res.ok) throw new CommunityAdapterError(`Stack Exchange API ${res.status}`, res.status);
  const json = (await res.json()) as SeResponse<T>;
  if (json.error_message) throw new CommunityAdapterError(`Stack Exchange: ${json.error_message}`);
  return json;
}

export const stackExchangeAdapter: CommunityAdapter = {
  source: 'stackexchange',
  async mine(
    creds: CommunityCredentials,
    handle: string,
    options: MineOptions = {},
  ): Promise<MineResult> {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const site = handle.trim() || 'stackoverflow';
    const warnings: string[] = [];

    const base = options.query
      ? `${API_BASE}/search/advanced?order=desc&sort=relevance&answers=1&pagesize=${limit}` +
        `&q=${encodeURIComponent(options.query)}&site=${encodeURIComponent(site)}` +
        `&filter=${WITHBODY_FILTER}`
      : `${API_BASE}/questions?order=desc&sort=votes&pagesize=${limit}` +
        `&site=${encodeURIComponent(site)}&filter=${WITHBODY_FILTER}`;

    let qResp: SeResponse<SeQuestion>;
    try {
      qResp = await seGet<SeQuestion>(base, creds, options.signal);
    } catch (err) {
      warnings.push(`${site}: ${err instanceof Error ? err.message : 'fetch failed'}`);
      return { questions: [], warnings };
    }
    const items = qResp.items ?? [];
    if (items.length === 0) return { questions: [], warnings };

    // Fetch answer bodies for the top 20 questions in one batched call.
    const topIds = items.slice(0, 20).map((q) => q.question_id);
    const answerByQuestion = new Map<number, string>();
    if (topIds.length > 0) {
      try {
        const aResp = await seGet<SeAnswer>(
          `${API_BASE}/questions/${topIds.join(';')}/answers?order=desc&sort=votes` +
            `&site=${encodeURIComponent(site)}&filter=${WITHBODY_FILTER}`,
          creds,
          options.signal,
        );
        for (const a of aResp.items ?? []) {
          // Keep the first (highest-voted) answer per question, preferring accepted.
          const body = stripHtml(a.body);
          if (!body) continue;
          if (a.is_accepted || !answerByQuestion.has(a.question_id)) {
            answerByQuestion.set(a.question_id, body);
          }
        }
      } catch (err) {
        warnings.push(`${site} answers: ${err instanceof Error ? err.message : 'fetch failed'}`);
      }
    }

    const questions: MinedQuestion[] = items.map((q) => ({
      externalId: String(q.question_id),
      url: q.link,
      title: q.title,
      body: stripHtml(q.body),
      topAnswer: answerByQuestion.get(q.question_id) ?? null,
      score: typeof q.score === 'number' ? q.score : null,
      answerCount: typeof q.answer_count === 'number' ? q.answer_count : null,
      raw: { question_id: q.question_id, site },
    }));
    return { questions, warnings };
  },
};
