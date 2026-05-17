import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Cloud,
  CloudOff,
  History as HistoryIcon,
  Loader2,
  Save,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { BlogEditor } from '@/components/blog/BlogEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { computeSeoScore, type CheckStatus } from '@/lib/blog/seo-score';
import { cn } from '@/lib/utils';
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

type PostStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_markdown: string | null;
  body_html: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  status: PostStatus;
  published_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

interface PostResponse {
  post: Post;
}

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  body_markdown: string;
  body_html: string;
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  status: PostStatus;
}

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  excerpt: '',
  body_markdown: '',
  body_html: '',
  meta_title: '',
  meta_description: '',
  canonical_url: '',
  status: 'draft',
};

const STATUS_OPTIONS: { value: PostStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

function postToForm(post: Post): FormState {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? '',
    body_markdown: post.body_markdown ?? '',
    body_html: post.body_html ?? '',
    meta_title: post.meta_title ?? '',
    meta_description: post.meta_description ?? '',
    canonical_url: post.canonical_url ?? '',
    status: post.status,
  };
}

function computeAutosaveSig(form: FormState): string {
  // Cheap signature of the fields we'd send to the revisions endpoint.
  // Used only to skip scheduling an autosave when nothing changed.
  return [
    form.title,
    form.body_markdown,
    form.body_html,
    form.meta_title,
    form.meta_description,
  ].join('');
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

function SeoCheckIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass')
    return <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />;
  if (status === 'warn')
    return <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />;
  if (status === 'fail')
    return <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />;
  return <MinusCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />;
}

export default function BlogPostEditor() {
  const [, navigate] = useLocation();
  const [editMatch, editParams] = useRoute('/platform-admin/blog/posts/:id/edit');
  const [, newRouteMatch] = useRoute('/platform-admin/blog/posts/new');
  const isEditing = editMatch && editParams?.id;
  const postId = isEditing ? editParams.id : null;
  const isNew = !isEditing;
  void newRouteMatch;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showDelete, setShowDelete] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle');
  const seoKwStorageKey = `blog:seo-target-kw:${postId ?? 'new'}`;
  const [targetKeyword, setTargetKeyword] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(seoKwStorageKey) ?? '';
  });
  const [allowLowScorePublish, setAllowLowScorePublish] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (targetKeyword) window.localStorage.setItem(seoKwStorageKey, targetKeyword);
    else window.localStorage.removeItem(seoKwStorageKey);
  }, [targetKeyword, seoKwStorageKey]);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutosavedSigRef = useRef<string | null>(null);
  const formRef = useRef<FormState>(EMPTY_FORM);
  formRef.current = form;

  const { data: postData, isLoading } = useQuery<PostResponse>({
    queryKey: [`/api/blog-posts/${postId}`],
    queryFn: () => apiRequest(`/api/blog-posts/${postId}`),
    enabled: !!postId,
  });

  // Hydrate form once on load
  useEffect(() => {
    if (postData?.post && isEditing) {
      const hydrated = postToForm(postData.post);
      setForm(hydrated);
      setSlugManuallyEdited(true); // existing posts have a slug; don't auto-update
      // Seed the autosave dedup signature so hydration alone doesn't trigger an autosave.
      lastAutosavedSigRef.current = computeAutosaveSig(hydrated);
    }
  }, [postData?.post, isEditing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const seo = useMemo(
    () =>
      computeSeoScore({
        title: form.title,
        slug: form.slug,
        bodyMarkdown: form.body_markdown,
        bodyHtml: form.body_html,
        metaTitle: form.meta_title,
        metaDescription: form.meta_description,
        canonicalUrl: form.canonical_url,
        targetKeyword,
      }),
    [
      form.title,
      form.slug,
      form.body_markdown,
      form.body_html,
      form.meta_title,
      form.meta_description,
      form.canonical_url,
      targetKeyword,
    ],
  );

  // Auto-slug from title when creating and slug hasn't been touched
  useEffect(() => {
    if (isNew && !slugManuallyEdited && form.title) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.title) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, isNew, slugManuallyEdited]);

  // Autosave to blog-post-revisions after 10s of inactivity (US-BLOG-009).
  // Only runs when editing an existing post and something has changed since
  // the last successful autosave/hydration. Server-side dedup is the ultimate
  // guard, but this avoids a network round-trip when nothing changed.
  useEffect(() => {
    if (!isEditing || !postId) return;
    const sig = computeAutosaveSig(form);
    if (lastAutosavedSigRef.current === sig) return;
    setAutosaveStatus('pending');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      const snapshot = formRef.current;
      const snapshotSig = computeAutosaveSig(snapshot);
      if (lastAutosavedSigRef.current === snapshotSig) {
        setAutosaveStatus('saved');
        return;
      }
      setAutosaveStatus('saving');
      try {
        const res = await apiRequest<{ deduped?: boolean }>('/api/blog-post-revisions', 'POST', {
          post_id: postId,
          revision_source: 'manual',
          title: snapshot.title,
          body_markdown: snapshot.body_markdown || null,
          body_html: snapshot.body_html || null,
          meta_title: snapshot.meta_title || null,
          meta_description: snapshot.meta_description || null,
        });
        lastAutosavedSigRef.current = snapshotSig;
        setAutosaveStatus('saved');
        if (!res?.deduped) {
          queryClient.invalidateQueries({
            queryKey: [`/api/blog-post-revisions`, postId],
          });
        }
      } catch (err) {
        console.error('Autosave failed', err);
        setAutosaveStatus('error');
      }
    }, 10_000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditing,
    postId,
    form.title,
    form.body_markdown,
    form.body_html,
    form.meta_title,
    form.meta_description,
  ]);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest<PostResponse>('/api/blog-posts', 'POST', payload),
    onSuccess: (res) => {
      toast({ title: 'Post created' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-posts'] });
      navigate(`/platform-admin/blog/posts/${res.post.id}/edit`);
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to create',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest<PostResponse>(`/api/blog-posts/${postId}`, 'PATCH', payload),
    onSuccess: () => {
      toast({ title: 'Post saved' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-posts'] });
      queryClient.invalidateQueries({ queryKey: [`/api/blog-posts/${postId}`] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/blog-posts/${postId}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Post deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-posts'] });
      navigate('/platform-admin/blog/posts');
    },
    onError: (err: unknown) => {
      toast({
        title: 'Failed to delete',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSave() {
    if (!form.title.trim()) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    if (form.status === 'published' && seo.score < 70 && !allowLowScorePublish) {
      toast({
        title: `SEO score ${seo.score}/100 — below the 70 publish threshold`,
        description:
          'Fix the failing on-page checks, or tick "Publish anyway" in the SEO panel to override.',
        variant: 'destructive',
      });
      return;
    }
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      excerpt: form.excerpt.trim() || null,
      body_markdown: form.body_markdown || null,
      body_html: form.body_html || null,
      meta_title: form.meta_title.trim() || null,
      meta_description: form.meta_description.trim() || null,
      canonical_url: form.canonical_url.trim() || null,
      status: form.status,
    };
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const headerSubtitle = useMemo(() => {
    if (isNew) return 'New draft — saves once you click Save';
    if (postData?.post) {
      return `${postData.post.status === 'published' && postData.post.published_at ? `Published ${new Date(postData.post.published_at).toLocaleDateString()}` : `Last updated ${new Date(postData.post.updated_at).toLocaleString()}`}`;
    }
    return '';
  }, [isNew, postData?.post]);

  if (isEditing && isLoading) {
    return (
      <BlogShell title="Editing post — Blog · Printyx">
        <div className="container mx-auto p-6 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading post…
        </div>
      </BlogShell>
    );
  }

  return (
    <BlogShell
      title={isNew ? 'New post — Blog · Printyx' : `${form.title || 'Untitled'} — Blog · Printyx`}
    >
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4 max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/platform-admin/blog/posts">
              <ChevronLeft className="h-4 w-4 mr-1" />
              All Posts
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {isEditing ? <AutosaveIndicator status={autosaveStatus} /> : null}
            {isEditing && postId ? (
              <Button asChild variant="ghost" size="sm">
                <Link to={`/platform-admin/blog/posts/${postId}/history`}>
                  <HistoryIcon className="h-4 w-4 mr-1" />
                  History
                </Link>
              </Button>
            ) : null}
            {isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDelete(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            ) : null}
            <Button onClick={handleSave} disabled={isPending} size="sm">
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isNew ? 'Create draft' : 'Save'}
            </Button>
          </div>
        </div>

        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {isNew ? 'New post' : 'Edit post'}
            </h1>
            <Badge variant="secondary" className="text-xs">
              US-BLOG-008
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Main editor column */}
          <div className="space-y-4 min-w-0">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="post-title">Title *</Label>
                  <Input
                    id="post-title"
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="Untitled"
                    maxLength={500}
                    className="text-lg font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-excerpt">Excerpt</Label>
                  <Textarea
                    id="post-excerpt"
                    value={form.excerpt}
                    onChange={(e) => set('excerpt', e.target.value)}
                    placeholder="Short summary shown in feeds and social previews."
                    rows={2}
                    maxLength={2000}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <BlogEditor
                  value={form.body_markdown}
                  onChange={({ markdown, html }) => {
                    setForm((prev) => ({ ...prev, body_markdown: markdown, body_html: html }));
                  }}
                  bare
                  minHeight={480}
                  placeholder="Start writing your post… Paste Markdown to convert it to rich nodes."
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Status</CardTitle>
                <CardDescription className="text-xs">
                  Workflow: draft → in_review → scheduled → published.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={form.status} onValueChange={(v) => set('status', v as PostStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">URL</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="post-slug" className="text-xs">
                    Slug
                  </Label>
                  <Input
                    id="post-slug"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugManuallyEdited(true);
                      set('slug', e.target.value);
                    }}
                    placeholder="auto-generated-from-title"
                    pattern="[a-z0-9-]+"
                  />
                  <p className="text-[11px] text-muted-foreground font-mono">/{form.slug || '…'}</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="post-canonical" className="text-xs">
                    Canonical URL (optional)
                  </Label>
                  <Input
                    id="post-canonical"
                    type="url"
                    value={form.canonical_url}
                    onChange={(e) => set('canonical_url', e.target.value)}
                    placeholder="https://example.com/canonical-post"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">SEO</CardTitle>
                <CardDescription className="text-xs">
                  Defaults to title + excerpt if blank.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="post-meta-title" className="text-xs">
                    Meta title
                  </Label>
                  <Input
                    id="post-meta-title"
                    value={form.meta_title}
                    onChange={(e) => set('meta_title', e.target.value)}
                    placeholder="Defaults to post title"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="post-meta-desc" className="text-xs">
                    Meta description
                  </Label>
                  <Textarea
                    id="post-meta-desc"
                    value={form.meta_description}
                    onChange={(e) => set('meta_description', e.target.value)}
                    placeholder="155-160 chars, search snippet"
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {form.meta_description.length} / 500
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">SEO score</CardTitle>
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      seo.score >= 70
                        ? 'text-emerald-600'
                        : seo.score >= 50
                          ? 'text-amber-600'
                          : 'text-destructive',
                    )}
                  >
                    {seo.score}/100
                  </span>
                </div>
                <CardDescription className="text-xs">
                  US-BLOG-033 · {seo.passCount} pass · {seo.warnCount} warn · {seo.failCount} fail
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="seo-target-kw" className="text-xs">
                    Target keyword
                  </Label>
                  <Input
                    id="seo-target-kw"
                    value={targetKeyword}
                    onChange={(e) => setTargetKeyword(e.target.value)}
                    placeholder="e.g. managed print services"
                  />
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      seo.score >= 70
                        ? 'bg-emerald-500'
                        : seo.score >= 50
                          ? 'bg-amber-500'
                          : 'bg-destructive',
                    )}
                    style={{ width: `${seo.score}%` }}
                  />
                </div>
                <ul className="space-y-1.5">
                  {seo.checks.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start gap-2 text-xs"
                      title={`${c.detail}\n\nWhy: ${c.why}`}
                    >
                      <SeoCheckIcon status={c.status} />
                      <span
                        className={cn(
                          'leading-tight',
                          c.status === 'na' && 'text-muted-foreground',
                        )}
                      >
                        {c.label}
                      </span>
                    </li>
                  ))}
                </ul>
                {seo.score < 70 ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Checkbox
                      checked={allowLowScorePublish}
                      onCheckedChange={(v) => setAllowLowScorePublish(v === true)}
                    />
                    Publish anyway (override the {seo.score}/100 gate)
                  </label>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* AlertDialog below */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{form.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Soft delete — the row stays in the audit log. Published posts are NOT automatically
              unpublished from the CMS; remove from the CMS separately if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BlogShell>
  );
}

function AutosaveIndicator({
  status,
}: {
  status: 'idle' | 'pending' | 'saving' | 'saved' | 'error';
}) {
  if (status === 'idle') return null;
  if (status === 'pending') {
    return (
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <Cloud className="h-3 w-3" />
        Unsaved changes
      </span>
    );
  }
  if (status === 'saving') {
    return (
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Autosaving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
        <Cloud className="h-3 w-3" />
        Autosaved
      </span>
    );
  }
  return (
    <span className="text-xs text-destructive inline-flex items-center gap-1">
      <CloudOff className="h-3 w-3" />
      Autosave failed
    </span>
  );
}
