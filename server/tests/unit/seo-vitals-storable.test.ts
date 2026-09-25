/**
 * Round 247: POST /api/seo/check/core-web-vitals spread the PageSpeed result
 * into seo_core_web_vitals. Lighthouse reports milliseconds with a fraction
 * almost every time and lcp/fid/fcp/ttfb/tti/tbt are INTEGER columns, so the
 * insert failed on nearly every real measurement. The edge function rounded
 * inline; both hosts now use one mapping.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { storableVitals, type CoreWebVitals } from '../../../shared/seo-checks';
import { seoCoreWebVitals } from '../../../shared/seo-schema';

const vitals: CoreWebVitals = {
  lcp: 2512.4,
  fid: 16.6,
  cls: 0.0423,
  fcp: 812.5,
  ttfb: 101.2,
  tti: 3001.7,
  tbt: 0,
  si: 1542.33,
  performanceScore: 87,
  accessibilityScore: null,
  bestPracticesScore: 100,
  seoScore: 92,
  unbacked: [],
};

describe('storableVitals', () => {
  const row = storableVitals(vitals);

  it('rounds every value bound for an integer column and keeps decimals', () => {
    const integerCols = getTableConfig(seoCoreWebVitals)
      .columns.filter((c) => c.getSQLType() === 'integer')
      .map((c) => c.name.replace(/_([a-z])/g, (_, x) => x.toUpperCase()));
    expect(integerCols).toContain('lcp');
    for (const [k, v] of Object.entries(row)) {
      if (integerCols.includes(k) && v !== null) expect(Number.isInteger(v), k).toBe(true);
    }
    expect(row.lcp).toBe(2512);
    expect(row.cls).toBe(0.0423);
    expect(row.si).toBe(1542.33);
  });

  it('keeps a missing measurement null and a real zero zero', () => {
    expect(row.accessibilityScore).toBeNull();
    expect(row.tbt).toBe(0);
  });
});

describe('both hosts store through it', () => {
  const strip = (s: string) => s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  it('the Express route no longer spreads the raw result', () => {
    const src = strip(readFileSync('server/routes-seo.ts', 'utf8'));
    const insert = src.slice(
      src.indexOf('.insert(seoCoreWebVitals)'),
      src.indexOf('.returning()', src.indexOf('.insert(seoCoreWebVitals)')),
    );
    expect(insert).toMatch(/storableVitals\(vitals\)/);
    expect(insert).not.toMatch(/\.\.\.vitals\b/);
  });
  it('the edge function uses the same mapping', () => {
    const src = strip(readFileSync('supabase/functions/seo/index.ts', 'utf8'));
    expect(src).toMatch(/const row = storableVitals\(vitals\);/);
    expect(src).not.toMatch(/Math\.round\(vitals\.lcp\)/);
  });
});
