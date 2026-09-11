/**
 * Service Analytics (SHAPE-ENVELOPE-003).
 *
 * What this page used to be: 1,491 lines over six endpoints - technician-
 * performance, customer-service, trends, dashboards, benchmarks and
 * performance-metrics - none of which is served by anything on either host. The
 * analytics edge function answers dashboard, sales, service and performance and
 * nothing else, and server/analytics-routes.ts was deleted under PA-040. It
 * rendered its empty states for every tenant, and its two create dialogs posted
 * BI dashboards and performance benchmarks into tables that exist in no schema
 * and no migration.
 *
 * The real backend was next door the whole time. supabase/functions/
 * service-analytics/ derives ticket volume, priority and status breakdowns, a
 * daily created-versus-resolved series and per-technician completion straight
 * from service_tickets. This page renders that.
 *
 * The sections with nothing behind them are gone rather than relabelled:
 * BI dashboards, performance benchmarks, per-customer churn and upsell scores,
 * and forecast confidence. What the endpoint cannot answer it names in an
 * `unbacked` array, which is printed below the report - a service dashboard
 * asserting 85% satisfaction with no CSAT column anywhere is the LEGAL-010 case.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, Clock, Inbox, Wrench } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Overview = {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  /** Null when nothing has been resolved - an average of no samples is not 0. */
  avgResolutionTime: number | null;
  customerSatisfaction: number | null;
};

type ServiceAnalyticsResponse = {
  overview: Overview;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  trends: Array<{ date: string; created: number; resolved: number }>;
  technicians: Array<{
    technicianId: string;
    technicianName: string | null;
    assignedTickets: number;
    completedTickets: number;
    completionRate: number;
  }>;
  lastUpdated: string;
  unbacked?: string[];
};

type TrendResponse = {
  period: string;
  series: Array<{ date: string; created: number; resolved: number }>;
  summary: { totalCreated: number; totalResolved: number };
};

const PERIODS = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'quarter', label: 'Last 90 days' },
  { value: 'year', label: 'Last 12 months' },
];

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Inbox;
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

export default function ServiceAnalytics() {
  const [period, setPeriod] = useState('month');

  const {
    data: analytics,
    isLoading,
    error,
  } = useQuery<ServiceAnalyticsResponse>({
    queryKey: ['/api/service-analytics'],
  });

  const { data: trend, isLoading: trendLoading } = useQuery<TrendResponse>({
    queryKey: [`/api/service-analytics/trends?period=${period}`],
  });

  const overview = analytics?.overview;
  const priorities = analytics?.byPriority ?? {};
  const statuses = analytics?.byStatus ?? {};
  const technicians = analytics?.technicians ?? [];

  return (
    <MainLayout
      title="Service Analytics"
      description="Ticket volume, resolution time and technician completion, derived from service tickets"
    >
      <div className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Could not load service analytics. {(error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (
            <>
              <KpiCard
                label="Total tickets"
                value={String(overview?.totalTickets ?? 0)}
                icon={Inbox}
              />
              <KpiCard label="Open" value={String(overview?.openTickets ?? 0)} icon={Wrench} />
              <KpiCard label="Closed" value={String(overview?.closedTickets ?? 0)} icon={Wrench} />
              <KpiCard
                label="Average resolution"
                value={
                  overview?.avgResolutionTime == null ? '—' : `${overview.avgResolutionTime} h`
                }
                hint={overview?.avgResolutionTime == null ? 'Nothing resolved yet' : undefined}
                icon={Clock}
              />
            </>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Created and resolved</CardTitle>
              <CardDescription>
                {trend
                  ? `${trend.summary.totalCreated} created, ${trend.summary.totalResolved} resolved in this window`
                  : 'Daily ticket flow'}
              </CardDescription>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-44" aria-label="Trend period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (trend?.series?.length ?? 0) === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No tickets in this window.
              </p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend?.series ?? []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="created" name="Created" fill="hsl(var(--primary))" />
                    <Bar dataKey="resolved" name="Resolved" fill="hsl(var(--muted-foreground))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                PRIORITY_ORDER.map((key) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-sm capitalize">{key}</span>
                    <span className="text-sm font-medium tabular-nums">{priorities[key] ?? 0}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                Object.entries(statuses).map(([key, count]) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-medium tabular-nums">{count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Technician completion</CardTitle>
            <CardDescription>
              Assigned versus completed tickets. Utilisation, first-time fix and revenue per
              technician are not measured anywhere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : technicians.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No tickets are assigned to a technician yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technician</TableHead>
                      <TableHead className="text-right">Assigned</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Completion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {technicians
                      .slice()
                      .sort((a, b) => b.assignedTickets - a.assignedTickets)
                      .map((t) => (
                        <TableRow key={t.technicianId}>
                          <TableCell className="font-medium">
                            {t.technicianName ?? (
                              <span className="text-muted-foreground">Unnamed user</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {t.assignedTickets}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {t.completedTickets}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{t.completionRate}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {analytics?.unbacked && analytics.unbacked.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Not measured</CardTitle>
              <CardDescription>
                Shown so an absence is not read as a result. Each needs a data source before it can
                appear here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {analytics.unbacked.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
