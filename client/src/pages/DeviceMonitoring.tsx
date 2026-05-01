import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Printer,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  TrendingUp,
  Activity,
  Zap,
  ShoppingCart,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DeviceMetric {
  id: number;
  serialNumber: string;
  ipAddress: string;
  manufacturer?: string;
  model?: string;
  deviceName?: string;
  tonerBlack?: number;
  tonerCyan?: number;
  tonerMagenta?: number;
  tonerYellow?: number;
  paperTray1?: number;
  paperTray2?: number;
  paperTray3?: number;
  totalImpressions?: number;
  bwImpressions?: number;
  colorImpressions?: number;
  deviceStatus: 'online' | 'offline' | 'error' | 'maintenance' | 'warning';
  errorCodes?: string[];
  collectionTimestamp: string;
}

interface TonerAlert {
  id: string;
  serialNumber: string;
  deviceName?: string | null;
  alertType: string;
  supplyType: string;
  currentLevel: number;
  threshold: number;
  status: 'active' | 'acknowledged' | 'snoozed' | 'resolved';
  message?: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  snoozedUntil?: string | null;
  resolvedAt?: string | null;
  firstSeenAt?: string;
  lastSeenAt?: string;
  createdAt: string;
}

export default function DeviceMonitoring() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const alertActionMutation = useMutation({
    mutationFn: async ({
      alertId,
      action,
      hours,
    }: {
      alertId: string;
      action: 'acknowledge' | 'snooze' | 'resolve';
      hours?: number;
    }) => {
      const body = action === 'snooze' ? JSON.stringify({ hours }) : undefined;
      const response = await fetch(`/api/device-monitoring/alerts/${alertId}/${action}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Failed to ${action} alert`);
      }
      return response.json();
    },
    onSuccess: (_data, vars) => {
      const labels = {
        acknowledge: 'Acknowledged',
        snooze: `Snoozed for ${vars.hours || 4}h`,
        resolve: 'Resolved',
      } as const;
      toast({ title: 'Alert updated', description: labels[vars.action] });
      queryClient.invalidateQueries({ queryKey: ['/api/device-monitoring/active-alerts'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not update alert',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Fetch latest metrics for all devices
  const { data: metricsData, isLoading } = useQuery<{ metrics: DeviceMetric[] }>({
    queryKey: ['/api/device-monitoring/latest-metrics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch active alerts
  const { data: alertsData } = useQuery<{ alerts: TonerAlert[] }>({
    queryKey: ['/api/device-monitoring/active-alerts'],
    refetchInterval: 30000,
  });

  // Get unique devices (most recent metric per device)
  const getUniqueDevices = (metrics: DeviceMetric[] | undefined): DeviceMetric[] => {
    if (!metrics) return [];

    const deviceMap = new Map<string, DeviceMetric>();

    // Sort by timestamp descending and take the most recent for each device
    metrics
      .sort(
        (a, b) =>
          new Date(b.collectionTimestamp).getTime() - new Date(a.collectionTimestamp).getTime(),
      )
      .forEach((metric) => {
        if (!deviceMap.has(metric.serialNumber)) {
          deviceMap.set(metric.serialNumber, metric);
        }
      });

    return Array.from(deviceMap.values());
  };

  const devices = getUniqueDevices(metricsData?.metrics);
  const alerts = alertsData?.alerts || [];

  // Filter devices based on search and status
  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.deviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.ipAddress.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || device.deviceStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: devices.length,
    online: devices.filter((d) => d.deviceStatus === 'online').length,
    offline: devices.filter((d) => d.deviceStatus === 'offline').length,
    warning: devices.filter((d) => d.deviceStatus === 'warning' || d.deviceStatus === 'error')
      .length,
    alerts: alerts.length,
    totalImpressions: devices.reduce((sum, d) => sum + (d.totalImpressions || 0), 0),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'offline':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'maintenance':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4" />;
      case 'offline':
        return <XCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      case 'error':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTonerColor = (color: string) => {
    switch (color) {
      case 'black':
        return 'bg-gray-800';
      case 'cyan':
        return 'bg-cyan-500';
      case 'magenta':
        return 'bg-pink-500';
      case 'yellow':
        return 'bg-yellow-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getTonerLevelColor = (level: number | undefined) => {
    if (level === undefined) return 'bg-gray-300';
    if (level <= 15) return 'bg-red-500';
    if (level <= 30) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const TonerBar = ({ color, level }: { color: string; level?: number }) => {
    const displayLevel = level ?? 0;
    const colorClass = getTonerColor(color);
    const levelColorClass = getTonerLevelColor(level);

    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1">
            <div className={`h-3 w-3 rounded ${colorClass}`}></div>
            <span className="capitalize">{color}</span>
          </div>
          <span className="font-medium">{level !== undefined ? `${displayLevel}%` : 'N/A'}</span>
        </div>
        <Progress value={displayLevel} className="h-2" indicatorClassName={levelColorClass} />
      </div>
    );
  };

  const DeviceCard = ({ device }: { device: DeviceMetric }) => {
    const deviceAlerts = alerts.filter((a) => a.serialNumber === device.serialNumber);

    return (
      <Card
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => setSelectedDevice(device.serialNumber)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-gray-600" />
              <div>
                <CardTitle className="text-base">
                  {device.deviceName || device.serialNumber}
                </CardTitle>
                <CardDescription className="text-xs">
                  {device.manufacturer} {device.model}
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`flex items-center gap-1 ${getStatusColor(device.deviceStatus)}`}
            >
              {getStatusIcon(device.deviceStatus)}
              {device.deviceStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toner Levels */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase">Toner Levels</div>
            <TonerBar color="black" level={device.tonerBlack} />
            <TonerBar color="cyan" level={device.tonerCyan} />
            <TonerBar color="magenta" level={device.tonerMagenta} />
            <TonerBar color="yellow" level={device.tonerYellow} />
          </div>

          {/* Alerts */}
          {deviceAlerts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 space-y-1">
              {deviceAlerts.slice(0, 2).map((alert) => (
                <div key={alert.id} className="flex items-center gap-2 text-xs text-red-800">
                  <AlertCircle className="h-3 w-3" />
                  <span>
                    {alert.supplyType.toUpperCase()} at {alert.currentLevel}%
                  </span>
                </div>
              ))}
              {deviceAlerts.length > 2 && (
                <div className="text-xs text-red-600">+{deviceAlerts.length - 2} more alerts</div>
              )}
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-gray-500">Total Prints</div>
              <div className="font-medium">
                {device.totalImpressions?.toLocaleString() || 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">IP Address</div>
              <div className="font-medium font-mono">{device.ipAddress}</div>
            </div>
          </div>

          {/* Last Updated */}
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Updated {formatDistanceToNow(new Date(device.collectionTimestamp), { addSuffix: true })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Device Monitoring</h1>
          <p className="text-gray-500 mt-1">Real-time printer status and supply levels</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Devices
              <Printer className="h-4 w-4 text-gray-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Online
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.online}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0}% uptime
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Offline
              <XCircle className="h-4 w-4 text-gray-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.offline}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Active Alerts
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.alerts}</div>
            <p className="text-xs text-gray-500 mt-1">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Prints
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.totalImpressions / 1000000).toFixed(1)}M
            </div>
            <p className="text-xs text-gray-500 mt-1">All devices</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by serial number, name, manufacturer, model, or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('cards')}
              >
                Cards
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                Table
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Device List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <Activity className="h-8 w-8 animate-pulse mx-auto mb-2" />
              Loading device data...
            </div>
          </CardContent>
        </Card>
      ) : filteredDevices.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Printer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No Devices Found' : 'No Devices Yet'}
              </h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Devices will appear here once monitoring clients start reporting metrics'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => (
            <DeviceCard key={device.serialNumber} device={device} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Toner (B/C/M/Y)</TableHead>
                  <TableHead>Prints</TableHead>
                  <TableHead>Alerts</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device) => {
                  const deviceAlerts = alerts.filter((a) => a.serialNumber === device.serialNumber);

                  return (
                    <TableRow
                      key={device.serialNumber}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedDevice(device.serialNumber)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {device.deviceName || device.serialNumber}
                          </div>
                          <div className="text-xs text-gray-500">
                            {device.manufacturer} {device.model}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${getStatusColor(device.deviceStatus)}`}
                        >
                          {device.deviceStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 text-xs">
                          <span
                            className={
                              device.tonerBlack && device.tonerBlack <= 15
                                ? 'text-red-600 font-bold'
                                : ''
                            }
                          >
                            {device.tonerBlack ?? '-'}%
                          </span>
                          <span
                            className={
                              device.tonerCyan && device.tonerCyan <= 15
                                ? 'text-red-600 font-bold'
                                : ''
                            }
                          >
                            {device.tonerCyan ?? '-'}%
                          </span>
                          <span
                            className={
                              device.tonerMagenta && device.tonerMagenta <= 15
                                ? 'text-red-600 font-bold'
                                : ''
                            }
                          >
                            {device.tonerMagenta ?? '-'}%
                          </span>
                          <span
                            className={
                              device.tonerYellow && device.tonerYellow <= 15
                                ? 'text-red-600 font-bold'
                                : ''
                            }
                          >
                            {device.tonerYellow ?? '-'}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {device.totalImpressions?.toLocaleString() || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {deviceAlerts.length > 0 ? (
                          <Badge variant="destructive">{deviceAlerts.length}</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(device.collectionTimestamp), {
                          addSuffix: true,
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Device Details Dialog */}
      {selectedDevice && (
        <Dialog open={!!selectedDevice} onOpenChange={() => setSelectedDevice(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            {(() => {
              const device = devices.find((d) => d.serialNumber === selectedDevice);
              if (!device) return null;

              const deviceAlerts = alerts.filter((a) => a.serialNumber === device.serialNumber);

              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Printer className="h-5 w-5" />
                      {device.deviceName || device.serialNumber}
                    </DialogTitle>
                    <DialogDescription>
                      {device.manufacturer} {device.model} • {device.ipAddress}
                    </DialogDescription>
                  </DialogHeader>

                  <Tabs defaultValue="overview" className="mt-4">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="supplies">Supplies</TabsTrigger>
                      <TabsTrigger value="alerts">Alerts ({deviceAlerts.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Device Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-gray-500">Serial Number</div>
                            <div className="font-medium">{device.serialNumber}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">IP Address</div>
                            <div className="font-medium font-mono">{device.ipAddress}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Manufacturer</div>
                            <div className="font-medium">{device.manufacturer || 'Unknown'}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Model</div>
                            <div className="font-medium">{device.model || 'Unknown'}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Status</div>
                            <Badge
                              variant="outline"
                              className={getStatusColor(device.deviceStatus)}
                            >
                              {device.deviceStatus}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Last Updated</div>
                            <div className="font-medium">
                              {format(new Date(device.collectionTimestamp), 'PPp')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Meter Readings</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-sm text-gray-500">Total Impressions</div>
                            <div className="text-2xl font-bold">
                              {device.totalImpressions?.toLocaleString() || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">B&W Impressions</div>
                            <div className="text-2xl font-bold">
                              {device.bwImpressions?.toLocaleString() || 'N/A'}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Color Impressions</div>
                            <div className="text-2xl font-bold">
                              {device.colorImpressions?.toLocaleString() || 'N/A'}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="supplies" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Toner Levels</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <TonerBar color="black" level={device.tonerBlack} />
                          <TonerBar color="cyan" level={device.tonerCyan} />
                          <TonerBar color="magenta" level={device.tonerMagenta} />
                          <TonerBar color="yellow" level={device.tonerYellow} />
                        </CardContent>
                      </Card>

                      {(device.paperTray1 !== undefined ||
                        device.paperTray2 !== undefined ||
                        device.paperTray3 !== undefined) && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Paper Levels</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {device.paperTray1 !== undefined && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span>Tray 1</span>
                                  <span className="font-medium">{device.paperTray1}%</span>
                                </div>
                                <Progress value={device.paperTray1} className="h-2" />
                              </div>
                            )}
                            {device.paperTray2 !== undefined && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span>Tray 2</span>
                                  <span className="font-medium">{device.paperTray2}%</span>
                                </div>
                                <Progress value={device.paperTray2} className="h-2" />
                              </div>
                            )}
                            {device.paperTray3 !== undefined && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span>Tray 3</span>
                                  <span className="font-medium">{device.paperTray3}%</span>
                                </div>
                                <Progress value={device.paperTray3} className="h-2" />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      <Button className="w-full">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Order Supplies
                      </Button>
                    </TabsContent>

                    <TabsContent value="alerts" className="space-y-2">
                      {deviceAlerts.length === 0 ? (
                        <Card>
                          <CardContent className="py-12">
                            <div className="text-center">
                              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                              <p className="text-gray-500">No active alerts for this device</p>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        deviceAlerts.map((alert) => {
                          const isAcked = alert.status === 'acknowledged';
                          const isSnoozed =
                            alert.status === 'snoozed' &&
                            alert.snoozedUntil &&
                            new Date(alert.snoozedUntil) > new Date();
                          const cardClass = isSnoozed
                            ? 'border-gray-200 bg-gray-50'
                            : isAcked
                              ? 'border-yellow-200 bg-yellow-50'
                              : 'border-red-200 bg-red-50';
                          return (
                            <Card key={alert.id} className={cardClass}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <AlertCircle className="h-4 w-4 text-red-600" />
                                      <span className="font-medium text-red-900">
                                        {alert.supplyType.toUpperCase()} -{' '}
                                        {alert.alertType.replace('_', ' ')}
                                      </span>
                                      {isAcked && (
                                        <Badge variant="outline" className="text-yellow-800">
                                          Acknowledged
                                        </Badge>
                                      )}
                                      {isSnoozed && (
                                        <Badge variant="outline" className="text-gray-600">
                                          Snoozed{' '}
                                          {alert.snoozedUntil
                                            ? `until ${formatDistanceToNow(new Date(alert.snoozedUntil), { addSuffix: true })}`
                                            : ''}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-red-800">
                                      Current level: {alert.currentLevel}% (threshold:{' '}
                                      {alert.threshold}%)
                                    </p>
                                    <p className="text-xs text-red-600 mt-2">
                                      Last seen{' '}
                                      {formatDistanceToNow(
                                        new Date(alert.lastSeenAt || alert.createdAt),
                                        { addSuffix: true },
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex flex-col gap-1 shrink-0">
                                    {!isAcked && !isSnoozed && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          alertActionMutation.mutate({
                                            alertId: alert.id,
                                            action: 'acknowledge',
                                          })
                                        }
                                      >
                                        Acknowledge
                                      </Button>
                                    )}
                                    {!isSnoozed && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          alertActionMutation.mutate({
                                            alertId: alert.id,
                                            action: 'snooze',
                                            hours: 4,
                                          })
                                        }
                                      >
                                        Snooze 4h
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        alertActionMutation.mutate({
                                          alertId: alert.id,
                                          action: 'resolve',
                                        })
                                      }
                                    >
                                      Resolve
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
