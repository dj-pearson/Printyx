import { describe, it, expect } from 'vitest';
import {
  sanitizeLogText,
  boundData,
  capAndSanitizeEntries,
  FixedWindowRateLimiter,
  MAX_ENTRIES_PER_REQUEST,
  MAX_MESSAGE_LEN,
  MAX_DATA_CHARS,
} from '../../../supabase/functions/_shared/mobile-log-guard';

describe('sanitizeLogText (CR-004 log-injection)', () => {
  it('strips CR/LF and control chars that could forge log lines', () => {
    const forged = 'hello\n[mobile] ERROR fake line\r\x00\x1b[31m';
    const clean = sanitizeLogText(forged, 1000);
    expect(clean).not.toMatch(/[\n\r]/);
    expect(clean.includes('\x00')).toBe(false);
    expect(clean.startsWith('hello')).toBe(true);
  });

  it('truncates to maxLen and coerces non-strings to empty', () => {
    expect(sanitizeLogText('x'.repeat(50), 10)).toHaveLength(10);
    expect(sanitizeLogText(42, 10)).toBe('');
    expect(sanitizeLogText(null, 10)).toBe('');
  });
});

describe('boundData (CR-004 size cap)', () => {
  it('passes small data through and truncates oversized data', () => {
    expect(boundData({ a: 1 })).toEqual({ a: 1 });
    const big = boundData({ blob: 'y'.repeat(MAX_DATA_CHARS + 100) }) as any;
    expect(big._truncated).toBe(true);
    expect(big.preview.length).toBeLessThanOrEqual(MAX_DATA_CHARS);
  });

  it('returns null for nullish or unserializable data', () => {
    expect(boundData(undefined)).toBeNull();
    const circular: any = {};
    circular.self = circular;
    expect(boundData(circular)).toBeNull();
  });
});

describe('capAndSanitizeEntries (CR-004 write-DoS)', () => {
  it('caps the batch to the max entry count', () => {
    const entries = Array.from({ length: MAX_ENTRIES_PER_REQUEST + 25 }, (_, i) => ({
      message: `m${i}`,
    }));
    expect(capAndSanitizeEntries(entries)).toHaveLength(MAX_ENTRIES_PER_REQUEST);
  });

  it('normalizes level, sanitizes fields and truncates message', () => {
    const [clean] = capAndSanitizeEntries([
      {
        level: 'WARN',
        message: 'a'.repeat(MAX_MESSAGE_LEN + 10),
        screen: 'Home\nX',
        data: { k: 1 },
      },
    ]);
    expect(clean.level).toBe('warn');
    expect(clean.message).toHaveLength(MAX_MESSAGE_LEN);
    expect(clean.screen).not.toMatch(/\n/);
    expect(clean.data).toEqual({ k: 1 });
  });

  it('defaults an unknown level to info', () => {
    expect(capAndSanitizeEntries([{ level: 'bogus', message: 'x' }])[0].level).toBe('info');
  });
});

describe('FixedWindowRateLimiter (CR-004 flood)', () => {
  it('allows up to max per window, then blocks, then resets after the window', () => {
    const rl = new FixedWindowRateLimiter(3, 1000);
    expect(rl.check('k', 0)).toBe(true);
    expect(rl.check('k', 10)).toBe(true);
    expect(rl.check('k', 20)).toBe(true);
    expect(rl.check('k', 30)).toBe(false); // over limit within window
    expect(rl.check('k', 1100)).toBe(true); // new window
  });

  it('tracks keys independently', () => {
    const rl = new FixedWindowRateLimiter(1, 1000);
    expect(rl.check('a', 0)).toBe(true);
    expect(rl.check('b', 0)).toBe(true);
    expect(rl.check('a', 1)).toBe(false);
  });
});
