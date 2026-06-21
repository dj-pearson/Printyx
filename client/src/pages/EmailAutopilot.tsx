/**
 * Sales Rep Email Autopilot (US-SUPER-016) — DRAFT MODE, NEVER auto-send.
 *
 * Per-rep console: connect a Gmail/Outlook mailbox (read + create-draft scope
 * ONLY), opt in with the enable toggle, run the overnight scan, and review the
 * AI-drafted replies. Accepting a draft only records the rep's edits + an
 * edit-distance "tone-miss" signal and leaves the draft in their mailbox —
 * PRINTYX NEVER SENDS. The rep presses Send themselves in their own mail client.
 * There is no send button anywhere on this page by design.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  AlertTriangle,
  Ban,
  CheckCircle2,
  Inbox,
  Mail,
  Play,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Locally-typed shapes
// ---------------------------------------------------------------------------

interface Account {
  provider: string;
  emailAddress: string | null;
  enabled: boolean;
  lastScanAt: string | null;
  tokensSet: boolean;
  voiceFingerprintSet: boolean;
}

interface Draft {
  id: string;
  contactEmail: string | null;
  crmContactId: string | null;
  classification: string;
  classificationConfidence: number | null;
  inboundSubject: string | null;
  inboundSnippet: string | null;
  draftSubject: string | null;
  draftBody: string | null;
  draftSource: string;
  status: string;
  editDistancePct: number | null;
  finalBody: string | null;
  toneMiss: boolean;
}

interface DraftListResponse {
  data: Draft[];
  total: number;
}

interface Stats {
  draftsReady: number;
  accepted: number;
  rejected: number;
  avgEditDistancePct: number | null;
  toneMissRate: number | null;
}

interface Suppression {
  id: string;
  contactEmail: string;
  reason: string | null;
  createdAt: string;
}

function pct(n: number | null | undefined): string {
  return n == null ? '—' : `${n}%`;
}

export default function EmailAutopilot() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState('gmail');
  const [emailAddress, setEmailAddress] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');

  const [detail, setDetail] = useState<Draft | null>(null);
  const [editBody, setEditBody] = useState('');

  const [suppressEmail, setSuppressEmail] = useState('');
  const [suppressReason, setSuppressReason] = useState('');

  const { data: account } = useQuery<Account>({ queryKey: ['/api/email-autopilot/account'] });
  const { data: stats } = useQuery<Stats>({ queryKey: ['/api/email-autopilot/stats'] });
  const {
    data: drafts,
    isLoading,
    isError,
    error,
  } = useQuery<DraftListResponse>({ queryKey: ['/api/email-autopilot/drafts?status=draft'] });
  const { data: suppressions } = useQuery<{ data: Suppression[] }>({
    queryKey: ['/api/email-autopilot/suppressions'],
  });

  const invalidateDrafts = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/email-autopilot/drafts?status=draft'] });
    queryClient.invalidateQueries({ queryKey: ['/api/email-autopilot/stats'] });
  };

  const connectMutation = useMutation({
    mutationFn: (body: {
      provider: string;
      emailAddress: string;
      accessToken?: string;
      refreshToken?: string;
    }) => apiRequest('/api/email-autopilot/connect', { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Mailbox connected', description: 'Read + create-draft scope only.' });
      setAccessToken('');
      setRefreshToken('');
      queryClient.invalidateQueries({ queryKey: ['/api/email-autopilot/account'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Connect failed',
        description: err?.message || 'Failed to connect',
        variant: 'destructive',
      }),
  });

  const settingsMutation = useMutation({
    mutationFn: (body: { enabled: boolean }) =>
      apiRequest('/api/email-autopilot/settings', { method: 'PUT', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-autopilot/account'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Update failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const scanMutation = useMutation({
    mutationFn: () => apiRequest('/api/email-autopilot/scan', { method: 'POST', body: {} }),
    onSuccess: (data: any) => {
      if (data?.skipped) {
        toast({ title: 'Scan skipped', description: data?.reason || 'Autopilot disabled.' });
      } else {
        toast({
          title: 'Scan complete',
          description: `${data?.drafted ?? 0} drafts created (${data?.scanned ?? 0} emails scanned).`,
        });
      }
      invalidateDrafts();
    },
    onError: (err: any) =>
      toast({
        title: 'Scan failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const acceptMutation = useMutation({
    mutationFn: ({ id, finalBody }: { id: string; finalBody: string }) =>
      apiRequest(`/api/email-autopilot/drafts/${id}/accept`, {
        method: 'POST',
        body: { finalBody },
      }),
    onSuccess: () => {
      toast({
        title: 'Saved as a draft in your mailbox',
        description: 'Nothing was sent — send it yourself from Gmail/Outlook.',
      });
      setDetail(null);
      invalidateDrafts();
    },
    onError: (err: any) =>
      toast({
        title: 'Accept failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/email-autopilot/drafts/${id}/reject`, { method: 'POST', body: {} }),
    onSuccess: () => {
      setDetail(null);
      invalidateDrafts();
    },
    onError: (err: any) =>
      toast({
        title: 'Reject failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const suppressMutation = useMutation({
    mutationFn: (body: { contactEmail: string; reason?: string }) =>
      apiRequest('/api/email-autopilot/suppressions', { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Contact suppressed' });
      setSuppressEmail('');
      setSuppressReason('');
      queryClient.invalidateQueries({ queryKey: ['/api/email-autopilot/suppressions'] });
    },
    onError: (err: any) =>
      toast({ title: 'Failed', description: err?.message || 'Failed', variant: 'destructive' }),
  });

  const unsuppressMutation = useMutation({
    mutationFn: (contactEmail: string) =>
      apiRequest(`/api/email-autopilot/suppressions/${encodeURIComponent(contactEmail)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-autopilot/suppressions'] });
    },
    onError: (err: any) =>
      toast({ title: 'Failed', description: err?.message || 'Failed', variant: 'destructive' }),
  });

  const openDetail = (d: Draft) => {
    setDetail(d);
    setEditBody(d.draftBody ?? '');
  };

  const rows = drafts?.data ?? [];

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-indigo-500" />
            Email Autopilot
          </h1>
          <p className="text-sm text-muted-foreground">
            AI drafts replies in your voice and saves them as drafts in your mailbox. You review and
            send — Printyx never sends on your behalf.
          </p>
        </div>
        <Button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending || !account?.enabled}
          className="min-h-[48px]"
        >
          {scanMutation.isPending ? (
            <Inbox className="h-4 w-4 mr-2 animate-pulse" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run scan now
        </Button>
      </div>

      {/* Draft-mode banner */}
      <div className="rounded-md border border-indigo-300 bg-indigo-50 dark:bg-indigo-950/20 p-3 text-sm text-indigo-800 dark:text-indigo-200 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          <strong>Draft mode only.</strong> Connected scope is read + create-draft — never send.
          Every reply lands in your Gmail/Outlook drafts for you to review and send yourself.
          Nothing on this page sends email.
        </span>
      </div>

      {/* Connect panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connect your mailbox</CardTitle>
          <CardDescription>
            Read + create-draft scope only — Printyx never sends on your behalf.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {account?.tokensSet && account?.emailAddress && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected as {account.emailAddress}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {account.provider}
              </Badge>
              <Badge variant="outline">Tokens set</Badge>
              {account.voiceFingerprintSet && <Badge variant="outline">Voice learned</Badge>}
              {account.lastScanAt && (
                <span className="text-xs text-muted-foreground">
                  Last scan {new Date(account.lastScanAt).toLocaleString()}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="space-y-1">
              <span className="text-sm font-medium">Provider</span>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Outlook</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Email address</span>
              <Input
                type="email"
                placeholder="you@company.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="min-h-[48px]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Access token (write-only)</span>
              <Input
                type="password"
                placeholder="paste access token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="min-h-[48px]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Refresh token (write-only)</span>
              <Input
                type="password"
                placeholder="paste refresh token"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                className="min-h-[48px]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              className="min-h-[48px]"
              disabled={!emailAddress || connectMutation.isPending}
              onClick={() =>
                connectMutation.mutate({
                  provider,
                  emailAddress,
                  accessToken: accessToken || undefined,
                  refreshToken: refreshToken || undefined,
                })
              }
            >
              <Mail className="h-4 w-4 mr-2" />
              {account?.tokensSet ? 'Reconnect' : 'Connect mailbox'}
            </Button>

            <div className="flex items-center gap-3">
              <Switch
                checked={!!account?.enabled}
                onCheckedChange={(checked) => settingsMutation.mutate({ enabled: checked })}
                aria-label="Enable email autopilot"
                disabled={!account?.tokensSet}
              />
              <span className="text-sm font-medium">
                Autopilot {account?.enabled ? 'on' : 'off'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts ready</CardDescription>
            <CardTitle className="text-3xl text-indigo-600">{stats?.draftsReady ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Accepted</CardDescription>
            <CardTitle className="text-3xl">{stats?.accepted ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg edit-distance</CardDescription>
            <CardTitle className="text-3xl">{pct(stats?.avgEditDistancePct)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tone-miss rate</CardDescription>
            <CardTitle className="text-3xl">{pct(stats?.toneMissRate)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Drafts ready for review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Drafts ready for review</CardTitle>
          <CardDescription>
            Review each AI draft, edit if needed, then accept (it stays a draft in your mailbox) or
            reject. You send from your own mail client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : isError ? (
            <p className="text-sm text-destructive py-8 text-center">
              Failed to load: {(error as any)?.message || 'Unknown error'}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No drafts ready. Connect a mailbox, enable autopilot, and run a scan.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openDetail(d)}
                  className="w-full text-left rounded-md border p-3 hover:bg-muted/50 transition-colors min-h-[48px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{d.contactEmail || 'Unknown sender'}</div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="capitalize">
                        {d.classification.replace('_', ' ')}
                        {d.classificationConfidence != null
                          ? ` ${Math.round(d.classificationConfidence * 100)}%`
                          : ''}
                      </Badge>
                      {d.draftSource === 'fallback' && (
                        <Badge variant="secondary">offline draft</Badge>
                      )}
                      {d.crmContactId && <Badge variant="outline">CRM</Badge>}
                      {d.toneMiss && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          tone-miss
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {d.inboundSubject || '(no subject)'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suppression management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Never auto-draft (suppressed contacts)</CardTitle>
          <CardDescription>Emails from these addresses are skipped by the scan.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            <Input
              type="email"
              placeholder="contact@example.com"
              value={suppressEmail}
              onChange={(e) => setSuppressEmail(e.target.value)}
              className="w-[260px] min-h-[48px]"
            />
            <Input
              placeholder="Reason (optional)"
              value={suppressReason}
              onChange={(e) => setSuppressReason(e.target.value)}
              className="w-[260px] min-h-[48px]"
            />
            <Button
              variant="outline"
              className="min-h-[48px]"
              disabled={!suppressEmail || suppressMutation.isPending}
              onClick={() =>
                suppressMutation.mutate({
                  contactEmail: suppressEmail,
                  reason: suppressReason || undefined,
                })
              }
            >
              <Ban className="h-4 w-4 mr-1" />
              Suppress
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(suppressions?.data ?? []).map((s) => (
              <Badge key={s.id} variant="secondary" className="gap-1">
                {s.contactEmail}
                <button
                  type="button"
                  aria-label="Remove suppression"
                  onClick={() => unsuppressMutation.mutate(s.contactEmail)}
                  className="ml-1"
                >
                  <XCircle className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {(suppressions?.data ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">None suppressed.</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Draft review dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review draft — {detail?.contactEmail || 'sender'}</DialogTitle>
            <DialogDescription>
              Edit the reply if needed, then Accept to save it as a draft in your mailbox. Printyx
              does NOT send — you send it yourself from Gmail/Outlook.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-medium">
                  Inbound: {detail.inboundSubject || '(no subject)'}
                </div>
                <div className="text-muted-foreground mt-1 whitespace-pre-wrap">
                  {detail.inboundSnippet || '(no preview)'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className="capitalize">
                  {detail.classification.replace('_', ' ')}
                </Badge>
                {detail.crmContactId && <Badge variant="outline">CRM matched</Badge>}
                {detail.draftSource === 'fallback' && (
                  <Badge variant="secondary">offline draft</Badge>
                )}
              </div>

              <div>
                <div className="text-sm font-medium mb-1">
                  Draft reply{detail.draftSubject ? ` — ${detail.draftSubject}` : ''}
                </div>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={12}
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your edits are tracked (edit-distance) to flag tone-misses — they are not sent.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {detail && (
              <>
                <Button
                  variant="outline"
                  className="min-h-[48px]"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(detail.id)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  className="min-h-[48px]"
                  disabled={acceptMutation.isPending}
                  onClick={() => acceptMutation.mutate({ id: detail.id, finalBody: editBody })}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Accept (saved as a draft in your mailbox)
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
