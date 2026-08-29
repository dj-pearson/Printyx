/**
 * The supply dashboard reports a lead time it has never measured.
 *
 * /auto-supply-replenishment/dashboard read supply_replenishment_analytics for
 * projected savings, emergencies prevented and average lead time - a table
 * NOTHING WRITES (AUDIT-028: no insert against it exists anywhere in the tree).
 * The row is therefore always absent, and the handler had ported Express's
 * default: `toNumber(analytics?.average_lead_time) || 3.0`. So the routed page
 * at /auto-supply-replenishment has reported a 3.0-day average lead time,
 * permanently, without ever measuring one. The page then did the same thing to
 * the other two, turning null into `$0.00` and `0 emergencies prevented`.
 *
 * A zero here is not a smaller version of the truth. "We saved $0.00" is a
 * claim; "not measured" is the fact.
 *
 * The producer gap itself is not fixed here and is not fixable in this file:
 * supply_monitoring has no producer either, so /analyze-all iterates zero rows
 * and the whole feature is inert. That is AUDIT-028's triage.
 *
 * Comments are stripped before matching.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const edge = read('supabase/functions/auto-supply-replenishment/index.ts');
const page = read('client/src/pages/AutoSupplyReplenishmentDashboard.tsx');

describe('supply dashboard metrics', () => {
  it('no longer defaults the lead time to three days', () => {
    expect(edge).not.toMatch(/average_lead_time\)\s*\|\|\s*3/);
    expect(edge).not.toContain('3.0;');
  });

  it('returns null for all three analytics fields when no period is summarised', () => {
    for (const field of ['projectedSavings', 'emergenciesPrevented', 'averageLeadTime']) {
      // \s* between the field and the ternary: prettier wraps the longer ones
      // onto the next line, and an assertion that only matched the one-line
      // form passed until the formatter ran and then failed for a reason that
      // had nothing to do with the code.
      expect(edge).toMatch(new RegExp(`${field}:\\s*hasAnalytics\\s*\\?`));
    }
    expect(edge).toMatch(/unbacked: hasAnalytics/);
  });

  it('still counts what it really can count', () => {
    // The four counts come from tables the handler genuinely reads; only the
    // analytics-derived trio was ever unbacked.
    for (const field of ['devicesMonitored', 'suppliesTracked', 'lowSupplies', 'ordersThisMonth']) {
      expect(edge).toContain(field);
    }
  });
});

describe('the page that renders them', () => {
  it('shows a dash rather than a zero it cannot support', () => {
    expect(page).not.toMatch(/projectedSavings\?\.toFixed\(2\) \|\| '0\.00'/);
    expect(page).not.toMatch(/averageLeadTime\?\.toFixed\(1\) \|\| '0'/);
    expect(page).toMatch(/typeof metrics\?\.averageLeadTime === 'number'/);
    expect(page).toMatch(/typeof metrics\?\.projectedSavings === 'number'/);
  });

  it('types the three fields as nullable, so the next reader cannot forget', () => {
    expect(page).toMatch(/projectedSavings\?: number \| null;/);
    expect(page).toMatch(/averageLeadTime\?: number \| null;/);
  });
});
