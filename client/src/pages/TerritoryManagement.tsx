import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Map,
  Plus,
  Users,
  Target,
  TrendingUp,
  Building2,
  Globe,
  Tag,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  UserPlus,
  LayoutGrid
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';

interface Territory {
  id: string;
  territoryName: string;
  territoryCode: string;
  territoryType: string;
  description: string;
  isActive: boolean;
  priority: number;
  ownerId: string;
  managerId: string;
  teamMembers: string[];
  monthlyQuota: number;
  currentPipeline: number;
  activeLeadsCount: number;
  geographicRules: {
    countries?: string[];
    states?: string[];
    cities?: string[];
    zipCodes?: string[];
  };
  accountRules: {
    industries?: string[];
    companySizeMin?: number;
    companySizeMax?: number;
    revenueMin?: number;
    revenueMax?: number;
  };
  productFocus: string[];
}

const territoryTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
  geographic: { label: 'Geographic', icon: Globe, color: 'bg-blue-100 text-blue-800' },
  industry: { label: 'Industry', icon: Building2, color: 'bg-purple-100 text-purple-800' },
  account_size: { label: 'Account Size', icon: Target, color: 'bg-green-100 text-green-800' },
  product_line: { label: 'Product Line', icon: Tag, color: 'bg-orange-100 text-orange-800' },
  named_accounts: { label: 'Named Accounts', icon: Users, color: 'bg-indigo-100 text-indigo-800' },
};

export default function TerritoryManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);

  const { register, handleSubmit, reset, setValue, watch } = useForm();

  // Fetch territories
  const { data: territoriesData, isLoading } = useQuery({
    queryKey: ['/api/territories', { type: typeFilter, search: searchTerm }],
    queryFn: () => apiRequest(`/api/territories?${typeFilter !== 'all' ? `type=${typeFilter}&` : ''}${searchTerm ? `search=${searchTerm}` : ''}`),
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['/api/territories/stats'],
    queryFn: () => apiRequest('/api/territories/stats'),
  });

  // Fetch territory types
  const { data: territoryTypes } = useQuery({
    queryKey: ['/api/territories/types'],
    queryFn: () => apiRequest('/api/territories/types'),
  });

  // Create territory mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/territories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/territories'] });
      setShowCreateDialog(false);
      reset();
      toast({ title: 'Territory created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error creating territory', description: error.message, variant: 'destructive' });
    },
  });

  // Update territory mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/territories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/territories'] });
      setSelectedTerritory(null);
      reset();
      toast({ title: 'Territory updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error updating territory', description: error.message, variant: 'destructive' });
    },
  });

  // Delete territory mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/territories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/territories'] });
      toast({ title: 'Territory deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error deleting territory', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (data: any) => {
    const formattedData = {
      ...data,
      geographicRules: {
        countries: data.countries?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
        states: data.states?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
        cities: data.cities?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
        zipCodes: data.zipCodes?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
      },
      accountRules: {
        industries: data.industries?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
        companySizeMin: data.companySizeMin ? parseInt(data.companySizeMin) : undefined,
        companySizeMax: data.companySizeMax ? parseInt(data.companySizeMax) : undefined,
        revenueMin: data.revenueMin ? parseFloat(data.revenueMin) : undefined,
        revenueMax: data.revenueMax ? parseFloat(data.revenueMax) : undefined,
      },
      productFocus: data.productFocus?.split(',').map((s: string) => s.trim()).filter(Boolean) || [],
      monthlyQuota: data.monthlyQuota ? parseFloat(data.monthlyQuota) : undefined,
      priority: data.priority ? parseInt(data.priority) : 0,
    };

    if (selectedTerritory) {
      updateMutation.mutate({ id: selectedTerritory.id, data: formattedData });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEdit = (territory: Territory) => {
    setSelectedTerritory(territory);
    setValue('territoryName', territory.territoryName);
    setValue('territoryCode', territory.territoryCode);
    setValue('territoryType', territory.territoryType);
    setValue('description', territory.description);
    setValue('countries', territory.geographicRules?.countries?.join(', ') || '');
    setValue('states', territory.geographicRules?.states?.join(', ') || '');
    setValue('cities', territory.geographicRules?.cities?.join(', ') || '');
    setValue('zipCodes', territory.geographicRules?.zipCodes?.join(', ') || '');
    setValue('industries', territory.accountRules?.industries?.join(', ') || '');
    setValue('companySizeMin', territory.accountRules?.companySizeMin?.toString() || '');
    setValue('companySizeMax', territory.accountRules?.companySizeMax?.toString() || '');
    setValue('revenueMin', territory.accountRules?.revenueMin?.toString() || '');
    setValue('revenueMax', territory.accountRules?.revenueMax?.toString() || '');
    setValue('productFocus', territory.productFocus?.join(', ') || '');
    setValue('monthlyQuota', territory.monthlyQuota?.toString() || '');
    setValue('priority', territory.priority?.toString() || '0');
    setShowCreateDialog(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Territory Management</h1>
            <p className="text-muted-foreground">
              Define and manage sales territories, assignment rules, and rep capacities
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) {
              setSelectedTerritory(null);
              reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Territory
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedTerritory ? 'Edit Territory' : 'Create New Territory'}
                </DialogTitle>
                <DialogDescription>
                  Define the territory rules and boundaries
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="territoryName">Territory Name *</Label>
                    <Input
                      id="territoryName"
                      {...register('territoryName', { required: true })}
                      placeholder="e.g., Northeast Region"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="territoryCode">Territory Code</Label>
                    <Input
                      id="territoryCode"
                      {...register('territoryCode')}
                      placeholder="e.g., NE-001"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="territoryType">Territory Type *</Label>
                    <Select
                      onValueChange={(value) => setValue('territoryType', value)}
                      defaultValue={selectedTerritory?.territoryType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="geographic">Geographic</SelectItem>
                        <SelectItem value="industry">Industry</SelectItem>
                        <SelectItem value="account_size">Account Size</SelectItem>
                        <SelectItem value="product_line">Product Line</SelectItem>
                        <SelectItem value="named_accounts">Named Accounts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Input
                      id="priority"
                      type="number"
                      {...register('priority')}
                      placeholder="0 (higher = checked first)"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Describe this territory..."
                  />
                </div>

                {/* Geographic Rules */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium">Geographic Rules</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="countries">Countries (comma-separated)</Label>
                      <Input
                        id="countries"
                        {...register('countries')}
                        placeholder="e.g., US, CA"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="states">States (comma-separated)</Label>
                      <Input
                        id="states"
                        {...register('states')}
                        placeholder="e.g., NY, NJ, CT"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cities">Cities (comma-separated)</Label>
                      <Input
                        id="cities"
                        {...register('cities')}
                        placeholder="e.g., New York, Boston"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCodes">ZIP Codes (comma-separated)</Label>
                      <Input
                        id="zipCodes"
                        {...register('zipCodes')}
                        placeholder="e.g., 10001, 10002"
                      />
                    </div>
                  </div>
                </div>

                {/* Account Rules */}
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium">Account Rules</h4>
                  <div className="space-y-2">
                    <Label htmlFor="industries">Industries (comma-separated)</Label>
                    <Input
                      id="industries"
                      {...register('industries')}
                      placeholder="e.g., Healthcare, Legal, Finance"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="companySizeMin">Min Company Size</Label>
                      <Input
                        id="companySizeMin"
                        type="number"
                        {...register('companySizeMin')}
                        placeholder="e.g., 50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companySizeMax">Max Company Size</Label>
                      <Input
                        id="companySizeMax"
                        type="number"
                        {...register('companySizeMax')}
                        placeholder="e.g., 500"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="revenueMin">Min Revenue ($)</Label>
                      <Input
                        id="revenueMin"
                        type="number"
                        {...register('revenueMin')}
                        placeholder="e.g., 1000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="revenueMax">Max Revenue ($)</Label>
                      <Input
                        id="revenueMax"
                        type="number"
                        {...register('revenueMax')}
                        placeholder="e.g., 50000000"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Focus */}
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="productFocus">Product Focus (comma-separated)</Label>
                  <Input
                    id="productFocus"
                    {...register('productFocus')}
                    placeholder="e.g., copiers, managed_print, production_equipment"
                  />
                </div>

                {/* Quota */}
                <div className="space-y-2">
                  <Label htmlFor="monthlyQuota">Monthly Quota ($)</Label>
                  <Input
                    id="monthlyQuota"
                    type="number"
                    {...register('monthlyQuota')}
                    placeholder="e.g., 100000"
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => {
                    setShowCreateDialog(false);
                    setSelectedTerritory(null);
                    reset();
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : selectedTerritory ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Territories</CardTitle>
              <Map className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTerritories || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.activeTerritories || 0} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads Assigned</CardTitle>
              <UserPlus className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalLeadsAssigned || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.unassignedLeads || 0} unassigned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reps Available</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.repsWithCapacity || 0}</div>
              <p className="text-xs text-muted-foreground">
                With available capacity
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">By Type</CardTitle>
              <LayoutGrid className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {stats?.byType && Object.entries(stats.byType).slice(0, 3).map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {type}: {count as number}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search territories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="geographic">Geographic</SelectItem>
              <SelectItem value="industry">Industry</SelectItem>
              <SelectItem value="account_size">Account Size</SelectItem>
              <SelectItem value="product_line">Product Line</SelectItem>
              <SelectItem value="named_accounts">Named Accounts</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/territories'] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Territories Table */}
        <Card>
          <CardHeader>
            <CardTitle>Territories</CardTitle>
            <CardDescription>
              Manage your sales territories and their rules
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : territoriesData?.territories?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Territory</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Rules</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Pipeline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {territoriesData.territories.map((territory: Territory) => {
                    const typeConfig = territoryTypeLabels[territory.territoryType] || {
                      label: territory.territoryType,
                      icon: Map,
                      color: 'bg-gray-100 text-gray-800'
                    };
                    const TypeIcon = typeConfig.icon;

                    return (
                      <TableRow key={territory.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{territory.territoryName}</div>
                            {territory.territoryCode && (
                              <div className="text-sm text-muted-foreground">{territory.territoryCode}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={typeConfig.color}>
                            <TypeIcon className="h-3 w-3 mr-1" />
                            {typeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            {territory.geographicRules?.states?.length > 0 && (
                              <div className="text-muted-foreground">
                                States: {territory.geographicRules.states.slice(0, 3).join(', ')}
                                {territory.geographicRules.states.length > 3 && '...'}
                              </div>
                            )}
                            {territory.accountRules?.industries?.length > 0 && (
                              <div className="text-muted-foreground">
                                Industries: {territory.accountRules.industries.slice(0, 2).join(', ')}
                                {territory.accountRules.industries.length > 2 && '...'}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{territory.activeLeadsCount || 0}</TableCell>
                        <TableCell className="text-right">
                          ${(territory.currentPipeline || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={territory.isActive ? 'default' : 'secondary'}>
                            {territory.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(territory)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this territory?')) {
                                  deleteMutation.mutate(territory.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Map className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Territories Found</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first territory to start organizing your sales team
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Territory
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
