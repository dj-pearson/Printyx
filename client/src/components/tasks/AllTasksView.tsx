/**
 * All Tasks View Component
 * Comprehensive task list with multiple view modes, grouping, and filtering
 * Consolidates functionality from TaskManagement.tsx
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Search, Filter, List, Kanban, BarChart3 } from 'lucide-react';

// Import sub-components
import { TaskListView } from './TaskListView';
import { TaskBoardView } from './TaskBoardView';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignedTo?: string;
  projectId?: string;
  dueDate?: string;
  completionPercentage: number;
  tags: string[];
}

interface AllTasksViewProps {
  tasks: Task[];
  isLoading: boolean;
  teamMembers: any[];
  projects: any[];
}

interface ViewConfig {
  type: 'list' | 'board' | 'gantt';
  groupBy: 'status' | 'assignee' | 'priority' | 'project';
  sortBy: 'dueDate' | 'priority' | 'status' | 'created';
  sortOrder: 'asc' | 'desc';
  filters: {
    status: string[];
    priority: string[];
    assignee: string[];
  };
}

export function AllTasksView({ tasks, isLoading, teamMembers, projects }: AllTasksViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<ViewConfig>({
    type: 'list',
    groupBy: 'status',
    sortBy: 'dueDate',
    sortOrder: 'asc',
    filters: {
      status: [],
      priority: [],
      assignee: [],
    },
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/tasks/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
  });

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (view.filters.status.length > 0 && !view.filters.status.includes(task.status)) {
      return false;
    }

    // Priority filter
    if (view.filters.priority.length > 0 && !view.filters.priority.includes(task.priority)) {
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

  const handleInlineEdit = (taskId: string, field: string, value: any) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: { [field]: value },
    });
  };

  const statusConfig = {
    todo: { label: 'To Do', color: 'bg-gray-100 text-gray-800' },
    in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
    review: { label: 'Review', color: 'bg-purple-100 text-purple-800' },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  };

  return (
    <div className="space-y-4">
      {/* View Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* View Type and Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* View Type Toggle */}
              <div className="flex rounded-lg border p-1">
                <Button
                  variant={view.type === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView((prev) => ({ ...prev, type: 'list' }))}
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={view.type === 'board' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView((prev) => ({ ...prev, type: 'board' }))}
                  title="Board View"
                >
                  <Kanban className="h-4 w-4" />
                </Button>
                <Button
                  variant={view.type === 'gantt' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView((prev) => ({ ...prev, type: 'gantt' }))}
                  title="Gantt View"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </div>

              {/* Group By */}
              <Select
                value={view.groupBy}
                onValueChange={(value) => setView((prev) => ({ ...prev, groupBy: value as any }))}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Group by Status</SelectItem>
                  <SelectItem value="assignee">Group by Assignee</SelectItem>
                  <SelectItem value="priority">Group by Priority</SelectItem>
                  <SelectItem value="project">Group by Project</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                    {view.filters.status.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {view.filters.status.length}
                      </Badge>
                    )}
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
                        const newFilters = view.filters.status.includes(status)
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
                        className="h-4 w-4"
                      />
                      <span>{config.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="ml-auto text-sm text-muted-foreground">
                {filteredTasks.length} tasks
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Views */}
      {view.type === 'list' && (
        <TaskListView
          tasks={filteredTasks}
          groupBy={view.groupBy}
          teamMembers={teamMembers}
          onInlineEdit={handleInlineEdit}
          isLoading={isLoading}
        />
      )}

      {view.type === 'board' && (
        <TaskBoardView
          tasks={filteredTasks}
          teamMembers={teamMembers}
          onInlineEdit={handleInlineEdit}
          isLoading={isLoading}
        />
      )}

      {view.type === 'gantt' && (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Gantt View</h3>
            <p className="text-muted-foreground">Gantt chart visualization coming soon</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
