import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Server,
  Users,
  DollarSign,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function PlatformAdminDashboard() {
  // Fetch platform admin dashboard
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports', 'executive', 'platform-admin'],
    queryFn: () => apiRequest('/api/reports/executive/platform-admin'),
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Admin Dashboard</h1>
          <p className="text-muted-foreground">
            System health, tenant metrics, and platform-wide analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.system?.uptime?.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">
              <CheckCircle2 className="inline h-3 w-3 text-green-600" />{' '}
              {data?.insights?.systemHealth || 'Excellent'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.tenants?.total?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.tenants?.active} active · {data?.tenants?.trial} trial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((data?.billing?.totalMRR || 0) / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              ARR: ${((data?.billing?.totalARR || 0) / 1000000).toFixed(2)}M
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.usage?.dailyActiveUsers?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.insights?.userEngagement?.toFixed(1)}% engagement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system">System Health</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>System Metrics</CardTitle>
                <CardDescription>Real-time system performance</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Uptime</span>
                      <span className="text-lg font-bold text-green-600">
                        {data?.system?.uptime?.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">API Response Time</span>
                      <span className="text-lg font-bold">{data?.system?.apiResponseTime}ms</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Error Rate</span>
                      <span className="text-lg font-bold">
                        {data?.system?.errorRate?.toFixed(3)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Requests/Min</span>
                      <span className="text-lg font-bold">
                        {data?.system?.requestsPerMinute?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Overall platform status</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    <div
                      className={`p-4 border rounded-lg ${
                        data?.insights?.systemHealth === 'excellent'
                          ? 'bg-green-50 border-green-200'
                          : data?.insights?.systemHealth === 'good'
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {data?.insights?.systemHealth === 'excellent' && (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        )}
                        {data?.insights?.systemHealth === 'good' && (
                          <Activity className="h-5 w-5 text-blue-600" />
                        )}
                        {data?.insights?.systemHealth === 'needs_attention' && (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">
                          {data?.insights?.systemHealth === 'excellent' &&
                            'System Running Optimally'}
                          {data?.insights?.systemHealth === 'good' && 'System Running Well'}
                          {data?.insights?.systemHealth === 'needs_attention' &&
                            'System Needs Attention'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        All services operational with minimal latency
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Overview</CardTitle>
                <CardDescription>Tenant distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Tenants</span>
                      <span className="font-bold">{data?.tenants?.total?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Active</span>
                      <span className="font-bold text-green-600">
                        {data?.tenants?.active?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Trial</span>
                      <span className="font-bold text-blue-600">
                        {data?.tenants?.trial?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Paid</span>
                      <span className="font-bold text-purple-600">
                        {data?.tenants?.paid?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Churned</span>
                      <span className="font-bold text-red-600">
                        {data?.tenants?.churned?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Per Tenant</CardTitle>
                <CardDescription>Average ARPU</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        ${data?.tenants?.avgRevenuePerTenant?.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Average Revenue Per Tenant
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Growth Metrics</CardTitle>
                <CardDescription>Tenant acquisition</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Growth Rate</span>
                      <span className="font-bold text-green-600">
                        +{data?.insights?.tenantGrowth}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Metrics</CardTitle>
                <CardDescription>Platform-wide billing</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Total MRR</span>
                      <span className="text-lg font-bold">
                        ${((data?.billing?.totalMRR || 0) / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Total ARR</span>
                      <span className="text-lg font-bold">
                        ${((data?.billing?.totalARR || 0) / 1000000).toFixed(2)}M
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Churn Rate</span>
                      <span className="text-lg font-bold text-red-600">
                        {data?.billing?.churnRate?.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Movement</CardTitle>
                <CardDescription>Expansion vs contraction</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Expansion Revenue</span>
                      <span className="text-lg font-bold text-green-600">
                        +${((data?.billing?.expansionRevenue || 0) / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Contraction Revenue</span>
                      <span className="text-lg font-bold text-red-600">
                        -${((data?.billing?.contractionRevenue || 0) / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        {data?.insights?.revenueHealth === 'positive' ? (
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">
                          Revenue Health: {data?.insights?.revenueHealth}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
                <CardDescription>Platform engagement</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Total Users</span>
                      <span className="text-lg font-bold">
                        {data?.usage?.totalUsers?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Daily Active Users</span>
                      <span className="text-lg font-bold">
                        {data?.usage?.dailyActiveUsers?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Monthly Active Users</span>
                      <span className="text-lg font-bold">
                        {data?.usage?.monthlyActiveUsers?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Avg Session Duration</span>
                      <span className="text-lg font-bold">
                        {data?.usage?.avgSessionDuration} min
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Adoption</CardTitle>
                <CardDescription>Module usage rates</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(data?.usage?.featureAdoption || {}).map(
                      ([feature, rate]: [string, any]) => (
                        <div key={feature} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{feature}</span>
                            <span className="font-medium">{rate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
