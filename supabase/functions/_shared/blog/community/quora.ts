// Quora community-question adapter (US-BLOG-017)
//
// Quora has no public API and its ToS forbids unauthorized scraping. Per the
// PRD AC ("scrape within ToS OR use Bright Data adapter"), this adapter routes
// through a configured Bright Data (or compatible) collector endpoint rather
// than hitting quora.com directly. When no `baseUrl` collector is configured,
// it returns a clear, non-fatal warning so the miner can proceed with the
// other sources instead of failing the whole run.
//
// The collector is expected to accept `{ topic, limit }` and return
// `{ items: [{ id, url, title, body, top_answer, ... }] }`. This keeps Printyx
// out of the scraping business while satisfying the source-coverage AC.

import {
  type CommunityAdapter,
  type CommunityCredentials,
  type MineOptions,
  type MineResult,
  type MinedQuestion,
  CommunityAdapterError,
} from './adapter.ts';

interface CollectorItem {
  id?: string;
  url?: string;
  title?: string;
  body?: string;
  top_answer?: string;
  score?: number;
  answer_count?: number;
}

export const quoraAdapter: CommunityAdapter = {
  source: 'quora',
  async mine(
    creds: CommunityCredentials,
    handle: string,
    options: MineOptions = {},
  ): Promise<MineResult> {
    const warnings: string[] = [];
    if (!creds.baseUrl) {
      warnings.push(
        'Quora: no Bright Data collector configured (set baseUrl on the quora target) — skipped to stay within ToS.',
      );
      return { questions: [], warnings };
    }
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const res = await fetch(creds.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(creds.accessToken ? { Authorization: `Bearer ${creds.accessToken}` } : {}),
      },
      body: JSON.stringify({ topic: handle, query: options.query, limit }),
      signal: options.signal,
    });
    if (!res.ok) {
      throw new CommunityAdapterError(`Quora collector ${res.status}`, res.status);
    }
    const json = (await res.json()) as { items?: CollectorItem[] };
    const questions: MinedQuestion[] = (json.items ?? [])
      .filter((it) => it.url && it.title)
      .map((it) => ({
        externalId: it.id ?? it.url!,
        url: it.url!,
        title: it.title!,
        body: it.body ? it.body.slice(0, 4000) : null,
        topAnswer: it.top_answer ? it.top_answer.slice(0, 4000) : null,
        score: typeof it.score === 'number' ? it.score : null,
        answerCount: typeof it.answer_count === 'number' ? it.answer_count : null,
        raw: { topic: handle },
      }));
    return { questions, warnings };
  },
};
