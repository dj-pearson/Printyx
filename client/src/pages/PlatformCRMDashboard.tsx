import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  BarChart3,
  PieChart,
  LineChart,
  RefreshCw,
  Plus,
  Filter,
  Download,
  ArrowRight,
  Sparkles,
  Zap,
  Heart,
  AlertCircle,
  UserPlus
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import MainLayout from "@/components/layout/main-layout";
import { useLocation } from "wouter";

interface ExecutiveMetrics {
  totalProspects: number;
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  totalMRR: number;
  totalARR: number;
  conversionRate: number;
  churnRate: number;
  avgDealSize: number;
  avgTimeToClose: number;
}

interface PipelineMetrics {
  stage: string;
  count: number;
  totalValue: number;
  weightedValue: number;
  probability: number;
}

interface RecentActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'demo' | 'note';
  businessRecordName: string;
  subject: string;
  createdAt: string;
  createdBy: string;
}

interface HealthSummary {
  healthy: number;
  at_risk: number;
  critical: number;
  totalScore: number;
}

interface TopPerformer {
  repName: string;
  dealsWon: number;
  revenue: number;
  conversionRate: number;
}

export default function PlatformCRMDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [timeRange, setTimeRange] = useState("30d");

  // Fetch executive metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<ExecutiveMetrics>({
    queryKey: ["/api/platform-analytics/revenue-metrics", { timeRange }],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch pipeline data
  const { data: pipeline, isLoading: pipelineLoading } = useQuery<{ pipeline: PipelineMetrics[] }>({
    queryKey: ["/api/platform-deals/pipeline"],
    refetchInterval: 30000,
  });

  // Fetch recent activities
  const { data: recentActivities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/platform-activities", { limit: 10, sortBy: "activityDate", sortOrder: "desc" }],
    refetchInterval: 30000,
  });

  // Fetch health summary
  const { data: healthSummary, isLoading: healthLoading } = useQuery<{ summary: HealthSummary }>({
    queryKey: ["/api/platform-analytics/health-trends"],
    refetchInterval: 60000,
  });

  // Fetch conversion funnel
  const { data: funnelData, isLoading: funnelLoading } = useQuery({
    queryKey: ["/api/platform-analytics/conversion-funnel", { timeRange }],
    refetchInterval: 60000,
  });

  // Fetch sales performance
  const { data: performance, isLoading: performanceLoading } = useQuery({
    queryKey: ["/api/platform-analytics/sales-performance", { timeRange }],
    refetchInterval: 60000,
  });

  // Loading state
  if (metricsLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading Platform CRM Dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const defaultMetrics: ExecutiveMetrics = {
    totalProspects: 0,
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    totalMRR: 0,
    totalARR: 0,
    conversionRate: 0,
    churnRate: 0,
    avgDealSize: 0,
    avgTimeToClose: 0
  };

  const currentMetrics = metrics || defaultMetrics;
  const currentPipeline = pipeline?.pipeline || [];
  const currentActivities = recentActivities || [];
  const currentHealth = healthSummary?.summary || { healthy: 0, at_risk: 0, critical: 0, totalScore: 0 };
  const topPerformers = (performance as any)?.repPerformance?.slice(0, 5) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'meeting': return <Calendar className="w-4 h-4" />;
      case 'demo': return <Briefcase className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'at_risk': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="w-8 h-8 text-primary" />
              Platform CRM
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage prospects, tenants, and platform growth
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="1y">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setLocation('/platform-crm/business-records')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Prospect
            </Button>
          </div>
        </div>

        {/* Executive Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Prospects</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentMetrics.totalProspects.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Active prospects in pipeline
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentMetrics.activeTenants.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {currentMetrics.trialTenants} in trial
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(currentMetrics.totalMRR)}</div>
              <p className="text-xs text-muted-foreground">
                ARR: {formatCurrency(currentMetrics.totalARR)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercentage(currentMetrics.conversionRate)}</div>
              <p className="text-xs text-muted-foreground">
                Prospect to customer
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="health">Customer Health</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Sales Pipeline Summary */}
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Sales Pipeline
                  </CardTitle>
                  <CardDescription>Deals by stage with weighted values</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentPipeline.map((stage) => (
                      <div key={stage.stage} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium capitalize">{stage.stage.replace(/_/g, ' ')}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">{stage.count} deals</span>
                            <span className="font-semibold">{formatCurrency(stage.weightedValue)}</span>
                          </div>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${stage.probability}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <span className="text-sm font-medium">Total Pipeline Value</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(currentPipeline.reduce((sum, s) => sum + s.totalValue, 0))}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => setLocation('/platform-crm/pipeline')}
                  >
                    View Full Pipeline
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Key Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Avg Deal Size</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(currentMetrics.avgDealSize)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Avg Time to Close</span>
                    </div>
                    <span className="font-semibold">{currentMetrics.avgTimeToClose} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Churn Rate</span>
                    </div>
                    <span className="font-semibold">{formatPercentage(currentMetrics.churnRate)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Healthy Customers</span>
                    </div>
                    <span className="font-semibold text-green-600">{currentHealth.healthy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm">At Risk</span>
                    </div>
                    <span className="font-semibold text-yellow-600">{currentHealth.at_risk}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm">Critical</span>
                    </div>
                    <span className="font-semibold text-red-600">{currentHealth.critical}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Activities
                </CardTitle>
                <CardDescription>Latest interactions with prospects and customers</CardDescription>
              </CardHeader>
              <CardContent>
                {currentActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No recent activities</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentActivities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="mt-1">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">{activity.businessRecordName}</p>
                              <p className="text-sm text-muted-foreground truncate">{activity.subject}</p>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {activity.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })} by {activity.createdBy}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setLocation('/platform-crm/activities')}
                >
                  View All Activities
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Deal Pipeline Overview</CardTitle>
                <CardDescription>Track deals through your sales process</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <PieChart className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="mb-4">Full pipeline visualization coming soon</p>
                  <Button onClick={() => setLocation('/platform-crm/pipeline')}>
                    Go to Pipeline
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Healthy</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{currentHealth.healthy}</div>
                  <p className="text-xs text-muted-foreground">Score: 75-100</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">At Risk</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{currentHealth.at_risk}</div>
                  <p className="text-xs text-muted-foreground">Score: 50-74</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Critical</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{currentHealth.critical}</div>
                  <p className="text-xs text-muted-foreground">Score: 0-49</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Customer Health Monitoring</CardTitle>
                <CardDescription>Proactive customer success management</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="mb-4">Detailed health score analysis</p>
                  <Button onClick={() => setLocation('/platform-crm/customer-success')}>
                    View Customer Health
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Top Performers
                </CardTitle>
                <CardDescription>Sales team leaderboard for {timeRange}</CardDescription>
              </CardHeader>
              <CardContent>
                {topPerformers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>No performance data available</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rep</TableHead>
                        <TableHead className="text-right">Deals Won</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Conversion %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topPerformers.map((rep: TopPerformer, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {idx < 3 && (
                                <Badge variant={idx === 0 ? "default" : "secondary"} className="w-6 h-6 rounded-full p-0 flex items-center justify-center">
                                  {idx + 1}
                                </Badge>
                              )}
                              {rep.repName}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{rep.dealsWon}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(rep.revenue)}</TableCell>
                          <TableCell className="text-right">{formatPercentage(rep.conversionRate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setLocation('/platform-crm/performance')}
                >
                  View Full Performance Report
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col"
                onClick={() => setLocation('/platform-crm/business-records')}
              >
                <UserPlus className="w-6 h-6 mb-2" />
                <span className="text-sm">Add Prospect</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col"
                onClick={() => setLocation('/platform-crm/deals/new')}
              >
                <Briefcase className="w-6 h-6 mb-2" />
                <span className="text-sm">Create Deal</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col"
                onClick={() => setLocation('/platform-crm/analytics')}
              >
                <LineChart className="w-6 h-6 mb-2" />
                <span className="text-sm">View Analytics</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col"
              >
                <Download className="w-6 h-6 mb-2" />
                <span className="text-sm">Export Data</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
