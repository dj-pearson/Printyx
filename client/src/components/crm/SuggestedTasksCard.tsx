/**
 * Suggested Tasks (COP-B03), on the COP-B01 workspace.
 *
 * Ranked next actions drawn from signals the database already holds. Two
 * things it deliberately does NOT do:
 *
 *  - It never shows a suggestion nobody can act on. Every row carries the
 *    reason in plain language and an imperative action, and clicking it goes
 *    to the record rather than opening a modal about the record.
 *  - It does not hide a failure. If the endpoint is down the card says so;
 *    a card that quietly renders nothing is indistinguishable from a rep who
 *    has nothing to do, which is the worst possible confusion here.
 *
 * Expiry is the server's job (a sweep stops regenerating a cleared signal), so
 * this list needs no client-side staleness logic at all.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Lightbulb, X } from 'lucide-react';

export interface SuggestedTask {
  id: string;
  suggestionType: string;
  recordType: string;
  recordId: string;
  reason: string;
  action: string;
  score: number;
  companyName: string | null;
}

const LIST_KEY = '/api/suggested-tasks?mine=true&limit=8';

/** Where a suggestion sends the rep. A play belongs to the radar, not a deal. */
function targetFor(task: SuggestedTask): string {
  if (task.recordType === 'deal') return `/crm/deals/${task.recordId}`;
  if (task.recordType === 'quote') return `/quotes/${task.recordId}`;
  return '/opportunity-radar';
}

export function SuggestedTasksCard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery<{ data: SuggestedTask[]; total: number }>({
    queryKey: [LIST_KEY],
    queryFn: () => apiRequest(LIST_KEY),
    staleTime: 60_000,
  });

  const resolve = useMutation({
    mutationFn: ({ id, how }: { id: string; how: 'dismiss' | 'complete' }) =>
      apiRequest(`/api/suggested-tasks/${id}/${how}`, 'POST'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LIST_KEY] }),
    onError: (err: unknown) =>
      toast({
        title: 'Could not update the suggestion',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  if (query.isLoading) return <Skeleton className="h-40 w-full" />;

  const tasks = query.data?.data ?? [];
  // Nothing to suggest is a normal morning, not a card worth the space.
  if (!query.isError && tasks.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Suggested next actions</CardTitle>
          {tasks.length > 0 && (
            <Badge variant="outline" className="font-normal">
              {tasks.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {query.isError ? (
          <p className="text-sm text-muted-foreground">
            Suggestions did not load. Nothing here is stale or partial — it simply did not load.
          </p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <button
                type="button"
                onClick={() => navigate(targetFor(task))}
                className="min-w-0 flex-1 text-left"
              >
                <div className="font-medium truncate">{task.companyName ?? 'Untitled account'}</div>
                <p className="text-sm text-muted-foreground">{task.reason}</p>
                <p className="text-sm mt-0.5">{task.action}</p>
              </button>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Mark this suggestion done"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ id: task.id, how: 'complete' })}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Dismiss this suggestion"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ id: task.id, how: 'dismiss' })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
