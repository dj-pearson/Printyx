import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryStates } from '@/components/ui/query-state';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Users, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { describeApiError } from '@/lib/api-error';
import { useConfirm } from '@/components/ui/confirm-dialog';

/** GET /api/root-admin/overview */
interface PlatformOverview {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
}

/** GET /api/root-admin/tenants */
interface TenantRow {
  id: string;
  name: string;
  /** Billing status: trialing | active | past_due | canceled. Not a plan. */
  subscription: string | null;
  lastActivity: string | null;
  userCount: number;
  status: 'active' | 'suspended';
}

export default function TenantManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Round 196. This read /api/admin/tenants and /api/admin/tenant-stats. The
  // first had no handler on either host and the second was Express-only, and
  // both sat in one QueryStates - so this page could only ever render "Could
  // not load tenants". The root-admin function already serves both, and the
  // root admin dashboard reads them.
  const tenantsQuery = useQuery<TenantRow[]>({ queryKey: ['/api/root-admin/tenants'] });
  const statsQuery = useQuery<PlatformOverview>({ queryKey: ['/api/root-admin/overview'] });
  const tenants = tenantsQuery.data;
  const tenantStats = statsQuery.data;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const visibleTenants = (tenants ?? []).filter(
    (t) =>
      (statusFilter === 'all' || t.status === statusFilter) &&
      (!search.trim() || t.name?.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const subscriptionMix = Object.entries(
    (tenants ?? []).reduce<Record<string, number>>((acc, t) => {
      const k = t.subscription || 'none recorded';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const confirm = useConfirm();
  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'activate' }) =>
      apiRequest(`/api/root-admin/tenants/${id}/${action}`, 'POST', {}),
    onSuccess: (_d, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/root-admin/tenants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/root-admin/overview'] });
      toast({ title: action === 'suspend' ? 'Tenant suspended' : 'Tenant reactivated' });
    },
    onError: (err) =>
      toast({
        title: 'Could not change tenant status',
        description: describeApiError(err).message,
        variant: 'destructive',
      }),
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
            <p className="text-gray-600 mt-2">
              Manage all tenant organizations and their configurations
            </p>
          </div>
          {/* Round 196: a Create Tenant dialog sat here with unbound fields,
              a Select of three plan names, and a submit button with no handler.
              Nothing lets a platform admin create a tenant: tenants are created
              by self-service signup (supabase/functions/signup), which also
              creates the admin user and their role. */}
          <Button asChild variant="outline">
            <Link href="/signup">Open signup</Link>
          </Button>
        </div>

        {/* CR-033: the heading above stays usable. */}
        <QueryStates
          queries={[tenantsQuery, statsQuery]}
          loading={<DashboardSkeleton />}
          errorTitle="Could not load tenants"
          className="py-6"
        >
          {/* Revenue and conversion cards removed: nothing aggregates platform
              revenue (see the Billing tab) and nothing records trial conversion. */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
                <Building2 className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tenantStats?.totalTenants ?? '—'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
                <Activity className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tenantStats?.activeTenants ?? '—'}</div>
                <p className="text-xs text-muted-foreground mt-2">Activity in the last 30 days</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tenantStats?.totalUsers ?? '—'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tenantStats?.activeUsers ?? '—'}</div>
                <p className="text-xs text-muted-foreground mt-2">Signed in within 7 days</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tenants">All Tenants</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Tenant Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {tenants && tenants.length > 0 ? (
                        tenants.slice(0, 5).map((tenant) => (
                          <div
                            key={tenant.id}
                            className="flex items-center justify-between py-2 border-b"
                          >
                            <div>
                              <p className="font-medium">{tenant.name}</p>
                              <p className="text-sm text-gray-500">
                                {tenant.userCount} user{tenant.userCount === 1 ? '' : 's'}
                              </p>
                            </div>
                            <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                              {tenant.status}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500">No recent tenant activity</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Subscription Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* AUDIT-019 removed a typed-in 65 / 25 / 10 plan mix. The
                        rows carry `subscription` (a billing status, not a plan),
                        so this counts that instead. */}
                    <div className="space-y-2">
                      {subscriptionMix.map(([status, count]) => (
                        <div key={status} className="flex justify-between text-sm">
                          <span className="capitalize">{status.replace('_', ' ')}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tenants" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>All Tenants</CardTitle>
                  <CardDescription>
                    Complete list of tenant organizations with management actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <Input
                        aria-label="Search tenants"
                        placeholder="Search tenants..."
                        className="max-w-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {/* tenants.is_active is the only status; there is no trial
                          state and no plan column to filter on. */}
                      <Select
                        value={statusFilter}
                        onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-lg">
                      <div className="grid grid-cols-6 gap-4 p-4 border-b bg-gray-50 font-medium">
                        <div>Company</div>
                        <div>Status</div>
                        <div>Subscription</div>
                        <div>Users</div>
                        <div>Last Activity</div>
                        <div>Actions</div>
                      </div>
                      {visibleTenants.length > 0 ? (
                        visibleTenants.map((tenant) => (
                          <div
                            key={tenant.id}
                            className="grid grid-cols-6 gap-4 p-4 border-b items-center"
                          >
                            <div>
                              <p className="font-medium">{tenant.name}</p>
                              <p className="text-sm text-gray-500">ID: {tenant.id}</p>
                            </div>
                            <div>
                              <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                                {tenant.status}
                              </Badge>
                            </div>
                            <div className="capitalize">
                              {tenant.subscription?.replace('_', ' ') ?? '—'}
                            </div>
                            <div>{tenant.userCount}</div>
                            <div className="text-sm">
                              {tenant.lastActivity
                                ? new Date(tenant.lastActivity).toLocaleDateString()
                                : 'Never'}
                            </div>
                            <div>
                              {tenant.status === 'active' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Suspend ${tenant.name}`}
                                  disabled={statusMutation.isPending}
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: `Suspend ${tenant.name}?`,
                                      description:
                                        'Its users lose access until the tenant is reactivated. No data is deleted.',
                                      confirmLabel: 'Suspend',
                                    });
                                    if (ok)
                                      statusMutation.mutate({ id: tenant.id, action: 'suspend' });
                                  }}
                                >
                                  Suspend
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Reactivate ${tenant.name}`}
                                  disabled={statusMutation.isPending}
                                  onClick={() =>
                                    statusMutation.mutate({ id: tenant.id, action: 'activate' })
                                  }
                                >
                                  Reactivate
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-gray-500">No tenants found</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Billing Overview</CardTitle>
                  <CardDescription>
                    Revenue tracking and billing management across all tenants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* AUDIT-019: $284,750 MRR, $3,417,000 ARR and $45,200
                      outstanding, all three typed in, on the platform's own
                      billing screen. These are the numbers an operator would
                      quote to an investor or reconcile against Stripe. The
                      three buttons under them - Generate Revenue Report, Export
                      Billing Data, Manage Payment Methods - had no handler
                      either. Platform revenue is not aggregated anywhere in
                      this codebase, so nothing here can be derived. */}
                  <p className="text-sm text-muted-foreground">
                    Platform revenue is not aggregated here. Subscription and invoice figures live
                    in Stripe and in the per-tenant billing tables; read them there rather than from
                    this screen.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Settings</CardTitle>
                  <CardDescription>
                    Global configuration settings that affect all tenants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Round 196: this tab offered a default plan, max users,
                      trial length and welcome message, all uncontrolled, over a
                      Save Settings and Reset to Defaults with no handlers. No
                      table stores platform-wide defaults like these; trials are
                      set by the Stripe products (scripts/setup-stripe-products.ts). */}
                  <p className="text-sm text-muted-foreground">
                    Platform-wide tenant defaults are not configurable here. Trial length and plans
                    come from the Stripe products; nothing stores a default user limit or welcome
                    message.
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
