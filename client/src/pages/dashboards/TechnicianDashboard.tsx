import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RefreshCw, Wrench, Package, Clock, CheckCircle2 } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import ServiceCallsList from '@/components/reports/service/ServiceCallsList';
import PartsUsageChart from '@/components/reports/service/PartsUsageChart';
import TimeTrackingChart from '@/components/reports/service/TimeTrackingChart';
import PerformanceMetrics from '@/components/reports/service/PerformanceMetrics';

interface DateRange {
  from: Date;
  to: Date;
}

export default function TechnicianDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch service calls data
  const {
    data: serviceCallsData,
    isLoading: callsLoading,
    refetch: refetchCalls,
  } = useQuery({
    queryKey: ['service-reports', 'personal', 'calls', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/service-reports/personal/calls?${params}`);
      if (!res.ok) throw new Error('Failed to fetch service calls');
      return res.json();
    },
  });

  // Fetch parts usage data
  const { data: partsData, isLoading: partsLoading } = useQuery({
    queryKey: ['service-reports', 'personal', 'parts', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/service-reports/personal/parts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch parts usage');
      return res.json();
    },
  });

  // Fetch time tracking data
  const { data: timeData, isLoading: timeLoading } = useQuery({
    queryKey: ['service-reports', 'personal', 'time', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/service-reports/personal/time?${params}`);
      if (!res.ok) throw new Error('Failed to fetch time tracking');
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetchCalls();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Technician Dashboard</h1>
          <p className="text-muted-foreground">Track your service calls, parts usage, and time</p>
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
            <CardTitle className="text-sm font-medium">Service Calls</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceCallsData?.summary?.totalCalls || 0}</div>
            <p className="text-xs text-muted-foreground">
              {serviceCallsData?.summary?.completed || 0} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">First Time Fix</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {serviceCallsData?.summary?.firstTimeFixRate?.toFixed(0) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {serviceCallsData?.performance?.quality >= 80
                ? 'Excellent'
                : serviceCallsData?.performance?.quality >= 60
                  ? 'Good'
                  : 'Needs Improvement'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parts Cost</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(partsData?.summary?.totalCost || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {partsData?.summary?.totalParts || 0} parts used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billable Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeData?.summary?.billableHours?.toFixed(1) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeData?.summary?.utilizationRate?.toFixed(0) || 0}% utilization
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="calls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calls">Service Calls</TabsTrigger>
          <TabsTrigger value="parts">Parts Usage</TabsTrigger>
          <TabsTrigger value="time">Time Tracking</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Service Calls</CardTitle>
              <CardDescription>Recent and scheduled service calls</CardDescription>
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ServiceCallsList calls={serviceCallsData?.calls || []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parts Usage Analysis</CardTitle>
              <CardDescription>Parts used and costs over time</CardDescription>
            </CardHeader>
            <CardContent>
              {partsLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <PartsUsageChart
                  parts={partsData?.parts || []}
                  summary={partsData?.summary}
                  metrics={partsData?.metrics}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Time Tracking</CardTitle>
              <CardDescription>Hours logged by activity type</CardDescription>
            </CardHeader>
            <CardContent>
              {timeLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <TimeTrackingChart
                  entries={timeData?.entries || []}
                  summary={timeData?.summary}
                  metrics={timeData?.metrics}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Overall performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              {callsLoading || partsLoading || timeLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <PerformanceMetrics
                  callsData={serviceCallsData}
                  partsData={partsData}
                  timeData={timeData}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
