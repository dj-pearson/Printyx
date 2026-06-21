/**
 * Daily Role-Based Morning Briefings (US-SUPER-015).
 *
 * Per-user morning briefing console: generate your own briefing, read the latest
 * rendered briefing (subject + bullets), browse history with open status,
 * tune delivery preferences (frequency, A/B variant, email/in-app channels),
 * and see the A/B open-rate stats. Viewing the latest briefing fires the
 * open-tracking endpoint once (the success metric).
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { CheckCircle2, Circle, Mail, Play, RefreshCw, Sparkles, Sun } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface BriefingMetric {
  label: string;
  value: number | string;
  detail?: string;
}
interface BriefingSection {
  heading: string;
  metrics: BriefingMetric[];
}
interface BriefingContent {
  role: string;
  variant: string;
  sections: BriefingSection[];
  bullets: string[];
  links?: { label: string; url: string }[];
  wordCount?: number;
  source?: string;
}
interface BriefingLog {
  id: string;
  role: string;
  briefingDate: string;
  variant: string;
  subject: string | null;
  emailSent: boolean;
  inAppSent: boolean;
  content: BriefingContent | null;
  sentAt: string;
  openedAt: string | null;
}
interface ListResponse {
  data: BriefingLog[];
  total: number;
}
interface Preferences {
  id: string;
  frequency: string;
  abVariant: string;
  role: string | null;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  lastSentAt: string | null;
}
interface StatsResponse {
  byVariant: { variant: string; sent: number; opened: number; openRate: number }[];
  overall: { sent: number; opened: number; openRate: number };
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  service_manager: 'Service Manager',
  sales_rep: 'Sales Rep',
};

export default function DailyBriefings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const openedRef = useRef<string | null>(null);

  const {
    data: list,
    isLoading,
    isError,
    error,
  } = useQuery<ListResponse>({ queryKey: ['/api/daily-briefing'] });
  const { data: prefs } = useQuery<Preferences>({
    queryKey: ['/api/daily-briefing/preferences'],
  });
  const { data: stats } = useQuery<StatsResponse>({ queryKey: ['/api/daily-briefing/stats'] });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/daily-briefing'] });
    queryClient.invalidateQueries({ queryKey: ['/api/daily-briefing/stats'] });
  };

  const generateMutation = useMutation({
    mutationFn: () => apiRequest('/api/daily-briefing/generate', { method: 'POST', body: {} }),
    onSuccess: (data: any) => {
      toast({
        title: 'Briefing generated',
        description: `${data?.generated ?? 0} briefing(s) created (${data?.emailed ?? 0} emailed, ${
          data?.inApp ?? 0
        } in-app).`,
      });
      openedRef.current = null;
      invalidateAll();
    },
    onError: (err: any) =>
      toast({
        title: 'Generation failed',
        description: err?.message || 'Failed to generate',
        variant: 'destructive',
      }),
  });

  const prefsMutation = useMutation({
    mutationFn: (body: Partial<Preferences>) =>
      apiRequest('/api/daily-briefing/preferences', { method: 'PUT', body }),
    onSuccess: () => {
      toast({ title: 'Preferences updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/daily-briefing/preferences'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Update failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const openMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/daily-briefing/${id}/open`, { method: 'POST', body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/daily-briefing/stats'] }),
  });

  const briefings = list?.data ?? [];
  const latest = briefings[0] ?? null;

  // Fire open tracking once when the latest briefing is shown and not yet opened.
  useEffect(() => {
    if (!latest) return;
    if (latest.openedAt) return;
    if (openedRef.current === latest.id) return;
    openedRef.current = latest.id;
    openMutation.mutate(latest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id]);

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sun className="h-6 w-6 text-amber-500" />
            Morning Briefings
          </h1>
          <p className="text-sm text-muted-foreground">
            Your role-based daily briefing, assembled from live Printyx data.
          </p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="min-h-[48px]"
        >
          {generateMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Generate mine
        </Button>
      </div>

      {/* Latest briefing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Latest briefing
          </CardTitle>
          {latest && (
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>{latest.briefingDate}</span>
              <Badge variant="outline">{ROLE_LABELS[latest.role] || latest.role}</Badge>
              <Badge variant="secondary" className="capitalize">
                {latest.variant}
              </Badge>
              {latest.content?.source && (
                <Badge variant="outline" className="capitalize">
                  {latest.content.source}
                </Badge>
              )}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : isError ? (
            <p className="text-sm text-destructive py-8 text-center">
              Failed to load: {(error as any)?.message || 'Unknown error'}
            </p>
          ) : !latest ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No briefings yet. Click "Generate mine" to create today's briefing.
            </p>
          ) : (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">{latest.subject}</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {(latest.content?.bullets ?? []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              {latest.content?.wordCount != null && (
                <p className="text-xs text-muted-foreground">
                  {latest.content.wordCount} words · {latest.emailSent ? 'emailed' : 'not emailed'}{' '}
                  · {latest.inAppSent ? 'in-app sent' : 'no in-app'}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferences + A/B stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preferences</CardTitle>
            <CardDescription>Cadence, A/B variant, and delivery channels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!prefs ? (
              <p className="text-sm text-muted-foreground">Loading preferences…</p>
            ) : (
              <>
                <label className="block space-y-1">
                  <span className="text-sm font-medium">Frequency</span>
                  <Select
                    value={prefs.frequency}
                    onValueChange={(v) => prefsMutation.mutate({ frequency: v })}
                  >
                    <SelectTrigger className="min-h-[48px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="off">Off</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="block space-y-1">
                  <span className="text-sm font-medium">A/B variant</span>
                  <Select
                    value={prefs.abVariant}
                    onValueChange={(v) => prefsMutation.mutate({ abVariant: v })}
                  >
                    <SelectTrigger className="min-h-[48px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numbers">Numbers-led</SelectItem>
                      <SelectItem value="narrative">Narrative-led</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <div className="flex items-center justify-between min-h-[48px]">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email delivery
                  </span>
                  <Switch
                    checked={prefs.emailEnabled}
                    onCheckedChange={(checked) => prefsMutation.mutate({ emailEnabled: checked })}
                    aria-label="Toggle email delivery"
                  />
                </div>

                <div className="flex items-center justify-between min-h-[48px]">
                  <span className="text-sm font-medium">In-app badge</span>
                  <Switch
                    checked={prefs.inAppEnabled}
                    onCheckedChange={(checked) => prefsMutation.mutate({ inAppEnabled: checked })}
                    aria-label="Toggle in-app badge"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">A/B open rate</CardTitle>
            <CardDescription>Subject-line + open rate is the success metric.</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <p className="text-sm text-muted-foreground">Loading stats…</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {stats.byVariant.length === 0 ? (
                    <p className="text-sm text-muted-foreground col-span-2">
                      No briefings sent yet.
                    </p>
                  ) : (
                    stats.byVariant.map((v) => (
                      <div key={v.variant} className="rounded-md border p-3">
                        <div className="text-xs uppercase text-muted-foreground capitalize">
                          {v.variant}
                        </div>
                        <div className="text-2xl font-bold">{v.openRate}%</div>
                        <div className="text-xs text-muted-foreground">
                          {v.opened}/{v.sent} opened
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="rounded-md border p-3 bg-muted/40">
                  <div className="text-xs uppercase text-muted-foreground">Overall</div>
                  <div className="text-2xl font-bold">{stats.overall.openRate}%</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.overall.opened}/{stats.overall.sent} opened
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
          <CardDescription>Your last 30 briefings.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : briefings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No history yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-center">Opened</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {briefings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap">{b.briefingDate}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{b.subject || '—'}</TableCell>
                      <TableCell className="capitalize">{b.variant}</TableCell>
                      <TableCell className="text-center">
                        {b.openedAt ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground inline" />
                        )}
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
  );
}
