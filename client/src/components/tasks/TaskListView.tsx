/**
 * Task List View Component
 * Displays tasks in a grouped table format with inline editing
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { InlineStatusSelect, InlinePrioritySelect, InlineAssigneeSelect, InlineDatePicker } from "./InlineEditors";
import { Timer, MessageSquare, Paperclip } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignedTo?: string;
  assignedToName?: string;
  projectName?: string;
  dueDate?: string;
  completionPercentage: number;
  timeTracked?: number;
  commentCount?: number;
  attachmentCount?: number;
}

interface TaskListViewProps {
  tasks: Task[];
  groupBy: string;
  teamMembers: any[];
  onInlineEdit: (taskId: string, field: string, value: any) => void;
  isLoading: boolean;
}

export function TaskListView({
  tasks,
  groupBy,
  teamMembers,
  onInlineEdit,
  isLoading,
}: TaskListViewProps) {
  if (isLoading) {
    return <div className="text-center py-8">Loading tasks...</div>;
  }

  // Group tasks
  const groupedTasks = groupTasksBy(tasks, groupBy);

  return (
    <div className="space-y-4">
      {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
        <Card key={groupName}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                {groupName}
              </CardTitle>
              <Badge variant="outline">{(groupTasks as Task[]).length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[300px]">Task</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-32">Priority</TableHead>
                    <TableHead className="w-40">Assignee</TableHead>
                    <TableHead className="w-32">Due Date</TableHead>
                    <TableHead className="w-24">Progress</TableHead>
                    <TableHead className="w-20">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(groupTasks as Task[]).map((task) => (
                    <TableRow key={task.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{task.title}</span>
                          {(task.commentCount ?? 0) > 0 && (
                            <div className="flex items-center text-gray-400">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              <span className="text-xs">{task.commentCount}</span>
                            </div>
                          )}
                          {(task.attachmentCount ?? 0) > 0 && (
                            <div className="flex items-center text-gray-400">
                              <Paperclip className="h-3 w-3 mr-1" />
                              <span className="text-xs">{task.attachmentCount}</span>
                            </div>
                          )}
                        </div>
                        {task.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {task.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <InlineStatusSelect
                          value={task.status}
                          onChange={(value) => onInlineEdit(task.id, "status", value)}
                        />
                      </TableCell>
                      <TableCell>
                        <InlinePrioritySelect
                          value={task.priority}
                          onChange={(value) => onInlineEdit(task.id, "priority", value)}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineAssigneeSelect
                          value={task.assignedTo}
                          teamMembers={teamMembers}
                          onChange={(value) => onInlineEdit(task.id, "assignedTo", value)}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineDatePicker
                          value={task.dueDate}
                          onChange={(value) => onInlineEdit(task.id, "dueDate", value)}
                        />
                      </TableCell>
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
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-600">
                          <Timer className="h-3 w-3 mr-1" />
                          {Math.floor((task.timeTracked ?? 0) / 60)}h
                        </div>
                      </TableCell>
                    </TableRow>
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

// Helper function to group tasks
function groupTasksBy(tasks: Task[], groupBy: string): Record<string, Task[]> {
  const statusConfig: Record<string, { label: string }> = {
    todo: { label: "To Do" },
    in_progress: { label: "In Progress" },
    review: { label: "Review" },
    completed: { label: "Completed" },
    cancelled: { label: "Cancelled" },
  };

  const priorityConfig: Record<string, { label: string }> = {
    urgent: { label: "Urgent" },
    high: { label: "High" },
    medium: { label: "Medium" },
    low: { label: "Low" },
  };

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
    }

    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {} as Record<string, Task[]>);
}
