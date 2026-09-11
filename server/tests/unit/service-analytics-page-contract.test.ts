import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * SHAPE-ENVELOPE-003. The routed /service-analytics page asked six endpoints
 * that no branch of any edge function serves - the analytics function answers
 * dashboard, sales, service and performance and nothing else, and
 * server/analytics-routes.ts was deleted under PA-040. It rendered its empty
 * states for every tenant while the real backend sat next door under a
 * different prefix, which is the fixture-twin trap AUDIT-019 named at route
 * level.
 *
 * Both halves asserted together, per SHAPE-ENVELOPE-001: the endpoint sends
 * these keys, the page reads them.
 */

const root = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const page = read('client/src/pages/ServiceAnalytics.tsx');
const fn = read('supabase/functions/service-analytics/index.ts');

describe('ServiceAnalytics page', () => {
  it('asks the function that actually serves it', () => {
    expect(page).toContain("queryKey: ['/api/service-analytics']");
    expect(page).toContain('/api/service-analytics/trends?period=');
  });

  it('no longer asks the analytics function for paths it does not have', () => {
    for (const dead of [
      '/api/analytics/technician-performance',
      '/api/analytics/customer-service',
      '/api/analytics/benchmarks',
      '/api/analytics/dashboards',
      '/api/analytics/trends',
      '/api/analytics/performance-metrics',
    ]) {
      expect(page).not.toContain(dead);
    }
  });

  it('drops the sections with no table behind them rather than relabelling them', () => {
    // business_intelligence_dashboards and performance_benchmarks exist in no
    // schema and no migration; the page used to offer create dialogs for both.
    expect(page).not.toContain('benchmark_name');
    expect(page).not.toContain('dashboard_name');
    expect(page).not.toContain('churn_risk_score');
  });

  it('reads the keys the endpoint sends', () => {
    for (const key of ['byPriority', 'byStatus', 'technicians', 'unbacked']) {
      expect(page).toContain(key);
      expect(fn).toContain(key);
    }
  });
});

describe('service-analytics endpoint', () => {
  it('does not assert a satisfaction score it cannot measure', () => {
    // Was `customerSatisfaction: 85, // Placeholder`. service_tickets has no
    // CSAT column and no survey is joined here.
    expect(fn).not.toMatch(/customerSatisfaction:\s*\d/);
    expect(fn).toContain('customerSatisfaction: null');
  });

  it('names what it cannot answer instead of zeroing it', () => {
    expect(fn).toMatch(/unbacked:\s*\[/);
  });

  it('returns a null average when nothing has resolved', () => {
    expect(fn).toContain('resolvedTickets.length > 0 ? avgResolutionTime : null');
  });

  it('sends the trend as a series, not as raw rows lengthed under the row cap', () => {
    // `data: tickets` with `totalCreated: tickets.length` reported 1000 forever
    // once a tenant passed PostgREST's silent cap.
    expect(fn).toContain('series: Array.from(series.entries())');
    expect(fn).not.toMatch(/data:\s*tickets\s*\|\|\s*\[\]/);
  });

  it('resolves technician names off the columns users actually has', () => {
    expect(fn).toContain("select('id, first_name, last_name')");
    expect(fn).toContain('technicianName');
  });
});
