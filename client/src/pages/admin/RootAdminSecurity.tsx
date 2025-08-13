import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, Lock, Key, Activity, Users, Database, Globe } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";

export default function RootAdminSecurity() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: securityMetrics } = useQuery({
    queryKey: ["/api/admin/security/metrics"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["/api/admin/audit-logs"],
  });

  const { data: activeThreats } = useQuery({
    queryKey: ["/api/admin/security/threats"],
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
        <h1 className="text-3xl font-bold text-gray-900">Root Admin Security</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive security monitoring and management for the entire Printyx platform
        </p>
      </div>

      {/* Security Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{securityMetrics?.securityScore || "Loading..."}</div>
            <Badge variant="outline" className="mt-2 text-green-600 border-green-200">
              {securityMetrics?.securityStatus || "Loading..."}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{activeThreats?.length || "0"}</div>
            <Badge variant="outline" className="mt-2 text-orange-600 border-orange-200">
              {securityMetrics?.threatLevel || "Loading..."}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <Lock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityMetrics?.failedLogins || "0"}</div>
            <p className="text-xs text-gray-500 mt-2">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <Key className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityMetrics?.activeApiKeys || "0"}</div>
            <p className="text-xs text-gray-500 mt-2">Active across platform</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts */}
      {activeThreats && activeThreats.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Notice:</strong> {activeThreats.length} security threat(s) detected. Review required.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="threats">Threat Detection</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Security Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {auditLogs && auditLogs.length > 0 ? (
                    auditLogs.slice(0, 5).map((log: any, index: number) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b">
                        <div>
                          <p className="font-medium">{log.action}</p>
                          <p className="text-sm text-gray-500">{log.details}</p>
                        </div>
                        <Badge variant={log.severity === 'high' ? 'destructive' : log.severity === 'medium' ? 'secondary' : 'outline'}>
                          {log.severity}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No recent security events</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Platform Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Tenants</span>
                    <span className="font-semibold">{securityMetrics?.totalTenants || "Loading..."}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Active Users</span>
                    <span className="font-semibold">{securityMetrics?.activeUsers || "Loading..."}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Admin Users</span>
                    <span className="font-semibold">{securityMetrics?.adminUsers || "Loading..."}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>API Requests (24h)</span>
                    <span className="font-semibold">{securityMetrics?.apiRequests24h || "Loading..."}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="authentication" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Security</CardTitle>
              <CardDescription>
                Monitor and manage authentication security across the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">99.2%</div>
                    <p className="text-sm text-gray-600">Successful Logins</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">847</div>
                    <p className="text-sm text-gray-600">Active Sessions</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">12</div>
                    <p className="text-sm text-gray-600">Blocked IPs</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button className="w-full" variant="outline">
                    Force Logout All Sessions
                  </Button>
                  <Button className="w-full" variant="outline">
                    Reset Failed Login Counters
                  </Button>
                  <Button className="w-full" variant="outline">
                    Update Password Policies
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Permission Management</CardTitle>
              <CardDescription>
                Review and manage role-based access control across all tenants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    You have root-level access to modify permissions for all tenants and users.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Platform Roles</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Root Administrator</span>
                        <Badge>1</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Platform Admin</span>
                        <Badge>5</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>System Admin</span>
                        <Badge>12</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">Tenant Roles</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Company Admin</span>
                        <Badge>156</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Regional Manager</span>
                        <Badge>423</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Location Manager</span>
                        <Badge>789</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Comprehensive audit trail of all platform activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Today</Button>
                  <Button variant="outline" size="sm">This Week</Button>
                  <Button variant="outline" size="sm">This Month</Button>
                  <Button variant="outline" size="sm">Custom Range</Button>
                </div>

                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">User login successful</p>
                          <p className="text-sm text-gray-500">
                            User: john.doe@example.com | Tenant: Acme Corp
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">2024-01-15</p>
                          <p className="text-xs text-gray-500">10:30 AM</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="threats" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Threat Detection</CardTitle>
              <CardDescription>
                AI-powered threat detection and response system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Brute Force Attack Detected</strong><br />
                      Multiple failed login attempts from IP 192.168.1.100
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Unusual API Activity</strong><br />
                      High request volume detected from tenant ID 1234
                    </AlertDescription>
                  </Alert>
                </div>

                <div className="space-y-3">
                  <Button className="w-full" variant="destructive">
                    Block Suspicious IP Addresses
                  </Button>
                  <Button className="w-full" variant="outline">
                    Generate Security Report
                  </Button>
                  <Button className="w-full" variant="outline">
                    Configure Threat Rules
                  </Button>
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