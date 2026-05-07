import { useEffect, useRef, useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Server,
  Activity,
  AlertCircle,
  Check,
  ChevronsUpDown,
  Clock,
  Copy,
  Download,
  RefreshCw,
  MoreVertical,
  Eye,
  Trash2,
  Zap,
  Search,
  Send,
  Building2,
  X,
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
import MainLayout from '@/components/layout/main-layout';
import { apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/supabase';

interface MonitoringClient {
  id: number;
  clientId: string;
  clientName: string;
  location?: string;
  customerId?: string | null;
  status: 'active' | 'inactive' | 'disabled';
  lastHeartbeat?: string;
  clientVersion?: string;
  createdAt: string;
  deviceCount?: number;
  activeAlertsCount?: number;
}

interface CustomerOption {
  id: string;
  companyName: string;
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
  const [newClientCustomerId, setNewClientCustomerId] = useState<string>('');
  const [newClientCustomerName, setNewClientCustomerName] = useState<string>('');
  const [newClientAutoOrder, setNewClientAutoOrder] = useState<boolean>(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState('');
  const customerSearchInputRef = useRef<HTMLInputElement>(null);
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
    queryKey: ['/api/monitoring-clients'],
  });

  // Customers picker (links a monitoring client to its customer / business
  // record so the bundled installer carries that context). Server-side
  // searchable combobox — debounced 300ms; queries enabled only while the
  // popover is open. Mirrors client/src/components/quote-builder/CompanyContactSelector.tsx.
  useEffect(() => {
    if (!customerOpen) {
      setCustomerSearch('');
      setCustomerSearchDebounced('');
      return;
    }
    const t = setTimeout(() => customerSearchInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [customerOpen]);

  useEffect(() => {
    const t = setTimeout(() => setCustomerSearchDebounced(customerSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const { data: customerSearchResults = [], isFetching: customersFetching } = useQuery<
    CustomerOption[]
  >({
    queryKey: ['/api/customers', 'monitoring-clients-picker', customerSearchDebounced],
    enabled: customerOpen,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (customerSearchDebounced) params.set('search', customerSearchDebounced);
      const raw = await apiRequest(`/api/customers?${params.toString()}`, 'GET');
      const list = Array.isArray(raw) ? raw : raw?.records || raw?.data || [];
      return list.map((c: any) => ({
        id: String(c.id),
        companyName: c.companyName || c.company_name || c.business_name || c.name || '(unnamed)',
      }));
    },
    placeholderData: (prev) => prev,
  });

  // Resolve names for already-attached customers in the table (lookup-by-id).
  // Hits `/api/customers/:id` as needed; cached by id.
  const attachedCustomerIds = (clientsData?.clients || [])
    .map((c) => c.customerId)
    .filter((v): v is string => !!v);
  const uniqueAttachedIds = Array.from(new Set(attachedCustomerIds));
  const attachedCustomerQueries = useQuery<Record<string, string>>({
    queryKey: ['/api/customers', 'monitoring-name-map', uniqueAttachedIds.sort().join(',')],
    enabled: uniqueAttachedIds.length > 0,
    queryFn: async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        uniqueAttachedIds.map(async (id) => {
          try {
            const raw: any = await apiRequest(`/api/customers/${id}`, 'GET');
            map[id] =
              raw?.companyName || raw?.company_name || raw?.business_name || raw?.name || id;
          } catch {
            map[id] = id;
          }
        }),
      );
      return map;
    },
  });
  const customerNameMap = attachedCustomerQueries.data || {};

  // Fetch selected client details
  const { data: clientDetails } = useQuery<ClientDetails>({
    queryKey: [`/api/monitoring-clients/${selectedClientId}`],
    enabled: !!selectedClientId,
  });

  // Register new client mutation
  const registerClientMutation = useMutation({
    mutationFn: async (data: {
      clientName: string;
      location?: string;
      customerId?: string;
      autoOrderEnabled?: boolean;
    }) => {
      return (await apiRequest('/api/monitoring-clients', 'POST', data)) as NewClientResponse;
    },
    onSuccess: (data) => {
      setRegisteredClient(data.client);
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring-clients'] });
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
      return (await apiRequest(
        `/api/monitoring-clients/${clientId}/enrollment-token`,
        'POST',
        {},
      )) as {
        token: string;
        expiresAt: string;
        endpoint: string;
        clientId: string;
        installCommand: string;
      };
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

  // Send a remote-control command to a client (rescan / reload / force-submit / rotate)
  const sendCommandMutation = useMutation({
    mutationFn: async ({ clientId, command }: { clientId: string; command: string }) => {
      return (await apiRequest(`/api/monitoring-clients/${clientId}/commands`, 'POST', {
        command,
      })) as {
        command: { id: string; command: string; status: string };
      };
    },
    onSuccess: (_data, { command }) => {
      toast({
        title: 'Command queued',
        description: `'${command}' will run on the next heartbeat (within 5 minutes).`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring-clients'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not queue command',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Download bundled installer (zip). The endpoint requires the same Bearer
  // JWT as every other admin call, so an anchor + click won't work in
  // production — we have to fetch the bytes ourselves and trigger a Blob
  // download. Mirrors the auth header building done by `apiRequest`.
  const downloadInstaller = async (clientId: string) => {
    try {
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = {};
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      const tenantId =
        localStorage.getItem('tenant-id') ||
        localStorage.getItem('printyx-tenant-id') ||
        localStorage.getItem('x-tenant-id') ||
        '';
      if (tenantId) headers['x-tenant-id'] = tenantId;

      const res = await fetch(getApiUrl(`/api/monitoring-clients/${clientId}/installer.zip`), {
        method: 'GET',
        headers,
        credentials: 'omit',
      });
      if (!res.ok) {
        const text = await res.text();
        let message = `Download failed (${res.status})`;
        try {
          const parsed = JSON.parse(text);
          if (parsed?.message) message = parsed.message;
        } catch {
          /* not JSON */
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `printyx-client-${clientId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      toast({
        title: 'Installer downloading',
        description: 'Run on the target Windows server.',
      });
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Regenerate API key mutation
  const regenerateKeyMutation = useMutation({
    mutationFn: async (clientId: string) => {
      return (await apiRequest(`/api/monitoring-clients/${clientId}/regenerate-key`, 'POST')) as {
        message: string;
        apiKey: string;
      };
    },
    onSuccess: (_data, clientId) => {
      toast({
        title: 'API Key Regenerated',
        description: 'New API key has been generated',
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/monitoring-clients/${clientId}`],
      });
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
      customerId: newClientCustomerId || undefined,
      autoOrderEnabled: newClientAutoOrder,
    });
  };

  const handleCloseRegisterDialog = () => {
    setIsRegisterDialogOpen(false);
    setNewClientName('');
    setNewClientLocation('');
    setNewClientCustomerId('');
    setNewClientCustomerName('');
    setNewClientAutoOrder(false);
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
    <MainLayout
      title="Monitoring Clients"
      description="Manage on-premises printer monitoring clients"
    >
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
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer (Optional)</Label>
                    <div className="flex gap-2">
                      <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="customer"
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={customerOpen}
                            className="flex-1 min-h-[44px] justify-between font-normal"
                          >
                            {newClientCustomerId ? (
                              <div className="flex items-center gap-2 truncate">
                                <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
                                <span className="truncate">
                                  {newClientCustomerName || newClientCustomerId}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Search for a customer...
                              </span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                          align="start"
                          side="bottom"
                          sideOffset={4}
                        >
                          <div className="p-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                ref={customerSearchInputRef}
                                placeholder="Type to search customers..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                className="pl-8"
                              />
                            </div>
                          </div>
                          <div className="max-h-72 overflow-y-auto">
                            {customersFetching && customerSearchResults.length === 0 ? (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                Searching…
                              </div>
                            ) : customerSearchResults.length === 0 ? (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                {customerSearchDebounced
                                  ? 'No customers match.'
                                  : 'Start typing to search.'}
                              </div>
                            ) : (
                              <ul className="py-1">
                                {customerSearchResults.map((c) => {
                                  const selected = c.id === newClientCustomerId;
                                  return (
                                    <li key={c.id}>
                                      <button
                                        type="button"
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                                          selected ? 'bg-gray-50' : ''
                                        }`}
                                        onClick={() => {
                                          setNewClientCustomerId(c.id);
                                          setNewClientCustomerName(c.companyName);
                                          setCustomerOpen(false);
                                        }}
                                      >
                                        <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
                                        <span className="truncate flex-1">{c.companyName}</span>
                                        {selected && (
                                          <Check className="h-4 w-4 shrink-0 text-green-600" />
                                        )}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {newClientCustomerId && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setNewClientCustomerId('');
                            setNewClientCustomerName('');
                          }}
                          aria-label="Clear customer"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Linking a client to a customer ties the bundled installer and all collected
                      meter data to that account.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <input
                      id="autoOrder"
                      type="checkbox"
                      checked={newClientAutoOrder}
                      onChange={(e) => setNewClientAutoOrder(e.target.checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="flex-1">
                      <Label htmlFor="autoOrder" className="text-sm font-medium">
                        Auto-order on critical toner alerts
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">
                        When a device hits ≤10% on any colour, fire a draft supply order in the
                        platform. Operators approve before fulfilment. Leave off if you'd rather
                        route every alert through manual review.
                      </p>
                    </div>
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
                  <TableHead>Customer</TableHead>
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
                  const customerName = client.customerId
                    ? customerNameMap[client.customerId] || client.customerId
                    : null;
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.clientName}</TableCell>
                      <TableCell>
                        {customerName ? (
                          <span className="text-sm">{customerName}</span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
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
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs text-gray-500">
                              Remote Control
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() =>
                                sendCommandMutation.mutate({
                                  clientId: client.clientId,
                                  command: 'force-submit',
                                })
                              }
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Force Sync Now
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                sendCommandMutation.mutate({
                                  clientId: client.clientId,
                                  command: 'rescan',
                                })
                              }
                            >
                              <Search className="h-4 w-4 mr-2" />
                              Rescan Network
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                sendCommandMutation.mutate({
                                  clientId: client.clientId,
                                  command: 'reload-config',
                                })
                              }
                            >
                              <Zap className="h-4 w-4 mr-2" />
                              Reload Config
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
                <TabsTrigger value="commands">Remote Control</TabsTrigger>
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

              <TabsContent value="commands" className="space-y-4">
                <CommandsPanel
                  clientId={clientDetails.clientId}
                  onSend={(command) =>
                    sendCommandMutation.mutate({ clientId: clientDetails.clientId, command })
                  }
                />
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
    </MainLayout>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Inline component: command history + quick-action buttons inside the
// client details dialog. Keeps the file self-contained.
// ──────────────────────────────────────────────────────────────────────

interface ClientCommand {
  id: string;
  command: string;
  status: 'queued' | 'dispatched' | 'done' | 'failed' | 'expired';
  result?: any;
  errorMessage?: string | null;
  createdAt: string;
  dispatchedAt?: string | null;
  completedAt?: string | null;
}

function CommandsPanel({
  clientId,
  onSend,
}: {
  clientId: string;
  onSend: (command: string) => void;
}) {
  const { data, isLoading } = useQuery<{ commands: ClientCommand[] }>({
    queryKey: [`/api/monitoring-clients/${clientId}/commands`],
    refetchInterval: 10_000, // refresh while dialog is open
  });

  const statusBadge = (s: ClientCommand['status']) => {
    switch (s) {
      case 'queued':
        return <Badge variant="outline">queued</Badge>;
      case 'dispatched':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">dispatched</Badge>;
      case 'done':
        return <Badge className="bg-green-100 text-green-800 border-green-200">done</Badge>;
      case 'failed':
        return <Badge variant="destructive">failed</Badge>;
      case 'expired':
        return (
          <Badge variant="outline" className="text-gray-500">
            expired
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onSend('force-submit')}>
          <Send className="h-4 w-4 mr-2" />
          Force Sync Now
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSend('rescan')}>
          <Search className="h-4 w-4 mr-2" />
          Rescan Network
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSend('reload-config')}>
          <Zap className="h-4 w-4 mr-2" />
          Reload Config
        </Button>
        <p className="text-xs text-gray-500 self-center w-full mt-1">
          Commands run on the next heartbeat (within 5 minutes). The agent posts an ack when it
          finishes — see history below.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading command history…</p>
      ) : !data?.commands || data.commands.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-6">No commands yet.</p>
      ) : (
        <div className="space-y-2">
          {data.commands.map((c) => (
            <div key={c.id} className="border rounded-lg p-3 text-sm">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{c.command}</span>
                    {statusBadge(c.status)}
                  </div>
                  {c.status === 'failed' && c.errorMessage && (
                    <p className="text-red-700 mt-1">{c.errorMessage}</p>
                  )}
                  {c.status === 'done' && c.result && (
                    <p className="text-gray-600 mt-1 text-xs">
                      {Object.entries(c.result)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {format(new Date(c.completedAt || c.dispatchedAt || c.createdAt), 'PPp')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
