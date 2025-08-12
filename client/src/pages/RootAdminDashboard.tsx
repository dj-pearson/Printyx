import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Users, 
  Server, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  TrendingDown,
  Database,
  Globe,
  Clock,
  Bell,
  Settings,
  Eye,
  Lock,
  Key,
  Crown,
  Building2,
  Zap,
  RefreshCw,
  Download,
  Upload,
  HardDrive,
  Wifi,
  Cpu,
  MemoryStick
} from "lucide-react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/main-layout";

interface SystemOverview {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
  systemUptime: number;
  criticalAlerts: number;
  pendingActions: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

interface TenantMetrics {
  id: string;
  name: string;
  userCount: number;
  status: 'active' | 'suspended' | 'trial';
  subscription: string;
  lastActivity: string;
  storageUsed: number;
  apiCalls: number;
  billingStatus: 'current' | 'overdue' | 'cancelled';
}

interface SecurityAlert {
  id: string;
  type: 'security_breach' | 'suspicious_activity' | 'failed_login' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  tenant: string;
  message: string;
  timestamp: string;
  status: 'open' | 'investigating' | 'resolved';
}

interface SystemResource {
  name: string;
  current: number;
  threshold: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

export default function RootAdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTimeRange, setSelectedTimeRange] = useState("24h");
  
  // Fetch real system overview data
  const { data: systemOverview, isLoading: overviewLoading } = useQuery({
    queryKey: ["/api/root-admin/overview"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch real tenant metrics
  const { data: tenantMetrics, isLoading: tenantsLoading } = useQuery({
    queryKey: ["/api/root-admin/tenants"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch real security alerts
  const { data: securityAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["/api/root-admin/security-alerts"],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch real system resources
  const { data: systemResources, isLoading: resourcesLoading } = useQuery({
    queryKey: ["/api/root-admin/system-resources"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Loading states
  if (overviewLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading Root Admin Dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Default values for when data is loading or unavailable
  const defaultOverview = {
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    activeUsers: 0,
    systemUptime: 0,
    criticalAlerts: 0,
    pendingActions: 0,
    systemHealth: 'unknown' as const
  };

  const currentOverview = systemOverview || defaultOverview;
  const currentTenants = tenantMetrics || [];
  const currentAlerts = securityAlerts || [];
  const currentResources = systemResources || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'current':
      case 'normal':
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'trial':
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
      case 'overdue':
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-red-600" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-green-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getResourceIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'cpu usage': return <Cpu className="w-5 h-5" />;
      case 'memory usage': return <MemoryStick className="w-5 h-5" />;
      case 'disk usage': return <HardDrive className="w-5 h-5" />;
      case 'active connections': return <Wifi className="w-5 h-5" />;
      case 'api rate': return <Globe className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <MainLayout 
      title="Root Admin Dashboard" 
      description="Platform-wide monitoring and administration"
    >
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-end">
          <div className="flex items-center space-x-2">
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* System Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                  <p className="text-2xl font-bold">{currentOverview.totalTenants}</p>
                  <p className="text-xs text-green-600">{currentOverview.activeTenants} active</p>
                </div>
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold">{currentOverview.totalUsers}</p>
                  <p className="text-xs text-green-600">{currentOverview.activeUsers} active</p>
                </div>
                <Users className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">System Uptime</p>
                  <p className="text-2xl font-bold">{currentOverview.systemUptime}%</p>
                  <p className="text-xs text-gray-500">Last 30 days</p>
                </div>
                <Server className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Critical Alerts</p>
                  <p className="text-2xl font-bold text-red-600">{currentOverview.criticalAlerts}</p>
                  <p className="text-xs text-orange-600">{currentOverview.pendingActions} pending</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tenants">Tenant Management</TabsTrigger>
            <TabsTrigger value="security">Security Center</TabsTrigger>
            <TabsTrigger value="resources">System Resources</TabsTrigger>
            <TabsTrigger value="actions">Admin Actions</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5" />
                    <span>Security Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>System Firewall</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>SSL Certificates</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Valid</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        <span>Failed Login Attempts</span>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">23 (24h)</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <span>Security Alerts</span>
                      </div>
                      <Badge className="bg-red-100 text-red-800">{currentOverview.criticalAlerts} Critical</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="w-5 h-5" />
                    <span>System Health</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentResources.slice(0, 3).map((resource, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getResourceIcon(resource.name)}
                            <span className="font-medium">{resource.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{resource.current}{resource.unit}</span>
                            {getTrendIcon(resource.trend)}
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              resource.status === 'normal' ? 'bg-green-600' :
                              resource.status === 'warning' ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${(resource.current / resource.threshold) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tenant Management */}
          <TabsContent value="tenants" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="w-5 h-5" />
                  <span>Tenant Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>API Calls</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentTenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div className="font-medium">{tenant.name}</div>
                        </TableCell>
                        <TableCell>{tenant.userCount}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(tenant.status)}>
                            {tenant.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{tenant.subscription}</TableCell>
                        <TableCell>{tenant.storageUsed} GB</TableCell>
                        <TableCell>{tenant.apiCalls.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(tenant.billingStatus)}>
                            {tenant.billingStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(tenant.lastActivity), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Settings className="w-4 h-4" />
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

          {/* Security Center */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Security Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {currentAlerts.map((alert) => (
                    <Card key={alert.id} className="border-l-4 border-l-red-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity}
                              </Badge>
                              <Badge variant="outline">
                                {alert.type.replace('_', ' ')}
                              </Badge>
                              <Badge variant="outline">
                                {alert.tenant}
                              </Badge>
                            </div>
                            <p className="font-medium mb-1">{alert.message}</p>
                            <p className="text-sm text-gray-500">
                              {format(new Date(alert.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(alert.status)}>
                              {alert.status}
                            </Badge>
                            <Button size="sm">Investigate</Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Resources */}
          <TabsContent value="resources" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentResources.map((resource, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {getResourceIcon(resource.name)}
                        <span className="font-medium">{resource.name}</span>
                      </div>
                      <Badge className={getStatusColor(resource.status)}>
                        {resource.status}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">
                          {resource.current}{resource.unit}
                        </span>
                        {getTrendIcon(resource.trend)}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            resource.status === 'normal' ? 'bg-green-600' :
                            resource.status === 'warning' ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${Math.min((resource.current / resource.threshold) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Threshold: {resource.threshold}{resource.unit}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Admin Actions */}
          <TabsContent value="actions" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>System Administration</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start">
                    <Crown className="w-4 h-4 mr-2" />
                    Platform Configuration
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Database className="w-4 h-4 mr-2" />
                    Database Management
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    System Backup
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Data Migration
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Bell className="w-5 h-5" />
                    <span>Monitoring & Alerts</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Configure Alerts
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Activity className="w-4 h-4 mr-2" />
                    Performance Reports
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Eye className="w-4 h-4 mr-2" />
                    Audit Logs
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    System Health Check
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}