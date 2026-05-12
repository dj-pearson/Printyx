import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Copy, Loader2, Plus, Save, Square, Trophy, X, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Settings {
  own_domain: string | null;
  competitor_domains: string[];
}

interface ScanDomainResult {
  domain: string;
  keywords: number;
  cost_cents: number;
  error?: string;
}

interface ScanResponse {
  domains: ScanDomainResult[];
  total_keywords: number;
  cost_cents: number;
  errors: string[];
}

interface Gap {
  keyword: string;
  own_rank: number | null;
  competitor_ranks: Record<string, number | null>;
  best_competitor_rank: number;
  ranking_competitors: number;
  search_volume: number | null;
  keyword_difficulty: number | null;
  cpc: number | null;
  intent: string | null;
  easy_win_score: number;
}

interface GapsResponse {
  gaps: Gap[];
  total: number;
}

const INTENT_LABELS: Record<string, string> = {
  informational: 'Info',
  commercial: 'Commercial',
  transactional: 'Transactional',
  navigational: 'Nav',
};

export default function BlogCompetitorGap() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Settings state
  const { data: settingsResp } = useQuery<{ settings: Settings }>({
    queryKey: ['/api/blog-competitor-gap/settings'],
    queryFn: () => apiRequest('/api/blog-competitor-gap/settings'),
  });
  const settings = settingsResp?.settings;
  const [ownDomainInput, setOwnDomainInput] = useState('');
  const [competitorsInput, setCompetitorsInput] = useState<string[]>([]);
  const [newCompetitor, setNewCompetitor] = useState('');

  // Sync local state from the loaded settings the first time it arrives.
  // Using a ref-style guard with useMemo so we don't blow away in-progress edits.
  useMemo(() => {
    if (settings && ownDomainInput === '' && competitorsInput.length === 0) {
      setOwnDomainInput(settings.own_domain ?? '');
      setCompetitorsInput(settings.competitor_domains ?? []);
    }
  }, [settings, ownDomainInput, competitorsInput.length]);

  const settingsMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/blog-competitor-gap/settings', 'PATCH', {
        own_domain: ownDomainInput.trim() || null,
        competitor_domains: competitorsInput,
      }),
    onSuccess: () => {
      toast({ title: 'Settings saved' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-competitor-gap/settings'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => apiRequest<ScanResponse>('/api/blog-competitor-gap/scan', 'POST', {}),
    onSuccess: (res) => {
      toast({
        title: 'Scan complete',
        description: `${res.total_keywords} keywords · ${res.cost_cents}¢${res.errors.length ? ` · ${res.errors.length} error(s)` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-competitor-gap/gaps'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Scan failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Filters
  const [intentFilter, setIntentFilter] = useState<
    'all' | 'informational' | 'commercial' | 'transactional' | 'navigational'
  >('all');
  const [minVolume, setMinVolume] = useState(0);
  const [maxDifficulty, setMaxDifficulty] = useState(100);
  const [minCompetitors, setMinCompetitors] = useState(1);

  const gapQueryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (intentFilter !== 'all') sp.set('intent', intentFilter);
    if (minVolume > 0) sp.set('min_volume', String(minVolume));
    if (maxDifficulty < 100) sp.set('max_difficulty', String(maxDifficulty));
    if (minCompetitors > 1) sp.set('min_competitors', String(minCompetitors));
    return sp.toString();
  }, [intentFilter, minVolume, maxDifficulty, minCompetitors]);

  const { data: gapsData, isLoading: gapsLoading } = useQuery<GapsResponse>({
    queryKey: ['/api/blog-competitor-gap/gaps', gapQueryString],
    queryFn: () => apiRequest(`/api/blog-competitor-gap/gaps?${gapQueryString}`),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  const [clusterName, setClusterName] = useState('');

  const toggle = (kw: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });

  const createClusterMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/blog-competitor-gap/create-cluster', 'POST', {
        name: clusterName.trim(),
        keywords: Array.from(selected),
      }),
    onSuccess: () => {
      toast({ title: 'Cluster created' });
      setClusterDialogOpen(false);
      setClusterName('');
      setSelected(new Set());
    },
    onError: (err: unknown) => {
      toast({
        title: 'Create failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const gaps = gapsData?.gaps ?? [];
  const allCompetitorDomains = useMemo(() => {
    const set = new Set<string>();
    for (const g of gaps) for (const d of Object.keys(g.competitor_ranks)) set.add(d);
    return Array.from(set).sort();
  }, [gaps]);

  return (
    <BlogShell title="Competitor gap — Blog · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4 max-w-7xl">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Competitor content gap
          </h1>
          <p className="text-sm text-muted-foreground">
            Find keywords competitors rank for that you don't — sorted by easy-win score.{' '}
            <Badge variant="secondary" className="text-[10px] align-middle">
              US-BLOG-018
            </Badge>
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Domain settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="own-domain">
                Your domain
              </Label>
              <Input
                id="own-domain"
                value={ownDomainInput}
                onChange={(e) => setOwnDomainInput(e.target.value)}
                placeholder="printyx.net"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Competitor domains</Label>
              <div className="flex flex-wrap gap-1.5">
                {competitorsInput.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => setCompetitorsInput((arr) => arr.filter((x) => x !== d))}
                      className="hover:text-destructive"
                      aria-label={`Remove ${d}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  placeholder="competitor.com"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCompetitor.trim()) {
                      e.preventDefault();
                      const next = newCompetitor.trim().toLowerCase();
                      if (!competitorsInput.includes(next)) {
                        setCompetitorsInput((arr) => [...arr, next]);
                      }
                      setNewCompetitor('');
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!newCompetitor.trim()) return;
                    const next = newCompetitor.trim().toLowerCase();
                    if (!competitorsInput.includes(next)) {
                      setCompetitorsInput((arr) => [...arr, next]);
                    }
                    setNewCompetitor('');
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => settingsMutation.mutate()}
                disabled={settingsMutation.isPending}
                size="sm"
              >
                {settingsMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                Save settings
              </Button>
              <Button
                onClick={() => scanMutation.mutate()}
                disabled={
                  !ownDomainInput.trim() || competitorsInput.length === 0 || scanMutation.isPending
                }
                size="sm"
                variant="default"
              >
                {scanMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5 mr-1" />
                )}
                Scan (uses DataForSEO credits)
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Each domain pulls up to 1000 ranked keywords; expect ~5-30¢ per domain at DataForSEO
              list pricing.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-sm">
                Gaps{' '}
                {gapsData ? (
                  <span className="text-muted-foreground font-normal">· {gapsData.total}</span>
                ) : null}
              </CardTitle>
              <div className="flex items-center gap-2">
                {selected.size > 0 ? (
                  <Button
                    size="sm"
                    onClick={() => setClusterDialogOpen(true)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Create cluster ({selected.size})
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const csv = gaps
                      .map(
                        (g) =>
                          `${g.keyword},${g.search_volume ?? ''},${g.keyword_difficulty ?? ''},${g.intent ?? ''},${g.best_competitor_rank},${g.own_rank ?? ''}`,
                      )
                      .join('\n');
                    navigator.clipboard.writeText(
                      'keyword,volume,difficulty,intent,best_competitor_rank,own_rank\n' + csv,
                    );
                    toast({ title: 'Copied CSV' });
                  }}
                  disabled={gaps.length === 0}
                  className="h-7 text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Intent</Label>
                <Select
                  value={intentFilter}
                  onValueChange={(v) => setIntentFilter(v as typeof intentFilter)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="informational">Informational</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="transactional">Transactional</SelectItem>
                    <SelectItem value="navigational">Navigational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Min volume</Label>
                <Input
                  type="number"
                  value={minVolume}
                  onChange={(e) => setMinVolume(Number(e.target.value) || 0)}
                  className="h-8 text-xs"
                  min={0}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Max difficulty</Label>
                <Input
                  type="number"
                  value={maxDifficulty}
                  onChange={(e) => setMaxDifficulty(Number(e.target.value) || 100)}
                  className="h-8 text-xs"
                  min={1}
                  max={100}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Min competitors</Label>
                <Input
                  type="number"
                  value={minCompetitors}
                  onChange={(e) => setMinCompetitors(Number(e.target.value) || 1)}
                  className="h-8 text-xs"
                  min={1}
                />
              </div>
            </div>

            {gapsLoading ? (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : gaps.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {settings?.own_domain && settings.competitor_domains.length > 0
                  ? "No gaps match these filters. Try lowering Min competitors or scanning if you haven't yet."
                  : 'Configure your domain and at least one competitor above, then run a scan.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr className="text-left">
                      <th className="px-2 py-1.5 w-8"></th>
                      <th className="px-2 py-1.5">Keyword</th>
                      <th className="px-2 py-1.5 text-right">Volume</th>
                      <th className="px-2 py-1.5 text-right">Diff</th>
                      <th className="px-2 py-1.5">Intent</th>
                      <th className="px-2 py-1.5 text-right">Comp ↑</th>
                      <th className="px-2 py-1.5 text-right">You</th>
                      {allCompetitorDomains.map((d) => (
                        <th
                          key={d}
                          className="px-2 py-1.5 text-right whitespace-nowrap font-mono text-[10px]"
                        >
                          {d}
                        </th>
                      ))}
                      <th className="px-2 py-1.5 text-right">Easy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.map((g) => {
                      const isSelected = selected.has(g.keyword);
                      return (
                        <tr
                          key={g.keyword}
                          className={cn(
                            'border-t hover:bg-muted/20 cursor-pointer',
                            isSelected && 'bg-primary/5',
                          )}
                          onClick={() => toggle(g.keyword)}
                        >
                          <td className="px-2 py-1.5">
                            {isSelected ? (
                              <CheckSquare className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Square className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-2 py-1.5 max-w-md truncate" title={g.keyword}>
                            {g.keyword}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {g.search_volume?.toLocaleString() ?? '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {g.keyword_difficulty ?? '—'}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {g.intent ? (
                              <span className="px-1 py-0.5 rounded bg-muted text-[10px]">
                                {INTENT_LABELS[g.intent] ?? g.intent}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {g.best_competitor_rank <= 3 ? (
                              <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                                <Trophy className="h-3 w-3" />
                                {g.best_competitor_rank}
                              </span>
                            ) : (
                              g.best_competitor_rank
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {g.own_rank === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              g.own_rank
                            )}
                          </td>
                          {allCompetitorDomains.map((d) => {
                            const r = g.competitor_ranks[d];
                            return (
                              <td
                                key={d}
                                className={cn(
                                  'px-2 py-1.5 text-right tabular-nums',
                                  typeof r === 'number' && r <= 10
                                    ? 'text-foreground'
                                    : 'text-muted-foreground',
                                )}
                              >
                                {typeof r === 'number' ? r : '—'}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {g.easy_win_score > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300 font-medium">
                                <Zap className="h-3 w-3" />
                                {g.easy_win_score}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={clusterDialogOpen} onOpenChange={setClusterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create cluster from {selected.size} keyword(s)</DialogTitle>
            <DialogDescription>
              These keywords are added to a new cluster with source 'gap_analysis'. Existing keyword
              rows get reassigned; new ones inherit volume/difficulty from the competitor data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Cluster name</Label>
            <Input
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              placeholder="Copier-leasing comparisons"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && clusterName.trim()) createClusterMutation.mutate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClusterDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createClusterMutation.mutate()}
              disabled={!clusterName.trim() || createClusterMutation.isPending}
            >
              {createClusterMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Create cluster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BlogShell>
  );
}
