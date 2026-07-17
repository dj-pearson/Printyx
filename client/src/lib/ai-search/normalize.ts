/**
 * AI search API boundary — view models + normalizers.
 *
 * The dashboard (client/src/pages/AISearchKnowledgeDashboard.tsx) is backed by
 * supabase/functions/ai-search, whose response shapes do NOT match the view
 * models the page renders. Two traps this module exists to close:
 *
 *   1. SNAKE_CASE. `/knowledge/entities` returns raw `select('*')` rows, and
 *      `numeric(3,2)` columns can arrive as strings over PostgREST. Read raw,
 *      every entity card renders blank (the AUDIT-011 bug).
 *   2. DATES ARE STRINGS. Timestamps arrive as ISO strings, but the render calls
 *      `.toLocaleDateString()` on them — which THROWS on a string. The fixtures
 *      this page used to ship with were `new Date(...)` objects, which is exactly
 *      why the mismatch was invisible until it was wired to the real API.
 *
 * Kept out of the .tsx so it can be unit tested without a DOM.
 */

export interface SearchResult {
  contentId: string;
  contentType: string;
  title: string;
  excerpt: string;
  similarity: number;
  relevanceScore: number;
  source: {
    author?: string;
    createdAt?: Date;
    category?: string;
    tags: string[];
  };
  highlights: string[];
}

export interface AIAnswer {
  // Null when the answer row could not be persisted — there is then nothing to
  // vote against, so the feedback controls are disabled rather than posting to a
  // non-existent id.
  id: string | null;
  answerText: string;
  answerConfidence: number;
  answerType: string;
  sourceDocuments: Array<{
    id: string;
    type: string;
    title: string;
    excerpt: string;
    relevanceScore: number;
  }>;
  answerSections: Array<{
    title: string;
    content: string;
    sources: string[];
  }>;
  keyPoints: string[];
  relatedTopics: string[];
  factualAccuracyScore?: number;
  completenessScore?: number;
  clarityScore?: number;
  usefulnessScore?: number;
  userHelpfulVotes: number;
  userUnhelpfulVotes: number;
  createdAt: Date;
}

export interface KnowledgeEntity {
  id: string;
  entityName: string;
  entityType: string;
  entityDescription?: string;
  entityCategory?: string;
  entitySummary?: string;
  mentionFrequency: number;
  importanceScore: number;
  trendingScore: number;
  entityAttributes: Record<string, any>;
  entityFacts: string[];
  aiConfidenceScore: number;
  entityStatus: string;
  qualityScore: number;
  createdAt: Date;
  updatedAt: Date;
  lastMentionedAt?: Date;
}

/**
 * Mirrors what GET /ai-search/search/analytics actually returns and the page
 * actually reads.
 *
 * The endpoint also returns trendingTopics / aiInsights /
 * optimizationRecommendations / contentSuggestions, all hardcoded to []. They are
 * deliberately omitted: nothing computes them, so nothing renders them.
 */
export interface SearchAnalytics {
  totalQueries: number;
  uniqueUsers: number;
  averageQueriesPerUser: number;
  mostCommonQueryTypes: Array<{ type: string; count: number; percentage: number }>;
  popularSearchTerms: Array<{ term: string; count: number; trend: string }>;
  averageResponseTime: number;
  averageResultCount: number;
  zeroResultQueryRate: number;
  answersGenerated: number;
  averageAnswerConfidence: number;
  answerHelpfulnessRate: number;
  averageUserSatisfaction: number;
}

export interface KnowledgeEntityRow {
  id: string;
  entity_name: string;
  entity_type: string;
  entity_description?: string | null;
  entity_category?: string | null;
  entity_summary?: string | null;
  mention_frequency?: number | string | null;
  importance_score?: number | string | null;
  trending_score?: number | string | null;
  entity_attributes?: Record<string, any> | null;
  entity_facts?: string[] | null;
  ai_confidence_score?: number | string | null;
  entity_status?: string | null;
  quality_score?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_mentioned_at?: string | null;
}

export type SearchResultRow = Omit<SearchResult, 'source'> & {
  source?: { author?: string; createdAt?: string; category?: string; tags?: string[] };
};

export type AIAnswerRow = Omit<AIAnswer, 'createdAt'> & { createdAt?: string };

export interface SemanticSearchResponse {
  queryId: string;
  results?: SearchResultRow[];
  answer?: AIAnswerRow | null;
  relatedTopics?: string[];
  suggestedQueries?: string[];
  searchMetrics?: {
    totalResults: number;
    searchTime: number;
    embeddingTime: number;
    answerTime?: number;
  };
}

/** Coerce a PostgREST numeric (which may be a string) to a number. */
export const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function toKnowledgeEntity(row: KnowledgeEntityRow): KnowledgeEntity {
  return {
    id: row.id,
    entityName: row.entity_name,
    entityType: row.entity_type,
    entityDescription: row.entity_description ?? undefined,
    entityCategory: row.entity_category ?? undefined,
    entitySummary: row.entity_summary ?? undefined,
    mentionFrequency: num(row.mention_frequency),
    importanceScore: num(row.importance_score),
    trendingScore: num(row.trending_score),
    entityAttributes: row.entity_attributes ?? {},
    entityFacts: Array.isArray(row.entity_facts) ? row.entity_facts : [],
    aiConfidenceScore: num(row.ai_confidence_score),
    entityStatus: row.entity_status ?? 'active',
    qualityScore: num(row.quality_score),
    createdAt: new Date(row.created_at ?? Date.now()),
    updatedAt: new Date(row.updated_at ?? Date.now()),
    lastMentionedAt: row.last_mentioned_at ? new Date(row.last_mentioned_at) : undefined,
  };
}

export function toSearchResult(row: SearchResultRow): SearchResult {
  return {
    ...row,
    source: {
      author: row.source?.author,
      createdAt: row.source?.createdAt ? new Date(row.source.createdAt) : undefined,
      category: row.source?.category,
      tags: row.source?.tags ?? [],
    },
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
  };
}

export function toAiAnswer(row: AIAnswerRow): AIAnswer {
  return {
    ...row,
    sourceDocuments: Array.isArray(row.sourceDocuments) ? row.sourceDocuments : [],
    answerSections: Array.isArray(row.answerSections) ? row.answerSections : [],
    keyPoints: Array.isArray(row.keyPoints) ? row.keyPoints : [],
    relatedTopics: Array.isArray(row.relatedTopics) ? row.relatedTopics : [],
    userHelpfulVotes: num(row.userHelpfulVotes),
    userUnhelpfulVotes: num(row.userUnhelpfulVotes),
    createdAt: new Date(row.createdAt ?? Date.now()),
  };
}
