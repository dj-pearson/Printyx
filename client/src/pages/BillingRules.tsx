import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import MainLayout from '@/components/layout/main-layout';
import { Plus, Search, Edit, Eye, Power, PowerOff, Filter, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BillingRuleDialog } from '@/components/billing/billing-rule-dialog';
import { BillingRulePreview } from '@/components/billing/billing-rule-preview';
import { format } from 'date-fns';

export default function BillingRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ruleTypeFilter, setRuleTypeFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);

  // Fetch billing rules
  const { data: rulesData, isLoading } = useQuery({
    queryKey: [
      '/api/billing/rules',
      {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        ruleType: ruleTypeFilter !== 'all' ? ruleTypeFilter : undefined,
      },
    ],
  });

  const rules = rulesData?.rules || [];
  const pagination = rulesData?.pagination;

  // Activate/deactivate rule mutation
  const toggleRuleMutation = useMutation({
    mutationFn: async ({
      ruleId,
      action,
    }: {
      ruleId: string;
      action: 'activate' | 'deactivate';
    }) => {
      return await apiRequest(`/api/billing/rules/${ruleId}/${action}`, 'PATCH');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/rules'] });
      toast({
        title: 'Rule updated',
        description: 'Billing rule status has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update rule',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return await apiRequest(`/api/billing/rules/${ruleId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/rules'] });
      toast({
        title: 'Rule deleted',
        description: 'Billing rule has been deactivated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete rule',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  // Filter rules by search query
  const filteredRules = rules.filter((rule: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      rule.ruleName?.toLowerCase().includes(query) ||
      rule.ruleDescription?.toLowerCase().includes(query) ||
      rule.ruleType?.toLowerCase().includes(query)
    );
  });

  const getRuleTypeBadge = (type: string) => {
    const badges: Record<string, { variant: any; label: string }> = {
      tiered: { variant: 'default', label: 'Tiered' },
      volume_discount: { variant: 'secondary', label: 'Volume Discount' },
      time_based: { variant: 'outline', label: 'Time Based' },
      overage: { variant: 'destructive', label: 'Overage' },
      flat_rate: { variant: 'default', label: 'Flat Rate' },
      custom: { variant: 'secondary', label: 'Custom' },
    };
    const config = badges[type] || { variant: 'default', label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    } else if (status === 'draft') {
      return <Badge variant="outline">Draft</Badge>;
    } else {
      return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  const handleEditRule = (rule: any) => {
    setSelectedRule(rule);
    setIsDialogOpen(true);
  };

  const handlePreviewRule = (rule: any) => {
    setSelectedRule(rule);
    setIsPreviewOpen(true);
  };

  const handleToggleRule = (rule: any) => {
    toggleRuleMutation.mutate({
      ruleId: rule.id,
      action: rule.ruleStatus === 'active' ? 'deactivate' : 'activate',
    });
  };

  const handleDeleteRule = (rule: any) => {
    if (confirm(`Are you sure you want to deactivate "${rule.ruleName}"?`)) {
      deleteRuleMutation.mutate(rule.id);
    }
  };

  return (
    <MainLayout
      title="Billing Rules"
      description="Manage billing rules, pricing tiers, and discounts"
    >
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Billing Rules</h1>
            <p className="text-muted-foreground mt-1">
              Configure automated billing rules and pricing structures
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedRule(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>

              {/* Rule Type Filter */}
              <Select value={ruleTypeFilter} onValueChange={setRuleTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="tiered">Tiered</SelectItem>
                  <SelectItem value="volume_discount">Volume Discount</SelectItem>
                  <SelectItem value="time_based">Time Based</SelectItem>
                  <SelectItem value="overage">Overage</SelectItem>
                  <SelectItem value="flat_rate">Flat Rate</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Rules Table */}
        <Card>
          <CardHeader>
            <CardTitle>Rules ({filteredRules.length})</CardTitle>
            <CardDescription>Manage your billing rules and pricing configurations</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading rules...</div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-8">
                <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No billing rules found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {searchQuery || statusFilter !== 'all' || ruleTypeFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first billing rule to get started'}
                </p>
                {!searchQuery && statusFilter === 'all' && ruleTypeFilter === 'all' && (
                  <Button
                    onClick={() => {
                      setSelectedRule(null);
                      setIsDialogOpen(true);
                    }}
                    className="mt-4"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Rule
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Pricing</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule: any) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rule.ruleName}</p>
                            {rule.ruleDescription && (
                              <p className="text-sm text-muted-foreground truncate max-w-xs">
                                {rule.ruleDescription}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getRuleTypeBadge(rule.ruleType)}</TableCell>
                        <TableCell>{getStatusBadge(rule.ruleStatus)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.priority || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(rule.effectiveStartDate), 'MMM d, yyyy')}
                            {rule.effectiveEndDate && (
                              <p className="text-muted-foreground">
                                to {format(new Date(rule.effectiveEndDate), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rule.baseCharge && <p>Base: ${rule.baseCharge}</p>}
                            {rule.bwRate && <p>B&W: ${rule.bwRate}/page</p>}
                            {rule.colorRate && <p>Color: ${rule.colorRate}/page</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePreviewRule(rule)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview & Test
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleRule(rule)}>
                                {rule.ruleStatus === 'active' ? (
                                  <>
                                    <PowerOff className="mr-2 h-4 w-4" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Power className="mr-2 h-4 w-4" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteRule(rule)}
                                className="text-destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <BillingRuleDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} rule={selectedRule} />

      {/* Preview Dialog */}
      <BillingRulePreview
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        rule={selectedRule}
      />
    </MainLayout>
  );
}
