import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Filter, History, Loader2, RefreshCw, Server, User as UserIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogSettingsNav } from '@/components/blog/BlogSettingsNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Blog Audit Log Viewer (US-BLOG-011)
 *
 * Read-only viewer over the `blog_audit_log` rows written by every mutating
 * blog endpoint. Filterable by actor, actor type, action, target, and date
 * range. Click a row to inspect before/after state diff in a modal.
 *
 * Append-only enforcement is at the database level via RLS policies in
 * drizzle/rls/blog.sql — the table grants only INSERT and SELECT to the
 * authenticated role, no UPDATE / DELETE.
 */

type ActorType = 'user' | 'agent' | 'system';

interface AuditEntry {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_type: ActorType;
  agent_kind: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  before_state: unknown;
  after_state: unknown;
  summary: string | null;
  request_ip: string | null;
  user_agent: string | null;
  created_at: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

interface EntriesResponse {
  entries: AuditEntry[];
  pagination: PaginationInfo;
}

interface ActionsResponse {
  actions: string[];
}

const PAGE_SIZE = 50;

interface Filters {
  actor_type: 'all' | ActorType;
  action: string;
  target_type: string;
  since: string;
  until: string;
  actor_user_id: string;
}

const EMPTY_FILTERS: Filters = {
  actor_type: 'all',
  action: '',
  target_type: '',
  since: '',
  until: '',
  actor_user_id: '',
};

function buildQueryString(filters: Filters, offset: number): string {
  const params = new URLSearchParams();
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(offset));
  if (filters.actor_type !== 'all') params.set('actor_type', filters.actor_type);
  if (filters.action) params.set('action', filters.action);
  if (filters.target_type) params.set('target_type', filters.target_type);
  if (filters.since) params.set('since', new Date(filters.since).toISOString());
  if (filters.until) params.set('until', new Date(filters.until).toISOString());
  if (filters.actor_user_id) params.set('actor_user_id', filters.actor_user_id);
  return params.toString();
}

export default function BlogSettingsAuditLog() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const queryString = useMemo(() => buildQueryString(filters, offset), [filters, offset]);

  const { data, isLoading, isFetching, error, refetch } = useQuery<EntriesResponse>({
    queryKey: ['/api/blog-audit-log', queryString],
    queryFn: () => apiRequest(`/api/blog-audit-log?${queryString}`),
  });

  const { data: actionsData } = useQuery<ActionsResponse>({
    queryKey: ['/api/blog-audit-log/actions'],
    queryFn: () => apiRequest('/api/blog-audit-log/actions'),
  });

  const entries = data?.entries ?? [];
  const pagination = data?.pagination;
  const distinctActions = actionsData?.actions ?? [];

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setOffset(0);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setOffset(0);
  };

  const hasActiveFilters = useMemo(
    () => Object.entries(filters).some(([k, v]) => v !== EMPTY_FILTERS[k as keyof Filters]),
    [filters],
  );

  return (
    <BlogShell title="Audit Log — Blog Settings · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Blog Settings</h1>
            <Badge variant="secondary" className="text-xs">
              US-BLOG-011
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Forensic record of every mutating action across the blog module — content, agents,
            settings, kill switch. Append-only at the database level.
          </p>
        </header>

        <BlogSettingsNav />

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Audit Log
            </h2>
            <p className="text-sm text-muted-foreground">
              Showing {entries.length}
              {pagination ? ` of ${pagination.total.toLocaleString()}` : ''} entries
              {hasActiveFilters ? ' (filtered)' : ''}.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              Filters
              {hasActiveFilters ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs ml-auto"
                  onClick={clearFilters}
                >
                  Clear all
                </Button>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="filter-actor-type" className="text-xs">
                  Actor type
                </Label>
                <Select
                  value={filters.actor_type}
                  onValueChange={(v) => set('actor_type', v as Filters['actor_type'])}
                >
                  <SelectTrigger id="filter-actor-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any actor</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-action" className="text-xs">
                  Action
                </Label>
                <Select
                  value={filters.action || '__any'}
                  onValueChange={(v) => set('action', v === '__any' ? '' : v)}
                >
                  <SelectTrigger id="filter-action">
                    <SelectValue placeholder="Any action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any">Any action</SelectItem>
                    {distinctActions.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-target-type" className="text-xs">
                  Target type
                </Label>
                <Input
                  id="filter-target-type"
                  value={filters.target_type}
                  onChange={(e) => set('target_type', e.target.value)}
                  placeholder="e.g. blog_brand_voice"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-actor-user" className="text-xs">
                  Actor user ID
                </Label>
                <Input
                  id="filter-actor-user"
                  value={filters.actor_user_id}
                  onChange={(e) => set('actor_user_id', e.target.value)}
                  placeholder="UUID"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-since" className="text-xs">
                  From
                </Label>
                <Input
                  id="filter-since"
                  type="datetime-local"
                  value={filters.since}
                  onChange={(e) => set('since', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-until" className="text-xs">
                  To
                </Label>
                <Input
                  id="filter-until"
                  type="datetime-local"
                  value={filters.until}
                  onChange={(e) => set('until', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entries */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading audit log…
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-sm text-destructive">
              Failed to load: {error instanceof Error ? error.message : 'Unknown error'}
            </CardContent>
          </Card>
        ) : entries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-2">
              <History className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">No audit log entries</p>
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters
                  ? 'No entries match the current filters. Try clearing them.'
                  : 'Nothing has been logged yet — perform any mutating action to see entries appear.'}
              </p>
              {hasActiveFilters ? (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium py-2 px-3">When</th>
                    <th className="text-left font-medium py-2 px-3">Actor</th>
                    <th className="text-left font-medium py-2 px-3">Action</th>
                    <th className="text-left font-medium py-2 px-3 hidden md:table-cell">Target</th>
                    <th className="text-left font-medium py-2 px-3 hidden lg:table-cell">
                      Summary
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedEntry(entry)}
                      data-testid={`audit-row-${entry.id}`}
                    >
                      <td className="py-2 px-3 whitespace-nowrap text-xs">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <ActorBadge entry={entry} />
                      </td>
                      <td className="py-2 px-3 font-mono text-xs">{entry.action}</td>
                      <td className="py-2 px-3 hidden md:table-cell text-xs text-muted-foreground">
                        {entry.target_type ? (
                          <span>
                            <code className="bg-muted px-1 rounded">{entry.target_type}</code>{' '}
                            {entry.target_id ? (
                              <span className="font-mono">{entry.target_id.slice(0, 8)}…</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 hidden lg:table-cell text-xs line-clamp-1 max-w-md">
                        {entry.summary ?? <span className="italic text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {pagination && pagination.total > PAGE_SIZE ? (
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Page {Math.floor(offset / PAGE_SIZE) + 1} of {Math.ceil(pagination.total / PAGE_SIZE)}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
                disabled={offset === 0 || isFetching}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={!pagination.has_more || isFetching}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog
        open={selectedEntry !== null}
        onOpenChange={(open) => !open && setSelectedEntry(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedEntry ? <EntryDetail entry={selectedEntry} /> : null}
        </DialogContent>
      </Dialog>
    </BlogShell>
  );
}

function ActorBadge({ entry }: { entry: AuditEntry }) {
  if (entry.actor_type === 'user') {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <UserIcon className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono">
          {entry.actor_user_id ? `${entry.actor_user_id.slice(0, 8)}…` : 'unknown'}
        </span>
      </span>
    );
  }
  if (entry.actor_type === 'agent') {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <Bot className="h-3 w-3 text-amber-500" />
        <span>{entry.agent_kind ?? 'agent'}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Server className="h-3 w-3 text-muted-foreground" />
      <span>system</span>
    </span>
  );
}

function EntryDetail({ entry }: { entry: AuditEntry }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-mono text-base">{entry.action}</DialogTitle>
        <DialogDescription>
          {new Date(entry.created_at).toLocaleString()} · <ActorBadge entry={entry} />
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        {entry.summary ? (
          <div>
            <Label className="text-xs">Summary</Label>
            <p className="text-sm mt-1">{entry.summary}</p>
          </div>
        ) : null}

        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
          {entry.target_type ? (
            <>
              <dt className="text-muted-foreground">Target</dt>
              <dd>
                <code className="bg-muted px-1 rounded">{entry.target_type}</code>{' '}
                {entry.target_id ? <span className="font-mono">{entry.target_id}</span> : null}
              </dd>
            </>
          ) : null}
          {entry.actor_user_id ? (
            <>
              <dt className="text-muted-foreground">Actor user</dt>
              <dd className="font-mono">{entry.actor_user_id}</dd>
            </>
          ) : null}
          {entry.agent_kind ? (
            <>
              <dt className="text-muted-foreground">Agent kind</dt>
              <dd>{entry.agent_kind}</dd>
            </>
          ) : null}
          {entry.request_ip ? (
            <>
              <dt className="text-muted-foreground">IP</dt>
              <dd className="font-mono">{entry.request_ip}</dd>
            </>
          ) : null}
          {entry.user_agent ? (
            <>
              <dt className="text-muted-foreground">User agent</dt>
              <dd className="text-[11px] line-clamp-2">{entry.user_agent}</dd>
            </>
          ) : null}
        </dl>

        {entry.before_state || entry.after_state ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatePane label="Before" value={entry.before_state} />
            <StatePane label="After" value={entry.after_state} />
          </div>
        ) : null}
      </div>
    </>
  );
}

function StatePane({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap">
        {value === null || value === undefined ? '(none)' : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
