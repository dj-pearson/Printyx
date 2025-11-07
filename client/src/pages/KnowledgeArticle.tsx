import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { 
  ArrowLeft,
  Clock,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Share2,
  BookmarkPlus,
  ChevronRight,
  BookOpen
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: any;
  htmlContent: string;
  categoryId: string;
  categoryName: string;
  contentType: string;
  difficultyLevel: string;
  viewCount: number;
  estimatedReadingTime: number;
  helpfulVotes: number;
  unhelpfulVotes: number;
  publishedAt: string;
  updatedAt: string;
  tags: string[];
  relatedArticles: any[];
}

interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
}

export default function KnowledgeArticle() {
  const [, params] = useRoute("/knowledge-base/article/:slug");
  const slug = params?.slug;
  const { toast } = useToast();
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  const { data: article, isLoading } = useQuery<Article>({
    queryKey: ["/api/knowledge-base/articles", slug],
    enabled: !!slug,
  });

  const feedbackMutation = useMutation({
    mutationFn: async (helpful: boolean) => {
      return apiRequest("POST", `/api/knowledge-base/articles/${slug}/feedback`, {
        helpful,
      });
    },
    onSuccess: () => {
      setFeedbackGiven(true);
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/articles", slug] });
      toast({
        title: "Thank you for your feedback!",
        description: "Your feedback helps us improve our documentation.",
      });
    },
  });

  const extractTableOfContents = (content: any): TableOfContentsItem[] => {
    if (!content || !Array.isArray(content)) return [];
    
    return content
      .filter((section: any) => section.type === 'heading')
      .map((section: any, index: number) => ({
        id: `section-${index}`,
        title: section.content,
        level: section.level || 2,
      }));
  };

  const getDifficultyColor = (level: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      expert: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    return colors[level] || colors.beginner;
  };

  if (isLoading) {
    return (
      <div className="p-8 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="p-8 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto text-center">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
          <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Article Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The article you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/knowledge-base">
            <Button data-testid="button-back-to-kb">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Knowledge Base
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const toc = extractTableOfContents(article.content);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-b from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <Link href="/knowledge-base">
            <Button 
              variant="ghost" 
              size="sm" 
              data-testid="button-back"
              className="mb-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Knowledge Base
            </Button>
          </Link>

          <div className="flex items-center gap-2 mb-4">
            <Badge className={getDifficultyColor(article.difficultyLevel)}>
              {article.difficultyLevel}
            </Badge>
            <Badge variant="outline" className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {article.contentType}
            </Badge>
            <span className="text-gray-400 dark:text-gray-600">•</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">{article.categoryName}</span>
          </div>

          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white" data-testid="text-article-title">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
              {article.excerpt}
            </p>
          )}

          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{article.estimatedReadingTime} min read</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                Updated {new Date(article.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>{article.viewCount.toLocaleString()} views</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Table of Contents - Sidebar */}
          {toc.length > 0 && (
            <aside className="lg:col-span-1">
              <Card className="sticky top-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">
                    On this page
                  </h3>
                  <nav className="space-y-2">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        data-testid={`link-toc-${item.id}`}
                        className={`block text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-gray-600 dark:text-gray-400 ${
                          item.level > 2 ? 'pl-4' : ''
                        }`}
                      >
                        {item.title}
                      </a>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </aside>
          )}

          {/* Article Content */}
          <div className={toc.length > 0 ? "lg:col-span-3" : "lg:col-span-4"}>
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="pt-8">
                <div 
                  data-testid="content-article-body"
                  className="prose prose-lg dark:prose-invert max-w-none
                    prose-headings:text-gray-900 dark:prose-headings:text-white
                    prose-p:text-gray-700 dark:prose-p:text-gray-300
                    prose-li:text-gray-700 dark:prose-li:text-gray-300
                    prose-strong:text-gray-900 dark:prose-strong:text-white
                    prose-code:text-blue-600 dark:prose-code:text-blue-400
                    prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950
                    prose-a:text-blue-600 dark:prose-a:text-blue-400"
                  dangerouslySetInnerHTML={{ __html: article.htmlContent || '' }}
                />
              </CardContent>
            </Card>

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <Card className="mt-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map((tag, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary"
                        className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Feedback Section */}
            <Card className="mt-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">
                  Was this article helpful?
                </h3>
                {feedbackGiven ? (
                  <p className="text-green-600 dark:text-green-400">
                    Thank you for your feedback!
                  </p>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      data-testid="button-helpful-yes"
                      variant="outline"
                      onClick={() => feedbackMutation.mutate(true)}
                      disabled={feedbackMutation.isPending}
                      className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Yes ({article.helpfulVotes})
                    </Button>
                    <Button
                      data-testid="button-helpful-no"
                      variant="outline"
                      onClick={() => feedbackMutation.mutate(false)}
                      disabled={feedbackMutation.isPending}
                      className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <ThumbsDown className="h-4 w-4 mr-2" />
                      No ({article.unhelpfulVotes})
                    </Button>
                  </div>
                )}
                <Separator className="my-4 bg-gray-200 dark:bg-gray-700" />
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    data-testid="button-share"
                    className="text-gray-600 dark:text-gray-400"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    data-testid="button-bookmark"
                    className="text-gray-600 dark:text-gray-400"
                  >
                    <BookmarkPlus className="h-4 w-4 mr-2" />
                    Bookmark
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Related Articles */}
            {article.relatedArticles && article.relatedArticles.length > 0 && (
              <Card className="mt-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">
                    Related Articles
                  </h3>
                  <div className="space-y-3">
                    {article.relatedArticles.map((related: any) => (
                      <Link key={related.id} href={`/knowledge-base/article/${related.slug}`}>
                        <div 
                          data-testid={`link-related-${related.slug}`}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                          <span className="text-gray-900 dark:text-white">{related.title}</span>
                          <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
