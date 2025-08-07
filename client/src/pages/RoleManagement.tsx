import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Shield, 
  Settings, 
  Plus, 
  Search,
  ChevronRight,
  CheckCircle,
  Building2,
  UserCheck,
  Key
} from 'lucide-react';
// Use simpler layout without sidebar for now
// import RoleBasedSidebar from "@/components/RoleBasedSidebar";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';

interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  hierarchyLevel: string;
  department: string;
  organizationalTier: string;
  isCustomizable: boolean;
  isActive: boolean;
  permissionCount: number;
  assignmentCount: number;
}

interface Permission {
  id: string;
  name: string;
  code: string;
  description: string;
  module: string;
  resourceType: string;
  action: string;
  scopeLevel: string;
}

interface RolePermission {
  permission: Permission;
  rolePermission: {
    effect: 'ALLOW' | 'DENY';
    grantedAt: string;
  };
}

interface OrganizationalUnit {
  id: string;
  name: string;
  code: string;
  tier: string;
  parentUnitId?: string;
  children: OrganizationalUnit[];
}

export default function RoleManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedTier, setSelectedTier] = useState('all');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInitDialogOpen, setIsInitDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for RBAC initialization status
  const { data: rbacStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/rbac/status'],
    queryFn: async () => {
      const response = await fetch('/api/rbac/status');
      if (!response.ok) throw new Error('Failed to check RBAC status');
      return response.json();
    }
  });

  // Query for roles
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['/api/rbac/roles', searchTerm, selectedDepartment, selectedTier],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (selectedDepartment !== 'all') params.set('department', selectedDepartment);
      if (selectedTier !== 'all') params.set('organizationalTier', selectedTier);
      
      const response = await fetch(`/api/rbac/roles?${params}`);
      if (!response.ok) throw new Error('Failed to fetch roles');
      return response.json();
    },
    enabled: rbacStatus?.initialized !== false
  });

  // Query for permissions
  const { data: permissionsData } = useQuery({
    queryKey: ['/api/rbac/permissions'],
    queryFn: async () => {
      const response = await fetch('/api/rbac/permissions');
      if (!response.ok) throw new Error('Failed to fetch permissions');
      return response.json();
    },
    enabled: rbacStatus?.initialized !== false
  });

  // Query for organizational units
  const { data: orgUnitsData } = useQuery({
    queryKey: ['/api/rbac/organizational-units'],
    queryFn: async () => {
      const response = await fetch('/api/rbac/organizational-units');
      if (!response.ok) throw new Error('Failed to fetch organizational units');
      return response.json();
    },
    enabled: rbacStatus?.initialized !== false
  });

  // Query for selected role details
  const { data: roleDetails } = useQuery({
    queryKey: ['/api/rbac/roles', selectedRoleId],
    queryFn: async () => {
      const response = await fetch(`/api/rbac/roles/${selectedRoleId}`);
      if (!response.ok) throw new Error('Failed to fetch role details');
      return response.json();
    },
    enabled: !!selectedRoleId
  });

  // Initialize RBAC system mutation
  const initRBACMutation = useMutation({
    mutationFn: async (dealerType: 'small' | 'standard' | 'enterprise') => {
      return apiRequest('/api/rbac/seed', 'POST', { dealerType });
    },
    onSuccess: () => {
      toast({
        title: 'RBAC System Initialized',
        description: 'Role-based access control system has been successfully set up.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac'] });
    },
    onError: (error) => {
      toast({
        title: 'Initialization Failed',
        description: error.message || 'Failed to initialize RBAC system',
        variant: 'destructive',
      });
    },
  });

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show initialization screen if RBAC is not set up
  if (rbacStatus && !rbacStatus.initialized) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Enhanced Role-Based Access Control</CardTitle>
            <CardDescription className="max-w-2xl mx-auto">
              Set up enterprise-grade permission management for your organization. 
              Choose the configuration that best fits your business size and structure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="space-y-2">
                  <Badge className="bg-green-100 text-green-800">Small Dealer</Badge>
                  <h3 className="font-semibold">Simple Setup</h3>
                  <p className="text-sm text-gray-600">
                    Basic roles for single-location businesses ($500K revenue)
                  </p>
                  <ul className="text-xs space-y-1">
                    <li>• Owner, Manager, Sales, Service</li>
                    <li>• Essential permissions only</li>
                    <li>• Quick setup (5 minutes)</li>
                  </ul>
                  <Button 
                    onClick={() => initRBACMutation.mutate('small')}
                    disabled={initRBACMutation.isPending}
                    className="w-full mt-3"
                    variant="outline"
                  >
                    Initialize Simple
                  </Button>
                </div>
              </Card>

              <Card className="p-4 hover:shadow-md transition-shadow border-blue-200">
                <div className="space-y-2">
                  <Badge className="bg-blue-100 text-blue-800">Standard Dealer</Badge>
                  <h3 className="font-semibold">Recommended</h3>
                  <p className="text-sm text-gray-600">
                    Balanced setup for growing businesses
                  </p>
                  <ul className="text-xs space-y-1">
                    <li>• Full role hierarchy (8 levels)</li>
                    <li>• Granular permissions</li>
                    <li>• Customizable by admins</li>
                  </ul>
                  <Button 
                    onClick={() => initRBACMutation.mutate('standard')}
                    disabled={initRBACMutation.isPending}
                    className="w-full mt-3"
                  >
                    {initRBACMutation.isPending ? 'Setting up...' : 'Initialize Standard'}
                  </Button>
                </div>
              </Card>

              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="space-y-2">
                  <Badge className="bg-purple-100 text-purple-800">Enterprise</Badge>
                  <h3 className="font-semibold">Advanced Setup</h3>
                  <p className="text-sm text-gray-600">
                    Multi-location businesses ($300M revenue)
                  </p>
                  <ul className="text-xs space-y-1">
                    <li>• Multi-location hierarchy</li>
                    <li>• Territory-based access</li>
                    <li>• Advanced customization</li>
                  </ul>
                  <Button 
                    onClick={() => initRBACMutation.mutate('enterprise')}
                    disabled={initRBACMutation.isPending}
                    className="w-full mt-3"
                    variant="outline"
                  >
                    Initialize Enterprise
                  </Button>
                </div>
              </Card>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                {rbacStatus.recommendation}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {rbacStatus.actions?.map((action: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {action}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 md:px-6">
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Role Management</h1>
              <p className="text-gray-600 text-sm md:text-base">Manage roles, permissions, and organizational access</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-4 md:p-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Total Roles</p>
                <p className="text-2xl font-bold">{rbacStatus?.stats?.totalRoles || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium">Org Units</p>
                <p className="text-2xl font-bold">{rbacStatus?.stats?.organizationalUnits || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Key className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Permissions</p>
                <p className="text-2xl font-bold">{permissionsData?.totalCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-sm font-medium">Active Users</p>
                <p className="text-2xl font-bold">
                  {rolesData?.roles?.reduce((sum: number, role: Role) => sum + role.assignmentCount, 0) || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

          <Tabs defaultValue="roles" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
              <TabsTrigger value="roles" className="text-xs md:text-sm p-2">Roles</TabsTrigger>
              <TabsTrigger value="permissions" className="text-xs md:text-sm p-2">Permissions</TabsTrigger>
              <TabsTrigger value="organization" className="text-xs md:text-sm p-2">Organization</TabsTrigger>
              <TabsTrigger value="assignments" className="text-xs md:text-sm p-2">Assignments</TabsTrigger>
            </TabsList>

        <TabsContent value="roles" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search roles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="administration">Administration</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedTier} onValueChange={setSelectedTier}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="PLATFORM">Platform</SelectItem>
                    <SelectItem value="COMPANY">Company</SelectItem>
                    <SelectItem value="REGIONAL">Regional</SelectItem>
                    <SelectItem value="LOCATION">Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Roles Table */}
          <Card>
            <CardHeader>
              <CardTitle>Roles</CardTitle>
              <CardDescription>Manage roles and their permissions</CardDescription>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Hierarchy Level</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rolesData?.roles?.map((role: Role) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{role.name}</p>
                            <p className="text-sm text-gray-500">{role.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{role.department}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <div className="text-sm font-medium">{role.hierarchyLevel}</div>
                            <div className="text-xs text-gray-500">({role.organizationalTier})</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Key className="h-4 w-4 text-gray-400" />
                            <span>{role.permissionCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span>{role.assignmentCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={role.isActive ? "default" : "secondary"}
                            className={role.isActive ? "bg-green-100 text-green-800" : ""}
                          >
                            {role.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRoleId(role.id)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Permissions</CardTitle>
              <CardDescription>Available permissions organized by module</CardDescription>
            </CardHeader>
            <CardContent>
              {permissionsData?.groupedPermissions && (
                <div className="space-y-6">
                  {Object.entries(permissionsData.groupedPermissions).map(([module, permissions]) => (
                    <div key={module}>
                      <h3 className="text-lg font-semibold mb-3 capitalize">{module}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {(permissions as Permission[]).map((permission) => (
                          <Card key={permission.id} className="p-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-xs">
                                  {permission.action}
                                </Badge>
                                <Badge className="text-xs bg-blue-100 text-blue-800">
                                  {permission.scopeLevel}
                                </Badge>
                              </div>
                              <p className="font-medium text-sm">{permission.name}</p>
                              <p className="text-xs text-gray-600">{permission.description}</p>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organizational Structure</CardTitle>
              <CardDescription>Manage your organizational hierarchy</CardDescription>
            </CardHeader>
            <CardContent>
              {orgUnitsData?.hierarchy && (
                <div className="space-y-2">
                  {orgUnitsData.hierarchy.map((unit: OrganizationalUnit) => (
                    <OrgUnitCard key={unit.id} unit={unit} level={0} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Role Assignments</CardTitle>
              <CardDescription>View and manage user role assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <UserCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">User Assignment Management</h3>
                <p className="text-gray-600 mb-4">Select a role to view and manage user assignments</p>
                <Button variant="outline">
                  Browse Users
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
          </Tabs>
      </div>
    </div>
  );
}

// Organizational Unit Card Component
function OrgUnitCard({ unit, level }: { unit: OrganizationalUnit; level: number }) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  
  return (
    <div style={{ marginLeft: `${level * 20}px` }}>
      <Card className="mb-2">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {unit.children.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <ChevronRight
                    className={`h-4 w-4 transform transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </Button>
              )}
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">{unit.name}</p>
                <p className="text-sm text-gray-500">{unit.code}</p>
              </div>
            </div>
            <Badge variant="outline">{unit.tier}</Badge>
          </div>
        </CardContent>
      </Card>
      
      {isExpanded && unit.children.map((child) => (
        <OrgUnitCard key={child.id} unit={child} level={level + 1} />
      ))}
    </div>
  );
}