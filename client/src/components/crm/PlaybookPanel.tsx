/**
 * Guided discovery on the record (COP-B13).
 *
 * The questions are in front of the rep while they are on the call, and the
 * answers land in real columns — the panel says which ones, after each save,
 * because "it saved" and "it reached the deal" are different claims and a rep
 * should not have to take the second on trust.
 *
 * Completion counts REQUIRED questions only. A playbook of twelve optional
 * questions showing 8% after one answer is what teaches reps to ignore
 * progress bars.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CheckCircle2, Info } from 'lucide-react';

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
  questions: Question[];
  gatesStageAdvance: boolean;
}

interface Completion {
  requiredTotal: number;
  requiredAnswered: number;
  total: number;
  answered: number;
  isComplete: boolean;
}

interface PlaybookEntry {
  playbook: Playbook;
  run: { id: string; answers: Record<string, unknown> } | null;
  completion: Completion;
}

interface ForRecordResponse {
  data: PlaybookEntry[];
  canAuthor: boolean;
}

export function PlaybookPanel({
  parentType,
  parentId,
}: {
  parentType: 'deal' | 'contact' | 'company';
  parentId?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const key = `/api/playbooks/for-record/${parentType}/${parentId}`;

  const { data, isLoading, isError, refetch } = useQuery<ForRecordResponse>({
    queryKey: [key],
    queryFn: () => apiRequest(key),
    enabled: Boolean(parentId),
  });

  /** Local edits per playbook, so typing does not save per keystroke. */
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});

  // Seed each draft from its saved run once, and again whenever the server's
  // answers change underneath (a stage-entry trigger can create a run while
  // this panel is open).
  useEffect(() => {
    if (!data) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const entry of data.data) {
        if (next[entry.playbook.id] === undefined) {
          next[entry.playbook.id] = { ...(entry.run?.answers ?? {}) };
        }
      }
      return next;
    });
  }, [data]);

  const save = useMutation({
    mutationFn: (playbookId: string) =>
      apiRequest('/api/playbooks/runs', 'POST', {
        playbookId,
        parentType,
        parentId,
        answers: drafts[playbookId] ?? {},
      }),
    onSuccess: (result: {
      written?: Array<{ column: string }>;
      rejected?: Array<{ reason: string }>;
      writeErrors?: string[];
    }) => {
      queryClient.invalidateQueries({ queryKey: [key] });
      // The record itself has changed, so anything reading it must refetch.
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${parentId}`] });

      const written = result.written?.length ?? 0;
      const problems = [
        ...(result.rejected ?? []).map((r) => r.reason),
        ...(result.writeErrors ?? []),
      ];
      toast({
        title:
          written > 0 ? `Saved, and ${written} field(s) updated on the record` : 'Answers saved',
        description: problems.length > 0 ? problems.join(' ') : undefined,
        variant: problems.length > 0 ? 'destructive' : undefined,
      });
    },
    onError: () => toast({ title: 'Could not save the playbook', variant: 'destructive' }),
  });

  if (!parentId) return null;
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  // A failed fetch used to fall through to the same empty state as "this record
  // matches no playbook", which is a different and much more reassuring claim.
  if (isError) return <InlineQueryError label="playbooks" onRetry={refetch} />;

  if (!data || data.data.length === 0) {
    return (
      <EmptyState
        title="No playbooks for this record"
        description={
          data?.canAuthor
            ? 'A sales manager can author playbooks, or install the four starter copier motions, from Playbooks.'
            : 'A sales manager can add guided discovery questions here.'
        }
      />
    );
  }

  const setAnswer = (playbookId: string, questionId: string, value: unknown) =>
    setDrafts((current) => ({
      ...current,
      [playbookId]: { ...(current[playbookId] ?? {}), [questionId]: value },
    }));

  return (
    <Accordion type="multiple" className="w-full">
      {data.data.map((entry) => {
        const { playbook, completion } = entry;
        const answers = drafts[playbook.id] ?? {};
        return (
          <AccordionItem key={playbook.id} value={playbook.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2 text-left">
                {completion.isComplete && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
                <span className="font-medium">{playbook.name}</span>
                <Badge variant="outline" className="text-xs font-normal">
                  {/* Required questions, not all questions. */}
                  {completion.requiredTotal > 0
                    ? `${completion.requiredAnswered}/${completion.requiredTotal}`
                    : `${completion.answered}/${completion.total}`}
                </Badge>
                {playbook.gatesStageAdvance && !completion.isComplete && (
                  <Badge variant="outline" className="text-xs font-normal text-amber-700">
                    Blocks stage advance
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-1">
              {playbook.description && (
                <p className="text-sm text-muted-foreground">{playbook.description}</p>
              )}

              {playbook.questions.map((question) => {
                const value = answers[question.id];
                const inputId = `${playbook.id}-${question.id}`;
                return (
                  <div key={question.id} className="space-y-1.5">
                    <Label htmlFor={inputId} className="text-sm">
                      {question.prompt}
                      {question.required && <span className="text-rose-600"> *</span>}
                    </Label>

                    {question.answerType === 'select' ? (
                      <Select
                        value={typeof value === 'string' ? value : ''}
                        onValueChange={(v) => setAnswer(playbook.id, question.id, v)}
                      >
                        <SelectTrigger id={inputId}>
                          <SelectValue placeholder="Choose one" />
                        </SelectTrigger>
                        <SelectContent>
                          {(question.options ?? []).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : question.answerType === 'boolean' ? (
                      <Select
                        value={value === true ? 'yes' : value === false ? 'no' : ''}
                        onValueChange={(v) => setAnswer(playbook.id, question.id, v === 'yes')}
                      >
                        <SelectTrigger id={inputId}>
                          <SelectValue placeholder="Yes or no" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : question.answerType === 'text' && !question.writeBackField ? (
                      <Textarea
                        id={inputId}
                        rows={2}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(e) => setAnswer(playbook.id, question.id, e.target.value)}
                      />
                    ) : (
                      <Input
                        id={inputId}
                        type={question.answerType === 'date' ? 'date' : 'text'}
                        inputMode={
                          question.answerType === 'number' || question.answerType === 'currency'
                            ? 'decimal'
                            : undefined
                        }
                        value={
                          typeof value === 'string' || typeof value === 'number'
                            ? String(value)
                            : ''
                        }
                        onChange={(e) => setAnswer(playbook.id, question.id, e.target.value)}
                      />
                    )}

                    {question.helpText && (
                      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {question.helpText}
                      </p>
                    )}
                    {question.writeBackField && (
                      <p className="text-xs text-muted-foreground">Saves onto the record.</p>
                    )}
                  </div>
                );
              })}

              <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(playbook.id)}>
                {save.isPending ? 'Saving…' : 'Save answers'}
              </Button>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
