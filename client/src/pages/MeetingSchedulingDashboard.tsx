/**
 * Meeting Scheduling Dashboard
 * Intelligent meeting coordination, scheduling optimization, and analytics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Video,
  Brain,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Filter,
  Search,
  Settings,
  Zap,
  Target,
  Activity,
  BarChart3,
  PieChart,
  Timer,
  UserCheck,
  Building,
  Wifi,
  Monitor,
  Phone,
  Star,
  AlertCircle,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Copy,
  Send,
} from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  status: string;
  priority: string;
  location?: string;
  meetingUrl?: string;
  organizerName: string;
  participants: Array<{
    name: string;
    role: string;
    invitationStatus: string;
    aiAttendanceProbability: number;
  }>;
  room?: {
    name: string;
    capacity: number;
    equipment: string[];
  };
  aiSchedulingScore?: number;
  aiParticipantCompatibility?: number;
}

interface SchedulingSuggestion {
  startTime: Date;
  endTime: Date;
  confidence: number;
  participantAvailability: Record<string, number>;
  roomSuggestions: Array<{
    roomName: string;
    suitabilityScore: number;
  }>;
  optimizationFactors: {
    participantProductivity: number;
    travelTime: number;
    meetingFatigue: number;
    businessPriority: number;
  };
  reasoning: string;
}

interface MeetingRoom {
  id: string;
  name: string;
  description: string;
  location: string;
  capacity: number;
  equipment: string[];
  features: string[];
  utilizationRate: number;
  isAvailable: boolean;
  aiPopularityScore: number;
}

const MeetingSchedulingDashboard: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [schedulingRequest, setSchedulingRequest] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<SchedulingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Mock API calls - replace with actual API calls
      const mockMeetings: Meeting[] = [
        {
          id: 'meeting-1',
          title: 'Q4 Planning Session',
          description: 'Strategic planning for Q4 initiatives and goals',
          startTime: new Date('2025-09-27T10:00:00Z'),
          endTime: new Date('2025-09-27T11:30:00Z'),
          status: 'scheduled',
          priority: 'high',
          location: 'Conference Room A',
          meetingUrl: 'https://meet.company.com/q4-planning',
          organizerName: 'John Smith',
          participants: [
            {
              name: 'Sarah Johnson',
              role: 'presenter',
              invitationStatus: 'accepted',
              aiAttendanceProbability: 0.95,
            },
            {
              name: 'Mike Chen',
              role: 'attendee',
              invitationStatus: 'accepted',
              aiAttendanceProbability: 0.91,
            },
            {
              name: 'Lisa Wang',
              role: 'attendee',
              invitationStatus: 'tentative',
              aiAttendanceProbability: 0.75,
            },
          ],
          room: {
            name: 'Conference Room A',
            capacity: 12,
            equipment: ['projector', 'whiteboard', 'video_conf'],
          },
          aiSchedulingScore: 0.92,
          aiParticipantCompatibility: 0.88,
        },
        {
          id: 'meeting-2',
          title: 'Client Presentation - Global Manufacturing',
          description: 'Product demonstration and proposal presentation',
          startTime: new Date('2025-09-27T14:00:00Z'),
          endTime: new Date('2025-09-27T15:00:00Z'),
          status: 'scheduled',
          priority: 'asap',
          location: 'Conference Room A',
          meetingUrl: 'https://meet.company.com/client-demo',
          organizerName: 'Sarah Johnson',
          participants: [
            {
              name: 'Sarah Johnson',
              role: 'presenter',
              invitationStatus: 'accepted',
              aiAttendanceProbability: 0.98,
            },
            {
              name: 'Mike Chen',
              role: 'attendee',
              invitationStatus: 'accepted',
              aiAttendanceProbability: 0.94,
            },
            {
              name: 'David Thompson (Client)',
              role: 'attendee',
              invitationStatus: 'accepted',
              aiAttendanceProbability: 0.85,
            },
          ],
          room: {
            name: 'Conference Room A',
            capacity: 12,
            equipment: ['projector', 'whiteboard', 'video_conf'],
          },
          aiSchedulingScore: 0.89,
          aiParticipantCompatibility: 0.92,
        },
        {
          id: 'meeting-3',
          title: 'Daily Team Standup',
          description: 'Daily synchronization and progress update',
          startTime: new Date('2025-09-27T09:00:00Z'),
          endTime: new Date('2025-09-27T09:15:00Z'),
          status: 'scheduled',
          priority: 'medium',
          location: 'Huddle Room 1',
          organizerName: 'Alex Rodriguez',
          participants: [
            {
              name: 'Sarah Johnson',
              role: 'attendee',
              invitationStatus: 'accepted',
              aiAttendanceProbability: 0.92,
            },
            {
              name: 'Mike Chen',
              role: 'attendee',
              invitationStatus: 'accepted',
              aiAttendanceProbability: 0.89,
            },
            {
              name: 'Lisa Wang',
              role: 'attendee',
              invitationStatus: 'accepted',
              aiAttendanceProbability: 0.94,
            },
          ],
          room: {
            name: 'Huddle Room 1',
            capacity: 4,
            equipment: ['tv_display', 'conference_phone'],
          },
          aiSchedulingScore: 0.96,
          aiParticipantCompatibility: 0.94,
        },
      ];

      const mockRooms: MeetingRoom[] = [
        {
          id: 'room-1',
          name: 'Conference Room A',
          description: 'Large conference room with video conferencing',
          location: 'Floor 1, East Wing',
          capacity: 12,
          equipment: ['projector', 'whiteboard', 'conference_phone', 'video_camera'],
          features: ['video_conf', 'screen_sharing', 'wireless_presentation'],
          utilizationRate: 0.68,
          isAvailable: true,
          aiPopularityScore: 0.85,
        },
        {
          id: 'room-2',
          name: 'Conference Room B',
          description: 'Medium conference room for team meetings',
          location: 'Floor 1, West Wing',
          capacity: 8,
          equipment: ['tv_display', 'whiteboard', 'conference_phone'],
          features: ['video_conf', 'wireless_presentation'],
          utilizationRate: 0.71,
          isAvailable: false,
          aiPopularityScore: 0.72,
        },
        {
          id: 'room-3',
          name: 'Huddle Room 1',
          description: 'Small room for quick meetings and calls',
          location: 'Floor 2, North',
          capacity: 4,
          equipment: ['tv_display', 'conference_phone'],
          features: ['video_conf'],
          utilizationRate: 0.58,
          isAvailable: true,
          aiPopularityScore: 0.64,
        },
      ];

      const mockAnalytics = {
        totalMeetings: 347,
        totalMeetingHours: 521.5,
        averageMeetingDuration: 45.2,
        onTimeStartRate: 0.84,
        attendanceRate: 0.91,
        roomUtilization: 0.67,
        aiSchedulingEfficiency: 0.89,
        trends: {
          meetingFrequency: 'stable',
          averageDuration: 'decreasing',
          attendanceRate: 'improving',
        },
        recommendations: [
          'Consider shorter default meeting durations to improve efficiency',
          'Implement buffer time between meetings to improve on-time starts',
          'Use AI-suggested optimal times to increase attendance rates',
        ],
      };

      setMeetings(mockMeetings);
      setRooms(mockRooms);
      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulingRequest = async (requestData: any) => {
    try {
      // Mock scheduling request
      const mockSuggestions: SchedulingSuggestion[] = [
        {
          startTime: new Date('2025-09-28T10:00:00Z'),
          endTime: new Date('2025-09-28T11:00:00Z'),
          confidence: 0.94,
          participantAvailability: { 'user-1': 0.95, 'user-2': 0.88, 'user-3': 0.92 },
          roomSuggestions: [
            { roomName: 'Conference Room A', suitabilityScore: 0.91 },
            { roomName: 'Conference Room B', suitabilityScore: 0.85 },
          ],
          optimizationFactors: {
            participantProductivity: 0.92,
            travelTime: 0.85,
            meetingFatigue: 0.78,
            businessPriority: 0.9,
          },
          reasoning:
            'Optimal time during productivity peak with high participant availability and minimal scheduling conflicts',
        },
        {
          startTime: new Date('2025-09-28T14:30:00Z'),
          endTime: new Date('2025-09-28T15:30:00Z'),
          confidence: 0.87,
          participantAvailability: { 'user-1': 0.82, 'user-2': 0.95, 'user-3': 0.89 },
          roomSuggestions: [
            { roomName: 'Conference Room B', suitabilityScore: 0.88 },
            { roomName: 'Huddle Room 1', suitabilityScore: 0.72 },
          ],
          optimizationFactors: {
            participantProductivity: 0.85,
            travelTime: 0.9,
            meetingFatigue: 0.82,
            businessPriority: 0.85,
          },
          reasoning:
            'Good afternoon slot with balanced availability and reduced meeting fatigue risk',
        },
      ];

      setSuggestions(mockSuggestions);
      setSchedulingRequest(requestData);
    } catch (error) {
      console.error('Scheduling request failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'asap':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDuration = (startTime: Date, endTime: Date) => {
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    if (duration < 60) return `${duration}m`;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading meeting dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meeting Scheduling</h1>
          <p className="text-gray-600 mt-1">
            AI-powered meeting coordination and intelligent scheduling optimization
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Meetings</p>
                <p className="text-2xl font-bold text-blue-600">{analytics?.totalMeetings}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex items-center mt-1">
              {getTrendIcon(analytics?.trends.meetingFrequency)}
              <p className="text-xs text-gray-500 ml-1 capitalize">
                {analytics?.trends.meetingFrequency}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold text-green-600">
                  {Math.round(analytics?.averageMeetingDuration)}m
                </p>
              </div>
              <Timer className="h-8 w-8 text-green-600" />
            </div>
            <div className="flex items-center mt-1">
              {getTrendIcon(analytics?.trends.averageDuration)}
              <p className="text-xs text-gray-500 ml-1 capitalize">
                {analytics?.trends.averageDuration}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
                <p className="text-2xl font-bold text-purple-600">
                  {Math.round((analytics?.attendanceRate || 0) * 100)}%
                </p>
              </div>
              <UserCheck className="h-8 w-8 text-purple-600" />
            </div>
            <div className="flex items-center mt-1">
              {getTrendIcon(analytics?.trends.attendanceRate)}
              <p className="text-xs text-gray-500 ml-1 capitalize">
                {analytics?.trends.attendanceRate}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Efficiency</p>
                <p className="text-2xl font-bold text-orange-600">
                  {Math.round((analytics?.aiSchedulingEfficiency || 0) * 100)}%
                </p>
              </div>
              <Brain className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Scheduling optimization score</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations Alert */}
      {analytics?.recommendations && analytics.recommendations.length > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Zap className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <strong>AI Recommendation:</strong> {analytics.recommendations[0]}
            <Button variant="link" className="p-0 h-auto ml-2 text-blue-600">
              View all recommendations
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Today's Meetings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Today's Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {meetings.slice(0, 3).map((meeting) => (
                  <div
                    key={meeting.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium">{meeting.title}</h4>
                        <Badge className={getStatusColor(meeting.status)}>{meeting.status}</Badge>
                        <Badge className={getPriorityColor(meeting.priority)}>
                          {meeting.priority}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {meeting.startTime.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          -
                          {meeting.endTime.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          <span className="ml-1">
                            ({formatDuration(meeting.startTime, meeting.endTime)})
                          </span>
                        </div>
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {meeting.room?.name || meeting.location}
                        </div>
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {meeting.participants.length} participants
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {meeting.aiSchedulingScore && (
                        <div className="text-center">
                          <div className="flex items-center space-x-1">
                            <Brain className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-medium">
                              {Math.round(meeting.aiSchedulingScore * 100)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">AI Score</p>
                        </div>
                      )}
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Room Utilization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="h-5 w-5 mr-2" />
                  Room Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rooms.map((room) => (
                    <div key={room.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-3 h-3 rounded-full ${room.isAvailable ? 'bg-green-500' : 'bg-red-500'}`}
                          />
                          <span className="font-medium">{room.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {room.capacity} seats
                          </Badge>
                        </div>
                        <span className="text-sm font-medium">
                          {Math.round(room.utilizationRate * 100)}%
                        </span>
                      </div>
                      <Progress value={room.utilizationRate * 100} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{room.location}</span>
                        <span>AI Score: {Math.round(room.aiPopularityScore * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Meeting Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {Math.round(analytics?.onTimeStartRate * 100)}%
                      </p>
                      <p className="text-sm text-gray-600">On-Time Starts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {Math.round(analytics?.roomUtilization * 100)}%
                      </p>
                      <p className="text-sm text-gray-600">Room Utilization</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Meeting Distribution</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Team Meetings</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: '45%' }}
                            ></div>
                          </div>
                          <span className="text-sm">45%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Client Meetings</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: '30%' }}
                            ></div>
                          </div>
                          <span className="text-sm">30%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Training</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{ width: '25%' }}
                            ></div>
                          </div>
                          <span className="text-sm">25%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="meetings" className="space-y-6">
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <Card key={meeting.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-semibold">{meeting.title}</h3>
                        <Badge className={getStatusColor(meeting.status)}>{meeting.status}</Badge>
                        <Badge className={getPriorityColor(meeting.priority)}>
                          {meeting.priority}
                        </Badge>
                      </div>

                      <p className="text-gray-600 mb-4">{meeting.description}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Time</p>
                          <p className="font-medium">{meeting.startTime.toLocaleString()}</p>
                          <p className="text-sm text-gray-500">
                            {formatDuration(meeting.startTime, meeting.endTime)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Location</p>
                          <p className="font-medium">{meeting.room?.name || meeting.location}</p>
                          {meeting.room && (
                            <p className="text-sm text-gray-500">
                              Capacity: {meeting.room.capacity}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Organizer</p>
                          <p className="font-medium">{meeting.organizerName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Participants</p>
                          <p className="font-medium">{meeting.participants.length} attendees</p>
                          <p className="text-sm text-gray-500">
                            {Math.round(
                              (meeting.participants.reduce(
                                (sum, p) => sum + p.aiAttendanceProbability,
                                0,
                              ) /
                                meeting.participants.length) *
                                100,
                            )}
                            % expected attendance
                          </p>
                        </div>
                      </div>

                      {/* Participants */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Participants</h4>
                        <div className="flex flex-wrap gap-2">
                          {meeting.participants.map((participant, index) => (
                            <div
                              key={index}
                              className="flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-1"
                            >
                              <span className="text-sm">{participant.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {participant.role}
                              </Badge>
                              <div className="flex items-center space-x-1">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    participant.invitationStatus === 'accepted'
                                      ? 'bg-green-500'
                                      : participant.invitationStatus === 'tentative'
                                        ? 'bg-yellow-500'
                                        : participant.invitationStatus === 'declined'
                                          ? 'bg-red-500'
                                          : 'bg-gray-500'
                                  }`}
                                />
                                <span className="text-xs text-gray-500">
                                  {Math.round(participant.aiAttendanceProbability * 100)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {meeting.aiSchedulingScore && (
                        <div className="text-right text-sm">
                          <div className="flex items-center space-x-1 mb-1">
                            <Brain className="h-3 w-3 text-purple-500" />
                            <span className="text-gray-500">AI Score:</span>
                            <span className="font-medium">
                              {Math.round(meeting.aiSchedulingScore * 100)}%
                            </span>
                          </div>
                          {meeting.aiParticipantCompatibility && (
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3 text-blue-500" />
                              <span className="text-gray-500">Compatibility:</span>
                              <span className="font-medium">
                                {Math.round(meeting.aiParticipantCompatibility * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex flex-col space-y-1">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <Card key={room.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{room.name}</CardTitle>
                    <div
                      className={`w-3 h-3 rounded-full ${room.isAvailable ? 'bg-green-500' : 'bg-red-500'}`}
                    />
                  </div>
                  <CardDescription>{room.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{room.capacity}</p>
                      <p className="text-sm text-gray-600">Capacity</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {Math.round(room.utilizationRate * 100)}%
                      </p>
                      <p className="text-sm text-gray-600">Utilization</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Equipment</p>
                    <div className="flex flex-wrap gap-1">
                      {room.equipment.map((item, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {item.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Features</p>
                    <div className="flex flex-wrap gap-1">
                      {room.features.map((feature, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {feature.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">AI Popularity</span>
                      <span className="text-sm font-medium">
                        {Math.round(room.aiPopularityScore * 100)}%
                      </span>
                    </div>
                    <Progress value={room.aiPopularityScore * 100} className="h-2" />
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-sm text-gray-600">{room.location}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Status: {room.isAvailable ? 'Available' : 'In Use'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Analytics Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Meeting Efficiency Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {Math.round(analytics?.onTimeStartRate * 100)}%
                    </p>
                    <p className="text-sm text-gray-600">On-Time Starts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {Math.round(analytics?.attendanceRate * 100)}%
                    </p>
                    <p className="text-sm text-gray-600">Attendance Rate</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Meeting Duration Optimization</span>
                    <span className="text-sm font-medium">87%</span>
                  </div>
                  <Progress value={87} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Room Utilization Efficiency</span>
                    <span className="text-sm font-medium">
                      {Math.round(analytics?.roomUtilization * 100)}%
                    </span>
                  </div>
                  <Progress value={analytics?.roomUtilization * 100} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">AI Scheduling Accuracy</span>
                    <span className="text-sm font-medium">
                      {Math.round(analytics?.aiSchedulingEfficiency * 100)}%
                    </span>
                  </div>
                  <Progress value={analytics?.aiSchedulingEfficiency * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="h-5 w-5 mr-2" />
                  AI Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.recommendations?.map((recommendation: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-start space-x-3 p-3 rounded-lg bg-blue-50"
                    >
                      <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5" />
                      <p className="text-sm">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MeetingSchedulingDashboard;
