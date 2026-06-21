/**
 * Voice Phone Agent for After-Hours Service Intake (US-SUPER-013).
 *
 * Ops console for the inbound after-hours voice agent. A Twilio voice AI agent
 * answers after-hours service calls, identifies the caller (ANI), summarizes the
 * issue, classifies priority (P1/P2/P3), opens a service ticket, and pages the
 * on-call tech for P1 — recovering calls otherwise lost when no one answers.
 *
 * This page exposes:
 *   - A settings panel with a prominent KILL SWITCH, after-hours-only + PII
 *     redaction toggles, language selection, Twilio number, and write-only
 *     Twilio/ElevenLabs credential inputs (set / not-set badges).
 *   - A monthly cost tally card (Twilio + AI split + call count, current + prior).
 *   - A call log table (filterable by priority) with a detail dialog.
 *   - A "Simulate an intake call" panel so the pipeline is demoable without
 *     Twilio (the real-time voice stack is a backend STUB).
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  AlertTriangle,
  DollarSign,
  PhoneCall,
  Play,
  Power,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Local types (shapes mirror server/routes-voice-agent.ts)
// ---------------------------------------------------------------------------

type Priority = 'P1' | 'P2' | 'P3';

interface VoiceSettings {
  tenantId: string;
  enabled: boolean;
  afterHoursOnly: boolean;
  businessHours: unknown;
  languages: string[];
  piiRedaction: boolean;
  twilioNumber: string | null;
  updatedAt: string | null;
  twilioSet: boolean;
  elevenLabsSet: boolean;
}

interface VoiceCall {
  id: string;
  callSid: string | null;
  fromNumber: string | null;
  callerCustomerId: string | null;
  language: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  recordingPurgeAt: string | null;
  detectedIssue: string | null;
  machineRef: string | null;
  callbackNumber: string | null;
  priority: Priority | null;
  ticketId: string | null;
  escalated: boolean;
  onCallTechId: string | null;
  twilioCost: number;
  aiCost: number;
  totalCost: number;
  durationSeconds: number;
  status: string;
  createdAt: string;
  companyName: string | null;
}

interface MonthCost {
  month: string;
  twilioCost: number;
  aiCost: number;
  totalCost: number;
  callCount: number;
}

interface CostTally {
  currentMonth: MonthCost;
  months: MonthCost[];
}

interface IntakeResult {
  handled: boolean;
  reason?: string;
  call?: VoiceCall;
  ticketId?: string | null;
  priority?: Priority;
  escalated?: boolean;
  note?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function money(n: number | null | undefined): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

function priorityClass(p: Priority | null | undefined): string {
  if (p === 'P1') return 'bg-red-600 text-white';
  if (p === 'P2') return 'bg-amber-500 text-white';
  return 'bg-slate-500 text-white';
}

function PriorityPill({ p }: { p: Priority | null | undefined }) {
  return <Badge className={priorityClass(p)}>{p ?? 'P3'}</Badge>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VoiceAgent() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [selected, setSelected] = useState<VoiceCall | null>(null);

  // --- Settings query -------------------------------------------------------
  const settingsQuery = useQuery<VoiceSettings>({
    queryKey: ['/api/voice-agent/settings'],
    queryFn: () => apiRequest('/api/voice-agent/settings'),
  });

  // --- Cost query -----------------------------------------------------------
  const costQuery = useQuery<CostTally>({
    queryKey: ['/api/voice-agent/cost'],
    queryFn: () => apiRequest('/api/voice-agent/cost'),
  });

  // --- Calls query ----------------------------------------------------------
  const callsQuery = useQuery<{ data: VoiceCall[]; total: number }>({
    queryKey: ['/api/voice-agent/calls', priorityFilter],
    queryFn: () =>
      apiRequest(
        priorityFilter === 'all'
          ? '/api/voice-agent/calls'
          : `/api/voice-agent/calls?priority=${priorityFilter}`,
      ),
  });

  const settings = settingsQuery.data;

  // --- Settings mutation ----------------------------------------------------
  const updateSettings = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest('/api/voice-agent/settings', { method: 'PUT', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/voice-agent/settings'] });
      toast({ title: 'Settings saved' });
    },
    onError: (err: any) =>
      toast({
        title: 'Save failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  // --- Credential local state ----------------------------------------------
  const [twilioNumber, setTwilioNumber] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');

  function saveCreds() {
    const body: Record<string, unknown> = {};
    if (twilioNumber.trim()) body.twilioNumber = twilioNumber.trim();
    if (twilioAccountSid.trim()) body.twilioAccountSid = twilioAccountSid.trim();
    if (twilioAuthToken.trim()) body.twilioAuthToken = twilioAuthToken.trim();
    if (elevenLabsApiKey.trim()) body.elevenLabsApiKey = elevenLabsApiKey.trim();
    if (Object.keys(body).length === 0) {
      toast({ title: 'Nothing to save', description: 'Enter a value first.' });
      return;
    }
    updateSettings.mutate(body, {
      onSuccess: () => {
        setTwilioAccountSid('');
        setTwilioAuthToken('');
        setElevenLabsApiKey('');
      },
    });
  }

  function toggleLanguage(code: string, checked: boolean) {
    const current = settings?.languages ?? [];
    const next = checked
      ? Array.from(new Set([...current, code]))
      : current.filter((c) => c !== code);
    updateSettings.mutate({ languages: next });
  }

  // --- Simulate intake ------------------------------------------------------
  const [simFrom, setSimFrom] = useState('');
  const [simTranscript, setSimTranscript] = useState('');
  const [simDuration, setSimDuration] = useState('120');
  const [simResult, setSimResult] = useState<IntakeResult | null>(null);

  const simulate = useMutation({
    mutationFn: () =>
      apiRequest('/api/voice-agent/intake', {
        method: 'POST',
        body: {
          fromNumber: simFrom.trim() || undefined,
          transcript: simTranscript.trim() || undefined,
          durationSeconds: simDuration ? parseInt(simDuration, 10) : undefined,
        },
      }) as Promise<IntakeResult>,
    onSuccess: (result) => {
      setSimResult(result);
      qc.invalidateQueries({ queryKey: ['/api/voice-agent/calls'] });
      qc.invalidateQueries({ queryKey: ['/api/voice-agent/cost'] });
      if (result.handled) {
        toast({
          title: `Call handled — ${result.priority}`,
          description: result.escalated ? 'On-call tech paged.' : 'Ticket queued.',
        });
      } else {
        toast({ title: 'Call not handled', description: result.reason });
      }
    },
    onError: (err: any) =>
      toast({
        title: 'Simulation failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const calls = callsQuery.data?.data ?? [];
  const cost = costQuery.data;

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <PhoneCall className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">After-Hours Voice Agent</h1>
          <p className="text-sm text-muted-foreground">
            AI answers after-hours service calls, opens tickets, and pages on-call for P1.
          </p>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Settings */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" /> Agent settings
          </CardTitle>
          <CardDescription>The agent only answers when the kill switch is ON.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settingsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading settings…</p>
          ) : settingsQuery.isError ? (
            <p className="text-sm text-red-600">Failed to load settings.</p>
          ) : settings ? (
            <>
              {/* Kill switch */}
              <div
                className={`flex items-center justify-between rounded-lg border p-4 ${
                  settings.enabled ? 'border-green-500 bg-green-50' : 'border-red-300 bg-red-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Power
                    className={`h-6 w-6 ${settings.enabled ? 'text-green-600' : 'text-red-600'}`}
                  />
                  <div>
                    <div className="font-semibold">
                      Voice agent is {settings.enabled ? 'ON' : 'OFF'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {settings.enabled
                        ? 'Inbound after-hours calls are being answered and triaged.'
                        : 'All inbound calls are ignored until you turn this on.'}
                    </div>
                  </div>
                </div>
                <Switch
                  className="min-h-[48px]"
                  checked={settings.enabled}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(v) => updateSettings.mutate({ enabled: v })}
                  aria-label="Toggle voice agent"
                />
              </div>

              {/* Toggles */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border p-3 min-h-[48px]">
                  <div>
                    <div className="font-medium">After-hours only</div>
                    <div className="text-xs text-muted-foreground">
                      Answer only outside business hours (vs 24/7).
                    </div>
                  </div>
                  <Switch
                    checked={settings.afterHoursOnly}
                    disabled={updateSettings.isPending}
                    onCheckedChange={(v) => updateSettings.mutate({ afterHoursOnly: v })}
                    aria-label="Toggle after-hours only"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3 min-h-[48px]">
                  <div>
                    <div className="font-medium flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4" /> PII redaction
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Mask card numbers in stored transcripts.
                    </div>
                  </div>
                  <Switch
                    checked={settings.piiRedaction}
                    disabled={updateSettings.isPending}
                    onCheckedChange={(v) => updateSettings.mutate({ piiRedaction: v })}
                    aria-label="Toggle PII redaction"
                  />
                </div>
              </div>

              {/* Languages */}
              <div className="space-y-2">
                <Label>Languages (detected from first seconds)</Label>
                <div className="flex flex-wrap gap-4">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const checked = (settings.languages ?? []).includes(lang.code);
                    return (
                      <label
                        key={lang.code}
                        className="flex items-center gap-2 min-h-[48px] cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={updateSettings.isPending}
                          onCheckedChange={(v) => toggleLanguage(lang.code, v === true)}
                        />
                        <span>{lang.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Credentials */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label>Twilio / ElevenLabs credentials</Label>
                  <Badge variant={settings.twilioSet ? 'default' : 'outline'}>
                    Twilio {settings.twilioSet ? 'set' : 'not set'}
                  </Badge>
                  <Badge variant={settings.elevenLabsSet ? 'default' : 'outline'}>
                    ElevenLabs {settings.elevenLabsSet ? 'set' : 'not set'}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="twilioNumber">Twilio number</Label>
                    <Input
                      id="twilioNumber"
                      className="min-h-[48px]"
                      placeholder={settings.twilioNumber ?? '+1 555 555 1234'}
                      value={twilioNumber}
                      onChange={(e) => setTwilioNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="twilioSid">Twilio Account SID (write-only)</Label>
                    <Input
                      id="twilioSid"
                      className="min-h-[48px]"
                      type="password"
                      placeholder="ACxxxxxxxx"
                      value={twilioAccountSid}
                      onChange={(e) => setTwilioAccountSid(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="twilioToken">Twilio Auth Token (write-only)</Label>
                    <Input
                      id="twilioToken"
                      className="min-h-[48px]"
                      type="password"
                      placeholder="••••••••"
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="elevenLabs">ElevenLabs API key (write-only)</Label>
                    <Input
                      id="elevenLabs"
                      className="min-h-[48px]"
                      type="password"
                      placeholder="••••••••"
                      value={elevenLabsApiKey}
                      onChange={(e) => setElevenLabsApiKey(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  className="min-h-[48px]"
                  onClick={saveCreds}
                  disabled={updateSettings.isPending}
                >
                  Save credentials
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Cost tally */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Monthly cost
          </CardTitle>
          <CardDescription>
            Per-minute proxy rates (Twilio $0.013/min + AI $0.10/min).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {costQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading cost…</p>
          ) : costQuery.isError ? (
            <p className="text-sm text-red-600">Failed to load cost tally.</p>
          ) : cost ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/40">
                <div className="text-sm text-muted-foreground">
                  Current month ({cost.currentMonth.month})
                </div>
                <div className="text-3xl font-bold">{money(cost.currentMonth.totalCost)}</div>
                <div className="text-sm text-muted-foreground">
                  Twilio {money(cost.currentMonth.twilioCost)} · AI{' '}
                  {money(cost.currentMonth.aiCost)} · {cost.currentMonth.callCount} calls
                </div>
              </div>
              {cost.months.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Twilio</TableHead>
                      <TableHead className="text-right">AI</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cost.months.map((m) => (
                      <TableRow key={m.month}>
                        <TableCell>{m.month}</TableCell>
                        <TableCell className="text-right">{money(m.twilioCost)}</TableCell>
                        <TableCell className="text-right">{money(m.aiCost)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {money(m.totalCost)}
                        </TableCell>
                        <TableCell className="text-right">{m.callCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No billed calls yet.</p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Simulate intake */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" /> Simulate an intake call
          </CardTitle>
          <CardDescription>
            Exercise the pipeline without Twilio. The real-time voice stack is a backend stub; this
            ingests a call-end summary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="simFrom">Caller number</Label>
              <Input
                id="simFrom"
                className="min-h-[48px]"
                placeholder="+1 555 555 1234"
                value={simFrom}
                onChange={(e) => setSimFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="simDuration">Duration (seconds)</Label>
              <Input
                id="simDuration"
                className="min-h-[48px]"
                type="number"
                min={0}
                value={simDuration}
                onChange={(e) => setSimDuration(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="simTranscript">Transcript</Label>
            <Textarea
              id="simTranscript"
              rows={4}
              placeholder="The copier is down and not working, we have no power to it. Call me back at 555-867-5309."
              value={simTranscript}
              onChange={(e) => setSimTranscript(e.target.value)}
            />
          </div>
          <Button
            className="min-h-[48px]"
            onClick={() => simulate.mutate()}
            disabled={simulate.isPending}
          >
            {simulate.isPending ? 'Running…' : 'Run intake'}
          </Button>

          {simResult ? (
            <div className="rounded-md border p-3 text-sm space-y-1">
              {simResult.handled ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Handled</span>
                    <PriorityPill p={simResult.priority} />
                    {simResult.escalated ? (
                      <Badge className="bg-red-600 text-white">
                        <AlertTriangle className="h-3 w-3 mr-1" /> On-call paged
                      </Badge>
                    ) : null}
                  </div>
                  <div>
                    Ticket:{' '}
                    {simResult.ticketId ? (
                      <span className="font-mono">{simResult.ticketId}</span>
                    ) : (
                      <span className="text-muted-foreground">not created</span>
                    )}
                  </div>
                  {simResult.note ? <div className="text-amber-600">{simResult.note}</div> : null}
                </>
              ) : (
                <div className="text-muted-foreground">Not handled — {simResult.reason}</div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Call log */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="h-5 w-5" /> Call log
              </CardTitle>
              <CardDescription>Most recent 200 calls.</CardDescription>
            </div>
            <div className="flex gap-1">
              {(['all', 'P1', 'P2', 'P3'] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={priorityFilter === p ? 'default' : 'outline'}
                  className="min-h-[48px]"
                  onClick={() => setPriorityFilter(p)}
                >
                  {p === 'all' ? 'All' : p}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {callsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading calls…</p>
          ) : callsQuery.isError ? (
            <p className="text-sm text-red-600">Failed to load calls.</p>
          ) : calls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Escalated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{c.companyName || c.fromNumber || 'Unknown'}</TableCell>
                    <TableCell>
                      <PriorityPill p={c.priority} />
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {c.detectedIssue || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.ticketId ? c.ticketId.slice(0, 8) : '—'}
                    </TableCell>
                    <TableCell>
                      {c.escalated ? (
                        <Badge className="bg-red-600 text-white">Paged</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Call detail dialog */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={selected != null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Call detail <PriorityPill p={selected?.priority} />
            </DialogTitle>
            <DialogDescription>
              {selected?.companyName || selected?.fromNumber || 'Unknown caller'} ·{' '}
              {selected ? new Date(selected.createdAt).toLocaleString() : ''}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted-foreground">Callback number</div>
                  <div>{selected.callbackNumber || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Machine</div>
                  <div>{selected.machineRef || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Language</div>
                  <div>{selected.language || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Duration</div>
                  <div>{selected.durationSeconds}s</div>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Detected issue</div>
                <div>{selected.detectedIssue || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Transcript</div>
                <div className="whitespace-pre-wrap rounded bg-muted p-2 max-h-48 overflow-auto">
                  {selected.transcript || '—'}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="font-medium mb-1">Cost breakdown</div>
                <div className="text-muted-foreground">
                  Twilio {money(selected.twilioCost)} · AI {money(selected.aiCost)} · Total{' '}
                  <span className="font-medium">{money(selected.totalCost)}</span>
                </div>
              </div>
              {selected.ticketId ? (
                <div>
                  Ticket: <span className="font-mono">{selected.ticketId}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
