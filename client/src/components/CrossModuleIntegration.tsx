import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Activity, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Zap,
  GitBranch,
  Clock
} from "lucide-react";
import { useCrossModuleIntegration, useWorkflowAutomation } from "@/hooks/useCrossModuleIntegration";

interface CrossModuleIntegrationProps {
  customerId?: string;
  serviceTicketId?: string;
  equipmentId?: string;
  className?: string;
}

export function CrossModuleIntegration({ 
  customerId, 
  serviceTicketId, 
  equipmentId,
  className 
}: CrossModuleIntegrationProps) {
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const crossModule = useCrossModuleIntegration();
  const workflows = useWorkflowAutomation();

  // Integration health status
  const integrationHealth = crossModule.integrationStatus.data?.healthy ? 100 : 
                           crossModule.integrationStatus.isLoading ? 0 : 75;

  const dataFlowSteps = [
    {
      id: 1,
      name: "Customer Data",
      description: "Customer information and requirements",
      status: "complete",
      module: "Customer Records",
      nextStep: 2
    },
    {
      id: 2,
      name: "Service Creation",
      description: "Automated service ticket generation",
      status: crossModule.isIntegrationHealthy ? "complete" : "pending",
      module: "Service Dispatch",
      nextStep: 3,
      trigger: () => customerId && workflows.automateCustomerToService(customerId, {
        type: "maintenance",
        priority: "medium"
      })
    },
    {
      id: 3,
      name: "Inventory Check",
      description: "Parts availability and procurement",
      status: crossModule.checkPartsAvailability.data ? "complete" : "pending",
      module: "Inventory Management",
      nextStep: 4
    },
    {
      id: 4,
      name: "Billing Generation",
      description: "Automated invoice creation",
      status: serviceTicketId ? "complete" : "pending",
      module: "Billing System",
      nextStep: null,
      trigger: () => serviceTicketId && workflows.automateServiceToBilling(serviceTicketId, {
        customerId: customerId,
        completedItems: []
      })
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete": return "text-green-600";
      case "pending": return "text-yellow-600";
      case "error": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete": return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "pending": return <Clock className="h-4 w-4 text-yellow-600" />;
      case "error": return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Integration Health Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Cross-Module Integration Health
            </CardTitle>
            <Badge variant={integrationHealth > 90 ? "default" : integrationHealth > 70 ? "secondary" : "destructive"}>
              {integrationHealth}% Healthy
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={integrationHealth} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Last sync: {crossModule.lastSyncTime ? new Date(crossModule.lastSyncTime).toLocaleTimeString() : 'Never'}
              </span>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={automationEnabled} 
                  onCheckedChange={setAutomationEnabled}
                  id="automation-toggle"
                />
                <Label htmlFor="automation-toggle" className="text-sm">Auto-sync enabled</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Flow Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Customer → Service → Inventory → Billing Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dataFlowSteps.map((step, index) => (
              <div key={step.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                <div className="flex-shrink-0">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{step.name}</h4>
                    <Badge variant="outline" className="text-xs">{step.module}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {step.trigger && step.status === "pending" && automationEnabled && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={step.trigger}
                    className="flex-shrink-0"
                  >
                    Trigger
                  </Button>
                )}
                {step.nextStep && index < dataFlowSteps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Equipment Lifecycle Integration */}
      {equipmentId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Equipment Lifecycle → Service Automation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <h4 className="font-medium">Predictive Maintenance</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically schedule maintenance based on equipment data
                  </p>
                </div>
                <Button 
                  size="sm"
                  onClick={() => customerId && equipmentId && 
                    workflows.automateEquipmentMaintenance(equipmentId, customerId)
                  }
                  disabled={!customerId || !equipmentId}
                >
                  Schedule
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded">
                <div>
                  <h4 className="font-medium">Parts Availability Check</h4>
                  <p className="text-sm text-muted-foreground">
                    Real-time parts availability for service dispatch
                  </p>
                </div>
                <Badge variant={
                  crossModule.checkPartsAvailability.data?.available ? "default" : 
                  crossModule.checkPartsAvailability.isLoading ? "secondary" : "destructive"
                }>
                  {crossModule.checkPartsAvailability.isLoading ? "Checking..." :
                   crossModule.checkPartsAvailability.data?.available ? "Available" : "Check Required"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">98%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">1.2s</div>
              <div className="text-sm text-muted-foreground">Avg Response</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">247</div>
              <div className="text-sm text-muted-foreground">Daily Syncs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">99.8%</div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CrossModuleIntegration;