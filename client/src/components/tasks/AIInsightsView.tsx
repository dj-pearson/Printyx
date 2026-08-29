/**
 * Task insights.
 *
 * Every number on this tab used to be written into the JSX: "42 min" average
 * completion, an 87% on-time rate, "+15%" velocity, a "Focus Score" of 8.2/10,
 * three AI recommendations with confidence scores of 0.85/0.78/0.92, and a
 * sidebar reporting 42 tasks completed and 28h 15m tracked this week. None of
 * it came from the tenant's data, and the props carrying that data - `tasks`
 * and `stats` - were accepted and never read.
 *
 * What is here now is derived from those props, and anything the schema cannot
 * answer was removed rather than estimated. `tasks` carries createdAt, dueDate,
 * completedAt, status, priority and timeTracked, which is enough for turnaround,
 * on-time delivery, weekly throughput and tracked time. There is no signal for
 * "focus" or for context-switching cost, so those cards are gone.
 *
 * The recommendations panel now asks the API for real suggestions. The tasks
 * edge function answers GET /suggestions with an empty list and a message
 * saying a task_suggestions table does not exist yet; that message is what the
 * panel shows, so an unbuilt feature reads as unbuilt.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Brain, Lightbulb, TrendingUp, Clock, Zap, BarChart3, Target } from 'lucide-react';

interface TaskRow {
  id: string;
  status?: string | null;
  priority?: string | null;
  createdAt?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  timeTracked?: number | null;
}

interface TaskStats {
  total?: number;
  byStatus?: Record<string, number>;
  byPriority?: Record<string, number>;
  overdue?: number;
  dueToday?: number;
  myOpen?: number;
}

interface SuggestionsResponse {
  suggestions?: Array<{ id: string; title: string; description?: string }>;
  stub?: boolean;
  message?: string;
}

interface AIInsightsViewProps {
  tasks: TaskRow[];
  stats?: TaskStats;
  isLoading: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const isDone = (t: TaskRow) => t.status === 'completed';

function formatDuration(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return `${Math.round(ms / 60000)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

function formatTracked(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function AIInsightsView({ tasks, stats, isLoading }: AIInsightsViewProps) {
  const [isScheduling, setIsScheduling] = useState(false);
  const { toast } = useToast();

  const { data: suggestionData, isError: suggestionsFailed } = useQuery<SuggestionsResponse>({
    queryKey: ['/api/tasks/suggestions'],
    queryFn: async () => apiRequest('/api/tasks/suggestions'),
  });

  const metrics = useMemo(() => {
    const now = Date.now();
    const completed = tasks.filter(isDone);

    // Turnaround: created to completed. Both timestamps have to be present and
    // ordered, so a row missing either is excluded rather than counted as zero.
    const turnarounds = completed
      .map((t) => {
        if (!t.createdAt || !t.completedAt) return null;
        const span = new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
        return Number.isFinite(span) && span >= 0 ? span : null;
      })
      .filter((v): v is number => v !== null);

    // On-time is only defined for a task that had a due date to be late against.
    const withDueDate = completed.filter((t) => t.dueDate && t.completedAt);
    const onTime = withDueDate.filter(
      (t) => new Date(t.completedAt as string).getTime() <= new Date(t.dueDate as string).getTime(),
    );

    const completedSince = (since: number, until: number) =>
      completed.filter((t) => {
        if (!t.completedAt) return false;
        const at = new Date(t.completedAt).getTime();
        return at >= since && at < until;
      }).length;

    const thisWeek = completedSince(now - 7 * DAY, now + DAY);
    const priorWeek = completedSince(now - 14 * DAY, now - 7 * DAY);

    const trackedThisWeek = completed
      .filter((t) => t.completedAt && new Date(t.completedAt).getTime() >= now - 7 * DAY)
      .reduce((sum, t) => sum + (t.timeTracked ?? 0), 0);

    const total = stats?.total ?? tasks.length;

    return {
      completedCount: completed.length,
      avgTurnaround: turnarounds.length
        ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length
        : null,
      turnaroundSample: turnarounds.length,
      onTimeRate: withDueDate.length ? (onTime.length / withDueDate.length) * 100 : null,
      onTimeSample: withDueDate.length,
      thisWeek,
      priorWeek,
      velocity: priorWeek > 0 ? ((thisWeek - priorWeek) / priorWeek) * 100 : null,
      trackedThisWeek,
      perDay: thisWeek / 7,
      completionRate: total > 0 ? (completed.length / total) * 100 : null,
      overdue: stats?.overdue ?? null,
      dueToday: stats?.dueToday ?? null,
    };
  }, [tasks, stats]);

  const handleScheduling = async () => {
    setIsScheduling(true);
    try {
      // POST /api/tasks/schedule. The old code posted to /ai-schedule, which no
      // backend routes, and then swallowed every failure in an empty catch - so
      // the button always looked like it had worked. Whatever the API says now
      // reaches the user, including the 501 that explains what is missing.
      await apiRequest('/api/tasks/schedule', 'POST', {});
      toast({ title: 'Schedule optimization requested' });
    } catch (err) {
      toast({
        title: 'Schedule optimization unavailable',
        description: err instanceof Error ? err.message : 'The request failed.',
        variant: 'destructive',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const suggestions = suggestionData?.suggestions ?? [];

  const cards: Array<{ label: string; value: string; note: string; icon: typeof Clock }> = [
    {
      label: 'Avg. time to complete',
      value: metrics.avgTurnaround === null ? '—' : formatDuration(metrics.avgTurnaround),
      note:
        metrics.avgTurnaround === null
          ? 'No completed task carries both a created and a completed timestamp'
          : `Created to completed, across ${metrics.turnaroundSample} tasks`,
      icon: Clock,
    },
    {
      label: 'On-time rate',
      value: metrics.onTimeRate === null ? '—' : `${Math.round(metrics.onTimeRate)}%`,
      note:
        metrics.onTimeRate === null
          ? 'No completed task had a due date to measure against'
          : `Of ${metrics.onTimeSample} completed tasks that had a due date`,
      icon: Target,
    },
    {
      label: 'Completed this week',
      value: String(metrics.thisWeek),
      note:
        metrics.velocity === null
          ? 'No completions in the prior week to compare against'
          : `${metrics.velocity >= 0 ? '+' : ''}${Math.round(metrics.velocity)}% vs the week before`,
      icon: TrendingUp,
    },
    {
      label: 'Tracked this week',
      value: metrics.trackedThisWeek > 0 ? formatTracked(metrics.trackedThisWeek) : '—',
      note:
        metrics.trackedThisWeek > 0
          ? 'Sum of time logged against tasks completed in the last 7 days'
          : 'No time logged against tasks completed in the last 7 days',
      icon: BarChart3,
    },
  ];

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading task insights…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button onClick={handleScheduling} disabled={isScheduling}>
          <Zap className={`h-4 w-4 mr-2 ${isScheduling ? 'animate-pulse' : ''}`} />
          {isScheduling ? 'Requesting…' : 'Run schedule optimization'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{card.label}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.note}</p>
                </div>
                <card.icon className="h-8 w-8 shrink-0 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lightbulb className="mr-2 h-5 w-5" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {suggestionsFailed ? (
                // "No recommendations" and "we could not ask" are different
                // facts, and this panel used to render them identically.
                <p className="text-sm text-muted-foreground">
                  Could not load recommendations. This says nothing about whether there are any.
                </p>
              ) : suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {suggestionData?.message ??
                    'No recommendations available for this tenant right now.'}
                </p>
              ) : (
                suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="border rounded-lg p-4">
                    <h4 className="font-medium">{suggestion.title}</h4>
                    {suggestion.description ? (
                      <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Last 7 days
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium">{metrics.thisWeek}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg. per day</span>
                <span className="font-medium">{metrics.perDay.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Time tracked</span>
                <span className="font-medium">
                  {metrics.trackedThisWeek > 0 ? formatTracked(metrics.trackedThisWeek) : '—'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Across all tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium">
                    {metrics.completionRate === null
                      ? '—'
                      : `${Math.round(metrics.completionRate)}%`}
                  </span>
                </div>
                <Progress value={metrics.completionRate ?? 0} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">On-time delivery</span>
                  <span className="font-medium">
                    {metrics.onTimeRate === null ? '—' : `${Math.round(metrics.onTimeRate)}%`}
                  </span>
                </div>
                <Progress value={metrics.onTimeRate ?? 0} className="h-2" />
              </div>
              {metrics.overdue !== null || metrics.dueToday !== null ? (
                <div className="flex items-center gap-2 pt-1">
                  {metrics.overdue !== null ? (
                    <Badge variant={metrics.overdue > 0 ? 'destructive' : 'secondary'}>
                      {metrics.overdue} overdue
                    </Badge>
                  ) : null}
                  {metrics.dueToday !== null ? (
                    <Badge variant="secondary">{metrics.dueToday} due today</Badge>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Brain className="mr-2 h-5 w-5" />
                Not measured
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Focus time and context-switching cost were shown here as scores. Nothing in the task
                schema records either, so there is no honest number to put in their place.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
