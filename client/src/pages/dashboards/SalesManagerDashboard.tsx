import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RefreshCw, MapPin, DollarSign, TrendingUp, Target } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
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

export default function SalesManagerDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch regional pipeline overview (Report 12)
  const {
    data: pipelineData,
    isLoading: pipelineLoading,
    refetch: refetchPipeline,
  } = useQuery<ScopedPipelineReport>({
    queryKey: ['reports', 'sales-manager', 'regional-pipeline', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      return apiRequest(`/api/reports/sales-manager/regional-pipeline?${params}`);
    },
  });

  // Fetch regional performance (Report 13)
  const { data: performanceData, isLoading: performanceLoading } =
    useQuery<ScopedPerformanceReport>({
      queryKey: ['reports', 'sales-manager', 'regional-performance', dateRange],
      queryFn: async () => {
        const params = new URLSearchParams({
          dateFrom: dateRange.from.toISOString(),
          dateTo: dateRange.to.toISOString(),
        });
        return apiRequest(`/api/reports/sales-manager/regional-performance?${params}`);
      },
    });

  // Fetch regional quota (Report 14)
  const { data: quotaData, isLoading: quotaLoading } = useQuery<ScopedQuotaReport>({
    queryKey: ['reports', 'sales-manager', 'regional-quota', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      return apiRequest(`/api/reports/sales-manager/regional-quota?${params}`);
    },
  });

  // Fetch regional activity (Report 15)
  const { data: activityData, isLoading: activityLoading } = useQuery<ScopedActivityReport>({
    queryKey: ['reports', 'sales-manager', 'regional-activity', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      return apiRequest(`/api/reports/sales-manager/regional-activity?${params}`);
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
          <h1 className="text-3xl font-bold tracking-tight">Sales Manager Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor regional performance, pipeline, quota attainment, and team activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* CR-034: every query on this page keys on `dateRange`, but nothing
              ever called setDateRange — the range was frozen to the current
              month and the imported date helpers sat unused. This is the picker
              the supervisor dashboard already has. */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, 'MMM dd, yyyy')} - {format(dateRange.to, 'MMM dd, yyyy')}
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
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={pipelineLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${pipelineLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Regions</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {/* CR-034: summary has no totalRegions — the unit list is byUnit. */}
            <div className="text-2xl font-bold">{pipelineData?.byUnit.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Across your territory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {/* CR-034: the field is totalValue; totalPipeline does not exist. */}$
              {((pipelineData?.summary.totalValue ?? 0) / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              {pipelineData?.summary.totalDeals ?? 0} active deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quota Attainment</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {/* CR-034: averageAttainment, not overallAttainment. Always 0
                  today — the quota report is degraded, there is no
                  sales_quotas table. */}
              {(quotaData?.summary.averageAttainment ?? 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {/* CR-034: these counts are on the PERFORMANCE report, under
                  attainmentRanges — never on the quota one. Both read 0 and
                  every unit counts as at-risk while quotas are unknowable. */}
              {performanceData?.attainmentRanges.onTrack ?? 0} on track /{' '}
              {performanceData?.attainmentRanges.atRisk ?? 0} at risk
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceData?.summary?.averageWinRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              ${((performanceData?.summary?.totalRevenue || 0) / 1000).toFixed(0)}K total revenue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="quota">Quota Tracking</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline by Stage</CardTitle>
              <CardDescription>Distribution across all regions</CardDescription>
            </CardHeader>
            <CardContent>
              {pipelineLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-4">
                  {pipelineData?.aggregated?.map((stage) => (
                    <div
                      key={stage.stage}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{stage.stage}</div>
                        <div className="text-sm text-muted-foreground">
                          ${(stage.avgValuePerRegion / 1000).toFixed(1)}K avg per region
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{stage.totalDeals}</div>
                        <div className="text-sm text-muted-foreground">
                          ${(stage.totalValue / 1000).toFixed(0)}K
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Regional Performance Rankings</CardTitle>
              <CardDescription>Performance metrics by region</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {/* CR-034: the report returns { unitId, unitName, revenue,
                      deals, winRate, pipelineValue }. This list read ranking,
                      regionName, locationCount, teamSize, dealsWon and
                      totalRevenue — six names the handler has never emitted, so
                      every row rendered blank against live data. It also has no
                      order of its own, so the ranking is derived here from
                      revenue rather than read off a field that does not exist.
                      quotaAttainment is dropped: it is hardcoded 0 upstream. */}
                  {[...(performanceData?.regions ?? [])]
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((region, index) => (
                      <div
                        key={region.unitId}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="font-medium">
                            #{index + 1} {region.unitName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {region.deals} deals won · ${(region.pipelineValue / 1000).toFixed(0)}K
                            open pipeline
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-lg font-bold">
                            ${(region.revenue / 1000).toFixed(0)}K
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {region.winRate.toFixed(1)}% win rate
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quota" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quota Attainment by Region</CardTitle>
              <CardDescription>Track quota performance across regions</CardDescription>
            </CardHeader>
            <CardContent>
              {/* CR-034: this tab mapped quotaData.quotas, reading regionId,
                  regionName, locationCount, quotaAmount, actualRevenue, onTrack
                  and attainmentPercent. None of them exist. The endpoint returns
                  { regions: [], summary: { totalQuota: 0, totalActual: 0,
                  averageAttainment: 0 }, degraded: { salesQuotasTable: true } }
                  unconditionally — there is no sales_quotas table, so it never
                  reaches a query. The list was therefore always empty and the
                  card rendered as a blank box. Say why instead. */}
              {quotaLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : quotaData?.degraded?.salesQuotasTable || quotaData?.regions?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Target className="h-10 w-10 mb-3 text-muted-foreground opacity-40" />
                  <p className="font-medium">Quota tracking is not set up</p>
                  <p className="text-sm text-muted-foreground max-w-md mt-1">
                    No quotas have been defined, so attainment cannot be measured. The zeros on this
                    dashboard mean unknown, not missed.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity by Region</CardTitle>
              <CardDescription>Sales activities breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {/* CR-034: the collection is `regions`, keyed by unitId /
                      unitName. This read `activities` with regionId, regionName,
                      totalActivities, locationCount and activitiesPerRep — the
                      list was undefined, so the tab was empty. Total is summed
                      here because the handler does not send one. */}
                  {activityData?.regions?.map((activity) => {
                    const total =
                      activity.calls +
                      activity.emails +
                      activity.meetings +
                      activity.demos +
                      activity.proposals;
                    return (
                      <div key={activity.unitId} className="p-4 border rounded-lg">
                        <div className="font-medium mb-2">{activity.unitName}</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Calls: {activity.calls}</div>
                          <div>Emails: {activity.emails}</div>
                          <div>Meetings: {activity.meetings}</div>
                          <div>Demos: {activity.demos}</div>
                          <div>Proposals: {activity.proposals}</div>
                          <div className="font-medium">Total: {total}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
