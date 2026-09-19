// COP-B03: ranked next actions, and the auto-expiry that makes them trustworthy.
//
// AC4 is the criterion that distinguishes this from a list of alerts: a
// suggestion must disappear the moment the rep does the thing. That is a set
// difference rather than a retraction, and most of this suite exists to hold
// it - along with the decision that a suggestion's key names the CONDITION and
// not the moment, which is what stops a quiet deal being re-raised every night
// as a fresh task.
import { describe, it, expect } from 'vitest';

import {
  DEFAULT_SUGGESTION_THRESHOLDS,
  expireKeys,
  rankSuggestions,
  suggestionKey,
  suggestionsFromDeals,
  suggestionsFromPlays,
  suggestionsFromQuotes,
  type SuggestionDealRow,
  type SuggestionThresholds,
} from '../../../supabase/functions/_shared/suggested-task';

const NOW = new Date('2026-09-19T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const thresholds = (over: Partial<SuggestionThresholds> = {}): SuggestionThresholds => ({
  ...DEFAULT_SUGGESTION_THRESHOLDS,
  ...over,
});

/** A deal with enough signal to be scored, and nothing wrong with it. */
const healthyDeal = (over: Partial<SuggestionDealRow> = {}): SuggestionDealRow => ({
  id: 'd1',
  owner_id: 'rep-1',
  customer_id: 'acct-1',
  company_name: 'Northgate Dental',
  status: 'open',
  lastActivityDate: daysAgo(2),
  nextFollowUpDate: daysAhead(3),
  expectedCloseDate: daysAhead(20),
  stageEnteredAt: daysAgo(3),
  stageSlaDays: 14,
  contactCount: 3,
  ...over,
});

describe('suggestionsFromDeals — the same scorer the deal record shows', () => {
  it('raises nothing for a deal with nothing wrong', () => {
    expect(suggestionsFromDeals([healthyDeal()], NOW, thresholds())).toEqual([]);
  });

  it('turns a gone-quiet deal into an imperative action', () => {
    const [s] = suggestionsFromDeals(
      [healthyDeal({ lastActivityDate: daysAgo(30) })],
      NOW,
      thresholds(),
    );
    expect(s.suggestionType).toBe('deal_gone_quiet');
    expect(s.reason).toContain('30 days');
    // "Review this deal" is a category, not an action.
    expect(s.action).toBe('Call the contact and log what you learn.');
    expect(s.recordType).toBe('deal');
  });

  it('ranks a critical risk above the same risk as a warning', () => {
    const [warn] = suggestionsFromDeals(
      [healthyDeal({ lastActivityDate: daysAgo(30) })],
      NOW,
      thresholds(),
    );
    const [crit] = suggestionsFromDeals(
      [healthyDeal({ lastActivityDate: daysAgo(60) })],
      NOW,
      thresholds(),
    );
    expect(crit.score).toBeGreaterThan(warn.score);
  });

  it('carries the owner and account through for scoping', () => {
    const [s] = suggestionsFromDeals([healthyDeal({ nextFollowUpDate: null })], NOW, thresholds());
    expect(s).toMatchObject({
      ownerId: 'rep-1',
      customerId: 'acct-1',
      companyName: 'Northgate Dental',
    });
  });

  it('respects a type an admin switched off', () => {
    const quiet = healthyDeal({ lastActivityDate: daysAgo(30) });
    expect(suggestionsFromDeals([quiet], NOW, thresholds())).toHaveLength(1);
    expect(
      suggestionsFromDeals([quiet], NOW, thresholds({ disabledTypes: ['deal_gone_quiet'] })),
    ).toEqual([]);
  });

  it('raises one suggestion per distinct problem on the same deal', () => {
    const bad = healthyDeal({ lastActivityDate: daysAgo(40), nextFollowUpDate: null });
    const types = suggestionsFromDeals([bad], NOW, thresholds()).map((s) => s.suggestionType);
    expect(types).toContain('deal_gone_quiet');
    expect(types).toContain('deal_no_next_step');
    expect(new Set(types).size).toBe(types.length);
  });
});

describe('suggestionsFromQuotes', () => {
  const quote = (over: Record<string, unknown> = {}) => ({
    id: 'q1',
    proposal_number: 'Q-100',
    valid_until: daysAhead(5),
    assigned_to: 'rep-1',
    business_record_id: 'acct-1',
    ...over,
  });
  const names = new Map([['acct-1', 'Northgate Dental']]);

  it('chases a quote inside the window', () => {
    const [s] = suggestionsFromQuotes([quote()], NOW, thresholds(), names);
    expect(s.suggestionType).toBe('quote_expiring');
    expect(s.action).toContain('Chase the signature');
    expect(s.companyName).toBe('Northgate Dental');
  });

  it('ranks an already-lapsed quote above one with time left, and changes the ask', () => {
    const [soon] = suggestionsFromQuotes([quote()], NOW, thresholds(), names);
    const [lapsed] = suggestionsFromQuotes(
      [quote({ valid_until: daysAgo(3) })],
      NOW,
      thresholds(),
      names,
    );
    expect(lapsed.score).toBeGreaterThan(soon.score);
    expect(lapsed.action).toContain('Re-issue');
  });

  it('ignores a quote outside the window and one lapsed months ago', () => {
    expect(
      suggestionsFromQuotes([quote({ valid_until: daysAhead(60) })], NOW, thresholds(), names),
    ).toEqual([]);
    expect(
      suggestionsFromQuotes([quote({ valid_until: daysAgo(90) })], NOW, thresholds(), names),
    ).toEqual([]);
  });

  it('ignores a quote with no expiry rather than assuming one', () => {
    expect(suggestionsFromQuotes([quote({ valid_until: null })], NOW, thresholds(), names)).toEqual(
      [],
    );
  });

  it('honours a widened window', () => {
    expect(
      suggestionsFromQuotes(
        [quote({ valid_until: daysAhead(25) })],
        NOW,
        thresholds({ quoteExpiryWindowDays: 30 }),
        names,
      ),
    ).toHaveLength(1);
  });
});

describe('suggestionsFromPlays — borrowed, not re-detected', () => {
  const play = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    play_type: 'lease_expiring',
    reason: 'Lease ends in 30 days.',
    score: 88,
    owner_id: 'rep-1',
    customer_id: 'acct-1',
    company_name: 'Northgate Dental',
    status: 'open',
    ...over,
  });

  it('carries the radar’s own reason and score rather than recomputing them', () => {
    const [s] = suggestionsFromPlays([play()], thresholds());
    expect(s.reason).toBe('Lease ends in 30 days.');
    expect(s.score).toBe(88);
  });

  it('ignores a play already dismissed or converted', () => {
    expect(suggestionsFromPlays([play({ status: 'dismissed' })], thresholds())).toEqual([]);
    expect(suggestionsFromPlays([play({ status: 'converted' })], thresholds())).toEqual([]);
  });
});

describe('suggestionKey — names the condition, not the moment', () => {
  it('is EXACTLY type:recordId, with nothing time-varying in it', () => {
    // Asserted literally rather than by comparing two calls: a mutation that
    // appended Date.now() survived that comparison, because both calls landed
    // in the same millisecond. A format assertion cannot be fooled that way.
    expect(suggestionKey('deal_gone_quiet', 'd1')).toBe('deal_gone_quiet:d1');
    expect(
      suggestionsFromDeals([healthyDeal({ lastActivityDate: daysAgo(30) })], NOW, thresholds())[0]
        .dedupeKey,
    ).toBe('deal_gone_quiet:d1');
  });

  it('is stable while the condition persists', () => {
    // A deal quiet for 30 days and the same deal quiet for 45 are ONE
    // unfinished task. Re-raising it daily is the stale suggestion AC4
    // forbids, wearing a fresh id.
    const at30 = suggestionsFromDeals(
      [healthyDeal({ lastActivityDate: daysAgo(30) })],
      NOW,
      thresholds(),
    )[0].dedupeKey;
    const at45 = suggestionsFromDeals(
      [healthyDeal({ lastActivityDate: daysAgo(45) })],
      NOW,
      thresholds(),
    )[0].dedupeKey;
    expect(at45).toBe(at30);
  });

  it('separates two problems on one deal, and one problem on two deals', () => {
    expect(suggestionKey('deal_gone_quiet', 'd1')).not.toBe(
      suggestionKey('deal_no_next_step', 'd1'),
    );
    expect(suggestionKey('deal_gone_quiet', 'd1')).not.toBe(suggestionKey('deal_gone_quiet', 'd2'));
  });
});

describe('expireKeys — AC4, the criterion that makes the list trustworthy', () => {
  it('EXPIRES a suggestion whose condition has cleared', () => {
    // The rep logged the call, so the deal is no longer quiet and the sweep
    // stops producing that key. Nothing had to remember to retract it.
    const open = ['deal_gone_quiet:d1', 'quote_expiring:q1'];
    const live = ['quote_expiring:q1'];
    expect(expireKeys(open, live)).toEqual(['deal_gone_quiet:d1']);
  });

  it('leaves a suggestion whose condition still holds', () => {
    expect(expireKeys(['deal_gone_quiet:d1'], ['deal_gone_quiet:d1'])).toEqual([]);
  });

  it('expires EVERYTHING when a sweep finds no live signal at all', () => {
    expect(expireKeys(['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c']);
  });

  it('expires nothing when there is nothing open', () => {
    expect(expireKeys([], ['deal_gone_quiet:d1'])).toEqual([]);
  });
});

describe('rankSuggestions', () => {
  const draft = (dedupeKey: string, score: number) => ({
    dedupeKey,
    suggestionType: 'deal_gone_quiet' as const,
    recordType: 'deal',
    recordId: 'd',
    reason: 'r',
    action: 'a',
    score,
    ownerId: null,
    customerId: null,
    companyName: null,
  });

  it('puts the highest score first', () => {
    expect(rankSuggestions([draft('a', 10), draft('b', 90)]).map((s) => s.score)).toEqual([90, 10]);
  });

  it('is stable for equal scores, so two sweeps agree on order', () => {
    const run = () => rankSuggestions([draft('b', 50), draft('a', 50)]).map((s) => s.dedupeKey);
    expect(run()).toEqual(['a', 'b']);
    expect(run()).toEqual(run());
  });

  it('does not mutate its input', () => {
    const input = [draft('a', 10), draft('b', 90)];
    rankSuggestions(input);
    expect(input.map((s) => s.dedupeKey)).toEqual(['a', 'b']);
  });
});
