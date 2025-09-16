import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Gauge, 
  Heart, 
  Settings, 
  TrendingUp, 
  Wrench,
  Calendar,
  Zap,
  Thermometer,
  Wifi,
  Battery,
  AlertCircle
} from 'lucide-react';
import { LineChart, BarChart, PieChart } from '@/components/charts/ChartComponents';
import { apiRequest } from '@/lib/queryClient';

interface EquipmentHealth {
  id: string;
  equipmentName: string;
  make: string;
  model: string;
  serialNumber: string;
  location: string;
  overallHealthScore: number;
  status: 'excellent' | 'good' | 'warning' | 'critical' | 'offline';
  lastServiceDate: string;
  nextServiceDue: string;
  totalPrintCount: number;
  monthlyAverage: number;
  predictedMaintenanceDate: string;
  healthMetrics: {
    tonerLevels: Array<{ color: string; level: number; status: string }>;
    paperLevels: number;
    drumLifeRemaining: number;
    fuserLifeRemaining: number;
    temperature: number;
    humidity: number;
    errorCount: number;
    jamRate: number;
  };
  recentActivity: Array<{
    date: string;
    type: 'print' | 'scan' | 'copy' | 'fax';
    count: number;
  }>;
  alerts: Array<{
    id: string;
    type: 'warning' | 'critical' | 'info';
    message: string;
    timestamp: string;
    resolved: boolean;
  }>;
  connectionStatus: {
    isOnline: boolean;
    lastSeen: string;
    signalStrength: number;
    ipAddress: string;
  };
}

interface EquipmentHealthDashboardProps {
  tenantId?: string;
  customerId?: string;
}

export const EquipmentHealthDashboard: React.FC<EquipmentHealthDashboardProps> = () => {
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');

  // Fetch equipment health data - server will use authenticated user context
  const { data: equipmentHealth = [], isLoading, error } = useQuery<EquipmentHealth[]>({
    queryKey: ['/api/customer-portal/equipment-health', timeRange],
    queryFn: () => apiRequest(`/api/customer-portal/equipment-health?timeRange=${timeRange}`),
  });

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'warning': return 'outline';
      case 'critical': return 'destructive';
      case 'offline': return 'outline';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'good': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'offline': return <Wifi className="h-4 w-4 text-gray-400" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Unable to Load Equipment Health</h3>
          <p className="text-muted-foreground">Please try again later or contact support.</p>
        </CardContent>
      </Card>
    );
  }

  const selectedEquipmentData = selectedEquipment 
    ? equipmentHealth.find(eq => eq.id === selectedEquipment)
    : equipmentHealth[0];

  const overallFleetHealth = equipmentHealth.length > 0 
    ? Math.round(equipmentHealth.reduce((sum, eq) => sum + eq.overallHealthScore, 0) / equipmentHealth.length)
    : 0;

  const criticalAlertsCount = equipmentHealth.reduce((sum, eq) => 
    sum + eq.alerts.filter(alert => alert.type === 'critical' && !alert.resolved).length, 0
  );

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="equipment-health-dashboard">
      {/* Fleet Overview - Mobile Optimized */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card data-testid="card-fleet-health">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Health</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthColor(overallFleetHealth)}`}>
              {overallFleetHealth}%
            </div>
            <p className="text-xs text-muted-foreground">
              Average across {equipmentHealth.length} devices
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-online-devices">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Devices</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {equipmentHealth.filter(eq => eq.connectionStatus.isOnline).length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {equipmentHealth.length} total devices
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-critical-alerts">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${criticalAlertsCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {criticalAlertsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-service-due">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Due</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {equipmentHealth.filter(eq => new Date(eq.nextServiceDue) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Within 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Equipment List */}
      <Card>
        <CardHeader>
          <CardTitle>Equipment Fleet</CardTitle>
          <CardDescription>Monitor the health and status of all your devices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {equipmentHealth.map((equipment) => (
              <div
                key={equipment.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedEquipment === equipment.id ? 'border-primary bg-muted/30' : ''
                }`}
                onClick={() => setSelectedEquipment(equipment.id)}
                data-testid={`equipment-item-${equipment.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(equipment.status)}
                      <div>
                        <h4 className="font-medium">{equipment.equipmentName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {equipment.make} {equipment.model} • {equipment.location}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${getHealthColor(equipment.overallHealthScore)}`}>
                        {equipment.overallHealthScore}%
                      </div>
                      <Badge variant={getHealthBadgeVariant(equipment.status)}>
                        {equipment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      {equipment.connectionStatus.isOnline ? (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Online</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span>Offline</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Equipment View */}
      {selectedEquipmentData && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="health-metrics">Health Metrics</TabsTrigger>
            <TabsTrigger value="usage-analytics">Usage Analytics</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Device Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Model</p>
                      <p className="font-medium">{selectedEquipmentData.make} {selectedEquipmentData.model}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Serial Number</p>
                      <p className="font-medium">{selectedEquipmentData.serialNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">{selectedEquipmentData.location}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Prints</p>
                      <p className="font-medium">{selectedEquipmentData.totalPrintCount.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service Schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Service</span>
                      <span className="font-medium">{new Date(selectedEquipmentData.lastServiceDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Next Service Due</span>
                      <span className="font-medium">{new Date(selectedEquipmentData.nextServiceDue).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Predicted Maintenance</span>
                      <span className="font-medium">{new Date(selectedEquipmentData.predictedMaintenanceDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button className="w-full" data-testid="button-schedule-service">
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Service
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="health-metrics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Toner Levels */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Toner Levels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedEquipmentData.healthMetrics.tonerLevels.map((toner) => (
                    <div key={toner.color} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{toner.color}</span>
                        <span>{toner.level}%</span>
                      </div>
                      <Progress 
                        value={toner.level} 
                        className={`h-2 ${toner.level < 20 ? 'bg-red-100' : toner.level < 50 ? 'bg-yellow-100' : 'bg-green-100'}`}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Component Life */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Component Life</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Drum Life</span>
                      <span>{selectedEquipmentData.healthMetrics.drumLifeRemaining}%</span>
                    </div>
                    <Progress value={selectedEquipmentData.healthMetrics.drumLifeRemaining} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Fuser Life</span>
                      <span>{selectedEquipmentData.healthMetrics.fuserLifeRemaining}%</span>
                    </div>
                    <Progress value={selectedEquipmentData.healthMetrics.fuserLifeRemaining} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Paper Level</span>
                      <span>{selectedEquipmentData.healthMetrics.paperLevels}%</span>
                    </div>
                    <Progress value={selectedEquipmentData.healthMetrics.paperLevels} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Environmental */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Environmental</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Thermometer className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">Temperature</span>
                    </div>
                    <span className="font-medium">{selectedEquipmentData.healthMetrics.temperature}°F</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Gauge className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Humidity</span>
                    </div>
                    <span className="font-medium">{selectedEquipmentData.healthMetrics.humidity}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Error Count</span>
                    </div>
                    <span className="font-medium">{selectedEquipmentData.healthMetrics.errorCount}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="usage-analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Usage Trends</CardTitle>
                  <CardDescription>Daily activity over the past 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <LineChart
                    data={selectedEquipmentData.recentActivity}
                    title="Daily Usage"
                    xDataKey="date"
                    lines={[
                      { dataKey: 'count', name: 'Total Activity', color: '#3b82f6' }
                    ]}
                    height={300}
                    showGrid={true}
                    showLegend={true}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity Breakdown</CardTitle>
                  <CardDescription>Usage by function type</CardDescription>
                </CardHeader>
                <CardContent>
                  <PieChart
                    data={[
                      { name: 'Print', value: selectedEquipmentData.recentActivity.filter(a => a.type === 'print').reduce((sum, a) => sum + a.count, 0) },
                      { name: 'Copy', value: selectedEquipmentData.recentActivity.filter(a => a.type === 'copy').reduce((sum, a) => sum + a.count, 0) },
                      { name: 'Scan', value: selectedEquipmentData.recentActivity.filter(a => a.type === 'scan').reduce((sum, a) => sum + a.count, 0) },
                      { name: 'Fax', value: selectedEquipmentData.recentActivity.filter(a => a.type === 'fax').reduce((sum, a) => sum + a.count, 0) }
                    ]}
                    title="Function Usage"
                    height={300}
                    showLegend={true}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>Current alerts and notifications for this device</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedEquipmentData.alerts.filter(alert => !alert.resolved).map((alert) => (
                    <div key={alert.id} className="p-3 border rounded-lg" data-testid={`alert-${alert.id}`}>
                      <div className="flex items-start space-x-3">
                        <div className="mt-1">
                          {alert.type === 'critical' && <AlertCircle className="h-4 w-4 text-red-500" />}
                          {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                          {alert.type === 'info' && <CheckCircle className="h-4 w-4 text-blue-500" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{alert.message}</p>
                            <Badge variant={alert.type === 'critical' ? 'destructive' : alert.type === 'warning' ? 'outline' : 'secondary'}>
                              {alert.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedEquipmentData.alerts.filter(alert => !alert.resolved).length === 0 && (
                    <div className="text-center py-6">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Active Alerts</h3>
                      <p className="text-muted-foreground">This device is operating normally</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};