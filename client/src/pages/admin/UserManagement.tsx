import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryStates } from '@/components/ui/query-state';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, UserPlus, UserCheck, UserX, Shield, Eye, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';

interface UserStats {
  totalUsers?: string | number;
  userGrowth?: string | number;
  activeUsers?: string | number;
  activeRate?: string | number;
  suspendedUsers?: string | number;
  suspendedRate?: string | number;
  adminUsers?: string | number;
  adminPercentage?: string | number;
}

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTenant, setSelectedTenant] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const usersQuery = useQuery<any[]>({
    queryKey: ['/api/admin/users', selectedTenant],
  });

  const statsQuery = useQuery<UserStats>({
    queryKey: ['/api/admin/user-stats'],
  });

  // CR-033: both kept only `.data`. A failed request rendered zero users and an
  // empty table, which on an access-management page reads as "nobody has
  // access" rather than "the list did not load".
  const users = usersQuery.data;
  const userStats = statsQuery.data;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-2">Manage users across all tenant organizations</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Add a new user to a tenant organization</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="Enter first name" />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Enter last name" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="user@company.com" />
                </div>
                <div>
                  <Label htmlFor="tenant">Tenant</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acme">Acme Corporation</SelectItem>
                      <SelectItem value="techstart">TechStart Solutions</SelectItem>
                      <SelectItem value="global">Global Industries</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Company Admin</SelectItem>
                      <SelectItem value="manager">Regional Manager</SelectItem>
                      <SelectItem value="sales">Sales Manager</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">Create User</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* CR-033: the heading and tenant filter above stay usable — changing
            the filter is the retry. */}
        <QueryStates
          queries={[usersQuery, statsQuery]}
          loading={<DashboardSkeleton />}
          errorTitle="Could not load users"
          className="py-6"
        >
          {/* User Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats?.totalUsers || 'Loading...'}</div>
                <p className="text-xs text-green-600 mt-2">
                  {userStats?.userGrowth || 'Loading...'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <UserCheck className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats?.activeUsers || 'Loading...'}</div>
                <p className="text-xs text-green-600 mt-2">
                  {userStats?.activeRate || 'Loading...'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suspended Users</CardTitle>
                <UserX className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {userStats?.suspendedUsers || 'Loading...'}
                </div>
                <p className="text-xs text-red-600 mt-2">
                  {userStats?.suspendedRate || 'Loading...'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
                <Shield className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats?.adminUsers || 'Loading...'}</div>
                <p className="text-xs text-gray-500 mt-2">
                  {userStats?.adminPercentage || 'Loading...'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">All Users</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent User Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {users && users.length > 0 ? (
                        users.slice(0, 5).map((user: any) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between py-2 border-b"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src="" />
                                <AvatarFallback className="bg-blue-100 text-blue-600">
                                  {user.firstName?.[0] || 'U'}
                                  {user.lastName?.[0] || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                              </div>
                            </div>
                            <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                              {user.status}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500">No recent user activity</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User Distribution by Role</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* AUDIT-019: four role bars at fixed widths with fixed
                        counts - 89 Company Admins, 423 Regional Managers, 567
                        Sales Managers, 1,768 Users. Nothing was counted, and
                        the bar widths did not even agree with the numbers
                        beside them. The page loads the real user list; a role
                        census can be derived from it, but not until the list is
                        unpaginated, so this says nothing rather than the wrong
                        thing. */}
                    <p className="text-sm text-muted-foreground">
                      Role distribution is not computed. The user list on this page is paginated, so
                      a count taken from it would describe the current page rather than the tenant.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>
                    Complete list of users across all tenant organizations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <Input
                        aria-label="Search users"
                        placeholder="Search users..."
                        className="max-w-sm"
                      />
                      <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tenants</SelectItem>
                          <SelectItem value="acme">Acme Corporation</SelectItem>
                          <SelectItem value="techstart">TechStart Solutions</SelectItem>
                          <SelectItem value="global">Global Industries</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-lg">
                      <div className="grid grid-cols-7 gap-4 p-4 border-b bg-gray-50 font-medium">
                        <div>User</div>
                        <div>Email</div>
                        <div>Tenant</div>
                        <div>Role</div>
                        <div>Status</div>
                        <div>Last Login</div>
                        <div>Actions</div>
                      </div>
                      {users && users.length > 0 ? (
                        users.map((user: any) => (
                          <div
                            key={user.id}
                            className="grid grid-cols-7 gap-4 p-4 border-b items-center"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src="" />
                                <AvatarFallback className="bg-blue-100 text-blue-600">
                                  {user.firstName?.[0] || 'U'}
                                  {user.lastName?.[0] || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-xs text-gray-500">ID: {user.id}</p>
                              </div>
                            </div>
                            <div className="text-sm">{user.email}</div>
                            <div className="text-sm">{user.tenant}</div>
                            <div className="text-sm">{user.role}</div>
                            <div>
                              <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                                {user.status}
                              </Badge>
                            </div>
                            <div className="text-sm">{user.lastLogin}</div>
                            <div className="flex gap-2">
                              <Button aria-label="View details" size="sm" variant="outline">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button aria-label="Edit" size="sm" variant="outline">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button aria-label="Delete" size="sm" variant="outline">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-gray-500">No users found</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Role Management</CardTitle>
                  <CardDescription>
                    Manage roles and permissions across the platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-semibold">Platform Roles</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Root Administrator</p>
                              <p className="text-sm text-gray-500">Ultimate system access</p>
                            </div>
                            <Badge>1 user</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Platform Admin</p>
                              <p className="text-sm text-gray-500">Platform-wide administration</p>
                            </div>
                            <Badge>5 users</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">System Admin</p>
                              <p className="text-sm text-gray-500">System-level operations</p>
                            </div>
                            <Badge>12 users</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold">Tenant Roles</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Company Admin</p>
                              <p className="text-sm text-gray-500">Company-wide management</p>
                            </div>
                            <Badge>89 users</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Regional Manager</p>
                              <p className="text-sm text-gray-500">Regional operations</p>
                            </div>
                            <Badge>423 users</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Location Manager</p>
                              <p className="text-sm text-gray-500">Location-specific management</p>
                            </div>
                            <Badge>789 users</Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button className="w-full" variant="outline">
                        Create Custom Role
                      </Button>
                      <Button className="w-full" variant="outline">
                        Import Role Template
                      </Button>
                      <Button className="w-full" variant="outline">
                        Export Role Configuration
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Activity</CardTitle>
                  <CardDescription>
                    Monitor user activity and login patterns across the platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* AUDIT-019: 1,847 daily / 12,456 weekly / 45,789 monthly
                      active users, typed in. This platform does not have 45,789
                      users. Under them sat Generate Activity Report, Export
                      User Data and View Login Analytics, none of which had a
                      handler. The one active-user figure the platform really
                      measures is users.activeLastDay from
                      GET /api/admin/system-health, shown on System Security. */}
                  <p className="text-sm text-muted-foreground">
                    Active-user rollups are not computed here. System Security reports users signed
                    in over the last 24 hours for this tenant, read from the users table.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </QueryStates>
      </div>
    </MainLayout>
  );
}
