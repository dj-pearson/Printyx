// client/src/pages/AIEmployeeDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useActionParam } from '@/hooks/use-action-param';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, invalidateApiPath } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { useToast } from '@/hooks/use-toast';
import { describeApiError } from '@/lib/api-error';
import {
  assignTaskBody,
  createEmployeeBody,
  TASK_PRIORITIES,
  type AiEmployeeTemplate,
} from '@/lib/ai-employee-forms';
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
  /** AUDIT-015: null when unknown. Nothing records a savings figure, so it is
   *  reported as unknown rather than invented. */
  costSavings: number | null;
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

/**
 * AUDIT-015: the API returns raw `SELECT * FROM ai_employees` rows, i.e. snake_case,
 * while this page reads camelCase. Bridging at the query boundary (the AUDIT-011
 * lesson) — without this every field renders blank against real data.
 */
function toAiEmployee(row: any): AIEmployee {
  return {
    id: String(row.id ?? ''),
    employeeName: row.employeeName ?? row.employee_name ?? '',
    employeeType: row.employeeType ?? row.employee_type ?? '',
    employeeRole: row.employeeRole ?? row.employee_role ?? '',
    status: row.status ?? 'active',
    autonomyLevel: row.autonomyLevel ?? row.autonomy_level ?? '',
    successRate: Number(row.successRate ?? row.success_rate ?? 0),
    totalTasksCompleted: Number(row.totalTasksCompleted ?? row.total_tasks_completed ?? 0),
    userSatisfactionRating: Number(row.userSatisfactionRating ?? row.user_satisfaction_rating ?? 0),
    aiPersonality: row.aiPersonality ?? row.ai_personality ?? {},
    aiExpertiseAreas: row.aiExpertiseAreas ?? row.ai_expertise_areas ?? [],
    aiCapabilities: row.aiCapabilities ?? row.ai_capabilities ?? [],
  };
}

const EMPTY_ANALYTICS: AnalyticsData = {
  totalEmployees: 0,
  activeEmployees: 0,
  totalTasksToday: 0,
  completedTasksToday: 0,
  averageQualityScore: 0,
  averageResponseTime: 0,
  costSavings: null,
  customerSatisfaction: 0,
  employeeTypes: [],
  recentTasks: [],
  performanceTrends: { tasksCompleted: [], qualityScores: [], responseTime: [] },
};

const AIEmployeeDashboard: React.FC = () => {
  // AUDIT-015: was useState(mockEmployees) / useState(mockAnalytics) — this page is
  // routed at /ai-employees and showed fabricated employees and metrics as if live.
  // Both endpoints are real now: the router is authenticated (it used to stub auth
  // with mock-user-id/mock-tenant-id) and analytics/overview aggregates real rows
  // instead of returning a hardcoded object.
  const { data: employees = [], isLoading: employeesLoading } = useQuery<AIEmployee[]>({
    queryKey: ['/api/ai-employees'],
    queryFn: async () => {
      const res = await apiRequest('/api/ai-employees', 'GET');
      // Envelope: { success, data, count }
      return (res?.data ?? []).map(toAiEmployee);
    },
  });

  const { data: analytics = EMPTY_ANALYTICS, isLoading: analyticsLoading } =
    useQuery<AnalyticsData>({
      queryKey: ['/api/ai-employees/analytics/overview'],
      queryFn: async () => {
        const res = await apiRequest('/api/ai-employees/analytics/overview', 'GET');
        return (res?.data as AnalyticsData) ?? EMPTY_ANALYTICS;
      },
    });

  const [selectedEmployee, setSelectedEmployee] = useState<AIEmployee | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // AI Hub's "Deploy AI Agent" links here with ?action=new.
  const action = useActionParam();
  useEffect(() => {
    if (action === 'new') setCreateOpen(true);
  }, [action]);
  const [assignTarget, setAssignTarget] = useState<AIEmployee | null>(null);
  const loading = employeesLoading || analyticsLoading;

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

  // AUDIT-015 removed a console.log "Assign Task" and a pause toggle that only
  // flipped local state. Round 220 built the form that note said Assign Task
  // needed: CreateEmployeeDialog posts a template-based body to POST
  // /ai-employees, AssignTaskDialog posts to POST /ai-employees/tasks (which
  // is rate-limited per tenant, since it calls Claude). The header Settings
  // and the detail card's Configure buttons had no handler and there is still
  // no PATCH on this router, so they are gone rather than wired to nothing.

  return (
    <MainLayout
      title="AI Employees"
      description="Intelligent agents and workflow automation with specialized AI employees for various business functions"
    >
      {/* Action buttons */}
      <div className="flex justify-end gap-3 mb-6">
        <Button onClick={() => setCreateOpen(true)}>
          <Sparkles className="h-4 w-4 mr-2" />
          Create AI Employee
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
                {/* AUDIT-015: no source of truth for savings — show unknown, not a
                    fabricated figure. */}
                <p className="text-2xl font-bold">
                  {analytics.costSavings == null ? '—' : `$${analytics.costSavings}`}
                </p>
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
              <Button
                className="flex-1"
                onClick={() => {
                  // The detail card is a hand-built overlay; close it so the
                  // task dialog is the only thing on screen.
                  setAssignTarget(selectedEmployee);
                  setSelectedEmployee(null);
                }}
              >
                <Play className="h-4 w-4 mr-2" />
                Assign Task
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      <CreateEmployeeDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AssignTaskDialog employee={assignTarget} onClose={() => setAssignTarget(null)} />
    </MainLayout>
  );
};

function CreateEmployeeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');

  const templatesQuery = useQuery<AiEmployeeTemplate[]>({
    queryKey: ['/api/ai-employees/templates'],
    enabled: open,
  });
  const templates = templatesQuery.data ?? [];
  const template = templates.find((t) => t.id === templateId) ?? null;
  const body = createEmployeeBody(template, name);

  const create = useMutation({
    mutationFn: () => apiRequest('/api/ai-employees', 'POST', body),
    onSuccess: () => {
      toast({ title: 'AI employee created', description: body?.employeeName });
      invalidateApiPath('/api/ai-employees');
      setTemplateId('');
      setName('');
      onOpenChange(false);
    },
    onError: (err) =>
      toast({
        title: 'Could not create AI employee',
        description: describeApiError(err).message,
        variant: 'destructive',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create AI employee</DialogTitle>
          <DialogDescription>Start from one of the built-in roles.</DialogDescription>
        </DialogHeader>
        {templatesQuery.isError ? (
          <InlineQueryError label="the role templates" onRetry={() => templatesQuery.refetch()} />
        ) : (
          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Role</span>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={templatesQuery.isLoading ? 'Loading roles...' : 'Choose a role'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {template?.description && (
              <p className="text-sm text-muted-foreground">{template.description}</p>
            )}
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!body || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignTaskDialog({
  employee,
  onClose,
}: {
  employee: AIEmployee | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [taskType, setTaskType] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');

  const body = assignTaskBody(employee?.id, {
    taskType,
    taskTitle,
    taskDescription,
    taskPriority,
  });

  const reset = () => {
    setTaskType('');
    setTaskTitle('');
    setTaskDescription('');
    setTaskPriority('medium');
  };

  const assign = useMutation({
    mutationFn: () => apiRequest('/api/ai-employees/tasks', 'POST', body),
    onSuccess: () => {
      toast({ title: 'Task assigned', description: body?.taskTitle });
      invalidateApiPath('/api/ai-employees');
      reset();
      onClose();
    },
    onError: (err) =>
      toast({
        title: 'Could not assign task',
        description: describeApiError(err).message,
        variant: 'destructive',
      }),
  });

  return (
    <Dialog
      open={employee !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign task</DialogTitle>
          <DialogDescription>{employee?.employeeName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Task type</span>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger>
                <SelectValue placeholder="What kind of work" />
              </SelectTrigger>
              <SelectContent>
                {(employee?.aiCapabilities.length
                  ? employee.aiCapabilities
                  : ['general_assistance']
                ).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Title</span>
            <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Details</span>
            <Textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows={4}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Priority</span>
            <Select value={taskPriority} onValueChange={setTaskPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button disabled={!body || assign.isPending} onClick={() => assign.mutate()}>
            {assign.isPending ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AIEmployeeDashboard;
