// Locks the email-autopilot decision logic across both backends.
//
// fallbackClassify decides whether an inbound email gets a drafted reply at all;
// editDistancePct feeds avgEditDistancePct and toneMissRate, which is how a rep
// judges whether the autopilot is worth using. A drift would classify
// differently on each backend, or report a different quality score for the same
// edit.
import { describe, it, expect } from 'vitest';
import {
  fallbackClassify as expressClassify,
  fallbackDraft as expressDraft,
  levenshtein as expressLev,
  editDistancePct as expressEdit,
} from '../../routes-email-autopilot';
import {
  fallbackClassify as edgeClassify,
  fallbackDraft as edgeDraft,
  levenshtein as edgeLev,
  editDistancePct as edgeEdit,
  TONE_MISS_THRESHOLD,
} from '../../../supabase/functions/_shared/email-autopilot-logic';

const EMAILS = [
  { from: 'a@b.com', subject: 'Quote request', snippet: 'Can you send pricing?' },
  { from: 'spam@x.com', subject: 'Congratulations!', snippet: 'You have a free prize' },
  { from: 'n@x.com', subject: 'Newsletter', snippet: 'This month at Acme' },
  { from: 'n@x.com', subject: 'FYI', snippet: 'no action needed' },
  { from: 'x@y.com', subject: 'Act now', snippet: 'limited time' },
  { from: 'x@y.com', subject: '', snippet: '' },
  { from: 'ops@x.com', subject: 'Report is ready', snippet: 'download inside' },
  { from: 'do-not-reply@x.com', subject: 'Ticket update', snippet: 'do not reply to this' },
  // Classification reads from/subject/snippet together — a spam word in the
  // ADDRESS alone must classify the same on both sides.
  { from: 'click here@x.com', subject: 'Normal subject', snippet: 'normal body' },
];

describe('email autopilot decision logic parity', () => {
  it.each(EMAILS)('fallbackClassify agrees for: $subject', (email) => {
    expect(edgeClassify(email)).toEqual(expressClassify(email));
  });

  it('classifies the documented bands', () => {
    expect(edgeClassify(EMAILS[0]).classification).toBe('needs_reply');
    expect(edgeClassify(EMAILS[1]).classification).toBe('spam');
    expect(edgeClassify(EMAILS[2]).classification).toBe('fyi');
  });

  it('lets spam win over fyi when both match', () => {
    const both = { from: 'x@y.com', subject: 'FYI congratulations', snippet: 'newsletter' };
    expect(edgeClassify(both).classification).toBe('spam');
    expect(edgeClassify(both)).toEqual(expressClassify(both));
  });

  const FINGERPRINTS = [{ signature: 'Cheers,\nDana' }, { signature: null }, {}];

  it('fallbackDraft agrees across emails, fingerprints and CRM context', () => {
    for (const email of EMAILS) {
      for (const fp of FINGERPRINTS) {
        for (const ctx of [null, 'Acme, 3 open tickets']) {
          expect(edgeDraft(email, fp, ctx)).toEqual(expressDraft(email, fp, ctx));
        }
      }
    }
  });

  it('does not double the Re: prefix', () => {
    const replied = { from: 'a@b.com', subject: 'Re: Quote request', snippet: 'ping' };
    expect(edgeDraft(replied, {}, null).subject).toBe('Re: Quote request');
    const fresh = { from: 'a@b.com', subject: 'Quote request', snippet: 'ping' };
    expect(edgeDraft(fresh, {}, null).subject).toBe('Re: Quote request');
  });

  it('falls back to a default signature', () => {
    expect(edgeDraft(EMAILS[0], {}, null).body).toContain('Best regards');
    expect(edgeDraft(EMAILS[0], { signature: 'Cheers,\nDana' }, null).body).toContain('Dana');
  });

  const PAIRS: Array<[string, string]> = [
    ['', ''],
    ['', 'abc'],
    ['abc', ''],
    ['abc', 'abc'],
    ['kitten', 'sitting'],
    ['a longer draft body here', 'a longer draft body here!'],
    ['completely different', 'nothing alike at all'],
    ['Hi,\n\nThanks for reaching out.', 'Hi,\n\nThanks so much for reaching out!'],
  ];

  it.each(PAIRS)('levenshtein(%s, %s) agrees', (a, b) => {
    expect(edgeLev(a, b)).toBe(expressLev(a, b));
  });

  it.each(PAIRS)('editDistancePct(%s, %s) agrees', (a, b) => {
    expect(edgeEdit(a, b)).toBe(expressEdit(a, b));
  });

  it('reports 0 for an untouched draft and 100 for a total rewrite', () => {
    expect(edgeEdit('abc', 'abc')).toBe(0);
    expect(edgeEdit('', '')).toBe(0);
    expect(edgeEdit('abc', 'xyz')).toBe(100);
  });

  // The tone-miss threshold is the reported-quality boundary, so it needs cases
  // INSIDE the band — the voice-ticket-close lock passed a threshold mutation
  // for exactly this reason.
  it('places edits either side of the tone-miss threshold', () => {
    const original = 'Thanks for reaching out about the quote, I will follow up shortly.';
    const lightEdit = 'Thanks for reaching out about the quote, I will follow up shortly!';
    const heavyEdit = 'Completely rewritten reply that shares almost nothing with the draft text.';

    const light = edgeEdit(original, lightEdit);
    const heavy = edgeEdit(original, heavyEdit);
    expect(light).toBeLessThan(TONE_MISS_THRESHOLD);
    expect(heavy).toBeGreaterThan(TONE_MISS_THRESHOLD);
    expect(light).toBe(expressEdit(original, lightEdit));
    expect(heavy).toBe(expressEdit(original, heavyEdit));
  });
});
