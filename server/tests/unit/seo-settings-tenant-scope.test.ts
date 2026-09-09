/**
 * SEO settings must be read and written per tenant (iteration 6).
 *
 * server/routes-seo-core.ts used to do `db.select().from(seoSettings).limit(1)`
 * with no where clause in BOTH the GET and the upsert, and then key the update on
 * whatever row came back - so a platform admin saving settings overwrote some
 * other tenant's row, and the GET answered with that same arbitrary row to any
 * caller, with no auth check at all. Both handlers are shadowed copies that WIN
 * over routes-seo.ts's correctly scoped pair by mount order (routes-registry:353
 * vs :745), so the correct implementation never ran.
 *
 * This asserts the source, because the failure is a missing WHERE clause: drizzle
 * builds a valid query either way, tsc sees nothing, and no fixture reproduces a
 * second tenant without a live database.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(process.cwd(), 'server/routes-seo-core.ts'), 'utf8');

/** Strip comments: this file's own explanation names the defect it removed. */
function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

const CODE = stripComments(SOURCE);

describe('seo settings handlers are tenant scoped', () => {
  it('never selects seo_settings without a where clause in the /api/seo handlers', () => {
    // Six unfiltered reads remain and each is SEO-PAGES-001's, not this fix's: the
    // five PUBLIC handlers (/sitemap.xml, /robots.txt, /meta.json, /llms.txt,
    // /schema.json), which carry no tenant on the request at all, plus the boot
    // seeder - whose insert omits tenant_id, a NOT NULL column, so it has never
    // succeeded. Which tenant owns the marketing site is a decision, not a WHERE
    // clause. This asserts the number does not GROW.
    const unfiltered =
      CODE.match(/db\s*\.?\s*select\(\)\s*\.from\(seoSettings\)\s*\.limit\(1\)/g) ?? [];
    expect(unfiltered.length).toBeLessThanOrEqual(6);
  });

  it('reads seo_settings filtered by the caller tenant', () => {
    expect(CODE).toMatch(/\.where\(eq\(seoSettings\.tenantId,\s*tenantId\)\)/);
  });

  it('requires a tenant on both the read and the write', () => {
    const guards = CODE.match(/Tenant ID is required/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });

  it('stamps tenantId onto the row it inserts and updates', () => {
    expect(CODE).toMatch(/\.set\(\{[^}]*tenantId,/);
    expect(CODE).toMatch(/\.values\(\{[^}]*tenantId[^}]*\}/);
  });

  it('serves the settings write on PUT as well as POST, matching the edge function', () => {
    expect(CODE).toMatch(/app\.put\('\/api\/seo\/settings'/);
    expect(CODE).toMatch(/app\.post\('\/api\/seo\/settings'/);
  });
});
