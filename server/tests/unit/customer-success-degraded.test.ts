import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * AUDIT-028. A degraded endpoint answered with ZEROES and the page rendered
 * them as measurements.
 *
 * /customer-success is routed twice, and a CSM opening it was told their
 * customers rate them 0.0 out of 5 - drawn as five empty stars - with an NPS of
 * 0 printed in green, a 0% response rate, 0% equipment utilisation behind a
 * progress bar, and a "+0%" trend also in green. Each figure came from a stub
 * that knew perfectly well it had no data: every response carried a `degraded`
 * block saying so, and nothing on the page read it.
 *
 * Zero is a claim. On an NPS scale running -100 to 100 it is a specific and
 * quite bad one, and five empty stars is a verdict on a business that has
 * simply never been surveyed.
 */

const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** Source with comments removed, for an assertion about what is NOT there. */
const stripComments = (src: string) =>
  src
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const stubs = read('supabase/functions/customer-success/handlers/analytics-frontend-stubs.ts');
const page = read('client/src/pages/CustomerSuccessManagement.tsx');

describe('the degraded endpoints', () => {
  it('report null for every figure they cannot measure', () => {
    for (const key of [
      'averageUtilization',
      'totalMonthlyVolume',
      'utilizationTrend',
      'npsScore',
      'overallSatisfaction',
      'responseRate',
    ]) {
      expect(stubs).toContain(`${key}: null`);
      expect(stubs).not.toMatch(new RegExp(`${key}:\\s*0\\b`));
    }
  });

  it('still say why, so the absence is explained rather than blank', () => {
    expect(stubs).toMatch(/degraded: \{/);
    expect(stubs).toContain('reason:');
  });
});

describe('calculate-health', () => {
  it('refuses instead of reporting work it does not do', () => {
    const handler = stubs.slice(stubs.indexOf('handleCalculateHealth'));
    expect(handler).toContain('501');
    expect(handler).not.toContain("status: 'queued'");
  });

  it('writes nothing at all', () => {
    // The worst part was not the canned success. It moved the
    // customer_health_scores review column forward, so a stale score looked
    // freshly reviewed on the card the page draws from that same column.
    //
    // COMMENTS STRIPPED FIRST. The handler's own header explains what it no
    // longer does, and an absence assertion run over the raw text matches that
    // explanation and reports it as the defect - which is what happened on the
    // first run of this test, and is the same trap check:edge-coverage carries
    // in its header.
    const handler = stripComments(stubs.slice(stubs.indexOf('handleCalculateHealth')));
    expect(handler).not.toContain('next_review_date');
    expect(handler).not.toContain('.update(');
  });

  it('the page surfaces the refusal rather than toasting success', () => {
    const mutation = page.slice(page.indexOf('calculateHealthMutation'));
    expect(mutation.slice(0, 1600)).toContain('onError');
  });
});

describe('the page', () => {
  it('renders an em dash for a figure with no source', () => {
    expect(page).toContain('const measured = (');
    expect(page).toContain("? '—'");
  });

  it('draws no star row and no progress bar when there is nothing to draw', () => {
    expect(page).toContain('satisfactionData.summary.overallSatisfaction !== null &&');
    expect(page).toContain('usageAnalytics.summary.averageUtilization !== null &&');
  });

  it('does not colour a missing NPS green', () => {
    // `?? -1` rather than `?? 0`: zero is not a positive score, and null is not
    // a score at all.
    expect(page).toContain('(satisfactionData.summary.npsScore ?? -1) > 0');
  });

  it('shows the reason the endpoint sends', () => {
    expect(page).toContain('satisfactionData.degraded?.reason');
    expect(page).toContain('usageAnalytics.degraded?.reason');
  });
});
