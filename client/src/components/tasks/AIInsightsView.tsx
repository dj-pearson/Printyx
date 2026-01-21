/**
 * AI Insights View Component
 * AI-powered task scheduling, analytics, and recommendations
 * Consolidates functionality from AITaskScheduling.tsx and TaskManagementPage.tsx
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  Lightbulb,
  TrendingUp,
  Clock,
  Zap,
  Calendar,
  BarChart3,
  Target,
} from 'lucide-react';

interface AIInsightsViewProps {
  tasks: any[];
  stats: any;
  isLoading: boolean;
}

export function AIInsightsView({ tasks, stats, isLoading }: AIInsightsViewProps) {
  const [isScheduling, setIsScheduling] = useState(false);

  const handleAIScheduling = async () => {
    setIsScheduling(true);
    // TODO: Implement AI scheduling API call
    setTimeout(() => {
      setIsScheduling(false);
    }, 2000);
  };

  // Mock AI suggestions
  const aiSuggestions = [
    {
      id: '1',
      type: 'task',
      title: 'Follow up with high-priority leads',
      description: "3 leads haven't been contacted in 5+ days",
      confidence: 0.85,
      actionLabel: 'Create Tasks',
    },
    {
      id: '2',
      type: 'scheduling',
      title: 'Reschedule complex tasks to morning',
      description: 'Your productivity is 40% higher in the morning for complex tasks',
      confidence: 0.78,
      actionLabel: 'Apply Changes',
    },
    {
      id: '3',
      type: 'optimization',
      title: 'Block focus time for proposals',
      description: 'Uninterrupted 2-hour blocks increase completion by 60%',
      confidence: 0.92,
      actionLabel: 'Schedule Focus Time',
    },
  ];

  const productivityMetrics = [
    {
      label: 'Avg. Completion Time',
      value: '42 min',
      icon: Clock,
      color: 'text-blue-600',
    },
    {
      label: 'On-Time Rate',
      value: '87%',
      icon: Target,
      color: 'text-green-600',
    },
    {
      label: 'Task Velocity',
      value: '+15%',
      icon: TrendingUp,
      color: 'text-purple-600',
    },
    {
      label: 'Focus Score',
      value: '8.2/10',
      icon: Brain,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* AI Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleAIScheduling} disabled={isScheduling}>
          <Zap className={`h-4 w-4 mr-2 ${isScheduling ? 'animate-pulse' : ''}`} />
          {isScheduling ? 'AI Scheduling...' : 'Run AI Schedule Optimization'}
        </Button>
        <Button variant="outline">
          <Brain className="h-4 w-4 mr-2" />
          Analyze Task Patterns
        </Button>
        <Button variant="outline">
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Focus Time
        </Button>
      </div>

      {/* Productivity Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {productivityMetrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{metric.label}</p>
                  <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
                </div>
                <metric.icon className={`h-8 w-8 ${metric.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Suggestions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lightbulb className="mr-2 h-5 w-5 text-yellow-500" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{suggestion.title}</h4>
                    <Badge variant="outline">
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{suggestion.description}</p>
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className={
                        suggestion.type === 'task'
                          ? 'bg-blue-100 text-blue-800'
                          : suggestion.type === 'scheduling'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                      }
                    >
                      {suggestion.type}
                    </Badge>
                    <Button variant="outline" size="sm">
                      {suggestion.actionLabel}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <BarChart3 className="mr-2 h-5 w-5 text-blue-500" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium">42 tasks</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Time Tracked</span>
                <span className="font-medium">28h 15m</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg. per Day</span>
                <span className="font-medium">6 tasks</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-green-500" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Task Completion</span>
                  <span className="font-medium">87%</span>
                </div>
                <Progress value={87} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">On-Time Delivery</span>
                  <span className="font-medium">92%</span>
                </div>
                <Progress value={92} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Focus Score</span>
                  <span className="font-medium">82%</span>
                </div>
                <Progress value={82} className="h-2" />
              </div>
            </CardContent>
          </Card>

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
