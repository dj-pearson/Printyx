import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Monitor, 
  Server, 
  Activity, 
  Database, 
  Wifi, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  Globe,
  HardDrive,
  Cpu,
  MemoryStick
} from "lucide-react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/main-layout";

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  uptime: number;
  responseTime: number;
  lastCheck: string;
}

interface AlertItem {
  id: string;
  type: 'system' | 'service' | 'security' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export default function SystemMonitoring() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("overview");
  
  // Mock data for demonstration
  const systemMetrics: SystemMetric[] = [
    {
      name: "CPU Usage",
      value: 23.5,
      unit: "%",
      status: "good",
      trend: "stable",
      lastUpdated: new Date().toISOString()
    },
    {
      name: "Memory Usage",
      value: 68.2,
      unit: "%",
      status: "warning",
      trend: "up",
      lastUpdated: new Date().toISOString()
    },
    {
      name: "Disk Usage",
      value: 45.8,
      unit: "%",
      status: "good",
      trend: "stable",
      lastUpdated: new Date().toISOString()
    },
    {
      name: "Network I/O",
      value: 234.7,
      unit: "MB/s",
      status: "good",
      trend: "down",
      lastUpdated: new Date().toISOString()
    }
  ];

  const serviceStatuses: ServiceStatus[] = [
    {
      name: "Web Application",
      status: "online",
      uptime: 99.98,
      responseTime: 234,
      lastCheck: new Date(Date.now() - 30000).toISOString()
    },
    {
      name: "Database",
      status: "online",
      uptime: 99.95,
      responseTime: 45,
      lastCheck: new Date(Date.now() - 30000).toISOString()
    },
    {
      name: "API Gateway",
      status: "online",
      uptime: 99.99,
      responseTime: 123,
      lastCheck: new Date(Date.now() - 30000).toISOString()
    },
    {
      name: "Background Jobs",
      status: "degraded",
      uptime: 97.5,
      responseTime: 567,
      lastCheck: new Date(Date.now() - 30000).toISOString()
    }
  ];

  const alerts: AlertItem[] = [
    {
      id: "alert-001",
      type: "performance",
      severity: "medium",
      message: "Memory usage above 65% threshold",
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      resolved: false
    },
    {
      id: "alert-002",
      type: "service",
      severity: "high",
      message: "Background job processing degraded",
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      resolved: false
    },
    {
      id: "alert-003",
      type: "security",
      severity: "low",
      message: "Multiple failed login attempts detected",
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      resolved: true
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'warning':
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'offline':
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-red-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getMetricIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'cpu usage':
        return <Cpu className="w-6 h-6" />;
      case 'memory usage':
        return <MemoryStick className="w-6 h-6" />;
      case 'disk usage':
        return <HardDrive className="w-6 h-6" />;
      case 'network i/o':
        return <Wifi className="w-6 h-6" />;
      default:
        return <Activity className="w-6 h-6" />;
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
            <p className="text-gray-600 mt-2">Real-time system health and performance monitoring</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700">
              <CheckCircle className="w-4 h-4 mr-1" />
              All Systems Operational
            </Badge>
            <Button size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">System Metrics</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {systemMetrics.map((metric, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getMetricIcon(metric.name)}
                        <div>
                          <p className="text-sm font-medium text-gray-600">{metric.name}</p>
                          <div className="flex items-center space-x-2">
                            <p className="text-2xl font-bold">
                              {metric.value}{metric.unit}
                            </p>
                            {getTrendIcon(metric.trend)}
                          </div>
                        </div>
                      </div>
                      <Badge className={getStatusColor(metric.status)}>
                        {metric.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Server className="w-5 h-5" />
                    <span>Service Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {serviceStatuses.map((service, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            service.status === 'online' ? 'bg-green-500' :
                            service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-sm text-gray-500">
                              {service.uptime}% uptime • {service.responseTime}ms response
                            </p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(service.status)}>
                          {service.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Recent Alerts</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {alerts.slice(0, 5).map((alert) => (
                      <div key={alert.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                        <div className="mt-1">
                          {alert.resolved ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {format(new Date(alert.timestamp), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm">{alert.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* System Metrics */}
          <TabsContent value="metrics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {systemMetrics.map((metric, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getMetricIcon(metric.name)}
                        <span>{metric.name}</span>
                      </div>
                      <Badge className={getStatusColor(metric.status)}>
                        {metric.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold">
                          {metric.value}{metric.unit}
                        </span>
                        <div className="flex items-center space-x-1">
                          {getTrendIcon(metric.trend)}
                          <span className="text-sm text-gray-500 capitalize">{metric.trend}</span>
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            metric.status === 'good' ? 'bg-green-600' :
                            metric.status === 'warning' ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${Math.min(metric.value, 100)}%` }}
                        />
                      </div>
                      
                      <p className="text-xs text-gray-500">
                        Last updated: {format(new Date(metric.lastUpdated), 'HH:mm:ss')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Services */}
          <TabsContent value="services" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="w-5 h-5" />
                  <span>Service Health Dashboard</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uptime</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>Last Check</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serviceStatuses.map((service, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${
                              service.status === 'online' ? 'bg-green-500' :
                              service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="font-medium">{service.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(service.status)}>
                            {service.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{service.uptime}%</TableCell>
                        <TableCell>{service.responseTime}ms</TableCell>
                        <TableCell>
                          {format(new Date(service.lastCheck), 'HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline">
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              Restart
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts */}
          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>System Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <Card key={alert.id} className="border-l-4 border-l-orange-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity}
                              </Badge>
                              <Badge variant="outline">
                                {alert.type}
                              </Badge>
                              {alert.resolved && (
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Resolved
                                </Badge>
                              )}
                            </div>
                          </div>
                          <span className="text-sm text-gray-500">
                            {format(new Date(alert.timestamp), 'MMM dd, HH:mm')}
                          </span>
                        </div>
                        <p className="mt-2 text-sm">{alert.message}</p>
                        {!alert.resolved && (
                          <div className="mt-3 flex space-x-2">
                            <Button size="sm">Acknowledge</Button>
                            <Button size="sm" variant="outline">View Details</Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}