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
  type RankedKeyword,
  type RankedKeywordsForDomainResult,
  type RelatedKeyword,
  type RelatedKeywordsResult,
  type SerpFeatures,
  type SerpFetchResult,
  type SerpOrganicResult,
  type SerpPaaItem,
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

interface DfsSerpItem {
  type: string;
  rank_group?: number;
  rank_absolute?: number;
  url?: string;
  domain?: string;
  title?: string;
  description?: string;
  /** PAA expanded answers. */
  expanded_element?: Array<{ url?: string; description?: string }>;
  /** Nested PAA items. */
  items?: Array<{
    title?: string;
    description?: string;
    expanded_element?: Array<{ url?: string; description?: string }>;
  }>;
}

interface DfsSerpResult {
  items: DfsSerpItem[];
}

interface DfsRankedKeywordItem {
  keyword_data?: {
    keyword?: string;
    keyword_info?: {
      search_volume?: number | null;
      cpc?: number | null;
      competition_index?: number | null;
    };
    keyword_properties?: { keyword_difficulty?: number | null };
    search_intent_info?: { main_intent?: string };
  };
  ranked_serp_element?: {
    serp_item?: {
      rank_absolute?: number;
      url?: string;
      title?: string;
    };
  };
}

interface DfsRankedKeywordsResult {
  items: DfsRankedKeywordItem[];
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

  async fetchSerp(creds, keyword, opts) {
    const depth = opts?.depth ?? 20;
    const body = [
      {
        keyword,
        location_code: opts?.location_code ?? 2840,
        language_code: opts?.language_code ?? 'en',
        depth,
      },
    ];

    const env = await dfsRpc<DfsSerpResult>(creds, '/v3/serp/google/organic/live/advanced', body);

    const organic: SerpOrganicResult[] = [];
    const features: SerpFeatures = {
      paa: [],
      featured_snippet: null,
      knowledge_panel: null,
      has_video_pack: false,
      has_image_pack: false,
      has_local_pack: false,
    };

    for (const task of env.tasks) {
      for (const r of task.result ?? []) {
        for (const item of r.items ?? []) {
          switch (item.type) {
            case 'organic': {
              if (organic.length >= depth) break;
              organic.push({
                rank: item.rank_absolute ?? organic.length + 1,
                url: item.url ?? '',
                title: item.title ?? '',
                description: item.description ?? null,
                domain: item.domain ?? extractDomain(item.url ?? ''),
              });
              break;
            }
            case 'featured_snippet': {
              features.featured_snippet = {
                url: item.url ?? '',
                title: item.title ?? '',
                text: item.description ?? null,
              };
              break;
            }
            case 'people_also_ask': {
              const expanded = item.items ?? [];
              for (const paa of expanded) {
                const seed: SerpPaaItem = {
                  question: paa.title ?? '',
                  answer: paa.description ?? paa.expanded_element?.[0]?.description ?? null,
                  url: paa.expanded_element?.[0]?.url ?? null,
                };
                if (seed.question) features.paa.push(seed);
              }
              break;
            }
            case 'knowledge_graph': {
              features.knowledge_panel = {
                title: item.title ?? '',
                description: item.description ?? null,
              };
              break;
            }
            case 'video':
            case 'top_stories':
              features.has_video_pack = true;
              break;
            case 'images':
              features.has_image_pack = true;
              break;
            case 'local_pack':
            case 'map':
              features.has_local_pack = true;
              break;
          }
        }
      }
    }

    organic.sort((a, b) => a.rank - b.rank);

    return {
      organic,
      features,
      cost: usdToCents(env.cost, `DataForSEO SERP: "${keyword}"`),
    };
  },

  async rankedKeywords(creds, domain, opts) {
    const limit = Math.min(opts?.limit ?? 1000, 1000);
    const body = [
      {
        target: cleanDomain(domain),
        location_code: opts?.location_code ?? 2840,
        language_code: opts?.language_code ?? 'en',
        limit,
        ignore_synonyms: true,
        // Server-side filter: prune anything past max_rank when supplied.
        filters: opts?.max_rank
          ? [['ranked_serp_element.serp_item.rank_absolute', '<=', opts.max_rank]]
          : undefined,
      },
    ];

    const env = await dfsRpc<DfsRankedKeywordsResult>(
      creds,
      '/v3/dataforseo_labs/google/ranked_keywords/live',
      body,
    );

    const keywords: RankedKeyword[] = [];
    for (const task of env.tasks) {
      for (const r of task.result ?? []) {
        for (const item of r.items ?? []) {
          const kd = item.keyword_data ?? {};
          const serp = item.ranked_serp_element?.serp_item ?? {};
          const intentRaw = kd.search_intent_info?.main_intent?.toLowerCase();
          const intent = intentRaw && INTENT_MAP[intentRaw] ? INTENT_MAP[intentRaw] : null;
          const cpcVal = kd.keyword_info?.cpc;
          keywords.push({
            keyword: kd.keyword ?? serp.title ?? '',
            search_volume: kd.keyword_info?.search_volume ?? null,
            keyword_difficulty:
              kd.keyword_properties?.keyword_difficulty ??
              kd.keyword_info?.competition_index ??
              null,
            cpc: typeof cpcVal === 'number' ? cpcVal : null,
            intent,
            relevance: null,
            rank: serp.rank_absolute ?? null,
            url: serp.url ?? null,
          });
        }
      }
    }

    return {
      domain,
      keywords,
      cost: usdToCents(env.cost, `DataForSEO ranked_keywords: "${domain}"`),
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

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Strip protocol + path + www prefix so DataForSEO accepts the bare host.
 * `https://www.printyx.net/blog` → `printyx.net`.
 */
function cleanDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.split('/')[0];
  s = s.replace(/^www\./, '');
  return s;
}
