import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Settings,
  Plug,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Key,
  Database,
  Webhook,
  Cloud,
  Zap,
  RefreshCw,
  Shield,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  provider: string;
  lastSync: string;
  config?: {
    apiKey?: string;
    endpoint?: string;
    syncFrequency?: string;
  };
}

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  lastTriggered: string;
  successRate: number;
}

export default function SystemIntegrations() {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { toast } = useToast();

  const { data: integrations, isLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
  });

  const { data: webhooks } = useQuery<WebhookEndpoint[]>({
    queryKey: ["/api/webhooks"],
  });

  const connectIntegration = useMutation({
    mutationFn: async (data: { integrationId: string; config: any }) => {
      return apiRequest("/api/integrations/connect", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integration Connected",
        description: "The integration has been successfully configured.",
      });
      setIsConfigOpen(false);
    },
    onError: () => {
      toast({
        title: "Connection Failed",
        description: "Failed to connect the integration. Please check your configuration.",
        variant: "destructive",
      });
    },
  });

  const disconnectIntegration = useMutation({
    mutationFn: async (integrationId: string) => {
      return apiRequest(`/api/integrations/${integrationId}/disconnect`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integration Disconnected",
        description: "The integration has been disconnected.",
      });
    },
  });

  const testIntegration = useMutation({
    mutationFn: async (integrationId: string) => {
      return apiRequest(`/api/integrations/${integrationId}/test`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Test Successful",
        description: "The integration is working correctly.",
      });
    },
    onError: () => {
      toast({
        title: "Test Failed",
        description: "The integration test failed. Please check your configuration.",
        variant: "destructive",
      });
    },
  });

  // Use real database integrations data
  const displayIntegrations = integrations || [];

  // Use real database webhooks data
  const displayWebhooks = webhooks || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'disconnected':
        return <XCircle className="h-5 w-5 text-gray-400" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <RefreshCw className="h-5 w-5 text-yellow-600 animate-spin" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      connected: 'default',
      disconnected: 'secondary', 
      error: 'destructive',
      pending: 'outline'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <MainLayout 
      title="System Integrations" 
      description="Manage third-party integrations and API connections"
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Active Integrations</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {displayIntegrations.filter(i => i.status === 'connected').length}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Plug className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">API Endpoints</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {displayIntegrations.filter(i => i.status === 'pending' || i.status === 'error').length}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Database className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Webhooks</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{displayWebhooks.length}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Webhook className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">99.2%</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="integrations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="integrations">Available Integrations</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="api-keys">API Management</TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="space-y-6">
            <div className="grid gap-6">
              {['Device Management', 'Accounting', 'CRM'].map((category) => (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      {category}
                    </CardTitle>
                    <CardDescription>
                      Manage {category.toLowerCase()} system integrations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {displayIntegrations
                        .filter(integration => integration.category === category)
                        .map((integration) => (
                          <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                              {getStatusIcon(integration.status)}
                              <div>
                                <h4 className="font-medium">{integration.name}</h4>
                                <p className="text-sm text-gray-600">{integration.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {getStatusBadge(integration.status)}
                                  <span className="text-xs text-gray-500">
                                    Last sync: {integration.lastSync === 'Never' ? 'Never' : 
                                      new Date(integration.lastSync).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {integration.status === 'connected' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => testIntegration.mutate(integration.id)}
                                    disabled={testIntegration.isPending}
                                  >
                                    Test
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => disconnectIntegration.mutate(integration.id)}
                                    disabled={disconnectIntegration.isPending}
                                  >
                                    Disconnect
                                  </Button>
                                </>
                              )}
                              {integration.status !== 'connected' && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedIntegration(integration);
                                    setIsConfigOpen(true);
                                  }}
                                >
                                  {integration.status === 'pending' ? 'Configure' : 'Connect'}
                                </Button>
                              )}
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Webhook Endpoints</CardTitle>
                    <CardDescription>Configure webhook endpoints for real-time event notifications</CardDescription>
                  </div>
                  <Button>
                    <Webhook className="h-4 w-4 mr-2" />
                    Add Webhook
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockWebhooks.map((webhook) => (
                    <div key={webhook.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{webhook.name}</h4>
                        <p className="text-sm text-gray-600">{webhook.url}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}>
                            {webhook.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            Success rate: {webhook.successRate}%
                          </span>
                          <span className="text-xs text-gray-500">
                            Last triggered: {new Date(webhook.lastTriggered).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={webhook.status === 'active'} />
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api-keys" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Keys & Authentication</CardTitle>
                    <CardDescription>Manage API keys and authentication tokens</CardDescription>
                  </div>
                  <Button>
                    <Key className="h-4 w-4 mr-2" />
                    Generate API Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Production API Key</h4>
                        <p className="text-sm text-gray-600 font-mono">pk_live_••••••••••••••••</p>
                        <p className="text-xs text-gray-500 mt-1">Created: Dec 15, 2024 • Last used: 2 hours ago</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>Active</Badge>
                        <Button variant="outline" size="sm">Regenerate</Button>
                        <Button variant="ghost" size="sm" className="text-red-600">Revoke</Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Development API Key</h4>
                        <p className="text-sm text-gray-600 font-mono">pk_test_••••••••••••••••</p>
                        <p className="text-xs text-gray-500 mt-1">Created: Dec 10, 2024 • Last used: 1 day ago</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Test</Badge>
                        <Button variant="outline" size="sm">Regenerate</Button>
                        <Button variant="ghost" size="sm" className="text-red-600">Revoke</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Integration Configuration Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configure {selectedIntegration?.name}</DialogTitle>
            <DialogDescription>
              Enter the connection details for {selectedIntegration?.name} integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                placeholder="Enter your API key"
                type="password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint URL</Label>
              <Input
                id="endpoint"
                placeholder="https://api.example.com/v1"
                defaultValue={selectedIntegration?.config?.endpoint}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-frequency">Sync Frequency</Label>
              <Select defaultValue="hourly">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Real-time</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => connectIntegration.mutate({
                integrationId: selectedIntegration?.id || '',
                config: { apiKey: 'test', endpoint: 'test' }
              })}
              disabled={connectIntegration.isPending}
            >
              Connect Integration
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}