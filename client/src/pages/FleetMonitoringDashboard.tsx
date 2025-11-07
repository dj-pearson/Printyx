import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Wifi,
  WifiOff,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Printer,
  Droplets,
  TrendingUp,
  Search,
  Eye,
  Package,
  Bell,
  BellOff,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface FleetDashboard {
  summary: {
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    devicesWithAlerts: number;
    criticalAlerts: number;
    averageUptime: number;
    fleetUtilization: number;
  };
  statusDistribution: {
    online: number;
    offline: number;
    warning: number;
    critical: number;
  };
  impressions: {
    totalBW: number;
    totalColor: number;
  };
  tonerAlerts: Array<{
    deviceId: string;
    deviceName: string;
    serialNumber: string;
    color: string;
    level: number;
    severity: 'critical' | 'warning';
    message: string;
  }>;
  topDevicesNeedingAttention: Array<{
    deviceId: string;
    deviceName: string;
    serialNumber: string;
    issues: string[];
    priority: string;
  }>;
}

interface DeviceWithMetrics {
  id: string;
  deviceName: string;
  serialNumber: string;
  model: string;
  ipAddress: string;
  status: string;
  lastSeen: Date;
  currentMetrics: {
    tonerLevels: { [key: string]: number };
    paperLevels: { [key: string]: number };
    totalImpressions: number;
    bwImpressions: number;
    colorImpressions: number;
    deviceStatus: string;
    collectionTimestamp: Date;
  } | null;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'online':
      return 'bg-green-100 text-green-800';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800';
    case 'critical':
      return 'bg-red-100 text-red-800';
    case 'offline':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'online':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'critical':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'offline':
      return <WifiOff className="h-4 w-4 text-gray-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const getTonerColor = (color: string) => {
  switch (color.toLowerCase()) {
    case 'black':
      return '#000000';
    case 'cyan':
      return '#00FFFF';
    case 'magenta':
      return '#FF00FF';
    case 'yellow':
      return '#FFFF00';
    default:
      return '#666666';
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200';
  }
};

export default function FleetMonitoringDashboard() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60000); // 60 seconds
  const [orderTonerDevice, setOrderTonerDevice] = useState<DeviceWithMetrics | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/devices'] });
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, queryClient]);

  // Fetch fleet dashboard
  const {
    data: fleetDashboard,
    isLoading: dashboardLoading,
    refetch: refetchDashboard,
  } = useQuery<FleetDashboard>({
    queryKey: ['/api/fleet/dashboard'],
  });

  // Fetch fleet devices
  const {
    data: devices = [],
    isLoading: devicesLoading,
    refetch: refetchDevices,
  } = useQuery<DeviceWithMetrics[]>({
    queryKey: ['/api/fleet/devices', searchQuery],
    select: (data: any[]) =>
      data.map((device) => ({
        ...device,
        lastSeen: new Date(device.lastSeen),
        currentMetrics: device.currentMetrics
          ? {
              ...device.currentMetrics,
              collectionTimestamp: new Date(device.currentMetrics.collectionTimestamp),
            }
          : null,
      })),
  });

  // Fetch device metrics history
  const { data: deviceMetrics } = useQuery({
    queryKey: ['/api/fleet/devices', selectedDevice, 'metrics'],
    enabled: !!selectedDevice,
  });

  // Order toner mutation
  const orderTonerMutation = useMutation({
    mutationFn: (data: { deviceId: string; colors: string[]; urgent: boolean; notes?: string }) =>
      apiRequest(`/api/devices/${data.deviceId}/order-toner`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fleet/devices'] });
      toast({
        title: 'Toner Order Placed',
        description: 'Toner order has been triggered successfully.',
      });
      setOrderTonerDevice(null);
      setSelectedColors([]);
    },
  });

  const handleOrderToner = (urgent: boolean = false) => {
    if (!orderTonerDevice || selectedColors.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one toner color',
        variant: 'destructive',
      });
      return;
    }

    orderTonerMutation.mutate({
      deviceId: orderTonerDevice.id,
      colors: selectedColors,
      urgent,
    });
  };

  const handleRefreshAll = () => {
    refetchDashboard();
    refetchDevices();
    toast({
      title: 'Refreshing',
      description: 'Fleet data is being refreshed...',
    });
  };

  if (dashboardLoading || devicesLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading fleet monitoring data...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const filteredDevices = devices.filter(
    (device) =>
      device.deviceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.model?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fleet Monitoring Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Real-time monitoring of all devices with toner level alerts
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="auto-refresh">Auto Refresh</Label>
              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="flex items-center gap-1"
              >
                {autoRefresh ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                {autoRefresh ? 'On' : 'Off'}
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={handleRefreshAll}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Fleet Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Printer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fleetDashboard?.summary.totalDevices || 0}</div>
              <p className="text-xs text-muted-foreground">
                {fleetDashboard?.summary.onlineDevices || 0} online,{' '}
                {fleetDashboard?.summary.offlineDevices || 0} offline
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Device Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {fleetDashboard?.summary.onlineDevices || 0}
              </div>
              <p className="text-xs text-muted-foreground">Online and operational</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {fleetDashboard?.summary.criticalAlerts || 0}
              </div>
              <p className="text-xs text-muted-foreground">Require immediate attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fleet Utilization</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {fleetDashboard?.summary.fleetUtilization?.toFixed(1) || 0}%
              </div>
              <Progress value={fleetDashboard?.summary.fleetUtilization || 0} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="devices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="devices">All Devices</TabsTrigger>
            <TabsTrigger value="alerts">
              Toner Alerts
              {fleetDashboard && fleetDashboard.tonerAlerts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {fleetDashboard.tonerAlerts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="usage">Usage Stats</TabsTrigger>
          </TabsList>

          {/* All Devices Tab */}
          <TabsContent value="devices" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Monitored Devices</CardTitle>
                    <CardDescription>View and manage all monitored printers</CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search devices..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredDevices.map((device) => (
                    <Card key={device.id} className="border">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0">{getStatusIcon(device.status)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold">{device.deviceName}</h3>
                                <Badge className={getStatusColor(device.status)}>
                                  {device.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600">
                                {device.model} • SN: {device.serialNumber}
                              </p>
                              <p className="text-xs text-gray-500">
                                IP: {device.ipAddress} • Last seen:{' '}
                                {format(device.lastSeen, 'PPpp')}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedDevice(device.id)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>{device.deviceName}</DialogTitle>
                                  <DialogDescription>
                                    Detailed metrics and history
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-semibold mb-2">Device Information</h4>
                                    <dl className="grid grid-cols-2 gap-2 text-sm">
                                      <dt className="text-gray-600">Model:</dt>
                                      <dd>{device.model}</dd>
                                      <dt className="text-gray-600">Serial Number:</dt>
                                      <dd>{device.serialNumber}</dd>
                                      <dt className="text-gray-600">IP Address:</dt>
                                      <dd>{device.ipAddress}</dd>
                                    </dl>
                                  </div>
                                  {device.currentMetrics && (
                                    <>
                                      <div>
                                        <h4 className="font-semibold mb-2">Current Metrics</h4>
                                        <dl className="grid grid-cols-2 gap-2 text-sm">
                                          <dt className="text-gray-600">Total Impressions:</dt>
                                          <dd>
                                            {device.currentMetrics.totalImpressions?.toLocaleString()}
                                          </dd>
                                          <dt className="text-gray-600">B&W Impressions:</dt>
                                          <dd>
                                            {device.currentMetrics.bwImpressions?.toLocaleString()}
                                          </dd>
                                          <dt className="text-gray-600">Color Impressions:</dt>
                                          <dd>
                                            {device.currentMetrics.colorImpressions?.toLocaleString()}
                                          </dd>
                                        </dl>
                                      </div>
                                      <div>
                                        <h4 className="font-semibold mb-2">Toner Levels</h4>
                                        <div className="space-y-2">
                                          {Object.entries(
                                            device.currentMetrics.tonerLevels || {},
                                          ).map(([color, level]) => (
                                            <div key={color}>
                                              <div className="flex justify-between text-sm mb-1">
                                                <span className="capitalize">{color}</span>
                                                <span>{level}%</span>
                                              </div>
                                              <Progress value={level} className="h-2" />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setOrderTonerDevice(device)}
                            >
                              <Package className="h-4 w-4 mr-1" />
                              Order Toner
                            </Button>
                          </div>
                        </div>

                        {/* Toner Levels */}
                        {device.currentMetrics?.tonerLevels && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {Object.entries(device.currentMetrics.tonerLevels).map(
                                ([color, level]) => (
                                  <div key={color}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Droplets
                                        className="h-4 w-4"
                                        style={{ color: getTonerColor(color) }}
                                      />
                                      <span className="text-sm font-medium capitalize">
                                        {color}
                                      </span>
                                    </div>
                                    <Progress
                                      value={level}
                                      className={`h-2 ${level <= 10 ? 'bg-red-200' : level <= 20 ? 'bg-yellow-200' : ''}`}
                                    />
                                    <span className="text-xs text-gray-600">{level}%</span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {filteredDevices.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Printer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No devices found matching your search.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Toner Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Toner Level Alerts</CardTitle>
                <CardDescription>Devices requiring toner replenishment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fleetDashboard?.tonerAlerts.map((alert, index) => (
                    <Card
                      key={`${alert.deviceId}-${alert.color}-${index}`}
                      className={`border ${getSeverityColor(alert.severity)}`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <AlertTriangle
                              className={`h-5 w-5 ${alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'}`}
                            />
                            <div>
                              <h4 className="font-semibold">{alert.deviceName}</h4>
                              <p className="text-sm text-gray-600">{alert.message}</p>
                              <p className="text-xs text-gray-500 mt-1">SN: {alert.serialNumber}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={alert.severity === 'critical' ? 'default' : 'outline'}
                            onClick={() => {
                              const device = devices.find((d) => d.id === alert.deviceId);
                              if (device) {
                                setOrderTonerDevice(device);
                                setSelectedColors([alert.color]);
                              }
                            }}
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Order Now
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {(!fleetDashboard?.tonerAlerts || fleetDashboard.tonerAlerts.length === 0) && (
                    <div className="text-center py-12 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                      <p>No toner alerts at this time. All devices have adequate toner levels.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage Stats Tab */}
          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Fleet Usage Statistics</CardTitle>
                <CardDescription>Total impressions across all devices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Total B&W Impressions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {fleetDashboard?.impressions.totalBW?.toLocaleString() || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Total Color Impressions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {fleetDashboard?.impressions.totalColor?.toLocaleString() || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Order Toner Dialog */}
        <Dialog
          open={!!orderTonerDevice}
          onOpenChange={(open) => !open && setOrderTonerDevice(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Order Toner</DialogTitle>
              <DialogDescription>
                Select toner colors to order for {orderTonerDevice?.deviceName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {orderTonerDevice?.currentMetrics?.tonerLevels &&
                Object.entries(orderTonerDevice.currentMetrics.tonerLevels).map(
                  ([color, level]) => (
                    <div key={color} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedColors.includes(color)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedColors([...selectedColors, color]);
                            } else {
                              setSelectedColors(selectedColors.filter((c) => c !== color));
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <Droplets className="h-4 w-4" style={{ color: getTonerColor(color) }} />
                        <span className="capitalize font-medium">{color}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={level} className="w-24 h-2" />
                        <span className="text-sm text-gray-600">{level}%</span>
                      </div>
                    </div>
                  ),
                )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOrderTonerDevice(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleOrderToner(false)}
                disabled={selectedColors.length === 0}
              >
                <Package className="h-4 w-4 mr-2" />
                Order Toner
              </Button>
              <Button
                onClick={() => handleOrderToner(true)}
                disabled={selectedColors.length === 0}
                variant="default"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Urgent Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
