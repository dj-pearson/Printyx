/**
 * Round 235: Performance Monitoring charted sine waves and typed-in endpoint
 * counts, its date picker was wired to a prop that does not exist, and the
 * metrics endpoint answered 0 for an unrecorded metric (0ms, 0% uptime).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  endpointBreakdown,
  latestMetrics,
  metricSeries,
  metricValue,
} from '../../../shared/performance-metrics';
import { formatMetric, historyQueryString } from '../../../client/src/pages/PerformanceMonitoring';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const PAGE = strip(readFileSync('client/src/pages/PerformanceMonitoring.tsx', 'utf8'));
const FN = strip(readFileSync('supabase/functions/performance/index.ts', 'utf8'));

describe('latestMetrics', () => {
  it('answers null, not 0, for a metric nobody recorded', () => {
    const { values, unreported } = latestMetrics([]);
    expect(values.uptime).toBeNull();
    expect(values.responseTime).toBeNull();
    expect(unreported).toContain('uptime');
  });

  it('takes the newest reading whatever order rows arrive in, and keeps a real 0', () => {
    const { values, units, unreported } = latestMetrics([
      { metric_type: 'error_rate', value: '0', unit: '%', timestamp: '2026-09-02T00:00:00Z' },
      { metric_type: 'error_rate', value: '4.5', unit: '%', timestamp: '2026-09-01T00:00:00Z' },
      { metric_type: 'response_time', value: '120', unit: 'ms', timestamp: '2026-09-01T00:00:00Z' },
      { metric_type: 'response_time', value: '300', unit: 'ms', timestamp: '2026-09-03T00:00:00Z' },
    ]);
    expect(values.errorRate).toBe(0);
    expect(values.responseTime).toBe(300);
    expect(units.responseTime).toBe('ms');
    expect(unreported).not.toContain('errorRate');
  });

  it('skips a junk value rather than reading it as a number', () => {
    expect(metricValue('12abc')).toBeNull();
    expect(metricValue('')).toBeNull();
    expect(metricValue('3.5')).toBe(3.5);
    const { values } = latestMetrics([
      { metric_type: 'cpu_usage', value: 'n/a', timestamp: '2026-09-05T00:00:00Z' },
      { metric_type: 'cpu_usage', value: '40', timestamp: '2026-09-01T00:00:00Z' },
    ]);
    expect(values.cpuUsage).toBe(40);
  });
});

describe('metricSeries and endpointBreakdown', () => {
  const rows = [
    {
      metric_type: 'response_time',
      value: 200,
      endpoint: '/api/a',
      timestamp: '2026-09-03T00:00:00Z',
    },
    {
      metric_type: 'response_time',
      value: 100,
      endpoint: '/api/a',
      timestamp: '2026-09-01T00:00:00Z',
    },
    {
      metric_type: 'response_time',
      value: 500,
      endpoint: '/api/b',
      timestamp: '2026-09-02T00:00:00Z',
    },
    { metric_type: 'response_time', value: 50, endpoint: null, timestamp: null },
    { metric_type: 'cpu_usage', value: 70, endpoint: '/api/a', timestamp: '2026-09-02T00:00:00Z' },
  ];

  it('orders a series oldest first and drops undated readings', () => {
    expect(metricSeries(rows, 'responseTime').map((p) => p.value)).toEqual([100, 500, 200]);
  });

  it('averages response time per named endpoint from response_time rows only', () => {
    expect(endpointBreakdown(rows)).toEqual([
      { endpoint: '/api/b', samples: 1, avgResponseTime: 500 },
      { endpoint: '/api/a', samples: 2, avgResponseTime: 150 },
    ]);
  });
});

describe('the page', () => {
  it('formats null as not reported and keeps a real zero', () => {
    expect(formatMetric(null)).toBe('Not reported');
    expect(formatMetric(undefined)).toBe('Not reported');
    expect(formatMetric(0, '%')).toBe('0 %');
  });

  it('wires the date picker to the history query', () => {
    expect(PAGE).toMatch(/<DateRangePicker[\s\S]*?onChange=/);
    expect(PAGE).not.toMatch(/onDateRangeChange/);
    expect(PAGE).toMatch(/\/api\/performance\/history\?\$\{historyQueryString\(dateRange\)\}/);
    const q = new URLSearchParams(
      historyQueryString({
        from: new Date('2026-09-01T00:00:00Z'),
        to: new Date('2026-09-08T00:00:00Z'),
      }),
    );
    expect(q.get('from')).toBe('2026-09-01T00:00:00.000Z');
    expect(q.get('to')).toBe('2026-09-08T00:00:00.000Z');
  });

  it('draws nothing it did not read', () => {
    expect(PAGE).not.toMatch(/Math\.sin/);
    expect(PAGE).not.toMatch(/16GB|500GB/);
    expect(PAGE).not.toMatch(/\b2840\b/);
    expect(PAGE).not.toMatch(/new Date\(\)\.toISOString\(\)\.replace/);
  });
});

describe('the performance edge function', () => {
  const branch = (name: string) => {
    const at = FN.indexOf(`case '${name}': {`);
    const next = FN.indexOf('case ', at + 10);
    return FN.slice(at, next);
  };

  it('answers metrics through the shared module and checks the read', () => {
    const b = branch('metrics');
    expect(b).toMatch(/latestMetrics\(rows \?\? \[\]\)/);
    expect(b).toMatch(/if \(error\)[\s\S]*?500/);
    expect(b).not.toMatch(/metrics\[outKey\] = 0/);
  });

  it('serves history paged, tenant scoped and bounded', () => {
    const b = branch('history');
    expect(b).toMatch(/await fetchAllRows<any>\(\(\) =>/);
    expect(b).toMatch(/\.eq\('tenant_id', tenantId\)/);
    expect(b).toMatch(/\.gte\('timestamp'/);
    expect(b).toMatch(/\.lte\('timestamp'/);
    expect(b).toMatch(/RANGE_TOO_WIDE/);
    expect(b).toMatch(/INVALID_RANGE/);
  });
});
