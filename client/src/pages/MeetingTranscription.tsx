/**
 * Meeting Transcription Dashboard
 * AI-powered meeting recording, transcription, and intelligent note generation
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
import { MainLayout } from '@/components/layout/main-layout';
import {
  Video,
  Mic,
  Play,
  Pause,
  Square,
  Upload,
  Download,
  FileText,
  Brain,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Settings,
  Zap,
  TrendingUp,
  BarChart3,
  Search,
  Filter,
  Star,
  MessageSquare,
  Calendar,
  Eye,
  Edit,
  Trash2,
  Share,
  Copy,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface MeetingRecording {
  id: string;
  title: string;
  duration: string;
  participants: number;
  date: string;
  status: 'processing' | 'completed' | 'failed';
  transcriptionProgress: number;
  aiConfidence: number;
  highlights: number;
  actionItems: number;
}

interface TranscriptionSegment {
  id: string;
  speaker: string;
  timestamp: string;
  content: string;
  confidence: number;
  isHighlight: boolean;
}

interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
}

export default function MeetingTranscription() {
  const [activeTab, setActiveTab] = useState('recordings');
  const [isRecording, setIsRecording] = useState(false);
  const [recordings] = useState<MeetingRecording[]>([
    {
      id: '1',
      title: 'Sales Team Weekly Standup',
      duration: '45:32',
      participants: 8,
      date: '2025-01-15',
      status: 'completed',
      transcriptionProgress: 100,
      aiConfidence: 94,
      highlights: 12,
      actionItems: 6,
    },
    {
      id: '2',
      title: 'Customer Onboarding Review',
      duration: '32:18',
      participants: 5,
      date: '2025-01-14',
      status: 'processing',
      transcriptionProgress: 78,
      aiConfidence: 0,
      highlights: 0,
      actionItems: 0,
    },
    {
      id: '3',
      title: 'Product Strategy Session',
      duration: '1:23:45',
      participants: 12,
      date: '2025-01-12',
      status: 'completed',
      aiConfidence: 91,
      transcriptionProgress: 100,
      highlights: 18,
      actionItems: 9,
    },
  ]);

  const [transcriptionSegments] = useState<TranscriptionSegment[]>([
    {
      id: '1',
      speaker: 'John Smith',
      timestamp: '00:02:15',
      content:
        'We need to prioritize the Q1 sales targets and ensure our team has the right resources.',
      confidence: 96,
      isHighlight: true,
    },
    {
      id: '2',
      speaker: 'Sarah Johnson',
      timestamp: '00:03:42',
      content:
        'I agree. The current lead conversion rate is at 23%, which is below our target of 30%.',
      confidence: 94,
      isHighlight: false,
    },
    {
      id: '3',
      speaker: 'Mike Davis',
      timestamp: '00:05:18',
      content: 'We should implement the new CRM workflow by next week to improve tracking.',
      confidence: 92,
      isHighlight: true,
    },
  ]);

  const [actionItems] = useState<ActionItem[]>([
    {
      id: '1',
      task: 'Implement new CRM workflow',
      assignee: 'Mike Davis',
      dueDate: '2025-01-22',
      priority: 'high',
      status: 'pending',
    },
    {
      id: '2',
      task: 'Review Q1 sales targets',
      assignee: 'John Smith',
      dueDate: '2025-01-18',
      priority: 'medium',
      status: 'in_progress',
    },
    {
      id: '3',
      task: 'Analyze lead conversion metrics',
      assignee: 'Sarah Johnson',
      dueDate: '2025-01-20',
      priority: 'high',
      status: 'pending',
    },
  ]);

  const [stats] = useState({
    totalRecordings: 47,
    hoursTranscribed: 156.5,
    aiAccuracy: 93,
    actionItemsGenerated: 234,
    timesSaved: 78,
    participantsTracked: 156,
  });

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800">Low</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <MainLayout
      title="Meeting Transcription"
      description="AI-powered meeting recording, transcription, and intelligent note generation"
    >
      {/* Action buttons */}
      <div className="flex justify-end gap-3 mb-6">
        <Button
          onClick={toggleRecording}
          className={`flex items-center gap-2 ${
            isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isRecording ? (
            <>
              <Square className="h-4 w-4" />
              Stop Recording
            </>
          ) : (
            <>
              <Video className="h-4 w-4" />
              Start Recording
            </>
          )}
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload Recording
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Video className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRecordings}</p>
                <p className="text-sm text-gray-600">Total Recordings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.hoursTranscribed}h</p>
                <p className="text-sm text-gray-600">Hours Transcribed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Brain className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.aiAccuracy}%</p>
                <p className="text-sm text-gray-600">AI Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.actionItemsGenerated}</p>
                <p className="text-sm text-gray-600">Action Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Zap className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.timesSaved}h</p>
                <p className="text-sm text-gray-600">Time Saved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-100 rounded-lg">
                <Users className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.participantsTracked}</p>
                <p className="text-sm text-gray-600">Participants</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recordings">Recordings</TabsTrigger>
          <TabsTrigger value="transcription">Live Transcription</TabsTrigger>
          <TabsTrigger value="highlights">Meeting Highlights</TabsTrigger>
          <TabsTrigger value="action-items">Action Items</TabsTrigger>
        </TabsList>

        {/* Recordings Tab */}
        <TabsContent value="recordings" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Meeting Recordings</CardTitle>
                  <CardDescription>
                    Manage and review your meeting recordings with AI analysis
                  </CardDescription>
                </div>
                <div className="flex gap-3">
                  <Input placeholder="Search recordings..." className="w-64" />
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recordings.map((recording) => (
                  <div
                    key={recording.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Video className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{recording.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {recording.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {recording.participants} participants
                          </span>
                          <span>{recording.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        {recording.status === 'completed' && (
                          <>
                            <p className="text-gray-600">{recording.highlights} highlights</p>
                            <p className="text-gray-600">{recording.actionItems} action items</p>
                          </>
                        )}
                        {recording.status === 'processing' && (
                          <div className="space-y-1">
                            <p className="text-gray-600">Processing...</p>
                            <Progress value={recording.transcriptionProgress} className="w-24" />
                          </div>
                        )}
                      </div>
                      {getStatusBadge(recording.status)}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Share className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Transcription Tab */}
        <TabsContent value="transcription" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Live Transcription</CardTitle>
              <CardDescription>
                Real-time meeting transcription with speaker identification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">
                      Live Recording - Sales Team Weekly Standup
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">45:32</span>
                    <Button variant="outline" size="sm">
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Square className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {transcriptionSegments.map((segment) => (
                    <div
                      key={segment.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        segment.isHighlight
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">{segment.speaker}</span>
                          <span className="text-sm text-gray-500">{segment.timestamp}</span>
                          {segment.isHighlight && (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Star className="h-3 w-3 mr-1" />
                              Highlight
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {segment.confidence}% confidence
                          </span>
                          <Button variant="ghost" size="sm">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-gray-700">{segment.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meeting Highlights Tab */}
        <TabsContent value="highlights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Highlights</CardTitle>
              <CardDescription>
                AI-identified key moments and important discussion points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transcriptionSegments
                  .filter((s) => s.isHighlight)
                  .map((highlight) => (
                    <div key={highlight.id} className="p-4 border rounded-lg bg-yellow-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Star className="h-5 w-5 text-yellow-600" />
                          <span className="font-semibold text-gray-900">{highlight.speaker}</span>
                          <span className="text-sm text-gray-500">{highlight.timestamp}</span>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">High Priority</Badge>
                      </div>
                      <p className="text-gray-700 mb-3">{highlight.content}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <MessageSquare className="h-4 w-4" />
                          Add Note
                        </Button>
                        <Button variant="outline" size="sm">
                          <CheckCircle className="h-4 w-4" />
                          Create Action
                        </Button>
                        <Button variant="outline" size="sm">
                          <Share className="h-4 w-4" />
                          Share
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Action Items Tab */}
        <TabsContent value="action-items" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Action Items</CardTitle>
                  <CardDescription>
                    AI-generated action items from meeting discussions
                  </CardDescription>
                </div>
                <Button className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Create Action Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {actionItems.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-gray-900">{item.task}</span>
                        {getPriorityBadge(item.priority)}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {item.assignee}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Due: {item.dueDate}
                      </span>
                      <Badge
                        className={
                          item.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {item.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
