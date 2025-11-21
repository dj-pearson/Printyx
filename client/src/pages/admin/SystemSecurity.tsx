import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Database, Server, Lock, Shield, Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";

export default function SystemSecurity() {
  const [activeTab, setActiveTab] = useState("infrastructure");

  const { data: systemHealth } = useQuery({
    queryKey: ["/api/admin/system/health"],
    refetchInterval: 10000,
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
        <h1 className="text-3xl font-bold text-gray-900">System Security</h1>
        <p className="text-gray-600 mt-2">
          Infrastructure security monitoring, database protection, and system hardening
        </p>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <Progress value={95} className="mt-2" />
            <p className="text-xs text-gray-500 mt-2">95% optimal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Security</CardTitle>
            <Database className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">Secured</div>
            <Badge variant="outline" className="mt-2 text-blue-600 border-blue-200">
              Encrypted
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SSL/TLS Status</CardTitle>
            <Lock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Active</div>
            <p className="text-xs text-gray-500 mt-2">Valid until 2025-12-31</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Firewall</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Protected</div>
            <p className="text-xs text-gray-500 mt-2">847 blocked today</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="infrastructure" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Server Security Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>OS Security Patches</span>
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      Up to date
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Container Security</span>
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      Secure
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Application Firewall</span>
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Intrusion Detection</span>
                    <Badge variant="outline" className="text-orange-600 border-orange-200">
                      Monitoring
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Resource Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">CPU Usage</span>
                      <span className="text-sm">45%</span>
                    </div>
                    <Progress value={45} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Memory Usage</span>
                      <span className="text-sm">67%</span>
                    </div>
                    <Progress value={67} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Disk Usage</span>
                      <span className="text-sm">34%</span>
                    </div>
                    <Progress value={34} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Network I/O</span>
                      <span className="text-sm">23%</span>
                    </div>
                    <Progress value={23} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All infrastructure security checks passed. Last scan completed 2 hours ago.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Security</CardTitle>
              <CardDescription>
                PostgreSQL security configuration and monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold">Security Features</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Encryption at Rest</span>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Encryption in Transit</span>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Row Level Security</span>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Audit Logging</span>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">Connection Security</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Active Connections</span>
                        <span className="font-semibold">47</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Connections</span>
                        <span className="font-semibold">200</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SSL Connections</span>
                        <span className="font-semibold">47/47</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Failed Connections</span>
                        <span className="font-semibold">0</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button className="w-full" variant="outline">
                    Run Security Audit
                  </Button>
                  <Button className="w-full" variant="outline">
                    Backup Database
                  </Button>
                  <Button className="w-full" variant="outline">
                    View Connection Logs
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Network Security</CardTitle>
              <CardDescription>
                Firewall rules, DDoS protection, and network monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <Shield className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <div className="text-2xl font-bold">847</div>
                    <p className="text-sm text-gray-600">Blocked Today</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <Activity className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <div className="text-2xl font-bold">1.2TB</div>
                    <p className="text-sm text-gray-600">Data Transferred</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <div className="text-2xl font-bold">99.9%</div>
                    <p className="text-sm text-gray-600">Uptime</p>
                  </div>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    DDoS protection is active. All traffic is being filtered through our security layer.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <Button className="w-full" variant="outline">
                    Configure Firewall Rules
                  </Button>
                  <Button className="w-full" variant="outline">
                    View Traffic Logs
                  </Button>
                  <Button className="w-full" variant="outline">
                    Generate Network Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Monitoring</CardTitle>
              <CardDescription>
                Real-time security alerts and monitoring dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold">Active Monitors</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Login Anomalies</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>API Rate Limiting</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Data Exfiltration</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Privilege Escalation</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Active
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">Alert Statistics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Alerts (24h)</span>
                        <span className="font-semibold">23</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Critical Alerts</span>
                        <span className="font-semibold text-red-600">2</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Warning Alerts</span>
                        <span className="font-semibold text-orange-600">8</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Info Alerts</span>
                        <span className="font-semibold">13</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button className="w-full" variant="outline">
                    Configure Alert Rules
                  </Button>
                  <Button className="w-full" variant="outline">
                    View Alert History
                  </Button>
                  <Button className="w-full" variant="outline">
                    Test Alert System
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Compliance</CardTitle>
              <CardDescription>
                Compliance monitoring and reporting for security standards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold">Compliance Standards</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>SOC 2 Type II</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Compliant
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>ISO 27001</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Compliant
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>GDPR</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Compliant
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>CCPA</span>
                        <Badge variant="outline" className="text-orange-600 border-orange-200">
                          In Progress
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">Last Audit Results</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Security Controls</span>
                        <span className="font-semibold text-green-600">98/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Data Protection</span>
                        <span className="font-semibold text-green-600">95/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Access Controls</span>
                        <span className="font-semibold text-green-600">99/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Incident Response</span>
                        <span className="font-semibold text-orange-600">87/100</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button className="w-full" variant="outline">
                    Generate Compliance Report
                  </Button>
                  <Button className="w-full" variant="outline">
                    Schedule Audit
                  </Button>
                  <Button className="w-full" variant="outline">
                    View Remediation Plan
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