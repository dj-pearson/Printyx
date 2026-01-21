/**
 * Knowledge Base Admin Dashboard
 * Comprehensive admin interface for managing knowledge base content
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Eye,
  ThumbsUp,
  MessageSquare,
  TrendingUp,
  Clock,
  MoreVertical,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bot,
  Users,
  BarChart3,
  Settings,
  Trash2,
  Edit,
  Copy,
} from 'lucide-react';

interface DashboardStats {
  articles: {
    total: number;
    published: number;
    draft: number;
    review: number;
    aiGenerated: number;
  };
  views: {
    total: number;
    recent: number;
    avgTimeSpent: number;
    completionRate: number;
  };
  feedback: {
    total: number;
    pending: number;
    avgSentiment: number;
  };
  aiQueue: {
    pending: number;
    generating: number;
    completed: number;
    failed: number;
  };
  topArticles: any[];
  needsReview: any[];
}

export default function KnowledgeBaseAdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [bulkActionDialog, setBulkActionDialog] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [exportDialog, setExportDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);

  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery<{ data: DashboardStats }>({
    queryKey: ['/api/admin/knowledge-base/dashboard'],
  });

  // Fetch pending feedback
  const { data: feedbackData } = useQuery({
    queryKey: ['/api/admin/knowledge-base/feedback/pending'],
  });

  // Fetch AI generation queue
  const { data: aiQueueData } = useQuery({
    queryKey: ['/api/admin/knowledge-base/ai-queue'],
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/knowledge-base/articles/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Bulk update failed');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Articles updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/knowledge-base/dashboard'] });
      setSelectedArticles([]);
      setBulkActionDialog(false);
    },
  });

  // Resolve feedback mutation
  const resolveFeedbackMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await fetch(`/api/admin/knowledge-base/feedback/${id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolutionNotes: notes }),
      });
      if (!res.ok) throw new Error('Failed to resolve feedback');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Feedback resolved',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/knowledge-base/feedback/pending'] });
    },
  });

  // Retry AI generation mutation
  const retryAIMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/knowledge-base/ai-queue/${id}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to retry generation');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'AI generation queued for retry',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/knowledge-base/ai-queue'] });
    },
  });

  // Export articles
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(`/api/admin/knowledge-base/export?format=${format}`, {
        credentials: 'include',
      });

      if (format === 'json') {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data.data, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kb-export-${new Date().toISOString()}.json`;
        a.click();
      } else {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kb-export-${new Date().toISOString()}.csv`;
        a.click();
      }

      toast({
        title: 'Success',
        description: 'Articles exported successfully',
      });
      setExportDialog(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export articles',
        variant: 'destructive',
      });
    }
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base Admin</h1>
          <p className="text-muted-foreground">Manage articles, content, and AI generation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setExportDialog(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => (window.location.href = '/admin/knowledge-base/article-editor')}>
            <FileText className="h-4 w-4 mr-2" />
            New Article
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data.articles.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.data.articles.published || 0} published, {stats?.data.articles.draft || 0}{' '}
              draft
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.data.views.total.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.data.views.recent || 0} in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Feedback</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data.feedback.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.data.feedback.total || 0} total feedback
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Generated</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data.articles.aiGenerated || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.data.aiQueue.pending || 0} in queue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="ai-queue">AI Queue</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Articles */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Articles</CardTitle>
                <CardDescription>Most viewed articles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.data.topArticles.map((article, index) => (
                    <div
                      key={article.id}
                      className="flex items-center justify-between p-2 hover:bg-accent rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{index + 1}</Badge>
                        <div>
                          <p className="font-medium text-sm">{article.title}</p>
                          <p className="text-xs text-muted-foreground">{article.viewCount} views</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Articles Needing Review */}
            <Card>
              <CardHeader>
                <CardTitle>Needs Review</CardTitle>
                <CardDescription>Articles waiting for approval</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.data.needsReview.map((article) => (
                    <div
                      key={article.id}
                      className="flex items-center justify-between p-2 hover:bg-accent rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">{article.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(article.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            bulkUpdateMutation.mutate({
                              articleIds: [article.id],
                              updates: { status: 'published' },
                            });
                          }}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Articles Tab */}
        <TabsContent value="articles">
          <Card>
            <CardHeader>
              <CardTitle>All Articles</CardTitle>
              <CardDescription>Manage knowledge base articles</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Article management interface would go here
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle>Pending Feedback</CardTitle>
              <CardDescription>User feedback requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbackData?.data?.map((feedback: any) => (
                    <TableRow key={feedback.id}>
                      <TableCell className="font-medium">
                        {feedback.article?.title || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge>{feedback.feedbackType}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {feedback.comment || 'N/A'}
                      </TableCell>
                      <TableCell>{new Date(feedback.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            resolveFeedbackMutation.mutate({
                              id: feedback.id,
                            })
                          }
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Queue Tab */}
        <TabsContent value="ai-queue">
          <Card>
            <CardHeader>
              <CardTitle>AI Generation Queue</CardTitle>
              <CardDescription>Manage AI content generation tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiQueueData?.data?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.context?.topic || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === 'completed'
                              ? 'default'
                              : item.status === 'failed'
                                ? 'destructive'
                                : 'outline'
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{item.attempts}</TableCell>
                      <TableCell>
                        {item.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryAIMutation.mutate(item.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>Detailed knowledge base analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Analytics charts and metrics would go here
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <Dialog open={exportDialog} onOpenChange={setExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Articles</DialogTitle>
            <DialogDescription>
              Choose the format to export your knowledge base articles
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport('json')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export as JSON
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport('csv')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export as CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Articles</DialogTitle>
            <DialogDescription>Upload a JSON or CSV file to import articles</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input type="file" accept=".json,.csv" />
            <p className="text-sm text-muted-foreground">
              Upload a file containing articles in JSON or CSV format
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>
              Cancel
            </Button>
            <Button>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
