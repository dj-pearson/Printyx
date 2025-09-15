import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  LineChart, 
  BarChart, 
  PieChart,
  ComposedChart, 
  MetricCard, 
  CHART_COLORS 
} from '@/components/charts/ChartComponents';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  DollarSign,
  BarChart3,
  Zap,
  Leaf,
  AlertTriangle,
  CheckCircle,
  Info,
  Calendar,
  Printer,
  FileText,
  Target,
  Lightbulb
} from 'lucide-react';
import type { UsageAnalytics } from '../../../shared/customer-portal-schema';
import { Skeleton } from '@/components/ui/skeleton';

// Remove local type definition - using shared schema types instead

interface UsageAnalyticsDashboardProps {
  customerId?: string;
  tenantId?: string;
}

export function UsageAnalyticsDashboard({ customerId, tenantId }: UsageAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [periodType, setPeriodType] = useState<string>('daily');

  // Fetch usage analytics
  const { 
    data: analyticsData, 
    isLoading, 
    isError, 
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/customer-portal/usage-analytics', { timeRange, periodType }],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeRange,
        periodType,
        includeComparison: 'true',
        includeCosts: 'true',
        includeRecommendations: 'true'
      });
      
      return await apiRequest(`/api/customer-portal/usage-analytics?${params}`);
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });

  const analytics: UsageAnalytics | null = analyticsData?.data || analyticsData || null;

  if (isLoading) {
    return <AnalyticsLoadingSkeleton />;
  }

  if (isError) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <h3 className="font-medium">Failed to load usage analytics</h3>
              <p className="text-sm mt-1">{error?.message || 'Please try again'}</p>
            </div>
          </div>
          <Button onClick={() => refetch()} className="mt-4" variant="outline" size="sm">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">No usage data available</h3>
            <p className="text-sm">Usage analytics will appear here once meter readings are submitted.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="usage-analytics-dashboard">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="title-usage-analytics">
            Usage Analytics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track printing patterns, costs, and efficiency across your fleet
          </p>
        </div>
        
        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={setTimeRange} data-testid="select-time-range">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={periodType} onValueChange={setPeriodType} data-testid="select-period-type">
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Volume"
          value={analytics.metrics.totalVolume.toLocaleString()}
          change={analytics.comparison.percentageChange}
          trend={analytics.comparison.trendDirection}
          icon={<Printer className="h-4 w-4" />}
          color={CHART_COLORS[0]}
          data-testid="metric-total-volume"
        />
        
        <MetricCard
          title="Average Daily"
          value={Math.round(analytics.metrics.averageDaily).toLocaleString()}
          change={((analytics.comparison.current.averageDaily - analytics.comparison.previous.averageDaily) / analytics.comparison.previous.averageDaily) * 100}
          trend={analytics.comparison.current.averageDaily > analytics.comparison.previous.averageDaily ? 'up' : analytics.comparison.current.averageDaily < analytics.comparison.previous.averageDaily ? 'down' : 'stable'}
          icon={<BarChart3 className="h-4 w-4" />}
          color={CHART_COLORS[1]}
          data-testid="metric-average-daily"
        />
        
        <MetricCard
          title="Total Cost"
          value={`$${analytics.metrics.totalCost.toFixed(2)}`}
          change={((analytics.comparison.current.totalCost - analytics.comparison.previous.totalCost) / analytics.comparison.previous.totalCost) * 100}
          trend={analytics.comparison.current.totalCost > analytics.comparison.previous.totalCost ? 'up' : analytics.comparison.current.totalCost < analytics.comparison.previous.totalCost ? 'down' : 'stable'}
          icon={<DollarSign className="h-4 w-4" />}
          color={CHART_COLORS[2]}
          data-testid="metric-total-cost"
        />
        
        <MetricCard
          title="Efficiency Score"
          value={`${Math.round(analytics.metrics.efficiencyScore)}%`}
          change={((analytics.comparison.current.efficiencyScore - analytics.comparison.previous.efficiencyScore) / analytics.comparison.previous.efficiencyScore) * 100}
          trend={analytics.comparison.current.efficiencyScore > analytics.comparison.previous.efficiencyScore ? 'up' : analytics.comparison.current.efficiencyScore < analytics.comparison.previous.efficiencyScore ? 'down' : 'stable'}
          icon={<Zap className="h-4 w-4" />}
          color={CHART_COLORS[3]}
          target={100}
          data-testid="metric-efficiency-score"
        />
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          <TabsTrigger value="costs" data-testid="tab-costs">Costs</TabsTrigger>
          <TabsTrigger value="equipment" data-testid="tab-equipment">Equipment</TabsTrigger>
          <TabsTrigger value="patterns" data-testid="tab-patterns">Patterns</TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">Insights</TabsTrigger>
        </TabsList>

        {/* Usage Trends */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Usage Trends
                </CardTitle>
                <CardDescription>
                  Volume trends over time by print type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ComposedChart
                  data={analytics.trends}
                  xKey="date"
                  lines={[
                    { key: 'totalImpressions', name: 'Total', color: CHART_COLORS[0] },
                    { key: 'blackWhiteImpressions', name: 'B&W', color: CHART_COLORS[1] },
                    { key: 'colorImpressions', name: 'Color', color: CHART_COLORS[2] }
                  ]}
                  height={300}
                  data-testid="chart-usage-trends"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cost & Efficiency Trends
                </CardTitle>
                <CardDescription>
                  Cost estimates and efficiency over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ComposedChart
                  data={analytics.trends}
                  xKey="date"
                  lines={[
                    { key: 'costEstimate', name: 'Cost ($)', color: CHART_COLORS[2] }
                  ]}
                  bars={[
                    { key: 'efficiency', name: 'Efficiency (%)', color: CHART_COLORS[4] }
                  ]}
                  height={300}
                  data-testid="chart-cost-efficiency"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cost Analysis */}
        <TabsContent value="costs" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cost Breakdown
                </CardTitle>
                <CardDescription>
                  Distribution of printing costs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PieChart
                  data={[
                    { name: 'Black & White', value: analytics.costBreakdown.blackWhiteCost },
                    { name: 'Color', value: analytics.costBreakdown.colorCost },
                    { name: 'Large Format', value: analytics.costBreakdown.largeFormatCost },
                    { name: 'Scanning', value: analytics.costBreakdown.scanCost },
                    { name: 'Maintenance', value: analytics.costBreakdown.maintenanceCost },
                    { name: 'Supplies', value: analytics.costBreakdown.supplyCost }
                  ]}
                  height={300}
                  data-testid="chart-cost-breakdown"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Metrics</CardTitle>
                <CardDescription>
                  Key cost indicators and comparisons
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="font-medium">Cost per Page</span>
                    <span className="text-lg font-bold">${analytics.metrics.costPerPage.toFixed(3)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="font-medium">Color Ratio</span>
                    <span className="text-lg font-bold">{analytics.metrics.colorRatio.toFixed(1)}%</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="font-medium">Carbon Footprint</span>
                    <span className="text-lg font-bold">{analytics.metrics.carbonFootprint.toFixed(1)}kg CO₂</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="font-medium text-green-700 dark:text-green-300">Paper Saved</span>
                    <span className="text-lg font-bold text-green-700 dark:text-green-300">
                      {analytics.metrics.paperSaved.toFixed(1)} sheets
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Equipment Usage */}
        <TabsContent value="equipment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Equipment Performance
              </CardTitle>
              <CardDescription>
                Usage statistics and efficiency by device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.equipmentUsage.map((equipment) => (
                  <div 
                    key={equipment.equipmentId} 
                    className="p-4 border rounded-lg space-y-3"
                    data-testid={`equipment-card-${equipment.equipmentId}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{equipment.equipmentName}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Serial: {equipment.serialNumber}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={equipment.trendDirection === 'up' ? 'default' : 
                                     equipment.trendDirection === 'down' ? 'destructive' : 'secondary'}>
                          {equipment.trendDirection === 'up' ? <TrendingUp className="h-3 w-3" /> :
                           equipment.trendDirection === 'down' ? <TrendingDown className="h-3 w-3" /> :
                           <Minus className="h-3 w-3" />}
                          {equipment.trendDirection}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Total Volume</p>
                        <p className="font-medium">{equipment.totalImpressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Monthly Avg</p>
                        <p className="font-medium">{Math.round(equipment.monthlyAverage).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Utilization</p>
                        <p className="font-medium">{equipment.utilizationRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Efficiency</p>
                        <p className="font-medium">{equipment.efficiency.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Patterns */}
        <TabsContent value="patterns" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Daily Usage Patterns
                </CardTitle>
                <CardDescription>
                  Average volume by day of week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={analytics.peakUsage.dailyPeaks.map(peak => ({
                    name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][peak.dayOfWeek],
                    value: peak.averageVolume
                  }))}
                  xKey="name"
                  yKey="value"
                  height={250}
                  data-testid="chart-daily-patterns"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Peak Usage Hours
                </CardTitle>
                <CardDescription>
                  Average volume by hour of day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LineChart
                  data={analytics.peakUsage.hourlyPeaks.map(peak => ({
                    hour: `${peak.hour}:00`,
                    volume: peak.averageVolume
                  }))}
                  xKey="hour"
                  yKey="volume"
                  height={250}
                  data-testid="chart-hourly-patterns"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Smart Recommendations
              </CardTitle>
              <CardDescription>
                Actionable insights to optimize your printing operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.recommendations.map((rec, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border-l-4 ${
                      rec.type === 'cost_saving' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                      rec.type === 'efficiency' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                      rec.type === 'environmental' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' :
                      'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                    }`}
                    data-testid={`recommendation-${index}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {rec.type === 'cost_saving' && <DollarSign className="h-4 w-4 text-green-600" />}
                          {rec.type === 'efficiency' && <Zap className="h-4 w-4 text-blue-600" />}
                          {rec.type === 'environmental' && <Leaf className="h-4 w-4 text-emerald-600" />}
                          {rec.type === 'maintenance' && <Target className="h-4 w-4 text-yellow-600" />}
                          <h4 className="font-medium">{rec.title}</h4>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{rec.description}</p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Badge variant={rec.impact === 'high' ? 'default' : rec.impact === 'medium' ? 'secondary' : 'outline'}>
                          {rec.impact} impact
                        </Badge>
                        <Badge variant={rec.effort === 'low' ? 'default' : rec.effort === 'medium' ? 'secondary' : 'outline'}>
                          {rec.effort} effort
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
                
                {analytics.recommendations.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="font-medium mb-2">All systems optimized!</h3>
                    <p className="text-sm">Your usage patterns look efficient. Keep up the good work!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Loading skeleton component
function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default UsageAnalyticsDashboard;