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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Target,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  Building2,
  Sparkles,
  Activity,
} from 'lucide-react';

// Mirrors platform_lead_scoring_rules (shared/platform-crm-schema.ts) in the
// camelCase the platform-crm function returns. PA-052: the previous shape used
// name/criteriaField/criteriaValue/scorePoints, none of which is a column.
interface ScoringRule {
  id: string;
  ruleName: string;
  description?: string | null;
  category: 'demographic' | 'firmographic' | 'behavioral' | 'engagement' | 'bant';
  fieldName: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in_list';
  value: unknown;
  points: number;
  maxPoints?: number | null;
  priority: number;
  weight?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// A ScoringModel interface stood here - grade thresholds A/B/C/D, tier
// thresholds hot/warm/cold, isDefault, maxPossibleScore - against a
// scoring-models endpoint and a table that exist nowhere. Grades and tiers are
// pgEnums on platform_business_records; nothing stores a threshold that maps a
// score onto one, so the whole model concept is gone rather than mocked. It also
// GATED this page: the rules query was `enabled: !!selectedModelId` and a model
// id could never be set, so the rule list never fetched at all.

interface RuleFormData {
  ruleName: string;
  description: string;
  category: string;
  fieldName: string;
  operator: string;
  value: string;
  points: string;
  maxPoints: string;
  isActive: boolean;
  priority: string;
}

const CATEGORIES = {
  firmographic: {
    label: 'Firmographic',
    description: 'Company characteristics',
    fields: [
      { value: 'companySize', label: 'Company Size' },
      { value: 'annualRevenue', label: 'Annual Revenue' },
      { value: 'industry', label: 'Industry' },
      { value: 'region', label: 'Region' },
      { value: 'yearsInBusiness', label: 'Years in Business' },
    ],
  },
  behavioral: {
    label: 'Behavioral',
    description: 'User actions and engagement',
    fields: [
      { value: 'websiteVisits', label: 'Website Visits' },
      { value: 'pagesViewed', label: 'Pages Viewed' },
      { value: 'formSubmissions', label: 'Form Submissions' },
      { value: 'contentDownloads', label: 'Content Downloads' },
      { value: 'emailOpens', label: 'Email Opens' },
      { value: 'emailClicks', label: 'Email Clicks' },
    ],
  },
  engagement: {
    label: 'Engagement',
    description: 'Interaction with your brand',
    fields: [
      { value: 'lastActivityDate', label: 'Last Activity Date' },
      { value: 'totalTouchpoints', label: 'Total Touchpoints' },
      { value: 'meetingsScheduled', label: 'Meetings Scheduled' },
      { value: 'demosRequested', label: 'Demos Requested' },
      { value: 'quotesRequested', label: 'Quotes Requested' },
    ],
  },
  demographic: {
    label: 'Demographic',
    description: 'Contact information',
    fields: [
      { value: 'jobTitle', label: 'Job Title' },
      { value: 'jobLevel', label: 'Job Level' },
      { value: 'department', label: 'Department' },
      { value: 'decisionMaker', label: 'Decision Maker' },
    ],
  },
  bant: {
    label: 'BANT',
    description: 'Budget, authority, need, timeline',
    fields: [
      { value: 'budgetIdentified', label: 'Budget Identified' },
      { value: 'decisionMakerIdentified', label: 'Decision Maker Identified' },
      { value: 'needIdentified', label: 'Need Identified' },
      { value: 'decisionTimeline', label: 'Decision Timeline' },
    ],
  },
  // A 'technographic' category stood here. The column's vocabulary is
  // demographic | firmographic | behavioral | engagement | bant, so a rule saved
  // under it would never be read by any scorer.
};

// The column's own operator vocabulary. camelCase greaterThan/lessThan and a
// 'between' that the table cannot express were all invented.
const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'in_list', label: 'In List' },
];

const EMPTY_RULE_FORM: RuleFormData = {
  ruleName: '',
  description: '',
  category: 'firmographic',
  fieldName: '',
  operator: 'equals',
  value: '',
  points: '10',
  maxPoints: '',
  isActive: true,
  priority: '1',
};

export default function PlatformLeadScoring() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [ruleFormData, setRuleFormData] = useState<RuleFormData>({ ...EMPTY_RULE_FORM });

  // PA-052: the rules query key used to be
  // ['/api/platform-crm/scoring-rules', selectedModelId], and getQueryFn joins a
  // query key with '/', so it requested /scoring-rules/<modelId> - a single-rule
  // lookup by a model id. It never ran anyway, being gated on a model id nothing
  // could set. Only path segments belong in a query key.
  const { data: rules = [], isLoading: rulesLoading } = useQuery<ScoringRule[]>({
    queryKey: ['/api/platform-crm/scoring-rules'],
  });

  // Create rule mutation
  // PA-052: raw fetch() carries no Authorization header and would 401 against
  // the platform-crm edge function that now serves these.
  const createRuleMutation = useMutation({
    mutationFn: async (data: Partial<ScoringRule>) =>
      apiRequest('/api/platform-crm/scoring-rules', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/scoring-rules'] });
      toast({
        title: 'Success',
        description: 'Scoring rule created successfully',
      });
      setIsRuleDialogOpen(false);
      resetRuleForm();
    },
  });

  // Update rule mutation
  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ScoringRule> }) =>
      apiRequest(`/api/platform-crm/scoring-rules/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/scoring-rules'] });
      toast({
        title: 'Success',
        description: 'Scoring rule updated successfully',
      });
      setIsRuleDialogOpen(false);
      resetRuleForm();
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/api/platform-crm/scoring-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/scoring-rules'] });
      toast({
        title: 'Success',
        description: 'Scoring rule deleted successfully',
      });
    },
  });

  const resetRuleForm = () => {
    setRuleFormData({ ...EMPTY_RULE_FORM });
    setEditingRule(null);
  };

  const handleOpenRuleDialog = (rule?: ScoringRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleFormData({
        ruleName: rule.ruleName,
        description: rule.description || '',
        category: rule.category,
        fieldName: rule.fieldName,
        operator: rule.operator,
        // `value` is jsonb; the form edits it as text and the submit re-parses.
        value: typeof rule.value === 'string' ? rule.value : JSON.stringify(rule.value ?? ''),
        points: rule.points?.toString() ?? '0',
        maxPoints: rule.maxPoints?.toString() ?? '',
        isActive: rule.isActive,
        priority: rule.priority?.toString() ?? '0',
      });
    } else {
      resetRuleForm();
    }
    setIsRuleDialogOpen(true);
  };

  const handleSubmitRule = (e: React.FormEvent) => {
    e.preventDefault();

    // `value` is a jsonb column, so a number or a JSON list is stored as such
    // and anything else as the string the user typed.
    let parsedValue: unknown = ruleFormData.value;
    try {
      parsedValue = JSON.parse(ruleFormData.value);
    } catch {
      parsedValue = ruleFormData.value;
    }

    const ruleData: Partial<ScoringRule> = {
      ruleName: ruleFormData.ruleName,
      description: ruleFormData.description || undefined,
      category: ruleFormData.category as ScoringRule['category'],
      fieldName: ruleFormData.fieldName,
      operator: ruleFormData.operator as ScoringRule['operator'],
      value: parsedValue,
      points: parseInt(ruleFormData.points, 10) || 0,
      maxPoints: ruleFormData.maxPoints ? parseInt(ruleFormData.maxPoints, 10) : undefined,
      isActive: ruleFormData.isActive,
      priority: parseInt(ruleFormData.priority, 10) || 0,
    };

    if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, data: ruleData });
    } else {
      createRuleMutation.mutate(ruleData);
    }
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('Are you sure you want to delete this scoring rule?')) {
      deleteRuleMutation.mutate(id);
    }
  };

  // Filter rules by category
  const filteredRules =
    selectedCategory === 'all' ? rules : rules.filter((rule) => rule.category === selectedCategory);

  // Calculate stats
  const stats = {
    totalRules: rules.length,
    activeRules: rules.filter((r) => r.isActive).length,
    inactiveRules: rules.filter((r) => !r.isActive).length,
    // maxPoints caps what a rule can contribute, so the ceiling uses it where
    // it is set rather than summing raw points past the cap.
    maxScore: rules.reduce((sum, r) => sum + (r.isActive ? (r.maxPoints ?? r.points ?? 0) : 0), 0),
    avgPointsPerRule:
      rules.length > 0 ? rules.reduce((sum, r) => sum + (r.points ?? 0), 0) / rules.length : 0,
  };

  if (rulesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading scoring rules...</p>
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
              <Target className="h-8 w-8 text-primary" />
              Lead Scoring Rules
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure the criteria that award points to a lead score
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => handleOpenRuleDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </div>
        </div>
      </div>

      {/* A "Scoring Model" selector card stood here - a model dropdown, grade
          thresholds A/B/C/D, tier thresholds hot/warm/cold and model stats. No
          scoring-models table or endpoint exists on either host, so none of it
          could be stored, and the empty dropdown gated the rule list below it:
          the query was `enabled: !!selectedModelId`. Grades and tiers are pgEnums
          on platform_business_records; nothing maps a score onto one. */}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.totalRules}</span>
              <Activity className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.activeRules} active, {stats.inactiveRules} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Max Possible Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.maxScore}</span>
              <TrendingUp className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">From active rules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Points/Rule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.avgPointsPerRule.toFixed(0)}</span>
              <Sparkles className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Average scoring weight</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rule Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{Object.keys(CATEGORIES).length}</span>
              <Building2 className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Available categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scoring Rules</CardTitle>
          <CardDescription>Configure criteria and point values for lead scoring</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({stats.totalRules})</TabsTrigger>
              {Object.entries(CATEGORIES).map(([key, config]) => {
                const count = rules.filter((r) => r.category === key).length;
                return (
                  <TabsTrigger key={key} value={key}>
                    {config.label} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={selectedCategory}>
              {rulesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">Loading rules...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Criteria</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No scoring rules found. Create your first rule to get started.
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
                              {CATEGORIES[rule.category as keyof typeof CATEGORIES]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="font-medium">{rule.fieldName}</span>{' '}
                              {OPERATORS.find((o) => o.value === rule.operator)?.label ??
                                rule.operator}{' '}
                              <span className="text-muted-foreground">
                                {typeof rule.value === 'string'
                                  ? rule.value
                                  : JSON.stringify(rule.value)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-primary">
                              {rule.points >= 0 ? `+${rule.points}` : rule.points}
                              {rule.maxPoints != null && (
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                  (max {rule.maxPoints})
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{rule.priority}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                              {rule.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenRuleDialog(rule)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteRule(rule.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {/* Rule Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Scoring Rule' : 'Create New Scoring Rule'}
            </DialogTitle>
            <DialogDescription>Define criteria and point values for lead scoring</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRule} className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Rule Name *</Label>
                  <Input
                    id="name"
                    value={ruleFormData.ruleName}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, ruleName: e.target.value })}
                    placeholder="e.g., Enterprise Company Size"
                    required
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={ruleFormData.description}
                    onChange={(e) =>
                      setRuleFormData({ ...ruleFormData, description: e.target.value })
                    }
                    placeholder="Brief description of this rule..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={ruleFormData.category}
                    onValueChange={(value) =>
                      setRuleFormData({ ...ruleFormData, category: value, fieldName: '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIES).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="criteriaField">Field *</Label>
                  <Select
                    value={ruleFormData.fieldName}
                    onValueChange={(value) =>
                      setRuleFormData({ ...ruleFormData, fieldName: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES[ruleFormData.category as keyof typeof CATEGORIES]?.fields.map(
                        (field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="operator">Operator *</Label>
                  <Select
                    value={ruleFormData.operator}
                    onValueChange={(value) => setRuleFormData({ ...ruleFormData, operator: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="criteriaValue">Value *</Label>
                  <Input
                    id="criteriaValue"
                    value={ruleFormData.value}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, value: e.target.value })}
                    placeholder="e.g., 1000 or Enterprise"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scorePoints">Points *</Label>
                  <Input
                    id="scorePoints"
                    type="number"
                    min="0"
                    value={ruleFormData.points}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, points: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    value={ruleFormData.priority}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, priority: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Lower = higher priority</p>
                </div>

                <div className="flex items-center space-x-2 col-span-2">
                  <Switch
                    id="isActive"
                    checked={ruleFormData.isActive}
                    onCheckedChange={(checked) =>
                      setRuleFormData({ ...ruleFormData, isActive: checked })
                    }
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRuleDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
              >
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* A model dialog stood here - name, description, default flag, and
          grade A/B/C/D plus tier hot/warm/cold thresholds. Nothing stores
          any of it; see the note where the selector card was. */}
    </div>
  );
}
