// Locks the voice agent's decision logic across both backends.
//
// The intake pipeline CREATES A SERVICE TICKET from classifyPriority's answer
// and pages the on-call technician on P1, so a drift between
// server/routes-voice-agent.ts and _shared/voice-agent-logic.ts would open
// tickets at the wrong urgency — or wake someone at 2am who should not have
// been woken.
import { describe, it, expect } from 'vitest';
import {
  classifyPriority as expressClassify,
  redactPii as expressRedact,
  estimateCost as expressCost,
  fallbackSummary as expressFallback,
  parseHHMM as expressParseHHMM,
  isWithinBusinessHours as expressWithinHours,
  ticketPriority as expressTicketPriority,
} from '../../routes-voice-agent';
import {
  classifyPriority as edgeClassify,
  redactPii as edgeRedact,
  estimateCost as edgeCost,
  fallbackSummary as edgeFallback,
  parseHHMM as edgeParseHHMM,
  isWithinBusinessHours as edgeWithinHours,
  ticketPriority as edgeTicketPriority,
} from '../../../supabase/functions/_shared/voice-agent-logic';

const TRANSCRIPTS = [
  '',
  'The machine is completely down and we have a deadline',
  'It is CRITICAL, no power at all',
  'This is an emergency, the copier is not working',
  'The finisher is broken',
  "It won't print duplex",
  'wont print anything',
  'There is a severe jam in tray 2',
  'bad jam again',
  'It has jammed badly twice today',
  'Prints are slow and quality is poor',
  'Intermittent error code 51',
  'Just calling about a supply order',
  'DOWN in caps',
  'The scanner is down but also broken',
];

describe('voice agent decision logic parity', () => {
  it.each(TRANSCRIPTS)('classifyPriority agrees: %s', (t) => {
    expect(edgeClassify(t)).toBe(expressClassify(t));
  });

  it('classifies the documented keyword bands', () => {
    expect(edgeClassify('the copier is down')).toBe('P1');
    expect(edgeClassify('the finisher is broken')).toBe('P2');
    expect(edgeClassify('prints are slow')).toBe('P3');
    expect(edgeClassify('')).toBe('P3');
  });

  it('lets P1 win when both P1 and P2 keywords are present', () => {
    expect(edgeClassify('the scanner is down but also broken')).toBe('P1');
    expect(edgeClassify('the scanner is down but also broken')).toBe(
      expressClassify('the scanner is down but also broken'),
    );
  });

  const PII = [
    '',
    'call me at 515-242-7911',
    'my card is 4111 1111 1111 1111',
    'card 4111111111111111 expires soon',
    'twelve digits 123456789012 only',
    'seventeen digits 12345678901234567 here',
    'no numbers at all',
  ];

  it.each(PII)('redactPii agrees: %s', (t) => {
    expect(edgeRedact(t)).toBe(expressRedact(t));
  });

  it('masks a card number but leaves a phone number alone', () => {
    expect(edgeRedact('my card is 4111 1111 1111 1111')).toContain('****');
    expect(edgeRedact('call me at 515-242-7911')).toContain('515-242-7911');
  });

  it.each([0, -30, 1, 59, 60, 61, 600, 3600, 7325.4])('estimateCost agrees at %is', (secs) => {
    expect(edgeCost(secs)).toEqual(expressCost(secs));
  });

  it('never charges for a negative duration', () => {
    expect(edgeCost(-100)).toEqual({ twilioCost: 0, aiCost: 0, totalCost: 0 });
  });

  it.each(TRANSCRIPTS)('fallbackSummary agrees: %s', (t) => {
    expect(edgeFallback(t)).toEqual(expressFallback(t));
  });

  it('pulls a callback number out of the transcript and defaults to English', () => {
    const s = edgeFallback('please call me back on 515-242-7911 thanks');
    expect(s.callbackNumber).toBe('515-242-7911');
    expect(s.language).toBe('en');
    expect(edgeFallback('')).toEqual(expressFallback(''));
  });

  it('drops a leading paren, identically on both sides', () => {
    // The pattern must start at a digit, so "(515) 242-7911" captures from the
    // 5. Recorded rather than asserted-around: it is cosmetic, it is shared
    // behaviour, and a future fix belongs in both copies at once.
    const parens = 'call me on (515) 242-7911';
    expect(edgeFallback(parens).callbackNumber).toBe('515) 242-7911');
    expect(edgeFallback(parens)).toEqual(expressFallback(parens));
  });

  const TIMES = ['08:00', '8:00', '23:59', '24:00', '12:60', 'nonsense', '', '  09:30  ', null, 7];

  it.each(TIMES.map((t) => [String(t), t]))('parseHHMM agrees: %s', (_l, t) => {
    expect(edgeParseHHMM(t)).toBe(expressParseHHMM(t));
  });

  const HOURS = { days: { mon: { open: '08:00', close: '17:00' }, sun: null } };
  const MOMENTS = [
    new Date('2026-08-17T09:00:00'), // Monday morning, inside
    new Date('2026-08-17T07:59:00'), // Monday, just before open
    new Date('2026-08-17T17:00:00'), // Monday, exactly at close
    new Date('2026-08-16T12:00:00'), // Sunday, explicitly closed
    new Date('2026-08-18T12:00:00'), // Tuesday, no window configured
  ];

  it.each(MOMENTS.map((d) => [d.toISOString(), d]))(
    'isWithinBusinessHours agrees at %s',
    (_l, when) => {
      expect(edgeWithinHours(HOURS, when)).toBe(expressWithinHours(HOURS, when));
    },
  );

  it('treats missing or malformed config as after-hours so the agent answers', () => {
    const when = new Date('2026-08-17T09:00:00');
    for (const bad of [null, undefined, {}, { days: null }, { days: { mon: { open: 'x' } } }]) {
      expect(edgeWithinHours(bad, when)).toBe(false);
      expect(edgeWithinHours(bad, when)).toBe(expressWithinHours(bad, when));
    }
  });

  it.each(['P1', 'P2', 'P3'] as const)('ticketPriority agrees for %s', (p) => {
    expect(edgeTicketPriority(p)).toBe(expressTicketPriority(p));
  });

  it('maps voice priority onto ticket urgency', () => {
    expect(edgeTicketPriority('P1')).toBe('urgent');
    expect(edgeTicketPriority('P2')).toBe('high');
    expect(edgeTicketPriority('P3')).toBe('medium');
  });
});
