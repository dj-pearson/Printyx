import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertCircle, Filter, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, isPast, format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string | null;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  customFields?: {
    workflowExecutionId?: string;
    workflowContext?: Record<string, any>;
  };
}

export default function MyTasks() {
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks', { assignedToMe: true }],
    queryFn: async () => {
      const response = await apiRequest('/api/tasks?assignedToMe=true', 'GET');
      return (response || []).map((task: any) => ({
        ...task,
        id: task.id,
        taskName: task.task_name || task.taskName || '',
        assignedTo: task.assignedTo || task.assignedTo || null,
        dueDate: task.dueDate || task.dueDate || null,
        createdAt: task.createdAt || task.createdAt || '',
        updatedAt: task.updatedAt || task.updatedAt || '',
      }));
    },
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!response.ok) throw new Error('Failed to complete task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: 'Task completed',
        description: 'The task has been marked as completed.',
      });
      setDetailsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to complete task. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update task status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: 'Task updated',
        description: 'The task status has been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update task. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleViewDetails = (task: Task) => {
    setSelectedTask(task);
    setDetailsDialogOpen(true);
  };

  const handleCompleteTask = (taskId: string) => {
    completeTaskMutation.mutate(taskId);
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-500',
      medium: 'bg-blue-500',
      high: 'bg-orange-500',
      urgent: 'bg-red-500',
    };
    return <Badge className={colors[priority] || 'bg-gray-500'}>{priority}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      todo: 'bg-gray-500',
      in_progress: 'bg-blue-500',
      review: 'bg-yellow-500',
      completed: 'bg-green-500',
      cancelled: 'bg-red-500',
    };
    return <Badge className={colors[status] || 'bg-gray-500'}>{status.replace('_', ' ')}</Badge>;
  };

  const isOverdue = (task: Task) => {
    return task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'completed';
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const statusMatch =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !['completed', 'cancelled'].includes(task.status)) ||
      task.status === statusFilter;

    const priorityMatch = priorityFilter === 'all' || task.priority === priorityFilter;

    return statusMatch && priorityMatch;
  });

  // Group tasks by category
  const overdueTasks = filteredTasks.filter(isOverdue);
  const todayTasks = filteredTasks.filter(
    (task) =>
      task.dueDate &&
      !isPast(new Date(task.dueDate)) &&
      new Date(task.dueDate).toDateString() === new Date().toDateString() &&
      task.status !== 'completed',
  );
  const upcomingTasks = filteredTasks.filter(
    (task) =>
      task.dueDate &&
      !isPast(new Date(task.dueDate)) &&
      new Date(task.dueDate).toDateString() !== new Date().toDateString() &&
      task.status !== 'completed',
  );
  const completedTasks = filteredTasks.filter((task) => task.status === 'completed');

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Tasks assigned to you from workflows and projects
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{overdueTasks.length}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{todayTasks.length}</div>
            <p className="text-xs text-muted-foreground">Tasks due today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{upcomingTasks.length}</div>
            <p className="text-xs text-muted-foreground">Tasks due later</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{completedTasks.length}</div>
            <p className="text-xs text-muted-foreground">Tasks completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filter Tasks</CardTitle>
              <CardDescription>Refine your task list</CardDescription>
            </div>
            <Filter className="w-5 h-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by priority" />
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
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks ({filteredTasks.length})</CardTitle>
          <CardDescription>Your assigned tasks and deadlines</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No tasks found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {statusFilter === 'active'
                  ? "You're all caught up! No active tasks."
                  : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id} className={isOverdue(task) ? 'bg-red-50' : ''}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {task.title}
                          {isOverdue(task) && <AlertCircle className="w-4 h-4 text-red-500" />}
                        </div>
                        {task.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {task.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <div>
                          <div className={isOverdue(task) ? 'text-red-500 font-medium' : ''}>
                            {format(new Date(task.dueDate), 'MMM d, yyyy')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No due date</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(task)}>
                          View Details
                        </Button>
                        {task.status !== 'completed' && (
                          <Button
                            size="sm"
                            onClick={() => handleCompleteTask(task.id)}
                            disabled={completeTaskMutation.isPending}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Task Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>Task details and workflow context</DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4 py-4">
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedTask.description || 'No description provided'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Priority</h4>
                  {getPriorityBadge(selectedTask.priority)}
                </div>
                <div>
                  <h4 className="font-medium mb-2">Status</h4>
                  {getStatusBadge(selectedTask.status)}
                </div>
              </div>

              {selectedTask.dueDate && (
                <div>
                  <h4 className="font-medium mb-2">Due Date</h4>
                  <p className="text-sm">
                    {format(new Date(selectedTask.dueDate), 'MMMM d, yyyy h:mm a')}
                    {isOverdue(selectedTask) && (
                      <span className="text-red-500 font-medium ml-2">(Overdue)</span>
                    )}
                  </p>
                </div>
              )}

              {selectedTask.customFields?.workflowContext && (
                <div>
                  <h4 className="font-medium mb-2">Workflow Context</h4>
                  <div className="bg-muted p-3 rounded text-sm space-y-1">
                    {Object.entries(selectedTask.customFields.workflowContext).map(
                      ([key, value]) => (
                        <div key={key}>
                          <span className="font-medium">{key}:</span>{' '}
                          <span className="text-muted-foreground">{String(value)}</span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
            {selectedTask && selectedTask.status !== 'completed' && (
              <Button
                onClick={() => handleCompleteTask(selectedTask.id)}
                disabled={completeTaskMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {completeTaskMutation.isPending ? 'Completing...' : 'Mark Complete'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
