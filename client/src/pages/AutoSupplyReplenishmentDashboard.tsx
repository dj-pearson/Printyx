import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Package, AlertCircle, TrendingUp, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/**
 * Auto-Supply Replenishment Dashboard
 *
 * AI-powered automated supply monitoring and ordering system
 * Prevents stockouts and emergency orders through predictive analytics
 */

export default function AutoSupplyReplenishmentDashboard() {
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/auto-supply-replenishment/dashboard'],
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  // Fetch low supplies
  const { data: lowSupplies, isLoading: lowSuppliesLoading } = useQuery({
    queryKey: ['/api/auto-supply-replenishment/low-supplies'],
  });

  // Fetch recent orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/auto-supply-replenishment/orders'],
  });

  // Analyze all supplies mutation
  const analyzeAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auto-supply-replenishment/analyze-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Analysis failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Analysis Complete',
        description: `Analyzed ${data.analyzed} supplies. Created ${data.ordersCreated} automatic orders.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-supply-replenishment/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-supply-replenishment/low-supplies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-supply-replenishment/orders'] });
      setIsAnalyzing(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsAnalyzing(false);
    },
  });

  const handleAnalyzeAll = () => {
    setIsAnalyzing(true);
    analyzeAllMutation.mutate();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'destructive';
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getSupplyLevelColor = (level: number) => {
    if (level <= 10) return 'text-red-600';
    if (level <= 20) return 'text-orange-600';
    if (level <= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auto-Supply Replenishment</h1>
          <p className="text-muted-foreground">
            AI-powered supply monitoring and automated ordering
          </p>
        </div>
        <Button onClick={handleAnalyzeAll} disabled={isAnalyzing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing...' : 'Analyze All Supplies'}
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devices Monitored</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.devicesMonitored || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.suppliesTracked || 0} supplies tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Supplies</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics?.lowSupplies || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.urgentOrders || 0} urgent orders pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${metrics?.projectedSavings?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.emergenciesPrevented || 0} emergencies prevented
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Lead Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.averageLeadTime?.toFixed(1) || '0'} days
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.ordersThisMonth || 0} orders this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="low-supplies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="low-supplies">Low Supplies</TabsTrigger>
          <TabsTrigger value="orders">Recent Orders</TabsTrigger>
          <TabsTrigger value="all-supplies">All Supplies</TabsTrigger>
        </TabsList>

        {/* Low Supplies Tab */}
        <TabsContent value="low-supplies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Low Supply Alerts</CardTitle>
              <CardDescription>
                Supplies below reorder threshold requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowSuppliesLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : !lowSupplies || lowSupplies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                  <p>All supplies are at healthy levels</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Supply</TableHead>
                      <TableHead>Current Level</TableHead>
                      <TableHead>Days Until Empty</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowSupplies.map((supply: any) => (
                      <TableRow key={supply.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{supply.model}</div>
                            <div className="text-sm text-muted-foreground">
                              {supply.serialNumber}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{supply.supplyName}</div>
                            <div className="text-sm text-muted-foreground">{supply.supplyType}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div
                              className={`font-bold ${getSupplyLevelColor(supply.currentLevel)}`}
                            >
                              {supply.currentLevel}%
                            </div>
                            <Progress value={supply.currentLevel} className="w-20" />
                          </div>
                        </TableCell>
                        <TableCell>
                          {supply.daysUntilDepletion !== null
                            ? `${supply.daysUntilDepletion} days`
                            : 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityColor(supply.priority)}>
                            {supply.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{supply.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Automatically generated supply orders</CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : !orders || orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No orders yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Supply</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Est. Delivery</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm text-muted-foreground">
                              {order.serialNumber}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.supplyName}</div>
                            {order.partNumber && (
                              <div className="text-sm text-muted-foreground">
                                {order.partNumber}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{order.quantity}</TableCell>
                        <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {order.estimatedDeliveryDate
                            ? new Date(order.estimatedDeliveryDate).toLocaleDateString()
                            : 'TBD'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Supplies Tab */}
        <TabsContent value="all-supplies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Monitored Supplies</CardTitle>
              <CardDescription>Complete overview of all supplies being tracked</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Coming soon: Full supply inventory with filtering and search
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
