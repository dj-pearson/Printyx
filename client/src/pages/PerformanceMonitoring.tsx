import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  Activity,
  Server,
  Database,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Monitor,
  Cpu,
  HardDrive,
  Wifi,
  Users,
  Eye
} from "lucide-react";

interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  activeUsers: number;
}

interface SystemAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export default function PerformanceMonitoring() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date()
  });

  const { data: performanceMetrics, isLoading } = useQuery<PerformanceMetrics>({
    queryKey: ["/api/performance/metrics"],
  });

  const { data: systemAlerts } = useQuery<SystemAlert[]>({
    queryKey: ["/api/performance/alerts"],
  });

  // Mock data for comprehensive performance monitoring
  const mockMetrics = {
    responseTime: 245, // ms
    throughput: 1420, // requests/min
    errorRate: 0.12, // percentage
    uptime: 99.95, // percentage
    memoryUsage: 68, // percentage
    cpuUsage: 34, // percentage
    diskUsage: 23, // percentage
    activeUsers: 187
  };

  const mockAlerts = [
    {
      id: "1",
      type: 'warning' as const,
      message: "Memory usage above 65% for 10 minutes",
      timestamp: new Date(Date.now() - 300000).toISOString(),
      resolved: false
    },
    {
      id: "2", 
      type: 'info' as const,
      message: "Database optimization completed successfully",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      resolved: true
    },
    {
      id: "3",
      type: 'error' as const,
      message: "API endpoint /api/reports timeout (resolved)",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      resolved: true
    }
  ];

  const metrics = performanceMetrics || mockMetrics;
  const alerts = systemAlerts || mockAlerts;

  // Mock historical data for charts
  const responseTimeData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    responseTime: Math.floor(Math.random() * 200) + 150,
    target: 300
  }));

  const throughputData = Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    requests: Math.floor(Math.random() * 2000) + 1000,
    errors: Math.floor(Math.random() * 50) + 10
  }));

  const resourceUsageData = Array.from({ length: 12 }, (_, i) => ({
    time: `${i * 2}:00`,
    cpu: Math.floor(Math.random() * 40) + 20,
    memory: Math.floor(Math.random() * 30) + 50,
    disk: Math.floor(Math.random() * 20) + 15
  }));

  const endpointPerformanceData = [
    { endpoint: '/api/customers', avgResponseTime: 180, requests: 2840 },
    { endpoint: '/api/service-tickets', avgResponseTime: 220, requests: 1920 },
    { endpoint: '/api/contracts', avgResponseTime: 195, requests: 1560 },
    { endpoint: '/api/inventory', avgResponseTime: 160, requests: 1240 },
    { endpoint: '/api/reports', avgResponseTime: 380, requests: 680 }
  ];

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return "text-green-600";
    if (value <= thresholds.warning) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusBadge = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return <Badge className="bg-green-100 text-green-800">Good</Badge>;
    if (value <= thresholds.warning) return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
    return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <MainLayout 
      title="Performance Monitoring" 
      description="Monitor system performance, resource usage, and application health"
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Avg Response Time</p>
                  <p className={`text-2xl sm:text-3xl font-bold ${getStatusColor(metrics.responseTime, { good: 200, warning: 500 })}`}>
                    {metrics.responseTime}ms
                  </p>
                  <p className="text-xs text-green-600">↓ 15ms from yesterday</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Throughput</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {metrics.throughput.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">requests/min</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Error Rate</p>
                  <p className={`text-2xl sm:text-3xl font-bold ${getStatusColor(metrics.errorRate, { good: 0.5, warning: 2 })}`}>
                    {metrics.errorRate}%
                  </p>
                  <p className="text-xs text-green-600">Target: &lt; 1%</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">System Uptime</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600">
                    {metrics.uptime}%
                  </p>
                  <p className="text-xs text-gray-500">Last 30 days</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Health Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  System Health
                </CardTitle>
                <CardDescription>Real-time resource utilization and health metrics</CardDescription>
              </div>
              <DateRangePicker onDateRangeChange={setDateRange} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">CPU Usage</span>
                  </div>
                  {getStatusBadge(metrics.cpuUsage, { good: 70, warning: 85 })}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${metrics.cpuUsage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600">{metrics.cpuUsage}% of available capacity</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Memory Usage</span>
                  </div>
                  {getStatusBadge(metrics.memoryUsage, { good: 70, warning: 85 })}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${metrics.memoryUsage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600">{metrics.memoryUsage}% of 16GB RAM</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">Disk Usage</span>
                  </div>
                  {getStatusBadge(metrics.diskUsage, { good: 70, warning: 85 })}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${metrics.diskUsage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600">{metrics.diskUsage}% of 500GB SSD</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Response Time Trends</CardTitle>
              <CardDescription>24-hour response time monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="responseTime" stroke="#3B82F6" strokeWidth={2} name="Response Time (ms)" />
                    <Line type="monotone" dataKey="target" stroke="#EF4444" strokeDasharray="5 5" name="Target (300ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Throughput</CardTitle>
              <CardDescription>Request volume and error tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={throughputData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="requests" fill="#10B981" name="Successful Requests" />
                    <Bar dataKey="errors" fill="#EF4444" name="Errors" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Monitoring Tabs */}
        <Tabs defaultValue="endpoints" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="endpoints">API Endpoints</TabsTrigger>
            <TabsTrigger value="resources">Resource Usage</TabsTrigger>
            <TabsTrigger value="alerts">System Alerts</TabsTrigger>
            <TabsTrigger value="logs">Performance Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>API Endpoint Performance</CardTitle>
                <CardDescription>Response times and request volumes by endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {endpointPerformanceData.map((endpoint, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{endpoint.endpoint}</div>
                        <div className="text-sm text-gray-600">
                          {endpoint.requests.toLocaleString()} requests | Avg: {endpoint.avgResponseTime}ms
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`text-sm font-medium ${getStatusColor(endpoint.avgResponseTime, { good: 200, warning: 350 })}`}>
                          {endpoint.avgResponseTime}ms
                        </div>
                        {getStatusBadge(endpoint.avgResponseTime, { good: 200, warning: 350 })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resource Usage Over Time</CardTitle>
                <CardDescription>CPU, memory, and disk utilization trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={resourceUsageData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="cpu" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="CPU %" />
                      <Area type="monotone" dataKey="memory" stackId="2" stroke="#10B981" fill="#10B981" fillOpacity={0.6} name="Memory %" />
                      <Area type="monotone" dataKey="disk" stackId="3" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} name="Disk %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Card key={alert.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {alert.type === 'error' && <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />}
                        {alert.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />}
                        {alert.type === 'info' && <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />}
                        <div>
                          <p className="font-medium text-gray-900">{alert.message}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={alert.resolved ? "secondary" : alert.type === 'error' ? "destructive" : "default"}>
                        {alert.resolved ? "Resolved" : "Active"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Logs</CardTitle>
                <CardDescription>Recent system performance events and optimizations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 font-mono text-sm">
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="text-gray-500">[2025-01-01 14:32:15]</span> <span className="text-green-600">INFO</span> Database query optimization completed - 40% improvement
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="text-gray-500">[2025-01-01 14:28:42]</span> <span className="text-blue-600">DEBUG</span> Cache hit ratio: 94.2% (target: &gt;90%)
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="text-gray-500">[2025-01-01 14:25:33]</span> <span className="text-yellow-600">WARN</span> API /api/reports response time: 385ms (target: &lt;300ms)
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="text-gray-500">[2025-01-01 14:22:18]</span> <span className="text-green-600">INFO</span> Memory cleanup completed - freed 245MB
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}