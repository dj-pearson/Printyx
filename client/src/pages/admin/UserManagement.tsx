import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { apiRequest } from '@/lib/queryClient';
import { describeApiError } from '@/lib/api-error';
import { exportToCSV, type ExportColumn } from '@/lib/export-utils';
import { useRefreshQueries } from '@/hooks/use-refresh-queries';

interface UserStats {
  totalUsers: number | null;
  userGrowth: string | null;
  activeUsers: number | null;
  activeRate: string | null;
  suspendedUsers: number | null;
  suspendedRate: string | null;
  adminUsers: number | null;
  adminPercentage: string | null;
  degraded?: string[];
}

/** GET /api/admin/roles: the global role catalogue with this tenant's active-user count per role. */
interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  level: number | null;
  isSystemRole: boolean | null;
  canAccessAllTenants: boolean | null;
  userCount: number;
}

const ROLE_EXPORT_COLUMNS: ExportColumn<RoleRow>[] = [
  { key: 'name', label: 'Role' },
  { key: 'level', label: 'Level' },
  { key: 'description', label: 'Description' },
  { key: 'userCount', label: 'Active Users (this tenant)' },
  { key: 'isSystemRole', label: 'System Role' },
  { key: 'canAccessAllTenants', label: 'Cross-Tenant Access' },
];

/** A stat the server could not read is null; 0 is a real measurement. */
const stat = (v: string | number | null | undefined) => (v === null || v === undefined ? '—' : v);

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  /*
   * QUERYKEY-002: `selectedTenant` was here, feeding a second element of the
   * users query key and a Select whose options were three invented companies
   * (Acme Corporation, TechStart Solutions, Global Industries). It could not
   * have worked: supabase/functions/admin/'s users list is hard-scoped to the
   * caller's own tenant, so there is no cross-tenant read to filter. Deleted
   * with its Select, along with a Role Select whose options (admin / manager /
   * user) are not role codes - the endpoint takes a roleId uuid and this page
   * loads no roles to offer.
   *
   * What the endpoint DOES read is `search` and `isActive`, so those two
   * controls are wired to it rather than removed.
   */
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const { toast } = useToast();

  const userQueryString = new URLSearchParams();
  if (search.trim()) userQueryString.set('search', search.trim());
  if (activeFilter !== 'all') userQueryString.set('isActive', String(activeFilter === 'active'));

  const usersQuery = useQuery<any[]>({
    queryKey: ['/api/admin/users' + (userQueryString.size ? `?${userQueryString.toString()}` : '')],
  });

  const statsQuery = useQuery<UserStats>({
    queryKey: ['/api/admin/user-stats'],
  });

  // CR-033: both kept only `.data`. A failed request rendered zero users and an
  // empty table, which on an access-management page reads as "nobody has
  // access" rather than "the list did not load".
  const users = usersQuery.data;
  const userStats = statsQuery.data;

  const rolesQuery = useQuery<RoleRow[]>({ queryKey: ['/api/admin/roles'] });
  const roles = rolesQuery.data ?? [];
  const rolesInUse = roles.filter((r) => r.userCount > 0);

  const { refresh: refreshUsers } = useRefreshQueries([
    '/api/admin/users',
    '/api/admin/user-stats',
    '/api/admin/roles',
  ]);

  // POST /api/admin/users invites by email (GoTrue sends the link). The tenant
  // is the caller's own - the old dialog offered three invented companies -
  // and the server refuses a role above the caller's (shared/role-grant.ts).
  const emptyInvite = { firstName: '', lastName: '', email: '', roleId: '' };
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(emptyInvite);
  const inviteMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/admin/users', 'POST', {
        firstName: invite.firstName.trim() || undefined,
        lastName: invite.lastName.trim() || undefined,
        email: invite.email.trim(),
        roleId: invite.roleId || undefined,
        redirectTo: `${window.location.origin}/auth/callback`,
      }),
    onSuccess: () => {
      toast({ title: 'Invitation sent', description: `${invite.email.trim()} will get an email.` });
      setInvite(emptyInvite);
      setInviteOpen(false);
      void refreshUsers();
    },
    onError: (err) => {
      toast({
        title: 'Could not invite user',
        description: describeApiError(err).message,
        variant: 'destructive',
      });
    },
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-2">Manage the users in your organization</p>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Invite User</DialogTitle>
                <DialogDescription>
                  They join your organization and receive an email to set a password.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  inviteMutation.mutate();
                }}
              >
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={invite.firstName}
                    onChange={(e) => setInvite({ ...invite, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={invite.lastName}
                    onChange={(e) => setInvite({ ...invite, lastName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="user@company.com"
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={invite.roleId}
                    onValueChange={(roleId) => setInvite({ ...invite, roleId })}
                  >
                    <SelectTrigger id="role">
                      <SelectValue
                        placeholder={rolesQuery.isError ? 'Roles could not load' : 'Select role'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!invite.email.trim() || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
                </Button>
              </form>
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
                <div className="text-2xl font-bold">{stat(userStats?.totalUsers)}</div>
                <p className="text-xs text-green-600 mt-2">{stat(userStats?.userGrowth)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <UserCheck className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat(userStats?.activeUsers)}</div>
                <p className="text-xs text-green-600 mt-2">{stat(userStats?.activeRate)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suspended Users</CardTitle>
                <UserX className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat(userStats?.suspendedUsers)}</div>
                <p className="text-xs text-red-600 mt-2">{stat(userStats?.suspendedRate)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
                <Shield className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat(userStats?.adminUsers)}</div>
                <p className="text-xs text-gray-500 mt-2">{stat(userStats?.adminPercentage)}</p>
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
                            <Badge variant={user.isActive ? 'default' : 'destructive'}>
                              {user.isActive ? 'Active' : 'Inactive'}
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
                    {/* Round 187: AUDIT-019 removed typed-in role bars and
                        left this unmeasured because the user LIST is paginated.
                        GET /api/admin/roles already counts active users per
                        role across the whole tenant, so the census comes from
                        there rather than from one page of users. */}
                    <RoleCensus query={rolesQuery} rows={rolesInUse} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>Users in your organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <Input
                        aria-label="Search users"
                        placeholder="Search users..."
                        className="max-w-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {/* Active / inactive, because users.is_active is a
                          boolean - there is no suspended or pending state to
                          offer. */}
                      <Select value={activeFilter} onValueChange={setActiveFilter}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-lg">
                      <div className="grid grid-cols-7 gap-4 p-4 border-b bg-gray-50 font-medium">
                        <div>User</div>
                        <div>Email</div>
                        <div>Team</div>
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
                            <div className="text-sm">{user.teamName ?? '—'}</div>
                            <div className="text-sm">{user.roleName ?? '—'}</div>
                            <div>
                              <Badge variant={user.isActive ? 'default' : 'destructive'}>
                                {user.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="text-sm">
                              {user.lastLoginAt
                                ? new Date(user.lastLoginAt).toLocaleString()
                                : 'Never'}
                            </div>
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
                    {/* Round 187: this tab listed six roles with typed-in
                        counts (1, 5, 12, 89, 423, 789 users) and three buttons
                        with no handler. Create Custom Role and Import Role
                        Template are gone: POST /admin/roles refuses on purpose,
                        because `roles` is a global catalogue and a tenant edit
                        would change every other tenant's roles. */}
                    <RoleCensus query={rolesQuery} rows={rolesInUse} />
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={roles.length === 0}
                      onClick={() =>
                        exportToCSV(roles, ROLE_EXPORT_COLUMNS, { filename: 'role-configuration' })
                      }
                    >
                      Export Role Configuration
                    </Button>
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

function RoleCensus({
  query,
  rows,
}: {
  query: { isLoading: boolean; isError: boolean };
  rows: RoleRow[];
}) {
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading roles...</p>;
  if (query.isError) {
    return <p className="text-sm text-destructive">Role counts could not be loaded.</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No active user holds a role yet.</p>;
  }
  return (
    <div className="space-y-2">
      {[...rows]
        .sort((a, b) => b.userCount - a.userCount)
        .map((r) => (
          <div key={r.id} className="flex justify-between items-center p-3 border rounded-lg">
            <div>
              <p className="font-medium">{r.name}</p>
              {r.description && <p className="text-sm text-gray-500">{r.description}</p>}
            </div>
            <Badge>
              {r.userCount} active user{r.userCount === 1 ? '' : 's'}
            </Badge>
          </div>
        ))}
    </div>
  );
}
