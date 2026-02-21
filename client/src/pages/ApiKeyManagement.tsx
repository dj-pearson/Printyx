import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Key,
  Plus,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Shield,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  keyType: string;
  keyPrefix: string;
  status: string;
  isActive: boolean;
  scopes: string[];
  expiresAt: string | null;
  neverExpires: boolean;
  lastUsedAt: string | null;
  usageCount: number;
  environment: string;
  createdAt: string;
}

const AVAILABLE_SCOPES = [
  { value: 'read:customers', label: 'Read Customers' },
  { value: 'write:customers', label: 'Write Customers' },
  { value: 'read:leads', label: 'Read Leads' },
  { value: 'write:leads', label: 'Write Leads' },
  { value: 'read:quotes', label: 'Read Quotes' },
  { value: 'write:quotes', label: 'Write Quotes' },
  { value: 'read:invoices', label: 'Read Invoices' },
  { value: 'write:invoices', label: 'Write Invoices' },
  { value: 'read:equipment', label: 'Read Equipment' },
  { value: 'write:equipment', label: 'Write Equipment' },
  { value: 'read:reports', label: 'Read Reports' },
];

export default function ApiKeyManagement() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);
  const [rotateKeyId, setRotateKeyId] = useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    keyType: 'standard',
    scopes: [] as string[],
    expiresIn: '90d',
  });

  // Fetch keys
  const { data, isLoading } = useQuery<{ keys: ApiKey[]; total: number }>({
    queryKey: ['/api/api-keys'],
    queryFn: () => apiRequest('/api/api-keys'),
  });

  const keys = data?.keys || [];

  // Create key mutation
  const createMutation = useMutation({
    mutationFn: (formData: typeof createForm) => {
      let expiresAt: string | undefined;
      if (formData.expiresIn !== 'never') {
        const days = parseInt(formData.expiresIn);
        const date = new Date();
        date.setDate(date.getDate() + days);
        expiresAt = date.toISOString();
      }

      return apiRequest('/api/api-keys', 'POST', {
        name: formData.name,
        description: formData.description || undefined,
        keyType: formData.keyType,
        scopes: formData.scopes,
        expiresAt,
        neverExpires: formData.expiresIn === 'never',
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      setShowCreateDialog(false);
      setNewKeyValue(result.rawKey || result.key || null);
      setCreateForm({
        name: '',
        description: '',
        keyType: 'standard',
        scopes: [],
        expiresIn: '90d',
      });
      toast({ title: 'API key created', description: 'Save the key securely.' });
    },
    onError: () => {
      toast({ title: 'Failed to create API key', variant: 'destructive' });
    },
  });

  // Revoke mutation
  const revokeMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiRequest(`/api/api-keys/${keyId}/revoke`, 'POST', { reason: 'Revoked by admin' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      setRevokeKeyId(null);
      toast({ title: 'API key revoked' });
    },
  });

  // Rotate mutation
  const rotateMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiRequest(`/api/api-keys/${keyId}/rotate`, 'POST', {
        gracePeriodHours: 24,
        reason: 'Rotated by admin',
      }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      setRotateKeyId(null);
      setNewKeyValue(result.rawKey || result.key || null);
      toast({ title: 'API key rotated', description: 'Old key valid for 24 hours.' });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setCreateForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const getStatusBadge = (key: ApiKey) => {
    if (key.status === 'revoked') return <Badge className="bg-red-100 text-red-800">Revoked</Badge>;
    if (key.expiresAt && new Date(key.expiresAt) < new Date())
      return <Badge className="bg-yellow-100 text-yellow-800">Expired</Badge>;
    if (key.isActive) return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Key className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">API Key Management</h1>
            <p className="text-sm text-gray-500">Create and manage API keys for integrations</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create API Key
        </Button>
      </div>

      {/* Keys Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading API keys...
                    </TableCell>
                  </TableRow>
                ) : keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Key className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-muted-foreground">No API keys created yet</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setShowCreateDialog(true)}
                      >
                        Create your first API key
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  keys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>
                        <div className="font-medium">{key.name}</div>
                        {key.description && (
                          <div className="text-xs text-muted-foreground">{key.description}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {key.keyPrefix}...
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(key)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(key.scopes || []).slice(0, 3).map((scope) => (
                            <Badge key={scope} variant="outline" className="text-xs">
                              {scope.replace(/^(read|write):/, '')}
                            </Badge>
                          ))}
                          {(key.scopes || []).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{key.scopes.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {key.lastUsedAt ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {key.neverExpires ? (
                          <span className="text-xs text-muted-foreground">Never</span>
                        ) : key.expiresAt ? (
                          <span className="text-xs text-muted-foreground">
                            {new Date(key.expiresAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Rotate key"
                            disabled={key.status === 'revoked'}
                            onClick={() => setRotateKeyId(key.id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            title="Revoke key"
                            disabled={key.status === 'revoked'}
                            onClick={() => setRevokeKeyId(key.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Create a new API key for integration access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                placeholder="e.g. Production Integration"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                placeholder="What is this key used for?"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Expiration</Label>
              <Select
                value={createForm.expiresIn}
                onValueChange={(v) => setCreateForm({ ...createForm, expiresIn: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="never">Never expires</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Permission Scopes</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <button
                    key={scope.value}
                    onClick={() => toggleScope(scope.value)}
                    className={`text-left text-xs p-2 rounded border transition-colors ${
                      createForm.scopes.includes(scope.value)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {createForm.scopes.includes(scope.value) ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Shield className="h-3 w-3 opacity-30" />
                      )}
                      {scope.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={!createForm.name || createForm.scopes.length === 0}
            >
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Display Dialog */}
      <Dialog open={!!newKeyValue} onOpenChange={() => setNewKeyValue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Save Your API Key
            </DialogTitle>
            <DialogDescription>
              This key will only be shown once. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm break-all">
            {newKeyValue}
          </div>
          <DialogFooter>
            <Button onClick={() => copyToClipboard(newKeyValue!)}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" /> Copy to Clipboard
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setNewKeyValue(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!revokeKeyId} onOpenChange={() => setRevokeKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate the API key. Any integrations using this key will
              stop working. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => revokeKeyId && revokeMutation.mutate(revokeKeyId)}
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rotate Confirmation */}
      <AlertDialog open={!!rotateKeyId} onOpenChange={() => setRotateKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new key and keep the old key active for 24 hours. Update your
              integrations within the grace period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => rotateKeyId && rotateMutation.mutate(rotateKeyId)}>
              Rotate Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
