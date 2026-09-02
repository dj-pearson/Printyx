/**
 * The sales-to-operations handoff queue (WF-C-06).
 *
 * NOTHING REACHABLE EXISTED BEFORE THIS. Three real tables shipped in migration
 * 0000; server/routes-sales-handoff.ts served them correctly and had no caller
 * anywhere; and supabase/functions/sales-handoffs, which production actually
 * reaches, queried `sales_handoffs` - a relation named by no schema and no
 * migration - so all six of its endpoints were a 42P01. Operations found out a
 * deal had closed by being told, and the Book Order button on the contracts page
 * navigated to /purchase-orders?contractId= where the id was rendered as text and
 * dropped.
 *
 * Every number on this page comes from sales_handoff_checklists and handoff_tasks.
 */

import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ClipboardList, Loader2, PackagePlus } from 'lucide-react';

interface Handoff {
  id: string;
  customer_id: string;
  customer_name?: string | null;
  contract_id?: string | null;
  opportunity_id?: string | null;
  status: string;
  handoff_type: string;
  sales_rep_name?: string | null;
  implementation_owner_id?: string | null;
  completion_percentage?: number | null;
  open_task_count?: number;
  initiated_at?: string | null;
  target_completion_date?: string | null;
}

interface HandoffTask {
  id: string;
  task_name: string;
  description?: string | null;
  category: string;
  assigned_to_role?: string | null;
  status: string;
  is_required?: boolean | null;
  due_date?: string | null;
}

interface TaskTemplate {
  id: string;
  template_name: string;
  handoff_type: string;
  is_default?: boolean | null;
  tasks?: Array<{ taskName: string }> | null;
}

interface HandoffDetail extends Handoff {
  tasks?: HandoffTask[];
  customer?: { company_name?: string | null; primary_contact_name?: string | null } | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  in_progress: 'bg-blue-100 text-blue-900',
  completed: 'bg-green-100 text-green-900',
  blocked: 'bg-red-100 text-red-900',
};

const humanize = (value?: string | null) =>
  value ? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

const day = (value?: string | null) => (value ? format(new Date(value), 'PP') : '-');

export default function SalesHandoffs() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handoffsQuery = useQuery<Handoff[]>({
    queryKey: ['/api/sales-handoffs'],
    queryFn: async () => extractRecords<Handoff>(await apiRequest('/api/sales-handoffs', 'GET')),
  });

  const detailQuery = useQuery<HandoffDetail>({
    queryKey: [`/api/sales-handoffs/${selectedId}`],
    enabled: Boolean(selectedId),
    queryFn: () => apiRequest(`/api/sales-handoffs/${selectedId}`, 'GET'),
  });

  // WF-C-06: which checklist each type produces. A coordinator working the queue
  // needs to know what a new handoff will contain, and the row is created lazily
  // on first use, so this is also how they discover it exists to be edited.
  const templatesQuery = useQuery<TaskTemplate[]>({
    queryKey: ['/api/handoff-task-templates'],
    queryFn: async () =>
      extractRecords<TaskTemplate>(await apiRequest('/api/handoff-task-templates', 'GET')),
  });

  const handoffs = useMemo(() => handoffsQuery.data ?? [], [handoffsQuery.data]);
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const queue = useMemo(
    () =>
      handoffs.filter((h) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'open') return h.status !== 'completed';
        return h.status === statusFilter;
      }),
    [handoffs, statusFilter],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/sales-handoffs'] });
    if (selectedId) {
      queryClient.invalidateQueries({ queryKey: [`/api/sales-handoffs/${selectedId}`] });
    }
  };

  const claim = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/sales-handoffs/${id}`, 'PATCH', { status: 'in_progress' }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Handoff claimed' });
    },
    onError: (error: Error) =>
      toast({ title: 'Could not claim it', description: error.message, variant: 'destructive' }),
  });

  const setTaskStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      apiRequest(`/api/handoff-tasks/${taskId}`, 'PUT', { status }),
    onSuccess: invalidate,
    onError: (error: Error) =>
      toast({
        title: 'Could not update the task',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const complete = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/sales-handoffs/${id}/complete`, 'POST', {}),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Handoff complete' });
    },
    onError: (error: Error) =>
      // The server refuses while a required task is open, and says which. That is
      // the point of the queue: an install must not go out with no site survey.
      toast({
        title: 'Not complete yet',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const detail = detailQuery.data;
  const tasks = detail?.tasks ?? [];

  return (
    <MainLayout
      title="Sales handoffs"
      description="Every closed deal, and what operations still has to do with it"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {queue.length} of {handoffs.length}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Queue</CardTitle>
              <CardDescription>
                Created when a proposal is accepted or a deal is won
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {handoffsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing in the queue. A handoff appears here the moment a proposal is accepted or
                  a deal reaches Closed Won.
                </p>
              ) : (
                queue.map((handoff) => (
                  <button
                    key={handoff.id}
                    type="button"
                    onClick={() => setSelectedId(handoff.id)}
                    className={`w-full rounded-md border p-3 text-left hover:bg-muted/50 ${
                      selectedId === handoff.id ? 'border-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {handoff.customer_name ?? handoff.customer_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {humanize(handoff.handoff_type)} · opened {day(handoff.initiated_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {(handoff.open_task_count ?? 0) > 0 && (
                          <Badge variant="outline">{handoff.open_task_count} open</Badge>
                        )}
                        <Badge className={STATUS_COLORS[handoff.status] ?? ''}>
                          {humanize(handoff.status)}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                {detail ? (detail.customer?.company_name ?? detail.customer_id) : 'Pick a handoff'}
              </CardTitle>
              {detail && (
                <CardDescription>
                  {humanize(detail.handoff_type)} · sold by {detail.sales_rep_name ?? 'a rep'} ·{' '}
                  {tasks.filter((t) => t.status === 'completed').length} of {tasks.length} tasks
                  done
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedId ? (
                <p className="text-sm text-muted-foreground">
                  Choose a handoff to see its checklist.
                </p>
              ) : detailQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : !detail ? (
                <p className="text-sm text-muted-foreground">That handoff could not be loaded.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {tasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        This handoff has no tasks. Its template had none.
                      </p>
                    ) : (
                      tasks.map((task) => {
                        const done = task.status === 'completed' || task.status === 'skipped';
                        return (
                          <label
                            key={task.id}
                            className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                          >
                            <Checkbox
                              checked={done}
                              disabled={setTaskStatus.isPending || detail.status === 'completed'}
                              onCheckedChange={(checked) =>
                                setTaskStatus.mutate({
                                  taskId: task.id,
                                  status: checked ? 'completed' : 'pending',
                                })
                              }
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className={`font-medium ${done ? 'line-through' : ''}`}>
                                  {task.task_name}
                                </span>
                                {task.is_required !== false && (
                                  <Badge variant="outline" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                              </span>
                              {task.description && (
                                <span className="block text-sm text-muted-foreground">
                                  {task.description}
                                </span>
                              )}
                              <span className="block text-xs text-muted-foreground">
                                {humanize(task.assigned_to_role)} · due {day(task.due_date)}
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                    {/* WF-P-04 will make this the pre-filled create. Today it opens
                        the purchase-order page carrying the contract, which is the
                        parameter that page already reads. */}
                    <Button
                      variant="outline"
                      onClick={() =>
                        setLocation(
                          detail.contract_id
                            ? `/purchase-orders?contractId=${detail.contract_id}&action=new`
                            : '/purchase-orders?action=new',
                        )
                      }
                    >
                      <PackagePlus className="mr-2 h-4 w-4" />
                      Create purchase order
                    </Button>
                    {detail.status === 'pending' && (
                      <Button
                        variant="outline"
                        disabled={claim.isPending}
                        onClick={() => claim.mutate(detail.id)}
                      >
                        {claim.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Claim
                      </Button>
                    )}
                    {detail.status !== 'completed' && (
                      <Button
                        disabled={complete.isPending}
                        onClick={() => complete.mutate(detail.id)}
                      >
                        Mark complete
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checklist templates</CardTitle>
            <CardDescription>
              What a new handoff of each type will contain. A default is created the first time a
              type is used, and is editable from there.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templatesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No templates yet. One is created automatically with the first handoff of each type.
              </p>
            ) : (
              <ul className="space-y-2">
                {templates.map((template) => (
                  <li
                    key={template.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <span className="font-medium">{template.template_name}</span>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      {humanize(template.handoff_type)} · {template.tasks?.length ?? 0} tasks
                      {template.is_default && <Badge variant="outline">Default</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
