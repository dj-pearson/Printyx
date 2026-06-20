import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Upload, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiFormRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { extractRecords } from '@/lib/queryClient';
import type {
  AddressBookVendor,
  CanonicalEntry,
  ParseResult,
  ParseRowError,
} from '@shared/address-book-types';

const VENDORS: { value: AddressBookVendor; label: string }[] = [
  { value: 'canon', label: 'Canon' },
  { value: 'konica', label: 'Konica Minolta' },
  { value: 'xerox', label: 'Xerox' },
  { value: 'ricoh', label: 'Ricoh' },
];

type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface CustomerOption {
  id: string;
  name?: string;
  companyName?: string;
  businessName?: string;
}

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the wizard imports into this existing book (replace/merge). */
  existingBookId?: string;
  /** Pre-fill the customer (e.g. launched from a customer page). */
  defaultCustomerId?: string;
}

export function ImportWizard({
  open,
  onOpenChange,
  existingBookId,
  defaultCustomerId,
}: ImportWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>(1);
  const [vendor, setVendor] = useState<AddressBookVendor | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);

  // Target (new book) fields.
  const [bookName, setBookName] = useState('');
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? '');
  const [deviceId, setDeviceId] = useState('');
  const [mode, setMode] = useState<'replace' | 'merge'>('merge');
  const [committing, setCommitting] = useState(false);

  // Customers for the new-book target selector (only needed when no existing book).
  const { data: customersRaw, isLoading: customersLoading } = useQuery({
    queryKey: ['/api/customers'],
    enabled: open && !existingBookId,
  });
  const customers: CustomerOption[] = extractRecords<CustomerOption>(customersRaw);

  const reset = () => {
    setStep(1);
    setVendor('');
    setFile(null);
    setPassword('');
    setParse(null);
    setParsing(false);
    setBookName('');
    setCustomerId(defaultCustomerId ?? '');
    setDeviceId('');
    setMode('merge');
  };

  const close = () => {
    onOpenChange(false);
    // Defer reset so the closing animation doesn't flash step 1.
    setTimeout(reset, 200);
  };

  // Run a parse-only attempt to preview entries and detect encrypted-credential
  // files that require a password. Sent over POST; the password is never stored.
  const runParse = async () => {
    if (!file || !vendor) return;
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('vendor', vendor);
      if (password) fd.append('password', password);
      fd.append('name', bookName || file.name);
      if (customerId) fd.append('customer_id', customerId);
      fd.append('preview', 'true');

      // The import endpoint returns { parse } whether previewing or committing;
      // we use the unified import endpoint with preview semantics on the client.
      const res = existingBookId
        ? await apiFormRequest(
            `/api/address-books/${existingBookId}/import?preview=true`,
            'POST',
            (() => {
              const f = new FormData();
              f.append('file', file);
              f.append('vendor', vendor);
              if (password) f.append('password', password);
              f.append('mode', mode);
              f.append('preview', 'true');
              return f;
            })(),
          )
        : await apiFormRequest('/api/address-books/import?preview=true', 'POST', fd);

      const parseResult: ParseResult = res?.parse ?? res;
      setParse(parseResult);

      if (parseResult?.password_was_required && !password) {
        // File needs a password we don't yet have.
        setStep(3);
        toast({
          title: 'Password required',
          description: 'This file uses encrypted credentials. Enter the password to continue.',
        });
        return;
      }
      setStep(4);
    } catch (err: any) {
      toast({
        title: 'Failed to read file',
        description: err?.message || 'Could not parse the uploaded file.',
        variant: 'destructive',
      });
    } finally {
      setParsing(false);
    }
  };

  const commit = async () => {
    if (!file || !vendor) return;
    setCommitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('vendor', vendor);
      if (password) fd.append('password', password);

      let bookId: string;
      if (existingBookId) {
        fd.append('mode', mode);
        await apiFormRequest(`/api/address-books/${existingBookId}/import`, 'POST', fd);
        bookId = existingBookId;
      } else {
        fd.append('name', bookName || file.name);
        fd.append('customer_id', customerId);
        if (deviceId) fd.append('device_id', deviceId);
        const res = await apiFormRequest('/api/address-books/import', 'POST', fd);
        bookId = res?.book_id;
      }

      queryClient.invalidateQueries({ queryKey: ['/api/address-books'] });
      if (bookId) {
        queryClient.invalidateQueries({ queryKey: [`/api/address-books/${bookId}`] });
      }
      toast({ title: 'Import complete' });
      close();
      if (bookId) setLocation(`/service/address-books/${bookId}`);
    } catch (err: any) {
      toast({
        title: 'Import failed',
        description: err?.message || 'Could not import the file.',
        variant: 'destructive',
      });
    } finally {
      setCommitting(false);
    }
  };

  const previewEntries: CanonicalEntry[] = parse?.entries?.slice(0, 50) ?? [];
  const errorRows: ParseRowError[] = parse?.errors ?? [];

  const canCommit = existingBookId ? true : !!customerId && !!bookName.trim();

  const entryDest = (e: CanonicalEntry): string => {
    if (e.entry_type === 'email') return e.email;
    if (e.entry_type === 'smb') return e.smb_full_unc;
    return `${e.member_entry_ids?.length ?? 0} members`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Address Book</DialogTitle>
          <DialogDescription>
            {existingBookId
              ? 'Upload a vendor file to replace or merge into this book.'
              : 'Upload a vendor file and create a new address book.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {[
            { n: 1, label: 'Vendor' },
            { n: 2, label: 'Upload' },
            { n: 3, label: 'Password' },
            { n: 4, label: 'Preview' },
            { n: 5, label: 'Target' },
            { n: 6, label: 'Commit' },
          ].map((s) => (
            <span
              key={s.n}
              className={`rounded-full px-2 py-1 ${
                step === s.n
                  ? 'bg-blue-100 font-medium text-blue-700'
                  : step > s.n
                    ? 'text-green-600'
                    : ''
              }`}
            >
              {s.n}. {s.label}
            </span>
          ))}
        </div>

        <div className="min-h-[220px] py-2">
          {/* Step 1 — vendor */}
          {step === 1 && (
            <div className="space-y-3">
              <Label>Source Vendor</Label>
              <Select value={vendor} onValueChange={(v) => setVendor(v as AddressBookVendor)}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Select the device vendor" />
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
          )}

          {/* Step 2 — upload */}
          {step === 2 && (
            <div className="space-y-3">
              <Label>Address Book File</Label>
              <Input
                type="file"
                className="min-h-[48px]"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" /> {file.name}
                </p>
              )}
              <p className="text-sm text-gray-500">
                Optionally provide a password now if you know the file is encrypted.
              </p>
              <Input
                type="password"
                className="min-h-[48px]"
                placeholder="Password (optional)"
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {/* Step 3 — password (only reached when required) */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                This file uses encrypted credentials and requires a password.
              </div>
              <Label>Password</Label>
              <Input
                type="password"
                className="min-h-[48px]"
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                The password is sent securely and never stored in the browser.
              </p>
            </div>
          )}

          {/* Step 4 — preview */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="secondary">{parse?.entries.length ?? 0} entries</Badge>
                {errorRows.length > 0 ? (
                  <Badge variant="destructive">{errorRows.length} errors</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800">No parse errors</Badge>
                )}
              </div>
              <ScrollArea className="max-h-[280px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Destination</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewEntries.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.display_name}</TableCell>
                        <TableCell className="capitalize">{e.entry_type}</TableCell>
                        <TableCell className="font-mono text-xs">{entryDest(e)}</TableCell>
                      </TableRow>
                    ))}
                    {errorRows.slice(0, 50).map((er, i) => (
                      <TableRow key={`err-${i}`} className="bg-red-50">
                        <TableCell colSpan={3} className="text-sm text-red-700">
                          Row {er.row}: {er.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <p className="text-xs text-gray-500">Showing up to 50 entries.</p>
            </div>
          )}

          {/* Step 5 — target */}
          {step === 5 && (
            <div className="space-y-4">
              {existingBookId ? (
                <div className="space-y-2">
                  <Label>Import Mode</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as 'replace' | 'merge')}>
                    <SelectTrigger className="min-h-[48px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">Merge (add / update entries)</SelectItem>
                      <SelectItem value="replace">Replace (overwrite all entries)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Book Name</Label>
                    <Input
                      className="min-h-[48px]"
                      value={bookName}
                      onChange={(e) => setBookName(e.target.value)}
                      placeholder="e.g. Acme Corp — Front Desk MFP"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    {customersLoading ? (
                      <p className="text-sm text-gray-500">Loading customers…</p>
                    ) : (
                      <Select value={customerId} onValueChange={setCustomerId}>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name || c.companyName || c.businessName || c.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Device ID (optional)</Label>
                    <Input
                      className="min-h-[48px]"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      placeholder="Leave blank for a customer-wide book"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 6 — commit */}
          {step === 6 && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                Ready to import.
              </div>
              <ul className="space-y-1 text-gray-600">
                <li>Vendor: {VENDORS.find((v) => v.value === vendor)?.label}</li>
                <li>File: {file?.name}</li>
                <li>Entries: {parse?.entries.length ?? 0}</li>
                {existingBookId ? (
                  <li>Mode: {mode}</li>
                ) : (
                  <>
                    <li>Book: {bookName}</li>
                    <li>Scope: {deviceId ? 'Device-scoped' : 'Customer-wide'}</li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px]"
            disabled={step === 1 || parsing || committing}
            onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
          >
            Back
          </Button>

          {step === 1 && (
            <Button className="min-h-[48px]" disabled={!vendor} onClick={() => setStep(2)}>
              Next
            </Button>
          )}
          {step === 2 && (
            <Button className="min-h-[48px]" disabled={!file || parsing} onClick={runParse}>
              {parsing ? 'Reading…' : 'Next'}
            </Button>
          )}
          {step === 3 && (
            <Button className="min-h-[48px]" disabled={!password || parsing} onClick={runParse}>
              {parsing ? 'Reading…' : 'Continue'}
            </Button>
          )}
          {step === 4 && (
            <Button className="min-h-[48px]" onClick={() => setStep(5)}>
              Next
            </Button>
          )}
          {step === 5 && (
            <Button className="min-h-[48px]" disabled={!canCommit} onClick={() => setStep(6)}>
              Next
            </Button>
          )}
          {step === 6 && (
            <Button className="min-h-[48px]" disabled={committing} onClick={commit}>
              {committing ? 'Importing…' : 'Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
