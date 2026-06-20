// Blog Community Question Adapter Registry (US-BLOG-017)
//
// Single export point for forum/community miners. Keyed by `source` so the
// blog-community-questions edge function can dispatch per configured seed.

import type { CommunityAdapter } from './adapter.ts';
import { redditAdapter } from './reddit.ts';
import { stackExchangeAdapter } from './stackexchange.ts';
import { quoraAdapter } from './quora.ts';

export const COMMUNITY_SOURCES = ['reddit', 'stackexchange', 'quora'] as const;
export type CommunitySource = (typeof COMMUNITY_SOURCES)[number];

const REGISTRY: Record<CommunitySource, CommunityAdapter> = {
  reddit: redditAdapter,
  stackexchange: stackExchangeAdapter,
  quora: quoraAdapter,
};

export function getCommunityAdapter(source: string): CommunityAdapter | null {
  return (REGISTRY as Record<string, CommunityAdapter>)[source] ?? null;
}

export function isCommunitySource(source: string): source is CommunitySource {
  return (COMMUNITY_SOURCES as readonly string[]).includes(source);
}

export type {
  CommunityAdapter,
  CommunityCredentials,
  MineOptions,
  MineResult,
  MinedQuestion,
} from './adapter.ts';
export { CommunityAdapterError } from './adapter.ts';
