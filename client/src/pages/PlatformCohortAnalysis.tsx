import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QueryState } from '@/components/ui/query-state';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, TrendingUp, DollarSign, Download, Target } from 'lucide-react';
import {
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/** One headline number, with a caption saying what it is a mean of. */
function SummaryCard({
  label,
  icon,
  value,
  caption,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  caption: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        <div className="text-2xl font-bold mb-2">{value}</div>
        <p className="text-sm text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}

interface CohortRow {
  id: string;
  cohort: string;
  cohortDate: string | null;
  size: number;
  currentSize: number;
  retentionRate: number | null;
  churnRate: number | null;
  initialMRR: number | null;
  currentMRR: number | null;
  cumulativeRevenue: number | null;
  netRevenueRetention: number | null;
  averageTenureMonths: number | null;
  periodsCovered: number | null;
}

interface LtvRow {
  cohort: string;
  ltv: number | null;
  cac: number | null;
  ratio: number | null;
}

interface CohortResponse {
  cohortTable: CohortRow[];
  ltvData: LtvRow[];
  summary: {
    totalCohorts: number;
    totalCustomers: number;
    currentCustomers: number;
    averageRetentionRate: number | null;
    averageChurnRate: number | null;
    averageLTV: number | null;
    averageCAC: number | null;
    ltvToCacRatio: number | null;
  };
  unbacked?: string[];
}

export default function PlatformCohortAnalysis() {
  const [timeframe, setTimeframe] = useState('12m');

  // Fetch cohort data.
  //
  // PA-040: every read below used to be `cohortData?.x || [ ...invented rows ]`,
  // and the endpoint answered { cohorts, summary } while the page asked for
  // cohortTable / revenueCohorts / ltvData - so all three resolved to undefined
  // and the fallbacks rendered EVERY time, in dev and production alike. A whole
  // cohort study of numbers somebody typed. The keys match now and the
  // fallbacks are gone: with no rows the page says so.
  // months back, or null for all time
  const monthsBack = timeframe === '12m' ? 12 : timeframe === '24m' ? 24 : null;
  const startDate =
    monthsBack == null
      ? ''
      : new Date(new Date().setMonth(new Date().getMonth() - monthsBack)).toISOString();

  const cohortQuery = useQuery<CohortResponse>({
    queryKey: [
      `/api/platform-analytics/cohort-analysis${startDate ? `?startDate=${startDate}` : ''}`,
    ],
  });

  const getCellColor = (value: number | null) => {
    if (value === null) return 'bg-gray-100';
    if (value >= 90) return 'bg-green-100 text-green-900';
    if (value >= 80) return 'bg-green-50 text-green-800';
    if (value >= 70) return 'bg-yellow-50 text-yellow-800';
    if (value >= 60) return 'bg-orange-50 text-orange-800';
    return 'bg-red-50 text-red-800';
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '-';
    return `${value.toFixed(1)}%`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Cohort Analysis</h1>
            <p className="text-muted-foreground">
              Track customer retention, revenue, and lifetime value by cohort
            </p>
          </div>
          <div className="flex gap-2">
            {/*
              The "By Signup Month / Trial Start / First Purchase / Plan Tier /
              Lead Source" and "Retention % / Revenue $ / Customers #" selectors
              that stood here are removed (PA-040). Both sent a parameter the
              endpoint does not read - it filters on cohort_date and nothing
              else - and platform_cohort_analysis records one cohort definition
              per row, so there is nothing to switch between. The table below
              shows every metric it holds at once.

              Timeframe is kept because it now does something: it becomes the
              startDate the endpoint filters on.
            */}
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12m">Last 12 months</SelectItem>
                <SelectItem value="24m">Last 24 months</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* CR-033: the cohort/metric/timeframe selectors above stay usable —
          re-picking one is the retry — and everything below is derived. */}
      <QueryState
        query={cohortQuery}
        loading={<DashboardSkeleton />}
        errorTitle="Could not load cohort analysis"
        className="py-8"
      >
        {(data) => {
          const cohortTable = data.cohortTable ?? [];
          const ltvByCohort = data.ltvData ?? [];
          const summary = data.summary;

          if (cohortTable.length === 0) {
            return (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium">No cohorts have been calculated yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cohort analysis reads platform_cohort_analysis, which nothing has written for
                    this date range.
                  </p>
                </CardContent>
              </Card>
            );
          }

          return (
            <>
              {/* Key Metrics */}
              {/*
              Four cards stood here with their values typed in - 79.4% three-month
              retention, 56.2% twelve-month, $20,605 LTV, a 6.92:1 ratio - each with
              a green "+3.2% vs. previous cohorts" delta beneath it (PA-040). None of
              it came from the query. Three-month and twelve-month retention need a
              per-period series this table does not hold, so they are gone entirely;
              the rest is the average across the cohorts that carry the value, and
              null where none does. Nothing records a previous calculation, so there
              is no delta to show.
            */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <SummaryCard
                  label="Cohorts"
                  icon={<Users className="h-4 w-4 text-muted-foreground" />}
                  value={summary.totalCohorts.toLocaleString()}
                  caption={`${summary.currentCustomers.toLocaleString()} of ${summary.totalCustomers.toLocaleString()} customers still active`}
                />
                <SummaryCard
                  label="Avg. Retention"
                  icon={<Target className="h-4 w-4 text-muted-foreground" />}
                  value={formatPercent(summary.averageRetentionRate)}
                  caption="Mean across cohorts that report one"
                />
                <SummaryCard
                  label="Avg. Customer LTV"
                  icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
                  value={
                    summary.averageLTV == null
                      ? 'Not calculated'
                      : formatCurrency(summary.averageLTV)
                  }
                  caption={
                    summary.averageCAC == null
                      ? 'No CAC recorded'
                      : `Against ${formatCurrency(summary.averageCAC)} CAC`
                  }
                />
                <SummaryCard
                  label="LTV:CAC Ratio"
                  icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                  value={
                    summary.ltvToCacRatio == null
                      ? 'Not calculated'
                      : `${summary.ltvToCacRatio.toFixed(2)}:1`
                  }
                  caption="Mean across cohorts that report one"
                />
              </div>

              {/* Cohort Table */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Cohorts</CardTitle>
                  <CardDescription>
                    Size, retention and revenue for each calculated cohort
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">Cohort</th>
                          <th className="text-right p-2 font-medium">Signed up</th>
                          <th className="text-right p-2 font-medium">Still active</th>
                          <th className="text-right p-2 font-medium">Retention</th>
                          <th className="text-right p-2 font-medium">Churn</th>
                          <th className="text-right p-2 font-medium">Initial MRR</th>
                          <th className="text-right p-2 font-medium">Current MRR</th>
                          <th className="text-right p-2 font-medium">Net rev. retention</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cohortTable.map((cohort) => (
                          <tr key={cohort.id} className="border-b last:border-0">
                            <td className="p-2 font-medium">{cohort.cohort}</td>
                            <td className="p-2 text-right">{cohort.size.toLocaleString()}</td>
                            <td className="p-2 text-right">
                              {cohort.currentSize.toLocaleString()}
                            </td>
                            <td className={`p-2 text-right ${getCellColor(cohort.retentionRate)}`}>
                              {formatPercent(cohort.retentionRate)}
                            </td>
                            <td className="p-2 text-right">{formatPercent(cohort.churnRate)}</td>
                            <td className="p-2 text-right">
                              {cohort.initialMRR == null ? '-' : formatCurrency(cohort.initialMRR)}
                            </td>
                            <td className="p-2 text-right">
                              {cohort.currentMRR == null ? '-' : formatCurrency(cohort.currentMRR)}
                            </td>
                            <td className="p-2 text-right">
                              {formatPercent(cohort.netRevenueRetention)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/*
                  The "Average Retention Curve" chart, the month0..month6 retention
                  matrix and the month0..month4 revenue chart that stood here are
                  removed (PA-040). All three needed a row per cohort PER PERIOD;
                  platform_cohort_analysis holds one row per cohort with a single
                  retention_rate and one MRR pair, so none of them could be derived
                  and all three were rendering typed numbers - a 100/91.2/84.8/79.4
                  curve, and an "Insight" paragraph interpreting it.
                */}
                  {data.unbacked && data.unbacked.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                      <p className="font-medium mb-1">Not shown, because it is not measured:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {data.unbacked.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* LTV by Cohort */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Lifetime Value by Cohort</CardTitle>
                    <CardDescription>LTV, CAC, and ratio comparison</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={ltvByCohort}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="cohort" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="ltv" fill="#10b981" name="LTV" />
                        <Bar yAxisId="left" dataKey="cac" fill="#ef4444" name="CAC" />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="ratio"
                          stroke="#f59e0b"
                          name="LTV:CAC Ratio"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>LTV:CAC Details</CardTitle>
                    <CardDescription>Breakdown by cohort</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cohort</TableHead>
                          <TableHead className="text-right">LTV</TableHead>
                          <TableHead className="text-right">CAC</TableHead>
                          <TableHead className="text-right">Ratio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ltvByCohort.map((cohort) => (
                          <TableRow key={cohort.cohort}>
                            <TableCell className="font-medium">{cohort.cohort}</TableCell>
                            <TableCell className="text-right">
                              {cohort.ltv == null ? '-' : formatCurrency(cohort.ltv)}
                            </TableCell>
                            <TableCell className="text-right">
                              {cohort.cac == null ? '-' : formatCurrency(cohort.cac)}
                            </TableCell>
                            <TableCell className="text-right">
                              {cohort.ratio == null ? (
                                // A cohort with no LTV or no CAC has no ratio; a
                                // "0.00:1" badge would read as a terrible one.
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <Badge
                                  variant={
                                    cohort.ratio >= 5
                                      ? 'default'
                                      : cohort.ratio >= 3
                                        ? 'secondary'
                                        : 'destructive'
                                  }
                                >
                                  {cohort.ratio.toFixed(2)}:1
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {summary.ltvToCacRatio != null && (
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <p className="text-sm">
                          {/*
                            This said "Your average ratio of 6.92:1 indicates
                            excellent unit economics" with the number typed in.
                            The benchmark is a general one and stays; the
                            comparison is against the measured average now.
                          */}
                          <strong>Benchmark:</strong> a healthy LTV:CAC ratio is 3:1 or higher.
                          Across the cohorts that report one, the average is{' '}
                          {summary.ltvToCacRatio.toFixed(2)}:1.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/*
              The "Key Insights & Recommendations" card that stood here is removed
              (PA-040). Three coloured panels of prose asserting measurements
              nothing takes - "CAC has decreased by 18% in recent cohorts while LTV
              has increased by 23%", followed by a recommendation to scale
              acquisition spend on the strength of it. Advice built on invented
              numbers is worse than the numbers alone, because it is what gets
              acted on.
            */}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
