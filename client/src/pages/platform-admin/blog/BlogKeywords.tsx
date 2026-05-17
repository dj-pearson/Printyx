import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles, Search as SearchIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Intent = 'informational' | 'commercial' | 'transactional' | 'navigational';

const INTENT_META: Record<Intent, { label: string; chip: string }> = {
  informational: { label: 'Informational', chip: 'bg-sky-100 text-sky-800 border-sky-200' },
  commercial: {
    label: 'Commercial investigation',
    chip: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  transactional: {
    label: 'Transactional',
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  navigational: {
    label: 'Navigational',
    chip: 'bg-violet-100 text-violet-800 border-violet-200',
  },
};

const ALL_INTENTS: Intent[] = ['informational', 'commercial', 'transactional', 'navigational'];

interface KeywordRow {
  id: string;
  keyword: string;
  search_volume: number | null;
  keyword_difficulty: number | null;
  cpc: number | null;
  intent: Intent | null;
  source_type: string | null;
  intent_confidence: number | null;
  intent_reasoning: string | null;
  intent_serp_informed: boolean | null;
}

interface ListResponse {
  keywords: KeywordRow[];
  total: number;
  intent_counts: Record<string, number>;
}

function IntentChip({ intent }: { intent: Intent | null }) {
  if (!intent) {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        unclassified
      </Badge>
    );
  }
  const meta = INTENT_META[intent];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        meta.chip,
      )}
    >
      {meta.label}
    </span>
  );
}

export default function BlogKeywords() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [intentFilter, setIntentFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const queryParams = new URLSearchParams();
  if (intentFilter === 'unclassified') queryParams.set('unclassified', 'true');
  else if (intentFilter !== 'all') queryParams.set('intent', intentFilter);
  if (appliedSearch) queryParams.set('search', appliedSearch);
  queryParams.set('limit', '200');

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ['/api/blog-keywords', intentFilter, appliedSearch],
    queryFn: () => apiRequest(`/api/blog-keywords?${queryParams.toString()}`),
  });

  const counts = data?.intent_counts ?? {};

  const classifyMutation = useMutation({
    mutationFn: (payload: { keyword_ids?: string[]; only_unclassified?: boolean }) =>
      apiRequest('/api/blog-keywords/classify', 'POST', { use_serp: true, ...payload }),
    onSuccess: (resp: { classified: number; skipped: number }) => {
      toast({
        title: 'Classification complete',
        description: `${resp.classified} keyword(s) classified${
          resp.skipped ? `, ${resp.skipped} skipped` : ''
        }.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-keywords'] });
    },
    onError: (err: Error) =>
      toast({ title: 'Classification failed', description: err.message, variant: 'destructive' }),
  });

  const overrideMutation = useMutation({
    mutationFn: ({ id, intent }: { id: string; intent: Intent }) =>
      apiRequest(`/api/blog-keywords/${id}`, 'PATCH', { intent }),
    onSuccess: () => {
      toast({ title: 'Intent updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-keywords'] });
    },
    onError: (err: Error) =>
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  const keywords = data?.keywords ?? [];
  const unclassifiedCount = counts.unclassified ?? 0;

  return (
    <BlogShell title="Keywords — Blog · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4 max-w-7xl">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Keyword intent</h1>
          <p className="text-sm text-muted-foreground">
            Every keyword classified by search intent so you plan the right content format.{' '}
            <Badge variant="secondary" className="text-[10px] align-middle">
              US-BLOG-014
            </Badge>
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filters & classification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Intent</label>
                <Select value={intentFilter} onValueChange={setIntentFilter}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All intents</SelectItem>
                    <SelectItem value="unclassified">Unclassified ({unclassifiedCount})</SelectItem>
                    {ALL_INTENTS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {INTENT_META[i].label} ({counts[i] ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 flex-1 min-w-[220px]">
                <label className="text-xs text-muted-foreground">Search</label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setAppliedSearch(search.trim());
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter keywords…"
                  />
                  <Button type="submit" variant="outline" size="icon">
                    <SearchIcon className="h-4 w-4" />
                  </Button>
                </form>
              </div>

              <Button
                onClick={() => classifyMutation.mutate({ only_unclassified: true })}
                disabled={classifyMutation.isPending || unclassifiedCount === 0}
              >
                {classifyMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Classify unclassified ({unclassifiedCount})
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading keywords…
              </div>
            ) : keywords.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No keywords match. Mine some via PAA or import a keyword list.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Keyword</th>
                      <th className="px-3 py-2 text-left font-medium">Intent</th>
                      <th className="px-3 py-2 text-right font-medium">Confidence</th>
                      <th className="px-3 py-2 text-right font-medium">Volume</th>
                      <th className="px-3 py-2 text-right font-medium">KD</th>
                      <th className="px-3 py-2 text-left font-medium">Override</th>
                      <th className="px-3 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((kw) => (
                      <tr key={kw.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <div className="font-medium">{kw.keyword}</div>
                          {kw.intent_reasoning ? (
                            <div className="text-[11px] text-muted-foreground line-clamp-1">
                              {kw.intent_reasoning}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <IntentChip intent={kw.intent} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {kw.intent_confidence != null
                            ? `${Math.round(kw.intent_confidence * 100)}%`
                            : '—'}
                          {kw.intent_serp_informed ? (
                            <span
                              className="ml-1 text-[10px] text-emerald-600"
                              title="Classified with SERP context"
                            >
                              ●
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {kw.search_volume ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {kw.keyword_difficulty ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={kw.intent ?? ''}
                            onValueChange={(v) =>
                              overrideMutation.mutate({ id: kw.id, intent: v as Intent })
                            }
                          >
                            <SelectTrigger className="h-8 w-44 text-xs">
                              <SelectValue placeholder="Set intent…" />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_INTENTS.map((i) => (
                                <SelectItem key={i} value={i}>
                                  {INTENT_META[i].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={classifyMutation.isPending}
                            onClick={() => classifyMutation.mutate({ keyword_ids: [kw.id] })}
                          >
                            <Sparkles className="mr-1 h-3.5 w-3.5" />
                            Reclassify
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {data ? (
          <p className="text-xs text-muted-foreground">
            Showing {keywords.length} of {data.total} keyword(s).
          </p>
        ) : null}
      </div>
    </BlogShell>
  );
}
