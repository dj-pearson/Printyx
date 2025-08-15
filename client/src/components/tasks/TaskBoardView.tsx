import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Calendar,
  Clock,
  MessageSquare,
  Paperclip,
  Flag,
  AlertTriangle,
  CheckCircle,
  Timer,
  Users,
} from "lucide-react";
import { format, isToday, isTomorrow, isAfter, isBefore } from "date-fns";

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
  dueDate?: string;
  estimatedHours?: number;
  completionPercentage: number;
  tags: string[];
  commentCount: number;
  attachmentCount: number;
  timeTracked: number;
  watchers: string[];
}

interface TaskBoardViewProps {
  groupedTasks: [string, Task[]][];
  onInlineEdit: (taskId: string, field: string, value: any) => void;
  teamMembers: any[];
}

const statusColumns = [
  { id: "todo", title: "To Do", color: "bg-gray-100", limit: null },
  { id: "in_progress", title: "In Progress", color: "bg-blue-100", limit: 5 },
  { id: "review", title: "Review", color: "bg-purple-100", limit: 3 },
  { id: "completed", title: "Completed", color: "bg-green-100", limit: null },
];

const priorityConfig = {
  urgent: { label: "Urgent", color: "bg-red-500", icon: "🔥" },
  high: { label: "High", color: "bg-orange-500", icon: "⚡" },
  medium: { label: "Medium", color: "bg-yellow-500", icon: "📌" },
  low: { label: "Low", color: "bg-green-500", icon: "📋" },
};

export function TaskBoardView({
  groupedTasks,
  onInlineEdit,
  teamMembers,
}: TaskBoardViewProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // Organize tasks by status for board view
  const tasksByStatus = statusColumns.reduce((acc, column) => {
    acc[column.id] = [];
    return acc;
  }, {} as Record<string, Task[]>);

  // Flatten all tasks and organize by status
  groupedTasks.forEach(([groupName, tasks]) => {
    tasks.forEach((task) => {
      if (tasksByStatus[task.status]) {
        tasksByStatus[task.status].push(task);
      }
    });
  });

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== newStatus) {
      onInlineEdit(draggedTask.id, "status", newStatus);
    }
    setDraggedTask(null);
  };

  const getDueDateStatus = (dueDate?: string) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();

    if (isToday(due)) return "today";
    if (isBefore(due, now)) return "overdue";
    if (isTomorrow(due)) return "tomorrow";
    return "upcoming";
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-6 min-h-[600px]">
      {statusColumns.map((column) => {
        const tasks = tasksByStatus[column.id] || [];
        const isOverLimit = column.limit && tasks.length > column.limit;

        return (
          <div
            key={column.id}
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <Card className="h-full">
              <CardHeader className={`pb-3 ${column.color}`}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {column.title}
                    <Badge
                      variant={isOverLimit ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {tasks.length}
                      {column.limit && ` / ${column.limit}`}
                    </Badge>
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {column.limit && isOverLimit && (
                  <p className="text-xs text-red-600">
                    ⚠️ Over limit - consider moving some tasks
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    teamMembers={teamMembers}
                    onDragStart={handleDragStart}
                    onInlineEdit={onInlineEdit}
                  />
                ))}
                {tasks.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">
                      No tasks in {column.title.toLowerCase()}
                    </p>
                    <Button variant="ghost" size="sm" className="mt-2 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Add task
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({
  task,
  teamMembers,
  onDragStart,
  onInlineEdit,
}: {
  task: Task;
  teamMembers: any[];
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onInlineEdit: (taskId: string, field: string, value: any) => void;
}) {
  const assignee = teamMembers.find((member) => member.id === task.assignedTo);
  const dueDateStatus = getDueDateStatus(task.dueDate);
  const priorityConf = priorityConfig[task.priority];

  const getDueDateColor = (status: string | null) => {
    switch (status) {
      case "overdue":
        return "text-red-600 bg-red-50";
      case "today":
        return "text-yellow-600 bg-yellow-50";
      case "tomorrow":
        return "text-blue-600 bg-blue-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <Card
      className="cursor-move hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: priorityConf.color.replace("bg-", "#") }}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
    >
      <CardContent className="p-3 space-y-3">
        {/* Task Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-sm leading-tight line-clamp-2">
              {task.title}
            </h4>
            {task.projectName && (
              <Badge variant="outline" className="text-xs mt-1">
                {task.projectName}
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>Edit Task</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem>Add Subtask</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Task Description */}
        {task.description && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {task.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{task.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {task.completionPercentage > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{task.completionPercentage}%</span>
            </div>
            <Progress value={task.completionPercentage} className="h-1" />
          </div>
        )}

        {/* Due Date */}
        {task.dueDate && (
          <div
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${getDueDateColor(
              dueDateStatus
            )}`}
          >
            {dueDateStatus === "overdue" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : dueDateStatus === "today" ? (
              <Clock className="h-3 w-3" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            <span>
              {dueDateStatus === "today"
                ? "Due today"
                : dueDateStatus === "tomorrow"
                ? "Due tomorrow"
                : dueDateStatus === "overdue"
                ? "Overdue"
                : format(new Date(task.dueDate), "MMM dd")}
            </span>
          </div>
        )}

        {/* Task Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {/* Left side - Priority and Time */}
          <div className="flex items-center gap-2">
            {/* Priority Indicator */}
            <div className={`w-3 h-3 rounded-full ${priorityConf.color}`} />

            {/* Time Tracked */}
            {task.timeTracked > 0 && (
              <div className="flex items-center text-xs text-gray-600">
                <Timer className="h-3 w-3 mr-1" />
                {Math.floor(task.timeTracked / 60)}h
              </div>
            )}
          </div>

          {/* Right side - Assignee and Indicators */}
          <div className="flex items-center gap-1">
            {/* Comment and Attachment Count */}
            {task.commentCount > 0 && (
              <div className="flex items-center text-xs text-gray-500">
                <MessageSquare className="h-3 w-3 mr-1" />
                {task.commentCount}
              </div>
            )}

            {task.attachmentCount > 0 && (
              <div className="flex items-center text-xs text-gray-500">
                <Paperclip className="h-3 w-3 mr-1" />
                {task.attachmentCount}
              </div>
            )}

            {/* Watchers */}
            {task.watchers.length > 0 && (
              <div className="flex items-center text-xs text-gray-500">
                <Users className="h-3 w-3 mr-1" />
                {task.watchers.length}
              </div>
            )}

            {/* Assignee Avatar */}
            {assignee ? (
              <Avatar className="h-6 w-6">
                <AvatarImage src={assignee.avatar} />
                <AvatarFallback className="text-xs">
                  {assignee.name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-xs text-gray-500">?</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getDueDateStatus(dueDate?: string): string | null {
  if (!dueDate) return null;

  const due = new Date(dueDate);
  const now = new Date();

  if (isToday(due)) return "today";
  if (isBefore(due, now)) return "overdue";
  if (isTomorrow(due)) return "tomorrow";
  return "upcoming";
}
