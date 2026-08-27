import { useMemo, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Network,
  Users,
  Search,
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  AlertCircle,
  ArrowLeft,
  CornerDownRight,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EntryFormDialog } from '@/components/address-book/EntryFormDialog';
import { ImportWizard } from '@/components/address-book/ImportWizard';
import { ExportModal } from '@/components/address-book/ExportModal';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { CanonicalEntry, EntryType } from '@shared/address-book-types';
import type { AddressBookRow } from './AddressBooksIndex';

const VENDOR_LABELS: Record<string, string> = {
  canon: 'Canon',
  konica: 'Konica Minolta',
  xerox: 'Xerox',
  ricoh: 'Ricoh',
};

interface BookDetailResponse {
  book: AddressBookRow;
  entries: CanonicalEntry[];
}

function entryIcon(type: EntryType) {
  if (type === 'email') return Mail;
  if (type === 'smb') return Network;
  return Users;
}

function entryDestination(e: CanonicalEntry): string {
  if (e.entry_type === 'email') return e.email;
  if (e.entry_type === 'smb') return e.smb_full_unc;
  return `${e.member_entry_ids?.length ?? 0} members`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function AddressBookDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CanonicalEntry | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CanonicalEntry | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<BookDetailResponse>({
    queryKey: [`/api/address-books/${id}`],
    enabled: !!id,
  });

  const book = data?.book;
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const isDeviceScoped = !!book?.device_id;

  // For device-scoped books, fetch the customer-master (device_id = null) book to
  // surface inherited entries (US-022).
  const { data: customerBooksRaw } = useQuery({
    queryKey: ['/api/address-books', `?customer_id=${book?.customer_id ?? ''}`],
    enabled: !!book?.customer_id && isDeviceScoped,
  });
  const masterBook: AddressBookRow | undefined = useMemo(() => {
    const list: AddressBookRow[] = Array.isArray(customerBooksRaw)
      ? customerBooksRaw
      : ((customerBooksRaw as any)?.data ?? []);
    return list.find((b) => !b.device_id && b.id !== id);
  }, [customerBooksRaw, id]);

  const { data: masterDetail } = useQuery<BookDetailResponse>({
    queryKey: [`/api/address-books/${masterBook?.id}`],
    enabled: !!masterBook?.id && isDeviceScoped,
  });
  const masterEntries = useMemo(() => masterDetail?.entries ?? [], [masterDetail]);

  // Inherited entries: master entries not yet overridden in this device book.
  const overriddenMasterIds = useMemo(
    () => new Set(entries.map((e) => e.overrides_entry_id).filter(Boolean) as string[]),
    [entries],
  );
  const inheritedEntries = useMemo(
    () => masterEntries.filter((e) => e.id && !overriddenMasterIds.has(e.id)),
    [masterEntries, overriddenMasterIds],
  );

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) =>
      apiRequest(`/api/address-books/${id}/entries/${entryId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/address-books/${id}`] });
      toast({ title: 'Entry deleted' });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to delete entry',
        description: err?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async (source: CanonicalEntry) => {
      const { id: _omit, ...rest } = source;
      const payload = { ...rest, is_override: true, overrides_entry_id: source.id };
      return apiRequest(`/api/address-books/${id}/entries`, 'POST', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/address-books/${id}`] });
      toast({ title: 'Override created', description: 'Edits now affect only this device.' });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to create override',
        description: err?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const revertMutation = useMutation({
    mutationFn: async (overrideId: string) =>
      apiRequest(`/api/address-books/${id}/entries/${overrideId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/address-books/${id}`] });
      toast({ title: 'Override reverted' });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to revert override',
        description: err?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const filterEntries = (list: CanonicalEntry[]) =>
    list.filter((e) => {
      if (typeFilter !== 'all' && e.entry_type !== typeFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.display_name.toLowerCase().includes(q) || entryDestination(e).toLowerCase().includes(q)
      );
    });

  const visibleEntries = filterEntries(entries);
  const visibleInherited = filterEntries(inheritedEntries);

  const openAdd = () => {
    setEditEntry(undefined);
    setFormOpen(true);
  };
  const openEdit = (e: CanonicalEntry) => {
    setEditEntry(e);
    setFormOpen(true);
  };

  // ----- render helpers -------------------------------------------------------

  const renderEntryRow = (e: CanonicalEntry) => {
    const Icon = entryIcon(e.entry_type);
    return (
      <TableRow key={e.id}>
        <TableCell>
          <Icon className="h-4 w-4 text-gray-500" />
        </TableCell>
        <TableCell className="font-medium">
          <span className="flex items-center gap-2">
            {e.display_name}
            {e.is_override && <Badge className="bg-purple-100 text-purple-700">Override</Badge>}
          </span>
        </TableCell>
        <TableCell className="font-mono text-xs">{entryDestination(e)}</TableCell>
        <TableCell className="text-right">{e.speed_dial_index ?? '—'}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => openEdit(e)}
              aria-label="Edit entry"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {e.is_override && e.id ? (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[40px]"
                onClick={() => revertMutation.mutate(e.id!)}
              >
                Revert
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-red-600"
                onClick={() => setDeleteTarget(e)}
                aria-label="Delete entry"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <MainLayout title={book?.name || 'Address Book'} description="Address book entries">
      <div className="space-y-4 p-4 sm:p-6">
        <Link
          href="/service/address-books"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Address Books
        </Link>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm text-gray-600">
                {(error as any)?.message || 'Failed to load this address book.'}
              </p>
              <Button variant="outline" className="min-h-[48px]" onClick={() => refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : !book ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-gray-600">
              Address book not found.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Header card */}
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{book.name}</CardTitle>
                  <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                    <span>Customer: {book.customer_name || book.customer_id}</span>
                    <span>·</span>
                    <span>{book.device_id ? `Device: ${book.device_id}` : 'Customer-wide'}</span>
                    {book.source_vendor && (
                      <>
                        <span>·</span>
                        <span>{VENDOR_LABELS[book.source_vendor] || book.source_vendor}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>Last import: {formatDate(book.last_imported_at)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="min-h-[48px]"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[48px]"
                    onClick={() => setExportOpen(true)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button className="min-h-[48px]" onClick={openAdd}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Entry
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Search + filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  aria-label="Search entries"
                  className="min-h-[48px] pl-9"
                  placeholder="Search entries…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="min-h-[48px] sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="smb">SMB</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Overrides / entries section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isDeviceScoped ? 'Device Overrides' : 'Entries'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {entries.length === 0 && !isDeviceScoped ? (
                  <EmptyState
                    icon={Mail}
                    title="No entries yet"
                    description="Import a vendor file or add entries manually."
                    action={{ label: 'Import', onClick: () => setImportOpen(true), icon: Upload }}
                    secondaryAction={{ label: 'Add Entry', onClick: openAdd, icon: Plus }}
                  />
                ) : visibleEntries.length === 0 ? (
                  <p className="p-6 text-sm text-gray-500">
                    {isDeviceScoped
                      ? 'No device-specific overrides. Override an inherited entry below.'
                      : 'No entries match your search.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Display Name</TableHead>
                          <TableHead>Email / Path</TableHead>
                          <TableHead className="text-right">Speed Dial</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>{visibleEntries.map(renderEntryRow)}</TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inherited section (device-scoped only) */}
            {isDeviceScoped && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CornerDownRight className="h-4 w-4 text-gray-400" />
                    Inherited from Customer-Master
                    {masterBook && (
                      <Link
                        href={`/service/address-books/${masterBook.id}`}
                        className="text-sm font-normal text-blue-600 hover:underline"
                      >
                        ({masterBook.name})
                      </Link>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {!masterBook ? (
                    <p className="p-6 text-sm text-gray-500">
                      No customer-master book found for this customer.
                    </p>
                  ) : visibleInherited.length === 0 ? (
                    <p className="p-6 text-sm text-gray-500">
                      No inherited entries
                      {search || typeFilter !== 'all' ? ' match your filters' : ''}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>Display Name</TableHead>
                            <TableHead>Email / Path</TableHead>
                            <TableHead className="text-right">Speed Dial</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleInherited.map((e) => {
                            const Icon = entryIcon(e.entry_type);
                            return (
                              <TableRow key={e.id} className="bg-gray-50/60">
                                <TableCell>
                                  <Icon className="h-4 w-4 text-gray-400" />
                                </TableCell>
                                <TableCell className="text-gray-600">{e.display_name}</TableCell>
                                <TableCell className="font-mono text-xs text-gray-500">
                                  {entryDestination(e)}
                                </TableCell>
                                <TableCell className="text-right text-gray-500">
                                  {e.speed_dial_index ?? '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="min-h-[40px]"
                                    disabled={overrideMutation.isPending}
                                    onClick={() => overrideMutation.mutate(e)}
                                  >
                                    Override this entry
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      {id && (
        <EntryFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          bookId={id}
          entry={editEntry}
          existingEntries={entries}
        />
      )}
      {id && (
        <ImportWizard
          open={importOpen}
          onOpenChange={setImportOpen}
          existingBookId={id}
          defaultCustomerId={book?.customer_id}
        />
      )}
      {id && (
        <ExportModal
          open={exportOpen}
          onOpenChange={setExportOpen}
          bookId={id}
          customerName={book?.customer_name || book?.customer_id}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteTarget?.display_name}&quot; from this address book.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[48px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[48px] bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget?.id && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
