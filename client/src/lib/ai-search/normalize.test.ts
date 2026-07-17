import { describe, it, expect } from 'vitest';
import {
  toKnowledgeEntity,
  toSearchResult,
  toAiAnswer,
  num,
  type KnowledgeEntityRow,
  type AIAnswerRow,
  type SearchResultRow,
} from './normalize';

/**
 * AUDIT-015. These tests encode the two traps that made wiring
 * AISearchKnowledgeDashboard to the real ai-search edge function non-trivial.
 * Both were invisible while the page rendered fixtures, because the fixtures were
 * hand-built in the page's own view-model shape.
 */

describe('toKnowledgeEntity', () => {
  // A realistic row: raw `select('*')` output from knowledge_entities, exactly as
  // the edge function returns it — snake_case, ISO timestamps, numeric(3,2) as
  // strings (how PostgREST can serialize them).
  const row: KnowledgeEntityRow = {
    id: 'e1',
    entity_name: 'Canon imageRUNNER',
    entity_type: 'product',
    entity_description: 'MFP device family',
    entity_category: 'hardware',
    entity_summary: 'Multifunction printers',
    mention_frequency: 12,
    importance_score: '0.95',
    trending_score: '0.20',
    entity_attributes: { vendor: 'Canon' },
    entity_facts: ['A3 capable'],
    ai_confidence_score: '0.80',
    entity_status: 'active',
    quality_score: '0.75',
    created_at: '2026-01-02T10:00:00Z',
    updated_at: '2026-01-03T10:00:00Z',
    last_mentioned_at: '2026-01-04T10:00:00Z',
  };

  it('maps snake_case columns onto the camelCase view model', () => {
    // Reading the raw row is the AUDIT-011 bug: every card renders blank because
    // `row.entityName` is undefined on a snake_case row.
    const entity = toKnowledgeEntity(row);
    expect(entity.entityName).toBe('Canon imageRUNNER');
    expect(entity.entityType).toBe('product');
    expect(entity.entityDescription).toBe('MFP device family');
    expect(entity.entityCategory).toBe('hardware');
    expect(entity.mentionFrequency).toBe(12);
  });

  it('revives timestamps as Date objects, not strings', () => {
    // The render calls entity.createdAt.toLocaleDateString(); a string would throw.
    const entity = toKnowledgeEntity(row);
    expect(entity.createdAt).toBeInstanceOf(Date);
    expect(entity.updatedAt).toBeInstanceOf(Date);
    expect(entity.lastMentionedAt).toBeInstanceOf(Date);
    expect(() => entity.createdAt.toLocaleDateString()).not.toThrow();
    expect(() => entity.lastMentionedAt?.toLocaleDateString()).not.toThrow();
    expect(entity.createdAt.toISOString()).toBe('2026-01-02T10:00:00.000Z');
  });

  it('coerces numeric(3,2) columns that arrive as strings into numbers', () => {
    // Guards the score bars: `width: ${importanceScore * 100}%` on a string
    // silently produces NaN.
    const entity = toKnowledgeEntity(row);
    expect(entity.importanceScore).toBe(0.95);
    expect(entity.trendingScore).toBe(0.2);
    expect(entity.aiConfidenceScore).toBe(0.8);
    expect(entity.qualityScore).toBe(0.75);
  });

  it('leaves lastMentionedAt undefined when the column is null', () => {
    // The render branches on this to fall back to "Created ...".
    const entity = toKnowledgeEntity({ ...row, last_mentioned_at: null });
    expect(entity.lastMentionedAt).toBeUndefined();
  });

  it('defaults nullable columns rather than emitting null into the view model', () => {
    const entity = toKnowledgeEntity({
      ...row,
      entity_description: null,
      entity_facts: null,
      entity_attributes: null,
      entity_status: null,
      importance_score: null,
    });
    expect(entity.entityDescription).toBeUndefined();
    expect(entity.entityFacts).toEqual([]);
    expect(entity.entityAttributes).toEqual({});
    expect(entity.entityStatus).toBe('active');
    expect(entity.importanceScore).toBe(0);
  });
});

describe('toSearchResult', () => {
  const row: SearchResultRow = {
    contentId: 'c1',
    contentType: 'document',
    title: 'Setup guide',
    excerpt: 'How to set up',
    similarity: 0.9,
    relevanceScore: 0.85,
    source: {
      author: 'u1',
      createdAt: '2026-01-02T10:00:00Z',
      category: 'tutorial',
      tags: ['setup'],
    },
    highlights: ['setup'],
  };

  it('revives source.createdAt as a Date', () => {
    // Rendered via result.source.createdAt.toLocaleDateString().
    const result = toSearchResult(row);
    expect(result.source.createdAt).toBeInstanceOf(Date);
    expect(() => result.source.createdAt?.toLocaleDateString()).not.toThrow();
  });

  it('tolerates a missing source object', () => {
    // content_author_id / content_created_at / content_category are all nullable,
    // so the edge function can emit a sparse source.
    const result = toSearchResult({ ...row, source: undefined });
    expect(result.source.tags).toEqual([]);
    expect(result.source.createdAt).toBeUndefined();
    expect(result.source.author).toBeUndefined();
  });
});

describe('toAiAnswer', () => {
  const row: AIAnswerRow = {
    id: 'a1',
    answerText: 'Because.',
    answerConfidence: 0.9,
    answerType: 'synthesized',
    sourceDocuments: [],
    answerSections: [],
    keyPoints: ['one'],
    relatedTopics: ['two'],
    userHelpfulVotes: 0,
    userUnhelpfulVotes: 0,
    createdAt: '2026-01-02T10:00:00Z',
  };

  it('revives createdAt as a Date', () => {
    expect(toAiAnswer(row).createdAt).toBeInstanceOf(Date);
  });

  it('coerces non-array answer collections to arrays', () => {
    // The answer is parsed from an unconstrained model completion, so a field the
    // prompt requests as an array can come back as a string. The render guards
    // with `.length > 0 && ....map(...)` — and a STRING passes the length check
    // then throws on .map. The edge function coerces too; this is defence in depth
    // at the boundary that actually renders.
    const answer = toAiAnswer({
      ...row,
      keyPoints: 'not an array' as unknown as string[],
      relatedTopics: undefined as unknown as string[],
      answerSections: { a: 1 } as unknown as AIAnswerRow['answerSections'],
    });
    expect(answer.keyPoints).toEqual([]);
    expect(answer.relatedTopics).toEqual([]);
    expect(answer.answerSections).toEqual([]);
    expect(() => answer.keyPoints.map((p) => p)).not.toThrow();
  });

  it('preserves a null id so the feedback control can disable itself', () => {
    // id is null when the ai_generated_answers insert failed: there is no row to
    // attach a vote to.
    expect(toAiAnswer({ ...row, id: null }).id).toBeNull();
  });
});

describe('num', () => {
  it('parses numeric strings and defaults non-numeric input to 0', () => {
    expect(num('0.95')).toBe(0.95);
    expect(num(0.5)).toBe(0.5);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
  });
});
