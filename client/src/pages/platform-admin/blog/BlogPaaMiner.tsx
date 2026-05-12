import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Network,
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
import { Checkbox } from '@/components/ui/checkbox';
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

interface MineResponse {
  seed: { id: string; keyword: string };
  mined_paa: number;
  mined_autocomplete: number;
  total_keywords: number;
  dedup_skipped: number;
  cost_cents: number;
  errors: string[];
}

interface KeywordNode {
  id: string;
  keyword: string;
  source_type: string | null;
  parent_keyword_id: string | null;
  parent_question: string | null;
  mining_depth: number | null;
}

interface TreeResponse {
  seed: KeywordNode;
  paa: KeywordNode[];
  autocomplete: KeywordNode[];
  total: number;
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

export default function BlogPaaMiner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [seedInput, setSeedInput] = useState('');
  const [activeSeed, setActiveSeed] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);
  const [locationCode, setLocationCode] = useState(2840);
  const [languageCode, setLanguageCode] = useState('en');
  const [includePaa, setIncludePaa] = useState(true);
  const [includeAutocomplete, setIncludeAutocomplete] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: tree, isLoading: treeLoading } = useQuery<TreeResponse>({
    queryKey: ['/api/blog-paa-miner/tree', activeSeed],
    queryFn: () =>
      apiRequest(`/api/blog-paa-miner/tree?keyword=${encodeURIComponent(activeSeed!)}`),
    enabled: !!activeSeed,
  });

  const mineMutation = useMutation({
    mutationFn: () =>
      apiRequest<MineResponse>('/api/blog-paa-miner/mine', 'POST', {
        keyword: seedInput.trim(),
        depth,
        location_code: locationCode,
        language_code: languageCode,
        include_paa: includePaa,
        include_autocomplete: includeAutocomplete,
      }),
    onSuccess: (res) => {
      toast({
        title: 'Mining complete',
        description: `${res.mined_paa} PAA · ${res.mined_autocomplete} autocomplete · ${res.cost_cents}¢`,
      });
      setActiveSeed(res.seed.keyword);
      queryClient.invalidateQueries({ queryKey: ['/api/blog-paa-miner/tree'] });
    },
    onError: (err: unknown) => {
      toast({
        title: 'Mining failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/blog-paa-miner/clear?keyword=${encodeURIComponent(activeSeed!)}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Run cleared' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-paa-miner/tree'] });
    },
  });

  // Build a parent → children map for tree rendering
  const childrenByParent = useMemo(() => {
    const map = new Map<string, KeywordNode[]>();
    for (const node of tree?.paa ?? []) {
      const pid = node.parent_keyword_id ?? '';
      const arr = map.get(pid) ?? [];
      arr.push(node);
      map.set(pid, arr);
    }
    return map;
  }, [tree?.paa]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: 'Copied' }),
      () => toast({ title: 'Copy failed', variant: 'destructive' }),
    );
  };

  return (
    <BlogShell title="PAA miner — Blog · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4 max-w-6xl">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            People also ask + autocomplete miner
          </h1>
          <p className="text-sm text-muted-foreground">
            Recursive PAA crawl plus A-Z + 0-9 autocomplete expansion. Surfaces every related
            question users actually search.{' '}
            <Badge variant="secondary" className="text-[10px] align-middle">
              US-BLOG-016
            </Badge>
          </p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_180px_140px_auto] gap-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="paa-keyword" className="text-xs">
                  Seed keyword
                </Label>
                <Input
                  id="paa-keyword"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="copier leasing"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && seedInput.trim() && !mineMutation.isPending) {
                      mineMutation.mutate();
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Depth</Label>
                <Select value={String(depth)} onValueChange={(v) => setDepth(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                onClick={() => mineMutation.mutate()}
                disabled={!seedInput.trim() || mineMutation.isPending}
              >
                {mineMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Mine
              </Button>
            </div>
            <div className="flex items-center gap-5 text-xs">
              <label className="inline-flex items-center gap-2">
                <Checkbox checked={includePaa} onCheckedChange={(v) => setIncludePaa(v === true)} />
                Include PAA crawl
              </label>
              <label className="inline-flex items-center gap-2">
                <Checkbox
                  checked={includeAutocomplete}
                  onCheckedChange={(v) => setIncludeAutocomplete(v === true)}
                />
                Include A-Z autocomplete (36 calls)
              </label>
              <span className="text-muted-foreground">
                Depth {depth} = up to {Math.min(20 ** depth, 1000)} PAA nodes at worst case
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Backs off 2s on 429. Each PAA node = 1 SERP call. Autocomplete = 36 calls per seed if
              A-Z+0-9 is enabled.
            </p>
          </CardContent>
        </Card>

        {activeSeed ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm inline-flex items-center gap-1">
                  <Network className="h-3.5 w-3.5" />
                  Tree for "{activeSeed}"
                  {tree ? (
                    <span className="text-muted-foreground font-normal ml-1">
                      · {tree.total} keywords
                    </span>
                  ) : null}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copy((tree?.paa ?? []).map((p) => p.keyword).join('\n'))}
                    disabled={!tree?.paa.length}
                    className="h-7 text-xs"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy all PAA
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => clearMutation.mutate()}
                    disabled={clearMutation.isPending}
                    className="h-7 text-xs text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear run
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {treeLoading ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading tree…
                </div>
              ) : !tree ? null : (
                <>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                      PAA chain ({tree.paa.length})
                    </div>
                    {tree.paa.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No PAA results — either none surfaced for this keyword or PAA crawl was
                        disabled.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {(childrenByParent.get(tree.seed.id) ?? []).map((child) => (
                          <TreeNode
                            key={child.id}
                            node={child}
                            childrenMap={childrenByParent}
                            expanded={expanded}
                            onToggle={(id) =>
                              setExpanded((prev) => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                return next;
                              })
                            }
                            onCopy={copy}
                          />
                        ))}
                      </ul>
                    )}
                  </div>

                  {tree.autocomplete.length > 0 ? (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                        Autocomplete ({tree.autocomplete.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tree.autocomplete.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => copy(a.keyword)}
                            title={`Copy "${a.keyword}"`}
                            className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70 text-[11px] inline-flex items-center gap-1"
                          >
                            {a.keyword}
                            <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <SearchIcon className="h-7 w-7 mx-auto mb-2 opacity-60" />
              Enter a seed keyword above to start mining.
            </CardContent>
          </Card>
        )}
      </div>
    </BlogShell>
  );
}

function TreeNode({
  node,
  childrenMap,
  expanded,
  onToggle,
  onCopy,
}: {
  node: KeywordNode;
  childrenMap: Map<string, KeywordNode[]>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onCopy: (text: string) => void;
}) {
  const children = childrenMap.get(node.id) ?? [];
  const isOpen = expanded.has(node.id);
  const hasChildren = children.length > 0;
  return (
    <li>
      <div
        className={cn('flex items-start gap-1 text-xs py-0.5 group', node.mining_depth ? '' : '')}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            'p-0.5 rounded text-muted-foreground hover:text-foreground',
            !hasChildren && 'invisible',
          )}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
        >
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <span className="flex-1">{node.keyword}</span>
        <span className="text-[10px] text-muted-foreground font-mono">d{node.mining_depth}</span>
        <button
          type="button"
          onClick={() => onCopy(node.keyword)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
          title="Copy question"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
      {hasChildren && isOpen ? (
        <ul className="ml-4 border-l pl-2">
          {children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              childrenMap={childrenMap}
              expanded={expanded}
              onToggle={onToggle}
              onCopy={onCopy}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
