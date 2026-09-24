/**
 * The three SEO checks that need no HTML parser (SEO-TRANSPORT-001 AC3).
 *
 * SEO-TRANSPORT-001 moved every mutation on SEODashboard off raw fetch and onto
 * apiRequest, which is what makes the requests authenticated and sends them to
 * the functions host in production. That exposed the other half of the problem:
 * SEVEN of the eleven endpoints the page calls have no branch in
 * supabase/functions/seo/index.ts, so the transport fix turned a request that
 * silently went nowhere into one that 404s. Four of those seven parse HTML and
 * need a parser decision; these three read headers and JSON, so they port with
 * no new dependency.
 *
 * ONE MODULE, BOTH HOSTS. supabase/functions/seo imports this directly (several
 * edge functions already import ../../../shared/*.ts) and so does
 * server/services/seo-service.ts, so the two cannot drift the way the print-cost
 * calculator and the GPT-5 prompts had to be held together by parity tests.
 *
 * TWO FABRICATED FIELDS WENT ON THE WAY THROUGH, both in the security result:
 *
 *   certificateValid: hasHttps   // a URL scheme is not a certificate check
 *   httpsRedirect: hasHttps      // nothing followed a redirect
 *
 * Both asserted a specific check that was never performed, on a panel a marketer
 * reads as a security posture - the shape AUDIT-019 found asserting a TLS
 * certificate valid until a date eight months in the past, still rendered green.
 * `certificateValid` is GONE and named in `unbacked`, because what a successful
 * fetch tells you is that a handshake succeeded, not that a chain is valid,
 * in-date and issued for this host. `httpsRedirect` is MEASURED now: the http://
 * form is probed and the answer is null when it was not.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityIssue {
  type: string;
  severity: Severity;
  message: string;
}

export interface SecurityHeaderResult {
  hasHttps: boolean;
  /** null when the http:// form was not probed; never inferred from the scheme. */
  httpsRedirect: boolean | null;
  hasHsts: boolean;
  hasXFrameOptions: boolean;
  hasXContentTypeOptions: boolean;
  hasCsp: boolean;
  securityScore: number;
  headers: Record<string, string>;
  issues: SecurityIssue[];
  unbacked: string[];
}

export const CERTIFICATE_UNBACKED =
  'Certificate validity is not checked. A successful request proves a TLS handshake ' +
  'succeeded, not that the chain is valid, in date and issued for this host.';

/** Each missing control costs 15, floored at 0 rather than at 100 - 5 * 15. */
export function securityScoreFor(issues: SecurityIssue[]): number {
  return Math.max(0, 100 - issues.length * 15);
}

export function evaluateSecurityHeaders(
  url: string,
  headerEntries: Array<[string, string]>,
  httpsRedirect: boolean | null,
): SecurityHeaderResult {
  const headers: Record<string, string> = {};
  // Lower-cased on the way in: HTTP header names are case-insensitive, and the
  // original tested `headers.has(...)` against a Headers object while returning
  // whatever casing the server sent, so the checks and the evidence disagreed.
  for (const [k, v] of headerEntries) headers[k.toLowerCase()] = v;

  const hasHttps = url.startsWith('https://');
  const hasHsts = 'strict-transport-security' in headers;
  const hasXFrameOptions = 'x-frame-options' in headers;
  const hasXContentTypeOptions = 'x-content-type-options' in headers;
  const hasCsp = 'content-security-policy' in headers;

  const issues: SecurityIssue[] = [];
  if (!hasHttps)
    issues.push({ type: 'https', severity: 'critical', message: 'Site not using HTTPS' });
  if (!hasHsts) issues.push({ type: 'hsts', severity: 'high', message: 'Missing HSTS header' });
  if (!hasXFrameOptions) {
    issues.push({
      type: 'clickjacking',
      severity: 'medium',
      message: 'Missing X-Frame-Options header',
    });
  }
  if (!hasXContentTypeOptions) {
    issues.push({
      type: 'mime',
      severity: 'low',
      message: 'Missing X-Content-Type-Options header',
    });
  }
  if (!hasCsp) {
    issues.push({ type: 'csp', severity: 'medium', message: 'Missing Content-Security-Policy' });
  }

  const unbacked = [CERTIFICATE_UNBACKED];
  if (httpsRedirect === null) {
    unbacked.push('The http:// form of this URL was not reachable, so no redirect was observed.');
  }

  return {
    hasHttps,
    httpsRedirect,
    hasHsts,
    hasXFrameOptions,
    hasXContentTypeOptions,
    hasCsp,
    securityScore: securityScoreFor(issues),
    headers,
    issues,
    unbacked,
  };
}

export interface RedirectStep {
  url: string;
  statusCode: number;
  location?: string | null;
}

export interface RedirectChainResult {
  /**
   * Where the chain ends, or NULL when the walk did not reach an end.
   *
   * Null when the hop limit was hit and null when a hop was refused (SEC-002),
   * because in both cases the last URL observed is a place the chain passed
   * THROUGH. The comment below has said since this module was written that
   * returning it is a claim the data does not support; it now does not.
   */
  destinationUrl: string | null;
  redirectChain: RedirectStep[];
  chainLength: number;
  statusCode: number;
  redirectType: string;
  hasRedirectLoop: boolean;
  hasMultipleRedirects: boolean;
  /** True when the walk stopped at the hop limit, so the chain may be longer. */
  truncated: boolean;
  /**
   * The hop that was refused, when SSRF validation stopped the walk.
   *
   * Reported rather than swallowed: a chain cut short at a private address that
   * summarises as a normal terminus tells an operator their redirect is fine.
   */
  blockedAt: string | null;
  issues: string[];
}

export const MAX_REDIRECTS = 10;

/**
 * Summarise an observed chain. The walk itself is the caller's, so this stays
 * pure and testable without a network.
 *
 * TRUNCATION IS REPORTED. The original stopped at ten hops and returned the
 * tenth URL as `destinationUrl`, which is a claim that the redirect ended there.
 */
export function summariseRedirectChain(
  steps: RedirectStep[],
  outcome: { loop?: boolean; truncated?: boolean; blockedAt?: string | null } = {},
): RedirectChainResult {
  if (steps.length === 0) {
    throw new Error('summariseRedirectChain needs at least the first request');
  }
  const last = steps[steps.length - 1];
  const blockedAt = outcome.blockedAt ?? null;
  const issues: string[] = [];
  if (outcome.loop) issues.push('Redirect loop detected');
  if (outcome.truncated)
    issues.push(`Stopped after ${MAX_REDIRECTS} redirects; chain may be longer`);
  if (blockedAt) {
    issues.push(`Chain stopped at ${blockedAt}: it resolves to a private or reserved address`);
  }
  if (!outcome.loop && !outcome.truncated && !blockedAt && steps.length > 2) {
    issues.push('Multiple redirects in chain');
  }

  // A loop HAS an end - the URL it comes back to - so it keeps a destination.
  // Truncation and a refusal do not: the last hop observed is somewhere the
  // chain passed through, and naming it as the destination is the exact claim
  // this function's header says it must not make.
  const incomplete = Boolean(outcome.truncated) || Boolean(blockedAt);

  return {
    destinationUrl: outcome.loop ? (last.location ?? last.url) : incomplete ? null : last.url,
    redirectChain: steps,
    chainLength: steps.length,
    statusCode: last.statusCode,
    redirectType: steps.length > 1 ? String(steps[0].statusCode) : 'none',
    hasRedirectLoop: Boolean(outcome.loop),
    hasMultipleRedirects: steps.length > 2,
    truncated: Boolean(outcome.truncated),
    blockedAt,
    issues,
  };
}

export interface CoreWebVitals {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
  tti: number | null;
  tbt: number | null;
  si: number | null;
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  unbacked: string[];
}

/**
 * The vitals as seo_core_web_vitals stores them (round 247). lcp, fid, fcp,
 * ttfb, tti and tbt are INTEGER columns and Lighthouse reports milliseconds
 * with a fraction almost every time, so an unrounded value is an insert
 * Postgres refuses - the Express route stored them unrounded and failed on
 * nearly every real measurement, while the edge function rounded inline. cls
 * and si are decimals and keep their precision. Null stays null.
 */
export function storableVitals(v: CoreWebVitals) {
  const ms = (n: number | null) => (n === null ? null : Math.round(n));
  return {
    lcp: ms(v.lcp),
    fid: ms(v.fid),
    cls: v.cls,
    fcp: ms(v.fcp),
    ttfb: ms(v.ttfb),
    tti: ms(v.tti),
    tbt: ms(v.tbt),
    si: v.si,
    performanceScore: v.performanceScore,
    accessibilityScore: v.accessibilityScore,
    bestPracticesScore: v.bestPracticesScore,
    seoScore: v.seoScore,
  };
}

/**
 * Read a PageSpeed Insights response.
 *
 * A MISSING AUDIT IS NULL, NOT ZERO. The original wrote `|| 0` on every metric,
 * so an audit Lighthouse did not return became 0ms LCP and 0 CLS - which is not
 * "we did not measure", it is a perfect score, on the two numbers this panel
 * exists to show. Whatever is missing is named instead.
 */
export function readPageSpeedVitals(payload: unknown): CoreWebVitals {
  // `unknown` rather than `any` all the way down: the payload is a third
  // party's JSON, so every read is narrowed explicitly below and a typo in a
  // key name cannot silently resolve to undefined through an any.
  type Json = Record<string, unknown>;
  const asObject = (value: unknown): Json =>
    typeof value === 'object' && value !== null ? (value as Json) : {};

  const lighthouse = asObject(asObject(payload).lighthouseResult);
  const audits = asObject(lighthouse.audits);
  const categories = asObject(lighthouse.categories);
  const missing: string[] = [];

  const metric = (key: string): number | null => {
    const value = asObject(audits[key]).numericValue;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    missing.push(key);
    return null;
  };

  const score = (key: string): number | null => {
    const value = asObject(categories[key]).score;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
    missing.push(`categories.${key}`);
    return null;
  };

  // Written out field by field rather than assembled through an index
  // signature: the field names ARE the contract the dashboard reads, and a
  // loop over a key table hides a typo behind a cast.
  const vitals: CoreWebVitals = {
    lcp: metric('largest-contentful-paint'),
    fid: metric('max-potential-fid'),
    cls: metric('cumulative-layout-shift'),
    fcp: metric('first-contentful-paint'),
    ttfb: metric('server-response-time'),
    tti: metric('interactive'),
    tbt: metric('total-blocking-time'),
    si: metric('speed-index'),
    performanceScore: score('performance'),
    accessibilityScore: score('accessibility'),
    bestPracticesScore: score('best-practices'),
    seoScore: score('seo'),
    unbacked: [],
  };

  if (missing.length > 0) {
    vitals.unbacked = [`PageSpeed returned no value for: ${missing.join(', ')}`];
  }
  return vitals;
}
