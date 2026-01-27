import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Plus, Zap, RefreshCw, X, Check, AlertCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

const integrationConfigSchema = z.object({
  integrationKey: z.string(),
  integrationName: z.string(),
  credentials: z.record(z.string()),
});

const AVAILABLE_INTEGRATIONS = [
  // CRITICAL FOR COPIER DEALERS
  {
    key: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Sync invoices, customers, financial data & meter billing',
    icon: '💰',
    category: 'Accounting',
    priority: 'critical',
    fields: [
      { name: 'realmId', label: 'Realm ID', type: 'text' },
      { name: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },
  {
    key: 'e-automate',
    name: 'E-Automate',
    description: 'Industry standard ERP - equipment, service, contracts, meter reads',
    icon: '⚙️',
    category: 'ERP',
    priority: 'critical',
    fields: [
      { name: 'sessionToken', label: 'Session Token', type: 'password' },
      { name: 'dealerCode', label: 'Dealer Code', type: 'text' },
    ],
  },
  {
    key: 'stripe',
    name: 'Stripe',
    description: 'Payment processing for invoices and recurring billing',
    icon: '💳',
    category: 'Payments',
    priority: 'critical',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
      { name: 'webhookSecret', label: 'Webhook Secret', type: 'password' },
    ],
  },
  // COMMUNICATIONS & NOTIFICATIONS
  {
    key: 'twilio',
    name: 'Twilio',
    description: 'SMS notifications for service alerts, tech dispatch, customer updates',
    icon: '📱',
    category: 'Communications',
    priority: 'high',
    fields: [
      { name: 'accountSid', label: 'Account SID', type: 'password' },
      { name: 'authToken', label: 'Auth Token', type: 'password' },
      {
        name: 'phoneNumber',
        label: 'From Phone Number',
        type: 'text',
        placeholder: '+15551234567',
      },
    ],
  },
  {
    key: 'sendgrid',
    name: 'SendGrid',
    description: 'Transactional emails for invoices, contracts, service notifications',
    icon: '✉️',
    category: 'Communications',
    priority: 'high',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
      { name: 'fromEmail', label: 'From Email', type: 'email' },
    ],
  },
  // CRM & SALES
  {
    key: 'salesforce',
    name: 'Salesforce CRM',
    description: 'Sync leads, opportunities, and customer interactions',
    icon: '☁️',
    category: 'CRM',
    priority: 'high',
    fields: [
      {
        name: 'instanceUrl',
        label: 'Instance URL',
        type: 'text',
        placeholder: 'https://your-instance.salesforce.com',
      },
      { name: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },
  {
    key: 'connectwise',
    name: 'ConnectWise',
    description: 'PSA/FSM integration for service ticket and tech scheduling',
    icon: '🛠️',
    category: 'PSA/FSM',
    priority: 'high',
    fields: [
      {
        name: 'apiUrl',
        label: 'API URL',
        type: 'text',
        placeholder: 'https://api-na.myconnectwise.net',
      },
      { name: 'clientId', label: 'Client ID', type: 'text' },
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },
  // PRINT MONITORING (METER BILLING)
  {
    key: 'print-audit',
    name: 'Print Audit (DCA)',
    description: 'Automated meter collection from copier devices',
    icon: '📊',
    category: 'Fleet Monitoring',
    priority: 'high',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
      { name: 'accountId', label: 'Account ID', type: 'text' },
    ],
  },
  {
    key: 'printfleet',
    name: 'PrintFleet (DCA)',
    description: 'Real-time device monitoring and meter tracking',
    icon: '🖨️',
    category: 'Fleet Monitoring',
    priority: 'high',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
      { name: 'customerId', label: 'Customer ID', type: 'text' },
    ],
  },
  {
    key: 'fmauit',
    name: 'FM Audit (DCA)',
    description: 'Fleet meter auditing and usage analytics',
    icon: '📈',
    category: 'Fleet Monitoring',
    priority: 'medium',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
      { name: 'clientCode', label: 'Client Code', type: 'text' },
    ],
  },
  // SCHEDULING & COLLABORATION
  {
    key: 'google-calendar',
    name: 'Google Calendar',
    description: 'Tech scheduling, service appointments, meetings',
    icon: '📅',
    category: 'Scheduling',
    priority: 'medium',
    fields: [
      { name: 'clientEmail', label: 'Service Account Email', type: 'email' },
      { name: 'privateKey', label: 'Private Key', type: 'password' },
    ],
  },
  {
    key: 'slack',
    name: 'Slack',
    description: 'Team notifications for service alerts, approvals, updates',
    icon: '💬',
    category: 'Collaboration',
    priority: 'medium',
    fields: [
      { name: 'botToken', label: 'Bot Token', type: 'password' },
      { name: 'webhookUrl', label: 'Webhook URL', type: 'password' },
    ],
  },
  // DATA ENRICHMENT & LEAD GEN
  {
    key: 'apollo',
    name: 'Apollo.io',
    description: 'Prospect and lead enrichment for B2B outreach',
    icon: '🎯',
    category: 'Data Enrichment',
    priority: 'medium',
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    key: 'zoominfo',
    name: 'ZoomInfo',
    description: 'Company and contact data enrichment',
    icon: '🔍',
    category: 'Data Enrichment',
    priority: 'medium',
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  // EMAIL MARKETING
  {
    key: 'mailchimp',
    name: 'Mailchimp',
    description: 'Email marketing campaigns and automation',
    icon: '📬',
    category: 'Marketing',
    priority: 'low',
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
      { name: 'listId', label: 'List ID', type: 'text' },
    ],
  },
];

export function IntegrationsManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const { toast } = useToast();

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['/api/integrations'],
    queryFn: async () => {
      const response = await apiRequest('/api/integrations', 'GET');
      return (response || []).map((integration: any) => ({
        ...integration,
        id: integration.id,
        integrationName: integration.integration_name || integration.integrationName || '',
        lastSync: integration.last_sync || integration.lastSync || null,
        createdAt: integration.createdAt || integration.createdAt || '',
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/integrations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      setIsDialogOpen(false);
      toast({ title: 'Integration created', description: 'Connected successfully' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create integration',
        variant: 'destructive',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: (integrationId: string) =>
      apiRequest('POST', `/api/integrations/${integrationId}/test`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({ title: 'Connection successful', description: 'Integration test passed' });
    },
    onError: () => {
      toast({
        title: 'Connection failed',
        description: 'Integration test failed',
        variant: 'destructive',
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (integrationId: string) =>
      apiRequest('POST', `/api/integrations/${integrationId}/sync`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({ title: 'Sync started', description: `${data.message}` });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (integrationId: string) =>
      apiRequest('POST', `/api/integrations/${integrationId}/disconnect`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({ title: 'Disconnected', description: 'Integration removed' });
    },
  });

  const handleAddIntegration = (integration: any) => {
    setSelectedIntegration(integration);
    setIsDialogOpen(true);
  };

  const getConnectedIntegration = (key: string) =>
    integrations.find((i: any) => i.integrationKey === key);

  // Group integrations by priority
  const criticalIntegrations = AVAILABLE_INTEGRATIONS.filter((i) => i.priority === 'critical');
  const highPriorityIntegrations = AVAILABLE_INTEGRATIONS.filter((i) => i.priority === 'high');
  const otherIntegrations = AVAILABLE_INTEGRATIONS.filter(
    (i) => !i.priority || i.priority === 'medium' || i.priority === 'low',
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Connect Printyx with industry-standard copier dealer systems & services
        </p>
      </div>

      {/* CRITICAL INTEGRATIONS */}
      <div>
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">
          🔴 Critical Setup
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Start with these - required for core functionality
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {criticalIntegrations.map((integration) => {
            const connected = getConnectedIntegration(integration.key);

            return (
              <Card
                key={integration.key}
                className={connected ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{integration.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {integration.category}
                        </CardDescription>
                      </div>
                    </div>
                    {connected && <Check className="w-5 h-5 text-green-600" />}
                  </div>
                  <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                    {integration.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {connected ? (
                    <div className="space-y-2">
                      <div
                        className={`text-sm px-3 py-1 rounded flex items-center gap-2 ${
                          connected.status === 'connected'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${connected.status === 'connected' ? 'bg-green-600' : 'bg-red-600'}`}
                        />
                        {connected.status === 'connected' ? 'Connected' : 'Error'}
                      </div>
                      {connected.lastSyncedAt && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Last sync: {new Date(connected.lastSyncedAt).toLocaleDateString()}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testMutation.mutate(connected.id)}
                          disabled={testMutation.isPending}
                        >
                          <Zap className="w-3 h-3 mr-1" /> Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncMutation.mutate(connected.id)}
                          disabled={syncMutation.isPending}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" /> Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => disconnectMutation.mutate(connected.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => handleAddIntegration(integration)} className="w-full">
                      <Plus className="w-4 h-4 mr-2" /> Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* HIGH PRIORITY INTEGRATIONS */}
      <div>
        <h2 className="text-lg font-semibold text-orange-600 dark:text-orange-400 mb-3">
          🟠 Highly Recommended
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enhance operations with communications, monitoring, and scheduling
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {highPriorityIntegrations.map((integration) => {
            const connected = getConnectedIntegration(integration.key);

            return (
              <Card
                key={integration.key}
                className={connected ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{integration.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {integration.category}
                        </CardDescription>
                      </div>
                    </div>
                    {connected && <Check className="w-5 h-5 text-green-600" />}
                  </div>
                  <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                    {integration.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {connected ? (
                    <div className="space-y-2">
                      <div
                        className={`text-sm px-3 py-1 rounded flex items-center gap-2 ${
                          connected.status === 'connected'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${connected.status === 'connected' ? 'bg-green-600' : 'bg-red-600'}`}
                        />
                        {connected.status === 'connected' ? 'Connected' : 'Error'}
                      </div>
                      {connected.lastSyncedAt && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Last sync: {new Date(connected.lastSyncedAt).toLocaleDateString()}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testMutation.mutate(connected.id)}
                          disabled={testMutation.isPending}
                        >
                          <Zap className="w-3 h-3 mr-1" /> Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncMutation.mutate(connected.id)}
                          disabled={syncMutation.isPending}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" /> Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => disconnectMutation.mutate(connected.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => handleAddIntegration(integration)} className="w-full">
                      <Plus className="w-4 h-4 mr-2" /> Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* OTHER INTEGRATIONS */}
      <div>
        <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3">
          🔵 Additional Services
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Optional integrations for extended functionality
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {otherIntegrations.map((integration) => {
            const connected = getConnectedIntegration(integration.key);

            return (
              <Card
                key={integration.key}
                className={connected ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{integration.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {integration.category}
                        </CardDescription>
                      </div>
                    </div>
                    {connected && <Check className="w-5 h-5 text-green-600" />}
                  </div>
                  <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                    {integration.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {connected ? (
                    <div className="space-y-2">
                      <div
                        className={`text-sm px-3 py-1 rounded flex items-center gap-2 ${
                          connected.status === 'connected'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${connected.status === 'connected' ? 'bg-green-600' : 'bg-red-600'}`}
                        />
                        {connected.status === 'connected' ? 'Connected' : 'Error'}
                      </div>
                      {connected.lastSyncedAt && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Last sync: {new Date(connected.lastSyncedAt).toLocaleDateString()}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testMutation.mutate(connected.id)}
                          disabled={testMutation.isPending}
                        >
                          <Zap className="w-3 h-3 mr-1" /> Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncMutation.mutate(connected.id)}
                          disabled={syncMutation.isPending}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" /> Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => disconnectMutation.mutate(connected.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => handleAddIntegration(integration)} className="w-full">
                      <Plus className="w-4 h-4 mr-2" /> Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <IntegrationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        integration={selectedIntegration}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}

function IntegrationDialog({ open, onOpenChange, integration, onSubmit, isLoading }: any) {
  const form = useForm({
    resolver: zodResolver(
      z.object({
        credentials: z.record(z.string()),
      }),
    ),
    defaultValues: { credentials: {} },
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      integrationKey: integration.key,
      integrationName: integration.name,
      credentials: data.credentials,
    });
  };

  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {integration.name}</DialogTitle>
          <DialogDescription>Enter your credentials to connect this integration</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {integration.fields.map((field: any) => (
              <FormField
                key={field.name}
                control={form.control}
                name={`credentials.${field.name}`}
                render={({ field: fieldProps }) => (
                  <FormItem>
                    <FormLabel>{field.label}</FormLabel>
                    <FormControl>
                      <Input {...fieldProps} type={field.type} placeholder={field.placeholder} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
