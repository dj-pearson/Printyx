import { useState } from "react";
import MainLayout from "@/components/layout/main-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalIntegrationsDashboard } from "@/components/integrations/ExternalIntegrationsDashboard";
import { CrossModuleIntegration } from "@/components/CrossModuleIntegration";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  RefreshCw, 
  Database, 
  Users, 
  DollarSign,
  GitBranch,
  Activity,
  Zap,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

export default function Integrations() {
  const [activeTab, setActiveTab] = useState("external");

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Integrations</h1>
            <p className="text-gray-600 mt-2">
              Manage external system connections and cross-module data flow
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              All Systems Online
            </Badge>
          </div>
        </div>

        {/* Integration Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <Database className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <h3 className="font-semibold text-lg">E-Automate</h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">Connected</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">24,891 records synced</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 mx-auto text-purple-600 mb-2" />
              <h3 className="font-semibold text-lg">Salesforce</h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">Connected</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">3,247 leads synced</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <DollarSign className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <h3 className="font-semibold text-lg">QuickBooks</h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">Connected</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">1,892 invoices synced</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <GitBranch className="h-8 w-8 mx-auto text-orange-600 mb-2" />
              <h3 className="font-semibold text-lg">Cross-Module</h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">98% Health</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">247 daily syncs</p>
            </CardContent>
          </Card>
        </div>

        {/* Integration Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="external" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              External Systems
            </TabsTrigger>
            <TabsTrigger value="cross-module" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Cross-Module Flow
            </TabsTrigger>
          </TabsList>

          <TabsContent value="external">
            <ExternalIntegrationsDashboard />
          </TabsContent>

          <TabsContent value="cross-module">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Cross-Module Data Flow Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-6">
                    Monitor and manage automated workflows between Customer Records, Service Dispatch, 
                    Inventory Management, and Billing Systems.
                  </p>
                  
                  <CrossModuleIntegration className="mt-6" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Integration Health Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">96.8%</div>
                <div className="text-sm text-gray-600">Overall Success Rate</div>
                <div className="text-xs text-gray-500 mt-1">Last 30 days</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">1.8s</div>
                <div className="text-sm text-gray-600">Avg Response Time</div>
                <div className="text-xs text-gray-500 mt-1">All endpoints</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">99.2%</div>
                <div className="text-sm text-gray-600">System Uptime</div>
                <div className="text-xs text-gray-500 mt-1">This month</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}