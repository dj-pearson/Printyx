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

/**
 * WF-P-08. This interface used to carry parentTaskId, startDate, customFields
 * and dependencies, and the create dialog sent all four. Migration 0002 DROPPED
 * every one of those columns from `tasks`, and PostgREST rejects an unknown
 * column with PGRST204 - so the whole write failed and this dialog could not
 * create a task at all.
 *
 * customerId, dealId and handoffId replace them: what the task is ABOUT, which
 * is the thing tasks never recorded.
 */
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  projectId?: string;
  customerId?: string;
  dealId?: string;
  handoffId?: string;
  dueDate?: string;
  estimatedHours?: number;
  tags: string[];
}

/** A record a task can be about, for the related-record picker. */
export interface RelatedRecord {
  id: string;
  label: string;
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
  customers = [],
  deals = [],
  relatedTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  teamMembers: any[];
  onSubmit: (data: Partial<Task>) => void;
  isLoading: boolean;
  /** WF-P-08: accounts and deals the task can be attached to. */
  customers?: RelatedRecord[];
  deals?: RelatedRecord[];
  /** Pre-linked when the dialog is opened from a record page. */
  relatedTo?: Pick<Task, 'customerId' | 'dealId' | 'handoffId'>;
}) {
  const EMPTY: Partial<Task> = {
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignedTo: '',
    projectId: '',
    customerId: relatedTo?.customerId ?? '',
    dealId: relatedTo?.dealId ?? '',
    handoffId: relatedTo?.handoffId ?? '',
    dueDate: '',
    estimatedHours: 0,
    tags: [],
  };
  const [formData, setFormData] = useState<Partial<Task>>(EMPTY);

  const [newTag, setNewTag] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 'none' is the select's way of saying unset; the column takes null.
    const unset = (v?: string) => (!v || v === 'none' ? null : v);
    onSubmit({
      ...formData,
      projectId: unset(formData.projectId) ?? undefined,
      customerId: unset(formData.customerId) ?? undefined,
      dealId: unset(formData.dealId) ?? undefined,
      handoffId: unset(formData.handoffId) ?? undefined,
    });
    setFormData(EMPTY);
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
          <DialogTitle className="text-lg sm:text-xl">Create New Task</DialogTitle>
          <DialogDescription className="text-sm">
            Create a task and say what it is about, so the record it concerns can list it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="details" className="w-full">
            {/* WF-P-08: the Workflow and Custom tabs are gone. Workflow held a
                dependency picker over tasks.dependencies and Custom said
                "Custom fields will be available in future updates" - both
                columns were DROPPED by migration 0002, so neither could ever
                have been stored. */}
            <TabsList className="grid w-full grid-cols-2 h-auto">
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
                    aria-label="Add"
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
              {/* WF-P-08: what the task is ABOUT. tasks.customer_id has existed
                  since migration 0002 and nothing read or wrote it, so every
                  task was a floating to-do with an assignee and no subject. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Customer</Label>
                  <Select
                    value={formData.customerId || 'none'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, customerId: value }))
                    }
                  >
                    <SelectTrigger className="h-11 touch-manipulation">
                      <SelectValue placeholder="Not about a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="min-h-[44px]">
                        Not about a customer
                      </SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id} className="min-h-[44px]">
                          {customer.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Deal</Label>
                  <Select
                    value={formData.dealId || 'none'}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, dealId: value }))}
                  >
                    <SelectTrigger className="h-11 touch-manipulation">
                      <SelectValue placeholder="Not about a deal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="min-h-[44px]">
                        Not about a deal
                      </SelectItem>
                      {deals.map((deal) => (
                        <SelectItem key={deal.id} value={deal.id} className="min-h-[44px]">
                          {deal.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scheduling" className="space-y-4 mt-4">
              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {isLoading ? 'Creating...' : 'Create Task'}
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
