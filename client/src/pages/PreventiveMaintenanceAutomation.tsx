/**
 * Maintenance Automation (round 225).
 *
 * Three defects stood behind this page's dead "Schedule Now" button. The
 * schedule list read a fixture shape the endpoint never sends (and its select
 * threw on the first real row), so no stored schedule ever rendered. The New
 * Schedule dialog said "Schedule creation form would be implemented here".
 * And POST /maintenance/schedules/:id/complete could never run: the create
 * branch above it matched any POST under /schedules, so completing a schedule
 * tried to create one from the completion body and failed on NOT NULL columns.
 *
 * The list now maps the real maintenance_schedules columns
 * (lib/maintenance-schedules.ts), New Schedule creates one, "Mark complete"
 * records the work and rolls the due date forward, and "View history" lists
 * the maintenance_records for that machine. The edge function's create branch
 * now requires no resource id.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, AlertTriangle, TrendingUp, CheckCircle, Plus, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, invalidateApiPath } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { toast } from '@/hooks/use-toast';
import { describeApiError } from '@/lib/api-error';
import {
  createScheduleBody,
  dueState,
  equipmentLabel,
  frequencyLabel,
  FREQUENCIES,
  scheduleFromRow,
  type MaintenanceScheduleView,
} from '@/lib/maintenance-schedules';

type Row = Record<string, unknown>;

const DUE_BADGE: Record<ReturnType<typeof dueState>, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800' },
  'due-soon': { label: 'Due this week', className: 'bg-yellow-100 text-yellow-800' },
  scheduled: { label: 'Scheduled', className: 'bg-green-100 text-green-800' },
  undated: { label: 'No due date', className: 'bg-gray-100 text-gray-800' },
};

const dayOf = (d: Date | null) => (d ? format(d, 'MMM dd, yyyy') : 'Not recorded');

function refreshMaintenance() {
  invalidateApiPath('/api/maintenance');
}

function CreateScheduleDialog({
  open,
  onOpenChange,
  equipment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Row[];
}) {
  const empty = {
    equipmentId: '',
    name: '',
    frequency: 'monthly',
    frequencyValue: '1',
    nextDueDate: '',
    estimatedDuration: '',
  };
  const [form, setForm] = useState(empty);
  const body = createScheduleBody(form);
  const set = (k: keyof typeof empty) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () => apiRequest('/api/maintenance/schedules', 'POST', body),
    onSuccess: () => {
      toast({ title: 'Schedule created', description: body?.name });
      refreshMaintenance();
      setForm(empty);
      onOpenChange(false);
    },
    onError: (err) =>
      toast({
        title: 'Could not create the schedule',
        description: describeApiError(err).message,
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create maintenance schedule</DialogTitle>
          <DialogDescription>Recurring preventive maintenance for one machine.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Equipment</span>
            <Select value={form.equipmentId} onValueChange={set('equipmentId')}>
              <SelectTrigger>
                <SelectValue
                  placeholder={equipment.length ? 'Choose a machine' : 'No equipment recorded'}
                />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((e) => (
                  <SelectItem key={String(e.id)} value={String(e.id)}>
                    {equipmentLabel(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Name</span>
            <Input
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
              placeholder="Quarterly PM"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Every</span>
              <Input
                type="number"
                min={1}
                value={form.frequencyValue}
                onChange={(e) => set('frequencyValue')(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Unit</span>
              <Select value={form.frequency} onValueChange={set('frequency')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">First due</span>
              <Input
                type="date"
                value={form.nextDueDate}
                onChange={(e) => set('nextDueDate')(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Duration (minutes)</span>
              <Input
                type="number"
                min={1}
                value={form.estimatedDuration}
                onChange={(e) => set('estimatedDuration')(e.target.value)}
              />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!body || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({
  schedule,
  onClose,
}: {
  schedule: MaintenanceScheduleView | null;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [hours, setHours] = useState('');
  const laborHours = hours === '' ? undefined : Number(hours);
  const valid = laborHours === undefined || (Number.isFinite(laborHours) && laborHours >= 0);

  const complete = useMutation({
    mutationFn: () =>
      apiRequest<{ nextDueDate?: string | null; scheduleUpdated?: boolean }>(
        `/api/maintenance/schedules/${schedule?.id}/complete`,
        'POST',
        { notes: notes.trim() || undefined, laborHours },
      ),
    onSuccess: (res) => {
      toast({
        title: 'Maintenance recorded',
        description:
          res?.scheduleUpdated === false
            ? 'The next due date could not be updated; the schedule still shows the old one.'
            : res?.nextDueDate
              ? `Next due ${format(new Date(res.nextDueDate), 'MMM dd, yyyy')}`
              : undefined,
      });
      refreshMaintenance();
      setNotes('');
      setHours('');
      onClose();
    },
    onError: (err) =>
      toast({
        title: 'Could not record the maintenance',
        description: describeApiError(err).message,
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={schedule !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark maintenance complete</DialogTitle>
          <DialogDescription>
            {schedule?.name}. Records the work and moves the next due date forward.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Labour hours</span>
            <Input
              type="number"
              min={0}
              step="0.25"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Notes</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || complete.isPending} onClick={() => complete.mutate()}>
            {complete.isPending ? 'Saving...' : 'Mark complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  schedule,
  onClose,
}: {
  schedule: MaintenanceScheduleView | null;
  onClose: () => void;
}) {
  const url = schedule?.equipmentId
    ? `/api/maintenance/history?equipmentId=${encodeURIComponent(schedule.equipmentId)}`
    : null;
  const q = useQuery<Row[]>({ queryKey: [url], enabled: url !== null });
  const rows = q.data ?? [];
  return (
    <Dialog open={schedule !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Maintenance history</DialogTitle>
          <DialogDescription>Completed maintenance on this machine</DialogDescription>
        </DialogHeader>
        {q.isError ? (
          <InlineQueryError label="maintenance history" onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed maintenance recorded.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((r) => {
              const at = r.completed_at ?? r.completedAt;
              const hrs = r.labor_hours ?? r.laborHours;
              return (
                <li key={String(r.id)} className="border rounded-md p-3">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {at ? format(new Date(String(at)), 'MMM dd, yyyy') : 'Undated'}
                    </span>
                    {hrs != null && <span className="text-muted-foreground">{String(hrs)} h</span>}
                  </div>
                  {r.notes ? <p className="mt-1">{String(r.notes)}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PreventiveMaintenanceAutomation() {
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = useState(false);
  const [completing, setCompleting] = useState<MaintenanceScheduleView | null>(null);
  const [historyFor, setHistoryFor] = useState<MaintenanceScheduleView | null>(null);

  const schedulesQuery = useQuery<MaintenanceScheduleView[]>({
    queryKey: ['/api/maintenance/schedules'],
    select: (data: unknown) => (Array.isArray(data) ? (data as Row[]).map(scheduleFromRow) : []),
  });
  const schedules = useMemo(() => schedulesQuery.data ?? [], [schedulesQuery.data]);

  const { data: equipment = [] } = useQuery<Row[]>({
    queryKey: ['/api/equipment'],
    select: (data: unknown) =>
      Array.isArray(data) ? (data as Row[]) : ((data as { data?: Row[] })?.data ?? []),
  });
  const equipmentById = useMemo(
    () => new Map(equipment.map((e) => [String(e.id), e])),
    [equipment],
  );

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
      refreshMaintenance();
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
    () => equipment.filter((e) => !scheduledEquipmentIds.has(String(e.id))),
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

  if (schedulesQuery.isLoading) {
    return (
      <MainLayout
        title="Maintenance Automation"
        description="Automated scheduling and predictive maintenance management"
      >
        <p className="text-sm text-muted-foreground">Loading maintenance data...</p>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Maintenance Automation"
      description="Automated scheduling and predictive maintenance management"
    >
      <div className="space-y-4 sm:space-y-6">
        <div className="flex justify-end items-center gap-3">
          <Button
            onClick={handleAutoGenerate}
            disabled={autoGenerateMutation.isPending}
            variant="outline"
            className="hidden sm:flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Auto-Generate
          </Button>
          <Button onClick={() => setIsCreateScheduleOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Schedule
          </Button>
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

          <TabsContent value="schedules" className="space-y-4">
            {schedulesQuery.isError ? (
              <InlineQueryError
                label="maintenance schedules"
                onRetry={() => schedulesQuery.refetch()}
              />
            ) : schedules.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No maintenance schedules
                  </h3>
                  <Button onClick={() => setIsCreateScheduleOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Schedule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              schedules.map((s) => {
                const due = DUE_BADGE[dueState(s.nextDueDate)];
                const machine = s.equipmentId ? equipmentById.get(s.equipmentId) : undefined;
                return (
                  <Card key={s.id}>
                    <CardContent className="py-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{s.name}</h3>
                        <Badge className={due.className}>{due.label}</Badge>
                        {s.status !== 'active' && <Badge variant="outline">{s.status}</Badge>}
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Machine</span>
                          <br />
                          {machine ? equipmentLabel(machine) : 'Not in the equipment list'}
                        </div>
                        <div>
                          <span className="font-medium">Frequency</span>
                          <br />
                          {frequencyLabel(s.frequency, s.frequencyValue)}
                        </div>
                        <div>
                          <span className="font-medium">Next due</span>
                          <br />
                          {dayOf(s.nextDueDate)}
                        </div>
                        <div>
                          <span className="font-medium">Last completed</span>
                          <br />
                          {dayOf(s.lastCompletedDate)}
                        </div>
                      </div>
                      {s.estimatedDuration != null && (
                        <p className="text-sm text-gray-600">
                          Estimated {s.estimatedDuration} minutes
                        </p>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setHistoryFor(s)}>
                          View history
                        </Button>
                        <Button size="sm" onClick={() => setCompleting(s)}>
                          Mark complete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
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

      <CreateScheduleDialog
        open={isCreateScheduleOpen}
        onOpenChange={setIsCreateScheduleOpen}
        equipment={equipment}
      />
      <CompleteDialog schedule={completing} onClose={() => setCompleting(null)} />
      <HistoryDialog schedule={historyFor} onClose={() => setHistoryFor(null)} />

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
