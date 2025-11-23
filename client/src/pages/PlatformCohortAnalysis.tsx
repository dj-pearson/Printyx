import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import {
  Users,
  TrendingUp,
  DollarSign,
  Calendar,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Target,
  Activity,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  Cell,
} from 'recharts';

export default function PlatformCohortAnalysis() {
  const [cohortType, setCohortType] = useState('signup_month');
  const [metricType, setMetricType] = useState('retention');
  const [timeframe, setTimeframe] = useState('12m');

  // Fetch cohort data
  const { data: cohortData } = useQuery({
    queryKey: [
      `/api/platform-analytics/cohort-analysis?type=${cohortType}&metric=${metricType}&timeframe=${timeframe}`,
    ],
  });

  // Sample cohort retention data
  const cohortRetentionData = cohortData?.cohortTable || [
    {
      cohort: 'Jan 2024',
      month0: 100,
      month1: 88,
      month2: 82,
      month3: 76,
      month4: 72,
      month5: 68,
      month6: 65,
      size: 125,
    },
    {
      cohort: 'Feb 2024',
      month0: 100,
      month1: 91,
      month2: 85,
      month3: 79,
      month4: 75,
      month5: 71,
      month6: null,
      size: 142,
    },
    {
      cohort: 'Mar 2024',
      month0: 100,
      month1: 93,
      month2: 87,
      month3: 82,
      month4: 78,
      month5: null,
      month6: null,
      size: 158,
    },
    {
      cohort: 'Apr 2024',
      month0: 100,
      month1: 89,
      month2: 84,
      month3: 80,
      month4: null,
      month5: null,
      month6: null,
      size: 134,
    },
    {
      cohort: 'May 2024',
      month0: 100,
      month1: 92,
      month2: 86,
      month3: null,
      month4: null,
      month5: null,
      month6: null,
      size: 167,
    },
    {
      cohort: 'Jun 2024',
      month0: 100,
      month1: 94,
      month2: null,
      month3: null,
      month4: null,
      month5: null,
      month6: null,
      size: 189,
    },
  ];

  // Revenue cohort data
  const revenueCohortData = cohortData?.revenueCohorts || [
    {
      cohort: 'Jan 2024',
      month0: 15625,
      month1: 16500,
      month2: 17200,
      month3: 18100,
      month4: 18900,
    },
    {
      cohort: 'Feb 2024',
      month0: 17750,
      month1: 18900,
      month2: 19800,
      month3: 20500,
      month4: null,
    },
    { cohort: 'Mar 2024', month0: 19750, month1: 21200, month2: 22400, month3: null, month4: null },
    { cohort: 'Apr 2024', month0: 16750, month1: 18100, month2: null, month3: null, month4: null },
    { cohort: 'May 2024', month0: 20875, month1: null, month2: null, month3: null, month4: null },
  ];

  // Retention curve data
  const retentionCurveData = [
    { month: 'M0', rate: 100 },
    { month: 'M1', rate: 91.2 },
    { month: 'M2', rate: 84.8 },
    { month: 'M3', rate: 79.4 },
    { month: 'M4', rate: 75.8 },
    { month: 'M5', rate: 71.5 },
    { month: 'M6', rate: 68.3 },
    { month: 'M7', rate: 65.7 },
    { month: 'M8', rate: 63.2 },
    { month: 'M9', rate: 61.0 },
    { month: 'M10', rate: 59.1 },
    { month: 'M11', rate: 57.5 },
    { month: 'M12', rate: 56.2 },
  ];

  // LTV by cohort
  const ltvByCohort = cohortData?.ltvData || [
    { cohort: 'Jan 2024', ltv: 18432, cac: 3250, ratio: 5.67 },
    { cohort: 'Feb 2024', ltv: 19850, cac: 3100, ratio: 6.4 },
    { cohort: 'Mar 2024', ltv: 21200, cac: 2950, ratio: 7.19 },
    { cohort: 'Apr 2024', ltv: 17650, cac: 3400, ratio: 5.19 },
    { cohort: 'May 2024', ltv: 22400, cac: 2800, ratio: 8.0 },
    { cohort: 'Jun 2024', ltv: 24100, cac: 2650, ratio: 9.09 },
  ];

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
            <Select value={cohortType} onValueChange={setCohortType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="signup_month">By Signup Month</SelectItem>
                <SelectItem value="trial_start">By Trial Start</SelectItem>
                <SelectItem value="first_purchase">By First Purchase</SelectItem>
                <SelectItem value="plan_tier">By Plan Tier</SelectItem>
                <SelectItem value="lead_source">By Lead Source</SelectItem>
              </SelectContent>
            </Select>
            <Select value={metricType} onValueChange={setMetricType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retention">Retention %</SelectItem>
                <SelectItem value="revenue">Revenue $</SelectItem>
                <SelectItem value="customers">Customers #</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Avg. 3-Month Retention</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold mb-2">79.4%</div>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">3.2%</span>
              <span className="text-sm text-muted-foreground">vs. previous cohorts</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Avg. 12-Month Retention</p>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold mb-2">56.2%</div>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">4.8%</span>
              <span className="text-sm text-muted-foreground">vs. previous cohorts</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Avg. Customer LTV</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold mb-2">$20,605</div>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">11.8%</span>
              <span className="text-sm text-muted-foreground">vs. previous cohorts</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">LTV:CAC Ratio</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold mb-2">6.92:1</div>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">15.3%</span>
              <span className="text-sm text-muted-foreground">vs. previous cohorts</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Retention Curve */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Average Retention Curve</CardTitle>
          <CardDescription>Combined retention rate across all cohorts by month</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={retentionCurveData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
                name="Retention Rate"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Insight:</strong> Your retention curve shows strong performance in the first 6
              months (65%+ retention) with stabilization around month 12 (56% retention). This
              indicates good product-market fit and customer satisfaction.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cohort Retention Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cohort Retention Table</CardTitle>
          <CardDescription>Monthly retention percentages by signup cohort</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Cohort</TableHead>
                  <TableHead className="text-right w-24">Size</TableHead>
                  <TableHead className="text-center w-20">M0</TableHead>
                  <TableHead className="text-center w-20">M1</TableHead>
                  <TableHead className="text-center w-20">M2</TableHead>
                  <TableHead className="text-center w-20">M3</TableHead>
                  <TableHead className="text-center w-20">M4</TableHead>
                  <TableHead className="text-center w-20">M5</TableHead>
                  <TableHead className="text-center w-20">M6</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortRetentionData.map((cohort) => (
                  <TableRow key={cohort.cohort}>
                    <TableCell className="font-medium">{cohort.cohort}</TableCell>
                    <TableCell className="text-right">{cohort.size}</TableCell>
                    <TableCell className={`text-center font-medium ${getCellColor(cohort.month0)}`}>
                      {formatPercent(cohort.month0)}
                    </TableCell>
                    <TableCell className={`text-center font-medium ${getCellColor(cohort.month1)}`}>
                      {formatPercent(cohort.month1)}
                    </TableCell>
                    <TableCell className={`text-center font-medium ${getCellColor(cohort.month2)}`}>
                      {formatPercent(cohort.month2)}
                    </TableCell>
                    <TableCell className={`text-center font-medium ${getCellColor(cohort.month3)}`}>
                      {formatPercent(cohort.month3)}
                    </TableCell>
                    <TableCell className={`text-center font-medium ${getCellColor(cohort.month4)}`}>
                      {formatPercent(cohort.month4)}
                    </TableCell>
                    <TableCell className={`text-center font-medium ${getCellColor(cohort.month5)}`}>
                      {formatPercent(cohort.month5)}
                    </TableCell>
                    <TableCell className={`text-center font-medium ${getCellColor(cohort.month6)}`}>
                      {formatPercent(cohort.month6)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded" />
              <span className="text-muted-foreground">≥90%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-50 rounded" />
              <span className="text-muted-foreground">80-89%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-50 rounded" />
              <span className="text-muted-foreground">70-79%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-50 rounded" />
              <span className="text-muted-foreground">60-69%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-50 rounded" />
              <span className="text-muted-foreground">&lt;60%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Cohort Analysis */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Revenue by Cohort</CardTitle>
          <CardDescription>Monthly recurring revenue progression by cohort</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" type="category" allowDuplicatedCategory={false} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              {revenueCohortData.map((cohort, index) => (
                <Line
                  key={cohort.cohort}
                  data={[
                    { month: 'M0', value: cohort.month0 },
                    { month: 'M1', value: cohort.month1 },
                    { month: 'M2', value: cohort.month2 },
                    { month: 'M3', value: cohort.month3 },
                    { month: 'M4', value: cohort.month4 },
                  ].filter((d) => d.value !== null)}
                  type="monotone"
                  dataKey="value"
                  name={cohort.cohort}
                  stroke={`hsl(${index * 60}, 70%, 50%)`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
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
                    <TableCell className="text-right">{formatCurrency(cohort.ltv)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cohort.cac)}</TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-900">
                <strong>Benchmark:</strong> A healthy LTV:CAC ratio is 3:1 or higher. Your average
                ratio of 6.92:1 indicates excellent unit economics and efficient customer
                acquisition.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Key Insights & Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-900 mb-1">Strong Retention Improvement</p>
                <p className="text-sm text-green-800">
                  Recent cohorts (May-Jun 2024) show 4-6% better retention rates compared to earlier
                  cohorts. Continue focusing on the initiatives that are driving this improvement.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-blue-900 mb-1">Revenue Expansion Opportunity</p>
                <p className="text-sm text-blue-800">
                  Newer cohorts show 12-15% higher revenue per customer in the first 3 months.
                  Identify what's driving this and apply learnings to older cohorts through upsell
                  campaigns.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <Activity className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-yellow-900 mb-1">Focus on Month 3-6 Retention</p>
                <p className="text-sm text-yellow-800">
                  The biggest retention drop occurs between months 3-6 (average 7-9% decline).
                  Implement targeted engagement campaigns during this critical period to reduce
                  churn.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Target className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-purple-900 mb-1">CAC Efficiency Gains</p>
                <p className="text-sm text-purple-800">
                  CAC has decreased by 18% in recent cohorts while LTV has increased by 23%. Your
                  go-to-market efficiency is improving significantly - consider scaling acquisition
                  spend.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
