/**
 * AI Hub Dashboard
 * Central hub for all AI-powered features and capabilities.
 *
 * Round 220: six headline figures (1405 AI actions, 93% average accuracy,
 * 156.5h saved, 12 active agents, 847 daily requests, 78% automation) and a
 * usage count, an accuracy and a January 2025 "last used" date on every
 * capability card were typed in; nothing counts AI calls per feature or scores
 * one. They are deleted, the page is the directory it actually is, and the
 * two header buttons and four quick actions that had no handler are either
 * links to a real page or gone.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Brain,
  Bot,
  Calendar,
  Video,
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';

interface AICapability {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  status: 'active' | 'beta' | 'coming_soon';
  features: string[];
}

export default function AIHub() {
  const capabilities: AICapability[] = [
    {
      id: 'ai-employees',
      title: 'AI Employees',
      description:
        'Intelligent agents and workflow automation with specialized AI employees for various business functions.',
      icon: Bot,
      path: '/ai-employees',
      status: 'active',
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
      features: [
        'Chatbot Management',
        'Natural Language Processing',
        'Intent Recognition',
        'Response Generation',
      ],
    },
  ];

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

      {/* Quick Actions. Round 220: all four were buttons with no handler.
          "AI Analysis" and "Smart Schedule" promised an analysis and a schedule
          optimiser that nothing implements, so they are gone; the other two
          are links to the pages that do the thing they name. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Quick AI Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              asChild
              variant="outline"
              className="p-4 h-auto flex flex-col items-start gap-2"
            >
              <Link href="/ai-search">
                <span className="flex items-center gap-2 font-medium">
                  <Search className="h-4 w-4 text-green-600" />
                  Knowledge Search
                </span>
                <span className="text-sm text-gray-600">Find relevant information</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="p-4 h-auto flex flex-col items-start gap-2"
            >
              <Link href="/ai-employees?action=new">
                <span className="flex items-center gap-2 font-medium">
                  <Bot className="h-4 w-4 text-orange-600" />
                  Deploy AI Agent
                </span>
                <span className="text-sm text-gray-600">Create new AI employee</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AUDIT-019. An "AI System Health" card asserting a 245ms API response
          time, 93.2% model accuracy and 99.9% uptime, each with a progress bar
          and a verdict ("Excellent performance", "Above target threshold").
          Nothing times an AI call, nothing scores a model against a labelled
          set, and nothing probes uptime - the three figures were typed in. A
          green health card is the one thing nobody re-checks, so it is deleted
          rather than relabelled. */}
    </MainLayout>
  );
}
