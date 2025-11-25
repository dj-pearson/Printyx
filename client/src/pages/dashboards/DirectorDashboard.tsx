import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  Users,
  Target,
  Award,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

export default function DirectorDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch company-wide sales performance
  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = useQuery({
    queryKey: ['director-reports', 'sales', 'company-performance', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/director-reports/sales/company-performance?${params}`);
      if (!res.ok) throw new Error('Failed to fetch sales performance');
      return res.json();
    },
  });

  // Fetch company-wide service performance
  const { data: serviceData, isLoading: serviceLoading } = useQuery({
    queryKey: ['director-reports', 'service', 'company-performance', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/director-reports/service/company-performance?${params}`);
      if (!res.ok) throw new Error('Failed to fetch service performance');
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetchSales();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Director Dashboard</h1>
          <p className="text-muted-foreground">
            Company-wide performance metrics and strategic insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={salesLoading || serviceLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(salesLoading || serviceLoading) ? 'animate-spin' : ''}`} />
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
              ${((salesData?.totalRevenue || 0) / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              {salesData?.totalDeals || 0} deals closed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quota Attainment</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {salesData?.quotaAttainment?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {salesData?.insights?.performanceStatus === 'exceeding' && 'Exceeding targets'}
              {salesData?.insights?.performanceStatus === 'on_track' && 'On track'}
              {salesData?.insights?.performanceStatus === 'near_target' && 'Near target'}
              {salesData?.insights?.performanceStatus === 'at_risk' && 'At risk'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Calls</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {serviceData?.totalCalls || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {serviceData?.totalTechnicians || 0} technicians
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">First-Time Fix</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {serviceData?.avgFirstTimeFixRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              SLA: {serviceData?.avgSlaCompliance?.toFixed(1) || 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales Performance</TabsTrigger>
          <TabsTrigger value="service">Service Performance</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Regional Performance</CardTitle>
                <CardDescription>Revenue and deal counts by region</CardDescription>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-2">
                    {salesData?.regions?.map((region: any) => (
                      <div key={region.regionId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{region.regionName}</div>
                          <div className="text-sm text-muted-foreground">
                            {region.deals} deals · {region.winRate.toFixed(1)}% win rate
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">${(region.revenue / 1000).toFixed(0)}K</div>
                          <div className="text-sm text-muted-foreground">
                            {region.quotaAttainment.toFixed(0)}% quota
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>Highest revenue generators</CardDescription>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-2">
                    {salesData?.topPerformers?.slice(0, 5).map((performer: any, idx: number) => (
                      <div key={performer.userId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Award className={`h-5 w-5 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-muted-foreground'}`} />
                          <div>
                            <div className="font-medium">{performer.userName}</div>
                            <div className="text-sm text-muted-foreground">{performer.deals} deals</div>
                          </div>
                        </div>
                        <div className="text-lg font-bold">
                          ${(performer.revenue / 1000).toFixed(0)}K
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="service" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Regional Service Performance</CardTitle>
                <CardDescription>Service metrics by region</CardDescription>
              </CardHeader>
              <CardContent>
                {serviceLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-2">
                    {serviceData?.regions?.map((region: any) => (
                      <div key={region.regionId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{region.regionName}</div>
                          <div className="text-sm text-muted-foreground">
                            {region.calls} calls · {region.technicians} techs
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">FTF: {region.ftfRate.toFixed(1)}%</div>
                          <div className="text-sm">SLA: {region.slaCompliance.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Service Performers</CardTitle>
                <CardDescription>Highest performing technicians</CardDescription>
              </CardHeader>
              <CardContent>
                {serviceLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-2">
                    {serviceData?.topPerformers?.slice(0, 5).map((performer: any, idx: number) => (
                      <div key={performer.userId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Award className={`h-5 w-5 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-muted-foreground'}`} />
                          <div>
                            <div className="font-medium">{performer.userName}</div>
                            <div className="text-sm text-muted-foreground">
                              {performer.satisfaction.toFixed(1)} avg rating
                            </div>
                          </div>
                        </div>
                        <div className="text-lg font-bold">
                          {performer.ftfRate.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Forecast</CardTitle>
              <CardDescription>Projected revenue based on pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Current Quarter</div>
                    <div className="text-2xl font-bold mt-1">
                      ${((salesData?.forecast?.currentQuarter || 0) / 1000).toFixed(0)}K
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Next Quarter</div>
                    <div className="text-2xl font-bold mt-1">
                      ${((salesData?.forecast?.nextQuarter || 0) / 1000).toFixed(0)}K
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Projected from pipeline</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Year End</div>
                    <div className="text-2xl font-bold mt-1">
                      ${((salesData?.forecast?.yearEnd || 0) / 1000).toFixed(0)}K
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Estimated</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
