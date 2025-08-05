import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import {
  Network,
  Printer,
  Plus,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  Activity,
  BarChart3,
  Cable,
  TestTube
} from 'lucide-react';

interface ManufacturerIntegration {
  id: string;
  manufacturer: string;
  integrationName: string;
  status: 'active' | 'inactive' | 'error' | 'pending';
  authMethod: string;
  apiEndpoint?: string;
  collectionFrequency: string;
  lastSync?: string;
  nextSync?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationStats {
  totalIntegrations: number;
  activeIntegrations: number;
  totalDevices: number;
  onlineDevices: number;
  todayMetrics: number;
}

export default function ManufacturerIntegration() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const { toast } = useToast();

  const { data: integrations = [], isLoading } = useQuery<ManufacturerIntegration[]>({
    queryKey: ['/api/manufacturer-integrations'],
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery<IntegrationStats>({
    queryKey: ['/api/manufacturer-integrations/stats'],
    refetchInterval: 60000,
  });

  const createIntegrationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/manufacturer-integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create integration');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manufacturer-integrations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/manufacturer-integrations/stats'] });
      setIsCreateDialogOpen(false);
      toast({ title: 'Integration created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create integration', variant: 'destructive' });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await fetch(`/api/manufacturer-integrations/${integrationId}/test`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to test connection');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: data.success ? 'Connection successful' : 'Connection failed',
        variant: data.success ? 'default' : 'destructive'
      });
    },
  });

  const discoverDevicesMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      const response = await fetch(`/api/manufacturer-integrations/${integrationId}/discover`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to discover devices');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'inactive': return <AlertCircle className="h-4 w-4 text-gray-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const manufacturers = [
    { value: 'canon', label: 'Canon' },
    { value: 'xerox', label: 'Xerox' },
    { value: 'hp', label: 'HP' },
    { value: 'konica_minolta', label: 'Konica Minolta' },
    { value: 'lexmark', label: 'Lexmark' },
    { value: 'fmaudit', label: 'FMAudit' },
    { value: 'printanista', label: 'Printanista' },
  ];

  const authMethods = [
    { value: 'api_key', label: 'API Key' },
    { value: 'oauth2', label: 'OAuth 2.0' },
    { value: 'basic_auth', label: 'Basic Auth' },
    { value: 'certificate', label: 'Certificate' },
    { value: 'hmac', label: 'HMAC' },
  ];

  const frequencies = [
    { value: 'real_time', label: 'Real Time' },
    { value: 'hourly', label: 'Hourly' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const handleCreateIntegration = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const credentials: any = {};
    if (formData.get('authMethod') === 'api_key') {
      credentials.apiKey = formData.get('apiKey');
    } else if (formData.get('authMethod') === 'oauth2') {
      credentials.clientId = formData.get('clientId');
      credentials.clientSecret = formData.get('clientSecret');
    } else if (formData.get('authMethod') === 'basic_auth') {
      credentials.username = formData.get('username');
      credentials.password = formData.get('password');
    }

    createIntegrationMutation.mutate({
      manufacturer: formData.get('manufacturer'),
      integrationName: formData.get('integrationName'),
      authMethod: formData.get('authMethod'),
      credentials,
      apiEndpoint: formData.get('apiEndpoint'),
      collectionFrequency: formData.get('collectionFrequency'),
      isActive: formData.get('isActive') === 'on',
    });
  };

  if (isLoading) {
    return (
      <MainLayout
        title="Manufacturer Integration"
        description="Loading manufacturer integrations..."
      >
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Manufacturer Integration"
      description="Automated meter reading and device management across all major copier manufacturers"
    >
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Network className="h-8 w-8" />
            Manufacturer Integration Hub
          </h1>
          <p className="text-muted-foreground mt-2">
            Automated meter reading and device management across all major copier manufacturers
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Integration</DialogTitle>
              <DialogDescription>
                Set up a new manufacturer integration for automated meter reading
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateIntegration} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Select name="manufacturer" required onValueChange={setSelectedManufacturer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                      {manufacturers.map((mfg) => (
                        <SelectItem key={mfg.value} value={mfg.value}>
                          {mfg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="integrationName">Integration Name</Label>
                  <Input name="integrationName" placeholder="My Canon Integration" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="authMethod">Authentication Method</Label>
                  <Select name="authMethod" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select auth method" />
                    </SelectTrigger>
                    <SelectContent>
                      {authMethods.map((auth) => (
                        <SelectItem key={auth.value} value={auth.value}>
                          {auth.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collectionFrequency">Collection Frequency</Label>
                  <Select name="collectionFrequency" defaultValue="daily" required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencies.map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiEndpoint">API Endpoint</Label>
                <Input name="apiEndpoint" placeholder="https://api.example.com" />
              </div>

              {/* Dynamic credential fields based on auth method */}
              <div className="space-y-2">
                <Label>Credentials</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input name="apiKey" placeholder="API Key" />
                  <Input name="username" placeholder="Username" />
                  <Input name="password" type="password" placeholder="Password" />
                  <Input name="clientId" placeholder="Client ID" />
                  <Input name="clientSecret" type="password" placeholder="Client Secret" />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch name="isActive" defaultChecked />
                <Label htmlFor="isActive">Enable integration</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createIntegrationMutation.isPending}>
                  {createIntegrationMutation.isPending ? 'Creating...' : 'Create Integration'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalIntegrations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Integrations</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeIntegrations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
              <Printer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDevices}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Devices</CardTitle>
              <Wifi className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.onlineDevices}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Collections</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.todayMetrics}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Integrations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Active Integrations
          </CardTitle>
          <CardDescription>
            Manage your manufacturer integrations and monitor their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="text-center py-12">
              <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No integrations found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first manufacturer integration to start automated meter reading
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {integrations.map((integration) => (
                <Card key={integration.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg capitalize flex items-center gap-2">
                        <Printer className="h-4 w-4" />
                        {integration.manufacturer}
                      </CardTitle>
                      <Badge className={getStatusColor(integration.status)}>
                        {getStatusIcon(integration.status)}
                        <span className="ml-1 capitalize">{integration.status}</span>
                      </Badge>
                    </div>
                    <CardDescription>{integration.integrationName}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Auth Method:</span>
                        <span className="capitalize">{integration.authMethod}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frequency:</span>
                        <span className="capitalize">{integration.collectionFrequency}</span>
                      </div>
                      {integration.lastSync && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Last Sync:</span>
                          <span>{new Date(integration.lastSync).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testConnectionMutation.mutate(integration.id)}
                          disabled={testConnectionMutation.isPending}
                          className="flex-1"
                        >
                          <TestTube className="h-3 w-3 mr-1" />
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => discoverDevicesMutation.mutate(integration.id)}
                          disabled={discoverDevicesMutation.isPending}
                          className="flex-1"
                        >
                          <Cable className="h-3 w-3 mr-1" />
                          Discover
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </MainLayout>
  );
}