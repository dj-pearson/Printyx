import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Workflow, 
  Zap, 
  PlayCircle, 
  PauseCircle,
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Settings,
  Eye,
  RefreshCw,
  Plus,
  Copy,
  Edit,
  Trash2,
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Timer,
  Target,
  Users,
  Cpu,
  Database,
  Calendar,
  Mail,
  MessageSquare,
  FileText,
  Calculator,
  Star,
  Award,
  Lightbulb,
  Code,
  GitBranch,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface WorkflowAutomationData {
  automationOverview: {
    totalWorkflows: number;
    activeWorkflows: number;
    pausedWorkflows: number;
    failedWorkflows: number;
    successRate: number;
    executionsToday: number;
    timeSaved: number;
    errorRate: number;
    averageExecutionTime: number;
    automationCoverage: number;
    lastExecution: Date;
  };
  activeWorkflows: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    trigger: string;
    priority: string;
    version: string;
    createdAt: Date;
    lastModified: Date;
    lastExecution: Date;
    executionCount: number;
    successRate: number;
    averageExecutionTime: number;
    estimatedTimeSaved: number;
    steps: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      config: any;
      successRate: number;
      avgExecutionTime: number;
    }>;
    triggers: Array<{
      type: string;
      event?: string;
      schedule?: string;
      conditions: Array<{
        field: string;
        operator: string;
        value: any;
      }>;
    }>;
    metrics: {
      totalExecutions: number;
      successfulExecutions: number;
      failedExecutions: number;
      avgCustomerSatisfaction?: number;
      timeToComplete?: number;
      costSavings: number;
    };
  }>;
  workflowTemplates: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    popularity: number;
    installations: number;
    rating: number;
    complexity: string;
    estimatedSetupTime: number;
    features: string[];
    steps: string[];
    integrations: string[];
  }>;
  rulesEngine: {
    totalRules: number;
    activeRules: number;
    ruleCategories: Array<{
      category: string;
      count: number;
      performance: number;
    }>;
    rules: Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      priority: string;
      description: string;
      trigger: string;
      conditions: Array<{
        field: string;
        operator: string;
        value: any;
      }>;
      actions: Array<{
        type: string;
        value?: any;
        targets?: string[];
      }>;
      executionCount: number;
      successRate: number;
      lastExecuted: Date;
    }>;
  };
  performanceAnalytics: {
    executionTrends: Array<{
      date: string;
      executions: number;
      successRate: number;
    }>;
    topPerformingWorkflows: Array<{
      name: string;
      successRate: number;
      executions: number;
      timeSaved: number;
    }>;
    errorAnalysis: Array<{
      errorType: string;
      count: number;
      percentage: number;
      trend: string;
    }>;
    businessImpact: {
      totalTimeSaved: number;
      totalCostSavings: number;
      errorReduction: number;
      customerSatisfactionIncrease: number;
      processEfficiencyGain: number;
    };
  };
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'running': return 'bg-blue-100 text-blue-800';
    case 'paused': return 'bg-yellow-100 text-yellow-800';
    case 'failed': return 'bg-red-100 text-red-800';
    case 'pending': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'high': return 'bg-red-100 text-red-800 border-red-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getComplexityColor = (complexity: string) => {
  switch (complexity.toLowerCase()) {
    case 'beginner': return 'bg-green-100 text-green-800';
    case 'intermediate': return 'bg-yellow-100 text-yellow-800';
    case 'advanced': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStepIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'email': return <Mail className="h-4 w-4" />;
    case 'sms': return <MessageSquare className="h-4 w-4" />;
    case 'service_ticket': return <FileText className="h-4 w-4" />;
    case 'calendar': return <Calendar className="h-4 w-4" />;
    case 'crm_update': return <Database className="h-4 w-4" />;
    case 'data_check': return <Activity className="h-4 w-4" />;
    case 'calculation': return <Calculator className="h-4 w-4" />;
    case 'notification': return <AlertCircle className="h-4 w-4" />;
    default: return <Cpu className="h-4 w-4" />;
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend.toLowerCase()) {
    case 'increasing': return <TrendingUp className="h-4 w-4 text-red-600" />;
    case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-600" />;
    case 'stable': return <Activity className="h-4 w-4 text-blue-600" />;
    default: return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

export default function WorkflowAutomation() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);

  // Fetch workflow automation data
  const { data: workflowData, isLoading, refetch } = useQuery({
    queryKey: ['/api/workflow-automation/dashboard', selectedCategory, selectedStatus],
    select: (data: any) => ({
      ...data,
      automationOverview: {
        ...data.automationOverview,
        lastExecution: new Date(data.automationOverview.lastExecution)
      },
      activeWorkflows: data.activeWorkflows?.map((workflow: any) => ({
        ...workflow,
        createdAt: new Date(workflow.createdAt),
        lastModified: new Date(workflow.lastModified),
        lastExecution: new Date(workflow.lastExecution)
      })) || [],
      rulesEngine: {
        ...data.rulesEngine,
        rules: data.rulesEngine?.rules?.map((rule: any) => ({
          ...rule,
          lastExecuted: new Date(rule.lastExecuted)
        })) || []
      }
    }),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading workflow automation...</p>
          </div>
        </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Workflow className="h-6 w-6 text-purple-600" />
            Advanced Workflow Automation
          </h1>
          <p className="text-gray-600 mt-1">Intelligent process automation with dynamic rules and smart orchestration</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="customer">Customer Management</SelectItem>
              <SelectItem value="service">Service Management</SelectItem>
              <SelectItem value="financial">Financial Operations</SelectItem>
              <SelectItem value="sales">Sales & Marketing</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Star className="h-4 w-4 mr-2" />
                Templates
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Workflow Templates</DialogTitle>
                <DialogDescription>
                  Choose from pre-built workflow templates to get started quickly
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 max-h-96 overflow-y-auto">
                {workflowData?.workflowTemplates.map((template: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <CardDescription className="text-sm mt-1">{template.category}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{template.rating}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{template.description}</p>
                      
                      <div className="space-y-2 text-xs mb-3">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Complexity:</span>
                          <Badge className={getComplexityColor(template.complexity)} variant="outline">
                            {template.complexity}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Setup Time:</span>
                          <span className="font-medium">{template.estimatedSetupTime}min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Installations:</span>
                          <span className="font-medium">{template.installations}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-3">
                        {template.features.slice(0, 2).map((feature: string, featureIdx: number) => (
                          <Badge key={featureIdx} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {template.features.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.features.length - 2} more
                          </Badge>
                        )}
                      </div>
                      
                      <Button className="w-full" size="sm">
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Workflow</DialogTitle>
                <DialogDescription>
                  Build a custom workflow from scratch or start with a template
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="workflow-name">Workflow Name</Label>
                  <Input id="workflow-name" placeholder="Enter workflow name" />
                </div>
                <div>
                  <Label htmlFor="workflow-description">Description</Label>
                  <Textarea id="workflow-description" placeholder="Describe what this workflow does" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="workflow-category">Category</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer Management</SelectItem>
                        <SelectItem value="service">Service Management</SelectItem>
                        <SelectItem value="financial">Financial Operations</SelectItem>
                        <SelectItem value="sales">Sales & Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="workflow-trigger">Trigger Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trigger" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event">System Event</SelectItem>
                        <SelectItem value="schedule">Time Schedule</SelectItem>
                        <SelectItem value="webhook">Webhook</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    Create & Configure
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {workflowData && (
        <>
          {/* Automation Overview KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Workflows</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {workflowData.automationOverview.activeWorkflows}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Workflow className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    {formatPercentage(workflowData.automationOverview.successRate)} success rate
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Executions Today</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {workflowData.automationOverview.executionsToday.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Activity className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Timer className="h-4 w-4 text-blue-600 mr-1" />
                  <span className="text-blue-600">
                    {formatDuration(workflowData.automationOverview.averageExecutionTime)} avg time
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Time Saved</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Math.round(workflowData.automationOverview.timeSaved)}h
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2 text-sm">
                  <Target className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">
                    This month
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Automation Coverage</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(workflowData.automationOverview.automationCoverage)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <Progress value={workflowData.automationOverview.automationCoverage} className="h-2" />
                  <p className="text-sm text-orange-600 mt-1">
                    {formatPercentage(workflowData.automationOverview.errorRate)} error rate
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="workflows" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="workflows">Active Workflows</TabsTrigger>
              <TabsTrigger value="rules">Rules Engine</TabsTrigger>
              <TabsTrigger value="analytics">Performance</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="builder">Builder</TabsTrigger>
            </TabsList>

            <TabsContent value="workflows" className="space-y-6">
              <div className="space-y-6">
                {workflowData.activeWorkflows.map((workflow: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {workflow.name}
                            <Badge className={getStatusColor(workflow.status)}>
                              {workflow.status}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {workflow.category} • v{workflow.version} • Trigger: {workflow.trigger.replace('_', ' ')}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getPriorityColor(workflow.priority)} variant="outline">
                            {workflow.priority} priority
                          </Badge>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Performance Metrics */}
                        <div>
                          <div className="text-sm text-gray-600 mb-3">Performance Metrics</div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Total Executions:</span>
                              <span className="font-medium">{workflow.executionCount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Success Rate:</span>
                              <span className="font-medium">{formatPercentage(workflow.successRate)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Avg Execution Time:</span>
                              <span className="font-medium">{formatDuration(workflow.averageExecutionTime)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Time Saved/Month:</span>
                              <span className="font-medium text-green-600">{workflow.estimatedTimeSaved}h</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Cost Savings:</span>
                              <span className="font-medium text-green-600">{formatCurrency(workflow.metrics.costSavings)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Workflow Steps */}
                        <div>
                          <div className="text-sm text-gray-600 mb-3">Workflow Steps ({workflow.steps.length})</div>
                          <div className="space-y-2">
                            {workflow.steps.slice(0, 4).map((step: any, stepIdx: number) => (
                              <div key={stepIdx} className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full">
                                  {getStepIcon(step.type)}
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{step.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {formatPercentage(step.successRate)} • {formatDuration(step.avgExecutionTime)}
                                  </div>
                                </div>
                                <Badge className={getStatusColor(step.status)} variant="outline">
                                  {step.status}
                                </Badge>
                              </div>
                            ))}
                            {workflow.steps.length > 4 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{workflow.steps.length - 4} more steps
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Triggers & Conditions */}
                        <div>
                          <div className="text-sm text-gray-600 mb-3">Triggers & Conditions</div>
                          <div className="space-y-3">
                            {workflow.triggers.map((trigger: any, triggerIdx: number) => (
                              <div key={triggerIdx} className="p-3 bg-gray-50 rounded-lg">
                                <div className="text-sm font-medium capitalize mb-2">
                                  {trigger.type} {trigger.event && `(${trigger.event.replace('_', ' ')})`}
                                </div>
                                {trigger.conditions && (
                                  <div className="space-y-1">
                                    {trigger.conditions.slice(0, 2).map((condition: any, condIdx: number) => (
                                      <div key={condIdx} className="text-xs text-gray-600">
                                        <span className="font-mono">{condition.field}</span>
                                        <span className="mx-1">{condition.operator.replace('_', ' ')}</span>
                                        <span className="font-medium">{condition.value}</span>
                                      </div>
                                    ))}
                                    {trigger.conditions.length > 2 && (
                                      <div className="text-xs text-gray-500">
                                        +{trigger.conditions.length - 2} more conditions
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-gray-500">Created:</span>
                              <span className="ml-2">{format(workflow.createdAt, 'MMM dd, yyyy')}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Last Execution:</span>
                              <span className="ml-2">{format(workflow.lastExecution, 'MMM dd, HH:mm')}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Last Modified:</span>
                              <span className="ml-2">{format(workflow.lastModified, 'MMM dd, yyyy')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline">
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </Button>
                            <Button size="sm">
                              <PlayCircle className="h-4 w-4 mr-2" />
                              Run Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="rules" className="space-y-6">
              {/* Rules Engine Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-900">
                      {workflowData.rulesEngine.totalRules}
                    </div>
                    <div className="text-sm text-gray-600">Total Rules</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-900">
                      {workflowData.rulesEngine.activeRules}
                    </div>
                    <div className="text-sm text-gray-600">Active Rules</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-900">
                      {workflowData.rulesEngine.ruleCategories.length}
                    </div>
                    <div className="text-sm text-gray-600">Categories</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-900">
                      {formatPercentage(workflowData.rulesEngine.ruleCategories.reduce((acc, cat) => acc + cat.performance, 0) / workflowData.rulesEngine.ruleCategories.length)}
                    </div>
                    <div className="text-sm text-gray-600">Avg Performance</div>
                  </CardContent>
                </Card>
              </div>

              {/* Rule Categories */}
              <Card>
                <CardHeader>
                  <CardTitle>Rule Categories Performance</CardTitle>
                  <CardDescription>Performance breakdown by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {workflowData.rulesEngine.ruleCategories.map((category: any, idx: number) => (
                      <div key={idx} className="text-center p-4 border rounded-lg">
                        <div className="font-medium">{category.category}</div>
                        <div className="text-2xl font-bold text-gray-900 my-2">{category.count}</div>
                        <div className="text-sm text-gray-600">rules</div>
                        <div className="mt-2">
                          <Progress value={category.performance} className="h-2" />
                          <div className="text-xs text-gray-500 mt-1">
                            {formatPercentage(category.performance)} performance
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active Rules */}
              <div className="space-y-4">
                {workflowData.rulesEngine.rules.map((rule: any, idx: number) => (
                  <Card key={idx}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{rule.name}</h3>
                          <p className="text-gray-600 text-sm mt-1">{rule.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{rule.category}</Badge>
                            <Badge className={getPriorityColor(rule.priority)} variant="outline">
                              {rule.priority}
                            </Badge>
                            <Badge className={getStatusColor(rule.status)}>
                              {rule.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Executions</div>
                          <div className="text-lg font-bold">{rule.executionCount.toLocaleString()}</div>
                          <div className="text-sm text-green-600">{formatPercentage(rule.successRate)} success</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="text-sm text-gray-600 mb-2">Trigger & Conditions</div>
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="text-sm font-medium text-blue-800 mb-2">
                              When: {rule.trigger.replace('_', ' ')}
                            </div>
                            <div className="space-y-1">
                              {rule.conditions.map((condition: any, condIdx: number) => (
                                <div key={condIdx} className="text-xs text-blue-700">
                                  <span className="font-mono">{condition.field}</span>
                                  <span className="mx-1">{condition.operator.replace('_', ' ')}</span>
                                  <span className="font-medium">{condition.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-gray-600 mb-2">Actions</div>
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="space-y-1">
                              {rule.actions.map((action: any, actionIdx: number) => (
                                <div key={actionIdx} className="text-xs text-green-700">
                                  <span className="font-medium">{action.type.replace('_', ' ')}</span>
                                  {action.value && (
                                    <span className="ml-1">: {action.value}</span>
                                  )}
                                  {action.targets && (
                                    <div className="ml-2 text-green-600">
                                      → {action.targets.join(', ')}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-4 pt-4 border-t text-sm">
                        <div className="text-gray-500">
                          Last executed: {format(rule.lastExecuted, 'MMM dd, HH:mm')}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Rule
                          </Button>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View Logs
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Business Impact Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Business Impact Analytics</CardTitle>
                  <CardDescription>Comprehensive view of automation benefits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-900">
                        {Math.round(workflowData.performanceAnalytics.businessImpact.totalTimeSaved)}h
                      </div>
                      <div className="text-sm text-gray-600">Time Saved</div>
                      <div className="text-xs text-green-600 mt-1">This month</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-900">
                        {formatCurrency(workflowData.performanceAnalytics.businessImpact.totalCostSavings)}
                      </div>
                      <div className="text-sm text-gray-600">Cost Savings</div>
                      <div className="text-xs text-green-600 mt-1">This month</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-900">
                        {formatPercentage(workflowData.performanceAnalytics.businessImpact.errorReduction)}
                      </div>
                      <div className="text-sm text-gray-600">Error Reduction</div>
                      <div className="text-xs text-blue-600 mt-1">vs manual</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-900">
                        {formatPercentage(workflowData.performanceAnalytics.businessImpact.customerSatisfactionIncrease)}
                      </div>
                      <div className="text-sm text-gray-600">CSAT Increase</div>
                      <div className="text-xs text-purple-600 mt-1">automation impact</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-900">
                        {formatPercentage(workflowData.performanceAnalytics.businessImpact.processEfficiencyGain)}
                      </div>
                      <div className="text-sm text-gray-600">Efficiency Gain</div>
                      <div className="text-xs text-orange-600 mt-1">process improvement</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Performing Workflows */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Workflows</CardTitle>
                  <CardDescription>Best performing automation workflows by impact</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workflowData.performanceAnalytics.topPerformingWorkflows.map((workflow: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{workflow.name}</div>
                          <div className="text-sm text-gray-600">
                            {workflow.executions.toLocaleString()} executions • {formatPercentage(workflow.successRate)} success rate
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">{workflow.timeSaved}h saved</div>
                          <div className="text-sm text-gray-500">this month</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Error Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Error Analysis & Trends</CardTitle>
                  <CardDescription>Common error types and their trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workflowData.performanceAnalytics.errorAnalysis.map((error: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{error.errorType}</div>
                            {getTrendIcon(error.trend)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {error.count} occurrences • {formatPercentage(error.percentage)} of total errors
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={
                            error.trend === 'decreasing' ? 'bg-green-100 text-green-800' :
                            error.trend === 'increasing' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }>
                            {error.trend}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflowData.workflowTemplates.map((template: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <CardDescription className="mt-1">{template.category}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{template.rating}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Complexity:</span>
                          <Badge className={getComplexityColor(template.complexity)}>
                            {template.complexity}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Setup Time:</span>
                          <span className="text-sm font-medium">{template.estimatedSetupTime} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Popularity:</span>
                          <span className="text-sm font-medium">{formatPercentage(template.popularity)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Installations:</span>
                          <span className="text-sm font-medium">{template.installations}</span>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <div className="text-sm text-gray-600 mb-2">Features</div>
                        <div className="flex flex-wrap gap-1">
                          {template.features.map((feature: string, featureIdx: number) => (
                            <Badge key={featureIdx} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <div className="text-sm text-gray-600 mb-2">Steps</div>
                        <div className="space-y-1">
                          {template.steps.slice(0, 3).map((step: string, stepIdx: number) => (
                            <div key={stepIdx} className="text-xs text-gray-700 flex items-center">
                              <div className="w-1 h-1 bg-blue-500 rounded-full mr-2"></div>
                              {step}
                            </div>
                          ))}
                          {template.steps.length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{template.steps.length - 3} more steps
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="builder" className="space-y-6">
              <div className="text-center py-12">
                <Code className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Visual Workflow Builder</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Build custom workflows using our drag-and-drop interface with smart triggers, conditions, and actions
                </p>
                <div className="flex gap-4 justify-center">
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Workflow
                  </Button>
                  <Button variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    View Drafts
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
      </div>
    </MainLayout>
  );
}