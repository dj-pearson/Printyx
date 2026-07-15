import { describe, it, expect } from 'vitest';
import {
  resolvePlatformBaseUrl,
  assessPublicApiBaseUrl,
} from '../../../supabase/functions/_shared/platform-base-url';

const fallback = { proto: 'https', host: 'functions.printyx.net' };

describe('resolvePlatformBaseUrl (EDGE-015)', () => {
  it('prefers PUBLIC_API_BASE_URL and trims a trailing slash', () => {
    expect(resolvePlatformBaseUrl('https://app.printyx.net/', fallback)).toEqual({
      url: 'https://app.printyx.net',
      isFallback: false,
    });
  });

  it('falls back to the request host when unset/blank', () => {
    for (const v of [undefined, null, '', '   ']) {
      expect(resolvePlatformBaseUrl(v, fallback)).toEqual({
        url: 'https://functions.printyx.net',
        isFallback: true,
      });
    }
  });
});

describe('assessPublicApiBaseUrl (EDGE-015 readiness)', () => {
  it('is complete when set', () => {
    const a = assessPublicApiBaseUrl('https://app.printyx.net');
    expect(a.status).toBe('complete');
    expect(a.details).toContain('app.printyx.net');
  });

  it('is a warning when unset, explaining the dead-host risk', () => {
    for (const v of [undefined, null, '', '  ']) {
      const a = assessPublicApiBaseUrl(v);
      expect(a.status).toBe('warning');
      expect(a.details).toMatch(/PUBLIC_API_BASE_URL is not set/);
    }
  });
});
