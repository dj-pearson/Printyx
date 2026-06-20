import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { BookOpen, Plus, Upload, Network, AlertCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImportWizard } from '@/components/address-book/ImportWizard';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { AddressBookVendor } from '@shared/address-book-types';

export interface AddressBookRow {
  id: string;
  name: string;
  customer_id: string;
  customer_name?: string | null;
  device_id?: string | null;
  source_vendor?: AddressBookVendor | null;
  source_model?: string | null;
  entry_count: number;
  last_imported_at?: string | null;
}

interface CustomerOption {
  id: string;
  name?: string;
  companyName?: string;
  businessName?: string;
}

const VENDOR_LABELS: Record<string, string> = {
  canon: 'Canon',
  konica: 'Konica Minolta',
  xerox: 'Xerox',
  ricoh: 'Ricoh',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function customerLabel(c: CustomerOption): string {
  return c.name || c.companyName || c.businessName || c.id;
}

export default function AddressBooksIndex() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<string>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newVendor, setNewVendor] = useState<string>('');

  const {
    data: booksRaw,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['/api/address-books'],
  });
  const books = extractRecords<AddressBookRow>(booksRaw);

  const { data: customersRaw } = useQuery({ queryKey: ['/api/customers'] });
  const customers = extractRecords<CustomerOption>(customersRaw);
  const customerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customers) m.set(c.id, customerLabel(c));
    return m;
  }, [customers]);

  const vendorOptions = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.source_vendor && set.add(b.source_vendor));
    return Array.from(set);
  }, [books]);

  const filtered = useMemo(() => {
    return books.filter((b) => {
      if (customerFilter !== 'all' && b.customer_id !== customerFilter) return false;
      if (vendorFilter !== 'all' && b.source_vendor !== vendorFilter) return false;
      if (scopeFilter === 'device' && !b.device_id) return false;
      if (scopeFilter === 'customer' && b.device_id) return false;
      return true;
    });
  }, [books, customerFilter, vendorFilter, scopeFilter]);

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/address-books', 'POST', {
        customer_id: newCustomerId,
        device_id: newDeviceId || undefined,
        name: newName,
        source_vendor: newVendor || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/address-books'] });
      toast({ title: 'Address book created' });
      setCreateOpen(false);
      setNewName('');
      setNewCustomerId('');
      setNewDeviceId('');
      setNewVendor('');
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to create address book',
        description: err?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  return (
    <MainLayout
      title="Address Books"
      description="Multi-vendor MFP address book import, editing, and conversion"
    >
      <div className="space-y-4 p-4 sm:p-6">
        {/* Header actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">All Address Books</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-[48px]" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import from File
            </Button>
            <Button className="min-h-[48px]" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Address Book
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs">Customer</Label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="min-h-[48px] sm:w-56">
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {customerLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendor</Label>
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="min-h-[48px] sm:w-44">
                  <SelectValue placeholder="All vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vendors</SelectItem>
                  {vendorOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {VENDOR_LABELS[v] || v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scope</Label>
              <Select value={scopeFilter} onValueChange={setScopeFilter}>
                <SelectTrigger className="min-h-[48px] sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scopes</SelectItem>
                  <SelectItem value="customer">Customer-wide</SelectItem>
                  <SelectItem value="device">Device-scoped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center gap-3 p-10 text-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p className="text-sm text-gray-600">
                  {(error as any)?.message || 'Failed to load address books.'}
                </p>
                <Button variant="outline" className="min-h-[48px]" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={books.length === 0 ? 'No address books yet' : 'No matching address books'}
                description={
                  books.length === 0
                    ? 'Import a vendor file or create a book to get started.'
                    : 'Try adjusting your filters.'
                }
                action={
                  books.length === 0
                    ? {
                        label: 'Import from File',
                        onClick: () => setImportOpen(true),
                        icon: Upload,
                      }
                    : undefined
                }
                secondaryAction={
                  books.length === 0
                    ? { label: 'New Address Book', onClick: () => setCreateOpen(true), icon: Plus }
                    : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Source Vendor</TableHead>
                      <TableHead className="text-right">Entries</TableHead>
                      <TableHead>Last Imported</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/service/address-books/${b.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {b.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {b.customer_name || customerNameById.get(b.customer_id) || b.customer_id}
                        </TableCell>
                        <TableCell>
                          {b.device_id ? (
                            <span className="flex items-center gap-1 text-sm">
                              <Network className="h-3.5 w-3.5 text-gray-400" />
                              {b.device_id}
                            </span>
                          ) : (
                            <Badge variant="outline">Customer-wide</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {b.source_vendor
                            ? VENDOR_LABELS[b.source_vendor] || b.source_vendor
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">{b.entry_count ?? 0}</TableCell>
                        <TableCell>{formatDate(b.last_imported_at)}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/service/address-books/${b.id}`}>
                            <Button variant="ghost" size="sm" className="min-h-[40px]">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Address Book</DialogTitle>
            <DialogDescription>Create an empty address book for a customer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                className="min-h-[48px]"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Acme Corp — Master"
              />
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={newCustomerId} onValueChange={setNewCustomerId}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {customerLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Device ID (optional)</Label>
              <Input
                className="min-h-[48px]"
                value={newDeviceId}
                onChange={(e) => setNewDeviceId(e.target.value)}
                placeholder="Leave blank for a customer-wide book"
              />
            </div>
            <div className="space-y-2">
              <Label>Source Vendor (optional)</Label>
              <Select value={newVendor} onValueChange={setNewVendor}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VENDOR_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-[48px]" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="min-h-[48px]"
              disabled={!newName.trim() || !newCustomerId || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportWizard open={importOpen} onOpenChange={setImportOpen} />
    </MainLayout>
  );
}
