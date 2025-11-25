import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CalendarIcon,
  RefreshCw,
  Building2,
  DollarSign,
  TrendingUp,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import LocationPipelineGrid from '@/components/reports/supervisor/LocationPipelineGrid';
import LocationPerformanceTable from '@/components/reports/supervisor/LocationPerformanceTable';
import LocationQuotaTracker from '@/components/reports/supervisor/LocationQuotaTracker';
import LocationActivityChart from '@/components/reports/supervisor/LocationActivityChart';

interface DateRange {
  from: Date;
  to: Date;
}

export default function SalesSupervisorDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch location pipeline overview (Report 8)
  const { data: pipelineData, isLoading: pipelineLoading, refetch: refetchPipeline } = useQuery({
    queryKey: ['sales-supervisor-reports', 'location', 'pipeline-overview', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/sales-supervisor-reports/location/pipeline-overview?${params}`);
      if (!res.ok) throw new Error('Failed to fetch pipeline overview');
      return res.json();
    },
  });

  // Fetch location performance (Report 9)
  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ['sales-supervisor-reports', 'location', 'performance', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/sales-supervisor-reports/location/performance?${params}`);
      if (!res.ok) throw new Error('Failed to fetch performance');
      return res.json();
    },
  });

  // Fetch location quota (Report 10)
  const { data: quotaData, isLoading: quotaLoading } = useQuery({
    queryKey: ['sales-supervisor-reports', 'location', 'quota', 'current'],
    queryFn: async () => {
      const res = await fetch('/api/sales-supervisor-reports/location/quota?period=current');
      if (!res.ok) throw new Error('Failed to fetch quota');
      return res.json();
    },
  });

  // Fetch location activity (Report 11)
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['sales-supervisor-reports', 'location', 'activity', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/sales-supervisor-reports/location/activity?${params}`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetchPipeline();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Supervisor Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor location performance, pipeline, and team activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from && dateRange.to ? (
                  <>
                    {format(dateRange.from, 'MMM dd, yyyy')} - {format(dateRange.to, 'MMM dd, yyyy')}
                  </>
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
                >
                  This Month
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                >
                  Last 30 Days
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setDateRange({ from: subDays(new Date(), 90), to: new Date() })}
                >
                  Last 90 Days
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pipelineData?.summary?.totalLocations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((pipelineData?.summary?.totalPipeline || 0) / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              {pipelineData?.summary?.totalDeals || 0} deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quota Attainment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quotaData?.summary?.overallAttainment?.toFixed(0) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {quotaData?.summary?.locationsOnTrack || 0} on track
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activityData?.summary?.totalActivities?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {activityData?.summary?.averagePerLocation?.toFixed(0) || 0} per location
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Banner for At-Risk Locations */}
      {quotaData?.summary?.locationsAtRisk > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <div className="font-semibold text-orange-900 dark:text-orange-100">
                  Locations Need Attention
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  {quotaData.summary.locationsAtRisk} location(s) below 75% quota attainment
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="quota">Quota Tracking</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location Pipeline Overview</CardTitle>
              <CardDescription>
                Pipeline breakdown by location and stage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pipelineLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <LocationPipelineGrid
                  pipelines={pipelineData?.pipelines || []}
                  aggregated={pipelineData?.aggregated || []}
                  summary={pipelineData?.summary}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location Performance Metrics</CardTitle>
              <CardDescription>
                Compare revenue, deals, and win rates across locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <LocationPerformanceTable
                  locations={performanceData?.locations || []}
                  summary={performanceData?.summary}
                  insights={performanceData?.insights}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quota" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location Quota Tracking</CardTitle>
              <CardDescription>
                Monitor quota attainment and forecast by location
              </CardDescription>
            </CardHeader>
            <CardContent>
              {quotaLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <LocationQuotaTracker
                  quotas={quotaData?.quotas || []}
                  summary={quotaData?.summary}
                  insights={quotaData?.insights}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location Activity Summary</CardTitle>
              <CardDescription>
                Track sales activities by location
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <LocationActivityChart
                  activities={activityData?.activities || []}
                  summary={activityData?.summary}
                  insights={activityData?.insights}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
