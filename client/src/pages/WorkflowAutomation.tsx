import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, Zap, Play, Pause, CheckCircle, AlertTriangle, Clock,
  Settings, Users, FileText, ArrowRight, ArrowDown, GitBranch, Target,
  Activity, Workflow, Bot, Timer, Bell, RefreshCw, Eye, Edit, Trash2,
  PlayCircle, PauseCircle, StopCircle, BarChart3, Gauge, TrendingUp,
  Square
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// Types
type WorkflowTemplate = {
  id: string;
  template_name: string;
  template_description?: string;
  template_category: string;
  template_version: string;
  is_active: boolean;
  auto_start: boolean;
  requires_approval: boolean;
  priority: string;
  execution_count: number;
  success_count: number;
  failure_count: number;
  average_completion_time_minutes: number;
  is_system_template: boolean;
  created_at: string;
};

type WorkflowExecution = {
  id: string;
  execution_id: string;
  workflow_template_name?: string;
  execution_name?: string;
  triggered_by_event: string;
  status: string;
  current_step_index: number;
  completed_steps: number;
  total_steps: number;
  progress_percentage: number;
  priority: string;
  started_at?: string;
  completed_at?: string;
  execution_duration_minutes?: number;
  assigned_to?: string;
  escalation_level: number;
  created_at: string;
};

type AutomationRule = {
  id: string;
  rule_name: string;
  rule_description?: string;
  rule_category: string;
  priority: number;
  is_active: boolean;
  is_critical: boolean;
  execution_count: number;
  success_count: number;
  last_executed?: string;
  average_execution_time_ms?: number;
  error_rate?: number;
  is_test_mode: boolean;
  created_at: string;
};

type AutomatedTask = {
  id: string;
  task_title: string;
  task_description?: string;
  task_type: string;
  task_category: string;
  priority: string;
  urgency_score: number;
  status: string;
  progress_percentage: number;
  assigned_to?: string;
  due_date?: string;
  automation_trigger?: string;
  estimated_duration_minutes?: number;
  created_at: string;
};

type AutomationMetrics = {
  activeWorkflows: number;
  pendingTasks: number;
  automationRules: number;
  successRate: number;
  timeSaved: number;
  tasksAutomated: number;
};

// Form Schemas
const workflowTemplateSchema = z.object({
  template_name: z.string().min(3, "Template name required"),
  template_description: z.string().optional(),
  template_category: z.enum(['service_automation', 'sales_process', 'maintenance', 'customer_onboarding', 'billing']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  auto_start: z.boolean(),
  requires_approval: z.boolean(),
  execution_delay_minutes: z.number().min(0).max(1440),
  max_execution_time_hours: z.number().min(1).max(168),
  retry_attempts: z.number().min(0).max(10),
});

const automationRuleSchema = z.object({
  rule_name: z.string().min(3, "Rule name required"),
  rule_description: z.string().optional(),
  rule_category: z.enum(['trigger', 'escalation', 'notification', 'assignment', 'validation']),
  priority: z.number().min(1).max(10),
  is_critical: z.boolean(),
  delay_before_action: z.number().min(0),
  max_executions_per_day: z.number().min(1).optional(),
  bypass_business_hours: z.boolean(),
});

const automatedTaskSchema = z.object({
  task_title: z.string().min(3, "Task title required"),
  task_description: z.string().optional(),
  task_type: z.enum(['service_reminder', 'follow_up', 'maintenance_alert', 'billing_task', 'quality_check']),
  task_category: z.enum(['customer_service', 'maintenance', 'billing', 'sales', 'admin']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  urgency_score: z.number().min(1).max(10),
  estimated_duration_minutes: z.number().min(5).optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
});

type WorkflowTemplateForm = z.infer<typeof workflowTemplateSchema>;
type AutomationRuleForm = z.infer<typeof automationRuleSchema>;
type AutomatedTaskForm = z.infer<typeof automatedTaskSchema>;

export default function WorkflowAutomation() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  
  const queryClient = useQueryClient();

  // Fetch automation metrics
  const { data: metrics } = useQuery<AutomationMetrics>({
    queryKey: ["/api/automation/metrics"],
  });

  // Fetch workflow templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<WorkflowTemplate[]>({
    queryKey: ["/api/automation/workflow-templates", selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      return await apiRequest(`/api/automation/workflow-templates?${params.toString()}`);
    },
  });

  // Fetch workflow executions
  const { data: executions = [], isLoading: executionsLoading } = useQuery<WorkflowExecution[]>({
    queryKey: ["/api/automation/workflow-executions", selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      return await apiRequest(`/api/automation/workflow-executions?${params.toString()}`);
    },
  });

  // Fetch automation rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery<AutomationRule[]>({
    queryKey: ["/api/automation/rules"],
  });

  // Fetch automated tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<AutomatedTask[]>({
    queryKey: ["/api/automation/tasks", selectedPriority],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPriority !== "all") params.append("priority", selectedPriority);
      return await apiRequest(`/api/automation/tasks?${params.toString()}`);
    },
  });

  // Create workflow template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: WorkflowTemplateForm) =>
      await apiRequest("/api/automation/workflow-templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/workflow-templates"] });
      setIsTemplateDialogOpen(false);
    },
  });

  // Create automation rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async (data: AutomationRuleForm) =>
      await apiRequest("/api/automation/rules", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
      setIsRuleDialogOpen(false);
    },
  });

  // Create automated task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: AutomatedTaskForm) =>
      await apiRequest("/api/automation/tasks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/tasks"] });
      setIsTaskDialogOpen(false);
    },
  });

  // Execute workflow mutation
  const executeWorkflowMutation = useMutation({
    mutationFn: async (templateId: string) =>
      await apiRequest(`/api/automation/workflow-templates/${templateId}/execute`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/workflow-executions"] });
    },
  });

  // Control workflow execution mutation
  const controlExecutionMutation = useMutation({
    mutationFn: async ({ executionId, action }: { executionId: string; action: string }) =>
      await apiRequest(`/api/automation/workflow-executions/${executionId}/${action}`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/workflow-executions"] });
    },
  });

  // Form setup
  const templateForm = useForm<WorkflowTemplateForm>({
    resolver: zodResolver(workflowTemplateSchema),
    defaultValues: {
      template_category: "service_automation",
      priority: "medium",
      auto_start: true,
      requires_approval: false,
      execution_delay_minutes: 0,
      max_execution_time_hours: 24,
      retry_attempts: 3,
    },
  });

  const ruleForm = useForm<AutomationRuleForm>({
    resolver: zodResolver(automationRuleSchema),
    defaultValues: {
      rule_category: "trigger",
      priority: 5,
      is_critical: false,
      delay_before_action: 0,
      bypass_business_hours: false,
    },
  });

  const taskForm = useForm<AutomatedTaskForm>({
    resolver: zodResolver(automatedTaskSchema),
    defaultValues: {
      task_type: "service_reminder",
      task_category: "customer_service",
      priority: "medium",
      urgency_score: 5,
    },
  });

  const onTemplateSubmit = (data: WorkflowTemplateForm) => {
    createTemplateMutation.mutate(data);
  };

  const onRuleSubmit = (data: AutomationRuleForm) => {
    createRuleMutation.mutate(data);
  };

  const onTaskSubmit = (data: AutomatedTaskForm) => {
    createTaskMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'running': case 'in_progress': return 'default';
      case 'pending': return 'secondary';
      case 'failed': case 'cancelled': return 'destructive';
      case 'paused': case 'on_hold': return 'secondary';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: string | number) => {
    if (typeof priority === 'number') {
      if (priority >= 8) return 'destructive';
      if (priority >= 6) return 'secondary';
      return 'outline';
    }
    switch (priority) {
      case 'urgent': case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'running': case 'in_progress': return <PlayCircle className="h-4 w-4 text-blue-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-orange-600" />;
      case 'paused': case 'on_hold': return <PauseCircle className="h-4 w-4 text-yellow-600" />;
      case 'failed': case 'cancelled': return <StopCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'service_automation': return <Zap className="h-4 w-4" />;
      case 'sales_process': return <Target className="h-4 w-4" />;
      case 'maintenance': return <Settings className="h-4 w-4" />;
      case 'customer_onboarding': return <Users className="h-4 w-4" />;
      case 'billing': return <FileText className="h-4 w-4" />;
      case 'trigger': return <Activity className="h-4 w-4" />;
      case 'escalation': return <TrendingUp className="h-4 w-4" />;
      case 'notification': return <Bell className="h-4 w-4" />;
      case 'assignment': return <Users className="h-4 w-4" />;
      case 'validation': return <CheckCircle className="h-4 w-4" />;
      default: return <Workflow className="h-4 w-4" />;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes.toFixed(0)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toFixed(0)}m`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Workflow Automation System</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive workflow engine with automated task creation and process automation
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Workflow Template</DialogTitle>
              </DialogHeader>
              <Form {...templateForm}>
                <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
                  <FormField
                    control={templateForm.control}
                    name="template_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Customer Onboarding Workflow" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={templateForm.control}
                    name="template_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Automated workflow for onboarding new customers..."
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={templateForm.control}
                      name="template_category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="service_automation">Service Automation</SelectItem>
                              <SelectItem value="sales_process">Sales Process</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="customer_onboarding">Customer Onboarding</SelectItem>
                              <SelectItem value="billing">Billing</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={templateForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={templateForm.control}
                      name="execution_delay_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delay (minutes)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              max="1440"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={templateForm.control}
                      name="max_execution_time_hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Time (hours)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              max="168"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 24)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={templateForm.control}
                      name="retry_attempts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retry Attempts</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              max="10"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 3)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex space-x-6">
                    <FormField
                      control={templateForm.control}
                      name="auto_start"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Auto-start when triggered</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={templateForm.control}
                      name="requires_approval"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Requires approval</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsTemplateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createTemplateMutation.isPending}>
                      {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Bot className="mr-2 h-4 w-4" />
                New Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Automation Rule</DialogTitle>
              </DialogHeader>
              <Form {...ruleForm}>
                <form onSubmit={ruleForm.handleSubmit(onRuleSubmit)} className="space-y-4">
                  <FormField
                    control={ruleForm.control}
                    name="rule_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rule Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Service Escalation Rule" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={ruleForm.control}
                    name="rule_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Automatically escalate service tickets after 2 hours..."
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={ruleForm.control}
                      name="rule_category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="trigger">Trigger</SelectItem>
                              <SelectItem value="escalation">Escalation</SelectItem>
                              <SelectItem value="notification">Notification</SelectItem>
                              <SelectItem value="assignment">Assignment</SelectItem>
                              <SelectItem value="validation">Validation</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={ruleForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority (1-10)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              max="10"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 5)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={ruleForm.control}
                      name="delay_before_action"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delay (seconds)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={ruleForm.control}
                      name="max_executions_per_day"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Executions/Day</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex space-x-6">
                    <FormField
                      control={ruleForm.control}
                      name="is_critical"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Critical rule</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={ruleForm.control}
                      name="bypass_business_hours"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Bypass business hours</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsRuleDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createRuleMutation.isPending}>
                      {createRuleMutation.isPending ? "Creating..." : "Create Rule"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Automated Task</DialogTitle>
              </DialogHeader>
              <Form {...taskForm}>
                <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4">
                  <FormField
                    control={taskForm.control}
                    name="task_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Task Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Follow up with customer" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={taskForm.control}
                    name="task_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Contact customer to ensure satisfaction with recent service..."
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={taskForm.control}
                      name="task_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Task Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="service_reminder">Service Reminder</SelectItem>
                              <SelectItem value="follow_up">Follow Up</SelectItem>
                              <SelectItem value="maintenance_alert">Maintenance Alert</SelectItem>
                              <SelectItem value="billing_task">Billing Task</SelectItem>
                              <SelectItem value="quality_check">Quality Check</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="task_category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="customer_service">Customer Service</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="billing">Billing</SelectItem>
                              <SelectItem value="sales">Sales</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={taskForm.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="urgency_score"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Urgency (1-10)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              max="10"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 5)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="estimated_duration_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (min)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="5"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={taskForm.control}
                      name="due_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="assigned_to"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned To</FormLabel>
                          <FormControl>
                            <Input placeholder="User ID or leave blank for auto-assignment" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsTaskDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createTaskMutation.isPending}>
                      {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Automation Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
                <Workflow className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.activeWorkflows || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently running
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.pendingTasks || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Awaiting execution
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Automation Rules</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.automationRules || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active rules
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Automation Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Success Rate</span>
                    <span className="font-medium">
                      {metrics?.successRate?.toFixed(1) || "0"}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Time Saved</span>
                    <span className="font-medium">
                      {formatDuration(metrics?.timeSaved || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Tasks Automated</span>
                    <span className="font-medium">
                      {metrics?.tasksAutomated || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Workflow Executions</CardTitle>
              </CardHeader>
              <CardContent>
                {executionsLoading ? (
                  <p className="text-center py-4">Loading executions...</p>
                ) : (executions as WorkflowExecution[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent executions</p>
                ) : (
                  <div className="space-y-3">
                    {(executions as WorkflowExecution[]).slice(0, 5).map((execution) => (
                      <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(execution.status)}
                          <div>
                            <h4 className="font-medium text-sm">{execution.execution_name || execution.execution_id}</h4>
                            <p className="text-xs text-muted-foreground">
                              {execution.workflow_template_name} • Step {execution.current_step_index + 1}/{execution.total_steps}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={getStatusColor(execution.status)} className="text-xs">
                            {execution.status.replace('_', ' ')}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {execution.progress_percentage.toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          {/* Template Filters */}
          <div className="flex space-x-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="service_automation">Service Automation</SelectItem>
                <SelectItem value="sales_process">Sales Process</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="customer_onboarding">Customer Onboarding</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Workflow Templates</CardTitle>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <p className="text-center py-8">Loading templates...</p>
              ) : (templates as WorkflowTemplate[]).length === 0 ? (
                <div className="text-center py-8">
                  <Workflow className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No workflow templates found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(templates as WorkflowTemplate[]).map((template) => (
                    <Card key={template.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getCategoryIcon(template.template_category)}
                            <CardTitle className="text-sm">{template.template_name}</CardTitle>
                          </div>
                          <Badge variant={template.is_active ? 'default' : 'secondary'}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {template.template_description && (
                          <p className="text-sm text-muted-foreground">{template.template_description}</p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Category:</span>
                            <span>{template.template_category.replace('_', ' ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Version:</span>
                            <span>{template.template_version}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Priority:</span>
                            <Badge variant={getPriorityColor(template.priority)} className="text-xs">
                              {template.priority}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <p className="text-muted-foreground">Executions</p>
                            <p className="font-medium">{template.execution_count}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Success</p>
                            <p className="font-medium text-green-600">{template.success_count}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Failed</p>
                            <p className="font-medium text-red-600">{template.failure_count}</p>
                          </div>
                        </div>

                        {template.average_completion_time_minutes > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Avg completion: {formatDuration(template.average_completion_time_minutes)}
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => executeWorkflowMutation.mutate(template.id)}
                            disabled={executeWorkflowMutation.isPending}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Execute
                          </Button>
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions" className="space-y-6">
          {/* Execution Filters */}
          <div className="flex space-x-4">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Workflow Executions</CardTitle>
            </CardHeader>
            <CardContent>
              {executionsLoading ? (
                <p className="text-center py-8">Loading executions...</p>
              ) : (executions as WorkflowExecution[]).length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No workflow executions found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(executions as WorkflowExecution[]).map((execution) => (
                    <div key={execution.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {getStatusIcon(execution.status)}
                            <h3 className="font-medium">{execution.execution_name || execution.execution_id}</h3>
                            <Badge variant={getStatusColor(execution.status)}>
                              {execution.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant={getPriorityColor(execution.priority)}>
                              {execution.priority}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Template: {execution.workflow_template_name}</p>
                            <p>Triggered by: {execution.triggered_by_event.replace('_', ' ')}</p>
                            <p>Progress: Step {execution.current_step_index + 1} of {execution.total_steps} ({execution.progress_percentage.toFixed(0)}%)</p>
                            {execution.started_at && (
                              <p>Started: {format(new Date(execution.started_at), 'MMM dd, HH:mm')}</p>
                            )}
                            {execution.execution_duration_minutes && (
                              <p>Duration: {formatDuration(execution.execution_duration_minutes)}</p>
                            )}
                            {execution.assigned_to && (
                              <p>Assigned to: {execution.assigned_to}</p>
                            )}
                            {execution.escalation_level > 0 && (
                              <p className="text-orange-600">Escalation level: {execution.escalation_level}</p>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${execution.progress_percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-1 ml-4">
                          {execution.status === 'running' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => controlExecutionMutation.mutate({ 
                                executionId: execution.execution_id, 
                                action: 'pause' 
                              })}
                            >
                              <Pause className="h-3 w-3" />
                            </Button>
                          )}
                          {execution.status === 'paused' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => controlExecutionMutation.mutate({ 
                                executionId: execution.execution_id, 
                                action: 'resume' 
                              })}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                          {(execution.status === 'running' || execution.status === 'paused') && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => controlExecutionMutation.mutate({ 
                                executionId: execution.execution_id, 
                                action: 'stop' 
                              })}
                            >
                              <Square className="h-3 w-3" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automation Rules</CardTitle>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <p className="text-center py-8">Loading automation rules...</p>
              ) : (rules as AutomationRule[]).length === 0 ? (
                <div className="text-center py-8">
                  <Bot className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No automation rules found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(rules as AutomationRule[]).map((rule) => (
                    <div key={rule.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {getCategoryIcon(rule.rule_category)}
                            <h3 className="font-medium">{rule.rule_name}</h3>
                            <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                              {rule.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            {rule.is_critical && (
                              <Badge variant="destructive">Critical</Badge>
                            )}
                            {rule.is_test_mode && (
                              <Badge variant="secondary">Test Mode</Badge>
                            )}
                            <Badge variant={getPriorityColor(rule.priority)}>
                              Priority {rule.priority}
                            </Badge>
                          </div>
                          {rule.rule_description && (
                            <p className="text-sm text-muted-foreground mb-3">{rule.rule_description}</p>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Category</p>
                              <p className="font-medium">{rule.rule_category.replace('_', ' ')}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Executions</p>
                              <p className="font-medium">{rule.execution_count}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Success Rate</p>
                              <p className="font-medium">
                                {rule.execution_count > 0 ? ((rule.success_count / rule.execution_count) * 100).toFixed(1) : "0"}%
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Last Executed</p>
                              <p className="font-medium">
                                {rule.last_executed ? format(new Date(rule.last_executed), 'MMM dd, HH:mm') : 'Never'}
                              </p>
                            </div>
                            {rule.average_execution_time_ms && (
                              <div>
                                <p className="text-muted-foreground">Avg Time</p>
                                <p className="font-medium">{rule.average_execution_time_ms.toFixed(0)}ms</p>
                              </div>
                            )}
                            {rule.error_rate !== undefined && (
                              <div>
                                <p className="text-muted-foreground">Error Rate</p>
                                <p className="font-medium">{(rule.error_rate * 100).toFixed(2)}%</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          {/* Task Filters */}
          <div className="flex space-x-4">
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Automated Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <p className="text-center py-8">Loading automated tasks...</p>
              ) : (tasks as AutomatedTask[]).length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No automated tasks found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(tasks as AutomatedTask[]).map((task) => (
                    <div key={task.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            {getStatusIcon(task.status)}
                            <h3 className="font-medium">{task.task_title}</h3>
                            <Badge variant={getStatusColor(task.status)}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                          </div>
                          {task.task_description && (
                            <p className="text-sm text-muted-foreground mb-3">{task.task_description}</p>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Type</p>
                              <p className="font-medium">{task.task_type.replace('_', ' ')}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Category</p>
                              <p className="font-medium">{task.task_category.replace('_', ' ')}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Urgency Score</p>
                              <p className="font-medium">{task.urgency_score}/10</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Progress</p>
                              <p className="font-medium">{task.progress_percentage.toFixed(0)}%</p>
                            </div>
                            {task.assigned_to && (
                              <div>
                                <p className="text-muted-foreground">Assigned To</p>
                                <p className="font-medium">{task.assigned_to}</p>
                              </div>
                            )}
                            {task.due_date && (
                              <div>
                                <p className="text-muted-foreground">Due Date</p>
                                <p className="font-medium">{format(new Date(task.due_date), 'MMM dd, yyyy')}</p>
                              </div>
                            )}
                            {task.estimated_duration_minutes && (
                              <div>
                                <p className="text-muted-foreground">Est. Duration</p>
                                <p className="font-medium">{formatDuration(task.estimated_duration_minutes)}</p>
                              </div>
                            )}
                            {task.automation_trigger && (
                              <div>
                                <p className="text-muted-foreground">Triggered By</p>
                                <p className="font-medium">{task.automation_trigger.replace('_', ' ')}</p>
                              </div>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${task.progress_percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <PlayCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}