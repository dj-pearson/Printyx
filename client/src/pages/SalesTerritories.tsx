/**
 * Territory management (COP-B09).
 *
 * REBUILT, not resurrected. COP-E01's salvage note is explicit: the deleted
 * 700-line TerritoryManagement.tsx was phantom-wired and could never have
 * worked - it called /api/territories, /api/territories/stats and
 * /api/territories/types, none of which exist, and used the object-options form
 * of apiRequest, which this codebase's signature does not accept, so every
 * mutation was broken too. Only its shape was worth keeping. This is written
 * against /api/sales-territories, which the edge function has served all along.
 *
 * THE COVERAGE PANEL IS THE POINT, not a footnote. Accounts carry a free-text
 * territory and territories are matched to it by name or code, so a model can
 * look complete while covering half the book. Coverage separates the two
 * failures because they have different fixes: an account naming a territory
 * nobody defined needs a definition, and an account naming nothing needs data
 * entry.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Info, Map as MapIcon, Plus } from 'lucide-react';

const TERRITORY_TYPES = [
  'geographic',
  'industry',
  'account_size',
  'product_line',
  'named_accounts',
] as const;

interface Territory {
  id: string;
  territoryName?: string | null;
  territory_name?: string | null;
  territoryCode?: string | null;
  territory_code?: string | null;
  territoryType?: string | null;
  territory_type?: string | null;
  description?: string | null;
  isActive?: boolean | null;
  is_active?: boolean | null;
}

interface Coverage {
  resolved: number;
  unassigned: number;
  total: number;
  territoriesDefined: number;
  unmatched: Array<{ key: string; name: string; count: number }>;
  unbacked: string[];
}

/** The edge function returns raw rows, so both spellings are read. */
const name = (t: Territory) => t.territoryName ?? t.territory_name ?? 'Unnamed territory';
const code = (t: Territory) => t.territoryCode ?? t.territory_code ?? null;
const type = (t: Territory) => t.territoryType ?? t.territory_type ?? null;
const active = (t: Territory) => (t.isActive ?? t.is_active) !== false;

const EMPTY = {
  id: '',
  territoryName: '',
  territoryCode: '',
  territoryType: 'geographic',
  description: '',
};

export default function SalesTerritories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);

  const listQuery = useQuery<Territory[] | { data: Territory[] }>({
    queryKey: ['/api/sales-territories'],
    queryFn: () => apiRequest('/api/sales-territories'),
  });
  const coverageQuery = useQuery<Coverage>({
    queryKey: ['/api/sales-territories/coverage'],
    queryFn: () => apiRequest('/api/sales-territories/coverage'),
  });

  const territories: Territory[] = Array.isArray(listQuery.data)
    ? listQuery.data
    : (listQuery.data?.data ?? []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/sales-territories'] });
    queryClient.invalidateQueries({ queryKey: ['/api/sales-territories/coverage'] });
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        territoryName: form.territoryName,
        territoryCode: form.territoryCode || null,
        territoryType: form.territoryType,
        description: form.description || null,
      };
      return form.id
        ? apiRequest(`/api/sales-territories/${form.id}`, 'PUT', body)
        : apiRequest('/api/sales-territories', 'POST', body);
    },
    onSuccess: () => {
      toast({ title: form.id ? 'Territory updated' : 'Territory created' });
      setOpen(false);
      setForm(EMPTY);
      invalidate();
    },
    onError: (err: unknown) =>
      toast({
        title: 'Could not save the territory',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const openNew = (prefill = '') => {
    setForm({ ...EMPTY, territoryName: prefill });
    setOpen(true);
  };

  const openEdit = (t: Territory) => {
    setForm({
      id: t.id,
      territoryName: name(t),
      territoryCode: code(t) ?? '',
      territoryType: type(t) ?? 'geographic',
      description: t.description ?? '',
    });
    setOpen(true);
  };

  const coverage = coverageQuery.data;

  return (
    <MainLayout
      title="Territories"
      description="Territories scope the pipeline, the forecast and the opportunity radar."
    >
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <MapIcon className="h-4 w-4" /> Territories
            </CardTitle>
            <Button size="sm" onClick={() => openNew()}>
              <Plus className="h-4 w-4 mr-1" /> New territory
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {listQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : territories.length === 0 ? (
              <EmptyState
                title="No territories defined"
                description="Accounts already carry a territory name from the import. Define one with a matching name or code and every account naming it resolves immediately — nothing rewrites the account."
              />
            ) : (
              territories.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 border rounded-lg p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{name(t)}</span>
                      {code(t) && (
                        <Badge variant="outline" className="text-xs font-normal">
                          {code(t)}
                        </Badge>
                      )}
                      {type(t) && (
                        <span className="text-xs text-muted-foreground">
                          {String(type(t)).replace(/_/g, ' ')}
                        </span>
                      )}
                      {!active(t) && (
                        <Badge variant="outline" className="text-xs font-normal">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                    Edit
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── Coverage ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            {coverageQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !coverage ? null : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">{coverage.resolved}</p>
                    <p className="text-xs text-muted-foreground">
                      accounts resolve to a defined territory
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {coverage.unmatched.reduce((n, u) => n + u.count, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      name a territory nobody has defined
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">{coverage.unassigned}</p>
                    <p className="text-xs text-muted-foreground">carry no territory at all</p>
                  </div>
                </div>

                {coverage.unmatched.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Named on accounts, not defined here
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {coverage.unmatched.map((u) => (
                        <Badge
                          key={u.key}
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => openNew(u.name)}
                        >
                          {u.name} ({u.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {coverage.unbacked.map((note, i) => (
                  <p
                    key={i}
                    className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3 mt-3"
                  >
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{note}</span>
                  </p>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit territory' : 'New territory'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="t-name">Name</Label>
              <Input
                id="t-name"
                value={form.territoryName}
                onChange={(e) => setForm({ ...form, territoryName: e.target.value })}
                placeholder="North Region"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Accounts whose territory text matches this name resolve here. Case, spacing and
                punctuation already match on their own.
              </p>
            </div>
            <div>
              <Label htmlFor="t-code">Code</Label>
              <Input
                id="t-code"
                value={form.territoryCode}
                onChange={(e) => setForm({ ...form, territoryCode: e.target.value })}
                placeholder="NR"
              />
            </div>
            <div>
              <Label htmlFor="t-type">Type</Label>
              <Select
                value={form.territoryType}
                onValueChange={(v) => setForm({ ...form, territoryType: v })}
              >
                <SelectTrigger id="t-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERRITORY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-description">Description</Label>
              <Textarea
                id="t-description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={!form.territoryName.trim() || save.isPending}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
