/**
 * The three charts above the /reports catalog (REPORTS-CHARTS-002).
 *
 * AUDIT-020 deleted what used to be here: "Performance Trends", "Distribution
 * Analysis" and "Period Comparison" came from `generateMockChartData`, which is
 * Math.random() with a hardcoded 40000 target drawn over it, on a routed page.
 * The panel has been a NotConnectedState since, waiting for an endpoint.
 *
 * THE ENDPOINT ANSWERS FOR THREE OF THE EIGHT CATEGORIES, and this component's
 * job is to render the refusal for the other five as carefully as it renders
 * the charts. `charted: false` comes back with a reason naming that category -
 * "nothing in this product records HR activity" is a different fact from "the
 * executive category is a roll-up of the others" - so the panel prints the
 * server's sentence rather than one generic line.
 *
 * NO TARGET LINE. `sales_goals` holds activity counts, not a currency goal, so
 * there is no per-tenant target to draw and the response says so in `unbacked`,
 * which this renders.
 */
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChartComponent, BarChartComponent } from '@/components/charts/ChartComponents';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatCurrencyWhole } from '@/lib/utils';
import { Info } from 'lucide-react';

interface TrendPoint {
  period: string;
  count: number;
  value: number;
}

interface DistributionSlice {
  key: string;
  count: number;
  value: number;
}

interface PeriodTotals {
  count: number;
  value: number;
  valueIsFloor: boolean;
}

interface ChartsResponse {
  category: string | null;
  charted: boolean;
  reason?: string;
  chartedCategories?: string[];
  period?: string;
  unit?: 'currency' | 'count';
  source?: string;
  target?: null;
  trend?: TrendPoint[];
  distribution?: DistributionSlice[];
  comparison?: {
    current: PeriodTotals;
    previous: PeriodTotals;
    countChangePercent: number | null;
    valueChangePercent: number | null;
  };
  unbacked?: string[];
}

export interface ReportChartsPanelProps {
  category: string;
  period?: 'week' | 'month' | 'quarter' | 'year';
}

/** An em dash, not a zero: a change nobody can compute is not "no change". */
function changeLabel(pct: number | null | undefined) {
  if (pct === null || pct === undefined) return '—';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

export function ReportChartsPanel({ category, period = 'quarter' }: ReportChartsPanelProps) {
  const path = `/api/reporting/charts?category=${encodeURIComponent(category)}&period=${period}`;
  const { data, isLoading, isError, refetch } = useQuery<ChartsResponse>({
    queryKey: [path],
    queryFn: () => apiRequest(path),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <InlineQueryError label="the report charts" onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  if (!data.charted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No charts for this category</CardTitle>
          <CardDescription>{data.reason}</CardDescription>
        </CardHeader>
        {data.chartedCategories?.length ? (
          <CardContent className="text-sm text-muted-foreground">
            Charts are available for {data.chartedCategories.join(', ')}.
          </CardContent>
        ) : null}
      </Card>
    );
  }

  const isCurrency = data.unit === 'currency';
  const trend = data.trend ?? [];
  const distribution = data.distribution ?? [];
  const comparison = data.comparison;
  const hasRows = trend.some((p) => p.count > 0);

  const money = (v: number) => formatCurrencyWhole(v);
  const metric = (p: TrendPoint) => (isCurrency ? p.value : p.count);

  return (
    <div className="space-y-4">
      {!hasRows ? (
        // An empty window is a real answer about the tenant, and it is not the
        // same as a failed read - which renders above as an error.
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing in this period</CardTitle>
            <CardDescription>
              No {data.source?.replace(/_/g, ' ')} recorded for this tenant in the selected period.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <LineChartComponent
            title="Trend"
            subtitle={`By month, from ${data.source?.replace(/_/g, ' ')}`}
            data={trend.map((p) => ({ period: p.period, metric: metric(p) }))}
            xDataKey="period"
            lines={[{ dataKey: 'metric', name: isCurrency ? 'Value' : 'Count' }]}
            formatYAxis={(v) => (isCurrency ? money(Number(v)) : String(v))}
            height={280}
          />
          <BarChartComponent
            title="Distribution"
            subtitle="By status"
            data={distribution.map((s) => ({
              key: s.key.replace(/_/g, ' '),
              count: s.count,
            }))}
            xDataKey="key"
            bars={[{ dataKey: 'count', name: 'Records' }]}
            height={280}
          />
        </div>
      )}

      {comparison ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">This period against the last</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
            <div>
              <div className="text-muted-foreground">Records</div>
              <div className="text-2xl font-semibold">{comparison.current.count}</div>
              <div className="text-muted-foreground">
                was {comparison.previous.count} ({changeLabel(comparison.countChangePercent)})
              </div>
            </div>
            {isCurrency ? (
              <div>
                <div className="text-muted-foreground">
                  Value
                  {comparison.current.valueIsFloor ? (
                    <Badge variant="outline" className="ml-2">
                      at least
                    </Badge>
                  ) : null}
                </div>
                <div className="text-2xl font-semibold">
                  {formatCurrency(comparison.current.value)}
                </div>
                <div className="text-muted-foreground">
                  was {formatCurrency(comparison.previous.value)} (
                  {changeLabel(comparison.valueChangePercent)})
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {data.unbacked?.length ? (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <ul className="space-y-1">
            {data.unbacked.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default ReportChartsPanel;
