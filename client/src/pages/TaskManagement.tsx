import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Calendar,
  User,
  Flag,
  CheckCircle,
  Clock,
  AlertTriangle,
  Target,
  Filter,
  Search,
  List,
  Grid3X3,
  Kanban,
  BarChart3,
  Play,
  Pause,
  Square,
  CheckSquare,
  Timer,
  MessageSquare,
  Paperclip,
  ArrowRight,
  Copy,
  Trash2,
  Edit,
  Eye,
  Zap,
  Link,
  Share,
  Download,
  Settings,
} from "lucide-react";
import { format, isAfter, isBefore, isToday } from "date-fns";
import {
  InlineStatusSelect,
  InlinePrioritySelect,
  InlineAssigneeSelect,
  InlineDatePicker,
  getDueDateStatus,
} from "@/components/tasks/InlineEditors";
import {
  CreateTaskDialog,
  CreateProjectDialog,
} from "@/components/tasks/TaskDialogs";
import { TaskBoardView } from "@/components/tasks/TaskBoardView";
import { Skeleton } from "@/components/ui/skeleton";
// import { FixedSizeList as VirtualList, ListChildComponentProps } from "react-window";
import { apiRequest } from "@/lib/queryClient";
import ContextualHelp from "@/components/contextual/ContextualHelp";
import PageAlerts from "@/components/contextual/PageAlerts";

// Enhanced interfaces for advanced task management functionality
interface Task {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo?: string;
  assignedToName?: string;
  assignedToAvatar?: string;
  projectId?: string;
  projectName?: string;
  parentTaskId?: string;
  subtasks?: Task[];
  dueDate?: string;
  startDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  completionPercentage: number;
  tags: string[];
  customFields: Record<string, any>;
  dependencies: string[];
  watchers: string[];
  commentCount: number;
  attachmentCount: number;
  timeTracked: number;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
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
  color?: string;
  template?: string;
  workflow: WorkflowStage[];
  createdAt: string;
}

interface WorkflowStage {
  id: string;
  name: string;
  color: string;
  order: number;
  tasks: string[];
}

interface ViewConfig {
  type: "list" | "board" | "gantt" | "calendar";
  groupBy: "status" | "assignee" | "priority" | "dueDate" | "project";
  sortBy: "dueDate" | "priority" | "status" | "created" | "updated";
  sortOrder: "asc" | "desc";
  filters: {
    status: string[];
    priority: string[];
    assignee: string[];
    tags: string[];
    dueDate: string;
  };
}

const priorityConfig = {
  urgent: {
    label: "Urgent",
    color: "bg-red-500",
    icon: "🔥",
    bgColor: "bg-red-50 text-red-700 border-red-200",
  },
  high: {
    label: "High",
    color: "bg-orange-500",
    icon: "⚡",
    bgColor: "bg-orange-50 text-orange-700 border-orange-200",
  },
  medium: {
    label: "Medium",
    color: "bg-yellow-500",
    icon: "📌",
    bgColor: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  low: {
    label: "Low",
    color: "bg-green-500",
    icon: "📋",
    bgColor: "bg-green-50 text-green-700 border-green-200",
  },
};

const statusConfig = {
  todo: { label: "To Do", color: "bg-gray-100 text-gray-800", icon: Square },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-800",
    icon: Play,
  },
  review: {
    label: "Review",
    color: "bg-purple-100 text-purple-800",
    icon: Eye,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
    icon: CheckSquare,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: Square,
  },
};

export default function TaskManagement() {
  const [view, setView] = useState<ViewConfig>({
    type: "list",
    groupBy: "status",
    sortBy: "dueDate",
    sortOrder: "asc",
    filters: {
      status: [],
      priority: [],
      assignee: [],
      tags: [],
      dueDate: "",
    },
  });

  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tasks using basic endpoint (fallback from enhanced)
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: async () => apiRequest("/api/tasks"),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // Disable automatic refetching to prevent loops
  });

  // Fetch projects using basic endpoint
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useQuery<
    Project[]
  >({
    queryKey: ["/api/projects"],
    queryFn: async () => apiRequest("/api/projects"),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
  });

  // Fetch team members for assignment (simplified)
  const { data: teamMembers = [], isLoading: teamLoading, error: teamError } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => apiRequest("/api/users"),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) =>
      apiRequest("/api/tasks", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Success", description: "Task created successfully" });
      setIsCreateTaskOpen(false);
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) =>
      apiRequest(`/api/tasks/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setEditingTask(null);
      setEditingField(null);
    },
  });

  const isLoading = tasksLoading || projectsLoading || teamLoading;
  const hasErrors = tasksError || projectsError || teamError;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6 p-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (hasErrors) {
    return (
      <MainLayout>
        <div className="space-y-6 p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <AlertTriangle className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Unable to Load Tasks</h3>
                <p className="text-gray-600 mb-4">
                  There was an issue loading your task data. Please try refreshing the page.
                </p>
                <Button 
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                  }}
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Filter and search tasks
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    if (
      searchTerm &&
      !task.title.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    // Status filter
    if (
      view.filters.status.length > 0 &&
      !view.filters.status.includes(task.status)
    ) {
      return false;
    }

    // Priority filter
    if (
      view.filters.priority.length > 0 &&
      !view.filters.priority.includes(task.priority)
    ) {
      return false;
    }

    // Assignee filter
    if (
      view.filters.assignee.length > 0 &&
      (!task.assignedTo || !view.filters.assignee.includes(task.assignedTo))
    ) {
      return false;
    }

    return true;
  });

  // Group tasks by the selected grouping
  const groupedTasks = groupTasksBy(filteredTasks, view.groupBy);

  // Sort tasks within groups
  const sortedGroupedTasks = Object.entries(groupedTasks).map(
    ([group, tasks]) => [
      group,
      sortTasks(tasks as Task[], view.sortBy, view.sortOrder),
    ]
  );

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleInlineEdit = (taskId: string, field: string, value: any) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: { [field]: value },
    });
  };

  const getDueDateStatus = (dueDate?: string) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();

    if (isToday(due)) return "today";
    if (isBefore(due, now)) return "overdue";
    if (isBefore(due, new Date(now.getTime() + 24 * 60 * 60 * 1000)))
      return "tomorrow";
    return "upcoming";
  };

  return (
    <MainLayout
      title="Task Management"
      description="Advanced project and task management"
    >
      <div className="space-y-6">
        <ContextualHelp page="task-management" />
        <PageAlerts categories={["business","performance"]} severities={["high","critical"]} className="-mt-2" />
        {/* Header with Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">Tasks</h1>
            <Badge variant="secondary" className="text-xs">
              {filteredTasks.length} tasks
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateProjectOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Project
            </Button>
            <Button size="sm" onClick={() => setIsCreateTaskOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Task
            </Button>
          </div>
        </div>

        {/* View Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* View Type Toggle */}
              <div className="flex rounded-lg border p-1">
                <Button
                  variant={view.type === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView((prev) => ({ ...prev, type: "list" }))}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={view.type === "board" ? "default" : "ghost"}
                  size="sm"
                  onClick={() =>
                    setView((prev) => ({ ...prev, type: "board" }))
                  }
                >
                  <Kanban className="h-4 w-4" />
                </Button>
                <Button
                  variant={view.type === "gantt" ? "default" : "ghost"}
                  size="sm"
                  onClick={() =>
                    setView((prev) => ({ ...prev, type: "gantt" }))
                  }
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <Select
                  value={view.groupBy}
                  onValueChange={(value) =>
                    setView((prev) => ({ ...prev, groupBy: value as any }))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="assignee">Assignee</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="dueDate">Due Date</SelectItem>
                  </SelectContent>
                </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {Object.entries(statusConfig).map(([status, config]) => (
                      <DropdownMenuItem
                        key={status}
                        className="flex items-center space-x-2"
                        onClick={() => {
                          const newFilters = view.filters.status.includes(
                            status
                          )
                            ? view.filters.status.filter((s) => s !== status)
                            : [...view.filters.status, status];
                          setView((prev) => ({
                            ...prev,
                            filters: { ...prev.filters, status: newFilters },
                          }));
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={view.filters.status.includes(status)}
                          readOnly
                        />
                        <span>{config.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Views */}
        {view.type === "list" && (
          <TaskListView
            groupedTasks={sortedGroupedTasks}
            expandedTasks={expandedTasks}
            selectedTasks={selectedTasks}
            editingTask={editingTask}
            editingField={editingField}
            teamMembers={teamMembers}
            onToggleExpansion={toggleTaskExpansion}
            onToggleSelection={toggleTaskSelection}
            onInlineEdit={handleInlineEdit}
            onEditStart={(taskId, field) => {
              setEditingTask(taskId);
              setEditingField(field);
            }}
            onEditEnd={() => {
              setEditingTask(null);
              setEditingField(null);
            }}
          />
        )}

        {view.type === "board" && (
          <TaskBoardView
            groupedTasks={sortedGroupedTasks}
            onInlineEdit={handleInlineEdit}
            teamMembers={teamMembers}
          />
        )}

        {/* Create Task Dialog */}
        <CreateTaskDialog
          open={isCreateTaskOpen}
          onOpenChange={setIsCreateTaskOpen}
          projects={projects}
          teamMembers={teamMembers}
          onSubmit={(data) => createTaskMutation.mutate(data)}
          isLoading={createTaskMutation.isPending}
        />

        {/* Create Project Dialog */}
        <CreateProjectDialog
          open={isCreateProjectOpen}
          onOpenChange={setIsCreateProjectOpen}
          teamMembers={teamMembers}
          onSubmit={(data) => console.log("Create project:", data)}
          isLoading={false}
        />
      </div>
    </MainLayout>
  );
}

// Task List View Component
function TaskListView({
  groupedTasks,
  expandedTasks,
  selectedTasks,
  editingTask,
  editingField,
  teamMembers,
  onToggleExpansion,
  onToggleSelection,
  onInlineEdit,
  onEditStart,
  onEditEnd,
}: {
  groupedTasks: [string, Task[]][];
  expandedTasks: string[];
  selectedTasks: string[];
  editingTask: string | null;
  editingField: string | null;
  teamMembers: any[];
  onToggleExpansion: (taskId: string) => void;
  onToggleSelection: (taskId: string) => void;
  onInlineEdit: (taskId: string, field: string, value: any) => void;
  onEditStart: (taskId: string, field: string) => void;
  onEditEnd: () => void;
}) {
  return (
    <div className="space-y-6">
      {groupedTasks.map(([groupName, tasks]) => (
        <Card key={groupName}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {groupName} ({tasks.length})
              </CardTitle>
              <Badge variant="outline">{tasks.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="min-w-[300px]">Task</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-32">Priority</TableHead>
                    <TableHead className="w-40">Assignee</TableHead>
                    <TableHead className="w-32">Due Date</TableHead>
                    <TableHead className="w-24">Progress</TableHead>
                    <TableHead className="w-20">Time</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isExpanded={expandedTasks.includes(task.id)}
                      isSelected={selectedTasks.includes(task.id)}
                      isEditing={editingTask === task.id}
                      editingField={editingField}
                      teamMembers={teamMembers}
                      onToggleExpansion={onToggleExpansion}
                      onToggleSelection={onToggleSelection}
                      onInlineEdit={onInlineEdit}
                      onEditStart={onEditStart}
                      onEditEnd={onEditEnd}
                    />
                  ))}
                
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Individual Task Row Component
function TaskRow({
  task,
  isExpanded,
  isSelected,
  isEditing,
  editingField,
  teamMembers,
  onToggleExpansion,
  onToggleSelection,
  onInlineEdit,
  onEditStart,
  onEditEnd,
}: {
  task: Task;
  isExpanded: boolean;
  isSelected: boolean;
  isEditing: boolean;
  editingField: string | null;
  teamMembers: any[];
  onToggleExpansion: (taskId: string) => void;
  onToggleSelection: (taskId: string) => void;
  onInlineEdit: (taskId: string, field: string, value: any) => void;
  onEditStart: (taskId: string, field: string) => void;
  onEditEnd: () => void;
}) {
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const dueDateStatus = getDueDateStatus(task.dueDate);

  return (
    <>
      <TableRow className="hover:bg-gray-50 group">
        {/* Expand/Collapse */}
        <TableCell>
          {hasSubtasks && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onToggleExpansion(task.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </TableCell>

        {/* Selection Checkbox */}
        <TableCell>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(task.id)}
            className="rounded border-gray-300"
          />
        </TableCell>

        {/* Task Title */}
        <TableCell>
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                priorityConfig[task.priority].color
              }`}
            />
            {isEditing && editingField === "title" ? (
              <Input
                defaultValue={task.title}
                autoFocus
                onBlur={(e) => {
                  onInlineEdit(task.id, "title", e.target.value);
                  onEditEnd();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onInlineEdit(task.id, "title", e.currentTarget.value);
                    onEditEnd();
                  }
                  if (e.key === "Escape") {
                    onEditEnd();
                  }
                }}
                className="h-7"
              />
            ) : (
              <span
                className="font-medium cursor-pointer hover:text-blue-600"
                onClick={() => onEditStart(task.id, "title")}
              >
                {task.title}
              </span>
            )}
            {task.commentCount > 0 && (
              <div className="flex items-center text-gray-400">
                <MessageSquare className="h-3 w-3 mr-1" />
                <span className="text-xs">{task.commentCount}</span>
              </div>
            )}
            {task.attachmentCount > 0 && (
              <div className="flex items-center text-gray-400">
                <Paperclip className="h-3 w-3 mr-1" />
                <span className="text-xs">{task.attachmentCount}</span>
              </div>
            )}
          </div>
        </TableCell>

        {/* Status */}
        <TableCell>
          <InlineStatusSelect
            value={task.status}
            onChange={(value) => onInlineEdit(task.id, "status", value)}
          />
        </TableCell>

        {/* Priority */}
        <TableCell>
          <InlinePrioritySelect
            value={task.priority}
            onChange={(value) => onInlineEdit(task.id, "priority", value)}
          />
        </TableCell>

        {/* Assignee */}
        <TableCell>
          <InlineAssigneeSelect
            value={task.assignedTo}
            teamMembers={teamMembers}
            onChange={(value) => onInlineEdit(task.id, "assignedTo", value)}
          />
        </TableCell>

        {/* Due Date */}
        <TableCell>
          <InlineDatePicker
            value={task.dueDate}
            status={dueDateStatus}
            onChange={(value) => onInlineEdit(task.id, "dueDate", value)}
          />
        </TableCell>

        {/* Progress */}
        <TableCell>
          <div className="flex items-center space-x-2">
            <Progress
              value={task.completionPercentage}
              className="flex-1 h-2"
            />
            <span className="text-xs text-gray-500 w-8">
              {task.completionPercentage}%
            </span>
          </div>
        </TableCell>

        {/* Time Tracked */}
        <TableCell>
          <div className="flex items-center text-sm text-gray-600">
            <Timer className="h-3 w-3 mr-1" />
            {Math.floor(task.timeTracked / 60)}h {task.timeTracked % 60}m
          </div>
        </TableCell>

        {/* Actions */}
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link className="mr-2 h-4 w-4" />
                Copy Link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* Subtasks */}
      {hasSubtasks && isExpanded && (
        <>
          {task.subtasks!.map((subtask) => (
            <TableRow key={subtask.id} className="bg-gray-50">
              <TableCell></TableCell>
              <TableCell>
                <div className="ml-6">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelection(subtask.id)}
                    className="rounded border-gray-300"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="ml-6 flex items-center space-x-2">
                  <ArrowRight className="h-3 w-3 text-gray-400" />
                  <span className="text-sm">{subtask.title}</span>
                </div>
              </TableCell>
              <TableCell>
                <InlineStatusSelect
                  value={subtask.status}
                  onChange={(value) =>
                    onInlineEdit(subtask.id, "status", value)
                  }
                />
              </TableCell>
              <TableCell>
                <InlinePrioritySelect
                  value={subtask.priority}
                  onChange={(value) =>
                    onInlineEdit(subtask.id, "priority", value)
                  }
                />
              </TableCell>
              <TableCell>
                <InlineAssigneeSelect
                  value={subtask.assignedTo}
                  teamMembers={teamMembers}
                  onChange={(value) =>
                    onInlineEdit(subtask.id, "assignedTo", value)
                  }
                />
              </TableCell>
              <TableCell>
                <InlineDatePicker
                  value={subtask.dueDate}
                  status={getDueDateStatus(subtask.dueDate)}
                  onChange={(value) =>
                    onInlineEdit(subtask.id, "dueDate", value)
                  }
                />
              </TableCell>
              <TableCell>
                <Progress
                  value={subtask.completionPercentage}
                  className="h-2"
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center text-sm text-gray-600">
                  <Timer className="h-3 w-3 mr-1" />
                  {Math.floor(subtask.timeTracked / 60)}h
                </div>
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          ))}
        </>
      )}
    </>
  );
}

// Helper functions
function groupTasksBy(tasks: Task[], groupBy: string): Record<string, Task[]> {
  return tasks.reduce((acc, task) => {
    let key = "Ungrouped";

    switch (groupBy) {
      case "status":
        key = statusConfig[task.status]?.label || task.status;
        break;
      case "priority":
        key = priorityConfig[task.priority]?.label || task.priority;
        break;
      case "assignee":
        key = task.assignedToName || "Unassigned";
        break;
      case "project":
        key = task.projectName || "No Project";
        break;
      case "dueDate":
        if (!task.dueDate) {
          key = "No Due Date";
        } else {
          const status = getDueDateStatus(task.dueDate);
          key =
            status === "overdue"
              ? "Overdue"
              : status === "today"
              ? "Due Today"
              : status === "tomorrow"
              ? "Due Tomorrow"
              : "Upcoming";
        }
        break;
    }

    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {} as Record<string, Task[]>);
}

function sortTasks(tasks: Task[], sortBy: string, sortOrder: string): Task[] {
  return [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "dueDate":
        const aDate = a.dueDate ? new Date(a.dueDate) : new Date("9999-12-31");
        const bDate = b.dueDate ? new Date(b.dueDate) : new Date("9999-12-31");
        comparison = aDate.getTime() - bDate.getTime();
        break;
      case "priority":
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      case "status":
        const statusOrder = {
          todo: 0,
          in_progress: 1,
          review: 2,
          completed: 3,
          cancelled: 4,
        };
        comparison = statusOrder[a.status] - statusOrder[b.status];
        break;
      case "created":
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "updated":
        comparison =
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
    }

    return sortOrder === "desc" ? -comparison : comparison;
  });
}
