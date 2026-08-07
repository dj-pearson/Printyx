/**
 * PROD-011 — pure logic behind the `service` edge function's knowledge-search half.
 *
 * Tests supabase/functions/service/knowledge.ts; index.ts imports
 * @supabase/supabase-js from esm.sh and cannot be loaded under Node.
 */

import { describe, it, expect } from 'vitest';
import {
  CLOSED_STATUSES,
  EMBEDDING_DIMS,
  buildQueryText,
  buildTicketContent,
  computeModelProxies,
  cosineSimilarity,
  extractErrorCodes,
  fallbackEmbedding,
  hashCode,
  parseBackfillLimit,
  parseSearchInput,
  rankBySimilarity,
  roundRelevance,
  shapeSettings,
  truncate,
} from '../../../supabase/functions/service/knowledge';
// The Express implementation, imported to prove the port is byte-compatible.
import { cosineSimilarity as expressCosine } from '../../routes-service-knowledge';

describe('hashCode / fallbackEmbedding', () => {
  it('hashes deterministically', () => {
    expect(hashCode('E-225')).toBe(hashCode('E-225'));
    expect(hashCode('E-225')).not.toBe(hashCode('E-226'));
  });

  it('produces a vector of exactly EMBEDDING_DIMS', () => {
    expect(fallbackEmbedding('jam in the fuser')).toHaveLength(EMBEDDING_DIMS);
    expect(EMBEDDING_DIMS).toBe(1536);
  });

  it('L2-normalizes, so cosine similarity is meaningful offline', () => {
    const vec = fallbackEmbedding('drum unit replaced after streaking');
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 10);
  });

  it('is case-insensitive and whitespace-insensitive', () => {
    expect(fallbackEmbedding('Fuser  JAM')).toEqual(fallbackEmbedding('fuser jam'));
  });

  it('returns an all-zero vector for empty text rather than dividing by zero', () => {
    const vec = fallbackEmbedding('   ');
    expect(vec).toHaveLength(EMBEDDING_DIMS);
    expect(vec.every((v) => v === 0)).toBe(true);
  });

  it('scores a repeated query above an unrelated one', () => {
    const query = fallbackEmbedding('E-225 fuser jam');
    const near = fallbackEmbedding('fuser jam cleared error E-225');
    const far = fallbackEmbedding('toner cartridge low warning');
    expect(cosineSimilarity(query, near)).toBeGreaterThan(cosineSimilarity(query, far));
  });

  it('matches the Express hash so already-stored fallback vectors stay comparable', () => {
    // If this drifts, every embedding written by the Express path silently stops
    // matching queries embedded here. Locked with fixed expectations rather than
    // by re-importing, because the point is the VALUES, not the code path.
    expect(hashCode('')).toBe(0);
    expect(hashCode('a')).toBe(97);
    expect(hashCode('ab')).toBe(3105);
    // Hand-computed: h = (31*h + charCode) | 0 over 'E','-','2','2','5'
    // 69 -> 2184 -> 67754 -> 2100424 -> 65113197
    expect(hashCode('E-225')).toBe(65113197);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors and 0 for orthogonal ones', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 12);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('is scale-invariant', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 12);
  });

  it('returns 0 rather than NaN on length mismatch, empty input or a zero vector', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it('agrees with the Express implementation', () => {
    const cases: Array<[number[], number[]]> = [
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [
        [0.1, -0.4, 0.9],
        [0.2, 0.3, -0.5],
      ],
      [[1], [1]],
      [
        [0, 0],
        [0, 0],
      ],
      [
        [1, 2],
        [1, 2, 3],
      ],
    ];
    for (const [a, b] of cases) {
      expect(cosineSimilarity(a, b)).toBe(expressCosine(a, b));
    }
  });
});

describe('extractErrorCodes', () => {
  it('pulls copier-style codes out of title and description', () => {
    expect(extractErrorCodes({ title: 'E000-0001 on startup', description: null })).toBe(
      'E000-0001',
    );
    expect(extractErrorCodes({ title: null, description: 'shows C2557 repeatedly' })).toBe('C2557');
  });

  it('deduplicates a code that appears in both fields', () => {
    expect(extractErrorCodes({ title: 'E-225 jam', description: 'E-225 again' })).toBe('E-225');
  });

  it('returns empty string when there is no code', () => {
    expect(extractErrorCodes({ title: 'makes a grinding noise', description: '' })).toBe('');
    expect(extractErrorCodes({})).toBe('');
  });
});

describe('buildTicketContent', () => {
  const ticket = {
    title: 'E-225 fuser jam',
    description: 'repeated jams',
    resolution_notes: 'Replaced fuser unit',
    parts_used: ['FK-1234', 'DR-9'],
  };

  it('joins resolution, parts, model, codes and title', () => {
    const content = buildTicketContent(ticket, 'iR-ADV C5560');
    expect(content).toContain('Replaced fuser unit');
    expect(content).toContain('FK-1234 DR-9');
    expect(content).toContain('iR-ADV C5560');
    expect(content).toContain('E-225');
  });

  it('leads with the resolution — the field that carries the actual fix', () => {
    expect(buildTicketContent(ticket, null).split('\n')[0]).toBe('Replaced fuser unit');
  });

  it('drops empty segments instead of leaving blank lines', () => {
    const content = buildTicketContent({ title: 'noise', parts_used: [] }, null);
    expect(content).toBe('noise');
  });

  it('tolerates parts_used that is not an array', () => {
    expect(buildTicketContent({ title: 'x', parts_used: 'FK-1' }, null)).toBe('x');
  });

  it('caps at 8000 characters', () => {
    const content = buildTicketContent({ resolution_notes: 'x'.repeat(20000) }, null);
    expect(content).toHaveLength(8000);
  });
});

describe('truncate', () => {
  it('leaves short strings alone', () => {
    expect(truncate('short', 280)).toBe('short');
  });

  it('adds an ellipsis and stays within the limit', () => {
    const out = truncate('y'.repeat(400), 280);
    expect(out).toHaveLength(280);
    expect(out.endsWith('…')).toBe(true);
  });

  it('maps null and undefined to empty string', () => {
    expect(truncate(null, 10)).toBe('');
    expect(truncate(undefined, 10)).toBe('');
  });
});

describe('rankBySimilarity', () => {
  const rows = [
    { ticket_id: 'a', machine_model: 'M1', embedding: [1, 0] },
    { ticket_id: 'b', machine_model: 'M2', embedding: [0.9, 0.1] },
    { ticket_id: 'c', machine_model: null, embedding: [0, 1] },
  ];

  it('sorts by descending similarity', () => {
    const out = rankBySimilarity(rows, [1, 0], 10);
    expect(out.map((r) => r.ticketId)).toEqual(['a', 'b', 'c']);
  });

  it('honours the limit', () => {
    expect(rankBySimilarity(rows, [1, 0], 2).map((r) => r.ticketId)).toEqual(['a', 'b']);
  });

  it('DROPS rows with no vector instead of scoring them 0', () => {
    // A never-embedded row is absent from the index, not a bad match. Scoring it
    // 0 would let it occupy a top-N slot when nothing else matched.
    const withHoles = [
      ...rows,
      { ticket_id: 'd', machine_model: null, embedding: null },
      { ticket_id: 'e', machine_model: null, embedding: [] },
      { ticket_id: 'f', machine_model: null, embedding: 'not-a-vector' },
    ];
    expect(rankBySimilarity(withHoles, [1, 0], 10).map((r) => r.ticketId)).toEqual(['a', 'b', 'c']);
  });

  it('carries the model through for the per-model proxy lookup', () => {
    expect(rankBySimilarity(rows, [1, 0], 1)[0].machineModel).toBe('M1');
  });

  it('returns empty for no rows', () => {
    expect(rankBySimilarity([], [1, 0], 10)).toEqual([]);
  });
});

describe('roundRelevance', () => {
  it('rounds to three decimals', () => {
    expect(roundRelevance(0.123456)).toBe(0.123);
  });

  it('clamps outside [0,1] — a negative cosine must not render as a negative score', () => {
    expect(roundRelevance(-0.5)).toBe(0);
    expect(roundRelevance(1.4)).toBe(1);
  });
});

describe('computeModelProxies', () => {
  it('returns nulls for a model with no tickets', () => {
    expect(computeModelProxies([])).toEqual({
      meanResolutionTimeHours: null,
      fixSuccessRate: null,
    });
  });

  it('averages resolution time in hours to one decimal', () => {
    const out = computeModelProxies([
      { status: 'closed', created_at: '2026-01-01T00:00:00Z', resolved_at: '2026-01-01T02:00:00Z' },
      { status: 'closed', created_at: '2026-01-01T00:00:00Z', resolved_at: '2026-01-01T05:00:00Z' },
    ]);
    expect(out.meanResolutionTimeHours).toBe(3.5);
  });

  it('counts every closed status', () => {
    const rows = CLOSED_STATUSES.map((status) => ({
      status,
      created_at: null,
      resolved_at: null,
    }));
    expect(computeModelProxies(rows).fixSuccessRate).toBe(1);
  });

  it('divides the success rate by ALL tickets, not just the timed ones', () => {
    // An unresolved ticket has no resolved_at. If the denominator were the timed
    // subset, a model that never resolves anything would score 100%.
    const out = computeModelProxies([
      { status: 'closed', created_at: '2026-01-01T00:00:00Z', resolved_at: '2026-01-01T01:00:00Z' },
      { status: 'open', created_at: '2026-01-01T00:00:00Z', resolved_at: null },
      { status: 'open', created_at: '2026-01-01T00:00:00Z', resolved_at: null },
      { status: 'open', created_at: '2026-01-01T00:00:00Z', resolved_at: null },
    ]);
    expect(out.fixSuccessRate).toBe(0.25);
    expect(out.meanResolutionTimeHours).toBe(1);
  });

  it('reports a null mean when nothing has both timestamps, but still a rate', () => {
    const out = computeModelProxies([{ status: 'open', created_at: null, resolved_at: null }]);
    expect(out.meanResolutionTimeHours).toBeNull();
    expect(out.fixSuccessRate).toBe(0);
  });

  it('drops negative durations rather than clamping them to zero', () => {
    // resolved_at before created_at is bad data; folding it in as 0 drags the mean.
    const out = computeModelProxies([
      { status: 'closed', created_at: '2026-01-02T00:00:00Z', resolved_at: '2026-01-01T00:00:00Z' },
      { status: 'closed', created_at: '2026-01-01T00:00:00Z', resolved_at: '2026-01-01T04:00:00Z' },
    ]);
    expect(out.meanResolutionTimeHours).toBe(4);
  });

  it('rounds the rate to two decimals', () => {
    const rows = [
      { status: 'closed', created_at: null, resolved_at: null },
      { status: 'open', created_at: null, resolved_at: null },
      { status: 'open', created_at: null, resolved_at: null },
    ];
    expect(computeModelProxies(rows).fixSuccessRate).toBe(0.33);
  });
});

describe('parseSearchInput', () => {
  it('accepts a bare query and defaults the limit to 10', () => {
    const out = parseSearchInput({ query: 'fuser jam' });
    expect(out).toEqual({ ok: true, value: { query: 'fuser jam', limit: 10 } });
  });

  it('carries the optional model and code through', () => {
    const out = parseSearchInput({ query: 'E-225', machine_model: 'C5560', error_code: 'E-225' });
    expect(out.ok && out.value.machine_model).toBe('C5560');
    expect(out.ok && out.value.error_code).toBe('E-225');
  });

  it('rejects a missing, empty or non-string query', () => {
    expect(parseSearchInput({}).ok).toBe(false);
    expect(parseSearchInput({ query: '' }).ok).toBe(false);
    expect(parseSearchInput({ query: 42 }).ok).toBe(false);
  });

  it('rejects an empty optional string rather than silently ignoring it', () => {
    expect(parseSearchInput({ query: 'x', machine_model: '' }).ok).toBe(false);
    expect(parseSearchInput({ query: 'x', error_code: '' }).ok).toBe(false);
  });

  it('treats an absent optional as absent, not as an error', () => {
    const out = parseSearchInput({ query: 'x', machine_model: undefined, error_code: null });
    expect(out.ok).toBe(true);
    expect(out.ok && 'machine_model' in out.value).toBe(false);
  });

  it('enforces the limit bounds and integrality', () => {
    expect(parseSearchInput({ query: 'x', limit: 0 }).ok).toBe(false);
    expect(parseSearchInput({ query: 'x', limit: 51 }).ok).toBe(false);
    expect(parseSearchInput({ query: 'x', limit: 2.5 }).ok).toBe(false);
    expect(parseSearchInput({ query: 'x', limit: '10' }).ok).toBe(false);
    expect(parseSearchInput({ query: 'x', limit: 50 }).ok).toBe(true);
    expect(parseSearchInput({ query: 'x', limit: 1 }).ok).toBe(true);
  });
});

describe('buildQueryText', () => {
  it('appends the model and code so they bias the embedding', () => {
    expect(
      buildQueryText({
        query: 'streaking',
        machine_model: 'C5560',
        error_code: 'E-225',
        limit: 10,
      }),
    ).toBe('streaking C5560 E-225');
  });

  it('omits the absent parts without leaving double spaces', () => {
    expect(buildQueryText({ query: 'streaking', limit: 10 })).toBe('streaking');
  });
});

describe('parseBackfillLimit', () => {
  it('defaults to 200 when absent or unparseable', () => {
    expect(parseBackfillLimit(null)).toBe(200);
    expect(parseBackfillLimit('abc')).toBe(200);
  });

  it('clamps to [1, 2000] so one cron call stays bounded', () => {
    expect(parseBackfillLimit('0')).toBe(1);
    expect(parseBackfillLimit('-5')).toBe(1);
    expect(parseBackfillLimit('99999')).toBe(2000);
    expect(parseBackfillLimit('500')).toBe(500);
  });
});

describe('shapeSettings', () => {
  it('reports opt-in only for a literal true', () => {
    // This gates a CROSS-TENANT data pool: anything but true stays opted out.
    expect(shapeSettings('t1', { federated_opt_in: { enabled: true } }).federatedOptIn).toBe(true);
    for (const enabled of ['true', 1, {}, [], 'yes']) {
      expect(shapeSettings('t1', { federated_opt_in: { enabled } }).federatedOptIn).toBe(false);
    }
  });

  it('defaults to opted out when the row or the blob is missing', () => {
    expect(shapeSettings('t1', null)).toEqual({
      tenantId: 't1',
      federatedOptIn: false,
      consentedAt: null,
      consentedByUserId: null,
      updatedAt: null,
    });
    expect(shapeSettings('t1', {}).federatedOptIn).toBe(false);
  });

  it('reads the jsonb consent keys as-is', () => {
    const out = shapeSettings('t1', {
      federated_opt_in: {
        enabled: true,
        consentedAt: '2026-08-07T00:00:00.000Z',
        consentedByUserId: 'u1',
      },
      updated_at: '2026-08-07T01:00:00.000Z',
    });
    expect(out.consentedAt).toBe('2026-08-07T00:00:00.000Z');
    expect(out.consentedByUserId).toBe('u1');
    expect(out.updatedAt).toBe('2026-08-07T01:00:00.000Z');
  });
});
