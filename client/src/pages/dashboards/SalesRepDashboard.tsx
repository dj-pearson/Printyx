import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CalendarIcon,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Award,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import PipelineFunnel from '@/components/reports/sales/PipelineFunnel';
import QuotaGauge from '@/components/reports/sales/QuotaGauge';
import ActivityChart from '@/components/reports/sales/ActivityChart';
import LeaderboardTable from '@/components/reports/sales/LeaderboardTable';

interface DateRange {
  from: Date;
  to: Date;
}

export default function SalesRepDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch pipeline data
  const {
    data: pipelineData,
    isLoading: pipelineLoading,
    refetch: refetchPipeline,
  } = useQuery({
    queryKey: ['sales-reports', 'personal', 'pipeline', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/sales-reports/personal/pipeline?${params}`);
      if (!res.ok) throw new Error('Failed to fetch pipeline');
      return res.json();
    },
  });

  // Fetch quota data
  const { data: quotaData, isLoading: quotaLoading } = useQuery({
    queryKey: ['sales-reports', 'personal', 'quota', 'current'],
    queryFn: async () => {
      const res = await fetch('/api/sales-reports/personal/quota?period=current');
      if (!res.ok) throw new Error('Failed to fetch quota');
      return res.json();
    },
  });

  // Fetch activity data
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['sales-reports', 'personal', 'activity', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
        granularity: 'day',
      });
      const res = await fetch(`/api/sales-reports/personal/activity?${params}`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
  });

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['sales-reports', 'personal', 'leaderboard', 'revenue', 'location'],
    queryFn: async () => {
      const params = new URLSearchParams({
        metric: 'revenue',
        scope: 'location',
      });
      const res = await fetch(`/api/sales-reports/personal/leaderboard?${params}`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
  });

  // Fetch commission data
  const { data: commissionData } = useQuery({
    queryKey: ['sales-reports', 'personal', 'commissions', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/sales-reports/personal/commissions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch commissions');
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
          <h1 className="text-3xl font-bold tracking-tight">Sales Dashboard</h1>
          <p className="text-muted-foreground">Track your performance, pipeline, and goals</p>
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
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pipelineData?.totalValue ? `$${(pipelineData.totalValue / 1000).toFixed(0)}K` : '$0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {pipelineData?.totalDeals || 0} deals in pipeline
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
              {quotaData?.quota?.attainmentPercent
                ? `${quotaData.quota.attainmentPercent.toFixed(0)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              ${(quotaData?.quota?.actualRevenue / 1000 || 0).toFixed(0)}K of $
              {(quotaData?.quota?.quotaAmount / 1000 || 0).toFixed(0)}K
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commissions (MTD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(commissionData?.summary?.totalCommission || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {commissionData?.summary?.count || 0} deals closed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leaderboard Rank</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#{leaderboardData?.myPosition?.rank || '-'}</div>
            <p className="text-xs text-muted-foreground">
              Top {leaderboardData?.percentile || 0}% in location
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quota Progress</CardTitle>
                <CardDescription>Current month performance vs target</CardDescription>
              </CardHeader>
              <CardContent>
                {quotaLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <QuotaGauge
                    current={quotaData?.quota?.actualRevenue || 0}
                    target={quotaData?.quota?.quotaAmount || 0}
                    percent={quotaData?.quota?.attainmentPercent || 0}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pipeline Funnel</CardTitle>
                <CardDescription>Deals by stage</CardDescription>
              </CardHeader>
              <CardContent>
                {pipelineLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <PipelineFunnel stages={pipelineData?.pipeline || []} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Activity Trend</CardTitle>
              <CardDescription>Daily activities over time</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ActivityChart activities={activityData?.activities || []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Details</CardTitle>
              <CardDescription>Complete pipeline breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {pipelineLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <PipelineFunnel stages={pipelineData?.pipeline || []} detailed />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Analysis</CardTitle>
              <CardDescription>Breakdown of your sales activities</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <ActivityChart activities={activityData?.activities || []} />
                  <div className="grid grid-cols-5 gap-4 mt-4">
                    {Object.entries(activityData?.totals || {}).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <div className="text-2xl font-bold">{value as number}</div>
                        <div className="text-xs text-muted-foreground capitalize">{key}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Leaderboard</CardTitle>
              <CardDescription>Location performance rankings</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboardLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <LeaderboardTable
                  leaderboard={leaderboardData?.leaderboard || []}
                  currentUserId={leaderboardData?.myPosition?.userId}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
