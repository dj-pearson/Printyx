import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
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
import { GitBranch, Plus, Edit, Trash2, Play, Users, MapPin, Settings } from 'lucide-react';

// Mirrors platform_lead_assignment_rules (shared/platform-crm-schema.ts), in the
// camelCase the platform-crm function returns. PA-052: the previous shape - name,
// triggerOn, leadGrades, leadTiers, recordStatuses, regions, companySizeMin/Max,
// revenueMin/Max, assignToTerritoryId/Name, roundRobinPool, totalAssignments,
// lastTriggered, avgExecutionTime - matched no column on any table, and the
// endpoints it posted to did not exist on either host.
interface AssignmentRule {
  id: string;
  ruleName: string;
  description?: string | null;
  isActive: boolean;
  priority: number;
  // The column's own vocabulary. 'user' and 'load_balanced' were invented.
  assignmentType: 'territory' | 'round_robin' | 'skill_based' | 'workload_balanced' | 'manual';

  // Matching criteria
  leadSource?: string[] | null;
  leadScoreMin?: number | null;
  leadScoreMax?: number | null;
  industries?: string[] | null;

  // Assignment target
  assignToTerritoryId?: string | null;
  assignToUserId?: string | null;
  roundRobinUsers?: string[] | null;

  // Capacity and timing
  maxLeadsPerRep?: number | null;
  maxLeadsPerDay?: number | null;
  assignImmediately?: boolean | null;
  delayMinutes?: number | null;
  businessHoursOnly?: boolean | null;

  createdAt: string;
  updatedAt: string;
}

interface RuleTestResult {
  matchCount: number;
  criteriaApplied: string[];
  // Criteria the server could not evaluate. A count means less without this.
  unevaluated: string[];
  message: string;
}

interface RuleFormData {
  ruleName: string;
  description: string;
  isActive: boolean;
  priority: string;
  assignmentType: string;
  leadSource: string;
  leadScoreMin: string;
  leadScoreMax: string;
  industries: string;
  assignToTerritoryId: string;
  assignToUserId: string;
  maxLeadsPerRep: string;
  maxLeadsPerDay: string;
  assignImmediately: boolean;
  delayMinutes: string;
  businessHoursOnly: boolean;
}

const ASSIGNMENT_TYPES = [
  {
    value: 'territory',
    label: 'Territory Assignment',
    description: 'Assign to a specific territory',
  },
  { value: 'round_robin', label: 'Round Robin', description: 'Distribute evenly across users' },
  { value: 'skill_based', label: 'Skill Based', description: 'Match on rep skills' },
  { value: 'workload_balanced', label: 'Workload Balanced', description: 'Balance by open load' },
  { value: 'manual', label: 'Manual', description: 'Assigned by hand' },
];

// A trigger vocabulary, lead grades, lead tiers and record statuses were all
// rendered here as filter controls. None of them is a column on
// platform_lead_assignment_rules, so the rules they described could not be
// stored, let alone applied. They are gone rather than defaulted.

const EMPTY_FORM: RuleFormData = {
  ruleName: '',
  description: '',
  isActive: true,
  priority: '1',
  assignmentType: 'territory',
  leadSource: '',
  leadScoreMin: '',
  leadScoreMax: '',
  industries: '',
  assignToTerritoryId: '',
  assignToUserId: '',
  maxLeadsPerRep: '',
  maxLeadsPerDay: '',
  assignImmediately: true,
  delayMinutes: '',
  businessHoursOnly: false,
};

export default function PlatformAssignmentRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
  const [selectedTab, setSelectedTab] = useState('all');

  const [formData, setFormData] = useState<RuleFormData>({ ...EMPTY_FORM });

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
  // PA-052: all five of these were raw fetch(), so they carried no Authorization
  // header and would 401 against the platform-crm edge function even now that it
  // serves them.
  const createMutation = useMutation({
    mutationFn: async (data: Partial<AssignmentRule>) =>
      apiRequest('/api/platform-crm/assignment-rules', { method: 'POST', body: data }),
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<AssignmentRule> }) =>
      apiRequest(`/api/platform-crm/assignment-rules/${id}`, { method: 'PUT', body: data }),
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
    mutationFn: async (id: string) =>
      apiRequest(`/api/platform-crm/assignment-rules/${id}`, { method: 'DELETE' }),
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
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/platform-crm/assignment-rules/${id}/toggle`, {
        method: 'POST',
        body: { isActive },
      }),
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
    mutationFn: async (id: string) =>
      apiRequest(`/api/platform-crm/assignment-rules/${id}/test`, { method: 'POST' }),
    // A match count means less when some of the rule's criteria could not be
    // evaluated, so name those rather than reporting the number alone.
    onSuccess: (data: RuleTestResult) => {
      toast({
        title: 'Test Complete',
        description: data.unevaluated?.length
          ? `${data.message} Not evaluated: ${data.unevaluated.join('; ')}.`
          : data.message,
      });
    },
  });

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingRule(null);
  };

  const handleOpenDialog = (rule?: AssignmentRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        ruleName: rule.ruleName,
        description: rule.description || '',
        isActive: rule.isActive,
        priority: rule.priority?.toString() ?? '0',
        assignmentType: rule.assignmentType,
        leadSource: rule.leadSource?.join(', ') || '',
        leadScoreMin: rule.leadScoreMin?.toString() || '',
        leadScoreMax: rule.leadScoreMax?.toString() || '',
        industries: rule.industries?.join(', ') || '',
        assignToTerritoryId: rule.assignToTerritoryId || '',
        assignToUserId: rule.assignToUserId || '',
        maxLeadsPerRep: rule.maxLeadsPerRep?.toString() || '',
        maxLeadsPerDay: rule.maxLeadsPerDay?.toString() || '',
        assignImmediately: rule.assignImmediately ?? true,
        delayMinutes: rule.delayMinutes?.toString() || '',
        businessHoursOnly: rule.businessHoursOnly ?? false,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const list = (value: string) =>
      value
        ? value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : [];
    const num = (value: string) => (value ? parseInt(value, 10) : undefined);

    const ruleData: Partial<AssignmentRule> = {
      ruleName: formData.ruleName,
      description: formData.description || undefined,
      isActive: formData.isActive,
      priority: parseInt(formData.priority, 10) || 0,
      assignmentType: formData.assignmentType as AssignmentRule['assignmentType'],
      leadSource: list(formData.leadSource),
      leadScoreMin: num(formData.leadScoreMin),
      leadScoreMax: num(formData.leadScoreMax),
      industries: list(formData.industries),
      assignToTerritoryId: formData.assignToTerritoryId || undefined,
      assignToUserId: formData.assignToUserId || undefined,
      maxLeadsPerRep: num(formData.maxLeadsPerRep),
      maxLeadsPerDay: num(formData.maxLeadsPerDay),
      assignImmediately: formData.assignImmediately,
      delayMinutes: num(formData.delayMinutes) ?? 0,
      businessHoursOnly: formData.businessHoursOnly,
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

  // /territories and /managers are still unserved on both hosts (PA-052 covers
  // assignment-rules only), so these resolve to [] and a target falls back to
  // its id rather than rendering blank.
  const territoryName = (id: string) => territories.find((t) => t.id === id)?.name ?? id;
  const managerName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  // Calculate stats
  // totalAssignments and avgExecutionTime were summed here off fields no table
  // records. platform_lead_assignment_history could back a real assignment count
  // per rule, but that needs a server-side aggregate this endpoint does not do
  // yet, and zeroes would read as "no rule has ever fired".
  const stats = {
    total: rules.length,
    active: rules.filter((r) => r.isActive).length,
    inactive: rules.filter((r) => !r.isActive).length,
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

        {/* "Total Assignments" and "Avg Execution Time" cards stood here, summed
            from fields no table records. platform_lead_assignment_history could
            back the first once the endpoint aggregates it; nothing measures the
            second at all. */}

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
                            <div className="font-medium">{rule.ruleName}</div>
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
                          <div className="text-sm">
                            {rule.assignToTerritoryId && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {territoryName(rule.assignToTerritoryId)}
                              </div>
                            )}
                            {rule.assignToUserId && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {managerName(rule.assignToUserId)}
                              </div>
                            )}
                            {!rule.assignToTerritoryId && !rule.assignToUserId && (
                              <span className="text-muted-foreground">Auto</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.priority}</Badge>
                        </TableCell>
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
                  <Label htmlFor="ruleName">Rule Name *</Label>
                  <Input
                    id="ruleName"
                    value={formData.ruleName}
                    onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
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
                  <Label htmlFor="leadScoreMin">Min Lead Score</Label>
                  <Input
                    id="leadScoreMin"
                    type="number"
                    min="0"
                    value={formData.leadScoreMin}
                    onChange={(e) => setFormData({ ...formData, leadScoreMin: e.target.value })}
                    placeholder="e.g., 50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadScoreMax">Max Lead Score</Label>
                  <Input
                    id="leadScoreMax"
                    type="number"
                    min="0"
                    value={formData.leadScoreMax}
                    onChange={(e) => setFormData({ ...formData, leadScoreMax: e.target.value })}
                    placeholder="e.g., 100"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="leadSource">Lead Sources (comma-separated)</Label>
                  <Input
                    id="leadSource"
                    value={formData.leadSource}
                    onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                    placeholder="e.g., website, referral, outbound"
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

                {/* Lead grades, lead tiers, record statuses, regions, company
                    size and annual revenue were fields here. None is a column on
                    platform_lead_assignment_rules, so a rule built on them could
                    not be stored, let alone applied. Company size and geography
                    ARE on the table, but as free-form jsonb with no matching
                    column on platform_business_records to test against - the
                    rule test reports them under `unevaluated` for that reason. */}
              </div>
            </div>

            {/* Assignment Target */}
            <div className="space-y-4">
              <h4 className="font-semibold">Assignment Target</h4>

              <div className="grid grid-cols-2 gap-4">
                {formData.assignmentType === 'territory' && (
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="assignToTerritoryId">Target Territory</Label>
                    <Select
                      value={formData.assignToTerritoryId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, assignToTerritoryId: value })
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
                    <Label htmlFor="assignToUserId">Target User</Label>
                    <Select
                      value={formData.assignToUserId}
                      onValueChange={(value) => setFormData({ ...formData, assignToUserId: value })}
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
