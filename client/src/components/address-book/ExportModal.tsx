import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/supabase';
import { triggerBlobDownload } from '@/lib/invoice-pdf';
import { useToast } from '@/hooks/use-toast';
import type {
  AddressBookVendor,
  ConversionReport,
  FieldMappingIssue,
} from '@shared/address-book-types';

const VENDORS: { value: AddressBookVendor; label: string }[] = [
  { value: 'canon', label: 'Canon' },
  { value: 'konica', label: 'Konica Minolta' },
  { value: 'xerox', label: 'Xerox' },
  { value: 'ricoh', label: 'Ricoh' },
];

// Only Canon supports encrypted credentials in v1.
const ENCRYPTED_CRED_VENDORS: AddressBookVendor[] = ['canon'];

interface ExportResponse {
  export_id: string;
  download_url: string;
  conversion_report: ConversionReport;
}

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  customerName?: string;
}

function tenantIdForHeaders(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  if (localStorage.getItem('demo-authenticated') === 'true') {
    return localStorage.getItem('demo-tenant-id') || undefined;
  }
  return (
    localStorage.getItem('tenant-id') ||
    localStorage.getItem('printyx-tenant-id') ||
    localStorage.getItem('x-tenant-id') ||
    undefined
  );
}

function slugify(s: string): string {
  return (s || 'customer')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ExportModal({ open, onOpenChange, bookId, customerName }: ExportModalProps) {
  const { toast } = useToast();
  const [vendor, setVendor] = useState<AddressBookVendor>('canon');
  const [password, setPassword] = useState('');
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState<ExportResponse | null>(null);
  const [downloading, setDownloading] = useState(false);

  const supportsEncryption = ENCRYPTED_CRED_VENDORS.includes(vendor);

  const suggestedFilename = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10);
    return `abook-${slugify(customerName || 'customer')}-${vendor}-${date}.csv`;
  }, [customerName, vendor]);

  const effectiveFilename = filename.trim() || suggestedFilename;

  const exportMutation = useMutation({
    mutationFn: async (): Promise<ExportResponse> => {
      return apiRequest(`/api/address-books/${bookId}/export`, 'POST', {
        target_vendor: vendor,
        target_password: supportsEncryption && password ? password : undefined,
        filename: effectiveFilename,
      });
    },
    onSuccess: (res) => {
      setResult(res);
      toast({ title: 'Export ready', description: 'Conversion report generated.' });
    },
    onError: (err: any) => {
      toast({
        title: 'Export failed',
        description: err?.message || 'Could not export the address book.',
        variant: 'destructive',
      });
    },
  });

  const handleDownload = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const token = await getAccessToken();
      const tid = tenantIdForHeaders();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tid) headers['x-tenant-id'] = tid;

      const url = result.download_url?.startsWith('http')
        ? result.download_url
        : getApiUrl(
            result.download_url || `/api/address-books/exports/${result.export_id}/download`,
          );

      const res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
      if (!res.ok) throw new Error('Failed to download export file');
      const blob = await res.blob();
      triggerBlobDownload(blob, effectiveFilename);
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err?.message || 'Could not download the file.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setResult(null);
      setPassword('');
      setFilename('');
    }, 200);
  };

  // Group unmappable fields by entry for the report table.
  const groupedIssues = useMemo(() => {
    const report = result?.conversion_report;
    if (!report) return [] as { entry_id: string; issues: FieldMappingIssue[] }[];
    const map = new Map<string, FieldMappingIssue[]>();
    for (const issue of report.unmappable_fields) {
      const arr = map.get(issue.entry_id) ?? [];
      arr.push(issue);
      map.set(issue.entry_id, arr);
    }
    return Array.from(map.entries()).map(([entry_id, issues]) => ({ entry_id, issues }));
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Address Book</DialogTitle>
          <DialogDescription>
            Convert this book to a vendor format and review what didn&apos;t translate cleanly.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Target Vendor</Label>
              <Select value={vendor} onValueChange={(v) => setVendor(v as AddressBookVendor)}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDORS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">Target Password</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Input
                        type="password"
                        className="min-h-[48px]"
                        disabled={!supportsEncryption}
                        value={password}
                        autoComplete="new-password"
                        placeholder={
                          supportsEncryption
                            ? 'Optional credential password'
                            : 'Not supported for this vendor'
                        }
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </span>
                  </TooltipTrigger>
                  {!supportsEncryption && (
                    <TooltipContent>
                      This vendor format does not support encrypted credentials.
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-2">
              <Label>Filename</Label>
              <Input
                className="min-h-[48px] font-mono text-sm"
                value={filename}
                placeholder={suggestedFilename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3 text-center">
                <div className="text-2xl font-semibold">
                  {result.conversion_report.total_entries}
                </div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className="text-2xl font-semibold text-green-600">
                  {result.conversion_report.entries_exported}
                </div>
                <div className="text-xs text-gray-500">Exported</div>
              </div>
              <div className="rounded-md border p-3 text-center">
                <div className="text-2xl font-semibold text-amber-600">
                  {result.conversion_report.entries_dropped}
                </div>
                <div className="text-xs text-gray-500">Dropped</div>
              </div>
            </div>

            {result.conversion_report.warnings.length > 0 && (
              <div className="space-y-1 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                {result.conversion_report.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label className="mb-2 block">
                Unmappable Fields
                {groupedIssues.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {result.conversion_report.unmappable_fields.length}
                  </Badge>
                )}
              </Label>
              {groupedIssues.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Everything translated cleanly — no unmappable fields.
                </p>
              ) : (
                <ScrollArea className="max-h-[240px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entry</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedIssues.map((g) =>
                        g.issues.map((issue, idx) => (
                          <TableRow key={`${g.entry_id}-${idx}`}>
                            <TableCell className="font-mono text-xs">
                              {idx === 0 ? g.entry_id : ''}
                            </TableCell>
                            <TableCell>{issue.vendor_field}</TableCell>
                            <TableCell className="text-sm text-gray-600">{issue.reason}</TableCell>
                          </TableRow>
                        )),
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" className="min-h-[48px]" onClick={close}>
                Cancel
              </Button>
              <Button
                className="min-h-[48px]"
                disabled={exportMutation.isPending}
                onClick={() => exportMutation.mutate()}
              >
                {exportMutation.isPending ? 'Exporting…' : 'Export'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="min-h-[48px]" onClick={close}>
                Close
              </Button>
              <Button className="min-h-[48px]" disabled={downloading} onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                {downloading ? 'Downloading…' : 'Download File'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
