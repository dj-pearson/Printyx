import { useMemo, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { diffLines } from 'diff';
import { ChevronLeft, History as HistoryIcon, Loader2, RotateCcw, FileText } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type RevisionSource = 'manual' | 'ai_draft' | 'ai_rewrite' | 'auto_refresh_agent';

interface RevisionSummary {
  id: string;
  post_id: string;
  tenant_id: string;
  revision_number: number;
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  revision_source: RevisionSource;
  diff_summary: string | null;
  changed_by_user_id: string | null;
  agent_run_id: string | null;
  created_at: string;
}

interface RevisionDetail extends RevisionSummary {
  body_markdown: string | null;
  body_html: string | null;
}

interface RevisionsListResponse {
  revisions: RevisionDetail[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}

interface RevisionResponse {
  revision: RevisionDetail;
}

interface PostResponse {
  post: {
    id: string;
    title: string;
    body_markdown: string | null;
    meta_title: string | null;
    meta_description: string | null;
    updated_at: string;
  };
}

const SOURCE_LABELS: Record<RevisionSource, string> = {
  manual: 'Manual',
  ai_draft: 'AI Draft',
  ai_rewrite: 'AI Rewrite',
  auto_refresh_agent: 'Auto-refresh',
};

const SOURCE_COLORS: Record<RevisionSource, string> = {
  manual: 'bg-muted text-muted-foreground',
  ai_draft: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  ai_rewrite: 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
  auto_refresh_agent: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
};

export default function BlogPostHistory() {
  const [match, params] = useRoute('/platform-admin/blog/posts/:id/history');
  const postId = match ? params?.id : undefined;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<'current' | string>('current');
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const { data: postData } = useQuery<PostResponse>({
    queryKey: [`/api/blog-posts/${postId}`],
    queryFn: () => apiRequest(`/api/blog-posts/${postId}`),
    enabled: !!postId,
  });

  const { data: listData, isLoading: listLoading } = useQuery<RevisionsListResponse>({
    queryKey: ['/api/blog-post-revisions', postId],
    queryFn: () => apiRequest(`/api/blog-post-revisions?post_id=${postId}&limit=200`),
    enabled: !!postId,
  });

  const revisions = listData?.revisions ?? [];

  // Default selection: most recent revision once data loads
  if (!selectedRevId && revisions.length > 0) {
    // ok to set during render — useState bails if same value
    setSelectedRevId(revisions[0].id);
  }

  const { data: leftRev } = useQuery<RevisionResponse>({
    queryKey: ['/api/blog-post-revisions/single', selectedRevId],
    queryFn: () => apiRequest(`/api/blog-post-revisions/${selectedRevId}`),
    enabled: !!selectedRevId,
  });

  const { data: compareRev } = useQuery<RevisionResponse>({
    queryKey: ['/api/blog-post-revisions/single', compareMode],
    queryFn: () => apiRequest(`/api/blog-post-revisions/${compareMode}`),
    enabled: compareMode !== 'current' && !!compareMode,
  });

  const restoreMutation = useMutation({
    mutationFn: (revisionId: string) =>
      apiRequest(`/api/blog-post-revisions/${revisionId}/restore`, 'POST'),
    onSuccess: () => {
      toast({ title: 'Revision restored', description: 'A new revision was stamped.' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-post-revisions', postId] });
      queryClient.invalidateQueries({ queryKey: [`/api/blog-posts/${postId}`] });
      setConfirmRestoreId(null);
    },
    onError: (err: unknown) => {
      toast({
        title: 'Restore failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const left = leftRev?.revision;
  const right =
    compareMode === 'current'
      ? postData?.post
        ? {
            title: postData.post.title,
            body_markdown: postData.post.body_markdown,
            meta_title: postData.post.meta_title,
            meta_description: postData.post.meta_description,
            label: 'Current post',
          }
        : null
      : compareRev?.revision
        ? {
            title: compareRev.revision.title,
            body_markdown: compareRev.revision.body_markdown,
            meta_title: compareRev.revision.meta_title,
            meta_description: compareRev.revision.meta_description,
            label: `Revision #${compareRev.revision.revision_number}`,
          }
        : null;

  const bodyDiff = useMemo(() => {
    if (!left || !right) return null;
    return diffLines(left.body_markdown ?? '', right.body_markdown ?? '');
  }, [left, right]);

  const titleChanged = !!left && !!right && left.title !== right.title;
  const metaTitleChanged =
    !!left && !!right && (left.meta_title ?? '') !== (right.meta_title ?? '');
  const metaDescChanged =
    !!left && !!right && (left.meta_description ?? '') !== (right.meta_description ?? '');

  return (
    <BlogShell title="Version history — Blog · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4 max-w-7xl">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link
              to={
                postId ? `/platform-admin/blog/posts/${postId}/edit` : '/platform-admin/blog/posts'
              }
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to editor
            </Link>
          </Button>
        </div>

        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <HistoryIcon className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Version history</h1>
            <Badge variant="secondary" className="text-xs">
              US-BLOG-009
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {postData?.post?.title ?? 'Loading post…'}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <Card className="h-fit max-h-[calc(100vh-220px)] overflow-y-auto">
            <CardHeader className="pb-3 sticky top-0 bg-card z-10 border-b">
              <CardTitle className="text-sm">
                Revisions
                {listData?.pagination?.total != null ? ` · ${listData.pagination.total}` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {listLoading ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading…
                </div>
              ) : revisions.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  <FileText className="h-6 w-6 mx-auto mb-2 opacity-60" />
                  No revisions yet. Edit the post and an autosave will land here within 10 seconds.
                </div>
              ) : (
                <ul className="divide-y">
                  {revisions.map((rev) => (
                    <li key={rev.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRevId(rev.id)}
                        className={cn(
                          'w-full text-left p-3 hover:bg-muted/50 transition-colors text-xs space-y-1',
                          selectedRevId === rev.id && 'bg-muted/70',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold">#{rev.revision_number}</span>
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
                              SOURCE_COLORS[rev.revision_source],
                            )}
                          >
                            {SOURCE_LABELS[rev.revision_source]}
                          </span>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {rev.title ?? '(no title)'}
                        </div>
                        <div className="text-muted-foreground/80">
                          {new Date(rev.created_at).toLocaleString()}
                        </div>
                        {rev.diff_summary ? (
                          <div className="text-muted-foreground/80 italic line-clamp-1">
                            {rev.diff_summary}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4 min-w-0">
            {!left ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground text-center">
                  Select a revision on the left to view it.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-base">
                          Revision #{left.revision_number}
                          <Badge
                            className={cn('ml-2 text-[10px]', SOURCE_COLORS[left.revision_source])}
                            variant="outline"
                          >
                            {SOURCE_LABELS[left.revision_source]}
                          </Badge>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {new Date(left.created_at).toLocaleString()}
                          {left.diff_summary ? ` · ${left.diff_summary}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Compare to:</span>
                        <Select value={compareMode} onValueChange={(v) => setCompareMode(v)}>
                          <SelectTrigger className="h-8 w-44 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="current">Current post</SelectItem>
                            {revisions
                              .filter((r) => r.id !== left.id)
                              .map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  #{r.revision_number} · {SOURCE_LABELS[r.revision_source]}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmRestoreId(left.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {(titleChanged || metaTitleChanged || metaDescChanged) && right ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Field changes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      {titleChanged ? (
                        <FieldDiff
                          label="Title"
                          oldValue={left.title ?? ''}
                          newValue={right.title ?? ''}
                        />
                      ) : null}
                      {metaTitleChanged ? (
                        <FieldDiff
                          label="Meta title"
                          oldValue={left.meta_title ?? ''}
                          newValue={right.meta_title ?? ''}
                        />
                      ) : null}
                      {metaDescChanged ? (
                        <FieldDiff
                          label="Meta description"
                          oldValue={left.meta_description ?? ''}
                          newValue={right.meta_description ?? ''}
                        />
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-sm">Body diff</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Left: revision · Right: {right?.label ?? '—'}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {!right ? (
                      <div className="p-6 text-sm text-muted-foreground text-center">
                        Loading comparison…
                      </div>
                    ) : (
                      <BodyDiff parts={bodyDiff} />
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!confirmRestoreId}
        onOpenChange={(open) => !open && setConfirmRestoreId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this revision?</AlertDialogTitle>
            <AlertDialogDescription>
              The current post body, title, and meta will be replaced with this revision's content.
              A new revision is stamped automatically — nothing is lost. The post status (draft,
              published, etc.) is unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRestoreId && restoreMutation.mutate(confirmRestoreId)}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BlogShell>
  );
}

function FieldDiff({
  label,
  oldValue,
  newValue,
}: {
  label: string;
  oldValue: string;
  newValue: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground font-medium">{label}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 rounded p-2 font-mono whitespace-pre-wrap break-words">
          {oldValue || <span className="text-muted-foreground">(empty)</span>}
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 rounded p-2 font-mono whitespace-pre-wrap break-words">
          {newValue || <span className="text-muted-foreground">(empty)</span>}
        </div>
      </div>
    </div>
  );
}

function BodyDiff({ parts }: { parts: ReturnType<typeof diffLines> | null }) {
  if (!parts) {
    return <div className="p-6 text-sm text-muted-foreground text-center">No diff data.</div>;
  }
  if (parts.length === 0 || (parts.length === 1 && !parts[0].added && !parts[0].removed)) {
    return (
      <div className="p-6 text-sm text-muted-foreground text-center">Bodies are identical.</div>
    );
  }
  return (
    <pre className="text-xs font-mono leading-5 overflow-x-auto p-4 max-h-[600px] overflow-y-auto">
      {parts.map((part, idx) => {
        const cls = part.added
          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
          : part.removed
            ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
            : 'text-muted-foreground/80';
        const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
        const lines = part.value.split('\n');
        // Last element will often be '' from trailing newline; drop it for display.
        if (lines[lines.length - 1] === '') lines.pop();
        return (
          <div key={idx} className={cn('block whitespace-pre-wrap break-words', cls)}>
            {lines.map((line, i) => (
              <div key={i}>
                {prefix}
                {line || ' '}
              </div>
            ))}
          </div>
        );
      })}
    </pre>
  );
}
