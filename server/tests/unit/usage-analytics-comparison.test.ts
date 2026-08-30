/**
 * The customer portal told every customer their volume was up 11.1% (AUDIT-021).
 *
 * /api/customer-portal/usage-analytics is proxied, so
 * supabase/functions/customer-portal/handlers/analytics.ts serves
 * UsageAnalyticsDashboard on both hosts. Its comparison block did not query a
 * previous period at all - it multiplied the current one by 0.9 and called the
 * result "previous". So percentageChange was always +11.1%, on every account,
 * every render, for volume and cost alike, and the dashboard's four trend cards
 * were all derived from it.
 *
 * That was a PORT of something worse and a step in the wrong direction: the
 * Express service rolled a random 0.85-1.15 multiplier, and its own header
 * called the constant an improvement because "deterministic responses cache
 * better". AUDIT-020's finding is the opposite - a stable fabrication is harder
 * to spot than a random one, because refreshing appears to confirm it.
 *
 * Peak usage was hardcoded too: 9am 120 pages, Tuesday 520, told to every
 * customer as their own pattern. Day and month ARE derivable from meter reads.
 * Hour is not - a submission carries a reading_date and no time - so it is
 * absent and named in `unbacked` rather than invented.
 *
 * Comments are stripped: the notes left in place name every value removed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const handler = read('supabase/functions/customer-portal/handlers/analytics.ts');
const dashboard = read('client/src/components/customer-portal/UsageAnalyticsDashboard.tsx');
const metricCard = read('client/src/components/charts/ChartComponents.tsx');
const expressService = read('server/services/customer-portal-service.ts');

describe('the previous period is measured', () => {
  it('queries the window before this one instead of scaling it', () => {
    expect(handler).toContain('previousStart');
    expect(handler).toMatch(/windowMs/);
    // The multiplier and every trace of it.
    expect(handler).not.toContain('previousMultiplier');
    expect(handler).not.toContain('0.9;');
  });

  it('splits one fetch into the two windows rather than querying twice', () => {
    expect(handler).toMatch(/\.gte\('reading_date', previousStart\.toISOString\(\)\)/);
    expect(handler).toContain('previousReadings');
  });

  it('runs identical arithmetic over both windows', () => {
    // One summarise(), called twice. Two copies of the cost model is how the
    // two halves of a comparison come to disagree.
    expect(handler).toContain('function summarise');
    const calls = handler.match(/summarise\(/g) ?? [];
    expect(calls.length).toBe(3); // the definition plus two calls
  });

  it('answers null, not zero, when there is no history to compare against', () => {
    expect(handler).toMatch(
      /previousReadings\.length === 0 \|\| previous\.totalVolume === 0\s*\?\s*null/,
    );
  });
});

describe('peak usage is derived, and the part that cannot be is absent', () => {
  it('derives day and month from the readings', () => {
    expect(handler).toContain('function derivePeaks');
    expect(handler).toContain('dailyPeaks');
    expect(handler).toContain('monthlyPeaks');
    expect(handler).toContain('derivePeaks(meterReadings)');
  });

  it('returns no hourly profile and no hardcoded volumes', () => {
    // Not a bare absence: `unbacked` names hourlyPeaks on purpose, which is the
    // point of the change. What must be gone is it being a FIELD with data.
    expect(handler).not.toMatch(/hourlyPeaks:\s*\[/);
    expect(handler).not.toContain('PEAK_USAGE');
    for (const invented of ['averageVolume: 120', 'averageVolume: 520', 'averageVolume: 8200']) {
      expect(handler).not.toContain(invented);
    }
  });

  it('averages by weekday rather than summing, so a longer window does not skew it', () => {
    // Three Tuesdays in the range should not outrank one Wednesday.
    expect(handler).toMatch(/counts\.get\(`d\$\{dayOfWeek\}`\)/);
  });

  it('names what it cannot measure', () => {
    expect(handler).toContain('unbacked:');
    expect(handler).toContain('peakUsage.hourlyPeaks');
    expect(handler).toContain('rate card');
  });

  it('stops asserting a per-device cost and efficiency it does not measure', () => {
    expect(handler).not.toMatch(/costPerPage: 0\.05/);
    expect(handler).not.toMatch(/efficiency: 95/);
    expect(handler).not.toMatch(/trendDirection: 'stable' as const/);
  });

  it('answers null for a peak day when there are no readings', () => {
    expect(handler).toMatch(/let peakDay: string \| null = null/);
  });
});

describe('the dashboard', () => {
  it('no longer charts an hourly profile', () => {
    expect(dashboard).not.toContain('hourlyPeaks');
    expect(dashboard).not.toContain('Peak Usage Hours');
  });

  it('computes each trend through one guarded helper', () => {
    expect(dashboard).toContain('function percentChange');
    // No card divides by previous directly any more - that was three separate
    // unguarded divisions, each returning Infinity for a new customer.
    expect(dashboard).not.toMatch(/analytics\.comparison\.previous\.totalCost\) \*/);
    expect(dashboard).not.toMatch(/analytics\.comparison\.previous\.efficiencyScore\) \*/);
  });

  it('renders nothing rather than "null%" when a change is unavailable', () => {
    expect(metricCard).toContain('change?: number | null');
    expect(metricCard).toMatch(/change != null && Number\.isFinite\(change\)/);
    // It also printed 11.111111111111114% before.
    expect(metricCard).toContain('change.toFixed(1)');
  });
});

describe('the dead Express copy is gone', () => {
  it('removes the service methods that nothing routed', () => {
    for (const method of [
      'getUsageAnalytics',
      'getEquipmentUsageAnalytics',
      'calculateUsageComparison',
      'calculatePeakUsageAnalysis',
    ]) {
      expect(expressService).not.toContain(method);
    }
  });

  it('leaves only the id sequence using Math.random in that service', () => {
    const uses = expressService.match(/Math\.random\(\)/g) ?? [];
    expect(uses.length).toBe(1);
    expect(expressService).toMatch(/const sequence = Math\.floor\(Math\.random\(\) \* 10000\)/);
  });

  it('deletes the sales-trends fixture, which had no caller on any host', () => {
    const sampleData = read('server/routes-sample-data.ts');
    expect(sampleData).not.toContain("'/api/sales-trends'");
  });
});
