// Blog Keyword Research Adapter Contract (US-BLOG-013)
//
// Every keyword adapter (DataForSEO, future Ahrefs / SEMrush /
// google-keyword-planner) implements this interface. The Ideas surface and
// auto-brief generator (US-BLOG-014..023) call these methods via a registry
// keyed by `blog_distribution_targets.platform` (yes, we reuse the shipped
// table — it's effectively "external API connections" with platform as the
// discriminator).
//
// Cost tracking lives on every method's return value (`cost_cents`) so the
// caller can persist it to a future ai_costs ledger (US-BLOG-079) once that
// table lands. Adapters that don't expose pricing return null.

export interface KeywordCredentials {
  baseUrl?: string;
  /** DataForSEO: API "login" identifier. Other adapters: API key. */
  apiKey: string;
  /** DataForSEO: API "password". Other adapters: omit. */
  apiSecret?: string;
}

export interface KeywordMetric {
  keyword: string;
  /** Monthly search volume from the adapter's index. */
  search_volume: number | null;
  /** 0-100 difficulty score; null if the adapter doesn't compute one. */
  keyword_difficulty: number | null;
  /** Cost-per-click in USD (best-effort; adapters normalize to USD). */
  cpc: number | null;
  /** Search intent classification when available. */
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational' | 'mixed' | null;
  /** Trend, last 12 months — array of monthly volumes (most recent last). */
  trend_12mo: number[] | null;
  /** Vendor-native fields preserved for round-trip / debug. */
  raw: Record<string, unknown>;
}

export interface RelatedKeyword extends KeywordMetric {
  /** Relevance score from the adapter (0-1 normalized). */
  relevance: number | null;
}

export interface AutocompleteSuggestion {
  keyword: string;
  /** Position in the autocomplete list (lower = more prominent). */
  rank: number;
}

export interface KeywordHealthCheckResult {
  ok: boolean;
  /** Balance / plan info when reachable (e.g. "USD 12.34" for DataForSEO). */
  message?: string;
  /** Adapter version / API version. */
  version?: string;
  checked_at: string;
}

/**
 * Per-call cost reporting. Adapters that don't expose pricing return null;
 * the caller treats null as "unknown cost" and skips the ledger entry.
 */
export interface AdapterCost {
  /** Estimated cost in cents (USD). */
  cents: number;
  /** Vendor-native cost description for the audit log. */
  detail?: string;
}

export interface KeywordSearchVolumeResult {
  metrics: KeywordMetric[];
  cost: AdapterCost | null;
}

export interface RelatedKeywordsResult {
  related: RelatedKeyword[];
  cost: AdapterCost | null;
}

export interface AutocompleteResult {
  suggestions: AutocompleteSuggestion[];
  cost: AdapterCost | null;
}

export interface KeywordAdapter {
  readonly platform: string;

  healthCheck(creds: KeywordCredentials): Promise<KeywordHealthCheckResult>;

  /**
   * Pull search volume + difficulty + CPC for a list of keywords. Adapters
   * batch internally; callers can supply up to 1,000 keywords per call.
   */
  searchVolume(
    creds: KeywordCredentials,
    keywords: string[],
    opts?: { location_code?: number; language_code?: string },
  ): Promise<KeywordSearchVolumeResult>;

  /**
   * Find keywords semantically related to a seed list.
   */
  relatedKeywords(
    creds: KeywordCredentials,
    seeds: string[],
    opts?: { limit?: number; location_code?: number; language_code?: string },
  ): Promise<RelatedKeywordsResult>;

  /**
   * Pull search-engine autocomplete suggestions for a single seed.
   */
  autocomplete(
    creds: KeywordCredentials,
    seed: string,
    opts?: { location_code?: number; language_code?: string },
  ): Promise<AutocompleteResult>;
}

export class KeywordAdapterError extends Error {
  constructor(
    public readonly platform: string,
    public readonly status: number,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'KeywordAdapterError';
  }
}

export class KeywordAdapterAuthError extends KeywordAdapterError {
  constructor(platform: string, detail = 'authentication failed') {
    super(platform, 401, `${platform}: ${detail}`);
    this.name = 'KeywordAdapterAuthError';
  }
}
