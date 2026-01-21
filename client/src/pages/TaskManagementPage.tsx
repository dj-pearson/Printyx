import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import TaskList from '@/components/tasks/TaskList';
import {
  Brain,
  CheckCircle2,
  Clock,
  TrendingUp,
  Zap,
  Target,
  Calendar,
  BarChart3,
  Lightbulb,
  Settings,
  Plus,
} from 'lucide-react';

interface TaskStats {
  totalTasks: number;
  completedToday: number;
  inProgress: number;
  overdue: number;
  aiScheduled: number;
  timeSpentToday: number; // in minutes
  productivityScore: number; // 0-100
  averageCompletionTime: number; // in minutes
}

interface AISuggestion {
  id: string;
  type: 'task' | 'scheduling' | 'optimization';
  title: string;
  description: string;
  confidence: number;
  actionLabel: string;
}

export default function TaskManagementPage() {
  const [stats] = useState<TaskStats>({
    totalTasks: 24,
    completedToday: 6,
    inProgress: 3,
    overdue: 2,
    aiScheduled: 18,
    timeSpentToday: 285, // 4h 45min
    productivityScore: 87,
    averageCompletionTime: 42,
  });

  const [aiSuggestions] = useState<AISuggestion[]>([
    {
      id: 'suggestion-1',
      type: 'task',
      title: 'Follow up with website lead',
      description: "Visitor downloaded pricing guide 3 days ago but hasn't been contacted",
      confidence: 0.78,
      actionLabel: 'Create Task',
    },
    {
      id: 'suggestion-2',
      type: 'scheduling',
      title: 'Reschedule complex tasks to morning',
      description: 'Your productivity is 40% higher in the morning for complex tasks',
      confidence: 0.85,
      actionLabel: 'Apply Changes',
    },
    {
      id: 'suggestion-3',
      type: 'optimization',
      title: 'Block focus time for proposal work',
      description: 'Uninterrupted 2-hour blocks increase proposal completion by 60%',
      confidence: 0.92,
      actionLabel: 'Schedule Focus Time',
    },
  ]);

  const [isScheduling, setIsScheduling] = useState(false);

  const handleAIScheduling = async () => {
    setIsScheduling(true);
    // Simulate AI scheduling
    setTimeout(() => {
      setIsScheduling(false);
      // Show success message or update UI
    }, 2000);
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Brain className="mr-3 h-8 w-8 text-blue-600" />
            AI Task Management
          </h1>
          <p className="text-gray-600 mt-1">
            Intelligent task scheduling and productivity optimization
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handleAIScheduling} disabled={isScheduling}>
            <Zap className={`h-4 w-4 mr-2 ${isScheduling ? 'animate-pulse' : ''}`} />
            {isScheduling ? 'AI Scheduling...' : 'AI Schedule Optimization'}
          </Button>

          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </Button>

          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Productivity Score</p>
                <p className="text-2xl font-bold text-green-600">{stats.productivityScore}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">+12% from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Today</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.completedToday}/{stats.totalTasks}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round((stats.completedToday / stats.totalTasks) * 100)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Time Spent</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatTime(stats.timeSpentToday)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Avg: {formatTime(stats.averageCompletionTime)} per task
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Scheduled</p>
                <p className="text-2xl font-bold text-orange-600">{stats.aiScheduled}</p>
              </div>
              <Brain className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">{stats.overdue} overdue tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Task List - Main Content */}
        <div className="xl:col-span-3">
          <TaskList />
        </div>

        {/* AI Insights Sidebar */}
        <div className="space-y-4">
          {/* AI Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Lightbulb className="mr-2 h-5 w-5 text-yellow-500" />
                AI Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{suggestion.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </Badge>
                  </div>

                  <p className="text-xs text-gray-600 mb-3">{suggestion.description}</p>

                  <div className="flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        suggestion.type === 'task'
                          ? 'bg-blue-100 text-blue-800'
                          : suggestion.type === 'scheduling'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {suggestion.type}
                    </Badge>

                    <Button variant="outline" size="sm" className="text-xs">
                      {suggestion.actionLabel}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <BarChart3 className="mr-2 h-5 w-5 text-blue-500" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">In Progress</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {stats.inProgress}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Overdue</span>
                <Badge variant="outline" className="bg-red-50 text-red-700">
                  {stats.overdue}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">AI Optimized</span>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {Math.round((stats.aiScheduled / stats.totalTasks) * 100)}%
                </Badge>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">This Week</span>
                  <span className="font-medium">42 completed</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">This Month</span>
                  <span className="font-medium">186 completed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Target className="mr-2 h-5 w-5 text-green-500" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Focus Time
              </Button>

              <Button variant="outline" size="sm" className="w-full justify-start">
                <Brain className="h-4 w-4 mr-2" />
                AI Task Analysis
              </Button>

              <Button variant="outline" size="sm" className="w-full justify-start">
                <Zap className="h-4 w-4 mr-2" />
                Bulk Task Import
              </Button>

              <Button variant="outline" size="sm" className="w-full justify-start">
                <BarChart3 className="h-4 w-4 mr-2" />
                Productivity Report
              </Button>
            </CardContent>
          </Card>

          {/* Productivity Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Lightbulb className="mr-2 h-5 w-5 text-yellow-500" />
                Today's Tip
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 mb-2 font-medium">🧠 Batch Similar Tasks</p>
                <p className="text-xs text-yellow-700">
                  Group similar tasks like phone calls or emails together. This reduces context
                  switching and can improve efficiency by up to 25%.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
