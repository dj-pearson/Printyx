/**
 * AI Documentation Dashboard
 * Intelligent document creation, AI writing assistance, and knowledge management interface
 */

import React, { useState, useEffect } from 'react';
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
import {
  FileText,
  Brain,
  Sparkles,
  PlusCircle,
  Search,
  Filter,
  Edit,
  Eye,
  Share,
  Download,
  Copy,
  BookOpen,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  BarChart3,
  TrendingUp,
  Zap,
  Target,
  Star,
  MessageSquare,
  Tag,
  Calendar,
  User,
  ChevronRight,
  ChevronDown,
  Settings,
  Wand2,
  FileEdit,
  Library,
  Layers,
  Hash,
  ArrowRight,
  Globe,
  Lock,
} from 'lucide-react';

interface AIDocument {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  version: number;
  content: Record<string, any>;
  wordCount: number;
  estimatedReadingTime: number;
  aiGeneratedPercentage: number;
  aiConfidenceScore: number;
  sourceType?: string;
  tags: string[];
  viewCount: number;
  editCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

interface DocumentType {
  id: string;
  name: string;
  description: string;
  category: string;
  usageCount: number;
  successRate: number;
  aiTone: string;
  aiComplexityLevel: string;
}

interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  excerpt: string;
  wordCount: number;
  estimatedReadingTime: number;
  aiDifficultyLevel: string;
  tags: string[];
  status: string;
  featured: boolean;
  viewCount: number;
  averageRating: number;
  createdAt: Date;
}

interface WritingAnalytics {
  documentsCreated: number;
  aiSessionsConducted: number;
  totalWordsGenerated: number;
  averageAiConfidence: number;
  suggestionsAccepted: number;
  suggestionsRejected: number;
  averageUserSatisfaction: number;
  popularDocumentTypes: Array<{ type: string; count: number }>;
  contentQualityTrends: Array<{ date: string; score: number }>;
  aiInsights: string[];
  recommendations: string[];
}

const AIDocumentationDashboard: React.FC = () => {
  const [documents, setDocuments] = useState<AIDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [knowledgeArticles, setKnowledgeArticles] = useState<KnowledgeArticle[]>([]);
  const [analytics, setAnalytics] = useState<WritingAnalytics | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDocument, setSelectedDocument] = useState<AIDocument | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Mock data loading - replace with actual API calls
      const mockDocuments: AIDocument[] = [
        {
          id: 'doc-1',
          title: 'Q4 Strategic Planning Meeting Minutes',
          description: 'Comprehensive minutes from Q4 strategic planning session',
          status: 'published',
          version: 2,
          content: { summary: 'Strategic planning session focused on Q4 objectives' },
          wordCount: 1247,
          estimatedReadingTime: 6,
          aiGeneratedPercentage: 0.85,
          aiConfidenceScore: 0.92,
          sourceType: 'meeting_transcription',
          tags: ['meeting', 'strategic', 'Q4', 'planning'],
          viewCount: 45,
          editCount: 3,
          createdBy: 'user-1',
          createdAt: new Date('2025-09-27T10:00:00Z'),
          updatedAt: new Date('2025-09-27T14:30:00Z'),
          publishedAt: new Date('2025-09-27T15:00:00Z'),
        },
        {
          id: 'doc-2',
          title: 'Enterprise Client Proposal - TechCorp Solutions',
          description: 'Comprehensive proposal for TechCorp enterprise engagement',
          status: 'review',
          version: 1,
          content: { executiveSummary: 'Proposal for comprehensive enterprise software solution' },
          wordCount: 2156,
          estimatedReadingTime: 11,
          aiGeneratedPercentage: 0.65,
          aiConfidenceScore: 0.88,
          sourceType: 'template',
          tags: ['proposal', 'enterprise', 'client', 'TechCorp'],
          viewCount: 23,
          editCount: 7,
          createdBy: 'user-1',
          createdAt: new Date('2025-09-26T09:00:00Z'),
          updatedAt: new Date('2025-09-27T11:15:00Z'),
        },
      ];

      const mockDocumentTypes: DocumentType[] = [
        {
          id: 'type-1',
          name: 'Meeting Minutes',
          description: 'Structured meeting minutes with action items and decisions',
          category: 'meeting',
          usageCount: 156,
          successRate: 0.91,
          aiTone: 'professional',
          aiComplexityLevel: 'medium',
        },
        {
          id: 'type-2',
          name: 'Business Proposal',
          description: 'Comprehensive business proposal template',
          category: 'proposal',
          usageCount: 89,
          successRate: 0.87,
          aiTone: 'professional',
          aiComplexityLevel: 'advanced',
        },
      ];

      const mockKnowledgeArticles: KnowledgeArticle[] = [
        {
          id: 'article-1',
          title: 'How to Set Up AI-Powered Meeting Transcription',
          category: 'tutorials',
          subcategory: 'meeting_management',
          excerpt:
            'Learn how to configure and use AI-powered meeting transcription for automatic note generation.',
          wordCount: 1456,
          estimatedReadingTime: 7,
          aiDifficultyLevel: 'intermediate',
          tags: ['tutorial', 'meetings', 'AI', 'transcription'],
          status: 'published',
          featured: true,
          viewCount: 234,
          averageRating: 4.7,
          createdAt: new Date('2025-09-20T10:00:00Z'),
        },
      ];

      const mockAnalytics: WritingAnalytics = {
        documentsCreated: 127,
        aiSessionsConducted: 89,
        totalWordsGenerated: 45600,
        averageAiConfidence: 0.87,
        suggestionsAccepted: 234,
        suggestionsRejected: 67,
        averageUserSatisfaction: 4.3,
        popularDocumentTypes: [
          { type: 'Meeting Minutes', count: 45 },
          { type: 'Business Proposal', count: 32 },
          { type: 'Project Report', count: 28 },
        ],
        contentQualityTrends: [
          { date: '2025-09-20', score: 0.82 },
          { date: '2025-09-21', score: 0.85 },
          { date: '2025-09-22', score: 0.87 },
        ],
        aiInsights: [
          'AI-generated content quality has improved by 12% over the past month',
          'Meeting minutes are the most frequently created document type',
          'Users accept 78% of AI content suggestions',
        ],
        recommendations: [
          'Consider creating more templates for frequently used document types',
          'Implement advanced formatting suggestions',
          'Add industry-specific writing prompts',
        ],
      };

      setDocuments(mockDocuments);
      setDocumentTypes(mockDocumentTypes);
      setKnowledgeArticles(mockKnowledgeArticles);
      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      // Mock search results
      const mockResults = [
        {
          document: documents[0],
          relevanceScore: 0.95,
          matchedContent: ['Q4 planning objectives', 'strategic decisions'],
          highlights: ['Q4', 'planning', 'strategic'],
        },
      ];

      setSearchResults(mockResults);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'review':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceIcon = (sourceType?: string) => {
    switch (sourceType) {
      case 'meeting_transcription':
        return <MessageSquare className="h-4 w-4" />;
      case 'template':
        return <Layers className="h-4 w-4" />;
      case 'ai_generated':
        return <Brain className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading AI documentation dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Documentation</h1>
          <p className="text-gray-600 mt-1">
            Intelligent document creation, AI writing assistance, and knowledge management
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Library className="h-4 w-4 mr-2" />
            Knowledge Base
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Document
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Documents</p>
                <p className="text-2xl font-bold text-blue-600">{analytics?.documentsCreated}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round((analytics?.averageAiConfidence || 0) * 100)}% AI confidence
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Sessions</p>
                <p className="text-2xl font-bold text-purple-600">
                  {analytics?.aiSessionsConducted}
                </p>
              </div>
              <Brain className="h-8 w-8 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {analytics?.totalWordsGenerated.toLocaleString()} words generated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Suggestions</p>
                <p className="text-2xl font-bold text-green-600">
                  {analytics?.suggestionsAccepted}
                </p>
              </div>
              <Lightbulb className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round(
                ((analytics?.suggestionsAccepted || 0) /
                  ((analytics?.suggestionsAccepted || 0) + (analytics?.suggestionsRejected || 0))) *
                  100,
              )}
              % accepted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Satisfaction</p>
                <p className="text-2xl font-bold text-orange-600">
                  {analytics?.averageUserSatisfaction}
                </p>
              </div>
              <Star className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Out of 5.0 rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Recent Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Recent Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {documents.slice(0, 3).map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium">{document.title}</h4>
                        <Badge className={getStatusColor(document.status)}>{document.status}</Badge>
                        <div className="flex items-center text-sm text-gray-500">
                          {getSourceIcon(document.sourceType)}
                          <span className="ml-1 capitalize">
                            {document.sourceType?.replace('_', ' ') || 'Manual'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-1" />
                          {document.wordCount} words
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {document.estimatedReadingTime} min read
                        </div>
                        <div className="flex items-center">
                          <Brain className="h-4 w-4 mr-1" />
                          {Math.round(document.aiGeneratedPercentage * 100)}% AI
                        </div>
                        <div className="flex items-center">
                          <Eye className="h-4 w-4 mr-1" />
                          {document.viewCount} views
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 mt-2">
                        {document.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {document.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{document.tags.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDocument(document)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Insights and Popular Templates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Sparkles className="h-5 w-5 mr-2" />
                  AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics?.aiInsights.map((insight, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-blue-50">
                    <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5" />
                    <p className="text-sm">{insight}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Popular Document Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.popularDocumentTypes.map((type, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Layers className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">{type.type}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{type.count}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(type.count / Math.max(...analytics.popularDocumentTypes.map((t) => t.count))) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button className="h-20 flex flex-col items-center justify-center space-y-2">
                  <Wand2 className="h-6 w-6" />
                  <span>Generate from Meeting</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                >
                  <FileEdit className="h-6 w-6" />
                  <span>Create from Template</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center space-y-2"
                >
                  <BookOpen className="h-6 w-6" />
                  <span>New Knowledge Article</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex space-x-4">
                <Input
                  placeholder="Search documents, content, and tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Documents List */}
          <div className="space-y-4">
            {documents.map((document) => (
              <Card key={document.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-semibold">{document.title}</h3>
                        <Badge className={getStatusColor(document.status)}>{document.status}</Badge>
                        <Badge variant="outline">v{document.version}</Badge>
                        <div className="flex items-center text-sm text-gray-500">
                          {getSourceIcon(document.sourceType)}
                          <span className="ml-1 capitalize">
                            {document.sourceType?.replace('_', ' ') || 'Manual'}
                          </span>
                        </div>
                      </div>

                      {document.description && (
                        <p className="text-gray-600 mb-3">{document.description}</p>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Word Count</p>
                          <p className="font-medium">{document.wordCount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Reading Time</p>
                          <p className="font-medium">{document.estimatedReadingTime} min</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">AI Generated</p>
                          <p className="font-medium">
                            {Math.round(document.aiGeneratedPercentage * 100)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Views</p>
                          <p className="font-medium">{document.viewCount}</p>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">AI Confidence Score</span>
                          <span className="text-sm font-medium">
                            {Math.round(document.aiConfidenceScore * 100)}%
                          </span>
                        </div>
                        <Progress value={document.aiConfidenceScore * 100} className="h-2" />
                      </div>

                      <div className="flex items-center space-x-2 mb-3">
                        {document.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center text-sm text-gray-600 space-x-4">
                        <span>Created: {document.createdAt.toLocaleDateString()}</span>
                        <span>Updated: {document.updatedAt.toLocaleDateString()}</span>
                        {document.publishedAt && (
                          <span>Published: {document.publishedAt.toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDocument(document)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          {/* Knowledge Base Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Knowledge Base</h2>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </div>

          {/* Featured Articles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="h-5 w-5 mr-2" />
                Featured Articles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {knowledgeArticles
                  .filter((article) => article.featured)
                  .map((article) => (
                    <div key={article.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-medium line-clamp-2">{article.title}</h4>
                        <Badge variant="outline" className="ml-2 shrink-0">
                          {article.aiDifficultyLevel}
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-600 mb-3 line-clamp-3">{article.excerpt}</p>

                      <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-3 w-3" />
                          <span>{article.estimatedReadingTime} min</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Eye className="h-3 w-3" />
                          <span>{article.viewCount}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Star className="h-3 w-3 fill-current text-yellow-400" />
                          <span>{article.averageRating}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {article.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {article.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{article.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Browse by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    name: 'Tutorials',
                    count: 23,
                    icon: BookOpen,
                    color: 'bg-blue-50 text-blue-600',
                  },
                  {
                    name: 'Best Practices',
                    count: 18,
                    icon: Target,
                    color: 'bg-green-50 text-green-600',
                  },
                  {
                    name: 'Troubleshooting',
                    count: 15,
                    icon: AlertCircle,
                    color: 'bg-orange-50 text-orange-600',
                  },
                  {
                    name: 'API Documentation',
                    count: 12,
                    icon: Hash,
                    color: 'bg-purple-50 text-purple-600',
                  },
                  {
                    name: 'Getting Started',
                    count: 9,
                    icon: ArrowRight,
                    color: 'bg-indigo-50 text-indigo-600',
                  },
                  { name: 'Advanced Topics', count: 7, icon: Zap, color: 'bg-red-50 text-red-600' },
                ].map((category, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${category.color}`}>
                        <category.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium">{category.name}</h4>
                        <p className="text-sm text-gray-500">{category.count} articles</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          {/* Document Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Layers className="h-5 w-5 mr-2" />
                Document Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documentTypes.map((type) => (
                  <div
                    key={type.id}
                    className="p-4 rounded-lg border hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium">{type.name}</h4>
                      <Badge variant="outline" className="capitalize">
                        {type.category}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">{type.description}</p>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span>Usage Count</span>
                        <span className="font-medium">{type.usageCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Success Rate</span>
                        <span className="font-medium">{Math.round(type.successRate * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>AI Tone</span>
                        <span className="font-medium capitalize">{type.aiTone}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Complexity</span>
                        <span className="font-medium capitalize">{type.aiComplexityLevel}</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Success Rate</span>
                        <span className="text-sm font-medium">
                          {Math.round(type.successRate * 100)}%
                        </span>
                      </div>
                      <Progress value={type.successRate * 100} className="h-2" />
                    </div>

                    <Button className="w-full">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Use Template
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Writing Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{analytics?.documentsCreated}</p>
                <p className="text-sm text-gray-600">Documents Created</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Brain className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-600">
                  {analytics?.aiSessionsConducted}
                </p>
                <p className="text-sm text-gray-600">AI Sessions</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Zap className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">
                  {Math.round((analytics?.averageAiConfidence || 0) * 100)}%
                </p>
                <p className="text-sm text-gray-600">AI Confidence</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Star className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-orange-600">
                  {analytics?.averageUserSatisfaction}
                </p>
                <p className="text-sm text-gray-600">User Satisfaction</p>
              </CardContent>
            </Card>
          </div>

          {/* Content Quality Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Content Quality Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.contentQualityTrends.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {new Date(trend.date).toLocaleDateString()}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${trend.score * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-12">
                        {Math.round(trend.score * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lightbulb className="h-5 w-5 mr-2" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics?.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <p className="text-sm">{recommendation}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIDocumentationDashboard;


