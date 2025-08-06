import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  PieChart,
  LineChart,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import MainLayout from "@/components/layout/main-layout";

interface AnalyticsData {
  executiveSummary: {
    totalRevenue: {
      current: number;
      previous: number;
      growth: number;
      trend: string;
    };
    activeCustomers: {
      current: number;
      previous: number;
      growth: number;
      trend: string;
    };
    serviceTickets: {
      current: number;
      previous: number;
      growth: number;
      trend: string;
    };
    grossMargin: {
      current: number;
      previous: number;
      growth: number;
      trend: string;
    };
  };
  revenueAnalytics: {
    monthlyRevenue: Array<{
      month: string;
      revenue: number;
      contracts: number;
      newCustomers: number;
    }>;
    revenueByCategory: Array<{
      category: string;
      amount: number;
      percentage: number;
      growth: number;
    }>;
    topPerformingProducts: Array<{
      product: string;
      revenue: number;
      units: number;
      margin: number;
      trend: string;
    }>;
  };
  customerAnalytics: {
    customerSegmentation: Array<{
      segment: string;
      count: number;
      revenue: number;
      percentage: number;
    }>;
    customerLifetimeValue: {
      average: number;
      median: number;
      top10Percent: number;
      churnRate: number;
      retentionRate: number;
    };
    topCustomers: Array<{
      name: string;
      revenue: number;
      contracts: number;
      satisfaction: number;
      lastPurchase: Date;
      nextRenewal: Date;
    }>;
  };
  serviceAnalytics: {
    serviceMetrics: {
      totalTickets: number;
      avgResolutionTime: number;
      firstCallResolution: number;
      customerSatisfaction: number;
      technicianUtilization: number;
    };
    ticketTrends: Array<{
      month: string;
      tickets: number;
      resolved: number;
      satisfaction: number;
    }>;
    topIssues: Array<{
      issue: string;
      count: number;
      avgTime: number;
      resolution: number;
    }>;
    technicianPerformance: Array<{
      technician: string;
      tickets: number;
      avgTime: number;
      satisfaction: number;
      efficiency: number;
    }>;
  };
  equipmentAnalytics: {
    fleetOverview: {
      totalUnits: number;
      averageAge: number;
      utilizationRate: number;
      maintenanceCompliance: number;
    };
    equipmentByManufacturer: Array<{
      manufacturer: string;
      units: number;
      percentage: number;
      avgAge: number;
    }>;
    maintenanceSchedule: {
      overdue: number;
      dueSoon: number;
      upcoming: number;
      compliant: number;
    };
  };
  financialAnalytics: {
    profitability: {
      grossProfit: number;
      grossMargin: number;
      netProfit: number;
      netMargin: number;
      ebitda: number;
    };
    cashFlow: Array<{
      month: string;
      inflow: number;
      outflow: number;
      net: number;
    }>;
    expenseBreakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
  predictiveAnalytics: {
    revenueForecast: Array<{
      month: string;
      predicted: number;
      confidence: number;
    }>;
    churnPrediction: {
      highRisk: number;
      mediumRisk: number;
      lowRisk: number;
      actions: Array<{ customer: string; risk: number; action: string }>;
    };
  };
  competitiveAnalysis: {
    marketShare: {
      company: number;
      competitor1: number;
      competitor2: number;
      competitor3: number;
      others: number;
    };
    winLossAnalysis: {
      totalOpportunities: number;
      won: number;
      lost: number;
      pending: number;
      winRate: number;
      lossReasons: Array<{ reason: string; count: number; percentage: number }>;
    };
  };
}

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case "down":
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export default function AdvancedAnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("last-30-days");
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch analytics dashboard data
  const {
    data: analyticsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/analytics/dashboard", selectedPeriod, selectedSegment],
    select: (data: any) => ({
      ...data,
      customerAnalytics: {
        ...data.customerAnalytics,
        topCustomers:
          data.customerAnalytics?.topCustomers?.map((customer: any) => ({
            ...customer,
            lastPurchase: new Date(customer.lastPurchase),
            nextRenewal: new Date(customer.nextRenewal),
          })) || [],
      },
    }),
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MainLayout
      title="Advanced Analytics Dashboard"
      description="Comprehensive business intelligence and performance insights"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-7-days">Last 7 Days</SelectItem>
              <SelectItem value="last-30-days">Last 30 Days</SelectItem>
              <SelectItem value="last-90-days">Last 90 Days</SelectItem>
              <SelectItem value="last-12-months">Last 12 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {analyticsData && (
        <>
          {/* Executive Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Revenue
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(
                        analyticsData.executiveSummary.totalRevenue.current
                      )}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2">
                  {getTrendIcon(
                    analyticsData.executiveSummary.totalRevenue.trend
                  )}
                  <span
                    className={`ml-2 text-sm font-medium ${
                      analyticsData.executiveSummary.totalRevenue.growth >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {analyticsData.executiveSummary.totalRevenue.growth >= 0
                      ? "+"
                      : ""}
                    {formatPercentage(
                      analyticsData.executiveSummary.totalRevenue.growth
                    )}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    vs last period
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Active Customers
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analyticsData.executiveSummary.activeCustomers.current.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2">
                  {getTrendIcon(
                    analyticsData.executiveSummary.activeCustomers.trend
                  )}
                  <span
                    className={`ml-2 text-sm font-medium ${
                      analyticsData.executiveSummary.activeCustomers.growth >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {analyticsData.executiveSummary.activeCustomers.growth >= 0
                      ? "+"
                      : ""}
                    {formatPercentage(
                      analyticsData.executiveSummary.activeCustomers.growth
                    )}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    vs last period
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Service Tickets
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analyticsData.executiveSummary.serviceTickets.current.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Target className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2">
                  {getTrendIcon(
                    analyticsData.executiveSummary.serviceTickets.trend
                  )}
                  <span
                    className={`ml-2 text-sm font-medium ${
                      analyticsData.executiveSummary.serviceTickets.growth >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {analyticsData.executiveSummary.serviceTickets.growth >= 0
                      ? "+"
                      : ""}
                    {formatPercentage(
                      analyticsData.executiveSummary.serviceTickets.growth
                    )}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    vs last period
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Gross Margin
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(
                        analyticsData.executiveSummary.grossMargin.current
                      )}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <PieChart className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2">
                  {getTrendIcon(
                    analyticsData.executiveSummary.grossMargin.trend
                  )}
                  <span
                    className={`ml-2 text-sm font-medium ${
                      analyticsData.executiveSummary.grossMargin.growth >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {analyticsData.executiveSummary.grossMargin.growth >= 0
                      ? "+"
                      : ""}
                    {formatPercentage(
                      analyticsData.executiveSummary.grossMargin.growth
                    )}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    vs last period
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="revenue" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 sm:gap-0">
              <TabsTrigger value="revenue" className="text-xs sm:text-sm px-2 py-2">Revenue</TabsTrigger>
              <TabsTrigger value="customers" className="text-xs sm:text-sm px-2 py-2">Customers</TabsTrigger>
              <TabsTrigger value="service" className="text-xs sm:text-sm px-2 py-2">Service</TabsTrigger>
              <TabsTrigger value="equipment" className="text-xs sm:text-sm px-2 py-2">Equipment</TabsTrigger>
              <TabsTrigger value="financial" className="text-xs sm:text-sm px-2 py-2">Financial</TabsTrigger>
              <TabsTrigger value="predictive" className="text-xs sm:text-sm px-2 py-2">Predictive</TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Revenue by Category */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Revenue by Category
                    </CardTitle>
                    <CardDescription>
                      Breakdown of revenue sources
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analyticsData.revenueAnalytics.revenueByCategory.map(
                        (category: any, idx: number) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                {category.category}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">
                                  {formatCurrency(category.amount)}
                                </span>
                                <Badge
                                  className={
                                    category.growth >= 0
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }
                                >
                                  {category.growth >= 0 ? "+" : ""}
                                  {formatPercentage(category.growth)}
                                </Badge>
                              </div>
                            </div>
                            <Progress
                              value={category.percentage}
                              className="h-2"
                            />
                            <div className="text-xs text-gray-500">
                              {formatPercentage(category.percentage)} of total
                              revenue
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Performing Products */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Top Performing Products
                    </CardTitle>
                    <CardDescription>
                      Best selling products by revenue
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analyticsData.revenueAnalytics.topPerformingProducts.map(
                        (product: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {product.product}
                              </div>
                              <div className="text-xs text-gray-600">
                                {product.units} units •{" "}
                                {formatPercentage(product.margin)} margin
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-sm">
                                {formatCurrency(product.revenue)}
                              </div>
                              <div className="flex items-center justify-end mt-1">
                                {getTrendIcon(product.trend)}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Revenue Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    Monthly Revenue Trend
                  </CardTitle>
                  <CardDescription>
                    Revenue, contracts, and new customers over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
                    <div className="text-center">
                      <LineChart className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">
                        Interactive chart would be rendered here
                      </p>
                      <p className="text-sm text-gray-500">
                        Showing trend from{" "}
                        {
                          analyticsData.revenueAnalytics.monthlyRevenue[0]
                            ?.month
                        }{" "}
                        to{" "}
                        {
                          analyticsData.revenueAnalytics.monthlyRevenue[
                            analyticsData.revenueAnalytics.monthlyRevenue
                              .length - 1
                          ]?.month
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="customers" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Customer Segmentation */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Customer Segmentation
                    </CardTitle>
                    <CardDescription>
                      Customers by business size
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analyticsData.customerAnalytics.customerSegmentation.map(
                        (segment: any, idx: number) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                {segment.segment}
                              </span>
                              <div className="text-right">
                                <div className="text-sm font-bold">
                                  {segment.count} customers
                                </div>
                                <div className="text-xs text-gray-600">
                                  {formatCurrency(segment.revenue)}
                                </div>
                              </div>
                            </div>
                            <Progress
                              value={segment.percentage}
                              className="h-2"
                            />
                            <div className="text-xs text-gray-500">
                              {formatPercentage(segment.percentage)} of total
                              revenue
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Customer Lifetime Value */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Customer Lifetime Value
                    </CardTitle>
                    <CardDescription>
                      CLV metrics and retention rates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className="text-lg font-bold text-gray-900">
                          {formatCurrency(
                            analyticsData.customerAnalytics
                              .customerLifetimeValue.average
                          )}
                        </div>
                        <div className="text-sm text-gray-600">Average CLV</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className="text-lg font-bold text-gray-900">
                          {formatCurrency(
                            analyticsData.customerAnalytics
                              .customerLifetimeValue.median
                          )}
                        </div>
                        <div className="text-sm text-gray-600">Median CLV</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded">
                        <div className="text-lg font-bold text-green-900">
                          {formatPercentage(
                            analyticsData.customerAnalytics
                              .customerLifetimeValue.retentionRate
                          )}
                        </div>
                        <div className="text-sm text-green-600">
                          Retention Rate
                        </div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded">
                        <div className="text-lg font-bold text-red-900">
                          {formatPercentage(
                            analyticsData.customerAnalytics
                              .customerLifetimeValue.churnRate
                          )}
                        </div>
                        <div className="text-sm text-red-600">Churn Rate</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Customers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Top Customers
                  </CardTitle>
                  <CardDescription>
                    Highest value customers by revenue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.customerAnalytics.topCustomers.map(
                      (customer: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-sm text-gray-600">
                              {customer.contracts} contracts • Last purchase:{" "}
                              {format(customer.lastPurchase, "MMM dd, yyyy")}
                            </div>
                            <div className="text-sm text-gray-500">
                              Next renewal:{" "}
                              {format(customer.nextRenewal, "MMM dd, yyyy")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">
                              {formatCurrency(customer.revenue)}
                            </div>
                            <div className="flex items-center justify-end mt-1">
                              <div className="flex items-center gap-1 text-sm">
                                <span className="text-yellow-500">★</span>
                                <span>{customer.satisfaction.toFixed(1)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="service" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Service Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Service Metrics
                    </CardTitle>
                    <CardDescription>
                      Key service performance indicators
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded">
                        <div className="text-lg font-bold text-blue-900">
                          {analyticsData.serviceAnalytics.serviceMetrics.totalTickets.toLocaleString()}
                        </div>
                        <div className="text-sm text-blue-600">
                          Total Tickets
                        </div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded">
                        <div className="text-lg font-bold text-green-900">
                          {
                            analyticsData.serviceAnalytics.serviceMetrics
                              .avgResolutionTime
                          }
                          h
                        </div>
                        <div className="text-sm text-green-600">
                          Avg Resolution
                        </div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded">
                        <div className="text-lg font-bold text-purple-900">
                          {formatPercentage(
                            analyticsData.serviceAnalytics.serviceMetrics
                              .firstCallResolution
                          )}
                        </div>
                        <div className="text-sm text-purple-600">
                          First Call Resolution
                        </div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded">
                        <div className="text-lg font-bold text-yellow-900">
                          {analyticsData.serviceAnalytics.serviceMetrics.customerSatisfaction.toFixed(
                            1
                          )}
                          /5.0
                        </div>
                        <div className="text-sm text-yellow-600">
                          Satisfaction
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Issues */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Top Issues
                    </CardTitle>
                    <CardDescription>
                      Most common service issues
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analyticsData.serviceAnalytics.topIssues.map(
                        (issue: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {issue.issue}
                              </div>
                              <div className="text-xs text-gray-600">
                                Avg time: {issue.avgTime}h • Resolution:{" "}
                                {formatPercentage(issue.resolution)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-sm">
                                {issue.count}
                              </div>
                              <div className="text-xs text-gray-500">
                                tickets
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Technician Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Technician Performance
                  </CardTitle>
                  <CardDescription>
                    Individual technician metrics and performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.serviceAnalytics.technicianPerformance.map(
                      (tech: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{tech.technician}</div>
                            <div className="text-sm text-gray-600">
                              {tech.tickets} tickets • {tech.avgTime}h avg time
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className="text-sm font-bold">
                                {tech.satisfaction.toFixed(1)}/5.0
                              </div>
                              <div className="text-xs text-gray-500">
                                Rating
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm font-bold">
                                {formatPercentage(tech.efficiency)}
                              </div>
                              <div className="text-xs text-gray-500">
                                Efficiency
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="equipment" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Fleet Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Fleet Overview
                    </CardTitle>
                    <CardDescription>
                      Overall equipment fleet metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded">
                        <div className="text-lg font-bold text-blue-900">
                          {analyticsData.equipmentAnalytics.fleetOverview.totalUnits.toLocaleString()}
                        </div>
                        <div className="text-sm text-blue-600">Total Units</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded">
                        <div className="text-lg font-bold text-gray-900">
                          {analyticsData.equipmentAnalytics.fleetOverview.averageAge.toFixed(
                            1
                          )}{" "}
                          years
                        </div>
                        <div className="text-sm text-gray-600">Average Age</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded">
                        <div className="text-lg font-bold text-green-900">
                          {formatPercentage(
                            analyticsData.equipmentAnalytics.fleetOverview
                              .utilizationRate
                          )}
                        </div>
                        <div className="text-sm text-green-600">
                          Utilization
                        </div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded">
                        <div className="text-lg font-bold text-purple-900">
                          {formatPercentage(
                            analyticsData.equipmentAnalytics.fleetOverview
                              .maintenanceCompliance
                          )}
                        </div>
                        <div className="text-sm text-purple-600">
                          Compliance
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Maintenance Schedule */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Maintenance Schedule
                    </CardTitle>
                    <CardDescription>
                      Equipment maintenance status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="font-medium text-red-800">
                            Overdue
                          </span>
                        </div>
                        <span className="font-bold text-red-900">
                          {
                            analyticsData.equipmentAnalytics.maintenanceSchedule
                              .overdue
                          }
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium text-yellow-800">
                            Due Soon (30 days)
                          </span>
                        </div>
                        <span className="font-bold text-yellow-900">
                          {
                            analyticsData.equipmentAnalytics.maintenanceSchedule
                              .dueSoon
                          }
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-800">
                            Upcoming (90 days)
                          </span>
                        </div>
                        <span className="font-bold text-blue-900">
                          {
                            analyticsData.equipmentAnalytics.maintenanceSchedule
                              .upcoming
                          }
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">
                            Compliant
                          </span>
                        </div>
                        <span className="font-bold text-green-900">
                          {
                            analyticsData.equipmentAnalytics.maintenanceSchedule
                              .compliant
                          }
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Equipment by Manufacturer */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Equipment by Manufacturer
                  </CardTitle>
                  <CardDescription>
                    Fleet distribution across manufacturers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analyticsData.equipmentAnalytics.equipmentByManufacturer.map(
                      (manufacturer: any, idx: number) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">
                              {manufacturer.manufacturer}
                            </span>
                            <div className="text-right">
                              <div className="text-sm font-bold">
                                {manufacturer.units} units
                              </div>
                              <div className="text-xs text-gray-600">
                                Avg age: {manufacturer.avgAge.toFixed(1)} years
                              </div>
                            </div>
                          </div>
                          <Progress
                            value={manufacturer.percentage}
                            className="h-2"
                          />
                          <div className="text-xs text-gray-500">
                            {formatPercentage(manufacturer.percentage)} of total
                            fleet
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Profitability */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Profitability
                    </CardTitle>
                    <CardDescription>Key profitability metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="font-medium">Gross Profit</span>
                        <span className="font-bold">
                          {formatCurrency(
                            analyticsData.financialAnalytics.profitability
                              .grossProfit
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="font-medium">Gross Margin</span>
                        <span className="font-bold">
                          {formatPercentage(
                            analyticsData.financialAnalytics.profitability
                              .grossMargin
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                        <span className="font-medium">Net Profit</span>
                        <span className="font-bold text-green-900">
                          {formatCurrency(
                            analyticsData.financialAnalytics.profitability
                              .netProfit
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                        <span className="font-medium">Net Margin</span>
                        <span className="font-bold text-green-900">
                          {formatPercentage(
                            analyticsData.financialAnalytics.profitability
                              .netMargin
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                        <span className="font-medium">EBITDA</span>
                        <span className="font-bold text-blue-900">
                          {formatCurrency(
                            analyticsData.financialAnalytics.profitability
                              .ebitda
                          )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Expense Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Expense Breakdown
                    </CardTitle>
                    <CardDescription>
                      Operating expenses by category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analyticsData.financialAnalytics.expenseBreakdown.map(
                        (expense: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {expense.category}
                              </div>
                              <div className="text-xs text-gray-600">
                                {formatPercentage(expense.percentage)} of total
                                expenses
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-sm">
                                {formatCurrency(expense.amount)}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cash Flow Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    Cash Flow Trend
                  </CardTitle>
                  <CardDescription>
                    Monthly cash inflow, outflow, and net cash flow
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
                    <div className="text-center">
                      <LineChart className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">
                        Cash flow chart would be rendered here
                      </p>
                      <p className="text-sm text-gray-500">
                        Net cash flow trend over last 7 months
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="predictive" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Revenue Forecast */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Revenue Forecast
                    </CardTitle>
                    <CardDescription>
                      Predicted revenue for next 5 months
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analyticsData.predictiveAnalytics.revenueForecast.map(
                        (forecast: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {format(
                                  new Date(forecast.month + "-01"),
                                  "MMMM yyyy"
                                )}
                              </div>
                              <div className="text-xs text-gray-600">
                                {formatPercentage(forecast.confidence)}{" "}
                                confidence
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-sm">
                                {formatCurrency(forecast.predicted)}
                              </div>
                              <Progress
                                value={forecast.confidence}
                                className="h-1 w-16 mt-1"
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Churn Prediction */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Churn Prediction
                    </CardTitle>
                    <CardDescription>
                      Customers at risk of churning
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-red-50 rounded">
                          <div className="text-lg font-bold text-red-900">
                            {
                              analyticsData.predictiveAnalytics.churnPrediction
                                .highRisk
                            }
                          </div>
                          <div className="text-sm text-red-600">High Risk</div>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 rounded">
                          <div className="text-lg font-bold text-yellow-900">
                            {
                              analyticsData.predictiveAnalytics.churnPrediction
                                .mediumRisk
                            }
                          </div>
                          <div className="text-sm text-yellow-600">
                            Medium Risk
                          </div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded">
                          <div className="text-lg font-bold text-green-900">
                            {
                              analyticsData.predictiveAnalytics.churnPrediction
                                .lowRisk
                            }
                          </div>
                          <div className="text-sm text-green-600">Low Risk</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">
                          Immediate Actions Required:
                        </h4>
                        {analyticsData.predictiveAnalytics.churnPrediction.actions.map(
                          (action: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm">
                                  {action.customer}
                                </div>
                                <div className="text-xs text-red-600">
                                  {action.action}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-red-900">
                                  {formatPercentage(action.risk)} risk
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Market Share & Win Rate */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Competitive Analysis
                  </CardTitle>
                  <CardDescription>
                    Market position and win/loss analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Market Share</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Our Company</span>
                          <span className="font-bold">
                            {formatPercentage(
                              analyticsData.competitiveAnalysis.marketShare
                                .company
                            )}
                          </span>
                        </div>
                        <Progress
                          value={
                            analyticsData.competitiveAnalysis.marketShare
                              .company
                          }
                          className="h-2"
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Win/Loss Analysis</h4>
                      <div className="text-center p-3 bg-blue-50 rounded mb-3">
                        <div className="text-lg font-bold text-blue-900">
                          {formatPercentage(
                            analyticsData.competitiveAnalysis.winLossAnalysis
                              .winRate
                          )}
                        </div>
                        <div className="text-sm text-blue-600">Win Rate</div>
                      </div>
                      <div className="text-sm text-gray-600">
                        {analyticsData.competitiveAnalysis.winLossAnalysis.won}{" "}
                        won •{" "}
                        {analyticsData.competitiveAnalysis.winLossAnalysis.lost}{" "}
                        lost •{" "}
                        {
                          analyticsData.competitiveAnalysis.winLossAnalysis
                            .pending
                        }{" "}
                        pending
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </MainLayout>
  );
}
