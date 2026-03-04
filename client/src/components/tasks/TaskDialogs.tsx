import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar as CalendarIcon,
  Clock,
  Flag,
  Tag,
  Users,
  Link,
  Plus,
  X,
  Timer,
} from 'lucide-react';
import { TaskTimeTracker } from './TaskTimeTracker';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  projectId?: string;
  parentTaskId?: string;
  dueDate?: string;
  startDate?: string;
  estimatedHours?: number;
  tags: string[];
  customFields: Record<string, any>;
  dependencies: string[];
}

interface Project {
  id: string;
  name: string;
  status: string;
}

// Create Task Dialog
export function CreateTaskDialog({
  open,
  onOpenChange,
  projects,
  teamMembers,
  onSubmit,
  isLoading,
  parentTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  teamMembers: any[];
  onSubmit: (data: Partial<Task>) => void;
  isLoading: boolean;
  parentTask?: Task;
}) {
  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignedTo: '',
    projectId: '',
    parentTaskId: parentTask?.id,
    dueDate: '',
    startDate: '',
    estimatedHours: 0,
    tags: [],
    customFields: {},
    dependencies: [],
  });

  const [newTag, setNewTag] = useState('');
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      dependencies: selectedDependencies,
    });
    // Reset form
    setFormData({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      assignedTo: '',
      projectId: '',
      parentTaskId: parentTask?.id,
      dueDate: '',
      startDate: '',
      estimatedHours: 0,
      tags: [],
      customFields: {},
      dependencies: [],
    });
    setSelectedDependencies([]);
  };

  const addTag = () => {
    if (newTag && !formData.tags?.includes(newTag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), newTag],
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((tag) => tag !== tagToRemove) || [],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {parentTask ? `Create Subtask for "${parentTask.title}"` : 'Create New Task'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {parentTask
              ? 'Add a subtask to break down the work into smaller, manageable pieces.'
              : 'Create a new task and configure all the details needed for successful completion.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
              <TabsTrigger
                value="details"
                className="text-xs sm:text-sm min-h-[44px] touch-manipulation"
              >
                Details
              </TabsTrigger>
              <TabsTrigger
                value="scheduling"
                className="text-xs sm:text-sm min-h-[44px] touch-manipulation"
              >
                Schedule
              </TabsTrigger>
              <TabsTrigger
                value="workflow"
                className="text-xs sm:text-sm min-h-[44px] touch-manipulation"
              >
                Workflow
              </TabsTrigger>
              <TabsTrigger
                value="custom"
                className="text-xs sm:text-sm min-h-[44px] touch-manipulation"
              >
                Custom
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              {/* Task Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm sm:text-base">
                  Task Title *
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="What needs to be done?"
                  required
                  className="h-11 touch-manipulation text-base"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm sm:text-base">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Add more details about this task..."
                  rows={3}
                  className="touch-manipulation text-base resize-none"
                />
              </div>

              {/* Project & Assignee */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Project</Label>
                  <Select
                    value={formData.projectId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, projectId: value }))
                    }
                  >
                    <SelectTrigger className="h-11 touch-manipulation">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="min-h-[44px]">
                        No Project
                      </SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id} className="min-h-[44px]">
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Assignee</Label>
                  <Select
                    value={formData.assignedTo}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, assignedTo: value }))
                    }
                  >
                    <SelectTrigger className="h-11 touch-manipulation">
                      <SelectValue placeholder="Assign to..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" className="min-h-[44px]">
                        Unassigned
                      </SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id} className="min-h-[44px]">
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={member.avatar} />
                              <AvatarFallback className="text-xs">
                                {member.name?.charAt(0)?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, status: value as any }))
                    }
                  >
                    <SelectTrigger className="h-11 touch-manipulation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo" className="min-h-[44px]">
                        To Do
                      </SelectItem>
                      <SelectItem value="in_progress" className="min-h-[44px]">
                        In Progress
                      </SelectItem>
                      <SelectItem value="review" className="min-h-[44px]">
                        Review
                      </SelectItem>
                      <SelectItem value="completed" className="min-h-[44px]">
                        Completed
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        priority: value as any,
                      }))
                    }
                  >
                    <SelectTrigger className="h-11 touch-manipulation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low" className="min-h-[44px]">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span>Low</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="medium" className="min-h-[44px]">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span>Medium</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="high" className="min-h-[44px]">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-orange-500" />
                          <span>High</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="urgent" className="min-h-[44px]">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span>Urgent</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags?.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer hover:bg-red-100 touch-manipulation min-h-[32px] px-3"
                      onClick={() => removeTag(tag)}
                    >
                      {tag} <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    className="h-11 touch-manipulation text-base"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTag}
                    className="h-11 min-w-[44px] touch-manipulation active:scale-95 transition-transform"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scheduling" className="space-y-4 mt-4">
              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left h-11 touch-manipulation"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.startDate
                          ? format(new Date(formData.startDate), 'PPP')
                          : 'Pick start date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.startDate ? new Date(formData.startDate) : undefined}
                        onSelect={(date) =>
                          setFormData((prev) => ({
                            ...prev,
                            startDate: date ? date.toISOString().split('T')[0] : '',
                          }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left h-11 touch-manipulation"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.dueDate
                          ? format(new Date(formData.dueDate), 'PPP')
                          : 'Pick due date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.dueDate ? new Date(formData.dueDate) : undefined}
                        onSelect={(date) =>
                          setFormData((prev) => ({
                            ...prev,
                            dueDate: date ? date.toISOString().split('T')[0] : '',
                          }))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Time Estimate */}
              <div className="space-y-2">
                <Label htmlFor="estimatedHours" className="text-sm sm:text-base">
                  Estimated Hours
                </Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.estimatedHours}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      estimatedHours: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="How many hours will this take?"
                  className="h-11 touch-manipulation text-base"
                />
              </div>
            </TabsContent>

            <TabsContent value="workflow" className="space-y-4 mt-4">
              {/* Dependencies */}
              <div className="space-y-2">
                <Label>Dependencies</Label>
                <p className="text-sm text-gray-600">
                  Select tasks that must be completed before this task can start.
                </p>
                {/* This would be populated with existing tasks */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm text-gray-500">
                    No dependencies selected. Dependencies help establish task order and workflow.
                  </p>
                </div>
              </div>

              {/* Subtask Creation Helper */}
              {!parentTask && (
                <div className="space-y-2">
                  <Label>Task Breakdown</Label>
                  <p className="text-sm text-gray-600">
                    After creating this task, you can break it down into smaller subtasks for better
                    organization.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  <p>Custom fields will be available in future updates.</p>
                  <p className="text-sm">Add custom properties specific to your workflow.</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-11 touch-manipulation active:scale-95 transition-transform"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.title}
              className="w-full sm:w-auto h-11 touch-manipulation active:scale-95 transition-transform"
            >
              {isLoading ? 'Creating...' : parentTask ? 'Create Subtask' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Create Project Dialog
export function CreateProjectDialog({
  open,
  onOpenChange,
  teamMembers,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: any[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    projectManager: '',
    customerId: '',
    startDate: '',
    endDate: '',
    estimatedBudget: '',
    template: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    // Reset form
    setFormData({
      name: '',
      description: '',
      projectManager: '',
      customerId: '',
      startDate: '',
      endDate: '',
      estimatedBudget: '',
      template: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Create New Project</DialogTitle>
          <DialogDescription className="text-sm">
            Set up a new project to organize and track multiple related tasks.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="projectName" className="text-sm sm:text-base">
              Project Name *
            </Label>
            <Input
              id="projectName"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Enter project name"
              required
              className="h-11 touch-manipulation text-base"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="projectDescription" className="text-sm sm:text-base">
              Description
            </Label>
            <Textarea
              id="projectDescription"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe the project goals and scope..."
              rows={3}
              className="touch-manipulation text-base resize-none"
            />
          </div>

          {/* Project Manager */}
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Project Manager</Label>
            <Select
              value={formData.projectManager}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, projectManager: value }))}
            >
              <SelectTrigger className="h-11 touch-manipulation">
                <SelectValue placeholder="Select project manager" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id} className="min-h-[44px]">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback className="text-xs">
                          {member.name?.charAt(0)?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates and Budget */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Start Date</Label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="h-11 touch-manipulation text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">End Date</Label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                className="h-11 touch-manipulation text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm sm:text-base">Estimated Budget</Label>
              <Input
                type="number"
                value={formData.estimatedBudget}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimatedBudget: e.target.value,
                  }))
                }
                placeholder="$0"
                className="h-11 touch-manipulation text-base"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-11 touch-manipulation active:scale-95 transition-transform"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.name}
              className="w-full sm:w-auto h-11 touch-manipulation active:scale-95 transition-transform"
            >
              {isLoading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit Task Dialog
export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  projects,
  teamMembers,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  projects: Project[];
  teamMembers: any[];
  onSubmit: (taskId: string, data: Partial<Task>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<Task>>({});

  // Pre-populate form when task changes
  React.useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        assignedTo: task.assignedTo || '',
        projectId: task.projectId || '',
        dueDate: task.dueDate || '',
        tags: task.tags || [],
      });
    }
  }, [task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (task) {
      onSubmit(task.id, formData);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Edit Task</DialogTitle>
          <DialogDescription className="text-sm">
            Update task details and configuration
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger
              value="details"
              className="text-xs sm:text-sm min-h-[44px] touch-manipulation"
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="time"
              className="text-xs sm:text-sm min-h-[44px] touch-manipulation"
            >
              <Timer className="h-4 w-4 mr-1.5" />
              Time Tracking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Task Title */}
              <div className="space-y-2">
                <Label htmlFor="edit-title" className="text-sm sm:text-base">
                  Task Title *
                </Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="What needs to be done?"
                  required
                  className="h-11 touch-manipulation text-base"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-sm sm:text-base">
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Add more details about this task..."
                  rows={3}
                  className="touch-manipulation text-base resize-none"
                />
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, status: value as any }))
                    }
                  >
                    <SelectTrigger className="h-11 touch-manipulation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo" className="min-h-[44px]">
                        To Do
                      </SelectItem>
                      <SelectItem value="in_progress" className="min-h-[44px]">
                        In Progress
                      </SelectItem>
                      <SelectItem value="review" className="min-h-[44px]">
                        Review
                      </SelectItem>
                      <SelectItem value="completed" className="min-h-[44px]">
                        Completed
                      </SelectItem>
                      <SelectItem value="cancelled" className="min-h-[44px]">
                        Cancelled
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, priority: value as any }))
                    }
                  >
                    <SelectTrigger className="h-11 touch-manipulation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low" className="min-h-[44px]">
                        Low
                      </SelectItem>
                      <SelectItem value="medium" className="min-h-[44px]">
                        Medium
                      </SelectItem>
                      <SelectItem value="high" className="min-h-[44px]">
                        High
                      </SelectItem>
                      <SelectItem value="urgent" className="min-h-[44px]">
                        Urgent
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Project & Assignee */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Project</Label>
                  <Select
                    value={formData.projectId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, projectId: value }))
                    }
                  >
                    <SelectTrigger className="h-11 touch-manipulation">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="min-h-[44px]">
                        No Project
                      </SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id} className="min-h-[44px]">
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Assignee</Label>
                  <Select
                    value={formData.assignedTo}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, assignedTo: value }))
                    }
                  >
                    <SelectTrigger className="h-11 touch-manipulation">
                      <SelectValue placeholder="Assign to..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" className="min-h-[44px]">
                        Unassigned
                      </SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id} className="min-h-[44px]">
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label className="text-sm sm:text-base">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-11 touch-manipulation justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dueDate ? format(new Date(formData.dueDate), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.dueDate ? new Date(formData.dueDate) : undefined}
                      onSelect={(date) =>
                        setFormData((prev) => ({
                          ...prev,
                          dueDate: date?.toISOString(),
                        }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto h-11 touch-manipulation active:scale-95 transition-transform"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !formData.title}
                  className="w-full sm:w-auto h-11 touch-manipulation active:scale-95 transition-transform"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="time" className="mt-4">
            <TaskTimeTracker taskId={task.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
