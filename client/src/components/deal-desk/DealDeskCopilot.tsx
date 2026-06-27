/**
 * Deal Desk Copilot sidebar (US-SUPER-008).
 *
 * Advisory, non-blocking right-side drawer rendered on the quote (proposal) edit
 * page. Four independent panels — Account snapshot, Similar deals, Live margin,
 * Likely objections — each with its own useQuery so they load independently with
 * skeletons. The drawer is collapsible so the rep can hide it; nothing here
 * blocks the quote flow and errors render inline (never throw).
 *
 * `quoteId` === `proposals.id`.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  ChevronRight,
  Lightbulb,
  PanelRightClose,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

// The Copilot is an advisory, non-blocking sidebar. Its endpoints may be
// unavailable (the edge fn isn't deployed everywhere, or a gateway returns a
// transient 5xx). Don't retry and don't fire the global error toast for these
// queries — failures degrade silently (the drawer hides itself). The thrown
// errors are `Error("404: …")` with no `.status`, so the global retry guard
// can't catch them — disable retry here explicitly.
const COPILOT_QUERY_OPTS = { retry: false as const, onError: () => {} };

// ---------------------------------------------------------------------------
// API shapes (locally typed)
// ---------------------------------------------------------------------------

interface SnapshotResponse {
  customerId: string;
  openTickets: { total: number; byPriority: Record<string, number> };
  arAging: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90_plus: number;
    total: number;
    pastDue: number;
  };
  lastQuotes: Array<{
    proposalNumber: string;
    status: string | null;
    totalAmount: number;
    updatedAt: string | null;
  }>;
  churn: { score: number; band: string } | null;
}

interface SimilarDealsResponse {
  closeRate: number | null;
  avgDiscount: number | null;
  avgDealSize: number | null;
  cohortSize: number;
  deals: Array<{
    id: string;
    proposalNumber: string;
    totalAmount: number;
    discountPercentage: number;
    updatedAt: string | null;
  }>;
}

interface MarginResponse {
  revenue: number;
  cost: number;
  grossProfit: number;
  gpPercent: number;
  gpFloorPct: number;
  belowFloor: boolean;
  financed: boolean;
  costBreakdown: {
    partsCost: number;
    serviceCost: number;
    financingCost: number;
  };
}

interface ObjectionsResponse {
  objections: Array<{ objection: string; response: string }>;
  source: 'ai' | 'fallback';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const money = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  urgent: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

function statusVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'accepted':
      return 'default';
    case 'rejected':
    case 'expired':
      return 'destructive';
    case 'sent':
    case 'viewed':
      return 'secondary';
    default:
      return 'outline';
  }
}

function churnVariant(band: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (band) {
    case 'at_risk':
      return 'destructive';
    case 'watch':
      return 'secondary';
    default:
      return 'outline';
  }
}

function PanelError({ message }: { message: string }) {
  return <p className="text-xs text-muted-foreground">Unable to load: {message}</p>;
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function SnapshotPanel({ quoteId }: { quoteId: string }) {
  const { data, isLoading, isError, error } = useQuery<SnapshotResponse>({
    queryKey: [`/api/deal-desk-copilot/${quoteId}/snapshot`],
    ...COPILOT_QUERY_OPTS,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Account snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </>
        ) : isError ? (
          <PanelError message={(error as Error)?.message ?? 'error'} />
        ) : data ? (
          <>
            {/* Open tickets */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Open service tickets</span>
                <span className="font-medium">{data.openTickets.total}</span>
              </div>
              {data.openTickets.total > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(data.openTickets.byPriority).map(([p, n]) => (
                    <Badge
                      key={p}
                      variant={PRIORITY_VARIANT[p] ?? 'outline'}
                      className="text-[10px]"
                    >
                      {p}: {n}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* AR aging */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-muted-foreground">AR aging</span>
                {data.arAging.pastDue > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {money(data.arAging.pastDue)} past due
                  </Badge>
                )}
              </div>
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="text-muted-foreground">Current</td>
                    <td className="text-right">{money(data.arAging.current)}</td>
                    <td className="pl-2 text-muted-foreground">31-60</td>
                    <td className="text-right">{money(data.arAging.d31_60)}</td>
                  </tr>
                  <tr>
                    <td className="text-muted-foreground">1-30</td>
                    <td className="text-right">{money(data.arAging.d1_30)}</td>
                    <td className="pl-2 text-muted-foreground">61-90</td>
                    <td className="text-right">{money(data.arAging.d61_90)}</td>
                  </tr>
                  <tr>
                    <td className="text-muted-foreground">90+</td>
                    <td className="text-right">{money(data.arAging.d90_plus)}</td>
                    <td className="pl-2 font-medium">Total</td>
                    <td className="text-right font-medium">{money(data.arAging.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Last 3 quote outcomes */}
            <div>
              <span className="text-muted-foreground">Recent quote outcomes</span>
              {data.lastQuotes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No prior quotes.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {data.lastQuotes.map((q) => (
                    <li
                      key={q.proposalNumber}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="truncate">{q.proposalNumber}</span>
                      <span className="flex items-center gap-2">
                        <span>{money(q.totalAmount)}</span>
                        <Badge variant={statusVariant(q.status)} className="text-[10px]">
                          {q.status ?? 'draft'}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Churn risk */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Churn risk</span>
              {data.churn ? (
                <Badge variant={churnVariant(data.churn.band)} className="text-[10px]">
                  {Math.round(data.churn.score)} · {data.churn.band}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">n/a</span>
              )}
            </div>
            <Link
              href="/customers/risk"
              className="inline-flex items-center text-xs text-primary hover:underline"
            >
              See Customer Risk <ChevronRight className="h-3 w-3" />
            </Link>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SimilarDealsPanel({ quoteId }: { quoteId: string }) {
  const { data, isLoading, isError, error } = useQuery<SimilarDealsResponse>({
    queryKey: [`/api/deal-desk-copilot/${quoteId}/similar-deals`],
    ...COPILOT_QUERY_OPTS,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1 text-sm font-semibold">
          <TrendingUp className="h-4 w-4" /> Similar deals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : isError ? (
          <PanelError message={(error as Error)?.message ?? 'error'} />
        ) : data ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-base font-semibold">
                  {data.closeRate == null ? '—' : `${data.closeRate}%`}
                </div>
                <div className="text-[10px] text-muted-foreground">Close rate</div>
              </div>
              <div>
                <div className="text-base font-semibold">
                  {data.avgDiscount == null ? '—' : `${data.avgDiscount}%`}
                </div>
                <div className="text-[10px] text-muted-foreground">Avg discount</div>
              </div>
              <div>
                <div className="text-base font-semibold">
                  {data.avgDealSize == null ? '—' : money(data.avgDealSize)}
                </div>
                <div className="text-[10px] text-muted-foreground">Avg size</div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Based on {data.cohortSize} comparable deal{data.cohortSize === 1 ? '' : 's'}.
            </p>
            {data.deals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No closed-won comps found.</p>
            ) : (
              <ul className="space-y-1">
                {data.deals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-xs">
                    <span className="truncate">{d.proposalNumber}</span>
                    <span className="flex items-center gap-2">
                      <span>{money(d.totalAmount)}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round(d.discountPercentage)}% off
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MarginPanel({ quoteId }: { quoteId: string }) {
  const { data, isLoading, isError, error } = useQuery<MarginResponse>({
    queryKey: [`/api/deal-desk-copilot/${quoteId}/margin`],
    ...COPILOT_QUERY_OPTS,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Live margin</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </>
        ) : isError ? (
          <PanelError message={(error as Error)?.message ?? 'error'} />
        ) : data ? (
          <>
            {data.belowFloor && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Gross margin {data.gpPercent}% is below the {data.gpFloorPct}% floor.
                </span>
              </div>
            )}
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold">{money(data.grossProfit)}</div>
                <div className="text-[10px] text-muted-foreground">Gross profit (GP$)</div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${data.belowFloor ? 'text-destructive' : ''}`}>
                  {data.gpPercent}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  GP% (floor {data.gpFloorPct}%)
                </div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Revenue {money(data.revenue)}</span>
              <span>Cost {money(data.cost)}</span>
            </div>
            {data.costBreakdown ? (
              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Parts/hardware cost</span>
                  <span>{money(data.costBreakdown.partsCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Projected service cost</span>
                  <span>{money(data.costBreakdown.serviceCost)}</span>
                </div>
                {data.financed ? (
                  <div className="flex justify-between">
                    <span>Financing carry</span>
                    <span>{money(data.costBreakdown.financingCost)}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ObjectionsPanel({ quoteId }: { quoteId: string }) {
  const { data, isLoading, isError, error } = useQuery<ObjectionsResponse>({
    queryKey: [`/api/deal-desk-copilot/${quoteId}/objections`],
    ...COPILOT_QUERY_OPTS,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-1">
            <Lightbulb className="h-4 w-4" /> Likely objections
          </span>
          {data && (
            <Badge variant={data.source === 'ai' ? 'default' : 'outline'} className="text-[10px]">
              {data.source === 'ai' ? 'AI' : 'rule-based'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : isError ? (
          <PanelError message={(error as Error)?.message ?? 'error'} />
        ) : data ? (
          data.objections.length === 0 ? (
            <p className="text-xs text-muted-foreground">No objections predicted.</p>
          ) : (
            <ul className="space-y-2">
              {data.objections.map((o, i) => (
                <li key={i} className="rounded-md border p-2">
                  <p className="text-xs font-medium">{o.objection}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{o.response}</p>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

export default function DealDeskCopilot({ quoteId }: { quoteId: string }) {
  const [open, setOpen] = useState(true);

  // Availability probe. The snapshot is the cheapest endpoint and every panel
  // needs the account to exist, so use it to decide whether the Copilot backend
  // is reachable at all. Shares SnapshotPanel's query key (deduped → no extra
  // request). If it errors — the edge fn isn't deployed (404) or the gateway is
  // down (5xx) — hide the whole drawer rather than render four error panels.
  const probe = useQuery<SnapshotResponse>({
    queryKey: [`/api/deal-desk-copilot/${quoteId}/snapshot`],
    ...COPILOT_QUERY_OPTS,
  });
  if (probe.isError) return null;

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed right-0 top-24 z-40 rounded-l-md rounded-r-none shadow-md"
      >
        <Sparkles className="mr-1 h-4 w-4" /> Copilot
      </Button>
    );
  }

  return (
    <aside className="fixed right-0 top-16 bottom-0 z-40 w-80 overflow-y-auto border-l bg-background p-3 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1 text-sm font-semibold">
          <Sparkles className="h-4 w-4" /> Deal Desk Copilot
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(false)}
          aria-label="Collapse copilot"
          className="h-7 w-7"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
      <p className="mb-3 text-[10px] text-muted-foreground">
        Advisory only — these insights don&apos;t block the quote.
      </p>
      <div className="space-y-3">
        <SnapshotPanel quoteId={quoteId} />
        <SimilarDealsPanel quoteId={quoteId} />
        <MarginPanel quoteId={quoteId} />
        <ObjectionsPanel quoteId={quoteId} />
      </div>
    </aside>
  );
}
