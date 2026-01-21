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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Users,
  Building2,
  TrendingUp,
  DollarSign,
  Globe,
  Filter,
} from 'lucide-react';

interface Territory {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  assignedManagerId?: string;
  assignedManagerName?: string;
  regions?: string[];
  industries?: string[];
  companySizeMin?: number;
  companySizeMax?: number;
  revenueMin?: string;
  revenueMax?: string;
  assignmentPriority: number;
  totalProspects?: number;
  totalTenants?: number;
  totalRevenue?: string;
  conversionRate?: number;
  createdAt: string;
  updatedAt: string;
}

interface TerritoryFormData {
  name: string;
  description: string;
  status: 'active' | 'inactive';
  assignedManagerId: string;
  regions: string;
  industries: string;
  companySizeMin: string;
  companySizeMax: string;
  revenueMin: string;
  revenueMax: string;
  assignmentPriority: string;
}

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail',
  'Education',
  'Government',
  'Non-Profit',
  'Legal',
  'Real Estate',
  'Construction',
  'Hospitality',
  'Transportation',
  'Energy',
  'Media',
  'Other',
];

const REGIONS = [
  'North America - East',
  'North America - West',
  'North America - Central',
  'Europe - North',
  'Europe - South',
  'Europe - East',
  'Europe - West',
  'Asia Pacific - North',
  'Asia Pacific - South',
  'Latin America',
  'Middle East',
  'Africa',
];

export default function PlatformTerritories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState<Territory | null>(null);
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState<TerritoryFormData>({
    name: '',
    description: '',
    status: 'active',
    assignedManagerId: '',
    regions: '',
    industries: '',
    companySizeMin: '',
    companySizeMax: '',
    revenueMin: '',
    revenueMax: '',
    assignmentPriority: '1',
  });

  // Fetch territories
  const { data: territories = [], isLoading } = useQuery<Territory[]>({
    queryKey: ['/api/platform-crm/territories'],
  });

  // Fetch available managers (platform admins/super admins)
  const { data: managers = [] } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ['/api/platform-crm/managers'],
  });

  // Create territory mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Territory>) => {
      const response = await fetch('/api/platform-crm/territories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create territory');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/territories'] });
      toast({
        title: 'Success',
        description: 'Territory created successfully',
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update territory mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Territory> }) => {
      const response = await fetch(`/api/platform-crm/territories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update territory');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/territories'] });
      toast({
        title: 'Success',
        description: 'Territory updated successfully',
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete territory mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/platform-crm/territories/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete territory');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-crm/territories'] });
      toast({
        title: 'Success',
        description: 'Territory deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'active',
      assignedManagerId: '',
      regions: '',
      industries: '',
      companySizeMin: '',
      companySizeMax: '',
      revenueMin: '',
      revenueMax: '',
      assignmentPriority: '1',
    });
    setEditingTerritory(null);
  };

  const handleOpenDialog = (territory?: Territory) => {
    if (territory) {
      setEditingTerritory(territory);
      setFormData({
        name: territory.name,
        description: territory.description || '',
        status: territory.status,
        assignedManagerId: territory.assignedManagerId || '',
        regions: territory.regions?.join(', ') || '',
        industries: territory.industries?.join(', ') || '',
        companySizeMin: territory.companySizeMin?.toString() || '',
        companySizeMax: territory.companySizeMax?.toString() || '',
        revenueMin: territory.revenueMin || '',
        revenueMax: territory.revenueMax || '',
        assignmentPriority: territory.assignmentPriority?.toString() || '1',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const territoryData: Partial<Territory> = {
      name: formData.name,
      description: formData.description || undefined,
      status: formData.status,
      assignedManagerId: formData.assignedManagerId || undefined,
      regions: formData.regions
        ? formData.regions
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean)
        : [],
      industries: formData.industries
        ? formData.industries
            .split(',')
            .map((i) => i.trim())
            .filter(Boolean)
        : [],
      companySizeMin: formData.companySizeMin ? parseInt(formData.companySizeMin) : undefined,
      companySizeMax: formData.companySizeMax ? parseInt(formData.companySizeMax) : undefined,
      revenueMin: formData.revenueMin || undefined,
      revenueMax: formData.revenueMax || undefined,
      assignmentPriority: parseInt(formData.assignmentPriority) || 1,
    };

    if (editingTerritory) {
      updateMutation.mutate({ id: editingTerritory.id, data: territoryData });
    } else {
      createMutation.mutate(territoryData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this territory?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filter territories
  const filteredTerritories = territories.filter((territory) => {
    const matchesSearch =
      territory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      territory.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = selectedTab === 'all' || territory.status === selectedTab;
    return matchesSearch && matchesTab;
  });

  // Calculate stats
  const stats = {
    total: territories.length,
    active: territories.filter((t) => t.status === 'active').length,
    inactive: territories.filter((t) => t.status === 'inactive').length,
    totalProspects: territories.reduce((sum, t) => sum + (t.totalProspects || 0), 0),
    totalTenants: territories.reduce((sum, t) => sum + (t.totalTenants || 0), 0),
    avgConversion:
      territories.length > 0
        ? territories.reduce((sum, t) => sum + (t.conversionRate || 0), 0) / territories.length
        : 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading territories...</p>
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
              <MapPin className="h-8 w-8 text-primary" />
              Territory Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure sales territories and assignment rules for prospect distribution
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            New Territory
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Territories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.total}</span>
              <Globe className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.active} active, {stats.inactive} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Prospects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.totalProspects.toLocaleString()}</span>
              <Building2 className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Across all territories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.totalTenants.toLocaleString()}</span>
              <Users className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Active customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.avgConversion.toFixed(1)}%</span>
              <TrendingUp className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Prospect to tenant</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Territories</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search territories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
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
                    <TableHead>Territory</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Prospects</TableHead>
                    <TableHead>Tenants</TableHead>
                    <TableHead>Conversion</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTerritories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No territories found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTerritories.map((territory) => (
                      <TableRow key={territory.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{territory.name}</div>
                            {territory.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {territory.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {territory.assignedManagerName || (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {territory.regions && territory.regions.length > 0 && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3" />
                                <span>{territory.regions.length} region(s)</span>
                              </div>
                            )}
                            {territory.industries && territory.industries.length > 0 && (
                              <div className="flex items-center gap-1 text-sm">
                                <Building2 className="h-3 w-3" />
                                <span>{territory.industries.length} industry(s)</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={territory.status === 'active' ? 'default' : 'secondary'}>
                            {territory.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{territory.assignmentPriority}</Badge>
                        </TableCell>
                        <TableCell>{territory.totalProspects?.toLocaleString() || 0}</TableCell>
                        <TableCell>{territory.totalTenants?.toLocaleString() || 0}</TableCell>
                        <TableCell>
                          {territory.conversionRate ? (
                            <span className="font-medium">
                              {territory.conversionRate.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(territory)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(territory.id)}
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTerritory ? 'Edit Territory' : 'Create New Territory'}
            </DialogTitle>
            <DialogDescription>Configure territory coverage and assignment rules</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Territory Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., North America Enterprise"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'active' | 'inactive') =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this territory..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignedManagerId">Territory Manager</Label>
                  <Select
                    value={formData.assignedManagerId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, assignedManagerId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager..." />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name} ({manager.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignmentPriority">Assignment Priority</Label>
                  <Input
                    id="assignmentPriority"
                    type="number"
                    min="1"
                    value={formData.assignmentPriority}
                    onChange={(e) =>
                      setFormData({ ...formData, assignmentPriority: e.target.value })
                    }
                    placeholder="1 (highest)"
                  />
                  <p className="text-xs text-muted-foreground">Lower numbers = higher priority</p>
                </div>
              </div>
            </div>

            {/* Coverage Criteria */}
            <div className="space-y-4">
              <h4 className="font-semibold">Coverage Criteria</h4>

              <div className="space-y-2">
                <Label htmlFor="regions">Regions (comma-separated)</Label>
                <Input
                  id="regions"
                  value={formData.regions}
                  onChange={(e) => setFormData({ ...formData, regions: e.target.value })}
                  placeholder="e.g., North America - East, Europe - West"
                />
                <p className="text-xs text-muted-foreground">Available: {REGIONS.join(', ')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industries">Industries (comma-separated)</Label>
                <Input
                  id="industries"
                  value={formData.industries}
                  onChange={(e) => setFormData({ ...formData, industries: e.target.value })}
                  placeholder="e.g., Technology, Healthcare, Finance"
                />
                <p className="text-xs text-muted-foreground">Available: {INDUSTRIES.join(', ')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingTerritory ? 'Update Territory' : 'Create Territory'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
