// Blog Keyword Adapter Registry (US-BLOG-013)
//
// Single export point for all keyword research adapters. Future adapters
// (ahrefs, semrush, google-keyword-planner) register themselves here.

import type { KeywordAdapter } from './adapter.ts';
import { dataforseoAdapter } from './dataforseo.ts';

export const KEYWORD_PLATFORMS = [
  'dataforseo',
  // Phase 2: 'ahrefs', 'semrush', 'google-keyword-planner'
] as const;
export type KeywordPlatform = (typeof KEYWORD_PLATFORMS)[number];

const REGISTRY: Record<KeywordPlatform, KeywordAdapter> = {
  dataforseo: dataforseoAdapter,
};

export function getKeywordAdapter(platform: string): KeywordAdapter | null {
  return (REGISTRY as Record<string, KeywordAdapter>)[platform] ?? null;
}

export function isKeywordPlatform(platform: string): platform is KeywordPlatform {
  return (KEYWORD_PLATFORMS as readonly string[]).includes(platform);
}

export type {
  AdapterCost,
  AutocompleteResult,
  AutocompleteSuggestion,
  KeywordAdapter,
  KeywordCredentials,
  KeywordHealthCheckResult,
  KeywordMetric,
  KeywordSearchVolumeResult,
  RelatedKeyword,
  RelatedKeywordsResult,
} from './adapter.ts';
export { KeywordAdapterError, KeywordAdapterAuthError } from './adapter.ts';
