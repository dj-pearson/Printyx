import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Settings,
  Copy,
  Trash2,
  Edit,
  Save,
  X,
  GripVertical,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Zap,
  Mail,
  ListTodo,
  Webhook,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PipelineTemplate {
  id: string;
  name: string;
  description?: string;
  pipelineType: 'sales' | 'service' | 'project' | 'custom';
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  stages?: PipelineStage[];
}

interface PipelineStage {
  id?: string;
  pipelineTemplateId?: string;
  name: string;
  displayName: string;
  description?: string;
  order: number;
  color: string;
  icon?: string;
  stageType: 'open' | 'won' | 'lost' | 'inactive';
  isFinalStage: boolean;
  automationTriggers: AutomationTrigger[];
  requiredFields: string[];
  slaEnabled: boolean;
  slaDays?: number;
  defaultProbability: number;
  allowedTransitions: string[];
}

interface AutomationTrigger {
  triggerType: 'on_enter' | 'on_exit' | 'on_sla_breach' | 'on_field_change';
  actionType: 'send_email' | 'create_task' | 'update_field' | 'webhook';
  actionConfig: Record<string, any>;
  isActive: boolean;
}

const STAGE_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#64748b', label: 'Gray' },
];

const STAGE_TYPES = [
  { value: 'open', label: 'Open', icon: AlertCircle },
  { value: 'won', label: 'Won', icon: CheckCircle2 },
  { value: 'lost', label: 'Lost', icon: X },
  { value: 'inactive', label: 'Inactive', icon: Clock },
];

const TRIGGER_TYPES = [
  { value: 'on_enter', label: 'On Enter Stage', icon: ArrowRight },
  { value: 'on_exit', label: 'On Exit Stage', icon: ArrowRight },
  { value: 'on_sla_breach', label: 'On SLA Breach', icon: Clock },
  { value: 'on_field_change', label: 'On Field Change', icon: Edit },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email', icon: Mail },
  { value: 'create_task', label: 'Create Task', icon: ListTodo },
  { value: 'update_field', label: 'Update Field', icon: Edit },
  { value: 'webhook', label: 'Webhook', icon: Webhook },
];

export default function PipelineConfiguration() {
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [showStageDialog, setShowStageDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pipeline templates
  const { data: templates = [], isLoading } = useQuery<PipelineTemplate[]>({
    queryKey: ['/api/pipeline-config/templates'],
  });

  // Fetch selected template with stages
  const { data: templateWithStages } = useQuery<PipelineTemplate>({
    queryKey: [`/api/pipeline-config/templates/${selectedTemplate?.id}`],
    enabled: !!selectedTemplate?.id,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: Partial<PipelineTemplate>) => {
      return apiRequest('/api/pipeline-config/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-config/templates'] });
      setShowCreateDialog(false);
      toast({
        title: 'Pipeline Created',
        description: 'Pipeline template created successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create pipeline template',
        variant: 'destructive',
      });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PipelineTemplate> }) => {
      return apiRequest(`/api/pipeline-config/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-config/templates'] });
      toast({
        title: 'Updated',
        description: 'Pipeline template updated successfully',
      });
    },
  });

  // Clone template mutation
  const cloneTemplateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest(`/api/pipeline-config/templates/${id}/clone`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-config/templates'] });
      setShowCloneDialog(false);
      toast({
        title: 'Cloned',
        description: 'Pipeline template cloned successfully',
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/pipeline-config/templates/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-config/templates'] });
      if (selectedTemplate?.id === deleteTemplateMutation.variables) {
        setSelectedTemplate(null);
      }
      toast({
        title: 'Deleted',
        description: 'Pipeline template deleted successfully',
      });
    },
  });

  // Create/Update stage mutation
  const saveStageMutation = useMutation({
    mutationFn: async (stage: PipelineStage) => {
      if (stage.id) {
        return apiRequest(`/api/pipeline-config/stages/${stage.id}`, {
          method: 'PUT',
          body: JSON.stringify(stage),
        });
      } else {
        return apiRequest('/api/pipeline-config/stages', {
          method: 'POST',
          body: JSON.stringify(stage),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/pipeline-config/templates/${selectedTemplate?.id}`],
      });
      setShowStageDialog(false);
      setEditingStage(null);
      toast({
        title: 'Saved',
        description: 'Stage saved successfully',
      });
    },
  });

  // Reorder stages mutation
  const reorderStagesMutation = useMutation({
    mutationFn: async (stages: { id: string; order: number }[]) => {
      return apiRequest('/api/pipeline-config/stages/reorder', {
        method: 'PUT',
        body: JSON.stringify({ stages }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/pipeline-config/templates/${selectedTemplate?.id}`],
      });
    },
  });

  // Delete stage mutation
  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/pipeline-config/stages/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/pipeline-config/templates/${selectedTemplate?.id}`],
      });
      toast({
        title: 'Deleted',
        description: 'Stage deleted successfully',
      });
    },
  });

  const handleCreateTemplate = () => {
    const defaultStages: PipelineStage[] = [
      {
        name: 'new',
        displayName: 'New',
        order: 0,
        color: '#3b82f6',
        stageType: 'open',
        isFinalStage: false,
        automationTriggers: [],
        requiredFields: [],
        slaEnabled: false,
        defaultProbability: 10,
        allowedTransitions: [],
      },
      {
        name: 'qualified',
        displayName: 'Qualified',
        order: 1,
        color: '#8b5cf6',
        stageType: 'open',
        isFinalStage: false,
        automationTriggers: [],
        requiredFields: [],
        slaEnabled: false,
        defaultProbability: 25,
        allowedTransitions: [],
      },
      {
        name: 'proposal',
        displayName: 'Proposal',
        order: 2,
        color: '#f97316',
        stageType: 'open',
        isFinalStage: false,
        automationTriggers: [],
        requiredFields: [],
        slaEnabled: false,
        defaultProbability: 50,
        allowedTransitions: [],
      },
      {
        name: 'negotiation',
        displayName: 'Negotiation',
        order: 3,
        color: '#eab308',
        stageType: 'open',
        isFinalStage: false,
        automationTriggers: [],
        requiredFields: [],
        slaEnabled: false,
        defaultProbability: 75,
        allowedTransitions: [],
      },
      {
        name: 'closed_won',
        displayName: 'Closed Won',
        order: 4,
        color: '#22c55e',
        stageType: 'won',
        isFinalStage: true,
        automationTriggers: [],
        requiredFields: [],
        slaEnabled: false,
        defaultProbability: 100,
        allowedTransitions: [],
      },
    ];

    createTemplateMutation.mutate({
      name: 'New Sales Pipeline',
      pipelineType: 'sales',
      isDefault: false,
      isActive: true,
      stages: defaultStages,
    } as any);
  };

  const handleToggleDefault = (template: PipelineTemplate) => {
    updateTemplateMutation.mutate({
      id: template.id,
      data: { isDefault: !template.isDefault },
    });
  };

  const handleToggleActive = (template: PipelineTemplate) => {
    updateTemplateMutation.mutate({
      id: template.id,
      data: { isActive: !template.isActive },
    });
  };

  const handleAddStage = () => {
    const newStage: PipelineStage = {
      pipelineTemplateId: selectedTemplate?.id,
      name: '',
      displayName: '',
      order: templateWithStages?.stages?.length || 0,
      color: '#64748b',
      stageType: 'open',
      isFinalStage: false,
      automationTriggers: [],
      requiredFields: [],
      slaEnabled: false,
      defaultProbability: 50,
      allowedTransitions: [],
    };
    setEditingStage(newStage);
    setShowStageDialog(true);
  };

  const handleEditStage = (stage: PipelineStage) => {
    setEditingStage(stage);
    setShowStageDialog(true);
  };

  const getPipelineTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      sales: 'Sales Pipeline',
      service: 'Service Pipeline',
      project: 'Project Pipeline',
      custom: 'Custom Pipeline',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading pipeline configurations...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pipeline Configuration</h1>
            <p className="text-gray-600 mt-1">
              Configure custom sales pipelines with dynamic stages and automation
            </p>
          </div>
          <Button onClick={handleCreateTemplate} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Pipeline
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Templates List */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pipeline Templates</CardTitle>
                <CardDescription>
                  {templates.length} template{templates.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Settings className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No pipelines configured</p>
                    <Button variant="link" onClick={handleCreateTemplate}>
                      Create your first pipeline
                    </Button>
                  </div>
                ) : (
                  templates.map((template) => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedTemplate?.id === template.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{template.name}</h3>
                              {template.isDefault && (
                                <Badge variant="default" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {getPipelineTypeLabel(template.pipelineType)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 mt-2">
                          <Switch
                            checked={template.isActive}
                            onCheckedChange={() => handleToggleActive(template)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-xs text-gray-600">Active</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Template Detail */}
          <div className="lg:col-span-2">
            {selectedTemplate && templateWithStages ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{templateWithStages.name}</CardTitle>
                      <CardDescription>
                        {getPipelineTypeLabel(templateWithStages.pipelineType)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(templateWithStages);
                          setShowCloneDialog(true);
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Clone
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleDefault(templateWithStages)}
                      >
                        {templateWithStages.isDefault ? 'Unset Default' : 'Set as Default'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTemplateMutation.mutate(templateWithStages.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="stages">
                    <TabsList>
                      <TabsTrigger value="stages">Stages</TabsTrigger>
                      <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stages" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Pipeline Stages</h3>
                        <Button size="sm" onClick={handleAddStage}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Stage
                        </Button>
                      </div>

                      {templateWithStages.stages && templateWithStages.stages.length > 0 ? (
                        <div className="space-y-2">
                          {templateWithStages.stages
                            .sort((a, b) => a.order - b.order)
                            .map((stage, index) => (
                              <Card key={stage.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-3">
                                    <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: stage.color }}
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-medium">{stage.displayName}</h4>
                                        <Badge variant="secondary" className="text-xs">
                                          {stage.stageType}
                                        </Badge>
                                        {stage.isFinalStage && (
                                          <Badge variant="outline" className="text-xs">
                                            Final
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                                        <span>Probability: {stage.defaultProbability}%</span>
                                        {stage.slaEnabled && (
                                          <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            SLA: {stage.slaDays} days
                                          </span>
                                        )}
                                        {stage.automationTriggers.length > 0 && (
                                          <span className="flex items-center gap-1">
                                            <Zap className="h-3 w-3" />
                                            {stage.automationTriggers.length} automation
                                            {stage.automationTriggers.length !== 1 ? 's' : ''}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditStage(stage)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          stage.id && deleteStageMutation.mutate(stage.id)
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No stages configured</p>
                          <Button variant="link" onClick={handleAddStage}>
                            Add your first stage
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="analytics" className="mt-4">
                      <div className="text-center py-8 text-gray-500">
                        <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Pipeline analytics coming soon</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center text-gray-500">
                    <Settings className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Select a pipeline template to view and edit</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Stage Edit Dialog */}
        <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStage?.id ? 'Edit Stage' : 'Add New Stage'}</DialogTitle>
              <DialogDescription>
                Configure stage properties, automation triggers, and SLA settings
              </DialogDescription>
            </DialogHeader>

            {editingStage && (
              <StageForm
                stage={editingStage}
                onSave={(stage) => saveStageMutation.mutate(stage)}
                onCancel={() => {
                  setShowStageDialog(false);
                  setEditingStage(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Clone Dialog */}
        <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clone Pipeline Template</DialogTitle>
              <DialogDescription>Create a copy of {selectedTemplate?.name}</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('name') as string;
                if (selectedTemplate) {
                  cloneTemplateMutation.mutate({ id: selectedTemplate.id, name });
                }
              }}
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">New Template Name</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder={`${selectedTemplate?.name} (Copy)`}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCloneDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Clone Pipeline</Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

// Stage Form Component
function StageForm({
  stage,
  onSave,
  onCancel,
}: {
  stage: PipelineStage;
  onSave: (stage: PipelineStage) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<PipelineStage>(stage);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Stage Name (Internal)</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., qualified"
            />
          </div>
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
              placeholder="e.g., Qualified Lead"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="color">Stage Color</Label>
            <Select
              value={formData.color}
              onValueChange={(value) => setFormData({ ...formData, color: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_COLORS.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color.value }}
                      />
                      {color.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="stageType">Stage Type</Label>
            <Select
              value={formData.stageType}
              onValueChange={(value: any) => setFormData({ ...formData, stageType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="defaultProbability">Default Probability (%)</Label>
            <Input
              id="defaultProbability"
              type="number"
              min="0"
              max="100"
              value={formData.defaultProbability}
              onChange={(e) =>
                setFormData({ ...formData, defaultProbability: parseInt(e.target.value) })
              }
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              checked={formData.isFinalStage}
              onCheckedChange={(checked) => setFormData({ ...formData, isFinalStage: checked })}
            />
            <Label>Final Stage</Label>
          </div>
        </div>
      </div>

      <Separator />

      {/* SLA Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.slaEnabled}
            onCheckedChange={(checked) => setFormData({ ...formData, slaEnabled: checked })}
          />
          <Label>Enable SLA Tracking</Label>
        </div>

        {formData.slaEnabled && (
          <div>
            <Label htmlFor="slaDays">SLA Duration (Days)</Label>
            <Input
              id="slaDays"
              type="number"
              min="1"
              value={formData.slaDays || ''}
              onChange={(e) => setFormData({ ...formData, slaDays: parseInt(e.target.value) })}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          Save Stage
        </Button>
      </div>
    </form>
  );
}
