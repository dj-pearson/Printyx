import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Database,
  Users,
  DollarSign,
  Activity,
  Clock,
  Zap
} from "lucide-react";
import { useExternalIntegrations } from "@/hooks/useExternalIntegrations";
import { useToast } from "@/hooks/use-toast";

export function ExternalIntegrationsDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const integrations = useExternalIntegrations();
  const { toast } = useToast();

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleBulkSync = async () => {
    try {
      await integrations.bulkSync.mutateAsync(['eautomate', 'salesforce', 'quickbooks']);
      toast({ title: "Bulk sync initiated", description: "All integrations are syncing" });
    } catch (error) {
      toast({ title: "Sync failed", description: "Please check integration settings", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">External Integrations</h1>
        <div className="flex gap-2">
          <Button onClick={handleBulkSync} disabled={integrations.bulkSync.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${integrations.bulkSync.isPending ? 'animate-spin' : ''}`} />
            Sync All
          </Button>
        </div>
      </div>

      {/* Integration Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {integrations.integrationStatuses.data?.map((integration) => (
          <Card key={integration.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {integration.name === 'E-Automate' && <Database className="h-5 w-5" />}
                  {integration.name === 'Salesforce' && <Users className="h-5 w-5" />}
                  {integration.name === 'QuickBooks' && <DollarSign className="h-5 w-5" />}
                  <h3 className="font-semibold">{integration.name}</h3>
                </div>
                {getHealthIcon(integration.health)}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Status</span>
                  <Badge variant={integration.connected ? "default" : "destructive"}>
                    {integration.connected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Records</span>
                  <span className="font-medium">{integration.recordCount.toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Last Sync</span>
                  <span className="text-muted-foreground">
                    {integration.lastSync ? new Date(integration.lastSync).toLocaleDateString() : 'Never'}
                  </span>
                </div>
                
                {integration.errorCount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Errors</span>
                    <span>{integration.errorCount}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="eautomate">E-Automate</TabsTrigger>
          <TabsTrigger value="salesforce">Salesforce</TabsTrigger>
          <TabsTrigger value="quickbooks">QuickBooks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Integration Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">96%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">2.1s</div>
                  <div className="text-sm text-muted-foreground">Avg Response</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">1,247</div>
                  <div className="text-sm text-muted-foreground">Daily Syncs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">99.2%</div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eautomate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                E-Automate Integration Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {integrations.eAutomate.config.data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="customer-sync">Customer Sync</Label>
                      <Switch
                        id="customer-sync"
                        checked={integrations.eAutomate.config.data.customerSync}
                        onCheckedChange={(checked) =>
                          integrations.eAutomate.updateConfig.mutate({ customerSync: checked })
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="equipment-sync">Equipment Sync</Label>
                      <Switch
                        id="equipment-sync"
                        checked={integrations.eAutomate.config.data.equipmentSync}
                        onCheckedChange={(checked) =>
                          integrations.eAutomate.updateConfig.mutate({ equipmentSync: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="service-sync">Service Sync</Label>
                      <Switch
                        id="service-sync"
                        checked={integrations.eAutomate.config.data.serviceSync}
                        onCheckedChange={(checked) =>
                          integrations.eAutomate.updateConfig.mutate({ serviceSync: checked })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="meter-reading-sync">Meter Reading Sync</Label>
                      <Switch
                        id="meter-reading-sync"
                        checked={integrations.eAutomate.config.data.meterReadingSync}
                        onCheckedChange={(checked) =>
                          integrations.eAutomate.updateConfig.mutate({ meterReadingSync: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="invoice-sync">Invoice Sync</Label>
                      <Switch
                        id="invoice-sync"
                        checked={integrations.eAutomate.config.data.invoiceSync}
                        onCheckedChange={(checked) =>
                          integrations.eAutomate.updateConfig.mutate({ invoiceSync: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-sync">Auto Sync</Label>
                      <Switch
                        id="auto-sync"
                        checked={integrations.eAutomate.config.data.autoSyncEnabled}
                        onCheckedChange={(checked) =>
                          integrations.eAutomate.updateConfig.mutate({ autoSyncEnabled: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => integrations.eAutomate.triggerSync.mutate('full')}
                  disabled={integrations.eAutomate.triggerSync.isPending}
                >
                  Full Sync
                </Button>
                <Button
                  variant="outline"
                  onClick={() => integrations.eAutomate.triggerSync.mutate('incremental')}
                  disabled={integrations.eAutomate.triggerSync.isPending}
                >
                  Incremental Sync
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salesforce" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Salesforce Integration Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {integrations.salesforce.config.data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="lead-sync">Lead Sync</Label>
                      <Switch
                        id="lead-sync"
                        checked={integrations.salesforce.config.data.leadSync}
                        onCheckedChange={(checked) =>
                          integrations.salesforce.updateConfig.mutate({ leadSync: checked })
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="account-sync">Account Sync</Label>
                      <Switch
                        id="account-sync"
                        checked={integrations.salesforce.config.data.accountSync}
                        onCheckedChange={(checked) =>
                          integrations.salesforce.updateConfig.mutate({ accountSync: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="opportunity-sync">Opportunity Sync</Label>
                      <Switch
                        id="opportunity-sync"
                        checked={integrations.salesforce.config.data.opportunitySync}
                        onCheckedChange={(checked) =>
                          integrations.salesforce.updateConfig.mutate({ opportunitySync: checked })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="activity-sync">Activity Sync</Label>
                      <Switch
                        id="activity-sync"
                        checked={integrations.salesforce.config.data.activitySync}
                        onCheckedChange={(checked) =>
                          integrations.salesforce.updateConfig.mutate({ activitySync: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="contact-sync">Contact Sync</Label>
                      <Switch
                        id="contact-sync"
                        checked={integrations.salesforce.config.data.contactSync}
                        onCheckedChange={(checked) =>
                          integrations.salesforce.updateConfig.mutate({ contactSync: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="real-time-sync">Real-time Sync</Label>
                      <Switch
                        id="real-time-sync"
                        checked={integrations.salesforce.config.data.realTimeSync}
                        onCheckedChange={(checked) =>
                          integrations.salesforce.updateConfig.mutate({ realTimeSync: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => integrations.salesforce.triggerSync.mutate(['leads', 'accounts', 'opportunities'])}
                  disabled={integrations.salesforce.triggerSync.isPending}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Sync All Entities
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quickbooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                QuickBooks Integration Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {integrations.quickBooks.config.data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="qb-customer-sync">Customer Sync</Label>
                      <Switch
                        id="qb-customer-sync"
                        checked={integrations.quickBooks.config.data.customerSync}
                        onCheckedChange={(checked) =>
                          integrations.quickBooks.updateConfig.mutate({ customerSync: checked })
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="qb-invoice-sync">Invoice Sync</Label>
                      <Switch
                        id="qb-invoice-sync"
                        checked={integrations.quickBooks.config.data.invoiceSync}
                        onCheckedChange={(checked) =>
                          integrations.quickBooks.updateConfig.mutate({ invoiceSync: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="qb-payment-sync">Payment Sync</Label>
                      <Switch
                        id="qb-payment-sync"
                        checked={integrations.quickBooks.config.data.paymentSync}
                        onCheckedChange={(checked) =>
                          integrations.quickBooks.updateConfig.mutate({ paymentSync: checked })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="qb-item-sync">Item Sync</Label>
                      <Switch
                        id="qb-item-sync"
                        checked={integrations.quickBooks.config.data.itemSync}
                        onCheckedChange={(checked) =>
                          integrations.quickBooks.updateConfig.mutate({ itemSync: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="qb-auto-reconciliation">Auto Reconciliation</Label>
                      <Switch
                        id="qb-auto-reconciliation"
                        checked={integrations.quickBooks.config.data.automaticReconciliation}
                        onCheckedChange={(checked) =>
                          integrations.quickBooks.updateConfig.mutate({ automaticReconciliation: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="qb-duplicate-detection">Duplicate Detection</Label>
                      <Switch
                        id="qb-duplicate-detection"
                        checked={integrations.quickBooks.config.data.duplicateDetection}
                        onCheckedChange={(checked) =>
                          integrations.quickBooks.updateConfig.mutate({ duplicateDetection: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => integrations.quickBooks.triggerSync.mutate(['customers', 'invoices', 'payments'])}
                  disabled={integrations.quickBooks.triggerSync.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Financial Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ExternalIntegrationsDashboard;