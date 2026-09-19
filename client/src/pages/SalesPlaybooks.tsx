/**
 * Playbook authoring (COP-B13, AC1 + AC2).
 *
 * The write-back target is a PICKER, never a text box. That is not a UX
 * preference: the field key an author chooses is what decides which column an
 * answer writes, and a text box is how an unchecked column name gets authored
 * in the first place. The server holds the same line with its allow-list — this
 * page just makes the safe thing the only thing on offer.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Sparkles, Trash2 } from 'lucide-react';

const ANSWER_TYPES = ['text', 'number', 'currency', 'boolean', 'select', 'date'] as const;

interface Question {
  id: string;
  prompt: string;
  helpText?: string | null;
  answerType: string;
  options?: string[] | null;
  writeBackField?: string | null;
  required?: boolean;
}

interface Playbook {
  id: string;
  name: string;
  motion: string | null;
  description: string | null;
  appliesTo: string;
  questions: Question[];
  gatesStageAdvance: boolean;
  isActive: boolean;
}

interface FieldOption {
  key: string;
  label: string;
  table: string;
  accepts: string[];
}

const blankQuestion = (): Question => ({
  // A stable id generated once here and preserved on every later edit, because
  // recorded answers are keyed on it.
  id: `q_${Math.random().toString(36).slice(2, 10)}`,
  prompt: '',
  answerType: 'text',
  required: false,
  writeBackField: null,
});

export default function SalesPlaybooks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Playbook | null>(null);

  const listQuery = useQuery<{ data: Playbook[]; canAuthor: boolean }>({
    queryKey: ['/api/playbooks'],
    queryFn: () => apiRequest('/api/playbooks'),
  });
  const fieldsQuery = useQuery<{ fields: FieldOption[] }>({
    queryKey: ['/api/playbooks/fields'],
    queryFn: () => apiRequest('/api/playbooks/fields'),
    staleTime: Infinity,
  });

  const playbooks = listQuery.data?.data ?? [];
  const canAuthor = listQuery.data?.canAuthor ?? false;
  const fields = fieldsQuery.data?.fields ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/playbooks'] });

  const seed = useMutation({
    mutationFn: () => apiRequest('/api/playbooks/seed-starters', 'POST'),
    onSuccess: (r: { created?: number; skipped?: number }) => {
      toast({
        title: `${r.created ?? 0} starter playbook(s) installed`,
        description: r.skipped ? `${r.skipped} already existed and were left alone.` : undefined,
      });
      invalidate();
    },
    onError: () => toast({ title: 'Could not install the starters', variant: 'destructive' }),
  });

  const save = useMutation({
    mutationFn: (playbook: Playbook) =>
      playbook.id
        ? apiRequest(`/api/playbooks/${playbook.id}`, 'PUT', playbook)
        : apiRequest('/api/playbooks', 'POST', playbook),
    onSuccess: () => {
      toast({ title: 'Playbook saved' });
      setEditing(null);
      invalidate();
    },
    onError: (err: unknown) =>
      toast({
        title: 'Could not save the playbook',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const openNew = () =>
    setEditing({
      id: '',
      name: '',
      motion: null,
      description: null,
      appliesTo: 'deal',
      questions: [blankQuestion()],
      gatesStageAdvance: false,
      isActive: true,
    });

  const patchQuestion = (index: number, patch: Partial<Question>) =>
    setEditing((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
          }
        : current,
    );

  return (
    <MainLayout
      title="Sales playbooks"
      description="Guided discovery questions that render on the record and write their answers back to it."
    >
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Playbooks</CardTitle>
          {canAuthor && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => seed.mutate()}
                disabled={seed.isPending}
              >
                <Sparkles className="h-4 w-4 mr-1.5" /> Install starters
              </Button>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1.5" /> New playbook
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {listQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : playbooks.length === 0 ? (
            <EmptyState
              title="No playbooks yet"
              description={
                canAuthor
                  ? 'Install the four starter copier motions — fleet walk, volume qualification, lease position, and decision committee — or write your own.'
                  : 'A sales manager can author these.'
              }
            />
          ) : (
            playbooks.map((playbook) => (
              <div key={playbook.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{playbook.name}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {playbook.questions.length} question
                        {playbook.questions.length === 1 ? '' : 's'}
                      </Badge>
                      {playbook.gatesStageAdvance && (
                        <Badge variant="outline" className="text-xs font-normal text-amber-700">
                          Gates stage advance
                        </Badge>
                      )}
                      {!playbook.isActive && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {playbook.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{playbook.description}</p>
                    )}
                  </div>
                  {canAuthor && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(playbook)}>
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit playbook' : 'New playbook'}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="pb-name">Name</Label>
                <Input
                  id="pb-name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Fleet walk"
                />
              </div>

              <div>
                <Label htmlFor="pb-description">Description</Label>
                <Textarea
                  id="pb-description"
                  rows={2}
                  value={editing.description ?? ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="pr-4">
                  <Label htmlFor="pb-gate">Block stage advance until complete</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Off by default. A gate nobody asked for is a rep who cannot move their own deal.
                  </p>
                </div>
                <Switch
                  id="pb-gate"
                  checked={editing.gatesStageAdvance}
                  onCheckedChange={(checked) =>
                    setEditing({ ...editing, gatesStageAdvance: checked })
                  }
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Questions</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({ ...editing, questions: [...editing.questions, blankQuestion()] })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                {editing.questions.map((question, index) => (
                  <div key={question.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Input
                        aria-label={`Question ${index + 1}`}
                        value={question.prompt}
                        onChange={(e) => patchQuestion(index, { prompt: e.target.value })}
                        placeholder="What is the buyout figure today?"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove question ${index + 1}`}
                        onClick={() =>
                          setEditing({
                            ...editing,
                            questions: editing.questions.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Input
                      aria-label={`Help text for question ${index + 1}`}
                      value={question.helpText ?? ''}
                      onChange={(e) => patchQuestion(index, { helpText: e.target.value })}
                      placeholder="Coaching note shown under the question"
                    />

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select
                        value={question.answerType}
                        onValueChange={(v) => patchQuestion(index, { answerType: v })}
                      >
                        <SelectTrigger aria-label={`Answer type for question ${index + 1}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ANSWER_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* A PICKER, not a text box. See the file header. */}
                      <Select
                        value={question.writeBackField ?? 'none'}
                        onValueChange={(v) =>
                          patchQuestion(index, { writeBackField: v === 'none' ? null : v })
                        }
                      >
                        <SelectTrigger aria-label={`Write-back field for question ${index + 1}`}>
                          <SelectValue placeholder="Saves on the playbook only" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Saves on the playbook only</SelectItem>
                          {fields
                            .filter((f) => f.accepts.includes(question.answerType))
                            .map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {question.answerType === 'select' && (
                      <Input
                        aria-label={`Options for question ${index + 1}`}
                        value={(question.options ?? []).join(', ')}
                        onChange={(e) =>
                          patchQuestion(index, {
                            options: e.target.value
                              .split(',')
                              .map((o) => o.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Meter read, Invoice, Customer estimate"
                      />
                    )}

                    <div className="flex items-center gap-2">
                      <Switch
                        id={`req-${question.id}`}
                        checked={Boolean(question.required)}
                        onCheckedChange={(checked) => patchQuestion(index, { required: checked })}
                      />
                      <Label htmlFor={`req-${question.id}`} className="text-sm font-normal">
                        Required for completion
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => editing && save.mutate(editing)}
              disabled={!editing?.name.trim() || save.isPending}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
