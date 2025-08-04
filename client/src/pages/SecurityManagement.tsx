import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Lock, 
  Key, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Eye,
  EyeOff,
  UserX,
  Clock,
  Activity,
  Settings,
  Database,
  Globe,
  Wifi,
  Server,
  Terminal,
  Bell,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/main-layout";

interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'failed_login' | 'permission_denied' | 'data_access' | 'config_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  userName: string;
  ipAddress: string;
  userAgent: string;
  description: string;
  metadata: any;
  timestamp: string;
  resolved: boolean;
}

interface SecurityRule {
  id: string;
  name: string;
  description: string;
  type: 'rate_limit' | 'ip_whitelist' | 'password_policy' | 'session_timeout' | 'access_control';
  isActive: boolean;
  configuration: any;
  lastModified: string;
  createdBy: string;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  lastBackup: string;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
}

export default function SecurityManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("events");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Mock data for demonstration
  const securityEvents: SecurityEvent[] = [
    {
      id: "evt-001",
      type: "failed_login",
      severity: "medium",
      userId: "unknown",
      userName: "admin@example.com",
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      description: "Failed login attempt with invalid credentials",
      metadata: { attempts: 3 },
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      resolved: false
    },
    {
      id: "evt-002",
      type: "permission_denied",
      severity: "high",
      userId: "usr-123",
      userName: "john.doe@printyx.com",
      ipAddress: "10.0.0.45",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      description: "Attempted to access admin panel without proper permissions",
      metadata: { resource: "/admin/tenant-setup" },
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      resolved: true
    },
    {
      id: "evt-003",
      type: "data_access",
      severity: "low",
      userId: "usr-456",
      userName: "sarah.smith@printyx.com",
      ipAddress: "172.16.0.10",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      description: "Accessed customer data export feature",
      metadata: { recordCount: 150 },
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      resolved: false
    }
  ];

  const securityRules: SecurityRule[] = [
    {
      id: "rule-001",
      name: "Rate Limiting",
      description: "Limit API requests to 100 per minute per IP",
      type: "rate_limit",
      isActive: true,
      configuration: { maxRequests: 100, windowMinutes: 1 },
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      createdBy: "admin@printyx.com"
    },
    {
      id: "rule-002",
      name: "Password Policy",
      description: "Enforce strong password requirements",
      type: "password_policy",
      isActive: true,
      configuration: { minLength: 12, requireSpecialChars: true, requireNumbers: true },
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      createdBy: "admin@printyx.com"
    },
    {
      id: "rule-003",
      name: "Session Timeout",
      description: "Auto-logout after 30 minutes of inactivity",
      type: "session_timeout",
      isActive: true,
      configuration: { timeoutMinutes: 30 },
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      createdBy: "admin@printyx.com"
    }
  ];

  const systemHealth: SystemHealth = {
    status: "healthy",
    uptime: 99.99,
    lastBackup: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    activeConnections: 342,
    memoryUsage: 68.5,
    cpuUsage: 23.2,
    diskUsage: 45.8
  };

  const filteredEvents = securityEvents.filter(event => {
    const matchesSeverity = filterSeverity === "all" || event.severity === filterSeverity;
    const matchesType = filterType === "all" || event.type === filterType;
    const matchesSearch = searchTerm === "" || 
      event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.ipAddress.includes(searchTerm);
    
    return matchesSeverity && matchesType && matchesSearch;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'failed_login': return <UserX className="w-4 h-4" />;
      case 'permission_denied': return <Lock className="w-4 h-4" />;
      case 'data_access': return <Database className="w-4 h-4" />;
      case 'config_change': return <Settings className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Security Management</h1>
            <p className="text-gray-600 mt-2">Monitor security events, manage access controls, and system health</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={`${getStatusColor(systemHealth.status)}`}>
              <Shield className="w-4 h-4 mr-1" />
              System {systemHealth.status.charAt(0).toUpperCase() + systemHealth.status.slice(1)}
            </Badge>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="events">Security Events</TabsTrigger>
            <TabsTrigger value="rules">Security Rules</TabsTrigger>
            <TabsTrigger value="monitoring">System Health</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Security Events */}
          <TabsContent value="events" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Security Events</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    <Button size="sm">
                      <Bell className="w-4 h-4 mr-2" />
                      Configure Alerts
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 mt-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search events..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="failed_login">Failed Login</SelectItem>
                      <SelectItem value="permission_denied">Permission Denied</SelectItem>
                      <SelectItem value="data_access">Data Access</SelectItem>
                      <SelectItem value="config_change">Config Change</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredEvents.map((event) => (
                    <Card key={event.id} className="border-l-4 border-l-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="mt-1">
                              {getTypeIcon(event.type)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-medium">{event.description}</h4>
                                <Badge className={getSeverityColor(event.severity)}>
                                  {event.severity}
                                </Badge>
                                {event.resolved ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Resolved
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-50">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Open
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                <div>User: {event.userName} | IP: {event.ipAddress}</div>
                                <div>Time: {format(new Date(event.timestamp), 'MMM dd, yyyy HH:mm:ss')}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!event.resolved && (
                              <Button size="sm">
                                Mark Resolved
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Rules */}
          <TabsContent value="rules" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Key className="w-5 h-5" />
                    <span>Security Rules</span>
                  </CardTitle>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Modified</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securityRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rule.name}</div>
                            <div className="text-sm text-gray-500">{rule.description}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {rule.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch checked={rule.isActive} />
                            <span className={rule.isActive ? 'text-green-600' : 'text-gray-500'}>
                              {rule.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(rule.lastModified), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Trash2 className="w-4 h-4" />
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

          {/* System Health */}
          <TabsContent value="monitoring" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">System Uptime</p>
                      <p className="text-2xl font-bold">{systemHealth.uptime}%</p>
                    </div>
                    <Server className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Connections</p>
                      <p className="text-2xl font-bold">{systemHealth.activeConnections}</p>
                    </div>
                    <Wifi className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                      <p className="text-2xl font-bold">{systemHealth.memoryUsage}%</p>
                    </div>
                    <Activity className="w-8 h-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Disk Usage</p>
                      <p className="text-2xl font-bold">{systemHealth.diskUsage}%</p>
                    </div>
                    <Database className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Real-time Monitoring</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>CPU Usage</Label>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${systemHealth.cpuUsage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">{systemHealth.cpuUsage}%</span>
                  </div>

                  <div>
                    <Label>Memory Usage</Label>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-yellow-600 h-2 rounded-full" 
                        style={{ width: `${systemHealth.memoryUsage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">{systemHealth.memoryUsage}%</span>
                  </div>

                  <div>
                    <Label>Disk Usage</Label>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{ width: `${systemHealth.diskUsage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">{systemHealth.diskUsage}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Security Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Authentication Settings</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Two-Factor Authentication</Label>
                        <Switch />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Password Expiry (days)</Label>
                        <Input type="number" defaultValue="90" className="w-20" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Session Timeout (minutes)</Label>
                        <Input type="number" defaultValue="30" className="w-20" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Monitoring Settings</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Enable Audit Logging</Label>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Failed Login Alerts</Label>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Retention Period (days)</Label>
                        <Input type="number" defaultValue="365" className="w-20" />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end space-x-2">
                  <Button variant="outline">Reset to Defaults</Button>
                  <Button>Save Settings</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}