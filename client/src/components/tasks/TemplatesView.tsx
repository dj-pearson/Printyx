/**
 * Templates View Component
 * NEW: Project template management and instantiation
 * Part of Improvement #2 - Task Automation
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Zap,
  Plus,
  FileText,
  CheckCircle,
  Wrench,
  Truck,
  Users,
  Target,
  MoreHorizontal,
  Play,
  Edit,
  Trash2,
  Copy,
} from 'lucide-react';

interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  taskCount: number;
  estimatedDuration?: number;
  isPublic: boolean;
}

interface TemplatesViewProps {
  teamMembers: any[];
}

export function TemplatesView({ teamMembers }: TemplatesViewProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUseTemplateOpen, setIsUseTemplateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/templates'],
    queryFn: async () => apiRequest('/api/templates'),
  });

  // Create project from template mutation
  const useTemplateMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/templates/${selectedTemplate?.id}/instantiate`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: 'Success',
        description: 'Project created from template successfully',
      });
      setIsUseTemplateOpen(false);
      setSelectedTemplate(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create project from template',
        variant: 'destructive',
      });
    },
  });

  // Default templates
  const defaultTemplates = [
    {
      id: 'equipment-installation',
      name: 'Equipment Installation',
      description: 'Complete workflow for installing copiers at customer sites',
      category: 'equipment',
      taskCount: 8,
      estimatedDuration: 480,
      isPublic: true,
      icon: Truck,
      color: 'bg-blue-500',
    },
    {
      id: 'service-campaign',
      name: 'Service Campaign',
      description: 'Proactive maintenance campaign for multiple devices',
      category: 'service',
      taskCount: 5,
      estimatedDuration: 240,
      isPublic: true,
      icon: Wrench,
      color: 'bg-green-500',
    },
    {
      id: 'customer-onboarding',
      name: 'Customer Onboarding',
      description: 'New customer welcome and setup process',
      category: 'customer_success',
      taskCount: 12,
      estimatedDuration: 720,
      isPublic: true,
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      id: 'sales-proposal',
      name: 'Sales Proposal Workflow',
      description: 'End-to-end proposal creation and approval process',
      category: 'sales',
      taskCount: 7,
      estimatedDuration: 360,
      isPublic: true,
      icon: Target,
      color: 'bg-orange-500',
    },
  ];

  const handleUseTemplate = (template: any) => {
    setSelectedTemplate(template);
    setIsUseTemplateOpen(true);
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      equipment: 'bg-blue-100 text-blue-800',
      service: 'bg-green-100 text-green-800',
      customer_success: 'bg-purple-100 text-purple-800',
      sales: 'bg-orange-100 text-orange-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Project Templates</h3>
          <p className="text-sm text-muted-foreground">
            Create projects quickly with pre-configured task workflows
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {defaultTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${template.color}`}>
                    <template.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={`mt-1 ${getCategoryBadge(template.category)}`}
                    >
                      {template.category.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{template.description}</p>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span>{template.taskCount} tasks</span>
                </div>
                {template.estimatedDuration && (
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{Math.round(template.estimatedDuration / 60)}h</span>
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={() => handleUseTemplate(template)}>
                <Play className="h-4 w-4 mr-2" />
                Use Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State for Custom Templates */}
      {templates.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Custom Templates</h3>
            <p className="text-muted-foreground mb-4">
              Create custom templates from your existing projects to speed up repetitive workflows
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Use Template Dialog */}
      <Dialog open={isUseTemplateOpen} onOpenChange={setIsUseTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project from Template</DialogTitle>
            <DialogDescription>
              Use "{selectedTemplate?.name}" to create a new project
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input placeholder="Enter project name" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea placeholder="Enter project description" rows={3} />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>This template includes:</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc">
                <li>{selectedTemplate?.taskCount} pre-configured tasks</li>
                <li>Task dependencies and sequences</li>
                <li>Estimated timelines and assignments</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUseTemplateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => useTemplateMutation.mutate({})}
              disabled={useTemplateMutation.isPending}
            >
              {useTemplateMutation.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog (TODO) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>Create a reusable project template</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center text-muted-foreground">
            Template creation interface coming soon
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
