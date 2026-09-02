import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, extractRecords, queryClient } from '@/lib/queryClient';
import {
  INTEGRATION_CATEGORIES,
  STATUS_LABEL,
  isLiveStatus,
  normalizeCategory,
  normalizeStatus,
  type IntegrationStatus,
} from '@/lib/integration-status';
import { ApolloCredentialManager } from '@/components/integrations/ApolloCredentialManager';

// Mirrors platform_integrations (shared/platform-integrations-schema.ts) - the
// connector catalogue, which PA-053 settled as the table behind this page. It is
// the only one of the two candidates with a `category` column, it is what
// production has always served /api/integrations from, and it is what the
// integration hub dashboard reads. system_integrations stays the OAuth
// CONNECTION store for the calendar and ERP flows (PA-056).
//
// `description` was on the old shape and is a column on neither table.
interface Integration {
  id: string;
  integrationKey: string;
  integrationName: string;
  category: string;
  status: string;
  syncFrequency?: string | null;
  lastSyncedAt?: string | null;
  lastSyncStatus?: string | null;
  lastErrorMessage?: string | null;
}

/** The page's view of a row: raw columns plus the normalized vocabularies. */
// PostgREST returns snake_case; the Express list camelCases. Either is read.
type IntegrationRow = Record<string, string | null | undefined>;

interface IntegrationView extends Integration {
  normalizedStatus: IntegrationStatus;
  normalizedCategory: string;
}

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  // PA-046: delivery-stats tracking does not exist yet, so these are null from
  // the API rather than fabricated numbers.
  lastTriggered: string | null;
  successRate: number | null;
}

interface IntegrationTestResult {
  success?: boolean;
  message?: string;
  // False whenever the backend only inspected stored configuration. Both
  // backends set it that way for every type they have no provider client for.
  connectivityVerified?: boolean;
  checkedFields?: string[];
  missingFields?: string[];
}

export default function SystemIntegrations() {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  // PA-053: the Connect button used to post a hardcoded
  // `config: { apiKey: 'test', endpoint: 'test' }` and ignore all three inputs,
  // so it stored the literal string 'test' as an API key.
  const [configForm, setConfigForm] = useState({
    apiKey: '',
    endpoint: '',
    syncFrequency: 'hourly',
  });
  const { toast } = useToast();

  // PA-052: the two backends disagree about this response. Express returns a bare
  // array; the integrations edge function returns { data, total, page, limit }, so
  // `integrations.filter(...)` below threw "filter is not a function" and blanked
  // the whole page in production. extractRecords tolerates either.
  const { data: integrationsResponse, isLoading } = useQuery({
    queryKey: ['/api/integrations'],
  });
  const integrations: IntegrationView[] = extractRecords<IntegrationRow>(integrationsResponse).map(
    (row) => {
      // Both backends are on platform_integrations now, but one returns snake_case
      // (PostgREST) and the Express list camelCases; read either.
      const integration: Integration = {
        id: String(row.id ?? ''),
        integrationKey: String(row.integrationKey ?? row.integration_key ?? ''),
        integrationName: String(
          row.integrationName ?? row.integration_name ?? row.integration_key ?? 'Integration',
        ),
        category: String(row.category ?? ''),
        status: String(row.status ?? ''),
        syncFrequency: row.syncFrequency ?? row.sync_frequency ?? null,
        lastSyncedAt: row.lastSyncedAt ?? row.last_synced_at ?? null,
        lastSyncStatus: row.lastSyncStatus ?? row.last_sync_status ?? null,
        lastErrorMessage: row.lastErrorMessage ?? row.last_error_message ?? null,
      };
      return {
        ...integration,
        normalizedStatus: normalizeStatus(integration.status),
        normalizedCategory: normalizeCategory(integration.category),
      };
    },
  );

  const { data: webhooksResponse } = useQuery({
    queryKey: ['/api/webhooks'],
  });
  const webhooks = extractRecords<WebhookEndpoint>(webhooksResponse);

  const connectIntegration = useMutation({
    mutationFn: async (data: {
      integrationId: string;
      credentials: Record<string, string>;
      syncFrequency: string;
    }) =>
      // /api/integrations/connect had no branch on either host: the edge
      // function's connect is POST /:type/connect keyed on an integration TYPE,
      // and this page holds a row id. Credentials belong on the row.
      apiRequest(`/api/integrations/${data.integrationId}`, {
        method: 'PUT',
        body: {
          credentials: data.credentials,
          syncFrequency: data.syncFrequency,
          status: 'configured',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({
        title: 'Integration Configured',
        description: 'Credentials stored. Connectivity is verified by Test.',
      });
      setIsConfigOpen(false);
      setConfigForm({ apiKey: '', endpoint: '', syncFrequency: 'hourly' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Configuration Failed',
        description: error?.message ?? 'The integration could not be configured.',
        variant: 'destructive',
      });
    },
  });

  const disconnectIntegration = useMutation({
    mutationFn: async (integrationId: string) => {
      return apiRequest(`/api/integrations/${integrationId}/disconnect`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({
        title: 'Integration Disconnected',
        description: 'The integration has been disconnected.',
      });
    },
  });

  // The server says what it checked; repeat that rather than asserting the
  // integration "is working correctly" — neither backend contacts the provider
  // on every type, so a blanket success claim would not be true.
  const testIntegration = useMutation<IntegrationTestResult, Error, string>({
    mutationFn: async (integrationId: string) => {
      return apiRequest(`/api/integrations/${integrationId}/test`, {
        method: 'POST',
      });
    },
    onSuccess: (result) => {
      toast({
        title: result?.success === false ? 'Test Failed' : 'Test Complete',
        description: result?.message ?? 'The integration test returned no detail.',
        variant: result?.success === false ? 'destructive' : 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Test Failed',
        description: error?.message ?? 'The integration test could not be run.',
        variant: 'destructive',
      });
    },
  });

  const displayIntegrations = integrations;
  const displayWebhooks = webhooks;

  const getStatusIcon = (status: IntegrationStatus) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'configured':
        return <RefreshCw className="h-5 w-5 text-yellow-600" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: IntegrationStatus) => {
    const variants: Record<IntegrationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> =
      {
        active: 'default',
        configured: 'outline',
        error: 'destructive',
        paused: 'secondary',
        disconnected: 'secondary',
      };

    return <Badge variant={variants[status]}>{STATUS_LABEL[status]}</Badge>;
  };

  return (
    <MainLayout
      title="System Integrations"
      description="Manage third-party integrations and API connections"
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">
                    Active Integrations
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {displayIntegrations.filter((i) => isLiveStatus(i.normalizedStatus)).length}
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
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Needs Attention</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {displayIntegrations.filter((i) => i.normalizedStatus === 'error').length}
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
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {displayWebhooks.length}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Webhook className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* A "Success Rate" card sat here reading a typed-in 99.2%. Nothing on
              either backend measures per-integration success rate for this page,
              so it is gone rather than relabelled. */}
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
              {/* PA-053: this was hardcoded to Device Management / Accounting /
                  CRM. platform_integrations.category holds erp / crm / ai /
                  data-enrichment, so all three groups filtered to nothing and
                  the list was empty whatever the backend answered. A row whose
                  category is absent or unrecognised lands in Other rather than
                  being dropped from every group. An empty category renders no
                  card at all, so an empty tenant does not show a wall of empty
                  headings. */}
              {INTEGRATION_CATEGORIES.filter((category) =>
                displayIntegrations.some((i) => i.normalizedCategory === category.value),
              ).map((category) => (
                <Card key={category.value}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      {category.label}
                    </CardTitle>
                    <CardDescription>Manage {category.label} system integrations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {displayIntegrations
                        .filter((integration) => integration.normalizedCategory === category.value)
                        .map((integration) => (
                          <div
                            key={integration.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              {getStatusIcon(integration.normalizedStatus)}
                              <div>
                                <h4 className="font-medium">{integration.integrationName}</h4>
                                {/* `description` was on the old shape and is a
                                    column on neither candidate table. The last
                                    error is real and is what a reader needs. */}
                                {integration.lastErrorMessage && (
                                  <p className="text-sm text-red-600">
                                    {integration.lastErrorMessage}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  {getStatusBadge(integration.normalizedStatus)}
                                  <span className="text-xs text-gray-500">
                                    Last sync:{' '}
                                    {integration.lastSyncedAt
                                      ? new Date(integration.lastSyncedAt).toLocaleString()
                                      : 'Never'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isLiveStatus(integration.normalizedStatus) && (
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
                              {!isLiveStatus(integration.normalizedStatus) && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedIntegration(integration);
                                    setIsConfigOpen(true);
                                  }}
                                >
                                  {integration.normalizedStatus === 'error'
                                    ? 'Reconfigure'
                                    : 'Connect'}
                                </Button>
                              )}
                              <Button aria-label="Open in a new tab" variant="ghost" size="sm">
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
                    <CardDescription>
                      Configure webhook endpoints for real-time event notifications
                    </CardDescription>
                  </div>
                  <Button>
                    <Webhook className="h-4 w-4 mr-2" />
                    Add Webhook
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(webhooks || []).map((webhook) => (
                    <div
                      key={webhook.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{webhook.name}</h4>
                        <p className="text-sm text-gray-600">{webhook.url}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}>
                            {webhook.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {webhook.successRate != null
                              ? `Success rate: ${webhook.successRate}%`
                              : 'Delivery stats not tracked'}
                          </span>
                          {webhook.lastTriggered && (
                            <span className="text-xs text-gray-500">
                              Last triggered: {new Date(webhook.lastTriggered).toLocaleString()}
                            </span>
                          )}
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
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button aria-label="Open in a new tab" variant="ghost" size="sm">
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
            {/* Apollo.io Lead Enrichment API Configuration */}
            <ApolloCredentialManager />

            {/* Platform API Keys - Internal use */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Platform API Keys</CardTitle>
                    <CardDescription>Internal API keys for platform integrations</CardDescription>
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
                        <p className="text-xs text-gray-500 mt-1">
                          Created: Dec 15, 2024 • Last used: 2 hours ago
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>Active</Badge>
                        <Button variant="outline" size="sm">
                          Regenerate
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600">
                          Revoke
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Development API Key</h4>
                        <p className="text-sm text-gray-600 font-mono">pk_test_••••••••••••••••</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: Dec 10, 2024 • Last used: 1 day ago
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Test</Badge>
                        <Button variant="outline" size="sm">
                          Regenerate
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600">
                          Revoke
                        </Button>
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
            <DialogTitle>Configure {selectedIntegration?.integrationName}</DialogTitle>
            <DialogDescription>
              Enter the connection details for {selectedIntegration?.integrationName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                placeholder="Enter your API key"
                type="password"
                value={configForm.apiKey}
                onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint URL</Label>
              <Input
                id="endpoint"
                placeholder="https://api.example.com/v1"
                value={configForm.endpoint}
                onChange={(e) => setConfigForm({ ...configForm, endpoint: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-frequency">Sync Frequency</Label>
              <Select
                value={configForm.syncFrequency}
                onValueChange={(value) => setConfigForm({ ...configForm, syncFrequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* platform_integrations.sync_frequency documents
                      manual | hourly | daily | weekly. "Real-time" was not among
                      them and nothing schedules one. */}
                  <SelectItem value="manual">Manual</SelectItem>
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
              onClick={() =>
                connectIntegration.mutate({
                  integrationId: selectedIntegration?.id || '',
                  credentials: {
                    ...(configForm.apiKey ? { apiKey: configForm.apiKey } : {}),
                    ...(configForm.endpoint ? { endpoint: configForm.endpoint } : {}),
                  },
                  syncFrequency: configForm.syncFrequency,
                })
              }
              disabled={connectIntegration.isPending || !configForm.apiKey}
            >
              Save Credentials
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
