import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Target,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  Users,
  Building2,
  Sparkles,
  Activity,
  AlertCircle,
} from "lucide-react";

interface ScoringRule {
  id: string;
  name: string;
  description?: string;
  category: 'firmographic' | 'behavioral' | 'engagement' | 'demographic' | 'technographic';
  criteriaField: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between' | 'in';
  criteriaValue: string;
  scorePoints: number;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface ScoringModel {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  totalRules: number;
  maxPossibleScore: number;
  gradeThresholds: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
  tierThresholds: {
    hot: number;
    warm: number;
    cold: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface RuleFormData {
  name: string;
  description: string;
  category: string;
  criteriaField: string;
  operator: string;
  criteriaValue: string;
  scorePoints: string;
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
  technographic: {
    label: 'Technographic',
    description: 'Technology stack',
    fields: [
      { value: 'currentPrintSolution', label: 'Current Print Solution' },
      { value: 'techStack', label: 'Technology Stack' },
      { value: 'integrationNeeds', label: 'Integration Needs' },
    ],
  },
};

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'In List' },
];

export default function PlatformLeadScoring() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [editingModel, setEditingModel] = useState<ScoringModel | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  const [ruleFormData, setRuleFormData] = useState<RuleFormData>({
    name: '',
    description: '',
    category: 'firmographic',
    criteriaField: '',
    operator: 'equals',
    criteriaValue: '',
    scorePoints: '10',
    isActive: true,
    priority: '1',
  });

  const [modelFormData, setModelFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    isDefault: false,
    gradeA: '80',
    gradeB: '60',
    gradeC: '40',
    gradeD: '20',
    tierHot: '70',
    tierWarm: '40',
    tierCold: '0',
  });

  // Fetch scoring models
  const { data: models = [], isLoading: modelsLoading } = useQuery<ScoringModel[]>({
    queryKey: ['/api/platform-crm/scoring-models'],
  });

  // Fetch scoring rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery<ScoringRule[]>({
    queryKey: ['/api/platform-crm/scoring-rules', selectedModelId],
    enabled: !!selectedModelId,
  });

  // Create rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async (data: Partial<ScoringRule>) => {
      const response = await fetch('/api/platform-crm/scoring-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, modelId: selectedModelId }),
      });
      if (!response.ok) throw new Error('Failed to create scoring rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/scoring-rules'] });
      toast({
        title: "Success",
        description: "Scoring rule created successfully",
      });
      setIsRuleDialogOpen(false);
      resetRuleForm();
    },
  });

  // Update rule mutation
  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ScoringRule> }) => {
      const response = await fetch(`/api/platform-crm/scoring-rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update scoring rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/scoring-rules'] });
      toast({
        title: "Success",
        description: "Scoring rule updated successfully",
      });
      setIsRuleDialogOpen(false);
      resetRuleForm();
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/platform-crm/scoring-rules/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete scoring rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/scoring-rules'] });
      toast({
        title: "Success",
        description: "Scoring rule deleted successfully",
      });
    },
  });

  // Create/Update model mutation
  const saveModelMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingModel
        ? `/api/platform-crm/scoring-models/${editingModel.id}`
        : '/api/platform-crm/scoring-models';
      const method = editingModel ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save scoring model');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/scoring-models'] });
      toast({
        title: "Success",
        description: `Scoring model ${editingModel ? 'updated' : 'created'} successfully`,
      });
      setIsModelDialogOpen(false);
      resetModelForm();
    },
  });

  const resetRuleForm = () => {
    setRuleFormData({
      name: '',
      description: '',
      category: 'firmographic',
      criteriaField: '',
      operator: 'equals',
      criteriaValue: '',
      scorePoints: '10',
      isActive: true,
      priority: '1',
    });
    setEditingRule(null);
  };

  const resetModelForm = () => {
    setModelFormData({
      name: '',
      description: '',
      isActive: true,
      isDefault: false,
      gradeA: '80',
      gradeB: '60',
      gradeC: '40',
      gradeD: '20',
      tierHot: '70',
      tierWarm: '40',
      tierCold: '0',
    });
    setEditingModel(null);
  };

  const handleOpenRuleDialog = (rule?: ScoringRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleFormData({
        name: rule.name,
        description: rule.description || '',
        category: rule.category,
        criteriaField: rule.criteriaField,
        operator: rule.operator,
        criteriaValue: rule.criteriaValue,
        scorePoints: rule.scorePoints.toString(),
        isActive: rule.isActive,
        priority: rule.priority.toString(),
      });
    } else {
      resetRuleForm();
    }
    setIsRuleDialogOpen(true);
  };

  const handleOpenModelDialog = (model?: ScoringModel) => {
    if (model) {
      setEditingModel(model);
      setModelFormData({
        name: model.name,
        description: model.description || '',
        isActive: model.isActive,
        isDefault: model.isDefault,
        gradeA: model.gradeThresholds.A.toString(),
        gradeB: model.gradeThresholds.B.toString(),
        gradeC: model.gradeThresholds.C.toString(),
        gradeD: model.gradeThresholds.D.toString(),
        tierHot: model.tierThresholds.hot.toString(),
        tierWarm: model.tierThresholds.warm.toString(),
        tierCold: model.tierThresholds.cold.toString(),
      });
    } else {
      resetModelForm();
    }
    setIsModelDialogOpen(true);
  };

  const handleSubmitRule = (e: React.FormEvent) => {
    e.preventDefault();

    const ruleData: Partial<ScoringRule> = {
      name: ruleFormData.name,
      description: ruleFormData.description || undefined,
      category: ruleFormData.category as any,
      criteriaField: ruleFormData.criteriaField,
      operator: ruleFormData.operator as any,
      criteriaValue: ruleFormData.criteriaValue,
      scorePoints: parseInt(ruleFormData.scorePoints),
      isActive: ruleFormData.isActive,
      priority: parseInt(ruleFormData.priority),
    };

    if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, data: ruleData });
    } else {
      createRuleMutation.mutate(ruleData);
    }
  };

  const handleSubmitModel = (e: React.FormEvent) => {
    e.preventDefault();

    const modelData = {
      name: modelFormData.name,
      description: modelFormData.description || undefined,
      isActive: modelFormData.isActive,
      isDefault: modelFormData.isDefault,
      gradeThresholds: {
        A: parseInt(modelFormData.gradeA),
        B: parseInt(modelFormData.gradeB),
        C: parseInt(modelFormData.gradeC),
        D: parseInt(modelFormData.gradeD),
      },
      tierThresholds: {
        hot: parseInt(modelFormData.tierHot),
        warm: parseInt(modelFormData.tierWarm),
        cold: parseInt(modelFormData.tierCold),
      },
    };

    saveModelMutation.mutate(modelData);
  };

  const handleDeleteRule = (id: string) => {
    if (confirm('Are you sure you want to delete this scoring rule?')) {
      deleteRuleMutation.mutate(id);
    }
  };

  // Filter rules by category
  const filteredRules = selectedCategory === 'all'
    ? rules
    : rules.filter(rule => rule.category === selectedCategory);

  // Calculate stats
  const stats = {
    totalRules: rules.length,
    activeRules: rules.filter(r => r.isActive).length,
    inactiveRules: rules.filter(r => !r.isActive).length,
    maxScore: rules.reduce((sum, r) => sum + (r.isActive ? r.scorePoints : 0), 0),
    avgPointsPerRule: rules.length > 0
      ? rules.reduce((sum, r) => sum + r.scorePoints, 0) / rules.length
      : 0,
  };

  // Get current model
  const currentModel = models.find(m => m.id === selectedModelId) || models.find(m => m.isDefault);

  if (modelsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading scoring models...</p>
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
              Configure automated lead scoring criteria and grading thresholds
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleOpenModelDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              New Model
            </Button>
            <Button onClick={() => handleOpenRuleDialog()} disabled={!selectedModelId}>
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </div>
        </div>
      </div>

      {/* Model Selector */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scoring Model</CardTitle>
              <CardDescription>Select a scoring model to configure rules</CardDescription>
            </div>
            {currentModel && (
              <Button variant="ghost" size="sm" onClick={() => handleOpenModelDialog(currentModel)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Model
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Select value={selectedModelId} onValueChange={setSelectedModelId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a scoring model..." />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span>{model.name}</span>
                    {model.isDefault && (
                      <Badge variant="secondary" className="ml-2">Default</Badge>
                    )}
                    {model.isActive && (
                      <Badge variant="outline" className="ml-2">Active</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentModel && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm font-medium text-muted-foreground mb-2">Grade Thresholds</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Grade A:</span>
                    <span className="font-medium">{currentModel.gradeThresholds.A}+</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Grade B:</span>
                    <span className="font-medium">{currentModel.gradeThresholds.B}+</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Grade C:</span>
                    <span className="font-medium">{currentModel.gradeThresholds.C}+</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Grade D:</span>
                    <span className="font-medium">{currentModel.gradeThresholds.D}+</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm font-medium text-muted-foreground mb-2">Tier Thresholds</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Hot:</span>
                    <span className="font-medium">{currentModel.tierThresholds.hot}+</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Warm:</span>
                    <span className="font-medium">{currentModel.tierThresholds.warm}+</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cold:</span>
                    <span className="font-medium">{currentModel.tierThresholds.cold}+</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm font-medium text-muted-foreground mb-2">Model Stats</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total Rules:</span>
                    <span className="font-medium">{currentModel.totalRules}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Score:</span>
                    <span className="font-medium">{currentModel.maxPossibleScore}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedModelId ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Rules
                </CardTitle>
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
                <p className="text-sm text-muted-foreground mt-1">
                  From active rules
                </p>
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
                <p className="text-sm text-muted-foreground mt-1">
                  Average scoring weight
                </p>
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
                <p className="text-sm text-muted-foreground mt-1">
                  Available categories
                </p>
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
                    const count = rules.filter(r => r.category === key).length;
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
                                  {CATEGORIES[rule.category as keyof typeof CATEGORIES]?.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <span className="font-medium">{rule.criteriaField}</span>
                                  {' '}{rule.operator}{' '}
                                  <span className="text-muted-foreground">{rule.criteriaValue}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-bold text-primary">+{rule.scorePoints}</span>
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
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Scoring Model Selected</h3>
              <p className="text-muted-foreground mb-4">
                Select a scoring model above to view and manage rules, or create a new model.
              </p>
              <Button onClick={() => handleOpenModelDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Scoring Model
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rule Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Scoring Rule' : 'Create New Scoring Rule'}
            </DialogTitle>
            <DialogDescription>
              Define criteria and point values for lead scoring
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRule} className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Rule Name *</Label>
                  <Input
                    id="name"
                    value={ruleFormData.name}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                    placeholder="e.g., Enterprise Company Size"
                    required
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={ruleFormData.description}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                    placeholder="Brief description of this rule..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={ruleFormData.category}
                    onValueChange={(value) => setRuleFormData({ ...ruleFormData, category: value, criteriaField: '' })}
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
                    value={ruleFormData.criteriaField}
                    onValueChange={(value) => setRuleFormData({ ...ruleFormData, criteriaField: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES[ruleFormData.category as keyof typeof CATEGORIES]?.fields.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
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
                    value={ruleFormData.criteriaValue}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, criteriaValue: e.target.value })}
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
                    value={ruleFormData.scorePoints}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, scorePoints: e.target.value })}
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
                    onCheckedChange={(checked) => setRuleFormData({ ...ruleFormData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRuleDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRuleMutation.isPending || updateRuleMutation.isPending}>
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Model Dialog */}
      <Dialog open={isModelDialogOpen} onOpenChange={setIsModelDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingModel ? 'Edit Scoring Model' : 'Create New Scoring Model'}
            </DialogTitle>
            <DialogDescription>
              Configure scoring model and threshold settings
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitModel} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modelName">Model Name *</Label>
                <Input
                  id="modelName"
                  value={modelFormData.name}
                  onChange={(e) => setModelFormData({ ...modelFormData, name: e.target.value })}
                  placeholder="e.g., Default Scoring Model"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modelDescription">Description</Label>
                <Textarea
                  id="modelDescription"
                  value={modelFormData.description}
                  onChange={(e) => setModelFormData({ ...modelFormData, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="modelActive"
                    checked={modelFormData.isActive}
                    onCheckedChange={(checked) => setModelFormData({ ...modelFormData, isActive: checked })}
                  />
                  <Label htmlFor="modelActive">Active</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="modelDefault"
                    checked={modelFormData.isDefault}
                    onCheckedChange={(checked) => setModelFormData({ ...modelFormData, isDefault: checked })}
                  />
                  <Label htmlFor="modelDefault">Default Model</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Grade Thresholds</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gradeA">Grade A (min score)</Label>
                    <Input
                      id="gradeA"
                      type="number"
                      min="0"
                      value={modelFormData.gradeA}
                      onChange={(e) => setModelFormData({ ...modelFormData, gradeA: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gradeB">Grade B (min score)</Label>
                    <Input
                      id="gradeB"
                      type="number"
                      min="0"
                      value={modelFormData.gradeB}
                      onChange={(e) => setModelFormData({ ...modelFormData, gradeB: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gradeC">Grade C (min score)</Label>
                    <Input
                      id="gradeC"
                      type="number"
                      min="0"
                      value={modelFormData.gradeC}
                      onChange={(e) => setModelFormData({ ...modelFormData, gradeC: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gradeD">Grade D (min score)</Label>
                    <Input
                      id="gradeD"
                      type="number"
                      min="0"
                      value={modelFormData.gradeD}
                      onChange={(e) => setModelFormData({ ...modelFormData, gradeD: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Tier Thresholds</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tierHot">Hot (min score)</Label>
                    <Input
                      id="tierHot"
                      type="number"
                      min="0"
                      value={modelFormData.tierHot}
                      onChange={(e) => setModelFormData({ ...modelFormData, tierHot: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tierWarm">Warm (min score)</Label>
                    <Input
                      id="tierWarm"
                      type="number"
                      min="0"
                      value={modelFormData.tierWarm}
                      onChange={(e) => setModelFormData({ ...modelFormData, tierWarm: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tierCold">Cold (min score)</Label>
                    <Input
                      id="tierCold"
                      type="number"
                      min="0"
                      value={modelFormData.tierCold}
                      onChange={(e) => setModelFormData({ ...modelFormData, tierCold: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModelDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveModelMutation.isPending}>
                {editingModel ? 'Update Model' : 'Create Model'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
