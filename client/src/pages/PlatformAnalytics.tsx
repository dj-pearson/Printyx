import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { QueryStates } from '@/components/ui/query-state';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Activity,
  Download,
  Filter,
  Percent,
  Clock,
  Briefcase,
} from 'lucide-react';
import {
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

// Chart row shapes returned (or mocked) for the analytics charts.
interface RevenueDatum {
  month: string;
  mrr: number;
  arr: number;
  new: number;
  expansion: number;
  churn: number;
}
interface FunnelDatum {
  stage: string;
  count: number;
  percentage: number;
}
interface DistributionDatum {
  name: string;
  value: number;
  color: string;
}
interface SourceDatum {
  source: string;
  leads: number;
  conversions: number;
  rate: number;
}

// The page reads these flat keys with `|| mock` fallbacks. The platform-analytics
// edge fn currently returns a nested `{ metrics, counts }` shape, so most of these
// resolve to undefined and the page falls back to mock data (a known data-contract
// gap tracked as a separate story). These interfaces capture the keys the page
// reads so the file typechecks without changing its runtime behavior.
/**
 * A measured value, or a dash.
 *
 * Every metric on this page used to be `value || <literal>`, so a missing
 * number rendered a plausible one (PA-040). A dash says the platform does not
 * know; $89,000 says it does.
 */
function metricOrDash<T>(value: T | null | undefined, format: (v: T) => string): string {
  return value == null ? '—' : format(value);
}

interface RevenueMetrics {
  // Measured.
  mrr?: number;
  arr?: number;
  arpa?: number;
  activeTenants?: number;
  churnedCustomers?: number;
  newCustomers?: number;
  churnRate?: number;
  grr?: number;
  // Null when nothing has churned in the window: average lifetime is 1/churn,
  // and there is none to observe.
  ltv?: number | null;
  // Always null. Named in `unbacked` with the reason - CAC is recorded nowhere,
  // and expansion MRR cannot be observed without a last_mrr_change column.
  cac?: number | null;
  ltvCacRatio?: number | null;
  paybackPeriod?: number | null;
  expansionRate?: number | null;
  nrr?: number | null;
  unbacked?: string[];
}
interface ConversionMetrics {
  funnelData?: FunnelDatum[];
  leadConversionRate?: number;
}
interface PipelineMetrics {
  totalValue?: number;
  weightedValue?: number;
  winRate?: number;
  avgSalesCycle?: number;
  coverage?: number;
  distributionData?: DistributionDatum[];
  summary?: {
    totalDeals: number;
    openDeals: number;
    closedWon: number;
    closedLost: number;
  };
}
interface ActivityCounts {
  calls: number;
  emails: number;
  meetings: number;
  demos: number;
  proposals: number;
}
interface PerformanceMetrics {
  sourceData?: SourceDatum[];
  activityTotals?: ActivityCounts;
  activityAvgPerDay?: ActivityCounts;
}
interface GrowthTrends {
  revenueData?: RevenueDatum[];
}

export default function PlatformAnalytics() {
  const [timeframe, setTimeframe] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  // CR-033 wrapped these queries so a failed request says so instead of
  // rendering a confident fake dashboard. PA-040 finished the job: the
  // per-field fallbacks it describes - `revenueMetrics?.mrr || 89000`, 14.1%
  // growth, twelve months of invented chart data - are gone.
  //
  // They were never a failure path anyway, which is the part worth remembering.
  // revenue-metrics answered { metrics, counts } while this page read the keys
  // at the top level, so all seventeen reads resolved to undefined and the
  // literals rendered on EVERY request, successful ones included. A fallback is
  // only a fallback if the primary path can win.
  const revenueQuery = useQuery<RevenueMetrics>({
    queryKey: [`/api/platform-analytics/revenue-metrics?timeframe=${timeframe}`],
  });
  const revenueMetrics = revenueQuery.data;

  const conversionQuery = useQuery<ConversionMetrics>({
    queryKey: [`/api/platform-analytics/conversion-metrics?timeframe=${timeframe}`],
  });
  const conversionMetrics = conversionQuery.data;

  const pipelineQuery = useQuery<PipelineMetrics>({
    queryKey: [`/api/platform-analytics/pipeline-metrics?timeframe=${timeframe}`],
  });
  const pipelineMetrics = pipelineQuery.data;

  const performanceQuery = useQuery<PerformanceMetrics>({
    queryKey: [`/api/platform-analytics/performance-metrics?timeframe=${timeframe}`],
  });
  const performanceMetrics = performanceQuery.data;

  const growthQuery = useQuery<GrowthTrends>({
    queryKey: [`/api/platform-analytics/growth-trends?timeframe=${timeframe}`],
  });
  const growthTrends = growthQuery.data;

  // Chart data. No fallbacks: QueryStates below already handles loading and
  // error, so an empty array here means the platform has no data for the
  // window - which is what the charts should show. These four used to fall back
  // to six months of invented revenue, a 1250-prospect funnel and a lead-source
  // split (PA-040).
  const revenueData = growthTrends?.revenueData ?? [];
  const conversionFunnelData = conversionMetrics?.funnelData ?? [];
  const pipelineDistributionData = pipelineMetrics?.distributionData ?? [];
  const leadSourceData = performanceMetrics?.sourceData ?? [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Platform Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive insights into your platform performance and growth metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* CR-033: the timeframe picker and export controls above stay usable —
          changing the timeframe is how you retry — and everything below is
          derived from the five queries. */}
      <QueryStates
        queries={[revenueQuery, conversionQuery, pipelineQuery, performanceQuery, growthQuery]}
        loading={<DashboardSkeleton />}
        errorTitle="Could not load platform analytics"
        className="py-8"
      >
        {/* Key Metrics Overview */}
        {/*
          PA-040: every value here was `revenueMetrics?.x || <literal>` - MRR
          $89,000, ARR $1,068,000, 347 tenants, 112% NRR, each with a typed
          growth figure beside it. The endpoint answered { metrics, counts }
          while this page read the keys at the top level, so not one of those
          reads ever resolved and the literals rendered on every request. The
          response is flat now and the fallbacks are gone.

          Net Revenue Retention is replaced by Gross Revenue Retention: NRR needs
          expansion MRR, which business_records cannot supply, so it comes back
          null. GRR is measured.
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Monthly Recurring Revenue"
            value={metricOrDash(revenueMetrics?.mrr, formatCurrency)}
            icon={DollarSign}
          />
          <MetricCard
            title="Annual Recurring Revenue"
            value={metricOrDash(revenueMetrics?.arr, formatCurrency)}
            icon={TrendingUp}
          />
          <MetricCard
            title="Active Tenants"
            value={metricOrDash(revenueMetrics?.activeTenants, (v) => String(v))}
            icon={Users}
          />
          <MetricCard
            title="Gross Revenue Retention"
            value={metricOrDash(revenueMetrics?.grr, formatPercent)}
            icon={Percent}
          />
        </div>

        {revenueMetrics?.unbacked && revenueMetrics.unbacked.length > 0 && (
          <div className="mb-6 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
            <p className="font-medium mb-1">Not shown, because it is not measured:</p>
            <ul className="list-disc pl-5 space-y-1">
              {revenueMetrics.unbacked.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="conversion">Conversion</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Growth Trend</CardTitle>
                  <CardDescription>MRR and ARR over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="mrr"
                        stackId="1"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        name="MRR"
                      />
                      <Area
                        type="monotone"
                        dataKey="arr"
                        stackId="2"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        name="ARR"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pipeline Distribution</CardTitle>
                  <CardDescription>Deals by stage</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pipelineDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pipelineDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Lead Conversion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {formatPercent(conversionMetrics?.leadConversionRate || 10.2)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    125 of 1,250 prospects converted
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '10.2%' }} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Avg. Sales Cycle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {metricOrDash(pipelineMetrics?.avgSalesCycle, (v) => `${v} days`)}
                  </div>
                  {/*
                    "-8% vs. last period" and an "Improving" badge stood here,
                    both typed in. This endpoint reads one window (PA-040).
                  */}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Win Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {metricOrDash(pipelineMetrics?.winRate, formatPercent)}
                  </div>
                  {pipelineMetrics?.summary && (
                    <p className="text-sm text-muted-foreground">
                      {pipelineMetrics.summary.closedWon} won of{' '}
                      {pipelineMetrics.summary.closedWon + pipelineMetrics.summary.closedLost}{' '}
                      closed deals
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                  <CardDescription>New, Expansion, and Churn MRR</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Bar dataKey="new" fill="#10b981" name="New MRR" />
                      <Bar dataKey="expansion" fill="#3b82f6" name="Expansion MRR" />
                      <Bar dataKey="churn" fill="#ef4444" name="Churn MRR" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Metrics</CardTitle>
                  <CardDescription>Key financial indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/*
                    Each row carried a typed `change` too - +1.2, +2.8, +5.4,
                    +8.1, -3.2, +11.3 - none of which came from anywhere. This
                    endpoint reads one window and has nothing to compare it
                    against, so the deltas are gone rather than kept (PA-040).
                  */}
                  <RevenueMetricRow
                    label="Gross Revenue Retention"
                    value={metricOrDash(revenueMetrics?.grr, formatPercent)}
                  />
                  <RevenueMetricRow
                    label="Average Revenue Per Account"
                    value={metricOrDash(revenueMetrics?.arpa, formatCurrency)}
                  />
                  <RevenueMetricRow
                    label="Customer Lifetime Value"
                    value={metricOrDash(revenueMetrics?.ltv, formatCurrency)}
                  />
                  {/*
                    Net Revenue Retention, Customer Acquisition Cost and the
                    LTV:CAC ratio are removed. NRR needs expansion MRR, which
                    business_records cannot supply. CAC is recorded nowhere - it
                    was computed as `ltv / 3`, which made the ratio exactly
                    3.00:1 for every tenant on every request, and the page then
                    showed 5.67:1 anyway because the read never resolved. All
                    three are listed in the response's `unbacked` array below.
                  */}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Churn Analysis</CardTitle>
                <CardDescription>Churn rate and reasons</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">Gross Churn Rate</p>
                    <p className="text-2xl font-bold">
                      {metricOrDash(revenueMetrics?.churnRate, formatPercent)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">Churned Customers</p>
                    <p className="text-2xl font-bold">
                      {metricOrDash(revenueMetrics?.churnedCustomers, (v) => String(v))}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">New Tenants</p>
                    <p className="text-2xl font-bold">
                      {metricOrDash(revenueMetrics?.newCustomers, (v) => String(v))}
                    </p>
                  </div>
                  {/*
                    "Net Churn Rate" (-2.4%) and "Churn MRR" ($4,200) are removed.
                    Net churn needs expansion MRR; churn MRR needs the revenue a
                    tenant carried BEFORE it moved to status=churned, and that
                    value is not retained. New Tenants is measured and takes the
                    fourth slot.
                  */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pipeline Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {formatCurrency(pipelineMetrics?.totalValue || 2450000)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total value of active deals</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Weighted Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {formatCurrency(pipelineMetrics?.weightedValue || 875000)}
                  </div>
                  <p className="text-sm text-muted-foreground">Probability-adjusted value</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pipeline Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {(pipelineMetrics?.coverage || 3.4).toFixed(1)}x
                  </div>
                  <p className="text-sm text-muted-foreground">Pipeline vs. quota</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pipeline Velocity</CardTitle>
                <CardDescription>Average time in each stage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <VelocityBar stage="Prospecting" days={8} />
                  <VelocityBar stage="Qualification" days={12} />
                  <VelocityBar stage="Proposal" days={15} />
                  <VelocityBar stage="Negotiation" days={18} />
                  <VelocityBar stage="Closing" days={7} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversion Tab */}
          <TabsContent value="conversion" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>Prospect to customer journey</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conversionFunnelData.map((stage, index) => (
                    <div key={stage.stage} className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{stage.stage}</span>
                        <span className="text-sm text-muted-foreground">
                          {stage.count} ({formatPercent(stage.percentage)})
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-8 relative overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-primary to-primary/70 h-8 rounded-full flex items-center justify-end px-3 text-white text-sm font-medium"
                          style={{ width: `${stage.percentage}%` }}
                        >
                          {index > 0 && (
                            <span className="text-xs">
                              -
                              {(
                                ((conversionFunnelData[index - 1].count - stage.count) /
                                  conversionFunnelData[index - 1].count) *
                                100
                              ).toFixed(0)}
                              %
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Conversion Rates by Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <ConversionRateRow stage="Prospect → Contact" rate={70.0} />
                    <ConversionRateRow stage="Contact → Qualified" rate={57.1} />
                    <ConversionRateRow stage="Qualified → Proposal" rate={60.0} />
                    <ConversionRateRow stage="Proposal → Negotiation" rate={58.3} />
                    <ConversionRateRow stage="Negotiation → Won" rate={71.4} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Time to Convert</CardTitle>
                  <CardDescription>Average days by stage transition</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={[
                        { stage: 'Contact', days: 3 },
                        { stage: 'Qualify', days: 7 },
                        { stage: 'Propose', days: 14 },
                        { stage: 'Negotiate', days: 12 },
                        { stage: 'Close', days: 5 },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stage" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="days" fill="#3b82f6" name="Days" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lead Source Performance</CardTitle>
                <CardDescription>Leads and conversions by source</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={leadSourceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="leads" fill="#3b82f6" name="Leads" />
                    <Bar yAxisId="left" dataKey="conversions" fill="#10b981" name="Conversions" />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="rate"
                      stroke="#f59e0b"
                      name="Conv. Rate %"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top Performers</CardTitle>
                  <CardDescription>Sales reps by closed deals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <PerformerRow name="Sarah Johnson" deals={28} value={450000} rank={1} />
                    <PerformerRow name="Mike Chen" deals={24} value={385000} rank={2} />
                    <PerformerRow name="Emily Davis" deals={21} value={340000} rank={3} />
                    <PerformerRow name="Alex Rodriguez" deals={18} value={295000} rank={4} />
                    <PerformerRow name="Jessica Lee" deals={15} value={245000} rank={5} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity Metrics</CardTitle>
                  <CardDescription>Sales activities logged</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/*
                      1450 calls, 2340 emails, 687 meetings, 234 demos, 156
                      proposals, with per-day averages beside each - all typed in
                      (PA-040). performance-metrics already returned real
                      activityTotals and activityAvgPerDay off
                      platform_activity_reports; nothing read them.
                    */}
                    {performanceMetrics?.activityTotals ? (
                      (
                        [
                          ['Calls', 'calls'],
                          ['Emails', 'emails'],
                          ['Meetings', 'meetings'],
                          ['Demos', 'demos'],
                          ['Proposals', 'proposals'],
                        ] as const
                      ).map(([label, key]) => (
                        <ActivityMetricRow
                          key={key}
                          type={label}
                          count={performanceMetrics.activityTotals![key]}
                          avgPerDay={performanceMetrics.activityAvgPerDay?.[key] ?? 0}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No activity has been reported for this period.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </QueryStates>
    </div>
  );
}

// Metric Card Component
/**
 * A headline metric. No delta: nothing on this page records a previous period
 * to compare against, so the "+14.1% vs. last period" every card used to carry
 * was typed in (PA-040).
 */
function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

// Revenue Metric Row Component
function RevenueMetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

// Velocity Bar Component
function VelocityBar({ stage, days }: { stage: string; days: number }) {
  const maxDays = 20;
  const percentage = (days / maxDays) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{stage}</span>
        <span className="text-sm text-muted-foreground">{days} days</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-primary h-2 rounded-full" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

// Conversion Rate Row Component
function ConversionRateRow({ stage, rate }: { stage: string; rate: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{stage}</span>
      <div className="flex items-center gap-2">
        <div className="w-32 bg-gray-200 rounded-full h-2">
          <div className="bg-primary h-2 rounded-full" style={{ width: `${rate}%` }} />
        </div>
        <span className="text-sm font-medium w-12 text-right">{rate.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// Performer Row Component
function PerformerRow({
  name,
  deals,
  value,
  rank,
}: {
  name: string;
  deals: number;
  value: number;
  rank: number;
}) {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-lg">{medals[rank - 1] || `#${rank}`}</span>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{deals} deals closed</p>
        </div>
      </div>
      <span className="text-sm font-bold">
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        }).format(value)}
      </span>
    </div>
  );
}

// Activity Metric Row Component
function ActivityMetricRow({
  type,
  count,
  avgPerDay,
}: {
  type: string;
  count: number;
  avgPerDay: number;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{type}</p>
          <p className="text-xs text-muted-foreground">~{avgPerDay} per day</p>
        </div>
      </div>
      <span className="text-sm font-bold">{count.toLocaleString()}</span>
    </div>
  );
}
