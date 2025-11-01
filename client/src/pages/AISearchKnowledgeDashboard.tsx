/**
 * AI Search & Knowledge Dashboard
 * Vector database search, AI query processing, and intelligent knowledge discovery interface
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Search,
  Brain,
  Sparkles,
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
  Plus,
  Minus,
  X
} from 'lucide-react';

interface SearchResult {
  contentId: string;
  contentType: string;
  title: string;
  excerpt: string;
  similarity: number;
  relevanceScore: number;
  source: {
    author?: string;
    createdAt?: Date;
    category?: string;
    tags: string[];
  };
  highlights: string[];
}

interface AIAnswer {
  id: string;
  answerText: string;
  answerConfidence: number;
  answerType: string;
  sourceDocuments: Array<{
    id: string;
    type: string;
    title: string;
    excerpt: string;
    relevanceScore: number;
  }>;
  answerSections: Array<{
    title: string;
    content: string;
    sources: string[];
  }>;
  keyPoints: string[];
  relatedTopics: string[];
  factualAccuracyScore?: number;
  completenessScore?: number;
  clarityScore?: number;
  usefulnessScore?: number;
  userHelpfulVotes: number;
  userUnhelpfulVotes: number;
  createdAt: Date;
}

interface KnowledgeEntity {
  id: string;
  entityName: string;
  entityType: string;
  entityDescription?: string;
  entityCategory?: string;
  entitySummary?: string;
  mentionFrequency: number;
  importanceScore: number;
  trendingScore: number;
  entityAttributes: Record<string, any>;
  entityFacts: string[];
  aiConfidenceScore: number;
  entityStatus: string;
  qualityScore: number;
  createdAt: Date;
  updatedAt: Date;
  lastMentionedAt?: Date;
}

interface SearchAnalytics {
  totalQueries: number;
  uniqueUsers: number;
  averageQueriesPerUser: number;
  mostCommonQueryTypes: Array<{ type: string; count: number; percentage: number }>;
  popularSearchTerms: Array<{ term: string; count: number; trend: string }>;
  trendingTopics: Array<{ topic: string; growth: number; volume: number }>;
  averageResponseTime: number;
  averageResultCount: number;
  zeroResultQueryRate: number;
  answersGenerated: number;
  averageAnswerConfidence: number;
  answerHelpfulnessRate: number;
  averageUserSatisfaction: number;
  aiInsights: string[];
  optimizationRecommendations: string[];
  contentSuggestions: string[];
}

const AISearchKnowledgeDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [aiAnswer, setAiAnswer] = useState<AIAnswer | null>(null);
  const [knowledgeEntities, setKnowledgeEntities] = useState<KnowledgeEntity[]>([]);
  const [searchAnalytics, setSearchAnalytics] = useState<SearchAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  const [searchFilters, setSearchFilters] = useState({
    contentTypes: [] as string[],
    categories: [] as string[],
    tags: [] as string[],
    maxResults: 10,
    includeAnswer: true
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [relatedTopics, setRelatedTopics] = useState<string[]>([]);
  const [searchMetrics, setSearchMetrics] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDashboardData();
    loadSearchSuggestions();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Mock data loading - replace with actual API calls
      const mockEntities: KnowledgeEntity[] = [
        {
          id: 'entity-1',
          entityName: 'Motion AI',
          entityType: 'product',
          entityDescription: 'Advanced AI-powered productivity and automation platform',
          entityCategory: 'software',
          entitySummary: 'SaaS platform for enterprise productivity with AI capabilities',
          mentionFrequency: 156,
          importanceScore: 0.95,
          trendingScore: 0.23,
          entityAttributes: {
            type: 'SaaS platform',
            industry: 'productivity',
            targetMarket: 'enterprise'
          },
          entityFacts: [
            'Integrates with popular meeting platforms',
            'Provides AI-powered transcription',
            'Offers intelligent scheduling'
          ],
          aiConfidenceScore: 0.92,
          entityStatus: 'active',
          qualityScore: 0.88,
          createdAt: new Date('2025-09-15T10:00:00Z'),
          updatedAt: new Date('2025-09-25T14:30:00Z'),
          lastMentionedAt: new Date('2025-09-26T09:15:00Z')
        },
        {
          id: 'entity-2',
          entityName: 'Claude AI',
          entityType: 'technology',
          entityDescription: 'Large language model for AI-powered content generation and analysis',
          entityCategory: 'artificial_intelligence',
          entitySummary: 'Advanced language model with reasoning capabilities',
          mentionFrequency: 89,
          importanceScore: 0.88,
          trendingScore: 0.31,
          entityAttributes: {
            provider: 'Anthropic',
            modelType: 'language_model',
            capabilities: ['text_generation', 'analysis', 'reasoning']
          },
          entityFacts: [
            'Developed by Anthropic',
            'Constitutional AI approach',
            'Strong reasoning capabilities'
          ],
          aiConfidenceScore: 0.94,
          entityStatus: 'active',
          qualityScore: 0.91,
          createdAt: new Date('2025-09-10T08:00:00Z'),
          updatedAt: new Date('2025-09-24T16:45:00Z'),
          lastMentionedAt: new Date('2025-09-25T11:30:00Z')
        }
      ];

      const mockAnalytics: SearchAnalytics = {
        totalQueries: 1247,
        uniqueUsers: 89,
        averageQueriesPerUser: 14.0,
        mostCommonQueryTypes: [
          { type: 'how_to', count: 387, percentage: 31.0 },
          { type: 'factual', count: 298, percentage: 23.9 },
          { type: 'troubleshooting', count: 234, percentage: 18.8 }
        ],
        popularSearchTerms: [
          { term: 'meeting transcription', count: 156, trend: 'increasing' },
          { term: 'AI documentation', count: 134, trend: 'stable' },
          { term: 'team collaboration', count: 98, trend: 'increasing' }
        ],
        trendingTopics: [
          { topic: 'AI Writing Assistant', growth: 45.2, volume: 234 },
          { topic: 'Vector Search', growth: 38.7, volume: 187 },
          { topic: 'Knowledge Management', growth: 29.3, volume: 298 }
        ],
        averageResponseTime: 342,
        averageResultCount: 7.3,
        zeroResultQueryRate: 0.08,
        answersGenerated: 892,
        averageAnswerConfidence: 0.84,
        answerHelpfulnessRate: 0.79,
        averageUserSatisfaction: 4.2,
        aiInsights: [
          'Search query complexity has increased by 23% over the past month',
          'How-to queries have the highest satisfaction rates (4.6/5)',
          'Users who receive AI-generated answers are 67% more likely to complete sessions'
        ],
        optimizationRecommendations: [
          'Expand content coverage for advanced scheduling topics',
          'Improve response times for complex how-to queries',
          'Create more visual content for troubleshooting topics'
        ],
        contentSuggestions: [
          'Create comprehensive guide on advanced scheduling algorithms',
          'Develop troubleshooting knowledge base for integration issues',
          'Add mobile app documentation and feature guides'
        ]
      };

      setKnowledgeEntities(mockEntities);
      setSearchAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSearchSuggestions = async () => {
    try {
      const mockSuggestions = [
        'How to set up meeting transcription',
        'AI documentation best practices',
        'Team collaboration workflows',
        'Calendar integration troubleshooting',
        'Advanced scheduling algorithms',
        'Vector search implementation',
        'Knowledge management strategies',
        'Automated content generation'
      ];
      setSuggestions(mockSuggestions);
    } catch (error) {
      console.error('Failed to load search suggestions:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    try {
      // Mock search results - replace with actual API call
      const mockResults: SearchResult[] = [
        {
          contentId: 'doc-1',
          contentType: 'document',
          title: 'Meeting Transcription Setup Guide',
          excerpt: 'Complete guide for setting up AI-powered meeting transcription with step-by-step instructions for multiple platforms including Zoom, Teams, and Google Meet.',
          similarity: 0.94,
          relevanceScore: 0.92,
          source: {
            author: 'user-1',
            createdAt: new Date('2025-09-20'),
            category: 'tutorial',
            tags: ['meetings', 'AI', 'transcription', 'setup']
          },
          highlights: ['meeting transcription', 'setup', 'AI-powered']
        },
        {
          contentId: 'article-1',
          contentType: 'knowledge_article',
          title: 'AI Documentation Best Practices',
          excerpt: 'Essential best practices for creating high-quality documents using AI assistance, including tips for prompt engineering and content optimization.',
          similarity: 0.87,
          relevanceScore: 0.85,
          source: {
            author: 'user-2',
            createdAt: new Date('2025-09-18'),
            category: 'best_practices',
            tags: ['AI', 'documentation', 'writing', 'best-practices']
          },
          highlights: ['AI', 'documentation', 'best practices']
        }
      ];

      const mockAnswer: AIAnswer = {
        id: 'answer-1',
        answerText: 'To set up AI-powered meeting transcription, you need to configure your meeting platform integration, enable automatic recording, and customize the AI processing settings. The system supports multiple platforms including Zoom, Microsoft Teams, and Google Meet with 91% accuracy across 95+ languages.',
        answerConfidence: 0.89,
        answerType: 'step_by_step',
        sourceDocuments: mockResults.slice(0, 2).map(result => ({
          id: result.contentId,
          type: result.contentType,
          title: result.title,
          excerpt: result.excerpt,
          relevanceScore: result.relevanceScore
        })),
        answerSections: [
          {
            title: 'Platform Integration',
            content: 'Connect your meeting platform (Zoom, Teams, or Google Meet) using the provided API credentials and webhook configurations.',
            sources: ['doc-1']
          },
          {
            title: 'Recording Setup',
            content: 'Enable automatic recording with cloud storage integration and configure quality settings for optimal transcription accuracy.',
            sources: ['doc-1']
          }
        ],
        keyPoints: [
          'Supports 95+ languages with 91% accuracy',
          'Real-time transcription with speaker identification',
          'Automatic action item extraction',
          'Integration with popular meeting platforms'
        ],
        relatedTopics: ['AI transcription', 'meeting automation', 'speech recognition', 'workflow integration'],
        factualAccuracyScore: 0.92,
        completenessScore: 0.85,
        clarityScore: 0.91,
        usefulnessScore: 0.88,
        userHelpfulVotes: 23,
        userUnhelpfulVotes: 2,
        createdAt: new Date()
      };

      setSearchResults(mockResults);
      setAiAnswer(mockAnswer);
      setRelatedTopics(['AI transcription', 'meeting automation', 'speech recognition', 'workflow integration']);
      setSearchMetrics({
        totalResults: mockResults.length,
        searchTime: 342,
        embeddingTime: 45,
        answerTime: 1250
      });
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    handleSearch();
  };

  const handleAnswerFeedback = (answerId: string, isHelpful: boolean) => {
    console.log(`Answer ${answerId} feedback:`, isHelpful ? 'helpful' : 'not helpful');
    // In production, this would send feedback to the API
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
      case 'product': return <Target className="h-4 w-4" />;
      case 'technology': return <Zap className="h-4 w-4" />;
      case 'concept': return <Lightbulb className="h-4 w-4" />;
      case 'person': return <Users className="h-4 w-4" />;
      case 'organization': return <Globe className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="h-4 w-4" />;
      case 'meeting_transcription': return <Mic className="h-4 w-4" />;
      case 'knowledge_article': return <BookOpen className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
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
                <p className="text-2xl font-bold text-blue-600">{searchAnalytics?.totalQueries}</p>
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
                <p className="text-2xl font-bold text-purple-600">{searchAnalytics?.answersGenerated}</p>
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
            <p className="text-xs text-gray-500 mt-1">
              Active knowledge graph
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Satisfaction</p>
                <p className="text-2xl font-bold text-orange-600">{searchAnalytics?.averageUserSatisfaction}</p>
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
                        <li key={index} className="text-sm text-gray-700">{point}</li>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnswerFeedback(aiAnswer.id, true)}
                      >
                        <ThumbsUp className="h-4 w-4 mr-1" />
                        {aiAnswer.userHelpfulVotes}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnswerFeedback(aiAnswer.id, false)}
                      >
                        <ThumbsDown className="h-4 w-4 mr-1" />
                        {aiAnswer.userUnhelpfulVotes}
                      </Button>
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
                    <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
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
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
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
                        <span className="font-medium">{Math.round(entity.aiConfidenceScore * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Quality Score</span>
                        <span className="font-medium">{Math.round(entity.qualityScore * 100)}%</span>
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
                              <li key={idx} className="text-xs text-gray-600">{fact}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <span className="text-xs text-gray-500">
                        {entity.lastMentionedAt ? 
                          `Last mentioned ${entity.lastMentionedAt.toLocaleDateString()}` :
                          `Created ${entity.createdAt.toLocaleDateString()}`
                        }
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
                <p className="text-2xl font-bold text-blue-600">{searchAnalytics?.totalQueries}</p>
                <p className="text-sm text-gray-600">Total Queries</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{searchAnalytics?.uniqueUsers}</p>
                <p className="text-sm text-gray-600">Unique Users</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-600">{searchAnalytics?.averageResponseTime}ms</p>
                <p className="text-sm text-gray-600">Avg Response Time</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Star className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-orange-600">{searchAnalytics?.averageUserSatisfaction}</p>
                <p className="text-sm text-gray-600">User Satisfaction</p>
              </CardContent>
            </Card>
          </div>

          {/* Query Types and Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Query Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {searchAnalytics?.mostCommonQueryTypes.map((type, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium capitalize">{type.type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${type.percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-12">{type.count}</span>
                        <span className="text-xs text-gray-500 w-8">{type.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Trending Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {searchAnalytics?.trendingTopics.map((topic, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{topic.topic}</p>
                        <p className="text-xs text-gray-500">{topic.volume} queries</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-green-100 text-green-800">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +{topic.growth.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights and Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lightbulb className="h-5 w-5 mr-2" />
                  AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {searchAnalytics?.aiInsights.map((insight, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-blue-50">
                    <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
                    <p className="text-sm">{insight}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Optimization Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {searchAnalytics?.optimizationRecommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                    <p className="text-sm">{recommendation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Content Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="h-5 w-5 mr-2" />
                Content Creation Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {searchAnalytics?.contentSuggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-orange-50">
                  <FileText className="h-4 w-4 text-orange-600 mt-0.5" />
                  <p className="text-sm">{suggestion}</p>
                </div>
              ))}
            </CardContent>
          </Card>
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
                    <div>
                      <label className="text-sm font-medium">Max Results</label>
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
                    </div>
                    <div>
                      <label className="text-sm font-medium">Minimum Similarity</label>
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
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">AI Answer Generation</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Enable AI Answers</span>
                      <Button variant="outline" size="sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Include Source Citations</span>
                      <Button variant="outline" size="sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Generate Key Points</span>
                      <Button variant="outline" size="sm">
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
