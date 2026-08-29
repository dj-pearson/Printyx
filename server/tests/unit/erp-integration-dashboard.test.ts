import { describe, expect, it } from 'vitest';
import {
  UNBACKED_FIELDS,
  buildErpDashboard,
  emptyMetrics,
  type MetricRow,
  type SystemRow,
} from '../../../supabase/functions/_shared/erp-integration-dashboard';

/**
 * PROD-014a. The handler this replaced returned an invented 98.7% sync rate and
 * 234ms latency for every tenant. These tests pin the two things that make the
 * replacement honest: what an empty tenant gets, and how the averages are taken.
 */

const sys = (over: Partial<SystemRow> & { id: string }): SystemRow => ({
  name: 'System',
  provider: 'acme',
  type: 'api',
  status: 'active',
  last_sync: null,
  error_message: null,
  created_at: null,
  ...over,
});

const metric = (over: Partial<MetricRow> & { integration_id: string }): MetricRow => ({
  total_api_calls: 0,
  successful_calls: 0,
  failed_calls: 0,
  avg_latency_ms: null,
  records_synced: 0,
  data_volume_bytes: 0,
  errors_by_type: null,
  period_end: '2026-08-01T00:00:00Z',
  ...over,
});

describe('buildErpDashboard', () => {
  it('a tenant with nothing gets zeros and NULLS, never a plausible rate', () => {
    const d = buildErpDashboard([], []);

    expect(d.integrationOverview.totalIntegrations).toBe(0);
    expect(d.systems).toEqual([]);
    // The distinction this whole module exists for: no traffic is not 0% success.
    expect(d.integrationOverview.successRate).toBeNull();
    expect(d.integrationOverview.averageLatencyMs).toBeNull();
    expect(d.integrationOverview.totalApiCalls).toBe(0);
    expect(d.integrationOverview.lastSyncCompleted).toBeNull();
  });

  it('names what it cannot answer instead of zeroing it', () => {
    const d = buildErpDashboard([], []);
    expect(d.unbacked).toEqual(UNBACKED_FIELDS);
    expect(d.unbacked).toContain('dataSynchronization.dataQuality');
    expect(d).not.toHaveProperty('businessProcessAutomation');
  });

  it('a system with no metrics rows reports zero calls and null latency', () => {
    const d = buildErpDashboard([sys({ id: 'a' })], []);
    expect(d.systems[0].metrics).toEqual(emptyMetrics());
    expect(d.systems[0].metrics.avgLatencyMs).toBeNull();
  });

  it('counts active and errored systems from status, and takes the latest sync', () => {
    const d = buildErpDashboard(
      [
        sys({ id: 'a', status: 'active', last_sync: '2026-08-01T10:00:00Z' }),
        sys({ id: 'b', status: 'error', last_sync: '2026-08-03T09:00:00Z' }),
        sys({ id: 'c', status: 'disconnected', last_sync: null }),
      ],
      [],
    );

    expect(d.integrationOverview.totalIntegrations).toBe(3);
    expect(d.integrationOverview.activeIntegrations).toBe(1);
    expect(d.integrationOverview.failedIntegrations).toBe(1);
    expect(d.integrationOverview.lastSyncCompleted).toBe('2026-08-03T09:00:00Z');
  });

  it('sums several periods for one system', () => {
    const d = buildErpDashboard(
      [sys({ id: 'a' })],
      [
        metric({
          integration_id: 'a',
          total_api_calls: 100,
          successful_calls: 90,
          failed_calls: 10,
          records_synced: 5,
          data_volume_bytes: 1000,
        }),
        metric({
          integration_id: 'a',
          total_api_calls: 100,
          successful_calls: 100,
          failed_calls: 0,
          records_synced: 7,
          data_volume_bytes: 2000,
        }),
      ],
    );

    expect(d.systems[0].metrics.totalApiCalls).toBe(200);
    expect(d.systems[0].metrics.failedCalls).toBe(10);
    expect(d.systems[0].metrics.recordsSynced).toBe(12);
    expect(d.systems[0].metrics.dataVolumeBytes).toBe(3000);
    expect(d.integrationOverview.successRate).toBeCloseTo(95, 5);
  });

  it('weights latency by call volume rather than averaging the averages', () => {
    // 1 call at 1000ms, 999 calls at 10ms. A mean of means says 505ms, which
    // would describe an outage nobody had. Weighted says 11ms.
    const d = buildErpDashboard(
      [sys({ id: 'a' })],
      [
        metric({ integration_id: 'a', total_api_calls: 1, avg_latency_ms: 1000 }),
        metric({ integration_id: 'a', total_api_calls: 999, avg_latency_ms: 10 }),
      ],
    );

    expect(d.systems[0].metrics.avgLatencyMs).toBe(11);
    expect(d.integrationOverview.averageLatencyMs).toBe(11);
  });

  it('ignores a latency reading from a period that carried no calls', () => {
    const d = buildErpDashboard(
      [sys({ id: 'a' })],
      [
        metric({ integration_id: 'a', total_api_calls: 0, avg_latency_ms: 5000 }),
        metric({ integration_id: 'a', total_api_calls: 10, avg_latency_ms: 20 }),
      ],
    );

    expect(d.systems[0].metrics.avgLatencyMs).toBe(20);
  });

  it('merges errors_by_type across periods', () => {
    const d = buildErpDashboard(
      [sys({ id: 'a' })],
      [
        metric({
          integration_id: 'a',
          total_api_calls: 1,
          errors_by_type: { timeout: 2, auth: 1 },
        }),
        metric({ integration_id: 'a', total_api_calls: 1, errors_by_type: { timeout: 3 } }),
      ],
    );

    expect(d.systems[0].metrics.errorsByType).toEqual({ timeout: 5, auth: 1 });
  });

  it('excludes metrics for an integration no longer in the registry', () => {
    // Rows can outlive the system they measured. Counting them would report
    // traffic for a connector the tenant has deleted.
    const d = buildErpDashboard(
      [sys({ id: 'a' })],
      [
        metric({ integration_id: 'a', total_api_calls: 10, successful_calls: 10 }),
        metric({ integration_id: 'ghost', total_api_calls: 990, successful_calls: 0 }),
      ],
    );

    expect(d.integrationOverview.totalApiCalls).toBe(10);
    expect(d.integrationOverview.successRate).toBe(100);
  });

  it('tolerates numeric strings, which is what PostgREST returns for bigint', () => {
    const d = buildErpDashboard(
      [sys({ id: 'a' })],
      [
        metric({
          integration_id: 'a',
          total_api_calls: '50' as unknown as number,
          successful_calls: '25' as unknown as number,
          data_volume_bytes: '4096' as unknown as number,
        }),
      ],
    );

    expect(d.integrationOverview.totalApiCalls).toBe(50);
    expect(d.integrationOverview.successRate).toBe(50);
    expect(d.integrationOverview.dataVolumeBytes).toBe(4096);
  });
});
