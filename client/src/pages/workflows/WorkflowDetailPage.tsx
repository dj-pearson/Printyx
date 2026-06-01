/**
 * WorkflowDetailPage — run + manage a workflow: stage board, step completion,
 * PM controls (advance / regress / reopen), and the activity log.
 */
import { useState } from 'react';
import { Link, useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Play,
  Pencil,
  Copy,
  Trash2,
  ChevronsRight,
  RotateCcw,
  CheckCircle2,
  Undo2,
  Clock,
} from 'lucide-react';
import { useOrgUsers } from '@/components/workflows/AssigneeSelect';
import {
  type WorkflowDetail,
  type TaskWorkflowStep,
  type OrgUser,
  STEP_STATUS_META,
  WORKFLOW_STATUS_META,
  groupStepsByStage,
  userInitials,
  userLabel,
} from '@/lib/workflows/types';

function fmt(ts: string | null): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

export default function WorkflowDetailPage() {
  const [, params] = useRoute('/workflows/:id');
  const id = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['/api/task-workflows', id];

  const { data, isLoading } = useQuery<WorkflowDetail>({
    queryKey,
    queryFn: async () => apiRequest(`/api/task-workflows/${id}`),
    enabled: !!id,
  });
  const { data: users = [] } = useOrgUsers();
  const userMap = new Map<string, OrgUser>(users.map((u) => [u.id, u]));

  const [busy, setBusy] = useState(false);

  function mutate(fn: () => Promise<any>, successMsg: string) {
    setBusy(true);
    fn()
      .then(() => {
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ['/api/task-workflows'] });
        toast({ title: successMsg });
      })
      .catch((e: any) =>
        toast({ title: 'Action failed', description: e.message, variant: 'destructive' }),
      )
      .finally(() => setBusy(false));
  }

  const del = useMutation({
    mutationFn: async () => apiRequest(`/api/task-workflows/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-workflows'] });
      toast({ title: 'Workflow deleted' });
      navigate('/workflows');
    },
  });

  if (isLoading || !data) {
    return (
      <MainLayout title="Workflow">
        <p className="text-muted-foreground">Loading…</p>
      </MainLayout>
    );
  }

  const { workflow, steps, events = [] } = data;
  const stages = groupStepsByStage(steps);
  const meta = WORKFLOW_STATUS_META[workflow.status];
  const isDraft = workflow.status === 'draft';
  const isActive = workflow.status === 'active';

  function assigneeNode(step: TaskWorkflowStep) {
    const u = step.assigneeUserId ? userMap.get(step.assigneeUserId) : undefined;
    const label = u ? userLabel(u) : step.assigneeName || 'Unassigned';
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[10px]">
            {u ? userInitials(u) : (step.assigneeName || '?').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {label}
      </span>
    );
  }

  return (
    <MainLayout title={workflow.name} description={workflow.description ?? undefined}>
      <div className="space-y-6">
        {/* Header actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge className={meta.className}>{meta.label}</Badge>
            {isActive && workflow.currentStageIndex >= 0 && (
              <span className="text-sm text-muted-foreground">
                Current: Stage {workflow.currentStageIndex + 1}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isDraft && (
              <>
                <Link href={`/workflows/${workflow.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                </Link>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    mutate(
                      () => apiRequest(`/api/task-workflows/${id}/start`, 'POST', {}),
                      'Workflow started — first assignees notified',
                    )
                  }
                  data-testid="button-start"
                >
                  <Play className="mr-2 h-4 w-4" /> Start
                </Button>
              </>
            )}
            {isActive && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  mutate(
                    () => apiRequest(`/api/task-workflows/${id}/advance`, 'POST', {}),
                    'Advanced to the next stage',
                  )
                }
                data-testid="button-advance"
              >
                <ChevronsRight className="mr-2 h-4 w-4" /> Advance stage
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                mutate(
                  () => apiRequest(`/api/task-workflows/${id}/save-as-template`, 'POST', {}),
                  'Saved as template',
                )
              }
            >
              <Copy className="mr-2 h-4 w-4" /> Save as template
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={del.isPending}
              onClick={() => {
                if (confirm('Delete this workflow? This cannot be undone.')) del.mutate();
              }}
              data-testid="button-delete"
            >
              <Trash2 className="mr-2 h-4 w-4 text-red-500" /> Delete
            </Button>
          </div>
        </div>

        {/* Stage board */}
        <div className="space-y-4">
          {stages.map(({ stageIndex, steps: stageSteps }) => {
            const isCurrent = isActive && stageIndex === workflow.currentStageIndex;
            const isPast = isActive && stageIndex < workflow.currentStageIndex;
            return (
              <Card
                key={stageIndex}
                className={isCurrent ? 'border-blue-400 ring-1 ring-blue-200' : undefined}
              >
                <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    Stage {stageIndex + 1}
                    {isCurrent && <Badge className="bg-blue-100 text-blue-800">Current</Badge>}
                    {stageSteps.length > 1 && (
                      <span className="text-xs font-normal text-muted-foreground">
                        ({stageSteps.length} parallel steps)
                      </span>
                    )}
                  </CardTitle>
                  {isActive && (isPast || isCurrent) && stageIndex > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          () =>
                            apiRequest(`/api/task-workflows/${id}/regress`, 'POST', {
                              toStageIndex: stageIndex,
                              note: 'Sent back for revisions',
                            }),
                          `Sent back to Stage ${stageIndex + 1}`,
                        )
                      }
                      data-testid={`button-regress-${stageIndex}`}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Send back here
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {stageSteps.map((step) => {
                    const sm = STEP_STATUS_META[step.status];
                    const canComplete =
                      isActive && (step.status === 'active' || step.status === 'in_progress');
                    const canReopen = step.status === 'completed' || step.status === 'skipped';
                    return (
                      <div
                        key={step.id}
                        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                        data-testid={`detail-step-${step.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/workflows/${workflow.id}/steps/${step.id}`}>
                              <span className="font-medium hover:underline">{step.title}</span>
                            </Link>
                            <Badge className={sm.className}>{sm.label}</Badge>
                          </div>
                          {step.details && (
                            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                              {step.details}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-3">
                            {assigneeNode(step)}
                            {step.dueAt && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" /> Due {fmt(step.dueAt).split(',')[0]}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {canComplete && (
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                mutate(
                                  () =>
                                    apiRequest(
                                      `/api/task-workflows/${id}/steps/${step.id}/complete`,
                                      'POST',
                                      {},
                                    ),
                                  'Step completed',
                                )
                              }
                              data-testid={`button-complete-${step.id}`}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Complete
                            </Button>
                          )}
                          {canReopen && isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                mutate(
                                  () =>
                                    apiRequest(
                                      `/api/task-workflows/${id}/steps/${step.id}/reopen`,
                                      'POST',
                                      {},
                                    ),
                                  'Step reopened',
                                )
                              }
                              data-testid={`button-reopen-${step.id}`}
                            >
                              <Undo2 className="mr-2 h-4 w-4" /> Reopen
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Activity log */}
        {events.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {events.map((ev) => {
                  const actor = ev.actorUserId ? userMap.get(ev.actorUserId) : undefined;
                  return (
                    <li key={ev.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                      <div>
                        <span className="font-medium">{ev.eventType.replace(/_/g, ' ')}</span>
                        {actor && (
                          <span className="text-muted-foreground"> · {userLabel(actor)}</span>
                        )}
                        {ev.note && <span className="text-muted-foreground"> — {ev.note}</span>}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {fmt(ev.createdAt)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
