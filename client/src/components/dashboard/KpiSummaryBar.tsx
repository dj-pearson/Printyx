import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, TrendingUp, AlertTriangle, Gauge } from 'lucide-react';

type Metrics = {
  responseTime?: number;
  throughput?: number;
  errorRate?: number;
  uptime?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  diskUsage?: number;
  activeUsers?: number;
};

export default function KpiSummaryBar({ className = '' }: { className?: string }) {
  const query = useQuery<Metrics>({
    queryKey: ['/api/performance/metrics'],
  });

  // CR-033: every tile falls back to '-', which is honest about the VALUE but
  // says nothing about why it is missing — a failed request looked exactly like
  // a metrics endpoint that returned nothing. This is a four-tile inline bar
  // embedded in other pages, so the fix is not a full-width ErrorState panel
  // (which would break the host layout); the bar keeps its shape and labels the
  // reason underneath it.
  const metrics = query.data || {};

  const items = [
    {
      label: 'Avg Response',
      value: metrics.responseTime ? `${Math.round(metrics.responseTime)} ms` : '-',
      Icon: Gauge,
    },
    {
      label: 'Throughput',
      value: metrics.throughput ? `${Math.round(metrics.throughput)}/min` : '-',
      Icon: Activity,
    },
    {
      label: 'Error Rate',
      value: metrics.errorRate != null ? `${(metrics.errorRate * 100).toFixed(2)}%` : '-',
      Icon: AlertTriangle,
    },
    {
      label: 'Uptime',
      value:
        metrics.uptime != null
          ? `${(metrics.uptime > 1 ? metrics.uptime : metrics.uptime * 100).toFixed(2)}%`
          : '-',
      Icon: TrendingUp,
    },
  ];

  return (
    <div className={className}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map(({ label, value, Icon }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-sm font-semibold truncate">{value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {query.isError && (
        <p className="mt-1 text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Metrics unavailable —{' '}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            retry
          </button>
        </p>
      )}
    </div>
  );
}
