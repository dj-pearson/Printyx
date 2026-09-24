/**
 * Performance Monitoring (round 235).
 *
 * Every chart on this page was invented: a 24-hour response-time "trend"
 * drawn as a sine wave around the current value, a weekly throughput chart
 * from a hardcoded weekday multiplier, CPU/memory/disk curves from another
 * sine, five API endpoints with typed-in request counts (2,840 on
 * /api/customers), and a Performance Logs tab of INFO/WARN lines stamped with
 * the current time. It captioned memory and disk against hardware sizes
 * nothing measures, and the date picker was wired to a prop the component
 * does not have, so choosing a range did nothing.
 *
 * It now reads GET /api/performance/metrics for the latest stored value of
 * each metric (null when nothing recorded one) and GET
 * /api/performance/history for the readings in the chosen window, which the
 * charts and the endpoint table are drawn from. Nothing in this repo
 * currently writes performance_metrics, so on most tenants the honest answer
 * is an empty page that says so.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, CheckCircle, Server } from 'lucide-react';
import {
  endpointBreakdown,
  metricSeries,
  type MetricKey,
  type MetricRow,
} from '@shared/performance-metrics';

type MetricsResponse = Partial<Record<MetricKey, number | null>> & {
  units?: Partial<Record<MetricKey, string>>;
  unreported?: string[];
};

interface HistoryResponse {
  from: string;
  to: string;
  rows: MetricRow[];
}

interface SystemAlert {
  id: string;
  type?: 'warning' | 'error' | 'info';
  severity?: string;
  message: string;
  timestamp: string;
  resolved?: boolean;
}

const DAY_MS = 86_400_000;

/** Query string for the history window; the bounds are instants. */
export function historyQueryString(range: { from: Date; to: Date }): string {
  const p = new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() });
  return p.toString();
}

/** A stored value with its stored unit, or a plain statement that none exists. */
export function formatMetric(value: number | null | undefined, unit?: string): string {
  if (value === null || value === undefined) return 'Not reported';
  const n = Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  return unit ? `${n} ${unit}` : n;
}

const CARDS: Array<{ key: MetricKey; label: string }> = [
  { key: 'responseTime', label: 'Response time' },
  { key: 'throughput', label: 'Throughput' },
  { key: 'errorRate', label: 'Error rate' },
  { key: 'uptime', label: 'Uptime' },
  { key: 'cpuUsage', label: 'CPU' },
  { key: 'memoryUsage', label: 'Memory' },
  { key: 'diskUsage', label: 'Disk' },
  { key: 'activeUsers', label: 'Active users' },
];

const TREND_CHARTS: Array<[MetricKey, string]> = [
  ['responseTime', 'Response time'],
  ['errorRate', 'Error rate'],
  ['cpuUsage', 'CPU'],
  ['memoryUsage', 'Memory'],
];

function SeriesChart({
  rows,
  metric,
  label,
}: {
  rows: MetricRow[];
  metric: MetricKey;
  label: string;
}) {
  const data = useMemo(
    () =>
      metricSeries(rows, metric).map((p) => ({
        at: new Date(p.timestamp).toLocaleString(),
        value: p.value,
      })),
    [rows, metric],
  );
  if (data.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No {label.toLowerCase()} readings in this window.
      </p>
    );
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="at" hide />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3B82F6"
            strokeWidth={2}
            name={label}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PerformanceMonitoring() {
  const [dateRange, setDateRange] = useState(() => ({
    from: new Date(Date.now() - 7 * DAY_MS),
    to: new Date(),
  }));

  const metricsQuery = useQuery<MetricsResponse>({ queryKey: ['/api/performance/metrics'] });
  const historyQuery = useQuery<HistoryResponse>({
    queryKey: [`/api/performance/history?${historyQueryString(dateRange)}`],
  });
  const alertsQuery = useQuery<SystemAlert[]>({ queryKey: ['/api/performance/alerts'] });

  const metrics = metricsQuery.data;
  const rows = useMemo(() => historyQuery.data?.rows ?? [], [historyQuery.data]);
  const endpoints = useMemo(() => endpointBreakdown(rows), [rows]);
  const alerts = alertsQuery.data ?? [];
  const nothingRecorded =
    !!metrics && CARDS.every(({ key }) => metrics[key] === null || metrics[key] === undefined);

  return (
    <MainLayout
      title="Performance Monitoring"
      description="Stored performance readings and operational alerts for this tenant"
    >
      <div className="space-y-6">
        {metricsQuery.isError ? (
          <InlineQueryError label="performance metrics" onRetry={() => metricsQuery.refetch()} />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {CARDS.map(({ key, label }) => (
              <Card key={key}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold mt-1">
                    {metricsQuery.isLoading
                      ? '-'
                      : formatMetric(metrics?.[key], metrics?.units?.[key])}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {nothingRecorded && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No performance readings have been recorded for this tenant. The figures above fill in
              once something writes rows to performance_metrics; until then they are shown as not
              reported rather than as zero.
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="trends" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>
            <DateRangePicker
              value={dateRange}
              onChange={(range) => {
                if (range) setDateRange(range);
              }}
            />
          </div>

          <TabsContent value="trends" className="space-y-4">
            {historyQuery.isError ? (
              <InlineQueryError
                label="performance history"
                onRetry={() => historyQuery.refetch()}
              />
            ) : historyQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading readings...</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {TREND_CHARTS.map(([key, label]) => (
                  <Card key={key}>
                    <CardHeader>
                      <CardTitle className="text-base">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SeriesChart rows={rows} metric={key} label={label} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="endpoints">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-4 w-4" />
                  Response time by endpoint
                </CardTitle>
                <CardDescription>
                  Mean of the response-time readings that name an endpoint, in the chosen window.
                  Samples are readings, not requests.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {historyQuery.isError ? (
                  <InlineQueryError
                    label="performance history"
                    onRetry={() => historyQuery.refetch()}
                  />
                ) : endpoints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No response-time readings name an endpoint in this window.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {endpoints.map((e) => (
                      <li key={e.endpoint} className="flex justify-between py-2 text-sm">
                        <span className="font-mono">{e.endpoint}</span>
                        <span className="text-muted-foreground">
                          {e.avgResponseTime.toFixed(0)} ms over {e.samples}{' '}
                          {e.samples === 1 ? 'sample' : 'samples'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-3">
            {alertsQuery.isError ? (
              <InlineQueryError label="alerts" onRetry={() => alertsQuery.refetch()} />
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open alerts.</p>
            ) : (
              alerts.map((alert) => (
                <Card key={alert.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {alert.type === 'info' ? (
                        <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                      ) : (
                        <AlertTriangle
                          className={`h-5 w-5 mt-0.5 ${alert.type === 'error' ? 'text-red-600' : 'text-yellow-600'}`}
                        />
                      )}
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-sm text-muted-foreground">
                          {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'Undated'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={alert.resolved ? 'secondary' : 'default'}>
                      {alert.resolved ? 'Resolved' : 'Active'}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
