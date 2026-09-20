/**
 * Forecast by category, the copier revenue split, and commit-vs-actual (COP-I06).
 *
 * Three things it is careful about, because each is a way a forecast page lies:
 *
 *  - ONE-TIME AND RECURRING ARE NEVER ADDED. Equipment lands once; CPC and
 *    service land every month. The page shows both and an annualized recurring
 *    figure, and never a single number that blends them.
 *  - UNCATEGORIZED IS ITS OWN ROW, not folded into Pipeline. A deal nobody has
 *    judged is exactly what a manager is looking for.
 *  - NO SNAPSHOT MEANS NO ACCURACY. The accuracy tab says nothing has been
 *    captured rather than showing 100%, and attainment against a zero commit
 *    renders as a dash, not as a miss.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrencyWhole } from '@/lib/utils';
import { Camera, Info } from 'lucide-react';

interface Bucket {
  category: string;
  count: number;
  oneTimeValue: number;
  recurringMonthlyValue: number;
  recurringAnnualValue: number;
  weightedOneTimeValue: number;
  dealsWithoutAmount: number;
}

interface OwnerRow {
  ownerId: string | null;
  ownerName: string | null;
  count: number;
  oneTimeValue: number;
  recurringMonthlyValue: number;
  commitOneTimeValue: number;
  bestCaseOneTimeValue: number;
  uncategorizedCount: number;
}

interface TerritoryRow {
  territoryId: string | null;
  territoryName: string;
  count: number;
  oneTimeValue: number;
  recurringMonthlyValue: number;
  commitOneTimeValue: number;
  uncategorizedCount: number;
}

interface CategoriesResponse {
  period: { start: string; end: string };
  buckets: Bucket[];
  byOwner: OwnerRow[];
  byTerritory: TerritoryRow[];
  /** Why the territory roll-up is empty, when it is. Null when it has rows. */
  territoryNote: string | null;
  totals: {
    count: number;
    oneTimeValue: number;
    recurringMonthlyValue: number;
    recurringAnnualValue: number;
    weightedOneTimeValue: number;
    uncategorizedCount: number;
    dealsWithoutAmount: number;
  };
  unbacked: string[];
}

interface AccuracyResponse {
  periods: Array<{
    periodStart: string;
    periodEnd: string;
    ownerId: string | null;
    committed: number;
    bestCase: number;
    actual: number;
    variance: number;
    attainment: number | null;
    capturedAt: string | null;
  }>;
  unbacked: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  commit: 'Commit',
  best_case: 'Best case',
  pipeline: 'Pipeline',
  closed: 'Closed',
  uncategorized: 'Not categorized',
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function ForecastCategoryPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery<CategoriesResponse>({
    queryKey: ['/api/pipeline-forecast/categories'],
    queryFn: () => apiRequest('/api/pipeline-forecast/categories'),
  });
  const accuracyQuery = useQuery<AccuracyResponse>({
    queryKey: ['/api/pipeline-forecast/accuracy'],
    queryFn: () => apiRequest('/api/pipeline-forecast/accuracy'),
  });

  const capture = useMutation({
    mutationFn: () => apiRequest('/api/pipeline-forecast/snapshots', 'POST'),
    onSuccess: () => {
      toast({ title: 'Forecast captured' });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-forecast/accuracy'] });
    },
    onError: () => toast({ title: 'Could not capture the forecast', variant: 'destructive' }),
  });

  const data = categoriesQuery.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Forecast by category</CardTitle>
            {data && (
              <p className="text-xs text-muted-foreground mt-1">
                {shortDate(data.period.start)} to {shortDate(data.period.end)}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={capture.isPending || !data || data.totals.count === 0}
            onClick={() => capture.mutate()}
          >
            <Camera className="h-4 w-4 mr-1.5" />
            Capture this forecast
          </Button>
        </CardHeader>
        <CardContent>
          {categoriesQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !data || data.totals.count === 0 ? (
            <EmptyState
              title="No open deals close in this period"
              description="The forecast covers deals whose expected close date falls inside the period and whose stage is included in the forecast."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead className="text-right">One-time</TableHead>
                    <TableHead className="text-right">Recurring / mo</TableHead>
                    <TableHead className="text-right">Recurring / yr</TableHead>
                    <TableHead className="text-right">Weighted one-time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.buckets.map((bucket) => (
                    <TableRow key={bucket.category}>
                      <TableCell className="font-medium">
                        {CATEGORY_LABELS[bucket.category] ?? bucket.category}
                        {bucket.category === 'uncategorized' && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Needs a call
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{bucket.count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyWhole(bucket.oneTimeValue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyWhole(bucket.recurringMonthlyValue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyWhole(bucket.recurringAnnualValue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrencyWhole(bucket.weightedOneTimeValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <p className="text-xs text-muted-foreground mt-3">
                One-time and recurring are never added together: equipment lands once, CPC and
                service land every month. Weighted values use the stage&apos;s probability and are
                shown alongside the category totals, not instead of them — a commit is somebody
                saying what they will close, and discounting it again double-counts one judgement.
              </p>

              {data.unbacked.length > 0 && (
                <ul className="mt-3 space-y-1 border-t pt-3">
                  {data.unbacked.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Roll-up by rep ───────────────────────────────────────── */}
      {data && data.byOwner.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By rep</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Commit</TableHead>
                  <TableHead className="text-right">Best case</TableHead>
                  <TableHead className="text-right">Recurring / mo</TableHead>
                  <TableHead className="text-right">Uncategorized</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byOwner.map((row) => (
                  <TableRow key={row.ownerId ?? 'unassigned'}>
                    <TableCell className="font-medium">
                      {row.ownerName ?? (row.ownerId ? 'Unnamed user' : 'Unassigned')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyWhole(row.commitOneTimeValue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyWhole(row.bestCaseOneTimeValue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyWhole(row.recurringMonthlyValue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.uncategorizedCount > 0 ? (
                        <span className="text-amber-700">{row.uncategorizedCount}</span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-3">
              Rep-level roll-up. Team roll-up needs a reporting hierarchy, which no story has built
              yet, so it is absent here rather than approximated.
            </p>
          </CardContent>
        </Card>
      )}

      {/*
        COP-I06 AC3's territory half. The endpoint has sent `byTerritory` since
        COP-B09 landed the territory model, and nothing rendered it - while the
        note above this card still told the reader that roll-up "is not built
        yet". A stale disclaimer is worse than none: it stops anyone looking.
      */}
      {data && (data.byTerritory.length > 0 || data.territoryNote) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By territory</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byTerritory.length === 0 ? (
              <p className="text-sm text-muted-foreground">{data.territoryNote}</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Territory</TableHead>
                      <TableHead className="text-right">Deals</TableHead>
                      <TableHead className="text-right">Commit</TableHead>
                      <TableHead className="text-right">One-time</TableHead>
                      <TableHead className="text-right">Recurring / mo</TableHead>
                      <TableHead className="text-right">Uncategorized</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byTerritory.map((row) => (
                      <TableRow key={row.territoryId ?? 'unassigned'}>
                        <TableCell className="font-medium">{row.territoryName}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyWhole(row.commitOneTimeValue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyWhole(row.oneTimeValue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyWhole(row.recurringMonthlyValue)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.uncategorizedCount > 0 ? (
                            <span className="text-amber-700">{row.uncategorizedCount}</span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/*
                  An account whose territory text matches no defined territory
                  lands in Unassigned rather than being dropped, so these rows
                  still add up to the totals above them (COP-B10's rule).
                */}
                <p className="text-xs text-muted-foreground mt-3">
                  A deal counts towards a territory when its account&rsquo;s territory matches a
                  defined one by name or code. Unmatched accounts are shown as Unassigned rather
                  than omitted.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Commit vs actual ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commit vs actual</CardTitle>
        </CardHeader>
        <CardContent>
          {accuracyQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (accuracyQuery.data?.periods.length ?? 0) === 0 ? (
            <EmptyState
              title="Nothing captured yet"
              description={
                accuracyQuery.data?.unbacked?.[0] ??
                'Capture a forecast to start measuring accuracy against it.'
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Committed</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Attainment</TableHead>
                    <TableHead>Captured</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accuracyQuery.data?.periods.map((p, i) => (
                    <TableRow key={`${p.periodStart}-${p.ownerId ?? ''}-${i}`}>
                      <TableCell className="font-medium">{shortDate(p.periodStart)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyWhole(p.committed)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyWhole(p.actual)}
                      </TableCell>
                      <TableCell
                        className={
                          p.variance >= 0
                            ? 'text-right tabular-nums text-emerald-700'
                            : 'text-right tabular-nums text-rose-700'
                        }
                      >
                        {p.variance >= 0 ? '+' : ''}
                        {formatCurrencyWhole(p.variance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {/* A dash, not 0%: a period nobody committed anything
                            for has no attainment, and 0% reads as a total miss
                            by somebody who was never asked for a number. */}
                        {p.attainment == null ? '—' : `${Math.round(p.attainment * 100)}%`}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.capturedAt ? shortDate(p.capturedAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(accuracyQuery.data?.unbacked ?? []).map((note, i) => (
                <p key={i} className="text-xs text-muted-foreground mt-3">
                  {note}
                </p>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
