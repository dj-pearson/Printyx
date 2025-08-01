import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckSquare,
  Plus,
  Clock,
  User,
  Calendar,
  Flag,
  Folder,
  MoreHorizontal,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Timer,
  MessageSquare,
  Users,
  Target,
  TrendingUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  assignedToName?: string;
  projectId?: string;
  projectName?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  completionPercentage: number;
  tags: string[];
  createdAt: string;
  completedAt?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  projectManager?: string;
  projectManagerName?: string;
  customerId?: string;
  customerName?: string;
  startDate?: string;
  endDate?: string;
  estimatedBudget?: number;
  actualBudget?: number;
  completionPercentage: number;
  taskCount: number;
  completedTaskCount: number;
  tags: string[];
  createdAt: string;
}

export default function TaskManagement() {
  const [selectedView, setSelectedView] = useState<'my-tasks' | 'all-tasks' | 'projects'>('my-tasks');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const { toast } = useToast();
  
  // Form state for creating tasks
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignedTo: '',
    dueDate: '',
    estimatedHours: ''
  });
  
  // Form state for creating projects
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    projectManager: '',
    customerId: '',
    startDate: '',
    endDate: '',
    estimatedBudget: ''
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", selectedView, selectedPriority, selectedStatus],
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: taskStats } = useQuery({
    queryKey: ["/api/tasks/stats"],
  });

  const createTask = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/tasks", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/stats"] });
      toast({
        title: "Task Created",
        description: "The task has been created successfully.",
      });
      setIsCreateTaskOpen(false);
    },
  });

  const createProject = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/projects", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Created", 
        description: "The project has been created successfully.",
      });
      setIsCreateProjectOpen(false);
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return apiRequest(`/api/tasks/${taskId}`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/stats"] });
    },
  });

  // Mock data
  const mockTasks: Task[] = tasks || [
    {
      id: "1",
      title: "Install Canon imageRUNNER at TechCorp",
      description: "Complete installation and setup of new multifunction device",
      status: "in_progress",
      priority: "high",
      assignedTo: "tech1",
      assignedToName: "John Smith",
      projectId: "proj1",
      projectName: "TechCorp Equipment Upgrade",
      dueDate: "2025-01-05T17:00:00Z",
      estimatedHours: 6,
      actualHours: 4,
      completionPercentage: 75,
      tags: ["installation", "canon", "urgent"],
      createdAt: "2025-01-01T09:00:00Z"
    },
    {
      id: "2",
      title: "Update service contract pricing",
      description: "Review and update pricing for all service contracts due for renewal",
      status: "todo",
      priority: "medium",
      assignedTo: "admin1",
      assignedToName: "Sarah Johnson",
      dueDate: "2025-01-10T17:00:00Z",
      estimatedHours: 3,
      completionPercentage: 0,
      tags: ["contracts", "pricing"],
      createdAt: "2024-12-30T14:00:00Z"
    },
    {
      id: "3",
      title: "Quarterly inventory audit",
      description: "Conduct full inventory count and reconciliation",
      status: "completed",
      priority: "medium",
      assignedTo: "admin2",
      assignedToName: "Mike Wilson",
      completedAt: "2024-12-28T16:30:00Z",
      estimatedHours: 8,
      actualHours: 7,
      completionPercentage: 100,
      tags: ["inventory", "audit"],
      createdAt: "2024-12-20T10:00:00Z"
    }
  ];

  const mockProjects: Project[] = projects || [
    {
      id: "proj1",
      name: "TechCorp Equipment Upgrade",
      description: "Complete fleet upgrade with 5 new devices and training",
      status: "active",
      projectManager: "pm1",
      projectManagerName: "Lisa Davis",
      customerId: "1",
      customerName: "TechCorp Solutions",
      startDate: "2024-12-01T00:00:00Z",
      endDate: "2025-01-15T00:00:00Z",
      estimatedBudget: 2500000, // $25,000
      completionPercentage: 65,
      taskCount: 8,
      completedTaskCount: 5,
      tags: ["equipment", "training", "large-account"],
      createdAt: "2024-11-25T00:00:00Z"
    },
    {
      id: "proj2", 
      name: "Q1 Service Campaign",
      description: "Preventive maintenance for all devices across major accounts",
      status: "planning",
      projectManager: "pm2",
      projectManagerName: "Tom Anderson",
      startDate: "2025-01-15T00:00:00Z",
      endDate: "2025-03-31T00:00:00Z",
      estimatedBudget: 1200000, // $12,000
      completionPercentage: 10,
      taskCount: 25,
      completedTaskCount: 2,
      tags: ["maintenance", "campaign"],
      createdAt: "2024-12-15T00:00:00Z"
    }
  ];

  const mockStats = taskStats || {
    totalTasks: 24,
    completedTasks: 18,
    inProgressTasks: 4,
    overdueTasks: 2,
    myTasks: 8,
    avgCompletionTime: 4.2
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'review': return 'bg-purple-100 text-purple-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTasks = mockTasks.filter(task => {
    if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false;
    if (selectedStatus !== 'all' && task.status !== selectedStatus) return false;
    if (selectedView === 'my-tasks') {
      // In real app, filter by current user
      return true;
    }
    return true;
  });

  return (
    <MainLayout 
      title="Task Management" 
      description="Manage personal tasks and complex projects"
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">My Tasks</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{taskStats?.totalTasks || 0}</p>
                  <p className="text-xs text-blue-600">Active assignments</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CheckSquare className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">In Progress</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{taskStats?.inProgressTasks || 0}</p>
                  <p className="text-xs text-orange-600">Active tasks</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Play className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{taskStats?.completedTasks || 0}</p>
                  <p className="text-xs text-green-600">This period</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl sm:text-3xl font-bold text-red-600">{taskStats?.overdueTasks || 0}</p>
                  <p className="text-xs text-red-600">Need attention</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)} className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className="grid w-full sm:w-auto grid-cols-3">
              <TabsTrigger value="my-tasks">My Tasks</TabsTrigger>
              <TabsTrigger value="all-tasks">All Tasks</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                    <DialogDescription>Create a new task or add it to an existing project</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-title">Title</Label>
                      <Input 
                        id="task-title" 
                        placeholder="Enter task title" 
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-description">Description</Label>
                      <Textarea 
                        id="task-description" 
                        placeholder="Enter task description" 
                        value={taskForm.description}
                        onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select value={taskForm.priority} onValueChange={(value) => setTaskForm({...taskForm, priority: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Assign To</Label>
                        <Select value={taskForm.assignedTo} onValueChange={(value) => setTaskForm({...taskForm, assignedTo: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tech1">John Smith</SelectItem>
                            <SelectItem value="admin1">Sarah Johnson</SelectItem>
                            <SelectItem value="admin2">Mike Wilson</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Due Date</Label>
                        <Input 
                          type="datetime-local" 
                          value={taskForm.dueDate}
                          onChange={(e) => setTaskForm({...taskForm, dueDate: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Estimated Hours</Label>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          min="0" 
                          step="0.5" 
                          value={taskForm.estimatedHours}
                          onChange={(e) => setTaskForm({...taskForm, estimatedHours: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>Cancel</Button>
                    <Button onClick={() => {
                      if (!taskForm.title.trim()) {
                        toast({
                          title: "Error",
                          description: "Please enter a task title.",
                          variant: "destructive",
                        });
                        return;
                      }
                      createTask.mutate({
                        title: taskForm.title,
                        description: taskForm.description,
                        priority: taskForm.priority,
                        assignedTo: taskForm.assignedTo,
                        dueDate: taskForm.dueDate,
                        estimatedHours: taskForm.estimatedHours ? parseFloat(taskForm.estimatedHours) : undefined
                      });
                      // Reset form
                      setTaskForm({
                        title: '',
                        description: '',
                        priority: 'medium',
                        assignedTo: '',
                        dueDate: '',
                        estimatedHours: ''
                      });
                    }}>Create Task</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Folder className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>Create a new project to organize multiple related tasks</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Project Name</Label>
                      <Input id="project-name" placeholder="Enter project name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-description">Description</Label>
                      <Textarea id="project-description" placeholder="Enter project description" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Project Manager</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select manager" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pm1">Lisa Davis</SelectItem>
                            <SelectItem value="pm2">Tom Anderson</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Customer</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">TechCorp Solutions</SelectItem>
                            <SelectItem value="2">Global Manufacturing Inc</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input type="date" />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input type="date" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Estimated Budget</Label>
                      <Input type="number" placeholder="0.00" min="0" step="0.01" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateProjectOpen(false)}>Cancel</Button>
                    <Button onClick={() => createProject.mutate({})}>Create Project</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <TabsContent value="my-tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>My Tasks</CardTitle>
                    <CardDescription>Tasks assigned to you</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priority</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateTaskStatus.mutate({
                            taskId: task.id,
                            status: task.status === 'completed' ? 'todo' : 'completed'
                          })}
                        >
                          <CheckCircle className={`h-5 w-5 ${task.status === 'completed' ? 'text-green-600' : 'text-gray-400'}`} />
                        </Button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                              {task.title}
                            </h4>
                            <Badge className={getPriorityColor(task.priority)} variant="outline">
                              {task.priority}
                            </Badge>
                            <Badge className={getStatusColor(task.status)} variant="secondary">
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {task.assignedToName && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {task.assignedToName}
                              </div>
                            )}
                            {task.dueDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            )}
                            {task.estimatedHours && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {task.estimatedHours}h estimated
                              </div>
                            )}
                            {task.projectName && (
                              <div className="flex items-center gap-1">
                                <Folder className="h-3 w-3" />
                                {task.projectName}
                              </div>
                            )}
                          </div>
                          {task.completionPercentage > 0 && task.status !== 'completed' && (
                            <div className="mt-2">
                              <Progress value={task.completionPercentage} className="h-2" />
                              <p className="text-xs text-gray-500 mt-1">{task.completionPercentage}% complete</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Timer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all-tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Tasks</CardTitle>
                <CardDescription>Overview of all tasks across the organization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm">
                          <CheckCircle className={`h-5 w-5 ${task.status === 'completed' ? 'text-green-600' : 'text-gray-400'}`} />
                        </Button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                              {task.title}
                            </h4>
                            <Badge className={getPriorityColor(task.priority)} variant="outline">
                              {task.priority}
                            </Badge>
                            <Badge className={getStatusColor(task.status)} variant="secondary">
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {task.assignedToName && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {task.assignedToName}
                              </div>
                            )}
                            {task.dueDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            )}
                            {task.projectName && (
                              <div className="flex items-center gap-1">
                                <Folder className="h-3 w-3" />
                                {task.projectName}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <div className="grid gap-6">
              {mockProjects.map((project) => (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                          <Badge className={getProjectStatusColor(project.status)} variant="secondary">
                            {project.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1">
                          {project.description}
                        </CardDescription>
                      </div>
                      <Button variant="outline">
                        <Target className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Project Manager</p>
                            <p className="text-sm text-gray-600">{project.projectManagerName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Timeline</p>
                            <p className="text-sm text-gray-600">
                              {project.startDate && new Date(project.startDate).toLocaleDateString()} - {' '}
                              {project.endDate && new Date(project.endDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Budget</p>
                            <p className="text-sm text-gray-600">
                              {project.estimatedBudget && `$${(project.estimatedBudget / 100).toLocaleString()}`}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">Progress</p>
                          <p className="text-sm text-gray-600">{project.completionPercentage}%</p>
                        </div>
                        <Progress value={project.completionPercentage} className="h-2" />
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{project.completedTaskCount}</span>
                          <span className="text-gray-600"> of {project.taskCount} tasks completed</span>
                        </div>
                        <div className="flex gap-1">
                          {project.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}