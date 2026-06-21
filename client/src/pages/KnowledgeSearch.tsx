/**
 * Tech Knowledge Search (US-SUPER-006).
 *
 * RAG over historical service tickets for field techs on phones. A tech searches
 * a symptom + machine model + error code (e.g. "fuser error" / "iR-ADV C5560" /
 * "E-225") and gets the top historical fixes, each as a card showing the
 * resolution summary, the parts that were swapped, and two model-level proxies:
 * how often this kind of fix resolved the issue and the average resolution time.
 *
 * Mobile-first: prominent search bar, results as cards (not a wide table),
 * 48px touch targets. A small admin strip exposes the embedding backfill, an
 * index-coverage stat, and the v2 federated-pool opt-in toggle.
 *
 * The mean-resolution-time and fix-success-rate are TENANT/MODEL-LEVEL PROXIES
 * (see the route docstring), surfaced as guidance, not guarantees.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { BrainCircuit, CheckCircle2, Clock, Database, Search, Wrench } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface KnowledgeResult {
  ticketId: string;
  ticketNumber: string | null;
  machineModel: string | null;
  relevanceScore: number; // 0..1
  summary: string;
  partsSwapped: string[];
  meanResolutionTimeHours: number | null;
  fixSuccessRate: number | null; // 0..1
}

interface SearchResponse {
  results: KnowledgeResult[];
  total: number;
  embeddingSource: 'openai' | 'fallback';
}

interface StatsResponse {
  embeddedCount: number;
  lastEmbeddedAt: string | null;
  totalClosedTickets: number;
}

interface SettingsResponse {
  tenantId: string;
  federatedOptIn: boolean;
  consentedAt: string | null;
  consentedByUserId: string | null;
  updatedAt: string | null;
}

function pct(n: number | null | undefined): string {
  return n == null ? '—' : `${Math.round(n * 100)}%`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KnowledgeSearch() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [machineModel, setMachineModel] = useState('');
  const [errorCode, setErrorCode] = useState('');

  const search = useMutation<SearchResponse>({
    mutationFn: () =>
      apiRequest('/api/service/knowledge-search', {
        method: 'POST',
        body: {
          query: query.trim(),
          machine_model: machineModel.trim() || undefined,
          error_code: errorCode.trim() || undefined,
          limit: 10,
        },
      }) as Promise<SearchResponse>,
    onError: (err: any) =>
      toast({
        title: 'Search failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const canSearch = query.trim().length > 0;
  const onSubmit = () => {
    if (!canSearch) return;
    search.mutate();
  };

  const data = search.data;
  const results = data?.results ?? [];

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-indigo-500" />
          Tech Knowledge Search
        </h1>
        <p className="text-sm text-muted-foreground">
          Search historical fixes by symptom, machine model, and error code. Results are ranked from
          your closed service tickets.
        </p>
      </div>

      {/* Search bar */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <label className="space-y-1 block">
            <span className="text-sm font-medium">What&apos;s the problem?</span>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
              placeholder="e.g. fuser error, streaking, won't pick up paper"
              className="min-h-[48px] text-base"
              autoFocus
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 block">
              <span className="text-sm font-medium">Machine model (optional)</span>
              <Input
                value={machineModel}
                onChange={(e) => setMachineModel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                placeholder="e.g. iR-ADV C5560"
                className="min-h-[48px]"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-sm font-medium">Error code (optional)</span>
              <Input
                value={errorCode}
                onChange={(e) => setErrorCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                placeholder="e.g. E-225"
                className="min-h-[48px]"
              />
            </label>
          </div>
          <Button
            onClick={onSubmit}
            disabled={!canSearch || search.isPending}
            className="min-h-[48px] w-full sm:w-auto"
          >
            <Search className="h-4 w-4 mr-2" />
            {search.isPending ? 'Searching…' : 'Search fixes'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {search.isPending ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Searching the knowledge graph…
        </p>
      ) : search.isError ? (
        <p className="text-sm text-destructive py-8 text-center">
          {(search.error as any)?.message || 'Search failed'}
        </p>
      ) : data && results.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No matching fixes found. Try fewer or different terms, or run a backfill below if this
            tenant has few indexed tickets.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {results.length} result{results.length === 1 ? '' : 's'}
              <Badge variant={data.embeddingSource === 'openai' ? 'secondary' : 'outline'}>
                {data.embeddingSource === 'openai' ? 'AI embeddings' : 'offline embeddings'}
              </Badge>
            </div>
          )}
          {results.map((r) => (
            <ResultCard key={r.ticketId} result={r} />
          ))}
        </div>
      )}

      {/* Admin strip */}
      <AdminStrip />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

function ResultCard({ result }: { result: KnowledgeResult }) {
  const relevance = Math.round(result.relevanceScore * 100);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {result.ticketNumber ? `Ticket ${result.ticketNumber}` : 'Historical fix'}
            </CardTitle>
            <CardDescription>{result.machineModel || 'Unknown model'}</CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">relevance</div>
            <div className="text-sm font-semibold">{relevance}%</div>
          </div>
        </div>
        {/* Relevance bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1">
          <div
            className="h-full bg-indigo-500"
            style={{ width: `${Math.max(2, Math.min(100, relevance))}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{result.summary || 'No resolution notes recorded.'}</p>

        {result.partsSwapped.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Wrench className="h-3.5 w-3.5" /> Parts swapped
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.partsSwapped.map((p, i) => (
                <Badge key={`${p}-${i}`} variant="outline">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div className="rounded-md border bg-emerald-50 border-emerald-200 p-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="text-sm text-emerald-900">
              <span className="font-semibold">{pct(result.fixSuccessRate)}</span> of fixes worked on
              this model
            </div>
          </div>
          <div className="rounded-md border bg-sky-50 border-sky-200 p-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-sky-600 shrink-0" />
            <div className="text-sm text-sky-900">
              avg resolution{' '}
              <span className="font-semibold">
                {result.meanResolutionTimeHours == null
                  ? '—'
                  : `${result.meanResolutionTimeHours}h`}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Admin strip — backfill, coverage stat, federation opt-in
// ---------------------------------------------------------------------------

function AdminStrip() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery<StatsResponse>({ queryKey: ['/api/service/knowledge-search/stats'] });

  const { data: settings, isLoading: settingsLoading } = useQuery<SettingsResponse>({
    queryKey: ['/api/service/knowledge-search/settings'],
  });

  const backfill = useMutation({
    mutationFn: () =>
      apiRequest('/api/service/knowledge-search/backfill', { method: 'POST', body: {} }),
    onSuccess: (data: any) => {
      toast({
        title: 'Backfill complete',
        description: `${data?.embedded ?? 0} embedded, ${data?.skipped ?? 0} skipped, ${
          data?.scanned ?? 0
        } scanned.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service/knowledge-search/stats'] });
    },
    onError: (err: any) =>
      toast({
        title: 'Backfill failed',
        description: err?.message || 'Failed',
        variant: 'destructive',
      }),
  });

  const toggleFederation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest('/api/service/knowledge-search/settings', {
        method: 'PUT',
        body: { federatedOptIn: enabled },
      }),
    onSuccess: () => {
      toast({ title: 'Federation setting saved' });
      queryClient.invalidateQueries({ queryKey: ['/api/service/knowledge-search/settings'] });
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
        <CardTitle className="text-lg flex items-center gap-2">
          <Database className="h-5 w-5" />
          Knowledge index
        </CardTitle>
        <CardDescription>
          Embed closed tickets so they show up in search. Re-run after large data imports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {statsLoading ? (
              'Loading index stats…'
            ) : statsError || !stats ? (
              <span className="text-destructive">Failed to load index stats.</span>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {stats.embeddedCount.toLocaleString()}
                </span>{' '}
                tickets indexed of {stats.totalClosedTickets.toLocaleString()} closed
                {stats.lastEmbeddedAt && (
                  <span className="block text-xs">
                    last indexed {new Date(stats.lastEmbeddedAt).toLocaleString()}
                  </span>
                )}
              </>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => backfill.mutate()}
            disabled={backfill.isPending}
            className="min-h-[48px]"
          >
            {backfill.isPending ? 'Embedding…' : 'Backfill embeddings'}
          </Button>
        </div>

        <div className="rounded-md border p-3 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">Federated knowledge pool</div>
            <p className="text-xs text-muted-foreground">
              v2 cross-tenant feature. Sharing fixes across dealers requires PII redaction (customer
              name/address/contact) and this explicit opt-in. v1 keeps your data single-tenant.
            </p>
          </div>
          <Switch
            checked={settings?.federatedOptIn ?? false}
            disabled={settingsLoading || toggleFederation.isPending}
            onCheckedChange={(v) => toggleFederation.mutate(v)}
            aria-label="Federated knowledge pool opt-in"
          />
        </div>
      </CardContent>
    </Card>
  );
}
