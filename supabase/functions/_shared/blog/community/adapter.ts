// Blog Community Question Adapter Contract (US-BLOG-017)
//
// Every community source (Reddit, Stack Exchange, Quora/Bright Data) implements
// this interface. The community-question miner calls these via a registry keyed
// by `source` ('reddit' | 'stackexchange' | 'quora'). Each adapter is
// responsible for ToS-compliant access to its platform.
//
// Adapters return normalized `MinedQuestion` rows; the miner handles dedup,
// persistence, and LLM theme clustering — keeping adapters thin and testable.

export interface CommunityCredentials {
  /** OAuth client id / app key (Reddit, Quora via Bright Data). Optional for
   *  Stack Exchange read-only access (which works keyless but heavily throttled). */
  clientId?: string;
  /** OAuth client secret / API password. */
  clientSecret?: string;
  /** Optional bearer/app token if the caller already minted one. */
  accessToken?: string;
  /** Stack Exchange application key (raises the daily quota from 300 to 10k). */
  apiKey?: string;
  /** Bright Data (or other proxy) endpoint for Quora scraping. */
  baseUrl?: string;
}

export interface MinedQuestion {
  /** Stable per-source id used for dedup (reddit fullname, SE question_id,
   *  quora url hash). */
  externalId: string;
  url: string;
  title: string;
  body: string | null;
  topAnswer: string | null;
  /** Upvotes / score (reddit ups, SE score). null when the source has none. */
  score: number | null;
  answerCount: number | null;
  /** Vendor-native fields preserved for round-trip / debug. */
  raw: Record<string, unknown>;
}

export interface MineOptions {
  /** Max questions to pull per handle (subreddit / site / topic). */
  limit?: number;
  /** Free-text query to filter within the handle, when the source supports it. */
  query?: string;
  /** Cancellation. */
  signal?: AbortSignal;
}

export interface MineResult {
  questions: MinedQuestion[];
  /** Non-fatal per-handle warnings (rate limits, empty results). */
  warnings: string[];
}

export interface CommunityAdapter {
  readonly source: 'reddit' | 'stackexchange' | 'quora';
  /**
   * Mine questions from a single handle (subreddit name, SE site param, or
   * Quora topic slug). Implementations MUST capture the canonical source URL
   * for every question (E-E-A-T citation requirement).
   */
  mine(creds: CommunityCredentials, handle: string, options?: MineOptions): Promise<MineResult>;
}

export class CommunityAdapterError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'CommunityAdapterError';
    this.status = status;
  }
}
