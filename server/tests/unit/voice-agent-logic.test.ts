// Voice agent decision logic + backend convergence (US-SUPER-013 / PROD-012 /
// PROD-008b).
//
// This file replaces voice-agent-logic-parity.test.ts. That test compared two
// copies of the same functions, one in server/routes-voice-agent.ts and one in
// supabase/functions/_shared/voice-agent-logic.ts. The Express copy is gone:
// /api/voice-agent is in crmProxies, so every handler in that file was
// unreachable on both hosts, and the edge function already served all seven
// paths. With one implementation left there is nothing to compare, so the
// tables below assert the behaviour itself.
//
// The stakes are unchanged. The intake pipeline CREATES A SERVICE TICKET from
// classifyPriority's answer and pages the on-call technician on P1, so a
// silent change here opens tickets at the wrong urgency, or wakes someone at
// 2am who should not have been woken.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  classifyPriority,
  redactPii,
  estimateCost,
  fallbackSummary,
  parseHHMM,
  isWithinBusinessHours,
  ticketPriority,
  last10Digits,
} from '../../../supabase/functions/_shared/voice-agent-logic';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf-8');

describe('voice agent priority classification', () => {
  const CASES: Array<[string, 'P1' | 'P2' | 'P3']> = [
    ['', 'P3'],
    ['The machine is completely down and we have a deadline', 'P1'],
    ['It is CRITICAL, no power at all', 'P1'],
    ['This is an emergency, the copier is not working', 'P1'],
    ['DOWN in caps', 'P1'],
    ['The finisher is broken', 'P2'],
    ["It won't print duplex", 'P2'],
    ['wont print anything', 'P2'],
    ['There is a severe jam in tray 2', 'P2'],
    ['bad jam again', 'P2'],
    ['It has jammed badly twice today', 'P2'],
    ['Prints are slow and quality is poor', 'P3'],
    ['Intermittent error code 51', 'P3'],
    ['Just calling about a supply order', 'P3'],
  ];

  it.each(CASES)('classifies %s as %s', (transcript, expected) => {
    expect(classifyPriority(transcript)).toBe(expected);
  });

  it('lets P1 win when both P1 and P2 keywords are present', () => {
    expect(classifyPriority('the scanner is down but also broken')).toBe('P1');
  });

  it.each(['P1', 'P2', 'P3'] as const)('maps %s onto a ticket urgency', (p) => {
    expect(ticketPriority(p)).toBe({ P1: 'urgent', P2: 'high', P3: 'medium' }[p]);
  });
});

describe('voice agent transcript redaction', () => {
  const CASES: Array<[string, string]> = [
    ['', ''],
    ['no numbers at all', 'no numbers at all'],
    // A phone number is the callback number - it must survive.
    ['call me at 515-242-7911', 'call me at 515-242-7911'],
    ['my card is 4111 1111 1111 1111', 'my card is ****'],
    ['card 4111111111111111 expires soon', 'card **** expires soon'],
    // Outside the 13-16 digit card band, so left alone.
    ['twelve digits 123456789012 only', 'twelve digits 123456789012 only'],
    ['seventeen digits 12345678901234567 here', 'seventeen digits 12345678901234567 here'],
  ];

  it.each(CASES)('redacts %s', (input, expected) => {
    expect(redactPii(input)).toBe(expected);
  });
});

describe('voice agent cost metering', () => {
  const CASES: Array<[number, { twilioCost: number; aiCost: number; totalCost: number }]> = [
    [0, { twilioCost: 0, aiCost: 0, totalCost: 0 }],
    [-30, { twilioCost: 0, aiCost: 0, totalCost: 0 }],
    [1, { twilioCost: 0.0002, aiCost: 0.0017, totalCost: 0.0019 }],
    [59, { twilioCost: 0.0128, aiCost: 0.0983, totalCost: 0.1111 }],
    [60, { twilioCost: 0.013, aiCost: 0.1, totalCost: 0.113 }],
    [61, { twilioCost: 0.0132, aiCost: 0.1017, totalCost: 0.1149 }],
    [600, { twilioCost: 0.13, aiCost: 1, totalCost: 1.13 }],
    [3600, { twilioCost: 0.78, aiCost: 6, totalCost: 6.78 }],
    [7325.4, { twilioCost: 1.5872, aiCost: 12.209, totalCost: 13.7962 }],
  ];

  it.each(CASES.map(([s, e]) => [String(s), s, e] as const))('costs %s seconds', (_l, secs, e) => {
    expect(estimateCost(secs)).toEqual(e);
  });
});

describe('voice agent offline intake fallback', () => {
  it('keeps the transcript as the detected issue', () => {
    expect(fallbackSummary('The finisher is broken')).toEqual({
      detectedIssue: 'The finisher is broken',
      machineRef: null,
      callbackNumber: null,
      language: 'en',
    });
  });

  it('substitutes a placeholder when nothing was captured', () => {
    expect(fallbackSummary('').detectedIssue).toBe('Service request (no transcript captured).');
  });

  it('pulls a callback number out of the transcript and defaults to English', () => {
    const s = fallbackSummary('please call me back on 515-242-7911 thanks');
    expect(s.callbackNumber).toBe('515-242-7911');
    expect(s.language).toBe('en');
  });

  it('drops a leading paren', () => {
    // The pattern must start at a digit, so "(515) 242-7911" captures from the
    // 5. Recorded rather than asserted-around: it is cosmetic, and a future fix
    // is a deliberate change to this expectation.
    expect(fallbackSummary('call me on (515) 242-7911').callbackNumber).toBe('515) 242-7911');
  });
});

describe('voice agent after-hours gate', () => {
  const HHMM: Array<[string, unknown, number | null]> = [
    ['08:00', '08:00', 480],
    ['8:00', '8:00', 480],
    ['23:59', '23:59', 1439],
    ['24:00', '24:00', null],
    ['12:60', '12:60', null],
    ['nonsense', 'nonsense', null],
    ['empty', '', null],
    ['padded 09:30', '  09:30  ', 570],
    ['null', null, null],
    ['number 7', 7, null],
  ];

  it.each(HHMM)('parses %s', (_l, input, expected) => {
    expect(parseHHMM(input)).toBe(expected);
  });

  const HOURS = { days: { mon: { open: '08:00', close: '17:00' }, sun: null } };
  const MOMENTS: Array<[string, boolean]> = [
    ['2026-08-17T09:00:00', true], // Monday morning, inside
    ['2026-08-17T07:59:00', false], // Monday, just before open
    ['2026-08-17T17:00:00', false], // Monday, exactly at close
    ['2026-08-16T12:00:00', false], // Sunday, explicitly closed
    ['2026-08-18T12:00:00', false], // Tuesday, no window configured
  ];

  it.each(MOMENTS)('is %s inside business hours: %s', (when, expected) => {
    expect(isWithinBusinessHours(HOURS, new Date(when))).toBe(expected);
  });

  it('treats missing or malformed config as after-hours so the agent answers', () => {
    const when = new Date('2026-08-17T09:00:00');
    for (const bad of [null, undefined, {}, { days: null }, { days: { mon: { open: 'x' } } }]) {
      expect(isWithinBusinessHours(bad, when)).toBe(false);
    }
  });
});

describe('voice agent caller identification', () => {
  it.each([
    ['+15152427911', '5152427911'],
    ['(515) 242-7911', '5152427911'],
    ['5152427911', '5152427911'],
    ['123456', null],
    ['', null],
    [null, null],
  ] as Array<[string | null, string | null]>)('normalises %s', (input, expected) => {
    expect(last10Digits(input)).toBe(expected);
  });
});

describe('voice agent backend convergence (PROD-008b)', () => {
  const PROXY = read('server/middleware/edge-function-proxy.ts');
  const EDGE = read('supabase/functions/voice-agent/index.ts');

  it('the /api/voice-agent prefix is proxied to the edge function', () => {
    expect(PROXY).toContain("'/api/voice-agent': 'voice-agent'");
  });

  it('no Express file registers an /api/voice-agent handler', () => {
    // Anything re-added under this prefix would be shadowed by the proxy and
    // never run, on either host.
    const hits = [...read('server/routes-registry.ts').matchAll(/registerVoiceAgentRoutes/g)];
    expect(hits).toEqual([]);
  });

  it('the edge function dispatches every path the old Express file served', () => {
    for (const branch of ['settings', 'cost', 'purge-recordings', 'calls', 'intake']) {
      expect(EDGE).toContain(`first === '${branch}'`);
    }
  });
});
