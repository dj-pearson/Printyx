// Email-autopilot decision logic: whether an inbound email gets a drafted reply
// at all, and how much the rep changed the draft.
//
// This used to be a PARITY test between Express's
// server/routes-email-autopilot.ts and the Deno
// supabase/functions/_shared/email-autopilot-logic.ts. PROD-008b retired those
// Express routes - they were shadowed by the /api/email-autopilot proxy and ran
// on neither host - so comparing the live module against a fossil would prove
// nothing. Every expected value below is now stated outright and derived from
// the rules (the keyword lists, and Levenshtein by hand), not snapshotted off
// the implementation.
//
// The stakes: editDistancePct feeds avgEditDistancePct and toneMissRate, which
// is how a rep judges whether the autopilot is worth using at all.
import { describe, it, expect } from 'vitest';
import {
  fallbackClassify,
  fallbackDraft,
  levenshtein,
  editDistancePct,
  TONE_MISS_THRESHOLD,
  SPAM_KEYWORDS,
  FYI_KEYWORDS,
} from '../../../supabase/functions/_shared/email-autopilot-logic';

describe('fallbackClassify', () => {
  // Classification matches `${subject} ${snippet} ${from}` lowercased against
  // the two keyword lists, spam first. Expected values read off those lists.
  it.each([
    [
      'a plain question',
      { from: 'a@b.com', subject: 'Quote request', snippet: 'Can you send pricing?' },
      'needs_reply',
    ],
    [
      'a spam subject',
      { from: 'spam@x.com', subject: 'Congratulations!', snippet: 'You have a free prize' },
      'spam',
    ],
    [
      'a newsletter',
      { from: 'n@x.com', subject: 'Newsletter', snippet: 'This month at Acme' },
      'fyi',
    ],
    ['an fyi subject', { from: 'n@x.com', subject: 'FYI', snippet: 'no action needed' }, 'fyi'],
    ['an urgency hook', { from: 'x@y.com', subject: 'Act now', snippet: 'limited time' }, 'spam'],
    ['nothing at all', { from: 'x@y.com', subject: '', snippet: '' }, 'needs_reply'],
    [
      'a ready report',
      { from: 'ops@x.com', subject: 'Report is ready', snippet: 'download inside' },
      'fyi',
    ],
    [
      'a no-reply notice',
      { from: 'do-not-reply@x.com', subject: 'Ticket update', snippet: 'do not reply to this' },
      'fyi',
    ],
    // The haystack includes the FROM address, so a keyword hiding there counts.
    [
      'a keyword in the address only',
      { from: 'click here@x.com', subject: 'Normal subject', snippet: 'normal body' },
      'spam',
    ],
  ])('classifies %s as %s', (_label, email, expected) => {
    expect(fallbackClassify(email as never).classification).toBe(expected);
  });

  it('lets spam win over fyi when both match', () => {
    // Order of the checks IS the policy: a newsletter that also shouts
    // "congratulations" is spam, not fyi.
    const both = { from: 'x@y.com', subject: 'FYI congratulations', snippet: 'newsletter' };
    expect(fallbackClassify(both).classification).toBe('spam');
  });

  it('reports lower confidence for the default branch than for a keyword hit', () => {
    // needs_reply is what you get when NOTHING matched, so it must not claim
    // the same confidence as a positive keyword match.
    const matched = fallbackClassify({ from: 'a@b.com', subject: 'FYI', snippet: '' });
    const defaulted = fallbackClassify({ from: 'a@b.com', subject: 'Hello', snippet: '' });
    expect(matched.confidence).toBe(0.6);
    expect(defaulted.confidence).toBe(0.55);
    expect(defaulted.confidence).toBeLessThan(matched.confidence);
  });

  it('marks every fallback result as fallback, never ai', () => {
    // The caller decides whether to trust it based on this field; a fallback
    // labelled 'ai' would be presented to the rep as a model judgement.
    for (const source of [
      fallbackClassify({ from: 'a@b.com', subject: 'x', snippet: 'y' }).source,
      fallbackClassify({ from: 'a@b.com', subject: 'Act now', snippet: '' }).source,
    ]) {
      expect(source).toBe('fallback');
    }
  });

  it('matches every keyword in both lists', () => {
    // Guards against a keyword being added to a list but not reachable - e.g.
    // one with different casing or stray whitespace.
    for (const keyword of SPAM_KEYWORDS) {
      expect(
        fallbackClassify({ from: 'a@b.com', subject: keyword.toUpperCase(), snippet: '' })
          .classification,
        `spam keyword "${keyword}" did not match`,
      ).toBe('spam');
    }
    for (const keyword of FYI_KEYWORDS) {
      expect(
        fallbackClassify({ from: 'a@b.com', subject: keyword.toUpperCase(), snippet: '' })
          .classification,
        `fyi keyword "${keyword}" did not match`,
      ).toBe('fyi');
    }
  });
});

describe('fallbackDraft', () => {
  const email = { from: 'a@b.com', subject: 'Quote request', snippet: 'Can you send pricing?' };

  it('adds a Re: prefix once and never twice', () => {
    expect(fallbackDraft(email, {}, null).subject).toBe('Re: Quote request');
    const replied = { ...email, subject: 'Re: Quote request' };
    expect(fallbackDraft(replied, {}, null).subject).toBe('Re: Quote request');
  });

  it('detects an existing prefix case-insensitively', () => {
    // Mail clients send RE: and re: as readily as Re:.
    for (const subject of ['RE: Quote request', 're: Quote request']) {
      expect(fallbackDraft({ ...email, subject }, {}, null).subject).toBe(subject);
    }
  });

  it('signs with the rep voice fingerprint when there is one', () => {
    expect(fallbackDraft(email, { signature: 'Cheers,\nDana' }, null).body).toContain(
      'Cheers,\nDana',
    );
  });

  it('falls back to a neutral signature rather than leaving it blank', () => {
    expect(fallbackDraft(email, {}, null).body).toContain('Best regards');
    expect(fallbackDraft(email, { signature: null }, null).body).toContain('Best regards');
  });

  it('includes CRM context only when it is supplied', () => {
    expect(fallbackDraft(email, {}, 'Acme, 3 open tickets').body).toContain('Acme, 3 open tickets');
    expect(fallbackDraft(email, {}, null).body).not.toContain('For context');
  });

  it('quotes the original subject in the body', () => {
    expect(fallbackDraft(email, {}, null).body).toContain('"Quote request"');
  });

  it('is marked fallback, so the rep is not shown it as model output', () => {
    expect(fallbackDraft(email, {}, null).source).toBe('fallback');
  });
});

describe('levenshtein', () => {
  // Every value below was worked out by hand and cross-checked against an
  // independently written DP, not read off this implementation.
  it.each([
    ['both empty', '', '', 0],
    ['insert into empty', '', 'abc', 3],
    ['delete to empty', 'abc', '', 3],
    ['identical', 'abc', 'abc', 0],
    // The textbook case: kitten -> sitting is k->s, e->i, +g.
    ['kitten/sitting', 'kitten', 'sitting', 3],
    // One appended character.
    ['appended punctuation', 'a longer draft body here', 'a longer draft body here!', 1],
    // "so much " inserted (8) plus '.' -> '!' (1).
    [
      'inserted phrase plus punctuation',
      'Hi,\n\nThanks for reaching out.',
      'Hi,\n\nThanks so much for reaching out!',
      9,
    ],
  ])('%s', (_label, a, b, expected) => {
    expect(levenshtein(a as string, b as string)).toBe(expected);
  });

  it('is symmetric', () => {
    // Cheap property, and it catches a transposed prev/curr row - the classic
    // bug in the two-row optimisation this implementation uses.
    for (const [a, b] of [
      ['kitten', 'sitting'],
      ['completely different', 'nothing alike at all'],
      ['', 'abc'],
    ]) {
      expect(levenshtein(a, b)).toBe(levenshtein(b, a));
    }
  });

  it('never exceeds the longer string', () => {
    // The upper bound: you can always rewrite one string into the other by
    // replacing every character and adding or removing the difference.
    for (const [a, b] of [
      ['completely different', 'nothing alike at all'],
      ['abc', 'xyz'],
      ['a', 'bbbbbbbb'],
    ]) {
      expect(levenshtein(a, b)).toBeLessThanOrEqual(Math.max(a.length, b.length));
      expect(levenshtein(a, b)).toBeGreaterThan(0);
    }
  });
});

describe('editDistancePct', () => {
  it.each([
    ['an untouched draft', 'abc', 'abc', 0],
    ['two empty strings', '', '', 0],
    ['a total rewrite of equal length', 'abc', 'xyz', 100],
    ['a draft deleted entirely', 'abc', '', 100],
    // 3/7 = 42.857… -> one decimal place.
    ['kitten/sitting', 'kitten', 'sitting', 42.9],
    // 1/25.
    ['one appended character', 'a longer draft body here', 'a longer draft body here!', 4],
    // 9/37 = 24.324… -> 24.3.
    [
      'an inserted phrase',
      'Hi,\n\nThanks for reaching out.',
      'Hi,\n\nThanks so much for reaching out!',
      24.3,
    ],
  ])('%s scores %f', (_label, a, b, expected) => {
    expect(editDistancePct(a as string, b as string)).toBe(expected);
  });

  it('divides by the LONGER string, so a deletion is not over-reported', () => {
    // 'abcdef' -> 'abc' is 3 edits. Over the longer string that is 50%; over the
    // shorter it would read as 100%, i.e. a total rewrite, which it is not.
    expect(editDistancePct('abcdef', 'abc')).toBe(50);
  });

  it('rounds to one decimal place', () => {
    expect(editDistancePct('kitten', 'sitting')).toBe(42.9);
  });

  it('places light and heavy edits either side of the tone-miss threshold', () => {
    // The threshold is the reported-quality boundary, so it needs cases INSIDE
    // the band rather than only 0 and 100 - a bare 0/100 pair passes any
    // threshold value at all.
    const original = 'Thanks for reaching out about the quote, I will follow up shortly.';
    const light = editDistancePct(original, original.replace(/\.$/, '!'));
    const heavy = editDistancePct(
      original,
      'Completely rewritten reply that shares almost nothing with the draft text.',
    );
    expect(light).toBeLessThan(TONE_MISS_THRESHOLD);
    expect(heavy).toBeGreaterThan(TONE_MISS_THRESHOLD);
    expect(TONE_MISS_THRESHOLD).toBe(50);
  });
});
