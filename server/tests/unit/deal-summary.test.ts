// COP-B11: the deal narrative's prompt, its bounds, and its staleness key.
//
// The module ships to Deno but is pure, so it is imported here directly - the
// same arrangement gpt5-prompts-parity.test.ts uses. Nothing in this suite
// touches the network: what it locks is the three rules the file exists to
// enforce, each of which is invisible to tsc and to any test that only checks
// that a summary came back.
import { describe, it, expect } from 'vitest';

import {
  MAX_ENTRY_CHARS,
  MAX_TIMELINE_ENTRIES,
  boundedTimeline,
  buildDealFingerprint,
  buildDealSummaryPrompt,
  hasEnoughHistory,
  type DealSummaryDeal,
  type DealSummaryEntry,
} from '../../../supabase/functions/_shared/deal-summary';

const DEAL: DealSummaryDeal = {
  id: 'd-1',
  title: 'Northgate Dental — 4 MFP refresh',
  companyName: 'Northgate Dental',
  amount: '48250.00',
  stage: 'Proposal',
  status: 'open',
  expectedCloseDate: '2026-10-31T00:00:00.000Z',
  nextFollowUpDate: '2026-09-22T00:00:00.000Z',
  incumbentVendor: 'Xerox',
  forecastCategory: 'commit',
  leaseBuyoutExposure: '6200.00',
  dealMotion: 'fleet_refresh',
};

function entry(n: number, overrides: Partial<DealSummaryEntry> = {}): DealSummaryEntry {
  return {
    id: `a-${n}`,
    type: 'call',
    subject: `Call ${n}`,
    description: `Spoke with the office manager, round ${n}.`,
    createdAt: `2026-0${(n % 9) + 1}-1${n % 9}T10:00:00.000Z`,
    ...overrides,
  };
}

const entries = (count: number) => Array.from({ length: count }, (_, i) => entry(i));

describe('hasEnoughHistory — refusing to narrate an empty deal', () => {
  it('refuses when there is no logged interaction', () => {
    expect(hasEnoughHistory([])).toBe(false);
  });

  it('accepts a single real entry', () => {
    expect(hasEnoughHistory([entry(1)])).toBe(true);
  });
});

describe('boundedTimeline — cost and latency are bounded at the prompt', () => {
  it('keeps at most MAX_TIMELINE_ENTRIES', () => {
    expect(boundedTimeline(entries(500))).toHaveLength(MAX_TIMELINE_ENTRIES);
  });

  it('keeps the NEWEST entries, not the oldest', () => {
    const list = entries(60);
    const kept = boundedTimeline(list).map((e) => e.id);
    // Input is newest-first, so the newest is index 0 and must survive.
    expect(kept).toContain('a-0');
    expect(kept).not.toContain('a-59');
  });

  it('hands them over oldest first, so the model reads a story in order', () => {
    const kept = boundedTimeline(entries(5)).map((e) => e.id);
    expect(kept).toEqual(['a-4', 'a-3', 'a-2', 'a-1', 'a-0']);
  });

  it('does not mutate the caller’s array', () => {
    const list = entries(5);
    const before = list.map((e) => e.id);
    boundedTimeline(list);
    expect(list.map((e) => e.id)).toEqual(before);
  });
});

describe('buildDealSummaryPrompt', () => {
  it('carries the deal facts and the history', () => {
    const prompt = buildDealSummaryPrompt(DEAL, entries(3));
    expect(prompt).toContain('Northgate Dental');
    expect(prompt).toContain('Incumbent vendor: Xerox');
    expect(prompt).toContain('Spoke with the office manager, round 0.');
  });

  it('tells the model not to invent, in so many words', () => {
    const prompt = buildDealSummaryPrompt(DEAL, entries(2));
    expect(prompt).toContain('Use ONLY the facts below');
    expect(prompt).toContain('Never state a next step that is not recorded');
  });

  it('truncates a pasted wall of text rather than letting it become the prompt', () => {
    const huge = 'x'.repeat(5_000);
    const prompt = buildDealSummaryPrompt(DEAL, [entry(1, { description: huge })]);
    expect(prompt).not.toContain('x'.repeat(MAX_ENTRY_CHARS + 50));
    expect(prompt.length).toBeLessThan(4_000);
  });

  it('is bounded even for a deal with hundreds of entries', () => {
    const many = buildDealSummaryPrompt(DEAL, entries(400));
    const few = buildDealSummaryPrompt(DEAL, entries(MAX_TIMELINE_ENTRIES));
    // Only the header count line differs, so the two must be within a hair.
    expect(Math.abs(many.length - few.length)).toBeLessThan(120);
  });

  it('says how many older entries it left out, rather than implying it read them all', () => {
    expect(buildDealSummaryPrompt(DEAL, entries(55))).toContain('oldest 15 omitted');
    expect(buildDealSummaryPrompt(DEAL, entries(3))).not.toContain('omitted');
  });

  it('marks an entry with no detail instead of emitting a blank line', () => {
    const prompt = buildDealSummaryPrompt(DEAL, [
      { id: 'a', type: 'email', createdAt: '2026-09-01T00:00:00.000Z' },
    ]);
    expect(prompt).toContain('(no detail recorded)');
  });

  it('handles a deal with no fields at all without pretending it has some', () => {
    const prompt = buildDealSummaryPrompt({}, [entry(1)]);
    expect(prompt).toContain('(no fields recorded)');
  });
});

describe('buildDealFingerprint — staleness is computed, not guessed', () => {
  it('is stable for the same deal and timeline', () => {
    expect(buildDealFingerprint(DEAL, entries(4))).toBe(buildDealFingerprint(DEAL, entries(4)));
  });

  it('changes when a field a rep would expect the summary to reflect changes', () => {
    const base = buildDealFingerprint(DEAL, entries(4));
    expect(buildDealFingerprint({ ...DEAL, stage: 'Negotiation' }, entries(4))).not.toBe(base);
    expect(buildDealFingerprint({ ...DEAL, amount: '61000.00' }, entries(4))).not.toBe(base);
    expect(buildDealFingerprint({ ...DEAL, forecastCategory: 'pipeline' }, entries(4))).not.toBe(
      base,
    );
  });

  it('changes when a new activity lands', () => {
    expect(buildDealFingerprint(DEAL, entries(5))).not.toBe(buildDealFingerprint(DEAL, entries(4)));
  });

  it('changes when an entry is EDITED, which a count alone would miss', () => {
    const original = entries(3);
    const edited = [...original];
    edited[1] = { ...edited[1], description: 'Actually they went with a 3-year term.' };
    expect(edited).toHaveLength(original.length);
    expect(buildDealFingerprint(DEAL, edited)).not.toBe(buildDealFingerprint(DEAL, original));
  });

  it('ignores churn beyond the window the prompt actually reads', () => {
    // An entry the prompt never sees cannot change the summary, so it must not
    // mark a current summary stale.
    const long = entries(MAX_TIMELINE_ENTRIES + 5);
    const tweaked = [...long];
    tweaked[MAX_TIMELINE_ENTRIES + 2] = {
      ...tweaked[MAX_TIMELINE_ENTRIES + 2],
      description: 'edited, but far outside the window',
    };
    expect(buildDealFingerprint(DEAL, tweaked)).toBe(buildDealFingerprint(DEAL, long));
  });

  it('is short enough for the varchar(64) column that stores it', () => {
    expect(buildDealFingerprint(DEAL, entries(MAX_TIMELINE_ENTRIES)).length).toBeLessThanOrEqual(
      64,
    );
  });
});
