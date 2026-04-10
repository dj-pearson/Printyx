/**
 * Disposable Email Domains Admin Page
 *
 * Platform-admin UI for managing the signup blocklist of disposable /
 * throwaway email providers. Supports search, add, bulk import, toggle
 * (block/allow without deletion), and delete.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogTrigger,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  Plus,
  Trash2,
  Upload,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Mail,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface DisposableEmailDomain {
  id: string;
  domain: string;
  isBlocked: boolean;
  source: string;
  notes: string | null;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  rows: DisposableEmailDomain[];
  total: number;
  blockedCount: number;
  allowedCount: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 50;

export default function DisposableEmailDomainsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [blockedFilter, setBlockedFilter] = useState<'all' | 'blocked' | 'allowed'>('all');
  const [page, setPage] = useState(0);

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DisposableEmailDomain | null>(null);

  // Add form state
  const [newDomain, setNewDomain] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Bulk form state
  const [bulkText, setBulkText] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim().toLowerCase());
    if (blockedFilter === 'blocked') params.set('blocked', 'true');
    if (blockedFilter === 'allowed') params.set('blocked', 'false');
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(page * PAGE_SIZE));
    return params.toString();
  }, [search, blockedFilter, page]);

  const { data, isLoading, isFetching } = useQuery<ListResponse>({
    queryKey: ['/api/admin/disposable-emails', queryString],
    queryFn: () => apiRequest(`/api/admin/disposable-emails?${queryString}`),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['/api/admin/disposable-emails'] });

  const addMutation = useMutation({
    mutationFn: (payload: { domain: string; notes?: string | null }) =>
      apiRequest('/api/admin/disposable-emails', 'POST', payload),
    onSuccess: () => {
      toast({ title: 'Domain blocked', description: `Added ${newDomain} to the blocklist.` });
      setAddOpen(false);
      setNewDomain('');
      setNewNotes('');
      invalidate();
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to add domain',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: { domains: string[] }) =>
      apiRequest('/api/admin/disposable-emails/bulk', 'POST', {
        ...payload,
        source: 'import',
      }),
    onSuccess: (result: any) => {
      toast({
        title: 'Bulk import complete',
        description: `Inserted ${result.inserted}, updated ${result.updated}, skipped ${result.skipped}.`,
      });
      setBulkOpen(false);
      setBulkText('');
      invalidate();
    },
    onError: (err: any) => {
      toast({
        title: 'Bulk import failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (payload: { id: string; isBlocked: boolean }) =>
      apiRequest(`/api/admin/disposable-emails/${payload.id}`, 'PATCH', {
        isBlocked: payload.isBlocked,
      }),
    onSuccess: () => invalidate(),
    onError: (err: any) => {
      toast({
        title: 'Failed to update',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/disposable-emails/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Domain removed', description: 'Removed from the blocklist.' });
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to delete',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const refreshCache = useMutation({
    mutationFn: () => apiRequest('/api/admin/disposable-emails/refresh', 'POST'),
    onSuccess: () => {
      toast({ title: 'Cache refreshed', description: 'Server cache invalidated.' });
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const blockedCount = data?.blockedCount ?? 0;
  const allowedCount = data?.allowedCount ?? 0;
  const hasNextPage = (page + 1) * PAGE_SIZE < total;

  const parsedBulkDomains = useMemo(() => {
    return bulkText
      .split(/[\s,;]+/)
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d.length > 0 && d.includes('.'));
  }, [bulkText]);

  const handleAdd = () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;
    addMutation.mutate({
      domain,
      notes: newNotes.trim() ? newNotes.trim() : undefined,
    });
  };

  const handleBulkImport = () => {
    if (parsedBulkDomains.length === 0) {
      toast({
        title: 'No domains to import',
        description: 'Paste one or more domains (one per line or comma-separated).',
        variant: 'destructive',
      });
      return;
    }
    bulkMutation.mutate({ domains: parsedBulkDomains });
  };

  const sourceColor = (src: string) => {
    switch (src) {
      case 'seed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'import':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="h-8 w-8 text-red-600" />
              Disposable Email Blocklist
            </h1>
            <p className="text-gray-600 mt-2">
              Manage the list of disposable / throwaway email providers that are blocked from
              signing up for new Printyx accounts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => refreshCache.mutate()}
              disabled={refreshCache.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshCache.isPending ? 'animate-spin' : ''}`} />
              Refresh Cache
            </Button>
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Import
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Bulk Import Domains</DialogTitle>
                  <DialogDescription>
                    Paste one domain per line (or comma-separated). Duplicates will be
                    automatically deduplicated; existing domains will be re-blocked.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    placeholder={'mailinator.com\n10minutemail.com\nguerrillamail.com'}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-gray-600">
                    {parsedBulkDomains.length} valid domain
                    {parsedBulkDomains.length === 1 ? '' : 's'} detected
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBulkOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkImport}
                    disabled={bulkMutation.isPending || parsedBulkDomains.length === 0}
                  >
                    {bulkMutation.isPending ? 'Importing...' : `Import ${parsedBulkDomains.length}`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Block an Email Domain</DialogTitle>
                  <DialogDescription>
                    New signups using this domain will be rejected with a clear error.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="newDomain">Domain</Label>
                    <Input
                      id="newDomain"
                      placeholder="e.g. mailinator.com"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter just the domain part, not the full email.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="newNotes">Notes (optional)</Label>
                    <Textarea
                      id="newNotes"
                      placeholder="Why is this domain being blocked?"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAdd} disabled={!newDomain.trim() || addMutation.isPending}>
                    {addMutation.isPending ? 'Adding...' : 'Block Domain'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Tracked</CardTitle>
              <Mail className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{blockedCount + allowedCount}</div>
              <p className="text-xs text-gray-500 mt-1">All domains in the table</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Blocked</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{blockedCount}</div>
              <p className="text-xs text-gray-500 mt-1">Rejected at signup</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Allowed (overridden)</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{allowedCount}</div>
              <p className="text-xs text-gray-500 mt-1">Kept in the table but not blocked</p>
            </CardContent>
          </Card>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            To seed the initial list from the public{' '}
            <a
              href="https://github.com/disposable-email-domains/disposable-email-domains"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              disposable-email-domains
            </a>{' '}
            repository, run <code className="font-mono">npm run seed:disposable-emails</code>.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Domains</CardTitle>
            <CardDescription>
              Search, filter, and manage blocked domains. Toggle block/allow without losing the
              record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Search domains..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <Select
                value={blockedFilter}
                onValueChange={(v: 'all' | 'blocked' | 'allowed') => {
                  setBlockedFilter(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All domains</SelectItem>
                  <SelectItem value="blocked">Blocked only</SelectItem>
                  <SelectItem value="allowed">Allowed only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No domains match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">{row.domain}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={row.isBlocked}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({ id: row.id, isBlocked: checked })
                              }
                              disabled={toggleMutation.isPending}
                              aria-label={row.isBlocked ? 'Unblock domain' : 'Block domain'}
                            />
                            {row.isBlocked ? (
                              <Badge variant="destructive">Blocked</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-700 border-green-300">
                                Allowed
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={sourceColor(row.source)}>
                            {row.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-gray-600">
                          {row.notes || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(row.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(row)}
                            aria-label={`Delete ${row.domain}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-600">
                Showing {rows.length === 0 ? 0 : page * PAGE_SIZE + 1}–
                {page * PAGE_SIZE + rows.length} of {total}
                {isFetching ? ' · refreshing…' : ''}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || isFetching}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNextPage || isFetching}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.domain}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the entry from the blocklist. If you want to keep the
              record but stop blocking signups, use the toggle in the Status column instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
