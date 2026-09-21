/**
 * PROD-008: SEODashboard's image, broken-link, mobile and structured-data
 * buttons had no branch in supabase/functions/seo/, so all four 404'd for every
 * deployed user while working on every developer machine.
 *
 * The evaluators are PURE and are exercised with real HTML through the Express
 * extractor - reading source proves the text is there, only calling it proves
 * the value comes out. The routing, the SSRF guard and the columns each host
 * writes are source properties, bound to the construct that carries them,
 * because nothing typechecks the edge tree.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHECKED_LINK_LIMIT,
  evaluateMobileFriendliness,
  evaluatePageImages,
  emptyPageFacts,
  planLinkChecks,
  validateJsonLdBlocks,
} from '@shared/seo-page-facts';
import { extractPageFacts } from '../../services/seo-service';

const ROOT = join(__dirname, '../../..');
const EDGE = join(ROOT, 'supabase/functions/seo/index.ts');
const EXPRESS_ROUTES = join(ROOT, 'server/routes-seo.ts');
const SCHEMA = join(ROOT, 'shared/seo-schema.ts');

function stripComments(src: string): string {
  return src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

const edgeSrc = readFileSync(EDGE, 'utf8');
const edgeCode = stripComments(edgeSrc);
const expressCode = stripComments(readFileSync(EXPRESS_ROUTES, 'utf8'));

/** Bound a branch by the NEXT branch, never by a character count. */
function branch(code: string, marker: string): string {
  const at = code.indexOf(marker);
  expect(at, `branch marker not found: ${marker}`).toBeGreaterThan(-1);
  const next = code.indexOf('if (req.method', at + marker.length);
  return next === -1 ? code.slice(at) : code.slice(at, next);
}

/** The column names one pgTable declaration carries, read as text. */
function columnsOf(table: string): string[] {
  const schema = readFileSync(SCHEMA, 'utf8');
  // The name sits on the line AFTER pgTable( in this file, so match the
  // literal and walk back to the declaration rather than assuming one spelling.
  const nameAt = schema.indexOf(`'${table}',`);
  expect(nameAt, `table not found: ${table}`).toBeGreaterThan(-1);
  const at = schema.lastIndexOf('pgTable', nameAt);
  expect(at, `pgTable for ${table}`).toBeGreaterThan(-1);
  const end = schema.indexOf('\n);', at);
  expect(end).toBeGreaterThan(at);
  const block = schema.slice(at, end);
  return [...block.matchAll(/\b[a-zA-Z]+:\s*\w+\('([a-z_]+)'/g)].map((m) => m[1]);
}

const PAGE = `<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Printyx"},{"@type":"WebSite"}]}</script>
<script type="application/ld+json">{ not json }</script>
</head><body>
<img src="/hero.png?v=2" alt="Hero" width="10" height="10">
<img src="/spacer.webp" alt="" loading="lazy">
<img src="/photo.jpg">
<a href="/internal">Internal</a>
<a href="https://other.example/out" rel="nofollow noopener">Outbound</a>
<a href="#section">Jump</a>
<a href="mailto:sales@printyx.net">Mail</a>
<embed src="/legacy/movie.swf">
</body></html>`;

const facts = extractPageFacts(PAGE);

describe('page facts extraction', () => {
  it('reads attributes and nothing else', () => {
    expect(facts.images).toHaveLength(3);
    expect(facts.links).toHaveLength(4);
    expect(facts.viewport).toContain('width=device-width');
    expect(facts.jsonLdBlocks).toHaveLength(2);
  });

  it('recognises Flash from the source extension, not only the type attribute', () => {
    // <embed src="...swf"> carries no type, which is the commonest shape.
    expect(facts.flashElements).toBe(1);
  });

  it('does not decode entities inside a JSON-LD block', () => {
    // Script content is character data: the HTML parser does not decode
    // entities in it, so reading it through text() would rewrite the
    // customer's own strings - 'Ben &amp; Jerry' would become 'Ben & Jerry'
    // before JSON.parse ever saw it.
    const blocks = extractPageFacts(
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Ben &amp; Jerry"}</script>',
    ).jsonLdBlocks;
    expect(blocks[0]).toContain('&amp;');

    const { schemas } = validateJsonLdBlocks(blocks);
    expect(schemas[0].schemaData.name).toBe('Ben &amp; Jerry');
  });

  it('distinguishes an absent alt attribute from an empty one', () => {
    expect(facts.images[0].alt).toBe('Hero');
    expect(facts.images[1].alt).toBe('');
    expect(facts.images[2].alt).toBeNull();
  });
});

describe('image analysis', () => {
  const { images, unbacked } = evaluatePageImages(facts, 'https://printyx.net/page');

  it('reads the format from the path, not the raw URL', () => {
    // '/hero.png?v=2' used to give a format of 'png?v=2'.
    expect(images[0].format).toBe('png');
    expect(images[0].recommendedFormat).toBe('webp');
    expect(images[1].format).toBe('webp');
    expect(images[1].isOptimized).toBe(true);
  });

  it('treats alt="" as a decorative image rather than a missing alt', () => {
    expect(images[1].isDecorative).toBe(true);
    expect(images[1].issues).not.toContain('Missing alt attribute');
    expect(images[2].isDecorative).toBe(false);
    expect(images[2].issues).toContain('Missing alt attribute');
  });

  it('does not ask the first image to lazy-load', () => {
    // The first image is usually the largest contentful paint, and deferring
    // it is a documented performance mistake.
    expect(images[0].issues).not.toContain('Not using lazy loading');
    expect(images[2].issues).toContain('Not using lazy loading');
  });

  it('claims no file size and says so', () => {
    for (const image of images) {
      expect(image).not.toHaveProperty('potentialSavings');
      expect(image).not.toHaveProperty('fileSizeBytes');
    }
    expect(unbacked.join(' ')).toMatch(/not measured/i);
  });

  it('skips an image with no src and one whose src cannot resolve', () => {
    const odd = emptyPageFacts();
    odd.images = [
      { src: '', alt: null, title: null, width: null, height: null, loading: null },
      { src: 'http://[bad', alt: null, title: null, width: null, height: null, loading: null },
    ];
    expect(evaluatePageImages(odd, 'https://printyx.net/').images).toHaveLength(0);
  });
});

describe('link planning', () => {
  const planned = planLinkChecks(facts, 'https://printyx.net/page');

  it('resolves and classifies, and skips what is not a page request', () => {
    expect(planned.map((l) => l.targetUrl)).toEqual([
      'https://printyx.net/internal',
      'https://other.example/out',
    ]);
    expect(planned[0].linkType).toBe('internal');
    expect(planned[1].linkType).toBe('external');
    expect(planned[1].isNoFollow).toBe(true);
    expect(planned[1].isNoOpener).toBe(true);
  });

  it('spends the budget on links it will actually request', () => {
    // The budget counts PLANNED links, so a page opening with twenty anchors
    // to #sections does not spend the whole allowance on things it skips.
    const many = emptyPageFacts();
    many.links = [
      ...Array.from({ length: 25 }, () => ({ href: '#x', text: 'jump', rel: null })),
      ...Array.from({ length: 3 }, (_, i) => ({ href: `/p${i}`, text: 'p', rel: null })),
    ];
    const budgeted = planLinkChecks(many, 'https://printyx.net/');
    expect(budgeted).toHaveLength(3);
    expect(budgeted.every((l) => l.shouldCheck)).toBe(true);
  });

  it('marks everything past the limit as not to be checked', () => {
    const many = emptyPageFacts();
    many.links = Array.from({ length: CHECKED_LINK_LIMIT + 4 }, (_, i) => ({
      href: `/p${i}`,
      text: 'p',
      rel: null,
    }));
    const budgeted = planLinkChecks(many, 'https://printyx.net/');
    expect(budgeted.filter((l) => l.shouldCheck)).toHaveLength(CHECKED_LINK_LIMIT);
    expect(budgeted.filter((l) => !l.shouldCheck)).toHaveLength(4);
  });
});

describe('mobile friendliness', () => {
  const mobile = evaluateMobileFriendliness(facts);

  it('flags a viewport that prevents zooming', () => {
    expect(mobile.scalesToDevice).toBe(true);
    expect(mobile.blocksZoom).toBe(true);
    expect(mobile.issues).toContain('Viewport prevents the reader from zooming');
  });

  it('returns null rather than a pass for everything a parser cannot settle', () => {
    // The originals answered `hasTouchFriendlyElements: true` and
    // `mobileLoadTime: 0` - a pass and an instant load.
    expect(mobile.hasTouchFriendlyElements).toBeNull();
    expect(mobile.hasReadableText).toBeNull();
    expect(mobile.mobileLoadTime).toBeNull();
    expect(mobile.mobileFcp).toBeNull();
    expect(mobile.mobileLcp).toBeNull();
    expect(mobile.unbacked.length).toBeGreaterThanOrEqual(3);
  });

  it('says which facts the score covers', () => {
    expect(mobile.scoreCovers.length).toBeGreaterThan(0);
    const clean = evaluateMobileFriendliness({
      ...emptyPageFacts(),
      viewport: 'width=device-width, initial-scale=1',
    });
    expect(clean.isMobileFriendly).toBe(true);
    expect(clean.mobileScore).toBe(100);
  });

  it('reports a missing viewport once, not twice', () => {
    const bare = evaluateMobileFriendliness(emptyPageFacts());
    expect(bare.issues).toEqual(['Missing viewport meta tag']);
    expect(bare.hasViewportMeta).toBe(false);
  });
});

describe('structured data', () => {
  const { schemas, unbacked } = validateJsonLdBlocks(facts.jsonLdBlocks);

  it('reads every member of an @graph and gives each the envelope context', () => {
    // An @graph document used to report "Missing @type" on markup that is
    // correct, because only a bare single object was handled.
    const valid = schemas.filter((s) => s.isValid);
    expect(valid.map((s) => s.schemaType)).toEqual(['Organization', 'WebSite']);
    for (const s of valid) expect(s.schemaData['@context']).toBe('https://schema.org');
  });

  it('reports unparseable JSON as invalid rather than dropping it', () => {
    const bad = schemas.find((s) => s.schemaType === 'Invalid');
    expect(bad?.validationErrors?.[0].message).toBe('Invalid JSON syntax');
  });

  it('reads a top-level array of schemas', () => {
    const result = validateJsonLdBlocks([
      '[{"@context":"https://schema.org","@type":"Product"},{"@context":"https://schema.org","@type":"Offer"}]',
    ]);
    expect(result.schemas.map((s) => s.schemaType)).toEqual(['Product', 'Offer']);
  });

  it('takes the first entry of an array @type', () => {
    const result = validateJsonLdBlocks([
      '{"@context":"https://schema.org","@type":["LocalBusiness","Organization"]}',
    ]);
    expect(result.schemas[0].schemaType).toBe('LocalBusiness');
    expect(result.schemas[0].isValid).toBe(true);
  });

  it('names the missing envelope fields', () => {
    const result = validateJsonLdBlocks(['{"name":"nothing"}']);
    expect(result.schemas[0].isValid).toBe(false);
    expect(result.schemas[0].validationErrors?.map((e) => e.property).sort()).toEqual([
      '@context',
      '@type',
    ]);
  });

  it('makes no claim about rich results', () => {
    for (const schema of schemas) expect(schema).not.toHaveProperty('richResultsEligible');
    expect(unbacked.join(' ')).toMatch(/eligibility is not evaluated/i);
  });
});

describe('the edge function serves all four', () => {
  it('routes each one on its own segments', () => {
    expect(edgeCode).toMatch(/resource === 'analyze' && resourceId === 'images'/);
    expect(edgeCode).toMatch(/resource === 'check' && resourceId === 'broken-links'/);
    expect(edgeCode).toMatch(/resource === 'check' && resourceId === 'mobile'/);
    expect(edgeCode).toMatch(/resource === 'validate' && resourceId === 'structured-data'/);
  });

  it('fetches every caller-supplied page through the SSRF guard', () => {
    for (const marker of [
      "resourceId === 'images'",
      "resourceId === 'broken-links'",
      "resourceId === 'mobile'",
      "resourceId === 'structured-data'",
    ]) {
      expect(branch(edgeCode, marker), marker).toMatch(/await loadPage\(/);
    }
    // loadPage is the one place the fetch happens, and it is a safeFetch.
    const helper = edgeCode.slice(edgeCode.indexOf('async function loadPage('));
    const end = helper.indexOf('\nexport default');
    expect(helper.slice(0, end)).toMatch(/await safeFetch\(targetUrl\)/);
  });

  it('probes an outbound link through the SSRF guard too', () => {
    // These URLs come out of a document somebody else controls.
    const links = branch(edgeCode, "resourceId === 'broken-links'");
    expect(links).toMatch(/await safeFetch\(link\.targetUrl, \{ method: 'HEAD' \}\)/);
    expect(links).not.toMatch(/await fetch\(link\.targetUrl/);
  });

  it('decides nothing locally - every verdict comes from the shared module', () => {
    for (const fn of [
      'evaluatePageImages',
      'planLinkChecks',
      'evaluateMobileFriendliness',
      'validateJsonLdBlocks',
    ]) {
      expect(edgeCode).toMatch(new RegExp(`${fn}\\(`));
    }
    expect(edgeSrc).toMatch(/from '\.\.\/\.\.\/\.\.\/shared\/seo-page-facts\.ts'/);
  });

  it('writes one insert per check, not one per row', () => {
    const images = branch(edgeCode, "resourceId === 'images'");
    expect(images).toMatch(/\.insert\(\s*\n?\s*images\.map\(/);
    const links = branch(edgeCode, "resourceId === 'broken-links'");
    expect(links).toMatch(/\.insert\(\s*\n?\s*links\.map\(/);
  });
});

describe('both hosts write real columns and leave the unmeasured ones null', () => {
  const tables = {
    seo_image_analysis: columnsOf('seo_image_analysis'),
    seo_link_analysis: columnsOf('seo_link_analysis'),
    seo_mobile_analysis: columnsOf('seo_mobile_analysis'),
    seo_structured_data: columnsOf('seo_structured_data'),
  };

  it('reads a column list that is not empty', () => {
    for (const [table, cols] of Object.entries(tables)) {
      expect(cols.length, table).toBeGreaterThan(5);
      expect(cols, table).toContain('tenant_id');
    }
  });

  it('names only real columns in every edge insert', () => {
    for (const [table, cols] of Object.entries(tables)) {
      const at = edgeCode.indexOf(`.from('${table}').insert(`);
      const spaced = edgeCode.indexOf(`.from('${table}')\n`);
      const start = at > -1 ? at : spaced;
      expect(start, table).toBeGreaterThan(-1);
      // Bound on the construct that always closes one of these inserts, not on
      // a character count: a window runs into the response object below, whose
      // `unbacked:` key then reads as a phantom column.
      const stop = edgeCode.indexOf('createCorsResponse(', start);
      expect(stop, table).toBeGreaterThan(start);
      const body = edgeCode.slice(start, stop);
      const named = [...body.matchAll(/\n\s+([a-z_]+):/g)].map((m) => m[1]);
      expect(named.length, table).toBeGreaterThan(3);
      for (const key of named) expect(cols, `${table}.${key}`).toContain(key);
    }
  });

  it('leaves every column that needs a rendered page or a byte count unwritten', () => {
    const unmeasured = [
      'potential_savings_bytes',
      'file_size_bytes',
      'has_touch_friendly_elements',
      'has_readable_text',
      'content_fits_viewport',
      'mobile_load_time_ms',
      'mobile_fcp',
      'mobile_lcp',
      'rich_results_eligible',
    ];
    for (const column of unmeasured) {
      expect(edgeCode, `edge writes ${column}`).not.toMatch(new RegExp(`\\n\\s+${column}:`));
    }
    // Express writes the same tables in camelCase.
    for (const column of [
      'potentialSavings',
      'fileSizeBytes',
      'hasTouchFriendlyElements',
      'hasReadableText',
      'contentFitsViewport',
      'mobileLoadTimeMs',
      'mobileFcp',
      'mobileLcp',
      'richResultsEligible',
    ]) {
      expect(expressCode, `express writes ${column}`).not.toMatch(new RegExp(`\\n\\s+${column}:`));
    }
  });

  it('stops spreading the analyser result into drizzle', () => {
    // Drizzle drops a key the table does not have, so a spread stores whatever
    // lines up and discards the rest in silence. Bound to the .values( call:
    // `res.json({ url, ...mobile })` is a RESPONSE and is correct, so a check
    // for the name alone reports the right thing as wrong.
    // Scoped to the four tables this round rewrote. Other handlers in the file
    // spread a Zod-validated payload, which is a different question.
    let checked = 0;
    for (const table of [
      'seoImageAnalysis',
      'seoLinkAnalysis',
      'seoMobileAnalysis',
      'seoStructuredData',
    ]) {
      const at = expressCode.indexOf(`.insert(${table})`);
      expect(at, table).toBeGreaterThan(-1);
      const stop = expressCode.indexOf('.returning()', at);
      expect(stop, `unterminated insert for ${table}`).toBeGreaterThan(at);
      checked++;
      expect(expressCode.slice(at, stop), table).not.toMatch(/\.\.\./);
    }
    expect(checked).toBe(4);
  });
});

describe('the page reads the shape the endpoints send', () => {
  const page = readFileSync(join(ROOT, 'client/src/pages/SEODashboard.tsx'), 'utf8');

  it('reads the envelope and tolerates a bare array', () => {
    // A 200 under key names the page does not read renders as an empty panel
    // and logs nothing, which is how three of these buttons looked broken in
    // a way nobody could file.
    for (const [key, check] of [
      ['images', 'Image analysis'],
      ['links', 'Link analysis'],
      ['schemas', 'Structured-data validation'],
    ] as const) {
      expect(page).toContain(`readList<`);
      expect(page).toContain(`, '${key}')`);
      expect(page).toContain(`noteUnbacked('${check}'`);
    }
    // The fallback is what keeps an older deployment working.
    expect(page).toMatch(/if \(Array\.isArray\(data\)\) return data as T\[\];/);
  });

  it('stops reading three mobile keys the endpoint has never sent', () => {
    // hasViewport, touchElementsSize and textReadability were all undefined on
    // every response, so the panel rendered "No", "Too Small" and "Issues" for
    // every URL - three invented findings on a readiness verdict.
    // Anchored on a non-identifier character: 'mobileResults.hasViewport' is a
    // SUBSTRING of the correct 'mobileResults.hasViewportMeta', so a plain
    // contains check reports the fix as the defect.
    for (const phantom of ['hasViewport', 'touchElementsSize', 'textReadability']) {
      expect(page, phantom).not.toMatch(new RegExp(`mobileResults\\.${phantom}(?![A-Za-z0-9_])`));
    }
    expect(page).toContain('mobileResults.hasViewportMeta');
    expect(page).toContain('mobileResults.scalesToDevice');
    expect(page).toContain('mobileResults.blocksZoom');
  });

  it('renders what a check did not measure', () => {
    expect(page).toContain('Not measured by');
    expect(page).toContain('unbackedNotes.notes.map');
  });
});

describe('a keyword row is not a place to type your own rankings', () => {
  it('accepts only what a caller declares, never what the checker measures', () => {
    // Both handlers spread `...req.body` into drizzle, so currentPosition,
    // bestPosition, impressions, clicks and ctr were writable by the caller -
    // and those are exactly what the rank-tracking panel reports.
    for (const measured of [
      'currentPosition',
      'bestPosition',
      'impressions',
      'clicks',
      'ctr',
      'lastChecked',
    ]) {
      const list = expressCode.slice(
        expressCode.indexOf('KEYWORD_WRITABLE_FIELDS = ['),
        expressCode.indexOf('] as const;'),
      );
      expect(list, measured).not.toContain(measured);
    }
    expect(expressCode).toContain("'keyword',");
    expect(expressCode).toContain("'targetPosition',");
  });

  it('refuses a write that would change nothing', () => {
    for (const table of ['insert(seoKeywords)', 'update(seoKeywords)']) {
      const at = expressCode.indexOf(`.${table}`);
      expect(at, table).toBeGreaterThan(-1);
      // The refusal sits ABOVE the write: one that runs after is not a refusal.
      // Bound to the CONDITION rather than the message - `if (false) {` leaves
      // the 400 in the file and the branch can no longer fire.
      const before = expressCode.slice(Math.max(0, at - 700), at);
      expect(before, table).toMatch(/pickKeywordFields\(req\.body\)/);
      expect(before, table).toMatch(/if \(Object\.keys\(plan\)\.length === 0/);
      expect(before, table).toMatch(/return res\.status\(400\)/);
    }
  });
});

describe('what is still not served, named so it cannot go quiet', () => {
  it('audit and crawl have no edge branch yet', () => {
    // SEODashboard POSTs both. They are much larger than the four above - the
    // audit is a whole-page analysis and the crawl walks a site - so they stay
    // Express-only for now. This assertion FAILS the day one is served, which
    // is the point: the reminder lives where it breaks rather than in a
    // comment that goes stale.
    expect(edgeCode).not.toMatch(/req\.method === 'POST' && resource === 'audit'/);
    expect(edgeCode).not.toMatch(/req\.method === 'POST' && resource === 'crawl'/);

    const page = readFileSync(join(ROOT, 'client/src/pages/SEODashboard.tsx'), 'utf8');
    expect(page).toContain("apiRequest('/api/seo/audit', 'POST'");
    expect(page).toContain("apiRequest('/api/seo/crawl', 'POST'");
  });

  it('is not papered over with a proxy entry', () => {
    // Express serves far more under /api/seo than the edge function does
    // (keyword CRUD, alert acknowledgement, content optimisation), so a bare
    // '/api/seo' crmProxies entry would take all of those from working-in-dev
    // to 404-in-dev.
    const proxy = readFileSync(join(ROOT, 'server/middleware/edge-function-proxy.ts'), 'utf8');
    expect(proxy).not.toMatch(/'\/api\/seo'\s*:/);
  });
});
