/**
 * WorkflowBuilderPage — create a workflow (manually or by parsing an upload),
 * edit the draft steps + assignees, then save as a one-off or a template.
 *
 * Steps are kept in a flat ordered list. Each step has a `parallelWithPrev`
 * flag; the actual stageIndex is computed from that on save (a run of steps
 * marked "parallel with previous" share a stage and run simultaneously). The
 * workflow only advances to the next stage when every step in the current stage
 * is complete.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, apiFormRequest } from '@/lib/queryClient';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Save,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { AssigneeSelect } from '@/components/workflows/AssigneeSelect';
import type { ParsedWorkflowDraft, WorkflowDetail } from '@/lib/workflows/types';

interface DraftStep {
  key: string;
  title: string;
  details: string;
  assigneeUserId: string | null;
  assigneeName?: string;
  matchConfidence?: number;
  dueAt: string; // yyyy-mm-dd or ''
  parallelWithPrev: boolean;
}

let keySeq = 1;
const newKey = () => `s${keySeq++}`;

function emptyStep(): DraftStep {
  return {
    key: newKey(),
    title: '',
    details: '',
    assigneeUserId: null,
    dueAt: '',
    parallelWithPrev: false,
  };
}

/** Compute the stageIndex of each row from the parallelWithPrev flags. */
function computeStages(steps: DraftStep[]): number[] {
  const stages: number[] = [];
  let stage = -1;
  steps.forEach((s, i) => {
    if (i === 0) stage = 0;
    else if (s.parallelWithPrev) {
      /* same stage as previous */
    } else stage += 1;
    stages.push(stage);
  });
  return stages;
}

export default function WorkflowBuilderPage() {
  const [, navigate] = useLocation();
  const [matchEdit, paramsEdit] = useRoute('/workflows/:id/edit');
  const editId = matchEdit ? paramsEdit?.id : undefined;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectManagerId, setProjectManagerId] = useState<string | null>(null);
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [steps, setSteps] = useState<DraftStep[]>([emptyStep()]);
  const [sourceType, setSourceType] = useState<'manual' | 'image' | 'csv' | 'xlsx' | 'template'>(
    'manual',
  );
  const [sourceFileName, setSourceFileName] = useState<string | undefined>();
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);

  // ----- Edit mode: hydrate from the existing draft ------------------------
  const { data: existing } = useQuery<WorkflowDetail>({
    queryKey: ['/api/task-workflows', editId],
    queryFn: async () => apiRequest(`/api/task-workflows/${editId}`),
    enabled: !!editId,
  });

  useEffect(() => {
    if (!existing) return;
    setName(existing.workflow.name);
    setDescription(existing.workflow.description ?? '');
    setProjectManagerId(existing.workflow.projectManagerId);
    setNotifyByEmail((existing.workflow.settings as any)?.notifyByEmail !== false);
    setSourceType(existing.workflow.sourceType);
    const sorted = [...existing.steps].sort(
      (a, b) => a.stageIndex - b.stageIndex || a.orderIndex - b.orderIndex,
    );
    setSteps(
      sorted.map((s, i) => ({
        key: newKey(),
        title: s.title,
        details: s.details ?? '',
        assigneeUserId: s.assigneeUserId,
        assigneeName: s.assigneeName ?? undefined,
        dueAt: s.dueAt ? String(s.dueAt).slice(0, 10) : '',
        parallelWithPrev: i > 0 && s.stageIndex === sorted[i - 1].stageIndex,
      })),
    );
  }, [existing]);

  const stages = useMemo(() => computeStages(steps), [steps]);

  // ----- Step mutators -----------------------------------------------------
  const update = (key: string, patch: Partial<DraftStep>) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const remove = (key: string) =>
    setSteps((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== key) : prev));
  const addStep = () => setSteps((prev) => [...prev, emptyStep()]);
  const move = (idx: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  // ----- Upload + parse ----------------------------------------------------
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const draft: ParsedWorkflowDraft = await apiFormRequest(
        '/api/task-workflows/parse',
        'POST',
        form,
      );

      setSteps(
        draft.steps.map((s) => ({
          key: newKey(),
          title: s.title,
          details: s.details ?? '',
          assigneeUserId: s.suggestedAssigneeUserId ?? null,
          assigneeName: s.assigneeName,
          matchConfidence: s.matchConfidence,
          dueAt: '',
          parallelWithPrev: false,
        })),
      );
      setSourceType(draft.sourceType);
      setSourceFileName(draft.sourceFileName);
      setUnmatched(draft.unmatchedAssignees || []);
      if (!name && draft.suggestedName) setName(draft.suggestedName);
      toast({
        title: 'File parsed',
        description: `${draft.steps.length} step(s) extracted. Review the assignees before saving.`,
      });
    } catch (err: any) {
      toast({ title: 'Parse failed', description: err.message, variant: 'destructive' });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ----- Build the payload -------------------------------------------------
  function buildStepsPayload() {
    return steps
      .filter((s) => s.title.trim())
      .map((s, i) => {
        // orderIndex within the stage
        const stageIndex = stages[i];
        const orderIndex = steps.slice(0, i).filter((_, k) => stages[k] === stageIndex).length;
        return {
          title: s.title.trim(),
          details: s.details.trim() || null,
          stageIndex,
          orderIndex,
          assigneeUserId: s.assigneeUserId,
          assigneeName: s.assigneeName ?? null,
          dueAt: s.dueAt ? new Date(s.dueAt).toISOString() : null,
        };
      });
  }

  // ----- Save --------------------------------------------------------------
  const saveNew = useMutation({
    mutationFn: async (startNow: boolean) =>
      apiRequest('/api/task-workflows', 'POST', {
        name: name.trim(),
        description: description.trim() || null,
        isTemplate: saveAsTemplate,
        projectManagerId,
        sourceType,
        sourceFileName,
        settings: { notifyByEmail },
        steps: buildStepsPayload(),
        startNow,
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-workflows'] });
      toast({
        title: 'Saved',
        description: saveAsTemplate ? 'Template saved.' : 'Workflow saved.',
      });
      navigate(`/workflows/${data.workflow.id}`);
    },
    onError: (e: any) =>
      toast({ title: 'Error', description: e.message || 'Failed to save', variant: 'destructive' }),
  });

  const saveEdit = useMutation({
    mutationFn: async (startNow: boolean) => {
      await apiRequest(`/api/task-workflows/${editId}`, 'PATCH', {
        name: name.trim(),
        description: description.trim() || null,
        projectManagerId,
        settings: { ...(existing?.workflow.settings || {}), notifyByEmail },
      });
      await apiRequest(`/api/task-workflows/${editId}/steps`, 'PUT', {
        steps: buildStepsPayload(),
      });
      if (startNow) await apiRequest(`/api/task-workflows/${editId}/start`, 'POST', {});
      return { id: editId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/task-workflows'] });
      toast({ title: 'Saved', description: 'Workflow updated.' });
      navigate(`/workflows/${editId}`);
    },
    onError: (e: any) =>
      toast({ title: 'Error', description: e.message || 'Failed to save', variant: 'destructive' }),
  });

  const saving = saveNew.isPending || saveEdit.isPending;
  const canSave = name.trim().length > 0 && steps.some((s) => s.title.trim());

  function doSave(startNow: boolean) {
    if (!canSave) {
      toast({ title: 'Add a name and at least one step', variant: 'destructive' });
      return;
    }
    if (editId) saveEdit.mutate(startNow);
    else saveNew.mutate(startNow);
  }

  return (
    <MainLayout
      title={editId ? 'Edit Workflow' : 'New Workflow'}
      description="Upload a spreadsheet, CSV, or screenshot to auto-build steps — or add them by hand. Confirm the assignees, then save."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wf-name">Name</Label>
              <Input
                id="wf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. New Device Delivery — Farm Bureau"
                data-testid="input-workflow-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wf-desc">Description</Label>
              <Textarea
                id="wf-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional context for everyone involved"
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Project manager (optional)</Label>
                <AssigneeSelect
                  value={projectManagerId}
                  onChange={setProjectManagerId}
                  placeholder="Defaults to you"
                />
                <p className="text-xs text-muted-foreground">
                  The PM (and you, the creator) can advance or send steps back for revisions.
                </p>
              </div>
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notify">Email assignees on handoff</Label>
                  <Switch id="notify" checked={notifyByEmail} onCheckedChange={setNotifyByEmail} />
                </div>
                {!editId && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="tpl">Save as reusable template</Label>
                    <Switch id="tpl" checked={saveAsTemplate} onCheckedChange={setSaveAsTemplate} />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Source / upload */}
        {!editId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Build from a file (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,image/*"
                className="hidden"
                onChange={onFile}
                data-testid="input-file-upload"
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={parsing}
                data-testid="button-upload"
              >
                {parsing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {parsing ? 'Parsing…' : 'Upload CSV, Excel, or image'}
              </Button>
              <p className="text-xs text-muted-foreground">
                We read each row as a step and its responsible person, then fuzzy-match the name to
                a user. You confirm everything below before saving.
              </p>
              {unmatched.length > 0 && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Couldn’t auto-match: <strong>{unmatched.join(', ')}</strong>. Pick an assignee
                    for those steps manually.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Steps editor */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Steps</CardTitle>
            <Button size="sm" variant="outline" onClick={addStep} data-testid="button-add-step">
              <Plus className="mr-2 h-4 w-4" /> Add step
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((s, i) => {
              const newStage = i === 0 || !s.parallelWithPrev;
              return (
                <div key={s.key}>
                  {newStage && (
                    <div className="mb-1 mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className="rounded bg-slate-100 px-2 py-0.5">
                        Stage {stages[i] + 1}
                      </span>
                    </div>
                  )}
                  <div className="rounded-lg border p-3" data-testid={`step-row-${i}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-1 pt-1">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          onClick={() => move(i, 1)}
                          disabled={i === steps.length - 1}
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={s.title}
                          onChange={(e) => update(s.key, { title: e.target.value })}
                          placeholder="Step title (e.g. Confirm Delivery with Brett/James)"
                          data-testid={`input-step-title-${i}`}
                        />
                        <Textarea
                          value={s.details}
                          onChange={(e) => update(s.key, { details: e.target.value })}
                          placeholder="Details / instructions (optional)"
                          rows={2}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="min-w-[200px] flex-1">
                            <AssigneeSelect
                              value={s.assigneeUserId}
                              onChange={(uid) => update(s.key, { assigneeUserId: uid })}
                            />
                          </div>
                          <Input
                            type="date"
                            value={s.dueAt}
                            onChange={(e) => update(s.key, { dueAt: e.target.value })}
                            className="w-[160px]"
                            aria-label="Due date"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(s.key)}
                            aria-label="Remove step"
                            data-testid={`button-remove-step-${i}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                        {s.assigneeName && !s.assigneeUserId && (
                          <Badge variant="outline" className="text-amber-700">
                            From file: “{s.assigneeName}” — pick a user
                          </Badge>
                        )}
                        {s.assigneeName && s.assigneeUserId && (s.matchConfidence ?? 1) < 0.85 && (
                          <Badge variant="outline" className="text-blue-700">
                            Guessed from “{s.assigneeName}” — confirm
                          </Badge>
                        )}
                        {i > 0 && (
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={s.parallelWithPrev}
                              onCheckedChange={(c) =>
                                update(s.key, { parallelWithPrev: c === true })
                              }
                              data-testid={`checkbox-parallel-${i}`}
                            />
                            Run in parallel with the step above (same stage)
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
          <Button variant="ghost" onClick={() => navigate('/workflows')} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => doSave(false)}
            disabled={saving || !canSave}
            data-testid="button-save-draft"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saveAsTemplate ? 'Save template' : 'Save draft'}
          </Button>
          {!saveAsTemplate && (
            <Button
              onClick={() => doSave(true)}
              disabled={saving || !canSave}
              data-testid="button-save-start"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Save &amp; start
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
