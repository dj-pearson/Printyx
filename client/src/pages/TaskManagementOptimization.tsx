import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from '@/components/layout/main-layout';
import { 
  CheckSquare, TrendingUp, AlertTriangle, Clock, Users, Brain,
  Target, Activity, BarChart3, Lightbulb, Settings, Calendar,
  Filter, Eye, Zap, FileText, User, Trophy, ArrowUp, ArrowDown,
  Play, Pause, RotateCcw, MessageSquare, Sparkles, Timer,
  PieChart, LineChart, Gauge, Flag, Star, UserCheck
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, subDays, addDays, differenceInDays } from "date-fns";
import { MobileFAB } from "@/components/ui/mobile-fab";
import ContextualHelp from "@/components/contextual/ContextualHelp";
import PageAlerts from "@/components/contextual/PageAlerts";

// Types
interface TaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageCompletionTime: number;
  productivityScore: number;
  teamUtilization: number;
  activeProjects: number;
}

interface ProductivityIntelligence {
  id: string;
  type: 'workload_optimization' | 'deadline_prediction' | 'skill_matching' | 'productivity_insight' | 'automation_opportunity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  confidence: number;
  impactArea: string;
  productivityIncrease: number;
  actionRequired: boolean;
  timeframe: string;
  affectedTeamMembers: string[];
  priority: number;
}

interface SmartTaskAssignment {
  taskId: string;
  taskTitle: string;
  taskType: string;
  complexity: 'low' | 'medium' | 'high';
  estimatedHours: number;
  requiredSkills: string[];
  recommendedAssignees: {
    userId: string;
    userName: string;
    matchScore: number;
    availability: number;
    skillMatch: number;
    currentWorkload: number;
    pastPerformance: number;
    estimatedCompletionTime: number;
    reasons: string[];
  }[];
  alternativeOptions: string[];
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  optimalStartDate: string;
}

interface PredictiveProjectManagement {
  projectId: string;
  projectName: string;
  currentProgress: number;
  predictedCompletion: string;
  originalDeadline: string;
  riskLevel: 'low' | 'medium' | 'high';
  delayProbability: number;
  bottlenecks: {
    area: string;
    impact: string;
    suggestion: string;
  }[];
  resourceNeeds: {
    skill: string;
    currentCapacity: number;
    requiredCapacity: number;
    gap: number;
  }[];
  milestoneTracking: {
    milestone: string;
    plannedDate: string;
    predictedDate: string;
    status: 'on_track' | 'at_risk' | 'delayed';
  }[];
  successFactors: string[];
  riskFactors: string[];
}

interface TeamProductivity {
  userId: string;
  userName: string;
  role: string;
  currentWorkload: number;
  capacity: number;
  utilizationRate: number;
  productivityScore: number;
  completionRate: number;
  averageTaskTime: number;
  strengths: string[];
  improvementAreas: string[];
  recentTrends: {
    metric: string;
    change: number;
    direction: 'up' | 'down' | 'stable';
  }[];
  workloadRecommendation: 'reduce' | 'maintain' | 'increase';
  skillDevelopment: string[];
  burnoutRisk: number;
}

interface AutomatedWorkflow {
  workflowId: string;
  workflowName: string;
  triggerType: 'time_based' | 'event_based' | 'condition_based';
  automationLevel: 'partial' | 'full';
  tasksAutomated: number;
  timeSaved: number; // hours per week
  efficiencyGain: number;
  setup: {
    trigger: string;
    conditions: string[];
    actions: string[];
  };
  benefits: string[];
  implementationEffort: 'low' | 'medium' | 'high';
  roi: number;
}

interface IntelligentPrioritization {
  taskId: string;
  taskTitle: string;
  currentPriority: 'low' | 'medium' | 'high' | 'critical';
  aiRecommendedPriority: 'low' | 'medium' | 'high' | 'critical';
  priorityScore: number;
  factors: {
    businessImpact: number;
    urgency: number;
    effort: number;
    dependencies: number;
    stakeholderImportance: number;
  };
  reasoning: string;
  suggestedSchedule: string;
  blockers: string[];
  opportunityCost: string;
}

export default function TaskManagementOptimization() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("this_month");
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("productivity_score");
  const [viewMode, setViewMode] = useState<string>("ai_insights");
  const [aiOptimizationEnabled, setAiOptimizationEnabled] = useState(true);
  const [predictiveEnabled, setPredictiveEnabled] = useState(true);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Mock data - in real implementation, these would come from APIs
  const mockAnalytics: TaskAnalytics = {
    totalTasks: 847,
    completedTasks: 623,
    overdueTasks: 34,
    completionRate: 73.6,
    averageCompletionTime: 4.2,
    productivityScore: 82,
    teamUtilization: 78.5,
    activeProjects: 28
  };

  const mockIntelligence: ProductivityIntelligence[] = [
    {
      id: "intel-001",
      type: 'workload_optimization',
      severity: 'high',
      title: "Team Workload Imbalance Detected",
      description: "Sarah Johnson at 94% capacity while Mike Chen at 52% - redistribute for 18% productivity gain",
      recommendation: "Reassign 3 high-priority tasks from Sarah to Mike and adjust project timelines",
      confidence: 89,
      impactArea: "Team productivity and burnout prevention",
      productivityIncrease: 18,
      actionRequired: true,
      timeframe: "This week",
      affectedTeamMembers: ["Sarah Johnson", "Mike Chen"],
      priority: 1
    },
    {
      id: "intel-002",
      type: 'deadline_prediction',
      severity: 'critical',
      title: "Project Completion Risk",
      description: "Phoenix Implementation project 73% likely to miss deadline by 8 days",
      recommendation: "Add 1 additional developer and extend testing phase by 3 days",
      confidence: 87,
      impactArea: "Client delivery and reputation",
      productivityIncrease: 0,
      actionRequired: true,
      timeframe: "Immediate",
      affectedTeamMembers: ["Development Team"],
      priority: 1
    },
    {
      id: "intel-003",
      type: 'automation_opportunity',
      severity: 'medium',
      title: "Automation Opportunity Identified",
      description: "Invoice processing tasks consuming 12 hours/week - 85% automation potential",
      recommendation: "Implement automated invoice workflow to save 10+ hours weekly",
      confidence: 91,
      impactArea: "Administrative efficiency",
      productivityIncrease: 25,
      actionRequired: true,
      timeframe: "Next month",
      affectedTeamMembers: ["Finance Team"],
      priority: 3
    },
    {
      id: "intel-004",
      type: 'skill_matching',
      severity: 'medium',
      title: "Suboptimal Task Assignment",
      description: "React development tasks assigned to backend specialists - 40% efficiency loss",
      recommendation: "Reassign frontend tasks to specialists and provide cross-training",
      confidence: 84,
      impactArea: "Development efficiency",
      productivityIncrease: 32,
      actionRequired: true,
      timeframe: "Next week",
      affectedTeamMembers: ["Development Team"],
      priority: 2
    }
  ];

  const mockSmartAssignments: SmartTaskAssignment[] = [
    {
      taskId: "task-001",
      taskTitle: "Customer Portal UI Redesign",
      taskType: "Frontend Development",
      complexity: 'high',
      estimatedHours: 32,
      requiredSkills: ["React", "TypeScript", "UI/UX Design", "CSS"],
      recommendedAssignees: [
        {
          userId: "user-001",
          userName: "Alex Rodriguez",
          matchScore: 94,
          availability: 85,
          skillMatch: 98,
          currentWorkload: 65,
          pastPerformance: 92,
          estimatedCompletionTime: 28,
          reasons: [
            "Expert-level React and TypeScript skills",
            "Completed similar UI redesign projects",
            "Available for immediate start",
            "Strong design sense and attention to detail"
          ]
        },
        {
          userId: "user-002",
          userName: "Emma Thompson",
          matchScore: 87,
          availability: 70,
          skillMatch: 85,
          currentWorkload: 78,
          pastPerformance: 89,
          estimatedCompletionTime: 35,
          reasons: [
            "Strong React experience",
            "Good availability next week",
            "Previous portal development experience"
          ]
        }
      ],
      alternativeOptions: [
        "Split task between frontend and backend components",
        "Pair programming with junior developer for knowledge transfer"
      ],
      urgencyLevel: 'high',
      dependencies: ["API endpoint completion", "Design mockup approval"],
      optimalStartDate: "2024-08-15"
    }
  ];

  const mockPredictiveProjects: PredictiveProjectManagement[] = [
    {
      projectId: "proj-001",
      projectName: "Enterprise CRM Integration",
      currentProgress: 68,
      predictedCompletion: "2024-09-15",
      originalDeadline: "2024-09-12",
      riskLevel: 'medium',
      delayProbability: 35,
      bottlenecks: [
        {
          area: "API Integration Testing",
          impact: "3-day potential delay",
          suggestion: "Parallel testing with staging environment"
        },
        {
          area: "Database Migration",
          impact: "Risk of data consistency issues",
          suggestion: "Additional DBA review and rollback planning"
        }
      ],
      resourceNeeds: [
        {
          skill: "Backend Development",
          currentCapacity: 80,
          requiredCapacity: 100,
          gap: 20
        },
        {
          skill: "QA Testing",
          currentCapacity: 60,
          requiredCapacity: 85,
          gap: 25
        }
      ],
      milestoneTracking: [
        {
          milestone: "API Integration Complete",
          plannedDate: "2024-08-20",
          predictedDate: "2024-08-22",
          status: 'at_risk'
        },
        {
          milestone: "User Acceptance Testing",
          plannedDate: "2024-09-05",
          predictedDate: "2024-09-08",
          status: 'at_risk'
        }
      ],
      successFactors: [
        "Strong technical team expertise",
        "Good client communication",
        "Clear requirements documentation"
      ],
      riskFactors: [
        "Complex data migration requirements",
        "Third-party API dependencies",
        "Tight testing timeline"
      ]
    }
  ];

  const mockTeamProductivity: TeamProductivity[] = [
    {
      userId: "user-001",
      userName: "Sarah Johnson",
      role: "Senior Developer",
      currentWorkload: 94,
      capacity: 100,
      utilizationRate: 94,
      productivityScore: 88,
      completionRate: 92,
      averageTaskTime: 3.8,
      strengths: ["Problem solving", "Code quality", "Technical leadership"],
      improvementAreas: ["Time estimation", "Documentation"],
      recentTrends: [
        { metric: "Completion Rate", change: -5, direction: 'down' },
        { metric: "Code Quality", change: 8, direction: 'up' },
        { metric: "Task Velocity", change: -12, direction: 'down' }
      ],
      workloadRecommendation: 'reduce',
      skillDevelopment: ["Project management", "Architecture design"],
      burnoutRisk: 78
    },
    {
      userId: "user-002",
      userName: "Mike Chen",
      role: "Frontend Developer",
      currentWorkload: 52,
      capacity: 100,
      utilizationRate: 52,
      productivityScore: 85,
      completionRate: 89,
      averageTaskTime: 4.1,
      strengths: ["UI/UX implementation", "React expertise", "Fast delivery"],
      improvementAreas: ["Backend integration", "Testing"],
      recentTrends: [
        { metric: "Completion Rate", change: 12, direction: 'up' },
        { metric: "Code Quality", change: 5, direction: 'up' },
        { metric: "Task Velocity", change: 15, direction: 'up' }
      ],
      workloadRecommendation: 'increase',
      skillDevelopment: ["Full-stack development", "DevOps"],
      burnoutRisk: 15
    },
    {
      userId: "user-003",
      userName: "Emma Thompson",
      role: "QA Engineer",
      currentWorkload: 78,
      capacity: 100,
      utilizationRate: 78,
      productivityScore: 91,
      completionRate: 95,
      averageTaskTime: 2.9,
      strengths: ["Test automation", "Bug detection", "Process improvement"],
      improvementAreas: ["Performance testing", "Security testing"],
      recentTrends: [
        { metric: "Bug Detection", change: 18, direction: 'up' },
        { metric: "Test Coverage", change: 10, direction: 'up' },
        { metric: "Automation Rate", change: 22, direction: 'up' }
      ],
      workloadRecommendation: 'maintain',
      skillDevelopment: ["Security testing", "Load testing"],
      burnoutRisk: 25
    }
  ];

  const mockAutomatedWorkflows: AutomatedWorkflow[] = [
    {
      workflowId: "workflow-001",
      workflowName: "Invoice Processing Automation",
      triggerType: 'event_based',
      automationLevel: 'full',
      tasksAutomated: 45,
      timeSaved: 12,
      efficiencyGain: 85,
      setup: {
        trigger: "New invoice received via email",
        conditions: ["Invoice amount < $5000", "Vendor in approved list"],
        actions: ["Extract data", "Validate against PO", "Route for approval", "Update accounting system"]
      },
      benefits: [
        "Reduced manual data entry errors",
        "Faster processing time",
        "Better audit trail",
        "Improved vendor relationships"
      ],
      implementationEffort: 'medium',
      roi: 340
    },
    {
      workflowId: "workflow-002",
      workflowName: "Project Status Reporting",
      triggerType: 'time_based',
      automationLevel: 'partial',
      tasksAutomated: 28,
      timeSaved: 8,
      efficiencyGain: 70,
      setup: {
        trigger: "Every Monday at 9:00 AM",
        conditions: ["Active projects exist", "Status data available"],
        actions: ["Collect project metrics", "Generate dashboard", "Send stakeholder emails"]
      },
      benefits: [
        "Consistent reporting schedule",
        "Real-time project visibility",
        "Stakeholder engagement",
        "Early risk identification"
      ],
      implementationEffort: 'low',
      roi: 220
    }
  ];

  const filteredTeamMembers = mockTeamProductivity.filter(member => {
    return selectedTeamMember === "all" || member.userId === selectedTeamMember;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      case 'high': return 'bg-orange-100 border-orange-300 text-orange-800';
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'low': return 'bg-blue-100 border-blue-300 text-blue-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getWorkloadColor = (workload: number) => {
    if (workload >= 90) return 'text-red-600';
    if (workload >= 75) return 'text-orange-600';
    if (workload >= 50) return 'text-green-600';
    return 'text-blue-600';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-600" />;
      default: return <span className="h-4 w-4 text-gray-400">→</span>;
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Productivity Intelligence</h1>
            <p className="text-gray-600 mt-1">AI-powered task management and team productivity optimization</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsSettingsDialogOpen(true)}
              data-testid="button-productivity-settings"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Badge variant="outline" className="px-3 py-2">
              <Brain className="h-4 w-4 mr-2" />
              AI Optimization: {aiOptimizationEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        {/* Contextual Help */}
        <ContextualHelp page="task-management-optimization" />

        {/* Page Alerts */}
        <PageAlerts 
          alerts={mockIntelligence.filter(intel => intel.actionRequired && intel.severity === 'critical').map(intel => ({
            id: intel.id,
            type: 'error',
            title: intel.title,
            message: intel.description,
            action: {
              label: "Optimize Now",
              onClick: () => console.log(`Optimizing ${intel.id}`)
            }
          }))}
        />

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productivity Score</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="metric-productivity-score">
                {mockAnalytics.productivityScore}
              </div>
              <p className="text-xs text-muted-foreground">
                +8 from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="metric-completion-rate">
                {mockAnalytics.completionRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                {mockAnalytics.completedTasks} of {mockAnalytics.totalTasks} tasks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Utilization</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="metric-team-utilization">
                {mockAnalytics.teamUtilization}%
              </div>
              <p className="text-xs text-muted-foreground">
                Optimal: 75-85%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="metric-overdue-tasks">
                {mockAnalytics.overdueTasks}
              </div>
              <p className="text-xs text-muted-foreground">
                Need immediate attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">AI Overview</TabsTrigger>
            <TabsTrigger value="intelligence">Productivity Intelligence</TabsTrigger>
            <TabsTrigger value="assignments">Smart Assignments</TabsTrigger>
            <TabsTrigger value="projects">Predictive Projects</TabsTrigger>
            <TabsTrigger value="team">Team Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Productivity Intelligence Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    Productivity Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockIntelligence.slice(0, 4).map((intel) => (
                      <div 
                        key={intel.id} 
                        className={`p-3 rounded-lg border ${getSeverityColor(intel.severity)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{intel.title}</p>
                            <p className="text-xs mt-1 opacity-90">{intel.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {intel.confidence}% confidence
                              </Badge>
                              <span className="text-xs font-medium text-green-600">
                                +{intel.productivityIncrease}% productivity
                              </span>
                            </div>
                          </div>
                          {intel.actionRequired && (
                            <Button size="sm" variant="outline" className="ml-2">
                              <Zap className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Team Performance Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Team Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockTeamProductivity.slice(0, 3).map((member) => (
                      <div key={member.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{member.userName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{member.userName}</div>
                            <div className="text-xs text-gray-600">{member.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${getWorkloadColor(member.currentWorkload)}`}>
                            {member.currentWorkload}%
                          </div>
                          <div className="text-xs text-gray-500">Workload</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI-Powered Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  AI-Powered Productivity Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Users className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Balance Workloads</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      Redistribute 8 tasks for optimal team balance
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Timer className="h-5 w-5 text-orange-600" />
                      <span className="font-medium">Deadline Alerts</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      3 projects at risk of missing deadlines
                    </p>
                  </Button>
                  
                  <Button className="h-auto p-4 flex flex-col items-start space-y-2" variant="outline">
                    <div className="flex items-center gap-2 w-full">
                      <Zap className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Automate Tasks</span>
                    </div>
                    <p className="text-sm text-gray-600 text-left">
                      12+ hours/week automation opportunity
                    </p>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="intelligence" className="space-y-6">
            <div className="space-y-4">
              {mockIntelligence.map((intel) => (
                <Card key={intel.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5 text-purple-600" />
                          {intel.title}
                        </CardTitle>
                        <CardDescription>{intel.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(intel.severity)}>
                          {intel.severity}
                        </Badge>
                        <Badge variant="outline">
                          {intel.confidence}% confidence
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">AI Recommendation</h4>
                          <p className="text-sm text-gray-700">{intel.recommendation}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Expected Impact</h4>
                          <p className="text-lg font-bold text-green-600">
                            +{intel.productivityIncrease}% productivity
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{intel.impactArea}</p>
                        </div>
                      </div>
                      
                      {intel.affectedTeamMembers.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Affected Team Members</h4>
                          <div className="flex flex-wrap gap-2">
                            {intel.affectedTeamMembers.map((member, index) => (
                              <Badge key={index} variant="outline">{member}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>⏱ {intel.timeframe}</span>
                          <span>🎯 Priority {intel.priority}</span>
                        </div>
                        {intel.actionRequired && (
                          <div className="flex gap-2">
                            <Button size="sm">Implement</Button>
                            <Button size="sm" variant="outline">Schedule</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6">
            {mockSmartAssignments.map((assignment, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    {assignment.taskTitle}
                  </CardTitle>
                  <CardDescription>
                    {assignment.taskType} • {assignment.estimatedHours} hours • {assignment.complexity} complexity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Recommended Assignees */}
                    <div>
                      <h4 className="font-medium mb-3">AI-Recommended Assignees</h4>
                      <div className="space-y-3">
                        {assignment.recommendedAssignees.map((assignee, aIndex) => (
                          <div key={aIndex} className={`p-4 border rounded-lg ${
                            aIndex === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                          }`}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback>{assignee.userName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="font-medium">{assignee.userName}</div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {assignee.estimatedCompletionTime}h estimated • {assignee.currentWorkload}% workload
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {assignee.reasons.slice(0, 2).map((reason, rIndex) => (
                                      <Badge key={rIndex} variant="outline" className="text-xs">
                                        {reason}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-green-600">
                                  {assignee.matchScore}%
                                </div>
                                <div className="text-xs text-gray-500">Match Score</div>
                                {aIndex === 0 && (
                                  <Badge className="mt-2 bg-blue-100 text-blue-800">Recommended</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Task Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Required Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {assignment.requiredSkills.map((skill, sIndex) => (
                            <Badge key={sIndex} variant="outline">{skill}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Dependencies</h4>
                        <div className="space-y-1">
                          {assignment.dependencies.map((dep, dIndex) => (
                            <div key={dIndex} className="text-sm text-gray-600">• {dep}</div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button size="sm">
                        <UserCheck className="h-4 w-4 mr-2" />
                        Assign to {assignment.recommendedAssignees[0]?.userName}
                      </Button>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            {mockPredictiveProjects.map((project) => (
              <Card key={project.projectId}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Flag className="h-5 w-5 text-blue-600" />
                        {project.projectName}
                      </CardTitle>
                      <CardDescription>
                        {project.currentProgress}% complete • Due {format(new Date(project.originalDeadline), 'MMM dd, yyyy')}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getRiskColor(project.riskLevel)}>
                        {project.riskLevel} risk
                      </Badge>
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-600">
                          {project.delayProbability}%
                        </div>
                        <div className="text-xs text-gray-500">Delay Risk</div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Project Progress</span>
                        <span>{project.currentProgress}% Complete</span>
                      </div>
                      <Progress value={project.currentProgress} className="h-2" />
                    </div>

                    {/* Bottlenecks */}
                    <div>
                      <h4 className="font-medium mb-3">Identified Bottlenecks</h4>
                      <div className="space-y-2">
                        {project.bottlenecks.map((bottleneck, bIndex) => (
                          <div key={bIndex} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="font-medium text-yellow-800">{bottleneck.area}</div>
                            <div className="text-sm text-yellow-700 mt-1">{bottleneck.impact}</div>
                            <div className="text-sm text-yellow-600 mt-1">
                              <strong>Suggestion:</strong> {bottleneck.suggestion}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Resource Needs */}
                    <div>
                      <h4 className="font-medium mb-3">Resource Gap Analysis</h4>
                      <div className="space-y-3">
                        {project.resourceNeeds.map((resource, rIndex) => (
                          <div key={rIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium">{resource.skill}</div>
                              <div className="text-sm text-gray-600">
                                {resource.currentCapacity}% current • {resource.requiredCapacity}% needed
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-red-600">
                                -{resource.gap}%
                              </div>
                              <div className="text-xs text-gray-500">Gap</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Milestone Tracking */}
                    <div>
                      <h4 className="font-medium mb-3">Milestone Tracking</h4>
                      <div className="space-y-2">
                        {project.milestoneTracking.map((milestone, mIndex) => (
                          <div key={mIndex} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">{milestone.milestone}</div>
                              <div className="text-sm text-gray-600">
                                Planned: {format(new Date(milestone.plannedDate), 'MMM dd')} • 
                                Predicted: {format(new Date(milestone.predictedDate), 'MMM dd')}
                              </div>
                            </div>
                            <Badge className={
                              milestone.status === 'on_track' ? 'bg-green-100 text-green-800' :
                              milestone.status === 'at_risk' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {milestone.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button size="sm">
                        <Zap className="h-4 w-4 mr-2" />
                        Apply Recommendations
                      </Button>
                      <Button size="sm" variant="outline">
                        <Calendar className="h-4 w-4 mr-2" />
                        Adjust Timeline
                      </Button>
                      <Button size="sm" variant="outline">
                        <Users className="h-4 w-4 mr-2" />
                        Allocate Resources
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedTeamMember} onValueChange={setSelectedTeamMember}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  {mockTeamProductivity.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.userName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Team Member Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredTeamMembers.map((member) => (
                <Card key={member.userId} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>{member.userName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{member.userName}</CardTitle>
                          <CardDescription>{member.role}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getWorkloadColor(member.currentWorkload)}`}>
                          {member.productivityScore}
                        </div>
                        <div className="text-xs text-gray-500">Productivity Score</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <p className="text-sm font-medium text-blue-800">{member.utilizationRate}%</p>
                          <p className="text-xs text-blue-600">Utilization</p>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded">
                          <p className="text-sm font-medium text-green-800">{member.completionRate}%</p>
                          <p className="text-xs text-green-600">Completion</p>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <p className="text-sm font-medium text-purple-800">{member.averageTaskTime}h</p>
                          <p className="text-xs text-purple-600">Avg Task Time</p>
                        </div>
                      </div>

                      {/* Recent Trends */}
                      <div>
                        <h4 className="font-medium mb-2">Recent Trends</h4>
                        <div className="space-y-2">
                          {member.recentTrends.map((trend, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{trend.metric}</span>
                              <div className="flex items-center gap-2">
                                {getTrendIcon(trend.direction)}
                                <span className={`font-medium ${
                                  trend.direction === 'up' ? 'text-green-600' : 
                                  trend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {Math.abs(trend.change)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Workload Recommendation */}
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Brain className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium text-yellow-800">AI Recommendation</span>
                        </div>
                        <p className="text-sm text-yellow-700">
                          {member.workloadRecommendation === 'reduce' && 'Reduce workload to prevent burnout'}
                          {member.workloadRecommendation === 'increase' && 'Can take on additional responsibilities'}
                          {member.workloadRecommendation === 'maintain' && 'Current workload is optimal'}
                        </p>
                        {member.burnoutRisk > 60 && (
                          <p className="text-sm text-red-600 mt-1">
                            ⚠️ High burnout risk ({member.burnoutRisk}%)
                          </p>
                        )}
                      </div>

                      {/* Skills & Development */}
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <div className="text-sm font-medium mb-1 text-green-700">Top Strengths</div>
                          <div className="flex flex-wrap gap-1">
                            {member.strengths.slice(0, 2).map((strength, index) => (
                              <Badge key={index} variant="outline" className="text-xs text-green-700">
                                {strength}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium mb-1 text-blue-700">Skill Development</div>
                          <div className="flex flex-wrap gap-1">
                            {member.skillDevelopment.slice(0, 2).map((skill, index) => (
                              <Badge key={index} variant="outline" className="text-xs text-blue-700">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button size="sm" className="flex-1">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          1-on-1 Notes
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Mobile Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <MobileFAB
            icon={Brain}
            label="Productivity Intelligence"
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-2xl"
            onClick={() => setActiveTab('intelligence')}
            data-testid="mobile-fab-productivity-intelligence"
          />
        </div>

        {/* Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Productivity Intelligence Settings</DialogTitle>
              <DialogDescription>
                Configure AI-powered task management and team productivity optimization preferences
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai-optimization">AI Task Optimization</Label>
                    <p className="text-sm text-gray-600">Enable AI-powered task assignment and productivity recommendations</p>
                  </div>
                  <Switch 
                    id="ai-optimization"
                    checked={aiOptimizationEnabled}
                    onCheckedChange={setAiOptimizationEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="predictive-management">Predictive Project Management</Label>
                    <p className="text-sm text-gray-600">Enable machine learning-based project timeline prediction and risk assessment</p>
                  </div>
                  <Switch 
                    id="predictive-management"
                    checked={predictiveEnabled}
                    onCheckedChange={setPredictiveEnabled}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsSettingsDialogOpen(false)}>
                  Save Settings
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}