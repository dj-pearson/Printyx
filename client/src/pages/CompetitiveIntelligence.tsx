/**
 * Competitive knockout intelligence (COP-B10).
 *
 * Three tabs over data the dealer was already capturing and never surfacing:
 * battlecards (the vocabulary and the content), win/loss by competitor, and
 * the accounts that left for somebody else.
 *
 * WHAT THIS PAGE REFUSES TO DO. It never prints a win rate below the server's
 * minimum decided-deal count, because a rate over three deals is an anecdote
 * with a percent sign and a rep will repeat it to a customer. Counts are shown
 * either way - counting is something three deals can support.
 *
 * The unmatched list is the point of the admin tab, not a footnote: every
 * spelling there is a competitor the reports are splitting or dropping, and
 * claiming it is one alias away.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineQueryError } from '@/components/ui/inline-query-error';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrencyWhole } from '@/lib/utils';
import { Plus, Swords, Target, TrendingUp } from 'lucide-react';

interface Objection {
  objection: string;
  response: string;
}

interface Battlecard {
  id: string;
  name: string;
  slug: string;
  aliases: string[];
  positioning: string | null;
  commonObjections: Objection[];
  whereWeWin: string | null;
  whereWeLose: string | null;
  isActive: boolean;
}

interface WinLossRow {
  key: string;
  name: string;
  battlecardId: string | null;
  won: number;
  lost: number;
  open: number;
  decided: number;
  winRate: number | null;
  wonValue: number;
  topLossReasons: Array<{ reason: string; count: number }>;
}

interface WinLossResponse {
  competitors: WinLossRow[];
  unmatched: Array<{ key: string; name: string; count: number }>;
  minDecidedForRate: number;
  totals: { dealsWithIncumbent: number; decided: number };
  unbacked: string[];
  canAuthor: boolean;
}

interface TakeawayResponse {
  data: Array<{
    accountId: string;
    companyName: string | null;
    competitor: string | null;
    battlecardId: string | null;
    churnedDate: string | null;
    city: string | null;
    state: string | null;
  }>;
  total: number;
}

const EMPTY_FORM = {
  id: '',
  name: '',
  aliases: '',
  positioning: '',
  whereWeWin: '',
  whereWeLose: '',
  objections: '',
};

/** One objection per line, "what they say | what to say back". */
function parseObjections(text: string): Objection[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [objection, ...rest] = line.split('|');
      return { objection: objection.trim(), response: rest.join('|').trim() };
    })
    .filter((o) => o.objection || o.response);
}

function formatObjections(objections: Objection[] | undefined): string {
  return (objections ?? []).map((o) => `${o.objection} | ${o.response}`).join('\n');
}

export default function CompetitiveIntelligence() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const cardsQuery = useQuery<{ data: Battlecard[]; canAuthor: boolean }>({
    queryKey: ['/api/competitors/battlecards'],
    queryFn: () => apiRequest('/api/competitors/battlecards'),
  });
  const winLossQuery = useQuery<WinLossResponse>({
    queryKey: ['/api/competitors/win-loss'],
    queryFn: () => apiRequest('/api/competitors/win-loss'),
  });
  const takeawayQuery = useQuery<TakeawayResponse>({
    queryKey: ['/api/competitors/takeaway-targets'],
    queryFn: () => apiRequest('/api/competitors/takeaway-targets'),
  });

  const cards = cardsQuery.data?.data ?? [];
  const canAuthor = cardsQuery.data?.canAuthor ?? false;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/competitors/battlecards'] });
    queryClient.invalidateQueries({ queryKey: ['/api/competitors/win-loss'] });
    queryClient.invalidateQueries({ queryKey: ['/api/competitors/takeaway-targets'] });
  };

  const saveCard = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        aliases: form.aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        positioning: form.positioning || null,
        whereWeWin: form.whereWeWin || null,
        whereWeLose: form.whereWeLose || null,
        commonObjections: parseObjections(form.objections),
      };
      return form.id
        ? apiRequest(`/api/competitors/battlecards/${form.id}`, 'PUT', body)
        : apiRequest('/api/competitors/battlecards', 'POST', body);
    },
    onSuccess: () => {
      toast({ title: form.id ? 'Battlecard updated' : 'Battlecard created' });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (err: unknown) =>
      toast({
        title: 'Could not save the battlecard',
        // The duplicate-competitor message names the fix (add an alias), so it
        // is shown rather than replaced with something generic.
        description: err instanceof Error ? err.message : 'Save failed.',
        variant: 'destructive',
      }),
  });

  const openNew = (name = '') => {
    setForm({ ...EMPTY_FORM, name });
    setDialogOpen(true);
  };

  const openEdit = (card: Battlecard) => {
    setForm({
      id: card.id,
      name: card.name,
      aliases: (card.aliases ?? []).join(', '),
      positioning: card.positioning ?? '',
      whereWeWin: card.whereWeWin ?? '',
      whereWeLose: card.whereWeLose ?? '',
      objections: formatObjections(card.commonObjections),
    });
    setDialogOpen(true);
  };

  const winLoss = winLossQuery.data;

  return (
    <MainLayout
      title="Competitive intelligence"
      description="Who we are up against, what beats them, and who we have lost to."
    >
      <Tabs defaultValue="win-loss" className="space-y-4">
        <TabsList>
          <TabsTrigger value="win-loss">
            <TrendingUp className="h-4 w-4 mr-1.5" /> Win / loss
          </TabsTrigger>
          <TabsTrigger value="battlecards">
            <Swords className="h-4 w-4 mr-1.5" /> Battlecards
          </TabsTrigger>
          <TabsTrigger value="takeaway">
            <Target className="h-4 w-4 mr-1.5" /> Takeaway targets
          </TabsTrigger>
        </TabsList>

        {/* ── Win / loss ─────────────────────────────────────────── */}
        <TabsContent value="win-loss">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Win and loss by competitor</CardTitle>
            </CardHeader>
            <CardContent>
              {winLossQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : winLossQuery.isError ? (
                /* CR-033: a failed fetch rendered "No competitive deals yet",
                   which tells a sales manager their reps are not meeting
                   competition. */
                <InlineQueryError label="win/loss" onRetry={winLossQuery.refetch} />
              ) : !winLoss || winLoss.competitors.length === 0 ? (
                <EmptyState
                  title="No competitive deals yet"
                  description={
                    winLoss?.unbacked?.[0] ??
                    'Deals record an incumbent vendor on the deal record. Once some do, they show up here.'
                  }
                />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competitor</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Lost</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                        <TableHead className="text-right">Win rate</TableHead>
                        <TableHead className="text-right">Won value</TableHead>
                        <TableHead>Why we lost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {winLoss.competitors.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium">
                            {row.name}
                            {!row.battlecardId && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                No battlecard
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.won}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.lost}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.open}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.winRate == null ? (
                              <span className="text-muted-foreground text-xs">
                                {row.decided} decided
                              </span>
                            ) : (
                              `${Math.round(row.winRate * 100)}%`
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrencyWhole(row.wonValue)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.topLossReasons.length === 0
                              ? '—'
                              : row.topLossReasons
                                  .map((r) => `${r.reason} (${r.count})`)
                                  .join(', ')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <p className="text-xs text-muted-foreground mt-3">
                    A win rate needs at least {winLoss.minDecidedForRate} decided deals. Below that
                    the counts are shown and the rate is not, because a rate over three deals is an
                    anecdote. Deals with no incumbent recorded are excluded entirely.
                  </p>

                  {winLoss.unmatched.length > 0 && (
                    <div className="mt-4 border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Spellings with no battlecard
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {winLoss.unmatched.map((u) => (
                          <Badge
                            key={u.key}
                            variant="outline"
                            className={canAuthor ? 'cursor-pointer' : undefined}
                            onClick={canAuthor ? () => openNew(u.name) : undefined}
                          >
                            {u.name} ({u.count})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Battlecards ────────────────────────────────────────── */}
        <TabsContent value="battlecards">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Battlecards</CardTitle>
              {canAuthor && (
                <Button size="sm" onClick={() => openNew()}>
                  <Plus className="h-4 w-4 mr-1" /> New battlecard
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {cardsQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : cards.length === 0 ? (
                <EmptyState
                  title="No battlecards yet"
                  description={
                    canAuthor
                      ? 'Write one for each competitor you meet. It shows on every deal that names them.'
                      : 'A sales manager can write these. They show on every deal that names the competitor.'
                  }
                />
              ) : (
                cards.map((card) => (
                  <div key={card.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium">{card.name}</span>
                        {(card.aliases ?? []).length > 0 && (
                          <span className="text-xs text-muted-foreground truncate">
                            also: {card.aliases.join(', ')}
                          </span>
                        )}
                      </div>
                      {canAuthor && (
                        <Button size="sm" variant="ghost" onClick={() => openEdit(card)}>
                          Edit
                        </Button>
                      )}
                    </div>
                    {card.positioning && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {card.positioning}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Takeaway targets ───────────────────────────────────── */}
        <TabsContent value="takeaway">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accounts lost to a competitor</CardTitle>
            </CardHeader>
            <CardContent>
              {takeawayQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (takeawayQuery.data?.data.length ?? 0) === 0 ? (
                <EmptyState
                  title="No accounts marked as lost to a competitor"
                  description="An account gets here when its deactivation reason is set to competitor_switch."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Went to</TableHead>
                      <TableHead>Left</TableHead>
                      <TableHead>Where</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {takeawayQuery.data?.data.map((t) => (
                      <TableRow key={t.accountId}>
                        <TableCell className="font-medium">
                          <Link href={`/leads/${t.accountId}`} className="hover:underline">
                            {t.companyName ?? 'Unnamed account'}
                          </Link>
                        </TableCell>
                        <TableCell>{t.competitor ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.churnedDate ? new Date(t.churnedDate).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[t.city, t.state].filter(Boolean).join(', ') || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit battlecard' : 'New battlecard'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bc-name">Competitor</Label>
              <Input
                id="bc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Xerox"
              />
            </div>
            <div>
              <Label htmlFor="bc-aliases">Other spellings</Label>
              <Input
                id="bc-aliases"
                value={form.aliases}
                onChange={(e) => setForm({ ...form, aliases: e.target.value })}
                placeholder="Xerox Corporation, XRX"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma separated. Case, punctuation and company suffixes already match on their own;
                add anything a rep types that does not look like the name.
              </p>
            </div>
            <div>
              <Label htmlFor="bc-positioning">How we position</Label>
              <Textarea
                id="bc-positioning"
                rows={3}
                value={form.positioning}
                onChange={(e) => setForm({ ...form, positioning: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bc-objections">Common objections</Label>
              <Textarea
                id="bc-objections"
                rows={4}
                value={form.objections}
                onChange={(e) => setForm({ ...form, objections: e.target.value })}
                placeholder={'Their service response is faster | Ask for their SLA in writing'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                One per line: what they say, a pipe, what to say back.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="bc-win">Where we win</Label>
                <Textarea
                  id="bc-win"
                  rows={3}
                  value={form.whereWeWin}
                  onChange={(e) => setForm({ ...form, whereWeWin: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="bc-lose">Where we lose</Label>
                <Textarea
                  id="bc-lose"
                  rows={3}
                  value={form.whereWeLose}
                  onChange={(e) => setForm({ ...form, whereWeLose: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveCard.mutate()}
              disabled={!form.name.trim() || saveCard.isPending}
            >
              {saveCard.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
