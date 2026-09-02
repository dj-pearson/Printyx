import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Calendar,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  Plus,
  Settings,
  Zap,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import {} from 'recharts';

interface MaintenanceSchedule {
  id: string;
  equipmentId: string;
  equipmentModel: string;
  customerName: string;
  customerLocation: string;
  maintenanceType: string;
  serviceName: string;
  frequency: string;
  frequencyValue: number;
  nextDueDate: Date;
  lastServiceDate: Date;
  meterBasedScheduling: boolean;
  currentMeterReading: number;
  meterAtLastService: number;
  nextServiceMeter: number | null;
  meterThreshold: number | null;
  estimatedDuration: number;
  requiredSkills: string[];
  requiredParts: string[];
  status: string;
  priority: string;
  urgencyScore: number;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  scheduledDate: Date | null;
  scheduledTimeSlot: string | null;
  autoScheduleEnabled: boolean;
  reminderDaysBefore: number;
  escalationDays: number;
  serviceHistory: Array<{
    date: Date;
    technician: string;
    duration: number;
    partsUsed: string[];
    issues: string[];
    meterReading: number;
  }>;
  predictiveInsights: {
    riskLevel: string;
    failurePrediction: number;
    recommendedActions: string[];
    costSavings: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface MaintenanceTemplate {
  id: string;
  templateName: string;
  description: string;
  equipmentTypes: string[];
  estimatedDuration: number;
  frequency: string;
  checklist: Array<{
    item: string;
    required: boolean;
    estimatedTime: number;
  }>;
  requiredParts: Array<{
    partName: string;
    quantity: number;
    optional: boolean;
  }>;
  requiredSkills: string[];
  safetyRequirements: string[];
  isActive: boolean;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const HEALTH_COLORS = ['#82ca9d', '#ffc658', '#ff7c7c'];

export default function PreventiveMaintenanceAutomation() {
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue } = useForm();

  // Fetch maintenance schedules
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<any[]>({
    queryKey: ['/api/maintenance/schedules'],
    select: (data: any[]) =>
      data.map((schedule) => ({
        ...schedule,
        nextDueDate: new Date(schedule.nextDueDate),
        lastServiceDate: new Date(schedule.lastServiceDate),
        scheduledDate: schedule.scheduledDate ? new Date(schedule.scheduledDate) : null,
        serviceHistory: schedule.serviceHistory.map((h: any) => ({
          ...h,
          date: new Date(h.date),
        })),
        createdAt: new Date(schedule.createdAt),
        updatedAt: new Date(schedule.updatedAt),
      })),
  });

  // The tenant's equipment, so auto-generate targets real machines instead of the
  // five hard-coded ids it used to submit.
  const { data: equipment = [] } = useQuery<Array<{ id: string }>>({
    queryKey: ['/api/equipment'],
    select: (data: unknown) =>
      Array.isArray(data) ? data : ((data as { data?: Array<{ id: string }> })?.data ?? []),
  });

  // WF-V-04: the shape supabase/functions/maintenance/ actually returns. The old
  // type named efficiency, equipment_health, cost_analysis and performance_trends
  // - all four came from a fixture, and none is derivable from a schedule table
  // and a record table. `unbacked` says which of those the endpoint deliberately
  // does not answer.
  const { data: analytics } = useQuery<{
    windowDays: number;
    totalSchedules: number;
    activeSchedules: number;
    overdueSchedules: number;
    completedInWindow: number;
    totalLaborHours: number | null;
    totalCost: number | null;
    unbacked: string[];
  }>({
    queryKey: ['/api/maintenance/analytics'],
  });

  // Auto-generate schedules mutation
  const autoGenerateMutation = useMutation({
    mutationFn: (data: unknown) =>
      apiRequest('/api/maintenance/auto-generate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (result: { createdCount?: number; unknownEquipmentIds?: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/schedules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/analytics'] });
      // The count comes from the rows the server actually wrote. The old toast
      // said "Schedules Generated" against an endpoint that persisted nothing.
      const skipped = result?.unknownEquipmentIds?.length ?? 0;
      toast({
        title: `${result?.createdCount ?? 0} schedule(s) created`,
        description:
          skipped > 0 ? `${skipped} equipment id(s) did not belong to this tenant.` : undefined,
      });
    },
    onError: (err) =>
      toast({
        title: 'Could not generate the schedules',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  // WF-V-04: this used to submit five hard-coded ids - 'eq-001'..'eq-005' - to an
  // endpoint that persisted nothing and reported success. It now generates for the
  // tenant's equipment that has NO active schedule yet, which is the only set the
  // button can sensibly mean, and does nothing (with a reason) when there is none.
  const scheduledEquipmentIds = useMemo(
    () => new Set(schedules.map((s) => s.equipmentId)),
    [schedules],
  );
  const unscheduledEquipment = useMemo(
    () => equipment.filter((e) => !scheduledEquipmentIds.has(e.id)),
    [equipment, scheduledEquipmentIds],
  );

  const handleAutoGenerate = () => {
    if (unscheduledEquipment.length === 0) {
      toast({
        title: 'Nothing to generate',
        description: 'Every piece of equipment already has a maintenance schedule.',
      });
      return;
    }
    autoGenerateMutation.mutate({
      equipmentIds: unscheduledEquipment.map((e) => e.id),
      startDate: new Date(),
      frequency: 'quarterly',
    });
  };

  if (schedulesLoading) {
    return (
      <MainLayout
        title="Maintenance Automation"
        description="Automated scheduling and predictive maintenance management"
      >
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading maintenance data...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const overdueSchedules = schedules.filter((s) => s.status === 'overdue').length;
  const dueSoon = schedules.filter((s) => {
    const daysUntilDue = differenceInDays(s.nextDueDate, new Date());
    return daysUntilDue <= 7 && daysUntilDue >= 0;
  }).length;

  return (
    <MainLayout
      title="Maintenance Automation"
      description="Automated scheduling and predictive maintenance management"
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="flex justify-end items-center gap-3">
          <div className="hidden sm:flex items-center gap-3">
            <Button
              onClick={handleAutoGenerate}
              disabled={autoGenerateMutation.isPending}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Auto-Generate
            </Button>

            <Dialog open={isCreateScheduleOpen} onOpenChange={setIsCreateScheduleOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Schedule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Maintenance Schedule</DialogTitle>
                  <DialogDescription>
                    Set up automated preventive maintenance for equipment.
                  </DialogDescription>
                </DialogHeader>
                <div className="text-sm text-gray-600">
                  Schedule creation form would be implemented here with equipment selection,
                  template choice, and frequency settings.
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* WF-V-04: four cards, four fabrications. Compliance, Cost Savings,
            preventive-vs-reactive, Response Time and first-time-fix all came
            from a fixture; nothing records whether a due date was MET (only
            that work was completed), and there is no cost model to compare
            against, so none is derivable from maintenance_schedules and
            maintenance_records. The cards below report what those two tables
            can answer, and the endpoint's `unbacked` array names the rest so
            their absence reads as unmeasured rather than as zero. */}
        {analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active schedules</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.activeSchedules}</div>
                <p className="text-xs text-muted-foreground">
                  of {analytics.totalSchedules} in total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.overdueSchedules}</div>
                <p className="text-xs text-muted-foreground">Past their next due date</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.completedInWindow}</div>
                <p className="text-xs text-muted-foreground">
                  In the last {analytics.windowDays} days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Labour hours</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                {/* Null, not 0: no completed record has logged hours, which is a
                    different statement from "the work took no time". */}
                <div className="text-2xl font-bold">
                  {analytics.totalLaborHours == null
                    ? 'Not recorded'
                    : analytics.totalLaborHours.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Logged on completed maintenance</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="schedules" className="space-y-6">
          <TabsList>
            <TabsTrigger value="schedules">Maintenance Schedules</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="schedules" className="space-y-6">
            {schedules.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Maintenance Schedules
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Create your first automated maintenance schedule.
                  </p>
                  <Button onClick={() => setIsCreateScheduleOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Schedule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {schedules.map((schedule) => (
                  <Card key={schedule.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{schedule.equipmentModel}</h3>
                            <Badge className={getStatusColor(schedule.status)}>
                              {schedule.status}
                            </Badge>
                            <Badge className={getPriorityColor(schedule.priority)}>
                              {schedule.priority}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-3">
                            <div>
                              <span className="font-medium">Customer:</span>
                              <br />
                              {schedule.customerName}
                            </div>
                            <div>
                              <span className="font-medium">Service Type:</span>
                              <br />
                              {schedule.serviceName}
                            </div>
                            <div>
                              <span className="font-medium">Next Due:</span>
                              <br />
                              {format(schedule.nextDueDate, 'MMM dd, yyyy')}
                            </div>
                            <div>
                              <span className="font-medium">Frequency:</span>
                              <br />
                              {schedule.frequency}
                            </div>
                          </div>

                          {schedule.meterBasedScheduling && (
                            <div className="bg-blue-50 rounded-lg p-3 mb-3">
                              <h5 className="font-medium text-blue-800 mb-2">
                                Meter-Based Scheduling
                              </h5>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600">Current Reading:</span>
                                  <span className="ml-2 font-medium">
                                    {schedule.currentMeterReading.toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Next Service:</span>
                                  <span className="ml-2 font-medium">
                                    {schedule.nextServiceMeter?.toLocaleString() || 'N/A'}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2">
                                <div className="flex justify-between text-xs mb-1">
                                  <span>Progress to next service</span>
                                  <span>
                                    {schedule.nextServiceMeter
                                      ? Math.round(
                                          ((schedule.currentMeterReading -
                                            schedule.meterAtLastService) /
                                            (schedule.nextServiceMeter -
                                              schedule.meterAtLastService)) *
                                            100,
                                        )
                                      : 0}
                                    %
                                  </span>
                                </div>
                                {schedule.nextServiceMeter && (
                                  <Progress
                                    value={
                                      ((schedule.currentMeterReading -
                                        schedule.meterAtLastService) /
                                        (schedule.nextServiceMeter - schedule.meterAtLastService)) *
                                      100
                                    }
                                  />
                                )}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-gray-600">Duration:</span>
                              <span className="ml-2 font-medium">
                                {schedule.estimatedDuration} min
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Skills Required:</span>
                              <span className="ml-2 font-medium">
                                {schedule.requiredSkills.join(', ')}
                              </span>
                            </div>
                          </div>

                          {schedule.assignedTechnicianName && (
                            <div className="text-sm">
                              <span className="text-gray-600">Assigned:</span>
                              <span className="ml-2 font-medium">
                                {schedule.assignedTechnicianName}
                              </span>
                              {schedule.scheduledTimeSlot && (
                                <span className="ml-2 text-gray-500">
                                  • {schedule.scheduledTimeSlot}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">
                            {schedule.urgencyScore}
                          </div>
                          <div className="text-xs text-gray-500">Urgency Score</div>

                          <div className="mt-2 text-xs">
                            <div className="text-green-600 font-medium">
                              ${schedule.predictiveInsights.costSavings} savings
                            </div>
                            <Badge
                              className={getRiskColor(schedule.predictiveInsights.riskLevel)}
                              variant="outline"
                            >
                              {schedule.predictiveInsights.riskLevel} risk
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {schedule.predictiveInsights.recommendedActions.length > 0 && (
                        <div className="border-t pt-3">
                          <h6 className="text-sm font-medium text-gray-700 mb-2">
                            Recommended Actions:
                          </h6>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {schedule.predictiveInsights.recommendedActions.map(
                              (action: any, idx: number) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <span className="text-blue-600 mt-0.5">•</span>
                                  <span>{action}</span>
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 mt-4">
                        <Button size="sm" variant="outline">
                          View History
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                        <Button size="sm">Schedule Now</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* WF-V-04: the Predictive Analysis and Templates tabs are gone.
              Both read endpoints that answered from hard-coded samples - named
              machines at named customers, a failure prediction with a confidence
              score - and neither has a table or an engine behind it here.
              Predictive maintenance IS real elsewhere: /service/predictions runs
              supabase/functions/predictive-failure/ over stored signals, so this
              tab was a fixture twin of a working page (AUDIT-019's shape) and
              repointing it would have meant two surfaces for one engine.
              maintenance_templates does not exist in any schema or migration. */}

          <TabsContent value="analytics" className="space-y-6">
            {/* WF-V-04: Equipment Health Distribution, Cost Analysis and
                Performance Trends all read fixture keys - equipment_health,
                cost_analysis, performance_trends - and none is derivable from
                maintenance_schedules and maintenance_records. A LineChart of
                compliance and satisfaction over months is the sharpest case: it
                asserts a measured trend, and neither series is recorded anywhere.
                The panel below reports what the two tables can answer and prints
                the endpoint's own list of what it will not claim. */}
            {analytics && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Maintenance in the last {analytics.windowDays} days</CardTitle>
                    <CardDescription>Derived from completed maintenance records</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Completed</span>
                      <span className="font-medium">{analytics.completedInWindow}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Labour hours logged</span>
                      <span className="font-medium">
                        {analytics.totalLaborHours == null
                          ? 'Not recorded'
                          : analytics.totalLaborHours.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Cost logged</span>
                      <span className="font-medium">
                        {analytics.totalCost == null
                          ? 'Not recorded'
                          : `$${analytics.totalCost.toLocaleString()}`}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Not measured</CardTitle>
                    <CardDescription>
                      What this page deliberately does not report, and why
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                      {(analytics.unbacked ?? []).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile FAB */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden z-50"
        onClick={() => setIsCreateScheduleOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </MainLayout>
  );
}
