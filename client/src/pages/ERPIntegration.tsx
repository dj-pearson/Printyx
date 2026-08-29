/**
 * ERP / system integrations.
 *
 * PROD-014 + AUDIT-019. /api/erp-integration/dashboard had no edge function, so
 * this page 404'd in production. What it would have been ported from was 670
 * lines of literals - "SAP Business One", 18 integrations, a 98.7% sync success
 * rate, 99.94% uptime, and data-quality scores for accuracy, completeness,
 * consistency and timeliness - existing twice over, in routes-sample-data.ts
 * (live) and routes-erp-integration.ts (an unregistered duplicate).
 *
 * The page read all of it: businessProcessAutomation.workflowOrchestration,
 * dataSynchronization.conflictResolution.resolutionRules, a field-mapping tab, a
 * per-system authentication tab. None of those has a table behind it anywhere in
 * the repo, so they are gone rather than ported. What remains is what
 * system_integrations and integration_metrics actually hold.
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MainLayout } from '@/components/layout/main-layout';
import { QueryState } from '@/components/ui/query-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Database, Plug, Timer } from 'lucide-react';

interface SystemMetrics {
  totalApiCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgLatencyMs: number | null;
  recordsSynced: number;
  dataVolumeBytes: number;
  errorsByType: Record<string, number>;
}

interface IntegrationSystem {
  id: string;
  name: string | null;
  provider: string | null;
  type: string | null;
  status: string | null;
  lastSync: string | null;
  errorMessage: string | null;
  metrics: SystemMetrics;
}

interface ErpDashboard {
  integrationOverview: {
    windowDays: number;
    totalIntegrations: number;
    activeIntegrations: number;
    failedIntegrations: number;
    lastSyncCompleted: string | null;
    totalApiCalls: number;
    successfulCalls: number;
    failedCalls: number;
    /** null when no calls landed in the window - not the same as 0%. */
    successRate: number | null;
    averageLatencyMs: number | null;
    recordsSynced: number;
    dataVolumeBytes: number;
  };
  systems: IntegrationSystem[];
  /**
   * What the response cannot answer, named by the server rather than zeroed
   * (PROD-014a). The page renders this so the gap is visible instead of
   * reading as "nothing to report".
   */
  unbacked: string[];
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function statusTone(status: string | null): string {
  switch (status) {
    case 'active':
      return 'border-green-300 text-green-700';
    case 'error':
      return 'border-red-300 text-red-700';
    case 'pending':
      return 'border-amber-300 text-amber-700';
    default:
      return 'border-muted-foreground/30 text-muted-foreground';
  }
}

function Metric({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: typeof Plug;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}

export default function ERPIntegration() {
  const dashboardQuery = useQuery<ErpDashboard>({
    queryKey: ['/api/erp-integration/dashboard'],
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Integrations</h1>
          <p className="mt-2 text-gray-600">
            Connected systems and the API traffic they have actually carried.
          </p>
        </div>

        <QueryState
          query={dashboardQuery}
          loading={
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          }
          errorTitle="Could not load integrations"
        >
          {(data) => {
            const o = data.integrationOverview;
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                  <Metric
                    label="Connected systems"
                    value={String(o.totalIntegrations)}
                    caption={`${o.activeIntegrations} active, ${o.failedIntegrations} in error`}
                    icon={Plug}
                  />
                  <Metric
                    label="API calls"
                    value={o.totalApiCalls.toLocaleString()}
                    caption={`Last ${o.windowDays} days`}
                    icon={Database}
                  />
                  <Metric
                    label="Success rate"
                    value={o.successRate === null ? 'No traffic' : `${o.successRate.toFixed(1)}%`}
                    caption={
                      o.successRate === null
                        ? 'No calls recorded in the window'
                        : `${o.failedCalls.toLocaleString()} failed`
                    }
                    icon={AlertTriangle}
                  />
                  <Metric
                    label="Mean latency"
                    value={
                      o.averageLatencyMs === null
                        ? 'No data'
                        : `${o.averageLatencyMs.toLocaleString()} ms`
                    }
                    caption="Weighted by call volume, not a mean of means"
                    icon={Timer}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Systems</CardTitle>
                    <CardDescription>
                      {o.lastSyncCompleted
                        ? `Most recent sync ${new Date(o.lastSyncCompleted).toLocaleString()}.`
                        : 'No system has recorded a sync yet.'}{' '}
                      {o.recordsSynced.toLocaleString()} records and{' '}
                      {formatBytes(o.dataVolumeBytes)} moved in the last {o.windowDays} days.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.systems.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No integrations are configured for this tenant.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="py-2 pr-4 font-medium">System</th>
                              <th className="py-2 pr-4 font-medium">Provider</th>
                              <th className="py-2 pr-4 font-medium">Status</th>
                              <th className="py-2 pr-4 font-medium">Calls</th>
                              <th className="py-2 pr-4 font-medium">Failed</th>
                              <th className="py-2 pr-4 font-medium">Latency</th>
                              <th className="py-2 font-medium">Last sync</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.systems.map((s) => (
                              <tr key={s.id} className="border-b last:border-0 align-top">
                                <td className="py-3 pr-4">
                                  <div className="font-medium">{s.name || 'Unnamed'}</div>
                                  {s.errorMessage && (
                                    <div className="mt-1 text-xs text-red-600">
                                      {s.errorMessage}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 pr-4 text-muted-foreground">
                                  {s.provider || 'Unknown'}
                                  {s.type ? ` (${s.type})` : ''}
                                </td>
                                <td className="py-3 pr-4">
                                  <Badge variant="outline" className={statusTone(s.status)}>
                                    {s.status || 'unknown'}
                                  </Badge>
                                </td>
                                <td className="py-3 pr-4 tabular-nums">
                                  {s.metrics.totalApiCalls.toLocaleString()}
                                </td>
                                <td className="py-3 pr-4 tabular-nums">
                                  {s.metrics.failedCalls.toLocaleString()}
                                </td>
                                <td className="py-3 pr-4 tabular-nums">
                                  {s.metrics.avgLatencyMs === null
                                    ? '-'
                                    : `${s.metrics.avgLatencyMs} ms`}
                                </td>
                                <td className="py-3 text-muted-foreground">
                                  {s.lastSync ? new Date(s.lastSync).toLocaleString() : 'Never'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>What this page does not show</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      These used to appear here as fixed numbers. Nothing in the platform records
                      any of them, so they have been removed rather than left to be read as
                      measurements. The server names them on every response:
                    </p>
                    <ul className="list-inside list-disc space-y-1">
                      {data.unbacked.map((field) => (
                        <li key={field}>
                          <code className="text-xs">{field}</code>
                        </li>
                      ))}
                    </ul>
                    <p>
                      The figures above come from the integration registry and its API call metrics.
                      A system that has never reported metrics shows zero calls, which means no
                      traffic was recorded - not that the integration is failing.
                    </p>
                  </CardContent>
                </Card>
              </div>
            );
          }}
        </QueryState>
      </div>
    </MainLayout>
  );
}
