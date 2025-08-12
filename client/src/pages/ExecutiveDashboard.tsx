import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart3, 
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Users,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  PieChart,
  MapPin,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Building,
  Zap,
  Star
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  ComposedChart
} from 'recharts';

// Executive data types
interface ExecutiveSummary {
  revenue: {
    total: number;
    growth: number;
    target: number;
    attainment: number;
  };
  sales: {
    pipelineValue: number;
    dealsWon: number;
    avgDealSize: number;
    closeRate: number;
    salesCycleTime: number;
  };
  service: {
    activeTickets: number;
    avgResponseTime: number;
    customerSatisfaction: number;
    firstCallResolution: number;
    technicianUtilization: number;
  };
  financial: {
    grossMargin: number;
    arBalance: number;
    collectionRate: number;
    daysOutstanding: number;
    cashFlow: number;
  };
  customers: {
    totalActive: number;
    newAcquisitions: number;
    churnRate: number;
    lifetimeValue: number;
    healthScore: number;
  };
}

interface KPIScorecard {
  category: string;
  kpis: KPI[];
}

interface KPI {
  name: string;
  current: number;
  target: number;
  benchmark: number;
  trend: number;
  unit: string;
  status: 'above' | 'at' | 'below';
  criticalSuccess: boolean;
}

interface BusinessInsight {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'opportunity' | 'risk' | 'performance';
  recommendation: string;
  expectedOutcome: string;
  priority: number;
}

interface CompetitiveMetric {
  metric: string;
  ourValue: number;
  industryAverage: number;
  topPerformer: number;
  ranking: number;
  totalCompetitors: number;
}

interface TerritoryPerformance {
  territory: string;
  manager: string;
  revenue: number;
  revenueGrowth: number;
  customerCount: number;
  marketShare: number;
  profitability: number;
  customerSatisfaction: number;
  reps: number;
  avgProductivity: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

export default function ExecutiveDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'30d' | '90d' | 'ytd' | '12m'>('ytd');
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed'>('overview');
  
  // Fetch executive summary
  const { data: executiveSummary } = useQuery<ExecutiveSummary>({
    queryKey: ['/api/reports/executive-summary', selectedPeriod],
    queryFn: () => apiRequest(`/api/reports/executive-summary?period=${selectedPeriod}`),
  });

  // Fetch KPI scorecards
  const { data: kpiScorecards = [] } = useQuery<KPIScorecard[]>({
    queryKey: ['/api/reports/kpi-scorecards', selectedPeriod],
    queryFn: () => apiRequest(`/api/reports/kpi-scorecards?period=${selectedPeriod}`),
  });

  // Fetch business insights
  const { data: businessInsights = [] } = useQuery<BusinessInsight[]>({
    queryKey: ['/api/reports/business-insights'],
    queryFn: () => apiRequest('/api/reports/business-insights'),
  });

  // Fetch competitive metrics
  const { data: competitiveMetrics = [] } = useQuery<CompetitiveMetric[]>({
    queryKey: ['/api/reports/competitive-metrics'],
    queryFn: () => apiRequest('/api/reports/competitive-metrics'),
  });

  // Fetch territory performance
  const { data: territoryPerformance = [] } = useQuery<TerritoryPerformance[]>({
    queryKey: ['/api/reports/territory-performance', selectedPeriod],
    queryFn: () => apiRequest(`/api/reports/territory-performance?period=${selectedPeriod}`),
  });

  // Fetch revenue attribution data
  const { data: revenueAttribution = [] } = useQuery({
    queryKey: ['/api/reports/revenue-attribution', selectedPeriod],
    queryFn: () => apiRequest(`/api/reports/revenue-attribution?period=${selectedPeriod}`),
  });

  // Helper functions
  const getKPIStatusColor = (status: string) => {
    switch (status) {
      case 'above': return 'text-green-600';
      case 'at': return 'text-blue-600';
      default: return 'text-red-600';
    }
  };

  const getKPIStatusIcon = (status: string) => {
    switch (status) {
      case 'above': return ArrowUp;
      case 'at': return Target;
      default: return ArrowDown;
    }
  };

  const getInsightIcon = (category: string) => {
    switch (category) {
      case 'opportunity': return TrendingUp;
      case 'risk': return AlertTriangle;
      default: return Activity;
    }
  };

  const getInsightColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <MainLayout
      title="Executive Dashboard"
      description="Strategic insights and cross-functional performance metrics"
    >
      <div className="space-y-6">
        {/* Filters and Controls */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="ytd">Year to date</SelectItem>
                    <SelectItem value="12m">Last 12 months</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overview">Overview</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critical Business Alerts */}
        {businessInsights.filter(insight => insight.impact === 'high').length > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Strategic Attention Required:</strong> {businessInsights.filter(insight => insight.impact === 'high').length} high-impact insights require executive review.
            </AlertDescription>
          </Alert>
        )}

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Revenue */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="h-8 w-8 text-green-600" />
                <Badge variant={
                  (executiveSummary?.revenue.attainment || 0) >= 100 ? 'default' : 
                  (executiveSummary?.revenue.attainment || 0) >= 85 ? 'secondary' : 
                  'destructive'
                }>
                  {executiveSummary?.revenue.attainment.toFixed(0) || 0}%
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">
                  ${executiveSummary?.revenue.total?.toLocaleString() || '0'}
                </p>
                <div className="flex items-center text-xs mt-1">
                  {(executiveSummary?.revenue.growth || 0) >= 0 ? 
                    <ArrowUp className="h-3 w-3 mr-1 text-green-600" /> :
                    <ArrowDown className="h-3 w-3 mr-1 text-red-600" />
                  }
                  <span className={(executiveSummary?.revenue.growth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {(executiveSummary?.revenue.growth || 0) >= 0 ? '+' : ''}{executiveSummary?.revenue.growth?.toFixed(1) || 0}%
                  </span>
                </div>
                <Progress value={executiveSummary?.revenue.attainment || 0} className="mt-2" />
              </div>
            </CardContent>
          </Card>

          {/* Sales Performance */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Target className="h-8 w-8 text-blue-600" />
                <Badge variant="outline">
                  {executiveSummary?.sales.closeRate.toFixed(1) || 0}%
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sales Pipeline</p>
                <p className="text-2xl font-bold">
                  ${executiveSummary?.sales.pipelineValue?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {executiveSummary?.sales.dealsWon || 0} deals won this period
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg cycle: {executiveSummary?.sales.salesCycleTime || 0} days
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Service Excellence */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Users className="h-8 w-8 text-purple-600" />
                <Badge variant={
                  (executiveSummary?.service.customerSatisfaction || 0) >= 4.5 ? 'default' :
                  (executiveSummary?.service.customerSatisfaction || 0) >= 4.0 ? 'secondary' :
                  'destructive'
                }>
                  {executiveSummary?.service.customerSatisfaction.toFixed(1) || 0}/5
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customer Satisfaction</p>
                <p className="text-2xl font-bold">
                  {executiveSummary?.service.firstCallResolution.toFixed(0) || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  First call resolution rate
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg response: {executiveSummary?.service.avgResponseTime.toFixed(1) || 0}h
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Financial Health */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <BarChart3 className="h-8 w-8 text-orange-600" />
                <Badge variant={
                  (executiveSummary?.financial.grossMargin || 0) >= 35 ? 'default' :
                  (executiveSummary?.financial.grossMargin || 0) >= 25 ? 'secondary' :
                  'destructive'
                }>
                  {executiveSummary?.financial.grossMargin.toFixed(1) || 0}%
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Margin</p>
                <p className="text-2xl font-bold">
                  {executiveSummary?.financial.collectionRate.toFixed(0) || 0}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Collection rate
                </p>
                <p className="text-xs text-muted-foreground">
                  DSO: {executiveSummary?.financial.daysOutstanding || 0} days
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Customer Growth */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Activity className="h-8 w-8 text-indigo-600" />
                <Badge variant={
                  (executiveSummary?.customers.churnRate || 0) <= 5 ? 'default' :
                  (executiveSummary?.customers.churnRate || 0) <= 10 ? 'secondary' :
                  'destructive'
                }>
                  {executiveSummary?.customers.churnRate.toFixed(1) || 0}%
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customer Churn</p>
                <p className="text-2xl font-bold">
                  {executiveSummary?.customers.totalActive?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Active customers
                </p>
                <p className="text-xs text-green-600">
                  +{executiveSummary?.customers.newAcquisitions || 0} new this period
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="insights" className="w-full">
          <TabsList>
            <TabsTrigger value="insights">Business Insights</TabsTrigger>
            <TabsTrigger value="scorecards">KPI Scorecards</TabsTrigger>
            <TabsTrigger value="competitive">Competitive Position</TabsTrigger>
            <TabsTrigger value="territories">Territory Performance</TabsTrigger>
            <TabsTrigger value="attribution">Revenue Attribution</TabsTrigger>
          </TabsList>

          {/* Business Insights */}
          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Strategic Insights</CardTitle>
                  <CardDescription>AI-powered business intelligence and recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {businessInsights
                      .sort((a, b) => b.priority - a.priority)
                      .map((insight, index) => {
                        const InsightIcon = getInsightIcon(insight.category);
                        return (
                          <div key={index} className={`p-4 rounded-lg border ${getInsightColor(insight.impact)}`}>
                            <div className="flex items-start space-x-3">
                              <div className="p-1 rounded">
                                <InsightIcon className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-medium">{insight.title}</h4>
                                  <Badge variant={
                                    insight.impact === 'high' ? 'destructive' :
                                    insight.impact === 'medium' ? 'secondary' :
                                    'outline'
                                  }>
                                    {insight.impact} impact
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {insight.description}
                                </p>
                                <div className="text-sm">
                                  <p className="font-medium text-blue-700">Recommendation:</p>
                                  <p className="text-blue-600 mb-2">{insight.recommendation}</p>
                                  <p className="font-medium text-green-700">Expected Outcome:</p>
                                  <p className="text-green-600">{insight.expectedOutcome}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Trends</CardTitle>
                  <CardDescription>Key metrics over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={revenueAttribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="revenue" stackId="1" stroke="#8884d8" fill="#8884d8" opacity={0.6} />
                      <Line type="monotone" dataKey="customerSatisfaction" stroke="#82ca9d" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* KPI Scorecards */}
          <TabsContent value="scorecards" className="space-y-6">
            {kpiScorecards.map((scorecard, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>{scorecard.category} Performance</CardTitle>
                  <CardDescription>Key performance indicators vs targets and benchmarks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scorecard.kpis.map((kpi, kpiIndex) => {
                      const StatusIcon = getKPIStatusIcon(kpi.status);
                      return (
                        <div key={kpiIndex} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">{kpi.name}</h4>
                            <div className="flex items-center">
                              <StatusIcon className={`h-4 w-4 mr-1 ${getKPIStatusColor(kpi.status)}`} />
                              {kpi.criticalSuccess && <Star className="h-4 w-4 text-yellow-500" />}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Current:</span>
                              <span className="font-medium">
                                {kpi.current}{kpi.unit}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Target:</span>
                              <span>{kpi.target}{kpi.unit}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Benchmark:</span>
                              <span>{kpi.benchmark}{kpi.unit}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Trend:</span>
                              <span className={kpi.trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {kpi.trend >= 0 ? '+' : ''}{kpi.trend.toFixed(1)}%
                              </span>
                            </div>
                            <Progress value={Math.min((kpi.current / kpi.target) * 100, 100)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Competitive Position */}
          <TabsContent value="competitive" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Market Position Analysis</CardTitle>
                <CardDescription>Performance vs industry benchmarks and competitors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {competitiveMetrics.map((metric, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{metric.metric}</h4>
                        <Badge variant={
                          metric.ranking <= metric.totalCompetitors * 0.3 ? 'default' :
                          metric.ranking <= metric.totalCompetitors * 0.7 ? 'secondary' :
                          'destructive'
                        }>
                          #{metric.ranking} of {metric.totalCompetitors}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-muted-foreground">Our Performance</p>
                          <p className="text-lg font-bold text-blue-600">{metric.ourValue}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Industry Average</p>
                          <p className="text-lg font-semibold">{metric.industryAverage}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Top Performer</p>
                          <p className="text-lg font-semibold text-green-600">{metric.topPerformer}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Gap to Leader</span>
                          <span>{((metric.topPerformer - metric.ourValue) / metric.topPerformer * 100).toFixed(1)}%</span>
                        </div>
                        <Progress 
                          value={Math.min((metric.ourValue / metric.topPerformer) * 100, 100)} 
                          className="h-2"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Territory Performance */}
          <TabsContent value="territories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Territory Performance Matrix</CardTitle>
                <CardDescription>Regional performance and market penetration analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {territoryPerformance.map((territory, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-medium">{territory.territory} Territory</h4>
                          <p className="text-sm text-muted-foreground">Manager: {territory.manager}</p>
                        </div>
                        <Badge variant={
                          territory.revenueGrowth >= 15 ? 'default' :
                          territory.revenueGrowth >= 5 ? 'secondary' :
                          'destructive'
                        }>
                          {territory.revenueGrowth >= 0 ? '+' : ''}{territory.revenueGrowth.toFixed(1)}% growth
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-semibold text-lg">${territory.revenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Customers</p>
                          <p className="font-semibold">{territory.customerCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Market Share</p>
                          <p className="font-semibold">{territory.marketShare.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Profitability</p>
                          <p className="font-semibold">{territory.profitability.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">CSAT</p>
                          <p className="font-semibold">{territory.customerSatisfaction.toFixed(1)}/5</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rep Productivity</p>
                          <p className="font-semibold">{territory.avgProductivity.toFixed(0)}%</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Revenue Progress</p>
                          <Progress value={Math.min(territory.revenueGrowth + 100, 100)} className="h-2" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Profitability</p>
                          <Progress value={territory.profitability} className="h-2" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Satisfaction</p>
                          <Progress value={territory.customerSatisfaction * 20} className="h-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Attribution */}
          <TabsContent value="attribution" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Attribution</CardTitle>
                  <CardDescription>Revenue sources and contribution analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <RechartsPieChart>
                      <Pie
                        data={revenueAttribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {revenueAttribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cross-Functional Impact</CardTitle>
                  <CardDescription>How each department contributes to overall success</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Sales Impact on Revenue</span>
                        <span className="font-bold">78%</span>
                      </div>
                      <Progress value={78} />
                      <p className="text-xs text-muted-foreground mt-1">
                        Direct sales contribution to total revenue growth
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Service Impact on Retention</span>
                        <span className="font-bold">85%</span>
                      </div>
                      <Progress value={85} />
                      <p className="text-xs text-muted-foreground mt-1">
                        Service quality correlation with customer retention
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Marketing Impact on Pipeline</span>
                        <span className="font-bold">62%</span>
                      </div>
                      <Progress value={62} />
                      <p className="text-xs text-muted-foreground mt-1">
                        Marketing-generated leads in sales pipeline
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}