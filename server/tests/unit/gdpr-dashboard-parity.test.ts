/**
 * The GDPR compliance dashboard on the deployed host (QUALITY-002).
 *
 * `/api/gdpr` is not in crmProxies, so dev runs Express and production runs
 * supabase/functions/gdpr. The page issues four queries through ONE QueryStates
 * wrapper, which means any single failure paints "Could not load compliance
 * data" over the whole screen - and two of the four had no branch in the edge
 * function at all. The dashboard was therefore an error state in production and
 * correct on every developer machine, which is why nobody reported it.
 *
 * A third defect was quieter: the Active DPAs card reads `expiringIn30Days`
 * under a label saying "expiring in 30 days", and the endpoint sent
 * `expiringIn` computed over NINETY days. The key the page wanted was never
 * sent, so that figure was permanently 0.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** This file's own header names every path and key it asserts about. */
function stripComments(src: string): string {
  return src.replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
}

const fn = stripComments(read('supabase/functions/gdpr/index.ts'));
const page = stripComments(read('client/src/pages/GdprComplianceDashboard.tsx'));

describe('every path the dashboard calls has an edge branch', () => {
  it('routes all four two-segment stats paths', () => {
    for (const [endpoint, sub] of [
      ['consent', 'stats'],
      ['dpa', 'stats'],
      ['deduplication', 'stats'],
      ['data-export', 'requests'],
    ]) {
      expect(fn).toContain(`endpoint === '${endpoint}' && requestId === '${sub}'`);
    }
  });

  it('the cookie banner POST is still routed', () => {
    expect(fn).toContain("endpoint === 'consent'");
    expect(fn).toContain("req.method === 'POST'");
  });

  /**
   * Derived from the page rather than hand-listed, so a new call site cannot
   * be added without either an edge branch or a failing test.
   */
  it('no /api/gdpr call in the page is left unrouted', () => {
    const called = [...page.matchAll(/'\/api\/gdpr\/([a-z-]+)(?:\/([a-z-]+))?/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(called.length).toBeGreaterThan(0);
    for (const [endpoint, sub] of called) {
      const routed = sub
        ? fn.includes(`endpoint === '${endpoint}' && requestId === '${sub}'`)
        : fn.includes(`endpoint === '${endpoint}'`);
      expect(routed, `${endpoint}${sub ? '/' + sub : ''} is not routed`).toBe(true);
    }
  });
});

describe('the keys the cards read are the keys the endpoint sends', () => {
  it('consent stats answers all four', () => {
    const branch = fn.slice(fn.indexOf("endpoint === 'consent' && requestId === 'stats'"));
    for (const key of ['totalRecords', 'byStatus', 'byType', 'recentWithdrawals']) {
      expect(branch.slice(0, 2600)).toContain(key);
    }
  });

  it('the DPA card gets the 30-day figure it is labelled with', () => {
    expect(page).toContain('expiringIn30Days');
    /**
     * Anchored to the RESPONSE object, not to the file. The first version
     * asserted `fn.toContain('expiringIn30Days')` and a mutant that renamed the
     * key back to `expiringIn` on the way out SURVIVED it, because the local
     * `const expiringIn30Days` still carried the string. What the page receives
     * is the property, so that is what gets read.
     */
    const branch = fn.slice(fn.indexOf("endpoint === 'dpa' && requestId === 'stats'"));
    const payload = branch.slice(branch.indexOf('totalDpas:'), branch.indexOf('200,'));
    expect(payload).toContain('expiringIn30Days,');
    // The 90-day renewal horizon is still sent, under its own name.
    expect(payload).toContain('expiringIn90Days,');
    expect(payload).not.toMatch(/\bexpiringIn:/);
  });

  it('export rows go out camelised, because the page reads them that way', () => {
    expect(page).toContain('exp.exportNumber');
    const branch = fn.slice(fn.indexOf("endpoint === 'data-export' && requestId === 'requests'"));
    expect(branch.slice(0, 1600)).toContain('.map(toCamel)');
    expect(fn).toContain('function toCamel');
  });
});

describe('the compliance score is gone', () => {
  it('no typed-in score, progress bar or percentage', () => {
    // 85% in bold with a progress bar and "Based on consent, DPA, and data
    // handling metrics" under it, off a constant. Nothing measures it, and on a
    // GDPR page an invented figure is a claim about a legal obligation.
    expect(page).not.toContain('complianceScore');
    expect(page).not.toContain('Compliance Score');
    expect(page).not.toContain('Progress');
  });

  it('the three cards that remain are real counts', () => {
    for (const read of ['consentStats?.byStatus?.given', 'dpaStats?.byStatus?.active']) {
      expect(page).toContain(read);
    }
  });
});
