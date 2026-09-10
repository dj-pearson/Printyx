/**
 * The static <head> is the only SEO surface a non-JS crawler or a social
 * scraper ever sees, and it made four claims that were not true (SEO-002).
 *
 * 1. A hardcoded aggregateRating of 4.9 from 150 ratings. LEGAL-002 removed the
 *    same fabrication from the runtime provider and missed this copy - the one
 *    that ships without executing JS. Printyx has no reviews to count.
 * 2. og:image and twitter:image pointed at /og-image.png and
 *    /twitter-image.png. Neither file existed, so every shared link rendered
 *    blank. One generated 1200x630 card now serves both.
 * 3. The Organization JSON-LD logo pointed at /logo.png (404; the asset is at
 *    /logos/logo.png) and declared it 512x512 when it is 2000x600.
 * 4. WebSite.potentialAction offered a sitelinks search box at /search, which
 *    is not a registered route.
 *
 * Plus: favicon.svg used React's `stopColor` rather than SVG's `stop-color`,
 * so both gradients fell back to black and the mark rendered as a black blob
 * in every browser tab and search result. Verified by rendering it in Chromium
 * before and after: rgba(0,0,0,255) -> rgba(67,100,237,255).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const html = readFileSync(join(root, 'client/index.html'), 'utf8');
const favicon = readFileSync(join(root, 'client/public/favicon.svg'), 'utf8');
/** This test's own prose names what was removed; strip comments before asserting absence. */
const headNoComments = html.replace(/<!--[\s\S]*?-->/g, '');

function jsonLdBlocks(): Record<string, any>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  );
}

describe('static <head> structured data', () => {
  it('every JSON-LD block parses and is typed', () => {
    const blocks = jsonLdBlocks();
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    for (const block of blocks) {
      expect(block['@context']).toBe('https://schema.org');
      expect(typeof block['@type']).toBe('string');
    }
  });

  it('emits no aggregateRating', () => {
    expect(headNoComments).not.toContain('aggregateRating');
    expect(headNoComments).not.toContain('ratingValue');
  });

  it('offers no sitelinks SearchAction, because /search is not a route', () => {
    expect(headNoComments).not.toContain('SearchAction');
  });

  it('declares the Organization logo at its real path and real size', () => {
    const org = jsonLdBlocks().find((b) => b['@type'] === 'Organization');
    expect(org).toBeDefined();
    const url: string = org!.logo.url;
    const path = url.replace('https://printyx.net', '');
    expect(existsSync(join(root, 'client/public', path))).toBe(true);
    const png = readFileSync(join(root, 'client/public', path));
    expect(org!.logo.width).toBe(png.readUInt32BE(16));
    expect(org!.logo.height).toBe(png.readUInt32BE(20));
  });
});

describe('social card', () => {
  it('og:image and twitter:image both resolve to a real file', () => {
    // og: uses `property`, twitter: uses `name`. That split is the spec, and
    // the head disagreeing with SEOProvider about it is SEO-003 below.
    const refs = [
      ...html.matchAll(/(?:property|name)="(?:og|twitter):image" content="([^"]+)"/g),
    ].map((m) => m[1]);
    expect(refs.length).toBe(2);
    for (const ref of refs) {
      const path = ref.replace('https://printyx.net', '');
      expect(existsSync(join(root, 'client/public', path)), `${ref} is missing`).toBe(true);
    }
  });

  it('is 1200x630, the frame summary_large_image and Open Graph both take', () => {
    const png = readFileSync(join(root, 'client/public/og-image.png'));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});

describe('favicon', () => {
  it('uses the SVG attribute, not the React prop', () => {
    expect(favicon).not.toContain('stopColor');
    expect(favicon.match(/stop-color=/g)?.length).toBe(4);
  });
});

describe('the static head and SEOProvider do not fight (SEO-003)', () => {
  /**
   * Every page shipped two twitter:title, two twitter:description and two
   * twitter:image tags. index.html wrote them as `property=` (not what the
   * Twitter Cards spec says) while SEOProvider's setMeta defaults to `name=`,
   * so getOrCreateMeta's `meta[name="twitter:title"]` query never matched the
   * static tag and appended a second one carrying the homepage's copy. Both
   * tags are valid HTML and tsc cannot see a querySelector string, so nothing
   * reported it until the built page was rendered in Chromium.
   */
  const provider = readFileSync(join(root, 'client/src/lib/seo/SEOProvider.tsx'), 'utf8');

  it('agrees on name-vs-property for every meta tag both write', () => {
    const providerAttr = new Map<string, 'name' | 'property'>();
    for (const m of provider.matchAll(/setMeta\(\s*'([^']+)'\s*,[^;]*?\)\s*;/g)) {
      providerAttr.set(m[1], /,\s*true\s*\)\s*;$/.test(m[0]) ? 'property' : 'name');
    }
    expect(providerAttr.size).toBeGreaterThan(5);

    const mismatches: string[] = [];
    for (const m of html.matchAll(/<meta\s+((?:name|property)="[^"]+")/g)) {
      const [attr, key] = m[1].replace(/"/g, '').split('=');
      const want = providerAttr.get(key);
      if (want && want !== attr) mismatches.push(`${key}: head=${attr} provider=${want}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('does not re-inject Organization or WebSite, which are already static', () => {
    // Both are page-independent entities carried in index.html with stable @ids.
    const providerNoComments = provider.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(providerNoComments).not.toContain('generateOrganizationSchema(');
    expect(providerNoComments).not.toContain('generateWebSiteSchema(');
  });

  it('stamps no article:modified_time from the clock', () => {
    // It was `new Date()` per render: every page claimed it was updated on the
    // day it happened to be viewed, for content that had not changed.
    const providerNoComments = provider.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(providerNoComments).not.toContain('article:modified_time');
  });

  it('publishes no telephone or priceRange it cannot back', () => {
    const config = readFileSync(join(root, 'client/src/lib/seo/seoConfig.ts'), 'utf8');
    const configNoComments = config.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // '+1-800-PRINTYX' is not a dialable number and appears nowhere on the site.
    expect(configNoComments).not.toContain('PRINTYX');
    expect(configNoComments).not.toContain('telephone');
    const providerNoComments = provider.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(providerNoComments).not.toContain('priceRange');
  });
});

describe('published prices match the plans that are sold (SEO-007)', () => {
  /**
   * llms.txt advertised "Starter: $49/user/month" and "Professional:
   * $79/user/month" with Enterprise as custom-priced, against real Stripe
   * products at a flat $79, $99 and $149 with a user cap. Wrong amounts, wrong
   * unit, wrong that Enterprise has no list price. index.html's offer had the
   * right number with the wrong unit - "per user per month" is what a rich
   * result would have shown, and is not what anyone is charged.
   *
   * shared/pricing-plans.ts is the one source now: scripts/setup-stripe-products.ts
   * builds the Stripe products from it and scripts/generate-llms-txt.mts
   * publishes it.
   */
  const plans = readFileSync(join(root, 'shared/pricing-plans.ts'), 'utf8');
  const llms = readFileSync(join(root, 'client/public/llms.txt'), 'utf8');
  const stripeScript = readFileSync(join(root, 'scripts/setup-stripe-products.ts'), 'utf8');
  const monthly = [...plans.matchAll(/monthlyPrice:\s*(\d+)/g)].map((m) => Number(m[1]));

  it('has three plans with real monthly prices', () => {
    expect(monthly).toEqual([7900, 9900, 14900]);
  });

  it('the Stripe setup script builds its plans from that module', () => {
    expect(stripeScript).toContain("from '../shared/pricing-plans'");
    expect(stripeScript).toContain('PRICING_PLANS.map');
    // The literals it used to carry are gone, so there is nothing to drift.
    expect(stripeScript).not.toContain("name: 'Printyx Starter'");
  });

  it('llms.txt publishes every plan and no per-seat price', () => {
    for (const cents of monthly) {
      expect(llms).toContain(`$${cents / 100}/month`);
    }
    expect(llms).not.toMatch(/per user|\/user\//i);
    expect(llms).not.toContain('Custom pricing');
  });

  it('the head offer is the cheapest plan, priced per month', () => {
    const offer = html.match(
      /"@type": "UnitPriceSpecification"[\s\S]*?"price": "(\d+)"[\s\S]*?"unitText": "([^"]+)"/,
    );
    expect(offer).not.toBeNull();
    expect(Number(offer![1])).toBe(Math.min(...monthly) / 100);
    expect(offer![2]).toBe('per month');
  });

  it('llms.txt makes no claim nothing measures', () => {
    for (const claim of ['40%', '2-3 year', '30+ years', 'no credit card']) {
      expect(llms, `"${claim}" is not a measurement anything takes`).not.toContain(claim);
    }
  });

  it('says the site is closed rather than listing pages that are not live', () => {
    expect(llms).toContain('not open yet');
    // Every marketing URL serves the holding page while COMING_SOON is on.
    for (const closed of ['/pricing', '/blog', '/case-studies', '/roi-calculator']) {
      expect(llms).not.toContain(`https://printyx.net${closed})`);
    }
  });
});

describe('the site names itself in one place (SEO-011)', () => {
  /**
   * SEO-009's root cause was a component hardcoding a hostname. Sweeping for
   * the rest of that class found four dead same-origin asset URLs that
   * check:seo-assets could not see, because it only read index.html and
   * seoConfig:
   *
   *   Homepage         og:image at /og-image-homepage.jpg, a file that has
   *                    never existed - on the most-shared URL of the site
   *   Homepage         Organization logoUrl at /logo.png (the asset is at
   *                    /logos/logo.png)
   *   schemaMarkup     the same dead /logo.png, a third copy that survived
   *                    SEO-002 correcting the other two
   *   BlogSettings     a placeholder teaching an admin that same dead path
   *
   * The homepage also advertised price 'Contact for pricing' for a product with
   * a published price list (SEO-007).
   */
  const homepage = readFileSync(join(root, 'client/src/pages/marketing/Homepage.tsx'), 'utf8');
  const schemaMarkup = readFileSync(join(root, 'client/src/lib/schemaMarkup.ts'), 'utf8');
  const strip = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('the homepage derives its URL, image, logo and price rather than typing them', () => {
    const code = strip(homepage);
    expect(code).toContain('ogImage: DEFAULT_OG_IMAGE');
    expect(code).toContain('canonicalUrl: SITE_URL');
    expect(code).toContain('logoUrl: ORGANIZATION_DATA.logo');
    expect(code).toContain('ENTRY_MONTHLY_PRICE_USD');
    expect(code).not.toContain('Contact for pricing');
    expect(code).not.toContain('og-image-homepage');
  });

  it('schemaMarkup takes the publisher logo from ORGANIZATION_DATA', () => {
    const code = strip(schemaMarkup);
    expect(code).toContain('url: ORGANIZATION_DATA.logo');
    expect(code).not.toContain("'https://printyx.net/logo.png'");
  });

  it('the SEO crawler identifies itself on the domain it belongs to', () => {
    // The User-Agent said +https://printyx.com/seo - wrong domain, and a path
    // that does not exist on either. It is what other sites see in their logs.
    const service = readFileSync(join(root, 'server/services/seo-service.ts'), 'utf8');
    expect(service).toContain('PrintyxSEOBot');
    expect(service).not.toContain('printyx.com/seo');
  });

  it('check:seo-assets walks the whole client, not two files', () => {
    const guard = readFileSync(join(root, 'scripts/check-seo-assets.mjs'), 'utf8');
    expect(guard).toContain("resolve(ROOT, 'client/src')");
    // A naive line-comment strip eats every line containing https:// and makes
    // the check silently match nothing. It passed like that until a mutation
    // test caught it.
    expect(guard).toContain('(^|[^:])\\/\\/.*$');
  });
});
