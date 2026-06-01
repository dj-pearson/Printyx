/**
 * WorkflowsListPage — browse workflow instances and templates, create new ones.
 */
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Workflow as WorkflowIcon, FileText, Copy } from 'lucide-react';
import { type TaskWorkflow, WORKFLOW_STATUS_META } from '@/lib/workflows/types';

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {done}/{total} steps complete
      </p>
    </div>
  );
}

function WorkflowCard({ wf }: { wf: TaskWorkflow }) {
  const meta = WORKFLOW_STATUS_META[wf.status];
  return (
    <Link href={`/workflows/${wf.id}`}>
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        data-testid={`card-workflow-${wf.id}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{wf.name}</CardTitle>
            <Badge className={meta.className}>{meta.label}</Badge>
          </div>
          {wf.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{wf.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <ProgressBar done={wf.completedStepCount ?? 0} total={wf.stepCount ?? 0} />
        </CardContent>
      </Card>
    </Link>
  );
}

export default function WorkflowsListPage() {
  const [tab, setTab] = useState<'instances' | 'templates'>('instances');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: instances = [], isLoading: loadingInstances } = useQuery<TaskWorkflow[]>({
    queryKey: ['/api/task-workflows', { type: 'instances' }],
    queryFn: async () => apiRequest('/api/task-workflows?type=instances'),
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<TaskWorkflow[]>({
    queryKey: ['/api/task-workflows', { type: 'templates' }],
    queryFn: async () => apiRequest('/api/task-workflows?type=templates'),
  });

  const instantiate = useMutation({
    mutationFn: async (templateId: string) =>
      apiRequest(`/api/task-workflows/from-template/${templateId}`, 'POST', {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-workflows'] });
      toast({
        title: 'Workflow created',
        description: 'A new workflow was created from the template.',
      });
      if (data?.workflow?.id) navigate(`/workflows/${data.workflow.id}/edit`);
    },
    onError: () =>
      toast({
        title: 'Error',
        description: 'Failed to create from template',
        variant: 'destructive',
      }),
  });

  return (
    <MainLayout
      title="Workflows"
      description="Build customizable, multi-step workflows that hand off automatically as each step completes."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="instances" data-testid="tab-instances">
                <WorkflowIcon className="mr-2 h-4 w-4" /> Workflows
              </TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates">
                <FileText className="mr-2 h-4 w-4" /> Templates
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Link href="/workflows/new">
            <Button data-testid="button-new-workflow">
              <Plus className="mr-2 h-4 w-4" /> New Workflow
            </Button>
          </Link>
        </div>

        <Tabs value={tab}>
          <TabsContent value="instances" className="mt-0">
            {loadingInstances ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : instances.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <WorkflowIcon className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">No workflows yet</p>
                    <p className="text-sm text-muted-foreground">
                      Upload a spreadsheet or screenshot, or start from scratch.
                    </p>
                  </div>
                  <Link href="/workflows/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> New Workflow
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {instances.map((wf) => (
                  <WorkflowCard key={wf.id} wf={wf} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-0">
            {loadingTemplates ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No templates yet. Save any workflow as a template to reuse it.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((tpl) => (
                  <Card key={tpl.id} data-testid={`card-template-${tpl.id}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{tpl.name}</CardTitle>
                      {tpl.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {tpl.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {tpl.stepCount ?? 0} steps
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={instantiate.isPending}
                        onClick={() => instantiate.mutate(tpl.id)}
                        data-testid={`button-use-template-${tpl.id}`}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Use template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
