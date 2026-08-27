import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RefreshCw, MapPin, Wrench, Clock, CheckCircle2 } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import type {
  ScopedServiceActivityReport,
  ScopedServiceCallsReport,
  ScopedServicePerformanceReport,
  ScopedServiceSlaReport,
} from '@/types/scoped-service-reports';

interface DateRange {
  from: Date;
  to: Date;
}

/**
 * CR-034: every field on this page was repointed at the shape
 * supabase/functions/reports/handlers/scoped-service.ts actually returns.
 *
 * The four queries were untyped, so `apiRequest<T = any>` handed back `any` and
 * nothing checked the reads. What they read was a design that was never built:
 * summary.totalRegions, summary.avgFirstTimeFixRate, insights.healthStatus, an
 * `aggregated` priority breakdown, `slas` and `activities` collections, and
 * per-row ranking / regionCount / technicianCount / firstTimeFixRate /
 * slaCompliance / utilizationRate / travelHours / diagnosticHours / repairHours /
 * documentationHours. None of those exist. The per-unit collection is `regions`
 * under every scope, keyed by unitId / unitName.
 */
export default function ServiceManagerDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch service call volume per unit (Report 33)
  const {
    data: serviceCallsData,
    isLoading: serviceCallsLoading,
    refetch: refetchServiceCalls,
  } = useQuery<ScopedServiceCallsReport>({
    queryKey: ['reports', 'service-manager', 'regional-service-calls', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      return apiRequest(`/api/reports/service-manager/regional-service-calls?${params}`);
    },
  });

  // Fetch performance per unit (Report 34)
  const { data: performanceData, isLoading: performanceLoading } =
    useQuery<ScopedServicePerformanceReport>({
      queryKey: ['reports', 'service-manager', 'regional-performance', dateRange],
      queryFn: async () => {
        const params = new URLSearchParams({
          dateFrom: dateRange.from.toISOString(),
          dateTo: dateRange.to.toISOString(),
        });
        return apiRequest(`/api/reports/service-manager/regional-performance?${params}`);
      },
    });

  // Fetch SLA per unit (Report 35) — degraded upstream, see below
  const { data: slaData, isLoading: slaLoading } = useQuery<ScopedServiceSlaReport>({
    queryKey: ['reports', 'service-manager', 'regional-sla', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      return apiRequest(`/api/reports/service-manager/regional-sla?${params}`);
    },
  });

  // Fetch technician activity per unit (Report 36)
  const { data: activityData, isLoading: activityLoading } = useQuery<ScopedServiceActivityReport>({
    queryKey: ['reports', 'service-manager', 'regional-activity', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      return apiRequest(`/api/reports/service-manager/regional-activity?${params}`);
    },
  });

  const handleRefresh = () => {
    refetchServiceCalls();
  };

  const slaUnavailable =
    Boolean(slaData?.degraded?.slaDeadline) || (slaData?.regions?.length ?? 0) === 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Manager Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor regional service volume, resolution times, and technician activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* CR-034: all four queries key on `dateRange`, but nothing ever called
              setDateRange — the range was frozen to the current month and the
              date helpers sat imported and unused. */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={serviceCallsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${serviceCallsLoading ? 'animate-spin' : ''}`} />
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
            <div className="text-2xl font-bold">{serviceCallsData?.summary.totalUnits ?? 0}</div>
            <p className="text-xs text-muted-foreground">Across your territory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Service Calls</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceCallsData?.summary.totalCalls ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {/* CR-034: this card showed summary.avgFirstTimeFixRate over an
                insights.healthStatus caption. Neither is returned, and neither
                can be: nothing in the schema records a first-time fix. Completion
                rate is the measurement that does exist. */}
            <div className="text-2xl font-bold">
              {serviceCallsData && serviceCallsData.summary.totalCalls > 0
                ? `${Math.round(
                    (serviceCallsData.summary.totalCompleted /
                      serviceCallsData.summary.totalCalls) *
                      100,
                  )}%`
                : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {serviceCallsData?.summary.totalCompleted ?? 0} of{' '}
              {serviceCallsData?.summary.totalCalls ?? 0} calls closed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {/* CR-034: read summary.overallCompliance / regionsOnTrack /
                regionsAtRisk, none of which exist. The endpoint is degraded
                unconditionally — service_tickets has no sla_deadline column — so
                a 0% here would be a claim, not a reading. */}
            <div className="text-2xl font-bold">
              {slaUnavailable ? '--' : `${(slaData?.summary.complianceRate ?? 0).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {slaUnavailable ? 'Not tracked' : `${slaData?.summary.onTime ?? 0} on time`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="sla">SLA Tracking</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Calls by Region</CardTitle>
              <CardDescription>Open, in progress and completed volume</CardDescription>
            </CardHeader>
            <CardContent>
              {/* CR-034: this was "Service Calls by Priority", mapping an
                  `aggregated` array of { priority, avgCallsPerRegion, avgDuration }.
                  The endpoint has no priority breakdown at all — it buckets by
                  unit and status — so the tab was permanently empty. */}
              {serviceCallsLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-4">
                  {serviceCallsData?.regions.map((unit) => (
                    <div
                      key={unit.unitId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{unit.unitName}</div>
                        <div className="text-sm text-muted-foreground">
                          {unit.openCalls} open · {unit.inProgressCalls} in progress ·{' '}
                          {unit.technicians} {unit.technicians === 1 ? 'tech' : 'techs'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{unit.totalCalls}</div>
                        <div className="text-sm text-muted-foreground">
                          {unit.completedCalls} completed ({unit.completionRate}%)
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
              <CardTitle>Region Performance Rankings</CardTitle>
              <CardDescription>Ranked by completion rate</CardDescription>
            </CardHeader>
            <CardContent>
              {/* CR-034: the rows are unordered upstream, so the rank is derived
                  here rather than read off a `ranking` field that never existed.
                  FTF, SLA and satisfaction columns are gone: the handler sets all
                  three to null on every row because nothing records them. */}
              {performanceLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {[...(performanceData?.regions ?? [])]
                    .sort((a, b) => b.completionRate - a.completionRate)
                    .map((unit, index) => (
                      <div
                        key={unit.unitId}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="font-medium">
                            #{index + 1} {unit.unitName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {unit.totalCalls} calls · {unit.completedCalls} completed
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-lg font-bold">{unit.completionRate.toFixed(1)}%</div>
                          <div className="text-sm text-muted-foreground">
                            {unit.avgResolutionMinutes > 0
                              ? `${(unit.avgResolutionMinutes / 60).toFixed(1)}h avg resolution`
                              : 'No resolution times recorded'}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SLA Compliance by Region</CardTitle>
              <CardDescription>Response and resolution against target</CardDescription>
            </CardHeader>
            <CardContent>
              {/* CR-034: mapped slaData.slas with regionId, regionName,
                  onTimeCalls, atRiskCalls, overdueCalls, slaCompliancePercent,
                  onTrack and avgResponseTime. The endpoint returns none of them.
                  It has no non-degraded path either: scoped-service.ts answers
                  `sla` with degradedSla() unconditionally, because service_tickets
                  has no sla_deadline column — the original SQL was speculative.
                  So the list was always empty and this card rendered blank. */}
              {slaLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Clock className="h-10 w-10 mb-3 text-muted-foreground opacity-40" />
                  <p className="font-medium">SLA tracking is not available</p>
                  <p className="text-sm text-muted-foreground max-w-md mt-1">
                    Service tickets do not carry an SLA deadline, so compliance cannot be measured.
                    Recording a target response and resolution time per ticket would make this
                    report real.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Technician Activity by Region</CardTitle>
              <CardDescription>Logged service calls, notes and tasks</CardDescription>
            </CardHeader>
            <CardContent>
              {/* CR-034: this was an hours breakdown — travel, diagnostic, repair,
                  documentation, total and a utilization rate. Not one of those is
                  recorded anywhere in the schema. The endpoint counts
                  business_record_activities of type service_call / note / task per
                  unit, so a count is what this shows. */}
              {activityLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {activityData?.regions.map((unit) => {
                    const total = activityData.totals.totalActivities;
                    const share = total > 0 ? (unit.totalActivities / total) * 100 : 0;
                    return (
                      <div
                        key={unit.unitId}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="font-medium">{unit.unitName}</div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{unit.totalActivities}</div>
                          <div className="text-sm text-muted-foreground">
                            {share.toFixed(0)}% of all logged activity
                          </div>
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
