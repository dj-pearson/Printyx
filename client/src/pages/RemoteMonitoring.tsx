import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Wifi, WifiOff, Activity, AlertTriangle, CheckCircle, XCircle, Zap, Thermometer, Droplets, Bell, BellOff, Eye, Settings, RefreshCw, MapPin, TrendingUp, TrendingDown, Battery, Gauge } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

interface EquipmentStatus {
  equipmentId: string;
  serialNumber: string;
  model: string;
  location: {
    customerName: string;
    address: string;
    floor: string;
    coordinates: { lat: number; lng: number };
  };
  status: string;
  connectionStatus: string;
  lastPing: Date;
  uptime: number;
  currentMetrics: {
    pagesPerMinute: number;
    tonerLevels: {
      black: number;
      cyan: number;
      magenta: number;
      yellow: number;
    };
    paperLevels: {
      tray1: number;
      tray2: number;
      tray3: number;
    };
    temperature: number | null;
    humidity: number | null;
    errorCount: number;
    jamCount: number;
    lastJobCompleted: Date;
  };
  performance: {
    dailyPageCount: number;
    weeklyPageCount: number;
    monthlyPageCount: number;
    utilizationRate: number;
    efficiency: number;
    averageJobSize: number;
    peakUsageHour: number;
  };
  maintenance: {
    nextScheduled: Date;
    lastCompleted: Date;
    maintenanceScore: number;
    predictiveAlerts: Array<{
      component: string;
      condition: string;
      estimatedLife: number;
      nextReplacement: Date;
    }>;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }>;
  environmental: {
    powerConsumption: number;
    energyEfficiency: string;
    carbonFootprint: number;
    sleepModeActive: boolean;
    autoSleepEnabled: boolean;
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'operational': return 'bg-green-100 text-green-800';
    case 'warning': return 'bg-yellow-100 text-yellow-800';
    case 'critical': return 'bg-red-100 text-red-800';
    case 'offline': return 'bg-gray-100 text-gray-800';
    case 'maintenance': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string, connectionStatus: string) => {
  if (connectionStatus === 'disconnected') {
    return <WifiOff className="h-4 w-4 text-red-600" />;
  }
  
  switch (status) {
    case 'operational': return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
    case 'offline': return <WifiOff className="h-4 w-4 text-gray-600" />;
    case 'maintenance': return <Settings className="h-4 w-4 text-blue-600" />;
    default: return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export default function RemoteMonitoring() {
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/remote-monitoring/equipment-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/remote-monitoring/fleet-overview'] });
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, queryClient]);

  // Fetch equipment status
  const { data: equipmentStatus = [], isLoading: statusLoading } = useQuery<EquipmentStatus[]>({
    queryKey: ['/api/remote-monitoring/equipment-status'],
    select: (data: any[]) => data.map(equipment => ({
      ...equipment,
      lastPing: new Date(equipment.lastPing),
      currentMetrics: {
        ...equipment.currentMetrics,
        lastJobCompleted: new Date(equipment.currentMetrics.lastJobCompleted)
      },
      maintenance: {
        ...equipment.maintenance,
        nextScheduled: new Date(equipment.maintenance.nextScheduled),
        lastCompleted: new Date(equipment.maintenance.lastCompleted),
        predictiveAlerts: equipment.maintenance.predictiveAlerts.map((alert: any) => ({
          ...alert,
          nextReplacement: new Date(alert.nextReplacement)
        }))
      },
      alerts: equipment.alerts.map((alert: any) => ({
        ...alert,
        timestamp: new Date(alert.timestamp)
      }))
    }))
  });

  // Fetch fleet overview
  const { data: fleetOverview } = useQuery({
    queryKey: ['/api/remote-monitoring/fleet-overview']
  });

  // Fetch sensor data for selected equipment
  const { data: sensorData } = useQuery({
    queryKey: ['/api/remote-monitoring/sensor-data', selectedEquipment],
    enabled: !!selectedEquipment
  });

  // Acknowledge alert mutation
  const acknowledgeAlertMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/remote-monitoring/acknowledge-alert', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/remote-monitoring/equipment-status'] });
      toast({
        title: "Alert Acknowledged",
        description: "The alert has been successfully acknowledged.",
      });
    }
  });

  const handleAcknowledgeAlert = (alertId: string, note: string = '') => {
    acknowledgeAlertMutation.mutate({ alertId, acknowledgmentNote: note });
  };

  if (statusLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading equipment monitoring data...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const onlineEquipment = equipmentStatus.filter(eq => eq.connectionStatus === 'connected').length;
  const offlineEquipment = equipmentStatus.filter(eq => eq.connectionStatus === 'disconnected').length;
  const criticalAlerts = equipmentStatus.reduce((sum, eq) => sum + eq.alerts.filter(alert => alert.severity === 'critical').length, 0);
  const totalAlerts = equipmentStatus.reduce((sum, eq) => sum + eq.alerts.length, 0);

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Remote Monitoring & IoT</h1>
          <p className="text-gray-600 mt-2">Real-time equipment monitoring and predictive analytics</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-refresh">Auto Refresh</Label>
            <Button
              variant={autoRefresh ? "default" : "outline"}
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
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/remote-monitoring'] });
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Equipment</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{onlineEquipment}</div>
            <p className="text-xs text-muted-foreground">
              {offlineEquipment} offline
            </p>
            <div className="text-xs text-gray-600 mt-1">
              {((onlineEquipment / equipmentStatus.length) * 100).toFixed(1)}% connectivity
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">
              {totalAlerts} total alerts
            </p>
            {fleetOverview && (
              <div className="text-xs text-gray-600 mt-1">
                {fleetOverview.summary.equipmentWithAlerts} units need attention
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Uptime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {fleetOverview && (
              <>
                <div className="text-2xl font-bold">{fleetOverview.summary.averageUptime.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Average across all equipment
                </p>
                <Progress value={fleetOverview.summary.averageUptime} className="mt-2" />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Utilization</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {fleetOverview && (
              <>
                <div className="text-2xl font-bold">{fleetOverview.summary.fleetUtilization.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Equipment usage efficiency
                </p>
                <div className="text-xs text-gray-600 mt-1">
                  Energy Rating: {fleetOverview.summary.energyEfficiency}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="equipment-status" className="space-y-6">
        <TabsList>
          <TabsTrigger value="equipment-status">Equipment Status</TabsTrigger>
          <TabsTrigger value="fleet-overview">Fleet Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="equipment-status" className="space-y-6">
          {equipmentStatus.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Equipment Monitored</h3>
                <p className="text-gray-600 mb-4">Start monitoring your copier fleet to see real-time status.</p>
                <Button>
                  <Wifi className="h-4 w-4 mr-2" />
                  Set Up Monitoring
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {equipmentStatus.map((equipment) => (
                <Card key={equipment.equipmentId} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(equipment.status, equipment.connectionStatus)}
                          <h3 className="font-medium text-lg">{equipment.model}</h3>
                          <Badge className={getStatusColor(equipment.status)}>
                            {equipment.status}
                          </Badge>
                          {equipment.connectionStatus === 'connected' ? (
                            <Badge className="bg-green-100 text-green-800">
                              <Wifi className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">
                              <WifiOff className="h-3 w-3 mr-1" />
                              Offline
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div>
                            <span className="font-medium">Customer:</span>
                            <br />
                            {equipment.location.customerName}
                          </div>
                          <div>
                            <span className="font-medium">Location:</span>
                            <br />
                            {equipment.location.floor}
                          </div>
                          <div>
                            <span className="font-medium">Serial Number:</span>
                            <br />
                            {equipment.serialNumber}
                          </div>
                          <div>
                            <span className="font-medium">Last Ping:</span>
                            <br />
                            {format(equipment.lastPing, 'MMM dd, HH:mm')}
                          </div>
                        </div>

                        {/* Performance metrics */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                          <h5 className="font-medium text-blue-800 mb-3">Performance Metrics</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-lg font-bold text-blue-700">{equipment.uptime.toFixed(1)}%</div>
                              <div className="text-blue-600">Uptime</div>
                              <Progress value={equipment.uptime} className="mt-1 h-2" />
                            </div>
                            <div>
                              <div className="text-lg font-bold text-blue-700">{equipment.performance.utilizationRate}%</div>
                              <div className="text-blue-600">Utilization</div>
                              <Progress value={equipment.performance.utilizationRate} className="mt-1 h-2" />
                            </div>
                            <div>
                              <div className="text-lg font-bold text-blue-700">{equipment.performance.efficiency.toFixed(1)}%</div>
                              <div className="text-blue-600">Efficiency</div>
                              <Progress value={equipment.performance.efficiency} className="mt-1 h-2" />
                            </div>
                            <div>
                              <div className="text-lg font-bold text-blue-700">{equipment.maintenance.maintenanceScore}</div>
                              <div className="text-blue-600">Health Score</div>
                              <Progress value={equipment.maintenance.maintenanceScore} className="mt-1 h-2" />
                            </div>
                          </div>
                        </div>

                        {/* Supply levels */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-4">
                          <h5 className="font-medium text-gray-800 mb-2">Supply Levels</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {Object.entries(equipment.currentMetrics.tonerLevels).map(([color, level]) => (
                              <div key={color} className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="capitalize">{color} Toner</span>
                                  <span className="font-medium">{level}%</span>
                                </div>
                                <Progress 
                                  value={level} 
                                  className={`h-2 ${level < 20 ? 'bg-red-100' : level < 50 ? 'bg-yellow-100' : 'bg-green-100'}`}
                                />
                              </div>
                            ))}
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                            {Object.entries(equipment.currentMetrics.paperLevels).map(([tray, level]) => (
                              <div key={tray} className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="capitalize">{tray}</span>
                                  <span className="font-medium">{level}%</span>
                                </div>
                                <Progress 
                                  value={level} 
                                  className={`h-2 ${level < 20 ? 'bg-red-100' : 'bg-green-100'}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Environmental data */}
                        {equipment.currentMetrics.temperature && (
                          <div className="bg-green-50 rounded-lg p-3 mb-4">
                            <h5 className="font-medium text-green-800 mb-2">Environmental Conditions</h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Thermometer className="h-4 w-4 text-green-600" />
                                <span>{equipment.currentMetrics.temperature}°C</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Droplets className="h-4 w-4 text-blue-600" />
                                <span>{equipment.currentMetrics.humidity}% humidity</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-yellow-600" />
                                <span>{equipment.environmental.powerConsumption}W</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Battery className="h-4 w-4 text-green-600" />
                                <span>Rating: {equipment.environmental.energyEfficiency}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Active alerts */}
                        {equipment.alerts.length > 0 && (
                          <div className="bg-red-50 rounded-lg p-3 mb-4">
                            <h5 className="font-medium text-red-800 mb-2">Active Alerts ({equipment.alerts.length})</h5>
                            <div className="space-y-2">
                              {equipment.alerts.slice(0, 3).map((alert) => (
                                <div key={alert.id} className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge className={getSeverityColor(alert.severity)}>
                                        {alert.severity}
                                      </Badge>
                                      <span className="text-sm font-medium capitalize">
                                        {alert.type.replace('_', ' ')}
                                      </span>
                                    </div>
                                    <div className="text-sm text-red-700">{alert.message}</div>
                                    <div className="text-xs text-red-600">
                                      {format(alert.timestamp, 'MMM dd, HH:mm')}
                                    </div>
                                  </div>
                                  {!alert.acknowledged && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleAcknowledgeAlert(alert.id)}
                                    >
                                      Acknowledge
                                    </Button>
                                  )}
                                </div>
                              ))}
                              {equipment.alerts.length > 3 && (
                                <div className="text-xs text-red-600">
                                  +{equipment.alerts.length - 3} more alerts
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Predictive maintenance */}
                        {equipment.maintenance.predictiveAlerts.length > 0 && (
                          <div className="bg-orange-50 rounded-lg p-3">
                            <h5 className="font-medium text-orange-800 mb-2">Predictive Maintenance</h5>
                            <div className="space-y-2">
                              {equipment.maintenance.predictiveAlerts.map((alert, idx) => (
                                <div key={idx} className="text-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-orange-700">{alert.component}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {alert.condition}
                                    </Badge>
                                  </div>
                                  <div className="text-orange-600">
                                    {alert.estimatedLife}% life remaining
                                  </div>
                                  <div className="text-xs text-orange-700">
                                    Replace by: {format(alert.nextReplacement, 'MMM dd, yyyy')}
                                  </div>
                                  <Progress value={alert.estimatedLife} className="mt-1 h-1" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right ml-6">
                        <div className="text-3xl font-bold text-blue-600">
                          {equipment.performance.dailyPageCount.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">Pages today</div>
                        
                        <div className="mt-4 space-y-1 text-xs">
                          <div>Weekly: {equipment.performance.weeklyPageCount.toLocaleString()}</div>
                          <div>Monthly: {equipment.performance.monthlyPageCount.toLocaleString()}</div>
                          <div>Avg Job: {equipment.performance.averageJobSize.toFixed(1)} pages</div>
                        </div>
                        
                        <div className="mt-4 text-xs text-gray-600">
                          <div>Next maintenance:</div>
                          <div>{format(equipment.maintenance.nextScheduled, 'MMM dd, yyyy')}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedEquipment(equipment.equipmentId)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      <Button size="sm" variant="outline">
                        <MapPin className="h-4 w-4 mr-1" />
                        Locate
                      </Button>
                      {equipment.alerts.length > 0 && (
                        <Button size="sm">
                          Resolve Alerts
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="fleet-overview" className="space-y-6">
          {fleetOverview && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Fleet Status Distribution</CardTitle>
                    <CardDescription>Equipment status across the fleet</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(fleetOverview.statusDistribution).map(([status, count]: [string, any]) => (
                        <div key={status} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(status, 'connected')}
                            <span className="capitalize">{status}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{count}</span>
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${(count / fleetOverview.summary.totalEquipment) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Trends</CardTitle>
                    <CardDescription>Weekly fleet performance metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={fleetOverview.performanceTrends.weeklyUptime.map((uptime, index) => ({
                        day: `Day ${index + 1}`,
                        uptime,
                        utilization: fleetOverview.performanceTrends.weeklyUtilization[index],
                        efficiency: fleetOverview.performanceTrends.weeklyEfficiency[index]
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="uptime" stroke="#8884d8" name="Uptime %" />
                        <Line type="monotone" dataKey="utilization" stroke="#82ca9d" name="Utilization %" />
                        <Line type="monotone" dataKey="efficiency" stroke="#ffc658" name="Efficiency %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Performers</CardTitle>
                    <CardDescription>Best performing equipment</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {fleetOverview.topPerformers.map((performer: any, idx: number) => (
                        <div key={performer.equipmentId} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium">{performer.model}</div>
                              <div className="text-sm text-gray-600">{performer.customerName}</div>
                            </div>
                            <Badge className="bg-green-100 text-green-800">
                              #{idx + 1}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-gray-600">Uptime</div>
                              <div className="font-bold">{performer.uptime}%</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Efficiency</div>
                              <div className="font-bold">{performer.efficiency}%</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Utilization</div>
                              <div className="font-bold">{performer.utilizationRate}%</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Attention Required</CardTitle>
                    <CardDescription>Equipment needing immediate attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {fleetOverview.attentionRequired.map((equipment: any) => (
                        <div key={equipment.equipmentId} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium">{equipment.model}</div>
                              <div className="text-sm text-gray-600">{equipment.customerName}</div>
                            </div>
                            <Badge className={equipment.priority === 'critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}>
                              {equipment.priority}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1 text-sm">
                            {equipment.issues.map((issue: string, idx: number) => (
                              <div key={idx} className="text-red-600">• {issue}</div>
                            ))}
                          </div>
                          
                          <div className="text-xs text-gray-600 mt-2">
                            Estimated revenue loss: ${equipment.estimatedRevenueLoss.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {sensorData && selectedEquipment && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Sensor Data Analytics</CardTitle>
                  <CardDescription>Equipment ID: {selectedEquipment}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Temperature Trends</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={sensorData.historicalData.temperature}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="timestamp" tickFormatter={(time) => format(new Date(time), 'HH:mm')} />
                          <YAxis />
                          <Tooltip labelFormatter={(time) => format(new Date(time), 'MMM dd, HH:mm')} />
                          <Line type="monotone" dataKey="value" stroke="#ff7c7c" name="Temperature °C" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3">Power Consumption</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={sensorData.historicalData.powerConsumption}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="timestamp" tickFormatter={(time) => format(new Date(time), 'HH:mm')} />
                          <YAxis />
                          <Tooltip labelFormatter={(time) => format(new Date(time), 'MMM dd, HH:mm')} />
                          <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} name="Power (W)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Predictive Insights</CardTitle>
                  <CardDescription>AI-powered maintenance and supply predictions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h5 className="font-medium text-blue-800 mb-2">Recommended Actions</h5>
                      {sensorData.predictions.recommendedActions.map((action: any, idx: number) => (
                        <div key={idx} className="bg-white rounded p-3 mb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{action.action}</div>
                              <div className="text-sm text-gray-600">Prevents: {action.preventsPotentialIssue}</div>
                            </div>
                            <div className="text-right">
                              <Badge className={action.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                                {action.priority}
                              </Badge>
                              <div className="text-sm text-gray-600">
                                Cost: ${action.estimatedCost}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-orange-50 rounded-lg p-4">
                        <h5 className="font-medium text-orange-800 mb-2">Failure Probability</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Next 7 days:</span>
                            <span className="font-bold">{sensorData.predictions.probabilityOfFailure.next7Days}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Next 30 days:</span>
                            <span className="font-bold">{sensorData.predictions.probabilityOfFailure.next30Days}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Next 90 days:</span>
                            <span className="font-bold">{sensorData.predictions.probabilityOfFailure.next90Days}%</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-green-50 rounded-lg p-4">
                        <h5 className="font-medium text-green-800 mb-2">Supply Replacements</h5>
                        <div className="space-y-2 text-sm">
                          {Object.entries(sensorData.predictions.estimatedTonerReplacementDates).map(([color, date]: [string, any]) => (
                            <div key={color} className="flex justify-between">
                              <span className="capitalize">{color}:</span>
                              <span className="font-bold">{format(new Date(date), 'MMM dd')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          
          {!selectedEquipment && (
            <Card>
              <CardContent className="text-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select Equipment for Analytics</h3>
                <p className="text-gray-600">Choose equipment from the status tab to view detailed analytics.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Alert Summary</CardTitle>
              <CardDescription>All active alerts across the fleet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {equipmentStatus.flatMap(equipment => 
                  equipment.alerts.map(alert => ({
                    ...alert,
                    equipmentId: equipment.equipmentId,
                    model: equipment.model,
                    customerName: equipment.location.customerName
                  }))
                )
                .sort((a, b) => {
                  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                  return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
                })
                .map((alert) => (
                  <div key={`${alert.equipmentId}-${alert.id}`} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <span className="font-medium capitalize">
                            {alert.type.replace('_', ' ')}
                          </span>
                          <span className="text-sm text-gray-600">
                            {alert.model} - {alert.customerName}
                          </span>
                        </div>
                        
                        <div className="text-gray-700 mb-2">{alert.message}</div>
                        
                        <div className="text-sm text-gray-600">
                          <div>Equipment ID: {alert.equipmentId}</div>
                          <div>Time: {format(alert.timestamp, 'MMM dd, yyyy HH:mm')}</div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {!alert.acknowledged && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                        <Button size="sm">
                          Resolve
                        </Button>
                      </div>
                    </div>
                    
                    {alert.acknowledged && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700">
                        Alert acknowledged
                      </div>
                    )}
                  </div>
                ))}
                
                {equipmentStatus.every(eq => eq.alerts.length === 0) && (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Alerts</h3>
                    <p className="text-gray-600">All equipment is operating normally.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}