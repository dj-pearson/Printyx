/**
 * The implementation project for a handoff (WF-P-07).
 *
 * This repo had two project models and this panel is where the surviving one
 * became reachable from the work that produces it. `projects` won;
 * `implementation_projects` - which had handoff_id, milestones and the rest -
 * had no caller in any client tree, no routed edge function and an Express
 * router nobody imported, so it was dropped rather than wired.
 * docs/WF-P-07-project-model-decision.md.
 *
 * Everything here is read from /api/projects. The serials come from the
 * project's contract through its purchase orders, and when that chain cannot
 * answer, the server says why in `unbacked` and this renders the sentence
 * instead of an empty list.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Boxes, ListChecks, Loader2 } from 'lucide-react';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

interface Milestone {
  name: string;
  description?: string;
  dueDate?: string | null;
  completedDate?: string | null;
  status: string;
}

interface ProjectSummary {
  id: string;
  name: string | null;
  status: string | null;
  projectType: string | null;
}

interface ProjectSerial {
  id: string;
  serialNumber: string | null;
  modelNumber: string | null;
  manufacturer: string | null;
  status: string | null;
  poNumber: string | null;
}

interface ProjectTask {
  id: string;
  title: string;
  status: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
}

interface ProjectDetail extends ProjectSummary {
  milestones: Milestone[];
  milestoneProgress: { total: number; completed: number };
  taskCount: number;
  completedTaskCount: number;
  completionPercentage: number | null;
  tasks: ProjectTask[];
  equipment: ProjectSerial[];
  unbacked: string[];
}

const day = (value?: string | null) => (value ? format(new Date(value), 'PP') : null);

export function HandoffProject({
  handoffId,
  customerId,
  customerName,
  contractId,
}: {
  handoffId: string;
  customerId: string;
  customerName: string;
  contractId?: string | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const listQuery = useQuery<ProjectSummary[]>({
    queryKey: ['/api/projects', { handoffId }],
    queryFn: async () =>
      extractRecords<ProjectSummary>(await apiRequest(`/api/projects?handoffId=${handoffId}`)),
  });

  const project = useMemo(() => listQuery.data?.[0] ?? null, [listQuery.data]);

  const detailQuery = useQuery<ProjectDetail>({
    queryKey: ['/api/projects', project?.id],
    enabled: Boolean(project?.id),
    queryFn: () => apiRequest(`/api/projects/${project?.id}`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects', { handoffId }] });
    if (project?.id) queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
  };

  const create = useMutation({
    mutationFn: () =>
      apiRequest('/api/projects', 'POST', {
        // The server fills project_type, milestones and the customer from the
        // handoff; only the name is genuinely a decision made here.
        name: `${customerName} implementation`,
        handoffId,
        customerId,
        contractId: contractId ?? null,
        status: 'planning',
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Implementation project created' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Could not create the project',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const setMilestones = useMutation({
    mutationFn: (milestones: Milestone[]) =>
      apiRequest(`/api/projects/${project?.id}`, 'PATCH', { milestones }),
    onSuccess: invalidate,
    onError: (error: Error) =>
      toast({
        title: 'Could not update the milestone',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const addTask = useMutation({
    mutationFn: (title: string) =>
      apiRequest('/api/tasks', 'POST', {
        title,
        projectId: project?.id,
        customerId,
        handoffId,
        status: 'todo',
        priority: 'medium',
      }),
    onSuccess: () => {
      setNewTaskTitle('');
      invalidate();
      toast({ title: 'Task added to the project' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Could not add the task',
        description: error.message,
        variant: 'destructive',
      }),
  });

  if (listQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading the project…</p>;
  }

  if (listQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        The project for this handoff could not be loaded, so what you see below is not its state.
      </p>
    );
  }

  if (!project) {
    return (
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          No implementation project yet. Creating one starts the phase checklist for this handoff
          type and gives the install somewhere to hold its tasks and serials.
        </p>
        <Button variant="outline" disabled={create.isPending} onClick={() => create.mutate()}>
          {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create implementation project
        </Button>
      </div>
    );
  }

  const detail = detailQuery.data;

  const toggleMilestone = (index: number, done: boolean) => {
    if (!detail) return;
    const next = detail.milestones.map((m, i) =>
      i === index
        ? {
            ...m,
            status: done ? 'completed' : 'pending',
            completedDate: done ? new Date().toISOString() : null,
          }
        : m,
    );
    setMilestones.mutate(next);
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{project.name}</p>
          <p className="text-xs text-muted-foreground">
            {project.projectType ?? 'project'} ·{' '}
            {detail
              ? `${detail.completedTaskCount} of ${detail.taskCount} tasks done`
              : 'loading tasks'}
          </p>
        </div>
        {detail && (
          <Badge variant="outline">
            {detail.milestoneProgress.completed}/{detail.milestoneProgress.total} milestones
          </Badge>
        )}
      </div>

      {detailQuery.isError ? (
        <p className="text-sm text-destructive">
          This project could not be loaded. Its milestones, tasks and serials are not shown rather
          than shown empty.
        </p>
      ) : detailQuery.isLoading || !detail ? (
        <p className="text-sm text-muted-foreground">Loading the project…</p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ListChecks className="h-4 w-4" />
              Milestones
            </p>
            {detail.milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">This project has no milestones.</p>
            ) : (
              detail.milestones.map((milestone, index) => {
                const done = milestone.status === 'completed' || Boolean(milestone.completedDate);
                return (
                  <label
                    key={`${milestone.name}-${index}`}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-2"
                  >
                    <Checkbox
                      checked={done}
                      disabled={setMilestones.isPending}
                      onCheckedChange={(checked) => toggleMilestone(index, checked === true)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`font-medium ${done ? 'line-through' : ''}`}>
                        {milestone.name}
                      </span>
                      {milestone.description && (
                        <span className="block text-sm text-muted-foreground">
                          {milestone.description}
                        </span>
                      )}
                      {done && milestone.completedDate && (
                        <span className="block text-xs text-muted-foreground">
                          Completed {day(milestone.completedDate)}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Project tasks</p>
            {detail.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks on this project yet. A task added here carries the project, so it shows
                both here and on the assignee&apos;s own list.
              </p>
            ) : (
              <ul className="space-y-1">
                {detail.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <span className="min-w-0 truncate">{task.title}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {day(task.due_date) && <span>due {day(task.due_date)}</span>}
                      <Badge variant="outline">{task.status ?? 'todo'}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTaskTitle.trim()) return;
                addTask.mutate(newTaskTitle.trim());
              }}
            >
              <Input
                aria-label="New task for this project"
                placeholder="Add a task to this project"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 min-w-[12rem]"
              />
              <Button type="submit" variant="outline" disabled={addTask.isPending}>
                Add task
              </Button>
            </form>
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Boxes className="h-4 w-4" />
              Equipment covered
            </p>
            {detail.equipment.length > 0 && (
              <ul className="space-y-1">
                {detail.equipment.map((unit) => (
                  <li
                    key={unit.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-mono">
                      {unit.serialNumber ?? 'no serial recorded'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[unit.manufacturer, unit.modelNumber].filter(Boolean).join(' ')}
                      {unit.poNumber ? ` · ${unit.poNumber}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {detail.unbacked.map((reason) => (
              <p key={reason} className="text-sm text-muted-foreground">
                {reason}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
