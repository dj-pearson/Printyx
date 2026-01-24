import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MainLayout from '@/components/layout/main-layout';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Users,
  BarChart3,
} from 'lucide-react';
import { RevenueForecastChart } from '@/components/billing/revenue-forecast-chart';
import { ChurnRiskHeatmap } from '@/components/billing/churn-risk-heatmap';
import { CLVRankingsTable } from '@/components/billing/clv-rankings-table';
import { Badge } from '@/components/ui/badge';

export default function BillingAnalytics() {
  const [forecastPeriods, setForecastPeriods] = useState('3');

  // Fetch revenue forecast
  const { data: forecastData, isLoading: loadingForecast } = useQuery({
    queryKey: ['/api/billing/analytics/revenue-forecast', { periods: forecastPeriods }],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/billing/analytics/revenue-forecast?periods=${forecastPeriods}`,
        'GET',
      );
      return response || {};
    },
  });

  // Fetch churn predictions
  const { data: churnData, isLoading: loadingChurn } = useQuery({
    queryKey: ['/api/billing/analytics/churn-prediction'],
    queryFn: async () => {
      const response = await apiRequest('/api/billing/analytics/churn-prediction', 'GET');
      return response || { predictions: [], summary: {} };
    },
  });

  // Fetch customer lifetime value
  const { data: clvData, isLoading: loadingCLV } = useQuery({
    queryKey: ['/api/billing/analytics/lifetime-value'],
    queryFn: async () => {
      const response = await apiRequest('/api/billing/analytics/lifetime-value', 'GET');
      return response || { customers: [], summary: {} };
    },
  });

  const churnPredictions = churnData?.predictions || [];
  const churnSummary = churnData?.summary || {};
  const clvCustomers = clvData?.customers || [];
  const clvSummary = clvData?.summary || {};

  // Calculate summary metrics
  const totalAtRisk = churnSummary.critical + churnSummary.high || 0;
  const avgCLV = clvSummary.averageLifetimeValue || 0;

  return (
    <MainLayout
      title="Billing Analytics"
      description="Revenue forecasting, churn analysis, and customer lifetime value"
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Billing Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Advanced analytics to drive revenue growth and reduce churn
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">At-Risk Customers</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAtRisk}</div>
              <p className="text-xs text-muted-foreground">
                {churnSummary.critical || 0} critical, {churnSummary.high || 0} high risk
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average CLV</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${avgCLV.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">Per customer lifetime value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clvSummary.totalCustomers || 0}</div>
              <p className="text-xs text-muted-foreground">Active customer base</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total LTV</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${((clvSummary.totalPredictedValue || 0) / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-muted-foreground">Predicted lifetime revenue</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList>
            <TabsTrigger value="forecast">Revenue Forecast</TabsTrigger>
            <TabsTrigger value="churn">Churn Risk</TabsTrigger>
            <TabsTrigger value="clv">Customer Value</TabsTrigger>
          </TabsList>

          {/* Revenue Forecast Tab */}
          <TabsContent value="forecast" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Revenue Forecast</CardTitle>
                    <CardDescription>
                      Predictive revenue analysis based on historical trends and seasonality
                    </CardDescription>
                  </div>
                  <Select value={forecastPeriods} onValueChange={setForecastPeriods}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select periods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 months ahead</SelectItem>
                      <SelectItem value="6">6 months ahead</SelectItem>
                      <SelectItem value="12">12 months ahead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loadingForecast ? (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Loading forecast data...
                  </div>
                ) : (
                  <RevenueForecastChart data={forecastData?.forecast || []} />
                )}
              </CardContent>
            </Card>

            {/* Forecast Insights */}
            {forecastData?.forecast && forecastData.forecast.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                {forecastData.forecast.map((forecast: any, index: number) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-sm">{forecast.period}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">
                          ${(forecast.forecastedRevenue / 1000).toFixed(1)}K
                        </span>
                        {forecast.trend === 'increasing' ? (
                          <Badge className="bg-green-100 text-green-800">
                            <TrendingUp className="mr-1 h-3 w-3" />
                            Growing
                          </Badge>
                        ) : forecast.trend === 'decreasing' ? (
                          <Badge variant="destructive">
                            <TrendingDown className="mr-1 h-3 w-3" />
                            Declining
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Stable</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Confidence:</span>
                          <span className="font-medium">{forecast.confidence}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Range:</span>
                          <span className="font-medium">
                            ${(forecast.lowerBound / 1000).toFixed(1)}K - $
                            {(forecast.upperBound / 1000).toFixed(1)}K
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Churn Risk Tab */}
          <TabsContent value="churn" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Churn Risk Analysis</CardTitle>
                <CardDescription>
                  Identify customers at risk of churning and take proactive action
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingChurn ? (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Loading churn analysis...
                  </div>
                ) : (
                  <ChurnRiskHeatmap data={churnPredictions} />
                )}
              </CardContent>
            </Card>

            {/* Risk Level Summary */}
            {churnPredictions.length > 0 && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Critical Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-destructive">
                      {churnSummary.critical || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Requires immediate action</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">High Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600">
                      {churnSummary.high || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Needs attention soon</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Medium Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-600">
                      {churnSummary.medium || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Monitor closely</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Low Risk</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">{churnSummary.low || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Healthy customers</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Customer Lifetime Value Tab */}
          <TabsContent value="clv" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer Lifetime Value Rankings</CardTitle>
                <CardDescription>
                  Identify your most valuable customers and growth opportunities
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCLV ? (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Loading CLV data...
                  </div>
                ) : (
                  <CLVRankingsTable data={clvCustomers} />
                )}
              </CardContent>
            </Card>

            {/* CLV Summary */}
            {clvCustomers.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total Historical Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${((clvSummary.totalHistoricalValue || 0) / 1000).toFixed(0)}K
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Revenue generated to date</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Predicted Lifetime Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${((clvSummary.totalPredictedValue || 0) / 1000).toFixed(0)}K
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Forecasted total revenue</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Average CLV</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${(clvSummary.averageLifetimeValue || 0).toFixed(0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Per customer value</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
