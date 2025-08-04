import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  Plus, TrendingUp, TrendingDown, Calculator, DollarSign, PieChart,
  BarChart3, Calendar, Target, AlertTriangle, CheckCircle, Activity,
  FileText, Filter, Download, Settings, ArrowUp, ArrowDown, Minus
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// Types
type FinancialForecast = {
  id: string;
  forecast_name: string;
  forecast_type: string;
  forecast_period: string;
  start_date: string;
  end_date: string;
  base_amount: number;
  growth_rate: number;
  scenario_type: string;
  total_forecast_amount: number;
  confidence_level: number;
  status: string;
  created_at: string;
};

type CashFlowProjection = {
  id: string;
  projection_name: string;
  projection_period: string;
  beginning_cash: number;
  total_cash_inflow: number;
  total_cash_outflow: number;
  net_cash_flow: number;
  ending_cash: number;
  cash_shortage_risk: boolean;
  days_cash_on_hand: number;
  created_at: string;
};

type ProfitabilityAnalysis = {
  id: string;
  analysis_name: string;
  analysis_type: string;
  subject_name: string;
  total_revenue: number;
  total_costs: number;
  gross_profit: number;
  gross_margin_percentage: number;
  net_profit: number;
  net_margin_percentage: number;
  roi_percentage: number;
  created_at: string;
};

type FinancialKPI = {
  id: string;
  kpi_name: string;
  kpi_category: string;
  current_value: number;
  previous_value: number;
  target_value: number;
  trend_direction: string;
  performance_vs_target: string;
  percentage_change: number;
  calculation_period: string;
};

type FinancialMetrics = {
  totalRevenueForecast: number;
  cashFlowProjection: number;
  profitMargin: number;
  riskLevel: string;
  forecastAccuracy: number;
  growthProjection: number;
};

// Form Schemas
const forecastSchema = z.object({
  forecast_name: z.string().min(3, "Forecast name must be at least 3 characters"),
  forecast_type: z.enum(['revenue', 'cash_flow', 'profit_loss', 'budget_vs_actual']),
  forecast_period: z.enum(['monthly', 'quarterly', 'annually']),
  start_date: z.string(),
  end_date: z.string(),
  base_amount: z.number().min(0),
  growth_rate: z.number().min(-1).max(5),
  scenario_type: z.enum(['optimistic', 'base', 'pessimistic']),
  assumptions: z.string().optional(),
});

const cashFlowSchema = z.object({
  projection_name: z.string().min(3, "Projection name required"),
  projection_period: z.string(),
  beginning_cash: z.number().min(0),
  collections_forecast: z.number().min(0),
  payroll_expenses: z.number().min(0),
  operating_expenses: z.number().min(0),
  equipment_purchases: z.number().min(0),
  minimum_cash_required: z.number().min(0),
  assumptions: z.string().optional(),
});

type ForecastForm = z.infer<typeof forecastSchema>;
type CashFlowForm = z.infer<typeof cashFlowSchema>;

export default function FinancialForecasting() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isForecastDialogOpen, setIsForecastDialogOpen] = useState(false);
  const [isCashFlowDialogOpen, setIsCashFlowDialogOpen] = useState(false);
  const [selectedForecastType, setSelectedForecastType] = useState("all");
  const [selectedAnalysisType, setSelectedAnalysisType] = useState("all");
  
  const queryClient = useQueryClient();

  // Fetch financial metrics
  const { data: metrics } = useQuery<FinancialMetrics>({
    queryKey: ["/api/financial/metrics"],
  });

  // Fetch forecasts
  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery<FinancialForecast[]>({
    queryKey: ["/api/financial/forecasts", selectedForecastType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedForecastType !== "all") params.append("type", selectedForecastType);
      return await apiRequest(`/api/financial/forecasts?${params.toString()}`);
    },
  });

  // Fetch cash flow projections
  const { data: cashFlowProjections = [], isLoading: cashFlowLoading } = useQuery<CashFlowProjection[]>({
    queryKey: ["/api/financial/cash-flow"],
  });

  // Fetch profitability analysis
  const { data: profitabilityAnalysis = [], isLoading: profitabilityLoading } = useQuery<ProfitabilityAnalysis[]>({
    queryKey: ["/api/financial/profitability", selectedAnalysisType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAnalysisType !== "all") params.append("type", selectedAnalysisType);
      return await apiRequest(`/api/financial/profitability?${params.toString()}`);
    },
  });

  // Fetch KPIs
  const { data: kpis = [], isLoading: kpisLoading } = useQuery<FinancialKPI[]>({
    queryKey: ["/api/financial/kpis"],
  });

  // Create forecast mutation
  const createForecastMutation = useMutation({
    mutationFn: async (data: ForecastForm) =>
      await apiRequest("/api/financial/forecasts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/forecasts"] });
      setIsForecastDialogOpen(false);
    },
  });

  // Create cash flow projection mutation
  const createCashFlowMutation = useMutation({
    mutationFn: async (data: CashFlowForm) =>
      await apiRequest("/api/financial/cash-flow", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/cash-flow"] });
      setIsCashFlowDialogOpen(false);
    },
  });

  // Run profitability analysis mutation
  const runAnalysisMutation = useMutation({
    mutationFn: async () =>
      await apiRequest("/api/financial/profitability/run", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial/profitability"] });
    },
  });

  // Form setup
  const forecastForm = useForm<ForecastForm>({
    resolver: zodResolver(forecastSchema),
    defaultValues: {
      forecast_type: "revenue",
      forecast_period: "monthly",
      scenario_type: "base",
      base_amount: 0,
      growth_rate: 0.05,
    },
  });

  const cashFlowForm = useForm<CashFlowForm>({
    resolver: zodResolver(cashFlowSchema),
    defaultValues: {
      beginning_cash: 0,
      collections_forecast: 0,
      payroll_expenses: 0,
      operating_expenses: 0,
      equipment_purchases: 0,
      minimum_cash_required: 10000,
    },
  });

  const onForecastSubmit = (data: ForecastForm) => {
    createForecastMutation.mutate(data);
  };

  const onCashFlowSubmit = (data: CashFlowForm) => {
    createCashFlowMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': case 'completed': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'outline';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <Minus className="h-4 w-4 text-blue-600" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'above_target': return 'text-green-600';
      case 'on_target': return 'text-blue-600';
      case 'below_target': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Financial Forecasting & Analysis</h1>
          <p className="text-muted-foreground mt-2">
            Revenue projections, cash flow analysis, and profitability insights
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isForecastDialogOpen} onOpenChange={setIsForecastDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <TrendingUp className="mr-2 h-4 w-4" />
                New Forecast
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Financial Forecast</DialogTitle>
              </DialogHeader>
              <Form {...forecastForm}>
                <form onSubmit={forecastForm.handleSubmit(onForecastSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={forecastForm.control}
                      name="forecast_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Forecast Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Q4 Revenue Projection" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={forecastForm.control}
                      name="forecast_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Forecast Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="revenue">Revenue</SelectItem>
                              <SelectItem value="cash_flow">Cash Flow</SelectItem>
                              <SelectItem value="profit_loss">Profit & Loss</SelectItem>
                              <SelectItem value="budget_vs_actual">Budget vs Actual</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={forecastForm.control}
                      name="forecast_period"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Period</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annually">Annually</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={forecastForm.control}
                      name="scenario_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scenario</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="optimistic">Optimistic</SelectItem>
                              <SelectItem value="base">Base Case</SelectItem>
                              <SelectItem value="pessimistic">Pessimistic</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={forecastForm.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={forecastForm.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={forecastForm.control}
                      name="base_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Amount ($)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={forecastForm.control}
                      name="growth_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Growth Rate (annual %)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.001"
                              placeholder="0.05 = 5%"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={forecastForm.control}
                    name="assumptions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assumptions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Key assumptions underlying this forecast..."
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
                      onClick={() => setIsForecastDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createForecastMutation.isPending}>
                      {createForecastMutation.isPending ? "Creating..." : "Create Forecast"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCashFlowDialogOpen} onOpenChange={setIsCashFlowDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <BarChart3 className="mr-2 h-4 w-4" />
                Cash Flow Projection
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Cash Flow Projection</DialogTitle>
              </DialogHeader>
              <Form {...cashFlowForm}>
                <form onSubmit={cashFlowForm.handleSubmit(onCashFlowSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={cashFlowForm.control}
                      name="projection_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Projection Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Q4 Cash Flow" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cashFlowForm.control}
                      name="projection_period"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Period</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Cash Inflows</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={cashFlowForm.control}
                        name="beginning_cash"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Beginning Cash ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={cashFlowForm.control}
                        name="collections_forecast"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Collections Forecast ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Cash Outflows</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={cashFlowForm.control}
                        name="payroll_expenses"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payroll Expenses ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={cashFlowForm.control}
                        name="operating_expenses"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Operating Expenses ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={cashFlowForm.control}
                        name="equipment_purchases"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Equipment Purchases ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={cashFlowForm.control}
                        name="minimum_cash_required"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Cash Required ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={cashFlowForm.control}
                    name="assumptions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assumptions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Cash flow assumptions and risk factors..."
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
                      onClick={() => setIsCashFlowDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createCashFlowMutation.isPending}>
                      {createCashFlowMutation.isPending ? "Creating..." : "Create Projection"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => runAnalysisMutation.mutate()} disabled={runAnalysisMutation.isPending}>
            <Calculator className="mr-2 h-4 w-4" />
            {runAnalysisMutation.isPending ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Financial Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue Forecast</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${metrics?.totalRevenueForecast?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.growthProjection ? `${(metrics.growthProjection * 100).toFixed(1)}% growth projected` : "No growth data"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cash Flow</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  (metrics?.cashFlowProjection || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${metrics?.cashFlowProjection?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Net cash flow projection
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.profitMargin ? `${metrics.profitMargin.toFixed(1)}%` : "0%"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average profit margin
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Forecasts and KPIs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Forecasts</CardTitle>
              </CardHeader>
              <CardContent>
                {forecastsLoading ? (
                  <p className="text-center py-4">Loading forecasts...</p>
                ) : (forecasts as FinancialForecast[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No forecasts yet</p>
                ) : (
                  <div className="space-y-3">
                    {(forecasts as FinancialForecast[]).slice(0, 5).map((forecast) => (
                      <div key={forecast.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{forecast.forecast_name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {forecast.forecast_type.replace('_', ' ')} • {forecast.scenario_type}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            ${forecast.total_forecast_amount.toLocaleString()}
                          </span>
                          <Badge variant={getStatusColor(forecast.status)} className="text-xs">
                            {forecast.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Performance Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                {kpisLoading ? (
                  <p className="text-center py-4">Loading KPIs...</p>
                ) : (kpis as FinancialKPI[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No KPIs available</p>
                ) : (
                  <div className="space-y-3">
                    {(kpis as FinancialKPI[]).slice(0, 5).map((kpi) => (
                      <div key={kpi.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getTrendIcon(kpi.trend_direction)}
                          <div>
                            <h4 className="font-medium text-sm">{kpi.kpi_name}</h4>
                            <p className="text-xs text-muted-foreground">{kpi.kpi_category}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${getPerformanceColor(kpi.performance_vs_target)}`}>
                            {kpi.current_value.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {kpi.percentage_change > 0 ? '+' : ''}{Number(kpi.percentage_change || 0).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forecasts" className="space-y-6">
          {/* Filters */}
          <div className="flex space-x-4">
            <Select value={selectedForecastType} onValueChange={setSelectedForecastType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="cash_flow">Cash Flow</SelectItem>
                <SelectItem value="profit_loss">Profit & Loss</SelectItem>
                <SelectItem value="budget_vs_actual">Budget vs Actual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Financial Forecasts</CardTitle>
            </CardHeader>
            <CardContent>
              {forecastsLoading ? (
                <p className="text-center py-8">Loading forecasts...</p>
              ) : (forecasts as FinancialForecast[]).length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No forecasts found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(forecasts as FinancialForecast[]).map((forecast) => (
                    <div key={forecast.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{forecast.forecast_name}</h3>
                            <Badge variant={getStatusColor(forecast.status)}>
                              {forecast.status}
                            </Badge>
                            <Badge variant="outline">
                              {forecast.scenario_type}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Type: {forecast.forecast_type.replace('_', ' ')}</p>
                            <p>Period: {forecast.forecast_period}</p>
                            <p>Duration: {format(new Date(forecast.start_date), 'MMM dd')} - {format(new Date(forecast.end_date), 'MMM dd, yyyy')}</p>
                            <p>Growth Rate: {(forecast.growth_rate * 100).toFixed(1)}%</p>
                            <p>Confidence: {(forecast.confidence_level * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            ${forecast.total_forecast_amount.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Base: ${forecast.base_amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashflow" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Projections</CardTitle>
            </CardHeader>
            <CardContent>
              {cashFlowLoading ? (
                <p className="text-center py-8">Loading cash flow projections...</p>
              ) : (cashFlowProjections as CashFlowProjection[]).length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No cash flow projections yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(cashFlowProjections as CashFlowProjection[]).map((projection) => (
                    <div key={projection.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{projection.projection_name}</h3>
                            {projection.cash_shortage_risk && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Risk
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Period: {format(new Date(projection.projection_period), 'MMM dd, yyyy')}</p>
                            <p>Beginning Cash: ${projection.beginning_cash.toLocaleString()}</p>
                            <p>Cash Inflow: ${projection.total_cash_inflow.toLocaleString()}</p>
                            <p>Cash Outflow: ${projection.total_cash_outflow.toLocaleString()}</p>
                            <p>Days Cash on Hand: {projection.days_cash_on_hand}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            projection.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${projection.net_cash_flow.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Net Cash Flow
                          </p>
                          <p className="text-sm font-medium">
                            Ending: ${projection.ending_cash.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profitability" className="space-y-6">
          {/* Filters */}
          <div className="flex space-x-4">
            <Select value={selectedAnalysisType} onValueChange={setSelectedAnalysisType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="service_line">Service Line</SelectItem>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="product">Product</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Profitability Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {profitabilityLoading ? (
                <p className="text-center py-8">Loading profitability analysis...</p>
              ) : (profitabilityAnalysis as ProfitabilityAnalysis[]).length === 0 ? (
                <div className="text-center py-8">
                  <PieChart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No profitability analysis available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(profitabilityAnalysis as ProfitabilityAnalysis[]).map((analysis) => (
                    <div key={analysis.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{analysis.analysis_name}</h3>
                            <Badge variant="outline">
                              {analysis.analysis_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Subject: {analysis.subject_name}</p>
                            <p>Revenue: ${analysis.total_revenue.toLocaleString()}</p>
                            <p>Costs: ${analysis.total_costs.toLocaleString()}</p>
                            <p>ROI: {analysis.roi_percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            analysis.net_profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${analysis.net_profit.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Net Profit ({analysis.net_margin_percentage.toFixed(1)}%)
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Gross Margin: {analysis.gross_margin_percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial KPIs</CardTitle>
            </CardHeader>
            <CardContent>
              {kpisLoading ? (
                <p className="text-center py-8">Loading KPIs...</p>
              ) : (kpis as FinancialKPI[]).length === 0 ? (
                <div className="text-center py-8">
                  <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No KPIs available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(kpis as FinancialKPI[]).map((kpi) => (
                    <Card key={kpi.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{kpi.kpi_name}</CardTitle>
                          {getTrendIcon(kpi.trend_direction)}
                        </div>
                        <Badge variant="outline" className="w-fit">
                          {kpi.kpi_category}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-center">
                          <p className={`text-2xl font-bold ${getPerformanceColor(kpi.performance_vs_target)}`}>
                            {kpi.current_value.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Current Value
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Previous</p>
                            <p className="font-medium">{kpi.previous_value.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Target</p>
                            <p className="font-medium">{kpi.target_value.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Change</p>
                            <p className={`font-medium ${kpi.percentage_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {kpi.percentage_change > 0 ? '+' : ''}{Number(kpi.percentage_change || 0).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">vs Target</p>
                            <p className={`font-medium ${getPerformanceColor(kpi.performance_vs_target)}`}>
                              {kpi.performance_vs_target.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}