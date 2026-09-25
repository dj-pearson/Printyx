/**
 * Executive Dashboard - rebuilt in round 202.
 *
 * The previous page was written against shapes no endpoint sends: every tab
 * read typed arrays (KPIScorecard[], BusinessInsight[], CompetitiveMetric[],
 * TerritoryPerformance[]) while the reports function answers objects, so each
 * tab threw on `.map` the moment it opened; the overview read revenue targets,
 * attainment, gross margin, collection rate, customer satisfaction, churn,
 * industry averages, competitor rankings, market share and territory
 * profitability, none of which anything computes. Its period selector sent
 * 30d/90d/ytd/12m, which the server does not recognise, so every period was a
 * month. Export Report and Schedule had no handlers.
 *
 * This version renders exactly what supabase/functions/reports/handlers/
 * dashboards.ts returns, names what it does not measure, and says plainly that
 * revenue is read from the `quotes` table - quotes built in the Quote Builder
 * are stored as proposals and are not counted here.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Calendar, Download, RefreshCw } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QueryStates } from '@/components/ui/query-state';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
import { exportToCSV, type ExportColumn } from '@/lib/export-utils';
import { useRefreshQueries } from '@/hooks/use-refresh-queries';

/** Every endpoint this page reads; its Refresh button refetches these. */
const REFRESH_PATHS = [
  '/api/reports/executive-summary',
  '/api/reports/kpi-scorecards',
  '/api/reports/business-insights',
  '/api/reports/competitive-metrics',
  '/api/reports/territory-performance',
  '/api/reports/revenue-attribution',
] as const;

/** The server's period vocabulary (reports/_date.ts). */
const PERIODS = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last month' },
  { value: 'quarter', label: 'Last 3 months' },
  { value: 'year', label: 'Last 12 months' },
] as const;
type Period = (typeof PERIODS)[number]['value'];

export const UNMEASURED_EXECUTIVE = [
  'Revenue targets and attainment: no revenue target is stored.',
  'Gross margin, collection rate and days outstanding: not computed for this view.',
  'Customer satisfaction and churn: not part of these reports.',
  'Industry averages, competitor rankings and market share: no external benchmark is collected.',
  'Territory revenue and profitability: nothing attributes won revenue to a territory yet.',
];

interface SummaryResponse {
  metrics: {
    totalCustomers: number;
    totalQuotes: number;
    activeQuotes: number;
    wonQuotes: number;
    totalRevenue: number;
    openTickets: number;
    totalTickets: number;
  };
}
interface KpiResponse {
  kpis: {
    sales: { winRate: number; totalQuotes: number; wonQuotes: number; avgDealSize: number };
    service: {
      totalTickets: number;
      resolvedTickets: number;
      avgResolutionHours: number;
      openTickets: number;
    };
    customers: { newCustomers: number; newLeads: number; conversionRate: number };
  };
}
interface InsightsResponse {
  topCustomers: { name: string; revenue: number }[];
  territoryDistribution: { name: string; count: number }[];
  totalProducts: number | null;
}
interface CompetitiveResponse {
  metrics: {
    avgQuoteResponseHours: number;
    avgTicketResolutionHours: number;
    quoteWinRate: number;
    ticketCompletionRate: number;
  };
}
interface TerritoryResponse {
  territories: { territoryId: string; territoryName: string; customerCount: number }[];
}
interface AttributionResponse {
  attribution: { name: string; revenue: number; deals: number }[];
  totalRevenue: number;
}

export interface KpiRow {
  area: string;
  measure: string;
  value: number;
  unit: string;
}

/** Flattens the KPI response into the rows the page shows and exports. */
export function kpiRows(k: KpiResponse['kpis'] | undefined): KpiRow[] {
  if (!k) return [];
  return [
    { area: 'Sales', measure: 'Quote win rate', value: k.sales.winRate, unit: '%' },
    { area: 'Sales', measure: 'Quotes created', value: k.sales.totalQuotes, unit: '' },
    { area: 'Sales', measure: 'Quotes won', value: k.sales.wonQuotes, unit: '' },
    { area: 'Sales', measure: 'Average deal size', value: k.sales.avgDealSize, unit: '$' },
    { area: 'Service', measure: 'Tickets opened', value: k.service.totalTickets, unit: '' },
    { area: 'Service', measure: 'Tickets completed', value: k.service.resolvedTickets, unit: '' },
    { area: 'Service', measure: 'Tickets still open', value: k.service.openTickets, unit: '' },
    {
      area: 'Service',
      measure: 'Average resolution',
      value: k.service.avgResolutionHours,
      unit: 'h',
    },
    { area: 'Customers', measure: 'New customers', value: k.customers.newCustomers, unit: '' },
    { area: 'Customers', measure: 'New leads', value: k.customers.newLeads, unit: '' },
    {
      area: 'Customers',
      measure: 'New customers per new lead',
      value: k.customers.conversionRate,
      unit: '%',
    },
  ];
}

const KPI_EXPORT_COLUMNS: ExportColumn<KpiRow>[] = [
  { key: 'area', label: 'Area' },
  { key: 'measure', label: 'Measure' },
  { key: 'value', label: 'Value' },
  { key: 'unit', label: 'Unit' },
];

const show = (row: KpiRow) =>
  row.unit === '$'
    ? formatCurrency(row.value)
    : `${row.value.toLocaleString()}${row.unit === '%' ? '%' : row.unit === 'h' ? ' h' : ''}`;

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}
      </CardContent>
    </Card>
  );
}

export default function ExecutiveDashboard() {
  const [period, setPeriod] = useState<Period>('quarter');
  const { refresh: refreshPage, refreshing } = useRefreshQueries(REFRESH_PATHS);
  const q = `?period=${period}`;

  const summaryQuery = useQuery<SummaryResponse>({
    queryKey: [`/api/reports/executive-summary${q}`],
    queryFn: () => apiRequest(`/api/reports/executive-summary${q}`),
  });
  const kpiQuery = useQuery<KpiResponse>({
    queryKey: [`/api/reports/kpi-scorecards${q}`],
    queryFn: () => apiRequest(`/api/reports/kpi-scorecards${q}`),
  });
  const insightsQuery = useQuery<InsightsResponse>({
    queryKey: [`/api/reports/business-insights${q}`],
    queryFn: () => apiRequest(`/api/reports/business-insights${q}`),
  });
  const competitiveQuery = useQuery<CompetitiveResponse>({
    queryKey: [`/api/reports/competitive-metrics${q}`],
    queryFn: () => apiRequest(`/api/reports/competitive-metrics${q}`),
  });
  const territoryQuery = useQuery<TerritoryResponse>({
    queryKey: [`/api/reports/territory-performance${q}`],
    queryFn: () => apiRequest(`/api/reports/territory-performance${q}`),
  });
  const attributionQuery = useQuery<AttributionResponse>({
    queryKey: [`/api/reports/revenue-attribution${q}`],
    queryFn: () => apiRequest(`/api/reports/revenue-attribution${q}`),
  });

  const m = summaryQuery.data?.metrics;
  const rows = kpiRows(kpiQuery.data?.kpis);
  const insights = insightsQuery.data;
  const comp = competitiveQuery.data?.metrics;
  const territories = territoryQuery.data?.territories ?? [];
  const attribution = attributionQuery.data?.attribution ?? [];

  return (
    <MainLayout
      title="Executive Dashboard"
      description="Cross-functional figures computed from this tenant's records"
    >
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[180px]" aria-label="Period">
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={() =>
                exportToCSV(rows, KPI_EXPORT_COLUMNS, { filename: `executive-kpis-${period}` })
              }
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/scheduled-reports">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshPage()}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <QueryStates
          queries={[summaryQuery, kpiQuery]}
          loading={<DashboardSkeleton />}
          errorTitle="Could not load the executive summary"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="Won revenue"
              value={m ? formatCurrency(m.totalRevenue) : '—'}
              note="Accepted rows in the quotes table"
            />
            <Stat
              label="Quotes won"
              value={m ? `${m.wonQuotes} of ${m.totalQuotes}` : '—'}
              note={m ? `${m.activeQuotes} sent and awaiting an answer` : undefined}
            />
            <Stat label="Customers" value={m ? m.totalCustomers.toLocaleString() : '—'} />
            <Stat
              label="Open service tickets"
              value={m ? m.openTickets.toLocaleString() : '—'}
              note={m ? `${m.totalTickets} opened in the period` : undefined}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Key figures</CardTitle>
              <CardDescription>For the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {['Sales', 'Service', 'Customers'].map((area) => (
                  <div key={area}>
                    <h4 className="font-medium mb-2">{area}</h4>
                    <dl className="space-y-1 text-sm">
                      {rows
                        .filter((r) => r.area === area)
                        .map((r) => (
                          <div key={r.measure} className="flex justify-between">
                            <dt className="text-muted-foreground">{r.measure}</dt>
                            <dd className="font-medium">{show(r)}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </QueryStates>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top customers by won revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <QueryStates queries={[insightsQuery]} errorTitle="Could not load customers">
                {(insights?.topCustomers ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No won quotes in this period.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {insights!.topCustomers.map((c) => (
                      <li key={c.name} className="flex justify-between">
                        <span>{c.name}</span>
                        <span className="font-medium">{formatCurrency(c.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </QueryStates>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Won revenue by rep</CardTitle>
            </CardHeader>
            <CardContent>
              <QueryStates queries={[attributionQuery]} errorTitle="Could not load attribution">
                {attribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No won quotes in this period.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {attribution.map((a) => (
                      <li key={a.name} className="flex justify-between">
                        <span>
                          {a.name} ({a.deals} won)
                        </span>
                        <span className="font-medium">{formatCurrency(a.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </QueryStates>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Responsiveness</CardTitle>
            </CardHeader>
            <CardContent>
              <QueryStates queries={[competitiveQuery]} errorTitle="Could not load these figures">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Quote created to sent</dt>
                    <dd className="font-medium">
                      {comp ? `${comp.avgQuoteResponseHours} h average` : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Ticket opened to resolved</dt>
                    <dd className="font-medium">
                      {comp ? `${comp.avgTicketResolutionHours} h average` : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tickets completed</dt>
                    <dd className="font-medium">{comp ? `${comp.ticketCompletionRate}%` : '—'}</dd>
                  </div>
                </dl>
              </QueryStates>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customers by territory</CardTitle>
            </CardHeader>
            <CardContent>
              <QueryStates queries={[territoryQuery]} errorTitle="Could not load territories">
                {territories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active territories.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {territories.map((t) => (
                      <li key={t.territoryId} className="flex justify-between">
                        <span>{t.territoryName}</span>
                        <span className="font-medium">{t.customerCount} customers</span>
                      </li>
                    ))}
                  </ul>
                )}
              </QueryStates>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Not measured here</CardTitle>
            <CardDescription>
              Revenue on this page counts accepted rows in the quotes table. Quotes built in the
              Quote Builder are stored as proposals and are not included.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              {UNMEASURED_EXECUTIVE.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
