import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, Wifi, Monitor, AlertTriangle, CheckCircle, Clock, Activity,
  TrendingUp, TrendingDown, Battery, Signal, Thermometer, Droplets,
  Settings, Filter, Download, Eye, Bell, Wrench, BarChart3, Zap,
  Router, Smartphone, Laptop, Calendar, Users, Target
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// Types
type IoTDevice = {
  id: string;
  device_id: string;
  device_name: string;
  device_type: string;
  manufacturer: string;
  model: string;
  device_status: string;
  last_ping_time?: string;
  last_data_received?: string;
  connection_type: string;
  ip_address?: string;
  battery_level?: number;
  signal_strength?: number;
  customer_name?: string;
  installation_location?: string;
  created_at: string;
};

type EquipmentStatus = {
  id: string;
  equipment_id: string;
  device_name?: string;
  operational_status: string;
  power_status?: string;
  connectivity_status?: string;
  current_job_count: number;
  total_page_count: number;
  error_count: number;
  toner_levels?: any;
  temperature?: number;
  humidity?: number;
  uptime_percentage?: number;
  status_timestamp: string;
};

type PredictiveAlert = {
  id: string;
  alert_id: string;
  device_name?: string;
  alert_type: string;
  alert_category: string;
  severity: string;
  alert_title: string;
  alert_description: string;
  failure_probability?: number;
  time_to_failure_days?: number;
  confidence_score?: number;
  alert_status: string;
  customer_name?: string;
  business_impact_level?: string;
  created_at: string;
};

type PerformanceTrend = {
  id: string;
  device_name?: string;
  analysis_period_start: string;
  analysis_period_end: string;
  analysis_type: string;
  average_uptime_percentage?: number;
  total_pages_processed: number;
  performance_trend: string;
  reliability_score?: number;
  failure_risk_score?: number;
  peer_performance_percentile?: number;
  created_at: string;
};

type MonitoringMetrics = {
  totalDevices: number;
  onlineDevices: number;
  activeAlerts: number;
  criticalAlerts: number;
  averageUptime: number;
  devicesRequiringAttention: number;
};

// Form Schemas
const deviceSchema = z.object({
  device_name: z.string().min(3, "Device name required"),
  device_type: z.enum(['printer', 'copier', 'scanner', 'mfp', 'sensor']),
  manufacturer: z.string().min(2, "Manufacturer required"),
  model: z.string().min(2, "Model required"),
  device_serial_number: z.string().min(5, "Serial number required"),
  connection_type: z.enum(['ethernet', 'wifi', 'cellular', 'hybrid']),
  customer_id: z.string().optional(),
  installation_location: z.string().min(5, "Location required"),
  ip_address: z.string().optional(),
  monitoring_enabled: z.boolean(),
  data_collection_interval: z.number().min(60).max(3600),
});

type DeviceForm = z.infer<typeof deviceSchema>;

export default function RemoteMonitoring() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  
  const queryClient = useQueryClient();

  // Fetch monitoring metrics
  const { data: metrics } = useQuery<MonitoringMetrics>({
    queryKey: ["/api/monitoring/metrics"],
  });

  // Fetch IoT devices
  const { data: devices = [], isLoading: devicesLoading } = useQuery<IoTDevice[]>({
    queryKey: ["/api/monitoring/devices", selectedDeviceType, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDeviceType !== "all") params.append("type", selectedDeviceType);
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      return await apiRequest(`/api/monitoring/devices?${params.toString()}`);
    },
  });

  // Fetch equipment status
  const { data: equipmentStatus = [], isLoading: statusLoading } = useQuery<EquipmentStatus[]>({
    queryKey: ["/api/monitoring/equipment-status"],
  });

  // Fetch predictive alerts
  const { data: alerts = [], isLoading: alertsLoading } = useQuery<PredictiveAlert[]>({
    queryKey: ["/api/monitoring/alerts", selectedSeverity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSeverity !== "all") params.append("severity", selectedSeverity);
      return await apiRequest(`/api/monitoring/alerts?${params.toString()}`);
    },
  });

  // Fetch performance trends
  const { data: trends = [], isLoading: trendsLoading } = useQuery<PerformanceTrend[]>({
    queryKey: ["/api/monitoring/trends"],
  });

  // Fetch customers for dropdown
  const { data: businessRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/business-records"],
  });

  // Register device mutation
  const registerDeviceMutation = useMutation({
    mutationFn: async (data: DeviceForm) =>
      await apiRequest("/api/monitoring/devices", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/devices"] });
      setIsDeviceDialogOpen(false);
    },
  });

  // Sync devices mutation
  const syncDevicesMutation = useMutation({
    mutationFn: async () =>
      await apiRequest("/api/monitoring/sync", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/equipment-status"] });
    },
  });

  // Form setup
  const deviceForm = useForm<DeviceForm>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      device_type: "mfp",
      connection_type: "ethernet",
      monitoring_enabled: true,
      data_collection_interval: 300,
    },
  });

  const onDeviceSubmit = (data: DeviceForm) => {
    registerDeviceMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'running': case 'connected': return 'default';
      case 'offline': case 'disconnected': return 'destructive';
      case 'idle': case 'standby': return 'secondary';
      case 'maintenance': case 'warning': return 'secondary';
      case 'error': case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'info': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': case 'running': case 'connected': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'offline': case 'disconnected': case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'idle': case 'standby': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'maintenance': return <Wrench className="h-4 w-4 text-orange-600" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <Activity className="h-4 w-4 text-blue-600" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getDeviceTypeIcon = (type: string) => {
    switch (type) {
      case 'printer': return <Monitor className="h-4 w-4" />;
      case 'copier': return <Monitor className="h-4 w-4" />;
      case 'scanner': return <Monitor className="h-4 w-4" />;
      case 'mfp': return <Monitor className="h-4 w-4" />;
      case 'sensor': return <Activity className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case 'ethernet': return <Router className="h-4 w-4" />;
      case 'wifi': return <Wifi className="h-4 w-4" />;
      case 'cellular': return <Smartphone className="h-4 w-4" />;
      case 'hybrid': return <Laptop className="h-4 w-4" />;
      default: return <Router className="h-4 w-4" />;
    }
  };

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/equipment-status"] });
    }, 30000);
    
    return () => clearInterval(interval);
  }, [queryClient]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Remote Monitoring & IoT</h1>
          <p className="text-muted-foreground mt-2">
            Real-time equipment monitoring, predictive maintenance, and IoT device management
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Register Device
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Register IoT Device</DialogTitle>
              </DialogHeader>
              <Form {...deviceForm}>
                <form onSubmit={deviceForm.handleSubmit(onDeviceSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={deviceForm.control}
                      name="device_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Device Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Office MFP - Floor 2" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deviceForm.control}
                      name="device_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Device Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="printer">Printer</SelectItem>
                              <SelectItem value="copier">Copier</SelectItem>
                              <SelectItem value="scanner">Scanner</SelectItem>
                              <SelectItem value="mfp">Multifunction Printer</SelectItem>
                              <SelectItem value="sensor">Sensor</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={deviceForm.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manufacturer</FormLabel>
                          <FormControl>
                            <Input placeholder="Canon" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deviceForm.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="imageRUNNER 2530i" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={deviceForm.control}
                    name="device_serial_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input placeholder="CN123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={deviceForm.control}
                      name="connection_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Connection Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ethernet">Ethernet</SelectItem>
                              <SelectItem value="wifi">Wi-Fi</SelectItem>
                              <SelectItem value="cellular">Cellular</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deviceForm.control}
                      name="ip_address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IP Address (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="192.168.1.100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={deviceForm.control}
                    name="customer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {businessRecords.map((record: any) => (
                              <SelectItem key={record.id} value={record.id}>
                                {record.company_name || record.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={deviceForm.control}
                    name="installation_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Installation Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Building A, Floor 2, Main Office" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={deviceForm.control}
                      name="data_collection_interval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Collection Interval (seconds)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="60" 
                              max="3600"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 300)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deviceForm.control}
                      name="monitoring_enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Enable monitoring</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDeviceDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={registerDeviceMutation.isPending}>
                      {registerDeviceMutation.isPending ? "Registering..." : "Register Device"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => syncDevicesMutation.mutate()} disabled={syncDevicesMutation.isPending}>
            <Activity className="mr-2 h-4 w-4" />
            {syncDevicesMutation.isPending ? "Syncing..." : "Sync Devices"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="status">Live Status</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="trends">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Monitoring Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
                <Monitor className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.totalDevices || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.onlineDevices || 0} online
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.activeAlerts || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.criticalAlerts || 0} critical
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Uptime</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.averageUptime ? `${metrics.averageUptime.toFixed(1)}%` : "0%"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 30 days
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity and Critical Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Equipment Status Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {statusLoading ? (
                  <p className="text-center py-4">Loading status...</p>
                ) : (equipmentStatus as EquipmentStatus[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No equipment monitored</p>
                ) : (
                  <div className="space-y-3">
                    {(equipmentStatus as EquipmentStatus[]).slice(0, 5).map((status) => (
                      <div key={status.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(status.operational_status)}
                          <div>
                            <h4 className="font-medium text-sm">{status.device_name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {status.current_job_count} jobs • {status.total_page_count.toLocaleString()} pages
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={getStatusColor(status.operational_status)} className="text-xs">
                            {status.operational_status}
                          </Badge>
                          {status.uptime_percentage && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {status.uptime_percentage.toFixed(1)}% uptime
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <p className="text-center py-4">Loading alerts...</p>
                ) : (alerts as PredictiveAlert[]).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No alerts</p>
                ) : (
                  <div className="space-y-3">
                    {(alerts as PredictiveAlert[]).slice(0, 5).map((alert) => (
                      <div key={alert.id} className="flex items-start justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                              {alert.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {alert.alert_category}
                            </span>
                          </div>
                          <h4 className="font-medium text-sm">{alert.alert_title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {alert.device_name} • {alert.customer_name}
                          </p>
                          {alert.time_to_failure_days && (
                            <p className="text-xs text-orange-600 mt-1">
                              Predicted failure in {alert.time_to_failure_days} days
                            </p>
                          )}
                        </div>
                        <Badge variant={getStatusColor(alert.alert_status)} className="text-xs">
                          {alert.alert_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-6">
          {/* Device Filters */}
          <div className="flex space-x-4">
            <Select value={selectedDeviceType} onValueChange={setSelectedDeviceType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Device Types</SelectItem>
                <SelectItem value="printer">Printer</SelectItem>
                <SelectItem value="copier">Copier</SelectItem>
                <SelectItem value="scanner">Scanner</SelectItem>
                <SelectItem value="mfp">Multifunction Printer</SelectItem>
                <SelectItem value="sensor">Sensor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>IoT Devices</CardTitle>
            </CardHeader>
            <CardContent>
              {devicesLoading ? (
                <p className="text-center py-8">Loading devices...</p>
              ) : (devices as IoTDevice[]).length === 0 ? (
                <div className="text-center py-8">
                  <Monitor className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No IoT devices registered</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(devices as IoTDevice[]).map((device) => (
                    <div key={device.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="flex items-center space-x-2">
                            {getDeviceTypeIcon(device.device_type)}
                            {getConnectionIcon(device.connection_type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-medium">{device.device_name}</h3>
                              <Badge variant={getStatusColor(device.device_status)}>
                                {device.device_status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>{device.manufacturer} {device.model}</p>
                              <p>Type: {device.device_type} • Connection: {device.connection_type}</p>
                              <p>Location: {device.installation_location}</p>
                              <p>Customer: {device.customer_name}</p>
                              {device.ip_address && (
                                <p>IP: {device.ip_address}</p>
                              )}
                              {device.last_data_received && (
                                <p>Last Data: {format(new Date(device.last_data_received), 'MMM dd, HH:mm')}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          {device.battery_level !== undefined && (
                            <div className="flex items-center space-x-1">
                              <Battery className="h-3 w-3" />
                              <span className="text-xs">{device.battery_level}%</span>
                            </div>
                          )}
                          {device.signal_strength !== undefined && (
                            <div className="flex items-center space-x-1">
                              <Signal className="h-3 w-3" />
                              <span className="text-xs">{device.signal_strength}%</span>
                            </div>
                          )}
                          <div className="flex space-x-1">
                            <Button variant="outline" size="sm">
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Settings className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Live Equipment Status</CardTitle>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <p className="text-center py-8">Loading status...</p>
              ) : (equipmentStatus as EquipmentStatus[]).length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No equipment status available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(equipmentStatus as EquipmentStatus[]).map((status) => (
                    <Card key={status.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{status.device_name}</CardTitle>
                          {getStatusIcon(status.operational_status)}
                        </div>
                        <Badge variant={getStatusColor(status.operational_status)} className="w-fit">
                          {status.operational_status}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Jobs</p>
                            <p className="font-medium">{status.current_job_count}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pages</p>
                            <p className="font-medium">{status.total_page_count.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Errors</p>
                            <p className="font-medium">{status.error_count}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Uptime</p>
                            <p className="font-medium">
                              {status.uptime_percentage ? `${status.uptime_percentage.toFixed(1)}%` : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {(status.temperature || status.humidity) && (
                          <div className="border-t pt-3">
                            <p className="text-sm font-medium mb-2">Environmental</p>
                            <div className="flex space-x-4 text-sm">
                              {status.temperature && (
                                <div className="flex items-center space-x-1">
                                  <Thermometer className="h-3 w-3" />
                                  <span>{status.temperature}°C</span>
                                </div>
                              )}
                              {status.humidity && (
                                <div className="flex items-center space-x-1">
                                  <Droplets className="h-3 w-3" />
                                  <span>{status.humidity}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {status.toner_levels && (
                          <div className="border-t pt-3">
                            <p className="text-sm font-medium mb-2">Toner Levels</p>
                            <div className="space-y-1">
                              {Object.entries(status.toner_levels).map(([color, level]: [string, any]) => (
                                <div key={color} className="flex items-center justify-between text-xs">
                                  <span className="capitalize">{color}</span>
                                  <span>{level}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          Updated: {format(new Date(status.status_timestamp), 'HH:mm:ss')}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          {/* Alert Filters */}
          <div className="flex space-x-4">
            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Predictive Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <p className="text-center py-8">Loading alerts...</p>
              ) : (alerts as PredictiveAlert[]).length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No alerts found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(alerts as PredictiveAlert[]).map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <Badge variant="outline">
                              {alert.alert_category}
                            </Badge>
                            <Badge variant="outline">
                              {alert.alert_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <h3 className="font-medium mb-1">{alert.alert_title}</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {alert.alert_description}
                          </p>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Device: {alert.device_name}</p>
                            <p>Customer: {alert.customer_name}</p>
                            <p>Created: {format(new Date(alert.created_at), 'MMM dd, yyyy HH:mm')}</p>
                            {alert.time_to_failure_days && (
                              <p className="text-orange-600">
                                Predicted failure in {alert.time_to_failure_days} days
                              </p>
                            )}
                            {alert.failure_probability && (
                              <p>
                                Failure probability: {(alert.failure_probability * 100).toFixed(1)}%
                              </p>
                            )}
                            {alert.confidence_score && (
                              <p>
                                Confidence: {(alert.confidence_score * 100).toFixed(0)}%
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <Badge variant={getStatusColor(alert.alert_status)}>
                            {alert.alert_status}
                          </Badge>
                          {alert.business_impact_level && (
                            <p className="text-xs text-muted-foreground">
                              Impact: {alert.business_impact_level}
                            </p>
                          )}
                          <div className="flex space-x-1">
                            <Button variant="outline" size="sm">
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <p className="text-center py-8">Loading trends...</p>
              ) : (trends as PerformanceTrend[]).length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No performance trends available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(trends as PerformanceTrend[]).map((trend) => (
                    <div key={trend.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{trend.device_name}</h3>
                            {getTrendIcon(trend.performance_trend)}
                            <Badge variant="outline">
                              {trend.analysis_type}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>
                              Period: {format(new Date(trend.analysis_period_start), 'MMM dd')} - {format(new Date(trend.analysis_period_end), 'MMM dd, yyyy')}
                            </p>
                            <p>Pages Processed: {trend.total_pages_processed.toLocaleString()}</p>
                            <p>Trend: {trend.performance_trend}</p>
                            {trend.average_uptime_percentage && (
                              <p>Uptime: {trend.average_uptime_percentage.toFixed(1)}%</p>
                            )}
                            {trend.reliability_score && (
                              <p>Reliability Score: {(trend.reliability_score * 100).toFixed(0)}%</p>
                            )}
                            {trend.peer_performance_percentile && (
                              <p>vs Peers: {trend.peer_performance_percentile}th percentile</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {trend.performance_trend}
                          </div>
                          {trend.failure_risk_score && (
                            <p className={`text-sm ${
                              trend.failure_risk_score > 0.7 ? 'text-red-600' :
                              trend.failure_risk_score > 0.4 ? 'text-orange-600' : 'text-green-600'
                            }`}>
                              Risk: {(trend.failure_risk_score * 100).toFixed(0)}%
                            </p>
                          )}
                        </div>
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