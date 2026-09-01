import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { MapPin, Plus, Edit, Trash2, Users, Building2, Globe, Filter } from 'lucide-react';

// Mirrors platform_sales_territories (shared/platform-crm-schema.ts) in the
// camelCase the platform-crm function returns. PA-052: the previous shape used
// status/assignedManagerId/regions/assignmentPriority/totalTenants/
// totalRevenue/conversionRate, none of which is a column, against endpoints that
// existed on neither host.
interface Territory {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  territoryType?: string | null;
  isActive: boolean;

  // Geographic rules. The old shape had a single free-text `regions`; the table
  // separates the four levels it actually matches on.
  countries?: string[] | null;
  states?: string[] | null;
  cities?: string[] | null;
  postalCodes?: string[] | null;

  // Account rules
  industries?: string[] | null;
  companySizeMin?: number | null;
  companySizeMax?: number | null;
  revenueMin?: string | null;
  revenueMax?: string | null;

  // Ownership
  ownerId: string;
  managerId?: string | null;

  // Quotas
  monthlyQuota?: string | null;
  quarterlyQuota?: string | null;
  annualQuota?: string | null;

  // Performance, maintained by the platform rather than by this form
  currentPipeline?: string | null;
  activeProspectsCount?: number | null;
  activeDealsCount?: number | null;

  createdAt: string;
  updatedAt: string;
}

interface TerritoryFormData {
  name: string;
  code: string;
  description: string;
  territoryType: string;
  isActive: boolean;
  countries: string;
  states: string;
  industries: string;
  companySizeMin: string;
  companySizeMax: string;
  revenueMin: string;
  revenueMax: string;
  ownerId: string;
  managerId: string;
  annualQuota: string;
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

// A REGIONS list stood here, feeding the free-text Regions field. The table
// has no region column - geography is countries/states/cities/postal codes.

const EMPTY_FORM: TerritoryFormData = {
  name: '',
  code: '',
  description: '',
  territoryType: 'geographic',
  isActive: true,
  countries: '',
  states: '',
  industries: '',
  companySizeMin: '',
  companySizeMax: '',
  revenueMin: '',
  revenueMax: '',
  ownerId: '',
  managerId: '',
  annualQuota: '',
};

export default function PlatformTerritories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState<Territory | null>(null);
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState<TerritoryFormData>({ ...EMPTY_FORM });

  // Fetch territories
  const { data: territories = [], isLoading } = useQuery<Territory[]>({
    queryKey: ['/api/platform-crm/territories'],
  });

  // Fetch available managers (platform admins/super admins)
  const { data: managers = [] } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ['/api/platform-crm/managers'],
  });

  // Create territory mutation
  // PA-052: raw fetch() carries no Authorization header, so these would 401
  // against the platform-crm edge function that now serves them.
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Territory>) =>
      apiRequest('/api/platform-crm/territories', { method: 'POST', body: data }),
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<Territory> }) =>
      apiRequest(`/api/platform-crm/territories/${id}`, { method: 'PUT', body: data }),
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
    mutationFn: async (id: string) =>
      apiRequest(`/api/platform-crm/territories/${id}`, { method: 'DELETE' }),
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
    setFormData({ ...EMPTY_FORM });
    setEditingTerritory(null);
  };

  const handleOpenDialog = (territory?: Territory) => {
    if (territory) {
      setEditingTerritory(territory);
      setFormData({
        name: territory.name,
        code: territory.code || '',
        description: territory.description || '',
        territoryType: territory.territoryType || 'geographic',
        isActive: territory.isActive,
        countries: territory.countries?.join(', ') || '',
        states: territory.states?.join(', ') || '',
        industries: territory.industries?.join(', ') || '',
        companySizeMin: territory.companySizeMin?.toString() || '',
        companySizeMax: territory.companySizeMax?.toString() || '',
        revenueMin: territory.revenueMin || '',
        revenueMax: territory.revenueMax || '',
        ownerId: territory.ownerId || '',
        managerId: territory.managerId || '',
        annualQuota: territory.annualQuota || '',
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

    const territoryData: Partial<Territory> = {
      name: formData.name,
      code: formData.code || undefined,
      description: formData.description || undefined,
      territoryType: formData.territoryType || undefined,
      isActive: formData.isActive,
      countries: list(formData.countries),
      states: list(formData.states),
      industries: list(formData.industries),
      companySizeMin: formData.companySizeMin ? parseInt(formData.companySizeMin, 10) : undefined,
      companySizeMax: formData.companySizeMax ? parseInt(formData.companySizeMax, 10) : undefined,
      revenueMin: formData.revenueMin || undefined,
      revenueMax: formData.revenueMax || undefined,
      ownerId: formData.ownerId || undefined,
      managerId: formData.managerId || undefined,
      annualQuota: formData.annualQuota || undefined,
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

  const managerName = (id: string) => managers.find((m) => m.id === id)?.name ?? id;

  // The old shape had one free-text `regions` list; the table matches on four
  // separate levels, so the card counts the rules rather than inventing a region.
  const geographyCount = (t: Territory) =>
    (t.countries?.length ?? 0) +
    (t.states?.length ?? 0) +
    (t.cities?.length ?? 0) +
    (t.postalCodes?.length ?? 0);

  // Filter territories
  const filteredTerritories = territories.filter((territory) => {
    const matchesSearch =
      territory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      territory.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = selectedTab === 'all' || territory.isActive === (selectedTab === 'active');
    return matchesSearch && matchesTab;
  });

  // Calculate stats
  // activeProspectsCount and activeDealsCount are real columns the platform
  // maintains, so those two roll up. totalTenants and conversionRate were summed
  // from fields no table records and are gone rather than shown as zero.
  const stats = {
    total: territories.length,
    active: territories.filter((t) => t.isActive).length,
    inactive: territories.filter((t) => !t.isActive).length,
    activeProspects: territories.reduce((sum, t) => sum + (t.activeProspectsCount || 0), 0),
    activeDeals: territories.reduce((sum, t) => sum + (t.activeDealsCount || 0), 0),
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
              Active Prospects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.activeProspects.toLocaleString()}</span>
              <Building2 className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Across all territories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{stats.activeDeals.toLocaleString()}</span>
              <Users className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Open across all territories</p>
          </CardContent>
        </Card>

        {/* An "Avg Conversion Rate" card stood here, averaged from a
            conversionRate field no table records. Nothing measures
            prospect-to-tenant conversion per territory. */}
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Territories</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search territories"
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
                          {territory.managerId ? (
                            managerName(territory.managerId)
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {geographyCount(territory) > 0 && (
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3" />
                                <span>{geographyCount(territory)} geographic rule(s)</span>
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
                          <Badge variant={territory.isActive ? 'default' : 'secondary'}>
                            {territory.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {territory.activeProspectsCount?.toLocaleString() ?? 0}
                        </TableCell>
                        <TableCell>{territory.activeDealsCount?.toLocaleString() ?? 0}</TableCell>
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
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., NA-ENT"
                  />
                  <p className="text-xs text-muted-foreground">Must be unique across territories</p>
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
                  <Label htmlFor="ownerId">Primary Rep (owner)</Label>
                  <Select
                    value={formData.ownerId}
                    onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Defaults to you" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name} ({manager.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Required by the table; left blank, the territory is owned by you.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="managerId">Territory Manager</Label>
                  <Select
                    value={formData.managerId}
                    onValueChange={(value) => setFormData({ ...formData, managerId: value })}
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
                  <Label htmlFor="territoryType">Territory Type</Label>
                  <Select
                    value={formData.territoryType}
                    onValueChange={(value) => setFormData({ ...formData, territoryType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geographic">Geographic</SelectItem>
                      <SelectItem value="industry">Industry</SelectItem>
                      <SelectItem value="company_size">Company Size</SelectItem>
                      <SelectItem value="named_accounts">Named Accounts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="annualQuota">Annual Quota</Label>
                  <Input
                    id="annualQuota"
                    value={formData.annualQuota}
                    onChange={(e) => setFormData({ ...formData, annualQuota: e.target.value })}
                    placeholder="e.g., 2400000"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>

                {/* An "Assignment Priority" field stood here. Priority is a
                    column on the assignment RULES table, not on a territory. */}
              </div>
            </div>

            {/* Coverage Criteria */}
            <div className="space-y-4">
              <h4 className="font-semibold">Coverage Criteria</h4>

              {/* One free-text "Regions" field stood here. The table matches
                  geography on countries, states, cities and postal codes as
                  separate lists, so a region name matched nothing. */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="countries">Countries (comma-separated)</Label>
                  <Input
                    id="countries"
                    value={formData.countries}
                    onChange={(e) => setFormData({ ...formData, countries: e.target.value })}
                    placeholder="e.g., US, CA"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="states">States (comma-separated)</Label>
                  <Input
                    id="states"
                    value={formData.states}
                    onChange={(e) => setFormData({ ...formData, states: e.target.value })}
                    placeholder="e.g., IA, NE, MN"
                  />
                </div>
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
