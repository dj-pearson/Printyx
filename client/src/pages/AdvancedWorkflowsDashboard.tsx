// client/src/pages/AdvancedWorkflowsDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Workflow,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Star,
  Activity,
  Settings,
  Play,
  Pause,
  BarChart3,
  PieChart,
  Calendar,
  Mail,
  FileText,
  Phone,
  Target,
  Briefcase,
  Award,
  Sparkles,
  Building,
  Dumbbell,
  Printer,
  HardHat,
  Users,
  GitBranch,
  Brain,
  Cog,
} from 'lucide-react';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  industryType: string;
  estimatedDuration: string;
  complexity: string;
  agents: string[];
  steps: number;
  successRate: number;
  features: string[];
}

interface WorkflowExecution {
  id: string;
  workflowName: string;
  industry: string;
  status: string;
  executionTime: number;
  startedAt: Date;
  qualityScore?: number;
  progress?: number;
}

interface IndustryAgent {
  id: string;
  agentName: string;
  industryType: string;
  agentSpecialization: string;
  successRate: number;
  deploymentStatus: string;
}

interface DashboardData {
  overview: {
    totalWorkflows: number;
    activeWorkflows: number;
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    costSavings: number;
  };
  industryBreakdown: Array<{
    industry: string;
    workflows: number;
    executions: number;
    successRate: number;
  }>;
  recentExecutions: WorkflowExecution[];
  performanceMetrics: {
    executionTrends: number[];
    qualityTrends: number[];
    industryPerformance: Record<string, any>;
  };
  topPerformingWorkflows: Array<{
    name: string;
    successRate: number;
    executions: number;
  }>;
  aiAgentUtilization: Array<{
    agent: string;
    utilization: number;
    tasks: number;
  }>;
}

const mockDashboardData: DashboardData = {
  overview: {
    totalWorkflows: 12,
    activeWorkflows: 8,
    totalExecutions: 156,
    successRate: 0.89,
    averageExecutionTime: 45,
    costSavings: 2450.0,
  },
  industryBreakdown: [
    { industry: 'copier_dealer', workflows: 4, executions: 67, successRate: 0.91 },
    { industry: 'construction', workflows: 3, executions: 34, successRate: 0.85 },
    { industry: 'gym_management', workflows: 2, executions: 28, successRate: 0.93 },
    { industry: 'general', workflows: 3, executions: 27, successRate: 0.87 },
  ],
  recentExecutions: [
    {
      id: '1',
      workflowName: 'Complete Copier Sales Process',
      industry: 'copier_dealer',
      status: 'completed',
      executionTime: 42,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      qualityScore: 88,
    },
    {
      id: '2',
      workflowName: 'Member Onboarding and Retention',
      industry: 'gym_management',
      status: 'running',
      executionTime: 15,
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
      progress: 60,
    },
    {
      id: '3',
      workflowName: 'Construction Project Lifecycle',
      industry: 'construction',
      status: 'completed',
      executionTime: 127,
      startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      qualityScore: 85,
    },
  ],
  performanceMetrics: {
    executionTrends: [45, 52, 48, 61, 58, 67, 72],
    qualityTrends: [82, 85, 87, 86, 89, 88, 91],
    industryPerformance: {
      copier_dealer: { avgTime: 38, quality: 89, success: 0.91 },
      construction: { avgTime: 95, quality: 85, success: 0.85 },
      gym_management: { avgTime: 28, quality: 92, success: 0.93 },
    },
  },
  topPerformingWorkflows: [
    { name: 'Service Request Management', successRate: 0.96, executions: 45 },
    { name: 'Fitness Program Optimization', successRate: 0.94, executions: 28 },
    { name: 'Complete Copier Sales Process', successRate: 0.91, executions: 67 },
  ],
  aiAgentUtilization: [
    { agent: 'Copier Sales Specialist AI', utilization: 0.78, tasks: 45 },
    { agent: 'Fitness Program Designer AI', utilization: 0.65, tasks: 32 },
    { agent: 'Construction Project Manager AI', utilization: 0.82, tasks: 28 },
  ],
};

const mockIndustryTemplates: Record<string, WorkflowTemplate[]> = {
  copier_dealer: [
    {
      id: 'copier_sales_process',
      name: 'Complete Copier Sales Process',
      description: 'End-to-end copier sales from lead qualification to equipment delivery',
      category: 'sales',
      industryType: 'copier_dealer',
      estimatedDuration: '7-14 days',
      complexity: 'medium',
      agents: ['Copier Sales Specialist AI', 'Copier Service Technician AI'],
      steps: 9,
      successRate: 0.87,
      features: [
        'Lead qualification',
        'Needs assessment',
        'Equipment recommendation',
        'Lease calculation',
        'Proposal generation',
      ],
    },
    {
      id: 'service_workflow',
      name: 'Service Request Management',
      description: 'Complete service request handling from ticket to resolution',
      category: 'support',
      industryType: 'copier_dealer',
      estimatedDuration: '2-4 hours',
      complexity: 'low',
      agents: ['Copier Service Technician AI'],
      steps: 6,
      successRate: 0.92,
      features: [
        'Ticket triage',
        'Diagnosis',
        'Parts ordering',
        'Service scheduling',
        'Resolution tracking',
      ],
    },
  ],
  construction: [
    {
      id: 'project_lifecycle',
      name: 'Construction Project Lifecycle',
      description: 'Complete project management from bid to completion',
      category: 'operations',
      industryType: 'construction',
      estimatedDuration: '3-12 months',
      complexity: 'high',
      agents: ['Construction Project Manager AI', 'Construction Estimator AI'],
      steps: 12,
      successRate: 0.78,
      features: [
        'Bid preparation',
        'Project planning',
        'Resource allocation',
        'Progress monitoring',
        'Quality control',
      ],
    },
    {
      id: 'cost_estimation',
      name: 'Automated Cost Estimation',
      description: 'AI-powered construction cost estimation and bidding',
      category: 'sales',
      industryType: 'construction',
      estimatedDuration: '1-3 days',
      complexity: 'medium',
      agents: ['Construction Estimator AI'],
      steps: 7,
      successRate: 0.85,
      features: [
        'Material takeoff',
        'Labor calculation',
        'Equipment costing',
        'Risk assessment',
        'Bid optimization',
      ],
    },
  ],
  gym_management: [
    {
      id: 'member_onboarding',
      name: 'Member Onboarding and Retention',
      description: 'Complete member journey from inquiry to long-term retention',
      category: 'support',
      industryType: 'gym_management',
      estimatedDuration: '30-90 days',
      complexity: 'medium',
      agents: ['Fitness Membership Advisor AI', 'Fitness Program Designer AI'],
      steps: 8,
      successRate: 0.81,
      features: [
        'Inquiry handling',
        'Membership consultation',
        'Program design',
        'Progress tracking',
        'Retention strategies',
      ],
    },
    {
      id: 'program_optimization',
      name: 'Fitness Program Optimization',
      description: 'Personalized fitness program design and continuous optimization',
      category: 'operations',
      industryType: 'gym_management',
      estimatedDuration: 'Ongoing',
      complexity: 'medium',
      agents: ['Fitness Program Designer AI'],
      steps: 6,
      successRate: 0.89,
      features: [
        'Fitness assessment',
        'Program design',
        'Progress monitoring',
        'Program adjustment',
        'Goal achievement',
      ],
    },
  ],
};

const AdvancedWorkflowsDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData>(mockDashboardData);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedIndustry === 'all') {
      setTemplates(Object.values(mockIndustryTemplates).flat());
    } else {
      setTemplates(mockIndustryTemplates[selectedIndustry] || []);
    }
  }, [selectedIndustry]);

  const getIndustryIcon = (industry: string) => {
    switch (industry) {
      case 'copier_dealer':
        return <Printer className="h-5 w-5" />;
      case 'construction':
        return <HardHat className="h-5 w-5" />;
      case 'gym_management':
        return <Dumbbell className="h-5 w-5" />;
      default:
        return <Building className="h-5 w-5" />;
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sales':
        return <Target className="h-4 w-4" />;
      case 'support':
        return <Phone className="h-4 w-4" />;
      case 'operations':
        return <Cog className="h-4 w-4" />;
      default:
        return <Workflow className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExecuteWorkflow = (templateId: string) => {
    console.log('Executing workflow:', templateId);
    // In real implementation, this would call the API
  };

  const handleCreateCustomWorkflow = () => {
    console.log('Opening workflow builder');
    // In real implementation, this would open the workflow builder
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GitBranch className="h-8 w-8 text-purple-500" />
            Advanced Automation & Workflows
          </h1>
          <p className="text-gray-600 mt-1">
            Industry-specific AI workflows with advanced automation and cross-system integration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleCreateCustomWorkflow}>
            <Sparkles className="h-4 w-4 mr-2" />
            Workflow Builder
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Workflows</p>
                <p className="text-2xl font-bold">
                  {dashboardData.overview.activeWorkflows}/{dashboardData.overview.totalWorkflows}
                </p>
              </div>
              <Workflow className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold">
                  {(dashboardData.overview.successRate * 100).toFixed(0)}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Execution Time</p>
                <p className="text-2xl font-bold">{dashboardData.overview.averageExecutionTime}m</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cost Savings</p>
                <p className="text-2xl font-bold">${dashboardData.overview.costSavings}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates">
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="executions">
            <Activity className="h-4 w-4 mr-2" />
            Executions
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Brain className="h-4 w-4 mr-2" />
            AI Agents
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Industry:</span>
              <div className="flex gap-2">
                <Button
                  variant={selectedIndustry === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedIndustry('all')}
                >
                  All Industries
                </Button>
                <Button
                  variant={selectedIndustry === 'copier_dealer' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedIndustry('copier_dealer')}
                >
                  <Printer className="h-3 w-3 mr-1" />
                  Copier Dealer
                </Button>
                <Button
                  variant={selectedIndustry === 'construction' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedIndustry('construction')}
                >
                  <HardHat className="h-3 w-3 mr-1" />
                  Construction
                </Button>
                <Button
                  variant={selectedIndustry === 'gym_management' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedIndustry('gym_management')}
                >
                  <Dumbbell className="h-3 w-3 mr-1" />
                  Gym Management
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-purple-100">
                          {getIndustryIcon(template.industryType)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {template.industryType.replace('_', ' ')}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={getComplexityColor(template.complexity)}>
                      {template.complexity}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">{template.description}</p>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(template.category)}
                      <span className="capitalize">{template.category}</span>
                    </div>
                    <Badge variant="outline">{template.steps} steps</Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Success Rate</span>
                      <span className="font-medium">
                        {(template.successRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={template.successRate * 100} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Duration</p>
                      <p className="font-semibold">{template.estimatedDuration}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">AI Agents</p>
                      <p className="font-semibold">{template.agents.length}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Key Features</p>
                    <div className="flex flex-wrap gap-1">
                      {template.features.slice(0, 3).map((feature, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {template.features.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{template.features.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 flex gap-2">
                  <Button className="flex-1" onClick={() => handleExecuteWorkflow(template.id)}>
                    <Play className="h-3 w-3 mr-1" />
                    Execute
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-3 w-3" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="executions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Workflow Executions</CardTitle>
              <CardDescription>Latest workflow executions across all industries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.recentExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getIndustryIcon(execution.industry)}
                        <div>
                          <p className="font-medium">{execution.workflowName}</p>
                          <p className="text-sm text-gray-600 capitalize">
                            {execution.industry.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {execution.progress !== undefined && (
                        <div className="flex items-center gap-2">
                          <Progress value={execution.progress} className="w-20 h-2" />
                          <span className="text-sm text-gray-600">{execution.progress}%</span>
                        </div>
                      )}
                      <Badge className={getStatusColor(execution.status)}>{execution.status}</Badge>
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {execution.executionTime}m
                      </span>
                      {execution.qualityScore && (
                        <span className="text-sm text-gray-600 flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {execution.qualityScore}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardData.aiAgentUtilization.map((agent, index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-100">
                        <Brain className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{agent.agent}</CardTitle>
                      <CardDescription className="text-sm">AI Specialist</CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Utilization</span>
                      <span className="font-medium">{(agent.utilization * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={agent.utilization * 100} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Tasks Completed</p>
                      <p className="font-semibold">{agent.tasks}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Agent
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Industry Performance</CardTitle>
                <CardDescription>Performance metrics by industry</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.industryBreakdown.map((industry) => (
                    <div key={industry.industry} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getIndustryIcon(industry.industry)}
                        <span className="font-medium capitalize">
                          {industry.industry.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{industry.executions} executions</p>
                          <p className="text-xs text-gray-600">
                            {(industry.successRate * 100).toFixed(0)}% success
                          </p>
                        </div>
                        <Progress value={industry.successRate * 100} className="w-20 h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performing Workflows</CardTitle>
                <CardDescription>Workflows with highest success rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.topPerformingWorkflows.map((workflow, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{workflow.name}</p>
                        <p className="text-sm text-gray-600">{workflow.executions} executions</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={workflow.successRate * 100} className="w-20 h-2" />
                        <span className="text-sm font-medium w-12">
                          {(workflow.successRate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Execution Trends</CardTitle>
                <CardDescription>Weekly execution and quality trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-sm font-medium mb-4">Execution Volume</h4>
                    <div className="flex items-end gap-1 h-32">
                      {dashboardData.performanceMetrics.executionTrends.map((value, idx) => (
                        <div
                          key={idx}
                          className="bg-blue-500 rounded-t flex-1"
                          style={{ height: `${(value / 80) * 100}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-4">Quality Score</h4>
                    <div className="flex items-end gap-1 h-32">
                      {dashboardData.performanceMetrics.qualityTrends.map((value, idx) => (
                        <div
                          key={idx}
                          className="bg-green-500 rounded-t flex-1"
                          style={{ height: `${(value / 100) * 100}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedWorkflowsDashboard;
