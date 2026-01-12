/**
 * My Tasks View Component
 * Personal task view with overdue/today/upcoming categorization
 * Consolidates functionality from my-tasks.tsx
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  CheckCheck,
  Filter,
  Plus,
  Edit,
  MoreHorizontal,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDistanceToNow, isPast, isToday, format } from 'date-fns';
import { EditTaskDialog } from './TaskDialogs';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignedTo?: string;
  completionPercentage: number;
}

interface MyTasksViewProps {
  tasks: Task[];
  isLoading: boolean;
  teamMembers: any[];
  projects?: any[];
}

export function MyTasksView({ tasks, isLoading, teamMembers, projects = [] }: MyTasksViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) =>
      apiRequest(`/api/tasks/${taskId}`, 'PATCH', { status: 'completed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: 'Success', description: 'Task completed successfully' });
    },
  });

  // Update task mutation (for inline edits)
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<Task> }) =>
      apiRequest(`/api/tasks/${taskId}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: 'Success', description: 'Task updated successfully' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive',
      });
    },
  });

  // Full task edit mutation
  const editTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<Task> }) =>
      apiRequest(`/api/tasks/${taskId}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({ title: 'Success', description: 'Task updated successfully' });
      setIsEditDialogOpen(false);
      setEditingTask(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive',
      });
    },
  });

  const handleInlineEdit = (taskId: string, field: string, value: any) => {
    updateTaskMutation.mutate({ taskId, data: { [field]: value } });
  };

  const handleEditClick = (task: Task) => {
    setEditingTask(task);
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (taskId: string, data: Partial<Task>) => {
    editTaskMutation.mutate({ taskId, data });
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

  // Categorize tasks
  const overdueTasks = filteredTasks.filter(isOverdue);
  const todayTasks = filteredTasks.filter(
    (task) => task.dueDate && isToday(new Date(task.dueDate)) && task.status !== 'completed',
  );
  const upcomingTasks = filteredTasks.filter(
    (task) =>
      task.dueDate &&
      !isPast(new Date(task.dueDate)) &&
      !isToday(new Date(task.dueDate)) &&
      task.status !== 'completed',
  );
  const completedTasks = filteredTasks.filter((task) => task.status === 'completed');

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-500',
      medium: 'bg-blue-500',
      high: 'bg-orange-500',
      urgent: 'bg-red-500',
    };
    return colors[priority] || 'bg-gray-500';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      todo: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      review: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{overdueTasks.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{todayTasks.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{upcomingTasks.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{completedTasks.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
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

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
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
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Tasks ({filteredTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              icon={CheckCheck}
              title={
                statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'No matching tasks'
                  : "You're all caught up!"
              }
              description={
                statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your filters to see more tasks'
                  : 'Create a new task to get started with your work'
              }
              type={statusFilter !== 'all' || priorityFilter !== 'all' ? 'filter' : 'default'}
              action={
                statusFilter !== 'all' || priorityFilter !== 'all'
                  ? {
                      label: 'Clear Filters',
                      onClick: () => {
                        setStatusFilter('all');
                        setPriorityFilter('all');
                      },
                      variant: 'outline',
                    }
                  : undefined
              }
              suggestions={
                statusFilter === 'all' && priorityFilter === 'all'
                  ? [
                      "Click 'New Task' to create your first task",
                      'Tasks help you track work and meet deadlines',
                      'Assign priorities to focus on what matters most',
                    ]
                  : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
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
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{task.title}</div>
                          {isOverdue(task) && <AlertCircle className="w-4 h-4 text-red-500" />}
                        </div>
                        {task.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {task.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* Inline Priority Edit */}
                        <Select
                          value={task.priority}
                          onValueChange={(value) => handleInlineEdit(task.id, 'priority', value)}
                        >
                          <SelectTrigger className="w-[120px] h-8 border-0 focus:ring-1">
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {/* Inline Status Edit */}
                        <Select
                          value={task.status}
                          onValueChange={(value) => handleInlineEdit(task.id, 'status', value)}
                        >
                          <SelectTrigger className="w-[130px] h-8 border-0 focus:ring-1">
                            <Badge variant="outline" className={getStatusColor(task.status)}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {/* Inline Due Date Edit */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 p-0 hover:bg-transparent justify-start font-normal"
                            >
                              {task.dueDate ? (
                                <div>
                                  <div
                                    className={isOverdue(task) ? 'text-red-500 font-medium' : ''}
                                  >
                                    {format(new Date(task.dueDate), 'MMM d, yyyy')}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {formatDistanceToNow(new Date(task.dueDate), {
                                      addSuffix: true,
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">No due date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={task.dueDate ? new Date(task.dueDate) : undefined}
                              onSelect={(date) =>
                                handleInlineEdit(task.id, 'dueDate', date?.toISOString())
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditClick(task)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Task
                              </DropdownMenuItem>
                              {task.status !== 'completed' && (
                                <DropdownMenuItem
                                  onClick={() => completeTaskMutation.mutate(task.id)}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Mark Complete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Task Dialog */}
      <EditTaskDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        task={editingTask}
        projects={projects}
        teamMembers={teamMembers}
        onSubmit={handleEditSubmit}
        isLoading={editTaskMutation.isPending}
      />
    </div>
  );
}
