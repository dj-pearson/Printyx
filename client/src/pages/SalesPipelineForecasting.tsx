import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MainLayout } from "@/components/layout/main-layout";
import { 
  TrendingUp, 
  Target, 
  DollarSign, 
  Calendar,
  FileText,
  Users,
  PieChart,
  BarChart3,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus
} from "lucide-react";
import { format } from "date-fns";

interface PipelineItem {
  id: string;
  title: string;
  value: number;
  probability: number;
  expectedCloseDate: string;
  status: string;
  type: 'deal' | 'quote' | 'proposal';
}

interface PipelineForecastData {
  forecast?: {
    id: string;
    title: string;
    targetValue: number;
    startDate: string;
    endDate: string;
  };
  period: {
    type: string;
    startDate: string;
    endDate: string;
  };
  pipeline: {
    items: PipelineItem[];
    totalValue: number;
    totalCount: number;
    breakdown: {
      deals: { count: number; value: number; weightedValue: number };
      quotes: { count: number; value: number; weightedValue: number };
      proposals: { count: number; value: number; weightedValue: number };
    };
  };
  goals: {
    items: Array<{
      id: string;
      goalType: string;
      targetValue?: number;
      targetCount?: number;
    }>;
    totalValue: number;
    totalCount: number;
  };
  remaining: {
    toGoalValue: number;
    toGoalCount: number;
    progressPercent: number;
  };
}

export default function SalesPipelineForecasting() {
  const [selectedForecast, setSelectedForecast] = useState<string>("all");
  const [period, setPeriod] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      forecastName: "",
      forecastType: "quarterly",
      startDate: "",
      endDate: "",
      revenueTarget: "",
      dealCountTarget: "",
      confidenceLevel: "medium"
    }
  });

  // Fetch available forecasts
  const { data: forecasts } = useQuery({
    queryKey: ["/api/sales-forecasts"],
    queryFn: () => fetch("/api/sales-forecasts").then(res => res.json())
  });

  // Get selected forecast data
  const selectedForecastData = forecasts?.find((f: any) => f.id === selectedForecast);

  // Fetch pipeline forecast data
  const { data: forecastData, isLoading } = useQuery({
    queryKey: [
      "/api/pipeline-forecast", 
      selectedForecast, 
      period,
      startDate,
      endDate
    ],
    queryFn: () => {
      let url = `/api/pipeline-forecast`;
      if (selectedForecast && selectedForecast !== 'all') {
        url += `/${selectedForecast}`;
      }
      
      const params = new URLSearchParams();
      params.append('period', period);
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      return fetch(url).then(res => res.json());
    },
  }) as { data: PipelineForecastData | undefined; isLoading: boolean };

  // Create forecast mutation
  const createForecastMutation = useMutation({
    mutationFn: (data: any) => 
      fetch("/api/sales-forecasts", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-forecasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-forecast"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Success", description: "Forecast created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create forecast",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: any) => {
    createForecastMutation.mutate({
      ...data,
      revenueTarget: parseFloat(data.revenueTarget) || 0,
      dealCountTarget: parseInt(data.dealCountTarget) || 0,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'quote': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'proposal': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'closed_won':
      case 'accepted':
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
      case 'sent':
      case 'viewed':
        return <Clock className="w-4 h-4 text-orange-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Pipeline Forecasting</h1>
            <p className="text-gray-600 mt-1">
              Comprehensive view of deals, quotes, and proposals against forecast goals
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Select value={selectedForecast} onValueChange={setSelectedForecast}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select forecast" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pipeline Data</SelectItem>
                {forecasts?.map((forecast: any) => (
                  <SelectItem key={forecast.id} value={forecast.id}>
                    {forecast.title || forecast.forecastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex gap-2">
              <div>
                <Label htmlFor="start-date" className="sr-only">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Start Date"
                  className="w-40"
                />
              </div>
              <div>
                <Label htmlFor="end-date" className="sr-only">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="End Date"
                  className="w-40"
                />
              </div>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Forecast
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Forecast</DialogTitle>
                  <DialogDescription>
                    Create a sales forecast that will be included in the pipeline analysis
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="forecastName">Forecast Name</Label>
                    <Input
                      id="forecastName"
                      {...form.register("forecastName", { required: true })}
                      placeholder="Q1 2025 Sales Forecast"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        {...form.register("startDate", { required: true })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        {...form.register("endDate", { required: true })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="revenueTarget">Revenue Target ($)</Label>
                      <Input
                        id="revenueTarget"
                        type="number"
                        {...form.register("revenueTarget", { required: true })}
                        placeholder="100000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dealCountTarget">Deal Count Target</Label>
                      <Input
                        id="dealCountTarget"
                        type="number"
                        {...form.register("dealCountTarget")}
                        placeholder="25"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="forecastType">Forecast Type</Label>
                    <Select 
                      value={form.watch("forecastType")} 
                      onValueChange={(value) => form.setValue("forecastType", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createForecastMutation.isPending}
                    >
                      {createForecastMutation.isPending ? "Creating..." : "Create Forecast"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pipeline Value</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(forecastData?.pipeline?.totalValue || 0)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Weighted by probability
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Goal Target</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(forecastData?.goals?.totalValue || 0)}
                  </p>
                  <div className="mt-1">
                    <p className="text-sm text-gray-600">Forecast</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {formatCurrency(selectedForecastData?.revenueTarget || 0)}
                    </p>
                  </div>
                </div>
                <Target className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                From CRM goals & forecasts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Remaining to Goal</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(Math.max(0, (forecastData?.goals?.totalValue || 0) - (forecastData?.pipeline?.totalValue || 0)))}
                  </p>
                  <div className="mt-1">
                    <p className="text-sm text-gray-600">Remaining to Forecast</p>
                    <p className="text-lg font-semibold text-orange-600">
                      {formatCurrency(Math.max(0, (selectedForecastData?.revenueTarget || 0) - (forecastData?.pipeline?.totalValue || 0)))}
                    </p>
                  </div>
                </div>
                <DollarSign className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Additional pipeline needed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Progress to Goal</p>
                  <p className="text-2xl font-bold">
                    {Math.round(forecastData?.goals?.totalValue > 0 ? ((forecastData?.pipeline?.totalValue || 0) / forecastData.goals.totalValue) * 100 : 0)}%
                  </p>
                  <div className="mt-1">
                    <p className="text-sm text-gray-600">Progress to Forecast</p>
                    <p className="text-lg font-semibold text-purple-600">
                      {Math.round(selectedForecastData?.revenueTarget > 0 ? ((forecastData?.pipeline?.totalValue || 0) / selectedForecastData.revenueTarget) * 100 : 0)}%
                    </p>
                  </div>
                </div>
                <PieChart className="w-8 h-8 text-purple-600" />
              </div>
              <Progress 
                value={forecastData?.goals?.totalValue > 0 ? ((forecastData?.pipeline?.totalValue || 0) / forecastData.goals.totalValue) * 100 : 0} 
                className="mt-2" 
              />
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Deals Pipeline</CardTitle>
              <CardDescription>Active sales opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Count</span>
                  <span className="font-semibold">{forecastData?.pipeline?.breakdown?.deals?.count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Value</span>
                  <span className="font-semibold">{formatCurrency(forecastData?.pipeline?.breakdown?.deals?.value || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Weighted Value</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(forecastData?.pipeline?.breakdown?.deals?.weightedValue || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quotes Pipeline</CardTitle>
              <CardDescription>Outstanding quotes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Count</span>
                  <span className="font-semibold">{forecastData?.pipeline?.breakdown?.quotes?.count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Value</span>
                  <span className="font-semibold">{formatCurrency(forecastData?.pipeline?.breakdown?.quotes?.value || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Weighted Value</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(forecastData?.pipeline?.breakdown?.quotes?.weightedValue || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Proposals Pipeline</CardTitle>
              <CardDescription>Pending proposals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Count</span>
                  <span className="font-semibold">{forecastData?.pipeline?.breakdown?.proposals?.count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Value</span>
                  <span className="font-semibold">{formatCurrency(forecastData?.pipeline?.breakdown?.proposals?.value || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Weighted Value</span>
                  <span className="font-semibold text-green-600">{formatCurrency(forecastData?.pipeline?.breakdown?.proposals?.weightedValue || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Items Detail */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline Items</CardTitle>
            <CardDescription>
              Detailed view of all deals, quotes, and proposals in the selected time period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!forecastData?.pipeline?.items || forecastData.pipeline.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No pipeline items found for the selected period</p>
                </div>
              ) : (
                forecastData.pipeline.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(item.status)}
                        <Badge className={getTypeColor(item.type)}>
                          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </Badge>
                      </div>
                      <div>
                        <h4 className="font-medium">{item.title}</h4>
                        <p className="text-sm text-gray-500">
                          Expected: {format(new Date(item.expectedCloseDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.value)}</p>
                      <p className="text-sm text-gray-500">{item.probability}% probability</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}