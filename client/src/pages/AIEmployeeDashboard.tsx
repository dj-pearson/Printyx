// client/src/pages/AIEmployeeDashboard.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
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
  Users,
  Bot,
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
} from 'lucide-react';

interface AIEmployee {
  id: string;
  employeeName: string;
  employeeType: string;
  employeeRole: string;
  status: string;
  autonomyLevel: string;
  successRate: number;
  totalTasksCompleted: number;
  userSatisfactionRating: number;
  aiPersonality: any;
  aiExpertiseAreas: string[];
  aiCapabilities: string[];
}

interface Task {
  id: string;
  taskType: string;
  taskTitle: string;
  status: string;
  priority: string;
  assignedAt: string;
  completedAt?: string;
  qualityScore?: number;
  executionTimeMinutes?: number;
  employee: string;
}

interface AnalyticsData {
  totalEmployees: number;
  activeEmployees: number;
  totalTasksToday: number;
  completedTasksToday: number;
  averageQualityScore: number;
  averageResponseTime: number;
  costSavings: number;
  customerSatisfaction: number;
  employeeTypes: Array<{ type: string; count: number; efficiency: number }>;
  recentTasks: Array<{
    id: string;
    type: string;
    status: string;
    employee: string;
    duration: string;
  }>;
  performanceTrends: {
    tasksCompleted: number[];
    qualityScores: number[];
    responseTime: number[];
  };
}

const mockEmployees: AIEmployee[] = [
  {
    id: '1',
    employeeName: 'Sales Assistant AI',
    employeeType: 'sales_assistant',
    employeeRole:
      'AI Sales Representative specializing in lead qualification and customer engagement',
    status: 'active',
    autonomyLevel: 'supervised',
    successRate: 0.85,
    totalTasksCompleted: 127,
    userSatisfactionRating: 4.3,
    aiPersonality: { communication_style: 'professional_friendly', proactivity: 'high' },
    aiExpertiseAreas: ['lead_qualification', 'product_knowledge', 'pricing_strategies'],
    aiCapabilities: ['lead_scoring', 'email_outreach', 'appointment_scheduling'],
  },
  {
    id: '2',
    employeeName: 'Support Agent AI',
    employeeType: 'support_agent',
    employeeRole: 'AI Customer Support Specialist for technical assistance and issue resolution',
    status: 'active',
    autonomyLevel: 'semi_autonomous',
    successRate: 0.88,
    totalTasksCompleted: 203,
    userSatisfactionRating: 4.5,
    aiPersonality: { communication_style: 'helpful_patient', problem_solving: 'systematic' },
    aiExpertiseAreas: ['technical_troubleshooting', 'product_support', 'customer_communication'],
    aiCapabilities: ['ticket_triage', 'solution_research', 'customer_communication'],
  },
  {
    id: '3',
    employeeName: 'Data Analyst AI',
    employeeType: 'data_analyst',
    employeeRole: 'AI Business Intelligence Analyst for data analysis and reporting',
    status: 'active',
    autonomyLevel: 'autonomous',
    successRate: 0.92,
    totalTasksCompleted: 89,
    userSatisfactionRating: 4.7,
    aiPersonality: { analytical_approach: 'thorough', attention_to_detail: 'high' },
    aiExpertiseAreas: ['data_analysis', 'statistical_modeling', 'report_generation'],
    aiCapabilities: ['data_processing', 'visualization_creation', 'insight_generation'],
  },
  {
    id: '4',
    employeeName: 'Project Manager AI',
    employeeType: 'project_manager',
    employeeRole: 'AI Project Coordinator for task management and team coordination',
    status: 'active',
    autonomyLevel: 'semi_autonomous',
    successRate: 0.79,
    totalTasksCompleted: 156,
    userSatisfactionRating: 4.1,
    aiPersonality: { leadership_style: 'collaborative', organization_level: 'high' },
    aiExpertiseAreas: ['project_planning', 'resource_allocation', 'timeline_management'],
    aiCapabilities: ['task_assignment', 'progress_tracking', 'risk_assessment'],
  },
];

const mockAnalytics: AnalyticsData = {
  totalEmployees: 4,
  activeEmployees: 4,
  totalTasksToday: 23,
  completedTasksToday: 19,
  averageQualityScore: 82,
  averageResponseTime: 1.2,
  costSavings: 1250.0,
  customerSatisfaction: 4.3,
  employeeTypes: [
    { type: 'sales_assistant', count: 1, efficiency: 85 },
    { type: 'support_agent', count: 1, efficiency: 88 },
    { type: 'data_analyst', count: 1, efficiency: 92 },
    { type: 'project_manager', count: 1, efficiency: 79 },
  ],
  recentTasks: [
    {
      id: '1',
      type: 'lead_qualification',
      status: 'completed',
      employee: 'Sales Assistant AI',
      duration: '2m',
    },
    {
      id: '2',
      type: 'customer_support',
      status: 'completed',
      employee: 'Support Agent AI',
      duration: '15m',
    },
    {
      id: '3',
      type: 'data_analysis',
      status: 'in_progress',
      employee: 'Data Analyst AI',
      duration: '25m',
    },
    {
      id: '4',
      type: 'report_generation',
      status: 'completed',
      employee: 'Data Analyst AI',
      duration: '8m',
    },
  ],
  performanceTrends: {
    tasksCompleted: [15, 18, 22, 19, 23, 21, 25],
    qualityScores: [78, 80, 82, 84, 82, 85, 82],
    responseTime: [1.5, 1.3, 1.2, 1.1, 1.2, 1.0, 1.2],
  },
};

const AIEmployeeDashboard: React.FC = () => {
  const [employees, setEmployees] = useState<AIEmployee[]>(mockEmployees);
  const [analytics, setAnalytics] = useState<AnalyticsData>(mockAnalytics);
  const [selectedEmployee, setSelectedEmployee] = useState<AIEmployee | null>(null);
  const [loading, setLoading] = useState(false);

  const getEmployeeIcon = (type: string) => {
    switch (type) {
      case 'sales_assistant':
        return <Target className="h-5 w-5" />;
      case 'support_agent':
        return <Phone className="h-5 w-5" />;
      case 'data_analyst':
        return <BarChart3 className="h-5 w-5" />;
      case 'project_manager':
        return <Briefcase className="h-5 w-5" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'training':
        return 'bg-blue-100 text-blue-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAutonomyColor = (level: string) => {
    switch (level) {
      case 'autonomous':
        return 'bg-purple-100 text-purple-800';
      case 'semi_autonomous':
        return 'bg-blue-100 text-blue-800';
      case 'supervised':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAssignTask = (employeeId: string) => {
    // Mock task assignment
    console.log('Assigning task to employee:', employeeId);
  };

  const handleToggleEmployee = (employeeId: string) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === employeeId
          ? { ...emp, status: emp.status === 'active' ? 'inactive' : 'active' }
          : emp,
      ),
    );
  };

  return (
    <MainLayout
      title="AI Employees"
      description="Intelligent agents and workflow automation with specialized AI employees for various business functions"
    >
      {/* Action buttons */}
      <div className="flex justify-end gap-3 mb-6">
        <Button>
          <Sparkles className="h-4 w-4 mr-2" />
          Create AI Employee
        </Button>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Employees</p>
                <p className="text-2xl font-bold">
                  {analytics.activeEmployees}/{analytics.totalEmployees}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasks Today</p>
                <p className="text-2xl font-bold">
                  {analytics.completedTasksToday}/{analytics.totalTasksToday}
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
                <p className="text-sm font-medium text-gray-600">Avg Quality Score</p>
                <p className="text-2xl font-bold">{analytics.averageQualityScore}%</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cost Savings</p>
                <p className="text-2xl font-bold">${analytics.costSavings}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-2" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <Activity className="h-4 w-4 mr-2" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="workflows">
            <Zap className="h-4 w-4 mr-2" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.map((employee) => (
              <Card key={employee.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-100">
                          {getEmployeeIcon(employee.employeeType)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{employee.employeeName}</CardTitle>
                        <CardDescription className="text-sm">
                          {employee.employeeType.replace('_', ' ')}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getStatusColor(employee.status)}>{employee.status}</Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Autonomy Level</span>
                    <Badge className={getAutonomyColor(employee.autonomyLevel)} variant="outline">
                      {employee.autonomyLevel.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Success Rate</span>
                      <span className="font-medium">
                        {(employee.successRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={employee.successRate * 100} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Tasks Completed</p>
                      <p className="font-semibold">{employee.totalTasksCompleted}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Satisfaction</p>
                      <p className="font-semibold flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500 fill-current" />
                        {employee.userSatisfactionRating.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Capabilities</p>
                    <div className="flex flex-wrap gap-1">
                      {employee.aiCapabilities.slice(0, 3).map((capability, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {capability.replace('_', ' ')}
                        </Badge>
                      ))}
                      {employee.aiCapabilities.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{employee.aiCapabilities.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleAssignTask(employee.id)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Assign Task
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleEmployee(employee.id)}
                  >
                    {employee.status === 'active' ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedEmployee(employee)}>
                    <Settings className="h-3 w-3" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Tasks</CardTitle>
              <CardDescription>Latest tasks assigned to AI employees</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {task.type === 'lead_qualification' && <Target className="h-4 w-4" />}
                        {task.type === 'customer_support' && <Phone className="h-4 w-4" />}
                        {task.type === 'data_analysis' && <BarChart3 className="h-4 w-4" />}
                        {task.type === 'report_generation' && <FileText className="h-4 w-4" />}
                        <div>
                          <p className="font-medium">{task.type.replace('_', ' ')}</p>
                          <p className="text-sm text-gray-600">{task.employee}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge
                        className={
                          task.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : task.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {task.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {task.duration}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Lead Processing Workflow</CardTitle>
                <CardDescription>Complete lead qualification and nurturing process</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-semibold">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Lead Capture</p>
                      <p className="text-sm text-gray-600">Capture and validate lead information</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-semibold">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Lead Scoring</p>
                      <p className="text-sm text-gray-600">
                        Score lead based on qualification criteria
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-semibold">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Initial Outreach</p>
                      <p className="text-sm text-gray-600">Send personalized outreach message</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Execute Workflow
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Support Workflow</CardTitle>
                <CardDescription>
                  Handle customer support requests from initial contact to resolution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-semibold">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Ticket Triage</p>
                      <p className="text-sm text-gray-600">
                        Categorize and prioritize support ticket
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-semibold">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Initial Response</p>
                      <p className="text-sm text-gray-600">
                        Send acknowledgment and initial guidance
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-semibold">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Issue Investigation</p>
                      <p className="text-sm text-gray-600">
                        Research and analyze the customer issue
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Execute Workflow
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Employee Performance</CardTitle>
                <CardDescription>Efficiency by employee type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.employeeTypes.map((type) => (
                    <div key={type.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getEmployeeIcon(type.type)}
                        <span className="font-medium">{type.type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={type.efficiency} className="w-20 h-2" />
                        <span className="text-sm font-medium w-12">{type.efficiency}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>Weekly performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Tasks Completed</span>
                      <span className="text-sm text-gray-600">Weekly Average: 21</span>
                    </div>
                    <div className="flex items-end gap-1 h-16">
                      {analytics.performanceTrends.tasksCompleted.map((value, idx) => (
                        <div
                          key={idx}
                          className="bg-blue-500 rounded-t flex-1"
                          style={{ height: `${(value / 25) * 100}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Quality Score</span>
                      <span className="text-sm text-gray-600">Weekly Average: 82%</span>
                    </div>
                    <div className="flex items-end gap-1 h-16">
                      {analytics.performanceTrends.qualityScores.map((value, idx) => (
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

      {/* Employee Detail Modal would go here */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-blue-100">
                      {getEmployeeIcon(selectedEmployee.employeeType)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{selectedEmployee.employeeName}</CardTitle>
                    <CardDescription>{selectedEmployee.employeeRole}</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setSelectedEmployee(null)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <Badge className={getStatusColor(selectedEmployee.status)}>
                    {selectedEmployee.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Autonomy Level</p>
                  <Badge className={getAutonomyColor(selectedEmployee.autonomyLevel)}>
                    {selectedEmployee.autonomyLevel.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Expertise Areas</p>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.aiExpertiseAreas.map((area, idx) => (
                    <Badge key={idx} variant="outline">
                      {area.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Capabilities</p>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.aiCapabilities.map((capability, idx) => (
                    <Badge key={idx} variant="secondary">
                      {capability.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{selectedEmployee.totalTasksCompleted}</p>
                  <p className="text-sm text-gray-600">Tasks Completed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {(selectedEmployee.successRate * 100).toFixed(0)}%
                  </p>
                  <p className="text-sm text-gray-600">Success Rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold flex items-center justify-center gap-1">
                    <Star className="h-5 w-5 text-yellow-500 fill-current" />
                    {selectedEmployee.userSatisfactionRating.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-600">Satisfaction</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                Assign Task
              </Button>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </MainLayout>
  );
};

export default AIEmployeeDashboard;
