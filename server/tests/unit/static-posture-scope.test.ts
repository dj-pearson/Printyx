/**
 * The static-posture guard only watched one directory (PA-040).
 *
 * check:no-static-posture catches a page whose values are typed into the JSX
 * rather than read from data - the shape AUDIT-019 found on SystemSecurity,
 * which asserted a TLS certificate valid until a date eight months in the past
 * and still rendered green. Its scope was client/src/pages/admin plus four
 * named files, set to the surface that story was cleaning.
 *
 * PA-040 named nine MORE pages elsewhere that render mock constants and make no
 * API call at all, and picking them off by name is how the next one gets
 * missed. Widening to the whole page tree found 58 values across 16 pages.
 *
 * MARKETING IS EXCLUDED BY RULE, not baselined. client/src/pages/marketing/* is
 * public copy - "52 integrations", "24/7" - written to be read as a claim about
 * the product, not rendered as a measurement of a tenant's data. A baseline
 * holding known non-defects is where a real one hides, and every future
 * marketing page would need adding by hand.
 *
 * Comments are stripped by the guard itself, which matters here: the note left
 * where the Quality Metrics card stood names all four percentages it removed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const guard = read('scripts/check-no-static-posture.mjs');
const baseline = JSON.parse(read('docs/static-posture-baseline.json'));

describe('scope', () => {
  it('watches the whole page tree, not one directory', () => {
    expect(guard).toContain("const DIRS = ['client/src/pages']");
  });

  it('excludes marketing copy by rule rather than by baseline', () => {
    expect(guard).toMatch(/const EXCLUDED = .*pages\\\/marketing/);
    const offenders: string[] = baseline.offenders;
    expect(offenders.some((o) => o.includes('pages/marketing/'))).toBe(false);
  });

  it('leaves components alone, where props legitimately carry the values', () => {
    expect(guard).not.toContain("'client/src/components'");
  });

  it('passes by exit code', () => {
    execFileSync('node', [join(repo, 'scripts/check-no-static-posture.mjs')], { cwd: repo });
  });
});

describe('the baseline', () => {
  it('is keyed by text, not by line, so moving code does not churn it', () => {
    expect(guard).toContain('const key = (p) => `${p.rel}  ${p.text}`');
  });

  it('records what it inherited and nothing from the original scope', () => {
    const offenders: string[] = baseline.offenders;
    expect(offenders.length).toBeGreaterThan(0);
    // The directory the guard already policed at zero must not reappear.
    expect(offenders.some((o) => o.startsWith('client/src/pages/admin/'))).toBe(false);
  });
});

describe('the audit-readiness card is gone, and so is the page', () => {
  // This block used to assert that BusinessProcessOptimization.tsx still
  // existed with its Quality Metrics card removed and a note in its place -
  // four typed percentages ending in Audit Readiness 96.1%, deleted under
  // LEGAL-010 because nothing in this platform measures audit readiness.
  //
  // PROD-010 then deleted the whole page. Its dashboard came from an Express
  // handler with zero database calls, and the domain had sat on the
  // route-ownership ratchet's missingEdge list for weeks precisely because
  // porting a mock to production was refused - correctly, but a refusal is not
  // a resolution. Removing one fabricated card from a page whose every other
  // number was equally fabricated was the smaller half of the fix.
  it('the page no longer exists', () => {
    expect(existsSync(join(repo, 'client/src/pages/BusinessProcessOptimization.tsx'))).toBe(false);
  });

  it('does not appear in the baseline at all', () => {
    const offenders: string[] = baseline.offenders;
    expect(offenders.some((o) => o.includes('BusinessProcessOptimization'))).toBe(false);
  });
});

describe('the guard is wired', () => {
  it('is a package script and a CI step', () => {
    expect(read('package.json')).toContain('check:no-static-posture');
    expect(read('.github/workflows/ci.yml')).toContain('check:no-static-posture');
    expect(existsSync(join(repo, 'docs/static-posture-baseline.json'))).toBe(true);
  });
});
