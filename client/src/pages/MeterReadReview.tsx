/**
 * SMS/Photo Meter Read Review (US-SUPER-002).
 *
 * Review queue for inbound photo meter reads. Customers text/email a photo of
 * their MFP meter panel; Claude vision extracts the counters and the read is
 * validated against the machine's 90-day trend. Auto-approved reads bill
 * automatically; flagged/pending reads land here. A reviewer opens a row to see
 * the photo side-by-side with editable counter inputs, then approves (creating
 * the billable read) or rejects. Also: a "submit a photo" panel (URL only — file
 * upload is a STUB) and a settings panel (threshold, SMS templates, write-only
 * Twilio creds shown as set / not set).
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Camera, Check, Gauge, ImageOff, Send, Settings2, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface ExtractedValues {
  black?: number;
  color?: number;
  scan?: number;
  fax?: number;
  confidence?: number;
  source?: 'ai' | 'fallback';
}

interface Submission {
  id: string;
  source: string;
  fromPhone: string | null;
  customerId: string | null;
  machineId: string | null;
  rawImageUrl: string | null;
  imageHash: string | null;
  extractedValues: ExtractedValues | null;
  validationStatus: string;
  validationDetail: { reason?: string; [k: string]: unknown } | null;
  outboundMessage: string | null;
  meterReadingId: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  serialNumber: string | null;
  modelNumber: string | null;
  companyName: string | null;
}

interface Settings {
  tenantId: string;
  maxDeltaMultiplier: number;
  confirmTemplate: string;
  clarifyTemplate: string;
  updatedAt: string | null;
  twilioAccountSidSet: boolean;
  twilioAuthTokenSet: boolean;
  twilioFromNumberSet: boolean;
}

const STATUS_FILTERS = ['flagged', 'pending', 'approved', 'rejected', 'all'] as const;

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'flagged' || status === 'rejected') return 'destructive';
  if (status === 'auto_approved' || status === 'approved') return 'secondary';
  if (status === 'pending') return 'outline';
  return 'default';
}

function sourceVariant(source: string): 'default' | 'secondary' | 'outline' {
  if (source === 'sms') return 'default';
  if (source === 'email') return 'secondary';
  return 'outline';
}

function fmtNum(n: number | undefined | null): string {
  return n == null ? '—' : Number(n).toLocaleString();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MeterReadReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('flagged');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const queueKey = `/api/meter-reads/submissions?status=${statusFilter}`;
  const {
    data: queue,
    isLoading,
    isError,
    error,
  } = useQuery<{ data: Submission[] }>({ queryKey: [queueKey] });

  const invalidateQueue = () => {
    for (const s of STATUS_FILTERS) {
      queryClient.invalidateQueries({ queryKey: [`/api/meter-reads/submissions?status=${s}`] });
    }
  };

  const rows = queue?.data ?? [];

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6 text-emerald-500" />
            Meter Read Review
          </h1>
          <p className="text-sm text-muted-foreground">
            Photo meter reads from SMS / email. Vision extracts the counters and validates against
            the 90-day trend; flagged and unresolved reads land here for review.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowSettings((s) => !s)}
          className="min-h-[48px]"
        >
          <Settings2 className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {showSettings && <SettingsPanel />}

      <SubmitPhotoPanel
        onSubmitted={() => {
          invalidateQueue();
        }}
      />

      {/* Review queue */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Review queue</CardTitle>
            <CardDescription>
              Newest first. Click a row to review the photo + counters.
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                onClick={() => setStatusFilter(s)}
                className="min-h-[40px] capitalize"
              >
                {s}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading submissions…</p>
          ) : isError ? (
            <p className="text-sm text-destructive py-8 text-center">
              Failed to load: {(error as any)?.message || 'Unknown error'}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No submissions in this view.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer / Machine</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Black</TableHead>
                    <TableHead className="text-right">Color</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <TableCell className="font-medium">
                        {r.companyName || 'Unknown customer'}
                        <div className="text-xs text-muted-foreground">
                          {r.serialNumber || (r.machineId ? r.machineId.slice(0, 8) : 'No machine')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sourceVariant(r.source)} className="uppercase">
                          {r.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtNum(r.extractedValues?.black)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtNum(r.extractedValues?.color)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.extractedValues?.confidence == null
                          ? '—'
                          : `${Math.round((r.extractedValues.confidence ?? 0) * 100)}%`}
                      </TableCell>
                      <TableCell className="text-xs max-w-[240px] truncate">
                        {r.validationDetail?.reason ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.validationStatus)} className="capitalize">
                          {r.validationStatus.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ReviewDialog
        submission={selected}
        onClose={() => setSelected(null)}
        onResolved={() => {
          setSelected(null);
          invalidateQueue();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review dialog — image side-by-side with editable counters
// ---------------------------------------------------------------------------

function ReviewDialog({
  submission,
  onClose,
  onResolved,
}: {
  submission: Submission | null;
  onClose: () => void;
  onResolved: () => void;
}) {
  const { toast } = useToast();
  const ev = submission?.extractedValues ?? {};
  const [black, setBlack] = useState('');
  const [color, setColor] = useState('');
  const [scan, setScan] = useState('');
  const [fax, setFax] = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  // Reset edit fields when a new submission opens.
  if (submission && submission.id !== lastId) {
    setLastId(submission.id);
    setBlack(String(submission.extractedValues?.black ?? ''));
    setColor(String(submission.extractedValues?.color ?? ''));
    setScan(String(submission.extractedValues?.scan ?? ''));
    setFax(String(submission.extractedValues?.fax ?? ''));
    setImgFailed(false);
  }

  const approve = useMutation({
    mutationFn: () =>
      apiRequest(`/api/meter-reads/submissions/${submission!.id}/approve`, {
        method: 'POST',
        body: {
          black: black === '' ? undefined : parseInt(black, 10),
          color: color === '' ? undefined : parseInt(color, 10),
          scan: scan === '' ? undefined : parseInt(scan, 10),
          fax: fax === '' ? undefined : parseInt(fax, 10),
        },
      }),
    onSuccess: () => {
      toast({ title: 'Read approved', description: 'A billable meter read was recorded.' });
      onResolved();
    },
    onError: (err: any) =>
      toast({
        title: 'Approve failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const reject = useMutation({
    mutationFn: () =>
      apiRequest(`/api/meter-reads/submissions/${submission!.id}/reject`, {
        method: 'POST',
        body: {},
      }),
    onSuccess: () => {
      toast({ title: 'Read rejected' });
      onResolved();
    },
    onError: (err: any) =>
      toast({
        title: 'Reject failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const open = submission != null;
  const busy = approve.isPending || reject.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review meter read</DialogTitle>
          <DialogDescription>
            {submission?.companyName || 'Unknown customer'} ·{' '}
            {submission?.serialNumber || submission?.machineId?.slice(0, 8) || 'No machine'}
          </DialogDescription>
        </DialogHeader>

        {submission && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Image */}
            <div className="rounded-md border bg-muted/30 flex items-center justify-center min-h-[220px] overflow-hidden">
              {submission.rawImageUrl && !imgFailed ? (
                // eslint-disable-next-line jsx-a11y/img-redundant-alt
                <img
                  src={submission.rawImageUrl}
                  alt="Submitted meter photo"
                  className="max-h-[320px] w-full object-contain"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground p-6 text-center">
                  <ImageOff className="h-8 w-8" />
                  <span className="text-sm">
                    {submission.rawImageUrl ? 'Image could not be loaded' : 'No image attached'}
                  </span>
                </div>
              )}
            </div>

            {/* Editable counters */}
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Extracted by{' '}
                <span className="font-medium">{ev.source === 'ai' ? 'vision' : 'fallback'}</span>
                {ev.confidence != null &&
                  ` · ${Math.round((ev.confidence ?? 0) * 100)}% confidence`}
              </div>
              {submission.validationDetail?.reason && (
                <div className="text-xs rounded bg-amber-50 text-amber-800 border border-amber-200 p-2">
                  {submission.validationDetail.reason}
                </div>
              )}
              {(
                [
                  ['Black', black, setBlack],
                  ['Color', color, setColor],
                  ['Scan', scan, setScan],
                  ['Fax', fax, setFax],
                ] as const
              ).map(([label, val, setter]) => (
                <label key={label} className="space-y-1 block">
                  <span className="text-sm font-medium">{label}</span>
                  <Input
                    type="number"
                    min={0}
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    className="min-h-[48px]"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 flex-wrap">
          <Button
            variant="outline"
            className="min-h-[48px]"
            disabled={busy}
            onClick={() => reject.mutate()}
          >
            <X className="h-4 w-4 mr-2" />
            Reject
          </Button>
          <Button className="min-h-[48px]" disabled={busy} onClick={() => approve.mutate()}>
            <Check className="h-4 w-4 mr-2" />
            Approve &amp; record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Submit a photo (URL only — file upload is a STUB)
// ---------------------------------------------------------------------------

function SubmitPhotoPanel({ onSubmitted }: { onSubmitted: () => void }) {
  const { toast } = useToast();
  const [machineId, setMachineId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      apiRequest('/api/meter-reads/submit', {
        method: 'POST',
        body: { machineId, imageUrl: imageUrl || undefined, source: 'web' },
      }),
    onSuccess: (data: any) => {
      const status = data?.submission?.validationStatus ?? 'submitted';
      setResult(`Submission ${status.replace('_', ' ')}. ${data?.outboundMessage ?? ''}`.trim());
      toast({ title: 'Submitted', description: `Status: ${status.replace('_', ' ')}` });
      onSubmitted();
    },
    onError: (err: any) =>
      toast({
        title: 'Submit failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Submit a photo
        </CardTitle>
        <CardDescription>
          Manual web submission. File upload is a stub — paste an image URL. The machine id is
          required so we can validate against its history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1 block">
            <span className="text-sm font-medium">Machine id (equipment.id)</span>
            <Input
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              placeholder="equipment UUID"
              className="min-h-[48px]"
            />
          </label>
          <label className="space-y-1 block">
            <span className="text-sm font-medium">Image URL</span>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…/meter.jpg"
              className="min-h-[48px]"
            />
          </label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !machineId}
            className="min-h-[48px]"
          >
            <Send className="h-4 w-4 mr-2" />
            {submit.isPending ? 'Submitting…' : 'Submit'}
          </Button>
          {result && <span className="text-sm text-muted-foreground">{result}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

function SettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    data: settings,
    isLoading,
    isError,
  } = useQuery<Settings>({ queryKey: ['/api/meter-reads/settings'] });

  const [maxDelta, setMaxDelta] = useState('');
  const [confirmTpl, setConfirmTpl] = useState('');
  const [clarifyTpl, setClarifyTpl] = useState('');
  const [sid, setSid] = useState('');
  const [token, setToken] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [hydratedId, setHydratedId] = useState<string | null>(null);

  // Hydrate the editable fields once settings load.
  if (settings && hydratedId !== settings.tenantId) {
    setHydratedId(settings.tenantId);
    setMaxDelta(String(settings.maxDeltaMultiplier));
    setConfirmTpl(settings.confirmTemplate);
    setClarifyTpl(settings.clarifyTemplate);
  }

  const save = useMutation({
    mutationFn: () =>
      apiRequest('/api/meter-reads/settings', {
        method: 'PUT',
        body: {
          maxDeltaMultiplier: maxDelta === '' ? undefined : parseInt(maxDelta, 10),
          confirmTemplate: confirmTpl,
          clarifyTemplate: clarifyTpl,
          twilioAccountSid: sid || undefined,
          twilioAuthToken: token || undefined,
          twilioFromNumber: fromNumber || undefined,
        },
      }),
    onSuccess: () => {
      toast({ title: 'Settings saved' });
      setSid('');
      setToken('');
      setFromNumber('');
      queryClient.invalidateQueries({ queryKey: ['/api/meter-reads/settings'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Save failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Meter read settings</CardTitle>
        <CardDescription>
          Validation threshold, SMS templates ({'{{black}}'}, {'{{color}}'} tokens), and Twilio
          credentials (write-only).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading settings…</p>
        ) : isError || !settings ? (
          <p className="text-sm text-destructive">Failed to load settings.</p>
        ) : (
          <div className="space-y-4">
            <label className="space-y-1 block max-w-xs">
              <span className="text-sm font-medium">Max delta multiplier</span>
              <Input
                type="number"
                min={1}
                value={maxDelta}
                onChange={(e) => setMaxDelta(e.target.value)}
                className="min-h-[48px]"
              />
              <span className="text-xs text-muted-foreground">
                Flag a read when the black-counter jump exceeds this × the rolling 90-day average
                (or goes backwards).
              </span>
            </label>

            <label className="space-y-1 block">
              <span className="text-sm font-medium">Confirmation template</span>
              <Textarea
                value={confirmTpl}
                onChange={(e) => setConfirmTpl(e.target.value)}
                rows={2}
                className="min-h-[48px]"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-sm font-medium">Clarification template</span>
              <Textarea
                value={clarifyTpl}
                onChange={(e) => setClarifyTpl(e.target.value)}
                rows={2}
                className="min-h-[48px]"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CredField
                label="Twilio Account SID"
                isSet={settings.twilioAccountSidSet}
                value={sid}
                onChange={setSid}
              />
              <CredField
                label="Twilio Auth Token"
                isSet={settings.twilioAuthTokenSet}
                value={token}
                onChange={setToken}
              />
              <CredField
                label="Twilio From Number"
                isSet={settings.twilioFromNumberSet}
                value={fromNumber}
                onChange={setFromNumber}
              />
            </div>

            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="min-h-[48px]"
            >
              {save.isPending ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CredField({
  label,
  isSet,
  value,
  onChange,
}: {
  label: string;
  isSet: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1 block">
      <span className="text-sm font-medium flex items-center gap-2">
        {label}
        <Badge variant={isSet ? 'secondary' : 'outline'}>{isSet ? 'set' : 'not set'}</Badge>
      </span>
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isSet ? '•••••• (leave blank to keep)' : 'Enter value'}
        className="min-h-[48px]"
      />
    </label>
  );
}
