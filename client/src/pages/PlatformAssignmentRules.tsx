import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GitBranch,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Users,
  MapPin,
  Target,
  Settings,
  Activity,
  TrendingUp,
} from 'lucide-react';

interface AssignmentRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  assignmentType: 'territory' | 'user' | 'round_robin' | 'load_balanced';

  // Trigger conditions
  triggerOn: 'create' | 'update' | 'score_change' | 'manual';
  minLeadScore?: number;
  maxLeadScore?: number;
  leadGrades?: string[];
  leadTiers?: string[];
  recordStatuses?: string[];

  // Match criteria
  regions?: string[];
  industries?: string[];
  companySizeMin?: number;
  companySizeMax?: number;
  revenueMin?: string;
  revenueMax?: string;

  // Assignment target
  targetTerritoryId?: string;
  targetTerritoryName?: string;
  targetUserId?: string;
  targetUserName?: string;
  roundRobinPool?: string[];

  // Stats
  totalAssignments?: number;
  lastTriggered?: string;
  avgExecutionTime?: number;

  createdAt: string;
  updatedAt: string;
}

interface RuleFormData {
  name: string;
  description: string;
  isActive: boolean;
  priority: string;
  assignmentType: string;
  triggerOn: string;
  minLeadScore: string;
  maxLeadScore: string;
  leadGrades: string;
  leadTiers: string;
  recordStatuses: string;
  regions: string;
  industries: string;
  companySizeMin: string;
  companySizeMax: string;
  revenueMin: string;
  revenueMax: string;
  targetTerritoryId: string;
  targetUserId: string;
}

const ASSIGNMENT_TYPES = [
  {
    value: 'territory',
    label: 'Territory Assignment',
    description: 'Assign to a specific territory',
  },
  { value: 'user', label: 'User Assignment', description: 'Assign to a specific user' },
  { value: 'round_robin', label: 'Round Robin', description: 'Distribute evenly across users' },
  { value: 'load_balanced', label: 'Load Balanced', description: 'Balance by workload' },
];

const TRIGGER_OPTIONS = [
  { value: 'create', label: 'On Create', description: 'When prospect is created' },
  { value: 'update', label: 'On Update', description: 'When prospect is updated' },
  { value: 'score_change', label: 'On Score Change', description: 'When lead score changes' },
  { value: 'manual', label: 'Manual Only', description: 'Triggered manually' },
];

const LEAD_GRADES = ['A', 'B', 'C', 'D', 'F'];
const LEAD_TIERS = ['hot', 'warm', 'cold'];
const RECORD_STATUSES = ['new', 'qualifying', 'qualified', 'unqualified', 'contacted', 'engaged'];

export default function PlatformAssignmentRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
  const [selectedTab, setSelectedTab] = useState('all');

  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    description: '',
    isActive: true,
    priority: '1',
    assignmentType: 'territory',
    triggerOn: 'create',
    minLeadScore: '',
    maxLeadScore: '',
    leadGrades: '',
    leadTiers: '',
    recordStatuses: '',
    regions: '',
    industries: '',
    companySizeMin: '',
    companySizeMax: '',
    revenueMin: '',
    revenueMax: '',
    targetTerritoryId: '',
    targetUserId: '',
  });

  // Fetch assignment rules
  const { data: rules = [], isLoading } = useQuery<AssignmentRule[]>({
    queryKey: ['/api/platform-crm/assignment-rules'],
  });

  // Fetch territories for assignment
  const { data: territories = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/platform-crm/territories'],
  });

  // Fetch available users for assignment
  const { data: users = [] } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ['/api/platform-crm/managers'],
  });

  // Create rule mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<AssignmentRule>) => {
      const response = await fetch('/api/platform-crm/assignment-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create assignment rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/assignment-rules'] });
      toast({
        title: 'Success',
        description: 'Assignment rule created successfully',
      });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  // Update rule mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AssignmentRule> }) => {
      const response = await fetch(`/api/platform-crm/assignment-rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update assignment rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/assignment-rules'] });
      toast({
        title: 'Success',
        description: 'Assignment rule updated successfully',
      });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  // Delete rule mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/platform-crm/assignment-rules/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete assignment rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/assignment-rules'] });
      toast({
        title: 'Success',
        description: 'Assignment rule deleted successfully',
      });
    },
  });

  // Toggle rule status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/platform-crm/assignment-rules/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error('Failed to toggle rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/assignment-rules'] });
      toast({
        title: 'Success',
        description: 'Rule status updated',
      });
    },
  });

  // Test rule execution
  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/platform-crm/assignment-rules/${id}/test`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to test rule');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Test Complete',
        description: `Rule would match ${data.matchCount} prospect(s)`,
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      isActive: true,
      priority: '1',
      assignmentType: 'territory',
      triggerOn: 'create',
      minLeadScore: '',
      maxLeadScore: '',
      leadGrades: '',
      leadTiers: '',
      recordStatuses: '',
      regions: '',
      industries: '',
      companySizeMin: '',
      companySizeMax: '',
      revenueMin: '',
      revenueMax: '',
      targetTerritoryId: '',
      targetUserId: '',
    });
    setEditingRule(null);
  };

  const handleOpenDialog = (rule?: AssignmentRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        description: rule.description || '',
        isActive: rule.isActive,
        priority: rule.priority.toString(),
        assignmentType: rule.assignmentType,
        triggerOn: rule.triggerOn,
        minLeadScore: rule.minLeadScore?.toString() || '',
        maxLeadScore: rule.maxLeadScore?.toString() || '',
        leadGrades: rule.leadGrades?.join(', ') || '',
        leadTiers: rule.leadTiers?.join(', ') || '',
        recordStatuses: rule.recordStatuses?.join(', ') || '',
        regions: rule.regions?.join(', ') || '',
        industries: rule.industries?.join(', ') || '',
        companySizeMin: rule.companySizeMin?.toString() || '',
        companySizeMax: rule.companySizeMax?.toString() || '',
        revenueMin: rule.revenueMin || '',
        revenueMax: rule.revenueMax || '',
        targetTerritoryId: rule.targetTerritoryId || '',
        targetUserId: rule.targetUserId || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const ruleData: Partial<AssignmentRule> = {
      name: formData.name,
      description: formData.description || undefined,
      isActive: formData.isActive,
      priority: parseInt(formData.priority),
      assignmentType: formData.assignmentType as any,
      triggerOn: formData.triggerOn as any,
      minLeadScore: formData.minLeadScore ? parseInt(formData.minLeadScore) : undefined,
      maxLeadScore: formData.maxLeadScore ? parseInt(formData.maxLeadScore) : undefined,
      leadGrades: formData.leadGrades
        ? formData.leadGrades
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean)
        : undefined,
      leadTiers: formData.leadTiers
        ? formData.leadTiers
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      recordStatuses: formData.recordStatuses
        ? formData.recordStatuses
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      regions: formData.regions
        ? formData.regions
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean)
        : undefined,
      industries: formData.industries
        ? formData.industries
            .split(',')
            .map((i) => i.trim())
            .filter(Boolean)
        : undefined,
      companySizeMin: formData.companySizeMin ? parseInt(formData.companySizeMin) : undefined,
      companySizeMax: formData.companySizeMax ? parseInt(formData.companySizeMax) : undefined,
      revenueMin: formData.revenueMin || undefined,
      revenueMax: formData.revenueMax || undefined,
      targetTerritoryId: formData.targetTerritoryId || undefined,
      targetUserId: formData.targetUserId || undefined,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: ruleData });
    } else {
      createMutation.mutate(ruleData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this assignment rule?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    toggleMutation.mutate({ id, isActive: !currentStatus });
  };

  const handleTest = (id: string) => {
    testMutation.mutate(id);
  };

  // Filter rules
  const filteredRules =
    selectedTab === 'all'
      ? rules
      : rules.filter((rule) => rule.isActive === (selectedTab === 'active'));

  // Calculate stats
  const stats = {
    total: rules.length,
    active: rules.filter((r) => r.isActive).length,
    inactive: rules.filter((r) => !r.isActive).length,
    totalAssignments: rules.reduce((sum, r) => sum + (r.totalAssignments || 0), 0),
    avgExecutionTime:
      rules.length > 0
        ? rules.reduce((sum, r) => sum + (r.avgExecutionTime || 0), 0) / rules.length
        : 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading assignment rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-2">
              <GitBranch className="h-8 w-8 text-primary" />
              Assignment Rules
            </h1>
            <p className="text-muted-foreground mt-2">
              Automate prospect assignment to territories and users
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.total}</span>
              <Settings className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.active} active, {stats.inactive} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.totalAssignments.toLocaleString()}</span>
              <Users className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Execution Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.avgExecutionTime.toFixed(0)}ms</span>
              <Activity className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Per assignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Territories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{territories.length}</span>
              <MapPin className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Assignment targets</p>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Assignment Rules</CardTitle>
          <CardDescription>Configure automated prospect distribution logic</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
              <TabsTrigger value="inactive">Inactive ({stats.inactive})</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No assignment rules found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rule.name}</div>
                            {rule.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {rule.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ASSIGNMENT_TYPES.find((t) => t.value === rule.assignmentType)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {TRIGGER_OPTIONS.find((t) => t.value === rule.triggerOn)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rule.targetTerritoryName && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {rule.targetTerritoryName}
                              </div>
                            )}
                            {rule.targetUserName && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {rule.targetUserName}
                              </div>
                            )}
                            {!rule.targetTerritoryName && !rule.targetUserName && (
                              <span className="text-muted-foreground">Auto</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.priority}</Badge>
                        </TableCell>
                        <TableCell>{rule.totalAssignments?.toLocaleString() || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={() => handleToggle(rule.id, rule.isActive)}
                            />
                            <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                              {rule.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTest(rule.id)}
                              title="Test rule"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(rule)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Assignment Rule' : 'Create New Assignment Rule'}
            </DialogTitle>
            <DialogDescription>Configure automated prospect assignment logic</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-semibold">Basic Information</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Rule Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Enterprise Territory Assignment"
                    required
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignmentType">Assignment Type *</Label>
                  <Select
                    value={formData.assignmentType}
                    onValueChange={(value) => setFormData({ ...formData, assignmentType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div>{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="triggerOn">Trigger *</Label>
                  <Select
                    value={formData.triggerOn}
                    onValueChange={(value) => setFormData({ ...formData, triggerOn: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_OPTIONS.map((trigger) => (
                        <SelectItem key={trigger.value} value={trigger.value}>
                          <div>
                            <div>{trigger.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {trigger.description}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Lower = higher priority</p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
            </div>

            {/* Matching Criteria */}
            <div className="space-y-4">
              <h4 className="font-semibold">Matching Criteria</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minLeadScore">Min Lead Score</Label>
                  <Input
                    id="minLeadScore"
                    type="number"
                    min="0"
                    value={formData.minLeadScore}
                    onChange={(e) => setFormData({ ...formData, minLeadScore: e.target.value })}
                    placeholder="e.g., 50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxLeadScore">Max Lead Score</Label>
                  <Input
                    id="maxLeadScore"
                    type="number"
                    min="0"
                    value={formData.maxLeadScore}
                    onChange={(e) => setFormData({ ...formData, maxLeadScore: e.target.value })}
                    placeholder="e.g., 100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadGrades">Lead Grades (comma-separated)</Label>
                  <Input
                    id="leadGrades"
                    value={formData.leadGrades}
                    onChange={(e) => setFormData({ ...formData, leadGrades: e.target.value })}
                    placeholder="e.g., A, B"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: {LEAD_GRADES.join(', ')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadTiers">Lead Tiers (comma-separated)</Label>
                  <Input
                    id="leadTiers"
                    value={formData.leadTiers}
                    onChange={(e) => setFormData({ ...formData, leadTiers: e.target.value })}
                    placeholder="e.g., hot, warm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: {LEAD_TIERS.join(', ')}
                  </p>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="recordStatuses">Record Statuses (comma-separated)</Label>
                  <Input
                    id="recordStatuses"
                    value={formData.recordStatuses}
                    onChange={(e) => setFormData({ ...formData, recordStatuses: e.target.value })}
                    placeholder="e.g., new, qualifying"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: {RECORD_STATUSES.join(', ')}
                  </p>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="regions">Regions (comma-separated)</Label>
                  <Input
                    id="regions"
                    value={formData.regions}
                    onChange={(e) => setFormData({ ...formData, regions: e.target.value })}
                    placeholder="e.g., North America - East, Europe - West"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="industries">Industries (comma-separated)</Label>
                  <Input
                    id="industries"
                    value={formData.industries}
                    onChange={(e) => setFormData({ ...formData, industries: e.target.value })}
                    placeholder="e.g., Technology, Healthcare"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companySizeMin">Min Company Size</Label>
                  <Input
                    id="companySizeMin"
                    type="number"
                    min="1"
                    value={formData.companySizeMin}
                    onChange={(e) => setFormData({ ...formData, companySizeMin: e.target.value })}
                    placeholder="e.g., 100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companySizeMax">Max Company Size</Label>
                  <Input
                    id="companySizeMax"
                    type="number"
                    min="1"
                    value={formData.companySizeMax}
                    onChange={(e) => setFormData({ ...formData, companySizeMax: e.target.value })}
                    placeholder="e.g., 10000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="revenueMin">Min Annual Revenue</Label>
                  <Input
                    id="revenueMin"
                    value={formData.revenueMin}
                    onChange={(e) => setFormData({ ...formData, revenueMin: e.target.value })}
                    placeholder="e.g., 1000000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="revenueMax">Max Annual Revenue</Label>
                  <Input
                    id="revenueMax"
                    value={formData.revenueMax}
                    onChange={(e) => setFormData({ ...formData, revenueMax: e.target.value })}
                    placeholder="e.g., 100000000"
                  />
                </div>
              </div>
            </div>

            {/* Assignment Target */}
            <div className="space-y-4">
              <h4 className="font-semibold">Assignment Target</h4>

              <div className="grid grid-cols-2 gap-4">
                {formData.assignmentType === 'territory' && (
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="targetTerritoryId">Target Territory</Label>
                    <Select
                      value={formData.targetTerritoryId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, targetTerritoryId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select territory..." />
                      </SelectTrigger>
                      <SelectContent>
                        {territories.map((territory) => (
                          <SelectItem key={territory.id} value={territory.id}>
                            {territory.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.assignmentType === 'user' && (
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="targetUserId">Target User</Label>
                    <Select
                      value={formData.targetUserId}
                      onValueChange={(value) => setFormData({ ...formData, targetUserId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(formData.assignmentType === 'round_robin' ||
                  formData.assignmentType === 'load_balanced') && (
                  <div className="col-span-2 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {formData.assignmentType === 'round_robin'
                        ? 'Prospects will be distributed evenly across all available users in rotation.'
                        : 'Prospects will be assigned based on current workload to balance distribution.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
