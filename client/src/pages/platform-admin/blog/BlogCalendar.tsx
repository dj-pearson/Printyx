import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { config } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type PostStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';

interface Post {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  author_user_id: string | null;
  reviewer_user_id: string | null;
  cluster_id: string | null;
}

interface PostsResponse {
  posts: Post[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-muted-foreground/30',
  in_review:
    'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border-amber-300',
  scheduled: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200 border-blue-300',
  published:
    'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-300',
  archived:
    'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500 border-zinc-300 line-through',
};

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Returns the date for `n` days offset from the start (Mon) of the week containing `from`. */
function startOfMonthGrid(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  // JS getUTCDay: 0=Sun..6=Sat. Convert to ISO weekday (0=Mon..6=Sun).
  const isoDow = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - isoDow);
  return start;
}

function fmtDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtMonthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function effectiveDateKey(post: Post): string | null {
  const iso = post.scheduled_for ?? post.published_at ?? post.created_at;
  if (!iso) return null;
  return iso.slice(0, 10);
}

export default function BlogCalendar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all');
  const [authorFilter, setAuthorFilter] = useState('');
  const [clusterFilter, setClusterFilter] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // 6 weeks always so the grid height is stable even in months that wrap.
  const gridStart = useMemo(() => startOfMonthGrid(year, month), [year, month]);
  const gridEnd = useMemo(() => {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + 42); // 6 weeks
    return d;
  }, [gridStart]);
  const days = useMemo(() => {
    const arr: Date[] = [];
    const d = new Date(gridStart);
    for (let i = 0; i < 42; i++) {
      arr.push(new Date(d));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return arr;
  }, [gridStart]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams({
      from: fmtDateKey(gridStart),
      to: fmtDateKey(gridEnd),
      order_by: 'scheduled_for',
      limit: '500',
    });
    if (statusFilter !== 'all') sp.set('status', statusFilter);
    if (authorFilter.trim()) sp.set('author_user_id', authorFilter.trim());
    if (clusterFilter.trim()) sp.set('cluster_id', clusterFilter.trim());
    return sp.toString();
  }, [gridStart, gridEnd, statusFilter, authorFilter, clusterFilter]);

  const { data, isLoading } = useQuery<PostsResponse>({
    queryKey: ['/api/blog-posts', 'calendar', queryString],
    queryFn: () => apiRequest(`/api/blog-posts?${queryString}`),
  });

  const postsByDate = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of data?.posts ?? []) {
      const key = effectiveDateKey(p);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    // Sort each bucket: scheduled/published first, then by title.
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const sa = a.status === 'published' ? 0 : a.status === 'scheduled' ? 1 : 2;
        const sb = b.status === 'published' ? 0 : b.status === 'scheduled' ? 1 : 2;
        return sa - sb || a.title.localeCompare(b.title);
      });
    }
    return map;
  }, [data?.posts]);

  const rescheduleMutation = useMutation({
    mutationFn: (vars: { id: string; scheduled_for: string | null }) =>
      apiRequest(`/api/blog-posts/${vars.id}/reschedule`, 'POST', {
        scheduled_for: vars.scheduled_for,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog-posts'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Reschedule failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const onDrop = (dateIso: string) => {
    if (!draggingId) return;
    // Use UTC noon so the date lands the same in every timezone view.
    const ts = new Date(`${dateIso}T12:00:00Z`).toISOString();
    rescheduleMutation.mutate({ id: draggingId, scheduled_for: ts });
    setDraggingId(null);
    setHoverDate(null);
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };
  const goToday = () => {
    setYear(today.getUTCFullYear());
    setMonth(today.getUTCMonth());
  };

  const icsUrl = useMemo(() => {
    const sp = new URLSearchParams();
    if (statusFilter !== 'all') sp.set('status', statusFilter);
    if (authorFilter.trim()) sp.set('author_user_id', authorFilter.trim());
    if (clusterFilter.trim()) sp.set('cluster_id', clusterFilter.trim());
    // Production: functions.printyx.net; dev: relative path via Vite proxy.
    const base = config.apiBaseUrl
      ? `${config.apiBaseUrl.replace(/\/+$/, '')}/blog-posts/ics`
      : `/api/blog-posts/ics`;
    return sp.toString() ? `${base}?${sp.toString()}` : base;
  }, [statusFilter, authorFilter, clusterFilter]);

  const todayKey = fmtDateKey(new Date());

  return (
    <BlogShell title="Editorial calendar — Blog · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight inline-flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
              Editorial calendar
              <Badge variant="secondary" className="text-[10px]">
                US-BLOG-024
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Drag posts between days to reschedule. Filters and the .ics export both honor the
              current selection.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={icsUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5 mr-1" />
                Export .ics
              </a>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_review">In review</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Author user ID</Label>
                <Input
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  placeholder="paste user id"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Cluster ID</Label>
                <Input
                  value={clusterFilter}
                  onChange={(e) => setClusterFilter(e.target.value)}
                  placeholder="paste cluster id"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex items-end gap-1 justify-end">
                <Button size="sm" variant="ghost" onClick={prevMonth} className="h-8 w-8 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={goToday} className="h-8 text-xs">
                  Today
                </Button>
                <Button size="sm" variant="ghost" onClick={nextMonth} className="h-8 w-8 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{fmtMonthLabel(year, month)}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 border-t border-l">
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w}
                      className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/30 border-b border-r"
                    >
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 border-l">
                  {days.map((d) => {
                    const key = fmtDateKey(d);
                    const isOutsideMonth = d.getUTCMonth() !== month;
                    const isToday = key === todayKey;
                    const buckets = postsByDate.get(key) ?? [];
                    return (
                      <div
                        key={key}
                        onDragOver={(e) => {
                          if (!draggingId) return;
                          e.preventDefault();
                          setHoverDate(key);
                        }}
                        onDragLeave={() => {
                          if (hoverDate === key) setHoverDate(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          onDrop(key);
                        }}
                        className={cn(
                          'border-b border-r min-h-[110px] p-1 flex flex-col gap-1 transition-colors',
                          isOutsideMonth ? 'bg-muted/10 text-muted-foreground/60' : 'bg-background',
                          hoverDate === key && 'bg-primary/10',
                        )}
                      >
                        <div className="flex items-center justify-between text-[10px] px-0.5">
                          <span
                            className={cn(
                              'tabular-nums',
                              isToday &&
                                'inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full h-4 w-4 text-[9px] font-semibold',
                            )}
                          >
                            {d.getUTCDate()}
                          </span>
                          {buckets.length > 0 ? (
                            <span className="text-muted-foreground">{buckets.length}</span>
                          ) : null}
                        </div>
                        <div className="flex-1 space-y-0.5 overflow-hidden">
                          {buckets.slice(0, 4).map((p) => (
                            <Link
                              key={p.id}
                              to={`/platform-admin/blog/posts/${p.id}/edit`}
                              draggable
                              onDragStart={() => setDraggingId(p.id)}
                              onDragEnd={() => {
                                setDraggingId(null);
                                setHoverDate(null);
                              }}
                              className={cn(
                                'block truncate px-1.5 py-0.5 rounded text-[10px] border cursor-grab active:cursor-grabbing',
                                STATUS_COLORS[p.status],
                              )}
                              title={`${p.title} · ${STATUS_LABELS[p.status]}`}
                            >
                              {p.title}
                            </Link>
                          ))}
                          {buckets.length > 4 ? (
                            <div className="text-[10px] text-muted-foreground px-1">
                              +{buckets.length - 4} more
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span>Legend:</span>
          {(Object.keys(STATUS_COLORS) as PostStatus[]).map((s) => (
            <span key={s} className={cn('px-1.5 py-0.5 rounded border', STATUS_COLORS[s])}>
              {STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>
    </BlogShell>
  );
}
