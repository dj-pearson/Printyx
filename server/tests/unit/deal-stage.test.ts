// COP-M01: deals.stage_id is NOT NULL and references deal_stages.id, but every
// surface that creates a deal sends a slug from a hardcoded select. The old
// handler dodged that by writing to a `stage` column that does not exist, so
// creating a deal failed outright. These helpers do the lookup instead.
//
// The filter/create distinction is the part worth pinning: a filter that falls
// back to a default stage returns a different column of the board than the one
// asked for, which is worse than returning nothing.
import { describe, it, expect } from 'vitest';

import {
  buildStageNameMap,
  findStageId,
  firstStageId,
  normalizeStageKey,
  resolveStageId,
} from '../../../supabase/functions/_shared/deal-stage';

const STAGES = [
  { id: 's-3', name: 'Proposal', sort_order: 3, is_active: true },
  { id: 's-1', name: 'Prospecting', sort_order: 1, is_active: true },
  { id: 's-2', name: 'Qualification', sort_order: 2, is_active: true },
  { id: 's-9', name: 'Closed Won', sort_order: 9, is_active: true },
];

describe('normalizeStageKey', () => {
  it.each([
    ['Closed Won', 'closedwon'],
    ['closed_won', 'closedwon'],
    ['closed-won', 'closedwon'],
    ['  CLOSED WON  ', 'closedwon'],
    ['Prospecting', 'prospecting'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ])('normalizeStageKey(%j) -> %j', (input, expected) => {
    expect(normalizeStageKey(input as any)).toBe(expected);
  });
});

describe('findStageId — used for filtering, never falls back', () => {
  it('matches an id exactly', () => {
    expect(findStageId(STAGES, 's-2')).toBe('s-2');
  });

  it('matches a name however it is punctuated or cased', () => {
    expect(findStageId(STAGES, 'prospecting')).toBe('s-1');
    expect(findStageId(STAGES, 'Closed Won')).toBe('s-9');
    expect(findStageId(STAGES, 'closed_won')).toBe('s-9');
    expect(findStageId(STAGES, 'CLOSED-WON')).toBe('s-9');
  });

  it('returns null for a slug that matches nothing', () => {
    // 'negotiation' is in the hardcoded picker but not in this tenant's stages.
    expect(findStageId(STAGES, 'negotiation')).toBeNull();
  });

  it('returns null for empty input and for an empty stage list', () => {
    expect(findStageId(STAGES, '')).toBeNull();
    expect(findStageId(STAGES, null)).toBeNull();
    expect(findStageId([], 'prospecting')).toBeNull();
  });

  it('prefers an id match over a name match', () => {
    const odd = [
      { id: 'prospecting', name: 'Renamed', sort_order: 1 },
      { id: 's-x', name: 'Prospecting', sort_order: 2 },
    ];
    expect(findStageId(odd, 'prospecting')).toBe('prospecting');
  });
});

describe('resolveStageId — used for creating, must always land somewhere', () => {
  it('behaves like findStageId when there is a match', () => {
    expect(resolveStageId(STAGES, 'Qualification')).toBe('s-2');
    expect(resolveStageId(STAGES, 's-3')).toBe('s-3');
  });

  it('falls back to the front of the pipeline for an unknown slug', () => {
    expect(resolveStageId(STAGES, 'negotiation')).toBe('s-1');
  });

  it('falls back to the front of the pipeline when no stage is given at all', () => {
    expect(resolveStageId(STAGES, undefined)).toBe('s-1');
    expect(resolveStageId(STAGES, '')).toBe('s-1');
  });

  it('returns null only when the tenant has no stages, so the caller can 400', () => {
    expect(resolveStageId([], 'prospecting')).toBeNull();
    expect(resolveStageId([], undefined)).toBeNull();
  });
});

describe('firstStageId', () => {
  it('takes the lowest sort_order, not the first row', () => {
    expect(firstStageId(STAGES)).toBe('s-1');
  });

  it('ignores inactive stages when any active one exists', () => {
    const withInactive = [
      { id: 's-0', name: 'Archived', sort_order: 0, is_active: false },
      ...STAGES,
    ];
    expect(firstStageId(withInactive)).toBe('s-1');
  });

  it('uses inactive stages rather than nothing when they are all that exist', () => {
    expect(firstStageId([{ id: 's-0', name: 'Archived', sort_order: 0, is_active: false }])).toBe(
      's-0',
    );
  });

  it('treats a missing sort_order as last, not as zero', () => {
    const rows = [
      { id: 'no-order', name: 'Unordered' },
      { id: 'ordered', name: 'Ordered', sort_order: 5 },
    ];
    expect(firstStageId(rows)).toBe('ordered');
  });

  it('breaks a sort_order tie by name, so the result is stable', () => {
    const rows = [
      { id: 'b', name: 'Beta', sort_order: 1 },
      { id: 'a', name: 'Alpha', sort_order: 1 },
    ];
    expect(firstStageId(rows)).toBe('a');
    expect(firstStageId([...rows].reverse())).toBe('a');
  });

  it('is null for an empty list', () => {
    expect(firstStageId([])).toBeNull();
  });
});

describe('buildStageNameMap', () => {
  it('maps every stage id to its display name', () => {
    expect(buildStageNameMap(STAGES)).toEqual({
      's-1': 'Prospecting',
      's-2': 'Qualification',
      's-3': 'Proposal',
      's-9': 'Closed Won',
    });
  });

  it('is empty for an empty list, so a deal simply has no stage name', () => {
    expect(buildStageNameMap([])).toEqual({});
  });

  it('maps a nameless stage to an empty string rather than dropping it', () => {
    expect(buildStageNameMap([{ id: 's-1', name: null }])).toEqual({ 's-1': '' });
  });
});
