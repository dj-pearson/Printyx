import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { BookOpen, Network, Plus, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportWizard } from '@/components/address-book/ImportWizard';
import { apiRequest, extractRecords } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { AddressBookRow } from '@/pages/service/AddressBooksIndex';

const VENDOR_LABELS: Record<string, string> = {
  canon: 'Canon',
  konica: 'Konica Minolta',
  xerox: 'Xerox',
  ricoh: 'Ricoh',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

interface CustomerAddressBooksTabProps {
  customerId: string;
  customerName?: string;
}

function BookCard({ book }: { book: AddressBookRow }) {
  return (
    <Link href={`/service/address-books/${book.id}`}>
      <div className="flex min-h-[64px] cursor-pointer items-center justify-between rounded-md border p-4 hover:bg-gray-50">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 font-medium">
            {book.device_id ? (
              <Network className="h-4 w-4 text-gray-400" />
            ) : (
              <BookOpen className="h-4 w-4 text-blue-500" />
            )}
            {book.name}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            <span>{book.device_id ? `Device: ${book.device_id}` : 'Customer-wide'}</span>
            {book.source_vendor && (
              <span>· {VENDOR_LABELS[book.source_vendor] || book.source_vendor}</span>
            )}
            <span>· {book.entry_count ?? 0} entries</span>
            <span>· Imported {formatDate(book.last_imported_at)}</span>
          </div>
        </div>
        <Badge variant="outline">View</Badge>
      </div>
    </Link>
  );
}

export function CustomerAddressBooksTab({
  customerId,
  customerName,
}: CustomerAddressBooksTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['/api/address-books', `?customer_id=${customerId}`],
    enabled: !!customerId,
  });
  const books = extractRecords<AddressBookRow>(data);

  const masterBook = useMemo(() => books.find((b) => !b.device_id), [books]);
  const deviceBooks = useMemo(() => books.filter((b) => b.device_id), [books]);

  const createMasterMutation = useMutation({
    mutationFn: async () =>
      apiRequest('/api/address-books', 'POST', {
        customer_id: customerId,
        name: `${customerName || 'Customer'} — Master`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/address-books', `?customer_id=${customerId}`],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/address-books'] });
      toast({ title: 'Customer-master book created' });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to create book',
        description: err?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-gray-600">
            {(error as any)?.message || 'Failed to load address books.'}
          </p>
          <Button variant="outline" className="min-h-[48px]" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Address Books</h3>
        <Button variant="outline" className="min-h-[48px]" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </div>

      {/* Customer-master */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer-Master Book</CardTitle>
        </CardHeader>
        <CardContent>
          {masterBook ? (
            <BookCard book={masterBook} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-gray-500">
                No customer-master book exists for this customer yet.
              </p>
              <Button
                className="min-h-[48px]"
                disabled={createMasterMutation.isPending}
                onClick={() => createMasterMutation.mutate()}
              >
                <Plus className="mr-2 h-4 w-4" />
                {createMasterMutation.isPending ? 'Creating…' : 'Create Customer-Master Book'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device-scoped */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Device-Scoped Books</CardTitle>
        </CardHeader>
        <CardContent>
          {deviceBooks.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">
              No device-specific address books for this customer.
            </p>
          ) : (
            <div className="space-y-2">
              {deviceBooks.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ImportWizard open={importOpen} onOpenChange={setImportOpen} defaultCustomerId={customerId} />
    </div>
  );
}

export default CustomerAddressBooksTab;
