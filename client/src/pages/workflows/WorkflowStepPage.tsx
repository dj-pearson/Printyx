/**
 * WorkflowStepPage — the deep-link target for assignment emails / notifications
 * (/workflows/:id/steps/:stepId). Shows the step's full detail and a one-click
 * "Mark complete" that hands off to the next stage.
 */
import { Link, useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { useOrgUsers } from '@/components/workflows/AssigneeSelect';
import {
  type WorkflowDetail,
  type OrgUser,
  STEP_STATUS_META,
  userInitials,
  userLabel,
} from '@/lib/workflows/types';

export default function WorkflowStepPage() {
  const [, params] = useRoute('/workflows/:id/steps/:stepId');
  const id = params?.id;
  const stepId = params?.stepId;
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

  const complete = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/task-workflows/${id}/steps/${stepId}/complete`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['/api/task-workflows'] });
      toast({ title: 'Step completed', description: 'The next assignee has been notified.' });
    },
    onError: (e: any) =>
      toast({ title: 'Could not complete', description: e.message, variant: 'destructive' }),
  });

  if (isLoading || !data) {
    return (
      <MainLayout title="Task">
        <p className="text-muted-foreground">Loading…</p>
      </MainLayout>
    );
  }

  const step = data.steps.find((s) => s.id === stepId);
  if (!step) {
    return (
      <MainLayout title="Task">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">This step no longer exists.</p>
            <Button className="mt-4" onClick={() => navigate(`/workflows/${id}`)}>
              Back to workflow
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const sm = STEP_STATUS_META[step.status];
  const assignee = step.assigneeUserId ? userMap.get(step.assigneeUserId) : undefined;
  const canComplete = step.status === 'active' || step.status === 'in_progress';

  return (
    <MainLayout title={step.title} description={`Part of: ${data.workflow.name}`}>
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href={`/workflows/${id}`}>
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> {data.workflow.name}
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle>{step.title}</CardTitle>
              <Badge className={sm.className}>{sm.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {step.details ? (
              <p className="whitespace-pre-wrap text-sm">{step.details}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No additional details.</p>
            )}

            <div className="flex flex-wrap items-center gap-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Assigned to</span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">
                      {assignee
                        ? userInitials(assignee)
                        : (step.assigneeName || '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {assignee ? userLabel(assignee) : step.assigneeName || 'Unassigned'}
                </span>
              </div>
              {step.dueAt && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> Due {new Date(step.dueAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {canComplete && (
              <Button
                className="w-full sm:w-auto"
                disabled={complete.isPending}
                onClick={() => complete.mutate()}
                data-testid="button-step-complete"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark complete
              </Button>
            )}
            {step.status === 'completed' && step.completedAt && (
              <p className="text-sm text-green-700">
                Completed {new Date(step.completedAt).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
