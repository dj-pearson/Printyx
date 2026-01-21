/**
 * AI Hub Dashboard
 * Central hub for all AI-powered features and capabilities
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'wouter';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Brain,
  Bot,
  Calendar,
  Video,
  Search,
  MessageSquare,
  Zap,
  TrendingUp,
  BarChart3,
  Users,
  Clock,
  CheckCircle,
  Star,
  Activity,
  Sparkles,
  ArrowRight,
  Settings,
  Database,
  Network,
  Mic,
  FileText,
  Target,
  Lightbulb,
} from 'lucide-react';

interface AICapability {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  status: 'active' | 'beta' | 'coming_soon';
  usageCount: number;
  accuracy: number;
  lastUsed?: string;
  features: string[];
}

export default function AIHub() {
  const [capabilities] = useState<AICapability[]>([
    {
      id: 'ai-employees',
      title: 'AI Employees',
      description:
        'Intelligent agents and workflow automation with specialized AI employees for various business functions.',
      icon: Bot,
      path: '/ai-employees',
      status: 'active',
      usageCount: 247,
      accuracy: 94,
      lastUsed: '2025-01-15',
      features: ['Sales Assistant AI', 'Support Agent AI', 'Data Analyst AI', 'Project Manager AI'],
    },
    {
      id: 'calendar-integration',
      title: 'Calendar Integration',
      description:
        'Smart scheduling and event management with AI-powered calendar optimization and conflict resolution.',
      icon: Calendar,
      path: '/calendar',
      status: 'active',
      usageCount: 156,
      accuracy: 96,
      lastUsed: '2025-01-15',
      features: [
        'Smart Scheduling',
        'Conflict Resolution',
        'Meeting Optimization',
        'Time Blocking',
      ],
    },
    {
      id: 'meeting-transcription',
      title: 'Meeting Transcription',
      description:
        'AI-powered meeting recording, transcription, and intelligent note generation with action item extraction.',
      icon: Video,
      path: '/meeting-transcription',
      status: 'active',
      usageCount: 89,
      accuracy: 92,
      lastUsed: '2025-01-14',
      features: [
        'Real-time Transcription',
        'Speaker Recognition',
        'Action Items',
        'Meeting Highlights',
      ],
    },
    {
      id: 'ai-search',
      title: 'AI Search & Knowledge',
      description:
        'Vector database search, AI query processing, and intelligent knowledge discovery across all content.',
      icon: Search,
      path: '/ai-search',
      status: 'beta',
      usageCount: 312,
      accuracy: 89,
      lastUsed: '2025-01-15',
      features: ['Semantic Search', 'Knowledge Graphs', 'Content Discovery', 'Answer Generation'],
    },
    {
      id: 'ai-task-scheduling',
      title: 'AI Task Scheduling',
      description:
        'Enhanced AI task scheduling and dependency management with intelligent automation and optimization.',
      icon: Brain,
      path: '/ai-task-scheduling',
      status: 'active',
      usageCount: 178,
      accuracy: 91,
      lastUsed: '2025-01-15',
      features: [
        'Smart Scheduling',
        'Dependency Analysis',
        'Workload Balancing',
        'Priority Optimization',
      ],
    },
    {
      id: 'conversation-ai',
      title: 'Conversation AI',
      description:
        'Advanced conversational AI dashboard for customer interactions and support automation.',
      icon: MessageSquare,
      path: '/conversational-ai-dashboard',
      status: 'active',
      usageCount: 423,
      accuracy: 95,
      lastUsed: '2025-01-15',
      features: [
        'Chatbot Management',
        'Natural Language Processing',
        'Intent Recognition',
        'Response Generation',
      ],
    },
  ]);

  const [stats] = useState({
    totalAIActions: 1405,
    averageAccuracy: 93,
    timeSaved: 156.5, // hours
    activeAIAgents: 12,
    dailyProcessedRequests: 847,
    automationRate: 78,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'beta':
        return <Badge className="bg-blue-100 text-blue-800">Beta</Badge>;
      case 'coming_soon':
        return <Badge className="bg-gray-100 text-gray-800">Coming Soon</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <MainLayout
      title="AI Hub"
      description="Central command center for all AI-powered features and intelligent automation"
    >
      {/* AI Hub Action Buttons */}
      <div className="flex justify-end gap-3 mb-6">
        <Button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700">
          <Settings className="h-4 w-4" />
          AI Settings
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          View Analytics
        </Button>
      </div>

      {/* AI Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAIActions}</p>
                <p className="text-sm text-gray-600">AI Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Target className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.averageAccuracy}%</p>
                <p className="text-sm text-gray-600">Avg Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.timeSaved}h</p>
                <p className="text-sm text-gray-600">Time Saved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Bot className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.activeAIAgents}</p>
                <p className="text-sm text-gray-600">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Activity className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.dailyProcessedRequests}</p>
                <p className="text-sm text-gray-600">Daily Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.automationRate}%</p>
                <p className="text-sm text-gray-600">Automation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Capabilities Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">AI Capabilities</h2>
          <Badge className="bg-purple-100 text-purple-800">
            <Sparkles className="h-3 w-3 mr-1" />
            {capabilities.length} AI Features Available
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((capability) => (
            <Card key={capability.id} className="hover:shadow-lg transition-all duration-200 group">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-purple-100 transition-colors">
                      <capability.icon className="h-6 w-6 text-gray-600 group-hover:text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{capability.title}</CardTitle>
                      {getStatusBadge(capability.status)}
                    </div>
                  </div>
                </div>
                <CardDescription className="mt-3">{capability.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-900">{capability.usageCount}</p>
                    <p className="text-xs text-gray-600">Uses</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-900">{capability.accuracy}%</p>
                    <p className="text-xs text-gray-600">Accuracy</p>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Key Features:</p>
                  <div className="space-y-1">
                    {capability.features.slice(0, 3).map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {feature}
                      </div>
                    ))}
                    {capability.features.length > 3 && (
                      <p className="text-xs text-gray-500">
                        +{capability.features.length - 3} more features
                      </p>
                    )}
                  </div>
                </div>

                {/* Last Used */}
                {capability.lastUsed && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    Last used: {capability.lastUsed}
                  </div>
                )}

                {/* Action Button */}
                <Link href={capability.path}>
                  <Button
                    className="w-full flex items-center justify-center gap-2 group-hover:bg-purple-600 group-hover:text-white transition-colors"
                    variant={capability.status === 'coming_soon' ? 'outline' : 'default'}
                    disabled={capability.status === 'coming_soon'}
                  >
                    {capability.status === 'coming_soon' ? (
                      <>
                        <Clock className="h-4 w-4" />
                        Coming Soon
                      </>
                    ) : (
                      <>
                        Launch {capability.title}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Quick AI Actions
          </CardTitle>
          <CardDescription>Frequently used AI-powered actions and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="p-4 h-auto flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                <span className="font-medium">AI Analysis</span>
              </div>
              <span className="text-sm text-gray-600">Analyze current business data</span>
            </Button>

            <Button variant="outline" className="p-4 h-auto flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Smart Schedule</span>
              </div>
              <span className="text-sm text-gray-600">Optimize today's schedule</span>
            </Button>

            <Button variant="outline" className="p-4 h-auto flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-green-600" />
                <span className="font-medium">Knowledge Search</span>
              </div>
              <span className="text-sm text-gray-600">Find relevant information</span>
            </Button>

            <Button variant="outline" className="p-4 h-auto flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-orange-600" />
                <span className="font-medium">Deploy AI Agent</span>
              </div>
              <span className="text-sm text-gray-600">Create new AI employee</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            AI System Health
          </CardTitle>
          <CardDescription>Monitor the health and performance of all AI systems</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">API Response Time</span>
                <span className="text-sm font-bold text-green-600">245ms</span>
              </div>
              <Progress value={85} className="h-2" />
              <p className="text-xs text-gray-500">Excellent performance</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Model Accuracy</span>
                <span className="text-sm font-bold text-blue-600">93.2%</span>
              </div>
              <Progress value={93} className="h-2" />
              <p className="text-xs text-gray-500">Above target threshold</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">System Uptime</span>
                <span className="text-sm font-bold text-green-600">99.9%</span>
              </div>
              <Progress value={99.9} className="h-2" />
              <p className="text-xs text-gray-500">Excellent availability</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
