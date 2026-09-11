/**
 * System Monitoring.
 *
 * What this page used to be: 517 lines under a `// Mock data for demonstration`
 * comment, routed at /system-monitoring, with no query at all. It asserted CPU
 * at 23.5%, memory at 68.2% flagged as a warning, disk at 45.8%, network I/O at
 * 234.7 MB/s, four services with invented uptimes to two decimal places, and
 * three alerts - one of them a SECURITY alert reading "Multiple failed login
 * attempts detected". Every timestamp was computed from Date.now(), so the
 * fabrication always rendered as "15 minutes ago" and looked live. That is the
 * AUDIT-020 trap in its worst form: a stable-looking-fresh invention is harder
 * to doubt than a static one, because refreshing appears to confirm it.
 *
 * check:no-static-posture did not see any of it. Its rule is a literal written
 * into the JSX, and these were typed const arrays rendered through .map, so
 * every JSX text node was an expression. That gap is closed in the same commit.
 *
 * What is here now comes from GET /api/admin/system-health, which counts real
 * rows: users, active sessions, failed logins in the last day, audit events,
 * critical events in the last week, open tickets, stored bytes. It also derives
 * its own alerts from thresholds, so the alert list is real or empty.
 *
 * WHAT IS NOT HERE, deliberately: host telemetry. Nothing in this platform
 * measures CPU, memory, disk, network or per-service uptime for a tenant, and
 * the endpoint does not pretend to - so the page says so rather than drawing a
 * gauge. An infrastructure dashboard is a claim about whether the business can
 * operate, and one with nothing behind it is worse than no dashboard at all.
 */

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertTriangle, CheckCircle, HardDrive, RefreshCw, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import MainLayout from '@/components/layout/main-layout';

interface SystemHealth {
  status: 'healthy' | 'warning' | string;
  timestamp: string;
  metrics: {
    users: { total: number; activeLastDay: number };
    sessions: { active: number; failedLoginsLastDay: number };
    audit: { eventsLastDay: number; criticalEventsLastWeek: number };
    service: { openTickets: number };
    /** Bytes, or null when the tenant row carries no figure. */
    storage: number | null;
  };
  alerts: string[];
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Activity;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemMonitoring() {
  const {
    data: health,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<SystemHealth>({
    queryKey: ['/api/admin/system-health'],
    refetchInterval: 60_000,
  });

  const m = health?.metrics;
  const healthy = health?.status === 'healthy';

  return (
    <MainLayout
      title="System Monitoring"
      description="Tenant activity, sessions and audit signals, counted from live rows"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {health &&
              (healthy ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle className="h-3 w-3" aria-hidden="true" />
                  Healthy
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Needs attention
                </Badge>
              ))}
            {health && (
              <span className="text-xs text-muted-foreground">
                Checked {formatDistanceToNow(new Date(health.timestamp), { addSuffix: true })}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Could not load system health. {(error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (
            <>
              <Metric
                label="Active users"
                value={String(m?.users.activeLastDay ?? 0)}
                hint={`of ${m?.users.total ?? 0} enabled, signed in within a day`}
                icon={Users}
              />
              <Metric
                label="Active sessions"
                value={String(m?.sessions.active ?? 0)}
                icon={Activity}
              />
              <Metric
                label="Failed logins"
                value={String(m?.sessions.failedLoginsLastDay ?? 0)}
                hint="last 24 hours"
                icon={AlertTriangle}
              />
              <Metric
                label="Storage used"
                value={formatBytes(m?.storage ?? null)}
                hint={m?.storage == null ? 'Not recorded for this tenant' : undefined}
                icon={HardDrive}
              />
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Audit activity</CardTitle>
              <CardDescription>Counted from audit_logs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm">Events, last 24 hours</span>
                    <span className="text-sm font-medium tabular-nums">
                      {m?.audit.eventsLastDay ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm">Critical or high, last 7 days</span>
                    <span className="text-sm font-medium tabular-nums">
                      {m?.audit.criticalEventsLastWeek ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm">Open service tickets</span>
                    <span className="text-sm font-medium tabular-nums">
                      {m?.service.openTickets ?? 0}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alerts</CardTitle>
              <CardDescription>
                Raised by threshold from the counts above, not from a stored alert list
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (health?.alerts.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing has crossed a threshold.
                </p>
              ) : (
                <ul className="space-y-2">
                  {health?.alerts.map((alert) => (
                    <li key={alert} className="flex items-start gap-2 text-sm">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{alert}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Not measured</CardTitle>
            <CardDescription>
              Shown so an absence is not read as an all-clear. Each needs a source before it can
              appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>CPU, memory, disk and network - no host telemetry reaches this application</li>
              <li>
                Per-service uptime and response time - nothing probes the web, database, gateway or
                job services
              </li>
              <li>
                Background job health - the workflow sweeper records executions, but no liveness
                signal is collected
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
