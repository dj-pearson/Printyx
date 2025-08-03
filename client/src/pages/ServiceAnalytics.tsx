import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, BarChart3, TrendingUp, TrendingDown, Users, Clock, Star,
  DollarSign, Target, Award, Activity, Calendar, Filter, Download,
  Eye, Settings, RefreshCw, AlertCircle, CheckCircle, ArrowUp,
  ArrowDown, Minus, Zap, LineChart, PieChart, BarChart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// Types
type ServicePerformanceMetric = {
  id: string;
  metric_date: string;
  metric_period: string;
  total_service_calls: number;
  emergency_calls: number;
  average_response_time_minutes: number;
  first_call_resolution_rate: number;
  average_satisfaction_score: number;
  total_service_revenue: number;
  utilization_rate: number;
  jobs_completed_on_time: number;
  jobs_completed_late: number;
  month_over_month_growth: number;
  created_at: string;
};

type TechnicianPerformanceAnalytic = {
  id: string;
  technician_name?: string;
  analysis_period_start: string;
  analysis_period_end: string;
  analysis_type: string;
  total_jobs_completed: number;
  billable_hours: number;
  first_time_fix_rate: number;
  customer_satisfaction_avg: number;
  revenue_generated: number;
  productivity_score: number;
  efficiency_ranking?: number;
  improvement_trend: string;
  monthly_target_achievement: number;
  created_at: string;
};

type CustomerServiceAnalytic = {
  id: string;
  customer_name?: string;
  analysis_period_start: string;
  analysis_period_end: string;
  total_service_calls: number;
  average_response_time: number;
  satisfaction_score: number;
  total_service_spend: number;
  equipment_uptime_percentage: number;
  churn_risk_score: number;
  contract_renewal_probability: number;
  upsell_opportunities?: any;
  created_at: string;
};

type ServiceTrendAnalysis = {
  id: string;
  trend_category: string;
  analysis_date: string;
  current_value: number;
  previous_value?: number;
  percentage_change?: number;
  trend_direction: string;
  forecasted_next_period?: number;
  forecast_confidence?: number;
  alert_level?: string;
  trend_insights?: string;
  created_at: string;
};

type BusinessIntelligenceDashboard = {
  id: string;
  dashboard_name: string;
  dashboard_type: string;
  category: string;
  owner_name?: string;
  visibility: string;
  view_count: number;
  last_viewed?: string;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
};

type PerformanceBenchmark = {
  id: string;
  benchmark_name: string;
  benchmark_category: string;
  industry_average?: number;
  company_target?: number;
  current_performance?: number;
  performance_grade?: string;
  percentile_ranking?: number;
  trend_direction: string;
  improvement_priority: string;
  business_impact: string;
  created_at: string;
};

type AnalyticsMetrics = {
  totalServiceCalls: number;
  averageResponseTime: number;
  customerSatisfaction: number;
  revenueGrowth: number;
  utilizationRate: number;
  firstCallResolution: number;
};

// Form Schemas
const dashboardSchema = z.object({
  dashboard_name: z.string().min(3, "Dashboard name required"),
  dashboard_type: z.enum(['executive', 'operational', 'financial', 'customer', 'technician']),
  category: z.enum(['service_analytics', 'performance', 'forecasting', 'benchmarking']),
  visibility: z.enum(['private', 'team', 'department', 'organization']),
  refresh_interval: z.number().min(60).max(3600),
  auto_refresh: z.boolean(),
  description: z.string().optional(),
});

const benchmarkSchema = z.object({
  benchmark_name: z.string().min(3, "Benchmark name required"),
  benchmark_category: z.enum(['response_time', 'satisfaction', 'efficiency', 'revenue', 'quality']),
  industry_average: z.number().optional(),
  company_target: z.number().min(0),
  improvement_priority: z.enum(['high', 'medium', 'low']),
  target_completion_date: z.string().optional(),
  business_impact: z.enum(['critical', 'high', 'medium', 'low']),
  investment_required: z.number().min(0).optional(),
});

type DashboardForm = z.infer<typeof dashboardSchema>;
type BenchmarkForm = z.infer<typeof benchmarkSchema>;

export default function ServiceAnalytics() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isDashboardDialogOpen, setIsDashboardDialogOpen] = useState(false);
  const [isBenchmarkDialogOpen, setIsBenchmarkDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTrend, setSelectedTrend] = useState("all");
  
  const queryClient = useQueryClient();

  // Fetch analytics metrics
  const { data: metrics } = useQuery<AnalyticsMetrics>({
    queryKey: ["/api/analytics/metrics"],
  });

  // Fetch service performance metrics
  const { data: performanceMetrics = [], isLoading: metricsLoading } = useQuery<ServicePerformanceMetric[]>({
    queryKey: ["/api/analytics/performance-metrics", selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPeriod !== "all") params.append("period", selectedPeriod);
      return await apiRequest(`/api/analytics/performance-metrics?${params.toString()}`);
    },
  });

  // Fetch technician analytics
  const { data: technicianAnalytics = [], isLoading: techniciansLoading } = useQuery<TechnicianPerformanceAnalytic[]>({
    queryKey: ["/api/analytics/technician-performance"],
  });

  // Fetch customer analytics
  const { data: customerAnalytics = [], isLoading: customersLoading } = useQuery<CustomerServiceAnalytic[]>({
    queryKey: ["/api/analytics/customer-service"],
  });

  // Fetch trend analysis
  const { data: trendAnalysis = [], isLoading: trendsLoading } = useQuery<ServiceTrendAnalysis[]>({
    queryKey: ["/api/analytics/trends", selectedTrend],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTrend !== "all") params.append("category", selectedTrend);
      return await apiRequest(`/api/analytics/trends?${params.toString()}`);
    },
  });

  // Fetch BI dashboards
  const { data: dashboards = [], isLoading: dashboardsLoading } = useQuery<BusinessIntelligenceDashboard[]>({
    queryKey: ["/api/analytics/dashboards", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      return await apiRequest(`/api/analytics/dashboards?${params.toString()}`);
    },
  });

  // Fetch performance benchmarks
  const { data: benchmarks = [], isLoading: benchmarksLoading } = useQuery<PerformanceBenchmark[]>({
    queryKey: ["/api/analytics/benchmarks"],
  });

  // Create dashboard mutation
  const createDashboardMutation = useMutation({
    mutationFn: async (data: DashboardForm) =>
      await apiRequest("/api/analytics/dashboards", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboards"] });
      setIsDashboardDialogOpen(false);
    },
  });

  // Create benchmark mutation
  const createBenchmarkMutation = useMutation({
    mutationFn: async (data: BenchmarkForm) =>
      await apiRequest("/api/analytics/benchmarks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/benchmarks"] });
      setIsBenchmarkDialogOpen(false);
    },
  });

  // Generate reports mutation
  const generateReportsMutation = useMutation({
    mutationFn: async () =>
      await apiRequest("/api/analytics/generate-reports", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/performance-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/trends"] });
    },
  });

  // Form setup
  const dashboardForm = useForm<DashboardForm>({
    resolver: zodResolver(dashboardSchema),
    defaultValues: {
      dashboard_type: "operational",
      category: "service_analytics",
      visibility: "team",
      refresh_interval: 300,
      auto_refresh: true,
    },
  });

  const benchmarkForm = useForm<BenchmarkForm>({
    resolver: zodResolver(benchmarkSchema),
    defaultValues: {
      benchmark_category: "satisfaction",
      improvement_priority: "medium",
      business_impact: "medium",
    },
  });

  const onDashboardSubmit = (data: DashboardForm) => {
    createDashboardMutation.mutate(data);
  };

  const onBenchmarkSubmit = (data: BenchmarkForm) => {
    createBenchmarkMutation.mutate(data);
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <Minus className="h-4 w-4 text-blue-600" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up': case 'improving': return 'text-green-600';
      case 'down': case 'declining': return 'text-red-600';
      case 'stable': return 'text-blue-600';
      default: return 'text-muted-foreground';
    }
  };

  const getPerformanceColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600';
      case 'B': return 'text-blue-600';
      case 'C': return 'text-yellow-600';
      case 'D': case 'F': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': case 'critical': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default: return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Service Analytics & Performance</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive business intelligence and performance metrics for service operations
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isDashboardDialogOpen} onOpenChange={setIsDashboardDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Dashboard
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Analytics Dashboard</DialogTitle>
              </DialogHeader>
              <Form {...dashboardForm}>
                <form onSubmit={dashboardForm.handleSubmit(onDashboardSubmit)} className="space-y-4">
                  <FormField
                    control={dashboardForm.control}
                    name="dashboard_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dashboard Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Service Performance Dashboard" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={dashboardForm.control}
                      name="dashboard_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dashboard Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="executive">Executive</SelectItem>
                              <SelectItem value="operational">Operational</SelectItem>
                              <SelectItem value="financial">Financial</SelectItem>
                              <SelectItem value="customer">Customer</SelectItem>
                              <SelectItem value="technician">Technician</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={dashboardForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="service_analytics">Service Analytics</SelectItem>
                              <SelectItem value="performance">Performance</SelectItem>
                              <SelectItem value="forecasting">Forecasting</SelectItem>
                              <SelectItem value="benchmarking">Benchmarking</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={dashboardForm.control}
                      name="visibility"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Visibility</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="private">Private</SelectItem>
                              <SelectItem value="team">Team</SelectItem>
                              <SelectItem value="department">Department</SelectItem>
                              <SelectItem value="organization">Organization</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={dashboardForm.control}
                      name="refresh_interval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Refresh Interval (seconds)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="60" 
                              max="3600"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 300)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={dashboardForm.control}
                    name="auto_refresh"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>Enable auto-refresh</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={dashboardForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Dashboard description and purpose..."
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDashboardDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createDashboardMutation.isPending}>
                      {createDashboardMutation.isPending ? "Creating..." : "Create Dashboard"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isBenchmarkDialogOpen} onOpenChange={setIsBenchmarkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Target className="mr-2 h-4 w-4" />
                Set Benchmark
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Set Performance Benchmark</DialogTitle>
              </DialogHeader>
              <Form {...benchmarkForm}>
                <form onSubmit={benchmarkForm.handleSubmit(onBenchmarkSubmit)} className="space-y-4">
                  <FormField
                    control={benchmarkForm.control}
                    name="benchmark_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Benchmark Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Customer Satisfaction Target" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={benchmarkForm.control}
                      name="benchmark_category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="response_time">Response Time</SelectItem>
                              <SelectItem value="satisfaction">Satisfaction</SelectItem>
                              <SelectItem value="efficiency">Efficiency</SelectItem>
                              <SelectItem value="revenue">Revenue</SelectItem>
                              <SelectItem value="quality">Quality</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={benchmarkForm.control}
                      name="company_target"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Target</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              min="0"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={benchmarkForm.control}
                      name="industry_average"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry Average (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={benchmarkForm.control}
                      name="investment_required"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Investment Required ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              min="0"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={benchmarkForm.control}
                      name="improvement_priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={benchmarkForm.control}
                      name="business_impact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Impact</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="critical">Critical</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={benchmarkForm.control}
                    name="target_completion_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Completion Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsBenchmarkDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createBenchmarkMutation.isPending}>
                      {createBenchmarkMutation.isPending ? "Creating..." : "Set Benchmark"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => generateReportsMutation.mutate()} disabled={generateReportsMutation.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {generateReportsMutation.isPending ? "Generating..." : "Generate Reports"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Service Calls</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.totalServiceCalls?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  This month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.averageResponseTime || 0} min
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: 60 min
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.customerSatisfaction?.toFixed(1) || "0.0"}/5
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: 4.5/5
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Revenue Growth</span>
                    <div className="flex items-center space-x-1">
                      {getTrendIcon('up')}
                      <span className="font-medium text-green-600">
                        {formatPercentage(metrics?.revenueGrowth || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Utilization Rate</span>
                    <span className="font-medium">
                      {metrics?.utilizationRate?.toFixed(1) || "0"}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">First Call Resolution</span>
                    <span className="font-medium">
                      {metrics?.firstCallResolution?.toFixed(1) || "0"}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <p className="text-center py-4">Loading metrics...</p>
                ) : (performanceMetrics as ServicePerformanceMetric[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No performance data</p>
                ) : (
                  <div className="space-y-3">
                    {(performanceMetrics as ServicePerformanceMetric[]).slice(0, 5).map((metric) => (
                      <div key={metric.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-medium text-sm">
                            {format(new Date(metric.metric_date), 'MMM dd, yyyy')}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {metric.total_service_calls} calls • {metric.average_response_time_minutes.toFixed(0)} min avg
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {metric.first_call_resolution_rate.toFixed(1)}% FCR
                          </p>
                          <div className="flex items-center space-x-1">
                            {getTrendIcon(metric.month_over_month_growth > 0 ? 'up' : metric.month_over_month_growth < 0 ? 'down' : 'stable')}
                            <span className={`text-xs ${getTrendColor(metric.month_over_month_growth > 0 ? 'up' : metric.month_over_month_growth < 0 ? 'down' : 'stable')}`}>
                              {formatPercentage(metric.month_over_month_growth)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Period Filter */}
          <div className="flex space-x-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Service Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <p className="text-center py-8">Loading performance metrics...</p>
              ) : (performanceMetrics as ServicePerformanceMetric[]).length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No performance metrics available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(performanceMetrics as ServicePerformanceMetric[]).map((metric) => (
                    <div key={metric.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">
                              {format(new Date(metric.metric_date), 'MMM dd, yyyy')} - {metric.metric_period}
                            </h3>
                            <Badge variant="outline">
                              {metric.metric_period}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Service Calls</p>
                              <p className="font-medium">{metric.total_service_calls}</p>
                              <p className="text-xs text-orange-600">{metric.emergency_calls} emergency</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Response Time</p>
                              <p className="font-medium">{metric.average_response_time_minutes.toFixed(0)} min</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">First Call Resolution</p>
                              <p className="font-medium">{metric.first_call_resolution_rate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Satisfaction</p>
                              <p className="font-medium">{metric.average_satisfaction_score.toFixed(1)}/5</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Revenue</p>
                              <p className="font-medium">{formatCurrency(metric.total_service_revenue)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Utilization</p>
                              <p className="font-medium">{metric.utilization_rate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">On-Time Jobs</p>
                              <p className="font-medium">{metric.jobs_completed_on_time}</p>
                              <p className="text-xs text-red-600">{metric.jobs_completed_late} late</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Growth</p>
                              <div className="flex items-center space-x-1">
                                {getTrendIcon(metric.month_over_month_growth > 0 ? 'up' : metric.month_over_month_growth < 0 ? 'down' : 'stable')}
                                <span className={`font-medium ${getTrendColor(metric.month_over_month_growth > 0 ? 'up' : metric.month_over_month_growth < 0 ? 'down' : 'stable')}`}>
                                  {formatPercentage(metric.month_over_month_growth)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technicians" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Technician Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {techniciansLoading ? (
                <p className="text-center py-8">Loading technician analytics...</p>
              ) : (technicianAnalytics as TechnicianPerformanceAnalytic[]).length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No technician analytics available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(technicianAnalytics as TechnicianPerformanceAnalytic[]).map((tech) => (
                    <div key={tech.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{tech.technician_name}</h3>
                            <Badge variant="outline">
                              {tech.analysis_type}
                            </Badge>
                            {getTrendIcon(tech.improvement_trend)}
                            {tech.efficiency_ranking && (
                              <Badge variant="secondary">
                                Rank #{tech.efficiency_ranking}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mb-3">
                            Period: {format(new Date(tech.analysis_period_start), 'MMM dd')} - {format(new Date(tech.analysis_period_end), 'MMM dd, yyyy')}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Jobs Completed</p>
                              <p className="font-medium">{tech.total_jobs_completed}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Billable Hours</p>
                              <p className="font-medium">{tech.billable_hours.toFixed(1)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">First Time Fix</p>
                              <p className="font-medium">{tech.first_time_fix_rate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Satisfaction</p>
                              <p className="font-medium">{tech.customer_satisfaction_avg.toFixed(1)}/5</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Revenue Generated</p>
                              <p className="font-medium">{formatCurrency(tech.revenue_generated)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Productivity Score</p>
                              <p className="font-medium">{tech.productivity_score.toFixed(0)}/100</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Target Achievement</p>
                              <p className="font-medium">{tech.monthly_target_achievement.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Improvement Trend</p>
                              <div className="flex items-center space-x-1">
                                {getTrendIcon(tech.improvement_trend)}
                                <span className={`font-medium ${getTrendColor(tech.improvement_trend)}`}>
                                  {tech.improvement_trend}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Service Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <p className="text-center py-8">Loading customer analytics...</p>
              ) : (customerAnalytics as CustomerServiceAnalytic[]).length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No customer analytics available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(customerAnalytics as CustomerServiceAnalytic[]).map((customer) => (
                    <div key={customer.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{customer.customer_name}</h3>
                            <Badge variant={customer.churn_risk_score > 70 ? 'destructive' : customer.churn_risk_score > 30 ? 'secondary' : 'default'}>
                              {customer.churn_risk_score > 70 ? 'High Risk' : customer.churn_risk_score > 30 ? 'Medium Risk' : 'Low Risk'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mb-3">
                            Period: {format(new Date(customer.analysis_period_start), 'MMM dd')} - {format(new Date(customer.analysis_period_end), 'MMM dd, yyyy')}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Service Calls</p>
                              <p className="font-medium">{customer.total_service_calls}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Avg Response Time</p>
                              <p className="font-medium">{customer.average_response_time.toFixed(1)}h</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Satisfaction</p>
                              <p className="font-medium">{customer.satisfaction_score.toFixed(1)}/5</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Spend</p>
                              <p className="font-medium">{formatCurrency(customer.total_service_spend)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Equipment Uptime</p>
                              <p className="font-medium">{customer.equipment_uptime_percentage.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Churn Risk</p>
                              <p className="font-medium">{customer.churn_risk_score.toFixed(0)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Renewal Probability</p>
                              <p className="font-medium">{customer.contract_renewal_probability.toFixed(0)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Upsell Opportunities</p>
                              <p className="font-medium">
                                {customer.upsell_opportunities ? Object.keys(customer.upsell_opportunities).length : 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Trend Filter */}
          <div className="flex space-x-4">
            <Select value={selectedTrend} onValueChange={setSelectedTrend}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="service_volume">Service Volume</SelectItem>
                <SelectItem value="response_times">Response Times</SelectItem>
                <SelectItem value="satisfaction">Satisfaction</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="efficiency">Efficiency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Service Trend Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <p className="text-center py-8">Loading trend analysis...</p>
              ) : (trendAnalysis as ServiceTrendAnalysis[]).length === 0 ? (
                <div className="text-center py-8">
                  <LineChart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No trend analysis available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(trendAnalysis as ServiceTrendAnalysis[]).map((trend) => (
                    <div key={trend.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{trend.trend_category.replace('_', ' ')}</h3>
                            {getTrendIcon(trend.trend_direction)}
                            {trend.alert_level && getAlertIcon(trend.alert_level)}
                          </div>
                          <div className="text-sm text-muted-foreground mb-3">
                            Analysis Date: {format(new Date(trend.analysis_date), 'MMM dd, yyyy')}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Current Value</p>
                              <p className="font-medium">{trend.current_value.toLocaleString()}</p>
                            </div>
                            {trend.previous_value && (
                              <div>
                                <p className="text-muted-foreground">Previous Value</p>
                                <p className="font-medium">{trend.previous_value.toLocaleString()}</p>
                              </div>
                            )}
                            {trend.percentage_change && (
                              <div>
                                <p className="text-muted-foreground">Change</p>
                                <div className="flex items-center space-x-1">
                                  {getTrendIcon(trend.percentage_change > 0 ? 'up' : trend.percentage_change < 0 ? 'down' : 'stable')}
                                  <span className={`font-medium ${getTrendColor(trend.percentage_change > 0 ? 'up' : trend.percentage_change < 0 ? 'down' : 'stable')}`}>
                                    {formatPercentage(trend.percentage_change)}
                                  </span>
                                </div>
                              </div>
                            )}
                            {trend.forecasted_next_period && (
                              <div>
                                <p className="text-muted-foreground">Forecast</p>
                                <p className="font-medium">{trend.forecasted_next_period.toLocaleString()}</p>
                                {trend.forecast_confidence && (
                                  <p className="text-xs text-muted-foreground">
                                    {trend.forecast_confidence.toFixed(0)}% confidence
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          {trend.trend_insights && (
                            <div className="mt-3 p-3 bg-muted rounded-lg">
                              <p className="text-sm">{trend.trend_insights}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benchmarks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Benchmarks</CardTitle>
            </CardHeader>
            <CardContent>
              {benchmarksLoading ? (
                <p className="text-center py-8">Loading benchmarks...</p>
              ) : (benchmarks as PerformanceBenchmark[]).length === 0 ? (
                <div className="text-center py-8">
                  <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No benchmarks set</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(benchmarks as PerformanceBenchmark[]).map((benchmark) => (
                    <div key={benchmark.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{benchmark.benchmark_name}</h3>
                            {benchmark.performance_grade && (
                              <Badge variant={benchmark.performance_grade === 'A' ? 'default' : benchmark.performance_grade === 'B' ? 'secondary' : 'destructive'}>
                                Grade {benchmark.performance_grade}
                              </Badge>
                            )}
                            <Badge variant={getPriorityColor(benchmark.improvement_priority)}>
                              {benchmark.improvement_priority} priority
                            </Badge>
                            {getTrendIcon(benchmark.trend_direction)}
                          </div>
                          <div className="text-sm text-muted-foreground mb-3">
                            Category: {benchmark.benchmark_category.replace('_', ' ')} • Impact: {benchmark.business_impact}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {benchmark.current_performance && (
                              <div>
                                <p className="text-muted-foreground">Current Performance</p>
                                <p className="font-medium">{benchmark.current_performance.toLocaleString()}</p>
                              </div>
                            )}
                            {benchmark.company_target && (
                              <div>
                                <p className="text-muted-foreground">Company Target</p>
                                <p className="font-medium">{benchmark.company_target.toLocaleString()}</p>
                              </div>
                            )}
                            {benchmark.industry_average && (
                              <div>
                                <p className="text-muted-foreground">Industry Average</p>
                                <p className="font-medium">{benchmark.industry_average.toLocaleString()}</p>
                              </div>
                            )}
                            {benchmark.percentile_ranking && (
                              <div>
                                <p className="text-muted-foreground">Percentile Ranking</p>
                                <p className="font-medium">{benchmark.percentile_ranking.toFixed(0)}th</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          {benchmark.performance_grade && (
                            <div className={`text-2xl font-bold ${getPerformanceColor(benchmark.performance_grade)}`}>
                              {benchmark.performance_grade}
                            </div>
                          )}
                          <div className="flex space-x-1">
                            <Button variant="outline" size="sm">
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Settings className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}