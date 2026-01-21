import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, DollarSign, TrendingUp, Users, Target, Percent, Activity } from 'lucide-react';
import { format, startOfQuarter, endOfQuarter } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

export default function ExecutiveDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfQuarter(new Date()),
    to: endOfQuarter(new Date()),
  });

  // Fetch executive dashboard
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['executive-reports', 'dashboard', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/executive-reports/dashboard?${params}`);
      if (!res.ok) throw new Error('Failed to fetch executive dashboard');
      return res.json();
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground">Strategic KPIs and business performance metrics</p>
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
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((data?.financial?.totalRevenue || 0) / 1000000).toFixed(2)}M
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3" /> {data?.financial?.revenueGrowth?.toFixed(1)}
              % growth
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Margin</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.financial?.grossMargin?.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Net Profit: ${((data?.financial?.netProfit || 0) / 1000000).toFixed(2)}M
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.operational?.customerCount?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3" />{' '}
              {data?.operational?.customerGrowth?.toFixed(1)}% growth
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LTV / CAC Ratio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.strategic?.ltvCacRatio?.toFixed(1)}x</div>
            <p className="text-xs text-muted-foreground">
              {data?.strategic?.monthsToRecover} months to recover
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="operational">Operational</TabsTrigger>
          <TabsTrigger value="strategic">Strategic</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Metrics</CardTitle>
                <CardDescription>Financial performance overview</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Total Revenue</span>
                      <span className="text-lg font-bold">
                        ${((data?.financial?.totalRevenue || 0) / 1000000).toFixed(2)}M
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Annual Recurring Revenue</span>
                      <span className="text-lg font-bold">
                        ${((data?.financial?.arr || 0) / 1000000).toFixed(2)}M
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Monthly Recurring Revenue</span>
                      <span className="text-lg font-bold">
                        ${((data?.financial?.mrr || 0) / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Net Profit</span>
                      <span className="text-lg font-bold">
                        ${((data?.financial?.netProfit || 0) / 1000000).toFixed(2)}M
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Margins & Profitability</CardTitle>
                <CardDescription>Margin analysis</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Gross Margin</span>
                        <span className="font-medium">
                          {data?.financial?.grossMargin?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${data?.financial?.grossMargin}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Net Margin</span>
                        <span className="font-medium">
                          {(
                            (data?.financial?.netProfit / data?.financial?.totalRevenue) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(data?.financial?.netProfit / data?.financial?.totalRevenue) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Revenue Growth</span>
                        <span className="font-medium">
                          {data?.financial?.revenueGrowth?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${Math.min(data?.financial?.revenueGrowth, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operational" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Customer Metrics</CardTitle>
                <CardDescription>Customer base analytics</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Customers</span>
                      <span className="font-bold">
                        {data?.operational?.customerCount?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Customer Growth</span>
                      <span className="font-bold text-green-600">
                        +{data?.operational?.customerGrowth?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Churn Rate</span>
                      <span className="font-bold text-red-600">
                        {data?.operational?.customerChurn?.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Satisfaction Metrics</CardTitle>
                <CardDescription>Customer satisfaction</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">NPS</span>
                      <span className="font-bold">{data?.operational?.nps}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">CSAT</span>
                      <span className="font-bold">{data?.operational?.csat?.toFixed(1)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team Metrics</CardTitle>
                <CardDescription>Employee analytics</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Employees</span>
                      <span className="font-bold">{data?.operational?.totalEmployees}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="strategic" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Unit Economics</CardTitle>
                <CardDescription>CAC and LTV metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Customer Acquisition Cost</span>
                      <span className="text-lg font-bold">${data?.strategic?.cac?.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Lifetime Value</span>
                      <span className="text-lg font-bold">${data?.strategic?.ltv?.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">LTV / CAC Ratio</span>
                      <span className="text-lg font-bold text-green-600">
                        {data?.strategic?.ltvCacRatio?.toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Months to Recover CAC</span>
                      <span className="text-lg font-bold">{data?.strategic?.monthsToRecover}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Market Position</CardTitle>
                <CardDescription>Competitive landscape</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                      <span className="text-sm font-medium">Market Share</span>
                      <span className="text-lg font-bold">
                        {data?.strategic?.marketShare?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Health Status:{' '}
                        <span className="font-medium">{data?.insights?.overallHealth}</span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Growth Trajectory:{' '}
                        <span className="font-medium">{data?.insights?.growthTrajectory}</span>
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Key Performance Indicators</CardTitle>
              <CardDescription>Track progress against targets</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="space-y-3">
                  {data?.kpis?.map((kpi: any) => (
                    <div key={kpi.name} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{kpi.name}</span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            kpi.status === 'green'
                              ? 'bg-green-100 text-green-800'
                              : kpi.status === 'yellow'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {kpi.status === 'green'
                            ? 'On Track'
                            : kpi.status === 'yellow'
                              ? 'At Risk'
                              : 'Off Track'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Current: {kpi.value?.toFixed(1)}</span>
                        <span>Target: {kpi.target?.toFixed(1)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            kpi.status === 'green'
                              ? 'bg-green-600'
                              : kpi.status === 'yellow'
                                ? 'bg-yellow-600'
                                : 'bg-red-600'
                          }`}
                          style={{ width: `${Math.min((kpi.value / kpi.target) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
