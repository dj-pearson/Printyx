import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  MapPin,
  DollarSign,
  TrendingUp,
  Target,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

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
  } = useQuery({
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
  const { data: performanceData, isLoading: performanceLoading } = useQuery({
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
  const { data: quotaData, isLoading: quotaLoading } = useQuery({
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
  const { data: activityData, isLoading: activityLoading } = useQuery({
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
            <div className="text-2xl font-bold">{pipelineData?.summary?.totalRegions || 0}</div>
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
              ${((pipelineData?.summary?.totalPipeline || 0) / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              {pipelineData?.summary?.totalDeals || 0} active deals
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
              {quotaData?.summary?.overallAttainment?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {quotaData?.summary?.regionsOnTrack || 0} on track /{' '}
              {quotaData?.summary?.regionsAtRisk || 0} at risk
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
                  {pipelineData?.aggregated?.map((stage: any) => (
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
                  {performanceData?.regions?.map((region: any) => (
                    <div
                      key={region.regionId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">
                          #{region.ranking} {region.regionName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {region.locationCount} locations · {region.teamSize} reps ·{' '}
                          {region.dealsWon} deals won
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-lg font-bold">
                          ${(region.totalRevenue / 1000).toFixed(0)}K
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {region.winRate.toFixed(1)}% win rate ·{' '}
                          {region.quotaAttainment.toFixed(0)}% quota
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
              {quotaLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {quotaData?.quotas?.map((quota: any) => (
                    <div
                      key={quota.regionId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{quota.regionName}</div>
                        <div className="text-sm text-muted-foreground">
                          {quota.locationCount} locations · ${(quota.quotaAmount / 1000).toFixed(0)}
                          K quota
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-2xl font-bold ${quota.onTrack ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {quota.attainmentPercent.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ${(quota.actualRevenue / 1000).toFixed(0)}K / $
                          {(quota.quotaAmount / 1000).toFixed(0)}K
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  {activityData?.activities?.map((activity: any) => (
                    <div key={activity.regionId} className="p-4 border rounded-lg">
                      <div className="font-medium mb-2">{activity.regionName}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Calls: {activity.calls}</div>
                        <div>Emails: {activity.emails}</div>
                        <div>Meetings: {activity.meetings}</div>
                        <div>Demos: {activity.demos}</div>
                        <div>Proposals: {activity.proposals}</div>
                        <div className="font-medium">Total: {activity.totalActivities}</div>
                      </div>
                      <div className="mt-2 pt-2 border-t text-sm text-muted-foreground">
                        {activity.locationCount} locations · {activity.activitiesPerRep.toFixed(1)}{' '}
                        per rep
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
