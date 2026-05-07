import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FileText, Loader2, Pencil, Plus, Search as SearchIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { BlogShell } from '@/components/blog/BlogShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type PostStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: PostStatus;
  published_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
  author_user_id: string | null;
}

interface PostsResponse {
  posts: Post[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  in_review: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200',
  scheduled: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  published: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  archived: 'bg-muted/50 text-muted-foreground',
};

export default function BlogPosts() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all');
  const [search, setSearch] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('limit', '100');
    return params.toString();
  }, [statusFilter]);

  const { data, isLoading, error } = useQuery<PostsResponse>({
    queryKey: ['/api/blog-posts', queryString],
    queryFn: () => apiRequest(`/api/blog-posts?${queryString}`),
  });

  const allPosts = data?.posts ?? [];
  const filteredPosts = useMemo(() => {
    if (!search.trim()) return allPosts;
    const q = search.trim().toLowerCase();
    return allPosts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.excerpt?.toLowerCase() ?? '').includes(q),
    );
  }, [allPosts, search]);

  return (
    <BlogShell title="Posts — Blog · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Posts</h1>
              <Badge variant="secondary" className="text-xs">
                US-BLOG-008
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Draft, edit, and manage every post in the blog. Foundation slice — full editor
              extensions (slash menu, AI rewrite toolbar, autosave, syntax-highlighted code, tables)
              land in a follow-up iteration.
            </p>
          </div>
          <Button onClick={() => navigate('/platform-admin/blog/posts/new')} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Button>
        </header>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, slug, or excerpt…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as 'all' | PostStatus)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading posts…
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-sm text-destructive">
              Failed to load: {error instanceof Error ? error.message : 'Unknown error'}
            </CardContent>
          </Card>
        ) : filteredPosts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {allPosts.length === 0 ? 'No posts yet' : 'No posts match your filters'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {allPosts.length === 0
                    ? 'Create your first post to start drafting.'
                    : 'Clear the search or change the status filter.'}
                </p>
              </div>
              {allPosts.length === 0 ? (
                <Button onClick={() => navigate('/platform-admin/blog/posts/new')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredPosts.map((post) => (
              <PostListItem key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </BlogShell>
  );
}

function PostListItem({ post }: { post: Post }) {
  return (
    <Link to={`/platform-admin/blog/posts/${post.id}/edit`}>
      <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <span className="truncate">{post.title}</span>
                <span
                  className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[post.status]}`}
                >
                  {STATUS_LABELS[post.status]}
                </span>
              </CardTitle>
              <CardDescription className="text-xs flex items-center gap-2 truncate">
                <code className="font-mono">/{post.slug}</code>
                <span>·</span>
                <span>
                  {post.status === 'published' && post.published_at
                    ? `published ${new Date(post.published_at).toLocaleDateString()}`
                    : post.status === 'scheduled' && post.scheduled_for
                      ? `scheduled for ${new Date(post.scheduled_for).toLocaleDateString()}`
                      : `updated ${new Date(post.updated_at).toLocaleDateString()}`}
                </span>
              </CardDescription>
              {post.excerpt ? (
                <p className="text-xs text-muted-foreground line-clamp-2 pt-1">{post.excerpt}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
