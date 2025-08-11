import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Clock, Target, Package, Wrench, DollarSign } from "lucide-react";

interface ServiceSLAReport {
  totalTickets: number;
  averageResponseTime: number;
  slaBreaches: number;
  slaComplianceRate: number;
  ticketsByPriority: { priority: string; count: number }[];
  resolutionTimes: { category: string; avgHours: number }[];
}

interface PurchaseOrderVarianceReport {
  totalOrders: number;
  onTimeOrders: number;
  delayedOrders: number;
  avgDeliveryVarianceDays: number;
  variancesByVendor: { vendor: string; avgVarianceDays: number }[];
  costVariances: { budgeted: number; actual: number; variance: number }[];
}

interface MeterReadingMetrics {
  totalReadings: number;
  avgPagesPerMonth: number;
  predictedOverages: number;
  equipmentUtilization: { equipmentId: string; model: string; utilization: number }[];
  monthlyTrends: { month: string; totalPages: number }[];
}

interface WarehouseFPYMetrics {
  totalOperations: number;
  firstPassYield: number;
  qualityTrends: { date: string; fpy: number }[];
  defectsByType: { type: string; count: number }[];
  operatorPerformance: { operator: string; fpy: number }[];
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("service-sla");

  // Service SLA Metrics
  const { data: serviceSLA, isLoading: isLoadingSLA } = useQuery({
    queryKey: ["/api/reports/service-sla"],
    enabled: activeTab === "service-sla",
  });

  // Purchase Order Variance Metrics
  const { data: poVariance, isLoading: isLoadingPO } = useQuery({
    queryKey: ["/api/reports/purchase-order-variance"],
    enabled: activeTab === "purchase-orders",
  });

  // Meter Reading Metrics
  const { data: meterMetrics, isLoading: isLoadingMeter } = useQuery({
    queryKey: ["/api/reports/meter-reading-metrics"],
    enabled: activeTab === "meter-readings",
  });

  // Warehouse FPY Metrics
  const { data: fpyMetrics, isLoading: isLoadingFPY } = useQuery({
    queryKey: ["/api/warehouse-fpy/metrics"],
    enabled: activeTab === "warehouse-fpy",
  });

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">LEAN Operations Reports</h1>
          <p className="text-gray-600">Performance metrics and analytics for operational excellence</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="service-sla" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Service SLA
          </TabsTrigger>
          <TabsTrigger value="purchase-orders" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="meter-readings" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Meter Analytics
          </TabsTrigger>
          <TabsTrigger value="warehouse-fpy" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Warehouse FPY
          </TabsTrigger>
        </TabsList>

        {/* Service SLA Tab */}
        <TabsContent value="service-sla" className="space-y-6">
          {isLoadingSLA ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-gray-200 rounded-t-lg"></CardHeader>
                  <CardContent className="h-24 bg-gray-100"></CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Service Tickets</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{serviceSLA?.totalTickets || 0}</div>
                  <p className="text-xs text-muted-foreground">Active and completed tickets</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Response Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{serviceSLA?.averageResponseTime?.toFixed(1) || '0'} hrs</div>
                  <p className="text-xs text-muted-foreground">Time to first response</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatPercentage(serviceSLA?.slaComplianceRate || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {serviceSLA?.slaBreaches || 0} breaches this month
                  </p>
                </CardContent>
              </Card>

              <Card className="md:col-span-3">
                <CardHeader>
                  <CardTitle>Resolution Time by Issue Category</CardTitle>
                  <CardDescription>Average hours to resolve tickets by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {serviceSLA?.resolutionTimes?.map((item) => (
                      <div key={item.category} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.category}</span>
                        <Badge variant="outline">{item.avgHours.toFixed(1)} hours</Badge>
                      </div>
                    )) || <p className="text-gray-500">No resolution data available</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Purchase Orders Tab */}
        <TabsContent value="purchase-orders" className="space-y-6">
          {isLoadingPO ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-gray-200 rounded-t-lg"></CardHeader>
                  <CardContent className="h-24 bg-gray-100"></CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Purchase Orders</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{poVariance?.totalOrders || 0}</div>
                  <p className="text-xs text-muted-foreground">This quarter</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {poVariance ? formatPercentage(poVariance.onTimeOrders / poVariance.totalOrders) : '0%'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {poVariance?.delayedOrders || 0} delayed orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Delivery Variance</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {poVariance?.avgDeliveryVarianceDays?.toFixed(1) || '0'} days
                  </div>
                  <p className="text-xs text-muted-foreground">Past scheduled delivery</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Meter Readings Tab */}
        <TabsContent value="meter-readings" className="space-y-6">
          {isLoadingMeter ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-gray-200 rounded-t-lg"></CardHeader>
                  <CardContent className="h-24 bg-gray-100"></CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Meter Readings</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{meterMetrics?.totalReadings || 0}</div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Pages/Month</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{meterMetrics?.avgPagesPerMonth?.toLocaleString() || '0'}</div>
                  <p className="text-xs text-muted-foreground">Across all equipment</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Predicted Overages</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{meterMetrics?.predictedOverages || 0}</div>
                  <p className="text-xs text-muted-foreground">Equipment units at risk</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Warehouse FPY Tab */}
        <TabsContent value="warehouse-fpy" className="space-y-6">
          {isLoadingFPY ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-gray-200 rounded-t-lg"></CardHeader>
                  <CardContent className="h-24 bg-gray-100"></CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fpyMetrics?.totalOperations || 0}</div>
                  <p className="text-xs text-muted-foreground">Kitting operations</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">First Pass Yield</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(fpyMetrics?.firstPassYield || 0) >= 0.95 ? 'text-green-600' : 
                    (fpyMetrics?.firstPassYield || 0) >= 0.85 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {formatPercentage(fpyMetrics?.firstPassYield || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Quality rate target: 95%</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Quality Trend</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {fpyMetrics?.qualityTrends?.length ? 
                      fpyMetrics.qualityTrends[fpyMetrics.qualityTrends.length - 1]?.fpy ? 
                        formatPercentage(fpyMetrics.qualityTrends[fpyMetrics.qualityTrends.length - 1].fpy) : 
                        'N/A' : 
                      'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">Latest daily FPY</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}