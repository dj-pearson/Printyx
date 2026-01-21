import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Building2,
  Wrench,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

export default function ServiceSupervisorDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch location service calls overview (Report 29)
  const {
    data: serviceCallsData,
    isLoading: serviceCallsLoading,
    refetch: refetchServiceCalls,
  } = useQuery({
    queryKey: ['service-supervisor-reports', 'location', 'service-calls', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/service-supervisor-reports/location-service-calls?${params}`);
      if (!res.ok) throw new Error('Failed to fetch service calls');
      return res.json();
    },
  });

  // Fetch location performance (Report 30)
  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ['service-supervisor-reports', 'location', 'performance', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/service-supervisor-reports/location-performance?${params}`);
      if (!res.ok) throw new Error('Failed to fetch performance');
      return res.json();
    },
  });

  // Fetch location SLA (Report 31)
  const { data: slaData, isLoading: slaLoading } = useQuery({
    queryKey: ['service-supervisor-reports', 'location', 'sla', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/service-supervisor-reports/location-sla?${params}`);
      if (!res.ok) throw new Error('Failed to fetch SLA');
      return res.json();
    },
  });

  // Fetch location activity (Report 32)
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['service-supervisor-reports', 'location', 'activity', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/service-supervisor-reports/location-activity?${params}`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetchServiceCalls();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Supervisor Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor location service performance, SLA compliance, and technician activities
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {serviceCallsData?.summary?.totalLocations || 0}
            </div>
            <p className="text-xs text-muted-foreground">Across your territory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Service Calls</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceCallsData?.summary?.totalCalls || 0}</div>
            <p className="text-xs text-muted-foreground">
              {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg First-Time Fix</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {serviceCallsData?.summary?.avgFirstTimeFixRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {serviceCallsData?.insights?.healthStatus === 'healthy' && 'Excellent performance'}
              {serviceCallsData?.insights?.healthStatus === 'fair' && 'Good performance'}
              {serviceCallsData?.insights?.healthStatus === 'needs_attention' &&
                'Needs improvement'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {slaData?.summary?.overallCompliance?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {slaData?.summary?.locationsOnTrack || 0} on track /{' '}
              {slaData?.summary?.locationsAtRisk || 0} at risk
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
              <CardTitle>Service Calls by Priority</CardTitle>
              <CardDescription>Distribution of service calls across locations</CardDescription>
            </CardHeader>
            <CardContent>
              {serviceCallsLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-4">
                  {serviceCallsData?.aggregated?.map((priority: any) => (
                    <div
                      key={priority.priority}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{priority.priority}</div>
                        <div className="text-sm text-muted-foreground">
                          {priority.avgCallsPerLocation.toFixed(1)} avg per location
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{priority.totalCalls}</div>
                        <div className="text-sm text-muted-foreground">
                          {priority.avgDuration.toFixed(1)}h avg duration
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
              <CardTitle>Location Performance Rankings</CardTitle>
              <CardDescription>Performance metrics by location</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {performanceData?.locations?.map((location: any) => (
                    <div
                      key={location.locationId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">
                          #{location.ranking} {location.locationName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {location.technicianCount} techs · {location.totalCalls} calls
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-sm">FTF: {location.firstTimeFixRate.toFixed(1)}%</div>
                        <div className="text-sm">SLA: {location.slaCompliance.toFixed(1)}%</div>
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
              <CardTitle>SLA Compliance by Location</CardTitle>
              <CardDescription>Track SLA performance across locations</CardDescription>
            </CardHeader>
            <CardContent>
              {slaLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {slaData?.slas?.map((sla: any) => (
                    <div
                      key={sla.locationId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{sla.locationName}</div>
                        <div className="text-sm text-muted-foreground">
                          {sla.onTimeCalls} on time · {sla.atRiskCalls} at risk · {sla.overdueCalls}{' '}
                          overdue
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-2xl font-bold ${sla.onTrack ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {sla.slaCompliancePercent.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {sla.avgResponseTime.toFixed(1)}h response time
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
              <CardTitle>Technician Activity by Location</CardTitle>
              <CardDescription>Hours breakdown by activity type</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {activityData?.activities?.map((activity: any) => (
                    <div key={activity.locationId} className="p-4 border rounded-lg">
                      <div className="font-medium mb-2">{activity.locationName}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Travel: {activity.travelHours.toFixed(1)}h</div>
                        <div>Diagnostic: {activity.diagnosticHours.toFixed(1)}h</div>
                        <div>Repair: {activity.repairHours.toFixed(1)}h</div>
                        <div>Documentation: {activity.documentationHours.toFixed(1)}h</div>
                      </div>
                      <div className="mt-2 pt-2 border-t flex justify-between text-sm">
                        <span>Total: {activity.totalHours.toFixed(1)}h</span>
                        <span className="font-medium">
                          Utilization: {activity.utilizationRate.toFixed(1)}%
                        </span>
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
