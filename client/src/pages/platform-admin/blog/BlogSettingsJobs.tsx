import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Play,
  PlayCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogSettingsNav } from '@/components/blog/BlogSettingsNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type JobStatus = 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';
type JobType = 'noop' | 'retention_cleanup';
type StatusFilter = 'all' | JobStatus;

interface Job {
  id: string;
  type: JobType;
  payload: Record<string, unknown> | null;
  status: JobStatus;
  priority: number;
  scheduled_at: string;
  attempts: number;
  max_attempts: number;
  last_error: { message?: string; stack?: string; attempt_at?: string } | null;
  result: Record<string, unknown> | null;
  idempotency_key: string | null;
  locked_until: string | null;
  locked_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StatsResponse {
  stats: Record<JobStatus, number>;
}

interface JobsResponse {
  jobs: Job[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}

const STATUS_COLORS: Record<JobStatus, string> = {
  queued: 'bg-muted text-muted-foreground',
  active: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  completed: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  failed: 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200',
  cancelled: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const STATUS_ICON: Record<JobStatus, typeof Clock> = {
  queued: Clock,
  active: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: AlertTriangle,
};

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  queued: 'Queued',
  active: 'Active',
  failed: 'Failed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function BlogSettingsJobs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ['/api/blog-jobs/stats'],
    queryFn: () => apiRequest('/api/blog-jobs/stats'),
    refetchInterval: 5000,
  });

  const { data: list, isLoading: listLoading } = useQuery<JobsResponse>({
    queryKey: ['/api/blog-jobs', filter],
    queryFn: () => {
      const sp = new URLSearchParams({ limit: '100' });
      if (filter !== 'all') sp.set('status', filter);
      return apiRequest(`/api/blog-jobs?${sp.toString()}`);
    },
    refetchInterval: 5000,
  });

  const runDueMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ claimed: number; ran: number }>('/api/blog-jobs/run-due', 'POST', { limit: 25 }),
    onSuccess: (res) => {
      toast({ title: `Ran ${res.ran} job(s)`, description: `Claimed ${res.claimed}` });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-jobs/stats'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Run failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/blog-jobs/${id}/retry`, 'POST'),
    onSuccess: () => {
      toast({ title: 'Job re-queued' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-jobs/stats'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Retry failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/blog-jobs/${id}/cancel`, 'POST'),
    onSuccess: () => {
      toast({ title: 'Job cancelled' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-jobs/stats'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Cancel failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const enqueueMutation = useMutation({
    mutationFn: (type: JobType) => apiRequest('/api/blog-jobs', 'POST', { type, priority: 50 }),
    onSuccess: (_, type) => {
      toast({ title: `Enqueued ${type}` });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-jobs/stats'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Enqueue failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const jobs = list?.jobs ?? [];

  return (
    <BlogShell title="Background jobs — Blog · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4 max-w-6xl">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Background jobs</h1>
          <p className="text-sm text-muted-foreground">
            Postgres-backed job queue. External cron pings{' '}
            <code className="text-xs">POST /blog-jobs/run-due</code> on a schedule; this page lets
            you observe + intervene.{' '}
            <Badge variant="secondary" className="text-[10px] align-middle">
              US-BLOG-012
            </Badge>
          </p>
        </div>

        <BlogSettingsNav />

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(['queued', 'active', 'failed', 'completed', 'cancelled'] as JobStatus[]).map((s) => {
            const Icon = STATUS_ICON[s];
            const count = stats?.stats?.[s] ?? 0;
            return (
              <Card key={s}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5',
                        s === 'active' ? 'animate-spin' : '',
                        s === 'failed' ? 'text-rose-600' : '',
                        s === 'completed' ? 'text-emerald-600' : '',
                      )}
                    />
                    {s}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-semibold tabular-nums">
                    {statsLoading ? '…' : count}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Recent jobs</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {FILTER_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select onValueChange={(v) => enqueueMutation.mutate(v as JobType)}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <PlayCircle className="h-3.5 w-3.5 mr-1" />
                    Enqueue test job
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="noop">noop (smoke test)</SelectItem>
                    <SelectItem value="retention_cleanup">retention_cleanup</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => runDueMutation.mutate()}
                  disabled={runDueMutation.isPending}
                >
                  {runDueMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Play className="h-3.5 w-3.5 mr-1" />
                  )}
                  Run due now
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {listLoading ? (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No jobs match this filter.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr className="text-left">
                    <th className="px-3 py-2 w-6"></th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Attempts</th>
                    <th className="px-3 py-2">Scheduled</th>
                    <th className="px-3 py-2">Error</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <JobRowView
                      key={job.id}
                      job={job}
                      expanded={expandedId === job.id}
                      onToggle={() => setExpandedId((id) => (id === job.id ? null : job.id))}
                      onRetry={() => retryMutation.mutate(job.id)}
                      onCancel={() => cancelMutation.mutate(job.id)}
                      retryPending={retryMutation.isPending}
                      cancelPending={cancelMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </BlogShell>
  );
}

function JobRowView({
  job,
  expanded,
  onToggle,
  onRetry,
  onCancel,
  retryPending,
  cancelPending,
}: {
  job: Job;
  expanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onCancel: () => void;
  retryPending: boolean;
  cancelPending: boolean;
}) {
  return (
    <>
      <tr className="border-t hover:bg-muted/20">
        <td className="px-3 py-2 align-top">
          <button
            type="button"
            onClick={onToggle}
            className="p-0.5 rounded hover:bg-muted"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </td>
        <td className="px-3 py-2 align-top font-mono">{job.type}</td>
        <td className="px-3 py-2 align-top">
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
              STATUS_COLORS[job.status],
            )}
          >
            {job.status}
          </span>
        </td>
        <td className="px-3 py-2 align-top text-right tabular-nums">
          {job.attempts}/{job.max_attempts}
        </td>
        <td className="px-3 py-2 align-top text-muted-foreground whitespace-nowrap">
          {new Date(job.scheduled_at).toLocaleString()}
        </td>
        <td className="px-3 py-2 align-top text-rose-700 dark:text-rose-300 max-w-md truncate">
          {job.last_error?.message ?? ''}
        </td>
        <td className="px-3 py-2 align-top text-right whitespace-nowrap">
          {(job.status === 'failed' || job.status === 'cancelled') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRetry}
              disabled={retryPending}
              className="h-6 text-[11px]"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          {job.status === 'queued' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={cancelPending}
              className="h-6 text-[11px] text-destructive"
            >
              <XCircle className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-muted/10">
          <td colSpan={7} className="px-3 py-2 align-top">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="text-muted-foreground font-medium mb-1">Payload</div>
                <pre className="rounded bg-muted/50 p-2 overflow-x-auto">
                  {JSON.stringify(job.payload ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-muted-foreground font-medium mb-1">Result</div>
                <pre className="rounded bg-muted/50 p-2 overflow-x-auto">
                  {JSON.stringify(job.result ?? {}, null, 2)}
                </pre>
              </div>
              {job.last_error?.stack ? (
                <div className="md:col-span-2">
                  <div className="text-muted-foreground font-medium mb-1">Stack</div>
                  <pre className="rounded bg-muted/50 p-2 overflow-x-auto text-rose-700 dark:text-rose-300">
                    {job.last_error.stack}
                  </pre>
                </div>
              ) : null}
              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-muted-foreground">
                <span>
                  ID: <code>{job.id.slice(0, 8)}</code>
                </span>
                <span>Priority: {job.priority}</span>
                {job.idempotency_key ? <span>Key: {job.idempotency_key}</span> : null}
                {job.locked_by ? <span>Locked by: {job.locked_by}</span> : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
