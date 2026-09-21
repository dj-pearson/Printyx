/**
 * PROD-008: POST /api/seo/audit is SEODashboard's primary button and had no
 * branch in supabase/functions/seo/, so it 404'd for every deployed user while
 * working on every developer machine.
 *
 * The evaluator is pure and is exercised with real HTML through the Express
 * extractor. The routing, the SSRF guard and the columns each host writes are
 * source properties, bound to the construct that carries them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { evaluateSeoAudit, firstHeadingSkip, type AuditObservations } from '@shared/seo-audit';
import { emptyPageFacts, wordCount } from '@shared/seo-page-facts';
import { extractPageFacts } from '../../services/seo-service';

const ROOT = join(__dirname, '../../..');
const EDGE = join(ROOT, 'supabase/functions/seo/index.ts');
const EXPRESS = join(ROOT, 'server/routes-seo.ts');
const SCHEMA = join(ROOT, 'shared/seo-schema.ts');

function stripComments(src: string): string {
  return src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

const edgeSrc = readFileSync(EDGE, 'utf8');
const edgeCode = stripComments(edgeSrc);
const expressCode = stripComments(readFileSync(EXPRESS, 'utf8'));

const OK: AuditObservations = {
  url: 'https://printyx.net/',
  statusCode: 200,
  contentEncoding: 'gzip',
  cacheControl: 'max-age=60',
};

const SCRIPT_WORDS = 'lorem '.repeat(400);
const BODY_WORDS = 'word '.repeat(350);

const HEALTHY = `<html><head>
<title>Printyx copier dealer software for service and sales teams</title>
<meta name="description" content="Printyx brings meter billing, service dispatch and the sales pipeline into one system for copier dealers, with reporting a principal reads each morning.">
<link rel="canonical" href="https://printyx.net/">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script>
</head><body>
<script>var noise = "${SCRIPT_WORDS}";</script>
<h1>Copier dealer software</h1><h2>Service</h2><h3>Dispatch</h3>
<a href="/a">A</a><a href="https://printyx.net/b">B</a><a href="/c">C</a>
<img src="/x.png" alt="x"><img src="/y.png"><img src="/spacer.png" alt="">
<p>${BODY_WORDS}</p>
</body></html>`;

const NEGLECTED = `<html><head><title>Hi</title><meta name="robots" content="noindex"></head><body>
<h1>One</h1><h1>Two</h1><h4>Skipped</h4>
<script>var y = 1;</script>
</body></html>`;

describe('word count', () => {
  it('is zero for nothing, not one', () => {
    // ''.split(' ').length is 1, so an empty body reported one word.
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
    expect(wordCount('one')).toBe(1);
    expect(wordCount(' two  words \n here ')).toBe(3);
  });

  it('excludes inline script text', () => {
    // $('body').text() includes every inline <script>, so a JS-heavy page
    // reported thousands of words of minified JavaScript and passed the
    // thin-content check.
    const facts = extractPageFacts(HEALTHY);
    expect(wordCount(facts.bodyText)).toBeLessThan(400);
    expect(facts.bodyText).not.toContain('noise');
  });
});

describe('the audit of a healthy page', () => {
  const result = evaluateSeoAudit(extractPageFacts(HEALTHY), OK);

  it('counts a same-origin absolute link as internal', () => {
    // The original matched href^="/" plus a selector built from a missing
    // <base>, which is the literal a[href^="undefined"] - so a site using
    // absolute URLs was told to add internal links however many it had.
    expect(result.technicalDetails.internalLinks).toBe(3);
    expect(result.recommendations.join(' ')).not.toMatch(/internal link/);
  });

  it('counts an absent alt attribute, not an empty one', () => {
    // Three images: one with alt, one with none, one with alt="" - which is
    // how a decorative image is marked and which a screen reader skips
    // correctly. Only the middle one is a finding.
    expect(result.technicalDetails.totalImages).toBe(3);
    expect(result.technicalDetails.imagesWithoutAlt).toBe(1);
  });

  it('scores well and says what each score covers', () => {
    expect(result.overallScore).toBeGreaterThan(90);
    expect(result.scoreCovers.technical.length).toBeGreaterThan(3);
    expect(result.scoreCovers.content).toContain('word count');
    expect(result.scoreCovers.performance).toContain('compression');
  });

  it('names what an audit of one response cannot see', () => {
    expect(result.unbacked.join(' ')).toMatch(/not measured here/i);
    expect(result.unbacked.join(' ')).toMatch(/backlinks/i);
  });
});

describe('the audit of a neglected page', () => {
  const result = evaluateSeoAudit(extractPageFacts(NEGLECTED), {
    ...OK,
    url: 'http://printyx.net/',
  });

  it('finds the two critical failures', () => {
    const critical = result.issues.filter((i) => i.severity === 'critical').map((i) => i.message);
    expect(critical).toHaveLength(2);
    expect(critical.join(' ')).toMatch(/HTTPS/);
    expect(critical.join(' ')).toMatch(/blocked from indexing/);
    expect(result.criticalIssues).toBe(2);
  });

  it('names where the heading level skips, not just that it does', () => {
    const skip = result.issues.find((i) => i.category === 'Content Structure');
    expect(skip?.message).toContain('H1 to H4');
    expect(skip?.message).toContain('Skipped');
  });

  it('scores technical far below content, because that is where the damage is', () => {
    expect(result.technicalScore).toBeLessThan(50);
    expect(result.contentScore).toBeGreaterThan(result.technicalScore);
  });
});

describe('scoring', () => {
  it('weights a critical issue above a low one', () => {
    const facts = emptyPageFacts();
    facts.title = 'A title of about the right length for a search result';
    facts.metaDescription = 'x'.repeat(140);
    facts.headings = [{ level: 1, text: 'One' }];
    facts.viewport = 'width=device-width';
    facts.bodyText = 'word '.repeat(400);

    const clean = evaluateSeoAudit(facts, OK);
    const insecure = evaluateSeoAudit(facts, { ...OK, url: 'http://printyx.net/' });

    expect(clean.technicalScore).toBe(100);
    // A critical deducts 20; the original deducted a flat 10 per issue count
    // regardless of what the issue was.
    expect(insecure.technicalScore).toBe(80);
  });

  it('reflects compression and caching, which used to change nothing', () => {
    // performanceScore could only ever be 93 or 100: one issue existed to
    // deduct for, so an uncompressed, uncached page scored a perfect 100.
    // Each is varied ON ITS OWN, or one of them can carry the whole assertion
    // and the other can be dropped without a test noticing.
    const facts = emptyPageFacts();
    const compressed = evaluateSeoAudit(facts, OK);
    expect(compressed.performanceScore).toBe(100);

    const uncompressed = evaluateSeoAudit(facts, { ...OK, contentEncoding: null });
    expect(uncompressed.performanceScore).toBeLessThan(100);
    expect(uncompressed.issues.map((i) => i.message).join(' ')).toMatch(/not compressed/);

    const uncached = evaluateSeoAudit(facts, { ...OK, cacheControl: null });
    expect(uncached.performanceScore).toBeLessThan(100);
    expect(uncached.issues.map((i) => i.message).join(' ')).toMatch(/Cache-Control/);

    // brotli is compression too.
    expect(evaluateSeoAudit(facts, { ...OK, contentEncoding: 'br' }).performanceScore).toBe(100);
  });

  it('refuses to call a 4xx page healthy', () => {
    const facts = emptyPageFacts();
    const gone = evaluateSeoAudit(facts, { ...OK, statusCode: 404 });
    expect(gone.issues.some((i) => i.message.includes('404'))).toBe(true);
    expect(gone.criticalIssues).toBeGreaterThan(0);
  });
});

describe('heading skip detection', () => {
  it('ignores the level of the first heading', () => {
    // A page opening at H2 is not a skip - there is nothing above it.
    expect(firstHeadingSkip([{ level: 2, text: 'Start' }])).toBeNull();
    expect(firstHeadingSkip([])).toBeNull();
  });

  it('reports the first skip and stops', () => {
    const skip = firstHeadingSkip([
      { level: 1, text: 'One' },
      { level: 3, text: 'Three' },
      { level: 6, text: 'Six' },
    ]);
    expect(skip).toEqual({ from: 1, to: 3, text: 'Three' });
  });

  it('does not report going back up', () => {
    expect(
      firstHeadingSkip([
        { level: 1, text: 'One' },
        { level: 3, text: 'Three' },
      ]),
    ).not.toBeNull();
    expect(
      firstHeadingSkip([
        { level: 3, text: 'Three' },
        { level: 1, text: 'One' },
        { level: 2, text: 'Two' },
      ]),
    ).toBeNull();
  });
});

describe('the edge function serves the audit', () => {
  function branch(marker: string): string {
    const at = edgeCode.indexOf(marker);
    expect(at, marker).toBeGreaterThan(-1);
    const next = edgeCode.indexOf('if (req.method', at + marker.length);
    return next === -1 ? edgeCode.slice(at) : edgeCode.slice(at, next);
  }

  const audit = branch("resource === 'audit' && !resourceId");

  it('routes POST /seo/audit', () => {
    expect(edgeCode).toMatch(/req\.method === 'POST' && resource === 'audit' && !resourceId/);
  });

  it('fetches the page through the SSRF guard', () => {
    expect(audit).toMatch(/await safeFetch\(targetUrl, \{/);
    expect(audit).not.toMatch(/await fetch\(targetUrl/);
  });

  it('says so when the failure marker itself could not be written', () => {
    // The row then reads `running` for ever and the history list shows the
    // audit as still in progress; nothing else would notice.
    expect(audit).toMatch(/const \{ error: markError \} = await admin/);
    expect(audit).toMatch(/auditRecordStale: true/);
  });

  it('claims the row before the fetch and marks it failed when the fetch fails', () => {
    // An abandoned row reading `running` for ever is what the history list
    // beside it shows as an audit still in progress.
    const claim = audit.indexOf("status: 'running'");
    const fetchAt = audit.indexOf('await safeFetch(');
    const failed = audit.indexOf("status: 'failed'");
    expect(claim).toBeGreaterThan(-1);
    expect(claim).toBeLessThan(fetchAt);
    expect(failed).toBeGreaterThan(fetchAt);
  });

  it('uses a status the enum carries', () => {
    const schema = readFileSync(SCHEMA, 'utf8');
    const at = schema.indexOf("pgEnum('seo_audit_status'");
    expect(at).toBeGreaterThan(-1);
    const block = schema.slice(at, schema.indexOf(']);', at));
    const members = [...block.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).slice(1);
    expect(members.length).toBeGreaterThan(2);
    for (const written of [...audit.matchAll(/status: '([a-z]+)'/g)].map((m) => m[1])) {
      expect(members, `status '${written}' is not a member`).toContain(written);
    }
  });

  it('scopes both writes to the tenant', () => {
    expect(audit).toMatch(/tenant_id: tenantId/);
    expect(audit.match(/\.eq\('tenant_id', tenantId\)/g)?.length).toBe(2);
  });

  it('names its columns instead of spreading the result', () => {
    // scoreCovers and unbacked belong on the RESPONSE and have no column, so
    // bind to the .update( payload: `{ ...toCamelShallow(stored), ...audit }`
    // is the response and is correct, and a check for the name alone reports
    // the right thing as wrong.
    // The branch has TWO updates - the failure marker and the result - so find
    // the one that writes the scores rather than the first one.
    const scoreAt = audit.indexOf('overall_score:');
    expect(scoreAt).toBeGreaterThan(-1);
    const at = audit.lastIndexOf('.update({', scoreAt);
    expect(at).toBeGreaterThan(-1);
    const payload = audit.slice(at, audit.indexOf('})', scoreAt));
    expect(payload).not.toMatch(/\.\.\./);
    for (const column of ['overall_score', 'technical_score', 'issues', 'technical_details']) {
      expect(payload, column).toMatch(new RegExp(`\\n\\s+${column}:`));
    }
  });

  it('decides nothing locally', () => {
    expect(audit).toMatch(/evaluateSeoAudit\(extractPageFacts\(html\)/);
    expect(edgeSrc).toContain("from '../../../shared/seo-audit.ts'");
  });
});

describe('the Deno extractor answers the same facts', () => {
  // It cannot be called from here - node-html-parser comes from esm.sh - so
  // what is asserted is that it does the one thing the two extractors could
  // most easily disagree about, which is what counts as body text.
  const deno = stripComments(
    readFileSync(join(ROOT, 'supabase/functions/seo/_page-facts.ts'), 'utf8'),
  );

  it('strips script, style and noscript before reading the body', () => {
    const at = deno.indexOf('const body =');
    expect(at).toBeGreaterThan(-1);
    const stop = deno.indexOf('const bodyText', at);
    expect(stop).toBeGreaterThan(at);
    expect(deno.slice(at, stop)).toMatch(
      /querySelectorAll\('script, style, noscript'\)[\s\S]*\.remove\(\)/,
    );
  });

  it('reads every field the audit needs', () => {
    // htmlLength is computed at the return rather than extracted above it.
    expect(deno).toMatch(/\n\s+htmlLength: html\.length,/);

    for (const field of [
      'title',
      'metaDescription',
      'canonical',
      'robotsMeta',
      'headings',
      'bodyText',
    ]) {
      // A comma IMMEDIATELY after the identifier: the shorthand `bodyText,`
      // returns what was extracted, while `bodyText: ''` also matches an
      // optional-comma pattern and returns nothing.
      expect(deno, field).toMatch(new RegExp(`\\n\\s+${field},\\n`));
    }
  });
});

describe('the Express half runs the same evaluator', () => {
  it('has no local analysis left', () => {
    const service = stripComments(
      readFileSync(join(ROOT, 'server/services/seo-service.ts'), 'utf8'),
    );
    expect(service).toMatch(/evaluateSeoAudit\(extractPageFacts\(html\)/);
    // The 200 lines of cheerio scoring that stood here are gone, not duplicated.
    for (const gone of ['analyzeTechnicalSEO', 'analyzeContentSEO', 'analyzeBasicPerformance']) {
      expect(service, gone).not.toContain(gone);
    }
  });

  it('stops spreading the audit into drizzle', () => {
    const at = expressCode.indexOf('.update(seoAuditHistory)');
    expect(at).toBeGreaterThan(-1);
    const stop = expressCode.indexOf('.returning()', at);
    expect(stop).toBeGreaterThan(at);
    expect(expressCode.slice(at, stop)).not.toMatch(/\.\.\.auditResults/);
    expect(expressCode.slice(at, stop)).toMatch(/overallScore: auditResults\.overallScore/);
  });
});

describe('the crawl is still Express-only, named so it cannot go quiet', () => {
  it('has no edge branch', () => {
    // POST /seo/crawl walks a whole site, which is a different shape from a
    // single-page check: it needs a page budget, a depth limit and a safeFetch
    // per hop. This assertion FAILS the day it is served.
    expect(edgeCode).not.toMatch(/req\.method === 'POST' && resource === 'crawl'/);
    const page = readFileSync(join(ROOT, 'client/src/pages/SEODashboard.tsx'), 'utf8');
    expect(page).toContain("apiRequest('/api/seo/crawl', 'POST'");
  });
});
