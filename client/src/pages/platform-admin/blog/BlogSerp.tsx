import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  ExternalLink,
  History,
  Loader2,
  Search as SearchIcon,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface OrganicResult {
  rank: number;
  url: string;
  title: string;
  description: string | null;
  domain: string;
  word_count: number | null;
  headings: { h2: string[]; h3: string[] };
  fetch_error: string | null;
}

interface SerpFeatures {
  paa: Array<{ question: string; answer: string | null; url: string | null }>;
  featured_snippet: { url: string; title: string; text: string | null } | null;
  knowledge_panel: { title: string; description: string | null } | null;
  has_video_pack: boolean;
  has_image_pack: boolean;
  has_local_pack: boolean;
}

interface Aggregate {
  total_results: number;
  median_word_count: number | null;
  mean_word_count: number | null;
  common_h2s: Array<{ text: string; count: number }>;
  dominant_content_type: string | null;
}

interface Snapshot {
  id: string;
  keyword: string;
  location_code: number;
  language_code: string;
  organic_results: OrganicResult[];
  serp_features: SerpFeatures | null;
  aggregate: Aggregate | null;
  source_adapter: string;
  cost_cents: number;
  fetched_at: string;
}

interface SnapshotSummary {
  id: string;
  keyword: string;
  location_code: number;
  language_code: string;
  source_adapter: string;
  cost_cents: number;
  fetched_at: string;
  aggregate: Aggregate | null;
}

interface SnapshotsResponse {
  snapshots: SnapshotSummary[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}

const LOCATIONS = [
  { code: 2840, label: 'United States' },
  { code: 2826, label: 'United Kingdom' },
  { code: 2124, label: 'Canada' },
  { code: 2036, label: 'Australia' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
];

type SortKey = 'rank' | 'word_count' | 'domain';

export default function BlogSerp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [locationCode, setLocationCode] = useState(2840);
  const [languageCode, setLanguageCode] = useState('en');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);

  const { data: list, isLoading: listLoading } = useQuery<SnapshotsResponse>({
    queryKey: ['/api/blog-serp', 'list'],
    queryFn: () => apiRequest('/api/blog-serp?limit=50'),
  });

  const { data: activeData } = useQuery<{ snapshot: Snapshot }>({
    queryKey: ['/api/blog-serp/single', activeId],
    queryFn: () => apiRequest(`/api/blog-serp/${activeId}`),
    enabled: !!activeId,
  });

  const fetchMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ snapshot: Snapshot }>('/api/blog-serp/fetch', 'POST', {
        keyword: keyword.trim(),
        location_code: locationCode,
        language_code: languageCode,
      }),
    onSuccess: (res) => {
      toast({
        title: 'SERP fetched',
        description: `${res.snapshot.organic_results.length} organic results · ${res.snapshot.cost_cents}¢`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-serp'] });
      setActiveId(res.snapshot.id);
    },
    onError: (err: unknown) => {
      toast({
        title: 'Fetch failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/blog-serp/${id}`, 'DELETE'),
    onSuccess: (_, id) => {
      toast({ title: 'Snapshot deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-serp'] });
      if (activeId === id) setActiveId(null);
    },
  });

  const snapshots = list?.snapshots ?? [];
  const active = activeData?.snapshot;

  const sortedOrganic = useMemo(() => {
    if (!active) return [];
    const arr = [...active.organic_results];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'rank') cmp = a.rank - b.rank;
      else if (sortKey === 'word_count') cmp = (a.word_count ?? 0) - (b.word_count ?? 0);
      else if (sortKey === 'domain') cmp = a.domain.localeCompare(b.domain);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [active, sortKey, sortAsc]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === 'rank');
    }
  };

  return (
    <BlogShell title="SERP analyzer — Blog · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4 max-w-7xl">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">SERP analyzer</h1>
          <p className="text-sm text-muted-foreground">
            Pull the top organic results for any keyword and see what to match or exceed.{' '}
            <Badge variant="secondary" className="text-[10px] align-middle">
              US-BLOG-015
            </Badge>
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_140px_auto] gap-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="serp-keyword" className="text-xs">
                  Keyword
                </Label>
                <Input
                  id="serp-keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="copier leasing best practices"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && keyword.trim()) fetchMutation.mutate();
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Location</Label>
                <Select
                  value={String(locationCode)}
                  onValueChange={(v) => setLocationCode(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((l) => (
                      <SelectItem key={l.code} value={String(l.code)}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Language</Label>
                <Select value={languageCode} onValueChange={setLanguageCode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => fetchMutation.mutate()}
                disabled={!keyword.trim() || fetchMutation.isPending}
              >
                {fetchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <SearchIcon className="h-4 w-4 mr-2" />
                )}
                Fetch SERP
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Uses your active DataForSEO target. Per-URL word-count parsing has a 3-second timeout;
              bot-blocked sites fall back to snippet length.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <Card className="h-fit max-h-[calc(100vh-260px)] overflow-y-auto">
            <CardHeader className="pb-3 sticky top-0 bg-card z-10 border-b">
              <CardTitle className="text-sm inline-flex items-center gap-1">
                <History className="h-3.5 w-3.5" />
                Recent snapshots {list?.pagination ? `· ${list.pagination.total}` : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {listLoading ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading…
                </div>
              ) : snapshots.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  No snapshots yet. Fetch a keyword above.
                </div>
              ) : (
                <ul className="divide-y">
                  {snapshots.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(s.id)}
                        className={cn(
                          'w-full text-left p-3 hover:bg-muted/50 transition-colors text-xs space-y-0.5',
                          activeId === s.id && 'bg-muted/70',
                        )}
                      >
                        <div className="font-medium truncate">{s.keyword}</div>
                        <div className="text-muted-foreground">
                          {LOCATIONS.find((l) => l.code === s.location_code)?.label ??
                            s.location_code}
                          {' · '}
                          {s.language_code}
                          {' · '}
                          {new Date(s.fetched_at).toLocaleDateString()}
                        </div>
                        {s.aggregate ? (
                          <div className="text-muted-foreground/80">
                            ~{s.aggregate.median_word_count ?? '?'} words median
                            {s.aggregate.dominant_content_type
                              ? ` · ${s.aggregate.dominant_content_type.replace('_', ' ')}`
                              : ''}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4 min-w-0">
            {!active ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Pick a snapshot on the left or fetch a new one.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-base truncate">{active.keyword}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {LOCATIONS.find((l) => l.code === active.location_code)?.label ??
                            active.location_code}
                          {' · '}
                          {active.language_code}
                          {' · fetched '}
                          {new Date(active.fetched_at).toLocaleString()}
                          {' · '}
                          {active.cost_cents}¢
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(active.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <Metric
                        label="Median words"
                        value={active.aggregate?.median_word_count ?? '—'}
                      />
                      <Metric label="Mean words" value={active.aggregate?.mean_word_count ?? '—'} />
                      <Metric
                        label="Dominant type"
                        value={active.aggregate?.dominant_content_type?.replace('_', ' ') ?? '—'}
                      />
                      <Metric label="Results" value={active.aggregate?.total_results ?? '—'} />
                    </div>

                    {active.aggregate?.common_h2s?.length ? (
                      <div className="mt-3">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          Common H2s
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {active.aggregate.common_h2s.map((h) => (
                            <span
                              key={h.text}
                              className="px-1.5 py-0.5 rounded bg-muted text-[11px]"
                              title={`${h.count} pages`}
                            >
                              {h.text} <span className="text-muted-foreground">×{h.count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {active.serp_features ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {active.serp_features.featured_snippet ? (
                          <FeatureChip color="emerald" icon={Sparkles}>
                            Featured snippet
                          </FeatureChip>
                        ) : null}
                        {active.serp_features.paa.length > 0 ? (
                          <FeatureChip color="blue">
                            PAA ({active.serp_features.paa.length})
                          </FeatureChip>
                        ) : null}
                        {active.serp_features.knowledge_panel ? (
                          <FeatureChip color="purple">Knowledge panel</FeatureChip>
                        ) : null}
                        {active.serp_features.has_video_pack ? (
                          <FeatureChip color="amber">Video pack</FeatureChip>
                        ) : null}
                        {active.serp_features.has_image_pack ? (
                          <FeatureChip color="amber">Image pack</FeatureChip>
                        ) : null}
                        {active.serp_features.has_local_pack ? (
                          <FeatureChip color="amber">Local pack</FeatureChip>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {active.serp_features?.paa?.length ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">People also ask</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {active.serp_features.paa.map((p, i) => (
                        <div key={i} className="text-xs space-y-0.5">
                          <div className="font-medium inline-flex items-center gap-1">
                            <ChevronRight className="h-3 w-3" />
                            {p.question}
                          </div>
                          {p.answer ? (
                            <div className="text-muted-foreground pl-4">{p.answer}</div>
                          ) : null}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top organic ({sortedOrganic.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30">
                        <tr className="text-left">
                          <th
                            className="px-3 py-2 cursor-pointer w-12"
                            onClick={() => onSort('rank')}
                          >
                            #
                          </th>
                          <th className="px-3 py-2">Title</th>
                          <th className="px-3 py-2 cursor-pointer" onClick={() => onSort('domain')}>
                            Domain
                          </th>
                          <th
                            className="px-3 py-2 text-right cursor-pointer whitespace-nowrap"
                            onClick={() => onSort('word_count')}
                          >
                            Words
                          </th>
                          <th className="px-3 py-2 text-right">H2 / H3</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedOrganic.map((r) => (
                          <tr key={r.rank} className="border-t align-top hover:bg-muted/20">
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {r.rank}
                            </td>
                            <td className="px-3 py-2 max-w-md">
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium hover:underline inline-flex items-start gap-1"
                              >
                                <span className="line-clamp-2">{r.title}</span>
                                <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                              </a>
                              {r.description ? (
                                <div className="text-muted-foreground line-clamp-2 mt-0.5">
                                  {r.description}
                                </div>
                              ) : null}
                              {r.fetch_error ? (
                                <div className="text-amber-700 dark:text-amber-300 text-[10px] mt-0.5">
                                  fetch: {r.fetch_error}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {r.domain}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {r.word_count ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {r.headings.h2.length} / {r.headings.h3.length}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </BlogShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-2 space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function FeatureChip({
  children,
  color,
  icon: Icon,
}: {
  children: React.ReactNode;
  color: 'emerald' | 'blue' | 'purple' | 'amber';
  icon?: typeof Sparkles;
}) {
  const cls: Record<typeof color, string> = {
    emerald: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
    blue: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
    purple: 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
    amber: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
        cls[color],
      )}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}
