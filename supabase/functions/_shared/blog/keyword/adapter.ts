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

// SERP types (US-BLOG-015) ---------------------------------------------------
export interface SerpOrganicResult {
  rank: number;
  url: string;
  title: string;
  description: string | null;
  domain: string;
}

export interface SerpPaaItem {
  question: string;
  answer: string | null;
  url: string | null;
}

export interface SerpFeaturedSnippet {
  url: string;
  title: string;
  text: string | null;
}

export interface SerpFeatures {
  /** Top "People also ask" questions when present. */
  paa: SerpPaaItem[];
  featured_snippet: SerpFeaturedSnippet | null;
  knowledge_panel: { title: string; description: string | null } | null;
  /** Whether a video pack appeared in the SERP. */
  has_video_pack: boolean;
  /** Whether an image pack appeared in the SERP. */
  has_image_pack: boolean;
  /** Whether a local pack appeared in the SERP. */
  has_local_pack: boolean;
}

export interface SerpFetchResult {
  organic: SerpOrganicResult[];
  features: SerpFeatures;
  cost: AdapterCost | null;
}

// Ranked-keywords (US-BLOG-018) -------------------------------------------
export interface RankedKeyword extends KeywordMetric {
  /** SERP rank for the domain on this keyword (1 = top). */
  rank: number | null;
  /** The exact URL on the target domain that ranks. */
  url: string | null;
}

export interface RankedKeywordsForDomainResult {
  domain: string;
  keywords: RankedKeyword[];
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

  /**
   * Fetch the full SERP for a keyword: top organic results + SERP features.
   * Returns top 20 organic results when available. The adapter does NOT fetch
   * per-URL HTML for word-count parsing — that's the caller's responsibility.
   * Optional: an adapter that doesn't support SERP fetching can omit this
   * method; callers should feature-detect.
   */
  fetchSerp?(
    creds: KeywordCredentials,
    keyword: string,
    opts?: { location_code?: number; language_code?: string; depth?: number },
  ): Promise<SerpFetchResult>;

  /**
   * Pull keywords a domain currently ranks for. Used by gap analysis
   * (US-BLOG-018): scan competitors + own domain, then diff the keyword sets.
   * Optional: adapters that lack a domain-ranking lookup omit this method.
   */
  rankedKeywords?(
    creds: KeywordCredentials,
    domain: string,
    opts?: {
      location_code?: number;
      language_code?: string;
      limit?: number;
      /** Optional rank ceiling — only return keywords where rank <= maxRank. */
      max_rank?: number;
    },
  ): Promise<RankedKeywordsForDomainResult>;
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
