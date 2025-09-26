/**
 * AI Task Scheduling Dashboard
 * Enhanced AI task scheduling and dependency management with intelligent automation
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
  Brain,
  Calendar,
  Clock,
  Users,
  CheckSquare,
  Target,
  Zap,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Settings,
  Filter,
  Search,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  ArrowRight,
  ArrowDown,
  Network,
  Lightbulb,
  Star,
  Timer,
  UserCheck,
  FileText,
  Tag,
  Activity
} from 'lucide-react';

interface AITask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  assignee: string;
  dueDate: string;
  estimatedDuration: number; // in minutes
  aiPriorityScore: number;
  aiComplexityScore: number;
  aiSchedulingConfidence: number;
  dependencies: string[];
  tags: string[];
  isAIScheduled: boolean;
  aiSuggestedStart?: string;
  aiSuggestedEnd?: string;
  completionPercentage: number;
}

interface TaskDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  lagDays: number;
}

interface AISchedulingSuggestion {
  id: string;
  taskId: string;
  suggestedDate: string;
  suggestedTime: string;
  reason: string;
  confidence: number;
  benefits: string[];
}

export default function AITaskScheduling() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [tasks] = useState<AITask[]>([
    {
      id: '1',
      title: 'Implement CRM workflow automation',
      description: 'Set up automated lead nurturing sequences in CRM system',
      priority: 'high',
      status: 'in_progress',
      assignee: 'Mike Davis',
      dueDate: '2025-01-22',
      estimatedDuration: 480,
      aiPriorityScore: 85,
      aiComplexityScore: 72,
      aiSchedulingConfidence: 89,
      dependencies: [],
      tags: ['CRM', 'Automation', 'Workflow'],
      isAIScheduled: true,
      aiSuggestedStart: '2025-01-16 09:00',
      aiSuggestedEnd: '2025-01-16 17:00',
      completionPercentage: 65
    },
    {
      id: '2',
      title: 'Analyze Q1 sales performance',
      description: 'Review sales metrics and identify improvement opportunities',
      priority: 'medium',
      status: 'pending',
      assignee: 'Sarah Johnson',
      dueDate: '2025-01-20',
      estimatedDuration: 240,
      aiPriorityScore: 68,
      aiComplexityScore: 45,
      aiSchedulingConfidence: 92,
      dependencies: ['1'],
      tags: ['Sales', 'Analytics', 'Reporting'],
      isAIScheduled: true,
      aiSuggestedStart: '2025-01-17 14:00',
      aiSuggestedEnd: '2025-01-17 18:00',
      completionPercentage: 0
    },
    {
      id: '3',
      title: 'Customer onboarding documentation update',
      description: 'Revise onboarding materials based on customer feedback',
      priority: 'low',
      status: 'pending',
      assignee: 'John Smith',
      dueDate: '2025-01-25',
      estimatedDuration: 180,
      aiPriorityScore: 42,
      aiComplexityScore: 35,
      aiSchedulingConfidence: 78,
      dependencies: [],
      tags: ['Documentation', 'Customer Success'],
      isAIScheduled: false,
      completionPercentage: 0
    },
    {
      id: '4',
      title: 'Security audit preparation',
      description: 'Prepare documentation and systems for quarterly security audit',
      priority: 'urgent',
      status: 'blocked',
      assignee: 'Emily Wilson',
      dueDate: '2025-01-18',
      estimatedDuration: 360,
      aiPriorityScore: 95,
      aiComplexityScore: 88,
      aiSchedulingConfidence: 84,
      dependencies: ['1', '2'],
      tags: ['Security', 'Compliance', 'Audit'],
      isAIScheduled: true,
      aiSuggestedStart: '2025-01-19 09:00',
      aiSuggestedEnd: '2025-01-19 15:00',
      completionPercentage: 25
    }
  ]);

  const [suggestions] = useState<AISchedulingSuggestion[]>([
    {
      id: '1',
      taskId: '2',
      suggestedDate: '2025-01-17',
      suggestedTime: '14:00',
      reason: 'Optimal time based on team availability and dependency completion',
      confidence: 92,
      benefits: ['No scheduling conflicts', 'All dependencies met', 'Peak productivity time']
    },
    {
      id: '2',
      taskId: '3',
      suggestedDate: '2025-01-19',
      suggestedTime: '10:00',
      reason: 'Low complexity task scheduled during high-energy morning hours',
      confidence: 78,
      benefits: ['Morning productivity boost', 'No urgent tasks blocking', 'Balanced workload']
    }
  ]);

  const [stats] = useState({
    totalTasks: 67,
    aiScheduledTasks: 43,
    automationRate: 89,
    averageAccuracy: 94,
    timeSaved: 12.5, // hours
    completionRate: 87,
    overdueTasks: 3,
    workloadBalance: 85
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-red-100 text-red-800">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800">Low</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
      case 'blocked':
        return <Badge className="bg-red-100 text-red-800">Blocked</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesFilter = selectedFilter === 'all' || task.status === selectedFilter;
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <MainLayout 
      title="AI Task Scheduling" 
      description="Enhanced AI task scheduling and dependency management with intelligent automation"
    >
      {/* Action buttons */}
      <div className="flex justify-end gap-3 mb-6">
          <Button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700">
            <Brain className="h-4 w-4" />
            AI Optimize Schedule
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Task
          </Button>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CheckSquare className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTasks}</p>
                <p className="text-sm text-gray-600">Total Tasks</p>
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
                <p className="text-2xl font-bold text-gray-900">{stats.aiScheduledTasks}</p>
                <p className="text-sm text-gray-600">AI Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.automationRate}%</p>
                <p className="text-sm text-gray-600">Automation Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.timeSaved}h</p>
                <p className="text-sm text-gray-600">Time Saved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">AI Accuracy</span>
              <span className="text-sm font-bold text-gray-900">{stats.averageAccuracy}%</span>
            </div>
            <Progress value={stats.averageAccuracy} className="mb-2" />
            <p className="text-xs text-gray-500">Scheduling prediction accuracy</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">Completion Rate</span>
              <span className="text-sm font-bold text-gray-900">{stats.completionRate}%</span>
            </div>
            <Progress value={stats.completionRate} className="mb-2" />
            <p className="text-xs text-gray-500">Tasks completed on time</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">Workload Balance</span>
              <span className="text-sm font-bold text-gray-900">{stats.workloadBalance}%</span>
            </div>
            <Progress value={stats.workloadBalance} className="mb-2" />
            <p className="text-xs text-gray-500">Team workload distribution</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.overdueTasks}</p>
                <p className="text-sm text-gray-600">Overdue Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Task Dashboard</TabsTrigger>
          <TabsTrigger value="scheduling">AI Scheduling</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Task Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Task Management Dashboard</CardTitle>
                  <CardDescription>
                    Manage tasks with AI-powered scheduling and optimization
                  </CardDescription>
                </div>
                <div className="flex gap-3">
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                  />
                  <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tasks</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-6 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{task.title}</h3>
                          {getPriorityBadge(task.priority)}
                          {getStatusBadge(task.status)}
                          {task.isAIScheduled && (
                            <Badge className="bg-purple-100 text-purple-800">
                              <Brain className="h-3 w-3 mr-1" />
                              AI Scheduled
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-600 mb-3">{task.description}</p>
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <UserCheck className="h-4 w-4" />
                            {task.assignee}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Due: {task.dueDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Timer className="h-4 w-4" />
                            {task.estimatedDuration} min
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-4 w-4" />
                            AI Score: {task.aiPriorityScore}
                          </span>
                        </div>
                        {task.tags.length > 0 && (
                          <div className="flex items-center gap-2 mt-3">
                            <Tag className="h-4 w-4 text-gray-400" />
                            {task.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-3 ml-6">
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Progress</p>
                          <div className="flex items-center gap-2">
                            <Progress value={task.completionPercentage} className="w-20" />
                            <span className="text-sm font-medium">{task.completionPercentage}%</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {task.aiSchedulingConfidence > 0 && (
                      <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <Brain className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">
                            AI Scheduling Confidence: {task.aiSchedulingConfidence}%
                          </span>
                        </div>
                        {task.aiSuggestedStart && (
                          <p className="text-sm text-purple-700">
                            Suggested schedule: {task.aiSuggestedStart} - {task.aiSuggestedEnd}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Scheduling Tab */}
        <TabsContent value="scheduling" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Scheduling Suggestions</CardTitle>
              <CardDescription>
                Intelligent scheduling recommendations based on AI analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestions.map((suggestion) => {
                  const task = tasks.find(t => t.id === suggestion.taskId);
                  return (
                    <div
                      key={suggestion.id}
                      className="p-6 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Lightbulb className="h-5 w-5 text-purple-600" />
                            <h3 className="font-semibold text-gray-900">{task?.title}</h3>
                            <Badge className="bg-purple-100 text-purple-800">
                              {suggestion.confidence}% confidence
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-3">{suggestion.reason}</p>
                          <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {suggestion.suggestedDate}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {suggestion.suggestedTime}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900">Benefits:</p>
                            {suggestion.benefits.map((benefit, index) => (
                              <p key={index} className="text-sm text-green-700 flex items-center gap-2">
                                <CheckCircle className="h-3 w-3" />
                                {benefit}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-6">
                          <Button className="bg-purple-600 hover:bg-purple-700">
                            Accept Suggestion
                          </Button>
                          <Button variant="outline">
                            Modify
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dependencies Tab */}
        <TabsContent value="dependencies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Task Dependencies</CardTitle>
              <CardDescription>
                Manage task relationships and dependencies for optimal scheduling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center py-12 text-gray-500">
                  <Network className="h-12 w-12 mx-auto mb-4" />
                  <p>Task dependency visualization will be displayed here</p>
                  <p className="text-sm">Interactive dependency graph coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Task Completion Trends</CardTitle>
                <CardDescription>
                  Track task completion rates over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <p>Task completion analytics chart</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Performance Metrics</CardTitle>
                <CardDescription>
                  Monitor AI scheduling accuracy and efficiency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4" />
                  <p>AI performance metrics chart</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}