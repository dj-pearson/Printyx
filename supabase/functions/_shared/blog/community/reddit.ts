// Reddit community-question adapter (US-BLOG-017)
//
// Uses Reddit's public OAuth API. Flow:
//   1. App-only OAuth (client_credentials grant) → bearer token.
//   2. GET /r/<subreddit>/search (restrict_sr=1, sort=relevance) for question
//      posts, OR /r/<subreddit>/hot when no query is given.
//   3. For the top N posts, pull the highest-scored top-level comment as the
//      "top answer" via /comments/<id>.
//
// Honors Reddit's API rules: a descriptive User-Agent is required, and we back
// off on 429. Keyless access is NOT supported (Reddit deprecated it), so the
// adapter throws a clear auth error when credentials are missing.

import {
  type CommunityAdapter,
  type CommunityCredentials,
  type MineOptions,
  type MineResult,
  type MinedQuestion,
  CommunityAdapterError,
} from './adapter.ts';

const USER_AGENT = 'Printyx-Blog-Miner/1.0 (+https://printyx.net)';
const OAUTH_URL = 'https://www.reddit.com/api/v1/access_token';
const API_BASE = 'https://oauth.reddit.com';

interface RedditListingChild {
  kind: string;
  data: {
    name: string;
    id: string;
    title: string;
    selftext?: string;
    permalink: string;
    score?: number;
    num_comments?: number;
    body?: string;
  };
}

interface RedditListing {
  data?: { children?: RedditListingChild[] };
}

async function getAppToken(creds: CommunityCredentials, signal?: AbortSignal): Promise<string> {
  if (creds.accessToken) return creds.accessToken;
  if (!creds.clientId || !creds.clientSecret) {
    throw new CommunityAdapterError(
      'Reddit requires clientId + clientSecret (app-only OAuth).',
      401,
    );
  }
  const basic = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
    signal,
  });
  if (!res.ok) {
    throw new CommunityAdapterError(`Reddit OAuth ${res.status}`, res.status === 401 ? 401 : 502);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new CommunityAdapterError('Reddit OAuth: no access_token', 502);
  return json.access_token;
}

async function apiGet<T>(path: string, token: string, signal?: AbortSignal): Promise<T> {
  let attempt = 0;
  // One retry on 429 with a short backoff (Reddit returns X-Ratelimit headers).
  while (true) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
      signal,
    });
    if (res.status === 429 && attempt < 1) {
      attempt++;
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (!res.ok) throw new CommunityAdapterError(`Reddit API ${res.status} on ${path}`, res.status);
    return (await res.json()) as T;
  }
}

async function topComment(
  postId: string,
  token: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const json = await apiGet<RedditListing[]>(
      `/comments/${postId}?limit=1&depth=1&sort=top`,
      token,
      signal,
    );
    const comments = json?.[1]?.data?.children ?? [];
    for (const c of comments) {
      if (c.kind === 't1' && c.data.body) return c.data.body.slice(0, 4000);
    }
  } catch {
    // best-effort: a missing top comment never fails the whole mine
  }
  return null;
}

export const redditAdapter: CommunityAdapter = {
  source: 'reddit',
  async mine(
    creds: CommunityCredentials,
    handle: string,
    options: MineOptions = {},
  ): Promise<MineResult> {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const token = await getAppToken(creds, options.signal);
    const warnings: string[] = [];

    const sub = handle.replace(/^\/?r\//i, '').trim();
    const path = options.query
      ? `/r/${sub}/search?restrict_sr=1&sort=relevance&limit=${limit}&q=${encodeURIComponent(
          options.query,
        )}`
      : `/r/${sub}/hot?limit=${limit}`;

    let listing: RedditListing;
    try {
      listing = await apiGet<RedditListing>(path, token, options.signal);
    } catch (err) {
      warnings.push(`r/${sub}: ${err instanceof Error ? err.message : 'fetch failed'}`);
      return { questions: [], warnings };
    }

    const children = listing.data?.children ?? [];
    const questions: MinedQuestion[] = [];
    // Pull top comments only for the first 10 posts to keep API spend bounded.
    let commentBudget = 10;
    for (const child of children) {
      if (child.kind !== 't3') continue;
      const d = child.data;
      // Heuristic: prefer posts that read like questions.
      const looksLikeQuestion = /\?$|^(how|what|why|when|which|where|can|is|are|do|does|should)\b/i;
      if (!options.query && !looksLikeQuestion.test(d.title.trim())) continue;
      let answer: string | null = null;
      if (commentBudget > 0) {
        answer = await topComment(d.id, token, options.signal);
        commentBudget--;
      }
      questions.push({
        externalId: d.name,
        url: `https://www.reddit.com${d.permalink}`,
        title: d.title,
        body: d.selftext ? d.selftext.slice(0, 4000) : null,
        topAnswer: answer,
        score: typeof d.score === 'number' ? d.score : null,
        answerCount: typeof d.num_comments === 'number' ? d.num_comments : null,
        raw: { id: d.id, subreddit: sub },
      });
    }
    return { questions, warnings };
  },
};
