import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Server,
  Activity,
  AlertCircle,
  Check,
  Clock,
  Copy,
  Download,
  RefreshCw,
  MoreVertical,
  Eye,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface MonitoringClient {
  id: number;
  clientId: string;
  clientName: string;
  location?: string;
  status: 'active' | 'inactive' | 'disabled';
  lastHeartbeat?: string;
  clientVersion?: string;
  createdAt: string;
  deviceCount?: number;
  activeAlertsCount?: number;
}

interface NewClientResponse {
  message: string;
  client: {
    id: number;
    clientId: string;
    clientName: string;
    apiKey: string;
    tenantId: number;
    status: string;
    createdAt: string;
  };
}

interface ClientDetails extends MonitoringClient {
  activity: Array<{
    id: number;
    eventType: string;
    eventData: any;
    severity: string;
    message: string;
    timestamp: string;
  }>;
  activeAlerts: Array<{
    id: number;
    alertType: string;
    supplyType: string;
    currentLevel: number;
    serialNumber: string;
    createdAt: string;
  }>;
}

export default function MonitoringClients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientLocation, setNewClientLocation] = useState('');
  const [registeredClient, setRegisteredClient] = useState<NewClientResponse['client'] | null>(
    null,
  );
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [enrollmentResult, setEnrollmentResult] = useState<{
    token: string;
    expiresAt: string;
    installCommand: string;
    clientId: string;
  } | null>(null);

  // Fetch all clients
  const { data: clientsData, isLoading } = useQuery<{ clients: MonitoringClient[] }>({
    queryKey: ['/api/client-metrics/clients'],
  });

  // Fetch selected client details
  const { data: clientDetails } = useQuery<ClientDetails>({
    queryKey: [`/api/client-metrics/clients/${selectedClientId}`],
    enabled: !!selectedClientId,
  });

  // Register new client mutation
  const registerClientMutation = useMutation({
    mutationFn: async (data: { clientName: string; location?: string }) => {
      const response = await fetch('/api/client-metrics/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to register client');
      }

      return response.json() as Promise<NewClientResponse>;
    },
    onSuccess: (data) => {
      setRegisteredClient(data.client);
      queryClient.invalidateQueries({ queryKey: ['/api/client-metrics/clients'] });
      toast({
        title: 'Client Registered',
        description: `Successfully registered ${data.client.clientName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Registration Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Generate enrollment token mutation
  const generateTokenMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/client-metrics/clients/${clientId}/enrollment-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to generate token');
      }
      return response.json() as Promise<{
        token: string;
        expiresAt: string;
        endpoint: string;
        clientId: string;
        installCommand: string;
      }>;
    },
    onSuccess: (data) => {
      setEnrollmentResult({
        token: data.token,
        expiresAt: data.expiresAt,
        installCommand: data.installCommand,
        clientId: data.clientId,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to generate enrollment token',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Download bundled installer (zip)
  const downloadInstaller = (clientId: string) => {
    // Anchor + click pattern preserves the browser's session cookies for auth.
    const a = document.createElement('a');
    a.href = `/api/client-metrics/clients/${clientId}/installer.zip`;
    a.download = `printyx-client-${clientId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: 'Installer downloading', description: 'Run on the target Windows server.' });
  };

  // Regenerate API key mutation
  const regenerateKeyMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/client-metrics/clients/${clientId}/regenerate-key`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to regenerate key');
      }

      return response.json() as Promise<{ message: string; apiKey: string }>;
    },
    onSuccess: (data, clientId) => {
      toast({
        title: 'API Key Regenerated',
        description: 'New API key has been generated',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/client-metrics/clients/${clientId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Regenerate Key',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleRegisterClient = () => {
    if (!newClientName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Client name is required',
        variant: 'destructive',
      });
      return;
    }

    registerClientMutation.mutate({
      clientName: newClientName.trim(),
      location: newClientLocation.trim() || undefined,
    });
  };

  const handleCloseRegisterDialog = () => {
    setIsRegisterDialogOpen(false);
    setNewClientName('');
    setNewClientLocation('');
    setRegisteredClient(null);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-yellow-500';
      case 'disabled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getLastSeenStatus = (lastHeartbeat?: string) => {
    if (!lastHeartbeat) return { text: 'Never', color: 'text-gray-500' };

    const lastSeen = new Date(lastHeartbeat);
    const minutesAgo = (Date.now() - lastSeen.getTime()) / 1000 / 60;

    if (minutesAgo < 5) {
      return { text: formatDistanceToNow(lastSeen, { addSuffix: true }), color: 'text-green-600' };
    } else if (minutesAgo < 60) {
      return { text: formatDistanceToNow(lastSeen, { addSuffix: true }), color: 'text-yellow-600' };
    } else {
      return { text: formatDistanceToNow(lastSeen, { addSuffix: true }), color: 'text-red-600' };
    }
  };

  const clients = clientsData?.clients || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Monitoring Clients</h1>
          <p className="text-gray-500 mt-1">Manage on-premises printer monitoring clients</p>
        </div>
        <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Register New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            {!registeredClient ? (
              <>
                <DialogHeader>
                  <DialogTitle>Register New Monitoring Client</DialogTitle>
                  <DialogDescription>
                    Create a new monitoring client installation. You'll receive an API key and
                    installer download.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">
                      Client Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="clientName"
                      placeholder="e.g., Main Office, Warehouse, Remote Site"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location (Optional)</Label>
                    <Input
                      id="location"
                      placeholder="e.g., 123 Main St, Building A"
                      value={newClientLocation}
                      onChange={(e) => setNewClientLocation(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseRegisterDialog}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRegisterClient}
                    disabled={registerClientMutation.isPending}
                  >
                    {registerClientMutation.isPending ? 'Registering...' : 'Register Client'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    Client Registered Successfully
                  </DialogTitle>
                  <DialogDescription>
                    Save these credentials - the API key will only be shown once!
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important:</strong> Copy the API key now. It cannot be retrieved
                      later.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>Client Name</Label>
                    <div className="flex items-center gap-2">
                      <Input value={registeredClient.clientName} readOnly />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <div className="flex items-center gap-2">
                      <Input value={registeredClient.clientId} readOnly />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(registeredClient.clientId, 'Client ID')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tenant ID</Label>
                    <div className="flex items-center gap-2">
                      <Input value={registeredClient.tenantId.toString()} readOnly />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          copyToClipboard(registeredClient.tenantId.toString(), 'Tenant ID')
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={registeredClient.apiKey}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(registeredClient.apiKey, 'API Key')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                    <p className="font-medium text-blue-900">Next Steps:</p>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Download the Windows installer below</li>
                      <li>Run the installer on your print server</li>
                      <li>Enter these credentials when prompted</li>
                      <li>The client will auto-discover and monitor printers</li>
                    </ol>
                  </div>

                  <Button
                    className="w-full"
                    variant="default"
                    onClick={() => downloadInstaller(registeredClient.clientId)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Windows Installer
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={handleCloseRegisterDialog}>Done</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Server className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
            <p className="text-xs text-gray-500 mt-1">
              {clients.filter((c) => c.status === 'active').length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monitored Devices</CardTitle>
            <Activity className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.reduce((sum, c) => sum + (c.deviceCount || 0), 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Across all clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.reduce((sum, c) => sum + (c.activeAlertsCount || 0), 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Clients</CardTitle>
          <CardDescription>Manage your on-premises monitoring client installations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading clients...</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12">
              <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Clients Registered</h3>
              <p className="text-gray-500 mb-4">
                Register your first monitoring client to start collecting printer metrics
              </p>
              <Button onClick={() => setIsRegisterDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Register First Client
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Alerts</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const lastSeenStatus = getLastSeenStatus(client.lastHeartbeat);
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.clientName}</TableCell>
                      <TableCell>{client.location || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <span
                            className={`h-2 w-2 rounded-full ${getStatusColor(client.status)}`}
                          />
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className={`h-4 w-4 ${lastSeenStatus.color}`} />
                          <span className={lastSeenStatus.color}>{lastSeenStatus.text}</span>
                        </div>
                      </TableCell>
                      <TableCell>{client.deviceCount || 0}</TableCell>
                      <TableCell>
                        {client.activeAlertsCount ? (
                          <Badge variant="destructive">{client.activeAlertsCount}</Badge>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-500">
                          {client.clientVersion || 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSelectedClientId(client.clientId)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadInstaller(client.clientId)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download Windows Installer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => generateTokenMutation.mutate(client.clientId)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Generate Enrollment Token
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => regenerateKeyMutation.mutate(client.clientId)}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Regenerate API Key
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Client
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Enrollment Token Dialog */}
      {enrollmentResult && (
        <Dialog open={!!enrollmentResult} onOpenChange={() => setEnrollmentResult(null)}>
          <DialogContent className="sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                Enrollment Token Generated
              </DialogTitle>
              <DialogDescription>
                Run the command below on the target Windows server. The token can only be redeemed
                once and expires {format(new Date(enrollmentResult.expiresAt), 'PPp')}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>One-line installer (PowerShell, run as Administrator)</Label>
                <div className="flex items-start gap-2">
                  <Input
                    value={enrollmentResult.installCommand}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(enrollmentResult.installCommand, 'Install command')
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Token (for use with -EnrollmentToken on an existing checkout)</Label>
                <div className="flex items-center gap-2">
                  <Input value={enrollmentResult.token} readOnly className="font-mono text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(enrollmentResult.token, 'Enrollment token')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The token is only shown once. If you lose it, generate a new one — old tokens
                  remain redeemable until they expire or are used.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button onClick={() => setEnrollmentResult(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Client Details Dialog */}
      {selectedClientId && clientDetails && (
        <Dialog open={!!selectedClientId} onOpenChange={() => setSelectedClientId(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{clientDetails.clientName}</DialogTitle>
              <DialogDescription>Client ID: {clientDetails.clientId}</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="activity" className="mt-4">
              <TabsList>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
                <TabsTrigger value="alerts">
                  Active Alerts ({clientDetails.activeAlerts?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="space-y-4">
                {clientDetails.activity && clientDetails.activity.length > 0 ? (
                  <div className="space-y-2">
                    {clientDetails.activity.map((log) => (
                      <div key={log.id} className="border rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant={log.severity === 'error' ? 'destructive' : 'outline'}>
                              {log.eventType}
                            </Badge>
                            <p className="text-gray-700 mt-1">{log.message}</p>
                          </div>
                          <span className="text-xs text-gray-500">
                            {format(new Date(log.timestamp), 'PPp')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No activity logs yet</p>
                )}
              </TabsContent>

              <TabsContent value="alerts" className="space-y-4">
                {clientDetails.activeAlerts && clientDetails.activeAlerts.length > 0 ? (
                  <div className="space-y-2">
                    {clientDetails.activeAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="border border-red-200 bg-red-50 rounded-lg p-3 text-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              <span className="font-medium text-red-900">
                                {alert.supplyType.toUpperCase()} -{' '}
                                {alert.alertType.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-red-800 mt-1">
                              Device: {alert.serialNumber} | Level: {alert.currentLevel}%
                            </p>
                          </div>
                          <span className="text-xs text-red-600">
                            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No active alerts</p>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
