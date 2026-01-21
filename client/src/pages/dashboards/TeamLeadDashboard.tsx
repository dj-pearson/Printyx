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
  Users,
  TrendingUp,
  DollarSign,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import TeamPerformanceTable from '@/components/reports/team/TeamPerformanceTable';
import TeamPipelineView from '@/components/reports/team/TeamPipelineView';
import DispatchQueueTable from '@/components/reports/team/DispatchQueueTable';

interface DateRange {
  from: Date;
  to: Date;
}

export default function TeamLeadDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch team performance comparison (Report 6)
  const {
    data: teamPerformance,
    isLoading: performanceLoading,
    refetch: refetchPerformance,
  } = useQuery({
    queryKey: ['sales-reports', 'team', 'comparison', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/sales-reports/team/comparison?${params}`);
      if (!res.ok) throw new Error('Failed to fetch team performance');
      return res.json();
    },
  });

  // Fetch team pipeline summary (Report 7)
  const { data: pipelineSummary, isLoading: pipelineLoading } = useQuery({
    queryKey: ['sales-reports', 'team', 'pipeline-summary', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/sales-reports/team/pipeline-summary?${params}`);
      if (!res.ok) throw new Error('Failed to fetch pipeline summary');
      return res.json();
    },
  });

  // Fetch dispatch queue (Report 28)
  const { data: dispatchQueue, isLoading: dispatchLoading } = useQuery({
    queryKey: ['service-reports', 'team', 'dispatch-queue'],
    queryFn: async () => {
      const res = await fetch('/api/service-reports/team/dispatch-queue');
      if (!res.ok) throw new Error('Failed to fetch dispatch queue');
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetchPerformance();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Lead Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor team performance, pipeline, and service operations
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
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineSummary?.metrics?.teamSize || 0}</div>
            <p className="text-xs text-muted-foreground">Active team members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((pipelineSummary?.summary?.totalTeamValue || 0) / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              {pipelineSummary?.summary?.totalTeamDeals || 0} total deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per Rep</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((pipelineSummary?.metrics?.averageValuePerRep || 0) / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              {pipelineSummary?.metrics?.averageDealsPerRep?.toFixed(1) || 0} deals/rep
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Queue</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dispatchQueue?.summary?.totalTickets || 0}</div>
            <p className="text-xs text-muted-foreground">
              {dispatchQueue?.summary?.unassigned || 0} unassigned
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Banner for Critical Issues */}
      {(dispatchQueue?.summary?.overdue > 0 || dispatchQueue?.summary?.atRisk > 0) && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <div className="font-semibold text-orange-900 dark:text-orange-100">
                  Attention Required
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  {dispatchQueue?.summary?.overdue > 0 && (
                    <span>{dispatchQueue.summary.overdue} overdue tickets</span>
                  )}
                  {dispatchQueue?.summary?.overdue > 0 && dispatchQueue?.summary?.atRisk > 0 && (
                    <span>, </span>
                  )}
                  {dispatchQueue?.summary?.atRisk > 0 && (
                    <span>{dispatchQueue.summary.atRisk} at-risk tickets</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Team Performance</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="dispatch">Dispatch Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Performance Comparison</CardTitle>
              <CardDescription>Compare individual rep performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <TeamPerformanceTable
                  comparison={teamPerformance?.comparison || []}
                  summary={teamPerformance?.summary}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Pipeline Summary</CardTitle>
              <CardDescription>Aggregated pipeline view with individual breakdowns</CardDescription>
            </CardHeader>
            <CardContent>
              {pipelineLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <TeamPipelineView
                  teamPipeline={pipelineSummary?.teamPipeline || []}
                  individualPipelines={pipelineSummary?.individualPipelines || []}
                  summary={pipelineSummary?.summary}
                  metrics={pipelineSummary?.metrics}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dispatch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Dispatch Queue</CardTitle>
              <CardDescription>Manage team service tickets and assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {dispatchLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DispatchQueueTable
                  queue={dispatchQueue?.queue || []}
                  summary={dispatchQueue?.summary}
                  workloadMetrics={dispatchQueue?.workloadMetrics}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
