import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Loader2, Sparkles, FileText, Trash2, PenLine } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type BriefStatus = 'draft' | 'ready' | 'in_progress' | 'complete' | 'archived';

// PRD vocabulary draft|approved|in-writing|done maps onto the schema enum.
const STATUS_META: Record<BriefStatus, { label: string; chip: string }> = {
  draft: { label: 'Draft', chip: 'bg-slate-100 text-slate-700 border-slate-200' },
  ready: { label: 'Approved', chip: 'bg-sky-100 text-sky-800 border-sky-200' },
  in_progress: { label: 'In writing', chip: 'bg-amber-100 text-amber-800 border-amber-200' },
  complete: { label: 'Done', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  archived: { label: 'Archived', chip: 'bg-slate-100 text-slate-400 border-slate-200' },
};

interface Brief {
  id: string;
  title: string;
  status: BriefStatus;
  target_audience: string | null;
  search_intent: string | null;
  recommended_word_count: number | null;
  outline: { markdown?: string } | null;
  updated_at: string;
}

interface ListResponse {
  briefs: Brief[];
  total: number;
}

function StatusChip({ status }: { status: BriefStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        m.chip,
      )}
    >
      {m.label}
    </span>
  );
}

export default function BlogBriefs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [genOpen, setGenOpen] = useState(false);
  const [genKeyword, setGenKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftMarkdown, setDraftMarkdown] = useState('');

  const params = new URLSearchParams();
  if (statusFilter !== 'all') params.set('status', statusFilter);
  params.set('limit', '100');

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ['/api/blog-briefs', statusFilter],
    queryFn: () => apiRequest(`/api/blog-briefs?${params.toString()}`),
  });

  const briefs = data?.briefs ?? [];
  const selected = briefs.find((b) => b.id === selectedId) ?? null;

  const generate = useMutation({
    mutationFn: () =>
      apiRequest('/api/blog-briefs/generate', 'POST', { keyword: genKeyword.trim() }),
    onSuccess: (resp: { brief: Brief }) => {
      toast({ title: 'Brief generated' });
      setGenOpen(false);
      setGenKeyword('');
      queryClient.invalidateQueries({ queryKey: ['/api/blog-briefs'] });
      setSelectedId(resp.brief.id);
      setDraftMarkdown(resp.brief.outline?.markdown ?? '');
    },
    onError: (err: Error) =>
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' }),
  });

  const patch = useMutation({
    mutationFn: (body: { markdown?: string; status?: BriefStatus }) =>
      apiRequest(`/api/blog-briefs/${selectedId}`, 'PATCH', body),
    onSuccess: () => {
      toast({ title: 'Brief saved' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-briefs'] });
    },
    onError: (err: Error) =>
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/blog-briefs/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Brief deleted' });
      if (selectedId) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/blog-briefs'] });
    },
    onError: (err: Error) =>
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const startWriting = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/blog-briefs/${id}/start-writing`, 'POST'),
    onSuccess: (resp: { post_id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog-briefs'] });
      navigate(`/platform-admin/blog/posts/${resp.post_id}/edit`);
    },
    onError: (err: Error) =>
      toast({
        title: 'Could not start writing',
        description: err.message,
        variant: 'destructive',
      }),
  });

  function openBrief(b: Brief) {
    setSelectedId(b.id);
    setDraftMarkdown(b.outline?.markdown ?? '');
  }

  return (
    <BlogShell title="Briefs — Blog · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4 max-w-7xl">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Content briefs</h1>
            <p className="text-sm text-muted-foreground">
              Auto-generated, editable briefs from keyword + SERP.{' '}
              <Badge variant="secondary" className="text-[10px] align-middle">
                US-BLOG-023
              </Badge>
            </p>
          </div>
          <Button onClick={() => setGenOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate brief
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ready">Approved</SelectItem>
              <SelectItem value="in_progress">In writing</SelectItem>
              <SelectItem value="complete">Done</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center p-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                </div>
              ) : briefs.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No briefs yet. Generate one from a target keyword.
                </div>
              ) : (
                <ul className="divide-y">
                  {briefs.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => openBrief(b)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 hover:bg-muted/40',
                          selectedId === b.id && 'bg-muted/60',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{b.title}</span>
                          <StatusChip status={b.status} />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {b.recommended_word_count ? `${b.recommended_word_count} words · ` : ''}
                          {b.search_intent ?? 'unknown intent'}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            {selected ? (
              <>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{selected.title}</CardTitle>
                      <div className="mt-1">
                        <StatusChip status={selected.status} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selected.status === 'draft' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={patch.isPending}
                          onClick={() => patch.mutate({ status: 'ready' })}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {selected.status !== 'complete' && selected.status !== 'archived' ? (
                        <Button
                          size="sm"
                          disabled={startWriting.isPending}
                          onClick={() => startWriting.mutate(selected.id)}
                        >
                          {startWriting.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <PenLine className="h-4 w-4 mr-2" />
                          )}
                          Start writing
                        </Button>
                      ) : null}
                      {selected.status === 'in_progress' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={patch.isPending}
                          onClick={() => patch.mutate({ status: 'complete' })}
                        >
                          Mark done
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(selected.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={draftMarkdown}
                    onChange={(e) => setDraftMarkdown(e.target.value)}
                    rows={24}
                    className="font-mono text-xs"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={
                        patch.isPending || draftMarkdown === (selected.outline?.markdown ?? '')
                      }
                      onClick={() => patch.mutate({ markdown: draftMarkdown })}
                    >
                      {patch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Save brief
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex flex-col items-center justify-center p-16 text-center text-sm text-muted-foreground">
                <FileText className="h-8 w-8 mb-3 opacity-40" />
                Select a brief to view and edit it.
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate a content brief</DialogTitle>
            <DialogDescription>
              The brief is grounded in the latest cached SERP snapshot for the keyword (run SERP
              first for the sharpest outline). The originality angle is LLM-forced.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              value={genKeyword}
              onChange={(e) => setGenKeyword(e.target.value)}
              placeholder="Target keyword, e.g. managed print services"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && genKeyword.trim()) generate.mutate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGenOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!genKeyword.trim() || generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BlogShell>
  );
}
