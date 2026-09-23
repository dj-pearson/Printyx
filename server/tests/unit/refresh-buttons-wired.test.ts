// UI-DEAD-BUTTONS-001 (round 183). Six dashboards drew a Refresh button with
// no handler. Each now refetches the page's own queries through
// useRefreshQueries, keyed by the endpoints the page actually reads.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { keyStartsWithPath } from '../../../client/src/hooks/use-refresh-queries';

const PAGES = [
  'DatabaseManagement',
  'ExecutiveDashboard',
  'FinancialIntelligenceDashboard',
  'RootAdminDashboard',
  'SalesPerformanceAnalytics',
  'ServiceForecastingAnalytics',
];

describe('keyStartsWithPath', () => {
  const paths = ['/api/reports/sales-reps', '/api/reports/pipeline-funnel'];
  it('matches a parameterised key by its path', () => {
    expect(keyStartsWithPath(paths, ['/api/reports/sales-reps', '30d'])).toBe(true);
    expect(keyStartsWithPath(paths, ['/api/reports/pipeline-funnel', 'rep-1', '30d'])).toBe(true);
  });
  it('leaves every other page query alone', () => {
    expect(keyStartsWithPath(paths, ['/api/reports/sales-reps-extra'])).toBe(false);
    expect(keyStartsWithPath(paths, ['subscription', 'current'])).toBe(false);
    expect(keyStartsWithPath(paths, [42])).toBe(false);
  });
  it('matches a key whose path carries a query string, on the path alone', () => {
    expect(keyStartsWithPath(paths, ['/api/reports/sales-reps?period=month'])).toBe(true);
    expect(keyStartsWithPath(paths, ['/api/reports/sales-reps-extra?period=month'])).toBe(false);
  });
});

describe.each(PAGES)('%s', (name) => {
  const src = readFileSync(`client/src/pages/${name}.tsx`, 'utf8');

  it('its Refresh button calls the refresh handler and disables while it runs', () => {
    expect(src).toMatch(
      /<Button[^>]*onClick=\{\(\) => void refreshPage\(\)\}[^>]*disabled=\{refreshing\}[^>]*>[\s\S]{0,200}?Refresh\s*<\/Button>/,
    );
  });

  it('refreshes exactly the endpoints the page queries', () => {
    const decl = src.match(/const REFRESH_PATHS = \[([\s\S]*?)\] as const;/);
    expect(decl).not.toBeNull();
    const listed = new Set([...decl![1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
    // A key is a quoted path or a template literal whose path ends before
    // its first interpolation or query string.
    const queried = new Set(
      [...src.matchAll(/queryKey:\s*\[\s*(?:'([^']+)'|`([^`$?]+))/g)].map((m) => m[1] ?? m[2]),
    );
    expect(listed.size).toBeGreaterThan(0);
    expect([...listed].sort()).toEqual([...queried].sort());
  });
});
