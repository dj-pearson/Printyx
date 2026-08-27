/**
 * AI Search & Knowledge Dashboard
 * Vector database search, AI query processing, and intelligent knowledge discovery interface
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  toKnowledgeEntity,
  toSearchResult,
  toAiAnswer,
  type KnowledgeEntity,
  type KnowledgeEntityRow,
  type SearchResult,
  type SearchAnalytics,
  type AIAnswer,
  type SemanticSearchResponse,
} from '@/lib/ai-search/normalize';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Search,
  Brain,
  Zap,
  Target,
  TrendingUp,
  BookOpen,
  Network,
  Filter,
  Clock,
  Star,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Share,
  Download,
  Eye,
  MessageSquare,
  Lightbulb,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Users,
  BarChart3,
  Hash,
  Tag,
  Globe,
  Database,
  FileText,
  Mic,
  Library,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  ExternalLink,
  Minus,
  X,
} from 'lucide-react';

const AISearchKnowledgeDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('search');
  const [votedAnswerId, setVotedAnswerId] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState({
    contentTypes: [] as string[],
    categories: [] as string[],
    tags: [] as string[],
    maxResults: 10,
    includeAnswer: true,
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // -- Data ------------------------------------------------------------------
  const {
    data: knowledgeEntities = [],
    isLoading: entitiesLoading,
    isError: entitiesFailed,
  } = useQuery<KnowledgeEntity[]>({
    queryKey: ['/api/ai-search/knowledge/entities'],
    queryFn: async () => {
      const res = await apiRequest<{ entities?: KnowledgeEntityRow[] }>(
        '/api/ai-search/knowledge/entities?limit=50&sortBy=importance',
      );
      return (res.entities ?? []).map(toKnowledgeEntity);
    },
  });

  const {
    data: searchAnalytics = null,
    isLoading: analyticsLoading,
    isError: analyticsFailed,
  } = useQuery<SearchAnalytics | null>({
    queryKey: ['/api/ai-search/search/analytics'],
    queryFn: () => apiRequest<SearchAnalytics>('/api/ai-search/search/analytics'),
  });

  // Suggestions are a convenience affordance; a failure here leaves the chips
  // hidden rather than surfacing an error banner over the search box.
  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey: ['/api/ai-search/search/suggestions'],
    queryFn: async () => {
      const res = await apiRequest<{ suggestions?: string[] }>('/api/ai-search/search/suggestions');
      return res.suggestions ?? [];
    },
  });

  const searchMutation = useMutation<SemanticSearchResponse, Error, string>({
    mutationFn: (query: string) =>
      apiRequest<SemanticSearchResponse>('/api/ai-search/search/semantic', 'POST', {
        query,
        contentTypes: searchFilters.contentTypes,
        categories: searchFilters.categories,
        maxResults: searchFilters.maxResults,
        includeAnswer: searchFilters.includeAnswer,
      }),
  });

  const feedbackMutation = useMutation<
    unknown,
    Error,
    { queryId: string; answerId: string; wasHelpful: boolean }
  >({
    mutationFn: (vars) => apiRequest('/api/ai-search/search/feedback', 'POST', vars),
    onSuccess: (_data, vars) => setVotedAnswerId(vars.answerId),
  });

  // Derived from the mutation rather than mirrored into state, so the results
  // cannot drift out of sync with the request that produced them.
  const searchLoading = searchMutation.isPending;
  const searchResults: SearchResult[] = (searchMutation.data?.results ?? []).map(toSearchResult);
  const aiAnswer: AIAnswer | null = searchMutation.data?.answer
    ? toAiAnswer(searchMutation.data.answer)
    : null;
  const relatedTopics = searchMutation.data?.relatedTopics ?? [];
  const searchMetrics = searchMutation.data?.searchMetrics ?? null;
  const loading = entitiesLoading || analyticsLoading;

  const runSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setVotedAnswerId(null);
    searchMutation.mutate(trimmed);
  };

  const handleSearch = () => runSearch(searchQuery);

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    // Pass the suggestion through explicitly -- setSearchQuery does not apply
    // until the next render, so reading searchQuery back here would re-run the
    // PREVIOUS query (a bug the fixture version shipped with).
    runSearch(suggestion);
  };

  const handleAnswerFeedback = (answerId: string | null, isHelpful: boolean) => {
    const queryId = searchMutation.data?.queryId;
    // answerId is null when the answer could not be persisted, so there is no
    // row to attach a vote to.
    if (!answerId || !queryId) return;
    feedbackMutation.mutate({ queryId, answerId, wasHelpful: isHelpful });
  };

  const toggleSectionExpansion = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getEntityTypeIcon = (type: string) => {
    switch (type) {
      case 'product':
        return <Target className="h-4 w-4" />;
      case 'technology':
        return <Zap className="h-4 w-4" />;
      case 'concept':
        return <Lightbulb className="h-4 w-4" />;
      case 'person':
        return <Users className="h-4 w-4" />;
      case 'organization':
        return <Globe className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'meeting_transcription':
        return <Mic className="h-4 w-4" />;
      case 'knowledge_article':
        return <BookOpen className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading AI search dashboard...</span>
      </div>
    );
  }

  // Both dashboard queries failing means the ai-search backend is unreachable.
  // Say so explicitly: a shell of empty tiles is indistinguishable from a tenant
  // that simply has no search history yet, and this page exists precisely to stop
  // showing numbers that cannot be trusted.
  if (entitiesFailed && analyticsFailed) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-gray-900 font-medium">Could not load AI search data</p>
        <p className="text-sm text-gray-600 mt-1 max-w-md">
          The knowledge and analytics services did not respond. No data is shown rather than
          placeholder figures. Try again shortly.
        </p>
      </div>
    );
  }

  return (
    <MainLayout
      title="AI Search & Knowledge"
      description="Vector database search, AI query processing, and intelligent knowledge discovery across all content"
    >
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Database className="h-4 w-4 mr-2" />
            Vector Index
          </Button>
          <Button variant="outline">
            <Network className="h-4 w-4 mr-2" />
            Knowledge Graph
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Queries</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {searchAnalytics?.totalQueries}
                  </p>
                </div>
                <Search className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {searchAnalytics?.averageResponseTime}ms avg response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">AI Answers</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {searchAnalytics?.answersGenerated}
                  </p>
                </div>
                <Brain className="h-8 w-8 text-purple-600" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((searchAnalytics?.averageAnswerConfidence || 0) * 100)}% confidence
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Knowledge Entities</p>
                  <p className="text-2xl font-bold text-green-600">{knowledgeEntities.length}</p>
                </div>
                <Network className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-xs text-gray-500 mt-1">Active knowledge graph</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Satisfaction</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {searchAnalytics?.averageUserSatisfaction}
                  </p>
                </div>
                <Star className="h-8 w-8 text-orange-600" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((searchAnalytics?.answerHelpfulnessRate || 0) * 100)}% helpful rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="search">Semantic Search</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge Graph</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-6">
            {/* Search Interface */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Search className="h-5 w-5 mr-2" />
                  AI-Powered Search
                </CardTitle>
                <CardDescription>
                  Search across documents, meetings, and knowledge base with semantic understanding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-4">
                  <Input
                    aria-label="Ask a question"
                    placeholder="Ask anything about your content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={searchLoading}>
                    {searchLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Search
                  </Button>
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </div>

                {/* Search Suggestions */}
                {suggestions.length > 0 && !searchResults.length && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Popular searches:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.slice(0, 6).map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs"
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Answer */}
            {aiAnswer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Brain className="h-5 w-5 mr-2" />
                      AI Generated Answer
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {Math.round(aiAnswer.answerConfidence * 100)}% confidence
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {aiAnswer.answerType.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="prose max-w-none">
                    <p className="text-gray-700 leading-relaxed">{aiAnswer.answerText}</p>
                  </div>

                  {/* Answer Sections */}
                  {aiAnswer.answerSections.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">Detailed Breakdown:</h4>
                      {aiAnswer.answerSections.map((section, index) => (
                        <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                          <h5 className="font-medium text-gray-800">{section.title}</h5>
                          <p className="text-sm text-gray-600 mt-1">{section.content}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="text-xs text-gray-500">Sources:</span>
                            {section.sources.map((source, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {source}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Key Points */}
                  {aiAnswer.keyPoints.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Key Points:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {aiAnswer.keyPoints.map((point, index) => (
                          <li key={index} className="text-sm text-gray-700">
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Quality Scores */}
                  {aiAnswer.factualAccuracyScore && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Accuracy</p>
                        <p className="text-lg font-bold text-green-600">
                          {Math.round((aiAnswer.factualAccuracyScore || 0) * 100)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Completeness</p>
                        <p className="text-lg font-bold text-blue-600">
                          {Math.round((aiAnswer.completenessScore || 0) * 100)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Clarity</p>
                        <p className="text-lg font-bold text-purple-600">
                          {Math.round((aiAnswer.clarityScore || 0) * 100)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Usefulness</p>
                        <p className="text-lg font-bold text-orange-600">
                          {Math.round((aiAnswer.usefulnessScore || 0) * 100)}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Answer Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {/* Disabled once a vote lands (or while it is in flight), and
                            when the answer has no persisted id to vote against. */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            !aiAnswer.id || feedbackMutation.isPending || votedAnswerId !== null
                          }
                          onClick={() => handleAnswerFeedback(aiAnswer.id, true)}
                        >
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          {aiAnswer.userHelpfulVotes}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            !aiAnswer.id || feedbackMutation.isPending || votedAnswerId !== null
                          }
                          onClick={() => handleAnswerFeedback(aiAnswer.id, false)}
                        >
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          {aiAnswer.userUnhelpfulVotes}
                        </Button>
                        {votedAnswerId !== null && (
                          <span className="text-sm text-gray-500">Thanks for the feedback</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share className="h-4 w-4 mr-1" />
                        Share
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Search Results ({searchResults.length})</span>
                    {searchMetrics && (
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Search: {searchMetrics.searchTime}ms</span>
                        <span>Embedding: {searchMetrics.embeddingTime}ms</span>
                        {searchMetrics.answerTime && (
                          <span>Answer: {searchMetrics.answerTime}ms</span>
                        )}
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {getContentTypeIcon(result.contentType)}
                            <h4 className="font-medium text-gray-900">{result.title}</h4>
                            <Badge variant="outline" className="text-xs capitalize">
                              {result.contentType.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">
                              {Math.round(result.similarity * 100)}% match
                            </Badge>
                            <Badge variant="outline">
                              {Math.round(result.relevanceScore * 100)}% relevant
                            </Badge>
                          </div>
                        </div>

                        <p className="text-gray-700 mb-3">{result.excerpt}</p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            {result.source.category && (
                              <span className="capitalize">{result.source.category}</span>
                            )}
                            {result.source.createdAt && (
                              <span>{result.source.createdAt.toLocaleDateString()}</span>
                            )}
                            <div className="flex items-center space-x-1">
                              {result.source.tags.slice(0, 3).map((tag, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {result.source.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{result.source.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button aria-label="View details" variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button aria-label="Open in a new tab" variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Highlights */}
                        {result.highlights.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">Highlights:</span>
                              {result.highlights.map((highlight, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {highlight}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Related Topics */}
            {relatedTopics.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Hash className="h-5 w-5 mr-2" />
                    Related Topics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {relatedTopics.map((topic, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestionClick(topic)}
                        className="text-sm"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {topic}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-6">
            {/* Knowledge Entities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Network className="h-5 w-5 mr-2" />
                  Knowledge Entities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {knowledgeEntities.map((entity) => (
                    <div key={entity.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {getEntityTypeIcon(entity.entityType)}
                          <h4 className="font-medium">{entity.entityName}</h4>
                          <Badge variant="outline" className="text-xs capitalize">
                            {entity.entityType}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {Math.round(entity.importanceScore * 100)}% importance
                          </Badge>
                          {entity.trendingScore > 0.2 && (
                            <Badge className="bg-orange-100 text-orange-800">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Trending
                            </Badge>
                          )}
                        </div>
                      </div>

                      {entity.entityDescription && (
                        <p className="text-sm text-gray-600 mb-3">{entity.entityDescription}</p>
                      )}

                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between text-sm">
                          <span>Mentions</span>
                          <span className="font-medium">{entity.mentionFrequency}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>AI Confidence</span>
                          <span className="font-medium">
                            {Math.round(entity.aiConfidenceScore * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Quality Score</span>
                          <span className="font-medium">
                            {Math.round(entity.qualityScore * 100)}%
                          </span>
                        </div>
                      </div>

                      {entity.entityFacts.length > 0 && (
                        <div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSectionExpansion(entity.id)}
                            className="p-0 h-auto font-medium text-sm"
                          >
                            {expandedSections.has(entity.id) ? (
                              <ChevronDown className="h-4 w-4 mr-1" />
                            ) : (
                              <ChevronRight className="h-4 w-4 mr-1" />
                            )}
                            {entity.entityFacts.length} facts
                          </Button>

                          {expandedSections.has(entity.id) && (
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              {entity.entityFacts.map((fact, idx) => (
                                <li key={idx} className="text-xs text-gray-600">
                                  {fact}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <span className="text-xs text-gray-500">
                          {entity.lastMentionedAt
                            ? `Last mentioned ${entity.lastMentionedAt.toLocaleDateString()}`
                            : `Created ${entity.createdAt.toLocaleDateString()}`}
                        </span>
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Search Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6 text-center">
                  <Search className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">
                    {searchAnalytics?.totalQueries}
                  </p>
                  <p className="text-sm text-gray-600">Total Queries</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">
                    {searchAnalytics?.uniqueUsers}
                  </p>
                  <p className="text-sm text-gray-600">Unique Users</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600">
                    {searchAnalytics?.averageResponseTime}ms
                  </p>
                  <p className="text-sm text-gray-600">Avg Response Time</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <Star className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-orange-600">
                    {searchAnalytics?.averageUserSatisfaction}
                  </p>
                  <p className="text-sm text-gray-600">User Satisfaction</p>
                </CardContent>
              </Card>
            </div>

            {/* Query Types — derived from the recorded intent of real queries. */}
            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Query Types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {searchAnalytics?.mostCommonQueryTypes.length === 0 && (
                      <p className="text-sm text-gray-500">No searches recorded yet.</p>
                    )}
                    {searchAnalytics?.mostCommonQueryTypes.map((type, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium capitalize">
                            {type.type.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${type.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600 w-12">{type.count}</span>
                          <span className="text-xs text-gray-500 w-8">
                            {type.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* REMOVED (AUDIT-015): "Trending Topics", "AI Insights", "Optimization
                Recommendations" and "Content Creation Suggestions".

                All four were LLM-style narrative panels that nothing computes: the
                analytics handler hardcodes trendingTopics/aiInsights/
                optimizationRecommendations/contentSuggestions to [], and no code path
                populates them. Wired up they would render as four permanently empty
                cards — a promise of analysis the product does not perform.

                Per the CLAUDE.md rule applied throughout this story (delete features
                with no backing implementation rather than fake them), they are removed
                instead of being given empty states. The fixture UI is recoverable via
                `git log --follow` if a story ever implements the analysis behind them. */}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Search Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Default Search Settings</h4>
                    <div className="space-y-3">
                      <label>
                        <span className="text-sm font-medium">Max Results</span>
                        <Select defaultValue="10">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 results</SelectItem>
                            <SelectItem value="10">10 results</SelectItem>
                            <SelectItem value="20">20 results</SelectItem>
                            <SelectItem value="50">50 results</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                      <label>
                        <span className="text-sm font-medium">Minimum Similarity</span>
                        <Select defaultValue="0.3">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.1">10% (Very Loose)</SelectItem>
                            <SelectItem value="0.3">30% (Loose)</SelectItem>
                            <SelectItem value="0.5">50% (Medium)</SelectItem>
                            <SelectItem value="0.7">70% (Strict)</SelectItem>
                            <SelectItem value="0.9">90% (Very Strict)</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">AI Answer Generation</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Enable AI Answers</span>
                        <Button aria-label="Enable AI Answers" variant="outline" size="sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Include Source Citations</span>
                        <Button aria-label="Include Source Citations" variant="outline" size="sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Generate Key Points</span>
                        <Button aria-label="Generate Key Points" variant="outline" size="sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Vector Index Management</h4>
                  <div className="flex items-center space-x-4">
                    <Button>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Rebuild Index
                    </Button>
                    <Button variant="outline">
                      <Database className="h-4 w-4 mr-2" />
                      Index Status
                    </Button>
                    <Button variant="outline">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Performance Metrics
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default AISearchKnowledgeDashboard;
