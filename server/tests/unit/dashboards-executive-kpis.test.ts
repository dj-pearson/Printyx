/**
 * The executive dashboard's KPIs are measured, not typed in (iteration 11).
 *
 * supabase/functions/dashboards/ is a PRODUCTION edge function - unlike the
 * Express fabrications iterations 8 to 10 found, this one is what a deployed
 * client actually reaches. GET /dashboards/executive returned four real counts
 * alongside three invented ones:
 *
 *   revenueGrowth: 12.5,        // Placeholder
 *   customerSatisfaction: 92,   // Placeholder
 *   ticketResolutionRate: 85,   // Placeholder
 *
 * The comment was only ever visible in the source. A caller saw three KPIs next
 * to four genuine figures, which is what makes this shape worse than a page of
 * obvious mock data: the invented values inherit the credibility of the real
 * ones around them.
 *
 * Two were derivable and now are. The resolution rate comes from counts this same
 * handler already computed two blocks above for /dashboards/service. CSAT comes
 * off service_calls.customer_satisfaction_rating, the column
 * reports/_queries/executive.ts already averages - which also exposes that 92 was
 * in the WRONG UNIT: that column is a 1-5 rating, so the number would have read
 * as a percentage of something it never measured.
 *
 * revenueGrowth needs a prior period and nothing in the tree defines one, so it
 * is null and named in `unbacked`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(process.cwd(), 'supabase/functions/dashboards/index.ts'), 'utf8');

/** Strip comments: the note above quotes all three placeholder lines. */
const CODE = SOURCE.split('\n')
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

describe('no placeholder KPI survives', () => {
  it('none of the three literals remain', () => {
    expect(CODE).not.toMatch(/revenueGrowth:\s*[\d.]/);
    expect(CODE).not.toMatch(/customerSatisfaction:\s*\d/);
    expect(CODE).not.toMatch(/ticketResolutionRate:\s*\d/);
  });

  it('carries no Placeholder marker', () => {
    expect(CODE).not.toContain('Placeholder');
  });
});

describe('the two derivable KPIs are derived', () => {
  it('CSAT reads the real column, filtered to rows that have one', () => {
    expect(CODE).toContain("from('service_calls')");
    expect(CODE).toContain("select('customer_satisfaction_rating')");
    expect(CODE).toContain("not('customer_satisfaction_rating', 'is', null)");
  });

  it('CSAT declares its 1-5 scale and its sample size', () => {
    // 92 was wrong twice over: invented, and in percent. A consumer cannot tell
    // a 1-5 mean from a percentage without being told which it is.
    expect(CODE).toContain("customerSatisfactionScale: '1-5'");
    expect(CODE).toContain('customerSatisfactionSampleSize');
  });

  it('the resolution rate uses the same status vocabulary as /dashboards/service', () => {
    // Two definitions of "resolved" in one file would make the two endpoints
    // disagree about the same tickets.
    const resolvedStates = CODE.match(/\['resolved', 'closed', 'completed'\]/g) ?? [];
    expect(resolvedStates.length).toBeGreaterThanOrEqual(1);
    expect(CODE).toContain("['completed', 'resolved', 'closed']");
  });

  it('divides by a real denominator rather than assuming one', () => {
    expect(CODE).toMatch(/resolutionDenominator > 0/);
  });
});

describe('what cannot be measured is named', () => {
  it('revenueGrowth is null and explained', () => {
    expect(CODE).toContain('revenueGrowth: null');
    expect(CODE).toContain('no prior-period comparison');
  });

  it('an empty tenant is distinguished from a zero score', () => {
    // A tenant with no rated calls must not read as a satisfaction of 0.
    expect(CODE).toContain('customerSatisfaction === null');
    expect(CODE).toContain('ticketResolutionRate === null');
  });
});
