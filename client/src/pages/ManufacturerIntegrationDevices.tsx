import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Smartphone,
  Printer,
  Activity,
  Wifi,
  WifiOff,
  AlertCircle,
  Settings,
  BarChart3,
  MapPin,
  Clock,
  Download,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';

interface Device {
  device: {
    id: string;
    deviceId: string;
    deviceName: string;
    model: string;
    serialNumber: string;
    ipAddress: string;
    location: string;
    department: string;
    status: 'online' | 'offline' | 'error' | 'maintenance' | 'unknown';
    lastSeen: string;
    registeredAt: string;
  };
  integration: {
    id: string;
    manufacturer: string;
    integrationName: string;
    status: string;
  };
}

interface DeviceMetric {
  id: string;
  collectionTimestamp: string;
  totalImpressions: number;
  bwImpressions: number;
  colorImpressions: number;
  deviceStatus: string;
  tonerLevels: Record<string, number>;
  paperLevels: Record<string, number>;
  responseTime: number;
}

export default function ManufacturerIntegrationDevices() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isMetricsDialogOpen, setIsMetricsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: devices = [], isLoading } = useQuery<Device[]>({
    queryKey: ['/api/devices'],
    refetchInterval: 30000,
  });

  const { data: deviceMetrics = [] } = useQuery<DeviceMetric[]>({
    queryKey: ['/api/devices', selectedDevice?.device.id, 'metrics'],
    enabled: !!selectedDevice,
    refetchInterval: 60000,
  });

  const collectMetricsMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const response = await fetch(`/api/devices/${deviceId}/collect`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to collect metrics');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({ title: 'Metrics collected successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to collect metrics', variant: 'destructive' });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <Wifi className="h-4 w-4 text-green-600" />;
      case 'offline': return <WifiOff className="h-4 w-4 text-gray-600" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'maintenance': return <Settings className="h-4 w-4 text-yellow-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.device.deviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          device.device.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          device.device.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          device.device.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || device.device.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const deviceStatusCounts = devices.reduce((acc, device) => {
    acc[device.device.status] = (acc[device.device.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Smartphone className="h-8 w-8" />
            Device Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage all registered devices across manufacturer integrations
          </p>
        </div>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/devices'] })}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Wifi className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{deviceStatusCounts.online || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <WifiOff className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{deviceStatusCounts.offline || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{deviceStatusCounts.error || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Settings className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{deviceStatusCounts.maintenance || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Devices
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Devices</CardTitle>
          <CardDescription>
            {filteredDevices.length} of {devices.length} devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDevices.map((device) => (
                <TableRow key={device.device.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <Printer className="h-4 w-4" />
                        {device.device.deviceName || device.device.deviceId}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {device.device.model} • {device.device.serialNumber}
                      </div>
                      {device.device.ipAddress && (
                        <div className="text-xs text-muted-foreground">
                          {device.device.ipAddress}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium capitalize">{device.integration.manufacturer}</div>
                      <div className="text-sm text-muted-foreground">{device.integration.integrationName}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(device.device.status)}>
                      {getStatusIcon(device.device.status)}
                      <span className="ml-1 capitalize">{device.device.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span>{device.device.location || 'Not specified'}</span>
                    </div>
                    {device.device.department && (
                      <div className="text-sm text-muted-foreground">{device.device.department}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">
                        {device.device.lastSeen 
                          ? new Date(device.device.lastSeen).toLocaleString()
                          : 'Never'
                        }
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => collectMetricsMutation.mutate(device.device.id)}
                        disabled={collectMetricsMutation.isPending}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Dialog open={isMetricsDialogOpen} onOpenChange={setIsMetricsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDevice(device)}
                          >
                            <BarChart3 className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Device Metrics - {selectedDevice?.device.deviceName}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {deviceMetrics.length === 0 ? (
                              <div className="text-center py-8">
                                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">No metrics available for this device</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-3">
                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm">Latest Total Impressions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="text-2xl font-bold">
                                        {deviceMetrics[0]?.totalImpressions?.toLocaleString() || 0}
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm">B&W Impressions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="text-2xl font-bold">
                                        {deviceMetrics[0]?.bwImpressions?.toLocaleString() || 0}
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm">Color Impressions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="text-2xl font-bold">
                                        {deviceMetrics[0]?.colorImpressions?.toLocaleString() || 0}
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                                
                                <div className="border rounded-lg p-4">
                                  <h4 className="font-semibold mb-2">Recent Metrics</h4>
                                  <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {deviceMetrics.slice(0, 10).map((metric) => (
                                      <div key={metric.id} className="flex justify-between items-center text-sm border-b pb-2">
                                        <span>{new Date(metric.collectionTimestamp).toLocaleString()}</span>
                                        <div className="flex gap-4">
                                          <span>Total: {metric.totalImpressions?.toLocaleString() || 0}</span>
                                          <span>B&W: {metric.bwImpressions?.toLocaleString() || 0}</span>
                                          <span>Color: {metric.colorImpressions?.toLocaleString() || 0}</span>
                                          <span>{metric.responseTime}ms</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}