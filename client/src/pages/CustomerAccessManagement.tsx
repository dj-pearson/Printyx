import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Shield, 
  Users, 
  Key, 
  UserCheck, 
  UserX, 
  Settings, 
  Plus, 
  Edit,
  Trash2,
  Search
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CustomerAccess {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  customerId: string;
  customerName: string;
  accessLevel: 'view' | 'edit' | 'admin';
  permissions: string[];
  assignedBy: string;
  assignedDate: Date;
  isActive: boolean;
}

interface Role {
  id: string;
  name: string;
  level: number;
  department: string;
  permissions: Record<string, boolean>;
}

const getAccessLevelColor = (level: string) => {
  switch (level) {
    case 'view': return 'bg-blue-100 text-blue-800';
    case 'edit': return 'bg-yellow-100 text-yellow-800';
    case 'admin': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function CustomerAccessManagement() {
  const [selectedTab, setSelectedTab] = useState('access-assignments');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch customer access assignments
  const { data: accessAssignments, isLoading: isLoadingAccess } = useQuery({
    queryKey: ['/api/customer-access'],
    enabled: true,
  });

  // Fetch available users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/users'],
    enabled: true,
  });

  // Fetch available customers
  const { data: customers, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['/api/customers'],
    enabled: true,
  });

  // Fetch roles
  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ['/api/roles'],
    enabled: true,
  });

  const createAccessMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/customer-access', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-access'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Customer access assigned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign customer access",
        variant: "destructive",
      });
    },
  });

  const revokeAccessMutation = useMutation({
    mutationFn: (accessId: string) => apiRequest(`/api/customer-access/${accessId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-access'] });
      toast({
        title: "Success",
        description: "Customer access revoked successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke customer access",
        variant: "destructive",
      });
    },
  });

  const filteredAccess = accessAssignments?.filter((access: CustomerAccess) =>
    access.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    access.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Access Management</h1>
            <p className="text-gray-600">Manage user access to customer data and permissions</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Assign Access
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Customer Access</DialogTitle>
                <DialogDescription>
                  Grant a user access to specific customer data
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="user">User</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="customer">Customer</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((customer: any) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.businessName || customer.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="accessLevel">Access Level</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select access level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View Only</SelectItem>
                      <SelectItem value="edit">Edit Access</SelectItem>
                      <SelectItem value="admin">Full Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => createAccessMutation.mutate({})}>
                  Assign Access
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="access-assignments">Access Assignments</TabsTrigger>
            <TabsTrigger value="role-permissions">Role Permissions</TabsTrigger>
            <TabsTrigger value="audit-log">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="access-assignments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Customer Access Assignments
                </CardTitle>
                <CardDescription>
                  Manage individual user access to customer data
                </CardDescription>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <Input
                    placeholder="Search users or customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Access Level</TableHead>
                      <TableHead>Assigned By</TableHead>
                      <TableHead>Date Assigned</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingAccess ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : filteredAccess.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">No access assignments found</TableCell>
                      </TableRow>
                    ) : (
                      filteredAccess.map((access: CustomerAccess) => (
                        <TableRow key={access.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{access.userName}</div>
                              <div className="text-sm text-gray-500">{access.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>{access.customerName}</TableCell>
                          <TableCell>
                            <Badge className={getAccessLevelColor(access.accessLevel)}>
                              {access.accessLevel}
                            </Badge>
                          </TableCell>
                          <TableCell>{access.assignedBy}</TableCell>
                          <TableCell>
                            {new Date(access.assignedDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={access.isActive ? "default" : "secondary"}>
                              {access.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => revokeAccessMutation.mutate(access.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="role-permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Role-Based Permissions
                </CardTitle>
                <CardDescription>
                  Configure access permissions by user role
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isLoadingRoles ? (
                    <div>Loading roles...</div>
                  ) : (
                    roles?.map((role: Role) => (
                      <Card key={role.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">{role.name}</CardTitle>
                          <CardDescription>
                            Level {role.level} • {role.department} Department
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-4">
                            {Object.entries(role.permissions || {}).map(([permission, enabled]) => (
                              <div key={permission} className="flex items-center justify-between">
                                <span className="text-sm">{permission}</span>
                                <Badge variant={enabled ? "default" : "secondary"}>
                                  {enabled ? "Enabled" : "Disabled"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit-log" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Access Audit Log
                </CardTitle>
                <CardDescription>
                  Track all customer access changes and activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  Audit log functionality coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}