// Round 168 (route-divergence: subscriptions). GET /subscriptions/plans on the
// edge function answered raw snake_case rows while Pricing.tsx reads the
// camelCase keys Drizzle gives Express, so production priced every plan at
// $NaN, never marked one Most Popular and left the limits blank.
//
// The expected keys are DERIVED: every `plan.<key>` / `feature.<key>` the page
// reads must come out of camelising a real column of the table, and the edge
// branch must actually camelise both lists.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { toCamelShallow } from '../../../supabase/functions/_shared/case';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const SCHEMA = readFileSync('shared/schema-subscriptions.ts', 'utf8');
const PAGE = strip(readFileSync('client/src/pages/Pricing.tsx', 'utf8'));
const EDGE = strip(readFileSync('supabase/functions/subscriptions/index.ts', 'utf8'));

function columnsOf(table: string): string[] {
  const start = SCHEMA.indexOf(`pgTable('${table}'`);
  expect(start).toBeGreaterThan(0);
  const end = SCHEMA.indexOf('\n});', start);
  const body = SCHEMA.slice(start, end);
  return [...body.matchAll(/^\s+\w+:\s*\w+\('([a-z_0-9]+)'/gm)].map((m) => m[1]);
}

function camelKeys(table: string): Set<string> {
  const row: Record<string, unknown> = {};
  for (const c of columnsOf(table)) row[c] = 1;
  return new Set(Object.keys(toCamelShallow(row)));
}

describe('subscription plans response shape', () => {
  const planKeys = camelKeys('subscription_plans');
  const featureKeys = camelKeys('subscription_features');

  it('reads the table declarations (floor)', () => {
    expect(planKeys.size).toBeGreaterThanOrEqual(20);
    expect(featureKeys.size).toBeGreaterThanOrEqual(4);
    // A snake column must not survive camelising, or the check below is vacuous.
    expect(planKeys.has('monthly_price')).toBe(false);
    expect(planKeys.has('monthlyPrice')).toBe(true);
  });

  it('every plan field Pricing.tsx reads is a camelised column', () => {
    const read = new Set([...PAGE.matchAll(/\bplan\.([a-zA-Z]+)/g)].map((m) => m[1]));
    expect(read.size).toBeGreaterThanOrEqual(8);
    expect([...read].filter((k) => !planKeys.has(k))).toEqual([]);
  });

  it('every feature field Pricing.tsx reads is a camelised column', () => {
    const read = new Set([...PAGE.matchAll(/\bfeature\.([a-zA-Z]+)/g)].map((m) => m[1]));
    expect(read.size).toBeGreaterThanOrEqual(3);
    expect([...read].filter((k) => !featureKeys.has(k))).toEqual([]);
  });

  it('the edge branch camelises both lists it returns', () => {
    const at = EDGE.indexOf("secondSegment === 'plans'");
    expect(at).toBeGreaterThan(0);
    const branch = EDGE.slice(at, EDGE.indexOf("secondSegment === 'stripe'", at));
    expect(branch).toMatch(/plans:\s*\(plans \|\| \[\]\)\.map\(\(p\) => toCamelShallow\(p\)\)/);
    expect(branch).toMatch(
      /features:\s*\(features \|\| \[\]\)\.map\(\(f\) => toCamelShallow\(f\)\)/,
    );
    expect(branch).not.toMatch(/plans:\s*plans \|\| \[\]/);
  });
});
