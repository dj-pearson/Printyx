import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Archive,
  CheckCircle,
  Search,
  BarChart3,
  FileText,
  Folder,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Article {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  categoryId: string;
  contentType: string;
  difficultyLevel: string;
  viewCount: number;
  helpfulVotes: number;
  unhelpfulVotes: number;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  articleCount: number;
  isActive: boolean;
}

interface Analytics {
  articles: {
    totalArticles: number;
    publishedArticles: number;
    draftArticles: number;
    totalViews: number;
    averageRating: number;
  };
  categories: {
    totalCategories: number;
    activeCategories: number;
  };
  popularArticles: Array<{
    id: string;
    title: string;
    viewCount: number;
    averageRating: number;
  }>;
}

export default function KnowledgeBaseAdmin() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch articles
  const { data: articlesData, isLoading: articlesLoading } = useQuery<{
    articles: Article[];
    pagination: any;
  }>({
    queryKey: ['/api/knowledge-base/articles', 'admin', statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      params.append('limit', '50');

      const response = await fetch(`/api/knowledge-base/articles?${params}`);
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json();
    },
  });

  // Fetch categories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/knowledge-base/categories', 'admin'],
    queryFn: async () => {
      const response = await fetch('/api/knowledge-base/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
  });

  // Fetch analytics
  const { data: analytics } = useQuery<Analytics>({
    queryKey: ['/api/knowledge-base/analytics'],
    queryFn: async () => {
      const response = await fetch('/api/knowledge-base/analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
  });

  // Publish article mutation
  const publishMutation = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await fetch(`/api/knowledge-base/articles/${articleId}/publish`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to publish article');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/analytics'] });
      toast({
        title: 'Success',
        description: 'Article published successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to publish article',
        variant: 'destructive',
      });
    },
  });

  // Archive article mutation
  const archiveMutation = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await fetch(`/api/knowledge-base/articles/${articleId}/archive`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to archive article');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      toast({
        title: 'Success',
        description: 'Article archived successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to archive article',
        variant: 'destructive',
      });
    },
  });

  // Delete article mutation
  const deleteMutation = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await fetch(`/api/knowledge-base/articles/${articleId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete article');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/analytics'] });
      toast({
        title: 'Success',
        description: 'Article deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete article',
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
      review: { label: 'In Review', className: 'bg-yellow-100 text-yellow-800' },
      approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800' },
      published: { label: 'Published', className: 'bg-green-100 text-green-800' },
      archived: { label: 'Archived', className: 'bg-red-100 text-red-800' },
    };

    const variant = variants[status] || variants.draft;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Knowledge Base Admin</h1>
            <p className="text-muted-foreground mt-1">Manage articles, categories, and content</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/knowledge-base/categories">
              <Button variant="outline">
                <Folder className="h-4 w-4 mr-2" />
                Manage Categories
              </Button>
            </Link>
            <Link href="/admin/knowledge-base/article/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Article
              </Button>
            </Link>
          </div>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Articles</CardDescription>
                <CardTitle className="text-3xl">{analytics.articles.totalArticles}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {analytics.articles.publishedArticles} published
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Views</CardDescription>
                <CardTitle className="text-3xl">
                  {analytics.articles.totalViews?.toLocaleString() || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">Across all articles</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Average Rating</CardDescription>
                <CardTitle className="text-3xl">
                  {analytics.articles.averageRating?.toFixed(1) || 'N/A'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">Out of 5.0</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Categories</CardDescription>
                <CardTitle className="text-3xl">{analytics.categories.totalCategories}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {analytics.categories.activeCategories} active
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="articles" className="space-y-4">
          <TabsList>
            <TabsTrigger value="articles">
              <FileText className="h-4 w-4 mr-2" />
              Articles
            </TabsTrigger>
            <TabsTrigger value="popular">
              <BarChart3 className="h-4 w-4 mr-2" />
              Popular
            </TabsTrigger>
          </TabsList>

          <TabsContent value="articles" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search articles..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border rounded-md"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="review">In Review</option>
                    <option value="approved">Approved</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Articles Table */}
            <Card>
              <CardHeader>
                <CardTitle>Articles</CardTitle>
                <CardDescription>
                  {articlesData?.articles.length || 0} articles found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {articlesLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : articlesData?.articles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No articles found. Create your first article to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Helpful</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {articlesData?.articles.map((article) => (
                        <TableRow key={article.id}>
                          <TableCell className="font-medium">
                            <Link href={`/admin/knowledge-base/article/${article.id}`}>
                              <span className="hover:underline cursor-pointer">
                                {article.title}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>{getStatusBadge(article.status)}</TableCell>
                          <TableCell className="capitalize">
                            {article.contentType.replace('_', ' ')}
                          </TableCell>
                          <TableCell>{article.viewCount}</TableCell>
                          <TableCell>
                            <span className="text-green-600">{article.helpfulVotes}</span>
                            {' / '}
                            <span className="text-red-600">{article.unhelpfulVotes}</span>
                          </TableCell>
                          <TableCell>v{article.version}</TableCell>
                          <TableCell>{new Date(article.updatedAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/knowledge-base/article/${article.slug}`}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Public
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/knowledge-base/article/${article.id}`}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {article.status !== 'published' && (
                                  <DropdownMenuItem
                                    onClick={() => publishMutation.mutate(article.id)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Publish
                                  </DropdownMenuItem>
                                )}
                                {article.status === 'published' && (
                                  <DropdownMenuItem
                                    onClick={() => archiveMutation.mutate(article.id)}
                                  >
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this article?')) {
                                      deleteMutation.mutate(article.id);
                                    }
                                  }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="popular" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Popular Articles</CardTitle>
                <CardDescription>Top performing articles by view count</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.popularArticles && analytics.popularArticles.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.popularArticles.map((article, index) => (
                      <div
                        key={article.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold">{article.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {article.viewCount.toLocaleString()} views
                              {article.averageRating && (
                                <> • {article.averageRating.toFixed(1)} rating</>
                              )}
                            </p>
                          </div>
                        </div>
                        <Link href={`/admin/knowledge-base/article/${article.id}`}>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No analytics data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
