/**
 * Meeting Transcription Dashboard
 * AI-powered meeting recording, transcription, and intelligent note generation interface
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Mic,
  FileAudio,
  Video,
  Brain,
  FileText,
  Sparkles,
  Clock,
  Users,
  Search,
  Download,
  Upload,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronDown,
  Eye,
  Edit,
  Share,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Star,
  Filter,
  Calendar,
  BarChart3,
  TrendingUp,
  MessageSquare,
  Target,
  Lightbulb,
  AlertCircle,
  User,
  Timer,
  Zap,
  BookOpen,
  Hash,
  Tag,
} from 'lucide-react';

interface Recording {
  id: string;
  meetingId: string;
  recordingName: string;
  recordingUrl?: string;
  recordingFormat: string;
  fileSizeBytes: number;
  durationSeconds: number;
  recordingSource: string;
  audioQuality: string;
  videoQuality?: string;
  processingStatus: string;
  transcriptionStatus: string;
  aiAnalysisStatus: string;
  aiConfidenceScore?: number;
  aiSpeakerCount?: number;
  uploadedBy: string;
  uploadedAt: Date;
  processingCompletedAt?: Date;
}

interface Transcription {
  id: string;
  fullTranscript: string;
  transcriptSegments: Array<{
    id: string;
    startTime: number;
    endTime: number;
    speakerName: string;
    text: string;
    confidence: number;
  }>;
  overallConfidence: number;
  wordCount: number;
  speakerCount: number;
  speakers: Array<{
    name: string;
    speakingTimeSeconds: number;
    wordCount: number;
    averageConfidence: number;
  }>;
}

interface MeetingNotes {
  id: string;
  title: string;
  executiveSummary: string;
  keyPoints: Array<{
    point: string;
    importance: number;
    speakers: string[];
    timestamp?: number;
  }>;
  decisionsMade: Array<{
    decision: string;
    context: string;
    decisionMaker: string;
    impact: string;
  }>;
  actionItems: Array<{
    task: string;
    assignee?: string;
    dueDate?: Date;
    priority: string;
    status: string;
  }>;
  meetingSentiment: string;
  engagementLevel: string;
  productivityScore: number;
  topicsDiscussed: string[];
  aiInsights: string[];
  aiRecommendations: string[];
  aiRiskFlags: string[];
  aiOpportunities: string[];
  aiConfidenceScore: number;
}

interface Highlight {
  id: string;
  highlightType: string;
  title: string;
  description: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  transcriptExcerpt: string;
  speakers: string[];
  importanceScore: number;
  sentiment: string;
  tags: string[];
  businessImpact: string;
  requiresAction: boolean;
}

const MeetingTranscriptionDashboard: React.FC = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [notes, setNotes] = useState<MeetingNotes | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Mock data loading - replace with actual API calls
      const mockRecordings: Recording[] = [
        {
          id: 'recording-1',
          meetingId: 'meeting-1',
          recordingName: 'Q4 Planning Session Recording',
          recordingUrl: 'https://storage.company.com/recordings/meeting-1/recording.mp4',
          recordingFormat: 'mp4',
          fileSizeBytes: 157286400,
          durationSeconds: 3720,
          recordingSource: 'zoom',
          audioQuality: 'excellent',
          videoQuality: 'hd',
          processingStatus: 'completed',
          transcriptionStatus: 'completed',
          aiAnalysisStatus: 'completed',
          aiConfidenceScore: 0.92,
          aiSpeakerCount: 4,
          uploadedBy: 'user-manager-1',
          uploadedAt: new Date('2025-09-27T10:00:00Z'),
          processingCompletedAt: new Date('2025-09-27T10:05:30Z'),
        },
        {
          id: 'recording-2',
          meetingId: 'meeting-2',
          recordingName: 'Client Presentation Recording',
          recordingUrl: 'https://storage.company.com/recordings/meeting-2/recording.mp4',
          recordingFormat: 'mp4',
          fileSizeBytes: 98304000,
          durationSeconds: 2400,
          recordingSource: 'teams',
          audioQuality: 'good',
          videoQuality: 'standard',
          processingStatus: 'processing',
          transcriptionStatus: 'processing',
          aiAnalysisStatus: 'pending',
          uploadedBy: 'user-sales-1',
          uploadedAt: new Date('2025-09-27T14:00:00Z'),
        },
      ];

      const mockAnalytics = {
        totalMeetingsRecorded: 89,
        totalRecordingHours: 267.5,
        averageTranscriptionConfidence: 0.91,
        averageProcessingTime: 42,
        mostDiscussedTopics: [
          { topic: 'Q4 Planning', frequency: 34, trend: 'increasing' },
          { topic: 'Client Strategy', frequency: 28, trend: 'stable' },
          { topic: 'Budget Allocation', frequency: 22, trend: 'increasing' },
        ],
        contentQualityMetrics: {
          transcriptionAccuracy: 0.91,
          aiConfidenceScore: 0.88,
          completionRate: 0.94,
        },
        actionItemMetrics: {
          totalGenerated: 156,
          completionRate: 0.78,
          averageTimeToComplete: 4.2,
        },
      };

      setRecordings(mockRecordings);
      setAnalytics(mockAnalytics);

      // Load details for first recording
      if (mockRecordings.length > 0 && mockRecordings[0].processingStatus === 'completed') {
        await loadRecordingDetails(mockRecordings[0].id);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecordingDetails = async (recordingId: string) => {
    try {
      // Mock transcription
      const mockTranscription: Transcription = {
        id: 'transcription-1',
        fullTranscript: `John Smith: Good morning everyone, thank you for joining today's Q4 planning session. Let's start by reviewing our Q3 performance.

Sarah Johnson: Thank you, John. Our Q3 results exceeded expectations with a 23% increase in revenue compared to Q2. The new client acquisition strategy has been particularly effective.

Mike Chen: That's excellent news, Sarah. I'd like to discuss how we can scale this success into Q4. We should consider increasing our marketing budget by 15% to capitalize on this momentum.

John Smith: Great point, Mike. Let's also look at our resource allocation. We'll need to hire 3 additional sales representatives to handle the increased demand.`,
        transcriptSegments: [
          {
            id: 'seg-1',
            startTime: 0,
            endTime: 15,
            speakerName: 'John Smith',
            text: "Good morning everyone, thank you for joining today's Q4 planning session. Let's start by reviewing our Q3 performance.",
            confidence: 0.95,
          },
          {
            id: 'seg-2',
            startTime: 15,
            endTime: 32,
            speakerName: 'Sarah Johnson',
            text: 'Thank you, John. Our Q3 results exceeded expectations with a 23% increase in revenue compared to Q2. The new client acquisition strategy has been particularly effective.',
            confidence: 0.92,
          },
        ],
        overallConfidence: 0.925,
        wordCount: 486,
        speakerCount: 4,
        speakers: [
          { name: 'John Smith', speakingTimeSeconds: 85, wordCount: 142, averageConfidence: 0.945 },
          {
            name: 'Sarah Johnson',
            speakingTimeSeconds: 78,
            wordCount: 128,
            averageConfidence: 0.92,
          },
          { name: 'Mike Chen', speakingTimeSeconds: 72, wordCount: 115, averageConfidence: 0.89 },
          { name: 'Lisa Wang', speakingTimeSeconds: 65, wordCount: 101, averageConfidence: 0.91 },
        ],
      };

      // Mock notes
      const mockNotes: MeetingNotes = {
        id: 'notes-1',
        title: 'Q4 Planning Session - Meeting Notes',
        executiveSummary:
          'The Q4 planning session focused on building upon strong Q3 performance with a 23% revenue increase. Key decisions included a 15% marketing budget increase, hiring 3 additional sales representatives, and implementing a dedicated account management program for top-tier clients.',
        keyPoints: [
          {
            point: 'Q3 revenue exceeded expectations with 23% increase over Q2',
            importance: 0.95,
            speakers: ['Sarah Johnson'],
            timestamp: 18,
          },
          {
            point: 'Marketing budget increase of 15% proposed for Q4',
            importance: 0.92,
            speakers: ['Mike Chen'],
            timestamp: 38,
          },
        ],
        decisionsMade: [
          {
            decision: 'Approve 15% increase in marketing budget for Q4',
            context: 'To capitalize on Q3 momentum',
            decisionMaker: 'John Smith',
            impact: 'high',
          },
        ],
        actionItems: [
          {
            task: 'Prepare detailed budget proposal for 15% marketing increase',
            assignee: 'Mike Chen',
            dueDate: new Date('2025-10-05'),
            priority: 'high',
            status: 'open',
          },
          {
            task: 'Begin recruitment process for 3 sales representatives',
            assignee: 'Sarah Johnson',
            dueDate: new Date('2025-10-10'),
            priority: 'high',
            status: 'open',
          },
        ],
        meetingSentiment: 'positive',
        engagementLevel: 'high',
        productivityScore: 0.91,
        topicsDiscussed: [
          'Q3 Performance Review',
          'Q4 Strategic Planning',
          'Budget Allocation',
          'Team Expansion',
        ],
        aiInsights: [
          'Strong team alignment on growth strategy',
          'Q3 performance momentum creates excellent foundation',
        ],
        aiRecommendations: [
          'Schedule weekly check-ins during Q4 ramp-up',
          'Consider establishing Q4 success metrics',
        ],
        aiRiskFlags: ['Aggressive hiring timeline may impact onboarding quality'],
        aiOpportunities: ['Q3 success demonstrates scalable business model'],
        aiConfidenceScore: 0.91,
      };

      // Mock highlights
      const mockHighlights: Highlight[] = [
        {
          id: 'highlight-1',
          highlightType: 'key_point',
          title: 'Q3 Revenue Growth Announcement',
          description: '23% revenue increase over Q2 - exceeded all expectations',
          startTimeSeconds: 18,
          endTimeSeconds: 32,
          transcriptExcerpt:
            'Our Q3 results exceeded expectations with a 23% increase in revenue compared to Q2.',
          speakers: ['Sarah Johnson'],
          importanceScore: 0.95,
          sentiment: 'positive',
          tags: ['Q3', 'revenue', 'growth'],
          businessImpact: 'high',
          requiresAction: false,
        },
        {
          id: 'highlight-2',
          highlightType: 'decision',
          title: 'Marketing Budget Increase Approved',
          description: '15% marketing budget increase approved to capitalize on momentum',
          startTimeSeconds: 35,
          endTimeSeconds: 48,
          transcriptExcerpt:
            'We should consider increasing our marketing budget by 15% to capitalize on this momentum.',
          speakers: ['Mike Chen'],
          importanceScore: 0.92,
          sentiment: 'positive',
          tags: ['marketing', 'budget', 'Q4'],
          businessImpact: 'high',
          requiresAction: true,
        },
      ];

      setTranscription(mockTranscription);
      setNotes(mockNotes);
      setHighlights(mockHighlights);
      setSelectedRecording(recordings.find((r) => r.id === recordingId) || null);
    } catch (error) {
      console.error('Failed to load recording details:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      // Mock search results
      const mockResults = [
        {
          meetingId: 'meeting-1',
          meetingTitle: 'Q4 Planning Session',
          contentType: 'transcription',
          excerpt:
            'Our Q3 results exceeded expectations with a 23% increase in revenue compared to Q2.',
          relevanceScore: 0.92,
          timestamp: 15,
          speakers: ['Sarah Johnson'],
          highlights: ['Q3 results', 'revenue increase'],
        },
      ];

      setSearchResults(mockResults);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const toggleSegmentExpansion = (segmentId: string) => {
    const newExpanded = new Set(expandedSegments);
    if (newExpanded.has(segmentId)) {
      newExpanded.delete(segmentId);
    } else {
      newExpanded.add(segmentId);
    }
    setExpandedSegments(newExpanded);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getHighlightIcon = (type: string) => {
    switch (type) {
      case 'decision':
        return <Target className="h-4 w-4" />;
      case 'action_item':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'key_point':
        return <Star className="h-4 w-4" />;
      case 'opportunity':
        return <Lightbulb className="h-4 w-4" />;
      case 'concern':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading transcription dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meeting Transcription</h1>
          <p className="text-gray-600 mt-1">
            AI-powered meeting recording, transcription, and intelligent note generation
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Upload Recording
          </Button>
          <Button>
            <Mic className="h-4 w-4 mr-2" />
            Start Recording
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recordings</p>
                <p className="text-2xl font-bold text-blue-600">
                  {analytics?.totalMeetingsRecorded}
                </p>
              </div>
              <FileAudio className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round(analytics?.totalRecordingHours)} hours total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Accuracy</p>
                <p className="text-2xl font-bold text-green-600">
                  {Math.round((analytics?.averageTranscriptionConfidence || 0) * 100)}%
                </p>
              </div>
              <Brain className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Transcription confidence</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processing Time</p>
                <p className="text-2xl font-bold text-purple-600">
                  {analytics?.averageProcessingTime}s
                </p>
              </div>
              <Timer className="h-8 w-8 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Average per recording</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Action Items</p>
                <p className="text-2xl font-bold text-orange-600">
                  {analytics?.actionItemMetrics?.totalGenerated}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round((analytics?.actionItemMetrics?.completionRate || 0) * 100)}% completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recordings">Recordings</TabsTrigger>
          <TabsTrigger value="transcription">Transcription</TabsTrigger>
          <TabsTrigger value="notes">AI Notes</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Recent Recordings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileAudio className="h-5 w-5 mr-2" />
                Recent Recordings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recordings.slice(0, 3).map((recording) => (
                  <div
                    key={recording.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium">{recording.recordingName}</h4>
                        <Badge className={getStatusColor(recording.processingStatus)}>
                          {recording.processingStatus}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {recording.recordingSource}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatDuration(recording.durationSeconds)}
                        </div>
                        <div className="flex items-center">
                          <FileAudio className="h-4 w-4 mr-1" />
                          {formatFileSize(recording.fileSizeBytes)}
                        </div>
                        {recording.aiSpeakerCount && (
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {recording.aiSpeakerCount} speakers
                          </div>
                        )}
                        {recording.aiConfidenceScore && (
                          <div className="flex items-center">
                            <Brain className="h-4 w-4 mr-1" />
                            {Math.round(recording.aiConfidenceScore * 100)}% confidence
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadRecordingDetails(recording.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Analytics Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Content Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {Math.round(analytics?.contentQualityMetrics?.transcriptionAccuracy * 100)}%
                    </p>
                    <p className="text-sm text-gray-600">Transcription Accuracy</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {Math.round(analytics?.contentQualityMetrics?.completionRate * 100)}%
                    </p>
                    <p className="text-sm text-gray-600">Completion Rate</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">AI Confidence Score</span>
                    <span className="text-sm font-medium">
                      {Math.round(analytics?.contentQualityMetrics?.aiConfidenceScore * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={analytics?.contentQualityMetrics?.aiConfidenceScore * 100}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Hash className="h-5 w-5 mr-2" />
                  Popular Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.mostDiscussedTopics?.map((topic: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Tag className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">{topic.topic}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{topic.frequency}</span>
                        {topic.trend === 'increasing' && (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recordings" className="space-y-6">
          <div className="space-y-4">
            {recordings.map((recording) => (
              <Card key={recording.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-semibold">{recording.recordingName}</h3>
                        <Badge className={getStatusColor(recording.processingStatus)}>
                          {recording.processingStatus}
                        </Badge>
                        <Badge className={getStatusColor(recording.transcriptionStatus)}>
                          transcription: {recording.transcriptionStatus}
                        </Badge>
                        <Badge className={getStatusColor(recording.aiAnalysisStatus)}>
                          AI: {recording.aiAnalysisStatus}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Duration</p>
                          <p className="font-medium">{formatDuration(recording.durationSeconds)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">File Size</p>
                          <p className="font-medium">{formatFileSize(recording.fileSizeBytes)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Quality</p>
                          <p className="font-medium capitalize">
                            {recording.audioQuality} / {recording.videoQuality}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Source</p>
                          <p className="font-medium capitalize">
                            {recording.recordingSource.replace('_', ' ')}
                          </p>
                        </div>
                      </div>

                      {recording.aiConfidenceScore && (
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">AI Processing Confidence</span>
                            <span className="text-sm font-medium">
                              {Math.round(recording.aiConfidenceScore * 100)}%
                            </span>
                          </div>
                          <Progress value={recording.aiConfidenceScore * 100} className="h-2" />
                        </div>
                      )}

                      <div className="flex items-center text-sm text-gray-600 space-x-4">
                        <span>Uploaded: {recording.uploadedAt.toLocaleDateString()}</span>
                        {recording.processingCompletedAt && (
                          <span>
                            Processed: {recording.processingCompletedAt.toLocaleDateString()}
                          </span>
                        )}
                        {recording.aiSpeakerCount && (
                          <span>{recording.aiSpeakerCount} speakers detected</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadRecordingDetails(recording.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Play className="h-4 w-4" />
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

        <TabsContent value="transcription" className="space-y-6">
          {transcription ? (
            <>
              {/* Transcription Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Meeting Transcription
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{transcription.wordCount}</p>
                      <p className="text-sm text-gray-600">Total Words</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {transcription.speakerCount}
                      </p>
                      <p className="text-sm text-gray-600">Speakers</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {Math.round(transcription.overallConfidence * 100)}%
                      </p>
                      <p className="text-sm text-gray-600">Confidence</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        {transcription.transcriptSegments.length}
                      </p>
                      <p className="text-sm text-gray-600">Segments</p>
                    </div>
                  </div>

                  {/* Speaker Analysis */}
                  <div>
                    <h4 className="font-medium mb-3">Speaker Analysis</h4>
                    <div className="space-y-2">
                      {transcription.speakers.map((speaker, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                        >
                          <div className="flex items-center space-x-3">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">{speaker.name}</span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>{formatDuration(speaker.speakingTimeSeconds)}</span>
                            <span>{speaker.wordCount} words</span>
                            <span>{Math.round(speaker.averageConfidence * 100)}% confidence</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transcript Segments */}
              <Card>
                <CardHeader>
                  <CardTitle>Transcript Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transcription.transcriptSegments.map((segment) => (
                      <div key={segment.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSegmentExpansion(segment.id)}
                            >
                              {expandedSegments.has(segment.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <span className="font-medium">{segment.speakerName}</span>
                            <Badge variant="outline" className="text-xs">
                              {formatDuration(segment.startTime)} -{' '}
                              {formatDuration(segment.endTime)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(segment.confidence * 100)}% confidence
                            </Badge>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="pl-8">
                          <p className="text-gray-700">{segment.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Transcription Available
                </h3>
                <p className="text-gray-500">
                  Select a completed recording to view its transcription.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          {notes ? (
            <>
              {/* Meeting Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <BookOpen className="h-5 w-5 mr-2" />
                      {notes.title}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        AI Confidence: {Math.round(notes.aiConfidenceScore * 100)}%
                      </Badge>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Executive Summary */}
                  <div>
                    <h4 className="font-medium mb-2">Executive Summary</h4>
                    <p className="text-gray-700 leading-relaxed">{notes.executiveSummary}</p>
                  </div>

                  {/* Meeting Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-gray-50">
                      <p className="text-2xl font-bold text-green-600 capitalize">
                        {notes.meetingSentiment}
                      </p>
                      <p className="text-sm text-gray-600">Sentiment</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-50">
                      <p className="text-2xl font-bold text-blue-600 capitalize">
                        {notes.engagementLevel}
                      </p>
                      <p className="text-sm text-gray-600">Engagement</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-50">
                      <p className="text-2xl font-bold text-purple-600">
                        {Math.round(notes.productivityScore * 100)}%
                      </p>
                      <p className="text-sm text-gray-600">Productivity</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Structured Content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Key Points */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Star className="h-5 w-5 mr-2" />
                      Key Points ({notes.keyPoints.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {notes.keyPoints.map((point, index) => (
                        <div key={index} className="p-3 rounded-lg border">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-medium flex-1">{point.point}</p>
                            <Badge variant="outline" className="ml-2">
                              {Math.round(point.importance * 100)}%
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <Users className="h-3 w-3" />
                            <span>{point.speakers.join(', ')}</span>
                            {point.timestamp && (
                              <>
                                <Clock className="h-3 w-3 ml-2" />
                                <span>{formatDuration(point.timestamp)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Action Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Action Items ({notes.actionItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {notes.actionItems.map((item, index) => (
                        <div key={index} className="p-3 rounded-lg border">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-medium flex-1">{item.task}</p>
                            <Badge
                              className={
                                item.priority === 'high'
                                  ? 'bg-red-100 text-red-800'
                                  : item.priority === 'medium'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                              }
                            >
                              {item.priority}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <div className="flex items-center space-x-2">
                              {item.assignee && (
                                <>
                                  <User className="h-3 w-3" />
                                  <span>{item.assignee}</span>
                                </>
                              )}
                            </div>
                            {item.dueDate && (
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>{item.dueDate.toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Insights */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Brain className="h-5 w-5 mr-2" />
                      AI Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {notes.aiInsights.map((insight, index) => (
                        <div
                          key={index}
                          className="flex items-start space-x-3 p-3 rounded-lg bg-blue-50"
                        >
                          <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
                          <p className="text-sm">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Lightbulb className="h-5 w-5 mr-2" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {notes.aiRecommendations.map((rec, index) => (
                        <div
                          key={index}
                          className="flex items-start space-x-3 p-3 rounded-lg bg-green-50"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Flags and Opportunities */}
              {(notes.aiRiskFlags.length > 0 || notes.aiOpportunities.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {notes.aiRiskFlags.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                          Risk Flags
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {notes.aiRiskFlags.map((risk, index) => (
                            <div
                              key={index}
                              className="flex items-start space-x-3 p-3 rounded-lg bg-orange-50"
                            >
                              <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                              <p className="text-sm">{risk}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {notes.aiOpportunities.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Target className="h-5 w-5 mr-2 text-green-500" />
                          Opportunities
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {notes.aiOpportunities.map((opp, index) => (
                            <div
                              key={index}
                              className="flex items-start space-x-3 p-3 rounded-lg bg-green-50"
                            >
                              <Lightbulb className="h-4 w-4 text-green-600 mt-0.5" />
                              <p className="text-sm">{opp}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Meeting Notes Available
                </h3>
                <p className="text-gray-500">
                  Select a completed recording to view AI-generated notes.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          {/* Search Interface */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Search className="h-5 w-5 mr-2" />
                Search Meeting Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <Input
                  placeholder="Search transcriptions, notes, and highlights..."
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

          {/* Search Results */}
          {searchResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Search Results ({searchResults.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {searchResults.map((result, index) => (
                    <div key={index} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium">{result.meetingTitle}</h4>
                          <Badge variant="outline" className="text-xs">
                            {result.contentType}
                          </Badge>
                        </div>
                        <Badge variant="outline">
                          {Math.round(result.relevanceScore * 100)}% match
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{result.excerpt}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        {result.speakers && (
                          <div className="flex items-center space-x-1">
                            <Users className="h-3 w-3" />
                            <span>{result.speakers.join(', ')}</span>
                          </div>
                        )}
                        {result.timestamp && (
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDuration(result.timestamp)}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-1">
                          <Tag className="h-3 w-3" />
                          <span>{result.highlights.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MeetingTranscriptionDashboard;
