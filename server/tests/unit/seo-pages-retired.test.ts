/**
 * `seo_pages` does not exist, and the decision is that it should not
 * (SEO-PAGES-001).
 *
 * server/routes-seo-core.ts used to load it through `require('@shared/schema')`
 * inside a try/catch that logged "SEO pages schema not available" and carried
 * on. The identifier was undefined, so five handlers threw a TypeError into
 * their own catch: GET and POST /api/seo/pages answered 500, and /meta.json and
 * /schema.json served a generic Printyx document for every path. The try/catch
 * is what made a boot failure survivable and therefore invisible.
 *
 * These assertions read the files with comments STRIPPED, because the prose
 * explaining the removal names every identifier being asserted gone - the trap
 * that has fired three times in this repo already.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const raw = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  raw(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('the schema is not loaded through a swallowed require', () => {
  const core = code('server/routes-seo-core.ts');

  it('no runtime require of @shared/schema', () => {
    expect(core).not.toContain("require('@shared/schema')");
    expect(core).not.toMatch(/let\s+seoPages/);
    expect(core).not.toMatch(/let\s+insertSeoPageSchema/);
  });

  it('nothing reads a seoPages column', () => {
    expect(core).not.toContain('seoPages');
    expect(core).not.toContain('insertSeoPageSchema');
  });

  it('the five handlers are gone', () => {
    for (const path of ["'/api/seo/pages'", "'/meta.json'", "'/schema.json'"]) {
      expect(core).not.toContain(path);
    }
  });

  it('but the four static artifacts are still served', () => {
    for (const path of [
      "'/sitemap.xml'",
      "'/robots.txt'",
      "'/llms.txt'",
      "'/.well-known/llms.txt'",
    ]) {
      expect(core).toContain(path);
    }
    expect(core).toContain('publicFile(');
  });

  it('and so is the settings pair, on both methods', () => {
    expect(core).toContain("app.put('/api/seo/settings'");
    expect(core).toContain("app.post('/api/seo/settings'");
    expect(core).toContain("app.get('/api/seo/settings'");
  });
});

describe('the boot seed is gone too', () => {
  const core = code('server/routes-seo-core.ts');

  it('nothing inserts seo_settings on boot', () => {
    // Its other half could not work either: it omitted tenant_id, which is
    // NOT NULL on seo_settings, so the whole IIFE died in its catch every boot.
    expect(core).not.toContain('db.insert(seoSettings)');
    expect(core).not.toContain('corePages');
  });

  it('so no login-walled route is seeded as public metadata', () => {
    for (const path of ['/product-hub', '/service-hub', '/product-catalog', '/knowledge-base']) {
      expect(core).not.toContain(`path: '${path}'`);
    }
  });
});

describe('seo_pages is declared nowhere, which is the point', () => {
  it('no pgTable and no migration', () => {
    const schema = raw('shared/seo-schema.ts');
    expect(schema).not.toContain("pgTable(\n  'seo_pages'");
    expect(schema).not.toContain("'seo_pages'");
  });

  it("the seo edge function's /pages branch is a different resource entirely", () => {
    // This is why repairing the Express side would not have helped: /api/seo is
    // not proxied, so production sends /api/seo/pages to this function, whose
    // `pages` branch reads analysis SCORES and answers { data, total }.
    const fn = raw('supabase/functions/seo/index.ts');
    const branch = fn.slice(fn.indexOf("resource === 'pages'"));
    expect(branch).toContain("from('seo_page_scores')");
    expect(fn).not.toContain("from('seo_pages')");
  });
});

describe('the admin screen no longer edits values nothing renders', () => {
  const page = code('client/src/pages/RootAdminSEO.tsx');

  it('the SEO Pages card and its endpoint are gone', () => {
    expect(page).not.toContain('/api/seo/pages');
    expect(page).not.toContain('pagesSorted');
    expect(page).not.toContain('presetOptions');
  });

  it('the per-row meta.json and schema.json links are gone', () => {
    expect(page).not.toContain('meta.json');
    expect(page).not.toContain('schema.json');
  });

  it('settings and the three artifact links remain', () => {
    expect(page).toContain("'/api/seo/settings'");
    expect(page).toContain('/sitemap.xml');
    expect(page).toContain('/robots.txt');
    expect(page).toContain('/llms.txt');
  });
});

describe('the route table is the one source it defers to', () => {
  it('PUBLIC_ROUTES_SEO still carries per-path title and description', () => {
    const cfg = raw('client/src/lib/seo/seoConfig.ts');
    expect(cfg).toContain('PUBLIC_ROUTES_SEO');
    expect(cfg).toMatch(/title:/);
    expect(cfg).toMatch(/description:/);
  });
});
