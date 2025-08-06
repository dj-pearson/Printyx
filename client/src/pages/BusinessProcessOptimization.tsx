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
  Settings, 
  Zap, 
  TrendingUp, 
  Clock, 
  Target, 
  BarChart3, 
  CheckCircle, 
  AlertTriangle, 
  PlayCircle, 
  PauseCircle,
  Plus,
  Edit,
  Eye,
  Download,
  Filter,
  Workflow,
  Bot,
  Users,
  DollarSign,
  Timer,
  Award,
  Shield,
  Activity,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

interface ProcessOptimizationData {
  processOverview: {
    totalProcesses: number;
    automatedProcesses: number;
    manualProcesses: number;
    automationRate: number;
    avgProcessTime: number;
    processEfficiency: number;
    costSavings: number;
    timeReduction: number;
  };
  keyMetrics: Array<{
    metric: string;
    currentTime: number;
    optimizedTime: number;
    improvement: number;
    status: string;
    automationLevel: number;
  }>;
  workflowTemplates: Array<{
    id: string;
    name: string;
    description: string;
    steps: number;
    avgDuration: number;
    automationLevel: number;
    successRate: number;
    category: string;
    status: string;
    usageCount: number;
    lastUpdated: Date;
  }>;
  processAnalytics: {
    bottlenecks: Array<{
      process: string;
      step: string;
      avgDelay: number;
      impact: string;
      frequency: number;
      recommendation: string;
    }>;
    efficiency: Array<{
      department: string;
      currentEfficiency: number;
      targetEfficiency: number;
      gap: number;
      improvementAreas: string[];
      estimatedROI: number;
    }>;
    trends: Array<{
      month: string;
      efficiency: number;
      automation: number;
      processes: number;
    }>;
  };
  automationOpportunities: Array<{
    id: string;
    process: string;
    description: string;
    currentEffort: number;
    estimatedReduction: number;
    potentialSavings: number;
    complexity: string;
    priority: string;
    implementationTime: number;
    roi: number;
    status: string;
  }>;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'optimized': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800';
    case 'pending': return 'bg-gray-100 text-gray-800';
    default: return 'bg-blue-100 text-blue-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getComplexityColor = (complexity: string) => {
  switch (complexity) {
    case 'low': return 'bg-green-100 text-green-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'high': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export default function BusinessProcessOptimization() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [showCreateWorkflow, setShowCreateWorkflow] = useState(false);

  // Fetch process optimization data
  const { data: processData, isLoading, refetch } = useQuery({
    queryKey: ['/api/business-process/dashboard', selectedCategory, selectedDepartment],
    select: (data: any) => ({
      ...data,
      workflowTemplates: data.workflowTemplates?.map((template: any) => ({
        ...template,
        lastUpdated: new Date(template.lastUpdated)
      })) || []
    }),
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading process optimization dashboard...</p>
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
            <Settings className="h-6 w-6" />
            Business Process Optimization
          </h1>
          <p className="text-gray-600 mt-1">Streamline workflows, automate processes, and improve efficiency</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="customer">Customer Management</SelectItem>
              <SelectItem value="service">Service Operations</SelectItem>
              <SelectItem value="finance">Financial Management</SelectItem>
              <SelectItem value="equipment">Equipment Management</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Dialog open={showCreateWorkflow} onOpenChange={setShowCreateWorkflow}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Workflow
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Workflow Template</DialogTitle>
                <DialogDescription>
                  Design a new automated workflow to streamline your business processes
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="workflow-name">Workflow Name</Label>
                    <Input id="workflow-name" placeholder="Enter workflow name" />
                  </div>
                  <div>
                    <Label htmlFor="workflow-category">Category</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Customer Management</SelectItem>
                        <SelectItem value="service">Service Operations</SelectItem>
                        <SelectItem value="finance">Financial Management</SelectItem>
                        <SelectItem value="equipment">Equipment Management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="workflow-description">Description</Label>
                  <Textarea id="workflow-description" placeholder="Describe the workflow purpose and goals" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateWorkflow(false)}>
                    Cancel
                  </Button>
                  <Button>
                    Create Workflow
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {processData && (
        <>
          {/* Process Overview KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Process Efficiency</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(processData.processOverview.processEfficiency)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Target className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <Progress value={processData.processOverview.processEfficiency} className="h-2" />
                  <p className="text-sm text-gray-500 mt-1">Target: 90%</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Automation Rate</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(processData.processOverview.automationRate)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Bot className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-2">
                  <Progress value={processData.processOverview.automationRate} className="h-2" />
                  <p className="text-sm text-gray-500 mt-1">{processData.processOverview.automatedProcesses}/{processData.processOverview.totalProcesses} processes</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Cost Savings</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(processData.processOverview.costSavings)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="ml-2 text-sm font-medium text-green-600">
                    Annual savings from optimization
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Time Reduction</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(processData.processOverview.timeReduction)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Clock className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center mt-2">
                  <Timer className="h-4 w-4 text-blue-600" />
                  <span className="ml-2 text-sm text-blue-600">
                    Avg {processData.processOverview.avgProcessTime}h per process
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="workflows" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 sm:gap-0">
              <TabsTrigger value="workflows" className="text-xs sm:text-sm px-2 py-2">Workflows</TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs sm:text-sm px-2 py-2">Metrics</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs sm:text-sm px-2 py-2">Analytics</TabsTrigger>
              <TabsTrigger value="automation" className="text-xs sm:text-sm px-2 py-2">Automation</TabsTrigger>
              <TabsTrigger value="compliance" className="text-xs sm:text-sm px-2 py-2">Compliance</TabsTrigger>
            </TabsList>

            <TabsContent value="workflows" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {processData.workflowTemplates.map((workflow: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{workflow.name}</CardTitle>
                          <CardDescription className="mt-1">{workflow.description}</CardDescription>
                        </div>
                        <Badge className={getStatusColor(workflow.status)}>
                          {workflow.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Steps:</span>
                            <span className="ml-2 font-medium">{workflow.steps}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Duration:</span>
                            <span className="ml-2 font-medium">{workflow.avgDuration} days</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Success Rate:</span>
                            <span className="ml-2 font-medium">{formatPercentage(workflow.successRate)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Used:</span>
                            <span className="ml-2 font-medium">{workflow.usageCount}x</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Automation Level</span>
                            <span className="text-sm font-medium">{formatPercentage(workflow.automationLevel)}</span>
                          </div>
                          <Progress value={workflow.automationLevel} className="h-2" />
                        </div>

                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{workflow.category}</Badge>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm">
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="text-xs text-gray-500">
                          Last updated: {format(workflow.lastUpdated, 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-6">
              <div className="space-y-4">
                {processData.keyMetrics.map((metric: any, idx: number) => (
                  <Card key={idx}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{metric.metric}</h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span>Current: {metric.currentTime}h</span>
                            <span>Optimized: {metric.optimizedTime}h</span>
                            <span className="font-medium text-green-600">
                              {formatPercentage(metric.improvement)} improvement
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(metric.status)}>
                            {metric.status.replace('_', ' ')}
                          </Badge>
                          {metric.status === 'optimized' && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Time Reduction</span>
                            <span className="text-sm font-medium">
                              -{(metric.currentTime - metric.optimizedTime).toFixed(1)}h
                            </span>
                          </div>
                          <Progress value={metric.improvement} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Automation Level</span>
                            <span className="text-sm font-medium">{formatPercentage(metric.automationLevel)}</span>
                          </div>
                          <Progress value={metric.automationLevel} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Process Bottlenecks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Process Bottlenecks
                    </CardTitle>
                    <CardDescription>Identify and resolve process delays</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {processData.processAnalytics.bottlenecks.map((bottleneck: any, idx: number) => (
                        <div key={idx} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{bottleneck.process}</div>
                              <div className="text-sm text-gray-600 mt-1">{bottleneck.step}</div>
                              <div className="text-xs text-gray-500 mt-2">
                                Avg delay: {bottleneck.avgDelay} days • {bottleneck.frequency} occurrences/month
                              </div>
                            </div>
                            <Badge className={bottleneck.impact === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                              {bottleneck.impact} impact
                            </Badge>
                          </div>
                          <div className="mt-3 p-3 bg-blue-50 rounded text-sm text-blue-800">
                            <strong>Recommendation:</strong> {bottleneck.recommendation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Department Efficiency */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Department Efficiency
                    </CardTitle>
                    <CardDescription>Efficiency scores and improvement opportunities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {processData.processAnalytics.efficiency.map((dept: any, idx: number) => (
                        <div key={idx} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{dept.department}</span>
                            <div className="text-right">
                              <div className="text-sm font-bold">{formatPercentage(dept.currentEfficiency)}</div>
                              <div className="text-xs text-gray-500">Target: {formatPercentage(dept.targetEfficiency)}</div>
                            </div>
                          </div>
                          
                          <Progress value={dept.currentEfficiency} className="h-2" />
                          
                          <div className="text-sm">
                            <div className="text-gray-600 mb-1">Improvement Areas:</div>
                            <div className="flex flex-wrap gap-1">
                              {dept.improvementAreas.map((area: string, areaIdx: number) => (
                                <Badge key={areaIdx} variant="outline" className="text-xs">
                                  {area}
                                </Badge>
                              ))}
                            </div>
                            <div className="text-green-600 font-medium mt-2">
                              Est. ROI: {formatCurrency(dept.estimatedROI)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Process Optimization Trends
                  </CardTitle>
                  <CardDescription>Track efficiency and automation progress over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">Trends chart would be rendered here</p>
                      <p className="text-sm text-gray-500">
                        Showing efficiency trends from {processData.processAnalytics.trends[0]?.month} to{' '}
                        {processData.processAnalytics.trends[processData.processAnalytics.trends.length - 1]?.month}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="automation" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {processData.automationOpportunities.map((opportunity: any, idx: number) => (
                  <Card key={idx} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{opportunity.process}</CardTitle>
                          <CardDescription className="mt-1">{opportunity.description}</CardDescription>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge className={getPriorityColor(opportunity.priority)}>
                            {opportunity.priority} priority
                          </Badge>
                          <Badge className={getComplexityColor(opportunity.complexity)}>
                            {opportunity.complexity} complexity
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Current Effort:</span>
                            <span className="ml-2 font-medium">{opportunity.currentEffort}h</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Reduction:</span>
                            <span className="ml-2 font-medium">{formatPercentage(opportunity.estimatedReduction)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Implementation:</span>
                            <span className="ml-2 font-medium">{opportunity.implementationTime}w</span>
                          </div>
                          <div>
                            <span className="text-gray-500">ROI:</span>
                            <span className="ml-2 font-medium">{formatPercentage(opportunity.roi)}</span>
                          </div>
                        </div>

                        <div className="p-3 bg-green-50 rounded">
                          <div className="text-sm font-medium text-green-800 mb-1">Potential Savings</div>
                          <div className="text-lg font-bold text-green-900">
                            {formatCurrency(opportunity.potentialSavings)}
                          </div>
                          <div className="text-xs text-green-600">Annual savings</div>
                        </div>

                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="capitalize">
                            {opportunity.status.replace('_', ' ')}
                          </Badge>
                          <Button size="sm">
                            <Zap className="h-4 w-4 mr-2" />
                            Implement
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Compliance Standards */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Compliance Standards
                    </CardTitle>
                    <CardDescription>Current compliance status and audit results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">ISO 9001:2015</div>
                          <Badge className="bg-green-100 text-green-800">Compliant</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>Score: <span className="font-medium">96.7%</span></div>
                          <div>Last Audit: <span className="font-medium">Nov 2024</span></div>
                          <div>Non-conformities: <span className="font-medium">2</span></div>
                          <div>Next Audit: <span className="font-medium">Nov 2025</span></div>
                        </div>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">SOC 2 Type II</div>
                          <Badge className="bg-green-100 text-green-800">Compliant</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>Score: <span className="font-medium">94.2%</span></div>
                          <div>Last Audit: <span className="font-medium">Sep 2024</span></div>
                          <div>Non-conformities: <span className="font-medium">1</span></div>
                          <div>Next Audit: <span className="font-medium">Sep 2025</span></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quality Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Quality Metrics
                    </CardTitle>
                    <CardDescription>Process documentation and quality indicators</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Process Documentation</span>
                            <span className="text-sm font-medium">94.7%</span>
                          </div>
                          <Progress value={94.7} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Standard Adherence</span>
                            <span className="text-sm font-medium">91.3%</span>
                          </div>
                          <Progress value={91.3} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Employee Training</span>
                            <span className="text-sm font-medium">88.9%</span>
                          </div>
                          <Progress value={88.9} className="h-2" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-600">Audit Readiness</span>
                            <span className="text-sm font-medium">96.1%</span>
                          </div>
                          <Progress value={96.1} className="h-2" />
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 rounded">
                        <div className="text-sm font-medium text-blue-800 mb-1">Continuous Improvement</div>
                        <div className="text-lg font-bold text-blue-900">14 initiatives</div>
                        <div className="text-xs text-blue-600">Active this quarter</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Assessment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Risk Assessment
                  </CardTitle>
                  <CardDescription>Identified risks and mitigation strategies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-yellow-800">Manual Process Dependencies</div>
                          <div className="text-sm text-yellow-700 mt-1">
                            45% probability • High impact
                          </div>
                          <div className="text-sm text-yellow-600 mt-2">
                            <strong>Mitigation:</strong> Accelerate automation initiatives for critical processes
                          </div>
                          <div className="text-xs text-yellow-600 mt-1">
                            Owner: Process Excellence Team • Due: Mar 31, 2025
                          </div>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>
                      </div>
                    </div>

                    <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-yellow-800">Knowledge Concentration</div>
                          <div className="text-sm text-yellow-700 mt-1">
                            35% probability • High impact
                          </div>
                          <div className="text-sm text-yellow-600 mt-2">
                            <strong>Mitigation:</strong> Implement knowledge management system and cross-training
                          </div>
                          <div className="text-xs text-yellow-600 mt-1">
                            Owner: HR Department • Due: Apr 15, 2025
                          </div>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
      </div>
    </MainLayout>
  );
}