import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  Wrench,
  PackageCheck,
  Zap,
  Activity,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface DashboardMetrics {
  overview: {
    totalPredictiveDispatches: number;
    devicesMonitored: number;
    devicesAtRisk: number;
    devicesCheckedLast24h: number;
    downtimePreventedHours: number;
    costSavings: number;
    uptimeImprovement: string;
    partsAutoOrdered: number;
    period: string;
  };
  upcomingMaintenance: Array<{
    id: string;
    equipmentId: string;
    scheduledDate: string;
    priority: string;
    technicianId: string;
    estimatedDuration: number;
    predictedIssue: string;
  }>;
}

interface AtRiskDevice {
  equipmentId: string;
  serialNumber: string;
  model: string;
  location: string;
  scheduledMaintenance: string;
  priority: string;
  predictedIssue: string;
  lastCheck: string;
  tonerLevel: number;
  fuserLife: number;
  drumLife: number;
  totalPageCount: number;
}

interface TechnicianPerformance {
  technicianId: string;
  name: string;
  skills: string[];
  certifications: string[];
  currentWorkload: number;
  maxWorkload: number;
  utilizationPercent: string;
  avgResponseTime: number;
  completionRate: number;
  location: string;
  territories: string[];
}

export default function PredictiveServiceDispatchDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  // Fetch dashboard metrics
  const { data: dashboardData, isLoading: loadingDashboard } = useQuery<DashboardMetrics>({
    queryKey: ['/api/predictive-dispatch/dashboard'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch at-risk devices
  const { data: atRiskData, isLoading: loadingAtRisk } = useQuery<{
    devicesAtRisk: AtRiskDevice[];
    count: number;
  }>({
    queryKey: ['/api/predictive-dispatch/devices-at-risk'],
    refetchInterval: 60000,
  });

  // Fetch technician performance
  const { data: technicianData, isLoading: loadingTechnicians } = useQuery<{
    technicians: TechnicianPerformance[];
    count: number;
  }>({
    queryKey: ['/api/predictive-dispatch/technician-performance'],
    refetchInterval: 120000, // Refresh every 2 minutes
  });

  // Analyze single device
  const analyzeMutation = useMutation({
    mutationFn: (serialNumber: string) =>
      apiRequest(`/api/predictive-dispatch/analyze/${serialNumber}`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      toast({
        title: 'Device Analyzed',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/predictive-dispatch/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/predictive-dispatch/devices-at-risk'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Failed to analyze device',
        variant: 'destructive',
      });
    },
  });

  // Analyze entire fleet
  const analyzeFleetMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/predictive-dispatch/analyze-all', {
        method: 'POST',
      }),
    onSuccess: (data) => {
      toast({
        title: 'Fleet Analysis Complete',
        description: `Analyzed ${data.analyzed} devices. ${data.dispatchesCreated} dispatches created.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/predictive-dispatch/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/predictive-dispatch/devices-at-risk'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Fleet Analysis Failed',
        description: error.message || 'Failed to analyze fleet',
        variant: 'destructive',
      });
    },
  });

  const overview = dashboardData?.overview;
  const upcomingMaintenance = dashboardData?.upcomingMaintenance || [];
  const atRiskDevices = atRiskData?.devicesAtRisk || [];
  const technicians = technicianData?.technicians || [];

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'destructive' | 'default' | 'secondary'> = {
      critical: 'destructive',
      high: 'destructive',
      medium: 'default',
      low: 'secondary',
    };
    return <Badge variant={variants[priority] || 'default'}>{priority.toUpperCase()}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-purple-500" />
            Predictive Service Dispatch
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered equipment health monitoring and proactive maintenance scheduling
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => analyzeFleetMutation.mutate()}
            disabled={analyzeFleetMutation.isPending}
            variant="outline"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${analyzeFleetMutation.isPending ? 'animate-spin' : ''}`}
            />
            {analyzeFleetMutation.isPending ? 'Analyzing Fleet...' : 'Analyze All Devices'}
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      {loadingDashboard ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Devices Monitored
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{overview?.devicesMonitored || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {overview?.devicesCheckedLast24h || 0} checked in last 24h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                At-Risk Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">
                {overview?.devicesAtRisk || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Require immediate attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Downtime Prevented
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                {overview?.downtimePreventedHours || 0}h
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {overview?.uptimeImprovement || '0%'} uptime improvement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wrench className="h-4 w-4 text-blue-500" />
                Cost Savings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">
                ${overview?.costSavings?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last {overview?.period || '30 days'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="at-risk">
            At-Risk Devices
            {atRiskDevices.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {atRiskDevices.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Maintenance</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How Predictive Dispatch Works</CardTitle>
              <CardDescription>
                AI-powered system that prevents equipment failures before they happen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-purple-600" />
                    </div>
                    1. Monitor
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Continuously collect metrics from all devices: toner levels, supply life, page
                    counts, error patterns, and device status via SNMP/HTTP.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-blue-600" />
                    </div>
                    2. Predict
                  </div>
                  <p className="text-sm text-muted-foreground">
                    AI analyzes trends to predict failures before they occur. Claude AI identifies
                    patterns and calculates failure risk with recommended preventive actions.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <Wrench className="h-4 w-4 text-green-600" />
                    </div>
                    3. Dispatch
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically schedule maintenance, assign best-fit technician, and order parts
                    proactively—preventing downtime before it impacts business.
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-3">Key Benefits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Prevent Emergency Calls</div>
                      <div className="text-sm text-muted-foreground">
                        Catch issues before they become emergencies, reducing urgent service calls
                        by 60%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Maximize Uptime</div>
                      <div className="text-sm text-muted-foreground">
                        Proactive maintenance keeps devices running, improving customer satisfaction
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Optimize Technician Routes</div>
                      <div className="text-sm text-muted-foreground">
                        AI assigns jobs based on location, skills, and workload for maximum
                        efficiency
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Auto-Order Parts</div>
                      <div className="text-sm text-muted-foreground">
                        Ensure parts arrive before the service call, improving first-time fix rate
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Predictive Dispatches</CardTitle>
                <CardDescription>Last {overview?.period || '30 days'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-purple-500 mb-2">
                  {overview?.totalPredictiveDispatches || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  Maintenance calls automatically scheduled based on AI predictions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parts Auto-Ordered</CardTitle>
                <CardDescription>Proactive inventory management</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-blue-500 mb-2">
                  {overview?.partsAutoOrdered || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  Parts automatically ordered before service calls
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* At-Risk Devices Tab */}
        <TabsContent value="at-risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Devices Requiring Attention</CardTitle>
              <CardDescription>
                Equipment flagged by AI as at-risk for failure or maintenance overdue
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAtRisk ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : atRiskDevices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">All devices are healthy!</p>
                  <p className="text-sm">No equipment requires immediate attention</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {atRiskDevices.map((device) => (
                    <div
                      key={device.equipmentId}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {device.model}
                            {getPriorityBadge(device.priority)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            S/N: {device.serialNumber}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => analyzeMutation.mutate(device.serialNumber)}
                          disabled={analyzeMutation.isPending}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Re-analyze
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div>
                          <div className="text-muted-foreground">Location</div>
                          <div className="font-medium flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {device.location || 'Unknown'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Toner</div>
                          <div
                            className={`font-medium ${device.tonerLevel < 15 ? 'text-orange-500' : ''}`}
                          >
                            {device.tonerLevel}%
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Fuser Life</div>
                          <div
                            className={`font-medium ${device.fuserLife < 20 ? 'text-red-500' : ''}`}
                          >
                            {device.fuserLife}%
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Drum Life</div>
                          <div
                            className={`font-medium ${device.drumLife < 20 ? 'text-red-500' : ''}`}
                          >
                            {device.drumLife}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/20 p-3 rounded">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">Predicted Issue</div>
                          <div className="text-sm text-muted-foreground">
                            {device.predictedIssue}
                          </div>
                        </div>
                      </div>

                      {device.scheduledMaintenance && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Maintenance scheduled for{' '}
                          {format(new Date(device.scheduledMaintenance), 'MMM d, yyyy h:mm a')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Maintenance Tab */}
        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Preventive Maintenance</CardTitle>
              <CardDescription>Next 7 days of scheduled service calls</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingMaintenance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2" />
                  <p className="font-medium">No maintenance scheduled</p>
                  <p className="text-sm">
                    Run fleet analysis to identify devices needing attention
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingMaintenance.map((maintenance) => (
                    <div
                      key={maintenance.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            Equipment ID: {maintenance.equipmentId}
                            {getPriorityBadge(maintenance.priority)}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(
                              new Date(maintenance.scheduledDate),
                              'EEEE, MMM d, yyyy h:mm a',
                            )}
                          </div>
                        </div>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {maintenance.estimatedDuration}h
                        </Badge>
                      </div>

                      <div className="text-sm mb-2">
                        <span className="text-muted-foreground">Technician:</span>{' '}
                        <span className="font-medium">{maintenance.technicianId}</span>
                      </div>

                      <div className="text-sm bg-blue-50 dark:bg-blue-950/20 p-3 rounded">
                        <div className="font-medium mb-1">Predicted Issue:</div>
                        <div className="text-muted-foreground">{maintenance.predictedIssue}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technicians Tab */}
        <TabsContent value="technicians" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Technician Performance & Capacity</CardTitle>
              <CardDescription>Current workload and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTechnicians ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : technicians.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-2" />
                  <p className="font-medium">No technicians available</p>
                  <p className="text-sm">Configure technician resources to enable auto-dispatch</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {technicians.map((tech) => (
                    <div
                      key={tech.technicianId}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold">{tech.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {tech.location || 'Location not set'}
                          </div>
                        </div>
                        <Badge
                          variant={
                            parseInt(tech.utilizationPercent) > 80
                              ? 'destructive'
                              : parseInt(tech.utilizationPercent) > 60
                                ? 'default'
                                : 'secondary'
                          }
                        >
                          {tech.utilizationPercent}% Utilized
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div>
                          <div className="text-muted-foreground">Workload</div>
                          <div className="font-medium">
                            {tech.currentWorkload} / {tech.maxWorkload}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Avg Response</div>
                          <div className="font-medium">{tech.avgResponseTime}h</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Completion Rate</div>
                          <div className="font-medium">{tech.completionRate.toFixed(0)}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Territories</div>
                          <div className="font-medium">{tech.territories.length || 0}</div>
                        </div>
                      </div>

                      {tech.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tech.skills.slice(0, 5).map((skill, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {tech.skills.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{tech.skills.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
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
