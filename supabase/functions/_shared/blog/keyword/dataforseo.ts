// DataForSEO Keyword Research Adapter (US-BLOG-013)
//
// Implements `KeywordAdapter` against the DataForSEO Keywords Data API v3.
// Auth: HTTP Basic (login + password).
// Base URL: https://api.dataforseo.com/v3
//
// API surface used:
//   POST /keywords_data/google_ads/search_volume/live
//          → search volume, CPC, competition for up to 1,000 keywords
//   POST /keywords_data/google_ads/keywords_for_keywords/live
//          → related keywords for a seed
//   POST /serp/google/autocomplete/live/advanced
//          → autocomplete suggestions
//   GET  /v3/appendix/user_data
//          → balance + plan (used for healthCheck)
//
// Cost reporting: every DataForSEO response includes `cost` (USD). We round
// up to cents for the per-call ledger entry.

import {
  type AdapterCost,
  type AutocompleteResult,
  type KeywordAdapter,
  type KeywordCredentials,
  type KeywordHealthCheckResult,
  type KeywordMetric,
  type KeywordSearchVolumeResult,
  type RelatedKeyword,
  type RelatedKeywordsResult,
  KeywordAdapterAuthError,
  KeywordAdapterError,
} from './adapter.ts';

const DEFAULT_BASE_URL = 'https://api.dataforseo.com';

interface DfsEnvelope<T> {
  status_code: number;
  status_message: string;
  cost: number; // total cost across all tasks, in USD
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    cost: number;
    result_count: number;
    result: T[] | null;
  }>;
}

interface DfsSearchVolumeResult {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  competition_index: number | null;
  monthly_searches: Array<{ year: number; month: number; search_volume: number }> | null;
  search_intent_info?: { main_intent?: string; foreign_intent?: string[] };
}

interface DfsAutocompleteResult {
  items: Array<{
    type: string;
    keyword: string;
    rank_group: number;
    rank_absolute: number;
  }>;
}

const INTENT_MAP: Record<string, KeywordMetric['intent']> = {
  informational: 'informational',
  commercial: 'commercial',
  transactional: 'transactional',
  navigational: 'navigational',
};

export const dataforseoAdapter: KeywordAdapter = {
  platform: 'dataforseo',

  async healthCheck(creds) {
    try {
      const json = await dfsFetch<{
        money: { balance?: number; total?: number };
        plan?: string;
      }>(creds, '/v3/appendix/user_data', { method: 'GET' });

      const balance = json.money?.balance;
      return {
        ok: true,
        message:
          balance !== undefined
            ? `USD ${balance.toFixed(2)} balance${json.plan ? ` (${json.plan})` : ''}`
            : 'Reachable',
        version: 'v3',
        checked_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Network error',
        checked_at: new Date().toISOString(),
      };
    }
  },

  async searchVolume(creds, keywords, opts) {
    if (keywords.length === 0) {
      return { metrics: [], cost: { cents: 0 } };
    }

    const body = [
      {
        keywords: keywords.slice(0, 1000),
        location_code: opts?.location_code ?? 2840, // US
        language_code: opts?.language_code ?? 'en',
        search_partners: false,
      },
    ];

    const env = await dfsRpc<DfsSearchVolumeResult>(
      creds,
      '/v3/keywords_data/google_ads/search_volume/live',
      body,
    );

    const flat: KeywordMetric[] = [];
    for (const task of env.tasks) {
      for (const r of task.result ?? []) {
        flat.push(toKeywordMetric(r));
      }
    }

    return {
      metrics: flat,
      cost: usdToCents(env.cost, `DataForSEO search_volume: ${keywords.length} keywords`),
    };
  },

  async relatedKeywords(creds, seeds, opts) {
    if (seeds.length === 0) {
      return { related: [], cost: { cents: 0 } };
    }

    const body = [
      {
        keywords: seeds.slice(0, 200),
        location_code: opts?.location_code ?? 2840,
        language_code: opts?.language_code ?? 'en',
        limit: Math.min(opts?.limit ?? 100, 1000),
      },
    ];

    const env = await dfsRpc<DfsSearchVolumeResult & { related_keywords?: string[] }>(
      creds,
      '/v3/keywords_data/google_ads/keywords_for_keywords/live',
      body,
    );

    const flat: RelatedKeyword[] = [];
    for (const task of env.tasks) {
      for (const r of task.result ?? []) {
        const m = toKeywordMetric(r);
        flat.push({
          ...m,
          // DataForSEO doesn't return a relevance score on this endpoint;
          // leave null and let downstream rank by search_volume/difficulty.
          relevance: null,
        });
      }
    }

    return {
      related: flat,
      cost: usdToCents(env.cost, `DataForSEO keywords_for_keywords: ${seeds.length} seeds`),
    };
  },

  async autocomplete(creds, seed, opts) {
    const body = [
      {
        keyword: seed,
        location_code: opts?.location_code ?? 2840,
        language_code: opts?.language_code ?? 'en',
      },
    ];

    const env = await dfsRpc<DfsAutocompleteResult>(
      creds,
      '/v3/serp/google/autocomplete/live/advanced',
      body,
    );

    const suggestions: AutocompleteResult['suggestions'] = [];
    for (const task of env.tasks) {
      for (const r of task.result ?? []) {
        for (const item of r.items ?? []) {
          suggestions.push({
            keyword: item.keyword,
            rank: item.rank_absolute,
          });
        }
      }
    }
    suggestions.sort((a, b) => a.rank - b.rank);

    return {
      suggestions,
      cost: usdToCents(env.cost, `DataForSEO autocomplete: "${seed}"`),
    };
  },
};

// ─── helpers ───

function authHeader(creds: KeywordCredentials): Record<string, string> {
  const password = creds.apiSecret ?? '';
  const basic = btoa(`${creds.apiKey}:${password}`);
  return { Authorization: `Basic ${basic}` };
}

async function dfsFetch<T>(creds: KeywordCredentials, path: string, init: RequestInit): Promise<T> {
  const base = (creds.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...authHeader(creds),
      Accept: 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text };
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new KeywordAdapterAuthError('dataforseo', `${res.status} ${res.statusText}`);
    }
    const detail =
      body && typeof body === 'object' && 'status_message' in body
        ? String((body as { status_message: unknown }).status_message)
        : `${res.status} ${res.statusText}`;
    throw new KeywordAdapterError('dataforseo', res.status, detail, body);
  }
  return body as T;
}

async function dfsRpc<T>(
  creds: KeywordCredentials,
  path: string,
  body: unknown,
): Promise<DfsEnvelope<T>> {
  const env = await dfsFetch<DfsEnvelope<T>>(creds, path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  // 20000 = "Ok." in DFS conventions; anything else is a logical error.
  if (env.status_code !== 20000) {
    throw new KeywordAdapterError(
      'dataforseo',
      env.status_code,
      env.status_message ?? 'DataForSEO error',
      env,
    );
  }
  return env;
}

function toKeywordMetric(r: DfsSearchVolumeResult): KeywordMetric {
  const intentRaw = r.search_intent_info?.main_intent;
  const intent =
    intentRaw && INTENT_MAP[intentRaw.toLowerCase()] ? INTENT_MAP[intentRaw.toLowerCase()] : null;

  // DataForSEO's competition_index is 0-100; treat as keyword_difficulty proxy.
  const difficulty = r.competition_index != null ? Math.round(r.competition_index) : null;

  const trend =
    r.monthly_searches && r.monthly_searches.length > 0
      ? r.monthly_searches
          .slice()
          .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))
          .slice(-12)
          .map((m) => m.search_volume)
      : null;

  return {
    keyword: r.keyword,
    search_volume: r.search_volume,
    keyword_difficulty: difficulty,
    cpc: r.cpc,
    intent,
    trend_12mo: trend,
    raw: r as unknown as Record<string, unknown>,
  };
}

function usdToCents(usd: number, detail?: string): AdapterCost | null {
  if (typeof usd !== 'number' || !isFinite(usd) || usd < 0) return null;
  return {
    cents: Math.ceil(usd * 100),
    detail,
  };
}
