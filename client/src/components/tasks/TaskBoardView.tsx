import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Users,
  GripVertical,
} from 'lucide-react';
import { TaskTimeTracker } from './TaskTimeTracker';
import { format, isToday, isTomorrow, isAfter, isBefore } from 'date-fns';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
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
  { id: 'todo', title: 'To Do', color: 'bg-gray-100', limit: null },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-100', limit: 5 },
  { id: 'review', title: 'Review', color: 'bg-purple-100', limit: 3 },
  { id: 'completed', title: 'Completed', color: 'bg-green-100', limit: null },
];

const priorityConfig = {
  urgent: { label: 'Urgent', color: 'bg-red-500', icon: '🔥' },
  high: { label: 'High', color: 'bg-orange-500', icon: '⚡' },
  medium: { label: 'Medium', color: 'bg-yellow-500', icon: '📌' },
  low: { label: 'Low', color: 'bg-green-500', icon: '📋' },
};

export function TaskBoardView({ groupedTasks, onInlineEdit, teamMembers }: TaskBoardViewProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Configure sensors for mobile-first drag and drop
  // TouchSensor with increased tolerance for better mobile UX
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 150ms hold before drag starts (better than 200ms)
        tolerance: 10, // 10px tolerance for tap vs drag (increased for mobile)
      },
    }),
  );

  // Organize tasks by status for board view
  const tasksByStatus = statusColumns.reduce(
    (acc, column) => {
      acc[column.id] = [];
      return acc;
    },
    {} as Record<string, Task[]>,
  );

  // Flatten all tasks and organize by status
  groupedTasks.forEach(([groupName, tasks]) => {
    tasks.forEach((task) => {
      if (tasksByStatus[task.status]) {
        tasksByStatus[task.status].push(task);
      }
    });
  });

  const handleDragStart = (event: DragStartEvent) => {
    const task = findTaskById(event.active.id as string, tasksByStatus);
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const task = findTaskById(active.id as string, tasksByStatus);
      const newStatus = over.id as string;

      if (task && task.status !== newStatus) {
        onInlineEdit(task.id, 'status', newStatus);
      }
    }

    setActiveTask(null);
  };

  const handleDragCancel = () => {
    setActiveTask(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Mobile-optimized horizontal scroll container with smooth momentum */}
      <div className="flex gap-3 sm:gap-4 md:gap-6 overflow-x-auto pb-6 min-h-[600px] -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory md:snap-none">
        {statusColumns.map((column) => {
          const tasks = tasksByStatus[column.id] || [];
          const isOverLimit = column.limit && tasks.length > column.limit;

          return (
            <DroppableColumn
              key={column.id}
              id={column.id}
              title={column.title}
              color={column.color}
              limit={column.limit}
              tasks={tasks}
              isOverLimit={isOverLimit}
              teamMembers={teamMembers}
              onInlineEdit={onInlineEdit}
            />
          );
        })}
      </div>

      {/* Drag overlay for visual feedback during drag */}
      <DragOverlay>
        {activeTask ? (
          <div className="opacity-80 rotate-3 scale-105 transition-transform">
            <TaskCard
              task={activeTask}
              teamMembers={teamMembers}
              onInlineEdit={onInlineEdit}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Helper function to find task by ID
function findTaskById(taskId: string, tasksByStatus: Record<string, Task[]>): Task | null {
  for (const tasks of Object.values(tasksByStatus)) {
    const task = tasks.find((t) => t.id === taskId);
    if (task) return task;
  }
  return null;
}

// Droppable Column Component
function DroppableColumn({
  id,
  title,
  color,
  limit,
  tasks,
  isOverLimit,
  teamMembers,
  onInlineEdit,
}: {
  id: string;
  title: string;
  color: string;
  limit: number | null;
  tasks: Task[];
  isOverLimit: boolean;
  teamMembers: any[];
  onInlineEdit: (taskId: string, field: string, value: any) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-[85vw] sm:w-80 md:w-[320px] lg:w-[340px] snap-center md:snap-align-none"
    >
      <Card
        className={`h-full transition-colors ${isOver ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
      >
        {/* Touch-friendly column header with proper padding */}
        <CardHeader className={`pb-3 pt-4 px-4 sm:px-4 ${color}`}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              {title}
              <Badge variant={isOverLimit ? 'destructive' : 'secondary'} className="text-xs">
                {tasks.length}
                {limit && ` / ${limit}`}
              </Badge>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 touch-manipulation active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {limit && isOverLimit && (
            <p className="text-xs text-red-600 mt-1">Over limit - consider moving some tasks</p>
          )}
        </CardHeader>

        {/* Scrollable task container with proper mobile spacing */}
        <CardContent className="p-3 sm:p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
          {tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              teamMembers={teamMembers}
              onInlineEdit={onInlineEdit}
            />
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No tasks in {title.toLowerCase()}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-xs touch-manipulation active:scale-95"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add task
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Draggable Task Card Component
function DraggableTaskCard({
  task,
  teamMembers,
  onInlineEdit,
}: {
  task: Task;
  teamMembers: any[];
  onInlineEdit: (taskId: string, field: string, value: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        teamMembers={teamMembers}
        onInlineEdit={onInlineEdit}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function TaskCard({
  task,
  teamMembers,
  onInlineEdit,
  isDragging = false,
  dragHandleProps = {},
}: {
  task: Task;
  teamMembers: any[];
  onInlineEdit: (taskId: string, field: string, value: any) => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}) {
  const assignee = teamMembers.find((member) => member.id === task.assignedTo);
  const dueDateStatus = getDueDateStatus(task.dueDate);
  const priorityConf = priorityConfig[task.priority];

  const getDueDateColor = (status: string | null) => {
    switch (status) {
      case 'overdue':
        return 'text-red-600 bg-red-50';
      case 'today':
        return 'text-yellow-600 bg-yellow-50';
      case 'tomorrow':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <Card
      className={`
        hover:shadow-md transition-all border-l-4 touch-manipulation
        ${isDragging ? 'shadow-xl opacity-50' : 'active:scale-[0.98]'}
      `}
      style={{ borderLeftColor: priorityConf.color.replace('bg-', '#') }}
    >
      <CardContent className="p-4 space-y-3 min-h-[44px]">
        {/* Task Header with Drag Handle */}
        <div className="flex items-start gap-2">
          {/* Touch-friendly drag handle */}
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing pt-1 touch-manipulation min-w-[24px] flex items-center justify-center"
          >
            <GripVertical className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm leading-tight line-clamp-2">{task.title}</h4>
            {task.projectName && (
              <Badge variant="outline" className="text-xs mt-1">
                {task.projectName}
              </Badge>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 touch-manipulation active:scale-95 transition-transform"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem className="touch-manipulation min-h-[44px]">
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem className="touch-manipulation min-h-[44px]">
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem className="touch-manipulation min-h-[44px]">
                Add Subtask
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 touch-manipulation min-h-[44px]">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Task Description */}
        {task.description && (
          <p className="text-xs text-gray-600 line-clamp-2">{task.description}</p>
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
              dueDateStatus,
            )}`}
          >
            {dueDateStatus === 'overdue' ? (
              <AlertTriangle className="h-3 w-3" />
            ) : dueDateStatus === 'today' ? (
              <Clock className="h-3 w-3" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            <span>
              {dueDateStatus === 'today'
                ? 'Due today'
                : dueDateStatus === 'tomorrow'
                  ? 'Due tomorrow'
                  : dueDateStatus === 'overdue'
                    ? 'Overdue'
                    : format(new Date(task.dueDate), 'MMM dd')}
            </span>
          </div>
        )}

        {/* Task Footer - Mobile optimized */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {/* Left side - Priority and Time */}
          <div className="flex items-center gap-2">
            {/* Priority Indicator - larger for visibility */}
            <div
              className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${priorityConf.color}`}
              title={priorityConf.label}
            />

            {/* Time Tracked with Timer */}
            <TaskTimeTracker taskId={task.id} compact />
          </div>

          {/* Right side - Assignee and Indicators */}
          <div className="flex items-center gap-2">
            {/* Comment and Attachment Count */}
            {task.commentCount > 0 && (
              <div className="flex items-center text-xs text-gray-500">
                <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5" />
                {task.commentCount}
              </div>
            )}

            {task.attachmentCount > 0 && (
              <div className="flex items-center text-xs text-gray-500">
                <Paperclip className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5" />
                {task.attachmentCount}
              </div>
            )}

            {/* Watchers */}
            {task.watchers.length > 0 && (
              <div className="flex items-center text-xs text-gray-500">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5" />
                {task.watchers.length}
              </div>
            )}

            {/* Assignee Avatar - touch-friendly size */}
            {assignee ? (
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarImage src={assignee.avatar} />
                <AvatarFallback className="text-xs">
                  {assignee.name?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-200 flex items-center justify-center">
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

  if (isToday(due)) return 'today';
  if (isBefore(due, now)) return 'overdue';
  if (isTomorrow(due)) return 'tomorrow';
  return 'upcoming';
}
