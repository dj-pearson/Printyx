import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RefreshCw, Building2, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import LocationPipelineGrid from '@/components/reports/supervisor/LocationPipelineGrid';
import LocationPerformanceTable from '@/components/reports/supervisor/LocationPerformanceTable';
import LocationQuotaTracker from '@/components/reports/supervisor/LocationQuotaTracker';
import LocationActivityChart from '@/components/reports/supervisor/LocationActivityChart';
import type {
  ScopedActivityReport,
  ScopedPerformanceReport,
  ScopedPipelineReport,
  ScopedQuotaReport,
} from '@/types/scoped-sales-reports';

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
  const {
    data: pipelineData,
    isLoading: pipelineLoading,
    refetch: refetchPipeline,
  } = useQuery<ScopedPipelineReport>({
    queryKey: ['reports', 'sales-supervisor', 'location', 'pipeline-overview', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      return apiRequest(`/api/reports/sales-supervisor/location/pipeline-overview?${params}`);
    },
  });

  // Fetch location performance (Report 9)
  const { data: performanceData, isLoading: performanceLoading } =
    useQuery<ScopedPerformanceReport>({
      queryKey: ['reports', 'sales-supervisor', 'location', 'performance', dateRange],
      queryFn: async () => {
        const params = new URLSearchParams({
          dateFrom: dateRange.from.toISOString(),
          dateTo: dateRange.to.toISOString(),
        });
        return apiRequest(`/api/reports/sales-supervisor/location/performance?${params}`);
      },
    });

  // Fetch location quota (Report 10)
  const { data: quotaData, isLoading: quotaLoading } = useQuery<ScopedQuotaReport>({
    queryKey: ['reports', 'sales-supervisor', 'location', 'quota', 'current'],
    queryFn: () => apiRequest('/api/reports/sales-supervisor/location/quota?period=current'),
  });

  // Fetch location activity (Report 11)
  const { data: activityData, isLoading: activityLoading } = useQuery<ScopedActivityReport>({
    queryKey: ['reports', 'sales-supervisor', 'location', 'activity', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      return apiRequest(`/api/reports/sales-supervisor/location/activity?${params}`);
    },
  });

  const handleRefresh = () => {
    refetchPipeline();
  };

  // CR-034: the activity report sends per-unit counts and a `totals` object, but
  // no grand total and no per-location average — both are summed here.
  const activityTotals = activityData?.totals;
  const totalActivities = activityTotals
    ? activityTotals.calls +
      activityTotals.emails +
      activityTotals.meetings +
      activityTotals.demos +
      activityTotals.proposals
    : 0;
  const locationCount = activityData?.regions?.length ?? 0;

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
                    {format(dateRange.from, 'MMM dd, yyyy')} -{' '}
                    {format(dateRange.to, 'MMM dd, yyyy')}
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
                  onClick={() =>
                    setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })
                  }
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
            {/* CR-034: the summary is { totalDeals, totalValue, healthScore }.
                totalLocations, totalPipeline, overallAttainment, locationsOnTrack,
                locationsAtRisk and every activity summary field read here were
                names the handler has never emitted, so all four KPI cards showed
                a hardcoded 0. The unit count comes off byUnit. */}
            <div className="text-2xl font-bold">{pipelineData?.byUnit?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Active locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((pipelineData?.summary?.totalValue ?? 0) / 1000).toFixed(0)}K
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
              {quotaData?.degraded?.salesQuotasTable
                ? '--'
                : `${(quotaData?.summary.averageAttainment ?? 0).toFixed(0)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {quotaData?.degraded?.salesQuotasTable
                ? 'No quotas defined'
                : `${performanceData?.attainmentRanges.onTrack ?? 0} on track`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActivities.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {locationCount > 0 ? Math.round(totalActivities / locationCount) : 0} per location
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CR-034: an at-risk banner used to sit here, gated on
          quotaData.summary.locationsAtRisk — a field that does not exist, so it
          never rendered. It cannot be revived from attainmentRanges.atRisk
          either: the handler sets that to regions.length unconditionally because
          quotas are unknowable, so the banner would fire for every location on
          every load and claim they are all below 75% of a target nobody set. */}

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
              <CardDescription>Pipeline breakdown by location and stage</CardDescription>
            </CardHeader>
            <CardContent>
              {pipelineLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <LocationPipelineGrid
                  byUnit={pipelineData?.byUnit ?? []}
                  aggregated={pipelineData?.aggregated ?? []}
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
                  locations={performanceData?.regions ?? []}
                  summary={performanceData?.summary}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quota" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location Quota Tracking</CardTitle>
              <CardDescription>Monitor quota attainment and forecast by location</CardDescription>
            </CardHeader>
            <CardContent>
              {quotaLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <LocationQuotaTracker report={quotaData} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location Activity Summary</CardTitle>
              <CardDescription>Track sales activities by location</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <LocationActivityChart
                  regions={activityData?.regions ?? []}
                  totals={activityData?.totals}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
