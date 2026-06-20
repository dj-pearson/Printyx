/**
 * Customer Risk (US-SUPER-009).
 *
 * OWNER-oriented churn-risk console. Lists at-risk customers sorted by contract
 * value × score with reason chips, a per-customer 52-week sparkline, a
 * "create save plan" action (drafted outreach + retention offer), the Monday
 * digest preview, and the per-tenant settings panel (weights / thresholds /
 * digest toggle).
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Mail, Play, RefreshCw, ShieldCheck, TrendingDown } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SignalContribution {
  value: number;
  weight: number;
  detail?: string;
}

interface ChurnSignals {
  ticket_delta: SignalContribution;
  ar_past_due: SignalContribution;
  meter_trend: SignalContribution;
  renewal_proximity: SignalContribution;
  reasons: string[];
}

interface ChurnScore {
  id: string;
  customerId: string;
  companyName: string | null;
  score: number;
  band: 'healthy' | 'watch' | 'at_risk';
  signals: ChurnSignals | null;
  contractValue: number;
  calculatedAt: string | null;
  priorityScore: number;
  reasons: string[];
}

interface Settings {
  tenantId: string;
  weights: Record<string, number> | null;
  watchThreshold: number;
  atRiskThreshold: number;
  digestEnabled: boolean;
  updatedAt: string;
}

interface HistoryPoint {
  score: number;
  band: string;
  calculatedAt: string | null;
}

interface SavePlan {
  customerId: string;
  companyName: string | null;
  band: string | null;
  score: number | null;
  subject: string;
  body: string;
  retentionOffer: string;
}

interface DigestItem {
  customerId: string;
  companyName: string | null;
  score: number;
  band: string;
  contractValue: number;
  weekOverWeekDelta: number | null;
  reasons: string[];
}

interface Digest {
  title: string;
  generatedAt: string;
  digestEnabled: boolean;
  atRiskCount: number;
  topAtRisk: DigestItem[];
}

const BAND_OPTIONS = ['all', 'at_risk', 'watch', 'healthy'];

const WEIGHT_KEYS = ['ticket_delta', 'ar_past_due', 'meter_trend', 'renewal_proximity'] as const;
const WEIGHT_LABELS: Record<(typeof WEIGHT_KEYS)[number], string> = {
  ticket_delta: 'Ticket trend',
  ar_past_due: 'Past-due AR',
  meter_trend: 'Meter trend',
  renewal_proximity: 'Renewal proximity',
};

function money(n: number | null | undefined): string {
  return `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function bandVariant(band: string): 'default' | 'secondary' | 'destructive' {
  if (band === 'at_risk') return 'destructive';
  if (band === 'watch') return 'default';
  return 'secondary';
}

/** Tiny inline SVG sparkline (no chart dependency). */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <span className="text-xs text-muted-foreground">Not enough history</span>;
  }
  const w = 160;
  const h = 40;
  const max = 100;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => `${i * step},${h - (p / max) * h}`).join(' ');
  return (
    <svg
      width={w}
      height={h}
      className="overflow-visible"
      role="img"
      aria-label="52-week score trend"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        points={coords}
        className="text-amber-500"
      />
    </svg>
  );
}

function HistorySparkline({ customerId }: { customerId: string }) {
  const { data, isLoading } = useQuery<{ customerId: string; history: HistoryPoint[] }>({
    queryKey: [`/api/churn-risk/scores/${customerId}/history`],
  });
  if (isLoading) return <span className="text-xs text-muted-foreground">Loading…</span>;
  const points = (data?.history ?? []).map((p) => p.score);
  return <Sparkline points={points} />;
}

export default function CustomerRisk() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bandFilter, setBandFilter] = useState<string>('at_risk');
  const [planCustomer, setPlanCustomer] = useState<SavePlan | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);

  const scoresKey =
    bandFilter === 'all' ? '/api/churn-risk/scores' : `/api/churn-risk/scores?band=${bandFilter}`;

  const {
    data: scoresData,
    isLoading: loadingScores,
    isError: scoresError,
    error: scoresErrorObj,
  } = useQuery<{ data: ChurnScore[]; total: number }>({
    queryKey: [scoresKey],
  });

  const { data: settings, isLoading: loadingSettings } = useQuery<Settings>({
    queryKey: ['/api/churn-risk/settings'],
  });

  const invalidateScores = () => queryClient.invalidateQueries({ queryKey: [scoresKey] });

  const scoreMutation = useMutation({
    mutationFn: () => apiRequest('/api/churn-risk/score', { method: 'POST' }),
    onSuccess: (data: any) => {
      toast({
        title: 'Scoring complete',
        description: `Scored ${data?.scored ?? 0} customers.`,
      });
      invalidateScores();
    },
    onError: (err: any) =>
      toast({
        title: 'Scoring failed',
        description: err?.message || 'Failed to run scoring',
        variant: 'destructive',
      }),
  });

  const savePlanMutation = useMutation({
    mutationFn: (customerId: string) =>
      apiRequest('/api/churn-risk/save-plan', { method: 'POST', body: { customerId } }),
    onSuccess: (data: SavePlan) => setPlanCustomer(data),
    onError: (err: any) =>
      toast({
        title: 'Save plan failed',
        description: err?.message || 'Failed to draft plan',
        variant: 'destructive',
      }),
  });

  const digestMutation = useMutation({
    mutationFn: () => apiRequest('/api/churn-risk/digest/preview', { method: 'POST' }),
    onSuccess: (data: Digest) => setDigest(data),
    onError: (err: any) =>
      toast({
        title: 'Digest failed',
        description: err?.message || 'Failed to assemble digest',
        variant: 'destructive',
      }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (body: Partial<Settings> & { weights?: Record<string, number> }) =>
      apiRequest('/api/churn-risk/settings', { method: 'PUT', body }),
    onSuccess: () => {
      toast({ title: 'Settings updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/churn-risk/settings'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Settings update failed',
        description: err?.message || 'Failed to update settings',
        variant: 'destructive',
      }),
  });

  const scores = scoresData?.data ?? [];

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-amber-500" />
            Customer Churn Risk
          </h1>
          <p className="text-sm text-muted-foreground">
            Weekly churn-risk scoring, sorted by contract value × score.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => digestMutation.mutate()}
            disabled={digestMutation.isPending}
            className="min-h-[48px]"
          >
            <Mail className="h-4 w-4 mr-2" />
            Monday digest
          </Button>
          <Button
            onClick={() => scoreMutation.mutate()}
            disabled={scoreMutation.isPending}
            className="min-h-[48px]"
          >
            {scoreMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run scoring
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scoring settings</CardTitle>
          <CardDescription>
            Per-tenant signal weights, band thresholds, and digest toggle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSettings ? (
            <p className="text-sm text-muted-foreground">Loading settings…</p>
          ) : settings ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {WEIGHT_KEYS.map((key) => {
                  const val = settings.weights?.[key] ?? 0;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">{WEIGHT_LABELS[key]}</span>
                        <span className="text-muted-foreground">{val.toFixed(2)}</span>
                      </div>
                      <Slider
                        min={0}
                        max={1}
                        step={0.05}
                        value={[val]}
                        onValueCommit={(vals) =>
                          updateSettingsMutation.mutate({ weights: { [key]: vals[0] } })
                        }
                        aria-label={`${WEIGHT_LABELS[key]} weight`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
                <div className="flex-1 max-w-xs">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Watch threshold</span>
                    <span className="text-muted-foreground">{settings.watchThreshold}</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[settings.watchThreshold]}
                    onValueCommit={(vals) =>
                      updateSettingsMutation.mutate({ watchThreshold: vals[0] })
                    }
                    aria-label="Watch threshold"
                  />
                </div>
                <div className="flex-1 max-w-xs">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">At-risk threshold</span>
                    <span className="text-muted-foreground">{settings.atRiskThreshold}</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[settings.atRiskThreshold]}
                    onValueCommit={(vals) =>
                      updateSettingsMutation.mutate({ atRiskThreshold: vals[0] })
                    }
                    aria-label="At-risk threshold"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.digestEnabled}
                    onCheckedChange={(checked) =>
                      updateSettingsMutation.mutate({ digestEnabled: checked })
                    }
                    disabled={updateSettingsMutation.isPending}
                    aria-label="Toggle Monday digest"
                  />
                  <span className="text-sm font-medium">
                    Monday digest {settings.digestEnabled ? 'on' : 'off'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">Failed to load settings.</p>
          )}
        </CardContent>
      </Card>

      {/* Scores list */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">At-risk customers</CardTitle>
            <CardDescription>Sorted by contract value × score (highest first).</CardDescription>
          </div>
          <Select value={bandFilter} onValueChange={setBandFilter}>
            <SelectTrigger className="w-[180px] min-h-[48px]">
              <SelectValue placeholder="Filter band" />
            </SelectTrigger>
            <SelectContent>
              {BAND_OPTIONS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b === 'all'
                    ? 'All bands'
                    : b === 'at_risk'
                      ? 'At risk'
                      : b.charAt(0).toUpperCase() + b.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loadingScores ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading scores…</p>
          ) : scoresError ? (
            <p className="text-sm text-destructive py-8 text-center">
              Failed to load scores: {(scoresErrorObj as any)?.message || 'Unknown error'}
            </p>
          ) : scores.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No scores yet. Run scoring to evaluate your customer base.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Contract value</TableHead>
                    <TableHead>Reasons</TableHead>
                    <TableHead>52-week trend</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.companyName || s.customerId}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={bandVariant(s.band)}>
                          {s.score} · {s.band === 'at_risk' ? 'At risk' : s.band}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{money(s.contractValue)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.reasons.length ? (
                            s.reasons.map((r) => (
                              <Badge key={r} variant="outline" className="text-xs">
                                {r}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">none</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <HistorySparkline customerId={s.customerId} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="min-h-[48px]"
                          disabled={savePlanMutation.isPending}
                          onClick={() => savePlanMutation.mutate(s.customerId)}
                        >
                          <ShieldCheck className="h-4 w-4 mr-1" />
                          Save plan
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save plan dialog */}
      <Dialog open={!!planCustomer} onOpenChange={(open) => !open && setPlanCustomer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Save plan — {planCustomer?.companyName || planCustomer?.customerId}
            </DialogTitle>
            <DialogDescription>
              Drafted outreach + a retention offer based on this customer's risk signals.
            </DialogDescription>
          </DialogHeader>
          {planCustomer && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Suggested retention offer</div>
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  {planCustomer.retentionOffer}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Subject</div>
                <div className="rounded-md border p-2 text-sm">{planCustomer.subject}</div>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Outreach email</div>
                <Textarea
                  readOnly
                  rows={12}
                  value={planCustomer.body}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  className="min-h-[48px]"
                  onClick={() => {
                    navigator.clipboard?.writeText(planCustomer.body);
                    toast({ title: 'Copied', description: 'Outreach email copied to clipboard.' });
                  }}
                >
                  Copy email
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Monday digest dialog */}
      <Dialog open={!!digest} onOpenChange={(open) => !open && setDigest(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {digest?.title}
            </DialogTitle>
            <DialogDescription>
              Top {digest?.atRiskCount ?? 0} at-risk customers with week-over-week deltas.
              {digest && !digest.digestEnabled ? ' (Digest delivery is currently off.)' : ''}
            </DialogDescription>
          </DialogHeader>
          {digest && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>WoW</TableHead>
                    <TableHead className="text-right">Contract value</TableHead>
                    <TableHead>Reasons</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {digest.topAtRisk.map((d) => (
                    <TableRow key={d.customerId}>
                      <TableCell>{d.companyName || d.customerId}</TableCell>
                      <TableCell>{d.score}</TableCell>
                      <TableCell>
                        {d.weekOverWeekDelta == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={
                              d.weekOverWeekDelta > 0 ? 'text-destructive' : 'text-green-600'
                            }
                          >
                            {d.weekOverWeekDelta > 0 ? '+' : ''}
                            {d.weekOverWeekDelta}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{money(d.contractValue)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {d.reasons.map((r) => (
                            <Badge key={r} variant="outline" className="text-xs">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
