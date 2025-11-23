import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Activity,
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Clock,
  Briefcase,
  Heart,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
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

export default function PlatformAnalytics() {
  const [timeframe, setTimeframe] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch analytics data
  const { data: revenueMetrics } = useQuery({
    queryKey: [`/api/platform-analytics/revenue-metrics?timeframe=${timeframe}`],
  });

  const { data: conversionMetrics } = useQuery({
    queryKey: [`/api/platform-analytics/conversion-metrics?timeframe=${timeframe}`],
  });

  const { data: pipelineMetrics } = useQuery({
    queryKey: [`/api/platform-analytics/pipeline-metrics?timeframe=${timeframe}`],
  });

  const { data: performanceMetrics } = useQuery({
    queryKey: [`/api/platform-analytics/performance-metrics?timeframe=${timeframe}`],
  });

  const { data: growthTrends } = useQuery({
    queryKey: [`/api/platform-analytics/growth-trends?timeframe=${timeframe}`],
  });

  // Sample data for charts (replace with actual data from API)
  const revenueData = growthTrends?.revenueData || [
    { month: 'Jan', mrr: 45000, arr: 540000, new: 12000, expansion: 5000, churn: 2000 },
    { month: 'Feb', mrr: 52000, arr: 624000, new: 15000, expansion: 6000, churn: 1000 },
    { month: 'Mar', mrr: 61000, arr: 732000, new: 18000, expansion: 7000, churn: 1500 },
    { month: 'Apr', mrr: 68000, arr: 816000, new: 20000, expansion: 8000, churn: 2000 },
    { month: 'May', mrr: 78000, arr: 936000, new: 22000, expansion: 9000, churn: 1000 },
    { month: 'Jun', mrr: 89000, arr: 1068000, new: 25000, expansion: 10000, churn: 1500 },
  ];

  const conversionFunnelData = conversionMetrics?.funnelData || [
    { stage: 'Prospects', count: 1250, percentage: 100 },
    { stage: 'Contacted', count: 875, percentage: 70 },
    { stage: 'Qualified', count: 500, percentage: 40 },
    { stage: 'Proposal Sent', count: 300, percentage: 24 },
    { stage: 'Negotiation', count: 175, percentage: 14 },
    { stage: 'Won', count: 125, percentage: 10 },
  ];

  const pipelineDistributionData = pipelineMetrics?.distributionData || [
    { name: 'Prospecting', value: 125, color: '#3b82f6' },
    { name: 'Qualification', value: 89, color: '#8b5cf6' },
    { name: 'Proposal', value: 64, color: '#ec4899' },
    { name: 'Negotiation', value: 42, color: '#f59e0b' },
    { name: 'Closing', value: 28, color: '#10b981' },
  ];

  const leadSourceData = performanceMetrics?.sourceData || [
    { source: 'Website', leads: 450, conversions: 68, rate: 15.1 },
    { source: 'Referrals', leads: 320, conversions: 89, rate: 27.8 },
    { source: 'Events', leads: 210, conversions: 42, rate: 20.0 },
    { source: 'Paid Ads', leads: 180, conversions: 27, rate: 15.0 },
    { source: 'Partners', leads: 90, conversions: 23, rate: 25.6 },
  ];

  const getPercentageChange = (current: number, previous: number) => {
    if (!previous) return 0;
    return (((current - previous) / previous) * 100).toFixed(1);
  };

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

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Monthly Recurring Revenue"
          value={formatCurrency(revenueMetrics?.mrr || 89000)}
          change={revenueMetrics?.mrrGrowth || 14.1}
          icon={DollarSign}
          trend="up"
        />
        <MetricCard
          title="Annual Recurring Revenue"
          value={formatCurrency(revenueMetrics?.arr || 1068000)}
          change={revenueMetrics?.arrGrowth || 16.4}
          icon={TrendingUp}
          trend="up"
        />
        <MetricCard
          title="Active Tenants"
          value={String(revenueMetrics?.activeTenants || 347)}
          change={revenueMetrics?.tenantGrowth || 8.7}
          icon={Users}
          trend="up"
        />
        <MetricCard
          title="Net Revenue Retention"
          value={formatPercent(revenueMetrics?.nrr || 112)}
          change={revenueMetrics?.nrrChange || 2.3}
          icon={Percent}
          trend="up"
        />
      </div>

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
                  {pipelineMetrics?.avgSalesCycle || 32} days
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  <span className="text-green-600 font-medium">-8% </span>
                  vs. last period
                </p>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Improving</span>
                </div>
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
                  {formatPercent(pipelineMetrics?.winRate || 35.7)}
                </div>
                <p className="text-sm text-muted-foreground mb-4">125 won of 350 closed deals</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">+4.2% vs. last period</span>
                </div>
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
                <RevenueMetricRow
                  label="Gross Revenue Retention"
                  value={formatPercent(revenueMetrics?.grr || 95.3)}
                  change={1.2}
                  trend="up"
                />
                <RevenueMetricRow
                  label="Net Revenue Retention"
                  value={formatPercent(revenueMetrics?.nrr || 112.4)}
                  change={2.8}
                  trend="up"
                />
                <RevenueMetricRow
                  label="Average Revenue Per Account"
                  value={formatCurrency(revenueMetrics?.arpa || 256)}
                  change={5.4}
                  trend="up"
                />
                <RevenueMetricRow
                  label="Customer Lifetime Value"
                  value={formatCurrency(revenueMetrics?.ltv || 18432)}
                  change={8.1}
                  trend="up"
                />
                <RevenueMetricRow
                  label="Customer Acquisition Cost"
                  value={formatCurrency(revenueMetrics?.cac || 3250)}
                  change={-3.2}
                  trend="down"
                />
                <RevenueMetricRow
                  label="LTV:CAC Ratio"
                  value={`${(revenueMetrics?.ltvCacRatio || 5.67).toFixed(2)}:1`}
                  change={11.3}
                  trend="up"
                />
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
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Gross Churn Rate</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatPercent(revenueMetrics?.churnRate || 4.7)}
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Net Churn Rate</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatPercent(revenueMetrics?.netChurnRate || -2.4)}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Churned Customers</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {revenueMetrics?.churnedCustomers || 16}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Churn MRR</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(revenueMetrics?.churnMrr || 4200)}
                  </p>
                </div>
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
                  <ActivityMetricRow type="Calls" count={1450} avgPerDay={48} icon="phone" />
                  <ActivityMetricRow type="Emails" count={2340} avgPerDay={78} icon="mail" />
                  <ActivityMetricRow type="Meetings" count={687} avgPerDay={23} icon="users" />
                  <ActivityMetricRow type="Demos" count={234} avgPerDay={8} icon="video" />
                  <ActivityMetricRow type="Proposals" count={156} avgPerDay={5} icon="file" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  change: number;
  icon: any;
  trend: 'up' | 'down';
}) {
  const isPositive = trend === 'up' ? change > 0 : change < 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold mb-2">{value}</div>
        <div className="flex items-center gap-1">
          {isPositive ? (
            <ArrowUpRight className="h-4 w-4 text-green-600" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          )}
          <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {Math.abs(change)}%
          </span>
          <span className="text-sm text-muted-foreground">vs. last period</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Revenue Metric Row Component
function RevenueMetricRow({
  label,
  value,
  change,
  trend,
}: {
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down';
}) {
  const isPositive = trend === 'up' ? change > 0 : change < 0;

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold">{value}</span>
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="h-3 w-3 text-green-600" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-600" />
          )}
          <span className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {Math.abs(change)}%
          </span>
        </div>
      </div>
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
  icon,
}: {
  type: string;
  count: number;
  avgPerDay: number;
  icon: string;
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
