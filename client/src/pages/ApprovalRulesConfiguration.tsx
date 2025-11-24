import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/main-layout";
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Target,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ApprovalRule {
  id: string;
  ruleName: string;
  description?: string;
  ruleType: string;
  thresholdType: string;
  thresholdValue: string;
  comparisonOperator: string;
  approvalChainType: string;
  approvers: Array<{
    level: number;
    roleId?: string;
    roleName?: string;
    userId?: string;
    userName?: string;
    isRequired: boolean;
    canDelegate: boolean;
  }>;
  slaHours: number;
  escalationEnabled: boolean;
  priority: number;
  isActive: boolean;
}

export default function ApprovalRulesConfiguration() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState<Partial<ApprovalRule>>({
    ruleName: "",
    description: "",
    ruleType: "discount",
    thresholdType: "discount_percentage",
    thresholdValue: "10",
    comparisonOperator: ">",
    approvalChainType: "sequential",
    approvers: [{ level: 1, isRequired: true, canDelegate: false }],
    slaHours: 24,
    escalationEnabled: true,
    priority: 0,
    isActive: true,
  });

  // Fetch rules
  const { data: rules = [], isLoading } = useQuery<ApprovalRule[]>({
    queryKey: ['/api/deal-desk/rules'],
  });

  // Create/Update rule mutation
  const saveMutation = useMutation({
    mutationFn: async (ruleData: Partial<ApprovalRule>) => {
      if (editingRule) {
        return apiRequest(`/api/deal-desk/rules/${editingRule.id}`, {
          method: 'PUT',
          body: JSON.stringify(ruleData),
        });
      } else {
        return apiRequest('/api/deal-desk/rules', {
          method: 'POST',
          body: JSON.stringify(ruleData),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deal-desk/rules'] });
      setIsCreateDialogOpen(false);
      setEditingRule(null);
      resetForm();
      toast({
        title: editingRule ? "Rule Updated" : "Rule Created",
        description: "Approval rule has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save rule",
        variant: "destructive",
      });
    },
  });

  // Delete rule mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/deal-desk/rules/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deal-desk/rules'] });
      toast({
        title: "Rule Deleted",
        description: "Approval rule has been deleted.",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      ruleName: "",
      description: "",
      ruleType: "discount",
      thresholdType: "discount_percentage",
      thresholdValue: "10",
      comparisonOperator: ">",
      approvalChainType: "sequential",
      approvers: [{ level: 1, isRequired: true, canDelegate: false }],
      slaHours: 24,
      escalationEnabled: true,
      priority: 0,
      isActive: true,
    });
  };

  const handleEditRule = (rule: ApprovalRule) => {
    setEditingRule(rule);
    setFormData(rule);
    setIsCreateDialogOpen(true);
  };

  const handleSaveRule = () => {
    saveMutation.mutate(formData);
  };

  const handleDeleteRule = (id: string) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      deleteMutation.mutate(id);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRules(newExpanded);
  };

  const addApprover = () => {
    const newLevel = (formData.approvers?.length || 0) + 1;
    setFormData({
      ...formData,
      approvers: [
        ...(formData.approvers || []),
        { level: newLevel, isRequired: true, canDelegate: false }
      ]
    });
  };

  const removeApprover = (level: number) => {
    setFormData({
      ...formData,
      approvers: formData.approvers?.filter(a => a.level !== level).map((a, idx) => ({
        ...a,
        level: idx + 1
      }))
    });
  };

  const updateApprover = (level: number, field: string, value: any) => {
    setFormData({
      ...formData,
      approvers: formData.approvers?.map(a =>
        a.level === level ? { ...a, [field]: value } : a
      )
    });
  };

  const getRuleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      discount: "Discount Approval",
      custom_pricing: "Custom Pricing",
      payment_terms: "Payment Terms",
      contract_terms: "Contract Terms",
      deal_structure: "Deal Structure",
      pricing_exception: "Pricing Exception",
    };
    return labels[type] || type;
  };

  const getThresholdTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      discount_percentage: "Discount %",
      discount_amount: "Discount $",
      margin_below: "Margin Below",
      deal_value: "Deal Value",
      total_contract_value: "Contract Value",
      payment_terms_days: "Payment Terms (Days)",
    };
    return labels[type] || type;
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/deal-desk')} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Deal Desk
            </Button>
            <h1 className="text-3xl font-bold text-slate-900">Approval Rules</h1>
            <p className="text-slate-600 mt-1">Configure approval thresholds and routing</p>
          </div>
          <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </div>

        {/* Rules List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">Loading rules...</div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No approval rules configured</p>
                <p className="text-sm text-slate-500 mt-1">Create your first rule to start automating approvals</p>
                <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            rules.sort((a, b) => (b.priority || 0) - (a.priority || 0)).map((rule) => (
              <Card key={rule.id} className={!rule.isActive ? 'opacity-60' : ''}>
                <CardHeader className="cursor-pointer" onClick={() => toggleExpanded(rule.id)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {expandedRules.has(rule.id) ? (
                          <ChevronUp className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {rule.ruleName}
                          {!rule.isActive && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {rule.description || 'No description'}
                        </CardDescription>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <Badge variant="outline">{getRuleTypeLabel(rule.ruleType)}</Badge>
                          <span className="text-slate-600">
                            {getThresholdTypeLabel(rule.thresholdType)} {rule.comparisonOperator} {rule.thresholdValue}
                          </span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {rule.slaHours}h SLA
                          </span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {rule.approvers?.length || 0} approvers
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRule(rule);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRule(rule.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedRules.has(rule.id) && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600 font-medium mb-1">Approval Chain Type</p>
                        <p className="capitalize">{rule.approvalChainType.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-slate-600 font-medium mb-1">Priority</p>
                        <p>{rule.priority}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-600 font-medium mb-2 text-sm">Approval Chain</p>
                      <div className="space-y-2">
                        {rule.approvers?.map((approver, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-md">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium text-sm">
                              {approver.level}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {approver.userName || approver.roleName || 'Not configured'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {approver.isRequired ? 'Required' : 'Optional'}
                                {approver.canDelegate && ' • Can delegate'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {rule.escalationEnabled && (
                      <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded-md">
                        <AlertCircle className="h-4 w-4" />
                        <span>Escalation enabled for SLA breaches</span>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Approval Rule' : 'Create Approval Rule'}</DialogTitle>
            <DialogDescription>
              Configure thresholds and approval chains for automated routing
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="ruleName">Rule Name *</Label>
              <Input
                id="ruleName"
                value={formData.ruleName}
                onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
                placeholder="e.g., Discount >15% requires Manager approval"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of when this rule applies"
                rows={2}
              />
            </div>

            {/* Rule Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ruleType">Request Type *</Label>
                <Select value={formData.ruleType} onValueChange={(value) => setFormData({ ...formData, ruleType: value })}>
                  <SelectTrigger id="ruleType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount">Discount Approval</SelectItem>
                    <SelectItem value="custom_pricing">Custom Pricing</SelectItem>
                    <SelectItem value="payment_terms">Payment Terms</SelectItem>
                    <SelectItem value="contract_terms">Contract Terms</SelectItem>
                    <SelectItem value="deal_structure">Deal Structure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thresholdType">Threshold Type *</Label>
                <Select value={formData.thresholdType} onValueChange={(value) => setFormData({ ...formData, thresholdType: value })}>
                  <SelectTrigger id="thresholdType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount_percentage">Discount Percentage</SelectItem>
                    <SelectItem value="discount_amount">Discount Amount</SelectItem>
                    <SelectItem value="margin_below">Margin Below</SelectItem>
                    <SelectItem value="deal_value">Deal Value</SelectItem>
                    <SelectItem value="total_contract_value">Total Contract Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="comparisonOperator">Comparison *</Label>
                <Select value={formData.comparisonOperator} onValueChange={(value) => setFormData({ ...formData, comparisonOperator: value })}>
                  <SelectTrigger id="comparisonOperator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">">Greater than (&gt;)</SelectItem>
                    <SelectItem value=">=">Greater than or equal (≥)</SelectItem>
                    <SelectItem value="<">Less than (&lt;)</SelectItem>
                    <SelectItem value="<=">Less than or equal (≤)</SelectItem>
                    <SelectItem value="==">Equal to (=)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thresholdValue">Threshold Value *</Label>
                <Input
                  id="thresholdValue"
                  type="number"
                  value={formData.thresholdValue}
                  onChange={(e) => setFormData({ ...formData, thresholdValue: e.target.value })}
                  placeholder="e.g., 15"
                />
              </div>
            </div>

            {/* Approval Chain */}
            <div className="space-y-2">
              <Label>Approval Chain Type *</Label>
              <Select value={formData.approvalChainType} onValueChange={(value) => setFormData({ ...formData, approvalChainType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential (one by one)</SelectItem>
                  <SelectItem value="parallel">Parallel (all at once)</SelectItem>
                  <SelectItem value="any_one">Any One (first to approve)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Approvers ({formData.approvers?.length || 0})</Label>
                <Button type="button" variant="outline" size="sm" onClick={addApprover}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Level
                </Button>
              </div>

              {formData.approvers?.map((approver) => (
                <div key={approver.level} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">Level {approver.level}</p>
                    {formData.approvers && formData.approvers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeApprover(approver.level)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Role name (e.g., Sales Manager)"
                    value={approver.roleName || ''}
                    onChange={(e) => updateApprover(approver.level, 'roleName', e.target.value)}
                  />
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={approver.isRequired}
                        onCheckedChange={(checked) => updateApprover(approver.level, 'isRequired', checked)}
                      />
                      <Label className="text-sm">Required</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={approver.canDelegate}
                        onCheckedChange={(checked) => updateApprover(approver.level, 'canDelegate', checked)}
                      />
                      <Label className="text-sm">Can Delegate</Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* SLA & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slaHours">SLA (Hours) *</Label>
                <Input
                  id="slaHours"
                  type="number"
                  value={formData.slaHours}
                  onChange={(e) => setFormData({ ...formData, slaHours: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority (higher = checked first)</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.escalationEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, escalationEnabled: checked })}
                />
                <Label className="text-sm">Enable Escalation</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setEditingRule(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} disabled={saveMutation.isPending || !formData.ruleName}>
              {saveMutation.isPending ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
