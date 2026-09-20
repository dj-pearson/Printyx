/**
 * The three header- and JSON-only SEO checks (SEO-TRANSPORT-001 AC3).
 *
 * SEO-TRANSPORT-001's transport half landed - every mutation on SEODashboard
 * goes through apiRequest now, so it carries a Bearer token and reaches the
 * functions host. That exposed the other half: seven of the eleven endpoints the
 * page calls had no branch in supabase/functions/seo, so the fix turned a
 * request that went nowhere into one that 404s. These three port with no HTML
 * parser and now run on both hosts from ONE module, which is why there is no
 * parity test here - there is nothing to hold in sync.
 *
 * Three fabrications went with the rewrite and each has its own case below.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CERTIFICATE_UNBACKED,
  evaluateSecurityHeaders,
  MAX_REDIRECTS,
  readPageSpeedVitals,
  securityScoreFor,
  summariseRedirectChain,
} from '../../../shared/seo-checks';

const repo = join(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(repo, rel), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const SECURE_HEADERS: Array<[string, string]> = [
  ['Strict-Transport-Security', 'max-age=63072000'],
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Content-Security-Policy', "default-src 'self'"],
];

describe('a security posture claims only what was checked', () => {
  it('never reports a certificate verdict, and says why', () => {
    // `certificateValid: hasHttps` asserted a certificate check from a URL
    // scheme, on a panel a marketer reads as a security posture.
    const result = evaluateSecurityHeaders('https://example.com', SECURE_HEADERS, true);
    expect('certificateValid' in result).toBe(false);
    expect(result.unbacked).toContain(CERTIFICATE_UNBACKED);
    expect(CERTIFICATE_UNBACKED).toMatch(/handshake succeeded/);
  });

  it('takes the redirect answer from the caller rather than the scheme', () => {
    // `httpsRedirect: hasHttps` claimed a redirect nothing had followed.
    const https = 'https://example.com';
    expect(evaluateSecurityHeaders(https, SECURE_HEADERS, false).httpsRedirect).toBe(false);
    expect(evaluateSecurityHeaders(https, SECURE_HEADERS, true).httpsRedirect).toBe(true);
  });

  it('a probe that could not run is null, not false', () => {
    // False says "it does not redirect"; null says nothing was observed.
    const result = evaluateSecurityHeaders('https://example.com', SECURE_HEADERS, null);
    expect(result.httpsRedirect).toBeNull();
    expect(result.unbacked.join(' ')).toMatch(/no redirect was observed/);
  });

  it('matches header names case-insensitively', () => {
    // HTTP header names are case-insensitive and servers disagree about casing.
    const upper = evaluateSecurityHeaders('https://example.com', SECURE_HEADERS, true);
    const lower = evaluateSecurityHeaders(
      'https://example.com',
      SECURE_HEADERS.map(([k, v]) => [k.toLowerCase(), v] as [string, string]),
      true,
    );
    expect(upper.issues).toEqual([]);
    expect(lower.issues).toEqual(upper.issues);
    expect(Object.keys(lower.headers)).toEqual(Object.keys(upper.headers));
  });

  it('names every missing control and scores it', () => {
    const result = evaluateSecurityHeaders('http://example.com', [], null);
    expect(result.issues.map((i) => i.type).sort()).toEqual([
      'clickjacking',
      'csp',
      'hsts',
      'https',
      'mime',
    ]);
    expect(result.issues.find((i) => i.type === 'https')?.severity).toBe('critical');
    expect(result.securityScore).toBe(securityScoreFor(result.issues));
  });

  it('the score floors at zero rather than at 100 minus five fifteens', () => {
    expect(securityScoreFor([])).toBe(100);
    const eight = Array.from({ length: 8 }, () => ({
      type: 'x',
      severity: 'low' as const,
      message: 'x',
    }));
    expect(securityScoreFor(eight)).toBe(0);
  });
});

describe('a redirect chain reports where it stopped', () => {
  const step = (url: string, statusCode: number, location?: string) => ({
    url,
    statusCode,
    location: location ?? null,
  });

  it('a single 200 is not a redirect', () => {
    const result = summariseRedirectChain([step('https://a.test/', 200)]);
    expect(result.redirectType).toBe('none');
    expect(result.chainLength).toBe(1);
    expect(result.hasMultipleRedirects).toBe(false);
    expect(result.issues).toEqual([]);
    expect(result.destinationUrl).toBe('https://a.test/');
  });

  it('reports the first status as the redirect type and the last url as the destination', () => {
    const result = summariseRedirectChain([
      step('http://a.test/', 301, 'https://a.test/'),
      step('https://a.test/', 200),
    ]);
    expect(result.redirectType).toBe('301');
    expect(result.destinationUrl).toBe('https://a.test/');
    expect(result.statusCode).toBe(200);
  });

  it('flags a loop and points the destination at the url it came back to', () => {
    const result = summariseRedirectChain(
      [
        step('https://a.test/', 302, 'https://b.test/'),
        step('https://b.test/', 302, 'https://a.test/'),
      ],
      { loop: true },
    );
    expect(result.hasRedirectLoop).toBe(true);
    expect(result.issues).toEqual(['Redirect loop detected']);
    expect(result.destinationUrl).toBe('https://a.test/');
  });

  it('says the chain was truncated instead of calling the last hop the destination', () => {
    // Stopping at the limit and returning that URL is a claim the redirect
    // ended there.
    const steps = Array.from({ length: MAX_REDIRECTS }, (_, i) =>
      step(`https://a.test/${i}`, 301, `https://a.test/${i + 1}`),
    );
    const result = summariseRedirectChain(steps, { truncated: true });
    expect(result.truncated).toBe(true);
    expect(result.issues.join(' ')).toMatch(new RegExp(`Stopped after ${MAX_REDIRECTS}`));
    expect(result.issues).not.toContain('Multiple redirects in chain');
  });

  it('refuses to summarise a walk that never made a request', () => {
    expect(() => summariseRedirectChain([])).toThrow(/at least the first request/);
  });
});

describe('a missing PageSpeed audit is null, not a perfect score', () => {
  const payload = (over: Record<string, unknown> = {}) => ({
    lighthouseResult: {
      audits: {
        'largest-contentful-paint': { numericValue: 2100 },
        'cumulative-layout-shift': { numericValue: 0.04 },
        ...((over.audits as Record<string, unknown>) ?? {}),
      },
      categories: { performance: { score: 0.91 }, ...((over.categories as object) ?? {}) },
    },
  });

  it('reads the values PageSpeed returned', () => {
    const vitals = readPageSpeedVitals(payload());
    expect(vitals.lcp).toBe(2100);
    expect(vitals.cls).toBe(0.04);
    expect(vitals.performanceScore).toBe(91);
  });

  it('answers null for an audit that is absent, and names it', () => {
    // `|| 0` made a missing LCP read as instant rendering.
    const vitals = readPageSpeedVitals(payload());
    expect(vitals.fid).toBeNull();
    expect(vitals.seoScore).toBeNull();
    expect(vitals.unbacked.join(' ')).toContain('max-potential-fid');
    expect(vitals.unbacked.join(' ')).toContain('categories.seo');
  });

  it('a real zero is kept, because 0 CLS is a measurement', () => {
    const vitals = readPageSpeedVitals(
      payload({ audits: { 'cumulative-layout-shift': { numericValue: 0 } } }),
    );
    expect(vitals.cls).toBe(0);
    expect(vitals.unbacked.join(' ')).not.toContain('cumulative-layout-shift');
  });

  it('an empty or junk payload yields all nulls rather than throwing', () => {
    for (const input of [undefined, null, {}, { lighthouseResult: {} }]) {
      const vitals = readPageSpeedVitals(input);
      expect(vitals.lcp).toBeNull();
      expect(vitals.performanceScore).toBeNull();
      expect(vitals.unbacked).toHaveLength(1);
    }
  });

  it('says nothing is unbacked when everything came back', () => {
    const full = {
      lighthouseResult: {
        audits: Object.fromEntries(
          [
            'largest-contentful-paint',
            'max-potential-fid',
            'cumulative-layout-shift',
            'first-contentful-paint',
            'server-response-time',
            'interactive',
            'total-blocking-time',
            'speed-index',
          ].map((k) => [k, { numericValue: 1 }]),
        ),
        categories: Object.fromEntries(
          ['performance', 'accessibility', 'best-practices', 'seo'].map((k) => [k, { score: 1 }]),
        ),
      },
    };
    expect(readPageSpeedVitals(full).unbacked).toEqual([]);
  });
});

describe('both hosts serve the three endpoints from the one module', () => {
  const EDGE = stripComments(read('supabase/functions/seo/index.ts'));
  const SERVICE = stripComments(read('server/services/seo-service.ts'));

  it.each([
    ["resource === 'check' && resourceId === 'security'", 'seo_security_analysis'],
    ["resource === 'detect' && resourceId === 'redirect-chains'", 'seo_redirect_analysis'],
    ["resource === 'core-web-vitals' && !resourceId", 'seo_core_web_vitals'],
  ])('the edge function serves %s and stores it', (guard, table) => {
    // Anchored to the WHOLE condition: asserting the guard text alone passes
    // against `if (false && <guard>)`, which is a branch that never runs.
    expect(EDGE).toContain(`if (req.method === 'POST' && ${guard}) {`);
    expect(EDGE).toContain(`from('${table}')`);
  });

  it('never writes certificate_valid, since nothing measures it', () => {
    expect(EDGE).not.toContain('certificate_valid');
  });

  it('answers 501 rather than guessing when there is no PageSpeed key', () => {
    // The refusal has to TEST the key. Reading it and then branching on
    // something else leaves both these strings in the file.
    expect(EDGE).toContain("const apiKey = Deno.env.get('PAGESPEED_INSIGHTS_API_KEY');");
    expect(EDGE).toContain('if (!apiKey) {');
    const at = EDGE.indexOf('if (!apiKey) {');
    const branch = EDGE.slice(at, EDGE.indexOf('}', EDGE.indexOf('501', at)));
    expect(branch).toContain('NOT_CONFIGURED');
    expect(branch).toContain('501');
  });

  it('the fabricated vitals fallback is gone from the Express service', () => {
    // It returned LCP 2500, CLS 0.1 and a performance score of 75 on any API
    // failure, and the route stored that as a measurement. Comments are
    // stripped: the replacement names the function it removed.
    expect(SERVICE).not.toContain('estimateCoreWebVitals');
    expect(SERVICE).toContain('readPageSpeedVitals(data)');
  });

  it('both hosts CALL the shared evaluation, not merely import it', () => {
    // An import is not a use: the mutant that replaced the call with a literal
    // left the import line untouched and passed.
    expect(EDGE).toContain("from '../../../shared/seo-checks.ts'");
    expect(EDGE).toContain('evaluateSecurityHeaders(');
    expect(EDGE).toContain('summariseRedirectChain(steps, { loop, truncated })');
    expect(SERVICE).toContain("from '@shared/seo-checks'");
    expect(SERVICE).toContain('return evaluateSecurityHeaders(url, entries, httpsRedirect);');
    expect(SERVICE).toContain('return summariseRedirectChain(steps, { loop, truncated });');
  });
});

describe('the four endpoints that still 404 in production are named, not forgotten', () => {
  const EDGE = readFileSync(join(repo, 'supabase/functions/seo/index.ts'), 'utf8');

  /**
   * check:edge-path-coverage works at SEGMENT granularity, so serving
   * /seo/check/security cleared `check` from its baseline while
   * /seo/check/broken-links and /seo/check/mobile remain unserved. Tightening
   * that baseline is right - it keeps the ratchet honest about what it measures
   * - but it means the guard can no longer see these two. This is where that
   * fact lives instead, and it FAILS when somebody serves one, so the list
   * cannot quietly go stale.
   */
  const STILL_UNSERVED = [
    ['analyze', 'images'],
    ['check', 'broken-links'],
    ['check', 'mobile'],
    ['validate', 'structured-data'],
  ] as const;

  it.each(STILL_UNSERVED)('/seo/%s/%s is still Express-only', (resource, id) => {
    expect(EDGE).not.toContain(`resourceId === '${id}'`);
  });

  it('all four are the HTML-parsing ones, which is why they were not ported', () => {
    // They need a DOM parser in Deno; the three that shipped read response
    // headers and a JSON API. Recorded against EDGE-002e, which owns the port.
    expect(STILL_UNSERVED).toHaveLength(4);
    const prd = JSON.parse(readFileSync(join(repo, 'prd.json'), 'utf8'));
    const story = prd.userStories.find((x: { id: string }) => x.id === 'EDGE-002e');
    expect(story, 'EDGE-002e owns the remaining port').toBeDefined();
    for (const [resource, id] of STILL_UNSERVED) {
      expect(story.notes, `${resource}/${id} not recorded`).toContain(`${resource}/${id}`);
    }
  });
});
