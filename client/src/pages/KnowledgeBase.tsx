import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  BookOpen,
  Search,
  TrendingUp,
  Clock,
  Star,
  ChevronRight,
  FileText,
  Lightbulb,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  articleCount: number;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  categoryId: string;
  categoryName: string;
  contentType: string;
  difficultyLevel: string;
  viewCount: number;
  estimatedReadingTime: number;
  featured: boolean;
  publishedAt: string;
}

export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/knowledge-base/categories'],
    queryFn: async () => {
      const response = await apiRequest('/api/knowledge-base/categories', 'GET');
      return (response || []).map((category: any) => ({
        ...category,
        id: category.id,
        categoryName: category.category_name || category.categoryName || '',
        createdAt: category.created_at || category.createdAt || '',
      }));
    },
  });

  const { data: articlesResponse, isLoading: articlesLoading } = useQuery<
    { articles: Article[] } | Article[]
  >({
    queryKey: ['/api/knowledge-base/articles'],
    queryFn: async () => {
      const response = await apiRequest('/api/knowledge-base/articles', 'GET');
      const articles = Array.isArray(response) ? response : response?.articles || [];
      return articles.map((article: any) => ({
        ...article,
        id: article.id,
        categoryId: article.category_id || article.categoryId || '',
        viewCount: article.view_count || article.viewCount || 0,
        createdAt: article.created_at || article.createdAt || '',
        updatedAt: article.updated_at || article.updatedAt || '',
      }));
    },
  });

  // Handle both array and object responses
  const articlesArray = Array.isArray(articlesResponse)
    ? articlesResponse
    : articlesResponse?.articles || [];
  const featuredArticles = articlesArray.filter((a) => a.featured) || [];
  const recentArticles = articlesArray.slice(0, 5) || [];
  const popularArticles =
    [...articlesArray].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5) || [];

  const getIconForCategory = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      'book-open': <BookOpen className="h-6 w-6" />,
      users: <FileText className="h-6 w-6" />,
      wrench: <Lightbulb className="h-6 w-6" />,
      calculator: <FileText className="h-6 w-6" />,
      package: <FileText className="h-6 w-6" />,
      activity: <TrendingUp className="h-6 w-6" />,
      zap: <Zap className="h-6 w-6" />,
      sparkles: <Star className="h-6 w-6" />,
      globe: <BookOpen className="h-6 w-6" />,
      'alert-circle': <FileText className="h-6 w-6" />,
    };
    return icons[iconName] || <BookOpen className="h-6 w-6" />;
  };

  const getDifficultyColor = (level: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      expert: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return colors[level] || colors.beginner;
  };

  return (
    <div className="p-8 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <BookOpen className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Knowledge Base</h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Everything you need to know about using Printyx to manage your copier dealership
          </p>
        </div>

        {/* Search Bar */}
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
              <Input
                data-testid="input-knowledge-search"
                type="text"
                placeholder="Search articles, guides, and tutorials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
            </div>
          </CardContent>
        </Card>

        {/* Categories Grid */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            Browse by Category
          </h2>
          {categoriesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800">
                  <CardHeader className="h-32"></CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories?.map((category) => (
                <Link key={category.id} href={`/knowledge-base/category/${category.slug}`}>
                  <Card
                    data-testid={`card-category-${category.slug}`}
                    className="hover:shadow-lg transition-shadow cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  >
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-400">
                          {getIconForCategory(category.icon)}
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg text-gray-900 dark:text-white">
                            {category.name}
                          </CardTitle>
                          <CardDescription className="mt-2 text-gray-600 dark:text-gray-400">
                            {category.description}
                          </CardDescription>
                          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                            <FileText className="h-4 w-4" />
                            <span>{category.articleCount} articles</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Featured & Recent Articles Tabs */}
        <Tabs defaultValue="featured" className="w-full">
          <TabsList className="bg-gray-100 dark:bg-gray-800">
            <TabsTrigger value="featured" data-testid="tab-featured">
              <Star className="h-4 w-4 mr-2" />
              Featured
            </TabsTrigger>
            <TabsTrigger value="recent" data-testid="tab-recent">
              <Clock className="h-4 w-4 mr-2" />
              Recently Added
            </TabsTrigger>
            <TabsTrigger value="popular" data-testid="tab-popular">
              <TrendingUp className="h-4 w-4 mr-2" />
              Most Popular
            </TabsTrigger>
          </TabsList>

          <TabsContent value="featured" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {articlesLoading ? (
                [...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800">
                    <CardHeader className="h-40"></CardHeader>
                  </Card>
                ))
              ) : featuredArticles.length === 0 ? (
                <Card className="col-span-2 bg-white dark:bg-gray-800">
                  <CardContent className="pt-6">
                    <p className="text-center text-gray-500 dark:text-gray-400">
                      No featured articles yet
                    </p>
                  </CardContent>
                </Card>
              ) : (
                featuredArticles.map((article) => (
                  <Link key={article.id} href={`/knowledge-base/article/${article.slug}`}>
                    <Card
                      data-testid={`card-article-${article.slug}`}
                      className="hover:shadow-lg transition-shadow cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <Badge className={getDifficultyColor(article.difficultyLevel)}>
                            {article.difficultyLevel}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          >
                            {article.contentType}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg text-gray-900 dark:text-white">
                          {article.title}
                        </CardTitle>
                        <CardDescription className="mt-2 text-gray-600 dark:text-gray-400">
                          {article.excerpt}
                        </CardDescription>
                        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-500">
                          <span>{article.categoryName}</span>
                          <span>{article.estimatedReadingTime} min read</span>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-6">
            <div className="space-y-4">
              {articlesLoading
                ? [...Array(5)].map((_, i) => (
                    <Card key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800">
                      <CardContent className="h-20"></CardContent>
                    </Card>
                  ))
                : recentArticles.map((article) => (
                    <Link key={article.id} href={`/knowledge-base/article/${article.slug}`}>
                      <Card
                        data-testid={`card-recent-${article.slug}`}
                        className="hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {article.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {article.categoryName}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 ml-4">
                              <Badge className={getDifficultyColor(article.difficultyLevel)}>
                                {article.difficultyLevel}
                              </Badge>
                              <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
            </div>
          </TabsContent>

          <TabsContent value="popular" className="mt-6">
            <div className="space-y-4">
              {articlesLoading
                ? [...Array(5)].map((_, i) => (
                    <Card key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800">
                      <CardContent className="h-20"></CardContent>
                    </Card>
                  ))
                : popularArticles.map((article, index) => (
                    <Link key={article.id} href={`/knowledge-base/article/${article.slug}`}>
                      <Card
                        data-testid={`card-popular-${article.slug}`}
                        className="hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {article.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {article.categoryName}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 ml-4">
                              <div className="text-sm text-gray-500 dark:text-gray-500">
                                {article.viewCount.toLocaleString()} views
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick Links */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Need More Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button
                variant="outline"
                data-testid="button-contact-support"
                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                Contact Support
              </Button>
              <Button
                variant="outline"
                data-testid="button-video-tutorials"
                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                Video Tutorials
              </Button>
              <Button
                variant="outline"
                data-testid="button-community-forum"
                className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                Community Forum
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
